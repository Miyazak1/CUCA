import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T09-16-17-488Z");
const locks = new Map([
  ["kust-international-admissions-index-current", "2185ce22df42ded20d015f93cb41cc6f3482c34a73559be8e67d5e2e17d1a08e"],
  ["kust-international-admission-guide-page-2026", "a00dff1345e5bf306ac9a27b905ae183434b52a83dfd297ea8b13ddf5d6de9a1"],
  ["kust-international-program-catalog-page-2026", "8645f3ac8d430e67b7534860a93501c0bf4dbeec5dc9150e93668ba8d38b5bb6"],
]);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked KUST source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`KUST evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const index = sources.get("kust-international-admissions-index-current")!;
const guide = sources.get("kust-international-admission-guide-page-2026")!;
const catalog = sources.get("kust-international-program-catalog-page-2026")!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-158.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "kunming-university-of-science-and-technology") throw new Error("Missing KUST dependency");
const sourceFields = { sourceUrl: catalog.finalUrl ?? catalog.url, sourceLabel: catalog.label, sourceSha256: catalog.sha256, capturedAt: catalog.fetchedAt };
const programs = (["Bachelor", "Master", "Doctoral"] as const).map((degreeLevel) => ({
  slug: `kunming-university-of-science-and-technology-international-${degreeLevel.toLowerCase()}-route-current-2026`,
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: `International ${degreeLevel} Programs (2026 catalog)`,
  degreeLevel,
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: "The official current admissions index and 2026 program-catalog page advertise this degree level. The detailed guide and catalog workbooks are protected by an official verification-code page, so program names, teaching language, duration, tuition, deadline and any explicit 2027 intake remain absent.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: catalog.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "official 2026 degree-program catalog headings", degreeLevel: "official bachelor, master or doctoral catalog category", fieldCategory: "evidence-scope classification", subjectArea: "university-wide route because protected workbooks were not bypassed", applicationUrl: "official captured 2026 guide page", applicationNote: "captured official index and documented protected-attachment limitation" },
}));
const school = {
  ...priorSchool,
  applicationLevel: "The official current admissions index and 2026 catalog page confirm international Bachelor, Master and Doctoral routes. The protected detailed workbooks were not bypassed, and no explicit 2027 intake is inferred.",
  lastVerifiedAt: catalog.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official current index, 2026 guide page and degree-program catalog page" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: catalog.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const evidence = [index, guide, catalog].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: candidate.generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 0 }, evidence,
  unresolved: [
    "The official international admissions index publishes 2026 as its newest degree cycle; no inbound 2027 guide is captured.",
    "Detailed guide and catalog workbooks require a verification code; access controls were not bypassed.",
    "Program names, teaching language, duration, tuition, deadline, requirements and scholarship fields remain absent.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public school-level route categories are retained; no applicant data, personal contacts or payment details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-268");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 268, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
