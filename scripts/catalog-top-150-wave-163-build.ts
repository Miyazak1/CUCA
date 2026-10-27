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
const run = "2026-10-26T09-47-22-983Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["hznu-international-home-current", "150d5571d140ff1b32266cace5f07606bc02368f6f5e844b19ece900de86aba1"],
  ["hznu-international-admissions-index-current", "7ca8223cedb05f82b96575c15aeb980f53107bb6e7d5bebfde5813d7ef409151"],
  ["hznu-international-bachelor-2026", "ad3e1942fd2e4ccfc5b9b65b2ecdb3064a4cb9a4b69792725623025454a2ebb2"],
  ["hznu-international-graduate-2026", "c172ca2303485133ad49acf28fe18037dc2ded5f5fafd639fcd6e37878cebaed"],
  ["hznu-international-language-2026", "4b1d24be515608f4b047a82f04e0364985eb18c3e2609eb7062db3778695b092"],
  ["hznu-international-fees-2026-pdf", "16b002ba862d058af05b2c9f5c966ac70170605ac521d77d42aec16bd141cdc5"],
  ["hznu-international-scholarship-current", "c01b8594611dc2cb45e18f040a13c2e2d454a633863a4fbe93592799a5f3c1ad"],
  ["hznu-cgs-university-program-2026", "e02777f67cfcdd73b0126a7a32efc5d596a0d550fa625a22abc55f773c357c14"],
  ["hznu-2027-recruitment-preparation-news", "3f2c6bff95ae98ad7dbcd72612bbcef26881500eb0f718b2fb95ce3f9ed6cced"],
]);

const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked HZNU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`HZNU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const admissions = sources.get("hznu-international-admissions-index-current")!;
const bachelor = sources.get("hznu-international-bachelor-2026")!;
const graduate = sources.get("hznu-international-graduate-2026")!;
const language = sources.get("hznu-international-language-2026")!;
const scholarshipPolicy = sources.get("hznu-international-scholarship-current")!;
const cgs = sources.get("hznu-cgs-university-program-2026")!;
const preparation2027 = sources.get("hznu-2027-recruitment-preparation-news")!;
const sourceFields = (source: Source) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "hangzhou");
if (!city) throw new Error("Reviewed Hangzhou dependency missing");

const school = {
  slug: "hangzhou-normal-university",
  nameEn: "Hangzhou Normal University",
  nameZh: "杭州师范大学",
  citySlug: "hangzhou",
  schoolType: "Public comprehensive normal university",
  region: "Hangzhou, Zhejiang, East China",
  applicationLevel: "The latest complete official cycle is 2026 and states 9 bachelor, 12 master and 3 doctoral programs, plus a long-term Chinese-language route. The university announced active preparation for 2027 international recruitment, but has not published a detailed 2027 guide or program table.",
  languageOfInstruction: "Chinese- and English-taught degree routes are described in the latest complete 2026 guides; the long-term language route is Chinese-language study.",
  languageRequirement: "Latest complete 2026 guides: Chinese-taught bachelor study requires HSK Level 4 score 210; Chinese-taught graduate study requires HSK Level 5 score 180. English-taught routes use interview assessment and may accept TOEFL, IELTS or other English evidence without a published numeric threshold.",
  hskRequirement: "Latest complete 2026 cycle: HSK Level 4 score 210 for bachelor study; HSK Level 5 score 180 for master and doctoral study.",
  englishRequirement: "Latest complete 2026 cycle: interview-based English assessment; TOEFL, IELTS or other English evidence may be submitted, with no numeric threshold published.",
  deadlineSummary: "No detailed 2027 application deadline is published. The latest complete 2026 bachelor and graduate guides accepted applications from March 9 through June 30, 2026; the 2026 long-term Chinese-language route accepted fall applications May 15-30, 2026.",
  tuitionSummary: "Latest published 2026 schedule: Chinese language CNY 7,500/semester or 15,000/year; bachelor CNY 18,000-25,000/year by discipline; master CNY 22,800-25,000/year; doctoral CNY 30,000/year for the available categories.",
  applicationFee: "CNY 400 in the latest complete 2026 guides",
  websiteUrl: "https://www.hznu.edu.cn/",
  admissionsUrl: admissions.finalUrl ?? admissions.url,
  subjectTags: ["Education", "Psychology", "Humanities", "Computer Science", "Business", "Arts"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Latest 2026 degree schedule: CNY 18,000-30,000/year",
  campusHighlights: ["Official 2027 international recruitment preparation is underway", "Latest complete official cycle offers bachelor, master, doctoral and Chinese-language study", "Three Hangzhou campuses are described in the current admissions material"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: preparation2027.fetchedAt,
  ...sourceFields(admissions),
  sourceFieldLineage: {
    nameEn: "official international admissions materials",
    nameZh: "official international admissions materials",
    citySlug: "official campus address plus reviewed Hangzhou dependency",
    schoolType: "official institutional description plus CUAC taxonomy",
    region: "official campus address plus CUAC taxonomy",
    applicationLevel: "official 2026 bachelor, graduate and language guides plus official 2027 preparation update",
    languageOfInstruction: "official 2026 bachelor, graduate and language guides",
    languageRequirement: "official 2026 bachelor and graduate guides",
    hskRequirement: "official 2026 bachelor and graduate guides",
    englishRequirement: "official 2026 bachelor and graduate guides",
    deadlineSummary: "official 2026 guides; detailed 2027 deadline intentionally unresolved",
    tuitionSummary: "official 2026 fee schedule page",
    applicationFee: "official 2026 guides",
    websiteUrl: "official university domain",
    admissionsUrl: "official international admissions index",
    subjectTags: "official published study scope plus CUAC taxonomy",
    languageTags: "official 2026 guides",
    tuitionBandLabel: "official 2026 fee schedule page",
    campusHighlights: "official admissions materials and 2027 recruitment preparation update",
  },
};

const scholarships = [
  {
    slug: "hangzhou-normal-university-international-student-scholarship-current",
    title: "Hangzhou Normal University International Student Scholarship",
    nameZh: "杭州师范大学国际学生奖学金",
    schoolSlug: school.slug,
    type: "university",
    typeLabel: "University scholarship",
    providerName: "杭州师范大学",
    providerNameEn: "Hangzhou Normal University",
    providerLocation: "Hangzhou, Zhejiang, China",
    applicableDegree: "Master, doctoral and bachelor study under the current policy page",
    requirementText: "Current policy: Type A supports international graduate students with tuition support plus CNY 1,500/month for master's students or CNY 2,000/month for doctoral students for 10 months; Type B supports bachelor students with CNY 20,000/year; Type C supports bachelor students with CNY 10,000/year. The page does not publish a 2027 application window.",
    actionLinks: [{ label: "Official scholarship policy", url: scholarshipPolicy.finalUrl ?? scholarshipPolicy.url, kind: "official-source" }],
    applicationRound: "Current policy page published March 4, 2026; no 2027 round dates published",
    tags: ["University scholarship", "Bachelor", "Master", "Doctoral", "Current policy"],
    summary: "Current official university scholarship policy; a separate 2027 application round has not yet been published.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: scholarshipPolicy.fetchedAt,
    ...sourceFields(scholarshipPolicy),
    sourceFieldLineage: {
      title: "official scholarship policy page",
      applicableDegree: "official award categories",
      requirementText: "official award categories and published amounts",
      applicationRound: "official page date; no 2027 date inferred",
      tags: "official award categories",
      summary: "official current policy with explicit cycle limitation",
    },
  },
  {
    slug: "hangzhou-normal-university-chinese-government-scholarship-university-program-2026",
    title: "Hangzhou Normal University Chinese Government Scholarship University Program — 2026",
    nameZh: "杭州师范大学2026年中国政府奖学金高校自主招生项目",
    schoolSlug: school.slug,
    type: "government",
    typeLabel: "Chinese Government Scholarship university program",
    providerName: "国家留学基金管理委员会 / 杭州师范大学",
    providerNameEn: "China Scholarship Council / Hangzhou Normal University",
    providerLocation: "Hangzhou, Zhejiang, China",
    applicableDegree: "Full-time master's study in the published 2026 round",
    requirementText: "The published 2026 round covers tuition, on-campus accommodation, living allowance under the applicable CSC standard and medical insurance. Applicants need a bachelor's degree, must generally be age 18-35, and Chinese-taught study requires HSK Level 5 score 180 or above. The deadline was April 30, 2026; this closed round is not relabeled as 2027.",
    actionLinks: [{ label: "Official 2026 scholarship guide", url: cgs.finalUrl ?? cgs.url, kind: "official-source" }],
    applicationRound: "2026 round, closed April 30, 2026",
    tags: ["2026", "Chinese Government Scholarship", "Master", "Closed round"],
    summary: "Official 2026 full master's scholarship round retained as historical/current-policy evidence; no 2027 round is inferred.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: cgs.fetchedAt,
    ...sourceFields(cgs),
    sourceFieldLineage: {
      title: "official 2026 scholarship guide",
      applicableDegree: "official 2026 scholarship guide",
      requirementText: "official 2026 eligibility, language, coverage and deadline sections",
      applicationRound: "official 2026 deadline",
      tags: "official scholarship type, degree and cycle",
      summary: "official 2026 round with no cycle carry-forward",
    },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: preparation2027.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships,
};
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => {
  const source = sources.get(id)!;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: preparation2027.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 116, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The university officially states that 2027 international recruitment preparation is underway, but no detailed 2027 guide, program table, tuition schedule, application deadline or intake is published. No 2026 field is relabeled as 2027.",
    "The official 2026 program-list page exposes attachment labels without a deterministic public file link in the captured HTML. The page-level counts of 9 bachelor, 12 master and 3 doctoral routes are retained, but no route row is inferred.",
    "The current university scholarship policy and closed 2026 Chinese Government Scholarship round are structured as scholarship evidence; no 2027 award window is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant forms, personal contacts, payment instructions and bank details are excluded. No applicant data is present." },
  latestCompleteBachelorGuideUrl: bachelor.finalUrl ?? bachelor.url,
  latestCompleteGraduateGuideUrl: graduate.finalUrl ?? graduate.url,
  latestCompleteLanguageGuideUrl: language.finalUrl ?? language.url,
  preparation2027Url: preparation2027.finalUrl ?? preparation2027.url,
};

const stem = resolve(root, "seeds/catalog.2027-wave-163");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 163, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
