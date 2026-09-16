import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = {
  manifest: resolve(root, "work/catalog-official/ucas-complete-batch-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/ucas-complete-batch-01/parsed-programs.json"),
  base: resolve(root, "seeds/catalog.buct-complete-batch-01.approved.local.json"),
  draft: resolve(root, "seeds/catalog.ucas-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.ucas-complete-batch-01.validation.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [manifestText, parsedText, baseText] = await Promise.all([readFile(paths.manifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.base, "utf8")]);
const manifest = JSON.parse(manifestText), parsed = JSON.parse(parsedText), base = JSON.parse(baseText) as CatalogSeedBundle;
const expected: Record<string, string> = {
  "ucas-graduate-admission-2026": "becc112bc169655952fa8a41172e6fdc60162744489a265527a8838521fbb45c",
  "ucas-international-major-index-current": "f99b9c7944a3ebb77a7d4a849985e442d86d6f1696907871beb63ad5456b2366",
  "ucas-international-admission-overview-current": "e9bc1213c289722a0afb902900bd96ced0db20bf6f6ee53bbd0d622e0689e511",
  "ucas-scholarship-2026": "a312524393620f33dc6d22668ec6f02c2a6e61c2c8546cf2cc986801976a445a",
  "ucas-cgs-scholarship-2026": "d9344e5a88680d5374f5293d8a1ab3743b1d0bd0a76cecca7c484a43bfefb396",
  "ucas-cas-anso-scholarship-2026": "2005bf8156b0c2e7fec3773c3a5eb4f621972a86c410a83241dc77b37c793088",
};
const evidence = new Map<string, any>();
for (const row of manifest.sources ?? []) if (row.status === 200 && expected[row.id] === row.sha256) evidence.set(row.id, row);
if (evidence.size !== 6 || parsed.programCount !== 174 || parsed.excludedAmbiguousCodeCount !== 54) throw new Error("UCAS evidence/parser mismatch.");
const city = base.cities?.find((row) => row.slug === "beijing");
if (!city) throw new Error("Current Beijing dependency missing.");

const schoolSlug = "university-of-chinese-academy-of-sciences";
const majorSource = evidence.get("ucas-international-major-index-current"), admissionSource = evidence.get("ucas-graduate-admission-2026");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = parsed.programs.map((row: any) => ({
  slug: `${schoolSlug}-master-${row.subjectCode.toLowerCase()}-${slugify(row.nameEn)}-english`,
  schoolSlug,
  citySlug: "beijing",
  nameEn: row.nameEn,
  degreeLevel: "Master",
  durationYears: 3,
  fieldCategory: `UCAS subject code ${row.subjectCode}`,
  subjectArea: row.nameEn,
  teachingLanguage: "English",
  cscaRequirement: "No CSCA requirement is published for this graduate route.",
  englishRequirement: "Valid IELTS, TOEFL or other recognized proof of English proficiency; no numeric threshold is published in the 2026 call.",
  tuitionAmount: 30000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 30,000/year",
  scholarshipText: "UCAS Scholarship, Chinese Government Scholarship and CAS-ANSO Scholarship routes are published separately; funding is competitive.",
  applicationUrl: "https://is.ucas.ac.cn/#/login",
  applicationNote: `Official English-instructed master's major, subject code ${row.subjectCode}. Host faculty or CAS institute selection is completed in the UCAS application system.`,
  hasScholarship: true,
  status: "draft",
  sourceUrl: majorSource.url,
  sourceLabel: majorSource.label,
  sourceSha256: majorSource.sha256,
  capturedAt: majorSource.fetchedAt,
  sourceFieldLineage: {
    nameEn: row.sourceLocator,
    degreeLevel: "derived from the 2026 admission call's direct English-instructed master's-program link",
    durationYears: "2026 admission call, Majors and Study Period",
    teachingLanguage: "2026 admission call's direct link context",
    tuitionAmount: "2026 admission call, Fees and Scholarships",
    applicationUrl: "2026 admission call, Online Application",
  },
}));
if (programs.length !== 174 || new Set(programs.map((row) => row.slug)).size !== 174) throw new Error("UCAS program build mismatch.");

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const materials = [info("Passport information page"), info("Degree certificate or expected-graduation proof"), info("Academic transcripts"), info("English or Chinese proficiency proof"), info("Motivation letter"), info("Two academic reference letters"), info("Supervisor acceptance form, if available")];
function scholarship(sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship {
  const source = evidence.get(sourceId);
  return {
    schoolSlug, status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    providerLocation: "China", targetCountries: [], targetRegions: [],
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "UCAS international application system", url: "https://is.ucas.ac.cn/#/login", kind: "official-application" }],
    sourceFieldLineage: { title: "official 2026 scholarship heading", fundingLevel: "official coverage section", coverage: "official coverage section", amountText: "official coverage section", applicableDegree: "official eligibility section", eligibilityItems: "official eligibility section", applicationMaterials: "2026 graduate admission call", applicationSteps: "official application procedure", deadlineLabel: "official deadline" },
    ...value,
  };
}
const scholarships: CatalogSeedScholarship[] = [
  scholarship("ucas-scholarship-2026", {
    slug: "official-2026-ucas-scholarship-for-international-students", title: "UCAS Scholarship for International Students 2026", nameZh: "中国科学院大学2026年国际学生奖学金", type: "university", typeLabel: "UCAS Scholarship", providerName: "中国科学院大学", providerNameEn: "University of Chinese Academy of Sciences", fundingLevel: "Full / Partial", coverage: "Full: tuition and application fee waiver, monthly stipend, basic accommodation and medical insurance. Partial: tuition and application fee waiver plus medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible 2026 UCAS master's and doctoral programs", amountText: "Full award: tuition waiver of RMB 30,000/year for master's or RMB 40,000/year for doctoral; total monthly stipend at least RMB 3,000 master's or RMB 3,500 doctoral; RMB 800/year insurance; RMB 600 application fee waiver.", deadlineDate: "2026-01-31", deadlineLabel: "January 31, 2026 (Beijing Time)", applicationRound: "2026 UCAS Scholarship",
    benefitItems: [benefit("Tuition waiver", "RMB 30,000 master / RMB 40,000 doctoral per year"), benefit("Application fee waiver", "RMB 600"), benefit("Monthly stipend", "At least RMB 3,000 master / RMB 3,500 doctoral"), benefit("Basic accommodation", "Location-dependent published conditions"), benefit("Medical insurance", "RMB 800/year")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen"), info("Program", "Meet 2026 UCAS international admission criteria"), info("Age", "Master born on/after January 1, 1996; doctoral born on/after January 1, 1991"), info("Language", "Proficient in English or Chinese"), info("Concurrent study", "Cannot concurrently pursue the same degree level at another Chinese institution")],
    applicationMaterials: materials, applicationSteps: [info("Step 1", "Complete the UCAS international application"), info("Step 2", "Choose UCAS Scholarship for International Students"), info("Step 3", "Submit all required materials before the deadline")], summary: "UCAS full and partial 2026 scholarship routes for international graduate students.", sortOrder: 10,
  }),
  scholarship("ucas-cgs-scholarship-2026", {
    slug: "official-2026-ucas-chinese-government-scholarship", title: "UCAS 2026 Chinese Government Scholarship", nameZh: "中国科学院大学2026年中国政府奖学金", type: "government", typeLabel: "Chinese Government Scholarship", providerName: "国家留学基金管理委员会 / 中国科学院大学", providerNameEn: "China Scholarship Council / University of Chinese Academy of Sciences", fundingLevel: "Full", coverage: "Tuition and application fee waiver, monthly stipend, campus accommodation or subsidy, and medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible 2026 UCAS master's and doctoral programs", amountText: "Tuition waiver RMB 30,000/year master or RMB 40,000/year doctoral; stipend RMB 3,500/month master or RMB 5,000/month doctoral; off-campus subsidy up to RMB 700/month master or RMB 1,000/month doctoral; RMB 800 medical insurance and RMB 600 application fee waiver.", deadlineDate: "2026-01-31", deadlineLabel: "January 31, 2026 (Beijing Time)", applicationRound: "2026 Chinese Government Scholarship",
    benefitItems: [benefit("Tuition waiver"), benefit("Application fee waiver", "RMB 600"), benefit("Monthly stipend", "RMB 3,500 master / RMB 5,000 doctoral"), benefit("Accommodation or subsidy", "Up to RMB 700 master / RMB 1,000 doctoral monthly off campus"), benefit("Medical insurance", "RMB 800/person")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen"), info("Degree and age", "Bachelor-equivalent and age 35 or below for master; master-equivalent and age 40 or below for doctoral"), info("Language", "Proficient in English or Mandarin"), info("Other funding", "Cannot accept another sponsorship during the award period")],
    applicationMaterials: materials, applicationSteps: [info("Step 1", "Submit the CSC application using UCAS agency 80001"), info("Step 2", "Submit the matching UCAS international application"), info("Step 3", "Choose Chinese Government Scholarship in UCAS system")], summary: "Full 2026 Chinese Government Scholarship administered through UCAS.", sortOrder: 20,
  }),
  scholarship("ucas-cas-anso-scholarship-2026", {
    slug: "official-2026-ucas-cas-anso-degree-scholarship", title: "CAS-ANSO Scholarship Degree Program 2026 at UCAS", nameZh: "中国科学院大学2026年CAS-ANSO奖学金学位项目", type: "other", typeLabel: "CAS-ANSO Scholarship", providerName: "中国科学院 / ANSO", providerNameEn: "Chinese Academy of Sciences / Alliance of National and International Science Organizations", fundingLevel: "Full", coverage: "Tuition fee, application fee, living allowance and medical insurance; additional coverage items follow the official award category.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible 2026 UCAS graduate programs", amountText: "Full scholarship; the captured HTML publishes the covered categories, while itemized values are presented in an official image and are not transcribed into CUAC without separate image evidence.", deadlineDate: "2026-01-31", deadlineLabel: "January 31, 2026 (Beijing Time)", applicationRound: "2026 CAS-ANSO Scholarship",
    benefitItems: [benefit("Tuition fee"), benefit("Application fee"), benefit("Living allowance"), benefit("Medical insurance")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen"), info("Age", "Master born on/after January 1, 1996; doctoral born on/after January 1, 1991"), info("Language", "Proficient in English or Chinese"), info("Program", "Meet 2026 UCAS international admission criteria"), info("Duplicate application", "Cannot apply through both USTC and UCAS")],
    applicationMaterials: materials, applicationSteps: [info("Step 1", "Complete the UCAS international application"), info("Step 2", "Choose CAS-ANSO Scholarship"), info("Step 3", "Referees and applicant submit by the deadline")], summary: "2026 CAS-ANSO full degree scholarship route at UCAS.", sortOrder: 30,
  }),
];

const overview = evidence.get("ucas-international-admission-overview-current");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [city],
  schools: [{
    slug: schoolSlug, nameEn: "University of Chinese Academy of Sciences", nameZh: "中国科学院大学", citySlug: "beijing", schoolType: "Public", region: "Beijing, North China",
    applicationLevel: "Master, Doctoral", languageOfInstruction: "English and Chinese", hskRequirement: "HSK Level 5 score 180 or above for Chinese-instructed programs", englishRequirement: "Valid IELTS, TOEFL or other recognized proof of English proficiency; no numeric threshold is published in the 2026 call.",
    deadlineSummary: "2026 degree application: October 15, 2025 to April 15, 2026; the three reviewed scholarship routes closed January 31, 2026.", tuitionSummary: "Master RMB 30,000/year; doctoral RMB 40,000/year for science and engineering or RMB 34,000/year for liberal arts.", applicationFee: "RMB 600", websiteUrl: "https://english.ucas.ac.cn/", admissionsUrl: admissionSource.url,
    cscaRequired: false, cscaRequirement: "No CSCA requirement is published for the reviewed graduate routes.", subjectTags: ["Science", "Engineering", "Agriculture", "Medicine", "Management", "Interdisciplinary Science"], languageTags: ["English", "Chinese"], campusHighlights: ["More than 20 UCAS faculties", "More than 100 CAS institutes", "Four Beijing campuses and five education centers outside Beijing"], status: "draft",
    sourceUrl: overview.url, sourceLabel: overview.label, sourceSha256: overview.sha256, capturedAt: overview.fetchedAt,
    sourceFieldLineage: { nameEn: "official international admission identity", nameZh: "official institution identity", citySlug: "official institutional address", applicationLevel: "2026 graduate admission call", languageOfInstruction: "2026 graduate admission call", hskRequirement: "2026 graduate admission call", englishRequirement: "2026 graduate admission call", deadlineSummary: "2026 graduate admission call", tuitionSummary: "2026 graduate admission call", applicationFee: "2026 graduate admission call" },
  }],
  programs,
  programIntakes: programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-04-15T00:00:00.000Z", deadlineLabel: "April 15, 2026", applicationRound: "2026 UCAS international graduate admissions", status: "closed", sourceUrl: admissionSource.url, sourceLabel: admissionSource.label, sourceSha256: admissionSource.sha256, capturedAt: admissionSource.fetchedAt, sourceFieldLineage: { deadlineDate: "2026 admission call, Application Deadline" } })),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await Promise.all([
  writeFile(paths.draft, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify({ ...validation, sourceManifestSha256: sha(manifestText), parsedArtifactSha256: sha(parsedText), excludedAmbiguousCodeCount: parsed.excludedAmbiguousCodeCount }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, summary: validation.summary, excludedAmbiguousCodeCount: parsed.excludedAmbiguousCodeCount, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, paths }, null, 2));
