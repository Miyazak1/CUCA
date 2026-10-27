import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/nbu-medical-international-clinical-medicine-2026-10-27");
const lockedSha = "b40e401569fca334cfbcc63894ddc8cef0e3b95429eca6418e5e9440f6021753";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "nbu-medical-school-international-clinical-medicine-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Ningbo University international Clinical Medicine evidence");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Ningbo University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-192.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "ningbo-university") throw new Error("Missing Ningbo University dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  slug: "ningbo-university-clinical-medicine-english-international-undergraduate-current",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "Clinical Medicine (English-taught international undergraduate program)",
  degreeLevel: "Bachelor",
  fieldCategory: "Medicine",
  subjectArea: "Clinical Medicine",
  teachingLanguage: "English",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The Medical School profile, published September 15, 2026 with data through September 30, 2026, explicitly confirms one English-taught Clinical Medicine undergraduate program for international students. It is not an admissions guide, so duration, tuition, deadline, requirements, application documents, scholarships and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "normalized from the official Chinese program description",
    degreeLevel: "official undergraduate label",
    fieldCategory: "normalized from Clinical Medicine",
    subjectArea: "official Clinical Medicine program name",
    teachingLanguage: "official English-taught label",
    applicationUrl: "official current Ningbo University Medical School profile",
    applicationNote: "official current program scope plus documented admissions-field omissions",
  },
};
const school = {
  ...priorSchool,
  applicationLevel: "A hash-locked Ningbo University Medical School profile current through September 30, 2026 directly confirms an English-taught Clinical Medicine undergraduate program for international students. The university-wide 2027 international admissions cycle remains unpublished or unavailable to strict collection.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current Medical School profile; no cycle-specific inference" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: 1, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured Medical School profile establishes a current international undergraduate program but is not a cycle-specific admissions guide.",
    "The current 2026 international application index and all 2026 guides reject deterministic collection with malformed 403 responses; no protection was bypassed.",
    "Duration, tuition, deadline, requirements, application documents, scholarships and dated 2027 intake records remain absent.",
    "No university-wide master's, doctoral or non-degree route is inferred from this school-level profile.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional program facts are retained; no student identities, contacts or applicant data are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-275");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 275, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
