import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T14-24-30-162Z");
const lockedSha = "8027ecb252c1dd4b1e7f1da53595b1e7f7c8c076334fa0072ccd84674f7f013d";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "ynu-international-new-student-opening-2026" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Yunnan University international-new-student report");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Yunnan University evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-193.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "yunnan-university") throw new Error("Missing Yunnan University dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  slug: "yunnan-university-international-doctoral-degree-route-current",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "International Doctoral Degree Study (2026 new-student evidence)",
  degreeLevel: "Doctoral",
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official 2026 opening report identifies a Myanmar doctoral student as the international-new-student representative, directly confirming an international doctoral study level in the 2026 cohort. The report is not an admissions guide, so program names, teaching language, duration, tuition, deadlines, requirements, scholarships and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "normalized from the official 2026 international-new-student report", degreeLevel: "official doctoral-student identity within the international-new-student cohort", fieldCategory: "evidence-scope classification", subjectArea: "university-wide because the applicant-facing doctoral catalog was not captured", applicationUrl: "official 2026 international-new-student opening report", applicationNote: "official doctoral-level cohort evidence plus documented applicant-field omissions" },
};
const school = {
  ...priorSchool,
  applicationLevel: "The hash-locked official 2026 opening report directly confirms an international doctoral student in the incoming cohort. Current applicant-facing degree indexes remain unavailable to deterministic collection, and no explicit 2027 degree intake is inferred.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official 2026 international-new-student cohort report and documented index collection state" },
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
    "The captured report proves a 2026 international doctoral-student cohort but is not an applicant-facing admissions guide.",
    "The current English undergraduate, graduate, scholarship and major indexes remain limited to the 2026 cycle and reject deterministic collection because of their TLS state; certificate validation was not disabled.",
    "No undergraduate or master's route is inferred from this report alone.",
    "Program names, teaching language, duration, tuition, deadlines, requirements, scholarships and dated 2027 intakes remain absent.",
  ],
  sensitiveDataCheck: { result: "pass", note: "The candidate retains only the public study level and excludes the named student's identity, contacts and all applicant data." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-273");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 273, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
