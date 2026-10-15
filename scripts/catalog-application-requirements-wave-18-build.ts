import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-18.draft.json");
const programSlug = "zhejiang-university-iclts-chinese-language-and-literature-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T05-28-04-209Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "zju-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "2b88b8fadfe9f84d079829ae65008ab977a1277672f3fbea4baf4f6b8bae7f4c") {
  throw new Error("Zhejiang University requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.zju-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Zhejiang University Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "zju_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "zju_iclts", url: source.url, title: "Zhejiang University 2026 International Chinese Language Teachers Scholarship Application Guide", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Eligibility item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and university rules.", "self_report", "Eligibility item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Eligibility item 3"),
    item("career_interest", "other", "required", "Applicants", "Intend to engage in Chinese-language education, teaching, or related work.", "self_report", "Eligibility item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 18 to 35 years old as of September 1, 2026; in-service Chinese-language teachers may be up to 45.", "document", "Eligibility item 5"),
    item("hsk_hskk", "language", "required", "One-semester Chinese Language and Literature applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK result. The official page does not state a minimum HSKK score for this route.", "official_result", "Scholarship category 2"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Scholarship category 2"),
    item("dual_system_application", "application_policy", "required", "Applicants", "Complete applications in both the International Chinese Language Teachers Scholarship system and the Zhejiang University international-student application system.", "school_review", "Application procedure and deadline"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the online applications by October 31, 2026. The official page does not state a cutoff time.", "document", "Application deadline item 2"),
    item("passport", "documents", "required", "Applicants", "Submit a scanned copy of the passport photo page; the passport must remain valid through March 1, 2027 or later.", "document", "Application materials item 1"),
    item("language_scores", "documents", "required", "Applicants", "Submit scanned HSK and HSKK score reports that remain within their two-year validity period.", "official_result", "Application materials item 2"),
    item("recommending_institution_reference", "documents", "required", "Applicants", "Submit a recommendation letter from the person responsible for the recommending institution.", "document", "Application materials item 3"),
    item("material_language", "documents", "required", "Applicants submitting documents in a language other than Chinese or English", "Provide notarized translations for application materials not written in Chinese or English.", "document", "Application materials note 2"),
    item("electronic_submission_only", "application_policy", "required", "Applicants", "Upload materials through the application systems; materials mailed on paper or sent by email will not be reviewed.", "school_review", "Application materials note 1"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "An employment certificate and recommendation letter from the employing institution may be provided and receive priority under otherwise equal conditions.", "document", "In-service Chinese-language teachers item 1"),
    item("chinese_bridge_certificate", "documents", "conditional", "Chinese Bridge award recipients", "Apply in the scholarship system using the International Chinese Language Teachers Scholarship certificate.", "document", "Chinese Bridge award recipients item 2"),
    item("enrollment_compliance", "application_policy", "required", "Scholarship recipients", "Scholarship eligibility may be cancelled for a failed entry medical examination, withdrawal, failure to register on time without permission, or suspension of study.", "school_review", "Other conditions", "enrollment"),
  ],
});
const template = {
  key: "zju-iclts-chinese-language-and-literature-spring-2027",
  schoolSlug: "zhejiang-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [
    "The official page lists covered benefit categories but refers elsewhere for monetary standards.",
    "The official page does not state a minimum HSKK score for the one-semester route.",
    "The official page states an October 31, 2026 deadline but does not state a cutoff time.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located Zhejiang University Spring 2027 one-semester scholarship requirements with full published materials, dual-system procedure and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
