import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-15.draft.json");
const programSlug = "shanghai-university-iclts-international-chinese-language-education-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; byteLength: number; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T04-21-08-816Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "shu-international-chinese-language-teachers-scholarship-2026");
if (!source || source.status !== 200 || source.contentType !== "application/pdf" || source.byteLength !== 1_691_575
  || source.sha256 !== "cb9703d6835e09db3391b4d8beedb5ab820a8484b9000a3277a48334731951c4") {
  throw new Error("Shanghai University requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.shu-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("Shanghai University Spring 2027 language program-intake binding is missing or not open.");
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "shu_iclts", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "shu_iclts", url: source.url, title: "Shanghai University 2026 International Chinese Language Teachers Scholarship Application Guide", capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen holding a valid ordinary passport.", "document", "Page 2, Eligibility item 1"),
    item("former_chinese_resident_nationality", "identity", "conditional", "Applicants who emigrated from mainland China, Hong Kong, Macao or Taiwan", "Hold a valid foreign passport or nationality document for at least four years and have lived abroad for at least two of the most recent four years by April 30, 2026, calculated under the guide's entry-and-exit rule.", "document", "Page 2, Eligibility item 1"),
    item("conduct_and_law", "identity", "required", "Applicants", "Be friendly to China, have no criminal record, and comply with Chinese laws, regulations, and university rules.", "self_report", "Pages 2-3, Eligibility item 2"),
    item("health_and_performance", "academic_results", "required", "Applicants", "Be in good physical and mental health and in good academic and behavioral standing.", "school_review", "Page 3, Eligibility item 3"),
    item("career_interest", "other", "required", "Applicants", "Intend to work in Chinese-language education, teaching, or related fields.", "self_report", "Page 3, Eligibility item 4"),
    item("age_range", "identity", "required", "Applicants", "Be 16 to 35 years old on September 1, 2026. The maximum age is 45 for in-service Chinese-language teachers.", "document", "Page 3, Eligibility item 5"),
    item("hsk_hskk", "language", "required", "International Chinese Language Education one-semester applicants", "Provide an HSK Level 3 score of at least 180 and an HSKK score.", "official_result", "Pages 3-4, Supporting Category item 4"),
    item("passport", "documents", "required", "Applicants", "Submit a clear scan of the ordinary-passport information page. Applicants outside their home country must also submit the visa page. The guide states that the passport must expire after March 1, 2026.", "document", "Page 4, application materials for all applicants, item 1"),
    item("photo", "documents", "required", "Applicants", "Submit a passport-size photo taken within the previous six months: bareheaded, full-face, blue background, 295 by 413 pixels, JPG and under 100 KB.", "document", "Page 4, application materials for all applicants, item 2"),
    item("language_scores", "documents", "required", "Applicants", "Submit scanned HSK and HSKK score reports within their two-year validity period. A web-result screenshot may be used at application, but the original certificate must be presented at registration.", "official_result", "Page 4, application materials for all applicants, item 3"),
    item("recommending_institution_reference", "documents", "required", "Applicants", "Submit a reference letter from the head of the recommending institution.", "document", "Pages 4-5, application materials for all applicants, item 4"),
    item("in_service_teacher_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and an employer recommendation letter to receive priority under equal conditions.", "document", "Page 6, in-service Chinese-language teachers"),
    item("chinese_bridge_certificate", "documents", "conditional", "Chinese Bridge scholarship-certificate holders", "Apply through the scholarship website using the International Chinese Language Teachers Scholarship certificate and submit the materials to Shanghai University.", "document", "Pages 6-7, Chinese Bridge winners"),
    item("document_translation", "documents", "conditional", "Applicants submitting documents not in Chinese or English", "Provide a notarized Chinese or English translation or a translation supplied by the issuing institution.", "document", "Page 6, Notes item 1"),
    item("original_documents", "documents", "required", "Scholarship recipients", "Upload electronic copies at application and present the original documents for verification at registration.", "document", "Pages 6 and 9, Notes and Other Matters", "enrollment"),
    item("materials_integrity", "application_policy", "required", "Applicants", "Upload clear, authentic and valid materials; false, unclear or unidentifiable materials may cause adverse consequences or disqualification.", "school_review", "Pages 6 and 9, Notes and Other Matters"),
    item("scholarship_system_application", "application_policy", "required", "Non-degree applicants", "Apply online through the International Chinese Language Teachers Scholarship section of the CLEC website and submit the application materials there. A Shanghai University application-system submission is not required for this non-degree route.", "school_review", "Page 7, Application Procedures, Step 1 and note"),
    item("deadline", "application_policy", "required", "March 2027 applicants", "Complete the student application by October 31, 2026 Beijing Time. The recommending institution and host-institution review deadline is November 10, 2026.", "document", "Page 8, Application Deadlines item 4"),
    item("similar_scholarship_history", "application_policy", "required", "One-semester applicants", "In principle, applicants who received the same type of scholarship within the previous three years are not eligible.", "school_review", "Page 8, Other Matters item 1"),
    item("direct_application", "application_policy", "required", "Applicants", "Submit the scholarship application directly to Shanghai University and do not use an intermediary agency; agency submission causes disqualification.", "school_review", "Pages 8-9, Other Matters item 6"),
    item("enrollment_conditions", "application_policy", "required", "Scholarship recipients", "Pass the enrollment medical examination, register on time, and do not withdraw or suspend studies without permission; otherwise the scholarship may be canceled.", "school_review", "Pages 8-9, Other Matters items 5 and 7", "enrollment"),
  ],
});
const template = {
  key: "shu-iclts-international-chinese-language-education-spring-2027",
  schoolSlug: "shanghai-university",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["The official guide says the passport must expire after March 1, 2026; this published date appears earlier than the March 2027 intake and is preserved without correction or inference."],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located Shanghai University Spring 2027 one-semester scholarship requirements with route-specific materials, benefit amounts and an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1, targetedIntakeCount: 1, requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
