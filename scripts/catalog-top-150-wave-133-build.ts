import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = {
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
const locks = [
  { run: "2026-10-26T07-11-30-749Z", id: "ncu-international-admissions-current", sha256: "3971610bbc5fa24864cab18fbd912347693ad2e40636526caf4ad4c785314245" },
  { run: "2026-10-26T07-11-30-749Z", id: "ncu-international-application-procedure-current", sha256: "b36a8a1ea83002bed467e903fb207f793f8b2a1498277542b15b935868b985d1" },
  { run: "2026-10-26T07-11-30-749Z", id: "ncu-international-undergraduate-programs-current", sha256: "4229a9741682a137b49ce797fb25c217916b933ebd0cee8d95e180d0e6a49405" },
  { run: "2026-10-26T07-15-27-581Z", id: "ncu-international-application-method-current", sha256: "805fe986bf04d941d48cfecf6f4bcf96128ac60555a80c7542f9c49d96575028" },
  { run: "2026-10-26T07-15-27-581Z", id: "ncu-international-degree-tuition-current", sha256: "fe1904c2fe3176e2f0a2a2c3ff3b1e2fc550984d8576f61bc36960fe367d537b" },
  { run: "2026-10-26T07-15-27-581Z", id: "ncu-international-accommodation-fee-current", sha256: "b1ac2af042c6751ed69fb4acac1e85bf7d9393297ff1bb6087f1fc05ca1921ac" },
  { run: "2026-10-26T07-16-10-899Z", id: "ncu-international-application-period-current", sha256: "c449c54f51ea01a79eb1806f4f2b6245eb1d66cb2ab9ac48072abbd4a48c1fc0" },
] as const;

const sources = new Map<string, Source>();
for (const lock of locks) {
  const directory = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((item) => item.id === lock.id && item.status === 200 && item.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked source ${lock.id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== lock.sha256) throw new Error(`Hash mismatch ${lock.id}`);
  sources.set(lock.id, source);
}

const primary = sources.get("ncu-international-application-procedure-current")!;
const sourceFields = {
  sourceUrl: primary.finalUrl ?? primary.url,
  sourceLabel: primary.label,
  sourceSha256: primary.sha256,
  capturedAt: primary.fetchedAt,
};
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((item) => item.slug === "nanchang");
if (!city) throw new Error("Nanchang dependency missing");

const school = {
  slug: "nanchang-university",
  nameEn: "Nanchang University",
  nameZh: "南昌大学",
  citySlug: "nanchang",
  schoolType: "National Double First-Class comprehensive university jointly supported by the Ministry of Education and Jiangxi Province",
  region: "Nanchang, Jiangxi, East China",
  applicationLevel: "Undergraduate, Master, Doctoral, non-degree and exchange programs",
  languageOfInstruction: "Chinese and English routes are supported at school level; the current undergraduate list does not label each major's teaching language.",
  languageRequirement: "Chinese-taught undergraduate programs require HSK 4; Chinese-taught master's and doctoral programs require HSK 5. English-taught programs require IELTS 6.0, TOEFL 82 or a pass in NCU's English test. The Teaching Chinese to Speakers of Other Languages undergraduate route has no HSK requirement.",
  hskRequirement: "HSK 4 for Chinese-taught undergraduate study; HSK 5 for Chinese-taught master's and doctoral study. The current TCSOL undergraduate exception has no HSK requirement.",
  englishRequirement: "IELTS 6.0, TOEFL 82 or passing NCU's English test for English-taught programs.",
  deadlineSummary: "The current official application-period page says 'Full Year' and is dated April 18, 2024. It does not publish a 2027-specific opening or deadline.",
  tuitionSummary: "Current annual tuition: bachelor's CNY 18,000 arts / 19,000 sciences / 20,000 medicine; master's CNY 23,000 / 25,000 / 30,000; doctoral CNY 26,000 / 27,500 / 30,000. Preparatory Chinese is CNY 13,000 and TCSOL is CNY 14,500/year. Insurance is CNY 800/person/year. Current accommodation ranges from CNY 2,000 to 7,500/person/year by room and eligibility.",
  websiteUrl: "https://www.ncu.edu.cn/",
  admissionsUrl: primary.finalUrl ?? primary.url,
  subjectTags: ["Humanities", "Business", "Science", "Engineering", "Medicine"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 13,000-30,000/year in the current official schedule",
  campusHighlights: [
    "Current official undergraduate list spans 22 schools",
    "International-student apartment options on the main campus",
    "Public kitchens and laundries available in the international-student apartment",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: primary.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official English admissions portal identity",
    nameZh: "official university identity",
    citySlug: "official accommodation-page address plus reviewed Nanchang dependency",
    schoolType: "official current admissions overview",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official current admissions and requirements navigation",
    languageOfInstruction: "official current language-requirement note with route-level limitation",
    languageRequirement: "official current application-procedure table and notes",
    hskRequirement: "official current application-procedure table and notes",
    englishRequirement: "official current application-procedure note",
    deadlineSummary: "official current application-period page with explicit date and cycle limitation",
    tuitionSummary: "official current degree-tuition and accommodation pages",
    websiteUrl: "official university domain",
    admissionsUrl: "official application-procedure page",
    subjectTags: "official current undergraduate-program list",
    languageTags: "official current language-requirement note",
    tuitionBandLabel: "official current degree-tuition table",
    campusHighlights: "official current undergraduate-program and accommodation pages",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: primary.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map((lock) => {
  const source = sources.get(lock.id)!;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: primary.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 74, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "No explicit inbound international 2027 guide, route table, dated application window or scholarship guide is published in the locked current sources.",
    "The current undergraduate page lists majors but does not identify its admissions cycle, per-route teaching language, duration or route-specific tuition category, so this wave preserves the list as linked school evidence instead of generating ambiguous program rows.",
    "The current application-period page says 'Full Year' but is dated April 18, 2024; it is not converted into a 2027 intake or deadline.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published admissions-office contact details and application-system account information are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-133");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 133, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
