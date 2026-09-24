import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type JsonRecord = Record<string, unknown>;
type Candidate = { file: string; record: JsonRecord; score: number };
type ExemptionRule = {
  id: string;
  entity: "school" | "program" | "scholarship";
  schoolSlug: string;
  fields: string[];
  reasonCode: string;
  reason: string;
  expectedRecordCount: number;
};

const root = process.cwd();
const registry = JSON.parse(await readFile(resolve(root, "catalog-sources/official-sources.json"), "utf8")) as { sources: JsonRecord[] };
const exemptionConfig = JSON.parse(await readFile(resolve(root, "catalog-sources/official-completeness-exemptions.json"), "utf8")) as {
  version: number;
  status: string;
  authorizedAt: string;
  policy: JsonRecord;
  rules: ExemptionRule[];
  sourceSetRules?: JsonRecord[];
};
if (exemptionConfig.version !== 1 || exemptionConfig.status !== "product-authorized-deferment" || !Array.isArray(exemptionConfig.rules)) {
  throw new Error("Official completeness exemption configuration is invalid.");
}
const exemptionIds = new Set<string>();
for (const rule of exemptionConfig.rules) {
  if (!rule.id || exemptionIds.has(rule.id) || !["school", "program", "scholarship"].includes(rule.entity) || !rule.schoolSlug || !rule.fields.length || !rule.reasonCode || !rule.reason || !Number.isInteger(rule.expectedRecordCount) || rule.expectedRecordCount < 1) {
    throw new Error(`Invalid or duplicate official completeness exemption rule: ${rule.id || "<missing>"}`);
  }
  exemptionIds.add(rule.id);
}
const registeredIds = new Set(registry.sources.map((row) => String(row.id)));
const evidence = new Set<string>();
const acquiredRoot = resolve(root, "work/catalog-official");
for (const entry of await readdir(acquiredRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(acquiredRoot, entry.name, "manifest.json"), "utf8")) as { sources?: JsonRecord[] };
    for (const source of manifest.sources ?? []) {
      if (!registeredIds.has(String(source.id)) || Number(source.status) !== 200 || !/^[a-f0-9]{64}$/i.test(String(source.sha256 ?? ""))) continue;
      for (const value of [source.url, source.finalUrl]) {
        if (!value) continue;
        evidence.add(`${new URL(String(value)).toString()}\n${String(source.sha256).toLowerCase()}`);
      }
    }
  } catch {
    // Incomplete acquisition directories cannot establish evidence identity.
  }
}

const fields = {
  school: ["citySlug", "websiteUrl", "admissionsUrl", "applicationLevel"],
  program: ["degreeLevel", "teachingLanguage", "tuitionText", "applicationUrl"],
  scholarship: ["fundingLevel", "coverage", "applicableDegree", "amountText"],
} as const;
type Entity = keyof typeof fields;
const selected: Record<Entity, Map<string, Candidate>> = { school: new Map(), program: new Map(), scholarship: new Map() };
const entityArrays: Record<Entity, string> = { school: "schools", program: "programs", scholarship: "scholarships" };
const seedDir = resolve(root, "seeds");
const files = (await readdir(seedDir)).filter((file) => file.endsWith(".draft.json") || file.endsWith(".approved.local.json"));
const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "";
const evidenceKey = (row: JsonRecord) => {
  try { return `${new URL(String(row.sourceUrl)).toString()}\n${String(row.sourceSha256).toLowerCase()}`; } catch { return ""; }
};

for (const file of files) {
  let bundle: JsonRecord;
  try { bundle = JSON.parse(await readFile(resolve(seedDir, file), "utf8")) as JsonRecord; } catch { continue; }
  for (const entity of Object.keys(fields) as Entity[]) {
    const rows = Array.isArray(bundle[entityArrays[entity]]) ? bundle[entityArrays[entity]] as JsonRecord[] : [];
    for (const row of rows) {
      const slug = String(row.slug ?? "");
      if (!slug || !evidence.has(evidenceKey(row))) continue;
      const score = fields[entity].filter((field) => hasValue(row[field])).length + (row.sourceFieldLineage ? 1 : 0);
      const existing = selected[entity].get(slug);
      if (!existing || score > existing.score || (score === existing.score && file.endsWith(".approved.local.json") && !existing.file.endsWith(".approved.local.json"))) {
        selected[entity].set(slug, { file, record: row, score });
      }
    }
  }
}

const missingByEntity: Record<Entity, Record<string, number>> = { school: {}, program: {}, scholarship: {} };
const missingBySchool = new Map<string, { school: number; program: number; scholarship: number; missingFields: Record<string, number> }>();
const missingRecords: JsonRecord[] = [];
for (const entity of Object.keys(fields) as Entity[]) {
  for (const [slug, candidate] of selected[entity]) {
    const missing = fields[entity].filter((field) => !hasValue(candidate.record[field]));
    if (!missing.length) continue;
    const schoolSlug = String(candidate.record.schoolSlug ?? (entity === "school" ? slug : "provider-level"));
    const group = missingBySchool.get(schoolSlug) ?? { school: 0, program: 0, scholarship: 0, missingFields: {} };
    group[entity] += 1;
    for (const field of missing) {
      missingByEntity[entity][field] = (missingByEntity[entity][field] ?? 0) + 1;
      group.missingFields[`${entity}.${field}`] = (group.missingFields[`${entity}.${field}`] ?? 0) + 1;
    }
    missingBySchool.set(schoolSlug, group);
    missingRecords.push({ entity, slug, schoolSlug, missing, sourceFile: candidate.file, sourceUrl: candidate.record.sourceUrl, sourceSha256: candidate.record.sourceSha256 });
  }
}

const exemptionMatchCounts = new Map(exemptionConfig.rules.map((rule) => [rule.id, 0]));
const deferredRecords: JsonRecord[] = [];
const actionableMissingRecords: JsonRecord[] = [];
for (const record of missingRecords) {
  const missing = record.missing as string[];
  const matches = exemptionConfig.rules.filter((rule) => rule.entity === record.entity && rule.schoolSlug === record.schoolSlug && missing.every((field) => rule.fields.includes(field)));
  if (matches.length > 1) throw new Error(`Multiple completeness exemptions match ${record.entity}:${record.slug}.`);
  const rule = matches[0];
  if (!rule) {
    actionableMissingRecords.push(record);
    continue;
  }
  exemptionMatchCounts.set(rule.id, (exemptionMatchCounts.get(rule.id) ?? 0) + 1);
  deferredRecords.push({ ...record, disposition: "deferred_external_blocker", exemptionId: rule.id, reasonCode: rule.reasonCode, reason: rule.reason });
}
for (const rule of exemptionConfig.rules) {
  const actual = exemptionMatchCounts.get(rule.id) ?? 0;
  if (actual !== rule.expectedRecordCount) {
    throw new Error(`Completeness exemption ${rule.id} expected ${rule.expectedRecordCount} record(s) but matched ${actual}. Re-review the rule instead of silently widening or shrinking it.`);
  }
}

const intakeCandidates = new Map<string, JsonRecord>();
for (const file of files) {
  let bundle: JsonRecord;
  try { bundle = JSON.parse(await readFile(resolve(seedDir, file), "utf8")) as JsonRecord; } catch { continue; }
  const rows = Array.isArray(bundle.programIntakes) ? bundle.programIntakes as JsonRecord[] : [];
  for (const row of rows) {
    if (!evidence.has(evidenceKey(row)) || !selected.program.has(String(row.programSlug ?? ""))) continue;
    const key = [row.programSlug, row.intakeTerm, row.intakeYear, row.applicationRound ?? ""].join("|");
    intakeCandidates.set(key, { ...row, sourceFile: file });
  }
}
const openFutureIntakes = [...intakeCandidates.values()].filter((row) => Number(row.intakeYear) >= 2027 && row.status === "open");
const schoolsByMissingCount = [...missingBySchool.entries()].map(([schoolSlug, value]) => ({ schoolSlug, ...value, total: value.school + value.program + value.scholarship }))
  .sort((a, b) => b.total - a.total || a.schoolSlug.localeCompare(b.schoolSlug));
const report = {
  version: 2,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_draft",
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  policy: {
    evidenceBoundary: "A record is counted only when its URL and SHA-256 match a successful manifest entry whose source ID remains in the official registry.",
    selection: "For duplicate slugs, prefer the candidate containing more core fields; ties prefer approved-local evidence without changing its approval state.",
    unresolvedRule: "Missing fields remain absent. This report never infers or writes replacement values.",
    defermentRule: "A product-authorized external blocker removes a missing record from the current completion gate but never represents the field as populated, reviewed or publishable.",
  },
  summary: {
    seedFilesScanned: files.length,
    acquiredEvidenceIdentities: evidence.size,
    uniqueOfficialSchools: selected.school.size,
    uniqueOfficialPrograms: selected.program.size,
    uniqueOfficialScholarships: selected.scholarship.size,
    uniqueEvidenceBackedIntakes: intakeCandidates.size,
    open2027OrLaterIntakes: openFutureIntakes.length,
    missingCoreRecords: missingRecords.length,
    deferredExternalBlockerRecords: deferredRecords.length,
    actionableCoreRecords: actionableMissingRecords.length,
    blockingCoreRecords: actionableMissingRecords.length,
    missingCoreFields: missingByEntity,
  },
  schoolsByMissingCount,
  coveredSchoolSlugs: [...selected.school.keys()].sort(),
  exemptionConfig: {
    version: exemptionConfig.version,
    status: exemptionConfig.status,
    authorizedAt: exemptionConfig.authorizedAt,
    policy: exemptionConfig.policy,
    rules: exemptionConfig.rules.map((rule) => ({ ...rule, matchedRecordCount: exemptionMatchCounts.get(rule.id) ?? 0 })),
    sourceSetRules: exemptionConfig.sourceSetRules ?? [],
  },
  openFutureIntakes,
  actionableMissingRecords,
  deferredRecords,
  missingRecords,
};
const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-official-draft-coverage.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
