import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T05-35-36-737Z";
const sourceId = "lanzhou-university-self-support-programs-pdf-2022";
const lockedSha256 = "26c67d2eb8d93e6f3af43adc16a5a8c7b74e76581130658a0a9a1b7a0c674a9c";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === lockedSha256);
if (!source) throw new Error("Missing locked Lanzhou University official prospectus.");
const artifact = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== lockedSha256) throw new Error("Lanzhou University evidence hash mismatch.");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "lanzhou-university";
const citySlug = "lanzhou";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Lanzhou University already exists in the reviewed base.");
if (dependency.cities?.some((row) => row.slug === citySlug)) throw new Error("Lanzhou city already exists in the reviewed base; remove the new city record.");

const city = {
  slug: citySlug,
  nameEn: "Lanzhou",
  nameZh: "兰州",
  province: "Gansu",
  region: "Northwest China",
  tags: ["Gansu", "provincial-capital", "Northwest China"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "official guide mailing address; standardized English city name", nameZh: "official guide mailing address", province: "official guide mailing address", region: "CUAC geographic taxonomy derived from verified provincial location", tags: "CUAC geographic classification" },
};

const school = {
  slug: schoolSlug,
  nameEn: "Lanzhou University",
  nameZh: "兰州大学",
  citySlug,
  schoolType: "Comprehensive university directly under the Ministry of Education",
  region: "Lanzhou, Gansu, Northwest China",
  applicationLevel: "Language, Visiting, Bachelor, Master and Doctoral were admitted in the 2022 self-funded prospectus; current 2027 levels are not published",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "The 2022 guide states level- and subject-specific HSK thresholds for Chinese-taught degrees and IELTS 5.5 or TOEFL 80 for English-taught degrees. Current-cycle thresholds remain unverified.",
  hskRequirement: "2022 guide: bachelor literature/history/philosophy HSK 4 (210); Chinese Language or BTCSOL HSK 4 (210) plus HSKK Intermediate (60); other bachelor majors HSK 4 (195). Graduate literature/history/philosophy HSK 5 (180); MTCSOL HSK 5 (210) plus HSKK Intermediate (60); other graduate majors HSK 4 (210).",
  englishRequirement: "2022 guide: IELTS 5.5, TOEFL 80 or other proof of English proficiency; native English speakers exempt. Current-cycle thresholds remain unverified.",
  deadlineSummary: "The newest directly retrievable official inbound prospectus found is from 2022. No 2026 or 2027 international-student deadline is asserted.",
  tuitionSummary: "The 2022 guide publishes category-based tuition from CNY 20,000 to 40,000/year for bachelor, CNY 25,000 to 45,000/year for master and CNY 30,000 to 50,000/year for doctoral study; current tuition is unknown.",
  websiteUrl: "https://www.lzu.edu.cn/",
  admissionsUrl: sourceFields.sourceUrl,
  subjectTags: ["Chinese Language", "Liberal Arts", "Natural Sciences", "Medicine", "General Visiting Study"],
  languageTags: ["Chinese", "English", "HSK", "IELTS 5.5", "TOEFL 80"],
  campusHighlights: ["Official self-funded international prospectus located", "Current 2027 catalog still required", "No old-cycle field relabeled as current"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official prospectus title", nameZh: "official university identity", citySlug: "official guide mailing address", schoolType: "official prospectus institution profile", region: "official guide mailing address plus CUAC taxonomy", applicationLevel: "official 2022 prospectus categories with explicit freshness limitation", languageOfInstruction: "official 2022 language requirements", languageRequirement: "official 2022 language requirements with current-cycle limitation", hskRequirement: "official 2022 guide", englishRequirement: "official 2022 guide", deadlineSummary: "official source discovery and explicit stale-cycle control", tuitionSummary: "official 2022 fee appendix with current-cycle limitation", admissionsUrl: "captured official prospectus PDF",
  },
};

const programs = [
  {
    slug: `${schoolSlug}-chinese-language-one-semester-2022`, schoolSlug, citySlug, nameEn: "Chinese Language Program (One Semester)", nameZh: "汉语进修（一学期）", degreeLevel: "Language Program", durationMonths: 5, fieldCategory: "Languages and Culture", subjectArea: "Chinese Language", teachingLanguage: "Chinese", tuitionAmount: 8000, tuitionCurrency: "CNY", tuitionPeriod: "semester", tuitionText: "CNY 8,000 per semester in the 2022 guide; current tuition is not established.", applicationNote: "2022 self-funded route. Applicants were required to be non-Chinese citizens in good health, hold at least a high-school diploma or equivalent, and be under age 50.", hasScholarship: false, badgeText: "2022 official route", displayTuition: "CNY 8,000/semester (2022)", displaySubjects: ["Chinese Language"], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...sourceFields,
    sourceFieldLineage: { nameEn: "official fee appendix", nameZh: "standard Chinese rendering of official category", degreeLevel: "official non-degree category", durationMonths: "official one-semester category normalized to five months", teachingLanguage: "official language-program identity", tuitionAmount: "official 2022 fee appendix", tuitionPeriod: "official 2022 fee appendix", tuitionText: "official 2022 amount plus freshness limitation", applicationNote: "official 2022 eligibility section", badgeText: "official guide cycle" },
  },
  {
    slug: `${schoolSlug}-chinese-language-one-year-2022`, schoolSlug, citySlug, nameEn: "Chinese Language Program (One Year)", nameZh: "汉语进修（一学年）", degreeLevel: "Language Program", durationYears: 1, fieldCategory: "Languages and Culture", subjectArea: "Chinese Language", teachingLanguage: "Chinese", tuitionAmount: 15000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 15,000 per year in the 2022 guide; current tuition is not established.", applicationNote: "2022 self-funded route. Applicants were required to be non-Chinese citizens in good health, hold at least a high-school diploma or equivalent, and be under age 50.", hasScholarship: false, badgeText: "2022 official route", displayTuition: "CNY 15,000/year (2022)", displaySubjects: ["Chinese Language"], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...sourceFields,
    sourceFieldLineage: { nameEn: "official fee appendix", nameZh: "standard Chinese rendering of official category", degreeLevel: "official non-degree category", durationYears: "official one-year category", teachingLanguage: "official language-program identity", tuitionAmount: "official 2022 fee appendix", tuitionPeriod: "official 2022 fee appendix", tuitionText: "official 2022 amount plus freshness limitation", applicationNote: "official 2022 eligibility section", badgeText: "official guide cycle" },
  },
];

const programIntakes = [
  { programSlug: programs[0].slug, intakeTerm: "Spring 2022", intakeYear: 2022, deadlineDate: "2021-12-31T15:59:59.000Z", deadlineLabel: "The 2022 guide accepted spring language-program applications from September 1 through December 31.", applicationRound: "Spring 2022 self-funded language route", status: "closed" as const, ...sourceFields, sourceFieldLineage: { intakeTerm: "official guide spring-semester label", intakeYear: "official guide title", deadlineDate: "official application window converted from Beijing end-of-day", deadlineLabel: "official application-time section", applicationRound: "official guide category and cycle" } },
  { programSlug: programs[0].slug, intakeTerm: "Fall 2022", intakeYear: 2022, deadlineDate: "2022-06-30T15:59:59.000Z", deadlineLabel: "The 2022 guide accepted fall language-program applications from January 1 through June 30.", applicationRound: "Fall 2022 self-funded language route", status: "closed" as const, ...sourceFields, sourceFieldLineage: { intakeTerm: "official guide fall-semester label", intakeYear: "official guide title", deadlineDate: "official application window converted from Beijing end-of-day", deadlineLabel: "official application-time section", applicationRound: "official guide category and cycle" } },
  { programSlug: programs[1].slug, intakeTerm: "Fall 2022", intakeYear: 2022, deadlineDate: "2022-06-30T15:59:59.000Z", deadlineLabel: "The 2022 guide accepted fall language-program applications from January 1 through June 30.", applicationRound: "Fall 2022 self-funded language route", status: "closed" as const, ...sourceFields, sourceFieldLineage: { intakeTerm: "official guide fall-semester label", intakeYear: "official guide title", deadlineDate: "official application window converted from Beijing end-of-day", deadlineLabel: "official application-time section", applicationRound: "official guide category and cycle" } },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 114 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 40, schoolSlugs: [schoolSlug], newSchools: 1, newCities: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The official international-college homepage returned HTTP 412 to the registered collector. Public official-domain discovery found no 2026 or 2027 inbound international-student prospectus; the newest directly retrievable prospectus is from 2022.",
    "No current degree-program catalog was found. The guide says degree and visiting applicants may use majors open to international students but does not enumerate them, so no bachelor, master, doctoral or visiting-major records are inferred.",
    "Only the two explicit long-term Chinese-language fee categories are structured. The short-term negotiated group route and per-hour auditing option are excluded because they are not stable catalog products.",
    "All intake records are closed 2022 evidence and must not be presented as currently available. Current application dates, tuition, language thresholds and scholarship terms remain absent until a newer official source is published or becomes retrievable.",
  ],
  sensitiveDataCheck: { result: "pass", note: "The named staff contact, telephone number and email printed in the guide were excluded. Only institutional admissions facts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-114");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 114, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
