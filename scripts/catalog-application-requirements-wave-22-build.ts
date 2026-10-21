import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-22.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-13-26-911Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const source = (manifest.sources as Source[]).find((row) => row.id === "hrbust-international-undergraduate-admissions-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "8e4bc248eaaeec322074a5f6240995993cd9ff1dd03edb66a9de7688fb2626d3") {
  throw new Error("HRBUST requirement evidence mismatch.");
}
const reviewedSource = source;
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.hrbust-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
const chineseEducationSlug = "harbin-university-of-science-and-technology-chinese-language-education";
const ordinaryProgramSlugs = seed.programs.map((program) => program.slug).filter((slug) => slug !== chineseEducationSlug);
const targetProgramSlugs = [chineseEducationSlug, ...ordinaryProgramSlugs];
if (ordinaryProgramSlugs.length !== 5 || targetProgramSlugs.length !== 6) throw new Error("Unexpected HRBUST program set.");
for (const slug of targetProgramSlugs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed HRBUST Fall 2026 intake: ${slug}`);
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "hrbust_undergraduate", locator }] };
}

const commonRequirements: RequirementItem[] = [
  item("academic_and_conduct", "education", "required", "International undergraduate applicants", "Have good academic results and conduct and demonstrate respect for Chinese culture.", "school_review", "Eligibility item 1"),
  item("citizenship_education_age", "identity", "required", "International undergraduate applicants", "Be a foreign citizen with an education equivalent to Chinese high-school graduation and generally be no older than 25.", "document", "Eligibility item 1"),
  item("health", "other", "required", "International undergraduate applicants", "Meet the Chinese-government health standards for international students.", "document", "Eligibility item 3"),
  item("financial_capacity", "documents", "required", "International undergraduate applicants", "Demonstrate the ability to pay the costs of study and living in China.", "document", "Eligibility item 4"),
  item("former_chinese_citizen", "identity", "conditional", "Applicants who formerly held Chinese citizenship", "Hold a valid foreign passport or nationality certificate for at least four years and show at least two years of actual residence abroad during the most recent four-year period ending April 30 of the enrollment year; nine months abroad in a year counts as one year.", "document", "Eligibility item 5"),
  item("application_form", "documents", "required", "Fall 2026 applicants", "Submit the completed HRBUST international-student admission application form.", "document", "Application Materials table, item 1"),
  item("graduation_evidence", "documents", "required", "Fall 2026 applicants", "Submit the high-school diploma; current graduates may submit an English expected-graduation certificate and must bring the original diploma at registration.", "document", "Application Materials table, items 2-3", "enrollment"),
  item("transcripts", "documents", "required", "Fall 2026 applicants", "Submit an English high-school transcript issued by the graduating school.", "document", "Application Materials table, item 4"),
  item("photo", "documents", "required", "Fall 2026 applicants", "Submit a recent two-inch, white-background, bareheaded digital identification photograph meeting the published file-format and image requirements.", "document", "Application Materials table, item 6"),
  item("passport", "documents", "required", "Fall 2026 applicants", "Submit the passport photograph page and, when applicable, the visa page.", "document", "Application Materials table, item 7"),
  item("physical_examination", "documents", "required", "Fall 2026 applicants", "Submit the Foreigner Physical Examination Form completed in English within six months, with all required items, photograph, signatures and hospital stamps.", "document", "Application Materials table, item 8 and explanatory note 5"),
  item("no_criminal_record", "documents", "required", "Fall 2026 applicants", "Submit a no-criminal-record certificate or the university's no-criminal-record undertaking form.", "document", "Application Materials table, item 9"),
  item("current_university_records", "documents", "conditional", "Applicants currently enrolled at a university", "Also submit an English transcript and proof of current enrollment from the university.", "document", "Application Materials table, item 11"),
  item("transfer_consent", "documents", "conditional", "Applicants transferring from a university in China", "Also submit the current Chinese university's consent to transfer.", "document", "Application Materials table, item 12"),
  item("nationality_documents", "documents", "conditional", "Applicants who formerly held Chinese citizenship", "Also submit naturalization evidence, proof of cancellation of the former Chinese household registration, passport entry and exit stamp pages for the most recent four years, and evidence of the most recent two years of study abroad.", "document", "Application Materials table, items 13-17"),
  item("original_documents", "documents", "required", "Fall 2026 applicants", "Submit electronic copies and retain or provide originals where the material table requires them for verification.", "school_review", "Application Materials table, format and original columns"),
  item("submission_route", "application_policy", "required", "Fall 2026 applicants", "Submit the electronic application materials through the university's published application channel and provide required originals to the International Cooperation and Exchange office.", "school_review", "Application Process items 1-3"),
  item("application_window", "application_policy", "required", "Fall 2026 applicants", "Submit application materials from March 1 through June 15, 2026.", "document", "Application-material submission period"),
  item("assessment", "academic_results", "required", "Fall 2026 applicants", "Pass the preliminary application review, the academic-school review and assessment, and the university's final review.", "school_review", "Assessment and Admission item 1"),
  item("admission_notification", "application_policy", "required", "Applicants proposed for admission", "Monitor the email address supplied in the application for the proposed-admission result, Admission Notice and JW202 materials.", "self_report", "Assessment and Admission items 1-2 and notes"),
  item("visa", "documents", "required", "Admitted applicants", "Use the ordinary passport, Admission Notice and JW202 materials to apply for an X1 visa before travel.", "document", "Visa and Registration item 1", "preparation"),
  item("registration", "application_policy", "required", "Admitted applicants", "Register on the date stated in the Admission Notice for the late-August enrollment period.", "document", "Visa and Registration item 2 and Start Date", "enrollment"),
  item("residence_permit", "documents", "required", "Admitted applicants", "Enter China with an ordinary passport and X1 visa and apply for a residence permit within 30 days after entry.", "document", "Visa and Registration item 3", "enrollment"),
  item("tuition", "application_policy", "required", "International undergraduates", "Pay tuition of CNY 15,000 per academic year.", "document", "Fees section", "enrollment"),
  item("accommodation", "other", "conditional", "International undergraduates using university accommodation", "Budget CNY 30 per person per day for a single room, CNY 25 for the single room in a three-person two-room unit, or CNY 20 for the double room in that unit; rooms are arranged by registration order and requested room type.", "self_report", "Fees and Accommodation sections", "preparation"),
  item("insurance", "documents", "required", "Registered international undergraduates", "Purchase accident and inpatient medical insurance after registration at a published cost of CNY 800 per year.", "document", "Insurance section", "enrollment"),
];

function documentFor(route: "chinese_education" | "ordinary") {
  const dedicated = route === "chinese_education";
  return parseRequirementDocument({
    schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "hrbust_undergraduate", url: reviewedSource.url, title: reviewedSource.label,
      capturedAt: reviewedSource.fetchedAt, contentSha256: reviewedSource.sha256 }],
    requirements: [
      ...commonRequirements,
      item("language_requirement", "language", dedicated ? "recommended" : "required",
        dedicated ? "Chinese Language Education applicants" : "Ordinary undergraduate applicants",
        dedicated ? "No prior Chinese proficiency or HSK certificate is required for the dedicated Chinese Language Education cohort."
          : "Submit a valid HSK Level 4 or higher certificate; the guide states that the certificate is valid for two years.",
        dedicated ? "self_report" : "official_result", "Program Classification and Eligibility item 2"),
      item("csca", "academic_results", "required", dedicated ? "Chinese Language Education applicants" : "Ordinary undergraduate applicants",
        dedicated ? "Submit a CSCA Mathematics result taken in Chinese or English."
          : "Submit CSCA STEM Chinese and Mathematics results, with Mathematics taken in Chinese.",
        "official_result", "CSCA section"),
    ],
  });
}

const templates = [
  { key: "hrbust-chinese-education-fall-2026", schoolSlug: "harbin-university-of-science-and-technology",
    cycle: "fall-2026", targetProgramSlugs: [chineseEducationSlug], targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
    document: documentFor("chinese_education") },
  { key: "hrbust-ordinary-undergraduate-fall-2026", schoolSlug: "harbin-university-of-science-and-technology",
    cycle: "fall-2026", targetProgramSlugs: ordinaryProgramSlugs, targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
    document: documentFor("ordinary") },
];
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located HRBUST Fall 2026 undergraduate requirements bound only to exact existing program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: targetProgramSlugs.length, targetedIntakeCount: targetProgramSlugs.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
