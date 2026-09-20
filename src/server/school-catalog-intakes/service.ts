import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, CuacError, forbidden } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const SCHOOL_INTAKE_TERMS = ["spring", "summer", "fall", "winter"] as const;
export const SCHOOL_INTAKE_EVIDENCE_TYPES = ["official_url", "school_attestation"] as const;
export type SchoolIntakeTerm = (typeof SCHOOL_INTAKE_TERMS)[number];
export type SchoolIntakeEvidenceType = (typeof SCHOOL_INTAKE_EVIDENCE_TYPES)[number];

export type SchoolProgramIntakeVersion = {
  id: string; schoolId: string; programId: string; programNameEn: string; programNameZh: string | null;
  intakeTerm: SchoolIntakeTerm; intakeYear: number; version: number;
  openDate: Date | null; deadlineDate: Date | null; deadlineLabel: string | null; applicationRound: string | null;
  evidenceType: SchoolIntakeEvidenceType; sourceUrl: string | null; sourceLabel: string | null; changeNote: string | null;
  status: "draft" | "published" | "superseded" | "withdrawn";
  publicationRevision: number | null; publicationStatus: "active" | "withdrawn" | null;
  createdByUserId: string; createdAt: Date; updatedAt: Date;
};
export type SchoolProgramSummary = { id: string; nameEn: string; nameZh: string | null; degreeLevel: string };

type Actor = { actorUserId: string; schoolId: string };
export type SaveSchoolIntakeDraft = {
  programId: string; intakeTerm: SchoolIntakeTerm; intakeYear: number;
  openDate: Date | null; deadlineDate: Date | null; deadlineLabel: string | null; applicationRound: string | null;
  evidenceType: SchoolIntakeEvidenceType; sourceUrl: string | null; sourceLabel: string | null; changeNote: string | null;
};

export type SchoolCatalogIntakeRepository = {
  list(input: Actor): Promise<{ programs: SchoolProgramSummary[]; items: SchoolProgramIntakeVersion[] }>;
  saveDraft(input: Actor & SaveSchoolIntakeDraft): Promise<SchoolProgramIntakeVersion | null>;
  publish(input: Actor & { versionId: string }): Promise<SchoolProgramIntakeVersion | null>;
  withdraw(input: Actor & { versionId: string }): Promise<SchoolProgramIntakeVersion | null>;
};

const dataClasses = ["public_catalog"] as const;

export class SchoolCatalogIntakeService {
  private readonly repository: SchoolCatalogIntakeRepository;
  private readonly auditSink: AuditSink;
  constructor(repository: SchoolCatalogIntakeRepository, auditSink: AuditSink) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async list(context: RequestContext) {
    const actor = requireActor(context, false), decisionId = authorize(context, "school.read_catalog_intake", actor.schoolId);
    const result = await this.repository.list(actor);
    await audit(this.auditSink, context, decisionId, "school.catalog_intake.list", actor.schoolId,
      { itemCount: result.items.length, programCount: result.programs.length });
    return result;
  }

  async saveDraft(context: RequestContext, value: unknown) {
    const actor = requireActor(context, false), decisionId = authorize(context, "school.prepare_catalog_intake", actor.schoolId);
    const input = parseDraft(value), item = await this.repository.saveDraft({ ...actor, ...input });
    if (!item) throw new CuacError("CONFLICT", "The program or intake draft changed; reload before retrying.", 409);
    await audit(this.auditSink, context, decisionId, "school.catalog_intake.draft_saved", item.id,
      { schoolId: actor.schoolId, programId: item.programId, intakeTerm: item.intakeTerm, intakeYear: item.intakeYear, version: item.version });
    return item;
  }

  async publish(context: RequestContext, versionIdValue: unknown) {
    const actor = requireActor(context, true), decisionId = authorize(context, "school.publish_catalog_intake", actor.schoolId);
    const versionId = inputUuid(versionIdValue, "Intake version id"), item = await this.repository.publish({ ...actor, versionId });
    if (!item) throw new CuacError("CONFLICT", "Only the current draft for this school's program can be published.", 409);
    await audit(this.auditSink, context, decisionId, "school.catalog_intake.published", item.id,
      { schoolId: actor.schoolId, programId: item.programId, intakeTerm: item.intakeTerm, intakeYear: item.intakeYear,
        version: item.version, publicationRevision: item.publicationRevision });
    return item;
  }

  async withdraw(context: RequestContext, versionIdValue: unknown) {
    const actor = requireActor(context, true), decisionId = authorize(context, "school.withdraw_catalog_intake", actor.schoolId);
    const versionId = inputUuid(versionIdValue, "Intake version id"), item = await this.repository.withdraw({ ...actor, versionId });
    if (!item) throw new CuacError("CONFLICT", "Only this school's currently published intake can be withdrawn.", 409);
    await audit(this.auditSink, context, decisionId, "school.catalog_intake.withdrawn", item.id,
      { schoolId: actor.schoolId, programId: item.programId, intakeTerm: item.intakeTerm, intakeYear: item.intakeYear,
        version: item.version, publicationRevision: item.publicationRevision });
    return item;
  }
}

function requireActor(context: RequestContext, stepUp: boolean): Actor {
  if (!context.actorUserId || context.activeRole !== "school_staff" || context.selectedSurface !== "school"
    || context.purpose !== "school_catalog_intake" || !context.tenantSchoolId
    || (stepUp ? context.authStrength !== "step_up" : !["session", "step_up"].includes(context.authStrength))) {
    throw forbidden(stepUp ? "Step-up school catalog publishing authority is required." : "Authenticated school catalog authority is required.");
  }
  return { actorUserId: context.actorUserId, schoolId: context.tenantSchoolId };
}

function authorize(context: RequestContext, action: PolicyAction, schoolId: string) {
  const decision = evaluatePolicy(context, action, { type: "school_catalog_intake", tenantSchoolId: schoolId, dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason);
  return decision.id;
}

function parseDraft(value: unknown): SaveSchoolIntakeDraft {
  const fields = inputRecord(value, ["programId", "intakeTerm", "intakeYear", "openDate", "deadlineDate",
    "deadlineLabel", "applicationRound", "evidenceType", "sourceUrl", "sourceLabel", "changeNote"]);
  const openDate = optionalDate(fields.openDate, "Open date"), deadlineDate = optionalDate(fields.deadlineDate, "Deadline date");
  if (openDate && deadlineDate && openDate >= deadlineDate) throw badRequest("Open date must be before the deadline.");
  const evidenceType = inputEnum(fields.evidenceType, "Evidence type", SCHOOL_INTAKE_EVIDENCE_TYPES);
  const sourceUrl = optionalText(fields.sourceUrl, "Official source URL", 2048);
  const sourceLabel = optionalText(fields.sourceLabel, "Source label", 256);
  const changeNote = optionalText(fields.changeNote, "Change note", 1000);
  if (evidenceType === "official_url") {
    if (!sourceUrl) throw badRequest("An official HTTPS source URL is required.");
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) throw new Error();
    } catch { throw badRequest("Official source URL must be an HTTPS URL without credentials."); }
  } else if (sourceUrl || !sourceLabel || !changeNote) {
    throw badRequest("School attestation requires a source label and change note instead of a public URL.");
  }
  return {
    programId: inputUuid(fields.programId, "Program id"),
    intakeTerm: inputEnum(fields.intakeTerm, "Intake term", SCHOOL_INTAKE_TERMS),
    intakeYear: inputInteger(fields.intakeYear, "Intake year", 2000, 2200),
    openDate, deadlineDate,
    deadlineLabel: optionalText(fields.deadlineLabel, "Deadline label", 256),
    applicationRound: optionalText(fields.applicationRound, "Application round", 256),
    evidenceType, sourceUrl, sourceLabel, changeNote,
  };
}

function optionalText(value: unknown, field: string, max: number) {
  return value === undefined || value === null || value === "" ? null : inputText(value, field, max);
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw badRequest(`${field} must be an ISO UTC timestamp.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== (value.length === 20 ? value.replace("Z", ".000Z") : value)) {
    throw badRequest(`${field} must be a valid canonical timestamp.`);
  }
  return date;
}

async function audit(sink: AuditSink, context: RequestContext, decisionId: string, action: string,
  resourceId: string, metadata: Record<string, unknown>) {
  await sink.record(buildAuditEvent(context, { action, resourceType: "school_program_intake", resourceId,
    allowed: true, policyDecisionId: decisionId, dataClasses, metadata }));
}
