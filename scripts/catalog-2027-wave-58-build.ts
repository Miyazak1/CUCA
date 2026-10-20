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
const sourceId = "tsinghua-sigs-graduate-admissions-2027";
const expectedSha256 = "9efe0a7da01a19424dd75f15bffb7f4968d60eafe5c0b6df50fd26bb2822cf86";
let evidence: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const item = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!item) continue;
    const bytes = await readFile(resolve(runRoot, item.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error("Tsinghua SIGS evidence hash mismatch.");
    evidence = item;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!evidence) throw new Error("Missing locked Tsinghua SIGS 2027 graduate-admissions evidence.");

const wave50 = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-50.draft.json"), "utf8")) as CatalogSeedBundle;
const release = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = wave50.schools?.find((row) => row.slug === "tsinghua-university");
const schoolCity = wave50.cities?.find((row) => row.slug === "beijing");
const city = release.cities?.find((row) => row.slug === "shenzhen");
if (!school || !schoolCity || !city) throw new Error("Wave 58 Tsinghua, Beijing or Shenzhen dependency row is missing.");

const masterSlugs = new Set([
  "tsinghua-university-2027-master-logistics-engineering-and-management-smart-logistics",
  "tsinghua-university-2027-master-masters-program-ai-for-material-engineering",
  "tsinghua-university-2027-master-masters-program-in-biomedical-engineering-and-translational-medicine",
  "tsinghua-university-2027-master-masters-program-in-data-science-and-information-technology",
  "tsinghua-university-2027-master-masters-program-in-future-science-technology-and-industry",
  "tsinghua-university-2027-master-masters-program-in-intelligent-instrument-and-equipment",
  "tsinghua-university-2027-master-masters-program-in-sustainable-and-renewable-energy-technology",
  "tsinghua-university-2027-master-masters-program-in-synthetic-biology-and-biomanufacturing",
  "tsinghua-university-2027-master-resources-and-environmental-engineering-international-masters-program-in-green-environmental-infrastructure",
  "tsinghua-university-2027-master-urban-and-rural-planning-master-of-urban-systems-in-human-habitats",
]);
const doctoralSlugs = new Set([
  "tsinghua-university-doctoral-tsinghua-shenzhen-international-graduate-school-doctoral-program-in-data-science-and-information-technology-english",
  "tsinghua-university-doctoral-tsinghua-shenzhen-international-graduate-school-doctoral-program-in-environmental-science-and-new-energy-technology-english",
  "tsinghua-university-doctoral-tsinghua-shenzhen-international-graduate-school-doctoral-program-in-precision-medicine-and-healthcare-english",
]);
const targetSlugs = new Set([...masterSlugs, ...doctoralSlugs]);
const sourceFields = {
  sourceUrl: evidence.finalUrl ?? evidence.url,
  sourceLabel: evidence.label,
  sourceSha256: evidence.sha256,
  capturedAt: evidence.fetchedAt,
};

const programs: CatalogSeedProgram[] = (wave50.programs ?? [])
  .filter((row) => targetSlugs.has(row.slug))
  .map((row) => {
    const isMaster = masterSlugs.has(row.slug);
    const durationText = isMaster
      ? "SIGS states that master's degree programs are generally two years."
      : "SIGS states that doctoral programs are generally 3-4 years, while direct-entry doctoral study from a bachelor's degree is normally 4-5 years.";
    return {
      ...row,
      citySlug: city.slug,
      ...(isMaster ? { durationYears: 2 } : {}),
      applicationUrl: evidence!.finalUrl ?? evidence!.url,
      applicationNote: `${row.applicationNote ?? ""} ${durationText} The SIGS 2027 application closes at 17:00 Beijing Time on May 15, 2027; scholarship applicants are recommended to submit the admission application by December 2026.`.trim(),
      lastVerifiedAt: evidence!.fetchedAt,
      ...sourceFields,
      sourceFieldLineage: {
        ...(row.sourceFieldLineage ?? {}),
        citySlug: "SIGS 2027 admissions page, Shenzhen registration location and school identity",
        ...(isMaster ? { durationYears: "SIGS 2027 admissions page, general master's study period" } : {}),
        applicationUrl: "SIGS 2027 admissions page",
        applicationNote: "SIGS 2027 study-period and application-timeline sections",
      },
    };
  });
if (programs.length !== 13 || programs.filter((row) => row.durationYears === 2).length !== 10) {
  throw new Error(`Expected 13 SIGS program matches with 10 structured master's durations, found ${programs.length} and ${programs.filter((row) => row.durationYears === 2).length}.`);
}

const priorIntakes = new Map((wave50.programIntakes ?? []).map((row) => [row.programSlug, row]));
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => {
  const prior = priorIntakes.get(program.slug);
  if (!prior) throw new Error(`Missing Wave 50 intake for ${program.slug}.`);
  return {
    ...prior,
    deadlineDate: "2027-05-15T09:00:00.000Z",
    deadlineLabel: "Application closes at 17:00 Beijing Time on May 15, 2027. Scholarship applicants are recommended to submit the admission application by December 2026.",
    applicationRound: "Tsinghua SIGS 2027 International Graduate Admission",
    status: "open",
    ...sourceFields,
    sourceFieldLineage: {
      ...(prior.sourceFieldLineage ?? {}),
      deadlineDate: "SIGS 2027 admissions page, application timeline with Beijing time",
      deadlineLabel: "SIGS 2027 admissions page, application and scholarship timing notes",
      applicationRound: "SIGS 2027 admissions page title and scope",
      status: "deadline compared with capturedAt",
    },
  };
});

const commonScholarship = {
  schoolSlug: school.slug,
  applicableDegree: "Master; Doctoral",
  applicationRound: "Tsinghua SIGS 2027 International Graduate Admission",
  deadlineLabel: "Scholarship applicants are recommended to complete and submit the admission application by December 2026; the source does not publish an award-specific calendar deadline.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
};
const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "tsinghua-sigs-tuition-scholarship-2027",
    title: "Tsinghua SIGS Tuition Scholarship - 2027",
    type: "university",
    typeLabel: "University-level Tuition Scholarship",
    providerName: "Tsinghua Shenzhen International Graduate School",
    fundingLevel: "full_or_partial",
    coverage: "Full or partial tuition fee for one academic year; students may apply annually and awards are competitive.",
    requirementText: "The official page states that awards are competitive and may be applied for annually; it does not publish separate score, nationality or age thresholds.",
    benefitItems: [{ label: "Tuition", included: true, note: "Full or partial tuition for one academic year" }],
    eligibilityItems: [{ label: "Selection", body: "Competitive annual application; no separate numeric threshold is published on the official page" }],
    actionLinks: [{ label: "Official SIGS 2027 graduate admissions and financial-aid page", url: evidence.url, kind: "official-source" }],
    summary: "Competitive one-academic-year full or partial tuition support for SIGS graduate students.",
    ...commonScholarship,
    sourceFieldLineage: {
      title: "SIGS 2027 financial-aid section, Tuition Scholarship",
      fundingLevel: "SIGS 2027 financial-aid section, full or partial tuition wording",
      coverage: "SIGS 2027 financial-aid section, duration and annual application wording",
      applicableDegree: "SIGS 2027 graduate-admissions scope",
      requirementText: "SIGS 2027 financial-aid section, competitive annual application wording",
      benefitItems: "SIGS 2027 financial-aid section",
      eligibilityItems: "SIGS 2027 financial-aid section",
      deadlineLabel: "SIGS 2027 application-timeline scholarship recommendation",
      applicationRound: "SIGS 2027 admissions page title and scope",
    },
  },
  {
    slug: "tsinghua-sigs-international-student-scholarship-2027",
    title: "Tsinghua SIGS International Student Scholarship - 2027",
    type: "university",
    typeLabel: "School-level International Student Scholarship",
    providerName: "Tsinghua Shenzhen International Graduate School",
    fundingLevel: "tuition_waiver",
    coverage: "Tuition fee waiver granted according to annual scholarship evaluation results.",
    requirementText: "Full-time international new students admitted to SIGS are ranked based on previous academic achievements, research outcomes and overall performance.",
    benefitItems: [{ label: "Tuition", included: true, note: "Tuition fee waiver based on annual scholarship evaluation results" }],
    eligibilityItems: [
      { label: "Student status", body: "Full-time international new student admitted to SIGS" },
      { label: "Selection", body: "Ranked by prior academic achievement, research outcomes and overall performance" },
    ],
    actionLinks: [{ label: "Official SIGS 2027 graduate admissions and financial-aid page", url: evidence.url, kind: "official-source" }],
    summary: "Merit-evaluated tuition waiver for full-time newly admitted international SIGS students.",
    ...commonScholarship,
    sourceFieldLineage: {
      title: "SIGS 2027 financial-aid section, SIGS International Student Scholarship",
      fundingLevel: "SIGS 2027 financial-aid section, tuition-waiver wording",
      coverage: "SIGS 2027 financial-aid section, annual evaluation wording",
      applicableDegree: "SIGS 2027 graduate-admissions scope",
      requirementText: "SIGS 2027 financial-aid section, admitted-student ranking criteria",
      benefitItems: "SIGS 2027 financial-aid section",
      eligibilityItems: "SIGS 2027 financial-aid section",
      deadlineLabel: "SIGS 2027 application-timeline scholarship recommendation",
      applicationRound: "SIGS 2027 admissions page title and scope",
    },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: evidence.fetchedAt,
  cities: [schoolCity, city],
  schools: [school],
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 58 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    schoolSlugs: [school.slug],
    refreshedPrograms: programs.length,
    masterDurationsAdded: 10,
    refreshed2027Intakes: programIntakes.length,
    refreshedScholarships: scholarships.length,
    sourceSnapshots: 1,
  },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The official page gives doctoral study periods as ranges (generally 3-4 years, or 4-5 years for direct doctoral entry from a bachelor's degree). The exact ranges remain in applicationNote because the catalog contract has no range field.",
    "The official page recommends scholarship applicants submit admission applications by December 2026 but publishes no award-specific calendar deadline; deadlineDate remains absent for both scholarship rows.",
    "The two public interactive Tsinghua program-catalog pages load route details through a form-submission endpoint. The collector did not submit that form, so no additional department-specific rows are inferred.",
    "The published living-allowance figures are not assigned unambiguously to either of the two newly structured scholarship schemes and therefore are not copied into those rows.",
  ],
  notes: [
    "Wave 58 upgrades only ten explicitly matched SIGS master's routes and three existing SIGS-labelled doctoral routes from the 2027 university-wide program set.",
    "All thirteen SIGS routes receive the exact May 15, 2027 17:00 Beijing deadline and Shenzhen program location; only master's routes receive the source's exact two-year structured duration.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-58");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 58,
  candidateSha256,
  counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: 1 },
  publicationAuthorized: false,
}, null, 2));
