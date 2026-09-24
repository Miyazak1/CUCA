import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T12-21-17-915Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.jinan-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.sdnu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sdnu-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([
  readFile(manifestPath, "utf8"),
  readFile(cityPath, "utf8"),
]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>(
  (manifest.sources as SourceRecord[]).map((row) => [row.id, row]),
);
const expected = {
  "sdnu-international-program-catalog-2026-2027": "0bf8cbfebeebf0b33ce1ae45606b5af5e30eecafe60aae368a28c67c2e287bb9",
  "sdnu-international-program-catalog-image-1-2026-2027": "2d593018efd35131f39f4c579789e138422c74fd35146a9b8dde9e0e5ab1fec1",
  "sdnu-international-program-catalog-image-2-2026-2027": "0ba7ae25dfe2015268cf0dd431e81aad3b6d31ddb9f3ec6cae9b1525d928a021",
  "sdnu-international-admission-brochure-page-2026": "4aba68d96857b207fe3c87f8e268796c28f36c1c0d11a4c4296436ab97f2c955",
  "sdnu-international-admission-brochure-pdf-2026": "9febf6b225bc994d0d0fa8f00eac106b3e479c97f44334968cd51f5cf812f0e4",
  "sdnu-shandong-government-scholarship-2026": "23b2f184b0058cbbdd8a473577c34989fe659e3cf850dbbd6c289e6af6dc7379",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) {
    throw new Error(`SDNU evidence mismatch: ${id}`);
  }
}

const catalog = sources.get("sdnu-international-program-catalog-image-2-2026-2027")!;
const brochure = sources.get("sdnu-international-admission-brochure-pdf-2026")!;
const scholarshipSource = sources.get("sdnu-shandong-government-scholarship-2026")!;
const schoolSlug = "shandong-normal-university";
const citySlug = "jinan";

type ProgramSpec = {
  slug: string;
  nameEn: string;
  nameZh: string;
  category: string;
  tuition: number;
};
const programSpecs: ProgramSpec[] = [
  { slug: `${schoolSlug}-business-administration`, nameEn: "Business Administration", nameZh: "工商管理", category: "Business Administration", tuition: 16000 },
  { slug: `${schoolSlug}-calligraphy`, nameEn: "Calligraphy", nameZh: "书法学", category: "Fine Arts", tuition: 18000 },
  { slug: `${schoolSlug}-chemical-engineering-and-technics`, nameEn: "Chemical Engineering and Technics", nameZh: "化学工程与工艺", category: "Chemical Engineering", tuition: 16000 },
  { slug: `${schoolSlug}-chinese-language`, nameEn: "Chinese Language", nameZh: "汉语言", category: "Chinese Language", tuition: 14000 },
  { slug: `${schoolSlug}-environmental-design`, nameEn: "Environmental Design", nameZh: "环境设计", category: "Fine Arts", tuition: 18000 },
  { slug: `${schoolSlug}-fine-arts`, nameEn: "Fine Arts", nameZh: "美术学", category: "Fine Arts", tuition: 18000 },
  { slug: `${schoolSlug}-logistics-management`, nameEn: "Logistics Management", nameZh: "物流管理", category: "Business and Management", tuition: 16000 },
  { slug: `${schoolSlug}-martial-arts-and-traditional-ethnic-sports`, nameEn: "Martial Arts and Traditional Ethnic Sports", nameZh: "武术与民族传统体育", category: "Physical Education", tuition: 18000 },
  { slug: `${schoolSlug}-teaching-chinese-to-speakers-of-other-languages`, nameEn: "Teaching Chinese to Speakers of Other Languages", nameZh: "汉语国际教育", category: "Education", tuition: 14000 },
  { slug: `${schoolSlug}-tourism-management`, nameEn: "Tourism Management", nameZh: "旅游管理", category: "Tourism Management", tuition: 16000 },
];

const programs: CatalogSeedProgram[] = programSpecs.map((spec) => ({
  slug: spec.slug,
  schoolSlug,
  citySlug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: spec.category,
  subjectArea: spec.category,
  teachingLanguage: "Chinese",
  cscaRequirement: "Applicants must take CSCA and submit the result. The reviewed official guide does not publish a program-specific subject combination.",
  hskRequirement: "HSK Level 4 score 180 or above.",
  tuitionAmount: spec.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/academic year`,
  applicationUrl: brochure.url,
  applicationNote: "Fall 2026 self-sponsored international undergraduate route. The published application window is closed.",
  hasScholarship: false,
  scholarshipText: "The reviewed 2026 Shandong Provincial Government Scholarship is limited to master's and doctoral applicants; no scholarship entitlement for this undergraduate route is established by the reviewed sources.",
  status: "draft",
  sourceUrl: catalog.url,
  sourceLabel: catalog.label,
  sourceSha256: catalog.sha256,
  capturedAt: catalog.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official English 2026-2027 international program catalog row",
    nameZh: "official Chinese 2026-2027 international program catalog row",
    degreeLevel: "official program catalog level column",
    durationYears: "official program catalog duration column",
    teachingLanguage: "official program catalog language column",
    tuitionAmount: "official program catalog tuition column",
    hskRequirement: `2026 undergraduate admission brochure ${brochure.sha256}`,
    cscaRequirement: `2026 undergraduate admission brochure ${brochure.sha256}`,
    applicationUrl: "registered official 2026 undergraduate admission brochure",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-05-31T15:59:59.000Z",
  deadlineLabel: "May 31, 2026",
  applicationRound: "2026 self-sponsored international undergraduate admission",
  status: "closed" as const,
  sourceUrl: brochure.url,
  sourceLabel: brochure.label,
  sourceSha256: brochure.sha256,
  capturedAt: brochure.fetchedAt,
  sourceFieldLineage: {
    deadlineDate: "official brochure page 2 application-time table",
    intakeYear: "official brochure page 2 commencement-time table",
  },
}));

const scholarship: CatalogSeedScholarship = {
  slug: "sdnu-shandong-government-scholarship-2026",
  schoolSlug,
  title: "2026 Shandong Provincial Government Scholarship at SDNU",
  nameZh: "2026年山东省政府奖学金（山东师范大学）",
  type: "government",
  typeLabel: "Shandong Provincial Government Scholarship",
  providerName: "山东省政府 / 山东师范大学",
  providerNameEn: "Shandong Provincial Government / Shandong Normal University",
  providerLocation: "Jinan, Shandong, China",
  fundingLevel: "Full",
  coverage: "Tuition, accommodation, monthly living stipend and medical insurance.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Eligible September 2026 master's and doctoral programs listed in the official scholarship attachments.",
  amountText: "Master: CNY 2,000/month living stipend for 3 academic years. Doctoral: CNY 2,500/month living stipend for 4 academic years. Tuition, accommodation and insurance are also covered.",
  requirementText: "Non-Chinese citizen in good health; master's applicants need a bachelor's degree and must be under 35; doctoral applicants need a master's degree and must be under 40; Chinese-taught routes require HSK 5 score 180 or above; English-taught routes require English evidence unless an exemption applies; applicants may not hold another scholarship.",
  deadlineDate: "2026-05-15",
  deadlineLabel: "May 15, 2026",
  applicationRound: "April 5-May 15, 2026",
  targetCountries: [],
  targetRegions: [],
  benefitItems: [
    { label: "Tuition", included: true },
    { label: "Accommodation", included: true },
    { label: "Monthly stipend", included: true, note: "CNY 2,000 for master's; CNY 2,500 for doctoral" },
    { label: "Medical insurance", included: true },
  ],
  eligibilityItems: [
    { label: "Citizenship and health", value: "Non-Chinese citizen in good health" },
    { label: "Master's applicants", value: "Bachelor's degree and under age 35" },
    { label: "Doctoral applicants", value: "Master's degree and under age 40" },
    { label: "Chinese-taught programs", value: "HSK 5 score 180 or above within the two-year validity period" },
    { label: "Other funding", value: "No other scholarship or funding" },
  ],
  applicationMaterials: [
    { label: "Passport copy" },
    { label: "Notarized highest diploma or expected-graduation proof" },
    { label: "Academic transcripts" },
    { label: "Language proficiency evidence" },
    { label: "Two recommendation letters" },
    { label: "Study plan or research proposal", value: "At least 800 words" },
    { label: "Certificate of no criminal record" },
    { label: "Physical examination report", value: "Issued within six months" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Register and submit the application through the SDNU international student online application system." },
    { label: "Step 2", value: "Track the application status through the registered account and email." },
    { label: "Step 3", value: "Review the admission result in the online application account." },
  ],
  actionLinks: [{ label: scholarshipSource.label, url: scholarshipSource.url, kind: "official-source" }],
  summary: "Closed 2026 full provincial-government scholarship for eligible SDNU master's and doctoral applicants.",
  status: "draft",
  sourceUrl: scholarshipSource.url,
  sourceLabel: scholarshipSource.label,
  sourceSha256: scholarshipSource.sha256,
  capturedAt: scholarshipSource.fetchedAt,
  sourceFieldLineage: {
    title: "official scholarship page heading",
    fundingLevel: "official coverage table",
    coverage: "official coverage table",
    applicableDegree: "official categories table",
    applicableProgram: "official specialties attachment statement",
    deadlineDate: "official application-time table",
    eligibilityItems: "official eligibility section",
    applicationMaterials: "official application-materials section",
    applicationSteps: "official application-procedures section",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Shandong Normal University",
    nameZh: "山东师范大学",
    citySlug,
    schoolType: "Public",
    region: "Jinan, Shandong, East China",
    applicationLevel: "Undergraduate, Master and Doctoral",
    languageOfInstruction: "Chinese and English depending on route",
    languageRequirement: "Reviewed Chinese-taught undergraduate routes require HSK 4 score 180 or above; reviewed English-taught routes require IELTS 6.0 or TOEFL 80 or above unless an approved exemption applies.",
    hskRequirement: "HSK Level 4 score 180 or above for reviewed Chinese-taught undergraduate routes.",
    englishRequirement: "IELTS 6.0 or TOEFL 80 or above for reviewed English-taught routes from non-English-speaking countries, subject to the published medium-of-instruction exemption.",
    deadlineSummary: "The reviewed Fall 2026 undergraduate window ran April 1-May 31, 2026 and is closed. The reviewed provincial scholarship window ran April 5-May 15, 2026 and is closed. No 2027 dates are inferred.",
    tuitionSummary: "Reviewed undergraduate tuition is CNY 14,000-18,000 per academic year depending on program. Accommodation is CNY 10,000/person/academic year.",
    applicationFee: "CNY 415 registration fee",
    websiteUrl: "https://www.sdnu.edu.cn/",
    admissionsUrl: "https://cie.sdnu.edu.cn/",
    cscaRequired: true,
    cscaRequirement: "Undergraduate applicants must take CSCA and submit the result; the reviewed guide does not publish program-specific subject combinations.",
    subjectTags: ["Education", "Chinese Language", "Business", "Fine Arts", "Chemical Engineering", "Physical Education"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Public normal university in Jinan", "International enrollment since 1983", "Reviewed undergraduate, master's and doctoral pathways"],
    status: "draft",
    sourceUrl: brochure.url,
    sourceLabel: brochure.label,
    sourceSha256: brochure.sha256,
    capturedAt: brochure.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official 2026 brochure title",
      nameZh: "official 2026 brochure title",
      citySlug: "official brochure contact address",
      applicationLevel: "official university profile and reviewed program/scholarship sources",
      languageOfInstruction: `program catalog ${catalog.sha256} and scholarship page ${scholarshipSource.sha256}`,
      languageRequirement: `2026 undergraduate brochure and scholarship page ${scholarshipSource.sha256}`,
      deadlineSummary: `2026 undergraduate brochure and scholarship page ${scholarshipSource.sha256}`,
      tuitionSummary: `program catalog ${catalog.sha256} and undergraduate brochure fee table`,
      applicationFee: "2026 undergraduate brochure fee table",
      admissionsUrl: "registered official admissions portal",
      cscaRequirement: "2026 undergraduate brochure eligibility section",
    },
  }],
  programs,
  programIntakes,
  scholarships: [scholarship],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 10 || validation.summary.programIntakes !== 10 || validation.summary.scholarships !== 1) {
  throw new Error(`SDNU candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    pdfPagesVisuallyInspected: 5,
    catalogImagesVisuallyInspected: 2,
    notes: [
      "All ten prohibited-source legacy undergraduate identities have exact current official catalog rows with Chinese and English titles, language, duration and tuition.",
      "The 2026 undergraduate intake and the 2026 provincial scholarship round are closed; no 2027 dates are inferred.",
      "The reviewed scholarship is a new distinct master's/doctoral provincial-government route and is not attached as an entitlement to the ten undergraduate programs.",
      "The official brochure requires CSCA but does not publish a program-specific subject combination, so no CSCA subjects are inferred.",
      "The scholarship page refers to separate specialty attachments; scholarship-to-program eligibility remains limited to the stated degree scope until those exact rows are acquired.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
