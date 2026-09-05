import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { requireApplicationMaterialSnapshotQuery } from "./application-material-snapshot.ts";
import { resolveApplicationMaterialSnapshotCipher } from "./application-material-snapshot-envelope.ts";
import { PostgresApplicationMaterialSnapshot } from "./postgres-application-material-snapshot.ts";

type Operation = "get" | "create";
type Service = Pick<PostgresApplicationMaterialSnapshot, Operation>;

const unavailable: Service = {
  async get() { throw serviceUnavailable("Application material snapshots are not configured."); },
  async create() { throw serviceUnavailable("Application material snapshots are not configured."); },
};

export function createApplicationMaterialSnapshotHttpHandler(service: Service = unavailable,
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } }) {
  return async (request: Request, setId: string, choiceId: string, operation: Operation): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const site = request.headers.get("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-origin material snapshots are not allowed.");
      requireApplicationMaterialSnapshotQuery(request.url);
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      const data = operation === "get" ? await service.get(context, setId, choiceId)
        : await service.create(context, setId, choiceId, await request.json(), request.headers.get("idempotency-key"));
      return Response.json({ data });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId),
        { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getApplicationMaterialSnapshotHttpHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const service = new PostgresApplicationMaterialSnapshot(client, resolveApplicationMaterialSnapshotCipher());
    return createApplicationMaterialSnapshotHttpHandler(service, new PostgresAuthSessionRepository(client));
  } catch { return createApplicationMaterialSnapshotHttpHandler(); }
}
