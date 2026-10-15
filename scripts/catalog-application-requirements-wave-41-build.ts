import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-41.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate"; teachingLanguage: "Chinese" | "English"; tuitionText: string; cscaRequirement: string; hskRequirement?: string; englishRequirement?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };

const primaryManifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/xjtu-complete-batch-01/manifest.json"), "utf8")) as { sources: Source[] };
const supportingManifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/xjtu-undergraduate-supporting-01/manifest.json"), "utf8")) as { sources: Source[] };
const expected = new Map([
  ["xjtu-undergraduate-guide-2026", "746ca59861829b899a623abfd565e9022c7221754740d202ce985620eeedb418"],
  ["xjtu-undergraduate-programs-2026", "936c805a0738099c2c020dd5ea7829b6697cc5d1d2da2be775c0d33e54bb7e80"],
  ["xjtu-undergraduate-program-csca-table-2026", "460683227698ccbe508d70d80e42da876ee9db4adde773764a4fa3b109e82539"],
  ["xjtu-medical-undergraduate-guide-2026", "35543637d348c71e0e453ee2b5c24a7acc721b7f782f8c24ac11102cbef7c7ff"],
]);
const allSources = [...primaryManifest.sources, ...supportingManifest.sources];
const source = (id: string) => {
  const found = allSources.find((entry) => entry.id === id);
  if (!found || found.status !== 200 || found.sha256 !== expected.get(id)) throw new Error(`XJTU evidence mismatch: ${id}`);
  return found;
};
const guide = source("xjtu-undergraduate-guide-2026");
const programs = source("xjtu-undergraduate-programs-2026");
const csca = source("xjtu-undergraduate-program-csca-table-2026");
const medical = source("xjtu-medical-undergraduate-guide-2026");
const record = (key: string, value: Source) => ({ key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 });
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.xjtu-complete-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 49 || seed.programIntakes.length !== 49 || seed.scholarships.length !== 6) throw new Error("Unexpected XJTU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-06-30T15:59:59.000Z")) throw new Error(`Missing exact XJTU Fall 2026 intake: ${program.slug}`);

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const languageRule = (program: Program) => program.teachingLanguage === "Chinese" ? program.hskRequirement! : program.englishRequirement!;
function commonRequirements(program: Program, sourceKey: "guide" | "medical", medicalRoute: boolean): RequirementItem[] {
  const page = medicalRoute ? "page 5" : "page 2";
  return [
    item("eligibility", "education", "required", "International undergraduate applicants", "Be under age 25, in good health, and provide a Guardian Authorization Letter if under age 18.", "document", sourceKey, `${page}, Eligibility`),
    item("passport", "identity", "required", "All applicants", "Hold and submit a valid foreign ordinary passport; the submitted passport must remain valid at least six months beyond the intended enrollment date.", "document", sourceKey, `${page}, Eligibility and Application Documents item 8`),
    item("diploma", "documents", "required", "All applicants", "Submit notarized Chinese- or English-language senior high-school graduation evidence; final-year students may apply with an expected-graduation certificate but must provide the official diploma before September 1, 2026.", "document", sourceKey, `${page}, Eligibility item 3 and Application Documents item 2`),
    item("transcripts", "documents", "required", "All applicants", "Submit notarized high-school academic transcripts with courses, scores, and grading-system explanation, plus the applicable home-country or international standardized-examination transcript.", "document", sourceKey, `${page}, Application Documents item 3`),
    item("language", "language", "required", `${program.teachingLanguage}-taught applicants`, languageRule(program), "official_result", sourceKey, `${page}, Language and Application Documents item 4`),
    item("csca", "academic_results", "required", "All undergraduate applicants", program.cscaRequirement, "official_result", "csca", "official 2026 program and CSCA subject table"),
    item("recommendation", "documents", "required", "All applicants", "Submit one recommendation letter from a high-school headmaster or teacher, including the recommender's email, phone number, and signature.", "document", sourceKey, `${page}, Application Documents item 6`),
    item("study_plan", "documents", "required", "All applicants", "Submit a study plan in English or Chinese of at least 600 characters or words.", "document", sourceKey, `${page}, Application Documents item 7`),
    item("physical_examination", "documents", "required", "All applicants", "Submit the official Physical Examination Record for Foreigner, fully completed and valid for six months.", "document", sourceKey, `${page}, Application Documents item 9`),
    item("non_criminal_record", "documents", "required", "All applicants", "Submit a non-criminal record within its validity period.", "document", sourceKey, `${page}, Application Documents item 10`),
    item("application_window", "application_policy", "required", "Fall 2026 applicants", "Apply online from November 1, 2025 through June 30, 2026; this historical cycle is closed.", "school_review", sourceKey, `${page}, Application Time`),
    item("application_fee", "application_policy", "required", "All applicants", medicalRoute ? "Pay the published non-refundable CNY 500 application fee." : "Pay the published non-refundable application fee: CNY 500 for self-sponsored applications or CNY 800 for scholarship applications.", "document", sourceKey, medicalRoute ? "page 6, Other School Fees" : "page 2, Application fee"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", sourceKey, medicalRoute ? "page 4, International Undergraduate Programs" : "page 2, Fee Standard", "enrollment"),
    item("accommodation", "other", "conditional", "Students using university accommodation", "Published accommodation ranges from CNY 8,000 to CNY 19,000 per year and is arranged under the university's current annual policy.", "document", sourceKey, medicalRoute ? "page 6, Other School Fees" : "page 2, Accommodation fee", "enrollment"),
  ];
}
function document(program: Program): RequirementDocument {
  const medicalRoute = program.tuitionText === "CNY 40,000/academic year" && program.teachingLanguage === "English";
  const sourceKey = medicalRoute ? "medical" : "guide";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record(sourceKey, medicalRoute ? medical : guide), record("programs", programs), record("csca", csca)], requirements: commonRequirements(program, sourceKey, medicalRoute) });
}

const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ language: program.teachingLanguage, tuition: program.tuitionText, hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "", csca: program.cscaRequirement });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const definitions = [...groups.values()].map((rows, index) => ({ key: `xjtu-undergraduate-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }));
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 9 || targets.length !== 49 || new Set(targets).size !== 49) throw new Error("XJTU requirement groups are incomplete.");
const templates = definitions.map((definition) => ({
  key: definition.key,
  schoolSlug: "xi-an-jiaotong-university",
  cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug),
  targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready" as const,
  reviewStatus: "unreviewed" as const,
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [
    "This is a closed historical Fall 2026 route and must not be presented as a current application window.",
    "Scholarship records remain separate unreviewed catalog drafts; no award is implied for an individual route.",
    ...(definition.rows[0].teachingLanguage === "English" && definition.rows[0].tuitionText === "CNY 40,000/academic year" ? ["The reviewed MBBS guide accepts TOEFL, IELTS and Duolingo evidence but does not publish one universal numeric threshold."] : []),
  ],
  document: definition.document,
}));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Source-located complete-scope XJTU 2026 undergraduate requirements bound only to exact closed program-intake records." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
