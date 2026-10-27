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
  byteLength: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-27T03-49-41-928Z";
const sourceId = "tju-cgs-high-level-postgraduate-type-b-2027";
const expectedSha256 = "36a5e5c9ea928663a93338b79e3fae7226838fb88db7056fd0e8a43506326a28";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Tianjin University 2027 scholarship source.");
const evidence = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(evidence).digest("hex") !== expectedSha256) throw new Error("Tianjin University evidence hash mismatch.");
const visibleText = evidence.toString("utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();
for (const fragment of [
  "2027年天津大学中国政府奖学金高水平研究生项目招生简章（Type B）",
  "申请截止时间： 202 7年1月15日",
  "硕士研究生： 3,000 元 / 月",
  "博士研究生： 3,500 元 / 月",
  "所有硕士和博士专业",
  "入学报到时间： 202 7年 8 月底 -9 月初",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected Tianjin University evidence fragment missing: ${fragment}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "tianjin");
const baseSchool = prior.schools?.find((row) => row.slug === "tianjin-university");
if (!city || !baseSchool) throw new Error("Tianjin University release-candidate dependencies are missing.");
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const school = {
  ...baseSchool,
  deadlineSummary: "2027 undergraduate, master's and doctoral applications close May 31, 2027; undergraduate scholarship applicants are requested to apply by April 1, 2027. The Chinese Government Scholarship High-Level Postgraduate Type B route closes January 15, 2027.",
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "2027 Chinese Government Scholarship High-Level Postgraduate Type B route for all master's and doctoral majors"])],
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    deadlineSummary: "official 2027 degree guides plus official Type B scholarship deadline",
    campusHighlights: "official 2027 Type B scholarship scope",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "tianjin-university-cgs-high-level-postgraduate-type-b-2027",
  title: "Tianjin University 2027 Chinese Government Scholarship High-Level Postgraduate Program (Type B)",
  nameZh: "天津大学2027年中国政府奖学金高水平研究生项目（B类）",
  type: "government",
  typeLabel: "Chinese Government Scholarship - High-Level Postgraduate Program Type B",
  providerName: "中国国家留学基金管理委员会 / 天津大学",
  providerNameEn: "China Scholarship Council / Tianjin University",
  providerLocation: "Tianjin, China",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition waiver, on-campus accommodation, monthly living allowance, and comprehensive medical insurance.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "All master's and doctoral majors published by Tianjin University for 2027.",
  amountText: "Monthly living allowance: CNY 3,000 for master's students and CNY 3,500 for doctoral students.",
  requirementText: "Applicants must be non-Chinese citizens. Master's applicants need a bachelor's degree and must be no older than 35; doctoral applicants need a master's degree and must be no older than 40. Chinese-taught study requires HSK Level 5 score 180 or above, subject to the published exemption. English-taught study requires IELTS 6.0 or TOEFL 80 or above, subject to the published exemptions and the higher English MBA threshold.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Tuition waiver" },
    { label: "Accommodation", included: true, note: "On-campus accommodation" },
    { label: "Living allowance", included: true, note: "CNY 3,000/month for master's; CNY 3,500/month for doctoral" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
  ],
  eligibilityItems: [
    { label: "Master's", value: "Bachelor's degree; no older than 35" },
    { label: "Doctoral", value: "Master's degree; no older than 40" },
    { label: "Chinese-taught", value: "HSK Level 5 score 180 or above, subject to the official exemption" },
    { label: "English-taught", value: "IELTS 6.0 or TOEFL 80 or above, subject to the official exemptions" },
    { label: "English MBA", value: "Supervisor acceptance letter, IELTS 6.5 or TOEFL 85, GPA above 3.2/4.0, and more than one year of relevant work experience; fresh graduates are ineligible" },
  ],
  applicationMaterials: [
    { label: "Academic records", value: "Degree certificates and complete transcripts from the undergraduate stage onward" },
    { label: "Identity", value: "Passport home page meeting the published validity requirement" },
    { label: "Language", value: "Chinese- or English-proficiency evidence for the selected route" },
    { label: "Academic plan", value: "Study and research plan of at least 1,000 Chinese characters or English words" },
    { label: "Recommendations", value: "Two letters from associate professors or professors" },
    { label: "Health and conduct", value: "Foreigner Physical Examination Form and a recent non-criminal record" },
    { label: "Research evidence", value: "Published-paper evidence is optional for master's applicants and required for doctoral applicants" },
  ],
  applicationSteps: [
    { label: "Step 1", body: "Apply in the Chinese Government Scholarship system as Type B using Tianjin University agency code 10056." },
    { label: "Step 2", body: "Upload the scholarship form and required materials to the Tianjin University international student service platform." },
    { label: "Step 3", body: "Complete university document review and interview, then await the China Scholarship Council's final result." },
  ],
  actionLinks: [
    { label: "Official Tianjin University guide", url: source.finalUrl ?? source.url, kind: "official-source" },
    { label: "Tianjin University application system", url: "https://tju.at0086.cn/student", kind: "application" },
  ],
  deadlineDate: "2027-01-15",
  deadlineLabel: "January 15, 2027",
  applicationRound: "2027 Chinese Government Scholarship High-Level Postgraduate Program Type B",
  benefits: ["Tuition waiver", "On-campus accommodation", "Monthly stipend", "Comprehensive medical insurance"],
  tags: ["Chinese Government Scholarship", "Master", "Doctoral", "Type B"],
  summary: "Full 2027 Chinese Government Scholarship route covering all Tianjin University master's and doctoral majors, with an August-to-early-September 2027 registration window.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official guide title",
    fundingLevel: "official scholarship content and standards",
    coverage: "official scholarship content and standards",
    applicableDegree: "official student categories",
    applicableProgram: "official statement that all master's and doctoral majors are eligible",
    amountText: "official stipend standards",
    requirementText: "official eligibility and language sections",
    benefitItems: "official scholarship content and standards",
    eligibilityItems: "official eligibility section",
    applicationMaterials: "official materials section; applicant and staff PII excluded",
    applicationSteps: "official application and admission process",
    deadlineDate: "official application deadline",
    deadlineLabel: "official application deadline",
    applicationRound: "official scholarship title",
    summary: "official scope, coverage, and registration schedule",
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
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 20, schoolSlugs: [school.slug], newSchools: 0, programs: 0, programIntakes: 0, scholarships: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, byteLength: source.byteLength, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  dependencies: { existing2027DegreeRoutes: "seeds/catalog.2027-release-candidate.draft.json" },
  unresolved: [
    "This wave adds scholarship policy to the separately captured 2027 Tianjin University degree catalog; it does not duplicate the existing 324 degree routes.",
    "The official guide states that all master's and doctoral majors are eligible but does not provide a scholarship-specific program table.",
    "No travel allowance or other benefit beyond the four published coverage categories is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Named staff contacts, email addresses, telephone numbers, applicant data, and personal document contents are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-209");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 209, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
