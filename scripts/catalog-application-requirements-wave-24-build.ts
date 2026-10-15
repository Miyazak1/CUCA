import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-24.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-24-04-623Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const source = (manifest.sources as Source[]).find((row) => row.id === "nanning-gxmu-undergraduate-admission-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "8fe09f32b70210fee64ab4f0c9bc982803914adcbd00a31a42ed4136e3b9c138") {
  throw new Error("GXMU requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.gxmu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
const mbbsSlug = "guangxi-medical-university-mbbs";
const chineseProgramSlugs = seed.programs.map((program) => program.slug).filter((slug) => slug !== mbbsSlug);
const targetProgramSlugs = [mbbsSlug, ...chineseProgramSlugs];
if (chineseProgramSlugs.length !== 24 || targetProgramSlugs.length !== 25) throw new Error("Unexpected GXMU program set.");
for (const slug of targetProgramSlugs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed GXMU Fall 2026 intake: ${slug}`);
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "gxmu_undergraduate", locator }] };
}

const commonRequirements: RequirementItem[] = [
  item("age", "identity", "required", "International undergraduate applicants", "Be 16 to 30 years old.", "document", "General Requirements item 1"),
  item("minor_guardianship", "identity", "conditional", "Applicants under 18 at application time", "Provide legal-guardian information and a guardianship authorization signed by all three parties.", "document", "General Requirements item 1"),
  item("citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a foreign passport and satisfy the applicable Chinese nationality and Ministry of Education rules.", "document", "General Requirements item 2"),
  item("health_conduct", "other", "required", "International undergraduate applicants", "Be in good health, be friendly toward China and have no criminal record.", "document", "General Requirements item 3"),
  item("online_application", "application_policy", "required", "Fall 2026 applicants", "Register through the GXMU international-student portal, complete the application and upload every required material online; no paper mailing is required.", "school_review", "Application Procedure and Application Materials note"),
  item("application_fee", "application_policy", "required", "Fall 2026 applicants", "Pay the application fee when submitting the online documents; the reviewed guide does not state its amount and says rejected applicants are not refunded.", "document", "Application Procedure items 1-2"),
  item("application_window", "application_policy", "required", "Fall 2026 applicants", "Submit the fall application from January 1 through August 15, 2026.", "document", "Application Opens"),
  item("admission_review", "academic_results", "required", "Fall 2026 applicants", "Pass the admissions committee's review of academic performance, language proficiency and CSCA results.", "school_review", "Application Procedure and Important Notes"),
  item("interview", "academic_results", "required", "Shortlisted applicants", "Complete the online or telephone interview and obtain a provisional admission notice.", "school_review", "Application Procedure items 2-3"),
  item("admission_deposit", "application_policy", "required", "Provisionally admitted applicants", "Pay the admission deposit by the deadline in the provisional notice; the amount is not stated, nonpayment withdraws admission, and a personal withdrawal or failed registration makes it non-refundable.", "document", "Application Procedure items 4 and Important Notes item 2", "enrollment"),
  item("final_documents", "documents", "required", "Provisionally admitted applicants completing all steps", "Receive the official admission letter, JW202 form and orientation guide after completing the required steps and paying the deposit.", "document", "Application Procedure item 5", "preparation"),
  item("visa_and_arrival", "documents", "required", "Admitted applicants", "Apply for the visa independently and report to campus by the designated date.", "document", "Application Procedure item 6", "preparation"),
  item("diploma", "documents", "required", "Fall 2026 applicants", "Submit a genuine high-school graduation certificate or an equivalent qualification recognized by GXMU, such as A-Level or GED evidence.", "document", "Application Materials item 1"),
  item("transcripts", "documents", "required", "Fall 2026 applicants", "Submit all secondary-stage transcripts for grades 7 through 12, or transcripts for the equivalent qualification.", "document", "Application Materials item 2"),
  item("translation_notarization", "documents", "conditional", "Applicants whose diploma or transcripts are not in Chinese or English", "Provide Chinese or English translations and notarization for the affected diploma or transcript.", "document", "Application Materials items 1-2"),
  item("study_plan", "documents", "required", "Fall 2026 applicants", "Submit a study plan longer than 500 words, focused on the intended major and written in that major's teaching language.", "document", "Application Materials item 5"),
  item("video", "documents", "required", "Fall 2026 applicants", "Submit a three-minute video recorded in the intended major's teaching language and follow the portal's material-page specifications.", "document", "Application Materials item 6"),
  item("supporting_materials", "documents", "recommended", "Fall 2026 applicants", "Optionally submit other evidence of comprehensive qualities, such as publications or competition participation.", "document", "Application Materials item 7"),
  item("registration_charge", "application_policy", "required", "Enrolled international undergraduates", "Pay the published CNY 800 registration charge.", "document", "Fee Structure", "enrollment"),
  item("insurance", "documents", "required", "Enrolled international undergraduates", "Purchase the published student insurance at CNY 800 per year per person.", "document", "Fee Structure", "enrollment"),
  item("accommodation", "other", "conditional", "Students using GXMU accommodation", "Pay CNY 6,000 per person per year for a double room and a CNY 1,000 accommodation deposit.", "document", "Fee Structure", "enrollment"),
  item("registration_payment", "application_policy", "required", "Admitted applicants registering at GXMU", "At registration, pay full tuition, accommodation charges, the accommodation deposit and student insurance; other government-collected charges may apply.", "document", "Fee Structure note", "enrollment"),
];

function documentFor(route: "mbbs" | "chinese") {
  const mbbs = route === "mbbs";
  return parseRequirementDocument({
    schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "gxmu_undergraduate", url: source.url, title: source.label,
      capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
    requirements: [
      ...commonRequirements,
      item("csca", "academic_results", "required", mbbs ? "English-taught MBBS applicants" : "Chinese-taught undergraduate applicants",
        mbbs ? "Submit CSCA Mathematics and Chemistry results using the English papers; no Chinese-subject score is required."
          : "Submit CSCA Mathematics and Chemistry using the Chinese papers and also submit STEM Chinese.",
        "official_result", "Application Materials item 3"),
      item("csca_deadline", "academic_results", "required", "Self-funded Fall 2026 applicants", "Submit the required CSCA results by July 30, 2026.", "official_result", "Application Materials item 3(4)"),
      item("language_requirement", "language", "required", mbbs ? "English-taught MBBS applicants" : "Chinese-taught undergraduate applicants",
        mbbs ? "Submit IELTS above 5.5 overall with every component above 5, TOEFL iBT at least 70, TOEFL ITP at least 450, Duolingo above 90, or another English score recognized by GXMU."
          : "Submit a valid HSK Level 4 certificate issued within two years, with total score above 200 and every component above 60.",
        "official_result", "Application Materials item 4"),
      item("tuition", "application_policy", "required", mbbs ? "English-taught MBBS students" : "Chinese-taught undergraduate students",
        mbbs ? "Pay tuition of CNY 35,000 per academic year." : "Pay tuition of CNY 28,000 per academic year.",
        "document", "Fee Structure", "enrollment"),
    ],
  });
}

const closedNote = "This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window.";
const templates = [
  { key: "gxmu-mbbs-fall-2026", schoolSlug: "guangxi-medical-university", cycle: "fall-2026",
    targetProgramSlugs: [mbbsSlug], targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready",
    reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: [closedNote, "The reviewed guide requires an admission deposit but does not publish its amount; it is not conflated with the separately published accommodation deposit."],
    document: documentFor("mbbs") },
  { key: "gxmu-chinese-undergraduate-fall-2026", schoolSlug: "guangxi-medical-university", cycle: "fall-2026",
    targetProgramSlugs: chineseProgramSlugs, targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready",
    reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: [closedNote, "The reviewed guide requires an admission deposit but does not publish its amount; it is not conflated with the separately published accommodation deposit."],
    document: documentFor("chinese") },
];
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located GXMU Fall 2026 undergraduate requirements bound only to exact existing closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: targetProgramSlugs.length, targetedIntakeCount: targetProgramSlugs.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
