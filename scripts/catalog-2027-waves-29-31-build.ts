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
  "sdu-international-chinese-language-teachers-scholarship-2026": "28765dc3197c95f046f6c1a44b5a32b11b69d214fb384e74cb5164a1cfbd867b",
  "sdu-international-chinese-language-teachers-scholarship-image-2026": "f7c716ffe85a176a3e796b04a9a32aa16c219b6b22783e2ab6ce06c70795df95",
  "heu-atomic-energy-scholarship-page-2027-2028": "94f1b754ecc6ead4bf70dca77551115b6333c2abeaaa74ca5e933c7140f150c0",
  "heu-atomic-energy-scholarship-image-01-2027-2028": "8105b91da02651774629d8e7f5c6b08018d15fc496bcb4188e8da89617a12923",
  "heu-atomic-energy-scholarship-image-02-2027-2028": "b4d341e8ca74d8216833397bff413874305b151df7847cd703f317f86d736c79",
  "heu-atomic-energy-scholarship-image-03-2027-2028": "f084a7fa05b57bffee9c35aa002d9e2cc9099661af17d529eeddc9721e660f00",
  "heu-atomic-energy-scholarship-image-04-2027-2028": "b40e39d096a082e6e3d5d44490326d1a598cb8ddea3ced69eaccbc99056dc462",
  "heu-atomic-energy-scholarship-image-05-2027-2028": "7dd0fa9fc01ea1d9e49e974204db9c0353efeb6d0138da76a1dff0a470d42009",
  "heu-atomic-energy-scholarship-image-06-2027-2028": "9ae3e68ff3ab1e8073ee93678260c235193dee25293695874803e62ee3eb0479",
  "wzu-china-link-scholarship-2026-2027": "799fbd2d5ab3a30f90e00e0c3a933c0f7c1f82e5dbeadaa50c0ae2af9a61895e",
  "wzu-current-international-entry-requirements": "ef849b2085588ab73fedf357c52c3e13020fe698cca8976d4195fcb93b818a03",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 29-31 evidence: ${missing.join(", ")}`);

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = (slug: string) => baseline.schools?.find((row) => row.slug === slug);
const city = (slug: string) => baseline.cities?.find((row) => row.slug === slug);
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verified = (id: string) => ({ status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source(id).fetchedAt, ...fields(id) });
const sduBase = school("shandong-university");
const heuBase = school("harbin-engineering-university");
const wzuBase = school("wenzhou-university");
const jinan = city("jinan");
const harbin = city("harbin");
const wenzhou = city("wenzhou");
if (!sduBase || !heuBase || !wzuBase || !jinan || !harbin || !wenzhou) throw new Error("Wave 29-31 baseline dependencies are missing.");

const sduSchool = {
  ...sduBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The official 2026 scholarship guide includes a March 2027 one-semester intake closing October 31, 2026. Other 2027 degree rounds remain unresolved.",
  admissionsUrl: source("sdu-international-chinese-language-teachers-scholarship-2026").url,
  languageTags: [...new Set([...(sduBase.languageTags ?? []), "Chinese language study"])],
  campusHighlights: [...new Set([...(sduBase.campusHighlights ?? []), "March 2027 International Chinese Language Teachers Scholarship host"])],
  ...verified("sdu-international-chinese-language-teachers-scholarship-image-2026"),
  sourceFieldLineage: { ...(sduBase.sourceFieldLineage ?? {}), applicationLevel: "official scholarship categories", deadlineSummary: "official March 2027 route and deadline", admissionsUrl: "registered official scholarship page", languageTags: "official scholarship route", campusHighlights: "official scholarship-host status" },
};
const sduProgramSlug = "shandong-university-international-chinese-language-teachers-scholarship-one-semester-spring-2027";
const sduProgram: CatalogSeedProgram = {
  slug: sduProgramSlug,
  schoolSlug: sduSchool.slug,
  citySlug: jinan.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study (Spring 2027)",
  nameZh: "山东大学2027年春季国际中文教师奖学金一学期研修生",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: "Chinese language education, Chinese language and literature, Chinese history, Chinese philosophy or Tai Chi culture",
  teachingLanguage: "Chinese",
  hskRequirement: "Most one-semester tracks require HSK Level 3 score 180 and an HSKK result; the Tai Chi culture track requires an HSK result and gives priority to applicants with HSKK.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full scholarship covering tuition, accommodation, living allowance and comprehensive medical insurance.",
  applicationUrl: source("sdu-international-chinese-language-teachers-scholarship-2026").url,
  applicationNote: "Applicants must be non-Chinese citizens, in good physical and mental health, aged 16-35, and normally not current beneficiaries of a similar Chinese Government Scholarship. In-service Chinese teachers may be eligible up to age 45.",
  hasScholarship: true,
  badgeText: "March 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "International Chinese Language Teachers Scholarship",
  ...verified("sdu-international-chinese-language-teachers-scholarship-image-2026"),
  sourceFieldLineage: { nameEn: "official scholarship table", nameZh: "official scholarship guide", durationMonths: "official five-month duration", subjectArea: "official one-semester tracks", teachingLanguage: "official HSK/HSKK requirements", hskRequirement: "official route thresholds", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official coverage section", applicationNote: "official eligibility section" },
};
const sduIntake: CatalogSeedProgramIntake = {
  programSlug: sduProgramSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59Z",
  deadlineLabel: "Applications close October 31, 2026 for March 2027 entry.",
  applicationRound: "March 2027 one-semester scholarship entry",
  status: "open",
  ...fields("sdu-international-chinese-language-teachers-scholarship-image-2026"),
  sourceFieldLineage: { intakeTerm: "official March 2027 entry", intakeYear: "official March 2027 entry", deadlineDate: "official application deadline", deadlineLabel: "official application deadline", status: "deadline compared with capturedAt" },
};
const sduScholarship: CatalogSeedScholarship = {
  slug: "sdu-international-chinese-language-teachers-scholarship-spring-2027",
  title: "Shandong University International Chinese Language Teachers Scholarship - Spring 2027",
  nameZh: "山东大学2027年春季国际中文教师奖学金",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "Center for Language Education and Cooperation / Shandong University",
  schoolSlug: sduSchool.slug,
  programSlug: sduProgramSlug,
  fundingLevel: "Full",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.",
  applicableDegree: "One-semester non-degree study",
  deadlineDate: "2026-10-31",
  deadlineLabel: "October 31, 2026 for March 2027 entry",
  requirementText: "Route-specific HSK/HSKK requirements apply; applicants must satisfy the published citizenship, health and age conditions.",
  actionLinks: [{ label: "Official SDU scholarship guide", url: source("sdu-international-chinese-language-teachers-scholarship-2026").url, kind: "official-source" }],
  ...verified("sdu-international-chinese-language-teachers-scholarship-image-2026"),
  sourceFieldLineage: { title: "official guide and intake", fundingLevel: "official coverage section", coverage: "official coverage section", applicableDegree: "official one-semester category", deadlineDate: "official deadline", requirementText: "official route and eligibility requirements" },
};

const heuSchool = {
  ...heuBase,
  deadlineSummary: "The 2027-2028 Atomic Energy Scholarship accepts applications February 15-May 15, 2027; registration is September 1-30, 2027. Other Fall 2027 routes remain unresolved.",
  admissionsUrl: source("heu-atomic-energy-scholarship-page-2027-2028").url,
  campusHighlights: [...new Set([...(heuBase.campusHighlights ?? []), "2027-2028 Atomic Energy Scholarship host"])],
  ...verified("heu-atomic-energy-scholarship-image-05-2027-2028"),
  sourceFieldLineage: { ...(heuBase.sourceFieldLineage ?? {}), deadlineSummary: "official 2027 application and registration timeline", admissionsUrl: "registered official admissions page", campusHighlights: "official scholarship-host status" },
};
const heuPrograms: CatalogSeedProgram[] = [
  {
    slug: "harbin-engineering-university-energy-and-power-nuclear-energy-engineering-master-fall-2027",
    schoolSlug: heuSchool.slug,
    citySlug: harbin.slug,
    nameEn: "Energy and Power (Nuclear Energy Engineering) - Atomic Energy Scholarship",
    nameZh: "哈尔滨工程大学能源动力（核能工程）硕士项目（原子能奖学金）",
    degreeLevel: "Master",
    durationMonths: 36,
    fieldCategory: "Nuclear engineering",
    subjectArea: "Energy and Power (Nuclear Energy Engineering)",
    teachingLanguage: "English",
    englishRequirement: "TOEFL 90+, IELTS 6.0+ or equivalent for applicants whose native language is not English.",
    tuitionText: "Tuition is fully covered by the Atomic Energy Scholarship; no self-funded tuition amount is published for this route.",
    scholarshipText: "Full scholarship: tuition and on-campus accommodation covered, medical insurance CNY 800/year, stipend CNY 3,000/month; approved off-campus allowance CNY 700/month.",
    applicationUrl: "https://hrbeu.at0086.cn/student",
    applicationNote: "Applicants must be non-Chinese citizens from emerging nuclear-power countries, hold a bachelor's degree, be under 35, and apply in both the CSC Type B system (HEU agency 10217) and HEU system.",
    hasScholarship: true,
    badgeText: "Fall 2027",
    displayGroup: "Master",
    displayGroupLabel: "Atomic Energy Scholarship",
    ...verified("heu-atomic-energy-scholarship-image-05-2027-2028"),
    sourceFieldLineage: { nameEn: "official application instructions", durationMonths: "official three-year duration", teachingLanguage: "official English-medium statement", englishRequirement: "official required-documents page", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official coverage table", applicationNote: "official eligibility and submission pages" },
  },
  {
    slug: "harbin-engineering-university-nuclear-science-and-technology-doctoral-fall-2027",
    schoolSlug: heuSchool.slug,
    citySlug: harbin.slug,
    nameEn: "Nuclear Science and Technology - Atomic Energy Scholarship",
    nameZh: "哈尔滨工程大学核科学与技术博士项目（原子能奖学金）",
    degreeLevel: "Doctoral",
    durationMonths: 48,
    fieldCategory: "Nuclear science and technology",
    subjectArea: "Nuclear Science and Technology",
    teachingLanguage: "English",
    englishRequirement: "TOEFL 90+, IELTS 6.0+ or equivalent for applicants whose native language is not English.",
    tuitionText: "Tuition is fully covered by the Atomic Energy Scholarship; no self-funded tuition amount is published for this route.",
    scholarshipText: "Full scholarship: tuition and on-campus accommodation covered, medical insurance CNY 800/year, stipend CNY 3,500/month; approved off-campus allowance CNY 1,000/month.",
    applicationUrl: "https://hrbeu.at0086.cn/student",
    applicationNote: "Applicants must be non-Chinese citizens from emerging nuclear-power countries, hold a master's degree, be under 40, and apply in both the CSC Type B system (HEU agency 10217) and HEU system.",
    hasScholarship: true,
    badgeText: "Fall 2027",
    displayGroup: "Doctoral",
    displayGroupLabel: "Atomic Energy Scholarship",
    ...verified("heu-atomic-energy-scholarship-image-05-2027-2028"),
    sourceFieldLineage: { nameEn: "official application instructions", durationMonths: "official four-year duration", teachingLanguage: "official English-medium statement", englishRequirement: "official required-documents page", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official coverage table", applicationNote: "official eligibility and submission pages" },
  },
];
const heuIntakes: CatalogSeedProgramIntake[] = heuPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-05-15T15:59:59Z",
  deadlineLabel: "Application window: February 15-May 15, 2027; registration September 1-30, 2027.",
  applicationRound: "2027-2028 Atomic Energy Scholarship",
  status: "closed",
  ...fields("heu-atomic-energy-scholarship-image-05-2027-2028"),
  sourceFieldLineage: { intakeTerm: "official September 2027 registration", intakeYear: "official September 2027 registration", deadlineDate: "official application timeline", deadlineLabel: "official application and registration timeline", status: "application window has not opened at capturedAt" },
}));
const heuScholarship: CatalogSeedScholarship = {
  slug: "harbin-engineering-university-atomic-energy-scholarship-2027-2028",
  title: "Harbin Engineering University Atomic Energy Scholarship 2027-2028",
  nameZh: "哈尔滨工程大学2027-2028原子能奖学金",
  type: "government",
  typeLabel: "Chinese Government Scholarship - Atomic Energy Scholarship",
  providerName: "China Atomic Energy Authority / Ministry of Education / Harbin Engineering University",
  schoolSlug: heuSchool.slug,
  fundingLevel: "Full",
  coverage: "Tuition, on-campus accommodation, medical insurance and monthly stipend; approved off-campus allowance is available at the published rate.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Energy and Power (Nuclear Energy Engineering) master's and Nuclear Science and Technology doctoral programs",
  amountText: "Master: CNY 3,000/month stipend and CNY 700/month approved off-campus allowance; Doctoral: CNY 3,500/month stipend and CNY 1,000/month approved off-campus allowance; insurance CNY 800/year.",
  deadlineDate: "2027-05-15",
  deadlineLabel: "February 15-May 15, 2027",
  requirementText: "Applicants must meet the published nationality, nuclear-field, degree, age and English-language conditions.",
  benefitItems: [{ label: "Tuition", included: true }, { label: "On-campus accommodation", included: true }, { label: "Medical insurance", included: true, note: "CNY 800/year" }, { label: "Monthly stipend", included: true, note: "CNY 3,000 master / CNY 3,500 doctoral" }],
  actionLinks: [{ label: "Official HEU 2027-2028 admissions page", url: source("heu-atomic-energy-scholarship-page-2027-2028").url, kind: "official-source" }],
  ...verified("heu-atomic-energy-scholarship-image-05-2027-2028"),
  sourceFieldLineage: { title: "official guide cover", fundingLevel: "official coverage table", coverage: "official coverage table", applicableDegree: "official program overview", applicableProgram: "official application instructions", amountText: "official coverage table", deadlineDate: "official application timeline", requirementText: "official eligibility and documents pages" },
};

const wzuSchool = {
  ...wzuBase,
  languageRequirement: "Chinese-taught bachelor's programs require HSK Level 4 or higher; Chinese-taught master's programs require HSK Level 5 or higher. Non-native English speakers applying to English-taught programs should provide TOEFL above 70, IELTS above 6, Duolingo above 105, or other accepted proof of English proficiency.",
  hskRequirement: "Chinese-taught bachelor's programs: HSK Level 4 or higher. Chinese-taught master's programs: HSK Level 5 or higher.",
  englishRequirement: "English-taught programs for non-native English speakers: TOEFL above 70, IELTS above 6, Duolingo above 105, or other proof of English proficiency accepted by the university.",
  cscaRequired: true,
  cscaRequirement: "Starting from the 2026/2027 academic year, all international undergraduate applicants must provide valid CSCA transcripts. Required subjects and test-paper languages depend on the admitted-major directory and are not listed on this requirements page.",
  cscaSubjects: [],
  deadlineSummary: "The 2026 China Link call accepts applications year-round with entry no later than August 31, 2027. Other 2027 degree rounds remain unresolved.",
  admissionsUrl: source("wzu-current-international-entry-requirements").url,
  campusHighlights: [...new Set([...(wzuBase.campusHighlights ?? []), "China Link short-term research host"])],
  ...verified("wzu-current-international-entry-requirements"),
  sourceFieldLineage: {
    ...(wzuBase.sourceFieldLineage ?? {}),
    languageRequirement: "wzu-current-international-entry-requirements: language requirements section",
    hskRequirement: "wzu-current-international-entry-requirements: language requirements section",
    englishRequirement: "wzu-current-international-entry-requirements: language requirements section",
    cscaRequired: "wzu-current-international-entry-requirements: CSCA section",
    cscaRequirement: "wzu-current-international-entry-requirements: CSCA section",
    cscaSubjects: "wzu-current-international-entry-requirements: subjects are delegated to the admitted-major directory and remain unresolved",
    deadlineSummary: "wzu-china-link-scholarship-2026-2027: duration and application-process sections",
    admissionsUrl: "wzu-current-international-entry-requirements: registered official entry-requirements page",
    campusHighlights: "wzu-china-link-scholarship-2026-2027: official China Link host status",
  },
};
const wzuProgramSlug = "wenzhou-university-china-link-research-exchange-2027";
const wzuProgram: CatalogSeedProgram = {
  slug: wzuProgramSlug,
  schoolSlug: wzuSchool.slug,
  citySlug: wenzhou.slug,
  nameEn: "China Link Short-term Scientific Exchange - 2027",
  nameZh: "温州大学中国政府奖学金短期科研交流项目（2027年入学）",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Short-term research exchange",
  subjectArea: "All disciplines other than Chinese-language study",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published for this China Link route; applicants must be able to study or conduct research in the selected Chinese- or English-medium setting.",
  englishRequirement: "No fixed English-test score is published for this China Link route; applicants must be able to study or conduct research in the selected Chinese- or English-medium setting.",
  tuitionText: "Tuition is fully waived by the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition waiver, free on-campus accommodation, comprehensive medical insurance and monthly stipend of CNY 3,000 for general scholars or CNY 3,500 for senior scholars.",
  applicationUrl: "https://studyinchina.csc.edu.cn/#/login",
  applicationNote: "The route lasts 1-12 months. Applicants must obtain Wenzhou University admission qualification, remain full-time students or academic staff at a CSC foreign partner university, and use WZU agency number 10351 in the CSC Type B system.",
  hasScholarship: true,
  badgeText: "Entry through August 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Research exchange programs",
  ...verified("wzu-china-link-scholarship-2026-2027"),
  sourceFieldLineage: { nameEn: "official scholarship title and latest-start condition", degreeLevel: "official scholar categories", durationMonths: "official 1-12 month range; upper published bound represented", subjectArea: "official study/research fields", teachingLanguage: "official working-language section", hskRequirement: "official guide publishes working languages but no fixed HSK threshold", englishRequirement: "official guide publishes working languages but no fixed English-test threshold", tuitionText: "official full tuition-waiver provision", scholarshipText: "official funding section", applicationNote: "official duration, eligibility and application procedure" },
};
const wzuIntake: CatalogSeedProgramIntake = {
  programSlug: wzuProgramSlug,
  intakeTerm: "Rolling",
  intakeYear: 2027,
  deadlineLabel: "CSC portal open year-round; study must start no later than August 31, 2027. No single calendar deadline is published.",
  applicationRound: "2026 China Link call with entry no later than August 31, 2027",
  status: "open",
  ...fields("wzu-china-link-scholarship-2026-2027"),
  sourceFieldLineage: { intakeTerm: "year-round application statement", intakeYear: "official latest-start condition", deadlineLabel: "official application procedure and latest-start condition", status: "portal stated open year-round" },
};
const wzuScholarship: CatalogSeedScholarship = {
  slug: "wenzhou-university-china-link-scholarship-2027",
  title: "Wenzhou University China Link Scholarship - 2027 Entry",
  nameZh: "温州大学中国政府奖学金短期科研交流项目（2027年入学）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - China Link",
  providerName: "China Scholarship Council / Wenzhou University",
  schoolSlug: wzuSchool.slug,
  programSlug: wzuProgramSlug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, free on-campus accommodation, comprehensive medical insurance and monthly stipend.",
  applicableDegree: "Non-degree / Research exchange",
  applicableProgram: "General scholars and senior scholars in all disciplines other than Chinese-language study",
  amountText: "CNY 3,000/month for general scholars; CNY 3,500/month for senior scholars.",
  deadlineLabel: "Portal open year-round; study must start no later than August 31, 2027",
  requirementText: "Applicants must be non-Chinese citizens in good health, be under 45 for general scholar or under 50 for senior scholar, remain affiliated with a CSC foreign partner university and obtain WZU admission qualification.",
  actionLinks: [{ label: "Official WZU China Link guide", url: source("wzu-china-link-scholarship-2026-2027").url, kind: "official-source" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
  ...verified("wzu-china-link-scholarship-2026-2027"),
  sourceFieldLineage: { title: "official program title and latest-start condition", fundingLevel: "official funding section", coverage: "official funding section", applicableDegree: "official scholar categories", amountText: "official funding section", deadlineLabel: "official application procedure", requirementText: "official eligibility section" },
};

const waves: Array<{ number: number; candidate: CatalogSeedBundle; unresolved: string[] }> = [
  { number: 29, candidate: { version: 1, generatedAt: source("sdu-international-chinese-language-teachers-scholarship-image-2026").fetchedAt, cities: [jinan], schools: [sduSchool], programs: [sduProgram], programIntakes: [sduIntake], scholarships: [sduScholarship] }, unresolved: ["The official scholarship guide is image-only; fields are limited to the legible published table and text.", "This Spring 2027 scholarship route does not establish general Fall 2027 degree admissions."] },
  { number: 30, candidate: { version: 1, generatedAt: source("heu-atomic-energy-scholarship-image-06-2027-2028").fetchedAt, cities: [harbin], schools: [heuSchool], programs: heuPrograms, programIntakes: heuIntakes, scholarships: [heuScholarship] }, unresolved: ["The linked PDF endpoint is CAPTCHA-protected and was not bypassed; the candidate uses the six official page images and admissions page only.", "The guide establishes two scholarship degree routes, not HEU's complete Fall 2027 international catalog."] },
  { number: 31, candidate: { version: 1, generatedAt: source("wzu-current-international-entry-requirements").fetchedAt, cities: [wenzhou], schools: [wzuSchool], programs: [wzuProgram], programIntakes: [wzuIntake], scholarships: [wzuScholarship] }, unresolved: ["The China Link source publishes year-round application access and a latest-start date rather than one calendar deadline, so deadlineDate remains absent.", "The current entry-requirements page delegates CSCA subjects and test-paper languages to the admitted-major directory, so cscaSubjects remains empty until that official directory is published and acquired.", "The China Link route does not establish WZU's general Fall 2027 degree admissions."] },
];

for (const { number, candidate, unresolved } of waves) {
  const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
  const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
  const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
  if (!validation.ok) throw new Error(`2027 wave ${number} validation failed:\n${validation.errors.join("\n")}`);
  const ids = number === 29
    ? ["sdu-international-chinese-language-teachers-scholarship-2026", "sdu-international-chinese-language-teachers-scholarship-image-2026"]
    : number === 30
      ? ["heu-atomic-energy-scholarship-page-2027-2028", ...Array.from({ length: 6 }, (_, index) => `heu-atomic-energy-scholarship-image-0${index + 1}-2027-2028`)]
      : ["wzu-china-link-scholarship-2026-2027", "wzu-current-international-entry-requirements"];
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
