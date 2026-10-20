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
const runRoot = resolve(root, "work/catalog-official/2026-10-20-pku-current-scholarships");
const lockedSources = new Map([
  ["pku-international-student-scholarship-current", "9841a20e5241ed2f7211d9f2ec8b9ec53fceb037d0123a87851da3cf7fa9d324"],
  ["pku-advanced-graduate-scholarship-current", "e62e5d91fbed3e898717ca68182db87c7be17117cd899ada0e891eaa53135027"],
]);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const sources = new Map<string, ManifestSource>();
for (const [id, expectedSha256] of lockedSources) {
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked PKU scholarship evidence: ${id}.`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`PKU scholarship evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-04.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "peking-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 76 PKU dependency rows are missing from Wave 04.");

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
  durationText: string;
  benefits: Array<{ label: string; note?: string }>;
  eligibility: Array<{ label: string; body: string }>;
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
    bodySections: [
      { title: "Scholarship duration", body: input.durationText },
      { title: "Annual review", body: "The award is renewable only when the recipient participates in and passes the annual scholarship review." },
    ],
    benefitItems: input.benefits.map((item) => ({ included: true, ...item })),
    eligibilityItems: input.eligibility,
    applicationSteps: [
      { label: "Program application", body: "Submit a full-time program application that meets Peking University's international student admission requirements." },
      { label: "Scholarship application", body: "Submit the scholarship application in the Peking University International Student Service System during the applicable notice window." },
      ...(input.sourceId === "pku-advanced-graduate-scholarship-current"
        ? [{ label: "CSC application", body: "Also submit the Chinese Government Scholarship application through the China Scholarship Council system according to the applicable annual notice." }]
        : []),
      { label: "Selection", body: "The scholarship committee evaluates applications and Peking University notifies successful recipients by email." },
    ],
    actionLinks: [
      { label: "Official PKU scholarship page", url: officialUrl, kind: "official-source" },
      { label: "PKU international application system", url: "https://www.studyatpku.com/", kind: "official-application" },
      ...(input.sourceId === "pku-advanced-graduate-scholarship-current"
        ? [{ label: "CSC scholarship information", url: "https://www.campuschina.org/", kind: "official-application" }]
        : []),
    ],
    deadlineLabel: "The current official page states that applications are generally accepted from January to March each year but does not publish a 2027 date; no deadlineDate is emitted.",
    applicationRound: "Generally January-March; confirm the annual PKU scholarship notice before applying",
    summary: `${input.title} under Peking University's current published scholarship terms.`,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: officialUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      title: "official scholarship page title",
      nameZh: "translated official scholarship title",
      type: "official provider and program description",
      typeLabel: "official scholarship page title",
      providerName: "official provider and program description",
      fundingLevel: "official scholarship scope",
      coverage: "official scholarship scope",
      applicableDegree: "official scholarship duration and eligibility sections",
      applicableProgram: "official eligibility section",
      amountText: "official scholarship scope; no fixed cash amount is published",
      requirementText: "official eligibility section",
      bodySections: "official duration and annual-review sections",
      benefitItems: "official scholarship scope",
      eligibilityItems: "official eligibility section",
      applicationSteps: "official application and selection sections",
      deadlineLabel: "official application-time section without calendar-year dates",
      applicationRound: "official recurring application-time section",
      status: "official page available at capturedAt",
    },
  };
};

const scholarships: CatalogSeedScholarship[] = [
  makeScholarship({
    sourceId: "pku-international-student-scholarship-current",
    slug: "peking-university-scholarship-for-international-students-current",
    title: "Peking University Scholarship for International Students",
    nameZh: "北京大学外国留学生奖学金",
    type: "University",
    typeLabel: "University scholarship",
    providerName: "Peking University",
    fundingLevel: "Tuition, living stipend and medical insurance",
    coverage: "Tuition, a living stipend, and medical insurance.",
    applicableDegree: "Bachelor; Master; Doctorate",
    applicableProgram: "Eligible full-time self-funded Peking University degree programs for international students",
    amountText: "Tuition, living stipend and medical insurance; the official page does not publish fixed cash amounts.",
    requirementText: "Applicants must meet the applicable PKU international student admission requirements, have submitted a full-time self-funded degree application, and hold no other scholarship funding.",
    durationText: "Bachelor: four years; master: two to three years; doctorate: four years.",
    benefits: [{ label: "Tuition" }, { label: "Living stipend" }, { label: "Medical insurance" }],
    eligibility: [
      { label: "Admission requirements", body: "Meet the applicable Peking University international student admission requirements" },
      { label: "Program application", body: "Successfully submit a full-time self-funded international degree application" },
      { label: "Other funding", body: "No other scholarship funding" },
    ],
  }),
  makeScholarship({
    sourceId: "pku-advanced-graduate-scholarship-current",
    slug: "peking-university-cgs-advanced-graduate-program-current",
    title: "Peking University Chinese Government Scholarship Advanced Graduate Program",
    nameZh: "北京大学中国政府奖学金高水平研究生项目",
    type: "Government",
    typeLabel: "Chinese Government Scholarship",
    providerName: "China Scholarship Council / Peking University",
    fundingLevel: "Full or partial scholarship",
    coverage: "Full or partial tuition waiver, living stipend, housing, and medical insurance.",
    applicableDegree: "Master; Doctorate",
    applicableProgram: "Eligible full-time self-funded Peking University graduate programs for international students",
    amountText: "Full or partial tuition waiver, living stipend, housing and medical insurance; the official page does not publish fixed cash amounts.",
    requirementText: "Applicants must meet PKU international graduate admission requirements, have submitted a full-time self-funded graduate application, not hold another Chinese-government or PKU scholarship other than a one-time non-renewable merit award, and not be in a joint-training program.",
    durationText: "Master: two to three years; doctorate: four to five years.",
    benefits: [{ label: "Full or partial tuition waiver" }, { label: "Living stipend" }, { label: "Housing" }, { label: "Medical insurance" }],
    eligibility: [
      { label: "Admission requirements", body: "Meet the applicable Peking University international graduate admission requirements" },
      { label: "Program application", body: "Successfully submit a full-time self-funded international graduate application" },
      { label: "Other funding", body: "No other Chinese-government or PKU scholarship, except a one-time non-renewable merit award" },
      { label: "Study arrangement", body: "Not a candidate in a joint-training program" },
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
if (!validation.ok) throw new Error(`2027 wave 76 validation failed:\n${validation.errors.join("\n")}`);

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
    "The current official pages publish only a recurring January-March application window and do not publish a 2027 deadline. No deadlineDate is created.",
    "The pages do not publish fixed living-stipend or insurance amounts.",
    "The Advanced Graduate Program may award full or partial funding; the award level is not inferred.",
    "These current pages establish scholarship terms only and do not establish a 2027 admission intake.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-76");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 76,
  candidateSha256,
  counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: evidence.length },
  publicationAuthorized: false,
}, null, 2));
