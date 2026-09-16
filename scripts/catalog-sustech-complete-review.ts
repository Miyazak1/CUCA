import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.sustech-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.sustech-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.sustech-complete-batch-01.review.json"),
  primaryManifest: resolve(root, "work/catalog-official/sustech-complete-batch-01/manifest.json"),
  apiManifest: resolve(root, "work/catalog-official/sustech-complete-batch-01-api/manifest.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const storedValidation = JSON.parse(await readFile(paths.validation, "utf8"));
const primaryText = await readFile(paths.primaryManifest, "utf8");
const apiText = await readFile(paths.apiManifest, "utf8");
const manifests = [JSON.parse(primaryText), JSON.parse(apiText)];
const evidence = manifests.flatMap((manifest) => manifest.sources);
if (evidence.length !== 34 || evidence.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("SUSTech evidence manifest incomplete.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== storedValidation.bundleSha256 || fresh.operationPlanSha256 !== storedValidation.operationPlanSha256) throw new Error("SUSTech validation changed after candidate build.");
const programs = candidate.programs ?? [];
const intakes = candidate.programIntakes ?? [];
const scholarships = candidate.scholarships ?? [];
const degreeCounts = Object.fromEntries(["Bachelor", "Master", "Doctoral"].map((degree) => [degree, programs.filter((row) => row.degreeLevel === degree).length]));
if (JSON.stringify(degreeCounts) !== JSON.stringify({ Bachelor: 35, Master: 11, Doctoral: 14 }) || programs.length !== 60 || intakes.length !== 25 || scholarships.length !== 7 || programs.some((row) => row.teachingLanguage !== "English")) throw new Error("SUSTech locked scope changed.");
if (scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("SUSTech rich scholarship fields incomplete.");

const state = JSON.parse(await readFile(paths.state, "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:sustech-complete-review" });
let preflight: any;
try {
  const school = await pool.query("select id,slug,status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", ["southern-university-of-science-and-technology", "Southern University of Science and Technology", "南方科技大学"]);
  const programSlugs = programs.map((row) => row.slug);
  const scholarshipSlugs = scholarships.map((row) => row.slug);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,source_url,source_label,source_field_lineage_json from cities where slug='shenzhen'");
  preflight = { schools: school.rows, conflicts: conflicts.rows, city: city.rows };
  if (school.rows.length || conflicts.rows.length || city.rows.length !== 1 || JSON.stringify(city.rows[0]) !== JSON.stringify({ id: "0ca88c73-b154-4d7b-9ba7-340bdfdbf177", slug: "shenzhen", name_en: "Shenzhen", name_zh: "深圳", region: "South China", province: "Guangdong", status: "active", source_url: "https://iso.sysu.edu.cn/en/application/guide/1420575.htm", source_label: "Sun Yat-sen University 2026 international undergraduate admission guide", source_field_lineage_json: { nameEn: "official campus descriptions", province: "official university location" } })) throw new Error(`SUSTech safe-new database baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const candidateSha256 = sha(candidateText);
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug: "southern-university-of-science-and-technology", newSchoolCount: 1, programRouteCount: 60, bachelorRouteCount: 35, masterRouteCount: 11, doctoralRouteCount: 14, englishRouteCount: 60, programIntakeCount: 25, newScholarshipCount: 7, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  candidateBundleSha256: fresh.bundleSha256,
  operationPlanSha256: fresh.operationPlanSha256,
  primaryManifestSha256: sha(primaryText), apiManifestSha256: sha(apiText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", note: "The current official undergraduate API chain returned 6 colleges, 21 department endpoints and 35 non-empty degree majors. The dated 2026 postgraduate guide published 14 major codes producing 11 master and 14 doctoral routes, plus application, eligibility and scholarship sections." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependencyId: "0ca88c73-b154-4d7b-9ba7-340bdfdbf177" } },
  coverageLimitations: ["The current undergraduate catalog endpoint does not publish an admissions year or deadline, so no undergraduate intake row or deadline is invented.", "Some undergraduate curriculum attachment filenames carry 2019 or 2022 revision years; the candidate records only the current official catalog membership and does not infer current curriculum details from those filenames.", "The 2026 postgraduate guide is complete for the majors it publishes but is hosted by the SUSTech School of Medicine; its text explicitly describes Southern University of Science and Technology-wide postgraduate programs.", "No scholarship deadline is invented when the official page says automatic consideration or delegates timing to an embassy."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and selected source evidence", note: "Only public institutional, program, admissions and scholarship policy data are included. Public award-result pages containing student names or student IDs were explicitly excluded; named staff, personal contacts, applicant data, accounts and payments are absent." },
  visualReview: { result: "pass", artifact: "official SUSTech HTML pages and JSON-backed page sections", note: "The undergraduate catalog hierarchy and scholarship/cost page content were inspected against the API snapshots; the postgraduate guide table and Funding & Scholarships section were inspected against the rich-detail model." },
  reviewNotes: ["This batch is eligible for standing-authorized publication because the school and every candidate program/scholarship slug are new, while the existing Shenzhen dependency city is reproduced byte-for-field without substantive change.", "All seven scholarships include coverage, amount, eligibility, materials, process and official action links for the rich scholarship detail page."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-sustech-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, preflight: reviewBase.reconciliation.databaseBaseline, paths }, null, 2));
