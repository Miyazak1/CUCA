import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T06-02-23-581Z";
const sourceId = "swjtu-chinese-language-program-2027";
const lockedSha256 = "a23f742e836791df6c093aece42b7d0bb7129727a8756b526e1ff2193a6780ef";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === lockedSha256);
if (!source) throw new Error("Missing locked Southwest Jiaotong University 2027 evidence.");
const artifact = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== lockedSha256) throw new Error("SWJTU evidence hash mismatch.");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "southwest-jiaotong-university";
const citySlug = "chengdu";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Southwest Jiaotong University already exists in the reviewed base.");
const city = dependency.cities?.find((row) => row.slug === citySlug);
if (!city) throw new Error("Chengdu city dependency is missing.");

const school = {
  slug: schoolSlug, nameEn: "Southwest Jiaotong University", nameZh: "西南交通大学", citySlug,
  schoolType: "National key university", region: "Chengdu, Sichuan, Southwest China",
  applicationLevel: "Chinese Language Program; current 2027 degree routes are unresolved", languageOfInstruction: "Chinese and English",
  deadlineSummary: "For the 2027 Chinese Language Learning Programs, Spring applications close January 1, 2027 and Fall applications run March 1-June 30, 2027.",
  tuitionSummary: "The 2027 Chinese Language Learning Programs charge CNY 7,000 per semester or CNY 14,000 per academic year, plus a CNY 400 application fee, CNY 1,000 annual insurance and optional CNY 365/month twin-room accommodation.",
  applicationFee: "CNY 400, non-refundable.", websiteUrl: "https://en.swjtu.edu.cn/", admissionsUrl: source.finalUrl ?? source.url,
  subjectTags: ["Chinese Language", "Chinese Culture"], languageTags: ["Chinese", "English"],
  campusHighlights: ["Xipu Campus", "Beginner and intermediate Chinese classes", "2027 Spring and Fall application windows"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...sourceFields,
  sourceFieldLineage: { nameEn: "official 2027 program page", nameZh: "official 2027 program page", citySlug: "official page identity plus reviewed Chengdu dependency", schoolType: "official page description plus CUAC classification", region: "official page location plus CUAC taxonomy", applicationLevel: "official 2027 program scope with degree-route limitation", languageOfInstruction: "official program information", deadlineSummary: "official application dates", tuitionSummary: "official fee section", applicationFee: "official fee section", admissionsUrl: "official 2027 program page", subjectTags: "official program objective", campusHighlights: "official program, accommodation and application-date sections" },
};

const variants = [
  { slug: "beginner", nameEn: "Chinese Language Learning - Beginner Class", nameZh: "汉语语言学习初级班", durationMonths: 10, objective: "Target HSK Level 3", tuitionAmount: 14000, displayTuition: "CNY 14,000/year" },
  { slug: "intermediate", nameEn: "Chinese Language Learning - Intermediate Class", nameZh: "汉语语言学习中级班", durationMonths: 5, objective: "Target HSK Levels 4-5", tuitionAmount: 7000, displayTuition: "CNY 7,000/semester" },
];
const programs = variants.map((variant) => ({
  slug: `${schoolSlug}-chinese-language-${variant.slug}-2027`, schoolSlug, citySlug, nameEn: variant.nameEn, nameZh: variant.nameZh,
  degreeLevel: "Language Program", durationMonths: variant.durationMonths, fieldCategory: "Languages and Culture", subjectArea: "Chinese Language", teachingLanguage: "Chinese and English",
  tuitionAmount: variant.tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: variant.slug === "beginner" ? "year" : "semester", tuitionText: `${variant.displayTuition}; application fee CNY 400, insurance CNY 1,000/year and optional twin-room accommodation CNY 365/month, excluding utilities.`,
  applicationUrl: "https://admission.swjtu.edu.cn", applicationNote: `${variant.objective}. Applicants must be non-Chinese citizens aged 17-50, physically and mentally healthy, with no law or regulation violations and sufficient funds for study and living costs. Required documents include passport, notarized education certificate and transcript, physical examination, financial proof, recent non-criminal record, guardian documents when under 18, and current visa/residence page when already in China.`,
  hasScholarship: false, badgeText: "2027 official language route", displayTuition: variant.displayTuition, displaySubjects: ["Chinese Language", "Chinese Culture"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...sourceFields,
  sourceFieldLineage: { nameEn: "official program title and class level", nameZh: "official program title and class level", degreeLevel: "official non-degree language-program scope", durationMonths: "official semester duration normalized as five months per stated semester dates", fieldCategory: "CUAC taxonomy of official program scope", subjectArea: "official program focus", teachingLanguage: "official program information", tuitionAmount: "official fee section", applicationUrl: "official page application website", applicationNote: "official objectives, eligibility, materials and fee sections", badgeText: "official 2027 page title" },
}));
const programIntakes = programs.flatMap((program) => [
  { programSlug: program.slug, intakeTerm: "Spring 2027", intakeYear: 2027, deadlineDate: "2027-01-01T15:59:59.000Z", deadlineLabel: "Apply by January 1, 2027; the semester runs March-July 2027.", applicationRound: "Spring 2027 Chinese Language Learning Program", status: "open" as const, ...sourceFields, sourceFieldLineage: { intakeTerm: "official Spring semester dates", intakeYear: "official page title and deadline", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official application and semester dates", applicationRound: "official program title and semester" } },
  { programSlug: program.slug, intakeTerm: "Fall 2027", intakeYear: 2027, openDate: "2027-03-01T00:00:00.000Z", deadlineDate: "2027-06-30T15:59:59.000Z", deadlineLabel: "Applications run March 1-June 30, 2027; the semester runs September 2027-January 2028.", applicationRound: "Fall 2027 Chinese Language Learning Program", ...sourceFields, sourceFieldLineage: { intakeTerm: "official Fall semester dates", intakeYear: "official page title and deadline", openDate: "official application dates", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official application and semester dates", applicationRound: "official program title and semester" } },
]);

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 120 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 49, schoolSlugs: [schoolSlug], newSchools: 1, programs: 2, programIntakes: 4, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "This source explicitly covers only the 2027 Chinese Language Learning Programs. Current 2027 bachelor, master's and doctoral catalogs, fees, deadlines and scholarships remain unresolved.",
    "The official source expresses duration as one or two semesters. durationMonths uses the page's March-July semester span as a five-month filtering normalization; the exact semester duration remains in the intake labels.",
    "No scholarship coverage or award rules are published on this page, so no scholarship record is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Staff telephone and email contacts printed on the page were excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-120");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 120, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
