import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const expected: Record<string, string> = {
  "cqnu-international-chinese-language-teachers-scholarship-spring-2027": "c88a64701fb9441c43bb8f331c9e101d13d233b40408902d387c47f0bdda0634",
  "caa-china-link-scholarship-spring-2027": "badd214f428c130dce4a2fef53482c551fcbac6f8fcff16af784a2bd00cb9ee0",
  "whu-postgraduate-guide-2026": "ab91135bfc8763d3c8ce100e5d7e8205f35d8f740b5774e36dabd921bd91bda3",
  "whu-international-student-fees-current": "44f3363bfdf11003a6101c395af2208878c74b71fddeb29e9e51bd9b29b3a338",
};

const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 32-34 evidence: ${missing.join(", ")}`);

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = (slug: string) => baseline.schools?.find((row) => row.slug === slug);
const city = (slug: string) => baseline.cities?.find((row) => row.slug === slug);
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verified = (id: string) => ({ status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source(id).fetchedAt, ...fields(id) });

const cqnuBase = school("chongqing-normal-university");
const caaBase = school("china-academy-of-art");
const whuBase = school("wuhan-university");
const chongqing = city("chongqing");
const hangzhou = city("hangzhou");
const wuhan = city("wuhan");
if (!cqnuBase || !caaBase || !whuBase || !chongqing || !hangzhou || !wuhan) throw new Error("Wave 32-34 baseline dependencies are missing.");

const cqnuSourceId = "cqnu-international-chinese-language-teachers-scholarship-spring-2027";
const cqnuSchool = {
  ...cqnuBase,
  applicationLevel: "Undergraduate, Master, Doctorate and Non-degree",
  deadlineSummary: "The March 2027 one-semester International Chinese Language Teachers Scholarship closes October 31, 2026. Other 2027 degree rounds remain unresolved.",
  admissionsUrl: source(cqnuSourceId).url,
  languageTags: [...new Set([...(cqnuBase.languageTags ?? []), "HSKK", "Chinese language study"])],
  campusHighlights: [...new Set([...(cqnuBase.campusHighlights ?? []), "March 2027 International Chinese Language Teachers Scholarship host"])],
  ...verified(cqnuSourceId),
  sourceFieldLineage: { ...(cqnuBase.sourceFieldLineage ?? {}), applicationLevel: "official scholarship categories", deadlineSummary: "official March 2027 route and deadline", admissionsUrl: "registered official scholarship guide", languageTags: "official HSK/HSKK requirements", campusHighlights: "official scholarship-host status" },
};
const cqnuProgramSlug = "chongqing-normal-university-international-chinese-language-teachers-scholarship-one-semester-spring-2027";
const cqnuProgram: CatalogSeedProgram = {
  slug: cqnuProgramSlug,
  schoolSlug: cqnuSchool.slug,
  citySlug: chongqing.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study (Spring 2027)",
  nameZh: "重庆师范大学2027年春季国际中文教师奖学金一学期研修生",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: "International Chinese Language Education, Chinese Language and Literature, Chinese History, Chinese Philosophy, Traditional Chinese Medicine or Tai Chi Culture",
  teachingLanguage: "Chinese",
  hskRequirement: "International Chinese Language Education, Chinese Language and Literature, Chinese History and Chinese Philosophy require HSK Level 3 score 180 plus an HSKK result. Traditional Chinese Medicine and Tai Chi Culture require an HSK result and prefer HSKK.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Registration, tuition, accommodation, living allowance and comprehensive medical insurance; one-semester students receive CNY 2,500/month.",
  applicationUrl: source(cqnuSourceId).url,
  applicationNote: "Applicants must be non-Chinese citizens, be in good physical and mental health, be aged 16-35 as of September 1, 2026 (up to 45 for in-service Chinese teachers), and submit applications through both the scholarship and university systems.",
  hasScholarship: true,
  badgeText: "March 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "International Chinese Language Teachers Scholarship",
  ...verified(cqnuSourceId),
  sourceFieldLineage: { nameEn: "official scholarship category and intake", nameZh: "official scholarship guide", durationMonths: "official five-month duration", subjectArea: "official one-semester tracks", teachingLanguage: "official HSK/HSKK requirements", hskRequirement: "official route thresholds", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official funding section", applicationNote: "official eligibility and application procedure" },
};
const cqnuIntake: CatalogSeedProgramIntake = {
  programSlug: cqnuProgramSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59Z",
  deadlineLabel: "Applications close October 31, 2026 for March 2027 entry.",
  applicationRound: "March 2027 one-semester scholarship entry",
  status: "open",
  ...fields(cqnuSourceId),
  sourceFieldLineage: { intakeTerm: "official March 2027 entry", intakeYear: "official March 2027 entry", deadlineDate: "official application deadline", deadlineLabel: "official application deadline", status: "deadline compared with capturedAt" },
};
const cqnuScholarship: CatalogSeedScholarship = {
  slug: "cqnu-international-chinese-language-teachers-scholarship-spring-2027",
  title: "Chongqing Normal University International Chinese Language Teachers Scholarship - Spring 2027",
  nameZh: "重庆师范大学2027年春季国际中文教师奖学金",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "Center for Language Education and Cooperation / Chongqing Normal University",
  schoolSlug: cqnuSchool.slug,
  programSlug: cqnuProgramSlug,
  fundingLevel: "Full",
  coverage: "Registration, tuition, accommodation, living allowance and comprehensive medical insurance.",
  applicableDegree: "One-semester non-degree study",
  amountText: "CNY 2,500/month living allowance for one-semester students.",
  deadlineDate: "2026-10-31",
  deadlineLabel: "October 31, 2026 for March 2027 entry",
  requirementText: "Route-specific HSK/HSKK requirements apply together with the published citizenship, health, age and application conditions.",
  actionLinks: [{ label: "Official CQNU scholarship guide", url: source(cqnuSourceId).url, kind: "official-source" }],
  ...verified(cqnuSourceId),
  sourceFieldLineage: { title: "official scholarship title and intake", fundingLevel: "official funding section", coverage: "official funding section", applicableDegree: "official one-semester category", amountText: "official living-allowance section", deadlineDate: "official deadline", requirementText: "official eligibility and route requirements" },
};

const caaSourceId = "caa-china-link-scholarship-spring-2027";
const caaSchool = {
  ...caaBase,
  applicationLevel: "Undergraduate and Non-degree",
  deadlineSummary: "China Link applications must be submitted at least three months before the semester; the official Spring 2027 semester starts in March. Other 2027 degree rounds remain unresolved.",
  admissionsUrl: source(caaSourceId).url,
  languageTags: [...new Set([...(caaBase.languageTags ?? []), "English", "Bilingual short-term study"])],
  campusHighlights: [...new Set([...(caaBase.campusHighlights ?? []), "2027 China Link short-term exchange host"])],
  ...verified(caaSourceId),
  sourceFieldLineage: { ...(caaBase.sourceFieldLineage ?? {}), applicationLevel: "official China Link non-degree categories", deadlineSummary: "official application procedure and Spring 2027 start", admissionsUrl: "registered official scholarship guide", languageTags: "official teaching-language section", campusHighlights: "official China Link host status" },
};
const caaProgramSlug = "china-academy-of-art-china-link-short-term-exchange-spring-2027";
const caaProgram: CatalogSeedProgram = {
  slug: caaProgramSlug,
  schoolSlug: caaSchool.slug,
  citySlug: hangzhou.slug,
  nameEn: "China Link Short-term Exchange Scholarship (Spring 2027)",
  nameZh: "中国美术学院中国政府奖学金短期交流项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Art and design exchange",
  subjectArea: "Chinese Painting and Calligraphy, or Chinese-taught courses in major CAA departments",
  teachingLanguage: "Chinese and English for Chinese Painting and Calligraphy; Chinese for departmental courses",
  hskRequirement: "No fixed HSK score is published in the official China Link guide; applicants selecting Chinese-taught departmental courses must be able to study in Chinese.",
  englishRequirement: "No fixed English-test score is published in the official China Link guide for the bilingual Chinese Painting and Calligraphy route.",
  tuitionText: "Tuition is fully waived by the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition waiver, free on-campus accommodation, comprehensive medical insurance and monthly stipend of CNY 3,000 for general scholars or CNY 3,500 for senior scholars.",
  applicationUrl: source(caaSourceId).url,
  applicationNote: "The exchange lasts 1-12 months. Applicants must remain full-time students or academic staff at a CSC foreign partner university, obtain CAA non-degree admission qualification, and submit to both CAA and CSC at least three months before the semester.",
  hasScholarship: true,
  badgeText: "March 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "China Link short-term exchange",
  ...verified(caaSourceId),
  sourceFieldLineage: { nameEn: "official scholarship title and Spring 2027 start", degreeLevel: "official scholar categories and non-degree condition", durationMonths: "official 1-12 month range; upper published bound represented", subjectArea: "official admission-major section", teachingLanguage: "official teaching-language section", hskRequirement: "official guide publishes teaching languages but no fixed HSK threshold", englishRequirement: "official guide publishes teaching languages but no fixed English-test threshold", tuitionText: "official full tuition-waiver provision", scholarshipText: "official funding section", applicationNote: "official duration, eligibility and application procedure" },
};
const caaIntake: CatalogSeedProgramIntake = {
  programSlug: caaProgramSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineLabel: "Apply in both systems at least three months before the March 2027 semester; no exact calendar deadline is published.",
  applicationRound: "Spring 2027 China Link short-term exchange",
  status: "open",
  ...fields(caaSourceId),
  sourceFieldLineage: { intakeTerm: "official March semester start", intakeYear: "official March 2027 semester start", deadlineLabel: "official relative application lead time", status: "relative deadline compared with capturedAt" },
};
const caaScholarship: CatalogSeedScholarship = {
  slug: "china-academy-of-art-china-link-scholarship-spring-2027",
  title: "China Academy of Art China Link Scholarship - Spring 2027",
  nameZh: "中国美术学院中国政府奖学金短期交流项目（2027年春季）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - China Link",
  providerName: "China Scholarship Council / China Academy of Art",
  schoolSlug: caaSchool.slug,
  programSlug: caaProgramSlug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, free on-campus accommodation, comprehensive medical insurance and monthly stipend.",
  applicableDegree: "Non-degree / Short-term exchange",
  applicableProgram: "Chinese Painting and Calligraphy or Chinese-taught courses in major CAA departments",
  amountText: "CNY 3,000/month for general scholars; CNY 3,500/month for senior scholars.",
  deadlineLabel: "At least three months before the March 2027 semester; no exact calendar deadline is published",
  requirementText: "Applicants must meet the published citizenship, health, age and CSC partner-university affiliation conditions and obtain CAA non-degree admission qualification.",
  actionLinks: [{ label: "Official CAA China Link guide", url: source(caaSourceId).url, kind: "official-source" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
  ...verified(caaSourceId),
  sourceFieldLineage: { title: "official scholarship title and Spring 2027 start", fundingLevel: "official funding section", coverage: "official funding section", applicableDegree: "official non-degree condition", applicableProgram: "official admission-major section", amountText: "official funding section", deadlineLabel: "official application procedure", requirementText: "official eligibility section" },
};

const whuSourceId = "whu-postgraduate-guide-2026";
const whuFeeSourceId = "whu-international-student-fees-current";
const whuSchool = {
  ...whuBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "Self-funded Spring 2027 non-degree applications run from October through December 2026. Other 2027 degree rounds remain unresolved.",
  tuitionSummary: "Current official annual tuition: undergraduate CNY 20,000-40,000; master CNY 23,000-50,000; PhD CNY 30,000-55,000; language study CNY 8,500/semester or CNY 17,000/year, with short courses charged by week; general and senior scholar fees vary by field and teaching language.",
  admissionsUrl: source(whuSourceId).url,
  campusHighlights: [...new Set([...(whuBase.campusHighlights ?? []), "Spring 2027 self-funded non-degree intake"])],
  ...verified(whuSourceId),
  sourceFieldLineage: { ...(whuBase.sourceFieldLineage ?? {}), applicationLevel: "official degree and non-degree application periods", deadlineSummary: "official Spring 2027 non-degree application period", tuitionSummary: `registered official fee table ${whuFeeSourceId}: Wuhan University Fee Structure`, admissionsUrl: "registered official admissions guide", campusHighlights: "official Spring 2027 route" },
};
const whuProgramSlug = "wuhan-university-self-funded-nondegree-spring-2027";
const whuProgram: CatalogSeedProgram = {
  slug: whuProgramSlug,
  schoolSlug: whuSchool.slug,
  citySlug: wuhan.slug,
  nameEn: "Self-funded Non-degree Programs (Spring 2027)",
  nameZh: "武汉大学2027年春季自费非学历项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Non-degree study",
  applicationUrl: "https://admission.whu.edu.cn/",
  applicationNote: "The official guide publishes the Spring 2027 application window but does not name the available non-degree programs, tuition, duration or route-specific language requirements; those fields remain absent.",
  hasScholarship: false,
  badgeText: "Spring 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Self-funded non-degree programs",
  ...verified(whuSourceId),
  sourceFieldLineage: { nameEn: "official Spring 2027 non-degree application period", nameZh: "official institution identity and route", degreeLevel: "official non-degree category", applicationUrl: "official online-application section", applicationNote: "official application period plus explicit unresolved fields" },
};
const whuIntake: CatalogSeedProgramIntake = {
  programSlug: whuProgramSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineLabel: "Application period: October-December 2026; the official guide does not publish exact opening or closing days.",
  applicationRound: "Spring 2027 self-funded non-degree entry",
  status: "open",
  ...fields(whuSourceId),
  sourceFieldLineage: { intakeTerm: "official Spring 2027 category", intakeYear: "official Spring 2027 category", deadlineLabel: "official month-level application period", status: "application period compared with current date" },
};

const waves: Array<{ number: number; candidate: CatalogSeedBundle; ids: string[]; unresolved: string[] }> = [
  { number: 32, candidate: { version: 1, generatedAt: source(cqnuSourceId).fetchedAt, cities: [chongqing], schools: [cqnuSchool], programs: [cqnuProgram], programIntakes: [cqnuIntake], scholarships: [cqnuScholarship] }, ids: [cqnuSourceId], unresolved: ["The source establishes a March 2027 one-semester scholarship route, not CQNU's general Fall 2027 degree admissions.", "Track-specific HSK/HSKK distinctions are preserved; no unprinted language threshold is inferred."] },
  { number: 33, candidate: { version: 1, generatedAt: source(caaSourceId).fetchedAt, cities: [hangzhou], schools: [caaSchool], programs: [caaProgram], programIntakes: [caaIntake], scholarships: [caaScholarship] }, ids: [caaSourceId], unresolved: ["The guide publishes a relative three-month application lead time rather than an exact deadline, so deadlineDate remains absent.", "The China Link route does not establish CAA's general 2027 degree admissions."] },
  { number: 34, candidate: { version: 1, generatedAt: [source(whuSourceId).fetchedAt, source(whuFeeSourceId).fetchedAt].sort().at(-1)!, cities: [wuhan], schools: [whuSchool], programs: [whuProgram], programIntakes: [whuIntake] }, ids: [whuSourceId, whuFeeSourceId], unresolved: ["The guide names the Spring 2027 non-degree application window but does not publish the route list, route-specific tuition, duration or route-specific language requirements; those fields remain absent.", "The guide publishes month-level dates only, so no exact closing day is inferred.", "The current fee table supports school-level category ranges but does not identify which category the grouped Spring 2027 placeholder will use, so the program-level tuition field remains absent."] },
];

for (const { number, candidate, ids, unresolved } of waves) {
  const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
  const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
  const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
  if (!validation.ok) throw new Error(`2027 wave ${number} validation failed:\n${validation.errors.join("\n")}`);
  const review = {
    version: 1,
    status: "unreviewed_draft",
    generatedAt: candidate.generatedAt,
    candidateSha256,
    publicationAuthorized: false,
    databaseWriteAuthorized: false,
    scope: { schoolSlugs: candidate.schools?.map((row) => row.slug) ?? [], refreshedPrograms: candidate.programs?.length ?? 0, new2027Intakes: candidate.programIntakes?.length ?? 0, refreshedScholarships: candidate.scholarships?.length ?? 0, sourceSnapshots: ids.length },
    evidence: ids.map((id) => source(id)).map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
    unresolved,
    notes: ["No applicant, account, passport, payment or other personal data is included."],
  };
  const stem = resolve(root, `seeds/catalog.2027-wave-${String(number).padStart(2, "0")}`);
  await Promise.all([
    writeFile(`${stem}.draft.json`, candidateText, "utf8"),
    writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
    writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify({ ok: true, wave: number, candidateSha256, counts: { schools: candidate.schools?.length ?? 0, programs: candidate.programs?.length ?? 0, programIntakes: candidate.programIntakes?.length ?? 0, scholarships: candidate.scholarships?.length ?? 0, sourceSnapshots: ids.length }, publicationAuthorized: false }, null, 2));
}
