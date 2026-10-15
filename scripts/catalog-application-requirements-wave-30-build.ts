import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-30.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/ustb-complete-batch-01/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Bachelor" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionAmount: number; hskRequirement?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "ustb-undergraduate-application-2026": "796f4543a77ac3d44cffed48377f3c1f1563ca21c6a7b1ecc033e9f9d5c023c6",
  "ustb-graduate-application-2026": "cecddae874357b7019e40da7dc7485130ecd669a7b1de1f3b877d3092b32b27f",
  "ustb-international-economics-1-plus-3-2026": "c6cad88d20bdea12f70b6a46f7d7ae7dec5e5b104176ea328905b8c7c8a66fba",
  "ustb-undergraduate-admission-guide-2026": "ec8df19853930920d7c1f670350bf96da1df61216696be63e5e103f554651d54",
  "ustb-csca-guide-2026": "da2c2f752b96e7db423ae3cff2994f872d7e9db886e7c1c0c4646f7ead246cae",
} as const;
const sources = new Map<string, Source>();
for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.contentType === "text/html"
    && row.sha256 === expected[row.id as keyof typeof expected]) sources.set(row.id, row);
}
if (sources.size !== Object.keys(expected).length) throw new Error("USTB requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.ustb-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 156 || seed.programIntakes.length !== 156) throw new Error("Unexpected USTB complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing USTB Fall 2026 intake: ${program.slug}`);

type SourceKey = "application" | "csca" | "special";
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const sourceRecord = (key: SourceKey, id: keyof typeof expected) => {
  const source = sources.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};
const humanities = new Set(["English", "Japanese", "German", "Public Administration", "Social Work", "Law", "Accounting",
  "International Economics and Trade", "Financial Engineering", "Big Data Management and Application", "Information Management and Information Systems", "Visual Communication Design"]);

function undergraduateDocument(kind: "humanities" | "stem" | "special" | "english") {
  const special = kind === "special";
  const english = kind === "english";
  const sources = [sourceRecord("application", "ustb-undergraduate-admission-guide-2026"), sourceRecord("csca", "ustb-csca-guide-2026"),
    ...(special ? [sourceRecord("special", "ustb-international-economics-1-plus-3-2026")] : [])];
  const cscaRule = english
    ? "Submit CSCA Mathematics in English and either Physics or Chemistry. No Professional Chinese score is required for an English-taught route."
    : kind === "humanities" || special
    ? "Submit CSCA Humanities Chinese and Mathematics score reports; Physics or Chemistry is not required for the published humanities-list majors."
    : "Submit CSCA STEM Chinese, Mathematics, and either Physics or Chemistry score reports. Environment Engineering and Materials Science and Engineering take Mathematics in English; other Chinese-taught majors take Mathematics in Chinese.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources, requirements: [
    item("application", "citizenship_health_conduct", "identity", "required", "International bachelor applicants", "Be a non-Chinese citizen holding a valid foreign passport, be physically and mentally healthy, and have good conduct.", "document", "Section IV - Eligibility"),
    item("application", "education", "education", "required", "International bachelor applicants", "Hold a senior-high-school diploma recognized by the Chinese Ministry of Education; provide qualification verification if requested.", "document", "Section IV - Eligibility"),
    item("application", "age", "identity", "required", "Self-financed international bachelor applicants", "Be no older than 35 at the application deadline; scholarship routes may impose different age limits.", "document", "Section IV - Eligibility"),
    item("application", "language", "language", "required", special ? "International Economics and Trade (1+3) applicants" : english ? "English-taught bachelor applicants" : "Chinese-taught bachelor applicants", special ? "A separate HSK 4 certificate is not required at entry; the route requires sufficient Chinese for the first-year language/foundation stage and HSK 5 by graduation." : english ? "Submit IELTS 5.5, TOEFL 70, or another official English-proficiency certificate when English is not an official language." : "Submit HSK Level 4 or above.", "official_result", special ? "1+3 project Eligibility and program description" : "Section V(4) Application Materials item 5"),
    item("application", "application_window", "application_policy", "required", "Fall 2026 bachelor applicants", "Apply from November 1, 2025 through June 15, 2026; the system closes after the deadline.", "document", "Section V(1) Application Period"),
    item("application", "online_application", "application_policy", "required", "Fall 2026 bachelor applicants", "Register in the USTB international online application system, complete personal information, upload clear PDF/JPG materials, pay the fee and submit; no paper package is required.", "school_review", "Section V(3) Application Method"),
    item("application", "application_form", "documents", "required", "Fall 2026 bachelor applicants", "Complete truthful and complete personal information in the online application; submitted information cannot be modified.", "self_report", "Section V(4) item 1"),
    item("application", "diploma_transcript", "documents", "required", "Fall 2026 bachelor applicants", "Submit the high-school diploma and complete official high-school transcript. Non-Chinese/English records require official translations and notarization.", "document", "Section V(4) items 2-3"),
    item("application", "passport", "documents", "required", "Fall 2026 bachelor applicants", "Submit the information page of a valid ordinary passport whose validity covers at least one year after expected enrollment.", "document", "Section V(4) item 4"),
    item("application", "language_evidence", "documents", "required", "Fall 2026 bachelor applicants", special ? "Submit the Chinese-proficiency evidence requested for the 1+3 route; no HSK 4 certificate is required at entry." : english ? "Submit IELTS 5.5, TOEFL 70, or another official English-proficiency certificate when English is not an official language." : "Submit an HSK Level 4 or higher score certificate.", "official_result", special ? "1+3 project Application Materials item 5" : "Section V(4) item 5"),
    item("application", "physical_examination", "documents", "required", "Fall 2026 bachelor applicants", "Submit the designated Foreigner Physical Examination Form issued by a regular medical institution and valid within six months.", "document", "Section V(4) item 6"),
    item("application", "financial_guarantee", "documents", "required", "Fall 2026 bachelor applicants", "Submit the USTB financial-guarantee form with guarantor identity and financial evidence sufficient for one academic year; the guide recommends at least RMB 50,000.", "document", "Section V(4) item 7"),
    item("application", "criminal_record", "documents", "required", "Fall 2026 bachelor applicants", "Submit an official no-criminal-record certificate in Chinese or English, or with official translation and notarization, valid within six months.", "document", "Section V(4) item 8"),
    item("csca", "csca", "academic_results", "required", english ? "English-taught bachelor applicants" : kind === "stem" ? "Chinese-taught science, engineering and agriculture bachelor applicants" : "Published humanities-list bachelor applicants", cscaRule, "official_result", "Section II USTB CSCA Requirements and Section VIII process"),
    item("application", "selection", "academic_results", "required", "Applicants after submission", "Undergo USTB's comprehensive review of application materials, CSCA scores, academic background and language ability; admission is competitive.", "school_review", "Section VII - Admission and Enrollment"),
    item("application", "application_fee", "application_policy", "required", "Fall 2026 bachelor applicants", "Pay the non-refundable RMB 600 application fee.", "document", "Section V(2)-(3) Fees and Application Method"),
    item("application", "tuition", "application_policy", "required", "Enrolled bachelor students", "Pay annual tuition of RMB 23,300.", "document", "Section V(2) Fee Standards", "enrollment"),
    item("application", "insurance", "documents", "required", "Enrolled bachelor students", "Purchase the required China medical insurance: RMB 800 per year or RMB 400 per semester; registration is not processed without it.", "document", "Section V(2) Fee Standards and note 2", "enrollment"),
    item("application", "accommodation", "other", "conditional", "Students allocated on-campus accommodation", "Pay RMB 1,500 per month per bed for a double room or RMB 750 per month per bed for a four-person room; students not allocated a room arrange off-campus housing themselves.", "document", "Section V(2) Fee Standards and note 1", "enrollment"),
    item("application", "registration_original", "documents", "required", "Admitted applicants", "Register at the time in the admission notice and official email and present the original high-school diploma for enrollment qualification review.", "document", "Section VII - Enrollment", "enrollment"),
    item("application", "visa_residence", "documents", "required", "Admitted applicants", "Use the Admission Notice and JW201/JW202 to apply for an X1 visa and convert it to a study residence permit within 30 days after arrival.", "document", "Section VII and visa guidance", "preparation"),
  ] });
}

function graduateDocument(degree: "Master" | "Doctoral", language: "Chinese" | "English") {
  const isMaster = degree === "Master";
  const tuition = isMaster ? (language === "Chinese" ? 31600 : 37600) : (language === "Chinese" ? 41600 : 47600);
  const languageRule = language === "Chinese" ? `Pass HSK Level ${isMaster ? "5" : "6"}.`
    : "Submit IELTS 6.0, TOEFL 80, or another official English-proficiency certificate when English is not an official language.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("application", "ustb-graduate-application-2026")], requirements: [
    item("application", "citizenship_health_conduct", "identity", "required", `${degree} applicants`, "Be a non-Chinese citizen holding a valid foreign passport, be physically and mentally healthy, and have good conduct.", "document", "Section I - Eligibility item 1"),
    item("application", "education", "education", "required", `${degree} applicants`, isMaster ? "Hold a qualification equivalent to a Chinese bachelor's degree." : "Hold a qualification equivalent to a Chinese master's degree.", "document", `Section I - Eligibility item ${isMaster ? "2" : "3"}`),
    item("application", "age", "identity", "required", `${degree} applicants`, `Be generally no older than ${isMaster ? "40" : "45"}; scholarship routes may impose different age limits.`, "document", `Section I - Eligibility item ${isMaster ? "2" : "3"}`),
    item("application", "language", "language", "required", `${language}-taught ${degree.toLowerCase()} applicants`, languageRule, "official_result", "Section I Eligibility and Section V Application Materials item 6"),
    item("application", "application_window", "application_policy", "required", `Fall 2026 ${degree.toLowerCase()} applicants`, "Apply from November 1, 2025 through June 15, 2026; scholarship deadlines follow the individual scholarship notice.", "document", "Section II - Application Time"),
    item("application", "online_application", "application_policy", "required", `Fall 2026 ${degree.toLowerCase()} applicants`, "Complete the online USTB application and pay the application fee; paper materials are not required.", "school_review", "Opening note and Section IV - Application Method"),
    item("application", "application_form", "documents", "required", `${degree} applicants`, "Complete the application form in the USTB system and pay the application fee.", "self_report", "Section V item 1"),
    item("application", "degree_transcripts", "documents", "required", `${degree} applicants`, isMaster ? "Submit the bachelor's degree certificate and complete undergraduate transcript as notarized Chinese or English originals; expected graduates may use pre-graduation or enrollment proof but must supply the degree after admission." : "Submit bachelor's and master's degree certificates and complete undergraduate and master's transcripts as notarized Chinese or English originals; expected graduates may use pre-graduation or enrollment proof but must supply the degree after admission.", "document", "Section V items 2-3"),
    item("application", "statement_plan", "documents", "required", `${degree} applicants`, `Submit a Chinese- or English-language personal statement and research plan of at least ${isMaster ? "1,000" : "1,500"} Chinese characters/words.`, "document", "Section V item 4"),
    item("application", "recommendations", "documents", "required", `${degree} applicants`, "Submit two recommendation letters from professors or associate professors; at least one recommender must know the applicant's current field of study.", "document", "Section V item 5"),
    item("application", "language_evidence", "documents", "required", `${language}-taught ${degree.toLowerCase()} applicants`, languageRule, "official_result", "Section V item 6"),
    item("application", "passport", "documents", "required", `${degree} applicants`, "Submit a copy of a valid ordinary passport.", "document", "Section V item 7"),
    item("application", "physical_examination", "documents", "required", `${degree} applicants`, "Submit the designated health/physical-examination certificate.", "document", "Section V item 8"),
    item("application", "financial_guarantee", "documents", "required", `${degree} applicants`, "Submit the USTB financial-guarantee form.", "document", "Section V item 9"),
    item("application", "criminal_record", "documents", "required", `${degree} applicants`, "Submit a no-criminal-record certificate.", "document", "Section V item 10"),
    item("application", "supervisor_letter", "documents", "recommended", `${degree} applicants`, "A supervisor acceptance letter may be submitted when available.", "document", "Section V item 11"),
    item("application", "publications", "documents", "recommended", `${degree} applicants with academic outputs`, "Optionally submit a list and abstracts of published articles and other original work.", "document", "Section V item 12"),
    item("application", "application_fee", "application_policy", "required", `${degree} applicants`, "Pay the non-refundable RMB 600 application fee.", "document", "Sections III-IV"),
    item("application", "tuition", "application_policy", "required", `Enrolled ${language}-taught ${degree.toLowerCase()} students`, `Pay annual tuition of RMB ${tuition.toLocaleString("en-US")}.`, "document", "Section III fee table", "enrollment"),
    item("application", "insurance", "documents", "required", "Enrolled graduate students", "Purchase required China medical insurance at RMB 800 per year or RMB 400 per semester; registration is not processed without it.", "document", "Section III fee table and note 2", "enrollment"),
    item("application", "accommodation", "other", "conditional", "Students allocated on-campus accommodation", "Pay RMB 1,500 per month per bed for a double room or RMB 750 per month per bed for a four-person room; students not allocated a room arrange off-campus housing themselves.", "document", "Section III fee table and note 1", "enrollment"),
    item("application", "registration_originals", "documents", "required", "Admitted applicants", "Register at the time in the admission notice and official email and present original degree/graduation certificates for enrollment qualification review.", "document", "Sections VI-VII", "enrollment"),
    item("application", "visa_residence", "documents", "required", "Admitted applicants", "Use the Admission Notice and JW201/JW202 to apply for an X1 visa and convert it to a study residence permit within 30 days after arrival.", "document", "Section X - Visa", "preparation"),
  ] });
}

const bachelor = seed.programs.filter((program) => program.degreeLevel === "Bachelor");
const specialRows = bachelor.filter((program) => program.nameEn === "International Economics and Trade (1+3)");
const humanitiesRows = bachelor.filter((program) => program.teachingLanguage === "Chinese" && !specialRows.includes(program) && humanities.has(program.nameEn));
const englishBachelorRows = bachelor.filter((program) => program.teachingLanguage === "English");
const stemRows = bachelor.filter((program) => program.teachingLanguage === "Chinese" && !specialRows.includes(program) && !humanitiesRows.includes(program));
const group = (degree: Program["degreeLevel"], language: Program["teachingLanguage"]) => seed.programs.filter((program) => program.degreeLevel === degree && program.teachingLanguage === language);
const definitions = [
  { key: "ustb-bachelor-chinese-humanities-fall-2026", rows: humanitiesRows, document: undergraduateDocument("humanities") },
  { key: "ustb-bachelor-stem-fall-2026", rows: stemRows, document: undergraduateDocument("stem") },
  { key: "ustb-bachelor-english-fall-2026", rows: englishBachelorRows, document: undergraduateDocument("english") },
  { key: "ustb-bachelor-international-economics-1-plus-3-fall-2026", rows: specialRows, document: undergraduateDocument("special") },
  { key: "ustb-master-chinese-fall-2026", rows: group("Master", "Chinese"), document: graduateDocument("Master", "Chinese") },
  { key: "ustb-master-english-fall-2026", rows: group("Master", "English"), document: graduateDocument("Master", "English") },
  { key: "ustb-doctoral-chinese-fall-2026", rows: group("Doctoral", "Chinese"), document: graduateDocument("Doctoral", "Chinese") },
  { key: "ustb-doctoral-english-fall-2026", rows: group("Doctoral", "English"), document: graduateDocument("Doctoral", "English") },
];
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.some((definition) => definition.rows.length === 0) || targets.length !== 156 || new Set(targets).size !== 156) throw new Error("USTB requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "university-of-science-and-technology-beijing", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope USTB 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
