import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { badRequest, forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { PostgresMaterialSelection } from "./postgres-material-selection.ts";

type Service = Pick<PostgresMaterialSelection, "get" | "put">;
export function createMaterialSelectionHttpHandler(service: Service = {
  async get() { throw serviceUnavailable("Application material selections are not configured."); },
  async put() { throw serviceUnavailable("Application material selections are not configured."); },
}, auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } }) {
  return async (request: Request, setId: string, choiceId: string, operation: "get" | "put"): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const site = request.headers.get("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-origin browser material selections are not allowed.");
      if ([...new URL(request.url).searchParams].length) throw badRequest("Material selections do not accept query parameters.");
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      const data = operation === "get" ? await service.get(context, setId, choiceId)
        : await service.put(context, setId, choiceId, await request.json());
      return Response.json({ data });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getMaterialSelectionHttpHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createMaterialSelectionHttpHandler(new PostgresMaterialSelection(client), new PostgresAuthSessionRepository(client));
  } catch { return createMaterialSelectionHttpHandler(); }
}
