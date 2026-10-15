import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-49.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText: string; hskRequirement?: string; englishRequirement?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const expected = new Map([
  ["xtu-international-admission-guide-pdf-2026", "677a02dabd412977334a82ad73b59cd90ecf4e271e7b7fcb5266601fa5add7f5"],
  ["xtu-master-programs-current", "be07fb3db746f4d8f219b6a85b890f63675896252bdcfd0192f15bf9d5066317"],
  ["xtu-doctoral-programs-current", "b5973d1add4f032ffe951be38cab3e3a2b6c044eb549fe02b59cda7ce22178ed"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const row of manifest.sources ?? []) if (row.status === 200 && expected.get(row.id) === row.sha256) evidence.set(row.id, row);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked XTU evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const record = (key: string, id: string) => { const value = evidence.get(id)!; return { key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 }; };
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.xtu-safe-new-batch-01.draft.json"), "utf8")) as Seed;
const excluded = seed.programs.filter((program) => program.degreeLevel === "Undergraduate");
const programs = seed.programs.filter((program) => program.degreeLevel === "Master" || program.degreeLevel === "Doctoral");
if (seed.programs.length !== 96 || programs.length !== 76 || excluded.length !== 20 || seed.scholarships.length !== 1) throw new Error("Unexpected XTU catalog scope.");
for (const program of programs) {
  if (!program.tuitionText.startsWith("CNY ")) throw new Error(`XTU route is missing exact tuition: ${program.slug}`);
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-04-30T15:59:59.000Z")) throw new Error(`Missing exact XTU intake: ${program.slug}`);
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] }; }
function document(program: Program): RequirementDocument {
  const doctoral = program.degreeLevel === "Doctoral";
  const language = program.teachingLanguage === "Chinese" ? program.hskRequirement! : program.englishRequirement!;
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    record("guide", "xtu-international-admission-guide-pdf-2026"), record("master_catalog", "xtu-master-programs-current"), record("doctoral_catalog", "xtu-doctoral-programs-current"),
  ], requirements: [
    item("citizenship_and_conduct", "identity", "required", "All applicants", "Be a non-Chinese citizen age 18 or above, physically and mentally healthy, able to perform academically, compliant with Chinese laws and university rules, and respectful of Chinese culture. Applicants covered by the published former-Chinese-citizen rule must also satisfy its passport and overseas-residence conditions.", "document", "guide", "Eligibility items 1-2, page 2"),
    item("degree_and_age", "education", "required", `${program.degreeLevel} applicants`, doctoral ? "Hold a master's degree and be under age 40." : "Hold a bachelor's degree and be under age 35.", "document", "guide", "Eligibility item 3, page 2"),
    item("online_application", "application_policy", "required", "All applicants", "Register in the Xiangtan University International Students Service Platform, complete the online form and submit the application.", "school_review", "guide", "Application Procedure item 1, page 4"),
    item("passport", "identity", "required", "All applicants", "Submit a copy of the passport home page and renew the passport first if it does not satisfy the published validity requirement.", "document", "guide", "Application Documents item 1, page 4"),
    item("diploma", "documents", "required", "All applicants", "Submit a notarized highest diploma; prospective graduates submit official student-status proof. Add notarized Chinese or English translations when required.", "document", "guide", "Application Documents item 2, page 4"),
    item("transcripts", "documents", "required", "All applicants", "Submit sealed academic transcripts covering all applicable study stages, with notarized English translations for documents in other languages.", "document", "guide", "Application Documents item 3, page 4"),
    item("language", "language", "required", `${program.teachingLanguage}-taught route applicants`, language, "official_result", "guide", "Eligibility item 4 and Application Documents item 4, pages 2 and 4-5"),
    item("study_plan", "documents", "required", "All applicants", "Submit a Chinese- or English-language study plan explaining educational background, understanding of China and the chosen major, and study goals.", "document", "guide", "Application Documents item 5, page 5"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the Foreigner Physical Examination Form in English with the blood-test report, completed after October 1, 2025 and satisfying the published signature, stamp and photograph rules.", "document", "guide", "Application Documents item 6, page 5"),
    item("non_criminal_record", "documents", "required", "All applicants", "Submit a valid non-criminal-record certificate issued by the local public security authority after October 1, 2025.", "document", "guide", "Application Documents item 7, page 5"),
    item("recommendations", "documents", "required", "Graduate applicants", "Submit two Chinese- or English-language recommendations from professors or associate professors, each with the recommender's contact information and dated after October 1, 2025.", "document", "guide", "Application Documents item 8, page 5"),
    item("self_introduction_video", "documents", "required", "All applicants", "Submit a self-introduction video covering educational and professional background and research potential; the file must be under 50 MB.", "document", "guide", "Application Documents item 9, page 5"),
    item("financial_support", "documents", "conditional", "Self-funded applicants", "Submit a bank-deposit certificate sufficient to cover at least one year of study and living costs in China.", "document", "guide", "Application Documents item 10, page 5"),
    item("supervisor_form", "documents", "conditional", "Applicants who have an XTU supervisor recommendation", "Submit the XTU Supervisor's Recommendation Form when applicable.", "document", "guide", "Application Documents item 11, page 6"),
    item("academic_evidence", "documents", "conditional", "Applicants with publications or other academic evidence", "Submit published papers and other academic supporting materials when available.", "document", "guide", "Application Documents item 12, page 6"),
    item("document_integrity", "documents", "required", "All applicants", "Provide notarized Chinese or English translations for materials in other languages and ensure every document is authentic and complete.", "school_review", "guide", "Application Documents reminders 1-2, page 6"),
    item("deadline", "application_policy", "required", "Fall 2026 self-funded degree applicants", "Submit the self-funded degree-program application by April 30, 2026. Scholarship deadlines are controlled by their corresponding notices.", "school_review", "guide", "Application Procedure item 3, page 4"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "guide", "Study Cost, page 6", "enrollment"),
    item("insurance_and_accommodation", "application_policy", "required", "Enrolled students", "Budget for insurance at CNY 400 per semester or CNY 800 per year. Published on-campus accommodation is CNY 600 per month for a double room or CNY 900 per month for a single room, excluding gas, water and electricity.", "document", "guide", "Study Cost, page 6", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText, hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "" });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const definitions = [...groups.values()].map((rows, index) => ({ key: `xtu-graduate-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }));
if (definitions.length !== 4 || definitions.flatMap((group) => group.rows).length !== 76) throw new Error("XTU grouping changed.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "xiangtan-university", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Scope contains all 76 official master and doctoral routes in the acquired XTU catalog.", "Twenty undergraduate routes are excluded because the route-specific CSCA subject attachment is protected by a download captcha and its exact subject bindings could not be independently acquired.", "This historical Fall 2026 cycle is closed and must not be shown as current.", "The scholarship record remains independent; no route-level entitlement is inferred."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete official-source requirements for XTU's 76 Fall 2026 master and doctoral routes; exclude unresolved undergraduate CSCA bindings." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: programs.length, targetedIntakeCount: programs.length, excludedProgramCount: excluded.length, scholarshipCount: seed.scholarships.length, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
