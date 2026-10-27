import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/nnu-sust-followup-escalated-2-2026-10-27");
const lockedSha = "ac9bac21aef5f60ffa2e6df123bff733ecb6d789b42ca553a7772e18f6c83291";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "nnu-university-home-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Nanjing Normal University home evidence");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("NNU evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-124.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "nanjing-normal-university") throw new Error("Missing NNU dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  slug: "nanjing-normal-university-international-student-admissions-route-current",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "International student admissions route (program details pending official publication)",
  degreeLevel: "Unspecified",
  applicationUrl: "https://en.njnu.edu.cn/admissions",
  applicationNote: "The current official university home explicitly links an international-student admissions gateway and an international-student education channel. The linked English site returns HTTP 412 to the deterministic collector, so degree level, program names, teaching language, tuition, deadline, requirements, documents, scholarships and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "normalized from the official current international-student admissions navigation label",
    degreeLevel: "left unspecified because the captured page does not identify a degree level",
    applicationUrl: "exact admissions destination linked by the captured official university home",
    applicationNote: "official navigation evidence plus documented collection limitation",
  },
};
const school = {
  ...priorSchool,
  admissionsUrl: "https://en.njnu.edu.cn/admissions",
  applicationLevel: "The hash-locked current university home explicitly links an international-student admissions gateway. Its protected English site does not permit deterministic collection, so the route is retained with an unspecified level and without applicant-facing 2027 fields.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), admissionsUrl: "exact gateway linked by the official current home", applicationLevel: "official current navigation; no program or cycle inference" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 58, schoolSlugs: [school.slug], programs: 1, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured current official home proves an international-student admissions gateway but does not enumerate degree levels or programs.",
    "The official English home and admissions gateway return HTTP 412 to deterministic collection; the protection was not bypassed.",
    "Degree level, program name, language, duration, tuition, deadline, requirements, documents, scholarships and dated 2027 intake remain absent.",
    "Third-party reproductions of a 2026 guide were discovered but excluded from candidate evidence.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional navigation facts are retained; no applicant data or personal contacts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-277");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 277, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
