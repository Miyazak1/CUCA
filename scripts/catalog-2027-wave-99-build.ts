import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
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
const workRoot = resolve(root, "work/catalog-official");
const sourceId = "pku-international-graduate-admissions-2027";
const expectedSha256 = "11ab8ae8e8d38c087bce9cb8d0fedafa357e470669790684c67ca63fb4293ce2";
const tuitionSourceId = "pku-international-graduate-tuition-2027";
const tuitionExpectedSha256 = "bf982ff0e6bd1d6beb5a37c9c0e0c36082f4b673a84b1a5fc75665b93fdfc5db";
const schoolSlug = "peking-university";
const applicationUrl = "https://www.studyatpku.com";

let source: ManifestSource | undefined;
let tuitionSource: ManifestSource | undefined;
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const candidate = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (candidate) {
      const artifact = await readFile(resolve(runRoot, candidate.artifactPath));
      if (createHash("sha256").update(artifact).digest("hex") !== candidate.sha256) throw new Error(`Evidence hash mismatch: ${sourceId}`);
      source = candidate;
    }
    const tuitionCandidate = manifest.sources?.find((row) => row.id === tuitionSourceId && row.status === 200 && row.sha256 === tuitionExpectedSha256);
    if (tuitionCandidate) {
      const artifact = await readFile(resolve(runRoot, tuitionCandidate.artifactPath));
      if (createHash("sha256").update(artifact).digest("hex") !== tuitionCandidate.sha256) throw new Error(`Evidence hash mismatch: ${tuitionSourceId}`);
      tuitionSource = tuitionCandidate;
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error(`Missing locked official evidence ${sourceId} at ${expectedSha256}.`);
if (!tuitionSource) throw new Error(`Missing locked official evidence ${tuitionSourceId} at ${tuitionExpectedSha256}.`);

const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const baseSchool = base.schools?.find((row) => row.slug === schoolSlug);
const baseCity = base.cities?.find((row) => row.slug === "beijing");
if (!baseSchool || !baseCity) throw new Error("Peking University or Beijing dependency is missing from the reviewed release.");
const basePrograms = new Map((base.programs ?? []).filter((row) => row.schoolSlug === schoolSlug).map((row) => [row.slug, row]));

// Only routes named directly in the October 23, 2026 guide are refreshed here.
// The linked central major directory still displayed its 2026 entries at capture time,
// so this wave intentionally does not relabel the remainder of the old catalog.
const explicitProgramSlugs = [
  "peking-university-graduate-college-of-environmental-sciences-and-engineering-environment-management-master-english-full-time-pku-lse-double-master-s-degree",
  "peking-university-graduate-department-of-information-management-information-science-phd-english-full-time-standard",
  "peking-university-graduate-en-master-school-of-materials-science-and-engineering-080500",
  "peking-university-graduate-en-phd-school-of-materials-science-and-engineering-080500",
  "peking-university-graduate-school-of-arts-art-theory-phd-english-full-time-standard",
  "peking-university-graduate-school-of-computer-science-computer-science-and-technology-master-english-full-time-standard",
  "peking-university-graduate-school-of-computer-science-computer-science-and-technology-phd-english-full-time-standard",
  "peking-university-graduate-school-of-new-media-master-of-journalism-and-communication-master-english-full-time-standard",
  "peking-university-graduate-en-phd-school-of-new-media-050320",
  "peking-university-graduate-en-master-school-of-government-120421",
  "peking-university-graduate-school-of-government-public-administration-in-comparative-public-policy-and-international-cooperation-master-english-full-time-impa",
  "peking-university-graduate-school-of-international-studies-international-relations-master-english-full-time-mir",
  "peking-university-graduate-school-of-international-studies-international-relations-master-english-full-time-pku-lse-double-master-s-degree",
  "peking-university-graduate-school-of-international-studies-international-relations-master-english-full-time-pku-sciences-po-dual-master-s-degree",
  "peking-university-graduate-law-school-civil-and-commercial-law-master-english-full-time-llm-program",
  "peking-university-graduate-guanghua-school-of-management-master-of-business-administration-master-english-full-time-global-mba",
  "peking-university-graduate-en-master-yenching-academy-0101j2",
  "peking-university-graduate-en-master-yenching-academy-0202j2",
  "peking-university-graduate-en-master-yenching-academy-0301j2",
  "peking-university-graduate-en-master-yenching-academy-0302j2",
  "peking-university-graduate-en-master-yenching-academy-0501j2",
  "peking-university-graduate-en-master-yenching-academy-0602j2",
  "peking-university-graduate-en-master-guanghua-school-of-management-020201",
  "peking-university-graduate-en-master-guanghua-school-of-management-020204",
  "peking-university-graduate-en-master-guanghua-school-of-management-020205",
  "peking-university-graduate-en-master-guanghua-school-of-management-020208",
  "peking-university-graduate-en-master-guanghua-school-of-management-120201",
  "peking-university-graduate-en-master-guanghua-school-of-management-120202",
  "peking-university-graduate-en-phd-guanghua-school-of-management-020201",
  "peking-university-graduate-en-phd-guanghua-school-of-management-020204",
  "peking-university-graduate-en-phd-guanghua-school-of-management-020205",
  "peking-university-graduate-en-phd-guanghua-school-of-management-020208",
  "peking-university-graduate-en-phd-guanghua-school-of-management-120201",
  "peking-university-graduate-en-phd-guanghua-school-of-management-120202",
] as const;

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
type TuitionOverride = Pick<CatalogSeedProgram, "durationYears" | "tuitionAmount" | "tuitionCurrency" | "tuitionPeriod" | "tuitionText" | "nameEn">;
const tuitionOverrides: Record<string, Partial<TuitionOverride> & { tuitionTba?: boolean }> = {
  "peking-university-graduate-college-of-environmental-sciences-and-engineering-environment-management-master-english-full-time-pku-lse-double-master-s-degree": { nameEn: "Resources and Environmental Engineering - PKU-LSE Double Master's Degree", durationYears: 2, tuitionText: "TBA; PKU tuition will be announced separately.", tuitionTba: true },
  "peking-university-graduate-department-of-information-management-information-science-phd-english-full-time-standard": { durationYears: 4, tuitionText: "TBA; to be announced in another notice.", tuitionTba: true },
  "peking-university-graduate-school-of-arts-art-theory-phd-english-full-time-standard": { nameEn: "Art (History and Theory of Art)", durationYears: 4, tuitionAmount: 200000, tuitionCurrency: "RMB", tuitionPeriod: "total", tuitionText: "RMB 200,000 total" },
  "peking-university-graduate-school-of-computer-science-computer-science-and-technology-master-english-full-time-standard": { durationYears: 3, tuitionAmount: 150000, tuitionCurrency: "RMB", tuitionPeriod: "total", tuitionText: "RMB 150,000 total" },
  "peking-university-graduate-school-of-computer-science-computer-science-and-technology-phd-english-full-time-standard": { tuitionText: "RMB 200,000-250,000 total; the official table states RMB 250,000 for the five-year route." },
  "peking-university-graduate-school-of-new-media-master-of-journalism-and-communication-master-english-full-time-standard": { durationYears: 2, tuitionAmount: 160000, tuitionCurrency: "RMB", tuitionPeriod: "total", tuitionText: "RMB 160,000 total" },
  "peking-university-graduate-en-master-school-of-government-120421": { nameEn: "Public Policy - MPP", durationYears: 2, tuitionAmount: 150000, tuitionCurrency: "RMB", tuitionPeriod: "total", tuitionText: "RMB 150,000 total" },
  "peking-university-graduate-school-of-government-public-administration-in-comparative-public-policy-and-international-cooperation-master-english-full-time-impa": { durationYears: 2, tuitionAmount: 380000, tuitionCurrency: "RMB", tuitionPeriod: "total", tuitionText: "RMB 380,000 total" },
  "peking-university-graduate-law-school-civil-and-commercial-law-master-english-full-time-llm-program": { nameEn: "Juris (Chinese Law and Comparative Law) - LLM", durationYears: 2, tuitionText: "TBA in the official 2027 fee table.", tuitionTba: true },
  "peking-university-graduate-guanghua-school-of-management-master-of-business-administration-master-english-full-time-global-mba": { durationYears: 2, tuitionAmount: 188000, tuitionCurrency: "RMB", tuitionPeriod: "total", tuitionText: "RMB 188,000 total" },
};
const programs: CatalogSeedProgram[] = explicitProgramSlugs.map((slug) => {
  const existing = basePrograms.get(slug);
  if (!existing) throw new Error(`Missing reviewed PKU dependency program ${slug}.`);
  const override = tuitionOverrides[slug];
  const normalizedExisting = { ...existing };
  if (override?.tuitionTba) {
    delete normalizedExisting.tuitionAmount;
    delete normalizedExisting.tuitionCurrency;
    delete normalizedExisting.tuitionPeriod;
  }
  const publishedOverride = { ...(override ?? {}) };
  delete publishedOverride.tuitionTba;
  return {
    ...normalizedExisting,
    ...publishedOverride,
    applicationUrl,
    applicationNote: "The 2027 international graduate application period is October 26-December 25, 2026. Applicants must meet the route's degree, academic and language requirements and submit authenticated degree evidence, transcripts, a personal statement and research plan, résumé, commitment letter, two academic recommendations, language evidence, passport and any department-specific materials. The application fee is CNY 800 per program or major.",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      nameEn: "2027 guide, English-taught program table",
      degreeLevel: "2027 guide, English-taught program table",
      ...(publishedOverride.durationYears !== undefined
        ? { durationYears: "official 2027 international graduate tuition-fee table" }
        : existing.durationYears !== undefined
          ? { durationYears: "2027 guide, Method and Length of Study; existing route duration retained when more specific" }
          : {}),
      fieldCategory: "2027 guide, English-taught program table",
      subjectArea: "2027 guide, English-taught program table",
      teachingLanguage: "2027 guide, English-taught program table",
      applicationUrl: "2027 guide, Application Materials",
      applicationNote: "2027 guide, Application Prerequisites, Application Period, Application Materials and Application Fee",
      ...(override ? { tuitionText: "official 2027 international graduate tuition-fee table" } : {}),
      ...(publishedOverride.tuitionAmount !== undefined ? { tuitionAmount: "official 2027 international graduate tuition-fee table" } : {}),
    },
  };
});

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-10-25T16:00:00.000Z",
  deadlineDate: "2026-12-25T15:59:59.000Z",
  deadlineLabel: "Main 2027 international graduate application period: October 26-December 25, 2026 Beijing time. English-taught master's programs may publish a different route-specific deadline.",
  applicationRound: "PKU 2027 international master's and doctoral admissions",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "2027 guide, Enrollment",
    intakeYear: "2027 guide title and Enrollment",
    openDate: "2027 guide, Application Period",
    deadlineDate: "2027 guide, Application Period",
    deadlineLabel: "2027 guide, Application Period note",
    applicationRound: "2027 guide title",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [baseCity],
  schools: [{
    ...baseSchool,
    applicationLevel: "Undergraduate, Master, Doctoral, Pre-university and Non-degree",
    languageRequirement: "For 2027 graduate Chinese-taught routes, science applicants need HSK 6 score above 200 and writing at least 65; humanities applicants need HSK 6 score above 210 and writing at least 65. English-taught routes require accepted English evidence under the program-specific guide.",
    hskRequirement: "2027 graduate Chinese-taught routes: HSK 6 above 200 with writing at least 65 for science, or HSK 6 above 210 with writing at least 65 for humanities.",
    englishRequirement: "Non-native English speakers applying to English-taught routes must submit accepted English-language evidence; route-specific requirements control.",
    deadlineSummary: "The main 2027 international master's and doctoral application window is October 26-December 25, 2026; route-specific English master's deadlines may differ.",
    applicationFee: "CNY 800 per program or major",
    admissionsUrl: sourceFields.sourceUrl,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      applicationLevel: "official 2027 graduate guide plus previously reviewed route coverage",
      languageRequirement: "2027 guide, Application Materials, language scores",
      hskRequirement: "2027 guide, Application Materials, Chinese-taught language table",
      englishRequirement: "2027 guide, Application Materials, English-taught programs",
      deadlineSummary: "2027 guide, Application Period",
      applicationFee: "2027 guide, Application Fee",
      admissionsUrl: "official 2027 graduate guide URL",
    },
  }],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 99 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug, refreshedExplicitGraduatePrograms: programs.length, new2027Intakes: programIntakes.length, sourceSnapshots: 1 },
  evidence: [
    { id: source.id, label: source.label, url: sourceFields.sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 },
    { id: tuitionSource.id, label: tuitionSource.label, url: tuitionSource.finalUrl ?? tuitionSource.url, fetchedAt: tuitionSource.fetchedAt, sha256: tuitionSource.sha256 },
  ],
  notes: [
    "This wave refreshes only English-taught master's and doctoral routes explicitly named in the October 23, 2026 official guide.",
    "The guide's linked central major-directory page still displayed 2026 entries at capture time, so the rest of the historical PKU catalog is not relabeled as 2027.",
    "The guide publishes three scholarship families but no route-level award amounts or deadlines, so no scholarship rows are inferred.",
    "The official 2027 tuition table replaces older fee values only for uniquely matched routes. TBA values remain textual and are not converted into invented numeric tuition.",
  ],
  unresolved: [
    "The complete 2027 master/doctoral major directory was not exposed by the linked directory page at capture time.",
    "University-wide 2027 international undergraduate and pre-university guides remain unpublished or unresolved.",
    "English-taught master's programs may use route-specific deadlines and language thresholds that must be captured from their own guides.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-99");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 99, candidateSha256, counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 }, publicationAuthorized: false }, null, 2));
