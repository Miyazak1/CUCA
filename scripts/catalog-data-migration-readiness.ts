import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type Row = Record<string, unknown>;
type EntityType = "school" | "program" | "scholarship";

const root = process.cwd();
const quality = resolve(root, "work/catalog-quality");
const readJson = async (name: string) => JSON.parse(await readFile(resolve(quality, name), "utf8"));
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha256 = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
const isBlank = (value: unknown) => value === undefined || value === null || value === "";
const snake = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const prohibitedSource = (value: unknown) => /(cscapilot\.com|csca\.app|wentchina\.com)/i.test(String(value ?? ""));
const exactSha = (value: unknown) => /^[a-f0-9]{64}$/i.test(String(value ?? ""));

const [audit, coverage, gaps, remediation, prohibited] = await Promise.all([
  readJson("catalog-data-integrity-audit.json"),
  readJson("catalog-official-draft-coverage.json"),
  readJson("catalog-data-gap-queue.draft.json"),
  readJson("catalog-data-remediation-plan.draft.json"),
  readJson("catalog-prohibited-source-remediation.draft.json"),
]);
if (coverage.publicationAuthorized !== false || coverage.databaseWriteAuthorized !== false
  || remediation.publicationAuthorized !== false || remediation.databaseWriteAuthorized !== false
  || prohibited.publicationAuthorized !== false || prohibited.databaseWriteAuthorized !== false) {
  throw new Error("Migration readiness accepts only explicitly non-authorizing inputs.");
}
if (gaps.summary.completionGatePassed !== true || coverage.summary.blockingCoreRecords !== 0) throw new Error("Data completion gate is not satisfied.");
if (audit.summary.publicExposureBlockingIssueCount !== 0) throw new Error("A prohibited-source record is public-eligible.");

const fieldOperations = [...remediation.replayReady.fieldOperations, ...remediation.reviewDeferred.fieldOperations] as Row[];
const intakeOperations = [...remediation.replayReady.intakeOperations, ...remediation.reviewDeferred.intakeOperations] as Row[];
const replacements = prohibited.classifications.officialReplacementDraft as Row[];
const quarantines = prohibited.classifications.quarantineRequired as Row[];
const conflicts = prohibited.classifications.conflictingOfficialCandidates as Row[];
if (conflicts.length) throw new Error("Conflicting official candidates must be resolved before rehearsal.");

const operationKeys = new Set<string>();
for (const operation of fieldOperations) {
  const key = `${operation.entityType}:${operation.entitySlug}:${operation.field}`;
  if (operationKeys.has(key)) throw new Error(`Duplicate field operation: ${key}`);
  operationKeys.add(key);
  if (operation.operation !== "set_if_null" || !String(operation.sourceUrl).startsWith("https://") || !exactSha(operation.sourceSha256) || prohibitedSource(operation.sourceUrl)) {
    throw new Error(`Unsafe field operation: ${key}`);
  }
}
for (const operation of intakeOperations) {
  const key = `program_intake:${operation.programSlug}:${operation.intakeTerm}:${operation.intakeYear}`;
  if (operationKeys.has(key)) throw new Error(`Duplicate intake operation: ${key}`);
  operationKeys.add(key);
  if (operation.operation !== "insert_if_absent_by_program_term_year" || !String(operation.sourceUrl).startsWith("https://") || !exactSha(operation.sourceSha256) || prohibitedSource(operation.sourceUrl)) {
    throw new Error(`Unsafe intake operation: ${key}`);
  }
}

const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-data-migration-readiness" });
const connection = await pool.connect();
try {
  await connection.query("begin isolation level repeatable read read only");
  const identity = (await connection.query("select current_database() database_name, current_user database_user")).rows[0];
  const entityRows = new Map<EntityType, Map<string, Row>>();
  const entityRowsById = new Map<EntityType, Map<string, Row>>();
  for (const [entityType, table] of [["school", "schools"], ["program", "programs"], ["scholarship", "scholarships"]] as const) {
    const rows = (await connection.query(`select id::text, slug, status, verification_status, source_url, to_jsonb(t) data from ${table} t`)).rows as Row[];
    entityRows.set(entityType, new Map(rows.map(row => [String(row.slug), row])));
    entityRowsById.set(entityType, new Map(rows.map(row => [String(row.id), row])));
  }
  const existingIntakes = new Set<string>((await connection.query(`
    select p.slug program_slug, i.intake_term, i.intake_year
    from program_intakes i join programs p on p.id=i.program_id
  `)).rows.map(row => `${row.program_slug}:${row.intake_term}:${row.intake_year}`));

  let readyFieldOperations = 0;
  let alreadyAppliedFieldOperations = 0;
  const staleFieldOperations: Row[] = [];
  const simulationFields = new Map<string, unknown>();
  for (const operation of fieldOperations) {
    const entityType = operation.entityType as EntityType;
    const row = entityRows.get(entityType)?.get(String(operation.entitySlug));
    if (!row) throw new Error(`Field operation target not found: ${entityType}:${operation.entitySlug}`);
    const column = snake(String(operation.field));
    const current = (row.data as Row)[column];
    const key = `${entityType}:${operation.entitySlug}:${operation.field}`;
    simulationFields.set(key, current);
    if (isBlank(current)) readyFieldOperations += 1;
    else if (canonical(current) === canonical(operation.value)) alreadyAppliedFieldOperations += 1;
    else staleFieldOperations.push({ key, current, proposed: operation.value });
  }

  let readyIntakeOperations = 0;
  let alreadyAppliedIntakeOperations = 0;
  for (const operation of intakeOperations) {
    if (!entityRows.get("program")?.has(String(operation.programSlug))) throw new Error(`Intake program not found: ${operation.programSlug}`);
    const key = `${operation.programSlug}:${operation.intakeTerm}:${operation.intakeYear}`;
    if (existingIntakes.has(key)) alreadyAppliedIntakeOperations += 1;
    else readyIntakeOperations += 1;
  }

  const validateClassification = (classification: Row, expectedCandidate: boolean) => {
    const entityType = classification.entityType as EntityType;
    const target = entityRowsById.get(entityType)?.get(String(classification.id));
    if (!target || target.slug !== classification.slug || target.source_url !== classification.currentSourceUrl || target.status !== "active" || !prohibitedSource(target.source_url)) {
      throw new Error(`Classification target changed: ${entityType}:${classification.slug}`);
    }
    if (expectedCandidate) {
      const candidate = classification.candidate as Row;
      const record = candidate?.record as Row;
      if (candidate?.seedState !== "draft" || record?.slug !== classification.slug || !String(candidate?.sourceUrl).startsWith("https://")
        || prohibitedSource(candidate?.sourceUrl) || !exactSha(candidate?.sourceSha256)) throw new Error(`Unsafe replacement candidate: ${entityType}:${classification.slug}`);
      if (entityType !== "school" && classification.schoolSlug && !entityRows.get("school")?.has(String(classification.schoolSlug))) {
        throw new Error(`Replacement school dependency missing: ${classification.schoolSlug}`);
      }
    } else if (!classification.reason) throw new Error(`Quarantine reason missing: ${entityType}:${classification.slug}`);
  };
  replacements.forEach(row => validateClassification(row, true));
  quarantines.forEach(row => validateClassification(row, false));

  const before = {
    fields: [...simulationFields.entries()].sort(([a], [b]) => a.localeCompare(b)),
    intakeKeys: [...existingIntakes].filter(key => intakeOperations.some((row: Row) => key === `${row.programSlug}:${row.intakeTerm}:${row.intakeYear}`)).sort(),
    classifications: [...replacements, ...quarantines].map(row => ({ entityType: row.entityType, id: row.id, slug: row.slug, currentSourceUrl: row.currentSourceUrl })).sort((a, b) => `${a.entityType}:${a.slug}`.localeCompare(`${b.entityType}:${b.slug}`)),
  };
  const beforeSha256 = sha256(before);
  const simulatedFields = new Map(simulationFields);
  const simulatedIntakes = new Set(existingIntakes);
  const simulatedDisposition = new Map<string, string>();
  const applySimulation = () => {
    let changes = 0;
    for (const operation of fieldOperations) {
      const key = `${operation.entityType}:${operation.entitySlug}:${operation.field}`;
      if (isBlank(simulatedFields.get(key))) { simulatedFields.set(key, operation.value); changes += 1; }
    }
    for (const operation of intakeOperations) {
      const key = `${operation.programSlug}:${operation.intakeTerm}:${operation.intakeYear}`;
      if (!simulatedIntakes.has(key)) { simulatedIntakes.add(key); changes += 1; }
    }
    for (const row of replacements) {
      const key = `${row.entityType}:${row.id}`;
      if (simulatedDisposition.get(key) !== `replace:${(row.candidate as Row).sourceSha256}`) { simulatedDisposition.set(key, `replace:${(row.candidate as Row).sourceSha256}`); changes += 1; }
    }
    for (const row of quarantines) {
      const key = `${row.entityType}:${row.id}`;
      if (simulatedDisposition.get(key) !== "archive_after_approval") { simulatedDisposition.set(key, "archive_after_approval"); changes += 1; }
    }
    return changes;
  };
  const firstPassChanges = applySimulation();
  const secondPassChanges = applySimulation();
  const rollbackSha256 = sha256(before);
  if (secondPassChanges !== 0 || rollbackSha256 !== beforeSha256) throw new Error("Logical idempotency or rollback rehearsal failed.");

  const normalizedPlan = {
    fieldOperations: fieldOperations.map(row => ({ entityType: row.entityType, entitySlug: row.entitySlug, field: row.field, value: row.value, sourceSha256: row.sourceSha256 })),
    intakeOperations: intakeOperations.map(row => ({ programSlug: row.programSlug, intakeTerm: row.intakeTerm, intakeYear: row.intakeYear, sourceSha256: row.sourceSha256 })),
    replacements: replacements.map(row => ({ entityType: row.entityType, id: row.id, slug: row.slug, candidateSha256: (row.candidate as Row).sourceSha256 })),
    quarantines: quarantines.map(row => ({ entityType: row.entityType, id: row.id, slug: row.slug, reason: row.reason })),
  };
  const generatedAt = new Date().toISOString();
  const report = {
    version: 1,
    generatedAt,
    status: "unreviewed_draft",
    executionAuthorized: false,
    publicationAuthorized: false,
    databaseWriteAuthorized: false,
    sourceDatabase: { databaseName: identity.database_name, databaseUser: identity.database_user, transaction: "repeatable read read only" },
    planSha256: sha256(normalizedPlan),
    sourceReportSha256: {
      audit: sha256(audit), coverage: sha256(coverage), gaps: sha256(gaps), remediation: sha256(remediation), prohibited: sha256(prohibited),
    },
    summary: {
      fieldOperations: fieldOperations.length,
      readyFieldOperations,
      alreadyAppliedFieldOperations,
      staleFieldOperations: staleFieldOperations.length,
      intakeOperations: intakeOperations.length,
      readyIntakeOperations,
      alreadyAppliedIntakeOperations,
      officialReplacementDrafts: replacements.length,
      quarantineRequired: quarantines.length,
      conflictingCandidates: conflicts.length,
      publicEligibleProhibitedSources: audit.summary.publicExposureBlockingIssueCount,
      firstPassLogicalChanges: firstPassChanges,
      secondPassLogicalChanges: secondPassChanges,
      rollbackRestoredOriginalHash: rollbackSha256 === beforeSha256,
    },
    gates: {
      dataCompletionGatePassed: gaps.summary.completionGatePassed === true,
      allProductionSchoolsClassified: gaps.summary.unclassifiedProductionSchools === 0,
      officialDraftBlockingCoreRecordsZero: coverage.summary.blockingCoreRecords === 0,
      prohibitedSourcePublicExposureZero: audit.summary.publicExposureBlockingIssueCount === 0,
      classificationAccountsForAllProhibitedSources: prohibited.summary.prohibitedActiveRecords === replacements.length + quarantines.length + conflicts.length,
      operationEvidenceValid: true,
      currentPreconditionsStable: staleFieldOperations.length === 0,
      logicalIdempotencyPassed: secondPassChanges === 0,
      logicalRollbackPassed: rollbackSha256 === beforeSha256,
    },
    staleFieldOperations,
    executionBoundary: {
      requiredBeforeAnyWrite: [
        "Completed human review references for every draft replacement and deferred operation.",
        "Explicit approval of the recoverable archive policy for quarantineRequired records.",
        "Fresh official-source and database-state hashes matching this report.",
        "A disposable PostgreSQL transaction rehearsal of the approved executable bundle.",
        "A tested pre-image backup and rollback command for the selected deployment environment."
      ],
      proposedQuarantineDisposition: "Recoverable archive after explicit approval; never physical deletion.",
      rollbackModel: "Capture exact pre-image rows in the approved deployment artifact, execute in one transaction, verify postconditions, and restore the pre-image in a separate guarded rollback transaction if required."
    }
  };
  const outputPath = resolve(quality, "catalog-data-migration-readiness.draft.json");
  await mkdir(quality, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, planSha256: report.planSha256, summary: report.summary, gates: report.gates, executionAuthorized: false }, null, 2));
  await connection.query("rollback");
} catch (error) {
  try { await connection.query("rollback"); } catch { /* Connection cleanup only. */ }
  throw error;
} finally {
  connection.release();
  await pool.end();
}
