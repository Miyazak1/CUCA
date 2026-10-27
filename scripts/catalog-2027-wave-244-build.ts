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
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const locks = [
  ["work/catalog-official/2026-10-26T06-24-25-620Z", "njau-international-scholarship-index-en-current", "9ad4be16960390d9231df492d73dbce508becca2c32a0edca22236e709345465"],
  ["work/catalog-official/njau-current-scholarships-2026-10-27-government", "njau-nanjing-government-scholarship-current", "69806f97e01342f4f8ff50e345ff9ca2389c228111dafc31c95d5116f45f2cbc"],
  ["work/catalog-official/njau-current-scholarship-pdfs-2026-10-27-government", "njau-nanjing-government-scholarship-pdf-current", "30728c127c9911ba6ccd3b8cc7fbe7bdd2639abebda45769b370c37c23999b41"],
  ["work/catalog-official/njau-current-scholarships-2026-10-27-university", "njau-university-scholarship-current", "43c52217575a65df899545ba99fb00f673a6b1c6299f450f1dba55cf494900b9"],
  ["work/catalog-official/njau-current-scholarship-pdfs-2026-10-27-university", "njau-university-scholarship-pdf-current", "3faad22229a197e989b0e1a40c73826c7419f9be9fdbd4fb56639f2aa2b674f4"],
] as const;

const sources = new Map<string, ManifestSource>();
for (const [run, id, sha256] of locks) {
  const runRoot = resolve(root, run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked official evidence ${id} at ${sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-221.draft.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "nanjing-agricultural-university";
if (prior.schools?.length !== 1 || prior.schools[0]?.slug !== schoolSlug || prior.programs?.length !== 224 || prior.programIntakes?.length !== 72) {
  throw new Error("Wave 244 requires the complete Wave 221 Nanjing Agricultural University candidate.");
}

const governmentPage = sources.get("njau-nanjing-government-scholarship-current")!;
const governmentPdf = sources.get("njau-nanjing-government-scholarship-pdf-current")!;
const universityPage = sources.get("njau-university-scholarship-current")!;
const universityPdf = sources.get("njau-university-scholarship-pdf-current")!;

const commonEligibility = [
  { label: "Nationality", value: "Citizen of a country other than China with valid identification" },
  { label: "Chinese-taught route", value: "HSK Level 5 or above" },
  { label: "English-taught route", value: "English-speaking-country background, at least one year of relevant experience in an English-speaking country, IELTS 6 or TOEFL 80 or above" },
  { label: "Academic standing", value: "Excellent academic performance and the requirements of the applied major" },
  { label: "Other funding", value: "Must not already hold another scholarship from another scholarship committee for the application year" },
];

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "nanjing-agricultural-university-nanjing-government-scholarship-current",
    title: "Nanjing Government Scholarship for International Students at Nanjing Agricultural University",
    nameZh: "南京市政府外国留学生奖学金（南京农业大学）",
    schoolSlug,
    type: "government",
    typeLabel: "Nanjing Government Scholarship",
    providerName: "南京市政府 / 南京农业大学",
    providerNameEn: "Nanjing Municipal Government / Nanjing Agricultural University",
    providerLocation: "Nanjing, Jiangsu, China",
    fundingLevel: "Partial scholarship",
    coverage: "One-year award of CNY 10,000 for bachelor students or CNY 20,000 for master and doctoral students; visiting students receive CNY 5,000 for half a year. For designated joint scholarship degree programs, it may be combined with the university scholarship to cover that academic year's tuition.",
    applicableDegree: "Bachelor; Master; Doctoral; Visiting",
    applicableProgram: "Available programs at Nanjing Agricultural University, subject to the scholarship review for the relevant application year.",
    amountText: "Bachelor: CNY 10,000 for one year; Master and Doctoral: CNY 20,000 for one year; Visiting: CNY 5,000 for half a year.",
    requirementText: "Non-Chinese citizens with valid identification, the required prior degree, published age limit, language evidence, strong academic performance and a complete application. Applicants must not hold another scholarship from another scholarship committee for the application year.",
    benefitItems: [
      { label: "Bachelor award", included: true, note: "CNY 10,000 for one year" },
      { label: "Master and doctoral award", included: true, note: "CNY 20,000 for one year" },
      { label: "Visiting student award", included: true, note: "CNY 5,000 for half a year" },
    ],
    eligibilityItems: [
      ...commonEligibility,
      { label: "Bachelor applicant", value: "High-school graduate, in good health and under age 25" },
      { label: "Master applicant", value: "Bachelor's degree, in good health and under age 35" },
      { label: "Doctoral applicant", value: "Master's degree, in good health and under age 40" },
      { label: "General or senior scholar", value: "General scholar under age 40; senior scholar with a master's degree or associate professorship under age 50" },
    ],
    applicationSteps: [
      { label: "Choose a route", value: "Select an available Nanjing Agricultural University program" },
      { label: "Supervisor", value: "Where applicable, obtain a provisional acceptance letter from a suitable supervisor" },
      { label: "Apply", value: "Prepare the published materials and submit them through the university application system" },
    ],
    actionLinks: [
      { label: "Official scholarship page", url: governmentPage.finalUrl ?? governmentPage.url, kind: "official-source" },
      { label: "Official scholarship PDF", url: governmentPdf.finalUrl ?? governmentPdf.url, kind: "official-source" },
    ],
    deadlineLabel: "The current policy requires submission by the deadline announced for the relevant application year; it does not publish a standalone current deadline.",
    summary: "Current official partial scholarship policy for international bachelor, graduate and visiting students at Nanjing Agricultural University.",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: governmentPdf.fetchedAt,
    ...sourceFields(governmentPdf),
    sourceFieldLineage: {
      title: "official scholarship PDF title",
      fundingLevel: "official Funding Policy section",
      coverage: "official Funding Policy table and joint-scholarship note",
      applicableDegree: "official Funding Policy and eligibility sections",
      amountText: "official Funding Policy table",
      requirementText: "official Application Eligibility section",
      benefitItems: "official Funding Policy table",
      eligibilityItems: "official Application Eligibility section",
      applicationSteps: "official Application Procedure section",
      actionLinks: "captured official page and embedded PDF",
      deadlineLabel: "official Application Deadline section; numeric date absent",
      summary: "official scholarship scope and funding policy",
    },
  },
  {
    slug: "nanjing-agricultural-university-scholarship-current",
    title: "Nanjing Agricultural University Scholarship for International Students",
    nameZh: "南京农业大学外国留学生奖学金",
    schoolSlug,
    type: "university",
    typeLabel: "University Scholarship",
    providerName: "南京农业大学",
    providerNameEn: "Nanjing Agricultural University",
    providerLocation: "Nanjing, Jiangsu, China",
    fundingLevel: "Full or partial scholarship",
    coverage: "Full scholarship: tuition waiver, CNY 10,000 annual accommodation subsidy, CNY 1,500 monthly stipend and comprehensive medical insurance. Partial scholarship: tuition waiver.",
    applicableDegree: "Master; Doctoral",
    applicableProgram: "Graduate programs at Nanjing Agricultural University.",
    amountText: "Full: CNY 10,000/year accommodation subsidy and CNY 1,500/month stipend, plus tuition waiver and insurance; Partial: tuition waiver.",
    requirementText: "Non-Chinese citizens with valid identification. Master's applicants need a bachelor's degree and must be under 35; doctoral applicants need a master's degree and must be under 40. Published language and academic requirements also apply.",
    benefitItems: [
      { label: "Tuition", included: true, note: "Waived under full and partial awards" },
      { label: "Accommodation", included: true, note: "Full award: CNY 10,000/year subsidy" },
      { label: "Living stipend", included: true, note: "Full award: CNY 1,500/month" },
      { label: "Medical insurance", included: true, note: "Full award: comprehensive medical insurance" },
    ],
    eligibilityItems: [
      ...commonEligibility,
      { label: "Master applicant", value: "Bachelor's degree, in good health and under age 35" },
      { label: "Doctoral applicant", value: "Master's degree, in good health and under age 40" },
    ],
    applicationSteps: [
      { label: "Choose a route", value: "Select an available graduate program" },
      { label: "Supervisor", value: "Obtain a provisional acceptance letter from a suitable supervisor" },
      { label: "Apply", value: "Prepare the published materials and submit them through the university application system" },
    ],
    actionLinks: [
      { label: "Official scholarship page", url: universityPage.finalUrl ?? universityPage.url, kind: "official-source" },
      { label: "Official scholarship PDF", url: universityPdf.finalUrl ?? universityPdf.url, kind: "official-source" },
    ],
    deadlineLabel: "The current policy requires submission by the deadline announced for the relevant application year; it does not publish a standalone current deadline.",
    summary: "Current official university scholarship policy for eligible international master's and doctoral applicants.",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: universityPdf.fetchedAt,
    ...sourceFields(universityPdf),
    sourceFieldLineage: {
      title: "official scholarship PDF title",
      fundingLevel: "official Funding Policy section",
      coverage: "official Funding Policy section",
      applicableDegree: "official Programme Description and eligibility sections",
      applicableProgram: "official Programme Description",
      amountText: "official Funding Policy section",
      requirementText: "official Application Eligibility section",
      benefitItems: "official Funding Policy section",
      eligibilityItems: "official Application Eligibility section",
      applicationSteps: "official Application Procedure section",
      actionLinks: "captured official page and embedded PDF",
      deadlineLabel: "official Application Deadline section; numeric date absent",
      summary: "official scholarship scope and funding policy",
    },
  },
];

const candidate: CatalogSeedBundle = {
  ...prior,
  generatedAt: universityPdf.fetchedAt,
  scholarships,
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 244 validation failed:\n${validation.errors.join("\n")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 55, schoolSlugs: [schoolSlug], programs: 224, programIntakes: 72, scholarships: 2 },
  evidence: locks.map(([, id]) => {
    const source = sources.get(id)!;
    return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
  }),
  unresolved: [
    "Both scholarship PDFs describe standing policy and require applicants to use the deadline announced for the relevant application year. Neither publishes a standalone current numeric deadline, so deadlineDate remains absent.",
    "The university scholarship PDF states that it supports graduate programs; it is not generalized to undergraduate routes.",
    "The 2027 CSC-NAU High-level Graduate Students Program remains listed on the official index but its details are hosted in an external WeChat article unavailable to the registered collector. No CSC coverage or deadline is inferred from the title alone.",
    "Wave 221 limitations for current graduate program duration, language, tuition and intake remain unchanged.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Personal contacts and applicant document contents are excluded; only public institutional scholarship policy is structured." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-244");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 244, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
