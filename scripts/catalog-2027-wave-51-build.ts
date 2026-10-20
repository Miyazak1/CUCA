import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceId = "tjfsu-cgs-high-level-graduate-type-b-2027";
const expectedSha256 = "9b20228ef2505662e8f04f7b21aefffb81fb45cf247c238ecb5cc2a13d967649";
let evidence: ManifestSource | undefined;
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const item = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!item) continue;
    const bytes = await readFile(resolve(runRoot, item.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error("TJFSU 2027 scholarship evidence hash mismatch.");
    evidence = item;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!evidence) throw new Error("Missing locked TJFSU 2027-2028 scholarship evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-26.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "tianjin");
const school = prior.schools?.find((row) => row.slug === "tianjin-foreign-studies-university");
if (!city || !school) throw new Error("Wave 26 TJFSU dependency rows are missing.");
const sourceFields = { sourceUrl: evidence.finalUrl ?? evidence.url, sourceLabel: evidence.label, sourceSha256: evidence.sha256, capturedAt: evidence.fetchedAt };

const scholarship: CatalogSeedScholarship = {
  slug: "tianjin-foreign-studies-university-cgs-high-level-graduate-type-b-2027",
  title: "TJFSU Chinese Government Scholarship High-Level Graduate Program (Type B) - 2027-2028",
  nameZh: "天津外国语大学2027—2028学年中国政府奖学金高水平研究生项目（B类）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - High-Level Graduate Program (Type B)",
  providerName: "国家留学基金管理委员会 / 天津外国语大学",
  providerNameEn: "China Scholarship Council / Tianjin Foreign Studies University",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, on-campus accommodation, monthly living allowance and comprehensive medical insurance in China.",
  amountText: "Monthly living allowance: CNY 3,000 for master's students and CNY 3,500 for doctoral students.",
  applicableDegree: "Master; Doctoral",
  applicableProgram: "Eligible TJFSU master's and doctoral programs listed in the official attachment; the attachment is CAPTCHA-protected and program rows are not inferred here.",
  deadlineDate: "2027-02-21",
  deadlineLabel: "Submit the TJFSU application by February 21, 2027. The notice does not state a deadline time.",
  applicationRound: "2027-2028 high-level graduate scholarship",
  requirementText: "Applicants must be non-Chinese citizens, hold a bachelor's degree and be under 35 for master's study or hold a master's degree and be under 40 for doctoral study, meet the relevant TJFSU academic and language requirements, and not hold another scholarship.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Full tuition waiver" },
    { label: "Accommodation", included: true, note: "On-campus accommodation is required" },
    { label: "Living allowance", included: true, note: "CNY 3,000/month for master's students; CNY 3,500/month for doctoral students" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance in China" },
  ],
  eligibilityItems: [
    { label: "Citizenship", body: "Non-Chinese citizen in good physical and mental health" },
    { label: "Master's applicants", body: "Bachelor's degree and age 35 or below" },
    { label: "Doctoral applicants", body: "Master's degree and age 40 or below" },
    { label: "Chinese-taught master's", body: "HSK Level 5 score 180 or above" },
    { label: "Chinese-taught doctoral", body: "HSK Level 6 score 180 or above" },
    { label: "English-taught study", body: "IELTS 6.0, TOEFL 80, Duolingo 110 or an accepted equivalent" },
  ],
  applicationMaterials: [
    { label: "Passport", body: "Passport information page; validity later than October 31, 2028" },
    { label: "Academic records", body: "Notarized highest degree certificate and complete transcripts" },
    { label: "Language proof", body: "Valid route-appropriate Chinese or English proficiency evidence" },
    { label: "Study plan", body: "At least 1,000 Chinese or English words; doctoral plans require the Chinese supervisor's signature" },
    { label: "Recommendations", body: "Two recommendations from professors or associate professors" },
    { label: "Health and conduct", body: "Foreigner Physical Examination Record and a police-issued no-criminal-record certificate" },
  ],
  applicationSteps: [
    { label: "Step 1", body: "Apply through the TJFSU international student service platform by February 21, 2027." },
    { label: "Step 2", body: "Complete the university document review, written examination and interview." },
    { label: "Step 3", body: "After pre-admission, submit the CSC Type B application using TJFSU agency number 10068." },
  ],
  actionLinks: [
    { label: "Official 2027-2028 scholarship guide", url: evidence.url, kind: "official-source" },
    { label: "TJFSU application system", url: "https://tfsu.at0086.cn/StuApplication/Login.aspx", kind: "official-application" },
    { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/", kind: "official-application" },
  ],
  summary: "Full 2027-2028 Chinese Government Scholarship Type B route for eligible TJFSU master's and doctoral applicants.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official notice title",
    fundingLevel: "official scholarship content section",
    coverage: "official scholarship content section",
    amountText: "official monthly allowance amounts",
    applicableDegree: "official admission categories",
    deadlineDate: "official application process",
    requirementText: "official eligibility section",
    benefitItems: "official scholarship content section",
    eligibilityItems: "official eligibility and language requirements",
    applicationMaterials: "official application-material list",
    applicationSteps: "official application and selection process",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: evidence.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 51 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The official major-list attachment requires a CAPTCHA. It was not bypassed, so exact eligible program rows and study durations remain unresolved.",
    "The notice publishes a February 21, 2027 calendar deadline without a time; deadlineDate stores the calendar date only and deadlineLabel preserves that limitation.",
    "This source establishes a scholarship route, not general self-funded Fall 2027 degree admissions.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-51.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-51.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-51.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: 1, schools: 1, programs: 0, programIntakes: 0, scholarships: 1, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
