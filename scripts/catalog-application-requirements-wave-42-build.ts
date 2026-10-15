import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-42.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate"; teachingLanguage: "Chinese"; tuitionText: string; cscaRequirement: string; hskRequirement: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-09-22T12-21-17-915Z/manifest.json"), "utf8")) as { sources: Source[] };
const expected = new Map([
  ["sdnu-international-admission-brochure-pdf-2026", "9febf6b225bc994d0d0fa8f00eac106b3e479c97f44334968cd51f5cf812f0e4"],
  ["sdnu-international-program-catalog-image-2-2026-2027", "0ba7ae25dfe2015268cf0dd431e81aad3b6d31ddb9f3ec6cae9b1525d928a021"],
  ["sdnu-shandong-government-scholarship-2026", "23b2f184b0058cbbdd8a473577c34989fe659e3cf850dbbd6c289e6af6dc7379"],
]);
const source = (id: string) => {
  const found = manifest.sources.find((entry) => entry.id === id);
  if (!found || found.status !== 200 || found.sha256 !== expected.get(id)) throw new Error(`SDNU evidence mismatch: ${id}`);
  return found;
};
const brochure = source("sdnu-international-admission-brochure-pdf-2026");
const catalog = source("sdnu-international-program-catalog-image-2-2026-2027");
source("sdnu-shandong-government-scholarship-2026");
const record = (key: string, value: Source) => ({ key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 });
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.sdnu-complete-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 10 || seed.programIntakes.length !== 10 || seed.scholarships.length !== 1) throw new Error("Unexpected SDNU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-05-31T15:59:59.000Z")) throw new Error(`Missing exact SDNU Fall 2026 intake: ${program.slug}`);
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "brochure", locator }] };
}
function document(program: Program): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("brochure", brochure), record("catalog", catalog)], requirements: [
    item("education", "education", "required", "Undergraduate applicants", "Hold a high-school qualification or above.", "document", "page 1, Eligibility item 1"),
    item("age_guardian", "identity", "conditional", "Applicants under age 18", "Applicants should generally be at least 18; applicants under 18 must provide parental authorization and a guardian commitment, with a China-resident guardian when the parents are outside China.", "document", "pages 1 and 3, Eligibility item 3 and Application Materials item 10"),
    item("passport", "identity", "required", "All applicants", "Submit the passport personal-information page and any Chinese visa pages; passport validity must cover the whole study period.", "document", "page 2, Application Materials item 1"),
    item("diploma", "documents", "required", "All applicants", "Submit the high-school graduation certificate, with notarized Chinese or English translation where needed; graduating students may submit impending-graduation proof but must graduate before August 31 and provide the final certificate at registration.", "document", "page 2, Application Materials item 2"),
    item("transcript", "documents", "required", "All applicants", "Submit a complete high-school transcript, with notarized Chinese or English translation where needed.", "document", "page 2, Application Materials item 3"),
    item("current_study_records", "documents", "conditional", "Applicants currently studying in China", "Submit current-school academic-performance or attendance evidence and the current-school transcript.", "document", "pages 2-3, Application Materials item 4 note"),
    item("csca", "academic_results", "required", "All undergraduate applicants", program.cscaRequirement, "official_result", "page 2, Eligibility item 4 and Application Materials item 4"),
    item("language", "language", "required", "Chinese-taught undergraduate applicants", program.hskRequirement, "official_result", "pages 1 and 3, Eligibility item 2 and Application Materials item 5"),
    item("physical_examination", "documents", "required", "All applicants", "Submit a Foreigner Physical Examination Form valid for six months.", "document", "page 3, Application Materials item 7"),
    item("non_criminal_record", "documents", "required", "All applicants", "Submit a valid police-issued non-criminal record, normally issued within six months before application, with notarized Chinese or English translation where needed.", "document", "page 3, Application Materials item 8"),
    item("financial_guarantee", "documents", "required", "All applicants", "Submit proof of financial guarantee.", "document", "page 3, Application Materials item 9"),
    item("application_window", "application_policy", "required", "Fall 2026 applicants", "Apply from April 1 through May 31, 2026; this historical cycle is closed.", "school_review", "page 2, Application Time and Commencing Time"),
    item("registration_fee", "application_policy", "required", "All applicants", "Pay the published CNY 415 registration fee after the initial document review.", "document", "pages 3-4, Fees and Application Procedures"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "page 3, Fees; official program-catalog attachment", "enrollment"),
    item("accommodation", "other", "conditional", "Students using university accommodation", "Published accommodation is CNY 10,000 per person per academic year.", "document", "page 3, Fees", "enrollment"),
    item("insurance", "other", "required", "Enrolled international students", "Purchase mandatory China-based medical insurance at CNY 400 per half-year or CNY 800 per year; registration is not completed without it.", "document", "pages 3 and 5, Fees and Warm Tips", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of seed.programs) groups.set(program.tuitionText, [...(groups.get(program.tuitionText) ?? []), program]);
const definitions = [...groups.values()].map((rows, index) => ({ key: `sdnu-undergraduate-tuition-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }));
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 3 || targets.length !== 10 || new Set(targets).size !== 10) throw new Error("SDNU requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "shandong-normal-university", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "The official guide requires CSCA but does not publish a program-specific subject combination; no subjects are inferred.", "The reviewed Shandong Government Scholarship applies to master's and doctoral applicants, not these undergraduate routes; it remains a separate unreviewed catalog record."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Source-located complete-scope SDNU 2026 undergraduate requirements bound only to exact closed program-intake records." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
