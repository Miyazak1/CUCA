import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-14.draft.json");
const programSlug = "beijing-normal-university-iclts-international-chinese-language-education-zhuhai-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T07-22-20-665Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "bnu-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "6c0063849bde8b5e40acb0d04fe60b1ff0a436de332beaab038953f82e24adce") {
  throw new Error("Beijing Normal University requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.bnu-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Beijing Normal University Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "bnu_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "partial",
  sources: [{ key: "bnu_iclts", url: source.url, title: "Beijing Normal University 2026 International Chinese Language Teachers Scholarship", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and university rules.", "self_report", "Section I, item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Section I, item 3"),
    item("career_interest", "other", "required", "Applicants", "Intend to work in Chinese-language education, teaching, or a related field.", "self_report", "Section I, item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old on September 1, 2026. The maximum age is 45 for in-service Chinese-language teachers.", "document", "Section I, item 5"),
    item("hsk_hskk", "language", "required", "International Chinese Language Education one-semester applicants", "Provide an HSK Level 4 score of at least 180 and an HSKK score.", "official_result", "Section II, item 5(1)"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received the same type of scholarship within the previous three years are not eligible.", "school_review", "Section VI, item 1"),
    item("application_opening", "application_policy", "required", "Applicants", "Use the International Chinese Language Teachers Scholarship section of the CLEC website after online applications open on March 1, 2026.", "school_review", "Section III, Application Process, opening date", "preparation"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply online through the International Chinese Language Teachers Scholarship section of the CLEC website, submit the required materials, track the review, and confirm study-in-China procedures with BNU if selected.", "school_review", "Section III, Application Process"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the student application by October 31, 2026 Beijing Time. The recommending institution and host-institution review deadline is November 10, 2026.", "document", "Section III, March 2027 deadline"),
    item("evaluation_basis", "application_policy", "required", "Applicants", "The CLEC expert panel reviews applications using HSK and HSKK levels and scores while also considering country distribution and other factors.", "school_review", "Section III, paragraph after application deadlines"),
    item("result_timing", "application_policy", "required", "Applicants", "Scholarship review is expected to finish and results to be published about three months before enrollment.", "official_result", "Section III, paragraph after application deadlines", "preparation"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Provide proof of employment and an employer recommendation letter to receive priority under equal conditions.", "document", "Section IV, item 1"),
    item("chinese_bridge_certificate", "documents", "conditional", "Chinese Bridge scholarship-certificate holders", "Apply through the scholarship system using the International Chinese Language Teachers Scholarship certificate and submit the application to the target host institution.", "document", "Section IV, item 2"),
    item("host_specific_materials", "documents", "required", "Applicants", "Review BNU's specific admission conditions and deadline and submit application materials under the applicable BNU rules. The captured page does not enumerate those materials.", "document", "Section VI, item 3"),
    item("host_enrollment_contact", "application_policy", "recommended", "Approved applicants", "Contact BNU promptly about enrollment and other arrival procedures.", "school_review", "Section VI, item 5", "enrollment"),
    item("enrollment_conditions", "application_policy", "required", "Scholarship recipients", "Pass the enrollment medical examination and register on time without unauthorized withdrawal or suspension; otherwise the scholarship may be canceled.", "school_review", "Section VI, items 5-6", "enrollment"),
  ],
});
const template = {
  key: "bnu-iclts-zhuhai-one-semester-spring-2027",
  schoolSlug: "beijing-normal-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "partial_due_to_unlisted_host_materials" },
  unresolvedNotes: [
    "The official BNU page instructs applicants to follow BNU-specific material requirements but does not enumerate them.",
    "The official BNU page does not state scholarship benefit categories or monetary amounts.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located BNU Zhuhai-campus Spring 2027 one-semester scholarship requirements with unresolved host-specific materials and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
