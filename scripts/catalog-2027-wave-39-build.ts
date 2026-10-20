import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/nankai-graduate-2027-2026-10-20");
const expected: Record<string, string> = {
  "nankai-master-admissions-2027": "c0917ed96919934ed82c1b4cb084f1fd19b2f7d772a52e9c645625b211b5406b",
  "nankai-doctoral-admissions-2027": "5d0b3acc7ff9e673078790fcfe4036c7d3c4ce6155eb5d0e6af3f8eeb83ecff1",
};
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = new Map<string, ManifestSource>();
for (const source of manifest.sources ?? []) {
  if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Nankai Wave 39 evidence hash mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked Nankai 2027 graduate evidence: ${missing.join(", ")}`);

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-13.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "nankai-university");
const city = dependency.cities?.find((row) => row.slug === "tianjin");
if (!school || !city) throw new Error("Wave 39 Nankai dependencies are missing from Wave 13.");
const masterSource = evidence.get("nankai-master-admissions-2027")!;
const doctoralSource = evidence.get("nankai-doctoral-admissions-2027")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

type ProgramSpec = { slug: string; nameEn: string; nameZh: string; degreeLevel: "Master" | "Doctorate"; count: number; teachingLanguage: "Chinese" | "English"; durationText: string; source: ManifestSource };
const programSpecs: ProgramSpec[] = [
  { slug: "nankai-university-2027-chinese-taught-master-programs", nameEn: "2027 Chinese-taught Master's Programs (155-program group)", nameZh: "2027年中文授课硕士项目（155个专业组）", degreeLevel: "Master", count: 155, teachingLanguage: "Chinese", durationText: "2-3 years depending on the exact program", source: masterSource },
  { slug: "nankai-university-2027-english-taught-master-programs", nameEn: "2027 English-taught Master's Programs (8-program group)", nameZh: "2027年英文授课硕士项目（8个专业组）", degreeLevel: "Master", count: 8, teachingLanguage: "English", durationText: "2-3 years depending on the exact program", source: masterSource },
  { slug: "nankai-university-2027-chinese-taught-doctoral-programs", nameEn: "2027 Chinese-taught Doctoral Programs (127-program group)", nameZh: "2027年中文授课博士项目（127个专业组）", degreeLevel: "Doctorate", count: 127, teachingLanguage: "Chinese", durationText: "4 years", source: doctoralSource },
  { slug: "nankai-university-2027-english-taught-doctoral-programs", nameEn: "2027 English-taught Doctoral Programs (2-program group)", nameZh: "2027年英文授课博士项目（2个专业组）", degreeLevel: "Doctorate", count: 2, teachingLanguage: "English", durationText: "4 years", source: doctoralSource },
];
const programs: CatalogSeedProgram[] = programSpecs.map((spec) => ({
  slug: spec.slug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: spec.degreeLevel,
  ...(spec.degreeLevel === "Doctorate" ? { durationYears: 4 } : {}),
  fieldCategory: `${spec.teachingLanguage}-taught ${spec.degreeLevel.toLowerCase()} programs`,
  subjectArea: `${spec.count} programs are published in the official 2027 catalog attachment; exact program rows and program-specific tuition remain CAPTCHA-protected and are not inferred.`,
  teachingLanguage: spec.teachingLanguage,
  ...(spec.teachingLanguage === "Chinese"
    ? { hskRequirement: "HSK 5 with a score of 210 or above. Native Chinese speakers and applicants whose prior degree was taught in Chinese may provide the published exemption evidence; some Foreign Languages/Economics routes impose additional catalog-specific requirements." }
    : { englishRequirement: "IELTS 6.0, TOEFL 80 or Duolingo 105. Native English speakers are exempt; applicants whose prior degree was taught in English may submit an official medium-of-instruction certificate." }),
  tuitionText: `Exact tuition is published only in the CAPTCHA-protected 2027 program catalog. The accessible guide publishes a CNY 600 application fee, CNY 23-60/person/day accommodation and CNY 800/year medical insurance. Duration is ${spec.durationText}.`,
  applicationUrl: "https://nankai.at0086.cn/StuApplication/Login.aspx",
  applicationNote: `${spec.degreeLevel} applicants must be non-Chinese citizens with a valid passport, have no criminal record and hold the preceding degree; the age limit is under ${spec.degreeLevel === "Master" ? 35 : 40}. Required materials include the diploma or pre-graduation certificate, notarized transcripts, an 800-word personal statement, two professor/associate-professor recommendations, language evidence, passport, physical examination completed after October 2026, financial support and non-criminal record. ${spec.degreeLevel === "Doctorate" ? "A Nankai supervisor acceptance letter is required." : "The guide labels a supervisor acceptance letter as required for PhD applicants, not as a universal master's requirement."}`,
  hasScholarship: true,
  badgeText: "Fall 2027",
  displayGroup: spec.degreeLevel,
  displayGroupLabel: `${spec.teachingLanguage}-taught 2027 programs`,
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: spec.source.fetchedAt,
  ...sourceFields(spec.source),
  sourceFieldLineage: {
    nameEn: "official 2027 guide introduction and program-count statement",
    nameZh: "official institution, degree level and program-count statement",
    degreeLevel: "official guide title",
    ...(spec.degreeLevel === "Doctorate" ? { durationYears: "official guide introduction" } : {}),
    fieldCategory: "official degree level and teaching-language split",
    subjectArea: "official program-count statement and protected attachment state",
    teachingLanguage: "official program-count and language-requirement sections",
    ...(spec.teachingLanguage === "Chinese" ? { hskRequirement: "Qualifications, language proficiency" } : { englishRequirement: "Qualifications, language proficiency" }),
    tuitionText: "Fees section and protected 2027 catalog state",
    applicationUrl: "How to Apply",
    applicationNote: "Qualifications and Application Documents Checklist",
    hasScholarship: "Scholarship Programs section",
    badgeText: "official 2027 guide and registration calendar",
    displayGroup: "official degree level",
    displayGroupLabel: "official teaching-language split",
  },
}));

const programIntakes: CatalogSeedProgramIntake[] = programSpecs.map((spec) => ({
  programSlug: spec.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-10-19T16:00:00.000Z",
  deadlineDate: "2027-05-31T15:59:59.000Z",
  deadlineLabel: "Apply October 20, 2026-May 31, 2027; admission results are announced in July and registration is in late August or early September.",
  applicationRound: `Nankai Fall 2027 international ${spec.degreeLevel.toLowerCase()} admission`,
  status: "open",
  ...sourceFields(spec.source),
  sourceFieldLineage: { intakeTerm: "Registration section", intakeYear: "official 2027 guide title", openDate: "Application Date; Beijing start-of-day normalized to UTC", deadlineDate: "Application Date; Beijing end-of-day normalized to UTC", deadlineLabel: "Application Date, Admission Results and Registration", applicationRound: "official guide title", status: "application period compared with capturedAt" },
}));

const scholarshipBase = (source: ManifestSource, applicableDegree: "Master" | "Doctorate") => ({
  schoolSlug: school.slug,
  applicableDegree,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields(source),
});
const scholarship = (source: ManifestSource, applicableDegree: "Master" | "Doctorate", row: Omit<CatalogSeedScholarship, "schoolSlug" | "applicableDegree" | "status" | "verificationStatus" | "lastVerifiedAt" | "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt">): CatalogSeedScholarship => ({
  ...row,
  ...scholarshipBase(source, applicableDegree),
  sourceFieldLineage: {
    title: "Scholarship Programs section",
    type: "Scholarship Programs section",
    providerName: "Scholarship Programs section",
    applicableDegree: "degree-specific 2027 guide context",
    applicableProgram: "Scholarship Programs section",
    ...(row.coverage ? { coverage: "Scholarship Programs section where explicitly published" } : {}),
    ...(row.deadlineDate ? { deadlineDate: "Scholarship Programs section where unambiguous" } : {}),
    deadlineLabel: "Scholarship Programs section and preserved conflict where present",
    requirementText: "Scholarship Programs section",
    applicationRound: "Scholarship Programs section",
    status: "published 2027 scholarship route",
  },
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship(masterSource, "Master", { slug: "nankai-2027-cgs-type-a-master", title: "Nankai 2027 Chinese Government Scholarship Type A - Master's", type: "Government", providerName: "China Scholarship Council / dispatching authority", applicableProgram: "Eligible Nankai master's programs", deadlineLabel: "Usually November 2026-February 2027; the exact deadline follows the responsible dispatching authority.", requirementText: "Apply through the dispatching authority or Chinese embassy/consulate and list Nankai University as the first choice; obtaining Nankai pre-admission is recommended.", applicationRound: "Nankai 2027 CSC Type A" }),
  scholarship(masterSource, "Master", { slug: "nankai-2027-cgs-type-b-master", title: "Nankai 2027 Chinese Government Scholarship Type B - Master's", type: "Government", providerName: "China Scholarship Council / Nankai University", applicableProgram: "Eligible Nankai master's programs", deadlineLabel: "The guide states November 2026-March 2027 and defers the exact dates to the annual scholarship measure; no fixed deadlineDate is emitted.", requirementText: "Apply in the CSC system using Nankai agency number 10055 and Type B, then submit the downloaded CSC form in Nankai's application system.", applicationRound: "Nankai 2027 CSC Type B" }),
  scholarship(masterSource, "Master", { slug: "nankai-2027-international-chinese-language-teachers-scholarship-master", title: "Nankai 2027 International Chinese Language Teachers Scholarship - Master's", type: "Language education", providerName: "Center for Language Education and Cooperation", applicableProgram: "Master of International Chinese Language Education", deadlineLabel: "No fixed university deadline is published; check the official scholarship system.", requirementText: "Complete both the Nankai and scholarship-system applications, obtain Nankai pre-admission and follow the scholarship-system deadline.", applicationRound: "Nankai 2027 International Chinese Language Teachers Scholarship" }),
  scholarship(masterSource, "Master", { slug: "nankai-2027-international-confucian-association-scholarship-master", title: "Nankai 2027 International Confucian Association Scholarship - Master's", type: "Association", providerName: "International Confucian Association / Nankai University", applicableProgram: "Chinese History and Chinese Language and Literature master's programs", deadlineLabel: "No fixed deadline is published on the guide.", requirementText: "Only applicants who pass Nankai review and receive pre-admission are eligible.", applicationRound: "Nankai 2027 International Confucian Association Scholarship" }),
  scholarship(masterSource, "Master", { slug: "nankai-2027-tianjin-government-scholarship-master", title: "Nankai 2027 Tianjin Government Scholarship - Master's", type: "Government", providerName: "Tianjin Municipal Government / Nankai University", applicableProgram: "Eligible Nankai master's programs", coverage: "First Prize: tuition subsidy, stipend and medical insurance; Second Prize: tuition subsidy only. Award duration is one academic year and may be renewed by annual application.", deadlineDate: "2027-05-31", deadlineLabel: "Application deadline: May 31, 2027; the guide does not publish a deadline time.", requirementText: "Select the scholarship option in the Nankai application and submit the required scholarship form; deadlines remain subject to the official announcement.", applicationRound: "Nankai 2027 Tianjin Government Scholarship" }),
  scholarship(masterSource, "Master", { slug: "nankai-2027-study-at-nku-scholarship-master", title: "Nankai 2027 Study-at-NKU Scholarship - Master's", type: "University", providerName: "Nankai University", applicableProgram: "Eligible Nankai master's programs", coverage: "Funding is equivalent to the First and Second Prize levels of the Tianjin Government Scholarship.", deadlineLabel: "No separate fixed deadline is published; select the scholarship option in the Nankai application and follow the official announcement.", requirementText: "No separate application is required beyond selecting Apply for Scholarship in the Nankai application form.", applicationRound: "Nankai 2027 Study-at-NKU Scholarship" }),
  scholarship(doctoralSource, "Doctorate", { slug: "nankai-2027-cgs-type-a-doctoral", title: "Nankai 2027 Chinese Government Scholarship Type A - Doctoral", type: "Government", providerName: "China Scholarship Council / dispatching authority", applicableProgram: "Eligible Nankai doctoral programs", deadlineLabel: "Usually November 2026-February 2027; the exact deadline follows the responsible dispatching authority.", requirementText: "Apply through the dispatching authority or Chinese embassy/consulate and list Nankai University as the first choice; obtaining Nankai pre-admission or a supervisor acceptance letter is recommended.", applicationRound: "Nankai 2027 CSC Type A" }),
  scholarship(doctoralSource, "Doctorate", { slug: "nankai-2027-cgs-type-b-doctoral", title: "Nankai 2027 Chinese Government Scholarship Type B - Doctoral", type: "Government", providerName: "China Scholarship Council / Nankai University", applicableProgram: "Eligible Nankai doctoral programs", deadlineLabel: "The same guide states both a November 2026-March 10, 2027 application period and a March 20, 2027 deadline. The conflict is preserved and no deadlineDate is emitted.", requirementText: "Apply in the CSC system using Nankai agency number 10055 and Type B, then submit the downloaded CSC form in Nankai's application system.", applicationRound: "Nankai 2027 CSC Type B" }),
  scholarship(doctoralSource, "Doctorate", { slug: "nankai-2027-china-studies-program-scholarship-doctoral", title: "Nankai 2027 China Studies Program Scholarship - Doctoral", type: "Research", providerName: "Center for Language Education and Cooperation / Nankai University", applicableProgram: "Law, Economics, History, Literature, Philosophy, Finance and related Management doctoral programs", deadlineDate: "2027-02-28", deadlineLabel: "Application deadline: February 28, 2027.", requirementText: "Young overseas Sinology and Chinese Studies scholars must first receive Nankai pre-admission, then complete the scholarship-system application.", applicationRound: "Nankai 2027 China Studies Program Scholarship" }),
  scholarship(doctoralSource, "Doctorate", { slug: "nankai-2027-tianjin-government-scholarship-doctoral", title: "Nankai 2027 Tianjin Government Scholarship - Doctoral", type: "Government", providerName: "Tianjin Municipal Government / Nankai University", applicableProgram: "Eligible Nankai doctoral programs", coverage: "First Prize: tuition subsidy, stipend and medical insurance; Second Prize: tuition subsidy only. Award duration is one academic year and may be renewed by annual application.", deadlineDate: "2027-05-31", deadlineLabel: "Application deadline: May 31, 2027; the guide does not publish a deadline time.", requirementText: "Select the scholarship option in the Nankai application and submit the required scholarship form; deadlines remain subject to the official announcement.", applicationRound: "Nankai 2027 Tianjin Government Scholarship" }),
  scholarship(doctoralSource, "Doctorate", { slug: "nankai-2027-study-at-nku-scholarship-doctoral", title: "Nankai 2027 Study-at-NKU Scholarship - Doctoral", type: "University", providerName: "Nankai University", applicableProgram: "Eligible Nankai doctoral programs", coverage: "Funding is equivalent to the First and Second Prize levels of the Tianjin Government Scholarship.", deadlineLabel: "No separate fixed deadline is published; select the scholarship option in the Nankai application and follow the official announcement.", requirementText: "No separate application is required beyond selecting Apply for Scholarship in the Nankai application form.", applicationRound: "Nankai 2027 Study-at-NKU Scholarship" }),
];

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 39 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The official 2027 master and doctoral XLSX catalogs require a university CAPTCHA. This workflow does not bypass it, so exact program rows, program-specific tuition and catalog-specific language exceptions remain unresolved.",
    "The master's duration is published only as a 2-3 year range; the catalog contract cannot represent a range, so durationYears remains absent on the two grouped master's routes.",
    "The doctoral Type B section publishes conflicting March 10 and March 20 dates; the conflict is retained in deadlineLabel and no deadlineDate is emitted.",
    "The grouped routes preserve official counts and teaching-language splits without substituting the 2026 program catalogs.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-39");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 39, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
