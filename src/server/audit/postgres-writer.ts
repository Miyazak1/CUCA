import type { AuditEvent } from "./audit.ts";

export type SqlAuditClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

export class PostgresAuditWriter {
  private readonly client: SqlAuditClient;

  constructor(client: SqlAuditClient) {
    this.client = client;
  }

  async record(event: AuditEvent): Promise<void> {
    await this.client.query(
      `insert into audit_logs (
         request_id, actor_user_id, actor_type, active_role, tenant_school_id,
         action, resource_type, resource_id, allowed, policy_decision_id,
         data_classes, redaction_applied, metadata_json, ip_hash, user_agent_hash
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb, $14, $15)`,
      [
        event.requestId,
        event.actorUserId,
        event.actorType ?? (event.actorUserId ? "user" : "guest"),
        event.activeRole,
        event.tenantSchoolId,
        event.action,
        event.resourceType,
        event.resourceId,
        event.allowed,
        event.policyDecisionId,
        JSON.stringify(event.dataClasses),
        true,
        JSON.stringify(event.metadata),
        null,
        null,
      ],
    );
  }
}
