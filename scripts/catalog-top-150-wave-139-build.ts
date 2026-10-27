import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T07-45-41-919Z";
const locks = [
  ["ncepu-international-admissions-gateway-current", "64bf8107728cec96908e41250e71169bf352c064549000bbad048a43210c5799"],
  ["ncepu-international-student-overview-current", "7e3318e7759b4b75bc2a8aeec8c3674e1b6c0c99fde2a11b9b06a7f3868d4161"],
  ["ncepu-international-application-system-current", "3de283de8584bb2d85a7599e0f25340645817877ab170caa255fcb7412d780d3"],
  ["ncepu-international-application-user-guide-current", "f1c8bff6a211e8f287536fcbcef7ae722429481e504932d7f34cf5ec534586b7"],
] as const;
const admission2027Lock = {
  run: "2026-10-26T14-57-23-044Z",
  id: "ncepu-international-admission-page-2027",
  sha256: "1b9d03a3a42c20a4cfdf8495f586e364008fe2f989aa7ad012abc16132b328da",
} as const;
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked source ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha256) throw new Error(`Hash mismatch ${id}`);
  sources.set(id, source);
}
const admission2027Directory = resolve(root, "work/catalog-official", admission2027Lock.run);
const admission2027Manifest = JSON.parse(await readFile(resolve(admission2027Directory, "manifest.json"), "utf8")) as { sources: Source[] };
const admission2027 = admission2027Manifest.sources.find((row) => row.id === admission2027Lock.id && row.status === 200 && row.sha256 === admission2027Lock.sha256);
if (!admission2027) throw new Error(`Missing locked source ${admission2027Lock.id}`);
if (createHash("sha256").update(await readFile(resolve(admission2027Directory, admission2027.artifactPath))).digest("hex") !== admission2027Lock.sha256) {
  throw new Error(`Hash mismatch ${admission2027Lock.id}`);
}
sources.set(admission2027.id, admission2027);
const primary = admission2027;
const sourceFields = { sourceUrl: primary.finalUrl ?? primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt };
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((row) => row.slug === "beijing");
if (!city) throw new Error("Beijing dependency missing");

const school = {
  slug: "north-china-electric-power-university",
  nameEn: "North China Electric Power University",
  nameZh: "华北电力大学",
  citySlug: "beijing",
  schoolType: "Energy and electric-power focused university",
  region: "Beijing, North China",
  applicationLevel: "Bachelor, Master, Doctoral, visiting and Chinese-language international study",
  languageOfInstruction: "Not published at route level in the locked current sources.",
  deadlineSummary: "The official 2027 admission guide is published, but its deadline table remains unstructured because the linked PDF exceeds the acquisition limit.",
  tuitionSummary: "The official 2027 admission guide is published, but its fee table remains unstructured because the linked PDF exceeds the acquisition limit.",
  websiteUrl: "https://www.ncepu.edu.cn/",
  admissionsUrl: sources.get("ncepu-international-application-system-current")!.finalUrl ?? sources.get("ncepu-international-application-system-current")!.url,
  subjectTags: ["Energy", "Electric Power", "Electrical Engineering"],
  languageTags: [],
  campusHighlights: [
    "International study spans bachelor, master, doctoral, visiting and language categories",
    "Chinese Government and Beijing Government scholarship categories are named at school level",
    "More than 800 international students from over 70 countries were reported in the current overview",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: primary.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official university and international application sites",
    nameZh: "official university page title",
    citySlug: "official Beijing admissions gateway plus reviewed Beijing dependency",
    schoolType: "official international overview institutional focus",
    region: "official Beijing admissions gateway plus CUAC taxonomy",
    applicationLevel: "official current international-student overview",
    languageOfInstruction: "official-source limitation",
    deadlineSummary: "official 2027 admission landing page; oversized attachment left unparsed",
    tuitionSummary: "official 2027 admission landing page; oversized attachment left unparsed",
    websiteUrl: "official university domain",
    admissionsUrl: "official international application system",
    subjectTags: "official international overview and institutional focus",
    campusHighlights: "official current international-student overview",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: primary.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.map(([id]) => sources.get(id)!), admission2027].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: primary.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 84, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The official 2027 admission landing page is captured and hash-locked, but its linked PDF is approximately 90 MB and exceeds the 15 MiB acquisition-policy limit, so attachment-only programs, fees, deadlines and requirements remain blank.",
    "The application portal and user guide document workflow only; they do not expose a current public route catalog and are not treated as program evidence.",
    "Scholarship categories are retained only as school-level context because cycle-specific coverage and rules are not published in the captured pages.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published staff contact details and payment instructions are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-139");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 139, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
