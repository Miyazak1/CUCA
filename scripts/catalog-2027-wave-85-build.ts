import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "work/catalog-official/2026-10-20-sdufe-scholarships-pdf-2026";
const sourceId = "sdufe-international-student-scholarships-pdf-2026";
const expectedSha256 = "e7cbf1a8ce80c65af1ef8fc5d98611989f876af32072b55c8d45c233a63b9903";
const manifest = JSON.parse(await readFile(resolve(root, run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked SDUFE international scholarship evidence.");
const artifact = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error("SDUFE scholarship artifact hash mismatch.");
if (!artifact.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("SDUFE scholarship evidence is not a PDF.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "shandong-university-of-finance-and-economics");
const city = dependency.cities?.find((row) => row.slug === "jinan");
if (!school || !city) throw new Error("SDUFE dependency rows are missing.");
const sourceUrl = source.finalUrl ?? source.url;
const officialLinks = [
  { label: "Official scholarship table", url: sourceUrl, kind: "official-source" },
];
const commonMaterials = [
  { label: "SDUFE International Student Application Form" },
  { label: "Passport information page" },
  { label: "Passport photo", value: "2-inch, bareheaded, white background, JPG" },
  { label: "Official degree or diploma certificates" },
  { label: "Official academic transcripts" },
  { label: "Valid language proficiency certificate" },
  { label: "Resume", value: "Required for applicants who are not current graduates" },
  { label: "Two recommendation letters" },
  { label: "Personal statement and study plan" },
  { label: "Master's thesis or published academic papers", value: "Doctoral applicants only" },
];
const standardEligibility = [
  { label: "Citizenship", value: "Non-Chinese citizen" },
  { label: "Chinese-taught doctoral", value: "Master's degree and HSK 6 score 180 or above" },
  { label: "English-taught doctoral", value: "Master's degree and IELTS 6.5 or equivalent" },
  { label: "Chinese-taught master", value: "Bachelor's degree and HSK 5 score 210 or above" },
  { label: "English-taught master", value: "Bachelor's degree and IELTS 6.5 or equivalent" },
  { label: "Chinese-taught bachelor", value: "High-school diploma and HSK 5 score 180 or above" },
  { label: "English-taught bachelor", value: "High-school diploma and IELTS 6.0 or equivalent" },
];
const evidence = {
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  lastVerifiedAt: source.fetchedAt,
  verificationStatus: "verified" as const,
  status: "active" as const,
  providerLocation: "Jinan, Shandong, China",
  actionLinks: officialLinks,
};
const scholarships: CatalogSeedScholarship[] = [
  {
    ...evidence,
    slug: "sdufe-shandong-provincial-government-scholarship-international-students",
    schoolSlug: school.slug,
    title: "Shandong Provincial Government Scholarship for International Students at SDUFE",
    nameZh: "山东省政府外国留学生奖学金（山东财经大学）",
    type: "government",
    typeLabel: "Shandong Provincial Government Scholarship",
    providerNameEn: "Shandong Provincial Government / Shandong University of Finance and Economics",
    fundingLevel: "Full or partial",
    coverage: "Full award waives tuition, on-campus double-room accommodation, application and laboratory fees, and provides comprehensive medical insurance and a living allowance stated in the admission notice; a partial award covers one or more of those components.",
    applicableDegree: "Bachelor, Master, Doctoral, Non-degree",
    applicableProgram: "Prospective SDUFE international degree applicants and eligible partner-institution non-degree applicants",
    amountText: "Living allowance amount is stated individually in the admission notice; no universal amount is published in the table.",
    requirementText: "Applicants must satisfy the published degree, teaching-language and partner-institution conditions.",
    applicationRound: "Scholarship overview published April 15, 2026",
    benefitItems: [
      { label: "Tuition waiver", included: true }, { label: "On-campus double-room accommodation", included: true },
      { label: "Application and laboratory fees", included: true }, { label: "Comprehensive medical insurance", included: true },
      { label: "Living allowance", included: true, note: "Amount specified in the admission notice" },
    ],
    eligibilityItems: [...standardEligibility, { label: "Non-degree", value: "Current student or recent graduate within one year from an SDUFE partner institution" }],
    applicationMaterials: commonMaterials,
    applicationSteps: [{ label: "Apply", value: "Submit the international-student application through the SDUFE application system; the table publishes no separate scholarship deadline." }],
    summary: "Full or partial Shandong provincial funding for prospective SDUFE international students across degree and eligible non-degree routes.",
    sortOrder: 10,
    sourceFieldLineage: { title: "PDF page 1, table row 1", coverage: "PDF page 1, row 1 Details", applicableDegree: "PDF page 1, row 1 Award Scope", eligibilityItems: "PDF page 1, row 1 Eligibility", applicationMaterials: "PDF page 1, row 1 Required Documents" },
  },
  {
    ...evidence,
    slug: "sdufe-shandong-provincial-sister-cities-scholarship",
    schoolSlug: school.slug,
    title: "Shandong Provincial Government Scholarship for Foreign Students from International Sister Cities at SDUFE",
    nameZh: "山东省国际友城外国留学生奖学金（山东财经大学）",
    type: "government",
    typeLabel: "Shandong Provincial International Sister Cities Scholarship",
    providerNameEn: "Shandong Provincial Government / Shandong University of Finance and Economics",
    fundingLevel: "Full",
    coverage: "Tuition, application and laboratory fee waivers, on-campus double-room accommodation and comprehensive medical insurance.",
    applicableDegree: "Bachelor, Master, Doctoral, Non-degree",
    applicableProgram: "International students recommended by the Shandong Provincial Government through its international sister cities",
    amountText: "No cash allowance amount is published.",
    requirementText: "Applicants require a sister-city recommendation and must satisfy the applicable degree and language threshold.",
    applicationRound: "Scholarship overview published April 15, 2026",
    targetRegions: ["Shandong international sister cities"],
    benefitItems: [
      { label: "Tuition waiver", included: true }, { label: "Application and laboratory fees", included: true },
      { label: "On-campus double-room accommodation", included: true }, { label: "Comprehensive medical insurance", included: true },
    ],
    eligibilityItems: [...standardEligibility, { label: "Recommendation", value: "Recommended by Shandong Provincial Government through an international sister city" }, { label: "Non-degree", value: "Meet SDUFE's non-degree program eligibility criteria" }],
    applicationMaterials: commonMaterials,
    applicationSteps: [{ label: "Apply", value: "Obtain the required sister-city recommendation and submit the SDUFE international-student application; no fixed deadline is published in the table." }],
    summary: "Full tuition, housing, fee and insurance support for international students recommended through Shandong's sister cities.",
    sortOrder: 20,
    sourceFieldLineage: { title: "PDF page 1, table row 2", coverage: "PDF page 1, row 2 Details", applicableProgram: "PDF page 1, row 2 Award Scope", eligibilityItems: "PDF page 1, row 2 Eligibility", applicationMaterials: "PDF page 1, row 2 Required Documents" },
  },
  {
    ...evidence,
    slug: "sdufe-peiyou-merit-based-award",
    schoolSlug: school.slug,
    title: "SDUFE Peiyou Award (Merit-Based)",
    nameZh: "山东财经大学培优奖学金",
    type: "university",
    typeLabel: "SDUFE Peiyou Award",
    providerNameEn: "Shandong University of Finance and Economics",
    fundingLevel: "Full or tuition-only",
    coverage: "First prize waives tuition and on-campus double-room accommodation; second prize waives tuition. Application fee, insurance and any uncovered accommodation are paid by the student.",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Prospective SDUFE international degree applicants",
    amountText: "No cash award amount is published.",
    requirementText: "Applicants must meet the degree-specific teaching-language thresholds and published document requirements.",
    applicationRound: "Scholarship overview published April 15, 2026",
    benefitItems: [
      { label: "First prize tuition waiver", included: true }, { label: "First prize on-campus double-room accommodation", included: true },
      { label: "Second prize tuition waiver", included: true }, { label: "Application fee and insurance", included: false },
    ],
    eligibilityItems: [...standardEligibility.slice(0, 5), { label: "Chinese-taught bachelor", value: "High-school diploma and HSK 4 score 210 or above" }],
    applicationMaterials: [...commonMaterials.slice(0, 9), { label: "Financial guarantee proof" }, commonMaterials[9]],
    applicationSteps: [{ label: "Apply", value: "Submit the SDUFE international-student application; no separate award deadline is published in the table." }],
    summary: "Merit award offering either tuition plus accommodation or a tuition waiver for SDUFE international degree applicants.",
    sortOrder: 30,
    sourceFieldLineage: { title: "PDF page 1, table row 3", coverage: "PDF page 1, row 3 Details", applicableDegree: "PDF page 1, row 3 Award Scope", eligibilityItems: "PDF page 1, row 3 Eligibility", applicationMaterials: "PDF page 1, row 3 Required Documents" },
  },
  {
    ...evidence,
    slug: "sdufe-huawen-chinese-language-excellence-award",
    schoolSlug: school.slug,
    title: "SDUFE Huawen Award (Chinese Language Excellence)",
    nameZh: "山东财经大学华文奖学金（汉语学习优秀奖）",
    type: "university",
    typeLabel: "SDUFE Huawen Award",
    providerNameEn: "Shandong University of Finance and Economics",
    fundingLevel: "Not published",
    coverage: "Award scope and amount are not published in the overview.",
    applicableDegree: "Non-degree",
    applicableProgram: "Current SDUFE Chinese-language students",
    amountText: "Not published",
    requirementText: "Awarded annually based on academic performance; detailed guidelines are released before review.",
    applicationRound: "Annual review; exact dates not published",
    eligibilityItems: [{ label: "Enrollment", value: "Currently enrolled in an SDUFE Chinese-language program" }, { label: "Selection", value: "Academic performance" }],
    applicationSteps: [{ label: "Review", value: "Follow the separate guidelines released before the annual review." }],
    summary: "Annual academic-performance award for current SDUFE Chinese-language students; amount and review dates remain unpublished.",
    sortOrder: 40,
    sourceFieldLineage: { title: "PDF page 1, table row 4", applicableProgram: "PDF page 1, row 4 Award Scope", requirementText: "PDF page 1, row 4 Details" },
  },
  {
    ...evidence,
    slug: "sdufe-international-student-special-scholarship",
    schoolSlug: school.slug,
    title: "SDUFE International Student Special Scholarship",
    nameZh: "山东财经大学国际学生专项奖学金",
    type: "university",
    typeLabel: "SDUFE International Student Special Scholarship",
    providerNameEn: "Shandong University of Finance and Economics",
    fundingLevel: "Program-specific",
    coverage: "Defined by the applicable special international-student training program implementation plan.",
    applicableDegree: "Program-specific",
    applicableProgram: "Applicants to an SDUFE Special International Student Training Program",
    amountText: "Not published in the overview",
    requirementText: "Awarded under program-specific implementation plans; detailed guidelines are released before review.",
    applicationRound: "Program-specific review; exact dates not published",
    eligibilityItems: [{ label: "Program", value: "Applicant to an eligible Special International Student Training Program" }],
    applicationSteps: [{ label: "Review", value: "Follow the applicable program implementation plan and scholarship guidelines released before review." }],
    actionLinks: [...officialLinks, { label: "English-taught undergraduate special scholarship", url: "https://study.sdufe.edu.cn/info/1007/1054.htm", kind: "official-source" }],
    summary: "Program-specific SDUFE award whose amount, coverage and timing are governed by separate implementation plans.",
    sortOrder: 50,
    sourceFieldLineage: { title: "PDF page 1, table row 5", applicableProgram: "PDF page 1, row 5 Award Scope", coverage: "PDF page 1, row 5 Details" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 85 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256,
  publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlug: school.slug, refreshedScholarships: scholarships.length, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The overview does not publish a common application deadline for any of the five scholarship schemes.",
    "Huawen and Special Scholarship amounts, coverage and review calendars remain governed by later scheme-specific notices.",
    "The scholarship table was published on April 15, 2026 and does not establish a Fall 2027 intake.",
  ],
  notes: [
    "The official one-page scholarship table was text-extracted and visually checked after rendering.",
    "No applicant or other personal data is included; document labels describe public application requirements only.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-85");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 85, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
