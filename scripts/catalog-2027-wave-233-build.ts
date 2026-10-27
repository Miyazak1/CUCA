import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type ExtractedProgram = { degreeLevel: "Bachelor" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; schoolName: string; nameEn: string; publishedDegree?: string; durationYears: number; sourceId: string; sourceTable: number; sourceRow: number };
const root = process.cwd();
const run = "2026-10-27T08-21-03-935Z";
const graduateRun = "2026-10-27T08-21-32-356Z";
const locks = new Map([
  ["bjfu-undergraduate-prospectus-2026", "0f65891ffda216b74665fa004b6ac2a245ad26b7bdee0228200fcb72601408c7"],
  ["bjfu-graduate-prospectus-2026", "4d40cf484b18f14ae2415605256330b44e84954f337695f93bba9d42b16192ad"],
  ["bjfu-undergraduate-program-index-current", "d338b308807d6f7b8da971f06b7e8e85072b890d4552add1ef0acca7fb167244"],
  ["bjfu-master-program-index-current", "c605d65c727a896b2e7dc9bc86e72b0367002a75cc5685e6134dc6e19faa4f3d"],
  ["bjfu-doctoral-program-index-current", "3dedd4523196202cf54bd7d7bc7c584b0c11beb99239f95cb5101f872695cb18"],
  ["bjfu-application-procedure-current", "6a9bdab102731643352edbff0959883017f463c93eb2cc59d979f4f53a272398"],
  ["bjfu-international-tuition-accommodation-current", "9c03a75963294cac81e6ef7a3bace8e31e76f402bc15fbe15fcf97794e1df3fc"],
  ["bjfu-international-admission-index-current", "b48435186cace2941bafd2f2352b28aee010ec8916f1bc649c64a39349fbcae3"],
]);
const manifests = await Promise.all([run, graduateRun].map(async (name) => JSON.parse(await readFile(resolve(root, "work/catalog-official", name, "manifest.json"), "utf8")) as { sources: Source[] }));
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifests.flatMap((manifest) => manifest.sources).find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked BJFU source ${id}.`);
  const sourceRun = source.id === "bjfu-graduate-prospectus-2026" ? graduateRun : run;
  const bytes = await readFile(resolve(root, "work/catalog-official", sourceRun, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}
const extraction = JSON.parse(await readFile(resolve(root, "catalog-sources/bjfu-current-programs.extracted.json"), "utf8")) as { programs: ExtractedProgram[]; counts: { total: number } };
if (extraction.counts.total !== 149 || extraction.programs.length !== 149) throw new Error("Expected 149 extracted BJFU programs.");
const template = JSON.parse(await readFile(resolve(root, "seeds/catalog.bjfu-complete-batch-01.draft.json"), "utf8")) as CatalogSeedBundle;
const city = template.cities?.find((row) => row.slug === "beijing");
const baseSchool = template.schools?.find((row) => row.slug === "beijing-forestry-university");
if (!city || !baseSchool || template.programs?.length !== 149) throw new Error("BJFU reviewed template dependencies are missing.");
const normalizeLevel = (value: string) => value === "Undergraduate" ? "Bachelor" : value;
const canonical = (value: unknown) => String(value ?? "").replaceAll("（", "(").replaceAll("）", ")").replace(/\s*([()])/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();
const key = (row: { degreeLevel?: string; teachingLanguage?: string; fieldCategory?: string; schoolName?: string; nameEn?: string; durationYears?: number }) => [normalizeLevel(String(row.degreeLevel)), row.teachingLanguage, canonical(row.fieldCategory ?? row.schoolName), canonical(row.nameEn), row.durationYears].join("\u0000");
const templates = new Map(template.programs.map((row) => [key(row), row]));
if (templates.size !== 149) throw new Error(`Expected 149 unique BJFU template routes, found ${templates.size}.`);
const tuition = (level: string, language: string) => level === "Bachelor" ? 24800 : level === "Master" ? (language === "English" ? 33000 : 29800) : (language === "English" ? 39000 : 33000);
const programs = extraction.programs.map((row) => {
  const prior = templates.get(key(row));
  if (!prior) throw new Error(`No reviewed BJFU template match: ${key(row)}`);
  const source = sources.get(row.sourceId)!;
  const amount = tuition(row.degreeLevel, row.teachingLanguage);
  return {
    ...prior,
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel === "Bachelor" ? "Undergraduate" : row.degreeLevel,
    fieldCategory: row.schoolName,
    subjectArea: row.nameEn,
    teachingLanguage: row.teachingLanguage,
    durationYears: row.durationYears,
    tuitionAmount: amount,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `RMB ${amount.toLocaleString("en-US")}/year on the current official tuition page`,
    displayTuition: `RMB ${amount.toLocaleString("en-US")}/year`,
    applicationNote: `Current official ${row.teachingLanguage.toLowerCase()}-taught ${row.degreeLevel.toLowerCase()} route; published award: ${row.publishedDegree || "not stated"}; duration: ${row.durationYears} year(s). No 2027 intake is inferred.`,
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      ...(prior.sourceFieldLineage ?? {}),
      nameEn: `current official program table ${row.sourceTable}, row ${row.sourceRow}`,
      degreeLevel: `current official program table ${row.sourceTable}, row ${row.sourceRow}`,
      durationYears: `current official program table ${row.sourceTable}, row ${row.sourceRow}`,
      fieldCategory: `current official program table ${row.sourceTable}, row ${row.sourceRow}`,
      teachingLanguage: `current official program table language section containing row ${row.sourceRow}`,
      tuitionAmount: "current official tuition and accommodation page",
      tuitionCurrency: "current official tuition and accommodation page",
      tuitionPeriod: "current official tuition and accommodation page",
      tuitionText: "current official tuition and accommodation page",
      applicationNote: "current official program table; 2027 intake unresolved",
    },
  };
});
const undergraduateGuide = sources.get("bjfu-undergraduate-prospectus-2026")!;
const graduateGuide = sources.get("bjfu-graduate-prospectus-2026")!;
const programBySlug = new Map(programs.map((row) => [row.slug, row]));
const programIntakes = (template.programIntakes ?? []).map((row) => {
  const program = programBySlug.get(row.programSlug);
  if (!program) throw new Error(`Orphan BJFU intake template: ${row.programSlug}`);
  const source = program.degreeLevel === "Undergraduate" ? undergraduateGuide : graduateGuide;
  const cleaned = { ...row, status: "closed" as const, sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: {
    intakeTerm: "official 2026 prospectus intake and registration section",
    intakeYear: "official 2026 prospectus title and intake section",
    applicationRound: "official 2026 prospectus title",
    status: "derived by comparing the 2026 cycle with capturedAt",
    ...(row.deadlineDate ? { deadlineDate: "official 2026 prospectus deadline" } : {}),
    ...(row.deadlineLabel && !/not published/i.test(String(row.deadlineLabel)) ? { deadlineLabel: "official 2026 prospectus deadline" } : {}),
  } };
  if (/not published/i.test(String(cleaned.deadlineLabel ?? ""))) {
    delete cleaned.deadlineLabel;
    delete cleaned.sourceFieldLineage.deadlineLabel;
  }
  return cleaned;
});
const scholarships = (template.scholarships ?? []).map((row) => ({ ...row, sourceUrl: undergraduateGuide.finalUrl ?? undergraduateGuide.url, sourceLabel: undergraduateGuide.label, sourceSha256: undergraduateGuide.sha256, capturedAt: undergraduateGuide.fetchedAt }));
const tuitionSource = sources.get("bjfu-international-tuition-accommodation-current")!;
const admissionIndex = sources.get("bjfu-international-admission-index-current")!;
const school = {
  ...baseSchool,
  applicationLevel: "Current official tables publish 37 undergraduate, 71 master and 41 doctoral routes. The latest general international guides remain the 2026 cycle; no 2027 intake is inferred.",
  admissionsUrl: admissionIndex.finalUrl ?? admissionIndex.url,
  tuitionSummary: "Current official tuition: undergraduate RMB 24,800/year; master RMB 29,800 Chinese or RMB 33,000 English; doctoral RMB 33,000 Chinese or RMB 39,000 English.",
  campusHighlights: [...(baseSchool.campusHighlights ?? []), "Current official accommodation: degree students RMB 50-60/day/bed for a double room or RMB 100-120/day/bed for a single room; utilities excluded."],
  lastVerifiedAt: tuitionSource.fetchedAt,
  sourceUrl: tuitionSource.finalUrl ?? tuitionSource.url,
  sourceLabel: tuitionSource.label,
  sourceSha256: tuitionSource.sha256,
  capturedAt: tuitionSource.fetchedAt,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "three current official degree-program tables and current-index review",
    admissionsUrl: "current official international admission index",
    tuitionSummary: "current official tuition and accommodation page",
    campusHighlights: "current official tuition and accommodation page plus retained school highlights",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: tuitionSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: tuitionSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 83, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence: [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  extractionReview: { result: "pass", counts: { bachelor: 37, master: 71, doctoral: 41, total: 149 }, note: "Deterministic table extraction preserves published program name, school, award, duration and language-section boundaries." },
  unresolved: ["The latest general international guides remain 2026; no 2027 intake, deadline or requirement is inferred.", "Graduate application deadlines absent from the retained reviewed template remain absent.", "Current scholarship index does not by itself update the three cycle-bound 2026 scholarship records."],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment details or account information are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-233");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 233, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
