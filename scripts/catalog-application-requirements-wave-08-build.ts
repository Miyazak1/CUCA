import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-08.draft.json");
const programSlug = "beihang-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T03-34-12-697Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "beihang-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "ae0b491171b41b28531f552b4f284f24cc7a50fb35f483d0eb9a32854826ac9e") {
  throw new Error("Beihang requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.beihang-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Beihang Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "beihang_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "beihang_iclts", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, Eligibility, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Maintain a friendly attitude toward China, have no criminal record, and comply with Chinese laws and regulations and the university's rules.", "self_report", "Section I, Eligibility, item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and demonstrate strong academic performance and conduct.", "school_review", "Section I, Eligibility, item 3"),
    item("career_commitment", "other", "required", "Applicants", "Be committed to working in Chinese-language education, teaching, or a related field.", "self_report", "Section I, Eligibility, item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old as of September 1, 2026. The upper age limit is 45 for in-service Chinese-language teachers.", "document", "Section I, Eligibility, item 5"),
    item("hsk_hskk_language_tracks", "language", "conditional", "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Section II, One-Semester Study Program, first track"),
    item("hsk_tcm_taiji_tracks", "language", "conditional", "Traditional Chinese Medicine or Taiji Culture applicants", "Provide an HSK score. Applicants who also provide an HSKK score receive priority.", "official_result", "Section II, One-Semester Study Program, second track"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply through the International Chinese Language Teachers Scholarship section of the CLEC website, select Beihang University as the host institution, submit the application materials online, and track the review and final result in the system.", "school_review", "Section III, Application Procedures"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Submit the student application by October 31, 2026 Beijing Time.", "document", "Section III, Deadlines, March 2027 admission"),
    item("passport", "identity", "required", "Applicants", "Submit a scanned copy of the passport photo page.", "document", "Section VI, List of Application Materials, item 1"),
    item("hsk_hskk_reports", "language", "required", "Applicants", "Submit scanned HSK and HSKK score reports. The score reports are valid for two years.", "official_result", "Section VI, List of Application Materials, item 2"),
    item("recommending_institution_letter", "documents", "required", "Applicants", "Submit a recommendation letter from the head of the recommending institution.", "document", "Section VI, List of Application Materials, item 3"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and a recommendation letter issued by the employer.", "document", "Section VI, List of Application Materials, item 4"),
    item("minor_guardianship", "documents", "conditional", "Applicants under 18", "Submit entrusted-guardianship documents signed by a guardian in China.", "document", "Section VI, List of Application Materials, item 5"),
    item("beihang_interview", "application_policy", "required", "Applicants", "Attend the interview held by Beihang University and provide any additional proof materials it requires.", "school_review", "Section VI, List of Application Materials, item 6"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "Normally, applicants who received a similar scholarship within the previous three years are not admitted to the one-semester program.", "school_review", "Section V, Miscellaneous, item 1"),
    item("pre_enrollment_medical_and_registration", "application_policy", "required", "Scholarship recipients", "Pass the pre-enrollment medical examination, confirm enrollment with Beihang, and register by the date in the admission letter. Scholarship eligibility may be revoked for failing the examination, withdrawing early, registering late without permission, or suspending study.", "school_review", "Sections III and V, enrollment and scholarship-revocation rules", "enrollment"),
  ],
});
const template = {
  key: "beihang-iclts-one-semester-spring-2027",
  schoolSlug: "beihang-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit_with_derived_deadline_year", targetPrograms: "explicit", requirements: "explicit" },
  unresolvedNotes: ["The official 2026 guide states October 31 for March 2027 admission without repeating the year; 2026 is retained as a derived value requiring review.", "Scholarship coverage and monetary standards remain unresolved because the page directs applicants to Beihang for the current standard."],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Complete source-located Beihang Spring 2027 one-semester scholarship requirements with an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
