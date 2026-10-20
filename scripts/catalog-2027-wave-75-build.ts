import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
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
const runRoot = resolve(root, "work/catalog-official/full-refresh-2026-10-20");
const sourceId = "nju-cgs-high-level-postgraduate-2027";
const expectedSha256 = "c196bce32f3df22b92d57d3f17e4c5522ffea21c7ff70d0f98dd716924b3d23f";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const source = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Nanjing University 2027 scholarship evidence.");
const bytes = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Nanjing University scholarship evidence hash mismatch.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-01.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "nanjing-university");
const city = dependency.cities?.find((row) => row.slug === "nanjing");
if (!school || !city) throw new Error("Wave 75 Nanjing University dependency rows are missing from Wave 01.");

const officialUrl = source.finalUrl ?? source.url;
const scholarship: CatalogSeedScholarship = {
  slug: "nanjing-university-cgs-high-level-postgraduate-2027",
  title: "Nanjing University 2027 Chinese Government Scholarship High-Level Postgraduate Program",
  nameZh: "南京大学2027年中国政府奖学金（B类）高水平研究生项目",
  schoolSlug: school.slug,
  type: "Government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "China Scholarship Council / Nanjing University",
  fundingLevel: "Full scholarship",
  coverage: "Full tuition waiver, monthly living allowance, comprehensive medical insurance, and free accommodation in a Nanjing University international student dormitory.",
  applicableDegree: "Master; Doctorate",
  applicableProgram: "Eligible 2027 Nanjing University master's and doctoral programs in the official scholarship program catalog",
  amountText: "Master's living allowance: RMB 3,000/month; doctoral living allowance: RMB 3,500/month; medical insurance: RMB 800/academic year; tuition and university accommodation are covered.",
  requirementText: "Applicants must be non-Chinese citizens in good health; master's applicants must hold a bachelor's degree and be no older than 35, doctoral applicants must hold a master's degree and be no older than 40. Chinese-taught science requires HSK 4 (180+) and humanities HSK 5 (180+); English-taught study requires IELTS 6.0+, TOEFL 85+, TOEFL Essentials 9+, or Duolingo 100+. Applicants already holding another Chinese scholarship for 2027-2028 are ineligible.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Full tuition waiver" },
    { label: "Living allowance", included: true, note: "RMB 3,000/month for master's students; RMB 3,500/month for doctoral students" },
    { label: "Medical insurance", included: true, note: "RMB 800 per academic year" },
    { label: "Accommodation", included: true, note: "Free university international student dormitory accommodation during the scholarship period" },
  ],
  eligibilityItems: [
    { label: "Nationality and health", body: "Non-Chinese citizen in good health" },
    { label: "Master", body: "Bachelor's degree and no older than 35" },
    { label: "Doctorate", body: "Master's degree and no older than 40" },
    { label: "Chinese-taught language", body: "Science: HSK 4 with 180+; humanities: HSK 5 with 180+" },
    { label: "English-taught language", body: "IELTS 6.0+, TOEFL 85+, TOEFL Essentials 9+, or Duolingo English Test 100+" },
    { label: "Other funding", body: "No other Chinese scholarship for the 2027-2028 academic year" },
  ],
  applicationMaterials: [
    { label: "Highest degree certificate or pre-graduation certificate" },
    { label: "Academic transcripts; doctoral applicants submit both bachelor's and master's transcripts" },
    { label: "Two recommendation letters from associate professors, professors, or equivalent experts" },
    { label: "Language test report for the chosen teaching language" },
    { label: "Personal statement" },
    { label: "Research publications and achievements list, if available" },
    { label: "Valid physical examination form" },
    { label: "Passport information page" },
    { label: "Valid no-criminal-record certificate" },
    { label: "Master's thesis abstract for doctoral applicants" },
    { label: "Portfolio for architecture or urban-planning applicants" },
  ],
  applicationSteps: [
    { label: "NJU application", body: "Apply in the Nanjing University international student system from November 1, 2026 through January 20, 2027 and select the Chinese Government Scholarship Type B program." },
    { label: "NJU review", body: "Complete initial and academic review; successful applicants receive an NJU pre-admission notice." },
    { label: "CSC application", body: "After receiving pre-admission, submit the CSC Type B application with NJU agency number 10284 no later than March 17, 2027." },
    { label: "Final decision", body: "CSC conducts final review; an NJU recommendation does not itself guarantee the scholarship." },
  ],
  actionLinks: [
    { label: "Official NJU scholarship guide", url: officialUrl, kind: "official-source" },
    { label: "NJU international application system", url: "https://nju.17gz.org/", kind: "official-application" },
    { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/", kind: "official-application" },
  ],
  deadlineDate: "2027-01-20",
  deadlineLabel: "NJU application deadline: January 20, 2027; shortlisted applicants must submit the CSC application by March 17, 2027.",
  applicationRound: "November 1, 2026 - January 20, 2027",
  summary: "Fully funded 2027 master's and doctoral scholarship route administered through NJU and CSC Type B.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: officialUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    title: "official page title",
    nameZh: "official page title",
    type: "official program description",
    typeLabel: "official page title",
    providerName: "official program and application sections",
    fundingLevel: "full-scholarship coverage section",
    coverage: "full-scholarship coverage section",
    applicableDegree: "admission category section",
    applicableProgram: "official 2027 program catalog link",
    amountText: "full-scholarship coverage section",
    requirementText: "eligibility and language sections",
    benefitItems: "full-scholarship coverage section",
    eligibilityItems: "eligibility and language sections",
    applicationMaterials: "application materials section",
    applicationSteps: "application procedure section",
    deadlineDate: "NJU online application period",
    deadlineLabel: "NJU and CSC application procedure dates",
    applicationRound: "NJU online application period",
    status: "official 2027 guide available at capturedAt",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 75 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The scholarship page links the eligible 2027 program catalog; the scholarship record does not duplicate that catalog as scholarship-specific program rows.",
    "Final award selection is made by CSC and is not guaranteed by NJU pre-admission or recommendation.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-75");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 75,
  candidateSha256,
  counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: 1, sourceSnapshots: 1 },
  publicationAuthorized: false,
}, null, 2));
