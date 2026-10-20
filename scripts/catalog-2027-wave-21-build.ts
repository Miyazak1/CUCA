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

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-21.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-21.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-21.review.json");
const expected: Record<string, string> = {
  "ustb-graduate-admissions-2027": "e3ff8efc72d247ddacb34be70695b6117f1de5eafff52e326494bc585f10ef31",
  "pkuhsc-undergraduate-admissions-page-2027": "c943082bc69d66a2aa8c6595e6a06a8ffafaf6ee26a990af5cbe78d1c7d685a0",
  "pkuhsc-undergraduate-admissions-pdf-2027": "b02abca9946d51104e73fdb07c2f3b1fcd1d4131dc681aa9aa345d21d7f68684",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 21 evidence: ${missing.join(", ")}`);
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const schoolSlugs = ["university-of-science-and-technology-beijing", "peking-university-health-science-center"];
const baseSchools = new Map((base.schools ?? []).filter((row) => schoolSlugs.includes(row.slug)).map((row) => [row.slug, row]));
const city = (base.cities ?? []).find((row) => row.slug === "beijing");
if (baseSchools.size !== 2 || !city) throw new Error("Wave 21 school or Beijing city dependencies are missing from the reviewed 100-school release.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;

const ustbSchool = {
  ...baseSchools.get("university-of-science-and-technology-beijing")!,
  applicationLevel: "Master; Doctoral",
  languageOfInstruction: "Chinese or English, depending on program",
  languageRequirement: "Chinese-taught master's programs require HSK Level 5; Chinese-taught doctoral programs require HSK Level 6. English-taught programs require IELTS 6.0, TOEFL 80 or another official English certificate when English is not the applicant's official language.",
  deadlineSummary: "2027 master's and doctoral applications are open November 1, 2026 through June 15, 2027. Scholarship periods follow the applicable scholarship notice.",
  tuitionSummary: "Master: CNY 31,600/year Chinese-taught or CNY 37,600/year English-taught. Doctoral: CNY 41,600/year Chinese-taught or CNY 47,600/year English-taught.",
  applicationFee: "CNY 600",
  verificationStatus: "verified" as const,
  lastVerifiedAt: verifiedAt,
  ...fields("ustb-graduate-admissions-2027"),
  sourceFieldLineage: { ...(baseSchools.get("university-of-science-and-technology-beijing")!.sourceFieldLineage ?? {}), applicationLevel: "official 2027 graduate guide", languageOfInstruction: "official 2027 fee and language tables", languageRequirement: "official eligibility and materials sections", deadlineSummary: "official application period", tuitionSummary: "official fee table", applicationFee: "official fee table" },
};
const pkuhscSchool = {
  ...baseSchools.get("peking-university-health-science-center")!,
  applicationLevel: "Undergraduate",
  languageOfInstruction: "Chinese",
  languageRequirement: "Clinical Medicine requires HSK Level 5. Stomatology requires HSK Level 6.",
  deadlineSummary: "Self-funded applications have two rounds: December 1, 2026 to February 26, 2027, and March 1 to March 31, 2027. Interviews are scheduled for March 13 and April 17, 2027 respectively.",
  tuitionSummary: "CNY 45,000 per person per year for Clinical Medicine and Stomatology.",
  applicationFee: "CNY 800 before interview",
  cscaRequired: true,
  cscaRequirement: "Self-funded applicants submit CSCA or a published SAT/ACT/IB/A-Level equivalent. Chinese Government Scholarship candidates must submit CSCA. Required CSCA subjects are Science Chinese, Mathematics in Chinese, Physics in Chinese and Chemistry in Chinese.",
  cscaSubjects: ["Science Chinese", "Mathematics", "Physics", "Chemistry"],
  verificationStatus: "verified" as const,
  lastVerifiedAt: verifiedAt,
  ...fields("pkuhsc-undergraduate-admissions-pdf-2027"),
  sourceFieldLineage: { ...(baseSchools.get("peking-university-health-science-center")!.sourceFieldLineage ?? {}), applicationLevel: "official 2027 brochure", languageOfInstruction: "official program section", languageRequirement: "official materials section", deadlineSummary: "official application and interview schedule", tuitionSummary: "official fee section", applicationFee: "official interview-fee section", cscaRequired: "official examination section", cscaRequirement: "official CSCA and equivalent-examination section", cscaSubjects: "official CSCA subject list" },
};

const ustbRoute = (level: "Master" | "Doctoral", language: "Chinese" | "English", tuitionAmount: number): CatalogSeedProgram => ({
  slug: `university-of-science-and-technology-beijing-${level.toLowerCase()}-${language.toLowerCase()}-2027`,
  schoolSlug: ustbSchool.slug,
  citySlug: city.slug,
  nameEn: `${language}-taught ${level}'s Programs (2027)`,
  nameZh: `北京科技大学2027年${language === "Chinese" ? "中文" : "英文"}授课${level === "Master" ? "硕士" : "博士"}项目`,
  degreeLevel: level,
  fieldCategory: "Graduate studies",
  teachingLanguage: language,
  ...(level === "Master" ? { durationYears: 3 } : { durationYears: 5 }),
  ...(language === "Chinese" ? { hskRequirement: level === "Master" ? "HSK Level 5." : "HSK Level 6." } : { englishRequirement: "IELTS 6.0, TOEFL 80 or another official English proficiency certificate when English is not the applicant's official language." }),
  tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")} per year`,
  scholarshipText: "The 2027 guide lists Chinese Government Scholarship Type A and Type B, the USTB Chancellor Scholarship, and Beijing Government Scholarship. Program and applicant eligibility follows each scholarship notice.",
  applicationUrl: "https://onlineapply.ustb.edu.cn/",
  applicationNote: `The official guide gives a standard duration range of ${level === "Master" ? "2-3" : "3-5"} years; the durationYears field stores the upper published bound, while the exact study period follows the admission notice. Required materials include notarized degree certificates and transcripts, a personal statement, two recommendation letters, language proof, passport, health certificate, financial guarantee and police-clearance certificate.`,
  hasScholarship: true,
  badgeText: "2027 graduate admissions",
  displayGroup: level,
  displayGroupLabel: `${level} programs`,
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("ustb-graduate-admissions-2027").fetchedAt,
  ...fields("ustb-graduate-admissions-2027"),
  sourceFieldLineage: { nameEn: "official degree level and teaching-medium fee rows", degreeLevel: "official 2027 guide", durationYears: "upper bound of the official standard-duration range", teachingLanguage: "official fee and language rows", tuitionAmount: "official fee table", scholarshipText: "official scholarship section", applicationNote: "official duration and materials sections" },
});
const ustbPrograms = [ustbRoute("Master", "Chinese", 31600), ustbRoute("Master", "English", 37600), ustbRoute("Doctoral", "Chinese", 41600), ustbRoute("Doctoral", "English", 47600)];

const pkuhscProgram = (kind: "clinical" | "stomatology"): CatalogSeedProgram => {
  const clinical = kind === "clinical";
  return {
    slug: `peking-university-health-science-center-${clinical ? "clinical-medicine" : "stomatology"}-undergraduate-2027`,
    schoolSlug: pkuhscSchool.slug,
    citySlug: city.slug,
    nameEn: clinical ? "Clinical Medicine" : "Stomatology",
    nameZh: clinical ? "临床医学" : "口腔医学",
    degreeLevel: "Bachelor",
    durationYears: clinical ? 6 : 5,
    fieldCategory: "Medicine",
    subjectArea: clinical ? "Clinical Medicine" : "Stomatology",
    teachingLanguage: "Chinese",
    cscaSubjects: ["Science Chinese", "Mathematics", "Physics", "Chemistry"],
    cscaRequirement: "CSCA subjects: Science Chinese, Mathematics in Chinese, Physics in Chinese and Chemistry in Chinese. Self-funded applicants may instead submit a qualifying SAT/ACT/IB/A-Level combination under the exact standards in the brochure; Chinese Government Scholarship candidates must submit CSCA.",
    hskRequirement: clinical ? "HSK Level 5." : "HSK Level 6.",
    tuitionAmount: 45000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 45,000 per year",
    scholarshipText: "Chinese Government Scholarship Type A applicants apply through the dispatching authority in their home country and remain subject to PKUHSC qualification review and interview.",
    applicationUrl: "https://bjmu.studyatpku.com/",
    applicationNote: "Self-funded applicants must be age 18-25 with a high-school qualification, submit the published academic, identity, health and financial documents, and complete the online Chinese-language interview. The brochure requires proof of funds of at least CNY 400,000.",
    hasScholarship: true,
    badgeText: "2027 undergraduate admissions",
    displayGroup: "Undergraduate",
    displayGroupLabel: "Medical programs",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source("pkuhsc-undergraduate-admissions-pdf-2027").fetchedAt,
    ...fields("pkuhsc-undergraduate-admissions-pdf-2027"),
    sourceFieldLineage: { nameEn: "official program section, translated for display", nameZh: "official program section", degreeLevel: "official undergraduate brochure", durationYears: "official program section", teachingLanguage: "official program section", cscaSubjects: "official examination section", cscaRequirement: "official CSCA and equivalent-examination section", hskRequirement: "official materials section", tuitionAmount: "official fee section", applicationNote: "official eligibility, materials, interview and financial-proof sections" },
  };
};
const pkuhscPrograms = [pkuhscProgram("clinical"), pkuhscProgram("stomatology")];
const programs = [...ustbPrograms, ...pkuhscPrograms];
const programIntakes: CatalogSeedProgramIntake[] = [
  ...ustbPrograms.map((program): CatalogSeedProgramIntake => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2027, openDate: "2026-11-01T00:00:00Z", deadlineDate: "2027-06-15T00:00:00Z", deadlineLabel: "Application period: November 1, 2026 through June 15, 2027. The page does not state deadline times.", applicationRound: "2027 master's and doctoral admissions", status: "open", ...fields("ustb-graduate-admissions-2027"), sourceFieldLineage: { intakeTerm: "official early-September enrollment", intakeYear: "official guide title", openDate: "official application period", deadlineDate: "official application period", deadlineLabel: "official application period", status: "deadline compared with capturedAt" } })),
  ...pkuhscPrograms.map((program): CatalogSeedProgramIntake => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2027, openDate: "2026-12-01T00:00:00Z", deadlineDate: "2027-03-31T00:00:00Z", deadlineLabel: "Round 1: December 1, 2026 to February 26, 2027; Round 2: March 1 to March 31, 2027. Interviews are scheduled for March 13 and April 17, 2027 respectively.", applicationRound: "2027 self-funded undergraduate admissions, two rounds", status: "open", ...fields("pkuhsc-undergraduate-admissions-pdf-2027"), sourceFieldLineage: { intakeTerm: "official August/September registration window", intakeYear: "official brochure title and registration window", openDate: "official first-round opening date", deadlineDate: "official second-round deadline", deadlineLabel: "official application and interview schedule", status: "deadline compared with capturedAt" } })),
];

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "university-of-science-and-technology-beijing-chinese-government-scholarship-type-b-2027",
    title: "USTB Chinese Government Scholarship Type B - 2027 Graduate Intake",
    nameZh: "北京科技大学中国政府奖学金B类（2027年研究生）",
    type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "国家留学基金管理委员会 / 北京科技大学", providerNameEn: "China Scholarship Council / University of Science and Technology Beijing", schoolSlug: ustbSchool.slug,
    fundingLevel: "Full", coverage: "The official graduate guide lists the High-Level Graduate Program and Silk Road Program under Chinese Government Scholarship Type B; exact coverage follows the scholarship notice.", applicableDegree: "Master; Doctoral", applicableProgram: "Eligible 2027 USTB graduate programs", deadlineLabel: "The graduate guide states that Type B applications generally run November 1 through April 15 of the following year; consult the specific scholarship notice before applying.", applicationRound: "2027 graduate intake", requirementText: "Apply directly to USTB under institution code 10008 and meet the selected program and scholarship requirements.",
    actionLinks: [{ label: "Official USTB 2027 graduate guide", url: source("ustb-graduate-admissions-2027").url, kind: "official-source" }, { label: "USTB application system", url: "https://onlineapply.ustb.edu.cn/", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("ustb-graduate-admissions-2027"), sourceFieldLineage: { title: "official scholarship section", coverage: "official scholarship category; exact coverage deferred to scholarship notice", applicableDegree: "official guide scope", deadlineLabel: "official general scholarship period", requirementText: "official Type B application route" },
  },
  {
    slug: "university-of-science-and-technology-beijing-chancellor-scholarship-2027",
    title: "USTB Chancellor Scholarship - 2027 Graduate Intake",
    nameZh: "北京科技大学校长奖学金（2027年研究生）",
    type: "university", typeLabel: "USTB Chancellor Scholarship", providerName: "北京科技大学", providerNameEn: "University of Science and Technology Beijing", schoolSlug: ustbSchool.slug,
    fundingLevel: "Full or Partial", coverage: "Full awards cover tuition, accommodation, living expenses and insurance; partial awards follow the specific scholarship decision.", applicableDegree: "Master; Doctoral", applicableProgram: "Eligible 2027 USTB graduate programs", deadlineLabel: "The graduate guide states that applications generally run November 1 through April 30 of the following year; consult the scholarship notice before applying.", applicationRound: "2027 graduate intake", requirementText: "Apply directly to USTB and meet the selected program and scholarship requirements.",
    benefitItems: [{ label: "Tuition", included: true, note: "Included in full awards" }, { label: "Accommodation", included: true, note: "Included in full awards" }, { label: "Living expenses", included: true, note: "Included in full awards" }, { label: "Insurance", included: true, note: "Included in full awards" }],
    actionLinks: [{ label: "Official USTB 2027 graduate guide", url: source("ustb-graduate-admissions-2027").url, kind: "official-source" }, { label: "USTB application system", url: "https://onlineapply.ustb.edu.cn/", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("ustb-graduate-admissions-2027"), sourceFieldLineage: { title: "official scholarship section", fundingLevel: "official full-or-partial description", coverage: "official full-scholarship coverage", applicableDegree: "official guide scope", deadlineLabel: "official general scholarship period", requirementText: "official direct-application route" },
  },
  {
    slug: "peking-university-health-science-center-chinese-government-scholarship-type-a-2027",
    title: "PKUHSC Chinese Government Scholarship Type A - 2027 Undergraduate Intake",
    nameZh: "北京大学医学部中国政府奖学金A类（2027年本科）",
    type: "government", typeLabel: "Chinese Government Scholarship Type A", providerName: "国家留学基金管理委员会 / 北京大学医学部", providerNameEn: "China Scholarship Council / Peking University Health Science Center", schoolSlug: pkuhscSchool.slug,
    fundingLevel: "Subject to Type A award", coverage: "The university brochure does not restate the award package; coverage follows the dispatching authority and CSC decision.", applicableDegree: "Bachelor", applicableProgram: "Clinical Medicine and Stomatology", deadlineLabel: "Apply through the dispatching authority in the applicant's home country according to its schedule; the PKUHSC brochure does not publish one university deadline for this route.", applicationRound: "2027 undergraduate intake", requirementText: "Submit CSCA Mathematics, Physics and Chemistry results, select Type A and Peking University as the first-choice institution in the CSC system, and pass PKUHSC qualification review and interview.",
    applicationSteps: [{ label: "Step 1", body: "Apply through the dispatching authority in the applicant's home country." }, { label: "Step 2", body: "Complete the CSC system application, choose Type A and list Peking University as the first-choice institution." }, { label: "Step 3", body: "Submit the required CSCA results to PKUHSC and complete its qualification review and interview." }],
    actionLinks: [{ label: "Official PKUHSC 2027 brochure", url: source("pkuhsc-undergraduate-admissions-pdf-2027").url, kind: "official-source" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("pkuhsc-undergraduate-admissions-pdf-2027"), sourceFieldLineage: { title: "official scholarship section", fundingLevel: "coverage not restated in brochure", applicableDegree: "official undergraduate guide", applicableProgram: "official program section", deadlineLabel: "official dispatching-authority route without a fixed university deadline", requirementText: "official scholarship CSCA and application sections", applicationSteps: "official scholarship application route" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [ustbSchool, pkuhscSchool], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 21 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs, refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The USTB guide publishes degree-level and teaching-medium tuition categories but does not embed the exact 2027 major catalog; the candidate therefore creates four explicit category routes and does not relabel 2026 majors.",
    "USTB master's and doctoral standard durations are published as ranges. durationYears stores the upper bound and applicationNote preserves the full range.",
    "USTB scholarship periods are described as general periods and therefore remain deadlineLabel text without a fixed deadlineDate.",
    "The PKUHSC Type A brochure does not restate the scholarship funding package or one fixed university deadline; neither is inferred.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 2, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
