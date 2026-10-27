import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type ExtractedProgram = { sourceId: string; sourceRecordId: string; sourceUrl: string; sourceLabel: string; sourceSha256: string; capturedAt: string; departmentEn: string; collegeEn: string; nameEn: string; nameZh: string };

const root = process.cwd();
const currentRunName = "2026-10-27T05-48-55-109Z";
const programsRunName = "2026-10-27T05-50-12-511Z";
const loadManifest = async (runName: string) => JSON.parse(await readFile(resolve(root, "work/catalog-official", runName, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const currentManifest = await loadManifest(currentRunName);
const programsManifest = await loadManifest(programsRunName);
const extracted = JSON.parse(await readFile(resolve(root, "catalog-sources/sustech-current-programs.extracted.json"), "utf8")) as { schoolSlug: string; sourceRun: string; programs: ExtractedProgram[] };
if (extracted.schoolSlug !== "southern-university-of-science-and-technology" || extracted.sourceRun !== programsRunName || extracted.programs.length !== 35) throw new Error("Unexpected SUSTech extraction scope.");

const verifySource = async (runName: string, manifest: { sources: ManifestSource[] }, id: string, sha256?: string) => {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && (!sha256 || row.sha256 === sha256));
  if (!source) throw new Error(`Missing locked SUSTech source: ${id}`);
  const bytes = await readFile(resolve(root, "work/catalog-official", runName, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`SUSTech evidence hash mismatch: ${id}`);
  return source;
};

const overview = await verifySource(currentRunName, currentManifest, "sustech-international-students-overview", "b95ce0693d3ac478001aad2dfd458bd929de70361ca9def757f2539be16e6c98");
const requirements = await verifySource(currentRunName, currentManifest, "sustech-current-undergraduate-requirements", "d78cfa6e53d7b2e8bd75b16f59a3a549cb6a0053857da00dd7f4511cc2bdc259");
const programPage = await verifySource(currentRunName, currentManifest, "sustech-current-undergraduate-programs", "a5d0df724e32c00da4881c567349b961e0796c9ab6419d8fa62c7d125df23473");
const scholarshipSource = await verifySource(currentRunName, currentManifest, "sustech-undergraduate-scholarships-api", "4450a614fcb7df3f734e5d9da9f14811379f0e77248c621a99d406691ed092ff");
const costSource = await verifySource(currentRunName, currentManifest, "sustech-undergraduate-cost-api", "307a1375a21179e63c6a94128ee9ff551a962be8add7cda6c7f553f5d6738753");
for (const row of extracted.programs) await verifySource(programsRunName, programsManifest, row.sourceId, row.sourceSha256);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-87.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "shenzhen");
const priorSchool = prior.schools?.find((row) => row.slug === extracted.schoolSlug);
if (!city || !priorSchool) throw new Error("Wave 87 SUSTech dependencies are missing.");
const schoolBase = { ...priorSchool };
delete schoolBase.cscaRequired;
delete schoolBase.cscaRequirement;
delete schoolBase.cscaSubjects;
delete schoolBase.hskRequirement;
delete schoolBase.englishRequirement;
const costFields = { sourceUrl: costSource.finalUrl ?? costSource.url, sourceLabel: costSource.label, sourceSha256: costSource.sha256, capturedAt: costSource.fetchedAt };
const school = {
  ...schoolBase,
  applicationLevel: "Current official international pages publish undergraduate programs, costs and scholarships; previously captured official material also establishes postgraduate routes.",
  languageRequirement: "The current undergraduate requirements are dynamically populated. No requirement value is asserted from an uncollected POST response, and the prior 'no CSCA' statement has been removed.",
  deadlineSummary: "No auditable explicit 2027 undergraduate application window or deadline is present in the collected official GET sources.",
  tuitionSummary: "Current international undergraduate tuition is CNY 30,000/year. The official cost table estimates total annual cost at about CNY 68,000, including CNY 7,200/year dormitory, CNY 800/year insurance, CNY 600 residence permit, CNY 600 health check, and about CNY 2,500/month for food, books and miscellaneous expenses.",
  admissionsUrl: requirements.finalUrl ?? requirements.url,
  subjectTags: [...new Set(extracted.programs.map((row) => row.nameEn))],
  tuitionBandLabel: "CNY 30,000/year undergraduate tuition; about CNY 68,000/year total",
  campusHighlights: [...new Set([...(priorSchool.campusHighlights ?? []), "35 distinct current official undergraduate API records across 21 departments"])],
  contactNotes: "The current official program APIs expose 35 records while the rendered overview says 34 majors. Two Industrial Design records belong to different departments and remain separate pending review.",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: costSource.fetchedAt,
  ...costFields,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: `current official overview snapshot ${overview.sha256} plus retained previously captured postgraduate scope`,
    languageRequirement: `current requirements shell snapshot ${requirements.sha256}; dynamic POST content intentionally not collected`,
    deadlineSummary: "explicitly unresolved in collected official GET sources; no third-party date used",
    tuitionSummary: `official undergraduate cost API snapshot ${costSource.sha256}`,
    admissionsUrl: "current official undergraduate requirements page",
    subjectTags: "35 distinct current official program API records",
    tuitionBandLabel: `official undergraduate cost API snapshot ${costSource.sha256}`,
    campusHighlights: `official API record count; rendered page snapshot ${programPage.sha256} says 34 majors`,
    contactNotes: "explicit source-count conflict retained for editorial review",
  },
};

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = extracted.programs.map((row) => ({
  slug: `southern-university-of-science-and-technology-current-${slugify(row.nameEn)}-${row.sourceRecordId.slice(0, 8)}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: row.nameEn,
  nameZh: row.nameZh,
  degreeLevel: "Bachelor",
  fieldCategory: row.collegeEn,
  subjectArea: row.departmentEn,
  teachingLanguage: "English",
  tuitionAmount: 30000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 30,000/year in the current official international undergraduate cost table.",
  scholarshipText: "Current undergraduate funding includes the President Scholarship, Tuition Waiver Scholarship, Chinese Government Scholarship and Guangdong Provincial Excellent International Student Scholarship; no 2027 deadline is inferred.",
  applicationUrl: requirements.finalUrl ?? requirements.url,
  applicationNote: "Current official undergraduate program record. The collected sources do not identify a 2027 intake window or deadline.",
  hasScholarship: true,
  badgeText: "Current official undergraduate route",
  displayTuition: "CNY 30,000/year",
  displaySubjects: [row.nameEn, row.departmentEn],
  displayGroup: "Bachelor",
  displayGroupLabel: "Undergraduate programs",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: row.capturedAt,
  sourceUrl: row.sourceUrl,
  sourceLabel: row.sourceLabel,
  sourceSha256: row.sourceSha256,
  capturedAt: row.capturedAt,
  sourceFieldLineage: {
    nameEn: `official program API record ${row.sourceRecordId}`,
    nameZh: `official program API record ${row.sourceRecordId}`,
    degreeLevel: `current official international undergraduate program context, page snapshot ${programPage.sha256}`,
    fieldCategory: "official department-to-college API relationship",
    subjectArea: "official program-to-department API relationship",
    teachingLanguage: `official international undergraduate overview snapshot ${overview.sha256}`,
    tuitionAmount: `official cost API snapshot ${costSource.sha256}`,
    tuitionPeriod: `official cost API snapshot ${costSource.sha256}`,
    tuitionText: `official cost API snapshot ${costSource.sha256}`,
    scholarshipText: `official undergraduate scholarship API snapshot ${scholarshipSource.sha256}`,
    applicationUrl: "current official undergraduate requirements page",
    applicationNote: "2027 intake and deadline explicitly unresolved",
  },
}));

const scholarshipFields = { sourceUrl: scholarshipSource.finalUrl ?? scholarshipSource.url, sourceLabel: scholarshipSource.label, sourceSha256: scholarshipSource.sha256, capturedAt: scholarshipSource.fetchedAt };
const scholarshipBase = {
  schoolSlug: school.slug,
  type: "university_or_government",
  typeLabel: "Undergraduate scholarship",
  providerName: "Southern University of Science and Technology",
  providerNameEn: "Southern University of Science and Technology",
  providerLocation: "Shenzhen, Guangdong",
  applicableDegree: "Bachelor",
  deadlineLabel: "No cycle-specific 2027 deadline is published in the collected official source.",
  tags: ["Undergraduate", "Current official source", "2027 deadline unresolved"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: scholarshipSource.fetchedAt,
  ...scholarshipFields,
};
const scholarships: CatalogSeedScholarship[] = [
  {
    ...scholarshipBase,
    slug: "sustech-president-scholarship-current",
    title: "SUSTech President Scholarship",
    fundingLevel: "Full annual support",
    coverage: "Tuition, accommodation, insurance and living expenses, subject to continued eligibility.",
    amountText: "CNY 68,000 per year for the four-year undergraduate program.",
    requirementText: "Successful completion of the SUSTech online test and interview; eligible offer holders are automatically considered and no separate application is required.",
    benefits: ["CNY 68,000 per year", "Tuition", "Accommodation", "Insurance", "Living expenses"],
    summary: "Current undergraduate award with automatic consideration after the required online test and interview; continued eligibility applies.",
    sortOrder: 10,
  },
  {
    ...scholarshipBase,
    slug: "sustech-tuition-waiver-scholarship-current",
    title: "SUSTech Tuition Waiver Scholarship",
    fundingLevel: "Tuition support",
    coverage: "Tuition support.",
    amountText: "CNY 30,000 per year toward tuition.",
    requirementText: "Successful completion of the SUSTech online test and interview; eligible offer holders are automatically considered and no separate application is required.",
    benefits: ["CNY 30,000 per year toward tuition"],
    summary: "Current undergraduate tuition award with automatic consideration after the required online test and interview.",
    sortOrder: 20,
  },
  {
    ...scholarshipBase,
    slug: "sustech-chinese-government-scholarship-current",
    title: "Chinese Government Scholarship at SUSTech",
    fundingLevel: "Tuition, stipend, housing and insurance",
    coverage: "Tuition, monthly stipend, annual housing allowance and insurance.",
    amountText: "CNY 30,000/year tuition, CNY 2,500/month stipend, CNY 7,200/year housing and CNY 800/year insurance.",
    requirementText: "Applicants are advised to obtain a SUSTech offer before applying through the Chinese embassy or consulate in their home country and must confirm that channel's route and deadline.",
    benefits: ["CNY 30,000/year tuition", "CNY 2,500/month stipend", "CNY 7,200/year housing", "CNY 800/year insurance"],
    summary: "Current undergraduate government scholarship channel; the relevant embassy or consulate controls the application route and deadline.",
    sortOrder: 30,
  },
  {
    ...scholarshipBase,
    slug: "sustech-guangdong-provincial-excellent-international-student-scholarship-current",
    title: "Guangdong Provincial Excellent International Student Scholarship",
    fundingLevel: "One-year award",
    coverage: "One-year cash award.",
    amountText: "CNY 10,000 for one year.",
    requirementText: "First-year students are included in the candidate pool by default; further instructions follow the SUSTech admission offer.",
    benefits: ["CNY 10,000 for one year"],
    summary: "Current provincial award for undergraduate students; first-year students enter the candidate pool by default.",
    sortOrder: 40,
  },
].map((row) => ({
  ...row,
  sourceFieldLineage: {
    title: "official current undergraduate scholarship comparison",
    fundingLevel: "official current undergraduate scholarship comparison",
    coverage: "official current undergraduate scholarship comparison",
    amountText: "official current undergraduate scholarship comparison",
    requirementText: "official current eligibility and application column",
    deadlineLabel: "explicitly unresolved; no 2027 date inferred",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: costSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Wave 218 validation failed:\n${validation.errors.join("\n")}`);
const usedProgramSourceIds = [...new Set(extracted.programs.map((row) => row.sourceId))];
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: costSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: scholarships.length },
  evidence: [overview, requirements, programPage, scholarshipSource, costSource, ...usedProgramSourceIds.map((id) => programsManifest.sources.find((row) => row.id === id)!)].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: [
    "The collected official GET sources do not publish an explicit 2027 undergraduate application window or deadline. No third-party date is used and no intake entity is created.",
    "The current requirements and admission-process shells load material through POST endpoints. No POST/form submission was performed, so dynamic CSCA and language-requirement values are not asserted in this candidate.",
    "The official program APIs expose 35 distinct records, while the rendered page introduction says 34 majors. Two Industrial Design records have distinct source IDs and department relationships; both remain separate pending review.",
    "Scholarship terms are current and undergraduate-specific but not cycle-labeled. All four records remain draft and no 2027 scholarship deadline is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No forms were submitted. Staff contacts, applicant data and personal identifiers are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-218");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 218, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
