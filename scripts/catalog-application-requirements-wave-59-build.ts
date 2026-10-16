import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-59.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string };
type Seed = { programs: Program[]; programIntakes: Array<{ programSlug: string; intakeTerm: string; intakeYear: number; status?: string }> };
const manifestPaths = [
  "work/catalog-official/ecjtu-complete-20261016/manifest.json",
  "work/catalog-official/wut-complete-20261016/manifest.json",
  "work/catalog-official/tjut-complete-20261016/manifest.json",
];
const expected = new Map([
  ["ecjtu-international-english-program-admissions-2026", "49c8d0b3b44971931760a4a84140e49aa3363e3824c5a163355fbd930cf21cd1"],
  ["wut-international-undergraduate-admissions-2026", "d1b74100cd3a0231d5c50353c4e2208dbf90bde4216276fae9e9e759df338f47"],
  ["tjut-international-student-admission-brochure-2026-2027", "5f1c66cdd222755a3243519ee8c777a8329213131cf4a2ddde3f9ce80b84f894"],
]);
const sources = new Map<string, Source>();
for (const path of manifestPaths) {
  const manifest = JSON.parse(await readFile(resolve(root, path), "utf8")) as { sources: Source[] };
  for (const source of manifest.sources) if (source.status === 200 && expected.get(source.id) === source.sha256) sources.set(source.id, source);
}
for (const id of expected.keys()) if (!sources.has(id)) throw new Error(`Missing locked requirement evidence: ${id}`);
const [ecjtu, wut, tjut] = await Promise.all([
  readFile(resolve(root, "seeds/catalog.ecjtu-complete-batch-01.draft.json"), "utf8").then((text) => JSON.parse(text) as Seed),
  readFile(resolve(root, "seeds/catalog.wut-complete-batch-01.draft.json"), "utf8").then((text) => JSON.parse(text) as Seed),
  readFile(resolve(root, "seeds/catalog.tjut-complete-batch-01.draft.json"), "utf8").then((text) => JSON.parse(text) as Seed),
]);
const record = (key: string, id: string) => { const source = sources.get(id)!; return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }; };
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const grouped = (rows: Program[]) => { const map = new Map<string, Program[]>(); for (const row of rows) map.set(row.degreeLevel, [...(map.get(row.degreeLevel) ?? []), row]); return map; };
const verifyIntakes = (seed: Seed) => { for (const program of seed.programs) if (!seed.programIntakes.some((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2026 && row.status === "closed")) throw new Error(`Missing closed Fall 2026 intake: ${program.slug}`); };
verifyIntakes(ecjtu);
verifyIntakes(wut);
verifyIntakes(tjut);

function ecjtuDocument(degree: string): RequirementDocument {
  const graduate = degree !== "Undergraduate";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", "ecjtu-international-english-program-admissions-2026")], requirements: [
    item("nationality_and_residency", "identity", "required", "All applicants", "Hold a valid foreign passport or nationality certificate for at least four years and document more than two years of actual residence abroad during the preceding four years up to April 30 of the admission year.", "document", "guide", "Entrance Condition item 1"),
    ...(degree === "Undergraduate" ? [item("age", "other", "required", "Undergraduate applicants", "Be under age 25; applicants under 18 must submit the published legal-guardian documents for China.", "document", "guide", "Entrance Condition item 2")] : []),
    item("english_proficiency", "language", "required", "All applicants", "Provide TOEFL 80, IELTS 5.5, proof of prior education delivered entirely in English, or evidence that English is an official language.", "official_result", "guide", "Language Proficiency Requirement"),
    item("financial_capacity", "documents", "required", "All applicants", "Submit a bank-issued asset certificate for at least CNY 30,000 or equivalent foreign currency.", "document", "guide", "Economic Capacity Requirement and Documents item 3"),
    item("passport", "identity", "required", "All applicants", "Submit scans of the passport information page and the visa or residence-permit page when applicable.", "document", "guide", "Documents item 1"),
    item("degree_and_transcript", "education", "required", "All applicants", "Submit the highest diploma certificate and academic transcript.", "document", "guide", "Documents item 2"),
    item("physical_examination", "documents", "required", "All applicants", "Submit a valid medical examination report.", "document", "guide", "Documents item 4"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a non-criminal-record certificate.", "document", "guide", "Documents item 5"),
    item("application_form_and_photo", "documents", "required", "All applicants", "Submit the ECJTU application form and an electronic two-inch identification photo.", "document", "guide", "Documents items 7-8"),
    ...(graduate ? [item("cv_and_study_plan", "documents", "required", `${degree} applicants`, "Submit a CV covering academic background and research output plus a study plan of at least 600 words.", "document", "guide", "Documents item 9")] : []),
    item("online_application", "application_policy", "required", "All applicants", "Register in the official international-student application portal and submit the application materials online.", "school_review", "guide", "Application procedure"),
    item("online_interview", "other", "required", "All applicants", "Attend the required online interview; schedule and format are announced in the application system.", "school_review", "guide", "Application procedure reminder"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", "The reviewed brochure states June 2026; the cycle is closed and no exact day is inferred.", "school_review", "guide", "English-taught majors table"),
  ] });
}

function wutDocument(): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", "wut-international-undergraduate-admissions-2026")], requirements: [
    item("citizenship_health", "other", "required", "All applicants", "Be a non-Chinese citizen with a valid foreign passport, be at least 18, in good health and conduct, and comply with Chinese law and university rules; applicants under 18 by August 31 must provide the required power of attorney.", "document", "guide", "Eligibility Requirements"),
    item("prior_education", "education", "required", "Undergraduate applicants", "Hold a high-school diploma or higher; current final-year students may submit an expected-graduation certificate and must obtain the diploma before enrollment.", "document", "guide", "Eligibility Requirements item 2"),
    item("passport_and_status", "identity", "required", "All applicants", "Submit the passport information page and, when currently studying or working in China, the valid visa or residence permit.", "document", "guide", "Application materials items 1-2"),
    item("degree_and_transcripts", "education", "required", "All applicants", "Submit the highest academic certificate and complete high-school transcript; applicants with university study also submit completed university transcripts.", "document", "guide", "Application materials items 3-4"),
    item("photo", "documents", "required", "All applicants", "Submit a recent electronic passport-style photo.", "document", "guide", "Application materials item 5"),
    item("language_certificate", "language", "required", "All applicants", "Submit a relevant language certificate such as TOEFL, IELTS or HSK; the reviewed guide does not publish a minimum score.", "official_result", "guide", "Application materials item 6"),
    item("physical_examination", "documents", "required", "All applicants", "Submit a physical-examination report issued by a recognized hospital.", "document", "guide", "Application materials item 7"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a non-criminal-record certificate issued by a public-security authority or the applicant's school.", "document", "guide", "Application materials item 8"),
    item("financial_support", "documents", "required", "All applicants", "Submit a bank deposit certificate under the applicant's or parents' name showing at least USD 4,000.", "document", "guide", "Application materials item 9"),
    item("guardian", "documents", "conditional", "Applicants under age 18", "Submit the guardian guarantee letter.", "document", "guide", "Application materials item 10"),
    item("video", "documents", "required", "All applicants", "Submit a one-to-three-minute English video containing a self-introduction and study plan.", "document", "guide", "Application materials item 11"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the CNY 500 application fee; the reviewed guide states its refund and tuition-offset conditions.", "document", "guide", "Fee Structure"),
    item("tuition_prepayment", "application_policy", "required", "Admitted applicants", "Pay the CNY 3,500 tuition prepayment before the JW202 form is released.", "document", "guide", "Admission Procedures item 3", "enrollment"),
    item("deadline", "application_policy", "conditional", "Fall 2026 applicants", "The reviewed 2026 guide does not state an application deadline; confirm it in the official application system.", "school_review", "guide", "No deadline published in reviewed guide"),
  ] });
}

function tjutDocument(degree: string): RequirementDocument {
  const undergraduate = degree === "Undergraduate";
  const priorEducation = undergraduate ? "Hold a high-school diploma and be under age 25; a current final-year student may submit a pre-graduation certificate but must provide the diploma before enrollment." : degree === "Master" ? "Hold a bachelor's degree and be under age 35." : "Hold a master's degree and be under age 40.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", "tjut-international-student-admission-brochure-2026-2027")], requirements: [
    item("citizenship_and_conduct", "other", "required", "All applicants", "Be a non-Chinese citizen who complies with the published nationality rules, has good conduct and health, and will follow Chinese law and university rules.", "document", "guide", "Application Eligibility items 1 and 4"),
    item("prior_education_and_age", "education", "required", `${degree} applicants`, priorEducation, "document", "guide", "Application Eligibility item 2"),
    item("chinese_proficiency", "language", "required", "All reviewed degree applicants", "Submit a valid HSK Level 4 score report with at least 180.", "official_result", "guide", "Application Eligibility item 3"),
    ...(undergraduate ? [item("csca", "academic_results", "required", "Undergraduate applicants", "Take and submit results for the exact CSCA subjects published for the selected program.", "official_result", "guide", "Majors table and How to Apply item 2")] : []),
    item("online_application", "application_policy", "required", "All applicants", "Complete the official online application and upload the requested materials within the application period.", "school_review", "guide", "How to Apply item 1"),
    item("application_period", "application_policy", "required", "Fall 2026 applicants", "Apply from November 20, 2025 through May 31, 2026; the reviewed cycle is closed.", "school_review", "guide", "How to Apply item 3"),
    item("application_fee", "application_policy", "conditional", "Admitted non-scholarship recipients", "Pay the non-refundable CNY 400 application fee within the university-specified time after admission.", "document", "guide", "How to Apply item 4"),
    item("interview", "other", "required", "All applicants", "Participate in the university's comprehensive review of application materials and interview.", "school_review", "guide", "Admission and Enrollment item 1"),
    item("original_documents", "documents", "required", "Admitted applicants", "Bring the original highest academic credential, physical-examination record, blood-test report, HSK certificate and other original application materials for enrollment verification.", "document", "guide", "Admission and Enrollment item 5", "enrollment"),
  ] });
}

const templates: unknown[] = [];
for (const [degree, programs] of grouped(ecjtu.programs)) templates.push({ key: `ecjtu-${degree.toLowerCase()}-fall-2026`, schoolSlug: "east-china-jiaotong-university", cycle: "fall-2026", targetProgramSlugs: programs.map((row) => row.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Fall 2026 is closed.", "No application fee or CSCA rule is published in the reviewed page.", "Personal contact and payment details are intentionally excluded."], document: ecjtuDocument(degree) });
templates.push({ key: "wut-undergraduate-fall-2026", schoolSlug: "wuchang-university-of-technology", cycle: "fall-2026", targetProgramSlugs: wut.programs.map((row) => row.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Fall 2026 is closed.", "The source does not publish a minimum language score, deadline or CSCA rule.", "Personal contact, bank-remittance and applicant data are intentionally excluded."], document: wutDocument() });
for (const [degree, programs] of grouped(tjut.programs)) templates.push({ key: `tjut-${degree.toLowerCase()}-fall-2026`, schoolSlug: "tianjin-university-of-technology", cycle: "fall-2026", targetProgramSlugs: programs.map((row) => row.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Fall 2026 is closed.", "The reviewed brochure does not enumerate the ordinary online-application upload checklist, so no undocumented list is invented.", "Scholarship-specific deadlines and exact partial-award amounts are not stated."], document: tjutDocument(degree) });
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Official-source application requirements for the captured closed Fall 2026 ECJTU, WUT and TJUT routes." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: ecjtu.programs.length + wut.programs.length + tjut.programs.length, targetedIntakeCount: ecjtu.programIntakes.length + wut.programIntakes.length + tjut.programIntakes.length, requirementItemCount: templates.reduce((sum, template) => sum + (template as { document: RequirementDocument }).document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
