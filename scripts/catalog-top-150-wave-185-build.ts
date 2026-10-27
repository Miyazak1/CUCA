import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const directory = resolve(root, "work/catalog-official/2026-10-26T13-01-48-090Z");
const locks = new Map([["cqupt-international-college-home-current", "ee86306b78bd84bcb9cebae91c969464262e3b641839a30eeceb7f5d3c402c01"]]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha);
  if (!source) throw new Error(`Missing locked CQUPT source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha) throw new Error(`CQUPT evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const index = sources.get("cqupt-international-college-home-current")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const city = {
  slug: "chongqing", nameEn: "Chongqing", nameZh: "重庆", province: "Chongqing", region: "Southwest China",
  tags: ["Chongqing", "Southwest China", "official-school-evidence"], status: "active" as const, verificationStatus: "verified" as const,
  lastVerifiedAt: index.fetchedAt, ...sf(index),
  sourceFieldLineage: { nameEn: "official college address normalized to English", nameZh: "official college address", province: "municipality identity from official address", region: "CUAC geographic taxonomy derived from verified location", tags: "CUAC geographic classification and evidence marker" },
};
const school = {
  slug: "chongqing-university-of-posts-and-telecommunications", nameEn: "Chongqing University of Posts and Telecommunications", nameZh: "重庆邮电大学", citySlug: city.slug,
  schoolType: "Public information and communications university", region: "Chongqing, Southwest China",
  applicationLevel: "The current official International College home page lists a 2026-2027 international undergraduate admission guide and older international master and doctoral guides. The linked guide pages returned HTTP 412 during deterministic collection, so no route-level fields are asserted.",
  websiteUrl: "https://www.cqupt.edu.cn/", admissionsUrl: index.finalUrl ?? index.url,
  subjectTags: ["Information and Communications"], languageTags: [],
  campusHighlights: ["Current official index confirms a 2026-2027 international undergraduate admission guide", "International College is located on Chongwen Road in Nan'an District", "Guide detail pages were not bypassed after HTTP 412 responses"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: index.fetchedAt, ...sf(index),
  sourceFieldLineage: { nameEn: "official university identity normalized to English", nameZh: "official university identity", citySlug: "official Chongqing address", schoolType: "official identity plus CUAC taxonomy", region: "official address plus CUAC taxonomy", applicationLevel: "current official admission-index titles and documented access limitation", websiteUrl: "official university domain", admissionsUrl: "current official International College index", subjectTags: "official university identity", languageTags: "empty because current route-level language rules were not captured", campusHighlights: "captured current index, address, and access state" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: index.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: index.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 147, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 }, evidence,
  unresolved: ["The official index links a 2026-2027 international undergraduate guide, but its detail page returned HTTP 412 during deterministic collection and access controls were not bypassed.", "The linked master and doctoral guides also returned HTTP 412.", "Program names, intake records, tuition, deadlines, language rules, and scholarships remain absent until hash-locked guide evidence is available.", "Personal contacts, applicant files, and payment details are excluded."],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions, or private application materials are present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-185");
await Promise.all([writeFile(`${stem}.draft.json`, text, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 185, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
