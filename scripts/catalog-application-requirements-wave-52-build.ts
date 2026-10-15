import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-52.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText?: string; tuitionAmount?: number; hskRequirement?: string; englishRequirement?: string; cscaSubjects?: string[]; cscaRequirement?: string };
type Intake = { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string; deadlineLabel?: string };
type Seed = { programs: Program[]; programIntakes: Intake[]; scholarships: unknown[] };
type Template = { key: string; schoolSlug: string; cycle: string; targetProgramSlugs: string[]; targetIntake: { term: string; year: number }; targetBindingStatus: "ready"; reviewStatus: "unreviewed"; fieldAssessment: { cycle: "explicit"; targetPrograms: "explicit"; requirements: "complete" }; unresolvedNotes: string[]; document: RequirementDocument };

const expected = new Map([
  ["cau-undergraduate-admissions-2026", "859f5a2482629f56437d364ba30b7ae07996c7197c44d955ef436241b7ace812"],
  ["cau-graduate-admissions-2026", "763e3e0414a16eb32639953c03d7f177fba7f5f4d00339e589104b1233b5aea1"],
  ["cau-undergraduate-program-catalog-2026", "b6ab609458480bf3fd6f8cc12368e9d9162769fa5690df4479bdb9cc1647164d"],
  ["cau-graduate-program-catalog-2026", "956ca71ee803367da5a0b193b0ce060645957edc68731ffdd0933e8b5fd39c87"],
  ["gdufs-international-degree-admissions-fall-2026", "e56545a3662b45f750bf2a299b2f33cabc7cd49bc8741e11dcce97a8573a4b17"],
  ["shisu-international-undergraduate-admissions-2026", "e1467035e6e1569fc92d6299e2b3c999e0e8b58a6d1eb76b9e99e3e5925579b2"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const row of manifest.sources ?? []) if (row.status === 200 && expected.get(row.id) === row.sha256) evidence.set(row.id, row);
  } catch (error: unknown) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked replacement-school evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const record = (key: string, id: string) => { const value = evidence.get(id)!; return { key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 }; };
const item = (key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem => ({ key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] });
const load = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8")) as Seed;
const templates: Template[] = [];

function exactIntake(seed: Seed, program: Program): Intake {
  const intake = seed.programIntakes.find((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2026 && row.status === "closed");
  if (!intake?.deadlineLabel) throw new Error(`Missing official Fall 2026 intake window for ${program.slug}`);
  return intake;
}
function addGroupedTemplates(schoolSlug: string, prefix: string, programs: Program[], seed: Seed, makeDocument: (program: Program, intake: Intake) => RequirementDocument, notes: string[]) {
  const groups = new Map<string, { programs: Program[]; intake: Intake }>();
  for (const program of programs) {
    const intake = exactIntake(seed, program);
    const identity = JSON.stringify({ level: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText ?? program.tuitionAmount ?? "", hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "", csca: program.cscaSubjects ?? [], deadline: intake.deadlineDate ?? intake.deadlineLabel });
    const group = groups.get(identity) ?? { programs: [], intake };
    group.programs.push(program); groups.set(identity, group);
  }
  let index = 0;
  for (const group of groups.values()) {
    index += 1;
    templates.push({ key: `${prefix}-group-${String(index).padStart(2, "0")}-fall-2026`, schoolSlug, cycle: "fall-2026", targetProgramSlugs: group.programs.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: notes, document: makeDocument(group.programs[0], group.intake) });
  }
}

const cau = await load("seeds/catalog.cau-complete-batch-01.draft.json");
if (cau.programs.length !== 127 || cau.programIntakes.length !== 127) throw new Error("Unexpected CAU catalog scope.");
function cauDocument(program: Program, intake: Intake): RequirementDocument {
  const undergraduate = program.degreeLevel === "Undergraduate";
  const guideId = undergraduate ? "cau-undergraduate-admissions-2026" : "cau-graduate-admissions-2026";
  const catalogId = undergraduate ? "cau-undergraduate-program-catalog-2026" : "cau-graduate-program-catalog-2026";
  const guideKey = undergraduate ? "ug_guide" : "graduate_guide";
  const language = program.teachingLanguage === "Chinese" ? program.hskRequirement! : program.englishRequirement!;
  const requirements = undergraduate ? [
    item("eligibility", "education", "required", "Undergraduate applicants", "Be at least 18, hold or be completing a senior-high-school qualification, have a good academic record, be a non-Chinese citizen with a valid ordinary passport, and be physically and mentally healthy with good conduct.", "document", guideKey, "Application Eligibility and Requirements items 1-4"),
    item("nationality_history", "identity", "conditional", "Applicants with current or former Chinese nationality or covered parentage", "Meet the published four-year foreign-nationality and overseas-residence rule and submit the applicable naturalization, household-registration cancellation, passport-entry and overseas-study evidence.", "document", guideKey, "Application Eligibility and Requirements items 5-6"),
    item("language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, language, "official_result", guideKey, "Application Eligibility and Requirements item 7"),
    item("csca", "academic_results", "required", "Undergraduate applicants", program.cscaRequirement ?? `Submit CSCA results for ${program.cscaSubjects?.join(", ")}.`, "official_result", "catalog", "Official program workbook, Required Examination Subjects"),
    item("passport", "identity", "required", "All applicants", "Upload the passport information page; the passport must expire after December 2026.", "document", guideKey, "Application Materials item 1"),
    item("school_records", "documents", "required", "All applicants", "Submit the senior-high-school graduation certificate and transcript; pending graduates submit prospective-graduation evidence and the final certificate after admission.", "document", guideKey, "Application Materials item 2"),
    item("recommendations", "documents", "required", "All applicants", "Submit two recommendation letters from subject teachers at the applicant's senior high school.", "document", guideKey, "Application Materials item 5"),
    item("physical_exam", "documents", "required", "All applicants", "Submit the Foreigner Physical Examination Record.", "document", guideKey, "Application Materials item 6"),
    item("china_visa_history", "identity", "conditional", "Applicants with China travel or residence history", "Submit Chinese visa information and China border entry and exit records.", "document", guideKey, "Application Materials item 7"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a no-criminal-record report issued by the public-security authority.", "document", guideKey, "Application Materials item 8"),
    item("financial_guarantee", "documents", "required", "All applicants", "Submit the original financial guarantee letter and a copy of the guarantor's identification document.", "document", guideKey, "Application Materials item 9"),
    item("translations_and_originals", "documents", "required", "All applicants", "Provide originals or notarized Chinese or English copies and notarized translations when needed; present originals for verification at registration.", "document", guideKey, "Application Materials notes"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable CNY 400 application fee.", "document", guideKey, "Fees section"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", `Submit the complete online application by ${intake.deadlineLabel}.`, "school_review", guideKey, "Application Period"),
    item("assessment", "application_policy", "conditional", "Applicants selected after document review", "Participate in CAU's re-examination or interview when invited.", "school_review", guideKey, "Review and Admission"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", guideKey, "Fees section", "enrollment"),
  ] : [
    item("citizenship_health_conduct", "identity", "required", "Graduate applicants", "Be a non-Chinese citizen with a valid ordinary passport, be physically and mentally healthy, have no criminal or disciplinary record, comply with Chinese law and university rules, and respect Chinese customs.", "document", guideKey, "Application Eligibility items 1-3"),
    item("degree_and_age", "education", "required", `${program.degreeLevel} applicants`, program.degreeLevel === "Master" ? "Hold a bachelor's-equivalent qualification and be under age 35." : "Hold a master's-equivalent qualification and be under age 40.", "document", guideKey, "Application Eligibility item 4"),
    item("language", "language", "required", `${program.teachingLanguage}-taught applicants`, language, "official_result", guideKey, "Application Eligibility item 5"),
    item("passport", "identity", "required", "All applicants", "Upload the passport information page; the passport must expire after December 2026.", "document", guideKey, "Application Materials item 1"),
    item("degree_documents", "documents", "required", "All applicants", "Submit the notarized highest degree certificate or official student-status and expected-graduation evidence for pending graduates.", "document", guideKey, "Application Materials item 2"),
    item("transcripts", "documents", "required", "All applicants", "Submit complete official transcripts from undergraduate study onward, issued and sealed by the responsible university office; the guide states GPA above 3.0.", "document", guideKey, "Application Materials item 3"),
    item("recommendations", "documents", "required", "All applicants", "Submit two signed recommendation letters from associate professors or scholars with higher academic titles.", "document", guideKey, "Application Materials item 4"),
    item("cv", "documents", "required", "All applicants", "Submit study and work experience updated to the application date.", "document", guideKey, "Application Materials item 5"),
    item("study_plan", "documents", "required", "All applicants", "Submit a Chinese- or English-language study or research plan of at least 1,000 words.", "document", guideKey, "Application Materials item 6"),
    item("physical_exam", "documents", "required", "All applicants", "Submit the Foreigner Physical Examination Record.", "document", guideKey, "Application Materials item 8"),
    item("visa", "identity", "conditional", "Applicants currently in China", "Submit current China visa information.", "document", guideKey, "Application Materials item 9"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a no-criminal-record report issued by the public-security authority.", "document", guideKey, "Application Materials item 10"),
    item("academic_achievements", "documents", "recommended", "Applicants with research achievements", "Submit published papers, patents or other academic achievements.", "document", guideKey, "Application Materials item 11"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable CNY 400 application fee in the CAU system.", "document", guideKey, "Application Procedure item 1"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", `Submit the complete application by ${intake.deadlineLabel}.`, "school_review", guideKey, "Application Time"),
    item("assessment", "application_policy", "conditional", "Applicants selected after review", "Participate in any college or department examination or interview when invited.", "school_review", guideKey, "Review and Examination"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", guideKey, "Cost section", "enrollment"),
  ];
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record(guideKey, guideId), record("catalog", catalogId)], requirements });
}
addGroupedTemplates("china-agricultural-university", "cau", cau.programs, cau, cauDocument, ["All 127 official Fall 2026 degree routes are included with exact intake, language, tuition and route-specific CSCA data where applicable.", "This historical cycle is closed and remains unreviewed and non-public.", "Scholarship records remain independent; no route-level entitlement is inferred."]);

const gdufs = await load("seeds/catalog.gdufs-complete-batch-01.draft.json");
const gdufsPrograms = gdufs.programs.filter((program) => program.degreeLevel === "Undergraduate" && program.teachingLanguage === "English" && program.tuitionAmount === 33800);
if (gdufs.programs.length !== 5 || gdufsPrograms.length !== 3) throw new Error("Unexpected GDUFS exact-tuition scope.");
function gdufsDocument(program: Program, intake: Intake): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", "gdufs-international-degree-admissions-fall-2026")], requirements: [
    item("eligibility", "identity", "required", "Undergraduate applicants", "Be a non-Chinese citizen holding a foreign passport, meet the applicable nationality rules, be physically and mentally healthy, be friendly to China, obey laws and university rules, have good academic standing and conduct, and normally be no older than 30.", "document", "guide", "Application Conditions items 1-6"),
    item("school_records", "documents", "required", "Undergraduate applicants", "Submit scanned high-school graduation and transcript documents, with notarized Chinese or English versions when the originals are in another language.", "document", "guide", "Undergraduate online application materials item 1"),
    item("csca", "academic_results", "required", "Undergraduate applicants", program.cscaRequirement!, "official_result", "guide", "Undergraduate CSCA requirement"),
    item("english", "language", "required", "English-taught undergraduate applicants", program.englishRequirement!, "official_result", "guide", "English-taught undergraduate requirements item 4"),
    item("assessment", "application_policy", "required", "English-taught undergraduate applicants", "Complete the required entrance assessment, normally a written test and interview or an interview under the published language-exemption rule.", "school_review", "guide", "English-taught undergraduate requirements item 4"),
    item("passport_visa_photo", "identity", "required", "All applicants", "Submit the passport information page, current China visa page when applicable, and a one-inch color identification photograph.", "document", "guide", "Undergraduate online application materials item 5"),
    item("physical_exam", "documents", "required", "All applicants", "Submit a physical examination report that remains valid.", "document", "guide", "Undergraduate online application materials item 6"),
    item("supplementary_materials", "documents", "conditional", "Applicants notified by GDUFS", "Submit additional documents requested by the university, which may include recommendation letters or a no-criminal-record certificate.", "document", "guide", "Undergraduate online application materials item 7"),
    item("online_application", "application_policy", "required", "All applicants", "Register and submit the online application, then confirm the application with the admissions office by telephone or email.", "school_review", "guide", "Application Method"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", `Submit by ${intake.deadlineLabel}.`, "school_review", "guide", "Application period"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "guide", "Official Fall 2026 degree tuition table", "enrollment"),
  ] });
}
addGroupedTemplates("guangdong-university-of-foreign-studies", "gdufs-english-undergraduate", gdufsPrograms, gdufs, gdufsDocument, ["Scope contains the three English-taught undergraduate routes with exact published tuition.", "Two Chinese-taught routes are excluded because the current normalized seed lacks exact route tuition.", "This historical cycle is closed and remains unreviewed and non-public."]);

const shisu = await load("seeds/catalog.shisu-complete-batch-01.draft.json");
const shisuPrograms = shisu.programs.filter((program) => program.degreeLevel === "Undergraduate" && program.tuitionAmount === 24800);
if (shisu.programs.length !== 11 || shisuPrograms.length !== 9) throw new Error("Unexpected SHISU undergraduate scope.");
function shisuDocument(program: Program, intake: Intake): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", "shisu-international-undergraduate-admissions-2026")], requirements: [
    item("education_age_health_finance", "education", "required", "Undergraduate applicants", "Hold at least a high-school qualification, be age 18 to 35, be healthy, and have reliable financial support and a guardian where applicable.", "document", "guide", "Application Qualifications items 1-2"),
    item("nationality_history", "identity", "conditional", "Applicants covered by Chinese-parentage or former-Chinese-citizenship rules", "Meet the published four-year foreign-passport or nationality-document rule and two-year overseas-residence rule.", "document", "guide", "Application Qualifications item 3"),
    item("guardian", "identity", "conditional", "Applicants under 18 on September 1, 2026", "Submit the guardian guarantee form; the guardian must be an adult living in mainland China with a source of income.", "document", "guide", "Application Qualifications item 1"),
    item("conduct", "identity", "required", "Applicants with prior study or residence in China", "Have no record of legal or disciplinary violations during prior study or residence in China.", "school_review", "guide", "Application Qualifications item 5"),
    item("language", "language", "required", "Chinese-taught undergraduate applicants", program.hskRequirement!, "official_result", "guide", "Admission Requirements and Entrance Examination"),
    item("csca", "academic_results", "required", "Undergraduate applicants", program.cscaRequirement!, "official_result", "guide", "CSCA and entrance-examination section"),
    item("school_records", "documents", "required", "All applicants", "Submit the graduation certificate and transcript as originals or notarized Chinese or English copies; pending graduates may submit expected-graduation evidence.", "document", "guide", "Application Materials item 1"),
    item("language_and_csca_records", "documents", "required", "All applicants", "Submit the applicable HSK or Chinese-proficiency certificate and the CSCA score report.", "official_result", "guide", "Application Materials items 2-3"),
    item("passport", "identity", "required", "All applicants", "Submit the passport copy; applicants graduating from a high school in China must also provide their parents' passport copies.", "document", "guide", "Application Materials items 4-5"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a no-criminal-record certificate.", "document", "guide", "Application Materials item 6"),
    item("application_fee", "application_policy", "required", "All applicants", program.hskRequirement!.startsWith("HSK Level 4") ? "Pay the non-refundable CNY 500 application fee or USD 75 overseas-remittance equivalent and upload the payment receipt." : "Pay the non-refundable CNY 750 application fee or USD 125 overseas-remittance equivalent and upload the payment receipt.", "document", "guide", "Application Materials, fee item"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", `Submit the application by ${intake.deadlineLabel}.`, "school_review", "guide", "Registration and Duration"),
    item("assessment", "application_policy", "required", "Applicants", "Complete the applicable entrance examination or interview published for the route and campus.", "school_review", "guide", "Admission Requirements and Entrance Examination"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "guide", "Fee Standard", "enrollment"),
  ] });
}
addGroupedTemplates("shanghai-international-studies-university", "shisu-undergraduate", shisuPrograms, shisu, shisuDocument, ["Scope contains the nine normalized Fall 2026 undergraduate routes with exact tuition and intake binding.", "Two English-taught master's routes remain outside this wave and are not claimed here.", "This historical cycle is closed and remains unreviewed and non-public."]);

const schoolCounts = new Map<string, number>();
for (const template of templates) schoolCounts.set(template.schoolSlug, (schoolCounts.get(template.schoolSlug) ?? 0) + template.targetProgramSlugs.length);
if (schoolCounts.get("china-agricultural-university") !== 127 || schoolCounts.get("guangdong-university-of-foreign-studies") !== 3 || schoolCounts.get("shanghai-international-studies-university") !== 9) throw new Error("Replacement-school target counts changed.");
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Replace partial-school release-candidate coverage with three complete official-source school scopes." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, schoolCount: schoolCounts.size, targetedProgramCount: [...schoolCounts.values()].reduce((sum, count) => sum + count, 0), targetedIntakeCount: [...schoolCounts.values()].reduce((sum, count) => sum + count, 0), excludedProgramCount: 4, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
