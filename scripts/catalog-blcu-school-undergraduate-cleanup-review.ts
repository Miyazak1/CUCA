import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const prefix = "catalog.blcu-school-undergraduate-cleanup", sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8"), candidate = JSON.parse(candidateText), validation = JSON.parse(await readFile(`seeds/${prefix}.validation.json`, "utf8")), fresh = createCatalogMigrationValidationReport(candidate), state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || candidate.programs.length !== 13 || candidate.programIntakes.length !== 22) throw new Error("BLCU cleanup candidate changed.");
const stableSlugs = candidate.programs.slice(0, 11).map((row: any) => row.slug), newSlugs = candidate.programs.slice(11).map((row: any) => row.slug);
const archiveProgramSlugs = ["beijing-language-and-culture-university-chinese-language-artificial-intelligence-dual-degree", "beijing-language-and-culture-university-international-economics-and-trade-52", "beijing-language-and-culture-university-translation-localization"];
const archiveScholarshipSlugs = ["beijing-language-and-culture-university-2026", "beijing-language-and-culture-university-2026-8"];
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:blcu-school-undergraduate-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url from schools where slug='beijing-language-and-culture-university'");
  const stable = await pool.query("select id,slug,name_en,name_zh,status,verification_status from programs where slug=any($1::text[]) order by slug", [stableSlugs]);
  const freshSlugs = await pool.query("select id,slug from programs where slug=any($1::text[])", [newSlugs]);
  const programArchives = await pool.query("select id,slug,name_en,status,verification_status from programs where slug=any($1::text[]) order by slug", [archiveProgramSlugs]);
  const scholarshipArchives = await pool.query("select id,slug,title,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [archiveScholarshipSlugs]);
  const totals = await pool.query("select count(*)::text programs,count(*) filter(where verification_status='verified')::text verified,count(*) filter(where verification_status<>'verified')::text legacy,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships from programs where school_id=$1 and status='active'", [school.rows[0]?.id]);
  baseline = { school: school.rows[0], stablePrograms: stable.rows, newProgramConflicts: freshSlugs.rows, programArchives: programArchives.rows, scholarshipArchives: scholarshipArchives.rows, totals: totals.rows[0] };
  if (school.rows.length !== 1 || school.rows[0].verification_status !== "unverified" || stable.rows.length !== 11 || stable.rows.some((row: any) => row.status !== "active" || row.verification_status === "verified") || freshSlugs.rows.length !== 0 || programArchives.rows.length !== 3 || programArchives.rows.some((row: any) => row.status !== "active" || row.verification_status === "verified") || scholarshipArchives.rows.length !== 2 || scholarshipArchives.rows.some((row: any) => row.status !== "active" || row.verification_status === "verified") || totals.rows[0].programs !== "110" || totals.rows[0].verified !== "96" || totals.rows[0].legacy !== "14" || totals.rows[0].intakes !== "106" || totals.rows[0].scholarships !== "9" || totals.rows[0].verified_scholarships !== "4") throw new Error(`BLCU cleanup baseline changed: ${JSON.stringify(baseline)}`);
} finally { await pool.end(); }

const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "beijing-language-and-culture-university", schoolOverwriteCount: 1, stableProgramOverwriteCount: 11, newProgramCount: 2, programIntakeUpsertCount: 22, archiveProgramCount: 3, archiveScholarshipCount: 2, deleteCount: 0 },
  candidateSha256: sha(candidateText), bundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  evidence: { sourceId: "blcu-undergraduate-programs-pdf-2026", sourceUrl: candidate.schools[0].sourceUrl, sourceLabel: candidate.schools[0].sourceLabel, sha256: candidate.schools[0].sourceSha256, capturedAt: candidate.schools[0].capturedAt, pagesReviewed: 2 },
  visualReview: { result: "pass", pagesReviewed: [1, 2], note: "Both official PDF pages were rendered at 180 DPI and inspected in full. The reviewed fields are legible in the dual-degree, independent, same-cohort, standard undergraduate, English-taught, associate and registration sections." },
  reconciliation: { destructiveDeletion: false, baseline, stableProgramSlugs: stableSlugs, newProgramSlugs: newSlugs, archiveProgramSlugs, archiveScholarshipSlugs, unsupportedSchoolFieldsToClear: ["language_requirement", "hsk_requirement", "english_requirement", "csca_required", "csca_requirement", "csca_subjects", "subject_tags", "language_tags", "contact_notes"] },
  corrections: ["The legacy combined Chinese Language + Artificial Intelligence record is replaced by two separate official BLCU-USTB dual-degree directions.", "The Beijing-Nara label is corrected to the official BLCU Beijing / BLCU Tokyo cultivation arrangement.", "Chinese Characters and Chinese Studies is corrected to Chinese Studies / 汉学与中国学.", "One duplicate International Economics and Trade record and the absent Localization route are archived.", "The old Silk Road duplicate and the misclassified 2026 spring program-list scholarship are archived."],
  postconditions: { activePrograms: 109, verifiedPrograms: 109, legacyPrograms: 0, programIntakes: 128, activeScholarships: 7, verifiedScholarships: 4, archivedProgramsAdded: 3, archivedScholarshipsAdded: 2, schoolVerificationStatus: "verified" },
  sensitiveDataCheck: { result: "pass", scope: "school profile, 13 program rows, 22 intake rows and five recoverable status archives", note: "Institutional email and telephone in the PDF are excluded. Applicant, account, payment, passport, bank, staff-name and personal-contact data are absent." },
  reviewNotes: ["No physical deletion is performed.", "The three remaining unverified BLCU scholarship records are retained because this source does not resolve their current status.", "Unsupported school-level CSCA and language-threshold fields inherited from a third-party record are explicitly cleared rather than presented as official facts."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准发布北京语言大学学校与本科清理批次（审核哈希 ${reviewHash}），覆盖学校及 11 条旧项目，新增 2 条双学位方向，并归档 3 条旧项目及 2 条旧奖学金概览`;
await writeFile(`seeds/${prefix}.review.json`, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, postconditions: reviewBase.postconditions }, null, 2));
