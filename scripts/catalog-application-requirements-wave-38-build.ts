import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-38.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/buct-complete-batch-01/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English" | "French"; tuitionText?: string; cscaSubjects?: string[]; hskRequirement?: string; englishRequirement?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const expected = {
  "buct-undergraduate-programs-2026": "8adec0c37f9f803ead3b3ddfaa8b6fb43a0311060a9098c6afd173832263afe7",
  "buct-master-programs-2026": "77cb3ffbb4c86626e3c04529604fa126293a7c84c3daefa02673dbed7d928f07",
  "buct-doctoral-programs-2026": "176cdcb0e9d0591917adf7040629c8702bd696fe3a7d04ff5eab8fe1436d9456",
} as const;
const evidence = new Map<string, Source>();
for (const row of manifest.sources as Source[]) if (row.id in expected) {
  if (row.status !== 200 || row.sha256 !== expected[row.id as keyof typeof expected]) throw new Error(`BUCT requirement evidence mismatch: ${row.id}`);
  evidence.set(row.id, row);
}
if (evidence.size !== Object.keys(expected).length) throw new Error("Incomplete BUCT requirement evidence.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.buct-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 108 || seed.programIntakes.length !== 108) throw new Error("Unexpected BUCT complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-06-30T00:00:00.000Z")) throw new Error(`Missing exact BUCT Fall 2026 intake: ${program.slug}`);

type SourceKey = "page";
const sourceId = (program: Program): keyof typeof expected => program.degreeLevel === "Undergraduate" ? "buct-undergraduate-programs-2026"
  : program.degreeLevel === "Master" ? "buct-master-programs-2026" : "buct-doctoral-programs-2026";
function sourceRecord(program: Program) {
  const source = evidence.get(sourceId(program))!;
  return { key: "page", url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "page" as SourceKey, locator }] };
}
const languageRule = (program: Program) => program.teachingLanguage === "Chinese" ? program.hskRequirement! : program.englishRequirement!;

function undergraduateDocument(program: Program): RequirementDocument {
  const subjects = (program.cscaSubjects ?? []).join(", ");
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord(program)], requirements: [
    item("citizenship_conduct", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a valid ordinary private passport and agree to observe Chinese laws and BUCT regulations.", "school_review", "Qualifications of Applicants"),
    item("education_age", "education", "required", "International undergraduate applicants", "Be a high-school graduate or above, qualified to apply to university, and normally age 18-25.", "document", "Qualifications of Applicants"),
    item("nationality_review", "identity", "conditional", "Applicants with Chinese background", "Meet the nationality and residence rules in Ministry of Education Document No. 12 [2020].", "school_review", "Qualifications of Applicants, Chinese-background rule"),
    item("minor_guardian", "documents", "conditional", "Applicants under age 18", "Submit notarized guardianship records for a guardian holding Beijing residency.", "document", "Qualifications and Admission Materials"),
    item("application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Complete the application by June 30, 2026.", "document", "Application Procedure heading"),
    item("csca", "academic_results", "required", "Applicants to the exact programs bound to this template", `Submit CSCA scores for the official route-table subjects: ${subjects}. Chinese-medium applicants must also pass CSCA Professional Chinese.`, "official_result", "Program table CSCA designated elective column and language table"),
    item("cv_study_proposal", "documents", "required", "Undergraduate applicants", "Submit the BUCT curriculum-vitae and study-proposal records using the application-system templates.", "document", "Admission Materials item 1"),
    item("passport", "documents", "required", "Undergraduate applicants", "Submit a copy of the valid passport photo page and any China visa page.", "document", "Admission Materials item 2"),
    item("transcript_diploma", "documents", "required", "Undergraduate applicants", "Submit certified or notarized high-school transcripts and diploma in Chinese or English.", "document", "Admission Materials items 3-4"),
    item("language", "language", "required", `${program.teachingLanguage}-medium undergraduate applicants`, languageRule(program), "official_result", "Admission Materials language-proficiency table"),
    item("csca_report", "documents", "required", "Undergraduate applicants", "Submit the CSCA designated elective-subject score report for the selected route.", "official_result", "Admission Materials, CSCA score item"),
    item("physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Form from the application platform.", "document", "Admission Materials"),
    item("criminal_record", "documents", "required", "Undergraduate applicants", "Submit a no-criminal-record certificate.", "document", "Admission Materials"),
    item("application_process_fee", "application_policy", "required", "Undergraduate applicants", "Register in the BUCT system, upload all required records, pay the non-refundable CNY 500 fee after preliminary review, complete the online academic test and comprehensive interview, and monitor email/platform notices.", "school_review", "Application Procedure and Fee Payment"),
    item("tuition", "application_policy", "required", "Enrolled undergraduate students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "Fees section", "enrollment"),
    item("insurance_residence", "other", "required", "Enrolled undergraduate students", "Budget for CNY 800/year insurance and the CNY 400/year residence-permit charge.", "document", "Fees section", "enrollment"),
    item("accommodation", "other", "conditional", "Students using university accommodation", "Published double-room accommodation is CNY 21,600/year per person at Chaoyang or Changping; the published Changping single room is CNY 25,200/year.", "document", "Fees, Accommodation", "enrollment"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  const tuitionRule = program.tuitionText ? `Pay the published tuition for this route: ${program.tuitionText}.`
    : "The official page does not publish a separate self-funded tuition amount for this French-medium master's route; obtain the applicable amount from BUCT before payment.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord(program)], requirements: [
    item("citizenship_conduct", "identity", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen holding a valid private passport and observe Chinese laws and BUCT regulations.", "school_review", "Qualifications of Applicants"),
    item("education_age", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree or equivalent with excellent academic standing and be under age 35." : "Hold a master's degree or equivalent with excellent academic standing and be under age 40.", "document", "Qualifications of Applicants"),
    item("nationality_review", "identity", "conditional", "Applicants with Chinese background", "Meet the nationality and residence rules in Ministry of Education Document No. 12 [2020].", "school_review", "Qualifications of Applicants, Chinese-background rule"),
    item("application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Complete the application by June 30, 2026.", "document", "Application Procedure heading"),
    item("cv_statement_plan", "documents", "required", `${program.degreeLevel} applicants`, "Submit a curriculum vitae, personal statement and study proposal using the BUCT system templates.", "document", "Admission Materials item 1"),
    item("passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit the passport photo page and any China visa page.", "document", "Admission Materials item 2"),
    item("degree_transcripts", "documents", "required", `${program.degreeLevel} applicants`, "Submit certified or notarized highest-degree credentials and complete academic transcripts in Chinese or English.", "document", "Admission Materials items 3-4"),
    item("recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two recommendation letters from professors or associate professors.", "document", "Admission Materials item 5"),
    item("supervisor_acceptance", "documents", "required", `${program.degreeLevel} applicants`, "Obtain and upload a BUCT supervisor acceptance letter; applicants without it are not considered candidates.", "school_review", "Admission Materials and supervisor note"),
    item("language", "language", "required", `${program.teachingLanguage}-medium ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Language Proficiency Requirement table"),
    item("physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Foreigner Physical Examination Form.", "document", "Admission Materials"),
    item("criminal_record", "documents", "required", `${program.degreeLevel} applicants`, "Submit a no-criminal-record certificate in Chinese or English.", "document", "Admission Materials"),
    item("academic_achievements", "documents", "recommended", `${program.degreeLevel} applicants`, "Submit publications, patents or other academic achievements when available; the page states these receive priority consideration.", "document", "Admission Materials"),
    item("application_process_fee", "application_policy", "required", `${program.degreeLevel} applicants`, "Register in the BUCT system, upload all required records, pay the non-refundable CNY 500 fee after preliminary review, complete the comprehensive interview and monitor email/platform notices.", "school_review", "Application Procedure and Fee Payment"),
    item("tuition", "application_policy", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, tuitionRule, "document", "Fees section", "enrollment"),
    item("insurance_residence", "other", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, "Budget for CNY 800/year insurance and the CNY 400/year residence-permit charge.", "document", "Fees section", "enrollment"),
    item("accommodation", "other", "conditional", "Students using university accommodation", "Published double-room accommodation is CNY 21,600/year per person at Chaoyang or Changping; the published Changping single room is CNY 25,200/year.", "document", "Fees, Accommodation", "enrollment"),
  ] });
}

const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText ?? "unpublished",
    csca: program.cscaSubjects ?? [], hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "" });
  const rows = groups.get(identity) ?? [];
  rows.push(program);
  groups.set(identity, rows);
}
const definitions = [...groups.values()].map((rows, index) => {
  const program = rows[0];
  return { key: `buct-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows,
    document: program.degreeLevel === "Undergraduate" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 10 || targets.length !== 108 || new Set(targets).size !== 108) throw new Error("BUCT requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "beijing-university-of-chemical-technology", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "The French-medium master's page publishes the route and French B2 requirement but no separate self-funded tuition amount; the field remains explicitly unresolved rather than inferred.", "Scholarship availability is represented by the three separately sourced 2026 BUCT scholarship records and is not guaranteed for any program."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope BUCT 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
