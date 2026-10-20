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
const runRoot = resolve(root, "work/catalog-official/2026-10-20-xjtu-belt-road-scholarship");
const sourceId = "xjtu-xian-belt-and-road-scholarship-current";
const expectedSha256 = "caaca081ce78f6fad89d4f93212bd02433df28847832ca74ba05d4a9425929dd";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const source = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked XJTU Belt and Road scholarship evidence.");
const bytes = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("XJTU scholarship evidence hash mismatch.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-08.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "xi-an-jiaotong-university");
const city = dependency.cities?.find((row) => row.slug === "xian");
if (!school || !city) throw new Error("Wave 73 XJTU dependency rows are missing from Wave 08.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const scholarship: CatalogSeedScholarship = {
  slug: "xjtu-xian-city-belt-and-road-scholarship-current",
  title: "XJTU-Xi'an City Government Belt and Road Scholarship",
  nameZh: "西安交通大学—西安市政府“一带一路”外国留学生奖学金",
  schoolSlug: school.slug,
  type: "Government",
  typeLabel: "Municipal government and university scholarship",
  providerName: "Xi'an Municipal Government / Xi'an Jiaotong University",
  fundingLevel: "degree-specific award plus graduate tuition waiver",
  coverage: "Bachelor: RMB 15,000 per year; Master: RMB 20,000 per year; Doctoral: RMB 25,000 per year; eligible non-degree study of six months or longer: RMB 1,000 per month. XJTU additionally states that it covers 100% of tuition for master's and doctoral recipients.",
  applicableDegree: "Bachelor; Master; Doctorate; Non-degree (six months or longer)",
  applicableProgram: "Eligible XJTU programs for citizens of Belt and Road countries",
  amountText: "Bachelor RMB 15,000/year; Master RMB 20,000/year; Doctoral RMB 25,000/year; eligible non-degree RMB 1,000/month; master's and doctoral tuition covered by XJTU.",
  requirementText: "Applicants must be citizens of a Belt and Road country, meet the stated degree and age limits, have HSK 4 or above, and not already hold another scholarship. The award is subject to annual review after enrollment.",
  benefitItems: [
    { label: "Bachelor award", included: true, note: "RMB 15,000 per year" },
    { label: "Master award", included: true, note: "RMB 20,000 per year plus 100% tuition covered by XJTU" },
    { label: "Doctoral award", included: true, note: "RMB 25,000 per year plus 100% tuition covered by XJTU" },
    { label: "Eligible non-degree award", included: true, note: "RMB 1,000 per month for study lasting six months or longer" },
  ],
  eligibilityItems: [
    { label: "Nationality", body: "Citizen of a Belt and Road country" },
    { label: "Age and education", body: "Bachelor applicants: high-school diploma and under 25; master's applicants: bachelor's degree and under 35; doctoral applicants: master's degree and under 40; non-degree applicants: under 45" },
    { label: "Language", body: "HSK 4 or above" },
    { label: "Other funding", body: "Applicants already holding another scholarship are not supported" },
  ],
  actionLinks: [{ label: "Official XJTU scholarship page", url: source.finalUrl ?? source.url, kind: "official-source" }],
  deadlineLabel: "The current official page lists June 30 for bachelor and non-degree applications and April 15 for master and doctoral applications, but does not identify a calendar year; no 2027 deadlineDate is emitted.",
  applicationRound: "Current XJTU scholarship terms; confirm the applicable admission cycle before applying",
  targetRegions: ["Belt and Road countries"],
  summary: "Degree-specific municipal scholarship awards, with additional full tuition coverage by XJTU for master's and doctoral recipients.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official scholarship page title",
    nameZh: "official Chinese scholarship page title",
    type: "official scholarship provider description",
    providerName: "official scholarship provider description",
    fundingLevel: "Scholarship Coverage section",
    coverage: "Scholarship Coverage section",
    applicableDegree: "Supporting Category section",
    applicableProgram: "provider and eligibility sections",
    amountText: "Scholarship Coverage section",
    requirementText: "Eligibility and annual-review sections",
    benefitItems: "Scholarship Coverage section",
    eligibilityItems: "Eligibility section",
    deadlineLabel: "Deadline for application section; year is not published",
    applicationRound: "current-page scope and unresolved admission year",
    targetRegions: "Eligibility section",
    status: "official page available at capturedAt",
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
if (!validation.ok) throw new Error(`2027 wave 73 validation failed:\n${validation.errors.join("\n")}`);

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
    "The official scholarship page publishes recurring month-and-day deadlines without a calendar year. No 2027 deadlineDate is created.",
    "The page does not publish a country list; eligibility remains bounded to the source's Belt and Road country wording.",
    "The current page is used only for scholarship terms and does not establish a 2027 admission intake.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-73");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 73,
  candidateSha256,
  counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: 1, sourceSnapshots: 1 },
  publicationAuthorized: false,
}, null, 2));
