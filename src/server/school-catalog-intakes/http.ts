import { resolveRequestContextFromRequest, type AuthSessionRepository, type SchoolTenantMembershipRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import type { SchoolCatalogIntakeService } from "./service.ts";

export type SchoolCatalogIntakeHttpService = Pick<SchoolCatalogIntakeService, "list" | "saveDraft" | "publish" | "withdraw">;

export function createSchoolCatalogIntakeHttpHandlers(service: SchoolCatalogIntakeHttpService,
  authRepository: AuthSessionRepository, schoolMembershipRepository?: SchoolTenantMembershipRepository) {
  const context = (request: Request) => resolveRequestContextFromRequest(request, authRepository,
    { purpose: "school_catalog_intake", schoolTenantMembershipRepository: schoolMembershipRepository });
  return {
    list: (request: Request) => respond(request, context, value => service.list(value)),
    saveDraft: (request: Request) => respond(request, context, async value => service.saveDraft(value, await body(request))),
    publish: (request: Request, versionId: string) => respond(request, context, value => service.publish(value, versionId)),
    withdraw: (request: Request, versionId: string) => respond(request, context, value => service.withdraw(value, versionId)),
  };
}

async function respond(request: Request, resolve: (request: Request) => ReturnType<typeof resolveRequestContextFromRequest>,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>) {
  const context = await resolve(request);
  try { return json({ data: await work(context) }); }
  catch (error) { return json(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500); }
}

async function body(request: Request) {
  try { return await request.json(); } catch { throw badRequest("Request body must be valid JSON."); }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
