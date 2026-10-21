import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
type WorkbookRow = { row: number; college: string; major: string; language: string; master: string; doctoral: string };

const root = process.cwd();
const expected = new Map([
  ["cau-graduate-admissions-2027", "88b67da4b667246961d83618288c23ad39eac3c6a3f641e12f34b2737f2b8080"],
  ["cau-graduate-program-catalog-2027", "a15c7ba9e3eada10bd42418d30f8b2349d3b320b7ef3035552463a0dbf964b55"],
]);
const evidence = new Map<string, ManifestSource>();
const evidenceBytes = new Map<string, Buffer>();

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const row of manifest.sources ?? []) {
      if (row.status !== 200 || expected.get(row.id) !== row.sha256) continue;
      const bytes = await readFile(resolve(runRoot, row.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`CAU evidence hash mismatch: ${row.id}`);
      evidence.set(row.id, row);
      evidenceBytes.set(row.id, bytes);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
for (const id of expected.keys()) if (!evidence.has(id)) throw new Error(`Missing locked CAU graduate evidence: ${id}`);

const guide = evidence.get("cau-graduate-admissions-2027")!;
const workbook = evidence.get("cau-graduate-program-catalog-2027")!;
const generatedAt = [guide.fetchedAt, workbook.fetchedAt].sort().at(-1)!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "beijing");
const priorSchool = prior.schools?.find((row) => row.slug === "china-agricultural-university");
if (!city || !priorSchool) throw new Error("Missing CAU dependency rows.");

const decodeXml = (value: string) => value
  .replace(/<[^>]+>/g, "")
  .replace(/&#10;/g, " / ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, "\"");
const archive = unzipSync(evidenceBytes.get(workbook.id)!);
const sharedXml = strFromU8(archive["xl/sharedStrings.xml"]);
const sharedStrings = [...sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) =>
  [...match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => decodeXml(text[1])).join(""),
);
const sheetXml = strFromU8(archive["xl/worksheets/sheet1.xml"]);
const workbookRows: WorkbookRow[] = [];
let lastCollege = "";
for (const rowMatch of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const row = Number(rowMatch[1]);
  if (row < 3 || row > 39) continue;
  const cells: Record<string, string> = {};
  for (const cellMatch of rowMatch[2].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = cellMatch[1];
    const body = cellMatch[2] ?? "";
    const column = attributes.match(/r="([A-Z]+)\d+"/)?.[1];
    if (!column) continue;
    const type = attributes.match(/t="([^"]+)"/)?.[1];
    const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
    cells[column] = type === "s"
      ? sharedStrings[Number(rawValue)] ?? ""
      : type === "inlineStr"
        ? [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => decodeXml(text[1])).join("")
        : decodeXml(rawValue);
  }
  if (cells.A?.trim()) lastCollege = cells.A.trim();
  workbookRows.push({ row, college: lastCollege, major: cells.B?.trim() ?? "", language: cells.C?.trim() ?? "", master: cells.D?.trim() ?? "", doctoral: cells.E?.trim() ?? "" });
}
if (workbookRows.length !== 37 || workbookRows.some((row) => !row.college || !row.major || !row.language)) {
  throw new Error(`Expected 37 complete CAU workbook rows, found ${workbookRows.length}.`);
}

const englishPart = (value: string) => value
  .replace(/[\p{Script=Han}（）]/gu, " ")
  .replace(/\s*\/\s*/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const normalizeMajor = (row: WorkbookRow) => row.row === 39 ? "Business Administration (MBA)" : englishPart(row.major);
const normalizeCollege = (value: string) => englishPart(value);
const durationYears = (value: string) => Number(value.match(/\d+/)?.[0] ?? 0);
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const guideFields = { sourceUrl: guide.finalUrl ?? guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt };
const workbookFields = { sourceUrl: workbook.finalUrl ?? workbook.url, sourceLabel: workbook.label, sourceSha256: workbook.sha256, capturedAt: workbook.fetchedAt };

const school = {
  ...priorSchool,
  applicationLevel: "Undergraduate, Master and Doctoral",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "Chinese-taught graduate routes require HSK Level 5. English-taught graduate routes require prior English-medium bachelor or master study, or TOEFL iBT 90 or IELTS 6.0.",
  hskRequirement: "Undergraduate: HSK Level 5 or above, with Veterinary Medicine requiring HSK Level 5 and at least 250. Chinese-taught graduate routes: HSK Level 5.",
  englishRequirement: "English-taught graduate routes: prior bachelor or master study taught in English, or TOEFL iBT 90 or IELTS 6.0.",
  deadlineSummary: "2027 undergraduate applications: November 1, 2026-May 31, 2027. Graduate windows vary by funding route: CGS High-Level Type B November 1, 2026-February 28, 2027; Silk Road Type B March-May 2027; Beijing Government Scholarship November 2026-May 2027; other scholarships and self-funded applications November 2026-June 2027.",
  tuitionSummary: "Undergraduate CNY 20,000 per academic year; graduate CNY 26,000 per year for master's and CNY 30,000 per year for doctoral study.",
  applicationFee: "CNY 400, non-refundable.",
  admissionsUrl: guide.finalUrl ?? guide.url,
  ...guideFields,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: generatedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 undergraduate and graduate admission guides",
    languageOfInstruction: "official 2027 graduate program workbook",
    languageRequirement: "official 2027 graduate guide, Qualification of Applicants",
    hskRequirement: "official 2027 undergraduate and graduate guides",
    englishRequirement: "official 2027 graduate guide, Qualification of Applicants",
    deadlineSummary: "official 2027 undergraduate and graduate application periods",
    tuitionSummary: "official 2027 undergraduate and graduate fee sections",
    applicationFee: "official 2027 guide fee sections",
    admissionsUrl: "registered official 2027 graduate guide URL",
  },
};

const programRows: CatalogSeedProgram[] = [];
for (const row of workbookRows) {
  const languages = [row.language.includes("English") ? "English" : "", row.language.includes("Chinese") ? "Chinese" : ""].filter(Boolean);
  const degrees = [
    { degreeLevel: "Master", duration: durationYears(row.master), tuition: 26000 },
    { degreeLevel: "Doctoral", duration: durationYears(row.doctoral), tuition: 30000 },
  ].filter((degree) => degree.duration > 0);
  for (const degree of degrees) for (const teachingLanguage of languages) {
    const major = normalizeMajor(row);
    const college = normalizeCollege(row.college);
    const program = {
      slug: `china-agricultural-university-2027-${degree.degreeLevel.toLowerCase()}-${slugify(major)}-${teachingLanguage.toLowerCase()}`,
      schoolSlug: school.slug,
      citySlug: city.slug,
      nameEn: major,
      degreeLevel: degree.degreeLevel,
      durationYears: degree.duration,
      fieldCategory: college,
      subjectArea: major,
      teachingLanguage,
      ...(teachingLanguage === "Chinese" ? { hskRequirement: "HSK Level 5." } : { englishRequirement: "Prior bachelor or master study taught in English, or TOEFL iBT 90 or IELTS 6.0." }),
      tuitionAmount: degree.tuition,
      tuitionCurrency: "RMB",
      tuitionPeriod: "year",
      tuitionText: `RMB ${degree.tuition.toLocaleString("en-US")} per year.`,
      scholarshipText: "CAU lists Chinese Government Scholarship and Beijing Government Scholarship routes; eligibility and benefits depend on the separately published award notice.",
      applicationUrl: "https://apply.cau.edu.cn/",
      applicationNote: `${degree.degreeLevel} applicants must hold the corresponding prior degree and be under age ${degree.degreeLevel === "Master" ? "35" : "40"}. Required materials include passport, degree or expected-graduation evidence, transcripts from undergraduate study onward, two recommendations from associate professors or above, study/work history, a study or research plan of at least 1,000 words, language evidence, physical examination, criminal-record evidence and any academic-achievement materials.`,
      hasScholarship: true,
      ...workbookFields,
      status: "active" as const,
      verificationStatus: "verified" as const,
      lastVerifiedAt: generatedAt,
      sourceFieldLineage: {
        nameEn: `official 2027 graduate program workbook, row ${row.row}`,
        degreeLevel: `official 2027 graduate program workbook, row ${row.row}`,
        durationYears: `official 2027 graduate program workbook, row ${row.row}`,
        fieldCategory: `official 2027 graduate program workbook, row ${row.row}`,
        subjectArea: `official 2027 graduate program workbook, row ${row.row}`,
        teachingLanguage: `official 2027 graduate program workbook, row ${row.row}`,
        ...(teachingLanguage === "Chinese"
          ? { hskRequirement: "official 2027 graduate guide, Qualification of Applicants" }
          : { englishRequirement: "official 2027 graduate guide, Qualification of Applicants" }),
        tuitionAmount: "official 2027 graduate guide, Cost",
        scholarshipText: "official 2027 graduate guide, Scholarship Information",
        applicationUrl: "official CAU international application portal linked by the guide",
        applicationNote: "official 2027 graduate guide, Qualification of Applicants and Application Materials",
      },
    };
    programRows.push(program);
  }
}
if (programRows.length !== 77 || new Set(programRows.map((row) => row.slug)).size !== 77) {
  throw new Error(`Expected 77 unique CAU graduate routes, found ${programRows.length}.`);
}

const programIntakes = programRows.map((program) => ({
  programSlug: String(program.slug),
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "CGS High-Level Type B: November 1, 2026-February 28, 2027; Silk Road Type B: March-May 2027; Beijing Government Scholarship: November 2026-May 2027; other scholarships and self-funded applications: November 2026-June 2027. Exact days are not published for month-only windows.",
  applicationRound: "2027 China Agricultural University international graduate admission",
  ...guideFields,
  sourceFieldLineage: {
    intakeTerm: "official 2027 graduate admission cycle",
    intakeYear: "official guide title and admission cycle",
    deadlineLabel: "official 2027 graduate application periods; month-only dates preserved without inference",
    applicationRound: "official 2027 graduate guide",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs: programRows, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 64 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], newGraduatePrograms: programRows.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The official guide gives only month-level closing windows for the Silk Road, Beijing Government, other-scholarship and self-funded routes, so no deadlineDate is inferred.",
    "Scholarship schemes are named, but award-specific coverage and route eligibility are not inferred from the general graduate guide.",
    "The workbook provides no exact enrollment date, so the intake is recorded as Fall 2027 without an invented start date.",
  ],
  notes: [
    "All 37 official workbook rows are expanded deterministically into 77 degree-and-language-specific routes.",
    "Existing 2027 undergraduate routes remain intact and are merged separately by the unified release builder.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-64.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-64.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-64.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 64, candidateSha256, counts: { cities: 1, schools: 1, programs: programRows.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
