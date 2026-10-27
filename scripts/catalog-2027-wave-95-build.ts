import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

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
const schoolSlug = "tianjin-university-of-finance-and-economics";
const sourceId = "tjufe-cgs-high-level-graduate-2027";
const manifestPath = resolve(root, "work/catalog-official/2026-10-26T02-07-19-386Z/manifest.json");
const dependencyPath = resolve(root, "seeds/catalog.2027-release.reviewed.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200);
if (!source) throw new Error(`Missing successful official source ${sourceId}.`);
const artifact = await readFile(resolve(root, "work/catalog-official/2026-10-26T02-07-19-386Z", source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Artifact hash mismatch for ${sourceId}.`);

const dependency = JSON.parse(await readFile(dependencyPath, "utf8")) as CatalogSeedBundle;
const baseSchool = dependency.schools?.find((row) => row.slug === schoolSlug);
const city = dependency.cities?.find((row) => row.slug === baseSchool?.citySlug);
if (!baseSchool || !city) throw new Error("TUFE school or city dependency is missing.");
if (dependency.scholarships?.some((row) => row.slug === sourceId)) throw new Error(`Scholarship ${sourceId} already exists in the reviewed release.`);

const sourceUrl = source.finalUrl ?? source.url;
const school = {
  ...baseSchool,
  languageRequirement: "Reviewed undergraduate routes require Level IV or above under the Chinese Language Proficiency Scales. The 2027 High-Level Graduate scholarship requires HSK Level 5; applicants below 180 points complete an additional Chinese preparatory year.",
  hskRequirement: "Undergraduate self-funded routes require Level IV or above. The 2027 High-Level Graduate scholarship requires HSK Level 5; applicants below 180 points complete an additional Chinese preparatory year before major study.",
  deadlineSummary: "The 2027 Chinese Government Scholarship High-Level Graduate Program accepts the TUFE application from November 1, 2026 through February 20, 2027 and the CSC application from January 1 through February 20, 2027. General 2027 self-funded degree deadlines remain unconfirmed.",
  admissionsUrl: "https://inter.tjufe.edu.cn/zsxx1.htm",
  campusHighlights: Array.from(new Set([...(baseSchool.campusHighlights ?? []), "2027 Chinese Government Scholarship High-Level Graduate route"])),
  contactNotes: "The official International Education College published current undergraduate, master's, Chinese-language and associate-to-bachelor guides on October 20-21, 2026. Those general guides do not state an intake year, so they are not relabelled as 2027. The separately titled 2027 High-Level Graduate scholarship is verified. General 2027 self-funded and doctoral routes remain unresolved.",
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  lastVerifiedAt: source.fetchedAt,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    languageRequirement: "2027 High-Level Graduate guide, eligibility and language-preparation rule",
    hskRequirement: "2027 High-Level Graduate guide, eligibility and language-preparation rule",
    deadlineSummary: "2027 High-Level Graduate guide, application timeline",
    admissionsUrl: "current official International Education College admissions index",
    campusHighlights: "2027 High-Level Graduate guide title and scope",
    contactNotes: "October 20-21, 2026 official admissions index and source-bounded year review",
  },
};

const scholarship = {
  slug: sourceId,
  schoolSlug,
  title: "Chinese Government Scholarship High-Level Graduate Program at TUFE — 2027",
  nameZh: "天津财经大学2027年中国政府奖学金高水平研究生项目",
  type: "government" as const,
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "国家留学基金管理委员会 / 天津财经大学",
  providerNameEn: "China Scholarship Council / Tianjin University of Finance and Economics",
  providerLocation: "Tianjin, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and a monthly living allowance.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Eligible Chinese-taught graduate programs published by TUFE for this scholarship; the attachment-level program list remains unresolved until separately registered and captured.",
  amountText: "Monthly stipend: CNY 3,000 for master's students and CNY 3,500 for doctoral students.",
  deadlineDate: "2027-02-20",
  deadlineLabel: "TUFE system: November 1, 2026-February 20, 2027; CSC system: January 1-February 20, 2027.",
  applicationRound: "2027 Chinese Government Scholarship High-Level Graduate Program",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "On-campus accommodation covered" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance covered" },
    { label: "Living allowance", included: true, note: "Master CNY 3,000/month; doctoral CNY 3,500/month" },
  ],
  eligibilityItems: [
    { label: "Nationality and health", value: "Non-Chinese citizen in good physical and mental health" },
    { label: "Master's applicants", value: "Bachelor's degree holder under age 35" },
    { label: "Doctoral applicants", value: "Master's degree holder under age 40" },
    { label: "Language", value: "HSK Level 5; applicants below 180 points complete an additional Chinese preparatory year" },
    { label: "Academic assessment", value: "Pass the written and interview assessments organized by the relevant TUFE department" },
  ],
  applicationMaterials: [
    { label: "Core identity and education", value: "CSC form, passport, notarized highest diploma and academic transcripts" },
    { label: "Academic plan and recommendations", value: "Study plan of at least 1,000 words and two professor or associate-professor recommendation letters" },
    { label: "Language and health", value: "Valid HSK result and Foreigner Physical Examination Form" },
    { label: "Conditional evidence", value: "Pre-admission document, non-criminal record and any program-specific supporting material required by TUFE or CSC" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Submit the TUFE International Student Service System application by February 20, 2027" },
    { label: "Step 2", value: "Submit the CSC Type B application using TUFE organization code 10070 by February 20, 2027" },
    { label: "Step 3", value: "Complete departmental written and interview assessment and await university nomination and CSC review" },
  ],
  actionLinks: [{ label: "Official 2027 TUFE scholarship guide", url: sourceUrl, kind: "official-source" as const }],
  summary: "Explicit 2027 full-scholarship route for Chinese-taught master's and doctoral study at TUFE, with dual-system application and a February 20, 2027 deadline.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  lastVerifiedAt: source.fetchedAt,
  sourceFieldLineage: {
    title: "official page title",
    coverage: "section II scholarship coverage",
    applicableDegree: "section II duration and section III degree eligibility",
    applicableProgram: "guide scope; attachment-specific program list intentionally unresolved",
    amountText: "section II living-expense standards",
    deadlineDate: "section VII application timeline",
    eligibilityItems: "section III eligibility and language-preparation rule",
    applicationMaterials: "section V materials",
    applicationSteps: "sections IV and VII procedures and timeline",
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
if (!validation.ok) throw new Error(`2027 Wave 95 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedSchools: 1, scholarships: 1, programs: 0, programIntakes: 0 },
  evidence: [{ id: source.id, label: source.label, url: sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The current general undergraduate, master's, Chinese-language and transfer guides do not state an intake year and are not labelled as 2027.",
    "The scholarship attachment-level eligible-program list is not yet registered and remains absent.",
    "General self-funded and doctoral 2027 admission windows remain unpublished or unresolved.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-95");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 95, candidateSha256, counts: { cities: 1, schools: 1, programs: 0, programIntakes: 0, scholarships: 1 }, publicationAuthorized: false }, null, 2));
