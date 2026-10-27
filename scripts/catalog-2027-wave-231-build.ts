import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-27T08-09-15-482Z";
const locks = new Map([
  ["hfut-international-notice-index-current", "6eb1e501b9027071600862d372dd335fc2d3b18cb8ccb10757f4ef554a511301"],
  ["hfut-international-undergraduate-guide-2026", "aeae8ee6073c7f9225ac19092d592abbc9cf5481d6e584745fb8a238d9d1120b"],
  ["hfut-international-undergraduate-program-catalog-2026", "affbc6c63ffae2eb4f721169044e40435d4a2e9a977acba008707fef51e3e8b1"],
]);
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked HFUT source ${id}.`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}
const index = sources.get("hfut-international-notice-index-current")!;
const guide = sources.get("hfut-international-undergraduate-guide-2026")!;
const catalog = sources.get("hfut-international-undergraduate-program-catalog-2026")!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-136.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "hefei");
const base = prior.schools?.find((row) => row.slug === "hefei-university-of-technology");
if (!city || !base) throw new Error("Wave 136 HFUT dependencies are missing.");

const school = {
  ...base,
  applicationLevel: "The closed 2026 international undergraduate guide and official workbook publish 18 bachelor routes. The current notice index still exposes no general 2027 international degree guide.",
  admissionsUrl: index.finalUrl ?? index.url,
  campusHighlights: [
    "Official 2026 workbook lists 18 international undergraduate routes",
    "Each route publishes teaching language, four- or five-year duration and CSCA subjects",
    "The current official index still has no general 2027 international degree guide",
  ],
  lastVerifiedAt: catalog.fetchedAt,
  sourceUrl: guide.finalUrl ?? guide.url,
  sourceLabel: guide.label,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official 2026 guide and program workbook plus current notice-index review",
    admissionsUrl: "current official international notice index",
    campusHighlights: "official 2026 workbook and current index",
  },
};

type ProgramSpec = {
  nameZh: string;
  nameEn: string;
  teachingLanguage: "Chinese" | "English";
  durationYears: 4 | 5;
  schoolName: string;
  cscaSubjects: string[];
};
const specs: ProgramSpec[] = [
  { nameZh: "生物医学工程", nameEn: "Biomedical Engineering", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Instrument Science and Optoelectronic Engineering", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "电气工程及其自动化", nameEn: "Electrical Engineering and Automation", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Electrical Engineering and Automation", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "自动化", nameEn: "Automation", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Electrical Engineering and Automation", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "机器人工程", nameEn: "Robotics Engineering", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Electrical Engineering and Automation", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "计算机科学与技术", nameEn: "Computer Science and Technology", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Computer and Information", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "计算机科学与技术", nameEn: "Computer Science and Technology", teachingLanguage: "English", durationYears: 4, schoolName: "School of Computer and Information", cscaSubjects: ["Mathematics", "Physics"] },
  { nameZh: "土木工程", nameEn: "Civil Engineering", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Civil and Hydraulic Engineering", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "土木工程", nameEn: "Civil Engineering", teachingLanguage: "English", durationYears: 4, schoolName: "School of Civil and Hydraulic Engineering", cscaSubjects: ["Mathematics", "Physics"] },
  { nameZh: "建筑学", nameEn: "Architecture", teachingLanguage: "Chinese", durationYears: 5, schoolName: "School of Architecture and Art", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "城乡规划", nameEn: "Urban and Rural Planning", teachingLanguage: "Chinese", durationYears: 5, schoolName: "School of Architecture and Art", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "工业设计", nameEn: "Industrial Design", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Architecture and Art", cscaSubjects: ["Chinese (Science)", "Mathematics", "Physics"] },
  { nameZh: "环境设计", nameEn: "Environmental Design", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Architecture and Art", cscaSubjects: ["Chinese (Humanities)", "Mathematics"] },
  { nameZh: "工商管理", nameEn: "Business Administration", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Management", cscaSubjects: ["Chinese (Humanities)", "Mathematics"] },
  { nameZh: "英语", nameEn: "English", teachingLanguage: "English", durationYears: 4, schoolName: "School of Foreign Languages", cscaSubjects: ["Mathematics"] },
  { nameZh: "印度尼西亚语", nameEn: "Indonesian", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Foreign Languages", cscaSubjects: ["Chinese (Humanities)", "Mathematics"] },
  { nameZh: "国际经济与贸易", nameEn: "International Economics and Trade", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Economics", cscaSubjects: ["Chinese (Humanities)", "Mathematics"] },
  { nameZh: "数字经济", nameEn: "Digital Economy", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Economics", cscaSubjects: ["Chinese (Humanities)", "Mathematics"] },
  { nameZh: "金融工程", nameEn: "Financial Engineering", teachingLanguage: "Chinese", durationYears: 4, schoolName: "School of Economics", cscaSubjects: ["Chinese (Humanities)", "Mathematics"] },
];
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programEvidence = { sourceUrl: catalog.finalUrl ?? catalog.url, sourceLabel: catalog.label, sourceSha256: catalog.sha256, capturedAt: catalog.fetchedAt };
const programs = specs.map((spec) => ({
  slug: `hefei-university-of-technology-bachelor-${slugify(spec.nameEn)}-${spec.teachingLanguage.toLowerCase()}-2026`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Bachelor",
  fieldCategory: spec.schoolName.replace(/^School of /, ""),
  subjectArea: spec.nameEn,
  teachingLanguage: spec.teachingLanguage,
  durationYears: spec.durationYears,
  tuitionAmount: 22000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 22,000/year for the closed 2026 undergraduate cycle",
  applicationNote: `Closed Fall 2026 route. ${spec.teachingLanguage === "Chinese" ? "HSK 4 score 180 or above was required." : "IELTS 6.0, TOEFL 85, TOEFL Essentials 9, Duolingo 100 or accepted English-medium proof was required."}`,
  cscaRequirement: `Closed 2026 route required: ${spec.cscaSubjects.join(", ")}.`,
  cscaSubjects: spec.cscaSubjects,
  ...(spec.teachingLanguage === "Chinese" ? { hskRequirement: "HSK 4 score 180 or above" } : { englishRequirement: "IELTS 6.0, TOEFL 85, TOEFL Essentials 9, Duolingo 100 or accepted prior English-medium proof" }),
  scholarshipText: "The 2026 guide publishes Chinese Government Scholarship, HFUT Undergraduate Scholarship and English-taught Program Scholarship options subject to route eligibility.",
  hasScholarship: true,
  badgeText: "Closed 2026 official undergraduate route",
  displayTuition: "CNY 22,000/year",
  displaySubjects: spec.cscaSubjects,
  displayGroup: "hfut-undergraduate-2026",
  displayGroupLabel: "HFUT closed 2026 international undergraduate routes",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...programEvidence,
  sourceFieldLineage: {
    nameEn: "reviewed English translation of the official Chinese workbook program label",
    nameZh: "official workbook program label",
    degreeLevel: "official undergraduate guide and workbook title",
    fieldCategory: "official workbook college cell",
    subjectArea: "official workbook program label",
    teachingLanguage: "official workbook teaching-language column",
    durationYears: "official workbook duration column",
    tuitionAmount: "official 2026 guide fee section",
    tuitionCurrency: "official 2026 guide fee section",
    tuitionPeriod: "official 2026 guide fee section",
    tuitionText: "official 2026 guide fee section",
    applicationNote: "official 2026 application conditions",
    cscaRequirement: "official workbook CSCA-subject column",
    cscaSubjects: "official workbook CSCA-subject column; normalized English labels",
    ...(spec.teachingLanguage === "Chinese" ? { hskRequirement: "official 2026 application conditions" } : { englishRequirement: "official 2026 application conditions" }),
    scholarshipText: "official 2026 scholarship section",
    hasScholarship: "official 2026 scholarship section",
    badgeText: "official 2026 guide cycle",
  },
}));
const guideEvidence = { sourceUrl: guide.finalUrl ?? guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt };
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-15T15:59:59.000Z",
  deadlineLabel: "Application deadline: June 15, 2026; study was scheduled to begin in early September 2026.",
  applicationRound: "2026 international undergraduate admission",
  status: "closed" as const,
  ...guideEvidence,
  sourceFieldLineage: {
    intakeTerm: "official early-September 2026 start statement",
    intakeYear: "official 2026 guide title and start statement",
    deadlineDate: "official application-time section; end-of-day China time normalized",
    deadlineLabel: "official application-time and registration sections",
    applicationRound: "official guide title",
    status: "derived by comparing the official deadline with capturedAt",
  },
}));

const scholarshipBase = {
  schoolSlug: school.slug,
  providerName: "合肥工业大学",
  providerNameEn: "Hefei University of Technology",
  providerLocation: "Hefei, China",
  applicableDegree: "Bachelor",
  applicationRound: "Closed 2026 international undergraduate admission",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...guideEvidence,
};
const scholarships = [
  {
    ...scholarshipBase,
    slug: "hefei-university-of-technology-cgs-bilateral-undergraduate-2026",
    title: "Chinese Government Scholarship Bilateral Program — HFUT Undergraduate 2026",
    nameZh: "中国政府奖学金国别项目（合肥工业大学本科2026）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Bilateral Program",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, on-campus accommodation or an off-campus accommodation subsidy, living stipend and comprehensive medical insurance.",
    amountText: "Coverage published; no route-specific cash total in the captured guide.",
    requirementText: "Applicants apply through the dispatching authority in their home country; the guide says applications are generally accepted from early January to early April.",
    benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true }, { label: "Living stipend", included: true }, { label: "Medical insurance", included: true }],
    eligibilityItems: [], applicationMaterials: [], applicationSteps: [{ label: "Apply through dispatching authority", value: "Consult the responsible authority in the applicant's home country." }],
    actionLinks: [{ label: "Official 2026 guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }],
    summary: "Full Chinese Government Scholarship route referenced in the closed 2026 undergraduate guide.",
  },
  {
    ...scholarshipBase,
    slug: "hefei-university-of-technology-undergraduate-scholarship-2026",
    title: "HFUT Undergraduate Scholarship — 2026",
    nameZh: "合肥工业大学本科生奖学金（2026）",
    type: "university",
    typeLabel: "University undergraduate scholarship",
    fundingLevel: "Tiered tuition and accommodation support",
    coverage: "Class A: tuition and on-campus accommodation; Class B: half tuition and on-campus accommodation; Class C: on-campus accommodation.",
    amountText: "Tiered non-cash coverage; no fixed cash amount published.",
    requirementText: "Supports Chinese-taught undergraduate programs and the English major. Applicants use the HFUT system without selecting a tier; the university assigns the level after comprehensive review.",
    benefitItems: [{ label: "Class A", included: true, note: "Tuition and on-campus accommodation" }, { label: "Class B", included: true, note: "Half tuition and on-campus accommodation" }, { label: "Class C", included: true, note: "On-campus accommodation" }],
    eligibilityItems: [], applicationMaterials: [], applicationSteps: [{ label: "Apply in HFUT system", value: "No scholarship tier selection is required at application." }],
    actionLinks: [{ label: "Official 2026 guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }],
    summary: "Four- or five-year tiered university scholarship for eligible closed-2026 undergraduate routes.",
  },
  {
    ...scholarshipBase,
    slug: "hefei-university-of-technology-english-taught-program-scholarship-2026",
    title: "HFUT English-taught Program Scholarship — 2026",
    nameZh: "合肥工业大学全英文授课专业奖学金（2026）",
    type: "university",
    typeLabel: "English-taught program scholarship",
    fundingLevel: "Tiered tuition and accommodation support",
    coverage: "Class A: two-thirds tuition and on-campus accommodation; Class B: half tuition and on-campus accommodation; Class C: on-campus accommodation.",
    amountText: "Tiered non-cash coverage; no fixed cash amount published.",
    requirementText: "Supports English-taught undergraduate routes. Applicants use the HFUT system without selecting a tier; the university assigns the level after comprehensive review.",
    benefitItems: [{ label: "Class A", included: true, note: "Two-thirds tuition and on-campus accommodation" }, { label: "Class B", included: true, note: "Half tuition and on-campus accommodation" }, { label: "Class C", included: true, note: "On-campus accommodation" }],
    eligibilityItems: [], applicationMaterials: [], applicationSteps: [{ label: "Apply in HFUT system", value: "No scholarship tier selection is required at application." }],
    actionLinks: [{ label: "Official 2026 guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }],
    summary: "Four-year tiered university scholarship for eligible English-taught closed-2026 undergraduate routes.",
  },
].map((row) => ({
  ...row,
  sourceFieldLineage: {
    title: "official 2026 scholarship section",
    type: "official scholarship provider and CUAC taxonomy",
    fundingLevel: "official scholarship coverage tiers",
    coverage: "official scholarship coverage tiers",
    applicableDegree: "official undergraduate guide scope",
    amountText: "official coverage; missing cash total retained",
    requirementText: "official application method and eligible-route text",
    benefitItems: "official scholarship coverage tiers",
    applicationSteps: "official application method",
    actionLinks: "official guide URL",
    applicationRound: "official guide title",
    summary: "official scholarship section",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: catalog.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: catalog.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 80, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence: [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  workbookReview: { result: "pass", rows: 18, note: "All 18 workbook rows were inspected with merged college and CSCA cells carried only within their declared Excel merge ranges. Chinese program names, teaching languages, durations and CSCA subjects match the locked workbook." },
  unresolved: [
    "The current notice index still publishes no general 2027 international degree guide; every intake and cycle-bound field remains explicitly 2026.",
    "English program names and college labels are reviewed translations of the official Chinese workbook; the original Chinese names remain in each route.",
    "The guide publishes scholarship coverage tiers but no fixed cash totals, quotas or scoring rubric; those values remain absent.",
    "Bank-account instructions and public staff contact details from the guide are intentionally excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, bank-account details or payment instructions are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-231");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 231, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
