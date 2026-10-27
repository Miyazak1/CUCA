import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T07-34-48-606Z";
const locks = [
  ["jsu-international-home-current", "7f3723b6f7e43df2d47a6263d63958f0e88c930cf3c4bcce9a612e815ef8bcf2"],
  ["jsu-international-eligibility-current", "2a347219bc2462196aa8f147f69199ae0e3ce20e37fb31f13a880956737f4d24"],
  ["jsu-international-application-procedure-current", "949a8cafc2c0b4c1c3ec1ae3f31493c13bc9acb98b48b9d9111b757c823aba9b"],
  ["jsu-international-dates-current", "2691da0c4742ff83cc5f765cf0b1dd01f49db7d8cab4647b7666f0749ca8a0d5"],
  ["jsu-international-estimated-costs-current", "5d37d0c6ac6d110c3ab65bf6fe8f9c4fd9134781237c58e0eb2aeb06eac967d9"],
  ["jsu-international-admission-brochure-pdf-2026", "23bb116aac6a8b78fad8098d42a013167354691537c98156daa0ed95bbaf4da2"],
] as const;
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha256);
  if (!source) throw new Error(`Missing locked source ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha256) throw new Error(`Hash mismatch ${id}`);
  sources.set(id, source);
}
const primary = sources.get("jsu-international-dates-current")!;
const sourceFields = { sourceUrl: primary.finalUrl ?? primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt };
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((item) => item.slug === "zhenjiang");
if (!city) throw new Error("Zhenjiang dependency missing");

const school = {
  slug: "jiangsu-university",
  nameEn: "Jiangsu University",
  nameZh: "江苏大学",
  citySlug: "zhenjiang",
  schoolType: "Comprehensive research university with international bachelor, master, doctoral, non-degree and preparatory education",
  region: "Zhenjiang, Jiangsu, East China",
  applicationLevel: "Bachelor, Master, Doctoral, senior researcher, non-degree culture and practice, and CSCA preparatory programs",
  languageOfInstruction: "Chinese and English routes are published in the current official admissions site.",
  languageRequirement: "Current English-taught routes require IELTS above 6.0, TOEFL above 80 or Duolingo above 100. Chinese-taught routes require the HSK level specified by the program; the Spring culture-and-practice semester requires HSK 3 or above.",
  hskRequirement: "Program-specific for Chinese-taught degree routes; HSK 3 or above for the Spring one-semester Culture and Practice route.",
  englishRequirement: "IELTS above 6.0, TOEFL above 80 or Duolingo above 100 for English-taught routes.",
  deadlineSummary: "2027 Spring intake closes December 25, 2026 with registration March 3-5, 2027. September 2027 intake opens April 1, closes June 25 and registers September 6-10, 2027.",
  tuitionSummary: "Current annual tuition: English bachelor CNY 18,000-34,000; Chinese bachelor CNY 16,000-34,000; master CNY 20,000-38,000; doctoral CNY 24,000-42,000; MBA CNY 30,000/year. Double-room accommodation is CNY 4,900/year, application fee CNY 200, registration fee CNY 400 and degree-program insurance CNY 600/year.",
  applicationFee: "CNY 200",
  websiteUrl: "https://www.ujs.edu.cn/",
  admissionsUrl: primary.finalUrl ?? primary.url,
  cscaRequired: true,
  cscaRequirement: "All undergraduate applicants must submit the CSCA transcript; the current eligibility page sets January 6, 2027 as the latest submission date.",
  subjectTags: ["Engineering", "Medicine", "Business", "Science", "Agriculture"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 16,000-42,000/year across current degree categories",
  campusHighlights: [
    "Current official profile lists 78 Chinese-taught and 23 English-taught undergraduate programs",
    "Current official profile lists 42 master's and 15 doctoral international programs",
    "2027 Spring and September intake calendar is explicitly published",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: primary.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official Overseas Education College identity",
    nameZh: "official university identity",
    citySlug: "official admissions address plus reviewed Zhenjiang dependency",
    schoolType: "current official Overseas Education College profile",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "current official program navigation and eligibility page",
    languageOfInstruction: "current official program and cost pages",
    languageRequirement: "current official eligibility page",
    hskRequirement: "current official eligibility page",
    englishRequirement: "current official eligibility page",
    deadlineSummary: "current official dates and deadlines page",
    tuitionSummary: "current official estimated-costs page",
    applicationFee: "current official application-procedure and estimated-costs pages",
    websiteUrl: "official university domain",
    admissionsUrl: "current official 2027 dates page",
    cscaRequired: "current official eligibility and application-procedure pages",
    cscaRequirement: "current official eligibility page",
    subjectTags: "current official program and cost pages",
    languageTags: "current official eligibility and cost pages",
    tuitionBandLabel: "current official estimated-costs page",
    campusHighlights: "current official institutional profile and dates page",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: primary.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([id]) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: primary.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 81, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The current official dates page explicitly publishes 2027 Spring and September intake timing, but it does not map each route to an intake; no generic or inferred program-intake rows are created.",
    "The official 2026 brochure is retained as historical context. Its closed route rows are not relabeled as 2027.",
    "Current scholarship categories are visible in navigation, but award-specific 2027 coverage and application rules were not captured in this wave; no scholarship record is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published staff contacts, bank accounts and applicant financial-proof details are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-137");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 137, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
