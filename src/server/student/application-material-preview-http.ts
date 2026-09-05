import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { requireMaterialPreviewQuery, type MaterialPreviewDto } from "./application-material-preview.ts";
import { PostgresApplicationMaterialPreview } from "./postgres-application-material-preview.ts";

type Reader = { preview(context: RequestContext, setId: unknown, choiceId: unknown, value: unknown): Promise<MaterialPreviewDto> };
export function createApplicationMaterialPreviewHandler(
  reader: Reader = { async preview() { throw serviceUnavailable("Application material repository is not configured."); } },
  auth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } },
) {
  return async (request: Request, setId: string, choiceId: string): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const site = request.headers.get("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-origin browser material previews are not allowed.");
      requireMaterialPreviewQuery(request.url);
      const context = await resolveRequestContextFromRequest(request, auth, { purpose: "student_action" });
      requestId = context.requestId;
      return Response.json({ data: await reader.preview(context, setId, choiceId, await request.json()) });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getApplicationMaterialPreviewHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createApplicationMaterialPreviewHandler(new PostgresApplicationMaterialPreview(client), new PostgresAuthSessionRepository(client));
  } catch { return createApplicationMaterialPreviewHandler(); }
}
