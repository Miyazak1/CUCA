import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-39.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Bachelor" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionText: string; cscaRequirement: string; hskRequirement: string; englishRequirement: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/heu-complete-batch-01/manifest.json"), "utf8")) as { sources: Source[] };
const expected = {
  "heu-undergraduate-guide-2026": "882d3961f75990f9859ebdaa84dd78a8f3ae3522821df2fb2fcb62b2e7db5952",
  "heu-graduate-guide-2026": "5a80e875accf5694b24311379eb7546be6ff8139d3901cdadb05c6376cee0691",
} as const;
const evidence = new Map<string, Source>();
for (const source of manifest.sources) if (source.id in expected) {
  if (source.status !== 200 || source.sha256 !== expected[source.id as keyof typeof expected]) throw new Error(`HEU requirement evidence mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
if (evidence.size !== 2) throw new Error("Incomplete HEU requirement evidence.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.heu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 91 || seed.programIntakes.length !== 91) throw new Error("Unexpected HEU complete seed.");
for (const program of seed.programs) {
  const deadline = program.degreeLevel === "Bachelor" ? "2026-05-15T00:00:00Z" : "2026-04-30T00:00:00Z";
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === deadline)) throw new Error(`Missing exact HEU Fall 2026 intake: ${program.slug}`);
}

const sourceId = (program: Program): keyof typeof expected => program.degreeLevel === "Bachelor" ? "heu-undergraduate-guide-2026" : "heu-graduate-guide-2026";
const sourceRecord = (program: Program) => { const source = evidence.get(sourceId(program))!; return { key: "guide", url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }; };
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "guide", locator }] };
}
const languageRule = (program: Program) => program.teachingLanguage === "Chinese" ? program.hskRequirement : program.englishRequirement;
function bachelorDocument(program: Program): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord(program)], requirements: [
    item("citizenship_health", "identity", "required", "International bachelor applicants", "Be a non-Chinese citizen in good physical and mental health.", "school_review", "Eligibility item 1"),
    item("education_age", "education", "required", "International bachelor applicants", "Hold a high-school graduation certificate, be age 18-25, and have an average grade of at least 75/100.", "document", "Eligibility items 2-3"),
    item("guardian", "documents", "conditional", "Applicants under age 18", "Provide guardian documents for a guardian in Harbin, China.", "document", "Eligibility item 2 and Application Documents item 11"),
    item("language", "language", "required", `${program.teachingLanguage}-taught bachelor applicants`, languageRule(program), "official_result", "Eligibility item 4"),
    item("csca", "academic_results", "required", "Bachelor applicants to the exact routes bound to this template", program.cscaRequirement, "official_result", "Application Documents item 3 and About CSCA"),
    item("application_form_passport", "documents", "required", "Bachelor applicants", "Submit the HEU online application form and passport home page.", "document", "Application Documents items 1-2"),
    item("school_records", "documents", "required", "Bachelor applicants", "Submit notarized high-school graduation certificate and transcripts.", "document", "Application Documents items 4-5"),
    item("language_certificate", "documents", "required", "Bachelor applicants", "Submit the applicable language proficiency certificate.", "official_result", "Application Documents item 6"),
    item("study_plan", "documents", "required", "Bachelor applicants", "Submit a study plan of at least 800 words.", "document", "Application Documents item 7"),
    item("health_finance_conduct", "documents", "required", "Bachelor applicants", "Submit the physical examination form, financial support document and no-criminal-record report.", "document", "Application Documents items 8-10"),
    item("application_process", "application_policy", "required", "Fall 2026 bachelor applicants", "Apply in the HEU system, complete qualification review and interview, and monitor the system and email. The final published batch closed May 15, 2026.", "school_review", "Admission Procedures, Application Batches and Application Method"),
    item("application_fee", "application_policy", "required", "Bachelor applicants", "Pay the published non-refundable RMB 400 application fee.", "document", "Fees and Cost", "submission"),
    item("tuition", "application_policy", "required", "Enrolled bachelor students", program.tuitionText.startsWith("The official") ? program.tuitionText : `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "Fees and Cost", "enrollment"),
    item("living_costs", "other", "required", "Enrolled students", "Budget for published living expenses of RMB 1,500-2,500/month, insurance of RMB 800/year, and residence-permit and physical-examination charges.", "document", "Fees and Cost", "enrollment"),
    item("accommodation", "other", "conditional", "Students using HEU accommodation", "Published accommodation tiers range from RMB 400 to RMB 2,600 per month by room type.", "document", "Accommodation Fee", "enrollment"),
  ] });
}
function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord(program)], requirements: [
    item("citizenship_health", "identity", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen in good physical and mental health.", "school_review", "Eligibility item 1"),
    item("education_age", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree or equivalent, be under age 35, and have an average grade of at least 75/100." : "Hold a master's degree or equivalent, be under age 40, and have an average grade of at least 75/100.", "document", "Eligibility items 2-4"),
    item("language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Eligibility item 5"),
    item("application_form_passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit the HEU online application form and passport home page.", "document", "Application Documents items 1-2"),
    item("degree_transcripts", "documents", "required", `${program.degreeLevel} applicants`, "Submit notarized highest diploma and academic transcripts.", "document", "Application Documents items 3-4"),
    item("language_certificate", "documents", "required", `${program.degreeLevel} applicants`, "Submit the applicable language proficiency certificate.", "official_result", "Application Documents item 5"),
    item("study_plan", "documents", "required", `${program.degreeLevel} applicants`, "Submit a study plan of at least 1,000 words.", "document", "Application Documents item 6"),
    item("recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit recommendation letters.", "document", "Application Documents item 7"),
    item("health_finance_conduct", "documents", "required", `${program.degreeLevel} applicants`, "Submit the physical examination form, financial support document and no-criminal-record report.", "document", "Application Documents items 8-10"),
    item("application_process", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Apply in the HEU system, complete qualification review and interview, and monitor the system and email. The final published batch closed April 30, 2026.", "school_review", "Admission Procedures, Application Batches and Application Method"),
    item("application_fee", "application_policy", "required", `${program.degreeLevel} applicants`, "Pay the published non-refundable RMB 400 application fee.", "document", "Fees and Cost"),
    item("tuition", "application_policy", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "Fees and Cost", "enrollment"),
    item("living_costs", "other", "required", "Enrolled students", "Budget for published living expenses of RMB 1,500-2,500/month, insurance of RMB 800/year, and residence-permit and physical-examination charges.", "document", "Fees and Cost", "enrollment"),
  ] });
}

const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText, csca: program.cscaRequirement, hsk: program.hskRequirement, english: program.englishRequirement });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const definitions = [...groups.values()].map((rows, index) => ({ key: `heu-${keyPart(rows[0].degreeLevel)}-${keyPart(rows[0].teachingLanguage)}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: rows[0].degreeLevel === "Bachelor" ? bachelorDocument(rows[0]) : graduateDocument(rows[0]) }));
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 10 || targets.length !== 91 || new Set(targets).size !== 91) throw new Error("HEU requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "harbin-engineering-university", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "Three English-taught bachelor routes have no separately published tuition amount; the source limitation is preserved rather than inferred.", "Scholarship eligibility is represented by separately sourced HEU scholarship records and is not guaranteed for any program."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Source-located complete-scope HEU 2026 requirements bound only to exact closed program-intake records." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
