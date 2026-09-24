import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T12-55-06-662Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.shanghai-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.ecupl-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ecupl-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>((manifest.sources as SourceRecord[]).map((row) => [row.id, row]));
const expected = {
  "ecupl-international-undergraduate-admissions-2026": "830ad26e35089e6adfa212e328b09726184f0554dabdb6cbc7dea0e0cdb6ec84",
  "ecupl-international-undergraduate-program-catalog-xls-2026": "7eeb1e3c8dd1abafb5321f3fee0d1ac021c54a65c3903b38047582b1797244f6",
  "ecupl-undergraduate-csca-subjects-docx-2026": "95c79f83c33489afa6f5e49d486eabae5cd634c14cf4694d144ac3a0080a4cf3",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`ECUPL evidence mismatch: ${id}`);
}
const page = sources.get("ecupl-international-undergraduate-admissions-2026")!;
const catalog = sources.get("ecupl-international-undergraduate-program-catalog-xls-2026")!;
const csca = sources.get("ecupl-undergraduate-csca-subjects-docx-2026")!;
const schoolSlug = "east-china-university-of-political-science-and-law";
const citySlug = "shanghai";

type ProgramSpec = {
  suffix: string;
  nameEn: string;
  nameZh: string;
  category: string;
  language: "Chinese" | "English";
  tuition: number;
  businessChinese?: boolean;
};
const specs: ProgramSpec[] = [
  { suffix: "law", nameEn: "Law", nameZh: "法学", category: "Law", language: "Chinese", tuition: 24000 },
  { suffix: "intellectual-property", nameEn: "Intellectual Property", nameZh: "知识产权学", category: "Law", language: "Chinese", tuition: 24000 },
  { suffix: "economic-crime-investigation", nameEn: "Economic Crime Investigation", nameZh: "经济侦查学", category: "Criminal Justice", language: "Chinese", tuition: 24000 },
  { suffix: "criminal-investigation", nameEn: "Criminal Investigation", nameZh: "刑事侦查学", category: "Criminal Justice", language: "Chinese", tuition: 24000 },
  { suffix: "political-science-and-public-administration", nameEn: "Political Science and Public Administration", nameZh: "政治学与行政学", category: "Political Science", language: "Chinese", tuition: 24000 },
  { suffix: "public-administration", nameEn: "Public Administration", nameZh: "行政管理", category: "Public Administration", language: "Chinese", tuition: 24000 },
  { suffix: "labor-and-social-security", nameEn: "Labor and Social Security", nameZh: "劳动与社会保障", category: "Public Administration", language: "Chinese", tuition: 24000 },
  { suffix: "sociology", nameEn: "Sociology", nameZh: "社会学", category: "Sociology", language: "Chinese", tuition: 24000 },
  { suffix: "social-policy", nameEn: "Social Policy", nameZh: "社会政策", category: "Sociology", language: "Chinese", tuition: 24000 },
  { suffix: "social-work", nameEn: "Social Work", nameZh: "社会工作", category: "Social Work", language: "Chinese", tuition: 24000 },
  { suffix: "journalism", nameEn: "Journalism", nameZh: "新闻学", category: "Journalism", language: "Chinese", tuition: 24000 },
  { suffix: "cultural-industry-management", nameEn: "Cultural Industry Management", nameZh: "文化产业管理", category: "Culture Management", language: "Chinese", tuition: 24000 },
  { suffix: "network-and-new-media", nameEn: "Network and New Media", nameZh: "网络与新媒体", category: "Media and Communication", language: "Chinese", tuition: 24000 },
  { suffix: "business-chinese-communication", nameEn: "Business Chinese Communication", nameZh: "商务汉语传播", category: "Chinese Language", language: "Chinese", tuition: 22000, businessChinese: true },
  { suffix: "international-business-law", nameEn: "International Business Law", nameZh: "国际商法（英文授课）", category: "Law", language: "English", tuition: 30000 },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const english = spec.language === "English";
  const cscaSubjects = english ? ["Mathematics (English)"] : ["Liberal Arts Chinese", "Mathematics (Chinese or English)"];
  const languageRequirement = english
    ? "Pass the university's English telephone interview; applicants educated in English at secondary-school level generally do not need a separate English certificate."
    : spec.businessChinese
      ? "HSK Level 3 is required for admission. An applicant with a valid HSK Level 4 score may be exempt from the CSCA Liberal Arts Chinese subject."
      : "HSK Level 4 is required; applicants educated in Chinese at secondary-school level generally do not need a separate HSK certificate.";
  return {
    slug: `${schoolSlug}-${spec.suffix}`,
    schoolSlug,
    citySlug,
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: 4,
    fieldCategory: spec.category,
    subjectArea: spec.category,
    teachingLanguage: spec.language,
    cscaSubjects,
    cscaRequirement: english
      ? "All undergraduate applicants must take CSCA Mathematics. The English-taught route does not require a Professional Chinese subject."
      : spec.businessChinese
        ? "All undergraduate applicants must take CSCA Mathematics. The Chinese-taught route also requires Liberal Arts Chinese, except that a valid HSK Level 4 score exempts the Business Chinese applicant from that subject."
        : "All undergraduate applicants must take CSCA Mathematics; Chinese-taught applicants must also take Liberal Arts Chinese.",
    hskRequirement: spec.language === "Chinese" ? languageRequirement : undefined,
    englishRequirement: spec.language === "English" ? languageRequirement : undefined,
    tuitionAmount: spec.tuition,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/academic year`,
    applicationUrl: page.url,
    applicationNote: "Fall 2026 self-funded international undergraduate application. The reviewed window remains open through September 30, 2026.",
    hasScholarship: true,
    scholarshipText: "The admission guide links Chinese Government Scholarship and Shanghai Government Scholarship routes; the scholarship application deadline was April 30, 2026.",
    status: "draft",
    sourceUrl: catalog.url,
    sourceLabel: catalog.label,
    sourceSha256: catalog.sha256,
    capturedAt: catalog.fetchedAt,
    sourceFieldLineage: {
      nameZh: "official 2026 undergraduate program catalog XLS",
      nameEn: "editorial English rendering of the exact official Chinese program row; requires review",
      degreeLevel: "official admission-guide title and program section",
      durationYears: "official admission-guide program introduction",
      teachingLanguage: "official admission-guide program introduction and catalog row",
      cscaSubjects: "official 2026 CSCA subjects DOCX",
      cscaRequirement: "official 2026 CSCA subjects DOCX",
      ...(spec.language === "Chinese" ? { hskRequirement: "official admission-guide language section and CSCA attachment exemption rule" } : {}),
      ...(spec.language === "English" ? { englishRequirement: "official admission-guide language section" } : {}),
      tuitionAmount: "official 2026 undergraduate program catalog XLS and admission-guide tuition section",
      applicationUrl: "registered official 2026 admission guide",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  openDate: "2026-04-30T16:00:00.000Z",
  deadlineDate: "2026-09-30T15:59:59.000Z",
  deadlineLabel: "September 30, 2026",
  applicationRound: "2026 self-funded international undergraduate admission",
  status: "open" as const,
  sourceUrl: page.url,
  sourceLabel: page.label,
  sourceSha256: page.sha256,
  capturedAt: page.fetchedAt,
  sourceFieldLineage: {
    openDate: "official admission-guide application-time section",
    deadlineDate: "official admission-guide application-time section",
    intakeYear: "official admission-guide title",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "East China University of Political Science and Law",
    nameZh: "华东政法大学",
    citySlug,
    schoolType: "Public",
    region: "Shanghai, East China",
    applicationLevel: "Undergraduate",
    languageOfInstruction: "Chinese, plus one reviewed English-taught International Business Law route",
    languageRequirement: "Chinese-taught routes generally require HSK Level 4; Business Chinese Communication requires HSK Level 3. The English-taught route requires an English telephone interview. Published prior-medium exemptions apply.",
    hskRequirement: "HSK Level 4 for Chinese-taught routes; HSK Level 3 for Business Chinese Communication, subject to published prior-Chinese-medium and CSCA exemptions.",
    englishRequirement: "Pass the university's English telephone interview; applicants educated in English at secondary-school level generally do not need a separate English certificate.",
    deadlineSummary: "Scholarship applications closed April 30, 2026. Self-funded Fall 2026 applications are open May 1-September 30, 2026. No 2027 dates are inferred.",
    tuitionSummary: "CNY 24,000/year for Chinese-taught routes, CNY 22,000/year for Business Chinese Communication and CNY 30,000/year for International Business Law in English.",
    applicationFee: "CNY 400",
    websiteUrl: "https://www.ecupl.edu.cn/",
    admissionsUrl: page.url,
    cscaRequired: true,
    cscaRequirement: "All undergraduate applicants take Mathematics. Chinese-taught applicants also take Liberal Arts Chinese; the English-taught route is exempt, and Business Chinese applicants with valid HSK Level 4 may be exempt.",
    cscaSubjects: ["Liberal Arts Chinese", "Mathematics (Chinese or English)"],
    subjectTags: [...new Set(specs.map((spec) => spec.category))],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Law-focused public university", "15 reviewed international undergraduate routes", "Songjiang, Changning and Putuo campuses"],
    contactNotes: "International Education College: 50256@ecupl.edu.cn, +86-21-57090652. Published address: 555 Longyuan Road, Songjiang District, Shanghai.",
    status: "draft",
    sourceUrl: page.url,
    sourceLabel: page.label,
    sourceSha256: page.sha256,
    capturedAt: page.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official page identity",
      nameZh: "official admission-guide title",
      citySlug: "official contact address",
      applicationLevel: "official admission-guide title and program introduction",
      languageOfInstruction: "official admission-guide program introduction",
      languageRequirement: "official admission-guide language section",
      deadlineSummary: "official admission-guide application-time section",
      tuitionSummary: "official admission-guide tuition section and official program catalog XLS",
      applicationFee: "official admission-guide tuition section and official program catalog XLS",
      admissionsUrl: "registered official 2026 admission guide",
      cscaRequirement: "official 2026 CSCA subjects DOCX",
    },
  }],
  programs,
  programIntakes,
  scholarships: [],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 15 || validation.summary.programIntakes !== 15 || validation.summary.scholarships !== 0) {
  throw new Error(`ECUPL candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    docxTextStructurallyInspected: true,
    docxVisualInspectionBlocked: "The bundled workspace runtime does not include LibreOffice, so the read-only DOCX source could not be rendered to page images.",
    notes: [
      "The official XLS contains exactly 15 populated undergraduate program rows; its two additional sheets are empty.",
      "All 15 program identities and tuition amounts are transcribed from the official XLS. English titles are editorial renderings and remain review-required.",
      "The official CSCA DOCX requires Mathematics for every undergraduate applicant, Liberal Arts Chinese for Chinese-taught applicants, and no Professional Chinese subject for the English-taught route.",
      "Business Chinese applicants need HSK Level 3 for admission; only a valid HSK Level 4 score supports the published CSCA Liberal Arts Chinese exemption.",
      "The Fall 2026 self-funded route is open through September 30, 2026. The scholarship round closed April 30, 2026; no 2027 dates are inferred.",
      "No scholarship rows are created because the guide links generic government-scholarship portals without publishing complete route-specific eligibility and coverage.",
      "Legacy Accounting, Business Administration and Economics identities do not appear in the current official catalog and are not force-mapped.",
    ],
  },
  sourceEvidence: {
    admissionGuideSha256: page.sha256,
    programCatalogXlsSha256: catalog.sha256,
    cscaSubjectsDocxSha256: csca.sha256,
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
