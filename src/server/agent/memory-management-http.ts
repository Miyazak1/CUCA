import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { badRequest, forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { requireMemoryControlContext } from "./memory-management.ts";
import { createPostgresAgentMemoryManagementService } from "./memory-runtime.ts";
import { agentRuntimeUnavailableResponse, isAgentRuntimeEnabled } from "./runtime/config.ts";

type Service = ReturnType<typeof createPostgresAgentMemoryManagementService>;
type Command = "list" | "clearOne" | "clearAll" | "setEnabled";

export function createMemoryManagementHttpHandler(service?: Service,
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } }) {
  return async (request: Request, command: Command, memoryId?: string): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const site = request.headers.get("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-origin browser memory controls are not allowed.");
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      requireMemoryControlContext(context);
      const query = requireControlQuery(request.url, command);
      if (!service) throw serviceUnavailable("Student memory controls are not configured.");
      let data;
      switch (command) {
        case "list": data = await service.list(context, query); break;
        case "clearOne": data = await service.clearOne(context, memoryId!); break;
        case "clearAll": data = await service.clearAll(context, await request.json()); break;
        case "setEnabled": data = await service.setEnabled(context, await request.json()); break;
      }
      return Response.json({ data });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

function requireControlQuery(url: string, command: Command) {
  const query = new URL(url).searchParams;
  for (const key of query.keys()) {
    if (command !== "list" || !["limit", "cursor"].includes(key) || query.getAll(key).length !== 1) throw badRequest("Unsupported memory control query.");
  }
  const limit = query.get("limit");
  if (limit !== null && !/^[1-9][0-9]{0,2}$/.test(limit)) throw badRequest("Invalid memory page size.");
  return { ...(limit !== null ? { limit: Number(limit) } : {}), ...(query.has("cursor") ? { cursor: query.get("cursor") } : {}) };
}

export function getMemoryManagementHttpHandler(env: Record<string, string | undefined> = process.env) {
  try {
    if (!isAgentRuntimeEnabled(env)) return agentRuntimeUnavailableResponse;
  } catch {
    return agentRuntimeUnavailableResponse;
  }
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createMemoryManagementHttpHandler(createPostgresAgentMemoryManagementService(client), new PostgresAuthSessionRepository(client));
  } catch { return createMemoryManagementHttpHandler(); }
}
