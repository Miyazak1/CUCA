import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { parsePreflightQuery, type ApplicationPreflightDto } from "./application-preflight.ts";
import { PostgresApplicationPreflight } from "./postgres-application-preflight.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { resolveApplicationMaterialSnapshotCipher } from "./application-material-snapshot-envelope.ts";

type Reader = { get(context: RequestContext, setId: unknown, choiceId: unknown, locale: unknown): Promise<ApplicationPreflightDto> };
export function createApplicationPreflightHandler(
  reader: Reader = { async get() { throw serviceUnavailable("Application preparation repository is not configured."); } },
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } },
) {
  return async (request: Request, setId: string, choiceId: string): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const site = request.headers.get("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-origin browser preparation reads are not allowed.");
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      const result = await reader.get(context, setId, choiceId, parsePreflightQuery(request.url));
      return Response.json({ data: result });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getApplicationPreflightHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    let cipher;
    try { cipher = resolveApplicationMaterialSnapshotCipher(); } catch { /* No snapshot can become current without a configured key. */ }
    return createApplicationPreflightHandler(new PostgresApplicationPreflight(client, cipher), new PostgresAuthSessionRepository(client));
  } catch {
    return createApplicationPreflightHandler();
  }
}
