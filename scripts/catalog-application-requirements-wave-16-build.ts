import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-16.draft.json");
const programSlug = "huazhong-university-of-science-and-technology-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T04-29-31-490Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "hust-international-chinese-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "5641c761f60666f4d3d3bec29b97d94e4622357b58ae6930dfc90dd8027ea789") {
  throw new Error("HUST requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.hust-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("HUST Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "hust_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "hust_iclts", url: source.url, title: "HUST 2026 International Chinese Language Teachers Scholarship Guide", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Eligibility item a"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and HUST rules.", "self_report", "Eligibility item b"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Eligibility item c"),
    item("career_interest", "other", "required", "Applicants", "Be interested in Chinese-language education and related work.", "self_report", "Eligibility item d"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old on September 1, 2026. The maximum age is 45 for in-service Chinese-language teachers.", "document", "Eligibility item e"),
    item("hsk_hskk", "language", "required", "One-semester applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Scholarship Types and Qualifications, item E"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Apply through the International Chinese Language Teachers Scholarship section of the CLEC website and select Huazhong University of Science and Technology.", "school_review", "Application Procedures item a"),
    item("hust_system_application", "application_policy", "required", "Applicants", "After submitting the scholarship application, register and apply in the HUST international-student application system and upload the International Chinese Teachers Scholarship Application Form.", "school_review", "Application Procedures item b"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the student application by October 31, 2026 Beijing Time.", "document", "Application Procedures, March 2027 deadline"),
    item("passport", "documents", "required", "Applicants", "Submit a scanned copy of the passport photo page.", "document", "Application Documents item a"),
    item("language_scores", "documents", "required", "Applicants", "Submit scanned HSK and HSKK score reports within their two-year validity period.", "official_result", "Application Documents item b"),
    item("recommending_institution_reference", "documents", "required", "Applicants", "Submit a reference letter from the head of the recommending institution.", "document", "Application Documents item c"),
    item("highest_qualification_and_transcript", "documents", "required", "Applicants", "Submit certification of the highest education diploma or proof of expected graduation and an official transcript.", "document", "Application Documents item d"),
    item("physical_examination", "documents", "required", "Applicants", "Submit the Foreigner Physical Examination Form.", "document", "Application Documents item e"),
    item("no_criminal_record", "documents", "required", "Applicants", "Submit a certificate from a police station or law-enforcement agency confirming no previous criminal record.", "document", "Application Documents item f"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and an employer reference letter. Eligible in-service teachers receive priority under equal conditions.", "document", "Application Documents item g and section 6(a)"),
    item("guardian_documents", "documents", "conditional", "Applicants younger than 18", "Submit certified designation documents signed by the entrusted legal guardian in China.", "document", "Application Documents item h"),
    item("chinese_bridge_certificate", "documents", "conditional", "Chinese Bridge scholarship-certificate holders", "Apply through the scholarship website and submit the International Chinese Language Teachers Scholarship certificate with the application to HUST.", "document", "Section 6(b), Chinese Bridge Winners"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "Generally, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Miscellaneous item A"),
    item("materials_integrity", "application_policy", "required", "Applicants", "Provide true, complete and effective application materials; otherwise HUST will disqualify the application.", "school_review", "Miscellaneous item B"),
    item("enrollment_conditions", "application_policy", "required", "Scholarship recipients", "Pass the health assessment and do not withdraw or suspend studies; otherwise the scholarship will be revoked.", "school_review", "Miscellaneous item C", "enrollment"),
  ],
});
const template = {
  key: "hust-iclts-one-semester-spring-2027",
  schoolSlug: "huazhong-university-of-science-and-technology",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["The official page lists covered benefit categories but does not state their monetary amounts."],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located HUST Spring 2027 one-semester scholarship requirements with complete application materials, dual-system procedure and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
