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
const candidatePath = resolve(root, "seeds/catalog.2027-wave-17.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-17.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-17.review.json");
const expected: Record<string, string> = {
  "sysu-foundation-one-semester-spring-2027": "6880979c438c23e5b33b0fffae4016603c2cea120674b4d5384ede0cef99df4e",
  "sysu-china-link-spring-2027": "aa39c934b346febc73f6aa4db7faf88d26e4e3946c538b86069be289c7352bb1",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 17 evidence: ${missing.join(", ")}`);
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === "sun-yat-sen-university");
const city = (base.cities ?? []).find((row) => row.slug === "guangzhou");
if (!baseSchool || !city) throw new Error("Wave 17 SYSU dependencies are missing from the reviewed 100-school release.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const school = {
  ...baseSchool,
  deadlineSummary: "The one-semester foundation route expected to enter in February 2027 closed July 31, 2026. The China Link scholarship route for Spring or Summer 2027 closes December 1, 2026. These sources do not establish general Fall 2027 degree deadlines.",
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields("sysu-foundation-one-semester-spring-2027"),
  sourceFieldLineage: { ...(baseSchool.sourceFieldLineage ?? {}), deadlineSummary: "two official SYSU pages with explicit 2027 entry windows" },
};

const foundation: CatalogSeedProgram = {
  slug: "sun-yat-sen-university-pre-university-one-semester-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Pre-university Program - One-Semester Route (Spring 2027)",
  nameZh: "中山大学国际学生预科项目一学期制（2027年春季）",
  degreeLevel: "Foundation",
  fieldCategory: "Pre-university",
  subjectArea: "Business and Humanities or Sciences and Engineering foundation study with Chinese, HSK and CSCA preparation",
  teachingLanguage: "Chinese",
  hskRequirement: "A valid HSK Level 4 certificate is required for the one-semester route.",
  cscaRequirement: "The curriculum includes targeted CSCA preparation; the page does not publish a CSCA admission-score threshold for this foundation route.",
  tuitionAmount: 15200,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 15,200 tuition per semester, or CNY 17,500 per semester including shared double-room accommodation",
  displayTuition: "CNY 15,200 tuition; CNY 17,500 with accommodation",
  applicationUrl: "https://apply.sysu.edu.cn",
  applicationNote: "Expected entry is February 2027. Applicants must be non-Chinese citizens with a valid passport, have completed senior high school or higher/equivalent education, be physically and mentally healthy, have no criminal record, and submit the official checklist. The page remains labeled as the 2026 pre-university program and the Spring 2027 date applies specifically to its one-semester option.",
  badgeText: "Spring 2027 foundation route",
  displayGroup: "Foundation",
  displayGroupLabel: "Foundation programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("sysu-foundation-one-semester-spring-2027").fetchedAt,
  ...fields("sysu-foundation-one-semester-spring-2027"),
  sourceFieldLineage: { nameEn: "official pre-university title and one-semester entry note", nameZh: "official Chinese program identity translated from the official English page", degreeLevel: "pre-university program category", subjectArea: "curriculum framework", teachingLanguage: "Chinese-language foundation curriculum", hskRequirement: "one-semester application checklist", cscaRequirement: "academic support module", tuitionAmount: "tuition and fees section", applicationNote: "entry date, eligibility and checklist" },
};
const chinaLink: CatalogSeedProgram = {
  slug: "sun-yat-sen-university-china-link-research-exchange-spring-summer-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "China Link Short-term Research Exchange - Spring/Summer 2027",
  nameZh: "2027年春季/暑期中国政府奖学金短期科研交流项目",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Short-term research exchange",
  subjectArea: "Approved SYSU research fields in the official 2026 undergraduate and postgraduate project catalogs",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published for this China Link research-exchange route; applicants must meet the agreed SYSU host-project requirements.",
  englishRequirement: "No fixed English-test score is published for this China Link research-exchange route; applicants must meet the agreed SYSU host-project requirements.",
  tuitionText: "Tuition is fully covered by the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition, on-campus accommodation and comprehensive medical insurance, plus CNY 3,000/month for regular visiting students or CNY 3,500/month for advanced visiting students; final standards are subject to CSC.",
  applicationUrl: "https://studyinchina.csc.edu.cn",
  applicationNote: "Applicants must be full-time students at an eligible overseas CSC partner institution. Regular visiting applicants (undergraduate/master level) must be no older than 45; advanced visiting applicants (doctoral level) no older than 50. Study lasts 1-12 months and must start no later than August 31, 2027. Both CSC and SYSU applications plus a SYSU host-school recommendation are required.",
  hasScholarship: true,
  badgeText: "Spring/Summer 2027 scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Research exchange programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("sysu-china-link-spring-2027").fetchedAt,
  ...fields("sysu-china-link-spring-2027"),
  sourceFieldLineage: { nameEn: "official China Link project title and Spring/Summer 2027 application window", nameZh: "official Chinese page title with intake qualifier", degreeLevel: "regular and advanced visiting-student categories", durationMonths: "official one-to-twelve-month duration; upper published bound represented", subjectArea: "official linked project catalogs", teachingLanguage: "official eligibility plan", hskRequirement: "official route publishes Chinese or English working languages without a fixed test score", englishRequirement: "official route publishes Chinese or English working languages without a fixed test score", tuitionText: "official full tuition coverage", scholarshipText: "official funding section", applicationNote: "official eligibility and application procedure" },
};
const programs = [foundation, chinaLink];
const programIntakes: CatalogSeedProgramIntake[] = [
  { programSlug: foundation.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-07-31T00:00:00Z", deadlineLabel: "Application deadline: July 31, 2026. The official page does not state a deadline time.", applicationRound: "SYSU one-semester pre-university route expected February 2027 entry", status: "closed", ...fields("sysu-foundation-one-semester-spring-2027"), sourceFieldLineage: { intakeTerm: "expected February 2027 entry", intakeYear: "expected February 2027 entry", deadlineDate: "application period", deadlineLabel: "application period", applicationRound: "one-semester route note", status: "deadline compared with capturedAt" } },
  { programSlug: chinaLink.slug, intakeTerm: "Spring/Summer", intakeYear: 2027, deadlineDate: "2026-12-01T00:00:00Z", deadlineLabel: "SYSU application deadline: December 1, 2026 for planned Spring or Summer 2027 arrival. The page does not state a deadline time.", applicationRound: "SYSU 2026 China Link - Spring/Summer 2027 arrival", status: "open", ...fields("sysu-china-link-spring-2027"), sourceFieldLineage: { intakeTerm: "Spring or Summer 2027 application window", intakeYear: "Spring or Summer 2027 application window", deadlineDate: "SYSU application procedure", deadlineLabel: "SYSU application procedure", applicationRound: "official China Link page", status: "deadline compared with capturedAt" } },
];
const scholarship: CatalogSeedScholarship = {
  slug: "sun-yat-sen-university-china-link-scholarship-spring-summer-2027",
  title: "Sun Yat-sen University China Link Scholarship - Spring/Summer 2027",
  nameZh: "中山大学中国政府奖学金短期科研交流项目（2027年春季/暑期）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - China Link",
  providerName: "国家留学基金管理委员会 / 中山大学",
  providerNameEn: "China Scholarship Council / Sun Yat-sen University",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition, on-campus accommodation and comprehensive medical insurance, plus a monthly living allowance.",
  applicableDegree: "Non-degree / Research exchange",
  applicableProgram: "Regular visiting students at undergraduate/master level and advanced visiting students at doctoral level from eligible overseas partner institutions",
  amountText: "CNY 3,000/month for regular visiting students; CNY 3,500/month for advanced visiting students; final standards are subject to CSC.",
  deadlineDate: "2026-12-01",
  deadlineLabel: "SYSU application deadline: December 1, 2026 for planned Spring or Summer 2027 arrival",
  applicationRound: "Spring/Summer 2027 China Link",
  requirementText: "Applicant must be a non-Chinese citizen in good health and a full-time student at an eligible overseas CSC partner institution; regular visiting applicants must be no older than 45 and advanced visiting applicants no older than 50. A SYSU host-school recommendation is required.",
  benefitItems: [{ label: "Tuition", included: true }, { label: "On-campus accommodation", included: true }, { label: "Comprehensive medical insurance", included: true }, { label: "Monthly living allowance", included: true, note: "CNY 3,000 regular / CNY 3,500 advanced" }],
  applicationMaterials: [{ label: "CSC application form" }, { label: "Passport and photo" }, { label: "Highest qualification or current enrollment proof" }, { label: "Transcript" }, { label: "Study or research plan" }, { label: "Physical examination or health declaration, depending on duration" }, { label: "No-criminal-record certificate or declaration, depending on duration" }, { label: "SYSU host-school recommendation" }],
  applicationSteps: [{ label: "Step 1", body: "Obtain an invitation or recommendation from a SYSU host school." }, { label: "Step 2", body: "Apply in the CSC system under Type B using SYSU agency number 10558." }, { label: "Step 3", body: "Apply in the SYSU system and submit the required documents by the applicable deadline." }],
  actionLinks: [{ label: "Official SYSU source", url: source("sysu-china-link-spring-2027").url, kind: "official-source" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn", kind: "official-application" }],
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("sysu-china-link-spring-2027").fetchedAt,
  ...fields("sysu-china-link-spring-2027"),
  sourceFieldLineage: { title: "official page title and Spring/Summer 2027 deadline branch", fundingLevel: "official funding section", coverage: "official funding section", applicableDegree: "official applicant categories", applicableProgram: "official eligibility and project catalog scope", amountText: "official funding section", deadlineDate: "official SYSU application procedure", requirementText: "official eligibility and recommendation procedure", applicationMaterials: "official application-material list", applicationSteps: "official application procedure" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 17 validation failed:\n${validation.errors.join("\n")}`);
const review = { version: 1, status: "unreviewed_draft", generatedAt: verifiedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { schoolSlugs: [school.slug], refreshedPrograms: 2, new2027Intakes: 2, refreshedScholarships: 1, sourceSnapshots: evidence.size }, evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)), unresolved: ["The foundation page labels the overall offering as the 2026 program; only its one-semester option has an explicit expected February 2027 entry, so no other 2027 foundation route is inferred.", "China Link exact fields and host placements depend on the linked 2026 project catalogs; the candidate keeps the official group-level scope rather than inventing route rows.", "General Fall 2027 degree admissions are not established by these sources."], notes: ["No applicant, account, passport, payment or other personal data is included."] };
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: 2, programIntakes: 2, scholarships: 1, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
