import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const directory = resolve(root, "work/catalog-official/2026-10-26T12-39-44-184Z");
const locks = new Map([
  ["nuc-international-admissions-index-current", "89110f61726fcef191b1fb7b9c907914c5c43a8a1649e2459907cafa21e3d88d"],
  ["nuc-international-graduate-guide-page-2026", "7e37a36c2b3a263ebc513e12f36c14cb475d8c201f4a8e3273ffea56dc8457e2"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha);
  if (!source) throw new Error(`Missing locked NUC source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha) throw new Error(`NUC evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const index = sources.get("nuc-international-admissions-index-current")!;
const guide = sources.get("nuc-international-graduate-guide-page-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const city = { slug: "taiyuan", nameEn: "Taiyuan", nameZh: "太原", province: "Shanxi", region: "North China", tags: ["Shanxi", "North China", "official-school-evidence"], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: index.fetchedAt, ...sf(index), sourceFieldLineage: { nameEn: "official international college address normalized to English", nameZh: "official university location", province: "official university location", region: "CUAC geographic taxonomy derived from verified location", tags: "CUAC geographic classification and evidence marker" } };
const school = {
  slug: "north-university-of-china", nameEn: "North University of China", nameZh: "中北大学", citySlug: city.slug, schoolType: "Public science and engineering university", region: "Taiyuan, Shanxi, North China",
  applicationLevel: "The current official international admissions index publishes a 2026 international graduate guide and older 2022 undergraduate and program catalogs. The guide's current program-list attachment is protected by a verification-code download page, and the indexed direct PDF URL returned HTTP 404 during deterministic collection.",
  deadlineSummary: "The indexed 2026 graduate guide states a March 13-May 31, 2026 application period, but its PDF could not be hash-locked in this run. No 2027 international admission deadline is published.",
  tuitionSummary: "The indexed official 2026 graduate guide reports CNY 20,000/year for master study and CNY 25,000/year for doctoral study; because the PDF snapshot returned HTTP 404, these amounts remain explanatory context and are not attached to route records.",
  websiteUrl: "https://www.nuc.edu.cn/", admissionsUrl: index.finalUrl ?? index.url, subjectTags: ["Engineering", "Science", "Graduate Study"], languageTags: [],
  campusHighlights: ["Current official index confirms a 2026 international graduate admission cycle", "2026 program attachment requires a verification code and was not bypassed", "No applicant-facing 2027 international guide found"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: index.fetchedAt, ...sf(guide),
  sourceFieldLineage: { nameEn: "official university identity", nameZh: "official guide title", citySlug: "official Taiyuan address", schoolType: "official identity plus CUAC taxonomy", region: "official location plus CUAC taxonomy", applicationLevel: "current admissions index and protected attachment state", deadlineSummary: "indexed guide evidence with snapshot limitation disclosed", tuitionSummary: "indexed guide evidence with snapshot limitation disclosed", websiteUrl: "official university domain", admissionsUrl: "current official admissions index", subjectTags: "official university identity and graduate scope", languageTags: "empty because current language rules were not captured", campusHighlights: "captured current index and attachment access state" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: index.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = { version: 1, status: "unreviewed_draft", generatedAt: index.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 144, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 }, evidence, unresolved: ["No applicant-facing 2027 international guide was found.", "The 2026 program attachment requires a verification code and was not bypassed; the indexed direct PDF URL returned HTTP 404.", "Program names, intake records, language rules, tuition fields, current deadlines, and scholarships remain absent until a valid hash-locked source is available.", "Personal contacts, applicant files, and payment details are excluded."], sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions, or private application materials are present." } };
const stem = resolve(root, "seeds/catalog.2027-wave-182");
await Promise.all([writeFile(`${stem}.draft.json`, text, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 182, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
