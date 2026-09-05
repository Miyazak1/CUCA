import {
  resolveRequestContextFromRequest,
  type AuthSessionRepository,
  type SchoolTenantMembershipRepository,
} from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import type { SchoolCatalogCorrectionService } from "./service.ts";

export type SchoolCatalogCorrectionHttpService = Pick<SchoolCatalogCorrectionService,
  "listForSchool" | "submit" | "listForOps" | "claim" | "resolve">;

export function createSchoolCatalogCorrectionHttpHandlers(service: SchoolCatalogCorrectionHttpService,
  authRepository: AuthSessionRepository, schoolMembershipRepository?: SchoolTenantMembershipRepository) {
  return {
    listForSchool: (request: Request) => withContext(request, authRepository, schoolMembershipRepository,
      "school_catalog_correction", context => service.listForSchool(context)),
    submit: (request: Request) => withContext(request, authRepository, schoolMembershipRepository,
      "school_catalog_correction", async context => service.submit(context, await readJsonBody(request))),
    listForOps: (request: Request) => withContext(request, authRepository, undefined,
      "catalog_correction_review", context => service.listForOps(context, listInput(request))),
    claim: (request: Request, correctionId: string) => withContext(request, authRepository, undefined,
      "catalog_correction_review", async context => service.claim(context, correctionId, await readJsonBody(request))),
    resolve: (request: Request, correctionId: string) => withContext(request, authRepository, undefined,
      "catalog_correction_review", async context => service.resolve(context, correctionId, await readJsonBody(request))),
  };
}

async function withContext(request: Request, authRepository: AuthSessionRepository,
  schoolMembershipRepository: SchoolTenantMembershipRepository | undefined,
  purpose: "school_catalog_correction" | "catalog_correction_review",
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose, schoolTenantMembershipRepository: schoolMembershipRepository,
  });
  try {
    return jsonResponse({ data: await work(context) });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId),
      error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

function listInput(request: Request): { status?: string; limit?: number } {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!["status", "limit"].includes(key) || query.getAll(key).length !== 1) {
      throw badRequest("Unsupported catalog correction query.");
    }
  }
  const input: { status?: string; limit?: number } = {};
  const status = query.get("status"), limit = query.get("limit");
  if (status !== null) input.status = status;
  if (limit !== null) {
    if (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 100) {
      throw badRequest("Catalog correction limit must be a canonical integer from 1 to 100.");
    }
    input.limit = Number(limit);
  }
  return input;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw badRequest("Request body must be valid JSON."); }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json; charset=utf-8" },
  });
}
