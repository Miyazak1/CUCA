import { toErrorEnvelope } from "../shared/errors.ts";
import { createRequestContext } from "../shared/request-context.ts";
import type { CatalogService } from "./service.ts";

type CatalogListName = "programs" | "programIntakes" | "schools" | "scholarships" | "cities";
type CatalogDetailName = "program" | "school" | "scholarship" | "city";

export function createCatalogHttpHandlers(service: CatalogService) {
  return {
    listPrograms: (request: Request) => handleCatalogList(request, service, "programs"),
    getProgram: (request: Request, programId: string) => handleCatalogDetail(request, service, "program", programId),
    listProgramIntakes: (request: Request, programId: string) => handleCatalogList(request, service, "programIntakes", programId),
    getProgramRequirements: async (request: Request, programId: string, intakeId: string) => {
      const context = createRequestContext({ requestId: request.headers.get("x-request-id") ?? undefined });
      try { return jsonResponse({ data: await service.getProgramRequirements(context, programId, intakeId) }); }
      catch (error) { return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500); }
    },
    listSchools: (request: Request) => handleCatalogList(request, service, "schools"),
    getSchool: (request: Request, schoolId: string) => handleCatalogDetail(request, service, "school", schoolId),
    listScholarships: (request: Request) => handleCatalogList(request, service, "scholarships"),
    getScholarship: (request: Request, scholarshipId: string) => handleCatalogDetail(request, service, "scholarship", scholarshipId),
    listCities: (request: Request) => handleCatalogList(request, service, "cities"),
    getCity: (request: Request, citySlug: string) => handleCatalogDetail(request, service, "city", citySlug),
  };
}

async function handleCatalogList(request: Request, service: CatalogService, name: CatalogListName, programId?: string): Promise<Response> {
  const context = createRequestContext({ requestId: request.headers.get("x-request-id") ?? undefined });

  try {
    const options = parseListOptions(request);
    const data = name === "programIntakes"
      ? await service.listProgramIntakes(context, programId!, options)
      : await callList(service, context, name, options);
    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function handleCatalogDetail(
  request: Request,
  service: CatalogService,
  name: CatalogDetailName,
  id: string,
): Promise<Response> {
  const context = createRequestContext({ requestId: request.headers.get("x-request-id") ?? undefined });

  try {
    const data = await callDetail(service, context, name, id);
    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

function parseListOptions(request: Request) {
  const url = new URL(request.url);
  return {
    limit: parseInteger(url.searchParams.get("limit")),
    offset: parseInteger(url.searchParams.get("offset")),
    query: url.searchParams.get("query") ?? undefined,
  };
}

function parseInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function callList(service: CatalogService, context: Parameters<CatalogService["listPrograms"]>[0], name: CatalogListName, options: Parameters<CatalogService["listPrograms"]>[1]) {
  switch (name) {
    case "programs":
      return service.listPrograms(context, options);
    case "schools":
      return service.listSchools(context, options);
    case "scholarships":
      return service.listScholarships(context, options);
    case "cities":
      return service.listCities(context, options);
    default:
      throw new Error("Unsupported catalog list route.");
  }
}

function callDetail(service: CatalogService, context: Parameters<CatalogService["getProgram"]>[0], name: CatalogDetailName, id: string) {
  switch (name) {
    case "program":
      return service.getProgram(context, id);
    case "school":
      return service.getSchool(context, id);
    case "scholarship":
      return service.getScholarship(context, id);
    case "city":
      return service.getCity(context, id);
    default:
      throw new Error("Unsupported catalog detail route.");
  }
}
