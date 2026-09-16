import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  complete: resolve(root, "seeds/catalog.ustc-complete-batch-01.draft.json"),
  manifest: resolve(root, process.env.CUAC_USTC_MANIFEST || "work/catalog-official/ustc-current-complete-20260914-v2/manifest.json"),
  safeApproval: resolve(root, "seeds/catalog.ustc-safe-new-batch-01.approval.json"),
  safePublication: resolve(root, "seeds/catalog.ustc-safe-new-batch-01.approved.local.json"),
  candidate: resolve(root, "seeds/catalog.ustc-cleanup.draft.json"),
  validation: resolve(root, "seeds/catalog.ustc-cleanup.validation.json"),
  review: resolve(root, "seeds/catalog.ustc-cleanup.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [completeText, manifestText, safeApprovalText, safePublicationText, stateText] = await Promise.all([
  readFile(paths.complete, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.safeApproval, "utf8"), readFile(paths.safePublication, "utf8"), readFile(paths.state, "utf8"),
]);
const complete = JSON.parse(completeText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText);
const safeApproval = JSON.parse(safeApprovalText);
const safePublication = JSON.parse(safePublicationText) as CatalogSeedBundle;
const state = JSON.parse(stateText);
const schoolSlug = "university-of-science-and-technology-of-china";
if (complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || safePublication.cities?.length !== 1 || safeApproval.programSlugs?.length !== 287 || safeApproval.scholarshipSlugs?.length !== 5) throw new Error("USTC cleanup dependencies changed.");
if (manifest.sources?.length !== 15 || manifest.sources.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("USTC current official evidence manifest changed.");
const schoolSource = manifest.sources.find((row: any) => row.id === "ustc-undergraduate-guide-2026");
if (!schoolSource || complete.schools[0].sourceUrl !== schoolSource.finalUrl || complete.schools[0].sourceSha256 !== schoolSource.sha256) throw new Error("USTC school candidate is not bound to the current official undergraduate guide snapshot.");

const candidateRaw: CatalogSeedBundle = { version: 1, generatedAt: new Date().toISOString(), cities: safePublication.cities, schools: complete.schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidateRaw, null, 2)}\n`;
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Invalid USTC cleanup candidate: ${validation.errors.join(" ")}`);

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ustc-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,status,verification_status,source_url from schools where slug=$1", [schoolSlug]);
  const programs = await pool.query("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active'", [school.rows[0]?.id]);
  const scholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const newScholarships = await pool.query("select count(*)::text count from scholarships where slug=any($1::text[]) and status='active' and verification_status='verified'", [safeApproval.scholarshipSlugs]);
  baseline = { school: school.rows, programs: programs.rows, scholarships: scholarships.rows, newScholarships: newScholarships.rows };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || programs.rows[0]?.active_count !== "287" || programs.rows[0]?.verified_count !== "287" || scholarships.rows.length !== 8 || newScholarships.rows[0]?.count !== "5") throw new Error(`USTC cleanup baseline changed: ${JSON.stringify(baseline)}`);
  const legacy = scholarships.rows.filter((row: any) => !safeApproval.scholarshipSlugs.includes(row.slug));
  if (legacy.length !== 3 || legacy.some((row: any) => row.verification_status !== "unverified")) throw new Error("USTC legacy scholarship set changed.");
} finally { await pool.end(); }

const legacy = baseline.scholarships.filter((row: any) => !safeApproval.scholarshipSlugs.includes(row.slug));
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolOverwriteCount: 1, archiveScholarshipAliasCount: 3, insertCount: 0, programMutationCount: 0, verifiedScholarshipMutationCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  safePublicationEvidence: { approvalSha256: sha(safeApprovalText), publicationSha256: sha(safePublicationText), officialManifestSha256: sha(manifestText), officialSourceCount: manifest.sources.length, verifiedProgramCount: 287, verifiedOfficialScholarshipCount: 5 },
  evidence: manifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  reconciliation: {
    destructiveDeletion: false,
    overwrite: { entityType: "school", id: baseline.school[0].id, slug: schoolSlug, reason: "Replace the active unverified third-party school profile with the reviewed 2026 USTC official admissions profile." },
    archives: legacy.map((row: any) => ({ entityType: "scholarship", id: row.id, slug: row.slug, reason: "Superseded by five independently scoped verified official 2026 scholarship records." })),
    databaseBaseline: { schoolId: baseline.school[0].id, legacyScholarshipIds: legacy.map((row: any) => row.id) },
  },
  sensitiveDataCheck: { result: "pass", scope: "school profile and three archive status changes", note: "Public institutional catalog data only; no applicant, account, payment or personal-contact data is included." },
  reviewNotes: ["No program, intake or verified scholarship will be changed.", "The three legacy scholarships are status-archived, not physically deleted.", "After publication, USTC will have a verified school, 287/287 verified programs and 5/5 active verified scholarships."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准完成中国科学技术大学官方学校资料并归档 3 条旧奖学金（审核哈希 ${reviewHash}）`;
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, paths }, null, 2));
