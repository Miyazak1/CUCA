import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { badRequest, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { resolveApplicationMaterialSnapshotCipher } from "./application-material-snapshot-envelope.ts";
import { PostgresApplicationSubmissionService } from "./postgres-application-submission.ts";

type Service = Pick<PostgresApplicationSubmissionService, "submit">;

const unavailable: Service = {
  async submit() { throw serviceUnavailable("Application submission is not configured."); },
};

export function createApplicationSubmissionHttpHandler(service: Service = unavailable,
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } }) {
  return async (request: Request, applicationSetId: string): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const url = new URL(request.url);
      if (url.search || url.hash) throw badRequest("Application submission URL must not include query or fragment data.");
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      const data = await service.submit(context, applicationSetId, await request.json(),
        request.headers.get("idempotency-key"));
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId),
        { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getApplicationSubmissionHttpHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createApplicationSubmissionHttpHandler(
      new PostgresApplicationSubmissionService(client, resolveApplicationMaterialSnapshotCipher()),
      new PostgresAuthSessionRepository(client),
    );
  } catch { return createApplicationSubmissionHttpHandler(); }
}
