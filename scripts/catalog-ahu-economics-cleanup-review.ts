import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const prefix = "catalog.ahu-economics-cleanup", sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8"), candidate = JSON.parse(candidateText), validation = JSON.parse(await readFile(`seeds/${prefix}.validation.json`, "utf8")), state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8")), fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || candidate.programs.length !== 1 || candidate.programIntakes.length !== 0) throw new Error("AHU Economics candidate changed.");
const oldProgramSlugs = ["anhui-university-economics", "anhui-university-economics-3"];
const oldScholarshipSlug = "anhui-university";
const newProgramSlug = candidate.programs[0].slug;
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ahu-economics-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug='anhui-university'");
  const programs = await pool.query("select id,slug,name_en,name_zh,degree_level,status,verification_status from programs where slug=any($1::text[]) order by slug", [oldProgramSlugs]);
  const newConflict = await pool.query("select id,slug,status from programs where slug=$1", [newProgramSlug]);
  const scholarship = await pool.query("select id,slug,title,status,verification_status from scholarships where slug=$1", [oldScholarshipSlug]);
  const totals = await pool.query("select count(*) filter(where status='active')::text programs,count(*) filter(where status='active' and verification_status='verified')::text verified_programs,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships from programs where school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows[0], programs: programs.rows, newProgramConflict: newConflict.rows, scholarship: scholarship.rows[0], totals: totals.rows[0] };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || programs.rows.length !== 2 || programs.rows.some((row: any) => row.status !== "active" || row.verification_status === "verified" || row.name_en !== "Economics") || newConflict.rows.length !== 0 || scholarship.rows.length !== 1 || scholarship.rows[0].status !== "active" || scholarship.rows[0].verification_status === "verified" || totals.rows[0].programs !== "170" || totals.rows[0].verified_programs !== "168" || totals.rows[0].scholarships !== "2" || totals.rows[0].verified_scholarships !== "1") throw new Error(`AHU cleanup baseline changed: ${JSON.stringify(baseline)}`);
} finally { await pool.end(); }

const programManifest = JSON.parse(await readFile("work/catalog-official/ahu-programs-batch-01/manifest.json", "utf8"));
const scholarshipManifest = JSON.parse(await readFile("work/catalog-official/ahu-scholarship-batch-01/manifest.json", "utf8"));
const programSource = programManifest.sources.find((row: any) => row.id === "ahu-undergraduate-programs-current");
const scholarshipSource = scholarshipManifest.sources.find((row: any) => row.id === "ahu-cgs-university-program-2026");
if (!programSource || !scholarshipSource) throw new Error("AHU cleanup evidence manifest changed.");
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: new Date().toISOString(),
  scope: { schoolSlug: "anhui-university", newOfficialProgramCount: 1, archiveProgramAliasCount: 2, archiveScholarshipAliasCount: 1, overwriteCount: 0, deleteCount: 0 },
  candidateSha256: sha(candidateText), bundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  evidence: [
    { sourceId: programSource.id, sourceUrl: programSource.url, sha256: programSource.sha256, capturedAt: programSource.fetchedAt, locator: "PDF page 1, program row 27 / extracted table row 28" },
    { sourceId: scholarshipSource.id, sourceUrl: scholarshipSource.url, sha256: scholarshipSource.sha256, capturedAt: scholarshipSource.fetchedAt, locator: "2026/2027 AHU CGS University Program brochure" },
  ],
  visualReview: { result: "pass", pagesReviewed: { undergraduatePrograms: [1], scholarshipBrochure: [1,2,3,4,5,6,7,8,9,10] }, note: "The AHU undergraduate PDF explicitly lists one Economics / 经济学 route under Economy / 经济学院. The separate scholarship review already inspected all 10 pages before publishing its verified replacement." },
  reconciliation: { destructiveDeletion: false, baseline, newProgramSlug, archiveProgramSlugs: oldProgramSlugs, archiveScholarshipSlugs: [oldScholarshipSlug] },
  sensitiveDataCheck: { result: "pass", scope: "one official program insert and three recoverable archives", note: "No applicant, passport, payment, account, bank or personal-contact data is included." },
  reviewNotes: ["Two unverified duplicate Economics aliases are replaced by one visually confirmed official route.", "The unverified merged scholarship overview is superseded by the separately scoped verified 2026/2027 AHU CGS record.", "All three removals are status archives, not physical deletions."],
  postconditions: { activePrograms: 169, verifiedPrograms: 169, activeScholarships: 1, verifiedScholarships: 1, archivedProgramAliases: 2, archivedScholarshipAliases: 1 },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准发布安徽大学 Economics 官方项目并清理旧数据（审核哈希 ${reviewHash}），归档 2 条重复旧项目及 1 条旧奖学金合并概览`;
await writeFile(`seeds/${prefix}.review.json`, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, postconditions: reviewBase.postconditions }, null, 2));
