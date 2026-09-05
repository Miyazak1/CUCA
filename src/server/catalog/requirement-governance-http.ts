import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { PostgresRequirementGovernance } from "./postgres-requirement-governance.ts";

export type RequirementGovernanceHttpService = Pick<PostgresRequirementGovernance,
  "getVersion" | "listVersions" | "createDraft" | "approve" | "publish" | "withdraw">;

export function createRequirementGovernanceHttpHandlers(
  service: RequirementGovernanceHttpService,
  authRepository: AuthSessionRepository,
) {
  return {
    listVersions: (request: Request, programId: string, intakeId: string) => withContext(request, authRepository, async context => {
      return jsonResponse({ data: await service.listVersions(context, programId, intakeId, listInput(request)) });
    }),
    createDraft: (request: Request, programId: string, intakeId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["versionId", "document"]);
      return jsonResponse({ data: await service.createDraft(context, programId, intakeId, input) }, 201);
    }),
    getVersion: (request: Request, programId: string, intakeId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getVersion(context, programId, intakeId, versionId) });
    }),
    approve: (request: Request, programId: string, intakeId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["expectedContentSha256", "effectiveFrom", "reviewDueAt", "sourceChecks",
        "scopeConfirmed", "publicContentConfirmed"]);
      return jsonResponse({ data: await service.approve(context, programId, intakeId, { versionId, ...input }) });
    }),
    publish: (request: Request, programId: string, intakeId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["expectedContentSha256", "expectedApprovalSha256", "expectedPublicationRevision"]);
      return jsonResponse({ data: await service.publish(context, programId, intakeId, { versionId, ...input }) });
    }),
    withdraw: (request: Request, programId: string, intakeId: string, versionId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      const input = inputRecord(await request.json(), ["expectedPublicationRevision", "reason"]);
      return jsonResponse({ data: await service.withdraw(context, programId, intakeId, { expectedVersionId: versionId, ...input }) });
    }),
  };
}

async function withContext(
  request: Request,
  authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<Response>,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "catalog_management" });
  try { return await work(context); }
  catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId),
      error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

function listInput(request: Request): { beforeVersion?: number; limit?: number } {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!["beforeVersion", "limit"].includes(key) || query.getAll(key).length !== 1) {
      throw badRequest("Unsupported requirement review query.");
    }
  }
  const result: { beforeVersion?: number; limit?: number } = {};
  for (const key of ["beforeVersion", "limit"] as const) {
    const value = query.get(key);
    if (value === null) continue;
    if (!/^[1-9][0-9]{0,9}$/.test(value)) throw badRequest("Requirement review pagination must use canonical positive integers.");
    result[key] = Number(value);
  }
  return result;
}

function rejectQuery(request: Request): void {
  if (new URL(request.url).searchParams.size > 0) throw badRequest("Query parameters are not supported.");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
