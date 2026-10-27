import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/gzhu-degree-routes-2026-10-27");
const lockedSha = "75096274f7ba2a8e94c17016b1dca94a8c15d0861085fbd71e71771ab6c3e382";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "gzhu-international-degree-routes-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Guangzhou University degree-route source");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Guangzhou University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-155.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "guangzhou-university") throw new Error("Missing Guangzhou University dependency");

const routes = [
  { slug: "international-bachelor-degree-route", nameEn: "International Bachelor's Degree Programs", degreeLevel: "Bachelor", duration: "4-5 years" },
  { slug: "international-master-degree-route", nameEn: "International Master's Degree Programs", degreeLevel: "Master", duration: "2-3 years" },
  { slug: "international-doctoral-degree-route", nameEn: "International Doctoral Degree Programs", degreeLevel: "Doctoral", duration: "3-4 years" },
];
const programs = routes.map((route) => ({
  slug: `guangzhou-university-${route.slug}`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: route.degreeLevel,
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `The official current degree-project page confirms an international ${route.degreeLevel.toLowerCase()} route with a published duration of ${route.duration}. It does not publish a major-level list, teaching language, tuition, deadline or 2027 intake, so those fields remain absent.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "normalized from the official degree-project headings",
    degreeLevel: "official bachelor, master and doctoral project statements",
    fieldCategory: "evidence-scope classification",
    subjectArea: "official page covers university-wide routes without a major list",
    applicationUrl: "official captured degree-project page",
    applicationNote: "official duration range and unresolved-field note",
  },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The official current international degree-project page confirms bachelor's, master's and doctoral routes with published duration ranges. The accessible 2026 guide page confirms the current cycle, but its detailed attachment remains CAPTCHA-protected and no explicit 2027 intake is published.",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current international degree-project page plus accessible 2026 guide page" },
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
    "The degree-project page was first published in 2020 and is current on the official site; it is not relabeled as a 2027 intake.",
    "The page confirms degree levels and duration ranges but does not embed a major-level international program list.",
    "No teaching language, tuition, application deadline, intake date or route-specific scholarship is published on the captured page; those fields remain absent.",
    "The detailed 2026 guide attachment remains CAPTCHA-protected and was not bypassed.",
    "Application form content, personal contacts and payment instructions are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public university-wide degree-route facts are retained; no applicant identity, personal contact or payment data is included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-263");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 263, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
