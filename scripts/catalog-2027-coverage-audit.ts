import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type JsonRecord = Record<string, unknown>;
type RegisteredSource = JsonRecord & {
  id: string;
  label: string;
  url: string;
  sourceRole: string;
  schoolSlug?: string;
};

const root = process.cwd();
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as {
  schools: Array<{ slug: string; nameEn: string; sourceUrl?: string; sourceSha256?: string }>;
  programs: Array<{ slug: string; schoolSlug: string; sourceUrl?: string; sourceSha256?: string }>;
  programIntakes: Array<{ programSlug: string; sourceUrl?: string; sourceSha256?: string }>;
  scholarships: Array<{ schoolSlug?: string; sourceUrl?: string; sourceSha256?: string }>;
};
const registry = JSON.parse(await readFile(resolve(root, "catalog-sources/official-sources.json"), "utf8")) as {
  sources: RegisteredSource[];
};
const discovery = JSON.parse(await readFile(resolve(root, "catalog-sources/2027-school-refresh-status.json"), "utf8")) as {
  schools: Array<{ schoolSlug: string; result: string; notes: string; observedOfficialUrls: string[] }>;
};
const discoveryBySchool = new Map(discovery.schools.map((row) => [row.schoolSlug, row]));
if (discoveryBySchool.size !== discovery.schools.length) throw new Error("2027 discovery audit contains duplicate school slugs.");

const year2027Pattern = /(?:^|[^0-9])2027(?:[^0-9]|$)/i;
const academicCyclePattern = /2026\s*[-–/]\s*2027/i;
const explicitTerm2027Pattern = /(?:spring|fall|autumn)\s*2027|2027\s*(?:spring|fall|autumn)/i;
const priorPattern = /(?:^|[^0-9])2026(?:[^0-9]|$)/i;
const sourceText = (source: RegisteredSource) => `${source.id}\n${source.label}\n${source.url}`;
const isExplicit2027Source = (source: RegisteredSource) => {
  const text = sourceText(source);
  return year2027Pattern.test(text) && (!academicCyclePattern.test(text) || explicitTerm2027Pattern.test(text));
};
const nonDegreePattern = /language program|chinese language|non[- ]degree|exchange|pre[- ]university|foundation program/i;
const degreeSourceRoles = new Set(["school-admissions", "program-catalog"]);
const isDegreeSource = (source: RegisteredSource) => degreeSourceRoles.has(source.sourceRole) && !nonDegreePattern.test(sourceText(source));
const currentSources = registry.sources.filter(isExplicit2027Source);
const acquiredEvidence = new Set<string>();
const acquiredRoot = resolve(root, "work/catalog-official");
for (const entry of await readdir(acquiredRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(acquiredRoot, entry.name, "manifest.json"), "utf8")) as { sources?: JsonRecord[] };
    for (const source of manifest.sources ?? []) {
      if (Number(source.status) !== 200 || !/^[a-f0-9]{64}$/i.test(String(source.sha256 ?? ""))) continue;
      for (const value of [source.url, source.finalUrl]) {
        if (!value) continue;
        acquiredEvidence.add(`${new URL(String(value)).toString()}\n${String(source.sha256).toLowerCase()}`);
      }
    }
  } catch {
    // Incomplete acquisition directories do not establish evidence identity.
  }
}
const evidenceKey = (row: { sourceUrl?: string; sourceSha256?: string }) => {
  try {
    return `${new URL(String(row.sourceUrl)).toString()}\n${String(row.sourceSha256).toLowerCase()}`;
  } catch {
    return "";
  }
};
const programSchoolBySlug = new Map(base.programs.map((program) => [program.slug, program.schoolSlug]));
const seedFiles = (await readdir(resolve(root, "seeds")))
  .filter((file) => /2027.*\.(?:draft|reviewed)\.json$/i.test(file) || /spring-2027\.draft\.json$/i.test(file));

const draftEvidence = new Map<string, Set<string>>();
for (const file of seedFiles) {
  let bundle: JsonRecord;
  try {
    bundle = JSON.parse(await readFile(resolve(root, "seeds", file), "utf8")) as JsonRecord;
  } catch {
    continue;
  }
  const slugs = new Set<string>();
  for (const row of Array.isArray(bundle.schools) ? bundle.schools as JsonRecord[] : []) {
    if (row.slug) slugs.add(String(row.slug));
  }
  for (const key of ["programs", "scholarships"] as const) {
    for (const row of Array.isArray(bundle[key]) ? bundle[key] as JsonRecord[] : []) {
      if (row.schoolSlug) slugs.add(String(row.schoolSlug));
    }
  }
  for (const slug of slugs) {
    const files = draftEvidence.get(slug) ?? new Set<string>();
    files.add(file);
    draftEvidence.set(slug, files);
  }
}

const rows = base.schools.map((school) => {
  const sources = registry.sources.filter((source) => source.schoolSlug === school.slug);
  const sources2027 = sources.filter(isExplicit2027Source);
  const academicCycleSources = sources.filter((source) => academicCyclePattern.test(sourceText(source)) && !isExplicit2027Source(source));
  const sources2026 = sources.filter((source) => priorPattern.test(sourceText(source)) && !isExplicit2027Source(source));
  const degreeSources2027 = sources2027.filter(isDegreeSource);
  const roles2027 = [...new Set(sources2027.map((source) => source.sourceRole))].sort();
  const degreeRoles2027 = [...new Set(degreeSources2027.map((source) => source.sourceRole))].sort();
  const hasAdmissions = degreeRoles2027.includes("school-admissions");
  const hasPrograms = degreeRoles2027.includes("program-catalog");
  const state = hasAdmissions && hasPrograms
    ? "2027_admissions_and_programs_registered"
    : sources2027.length
      ? "2027_partial_registered"
      : sources.length
        ? "2026_or_current_only"
        : "no_registered_school_source";
  const priority = state === "2027_admissions_and_programs_registered" ? 1
    : state === "2027_partial_registered" ? 2
      : state === "2026_or_current_only" ? 3 : 4;
  const registeredCurrentUrls = new Set(sources2027.map((source) => new URL(source.url).toString()));
  const backedByCurrentSource = (row: { sourceUrl?: string; sourceSha256?: string }) => {
    try {
      return registeredCurrentUrls.has(new URL(String(row.sourceUrl)).toString()) && acquiredEvidence.has(evidenceKey(row));
    } catch {
      return false;
    }
  };
  const baselinePrograms = base.programs.filter((program) => program.schoolSlug === school.slug);
  const baselineIntakes = base.programIntakes.filter((intake) => programSchoolBySlug.get(intake.programSlug) === school.slug);
  const baselineScholarships = base.scholarships.filter((scholarship) => scholarship.schoolSlug === school.slug);
  const baselineTotals = {
    school: 1,
    programs: baselinePrograms.length,
    programIntakes: baselineIntakes.length,
    scholarships: baselineScholarships.length,
  };
  const baselineCurrentEvidence = {
    school: backedByCurrentSource(school) ? 1 : 0,
    programs: baselinePrograms.filter(backedByCurrentSource).length,
    programIntakes: baselineIntakes.filter(backedByCurrentSource).length,
    scholarships: baselineScholarships.filter(backedByCurrentSource).length,
  };
  const draftFiles = [...(draftEvidence.get(school.slug) ?? [])].sort();
  const degreeCatalogCurrentInBaseline = baselinePrograms.length > 0
    && baselineCurrentEvidence.programs === baselinePrograms.length
    && baselineCurrentEvidence.programIntakes === baselineIntakes.length;
  const workState = degreeCatalogCurrentInBaseline
    ? "already_current_in_baseline"
    : draftFiles.length
      ? "current_draft_pending_review"
      : degreeSources2027.length
        ? "current_source_extraction_needed"
        : discoveryBySchool.has(school.slug)
          ? "discovery_checked_no_explicit_degree_source"
          : "degree_source_discovery_needed";
  const workPriority = workState === "current_draft_pending_review" ? 1
    : workState === "current_source_extraction_needed" ? 2
      : workState === "degree_source_discovery_needed" ? 3
        : workState === "discovery_checked_no_explicit_degree_source" ? 4 : 5;
  return {
    schoolSlug: school.slug,
    schoolName: school.nameEn,
    state,
    priority,
    workState,
    workPriority,
    registeredSourceCount: sources.length,
    registered2027SourceCount: sources2027.length,
    registered2027DegreeSourceCount: degreeSources2027.length,
    registered2026To2027AcademicCycleSourceCount: academicCycleSources.length,
    registered2026OnlySourceCount: sources2026.length,
    roles2027,
    degreeRoles2027,
    draftFiles,
    baselineTotals,
    baselineCurrentEvidence,
    discovery: discoveryBySchool.get(school.slug) ?? null,
    sources2027: sources2027.map(({ id, label, url, sourceRole }) => ({ id, label, url, sourceRole })),
    academicCycleSources: academicCycleSources.map(({ id, label, url, sourceRole }) => ({ id, label, url, sourceRole })),
  };
}).sort((left, right) => left.workPriority - right.workPriority || left.priority - right.priority || right.registered2027SourceCount - left.registered2027SourceCount || left.schoolSlug.localeCompare(right.schoolSlug));

const stateCounts = Object.fromEntries([...new Set(rows.map((row) => row.state))].map((state) => [state, rows.filter((row) => row.state === state).length]));
const workStateCounts = Object.fromEntries([...new Set(rows.map((row) => row.workState))].map((state) => [state, rows.filter((row) => row.workState === state).length]));
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_audit",
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  objective: "Refresh all 100 current CUAC schools from official 2027 sources where published, preserving unresolved fields and keeping review separate from publication.",
  policy: {
    currentEvidenceRule: "A source counts as a 2027 intake source only when its registered ID, label, or URL explicitly states 2027; a generic 2026-2027 academic-cycle label does not qualify unless it also states a Spring/Fall/Autumn 2027 intake.",
    actionableDegreeSourceRule: "Only registered school-admissions and program-catalog sources can create degree-extraction work. Freshness indexes, preparation notices and discovery-only evidence never create publishable routes by themselves.",
    completenessRule: "A school with an explicit 2027 route draft enters review even when the route is non-degree or scholarship-only; a complete degree refresh still requires the applicable admissions and program-catalog evidence.",
    unresolvedRule: "Missing 2027 evidence is not backfilled by relabeling 2026 data.",
  },
  summary: {
    targetSchools: rows.length,
    registeredSources: registry.sources.length,
    registered2027Sources: currentSources.length,
    schoolsWithAny2027Source: rows.filter((row) => row.registered2027SourceCount > 0).length,
    schoolsWith2027DraftEvidence: rows.filter((row) => row.draftFiles.length > 0).length,
    schoolsDiscoveryChecked: rows.filter((row) => row.discovery !== null).length,
    states: stateCounts,
    workStates: workStateCounts,
  },
  executionPlan: {
    batchSize: 10,
    phase1: "Extract and validate schools that already have both 2027 admissions and program catalogs registered.",
    phase2: "Complete missing 2027 source roles for schools with partial registered coverage when official pages publish them.",
    phase3: "Retain the completed official-site discovery result for schools whose international degree guide is still 2026 or unpublished.",
    phase4: "Recheck recorded non-publication or access blockers in later refresh runs without inventing replacement data.",
  },
  queue: rows,
};

const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-2027-coverage-audit.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary, nextBatch: rows.slice(0, 10).map((row) => ({ schoolSlug: row.schoolSlug, state: row.state, registered2027SourceCount: row.registered2027SourceCount, draftFiles: row.draftFiles })) }, null, 2));
