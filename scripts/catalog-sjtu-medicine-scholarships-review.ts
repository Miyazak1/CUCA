import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "sjtu-medicine-scholarships-batch-01";
const schoolSlug = "shanghai-jiao-tong-university-school-of-medicine";
const dependencyPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.approved.local.json");
const manifestDefinitions = [
  ["sjtu-medicine-scholarship-index-2026", "work/catalog-official/2026-09-14T05-48-20-299Z/manifest.json", "13d0b9baea0005771ca54d2ee687af5f151aa08194bc382eef168d2aafd2457b"],
  ["sjtu-medicine-shanghai-government-scholarship-2026", "work/catalog-official/2026-09-14T05-48-20-804Z/manifest.json", "c1152a7eb14739ac159e38eb24f6b646699a8f2a0b2f479f87566bcc60bfd35b"],
  ["sjtu-medicine-cgs-university-program-2026", "work/catalog-official/2026-09-14T05-48-21-227Z/manifest.json", "3c0a083d00fea0ca36730c8594a29315afef5350352fb6c9e77d4f93d6b4022a"],
  ["sjtu-medicine-cgs-bilateral-program-2026", "work/catalog-official/2026-09-14T05-48-21-655Z/manifest.json", "f445902bef39467e10fe8f3d4f8fcf8f8f9e9b55d5f810d4186493d277dd27a3"],
] as const;
const paths = {
  candidate: resolve(root, `seeds/catalog.${batch}.draft.json`),
  validation: resolve(root, `seeds/catalog.${batch}.validation.json`),
  review: resolve(root, `seeds/catalog.${batch}.review.json`),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const evidence = new Map<string, any>();
for (const [sourceId, manifestPath, expectedSha] of manifestDefinitions) {
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), "utf8"));
  const source = manifest.sources?.find((item: any) => item.id === sourceId);
  if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha || source.finalUrl !== source.url || source.byteLength > 15 * 1024 * 1024) {
    throw new Error(`Reviewed SJTUSM source missing, changed, redirected or oversized: ${sourceId}`);
  }
  evidence.set(sourceId, source);
}
const dependency = JSON.parse(await readFile(dependencyPath, "utf8"));
if (dependency.schools?.length !== 1 || dependency.schools[0]?.slug !== schoolSlug || dependency.programs?.length !== 3 || dependency.scholarships?.length !== 0) throw new Error("SJTUSM dependency bundle changed.");
const list = (values: string[]) => values.map(label => ({ label }));
const benefits = (values: Array<string | [string, string]>) => values.map(value => Array.isArray(value) ? ({ label: value[0], included: true, note: value[1] }) : ({ label: value, included: true }));
const steps = (values: string[]) => values.map((body, index) => ({ label: `Step ${index + 1}`, body }));
type Input = {
  sourceId: string; slug: string; title: string; nameZh: string; type: string; typeLabel: string; fundingLevel: string;
  providerName: string; providerNameEn: string; coverage: string; applicableDegree: string; applicableProgram: string;
  amountText: string; benefitItems: Array<string | [string, string]>; eligibility: string[]; materials: string[]; applicationSteps: string[];
  deadlineDate?: string; deadlineLabel: string; applicationRound: string; actionLinks?: Array<{ label: string; url: string; kind: string }>; sortOrder: number;
};
function make(input: Input): CatalogSeedScholarship {
  const source = evidence.get(input.sourceId);
  const summary = `${input.title} is a distinct official scholarship route published by Shanghai Jiao Tong University School of Medicine. Coverage, eligibility and application routing are shown only to the level stated on the reviewed source.`;
  const record: any = {
    schoolSlug, slug: input.slug, title: input.title, nameZh: input.nameZh, type: input.type, typeLabel: input.typeLabel,
    fundingLevel: input.fundingLevel, providerName: input.providerName, providerNameEn: input.providerNameEn,
    providerLocation: "Shanghai, China", coverage: input.coverage, applicableDegree: input.applicableDegree,
    applicableProgram: input.applicableProgram, amountText: input.amountText, requirementText: input.eligibility.join("; "),
    bodySections: [{ title: "Scholarship overview", body: summary }, { title: "Important application notes", items: input.applicationSteps }],
    benefitItems: benefits(input.benefitItems), eligibilityItems: list(input.eligibility), applicationMaterials: list(input.materials),
    applicationSteps: steps(input.applicationSteps), actionLinks: [{ label: "Official SJTUSM scholarship page", url: source.finalUrl, kind: "official-source" }, ...(input.actionLinks ?? [])],
    deadlineDate: input.deadlineDate, deadlineLabel: input.deadlineLabel, applicationRound: input.applicationRound,
    targetCountries: [], targetRegions: [], benefits: input.benefitItems.map(value => Array.isArray(value) ? `${value[0]}: ${value[1]}` : value),
    tags: ["2026", input.typeLabel], summary, sortOrder: input.sortOrder, status: "draft",
    sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  };
  const sourceFieldLineage = Object.fromEntries(Object.keys(record).filter(key => record[key] !== undefined && !["status", "sourceUrl", "sourceLabel", "sourceSha256", "capturedAt"].includes(key)).map(key => [key, `explicit or normalized from ${input.sourceId} ${source.sha256}`]));
  return { ...record, sourceFieldLineage };
}
const scholarships: CatalogSeedScholarship[] = [
  make({
    sourceId: "sjtu-medicine-shanghai-government-scholarship-2026", slug: "official-2026-sjtu-medicine-shanghai-government-scholarship",
    title: "SJTUSM 2026 Shanghai Government Scholarship", nameZh: "上海市外国留学生政府奖学金", type: "local-government", typeLabel: "Shanghai Government Scholarship", fundingLevel: "Full or partial",
    providerName: "上海市人民政府", providerNameEn: "Shanghai Municipal Government", coverage: "Class A covers tuition, accommodation, a monthly stipend and medical insurance; Class B covers tuition and medical insurance.",
    applicableDegree: "Preparatory, Bachelor, Master, Doctoral", applicableProgram: "Eligible Shanghai Jiao Tong University School of Medicine international programs",
    amountText: "Class A stipend: RMB 2,500/month for bachelor's, RMB 3,000/month for master's and RMB 3,500/month for doctoral study; insurance RMB 800/academic year. Class B includes tuition and RMB 800/academic-year insurance.",
    benefitItems: [["Class A tuition", "Covered for the normal study period"], ["Class A accommodation", "Covered for the normal study period"], ["Class A living stipend", "RMB 2,500/month bachelor's; RMB 3,000/month master's; RMB 3,500/month doctoral"], ["Class A medical insurance", "RMB 800/academic year"], ["Class B tuition", "Covered for the normal study period"], ["Class B medical insurance", "RMB 800/academic year"]],
    eligibility: ["Non-Chinese citizen in good health", "Bachelor applicant: high-school graduate and no older than 25", "Master applicant: bachelor's degree and no older than 35", "Doctoral applicant: master's degree, required academic level and no older than 40", "Excellent academic performance", "Meets the selected SJTUSM program's language and other requirements", "Does not concurrently hold another Chinese Government Scholarship"],
    materials: ["All admission materials required by the applicable SJTUSM program guide", "Shanghai Government Scholarship application completed through Study Shanghai"],
    applicationSteps: ["Complete the applicable SJTUSM international admission application", "Select Shanghai Jiao Tong University School of Medicine and complete the scholarship application on Study Shanghai", "Await merit review after admission", "Recipients complete the annual scholarship review to retain support"],
    deadlineDate: "2026-07-31", deadlineLabel: "January 1 - July 31, 2026", applicationRound: "2026 Shanghai Government Scholarship",
    actionLinks: [{ label: "Study Shanghai scholarship portal", url: "https://www.study-shanghai.cn/", kind: "official-application" }], sortOrder: 300,
  }),
  make({
    sourceId: "sjtu-medicine-cgs-university-program-2026", slug: "official-2026-sjtu-medicine-cgs-university-program-type-b",
    title: "SJTUSM 2026 Chinese Government Scholarship — University Program (Type B)", nameZh: "中国政府奖学金—中国高校自主招生项目（B类）", type: "government", typeLabel: "Chinese Government Scholarship Type B", fundingLevel: "Full",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", coverage: "Application fee, tuition, accommodation, living allowance and comprehensive medical insurance.",
    applicableDegree: "Master, Doctoral", applicableProgram: "Eligible full-time SJTUSM international graduate medical programs",
    amountText: "Full scholarship covering application fee, tuition, accommodation, living allowance and comprehensive medical insurance; fixed amounts are not stated on the reviewed SJTUSM page.",
    benefitItems: ["Application fee", "Tuition", "Accommodation", "Living allowance", "Comprehensive medical insurance"],
    eligibility: ["Meets the 2026 SJTUSM international graduate program admission requirements", "Does not receive any other scholarship", "Master applicant no older than 35", "Doctoral applicant no older than 40"],
    materials: ["Chinese Government Scholarship application form generated by the CSC system", "All application materials required by the applicable 2026 SJTUSM international graduate guide"],
    applicationSteps: ["Complete the CSC online application as Type B using Shanghai Jiao Tong University agency number 10248", "Download the Chinese Government Scholarship application form", "Complete the SJTUSM international student application and upload all required materials, including the CSC form", "Qualified applicants complete the school and academic-department review, including video interview where required", "CSC performs final approval after SJTUSM nomination"],
    deadlineLabel: "Deadline not stated on the reviewed SJTUSM scholarship page; follow the applicable 2026 graduate admission guide", applicationRound: "2026 Chinese Government Scholarship University Program",
    actionLinks: [{ label: "Campus China scholarship system", url: "https://www.campuschina.org/", kind: "official-application" }], sortOrder: 310,
  }),
  make({
    sourceId: "sjtu-medicine-cgs-bilateral-program-2026", slug: "official-2026-sjtu-medicine-cgs-bilateral-program-type-a",
    title: "SJTUSM 2026 Chinese Government Scholarship — Bilateral Program (Type A)", nameZh: "中国政府奖学金—国别双边项目（A类）", type: "government", typeLabel: "Chinese Government Scholarship Type A", fundingLevel: "Full or partial",
    providerName: "国家留学基金管理委员会 / 各国留学生派遣部门", providerNameEn: "China Scholarship Council / Home-country dispatching authorities", coverage: "Full or partial scholarship according to the applicable bilateral agreement; specific components are not stated on the reviewed SJTUSM page.",
    applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "Eligible SJTUSM degree or scholar route accepted under the applicant's bilateral channel",
    amountText: "Full or partial award; exact coverage and amounts are determined by the bilateral agreement and dispatching authority and are not stated on the reviewed page.",
    benefitItems: [["Bilateral scholarship award", "Full or partial; confirm exact components with the home-country dispatching authority"]],
    eligibility: ["Applicant is eligible under a bilateral education agreement or exchange arrangement", "Application and nomination are handled by the home-country dispatching authority or relevant Chinese diplomatic mission", "SJTUSM does not directly accept the scholarship application"],
    materials: ["Materials required by the home-country dispatching authority and CSC", "SJTUSM admission materials when applying for a pre-admission notice"],
    applicationSteps: ["Apply through the home-country dispatching authority or relevant Chinese diplomatic mission", "List Shanghai Jiao Tong University as a preferred institution in the CSC application", "Confirm the country-specific deadline and required materials with the dispatching authority", "Optionally complete the SJTUSM international application for a pre-admission notice", "Receive final admission documents through the scholarship receiving authority"],
    deadlineLabel: "Generally early January to early April; confirm the exact deadline with the home-country dispatching authority", applicationRound: "2026 Chinese Government Scholarship Bilateral Program",
    actionLinks: [{ label: "Official CSC Bilateral Program guide", url: "https://www.campuschina.org/zh/content/details1003_122937.html", kind: "official-source" }], sortOrder: 320,
  }),
];
const scholarshipSlugs = scholarships.map(item => item.slug);
if (new Set(scholarshipSlugs).size !== 3 || scholarships.some(item => !item.benefitItems?.length || !item.eligibilityItems?.length || !item.applicationMaterials?.length || !item.applicationSteps?.length || !item.actionLinks?.length)) throw new Error("SJTUSM rich scholarship scope is incomplete.");
const state = JSON.parse(await readFile(paths.state, "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:sjtu-medicine-scholarships-review" });
let baseline: any;
try {
  const school = await pool.query(`select s.id,s.status,s.verification_status,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from programs p where p.school_id=s.id and p.status='active' and p.verification_status='verified')::int verified_programs,(select count(*) from scholarships h where h.school_id=s.id and h.status='active')::int scholarships from schools s where s.slug=$1`, [schoolSlug]);
  const conflicts = await pool.query("select slug,status,verification_status from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
  baseline = { school: school.rows[0], conflicts: conflicts.rows };
  if (school.rows.length !== 1 || baseline.school.status !== "active" || baseline.school.verification_status !== "verified" || baseline.school.programs !== 3 || baseline.school.verified_programs !== 3 || baseline.school.scholarships !== 0 || conflicts.rows.length !== 0) throw new Error("SJTUSM safe-new database baseline changed.");
} finally { await pool.end(); }
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: evidence.get("sjtu-medicine-cgs-bilateral-program-2026").fetchedAt,
  cities: dependency.cities.map((item: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = item; return { ...rest, status: "draft" }; }),
  schools: dependency.schools.map((item: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = item; return { ...rest, status: "draft" }; }),
  programs: [], programIntakes: [], scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const serializedCandidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(serializedCandidate);
if (!validation.ok) throw new Error(`SJTUSM scholarship validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newScholarshipCount: 3, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: manifestDefinitions.map(([sourceId]) => { const source = evidence.get(sourceId); return { sourceId, sourceUrl: source.finalUrl, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType, byteLength: source.byteLength }; }),
  standingAuthorization: { reference: "user-chat-default-publication", instruction: "发布默认允许", appliesBecause: "Three new reviewed official scholarship routes are inserted; no school, program, intake or existing scholarship is overwritten, archived or deleted." },
  sourceReview: { result: "pass", note: "The current 2026 scholarship index and three route pages were collected from registered SJTUSM URLs. Each route is modeled separately and unresolved amounts or deadlines remain explicitly unresolved." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: baseline },
  coverageLimitations: ["The University Program page does not state a scholarship deadline or fixed allowance amounts.", "The Bilateral Program page does not state exact coverage components or country-specific deadlines.", "Application-material lists are not expanded beyond what the reviewed scholarship pages explicitly state."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional scholarship policy is included. Contact names, telephone numbers, email addresses, street addresses, applicant data, account data, payment data and bank data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, limitations: reviewBase.coverageLimitations, paths }, null, 2));
