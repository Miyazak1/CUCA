import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/neu-faculty-international-postgraduate-2027-2026-10-27");
const lockedSha = "1d0812972aec0cfcdbe6f47facc6afcc3fe716f408c4b90ffb968c8c6b5dfb86";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "neu-faculty-software-engineering-international-postgraduate-2027" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Northeastern University 2027 international postgraduate evidence");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Northeastern University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-191.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "northeastern-university") throw new Error("Missing Northeastern University dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const routes = [
  {
    suffix: "software-engineering-master-international-2027",
    nameEn: "Software Engineering (2027 international master's opening)",
    degreeLevel: "Master",
    note: "The official faculty admissions page explicitly lists a 2027 Software Engineering master's opening for international students with two places.",
  },
  {
    suffix: "software-engineering-doctoral-international-2027",
    nameEn: "Software Engineering (2027 international doctoral opening)",
    degreeLevel: "Doctoral",
    note: "The official faculty admissions page explicitly lists a 2027 Software Engineering doctoral opening for international students with one place.",
  },
];
const programs = routes.map((route) => ({
  slug: `northeastern-university-${route.suffix}`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: route.degreeLevel,
  fieldCategory: "Computer Science and Software Engineering",
  subjectArea: "Software Engineering",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `${route.note} This supervisor-level notice is not the university-wide international admissions guide; teaching language, duration, tuition, deadline, general requirements and intake term remain absent.`,
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "normalized from the official 2027 international-student opening title",
    degreeLevel: "official master's-international-student or doctoral-international-student label",
    fieldCategory: "normalized from Software Engineering",
    subjectArea: "official Software Engineering major",
    applicationUrl: "official Northeastern University faculty admissions page",
    applicationNote: "official 2027 program-level availability plus documented university-wide admissions omissions",
  },
}));
const school = {
  ...priorSchool,
  applicationLevel: "A hash-locked official faculty admissions page directly confirms 2027 Software Engineering master's and doctoral openings for international students. It does not establish the complete university-wide 2027 international admissions cycle.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official 2027 international postgraduate openings on a Northeastern University faculty page" },
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
    "The captured page is a faculty-level availability notice, not the university-wide international admissions guide.",
    "The university-wide 2027 scholarship guide is discoverable but its official hosts currently fail strict TLS collection; certificate checks were not disabled.",
    "The page does not publish teaching language, duration, tuition, deadline, general requirements or a Fall/Spring intake term, so those fields remain absent.",
    "No undergraduate or non-degree 2027 route is inferred from this source.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only the public program, level, admissions year and aggregate place count are summarized; no personal contacts or applicant data are retained." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-274");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 274, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
