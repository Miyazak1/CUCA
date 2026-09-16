import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { badRequest, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { PostgresSchoolHandoffService } from "./school-handoff.ts";

type Service = Pick<PostgresSchoolHandoffService, "handoff" | "getProgress">;

const unavailable: Service = {
  async handoff() { throw serviceUnavailable("School handoff is not configured."); },
  async getProgress() { throw serviceUnavailable("School progress is not configured."); },
};

export function createSchoolHandoffHttpHandlers(service: Service = unavailable,
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } }) {
  const handle = (operation: "handoff" | "getProgress") => async (request: Request, applicationSetId: string) => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const url = new URL(request.url);
      if (url.search || url.hash) throw badRequest("School handoff URL must not include query or fragment data.");
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      const data = operation === "handoff"
        ? await service.handoff(context, applicationSetId, await request.json())
        : await service.getProgress(context, applicationSetId);
      return Response.json({ data }, { status: operation === "handoff" ? 201 : 200 });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId),
        { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
  return { handoff: handle("handoff"), getProgress: handle("getProgress") };
}

export function getSchoolHandoffHttpHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createSchoolHandoffHttpHandlers(new PostgresSchoolHandoffService(client), new PostgresAuthSessionRepository(client));
  } catch { return createSchoolHandoffHttpHandlers(); }
}
