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
const expected: Record<string, string> = {
  "tsinghua-international-graduate-admissions-2027": "1c9b768b16b1e9f1b602ba3cbe6c1c26c1e4b316158d981484eafe7ea1ea49ba",
  "tsinghua-international-graduate-catalog-2027": "6b87f390b2ad5ccca2a405c048171a843f70f182547e1fa2dca5dd5a0d6ef163",
  "tsinghua-international-graduate-tuition-2027": "86a5b60157fe6fd0fc77d2b4b6bb89ef8beebfedb50dbdc2c7e19f1348ad1b46",
};
const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status === 200 && expected[source.id] === source.sha256) evidence.set(source.id, { ...source, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked Tsinghua Wave 50 evidence: ${missing.join(", ")}`);
for (const source of evidence.values()) {
  const bytes = await readFile(resolve(source.runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Wave 50 evidence hash mismatch: ${source.id}`);
}

const release = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = release.schools?.find((row) => row.slug === "tsinghua-university");
const city = release.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 50 Tsinghua dependencies are missing.");

const guide = evidence.get("tsinghua-international-graduate-admissions-2027")!;
const catalog = evidence.get("tsinghua-international-graduate-catalog-2027")!;
const tuition = evidence.get("tsinghua-international-graduate-tuition-2027")!;
const tuitionHtml = await readFile(resolve(tuition.runRoot, tuition.artifactPath), "utf8");
const catalogHtml = await readFile(resolve(catalog.runRoot, catalog.artifactPath), "utf8");
if (!catalogHtml.includes("2027年清华大学招收国际博士研究生专业目录") || !catalogHtml.includes("2027年清华大学招收国际硕士研究生专业目录")) {
  throw new Error("Wave 50 catalog index no longer exposes both 2027 international graduate catalogs.");
}

const decode = (value: string) => value
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, "\"")
  .replace(/&amp;/gi, "&")
  .replace(/&ndash;/gi, "–")
  .replace(/&mdash;/gi, "—")
  .replace(/\s+/g, " ")
  .trim();
const slugify = (value: string) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalizeName = (value: string) => value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
const tables = [...tuitionHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
if (tables.length !== 2) throw new Error(`Expected two Tsinghua tuition tables, found ${tables.length}.`);
const rows = [...tables[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[0]);
const specs: Array<{ nameEn: string; degreeLevel: "Master" | "Doctoral"; tuitionAmount?: number; tuitionPeriod?: string; tuitionText: string }> = [];
for (const row of rows) {
  const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
  if (cells.length < 2) continue;
  const programCell = cells.at(-2)!;
  const feeText = decode(cells.at(-1)!);
  const nameParts = [...programCell.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi)]
    .map((match) => decode(match[1]))
    .filter((text) => /[A-Za-z]{3}/.test(text));
  const nameEn = nameParts.join(" ").replace(/\s+([,;)])/g, "$1").replace(/\(\s+/g, "(").trim();
  if (!nameEn || /Graduate Programs in English/i.test(nameEn)) continue;
  const degreeLevel = /doctoral|\bphd\b/i.test(nameEn) ? "Doctoral" : "Master";
  const amountMatch = feeText.match(/([0-9][0-9,]*)\s*\(/);
  const tuitionAmount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined;
  const tuitionPeriod = /Full Program/i.test(feeText) ? "program" : /\/Year/i.test(feeText) ? "year" : undefined;
  specs.push({ nameEn, degreeLevel, tuitionAmount, tuitionPeriod, tuitionText: feeText });
}
if (specs.length !== 41) throw new Error(`Expected 41 explicit English-taught Tsinghua graduate program rows, found ${specs.length}.`);
if (new Set(specs.map((row) => normalizeName(row.nameEn))).size !== specs.length) throw new Error("Wave 50 extracted duplicate Tsinghua program names.");

const existingByName = new Map(
  (release.programs ?? [])
    .filter((row) => row.schoolSlug === school.slug && (row.degreeLevel === "Master" || row.degreeLevel === "Doctoral"))
    .map((row) => [`${row.degreeLevel}|${normalizeName(row.nameEn)}`, row]),
);
const tuitionFields = {
  sourceUrl: tuition.finalUrl ?? tuition.url,
  sourceLabel: tuition.label,
  sourceSha256: tuition.sha256,
  capturedAt: tuition.fetchedAt,
};
const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const existing = existingByName.get(`${spec.degreeLevel}|${normalizeName(spec.nameEn)}`);
  return {
    ...(existing ?? {}),
    slug: existing?.slug ?? `tsinghua-university-2027-${spec.degreeLevel.toLowerCase()}-${slugify(spec.nameEn)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: spec.nameEn,
    degreeLevel: spec.degreeLevel,
    teachingLanguage: "English",
    ...(spec.tuitionAmount === undefined ? {} : { tuitionAmount: spec.tuitionAmount, tuitionCurrency: "CNY" }),
    ...(spec.tuitionPeriod === undefined ? {} : { tuitionPeriod: spec.tuitionPeriod }),
    tuitionText: spec.tuitionText,
    applicationUrl: guide.finalUrl ?? guide.url,
    applicationNote: "Apply through the Tsinghua graduate application service system. Department-specific language thresholds, deadlines, additional materials and work-experience rules must be checked in the 2027 program catalog before submission.",
    badgeText: "Fall 2027",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: tuition.fetchedAt,
    ...tuitionFields,
    sourceFieldLineage: {
      nameEn: "2027 international graduate tuition table, English-program name",
      degreeLevel: "program name and degree wording in the 2027 tuition table",
      teachingLanguage: "2027 tuition table, Graduate Programs in English section",
      tuitionAmount: "2027 tuition table; omitted when the source says to be released",
      tuitionCurrency: "2027 tuition table heading, RMB Yuan",
      tuitionPeriod: "2027 tuition table, per-year or full-program label",
      tuitionText: "2027 tuition table, complete fee cell",
      applicationUrl: "2027 international graduate admissions guide",
      applicationNote: "2027 admissions guide and program-catalog instructions",
    },
  };
});

const intakeFields = {
  sourceUrl: guide.finalUrl ?? guide.url,
  sourceLabel: guide.label,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
};
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "Applications generally run from mid-September 2026 to February 2027; the exact deadline and rounds vary by department and program and must be checked in the official 2027 program catalog.",
  applicationRound: "Tsinghua University 2027 International Graduate Admission",
  status: "open",
  ...intakeFields,
  sourceFieldLineage: {
    intakeTerm: "2027 guide, late-August or early-September registration",
    intakeYear: "2027 guide title",
    deadlineLabel: "2027 guide, general application period and department-specific deadline rule",
    applicationRound: "2027 guide title",
    status: "general application period compared with capturedAt; no department-specific deadline is inferred",
  },
}));

const scholarshipFields = { ...intakeFields, sourceFieldLineage: { title: "2027 guide, Scholarships section", coverage: "2027 guide, Scholarships section", applicableDegree: "2027 international graduate scope" } };
const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "tsinghua-chinese-government-scholarship-international-graduate-2027",
    title: "Chinese Government Scholarship for Tsinghua International Graduate Students",
    nameZh: "清华大学国际研究生中国政府奖学金",
    schoolSlug: school.slug,
    type: "government",
    typeLabel: "Chinese Government Scholarship",
    providerName: "China Scholarship Council",
    fundingLevel: "full_or_partial",
    coverage: "Full awards generally cover tuition, accommodation, living allowance and comprehensive medical insurance; partial awards cover one or more of those items. Annual review applies.",
    applicableDegree: "Master, Doctoral",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: guide.fetchedAt,
    ...scholarshipFields,
  },
  {
    slug: "tsinghua-beijing-government-scholarship-international-graduate-2027",
    title: "Beijing Government Scholarship for Tsinghua International Graduate Students",
    nameZh: "清华大学国际研究生北京来华留学生政府奖学金",
    schoolSlug: school.slug,
    type: "government",
    typeLabel: "Beijing Government Scholarship",
    providerName: "Beijing Municipal Government",
    fundingLevel: "partial",
    coverage: "Generally covers tuition and comprehensive medical insurance for one academic year.",
    applicableDegree: "Master, Doctoral",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: guide.fetchedAt,
    ...scholarshipFields,
  },
];

const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 50 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
  unresolved: [
    "The interactive program catalog publishes department-specific deadlines, language thresholds and extra requirements; those fields remain absent from this row-level tuition-table extraction.",
    "Program duration is not published in the locked tuition table or the university-level guide and is therefore not inferred.",
    "The fee table contains one program whose tuition is still marked for release; that program retains no numeric tuition amount.",
    "Scholarship application deadlines and award-specific eligibility are not stated in the university-level guide and remain absent.",
  ],
  notes: [
    "The official 2027 tuition schedule explicitly lists 41 English-taught graduate program rows; all are represented without splitting slash-delimited official route groups into unsupported subprograms.",
    "The general September-to-February application window is retained only as a label because exact deadlines vary by department and program.",
    "No applicant, account, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-50");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 50, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
