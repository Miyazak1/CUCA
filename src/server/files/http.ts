import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { PostgresStudentFiles } from "./postgres-student-files.ts";

export type StudentFileService = Pick<PostgresStudentFiles, "listOwn" | "createUploadIntent" | "completeUpload" | "createDownload" | "requestDelete">;

export function createStudentFileHttpHandlers(service: StudentFileService, authRepository: AuthSessionRepository) {
  return {
    list: (request: Request) => handle(request, authRepository, context => service.listOwn(context)),
    createUploadIntent: (request: Request) => handle(request, authRepository, async context =>
      service.createUploadIntent(context, await readJsonBody(request), request.headers.get("idempotency-key"))),
    completeUpload: (request: Request, fileId: string) => handle(request, authRepository, async context => {
      const input = inputRecord(await readJsonBody(request), ["expectedRevision"], true);
      return service.completeUpload(context, fileId, input.expectedRevision);
    }),
    createDownload: (request: Request, fileId: string) => handle(request, authRepository, context => {
      if (request.body) throw badRequest("Request body must be empty.");
      return service.createDownload(context, fileId);
    }),
    requestDelete: (request: Request, fileId: string) => handle(request, authRepository, async context => {
      const input = inputRecord(await readJsonBody(request), ["expectedRevision"], true);
      return service.requestDelete(context, fileId, input.expectedRevision);
    }),
  };
}

async function handle(
  request: Request,
  authRepository: AuthSessionRepository,
  operation: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "student_action" });
  try {
    return jsonResponse({ data: await operation(context) });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) return {};
  try { return await request.json(); }
  catch { throw badRequest("Request body must be valid JSON."); }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
