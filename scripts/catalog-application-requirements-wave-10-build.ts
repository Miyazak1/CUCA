import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-10.draft.json");
const programSlug = "chang-an-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T03-49-41-000Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "changan-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "44a976211332613aeb3f93c20d73e75d09247af5009779e4ac1cce4463d68728") {
  throw new Error("Chang'an requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.changan-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Chang'an Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "changan_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "changan_iclts", url: source.url, title: "关于申请2026年国际中文教师奖学金（TFSU）的通知", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship_health_and_performance", "identity", "required", "Applicants", "Be a non-Chinese citizen, be in good physical and mental health, and demonstrate good academic performance and conduct.", "document", "Section I, Eligibility, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Maintain a friendly attitude toward China, have no record of illegal or criminal conduct, and comply with Chinese laws, regulations, and university rules.", "self_report", "Section I, Eligibility, item 2"),
    item("career_commitment", "other", "required", "Applicants", "Intend to work in Chinese-language education, teaching, or a related field.", "self_report", "Section I, Eligibility, item 3"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old as of September 1, 2026. The upper age limit is 45 for in-service Chinese-language teachers.", "document", "Section I, Eligibility, item 4"),
    item("education_or_enrollment_status", "education", "required", "Applicants", "Have graduated from the most recent level of study or provide proof that the current institution will retain the applicant's enrollment status.", "document", "Section I, Eligibility, item 5"),
    item("similar_scholarship_history", "application_policy", "required", "Applicants", "Have not received a similar scholarship during the previous three years.", "school_review", "Section I, Eligibility, item 6"),
    item("hsk_level_3", "language", "required", "Spring 2027 one-semester applicants", "Provide an HSK Level 3 score of at least 180.", "official_result", "Section III, One-Semester Study Program, language requirement"),
    item("hskk", "language", "required", "Spring 2027 one-semester applicants", "Provide an HSKK score.", "official_result", "Section III, One-Semester Study Program, language requirement"),
    item("visa_restriction", "identity", "required", "Spring 2027 one-semester applicants", "The guide states that applicants whose passports contain an X1 or X2 visa will not be admitted to this route.", "document", "Section III, One-Semester Study Program, other requirement"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply online through the International Chinese Language Teachers Scholarship section of the CLEC website.", "school_review", "Section IV, Application Process, item 1"),
    item("university_system_application", "application_policy", "required", "Applicants", "Also apply and upload the required materials in the Chang'an University international student application system.", "school_review", "Section IV, Application Process, item 2"),
    item("application_fee", "application_policy", "required", "Applicants", "Pay the CNY 600 program application fee. The fee is nonrefundable whether or not admission is granted.", "document", "Section IV, Application Process, item 3"),
    item("passport", "identity", "required", "Applicants", "Submit a valid ordinary passport.", "document", "Section V, Application Materials, item 1"),
    item("residence_permit", "identity", "conditional", "Applicants currently in China", "Submit a valid residence permit in addition to the passport.", "document", "Section V, Application Materials, item 1"),
    item("graduation_document", "education", "conditional", "Applicants who are not currently enrolled", "Submit the highest diploma or degree certificate. A graduating student may submit a pre-graduation certificate and must bring the paper graduation certificate when registering if required by the guide.", "document", "Section V, Application Materials, item 2"),
    item("retained_enrollment_document", "education", "conditional", "Currently enrolled applicants", "Submit proof from the current institution that the applicant's enrollment status will be retained.", "document", "Section V, Application Materials, item 2"),
    item("academic_transcript", "academic_results", "required", "Applicants", "Submit an academic transcript.", "document", "Section V, Application Materials, item 3"),
    item("physical_examination", "documents", "required", "Applicants", "Submit a Foreigner Physical Examination Record issued within the previous six months, completed in Chinese or English. Missing pages, an unstamped photograph, a missing hospital seal, or a missing physician signature makes the record invalid.", "document", "Section V, Application Materials, item 4"),
    item("non_criminal_record", "documents", "required", "Applicants outside China", "Submit a non-criminal record issued within the previous six months.", "document", "Section V, Application Materials, item 5"),
    item("conduct_record_in_china", "documents", "conditional", "Applicants currently studying in China", "Instead of the general non-criminal record described for other applicants, submit a school-issued conduct or no-disciplinary-violation certificate.", "document", "Section V, Application Materials, item 5"),
    item("language_score_report", "language", "required", "Applicants", "Submit the HSK score report required for the route.", "official_result", "Section V, Application Materials, item 6"),
    item("study_motivation_or_plan", "documents", "required", "Applicants", "Submit a motivation letter or study plan for study in China.", "document", "Section V, Application Materials, item 7"),
    item("scholarship_application_form", "documents", "required", "Applicants", "Submit the International Chinese Language Teachers Scholarship application form downloaded after completing the scholarship-system application.", "document", "Section V, Application Materials, item 8"),
    item("recommending_institution_letter", "documents", "required", "Applicants", "Submit a recommendation letter issued by the recommending institution.", "document", "Section V, Application Materials, item 9"),
    item("minor_entrustment", "documents", "conditional", "Minor applicants", "Submit the minor entrustment document required by the guide.", "document", "Section V, Application Materials, item 11"),
    item("translation", "documents", "conditional", "Materials not in Chinese or English", "Submit the original material together with a Chinese or English translation bearing the seal of a formal translation company.", "document", "Section V, translation note"),
    item("in_service_teacher_documents", "documents", "recommended", "In-service Chinese-language teachers", "An employment certificate and employer recommendation letter may be submitted; the guide states that eligible in-service teachers receive priority under equal conditions.", "document", "Section VI, In-service Chinese-language teachers"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the student application by October 31, 2026 Beijing Time.", "document", "Section VIII, March 2027 entry deadline (year derived from guide context)"),
    item("on_time_registration", "application_policy", "required", "Scholarship recipients", "Register by the time stated in the admission notice or scholarship eligibility will be cancelled.", "school_review", "Section II, scholarship administration note 1", "enrollment"),
  ],
});
const template = {
  key: "changan-iclts-one-semester-spring-2027",
  schoolSlug: "chang-an-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit_with_derived_deadline_year", targetPrograms: "explicit", requirements: "explicit" },
  unresolvedNotes: [
    "The page title contains TFSU although the page is hosted by Chang'an University and the body names Chang'an University; the discrepancy requires editorial review.",
    "The guide states October 31 for March 2027 entry without repeating the deadline year; 2026 is retained as a derived value requiring review.",
    "The source's X1/X2 visa exclusion is preserved exactly in substance and requires policy review before publication.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Complete source-located Chang'an Spring 2027 one-semester scholarship requirements with an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
