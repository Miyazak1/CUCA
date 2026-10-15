import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-40.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionText: string; cscaRequirement: string; hskRequirement?: string; englishRequirement?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/bupt-complete-batch-01/manifest.json"), "utf8")) as { sources: Source[] };
const expectedSha = "60c223830d1e46ab8625daa3060584544ad699bf3c7925a33ce59cc0d32d56a8";
const source = manifest.sources.find((entry) => entry.id === "bupt-international-admission-brochure-2026");
if (!source || source.status !== 200 || source.sha256 !== expectedSha) throw new Error("BUPT requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.bupt-complete-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 58 || seed.programIntakes.length !== 58) throw new Error("Unexpected BUPT complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-04-20T00:00:00.000Z")) throw new Error(`Missing exact BUPT Fall 2026 intake: ${program.slug}`);
const sourceRecord = { key: "brochure", url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "brochure", locator }] };
}
const languageRule = (program: Program) => program.teachingLanguage === "Chinese" ? program.hskRequirement! : program.englishRequirement!;
function undergraduateDocument(program: Program): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord], requirements: [
    item("education_age", "education", "required", "Undergraduate applicants", "Hold a high-school diploma and be no older than 30.", "document", "page 7, Entrance Requirements"),
    item("language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "pages 7-9, Entrance Requirements and Application Materials"),
    item("csca", "academic_results", "required", "All undergraduate applicants", program.cscaRequirement, "official_result", "page 8, Additional explanation"),
    item("application_form", "documents", "required", "All applicants", "Submit the completed BUPT Admission Application Form for Overseas Students.", "document", "page 8, Application Materials item 1"),
    item("academic_records", "documents", "required", "All applicants", "Submit the highest completed academic certificate and diploma plus high-school or college transcripts, with notarized English translations where applicable.", "document", "page 8, Application Materials item 2"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the completed Physical Examination Record for Foreigners.", "document", "page 9, Application Materials item 4"),
    item("application_window", "application_policy", "required", "Fall 2026 applicants", "Complete the online BUPT application by April 20, 2026; this historical cycle is closed.", "school_review", "pages 9-10, Application Procedure and application period"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable CNY 500 application fee when submitting the application.", "document", "page 3, Application Fee"),
    item("tuition", "application_policy", "required", "Enrolled undergraduate students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "pages 3 and 6, tuition tables", "enrollment"),
    item("insurance", "other", "required", "Enrolled international students", "Purchase mandatory health insurance at the published CNY 800/year rate.", "document", "page 4, Insurance", "enrollment"),
    item("accommodation", "other", "conditional", "Students using BUPT accommodation", "Published accommodation is CNY 50 per bed per day.", "document", "pages 3-4, Accommodation", "enrollment"),
  ] });
}
function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord], requirements: [
    item("education_age", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree and be no older than 35." : "Hold a master's degree and be no older than 40.", "document", "page 7, Entrance Requirements"),
    item("language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "pages 7-8, Entrance Requirements"),
    item("recommendations", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit at least two recommendation letters from experts holding associate-professor rank or above." : "Submit at least two recommendations from professors.", "document", "page 8, graduate recommendations"),
    item("application_form", "documents", "required", "All applicants", "Submit the completed BUPT Admission Application Form for Overseas Students.", "document", "page 8, Application Materials item 1"),
    item("academic_records", "documents", "required", "All applicants", "Submit the highest completed academic certificate and diploma plus high-school or college transcripts, with notarized English translations where applicable.", "document", "page 8, Application Materials item 2"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the completed Physical Examination Record for Foreigners.", "document", "page 9, Application Materials item 4"),
    item("application_window", "application_policy", "required", "Fall 2026 applicants", "Complete the online BUPT application by April 20, 2026; this historical cycle is closed.", "school_review", "pages 9-10, Application Procedure and application period"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable CNY 500 application fee when submitting the application.", "document", "page 3, Application Fee"),
    item("tuition", "application_policy", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "pages 3 and 6, tuition tables", "enrollment"),
    item("insurance", "other", "required", "Enrolled international students", "Purchase mandatory health insurance at the published CNY 800/year rate.", "document", "page 4, Insurance", "enrollment"),
    item("accommodation", "other", "conditional", "Students using BUPT accommodation", "Published accommodation is CNY 50 per bed per day.", "document", "pages 3-4, Accommodation", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of seed.programs) { const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText, hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "", csca: program.cscaRequirement }); groups.set(identity, [...(groups.get(identity) ?? []), program]); }
const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const definitions = [...groups.values()].map((rows, index) => ({ key: `bupt-${keyPart(rows[0].degreeLevel)}-${keyPart(rows[0].teachingLanguage)}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: rows[0].degreeLevel === "Undergraduate" ? undergraduateDocument(rows[0]) : graduateDocument(rows[0]) }));
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 8 || targets.length !== 58 || new Set(targets).size !== 58) throw new Error("BUPT requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "beijing-university-of-posts-and-telecommunications", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "The brochure publishes only a general two-or-three-year duration for Chinese-taught master's routes, so no route-level duration is inferred.", "The reviewed 2026 brochure publishes no current-cycle scholarship detail; no older scholarship page is represented as a 2026 award."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Source-located complete-scope BUPT 2026 requirements bound only to exact closed program-intake records." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
