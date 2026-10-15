import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-27.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-46-24-262Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage?: string; tuitionAmount?: number };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "ustc-undergraduate-guide-2026": "e21f1188ddeb07d08f41de8da8edc92c697f13d56ee232fff0c9c9c387884869",
  "ustc-postgraduate-programs-2026": "136f94f82997e4be5ef1b0f7e165ba21aceba2822f9bf3979616888e9506de2b",
  "ustc-postgraduate-guide-2026": "891c8f2247b17909182a26362a3e98eb9d2b2a6e6c3edbc65727bdf2869ee0d2",
} as const;
const sources = new Map<string, Source>();
for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.contentType === "text/html"
    && row.sha256 === expected[row.id as keyof typeof expected]) sources.set(row.id, row);
}
if (sources.size !== 3) throw new Error("USTC requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.ustc-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 287 || seed.programIntakes.length !== 287) throw new Error("Unexpected USTC complete seed.");
for (const program of seed.programs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed USTC Fall 2026 intake: ${program.slug}`);
}

type SourceKey = "undergraduate" | "postgraduate" | "postgraduate_fees";
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey, locator }] };
}
const sourceRecord = (key: SourceKey, id: keyof typeof expected) => {
  const source = sources.get(id)!;
  return { key, url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};

function undergraduateDocument() {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [sourceRecord("undergraduate", "ustc-undergraduate-guide-2026")], requirements: [
      item("undergraduate", "citizenship_passport_health", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen with a valid passport and be in good physical and mental health.", "document", "Eligibility item 1"),
      item("undergraduate", "education", "education", "required", "International undergraduate applicants", "Hold a senior-high graduation certificate equivalent to a Chinese high-school diploma by July 2026; a 2026 graduate may apply with a pre-graduation certificate.", "document", "Eligibility items 1 and 6"),
      item("undergraduate", "hsk", "language", "required", "Chinese-taught undergraduate applicants", "Pass New HSK Level 5 or above; a native Chinese speaker or applicant with proof of Chinese-medium high-school study may request the published exemption.", "official_result", "Eligibility item 2"),
      item("undergraduate", "nationality_history", "identity", "conditional", "Applicants who emigrated from mainland China, Hong Kong, Macao or Taiwan", "Have obtained current foreign citizenship and renounced Chinese nationality before April 30, 2022, and have lived abroad for at least two years between April 30, 2022 and April 30, 2026 under the published nine-month rule.", "document", "Eligibility item 3"),
      item("undergraduate", "chinese_parentage", "identity", "conditional", "Applicants born abroad with one or two Chinese-citizen parents", "Provide qualifying proof of the Chinese parent's foreign permanent residence at the applicant's birth, proof that the applicant renounced Chinese nationality, or the applicant's PRC Foreign Permanent Resident ID Card.", "document", "Eligibility item 4"),
      item("undergraduate", "moe_rule", "identity", "required", "International undergraduate applicants", "Meet Ministry of Education Document No. 12 (2020).", "school_review", "Eligibility item 5 and Annex I"),
      item("undergraduate", "csca", "academic_results", "required", "Fall 2026 undergraduate applicants", "Submit valid CSCA results with the online application: Professional Chinese (STEM) and Mathematics are compulsory, and either Physics or Chemistry must be selected.", "official_result", "Application Procedures item 1"),
      item("undergraduate", "application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Complete the online application from November 14, 2025 through March 31, 2026.", "document", "Application Procedures schedule"),
      item("undergraduate", "application_form", "documents", "required", "Fall 2026 undergraduate applicants", "Submit the USTC Application Form for International Students (Undergraduate Program).", "document", "Application materials"),
      item("undergraduate", "passport", "documents", "required", "Fall 2026 undergraduate applicants", "Submit a passport copy, including Chinese visa or residence-permit pages when applicable.", "document", "Application materials"),
      item("undergraduate", "diploma_transcripts", "documents", "required", "Fall 2026 undergraduate applicants", "Submit notarized senior-high graduation certificate and transcripts; a prospective July 2026 graduate may submit a school-issued pre-graduation certificate and must present originals at registration.", "document", "Application materials"),
      item("undergraduate", "language_evidence", "documents", "required", "Fall 2026 undergraduate applicants", "Submit New HSK Level 5 certificate and score report, or qualifying proof of Chinese-medium high-school study; admitted applicants must present the original language records at registration.", "official_result", "Application materials"),
      item("undergraduate", "physical_examination", "documents", "required", "Fall 2026 undergraduate applicants", "Submit the Foreigner Physical Examination Form.", "document", "Application materials"),
      item("undergraduate", "recommendation", "documents", "required", "Fall 2026 undergraduate applicants", "Submit an original Chinese- or English-language recommendation letter from the senior high school.", "document", "Application materials"),
      item("undergraduate", "guardian", "identity", "conditional", "Applicants younger than 18 on September 1, 2026", "Submit the USTC Guardian Statement; the guardian must stay in Hefei during study and have a stable source of living.", "document", "Application materials"),
      item("undergraduate", "immigration_documents", "documents", "conditional", "Applicants who emigrated from mainland China, Hong Kong, Macao or Taiwan", "Submit the immigration certificate, proof of cancellation of original Chinese citizenship, passport entry/exit-stamp pages and proof of living abroad for the published April 2022-April 2026 period.", "document", "Application materials"),
      item("undergraduate", "parentage_documents", "documents", "conditional", "Applicants born abroad with one or two Chinese-citizen parents", "Submit one of the three published nationality-status documents supporting eligibility.", "document", "Application materials"),
      item("undergraduate", "external_test_scores", "academic_results", "recommended", "Applicants with SAT, IB, GCE A-Level, ACT or AST results", "Optionally submit the score report; it is accepted only within two years of the examination date.", "official_result", "Application materials"),
      item("undergraduate", "university_assessment", "academic_results", "required", "Applicants passing document review", "Complete any further test or interview requested after USTC evaluates the CSCA results and application materials.", "school_review", "University Assessment"),
      item("undergraduate", "tuition", "application_policy", "required", "Enrolled undergraduate students", "Pay tuition of CNY 26,000 per academic year.", "document", "Fees & Scholarships item 1", "enrollment"),
      item("undergraduate", "insurance", "documents", "required", "Enrolled undergraduate students", "Pay the published CNY 800 annual insurance fee.", "document", "Fees & Scholarships item 2", "enrollment"),
      item("undergraduate", "accommodation", "other", "conditional", "Students using on-campus accommodation", "Budget CNY 500-1,000 per month according to room type and size.", "document", "Fees & Scholarships item 3", "enrollment"),
      item("undergraduate", "visa_registration", "documents", "required", "Admitted applicants", "Use the ordinary passport, Admission Notice, JW202 and original physical-examination records to obtain an X1 visa and register on the dates stated in the Admission Notice.", "document", "Admission", "preparation"),
    ] });
}

const postgraduateCommon = (degree: "Master" | "Doctoral", language: "Chinese" | "English"): RequirementItem[] => [
  item("postgraduate", "citizenship_passport_health", "identity", "required", `${degree} applicants`, "Be a non-Chinese citizen with a valid passport and be mentally and physically healthy.", "document", "Eligibility item 1"),
  item("postgraduate", "education", "education", "required", `${degree} applicants`, degree === "Master" ? "Hold a bachelor's degree equivalent to a Chinese bachelor's degree." : "Hold a master's degree equivalent to a Chinese master's degree.", "document", "Eligibility item 2"),
  item("postgraduate", "pregraduation", "documents", "conditional", `${degree} applicants who have not yet received the qualifying degree`, "Submit a pre-graduation certificate proving that the required degree will be completed by July 2026.", "document", "Eligibility item 2 note"),
  item("postgraduate", "age", "identity", "required", `${degree} applicants`, degree === "Master" ? "Be younger than 40 on September 1, 2026; individual scholarships may impose a lower age limit." : "Be younger than 45 on September 1, 2026; individual scholarships may impose a lower age limit.", "document", "Eligibility item 3"),
  item("postgraduate", "language", "language", "required", `${language}-taught ${degree.toLowerCase()} applicants`, language === "Chinese" ? "Pass New HSK Level 4 or above; a native Chinese speaker or applicant with proof of Chinese-medium high-school or university study may request the published exemption." : "Provide proof of English proficiency; applicants whose mother tongue is English are exempt from the document requirement, and the guide publishes no universal minimum IELTS or TOEFL score.", "official_result", "Eligibility item 4 and Application materials"),
  item("postgraduate", "application_window", "application_policy", "required", `${degree} Fall 2026 applicants`, "Complete the online application from October 16, 2025 through January 31, 2026.", "document", "Application Procedures schedule"),
  item("postgraduate", "supervisor_status", "application_policy", "recommended", `${degree} applicants`, "A host supervisor does not need to be found before online application; complete applications are forwarded to the relevant schools and departments for review.", "school_review", "Application Procedures item 1"),
  item("postgraduate", "passport", "documents", "required", `${degree} applicants`, "Submit an ordinary-passport copy with at least one year of validity.", "document", "Application materials"),
  item("postgraduate", "proposal", "documents", "required", `${degree} applicants`, "Submit a study or research proposal of at least 1,000 words.", "document", "Application materials"),
  item("postgraduate", "cv", "documents", "required", `${degree} applicants`, "Submit a curriculum vitae.", "document", "Application materials"),
  item("postgraduate", "recommendations", "documents", "required", `${degree} applicants`, "Submit two recommendation letters from full or associate professors, including telephone number and email address.", "document", "Application materials"),
  item("postgraduate", "physical_examination", "documents", "required", `${degree} applicants`, "Submit the Foreigner Physical Examination Form.", "document", "Application materials"),
  item("postgraduate", "degree_transcripts", "documents", "required", `${degree} applicants`, "Submit degree certificate and academic transcripts for the bachelor's and, where applicable, master's stages, notarized by the national Ministry of Education or equivalent authority.", "document", "Application materials"),
  item("postgraduate", "student_status", "documents", "conditional", "Applicants currently enrolled at a university", "Submit official student-status evidence stating exactly when the qualifying degree certificate will be obtained.", "document", "Application materials note"),
  item("postgraduate", "delayed_degree", "documents", "conditional", "Graduates who have not yet received the degree certificate", "Submit an official explanation stating why the certificate has not been issued and when it will be obtained.", "document", "Application materials note"),
  item("postgraduate", "employment_release", "documents", "conditional", "Applicants who are employed", "Submit official evidence of on-post employment status and permission of release.", "document", "Application materials note"),
  item("postgraduate", "translation", "documents", "conditional", "Documents not issued in Chinese or English", "Attach a notarized Chinese or English translation.", "document", "Application materials note"),
  item("postgraduate", "materials_return", "application_policy", "required", `${degree} applicants`, "Understand that application materials are not returned regardless of the result.", "document", "Application materials note"),
  item("postgraduate", "online_assessment", "academic_results", "required", "Shortlisted applicants", "Complete the school or department online assessment; all schools require an online interview and some also require an online entrance examination.", "school_review", "Online Assessment"),
  item("postgraduate_fees", "insurance", "documents", "required", "Enrolled postgraduate students", "Pay the published CNY 800 annual insurance fee.", "document", "Fees & Scholarships item 2", "enrollment"),
  item("postgraduate_fees", "accommodation", "other", "conditional", "Students using on-campus accommodation", "Budget CNY 500-1,000 per month according to room type and size.", "document", "Fees & Scholarships item 3", "enrollment"),
  item("postgraduate", "visa_registration", "documents", "required", "Admitted applicants", "Use the ordinary passport, Admission Notice, JW201/JW202 and original physical-examination records to obtain an X1 visa and register on the dates stated in the Admission Notice.", "document", "Admission", "preparation"),
];

function postgraduateDocument(degree: "Master" | "Doctoral", language: "Chinese" | "English", mba = false) {
  const tuition = degree === "Doctoral" ? "Pay tuition of CNY 35,000 per academic year."
    : mba ? "Pay the published MBA tuition of CNY 150,000 per student."
      : "Pay tuition of CNY 30,000 per academic year.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [sourceRecord("postgraduate", "ustc-postgraduate-guide-2026"), sourceRecord("postgraduate_fees", "ustc-postgraduate-programs-2026")],
    requirements: [...postgraduateCommon(degree, language),
      item("postgraduate_fees", "tuition", "application_policy", "required", mba ? "MBA students" : `Enrolled ${degree.toLowerCase()} students`, tuition, "document", "Fees & Scholarships item 1", "enrollment")],
  });
}

const group = (degree: string, language: string, tuition: number) => seed.programs.filter((program) => program.degreeLevel === degree
  && program.teachingLanguage === language && program.tuitionAmount === tuition);
const definitions = [
  { key: "ustc-undergraduate-chinese-fall-2026", rows: group("Undergraduate", "Chinese", 26000), document: undergraduateDocument() },
  { key: "ustc-master-chinese-fall-2026", rows: group("Master", "Chinese", 30000), document: postgraduateDocument("Master", "Chinese") },
  { key: "ustc-master-english-fall-2026", rows: group("Master", "English", 30000), document: postgraduateDocument("Master", "English") },
  { key: "ustc-master-mba-english-fall-2026", rows: group("Master", "English", 150000), document: postgraduateDocument("Master", "English", true) },
  { key: "ustc-doctoral-chinese-fall-2026", rows: group("Doctoral", "Chinese", 35000), document: postgraduateDocument("Doctoral", "Chinese") },
  { key: "ustc-doctoral-english-fall-2026", rows: group("Doctoral", "English", 35000), document: postgraduateDocument("Doctoral", "English") },
];
if (definitions.some((definition) => definition.rows.length === 0)
  || definitions.reduce((sum, definition) => sum + definition.rows.length, 0) !== 287) throw new Error("USTC requirement groups are incomplete.");
const templates = definitions.map((definition) => ({
  key: definition.key, schoolSlug: "university-of-science-and-technology-of-china", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.",
    ...(definition.key.includes("master-english") || definition.key.includes("doctoral-english")
      ? ["The official guide requires English-proficiency proof but publishes no universal numeric IELTS or TOEFL threshold."] : [])],
  document: definition.document,
}));
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located complete-scope USTC 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
