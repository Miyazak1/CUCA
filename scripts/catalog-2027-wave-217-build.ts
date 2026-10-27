import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type ExtractedProgram = {
  sourceRow: number;
  sourcePage: number;
  degreeLevel: "Bachelor" | "Master" | "Doctoral" | "Language Program";
  nameZh: string;
  nameEn: string;
  teachingLanguage: string;
  tuitionAmount: number;
  durationText: string;
  intakeText: string;
  languageRequirement: string;
  collegeZh: string;
  collegeEn: string;
  cscaOrResearchText: string;
};

const root = process.cwd();
const runs = [
  { name: "2026-10-27T05-41-02-512Z", locks: {
    "zjnu-international-undergraduate-guide-2027": "d7188d1ba63e3ae41f2f39c8891077b94fdeeaf9d1900259568b43ae084784b0",
    "zjnu-international-program-index-current-2027": "de596c0f8f8d88086a1f2f5c003d615af9276f1ec053bccef29711f1b071c702",
  } },
  { name: "2026-10-27T05-41-49-066Z", locks: {
    "zjnu-international-program-catalog-pdf-2027": "754e2441c8f5bac5988a50373f47bc10394589c0e4739e54f8b773043e5433ec",
    "zjnu-international-program-catalog-xls-2027": "7ab0f575d09b75ecff4d3a052eba4941315617af0c3650d25e45fa5c9e44d96f",
  } },
] as const;
const sources = new Map<string, ManifestSource>();
for (const run of runs) {
  const runRoot = resolve(root, "work/catalog-official", run.name);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  for (const [id, sha256] of Object.entries(run.locks)) {
    const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
    if (!source) throw new Error(`Missing locked ZJNU source: ${id}`);
    const evidence = await readFile(resolve(runRoot, source.artifactPath));
    if (createHash("sha256").update(evidence).digest("hex") !== sha256) throw new Error(`ZJNU evidence hash mismatch: ${id}`);
    sources.set(id, source);
  }
}

const extracted = JSON.parse(await readFile(resolve(root, "catalog-sources/zjnu-2027-programs.extracted.json"), "utf8")) as { version: number; schoolSlug: string; year: number; programs: ExtractedProgram[] };
if (extracted.schoolSlug !== "zhejiang-normal-university" || extracted.year !== 2027 || extracted.programs.length !== 99) throw new Error("Unexpected ZJNU extraction scope.");
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-144.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "jinhua");
const baseSchool = prior.schools?.find((row) => row.slug === extracted.schoolSlug);
if (!city || !baseSchool) throw new Error("Wave 144 ZJNU dependencies are missing.");
const guide = sources.get("zjnu-international-undergraduate-guide-2027")!;
const catalog = sources.get("zjnu-international-program-catalog-pdf-2027")!;
const guideFields = { sourceUrl: guide.finalUrl ?? guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt };
const catalogFields = { sourceUrl: catalog.finalUrl ?? catalog.url, sourceLabel: catalog.label, sourceSha256: catalog.sha256, capturedAt: catalog.fetchedAt };

const school = {
  ...baseSchool,
  applicationLevel: "The official 2027 catalog publishes 37 bachelor, 43 master, 18 doctoral and one general-scholar route. The 2027 admissions guide currently publishes the undergraduate application rules and calendar.",
  languageOfInstruction: "Chinese and English, with one multilingual Chinese/English/Japanese graduate route.",
  languageRequirement: "Each route has an official program-specific HSK, TOEFL, IELTS, Duolingo or Japanese-language threshold in the 2027 catalog.",
  hskRequirement: "Chinese-taught routes require HSK Level 4, 5 or 6 with the catalog's program-specific score. Two English-taught computer-science routes additionally require HSK Level 3 score 180.",
  englishRequirement: "Most English-taught routes require TOEFL 80, IELTS 5.5 or Duolingo 100. English-taught computer science requires TOEFL 85, IELTS 6.0 or Duolingo 110. Multilingual routes publish separate English/Japanese thresholds.",
  deadlineSummary: "International undergraduate applications run February 1-June 30, 2027; scholarship deadlines may differ. The captured 2027 catalog does not publish master, doctoral or general-scholar application deadlines.",
  tuitionSummary: "Annual tuition: bachelor CNY 18,000; master CNY 22,000 Chinese-taught, CNY 24,000 English-taught or CNY 26,000 English MBA; doctoral CNY 25,000 Chinese/multilingual or CNY 27,000 English; general scholar CNY 14,000.",
  applicationFee: "CNY 400 for the 2027 undergraduate application",
  admissionsUrl: guide.finalUrl ?? guide.url,
  cscaRequired: true,
  cscaRequirement: "All 2027 international undergraduate applicants must submit a CSCA score report in the subjects listed for their intended major.",
  cscaSubjects: ["Chinese", "Humanities Chinese", "Mathematics", "Physics", "Chemistry"],
  subjectTags: [...new Set([...(baseSchool.subjectTags ?? []), "Engineering", "Business", "Arts", "Psychology", "Life Sciences"])],
  languageTags: ["Chinese", "English", "Japanese", "HSK", "TOEFL", "IELTS", "Duolingo"],
  tuitionBandLabel: "CNY 14,000-27,000/year in the 2027 catalog",
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "99 official 2027 international study routes", "37 undergraduate routes with per-major CSCA subjects"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...guideFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 program catalog rows 1-99 and undergraduate guide",
    languageOfInstruction: "official 2027 program catalog",
    languageRequirement: "official program-specific language-requirement column",
    hskRequirement: "official program-specific language-requirement column",
    englishRequirement: "official program-specific language-requirement column",
    deadlineSummary: "official 2027 undergraduate application-time section; other levels absent",
    tuitionSummary: "official 2027 program catalog tuition column",
    applicationFee: "official 2027 undergraduate fee section",
    admissionsUrl: "registered official 2027 undergraduate guide",
    cscaRequired: "official 2027 undergraduate eligibility and materials sections",
    cscaRequirement: "official guide plus program-catalog subject column",
    cscaSubjects: "union of official 2027 undergraduate catalog subjects",
    tuitionBandLabel: "official 2027 program catalog",
    campusHighlights: "official 2027 catalog row count and undergraduate scope",
  },
};

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cscaSubjects = (value: string) => {
  const english = value.includes("/") ? value.split("/").slice(1).join("/") : value;
  return ["Humanities Chinese", "Chinese", "Mathematics", "Physics", "Chemistry"].filter((subject) => {
    if (subject === "Chinese" && english.includes("Humanities Chinese")) return false;
    return english.includes(subject);
  });
};
const programs: CatalogSeedProgram[] = extracted.programs.map((row) => {
  const isBachelor = row.degreeLevel === "Bachelor";
  const languageSuffix = row.teachingLanguage === "English" ? "english" : row.teachingLanguage === "Chinese" ? "chinese" : "multilingual";
  const durationYears = /^\d+$/.test(row.durationText) ? Number(row.durationText) : undefined;
  const subjects = isBachelor ? cscaSubjects(row.cscaOrResearchText) : [];
  const requirement = row.languageRequirement === "否/No" ? undefined : row.languageRequirement;
  return {
    slug: `zhejiang-normal-university-2027-${String(row.sourceRow).padStart(2, "0")}-${slugify(row.nameEn)}-${languageSuffix}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: row.nameEn,
    nameZh: row.nameZh,
    degreeLevel: row.degreeLevel,
    ...(durationYears ? { durationYears } : {}),
    fieldCategory: row.collegeEn || "International study",
    subjectArea: row.cscaOrResearchText || row.nameEn,
    teachingLanguage: row.teachingLanguage,
    ...(isBachelor && subjects.length ? { cscaSubjects: subjects, cscaRequirement: `CSCA subjects: ${subjects.join(", ")}.` } : {}),
    ...(requirement?.includes("HSK") ? { hskRequirement: requirement } : {}),
    ...(requirement && /TOEFL|IELTS|Duolingo|JLPT/.test(requirement) ? { englishRequirement: requirement } : {}),
    tuitionAmount: row.tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${row.tuitionAmount.toLocaleString("en-US")} per year in the official 2027 catalog.`,
    ...(isBachelor ? { scholarshipText: "The 2027 undergraduate guide lists Chinese Government, International Chinese Language Teachers, Zhejiang Provincial Government and university international-student scholarship channels; award-specific terms and deadlines must be checked separately." } : {}),
    applicationUrl: guide.finalUrl ?? guide.url,
    applicationNote: row.degreeLevel === "Language Program" ? "The catalog permits a half-year or one-year general-scholar route with March or September entry. It does not publish a cycle-specific application deadline." : row.degreeLevel === "Bachelor" ? "Apply online during the official February 1-June 30, 2027 undergraduate window. Scholarship deadlines may be earlier." : "The route is explicitly listed in the 2027 catalog, but a 2027 graduate application guide and deadline were not captured; no deadline is inferred.",
    hasScholarship: isBachelor,
    badgeText: `2027 ${row.degreeLevel.toLowerCase()} route`,
    displayTuition: `CNY ${row.tuitionAmount.toLocaleString("en-US")}/year`,
    displaySubjects: [row.nameEn, ...(row.cscaOrResearchText ? [row.cscaOrResearchText] : [])],
    displayGroup: row.degreeLevel === "Language Program" ? "Non-degree" : row.degreeLevel,
    displayGroupLabel: row.degreeLevel === "Language Program" ? "General scholar programs" : `${row.degreeLevel} programs`,
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: catalog.fetchedAt,
    ...catalogFields,
    sourceFieldLineage: {
      nameEn: `official catalog row ${row.sourceRow}, page ${row.sourcePage}`,
      nameZh: `official catalog row ${row.sourceRow}, page ${row.sourcePage}`,
      degreeLevel: "official academic-degree column",
      ...(durationYears ? { durationYears: "official length-of-schooling column when a single duration is published" } : {}),
      fieldCategory: "official college column",
      subjectArea: isBachelor ? "official CSCA-subject column" : "official research-directions column or program name",
      teachingLanguage: "official teaching-language column",
      ...(isBachelor && subjects.length ? {
        cscaSubjects: "official CSCA Test Subjects column",
        cscaRequirement: "official CSCA Test Subjects column",
      } : {}),
      ...(requirement?.includes("HSK") ? { hskRequirement: "official language-requirements column" } : {}),
      ...(requirement && /TOEFL|IELTS|Duolingo|JLPT/.test(requirement) ? { englishRequirement: "official language-requirements column" } : {}),
      tuitionAmount: "official tuition-fee column",
      tuitionPeriod: "official tuition-fee/year header",
      tuitionText: "official tuition-fee column",
      applicationUrl: "official 2027 undergraduate guide; graduate calendar remains unresolved",
      applicationNote: "official guide/catalog scope with unresolved deadlines retained",
    },
  };
});

const programIntakes: CatalogSeedProgramIntake[] = [];
for (const [index, row] of extracted.programs.entries()) {
  const program = programs[index];
  const terms = row.degreeLevel === "Language Program" ? ["Spring", "Fall"] : ["Fall"];
  for (const term of terms) {
    const isBachelor = row.degreeLevel === "Bachelor";
    programIntakes.push({
      programSlug: program.slug,
      intakeTerm: term,
      intakeYear: 2027,
      ...(isBachelor ? { openDate: "2027-02-01T00:00:00.000Z", deadlineDate: "2027-06-30T15:59:59.000Z" } : {}),
      deadlineLabel: isBachelor ? "Undergraduate applications run February 1-June 30, 2027; the guide publishes no time or timezone, so CUAC uses Beijing end-of-day for the normalized deadline. Scholarship deadlines may differ." : "The official 2027 catalog publishes the intake term but no application deadline for this route.",
      applicationRound: `Zhejiang Normal University ${term} 2027 ${row.degreeLevel} admission`,
      ...catalogFields,
      sourceFieldLineage: {
        intakeTerm: "official intake column",
        intakeYear: "official 2027 catalog title",
        ...(isBachelor ? {
          openDate: "official undergraduate application-time section",
          deadlineDate: "official undergraduate application-time section normalized to Beijing end-of-day",
        } : {}),
        deadlineLabel: isBachelor ? "official undergraduate application-time section" : "explicitly unresolved because the catalog has no deadline",
        applicationRound: "official level, intake term and catalog year",
      },
    });
  }
}

const candidate: CatalogSeedBundle = { version: 1, generatedAt: guide.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Wave 217 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: guide.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 91, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence: [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: [
    "The captured 2027 admissions guide is undergraduate-specific. Master, doctoral and general-scholar deadlines and application materials remain unresolved even though the official 2027 catalog lists their routes.",
    "The general-scholar row permits half-year or one-year study and March or September entry, but it does not publish separate tuition by duration or a deadline; no additional values are inferred.",
    "The undergraduate guide names four scholarship channels but does not publish award amounts or a single applicable deadline. No scholarship entity is created from generic channel descriptions.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Staff telephone numbers, email addresses, applicant contact fields and personal identifiers are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-217");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 217, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
