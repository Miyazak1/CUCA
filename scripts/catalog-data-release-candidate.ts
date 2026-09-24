import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type Row = Record<string, unknown>;
type EntityType = "school" | "program" | "scholarship";

const root = process.cwd();
const quality = resolve(root, "work/catalog-quality");
const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha256 = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
const exactSha = (value: unknown) => /^[a-f0-9]{64}$/i.test(String(value ?? ""));
const prohibitedSource = (value: unknown) => /(cscapilot\.com|csca\.app|wentchina\.com)/i.test(String(value ?? ""));
const snake = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const tableByEntity: Record<EntityType, string> = { school: "schools", program: "programs", scholarship: "scholarships" };

const [policy, readiness, remediation, prohibited, rehearsal] = await Promise.all([
  readJson("catalog-sources/owner-default-acceptance.json"),
  readJson("work/catalog-quality/catalog-data-migration-readiness.draft.json"),
  readJson("work/catalog-quality/catalog-data-remediation-plan.draft.json"),
  readJson("work/catalog-quality/catalog-prohibited-source-remediation.draft.json"),
  readJson("work/catalog-quality/catalog-data-migration-rehearsal.json"),
]);
if (policy.decision !== "default_accept_hash_pinned_official_evidence_candidates"
  || policy.authorization?.candidatePreparationAuthorized !== true
  || policy.review?.humanReviewCompleted !== false
  || policy.authorization?.persistentDatabaseWriteAuthorized !== false
  || policy.authorization?.publicationAuthorized !== false) throw new Error("Owner acceptance policy is invalid or over-authorizing.");
if (readiness.executionAuthorized !== false || readiness.publicationAuthorized !== false || readiness.databaseWriteAuthorized !== false
  || rehearsal.planSha256 !== readiness.planSha256 || rehearsal.status !== "passed_non_authorizing_rehearsal") throw new Error("Readiness and rehearsal evidence do not match.");
if (!Object.values(readiness.gates as Row).every(value => value === true)) throw new Error("A readiness gate has not passed.");

const fieldOperations = [...remediation.replayReady.fieldOperations, ...remediation.reviewDeferred.fieldOperations] as Row[];
const intakeOperations = [...remediation.replayReady.intakeOperations, ...remediation.reviewDeferred.intakeOperations] as Row[];
const replacements = prohibited.classifications.officialReplacementDraft as Row[];
const quarantines = prohibited.classifications.quarantineRequired as Row[];
if ((prohibited.classifications.conflictingOfficialCandidates as Row[]).length) throw new Error("Conflicting official evidence is not eligible for default acceptance.");
for (const operation of [...fieldOperations, ...intakeOperations]) {
  if (!String(operation.sourceUrl).startsWith("https://") || prohibitedSource(operation.sourceUrl) || !exactSha(operation.sourceSha256)) {
    throw new Error("Release candidate contains unsafe operation evidence.");
  }
}
for (const item of replacements) {
  const candidate = item.candidate as Row;
  if (candidate.seedState !== "draft" || !String(candidate.sourceUrl).startsWith("https://") || prohibitedSource(candidate.sourceUrl) || !exactSha(candidate.sourceSha256)) {
    throw new Error(`Unsafe replacement evidence: ${item.entityType}:${item.slug}`);
  }
}

const targetSlugs = new Map<EntityType, Set<string>>([
  ["school", new Set()], ["program", new Set()], ["scholarship", new Set()],
]);
for (const operation of fieldOperations) targetSlugs.get(operation.entityType as EntityType)?.add(String(operation.entitySlug));
for (const item of [...replacements, ...quarantines]) targetSlugs.get(item.entityType as EntityType)?.add(String(item.slug));

const state = await readJson(".cuac-local/runtime.json");
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-data-release-candidate" });
const connection = await pool.connect();
try {
  await connection.query("begin isolation level repeatable read read only");
  const identity = (await connection.query("select current_database() database_name, current_user database_user")).rows[0];
  const targets: Record<EntityType, Row[]> = { school: [], program: [], scholarship: [] };
  for (const entityType of Object.keys(tableByEntity) as EntityType[]) {
    const slugs = [...(targetSlugs.get(entityType) ?? [])].sort();
    if (slugs.length) targets[entityType] = (await connection.query(`select to_jsonb(t) data from ${tableByEntity[entityType]} t where slug = any($1::text[]) order by slug`, [slugs])).rows.map(row => row.data as Row);
    if (targets[entityType].length !== slugs.length) throw new Error(`Release target set changed for ${entityType}.`);
  }

  const programDependencies = new Set<string>();
  const schoolDependencies = new Set<string>();
  const cityDependencies = new Set<string>();
  for (const row of targets.program) {
    if (row.school_id) schoolDependencies.add(String(row.school_id));
    if (row.city_id) cityDependencies.add(String(row.city_id));
  }
  for (const row of targets.scholarship) {
    if (row.school_id) schoolDependencies.add(String(row.school_id));
    if (row.program_id) programDependencies.add(String(row.program_id));
  }
  const dependencyPrograms = programDependencies.size
    ? (await connection.query("select to_jsonb(t) data from programs t where id = any($1::uuid[]) order by slug", [[...programDependencies]])).rows.map(row => row.data as Row)
    : [];
  for (const row of dependencyPrograms) {
    if (row.school_id) schoolDependencies.add(String(row.school_id));
    if (row.city_id) cityDependencies.add(String(row.city_id));
  }
  for (const row of targets.school) if (row.city_id) cityDependencies.add(String(row.city_id));
  const dependencySchools = schoolDependencies.size
    ? (await connection.query("select to_jsonb(t) data from schools t where id = any($1::uuid[]) order by slug", [[...schoolDependencies]])).rows.map(row => row.data as Row)
    : [];
  for (const row of dependencySchools) if (row.city_id) cityDependencies.add(String(row.city_id));
  const dependencyCities = cityDependencies.size
    ? (await connection.query("select to_jsonb(t) data from cities t where id = any($1::uuid[]) order by slug", [[...cityDependencies]])).rows.map(row => row.data as Row)
    : [];

  const intakeKeys = intakeOperations.map(row => ({ programSlug: row.programSlug, intakeTerm: row.intakeTerm, intakeYear: row.intakeYear }));
  const existingIntakes = intakeKeys.length ? (await connection.query(`
    select to_jsonb(i) data from program_intakes i join programs p on p.id=i.program_id
    join jsonb_to_recordset($1::jsonb) x(program_slug text, intake_term text, intake_year integer)
      on x.program_slug=p.slug and x.intake_term=i.intake_term and x.intake_year=i.intake_year
    order by p.slug,i.intake_term,i.intake_year`, [JSON.stringify(intakeKeys.map(row => ({ program_slug: row.programSlug, intake_term: row.intakeTerm, intake_year: row.intakeYear })))])).rows.map(row => row.data as Row) : [];
  if (existingIntakes.length !== readiness.summary.alreadyAppliedIntakeOperations) throw new Error("Intake preimage changed after readiness generation.");

  const uniqueRows = (rows: Row[]) => [...new Map(rows.map(row => [String(row.id), row])).values()].sort((a, b) => String(a.slug ?? a.id).localeCompare(String(b.slug ?? b.id)));
  const fixtures = {
    cities: uniqueRows(dependencyCities),
    schools: uniqueRows([...dependencySchools, ...targets.school]),
    programs: uniqueRows([...dependencyPrograms, ...targets.program]),
    scholarships: uniqueRows(targets.scholarship),
    programIntakes: existingIntakes,
  };
  const operations = {
    fieldOperations,
    intakeOperations,
    replacements: replacements.map(item => ({ ...item, action: "replace_official_fields_keep_non_public" })),
    quarantines: quarantines.map(item => ({ ...item, action: "recoverable_archive" })),
  };
  const targetBySlug = new Map<string, Row>();
  for (const entityType of Object.keys(targets) as EntityType[]) for (const row of targets[entityType]) targetBySlug.set(`${entityType}:${row.slug}`, row);
  const replacementRecordBySlug = new Map(replacements.map(item => [`${item.entityType}:${item.slug}`, ((item.candidate as Row).record as Row)]));
  const expectedEffectiveFieldChanges = fieldOperations.filter(operation => {
    const key = `${operation.entityType}:${operation.entitySlug}`;
    const current = targetBySlug.get(key)?.[snake(String(operation.field))];
    const replacement = replacementRecordBySlug.get(key);
    const afterReplacement = replacement && operation.field in replacement && replacement[operation.field] !== null && replacement[operation.field] !== undefined
      ? replacement[operation.field] : current;
    return afterReplacement === null || afterReplacement === undefined || afterReplacement === "";
  }).length;
  const preimage = { targets, existingIntakes };
  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: "owner_default_accepted_non_public_candidate",
    decision: {
      reference: policy.decisionReference,
      perRecordHumanReviewRequiredByOwner: false,
      humanReviewCompleted: false,
      acceptedScope: policy.scope,
    },
    authorization: {
      candidatePreparationAuthorized: true,
      executionAuthorized: false,
      persistentDatabaseWriteAuthorized: false,
      publicationAuthorized: false,
    },
    targetGuard: {
      configured: false,
      requiredEnvironment: null,
      databaseName: null,
      databaseUser: null,
      databaseHost: null,
      tlsCertificateSha256: null,
      confirmationTokenSha256: null,
    },
    sourceDatabase: { databaseName: identity.database_name, databaseUser: identity.database_user, transaction: "repeatable read read only" },
    readinessPlanSha256: readiness.planSha256,
    migrationReleaseSha256: rehearsal.migrationReleaseSha256,
    operations,
    preimage,
    rehearsalFixtures: fixtures,
    hashes: {
      operationsSha256: sha256(operations),
      preimageSha256: sha256(preimage),
      rehearsalFixturesSha256: sha256(fixtures),
    },
    summary: {
      fieldOperations: fieldOperations.length,
      intakeOperations: intakeOperations.length,
      officialReplacements: replacements.length,
      recoverableArchives: quarantines.length,
      expectedEffectiveFieldChanges,
      expectedFirstPassActions: replacements.length + expectedEffectiveFieldChanges + intakeOperations.length + quarantines.length,
      targetSchools: targets.school.length,
      targetPrograms: targets.program.length,
      targetScholarships: targets.scholarship.length,
      existingTargetIntakes: existingIntakes.length,
    },
  };
  const outputPath = resolve(quality, "catalog-data-release-candidate.json");
  await mkdir(quality, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, status: artifact.status, authorization: artifact.authorization, hashes: artifact.hashes, summary: artifact.summary }, null, 2));
  await connection.query("rollback");
} catch (error) {
  try { await connection.query("rollback"); } catch { /* Connection cleanup only. */ }
  throw error;
} finally {
  connection.release();
  await pool.end();
}
