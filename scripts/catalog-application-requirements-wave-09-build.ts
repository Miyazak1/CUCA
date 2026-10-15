import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-09.draft.json");
const programSlug = "central-south-university-iclts-one-semester-chinese-language-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T03-42-05-953Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "csu-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "7a48ccdd412b267f15145975ea8eb385a32f83aad7655d233acfaa1441883fb7") {
  throw new Error("CSU requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.csu-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("CSU Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "csu_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "csu_iclts", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section I, Eligibility, item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Maintain a friendly attitude toward China, have no criminal record, and comply with Chinese laws and regulations and the host institution's rules.", "self_report", "Section I, Eligibility, item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and demonstrate strong academic performance and conduct.", "school_review", "Section I, Eligibility, item 3"),
    item("career_commitment", "other", "required", "Applicants", "Be committed to working in Chinese-language education, teaching, or a related field.", "self_report", "Section I, Eligibility, item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old as of September 1, 2026. The upper age limit is 45 for in-service Chinese-language teachers.", "document", "Section I, Eligibility, item 5"),
    item("hsk_level_3", "language", "required", "One-semester Chinese Language Study applicants", "Provide an HSK Level 3 score of at least 180.", "official_result", "Section II, Scholarship Qualifications"),
    item("hskk", "language", "required", "One-semester Chinese Language Study applicants", "Provide an HSKK test score.", "official_result", "Section II, Scholarship Qualifications"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Section II, Scholarship Qualifications"),
    item("csu_online_application", "application_policy", "required", "Applicants", "Register in the CSU China International Student Service System, choose the CSU Scholarship for International Chinese Language Teachers route, upload the application materials, and submit the application.", "school_review", "Section V, Online Registration on CSU Application Website"),
    item("document_language", "documents", "required", "Applicants", "Provide materials in English or Chinese. Materials in another language must be notarized in Chinese or English.", "document", "Section V, application-material language rule"),
    item("passport", "identity", "required", "Applicants", "Submit a scanned copy of the passport photo page with more than one year of remaining validity.", "document", "Section V, application materials, item 1"),
    item("hsk_hskk_reports", "language", "required", "Applicants", "Submit scanned HSK and HSKK score reports that are within their two-year validity period.", "official_result", "Section V, application materials, item 2"),
    item("recommending_institution_letter", "documents", "required", "Applicants", "Submit a reference letter from the head of the recommending institution.", "document", "Section V, application materials, item 3"),
    item("minor_guardian_documents", "documents", "conditional", "Applicants under 18", "Submit the certified identity and other certificates specified by the guide and a letter of guarantee from a guardian living in China. The guide's inclusion of an employment certificate in this minor-applicant item requires editorial clarification.", "document", "Section V, application materials, item 4"),
    item("physical_examination", "documents", "required", "Applicants", "Submit a copy of the Physical Examination Record. An incomplete form is invalid, and the examination date must be after September 1, 2026.", "document", "Section V, application materials, item 5"),
    item("graduation_certificate", "documents", "required", "Applicants", "Submit the highest graduation certificate; a current student must instead submit a pre-graduation certificate issued by the school.", "document", "Section V, application materials, item 6"),
    item("academic_transcript", "academic_results", "required", "Applicants", "Submit the transcript for the highest diploma with an official stamp.", "document", "Section V, application materials, item 7"),
    item("non_criminal_record", "documents", "required", "Applicants", "Submit a non-criminal record with an official stamp, issued after September 1, 2026.", "document", "Section V, application materials, item 8"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and a recommendation letter from the employer.", "document", "Section V, application materials, item 9"),
    item("application_fee", "application_policy", "required", "Applicants who pass CSU's online preliminary review", "Pay the application fee after passing the online preliminary review; otherwise the application cannot continue. Applicants who do not pass the preliminary review do not pay. The amount is not stated on this page.", "document", "Section V, Pay the Application Fee"),
    item("scholarship_system_application", "application_policy", "required", "Applicants", "Also register in the International Chinese Language Teachers Scholarship application system, select Central South University as host institution, and upload the application materials.", "school_review", "Section V, Online Registration on International Chinese Language Teachers Scholarship Application Website"),
    item("application_reference_numbers", "application_policy", "required", "Applicants", "Send the application reference numbers from both systems to CSU through the official channel specified in the guide. Do not place those personal reference numbers in the public catalog.", "school_review", "Section V, Send Application Numbers"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the student application by October 31, 2026 Beijing Time.", "document", "Section IV, Application Deadlines (year derived from guide context)"),
    item("interview", "application_policy", "conditional", "Applicants selected by CSU", "Complete an interview and provide additional supporting materials if CSU requests them.", "school_review", "Section VI, Other requirements, item 3"),
    item("registration_and_originals", "application_policy", "required", "Admitted scholarship recipients", "Register on time, present original documents for review, pass the pre-enrollment medical examination, and follow the scholarship attendance rules. Fraud, inconsistency, failed medical examination, unauthorized no-show, early withdrawal, or suspension may cancel admission or scholarship eligibility.", "school_review", "Section VI, Other requirements, items 1-2", "enrollment"),
    item("evaluation_fee_nonrefundable", "application_policy", "required", "Applicants who pay the evaluation fee", "The evaluation fee is nonrefundable regardless of the admission result.", "document", "Section VI, Other requirements, item 4"),
  ],
});
const template = {
  key: "csu-iclts-one-semester-chinese-language-spring-2027",
  schoolSlug: "central-south-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit_with_derived_deadline_year", targetPrograms: "explicit", requirements: "explicit_with_source_wording_review" },
  unresolvedNotes: [
    "The registered source changed to a newly published 2027 Spring guide and requires editorial change review before publication.",
    "The guide states October 31 without repeating the year; 2026 is retained as a derived value requiring review.",
    "The application/evaluation fee amount is unresolved because the current page does not publish it.",
    "The under-18 materials item unexpectedly says employment certificates; its exact source wording is retained as a review flag rather than silently corrected.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Complete source-located CSU Spring 2027 one-semester scholarship requirements with an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
