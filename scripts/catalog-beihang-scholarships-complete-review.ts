import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.review.json"),
  manifest: resolve(root, "work/catalog-official/beihang-scholarships-complete-batch-01/manifest.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(validationText);
const manifest = JSON.parse(manifestText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("Beihang scholarship validation changed after build.");
if (manifest.sources?.length !== 8 || manifest.sources.some((row: any) => row.status !== 200 || !/^https:\/\/is\.buaa\.edu\.cn\//.test(row.finalUrl) || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("Beihang scholarship evidence manifest is incomplete.");
if (candidate.cities?.length !== 2 || candidate.schools?.length !== 1 || candidate.schools[0]?.slug !== "beihang-university" || candidate.scholarships?.length !== 10) throw new Error("Beihang scholarship candidate scope changed.");
if (candidate.scholarships.some((row) => row.status !== "draft" || !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("Beihang rich scholarship candidate is incomplete.");

const state = JSON.parse(stateText);
const candidateSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:beihang-scholarships-complete-review" });
let baseline: any;
try {
  const school = await pool.query(`select id, slug, status, verification_status, source_url from schools where slug='beihang-university'`);
  const programs = await pool.query(`select count(*)::text active_count, count(*) filter (where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active'`, [school.rows[0]?.id]);
  const scholarships = await pool.query(`select id, slug, title, status, verification_status, source_url, last_verified_at from scholarships where school_id=$1 order by slug`, [school.rows[0]?.id]);
  const conflicts = await pool.query(`select slug from scholarships where slug=any($1::text[]) order by slug`, [candidateSlugs]);
  baseline = { school: school.rows, programs: programs.rows, scholarships: scholarships.rows, conflicts: conflicts.rows };
  if (school.rows.length !== 1 || school.rows[0]?.status !== "active" || school.rows[0]?.verification_status !== "verified") throw new Error(`Beihang school baseline changed: ${JSON.stringify(baseline)}`);
  if (programs.rows[0]?.active_count !== "264" || programs.rows[0]?.verified_count !== "264") throw new Error(`Beihang program baseline changed: ${JSON.stringify(baseline)}`);
  if (scholarships.rows.length !== 2 || conflicts.rows.length !== 0) throw new Error(`Beihang scholarship baseline/conflicts changed: ${JSON.stringify(baseline)}`);
  const stable = scholarships.rows.find((row: any) => row.slug === "official-2026-beihang-high-level-postgraduate-scholarship");
  const legacy = scholarships.rows.find((row: any) => row.slug === "beihang-university");
  if (!stable || stable.status !== "active" || stable.verification_status !== "verified" || !/^https:\/\/is\.buaa\.edu\.cn\//.test(stable.source_url)) throw new Error("The verified Beihang high-level postgraduate scholarship changed.");
  if (!legacy || legacy.status !== "active" || legacy.verification_status !== "unverified") throw new Error("The Beihang legacy merged scholarship changed.");
} finally { await pool.end(); }

const legacy = baseline.scholarships.find((row: any) => row.slug === "beihang-university");
const stable = baseline.scholarships.find((row: any) => row.slug === "official-2026-beihang-high-level-postgraduate-scholarship");
const scope = { schoolSlug: "beihang-university", dependencyCityReplayCount: 2, dependencySchoolReplayCount: 1, activeVerifiedProgramCount: 264, stableVerifiedScholarshipCount: 1, newScholarshipCount: 10, archiveScholarshipAliasCount: 1 };
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt, scope,
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, manifestSha256: sha(manifestText),
  evidence: manifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", note: "Eight exact public Beihang official pages were captured without login, recursive crawling, form submission, CAPTCHA handling or access-control bypass. They cover the current bilateral route, five undergraduate routes, two 2026 postgraduate self-supported routes, Belt and Road, Youth of Excellence and the 2026 language-teacher route." },
  reconciliation: {
    destructiveDeletion: false,
    stableScholarship: { id: stable.id, slug: stable.slug, reason: "Preserve the already verified 2026 High-level Postgraduate Program unchanged." },
    archive: { entityType: "scholarship", id: legacy.id, slug: legacy.slug, reason: "Replace the unverified third-party merged overview with ten independently scoped official rich records." },
    databaseBaseline: { schoolId: baseline.school[0].id, stableScholarshipId: stable.id, legacyScholarshipId: legacy.id },
  },
  coverageLimitations: [
    "The bilateral Type A route has no single central deadline, amount or material list because the home-country dispatching authority controls those fields.",
    "The 2026 postgraduate Beijing Government Scholarship notice does not separately publish its monetary package; the record says so instead of borrowing an unsupported amount.",
    "The 2026 International Chinese Language Teachers Scholarship page directs applicants to Beihang for the current coverage standard; no numeric award is invented.",
    "The Youth of Excellence route is stored as one award linked to its three official Beihang program groups, not three duplicate scholarships.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "publication candidate", note: "Only public institutional scholarship policy and application-route data are included. Bank account details, passport instructions that would expose applicant identifiers, named personal contacts, personal email/phone data, and all applicant/result records are excluded. General institutional application URLs are retained." },
  reviewNotes: [
    "All ten candidates contain funding/coverage, degree and program scope, eligibility, materials, application steps, deadlines or an explicit decentralized deadline, and official action links.",
    "The already verified High-level Postgraduate scholarship is preserved unchanged, giving eleven active verified Beihang scholarship routes after publication.",
    "Standing default publication authorizes the ten safe-new records, but archiving the old merged placeholder requires this exact hashed approval.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准发布北京航空航天大学奖学金完整批次（审核哈希 ${reviewHash}），并归档 1 条旧奖学金合并概览`;
await writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope, paths }, null, 2));
