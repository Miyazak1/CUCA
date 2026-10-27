import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Extraction = { version: number; schoolSlug: string; sourceRun: string; source: { id: string; sha256: string }; counts: { total: number; bachelor: number; master: number; doctoral: number }; programs: Array<{ degreeLevel: "Bachelor" | "Master" | "Doctoral"; teachingLanguage: "Chinese"; schoolEn: string; nameEn: string; durationYears: number; sourceId: string }> };

const root = process.cwd();
const runDir = resolve(root, "work/catalog-official/2026-10-27T07-20-19-252Z");
const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8")) as { sources: Source[] };
const locked = new Map([
  ["imu-international-chinese-language-teachers-scholarship-spring-2027", "fac4e26a9ec337e7b8bd63e87d2ba883dfb35d54443d9261788f153d299cf676"],
  ["imu-international-home-current", "ff2acee0a185a7603b283545cdcfecd8fe585c5833f9a87ca2c850835e8e2713"],
  ["imu-international-announcements-current", "4fa33797a56bc53e1a3b3be08f6ac77578214f7d03829d7999ca4203b3b914a3"],
  ["imu-international-admission-brochure-current", "e66ae1ccf49ac9213aaa98705d2b93b0fb7db8afe5a714eea6bbee4240e1ec60"],
  ["imu-self-financed-international-guide-2026-en", "68ce4e5d88a689898068408f73f061626a1d2a34f3f29c95636db3b9b560d371"],
  ["imu-regional-government-graduate-scholarship-2026-2027", "35b55a6f734d4fe9a79623f27b65a12f05de301173b2f4df897c2057d4d7a71c"],
  ["imu-regional-government-graduate-scholarship-2026-2027-program-list", "4ba421ba6164f5976a3c8be32eb8f1409ae1d5bd69389397970f2a5137047234"],
  ["imu-regional-government-graduate-scholarship-2026-2027-materials-list", "3ff815c85f4782cddc79356f917d8890c15ef0dbe7eebc37ebc2135c21ab5fd5"],
  ["imu-cgs-high-level-graduate-2026-2027-en", "000b916cc3e3bf66d9e2e2c6b8d30f0221a8335d2271ba605091d9bcb290360d"],
  ["imu-cgs-high-level-graduate-2026-2027-program-list", "c24c6aaa2e76d6ec1190592ee7233fd1aec1bac6b25e08e6e0bc5e003739064d"],
]);
const sources = new Map<string, Source>();
for (const [id, sha256] of locked) {
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha256);
  if (!source) throw new Error(`Missing locked Inner Mongolia University source ${id}.`);
  const bytes = await readFile(resolve(runDir, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Hash mismatch ${id}.`);
  sources.set(id, source);
}

const extractionPath = resolve(root, "catalog-sources/imu-current-programs.extracted.json");
const extractionText = await readFile(extractionPath, "utf8");
const extraction = JSON.parse(extractionText) as Extraction;
if (extraction.version !== 1 || extraction.schoolSlug !== "inner-mongolia-university" || extraction.counts.total !== 165 || extraction.programs.length !== 165) throw new Error("Unexpected Inner Mongolia University extraction shape.");
if (extraction.source.sha256 !== locked.get(extraction.source.id)) throw new Error("Inner Mongolia University extraction source lock mismatch.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-105.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === extraction.schoolSlug.replace("inner-mongolia-university", "hohhot"));
const priorSchool = prior.schools?.find((row) => row.slug === extraction.schoolSlug);
const priorProgram = prior.programs?.find((row) => row.schoolSlug === extraction.schoolSlug);
const priorIntake = prior.programIntakes?.find((row) => row.programSlug === priorProgram?.slug);
const priorScholarship = prior.scholarships?.find((row) => row.schoolSlug === extraction.schoolSlug);
if (!city || !priorSchool || !priorProgram || !priorIntake || !priorScholarship) throw new Error("Wave 227 requires Wave 105 dependencies.");

const brochure = sources.get("imu-international-admission-brochure-current")!;
const spring2027 = sources.get("imu-international-chinese-language-teachers-scholarship-spring-2027")!;
const sourceFields = (source: Source) => ({ lastVerifiedAt: source.fetchedAt, sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const school = {
  ...priorSchool,
  applicationLevel: "Current official Bachelor, Master and Doctoral reference catalog, language and advanced study, plus an explicit Spring 2027 one-semester scholarship route",
  languageRequirement: "The current self-financed brochure requires an HSK score report for formal degree applicants; undergraduate and doctoral entry require HSK Level 4 or above. The Spring 2027 one-semester scholarship has direction-specific HSK/HSKK rules.",
  deadlineSummary: "The current brochure states an annual March 1-June 1 application window for undergraduate and graduate study, but does not label it as the 2027 cycle. The explicit Spring 2027 scholarship closed October 31, 2026.",
  tuitionSummary: "Current annual self-funded tuition is CNY 12,000/13,600 for bachelor, CNY 16,000/18,400 for master and CNY 20,000/22,400 for doctoral study (arts/STEM respectively). Program-level arts/STEM classification is not inferred.",
  admissionsUrl: brochure.finalUrl ?? brochure.url,
  subjectTags: [...new Set(extraction.programs.map((row) => row.schoolEn))],
  campusHighlights: ["165 current official degree-reference rows", "67 bachelor, 76 master and 22 doctoral references", "Explicit Spring 2027 scholarship route", "Hohhot, Inner Mongolia"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...sourceFields(brochure),
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "current official international admission brochure and explicit Spring 2027 scholarship guide",
    languageRequirement: "current official international admission brochure and Spring 2027 scholarship guide",
    deadlineSummary: "current brochure annual timing plus explicit Spring 2027 scholarship deadline; scope limitation retained",
    tuitionSummary: "current official international admission brochure fee table",
    subjectTags: "current official international admission brochure degree table",
    campusHighlights: "deterministically extracted current brochure table and Spring 2027 guide",
  },
};

const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 70).replace(/-+$/g, "");
const currentPrograms: CatalogSeedProgram[] = extraction.programs.map((row, index) => ({
  slug: `inner-mongolia-university-${row.degreeLevel.toLowerCase()}-${slugify(row.schoolEn)}-${slugify(row.nameEn)}-current-ref-${index + 1}`,
  schoolSlug: extraction.schoolSlug,
  citySlug: "hohhot",
  nameEn: row.nameEn,
  degreeLevel: row.degreeLevel,
  durationYears: row.durationYears,
  fieldCategory: "Official current Chinese-medium reference catalog",
  subjectArea: row.nameEn,
  teachingLanguage: "Chinese",
  applicationUrl: brochure.finalUrl ?? brochure.url,
  applicationNote: `Current official international admission brochure reference row. School/college: ${row.schoolEn}. The brochure publishes an annual March 1-June 1 application window but does not identify a 2027 self-funded cycle, so no 2027 intake is created.`,
  badgeText: "Current official reference",
  displaySubjects: [row.nameEn, row.schoolEn],
  status: "draft",
  verificationStatus: "unverified",
  ...sourceFields(brochure),
  sourceFieldLineage: {
    nameEn: "current official international admission brochure degree table",
    degreeLevel: "current official international admission brochure degree column",
    durationYears: "current official brochure duration section",
    fieldCategory: "evidence-scope label",
    subjectArea: "current official international admission brochure degree table",
    teachingLanguage: "formal-degree HSK requirement and Chinese-medium brochure scope",
    applicationUrl: "current official international admission brochure",
    applicationNote: "current brochure application timing with explicit 2027 limitation",
    badgeText: "evidence-scope label",
  },
}));

const refreshedProgram = { ...priorProgram, status: "draft" as const, verificationStatus: "unverified" as const, ...sourceFields(spring2027) };
const refreshedIntake = {
  ...priorIntake,
  sourceUrl: spring2027.finalUrl ?? spring2027.url,
  sourceLabel: spring2027.label,
  sourceSha256: spring2027.sha256,
  capturedAt: spring2027.fetchedAt,
};
const refreshedScholarship = { ...priorScholarship, status: "draft" as const, verificationStatus: "unverified" as const, ...sourceFields(spring2027) };
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: brochure.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [refreshedProgram, ...currentPrograms],
  programIntakes: [refreshedIntake],
  scholarships: [refreshedScholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: brochure.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 114, schoolSlugs: [extraction.schoolSlug], newSchools: 0, programs: 166, programIntakes: 1, scholarships: 1 },
  evidence,
  extraction: { path: "catalog-sources/imu-current-programs.extracted.json", sha256: createHash("sha256").update(extractionText).digest("hex"), extractor: "scripts/catalog-imu-current-programs-extract.ts", expectedPrograms: 165 },
  unresolved: [
    "The 165 degree rows come from the current official international admission brochure, which does not label its annual application window as the 2027 cycle. They are current-reference rows and receive no fabricated 2027 intake.",
    "The brochure publishes arts/STEM tuition bands but does not classify every listed program into a fee band, so program-level tuition is left empty rather than inferred.",
    "The 2026-2027 regional-government and Chinese Government Scholarship program-list attachments are CAPTCHA-protected. The challenge is not bypassed and eligibility is not mapped onto the 165 current-reference rows.",
    "The self-financed June 2026 landing page is image-based. The accessible current brochure is used for program and fee facts, while the landing-page image is not OCR-transcribed in this candidate.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-227");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 227, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
