import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T08-21-23-876Z");
const lockedSha = "b0bf8894c4afa7f1155761c37209edd95f7c2d80994c5049cc9d7b941361cfcb";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "yzu-international-undergraduate-application-guide-pdf-2026" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Yangzhou University 2026 undergraduate guide");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Yangzhou University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-147.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "yangzhou-university") throw new Error("Missing Yangzhou University dependency");

const routes = [
  {
    slug: "chinese-taught-undergraduate-route-2026",
    nameEn: "International Undergraduate Programs (Chinese-taught)",
    teachingLanguage: "Chinese",
    hskRequirement: "HSK Level 4 or above",
    englishRequirement: undefined,
  },
  {
    slug: "english-taught-undergraduate-route-2026",
    nameEn: "International Undergraduate Programs (English-taught)",
    teachingLanguage: "English",
    hskRequirement: undefined,
    englishRequirement: "TOEFL, IELTS or Duolingo score report for applicants whose native or official language is not English; no numeric threshold is stated",
  },
];
const programs = routes.map((route) => ({
  slug: `yangzhou-university-${route.slug}`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: "Bachelor",
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  teachingLanguage: route.teachingLanguage,
  hskRequirement: route.hskRequirement,
  englishRequirement: route.englishRequirement,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official 2026 undergraduate guidance distinguishes this teaching-language route and its language evidence requirement, but it does not embed a major list, duration, tuition, general application deadline or 2027 intake. Those fields remain absent.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "normalized from the official Chinese-taught and English-taught undergraduate applicant sections",
    degreeLevel: "official guide scope: international undergraduate students",
    fieldCategory: "evidence-scope classification",
    subjectArea: "official guide addresses multiple programs but does not embed a major list",
    teachingLanguage: "official Chinese-taught and English-taught route statements",
    hskRequirement: "official proof-of-language-proficiency section",
    englishRequirement: "official proof-of-language-proficiency section",
    applicationUrl: "official captured 2026 undergraduate guide",
    applicationNote: "official guide scope and unresolved-field note",
  },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The official 2026 international undergraduate guidance confirms Chinese- and English-taught bachelor's routes. It does not publish a major-level catalog or an explicit 2027 intake.",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2026 international undergraduate guide scope and route-language sections",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured guide is labeled 2026 and is not relabeled as 2027.",
    "The guide distinguishes Chinese- and English-taught undergraduate routes but does not embed a major-level catalog.",
    "No duration, tuition, general application deadline, intake date or route-specific scholarship is published in the captured guide; those fields remain absent.",
    "Payment account details and QR-code instructions are intentionally excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public route-level requirements are retained; payment account details, QR codes and applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-262");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 262, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
