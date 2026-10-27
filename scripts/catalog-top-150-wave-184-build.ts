import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const directory = resolve(root, "work/catalog-official/2026-10-26T13-01-40-072Z");
const locks = new Map([
  ["henau-international-admissions-index-current", "280bfd49b565a9401a0658670d1ec4b7947a3b305871131ab4e4b5adfc56f905"],
  ["henau-international-admission-guide-pdf-2022", "d7d8f761b965c448d1222d8c259d44418cae50cdc247f7dec90ea66071c105c4"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha);
  if (!source) throw new Error(`Missing locked HENAU source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha) throw new Error(`HENAU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const index = sources.get("henau-international-admissions-index-current")!;
const guide = sources.get("henau-international-admission-guide-pdf-2022")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const city = {
  slug: "zhengzhou", nameEn: "Zhengzhou", nameZh: "郑州", province: "Henan", region: "Central China",
  tags: ["Henan", "Central China", "official-school-evidence"], status: "active" as const, verificationStatus: "verified" as const,
  lastVerifiedAt: index.fetchedAt, ...sf(index),
  sourceFieldLineage: { nameEn: "official campus addresses normalized to English", nameZh: "official campus addresses", province: "official campus addresses", region: "CUAC geographic taxonomy derived from verified location", tags: "CUAC geographic classification and evidence marker" },
};
const school = {
  slug: "henan-agricultural-university", nameEn: "Henan Agricultural University", nameZh: "河南农业大学", citySlug: city.slug,
  schoolType: "Public agricultural university", region: "Zhengzhou, Henan, Central China",
  applicationLevel: "The current official international admissions index exposes an international-student guide entry, while the latest complete guide that could be hash-locked is the 2022 guide. No applicant-facing 2027 international admission guide was captured.",
  websiteUrl: "https://www.henau.edu.cn/", admissionsUrl: index.finalUrl ?? index.url,
  subjectTags: ["Agriculture"], languageTags: [],
  campusHighlights: ["Official International Education College admissions index captured", "Culture Road and Longzihu campuses are both in Zhengzhou", "No applicant-facing 2027 international guide captured"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: index.fetchedAt, ...sf(guide),
  sourceFieldLineage: { nameEn: "official university identity normalized to English", nameZh: "official university identity", citySlug: "official Zhengzhou campus addresses", schoolType: "official identity plus CUAC taxonomy", region: "official addresses plus CUAC taxonomy", applicationLevel: "current admissions index and hash-locked 2022 guide", websiteUrl: "official university domain", admissionsUrl: "current official international admissions index", subjectTags: "official agricultural university identity", languageTags: "empty because current route-level language rules were not captured", campusHighlights: "captured index and campus-address scope" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: index.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: index.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 146, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 }, evidence,
  unresolved: ["No applicant-facing 2027 international admission guide was captured.", "The current guide detail page returned HTTP 404 during deterministic collection; the current index and hash-locked 2022 PDF were retained without bypassing access controls.", "Program names, intake records, current tuition, deadlines, language rules, and scholarships remain absent until current hash-locked evidence is available.", "Personal contacts, applicant files, and payment details are excluded."],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions, or private application materials are present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-184");
await Promise.all([writeFile(`${stem}.draft.json`, text, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 184, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
