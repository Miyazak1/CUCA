import { createHash } from "node:crypto";
import { parseRequirementDocument, requirementDigest, type RequirementDocument } from "../../src/server/catalog/requirements.ts";

type SqlClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> };

export type RequirementCandidateOperation = {
  operationKey: string;
  templateKey: string;
  schoolSlug: string;
  programSlug: string;
  intakeTerm: string;
  intakeYear: number;
  cycleState: "historical_2026" | "current_2027";
  targetBindingStatus: "verified";
  reviewStatus: "unreviewed";
  versionIdentity: string;
  documentSha256: string;
};

export type RequirementCandidateTemplate = {
  templateKey: string;
  documentSha256: string;
  document: RequirementDocument;
};

export type RequirementReleaseCandidate = {
  version: 2;
  generatedAt: string;
  status: "unreviewed_non_public_requirement_candidate";
  authorization: {
    candidatePreparationAuthorized: true;
    executionAuthorized: false;
    persistentDatabaseWriteAuthorized: false;
    publicationAuthorized: false;
  };
  decision: { humanReviewCompleted: false };
  summary: {
    templateCount: number;
    operationCount: number;
    schoolCount: number;
    programCount: number;
    intakeBindingCount: number;
    historicalOperationCount: number;
    currentOperationCount: number;
  };
  templates: RequirementCandidateTemplate[];
  operations: RequirementCandidateOperation[];
  hashes: { templatesSha256: string; operationsSha256: string };
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableRequirementVersionIdentity(scope: string): string {
  const bytes = Buffer.from(sha256(`cuac-requirement-candidate-v1:${scope}`).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function requirementCandidateOperationsSha256(operations: RequirementCandidateOperation[]): string {
  return sha256(JSON.stringify(operations));
}

export function requirementCandidateTemplatesSha256(templates: RequirementCandidateTemplate[]): string {
  return sha256(JSON.stringify(templates));
}

function assertText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
}

export function validateRequirementReleaseCandidate(value: unknown): RequirementReleaseCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Requirement candidate must be an object.");
  const candidate = value as RequirementReleaseCandidate;
  if (candidate.version !== 2 || candidate.status !== "unreviewed_non_public_requirement_candidate") throw new Error("Unsupported requirement candidate.");
  const timestamp = new Date(candidate.generatedAt);
  if (!Number.isFinite(timestamp.valueOf()) || timestamp.toISOString() !== candidate.generatedAt) throw new Error("generatedAt must be canonical UTC.");
  if (candidate.authorization?.candidatePreparationAuthorized !== true
    || candidate.authorization.executionAuthorized !== false
    || candidate.authorization.persistentDatabaseWriteAuthorized !== false
    || candidate.authorization.publicationAuthorized !== false
    || candidate.decision?.humanReviewCompleted !== false) {
    throw new Error("Unreviewed requirement candidates cannot authorize execution, database writes, review, or publication.");
  }
  if (!Array.isArray(candidate.templates) || candidate.templates.length < 1) throw new Error("Requirement candidate must contain templates.");
  if (!Array.isArray(candidate.operations) || candidate.operations.length < 1) throw new Error("Requirement candidate must contain operations.");

  const templateDocuments = new Map<string, RequirementCandidateTemplate>();
  for (const template of candidate.templates) {
    assertText(template.templateKey, "templateKey");
    assertText(template.documentSha256, "documentSha256");
    if (templateDocuments.has(template.templateKey)) throw new Error(`Duplicate requirement template: ${template.templateKey}`);
    const document = parseRequirementDocument(template.document);
    if (requirementDigest(document) !== template.documentSha256) throw new Error(`Requirement template digest mismatch: ${template.templateKey}`);
    templateDocuments.set(template.templateKey, template);
  }
  if (candidate.hashes?.templatesSha256 !== requirementCandidateTemplatesSha256(candidate.templates)) {
    throw new Error("Requirement candidate template hash mismatch.");
  }

  const operationKeys = new Set<string>();
  const intakeBindings = new Set<string>();
  const programs = new Set<string>();
  const schools = new Set<string>();
  const templates = new Set<string>();
  for (const operation of candidate.operations) {
    for (const [name, field] of Object.entries({
      operationKey: operation.operationKey,
      templateKey: operation.templateKey,
      schoolSlug: operation.schoolSlug,
      programSlug: operation.programSlug,
      intakeTerm: operation.intakeTerm,
      versionIdentity: operation.versionIdentity,
      documentSha256: operation.documentSha256,
    })) assertText(field, name);
    if (operationKeys.has(operation.operationKey)) throw new Error(`Duplicate operation key: ${operation.operationKey}`);
    operationKeys.add(operation.operationKey);
    const binding = `${operation.programSlug}:${operation.intakeTerm}:${operation.intakeYear}`;
    if (intakeBindings.has(binding)) throw new Error(`Duplicate intake binding: ${binding}`);
    intakeBindings.add(binding);
    const isHistorical = operation.intakeYear === 2026 && operation.cycleState === "historical_2026";
    const isCurrent = operation.intakeYear === 2027 && operation.cycleState === "current_2027";
    if (!isHistorical && !isCurrent) throw new Error(`Unsupported requirement candidate cycle binding: ${binding}`);
    if (operation.targetBindingStatus !== "verified" || operation.reviewStatus !== "unreviewed") {
      throw new Error(`Operation ${operation.operationKey} is not an unreviewed verified binding.`);
    }
    const template = templateDocuments.get(operation.templateKey);
    if (!template || template.documentSha256 !== operation.documentSha256) throw new Error(`Requirement template binding mismatch: ${operation.operationKey}`);
    const expectedIdentity = stableRequirementVersionIdentity(`${binding}:${operation.documentSha256}`);
    if (operation.versionIdentity !== expectedIdentity) throw new Error(`Version identity mismatch: ${operation.operationKey}`);
    programs.add(operation.programSlug);
    schools.add(operation.schoolSlug);
    templates.add(operation.templateKey);
  }

  const expectedSummary = {
    templateCount: templateDocuments.size,
    operationCount: candidate.operations.length,
    schoolCount: schools.size,
    programCount: programs.size,
    intakeBindingCount: intakeBindings.size,
    historicalOperationCount: candidate.operations.filter((operation) => operation.cycleState === "historical_2026").length,
    currentOperationCount: candidate.operations.filter((operation) => operation.cycleState === "current_2027").length,
  };
  if (templates.size !== templateDocuments.size) throw new Error("Requirement candidate contains an unreferenced template.");
  if (JSON.stringify(candidate.summary) !== JSON.stringify(expectedSummary)) throw new Error("Requirement candidate summary mismatch.");
  if (candidate.hashes?.operationsSha256 !== requirementCandidateOperationsSha256(candidate.operations)) throw new Error("Requirement candidate operations hash mismatch.");
  return candidate;
}

export async function applyRequirementCandidateForDisposableRehearsal(client: SqlClient, value: unknown) {
  const candidate = validateRequirementReleaseCandidate(value);
  const documents = new Map(candidate.templates.map((template) => [template.templateKey, template.document]));
  const payload = candidate.operations.map((operation) => ({
    program_slug: operation.programSlug,
    intake_term: operation.intakeTerm,
    intake_year: operation.intakeYear,
    version_identity: operation.versionIdentity,
    content_sha256: operation.documentSha256,
    content_json: documents.get(operation.templateKey),
  }));
  const resolved = await client.query(`select count(*)::integer count
    from jsonb_to_recordset($1::jsonb) x(program_slug text,intake_term text,intake_year integer)
    join programs p on p.slug=x.program_slug
    join program_intakes i on i.program_id=p.id and i.intake_term=x.intake_term and i.intake_year=x.intake_year`, [JSON.stringify(payload)]);
  if (resolved.rows[0]?.count !== payload.length) throw new Error("Not every requirement operation resolves to an exact program intake.");
  const result = await client.query(`insert into program_requirement_versions(
      id,program_intake_id,version,content_json,content_sha256,review_status)
    select x.version_identity,i.id,1,x.content_json,x.content_sha256,'draft'
    from jsonb_to_recordset($1::jsonb) x(
      program_slug text,intake_term text,intake_year integer,version_identity uuid,content_sha256 text,content_json jsonb)
    join programs p on p.slug=x.program_slug
    join program_intakes i on i.program_id=p.id and i.intake_term=x.intake_term and i.intake_year=x.intake_year
    on conflict(program_intake_id,version) do nothing`, [JSON.stringify(payload)]);
  return { draftsChanged: result.rowCount ?? 0 };
}
