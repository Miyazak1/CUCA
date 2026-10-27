import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const run = "2026-10-26T10-58-06-910Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["sdau-international-office-home-current", "6d306741f7be80d7f7fb9376c1d530b737eb95a6c0b084643952fca3c45441b6"],
  ["sdau-international-student-admission-workflow-current", "fd711d7954f9dfebe0e181a38918613b541484393b911749d5fbd4063c7567a8"],
  ["sdau-english-home-current", "fd36325c2704b3a62b667c41c10f5c5a6be5a8ae2e4bb7904ed1827f14f55c10"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked SDAU source: ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`SDAU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const office = sources.get("sdau-international-office-home-current")!;
const workflow = sources.get("sdau-international-student-admission-workflow-current")!;
const englishHome = sources.get("sdau-english-home-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const city = {
  slug: "taian",
  nameEn: "Tai'an",
  nameZh: "泰安",
  province: "Shandong",
  region: "East China",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: office.fetchedAt,
  ...sourceFields(office),
  sourceFieldLineage: { nameEn: "official International Office address", nameZh: "official International Office address", province: "official university address", region: "CUAC geographic taxonomy" },
};
const school = {
  slug: "shandong-agricultural-university",
  nameEn: "Shandong Agricultural University",
  nameZh: "山东农业大学",
  citySlug: city.slug,
  schoolType: "Public agricultural university",
  region: "Tai'an, Shandong, East China",
  applicationLevel: "The current official workflow confirms university-level admission and enrollment of international students. Current official English news confirms international master's and doctoral joint-training activity, but no applicant-facing 2027 international admission guide or approved route list is published.",
  languageOfInstruction: "Not published in the captured current international admission workflow.",
  deadlineSummary: "No applicant-facing 2027 international application window or deadline is published in the captured current official sources.",
  tuitionSummary: "Not published in the captured current official sources.",
  websiteUrl: englishHome.finalUrl ?? englishHome.url,
  admissionsUrl: workflow.finalUrl ?? workflow.url,
  subjectTags: ["Agriculture", "Plant Science", "Animal Science", "Food Science", "Life Sciences"],
  languageTags: [],
  campusHighlights: ["Public agricultural university in Tai'an, Shandong", "Current official workflow covers international-student admission and enrollment", "Official English news confirms international graduate cooperation and recruitment activity"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: englishHome.fetchedAt,
  ...sourceFields(workflow),
  sourceFieldLineage: {
    nameEn: "official English university home",
    nameZh: "official International Office pages",
    citySlug: "official International Office address",
    schoolType: "official university identity plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "current official international admission workflow and current English international-cooperation news",
    languageOfInstruction: "explicitly unresolved in the captured sources",
    deadlineSummary: "explicitly unresolved after current official-source review",
    tuitionSummary: "explicitly unresolved in the captured sources",
    websiteUrl: "official English university home",
    admissionsUrl: "official international admission and enrollment workflow",
    subjectTags: "official university identity and discipline profile",
    languageTags: "intentionally empty because no current threshold or teaching-language catalog is published",
    campusHighlights: "official International Office and English university pages",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: englishHome.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: englishHome.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 128, schoolSlugs: [school.slug], newSchools: 1, newCities: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The current official international admission workflow confirms the process but does not publish a current or 2027 program catalog, teaching languages, tuition, application dates, language thresholds or scholarship terms.",
    "Official English news confirms international master's and doctoral joint-training and recruitment activity, but news is not substituted for an applicant-facing program catalog.",
    "Indexed 2027 graduate admissions are domestic admissions and are excluded from the inbound international catalog.",
    "Application forms, applicant-document attachments, personal contacts and accommodation approval forms are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data or application-form contents are present. Personal contacts and applicant-document attachments are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-171");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 171, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
