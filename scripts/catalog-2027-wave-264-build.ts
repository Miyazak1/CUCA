import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/njtech-program-counts-2026-10-27");
const lockedSha = "3732d542e74ed07e357c2e58c2bf5955b273e78411d85c5d8ff49daee02a9311";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "njtech-overseas-education-profile-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Nanjing Tech University program-count source");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Nanjing Tech University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-142.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "nanjing-tech-university") throw new Error("Missing Nanjing Tech University dependency");

const routes = [
  { slug: "english-taught-bachelor-program-group", nameEn: "English-taught Bachelor's Programs (9-program group)", degreeLevel: "Bachelor", teachingLanguage: "English", count: 9 },
  { slug: "chinese-taught-bachelor-program-group", nameEn: "Chinese-taught Bachelor's Programs (11-program group)", degreeLevel: "Bachelor", teachingLanguage: "Chinese", count: 11 },
  { slug: "international-master-program-group", nameEn: "International Master's Programs (43-program group)", degreeLevel: "Master", teachingLanguage: undefined, count: 43 },
  { slug: "international-doctoral-program-group", nameEn: "International Doctoral Programs (13-program group)", degreeLevel: "Doctoral", teachingLanguage: undefined, count: 13 },
];
const programs = routes.map((route) => ({
  slug: `nanjing-tech-university-${route.slug}`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: route.degreeLevel,
  fieldCategory: "Published program-count group",
  subjectArea: "Engineering, science, arts, economics and management",
  teachingLanguage: route.teachingLanguage,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `The official Overseas Education College profile, updated February 28, 2025, publishes this group as ${route.count} international program(s). It does not name the individual programs on the captured page${route.teachingLanguage ? " beyond the stated teaching language" : " or state a teaching language for this degree group"}. No duration, tuition, deadline or explicit 2027 intake is inferred.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "normalized from the official international-program counts",
    degreeLevel: "official bachelor, master and doctoral grouping",
    fieldCategory: "evidence-scope classification",
    subjectArea: "official profile's published subject-field scope",
    teachingLanguage: route.teachingLanguage ? "official profile's bachelor teaching-language split" : "not published for this group",
    applicationUrl: "official captured Overseas Education College profile",
    applicationNote: "official program count and unresolved-field note",
  },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The official Overseas Education College profile publishes 9 English-taught and 11 Chinese-taught bachelor programs, 43 master's programs and 13 doctoral programs. The accessible current admissions index still exposes only the 2026 prospectus and no explicit 2027 intake.",
  languageOfInstruction: "English and Chinese at bachelor level; teaching language is not specified for the grouped master's and doctoral counts on the captured page.",
  languageTags: ["Chinese", "English"],
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official current Overseas Education College program counts plus 2026 admissions index",
    languageOfInstruction: "official bachelor program-count language split; postgraduate language unresolved",
    languageTags: "official bachelor program-count language split",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, representedProgramCount: 76, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured profile publishes group counts, not the 76 individual program names; no individual names are invented.",
    "The profile was updated in 2025 and the current admissions index exposes a 2026 prospectus; neither is relabeled as a 2027 intake.",
    "No duration, tuition, application deadline, intake date or route-specific scholarship is published on the captured profile; those fields remain absent.",
    "The detailed 2026 prospectus attachments remain CAPTCHA-protected and were not bypassed.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public aggregate program facts are retained; no applicant identity or personal contact is included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-264");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 264, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
