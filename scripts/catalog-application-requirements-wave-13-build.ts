import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-13.draft.json");
const programSlug = "beijing-language-and-culture-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T04-09-30-970Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "blcu-international-chinese-language-teachers-regular-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "73d71729ddb86f65d8197c8e690ac6ad466c800a1c97f84cfd567bc290e746f8") {
  throw new Error("BLCU requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.blcu-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("BLCU Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "blcu_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "blcu_iclts", url: source.url, title: "BLCU 2026 International Chinese Language Teachers Scholarship Regular Programs Guide", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and university rules.", "self_report", "Section I, item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Section I, item 3"),
    item("career_interest", "other", "required", "Applicants", "Intend to work in Chinese-language education, teaching, or related fields.", "self_report", "Section I, item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old on September 1, 2026. The maximum age is 45 for in-service Chinese-language teachers.", "document", "Section I, item 5"),
    item("hsk_hskk", "language", "required", "One-semester applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Section II, item 5"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received the same type of scholarship within the previous three years are not eligible.", "school_review", "Section VII, item 1"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply online through the International Chinese Language Teachers Scholarship section of the CLEC website, select the recommending institution and BLCU as host institution, submit materials, and track the review result.", "school_review", "Section IV, Application Process"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the application by October 31, 2026 Beijing Time.", "document", "Section IV, March 2027 deadline"),
    item("passport", "documents", "required", "Applicants", "Submit a scanned copy of the passport photo page.", "document", "Section VI, all applicants, item 1"),
    item("language_scores", "documents", "required", "Applicants", "Submit scanned HSK and HSKK score reports that remain within their two-year validity period.", "official_result", "Section VI, all applicants, item 2"),
    item("recommending_institution_reference", "documents", "required", "Applicants", "Submit a recommendation letter from the head of the recommending institution.", "document", "Section VI, all applicants, item 3"),
    item("highest_qualification", "documents", "required", "Applicants", "Submit the highest academic qualification or proof of expected graduation. Applicants using expected-graduation proof must provide the formal qualification before BLCU registration.", "document", "Section VI, all applicants, item 4"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and an employer recommendation letter. Eligible in-service teachers receive priority under equal conditions.", "document", "Sections V.1 and VI supplementary item 1"),
    item("guardian_documents", "documents", "conditional", "Applicants younger than 18", "Submit notarized guardian-guarantee documents for a foreign national residing in China or a Chinese resident in Beijing formally entrusted by the applicant's parents.", "document", "Section VI supplementary item 2"),
    item("materials_integrity", "application_policy", "required", "Applicants", "Do not submit false materials or conceal visa records in the passport; verified misconduct results in scholarship disqualification.", "school_review", "Section VI, note 1"),
    item("additional_materials", "documents", "conditional", "Applicants", "Provide additional materials if requested by BLCU.", "document", "Section VI, note 2"),
    item("single_government_scholarship", "application_policy", "required", "Applicants", "Apply for only one scholarship provided by a Chinese government institution; duplicate applications are invalid and may cause disqualification.", "school_review", "Section VII, item 6"),
    item("enrollment_conditions", "application_policy", "required", "Scholarship recipients", "Pass the enrollment medical examination and register on time without unauthorized withdrawal or suspension; otherwise the scholarship may be canceled.", "school_review", "Section VII, items 4-5", "enrollment"),
  ],
});
const template = {
  key: "blcu-iclts-one-semester-spring-2027",
  schoolSlug: "beijing-language-and-culture-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["The official page identifies covered benefit categories but does not state monetary amounts."],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located BLCU Spring 2027 one-semester scholarship requirements with complete route-specific application details and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
