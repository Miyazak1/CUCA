import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-34.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/nwpu-complete-batch-01/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: string; tuitionText: string; cscaSubjects?: string[]; hskRequirement?: string; englishRequirement?: string; fieldCategory?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const expected = {
  "nwpu-undergraduate-guide-2026": "e11beb2ffc193fbc45160e8fe311ba66fefa67baa6ef9d4fac49e2b0d6424ac5",
  "nwpu-master-guide-2026": "496b8afe1e1890312a89d58ad9c2483e325955c10ab2b25fcfdd0e9109e09f73",
  "nwpu-master-majors-2026": "a66a9d71def2dd0aed3e43756944581848acaeb3c080b6ac88b0f86f41d9e6ea",
  "nwpu-phd-guide-2026": "7151c3cb7ef9ee782011fe0bbf1db3e1f6b35c982de8d53d245bd34620a340a1",
  "nwpu-phd-majors-2026": "2369bd4044d38cbe992aa4ff8ebf0da95ec237ac7230c76ce0c56ff7157454d1",
} as const;
const evidence = new Map<string, Source>();
for (const row of manifest.sources as Source[]) if (row.id in expected && row.status === 200 && row.contentType === "text/html"
  && row.sha256 === expected[row.id as keyof typeof expected]) evidence.set(row.id, row);
if (evidence.size !== Object.keys(expected).length) throw new Error("NWPU requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.nwpu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 96 || seed.programIntakes.length !== 96) throw new Error("Unexpected NWPU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some(intake => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate)) throw new Error(`Missing exact NWPU Fall 2026 intake: ${program.slug}`);

type SourceKey = "guide" | "catalog";
function sourceRecord(key: SourceKey, id: keyof typeof expected) {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
function languageRule(program: Program, undergraduate = false) {
  const chinese = undergraduate ? "HSK Level 5 with at least 180" : "HSK Level 5 with at least 200";
  const english = undergraduate
    ? "Academic IELTS 6.0 with no element below 5.5, TOEFL 80, Duolingo 115, or the published Cambridge equivalent"
    : "Academic IELTS 6.5 with no element below 5.5, TOEFL 90, Duolingo 120, or PTE Academic 60";
  if (program.teachingLanguage === "Chinese") return `Submit ${chinese}.`;
  if (program.teachingLanguage === "English") return `Submit ${english}. Native English speakers applying to English-medium study use the published exemption.`;
  return `For a Chinese-medium route submit ${chinese}; for an English-medium route submit ${english}. The evidence must match the selected teaching medium.`;
}

function undergraduateDocument(program: Program): RequirementDocument {
  const subjects = (program.cscaSubjects ?? []).join(", ");
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("guide", "nwpu-undergraduate-guide-2026")], requirements: [
    item("guide", "health", "identity", "required", "International undergraduate applicants", "Be in good physical and mental health, without an infectious/contagious disease or a condition that would interfere with regular study.", "document", "3. Qualifications item 1"),
    item("guide", "age", "identity", "required", "International undergraduate applicants", "Be under age 23 by September 1, 2026.", "document", "3. Qualifications item 2"),
    item("guide", "education", "education", "required", "International undergraduate applicants", "Hold a high-school graduation certificate or diploma by September 1, 2026.", "document", "3. Qualifications item 3"),
    item("guide", "academic_performance", "academic_results", "required", "International undergraduate applicants", "Demonstrate academic and research ability with a previous average of at least 75%; international standardized or regional graduation-test results may also be submitted.", "official_result", "3. Qualifications item 4"),
    item("guide", "csca", "academic_results", "required", "Applicants to the exact programs bound to this template", `Submit CSCA results by May 20, 2026 for these published subjects: ${subjects}.`, "official_result", "3. Qualifications item 4 - CSCA table"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program, true), "official_result", "3. Qualifications item 5"),
    item("guide", "nationality", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen with a valid passport and satisfy the published foreign-nationality and overseas-residence conditions applicable to former Chinese citizens or applicants with Chinese parents.", "school_review", "3. Qualifications item 6"),
    item("guide", "application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Apply in one of four batches from November 1, 2025 through May 20, 2026. Programs may close earlier when capacity is reached; only September intake is offered.", "document", "2. Application Timeline"),
    item("guide", "passport", "documents", "required", "Undergraduate applicants", "Submit the passport information page, valid through at least October 30, 2026; applicants residing in mainland China also submit the current visa or residence-permit page.", "document", "4. Application Materials item 1"),
    item("guide", "diploma_transcripts", "documents", "required", "Undergraduate applicants", "Submit the high-school diploma or graduation certificate and all transcripts as originals or notarized copies.", "document", "4. Application Materials item 2"),
    item("guide", "statement_cv", "documents", "required", "Undergraduate applicants", "Submit the personal statement using the NPU template and a curriculum vitae; a talent-show video is optional.", "document", "4. Application Materials item 3"),
    item("guide", "csca_report", "documents", "required", "Undergraduate applicants", "Submit the CSCA result or a commitment letter identifying the expected test month, with the final score due by May 20, 2026.", "official_result", "4. Application Materials item 4"),
    item("guide", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program, true), "official_result", "4. Application Materials item 5"),
    item("guide", "criminal_record", "documents", "required", "Undergraduate applicants", "Submit a no-criminal-record certificate valid for six months.", "document", "4. Application Materials item 6"),
    item("guide", "achievements", "documents", "recommended", "Undergraduate applicants", "Optionally submit officially certified awards and scientific-research achievements.", "document", "4. Application Materials item 7"),
    item("guide", "physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Form valid for six months.", "document", "4. Application Materials item 8"),
    item("guide", "minor_guardian", "documents", "conditional", "Applicants who will be under age 18 on November 1, 2026", "Submit the Guardian Guarantee Letter using the NPU template.", "document", "4. Application Materials item 9"),
    item("guide", "bank_statement", "documents", "required", "Undergraduate applicants", "Submit the applicant's or parents' bank statements for the preceding six months showing USD 5,000.", "document", "4. Application Materials item 10"),
    item("guide", "translations", "documents", "conditional", "Applicants with records outside Chinese or English", "Provide notarized Chinese or English translations.", "document", "4. Application Materials - Note 2"),
    item("guide", "online_application_fee", "application_policy", "required", "Undergraduate applicants", "Apply only through the NPU online portal, upload all records by the deadline, and pay the non-refundable RMB 600 application fee.", "school_review", "5. How to Apply step 2"),
    item("guide", "review_interview", "academic_results", "required", "Applicants passing document review", "Undergo academic-school competency review and the notified interview; the result is sent by email.", "school_review", "5. How to Apply steps 3-4"),
    item("guide", "registration_deposit", "application_policy", "required", "Pre-admitted applicants", "Pay the required deposit: RMB 3,000 for first- and second-prize scholarship recipients, or 50% of tuition for third-prize and self-funded students.", "document", "5. How to Apply step 5", "preparation"),
    item("guide", "tuition", "application_policy", "required", `Enrolled ${program.teachingLanguage}-taught undergraduate students`, `Pay annual tuition of ${program.tuitionText.replace("/year", "")}.`, "document", "6. Expense", "enrollment"),
    item("guide", "insurance_accommodation", "other", "required", "Enrolled undergraduate students", "Pay health insurance of RMB 800 or 1,000 per year and published annual accommodation of RMB 5,400 for a triple room or RMB 7,200/9,000 for a double room.", "document", "6. Expense", "enrollment"),
    item("guide", "visa_registration", "documents", "required", "Admitted applicants", "Use the admission and JW202 documents to obtain an X1 visa, complete online/on-site registration, and present the original passport, admission notice, diploma, transcripts, language/CSCA results and physical-examination records.", "document", "5. How to Apply steps 6-7", "preparation"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  const guideId = master ? "nwpu-master-guide-2026" : "nwpu-phd-guide-2026";
  const catalogId = master ? "nwpu-master-majors-2026" : "nwpu-phd-majors-2026";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("guide", guideId), sourceRecord("catalog", catalogId)], requirements: [
    item("guide", "health", "identity", "required", `${program.degreeLevel} applicants`, "Be in good physical and mental health, without an infectious/contagious disease or a condition that would interfere with regular study.", "document", "Admission Requirements item 1"),
    item("guide", "age", "identity", "required", `${program.degreeLevel} applicants`, master ? "Be under age 30 by September 1, 2026." : "Be under age 35 by September 1, 2026.", "document", "Admission Requirements item 2"),
    item("guide", "education", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree by September 1, 2026." : "Hold a master's degree by September 1, 2026.", "document", "Admission Requirements item 3"),
    item("guide", "academic_performance", "academic_results", "required", `${program.degreeLevel} applicants`, "Have an average score of at least 75%; CSC applicants require at least 80%. GRE or GMAT may be submitted as additional evidence.", "official_result", "Admission Requirements item 4"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Admission Requirements item 5"),
    item("guide", "nationality", "identity", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen with a valid passport and satisfy the published four-year nationality and two-year residence review applicable to former Chinese citizens or applicants with Chinese parents.", "school_review", "Admission Requirements item 6"),
    item("guide", "application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Apply in one of four batches from November 1, 2025 through April 30, 2026 at 17:00 GMT+8. The CSC deadline is February 28, 2026 at 17:00 GMT+8.", "document", "Application Period"),
    item("guide", "passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit a passport information-page copy valid through at least December 31, 2026; applicants residing in mainland China also submit the current visa or residence permit.", "document", "Application Documents item 1"),
    item("guide", "degree_transcripts", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit the undergraduate diploma or pre-graduation certificate and transcripts for every undergraduate semester/year." : "Submit undergraduate and master's diplomas or pre-graduation proof and transcripts for every undergraduate and master's semester/year.", "document", "Application Documents items 2-3"),
    item("guide", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two recommendation letters from professors or associate professors.", "document", "Application Documents item 4"),
    item("guide", "study_plan", "documents", "required", `${program.degreeLevel} applicants`, `Submit the ${program.degreeLevel.toLowerCase()} study plan using the NPU template.`, "document", "Application Documents item 5"),
    item("guide", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Application Documents item 6"),
    item("guide", "criminal_record", "documents", "required", `${program.degreeLevel} applicants`, "Submit a no-criminal-record certificate valid for six months.", "document", "Application Documents item 7"),
    item("guide", "supervisor_acceptance", "documents", master ? "conditional" : "required", `${program.degreeLevel} applicants`, master ? "Submit a supervisor acceptance letter when applying to the eight schools identified by the guide; for other schools it is optional and treated as a bonus." : "Submit the mandatory NPU supervisor acceptance letter.", "document", "Application Documents item 8"),
    item("guide", "research_outputs", "documents", master ? "recommended" : "required", `${program.degreeLevel} applicants`, master ? "Optionally submit officially recognized awards and research achievements." : "Submit scientific-research achievements, including publications, patents and/or research awards.", "document", "Application Documents item 9"),
    item("guide", "physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Foreigner Physical Examination Form valid for six months.", "document", "Application Documents item 10"),
    item("guide", "bank_statement", "documents", "required", `${program.degreeLevel} applicants`, "Submit a bank statement showing USD 5,000.", "document", "Application Documents item 11"),
    item("guide", "portfolio", "documents", "conditional", "Architecture or design applicants", "Submit an art/design portfolio.", "document", "Application Documents item 13"),
    item("guide", "school_specific_rules", "application_policy", "conditional", `${program.degreeLevel} applicants`, master ? "School of Management requires GPA 80%; School of Public Policy and Administration requires HSK 6 score 180 for Chinese-medium study; listed schools require supervisor acceptance." : "School of Management requires GPA 80% for doctoral applicants.", "school_review", "Application Documents - Notes item 2"),
    item("guide", "translations_originals", "documents", "required", `${program.degreeLevel} applicants`, "Provide notarized Chinese or English translations for other-language records and present originals at registration for verification.", "document", "Application Documents - Notes items 3-4"),
    item("guide", "online_application_fee", "application_policy", "required", `${program.degreeLevel} applicants`, "Apply only through the NPU online portal, complete the psychological evaluation, upload all records and pay the non-refundable RMB 600 application fee.", "school_review", "Application and Selection Procedure step 2"),
    item("guide", "review_interview", "academic_results", "required", "Applicants passing document review", "Undergo authenticity and academic review followed by the notified examination/interview; respond promptly to requests or the application is treated as forfeited.", "school_review", "Application and Selection Procedure steps 3-4"),
    item("guide", "registration_deposit", "application_policy", "required", "Pre-admitted applicants", "Pay the refundable RMB 3,000 registration deposit.", "document", "Application and Selection Procedure step 5", "preparation"),
    item("guide", "tuition", "application_policy", "required", `Enrolled ${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} students`, `Pay annual tuition of ${program.tuitionText.replace("/year", "")}.`, "document", "Fee Structure", "enrollment"),
    item("guide", "insurance_accommodation", "other", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, master ? "Pay health insurance of RMB 800 or 1,000 per year and RMB 7,200 or 9,000 per year for a double room." : "Pay health insurance of RMB 800 or 1,000 per year and accommodation of RMB 7,200/9,000 for a double room or RMB 10,800 for a single room.", "document", "Fee Structure", "enrollment"),
    item("guide", "visa_registration", "documents", "required", "Admitted applicants", "Use the admission and JW201/JW202 documents to obtain an X1 visa, register in August/September 2026, and present all original academic, language and examination records.", "document", "Application and Selection Procedure steps 6-7", "preparation"),
  ] });
}

const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText,
    csca: program.cscaSubjects ?? [], hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "" });
  const rows = groups.get(identity) ?? [];
  rows.push(program);
  groups.set(identity, rows);
}
const definitions = [...groups.values()].map((rows, index) => {
  const program = rows[0];
  const subjects = program.cscaSubjects?.length ? `-${keyPart(program.cscaSubjects.join("-"))}` : "";
  return { key: `nwpu-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}-${keyPart(program.tuitionText)}${subjects}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows,
    document: program.degreeLevel === "Undergraduate" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap(definition => definition.rows.map(program => program.slug));
if (definitions.length !== 14 || targets.length !== 96 || new Set(targets).size !== 96) throw new Error("NWPU requirement groups are incomplete.");
const templates = definitions.map(definition => ({ key: definition.key, schoolSlug: "northwestern-polytechnical-university", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map(program => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "Official bilingual labels, including source spelling variants, are preserved for exact program binding."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope NWPU 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
