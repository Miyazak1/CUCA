import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

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

type SourceLock = {
  id: string;
  run: string;
  sha256: string;
  degreeLevel?: "Bachelor" | "Master" | "Doctoral";
};

const root = process.cwd();
const locks: SourceLock[] = [
  { id: "jsu-international-admission-dates-2027", run: "2026-10-26T14-57-22-903Z", sha256: "2691da0c4742ff83cc5f765cf0b1dd01f49db7d8cab4647b7666f0749ca8a0d5" },
  { id: "jsu-international-eligibility-current", run: "2026-10-26T07-34-48-606Z", sha256: "2a347219bc2462196aa8f147f69199ae0e3ce20e37fb31f13a880956737f4d24" },
  { id: "jsu-international-bachelor-catalog-current-for-2027", run: "2026-10-26T14-57-22-560Z", sha256: "5f531d4c2ad36d472c31b8608041421c0e3cd32fc93e386da1037ae6a29f9c44", degreeLevel: "Bachelor" },
  { id: "jsu-international-master-catalog-current-for-2027", run: "2026-10-26T14-57-22-607Z", sha256: "d889d2fa01a2f6f2fb1da1f377a67389600024b5b0c13ea4f4d8f297571591c8", degreeLevel: "Master" },
  { id: "jsu-international-phd-catalog-current-for-2027", run: "2026-10-26T14-57-22-688Z", sha256: "d5da721a3778d9422bab24e348560cb01a1e0a6b07d73cd2348cc0cccc0fedc8", degreeLevel: "Doctoral" },
];

const locked = new Map<string, { source: ManifestSource; artifact: Buffer; degreeLevel?: SourceLock["degreeLevel"] }>();
for (const lock of locks) {
  const runRoot = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${lock.id} at ${lock.sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== lock.sha256) throw new Error(`Evidence hash mismatch: ${lock.id}.`);
  locked.set(lock.id, { source, artifact, degreeLevel: lock.degreeLevel });
}

const decodeHtml = (value: string) => value
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, " ")
  .trim();

const slugify = (value: string) => value
  .normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase();

const categoryFor = (name: string) => {
  if (/medicine|medical|pharmacy|pharmaceutical|dental|health|nursing/i.test(name)) return "Medicine and Health Sciences";
  if (/engineering|mechanic|transport|material|computer|information|automation|energy|architecture|construction|robot|vehicle|electrical|electronic|safety/i.test(name)) return "Engineering and Technology";
  if (/business|management|economic|finance|accounting|administration|commerce|trade|mba/i.test(name)) return "Business, Economics and Management";
  if (/agric|food|life science|biology|biological|biotechnology|aquaculture/i.test(name)) return "Agriculture and Life Sciences";
  if (/law|juris/i.test(name)) return "Law";
  if (/chinese|english|literature|language/i.test(name)) return "Languages and Humanities";
  if (/math|physics|chemistry|statistics|science/i.test(name)) return "Natural Sciences";
  if (/art|design/i.test(name)) return "Arts and Design";
  return "Other";
};

const schoolSlug = "jiangsu-university";
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-137.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "zhenjiang");
const priorSchool = prior.schools?.find((row) => row.slug === schoolSlug);
if (!city || !priorSchool) throw new Error("Jiangsu University wave 137 dependencies are missing.");

const datesSource = locked.get("jsu-international-admission-dates-2027")!.source;
const dateFields = {
  sourceUrl: datesSource.finalUrl ?? datesSource.url,
  sourceLabel: datesSource.label,
  sourceSha256: datesSource.sha256,
  capturedAt: datesSource.fetchedAt,
};
const school = {
  ...priorSchool,
  admissionsUrl: dateFields.sourceUrl,
  deadlineSummary: "2027 Spring intake closes December 25, 2026 with registration March 3-5, 2027. September 2027 intake opens April 1, closes June 25 and registers September 6-10, 2027.",
  lastVerifiedAt: datesSource.fetchedAt,
  ...dateFields,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    admissionsUrl: "official 2027 dates and deadlines page",
    deadlineSummary: "official 2027 dates and deadlines table",
  },
};

type ParsedRoute = {
  nameEn: string;
  degreeLevel: "Bachelor" | "Master" | "Doctoral";
  intake: string;
  durationYears: number;
  teachingLanguage: string;
  tuitionAmount: number;
  source: ManifestSource;
  rowNumber: number;
};

const routes: ParsedRoute[] = [];
for (const entry of locked.values()) {
  if (!entry.degreeLevel) continue;
  const html = entry.artifact.toString("utf8");
  const headerIndex = html.search(/Program Name/i);
  const tableStart = headerIndex >= 0 ? html.lastIndexOf("<table", headerIndex) : -1;
  const tableEnd = headerIndex >= 0 ? html.indexOf("</table>", headerIndex) : -1;
  const contentTable = tableStart >= 0 && tableEnd > tableStart
    ? html.slice(tableStart, tableEnd + "</table>".length)
    : undefined;
  if (!contentTable) throw new Error(`Program table missing: ${entry.source.id}.`);
  const rows = [...contentTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  let acceptedRow = 0;
  for (const row of rows) {
    // The official page keeps withdrawn/stale routes in the markup with class="remove";
    // they are hidden from the published catalog and must not become candidate records.
    if (/<tr\b[^>]*\bclass=["'][^"']*\bremove\b[^"']*["']/i.test(row[0])) continue;
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => decodeHtml(match[1]));
    if (cells.length < 5 || !/<a\b/i.test(row[1])) continue;
    const nameEn = cells[0];
    const tuitionText = cells.at(-1) ?? "";
    const teachingLanguage = cells.at(-2) ?? "";
    const durationText = cells.at(-3) ?? "";
    const intake = cells.at(-4) ?? "";
    const durationYears = Number(durationText.match(/\d+(?:\.\d+)?/)?.[0]);
    const tuitionAmount = Number(tuitionText.replace(/[^0-9.]/g, ""));
    if (!nameEn || !/(?:spring|autumn)/i.test(intake) || !durationYears || !tuitionAmount || !/(?:English|Chinese)/i.test(teachingLanguage)) {
      throw new Error(`Unexpected ${entry.degreeLevel} catalog row: ${JSON.stringify(cells)}`);
    }
    acceptedRow += 1;
    routes.push({ nameEn, degreeLevel: entry.degreeLevel, intake, durationYears, teachingLanguage, tuitionAmount, source: entry.source, rowNumber: acceptedRow });
  }
  if (!acceptedRow) throw new Error(`No program rows parsed from ${entry.source.id}.`);
}

const seenSlugs = new Set<string>();
const routeWithSlugs = routes.map((route) => {
  const baseSlug = `${schoolSlug}-${slugify(route.degreeLevel)}-${slugify(route.nameEn)}-${slugify(route.teachingLanguage)}`;
  let slug = baseSlug;
  let suffix = 2;
  while (seenSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
  seenSlugs.add(slug);
  return { ...route, slug };
});

const programs = routeWithSlugs.map((route) => {
  const isEnglish = /English/i.test(route.teachingLanguage);
  const isChinese = /Chinese/i.test(route.teachingLanguage);
  return {
    slug: route.slug,
    schoolSlug,
    citySlug: "zhenjiang",
    nameEn: route.nameEn,
    degreeLevel: route.degreeLevel,
    fieldCategory: categoryFor(route.nameEn),
    subjectArea: route.nameEn,
    durationYears: route.durationYears,
    teachingLanguage: route.teachingLanguage,
    ...(isEnglish ? { englishRequirement: "Current general admission rule: IELTS above 6.0, TOEFL above 80, or Duolingo above 100." } : {}),
    ...(isChinese ? { hskRequirement: "Current general admission rule: submit an HSK certificate at the level required by the specific program; the page does not publish one universal numeric level." } : {}),
    tuitionAmount: route.tuitionAmount,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `RMB ${route.tuitionAmount.toLocaleString("en-US")} per year`,
    applicationNote: "Current official Jiangsu University international degree-program catalog route mapped to the explicitly published 2027 intake calendar. The current general eligibility page supplies language rules; any route-specific requirement takes precedence.",
    badgeText: "2027 intake",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: route.source.fetchedAt,
    sourceUrl: route.source.finalUrl ?? route.source.url,
    sourceLabel: route.source.label,
    sourceSha256: route.source.sha256,
    capturedAt: route.source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `official ${route.degreeLevel} program table row ${route.rowNumber}`,
      degreeLevel: `official ${route.degreeLevel} program table heading`,
      fieldCategory: "derived CUAC display category from the explicit official program name",
      subjectArea: `official ${route.degreeLevel} program table row ${route.rowNumber}`,
      durationYears: `official ${route.degreeLevel} program table row ${route.rowNumber}, Duration column`,
      teachingLanguage: `official ${route.degreeLevel} program table row ${route.rowNumber}, Language column`,
      ...(isEnglish ? { englishRequirement: "current official eligibility page, language proficiency certificate rule" } : {}),
      ...(isChinese ? { hskRequirement: "current official eligibility page, program-specific HSK rule" } : {}),
      tuitionAmount: `official ${route.degreeLevel} program table row ${route.rowNumber}, Tuition Fee column`,
      applicationNote: "current official program table, current official eligibility page and separately locked official 2027 dates page",
      badgeText: "official 2027 dates page",
    },
  };
});

const programIntakes = routeWithSlugs.flatMap((route) => {
  const terms: Array<"Spring" | "Fall"> = [];
  if (/spring/i.test(route.intake)) terms.push("Spring");
  if (/autumn/i.test(route.intake)) terms.push("Fall");
  return terms.map((intakeTerm) => ({
    programSlug: route.slug,
    intakeTerm,
    intakeYear: 2027,
    ...(intakeTerm === "Fall" ? { openDate: "2027-03-31T16:00:00.000Z" } : {}),
    deadlineDate: intakeTerm === "Spring" ? "2026-12-25T15:59:59.000Z" : "2027-06-25T15:59:59.000Z",
    deadlineLabel: intakeTerm === "Spring"
      ? "Spring 2027 application closes December 25, 2026; registration March 3-5, 2027. The official table does not publish an opening date."
      : "September 2027 application opens April 1 and closes June 25, 2027; registration September 6-10, 2027.",
    applicationRound: intakeTerm === "Spring" ? "Jiangsu University Spring 2027 Intake" : "Jiangsu University September 2027 Intake",
    ...dateFields,
    sourceFieldLineage: {
      intakeTerm: `current official ${route.degreeLevel} catalog row ${route.rowNumber}, Intake column; Autumn normalized to Fall`,
      intakeYear: "official 2027 dates and deadlines table",
      ...(intakeTerm === "Fall" ? { openDate: "official September 2027 row, Beijing date normalized to UTC" } : {}),
      deadlineDate: "official 2027 dates and deadlines table, Beijing end-of-day normalized to UTC",
      deadlineLabel: "official 2027 dates and registration table",
      applicationRound: "official 2027 dates page plus route intake column",
    },
  }));
});

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: datesSource.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 197 validation failed:\n${validation.errors.join("\n")}`);
const evidence = locks.map((lock) => {
  const source = locked.get(lock.id)!.source;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: datesSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 81, schoolSlugs: [schoolSlug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence,
  unresolved: [
    "The program pages are current evergreen official catalogs. They are mapped to 2027 only where their explicit Spring or Autumn intake columns intersect the separately captured official 2027 admissions calendar.",
    "The Spring 2027 row does not publish an application opening date, so no openDate is stored for Spring routes.",
    "The current eligibility page publishes general English thresholds and requires Chinese-taught applicants to meet the HSK level specified by their program. It does not publish one universal numeric HSK threshold, so no number is inferred.",
    "CSCA subject combinations and award-specific 2027 scholarship rules are not transcribed into this degree-route candidate and remain absent.",
    "Several bachelor rows publish unusually long durations of five to nine years. The explicit table values are preserved without silent correction and require editorial review before publication.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional program and admissions facts are included; no applicant, account or personal contact data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-197");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 197, candidateSha256, counts: validation.summary, byLevel: Object.fromEntries(["Bachelor", "Master", "Doctoral"].map((level) => [level, programs.filter((program) => program.degreeLevel === level).length])), publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
