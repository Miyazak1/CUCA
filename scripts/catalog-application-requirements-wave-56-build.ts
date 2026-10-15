import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-56.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; nameZh: string; degreeLevel: string };
type Intake = { programSlug: string; intakeTerm: string; intakeYear: number; deadlineDate?: string; status: string };
type Seed = { programs: Program[]; programIntakes: Intake[] };

const expected = new Map([
  ["blcu-undergraduate-programs-pdf-2026", "9afce0ef7a651d54a67be6b62a0f1783cc3e2c6bac080def5a22c9b9d58ab954"],
  ["blcu-undergraduate-entry-requirements-current", "11b21f64ff65f086c274da91b010981809b6da92d1a0a91c70fcc05fa4b55a43"],
  ["blcu-undergraduate-application-process-current", "36b44509142687aedc50cb99a7ddacc76005d9db134925aac30b2fc72809b8f7"],
  ["blcu-csca-instructions-en-2026", "34341f59ccb7b8f7aa43004897f14d02951f038cb4a7fe35391703e680c67124"],
  ["blcu-beijing-government-scholarship-2026-2027", "4a3953ab0f67ead9647aad45d71eb8ca25fcf22dded77a852bac8a61047874c9"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const source of manifest.sources ?? []) {
      if (source.status === 200 && expected.get(source.id) === source.sha256) evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked BLCU evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);

const sourceRecord = (key: string, id: string) => {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};
const item = (sourceKey: string, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem =>
  ({ key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] });

const undergraduateSeed = JSON.parse(await readFile(resolve(root, "seeds/catalog.blcu-undergraduate-safe-batch-01.approved.local.json"), "utf8")) as Seed;
const graduateSeeds = await Promise.all(["01", "02", "03"].map(async (batch) =>
  JSON.parse(await readFile(resolve(root, `seeds/catalog.blcu-graduate-safe-batch-${batch}.approved.local.json`), "utf8")) as Seed));

const groupSpecs = [
  {
    key: "applied-chinese",
    slugs: [
      "beijing-language-and-culture-university-applied-chinese-technology-2026",
      "beijing-language-and-culture-university-applied-chinese-business-2026",
      "beijing-language-and-culture-university-applied-chinese-tourism-2026",
    ],
    language: "Chinese",
    languageRule: "Submit HSK Level 4 with a total score of at least 180.",
    cscaRule: "Take CSCA Humanities Chinese and Mathematics in Chinese.",
    tuitionRule: "Published annual tuition is CNY 25,800 for the Beijing campus or CNY 22,000 for the Hainan campus, according to the assigned campus.",
    routeRule: "Follow the applied-Chinese campus assignment and major-direction arrangement published by BLCU.",
    routeLocator: "Section 4.3, Program for International Students (Separate Classes), Applied Chinese rows",
  },
  {
    key: "joint-class-humanities",
    slugs: [
      "beijing-language-and-culture-university-international-politics-2026",
      "beijing-language-and-culture-university-international-affairs-and-international-relations-2026",
      "beijing-language-and-culture-university-network-and-new-media-2026",
      "beijing-language-and-culture-university-journalism-2026",
    ],
    language: "Chinese",
    languageRule: "Submit HSK Level 5 with a total score of at least 200 and at least 60 in every section.",
    cscaRule: "Take CSCA Humanities Chinese and Mathematics in Chinese.",
    tuitionRule: "Pay annual tuition of CNY 25,800.",
    routeRule: "Pass the program interview covering comprehensive Chinese and professional foundations.",
    routeLocator: "Section 4.4, International Politics and Communication rows",
  },
  {
    key: "joint-class-computing",
    slugs: [
      "beijing-language-and-culture-university-computer-science-and-technology-2026",
      "beijing-language-and-culture-university-artificial-intelligence-2026",
      "beijing-language-and-culture-university-data-science-and-big-data-technology-2026",
      "beijing-language-and-culture-university-digital-media-technology-2026",
    ],
    language: "Chinese",
    languageRule: "Submit HSK Level 5 with a total score of at least 180.",
    cscaRule: "Take CSCA Science Chinese and Mathematics in Chinese.",
    tuitionRule: "Pay annual tuition of CNY 25,800.",
    routeRule: "Pass the program written examination in mathematics and logic and the interview covering mathematics, logic and information-technology ability.",
    routeLocator: "Section 4.4, School of Information Science rows",
  },
  {
    key: "joint-class-english-majors",
    slugs: [
      "beijing-language-and-culture-university-english-2026",
      "beijing-language-and-culture-university-english-english-spanish-bilingual-2026",
      "beijing-language-and-culture-university-business-english-2026",
    ],
    language: "Chinese",
    languageRule: "Submit HSK Level 5 with a total score of at least 180 and either IELTS 6.5 or TOEFL 90 or above.",
    cscaRule: "Take CSCA Humanities Chinese and Mathematics in Chinese.",
    tuitionRule: "Pay annual tuition of CNY 27,600.",
    routeRule: "Meet both the published Chinese and English proficiency thresholds for the English-major group.",
    routeLocator: "Section 4.4, School of English and Advanced Translation rows",
  },
] as const;

const programBySlug = new Map(undergraduateSeed.programs.map((program) => [program.slug, program]));
const targetedPrograms = groupSpecs.flatMap((group) => group.slugs.map((slug) => {
  const program = programBySlug.get(slug);
  if (!program) throw new Error(`Missing BLCU undergraduate program: ${slug}`);
  const intake = undergraduateSeed.programIntakes.find((row) => row.programSlug === slug && row.intakeTerm === "Fall" && row.intakeYear === 2026);
  if (!intake || intake.status !== "closed" || intake.deadlineDate !== "2026-06-30T00:00:00.000Z") throw new Error(`Unexpected BLCU Fall 2026 intake: ${slug}`);
  return program;
}));
if (new Set(targetedPrograms.map((program) => program.slug)).size !== 14) throw new Error("Unexpected BLCU exact undergraduate route count.");

const commonRequirements = (): RequirementItem[] => [
  item("entry", "education", "education", "required", "International undergraduate applicants", "Hold a high-school diploma or an equivalent or higher qualification.", "document", "Section 1, item 1"),
  item("entry", "age", "identity", "required", "International undergraduate applicants", "Be 18 to 55 years old; applicants under 18 require university approval and notarized guardian documents.", "document", "Section 1, item 2"),
  item("entry", "citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding an ordinary foreign passport and meet the applicable nationality and overseas-residence rules for applicants with Chinese-parent or former Chinese-resident connections.", "document", "Section 1, item 3 and nationality notes"),
  item("entry", "application_deadline", "application_policy", "required", "Fall 2026 applicants", "Submit the application by June 30, 2026. This is a closed historical intake.", "school_review", "Section 2, Fall 2026 application deadline"),
  item("entry", "passport", "identity", "required", "Fall 2026 applicants", "Submit the passport information page.", "document", "Section 3, item 1"),
  item("entry", "diploma_transcripts", "documents", "required", "Fall 2026 applicants", "Submit the high-school diploma and complete transcripts for every semester; expected graduates may submit a pre-graduation certificate but must provide the formal diploma before enrollment.", "document", "Section 3, item 2"),
  item("entry", "language_certificate", "language", "required", "Fall 2026 applicants", "Submit the applicable HSK certificate and any program-specific foreign-language evidence.", "official_result", "Section 3, item 3 and Section 4 program table"),
  item("entry", "csca_result", "academic_results", "required", "Fall 2026 applicants", "Submit a valid CSCA score report for the exact subjects assigned to the program.", "official_result", "Section 3, item 4"),
  item("entry", "recommendation", "documents", "required", "Fall 2026 applicants", "Submit a recommendation letter in Chinese or English, signed by the recommender and carrying valid contact details.", "document", "Section 3, item 5"),
  item("entry", "application_fee", "application_policy", "required", "Fall 2026 applicants", "Pay the non-refundable CNY 800 application fee through the online application system.", "document", "Section 3, item 6"),
  item("entry", "guarantor", "documents", "required", "Fall 2026 applicants", "Submit the guarantor's valid identity document; a foreign guarantor in China must also provide a valid Chinese visa.", "document", "Section 3, item 7"),
  item("entry", "photo", "documents", "required", "Fall 2026 applicants", "Submit a personal identification photo.", "document", "Section 3, item 8"),
  item("entry", "criminal_record", "documents", "required", "Fall 2026 applicants", "Submit a no-criminal-record certificate.", "document", "Section 3, item 9"),
  item("entry", "other_materials", "documents", "conditional", "Applicants to programs requesting additional evidence", "Submit any other material required by the selected program.", "document", "Section 3, item 10"),
  item("process", "online_application", "application_policy", "required", "Fall 2026 applicants", "Apply through the BLCU international-student application system, upload the electronic materials, monitor telephone and email contact, and provide an accurate admission-document delivery address.", "school_review", "Application process, steps 1-3"),
  item("scholarship", "beijing_government_scholarship", "application_policy", "recommended", "Eligible self-funded Fall 2026 degree applicants", "The BLCU Beijing Government Scholarship may cover first-year tuition for approved bachelor, master or doctoral applicants; the published Fall 2026 scholarship deadline is July 15, 2026 and selection is separate from admission.", "school_review", "Sections 2-5"),
];

const templates = groupSpecs.map((group) => {
  const sourceKey = "entry";
  const document = parseRequirementDocument({
    schemaVersion: 1,
    language: "en",
    coverage: "complete",
    sources: [
      sourceRecord("catalog", "blcu-undergraduate-programs-pdf-2026"),
      sourceRecord(sourceKey, "blcu-undergraduate-entry-requirements-current"),
      sourceRecord("process", "blcu-undergraduate-application-process-current"),
      sourceRecord("csca", "blcu-csca-instructions-en-2026"),
      sourceRecord("scholarship", "blcu-beijing-government-scholarship-2026-2027"),
    ],
    requirements: [
      ...commonRequirements(),
      item(sourceKey, "program_language", "language", "required", `${group.language}-taught applicants in this program group`, group.languageRule, "official_result", group.routeLocator),
      item("csca", "csca_subjects", "academic_results", "required", "Applicants in this exact program group", group.cscaRule, "official_result", "BLCU Program list and CSCA Exam Subject, matching program rows"),
      item(sourceKey, "route_assessment", "academic_results", "required", "Applicants in this exact program group", group.routeRule, "school_review", group.routeLocator),
      item("catalog", "tuition", "application_policy", "required", "Enrolled students in this exact program group", group.tuitionRule, "document", "2026 undergraduate catalog PDF, matching program rows", "enrollment"),
    ],
  });
  return {
    key: `blcu-undergraduate-${group.key}-fall-2026`,
    schoolSlug: "beijing-language-and-culture-university",
    cycle: "fall-2026",
    targetProgramSlugs: [...group.slugs],
    targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready" as const,
    reviewStatus: "unreviewed" as const,
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window."],
    document,
  };
});

const targetSet = new Set(targetedPrograms.map((program) => program.slug));
const undergraduateExcluded = undergraduateSeed.programs.filter((program) => !targetSet.has(program.slug));
const graduatePrograms = graduateSeeds.flatMap((seed) => seed.programs);
if (undergraduateExcluded.length !== 22 || graduatePrograms.length !== 60) throw new Error("Unexpected BLCU exclusion counts.");

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete official-source BLCU Fall 2026 requirements for exact, conflict-free undergraduate routes.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.length,
    blockedTemplateCount: 0,
    targetedProgramCount: targetedPrograms.length,
    targetedIntakeCount: targetedPrograms.length,
    excludedProgramCount: undergraduateExcluded.length + graduatePrograms.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0),
  },
  exclusions: {
    undergraduate: undergraduateExcluded.map((program) => ({
      programSlug: program.slug,
      reason: "The reviewed current entry-requirement table does not provide an exact, unambiguous row match for this catalog route, so teaching language, tuition or route-specific requirements remain unresolved.",
    })),
    graduate: graduatePrograms.map((program) => ({
      programSlug: program.slug,
      reason: "Official 2026 graduate sources conflict on the application deadline: the program catalog states July 30, while the later degree-specific admissions guide states July 6 for master's or June 30 for doctoral applications. No deadline was selected automatically.",
    })),
  },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
