import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
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
const run = "2026-10-27T05-01-31-768Z";
const sourceId = "fjnu-cgs-high-level-graduate-guide-2027";
const expectedSha256 = "9853b47b6a6c9bfc9e6322eac391305fac68dbe95f53c2e295e82660a0dcc0cd";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Fujian Normal University 2027 scholarship source.");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== expectedSha256) {
  throw new Error("Fujian Normal University 2027 scholarship evidence hash mismatch.");
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-143.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "fuzhou");
const baseSchool = prior.schools?.find((row) => row.slug === "fujian-normal-university");
if (!city || !baseSchool) throw new Error("Wave 143 Fujian Normal University dependencies are missing.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  ...baseSchool,
  applicationLevel: "Official 2027 long-term Chinese-language study plus the 2027 Chinese Government Scholarship High-Level Graduate route for master's and doctoral applicants. A complete self-funded 2027 degree catalog remains unpublished.",
  languageOfInstruction: "Chinese or English for the 2027 scholarship route; Chinese for the separately published 2027 long-term language route.",
  languageRequirement: "Chinese-taught scholarship applicants need HSK Level 5 with at least 180. English-taught applicants need IELTS or TOEFL unless English is a native or official language or their prior degree was taught in English.",
  hskRequirement: "HSK Level 5 with at least 180 for Chinese-taught 2027 scholarship study.",
  deadlineSummary: "The 2027 Chinese Government Scholarship High-Level Graduate route closes January 8, 2027. The separate language route has March and September 2027 entries.",
  tuitionSummary: "The 2027 High-Level Graduate scholarship covers tuition, on-campus accommodation, comprehensive medical insurance and a monthly stipend. Self-funded degree tuition is not published in this guide.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "2027 Chinese Government Scholarship graduate route"])],
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 scholarship category plus prior official 2027 language guide",
    languageOfInstruction: "official scholarship language requirements plus prior language guide",
    languageRequirement: "official scholarship eligibility",
    hskRequirement: "official scholarship eligibility",
    deadlineSummary: "official scholarship deadline plus prior language-route dates",
    tuitionSummary: "official scholarship coverage; explicit self-funded limitation",
    admissionsUrl: "registered official 2027 scholarship guide",
    campusHighlights: "official 2027 scholarship scope",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "fujian-normal-university-cgs-high-level-graduate-2027",
  schoolSlug: school.slug,
  title: "2027 Chinese Government Scholarship High-Level Graduate Program at Fujian Normal University",
  nameZh: "2027年福建师范大学中国政府奖学金高水平研究生项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "国家留学基金管理委员会 / 福建师范大学",
  providerNameEn: "China Scholarship Council / Fujian Normal University",
  providerLocation: "Fuzhou, Fujian, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and a monthly stipend are covered.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Chinese-taught and English-taught master's and doctoral programs listed in the CSC system; the university page does not publish a standalone program catalog.",
  amountText: "Monthly stipend: CNY 3,000 for master's students and CNY 3,500 for doctoral students.",
  requirementText: "Applicants must be non-Chinese citizens in good health, have no criminal record and show strong academic performance. Master's applicants need a bachelor's degree and must be no older than 35; doctoral applicants need a master's degree and must be no older than 40. Chinese-taught applicants need HSK Level 5 with at least 180. English-taught applicants need IELTS or TOEFL unless the published exemption applies.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Full coverage" },
    { label: "Accommodation", included: true, note: "On-campus accommodation" },
    { label: "Living allowance", included: true, note: "Master CNY 3,000/month; doctoral CNY 3,500/month" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
  ],
  eligibilityItems: [
    { label: "Master's applicant", value: "Bachelor's degree, strong academic record, no older than 35" },
    { label: "Doctoral applicant", value: "Master's degree, strong academic record, no older than 40" },
    { label: "Chinese-taught route", value: "Valid HSK Level 5 score of at least 180" },
    { label: "English-taught route", value: "IELTS or TOEFL; exempt when English is a native or official language or the prior degree was taught in English" },
  ],
  applicationMaterials: [
    { label: "CSC application", value: "Complete the CSC online application under Type B using Fujian Normal University agency number 10394" },
    { label: "Interview", value: "Applicants who pass the document review proceed to an interview assessing overall quality and language ability" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Submit the CSC Type B application and download the generated application form" },
    { label: "Step 2", value: "Fujian Normal University reviews the submitted materials and invites eligible applicants to interview" },
    { label: "Step 3", value: "Recommended applicants receive a pre-admission notice and upload it to the CSC system" },
    { label: "Step 4", value: "Final admission is subject to CSC expert review" },
  ],
  actionLinks: [{ label: "Official 2027 scholarship guide", url: source.finalUrl ?? source.url, kind: "official-source" }],
  deadlineDate: "2027-01-08",
  deadlineLabel: "Application deadline: January 8, 2027.",
  applicationRound: "2027 Chinese Government Scholarship High-Level Graduate Program",
  summary: "Full Type B scholarship for eligible master's and doctoral applicants, with Chinese- and English-taught routes subject to published language requirements.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official bilingual guide title",
    typeLabel: "official CSC Type B application procedure",
    coverage: "official scholarship content section",
    applicableDegree: "official supported-student categories",
    applicableProgram: "official instruction to use the CSC system; explicit catalog limitation",
    amountText: "official scholarship content section",
    requirementText: "official eligibility section",
    benefitItems: "official scholarship content section",
    eligibilityItems: "official eligibility section",
    applicationMaterials: "official application and review procedure; personal contact details excluded",
    applicationSteps: "official application and admission procedure",
    actionLinks: "registered official university source",
    deadlineDate: "official January 8, 2027 deadline",
    deadlineLabel: "official deadline",
    applicationRound: "official guide title",
    summary: "official scope, coverage and language requirements",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [scholarship],
};
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 90,
    schoolSlugs: [school.slug],
    newSchools: 0,
    programs: 0,
    programIntakes: 0,
    scholarships: 1,
  },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The official university page directs applicants to the CSC system for the program list and teaching language, so no degree program is inferred or duplicated in this wave.",
    "The guide publishes no self-funded 2027 degree tuition, general degree application window or standalone program catalog; those fields remain absent.",
    "The English-language requirement names IELTS or TOEFL but publishes no numeric threshold; no score is inferred.",
  ],
  sensitiveDataCheck: {
    result: "pass",
    note: "Personal staff names, telephone and email details are excluded. No applicant data is present.",
  },
};

const stem = resolve(root, "seeds/catalog.2027-wave-212");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 212, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
