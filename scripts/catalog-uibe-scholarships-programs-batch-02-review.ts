import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "uibe-scholarships-programs-batch-02";
const schoolSlug = "university-of-international-business-and-economics";
const dependencyPath = resolve(root, "seeds/catalog.uibe-school-program-batch-01.approved.local.json");
const manifestDefinitions = [
  ["uibe-silk-road-scholarship-2026", "work/catalog-official/2026-09-14T06-00-52-945Z/manifest.json", "20aa01163d3d3dd229d3b05d550151db6b8c0b07b79a14f1302b0bf8d2984243"],
  ["uibe-youth-excellence-impa-2026", "work/catalog-official/2026-09-14T06-00-53-330Z/manifest.json", "c9caa714c95b512997868373d7c8605c7a9bfe69761066d611f147e8534d7e64"],
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
    throw new Error(`Reviewed UIBE source missing, changed, redirected or oversized: ${sourceId}`);
  }
  const html = await readFile(resolve(root, manifestPath, "..", source.artifactPath), "utf8");
  const required = sourceId === "uibe-silk-road-scholarship-2026"
    ? ["International Business and Cross-border E-commerce", "Public Administration (Custom Management)", "WTO Laws and Economics", "May 25", "tuition, accommodation, living expenses, and insurance"]
    : ["Global Development and Governance", "The program lasts for two years", "One academic year with full scholarship", "March 15", "March 25", "Agency No.: 1563"];
  if (required.some(text => !html.includes(text))) throw new Error(`Reviewed UIBE evidence body changed: ${sourceId}`);
  evidence.set(sourceId, source);
}

const dependency = JSON.parse(await readFile(dependencyPath, "utf8"));
if (dependency.cities?.length !== 1 || dependency.cities[0]?.slug !== "beijing" || dependency.schools?.length !== 1 || dependency.schools[0]?.slug !== schoolSlug) {
  throw new Error("UIBE dependency bundle changed.");
}
const sourceOf = (id: string) => evidence.get(id);
const sourceFields = (sourceId: string, lineage: Record<string, string>) => {
  const source = sourceOf(sourceId);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: lineage };
};
const program = (sourceId: string, row: Omit<CatalogSeedProgram, "schoolSlug" | "citySlug" | "status">): CatalogSeedProgram => ({
  schoolSlug, citySlug: "beijing", status: "draft", ...row,
  ...sourceFields(sourceId, {
    nameEn: `explicit program name in ${sourceId}`,
    degreeLevel: `explicit master's-program context in ${sourceId}`,
    subjectArea: `normalized from the official program name in ${sourceId}`,
    applicationNote: `explicit scholarship-program description and application notice in ${sourceId}`,
    scholarshipText: `explicit scholarship scope in ${sourceId}`,
    ...(row.durationYears ? { durationYears: `explicit duration in ${sourceId}` } : {}),
    ...(row.teachingLanguage ? { teachingLanguage: `explicit language of instruction in ${sourceId}` } : {}),
    ...(row.englishRequirement ? { englishRequirement: `explicit English requirement in ${sourceId}` } : {}),
  }),
});
const programs: CatalogSeedProgram[] = [
  program("uibe-silk-road-scholarship-2026", {
    slug: "uibe-silk-road-international-business-cross-border-ecommerce-master",
    nameEn: "International Business and Cross-border E-commerce",
    degreeLevel: "Master",
    fieldCategory: "Business and Economics",
    subjectArea: "International Business and Cross-border E-commerce",
    scholarshipText: "Listed for the 2026 UIBE Silk Road Program of Chinese Government Scholarship.",
    hasScholarship: true,
    applicationUrl: sourceOf("uibe-silk-road-scholarship-2026").finalUrl,
    applicationNote: "The reviewed scholarship notice lists this master's route but does not publish its duration or teaching language; those fields remain unresolved.",
    displayGroup: "silk-road-master",
    displayGroupLabel: "2026 Silk Road master's routes",
  }),
  program("uibe-silk-road-scholarship-2026", {
    slug: "uibe-silk-road-public-administration-custom-management-master",
    nameEn: "Public Administration (Custom Management)",
    degreeLevel: "Master",
    fieldCategory: "Public Administration",
    subjectArea: "Public Administration (Custom Management)",
    scholarshipText: "Listed for the 2026 UIBE Silk Road Program of Chinese Government Scholarship.",
    hasScholarship: true,
    applicationUrl: sourceOf("uibe-silk-road-scholarship-2026").finalUrl,
    applicationNote: "The reviewed scholarship notice lists this master's route but does not publish its duration or teaching language; those fields remain unresolved.",
    displayGroup: "silk-road-master",
    displayGroupLabel: "2026 Silk Road master's routes",
  }),
  program("uibe-silk-road-scholarship-2026", {
    slug: "uibe-silk-road-wto-laws-and-economics-master",
    nameEn: "WTO Laws and Economics",
    degreeLevel: "Master",
    durationYears: 2,
    fieldCategory: "Law and Economics",
    subjectArea: "WTO Laws and Economics",
    teachingLanguage: "English",
    englishRequirement: "TOEFL 86, IELTS 6.0, another official English-proficiency certificate, or official proof that the previous degree was taught in English.",
    scholarshipText: "Listed for the 2026 UIBE Silk Road Program of Chinese Government Scholarship.",
    hasScholarship: true,
    applicationUrl: sourceOf("uibe-silk-road-scholarship-2026").finalUrl,
    applicationNote: "Officially listed as an English-taught two-year master's program.",
    displayGroup: "silk-road-master",
    displayGroupLabel: "2026 Silk Road master's routes",
  }),
  program("uibe-youth-excellence-impa-2026", {
    slug: "uibe-youth-excellence-impa-global-development-governance-master",
    nameEn: "International Public Administration (Global Development and Governance)",
    degreeLevel: "Master",
    durationYears: 2,
    fieldCategory: "Public Administration",
    subjectArea: "Global Development and Governance",
    teachingLanguage: "English",
    englishRequirement: "IELTS 6.0, TOEFL iBT 86 or an equivalent level for non-native English speakers.",
    scholarshipText: "The 2026/2027 Youth of Excellence Scheme provides one academic year of full scholarship for this two-year program.",
    hasScholarship: true,
    applicationUrl: sourceOf("uibe-youth-excellence-impa-2026").finalUrl,
    applicationNote: "Two-year 1+1 model: first-year coursework at UIBE, followed by thesis work in the home country and an in-person UIBE defense; successful graduates receive a Master of Management degree.",
    displayGroup: "youth-excellence-master",
    displayGroupLabel: "2026/2027 Youth of Excellence master's route",
  }),
];
const deadlineFor = (programSlug: string) => programSlug.includes("youth-excellence")
  ? { date: "2026-03-15T15:59:59.000Z", label: "UIBE pre-admission deadline: March 15, 2026; CSC application deadline after pre-admission: March 25, 2026", round: "2026/2027 Youth of Excellence Scheme" }
  : { date: "2026-05-25T15:59:59.000Z", label: "CSC application deadline: May 25, 2026", round: "2026 UIBE Silk Road Program" };
const programIntakes: CatalogSeedProgramIntake[] = programs.map(row => {
  const sourceId = row.slug.includes("youth-excellence") ? "uibe-youth-excellence-impa-2026" : "uibe-silk-road-scholarship-2026";
  const due = deadlineFor(row.slug);
  return {
    programSlug: row.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: due.date, deadlineLabel: due.label,
    applicationRound: due.round, status: "closed",
    ...sourceFields(sourceId, { intakeYear: `explicit 2026 notice in ${sourceId}`, deadlineDate: `explicit application deadline in ${sourceId}`, status: "derived: deadline predates reviewed capture date" }),
  };
});
const info = (values: string[]) => values.map(label => ({ label }));
const steps = (values: string[]) => values.map((body, index) => ({ label: `Step ${index + 1}`, body }));
const scholarship = (sourceId: string, row: Omit<CatalogSeedScholarship, "schoolSlug" | "status">): CatalogSeedScholarship => ({
  schoolSlug, status: "draft", targetCountries: [], targetRegions: [], ...row,
  ...sourceFields(sourceId, Object.fromEntries(Object.keys(row).filter(key => !["slug", "status"].includes(key)).map(key => [key, `explicit or normalized from ${sourceId}`]))),
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship("uibe-silk-road-scholarship-2026", {
    slug: "official-2026-uibe-silk-road-chinese-government-scholarship",
    title: "UIBE 2026 Silk Road Program of Chinese Government Scholarship",
    nameZh: "对外经济贸易大学2026年中国政府奖学金丝绸之路项目",
    type: "government", typeLabel: "Chinese Government Scholarship — Silk Road Program", fundingLevel: "Full",
    providerName: "国家留学基金管理委员会 / 对外经济贸易大学", providerNameEn: "China Scholarship Council / University of International Business and Economics", providerLocation: "Beijing, China",
    coverage: "Tuition, accommodation, living expenses and insurance.",
    applicableDegree: "Master",
    applicableProgram: "International Business and Cross-border E-commerce; Public Administration (Custom Management); WTO Laws and Economics",
    amountText: "Full scholarship; the reviewed UIBE notice does not publish fixed allowance amounts.",
    requirementText: "Non-Chinese citizen under 35 in good health, holding a bachelor's degree or above, with good English proficiency; relevant background and development potential are preferred.",
    benefitItems: info(["Tuition", "Accommodation", "Living expenses", "Insurance"]).map(item => ({ ...item, included: true })),
    eligibilityItems: info(["Non-Chinese citizen in good physical and mental health", "Under 35 years old", "Bachelor's degree or above", "Good English proficiency", "Relevant academic or professional background is preferred", "Development potential and international-cooperation experience are considered"]),
    applicationMaterials: info(["Chinese Government Scholarship application form", "Ordinary passport identity page", "Highest degree certificate", "Academic transcripts", "English research proposal of at least 1,000 words", "Two academic recommendation letters", "TOEFL 86, IELTS 6.0, equivalent official proof, or proof of English-medium prior study", "Foreigner Physical Examination Form", "Non-criminal record"]),
    applicationSteps: steps(["Complete the CSC Type B application using UIBE agency number 10036", "Select one of the three published Silk Road master's routes", "Upload the official application materials before the deadline", "Wait for UIBE review and CSC final decision"]),
    actionLinks: [{ label: "Official UIBE Silk Road scholarship notice", url: sourceOf("uibe-silk-road-scholarship-2026").finalUrl, kind: "official-source" }, { label: "CSC online application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
    deadlineDate: "2026-05-25", deadlineLabel: "May 25, 2026", applicationRound: "2026 UIBE Silk Road Program",
    benefits: ["Tuition", "Accommodation", "Living expenses", "Insurance"], tags: ["2026", "Chinese Government Scholarship", "Silk Road", "Master"],
    summary: "A full Chinese Government Scholarship route for three UIBE master's programs, with official eligibility, materials and CSC Type B application instructions.", sortOrder: 330,
    bodySections: [{ title: "Program overview", body: "This route supports three officially named UIBE master's programs under the 2026 Silk Road Program." }, { title: "Important note", body: "Funding is subject to UIBE and CSC review and is not guaranteed by catalog display." }],
  }),
  scholarship("uibe-youth-excellence-impa-2026", {
    slug: "official-2026-uibe-youth-excellence-impa-scholarship",
    title: "UIBE 2026/2027 Youth of Excellence Scheme — IMPA Global Development and Governance",
    nameZh: "对外经济贸易大学2026/2027年度中国政府奖学金卓越青年项目—国际公共管理全球发展与治理",
    type: "government", typeLabel: "Youth of Excellence Scheme of China Program", fundingLevel: "Full for one academic year",
    providerName: "国家留学基金管理委员会 / 对外经济贸易大学", providerNameEn: "China Scholarship Council / University of International Business and Economics", providerLocation: "Beijing, China",
    coverage: "One academic year with full scholarship; the reviewed UIBE notice does not enumerate the individual funding components.",
    applicableDegree: "Master",
    applicableProgram: "International Public Administration (Global Development and Governance)",
    amountText: "One academic year of full scholarship; fixed amounts are not published on the reviewed notice.",
    requirementText: "Non-Chinese citizen under 45 with a bachelor's degree or above, at least three years of work experience, relevant management or international-organization background, and English proficiency equivalent to IELTS 6.0 or TOEFL iBT 86.",
    benefitItems: [{ label: "Full scholarship", included: true, note: "One academic year; components and fixed amounts are not itemized on the reviewed notice" }],
    eligibilityItems: info(["Non-Chinese citizen in good physical and psychological health", "Under 45 years old", "Bachelor's degree or above", "At least three years of work experience", "Middle or senior management, government, institutional, enterprise, higher-education, research or international-organization background", "IELTS 6.0, TOEFL iBT 86 or equivalent English ability"]),
    applicationMaterials: info(["Chinese Government Scholarship application form", "Ordinary passport identity page valid beyond the published date", "English research statement of at least 1,000 words", "English curriculum vitae", "Highest degree certificate", "Academic transcripts", "Two recommendation letters", "Employment certificate", "IELTS, TOEFL or official English-proficiency letter", "Foreigner Physical Examination Form", "Non-criminal record"]),
    applicationSteps: steps(["Submit the UIBE pre-admission package through the route specified on the official notice by March 15, 2026", "After receiving pre-admission, complete the CSC application by March 25, 2026", "Choose CSC Type A, agency number 1563, the Youth of Excellence Scheme, Public Management, and the published one-year CSC study duration", "Upload clear scanned application documents; handwritten and hard-copy submissions are not accepted", "Wait for CSC expert review and the final admission list"]),
    actionLinks: [{ label: "Official UIBE Youth of Excellence IMPA notice", url: sourceOf("uibe-youth-excellence-impa-2026").finalUrl, kind: "official-source" }, { label: "CSC online application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
    deadlineDate: "2026-03-15", deadlineLabel: "UIBE pre-admission: March 15, 2026; CSC submission after pre-admission: March 25, 2026", applicationRound: "2026/2027 Youth of Excellence Scheme",
    benefits: ["One academic year of full scholarship"], tags: ["2026/2027", "Chinese Government Scholarship", "Youth of Excellence", "Master", "English-taught"],
    summary: "A one-academic-year full scholarship for UIBE's two-year English-taught IMPA Global Development and Governance master's route.", sortOrder: 340,
    bodySections: [{ title: "Training model", body: "The two-year 1+1 program uses first-year coursework at UIBE and second-year thesis work in the home country, followed by an in-person UIBE defense." }, { title: "Important note", body: "The CSC application system records a one-year study duration because the scholarship funds one academic year; the academic program itself lasts two years." }],
  }),
];

const programSlugs = programs.map(row => row.slug);
const scholarshipSlugs = scholarships.map(row => row.slug);
if (new Set(programSlugs).size !== 4 || new Set(scholarshipSlugs).size !== 2 || scholarships.some(row => !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) {
  throw new Error("UIBE batch scope or rich scholarship fields are incomplete.");
}
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: sourceOf("uibe-youth-excellence-impa-2026").fetchedAt,
  cities: dependency.cities.map((row: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = row; return { ...rest, status: "draft" }; }),
  schools: dependency.schools.map((row: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = row; return { ...rest, status: "draft" }; }),
  programs, programIntakes, scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`UIBE batch validation failed: ${validation.errors.join(" ")}`);

const state = JSON.parse(await readFile(paths.state, "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:uibe-batch-02-review" });
let baseline: any;
try {
  const school = await pool.query(`select s.id,s.status,s.verification_status,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from programs p where p.school_id=s.id and p.status='active' and p.verification_status='verified')::int verified_programs,(select count(*) from scholarships h where h.school_id=s.id and h.status='active')::int scholarships,(select count(*) from scholarships h where h.school_id=s.id and h.status='active' and h.verification_status='verified')::int verified_scholarships from schools s where s.slug=$1`, [schoolSlug]);
  const programConflicts = await pool.query("select slug,status,verification_status from programs where slug=any($1::text[])", [programSlugs]);
  const scholarshipConflicts = await pool.query("select slug,status,verification_status from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
  baseline = { school: school.rows[0], programConflicts: programConflicts.rows, scholarshipConflicts: scholarshipConflicts.rows };
  if (school.rows.length !== 1 || baseline.school.status !== "active" || baseline.school.verification_status !== "verified" || baseline.school.programs !== 15 || baseline.school.verified_programs !== 9 || baseline.school.scholarships !== 3 || baseline.school.verified_scholarships !== 1 || programConflicts.rows.length || scholarshipConflicts.rows.length) {
    throw new Error(`UIBE safe-new database baseline changed: ${JSON.stringify(baseline)}`);
  }
} finally { await pool.end(); }

const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramCount: 4, newProgramIntakeCount: 4, newScholarshipCount: 2, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: manifestDefinitions.map(([sourceId]) => { const source = sourceOf(sourceId); return { sourceId, sourceUrl: source.finalUrl, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType, byteLength: source.byteLength }; }),
  standingAuthorization: { reference: "user-chat-default-publication", instruction: "发布默认允许", appliesBecause: "Four new reviewed official program routes, four new intake records and two new rich scholarship routes are inserted; no existing entity is overwritten, archived or deleted." },
  sourceReview: { result: "pass", note: "Both exact registered UIBE 2026 official notices were collected without redirects. Distinct programs and scholarship routes are modeled separately and unresolved fields remain explicit." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: baseline },
  coverageLimitations: ["The Silk Road notice does not publish duration or teaching language for the International Business and Cross-border E-commerce or Public Administration (Custom Management) routes.", "The Silk Road notice does not publish fixed scholarship allowance amounts.", "The Youth of Excellence notice states one academic year of full scholarship but does not enumerate its funding components or fixed amounts."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional program and scholarship policy is included. Contact names, telephone numbers, email addresses, street addresses, applicant data, account data, payment data and bank data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, limitations: reviewBase.coverageLimitations, paths }, null, 2));
