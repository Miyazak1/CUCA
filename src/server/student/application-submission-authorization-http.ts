import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { requireApplicationAuthorizationQuery } from "./application-submission-authorization.ts";
import { PostgresApplicationSubmissionAuthorization } from "./postgres-application-submission-authorization.ts";

type Operation = "get" | "record" | "withdraw";
type Service = Pick<PostgresApplicationSubmissionAuthorization, Operation>;

const unavailable: Service = {
  async get() { throw serviceUnavailable("Application submission authorizations are not configured."); },
  async record() { throw serviceUnavailable("Application submission authorizations are not configured."); },
  async withdraw() { throw serviceUnavailable("Application submission authorizations are not configured."); },
};

export function createApplicationSubmissionAuthorizationHttpHandler(service: Service = unavailable,
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } }) {
  return async (request: Request, setId: string, choiceId: string, operation: Operation): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const site = request.headers.get("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-origin application authorizations are not allowed.");
      requireApplicationAuthorizationQuery(request.url);
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      const data = operation === "get" ? await service.get(context, setId, choiceId)
        : operation === "record" ? await service.record(context, setId, choiceId, await request.json(), request.headers.get("idempotency-key"))
        : await service.withdraw(context, setId, choiceId, await request.json());
      return Response.json({ data });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getApplicationSubmissionAuthorizationHttpHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createApplicationSubmissionAuthorizationHttpHandler(new PostgresApplicationSubmissionAuthorization(client),
      new PostgresAuthSessionRepository(client));
  } catch { return createApplicationSubmissionAuthorizationHttpHandler(); }
}
