import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-23.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-17-48-480Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const source = (manifest.sources as Source[]).find((row) => row.id === "guiyang-gmcu-undergraduate-admission-pdf-2026");
if (!source || source.status !== 200 || source.contentType !== "application/pdf"
  || source.sha256 !== "63ce26468c55164de9ecf534322a3972910fba4cba035e886067c143247cc798") {
  throw new Error("GMU requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.gmcu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
const clinicalSlug = "guizhou-medical-university-clinical-medicine";
const dentalSlug = "official-2026-gmcu-bachelor-dental-surgery-bds";
const targetProgramSlugs = [clinicalSlug, dentalSlug];
for (const slug of targetProgramSlugs) {
  if (!seed.programs.some((program) => program.slug === slug)) throw new Error(`Missing GMU program: ${slug}`);
  if (!seed.programIntakes.some((intake) => intake.programSlug === slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed GMU Fall 2026 intake: ${slug}`);
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "gmcu_undergraduate", locator }] };
}

const commonRequirements: RequirementItem[] = [
  item("citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen.", "document", "brochure page 5, Application Requirements item 4"),
  item("age", "identity", "required", "International undergraduate applicants", "Be 18 to 25 years old.", "document", "brochure page 5, Application Requirements item 1"),
  item("education", "education", "required", "International undergraduate applicants", "Hold a senior-high-school diploma or an equivalent qualification.", "document", "brochure page 5, Application Requirements item 2"),
  item("health", "other", "required", "International undergraduate applicants", "Be physically and mentally healthy.", "document", "brochure page 5, Application Requirements item 3"),
  item("conduct", "other", "required", "International undergraduate applicants", "Have no discipline violations, public-security punishment or criminal conduct, and comply with Chinese laws, regulations and customs.", "school_review", "brochure page 5, Application Requirements items 6-7"),
  item("chinese_origin_nationality", "identity", "conditional", "Applicants who emigrated from Mainland China, Hong Kong, Macao or Taiwan", "Hold a foreign passport or nationality certificate for more than four years, inclusive, and have resided abroad for more than two years by April 30, 2026.", "document", "brochure page 5, Application Requirements item 5"),
  item("academic_average", "academic_results", "required", "International undergraduate applicants", "Achieve an overall high-school academic score of at least 70 percent.", "document", "brochure page 5, Academic Requirements"),
  item("science_scores", "academic_results", "required", "International undergraduate applicants", "Achieve scores of at least 70 percent in Biology, Chemistry and Mathematics.", "document", "brochure page 5, Academic Requirements"),
  item("pakistan_hssc", "academic_results", "conditional", "Applicants from Pakistan presenting HSSC pre-medical results", "Achieve at least 750 out of 1100 or 800 out of 1200 in HSSC pre-medical study.", "document", "brochure page 5, Academic Requirements"),
  item("english_evidence", "language", "required", "Applicants whose first or official language is not English", "Submit recognized English-language evidence. The brochure contains two conflicting IELTS statements—6.5 in each component in its language panel and overall 6.0 in its academic panel—while both panels state TOEFL 80; editorial resolution is required before publication.", "official_result", "brochure page 5, Language Requirements and Academic Requirements"),
  item("english_medium_results", "language", "conditional", "Applicants whose first or official language is English", "Provide prior-stage academic results showing an English score of at least 75 percent.", "document", "brochure page 5, Language Requirements"),
  item("passport", "documents", "required", "Fall 2026 applicants", "Submit a passport valid for at least six months after the planned entry date; applicants already in China also submit the visa or residence-permit page and latest entry stamp.", "document", "brochure page 6, Application Documents item 1"),
  item("transcripts", "documents", "required", "Fall 2026 applicants", "Submit official transcripts covering all courses from senior high school or the preceding academic stage.", "document", "brochure page 6, Application Documents item 2"),
  item("diploma", "documents", "required", "Fall 2026 applicants", "Submit the senior-high-school diploma or equivalent qualification.", "document", "brochure page 6, Application Documents item 3"),
  item("language_certificate", "documents", "conditional", "Applicants subject to a language-certification requirement", "Submit the applicable language-proficiency certificate.", "official_result", "brochure page 6, Application Documents item 4"),
  item("physical_examination", "documents", "required", "Fall 2026 applicants", "Submit a Foreigner Physical Examination Form that remains within its six-month validity period.", "document", "brochure page 6, Application Documents item 5"),
  item("bank_statements", "documents", "required", "Fall 2026 applicants", "Submit bank statements covering at least the previous six months.", "document", "brochure page 6, Application Documents item 6"),
  item("certification_and_translation", "documents", "required", "Fall 2026 applicants", "Provide originals or notarized copies bearing an official seal and an official Chinese or English translation for material issued in another language.", "document", "brochure page 6, document-certification note"),
  item("online_application", "application_policy", "required", "Fall 2026 applicants", "Submit the application through the university's online application route by September 30, 2026.", "school_review", "brochure page 6, Application Time and Application Procedure"),
  item("interview", "academic_results", "required", "Applicants passing initial review", "Complete the university interview at the confirmed time; the brochure states the interview schedule is fixed after confirmation.", "school_review", "brochure pages 6-7, Application Procedure and Interview"),
  item("admission_assessment", "academic_results", "required", "Fall 2026 applicants", "Admission is based on academic performance and interview assessment.", "school_review", "brochure page 7, Admission"),
  item("registration_fee_and_tuition", "application_policy", "required", "Admitted applicants", "Pay the CNY 650 registration fee and first-year tuition online after admission to reserve the place; late or missing payment is treated as giving up the application.", "document", "brochure page 6, Application Documents item 7", "enrollment"),
  item("signed_application_form", "documents", "required", "Applicants whose materials pass review", "Download and sign the application form after the one-to-two-week review and present it at registration.", "document", "brochure page 6, review and registration note", "enrollment"),
  item("registration", "application_policy", "required", "Admitted applicants", "Complete online registration according to the Admission Notice; failure to register and pay cancels the admission qualification and JW202 reservation.", "document", "brochure page 7, Registration", "enrollment"),
  item("accommodation", "other", "conditional", "Students using university accommodation", "Budget the published accommodation charge of CNY 4,000 for a double room or CNY 8,000 for a single room; the brochure does not explicitly state the billing period in the table.", "self_report", "brochure page 8, Fee Structure", "preparation"),
  item("other_costs", "other", "required", "Enrolled international undergraduates", "Budget approximately CNY 800 for insurance, CNY 351 for the physical check and CNY 400 for residence-permit updating, as listed in the brochure.", "self_report", "brochure page 8, Fee Structure", "preparation"),
];

function documentFor(route: "clinical" | "dental") {
  const clinical = route === "clinical";
  return parseRequirementDocument({
    schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "gmcu_undergraduate", url: source.url, title: source.label,
      capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
    requirements: [
      ...commonRequirements,
      item("duration_and_delivery", "education", "required", clinical ? "Clinical Medicine applicants" : "Bachelor of Dental Surgery applicants",
        clinical ? "Complete one preparatory year followed by five years of Clinical Medicine; the preparatory year includes Chinese, general China and medical-foundation study, followed by a closing examination and HSK Level 4 before progression."
          : "Complete the five-year Bachelor of Dental Surgery program through offline teaching.",
        "school_review", clinical ? "brochure page 3, Clinical Medicine" : "brochure page 4, Bachelor of Dental Surgery"),
      item("tuition", "application_policy", "required", clinical ? "Clinical Medicine students" : "Bachelor of Dental Surgery students",
        clinical ? "Pay CNY 15,000 for the first preparatory year and CNY 25,000 per year for years two through six."
          : "Pay CNY 20,000 per year for each of the five years.",
        "document", "brochure page 8, Fee Structure", "enrollment"),
    ],
  });
}

const unresolvedNotes = [
  "This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window.",
  "The reviewed 2026 brochure does not publish a CSCA requirement; no CSCA rule has been inferred.",
  "The brochure conflicts internally on IELTS: its language panel states 6.5 in each component, while its academic panel states IELTS overall 6.0. The conflict is retained for editorial resolution.",
  "The brochure mentions interviews in June, July and September and results around late July or early August while accepting applications through September 30; the timeline is not silently harmonized.",
];
const templates = [
  { key: "gmcu-clinical-medicine-fall-2026", schoolSlug: "guizhou-medical-university", cycle: "fall-2026",
    targetProgramSlugs: [clinicalSlug], targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready",
    reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes, document: documentFor("clinical") },
  { key: "gmcu-bds-fall-2026", schoolSlug: "guizhou-medical-university", cycle: "fall-2026",
    targetProgramSlugs: [dentalSlug], targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready",
    reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes, document: documentFor("dental") },
];
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located GMU Fall 2026 undergraduate requirements bound only to exact existing closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: targetProgramSlugs.length, targetedIntakeCount: targetProgramSlugs.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
