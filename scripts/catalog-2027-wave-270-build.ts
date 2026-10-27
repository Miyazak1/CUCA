import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T14-33-15-544Z");
const lockedSha = "2d0cb5aab1debce38e324ed7ae69e8ffd365a0ba68d8070f3848735be8e8f74e";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "cdut-international-student-management-policy-official" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Chengdu University of Technology policy");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Chengdu University of Technology evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-195.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "chengdu-university-of-technology") throw new Error("Missing Chengdu University of Technology dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const routes = [
  { suffix: "undergraduate", nameEn: "International Undergraduate Degree Study (official policy scope)", degreeLevel: "Bachelor", note: "The official international-student policy expressly covers undergraduate degree students." },
  { suffix: "postgraduate", nameEn: "International Postgraduate Degree Study (official policy scope)", degreeLevel: "Master", note: "The official international-student policy expressly covers postgraduate degree students. This conservative generic route does not separately assert doctoral availability." },
];
const programs = routes.map((route) => ({
  slug: `chengdu-university-of-technology-international-${route.suffix}-degree-route-current`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: route.degreeLevel,
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: "https://cie.cdut.edu.cn/lxcl1/zsjz.htm",
  applicationNote: `${route.note} The current 2026 applicant guides are registered but still reject deterministic collection, so program names, teaching language, duration, tuition, deadlines, requirements and any explicit 2027 intake remain absent.`,
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "normalized from the official international-student policy scope", degreeLevel: "official undergraduate or postgraduate degree-student category", fieldCategory: "evidence-scope classification", subjectArea: "university-wide because current applicant guides were not captured", applicationUrl: "registered official international-admission guide index", applicationNote: "official policy scope and documented current-guide collection failure" },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The locked official international-student policy confirms undergraduate and postgraduate degree-study categories. Current 2026 applicant guides remain unavailable to deterministic collection, and no explicit 2027 intake is inferred.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official international-student policy and documented current-guide collection state" },
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
    "The locked policy establishes student categories but is not an applicant-facing 2027 admissions guide.",
    "Registered 2026 undergraduate, postgraduate and 2026-2027 scholarship pages still reject deterministic collection; no access control was bypassed.",
    "Program names, teaching language, duration, tuition, deadlines, requirements, scholarships and dated 2027 intake records remain absent.",
    "The postgraduate route is conservatively normalized as Master and does not separately assert a doctoral route.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public policy scope is retained; no applicant data, personal contacts or payment details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-270");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 270, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
