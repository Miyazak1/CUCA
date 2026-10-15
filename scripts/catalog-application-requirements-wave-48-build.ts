import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-48.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText: string; englishRequirement: string; cscaRequirement: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const expected = new Map([
  ["ouc-international-admission-guide-page-2026", "a8ca0e325bfac1744eaad41ef477490bd4e082d50c386bf18e047f7bba8ed96e"],
  ["ouc-international-programs-pdf-2026", "48adb9bb99468bbd88092ba5cb39c9ec83d33b90f7beb23af6fd456b79b85589"],
  ["ouc-csca-subjects-pdf-2026", "a964550fb416b0b0a55b3a84421688ca767fd59e81612c31132f3bf1e129b9a7"],
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
if (evidence.size !== expected.size) throw new Error(`Missing locked OUC evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const record = (key: string, id: string) => { const value = evidence.get(id)!; return { key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 }; };
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.ouc-international-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 10 || seed.programIntakes.length !== 10 || seed.scholarships.length !== 3) throw new Error("Unexpected OUC catalog scope.");
for (const program of seed.programs) {
  if (program.teachingLanguage !== "English" || !program.tuitionText.startsWith("CNY ")) throw new Error(`OUC route is missing exact language or tuition: ${program.slug}`);
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-06-10T00:00:00Z")) throw new Error(`Missing exact OUC intake: ${program.slug}`);
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] }; }
function cscaRule(program: Program): string {
  if (program.degreeLevel !== "Bachelor") return "OUC does not publish a CSCA requirement for this postgraduate route.";
  if (program.slug === "ocean-university-of-china-computer-science-and-technology") return "Submit CSCA Mathematics and Physics results.";
  if (program.slug === "official-2026-ouc-bachelor-tourism-management" || program.slug === "ocean-university-of-china-international-economics-and-trade") return "Submit CSCA Mathematics. The official table marks no optional Physics or Chemistry subject for this program.";
  return "Submit CSCA Mathematics. The acquired subject table lists Marine Sciences with Physics but does not use the English guide's Oceanography title, so no optional-subject equivalence is inferred; confirm the route-specific optional subject with OUC.";
}
function document(program: Program): RequirementDocument {
  const postgraduate = program.degreeLevel === "Master";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    record("guide_page", "ouc-international-admission-guide-page-2026"), record("program_guide", "ouc-international-programs-pdf-2026"), record("csca", "ouc-csca-subjects-pdf-2026"),
  ], requirements: [
    item("eligibility", "education", "required", `${program.degreeLevel} applicants`, postgraduate ? "Be a non-Chinese citizen in good health, hold a bachelor's degree or equivalent, and be age 18-50." : "Be a non-Chinese citizen in good health, hold a high-school diploma, and be age 16-30.", "document", "program_guide", "Qualification table, page 5"),
    item("online_application", "application_policy", "required", "All applicants", "Sign in to OUC's International Students Service System, complete the online application and submit it before the deadline.", "school_review", "program_guide", "How to apply, page 6"),
    item("passport_and_photo", "identity", "required", "All applicants", "Submit a scan of the passport information page and a two-inch photograph.", "document", "program_guide", "Documents item 2, page 5"),
    item("degree_certificate", "documents", "required", "All applicants", "Submit a notarized copy of the highest education degree and diploma.", "document", "program_guide", "Documents item 3, page 5"),
    item("transcripts", "documents", "required", "All applicants", "Submit notarized academic transcripts.", "document", "program_guide", "Documents item 4, page 5"),
    ...(postgraduate ? [
      item("recommendations", "documents", "required", "Postgraduate applicants", "Submit two recommendation letters from professors.", "document", "program_guide", "Documents item 5, page 5"),
      item("study_plan", "documents", "required", "Postgraduate applicants", "Submit a study plan.", "document", "program_guide", "Documents item 6, page 5"),
    ] : []),
    item("resume", "documents", "required", "All applicants", "Submit a personal resume.", "document", "program_guide", "Documents item 7, page 5"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the Physical Examination Form.", "document", "program_guide", "Documents item 8, page 5"),
    item("non_criminal_record", "documents", "required", "All applicants", "Submit a non-criminal record certificate or relevant certificate.", "document", "program_guide", "Documents item 9, page 5"),
    item("financial_statement", "documents", "required", "All applicants", "Submit a financial statement.", "document", "program_guide", "Documents item 10, page 5"),
    item("language", "language", "required", "Applicants from non-English-speaking countries", program.englishRequirement, "official_result", "program_guide", "Qualification table, page 5"),
    ...(program.degreeLevel === "Bachelor" ? [item("csca", "academic_results", "required", "Undergraduate applicants", cscaRule(program), "official_result", "csca", "English-taught Undergraduate Programs and Programs List")] : []),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the published CNY 400 application fee.", "document", "program_guide", "Programs Overview, page 2"),
    item("minimum_enrollment", "application_policy", "conditional", "Admitted students", "The program opens only when enrollment exceeds 15 students.", "school_review", "program_guide", "Programs Overview note, page 2", "enrollment"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", "Complete and submit the application before June 10, 2026.", "school_review", "program_guide", "How to apply, page 6"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}. The guide separately lists accommodation at CNY 5,500 per semester and insurance at CNY 800.`, "document", "program_guide", "Programs Overview, page 2", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, tuition: program.tuitionText, csca: cscaRule(program) });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const definitions = [...groups.values()].map((rows, index) => ({ key: `ouc-international-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }));
if (definitions.length !== 5 || definitions.flatMap((group) => group.rows).length !== 10) throw new Error("OUC grouping changed.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "ocean-university-of-china", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["This historical Fall 2026 cycle is closed and must not be shown as current.", "The Oceanography guide title does not exactly match the Marine Sciences title in the CSCA optional-subject table; Mathematics is explicit, while no optional-subject equivalence is inferred.", "The three scholarship records remain independent; no route-level entitlement is inferred."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete official-source requirements for OUC's ten published Fall 2026 English-taught international routes." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, scholarshipCount: seed.scholarships.length, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
