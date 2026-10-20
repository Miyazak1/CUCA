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

type UndergraduateRow = readonly [
  school: string,
  name: string,
  language: "Chinese" | "English",
  durationYears: number,
  cscaRequirement: string,
];

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-05.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-05.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-05.review.json");

const expected: Record<string, string> = {
  "nankai-undergraduate-admissions-2027": "c17496625090e718894a29288c6a7b3881d6a881d151d43bc621ff92d78fe9ff",
  "seu-admission-index-2027": "5080bf4fa82dd01223a999d5a4ab90e76fc7f3e80ba937438268677a6d798fff",
  "seu-application-guidance-2027": "fb8cdf08be2403778b48df0f489dbf8fa0dbc43177b1e4970d3a1fc06ca0884f",
  "seu-undergraduate-admissions-2027": "bf8f72b7989e94bc54fb820ddf59047ca284185567d11433a4d7da51269db083",
  "seu-postgraduate-admissions-2027": "487dec5e731ceb34db4dc618e55551afeaf258598f084e070742f07a2f6f1313",
  "seu-application-guidance-pdf-2027": "482edaf69dfbb4fb1156e4ded3080e8ab92ef2204bc9bd2bfc9e2caab76492d4",
  "seu-undergraduate-admissions-pdf-2027": "65837d546be444a34d03d8ad3810cfc4061d532ae59eff5bfd23e032468b3bf1",
  "seu-postgraduate-admissions-pdf-2027": "74e5308d118915a97a980688ac9c6c37c0a41d5b82cc226dbbe5b2a4d33c3b84",
};

const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 05 evidence: ${missing.join(", ")}`);

const nankaiSource = evidence.get("nankai-undergraduate-admissions-2027")!;
const seuGeneralSource = evidence.get("seu-application-guidance-pdf-2027")!;
const seuUndergraduateSource = evidence.get("seu-undergraduate-admissions-pdf-2027")!;
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const rows: UndergraduateRow[] = [
  ["School of Architecture", "Architecture", "Chinese", 5, "Humanities/Science Chinese + Mathematics"],
  ["School of Architecture", "Architecture", "English", 5, "Mathematics"],
  ["School of Architecture", "Urban Planning", "English", 4, "Mathematics"],
  ["School of Architecture", "Urban Planning", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Architecture", "Landscape Architecture", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Mechanical Engineering", "Mechanical Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Energy & Environment", "Energy and Power Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Energy & Environment", "Nuclear Engineering and Technology", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Energy & Environment", "Environment Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Energy & Environment", "New Energy Science and Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Information Science & Engineering", "Information Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Civil Engineering", "Civil Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Civil Engineering", "Civil Engineering", "English", 4, "Mathematics + Physics"],
  ["School of Civil Engineering", "Water Supply and Sewerage Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Civil Engineering", "Project Management", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Civil Engineering", "Intelligent Building", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Civil Engineering", "Engineering Mechanics", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Electronic Science & Engineering", "Electronic Science and Technology", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Mathematics", "Mathematics and Applied Mathematics", "Chinese", 4, "Science Chinese + Mathematics"],
  ["School of Mathematics", "Information and Computational Science", "Chinese", 4, "Science Chinese + Mathematics"],
  ["School of Statistics & Data Science", "Statistics", "Chinese", 4, "Science Chinese + Mathematics"],
  ["School of Automation", "Automation", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Automation", "Robot Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Computer Science & Engineering", "Computer Science and Technology", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Physics", "Physics", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Physics", "Applied Physics", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Biological Science & Medical Engineering", "Biomedical Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Biological Science & Medical Engineering", "Biological Information", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Biological Science & Medical Engineering", "Intelligent Medical Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Material Science & Engineering", "Material Science & Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Economics & Management", "E-Business", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Economics & Management", "Logistics Management", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Economics & Management", "Business Administration", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Economics & Management", "Accounting", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Economics & Management", "International Economics and Trade", "Chinese", 4, "Humanities/Science Chinese + Mathematics"],
  ["School of Economics & Management", "International Economics and Trade", "English", 4, "Mathematics"],
  ["School of Electrical Engineering", "Electronic Engineering and Automation", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Foreign Languages", "English", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Foreign Languages", "Japanese", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Chemistry & Chemical Engineering", "Chemistry", "Chinese", 4, "Science Chinese + Mathematics + Chemistry"],
  ["School of Chemistry & Chemical Engineering", "Chemical Engineering and Technology", "Chinese", 4, "Science Chinese + Mathematics + Chemistry"],
  ["School of Chemistry & Chemical Engineering", "Pharmaceutical Engineering", "Chinese", 4, "Science Chinese + Mathematics + Chemistry"],
  ["School of Transportation", "Transportation Engineering", "English", 4, "Mathematics + Physics"],
  ["School of Transportation", "Traffic Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Transportation", "Transportation", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Transportation", "Urban Underground Space Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Transportation", "Engineering of Roads, Bridges/Ferries", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Transportation", "Intelligent Transportation", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Instrument Science & Engineering", "Intelligent Perception Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Instrument Science & Engineering", "Measuring/Control Technology and Instrumentation", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["Law School", "Law", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Public Health", "Preventive Medicine", "Chinese", 5, "Science Chinese + Mathematics + Chemistry"],
  ["School of Public Health", "Labor and Social Security", "Chinese", 4, "Science Chinese + Mathematics + Chemistry"],
  ["Medical School", "Clinical Medicine", "English", 6, "Mathematics + Chemistry"],
  ["Medical School", "Clinical Medicine", "Chinese", 5, "Science Chinese + Mathematics + Chemistry"],
  ["Medical School", "Medical Imaging", "Chinese", 5, "Science Chinese + Mathematics + Chemistry"],
  ["School of Humanities", "Politics and Administration", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Humanities", "Sociology", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Humanities", "Chinese Literature", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Humanities", "Tourism Management", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Humanities", "Philosophy", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Arts", "Animation", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Arts", "Fine Arts", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Arts", "Product Design", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Arts", "Theory of Art History", "Chinese", 4, "Humanities Chinese + Mathematics"],
  ["School of Life Science & Technology", "Bioscience", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Software Engineering", "Software Engineering", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Artificial Intelligence", "Artificial Intelligence", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Cyber Science & Engineering", "Cyberspace Security", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
  ["School of Integrated Circuit", "Integrated Circuit Design and Integrated Systems", "Chinese", 4, "Science Chinese + Mathematics + Physics"],
];

if (rows.length !== 70) throw new Error(`Expected 70 official SEU undergraduate rows, found ${rows.length}.`);
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const basePrograms = (base.programs ?? []).filter((row) => row.schoolSlug === "southeast-university" && row.degreeLevel === "Undergraduate");
const matchedBaseSlugs = new Set<string>();
const programs: CatalogSeedProgram[] = rows.map(([school, name, language, durationYears, cscaRequirement]) => {
  const existing = basePrograms.find((program) => normalize(program.nameEn) === normalize(name) && program.teachingLanguage === language);
  if (existing) matchedBaseSlugs.add(existing.slug);
  const slug = existing?.slug ?? `southeast-university-undergraduate-${slugify(school)}-${slugify(name)}-${language.toLowerCase()}`;
  const cscaSubjects = cscaRequirement.split("+").map((value) => value.trim());
  return {
    ...(existing ?? {}),
    slug,
    schoolSlug: "southeast-university",
    citySlug: "nanjing",
    nameEn: name,
    degreeLevel: "Undergraduate",
    durationYears,
    fieldCategory: school,
    subjectArea: name,
    teachingLanguage: language,
    cscaSubjects,
    cscaRequirement,
    hskRequirement: language === "Chinese" ? "HSK Level 4 score 200 or above for application; HSK Level 5 is required for graduation." : undefined,
    englishRequirement: language === "English" ? "TOEFL 80 or above, IELTS 6.0 or above, or Duolingo 100 or above; official/native-English exemptions apply." : undefined,
    tuitionText: "Official 2027 undergraduate annual tuition: Chinese-taught Arts & Humanities RMB 16,000, Science & Engineering RMB 19,000, Medicine RMB 20,000; English-taught Arts & Humanities RMB 30,000, Science & Engineering RMB 33,000, Medicine RMB 50,000. Confirm the applicable category in the offer.",
    applicationNote: "The official 2027 guide requires a CSCA score report and publishes three application batches from November 2026 through June 2027.",
    status: "active",
    ...sourceFields(seuUndergraduateSource),
    sourceFieldLineage: {
      nameEn: "2027 undergraduate guide, pages 5-6 program table",
      degreeLevel: "official guide title",
      durationYears: "2027 undergraduate guide, pages 5-6",
      fieldCategory: "2027 undergraduate guide, pages 5-6",
      teachingLanguage: "English-taught label in the official program table; otherwise Chinese-taught admission route",
      cscaSubjects: "2027 undergraduate guide, pages 5-6 CSCA Test column",
      ...(language === "Chinese" ? { hskRequirement: "2027 undergraduate guide, page 3" } : {}),
      ...(language === "English" ? { englishRequirement: "2027 undergraduate guide, page 3" } : {}),
      tuitionText: "2027 undergraduate guide, page 2",
      applicationNote: "2027 undergraduate guide, pages 2-4",
    },
    verificationStatus: "verified",
    lastVerifiedAt: seuUndergraduateSource.fetchedAt,
  };
});

if (new Set(programs.map((program) => program.slug)).size !== 70) throw new Error("SEU 2027 undergraduate program slugs are not unique.");
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "Batch 1: November 2026-February 2027; Batch 2: March-May 2027; Batch 3: June 2027. Exact day-level cutoffs are not stated in the guide.",
  applicationRound: "Southeast University 2027 international undergraduate admission",
  ...sourceFields(seuUndergraduateSource),
  sourceFieldLineage: {
    intakeYear: "official guide title",
    deadlineLabel: "2027 undergraduate guide, page 2",
  },
}));

const baseNankai = (base.schools ?? []).find((school) => school.slug === "nankai-university");
const baseSeu = (base.schools ?? []).find((school) => school.slug === "southeast-university");
if (!baseNankai || !baseSeu) throw new Error("Missing Nankai or Southeast University in reviewed 100-school release.");
const schools = [
  {
    ...baseNankai,
    deadlineSummary: "2027 undergraduate applications: October 20, 2026-June 4, 2027. Tianjin Government Scholarship / Study-at-NKU Scholarship deadline: May 30, 2027.",
    tuitionSummary: "2027 undergraduate tuition: RMB 20,000-35,000/year; accommodation RMB 23-60/person/day; medical insurance RMB 800/year.",
    applicationFee: "RMB 400, paid at the admission stage; exempt for Chinese Government Scholarship winners.",
    hskRequirement: "2027 undergraduate admission requires HSK Level 4 score 180; Chinese-taught students must reach HSK Level 6 score 180 before graduation.",
    cscaRequired: true,
    cscaRequirement: "All 2027 international undergraduate applicants must submit CSCA results in the subjects corresponding to the intended major. The official catalog attachment is CAPTCHA-protected and its per-major allocation is not imported in this wave.",
    campusHighlights: ["46 Chinese-taught undergraduate programs announced for 2027", "1+3 undergraduate pathway", "Balitai and Jinnan campuses"],
    ...sourceFields(nankaiSource),
    sourceFieldLineage: {
      nameEn: "official 2027 undergraduate guide title",
      deadlineSummary: "official 2027 Application Period and scholarship sections",
      tuitionSummary: "official 2027 Fees section",
      applicationFee: "official 2027 Fees section",
      hskRequirement: "official 2027 eligibility and program-introduction sections",
      cscaRequirement: "official 2027 Required Documents and Application Procedure sections",
      campusHighlights: "official 2027 Programs section and institutional campus references",
    },
    verificationStatus: "verified" as const,
    lastVerifiedAt: nankaiSource.fetchedAt,
  },
  {
    ...baseSeu,
    deadlineSummary: "2027 undergraduate applications: Batch 1 November 2026-February 2027, Batch 2 March-May 2027, Batch 3 June 2027. Postgraduate self-funded applications: November 2026-May 2027; scholarship rounds may close in February 2027.",
    tuitionSummary: "2027 annual tuition: undergraduate RMB 16,000-50,000 by field/language; master's RMB 18,000-38,000 by field/language; doctoral RMB 28,000-50,000 by field/language.",
    applicationFee: "RMB 800",
    admissionsUrl: seuGeneralSource.finalUrl ?? seuGeneralSource.url,
    campusHighlights: ["70 official 2027 undergraduate routes", "Official 2027 master's and doctoral program tables collected for the next sub-batch", "Chinese- and English-taught routes"],
    ...sourceFields(seuGeneralSource),
    sourceFieldLineage: {
      nameEn: "official 2027 brochure title",
      deadlineSummary: "2027 general brochure page 4 and degree guides",
      tuitionSummary: "2027 general brochure page 3 and degree guides",
      applicationFee: "2027 general brochure page 3",
      admissionsUrl: "official 2027 brochure URL",
      campusHighlights: "2027 undergraduate and postgraduate program tables",
    },
    verificationStatus: "verified" as const,
    lastVerifiedAt: seuGeneralSource.fetchedAt,
  },
];

const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (base.cities ?? []).filter((city) => city.slug === "nanjing" || city.slug === "tianjin"),
  schools,
  programs: programs.sort((left, right) => left.slug.localeCompare(right.slug)),
  programIntakes: programIntakes.sort((left, right) => left.programSlug.localeCompare(right.programSlug)),
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 05 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    schoolSlugs: ["nankai-university", "southeast-university"],
    refreshedSchools: schools.length,
    refreshedPrograms: programs.length,
    new2027Intakes: programIntakes.length,
    matchedExistingProgramSlugs: matchedBaseSlugs.size,
    unmatchedPriorUndergraduateRoutes: basePrograms.length - matchedBaseSlugs.size,
    sourceSnapshots: evidence.size,
  },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  sourceReview: {
    result: "agent_checked_pending_human_review",
    seuUndergraduatePdfPagesReviewed: [1, 2, 3, 4, 5, 6],
    seuPostgraduatePdfPagesReviewed: [1, 2, 3, 4, 5, 6],
    seuGeneralPdfPagesReviewed: [1, 2, 3, 4],
  },
  notes: [
    "This wave refreshes the complete 70-row Southeast University 2027 undergraduate table and both school-level profiles.",
    "Prior Southeast University undergraduate routes that are absent from the 2027 table are not archived automatically; reconciliation is deferred for human review.",
    "The Southeast University 2027 master's and doctoral tables were collected and visually checked, but are intentionally deferred to a separate sub-batch.",
    "Nankai's public 2027 guide states that 46 Chinese-taught undergraduate programs are available, but the official XLSX requires a CAPTCHA. This workflow did not bypass it and does not roll 2026 program names forward.",
    "Southeast University publishes application periods by month rather than exact dates; no day-level deadline is inferred.",
    "No applicant, account, passport, payment, or other personal data is included.",
  ],
};

await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  reviewPath,
  candidateSha256,
  counts: {
    cities: candidate.cities?.length ?? 0,
    schools: schools.length,
    programs: programs.length,
    programIntakes: programIntakes.length,
    sourceSnapshots: evidence.size,
  },
  matchedExistingProgramSlugs: matchedBaseSlugs.size,
  publicationAuthorized: false,
}, null, 2));
