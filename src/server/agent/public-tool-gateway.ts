import { createHash } from "node:crypto";
import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import type {
  CatalogListOptions,
  PublicCityDto,
  PublicProgramDto,
  PublicProgramIntakeDto,
  PublicScholarshipDto,
  PublicSchoolDto,
} from "../catalog/dto.ts";
import { evaluatePolicy, type PolicyDecision } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { DataClass, RequestContext } from "../shared/request-context.ts";
import type { AgentToolRateLimitDecision, AgentToolRateLimiter } from "./tool-rate-limit.ts";
import {
  getPublicAgentToolDefinition,
  validateAgentToolInvocation,
  type AgentToolDefinition,
  type AgentToolInvocation,
} from "./tool-registry.ts";

export const PUBLIC_AGENT_ROUTE_IDS = [
  "catalog.programs",
  "catalog.schools",
  "catalog.scholarships",
  "catalog.cities",
  "catalog.program_detail",
  "catalog.school_detail",
  "catalog.scholarship_detail",
  "catalog.city_detail",
] as const;

export type PublicAgentRouteId = (typeof PUBLIC_AGENT_ROUTE_IDS)[number];
export type PublicAgentPersona = "guest_discovery" | "student_discovery";

export type PublicAgentCatalogService = {
  listPrograms(context: RequestContext, options?: CatalogListOptions): Promise<PublicProgramDto[]>;
  getProgram(context: RequestContext, programId: string): Promise<PublicProgramDto | null>;
  listProgramIntakes(context: RequestContext, programId: string, options?: CatalogListOptions): Promise<PublicProgramIntakeDto[]>;
  listSchools(context: RequestContext, options?: CatalogListOptions): Promise<PublicSchoolDto[]>;
  getSchool(context: RequestContext, schoolId: string): Promise<PublicSchoolDto | null>;
  listScholarships(context: RequestContext, options?: CatalogListOptions): Promise<PublicScholarshipDto[]>;
  getScholarship(context: RequestContext, scholarshipId: string): Promise<PublicScholarshipDto | null>;
  listCities(context: RequestContext, options?: CatalogListOptions): Promise<PublicCityDto[]>;
  getCity(context: RequestContext, citySlug: string): Promise<PublicCityDto | null>;
};

export type PublicAgentToolExecutionInput = {
  conversationId: string;
  toolCallId: string;
  invocation: AgentToolInvocation;
};

export type PublicAgentToolResult = {
  schemaVersion: "cuac.agent-tool-result.v1";
  conversationId: string;
  toolCallId: string;
  toolKey: string;
  persona: PublicAgentPersona;
  projectionType: "public_catalog" | "navigation_intent";
  dataClassesReturned: readonly ["public_catalog"];
  inputHash: string;
  rateLimit: { remaining: number; resetAt: string };
  contentBoundary: {
    trust: "untrusted_public_catalog_data";
    instructionAuthority: "none";
    toolAuthority: "none";
  };
  data: unknown;
};

export type PublicAgentToolOutcome =
  | { ok: true; result: PublicAgentToolResult }
  | { ok: false; error: CuacError };

type ParsedExecution = {
  conversationId: string;
  toolCallId: string;
  invocation: AgentToolInvocation;
};

type SafeAuditState = {
  conversationId: string | null;
  toolCallId: string | null;
  toolKeyHash: string | null;
  inputHash: string | null;
  persona: PublicAgentPersona | "unresolved";
  definition: AgentToolDefinition | undefined;
  decision: PolicyDecision | undefined;
};

export class PublicAgentToolGateway {
  private readonly catalog: PublicAgentCatalogService;
  private readonly audit: AuditSink;
  private readonly rateLimiter: AgentToolRateLimiter;

  constructor(
    catalog: PublicAgentCatalogService,
    audit: AuditSink,
    rateLimiter: AgentToolRateLimiter,
  ) {
    this.catalog = catalog;
    this.audit = audit;
    this.rateLimiter = rateLimiter;
  }

  async execute(context: RequestContext, input: unknown): Promise<PublicAgentToolResult> {
    const outcome = await this.run(context, input);
    if (!outcome.ok) throw outcome.error;
    return outcome.result;
  }

  // Runtime composition commits this outcome before rethrowing a recorded denial.
  async run(context: RequestContext, input: unknown): Promise<PublicAgentToolOutcome> {
    const state: SafeAuditState = {
      conversationId: null,
      toolCallId: null,
      toolKeyHash: null,
      inputHash: null,
      persona: "unresolved",
      definition: undefined,
      decision: undefined,
    };
    try {
      const execution = parseExecution(input);
      state.conversationId = execution.conversationId;
      state.toolCallId = execution.toolCallId;
      state.toolKeyHash = hashValue(execution.invocation.toolKey);
      const definition = getPublicAgentToolDefinition(execution.invocation.toolKey);
      state.definition = definition;
      validateAgentToolInvocation(context, definition, execution.invocation);
      state.persona = requirePublicAgentPersona(context);
      const decision = evaluatePolicy(context, "agent.invoke_tool", {
        type: "agent_tool",
        dataClasses: definition!.requiredDataClasses,
      });
      state.decision = decision;
      if (!decision.allowed) throw forbidden(decision.reason);
      const args = parseToolArgs(definition!.toolKey, execution.invocation.args);
      state.inputHash = hashValue(canonicalJson(args));
      const rateLimit = await this.rateLimiter.assertAllowed(context, definition!);
      const data = await executeTool(this.catalog, context, definition!.toolKey, args);
      assertSafeToolOutput(definition!, data);
      const result = buildResult(execution, state.persona, definition!, state.inputHash, rateLimit, data);
      await this.record(context, state, true, "success", resultItemCount(data));
      return { ok: true, result };
    } catch (error) {
      if (!(error instanceof CuacError)) throw error;
      const denied = [400, 403, 429].includes(error.status);
      await this.record(context, state, !denied && Boolean(state.decision?.allowed), errorStatus(error), 0);
      return { ok: false, error };
    }
  }

  private record(
    context: RequestContext,
    state: SafeAuditState,
    allowed: boolean,
    resultStatus: string,
    itemCount: number,
  ): Promise<void> {
    const definition = state.definition;
    return this.audit.record(buildAuditEvent(context, {
      action: "agent.tool.invoke",
      resourceType: "agent_tool",
      resourceId: definition?.toolKey ?? null,
      allowed,
      policyDecisionId: state.decision?.id ?? null,
      dataClasses: definition?.dataClassesReturned ?? [],
      metadata: {
        conversationId: state.conversationId,
        toolCallId: state.toolCallId,
        toolKey: definition?.toolKey ?? null,
        toolKeyHash: state.toolKeyHash,
        inputHash: state.inputHash,
        persona: state.persona,
        projectionType: definition?.projectionType ?? null,
        dataClassesReturned: definition?.dataClassesReturned ?? [],
        redactionApplied: true,
        resultStatus,
        itemCount,
      },
    }));
  }
}

function parseExecution(value: unknown): ParsedExecution {
  const fields = inputRecord(value, ["conversationId", "toolCallId", "invocation"]);
  const invocationFields = inputRecord(fields.invocation, ["toolKey", "args"]);
  if (typeof invocationFields.toolKey !== "string") throw badRequest("toolKey must be text.");
  return {
    conversationId: inputUuid(fields.conversationId, "conversationId"),
    toolCallId: inputUuid(fields.toolCallId, "toolCallId"),
    invocation: { toolKey: invocationFields.toolKey, args: invocationFields.args as Record<string, unknown> },
  };
}

function requirePublicAgentPersona(context: RequestContext): PublicAgentPersona {
  if (context.purpose !== "agent_tool" || context.tenantSchoolId !== null
    || !context.dataClassAllowlist.includes("public_catalog")) {
    throw forbidden("Public Agent catalog persona is not available for this context.");
  }
  if (context.activeRole === "guest" && context.actorUserId === null && context.selectedSurface === "public"
    && context.authStrength === "guest" && /^sha256:[a-f0-9]{64}$/.test(context.guestSessionId ?? "")) {
    return "guest_discovery";
  }
  if (context.activeRole === "student" && isUuid(context.actorUserId)
    && context.selectedSurface === "student" && ["session", "step_up"].includes(context.authStrength)) {
    return "student_discovery";
  }
  throw forbidden("Public Agent catalog persona is not available for this context.");
}

function parseToolArgs(toolKey: string, value: unknown): Record<string, unknown> {
  switch (toolKey) {
    case "catalog.search_programs":
    case "catalog.search_schools":
    case "catalog.search_scholarships":
    case "catalog.search_cities":
      return parseSearchArgs(value);
    case "catalog.get_program_detail": {
      const fields = inputRecord(value, ["entityId"]);
      return { entityId: inputUuid(fields.entityId, "entityId") };
    }
    case "navigation.open_route":
      return parseNavigationArgs(value);
    default:
      throw badRequest("Agent tool is not executable in the public gateway.");
  }
}

function parseSearchArgs(value: unknown): Record<string, unknown> {
  const fields = inputRecord(value, ["query", "limit"]);
  return {
    ...(fields.query === undefined ? {} : { query: inputText(fields.query, "query", 120) }),
    limit: fields.limit === undefined ? 8 : inputInteger(fields.limit, "limit", 1, 8),
  };
}

function parseNavigationArgs(value: unknown): Record<string, unknown> {
  const fields = inputRecord(value, ["routeId", "entityRef"]);
  const routeId = inputEnum(fields.routeId, "routeId", PUBLIC_AGENT_ROUTE_IDS);
  const detail = routeId.endsWith("_detail");
  if (!detail && fields.entityRef !== undefined) throw badRequest("Catalog list routes do not accept entityRef.");
  if (detail && fields.entityRef === undefined) throw badRequest("Catalog detail routes require entityRef.");
  if (!detail) return { routeId };
  const raw = inputText(fields.entityRef, "entityRef", 128);
  const entityRef = routeId === "catalog.city_detail"
    ? parseCitySlug(raw)
    : inputUuid(raw, "entityRef");
  return { routeId, entityRef };
}

async function executeTool(
  catalog: PublicAgentCatalogService,
  context: RequestContext,
  toolKey: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const listOptions = { query: args.query as string | undefined, limit: args.limit as number, offset: 0 };
  switch (toolKey) {
    case "catalog.search_programs":
      return { items: (await catalog.listPrograms(context, listOptions)).map(projectProgram) };
    case "catalog.search_schools":
      return { items: (await catalog.listSchools(context, listOptions)).map(projectSchool) };
    case "catalog.search_scholarships":
      return { items: (await catalog.listScholarships(context, listOptions)).map(projectScholarship) };
    case "catalog.search_cities":
      return { items: (await catalog.listCities(context, listOptions)).map(projectCity) };
    case "catalog.get_program_detail": {
      const program = await catalog.getProgram(context, args.entityId as string);
      if (!program) throw new CuacError("NOT_FOUND", "Published program is not available.", 404);
      const school = await catalog.getSchool(context, program.schoolId);
      if (!school) throw serviceUnavailable("Agent catalog projection is unavailable.");
      const intakes = await catalog.listProgramIntakes(context, program.id, { limit: 8, offset: 0 });
      return { program: projectProgram(program), school: projectSchool(school), intakes: intakes.map(projectIntake) };
    }
    case "navigation.open_route":
      await assertNavigationTarget(catalog, context, args.routeId as PublicAgentRouteId, args.entityRef as string | undefined);
      return {
        intentType: "open_registered_route",
        routeId: args.routeId,
        params: args.entityRef ? { entityRef: args.entityRef } : {},
      };
    default:
      throw badRequest("Agent tool is not executable in the public gateway.");
  }
}

async function assertNavigationTarget(
  catalog: PublicAgentCatalogService,
  context: RequestContext,
  routeId: PublicAgentRouteId,
  entityRef: string | undefined,
): Promise<void> {
  let target: unknown = true;
  if (routeId === "catalog.program_detail") target = await catalog.getProgram(context, entityRef!);
  if (routeId === "catalog.school_detail") target = await catalog.getSchool(context, entityRef!);
  if (routeId === "catalog.scholarship_detail") target = await catalog.getScholarship(context, entityRef!);
  if (routeId === "catalog.city_detail") target = await catalog.getCity(context, entityRef!);
  if (!target) throw new CuacError("NOT_FOUND", "Published navigation target is not available.", 404);
}

function projectProgram(row: PublicProgramDto) {
  return {
    id: outputUuid(row.id),
    schoolId: outputUuid(row.schoolId),
    name: outputText(row.name, 160, true),
    university: outputText(row.university, 160),
    degreeLevel: outputText(row.degreeLevel, 64, true),
    fieldCategory: outputText(row.fieldCategory, 96),
    teachingLanguage: outputText(row.teachingLanguage, 64),
    tuition: {
      amount: outputNumber(row.tuitionAmount),
      currency: outputText(row.tuitionCurrency, 3),
      period: outputText(row.tuitionPeriod, 32),
      label: outputText(row.displayTuition ?? row.tuition, 160),
    },
    deadline: {
      date: outputDate(row.deadlineDate),
      label: outputText(row.deadlineLabel ?? row.deadline, 120),
      round: outputText(row.applicationRound, 80),
    },
    hasScholarship: Boolean(row.hasScholarship),
    source: projectSource(row.sourceStatus, row.sourceLabel, row.lastVerifiedAt),
    navigation: { routeId: "catalog.program_detail", entityRef: outputUuid(row.id) },
  };
}

function projectSchool(row: PublicSchoolDto) {
  return {
    id: outputUuid(row.id),
    name: outputText(row.nameEn, 160, true),
    nameZh: outputText(row.nameZh, 160),
    schoolType: outputText(row.schoolType, 80),
    region: outputText(row.region, 96),
    city: outputText(row.cityZh ?? row.city, 96),
    languageOfInstruction: outputText(row.languageOfInstruction, 96),
    deadlineSummary: outputText(row.deadlineSummary, 200),
    tuitionSummary: outputText(row.tuitionSummary, 200),
    counts: {
      programs: outputCount(row.programCount),
      englishPrograms: outputCount(row.englishProgramCount),
      scholarships: outputCount(row.scholarshipCount),
    },
    source: projectSource(row.sourceStatus, row.sourceLabel, row.lastVerifiedAt),
    navigation: { routeId: "catalog.school_detail", entityRef: outputUuid(row.id) },
  };
}

function projectScholarship(row: PublicScholarshipDto) {
  return {
    id: outputUuid(row.id),
    title: outputText(row.title, 180, true),
    type: outputText(row.typeLabel ?? row.type, 80),
    fundingLevel: outputText(row.fundingLevel, 80),
    provider: outputText(row.providerNameEn ?? row.providerName, 160),
    coverage: outputText(row.coverage, 240),
    amount: outputText(row.amountText, 160),
    summary: outputText(row.summary, 320),
    deadline: {
      date: outputDate(row.deadlineDate),
      label: outputText(row.deadlineLabel, 120),
      round: outputText(row.applicationRound, 80),
    },
    related: { schoolId: outputOptionalUuid(row.schoolId), programId: outputOptionalUuid(row.programId) },
    source: projectSource(row.sourceStatus, row.sourceLabel, row.lastVerifiedAt),
    navigation: { routeId: "catalog.scholarship_detail", entityRef: outputUuid(row.id) },
  };
}

function projectCity(row: PublicCityDto) {
  const slug = outputCitySlug(row.slug);
  return {
    slug,
    name: outputText(row.nameEn, 120, true),
    nameZh: outputText(row.nameZh, 120),
    region: outputText(row.region, 96),
    province: outputText(row.province, 96),
    monthlyCost: outputText(row.monthlyCost, 120),
    monthlyCostRmb: outputNumber(row.monthlyCostRmb),
    costLevel: outputText(row.costLevel, 40),
    references: {
      schools: outputCount(row.references.schoolCount),
      programs: outputCount(row.references.programCount),
      englishPrograms: outputCount(row.references.englishProgramCount),
      scholarships: outputCount(row.references.scholarshipCount),
    },
    navigation: { routeId: "catalog.city_detail", entityRef: slug },
  };
}

function projectIntake(row: PublicProgramIntakeDto) {
  return {
    id: outputUuid(row.id),
    programId: outputUuid(row.programId),
    term: outputText(row.intakeTerm, 64, true),
    year: outputInteger(row.intakeYear, 2000, 2200),
    openDate: outputDate(row.openDate),
    deadlineDate: outputDate(row.deadlineDate),
    deadlineLabel: outputText(row.deadlineLabel, 120),
    round: outputText(row.applicationRound, 80),
    status: row.status === "open" ? "open" : failProjection(),
  };
}

function projectSource(status: string, label: string | null, lastVerifiedAt: Date | null) {
  if (!["verified", "unverified", "stale", "unknown"].includes(status)) failProjection();
  return { status, label: outputText(label, 160), lastVerifiedAt: outputDate(lastVerifiedAt) };
}

function buildResult(
  execution: ParsedExecution,
  persona: PublicAgentPersona,
  definition: AgentToolDefinition,
  inputHash: string,
  rateLimit: AgentToolRateLimitDecision,
  data: unknown,
): PublicAgentToolResult {
  return {
    schemaVersion: "cuac.agent-tool-result.v1",
    conversationId: execution.conversationId,
    toolCallId: execution.toolCallId,
    toolKey: definition.toolKey,
    persona,
    projectionType: definition.projectionType as "public_catalog" | "navigation_intent",
    dataClassesReturned: ["public_catalog"],
    inputHash,
    rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt.toISOString() },
    contentBoundary: {
      trust: "untrusted_public_catalog_data",
      instructionAuthority: "none",
      toolAuthority: "none",
    },
    data,
  };
}

function assertSafeToolOutput(definition: AgentToolDefinition, value: unknown): void {
  const prohibited = new Set(definition.prohibitedFields.map((field) => field.toLowerCase()));
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) return entry.forEach(visit);
    if (!entry || typeof entry !== "object") return;
    for (const [key, nested] of Object.entries(entry)) {
      if (prohibited.has(key.toLowerCase()) || /password|sessiontoken|cardnumber|cvv|secret|databaseurl|connectionstring/i.test(key)) {
        throw serviceUnavailable("Agent tool output failed its projection boundary.");
      }
      visit(nested);
    }
  };
  visit(value);
}

function outputText(value: unknown, maxLength: number, required = false): string | null {
  if (value === null || value === undefined || value === "") {
    if (required) failProjection();
    return null;
  }
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) failProjection();
  const text = value.trim();
  if (!text && required) failProjection();
  return text.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_PAN]");
}

function outputUuid(value: unknown): string {
  if (!isUuid(value)) failProjection();
  return value.toLowerCase();
}

function outputOptionalUuid(value: unknown): string | null {
  return value === null || value === undefined ? null : outputUuid(value);
}

function outputDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) failProjection();
  return value.toISOString();
}

function outputNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) failProjection();
  return value;
}

function outputCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return outputInteger(value, 0, 2_147_483_647);
}

function outputInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) failProjection();
  return value;
}

function parseCitySlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 96) {
    throw badRequest("entityRef must be a registered city slug.");
  }
  return value;
}

function outputCitySlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 96) {
    failProjection();
  }
  return value;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

function failProjection(): never {
  throw serviceUnavailable("Agent catalog projection is unavailable.");
}

function hashValue(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

function errorStatus(error: CuacError): string {
  if (error.status === 429) return "rate_limited";
  if (error.status === 404) return "not_found";
  if (error.status === 400 || error.status === 403) return "denied";
  return "failed";
}

function resultItemCount(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items.length;
  if (Array.isArray(record.intakes)) return record.intakes.length + 1;
  return 1;
}

export function publicAgentToolDataClasses(): readonly DataClass[] {
  return ["public_catalog"];
}
