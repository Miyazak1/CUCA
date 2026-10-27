import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

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
const runRoot = resolve(root, "work/catalog-official/hohai-cgs-english-2027-2028-2026-10-27-network");
const locks = [
  ["hohai-cgs-high-level-graduate-english-2027-2028", "ffdda4bd5381369fd8c4999e9001315ff5ebc870cb10890211a469ddbb5ba16f"],
  ["hohai-cgs-high-level-graduate-guide-pdf-english-2027-2028", "6a90dd74698981094145b0c40fed98f67f0c83ec1cb49f269cf0f9005ce0f94b"],
] as const;
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked official evidence ${id} at ${sha256}.`);
  const actual = createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const page = sources.get("hohai-cgs-high-level-graduate-english-2027-2028")!;
const pdf = sources.get("hohai-cgs-high-level-graduate-guide-pdf-english-2027-2028")!;
const sourceFields = {
  sourceUrl: pdf.finalUrl ?? pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: pdf.fetchedAt,
};

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-127.draft.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "hohai-university";
if (prior.schools?.length !== 1 || prior.schools[0]?.slug !== schoolSlug || prior.programs?.length !== 45 || prior.programIntakes?.length !== 45) {
  throw new Error("Wave 245 requires the complete Wave 127 Hohai University candidate.");
}

const school = {
  ...prior.schools[0],
  applicationLevel: "Master and PhD; 45 English-taught 2027 graduate routes and their 2027/2028 High-level Graduate scholarship route are published",
  deadlineSummary: "The 2027/2028 Chinese Government Scholarship High-level Graduate application closes February 19, 2027 Beijing time. A general self-funded 2027 deadline is not published in the captured sources.",
  tuitionSummary: "The 2027/2028 High-level Graduate scholarship covers tuition, on-campus accommodation, living allowance and comprehensive medical insurance. General self-funded tuition is not published in the captured 2027 sources.",
  admissionsUrl: page.finalUrl ?? page.url,
  campusHighlights: [
    "45 official English-taught graduate routes for 2027",
    "Full 2027/2028 Chinese Government Scholarship High-level Graduate coverage",
    "Water resources and hydraulic engineering focus",
  ],
  lastVerifiedAt: pdf.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(prior.schools[0].sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 route lists and 2027/2028 scholarship guide",
    deadlineSummary: "official 2027/2028 scholarship Application Period; self-funded limitation retained",
    tuitionSummary: "official scholarship coverage; self-funded limitation retained",
    admissionsUrl: "official English 2027/2028 scholarship page",
    campusHighlights: "official 2027 route lists and scholarship guide",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "hohai-university-cgs-high-level-graduate-2027-2028",
  title: "2027/2028 Chinese Government Scholarship High-level Graduate Student Program at Hohai University",
  nameZh: "河海大学2027/2028学年中国政府奖学金高水平研究生项目",
  schoolSlug,
  type: "government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "国家留学基金管理委员会 / 河海大学",
  providerNameEn: "China Scholarship Council / Hohai University",
  providerLocation: "Nanjing, Jiangsu, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition fees, on-campus accommodation, living allowance and comprehensive medical insurance premiums are covered. The official guide does not publish monetary allowance amounts.",
  applicableDegree: "Master; Doctoral",
  applicableProgram: "The 25 English-taught master's and 20 English-taught doctoral programs in Hohai University's official 2027 lists linked by the guide.",
  requirementText: "Non-Chinese citizens in good physical and mental health. Master's applicants need a bachelor's degree or equivalent, strong academic performance and must generally be under 35; doctoral applicants need a master's degree or equivalent, strong academic performance and must generally be under 40. Non-native English speakers must provide an English proficiency certificate such as IELTS or TOEFL.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "On-campus accommodation covered" },
    { label: "Living allowance", included: true, note: "Covered; amount not published in the guide" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance covered" },
  ],
  eligibilityItems: [
    { label: "Nationality and health", value: "Citizen of a country other than China and in good physical and mental health" },
    { label: "Master's applicant", value: "Bachelor's degree or equivalent, strong academic performance, generally under age 35" },
    { label: "Doctoral applicant", value: "Master's degree or equivalent, strong academic performance, generally under age 40" },
    { label: "English evidence", value: "Non-native English speakers provide an English proficiency certificate such as IELTS or TOEFL; no minimum score is stated in this guide" },
  ],
  applicationMaterials: [
    { label: "Identity and academic records", value: "Passport, notarized highest diploma and academic transcripts from undergraduate study onward" },
    { label: "Academic application", value: "Language certificate, study plan of more than 1,000 characters or words signed by a qualified Hohai supervisor, two professor or associate-professor recommendations and a supervisor pre-acceptance letter" },
    { label: "Compliance documents", value: "Foreigner Physical Examination Form, non-criminal record, curriculum vitae, relevant China visa or residence records, signed personal commitment and CSC application form" },
    { label: "Research output", value: "Catalogue and abstract of published papers, if any" },
  ],
  applicationSteps: [
    { label: "University application", value: "Submit the online Hohai University application and the published materials by February 19, 2027 Beijing time; the guide states a non-refundable CNY 400 application fee" },
    { label: "University review", value: "The International School, relevant college and university experts conduct staged review and interview, with pre-admission targeted before March 20, 2027" },
    { label: "CSC application", value: "Recommended applicants submit the CSC Type B application with Hohai University agency number 10294 before March 25, 2027" },
  ],
  actionLinks: [
    { label: "Official English scholarship page", url: page.finalUrl ?? page.url, kind: "official-source" },
    { label: "Official English scholarship PDF", url: pdf.finalUrl ?? pdf.url, kind: "official-source" },
  ],
  deadlineDate: "2027-02-19",
  deadlineLabel: "February 19, 2027 Beijing time for the Hohai University application; recommended candidates complete the CSC application before March 25, 2027.",
  applicationRound: "2027/2028 Chinese Government Scholarship High-level Graduate Student Program",
  summary: "Full Chinese Government Scholarship route for eligible applicants to Hohai University's published 2027 English-taught master's and doctoral programs.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: pdf.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official English guide title",
    typeLabel: "official CSC application procedure",
    coverage: "official About the program section",
    applicableDegree: "official Application Requirements and Majors and Disciplines sections",
    applicableProgram: "official guide links to the captured 2027 English-taught master and doctoral lists",
    requirementText: "official Application Requirements and Application Documents sections",
    benefitItems: "official About the program section",
    eligibilityItems: "official Application Requirements and Application Documents sections",
    applicationMaterials: "official Application Documents section; personal contact details excluded",
    applicationSteps: "official Application Procedures section",
    actionLinks: "captured official English page and embedded PDF",
    deadlineDate: "official Application Period section",
    deadlineLabel: "official Application Period and Application Procedures sections",
    applicationRound: "official guide title",
    summary: "official program scope and coverage",
  },
};

const programs = (prior.programs ?? []).map((program) => ({
  ...program,
  hasScholarship: true,
  scholarshipText: "This program appears in the official 2027 English-taught graduate list linked by the 2027/2028 Chinese Government Scholarship High-level Graduate guide.",
  sourceFieldLineage: {
    ...(program.sourceFieldLineage ?? {}),
    hasScholarship: "official 2027/2028 scholarship guide Majors and Disciplines section",
    scholarshipText: "official scholarship guide plus captured 2027 English-taught route list",
  },
}));

const candidate: CatalogSeedBundle = {
  ...prior,
  generatedAt: pdf.fetchedAt,
  schools: [school],
  programs,
  scholarships: [scholarship],
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 245 validation failed:\n${validation.errors.join("\n")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 50, schoolSlugs: [schoolSlug], programs: 45, programIntakes: 45, scholarships: 1 },
  evidence: locks.map(([id]) => {
    const source = sources.get(id)!;
    return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
  }),
  unresolved: [
    "The scholarship guide does not publish monetary living-allowance amounts, so no amount is inferred.",
    "The guide requests an English proficiency certificate such as IELTS or TOEFL but publishes no minimum score; no threshold is inferred.",
    "The scholarship deadline is not generalized to self-funded admission. A general self-funded 2027 deadline and self-funded tuition remain absent.",
    "The current official international index exposes no 2027 undergraduate catalog.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Public staff contacts and applicant document contents are excluded; only institutional procedures are structured." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-245");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 245, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
