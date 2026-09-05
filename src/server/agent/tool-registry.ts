import { badRequest, forbidden } from "../shared/errors.ts";
import type { CuacRole, CuacSurface, DataClass, RequestContext } from "../shared/request-context.ts";

export type AgentProjectionType =
  | "public_catalog"
  | "navigation_intent"
  | "student_preference"
  | "student_application_summary"
  | "student_billing_status"
  | "school_applicant_projection"
  | "school_queue_summary"
  | "ops_governed_summary"
  | "ops_agent_audit_summary";

export type AgentToolRiskLevel = "low" | "medium" | "high" | "prohibited";

export type AgentToolRateLimit = {
  maxCalls: number;
  windowSeconds: number;
};

export type AgentToolDefinition = {
  toolKey: string;
  description: string;
  ownerService: string;
  allowedRoles: readonly CuacRole[];
  allowedSurfaces: readonly CuacSurface[];
  requiredScope: string;
  inputSchemaId: string;
  outputSchemaId: string;
  requiredDataClasses: readonly DataClass[];
  dataClassesReturned: readonly DataClass[];
  projectionType: AgentProjectionType;
  tenantRequired: boolean;
  memoryWriteAllowed: boolean;
  vectorIndexAllowed: boolean;
  riskLevel: AgentToolRiskLevel;
  confirmationRequired: boolean;
  idempotent: boolean;
  mutatesState: boolean;
  rateLimit: AgentToolRateLimit;
  auditLevel: "none" | "metadata" | "full";
  prohibitedFields: readonly string[];
};

export type AgentToolInvocation = {
  toolKey: string;
  args: Record<string, unknown>;
};

const PROHIBITED_TOOL_KEYS = new Set([
  "database.run_sql",
  "database.export_table",
  "payment.read_card_number",
  "payment.read_cvv",
  "payment.charge_raw_card",
  "secrets.get",
  "env.read",
  "browser.open_arbitrary_url",
  "school.read_other_tenant",
  "student.read_any_profile",
  "audit.delete",
  "agent.define_metric_from_prompt",
  "agent.decide_admission",
  "agent.override_payment_state",
  "agent.override_application_state",
]);

const MODEL_AUTHORITY_ARG_KEYS = new Set([
  "sql", "table", "tables", "field", "fields", "fieldList", "columns", "where",
  "userId", "tenantId", "schoolId", "url", "href", "path", "databaseUrl", "connectionString",
]);

const PUBLIC_PROHIBITED_FIELDS = Object.freeze([
  "password",
  "sessionToken",
  "paymentCredential",
  "cardNumber",
  "cvv",
  "tenantSchoolId",
  "studentProfile",
  "opsNotes",
  "sourceFieldLineage",
  "applicationUrl",
  "sourceUrl",
]);

export const PUBLIC_AGENT_TOOL_DEFINITIONS = Object.freeze([
  publicCatalogTool("catalog.search_programs", "Search the published program catalog.", "cuac.agent.catalog-search.v1"),
  publicCatalogTool("catalog.get_program_detail", "Read one published program and its open intakes.", "cuac.agent.program-detail.v1"),
  publicCatalogTool("catalog.search_schools", "Search the published school catalog.", "cuac.agent.catalog-search.v1"),
  publicCatalogTool("catalog.search_scholarships", "Search the published scholarship catalog.", "cuac.agent.catalog-search.v1"),
  publicCatalogTool("catalog.search_cities", "Search the published city catalog.", "cuac.agent.catalog-search.v1"),
  {
    toolKey: "navigation.open_route",
    description: "Resolve a registered public CUAC route into a semantic navigation intent.",
    ownerService: "navigation",
    allowedRoles: ["guest", "student"],
    allowedSurfaces: ["public", "student"],
    requiredScope: "current_surface",
    inputSchemaId: "cuac.agent.navigation-open-route-input.v1",
    outputSchemaId: "cuac.agent.navigation-intent.v1",
    requiredDataClasses: ["public_catalog"],
    dataClassesReturned: ["public_catalog"],
    projectionType: "navigation_intent",
    tenantRequired: false,
    memoryWriteAllowed: false,
    vectorIndexAllowed: false,
    riskLevel: "low",
    confirmationRequired: false,
    idempotent: true,
    mutatesState: false,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
    auditLevel: "metadata",
    prohibitedFields: [...PUBLIC_PROHIBITED_FIELDS, "url", "href", "path"],
  },
] satisfies readonly AgentToolDefinition[]);

const PUBLIC_AGENT_TOOL_REGISTRY = new Map(PUBLIC_AGENT_TOOL_DEFINITIONS.map((definition) => [definition.toolKey, definition]));

export function getPublicAgentToolDefinition(toolKey: string): AgentToolDefinition | undefined {
  return PUBLIC_AGENT_TOOL_REGISTRY.get(toolKey);
}

export function validateAgentToolInvocation(
  context: RequestContext,
  definition: AgentToolDefinition | undefined,
  invocation: AgentToolInvocation,
): void {
  if (typeof invocation.toolKey !== "string" || !/^[a-z][a-z0-9_.]{2,95}$/.test(invocation.toolKey)) {
    throw badRequest("Agent tool key is invalid.");
  }

  if (!invocation.args || typeof invocation.args !== "object" || Array.isArray(invocation.args)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(invocation.args))) {
    throw badRequest("Agent tool arguments must be an object.");
  }

  if (PROHIBITED_TOOL_KEYS.has(invocation.toolKey)) {
    throw forbidden(`Agent tool is prohibited: ${invocation.toolKey}`);
  }

  if (!definition || definition.toolKey !== invocation.toolKey) {
    throw badRequest(`Agent tool is not registered: ${invocation.toolKey}`);
  }

  if (context.purpose !== "agent_tool") {
    throw forbidden("Agent tool purpose is required.");
  }

  if (!definition.allowedRoles.includes(context.activeRole)) {
    throw forbidden("Agent persona role is not allowed for this tool.");
  }

  if (!definition.allowedSurfaces.includes(context.selectedSurface)) {
    throw forbidden("Selected surface is not allowed for this tool.");
  }

  if (definition.tenantRequired && !context.tenantSchoolId) {
    throw forbidden("Tenant-scoped Agent tool requires a resolved tenant.");
  }

  const deniedDataClass = definition.requiredDataClasses.find((dataClass) => !context.dataClassAllowlist.includes(dataClass));
  if (deniedDataClass) {
    throw forbidden(`Agent data class is not allowed: ${deniedDataClass}`);
  }

  const modelAuthorityArg = Object.keys(invocation.args).find((key) => MODEL_AUTHORITY_ARG_KEYS.has(key));
  if (modelAuthorityArg) {
    throw badRequest(`Agent tool argument cannot be authoritative: ${modelAuthorityArg}`);
  }
}

function publicCatalogTool(toolKey: string, description: string, outputSchemaId: string): AgentToolDefinition {
  return {
    toolKey,
    description,
    ownerService: "catalog",
    allowedRoles: ["guest", "student"],
    allowedSurfaces: ["public", "student"],
    requiredScope: "public_catalog",
    inputSchemaId: toolKey === "catalog.get_program_detail"
      ? "cuac.agent.catalog-entity-input.v1"
      : "cuac.agent.catalog-search-input.v1",
    outputSchemaId,
    requiredDataClasses: ["public_catalog"],
    dataClassesReturned: ["public_catalog"],
    projectionType: "public_catalog",
    tenantRequired: false,
    memoryWriteAllowed: false,
    vectorIndexAllowed: true,
    riskLevel: "low",
    confirmationRequired: false,
    idempotent: true,
    mutatesState: false,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
    auditLevel: "metadata",
    prohibitedFields: PUBLIC_PROHIBITED_FIELDS,
  };
}
