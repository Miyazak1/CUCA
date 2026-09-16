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
const paths = {
  manifest: resolve(root, "work/catalog-official/dhu-complete-batch-01/manifest.json"),
  rows: resolve(root, "work/catalog-official/dhu-complete-batch-01/program-rows.json"),
  draft: resolve(root, "seeds/catalog.dhu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.dhu-complete-batch-01.validation.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [manifestText, rowsText] = await Promise.all([readFile(paths.manifest, "utf8"), readFile(paths.rows, "utf8")]);
const manifest = JSON.parse(manifestText);
type Evidence = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; status: number; contentType: string; byteLength: number; sha256: string; artifactPath: string };
const evidence = new Map<string, Evidence>((manifest.sources as Evidence[]).map((row) => [row.id, row]));
const requireEvidence = (id: string, type: "application/pdf" | "text/html") => {
  const row = evidence.get(id);
  if (!row || row.status !== 200 || row.contentType !== type || !row.finalUrl.startsWith("https://english.dhu.edu.cn/") || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error(`Invalid DHU evidence: ${id}`);
  return row;
};
const timeline = requireEvidence("dhu-degree-application-timeline-2026", "text/html");
const programSources = {
  Undergraduate: requireEvidence("dhu-undergraduate-programs-pdf-2026", "application/pdf"),
  Master: requireEvidence("dhu-master-programs-pdf-2026", "application/pdf"),
  Doctoral: requireEvidence("dhu-doctoral-programs-pdf-2026", "application/pdf"),
} as const;
const highLevel = requireEvidence("dhu-cgs-high-level-postgraduate-2026", "text/html");
const sgs = requireEvidence("dhu-shanghai-government-scholarship-2026", "text/html");
const chinaLink = requireEvidence("dhu-cgs-china-link-2026", "text/html");

type ExtractedRow = {
  page: string; row: number; anchorY: number; nameEn: string; degreeLevel: keyof typeof programSources;
  durationYears: number | null; durationText: string; fieldCategory: string; teachingLanguage: string;
  campus: string; scholarshipAvailable: boolean; tuitionAmount: number | null; tuitionText: string;
  languageRequirement: string; otherRequirement: string; cscaRequirement: string;
};
const rows = JSON.parse(rowsText) as ExtractedRow[];
if (rows.length !== 131 || new Set(rows.map((row) => `${row.page}:${row.row}`)).size !== 131) throw new Error("DHU extracted program rows changed.");
if (rows.some((row) => !row.nameEn || !row.teachingLanguage || !row.campus || !row.tuitionText || !["Undergraduate", "Master", "Doctoral"].includes(row.degreeLevel))) throw new Error("DHU extracted program row is incomplete.");

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const routeCounts = new Map<string, number>();
const programs: CatalogSeedProgram[] = rows.map((row) => {
  const source = programSources[row.degreeLevel];
  const languageKey = row.teachingLanguage.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  const baseKey = `${row.degreeLevel}:${row.nameEn}:${languageKey}`;
  const ordinal = (routeCounts.get(baseKey) ?? 0) + 1;
  routeCounts.set(baseKey, ordinal);
  const duplicateSuffix = ordinal > 1 ? `-route-${ordinal}` : "";
  const undergraduate = row.degreeLevel === "Undergraduate";
  const master = row.degreeLevel === "Master";
  const chinese = row.teachingLanguage.includes("Chinese");
  const english = row.teachingLanguage.includes("English");
  const deadline = undergraduate ? "May 31, 2026 for self-funded study; April 15, 2026 for entrance-scholarship consideration." : "May 31, 2026 for self-funded study; January 31 or April 15, 2026 for scholarship routes shown in the official table.";
  return {
    slug: `donghua-university-2026-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-${languageKey}${duplicateSuffix}`,
    schoolSlug: "donghua-university",
    citySlug: "shanghai",
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    durationYears: row.durationYears ?? (master ? 3 : undefined),
    fieldCategory: row.fieldCategory,
    subjectArea: row.fieldCategory,
    teachingLanguage: row.teachingLanguage,
    ...(undergraduate ? { cscaRequirement: row.cscaRequirement || "The official 2026 bachelor's program table publishes route-specific CSCA subjects; applicants must follow the row for the selected major." } : { cscaRequirement: "No CSCA requirement is published for this graduate route." }),
    ...(chinese ? { hskRequirement: row.languageRequirement.includes("HSK") ? row.languageRequirement : undergraduate ? "HSK 5, score 180 or above; HSK 4 score 180 is acceptable for application." : "HSK 5, score 210 or above." } : {}),
    ...(english ? { englishRequirement: row.languageRequirement.includes("IELTS") || row.languageRequirement.includes("TOEFL") ? row.languageRequirement : undergraduate ? "IELTS 5.5 or TOEFL iBT 72 or above." : "IELTS 6.0 or TOEFL iBT 80 or above." } : {}),
    ...(row.tuitionAmount ? { tuitionAmount: row.tuitionAmount } : {}),
    tuitionCurrency: "RMB",
    tuitionPeriod: "academic year",
    tuitionText: `${row.tuitionText} per academic year`,
    scholarshipText: row.scholarshipAvailable ? `Entrance-scholarship route available. ${deadline}` : "No entrance-scholarship route is marked available for this program in the official 2026 table.",
    applicationUrl: "https://admissions.dhu.edu.cn/",
    applicationNote: `September 2026 intake; ${row.durationText}; ${row.campus}. ${deadline}${row.otherRequirement ? ` Additional published requirement: ${row.otherRequirement}` : ""}`,
    hasScholarship: row.scholarshipAvailable,
    badgeText: `${row.degreeLevel} · ${row.teachingLanguage}`,
    displayTuition: `${row.tuitionText}/year`,
    displaySubjects: [row.fieldCategory],
    displayGroup: slugify(row.fieldCategory),
    displayGroupLabel: row.fieldCategory,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${row.page}, reviewed OCR row ${row.row}, y=${row.anchorY}`,
      degreeLevel: "official PDF table title",
      durationYears: "official PDF table heading",
      teachingLanguage: `${row.page}, language column, row ${row.row}`,
      tuitionText: `${row.page}, tuition column, row ${row.row}`,
      scholarshipText: `${row.page}, entrance-scholarship availability and deadline columns, row ${row.row}`,
      applicationNote: `${row.page}, campus and requirements columns, row ${row.row}`,
    },
  };
});
if (new Set(programs.map((row) => row.slug)).size !== 131) throw new Error("DHU program slugs are not unique.");

const commonAction = { label: "Donghua University official application", url: "https://admissions.dhu.edu.cn/", kind: "application" };
const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "official-2026-dhu-cgs-high-level-postgraduate",
    title: "Donghua University 2026 Chinese Government Scholarship - High-level Postgraduate Program",
    nameZh: "东华大学2026年中国政府奖学金高水平研究生项目",
    schoolSlug: "donghua-university",
    type: "Chinese Government Scholarship",
    typeLabel: "CGS Category Type B",
    providerName: "China Scholarship Council / Donghua University",
    providerNameEn: "China Scholarship Council / Donghua University",
    providerLocation: "China",
    fundingLevel: "Full",
    coverage: "Tuition waiver, medical insurance, on-campus dormitory, and monthly stipend of CNY 3,000 for master's students or CNY 3,500 for doctoral students.",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "Programs listed in Donghua University's official 2026 master's and doctoral catalogues.",
    amountText: "Full tuition, insurance and dormitory waiver; CNY 3,000/month master's stipend or CNY 3,500/month doctoral stipend.",
    requirementText: "Excellent international applicants seeking a master's or doctoral degree; applicants may not concurrently hold another Chinese government or institutional entrance scholarship.",
    bodySections: [
      { title: "Program overview", body: "Donghua University recommends academically qualified applicants to CSC. Final awards are decided through CSC expert review." },
      { title: "Published timeline", items: ["Apply to Donghua University from December 1, 2025 to January 31, 2026", "Pre-admission letters are planned around March 20", "CSC review is planned for April-May", "Donghua University announces results in May-June"] },
    ],
    benefitItems: [
      { label: "Tuition waiver", included: true }, { label: "Medical insurance", included: true },
      { label: "On-campus dormitory", included: true }, { label: "Monthly stipend", included: true, note: "CNY 3,000 master's; CNY 3,500 doctoral" },
    ],
    eligibilityItems: [
      { label: "Degree level", value: "Master or Doctoral" },
      { label: "Concurrent funding", value: "No other Chinese government or institutional entrance scholarship" },
      { label: "Academic review", value: "Must pass Donghua University's academic review before CSC submission" },
    ],
    applicationMaterials: [
      { label: "Donghua University degree application", body: "Prepare the materials required by the official 2026 master's or doctoral application guide." },
      { label: "Pre-admission letter", body: "Upload Donghua University's pre-admission letter to CGSIS if nominated." },
      { label: "Study and research plan", body: "Submit the route-appropriate plan required by the official guide." },
    ],
    applicationSteps: [
      { label: "Step 1", body: "Apply through Donghua University's official system and pay the CNY 800 university application fee." },
      { label: "Step 2", body: "Pass Donghua University's academic review and receive a pre-admission letter." },
      { label: "Step 3", body: "Complete the CGSIS Category Type B application using Donghua University agency number 10255." },
      { label: "Step 4", body: "Wait for CSC expert review and Donghua University's award announcement." },
    ],
    actionLinks: [commonAction, { label: "Official scholarship page", url: highLevel.url, kind: "official" }, { label: "China Scholarship Council", url: "https://www.campuschina.org/", kind: "official" }],
    deadlineDate: "2026-01-31",
    deadlineLabel: "January 31, 2026",
    applicationRound: "2026-2027 academic year",
    benefits: ["Tuition waiver", "Medical insurance", "On-campus dormitory", "Monthly stipend"],
    tags: ["2026", "CGS", "Full scholarship", "Master", "Doctoral"],
    summary: "A full Chinese Government Scholarship route for Donghua University master's and doctoral applicants, with a university nomination stage followed by CSC review.",
    sortOrder: 10,
    status: "draft",
    sourceUrl: highLevel.url, sourceLabel: highLevel.label, sourceSha256: highLevel.sha256, capturedAt: highLevel.fetchedAt,
    sourceFieldLineage: { coverage: "official page, Scholarship Coverage", deadlineDate: "official page, Timeline", applicationSteps: "official page, Timeline and CGSIS instructions" },
  },
  ...(["A", "B"] as const).map((type, index): CatalogSeedScholarship => ({
    slug: `official-2026-dhu-shanghai-government-scholarship-type-${type.toLowerCase()}`,
    title: `Donghua University 2026 Shanghai Government Scholarship - Type ${type}`,
    nameZh: `东华大学2026年上海市政府奖学金${type === "A" ? "A类" : "B类"}`,
    schoolSlug: "donghua-university",
    type: "Government Scholarship",
    typeLabel: `Shanghai Government Scholarship Type ${type}`,
    providerName: "Shanghai Municipal People's Government",
    providerNameEn: "Shanghai Municipal People's Government",
    providerLocation: "Shanghai, China",
    fundingLevel: type === "A" ? "Full" : "Partial",
    coverage: type === "A" ? "Tuition, medical insurance and on-campus dormitory waivers, plus monthly stipend: CNY 2,500 bachelor's, CNY 3,000 master's, CNY 3,500 doctoral." : "Tuition and medical insurance waivers.",
    applicableDegree: "Undergraduate (Chinese-taught), Master, Doctoral",
    applicableProgram: "Chinese-taught bachelor's programs and Donghua University master's or doctoral programs.",
    amountText: type === "A" ? "Full tuition, insurance and dormitory waivers; monthly stipend CNY 2,500/3,000/3,500 by degree." : "Tuition and medical insurance waivers.",
    requirementText: "Non-Chinese citizen in good health; bachelor's applicants 16-24, master's applicants under 35 with a bachelor's degree, doctoral applicants under 40 with a master's degree; no other scholarship in China.",
    bodySections: [
      { title: "Award scope", body: `Shanghai Government Scholarship Type ${type} for eligible new Donghua University degree applicants.` },
      { title: "Duration", items: ["Bachelor's: 4 years", "Master's: 2.5-3 years", "Doctoral: 4 years", "Actual duration follows the admission notice and normally cannot be extended"] },
    ],
    benefitItems: type === "A" ? [
      { label: "Tuition waiver", included: true }, { label: "Medical insurance", included: true }, { label: "On-campus dormitory", included: true },
      { label: "Monthly stipend", included: true, note: "CNY 2,500 bachelor's; CNY 3,000 master's; CNY 3,500 doctoral" },
    ] : [{ label: "Tuition waiver", included: true }, { label: "Medical insurance", included: true }, { label: "Dormitory", included: false }, { label: "Monthly stipend", included: false }],
    eligibilityItems: [
      { label: "Citizenship and health", value: "Non-Chinese citizen in good health" },
      { label: "Bachelor's", value: "High-school graduate, at least 16 and under 25" },
      { label: "Master's", value: "Bachelor's degree holder under 35" },
      { label: "Doctoral", value: "Master's degree holder under 40" },
      { label: "Concurrent scholarship", value: "Must not hold another scholarship offered in China" },
    ],
    applicationMaterials: [
      { label: "Program application materials", body: "Prepare all materials required by the official 2026 guide for the selected degree and program." },
      { label: "Funding selection", body: "Select CGS-Category Type B or SGS in Donghua University's application system." },
    ],
    applicationSteps: [
      { label: "Step 1", body: "Choose an eligible program from Donghua University's official 2026 program list." },
      { label: "Step 2", body: "Prepare the degree-specific application documents." },
      { label: "Step 3", body: "Submit the online application through Donghua University's official system and select the published SGS funding route." },
    ],
    actionLinks: [commonAction, { label: "Official scholarship page", url: sgs.url, kind: "official" }],
    deadlineDate: "2026-04-15", deadlineLabel: "April 15, 2026", applicationRound: "December 1, 2025 to April 15, 2026",
    benefits: type === "A" ? ["Tuition waiver", "Medical insurance", "On-campus dormitory", "Monthly stipend"] : ["Tuition waiver", "Medical insurance"],
    tags: ["2026", "Shanghai Government Scholarship", `Type ${type}`, type === "A" ? "Full scholarship" : "Partial scholarship"],
    summary: `Shanghai Government Scholarship Type ${type} for eligible 2026 Donghua University degree applicants.`,
    sortOrder: 20 + index,
    status: "draft",
    sourceUrl: sgs.url, sourceLabel: sgs.label, sourceSha256: sgs.sha256, capturedAt: sgs.fetchedAt,
    sourceFieldLineage: { applicableDegree: "official page, Applicable Programs", coverage: "official page, Scholarship Coverage", eligibilityItems: "official page, Applicant Eligibility", deadlineDate: "official page, Application Period" },
  })),
  {
    slug: "official-2026-dhu-cgs-china-link",
    title: "Donghua University 2026 Chinese Government Scholarship - China Link Program",
    nameZh: "东华大学2026年中国政府奖学金来华链接项目",
    schoolSlug: "donghua-university",
    type: "Chinese Government Scholarship",
    typeLabel: "China Link Scholarship Program",
    providerName: "China Scholarship Council / Donghua University",
    providerNameEn: "China Scholarship Council / Donghua University",
    providerLocation: "China",
    fundingLevel: "Full",
    coverage: "Tuition, medical insurance and on-campus dormitory waivers; monthly stipend CNY 3,000 for general scholars and CNY 3,500 for senior scholars.",
    applicableDegree: "General scholar, Senior scholar",
    applicableProgram: "Short-term study or research in all disciplines other than Chinese language study; 1-12 months.",
    amountText: "Full waivers plus CNY 3,000/month general scholar or CNY 3,500/month senior scholar stipend.",
    requirementText: "Current full-time student or academic staff at a CSC foreign partner university; general scholars under 45, senior scholars under 50; non-Chinese citizen in good health.",
    bodySections: [
      { title: "Program scheme", items: ["General scholar: current undergraduate or master's student", "Senior scholar: current doctoral student or faculty", "Duration: 1-12 months", "Instruction: English or Chinese", "Fields: all disciplines except Chinese language study", "Start no later than August 31, 2027"] },
      { title: "Application timing", body: "Begin the Donghua University and CSC process at least three months before the intended start date." },
    ],
    benefitItems: [
      { label: "Tuition waiver", included: true }, { label: "Medical insurance", included: true }, { label: "On-campus dormitory", included: true },
      { label: "Monthly stipend", included: true, note: "CNY 3,000 general scholar; CNY 3,500 senior scholar" },
    ],
    eligibilityItems: [
      { label: "Home institution", value: "Full-time student or academic staff at a CSC foreign partner university" },
      { label: "General scholar age", value: "Under 45" }, { label: "Senior scholar age", value: "Under 50" },
      { label: "Host permission", value: "Obtain permission from a Donghua University professor or research group" },
    ],
    applicationMaterials: [
      { label: "Institution status evidence", body: "Official enrollment/registration certificate or certificate of employment." },
      { label: "Academic record", body: "Transcripts for student applicants." },
      { label: "Research proposal", body: "At least 800 words in the program language." },
      { label: "Study plan", body: "At least 500 words in the program language." },
      { label: "Curriculum vitae", body: "Academic and professional background relevant to the proposed visit." },
      { label: "Health and conduct documents", body: "Follow the official duration-dependent physical-examination and non-criminal-record requirements." },
    ],
    applicationSteps: [
      { label: "Step 1", body: "Confirm the home university is on CSC's foreign partner list." },
      { label: "Step 2", body: "Obtain permission from a Donghua University professor or research group and prepare institutional status evidence." },
      { label: "Step 3", body: "Submit the public-program application materials to Donghua University's International Education Center at least three months before the intended start." },
      { label: "Step 4", body: "If the university review passes, use the pre-admission letter to complete the CSC application." },
    ],
    actionLinks: [{ label: "Official scholarship page", url: chinaLink.url, kind: "official" }, { label: "China Scholarship Council", url: "https://www.campuschina.org/", kind: "official" }],
    deadlineLabel: "At least 3 months before the intended start date",
    applicationRound: "2026 program; start no later than August 31, 2027",
    benefits: ["Tuition waiver", "Medical insurance", "On-campus dormitory", "Monthly stipend"],
    tags: ["2026", "CGS", "China Link", "Short-term research", "Full scholarship"],
    summary: "A 1-12 month full scholarship for eligible students and faculty from CSC foreign partner universities to conduct study or research at Donghua University.",
    sortOrder: 30,
    status: "draft",
    sourceUrl: chinaLink.url, sourceLabel: chinaLink.label, sourceSha256: chinaLink.sha256, capturedAt: chinaLink.fetchedAt,
    sourceFieldLineage: { applicableDegree: "official page, Funding Categories", coverage: "official page, Funding", eligibilityItems: "official page, Eligibility", applicationMaterials: "official page, Required Application Materials", deadlineLabel: "official page, Application to DHU and CSC" },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{
    slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", region: "East China", province: "Shanghai", status: "draft",
    sourceUrl: timeline.url, sourceLabel: timeline.label, sourceSha256: timeline.sha256, capturedAt: timeline.fetchedAt,
    sourceFieldLineage: { nameEn: "official Donghua University campus and admissions location", region: "official institution location" },
  }],
  schools: [{
    slug: "donghua-university", nameEn: "Donghua University", nameZh: "东华大学", citySlug: "shanghai", schoolType: "Public", region: "Shanghai, East China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese, English",
    languageRequirement: "Chinese-taught bachelor's routes generally require HSK 5 score 180; graduate routes require HSK 5 score 210. English routes generally require IELTS or TOEFL at the published route threshold.",
    hskRequirement: "Bachelor's: HSK 5 score 180 (HSK 4 score 180 acceptable at application); Graduate: HSK 5 score 210.",
    englishRequirement: "Bachelor's: IELTS 5.5 or TOEFL iBT 72; Graduate: IELTS 6.0 or TOEFL iBT 80.",
    deadlineSummary: "2026 scholarship deadlines: January 31 and/or April 15 by route; self-funded deadline: May 31.",
    tuitionSummary: "Bachelor's CNY 22,000-98,000/year; master's CNY 26,000-40,000/year; doctoral CNY 34,000-38,000/year (English doctoral routes shown at CNY 37,000 where applicable).",
    applicationFee: "CNY 800", websiteUrl: "https://www.dhu.edu.cn/", admissionsUrl: "https://admissions.dhu.edu.cn/",
    cscaRequired: true, cscaRequirement: "The official 2026 bachelor's program list publishes route-specific CSCA subjects; applicants must follow the selected-major row.",
    subjectTags: ["Fashion and Design", "Textile Engineering", "Materials Science", "Business and Management", "Computer and Information Engineering", "Chemistry and Biotechnology", "Environment and Civil Engineering"],
    languageTags: ["Chinese", "English"], tuitionBandLabel: "CNY 22,000-98,000/year",
    campusHighlights: ["Yan'an Road Campus", "Songjiang Campus"],
    contactNotes: "Use Donghua University's official admissions system and published degree guide. No personal contact details are stored in this catalog record.",
    status: "draft", sourceUrl: timeline.url, sourceLabel: timeline.label, sourceSha256: timeline.sha256, capturedAt: timeline.fetchedAt,
    sourceFieldLineage: { applicationLevel: "three official 2026 program catalogues", languageRequirement: "official program-table language columns", deadlineSummary: "official program tables and 2026 timeline", tuitionSummary: "official program-table tuition columns", applicationFee: "official program tables" },
  }],
  programs,
  programIntakes: programs.map((program) => ({
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
    deadlineDate: "2026-05-31T00:00:00.000Z", deadlineLabel: "May 31, 2026 (self-funded); earlier scholarship deadlines may apply",
    applicationRound: "September 2026 degree intake", status: "closed",
    sourceUrl: program.sourceUrl, sourceLabel: program.sourceLabel, sourceSha256: program.sourceSha256, capturedAt: program.capturedAt,
    sourceFieldLineage: { deadlineDate: "official 2026 program table, self-funded deadline column", applicationRound: "official program table heading" },
  })),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 131 || validation.summary.programIntakes !== 131 || validation.summary.scholarships !== 4) throw new Error(`DHU candidate invalid:\n${validation.errors.join("\n")}`);
await Promise.all([
  writeFile(paths.draft, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify({ ...validation, sourceManifestSha256: sha(manifestText), programRowsSha256: sha(rowsText), evidenceCounts: { html: 7, pdf: 3, pdfPagesVisuallyReviewed: 6 }, routeCounts: { undergraduate: 56, master: 48, doctoral: 27 }, scholarshipCounts: { cgsHighLevel: 1, shanghaiGovernment: 2, chinaLink: 1 } }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, summary: validation.summary, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, paths }, null, 2));
