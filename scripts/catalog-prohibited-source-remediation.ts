import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type JsonRecord = Record<string, unknown>;
type SeedState = "approved_local" | "draft";
type Candidate = {
  seedFile: string; seedState: SeedState; sourceUrl: string; sourceLabel: string | null;
  sourceSha256: string; capturedAt: string | null; schoolSlug: string | null; slug: string; record: JsonRecord;
};

const root = process.cwd();
const prohibitedHost = /(^|\.)(cscapilot\.com|csca\.app|wentchina\.com)$/i;
const normalizeUrl = (value: unknown) => {
  try { const url = new URL(String(value || "")); url.hash = ""; return url.toString(); } catch { return ""; }
};
const isProhibited = (value: unknown) => {
  try { return prohibitedHost.test(new URL(String(value || "")).hostname); } catch { return true; }
};

const registry = JSON.parse(await readFile(resolve(root, "catalog-sources/official-sources.json"), "utf8"));
const registeredById = new Map<string, JsonRecord>((registry.sources || []).map((row: JsonRecord) => [String(row.id), row]));
const recognizedUrls = new Set<string>();
for (const source of registeredById.values()) {
  const normalized = normalizeUrl(source.url);
  if (normalized) recognizedUrls.add(normalized);
}
const acquiredRoot = resolve(root, "work/catalog-official");
for (const entry of await readdir(acquiredRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(acquiredRoot, entry.name, "manifest.json"), "utf8"));
    for (const source of manifest.sources || []) {
      if (!registeredById.has(String(source.id))) continue;
      for (const value of [source.url, source.finalUrl]) {
        const normalized = normalizeUrl(value);
        if (normalized) recognizedUrls.add(normalized);
      }
    }
  } catch { /* Incomplete acquisitions cannot establish evidence identity. */ }
}

const candidates = {
  school: new Map<string, Candidate[]>(), program: new Map<string, Candidate[]>(), scholarship: new Map<string, Candidate[]>(),
};
const seedDir = resolve(root, "seeds");
const seedFiles = (await readdir(seedDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && (entry.name.endsWith(".approved.local.json") || entry.name.endsWith(".draft.json")))
  .map(entry => resolve(seedDir, entry.name));

function addCandidate(entity: keyof typeof candidates, row: JsonRecord, fileName: string, seedState: SeedState) {
  const slug = String(row.slug || "");
  const sourceUrl = normalizeUrl(row.sourceUrl);
  const sourceSha256 = String(row.sourceSha256 || "");
  if (!slug || !sourceUrl || isProhibited(sourceUrl) || !recognizedUrls.has(sourceUrl) || !/^[a-f0-9]{64}$/i.test(sourceSha256)) return;
  const schoolSlug = row.schoolSlug ? String(row.schoolSlug) : entity === "school" ? slug : null;
  const candidate: Candidate = { seedFile: fileName, seedState, sourceUrl, sourceLabel: row.sourceLabel ? String(row.sourceLabel) : null,
    sourceSha256: sourceSha256.toLowerCase(), capturedAt: row.capturedAt ? String(row.capturedAt) : null, schoolSlug, slug, record: row };
  const keys = new Set([slug, schoolSlug ? `${schoolSlug}|${slug}` : ""]);
  for (const key of keys) {
    if (!key) continue;
    const list = candidates[entity].get(key) || [];
    if (!list.some(item => item.seedFile === candidate.seedFile && item.sourceSha256 === candidate.sourceSha256)) list.push(candidate);
    candidates[entity].set(key, list);
  }
}

for (const file of seedFiles) {
  const fileName = basename(file);
  const seedState: SeedState = fileName.endsWith(".approved.local.json") ? "approved_local" : "draft";
  const bundle = JSON.parse(await readFile(file, "utf8"));
  for (const row of bundle.schools || []) addCandidate("school", row, fileName, seedState);
  for (const row of bundle.programs || []) addCandidate("program", row, fileName, seedState);
  for (const row of bundle.scholarships || []) addCandidate("scholarship", row, fileName, seedState);
}

const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:prohibited-source-remediation" });
const result = await pool.query(`
  select 'school' entity_type, s.id::text, s.slug, s.slug school_slug, s.name_en display_name,
    s.source_url, s.source_label, s.verification_status
  from schools s where s.status='active' and coalesce(s.source_url,'') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
  union all
  select 'program', p.id::text, p.slug, s.slug, p.name_en, p.source_url, p.source_label, p.verification_status
  from programs p join schools s on s.id=p.school_id
  where p.status='active' and coalesce(p.source_url,'') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
  union all
  select 'scholarship', x.id::text, x.slug, s.slug, x.title, x.source_url, x.source_label, x.verification_status
  from scholarships x left join schools s on s.id=x.school_id
  where x.status='active' and coalesce(x.source_url,'') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
  order by entity_type, school_slug nulls last, slug
`);
await pool.end();

const classifications = {
  officialReplacementApprovedLocal: [] as JsonRecord[], officialReplacementDraft: [] as JsonRecord[],
  conflictingOfficialCandidates: [] as JsonRecord[], quarantineRequired: [] as JsonRecord[],
};
for (const row of result.rows as JsonRecord[]) {
  const entity = String(row.entity_type) as keyof typeof candidates;
  const slug = String(row.slug);
  const schoolSlug = row.school_slug ? String(row.school_slug) : null;
  const matches = candidates[entity].get(schoolSlug ? `${schoolSlug}|${slug}` : slug) || candidates[entity].get(slug) || [];
  const distinct = new Map(matches.map(candidate => [`${candidate.sourceUrl}|${candidate.sourceSha256}`, candidate]));
  const official = [...distinct.values()].sort((a, b) => a.seedFile.localeCompare(b.seedFile));
  const base = { entityType: entity, id: row.id, slug, schoolSlug, displayName: row.display_name,
    currentSourceUrl: row.source_url, currentVerificationStatus: row.verification_status };
  if (!official.length) classifications.quarantineRequired.push({ ...base, reason: "no_registered_official_seed_candidate" });
  else if (official.length > 1) classifications.conflictingOfficialCandidates.push({ ...base, candidates: official });
  else if (official[0].seedState === "approved_local") classifications.officialReplacementApprovedLocal.push({ ...base, candidate: official[0] });
  else classifications.officialReplacementDraft.push({ ...base, candidate: official[0] });
}

const report = {
  version: 1, generatedAt: new Date().toISOString(), status: "unreviewed_draft",
  databaseWriteAuthorized: false, publicationAuthorized: false,
  policy: {
    recognizedEvidence: "Candidate source URL must match a registered official source URL or the final URL of its acquired manifest, and must include a SHA-256 snapshot hash.",
    safetyBoundary: "Until an official replacement is independently reviewed and published, prohibited-source records must remain outside public catalog queries.",
    noAutomaticReplacement: true,
  },
  summary: {
    prohibitedActiveRecords: result.rows.length,
    officialReplacementApprovedLocal: classifications.officialReplacementApprovedLocal.length,
    officialReplacementDraft: classifications.officialReplacementDraft.length,
    conflictingOfficialCandidates: classifications.conflictingOfficialCandidates.length,
    quarantineRequired: classifications.quarantineRequired.length,
    byEntity: Object.fromEntries(Object.entries(classifications).map(([classification, rows]) => [classification,
      (rows as JsonRecord[]).reduce((counts: Record<string, number>, row) => {
        const entity = String(row.entityType); counts[entity] = (counts[entity] || 0) + 1; return counts;
      }, {})])),
  },
  classifications,
};
const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-prohibited-source-remediation.draft.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary }, null, 2));
