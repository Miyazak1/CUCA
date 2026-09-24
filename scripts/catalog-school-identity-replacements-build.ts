import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedSchool,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPaths = [
  "work/catalog-official/ahu-scholarship-batch-01/manifest.json",
  "work/catalog-official/ccnu-dge-admission-batch-01/manifest.json",
  "work/catalog-official/dut-complete-batch-01/manifest.json",
  "work/catalog-official/nanning-city-batch-01-school/manifest.json",
  "work/catalog-official/2026-09-22T09-54-33-525Z/manifest.json",
  "work/catalog-official/xjtu-check-xjtu-scholarship-overview/manifest.json",
  "work/catalog-official/qinhuangdao-city-batch-01-school/manifest.json",
  "work/catalog-official/kunming-city-batch-01-school/manifest.json",
].map((path) => resolve(root, path));
const manifestTexts = await Promise.all(manifestPaths.map((path) => readFile(path, "utf8")));
const cityBundlePaths = ["hefei", "wuhan", "dalian", "nanning", "guiyang", "xian", "qinhuangdao", "kunming"]
  .map((slug) => resolve(root, `seeds/catalog.${slug}-city-rich-batch-01.draft.json`));
const cityBundles = await Promise.all(cityBundlePaths.map(async (path) => JSON.parse(await readFile(path, "utf8"))));
type SourceRecord = { id: string; status: number; url: string; finalUrl?: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>(manifestTexts
  .flatMap((text) => (JSON.parse(text).sources as SourceRecord[]))
  .map((row) => [row.id, row]));
const expected = {
  "ahu-cgs-university-program-2026": "e117a177d6140cee5df5e24dd21ee511cff583758ff67ea83affc76362724269",
  "ccnu-dge-international-admission-guide-en-page-2026": "4c74cafe657fc6fcce9a84a89417946ce968afa7691acf91e7ff2ba565ceee92",
  "dut-undergraduate-english-admissions-2026": "5a4b504bf036a111c7df49228b0da3e30d18e824f080620f424542146924dab8",
  "nanning-gxmu-undergraduate-admission-2026": "8fe09f32b70210fee64ab4f0c9bc982803914adcbd00a31a42ed4136e3b9c138",
  "guiyang-gmcu-undergraduate-admission-2026": "7f75ab0de84fc5286db1c48ef69766a5529f21e4dfba0ac8bf9daad25a623422",
  "xjtu-scholarship-overview": "95c3f63c4120fc899a82cbf29fb59c64ab24144df7010a7dbe72ee43cb3f74e0",
  "qinhuangdao-ysu-international-admission-guide-2026": "31a32974b3a76ec61d3314104319ec6d4b5ea9da49df220a571b1aaaa505449d",
  "kunming-ynufe-study-guide-current": "74ae89ffd4ed185ac23256acfd86f377417911bf513bacd030a8583509ad304b",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`School identity evidence mismatch: ${id}`);
}

type SchoolSpec = {
  slug: string;
  nameEn: string;
  nameZh: string;
  citySlug?: string;
  region: string;
  sourceId: keyof typeof expected;
  applicationLevel?: string;
  applicationLevelLineage?: string;
  admissionsUrl?: string;
  languageOfInstruction?: string;
  englishRequirement?: string;
  deadlineSummary?: string;
  tuitionSummary?: string;
  applicationFee?: string;
  cscaRequired?: boolean;
  cscaRequirement?: string;
};
const specs: SchoolSpec[] = [
  { slug: "anhui-university", nameEn: "Anhui University", nameZh: "安徽大学", citySlug: "hefei", region: "Hefei, Anhui, East China", sourceId: "ahu-cgs-university-program-2026", applicationLevel: "Undergraduate and Master", admissionsUrl: "https://sie.ahu.edu.cn/" },
  { slug: "central-china-normal-university", nameEn: "Central China Normal University", nameZh: "华中师范大学", citySlug: "wuhan", region: "Wuhan, Hubei, Central China", sourceId: "ccnu-dge-international-admission-guide-en-page-2026", admissionsUrl: "https://admission.ccnu.edu.cn/" },
  {
    slug: "dalian-university-of-technology", nameEn: "Dalian University of Technology", nameZh: "大连理工大学",
    citySlug: "dalian", region: "Dalian, Liaoning, Northeast China", sourceId: "dut-undergraduate-english-admissions-2026",
    applicationLevel: "Undergraduate", admissionsUrl: "https://sie.dlut.edu.cn/", languageOfInstruction: "English",
    englishRequirement: "TOEFL 80, IELTS 5.5 or Duolingo 100 in principle; published high-school-medium and official-language exemptions apply, otherwise the tutor and department may assess the applicant.",
    deadlineSummary: "Applications are accepted from November 1, 2025 through June 2026; the reviewed guide does not publish an exact June closing day.",
    tuitionSummary: "English-taught undergraduate tuition: CNY 25,500/year; reviewed accommodation ranges from CNY 600 to 1,800/month for stays of at least one month.",
    applicationFee: "CNY 800", cscaRequired: true,
    cscaRequirement: "A valid CSCA result is an essential application material from the 2026/2027 academic year; route-specific subjects remain unresolved because the protected attachment is unavailable.",
  },
  { slug: "guangxi-medical-university", nameEn: "Guangxi Medical University", nameZh: "广西医科大学", citySlug: "nanning", region: "Nanning, Guangxi, South China", sourceId: "nanning-gxmu-undergraduate-admission-2026", applicationLevel: "Undergraduate", admissionsUrl: "https://gjy.gxmu.edu.cn/" },
  { slug: "guizhou-medical-university", nameEn: "Guizhou Medical University", nameZh: "贵州医科大学", citySlug: "guiyang", region: "Guiyang, Guizhou, Southwest China", sourceId: "guiyang-gmcu-undergraduate-admission-2026", applicationLevel: "Undergraduate", admissionsUrl: "https://soe.gmc.edu.cn/" },
  { slug: "xi-an-jiaotong-university", nameEn: "Xi'an Jiaotong University", nameZh: "西安交通大学", citySlug: "xian", region: "Xi'an, Shaanxi, Northwest China", sourceId: "xjtu-scholarship-overview", applicationLevel: "Undergraduate and Graduate", applicationLevelLineage: "official admissions navigation exposes Undergraduate and Graduate channels", admissionsUrl: "https://sie.xjtu.edu.cn/" },
  { slug: "yanshan-university", nameEn: "Yanshan University", nameZh: "燕山大学", citySlug: "qinhuangdao", region: "Qinhuangdao, Hebei, North China", sourceId: "qinhuangdao-ysu-international-admission-guide-2026", applicationLevel: "Undergraduate, Master, Doctoral and Non-degree", applicationLevelLineage: "official admissions navigation explicitly lists bachelor, master, doctoral and non-degree programs", admissionsUrl: "https://ies.ysu.edu.cn/" },
  { slug: "yunnan-university-of-finance-and-economics", nameEn: "Yunnan University of Finance and Economics", nameZh: "云南财经大学", citySlug: "kunming", region: "Kunming, Yunnan, Southwest China", sourceId: "kunming-ynufe-study-guide-current", applicationLevel: "Bachelor, Master and Doctoral", applicationLevelLineage: "official institutional profile explicitly states bachelor, master and doctoral degree-awarding authority", admissionsUrl: "https://www.ynufe.edu.cn/en/Study_in_YUFE.htm" },
];

const schools: CatalogSeedSchool[] = specs.map((spec) => {
  const source = sources.get(spec.sourceId)!;
  return {
    slug: spec.slug,
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    citySlug: spec.citySlug,
    schoolType: "Public",
    region: spec.region,
    applicationLevel: spec.applicationLevel,
    languageOfInstruction: spec.languageOfInstruction,
    englishRequirement: spec.englishRequirement,
    deadlineSummary: spec.deadlineSummary,
    tuitionSummary: spec.tuitionSummary,
    applicationFee: spec.applicationFee,
    cscaRequired: spec.cscaRequired,
    cscaRequirement: spec.cscaRequirement,
    websiteUrl: new URL(source.finalUrl ?? source.url).origin,
    admissionsUrl: spec.admissionsUrl ?? source.finalUrl ?? source.url,
    status: "draft",
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${spec.sourceId}: official page or document identity`,
      nameZh: `${spec.sourceId}: official page or document identity`,
      ...(spec.citySlug ? { citySlug: `${spec.sourceId}: official institution or contact location` } : {}),
      schoolType: "public-university status shown by the official institution context; requires editorial review",
      region: "CUAC geographic taxonomy derived from the official city; requires editorial review",
      ...(spec.applicationLevel ? { applicationLevel: `${spec.sourceId}: ${spec.applicationLevelLineage ?? "reviewed admission/program scope only"}` } : {}),
      ...(spec.languageOfInstruction ? { languageOfInstruction: `${spec.sourceId}: English-taught bachelor program scope` } : {}),
      ...(spec.englishRequirement ? { englishRequirement: `${spec.sourceId}: required documents, language certificate` } : {}),
      ...(spec.deadlineSummary ? { deadlineSummary: `${spec.sourceId}: application time; month-only closing date retained without invention` } : {}),
      ...(spec.tuitionSummary ? { tuitionSummary: `${spec.sourceId}: fees and accommodation tables` } : {}),
      ...(spec.applicationFee ? { applicationFee: `${spec.sourceId}: fees table` } : {}),
      ...(spec.cscaRequirement ? { cscaRequirement: `${spec.sourceId}: admission qualifications and required documents` } : {}),
      websiteUrl: `${spec.sourceId}: exact official university-domain origin`,
      admissionsUrl: `${spec.sourceId}: official international-school or admission channel`,
    },
  };
});

const bundle: CatalogSeedBundle = {
  version: 1,
  generatedAt: new Date(Math.max(...schools.map((school) => Date.parse(school.capturedAt)))).toISOString(),
  cities: cityBundles.map((bundle) => bundle.cities[0]),
  schools,
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const body = `${JSON.stringify(bundle, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(body));
if (!validation.ok || validation.summary.schools !== 8) throw new Error(`School identity batch invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(body),
  sourceManifestSha256: manifestTexts.map((text, index) => ({ path: manifestPaths[index], sha256: sha(text) })),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "This batch replaces only eight exact prohibited-source school identities; it does not approve any program, intake or scholarship record.",
      "Only identity, official city, public-university context and exact official admissions entry points are retained.",
      "No legacy aggregator profile text, ranking, tuition, language rule or deadline is copied.",
      "Application-level labels are populated only where the selected official evidence directly establishes the reviewed scope.",
      "All eight school records remain draft and require independent review before any database write or publication.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json"), body, "utf8"),
  writeFile(resolve(root, "seeds/catalog.school-identity-replacements-batch-01.validation.json"), `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
