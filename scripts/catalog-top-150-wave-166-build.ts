import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral" | "Non-degree";
type ProgramSpec = { name: string; degree: Degree; durationYears?: number; durationMonths?: number; language: "Chinese" | "English" | "Chinese/English"; feeGroup?: "humanities" | "science" | "non-degree" };

const root = process.cwd();
const run = "2026-10-26T10-08-12-465Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["hubu-university-home-current", "84a496fa94192047beaee3ef50260baf359c89db703daa2e3b0dbd4e9f75f52e"],
  ["hubu-international-online-application-current", "a766ed8a5691377f9cfe31506291bb7a413bfdaa09a5a757efcf3aec7376311f"],
  ["hubu-international-scholarship-index-current", "9158815ff392d118394560e083a29d65ebf94a52edf58c0fde7b40ea6ad4df66"],
  ["hubu-international-chinese-language-teachers-scholarship-2026-2027", "413978d4d4f1f5c7ce3a10111d1f81872e9397c5da8c0cfe078159c388eacf9d"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked HUBU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`HUBU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const currentGuide = sources.get("hubu-international-online-application-current")!;
const scholarshipGuide = sources.get("hubu-international-chinese-language-teachers-scholarship-2026-2027")!;
const scholarshipIndex = sources.get("hubu-international-scholarship-index-current")!;
const home = sources.get("hubu-university-home-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "wuhan");
if (!city) throw new Error("Reviewed Wuhan dependency missing");

const school = {
  slug: "hubei-university",
  nameEn: "Hubei University",
  nameZh: "湖北大学",
  citySlug: "wuhan",
  schoolType: "Public comprehensive university",
  region: "Wuhan, Hubei, Central China",
  applicationLevel: "The current official international application page publishes bachelor, master, doctoral and non-degree routes without an intake-year label. A separate official scholarship guide explicitly publishes a March 2027 one-semester route. No general 2027 degree-admission deadline is published.",
  languageOfInstruction: "Chinese, English, or Chinese/English according to the current official route table.",
  languageRequirement: "Current page: HSK 4 score 180 for Chinese-taught bachelor routes; HSK 5 score 180 for Chinese-taught master and doctoral routes. English-taught routes require an English test transcript, with no numeric threshold published.",
  englishRequirement: "English test transcript required for English-taught routes; no numeric threshold is published on the current page.",
  deadlineSummary: "No general 2027 degree deadline is published. The explicit March 2027 one-semester scholarship deadline was October 10, 2026 Beijing time.",
  tuitionSummary: "Current annual tuition: bachelor humanities/economics/management CNY 18,000 and science/engineering CNY 20,000; master CNY 20,000 or 22,000 by field; non-degree CNY 7,000/semester or 14,000/year. Doctoral tuition is not stated on the captured current page.",
  applicationFee: "CNY 400 registration fee on the current page",
  websiteUrl: home.finalUrl ?? home.url,
  admissionsUrl: currentGuide.finalUrl ?? currentGuide.url,
  subjectTags: ["Economics", "Business", "Life Sciences", "Materials Science", "Ecology", "Chinese Language"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Current published bachelor/master/non-degree tuition: CNY 14,000-22,000/year",
  campusHighlights: ["Provincial first-class comprehensive university jointly administered by Hubei Province and the Ministry of Education", "Central Wuhan campus with direct metro access", "Current international page publishes degree and non-degree routes"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: home.fetchedAt,
  ...sourceFields(currentGuide),
  sourceFieldLineage: {
    nameEn: "official English university and admission pages",
    nameZh: "official university identity",
    citySlug: "official address plus reviewed Wuhan dependency",
    schoolType: "official profile plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "current program page plus explicit Spring 2027 scholarship guide",
    languageOfInstruction: "current official program table",
    languageRequirement: "current official eligibility sections",
    englishRequirement: "current official eligibility sections",
    deadlineSummary: "explicit Spring 2027 scholarship deadline and unresolved general cycle",
    tuitionSummary: "current official tuition table",
    applicationFee: "current official fee table",
    websiteUrl: "official university domain",
    admissionsUrl: "official international application page",
    subjectTags: "current official named route table",
    languageTags: "current official teaching-language table",
    tuitionBandLabel: "current official tuition table excluding unpublished doctoral tuition",
    campusHighlights: "official university profile and admission page",
  },
};

const bachelor: ProgramSpec[] = [
  ...["International Economics and Trade", "Marketing", "Big Data Management and Application", "Accounting", "Finance", "International Affairs and International Relations"].map((name) => ({ name, degree: "Bachelor" as const, durationYears: 4, language: "Chinese/English" as const, feeGroup: "humanities" as const })),
  { name: "Robotics Engineering", degree: "Bachelor", durationYears: 4, language: "Chinese/English", feeGroup: "science" },
  ...["Pharmacy", "Pharmaceutical Engineering", "Food Safety and Detection", "Biomedical Engineering"].map((name) => ({ name, degree: "Bachelor" as const, durationYears: 4, language: "Chinese" as const, feeGroup: "science" as const })),
];
const graduateBase: Array<[string, "Chinese" | "English" | "Chinese/English", "humanities" | "science"]> = [
  ["Theoretical Economics", "Chinese", "humanities"],
  ["History of China", "Chinese", "humanities"],
  ["Management Philosophy", "Chinese/English", "humanities"],
  ["Material Science and Engineering (Chemistry and Chemical Engineering)", "Chinese/English", "science"],
  ["Plant Science", "English", "science"],
  ["Zoology", "English", "science"],
  ["Microbiology", "English", "science"],
  ["Biochemistry and Molecular Biology", "English", "science"],
  ["Genetics", "English", "science"],
  ["Ecology", "Chinese/English", "science"],
  ["Materials Science and Engineering", "Chinese", "science"],
  ["Nanomaterials and Devices", "English", "science"],
  ["Regional and International Studies of Latin America", "Chinese", "humanities"],
];
const master: ProgramSpec[] = graduateBase.map(([name, language, feeGroup]) => ({ name, degree: "Master", durationYears: 3, language, feeGroup }));
const doctoral: ProgramSpec[] = graduateBase.map(([name, language]) => ({ name, degree: "Doctoral", durationYears: 3, language }));
const nonDegree: ProgramSpec[] = [
  { name: "Chinese Language (One Semester)", degree: "Non-degree", durationMonths: 5, language: "Chinese", feeGroup: "non-degree" },
  { name: "Chinese Language (One Academic Year)", degree: "Non-degree", durationYears: 1, language: "Chinese", feeGroup: "non-degree" },
  { name: "Chinese Foundation Program", degree: "Non-degree", durationYears: 1, language: "Chinese", feeGroup: "non-degree" },
];
const currentSpecs = [...bachelor, ...master, ...doctoral, ...nonDegree];
const spring2027: ProgramSpec = { name: "International Chinese Language Teachers Scholarship One-Semester Study", degree: "Non-degree", durationMonths: 5, language: "Chinese" };
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fieldCategory = (name: string) => /econom|marketing|account|finance|management|international|history/i.test(name) ? "Business and Social Sciences" : /language|foundation/i.test(name) ? "Language study" : /plant|zoology|microbiology|biochemistry|genetics|ecology|pharmacy|food|biomedical/i.test(name) ? "Life Sciences" : "Engineering and Materials";
const tuition = (spec: ProgramSpec) => spec.feeGroup === "non-degree" ? 14000 : spec.degree === "Bachelor" ? (spec.feeGroup === "humanities" ? 18000 : 20000) : spec.degree === "Master" ? (spec.feeGroup === "humanities" ? 20000 : 22000) : undefined;
const makeProgram = (spec: ProgramSpec, source: Source, suffix: string) => {
  const amount = tuition(spec);
  const usesChinese = spec.language.includes("Chinese");
  const usesEnglish = spec.language.includes("English");
  return {
    slug: `hubei-university-${slugify(spec.name)}-${spec.degree.toLowerCase()}-${suffix}`,
    schoolSlug: school.slug,
    citySlug: "wuhan",
    nameEn: spec.name,
    degreeLevel: spec.degree,
    ...(spec.durationYears ? { durationYears: spec.durationYears } : {}),
    ...(spec.durationMonths ? { durationMonths: spec.durationMonths } : {}),
    fieldCategory: fieldCategory(spec.name),
    subjectArea: spec.name,
    teachingLanguage: spec.language,
    ...(usesChinese ? { hskRequirement: spec.degree === "Bachelor" ? "HSK Level 4 score 180 for Chinese-taught study on the current page." : spec.degree === "Master" || spec.degree === "Doctoral" ? "HSK Level 5 score 180 for Chinese-taught study on the current page." : "Chinese-language study; route-specific HSK rules apply where published." } : {}),
    ...(usesEnglish ? { englishRequirement: "English-language test transcript required; the current page publishes no numeric score threshold." } : {}),
    ...(amount ? { tuitionAmount: amount, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: spec.feeGroup === "non-degree" ? "CNY 7,000/semester or CNY 14,000/year on the current page." : `Current published tuition band for this degree and field group: CNY ${amount.toLocaleString("en-US")}/year.` } : { tuitionText: "Doctoral tuition is not published on the captured current application page." }),
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: suffix === "current" ? "Published on the current official international application page without an intake-year label. No 2027 degree intake or deadline is inferred." : "Official scholarship route explicitly admitting in March 2027.",
    hasScholarship: suffix === "spring-2027",
    ...(suffix === "spring-2027" ? { scholarshipText: "Full International Chinese Language Teachers Scholarship: tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance for five months." } : {}),
    badgeText: suffix === "spring-2027" ? "Spring 2027 official route" : "Current official route; cycle unresolved",
    ...(amount ? { displayTuition: spec.feeGroup === "non-degree" ? "CNY 7,000/semester" : `CNY ${amount.toLocaleString("en-US")}/year` } : {}),
    displaySubjects: [spec.name],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "official named program table or scholarship route",
      degreeLevel: "official student category",
      ...(spec.durationYears ? { durationYears: "official duration table" } : {}),
      ...(spec.durationMonths ? { durationMonths: "official semester or five-month duration" } : {}),
      fieldCategory: "CUAC taxonomy of official program name",
      subjectArea: "official program name",
      teachingLanguage: "official teaching-language table",
      ...(usesChinese ? { hskRequirement: "official eligibility section" } : {}),
      ...(usesEnglish ? { englishRequirement: "official eligibility section" } : {}),
      ...(amount ? { tuitionAmount: "current official tuition table", tuitionText: "current official tuition table" } : { tuitionText: "explicit unresolved doctoral tuition" }),
      applicationUrl: "official international application or scholarship page",
      applicationNote: "official cycle label or explicit unresolved-cycle note",
      hasScholarship: suffix === "spring-2027" ? "official scholarship guide" : "no award inferred",
      ...(suffix === "spring-2027" ? { scholarshipText: "official scholarship coverage and allowance" } : {}),
      badgeText: "official cycle status",
    },
  };
};
const programs = [...currentSpecs.map((spec) => makeProgram(spec, currentGuide, "current")), makeProgram(spring2027, scholarshipGuide, "spring-2027")];
const springProgram = programs.at(-1)!;
const programIntakes = [{
  programSlug: springProgram.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-10T15:59:59.000Z",
  deadlineLabel: "Applications for March 2027 entry closed October 10, 2026 Beijing time.",
  applicationRound: "International Chinese Language Teachers Scholarship one-semester study, March 2027 entry",
  status: "closed" as const,
  ...sourceFields(scholarshipGuide),
  sourceFieldLineage: { intakeTerm: "official March 2027 entry", intakeYear: "official scholarship table", deadlineDate: "official October 10 deadline converted from Beijing end-of-day", deadlineLabel: "official deadline", applicationRound: "official scholarship category" },
}];
const scholarships = [{
  slug: "hubei-university-international-chinese-language-teachers-scholarship-spring-2027",
  title: "International Chinese Language Teachers Scholarship at Hubei University — Spring 2027 One-Semester Study",
  nameZh: "湖北大学国际中文教师奖学金一学期研修生（2027年春季）",
  schoolSlug: school.slug,
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心",
  providerNameEn: "Center for Language Education and Cooperation",
  providerLocation: "China",
  fundingLevel: "Full scholarship for five months",
  coverage: "Tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance.",
  applicableDegree: "Non-degree one-semester study entering March 2027",
  amountText: "CNY 2,500/month living allowance for the five-month program, plus tuition, accommodation and comprehensive medical insurance.",
  requirementText: "Non-Chinese citizens aged 16-35 (up to 45 for in-service Chinese teachers). For TCSOL, Chinese Language, Chinese History or Chinese Philosophy: HSK Level 3 score 180 and an HSKK score. Taiji Culture requires an HSK score, with HSKK preferred. Applicants who received the same scholarship within the previous three years are ineligible.",
  benefitItems: [{ label: "Tuition", included: true, note: "Full tuition coverage" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "CNY 2,500/month" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
  eligibilityItems: [{ label: "Entry", value: "March 2027" }, { label: "Duration", value: "Five months" }, { label: "Deadline", value: "October 10, 2026 Beijing time" }, { label: "Language", value: "HSK/HSKK requirements vary by study direction" }],
  applicationMaterials: [],
  applicationSteps: [],
  actionLinks: [{ label: "Official scholarship guide", url: scholarshipGuide.finalUrl ?? scholarshipGuide.url, kind: "official-source" }],
  applicationRound: "March 2027 entry; deadline October 10, 2026 Beijing time",
  summary: "Explicit Spring 2027 five-month full scholarship for eligible one-semester Chinese-language and culture study directions.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipGuide.fetchedAt,
  ...sourceFields(scholarshipGuide),
  sourceFieldLineage: { title: "official 2026-2027 scholarship guide", coverage: "official coverage section", applicableDegree: "official one-semester category and March 2027 entry", amountText: "official monthly allowance table", requirementText: "official eligibility and category rules", benefitItems: "official coverage section", eligibilityItems: "official category, dates and language thresholds", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", applicationRound: "official March 2027 entry and deadline", summary: "official scholarship category" },
}];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: scholarshipGuide.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: scholarshipGuide.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 121, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The current general degree and non-degree program page has no intake-year label or application deadline. Its 40 routes are structured as current catalog context without intake rows; no general 2027 degree cycle is inferred.",
    "Only the one-semester International Chinese Language Teachers Scholarship explicitly publishes March 2027 entry and an October 10, 2026 deadline; that source-bounded route has the sole 2027 intake row.",
    "The current page requires an English test transcript for English-taught routes but publishes no numeric English score threshold; the threshold remains blank.",
    "The current page does not publish doctoral tuition; doctoral tuition fields remain blank.",
    `The current scholarship index is hash-locked (${scholarshipIndex.sha256}) as freshness evidence; older scholarship rounds are not converted to 2027 records.`,
    "Applicant documents, personal contacts, accommodation room prices and payment details are excluded from the candidate.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant documents, personal contacts, payment details and accommodation room-price details are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-166");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 166, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
