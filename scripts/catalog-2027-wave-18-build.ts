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
const candidatePath = resolve(root, "seeds/catalog.2027-wave-18.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-18.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-18.review.json");
const expected: Record<string, string> = {
  "hit-short-term-chinese-winter-2026-2027": "7c2cbddf5fa4ff38fb3e53a9fdd40e765955860151c87e24d997e7274dc51342",
  "scu-china-link-scholarship-2026-2027": "96100f5525f4fe062472a2c394975156e04a963b51d86f4ff943c9198b81287e",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 18 evidence: ${missing.join(", ")}`);
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const school = (slug: string) => (base.schools ?? []).find((row) => row.slug === slug);
const city = (slug: string) => (base.cities ?? []).find((row) => row.slug === slug);
const hitBase = school("harbin-institute-of-technology");
const scuBase = school("sichuan-university");
const harbin = city("harbin");
const chengdu = city("chengdu");
if (!hitBase || !scuBase || !harbin || !chengdu) throw new Error("Wave 18 school or city dependency is missing from the reviewed 100-school release.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const schools = [
  {
    ...hitBase,
    deadlineSummary: "The official 2026-2027 short-term Chinese-language page lists a November 30 deadline for the winter session running December 28, 2026-January 22, 2027. It does not establish general Fall 2027 degree deadlines.",
    verificationStatus: "verified",
    lastVerifiedAt: source("hit-short-term-chinese-winter-2026-2027").fetchedAt,
    ...fields("hit-short-term-chinese-winter-2026-2027"),
    sourceFieldLineage: { ...(hitBase.sourceFieldLineage ?? {}), deadlineSummary: "official winter 2026-2027 short-term Chinese-language page" },
  },
  {
    ...scuBase,
    deadlineSummary: "The 2026 China Link route requires application at least three months before arrival and study must start no later than August 31, 2027. It does not establish general Fall 2027 degree deadlines.",
    verificationStatus: "verified",
    lastVerifiedAt: source("scu-china-link-scholarship-2026-2027").fetchedAt,
    ...fields("scu-china-link-scholarship-2026-2027"),
    sourceFieldLineage: { ...(scuBase.sourceFieldLineage ?? {}), deadlineSummary: "official China Link duration and application-process sections" },
  },
];

const hitProgram: CatalogSeedProgram = {
  slug: "harbin-institute-of-technology-short-term-chinese-winter-2026-2027",
  schoolSlug: hitBase.slug,
  citySlug: harbin.slug,
  nameEn: "Short-term Chinese Language Program - Winter 2026-2027",
  nameZh: "哈尔滨工业大学短期汉语项目（2026-2027冬季）",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: "Practical Chinese language and traditional Chinese culture",
  teachingLanguage: "Chinese",
  tuitionAmount: 3500,
  tuitionCurrency: "CNY",
  tuitionPeriod: "program",
  tuitionText: "CNY 3,500 tuition for four weeks; CNY 160 insurance; CNY 500 application fee; accommodation CNY 1,000-1,200/month/bed plus CNY 10 Wi-Fi.",
  displayTuition: "CNY 3,500 / 4 weeks",
  applicationUrl: "https://apply.hit.edu.cn/",
  applicationNote: "Applicants must be non-Chinese citizens in good physical and mental health. Submit the passport information page and, for minors, a guarantee certificate, then pay the application fee. On-campus accommodation is first-come, first-served after payment.",
  badgeText: "Winter 2026-2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("hit-short-term-chinese-winter-2026-2027").fetchedAt,
  ...fields("hit-short-term-chinese-winter-2026-2027"),
  sourceFieldLineage: { nameEn: "official page title and winter-session dates", degreeLevel: "short-term training category", subjectArea: "program characteristics", teachingLanguage: "program identity", tuitionAmount: "fees section", applicationNote: "eligibility, application process and accommodation notice" },
};

const scuProgram: CatalogSeedProgram = {
  slug: "sichuan-university-china-link-research-exchange-2027",
  schoolSlug: scuBase.slug,
  citySlug: chengdu.slug,
  nameEn: "China Link Short-term Scientific Exchange - 2027",
  nameZh: "四川大学中国政府奖学金短期科研交流项目（2027年入学）",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Short-term research exchange",
  subjectArea: "All disciplines other than Chinese-language study",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published for this China Link research-exchange route; applicants must satisfy the agreed SCU host arrangement.",
  englishRequirement: "No fixed English-test score is published for this China Link research-exchange route; applicants must satisfy the agreed SCU host arrangement.",
  tuitionText: "Tuition is fully waived under the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition waiver, free on-campus accommodation, comprehensive medical insurance and a monthly stipend of CNY 3,000 for general scholars or CNY 3,500 for senior scholars.",
  applicationUrl: "https://studyinchina.csc.edu.cn/#/login",
  applicationNote: "The route lasts 1-12 months and study must begin no later than August 31, 2027. Applicants must obtain SCU pre-admission qualification and apply in the CSC system at least three months in advance using agency number 10610.",
  hasScholarship: true,
  badgeText: "Entry through August 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Research exchange programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("scu-china-link-scholarship-2026-2027").fetchedAt,
  ...fields("scu-china-link-scholarship-2026-2027"),
  sourceFieldLineage: { nameEn: "official scholarship title and 2027 latest-start condition", degreeLevel: "general and senior scholar categories", durationMonths: "official one-to-twelve-month duration; upper published bound represented", subjectArea: "official study/research fields", teachingLanguage: "official working-language section", hskRequirement: "official route publishes Chinese or English working languages without a fixed test score", englishRequirement: "official route publishes Chinese or English working languages without a fixed test score", tuitionText: "official full tuition-waiver coverage", scholarshipText: "official funding section", applicationNote: "official duration and application procedure" },
};
const programs = [hitProgram, scuProgram];
const programIntakes: CatalogSeedProgramIntake[] = [
  {
    programSlug: hitProgram.slug,
    intakeTerm: "Winter",
    intakeYear: 2027,
    deadlineDate: "2026-11-30T00:00:00Z",
    deadlineLabel: "Application deadline: November 30 for the December 28, 2026-January 22, 2027 winter term; the official page does not state a deadline time.",
    applicationRound: "Winter 2026-2027 short-term Chinese-language session",
    status: "open",
    ...fields("hit-short-term-chinese-winter-2026-2027"),
    sourceFieldLineage: { intakeTerm: "winter-term label", intakeYear: "session end date January 22, 2027", deadlineDate: "deadline printed beside the winter 2026-2027 session", deadlineLabel: "program-duration section", applicationRound: "program-duration section", status: "deadline compared with capturedAt" },
  },
  {
    programSlug: scuProgram.slug,
    intakeTerm: "Rolling",
    intakeYear: 2027,
    deadlineLabel: "Apply at least three months before the proposed arrival; study must start no later than August 31, 2027. No single calendar deadline is published.",
    applicationRound: "2026 China Link call with entry no later than August 31, 2027",
    status: "open",
    ...fields("scu-china-link-scholarship-2026-2027"),
    sourceFieldLineage: { intakeTerm: "year-round relative application timing", intakeYear: "latest-start condition", deadlineLabel: "official application procedure and latest-start condition", applicationRound: "official 2026 China Link call", status: "relative deadline remains actionable at capturedAt" },
  },
];
const scholarship: CatalogSeedScholarship = {
  slug: "sichuan-university-china-link-scholarship-2027",
  title: "Sichuan University China Link Scholarship - 2027 Entry",
  nameZh: "四川大学中国政府奖学金短期科研交流项目（2027年入学）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - China Link",
  providerName: "国家留学基金管理委员会 / 四川大学",
  providerNameEn: "China Scholarship Council / Sichuan University",
  schoolSlug: scuBase.slug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, free on-campus accommodation, comprehensive medical insurance and monthly stipend.",
  applicableDegree: "Non-degree / Research exchange",
  applicableProgram: "General scholars and senior scholars in all disciplines other than Chinese-language study",
  amountText: "CNY 3,000/month for general scholars; CNY 3,500/month for senior scholars.",
  deadlineLabel: "Apply at least three months in advance; study must start no later than August 31, 2027",
  applicationRound: "2026 China Link call with 2027 entry",
  requirementText: "Applicants must be non-Chinese citizens in good health; general scholars must be under 45 and senior scholars under 50. They must remain full-time students or full-time academic staff at a CSC foreign partner university and obtain SCU pre-admission qualification.",
  benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus accommodation", included: true }, { label: "Comprehensive medical insurance", included: true }, { label: "Monthly stipend", included: true, note: "CNY 3,000 general / CNY 3,500 senior" }],
  applicationSteps: [{ label: "Step 1", body: "Contact the SCU Overseas Students Office to obtain pre-admission qualification." }, { label: "Step 2", body: "Apply in the CSC system at least three months in advance using SCU agency number 10610." }, { label: "Step 3", body: "Notify the SCU Overseas Students Office after CSC submission as directed by the official page." }],
  actionLinks: [{ label: "Official SCU source", url: source("scu-china-link-scholarship-2026-2027").url, kind: "official-source" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("scu-china-link-scholarship-2026-2027").fetchedAt,
  ...fields("scu-china-link-scholarship-2026-2027"),
  sourceFieldLineage: { title: "official program title and 2027 latest-start condition", fundingLevel: "official funding section", coverage: "official funding section", applicableDegree: "official funding categories", applicableProgram: "official study/research scope", amountText: "official funding section", deadlineLabel: "official application procedure and latest-start condition", requirementText: "official eligibility section", applicationSteps: "official application procedure" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [harbin, chengdu], schools, programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 18 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: schools.map((row) => row.slug), refreshedPrograms: 2, new2027Intakes: 2, refreshedScholarships: 1, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The HIT page covers only the winter 2026-2027 short-term Chinese-language session; no general Fall 2027 degree route is inferred.",
    "The HIT page prints November 30 without repeating the year; the candidate binds it only to the adjacent December 2026-January 2027 winter session.",
    "The SCU China Link page publishes a relative application lead time rather than one calendar deadline, so deadlineDate remains absent.",
    "The SCU source does not establish general Fall 2027 degree admissions or individual research placements.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: schools.length, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
