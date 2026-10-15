import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-11.draft.json");
const programSlug = "jilin-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T07-16-59-018Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "jilin-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "52d85413ac3fd139dd8a3ac90e9fa950ef7dd247755344738a5876824788a692") {
  throw new Error("Jilin requirement evidence mismatch.");
}
const clecManifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T12-18-58-607Z/manifest.json"), "utf8"));
const clecSource = (clecManifest.sources as Source[]).find((row) => row.id === "clec-international-chinese-language-teachers-scholarship-guidelines-2026");
if (!clecSource || clecSource.status !== 200 || clecSource.contentType !== "application/pdf"
  || clecSource.sha256 !== "0157c7fb5962657cc5f58be63cfc8a0898c4279ea8f87e15c40302fe90f981d7") {
  throw new Error("CLEC 2026 scholarship evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.jilin-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Jilin Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission", sourceKey = "jilin_iclts"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [
    { key: "jilin_iclts", url: source.url, title: "Application Guidelines for Jilin University International Chinese Language Teachers Scholarship 2026", capturedAt: source.fetchedAt, contentSha256: source.sha256 },
    { key: "clec_iclts", url: clecSource.url, title: clecSource.label, capturedAt: clecSource.fetchedAt, contentSha256: clecSource.sha256 },
  ],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, Eligibility, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and host-institution rules.", "self_report", "Section I, Eligibility, item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Section I, Eligibility, item 3"),
    item("career_interest", "other", "required", "Applicants", "Be interested in Chinese-language education and related work.", "self_report", "Section I, Eligibility, item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old on September 1, 2026. The maximum age may be extended to 45 for in-service Chinese-language teachers.", "document", "Section I, Eligibility, item 5"),
    item("hsk_hskk_primary_tracks", "language", "conditional", "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Section II, One-Semester Study Program, item 3.1"),
    item("hsk_tcm_taiji_tracks", "language", "conditional", "Traditional Chinese Medicine or Taiji Culture applicants", "Provide an HSK score. Applicants who also provide an HSKK score receive priority.", "official_result", "Section II, One-Semester Study Program, item 3.2"),
    item("application_opening", "application_policy", "required", "Applicants", "Use the International Chinese Language Teachers Scholarship website after online registration opens on March 1, 2026.", "school_review", "Section III, Application Procedures, opening date", "preparation"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply in the International Chinese Language Teachers Scholarship system, search for the recommending and host institutions, submit the required materials online, and track the review and result.", "school_review", "Section III, Application Procedures"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the application by October 31, 2026 Beijing Time.", "document", "Section III, March 2027 application deadline (year derived from guide context)"),
    item("evaluation_basis", "application_policy", "required", "Applicants", "The CLEC expert panel reviews applications using HSK and HSKK levels and scores, geographical distribution, and other factors.", "school_review", "Section III, paragraph after application deadlines"),
    item("result_timing", "application_policy", "required", "Applicants", "Scholarship results are expected to be published about three months before the program starts.", "official_result", "Section III, paragraph after application deadlines", "preparation"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and an employer recommendation letter. The guide states that eligible in-service teachers receive priority under equal conditions.", "document", "Section IV, In-service Chinese Language Teachers"),
    item("chinese_bridge_certificate", "documents", "conditional", "Chinese Bridge scholarship-certificate holders", "Submit the application materials and scholarship certificate directly to the selected host institution through the scholarship system.", "document", "Section IV, Chinese Bridge Winners"),
    item("passport_copy", "identity", "required", "All applicants", "Upload a scanned copy of the passport photo page.", "document", "Appendix 2, section I, item 1", "submission", "clec_iclts"),
    item("language_score_reports", "language", "required", "All applicants", "Upload scanned HSK and HSKK score reports that remain within their two-year validity period.", "official_result", "Appendix 2, section I, item 2", "submission", "clec_iclts"),
    item("recommending_institution_letter", "documents", "required", "All applicants", "Upload a reference letter from the head of the recommending institution.", "document", "Appendix 2, section I, item 3", "submission", "clec_iclts"),
    item("guardian_delegation", "identity", "conditional", "Applicants under 18", "Submit certified delegation documents signed by the entrusted legal guardian in China.", "document", "Appendix 2, section IV", "submission", "clec_iclts"),
    item("additional_host_documents", "documents", "conditional", "Applicants asked by Jilin University for additional evidence", "Provide any additional supporting documents requested by the host institution.", "document", "Appendix 2, section V", "submission", "clec_iclts"),
    item("scholarship_coverage", "application_policy", "required", "Scholarship recipients", "The scholarship covers tuition, on-campus accommodation, a living allowance and comprehensive medical insurance.", "document", "Appendix 1, opening coverage statement", "enrollment", "clec_iclts"),
    item("living_allowance", "application_policy", "required", "One-semester scholarship recipients", "The published living allowance is RMB 2,500 per month.", "document", "Appendix 1, item 3", "enrollment", "clec_iclts"),
    item("accommodation", "application_policy", "required", "Scholarship recipients", "The host institution normally provides a double room. A non-degree recipient permitted to live off campus receives an accommodation subsidy of RMB 700 per month under the published rules.", "document", "Appendix 1, item 2", "enrollment", "clec_iclts"),
    item("medical_insurance", "application_policy", "required", "One-semester scholarship recipients", "The scholarship includes comprehensive medical insurance at the published one-semester standard of RMB 400 per person.", "document", "Appendix 1, item 4", "enrollment", "clec_iclts"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Section V, Others, item 1"),
    item("admission_documents", "documents", "conditional", "Approved applicants", "After review and approval, receive the Admission Notice, the Visa Application for Study in China form, and other admission documents from Jilin University; follow the admission guide and related materials for registration details.", "official_result", "Section V, Others, item 4", "preparation"),
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
  fieldAssessment: { cycle: "explicit_with_derived_deadline_year", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [
    "The guide states October 31 for March 2027 entry without repeating the deadline year; 2026 is retained as a derived value requiring review.",
    "Jilin's mirrored appendix downloads are captcha-protected; the same 2026 coverage and materials are instead bound to the directly accessible official CLEC guidelines PDF.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Complete Jilin Spring 2027 one-semester scholarship requirements with an exact non-degree intake binding and official CLEC appendix evidence." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
