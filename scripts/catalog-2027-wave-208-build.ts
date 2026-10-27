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

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  byteLength: number;
  sha256: string;
  artifactPath: string;
};

type Degree = "Master" | "Doctoral";
type Language = "Chinese" | "English";
type Major = { degree: Degree; name: string; languages: Language[]; note?: string };

const root = process.cwd();
const run = "2026-10-27T03-42-22-467Z";
const sourceId = "uibe-high-level-postgraduate-scholarship-2027-2028";
const expectedSha256 = "ba116a919019944711a6f45e8c2b2451926e5be7dc1da96dbb0cb08a3f083268";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked UIBE 2027/2028 postgraduate scholarship source.");
const evidence = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(evidence).digest("hex") !== expectedSha256) throw new Error("UIBE evidence hash mismatch.");
const visibleText = evidence.toString("utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();
for (const fragment of [
  "Application Guideline of 2027/2028 Chinese Government Scholarship High-Level Postgraduate Program in UIBE",
  "minimum overall IELTS Academic score of 6.0",
  "UIBE’S agency code: 10036",
  "Master’s students: CNY 3,000 per person, per month",
  "Doctoral students: CNY 3,500 per person, per month",
  "23:59, February 28, 2027, Beijing Time",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected UIBE evidence fragment missing: ${fragment}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-20.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "beijing");
const baseSchool = prior.schools?.find((row) => row.slug === "university-of-international-business-and-economics");
if (!city || !baseSchool) throw new Error("Wave 20 UIBE dependencies are missing.");
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const school = {
  ...baseSchool,
  applicationLevel: "Master and doctoral scholarship routes are published for the 2027/2028 academic cycle. General self-funded Fall 2027 degree admissions remain unresolved.",
  languageOfInstruction: "Chinese and English, depending on the published major.",
  languageRequirement: "Chinese-taught routes require HSK Level 5 with at least 180; English-taught routes require IELTS Academic 6.0 or TOEFL iBT 86. An official medium-of-instruction letter may replace the relevant test where the prior degree was taught entirely in that language under the source conditions.",
  englishRequirement: "IELTS Academic 6.0 or TOEFL iBT 86, or an eligible official English-medium instruction letter.",
  deadlineSummary: "The 2027/2028 Chinese Government Scholarship High-Level Postgraduate Program deadline is 23:59 on February 28, 2027 Beijing Time. The March 2027 one-semester language scholarship route separately closed October 31, 2026.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "2027/2028 Chinese Government Scholarship postgraduate routes"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027/2028 scholarship degree categories",
    languageOfInstruction: "official program table",
    languageRequirement: "official eligibility and application-materials sections",
    englishRequirement: "official eligibility and application-materials sections",
    deadlineSummary: "official deadline plus preserved prior March 2027 route",
    admissionsUrl: "registered official UIBE guide",
    campusHighlights: "official 2027/2028 scholarship route",
  },
};

const bilingualMaster = [
  "International Relations",
  "International Development",
  "International Law",
  "International Trade",
  "Finance (International Finance and Investment)",
  "Finance (Actuarial Science and Risk Management)",
];
const chineseMaster = [
  "Public Administration",
  "International Chinese Language Education",
  "Civil Law",
  "Economical Law",
  "Linguistics & Applied Linguistics",
  "Foreign Linguistics & Applied Linguistics",
  "Translation",
];
const englishMaster = [
  "International Business",
  "Public Management",
  "Customs Management",
  "Business Administration",
  "Digital Economy (Digital Economy/Intelligent Data Analytics)",
  "WTO Law and Economics",
  "International Business and Cross-border E-Commerce",
  "Transport Economics and Logistics",
];
const bilingualDoctoral = [
  "International Relations",
  "International Development",
  "International Law",
  "Finance (Insurance /Actuarial and Risk Management /Asset Allocation)",
  "Labor Economics",
  "International Trade",
];
const chineseDoctoral = ["Civil Law", "Economical Law"];
const englishDoctoral = ["Public Policy and Public Administration", "Enterprise Management", "Industrial Economics"];
const majors: Major[] = [
  ...bilingualMaster.map((name) => ({ degree: "Master" as const, name, languages: ["Chinese", "English"] as Language[] })),
  ...chineseMaster.map((name) => ({ degree: "Master" as const, name, languages: ["Chinese"] as Language[] })),
  ...englishMaster.map((name) => ({ degree: "Master" as const, name, languages: ["English"] as Language[], note: name === "Business Administration" ? "Minimum three years of relevant full-time work experience required." : undefined })),
  ...bilingualDoctoral.map((name) => ({ degree: "Doctoral" as const, name, languages: ["Chinese", "English"] as Language[] })),
  ...chineseDoctoral.map((name) => ({ degree: "Doctoral" as const, name, languages: ["Chinese"] as Language[] })),
  ...englishDoctoral.map((name) => ({ degree: "Doctoral" as const, name, languages: ["English"] as Language[] })),
];
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const routeRows = majors.flatMap((major) => major.languages.map((language) => ({ ...major, language })));
if (routeRows.length !== 44) throw new Error(`Expected 44 UIBE degree-language routes, found ${routeRows.length}.`);

const programs: CatalogSeedProgram[] = routeRows.map((route) => ({
  slug: `university-of-international-business-and-economics-2027-cgs-${route.degree.toLowerCase()}-${slugify(route.name)}-${route.language.toLowerCase()}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: `${route.name} (${route.language}-taught, 2027/2028 Chinese Government Scholarship)`,
  degreeLevel: route.degree,
  subjectArea: route.name,
  teachingLanguage: route.language,
  ...(route.language === "Chinese"
    ? { hskRequirement: "HSK Level 5 score 180 or above, or an eligible official Chinese-medium instruction letter." }
    : { englishRequirement: "IELTS Academic 6.0 or TOEFL iBT 86 or above, or an eligible official English-medium instruction letter." }),
  scholarshipText: `Full Chinese Government Scholarship: tuition, accommodation, monthly stipend (${route.degree === "Master" ? "CNY 3,000" : "CNY 3,500"}), and comprehensive medical insurance.`,
  applicationUrl: "https://studyinchina.csc.edu.cn/#/login",
  applicationNote: `Apply through the CSC system as Type B using UIBE agency code 10036, submit the identical document set following UIBE's official guide, and complete preliminary review and interview if shortlisted.${route.note ? ` ${route.note}` : ""}`,
  hasScholarship: true,
  badgeText: "2027/2028 full scholarship route",
  displaySubjects: [route.name],
  displayGroup: route.degree,
  displayGroupLabel: `${route.degree} scholarship programs`,
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official degree, major, teaching-language table, and scholarship cycle",
    degreeLevel: "official program table",
    subjectArea: "official major name",
    teachingLanguage: "official Chinese/English availability marks",
    ...(route.language === "Chinese" ? { hskRequirement: "official language eligibility section" } : { englishRequirement: "official language eligibility section" }),
    scholarshipText: "official scholarship coverage and living-allowance standards",
    applicationUrl: "official CSC-system link",
    applicationNote: route.note ? "official application procedure and program-table work-experience note" : "official application procedure",
  },
}));

const intakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "2027 scholarship cohort",
  intakeYear: 2027,
  deadlineDate: "2027-02-28T15:59:00.000Z",
  deadlineLabel: "February 28, 2027 at 23:59 (Beijing Time)",
  applicationRound: "2027/2028 Chinese Government Scholarship High-Level Postgraduate Program",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official 2027/2028 scholarship cycle; exact enrollment month not published",
    intakeYear: "official 2027/2028 scholarship cycle",
    deadlineDate: "official Beijing-time deadline converted to UTC",
    deadlineLabel: "official application deadline",
    applicationRound: "official scholarship title",
    status: "deadline compared with source capture time",
  },
}));

const scholarship: CatalogSeedScholarship = {
  slug: "university-of-international-business-and-economics-high-level-postgraduate-scholarship-2027-2028",
  title: "UIBE 2027/2028 Chinese Government Scholarship High-Level Postgraduate Program",
  nameZh: "对外经济贸易大学2027/2028学年中国政府奖学金高水平研究生项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship - High-Level Postgraduate Program",
  providerName: "中国国家留学基金管理委员会 / 对外经济贸易大学",
  providerNameEn: "China Scholarship Council / University of International Business and Economics",
  providerLocation: "Beijing, China",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, university accommodation, monthly living allowance, and comprehensive medical insurance.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "The official table lists 21 master's majors and 11 doctoral majors across Chinese- and English-taught routes.",
  amountText: "Monthly living allowance: CNY 3,000 for master's students and CNY 3,500 for doctoral students.",
  requirementText: "Applicants must be non-Chinese citizens in good health. Master's applicants must hold a bachelor's degree and be under 35 (born on or after September 1, 1992); doctoral applicants must hold a master's degree and be under 40 (born on or after September 1, 1987). Language requirements depend on route.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Tuition waiver" },
    { label: "Accommodation", included: true, note: "University accommodation" },
    { label: "Living allowance", included: true, note: "CNY 3,000/month for master's; CNY 3,500/month for doctoral" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Passport home page and required identity documentation" },
    { label: "Degree", value: "Highest diploma or official pre-graduation certificate" },
    { label: "Transcripts", value: "Full academic transcripts" },
    { label: "Language", value: "HSK or English-proficiency evidence, or eligible medium-of-instruction proof" },
    { label: "Proposal", value: "Study and research proposal of at least 1,000 Chinese characters or English words" },
    { label: "Recommendations", value: "Two official letters from professors or associate professors" },
    { label: "Health", value: "Foreigner Physical Examination Form" },
    { label: "Conduct", value: "Non-criminal record" },
  ],
  applicationSteps: [
    { label: "Step 1", body: "Apply in the Chinese Government Scholarship Information System under Type B with UIBE agency code 10036." },
    { label: "Step 2", body: "Submit the identical complete document set as directed in the official UIBE guide before the deadline." },
    { label: "Step 3", body: "Complete UIBE preliminary review and an academic interview if shortlisted, then upload the pre-admission letter when instructed." },
  ],
  actionLinks: [
    { label: "Official UIBE guide", url: source.finalUrl ?? source.url, kind: "official-source" },
    { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "application" },
  ],
  deadlineDate: "2027-02-28",
  deadlineLabel: "February 28, 2027 at 23:59 (Beijing Time)",
  applicationRound: "2027/2028 High-Level Postgraduate Program",
  benefits: ["Tuition waiver", "Accommodation", "Monthly stipend", "Comprehensive medical insurance"],
  tags: ["Chinese Government Scholarship", "Master", "Doctoral", "Chinese-taught", "English-taught"],
  summary: "Full Chinese Government Scholarship route for UIBE's published 2027/2028 master and doctoral program table.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official scholarship title",
    fundingLevel: "official scholarship coverage",
    coverage: "official scholarship coverage",
    applicableDegree: "official degree categories",
    applicableProgram: "official program table",
    amountText: "official living-allowance standards",
    requirementText: "official eligibility section",
    benefitItems: "official scholarship coverage",
    applicationMaterials: "official application-materials section; applicant/contact PII excluded",
    applicationSteps: "official application procedure; personal contact details excluded",
    deadlineDate: "official application deadline",
    deadlineLabel: "official application deadline",
    applicationRound: "official scholarship title",
    summary: "official scholarship scope",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: intakes,
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "CUAC existing-school 2027 refresh", schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: intakes.length, scholarships: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, byteLength: source.byteLength, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The source is scholarship-specific and does not establish UIBE's general self-funded Fall 2027 admissions catalog.",
    "The source does not publish exact enrollment months, program durations, or self-funded tuition; those fields remain unresolved.",
    "Chinese program and scholarship names are editorial translations and require review before publication.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Named contacts, personal email addresses, telephone numbers, referee contact details, and applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-208");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 208, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
