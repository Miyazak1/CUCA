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
const expectedHashes = new Map([
  ["gdufs-guangdong-government-scholarship-current", "903136c29a4c70b2651d0aa50bbc383ce7a46e144139c05b9c621b6fd4353770"],
  ["gdufs-international-student-scholarship-current", "5f5105486088f45a658c4a6b61656b4028fbde5ec66bdc19c61134e3b39f53fd"],
]);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const sources = new Map<string, ManifestSource>();
for (const [id, expectedSha256] of expectedHashes) {
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked GDUFS scholarship evidence: ${id}.`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`GDUFS scholarship evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "guangdong-university-of-foreign-studies";
const school = dependency.schools?.find((row) => row.slug === schoolSlug);
const city = dependency.cities?.find((row) => row.slug === "guangzhou");
if (!school || !city) throw new Error("Wave 78 GDUFS school or Guangzhou dependency row is missing.");

const fields = (id: string) => {
  const source = sources.get(id)!;
  return {
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    lastVerifiedAt: source.fetchedAt,
  };
};

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "gdufs-guangdong-government-outstanding-international-student-scholarship",
    schoolSlug,
    title: "Guangdong Government Outstanding International Student Scholarship at GDUFS",
    nameZh: "广东省政府来粤留学生奖学金",
    type: "government",
    typeLabel: "Provincial government scholarship",
    providerName: "广东省政府 / 广东外语外贸大学",
    providerNameEn: "Guangdong Provincial Government / Guangdong University of Foreign Studies",
    providerLocation: "Guangzhou, Guangdong, China",
    fundingLevel: "Partial",
    coverage: "One-time award by degree level.",
    applicableDegree: "Undergraduate, Master, Doctoral",
    applicableProgram: "Eligible new or current international degree students at GDUFS.",
    amountText: "Undergraduate CNY 10,000; master's CNY 20,000; doctoral CNY 30,000 per recipient.",
    deadlineLabel: "Recurring annual application window: May 1-June 30. No cycle-specific 2027 deadline is published on the current page.",
    applicationRound: "Annual Guangdong Government scholarship application",
    benefitItems: [{ label: "One-time award", included: true, note: "CNY 10,000 undergraduate; CNY 20,000 master; CNY 30,000 doctoral" }],
    eligibilityItems: [
      { label: "Applicant type", value: "Eligible new or current international undergraduate, master's or doctoral student at GDUFS" },
      { label: "Academic and conduct standing", value: "Excellent academic performance, conduct and attendance under the published new- or current-student rules" },
      { label: "Other funding", value: "Must not receive a Chinese Government or another scholarship in the same application year" },
    ],
    applicationMaterials: [{ label: "Application form", value: "Use the separate official form for new or current students and provide the supporting materials required by that form" }],
    applicationSteps: [
      { label: "Step 1", value: "Complete the applicable new-student or current-student form" },
      { label: "Step 2", value: "Submit the complete application during the recurring May 1-June 30 window" },
      { label: "Step 3", value: "GDUFS reviews and nominates candidates for final provincial review" },
    ],
    actionLinks: [{ label: "Official GDUFS scholarship page", url: fields("gdufs-guangdong-government-scholarship-current").sourceUrl, kind: "official-source" }],
    summary: "Recurring provincial scholarship for eligible new and current GDUFS degree students; the official page does not assign the annual window to a specific 2027 cycle.",
    status: "active",
    verificationStatus: "verified",
    ...fields("gdufs-guangdong-government-scholarship-current"),
    sourceFieldLineage: {
      title: "official page title",
      coverage: "section 3 award amounts",
      applicableDegree: "section 1 applicant scope",
      amountText: "section 3 award amounts",
      deadlineLabel: "section 4 recurring annual application procedure",
      eligibilityItems: "section 2 requirements",
      applicationMaterials: "section 4 application procedure",
      applicationSteps: "section 4 application procedure",
    },
  },
  {
    slug: "gdufs-international-student-scholarship-current",
    schoolSlug,
    title: "GDUFS International Student Scholarship",
    nameZh: "广东外语外贸大学来华留学生奖学金",
    type: "university",
    typeLabel: "University scholarship",
    providerName: "广东外语外贸大学",
    providerNameEn: "Guangdong University of Foreign Studies",
    providerLocation: "Guangzhou, Guangdong, China",
    fundingLevel: "Full or partial tuition",
    coverage: "Four published categories cover new and current degree students and new and current Chinese-language students. Full awards waive the applicable first or next academic period's tuition; half awards waive 50%.",
    applicableDegree: "Undergraduate, Master, Doctoral and non-degree Chinese language study",
    applicableProgram: "Eligible new or current international degree students and Chinese-language students at GDUFS.",
    amountText: "Degree-student categories: full or 50% tuition for the first or next academic year. Chinese-language categories: full or 50% tuition for the first or next semester.",
    deadlineLabel: "Recurring annual application window: May 1-June 30. No cycle-specific 2027 deadline is published on the current page.",
    applicationRound: "Annual GDUFS international student scholarship application",
    benefitItems: [
      { label: "New degree student", included: true, note: "Full or 50% tuition waiver for the first academic year" },
      { label: "Current degree student", included: true, note: "Full or 50% tuition waiver for the next academic year" },
      { label: "New Chinese-language student", included: true, note: "Full or 50% tuition waiver for the first semester" },
      { label: "Current Chinese-language student", included: true, note: "Full or 50% tuition waiver for the next semester" },
    ],
    eligibilityItems: [
      { label: "Degree applicants", value: "Meet the published academic, conduct and selected program language requirements" },
      { label: "Current degree students", value: "Complete the prior year's credits, average at least 90, score at least 80 in each course, rank in the top 30% and maintain at least 90% attendance" },
      { label: "Chinese-language students", value: "Study for at least one year; current students must continue next semester, rank in the top 30% and maintain at least 90% attendance" },
      { label: "Other funding", value: "Must not hold a Chinese Government or another scholarship" },
    ],
    applicationMaterials: [
      { label: "New students", value: "Scholarship form, complete admission materials and recommendation letter" },
      { label: "Current students", value: "Scholarship form and prior academic transcript" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Select the applicable degree-student or Chinese-language-student category" },
      { label: "Step 2", value: "Submit the published materials during the recurring May 1-June 30 window" },
      { label: "Step 3", value: "GDUFS conducts a comprehensive review and normally announces results by the end of August" },
    ],
    actionLinks: [{ label: "Official GDUFS scholarship page", url: fields("gdufs-international-student-scholarship-current").sourceUrl, kind: "official-source" }],
    summary: "Current GDUFS tuition-waiver scholarship covering four new- and current-student categories; no fixed 2027 deadline is inferred.",
    status: "active",
    verificationStatus: "verified",
    ...fields("gdufs-international-student-scholarship-current"),
    sourceFieldLineage: {
      title: "official page heading and introduction",
      coverage: "four scholarship-standard sections",
      applicableDegree: "four published student categories",
      amountText: "four scholarship-standard sections",
      deadlineLabel: "four recurring annual application procedures",
      eligibilityItems: "category-specific application conditions",
      applicationMaterials: "category-specific application procedures",
      applicationSteps: "category-specific application procedures",
    },
  },
];

const capturedAt = [...sources.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt: capturedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 78 validation failed:\n${validation.errors.join("\n")}`);

const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: capturedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.length },
  evidence,
  unresolved: [
    "Both official pages publish recurring annual May 1-June 30 windows without assigning them to a specific 2027 cycle; deadlineDate is therefore absent.",
    "The pages do not establish 2027 quotas or recipient counts.",
  ],
  notes: [
    "The provincial award amounts and all four GDUFS tuition-waiver categories were re-confirmed against the October 20 official snapshots.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-78");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 78, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
