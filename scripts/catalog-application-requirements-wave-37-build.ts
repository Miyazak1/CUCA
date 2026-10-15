import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-37.draft.json");
const manifestPaths = [
  "work/catalog-official/seu-complete-batch-01/manifest.json",
  "work/catalog-official/seu-program-catalog-supplement-01/manifest.json",
  "work/catalog-official/seu-program-catalog-en-supplement-01/manifest.json",
];
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionText: string; cscaSubjects?: string[]; hskRequirement?: string; englishRequirement?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const expected = {
  "seu-undergraduate-guide-en-pdf-2026": "d1e7a5df4563b6c43b9c7a13a550e48ac4d20bdf919e125a9f2193ae9e281c14",
  "seu-graduate-guide-zh-pdf-2026": "e89f361676bfd717dc5d52ae2709cd1d54d2fb618b6c6255558f3f16bb6d8197",
  "seu-undergraduate-programs-en-pdf-2026": "18a48f4c8d045872a356d1202712c3e682c7b0ddb30f18ac104c0f6258bd94f9",
  "seu-master-programs-en-pdf-2026": "e8b89c7977f819fecdb88f55fbc47cc71e2c923f6a51d51b3ce4ff27fd74c7a1",
  "seu-doctoral-programs-en-pdf-2026": "09fd319c5db64c29b2cc05ab5e7a4480c5cea373d66dcba943ed4e6b12c37528",
  "seu-yes-digital-management-2026": "153ecb4af76a9d6ad479dadeb3ab5d5d9e9afeaaf0adb5ca81bc67ced7cb0b9e",
  "seu-yes-sustainable-infrastructure-2026": "e8804a64deba5b1fb73ddb4e3d18a99d8ffa4bb720ae3f463c60923d7d6c6c0c",
} as const;
const evidence = new Map<string, Source>();
for (const path of manifestPaths) {
  const manifest = JSON.parse(await readFile(resolve(root, path), "utf8"));
  for (const row of manifest.sources as Source[]) if (row.id in expected) {
    if (row.status !== 200 || row.sha256 !== expected[row.id as keyof typeof expected]) throw new Error(`SEU requirement evidence mismatch: ${row.id}`);
    evidence.set(row.id, row);
  }
}
if (evidence.size !== Object.keys(expected).length) throw new Error(`Incomplete SEU requirement evidence: ${evidence.size}/${Object.keys(expected).length}`);
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.seu-complete-batch-02.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 232 || seed.programIntakes.length !== 232) throw new Error("Unexpected SEU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate)) throw new Error(`Missing exact SEU Fall 2026 intake: ${program.slug}`);

type SourceKey = "guide" | "catalog" | "special";
function sourceRecord(key: SourceKey, id: keyof typeof expected) {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const specialId = (program: Program) => program.slug.includes("digital-and-intelligent-management")
  ? "seu-yes-digital-management-2026"
  : program.slug.includes("sustainable-infrastructure") ? "seu-yes-sustainable-infrastructure-2026" : undefined;
const catalogId = (program: Program): keyof typeof expected => program.degreeLevel === "Undergraduate"
  ? "seu-undergraduate-programs-en-pdf-2026"
  : program.degreeLevel === "Master" ? "seu-master-programs-en-pdf-2026" : "seu-doctoral-programs-en-pdf-2026";
function languageRule(program: Program) {
  if (program.teachingLanguage === "Chinese") return program.hskRequirement ?? "Meet the published Chinese-language requirement for the exact route.";
  return program.englishRequirement ?? "Meet the published English-language requirement for the exact route.";
}

function undergraduateDocument(program: Program): RequirementDocument {
  const subjects = (program.cscaSubjects ?? []).join(", ");
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "seu-undergraduate-guide-en-pdf-2026"), sourceRecord("catalog", catalogId(program)),
  ], requirements: [
    item("guide", "citizenship_education_age", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen, have graduated from high school and be over age 18.", "school_review", "Guide page 2, Qualification item 1"),
    item("guide", "nationality_review", "identity", "conditional", "Applicants with Chinese-mainland, Hong Kong, Macao or Taiwan history, or Chinese-citizen parentage", "Meet Ministry of Education Document No. 12 [2020], including the applicable foreign-nationality, Chinese-nationality cancellation and overseas-residence evidence.", "school_review", "Guide page 2, Qualification item 2"),
    item("guide", "application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Apply in one of four published batches: December 21, 2025-January 20, January 25-March 20, March 25-May 20, or June 7-July 8, 2026.", "document", "Guide page 3, Application Period"),
    item("catalog", "csca", "academic_results", "required", "Applicants to the exact programs bound to this template", `Take CSCA and submit the score report for the official program-row subjects: ${subjects}.`, "official_result", "Program row CSCA test-subject columns and guide page 4 item 5"),
    item("guide", "passport", "documents", "required", "Undergraduate applicants", "Submit a passport valid for more than one year; applicants with prior China experience also submit all China-related visa and residence-permit pages.", "document", "Guide page 4, Application Materials item 1"),
    item("guide", "diploma", "documents", "required", "Undergraduate applicants", "Submit the senior-high-school diploma; graduating students may use a pre-graduation certificate.", "document", "Guide page 4, Application Materials items 2-3"),
    item("guide", "transcripts", "documents", "required", "Undergraduate applicants", "Submit complete senior-high-school transcripts; SAT, IB, GCE A-Level or ACT evidence may also be supplied as published.", "document", "Guide page 4, Application Materials item 4"),
    item("guide", "csca_report", "documents", "required", "Undergraduate applicants", "Submit the official CSCA transcript for the selected route.", "official_result", "Guide page 4, Application Materials item 5"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "Guide page 4, Application Materials items 6-7"),
    item("guide", "criminal_record", "documents", "required", "Undergraduate applicants", "Submit a certificate of no criminal record.", "document", "Guide page 4, Application Materials item 8"),
    item("guide", "physical_examination", "documents", "required", "Undergraduate applicants", "Submit a physical-examination record issued within six months before November 15, 2025.", "document", "Guide page 4, Application Materials item 9"),
    item("guide", "financial_guarantee", "documents", "required", "Undergraduate applicants", "Submit the Financial Support Guarantee Statement for International Students.", "document", "Guide page 4, Application Materials item 10"),
    item("guide", "program_supplements", "documents", "conditional", "Applicants to routes requiring extra records", "Submit route-specific additional materials; Architecture, Urban Planning and Landscape Architecture applicants must provide a portfolio.", "document", "Guide page 4, Application Materials item 11"),
    item("guide", "translations_authenticity", "documents", "required", "Undergraduate applicants", "Submit authentic Chinese or English records; records in other languages require notarized Chinese or English translations.", "school_review", "Guide page 4, Notes 2 and 4"),
    item("guide", "online_application_fee", "application_policy", "required", "Undergraduate applicants", "Complete the SEU online application, select only one funding route, upload all materials and pay the non-refundable RMB 800 application fee.", "school_review", "Guide pages 3 and 5, fees and Application Process"),
    item("guide", "tuition", "application_policy", "required", "Enrolled undergraduate students", `Pay the published annual tuition for this route: ${program.tuitionText}.`, "document", "Guide page 3, Tuition table", "enrollment"),
    item("guide", "insurance_accommodation", "other", "required", "Enrolled undergraduate students", "Budget for RMB 800 insurance and the published RMB 9,000/year double-room occupancy charge where applicable.", "document", "Guide page 3, Estimated Other Fees", "enrollment"),
    item("guide", "registration_originals", "documents", "required", "Admitted undergraduate students", "Register at the time in the admission notice with the admission and visa records, prepaid-fee receipt where applicable, and original diploma, transcript and language certificates.", "document", "Guide page 6, Registration", "preparation"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "seu-graduate-guide-zh-pdf-2026"), sourceRecord("catalog", catalogId(program)),
  ], requirements: [
    item("guide", "citizenship_health_conduct", "identity", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen in good health and good standing, complying with Chinese laws and SEU rules.", "school_review", "Graduate guide, applicant qualification section"),
    item("guide", "education", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree or provide valid expected-graduation evidence." : "Hold a master's degree or provide valid expected-graduation evidence.", "document", "Graduate guide, applicant qualification and materials sections"),
    item("guide", "application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Complete the general graduate application between November 22, 2025 and May 15, 2026; scholarship routes may close earlier.", "document", "Graduate guide, application period"),
    item("guide", "passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit a valid passport and the applicable China visa or residence-permit history.", "document", "Graduate guide, application materials"),
    item("guide", "degree_certificate", "documents", "required", `${program.degreeLevel} applicants`, "Submit the highest diploma or valid expected-graduation certificate.", "document", "Graduate guide, application materials"),
    item("guide", "transcripts", "documents", "required", `${program.degreeLevel} applicants`, "Submit complete academic transcripts for the qualifying degree.", "document", "Graduate guide, application materials"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Graduate guide, language qualification section"),
    item("guide", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two recommendation letters from appropriate academic referees.", "document", "Graduate guide, application materials"),
    item("guide", "research_plan", "documents", "required", `${program.degreeLevel} applicants`, "Submit a study or research plan of at least 800 words.", "document", "Graduate guide, application materials"),
    item("guide", "physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Foreigner Physical Examination Record in the published form and validity window.", "document", "Graduate guide, application materials"),
    item("guide", "criminal_record", "documents", "required", `${program.degreeLevel} applicants`, "Submit a certificate of no criminal conviction.", "document", "Graduate guide, application materials"),
    item("guide", "financial_guarantee", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Financial Support Guarantee Statement.", "document", "Graduate guide, application materials"),
    item("guide", "online_application_fee", "application_policy", "required", `${program.degreeLevel} applicants`, "Complete the SEU online application, upload the required records and pay the non-refundable RMB 800 application fee.", "school_review", "Graduate guide, application procedure and fee table"),
    item("guide", "tuition", "application_policy", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, `Pay the published annual tuition for this route: ${program.tuitionText}.`, "document", "Graduate guide, tuition table", "enrollment"),
    item("guide", "originals_registration", "documents", "required", `Admitted ${program.degreeLevel.toLowerCase()} students`, "Present the required original education, transcript, language and admission records at registration.", "document", "Graduate guide, registration section", "preparation"),
  ] });
}

function specialDocument(program: Program, id: "seu-yes-digital-management-2026" | "seu-yes-sustainable-infrastructure-2026"): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("special", id)], requirements: [
    item("special", "nationality_age", "identity", "required", "Youth of Excellence applicants", "Be a non-Chinese citizen under age 45.", "document", "Program guide, application qualifications"),
    item("special", "education", "education", "required", "Youth of Excellence applicants", "Hold a bachelor's degree or higher.", "document", "Program guide, application qualifications"),
    item("special", "work_experience", "other", "required", "Youth of Excellence applicants", "Have at least three years of related work experience.", "document", "Program guide, application qualifications"),
    item("special", "professional_profile", "other", "required", "Youth of Excellence applicants", "Be a senior public official, manager or university/research scholar from a Belt and Road country within the published target profile.", "school_review", "Program guide, application qualifications"),
    item("special", "language", "language", "required", "Youth of Excellence applicants", "Demonstrate the ability to undertake professional courses in English.", "official_result", "Program guide, application qualifications"),
    item("special", "application_window", "application_policy", "required", "Fall 2026 Youth of Excellence applicants", "Apply to SEU by March 15, 2026, obtain pre-admission after review, then complete the CSC Type A application using agency 1563 by March 31, 2026.", "school_review", "Program guide, application procedure"),
    item("special", "passport", "documents", "required", "Youth of Excellence applicants", "Submit a valid passport copy.", "document", "Program guide, required documents"),
    item("special", "physical_examination", "documents", "required", "Youth of Excellence applicants", "Submit the required physical-examination report.", "document", "Program guide, required documents"),
    item("special", "criminal_record", "documents", "required", "Youth of Excellence applicants", "Submit a certificate of no criminal record.", "document", "Program guide, required documents"),
    item("special", "degree_transcripts", "documents", "required", "Youth of Excellence applicants", "Submit the highest degree diploma and complete academic transcripts.", "document", "Program guide, required documents"),
    item("special", "recommendations_employment", "documents", "required", "Youth of Excellence applicants", "Submit two recommendation letters and an employment or in-service certificate.", "document", "Program guide, required documents"),
    item("special", "study_plan", "documents", "required", "Youth of Excellence applicants", "Submit the published study or research plan and English-proficiency evidence.", "document", "Program guide, required documents"),
    item("special", "study_model", "application_policy", "required", "Admitted Youth of Excellence students", "Follow the two-year 1+1 model: year one at SEU, year two thesis work in the home country, followed by return for defense.", "school_review", "Program guide, program structure", "enrollment"),
    item("special", "funding", "application_policy", "required", "Admitted Youth of Excellence students", "This is a full Chinese Government Scholarship route; the official SEU guide does not itemize components or publish a self-financed tuition alternative.", "document", "Program guide, scholarship statement", "enrollment"),
  ] });
}

const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText,
    csca: program.cscaSubjects ?? [], hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "", special: specialId(program) ?? "" });
  const rows = groups.get(identity) ?? [];
  rows.push(program);
  groups.set(identity, rows);
}
const definitions = [...groups.values()].map((rows, index) => {
  const program = rows[0];
  const special = specialId(program);
  return { key: `seu-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}${special ? `-${keyPart(special)}` : ""}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows,
    document: special ? specialDocument(program, special) : program.degreeLevel === "Undergraduate" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.length !== 20 || targets.length !== 232 || new Set(targets).size !== 232) throw new Error("SEU requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "southeast-university", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "The official English catalogs are the canonical route publication; the acquired Chinese catalogs differ by one undergraduate and two master's rows, and both source sets remain retained for editorial review.", "The two Youth of Excellence routes are separated because they have an earlier two-system deadline, work-experience conditions and full-scholarship-only funding."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope SEU 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
