import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "nwafu-2027-refresh-2026-10-27";
const locks = [
  { id: "nwafu-international-undergraduate-guide-2027", sha256: "54d8f4faa0ca18a892d699eb545271b297592c021c979a1784fdb6addd245d40" },
  { id: "nwafu-international-admissions-faq-2027", sha256: "d1ac6520e1cd401aabd454ff08fa5084dd45d3e70cc003c620283d5378a8afc7" },
] as const;
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const evidence = new Map<string, Source>();
const visible = new Map<string, string>();
for (const lock of locks) {
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked source ${lock.id}`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== lock.sha256) throw new Error(`Evidence hash mismatch: ${lock.id}`);
  evidence.set(lock.id, source);
  visible.set(lock.id, bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim());
}
const guide = evidence.get(locks[0].id)!;
const faq = evidence.get(locks[1].id)!;
const guideText = visible.get(locks[0].id)!;
const faqText = visible.get(locks[1].id)!;
for (const pattern of [
  /202\s*7\s*年国际学生（本科生）招生简章/,
  /2026年11月1日至2027年5月31日/,
  /申请费：人民币400元/,
  /学费（汉语授课）：18000元\/学年/,
  /须提供HSK4成绩/,
  /数学必考/,
  /保险.*人民币800元\/年/,
  /住宿费6000元\/年/,
  /汉语国际教育\s*Teaching Chinese to Speakers of Other Languages/,
  /数据科学与大数据技术\s*Data Science and Big Data Technology/,
  /计算机科学与技术\s*Computer Science and Technology/,
  /工商管理\s*Business Administration/,
  /农业水利工程\s*Agricultural Water Conservancy Engineering/,
  /动物医学\s*Veterinary Medicine/,
]) if (!pattern.test(guideText)) throw new Error(`Expected NWAFU guide evidence missing: ${pattern}`);
for (const pattern of [
  /202\s*7\s*年国际学生招生FAQ/,
  /Q41：硕士研究生申请人应满足哪些基本条件/,
  /Q76：博士申请人须满足哪些基本条件/,
  /Q141：西北农林科技大学是否接收国际汉语进修生/,
  /2027年申请截止时间为2027年2月28日/,
]) if (!pattern.test(faqText)) throw new Error(`Expected NWAFU FAQ evidence missing: ${pattern}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-131.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "yangling");
const base = prior.schools?.find((row) => row.slug === "northwest-a-f-university");
if (!city || !base) throw new Error("Wave 131 Northwest A&F dependencies missing");
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const generatedAt = [guide.fetchedAt, faq.fetchedAt].sort().at(-1)!;
const school = {
  ...base,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  languageOfInstruction: "Chinese and English, route-dependent.",
  languageRequirement: "Fall 2027 Chinese-taught undergraduate applicants need HSK Level 4 or qualifying prior Chinese-medium schooling. Non-native applicants to English-taught routes need TOEFL, IELTS or another accepted English-proficiency certificate; the 2027 FAQ gives typical thresholds of IELTS 5.5 or TOEFL 79 for English-taught undergraduate and graduate study.",
  hskRequirement: "Fall 2027 Chinese-taught undergraduate: HSK Level 4, unless the published prior Chinese-medium schooling exemption applies. The 2027 FAQ states HSK Level 4 or above as the usual threshold for Chinese-taught master and doctoral study.",
  englishRequirement: "For Fall 2027 English-taught undergraduate routes, non-native English speakers must provide TOEFL, IELTS or another English-proficiency certificate. The 2027 FAQ states typical thresholds of IELTS 5.5 or TOEFL 79, or qualifying prior English-medium study.",
  deadlineSummary: "Fall 2027 international undergraduate applications run November 1, 2026-May 31, 2027. The official 2027 FAQ states a February 28, 2027 deadline for the listed Chinese Government Scholarship application route; degree-route graduate deadlines remain unresolved.",
  tuitionSummary: "Fall 2027 Chinese-taught undergraduate tuition is CNY 18,000/year. The application fee is CNY 400, insurance CNY 800/year and a double room CNY 6,000/year. Route-specific graduate and English-taught undergraduate tuition remains unresolved.",
  applicationFee: "CNY 400, non-refundable, for the published Fall 2027 undergraduate route.",
  admissionsUrl: guide.finalUrl ?? guide.url,
  cscaRequired: true,
  cscaRequirement: "Fall 2027 undergraduate applicants must take Mathematics. Chinese-taught applicants take the applicable Liberal-Arts Chinese or Science Chinese test; science, engineering, agriculture and medicine applicants also take Physics or Chemistry as required by the selected major. English-taught applicants do not take Professional Chinese.",
  cscaSubjects: ["Mathematics", "Liberal-Arts Chinese or Science Chinese for Chinese-taught study", "Physics or Chemistry where required"],
  languageTags: [...new Set([...(base.languageTags ?? []), "Chinese", "English", "HSK 4", "IELTS 5.5", "TOEFL 79"])].sort(),
  campusHighlights: [
    "Explicit Fall 2027 international undergraduate application window",
    "Published undergraduate fees, CSCA rules, materials, insurance and accommodation",
    "Official 2027 FAQ covers undergraduate, master, doctoral, scholarship and Chinese-language study",
    ...(base.campusHighlights ?? []),
  ],
  verificationStatus: "unverified" as const,
  lastVerifiedAt: generatedAt,
  ...sf(guide),
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 FAQ scope",
    languageOfInstruction: "official Fall 2027 undergraduate guide and 2027 FAQ",
    languageRequirement: "official Fall 2027 guide and 2027 FAQ language sections",
    hskRequirement: "official Fall 2027 guide and 2027 FAQ",
    englishRequirement: "official Fall 2027 guide and 2027 FAQ",
    deadlineSummary: "official Fall 2027 undergraduate guide and 2027 FAQ scholarship section",
    tuitionSummary: "official Fall 2027 undergraduate guide fee, insurance and accommodation sections",
    applicationFee: "official Fall 2027 undergraduate guide",
    admissionsUrl: "official Fall 2027 undergraduate guide",
    cscaRequired: "official Fall 2027 undergraduate guide",
    cscaRequirement: "official Fall 2027 undergraduate guide",
    cscaSubjects: "official Fall 2027 undergraduate guide",
    languageTags: "official 2027 language requirements",
    campusHighlights: "official 2027 guide and FAQ coverage",
  },
};
const programRows = [
  { slug: "teaching-chinese-to-speakers-of-other-languages", nameEn: "Teaching Chinese to Speakers of Other Languages", nameZh: "汉语国际教育", durationYears: 4, fieldCategory: "Languages", subjectArea: "Chinese Language Education", cscaSubjects: ["Liberal-Arts Chinese", "Mathematics"] },
  { slug: "data-science-and-big-data-technology", nameEn: "Data Science and Big Data Technology", nameZh: "数据科学与大数据技术", durationYears: 4, fieldCategory: "Computer Science and Data", subjectArea: "Data Science", cscaSubjects: ["Science Chinese", "Mathematics", "Physics"] },
  { slug: "computer-science-and-technology", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", durationYears: 4, fieldCategory: "Computer Science and Data", subjectArea: "Computer Science", cscaSubjects: ["Science Chinese", "Mathematics", "Physics"] },
  { slug: "business-administration", nameEn: "Business Administration", nameZh: "工商管理", durationYears: 4, fieldCategory: "Business and Management", subjectArea: "Business Administration", cscaSubjects: ["Liberal-Arts Chinese", "Mathematics"] },
  { slug: "agricultural-water-conservancy-engineering", nameEn: "Agricultural Water Conservancy Engineering", nameZh: "农业水利工程", durationYears: 4, fieldCategory: "Engineering", subjectArea: "Water Resources Engineering", cscaSubjects: ["Science Chinese", "Mathematics", "Physics"] },
  { slug: "veterinary-medicine", nameEn: "Veterinary Medicine", nameZh: "动物医学", durationYears: 5, fieldCategory: "Agriculture and Veterinary Medicine", subjectArea: "Veterinary Medicine", cscaSubjects: ["Science Chinese", "Mathematics", "Chemistry"] },
] as const;
const programs = programRows.map((row) => ({
  slug: `northwest-a-f-university-${row.slug}-fall-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: row.nameEn,
  nameZh: row.nameZh,
  degreeLevel: "Bachelor",
  durationYears: row.durationYears,
  fieldCategory: row.fieldCategory,
  subjectArea: row.subjectArea,
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 4, unless the published prior Chinese-medium schooling exemption applies.",
  tuitionAmount: 18000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 18,000/year; CNY 400 non-refundable application fee, CNY 800/year insurance and CNY 6,000/year double-room accommodation are published separately.",
  applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: "Applicants must be non-Chinese citizens, normally age 25 or younger, and hold or expect a high-school diploma. Required uploads include passport, diploma or expected-graduation proof, transcript, language proof, personal statement, two teacher recommendations, CSCA results and any competition certificates.",
  cscaRequirement: `The official 2027 major table requires ${row.cscaSubjects.join(", ")}.`,
  cscaSubjects: [...row.cscaSubjects],
  hasScholarship: true,
  scholarshipText: "The guide lists the Xi'an Central Asian Five Countries Scholarship and the Northwest A&F University International Student Scholarship with a May 31, 2027 cutoff; benefit amounts are not published on the captured guide.",
  badgeText: "Fall 2027 official major",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official Fall 2027 undergraduate major table",
    nameZh: "official Fall 2027 undergraduate major table",
    degreeLevel: "official degree-award column",
    durationYears: "official duration column",
    fieldCategory: "CUAC taxonomy mapped from official major name",
    subjectArea: "official major name",
    teachingLanguage: "official guide note stating all listed majors are Chinese-taught",
    hskRequirement: "official language requirement",
    tuitionAmount: "official Chinese-taught tuition",
    tuitionCurrency: "official fee table",
    tuitionPeriod: "official fee table",
    tuitionText: "official fee, insurance and accommodation sections",
    applicationUrl: "official guide",
    applicationNote: "official eligibility and materials sections",
    cscaRequirement: "official per-major CSCA column",
    cscaSubjects: "official per-major CSCA column",
    hasScholarship: "official funding-source table",
    scholarshipText: "official funding-source table; no award amount inferred",
    badgeText: "official guide title and major table",
  },
}));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-10-31T16:00:00.000Z",
  deadlineDate: "2027-05-31T15:59:59.000Z",
  deadlineLabel: "Application period: November 1, 2026-May 31, 2027 (Beijing dates)",
  applicationRound: "Fall 2027 international undergraduate admission",
  ...sf(guide),
  sourceFieldLineage: {
    intakeTerm: "official Fall 2027 undergraduate guide and registration schedule",
    intakeYear: "official guide title and August/September 2027 registration",
    openDate: "official application start normalized from Beijing date to UTC",
    deadlineDate: "official deadline normalized to end-of-day Beijing time in UTC",
    deadlineLabel: "official application period",
    applicationRound: "official guide title",
  },
}));
const scholarships = [
  { slug: "nwafu-xian-central-asian-five-countries-scholarship-2027", title: "Xi'an Central Asian Five Countries Scholarship (NWAFU 2027 Undergraduate Route)", nameZh: "西安市“中亚五国”奖学金", type: "municipal", typeLabel: "Municipal scholarship", targetRegions: ["Central Asian Five Countries"] },
  { slug: "nwafu-international-student-scholarship-2027", title: "Northwest A&F University International Student Scholarship (2027 Undergraduate Route)", nameZh: "西北农林科技大学国际学生奖学金", type: "university", typeLabel: "University scholarship", targetRegions: [] },
].map((row, index) => ({
  ...row,
  schoolSlug: school.slug,
  providerNameEn: index === 0 ? "Xi'an Municipality" : "Northwest A&F University",
  providerLocation: "Yangling, Shaanxi, China",
  applicableDegree: "Undergraduate",
  applicableProgram: "The six Chinese-taught majors listed in the official Fall 2027 international undergraduate guide.",
  deadlineDate: "2027-05-31",
  deadlineLabel: "Application deadline: May 31, 2027",
  applicationRound: "Fall 2027 international undergraduate admission",
  summary: "The official Fall 2027 undergraduate guide names this funding route and its deadline; award coverage and amount are not published in the captured source.",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    title: "official funding-source table",
    nameZh: "official funding-source table",
    type: "provider classification from the official scholarship name",
    applicableDegree: "official undergraduate guide scope",
    applicableProgram: "official major table and funding-source table",
    deadlineDate: "official funding-source table",
    deadlineLabel: "official funding-source table",
    applicationRound: "official guide title",
    targetRegions: index === 0 ? "official scholarship name; individual countries not inferred" : "not published",
    summary: "official funding-source table with explicit limitation disclosure",
  },
}));
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 69, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence: [...evidence.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: [
    "The live official guide changed after the first October 27 capture. The refreshed source now embeds six exact Fall 2027 Chinese-taught undergraduate major rows, so the earlier umbrella route is replaced with those six rows and their per-major durations and CSCA subjects.",
    "The guide includes a generic English-language evidence sentence, but explicitly states that all six listed undergraduate majors are Chinese-taught; no English-taught Fall 2027 undergraduate route is created.",
    "The FAQ supplies broad 2027 graduate and Chinese-language guidance but not a complete cycle-specific graduate catalog, tuition schedule or degree application calendar, so no graduate route is created.",
    "Two scholarship records retain only the official names, undergraduate applicability and May 31, 2027 deadline. Coverage, amount and detailed eligibility remain absent because the captured source does not publish them.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published staff contacts, bank details, payment instructions and applicant personal data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-203");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 203, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
