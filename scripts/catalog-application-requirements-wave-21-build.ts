import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-21.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-10-33-646Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; cscaSubjects?: string[] };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const source = (manifest.sources as Source[]).find((row) => row.id === "hitsz-international-undergraduate-prospectus-pdf-2026");
if (!source || source.status !== 200 || source.contentType !== "application/pdf"
  || source.sha256 !== "b611b98782b8717c854fc9b29d9ecee71ef0f7741d30621cfab2cedbb13effc5") {
  throw new Error("HITSZ requirement evidence mismatch.");
}
const reviewedSource = source;
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.hitsz-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
const engineeringProgramSlugs = seed.programs.filter((program) => program.cscaSubjects?.includes("Physics (English)")).map((program) => program.slug);
const mathematicsProgramSlugs = seed.programs.filter((program) => !program.cscaSubjects?.includes("Physics (English)")).map((program) => program.slug);
const targetProgramSlugs = [...engineeringProgramSlugs, ...mathematicsProgramSlugs];
if (engineeringProgramSlugs.length !== 5 || mathematicsProgramSlugs.length !== 3 || targetProgramSlugs.length !== 8) {
  throw new Error("Unexpected HITSZ program grouping.");
}
for (const slug of targetProgramSlugs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed HITSZ Fall 2026 intake: ${slug}`);
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "hitsz_undergraduate", locator }] };
}

const commonRequirements: RequirementItem[] = [
  item("citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen and satisfy the Ministry of Education rules governing international-student enrollment.", "document", "PDF page 3, Eligibility item 1"),
  item("nationality_determination", "identity", "conditional", "Applicants whose nationality status is reviewed by Chinese authorities", "Remain eligible under the applicable nationality determination; a finding of Chinese nationality annuls international-applicant eligibility.", "school_review", "PDF page 3, Eligibility item 1 note"),
  item("education", "education", "required", "International undergraduate applicants", "Hold a high-school diploma.", "document", "PDF page 3, Eligibility item 2"),
  item("age", "identity", "required", "International undergraduate applicants", "Be under 25 years old.", "document", "PDF page 3, Eligibility item 3"),
  item("health", "other", "required", "International undergraduate applicants", "Be in good physical and mental health.", "school_review", "PDF page 3, Eligibility item 4"),
  item("application_window", "application_policy", "required", "Fall 2026 applicants", "Apply from December 30, 2025 through May 20, 2026.", "document", "PDF page 3, Application Period"),
  item("passport", "documents", "required", "Fall 2026 applicants", "Upload the passport information page; the passport must remain valid for at least two additional years.", "document", "PDF page 4, Application Materials item 1"),
  item("diploma", "documents", "required", "Fall 2026 applicants", "Upload the high-school graduation certificate; prospective graduates may submit a school-issued pre-graduation certificate and must present the original diploma at registration.", "document", "PDF page 4, Application Materials item 2", "enrollment"),
  item("transcripts", "documents", "required", "Fall 2026 applicants", "Upload official transcripts covering the full duration of high school.", "document", "PDF page 4, Application Materials item 3"),
  item("english_proficiency", "language", "required", "Fall 2026 applicants who are not exempt", "Submit TOEFL 80, IELTS 6.0 with no sub-test below 5.5, or Duolingo English Test 115; an English-medium prior qualification certificate may substitute, and applicants whose first language is English are exempt.", "official_result", "PDF page 4, Application Materials item 5"),
  item("curriculum_vitae", "documents", "required", "Fall 2026 applicants", "Submit a CV covering education and practical experience continuously from junior high school through the application date, with no unexplained gap longer than six months.", "document", "PDF page 4, Application Materials item 6"),
  item("physical_examination", "documents", "required", "Fall 2026 applicants", "Submit a Foreigner Physical Examination Form completed within six months before application, with every required item, photograph, signature and hospital stamp present.", "document", "PDF page 4, Application Materials item 7"),
  item("no_criminal_record", "documents", "required", "Fall 2026 applicants", "Submit a no-criminal-record certificate valid within six months.", "document", "PDF page 4, Application Materials item 8"),
  item("financial_capacity", "documents", "required", "Fall 2026 applicants", "Submit a bank statement showing at least CNY 20,000 or equivalent in the applicant's or legal guardian's account.", "document", "PDF page 4, Application Materials item 9"),
  item("minor_guardian", "documents", "conditional", "Applicants who will be under 18 on September 1, 2026", "Submit a guarantee letter from an adult guardian in China who is a Chinese citizen or holds a Chinese permanent-residence permit or work visa; documents issued abroad require Chinese consular notarization or an Apostille.", "document", "PDF page 4, Application Materials item 10"),
  item("application_fee_proof", "documents", "required", "Fall 2026 applicants", "Upload proof that the application fee was paid.", "document", "PDF page 4, Application Materials item 11"),
  item("achievement_evidence", "documents", "recommended", "Fall 2026 applicants", "Applicants may submit evidence of exceptional achievements in academics, sports, arts or public service.", "document", "PDF page 4, Application Materials item 12"),
  item("document_language", "documents", "required", "Fall 2026 applicants", "Submit documents in Chinese or English; other-language documents require a Chinese or English translation for whose completeness and accuracy the applicant is responsible.", "document", "PDF page 4, Important Notes item 1"),
  item("online_upload", "application_policy", "required", "Fall 2026 applicants", "Upload every application document to the HITSZ online application system and submit the completed application online.", "school_review", "PDF pages 4-5, Important Notes item 2 and Online Application Procedure"),
  item("submission_lock", "application_policy", "required", "Fall 2026 applicants", "Review the application before final submission because submitted materials generally cannot be changed unless the university requests a supplement.", "school_review", "PDF page 4, Important Notes item 3"),
  item("authenticity", "application_policy", "required", "All applicants", "Provide genuine personal information and application materials; false information or documents result in disqualification.", "school_review", "PDF page 5, Important Notes item 4"),
  item("additional_materials", "documents", "conditional", "Applicants contacted by the university", "Provide additional supporting materials when requested; submitted electronic and hard-copy materials are non-returnable.", "document", "PDF page 5, Important Notes item 5"),
  item("application_fee", "application_policy", "required", "Fall 2026 applicants", "Pay the non-refundable application fee of CNY 400 or USD 60.", "document", "PDF page 5, Fee Structure"),
  item("online_entrance_exam", "academic_results", "required", "Applicants passing preliminary review", "Take the university's online entrance examination in English at the time communicated through the application system and email.", "official_result", "PDF page 5, Admission Process items 1-2"),
  item("admission_assessment", "academic_results", "required", "Fall 2026 applicants", "Admission is based on the entrance-examination result and CSCA result; an applicant awaiting CSCA may receive only a preliminary decision until the CSCA report is submitted within the designated period.", "school_review", "PDF page 5, Admission Process item 3"),
  item("tuition", "application_policy", "required", "Admitted undergraduates", "Pay tuition of CNY 30,000 per academic year.", "document", "PDF page 5, Fee Structure", "enrollment"),
  item("other_fees", "other", "required", "Admitted undergraduates", "Budget CNY 800 per year for insurance, CNY 500 for the medical check-up and CNY 400 per year for the residence permit.", "document", "PDF page 5, Fee Structure", "preparation"),
  item("first_year_tuition", "application_policy", "required", "Admitted undergraduates", "Pay the full first-year tuition within 15 calendar days after receiving the Admission Notice; the published tuition payment is non-refundable.", "document", "PDF page 6, Tuition Payment Instructions item 1", "enrollment"),
  item("entrance_scholarship", "other", "recommended", "Fall 2026 applicants", "Submitting the admission application automatically enters the applicant for HITSZ Entrance Scholarship consideration; no separate scholarship action is required and later-year eligibility is reassessed.", "school_review", "PDF page 7, Scholarship Policy remarks 2-3"),
  item("accommodation", "other", "conditional", "First-year undergraduates seeking university accommodation", "Apply when dormitory reservations open; rooms are allocated first come, first served and are not guaranteed, and accommodation after the first year is subject to availability.", "self_report", "PDF page 7, Accommodation Arrangements", "preparation"),
];

function documentFor(group: "engineering" | "mathematics") {
  const engineering = group === "engineering";
  return parseRequirementDocument({
    schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "hitsz_undergraduate", url: reviewedSource.url, title: reviewedSource.label,
      capturedAt: reviewedSource.fetchedAt, contentSha256: reviewedSource.sha256 }],
    requirements: [
      ...commonRequirements,
      item("csca", "academic_results", "required", `${engineering ? "Engineering" : "Business Administration, Economics and Architecture"} applicants`,
        engineering ? "Submit CSCA Mathematics (English) and Physics (English) results." : "Submit a CSCA Mathematics (English) result.",
        "official_result", "PDF pages 2-3, Programs Offered table and Application Materials item 4"),
      item("program_preferences", "application_policy", "required", "Fall 2026 applicants", `List two program preferences within the ${engineering ? "Mathematics-and-Physics" : "Mathematics-only"} examination category; a second choice in a different examination category is not considered.`, "school_review", "PDF page 3, Programs Offered note 2"),
      item("entrance_exam_subjects", "academic_results", "required", `${engineering ? "Engineering" : "Business Administration, Economics and Architecture"} applicants`,
        engineering ? "Take the English-language HITSZ Mathematics and Physics entrance examination, which lasts 60 minutes." : "Take the English-language HITSZ Mathematics entrance examination, which lasts 45 minutes.",
        "official_result", "PDF page 3, Programs Offered table and note 4"),
    ],
  });
}

const templates = [
  { key: "hitsz-engineering-undergraduate-fall-2026", schoolSlug: "harbin-institute-of-technology-shenzhen",
    cycle: "fall-2026", targetProgramSlugs: engineeringProgramSlugs, targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
    document: documentFor("engineering") },
  { key: "hitsz-mathematics-undergraduate-fall-2026", schoolSlug: "harbin-institute-of-technology-shenzhen",
    cycle: "fall-2026", targetProgramSlugs: mathematicsProgramSlugs, targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
    document: documentFor("mathematics") },
];
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located HITSZ Fall 2026 undergraduate requirements bound only to exact existing program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: targetProgramSlugs.length, targetedIntakeCount: targetProgramSlugs.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
