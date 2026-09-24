import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T12-39-06-548Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.shenzhen-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.hitsz-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.hitsz-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>((manifest.sources as SourceRecord[]).map((row) => [row.id, row]));
const expected = {
  "hitsz-international-undergraduate-prospectus-page-2026": "a46dd3133d5742e97017dff4794c950c317e07cd6ebab751ea8e037bea6b620c",
  "hitsz-international-undergraduate-prospectus-pdf-2026": "b611b98782b8717c854fc9b29d9ecee71ef0f7741d30621cfab2cedbb13effc5",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`HITSZ evidence mismatch: ${id}`);
}
const page = sources.get("hitsz-international-undergraduate-prospectus-page-2026")!;
const pdf = sources.get("hitsz-international-undergraduate-prospectus-pdf-2026")!;
const schoolSlug = "harbin-institute-of-technology-shenzhen";
const citySlug = "shenzhen";

type ProgramSpec = { slug: string; nameEn: string; durationYears: number; group: "engineering" | "mathematics"; category: string };
const specs: ProgramSpec[] = [
  { slug: `${schoolSlug}-computer-science-and-technology`, nameEn: "Computer Science and Technology", durationYears: 4, group: "engineering", category: "Computer Science" },
  { slug: `${schoolSlug}-optoelectronic-information-science-and-engineering`, nameEn: "Optoelectronic Information Science and Engineering", durationYears: 4, group: "engineering", category: "Optoelectronic Engineering" },
  { slug: `${schoolSlug}-mechanical-design-manufacturing-and-automation`, nameEn: "Mechanical Design, Manufacturing and Automation", durationYears: 4, group: "engineering", category: "Mechanical Engineering" },
  { slug: `${schoolSlug}-energy-and-power-engineering`, nameEn: "Energy and Power Engineering", durationYears: 4, group: "engineering", category: "Energy Engineering" },
  { slug: `${schoolSlug}-civil-engineering`, nameEn: "Civil Engineering", durationYears: 4, group: "engineering", category: "Civil Engineering" },
  { slug: `${schoolSlug}-business-administration`, nameEn: "Business Administration", durationYears: 4, group: "mathematics", category: "Business Administration" },
  { slug: `${schoolSlug}-economics`, nameEn: "Economics", durationYears: 4, group: "mathematics", category: "Economics" },
  { slug: `${schoolSlug}-architecture`, nameEn: "Architecture", durationYears: 5, group: "mathematics", category: "Architecture" },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const engineering = spec.group === "engineering";
  return {
    slug: spec.slug,
    schoolSlug,
    citySlug,
    nameEn: spec.nameEn,
    degreeLevel: "Undergraduate",
    durationYears: spec.durationYears,
    fieldCategory: spec.category,
    subjectArea: spec.category,
    teachingLanguage: "English",
    cscaSubjects: engineering ? ["Mathematics (English)", "Physics (English)"] : ["Mathematics (English)"],
    cscaRequirement: engineering
      ? "Submit CSCA Mathematics (English) and Physics (English) results; the university entrance exam also covers Mathematics and Physics."
      : "Submit a CSCA Mathematics (English) result; the university entrance exam covers Mathematics.",
    englishRequirement: "TOEFL 80, IELTS 6.0 with no sub-test below 5.5, or Duolingo English Test 115; an English-medium prior degree certificate may substitute, and native English speakers are exempt.",
    tuitionAmount: 30000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 30,000/year",
    applicationUrl: page.url,
    applicationNote: "Fall 2026 international undergraduate route. The published application window is closed.",
    hasScholarship: true,
    scholarshipText: "Admission applicants are automatically considered for the HITSZ Entrance Scholarship; award level is determined by the university and eligibility is reassessed after the initial academic year.",
    status: "draft",
    sourceUrl: pdf.url,
    sourceLabel: pdf.label,
    sourceSha256: pdf.sha256,
    capturedAt: pdf.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official 2026 prospectus program table",
      degreeLevel: "official prospectus title",
      durationYears: "official prospectus program-table note",
      teachingLanguage: "official prospectus Programs Offered heading",
      cscaSubjects: "official prospectus program table",
      cscaRequirement: "official prospectus program table and entrance-exam note",
      englishRequirement: "official prospectus application-materials section",
      tuitionAmount: "official prospectus fee-structure section",
      scholarshipText: "official prospectus scholarship-policy remarks",
      applicationUrl: "registered official 2026 prospectus page",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  openDate: "2025-12-30T00:00:00.000Z",
  deadlineDate: "2026-05-20T15:59:59.000Z",
  deadlineLabel: "May 20, 2026",
  applicationRound: "2026 international undergraduate admission",
  status: "closed" as const,
  sourceUrl: pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: pdf.fetchedAt,
  sourceFieldLineage: {
    openDate: "official prospectus application-period section",
    deadlineDate: "official prospectus application-period section",
    intakeYear: "official prospectus title",
  },
}));

const scholarship: CatalogSeedScholarship = {
  slug: "hitsz-entrance-scholarship-2026",
  schoolSlug,
  title: "HITSZ Entrance Scholarship 2026",
  type: "university",
  typeLabel: "University entrance scholarship",
  providerName: "哈尔滨工业大学（深圳）",
  providerNameEn: "Harbin Institute of Technology, Shenzhen",
  providerLocation: "Shenzhen, Guangdong, China",
  fundingLevel: "Partial to full tuition, with a stipend for the Major Award",
  coverage: "Major Award: 100% tuition waiver plus CNY 1,000/month; First Award: 100% tuition waiver; Second Award: 80% tuition waiver; Third Award: 70% tuition waiver.",
  applicableDegree: "Undergraduate",
  applicableProgram: "The eight English-taught undergraduate programs in the 2026 HITSZ prospectus.",
  amountText: "Major Award includes full tuition and CNY 1,000/month; other award levels waive 100%, 80% or 70% of tuition.",
  requirementText: "Candidates are automatically considered when they submit the admission application. Award eligibility and level are determined by the university; subsequent years are reassessed using academic performance and conduct.",
  deadlineDate: "2026-05-20",
  deadlineLabel: "May 20, 2026 admission deadline",
  applicationRound: "Integrated with the 2026 undergraduate admission application",
  targetCountries: [],
  targetRegions: [],
  benefitItems: [
    { label: "Major Award", included: true, note: "100% tuition waiver plus CNY 1,000/month" },
    { label: "First Award", included: true, note: "100% tuition waiver" },
    { label: "Second Award", included: true, note: "80% tuition waiver" },
    { label: "Third Award", included: true, note: "70% tuition waiver" },
  ],
  eligibilityItems: [
    { label: "Applicant route", value: "Applicant to an eligible 2026 HITSZ English-taught undergraduate program" },
    { label: "Consideration", value: "Automatic with the admission application; no separate action is required" },
    { label: "Renewal", value: "Reassessed for later years using academic performance and overall conduct" },
  ],
  applicationMaterials: [{ label: "Separate scholarship application", value: "Not required; consideration is integrated with the admission application" }],
  applicationSteps: [{ label: "Step 1", value: "Submit the HITSZ undergraduate admission application by the published deadline." }],
  actionLinks: [{ label: page.label, url: page.url, kind: "official-source" }],
  summary: "Closed 2026 university entrance scholarship automatically considered with an eligible HITSZ undergraduate application.",
  status: "draft",
  sourceUrl: pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: pdf.fetchedAt,
  sourceFieldLineage: {
    title: "official prospectus scholarship-policy table",
    coverage: "official prospectus scholarship-policy table",
    applicableDegree: "official undergraduate prospectus scope",
    applicableProgram: "official prospectus program table",
    deadlineDate: "integrated admission application and official application-period section",
    eligibilityItems: "official prospectus scholarship-policy remarks",
    applicationSteps: "official prospectus scholarship-policy remarks",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Harbin Institute of Technology, Shenzhen",
    nameZh: "哈尔滨工业大学（深圳）",
    citySlug,
    schoolType: "Public",
    region: "Shenzhen, Guangdong, South China",
    applicationLevel: "Undergraduate",
    languageOfInstruction: "English for the reviewed 2026 undergraduate routes",
    languageRequirement: "TOEFL 80, IELTS 6.0 with no sub-test below 5.5, or Duolingo English Test 115, subject to published English-medium and native-speaker exemptions.",
    englishRequirement: "TOEFL 80, IELTS 6.0 with no sub-test below 5.5, or Duolingo English Test 115; published exemptions apply.",
    deadlineSummary: "The reviewed Fall 2026 application window ran December 30, 2025-May 20, 2026 and is closed. No 2027 date is inferred.",
    tuitionSummary: "CNY 30,000/year for the reviewed 2026 English-taught undergraduate routes.",
    applicationFee: "CNY 400 or USD 60",
    websiteUrl: "https://www.hitsz.edu.cn/",
    admissionsUrl: page.url,
    cscaRequired: true,
    cscaRequirement: "Engineering routes require CSCA Mathematics and Physics in English; Business Administration, Economics and Architecture require CSCA Mathematics in English.",
    cscaSubjects: ["Mathematics (English)", "Physics (English)"],
    subjectTags: specs.map((spec) => spec.category),
    languageTags: ["English"],
    campusHighlights: ["HIT Shenzhen campus", "Eight reviewed English-taught undergraduate routes", "Shenzhen innovation ecosystem"],
    contactNotes: "Admissions email published in the 2026 prospectus: admissions@hit.edu.cn",
    status: "draft",
    sourceUrl: pdf.url,
    sourceLabel: pdf.label,
    sourceSha256: pdf.sha256,
    capturedAt: pdf.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official 2026 prospectus title",
      nameZh: "official institution identity",
      citySlug: "official prospectus contact address",
      applicationLevel: "official prospectus title and program table",
      languageOfInstruction: "official prospectus Programs Offered heading",
      languageRequirement: "official prospectus application-materials section",
      deadlineSummary: "official prospectus application-period section",
      tuitionSummary: "official prospectus fee-structure section",
      applicationFee: "official prospectus fee-structure section",
      admissionsUrl: "registered official 2026 prospectus page",
      cscaRequirement: "official prospectus program table",
    },
  }],
  programs,
  programIntakes,
  scholarships: [scholarship],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 8 || validation.summary.programIntakes !== 8 || validation.summary.scholarships !== 1) {
  throw new Error(`HITSZ candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    pdfPagesVisuallyInspected: 8,
    notes: [
      "All eight pages of the official 2026 prospectus were rendered and visually inspected.",
      "Architecture is the only exact current match among the ten prohibited-source legacy program identities; the other legacy rows remain quarantined and are not force-mapped.",
      "Business Administration is not force-mapped to the legacy Business Management identity.",
      "The HITSZ Entrance Scholarship is created as a distinct current route; the two prohibited-source legacy scholarship titles remain quarantined.",
      "The Shenzhen municipal and Guangdong provincial scholarships are described in the prospectus but are not created because the reviewed source only gives general annual application periods rather than a current exact deadline and full application route.",
      "The 2026 admission and integrated entrance-scholarship round is closed; no 2027 dates are inferred.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
