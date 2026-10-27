import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const locks = [
  { run: "2026-10-26T07-35-05-637Z", id: "njupt-international-home-current", sha256: "97188da3281f0fe2b04f2674c5184265cc8480d08f1c4fbb0dcb9e02e7664f3c" },
  { run: "2026-10-26T07-35-05-637Z", id: "njupt-international-notice-index-current", sha256: "b43f18093df8fa27f9789907f7bc52a51a3a3406d100f697ce051b7b133f9f4c" },
  { run: "2026-10-26T07-35-05-637Z", id: "njupt-international-admission-brochure-page-2026", sha256: "7a8025ed8ce0deeb0eb6f08e304f27ab1dd3ba0335ed6f11e5ccaf5df067daba" },
  { run: "2026-10-26T07-36-01-572Z", id: "njupt-international-admission-brochure-pdf-2026", sha256: "9841a1f5f30f4a26e12bd0c6e4540b27119e9cba8e30fcdfcc5fc3ced9845ac3" },
] as const;
const sources = new Map<string, Source>();
for (const lock of locks) {
  const directory = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((item) => item.id === lock.id && item.status === 200 && item.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked source ${lock.id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== lock.sha256) throw new Error(`Hash mismatch ${lock.id}`);
  sources.set(lock.id, source);
}
const primary = sources.get("njupt-international-admission-brochure-pdf-2026")!;
const sourceFields = { sourceUrl: primary.finalUrl ?? primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt };
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((item) => item.slug === "nanjing");
if (!city) throw new Error("Nanjing dependency missing");

const school = {
  slug: "nanjing-university-of-posts-and-telecommunications",
  nameEn: "Nanjing University of Posts and Telecommunications",
  nameZh: "南京邮电大学",
  citySlug: "nanjing",
  schoolType: "National Double First-Class university focused on electronic information and engineering",
  region: "Nanjing, Jiangsu, East China",
  applicationLevel: "Bachelor, Master and Doctoral international degree programs",
  languageOfInstruction: "Chinese and English degree routes are documented in the closed 2026 brochure.",
  languageRequirement: "The closed 2026 guide required HSK 5 for Chinese-taught degree study, or IELTS 5.5, TOEFL 72 or Duolingo 100 for English-taught degree study.",
  hskRequirement: "HSK 5 for Chinese-taught bachelor, master and doctoral routes in the closed 2026 guide.",
  englishRequirement: "IELTS 5.5, TOEFL 72 or Duolingo 100 for English-taught bachelor, master and doctoral routes in the closed 2026 guide.",
  deadlineSummary: "The newest general international guide accepted applications from early January through the end of May 2026 for September 2026 registration. No explicit general 2027 international application window is published on the current index.",
  tuitionSummary: "Closed 2026 annual tuition: bachelor CNY 18,000; master CNY 22,000; doctoral CNY 26,000. Undergraduate accommodation was CNY 1,500/year in a four-person room; graduate accommodation CNY 4,000/year in a double room. Application fee was CNY 800.",
  applicationFee: "CNY 800 in the closed 2026 guide",
  websiteUrl: "https://www.njupt.edu.cn/",
  admissionsUrl: sources.get("njupt-international-notice-index-current")!.finalUrl ?? sources.get("njupt-international-notice-index-current")!.url,
  cscaRequired: true,
  cscaRequirement: "All undergraduate applicants in the closed 2026 cycle had to take CSCA. Electronic Information Engineering and Computer Science and Technology required Mathematics and Physics; Business Administration and Electronic Commerce required Mathematics.",
  cscaSubjects: ["Mathematics", "Physics where required by major"],
  subjectTags: ["Electronic Information", "Telecommunications", "Computer Science", "Integrated Circuits", "Artificial Intelligence"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 18,000-26,000/year in the closed 2026 guide",
  campusHighlights: [
    "Electronic information is the university's defining disciplinary strength",
    "The official profile lists seven postdoctoral research stations",
    "International students come from more than 70 countries",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: primary.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official 2026 international brochure",
    nameZh: "official 2026 international brochure title",
    citySlug: "official brochure address plus reviewed Nanjing dependency",
    schoolType: "official 2026 institutional profile",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official 2026 program tables",
    languageOfInstruction: "official 2026 program tables",
    languageRequirement: "official 2026 application requirements",
    hskRequirement: "official 2026 application requirements",
    englishRequirement: "official 2026 application requirements",
    deadlineSummary: "official 2026 application period plus current notice-index review",
    tuitionSummary: "official 2026 tuition and housing sections",
    applicationFee: "official 2026 application section",
    websiteUrl: "official university domain",
    admissionsUrl: "current official international notice index",
    cscaRequired: "official 2026 application requirements",
    cscaRequirement: "official 2026 CSCA table",
    cscaSubjects: "official 2026 CSCA table",
    subjectTags: "official institutional profile and program tables",
    languageTags: "official 2026 program tables",
    tuitionBandLabel: "official 2026 tuition table",
    campusHighlights: "official 2026 institutional profile",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: primary.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map((lock) => { const source = sources.get(lock.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: primary.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 82, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The current official notice index exposes the 2026 brochure as its newest general inbound guide; no explicit general 2027 international guide is published.",
    "The brochure enumerates closed 2026 Chinese- and English-taught routes. They are retained as evidence and summarized at school level rather than represented as current or 2027 program rows.",
    "Four scholarship categories are named, but award-specific 2027 coverage and application rules are not published in the captured general guide; no scholarship record is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published personal contacts and applicant bank-proof details are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-138");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 138, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
