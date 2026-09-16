import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { PostgresGuideGovernance } from "./postgres-guide-governance.ts";

export type GuideGovernanceHttpService = Pick<PostgresGuideGovernance, "listGuides" | "listVersions" | "getVersion" | "createDraft" | "approve" | "publish" | "withdraw">;

export function createGuideGovernanceHttpHandlers(service: GuideGovernanceHttpService, authRepository: AuthSessionRepository) {
  return {
    listGuides: (request: Request) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.listGuides(context) });
    }),
    listVersions: (request: Request, guideId: string) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listVersions(context, guideId, listInput(request)) })),
    createDraft: (request: Request, guideId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["versionId", "document"]);
      return jsonResponse({ data: await service.createDraft(context, guideId, input) }, 201);
    }),
    getVersion: (request: Request, guideId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getVersion(context, guideId, versionId) });
    }),
    approve: (request: Request, guideId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["expectedContentSha256", "effectiveFrom", "reviewDueAt", "reviewReference", "contentReviewed", "sourcesVerified", "publicContentConfirmed"]);
      return jsonResponse({ data: await service.approve(context, guideId, { versionId, ...input }) });
    }),
    publish: (request: Request, guideId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["expectedContentSha256", "expectedApprovalSha256", "expectedPublicationRevision"]);
      return jsonResponse({ data: await service.publish(context, guideId, { versionId, ...input }) });
    }),
    withdraw: (request: Request, guideId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["expectedPublicationRevision", "reason"]);
      return jsonResponse({ data: await service.withdraw(context, guideId, { expectedVersionId: versionId, ...input }) });
    }),
  };
}

async function withContext(request: Request, authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<Response>) {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "catalog_management" });
  try { return await work(context); }
  catch (error) { return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500); }
}

function listInput(request: Request) {
  const params = new URL(request.url).searchParams, result: Record<string, number> = {};
  for (const key of ["beforeVersion", "limit"]) {
    const value = params.get(key);
    if (value === null) continue;
    if (!/^[1-9]\d*$/.test(value)) throw badRequest("Guide pagination values must be canonical positive integers.");
    result[key] = Number(value);
  }
  for (const key of params.keys()) if (!["beforeVersion", "limit"].includes(key)) throw badRequest("Unsupported guide pagination parameter.");
  return result;
}

function rejectQuery(request: Request) {
  if (new URL(request.url).searchParams.size) throw badRequest("Query parameters are not supported.");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
