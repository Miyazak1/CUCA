import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-05.draft.json");
const programSlug = "zhejiang-university-of-technology-iclts-one-semester-chinese-language-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T07-11-22-013Z/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "zjut-international-chinese-language-teachers-scholarship-2027-spring");
if (!source || source.status !== 200 || source.sha256 !== "f791ea59d259c7b31634789605755e24dcbd94b87a426c5f2f23dd1e60bdd454") throw new Error("ZJUT Spring 2027 scholarship evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.zjut-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("ZJUT Spring 2027 program-intake binding is missing or not open.");
}

function item(key: string, category: RequirementItem["category"], stage: RequirementItem["stage"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "zjut_iclts_2027", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1, language: "en", coverage: "complete",
  sources: [{ key: "zjut_iclts_2027", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "submission", "required", "Scholarship applicants", "Be a non-Chinese citizen.", "document", "Heading 'Scholarship Eligibility', item 1"),
    item("conduct", "identity", "submission", "required", "Scholarship applicants", "Be friendly to China, have no criminal record, and comply with Chinese law and university rules.", "self_report", "Heading 'Scholarship Eligibility', item 2"),
    item("health_academics", "education", "submission", "required", "Scholarship applicants", "Be in good physical and mental condition with good academic performance and conduct.", "school_review", "Heading 'Scholarship Eligibility', item 3"),
    item("career_intent", "application_policy", "submission", "required", "Scholarship applicants", "Intend to work in Chinese-language education or related fields.", "self_report", "Heading 'Scholarship Eligibility', item 4"),
    item("age", "identity", "submission", "required", "Scholarship applicants", "Be age 16-35 under the page's stated reference date; currently employed Chinese-language teachers may be up to age 45.", "document", "Heading 'Scholarship Eligibility', item 5"),
    item("language_chinese_education", "language", "submission", "conditional", "One-semester International Chinese Education or Chinese Language and Literature applicants", "Provide HSK Level 3 with at least 180 and an HSKK score report, both within their two-year validity period.", "official_result", "Heading 'Scholarship Category', One-Semester Study Program, first bullet; heading 'Application Materials', item 2"),
    item("language_taiji", "language", "submission", "conditional", "One-semester Taiji Culture applicants", "Provide an HSK score report; applicants who also provide HSKK receive priority.", "official_result", "Heading 'Scholarship Category', One-Semester Study Program, second bullet"),
    item("prior_scholarship", "application_policy", "submission", "conditional", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Note below 'One-Semester Study Program'"),
    item("passport", "identity", "submission", "required", "Scholarship applicants", "Upload a scanned copy of the passport photo page.", "document", "Heading 'Application Materials', item 1"),
    item("education_records", "education", "submission", "required", "Scholarship applicants", "Submit the highest diploma or expected-graduation proof and an official transcript.", "document", "Heading 'Application Materials', item 3"),
    item("in_service_documents", "documents", "submission", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and a reference letter from the employer; under equal conditions, applicants providing both receive admission priority.", "document", "Heading 'Application Materials', item 5; heading 'Others', item 1"),
    item("guardian_under_18", "documents", "submission", "conditional", "Applicants under 18", "Submit certified designation documents signed by the entrusted legal guardian in China.", "document", "Heading 'Application Materials', item 6"),
    item("physical_exam", "documents", "submission", "required", "Scholarship applicants", "Submit a physical-examination form issued within six months.", "document", "Heading 'Application Materials', item 7"),
    item("non_criminal_record", "documents", "submission", "required", "Scholarship applicants", "Submit a no-criminal-record certificate issued within six months.", "document", "Heading 'Application Materials', item 8"),
    item("china_study_record", "documents", "submission", "conditional", "Applicants with prior study experience in China", "Submit an institution-stamped certificate of academic performance from the period of study in China.", "document", "Heading 'Application Materials', item 9"),
    item("application_window", "application_policy", "submission", "required", "March 2027 scholarship applicants", "Apply in the ZJUT system from September 1, 2026 and complete the ZJUT application by October 20, 2026.", "document", "Heading 'Application Procedure', step 1; heading 'Application Deadline'"),
    item("two_system_process", "application_policy", "submission", "required", "Scholarship applicants", "Select the International Chinese Language Teacher Scholarship Program category in the ZJUT system. After ZJUT review and issuance of its recommendation letter, submit the materials and recommendation through the CIS scholarship platform before the deadline.", "school_review", "Heading 'Application Procedure', steps 1-3"),
    item("application_tracking", "application_policy", "submission", "required", "Applicants who completed both submissions", "Use the CIS application website to follow application progress, review comments and scholarship evaluation results.", "school_review", "Heading 'Application Procedure', step 4"),
    item("admission_result", "application_policy", "preparation", "required", "Applicants", "Monitor the submitted email address for the final admission result.", "official_result", "Heading 'Application Procedure', step 5"),
    item("chinese_bridge_certificate", "documents", "submission", "conditional", "Applicants holding an International Chinese Language Teachers Scholarship Certificate from a Chinese Bridge competition", "Submit the application documents together with the scholarship certificate directly to the host institution through the scholarship website.", "document", "Heading 'Others', item 2"),
    item("material_authenticity", "application_policy", "submission", "required", "Applicants", "Ensure all application materials are authentic and valid; otherwise admission will be cancelled.", "school_review", "Heading 'Others', item 4"),
    item("scholarship_continuation", "application_policy", "enrollment", "required", "Admitted scholarship recipients", "Pass the pre-enrollment physical examination, register at the university as required, do not withdraw before completing study, and do not take unauthorized leave; otherwise scholarship eligibility is cancelled.", "school_review", "Heading 'Others', item 3"),
    item("off_campus_accommodation", "application_policy", "enrollment", "conditional", "Scholarship recipients requesting off-campus accommodation", "Obtain university approval before living off campus; approved students receive the published RMB 700 monthly accommodation allowance.", "school_review", "Heading 'Coverage and Standard', accommodation bullet"),
    item("insurance_reimbursement", "application_policy", "enrollment", "required", "Scholarship recipients", "Purchase the required comprehensive medical insurance first; the premium is refunded to the student's bank card after registration and check-in are completed.", "document", "Heading 'Coverage and Standard', insurance bullet"),
  ],
});
const template = {
  key: "zjut-iclts-one-semester-spring-2027", schoolSlug: "zhejiang-university-of-technology", cycle: "spring-2027",
  targetProgramSlugs: [programSlug], targetIntake: { term: "Spring", year: 2027 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit_multi_source", requirements: "explicit" },
  unresolvedNotes: ["The target is a dedicated non-degree scholarship route supported jointly by the official language-program page and the official Spring 2027 scholarship notice; publication still requires review."], document,
};
const output = { version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located current Spring 2027 scholarship application requirements with an exact non-degree intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1,
    targetedIntakeCount: 1, requirementItemCount: document.requirements.length }, templates: [template] };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
