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
const locks = [
  {
    run: "2026-10-27T02-19-33-353Z",
    id: "szu-international-chinese-language-teachers-scholarship-spring-2027",
    sha256: "f82dded44d9bc12e3e9a1dda3a62be99176a1bb3c84d0d68115b9eba32fceda4",
  },
  {
    run: "2026-10-27T02-19-33-446Z",
    id: "szu-chinese-language-long-term-program-spring-2027",
    sha256: "496f1e58cae20cc55196df12d6622c90a728107d8b3ea6ec5e43e6c0bfe0c6d6",
  },
  {
    run: "szu-language-spring-2027-en-2026-10-27",
    id: "szu-chinese-language-long-term-program-spring-2027-en",
    sha256: "9daa17bb1bd7854e840430fa2fb20326ccffd4870a9d6d6ded50e2a46ed81560",
  },
] as const;

const evidence = new Map<string, Source>();
const visible = new Map<string, string>();
for (const lock of locks) {
  const directory = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked source ${lock.id}`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== lock.sha256) throw new Error(`Evidence hash mismatch: ${lock.id}`);
  const text = bytes.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  evidence.set(lock.id, source);
  visible.set(lock.id, text);
}

const scholarshipSource = evidence.get(locks[0].id)!;
const languageSource = evidence.get(locks[1].id)!;
const englishLanguageSource = evidence.get(locks[2].id)!;
const scholarshipText = visible.get(locks[0].id)!;
const languageText = visible.get(locks[1].id)!;
const englishLanguageText = visible.get(locks[2].id)!;
for (const pattern of [
  /2027年春季深圳大学国际中文教师奖学金/,
  /2\s*027年3月/,
  /国际中文教育/,
  /汉语言文学/,
  /HSK（三级）180分/,
  /25\s*00元人民币\/月/,
  /2026年\s*10\s*月\s*31\s*日/,
]) {
  if (!pattern.test(scholarshipText)) throw new Error(`Expected SZU scholarship evidence missing: ${pattern}`);
}
for (const pattern of [
  /2027年3月-2027年7月/,
  /报名费：400元人民币/,
  /学费：11000元人民币\/学期/,
  /课程周学时为24学时或以上/,
  /申请人年龄18至60周岁/,
  /2026年\s*10月\s*26日——2026年\s*12月\s*30日（预计）/,
  /该课程不提供校内住宿/,
]) {
  if (!pattern.test(languageText)) throw new Error(`Expected SZU language-program evidence missing: ${pattern}`);
}
for (const pattern of [
  /2027 Spring Semester Offline Long-term Chinese Language Program/,
  /March 2027 – July 2027/,
  /October 26, 2027——December 30, 2027/,
  /March 2027 – January 2027/,
  /before June 25/,
]) {
  if (!pattern.test(englishLanguageText)) throw new Error(`Expected SZU English-page conflict evidence missing: ${pattern}`);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-03.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "shenzhen");
const base = prior.schools?.find((row) => row.slug === "shenzhen-university");
if (!city || !base) throw new Error("Wave 03 Shenzhen University dependencies missing");

const fields = (source: Source) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});
const generatedAt = [scholarshipSource.fetchedAt, languageSource.fetchedAt, englishLanguageSource.fetchedAt].sort().at(-1)!;
const school = {
  ...base,
  applicationLevel: "Doctoral and Non-degree",
  languageOfInstruction: "Chinese and English, route-dependent.",
  languageRequirement: "The Spring 2027 International Chinese Language Teachers Scholarship routes require HSK Level 3 score 180 and an HSKK result. The self-funded Chinese-language route places students by prior study level. Doctoral requirements remain route-specific.",
  hskRequirement: "Spring 2027 one-semester scholarship routes: HSK Level 3 score 180 plus an HSKK result. Doctoral Chinese-taught routes: HSK Level 5 score 180.",
  deadlineSummary: "Spring 2027 scholarship deadline: October 31, 2026. Self-funded long-term Chinese registration is published as October 26-December 30, 2026 (expected and subject to early closure when capacity is full). Spring 2027 doctoral deadline: November 30, 2026.",
  tuitionSummary: "Spring 2027 self-funded long-term Chinese: CNY 11,000/semester plus CNY 400 non-refundable registration fee. The scholarship routes waive tuition and provide published benefits. Doctoral tuition remains program-category dependent.",
  applicationFee: "Self-funded long-term Chinese: CNY 400, non-refundable. Doctoral: CNY 400 or USD 60, non-refundable.",
  admissionsUrl: languageSource.finalUrl ?? languageSource.url,
  campusHighlights: [
    "Spring 2027 self-funded long-term Chinese route: 18 weeks at Canghai Campus",
    "Two Spring 2027 one-semester International Chinese Language Teachers Scholarship directions",
    "The self-funded Chinese route does not provide on-campus accommodation",
    ...(base.campusHighlights ?? []),
  ],
  subjectTags: [...new Set([...(base.subjectTags ?? []), "Chinese Language and Culture"])].sort(),
  languageTags: [...new Set([...(base.languageTags ?? []), "Chinese", "HSK 3", "HSKK"])].sort(),
  lastVerifiedAt: generatedAt,
  ...fields(languageSource),
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official Spring 2027 doctoral and non-degree pages",
    languageOfInstruction: "official Spring 2027 doctoral, scholarship and self-funded language pages",
    languageRequirement: "official Spring 2027 scholarship eligibility and self-funded level table",
    hskRequirement: "official Spring 2027 scholarship Chinese-language eligibility text plus existing doctoral guide",
    deadlineSummary: "official Spring 2027 scholarship, self-funded language and doctoral application periods",
    tuitionSummary: "official self-funded language fee table, scholarship benefits and existing doctoral guide",
    applicationFee: "official self-funded language fee table plus existing doctoral guide",
    admissionsUrl: "official Spring 2027 self-funded Chinese-language page",
    campusHighlights: "official Spring 2027 self-funded language and scholarship pages",
    subjectTags: "CUAC taxonomy from official route scope",
    languageTags: "official route language and test requirements",
  },
};

const selfFundedProgram = {
  slug: "shenzhen-university-chinese-language-long-term-offline-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Chinese Language Long-Term Offline Program (Spring 2027)",
  nameZh: "汉语线下长期进修课程（2027年春季）",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese Language and Culture",
  subjectArea: "Chinese Language",
  teachingLanguage: "Chinese",
  tuitionAmount: 11000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 11,000 per semester; CNY 400 non-refundable registration fee. The published schedule is 18 weeks with at least 24 class hours per week.",
  applicationUrl: languageSource.finalUrl ?? languageSource.url,
  applicationNote: "March-July 2027 at Canghai Campus. Applicants must be foreign-passport holders age 18-60 and submit passport, visa or residence permit, photo, Foreigner Physical Examination Form, CV and personal statement. The route does not provide on-campus accommodation.",
  hasScholarship: false,
  badgeText: "Spring 2027 self-funded route",
  displaySubjects: ["Entry A", "Entry B", "Elementary A", "Elementary B", "Intermediate A", "Intermediate B", "Advanced", "Business Chinese"],
  displayGroup: "szu-chinese-language-spring-2027",
  displayGroupLabel: "SZU Spring 2027 long-term Chinese-language route",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...fields(languageSource),
  sourceFieldLineage: {
    nameEn: "official page title and project scope",
    nameZh: "official page title",
    degreeLevel: "official long-term training-course category",
    fieldCategory: "CUAC taxonomy based on official program scope",
    subjectArea: "official program scope",
    teachingLanguage: "official course and placement table",
    tuitionAmount: "official fee table",
    tuitionCurrency: "official fee table",
    tuitionPeriod: "official fee table",
    tuitionText: "official fee and class-hour table",
    applicationUrl: "official captured page",
    applicationNote: "official schedule, campus, eligibility, materials and accommodation notice",
    badgeText: "official intake cycle and funding type",
    displaySubjects: "official placement-level table",
  },
};

const directions = [
  { slug: "international-chinese-language-education", en: "International Chinese Language Education", zh: "国际中文教育" },
  { slug: "chinese-language-and-literature", en: "Chinese Language and Literature", zh: "汉语言文学" },
] as const;
const scholarshipPrograms = directions.map((direction) => ({
  slug: `shenzhen-university-iclts-${direction.slug}-spring-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: `International Chinese Language Teachers Scholarship — ${direction.en}, One-Semester Program (Spring 2027)`,
  nameZh: `国际中文教师奖学金${direction.zh}方向一学期研修项目（2027年春季）`,
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language and Culture",
  subjectArea: direction.en,
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 and an HSKK result are required under the Chinese source text.",
  scholarshipText: "Full scholarship covering tuition, accommodation, comprehensive medical insurance and CNY 2,500/month living allowance.",
  applicationUrl: scholarshipSource.finalUrl ?? scholarshipSource.url,
  applicationNote: "Apply through both the International Chinese Language Teachers Scholarship system and Shenzhen University system by October 31, 2026 (Beijing Time).",
  hasScholarship: true,
  badgeText: "Spring 2027 full scholarship route",
  displaySubjects: [direction.en],
  displayGroup: "szu-iclts-spring-2027",
  displayGroupLabel: "SZU Spring 2027 one-semester scholarship routes",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...fields(scholarshipSource),
  sourceFieldLineage: {
    nameEn: "official one-semester directions and March 2027 intake",
    nameZh: "official one-semester directions and March 2027 intake",
    degreeLevel: "official one-semester category",
    durationMonths: "official maximum five-month funding duration",
    fieldCategory: "CUAC taxonomy based on official route scope",
    subjectArea: "official one-semester directions",
    teachingLanguage: "official HSK and HSKK requirements",
    hskRequirement: "Chinese-language official eligibility text; English rendering conflict disclosed in review",
    scholarshipText: "official scholarship benefit list and living allowance",
    applicationUrl: "official scholarship page",
    applicationNote: "official dual-system procedure and deadline",
    hasScholarship: "official scholarship category",
    badgeText: "official intake cycle and funding level",
  },
}));
const programs = [selfFundedProgram, ...scholarshipPrograms];
const selfFundedIntake = {
  programSlug: selfFundedProgram.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-25T16:00:00.000Z",
  deadlineDate: "2026-12-30T15:59:59.000Z",
  deadlineLabel: "Expected registration period: October 26-December 30, 2026; may close early when capacity is full",
  applicationRound: "March-July 2027 self-funded long-term offline Chinese program",
  status: "open" as const,
  ...fields(languageSource),
  sourceFieldLineage: {
    intakeTerm: "official March 2027 start",
    intakeYear: "official March-July 2027 study period",
    openDate: "official registration start normalized from Beijing date to UTC",
    deadlineDate: "official expected deadline normalized to end-of-day Beijing time in UTC",
    deadlineLabel: "official page retains expected and early-closure qualifications",
    applicationRound: "official program and study-period description",
    status: "derived from capture time within published expected registration window",
  },
};
const scholarshipIntakes = scholarshipPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (Beijing Time)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester study",
  status: "open" as const,
  ...fields(scholarshipSource),
  sourceFieldLineage: {
    intakeTerm: "official March 2027 entry",
    intakeYear: "official March 2027 entry",
    deadlineDate: "official October 31, 2026 deadline normalized to UTC",
    deadlineLabel: "official deadline",
    applicationRound: "official scholarship category and intake",
    status: "derived from capture time before published deadline",
  },
}));

const scholarship = {
  slug: "shenzhen-university-iclts-one-semester-spring-2027",
  schoolSlug: school.slug,
  title: "Shenzhen University International Chinese Language Teachers Scholarship — One-Semester Program, Spring 2027",
  nameZh: "深圳大学国际中文教师奖学金一学期研修项目（2027年春季）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "教育部中外语言交流合作中心 / 深圳大学",
  providerNameEn: "Center for Language Education and Cooperation / Shenzhen University",
  providerLocation: "Shenzhen, China",
  fundingLevel: "Full scholarship",
  amountText: "CNY 2,500/month living allowance; tuition, accommodation and comprehensive medical insurance are covered.",
  coverage: "Full tuition, accommodation, comprehensive medical insurance and CNY 2,500/month living allowance. On-campus double-room accommodation or an off-campus allowance under the scholarship standard is available subject to university approval.",
  applicableDegree: "Non-degree, one-semester study",
  applicableProgram: "International Chinese Language Education and Chinese Language and Literature",
  requirementText: "Non-Chinese applicants age 16-35 as of September 1, 2026 (in-service Chinese teachers may be up to 45) need HSK Level 3 score 180 and an HSKK result under the Chinese source text. Applicants must be in good health and good academic standing and intend to work in Chinese-language education or related fields.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Full waiver" },
    { label: "Accommodation", included: true, note: "On-campus double room or approved off-campus allowance under the scholarship standard" },
    { label: "Living allowance", included: true, note: "CNY 2,500/month" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
  ],
  eligibilityItems: [
    { label: "Nationality", value: "Non-Chinese citizen" },
    { label: "Age", value: "Normally 16-35 as of September 1, 2026; in-service Chinese teachers may be up to 45" },
    { label: "Language", value: "HSK Level 3 score 180 plus an HSKK result under the Chinese source text" },
    { label: "Prior award", value: "Applicants who received a similar one-semester or one-year scholarship within three years are ineligible" },
  ],
  applicationMaterials: [
    { label: "Passport", value: "Passport photo-page scan; applicants under 18 also need notarized guardianship documents" },
    { label: "Language results", value: "Valid HSK and HSKK score reports" },
    { label: "Recommendation", value: "Recommendation letter from the head of the recommending institution" },
    { label: "In-service teachers", value: "Employment certificate and employer recommendation" },
    { label: "Health and conduct", value: "Foreigner Physical Examination Form and non-criminal record" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Submit the online scholarship application and choose Shenzhen University" },
    { label: "Step 2", value: "Submit the Shenzhen University online application and required materials" },
    { label: "Step 3", value: "Shenzhen University and CLEC complete their respective reviews" },
  ],
  actionLinks: [{ label: "Official Shenzhen University scholarship guide", url: scholarshipSource.finalUrl ?? scholarshipSource.url, kind: "official-source" }],
  deadlineDate: "2026-10-31",
  deadlineLabel: "October 31, 2026 (Beijing Time) for March 2027 entry",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester study",
  summary: "Full five-month scholarship for two published Chinese-language study directions.",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...fields(scholarshipSource),
  sourceFieldLineage: {
    title: "official scholarship category and intake",
    typeLabel: "official scholarship name",
    amountText: "official benefit list and numeric living allowance",
    coverage: "official benefit standards",
    applicableDegree: "official one-semester category",
    applicableProgram: "official one-semester directions",
    requirementText: "official Chinese-language eligibility text; translation conflict disclosed in review",
    benefitItems: "official benefit standards",
    eligibilityItems: "official eligibility and restrictions",
    applicationMaterials: "official application materials",
    applicationSteps: "official dual-system application process",
    actionLinks: "official captured page",
    deadlineDate: "official deadline",
    deadlineLabel: "official deadline",
    applicationRound: "official category and intake",
    summary: "official route scope, duration and benefits",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [selfFundedIntake, ...scholarshipIntakes],
  scholarships: [scholarship],
};
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
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 72, schoolSlugs: [school.slug], newSchools: 0, programs: 3, programIntakes: 3, scholarships: 1 },
  evidence: [...evidence.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: [
    "The scholarship page's Chinese eligibility text requires an HSKK result, while its English rendering describes HSKK as preferred. The candidate follows the Chinese original and preserves this conflict for review.",
    `The separately captured English page (${englishLanguageSource.sha256}) contradicts its Spring 2027 heading and March-July 2027 schedule by printing an October 26-December 30, 2027 application window, a March 2027-January 2027 elective-course range, and an unrelated June 25 early-closure warning. The hash-locked Chinese page is unchanged and explicitly prints October 26-December 30, 2026, so the candidate retains the Chinese-source dates and records the English rendering as unresolved rather than overwriting them.`,
    "The self-funded route publishes December 30, 2026 as an expected deadline and warns that registration may close earlier when capacity is full; this qualification is retained.",
    "The self-funded route publishes an exact 18-week duration, so no rounded durationMonths value is inferred.",
    "No general Fall 2027 degree guide is inferred from these Spring 2027 non-degree notices.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published staff contact details, applicant personal data and payment information are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-202");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 202, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
