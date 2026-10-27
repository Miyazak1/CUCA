import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type ProgramRow = { degreeLevel: "Bachelor" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; college: string; nameEn: string; durationYears: number; professional?: boolean; sourceId: string };
type Extraction = { version: number; schoolSlug: string; counts: { total: number }; sources: Array<{ run: string; id: string; sha256: string; fetchedAt: string; url: string }>; programs: ProgramRow[] };
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const extraction = JSON.parse(await readFile(resolve(root, "catalog-sources/upc-current-degree-programs.extracted.json"), "utf8")) as Extraction;
if (extraction.version !== 1 || extraction.schoolSlug !== "china-university-of-petroleum-east-china" || extraction.counts.total !== 163 || extraction.programs.length !== 163) throw new Error("Unexpected UPC extraction shape.");
const sources = new Map<string, Source>();
for (const lock of extraction.sources) {
  const runDir = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((item) => item.id === lock.id && item.status === 200 && item.sha256 === lock.sha256);
  if (!source || source.fetchedAt !== lock.fetchedAt) throw new Error(`Missing locked UPC source ${lock.id}.`);
  if (createHash("sha256").update(await readFile(resolve(runDir, source.artifactPath))).digest("hex") !== lock.sha256) throw new Error(`Hash mismatch ${lock.id}.`);
  sources.set(lock.id, source);
}
const primaryRun = resolve(root, "work/catalog-official/2026-10-27T06-54-05-596Z");
const primaryManifest = JSON.parse(await readFile(resolve(primaryRun, "manifest.json"), "utf8")) as { sources: Source[] };
const extraLocks = [
  ["upc-international-entry-requirements-current", "16728ec4015aa4e0bdeced4a96bdbc50e9b2f2ea80335cab14cc94559fffc3c6"],
  ["upc-international-tuition-costs-current", "aa31e39e843e735f1cdfc5b243739ee336e383434fcc1478da169b575d68cae6"],
  ["upc-international-application-time-current", "884ec3944b39de46b25f3386c1fda882ce4422600bea098151046143eef1629d"],
  ["upc-international-entry-exam-current", "5b3f4699c3dac6fc2f98fe6034b465321671138c0669613d66e86487403b2dc5"],
  ["upc-cgs-master-doctoral-2027", "af6d5c3dc1f79316a9fd8ca4b92918fa6c4ae5d8748787ed0df598eb7f301c6f"],
  ["upc-cgs-application-materials-2027", "1b767bf8b30f38b9a96acaaec5cbd9e3766f24d70582d7a516c7d8272c4a9008"],
] as const;
for (const [id, sha] of extraLocks) {
  const source = primaryManifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha);
  if (!source) throw new Error(`Missing locked UPC source ${id}.`);
  if (createHash("sha256").update(await readFile(resolve(primaryRun, source.artifactPath))).digest("hex") !== sha) throw new Error(`Hash mismatch ${id}.`);
  sources.set(id, source);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-103.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "qingdao");
const priorSchool = prior.schools?.find((row) => row.slug === extraction.schoolSlug);
const scholarship = prior.scholarships?.find((row) => row.schoolSlug === extraction.schoolSlug);
if (!city || !priorSchool || !scholarship) throw new Error("Wave 225 requires the Wave 103 UPC school, city and 2027 scholarship.");
const requirements = sources.get("upc-international-entry-requirements-current")!;
const applicationTime = sources.get("upc-international-application-time-current")!;
const school = {
  ...priorSchool,
  applicationLevel: "Current Bachelor, Master and Doctoral catalogs plus an explicit 2027 Chinese Government Scholarship graduate route",
  deadlineSummary: "The official current application schedule uses relative dates: fall applications open March 15 and close May 31 for the next September semester. The explicit 2027 Chinese Government Scholarship graduate route accepts applications October 16-December 15, 2026.",
  tuitionSummary: "Current annual tuition: bachelor CNY 17,000-20,000; master CNY 20,000-24,000; doctoral CNY 26,000-30,000, depending on teaching language and discipline group.",
  applicationFee: undefined,
  subjectTags: [...new Set(extraction.programs.map((row) => row.college))],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 17,000-30,000/year for current degree routes",
  campusHighlights: ["163 current official program-language rows", "Energy and petroleum focus", "Qingdao West Coast New Area"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: applicationTime.fetchedAt,
  sourceUrl: requirements.finalUrl ?? requirements.url,
  sourceLabel: requirements.label,
  sourceSha256: requirements.sha256,
  capturedAt: requirements.fetchedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "current official degree catalogs and explicit 2027 scholarship guide",
    deadlineSummary: "current official relative application schedule plus explicit 2027 scholarship deadline",
    tuitionSummary: "current official tuition table",
    subjectTags: "current official program catalogs",
    languageTags: "current official Chinese/English program catalogs",
    tuitionBandLabel: "current official tuition table",
    campusHighlights: "official program catalogs, institutional focus and contact address",
  },
};

const humanitiesCollege = /Economics|Management|Humanities|Law|Foreign|Marxism/i;
const tuitionFor = (row: ProgramRow) => {
  if (row.degreeLevel === "Doctoral") return row.teachingLanguage === "English" ? 30000 : 26000;
  if (row.degreeLevel === "Master") return row.teachingLanguage === "English" ? 24000 : humanitiesCollege.test(row.college) ? 20000 : 22000;
  if (row.teachingLanguage === "Chinese") return humanitiesCollege.test(row.college) ? 17000 : 18000;
  if (row.nameEn === "Petroleum Engineering") return 20000;
  if (["Geology", "Resource Exploration Engineering"].includes(row.nameEn)) return 18000;
  return undefined;
};
const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
const programs: CatalogSeedProgram[] = extraction.programs.map((row, index) => {
  const detailSource = sources.get(row.sourceId)!;
  const tuitionAmount = tuitionFor(row);
  const generalTuition = row.degreeLevel === "Bachelor" ? "CNY 17,000-20,000/year depending on discipline and teaching language" : row.degreeLevel === "Master" ? "CNY 20,000-24,000/year depending on discipline and teaching language" : "CNY 26,000/year in Chinese or CNY 30,000/year in English";
  return {
    slug: `${school.slug}-${row.degreeLevel.toLowerCase()}-${row.teachingLanguage.toLowerCase()}-${String(index + 1).padStart(3, "0")}-${slugify(row.nameEn)}-${slugify(row.college)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    durationYears: row.durationYears,
    fieldCategory: row.college,
    subjectArea: row.nameEn,
    teachingLanguage: row.teachingLanguage,
    ...(row.teachingLanguage === "Chinese" ? { hskRequirement: row.degreeLevel === "Bachelor" ? "HSK Level 5 score 180, accepted Chinese-medium high-school evidence, or UPC Foundation test above 60." : "HSK Level 5 score 180 or accepted prior Chinese-medium university evidence." } : { englishRequirement: row.degreeLevel === "Bachelor" ? "IELTS 6.0, TOEFL 75, equivalent recognized test, accepted prior English-medium high-school evidence, UPC Foundation test above 60, or an applicable published exemption." : "IELTS 6.5, TOEFL 85, equivalent recognized test, accepted prior English-medium university evidence, or an applicable published exemption." }),
    ...(tuitionAmount !== undefined ? { tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "academic year" } : {}),
    tuitionText: tuitionAmount !== undefined ? `CNY ${tuitionAmount.toLocaleString("en-US")}/academic year under the current official fee category.` : `${generalTuition}; the accessible fee page does not map this newer English bachelor title to one exact amount.`,
    applicationUrl: requirements.finalUrl ?? requirements.url,
    applicationNote: `Current official ${row.teachingLanguage.toLowerCase()}-taught ${row.degreeLevel.toLowerCase()} program${row.professional ? " (professional master's)" : ""}. The degree catalog does not identify an explicit 2027 self-funded cycle, so no 2027 intake row is generated.`,
    hasScholarship: row.degreeLevel === "Master" || row.degreeLevel === "Doctoral",
    scholarshipText: row.degreeLevel === "Master" || row.degreeLevel === "Doctoral" ? "Eligible applicants may apply for the explicit 2027 Chinese Government Scholarship route, subject to its requirements and university admission." : undefined,
    badgeText: `Current ${row.teachingLanguage.toLowerCase()}-taught ${row.degreeLevel.toLowerCase()} program`,
    displaySubjects: [row.nameEn],
    displayGroup: row.degreeLevel,
    displayGroupLabel: `${row.degreeLevel} programs`,
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: detailSource.fetchedAt,
    sourceUrl: detailSource.finalUrl ?? detailSource.url,
    sourceLabel: detailSource.label,
    sourceSha256: detailSource.sha256,
    capturedAt: detailSource.fetchedAt,
    sourceFieldLineage: {
      nameEn: "current official degree catalog",
      degreeLevel: "official program-category page",
      durationYears: "official program table or current tuition table",
      fieldCategory: "official program-table college/school column; English summary limitation stated where absent",
      subjectArea: "current official program title",
      teachingLanguage: "official Chinese/English catalog heading; doctoral English availability from official English-medium summary",
      ...(row.teachingLanguage === "Chinese" ? { hskRequirement: "current official entry requirements" } : { englishRequirement: "current official entry requirements" }),
      tuitionText: "current official tuition table with exact mapping only where supported",
      ...(tuitionAmount !== undefined ? { tuitionAmount: "current official tuition table and official program discipline/language category", tuitionCurrency: "current official tuition table", tuitionPeriod: "current official tuition table" } : {}),
      applicationUrl: "current official entry requirements",
      applicationNote: "current official catalog plus explicit unresolved 2027 self-funded cycle",
      hasScholarship: "explicit 2027 graduate scholarship category",
      scholarshipText: "explicit 2027 graduate scholarship guide",
    },
  };
});

const candidate: CatalogSeedBundle = { version: 1, generatedAt: [applicationTime.fetchedAt, ...extraction.sources.map((row) => row.fetchedAt)].sort().at(-1)!, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [scholarship] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 225 validation failed:\n${validation.errors.join("\n")}`);
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const evidence = [...extraction.sources, ...extraLocks.map(([id]) => { const source = sources.get(id)!; return { id, url: source.finalUrl ?? source.url, sha256: source.sha256, fetchedAt: source.fetchedAt }; })];
const review = { version: 1, status: "unreviewed_draft", generatedAt: candidate.generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 73, schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 1 }, evidence, transcription: extraction.counts, unresolved: ["The 163 degree program-language rows are current official catalog entries, not explicit 2027 self-funded admissions. No 2027 degree intake rows are generated.", "The current application-time page uses relative labels such as 'next September' and 'next May 31'. These are summarized at school level but are not converted into a dated 2027 intake without an explicit cycle year.", "The current tuition page predates several newer English bachelor titles. Exact tuition is assigned only where the page publishes an unambiguous language/degree/discipline mapping; other newer English bachelor rows retain the published range.", "The English-medium summary states that all doctoral programs are available in English; the same official doctoral program list is therefore represented once for Chinese and once for English instruction."], sensitiveDataCheck: { result: "pass", note: "Only institutional and program data is retained; personal contacts and supervisor identities are excluded." } };
const stem = resolve(root, "seeds/catalog.2027-wave-225");
await Promise.all([writeFile(`${stem}.draft.json`, text, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 225, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
