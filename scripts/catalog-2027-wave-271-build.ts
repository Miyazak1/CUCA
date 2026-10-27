import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T14-10-02-762Z");
const lockedSha = "e21fb2b6de36a9708a248ee70164750d7cd621106fbad07457c7dca61560b683";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "ruc-study-at-renmin-profile-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked Renmin University of China profile");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("Renmin University of China evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-189.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "renmin-university-of-china") throw new Error("Missing Renmin University of China dependency");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const routes = [
  { suffix: "undergraduate", nameEn: "International Undergraduate Degree Study (current official profile scope)", degreeLevel: "Bachelor", fieldCategory: "University-wide degree route", subjectArea: "Multiple fields", note: "The current official profile expressly confirms an international undergraduate education level." },
  { suffix: "master", nameEn: "International Master's Degree Study (current official profile scope)", degreeLevel: "Master", fieldCategory: "University-wide degree route", subjectArea: "Multiple fields", note: "The current official profile expressly confirms an international master's education level." },
  { suffix: "doctoral", nameEn: "International Doctoral Degree Study (current official profile scope)", degreeLevel: "Doctoral", fieldCategory: "University-wide degree route", subjectArea: "Multiple fields", note: "The current official profile expressly confirms an international doctoral education level." },
  { suffix: "chinese-language", nameEn: "International Chinese Language Study (current official profile scope)", degreeLevel: "Non-degree", fieldCategory: "Chinese Language", subjectArea: "Chinese language", note: "The current official profile expressly confirms Chinese-language study for international students." },
  { suffix: "exchange", nameEn: "International Short- and Long-Term Exchange Study (current official profile scope)", degreeLevel: "Non-degree", fieldCategory: "Exchange", subjectArea: "Multiple fields", note: "The current official profile expressly confirms short- and long-term exchange study for international students." },
];
const programs = routes.map((route) => ({
  slug: `renmin-university-of-china-international-${route.suffix}-route-current`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: route.degreeLevel,
  fieldCategory: route.fieldCategory,
  subjectArea: route.subjectArea,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `${route.note} The captured profile is not a cycle-specific admissions guide, so program names, teaching language, duration, tuition, deadlines, requirements, scholarships and any explicit 2027 intake remain absent.`,
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "normalized from the official international-education scope", degreeLevel: "official bachelor, master, doctoral, Chinese-language or exchange category", fieldCategory: "evidence-scope classification", subjectArea: "official profile scope without an applicant-facing catalog", applicationUrl: "official current Study at Renmin profile", applicationNote: "official route scope and documented cycle-specific omissions" },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The current official profile confirms international bachelor, master and doctoral education together with Chinese-language and short- and long-term exchange study. No cycle-specific 2027 degree guide is inferred.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current Study at Renmin profile; no cycle-specific inference" },
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
    "The captured profile establishes study levels but is not a cycle-specific 2027 admissions guide.",
    "The official international-student site and guide indexes still reject deterministic collection because of their TLS or access-control state; no protection was bypassed.",
    "Program names, teaching language, duration, tuition, deadlines, requirements, scholarships and dated 2027 intake records remain absent.",
    "The profile's subject examples are retained only on the school record and are not converted into unsupported program records.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public study-level scope is retained; no applicant data, personal contacts or payment details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-271");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 271, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
