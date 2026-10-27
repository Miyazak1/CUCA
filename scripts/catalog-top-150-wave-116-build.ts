import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };
const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-45-09-884Z", id: "zzu-international-education-home-current", sha256: "83988dda0f16551dcf0f050822d7830dc663ebe9372653e747481fb796e20a9f" },
  { run: "2026-10-26T05-45-12-689Z", id: "zzu-international-education-profile-current", sha256: "f7613f9c1165a32edd81deb269cc41a694a1454cb4885d8d7e4152e2943750e7" },
  { run: "2026-10-26T05-45-15-978Z", id: "zzu-international-english-undergraduate-guide-2025", sha256: "05e04f6df3ff854b9eccc1a21be2d612dfb479b3496b462e873b79025433a089" },
  { run: "2026-10-26T05-45-18-768Z", id: "zzu-international-undergraduate-guide-current-page", sha256: "ddee842febabc4dc30e0747258fd6c43bacc2c2a85827fb59c42660d7b35d8a9" },
];
const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}

const profileSource = sources.get("zzu-international-education-profile-current")!;
const programSource = sources.get("zzu-international-english-undergraduate-guide-2025")!;
const genericGuideSource = sources.get("zzu-international-undergraduate-guide-current-page")!;
const schoolSourceFields = { sourceUrl: profileSource.finalUrl ?? profileSource.url, sourceLabel: profileSource.label, sourceSha256: profileSource.sha256, capturedAt: profileSource.fetchedAt };
const programSourceFields = { sourceUrl: programSource.finalUrl ?? programSource.url, sourceLabel: programSource.label, sourceSha256: programSource.sha256, capturedAt: programSource.fetchedAt };
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "zhengzhou-university";
const citySlug = "zhengzhou";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Zhengzhou University already exists in the reviewed base.");
if (dependency.cities?.some((row) => row.slug === citySlug)) throw new Error("Zhengzhou city already exists in the reviewed base; remove the new city record.");

const city = {
  slug: citySlug,
  nameEn: "Zhengzhou",
  nameZh: "郑州",
  province: "Henan",
  region: "Central China",
  tags: ["Henan", "provincial-capital", "Central China"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: profileSource.fetchedAt,
  ...schoolSourceFields,
  sourceFieldLineage: { nameEn: "official college address; standardized English city name", nameZh: "official college address", province: "official college address", region: "CUAC geographic taxonomy derived from verified provincial location", tags: "CUAC geographic classification" },
};

const school = {
  slug: schoolSlug,
  nameEn: "Zhengzhou University",
  nameZh: "郑州大学",
  citySlug,
  schoolType: "Public comprehensive university",
  region: "Zhengzhou, Henan, Central China",
  applicationLevel: "The current official international-education profile confirms Bachelor, Master, Doctoral, Foundation, Chinese-language and visiting education; current 2027 application catalogs are not published",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "The archived 2025 undergraduate guides state HSK 4 (180) for Chinese-taught undergraduate study and IELTS 6.0 or TOEFL 83 for English-taught study. Current 2027 thresholds remain unverified.",
  hskRequirement: "Archived 2025 undergraduate guide: HSK 4 with at least 180 for Chinese-taught programs.",
  englishRequirement: "Archived 2025 English-taught undergraduate guide: applicant from an English-speaking country or IELTS 6.0, TOEFL 83, or equivalent.",
  deadlineSummary: "No 2027 international-student application deadline was found. The captured 2025 undergraduate guides are retained only as closed historical evidence.",
  tuitionSummary: "The captured 2025 English-taught undergraduate guide lists annual tuition from CNY 23,000 to 35,000 by program; current 2027 tuition is unknown.",
  websiteUrl: "https://www.zzu.edu.cn/",
  admissionsUrl: "https://www5.zzu.edu.cn/sie/",
  subjectTags: ["Medicine", "Stomatology", "Pharmacy", "Civil Engineering", "Software Engineering", "International Trade", "Tourism Management"],
  languageTags: ["Chinese", "English", "HSK", "IELTS 6.0", "TOEFL 83"],
  campusHighlights: ["Current official international-education profile captured", "Seven English-taught undergraduate routes retained as 2025 evidence", "No old-cycle fact relabeled as 2027"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: profileSource.fetchedAt,
  ...schoolSourceFields,
  sourceFieldLineage: {
    nameEn: "official international-education profile", nameZh: "official international-education profile", citySlug: "official college address", schoolType: "official profile plus CUAC classification", region: "official college address plus CUAC taxonomy", applicationLevel: "current official profile with explicit current-cycle limitation", languageOfInstruction: "official profile and archived undergraduate guides", languageRequirement: "archived 2025 undergraduate guides with explicit freshness limitation", hskRequirement: "archived 2025 undergraduate guide", englishRequirement: "archived 2025 English-taught undergraduate guide", deadlineSummary: "registered official-source discovery with explicit 2027 gap", tuitionSummary: "archived 2025 English-taught undergraduate guide with current-cycle limitation", admissionsUrl: "current official international-education homepage",
  },
};

const routeSpecs = [
  { key: "clinical-medicine", nameEn: "Clinical Medicine", nameZh: "临床医学", years: 6, category: "Medicine and Health", tuition: 35000 },
  { key: "stomatology", nameEn: "Stomatology", nameZh: "口腔医学", years: 6, category: "Medicine and Health", tuition: 35000 },
  { key: "pharmacy", nameEn: "Pharmacy", nameZh: "药学", years: 4, category: "Medicine and Health", tuition: 25000 },
  { key: "civil-engineering", nameEn: "Civil Engineering", nameZh: "土木工程", years: 4, category: "Engineering", tuition: 25000 },
  { key: "software-engineering", nameEn: "Software Engineering", nameZh: "软件工程", years: 4, category: "Engineering and Computing", tuition: 25000 },
  { key: "international-trade", nameEn: "International Trade", nameZh: "国际贸易", years: 4, category: "Business and Economics", tuition: 23000 },
  { key: "tourism-management", nameEn: "Tourism Management", nameZh: "旅游管理", years: 4, category: "Business and Management", tuition: 23000 },
] as const;
const applicationNote = "Closed 2025 route. The guide required a non-Chinese citizen aged 18-24, high-school graduation or equivalent, good health, no criminal record, English-speaking-country origin or IELTS 6.0/TOEFL 83/equivalent, and at least 70% in specified science subjects. Current 2027 rules are unverified.";
const programs = routeSpecs.map((spec) => ({
  slug: `${schoolSlug}-${spec.key}-english-2025`, schoolSlug, citySlug, nameEn: spec.nameEn, nameZh: spec.nameZh, degreeLevel: "Bachelor", durationYears: spec.years, fieldCategory: spec.category, subjectArea: spec.nameEn, teachingLanguage: "English", englishRequirement: "2025 guide: English-speaking-country origin or IELTS 6.0, TOEFL 83, or equivalent.", tuitionAmount: spec.tuition, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/year in the 2025 guide; current tuition is not established.`, scholarshipText: "The 2025 guide says strong applicants could apply for the Henan Government Scholarship, but current award coverage and application rules are not established.", applicationUrl: "https://zzu.17gz.org/member/login.do", applicationNote, hasScholarship: true, badgeText: "2025 official route", displayTuition: `CNY ${spec.tuition.toLocaleString("en-US")}/year (2025)`, displaySubjects: [spec.nameEn], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: programSource.fetchedAt, ...programSourceFields,
  sourceFieldLineage: { nameEn: "official 2025 English-taught undergraduate guide", nameZh: "official guide program name", degreeLevel: "official guide title", durationYears: "official guide duration section", fieldCategory: "CUAC taxonomy from official program identity", subjectArea: "official program identity", teachingLanguage: "official guide title", englishRequirement: "official 2025 eligibility section", tuitionAmount: "official 2025 fee section", tuitionPeriod: "official 2025 fee section", tuitionText: "official 2025 amount plus freshness limitation", scholarshipText: "official 2025 guide scholarship note with current-detail limitation", applicationUrl: "official guide application link", applicationNote: "official 2025 eligibility section plus closed-cycle label", hasScholarship: "official 2025 guide scholarship note", badgeText: "official guide cycle" },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall 2025",
  intakeYear: 2025,
  deadlineDate: "2025-06-30T15:59:59.000Z",
  deadlineLabel: "The 2025 English-taught undergraduate guide accepted applications from January through June; this intake is closed.",
  applicationRound: "Fall 2025 English-taught undergraduate route",
  status: "closed" as const,
  ...programSourceFields,
  sourceFieldLineage: { intakeTerm: "official guide September-start statement normalized to Fall", intakeYear: "official guide title", deadlineDate: "official January-June window normalized to Beijing end-of-day on June 30", deadlineLabel: "official application-time section plus closed-cycle label", applicationRound: "official guide cycle and route type" },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: profileSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 116 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => { const source = sources.get(locked.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: profileSource.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 44, schoolSlugs: [schoolSlug], newSchools: 1, newCities: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence,
  unresolved: [
    "No official 2027 inbound international-student guide or program catalog was found. Newly indexed 2027 Zhengzhou University pages concern domestic graduate admissions rather than inbound international applicants and are excluded.",
    "The registered international.zzu.edu.cn host timed out during collection. The current official School of International Education pages on www5.zzu.edu.cn were captured instead.",
    "The seven structured routes and their closed intake records come only from the official 2025 English-taught undergraduate guide. No value is relabeled as 2027, and current application dates, tuition, eligibility, program availability and scholarship terms remain unresolved.",
    "The generic undergraduate page confirms Chinese and English language thresholds but does not enumerate its linked major catalog in the captured body. Master, doctoral, foundation, Chinese-language and visiting education are confirmed only at category level by the current profile, so no unsupported route is inferred.",
    "The 2025 guide mentions Henan Government Scholarship eligibility without current coverage or application rules; no scholarship record is created.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Institutional telephone numbers, email addresses and office locations printed on the pages were not imported. Only institutional admissions facts are included." },
  crossSourceNote: `The current profile and homepage establish institutional scope and freshness; the archived 2025 guide supplies only explicitly historical program facts. The generic guide snapshot ${genericGuideSource.sha256} supports application-language context without promoting a current intake.`,
};
const stem = resolve(root, "seeds/catalog.2027-wave-116");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 116, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
