import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-17.draft.json");
const programSlug = "zhejiang-gongshang-university-iclts-chinese-language-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T05-19-20-347Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "zjsu-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "6471a83e0a0192fdfd7f9a8d0c32e4d20c6a74e293c30615facffed2ebf0fc6d") {
  throw new Error("Zhejiang Gongshang University requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.zjsu-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Zhejiang Gongshang University Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "zjsu_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "zjsu_iclts", url: source.url, title: "Zhejiang Gongshang University International Chinese Language Teachers Scholarship 2026 Application Guidelines", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Eligibility item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and host-institution rules.", "self_report", "Eligibility item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Eligibility item 3"),
    item("career_interest", "other", "required", "Applicants", "Be interested in Chinese-language education and related work.", "self_report", "Eligibility item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 18 to 35 years old on September 1, 2026.", "document", "Eligibility item 5"),
    item("hsk_hskk", "language", "required", "One-semester Chinese-language study applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Categories and Qualifications item 3(1)"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Categories and Qualifications item 3"),
    item("dual_system_application", "application_policy", "required", "Applicants", "Complete applications simultaneously in the International Chinese Language Teachers Scholarship system and the Zhejiang Gongshang University international-student application system before the deadline.", "school_review", "Application Procedures"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the online applications by October 31, 2026 Beijing Time.", "document", "Online Submission Deadline item 2"),
    item("passport", "documents", "required", "Applicants", "Submit a scanned copy of the photo page of a valid passport.", "document", "Application Materials item 1"),
    item("language_scores", "documents", "required", "Applicants", "Submit scanned HSK and HSKK score reports within their two-year validity period.", "official_result", "Application Materials item 2"),
    item("recommending_institution_reference", "documents", "required", "Applicants", "Submit a recommendation letter from the person in charge of the recommending institution.", "document", "Application Materials item 3"),
    item("highest_qualification_and_transcript", "documents", "required", "Applicants", "Submit proof of the highest academic degree and academic transcripts.", "document", "Application Materials item 4"),
    item("photos", "documents", "required", "Applicants", "Submit two two-inch photographs.", "document", "Application Materials item 5"),
    item("physical_examination", "documents", "required", "Applicants", "Submit the Foreigner Physical Examination Form with a result valid within six months.", "document", "Application Materials item 6"),
    item("guardian_documents", "documents", "conditional", "Applicants younger than 18", "Submit a power of attorney signed by the guardian in China.", "document", "Application Materials item 7"),
    item("no_criminal_record", "documents", "required", "Applicants", "Submit a certificate of no criminal record valid within six months.", "document", "Application Materials item 8"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Attach an employment certificate and recommendation letter issued by the employing institution, if available.", "document", "Application Materials item 9"),
    item("application_fee_receipt", "documents", "required", "Applicants", "Submit the remittance receipt for the application fee. The captured official page does not state the fee amount.", "document", "Application Materials item 10"),
    item("registration", "application_policy", "required", "Scholarship recipients", "Confirm the study-in-China procedures with Zhejiang Gongshang University and register on time according to the admission notice.", "school_review", "Application Procedures", "enrollment"),
  ],
});
const template = {
  key: "zjsu-iclts-chinese-language-study-spring-2027",
  schoolSlug: "zhejiang-gongshang-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [
    "The official page lists covered benefit categories but does not state their monetary amounts.",
    "The official page requires an application-fee remittance receipt but does not state the fee amount.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located Zhejiang Gongshang University Spring 2027 one-semester scholarship requirements with full materials, dual-system procedure and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
