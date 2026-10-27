import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

type ExtractedProgram = {
  degreeLevel: "Bachelor" | "Master" | "Doctoral";
  teachingLanguage: "Chinese" | "English";
  schoolZh: string;
  schoolEn: string;
  programCode?: string;
  nameZh: string;
  nameEn: string;
  durationYears: number;
  tuitionCnyPerYear: number;
  sourceId: string;
};

type Extraction = {
  version: number;
  sourceRun: string;
  counts: { total: number };
  sources: Array<{ id: string; sha256: string }>;
  programs: ExtractedProgram[];
};

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const extraction = JSON.parse(await readFile(resolve(root, "catalog-sources/cumt-current-degree-programs.extracted.json"), "utf8")) as Extraction;
if (extraction.version !== 1 || extraction.counts.total !== 146 || extraction.programs.length !== 146) {
  throw new Error("Unexpected CUMT degree extraction shape.");
}
const runDir = resolve(root, "work/catalog-official", extraction.sourceRun);
const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map(manifest.sources.map((source) => [source.id, source]));
for (const lock of extraction.sources) {
  const source = sources.get(lock.id);
  if (!source || source.status !== 200 || source.sha256 !== lock.sha256) throw new Error(`Missing locked source ${lock.id}.`);
  const artifact = await readFile(resolve(runDir, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== lock.sha256) throw new Error(`Hash mismatch ${lock.id}.`);
}
const extraLocks = [
  ["cumt-international-notice-index-current", "904eb644aea8cd249881820d3a5046997f66b476e3cb191ddfee83e85428a665"],
  ["cumt-international-enrollment-guide-page-2026-2027", "615d7f50a21462c75508cbb3637be99dea95387b962814397d122974df8073d2"],
  ["cumt-international-enrollment-guide-pdf-2026-2027", "35ea2e8e7e0c20f3fb4ad309afcd6ce6993b4c8454c27e37f60e513357b4923a"],
  ["cumt-csca-requirements-current", "cb74dca372f87579286018ed498b57182b77c017f8c94920453334e59ef1bf40"],
  ["cumt-fees-scholarships-current", "405853880de57a9076bbb131a0226394fff1bf567e82f6539d9fc0d311f272da"],
] as const;
for (const [id, sha] of extraLocks) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== sha) throw new Error(`Missing locked source ${id}.`);
  if (createHash("sha256").update(await readFile(resolve(runDir, source.artifactPath))).digest("hex") !== sha) throw new Error(`Hash mismatch ${id}.`);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-130.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "xuzhou");
const priorSchool = prior.schools?.find((row) => row.slug === "china-university-of-mining-and-technology-xuzhou");
if (!city || !priorSchool || prior.programs?.length !== 2 || prior.programIntakes?.length !== 2) {
  throw new Error("Wave 224 requires the complete Wave 130 CUMT language candidate.");
}
const notice = sources.get("cumt-international-notice-index-current")!;
const fee = sources.get("cumt-fees-scholarships-current")!;
const guidePage = sources.get("cumt-international-enrollment-guide-page-2026-2027")!;
const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
const school = {
  ...priorSchool,
  applicationLevel: "Current Bachelor, Master and Doctoral degree catalogs plus Spring 2027 non-degree Chinese training",
  languageOfInstruction: "Current degree catalogs publish Chinese- and English-taught routes. Spring 2027 Chinese training is taught in Chinese.",
  deadlineSummary: "The only explicit 2027 deadline currently published is January 4, 2027 for the Spring 2027 Chinese training route. No 2027 degree-application deadline is published in the accessible evidence.",
  tuitionSummary: "Current annual degree tuition is published per program: bachelor CNY 13,800 or 14,600; master CNY 15,400 or 16,200; doctoral CNY 17,000. Spring 2027 Chinese training tuition is CNY 6,000.",
  applicationFee: "CNY 400 in the current fee table and Spring 2027 Chinese-training guide.",
  admissionsUrl: notice.finalUrl ?? notice.url,
  cscaRequired: true,
  cscaRequirement: "Undergraduate applicants submit Mathematics; Chinese-taught applicants also submit Professional Chinese; applicants to science, engineering and related programs submit Physics or Chemistry, subject to the official exclusions.",
  subjectTags: [...new Set(extraction.programs.map((program) => program.schoolEn))],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 13,800-17,000/year for current degree routes",
  campusHighlights: ["Wenchang Campus in Xuzhou", "146 current official degree program-language rows", "Spring 2027 Chinese training intake"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: fee.fetchedAt,
  sourceUrl: notice.finalUrl ?? notice.url,
  sourceLabel: notice.label,
  sourceSha256: notice.sha256,
  capturedAt: notice.fetchedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "current official degree-program pages plus official Spring 2027 language guide",
    languageOfInstruction: "current official program-page titles and Spring 2027 language guide",
    deadlineSummary: "official notice index and Spring 2027 language guide; inaccessible degree-guide attachment limitation disclosed",
    tuitionSummary: "current official program tables and Spring 2027 language guide",
    applicationFee: "current official fee table and Spring 2027 language guide",
    admissionsUrl: "current official notice index",
    cscaRequired: "current official CUMT CSCA requirements page",
    cscaRequirement: "current official CUMT CSCA requirements page",
    subjectTags: "current official program-table school columns",
    languageTags: "current official program-page titles",
    tuitionBandLabel: "current official program tuition columns",
    campusHighlights: "official program and Spring 2027 guide scope",
  },
};

const currentPrograms: CatalogSeedProgram[] = extraction.programs.map((entry, index) => {
  const source = sources.get(entry.sourceId)!;
  return {
    slug: `${school.slug}-${entry.degreeLevel.toLowerCase()}-${entry.teachingLanguage.toLowerCase()}-${String(index + 1).padStart(3, "0")}-${slugify(entry.programCode ?? entry.nameEn)}-${slugify(entry.nameEn)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: entry.nameEn,
    nameZh: entry.nameZh || undefined,
    degreeLevel: entry.degreeLevel,
    durationYears: entry.durationYears,
    fieldCategory: entry.schoolEn,
    subjectArea: entry.nameEn,
    teachingLanguage: entry.teachingLanguage,
    tuitionAmount: entry.tuitionCnyPerYear,
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic year",
    tuitionText: `CNY ${entry.tuitionCnyPerYear.toLocaleString("en-US")}/academic year in the current official program table.`,
    applicationUrl: guidePage.finalUrl ?? guidePage.url,
    applicationNote: `Current official ${entry.teachingLanguage.toLowerCase()}-taught ${entry.degreeLevel.toLowerCase()} program${entry.programCode ? `, code ${entry.programCode}` : ""}. The program page was originally published in 2021 and was updated on the official server in 2026. No 2027 degree intake or deadline is inferred.`,
    badgeText: `Current ${entry.teachingLanguage.toLowerCase()}-taught ${entry.degreeLevel.toLowerCase()} program`,
    displaySubjects: [entry.nameEn],
    displayGroup: entry.degreeLevel,
    displayGroupLabel: `${entry.degreeLevel} programs`,
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "current official program table",
      nameZh: "current official program table",
      degreeLevel: "official program-page title",
      durationYears: "official program-table duration column",
      fieldCategory: "official program-table school column",
      subjectArea: "official program-table program-name column",
      teachingLanguage: "official program-page title",
      tuitionAmount: "official program-table tuition column",
      tuitionCurrency: "official program-table tuition heading",
      tuitionPeriod: "current official fee page annual-fee heading",
      tuitionText: "official program-table tuition column",
      applicationUrl: "official 2026-2027 enrollment-guide landing page",
      applicationNote: "official current program row plus explicit publication-year and 2027-cycle limitation",
    },
  };
});

const scholarship: CatalogSeedScholarship = {
  slug: "china-university-of-mining-and-technology-school-scholarship-current",
  schoolSlug: school.slug,
  title: "CUMT School Scholarship",
  nameZh: "中国矿业大学校级奖学金",
  type: "university",
  typeLabel: "University scholarship",
  providerName: "中国矿业大学",
  providerNameEn: "China University of Mining and Technology",
  providerLocation: "Xuzhou, Jiangsu, China",
  fundingLevel: "Class A or Class B annual award",
  coverage: "Bachelor Class A: CNY 13,800 for BA or CNY 14,600 for BS; Bachelor Class B: CNY 6,900 for BA or CNY 7,300 for BS. Master/Doctor Class A: CNY 28,400 for MA, CNY 29,200 for MS or CNY 30,000 for PhD; Class B: CNY 18,400 for MA, CNY 19,200 for MS or CNY 20,000 for PhD.",
  applicableDegree: "Bachelor, Master, Doctoral",
  applicableProgram: "Current eligible CUMT degree programs; bachelor awards are based primarily on CSCA scores.",
  amountText: "Published annual Class A and Class B amounts vary by degree and arts/science category; see coverage.",
  requirementText: "First-year Class A normally requires average score at least 80/100 or GPA at least 3.2/4.0; Class B normally requires average score at least 75/100 or GPA at least 3.0/4.0. The award is valid for one academic year and reassessed annually. Bachelor applicants must be no more than 25, master applicants no more than 35, and doctoral applicants no more than 40.",
  eligibilityItems: [
    { label: "First-year Class A", value: "Average score at least 80/100 or GPA at least 3.2/4.0" },
    { label: "First-year Class B", value: "Average score at least 75/100 or GPA at least 3.0/4.0" },
    { label: "Age", value: "Bachelor no more than 25; master no more than 35; doctoral no more than 40" },
    { label: "Renewal", value: "Valid for one academic year and reassessed using academic performance and daily conduct" },
  ],
  actionLinks: [{ label: "Official current CUMT fee and scholarship page", url: fee.finalUrl ?? fee.url, kind: "official-source" }],
  deadlineLabel: "The current official scholarship page does not publish a fixed application deadline or identify a 2027 award cycle.",
  applicationRound: "Current CUMT school scholarship; cycle not stated",
  summary: "Tiered annual university scholarship for eligible bachelor, master and doctoral students.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: fee.fetchedAt,
  sourceUrl: fee.finalUrl ?? fee.url,
  sourceLabel: fee.label,
  sourceSha256: fee.sha256,
  capturedAt: fee.fetchedAt,
  sourceFieldLineage: {
    title: "official current scholarship heading",
    typeLabel: "official current scholarship heading",
    fundingLevel: "official Class A/Class B table",
    coverage: "official scholarship amount table",
    applicableDegree: "official scholarship amount and age tables",
    applicableProgram: "official bachelor CSCA note and degree categories",
    amountText: "official scholarship amount table",
    requirementText: "official first-year, renewal and age requirements",
    eligibilityItems: "official first-year, renewal and age requirements",
    actionLinks: "registered official current scholarship page",
    deadlineLabel: "official page limitation; no cycle or deadline stated",
    applicationRound: "official page limitation; current cycle not stated",
    summary: "official scholarship categories and scope",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.sources.map((source) => source.fetchedAt).sort().at(-1)!,
  cities: [city],
  schools: [school],
  programs: [...prior.programs, ...currentPrograms],
  programIntakes: prior.programIntakes,
  scholarships: [scholarship],
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 224 validation failed:\n${validation.errors.join("\n")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const evidence = manifest.sources.map((source) => ({ id: source.id, url: source.finalUrl ?? source.url, sha256: source.sha256, fetchedAt: source.fetchedAt }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 67,
    schoolSlugs: [school.slug],
    programs: candidate.programs?.length ?? 0,
    programIntakes: candidate.programIntakes?.length ?? 0,
    scholarships: candidate.scholarships?.length ?? 0,
  },
  evidence,
  transcription: {
    currentDegreeRows: extraction.counts.total,
    bachelorRows: extraction.programs.filter((row) => row.degreeLevel === "Bachelor").length,
    masterRows: extraction.programs.filter((row) => row.degreeLevel === "Master").length,
    doctoralRows: extraction.programs.filter((row) => row.degreeLevel === "Doctoral").length,
    explicit2027LanguageRoutes: prior.programs.length,
  },
  unresolved: [
    "The 146 degree rows come from current official program pages originally published in October 2021 and updated on the official server in 2026. They are retained as current-reference rows and are not relabeled as 2027 admissions.",
    "The official 2026-2027 enrollment-guide attachment resolves to an access-control placeholder rather than the PDF, so degree eligibility, language thresholds, materials and application dates are not inferred.",
    "No explicit 2027 bachelor, master or doctoral admission cycle is visible in the current notice index. Only the two Spring 2027 Chinese-training routes receive 2027 intake rows.",
    "The current CUMT School Scholarship page publishes award amounts and eligibility but no fixed deadline or cycle year; it is retained as a current unreviewed record rather than labeled 2027.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only institutional and program data is retained. Personal contacts are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-224");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 224, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
