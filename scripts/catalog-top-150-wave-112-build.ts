import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };

const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-25-07-224Z", id: "hnu-cgs-high-level-postgraduate-page-2026", sha256: "355dc5ca7529e2dd60e40f2e48da6069047b88eb3cd4060ec3bf881c3145b390" },
  { run: "2026-10-26T05-25-09-963Z", id: "hnu-cgs-high-level-postgraduate-pdf-2026", sha256: "ed3bc35be9e17f4120d3b57aba1f83a51a044e4963fe7f17905a82b04aca2efd" },
];

const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id} at ${locked.sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}

const pageSource = sources.get("hnu-cgs-high-level-postgraduate-page-2026")!;
const pdfSource = sources.get("hnu-cgs-high-level-postgraduate-pdf-2026")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "changsha");
if (!city) throw new Error("Changsha city dependency is missing.");
const schoolSlug = "hunan-university";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Hunan University already exists in the reviewed base.");

const school = {
  slug: schoolSlug,
  nameEn: "Hunan University",
  nameZh: "湖南大学",
  citySlug: "changsha",
  schoolType: "Comprehensive university",
  region: "Changsha, Hunan, Central China",
  applicationLevel: "Master and Doctoral",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "For the 2026 High-level Postgraduate Program, Chinese-taught applicants require HSK Level 4 or above. English-taught applicants require English as a mother tongue or an accepted result such as IELTS 6.0 or TOEFL 80.",
  hskRequirement: "HSK Level 4 or above for Chinese-taught postgraduate programs.",
  englishRequirement: "English as a mother tongue, or an accepted result such as IELTS 6.0 or TOEFL 80, for English-taught programs.",
  deadlineSummary: "The 2026 Chinese Government Scholarship High-level Postgraduate Program closed March 1, 2026. No explicit 2027 inbound international degree guide was found as of October 26, 2026.",
  tuitionSummary: "The 2026 full scholarship covers tuition and university dormitory or an accommodation subsidy; no self-funded tuition is stated in this guide.",
  websiteUrl: "https://www.hnu.edu.cn/",
  admissionsUrl: pageSource.finalUrl ?? pageSource.url,
  subjectTags: ["Business Administration", "Computer Science", "Applied Economics", "Chemistry", "Mechanical Engineering"],
  languageTags: ["Chinese", "English", "HSK 4", "IELTS 6.0", "TOEFL 80"],
  campusHighlights: ["2026 CSC High-level Postgraduate Program", "Five dual-language postgraduate majors", "Full tuition, accommodation, stipend and insurance coverage"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: pdfSource.fetchedAt,
  ...sourceFields(pageSource),
  sourceFieldLineage: {
    nameEn: "official guide title and host identity",
    nameZh: "official university identity",
    citySlug: "official guide address and reviewed Changsha dependency",
    schoolType: "official university identity; broad CUAC classification",
    region: "official guide address plus CUAC geographic taxonomy",
    applicationLevel: "official scholarship guide eligible program levels",
    languageOfInstruction: "official guide majors and language requirements",
    languageRequirement: "official 2026 guide language-requirement section",
    hskRequirement: "official 2026 guide language-requirement section",
    englishRequirement: "official 2026 guide language-requirement section",
    deadlineSummary: "official 2026 guide deadline and current 2027 discovery status",
    tuitionSummary: "official 2026 guide scholarship coverage",
    websiteUrl: "official university URL printed in the guide",
    admissionsUrl: "captured official scholarship page",
    subjectTags: "official guide majors offered",
    languageTags: "official guide language thresholds",
    campusHighlights: "official guide scope and coverage",
  },
};

const routeSpecs = [
  { major: "Business Administration", nameZh: "工商管理", degreeLevel: "Master", category: "Economics and Management" },
  { major: "Business Administration", nameZh: "工商管理", degreeLevel: "Doctoral", category: "Economics and Management" },
  { major: "Computer Science and Technology", nameZh: "计算机科学与技术", degreeLevel: "Master", category: "Computer Science and IT" },
  { major: "Computer Science and Technology", nameZh: "计算机科学与技术", degreeLevel: "Doctoral", category: "Computer Science and IT" },
  { major: "Applied Economics", nameZh: "应用经济学", degreeLevel: "Master", category: "Economics and Management" },
  { major: "Applied Economics", nameZh: "应用经济学", degreeLevel: "Doctoral", category: "Economics and Management" },
  { major: "Chemistry", nameZh: "化学", degreeLevel: "Doctoral", category: "Natural Sciences" },
  { major: "Mechanical Engineering", nameZh: "机械工程", degreeLevel: "Doctoral", category: "Engineering and Technology" },
] as const;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = routeSpecs.map((spec) => ({
  slug: `${schoolSlug}-${slugify(spec.major)}-${spec.degreeLevel.toLowerCase()}`,
  schoolSlug,
  citySlug: "changsha",
  nameEn: spec.major,
  nameZh: spec.nameZh,
  degreeLevel: spec.degreeLevel,
  fieldCategory: spec.category,
  subjectArea: spec.major,
  teachingLanguage: "Chinese and English",
  hskRequirement: "HSK Level 4 or above for the Chinese-taught route.",
  englishRequirement: "English as a mother tongue, or an accepted result such as IELTS 6.0 or TOEFL 80, for the English-taught route.",
  tuitionText: "Tuition is covered for recipients of the 2026 CSC High-level Postgraduate Program; self-funded tuition is not stated in this guide.",
  scholarshipText: "Full scholarship covering tuition, university dormitory or accommodation subsidy, monthly stipend and CNY 800/year comprehensive medical insurance.",
  applicationNote: "Apply through the CSC Study in China system as Type B with Hunan University agency number 10532, obtain Hunan University pre-admission, then upload the pre-admission document and resubmit.",
  hasScholarship: true,
  badgeText: "2026 CSC route",
  displayTuition: "Full scholarship route",
  displaySubjects: [spec.major],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: pdfSource.fetchedAt,
  ...sourceFields(pdfSource),
  sourceFieldLineage: {
    nameEn: "official 2026 guide majors offered",
    nameZh: "standard Chinese rendering of the official listed major",
    degreeLevel: "official 2026 guide major-level combinations",
    fieldCategory: "official major identity mapped to CUAC taxonomy",
    subjectArea: "official major name",
    teachingLanguage: "official guide states these majors are taught in both English and Chinese",
    hskRequirement: "official guide language requirements",
    englishRequirement: "official guide language requirements",
    tuitionText: "official scholarship coverage; self-funded tuition absent",
    scholarshipText: "official scholarship coverage",
    applicationNote: "official guide application process",
    badgeText: "official guide cycle",
    displaySubjects: "official listed major",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "2026 Entry",
  intakeYear: 2026,
  deadlineDate: "2026-03-01T15:59:59.000Z",
  deadlineLabel: "The 2026 CSC High-level Postgraduate Program application deadline was March 1, 2026; the guide does not state a semester.",
  applicationRound: "Hunan University 2026 CSC High-level Postgraduate Program",
  status: "closed" as const,
  ...sourceFields(pdfSource),
  sourceFieldLineage: {
    intakeTerm: "source-bounded cycle label; no semester inferred",
    intakeYear: "official guide title",
    deadlineDate: "official guide deadline converted from Beijing end-of-day",
    deadlineLabel: "official deadline plus explicit absence of semester",
    applicationRound: "official guide title",
  },
}));

const scholarship = {
  slug: `${schoolSlug}-csc-high-level-postgraduate-2026`,
  schoolSlug,
  title: "Hunan University Chinese Government Scholarship High-level Postgraduate Program 2026",
  nameZh: "湖南大学2026年中国政府奖学金高水平研究生项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "中国国家留学基金管理委员会 / 湖南大学",
  providerNameEn: "China Scholarship Council / Hunan University",
  providerLocation: "Changsha, Hunan, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition; university dormitory or accommodation subsidy; CNY 3,000/month for master's students or CNY 3,500/month for doctoral students; CNY 800/person/year comprehensive medical insurance.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Business Administration, Computer Science and Technology, Applied Economics, Chemistry (doctoral only), and Mechanical Engineering (doctoral only), taught in Chinese or English; other Chinese-taught majors are referenced to the graduate school but are not enumerated in this guide.",
  amountText: "CNY 3,000/month master's stipend; CNY 3,500/month doctoral stipend; CNY 800/year comprehensive medical insurance; tuition and accommodation covered.",
  requirementText: "Non-Chinese citizens in good physical and mental health. Master's applicants must hold a bachelor's degree and be under 35; doctoral applicants must hold a master's degree and be under 40. Chinese-taught applicants need HSK 4 or above; English-taught applicants need English as a mother tongue or an accepted result such as IELTS 6.0 or TOEFL 80.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "University dormitory or accommodation subsidy" },
    { label: "Master's stipend", included: true, note: "CNY 3,000 per month" },
    { label: "Doctoral stipend", included: true, note: "CNY 3,500 per month" },
    { label: "Medical insurance", included: true, note: "CNY 800 per person per year" },
  ],
  eligibilityItems: [
    { label: "Nationality and health", value: "Non-Chinese citizen in good physical and mental health" },
    { label: "Master's route", value: "Academically excellent bachelor's-degree holder under age 35" },
    { label: "Doctoral route", value: "Academically excellent master's-degree holder under age 40" },
    { label: "Chinese-taught language", value: "HSK Level 4 or above" },
    { label: "English-taught language", value: "English as mother tongue or an accepted result such as IELTS 6.0 or TOEFL 80" },
  ],
  applicationMaterials: [
    { label: "Application", value: "CSC online application form, Type B, agency number 10532" },
    { label: "Identity", value: "Passport copy valid beyond September 2026" },
    { label: "Education", value: "Notarized highest diploma or official expected-graduation proof" },
    { label: "Transcripts", value: "Notarized academic transcripts from undergraduate study onward" },
    { label: "Language", value: "Applicable HSK or accepted English-language evidence" },
    { label: "Study plan", value: "Chinese or English study/research plan of at least 1,000 words" },
    { label: "Recommendations", value: "Two Chinese- or English-language letters signed by professors or associate professors" },
    { label: "Health", value: "Foreigner Physical Examination Form valid for six months" },
    { label: "Conduct", value: "Non-criminal record issued within six months before submission" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Create an account in CSC Study in China" },
    { label: "Step 2", value: "Select Type B and enter Hunan University agency number 10532" },
    { label: "Step 3", value: "Upload the required supporting documents and submit" },
    { label: "Step 4", value: "If preliminarily approved, obtain Hunan University pre-admission, upload it and resubmit" },
    { label: "Step 5", value: "CSC conducts final eligibility and academic review" },
  ],
  actionLinks: [{ label: "Official 2026 scholarship guide", url: pdfSource.finalUrl ?? pdfSource.url, kind: "official-source" }],
  deadlineDate: "2026-03-01",
  deadlineLabel: "Applications closed March 1, 2026.",
  applicationRound: "2026 High-level Postgraduate Program",
  summary: "Full 2026 CSC Type B postgraduate scholarship at Hunan University for eligible master's and doctoral applicants.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: pdfSource.fetchedAt,
  ...sourceFields(pdfSource),
  sourceFieldLineage: {
    title: "official guide title",
    coverage: "official guide scholarship-coverage section",
    applicableDegree: "official guide eligibility and majors offered",
    applicableProgram: "official guide majors offered",
    amountText: "official guide stipend and insurance amounts",
    requirementText: "official guide eligibility and language requirements",
    benefitItems: "official guide scholarship coverage",
    eligibilityItems: "official guide eligibility and language requirements",
    applicationMaterials: "official guide application-documents section",
    applicationSteps: "official guide application-process section",
    deadlineDate: "official guide deadline",
    applicationRound: "official guide title",
    summary: "official guide scope and coverage",
  },
};

const generatedAt = pdfSource.fetchedAt;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 112 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => {
  const source = sources.get(locked.id)!;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 31, schoolSlugs: [schoolSlug], newSchools: 1, programs: 8, programIntakes: 8, scholarships: 1 },
  evidence,
  unresolved: [
    "No explicit 2027 inbound international degree guide was found on the current official international pages as of October 26, 2026. No 2026 field is relabeled as 2027.",
    "The guide references additional Chinese-taught majors on the graduate-school website but does not enumerate them. Only the five named bilingual majors and their explicit degree levels are structured here.",
    "The guide does not state a semester, program duration or self-funded tuition. The intake term is stored as the source-bounded label '2026 Entry'; duration and self-funded tuition remain absent.",
    "The scholarship is closed. It remains a latest-official-cycle evidence candidate and must not be presented as a currently open 2027 route.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Named staff, personal-looking email addresses and telephone details printed in the guide were deliberately excluded. Only institutional admissions facts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-112");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 112, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
