import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-47.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText: string; hskRequirement?: string; englishRequirement?: string; cscaRequirement: string; sourceSha256?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const expected = new Map([
  ["tsinghua-international-undergraduate-divisions-2026", "6a4281c15e754f284d0ee60ff2446f83f4950455bdcbd49f4b7371e7e2a5671b"],
  ["tsinghua-international-undergraduate-schedule-2026", "0a12432a35493923f0c74cc0ba80d83bb5727bbd6baaf9bd1397a5be6b1b3f38"],
  ["tsinghua-international-undergraduate-fees-2026", "2a616665e6074024a47024e6bf543c7c9475cb2e32317456b847b525aed753c5"],
  ["tsinghua-international-undergraduate-faq-2026", "72487490675d1b145faa4d40f20a71768f669b35165324a68997583cd3a37d20"],
  ["tsinghua-international-undergraduate-application-procedures-2026", "1460bcaf1e459a8a584c628b6d2d187a867b7e3a331beec474e60cade25c05d9"],
  ["tsinghua-international-undergraduate-upload-documents-2026", "6d93ddb8c9edda80d0cff0e4f28b592ae7a22e72786a4e5aa2d05061458809ed"],
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
if (evidence.size !== expected.size) throw new Error(`Missing locked Tsinghua evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const record = (key: string, id: string) => { const value = evidence.get(id)!; return { key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 }; };
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.tsinghua-complete-batch-01.draft.json"), "utf8")) as Seed;
const allUndergraduate = seed.programs.filter((program) => program.degreeLevel === "Undergraduate");
const currentZijingEvidenceSha256 = "8fa2cbe5148d5f22bb2824a088ee26312409cea1ef7c8bca6407a70f53036473";
const programs = allUndergraduate.filter((program) => program.sourceSha256 !== currentZijingEvidenceSha256);
const excluded = allUndergraduate.filter((program) => program.sourceSha256 === currentZijingEvidenceSha256);
if (allUndergraduate.length !== 91 || programs.length !== 83 || excluded.length !== 8 || seed.scholarships.length !== 4) throw new Error("Unexpected Tsinghua undergraduate scope.");
for (const program of programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-02-28T09:00:00.000Z")) throw new Error(`Missing Tsinghua intake: ${program.slug}`);
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] }; }
function document(program: Program): RequirementDocument {
  const english = program.teachingLanguage === "English";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    record("catalog", "tsinghua-international-undergraduate-divisions-2026"), record("schedule", "tsinghua-international-undergraduate-schedule-2026"), record("fees", "tsinghua-international-undergraduate-fees-2026"), record("faq", "tsinghua-international-undergraduate-faq-2026"), record("procedure", "tsinghua-international-undergraduate-application-procedures-2026"), record("documents", "tsinghua-international-undergraduate-upload-documents-2026"),
  ], requirements: [
    item("eligibility", "education", "required", "Undergraduate applicants", "Be a foreign citizen in good physical and mental health, be friendly to China, and hold or be completing a high-school graduation certificate under the published nationality rules.", "document", "faq", "FAQ eligibility items 1.1-1.3"),
    item("online_application", "application_policy", "required", "All applicants", "Create an account, complete the online form, upload every required document, pay the fee and submit within the designated application round.", "school_review", "procedure", "Online Application 1.1-1.4"),
    item("passport_and_visa", "identity", "required", "All applicants", "Upload the applicant's and parents' passport information pages and, when applicable, the applicant's visa and passport pages with China entry stamps. The applicant passport must expire after October 1, 2026.", "document", "documents", "Uploading Documents item 1"),
    item("graduation_certificate", "documents", "required", "All applicants", "Upload the applicable original high-school diploma, official pre-graduation certificate with expected graduation date, or university enrollment certificate.", "document", "documents", "Uploading Documents item 2"),
    item("cv_and_transcripts", "documents", "required", "All applicants", "Upload a Chinese- or English-language CV and the applicable original high-school and university transcripts.", "document", "documents", "Uploading Documents items 3-4"),
    item("language", "language", "required", `${program.teachingLanguage} route applicants`, english ? program.englishRequirement! : `${program.hskRequirement}. A published waiver may apply to native Chinese speakers or applicants educated in Chinese at high school.`, "official_result", "documents", "Uploading Documents items 5, 7 and 12"),
    item("academic_tests", "academic_results", "required", "All applicants", "Upload the national or regional graduation or matriculation examination certificate and/or available international standardized-test results such as SAT, ACT, A-Level, AP, IB or CSCA.", "official_result", "documents", "Uploading Documents item 6"),
    item("csca", "academic_results", "recommended", "Fall 2026 applicants", program.cscaRequirement, "official_result", "faq", "2026 CSCA FAQ"),
    item("recommendations", "documents", "required", "All applicants", "Arrange two recommendation letters through the online system; the system sends its template directly to each recommender's email address.", "document", "documents", "Uploading Documents item 8"),
    item("personal_statement", "documents", "required", "All applicants", "Upload a personal statement in Chinese or English.", "document", "documents", "Uploading Documents item 9"),
    item("financial_sponsor", "documents", "required", "All applicants", "Upload the Financial Sponsor form and the sponsor's employment or income certificate.", "document", "documents", "Uploading Documents item 10"),
    item("citizenship_history", "identity", "conditional", "Applicants with current or former Chinese citizenship or covered parentage/residence circumstances", "Submit the published immigration, citizenship cancellation, birth, nationality, parent nationality and overseas residence evidence applicable to the applicant.", "document", "documents", "Uploading Documents item 11"),
    item("introduction_video", "documents", "required", "All applicants", "Upload a Chinese-and-English self-introduction video no longer than three minutes and smaller than 20 MB in an accepted format.", "document", "documents", "Uploading Documents item 13"),
    item("portfolio", "documents", "conditional", "Arts Division or Architecture Division applicants", "Upload the required portfolio and, for architecture, the form confirming the applicant independently completed the portfolio.", "document", "documents", "Uploading Documents item 14"),
    item("guardian", "identity", "conditional", "Applicants under 18 on September 1, 2026", "Provide a certificate identifying a legal guardian who currently lives in Beijing and has a source of income.", "document", "documents", "Uploading Documents note 4"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable RMB 800 online application fee.", "document", "procedure", "Online Application 1.4"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", "Meet the applicable round deadline; the final general undergraduate deadline was February 28, 2026 at 17:00 Beijing time. Arts Design and Fine Arts routes were open only in the first round.", "school_review", "schedule", "2026 first- and second-round schedule"),
    item("assessment", "application_policy", "conditional", "Applicants who pass document screening", "Participate in Tsinghua's comprehensive assessment when invited. Arts and Architecture applicants also undergo portfolio review, with Arts arrangements notified separately.", "school_review", "procedure", "Comprehensive Evaluation 2.1-2.2"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "fees", "2026 undergraduate fee table", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of programs) { const identity = JSON.stringify({ language: program.teachingLanguage, tuition: program.tuitionText, hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "", csca: program.cscaRequirement }); groups.set(identity, [...(groups.get(identity) ?? []), program]); }
const definitions = [...groups.values()].map((rows, index) => ({ key: `tsinghua-undergraduate-explicit-fee-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }));
if (definitions.length !== 5 || definitions.flatMap((group) => group.rows).length !== 83) throw new Error("Tsinghua grouping changed.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "tsinghua-university", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Scope contains the 83 historical Fall 2026 undergraduate routes whose exact tuition is supported by the locked 2026 fee schedule. The eight Zijing College routes are handled separately under their current Fall 2027 official guide.", "This historical Fall 2026 cycle is closed and must not be shown as current.", "The four scholarship records remain independent; no route-level entitlement is inferred."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete requirements for Tsinghua's 83 Fall 2026 undergraduate routes with explicit official tuition." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: programs.length, targetedIntakeCount: programs.length, excludedProgramCount: excluded.length, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
