import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { DataClass, RequestContext } from "../shared/request-context.ts";

export const SCHOOL_CATALOG_CORRECTION_FIELDS = [
  "websiteUrl", "admissionsUrl", "applicationLevel", "languageOfInstruction",
  "deadlineSummary", "tuitionSummary", "applicationFee",
] as const;
export const SCHOOL_CATALOG_CORRECTION_REASONS = [
  "official_website_changed", "admissions_route_changed", "fee_information_changed",
  "language_information_changed", "outdated_public_information",
] as const;
export const SCHOOL_CATALOG_CORRECTION_RESOLUTIONS = [
  "applied_unverified", "rejected_duplicate", "rejected_unverifiable", "rejected_out_of_scope",
] as const;
export const SCHOOL_CATALOG_CORRECTION_STATUSES = ["submitted", "claimed", "applied", "rejected"] as const;

export type SchoolCatalogCorrectionField = (typeof SCHOOL_CATALOG_CORRECTION_FIELDS)[number];
export type SchoolCatalogCorrectionReason = (typeof SCHOOL_CATALOG_CORRECTION_REASONS)[number];
export type SchoolCatalogCorrectionResolution = (typeof SCHOOL_CATALOG_CORRECTION_RESOLUTIONS)[number];
export type SchoolCatalogCorrectionStatus = (typeof SCHOOL_CATALOG_CORRECTION_STATUSES)[number];
export type SchoolCatalogChangeSet = Partial<Record<SchoolCatalogCorrectionField, string | null>>;
export type SchoolCatalogCorrectionRole = "cuac_ops" | "cuac_admin";

export type SchoolCatalogSnapshot = {
  id: string; nameZh: string | null; nameEn: string; updatedAt: string;
  verificationStatus: string; websiteUrl: string | null; admissionsUrl: string | null;
  applicationLevel: string | null; languageOfInstruction: string | null;
  deadlineSummary: string | null; tuitionSummary: string | null; applicationFee: string | null;
};

export type SchoolCatalogCorrection = {
  id: string; schoolId: string; schoolNameZh: string | null; schoolNameEn: string;
  sourceSchoolUpdatedAt: Date; changes: SchoolCatalogChangeSet; evidenceUrl: string;
  reasonCode: SchoolCatalogCorrectionReason; revision: number; status: SchoolCatalogCorrectionStatus;
  requestedMembershipRole: "admissions" | "counselor" | "school_admin";
  claimedByUserId: string | null; claimedByRole: SchoolCatalogCorrectionRole | null; claimedAt: Date | null;
  resolvedByUserId: string | null; resolutionCode: SchoolCatalogCorrectionResolution | null;
  resolutionReference: string | null; resolvedAt: Date | null; resultSchoolUpdatedAt: Date | null;
  createdAt: Date; updatedAt: Date;
};

type SchoolActor = { actorUserId: string; schoolId: string };
type OpsActor = { actorUserId: string; activeRole: SchoolCatalogCorrectionRole };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };

export type SchoolCatalogCorrectionRepository = {
  listForSchool(input: SchoolActor): Promise<Authorized<{ school: SchoolCatalogSnapshot; items: SchoolCatalogCorrection[] }>>;
  submit(input: SchoolActor & { sourceSchoolUpdatedAt: string; changes: SchoolCatalogChangeSet;
    evidenceUrl: string; reasonCode: SchoolCatalogCorrectionReason }): Promise<Authorized<SchoolCatalogCorrection | null>>;
  listForOps(input: OpsActor & { status: SchoolCatalogCorrectionStatus | null; limit: number }): Promise<Authorized<SchoolCatalogCorrection[]>>;
  claim(input: OpsActor & { correctionId: string; expectedRevision: number }): Promise<Authorized<SchoolCatalogCorrection | null>>;
  resolve(input: OpsActor & { correctionId: string; expectedRevision: number;
    code: SchoolCatalogCorrectionResolution; reference: string }): Promise<Authorized<SchoolCatalogCorrection | null>>;
};

export class SchoolCatalogCorrectionService {
  private readonly repository: SchoolCatalogCorrectionRepository;
  private readonly auditSink: AuditSink;

  constructor(repository: SchoolCatalogCorrectionRepository, auditSink: AuditSink) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async listForSchool(context: RequestContext) {
    const actor = requireSchoolContext(context);
    const decisionId = authorize(context, "school.read_catalog_correction", actor.schoolId, schoolDataClasses);
    const result = await this.repository.listForSchool(actor);
    requireAuthority(result);
    const value = { school: validateSchool(result.value.school), items: result.value.items.map(validateCorrectionForSchool) };
    await audit(this.auditSink, context, decisionId, "school.catalog_correction.list", actor.schoolId, {
      itemCount: value.items.length, schoolGeneration: value.school.updatedAt,
    }, schoolDataClasses);
    return value;
  }

  async submit(context: RequestContext, input: unknown) {
    const actor = requireSchoolContext(context);
    const decisionId = authorize(context, "school.submit_catalog_correction", actor.schoolId, schoolDataClasses);
    const fields = inputRecord(input, ["sourceSchoolUpdatedAt", "changes", "evidenceUrl", "reasonCode"]);
    const sourceSchoolUpdatedAt = canonicalGeneration(fields.sourceSchoolUpdatedAt);
    const changes = parseChanges(fields.changes);
    const evidenceUrl = httpsUrl(fields.evidenceUrl, "Correction evidence URL");
    const reasonCode = inputEnum(fields.reasonCode, "Correction reason", SCHOOL_CATALOG_CORRECTION_REASONS);
    const result = await this.repository.submit({ ...actor, sourceSchoolUpdatedAt, changes, evidenceUrl, reasonCode });
    const correction = requireCorrectionResult(result);
    await audit(this.auditSink, context, decisionId, "school.catalog_correction.submit", correction.id, {
      schoolId: actor.schoolId, fieldNames: Object.keys(changes), reasonCode, revision: correction.revision,
    }, schoolDataClasses);
    return validateCorrectionForSchool(correction);
  }

  async listForOps(context: RequestContext, input: unknown = {}) {
    const actor = requireOpsContext(context);
    const decisionId = authorize(context, "ops.read_catalog_correction", null, opsDataClasses);
    const fields = inputRecord(input, ["status", "limit"]);
    const status = fields.status === undefined ? null
      : inputEnum(fields.status, "Correction status", SCHOOL_CATALOG_CORRECTION_STATUSES);
    const limit = fields.limit === undefined ? 50 : inputInteger(fields.limit, "Correction limit", 1, 100);
    const result = await this.repository.listForOps({ ...actor, status, limit });
    requireAuthority(result);
    const items = result.value.map(validateCorrection);
    await audit(this.auditSink, context, decisionId, "ops.catalog_correction.list", null,
      { itemCount: items.length, status }, opsDataClasses);
    return { items };
  }

  async claim(context: RequestContext, correctionIdInput: unknown, input: unknown) {
    const actor = requireOpsContext(context);
    const decisionId = authorize(context, "ops.claim_catalog_correction", null, opsDataClasses);
    const correctionId = inputUuid(correctionIdInput, "Correction id");
    const fields = inputRecord(input, ["expectedRevision"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected correction revision", 1, 1);
    const correction = requireCorrectionResult(await this.repository.claim({ ...actor, correctionId, expectedRevision }));
    await audit(this.auditSink, context, decisionId, "ops.catalog_correction.claim", correction.id,
      { schoolId: correction.schoolId, revision: correction.revision, status: correction.status }, opsDataClasses);
    return validateCorrection(correction);
  }

  async resolve(context: RequestContext, correctionIdInput: unknown, input: unknown) {
    const actor = requireOpsContext(context);
    const decisionId = authorize(context, "ops.resolve_catalog_correction", null, opsDataClasses);
    const correctionId = inputUuid(correctionIdInput, "Correction id");
    const fields = inputRecord(input, ["expectedRevision", "code", "reference"]);
    const expectedRevision = inputInteger(fields.expectedRevision, "Expected correction revision", 2, 2);
    const code = inputEnum(fields.code, "Correction resolution", SCHOOL_CATALOG_CORRECTION_RESOLUTIONS);
    const reference = boundedReference(fields.reference);
    const correction = requireCorrectionResult(await this.repository.resolve({ ...actor, correctionId, expectedRevision, code, reference }));
    await audit(this.auditSink, context, decisionId, "ops.catalog_correction.resolve", correction.id, {
      schoolId: correction.schoolId, fieldNames: Object.keys(correction.changes), code,
      revision: correction.revision, status: correction.status,
    }, opsDataClasses);
    return validateCorrection(correction);
  }
}

const schoolDataClasses = ["public_catalog", "tenant_confidential"] as const;
const opsDataClasses = ["public_catalog", "internal_catalog_metadata", "ops_confidential", "audit_security"] as const;

function requireSchoolContext(context: RequestContext): SchoolActor {
  if (!context.actorUserId || context.activeRole !== "school_staff" || context.selectedSurface !== "school"
    || context.purpose !== "school_catalog_correction" || !context.tenantSchoolId
    || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated school catalog correction context is required.");
  }
  return { actorUserId: context.actorUserId, schoolId: context.tenantSchoolId };
}

function requireOpsContext(context: RequestContext): OpsActor {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")
    || context.selectedSurface !== "ops" || context.purpose !== "catalog_correction_review"
    || context.tenantSchoolId !== null || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated catalog correction review context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function authorize(context: RequestContext, action: PolicyAction, tenantSchoolId: string | null,
  dataClasses: readonly DataClass[]): string {
  const decision = evaluatePolicy(context, action, { type: "school_catalog_correction", tenantSchoolId, dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason);
  return decision.id;
}

function parseChanges(value: unknown): SchoolCatalogChangeSet {
  const fields = inputRecord(value, SCHOOL_CATALOG_CORRECTION_FIELDS);
  if (Object.keys(fields).length === 0) throw badRequest("At least one supported school catalog field must be changed.");
  const changes: SchoolCatalogChangeSet = {};
  for (const key of SCHOOL_CATALOG_CORRECTION_FIELDS) {
    if (!Object.hasOwn(fields, key)) continue;
    const field = fields[key];
    if (field === null) { changes[key] = null; continue; }
    const max = key === "websiteUrl" || key === "admissionsUrl" ? 2048
      : key === "deadlineSummary" || key === "tuitionSummary" ? 500 : 200;
    changes[key] = key === "websiteUrl" || key === "admissionsUrl"
      ? httpsUrl(field, key) : inputText(field, key, max);
  }
  return changes;
}

function httpsUrl(value: unknown, field: string): string {
  const text = inputText(value, field, 2048);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw badRequest(`${field} must be a canonical HTTPS URL without credentials.`); }
}

function canonicalGeneration(value: unknown): string {
  const text = inputText(value, "School catalog generation", 27);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(text)
    || !Number.isFinite(new Date(text).valueOf())) {
    throw badRequest("School catalog generation must be a canonical UTC timestamp with database precision.");
  }
  return text;
}

function boundedReference(value: unknown): string {
  const reference = inputText(value, "Correction resolution reference", 128);
  if (!/^[A-Za-z0-9._:-]+$/.test(reference)) throw badRequest("Correction resolution reference has an invalid format.");
  return reference;
}

function requireAuthority<T>(result: Authorized<T>): asserts result is { authorized: true; value: T } {
  if (!result.authorized) throw forbidden("Active live authority is required for this correction workflow.");
}

function requireCorrectionResult(result: Authorized<SchoolCatalogCorrection | null>): SchoolCatalogCorrection {
  requireAuthority(result);
  if (!result.value) throw new CuacError("CONFLICT", "School catalog correction state changed; reload before retrying.", 409);
  return validateCorrection(result.value);
}

function validateSchool(value: SchoolCatalogSnapshot): SchoolCatalogSnapshot {
  if (!uuid(value.id) || !text(value.nameEn, 200) || !nullableText(value.nameZh, 200)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.updatedAt)
    || !text(value.verificationStatus, 40) || !nullableText(value.websiteUrl, 2048)
    || !nullableText(value.admissionsUrl, 2048) || !nullableText(value.applicationLevel, 200)
    || !nullableText(value.languageOfInstruction, 200) || !nullableText(value.deadlineSummary, 500)
    || !nullableText(value.tuitionSummary, 500) || !nullableText(value.applicationFee, 200)) throw unavailable();
  return value;
}

function validateCorrectionForSchool(value: SchoolCatalogCorrection) {
  const row = validateCorrection(value);
  return {
    id: row.id, schoolId: row.schoolId, schoolNameZh: row.schoolNameZh, schoolNameEn: row.schoolNameEn,
    sourceSchoolUpdatedAt: row.sourceSchoolUpdatedAt, changes: row.changes, evidenceUrl: row.evidenceUrl,
    reasonCode: row.reasonCode, revision: row.revision, status: row.status,
    requestedMembershipRole: row.requestedMembershipRole, claimedAt: row.claimedAt,
    resolutionCode: row.resolutionCode, resolutionReference: row.resolutionReference,
    resolvedAt: row.resolvedAt, resultSchoolUpdatedAt: row.resultSchoolUpdatedAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function validateCorrection(value: SchoolCatalogCorrection): SchoolCatalogCorrection {
  const changes = storedChanges(value.changes);
  if (!uuid(value.id) || !uuid(value.schoolId) || !text(value.schoolNameEn, 200)
    || !nullableText(value.schoolNameZh, 200) || !date(value.sourceSchoolUpdatedAt)
    || !safeHttps(value.evidenceUrl) || !SCHOOL_CATALOG_CORRECTION_REASONS.includes(value.reasonCode)
    || !Number.isSafeInteger(value.revision) || !SCHOOL_CATALOG_CORRECTION_STATUSES.includes(value.status)
    || !["admissions", "counselor", "school_admin"].includes(value.requestedMembershipRole)
    || !date(value.createdAt) || !date(value.updatedAt) || value.createdAt < value.sourceSchoolUpdatedAt
    || !validLifecycle(value)) throw unavailable();
  return { ...value, changes };
}

function storedChanges(value: unknown): SchoolCatalogChangeSet {
  try { return parseChanges(value); } catch { throw unavailable(); }
}

function validLifecycle(value: SchoolCatalogCorrection): boolean {
  const claimed = uuid(value.claimedByUserId ?? "") && ["cuac_ops", "cuac_admin"].includes(value.claimedByRole ?? "") && date(value.claimedAt);
  const unclaimed = value.claimedByUserId === null && value.claimedByRole === null && value.claimedAt === null;
  const resolved = uuid(value.resolvedByUserId ?? "") && value.resolvedByUserId !== value.claimedByUserId
    && SCHOOL_CATALOG_CORRECTION_RESOLUTIONS.includes(value.resolutionCode as SchoolCatalogCorrectionResolution)
    && typeof value.resolutionReference === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value.resolutionReference)
    && date(value.resolvedAt) && date(value.resultSchoolUpdatedAt);
  const unresolved = value.resolvedByUserId === null && value.resolutionCode === null
    && value.resolutionReference === null && value.resolvedAt === null && value.resultSchoolUpdatedAt === null;
  if (value.status === "submitted") return value.revision === 1 && unclaimed && unresolved;
  if (value.status === "claimed") return value.revision === 2 && Boolean(claimed) && unresolved;
  if (value.revision !== 3 || !claimed || !resolved || value.resolvedAt! < value.claimedAt!) return false;
  if (value.status === "applied") return value.resolutionCode === "applied_unverified"
    && value.resultSchoolUpdatedAt!.getTime() === value.resolvedAt!.getTime()
    && value.resultSchoolUpdatedAt! > value.sourceSchoolUpdatedAt;
  return value.resolutionCode !== "applied_unverified"
    && value.resultSchoolUpdatedAt!.getTime() === value.sourceSchoolUpdatedAt.getTime();
}

async function audit(sink: AuditSink, context: RequestContext, decisionId: string, action: string,
  resourceId: string | null, metadata: Record<string, unknown>, dataClasses: readonly DataClass[]) {
  await sink.record(buildAuditEvent(context, {
    action, resourceType: "school_catalog_correction", resourceId, allowed: true,
    policyDecisionId: decisionId, dataClasses, metadata,
  }));
}

function uuid(value: string): boolean { return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value); }
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.length > 0 && value.length <= max; }
function nullableText(value: unknown, max: number): value is string | null { return value === null || text(value, max); }
function date(value: unknown): value is Date { return value instanceof Date && Number.isFinite(value.getTime()); }
function safeHttps(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
}
function unavailable() { return serviceUnavailable("School catalog correction data is unavailable."); }
