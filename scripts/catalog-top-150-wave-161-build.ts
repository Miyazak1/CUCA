import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T09-32-30-964Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["dlmu-international-home-current", "242d087b829a53c9dd2364960cd22fe98d43e0d3b67cbd29c225ae55794747b9"],
  ["dlmu-international-admission-index-current", "e2a99a61a4e4b7ab6b97a121d3ddd08ff244db82213f75015963caeb62aaa0f4"],
  ["dlmu-international-master-chinese-current", "b86958965cee1a79c3d7b3c59a312645e1b64ca1d8ca746146b897ba2559182e"],
  ["dlmu-international-master-english-current", "86fbcaf85916f315d2105deab0f8dbb7bc6ca1fd998faf03a0edf95c4a399539"],
  ["dlmu-international-doctoral-chinese-current", "505a90ce90ba9d591a8d26d293c14a0f92cc35dc68d408ebcb5588345e26229d"],
  ["dlmu-international-doctoral-english-current", "a86d16dc28b2cde7bc0e9ff1eb971cc1099641f9a75ebeac11d9c5ec7506c334"],
  ["dlmu-cgs-type-b-2027-landing", "93316f251320a5c02bc08d364e7d144260549df40e9e28cec802be3d8a4be9d4"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked DMU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`DMU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const admission = sources.get("dlmu-international-admission-index-current")!;
const scholarshipSource = sources.get("dlmu-cgs-type-b-2027-landing")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "dalian");
if (!city) throw new Error("Reviewed Dalian dependency missing");

const school = {
  slug: "dalian-maritime-university",
  nameEn: "Dalian Maritime University",
  nameZh: "大连海事大学",
  citySlug: "dalian",
  schoolType: "Public maritime university under the Ministry of Transport",
  region: "Dalian, Liaoning, Northeast China",
  applicationLevel: "The current official international portal publishes bachelor, master, doctoral, preparatory, Chinese-language, visiting, study-trip and seasonal routes. The captured 2027 evidence is limited to the Chinese Government Scholarship Type B landing page and attachment titles.",
  languageOfInstruction: "Chinese and English routes are advertised for master and doctoral study; the bachelor page is Chinese-taught.",
  languageRequirement: "Current master pages require HSK Level 5 for Chinese-taught study or accepted English proof/test for English-taught study. The current English doctoral page states TOEFL 90, IELTS 6.0, an English-medium certificate or university test; the Chinese doctoral page requires HSK Level 5.",
  hskRequirement: "HSK Level 5 or an accepted university test for current Chinese-taught master and doctoral routes.",
  englishRequirement: "Current English doctoral page: TOEFL 90, IELTS 6.0, English-medium certificate or accepted university test. The master page accepts recognized English proof or the university test without publishing a numeric threshold.",
  deadlineSummary: "Current master and doctoral pages state a general June 30 annual deadline, but no general 2027 degree cycle is identified. The protected 2027 scholarship attachment deadline is not inferred.",
  websiteUrl: "https://www.dlmu.edu.cn/",
  admissionsUrl: admission.finalUrl ?? admission.url,
  subjectTags: ["Maritime Studies", "Transportation", "Navigation", "Marine Engineering", "Logistics"],
  languageTags: ["Chinese", "English"],
  campusHighlights: ["Official international degree and non-degree admissions portal", "Chinese- and English-taught graduate pathways", "2027 Chinese Government Scholarship Type B materials published"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipSource.fetchedAt,
  ...sourceFields(admission),
  sourceFieldLineage: {
    nameEn: "official international portal",
    nameZh: "official Chinese portal",
    citySlug: "official address plus reviewed Dalian dependency",
    schoolType: "official institutional description plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official current admissions navigation and 2027 scholarship attachment titles",
    languageOfInstruction: "official current degree pages",
    languageRequirement: "official current master and doctoral pages",
    hskRequirement: "official current master and doctoral pages",
    englishRequirement: "official current master and doctoral pages",
    deadlineSummary: "official current degree pages; protected 2027 attachment intentionally unresolved",
    websiteUrl: "official university domain",
    admissionsUrl: "official international admissions index",
    subjectTags: "official maritime-university profile plus CUAC taxonomy",
    languageTags: "official current degree pages",
    campusHighlights: "official current portal and 2027 scholarship landing page",
  },
};

const scholarships = [{
  slug: "dalian-maritime-university-chinese-government-scholarship-type-b-2027",
  title: "Dalian Maritime University Chinese Government Scholarship Type B — 2027",
  nameZh: "大连海事大学2027年中国政府奖学金高校自主招生项目（B类）",
  schoolSlug: school.slug,
  type: "government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "国家留学基金管理委员会 / 大连海事大学",
  providerNameEn: "China Scholarship Council / Dalian Maritime University",
  providerLocation: "Dalian, Liaoning, China",
  applicableDegree: "Not stated on the captured landing page; refer to the protected official 2027 prospectus attachment.",
  requirementText: "The official landing page publishes a 2027 DMU-CSC Scholarship Application (Type B) prospectus and checklist. Eligibility, degree scope and detailed requirements remain unresolved because the university attachment endpoint requires a CAPTCHA.",
  actionLinks: [{ label: "Official 2027 scholarship landing page", url: scholarshipSource.finalUrl ?? scholarshipSource.url, kind: "official-source" }],
  applicationRound: "2027 DMU-CSC Scholarship Application (Type B)",
  tags: ["2027", "Chinese Government Scholarship", "Type B", "Official attachment protected"],
  summary: "Officially listed 2027 DMU Chinese Government Scholarship Type B round; detailed terms remain blank pending accessible official evidence.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipSource.fetchedAt,
  ...sourceFields(scholarshipSource),
  sourceFieldLineage: {
    title: "official 2027 prospectus and checklist attachment titles",
    applicableDegree: "explicitly unresolved because the protected attachment body is unavailable",
    requirementText: "official landing-page attachment titles and observed CAPTCHA protection",
    applicationRound: "official 2027 checklist title",
    tags: "official scholarship type and cycle",
    summary: "official 2027 attachment title; no hidden terms inferred",
  },
}];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: scholarshipSource.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: scholarshipSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 113, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The official 2027 CSC Type B prospectus and checklist are linked from the university landing page, but their download endpoint requires a CAPTCHA. Access controls were not bypassed; coverage, degree scope, deadline and materials remain blank.",
    "Current master and doctoral pages publish general annual requirements and a June 30 deadline but do not identify a general 2027 degree cycle or expose deterministic program tables in text; no 2027 program or intake row is inferred.",
    "No current numeric tuition schedule was captured for the 2027 cycle.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant documents, personal contacts and payment details are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-161");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 161, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
