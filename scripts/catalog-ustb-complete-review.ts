import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.ustb-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.ustb-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.ustb-complete-batch-01.review.json"),
  manifest: resolve(root, "work/catalog-official/ustb-complete-batch-01/manifest.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(await readFile(paths.validation, "utf8"));
const manifestText = await readFile(paths.manifest, "utf8");
const manifest = JSON.parse(manifestText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("USTB validation changed after candidate build.");
if (manifest.sources.length !== 14 || manifest.sources.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("USTB evidence manifest incomplete.");
if (candidate.programs?.length !== 156 || candidate.programIntakes?.length !== 156 || candidate.scholarships?.length !== 5) throw new Error("USTB locked scope changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("USTB rich scholarship fields incomplete.");

const state = JSON.parse(await readFile(paths.state, "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ustb-complete-review" });
let preflight: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url from schools where slug='university-of-science-and-technology-beijing'");
  const city = await pool.query("select id,slug,status,verification_status,source_url from cities where slug='beijing'");
  const candidateProgramSlugs = (candidate.programs ?? []).map((row) => row.slug);
  const overlappingPrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [candidateProgramSlugs]);
  const archivePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug='university-of-science-and-technology-beijing-construction-management'");
  const archiveScholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where slug='university-of-science-and-technology-beijing'");
  const newProgramSlugs = candidateProgramSlugs.filter((slug) => !overlappingPrograms.rows.some((row) => row.slug === slug));
  const newConflicts = await pool.query("select slug from programs where slug=any($1::text[]) union all select slug from scholarships where slug=any($2::text[])", [newProgramSlugs, (candidate.scholarships ?? []).map((row) => row.slug)]);
  preflight = { school: school.rows, city: city.rows, overlappingPrograms: overlappingPrograms.rows, archivePrograms: archivePrograms.rows, archiveScholarships: archiveScholarships.rows, newProgramCount: newProgramSlugs.length, newConflicts: newConflicts.rows };
  if (school.rows.length !== 1 || city.rows.length !== 1 || overlappingPrograms.rows.length !== 11 || archivePrograms.rows.length !== 1 || archiveScholarships.rows.length !== 1 || newProgramSlugs.length !== 145 || newConflicts.rows.length) throw new Error(`USTB database baseline mismatch: ${JSON.stringify(preflight)}`);
  if (overlappingPrograms.rows.some((row) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("USTB stable programs are no longer the reviewed unverified legacy rows.");
} finally { await pool.end(); }

const reviewBase = {
  version: 1,
  status: "requires_explicit_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "university-of-science-and-technology-beijing", cityOverwriteCount: 1, schoolOverwriteCount: 1, programRouteCount: 156, bachelorRouteCount: 52, masterRouteCount: 54, doctoralRouteCount: 50, chineseRouteCount: 119, englishRouteCount: 37, programIntakeCount: 156, newProgramCount: 145, stableProgramOverwriteCount: 11, newScholarshipCount: 5, archiveProgramAliasCount: 1, archiveScholarshipAliasCount: 1 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, manifestSha256: sha(manifestText),
  evidence: manifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", note: "Fourteen exact official USTB 2026/2026-2027 HTML pages were captured. The undergraduate, master and doctoral catalogs, English-route matrix, admission rules, CSCA rules and four current scholarship notices are directly readable without attachment inference." },
  reconciliation: {
    destructiveDeletion: false,
    overwrites: [
      { entityType: "city", slug: "beijing", reason: "refresh the existing unverified Beijing provenance using USTB's current official address while preserving the stable city identity" },
      { entityType: "school", slug: "university-of-science-and-technology-beijing", reason: "replace an unverified third-party school summary with current official 2026 admissions, fee, language and CSCA fields" },
      ...preflight.overlappingPrograms.map((row: any) => ({ entityType: "program", slug: row.slug, reason: "preserve the stable program URL while replacing unverified third-party fields with the official 2026 USTB route record" })),
    ],
    archives: [
      { entityType: "program", id: preflight.archivePrograms[0].id, slug: "university-of-science-and-technology-beijing-construction-management", reason: "the official undergraduate catalog calls this major Engineering Management (工程管理); archive the mistranslated duplicate alias after publishing the canonical route" },
      { entityType: "scholarship", id: preflight.archiveScholarships[0].id, slug: "university-of-science-and-technology-beijing", reason: "replace the unverified merged third-party scholarship placeholder with five independently documented rich official awards" },
    ],
    databaseBaseline: { schoolId: preflight.school[0].id, cityId: preflight.city[0].id, stableProgramIds: preflight.overlappingPrograms.map((row: any) => row.id) },
  },
  coverageLimitations: [
    "The official tables publish academic majors and route-level tuition/language rules, but not a separate per-major application deadline; all route intakes therefore use the degree-level 2026 application window.",
    "Doctoral majors are emitted as separate Chinese and English routes because the official guide states every doctoral major can be taught in English; course-level English descriptions are not inferred.",
    "The Beijing Government Scholarship notice publishes A/B/C tiers but not exact monetary amounts, so the record states the published coverage categories without inventing amounts.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "publication candidate", note: "The candidate contains only public institutional, program, admissions and scholarship-policy fields. Applicant data, result lists, staff names, direct personal contacts, accounts and payments are excluded. Incidental public contact names present in a raw official page are not imported." },
  visualReview: { result: "pass", artifact: "USTB 2026 official HTML program and scholarship tables", note: "The degree catalogs and scholarship sections render as structured HTML tables/text; route counts, language flags, fees, deadlines, degree scope, benefits, eligibility, materials and processes were checked against the official page layout." },
  reviewNotes: [
    "Standing default publication covers the 145 new program routes and five new scholarship records, but the complete atomic batch also overwrites one city, one school and 11 stable program records and archives two misleading legacy rows; exact approval is therefore required.",
    "The 156 routes comprise 52 bachelor, 54 master and 50 doctoral routes, explicitly separating Chinese and English offerings instead of merging distinct admissions paths.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, requiredApproval: `批准发布北京科技大学学校、项目与奖学金完整第一批（审核哈希 ${reviewHash}），覆盖北京城市、北京科技大学学校及 11 条项目旧的未验证字段，并归档 1 条错误项目别名及 1 条旧奖学金合并概览` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval: review.requiredApproval, scope: reviewBase.scope, paths }, null, 2));
