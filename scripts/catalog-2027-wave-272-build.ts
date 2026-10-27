import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/cqu-orientation-followup-2026-10-27");
const lockedSha = "e16c128ab76b67ba3de3b9848231983bf61a1ca3c44578684a92194b26b141a9";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "cqu-international-new-student-orientation-2026" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Chongqing University international orientation report");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Chongqing University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-190.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "chongqing-university") throw new Error("Missing Chongqing University dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  slug: "chongqing-university-international-postgraduate-degree-route-current",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "International Postgraduate Degree Study (2026 orientation evidence)",
  degreeLevel: "Master",
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official 2026 international-new-student orientation report expressly describes graduate training requirements, academic research rules, thesis-defense applications, key milestones and degree study. This conservative generic route is normalized as Master and does not separately assert doctoral availability. The report is not an admissions guide, so program names, teaching language, duration, tuition, deadlines, requirements, scholarships and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "normalized from the official 2026 international-new-student orientation scope", degreeLevel: "official graduate training and degree-study scope conservatively normalized as Master", fieldCategory: "evidence-scope classification", subjectArea: "university-wide because the applicant-facing catalog was not captured", applicationUrl: "official international-new-student orientation report", applicationNote: "official graduate-training details plus documented applicant-field omissions" },
};
const school = {
  ...priorSchool,
  applicationLevel: "The hash-locked official 2026 international-new-student orientation report confirms an international postgraduate degree-study population and graduate training process. Current applicant-facing guides remain unavailable to deterministic collection, and no explicit 2027 degree intake is inferred.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official 2026 international-new-student orientation report and documented guide collection state" },
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
    "The captured source confirms a 2026 international postgraduate population and degree-study process but is not an applicant-facing admissions guide.",
    "The postgraduate route is conservatively normalized as Master and does not separately assert doctoral availability.",
    "Current undergraduate, postgraduate and Spring 2027 scholarship pages still return HTTP 412 to deterministic collection; no access control was bypassed.",
    "Program names, teaching language, duration, tuition, deadlines, requirements, scholarships and dated 2027 degree intakes remain absent.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public training-scope facts are retained; no applicant data, personal contacts or payment details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-272");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 272, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
