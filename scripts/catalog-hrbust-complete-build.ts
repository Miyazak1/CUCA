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
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T13-17-11-551Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.harbin-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.hrbust-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.hrbust-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>((manifest.sources as SourceRecord[]).map((row) => [row.id, row]));
const expected = {
  "hrbust-international-undergraduate-admissions-2026": "8e4bc248eaaeec322074a5f6240995993cd9ff1dd03edb66a9de7688fb2626d3",
  "hrbust-undergraduate-program-catalog-current": "bbb136b24605ff5fd54c9e2bf5122a7a87d4a487ad19b503f715871b46ec376a",
  "hrbust-cgs-silk-road-2026": "ca0641dbb4a396de97c8a66ad6af2097f281d82cec225337951d7c5efb057c20",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`HRBUST evidence mismatch: ${id}`);
}
const guide = sources.get("hrbust-international-undergraduate-admissions-2026")!;
const catalog = sources.get("hrbust-undergraduate-program-catalog-current")!;
const silkRoad = sources.get("hrbust-cgs-silk-road-2026")!;
const schoolSlug = "harbin-university-of-science-and-technology";
const citySlug = "harbin";

type ProgramSpec = { suffix: string; nameEn: string; nameZh: string; category: string; chineseEducation?: boolean };
const specs: ProgramSpec[] = [
  { suffix: "chinese-language-education", nameEn: "Chinese Language Education", nameZh: "汉语国际教育", category: "Chinese Language", chineseEducation: true },
  { suffix: "accounting", nameEn: "Accounting", nameZh: "会计学", category: "Accounting" },
  { suffix: "automation", nameEn: "Automation", nameZh: "自动化", category: "Automation" },
  { suffix: "international-economy-and-trade", nameEn: "International Economy and Trade", nameZh: "国际经济与贸易", category: "International Trade" },
  { suffix: "marketing", nameEn: "Marketing", nameZh: "市场营销", category: "Business Administration" },
  { suffix: "mechanical-design-manufacture-and-its-automation", nameEn: "Mechanical Design, Manufacture and Automation", nameZh: "机械设计制造及其自动化", category: "Mechanical Engineering" },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => ({
  slug: `${schoolSlug}-${spec.suffix}`,
  schoolSlug,
  citySlug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: spec.chineseEducation ? 4 : undefined,
  fieldCategory: spec.category,
  subjectArea: spec.category,
  teachingLanguage: "Chinese",
  cscaSubjects: spec.chineseEducation ? ["Mathematics (Chinese or English)"] : ["STEM Chinese", "Mathematics (Chinese)"],
  cscaRequirement: spec.chineseEducation
    ? "Submit a CSCA Mathematics result; the examination may be taken in Chinese or English."
    : "Submit CSCA STEM Chinese and Mathematics results, with Mathematics taken in Chinese.",
  hskRequirement: spec.chineseEducation ? "No HSK certificate is required for the dedicated Chinese Language Education cohort." : "HSK Level 4 or above, valid for the application period.",
  tuitionAmount: 15000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 15,000/academic year",
  applicationUrl: guide.url,
  applicationNote: "Fall 2026 international undergraduate route. The published March 1-June 15 application window is closed.",
  hasScholarship: false,
  status: "draft",
  sourceUrl: spec.chineseEducation ? guide.url : catalog.url,
  sourceLabel: spec.chineseEducation ? guide.label : catalog.label,
  sourceSha256: spec.chineseEducation ? guide.sha256 : catalog.sha256,
  capturedAt: spec.chineseEducation ? guide.fetchedAt : catalog.fetchedAt,
  sourceFieldLineage: {
    nameZh: spec.chineseEducation ? "official 2026 international undergraduate guide" : "current official undergraduate program catalog",
    nameEn: "editorial English rendering of the exact official Chinese program name; requires review",
    degreeLevel: "official 2026 international undergraduate guide",
    ...(spec.chineseEducation ? { durationYears: "official dedicated-cohort description" } : {}),
    teachingLanguage: "official 2026 international undergraduate guide and HSK requirement",
    cscaSubjects: "official 2026 CSCA section",
    cscaRequirement: "official 2026 CSCA section",
    hskRequirement: "official 2026 eligibility section",
    tuitionAmount: "official 2026 fees section",
    applicationUrl: "registered official 2026 international undergraduate guide",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  openDate: "2026-02-28T16:00:00.000Z",
  deadlineDate: "2026-06-15T15:59:59.000Z",
  deadlineLabel: "June 15, 2026",
  applicationRound: "2026 international undergraduate admission",
  status: "closed" as const,
  sourceUrl: guide.url,
  sourceLabel: guide.label,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
  sourceFieldLineage: {
    openDate: "official annual March 1 application opening",
    deadlineDate: "official annual June 15 application deadline",
    intakeYear: "official 2026 guide title and late-August start",
  },
}));

const scholarship: CatalogSeedScholarship = {
  slug: "hrbust-chinese-government-scholarship-silk-road-electrical-engineering-2026",
  schoolSlug,
  title: "Chinese Government Scholarship Silk Road Electrical Engineering Program at HRBUST 2026",
  nameZh: "哈尔滨理工大学中国政府奖学金丝绸之路电气工程项目 2026",
  type: "government",
  typeLabel: "Chinese Government Scholarship Silk Road Program",
  providerName: "中国政府 / 哈尔滨理工大学",
  providerNameEn: "Chinese Government / Harbin University of Science and Technology",
  providerLocation: "Harbin, Heilongjiang, China",
  fundingLevel: "Full scholarship",
  coverage: "Registration, tuition, laboratory, internship and basic textbook fees; on-campus accommodation; comprehensive medical insurance; and living allowance of CNY 3,000/month for master's students or CNY 3,500/month for doctoral students.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Electrical Engineering, including the five published second-level fields, in Chinese or English.",
  amountText: "CNY 3,000/month for master's students or CNY 3,500/month for doctoral students, plus the published fee waivers, accommodation and insurance.",
  requirementText: "Citizens of Belt and Road partner countries applying for Electrical Engineering. Master's applicants must hold a bachelor's degree and be under 35; doctoral applicants must hold a master's degree and be under 40. Chinese routes require HSK Level 4 or above; English routes require TOEFL, IELTS or qualifying prior English-medium evidence.",
  deadlineDate: "2026-05-31",
  deadlineLabel: "May 31, 2026",
  applicationRound: "2026 Silk Road Chinese Government Scholarship",
  targetCountries: [],
  targetRegions: ["Belt and Road partner countries"],
  benefitItems: [
    { label: "Tuition and required study fees", included: true },
    { label: "On-campus accommodation", included: true },
    { label: "Living allowance", included: true, note: "CNY 3,000/month master; CNY 3,500/month doctoral" },
    { label: "Comprehensive medical insurance", included: true },
  ],
  eligibilityItems: [
    { label: "Citizenship", value: "Citizen of a Belt and Road partner country" },
    { label: "Major", value: "Electrical Engineering" },
    { label: "Master", value: "Bachelor's degree holder under age 35" },
    { label: "Doctoral", value: "Master's degree holder under age 40" },
  ],
  applicationMaterials: [{ label: "Core materials", value: "CSC form, passport, notarized diploma, transcripts, language proof, study plan, two academic recommendations, physical examination, no-criminal-record certificate and optional supervisor confirmation" }],
  applicationSteps: [
    { label: "Step 1", value: "Contact HRBUST International Cooperation and Exchange before the deadline." },
    { label: "Step 2", value: "Submit a CSC Program Type B application using agency number 10214." },
  ],
  actionLinks: [{ label: silkRoad.label, url: silkRoad.url, kind: "official-source" }],
  summary: "Closed 2026 full Silk Road scholarship for eligible master's and doctoral Electrical Engineering applicants.",
  status: "draft",
  sourceUrl: silkRoad.url,
  sourceLabel: silkRoad.label,
  sourceSha256: silkRoad.sha256,
  capturedAt: silkRoad.fetchedAt,
  sourceFieldLineage: {
    title: "official 2026 guide title and project-name section",
    fundingLevel: "official funding section",
    coverage: "official funding section",
    applicableDegree: "official project and duration sections",
    applicableProgram: "official program section",
    requirementText: "official language and eligibility sections",
    deadlineDate: "official application-route and deadline section",
    applicationSteps: "official application-process section",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Harbin University of Science and Technology",
    nameZh: "哈尔滨理工大学",
    citySlug,
    schoolType: "Public",
    region: "Harbin, Heilongjiang, Northeast China",
    applicationLevel: "Undergraduate, Master and Doctoral",
    languageOfInstruction: "Chinese for the reviewed undergraduate routes; the reviewed Silk Road graduate route may be Chinese or English",
    languageRequirement: "Ordinary undergraduate routes require HSK Level 4; the dedicated Chinese Language Education cohort accepts applicants without prior Chinese. Graduate scholarship language rules depend on teaching language.",
    hskRequirement: "HSK Level 4 or above for ordinary undergraduate study; no HSK certificate for the dedicated Chinese Language Education cohort.",
    deadlineSummary: "The Fall 2026 undergraduate window ran March 1-June 15 and is closed. The 2026 Silk Road scholarship closed May 31. No 2027 date is inferred.",
    tuitionSummary: "CNY 15,000/year for the reviewed 2026 international undergraduate routes.",
    websiteUrl: "https://www.hrbust.edu.cn/",
    admissionsUrl: guide.url,
    cscaRequired: true,
    cscaRequirement: "Chinese Language Education requires CSCA Mathematics in Chinese or English. Ordinary undergraduate routes require STEM Chinese and Mathematics in Chinese.",
    cscaSubjects: ["STEM Chinese", "Mathematics"],
    subjectTags: [...new Set(specs.map((spec) => spec.category))],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Science and engineering focus", "Dedicated Chinese Language Education cohort", "Nangang District campus"],
    contactNotes: "International Cooperation and Exchange: +86-451-86390081; jinjiyong@hrbust.edu.cn; 52 Xuefu Road, Nangang District, Harbin.",
    status: "draft",
    sourceUrl: guide.url,
    sourceLabel: guide.label,
    sourceSha256: guide.sha256,
    capturedAt: guide.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official institution identity",
      nameZh: "official 2026 guide title",
      citySlug: "official contact address",
      applicationLevel: "official undergraduate guide and scholarship guide",
      languageOfInstruction: "official undergraduate and scholarship language sections",
      languageRequirement: "official undergraduate eligibility and scholarship language sections",
      deadlineSummary: "official undergraduate and scholarship deadline sections",
      tuitionSummary: "official undergraduate fees section",
      admissionsUrl: "registered official 2026 guide",
      cscaRequirement: "official undergraduate CSCA section",
    },
  }],
  programs,
  programIntakes,
  scholarships: [scholarship],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 6 || validation.summary.programIntakes !== 6 || validation.summary.scholarships !== 1) {
  throw new Error(`HRBUST candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The dedicated Chinese Language Education cohort is explicitly named in the 2026 international guide.",
      "The five legacy undergraduate identities are included only because each exact Chinese identity is present in the current official undergraduate catalog and the international guide permits ordinary current-plan majors for qualified applicants.",
      "Duration is recorded only for Chinese Language Education because the reviewed international guide publishes that route's four-year duration; no duration is inferred for the five ordinary majors.",
      "All six 2026 undergraduate intake rows are closed and no 2027 date is inferred.",
      "The Silk Road scholarship is a separate closed graduate Electrical Engineering route and is not attached as an undergraduate entitlement.",
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
