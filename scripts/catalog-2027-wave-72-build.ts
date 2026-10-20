import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/wave-72-2026-10-20-network");
const expected = {
  "hust-youth-of-excellence-scholarship-2027": "27b68bd7869647939ba4cd1665a7917728193644b55726ad4a39361405a5f640",
  "jilin-bridging-medicine-program-2027": "51c578a4dd2d162fbe5b4dde178a54dd44b544d0136b2756deba062f3246df00",
} as const;
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = new Map<string, ManifestSource>();
for (const [id, expectedSha256] of Object.entries(expected)) {
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked Wave 72 evidence: ${id}`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== expectedSha256) throw new Error(`Wave 72 evidence hash mismatch: ${id}`);
  evidence.set(id, source);
}

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const wave16 = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-16.draft.json"), "utf8")) as CatalogSeedBundle;
const hustSlug = "huazhong-university-of-science-and-technology";
const jilinSlug = "jilin-university";
const hust = baseline.schools?.find((row) => row.slug === hustSlug);
const jilin = wave16.schools?.find((row) => row.slug === jilinSlug);
const wuhan = baseline.cities?.find((row) => row.slug === "wuhan");
const changchun = baseline.cities?.find((row) => row.slug === "changchun");
if (!hust || !jilin || !wuhan || !changchun) throw new Error("Wave 72 dependencies are missing from the reviewed 100-school release.");

const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});
const hustSource = evidence.get("hust-youth-of-excellence-scholarship-2027")!;
const jilinSource = evidence.get("jilin-bridging-medicine-program-2027")!;
const hustEligibility = "Applicants must be non-Chinese citizens in good physical and mental health, be under 45, hold at least a bachelor's degree, have at least three years of work experience, and be a senior public official, senior institutional or enterprise manager, university or research-institution administrator, or have international-organization work or internship experience.";
const hustEnglish = "Good English proficiency is required. TOEFL 80, IELTS 6.0, GRE 310, an accepted equivalent certificate, or prior English-medium study is preferred.";

const hustPrograms: CatalogSeedProgram[] = [
  ["international-business", "Master of International Business"],
  ["public-administration-impa", "Master of Public Administration (IMPA)"],
].map(([slug, nameEn]) => ({
  slug: `${hustSlug}-youth-excellence-${slug}-2027`,
  schoolSlug: hustSlug,
  citySlug: wuhan.slug,
  nameEn: `${nameEn} - Youth of Excellence Scheme of China`,
  degreeLevel: "Master",
  durationYears: 2,
  fieldCategory: "Management & Economics",
  subjectArea: nameEn,
  teachingLanguage: "English",
  englishRequirement: hustEnglish,
  tuitionText: "The official guide does not publish a numeric tuition amount. The Youth of Excellence scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance for the first academic year.",
  applicationUrl: hustSource.finalUrl ?? hustSource.url,
  applicationNote: `${hustEligibility} The two-year 1+1 format places course study, research and dissertation preparation at HUST in year one; students return to their home country in year two to complete and defend the dissertation.`,
  badgeText: "2027 Youth of Excellence",
  displayGroup: "Youth of Excellence Scheme of China",
  displayGroupLabel: "2027 English-taught master's programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: hustSource.fetchedAt,
  ...sourceFields(hustSource),
  sourceFieldLineage: {
    nameEn: "official Programs Available at HUST section",
    degreeLevel: "official master's degree candidate scope",
    durationYears: "official two-year 1+1 schooling duration",
    fieldCategory: "official program subject",
    subjectArea: "official program name",
    teachingLanguage: "official language of instruction",
    englishRequirement: "official language-proficiency section",
    tuitionText: "official funding-duration and coverage sections",
    applicationUrl: "registered official application guide",
    applicationNote: "official eligibility and schooling-duration sections",
    badgeText: "official 2027 guide title",
    displayGroup: "official scholarship program name",
    displayGroupLabel: "official 2027 program list",
  },
}));

const jilinProgram: CatalogSeedProgram = {
  slug: `${jilinSlug}-bridging-medicine-pre-medical-spring-2027`,
  schoolSlug: jilinSlug,
  citySlug: changchun.slug,
  nameEn: "Bridging Medicine Program (Pre-Medical)",
  degreeLevel: "Non-degree",
  durationMonths: 4,
  fieldCategory: "Medicine & Health",
  subjectArea: "Pre-Medical Studies",
  tuitionAmount: 12000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "program",
  tuitionText: "Tuition is CNY 12,000 for the March-June program. Daxuecheng Dormitory accommodation is CNY 750-1,500 per month.",
  applicationUrl: jilinSource.finalUrl ?? jilinSource.url,
  applicationNote: "Applicants must be 18-30, in good health, hold a high-school diploma, meet the stated medical-program health conditions, comply with Chinese law and Jilin University rules, and have a strong interest in medicine. Required application materials are the passport information page, high-school graduation certificate, transcript, language-proficiency certificate and Foreigner Physical Examination Form.",
  badgeText: "Spring 2027 pre-medical",
  displayGroup: "Bridging Medicine",
  displayGroupLabel: "2027 Pre-Medical Program",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: jilinSource.fetchedAt,
  ...sourceFields(jilinSource),
  sourceFieldLineage: {
    nameEn: "official guide title and course-completion section",
    degreeLevel: "official pre-college and course-completion wording",
    durationMonths: "official March-to-June course duration",
    fieldCategory: "official medicine pathway description",
    subjectArea: "official Pre-Medical certificate wording",
    tuitionAmount: "official fees section",
    tuitionCurrency: "official fees section",
    tuitionPeriod: "official program fee and duration",
    tuitionText: "official fees section",
    applicationUrl: "registered official application guide",
    applicationNote: "official application requirements and document list",
    badgeText: "official enrollment date",
    displayGroup: "official program title",
    displayGroupLabel: "official 2027 guide title",
  },
};

const jilinIntake: CatalogSeedProgramIntake = {
  programSlug: jilinProgram.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-12-31T15:59:59.000Z",
  deadlineLabel: "Apply during November-December 2026 and submit the listed materials by December 31, 2026. Registration is in early March 2027; courses run March-June.",
  applicationRound: "Jilin University Spring 2027 Bridging Medicine Program",
  status: "open",
  ...sourceFields(jilinSource),
  sourceFieldLineage: {
    intakeTerm: "official early-March registration date",
    intakeYear: "official guide title and registration date",
    deadlineDate: "official submit-by date",
    deadlineLabel: "official enrollment and application periods",
    applicationRound: "official guide title",
    status: "published application route compared with capturedAt",
  },
};

const hustScholarship: CatalogSeedScholarship = {
  slug: "official-2027-hust-youth-of-excellence-scheme-of-china",
  title: "HUST 2027 Youth of Excellence Scheme of China Program",
  schoolSlug: hustSlug,
  providerName: "Chinese Government Scholarship / Huazhong University of Science and Technology",
  applicableDegree: "Master",
  applicableProgram: "Master of International Business and Master of Public Administration (IMPA)",
  fundingLevel: "Full",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance for the first academic year in China.",
  deadlineDate: "2027-03-31",
  deadlineLabel: "Apply for a HUST pre-admission letter by March 1, 2027 if one is desired; submit the CSC Type A scholarship application by March 31, 2027.",
  requirementText: `${hustEligibility} ${hustEnglish}`,
  applicationRound: "2027 Chinese Government Scholarship Youth of Excellence Scheme",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: hustSource.fetchedAt,
  ...sourceFields(hustSource),
  sourceFieldLineage: {
    title: "official 2027 guide title",
    schoolSlug: "official HUST domain and designated-host statement",
    providerName: "official Chinese Government Scholarship wording",
    applicableDegree: "official master's degree candidate scope",
    applicableProgram: "official Programs Available at HUST section",
    fundingLevel: "official full-scholarship wording",
    coverage: "official coverage and funding-duration sections",
    deadlineDate: "official Chinese application section",
    deadlineLabel: "official pre-admission and CSC application sections",
    requirementText: "official eligibility and language-proficiency sections",
    applicationRound: "official guide title",
    status: "application deadline compared with capturedAt",
  },
};

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [wuhan, changchun],
  schools: [hust, jilin],
  programs: [...hustPrograms, jilinProgram],
  programIntakes: [jilinIntake],
  scholarships: [hustScholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 72 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [hustSlug, jilinSlug], refreshedPrograms: 3, new2027Intakes: 1, refreshedScholarships: 1, sourceSnapshots: 2 },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "HUST does not publish a numeric tuition amount, a numeric living allowance, or an explicit enrollment term on this guide, so those fields remain absent.",
    "The HUST guide funds the first year only; no second-year funding is inferred.",
    "The Jilin guide requires a language-proficiency certificate but does not publish a language of instruction or a score threshold, so those fields remain absent.",
    "The Jilin application period begins in November without an exact opening day, so openDate remains absent.",
  ],
  notes: [
    "The Jilin route is a non-degree pre-medical bridge that may lead to undergraduate Clinical Medicine after successful completion; admission to the later degree is not guaranteed or represented as a degree intake.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-72");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 72, candidateSha256, counts: { schools: 2, programs: 3, programIntakes: 1, scholarships: 1, sourceSnapshots: 2 }, publicationAuthorized: false }, null, 2));
