import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

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
const specs = [
  { run: "work/catalog-official/2026-10-26T03-24-46-226Z", id: "gzu-international-admission-index-current", sha256: "630a8e358969646c7179948fffb33de1b514f4d0a376f4df24c3d965bba9059e" },
  { run: "work/catalog-official/2026-10-26T03-25-21-642Z", id: "gzu-cgs-high-level-graduate-guide-pdf-2027-2028", sha256: "b1428f71b7c8cd6672168f5e6732091c8e454d17e491f784bf27e0c3d16b7d53" },
  { run: "work/catalog-official/2026-10-26T03-25-21-642Z", id: "gzu-international-undergraduate-program-catalog-pdf-2027", sha256: "603ab490400fd0b6af239ff98c9693dd3ee24aa44c27158f278979005e1c6de6" },
  { run: "work/catalog-official/2026-10-26T03-25-21-642Z", id: "gzu-international-master-program-catalog-pdf-2027", sha256: "df77504ef39812463fd0b7ca633a077c0801c56171f3b7d8a4d05c2e51651f4b" },
  { run: "work/catalog-official/2026-10-26T03-25-21-642Z", id: "gzu-international-doctoral-program-catalog-pdf-2027", sha256: "6fa9b9c446d4e87f80b47acdd05c92fa87f846d734058d84ba4b0db9c937ec9a" },
] as const;

const evidence = new Map<string, ManifestSource>();
for (const spec of specs) {
  const runRoot = resolve(root, spec.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === spec.id && row.status === 200 && row.sha256 === spec.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${spec.id} at ${spec.sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== spec.sha256) throw new Error(`Evidence hash mismatch: ${spec.id}.`);
  evidence.set(spec.id, source);
}

const source = evidence.get("gzu-cgs-high-level-graduate-guide-pdf-2027-2028");
const index = evidence.get("gzu-international-admission-index-current");
if (!source || !index) throw new Error("Guizhou University official evidence is incomplete.");
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "guiyang");
if (!city) throw new Error("Guiyang city dependency is missing.");
const schoolSlug = "guizhou-university";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Guizhou University is already present in the 100-school base.");
const sourceUrl = source.finalUrl ?? source.url;
const sourceFields = {
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  slug: schoolSlug,
  nameEn: "Guizhou University",
  nameZh: "贵州大学",
  citySlug: "guiyang",
  schoolType: "Public",
  region: "Guiyang, Guizhou, Southwest China",
  applicationLevel: "Undergraduate, Master and Doctoral",
  languageOfInstruction: "Chinese and English, by program",
  languageRequirement: "For the 2027/2028 High-Level Graduate scholarship, Chinese-taught applicants need HSK Level 4 score 230 or above; English-taught applicants need TOEFL 80 or IELTS 6.0.",
  hskRequirement: "HSK Level 4 score 230 or above for Chinese-taught 2027/2028 High-Level Graduate scholarship routes; a prior Chinese-medium degree from a Chinese university qualifies for the published exemption.",
  englishRequirement: "TOEFL 80 or IELTS 6.0 for English-taught 2027/2028 High-Level Graduate scholarship routes.",
  deadlineSummary: "The 2027/2028 Chinese Government Scholarship High-Level Graduate application closes December 15, 2026. General self-funded 2027 degree deadlines remain unpublished in the captured program catalogs.",
  tuitionSummary: "The 2027/2028 High-Level Graduate scholarship waives registration and tuition. Self-funded program-level fees are published in the captured 2027 catalogs and remain under row-level structured extraction.",
  websiteUrl: "https://cie.gzu.edu.cn/",
  admissionsUrl: index.finalUrl ?? index.url,
  subjectTags: ["Humanities", "Social Sciences", "Science", "Engineering", "Agriculture", "Medicine", "Arts"],
  languageTags: ["Chinese", "English"],
  campusHighlights: ["Official 2027 undergraduate program catalog", "Official 2027 master's program catalog", "Official 2027 doctoral program catalog", "2027/2028 Chinese Government Scholarship High-Level Graduate route"],
  contactNotes: "International Education College, West Campus of Guizhou University, Huaxi, Guiyang; +86-851-83627738 / +86-851-88292749; cie@gzu.edu.cn.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official 2027/2028 scholarship guide identity",
    nameZh: "official guide title",
    citySlug: "official guide contact address",
    schoolType: "official institutional identity",
    region: "official contact address plus CUAC geographic taxonomy",
    applicationLevel: "official 2027 undergraduate, master and doctoral catalog titles",
    languageOfInstruction: "official 2027 degree catalogs and scholarship guide",
    languageRequirement: "official 2027/2028 scholarship guide, Language Proficiency Requirements",
    hskRequirement: "official 2027/2028 scholarship guide, Language Proficiency Requirements",
    englishRequirement: "official 2027/2028 scholarship guide, Language Proficiency Requirements",
    deadlineSummary: "official 2027/2028 scholarship guide, Deadline",
    tuitionSummary: "official 2027/2028 scholarship guide, Coverage; degree-catalog extraction status",
    websiteUrl: "official International Education College domain",
    admissionsUrl: "official current admissions index",
    campusHighlights: "official current admissions index and 2027 catalog titles",
    contactNotes: "official guide contact section and current admissions index",
  },
};

const scholarship = {
  slug: "guizhou-university-cgs-high-level-graduate-2027-2028",
  schoolSlug,
  title: "2027/2028 Chinese Government Scholarship High-Level Graduate Program at Guizhou University",
  nameZh: "贵州大学2027/2028学年中国政府奖学金高水平研究生项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "国家留学基金管理委员会 / 贵州大学",
  providerNameEn: "China Scholarship Council / Guizhou University",
  providerLocation: "Guiyang, Guizhou, China",
  fundingLevel: "Full scholarship",
  coverage: "Registration fee and tuition waiver, free on-campus accommodation, comprehensive medical insurance, and a monthly stipend.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Eligible Chinese-taught and English-taught master's and doctoral programs in the official 2027 catalogs.",
  amountText: "Monthly stipend: CNY 3,000 for master's students and CNY 3,500 for doctoral students.",
  requirementText: "Master's applicants normally must be under 35 with a bachelor's degree; doctoral applicants normally must be under 40 with a master's degree. The highest-degree CGPA/GPA must be at least 78%. Chinese-taught study requires HSK 4 score 230; English-taught study requires TOEFL 80 or IELTS 6.0.",
  benefitItems: [
    { label: "Registration and tuition", included: true, note: "Waived" },
    { label: "Accommodation", included: true, note: "Free on-campus accommodation" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
    { label: "Living allowance", included: true, note: "Master CNY 3,000/month; doctoral CNY 3,500/month" },
  ],
  eligibilityItems: [
    { label: "Nationality and health", value: "Non-Chinese citizen in good physical and mental health" },
    { label: "Master's applicant", value: "Bachelor's degree or equivalent, excellent academic record, normally under age 35" },
    { label: "Doctoral applicant", value: "Master's degree or equivalent, excellent academic record, normally under age 40" },
    { label: "Academic performance", value: "Highest-degree CGPA/GPA of at least 78%" },
    { label: "Chinese-taught language", value: "HSK Level 4 score 230 or above; published exemption for a prior Chinese-medium degree from a Chinese university" },
    { label: "English-taught language", value: "TOEFL 80 or IELTS 6.0" },
    { label: "Other funding", value: "Must not hold another scholarship offered by a Chinese government body or admitting institution" },
  ],
  applicationMaterials: [
    { label: "Identity and education", value: "Passport, notarized highest diploma or expected-graduation certificate, and academic transcripts from undergraduate study onward" },
    { label: "Language", value: "Required HSK, IELTS, TOEFL, or accepted English-medium evidence" },
    { label: "Academic plan", value: "Chinese or English study plan over 1,000 words; doctoral plan signed by the proposed Chinese supervisor" },
    { label: "Recommendations", value: "Two recommendation letters from professors or associate professors issued within six months" },
    { label: "Health and conduct", value: "Foreigner Physical Examination Form and a recent non-criminal record" },
    { label: "Supporting material", value: "2-3 minute unedited self-introduction video; portfolio for art/design routes where applicable; supervisor acceptance letter after university review" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Submit one program choice through the Guizhou University International Student Service Platform by December 15, 2026" },
    { label: "Step 2", value: "Complete the college interview and comprehensive assessment after initial review" },
    { label: "Step 3", value: "After instruction, submit the CSC Type B application using Guizhou University agency number 10657" },
    { label: "Step 4", value: "Await university recommendation and CSC review; admitted students enroll in late August or early September 2027" },
  ],
  actionLinks: [{ label: "Official 2027/2028 scholarship guide", url: sourceUrl, kind: "official-source" }],
  deadlineDate: "2026-12-15",
  deadlineLabel: "Submit the Guizhou University platform application by December 15, 2026.",
  applicationRound: "2027/2028 Chinese Government Scholarship High-Level Graduate Program",
  summary: "Full Type B scholarship for eligible 2027 master's and doctoral study at Guizhou University, with tuition, accommodation, insurance and stipend coverage.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official guide title",
    typeLabel: "official application procedure, CSC Type B",
    coverage: "official guide, Scholarship Coverage",
    applicableDegree: "official guide, Eligibility and Subsidy Duration",
    applicableProgram: "official guide, Majors, linked 2027 master and doctoral catalogs",
    amountText: "official guide, Scholarship Coverage",
    requirementText: "official guide, Eligibility, Language and Academic Performance Requirements",
    benefitItems: "official guide, Scholarship Coverage",
    eligibilityItems: "official guide, Eligibility, Language and Academic Performance Requirements",
    applicationMaterials: "official guide, Application Materials",
    applicationSteps: "official guide, Application Procedure",
    actionLinks: "official captured guide PDF URL",
    deadlineDate: "official guide, Deadline of Application",
    deadlineLabel: "official guide, Deadline of Application",
    applicationRound: "official guide title",
    summary: "official guide scope and coverage",
  },
};

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1) ?? source.fetchedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 101 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 1 },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "The three official 2027 degree catalogs are captured and readable but contain many row-level programs. Their exact program, language, duration, fee and CSCA fields remain in the next structured-extraction wave rather than being inferred in this scholarship-focused wave.",
    "General self-funded 2027 application dates and application fee are not published in the captured program catalogs and remain blank.",
    "The scholarship guide says the supervisor acceptance letter is issued after university review; it is not treated as an initial application prerequisite.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-101");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 101, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
