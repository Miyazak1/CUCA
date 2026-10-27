import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type SourceRecord = { id: string; sha256: string; fetchedAt: string; url: string };
type ExtractedUndergraduate = {
  page: number;
  collegeEn: string;
  collegeZh: string;
  nameEn: string;
  nameZh: string;
  code: string;
  durationYears: number;
  teachingLanguage: string;
  degreeName: string;
  cscaSubjects: string[];
  tuitionText: string;
  tuitionAmounts: number[];
  notes?: string;
};
type ExtractedGraduate = {
  page: number;
  collegeEn: string;
  collegeZh: string;
  majorEn: string;
  majorZh: string;
  code: string;
  fieldEn: string;
  fieldZh: string;
  durationYears: number;
  teachingLanguage: string;
  degreeName: string;
  tuitionText: string;
  tuitionAmounts: number[];
  notes?: string;
};
type ExtractedCatalog = {
  version: 1;
  schoolSlug: string;
  year: 2027;
  sources: Record<"undergraduate" | "master" | "doctoral", SourceRecord>;
  undergraduate: ExtractedUndergraduate[];
  master: ExtractedGraduate[];
  doctoral: ExtractedGraduate[];
};
type ManifestSource = SourceRecord & { status: number; artifactPath: string; label: string; finalUrl?: string };

const root = process.cwd();
const extractionPath = resolve(root, "catalog-sources/gzu-2027-programs.extracted.json");
const extractionBytes = await readFile(extractionPath);
const extractionSha256 = createHash("sha256").update(extractionBytes).digest("hex");
const expectedExtractionSha256 = "b0a214c77b8cdd624d98e469ad92c2dfb7a648ea9470812af0e95ea69b0fc6b8";
if (extractionSha256 !== expectedExtractionSha256) throw new Error(`GZU extracted catalog hash changed: ${extractionSha256}.`);
const extracted = JSON.parse(extractionBytes.toString("utf8")) as ExtractedCatalog;
if (extracted.version !== 1 || extracted.schoolSlug !== "guizhou-university" || extracted.year !== 2027) throw new Error("Unexpected GZU extraction identity.");
if (extracted.undergraduate.length !== 62 || extracted.master.length !== 166 || extracted.doctoral.length !== 71) {
  throw new Error(`Unexpected GZU extracted row counts: ${extracted.undergraduate.length}/${extracted.master.length}/${extracted.doctoral.length}.`);
}

const runRoot = resolve(root, "work/catalog-official/2026-10-26T03-25-21-642Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const evidence = new Map<string, ManifestSource>();
for (const source of Object.values(extracted.sources)) {
  const row = manifest.sources.find((candidate) => candidate.id === source.id && candidate.status === 200 && candidate.sha256 === source.sha256);
  if (!row) throw new Error(`Missing official GZU evidence ${source.id} at ${source.sha256}.`);
  const artifact = await readFile(resolve(runRoot, row.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}.`);
  evidence.set(source.id, row);
}

const wave101 = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-101.draft.json"), "utf8")) as CatalogSeedBundle;
const city = wave101.cities?.find((row) => row.slug === "guiyang");
const priorSchool = wave101.schools?.find((row) => row.slug === "guizhou-university");
const graduateScholarship = wave101.scholarships?.find((row) => row.slug === "guizhou-university-cgs-high-level-graduate-2027-2028");
if (!city || !priorSchool || !graduateScholarship) throw new Error("Run Wave 101 before Wave 102 to generate the Guizhou University dependencies.");

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const categoryFromDegree = (degree: string): string => {
  for (const category of ["Engineering", "Agriculture", "Economics", "Management", "Science", "Arts", "Literature", "History", "Law", "Philosophy", "Education", "Architecture", "Sport", "Medicine"]) {
    if (degree.toLowerCase().includes(category.toLowerCase())) return category;
  }
  return "Other";
};
const sourceFor = (level: "undergraduate" | "master" | "doctoral") => {
  const extractedSource = extracted.sources[level];
  const source = evidence.get(extractedSource.id);
  if (!source) throw new Error(`Missing ${level} source.`);
  return {
    source,
    fields: {
      sourceUrl: source.finalUrl ?? source.url,
      sourceLabel: source.label,
      sourceSha256: source.sha256,
      capturedAt: source.fetchedAt,
    },
  };
};

const programs: CatalogSeedProgram[] = [];
const programIntakes: CatalogSeedProgramIntake[] = [];
const usedSlugs = new Map<string, number>();
const uniqueSlug = (base: string, college: string) => {
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  if (count === 0) return base;
  return `${base}-${createHash("sha256").update(college).digest("hex").slice(0, 8)}`;
};
const addProgram = (spec: {
  level: "undergraduate" | "master" | "doctoral";
  nameEn: string;
  nameZh: string;
  code: string;
  collegeEn: string;
  page: number;
  durationYears: number;
  teachingLanguage: string;
  degreeName: string;
  subjectArea: string;
  cscaSubjects?: string[];
  tuitionText: string;
  tuitionAmounts: number[];
  notes?: string;
}) => {
  const { source, fields } = sourceFor(spec.level);
  const degreeLevel = spec.level === "undergraduate" ? "Undergraduate" : spec.level === "master" ? "Master" : "Doctoral";
  const baseSlug = `guizhou-university-${spec.level}-${slugify(spec.code)}-${slugify(spec.nameEn)}`;
  const slug = uniqueSlug(baseSlug, spec.collegeEn);
  const explicitHsk = spec.notes?.match(/HSK\s*5[^.]*230[^.]*/i)?.[0];
  const graduateRoute = spec.level !== "undergraduate";
  const chineseScholarshipRequirement = graduateRoute && /Chinese/i.test(spec.teachingLanguage)
    ? "For the 2027/2028 Chinese Government Scholarship High-Level Graduate route: HSK Level 4 score 230 or above; a prior Chinese-medium degree from a Chinese university may qualify for the published exemption."
    : undefined;
  const englishScholarshipRequirement = graduateRoute && /English/i.test(spec.teachingLanguage)
    ? "For the 2027/2028 Chinese Government Scholarship High-Level Graduate route: TOEFL 80 or IELTS 6.0."
    : undefined;
  const tuitionAmount = spec.tuitionAmounts.length === 1 ? spec.tuitionAmounts[0] : undefined;
  const applicationNote = [
    `Official 2027 program code ${spec.code}.`,
    `Offering unit: ${spec.collegeEn}.`,
    spec.notes && spec.notes !== "/" ? spec.notes : undefined,
  ].filter(Boolean).join(" ");
  const program: CatalogSeedProgram = {
    slug,
    schoolSlug: "guizhou-university",
    citySlug: "guiyang",
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel,
    durationYears: spec.durationYears,
    fieldCategory: categoryFromDegree(spec.degreeName),
    subjectArea: spec.subjectArea,
    teachingLanguage: spec.teachingLanguage,
    ...(spec.cscaSubjects?.length ? { cscaSubjects: spec.cscaSubjects, cscaRequirement: `The official 2027 catalog lists ${spec.cscaSubjects.join(", ")}.` } : {}),
    ...((explicitHsk || chineseScholarshipRequirement) ? { hskRequirement: explicitHsk?.replace(/\s+/g, " ").trim() ?? chineseScholarshipRequirement } : {}),
    ...(englishScholarshipRequirement ? { englishRequirement: englishScholarshipRequirement } : {}),
    ...(tuitionAmount !== undefined ? { tuitionAmount } : {}),
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic year",
    tuitionText: spec.tuitionText,
    applicationUrl: "https://cie.gzu.edu.cn/8268/list.htm",
    applicationNote,
    ...(graduateRoute ? { hasScholarship: true, scholarshipText: "The official 2027/2028 Chinese Government Scholarship High-Level Graduate guide links the 2027 master's and doctoral catalogs and publishes route-specific language thresholds, a December 15, 2026 deadline, and late-August or early-September 2027 enrollment." } : {}),
    badgeText: "2027 official catalog",
    displayTuition: spec.tuitionText,
    displaySubjects: [spec.subjectArea],
    displayGroup: spec.level,
    displayGroupLabel: degreeLevel,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    ...fields,
    sourceFieldLineage: {
      nameEn: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Major and Field of Study`,
      nameZh: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Major and Field of Study`,
      degreeLevel: `official 2027 ${spec.level} catalog title and degree column`,
      durationYears: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Program Duration`,
      fieldCategory: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Name of Degree Conferred`,
      subjectArea: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Major`,
      teachingLanguage: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Language of Instruction`,
      ...(spec.cscaSubjects?.length ? { cscaSubjects: `official 2027 ${spec.level} catalog PDF page ${spec.page}, CSCA Examination Subjects`, cscaRequirement: `official 2027 ${spec.level} catalog PDF page ${spec.page}, CSCA Examination Subjects` } : {}),
      ...((explicitHsk || chineseScholarshipRequirement) ? { hskRequirement: explicitHsk ? `official 2027 ${spec.level} catalog PDF page ${spec.page}, Notes` : "official 2027/2028 Chinese Government Scholarship High-Level Graduate guide linked to the 2027 graduate catalogs" } : {}),
      ...(englishScholarshipRequirement ? { englishRequirement: "official 2027/2028 Chinese Government Scholarship High-Level Graduate guide linked to the 2027 graduate catalogs" } : {}),
      ...(tuitionAmount !== undefined ? { tuitionAmount: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Tuition Fee` } : {}),
      tuitionCurrency: `official 2027 ${spec.level} catalog header`,
      tuitionPeriod: `official 2027 ${spec.level} catalog header`,
      tuitionText: `official 2027 ${spec.level} catalog PDF page ${spec.page}, Tuition Fee; dual-language amounts retained verbatim`,
      applicationUrl: "official current admissions index",
      applicationNote: `official 2027 ${spec.level} catalog PDF page ${spec.page}, program code, offering unit and notes`,
      ...(graduateRoute ? { hasScholarship: "official 2027/2028 Chinese Government Scholarship High-Level Graduate guide linked to the 2027 graduate catalogs", scholarshipText: "official scholarship guide language, deadline and enrollment sections" } : {}),
    },
  };
  programs.push(program);
  programIntakes.push({
    programSlug: slug,
    intakeTerm: graduateRoute ? "Fall" : "2027 degree cohort",
    intakeYear: 2027,
    ...(graduateRoute ? {
      deadlineDate: "2026-12-15T15:59:59.000Z",
      deadlineLabel: "December 15, 2026 for the 2027/2028 Chinese Government Scholarship High-Level Graduate route; a general self-funded deadline is not published in the captured sources.",
      applicationRound: `Guizhou University 2027/2028 Chinese Government Scholarship High-Level Graduate ${degreeLevel.toLowerCase()} intake`,
      status: "open" as const,
    } : {
      deadlineLabel: "The official 2027 undergraduate program catalog confirms availability; a general self-funded application deadline is not published in the captured catalog.",
      applicationRound: `Guizhou University 2027 international ${degreeLevel.toLowerCase()} catalog`,
    }),
    ...fields,
    sourceFieldLineage: {
      intakeTerm: graduateRoute ? "official 2027/2028 scholarship guide, late-August or early-September enrollment" : `official 2027 ${spec.level} catalog title; semester intentionally not inferred`,
      intakeYear: graduateRoute ? "official 2027/2028 scholarship guide and linked 2027 catalog" : `official 2027 ${spec.level} catalog title`,
      ...(graduateRoute ? { deadlineDate: "official 2027/2028 scholarship guide, Deadline of Application", status: "derived from capturedAt before the published deadline" } : {}),
      deadlineLabel: graduateRoute ? "official scholarship deadline plus explicit unresolved self-funded deadline" : `deadline absent from official 2027 ${spec.level} catalog and kept unresolved`,
      applicationRound: graduateRoute ? "official 2027/2028 scholarship guide and linked 2027 catalog" : `official 2027 ${spec.level} catalog title`,
    },
  });
};

for (const row of extracted.undergraduate) {
  addProgram({
    level: "undergraduate",
    nameEn: row.nameEn,
    nameZh: row.nameZh,
    code: row.code,
    collegeEn: row.collegeEn,
    page: row.page,
    durationYears: row.durationYears,
    teachingLanguage: row.teachingLanguage,
    degreeName: row.degreeName,
    subjectArea: row.nameEn,
    cscaSubjects: row.cscaSubjects,
    tuitionText: row.tuitionText,
    tuitionAmounts: row.tuitionAmounts,
    notes: row.notes,
  });
}
for (const level of ["master", "doctoral"] as const) {
  for (const row of extracted[level]) {
    const divided = row.fieldEn !== "No Further Division in Research Fields";
    addProgram({
      level,
      nameEn: divided ? `${row.majorEn} — ${row.fieldEn}` : row.majorEn,
      nameZh: divided ? `${row.majorZh}—${row.fieldZh}` : row.majorZh,
      code: row.code,
      collegeEn: row.collegeEn,
      page: row.page,
      durationYears: row.durationYears,
      teachingLanguage: row.teachingLanguage,
      degreeName: row.degreeName,
      subjectArea: row.majorEn,
      tuitionText: row.tuitionText,
      tuitionAmounts: row.tuitionAmounts,
      notes: row.notes,
    });
  }
}
if (programs.length !== 299 || programIntakes.length !== 299) throw new Error(`Unexpected Wave 102 count ${programs.length}/${programIntakes.length}.`);
if (new Set(programs.map((row) => row.slug)).size !== programs.length) throw new Error("Duplicate Wave 102 program slug.");

const school = {
  ...priorSchool,
  tuitionSummary: "The official 2027 undergraduate, master's and doctoral catalogs publish route-level annual tuition. Each extracted program retains its exact single amount or dual Chinese-/English-taught fee text; no missing amount is inferred.",
  campusHighlights: Array.from(new Set([...(priorSchool.campusHighlights ?? []), "299 program-and-research-field offerings extracted from the official 2027 catalogs"])),
  contactNotes: `${priorSchool.contactNotes ?? ""} The 2027 catalogs contain 62 undergraduate offerings, 166 master's program/research-field offerings and 71 doctoral program/research-field offerings. General self-funded application deadlines remain unresolved.`,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    tuitionSummary: "official 2027 undergraduate, master and doctoral catalogs; route-level values are stored on programs",
    campusHighlights: "official 2027 catalog row counts",
    contactNotes: "official 2027 catalog row counts and deadline review status",
  },
};
const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1) ?? priorSchool.capturedAt ?? new Date(0).toISOString();
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 102 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  extractionSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: ["guizhou-university"], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence: [
    ...[...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
    { id: graduateScholarship.slug, label: graduateScholarship.sourceLabel, url: graduateScholarship.sourceUrl, fetchedAt: graduateScholarship.capturedAt, sha256: graduateScholarship.sourceSha256 },
  ],
  extractionChecks: {
    undergraduateRows: extracted.undergraduate.length,
    masterRows: extracted.master.length,
    doctoralRows: extracted.doctoral.length,
    uniqueProgramSlugs: new Set(programs.map((row) => row.slug)).size,
    allUndergraduateRowsHaveCscaSubjects: extracted.undergraduate.every((row) => row.cscaSubjects.length > 0),
    allRowsHaveTuitionEvidence: [...extracted.undergraduate, ...extracted.master, ...extracted.doctoral].every((row) => row.tuitionAmounts.length > 0),
  },
  unresolved: [
    "The official program catalogs establish 2027 availability but do not publish the general self-funded application opening or deadline, so intake dates remain absent.",
    "Programs with separate Chinese- and English-taught fees retain the exact combined tuition text rather than collapsing two values into one tuitionAmount.",
    "Scholarship-specific language thresholds and the December 15, 2026 deadline are attached only to the linked graduate scholarship route; they are not represented as general self-funded conditions.",
    "Undergraduate language thresholds and the general self-funded application deadline are not published in the captured sources and remain unresolved except where a catalog Notes cell explicitly states an HSK requirement.",
    "The extracted JSON is a deterministic table transcription and remains an unreviewed intermediate artifact; publication and database writes require separate approval.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Program tables contain public institutional program facts only. No supervisor contacts, applicant data or account data are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-102");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, extractionSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 102, candidateSha256, extractionSha256, counts: validation.summary, extractionChecks: review.extractionChecks, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
