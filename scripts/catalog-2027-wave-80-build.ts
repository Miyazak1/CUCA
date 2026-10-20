import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const expected = new Map([
  ["beihang-self-supported-scholarship-policy", "9443a456a6a51c76faf846fea9ab0f12eb5b2b11a3e985744f99d07e57e9211d"],
  ["beihang-program-cooperation-scholarship-policy", "7f86f8d4611eca1bf1b5a6b0ac18c639b571104dbdfedff059c4220ad292b266"],
  ["beihang-distinguished-foreign-students-scholarship-policy", "acc3455d6ea5992b976693176ad8a962a25dccff0b6126d535a86e1b44a87180"],
  ["beihang-cgs-bilateral-current", "2feaa98e82bd368b1d84e8e87274d1f65910438d39d079ec235dc11eaa290547"],
  ["beihang-international-chinese-language-teachers-scholarship-2026", "ae0b491171b41b28531f552b4f284f24cc7a50fb35f483d0eb9a32854826ac9e"],
]);
const sources = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected.get(source.id) !== source.sha256) continue;
      const prior = sources.get(source.id);
      if (!prior || prior.fetchedAt < source.fetchedAt) sources.set(source.id, { ...source, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = [...expected.keys()].filter((id) => !sources.has(id));
if (missing.length) throw new Error(`Missing locked Beihang scholarship evidence: ${missing.join(", ")}.`);
for (const source of sources.values()) {
  const bytes = await readFile(resolve(source.runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Beihang scholarship evidence hash mismatch: ${source.id}.`);
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-16.draft.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "beihang-university";
const school = dependency.schools?.find((row) => row.slug === schoolSlug);
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 80 Beihang school or Beijing dependency row is missing.");

const sourceFields = (id: string) => {
  const source = sources.get(id)!;
  return {
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    lastVerifiedAt: source.fetchedAt,
  };
};
const officialLink = (id: string, label = "Official Beihang scholarship page") => ({ label, url: sourceFields(id).sourceUrl, kind: "official-source" });

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "beihang-self-supported-foreign-students-scholarship-current",
    schoolSlug,
    title: "Beihang University Self-Supported Foreign Students Scholarship",
    nameZh: "北京航空航天大学自费外国留学生奖学金",
    type: "university",
    typeLabel: "University scholarship",
    providerName: "北京航空航天大学",
    providerNameEn: "Beihang University",
    providerLocation: "Beijing, China",
    fundingLevel: "Full or partial",
    coverage: "Full awards include tuition, accommodation, insurance and living expenses at the referenced CSC standard. Partial awards may cover 20%, 50%, 80% or 100% tuition and all or part of accommodation or living expenses.",
    applicableDegree: "Undergraduate, Master, Doctoral and eligible scholars",
    applicableProgram: "New or current self-supported international students at Beihang.",
    amountText: "Full or partial award for one academic year; no numeric living or accommodation amount is published.",
    deadlineLabel: "Recurring policy timing: new students by May 31; current students May 5-15, subject to the notice for that year.",
    applicationRound: "Annual Beihang self-supported international student scholarship",
    benefitItems: [
      { label: "Full award", included: true, note: "Tuition, accommodation, insurance and living expenses at the referenced CSC standard" },
      { label: "Partial award", included: true, note: "20%, 50%, 80% or 100% tuition and/or partial accommodation or living expenses" },
    ],
    eligibilityItems: [
      { label: "New students", value: "Meet Beihang admission rules, hold no other scholarship and demonstrate strong prior academic, entrance-test, interview, research or other relevant performance" },
      { label: "Current students", value: "Normally enrolled for one year, compliant with university rules and meeting the published academic or research-performance criteria" },
      { label: "Ineligibility", value: "Serious discipline, attendance or course failures, or falsified materials make an applicant ineligible" },
    ],
    applicationMaterials: [{ label: "New students", value: "Scholarship form plus the applicable Beihang admission materials" }, { label: "Current students", value: "Prior-year transcript and the published recommendations, publication, award or research evidence for the student category" }],
    applicationSteps: [{ label: "Step 1", value: "Complete the annual scholarship form" }, { label: "Step 2", value: "Submit it to the International Student Scholarship Office within the applicable annual window" }, { label: "Step 3", value: "Await Beihang evaluation and public notice" }],
    actionLinks: [officialLink("beihang-self-supported-scholarship-policy")],
    summary: "Maintained Beihang policy for full or partial one-year awards to new and current self-supported international students.",
    status: "active",
    verificationStatus: "verified",
    ...sourceFields("beihang-self-supported-scholarship-policy"),
    sourceFieldLineage: { title: "page title", coverage: "chapter two award grades", applicableDegree: "chapter one range", amountText: "chapters two and four", deadlineLabel: "chapter four annual timing", eligibilityItems: "chapter three requirements", applicationMaterials: "chapter four materials", applicationSteps: "chapter four method" },
  },
  {
    slug: "beihang-program-cooperation-scholarship-current",
    schoolSlug,
    title: "Beihang University Program and Cooperation Foreign Students Scholarship",
    nameZh: "北京航空航天大学项目与合作外国留学生奖学金",
    type: "university",
    typeLabel: "Program and cooperation scholarship",
    providerName: "北京航空航天大学",
    providerNameEn: "Beihang University",
    providerLocation: "Beijing, China",
    fundingLevel: "Full or partial",
    coverage: "Full awards include tuition, accommodation, insurance and living expenses. Partial awards may cover 20%, 50%, 80% or 100% tuition and all or part of accommodation or living expenses; exchange students generally receive tuition support only.",
    applicableDegree: "Undergraduate, Master, Doctoral and intercollegiate exchange",
    applicableProgram: "New or current international students recommended through a cooperating institution, organization, government department, embassy or consulate.",
    amountText: "Full or partial institutional award; no numeric living or accommodation amount is published.",
    deadlineLabel: "Recurring policy timing for new applicants: December 20 for Spring and May 25 for Fall; current-student annual review is in May, subject to the notice for that year.",
    applicationRound: "Annual Beihang program and cooperation scholarship",
    benefitItems: [{ label: "Full award", included: true, note: "Tuition, accommodation, insurance and living expenses" }, { label: "Partial award", included: true, note: "20%, 50%, 80% or 100% tuition and/or partial accommodation or living expenses" }, { label: "Exchange students", included: true, note: "Normally tuition support only" }],
    eligibilityItems: [{ label: "New applicants", value: "Meet Beihang admission rules and hold a recommendation from an eligible cooperating institution or authority" }, { label: "Current recipients", value: "Continue only after the required annual review" }, { label: "Disqualification", value: "University-rule violations or missing annual review can terminate the award" }],
    applicationMaterials: [{ label: "New applicants", value: "Program and Cooperation Scholarship form or exchange form, institutional recommendation and Beihang study application" }, { label: "Current recipients", value: "Annual review form" }],
    applicationSteps: [{ label: "Step 1", value: "Obtain approval or recommendation from the cooperating institution" }, { label: "Step 2", value: "Submit the scholarship and Beihang study applications by the relevant annual date" }, { label: "Step 3", value: "Complete annual review for continuation" }],
    actionLinks: [officialLink("beihang-program-cooperation-scholarship-policy")],
    summary: "Maintained Beihang scholarship for institutionally recommended degree and exchange students, with annual review for continuation.",
    status: "active",
    verificationStatus: "verified",
    ...sourceFields("beihang-program-cooperation-scholarship-policy"),
    sourceFieldLineage: { title: "page title", coverage: "chapter two award grades", applicableDegree: "chapter one range", amountText: "chapter two", deadlineLabel: "chapter four annual timing", eligibilityItems: "chapter three requirements", applicationMaterials: "chapter four forms", applicationSteps: "chapter four method" },
  },
  {
    slug: "beihang-distinguished-foreign-students-scholarship-current",
    schoolSlug,
    title: "Beihang University Distinguished Foreign Students Scholarship",
    nameZh: "北京航空航天大学优秀外国留学生奖学金",
    type: "university",
    typeLabel: "Current-student merit scholarship",
    providerName: "北京航空航天大学",
    providerNameEn: "Beihang University",
    providerLocation: "Beijing, China",
    fundingLevel: "Cash award",
    coverage: "Excellent Study and Outstanding Behavior awards, each with three published prize levels and a certificate.",
    applicableDegree: "Undergraduate, Master, Doctoral and eligible scholars",
    applicableProgram: "International students generally enrolled at Beihang for at least one year.",
    amountText: "Excellent Study: CNY 5,000, 3,000 or 2,000. Outstanding Behavior: CNY 3,000, 2,000 or 1,000.",
    deadlineLabel: "Recurring annual application period: September 20-October 20, subject to the notice for that year.",
    applicationRound: "Annual Beihang distinguished foreign student scholarship",
    benefitItems: [{ label: "Excellent Study", included: true, note: "First CNY 5,000; second CNY 3,000; third CNY 2,000" }, { label: "Outstanding Behavior", included: true, note: "First CNY 3,000; second CNY 2,000; third CNY 1,000" }, { label: "Certificate", included: true, note: "Awarded to recipients" }],
    eligibilityItems: [{ label: "Enrollment", value: "Normally enrolled at Beihang for at least one year and compliant with Chinese law and university rules" }, { label: "Excellent Study", value: "Meet the applicable undergraduate course-performance or postgraduate academic and research criteria" }, { label: "Outstanding Behavior", value: "Document significant achievement in science, sports, arts, cultural exchange or public-benefit activities" }, { label: "HSK priority", value: "HSK 3 or above for English-medium students or HSK 6 for Chinese-medium students receives priority under otherwise equal conditions" }],
    applicationMaterials: [{ label: "Excellent Study", value: "Prior-year transcript and recommendation; postgraduate applicants also provide relevant publications, awards or department/supervisor recommendation" }, { label: "Outstanding Behavior", value: "Certificates proving relevant achievements in the previous year" }],
    applicationSteps: [{ label: "Step 1", value: "Complete the Distinguished Foreign Students Scholarship form" }, { label: "Step 2", value: "Submit the category-specific evidence during the annual window" }, { label: "Step 3", value: "Await Beihang evaluation and public notice" }],
    actionLinks: [officialLink("beihang-distinguished-foreign-students-scholarship-policy")],
    summary: "Maintained annual merit and conduct award for current Beihang international students, with explicit cash prize levels.",
    status: "active",
    verificationStatus: "verified",
    ...sourceFields("beihang-distinguished-foreign-students-scholarship-policy"),
    sourceFieldLineage: { title: "page title and chapter one", coverage: "chapter two award grades", applicableDegree: "chapter one range", amountText: "chapter two prize amounts", deadlineLabel: "chapter four annual timing", eligibilityItems: "chapter three requirements", applicationMaterials: "chapter four materials", applicationSteps: "chapter four method" },
  },
  {
    slug: "beihang-chinese-government-scholarship-bilateral-current",
    schoolSlug,
    title: "Chinese Government Scholarship Bilateral Program at Beihang University",
    nameZh: "北京航空航天大学中国政府奖学金国别双边项目",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type A",
    providerName: "国家留学基金管理委员会 / 派遣部门",
    providerNameEn: "China Scholarship Council / Home-country dispatching authority",
    providerLocation: "China and applicant's home country",
    fundingLevel: "Full or partial",
    coverage: "Full or partial Chinese Government Scholarship under the bilateral agreement and the applicant's dispatching authority.",
    applicableDegree: "Undergraduate, Master, Doctoral, general scholar and senior scholar",
    applicableProgram: "Eligible programs accepted by Beihang and the relevant bilateral dispatching authority.",
    deadlineLabel: "Usually November through the following March; the exact deadline and agency number are set by the applicant's home-country dispatching authority.",
    applicationRound: "Recurring Chinese Government Scholarship bilateral route",
    benefitItems: [{ label: "Scholarship package", included: true, note: "Full or partial package under the applicable bilateral agreement; this page does not itemize amounts" }],
    eligibilityItems: [{ label: "Authority route", value: "Apply through the dispatching department in the applicant's home country" }, { label: "University choice", value: "Choose Type A and list Beihang University as the first target institution" }],
    applicationMaterials: [{ label: "Required documents", value: "Follow the home-country dispatching authority and CSC system requirements" }],
    applicationSteps: [{ label: "Step 1", value: "Confirm the exact period and agency number with the home-country dispatching authority" }, { label: "Step 2", value: "Submit a Type A CSC application with Beihang as first choice" }, { label: "Step 3", value: "Obtain Beihang pre-admission review where applicable and await CSC placement" }],
    actionLinks: [officialLink("beihang-cgs-bilateral-current")],
    summary: "Current bilateral Chinese Government Scholarship route accepted by Beihang; country-specific deadlines and package details remain authority-dependent.",
    status: "active",
    verificationStatus: "verified",
    ...sourceFields("beihang-cgs-bilateral-current"),
    sourceFieldLineage: { title: "official page title", coverage: "scholarship coverage line", applicableDegree: "supporting categories", deadlineLabel: "application period and tips", eligibilityItems: "application receiving agency and tips", applicationMaterials: "authority-specific and not itemized on page", applicationSteps: "page tips and Type A instructions" },
  },
  {
    slug: "beihang-international-chinese-language-teachers-scholarship-spring-2027",
    schoolSlug,
    title: "Beihang International Chinese Language Teachers Scholarship — Spring 2027",
    nameZh: "北京航空航天大学2027年春季国际中文教师奖学金",
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "教育部中外语言交流合作中心 / 北京航空航天大学",
    providerNameEn: "Center for Language Education and Cooperation / Beihang University",
    providerLocation: "Beijing, China",
    fundingLevel: "Amount not published by Beihang page",
    coverage: "The Beihang guide confirms the scholarship route but does not restate its monetary coverage standard.",
    applicableDegree: "Non-degree",
    applicableProgram: "One-semester International Chinese Language Education, Chinese Language and Literature, Chinese History, Chinese Philosophy, Traditional Chinese Medicine or Taiji Culture study beginning March 2027.",
    deadlineDate: "2026-10-31",
    deadlineLabel: "Student application deadline for March 2027 admission: October 31, 2026.",
    applicationRound: "March 2027 International Chinese Language Teachers Scholarship",
    benefitItems: [{ label: "Scholarship coverage", included: true, note: "The amount and components are not restated on the captured Beihang guide" }],
    eligibilityItems: [{ label: "General", value: "Non-Chinese citizen, normally age 16-35 on September 1, 2026, in good physical and mental health, with good academic and conduct standing" }, { label: "Language-education and humanities tracks", value: "HSK Level 3 score 180 or above plus an HSKK score" }, { label: "Traditional Chinese Medicine or Taiji Culture", value: "An HSK score is required; no numeric minimum is printed" }],
    applicationMaterials: [{ label: "Core documents", value: "Passport photo page, valid HSK/HSKK reports as applicable and recommendation from the recommending institution" }, { label: "Conditional documents", value: "Employment and employer recommendation for in-service teachers; guardian documents for applicants under 18; other proof requested for interview" }],
    applicationSteps: [{ label: "Step 1", value: "Apply in the official International Chinese Language Teachers Scholarship system" }, { label: "Step 2", value: "Choose Beihang University and upload the required documents" }, { label: "Step 3", value: "Track institutional review, confirm enrollment and register on the admission-letter date" }],
    actionLinks: [officialLink("beihang-international-chinese-language-teachers-scholarship-2026")],
    summary: "Explicit March 2027 one-semester scholarship route with published language thresholds and application deadline; monetary coverage remains absent.",
    status: "active",
    verificationStatus: "verified",
    ...sourceFields("beihang-international-chinese-language-teachers-scholarship-2026"),
    sourceFieldLineage: { title: "2026 guide title plus March 2027 category", coverage: "guide does not restate monetary standard", applicableDegree: "one-semester category", deadlineDate: "deadline table for March 2027", eligibilityItems: "general and one-semester conditions", applicationMaterials: "application document section", applicationSteps: "application procedure" },
  },
];

const capturedAt = [...sources.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt: capturedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 80 validation failed:\n${validation.errors.join("\n")}`);

const evidence = [...sources.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: capturedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.length },
  evidence,
  unresolved: [
    "The three standing Beihang university policies publish recurring month/day windows but no cycle-specific 2027 dates; deadlineDate remains absent.",
    "The bilateral route delegates exact deadlines, agency number and package details to the applicant's home-country dispatching authority.",
    "The March 2027 language-scholarship guide does not restate the monetary coverage standard, and no amount is inferred.",
    "Beihang's 2026-only High-Level Postgraduate, Belt and Road, Youth of Excellence, undergraduate and new-postgraduate notices are excluded from this current/2027 wave.",
  ],
  notes: [
    "The newly registered Distinguished Foreign Students Scholarship page was fetched through the controlled collector after registry validation and its artifact hash was locked.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-80");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 80, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
