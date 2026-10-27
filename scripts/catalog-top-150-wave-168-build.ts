import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral";
type ProgramSpec = { name: string; degree: Degree; durationYears: number; tuition?: number; sourceId: string; hsk?: string; csca?: string[]; note: string };

const root = process.cwd();
const run = "2026-10-26T10-21-13-749Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["shnu-international-college-home-current", "7231c4c4fb9e0f13e0fa47238e90c1dc006d38e1ed6c203e5c5491a61baa0a64"],
  ["shnu-international-admission-index-current", "afc5fa3f3817996de63c7b357a4b0005d9dfccb1abc90d58c1b5d4f18939703a"],
  ["shnu-international-bachelor-program-current", "319cc3aabcc07f26cdfe1ecd0ab02abbfa402a2e05b4036d708e44db58737585"],
  ["shnu-international-master-program-current", "3cae59b7b87276b52273bad739746013deae2d1a8cc7e24aedcbd2a944faa47c"],
  ["shnu-international-doctoral-program-current", "3c5b788593b49f9eac7cbb1d5a388cdecf0691b04ac6f4561b7a2bfe2b36fff8"],
  ["shnu-international-scholarships-current", "703c941d82a9ff6f6ca7e77e8424c26fb0db3f383c1745e05976b06e74ef901e"],
  ["shnu-international-academic-schedule-current", "3e71c3190b53159c671c010eb29456c17a1a04f27ed63fe92c21eeb841efe4e6"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked SHNU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`SHNU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const home = sources.get("shnu-international-college-home-current")!;
const admissionIndex = sources.get("shnu-international-admission-index-current")!;
const bachelorPage = sources.get("shnu-international-bachelor-program-current")!;
const masterPage = sources.get("shnu-international-master-program-current")!;
const doctoralPage = sources.get("shnu-international-doctoral-program-current")!;
const scholarshipPage = sources.get("shnu-international-scholarships-current")!;
const schedule = sources.get("shnu-international-academic-schedule-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "shanghai");
if (!city) throw new Error("Reviewed Shanghai dependency missing");

const school = {
  slug: "shanghai-normal-university",
  nameEn: "Shanghai Normal University",
  nameZh: "上海师范大学",
  citySlug: "shanghai",
  schoolType: "Public comprehensive normal university",
  region: "Shanghai, East China",
  applicationLevel: "Current official International College of Chinese Studies pages publish two bachelor, two master and one doctoral international route. The academic-schedule index lists Spring and Autumn 2027 calendars, but no applicant-facing 2027 admission guide or cycle-specific deadline is published.",
  languageOfInstruction: "Chinese for the five current international degree routes captured from the International College of Chinese Studies.",
  languageRequirement: "Current pages: master routes require HSK 5 score 180. The doctoral page conflicts internally between HSK 6 score 180 in admission requirements and HSK 5 score 180 in its materials list, so no doctoral HSK threshold is selected. Bachelor requirements vary by entry grade.",
  deadlineSummary: "No cycle-specific 2027 admission deadline is published. Current generic pages state end of July/end of January for bachelor autumn/spring entry and middle of May for master and doctoral applications.",
  tuitionSummary: "Current pages state master tuition CNY 23,000/year and doctoral tuition CNY 28,000/year. The current bachelor page states CNY 19,800/year, while an official 2026 fall guide indexed by the university states CNY 18,000 for years 1-2 and CNY 19,800 for years 3-4; bachelor numeric tuition remains unresolved pending a capturable current guide.",
  applicationFee: "CNY 520 on current degree-program pages",
  websiteUrl: home.finalUrl ?? home.url,
  admissionsUrl: admissionIndex.finalUrl ?? admissionIndex.url,
  subjectTags: ["Chinese Language", "International Chinese Language Education", "Linguistics", "Applied Linguistics", "Teacher Education"],
  languageTags: ["Chinese"],
  tuitionBandLabel: "Current confirmed graduate tuition: CNY 23,000-28,000/year",
  campusHighlights: ["Shanghai public comprehensive university with teacher-training strengths", "International College of Chinese Studies degree and language-program center", "Current official pages publish bachelor, master and doctoral Chinese-language routes"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: schedule.fetchedAt,
  ...sourceFields(admissionIndex),
  sourceFieldLineage: {
    nameEn: "official International College of Chinese Studies pages",
    nameZh: "official university identity",
    citySlug: "official address plus reviewed Shanghai dependency",
    schoolType: "official profile plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "current degree-program pages and 2027 academic-schedule freshness check",
    languageOfInstruction: "current degree-program pages",
    languageRequirement: "current program requirements with preserved doctoral conflict",
    deadlineSummary: "current generic program deadlines without inferred 2027 cycle",
    tuitionSummary: "current program pages plus unresolved indexed-guide conflict",
    applicationFee: "current degree-program pages",
    websiteUrl: "official college domain",
    admissionsUrl: "official admissions index",
    subjectTags: "current named program pages",
    languageTags: "current program requirements",
    tuitionBandLabel: "current confirmed graduate program pages",
    campusHighlights: "official profile and current degree-program pages",
  },
};

const specs: ProgramSpec[] = [
  { name: "Chinese Language", degree: "Bachelor", durationYears: 4, sourceId: bachelorPage.id, csca: ["Humanities Chinese", "Mathematics"], note: "Current bachelor page; HSK Level 4 may exempt the CSCA Chinese subject, but no single HSK admission threshold applies across entry grades." },
  { name: "Teaching Chinese to Speakers of Other Languages", degree: "Bachelor", durationYears: 4, sourceId: bachelorPage.id, csca: ["Humanities Chinese", "Mathematics"], note: "Current bachelor page; grade-specific HSK evidence and entrance examination apply." },
  { name: "Linguistics and Applied Linguistics", degree: "Master", durationYears: 3, tuition: 23000, sourceId: masterPage.id, hsk: "HSK Level 5 score 180", note: "Current master page; generic application deadline is the middle of May without a cycle year." },
  { name: "Master of International Chinese Language Education", degree: "Master", durationYears: 2, tuition: 23000, sourceId: masterPage.id, hsk: "HSK Level 5 score 180", note: "Current master page; generic application deadline is the middle of May without a cycle year." },
  { name: "Linguistics and Applied Linguistics", degree: "Doctoral", durationYears: 3, tuition: 28000, sourceId: doctoralPage.id, note: "Current doctoral page; admission requirements state HSK 6 score 180 while the materials list states HSK 5 score 180. No threshold is selected until editorial resolution." },
];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = specs.map((spec) => {
  const source = sources.get(spec.sourceId)!;
  return {
    slug: `shanghai-normal-university-${slugify(spec.name)}-${spec.degree.toLowerCase()}-current`,
    schoolSlug: school.slug,
    citySlug: "shanghai",
    nameEn: spec.name,
    degreeLevel: spec.degree,
    durationYears: spec.durationYears,
    fieldCategory: spec.degree === "Bachelor" ? "Language and Teacher Education" : "Linguistics and Language Education",
    subjectArea: spec.name,
    teachingLanguage: "Chinese",
    ...(spec.hsk ? { hskRequirement: spec.hsk } : {}),
    ...(spec.csca ? { cscaSubjects: spec.csca, cscaRequirement: spec.name === "Chinese Language" ? "Humanities Chinese and Mathematics; a valid HSK Level 4 report exempts the CSCA Chinese subject on the current page." : "Humanities Chinese and Mathematics on the current page." } : {}),
    ...(spec.tuition ? { tuitionAmount: spec.tuition, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `Current official tuition is CNY ${spec.tuition.toLocaleString("en-US")}/year; no 2027 effective period is published.`, displayTuition: `CNY ${spec.tuition.toLocaleString("en-US")}/year (current page)` } : { tuitionText: "Bachelor tuition is intentionally unresolved because the current page and indexed official 2026 fall guide publish different year-level amounts." }),
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: `${spec.note} No 2027 admission round is inferred from the separate academic-schedule listing.`,
    hasScholarship: true,
    scholarshipText: "The current scholarship overview lists government, language-teacher and ICCS award categories, but publishes no 2027 application window or route-specific award decision.",
    badgeText: "Current official route; 2027 cycle unresolved",
    displaySubjects: [spec.name],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "current official degree-program page",
      degreeLevel: "current official degree-program page",
      durationYears: "current official duration row",
      fieldCategory: "CUAC taxonomy of official program name",
      subjectArea: "official program name",
      teachingLanguage: "official program and language requirements",
      ...(spec.hsk ? { hskRequirement: "current official admission requirements" } : {}),
      ...(spec.csca ? { cscaSubjects: "current official bachelor materials", cscaRequirement: "current official bachelor materials" } : {}),
      ...(spec.tuition ? { tuitionAmount: "current official fee row", tuitionText: "current official fee row with explicit unresolved 2027 period" } : { tuitionText: "preserved conflict between official current page and indexed 2026 guide" }),
      applicationUrl: "current official program page",
      applicationNote: "current official route facts and explicit no-inference note",
      hasScholarship: "current official scholarship overview",
      scholarshipText: "current official scholarship overview without inferred application window",
      badgeText: "official cycle status",
    },
  };
});

type ScholarshipType = "government" | "university";
const scholarshipSpecs: Array<{ slug: string; title: string; nameZh: string; type: ScholarshipType; providerName: string; providerNameEn: string; applicableDegree: string; coverage: string }> = [
  { slug: "chinese-government-scholarship-full-current", title: "Chinese Government Scholarship (Full) at SHNU", nameZh: "上海师范大学中国政府奖学金（全额）", type: "government", providerName: "中国国家留学基金管理委员会", providerNameEn: "China Scholarship Council", applicableDegree: "Chinese language training, undergraduate and postgraduate programs", coverage: "Tuition, accommodation, comprehensive insurance and living allowance." },
  { slug: "chinese-government-scholarship-partial-current", title: "Chinese Government Scholarship (Partial) at SHNU", nameZh: "上海师范大学中国政府奖学金（部分）", type: "government", providerName: "中国国家留学基金管理委员会", providerNameEn: "China Scholarship Council", applicableDegree: "Chinese language training, undergraduate and postgraduate programs", coverage: "Partial coverage of tuition, accommodation, comprehensive insurance and living allowance." },
  { slug: "international-chinese-language-teachers-master-current", title: "International Chinese Language Teachers Scholarship — Master's", nameZh: "国际中文教师奖学金硕士项目", type: "government", providerName: "中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", applicableDegree: "Master of Teaching Chinese to Speakers of Other Languages", coverage: "Tuition, accommodation, comprehensive insurance and living allowance." },
  { slug: "international-chinese-language-teachers-one-year-current", title: "International Chinese Language Teachers Scholarship — One Academic Year", nameZh: "国际中文教师奖学金一学年研修生", type: "government", providerName: "中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", applicableDegree: "Teaching Chinese to Speakers of Other Languages, Chinese Language and Literature, and Chinese Language Study", coverage: "Tuition, accommodation, comprehensive insurance and living allowance." },
  { slug: "international-chinese-language-teachers-one-semester-current", title: "International Chinese Language Teachers Scholarship — One Semester", nameZh: "国际中文教师奖学金一学期研修生", type: "government", providerName: "中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", applicableDegree: "Teaching Chinese to Speakers of Other Languages and Chinese Language and Literature", coverage: "Tuition, accommodation, comprehensive insurance and living allowance." },
  { slug: "shanghai-government-scholarship-class-a-current", title: "Shanghai Government Scholarship Class A at SHNU", nameZh: "上海市政府外国留学生奖学金A类", type: "government", providerName: "上海市人民政府", providerNameEn: "Shanghai Municipal Government", applicableDegree: "Undergraduate and postgraduate programs, with priority to doctoral programs", coverage: "Tuition, accommodation, comprehensive insurance and living allowance." },
  { slug: "shanghai-government-scholarship-class-b-current", title: "Shanghai Government Scholarship Class B at SHNU", nameZh: "上海市政府外国留学生奖学金B类", type: "government", providerName: "上海市人民政府", providerNameEn: "Shanghai Municipal Government", applicableDegree: "Undergraduate and postgraduate programs", coverage: "Tuition and comprehensive insurance." },
  { slug: "iccs-excellent-applicant-entrance-award-current", title: "ICCS Excellent Applicant Entrance Award", nameZh: "对外汉语学院优秀新生奖学金", type: "university", providerName: "上海师范大学对外汉语学院", providerNameEn: "International College of Chinese Studies, Shanghai Normal University", applicableDegree: "Undergraduate programs", coverage: "Full or partial tuition award." },
  { slug: "iccs-merit-student-award-current", title: "ICCS Merit Student Award", nameZh: "对外汉语学院优秀学生奖学金", type: "university", providerName: "上海师范大学对外汉语学院", providerNameEn: "International College of Chinese Studies, Shanghai Normal University", applicableDegree: "Undergraduate programs", coverage: "Full or partial tuition award." },
];
const scholarships = scholarshipSpecs.map((spec) => ({
  slug: `shanghai-normal-university-${spec.slug}`,
  title: spec.title,
  nameZh: spec.nameZh,
  schoolSlug: school.slug,
  type: spec.type,
  typeLabel: spec.title,
  providerName: spec.providerName,
  providerNameEn: spec.providerNameEn,
  providerLocation: "Shanghai, China",
  fundingLevel: "Current category; award amount and 2027 window unresolved",
  coverage: spec.coverage,
  applicableDegree: spec.applicableDegree,
  amountText: "No numeric award amount or 2027 application window is published on the captured overview.",
  requirementText: "The captured overview publishes category, applicable program group and coverage only; cycle-specific eligibility and deadline remain unresolved.",
  benefitItems: [{ label: "Published coverage", included: true, note: spec.coverage }],
  eligibilityItems: [{ label: "Applicable program", value: spec.applicableDegree }, { label: "2027 cycle", value: "Not published on the captured overview" }],
  applicationMaterials: [],
  applicationSteps: [],
  actionLinks: [{ label: "Official scholarship overview", url: scholarshipPage.finalUrl ?? scholarshipPage.url, kind: "official-source" }],
  applicationRound: "Current scholarship category; no 2027 application round or deadline published",
  summary: `${spec.title} is listed on the current official overview; cycle-specific 2027 terms remain unresolved.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipPage.fetchedAt,
  ...sourceFields(scholarshipPage),
  sourceFieldLineage: { title: "current official scholarship overview", coverage: "current official coverage column", applicableDegree: "current official program column", amountText: "explicit unresolved value", requirementText: "explicit scope limitation", benefitItems: "current official coverage column", eligibilityItems: "current official program column plus unresolved cycle", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", applicationRound: "explicit no-inference note", summary: "current official category and unresolved 2027 cycle" },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: schedule.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: schedule.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 123, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: 0, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The current academic-schedule index lists Spring and Autumn 2027 calendars, but it is not an applicant-facing admission guide. No 2027 intake or deadline is inferred from the schedule alone.",
    "Current generic program pages publish end-of-July/end-of-January bachelor deadlines and middle-of-May master/doctoral deadlines without a cycle year; no intake records are created.",
    "The doctoral page conflicts internally: admission requirements state HSK 6 score 180, while the materials list states HSK 5 score 180. The structured doctoral HSK field remains absent pending editorial resolution.",
    "The current bachelor page states CNY 19,800/year, while an official 2026 fall guide indexed by the university states CNY 18,000 for years 1-2 and CNY 19,800 for years 3-4. Because the linked PDF returned HTTP 404 to the deterministic collector, bachelor numeric tuition remains absent.",
    "The current scholarship overview publishes nine categories and coverage scopes but no numeric award amounts, cycle-specific eligibility or 2027 deadlines. Those fields remain unresolved.",
    "The existing Spring 2026 bachelor PDF and two newly registered 2026 brochure PDFs returned HTTP 404 during deterministic collection. No alternate or access-control bypass was attempted.",
    "Applicant files, personal contacts, bank/payment instructions and recipient lists are excluded from the candidate.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant or recipient data is present. Personal contacts, application files and bank/payment instructions are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-168");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 168, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
