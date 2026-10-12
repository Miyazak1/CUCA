import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { PostgresInsightGovernance } from "./postgres-governance.ts";

export type InsightGovernanceHttpService = Pick<PostgresInsightGovernance, "listPosts" | "listVersions" | "getVersion" | "createPost" | "createDraft" | "publish" | "withdraw">;

export function createInsightGovernanceHttpHandlers(service: InsightGovernanceHttpService, authRepository: AuthSessionRepository) {
  return {
    listPosts: (request: Request) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.listPosts(context) }); }),
    createPost: (request: Request) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.createPost(context, inputRecord(await request.json(), ["postId", "versionId", "document"])) }, 201); }),
    listVersions: (request: Request, postId: string) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.listVersions(context, postId) }); }),
    createDraft: (request: Request, postId: string) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.createDraft(context, postId, inputRecord(await request.json(), ["versionId", "document"])) }, 201); }),
    getVersion: (request: Request, postId: string, versionId: string) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.getVersion(context, postId, versionId) }); }),
    publish: (request: Request, postId: string, versionId: string) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.publish(context, postId, versionId, inputRecord(await request.json(), ["expectedContentSha256", "expectedPublicationRevision"])) }); }),
    withdraw: (request: Request, postId: string) => withContext(request, authRepository, async context => { rejectQuery(request); return json({ data: await service.withdraw(context, postId, inputRecord(await request.json(), ["expectedPublicationRevision", "reason"])) }); }),
  };
}

async function withContext(request: Request, authRepository: AuthSessionRepository, work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<Response>) {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "catalog_management" });
  try { return await work(context); }
  catch (error) { return json(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500); }
}

function rejectQuery(request: Request) { if (new URL(request.url).searchParams.size) throw badRequest("Query parameters are not supported."); }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
