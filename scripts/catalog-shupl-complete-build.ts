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
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T11-56-12-422Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.shanghai-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.shupl-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.shupl-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const source = (manifest.sources as SourceRecord[]).find((row) => row.id === "shupl-international-admissions-2026");
const expectedSha256 = "c369cca864ccdda2b6d061ff6af5aaee360496aecf54bc9bf69604bd4d14eb0c";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) {
  throw new Error("SHUPL evidence mismatch");
}

const schoolSlug = "shanghai-university-of-political-science-and-law";
const citySlug = "shanghai";
type ProgramSpec = {
  suffix: string;
  nameEn: string;
  nameZh: string;
  category: string;
  language: "Chinese" | "English";
  tuition: number;
};
const programSpecs: ProgramSpec[] = [
  { suffix: "law-international-law", nameEn: "Law - International Law", nameZh: "法学（国际法）", category: "Law", language: "Chinese", tuition: 23000 },
  { suffix: "international-politics", nameEn: "International Politics", nameZh: "国际政治", category: "Political Science", language: "Chinese", tuition: 23000 },
  { suffix: "economics-and-finance", nameEn: "Economics and Finance", nameZh: "经济与金融", category: "Economics", language: "Chinese", tuition: 23000 },
  { suffix: "international-economy-and-trade", nameEn: "International Economy and Trade", nameZh: "国际经济与贸易", category: "International Trade", language: "Chinese", tuition: 23000 },
  { suffix: "business-chinese", nameEn: "Business Chinese", nameZh: "商务汉语", category: "Chinese Language", language: "Chinese", tuition: 21500 },
  { suffix: "teaching-chinese-to-speakers-of-other-languages", nameEn: "Teaching Chinese to Speakers of Other Languages", nameZh: "汉语国际教育", category: "Chinese Language", language: "Chinese", tuition: 21500 },
  { suffix: "electronic-commerce-and-law-english", nameEn: "Electronic Commerce and Law (English)", nameZh: "电子商务与法律（英文授课）", category: "Law", language: "English", tuition: 32000 },
  { suffix: "international-economy-and-trade-english", nameEn: "International Economy and Trade (English)", nameZh: "国际经济与贸易（英文授课）", category: "International Trade", language: "English", tuition: 32000 },
  { suffix: "international-politics-english", nameEn: "International Politics (English)", nameZh: "国际政治（英文授课）", category: "Political Science", language: "English", tuition: 32000 },
];
const programs: CatalogSeedProgram[] = programSpecs.map((spec) => ({
  slug: `${schoolSlug}-${spec.suffix}`,
  schoolSlug,
  citySlug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: spec.category,
  subjectArea: spec.nameEn.replace(" (English)", ""),
  teachingLanguage: spec.language,
  cscaRequirement: "All international undergraduate applicants must submit a valid CSCA score report. The reviewed page links a separate subject attachment, so route-specific subjects remain unresolved here.",
  tuitionAmount: spec.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/academic year`,
  applicationUrl: source.url,
  applicationNote: "Fall 2026 international undergraduate route. The official guide does not publish an exact general application deadline, so no deadline is inferred.",
  hasScholarship: true,
  scholarshipText: "The 2026 guide lists Chinese Government, Shanghai Government and Belt and Road scholarship categories.",
  status: "draft",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "editorial English rendering of the exact official program row; requires review",
    nameZh: "2026 guide program table",
    degreeLevel: "2026 guide undergraduate section",
    durationYears: "2026 guide undergraduate heading and fee table",
    teachingLanguage: "2026 guide program and fee tables",
    cscaRequirement: "2026 guide application-materials and application-process sections",
    tuitionAmount: "2026 guide undergraduate fee table",
    applicationUrl: "registered official 2026 admission guide",
  },
}));

const scholarship = (
  slug: string,
  title: string,
  nameZh: string,
  type: CatalogSeedScholarship["type"],
  typeLabel: string,
  fundingLevel: string,
  coverage: string,
  benefitItems: CatalogSeedScholarship["benefitItems"],
  summary: string,
): CatalogSeedScholarship => ({
  slug,
  schoolSlug,
  title,
  nameZh,
  type,
  typeLabel,
  providerName: nameZh.includes("上海市") ? "上海市政府 / 上海政法学院" : nameZh.includes("中国政府") ? "中国政府 / 上海政法学院" : "上海政法学院",
  providerNameEn: nameZh.includes("上海市") ? "Shanghai Municipal Government / Shanghai University of Political Science and Law" : nameZh.includes("中国政府") ? "Chinese Government / Shanghai University of Political Science and Law" : "Shanghai University of Political Science and Law",
  providerLocation: "Shanghai, China",
  fundingLevel,
  coverage,
  applicableDegree: "Category-specific scope in the 2026 international student guide; exact route eligibility remains subject to the selected award category.",
  applicableProgram: "Eligible 2026 SHUPL international student programs under the selected scholarship category.",
  amountText: coverage,
  applicationRound: "2026 international student admission",
  targetCountries: [],
  targetRegions: [],
  benefitItems,
  eligibilityItems: [{ label: "Eligibility", value: "Category-specific scholarship requirements apply; the general 2026 guide does not publish a complete universal eligibility rule." }],
  applicationMaterials: [{ label: "Materials required by the selected scholarship category" }],
  applicationSteps: [{ label: "Step 1", value: "Apply through the SHUPL international student system and select the appropriate scholarship route." }],
  actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }],
  summary,
  status: "draft",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    title: "2026 guide scholarship table",
    fundingLevel: "2026 guide scholarship table",
    coverage: "2026 guide scholarship table",
    applicableDegree: "unresolved beyond the category descriptions in the general guide",
  },
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship(
    schoolSlug,
    "SHUPL Belt and Road Scholarship",
    "上海政法学院“一带一路”奖学金",
    "university",
    "Belt and Road Scholarship",
    "Full, partial or stipend",
    "Category A waives tuition and accommodation; Category B waives tuition; Category C pays CNY 1,000/month for 10 months and is limited to language students.",
    [{ label: "Tuition", included: true, note: "Categories A and B" }, { label: "Accommodation", included: true, note: "Category A" }, { label: "Living stipend", included: true, note: "Category C: CNY 1,000/month for 10 months, language students only" }],
    "2026 Belt and Road scholarship categories; exact deadline and route-specific eligibility remain unresolved.",
  ),
  scholarship(
    `${schoolSlug}-48`,
    "Shanghai Government Scholarship at SHUPL",
    "上海政法学院上海市政府奖学金",
    "government",
    "Shanghai Government Scholarship",
    "Full or partial",
    "Category A covers tuition, accommodation, living allowance and comprehensive medical insurance; Category B covers tuition and comprehensive medical insurance.",
    [{ label: "Tuition", included: true }, { label: "Accommodation", included: true, note: "Category A" }, { label: "Living allowance", included: true, note: "Category A" }, { label: "Comprehensive medical insurance", included: true }],
    "2026 Shanghai Government Scholarship categories; exact deadline and route-specific eligibility remain unresolved.",
  ),
  scholarship(
    `${schoolSlug}-49`,
    "Chinese Government Scholarship at SHUPL",
    "上海政法学院中国政府奖学金",
    "government",
    "Chinese Government Scholarship",
    "Full or partial",
    "Full scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance; partial awards cover one or more of those items.",
    [{ label: "Tuition", included: true }, { label: "Accommodation", included: true }, { label: "Living allowance", included: true }, { label: "Comprehensive medical insurance", included: true }],
    "2026 Chinese Government Scholarship category; the guide says applicants should submit no later than May but gives no exact date.",
  ),
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Shanghai University of Political Science and Law",
    nameZh: "上海政法学院",
    citySlug,
    schoolType: "Public",
    region: "Shanghai, East China",
    applicationLevel: "Undergraduate, Master and Non-degree",
    languageOfInstruction: "Chinese and English",
    languageRequirement: "Degree applicants must provide the applicable Chinese-language certificate; the general guide does not publish one universal score threshold.",
    deadlineSummary: "The reviewed guide covers Fall 2026 but does not publish an exact general deadline. Chinese Government Scholarship applicants are told to submit no later than May 2026 without an exact day.",
    tuitionSummary: "Reviewed undergraduate tuition ranges from CNY 21,500 to CNY 32,000/year; master's tuition ranges from CNY 25,000 to CNY 50,000/year.",
    applicationFee: "CNY 400",
    websiteUrl: "https://www.shupl.edu.cn/",
    admissionsUrl: source.url,
    cscaRequired: true,
    cscaRequirement: "All international undergraduate applicants must take CSCA and submit a valid score report; route-specific subjects remain in a separate attachment not acquired in this batch.",
    subjectTags: ["Law", "Political Science", "International Trade", "Economics", "Chinese Language"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Political science and law focus", "Chinese- and English-taught international programs", "Qingpu District campus"],
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official contact section",
      nameZh: "official guide title",
      citySlug: "official contact address",
      applicationLevel: "2026 guide program sections",
      languageOfInstruction: "2026 guide program tables",
      languageRequirement: "2026 guide application-materials section",
      deadlineSummary: "2026 guide application-materials note; exact general deadline unresolved",
      tuitionSummary: "2026 guide fee tables",
      applicationFee: "2026 guide fee section",
      admissionsUrl: "registered official 2026 guide",
      cscaRequirement: "2026 guide application-materials and process sections",
    },
  }],
  programs,
  programIntakes: [],
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The official guide exactly supports the school, all nine legacy undergraduate identities and all three legacy scholarship categories.",
      "No intake rows are created because the Fall 2026 guide does not publish an exact general application deadline or explicit close date.",
      "The linked CSCA subject attachment was not acquired, so route-specific CSCA subjects remain unresolved.",
      "Scholarship coverage is recorded exactly, while category-specific eligibility and exact deadlines remain unresolved.",
      "English titles are editorial renderings of the official Chinese rows and remain review-required.",
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
