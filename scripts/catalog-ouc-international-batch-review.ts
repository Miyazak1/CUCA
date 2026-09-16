import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.ouc-international-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.ouc-international-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.ouc-international-batch-01.review.json"),
  manifest: resolve(root, "work/catalog-official/ouc-complete-batch-01/manifest.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(await readFile(paths.validation, "utf8"));
const manifestText = await readFile(paths.manifest, "utf8");
const manifest = JSON.parse(manifestText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("OUC validation changed after candidate build.");
if (manifest.sources.length !== 16 || manifest.sources.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("OUC evidence manifest incomplete.");
if (candidate.programs?.length !== 10 || candidate.programIntakes?.length !== 10 || candidate.scholarships?.length !== 3) throw new Error("OUC locked scope changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("OUC rich scholarship fields incomplete.");

const state = JSON.parse(await readFile(paths.state, "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ouc-international-review" });
let preflight: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url from schools where slug='ocean-university-of-china'");
  const city = await pool.query("select id,slug,status,verification_status,source_url from cities where slug='qingdao'");
  const stablePrograms = await pool.query("select id,slug,status,verification_status,source_url,tuition_text from programs where slug=any($1::text[]) order by slug", [["ocean-university-of-china-computer-science-and-technology", "ocean-university-of-china-international-economics-and-trade"]]);
  const archivePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug='ocean-university-of-china-business-management'");
  const archiveScholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where slug='ocean-university-of-china'");
  const newSlugs = (candidate.programs ?? []).map((row) => row.slug).filter((slug) => !["ocean-university-of-china-computer-science-and-technology", "ocean-university-of-china-international-economics-and-trade"].includes(slug));
  const newConflicts = await pool.query("select slug from programs where slug=any($1::text[]) union all select slug from scholarships where slug=any($2::text[])", [newSlugs, (candidate.scholarships ?? []).map((row) => row.slug)]);
  preflight = { school: school.rows, city: city.rows, stablePrograms: stablePrograms.rows, archivePrograms: archivePrograms.rows, archiveScholarships: archiveScholarships.rows, newConflicts: newConflicts.rows };
  if (school.rows.length !== 1 || city.rows.length !== 1 || stablePrograms.rows.length !== 2 || archivePrograms.rows.length !== 1 || archiveScholarships.rows.length !== 1 || newConflicts.rows.length) throw new Error(`OUC database baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const reviewBase = {
  version: 1,
  status: "requires_explicit_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "ocean-university-of-china", cityOverwriteCount: 1, schoolOverwriteCount: 1, programRouteCount: 10, bachelorRouteCount: 4, masterRouteCount: 6, programIntakeCount: 10, newProgramCount: 8, stableProgramOverwriteCount: 2, newScholarshipCount: 3, archiveProgramAliasCount: 1, archiveScholarshipAliasCount: 1 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, manifestSha256: sha(manifestText),
  evidence: manifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass_with_documented_gap", note: "Sixteen exact official OUC pages/PDFs were captured. Program-table structure was visually verified across the undergraduate, doctoral and postgraduate sections. The separate 2026 full admission-guide PDF repeatedly terminated at about 34 MB, so no field depends on that unavailable file." },
  reconciliation: {
    destructiveDeletion: false,
    overwrites: [
      { entityType: "city", slug: "qingdao", reason: "replace unverified third-party city provenance with current OUC official address and region evidence" },
      { entityType: "school", slug: "ocean-university-of-china", reason: "replace unverified third-party school provenance and correct official 2026 admissions fields" },
      { entityType: "program", slug: "ocean-university-of-china-computer-science-and-technology", reason: "official fee is CNY 8,000/year, replacing unverified CNY 23,000/year" },
      { entityType: "program", slug: "ocean-university-of-china-international-economics-and-trade", reason: "official fee is CNY 8,000/year, replacing unverified CNY 23,000/year" },
    ],
    archives: [
      { entityType: "program", id: preflight.archivePrograms[0].id, slug: "ocean-university-of-china-business-management", reason: "official English undergraduate route is Tourism Management, not Business Management" },
      { entityType: "scholarship", id: preflight.archiveScholarships[0].id, slug: "ocean-university-of-china", reason: "replace generic unverified merged placeholder with three independently documented rich awards" },
    ],
    databaseBaseline: { schoolId: preflight.school[0].id, cityId: preflight.city[0].id, stableProgramIds: preflight.stablePrograms.map((row: any) => row.id) },
  },
  coverageLimitations: [
    "This first OUC batch locks the 10 English international programs whose language, duration and tuition are explicitly published; the broader official undergraduate, doctoral and postgraduate program tables are retained for a later structured route batch.",
    "The 2026 admission-guide PDF could not be fully collected after two bounded attempts because the official server closed the connection; the batch does not infer any field from the partial transfer.",
    "The Marine Scholarship page points readers to the High-Level Graduate Scholarship guide but does not publish independent route details, so it is not yet emitted as a separate rich award.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and 16 official snapshots", note: "Only public institutional, program, admissions and scholarship-policy data are included. Award-result notices, student names/IDs, staff direct contacts, applicant records, accounts and payments are excluded." },
  visualReview: { result: "pass", artifact: "OUC English undergraduate brochure and two-page 2026 program table", note: "All six image-only undergraduate brochure pages and both program-table pages were rendered and inspected; the 10 selected route names, degree types, durations, tuition values and language match the official layout." },
  reviewNotes: [
    "Standing default publication does not apply because this batch overwrites a city, a school and two material program fields, and archives two misleading legacy records.",
    "All three scholarship candidates include funding, eligibility, benefits, materials, process, deadline and official action links.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, requiredApproval: `批准发布中国海洋大学英文国际项目与奖学金第一批（审核哈希 ${reviewHash}），覆盖青岛城市、中国海洋大学学校及 2 条项目旧的未验证第三方字段，并归档 1 条错误项目别名及 1 条旧奖学金合并概览` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval: review.requiredApproval, scope: reviewBase.scope, paths }, null, 2));
