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
const runRoot = resolve(root, "work/catalog-official/2026-10-20-bnu-current-scholarships");
const lockedSources = new Map([
  ["bnu-new-student-scholarship", "798be39fc0010474e4958cb314f60233635917fe48578613bfad7bedb91ab729"],
  ["bnu-silk-road-muduo-scholarship", "a9343f7d2174d876ed25e7092a2aee621044fe2ae583cd88fdc5c03add5cf256"],
  ["bnu-beijing-government-scholarship", "f850dc3a64e86d14f74e87fe4308ed2d7099c58e3c99240c82ac79a0eda1ce94"],
]);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const sources = new Map<string, ManifestSource>();
for (const [id, expectedSha256] of lockedSources) {
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked BNU scholarship evidence: ${id}.`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`BNU scholarship evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-09.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "beijing-normal-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 74 BNU dependency rows are missing from Wave 09.");

type ScholarshipInput = {
  sourceId: string;
  slug: string;
  title: string;
  nameZh: string;
  type: string;
  typeLabel: string;
  providerName: string;
  fundingLevel: string;
  coverage: string;
  applicableDegree: string;
  applicableProgram: string;
  amountText: string;
  requirementText: string;
  benefits: Array<{ label: string; note?: string }>;
  eligibility: Array<{ label: string; body: string }>;
  targetRegions?: string[];
};

const makeScholarship = (input: ScholarshipInput): CatalogSeedScholarship => {
  const source = sources.get(input.sourceId)!;
  const officialUrl = source.finalUrl ?? source.url;
  return {
    slug: input.slug,
    title: input.title,
    nameZh: input.nameZh,
    schoolSlug: school.slug,
    type: input.type,
    typeLabel: input.typeLabel,
    providerName: input.providerName,
    fundingLevel: input.fundingLevel,
    coverage: input.coverage,
    applicableDegree: input.applicableDegree,
    applicableProgram: input.applicableProgram,
    amountText: input.amountText,
    requirementText: input.requirementText,
    benefitItems: input.benefits.map((item) => ({ included: true, ...item })),
    eligibilityItems: input.eligibility,
    applicationSteps: [
      { label: "Apply", body: "Apply through the BNU International Student Online Application System and select the scholarship where the application form offers that option." },
      { label: "Submit materials", body: "Submit the materials required by the latest BNU admission brochure for the chosen degree route." },
      { label: "Review", body: "BNU reviews scholarship eligibility after admission review; continued funding is subject to the published annual assessment." },
    ],
    actionLinks: [{ label: "Official BNU scholarship page", url: officialUrl, kind: "official-source" }],
    deadlineLabel: "The official scholarship page directs applicants to the latest BNU admission brochure and does not publish a fixed calendar-year deadline; no 2027 deadlineDate is emitted.",
    applicationRound: "Current BNU scholarship terms; confirm the applicable 2027 admission brochure before applying",
    targetRegions: input.targetRegions ?? [],
    summary: `${input.title} under BNU's current published scholarship terms.`,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: officialUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      title: "official scholarship title",
      nameZh: "official scholarship title",
      type: "official provider and scheme description",
      typeLabel: "official provider and scheme description",
      providerName: "official provider description",
      fundingLevel: "official scholarship coverage section",
      coverage: "official scholarship coverage section",
      applicableDegree: "official eligibility section",
      applicableProgram: "official eligibility and application sections",
      amountText: "official scholarship coverage section; no fixed cash amount is published",
      requirementText: "official eligibility section",
      benefitItems: "official scholarship coverage section",
      eligibilityItems: "official eligibility section",
      applicationSteps: "official application and annual-review sections",
      deadlineLabel: "official deadline section refers to the latest admission brochure",
      applicationRound: "current-page scope and unresolved admission year",
      targetRegions: "official eligibility section",
      status: "official page available at capturedAt",
    },
  };
};

const scholarships: CatalogSeedScholarship[] = [
  makeScholarship({
    sourceId: "bnu-new-student-scholarship",
    slug: "bnu-international-new-student-scholarship-current",
    title: "BNU International New Student Scholarship",
    nameZh: "北京师范大学留学生新生奖学金",
    type: "University",
    typeLabel: "University scholarship",
    providerName: "Beijing Normal University",
    fundingLevel: "Tuition, living allowance and comprehensive insurance",
    coverage: "Tuition waiver, living allowance during the standard study period, and comprehensive insurance for international students.",
    applicableDegree: "Bachelor; Master; Doctorate",
    applicableProgram: "Eligible BNU degree programs",
    amountText: "Tuition waiver, living allowance and comprehensive insurance; the official page does not publish a fixed cash amount.",
    requirementText: "Applicants must be non-Chinese citizens in good health, have strong conduct and academic or entrance-examination performance, be newly admitted for degree study in the current year, and hold no other scholarship or institutional funding.",
    benefits: [{ label: "Tuition waiver" }, { label: "Living allowance" }, { label: "Comprehensive insurance" }],
    eligibility: [
      { label: "Nationality and health", body: "Non-Chinese citizen in good health and friendly to China" },
      { label: "Academic merit", body: "Strong entrance-examination performance for bachelor applicants or strong prior academic and research background for graduate applicants" },
      { label: "Admission status", body: "Newly admitted BNU international degree student beginning study in the current year" },
      { label: "Other funding", body: "No other scholarship or funding from a government, department or organization" },
    ],
  }),
  makeScholarship({
    sourceId: "bnu-silk-road-muduo-scholarship",
    slug: "bnu-silk-road-muduo-degree-scholarship-current",
    title: "BNU Silk Road Muduo Degree Scholarship",
    nameZh: "北京师范大学丝路木铎学历生奖学金",
    type: "University",
    typeLabel: "Belt and Road university scholarship",
    providerName: "Beijing Normal University",
    fundingLevel: "Tuition, living allowance and comprehensive medical insurance",
    coverage: "Tuition waiver, living allowance during the standard study period, and comprehensive medical insurance.",
    applicableDegree: "Bachelor; Master; Doctorate",
    applicableProgram: "Eligible BNU degree programs for students from Belt and Road countries",
    amountText: "Tuition waiver, living allowance and comprehensive medical insurance; the official page does not publish a fixed cash amount.",
    requirementText: "Applicants must be non-Chinese citizens from Belt and Road countries, have strong conduct and academic or entrance-examination performance, be newly admitted for degree study in the current year, and hold no other scholarship or institutional funding.",
    benefits: [{ label: "Tuition waiver" }, { label: "Living allowance" }, { label: "Comprehensive medical insurance" }],
    eligibility: [
      { label: "Nationality and region", body: "Non-Chinese citizen from a Belt and Road country" },
      { label: "Academic merit", body: "Strong entrance-examination performance for bachelor applicants or strong prior academic and research background for graduate applicants" },
      { label: "Admission status", body: "Newly admitted BNU international degree student beginning study in the current year" },
      { label: "Other funding", body: "No other scholarship or funding from a government, department or organization" },
    ],
    targetRegions: ["Belt and Road countries"],
  }),
  makeScholarship({
    sourceId: "bnu-beijing-government-scholarship",
    slug: "bnu-beijing-government-scholarship-current",
    title: "BNU Beijing Government Scholarship for International Students",
    nameZh: "北京师范大学北京来华留学生政府奖学金",
    type: "Government",
    typeLabel: "Municipal government scholarship",
    providerName: "Beijing Municipal Government",
    fundingLevel: "Category A, B or C",
    coverage: "Category A covers tuition, accommodation, living allowance and comprehensive medical insurance; Category B covers tuition, accommodation and insurance; Category C covers tuition and insurance.",
    applicableDegree: "Bachelor; Master; Doctorate; Non-degree",
    applicableProgram: "Eligible BNU international degree and non-degree programs",
    amountText: "Category-based tuition, accommodation, living allowance and/or insurance coverage; the official page does not publish fixed cash amounts.",
    requirementText: "Applicants must be non-Chinese citizens in good physical and mental health, be newly admitted for the current year, meet the degree-specific age limit, and not concurrently hold another Chinese government or social-organization scholarship.",
    benefits: [
      { label: "Category A", note: "Tuition, accommodation, living allowance and comprehensive medical insurance" },
      { label: "Category B", note: "Tuition, accommodation and comprehensive medical insurance" },
      { label: "Category C", note: "Tuition and comprehensive medical insurance" },
    ],
    eligibility: [
      { label: "Nationality and health", body: "Non-Chinese citizen in good physical and mental health" },
      { label: "Admission status", body: "Newly admitted BNU international student beginning study in the current year" },
      { label: "Age", body: "Bachelor no older than 25; master no older than 35; doctorate no older than 40; non-degree no older than 45 with the stated education background" },
      { label: "Other funding", body: "Cannot concurrently hold another scholarship established by a Chinese government level or social organization" },
    ],
  }),
];

const capturedAt = [...sources.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: capturedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 74 validation failed:\n${validation.errors.join("\n")}`);

const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: capturedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.length },
  evidence,
  unresolved: [
    "The three official scholarship pages do not publish a calendar-year deadline. No 2027 deadlineDate is created.",
    "The pages do not publish fixed living-allowance or category cash amounts.",
    "The Silk Road Muduo page does not publish a country list; eligibility remains bounded to the source's Belt and Road country wording.",
    "These current pages establish scholarship terms only and do not establish a 2027 admission intake.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-74");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 74,
  candidateSha256,
  counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: evidence.length },
  publicationAuthorized: false,
}, null, 2));
