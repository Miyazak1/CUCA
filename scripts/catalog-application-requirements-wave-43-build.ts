import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-43.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate"; teachingLanguage: "Chinese"; tuitionText: string; cscaRequirement: string; hskRequirement: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-09-22T13-10-14-978Z/manifest.json"), "utf8")) as { sources: Source[] };
const expected = new Map([
  ["tjufe-international-undergraduate-admissions-en-2026", "2ab3df69480eac0076018e82027a6b82b6269f8911245542ebb79e5deba1a3b2"],
  ["tjufe-international-undergraduate-admissions-zh-2026", "ab8a8fecfa41070755aa2698957ca6b79edf19dbd0ae524cf4bb642394be70e8"],
  ["tjufe-cgs-bilateral-type-a-2026", "15ac6d3598fe2005a9dd45868531fbe00c01e544eab1fcad6c197e8126917a6b"],
  ["tjufe-cgs-high-level-graduate-zh-2026", "afb7f786d5c7335f8b84f0e42e0495c237dc873326c7d5a380974100aa86c68c"],
]);
const source = (id: string) => { const found = manifest.sources.find((entry) => entry.id === id); if (!found || found.status !== 200 || found.sha256 !== expected.get(id)) throw new Error(`TUFE evidence mismatch: ${id}`); return found; };
const guideEn = source("tjufe-international-undergraduate-admissions-en-2026");
const guideZh = source("tjufe-international-undergraduate-admissions-zh-2026");
source("tjufe-cgs-bilateral-type-a-2026"); source("tjufe-cgs-high-level-graduate-zh-2026");
const record = (key: string, value: Source) => ({ key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 });
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.tjufe-complete-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 49 || seed.programIntakes.length !== 49 || seed.scholarships.length !== 2) throw new Error("Unexpected TUFE complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-06-15T15:59:59.000Z")) throw new Error(`Missing exact TUFE Fall 2026 intake: ${program.slug}`);
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "guide_en", locator }] }; }
function document(program: Program): RequirementDocument { return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide_en", guideEn), record("guide_zh", guideZh)], requirements: [
  item("eligibility", "education", "required", "Undergraduate applicants", "Be a non-Chinese citizen aged 18 to 30, mentally and physically healthy, and hold a high-school diploma.", "document", "Eligibility items 1-2"),
  item("passport", "identity", "required", "All applicants", "Submit a scanned copy of the home page of a valid ordinary passport.", "document", "Application Materials item 1"),
  item("diploma", "documents", "required", "All applicants", "Submit scanned high-school diploma and notarization; graduating students submit school-issued pre-graduation proof and supplement the final documents after admission.", "document", "Application Materials item 2"),
  item("transcript", "documents", "required", "All applicants", "Submit scanned complete high-school transcripts and notarization; graduating students may submit current transcripts and supplement the complete set after admission.", "document", "Application Materials item 3"),
  item("csca", "academic_results", "required", "All undergraduate applicants", program.cscaRequirement, "official_result", "Application Materials item 4"),
  item("language", "language", "required", "Chinese-taught undergraduate applicants", program.hskRequirement, "official_result", "Application Materials item 5"),
  item("financial_support", "documents", "required", "All applicants", "Submit a bank deposit statement showing at least CNY 50,000 or the equivalent in foreign currency.", "document", "Application Materials item 6"),
  item("non_criminal_record", "documents", "required", "All applicants", "Submit a certificate of no criminal record issued within six months before application.", "document", "Application Materials item 7"),
  item("physical_examination", "documents", "required", "All applicants", "Submit a Foreigner Physical Examination Form completed in Chinese or English; the result is valid for six months before enrollment.", "document", "Application Materials item 8"),
  item("supporting_materials", "documents", "recommended", "Applicants with relevant evidence", "Other relevant materials such as awards, completion certificates, or employment verification may be submitted.", "document", "Application Materials item 9"),
  item("application_window", "application_policy", "required", "Fall 2026 applicants", "Submit through the TUFE International Student Service System by June 15, 2026; this historical cycle is closed.", "school_review", "Application Process"),
  item("assessment", "application_policy", "required", "Applicants passing initial review", "Participate in the university assessment; arrangements are announced separately.", "school_review", "Admission Procedures item 2"),
  item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}. The published amount includes insurance.`, "document", "Costs", "enrollment"),
  item("accommodation", "other", "conditional", "Students using university accommodation", "Published accommodation is CNY 24 or 36 per day when settled annually, CNY 28 or 42 per day when settled by semester, or CNY 40 or 60 per day when settled daily.", "document", "Costs", "enrollment"),
] }); }
const groups = new Map<string, Program[]>(); for (const program of seed.programs) groups.set(program.tuitionText, [...(groups.get(program.tuitionText) ?? []), program]);
const definitions = [...groups.values()].map((rows, index) => ({ key: `tjufe-undergraduate-tuition-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }));
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug)); if (definitions.length !== 2 || targets.length !== 49 || new Set(targets).size !== 49) throw new Error("TUFE requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "tianjin-university-of-finance-and-economics", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "The two reviewed scholarship routes remain separate unreviewed catalog records and do not imply an award for an individual program."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Source-located complete-scope TUFE 2026 undergraduate requirements bound only to exact closed program-intake records." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8"); console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
