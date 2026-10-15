import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-12.draft.json");
const programSlug = "tianjin-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T04-01-01-888Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "tju-international-chinese-language-teachers-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "7b93f2d6dbd621f020a71bc865399ad453ec71cced9daabf1c15557b18aecd66") {
  throw new Error("Tianjin University requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.tju-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Tianjin University Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "tju_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "tju_iclts", url: source.url, title: "Tianjin University 2026 International Chinese Language Teachers Scholarship", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, Eligibility, item a"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and Tianjin University rules.", "self_report", "Section I, Eligibility, item b"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Section I, Eligibility, item c"),
    item("career_interest", "other", "required", "Applicants", "Be interested in Chinese-language education and related work.", "self_report", "Section I, Eligibility, item d"),
    item("age_range", "identity", "required", "Applicants", "Be 18 to 35 years old on September 1, 2026. The maximum age may be extended to 45 for in-service Chinese teachers.", "document", "Section I, Eligibility, item e"),
    item("hsk_hskk_primary_tracks", "language", "conditional", "International Chinese Language Education or Chinese Language and Literature applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Section II, One-Semester Study Program, item 3.1"),
    item("hsk_taiji_track", "language", "conditional", "Taiji Culture applicants", "Provide an HSK score. Applicants who also provide an HSKK score receive priority.", "official_result", "Section II, One-Semester Study Program, item 3.2"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "Applicants who received the same scholarship within the previous three years are not eligible.", "school_review", "Section II, Scholarship for One-Semester Study Program"),
    item("dual_system_application", "application_policy", "required", "Applicants", "Complete online applications in both the International Chinese Language Teachers Scholarship system and the Tianjin University International Student Service System, choosing Tianjin University as host institution.", "school_review", "Section V, Application Procedures, item 1"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Apply from March 1 through October 31, 2026 Beijing Time.", "document", "Section V, deadline table, One-Semester Spring Semester"),
    item("passport", "documents", "required", "Applicants", "Submit a scanned copy of the passport photo page.", "document", "Section VII.A, item 1"),
    item("language_scores", "documents", "required", "Applicants", "Submit scanned HSK and HSKK score reports within their two-year validity period.", "official_result", "Section VII.A, item 2"),
    item("recommending_institution_reference", "documents", "required", "Applicants", "Submit a reference letter from the head of the recommending institution.", "document", "Section VII.A, item 3"),
    item("diploma_and_transcript", "documents", "required", "Applicants", "Submit the highest diploma or proof of expected graduation and an official transcript.", "document", "Section VII.A, item 4"),
    item("non_criminal_record", "documents", "required", "Applicants", "Submit a certificate of non-criminal records, normally issued within six months before the application submission date.", "document", "Section VII.A, item 5"),
    item("physical_examination", "documents", "conditional", "Applicants studying for more than one year", "Submit the Foreigner Physical Examination Form completed in Chinese or English. The examination must cover every listed item and the result is valid for six months.", "document", "Section VII.A, item 6"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and an employer reference letter. Eligible in-service teachers receive priority.", "document", "Sections VI.1 and VII.C"),
    item("translation_and_notarization", "documents", "conditional", "Documents not in Chinese or English", "Provide notarized translations for documents that are not in Chinese or English.", "document", "Section VII, Note"),
    item("zip_upload_instruction", "application_policy", "required", "Applicants submitting a non-criminal record certificate", "Upload the non-criminal record certificate together with the passport scan as a ZIP file in the system's passport-page upload field.", "document", "Section VII, Note"),
    item("materials_integrity", "application_policy", "required", "Applicants", "Incomplete, unqualified, fraudulent, or third-party-completed application materials may be rejected or cause disqualification.", "school_review", "Section VIII, Disclaimer, items 1-2"),
    item("host_confirmation", "application_policy", "required", "Successful applicants", "Tianjin University confirms admission after review; scholarship winners must register according to the admission notice.", "school_review", "Section V, Application Procedures, items 4-5", "enrollment"),
    item("late_registration_notice", "application_policy", "conditional", "Scholarship winners unable to register on time", "Notify Tianjin University in writing at least 15 days before the admission date and explain the reason; otherwise the scholarship may be canceled.", "school_review", "Section VIII, Disclaimer, item 3", "enrollment"),
    item("medical_and_study_continuity", "application_policy", "required", "Scholarship recipients", "Pass the admission physical examination and remain enrolled without dropping out or suspending studies; otherwise the scholarship may be canceled.", "school_review", "Section VIII, Disclaimer, item 4", "enrollment"),
  ],
});
const template = {
  key: "tju-iclts-one-semester-spring-2027",
  schoolSlug: "tianjin-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["The Chinese route title is a derived translation and requires editorial review before publication."],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located Tianjin University Spring 2027 one-semester scholarship requirements with complete official application details and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
