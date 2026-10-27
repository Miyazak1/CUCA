import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-26T07-30-25-266Z";
const locks = [
  ["hfut-international-notice-index-current", "6eb1e501b9027071600862d372dd335fc2d3b18cb8ccb10757f4ef554a511301"],
  ["hfut-international-undergraduate-guide-2026", "aeae8ee6073c7f9225ac19092d592abbc9cf5481d6e584745fb8a238d9d1120b"],
  ["hfut-international-undergraduate-program-catalog-2026", "affbc6c63ffae2eb4f721169044e40435d4a2e9a977acba008707fef51e3e8b1"],
] as const;

const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha256);
  if (!source) throw new Error(`Missing locked source ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== sha256) throw new Error(`Hash mismatch ${id}`);
  sources.set(id, source);
}

const primary = sources.get("hfut-international-undergraduate-guide-2026")!;
const sourceFields = {
  sourceUrl: primary.finalUrl ?? primary.url,
  sourceLabel: primary.label,
  sourceSha256: primary.sha256,
  capturedAt: primary.fetchedAt,
};
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((item) => item.slug === "hefei");
if (!city) throw new Error("Hefei dependency missing");

const school = {
  slug: "hefei-university-of-technology",
  nameEn: "Hefei University of Technology",
  nameZh: "合肥工业大学",
  citySlug: "hefei",
  schoolType: "National key Double First-Class university directly administered by the Ministry of Education",
  region: "Hefei, Anhui, East China",
  applicationLevel: "Undergraduate international admission is documented in the closed 2026 guide; the current notice index does not expose a general 2027 international guide.",
  languageOfInstruction: "Chinese and English undergraduate routes are documented in the 2026 guide and its official program workbook.",
  languageRequirement: "For the closed 2026 cycle, Chinese-taught applicants needed HSK 4 with at least 180. English-taught applicants needed IELTS 6.0, TOEFL 85, TOEFL Essentials 9, Duolingo 100, or acceptable proof that the previous qualification was taught in English.",
  hskRequirement: "HSK 4 score 180 or above for Chinese-taught undergraduate routes in the closed 2026 cycle.",
  englishRequirement: "IELTS 6.0, TOEFL 85, TOEFL Essentials 9, Duolingo 100, or prior English-medium proof for English-taught undergraduate routes in the closed 2026 cycle.",
  deadlineSummary: "The newest general international undergraduate guide closed on June 15, 2026 for September 2026 entry. No explicit 2027 international application window is published on the current notice index.",
  tuitionSummary: "Closed 2026 undergraduate tuition was CNY 22,000/year; on-campus accommodation CNY 4,000/year; insurance CNY 800/year; application fee CNY 400.",
  applicationFee: "CNY 400 in the closed 2026 undergraduate guide",
  websiteUrl: "https://www.hfut.edu.cn/",
  admissionsUrl: sources.get("hfut-international-notice-index-current")!.finalUrl ?? sources.get("hfut-international-notice-index-current")!.url,
  cscaRequired: true,
  cscaRequirement: "All undergraduate applicants in the closed 2026 cycle had to submit CSCA results; exact subject combinations are specified by major in the locked official workbook and are not carried into 2027.",
  subjectTags: ["Engineering", "Computer Science", "Management", "Economics", "Architecture"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 22,000/year undergraduate tuition in the closed 2026 guide",
  campusHighlights: [
    "Ministry of Education-administered national key university",
    "Double First-Class university",
    "Undergraduate scholarships in the closed 2026 guide covered up to tuition and on-campus accommodation",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: primary.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official international undergraduate guide identity",
    nameZh: "official international undergraduate guide title and profile",
    citySlug: "official guide address plus reviewed Hefei dependency",
    schoolType: "official institutional profile",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official 2026 guide plus current notice-index review",
    languageOfInstruction: "official 2026 guide and program workbook",
    languageRequirement: "official 2026 application conditions",
    hskRequirement: "official 2026 application conditions",
    englishRequirement: "official 2026 application conditions",
    deadlineSummary: "official 2026 application dates plus current notice-index review",
    tuitionSummary: "official 2026 fee schedule",
    applicationFee: "official 2026 fee schedule",
    websiteUrl: "official university domain",
    admissionsUrl: "current official international notice index",
    cscaRequired: "official 2026 application conditions and materials",
    cscaRequirement: "official 2026 application conditions and locked program workbook",
    subjectTags: "official institutional profile and program workbook",
    languageTags: "official 2026 guide and program workbook",
    tuitionBandLabel: "official 2026 fee schedule",
    campusHighlights: "official institutional profile and scholarship section",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: primary.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([id]) => {
  const source = sources.get(id)!;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: primary.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 80, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The current official international notice index exposes the 2026 undergraduate guide as its newest general inbound guide; no explicit 2027 international guide or application window is published.",
    "The locked workbook contains closed 2026 major and CSCA mappings. They are retained as evidence and are not converted into current or 2027 program rows.",
    "Closed 2026 scholarship coverage is summarized only at school level; no scholarship is represented as open for 2027.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published staff contacts, bank account information and financial-guarantee details are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-136");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 136, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
