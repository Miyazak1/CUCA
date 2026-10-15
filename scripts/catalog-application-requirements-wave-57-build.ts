import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-57.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; tuitionText: string; hskRequirement: string; cscaRequirement: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; deadlineDate?: string; status: string }[] };

const expected = new Map([
  ["bnu-undergraduate-admissions-en-2026", "ac577f79869863eddb3fec145b7a5e59c542386bea1f61a2ca50906ee78c14e3"],
  ["bnu-undergraduate-major-catalog-en-2026", "b345b4b959d0ecd71329d690ad442959e4d9ef02f307b5b954f198fbcede797b"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const source of manifest.sources ?? []) if (source.status === 200 && expected.get(source.id) === source.sha256) evidence.set(source.id, source);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked BNU evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const sourceRecord = (key: string, id: string) => {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};
const item = (sourceKey: string, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem =>
  ({ key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] });

const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.bnu-school-program-batch-01.approved.local.json"), "utf8")) as Seed;
if (seed.programs.length !== 33 || seed.programIntakes.length !== 33) throw new Error("Unexpected BNU undergraduate seed size.");
for (const program of seed.programs) {
  const intake = seed.programIntakes.find((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2026);
  if (!intake || intake.status !== "closed" || intake.deadlineDate !== "2026-03-15T15:59:59.000Z") throw new Error(`Unexpected BNU intake: ${program.slug}`);
}

const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const key = JSON.stringify([program.hskRequirement, program.cscaRequirement, program.tuitionText]);
  groups.set(key, [...(groups.get(key) ?? []), program]);
}
const expectedGroupCounts = [1, 1, 1, 12, 7, 11];
const groupedPrograms = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const actualCounts = groupedPrograms.map(([, programs]) => programs.length).sort((a, b) => a - b);
if (JSON.stringify(actualCounts) !== JSON.stringify([...expectedGroupCounts].sort((a, b) => a - b))) throw new Error(`Unexpected BNU requirement groups: ${actualCounts.join(",")}`);

const common = (): RequirementItem[] => [
  item("guide", "conduct_health", "identity", "required", "International undergraduate applicants", "Observe Chinese laws and BNU rules, respect Chinese customs, demonstrate good moral character, have no criminal record, and be healthy enough to study and live independently in China.", "school_review", "Section II, item 1"),
  item("guide", "citizenship_age", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a valid foreign passport and be 18 to 40 years old under the published 2026 date rule; applicants under 18 on September 1, 2026 must have a guardian in China.", "document", "Section II, item 2"),
  item("guide", "nationality_residence", "identity", "conditional", "Applicants with a Chinese parent or former mainland, Hong Kong, Macao or Taiwan residence", "Meet the published foreign-nationality holding period and overseas-residence rules and provide the related entry-exit, naturalization, renunciation and household-registration records when applicable.", "document", "Section II, item 3 and Section V, item 10"),
  item("guide", "education", "education", "required", "International undergraduate applicants", "Hold a qualification equivalent to a Chinese high-school graduation certificate or above.", "document", "Section II, item 4"),
  item("guide", "application_window", "application_policy", "required", "Fall 2026 applicants", "Complete the online application from November 15, 2025 through March 15, 2026, China Standard Time. This is a closed historical intake.", "school_review", "Section III, item 1"),
  item("guide", "paper_documents", "documents", "required", "Applicants who pass initial review", "Mail the required paper application records promptly using one of BNU's published delivery services; late paper materials terminate review and admission processing.", "document", "Section III, item 2"),
  item("guide", "online_application", "application_policy", "required", "Fall 2026 applicants", "Register in BNU's international-student online application system, select Undergraduate Student, complete the form and upload all required materials. Up to two majors may be selected.", "school_review", "Section IV, item 1"),
  item("guide", "application_fee", "application_policy", "required", "Fall 2026 applicants", "Pay the non-refundable CNY 500 online application fee; applications are not processed before payment.", "document", "Section IV, item 2"),
  item("guide", "application_form", "documents", "required", "Fall 2026 applicants", "Submit the original BNU International Undergraduate Students Application Form generated by the online system.", "document", "Section V, item 1"),
  item("guide", "diploma", "documents", "required", "Fall 2026 applicants", "Submit the original notarized or authenticated high-school graduation certificate; expected graduates may submit the original expected-graduation certificate and must present the formal graduation certificate at registration.", "document", "Section V, item 2"),
  item("guide", "transcripts", "documents", "required", "Fall 2026 applicants", "Submit original, notarized or authenticated transcripts for every year and course of high school.", "document", "Section V, item 3"),
  item("guide", "csca_report", "academic_results", "required", "Fall 2026 applicants", "Submit a valid CSCA report for the exact subjects assigned to the selected major.", "official_result", "Section V, item 4 and Section VI"),
  item("guide", "hsk_report", "language", "required", "Fall 2026 applicants", "Submit the program-specific HSK certificate and transcript; the test date must be no earlier than November 1, 2023.", "official_result", "Section V, item 5"),
  item("guide", "recommendation", "documents", "required", "Fall 2026 applicants", "Submit a signed recommendation letter from a high-school teacher, head teacher or school leader.", "document", "Section V, item 6"),
  item("guide", "personal_statement", "documents", "required", "Fall 2026 applicants", "Use BNU's personal-statement form, print it and complete it by hand in Chinese; a typed statement is not accepted.", "document", "Section V, item 7"),
  item("guide", "passport", "identity", "required", "Fall 2026 applicants", "Submit the passport information page; the passport must remain valid beyond March 31, 2027. Also provide the most recent Chinese visa and, when currently in China, the valid residence permit.", "document", "Section V, item 8"),
  item("guide", "criminal_record", "documents", "required", "Fall 2026 applicants", "Submit a no-criminal-record certificate or the published commitment letter.", "document", "Section V, item 9"),
  item("guide", "guardian", "documents", "conditional", "Applicants under 18 on September 1, 2026", "Submit the original notarized guardian certificate for the province or municipality of the teaching campus.", "document", "Section V, item 11"),
  item("guide", "translations", "documents", "required", "Applicants with records not in Chinese or English", "Attach an original notarized Chinese or English translation to each non-Chinese and non-English document.", "document", "Section V, notes"),
  item("guide", "interview", "academic_results", "required", "Fall 2026 applicants", "Attend the BNU interview for every selected major after notice through the application system and email.", "school_review", "Section VI, item 2"),
  item("guide", "duration_language", "education", "required", "Enrolled undergraduate students", "Study full time for four years in Chinese.", "school_review", "Section VIII", "enrollment"),
  item("guide", "scholarships", "application_policy", "recommended", "Applicants seeking funding", "Review the separately administered BNU New International Students Scholarship, Silk Road Muduo Scholarship, Beijing Government Scholarship, Chinese Government Scholarship and International Chinese Language Teachers Scholarship; scholarship selection does not replace admission requirements.", "school_review", "Section IX"),
  item("guide", "accommodation", "other", "conditional", "Students seeking university accommodation", "Follow the campus-specific accommodation process. Beijing-campus applicants book after receiving the electronic admission notice during the published July 1 to August 15, 2026 window; Zhuhai-campus dormitories are assigned by Phoenix School and carry a published annual fee of CNY 7,500.", "document", "Section X", "preparation"),
];

const templates = groupedPrograms.map(([serialized, programs], index) => {
  const [hsk, csca, tuition] = JSON.parse(serialized) as [string, string, string];
  const groupKey = `group-${String(index + 1).padStart(2, "0")}`;
  const document = parseRequirementDocument({
    schemaVersion: 1,
    language: "en",
    coverage: "complete",
    sources: [sourceRecord("guide", "bnu-undergraduate-admissions-en-2026"), sourceRecord("catalog", "bnu-undergraduate-major-catalog-en-2026")],
    requirements: [
      ...common(),
      item("catalog", "program_hsk", "language", "required", "Applicants in this exact program group", `Submit ${hsk.replace("HSK Level", "HSK Level")}.`, "official_result", "2026 major catalog, matching rows"),
      item("catalog", "program_csca", "academic_results", "required", "Applicants in this exact program group", `Submit results for ${csca.replace(/^CSCA in Chinese: /, "")}; take the subjects in Chinese.`, "official_result", "2026 major catalog, matching rows"),
      item("catalog", "tuition", "application_policy", "required", "Enrolled students in this exact program group", `Pay ${tuition.replace("RMB ", "RMB ").replace("/year", " per academic year")}.`, "document", "2026 major catalog, matching rows", "enrollment"),
    ],
  });
  return {
    key: `bnu-undergraduate-${groupKey}-fall-2026`,
    schoolSlug: "beijing-normal-university",
    cycle: "fall-2026",
    targetProgramSlugs: programs.map((program) => program.slug),
    targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready" as const,
    reviewStatus: "unreviewed" as const,
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window."],
    document,
  };
});

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete official-source BNU Fall 2026 requirements for every published undergraduate catalog row.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.length,
    blockedTemplateCount: 0,
    targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programs.length,
    excludedProgramCount: 0,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0),
  },
  exclusions: { undergraduate: [] },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
