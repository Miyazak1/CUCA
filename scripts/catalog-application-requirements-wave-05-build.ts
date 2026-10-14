import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-05.draft.json");
const programSlug = "zhejiang-university-of-technology-iclts-one-semester-chinese-language-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/refresh-20261014-zjut-iclts-spring-2027/manifest.json"), "utf8"));
const source = (manifest.sources as Source[]).find((row) => row.id === "zjut-international-chinese-language-teachers-scholarship-2027-spring");
if (!source || source.status !== 200 || source.sha256 !== "cf418ebc0919a72dc86285ecfc6098d6b3b970d0ec2957cd71a51b5c2eeaa1a1") throw new Error("ZJUT Spring 2027 scholarship evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.zjut-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("ZJUT Spring 2027 program-intake binding is missing or not open.");
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string): RequirementItem {
  return { key, category, stage: "submission", level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "zjut_iclts_2027", locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1, language: "en", coverage: "partial",
  sources: [{ key: "zjut_iclts_2027", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "Scholarship applicants", "Be a non-Chinese citizen.", "document", "Heading 'Scholarship Eligibility', item 1"),
    item("conduct", "identity", "required", "Scholarship applicants", "Be friendly to China, have no criminal record, and comply with Chinese law and university rules.", "self_report", "Heading 'Scholarship Eligibility', item 2"),
    item("health_academics", "education", "required", "Scholarship applicants", "Be in good physical and mental condition with good academic performance and conduct.", "school_review", "Heading 'Scholarship Eligibility', item 3"),
    item("career_intent", "application_policy", "required", "Scholarship applicants", "Intend to work in Chinese-language education or related fields.", "self_report", "Heading 'Scholarship Eligibility', item 4"),
    item("age", "identity", "required", "Scholarship applicants", "Be age 16-35 under the page's stated reference date; currently employed Chinese-language teachers may be up to age 45.", "document", "Heading 'Scholarship Eligibility', item 5"),
    item("language_chinese_education", "language", "conditional", "One-semester International Chinese Education or Chinese Language and Literature applicants", "Provide HSK Level 3 with at least 180 and an HSKK score report, both within their two-year validity period.", "official_result", "Heading 'Scholarship Category', One-Semester Study Program, first bullet; heading 'Application Materials', item 2"),
    item("language_taiji", "language", "conditional", "One-semester Taiji Culture applicants", "Provide an HSK score report; applicants who also provide HSKK receive priority.", "official_result", "Heading 'Scholarship Category', One-Semester Study Program, second bullet"),
    item("prior_scholarship", "application_policy", "conditional", "One-semester applicants", "In principle, applicants who received a similar scholarship within the previous three years are not eligible.", "school_review", "Note below 'One-Semester Study Program'"),
    item("passport", "identity", "required", "Scholarship applicants", "Upload a scanned copy of the passport photo page.", "document", "Heading 'Application Materials', item 1"),
    item("education_records", "education", "required", "Scholarship applicants", "Submit the highest diploma or expected-graduation proof and an official transcript.", "document", "Heading 'Application Materials', item 3"),
    item("in_service_documents", "documents", "conditional", "In-service Chinese-language teachers", "Submit proof of employment and a reference letter from the employer.", "document", "Heading 'Application Materials', item 5"),
    item("guardian_under_18", "documents", "conditional", "Applicants under 18", "Submit certified designation documents signed by the entrusted legal guardian in China.", "document", "Heading 'Application Materials', item 6"),
    item("physical_exam", "documents", "required", "Scholarship applicants", "Submit a physical-examination form issued within six months.", "document", "Heading 'Application Materials', item 7"),
    item("non_criminal_record", "documents", "required", "Scholarship applicants", "Submit a no-criminal-record certificate issued within six months.", "document", "Heading 'Application Materials', item 8"),
    item("china_study_record", "documents", "conditional", "Applicants with prior study experience in China", "Submit an institution-stamped certificate of academic performance from the period of study in China.", "document", "Heading 'Application Materials', item 9"),
    item("deadline", "application_policy", "required", "March 2027 scholarship applicants", "Complete the ZJUT application by October 20, 2026.", "document", "Heading 'Application Deadline'"),
    item("two_system_process", "application_policy", "required", "Scholarship applicants", "First submit materials in the ZJUT system. After ZJUT review and issuance of its recommendation letter, submit the materials and recommendation through the CIS scholarship platform before the deadline.", "school_review", "Heading 'Application Procedure', steps 1-4"),
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
