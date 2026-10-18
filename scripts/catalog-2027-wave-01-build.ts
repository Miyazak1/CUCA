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
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const releasePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-01.review.json");

const expected: Record<string, string> = {
  "tsinghua-undergraduate-schedule-2027": "77a3b4e5f4359a59dbd1bd05f1eddb3349dc5e5d29cdb04533fd9e5d1e36bdb0",
  "tsinghua-undergraduate-eligibility-2027": "a7ab92d7749553927defc0fb3cf7b0282e2304490a81f0ddafa8fce97a292fc7",
  "tsinghua-undergraduate-divisions-2027": "196d6e773d7a9be9cd119d24470fb6a0f4a777f5458df85953d8f6e53b3efac1",
  "tsinghua-undergraduate-fees-2027": "59740e5d60e5e660243aa25df7744c2ed48500f72e64794bf9bfbb1bba12dd98",
  "tsinghua-undergraduate-application-procedure-2027": "7a356227a54e4d0a0929ae7a19d513b7946e1d4a6411287b127cb488a123d27b",
  "nju-undergraduate-admissions-2027": "1483c3a275ea6ed0e83b5c1d9113956e1f69d6250266a3478faf0fb0aaa1d520",
  "nju-undergraduate-program-catalog-pdf-2027": "8479d4084ee3ab35f548ac0b09356811cc3a3149a437ba84a92f84655c2a5d86",
  "nju-master-admissions-2027": "0d8a983bb7e77d78b92df549269d8c035c269fa116a70e321618c5db2c3975df",
  "nju-master-program-catalog-pdf-2027": "c6ed1dc3527fa451c7371ba4ec1a0a00df6a02c212d680f35aafc729a191ada5",
  "nju-doctoral-admissions-2027": "5f77129f649138ce65dd350f32992fa8f0bac7a649887ab2bd444a9e057e3d0a",
  "nju-doctoral-program-catalog-pdf-2027": "5aac64dd34821f9bf4525b70036a1004036c68aa55a67b0bf709ae13a9f3d451",
};

const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status === 200 && expected[source.id] === source.sha256) evidence.set(source.id, { ...source, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missingEvidence = Object.keys(expected).filter((id) => !evidence.has(id));
if (missingEvidence.length) throw new Error(`Missing locked 2027 evidence: ${missingEvidence.join(", ")}`);
for (const source of evidence.values()) {
  const bytes = await readFile(resolve(source.runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
}

const release = JSON.parse(await readFile(releasePath, "utf8")) as CatalogSeedBundle;
const allPrograms = release.programs ?? [];
const existing2027Keys = new Set((release.programIntakes ?? []).filter((row) => row.intakeYear === 2027)
  .map((row) => `${row.programSlug}|${row.intakeTerm}|${row.intakeYear}`));
const selectedPrograms = new Map<string, CatalogSeedProgram>();
const intakes: CatalogSeedProgramIntake[] = [];

const textFromHtml = (source: ManifestSource & { runRoot: string }) => readFile(resolve(source.runRoot, source.artifactPath), "utf8").then((html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase());

const tsinghuaCatalog = await textFromHtml(evidence.get("tsinghua-undergraduate-divisions-2027")!);
const tsinghuaSchedule = evidence.get("tsinghua-undergraduate-schedule-2027")!;
const tsinghuaPrograms = allPrograms.filter((program) => program.schoolSlug === "tsinghua-university"
  && program.degreeLevel === "Undergraduate" && tsinghuaCatalog.includes(program.nameEn.toLowerCase()));
for (const program of tsinghuaPrograms) {
  selectedPrograms.set(program.slug, program);
  const key = `${program.slug}|Fall|2027`;
  if (existing2027Keys.has(key)) continue;
  const artsOnlyFirstRound = /art|design|fine arts/i.test(`${program.fieldCategory ?? ""} ${program.subjectArea ?? ""} ${program.nameEn}`);
  intakes.push({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2026-09-30T00:00:00.000Z",
    deadlineDate: artsOnlyFirstRound ? "2026-11-20T09:00:00.000Z" : "2027-02-28T09:00:00.000Z",
    deadlineLabel: artsOnlyFirstRound
      ? "Arts Division first-round deadline: November 20, 2026, 17:00 Beijing time"
      : "Final deadline: February 28, 2027, 17:00 Beijing time; first round closes November 20, 2026, 17:00 Beijing time",
    applicationRound: "2027 Tsinghua international undergraduate admission",
    status: "open",
    sourceUrl: tsinghuaSchedule.finalUrl ?? tsinghuaSchedule.url,
    sourceLabel: tsinghuaSchedule.label,
    sourceSha256: tsinghuaSchedule.sha256,
    capturedAt: tsinghuaSchedule.fetchedAt,
    sourceFieldLineage: {
      intakeYear: "2027 eligibility and schedule pages",
      openDate: "Schedule, First Round Application and Admission",
      deadlineDate: artsOnlyFirstRound ? "Schedule, Arts Division first-round-only rule" : "Schedule, Second Round Application and Admission",
      status: "derived from the official application window and capture date",
    },
  });
}

const njuUnconfirmed = new Set([
  "nanjing-university-archive-science",
  "nanjing-university-biomedical-engineering",
  "nanjing-university-electronic-commerce",
  "nanjing-university-insurance",
  "nanjing-university-library-science",
  "nanjing-university-marketing",
  "nanjing-university-new-energy-science-and-engineering",
  "nanjing-university-master-030201-school-of-government-political-theory-chinese",
  "nanjing-university-master-030202-school-of-government-chinese-and-foreign-political-institution-chinese",
  "nanjing-university-master-030302-school-of-social-and-behavioral-sciences-demography-chinese",
  "nanjing-university-master-040201-school-of-social-and-behavioral-sciences-basic-psychology-chinese",
  "nanjing-university-master-040203-school-of-social-and-behavioral-sciences-applied-psychology-chinese",
  "nanjing-university-master-050201-school-of-foreign-studies-english-language-and-literature-chinese",
  "nanjing-university-master-050202-school-of-foreign-studies-russian-language-and-literature-chinese",
  "nanjing-university-master-050203-school-of-foreign-studies-french-language-and-literature-chinese",
  "nanjing-university-master-050204-school-of-foreign-studies-german-language-and-literature-chinese",
  "nanjing-university-master-050205-school-of-foreign-studies-japanese-language-and-literature-chinese",
  "nanjing-university-master-050210-school-of-foreign-studies-asian-and-african-languages-and-literatures-chinese",
  "nanjing-university-master-050211-school-of-foreign-studies-foreign-linguistics-and-applied-linguistics-chinese",
  "nanjing-university-master-070201-physics-school-theoretical-physics-chinese",
  "nanjing-university-master-070205-physics-school-condensed-matter-physics-chinese",
  "nanjing-university-master-070207-physics-school-optics-chinese",
  "nanjing-university-master-0805j1-school-of-modern-engineering-and-applied-science-health-engineering-chinese",
  "nanjing-university-master-120401-school-of-government-public-administration-chinese",
  "nanjing-university-master-120402-school-of-government-social-medicine-and-health-management-chinese",
  "nanjing-university-master-120404-school-of-government-social-security-chinese",
  "nanjing-university-master-1204z3-school-of-government-emergency-management-chinese",
  "nanjing-university-doctoral-0805j1-school-of-modern-engineering-and-applied-science-health-engineering-chinese",
]);
const njuPrograms = allPrograms.filter((program) => program.schoolSlug === "nanjing-university" && !njuUnconfirmed.has(program.slug));
for (const program of njuPrograms) {
  selectedPrograms.set(program.slug, program);
  const key = `${program.slug}|Fall|2027`;
  if (existing2027Keys.has(key)) continue;
  const undergraduate = program.degreeLevel === "Undergraduate";
  const source = evidence.get(undergraduate ? "nju-undergraduate-admissions-2027"
    : program.degreeLevel === "Master" ? "nju-master-admissions-2027" : "nju-doctoral-admissions-2027")!;
  intakes.push({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2027-03-01T00:00:00.000Z",
    deadlineDate: undergraduate ? "2027-05-15T15:59:59.000Z" : "2027-05-20T15:59:59.000Z",
    deadlineLabel: undergraduate ? "Application period: March 1 to May 15, 2027" : "Application period: March 1 to May 20, 2027",
    applicationRound: `2027 Nanjing University international ${program.degreeLevel.toLowerCase()} admission`,
    status: "open",
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      intakeYear: "2027 application guide and degree-level program catalog",
      openDate: "application guide, application period",
      deadlineDate: "application guide, application period; end-of-day Beijing time normalized to UTC",
      status: "published future application window",
    },
  });
}

const schoolSlugs = new Set(["tsinghua-university", "nanjing-university"]);
const citySlugs = new Set(["beijing", "nanjing"]);
const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (release.cities ?? []).filter((row) => citySlugs.has(row.slug)),
  schools: (release.schools ?? []).filter((row) => schoolSlugs.has(row.slug)),
  programs: [...selectedPrograms.values()].sort((left, right) => left.slug.localeCompare(right.slug)),
  programIntakes: intakes.sort((left, right) => left.programSlug.localeCompare(right.programSlug)),
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 01 validation failed:\n${validation.errors.join("\n")}`);
const expectedNju = 233;
if (njuPrograms.length !== expectedNju) throw new Error(`Expected ${expectedNju} confirmed NJU routes, found ${njuPrograms.length}.`);
if (tsinghuaPrograms.length !== 83) throw new Error(`Expected 83 exact Tsinghua route matches, found ${tsinghuaPrograms.length}.`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: { schools: 10, objective: "replace stale 2026 intake data only where a 2027 official source directly supports the route" },
  wave: {
    number: 1,
    schools: [
      { schoolSlug: "tsinghua-university", confirmedPrograms: tsinghuaPrograms.length, newIntakes: intakes.filter((row) => row.programSlug.startsWith("tsinghua-university-")).length },
      { schoolSlug: "nanjing-university", confirmedPrograms: njuPrograms.length, newIntakes: intakes.filter((row) => row.programSlug.startsWith("nanjing-university-")).length },
    ],
    priorCompletedSchool: "tianjin-university",
  },
  excludedAsUnresolved: [...njuUnconfirmed].sort(),
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "No 2026 record is relabeled as 2027.",
    "Tsinghua routes require an exact English-name match in the current official divisions page; existing specialized 2027 intakes are preserved by key.",
    "NJU routes absent from the extracted 2027 degree-level catalog text/code comparison remain unresolved and receive no 2027 intake.",
    "The draft contains no applicant or account data.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  targetSchools: 10,
  waveSchools: 2,
  priorCompletedSchools: 1,
  confirmedPrograms: selectedPrograms.size,
  new2027Intakes: intakes.length,
  tsinghuaConfirmedPrograms: tsinghuaPrograms.length,
  nanjingConfirmedPrograms: njuPrograms.length,
  unresolvedNanjingPrograms: njuUnconfirmed.size,
  candidatePath,
  validationPath,
  reviewPath,
  candidateSha256,
}, null, 2));
