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
const workRoot = resolve(root, "work/catalog-official");
const expected: Record<string, string> = {
  "tjutech-chinese-language-spring-2027": "7650e30bd55eff8af03c624ecf15876e631406e131a6058fc9deeebbb46a4443",
  "changan-spring-intake-programs-2027": "1a1fa6f85d4ce2e9cca93a07b792e568a192c0c577b93f4e6d3a3b952fba6a0f",
  "zjgsu-chinese-language-culture-spring-2027": "4aac0008a807e0116e5e3d6f02e11b240d0fffee28ceb22293b736de93874f9d",
  "zjgsu-current-international-student-fees": "b3282b69f711e002a4a6a19b2474f430d8e2d011ef70625e14241f905678aaaa",
  "zjsu-international-chinese-language-teachers-scholarship-2026": "6471a83e0a0192fdfd7f9a8d0c32e4d20c6a74e293c30615facffed2ebf0fc6d",
  "blcu-beijing-international-students-scholarship-spring-2027": "366639b6c40cfa6e7632ca011c24729f990b013845019954ce5b066564d8ca6e",
};

const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
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
if (missing.length) throw new Error(`Missing locked 2027 wave 23 evidence: ${missing.join(", ")}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const findDependency = <T extends { slug: string }>(slug: string, current: T[] | undefined, original: T[] | undefined, label: string) => {
  const row = current?.find((item) => item.slug === slug) ?? original?.find((item) => item.slug === slug);
  if (!row) throw new Error(`Missing ${label} dependency: ${slug}`);
  return row;
};
const citySlugs = ["tianjin", "xian", "hangzhou", "beijing"];
const schoolSlugs = ["tianjin-university-of-technology", "chang-an-university", "zhejiang-gongshang-university", "beijing-language-and-culture-university"];
const cities = citySlugs.map((slug) => findDependency(slug, prior.cities, baseline.cities, "city"));
const schools = schoolSlugs.map((slug) => findDependency(slug, prior.schools, baseline.schools, "school"));
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verified = (id: string) => ({ status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source(id).fetchedAt, ...fields(id) });

const tjutProgram: CatalogSeedProgram = {
  slug: "tianjin-university-of-technology-chinese-language-one-semester-spring-2027",
  schoolSlug: "tianjin-university-of-technology",
  citySlug: "tianjin",
  nameEn: "Chinese Language Program - One Semester (Spring 2027)",
  nameZh: "天津理工大学2027年春季汉语进修生项目（一学期）",
  degreeLevel: "Non-degree",
  durationMonths: 4,
  fieldCategory: "Chinese language",
  subjectArea: "Chinese language and culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 6000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "one semester",
  tuitionText: "CNY 6,000 for the 16-week semester; insurance is CNY 400. On-campus accommodation is CNY 40/day for a single room or CNY 30/day for a double room, excluding utilities and internet.",
  applicationUrl: "https://tjut.at0086.cn/StuApplication/Login.aspx",
  applicationNote: "Applicants must be non-Chinese high-school graduates aged 18 or older and in good health. Applicants under 18 on September 1, 2027 need notarized Tianjin guardian documents. Required materials include passport, photo, highest diploma and transcript, physical examination, non-criminal-record certificate and any required guardian documents. The official page prints an application opening date of October 8, 2025 alongside a December 15, 2026 deadline; the opening year is preserved as a source conflict and is not normalized.",
  hasScholarship: false,
  badgeText: "March 2027",
  displayTuition: "CNY 6,000/semester",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  ...verified("tjutech-chinese-language-spring-2027"),
  sourceFieldLineage: { nameEn: "official program heading and March 2027 commencement", durationMonths: "official 16-week duration represented as four months", tuitionAmount: "official fee table", tuitionText: "official tuition, insurance and accommodation table", applicationNote: "official eligibility, materials and application-time sections" },
};

const chinaLinkProgram: CatalogSeedProgram = {
  slug: "chang-an-university-china-link-research-exchange-2027",
  schoolSlug: "chang-an-university",
  citySlug: "xian",
  nameEn: "China Link Short-term Scientific Exchange Scholarship Program",
  nameZh: "长安大学中国政府奖学金“青年使者交流学习计划”（China Link）",
  degreeLevel: "Non-degree / Research exchange",
  durationMonths: 12,
  fieldCategory: "Research exchange",
  subjectArea: "Published Chinese-taught and English-taught programs",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published for the China Link route; applicants may submit a language certificate if available and must meet the selected host program's requirements.",
  englishRequirement: "No fixed English-test score is published for the China Link route; applicants may submit a language certificate if available and must meet the selected host program's requirements.",
  tuitionText: "Tuition is fully covered by the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full scholarship covering tuition, accommodation, living allowance and comprehensive medical insurance for a 1-12 month stay.",
  applicationUrl: "https://is.chd.edu.cn",
  applicationNote: "General scholars must be current undergraduate or master's students under 35; senior scholars must be current doctoral students or faculty under 40. Applicants must remain full-time students or academic staff at a CSC foreign partner university. Apply in both the CSC and Chang'an University systems; the CNY 600 application fee is paid after material review. Contact the university for the specific start date and deadline.",
  hasScholarship: true,
  badgeText: "1-12 month scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Research exchange",
  ...verified("changan-spring-intake-programs-2027"),
  sourceFieldLineage: { nameEn: "official China Link heading", durationMonths: "official 1-12 month duration; maximum represented", subjectArea: "official program links", hskRequirement: "official materials section: language certificate if available; selected-program rules remain applicable", englishRequirement: "official materials section: language certificate if available; selected-program rules remain applicable", tuitionText: "official full-scholarship coverage section", scholarshipText: "official scholarship content and criteria", applicationNote: "official eligibility, procedure and deadline sections" },
};

const changanSelfFundedProgram: CatalogSeedProgram = {
  slug: "chang-an-university-self-funded-chinese-language-spring-2027",
  schoolSlug: "chang-an-university",
  citySlug: "xian",
  nameEn: "Self-funded Chinese Language Program - Spring 2027",
  nameZh: "长安大学2027年春季自费汉语进修项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: "Chinese language",
  teachingLanguage: "Chinese",
  hskRequirement: "No fixed HSK score is published for this self-funded Chinese-language route.",
  tuitionAmount: 8000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "one semester",
  tuitionText: "CNY 8,000 tuition, CNY 3,600 on-campus accommodation, CNY 400 insurance and CNY 400 non-refundable application fee.",
  applicationUrl: "https://is.chd.edu.cn",
  applicationNote: "Applicants must be non-Chinese citizens aged 16-45, in good physical and mental health and with no criminal record. Required materials include a valid passport, residence permit when already in China, a physical-examination form and a recent non-criminal-record certificate or eligible current-school conduct certificate. Housing is first-come, first-served.",
  hasScholarship: false,
  badgeText: "March 2027",
  displayTuition: "CNY 8,000/semester",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  ...verified("changan-spring-intake-programs-2027"),
  sourceFieldLineage: { nameEn: "official self-funded program heading", hskRequirement: "published eligibility and materials sections contain no fixed HSK threshold", tuitionAmount: "official fee table", tuitionText: "official fee table", applicationNote: "official eligibility, procedure and materials sections" },
};

const zjgsuProgram: CatalogSeedProgram = {
  slug: "zhejiang-gongshang-university-chinese-language-culture-spring-2027",
  schoolSlug: "zhejiang-gongshang-university",
  citySlug: "hangzhou",
  nameEn: "Chinese Language and Culture Program - Spring 2027",
  nameZh: "浙江工商大学2027年春季汉语言文化项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: "Chinese language and culture",
  teachingLanguage: "Chinese",
  hskRequirement: "No fixed HSK score is published for the Spring 2027 Chinese Language and Culture Program.",
  tuitionAmount: 7000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "one semester",
  tuitionText: "CNY 7,000 for the one-semester Spring 2027 Chinese Language and Culture Program; the current official fee table also lists CNY 14,000 for a full academic year. The application fee is CNY 400.",
  applicationUrl: "https://hzic.at0086.cn/StuApplication/Login.aspx",
  applicationNote: "Applicants must be non-Chinese citizens aged 18-60 with high-school-equivalent education, good health and good conduct. Prior Chinese-language students in China need an original completion certificate and at least 90% attendance. Applicants who already earned a degree in China or studied Chinese-language programs in China for more than two years are ineligible. Required materials include academic certificate and transcript, passport, photo, physical examination, non-criminal record, fee receipt and applicable prior-study evidence. Only a one-semester route is offered in Spring 2027.",
  hasScholarship: false,
  badgeText: "Spring 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  ...verified("zjgsu-chinese-language-culture-spring-2027"),
  sourceFieldLineage: { nameEn: "official program heading", subjectArea: "official project introduction", hskRequirement: "Spring 2027 eligibility and materials sections publish no fixed HSK threshold", tuitionAmount: "current official fee table, Chinese Language and Culture Program semester row", tuitionCurrency: "current official fee table", tuitionPeriod: "Spring 2027 page states only one-semester programs are offered; current fee table publishes the semester amount", tuitionText: "current official fee table and Spring 2027 duration notice", applicationNote: "official eligibility, process, materials and one-semester notice; bank details excluded", badgeText: "official Spring 2027 application duration" },
};

const existingZjgsuIclts = findDependency("zhejiang-gongshang-university-iclts-chinese-language-study-spring-2027", prior.programs, baseline.programs, "ZJGSU Spring 2027 ICLTS program");
const zjgsuIcltsProgram: CatalogSeedProgram = {
  ...existingZjgsuIclts,
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  sourceFieldLineage: {
    ...(existingZjgsuIclts.sourceFieldLineage ?? {}),
    tuitionText: "official scholarship Funding Content and Standards section",
  },
};
const zjgsuSchoolIndex = schools.findIndex((row) => row.slug === "zhejiang-gongshang-university");
schools[zjgsuSchoolIndex] = {
  ...schools[zjgsuSchoolIndex],
  applicationFee: "CNY 400 for all programs.",
  sourceFieldLineage: {
    ...(schools[zjgsuSchoolIndex].sourceFieldLineage ?? {}),
    applicationFee: "current official international-student fee table",
  },
};

const existingChanganIclts = prior.programs?.find((row) => row.slug === "chang-an-university-iclts-one-semester-study-spring-2027");
if (!existingChanganIclts) throw new Error("Missing existing Chang'an Spring 2027 ICLTS program dependency.");
const changanIcltsProgram: CatalogSeedProgram = {
  ...existingChanganIclts,
  tuitionText: "Tuition is fully covered by the linked International Chinese Language Teachers Scholarship; no self-funded amount is published for this route.",
  sourceFieldLineage: {
    ...(existingChanganIclts.sourceFieldLineage ?? {}),
    tuitionText: "official scholarship coverage section",
  },
};
const changanSchoolIndex = schools.findIndex((row) => row.slug === "chang-an-university");
schools[changanSchoolIndex] = {
  ...schools[changanSchoolIndex],
  applicationFee: "CNY 400 for the self-funded Chinese-language route; CNY 600 for the China Link route after material review. Scholarship-route fees may differ.",
  sourceFieldLineage: {
    ...(schools[changanSchoolIndex].sourceFieldLineage ?? {}),
    applicationFee: "official 2027 self-funded Chinese-language fee table and China Link application procedure",
  },
};
const programs: CatalogSeedProgram[] = [tjutProgram, chinaLinkProgram, changanSelfFundedProgram, zjgsuProgram, changanIcltsProgram, zjgsuIcltsProgram];
const intake = (program: CatalogSeedProgram, intakeTerm: string, deadlineDate: string | undefined, deadlineLabel: string, applicationRound: string, sourceId: string): CatalogSeedProgramIntake => ({
  programSlug: program.slug,
  intakeTerm,
  intakeYear: 2027,
  ...(deadlineDate ? { deadlineDate } : {}),
  deadlineLabel,
  applicationRound,
  status: "open",
  ...fields(sourceId),
  sourceFieldLineage: { intakeTerm: "official 2027 route heading or commencement", intakeYear: "official 2027 route heading or commencement", ...(deadlineDate ? { deadlineDate: "official deadline section" } : {}), deadlineLabel: "official deadline section", status: "deadline compared with capturedAt" },
});
const programIntakes: CatalogSeedProgramIntake[] = [
  intake(tjutProgram, "Spring", "2026-12-15T00:00:00Z", "Application deadline: December 15, 2026. The printed October 8, 2025 opening year appears inconsistent with the 2027 route and is not normalized.", "March 2027 entry", "tjutech-chinese-language-spring-2027"),
  intake(chinaLinkProgram, "Rolling", undefined, "No fixed date is published; contact apply@chd.edu.cn for the specific class start and application deadline.", "1-12 month stay in 2027", "changan-spring-intake-programs-2027"),
  intake(changanSelfFundedProgram, "Spring", "2026-12-25T00:00:00Z", "Application deadline: December 25, 2026.", "March 2027 entry", "changan-spring-intake-programs-2027"),
  intake(zjgsuProgram, "Spring", "2026-12-31T00:00:00Z", "Applications run from October through December 31 for Spring 2027 and may close early when places are filled.", "Spring 2027 entry", "zjgsu-chinese-language-culture-spring-2027"),
];

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "chang-an-university-china-link-scholarship-2027",
    title: "Chang'an University China Link Short-term Scientific Exchange Scholarship",
    nameZh: "长安大学中国政府奖学金“青年使者交流学习计划”",
    schoolSlug: "chang-an-university",
    programSlug: chinaLinkProgram.slug,
    type: "government",
    typeLabel: "Chinese Government Scholarship - China Link",
    providerName: "China Scholarship Council / Chang'an University",
    fundingLevel: "Full",
    coverage: "Tuition, accommodation, monthly living allowance and comprehensive medical insurance.",
    applicableDegree: "General Scholar; Senior Scholar",
    applicableProgram: "A 1-12 month research or academic exchange in the university's published Chinese-taught or English-taught programs.",
    amountText: "General scholar: CNY 3,000/month; senior scholar: CNY 3,500/month.",
    deadlineLabel: "No fixed deadline is published; contact Chang'an University for the specific start date and deadline.",
    applicationRound: "2027 rolling short-term exchange",
    requirementText: "General scholars must be current undergraduate or master's students under 35; senior scholars must be current doctoral students or faculty under 40. Applicants must be full-time students or academic staff at a CSC foreign partner university throughout the stay.",
    applicationMaterials: [{ label: "CSC application form" }, { label: "Highest diploma, studentship certificate or employment certificate" }, { label: "Academic transcripts" }, { label: "Motivation letter or research proposal", value: "At least 500 words" }, { label: "Foreigner Physical Examination Form", value: "Valid for six months" }, { label: "Non-criminal-record certificate", value: "Valid for six months" }, { label: "Passport identity page" }, { label: "Language certificate", value: "If available" }],
    applicationSteps: [{ label: "Step 1", body: "Select a relevant Chang'an University program." }, { label: "Step 2", body: "Apply in the CSC system as Type B using agency number 10710." }, { label: "Step 3", body: "Apply in the Chang'an University system and pay the CNY 600 fee after material review." }, { label: "Step 4", body: "Chang'an University recommends eligible applicants; CSC makes the final decision." }],
    actionLinks: [{ label: "Official 2027 Chang'an University guide", url: source("changan-spring-intake-programs-2027").url, kind: "official-source" }, { label: "Chang'an University application system", url: "https://is.chd.edu.cn", kind: "official-application" }],
    ...verified("changan-spring-intake-programs-2027"),
    sourceFieldLineage: { title: "official China Link heading", fundingLevel: "official scholarship content and criteria", coverage: "official scholarship content and criteria", applicableDegree: "official eligibility section", applicableProgram: "official program links", amountText: "official scholarship content and criteria", requirementText: "official eligibility section", applicationMaterials: "official materials section", applicationSteps: "official application procedure", deadlineLabel: "official deadline section" },
  },
  {
    slug: "chang-an-university-international-chinese-language-teachers-scholarship-spring-2027",
    title: "Chang'an University International Chinese Language Teachers Scholarship - Spring 2027",
    nameZh: "长安大学国际中文教师奖学金（2027年春季）",
    schoolSlug: "chang-an-university",
    programSlug: changanIcltsProgram.slug,
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "Center for Language Education and Cooperation / Chang'an University",
    fundingLevel: "Full",
    coverage: "Tuition, on-campus accommodation or approved off-campus subsidy, monthly living allowance and comprehensive medical insurance.",
    applicableDegree: "Non-degree",
    applicableProgram: "March 2027 one-semester International Chinese Education or Chinese Language and Literature route.",
    amountText: "CNY 2,500/month living allowance; approved off-campus students receive CNY 700/month accommodation subsidy.",
    deadlineDate: "2026-10-31",
    deadlineLabel: "October 31, 2026",
    applicationRound: "March 2027 entry",
    requirementText: "Applicants need HSK Level 3 with at least 180 and an HSKK score, must be aged 16-35 (in-service Chinese teachers may be up to 45), and must not hold an X1 or X2 visa. Applicants who received the same scholarship type within the previous three years are ineligible.",
    applicationSteps: [{ label: "Step 1", body: "Apply online through the official scholarship system." }, { label: "Step 2", body: "Apply in the Chang'an University system and submit the requested materials." }, { label: "Step 3", body: "Track the scholarship and university review results." }],
    actionLinks: [{ label: "Official 2027 Chang'an University guide", url: source("changan-spring-intake-programs-2027").url, kind: "official-source" }, { label: "Scholarship application system", url: "https://www.chinese.cn/", kind: "official-application" }],
    ...verified("changan-spring-intake-programs-2027"),
    sourceFieldLineage: { title: "official scholarship heading and March 2027 route", coverage: "official coverage and standards", applicableDegree: "official one-semester category", applicableProgram: "official route qualifications", amountText: "official coverage and standards", deadlineDate: "official deadline section", requirementText: "official eligibility and route requirements", applicationSteps: "official application procedure" },
  },
  {
    slug: "beijing-language-and-culture-university-beijing-international-students-scholarship-spring-2027",
    title: "BLCU Beijing International Students Scholarship - Spring 2027",
    nameZh: "北京语言大学北京市外国留学生奖学金（2027年春季）",
    schoolSlug: "beijing-language-and-culture-university",
    type: "university",
    typeLabel: "Beijing International Students Scholarship",
    providerName: "Beijing Language and Culture University",
    fundingLevel: "First-year tuition",
    coverage: "First-year tuition only; all other fees are excluded.",
    applicableDegree: "Bachelor; Master; Doctoral",
    applicableProgram: "Eligible BLCU bachelor's, master's and doctoral programs for new students.",
    deadlineDate: "2027-01-12",
    deadlineLabel: "January 12, 2027 for March 2027 enrollment; results are scheduled for February 2027.",
    applicationRound: "March 2027 entry",
    requirementText: "Applicants must be non-Chinese citizens in good physical and mental health, with good academic and behavioral standing and no criminal record. The page states age limits of 30 for bachelor's, 35 for master's and 40 for doctoral applicants as of September 1, 2026; that printed reference year is preserved.",
    applicationMaterials: [{ label: "Beijing International Students Scholarship Form", value: "For freshmen" }, { label: "Degree-program admission materials", value: "According to the selected BLCU bachelor's or graduate route" }],
    applicationSteps: [{ label: "Step 1", body: "Download and complete the scholarship form." }, { label: "Step 2", body: "Apply in the BLCU system and upload the program and scholarship materials." }, { label: "Step 3", body: "The International Student Scholarship Committee reviews the application and issues the result." }],
    actionLinks: [{ label: "Official BLCU scholarship page", url: source("blcu-beijing-international-students-scholarship-spring-2027").url, kind: "official-source" }, { label: "BLCU application system", url: "https://apply.blcu.edu.cn/", kind: "official-application" }],
    ...verified("blcu-beijing-international-students-scholarship-spring-2027"),
    sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official coverage section", coverage: "official coverage section", applicableDegree: "official supporting categories", deadlineDate: "official March 2027 deadline", requirementText: "official eligibility section, preserving the printed age-reference year", applicationMaterials: "official materials section", applicationSteps: "official process section" },
  },
];

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 23 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs, refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "Tianjin University of Technology's page prints an October 8, 2025 application opening date for a March 2027 route published in October 2026; the conflicting opening year is preserved in notes and no openDate is emitted.",
    "Chang'an University's China Link route publishes no fixed start or deadline; both must be confirmed by email, so no deadlineDate is emitted.",
    "Zhejiang Gongshang University publishes no numeric tuition, accommodation or application-fee amounts on the captured page; those fields remain absent.",
    "BLCU's scholarship page states its age limits as of September 1, 2026 for the March 2027 round; the printed reference year is preserved rather than silently changed.",
    "These sources establish Spring or rolling 2027 routes only and do not establish general Fall 2027 degree admissions for the four schools.",
  ],
  notes: [
    "The existing Chang'an University Spring 2027 ICLTS program is included unchanged only as a dependency for the newly structured scholarship row; the unified release builder deduplicates the identical program record.",
    "Bank-account details published on the Zhejiang Gongshang University page are deliberately excluded.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-23.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-23.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-23.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
