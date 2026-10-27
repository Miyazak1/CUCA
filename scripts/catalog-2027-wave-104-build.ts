import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

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
const runRoot = resolve(root, "work/catalog-official/2026-10-26T03-55-23-479Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { generatedAt: string; sources: ManifestSource[] };
const expected = new Map([
  ["swufe-international-chinese-language-teachers-scholarship-spring-2027", "27f9f72a5dc39dcb133b435a487cac1d5d739d6a77cd1fac522274b1859bee95"],
  ["swufe-international-chinese-language-teachers-scholarship-coverage-spring-2027", "a8addc092cd526e4e91fc6e18df2cdf59ba0c1cba848d17392373f7e534b00c5"],
  ["swufe-international-chinese-language-teachers-scholarship-materials-spring-2027", "11c1825faae9f8876a65da1e30474893b7b7e31d14f06ba74b9b83bf06d98ae3"],
  ["swufe-chinese-language-training-program-2027", "eb8efdc04debb34297e1018990a0710ce1b5814bd43d6054dd8a5ea05396dbda"],
]);
const evidence = new Map<string, ManifestSource>();
for (const [id, sha256] of expected) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked official evidence ${id} at ${sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  evidence.set(id, source);
}
const sourceFields = (id: string) => {
  const source = evidence.get(id);
  if (!source) throw new Error(`Missing source ${id}.`);
  return { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const scholarshipId = "swufe-international-chinese-language-teachers-scholarship-spring-2027";
const coverageId = "swufe-international-chinese-language-teachers-scholarship-coverage-spring-2027";
const materialsId = "swufe-international-chinese-language-teachers-scholarship-materials-spring-2027";
const programId = "swufe-chinese-language-training-program-2027";
const scholarshipSource = evidence.get(scholarshipId)!;
const programSource = evidence.get(programId)!;

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "southwestern-university-of-finance-and-economics";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("SWUFE is already present in the 100-school base.");
const city = dependency.cities?.find((row) => row.slug === "chengdu");
if (!city) throw new Error("Chengdu city dependency is missing.");

const school = {
  slug: schoolSlug,
  nameEn: "Southwestern University of Finance and Economics",
  nameZh: "西南财经大学",
  citySlug: "chengdu",
  schoolType: "Public",
  region: "Chengdu, Sichuan, Southwest China",
  applicationLevel: "Non-degree Chinese Language; undergraduate and graduate routes are also published on the official admissions site",
  languageOfInstruction: "Chinese and English, by program",
  languageRequirement: "The 2027 self-funded Chinese Language Training Program accepts elementary through advanced learners without publishing a minimum entry HSK score. The Spring 2027 scholarship route requires HSK Level 3 score 180 and an HSKK score.",
  hskRequirement: "No minimum HSK is published for the self-funded 2027 Chinese Language Training Program. The Spring 2027 International Chinese Language Teachers Scholarship requires HSK Level 3 score 180 plus an HSKK score.",
  deadlineSummary: "Self-funded Chinese training: January 17, 2027 for Spring and July 20, 2027 for Fall. The Spring 2027 International Chinese Language Teachers Scholarship deadline is October 26, 2026.",
  tuitionSummary: "Self-funded Chinese Language Training tuition is CNY 8,000 per semester, plus CNY 600 application fee, CNY 200-500 textbooks and CNY 500 semester insurance. The Spring 2027 scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance.",
  applicationFee: "CNY 600 for the self-funded Chinese Language Training Program; the scholarship guide also publishes CNY 600 when SWUFE is requested as the recommending institution.",
  websiteUrl: "https://international.swufe.edu.cn/EN/Home.htm",
  admissionsUrl: sourceFields(programId).sourceUrl,
  subjectTags: ["Chinese Language", "Chinese Culture", "Economics", "Finance", "Management"],
  languageTags: ["Chinese", "English"],
  campusHighlights: ["2027 Spring and Fall self-funded Chinese Language Training intakes", "Spring 2027 International Chinese Language Teachers Scholarship route"],
  contactNotes: "College of International Education, No. 55 Guanghuacun Street, Chengdu, Sichuan; +86-28-87355437; international@swufe.edu.cn.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: [scholarshipSource.fetchedAt, programSource.fetchedAt].sort().at(-1),
  ...sourceFields(programId),
  sourceFieldLineage: {
    nameEn: "official 2027 Chinese Language Training guide identity",
    nameZh: "official university identity",
    citySlug: "official program and scholarship contact address",
    schoolType: "official institutional identity",
    region: "official contact address plus CUAC geographic taxonomy",
    applicationLevel: "official current admissions navigation; only the explicit 2027 non-degree route is structured in this wave",
    languageOfInstruction: "official current admissions navigation and 2027 Chinese-language route",
    languageRequirement: "official 2027 Chinese Language Training guide and Spring 2027 scholarship guide",
    hskRequirement: "official 2027 Chinese Language Training guide and Spring 2027 scholarship guide",
    deadlineSummary: "official 2027 program periods and official scholarship deadline",
    tuitionSummary: "official 2027 Chinese Language Training fee table and official scholarship coverage",
    applicationFee: "official 2027 program fee table and scholarship application procedure",
    websiteUrl: "official College of International Education domain",
    admissionsUrl: "official 2027 Chinese Language Training guide",
    campusHighlights: "captured official 2027 program and scholarship guides",
    contactNotes: "official 2027 program and scholarship contact sections",
  },
};

const programSlug = `${schoolSlug}-chinese-language-training`;
const program = {
  slug: programSlug,
  schoolSlug,
  citySlug: "chengdu",
  nameEn: "Chinese Language Training Program",
  nameZh: "汉语进修生项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Language",
  subjectArea: "Chinese Language and Culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 8000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 8,000 per semester; textbooks CNY 200-500 per semester; compulsory insurance CNY 500 per semester; on-campus dormitory CNY 860-1,300 per month; CNY 1,000 dormitory deposit.",
  scholarshipText: "A separate Spring 2027 International Chinese Language Teachers Scholarship route provides full tuition, accommodation, living allowance and medical insurance for eligible one-semester students.",
  applicationUrl: "https://swufe.17gz.org",
  applicationNote: "Submit the SWUFE online application and pay the non-refundable CNY 600 application fee. Each semester has 17 teaching weeks and offers elementary through advanced placement levels.",
  hasScholarship: true,
  badgeText: "2027 Spring + Fall",
  displayTuition: "CNY 8,000/semester",
  displaySubjects: ["Chinese Listening", "Chinese Speaking", "Chinese Reading", "Chinese Writing", "Chinese Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: programSource.fetchedAt,
  ...sourceFields(programId),
  sourceFieldLineage: {
    nameEn: "official 2027 program title",
    nameZh: "official Chinese-language program identity",
    degreeLevel: "official Chinese Language Training classification",
    fieldCategory: "official program introduction",
    subjectArea: "official program introduction",
    teachingLanguage: "official language-training scope",
    tuitionAmount: "official 2027 guide, Fees table",
    tuitionCurrency: "official 2027 guide, Fees table",
    tuitionPeriod: "official 2027 guide, Fees table",
    tuitionText: "official 2027 guide, Fees table",
    scholarshipText: "official Spring 2027 scholarship guide and coverage attachment",
    applicationUrl: "official 2027 guide, Application Procedures",
    applicationNote: "official 2027 guide, Program Introduction and Application Procedures",
  },
};

const programIntakes = [
  {
    programSlug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    openDate: "2026-10-14T16:00:00.000Z",
    deadlineDate: "2027-01-17T15:59:59.000Z",
    deadlineLabel: "Apply October 15, 2026 through January 17, 2027; classes run March-July 2027.",
    applicationRound: "SWUFE 2027 Spring Chinese Language Training Program",
    status: "open" as const,
    ...sourceFields(programId),
    sourceFieldLineage: {
      intakeTerm: "official 2027 guide, Period: Spring Semester",
      intakeYear: "official 2027 guide title and class period",
      openDate: "official 2027 guide, Spring application period; converted from Beijing date boundary",
      deadlineDate: "official 2027 guide, Spring application period; converted from Beijing end-of-day",
      deadlineLabel: "official 2027 guide, Period",
      applicationRound: "official 2027 guide title",
    },
  },
  {
    programSlug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2027-03-31T16:00:00.000Z",
    deadlineDate: "2027-07-20T15:59:59.000Z",
    deadlineLabel: "Apply April 1 through July 20, 2027; classes run September 2027-January 2028.",
    applicationRound: "SWUFE 2027 Fall Chinese Language Training Program",
    status: "open" as const,
    ...sourceFields(programId),
    sourceFieldLineage: {
      intakeTerm: "official 2027 guide, Period: Fall Semester",
      intakeYear: "official 2027 guide title and class period",
      openDate: "official 2027 guide, Fall application period; converted from Beijing date boundary",
      deadlineDate: "official 2027 guide, Fall application period; converted from Beijing end-of-day",
      deadlineLabel: "official 2027 guide, Period",
      applicationRound: "official 2027 guide title",
    },
  },
];

const scholarship = {
  slug: `${schoolSlug}-international-chinese-language-teachers-spring-2027`,
  schoolSlug,
  programSlug,
  title: "SWUFE International Chinese Language Teachers Scholarship — Spring 2027",
  nameZh: "西南财经大学国际中文教师奖学金（2027年春季学期）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心 / 西南财经大学",
  providerNameEn: "Center for Language Education and Cooperation / Southwestern University of Finance and Economics",
  providerLocation: "Chengdu, Sichuan, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, on-campus accommodation, CNY 2,500 monthly living allowance and CNY 400 comprehensive medical insurance for the one-semester route.",
  applicableDegree: "One-semester non-degree study",
  applicableProgram: "TCSOL, Chinese Language and Literature, Chinese History and Chinese Philosophy directions published for Spring 2027.",
  amountText: "CNY 2,500 monthly living allowance; CNY 400 one-semester medical insurance. Approved off-campus students receive CNY 700 per month accommodation allowance instead of on-campus accommodation.",
  requirementText: "Applicants must be non-Chinese citizens, normally age 16-35 on March 1, 2027 (up to 45 for in-service Chinese teachers), interested in Chinese-language education, and hold HSK Level 3 score 180 plus an HSKK score. Applicants who received a similar scholarship within three years are ineligible for this one-semester route.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "Usually an on-campus double room; approved off-campus allowance CNY 700/month" },
    { label: "Living allowance", included: true, note: "CNY 2,500/month" },
    { label: "Medical insurance", included: true, note: "CNY 400 for one semester" },
  ],
  eligibilityItems: [
    { label: "Nationality", value: "Non-Chinese citizen" },
    { label: "Age", value: "16-35 on March 1, 2027; up to 45 for in-service Chinese teachers" },
    { label: "Language", value: "HSK Level 3 score 180 plus an HSKK score" },
    { label: "Prior award", value: "No similar scholarship within the preceding three years" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Recent ID photo and passport photo page valid for more than six months" },
    { label: "Language", value: "Valid HSK and HSKK score reports" },
    { label: "Recommendation", value: "Reference letter from the head of the recommending institution" },
    { label: "Health", value: "Foreigner Physical Examination Record with results valid for six months" },
    { label: "Additional", value: "Employment proof and employer recommendation for in-service teachers; guardian documents for applicants under 18" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Apply through the International Chinese Language Teachers Scholarship website and select SWUFE as host institution" },
    { label: "Step 2", value: "Also submit the SWUFE International Students Service System application" },
    { label: "Step 3", value: "If requesting SWUFE as recommending institution, send the application number to international@swufe.edu.cn; the guide publishes a CNY 600 application fee for this case" },
    { label: "Step 4", value: "Submit by October 26, 2026 and track the review result" },
  ],
  actionLinks: [
    { label: "Official Spring 2027 scholarship guide", url: sourceFields(scholarshipId).sourceUrl, kind: "official-source" },
    { label: "Official scholarship coverage", url: sourceFields(coverageId).sourceUrl, kind: "official-source" },
    { label: "Official application materials", url: sourceFields(materialsId).sourceUrl, kind: "official-source" },
  ],
  deadlineDate: "2026-10-26",
  deadlineLabel: "Spring 2027 scholarship applications close October 26, 2026 (Beijing Time).",
  applicationRound: "Spring 2027 one-semester study",
  summary: "Five-month Spring 2027 full scholarship at SWUFE for eligible Chinese-language education and related study directions.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipSource.fetchedAt,
  ...sourceFields(scholarshipId),
  sourceFieldLineage: {
    title: "official Spring 2027 scholarship guide title",
    coverage: "official current guide and linked coverage attachment",
    applicableDegree: "official guide, one-semester route",
    applicableProgram: "official guide, Scholarship Types and Qualifications",
    amountText: "official linked coverage attachment",
    requirementText: "official guide, Eligibility, Qualifications and Others",
    benefitItems: "official linked coverage attachment",
    eligibilityItems: "official guide, Eligibility and Qualifications",
    applicationMaterials: "official linked application-material attachment",
    applicationSteps: "official guide, Application Procedures and Deadline",
    actionLinks: "captured official guide and attachment URLs",
    deadlineDate: "official guide, Application Deadline",
    applicationRound: "official guide title and program commencement",
    summary: "official guide scope and coverage",
  },
};

const generatedAt = manifest.sources.map((row) => row.fetchedAt).sort().at(-1) ?? manifest.generatedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes,
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 104 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newSchools: 1, programs: 1, programIntakes: 2, scholarships: 1 },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "The captured official sources fully establish SWUFE's 2027 self-funded Chinese Language Training and Spring 2027 one-semester scholarship routes. General 2027 undergraduate, master's and doctoral admission cycles are not established in this wave and remain blank.",
    "The scholarship guide publishes a CNY 600 fee specifically when an applicant requests SWUFE as the recommending institution; it is retained as a conditional application step and is not generalized to every scholarship applicant.",
    "The program offers eight placement levels but does not publish separate program identities for each level; one program record is used with the official placement structure retained in the application note.",
    "The HUEB official host exposes an explicit March 2027 scholarship page in indexed search results, but deterministic fetches fail TLS verification with UNABLE_TO_VERIFY_LEAF_SIGNATURE. No certificate bypass is used and no HUEB candidate is built until a valid snapshot can be captured.",
    "Beijing Jiaotong University, Anqing Normal University and Changsha University were rechecked. Available 2027 results are domestic/outbound or absent, so their 2026 international data are not relabeled as 2027.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-104");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 104, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
