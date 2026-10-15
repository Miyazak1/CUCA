import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-26.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-36-21-628Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage?: string; tuitionAmount?: number; cscaSubjects?: string[] };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "nuaa-undergraduate-admissions-2026": "05bebd7b3991fbd2e0297660b2bc0f4efd625a5107e05af3332cb318b1f411bc",
  "nuaa-postgraduate-admissions-2026": "24a064d4cee016e0a156ea6b70961f663a8cabcedce8e99446b16f06c6ac643a",
} as const;
const sources = new Map<string, Source>();
for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.contentType === "text/html"
    && row.sha256 === expected[row.id as keyof typeof expected]) sources.set(row.id, row);
}
if (sources.size !== 2) throw new Error("NUAA requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.nuaa-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 77 || seed.programIntakes.length !== 77) throw new Error("Unexpected NUAA complete seed.");
for (const program of seed.programs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed NUAA Fall 2026 intake: ${program.slug}`);
}

function item(sourceKey: "undergraduate" | "postgraduate", key: string, category: RequirementItem["category"],
  level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"],
  locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey, locator }] };
}

const undergraduateCommon: RequirementItem[] = [
  item("undergraduate", "citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen.", "document", "Application Eligibility"),
  item("undergraduate", "age", "identity", "required", "International undergraduate applicants", "Be 17 to 25 years old.", "document", "Application Eligibility"),
  item("undergraduate", "minor_guardian", "identity", "conditional", "Applicants younger than 18", "Provide a guardian certificate for a guardian who has Nanjing residency.", "document", "Application Eligibility"),
  item("undergraduate", "education", "education", "required", "International undergraduate applicants", "Be a senior-high graduate or hold a higher qualification.", "document", "Application Eligibility"),
  item("undergraduate", "online_application", "application_policy", "required", "Fall 2026 applicants", "Create an account in the NUAA admission system, upload every required document, pay the application fee and monitor the portal for status changes.", "school_review", "How to Apply"),
  item("undergraduate", "application_fee", "application_policy", "required", "Fall 2026 applicants", "Pay the non-refundable CNY 400 application fee.", "document", "How to Apply: Upload documents and pay the application fee"),
  item("undergraduate", "passport", "documents", "required", "Fall 2026 applicants", "Submit the passport information page and the current Chinese visa if already in China.", "document", "Application Documents"),
  item("undergraduate", "diploma", "documents", "required", "Fall 2026 applicants", "Submit the senior-high diploma or a notarized copy; a 2026 graduate may submit a pre-graduation letter but must present the original diploma at registration.", "document", "Application Documents"),
  item("undergraduate", "transcripts", "documents", "required", "Fall 2026 applicants", "Submit original or notarized transcripts for all senior-high courses.", "document", "Application Documents"),
  item("undergraduate", "recommendations", "documents", "required", "Fall 2026 applicants", "Submit two signed recommendation letters from high-school teachers, including their contact details.", "document", "Application Documents"),
  item("undergraduate", "personal_statement", "documents", "required", "Fall 2026 applicants", "Submit a personal statement of no more than 800 words covering personal introduction, reasons for applying and individual strengths.", "document", "Application Documents"),
  item("undergraduate", "no_criminal_record", "documents", "required", "Fall 2026 applicants", "Submit a no-criminal-record certificate.", "document", "Application Documents"),
  item("undergraduate", "physical_examination", "documents", "required", "Fall 2026 applicants", "Submit the Foreigner Physical Examination Form.", "document", "Application Documents"),
  item("undergraduate", "financial_guarantee", "documents", "required", "Fall 2026 applicants", "Submit a financial-guarantee letter or bank statement.", "document", "Application Documents"),
  item("undergraduate", "translation", "documents", "conditional", "Documents not issued in Chinese or English", "Provide a notarized Chinese or English translation.", "document", "Application Documents note"),
  item("undergraduate", "originals", "documents", "required", "Admitted applicants registering on campus", "Upload clear scans for review and bring every original for on-campus verification; enrollment is refused when originals are not provided.", "document", "Application Documents note", "enrollment"),
  item("undergraduate", "application_window", "application_policy", "required", "Fall 2026 applicants", "Apply from November 15, 2025 through May 30, 2026; May 30 is the final application deadline.", "document", "Application Time"),
  item("undergraduate", "residence_permit", "documents", "required", "Enrolled students", "Budget the published CNY 400 residence-permit charge; the guide says the amount is an average and subject to change.", "document", "Tuition & Fees", "enrollment"),
  item("undergraduate", "accommodation", "other", "conditional", "Students using NUAA accommodation", "Budget CNY 8,000 per year for a small single room, CNY 14,000 for a large single room, CNY 4,000 for a small double-room place, or CNY 7,000 for a large double-room place; published figures are averages and may change.", "document", "Tuition & Fees", "enrollment"),
];

function undergraduateDocument(language: "Chinese" | "English", business: boolean) {
  const source = sources.get("nuaa-undergraduate-admissions-2026")!;
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "undergraduate", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
    requirements: [
      ...undergraduateCommon,
      item("undergraduate", "csca", "academic_results", "required", business ? "International Business applicants" : "Engineering applicants",
        business ? "Take the CSCA Mathematics paper in English and submit the official result by May 30, 2026."
          : "Take the CSCA Mathematics and Physics papers in English and submit both official results by May 30, 2026.",
        "official_result", "How to Apply and Application Documents"),
      item("undergraduate", "language_requirement", "language", "required", `${language}-taught undergraduate applicants`, language === "Chinese"
        ? "Submit HSK Level 4 or above."
        : "Submit IELTS 6.0 or above, TOEFL 80 or above, or an equivalent English-proficiency letter.",
      "official_result", "Application Documents: Language proficiency certificate"),
      item("undergraduate", "tuition", "application_policy", "required", business ? "International Business students" : "Engineering students",
        business ? "Pay tuition of CNY 22,900 per academic year." : "Pay tuition of CNY 23,900 per academic year.",
      "document", "Tuition & Fees", "enrollment"),
    ] });
}

const postgraduateCommon = (degree: "Master" | "Doctoral"): RequirementItem[] => [
  item("postgraduate", "citizenship_health_conduct", "identity", "required", `${degree} applicants`, "Be a non-Chinese citizen in good physical and mental health and have no criminal record.", "document", "Application Eligibility"),
  item("postgraduate", "age", "identity", "required", `${degree} applicants`, degree === "Master" ? "Be younger than 35 years old." : "Be younger than 40 years old.", "document", "Application Eligibility"),
  item("postgraduate", "education", "education", "required", `${degree} applicants`, degree === "Master" ? "Hold a bachelor's degree." : "Hold a master's degree.", "document", "Application Eligibility"),
  item("postgraduate", "academic_profile", "education", "required", `${degree} applicants`, "Demonstrate a strong academic background and research and innovation ability.", "school_review", "Application Eligibility"),
  item("postgraduate", "language_requirement", "language", "required", `${degree} applicants`, "Submit IELTS 6.0 or above, TOEFL 70 or above, or an equivalent English-proficiency letter.", "official_result", "Application Eligibility"),
  item("postgraduate", "online_application", "application_policy", "required", `${degree} applicants`, "Complete the NUAA online application using accurate identity and contact details, pay the application fee and submit the application.", "school_review", "How to Apply"),
  item("postgraduate", "application_fee", "application_policy", "required", `${degree} applicants`, "Pay the non-refundable CNY 400 application fee.", "document", "How to Apply"),
  item("postgraduate", "passport", "documents", "required", `${degree} applicants`, "Submit a scanned copy of the passport information page.", "document", "Application Documents"),
  item("postgraduate", "degree_certificate", "documents", "required", `${degree} applicants`, degree === "Master" ? "Submit the notarized bachelor's degree certificate in Chinese or English." : "Submit the notarized master's degree certificate in Chinese or English.", "document", "Application Documents"),
  item("postgraduate", "transcripts", "documents", "required", `${degree} applicants`, "Submit a notarized copy of the highest academic transcript.", "document", "Application Documents"),
  item("postgraduate", "supervisor_acceptance", "documents", "required", `${degree} applicants`, "Submit an NUAA Supervisor Acceptance Letter.", "document", "Application Documents"),
  item("postgraduate", "study_plan", "documents", "required", `${degree} applicants`, "Submit a study plan signed by an NUAA supervisor or professor.", "document", "Application Documents"),
  item("postgraduate", "recommendation", "documents", "required", `${degree} applicants`, "Submit a recommendation letter from a professor or associate professor.", "document", "Application Documents"),
  item("postgraduate", "physical_examination", "documents", "required", `${degree} applicants`, "Submit the Foreigner Physical Examination Record with blood-test report, issued within the preceding six months.", "document", "Application Documents"),
  item("postgraduate", "no_criminal_record", "documents", "required", `${degree} applicants`, "Submit a no-criminal-record certificate issued within the preceding six months.", "document", "Application Documents"),
  item("postgraduate", "financial_guarantee", "documents", "required", `${degree} applicants`, "Submit a financial-guarantee letter or bank statement.", "document", "Application Documents"),
  item("postgraduate", "csc_form", "documents", "conditional", "Chinese Government Scholarship applicants", "Submit the CSC application form.", "document", "Application Documents"),
  item("postgraduate", "translation", "documents", "conditional", "Documents not issued in Chinese or English", "Provide a notarized Chinese or English translation.", "document", "Application Documents note"),
  item("postgraduate", "originals", "documents", "required", "Admitted applicants registering on campus", "Upload clear scans for review and bring every original for on-campus verification; enrollment is refused when originals are not provided.", "document", "Application Documents note", "enrollment"),
  item("postgraduate", "application_window", "application_policy", "required", `${degree} Fall 2026 applicants`, "Applications opened November 15, 2025; May 30, 2026 was the recommended period end and June 15, 2026 was the published final deadline.", "document", "Application Time"),
  item("postgraduate", "residence_permit", "documents", "required", "Enrolled students", "Budget the published CNY 400 annual residence-permit charge; the guide says the amount is an average and subject to change.", "document", "Tuition & Fees", "enrollment"),
  item("postgraduate", "accommodation", "other", "conditional", "Students using NUAA accommodation", "Budget CNY 8,000 per year for a small single room, CNY 14,000 for a large single room, CNY 4,000 for a small double-room place, or CNY 7,000 for a large double-room place; published figures are averages and may change.", "document", "Tuition & Fees", "enrollment"),
];

function postgraduateDocument(degree: "Master" | "Doctoral", business: boolean) {
  const source = sources.get("nuaa-postgraduate-admissions-2026")!;
  const tuition = degree === "Master" ? (business ? 30000 : 33600) : (business ? 34000 : 37800);
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "postgraduate", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
    requirements: [...postgraduateCommon(degree),
      item("postgraduate", "tuition", "application_policy", "required", `${business ? "Business and management" : "Engineering"} ${degree.toLowerCase()} students`,
        `Pay tuition of CNY ${tuition.toLocaleString("en-US")} per academic year.`, "document", "Tuition & Fees", "enrollment")],
  });
}

const group = (degree: string, language: string, tuition: number) => seed.programs.filter((program) => program.degreeLevel === degree
  && program.teachingLanguage === language && program.tuitionAmount === tuition);
const definitions = [
  { key: "nuaa-undergraduate-chinese-business-fall-2026", rows: group("Undergraduate", "Chinese", 22900), document: undergraduateDocument("Chinese", true) },
  { key: "nuaa-undergraduate-english-business-fall-2026", rows: group("Undergraduate", "English", 22900), document: undergraduateDocument("English", true) },
  { key: "nuaa-undergraduate-chinese-engineering-fall-2026", rows: group("Undergraduate", "Chinese", 23900), document: undergraduateDocument("Chinese", false) },
  { key: "nuaa-undergraduate-english-engineering-fall-2026", rows: group("Undergraduate", "English", 23900), document: undergraduateDocument("English", false) },
  { key: "nuaa-master-business-management-fall-2026", rows: group("Master", "English", 30000), document: postgraduateDocument("Master", true) },
  { key: "nuaa-master-engineering-fall-2026", rows: group("Master", "English", 33600), document: postgraduateDocument("Master", false) },
  { key: "nuaa-doctoral-business-management-fall-2026", rows: group("Doctoral", "English", 34000), document: postgraduateDocument("Doctoral", true) },
  { key: "nuaa-doctoral-engineering-fall-2026", rows: group("Doctoral", "English", 37800), document: postgraduateDocument("Doctoral", false) },
];
if (definitions.some((definition) => definition.rows.length === 0)
  || definitions.reduce((sum, definition) => sum + definition.rows.length, 0) !== 77) throw new Error("NUAA requirement groups are incomplete.");
const closedNote = "This is a closed historical Fall 2026 route and must not be presented as a current application window.";
const templates = definitions.map((definition) => ({
  key: definition.key, schoolSlug: "nanjing-university-of-aeronautics-and-astronautics", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [closedNote], document: definition.document,
}));
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located complete-scope NUAA 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
