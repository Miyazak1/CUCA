import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { CatalogAdminService } from "./service.ts";

export type CatalogAdminHttpService = Pick<CatalogAdminService,
  "listCities" | "getCity" | "createCity" | "updateCity" | "publishCity" | "archiveCity" | "restoreCity"
  | "listSchools" | "getSchool" | "createSchool" | "updateSchool" | "publishSchool" | "archiveSchool" | "restoreSchool"
  | "listPrograms" | "getProgram" | "createProgram" | "updateProgram" | "publishProgram" | "archiveProgram" | "restoreProgram"
  | "listScholarships" | "getScholarship" | "createScholarship" | "updateScholarship" | "publishScholarship" | "archiveScholarship" | "restoreScholarship"
  | "listReadiness" | "getReadiness" | "listReleaseManifests" | "getReleaseManifest" | "createReleaseManifest"
  | "supersedeReleaseManifest">;

export function createCatalogAdminHttpHandlers(service: CatalogAdminHttpService, authRepository: AuthSessionRepository) {
  return {
    listCities: (request: Request) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listCities(context, listInput(request)) })),
    createCity: (request: Request) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.createCity(context, await request.json()) }, 201);
    }),
    getCity: (request: Request, cityId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getCity(context, cityId) });
    }),
    updateCity: (request: Request, cityId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.updateCity(context, cityId, await request.json()) });
    }),
    publishCity: (request: Request, cityId: string) => command(request, authRepository,
      (context, input) => service.publishCity(context, cityId, input)),
    archiveCity: (request: Request, cityId: string) => command(request, authRepository,
      (context, input) => service.archiveCity(context, cityId, input)),
    restoreCity: (request: Request, cityId: string) => command(request, authRepository,
      (context, input) => service.restoreCity(context, cityId, input)),
    listSchools: (request: Request) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listSchools(context, listInput(request, "school")) })),
    createSchool: (request: Request) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.createSchool(context, await request.json()) }, 201);
    }),
    getSchool: (request: Request, schoolId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getSchool(context, schoolId) });
    }),
    updateSchool: (request: Request, schoolId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.updateSchool(context, schoolId, await request.json()) });
    }),
    publishSchool: (request: Request, schoolId: string) => command(request, authRepository,
      (context, input) => service.publishSchool(context, schoolId, input)),
    archiveSchool: (request: Request, schoolId: string) => command(request, authRepository,
      (context, input) => service.archiveSchool(context, schoolId, input)),
    restoreSchool: (request: Request, schoolId: string) => command(request, authRepository,
      (context, input) => service.restoreSchool(context, schoolId, input)),
    listPrograms: (request: Request) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listPrograms(context, listInput(request, "program")) })),
    createProgram: (request: Request) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.createProgram(context, await request.json()) }, 201);
    }),
    getProgram: (request: Request, programId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getProgram(context, programId) });
    }),
    updateProgram: (request: Request, programId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.updateProgram(context, programId, await request.json()) });
    }),
    publishProgram: (request: Request, programId: string) => command(request, authRepository,
      (context, input) => service.publishProgram(context, programId, input)),
    archiveProgram: (request: Request, programId: string) => command(request, authRepository,
      (context, input) => service.archiveProgram(context, programId, input)),
    restoreProgram: (request: Request, programId: string) => command(request, authRepository,
      (context, input) => service.restoreProgram(context, programId, input)),
    listScholarships: (request: Request) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listScholarships(context, listInput(request, "scholarship")) })),
    createScholarship: (request: Request) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.createScholarship(context, await request.json()) }, 201);
    }),
    getScholarship: (request: Request, scholarshipId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getScholarship(context, scholarshipId) });
    }),
    updateScholarship: (request: Request, scholarshipId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.updateScholarship(context, scholarshipId, await request.json()) });
    }),
    publishScholarship: (request: Request, scholarshipId: string) => command(request, authRepository,
      (context, input) => service.publishScholarship(context, scholarshipId, input)),
    archiveScholarship: (request: Request, scholarshipId: string) => command(request, authRepository,
      (context, input) => service.archiveScholarship(context, scholarshipId, input)),
    restoreScholarship: (request: Request, scholarshipId: string) => command(request, authRepository,
      (context, input) => service.restoreScholarship(context, scholarshipId, input)),
    listReadiness: (request: Request) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listReadiness(context, readinessListInput(request)) })),
    getReadiness: (request: Request, entityType: string, entityId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getReadiness(context, entityType, entityId) });
    }),
    listReleaseManifests: (request: Request) => withContext(request, authRepository, async context =>
      jsonResponse({ data: await service.listReleaseManifests(context, releaseManifestListInput(request)) })),
    createReleaseManifest: (request: Request) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.createReleaseManifest(context, await request.json()) }, 201);
    }),
    getReleaseManifest: (request: Request, manifestId: string) => withContext(request, authRepository, async context => {
      rejectQuery(request);
      return jsonResponse({ data: await service.getReleaseManifest(context, manifestId) });
    }),
    supersedeReleaseManifest: (request: Request, manifestId: string) => command(request, authRepository,
      (context, input) => service.supersedeReleaseManifest(context, manifestId, input)),
  };
}

async function command(request: Request, authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>, input: unknown) => Promise<unknown>) {
  return withContext(request, authRepository, async context => {
    rejectQuery(request);
    return jsonResponse({ data: await work(context, await request.json()) });
  });
}

async function withContext(request: Request, authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<Response>) {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "catalog_management" });
  try { return await work(context); }
  catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 500;
    return jsonResponse(toErrorEnvelope(error, context.requestId), status);
  }
}

function listInput(request: Request, entity = "city") {
  const params = new URL(request.url).searchParams;
  const value: Record<string, string | number> = {};
  for (const [key, raw] of params) {
    if (!["query", "status", "limit", "offset"].includes(key)) throw badRequest(`Unsupported ${entity}-management query parameter.`);
    if (key === "limit" || key === "offset") {
      if (!/^\d+$/.test(raw)) throw badRequest(`${entity}-management pagination values must be canonical integers.`);
      value[key] = Number(raw);
    } else value[key] = raw;
  }
  return inputRecord(value, ["query", "status", "limit", "offset"]);
}

function readinessListInput(request: Request) {
  const params = new URL(request.url).searchParams;
  const value: Record<string, string | number> = {};
  for (const [key, raw] of params) {
    if (!["entityType", "status", "readiness", "reason", "query", "limit", "offset"].includes(key)) {
      throw badRequest("Unsupported catalog-readiness query parameter.");
    }
    if (key === "limit" || key === "offset") {
      if (!/^\d+$/.test(raw)) throw badRequest("Catalog-readiness pagination values must be canonical integers.");
      value[key] = Number(raw);
    } else value[key] = raw;
  }
  return inputRecord(value, ["entityType", "status", "readiness", "reason", "query", "limit", "offset"]);
}

function releaseManifestListInput(request: Request) {
  const params = new URL(request.url).searchParams;
  const value: Record<string, string | number> = {};
  for (const [key, raw] of params) {
    if (!["status", "limit", "offset"].includes(key)) throw badRequest("Unsupported release-manifest query parameter.");
    if (key === "limit" || key === "offset") {
      if (!/^\d+$/.test(raw)) throw badRequest("Release-manifest pagination values must be canonical integers.");
      value[key] = Number(raw);
    } else value[key] = raw;
  }
  return inputRecord(value, ["status", "limit", "offset"]);
}

function rejectQuery(request: Request) {
  if (new URL(request.url).searchParams.size) throw badRequest("Query parameters are not supported.");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  } });
}
