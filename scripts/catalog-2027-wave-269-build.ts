import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T10-58-06-910Z");
const lockedSha = "fd711d7954f9dfebe0e181a38918613b541484393b911749d5fbd4063c7567a8";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "sdau-international-student-admission-workflow-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Shandong Agricultural University workflow");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Shandong Agricultural University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-171.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "shandong-agricultural-university") throw new Error("Missing Shandong Agricultural University dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const routes = [
  { suffix: "undergraduate", nameEn: "International Undergraduate Study Route (current admission workflow)", degreeLevel: "Bachelor", note: "The official workflow routes undergraduate-level review through the university student-affairs approval path." },
  { suffix: "postgraduate", nameEn: "International Postgraduate Study Route (current admission workflow)", degreeLevel: "Master", note: "The official workflow routes graduate-level review through the university graduate-school approval path. This conservative generic record does not assert doctoral availability." },
];
const programs = routes.map((route) => ({
  slug: `shandong-agricultural-university-international-${route.suffix}-route-current`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: route.degreeLevel,
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `${route.note} The captured workflow requires college review, a professional interview, submission of the university application form and supporting documents, university approval, and issuance of admission/JW202 materials. It does not publish program names, language, duration, tuition, deadlines or a 2027 intake, so those fields remain absent.`,
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "normalized from the official international-student admission workflow and approval paths", degreeLevel: "official undergraduate or graduate administrative path", fieldCategory: "evidence-scope classification", subjectArea: "university-wide because no current program catalog is published", applicationUrl: "official captured current admission workflow", applicationNote: "official workflow steps and documented missing applicant-facing catalog" },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The current official international-student admission workflow confirms undergraduate and graduate approval paths, college review, professional interview and university approval. No applicant-facing 2027 catalog or intake is published.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current international-student admission and enrollment workflow" },
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
    "The current workflow is not a cycle-specific 2027 guide and does not establish a dated 2027 intake.",
    "No current applicant-facing program catalog, teaching language, duration, tuition, deadline, language threshold or scholarship terms are published in the captured workflow.",
    "The graduate route is conservatively normalized as Master and does not assert doctoral availability.",
    "Application-form attachments, applicant documents, personal contacts and accommodation approval forms are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data or form contents are retained; only public workflow facts are represented." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-269");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 269, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
