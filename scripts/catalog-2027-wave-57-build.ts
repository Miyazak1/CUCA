import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
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

type RequirementRow = {
  degreeLevel: "Master" | "Doctoral";
  nameZh: string;
  requirement: string;
};

const root = process.cwd();
const sourceId = "blcu-graduate-entry-requirements-current";
const expectedSha256 = "ef75e4913a3aa08a07383a529622be9dd19ccc5745cfa0adeb7312667a487695";
let source: ManifestSource | undefined;
let sourceHtml = "";

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const candidate = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!candidate) continue;
    const bytes = await readFile(resolve(runRoot, candidate.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== expectedSha256) throw new Error("BLCU requirement evidence hash mismatch.");
    source = candidate;
    sourceHtml = bytes.toString("utf8");
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source || !sourceHtml) throw new Error("Missing locked BLCU graduate requirement evidence.");

const decodeCell = (value: string) => value
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/\s+/g, " ")
  .trim();

const parsedRows: RequirementRow[] = [];
for (const rowMatch of sourceHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => decodeCell(match[1]));
  const programCellIndex = cells.findIndex((cell) => /[（(](硕士|博士)[）)]/.test(cell));
  if (programCellIndex < 0) continue;
  const degreeMarker = cells[programCellIndex].match(/[（(](硕士|博士)[）)]/)?.[1];
  if (!degreeMarker) continue;
  const degreeLevel = degreeMarker === "硕士" ? "Master" : "Doctoral";
  const rawName = cells[programCellIndex].replace(/[（(](硕士|博士)[）)]/g, "").trim();
  const requirement = cells.at(-1)?.trim() ?? "";
  if (!requirement || requirement === cells[programCellIndex]) continue;

  const groupedNames = rawName.startsWith("*")
    ? rawName.split("*").map((name) => name.trim()).filter(Boolean)
    : [rawName];
  for (let nameZh of groupedNames) {
    nameZh = nameZh.replace(/英文授课$/, "").trim();
    parsedRows.push({ degreeLevel, nameZh, requirement });
  }
}

const requirementByRoute = new Map(parsedRows.map((row) => [`${row.degreeLevel}|${row.nameZh}`, row]));
if (requirementByRoute.size < 60) throw new Error(`Expected at least 60 distinct BLCU requirement routes, found ${requirementByRoute.size}.`);

const extractHsk = (text: string) => text.match(/HSK\s*(?:五|六|[4-6])级(?:不低于)?\s*\d+\s*分(?:或以上)?(?:[，,（(][^）)]*(?:不低于)?\s*\d+\s*分[）)]?)?/i)?.[0]?.trim();
const extractEnglish = (text: string) => {
  const parts = [
    text.match(/雅思[（(]?\s*\d(?:\.\d)?\s*分?(?:[）)])?(?:[（(][^）)]*[）)])?/i)?.[0],
    text.match(/托福(?:[（(]IBT\s*)?\s*\d+\s*分?[）)]?/i)?.[0],
    /英语母语/.test(text) ? "英语母语" : undefined,
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(" / ") : undefined;
};

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-49.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "beijing-language-and-culture-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city || dependency.programs?.length !== 77 || dependency.programIntakes?.length !== 77) {
  throw new Error("Wave 57 BLCU dependencies are incomplete.");
}

let enrichedCount = 0;
let hskCount = 0;
let englishCount = 0;
const programs: CatalogSeedProgram[] = dependency.programs.map((program) => {
  const row = requirementByRoute.get(`${program.degreeLevel}|${program.nameZh ?? ""}`);
  if (!row) return program;
  enrichedCount += 1;
  const hskRequirement = extractHsk(row.requirement);
  const englishRequirement = extractEnglish(row.requirement);
  if (hskRequirement) hskCount += 1;
  if (englishRequirement) englishCount += 1;
  return {
    ...program,
    ...(hskRequirement ? { hskRequirement } : {}),
    ...(englishRequirement ? { englishRequirement } : {}),
    applicationNote: `${program.applicationNote ?? ""} Current maintained BLCU route requirement: ${row.requirement}`.trim(),
    lastVerifiedAt: source!.fetchedAt,
    sourceFieldLineage: {
      ...(program.sourceFieldLineage ?? {}),
      ...(hskRequirement ? { hskRequirement: "maintained official graduate entry-requirement table; exact degree-level Chinese program-name match" } : {}),
      ...(englishRequirement ? { englishRequirement: "maintained official graduate entry-requirement table; exact degree-level Chinese program-name match" } : {}),
      applicationNote: "2027 program table combined with the maintained official route-specific entry-requirement table",
    },
  };
});

if (enrichedCount !== 56) throw new Error(`Expected 56 exactly matched BLCU 2027 routes with explicit requirement cells, enriched ${enrichedCount}.`);
if (hskCount < 50 || englishCount < 9) throw new Error(`Unexpected BLCU language extraction counts: HSK ${hskCount}, English ${englishCount}.`);

const generatedAt = [dependency.generatedAt, source.fetchedAt].sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: dependency.programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 57 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    schoolSlugs: [school.slug],
    refreshedPrograms: programs.length,
    enrichedRouteRequirements: enrichedCount,
    hskRequirementsAdded: hskCount,
    englishRequirementsAdded: englishCount,
    retainedUnmatchedRoutes: programs.length - enrichedCount,
    new2027Intakes: 0,
    refreshedScholarships: 0,
    sourceSnapshots: 1,
  },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "Seventeen 2027 graduate routes do not have an exact degree-level program-name match in the maintained entry-requirement table; their language requirements remain absent.",
    "The maintained requirement table is not assigned a separate admissions year. It is used only for exact route matches that also appear in the official 2027 program table.",
    "No grouped or renamed doctoral direction is treated as equivalent without an exact official name match.",
  ],
  notes: [
    "Wave 57 retains all 77 BLCU 2027 graduate routes and enriches 56 exact matches with explicit current official route-specific requirement cells.",
    "HSK and English test fields are extracted only when an explicit score appears in the matched official requirement row.",
    "No applicant, account, payment or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-57");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 57,
  candidateSha256,
  counts: { programs: programs.length, enrichedCount, hskCount, englishCount, retainedUnmatchedRoutes: programs.length - enrichedCount, sourceSnapshots: 1 },
  publicationAuthorized: false,
}, null, 2));
