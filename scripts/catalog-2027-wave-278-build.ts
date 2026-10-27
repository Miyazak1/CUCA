import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/sust-chsi-school-maintained-profile-current-2026-10-27");
const lockedSha = "ec6f3aba609fb4e94f79a20daa7df2e1ad4e0a9553535f5c1f7f916cf1215347";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "sust-chsi-school-maintained-profile-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked SUST school-maintained CHSI profile");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("SUST CHSI evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-196.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "shaanxi-university-of-science-and-technology") throw new Error("Missing SUST dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  slug: "shaanxi-university-of-science-and-technology-international-student-route-current",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "International student route (program details pending official admissions guide)",
  degreeLevel: "Unspecified",
  applicationUrl: "https://oice.sust.edu.cn/lxskd.htm",
  applicationNote: "The school-maintained CHSI profile, current through June 15, 2026, explicitly states that SUST educates international students from nearly 30 countries. It does not identify their degree levels or applicant-facing programs. The university international-study index returns HTTP 403 to the deterministic collector, so program names, language, duration, tuition, deadlines, requirements, documents, scholarships and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "normalized from the school-maintained current statement that the university educates international students",
    degreeLevel: "left unspecified because the captured statement does not connect international students to a degree level",
    applicationUrl: "registered official university international-study index",
    applicationNote: "school-maintained current profile plus documented admissions-site collection limitation",
  },
};
const school = {
  ...priorSchool,
  applicationLevel: "A hash-locked, school-maintained CHSI profile current through June 15, 2026 confirms that the university currently educates international students from nearly 30 countries. It does not expose applicant-facing routes or a 2027 cycle, so one unspecified route is retained and all unsupported fields remain absent.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "school-maintained current CHSI profile; no degree-level or cycle inference" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 132, schoolSlugs: [school.slug], programs: 1, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured current school-maintained profile confirms international students but does not connect them to a specific degree level or program.",
    "The official university and international-study hosts return HTTP 403 or fail strict collection; access controls were not bypassed.",
    "Program names, degree level, language, duration, tuition, deadline, requirements, documents, scholarships and dated 2027 intake remain absent.",
    "A third-party reproduction of a 2026 brochure was discovered but excluded from candidate evidence.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional facts are retained; no applicant data or personal contacts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-278");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 278, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
