import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/xauat-architecture-undergraduate-international-current-2026-10-27");
const lockedSha = "f5caada49224dc68c9d563fbac7acb519851228dcbe9b61c2f543754e5454f38";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "xauat-architecture-undergraduate-international-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked XAUAT Architecture international-student evidence");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("XAUAT Architecture evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-194.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "xian-university-of-architecture-and-technology") throw new Error("Missing XAUAT dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  slug: "xian-university-of-architecture-and-technology-architecture-international-undergraduate-current",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "Architecture (international undergraduate route)",
  degreeLevel: "Bachelor",
  fieldCategory: "Architecture and Built Environment",
  subjectArea: "Architecture",
  durationYears: 5,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The current School of Architecture profile identifies Architecture (082801) as a five-year Bachelor of Architecture program and explicitly states that it recruits international students. It is not a cycle-specific international admissions guide, so teaching language, tuition, deadline, application requirements, documents, scholarships and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "normalized from the official Architecture program name and international-student statement",
    degreeLevel: "official Bachelor of Architecture degree label",
    fieldCategory: "normalized from Architecture",
    subjectArea: "official Architecture program name",
    durationYears: "official five-year duration",
    applicationUrl: "official current School of Architecture program profile",
    applicationNote: "official program scope plus documented admissions-field omissions",
  },
};
const school = {
  ...priorSchool,
  applicationLevel: "A hash-locked current School of Architecture profile directly confirms a five-year Bachelor of Architecture route that recruits international students. A cycle-specific 2027 international guide, fee schedule and application window remain unpublished or unavailable to strict collection.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current Architecture profile; no cycle-specific inference" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 118, schoolSlugs: [school.slug], programs: 1, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured Architecture profile confirms a current international undergraduate route but is not a cycle-specific admissions guide.",
    "Teaching language, tuition, deadline, requirements, application documents, scholarships and dated 2027 intake records remain absent.",
    "The domestic admissions wording and drawing/colour-vision discussion are not generalized into international applicant requirements.",
    "No other XAUAT program or degree level is inferred from this single-program profile.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional program facts are retained; no applicant data or personal contact details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-276");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 276, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
