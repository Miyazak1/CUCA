import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { applicationCommandDigests, type ApplicationCommand, type ApplicationCommandExecutor, type ApplicationCommandInput } from "./application-commands.ts";

export class PostgresApplicationCommands implements ApplicationCommandExecutor {
  private readonly client: TransactionalSqlClient;
  private readonly audit: AuditSink;

  constructor(client: TransactionalSqlClient, audit: AuditSink) {
    this.client = client;
    this.audit = audit;
  }

  async authorizeMutation(context: RequestContext): Promise<void> {
    return this.authorizeMutationWithAccountLock(context, false);
  }

  private async authorizeMutationWithAccountLock(context: RequestContext, exclusive: boolean): Promise<void> {
    if (!context.actorUserId || context.activeRole !== "student" || context.tenantSchoolId !== null
      || !context.dataClassAllowlist.includes("education_record")) throw forbidden();
    const userId = context.actorUserId;
    const users = await this.client.query(
      exclusive ? "select id from users where id = $1 and account_status = 'active' for update"
        : "select id from users where id = $1 and account_status = 'active' for share", [userId],
    );
    if (!users.length) throw forbidden("Active student account is required.");
    const roles = await this.client.query(
      "select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId],
    );
    if (!roles.length) throw forbidden("Active student role is required.");
  }

  // The production service factory supplies the business transaction's scoped client.
  async execute<T extends { id: string }>(
    context: RequestContext, operation: ApplicationCommand, input: ApplicationCommandInput,
    key: string | undefined, create: () => Promise<T>, reload: (id: string) => Promise<T | null>,
  ): Promise<T> {
    const digest = key === undefined ? null : applicationCommandDigests(operation, input, key);
    const sensitiveApplicationEvidence = operation === "application_authorization.record"
      || operation === "application_material_snapshot.create" || operation === "application.submit";
    await this.authorizeMutationWithAccountLock(context, sensitiveApplicationEvidence);
    const userId = context.actorUserId!;
    if (!digest) return create();

    const params = [userId, operation, digest.keyHash];
    const reserved = await this.client.query<{ id: string }>(
      `insert into student_application_command_receipts (user_id, operation, key_hash, request_hash, original_request_id)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, operation, key_hash) do nothing returning id`,
      [...params, digest.requestHash, context.requestId],
    );
    if (reserved[0]) {
      const result = await create();
      const completed = await this.client.query(
        `update student_application_command_receipts set resource_id = $2, completed_at = clock_timestamp()
         where id = $1 and resource_id is null returning id`, [reserved[0].id, result.id],
      );
      if (completed.length !== 1) throw serviceUnavailable("Application command receipt could not be completed.");
      return result;
    }

    // A separate READ COMMITTED statement sees the winner after the unique-key wait.
    const receipts = await this.client.query<{ requestHash: string; resourceId: string | null; originalRequestId: string }>(
      `select request_hash as "requestHash", resource_id as "resourceId", original_request_id as "originalRequestId"
       from student_application_command_receipts where user_id = $1 and operation = $2 and key_hash = $3`, params,
    );
    const receipt = receipts[0];
    if (!receipt || !receipt.resourceId) throw serviceUnavailable("Application command outcome requires reconciliation.");
    if (receipt.requestHash !== digest.requestHash) throw new CuacError("CONFLICT", "Idempotency-Key was already used with different application input.", 409);
    const result = await reload(receipt.resourceId);
    if (!result) throw new CuacError("CONFLICT", "The original application resource is no longer available. This key cannot create a replacement.", 409);
    const authorization = operation === "application_authorization.record";
    const materialSnapshot = operation === "application_material_snapshot.create";
    const submission = operation === "application.submit";
    await this.audit.record(buildAuditEvent(context, {
      action: "student.application_command.replay", resourceType: operation === "application_set.create" ? "application_set"
        : operation === "application_choice.add" ? "application_choice"
          : authorization ? "application_submission_authorization"
            : materialSnapshot ? "application_material_snapshot" : "application_submission",
      resourceId: result.id, allowed: true, policyDecisionId: context.policyDecisionId,
      dataClasses: authorization || materialSnapshot ? ["student_pii", "education_record"]
        : submission ? ["student_pii", "education_record", "payment_business"] : ["education_record"],
      metadata: { operation, originalRequestId: receipt.originalRequestId },
    }));
    return result;
  }
}
