import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T06-31-56-425Z");
const lockedSha = "c1dc33e685135146ba7b46ee9e0d6ae604e3bb6b0f1139fd1e3104c15df3a5f7";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "swu-international-undergraduate-current-2026-2027" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Southwest University undergraduate source");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Southwest University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-125.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "southwest-university") throw new Error("Missing Southwest University dependency");

const routes = [
  { slug: "chinese-taught-undergraduate-route-2026-2027", nameEn: "Chinese-taught International Undergraduate Programs (2026-2027 academic year)", language: "Chinese", hskRequirement: "HSK Level 4 score 200 or above", englishRequirement: undefined },
  { slug: "english-taught-undergraduate-route-2026-2027", nameEn: "English-taught International Undergraduate Programs (2026-2027 academic year)", language: "English", hskRequirement: undefined, englishRequirement: "TOEFL iBT 80 with each section at least 20, IELTS 6.0 with each band at least 5.5, or Duolingo English Test 115 with each subscore at least 115" },
];
const programs = routes.map((route) => ({
  slug: `southwest-university-${route.slug}`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: "Bachelor",
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  teachingLanguage: route.language,
  durationYears: 4,
  hskRequirement: route.hskRequirement,
  englishRequirement: route.englishRequirement,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official current page publishes an annual January 1-June 15 application period, early-September enrollment, a CSCA transcript requirement, a CNY 500 application fee, CNY 6,000-12,000 annual accommodation and CNY 800 annual medical insurance. Major names and route-level tuition remain inside CAPTCHA-protected 2026-2027 workbooks and are therefore absent. The academic-year label is not treated as a separate 2027 intake.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "normalized from the official Chinese- and English-taught attachment headings",
    degreeLevel: "official undergraduate page scope",
    fieldCategory: "evidence-scope classification",
    subjectArea: "official page links multiple majors without exposing the protected workbook contents",
    teachingLanguage: "official Chinese-taught and English-taught route headings",
    durationYears: "official standard undergraduate study duration",
    hskRequirement: "official applicant qualifications",
    englishRequirement: "official applicant qualifications",
    applicationUrl: "official captured current undergraduate page",
    applicationNote: "official application, enrollment, CSCA and fee statements plus protected-attachment limitation",
  },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The current official 2026-2027 undergraduate page confirms Chinese- and English-taught bachelor's routes, four-year study, annual application timing, language thresholds, CSCA and general fees. It does not establish a separate 2027 intake.",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current 2026-2027 undergraduate page" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The 2026-2027 academic-year label is not treated as proof of a separate Fall or Spring 2027 intake.",
    "The Chinese- and English-taught major catalogs and tuition tables are CAPTCHA-protected; access controls were not bypassed.",
    "Major names and route-level tuition remain absent rather than inferred.",
    "The annual January 1-June 15 application period and early-September enrollment are preserved as recurring guidance, not converted into a dated 2027 intake record.",
    "Bank account details and personal contacts are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public route and general application facts are retained; bank details, personal contacts and applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-266");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 266, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
