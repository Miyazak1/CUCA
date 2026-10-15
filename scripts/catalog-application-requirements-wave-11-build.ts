import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-11.draft.json");
const programSlug = "jilin-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T03-54-04-632Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "jilin-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "52d85413ac3fd139dd8a3ac90e9fa950ef7dd247755344738a5876824788a692") {
  throw new Error("Jilin requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.jilin-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Jilin Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "jilin_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "partial",
  sources: [{ key: "jilin_iclts", url: source.url, title: "Application Guidelines for Jilin University International Chinese Language Teachers Scholarship 2026", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, Eligibility, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and host-institution rules.", "self_report", "Section I, Eligibility, item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Section I, Eligibility, item 3"),
    item("career_interest", "other", "required", "Applicants", "Be interested in Chinese-language education and related work.", "self_report", "Section I, Eligibility, item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old on September 1, 2026. The maximum age may be extended to 45 for in-service Chinese-language teachers.", "document", "Section I, Eligibility, item 5"),
    item("hsk_hskk_primary_tracks", "language", "conditional", "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Section II, One-Semester Study Program, item 3.1"),
    item("hsk_tcm_taiji_tracks", "language", "conditional", "Traditional Chinese Medicine or Taiji Culture applicants", "Provide an HSK score. Applicants who also provide an HSKK score receive priority.", "official_result", "Section II, One-Semester Study Program, item 3.2"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply in the International Chinese Language Teachers Scholarship system, search for the recommending and host institutions, submit the required materials online, and track the review and result.", "school_review", "Section III, Application Procedures"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the application by October 31, 2026 Beijing Time.", "document", "Section III, March 2027 application deadline (year derived from guide context)"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and an employer recommendation letter. The guide states that eligible in-service teachers receive priority under equal conditions.", "document", "Section IV, In-service Chinese Language Teachers"),
    item("chinese_bridge_certificate", "documents", "conditional", "Chinese Bridge scholarship-certificate holders", "Submit the application materials and scholarship certificate directly to the selected host institution through the scholarship system.", "document", "Section IV, Chinese Bridge Winners"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Section V, Others, item 1"),
    item("host_confirmation", "application_policy", "required", "Successful applicants", "Confirm the study-in-China procedures with Jilin University and register on the date stated in the admission letter.", "school_review", "Section III, Application Procedures", "enrollment"),
    item("pre_enrollment_and_attendance", "application_policy", "required", "Scholarship recipients", "Pass the pre-enrollment medical examination and comply with registration and attendance requirements. Failed examination, early withdrawal, unauthorized failure to register, or suspension of study disqualifies the recipient from the scholarship.", "school_review", "Section V, Others, item 5", "enrollment"),
  ],
});
const template = {
  key: "jilin-iclts-one-semester-spring-2027",
  schoolSlug: "jilin-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit_with_derived_deadline_year", targetPrograms: "explicit", requirements: "partial_due_to_protected_attachments" },
  unresolvedNotes: [
    "The guide states October 31 for March 2027 entry without repeating the deadline year; 2026 is retained as a derived value requiring review.",
    "The official coverage and application-material PDFs return a captcha page. Access controls were not bypassed, so the complete material list and monetary coverage remain unresolved.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located Jilin Spring 2027 one-semester scholarship requirements with unresolved protected attachments and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
