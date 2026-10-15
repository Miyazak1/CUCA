import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-45.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionAmount?: number; tuitionText: string; cscaRequirement?: string; hskRequirement?: string; englishRequirement?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const admissionsManifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/whu-complete-batch-01/manifest.json"), "utf8")) as { sources: Source[] };
const feeManifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/whu-fees-page-batch-01/manifest.json"), "utf8")) as { sources: Source[] };
const allSources = [...admissionsManifest.sources, ...feeManifest.sources];
const expected = new Map([
  ["whu-undergraduate-guide-2026", "a5922203ef423a934b1c72cdf55290dc7fe1d351d2da8c04a43679e461f10de1"],
  ["whu-postgraduate-guide-2026", "ab91135bfc8763d3c8ce100e5d7e8205f35d8f740b5774e36dabd921bd91bda3"],
  ["whu-csca-instructions-2026", "daf166ef5e9f5dadd73ca46dfec0ddc48708eb7bde9c04dccd16268bd8d10ca4"],
  ["whu-international-student-fees-current", "44f3363bfdf11003a6101c395af2208878c74b71fddeb29e9e51bd9b29b3a338"],
]);
const source = (id: string) => {
  const found = allSources.find((entry) => entry.id === id);
  if (!found || found.status !== 200 || found.sha256 !== expected.get(id)) throw new Error(`WHU evidence mismatch: ${id}`);
  return found;
};
const ugGuide = source("whu-undergraduate-guide-2026");
const pgGuide = source("whu-postgraduate-guide-2026");
const csca = source("whu-csca-instructions-2026");
const fees = source("whu-international-student-fees-current");
const record = (key: string, value: Source) => ({ key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 });
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.whu-complete-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 599 || seed.programIntakes.length !== 599 || seed.scholarships.length !== 6) throw new Error("Unexpected WHU complete seed.");
for (const program of seed.programs) {
  const deadline = program.degreeLevel === "Undergraduate" ? "2026-06-30T15:59:59.000Z" : "2026-06-15T15:59:59.000Z";
  if (!program.tuitionAmount || !seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === deadline)) {
    throw new Error(`Missing exact WHU program/intake/tuition binding: ${program.slug}`);
  }
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const languageRule = (program: Program) => program.teachingLanguage === "Chinese" ? program.hskRequirement! : program.englishRequirement!;
function undergraduateDocument(program: Program): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", ugGuide), record("csca", csca), record("fees", fees)], requirements: [
    item("eligibility", "education", "required", "Undergraduate applicants", "Be a non-Chinese citizen in good physical and mental health and hold a high-school diploma or equivalent.", "document", "guide", "Eligibility section"),
    item("age_and_guardian", "identity", "conditional", "Applicants outside the standard age or under 18", "Applicants are generally 18-30 years old; an applicant under 18 must submit the published guardian documentation.", "document", "guide", "Eligibility age and guardian provisions"),
    item("online_application", "application_policy", "required", "All applicants", "Complete the Wuhan University international-student online application and upload the required evidence.", "school_review", "guide", "Application procedure"),
    item("passport", "identity", "required", "All applicants", "Submit the passport identity page.", "document", "guide", "Application materials: passport"),
    item("diploma", "documents", "required", "All applicants", "Submit the high-school diploma; a current graduating student may submit official expected-graduation proof and must provide the final diploma after admission.", "document", "guide", "Application materials: diploma"),
    item("transcript", "documents", "required", "All applicants", "Submit the complete high-school academic transcript.", "document", "guide", "Application materials: transcript"),
    item("csca", "academic_results", "required", "All undergraduate applicants", program.cscaRequirement!, "official_result", "csca", "2026 CSCA subject-combination table"),
    item("language", "language", "required", `${program.teachingLanguage}-taught applicants`, languageRule(program), "official_result", "guide", "Eligibility language requirements"),
    item("financial_support", "documents", "required", "Self-funded applicants", "Submit a financial statement showing at least USD 5,000 or equivalent.", "document", "guide", "Application materials: financial statement"),
    item("prior_china_study", "documents", "conditional", "Applicants who previously studied in China", "Submit the academic records and status evidence required for prior study in China.", "document", "guide", "Application materials: prior study in China"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the Foreigner Physical Examination Form completed as required by the guide.", "document", "guide", "Application materials: physical examination"),
    item("application_deadline", "application_policy", "required", "Fall 2026 self-funded applicants", "Submit by June 30, 2026; this historical application cycle is closed.", "school_review", "guide", "Application period"),
    item("assessment", "application_policy", "conditional", "Applicants selected after document review", "Participate in the university interview or examination when requested after document review.", "school_review", "guide", "Admission and assessment procedure"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "fees", "Official international-student fee schedule", "enrollment"),
  ] });
}
function postgraduateDocument(program: Program): RequirementDocument {
  const doctoral = program.degreeLevel === "Doctoral";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", pgGuide), record("fees", fees)], requirements: [
    item("eligibility", "education", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen in good physical and mental health.", "document", "guide", "Eligibility section"),
    item("degree_and_age", "education", "required", `${program.degreeLevel} applicants`, doctoral ? "Hold a master's degree or equivalent and normally be no older than 45." : "Hold a bachelor's degree or equivalent and normally be no older than 35.", "document", "guide", "Eligibility degree and age provisions"),
    item("online_application", "application_policy", "required", "All applicants", "Complete the Wuhan University international-student online application and upload the required evidence.", "school_review", "guide", "Application procedure"),
    item("passport", "identity", "required", "All applicants", "Submit the passport identity page and the applicable China visa or residence information if relevant.", "document", "guide", "Application materials: passport and visa"),
    item("degree_certificates", "documents", "required", "All applicants", doctoral ? "Submit bachelor's and master's degree certificates; a current graduating student may submit official expected-graduation proof." : "Submit the bachelor's degree certificate; a current graduating student may submit official expected-graduation proof.", "document", "guide", "Application materials: degree certificates"),
    item("transcripts", "documents", "required", "All applicants", doctoral ? "Submit complete bachelor's and master's academic transcripts." : "Submit the complete bachelor's academic transcript.", "document", "guide", "Application materials: transcripts"),
    item("recommendations", "documents", "required", "All applicants", doctoral ? "Submit two recommendation letters from professors or associate professors." : "Submit two recommendation letters from professors, associate professors or equivalent experts.", "document", "guide", "Application materials: recommendation letters"),
    item("study_plan", "documents", "required", "All applicants", doctoral ? "Submit a study or research plan of at least 1,000 words, including the required doctoral research overview." : "Submit a study or research plan of at least 1,000 words.", "document", "guide", "Application materials: study or research plan"),
    item("language", "language", "required", `${program.teachingLanguage}-taught applicants`, languageRule(program), "official_result", "guide", "Eligibility language requirements"),
    item("prior_china_study", "documents", "conditional", "Applicants who previously studied in China", "Submit the academic records and status evidence required for prior study in China.", "document", "guide", "Application materials: prior study in China"),
    item("financial_support", "documents", "required", "Self-funded applicants", "Submit a financial statement showing at least USD 5,000 or equivalent.", "document", "guide", "Application materials: financial statement"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable application fee of CNY 800 or USD 111.", "document", "guide", "Application materials and fee provision"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the Foreigner Physical Examination Form completed as required by the guide.", "document", "guide", "Application materials: physical examination"),
    item("application_deadline", "application_policy", "required", "Fall 2026 self-funded applicants", "Submit by June 15, 2026; this historical application cycle is closed.", "school_review", "guide", "Application period"),
    item("assessment", "application_policy", "conditional", "Applicants selected after document review", "Participate in the university interview or examination when requested after document review.", "school_review", "guide", "Admission and assessment procedure"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "fees", "Official international-student fee schedule", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText, csca: program.cscaRequirement ?? "", hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "" });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const definitions = [...groups.values()].map((rows, index) => ({
  key: `whu-${rows[0].degreeLevel.toLowerCase()}-group-${String(index + 1).padStart(2, "0")}-fall-2026`,
  rows,
  document: rows[0].degreeLevel === "Undergraduate" ? undergraduateDocument(rows[0]) : postgraduateDocument(rows[0]),
}));
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 18 || targets.length !== 599 || new Set(targets).size !== 599) throw new Error("WHU requirement groups are incomplete.");
const templates = definitions.map((definition) => ({
  key: definition.key,
  schoolSlug: "wuhan-university",
  cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug),
  targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready" as const,
  reviewStatus: "unreviewed" as const,
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 cycle and must not be presented as open.", "The six scholarship records are independent awards; no program-level scholarship eligibility or entitlement is inferred."],
  document: definition.document,
}));
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete-scope WHU 2026 requirements bound to 599 exact official program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
