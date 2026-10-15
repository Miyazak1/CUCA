import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem, type RequirementDocument } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-32.draft.json");
const manifests = await Promise.all([
  "work/catalog-official/nankai-complete-batch-01/manifest.json",
  "work/catalog-official/nankai-complete-batch-01-master/manifest.json",
].map(async path => JSON.parse(await readFile(resolve(root, path), "utf8"))));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: string; tuitionText: string; cscaSubjects?: string[]; hskRequirement?: string; englishRequirement?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "nankai-undergraduate-admissions-2026": "807f7bf793268f7e60874649e186b1ba99bcd185003e8988e67aa653e09a7ce3",
  "nankai-undergraduate-program-catalog-pdf-2026": "7996b633d39240e02676ca6cfcc795239da3af5419e6f8239a202002291c2852",
  "nankai-master-admissions-2026": "3bf303ec6358f7336a5777aaa9a4958db8fdfa924066a1c8fea85e81f649f9ac",
  "nankai-master-program-catalog-pdf-2026": "72884af99cee18bd9bb13ff455dd8bca6017903404a0474cbd340290f4ef5d44",
  "nankai-doctoral-admissions-2026": "52abf0b3a574a25674b71ab4fea7fea8991960c88e0b5564647cfafc665f13bb",
  "nankai-doctoral-program-catalog-pdf-2026": "a7b7a5e9e1e25e72d16f8adcf947289ac1c1b95b9a80317cd6706b66250a93b8",
} as const;
const evidence = new Map<string, Source>();
for (const manifest of manifests) for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.sha256 === expected[row.id as keyof typeof expected]) evidence.set(row.id, row);
}
if (evidence.size !== Object.keys(expected).length) throw new Error("Nankai requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.nankai-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 339 || seed.programIntakes.length !== 339) throw new Error("Unexpected Nankai complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing Nankai Fall 2026 intake: ${program.slug}`);

function sourceRecord(key: "guide" | "catalog", id: keyof typeof expected) {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: "guide" | "catalog", key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const displaySubjects = (subjects: string[]) => subjects.map(subject => subject.toLowerCase() === "physics" ? "Physics" : subject).join(", ");

function undergraduateDocument(program: Program): RequirementDocument {
  const subjects = program.cscaSubjects ?? [];
  const bilingual = program.teachingLanguage !== "Chinese";
  const languageRule = bilingual
    ? "Meet the general HSK Level 4 score 180 admission threshold and any additional English, Japanese or French requirement published for the selected bilingual or multilingual route. The program catalog controls where it states a stricter route-specific threshold."
    : "Submit HSK Level 4 with at least 180 for general admission. The program catalog controls where it publishes HSK Level 5 or another stricter route-specific threshold.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "nankai-undergraduate-admissions-2026"), sourceRecord("catalog", "nankai-undergraduate-program-catalog-pdf-2026"),
  ], requirements: [
    item("guide", "citizenship_health_age", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a valid passport, be in good physical and mental health, and have been born before September 1, 2008.", "document", "I. Eligibility Requirements item 1"),
    item("guide", "nationality_review", "identity", "required", "International undergraduate applicants", "Meet the nationality conditions in Ministry of Education Document No. 12 (2020), including the additional review applicable to former Chinese citizens and applicants with Chinese-parent nationality circumstances.", "school_review", "I. Eligibility Requirements item 4"),
    item("guide", "education", "education", "required", "International undergraduate applicants", "Hold a senior-high-school diploma and demonstrate excellent academic performance.", "document", "I. Eligibility Requirements item 2"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule, "official_result", "I. Eligibility Requirements item 3 and III. Programs"),
    item("guide", "application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Apply from October 20, 2025 through June 30, 2026; scholarship deadlines may be earlier.", "document", "II. Application Period"),
    item("guide", "program_preferences", "application_policy", "required", "Fall 2026 undergraduate applicants", "Select up to two programs in preference order. Business Economics and Business Administration accept only first-choice applications.", "self_report", "III. Programs"),
    item("guide", "passport", "documents", "required", "Undergraduate applicants", "Submit the passport information page; the passport must remain valid until at least September 1, 2027.", "document", "IV. Required Documents item 1"),
    item("guide", "diploma_transcripts", "documents", "required", "Undergraduate applicants", "Submit a notarized highest-degree certificate and complete high-school academic transcripts, with Chinese or English translation where applicable.", "document", "IV. Required Documents items 2-3"),
    item("catalog", "csca", "academic_results", "required", `Applicants to the exact programs bound to this template`, `Submit CSCA score reports for these catalog-published subjects: ${displaySubjects(subjects)}.`, "official_result", "2026 undergraduate catalog - CSCA Test Subject column"),
    item("guide", "personal_statement", "documents", "required", "Undergraduate applicants", "Submit a personal statement in Chinese or English.", "document", "IV. Required Documents item 5"),
    item("guide", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule, "official_result", "IV. Required Documents item 6 and program catalog"),
    item("guide", "recommendation", "documents", "required", "Undergraduate applicants", "Submit one recommendation letter.", "document", "IV. Required Documents item 7"),
    item("guide", "supplementary_materials", "documents", "recommended", "Undergraduate applicants", "Submit supplementary materials demonstrating comprehensive abilities when available.", "document", "IV. Required Documents item 8"),
    item("guide", "physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Record completed after November 2025.", "document", "IV. Required Documents item 9"),
    item("guide", "financial_support", "documents", "required", "Undergraduate applicants", "Submit proof of financial capability.", "document", "IV. Required Documents item 10"),
    item("guide", "criminal_record", "documents", "required", "Undergraduate applicants", "Submit a no-criminal-record certificate.", "document", "IV. Required Documents item 11"),
    item("guide", "online_application", "application_policy", "required", "Fall 2026 undergraduate applicants", "Complete the Nankai online application and upload all required records; incomplete applications are not processed.", "school_review", "V. Application Procedure items 1-2"),
    item("guide", "interview", "academic_results", "required", "Applicants passing preliminary review", "Participate in the university interview assessing language proficiency and comprehensive competencies.", "school_review", "V. Application Procedure item 3"),
    item("guide", "application_fee_prepayment", "application_policy", "required", "Admitted non-CGS applicants", "Pay the non-refundable RMB 400 application fee and the full tuition amount within the specified period; failure to prepay tuition revokes the offer.", "document", "V. Application Procedure item 4"),
    item("catalog", "tuition", "application_policy", "required", "Enrolled students in the exact programs bound to this template", `Pay annual tuition of ${program.tuitionText.replace("/year", "")}.`, "document", "2026 undergraduate catalog - Tuition Fee column", "enrollment"),
    item("guide", "accommodation_insurance", "other", "required", "Enrolled undergraduate students", "Budget RMB 1,000-3,000 per month for accommodation and purchase comprehensive medical insurance at RMB 800 per year.", "document", "VIII. Fees items 3-4", "enrollment"),
    item("guide", "visa_registration", "documents", "required", "Admitted applicants", "Use the admission and JW201/JW202 documents to obtain an X1 visa, convert it to a residence permit within 30 days after arrival, and present original documents for registration review.", "document", "VII. Visa Application", "preparation"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  const english = program.teachingLanguage === "English";
  const guideId = master ? "nankai-master-admissions-2026" : "nankai-doctoral-admissions-2026";
  const catalogId = master ? "nankai-master-program-catalog-pdf-2026" : "nankai-doctoral-program-catalog-pdf-2026";
  const languageRule = english
    ? "Submit IELTS 6.0, TOEFL 80 or Duolingo 105. Native English speakers are exempt; applicants whose prior degree was taught in English may submit an official English-medium certificate instead."
    : "Submit HSK Level 5 with at least 180. Native Chinese speakers and applicants whose qualifying prior degree was taught in Chinese may use the stated exemption; specified literature/language schools require HSK Level 6 score 180 before graduation.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", guideId), sourceRecord("catalog", catalogId),
  ], requirements: [
    item("guide", "citizenship", "identity", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen holding a valid passport and meet Ministry of Education Document No. 12 (2020) where formerly a Chinese citizen.", "document", "I. Qualifications item a"),
    item("guide", "education_age", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree and be under age 35." : "Hold a master's degree and be under age 40.", "document", "I. Qualifications item b"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule, "official_result", "I. Qualifications item c"),
    item("guide", "criminal_record", "identity", "required", `${program.degreeLevel} applicants`, "Have no criminal record and submit the supporting certificate.", "document", "I. Qualifications item d and III.B checklist item J"),
    item("guide", "application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Apply online from October 20, 2025 through May 31, 2026; scholarship applicants should apply earlier according to the relevant scholarship deadline.", "document", "III.A Application Procedure"),
    item("guide", "online_application", "application_policy", "required", `${program.degreeLevel} applicants`, "Complete the Nankai International Student Online Service System application and upload all required records in Chinese or English, with notarized translations when necessary.", "school_review", "III. Application Procedure"),
    item("guide", "degree_transcripts", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit the original bachelor's diploma or expected-graduation proof and notarized undergraduate transcripts; final originals are due before registration." : "Submit the original master's diploma or expected-graduation proof and notarized prior-degree transcripts; final originals are due before registration.", "document", "III.B Application Documents Checklist items A-B"),
    item("guide", "personal_statement", "documents", "required", `${program.degreeLevel} applicants`, "Submit a personal statement of at least 800 words covering the study/research plan, financial situation, scholarship reasons where applicable, awards and personal strengths.", "document", "III.B checklist item C"),
    item("guide", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two Chinese- or English-language recommendation letters from professors or associate professors.", "document", "III.B checklist item D"),
    item("guide", "supervisor_acceptance", "documents", master ? "recommended" : "required", `${program.degreeLevel} applicants`, master ? "A Nankai supervisor acceptance letter may be submitted; the guide explicitly requires it for doctoral applicants." : "Submit an acceptance letter from a Nankai supervisor.", "document", "III.B checklist item E"),
    item("guide", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule, "official_result", "III.B checklist item F"),
    item("guide", "passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit a copy of an ordinary passport that expires after September 2026.", "document", "III.B checklist item G"),
    item("guide", "physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Foreigner Physical Examination Form covering all listed items and completed after October 2025.", "document", "III.B checklist item H"),
    item("guide", "financial_support", "documents", "required", `${program.degreeLevel} applicants`, "Submit a certificate of financial support.", "document", "III.B checklist item I"),
    item("guide", "assessment", "academic_results", "required", "Shortlisted applicants", "Pass academic-school document review and a professional interview; an expert panel determines the final admission list.", "school_review", "IV. Assessment and Admission"),
    item("guide", "application_fee", "application_policy", "required", `${program.degreeLevel} applicants`, "Pay the RMB 600 application fee at registration; Chinese Government Scholarship winners are exempt under the guide.", "document", "VII. Fees item 1"),
    item("catalog", "tuition", "application_policy", "required", "Enrolled students in the exact programs bound to this template", `Pay annual tuition of ${program.tuitionText.replace("/year", "")}.`, "document", `2026 ${program.degreeLevel.toLowerCase()} catalog - Tuition Fee column`, "enrollment"),
    item("guide", "accommodation_insurance", "other", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, "Budget RMB 1,000-3,000 per month for accommodation and purchase medical insurance at RMB 800 per year.", "document", "VII. Fees items 3-4", "enrollment"),
    item("guide", "visa_registration", "documents", "required", "Admitted applicants", "Obtain an X1 visa using the admission and JW201/JW202 records, register on the dates in the admission notice, and present the original qualifying degree for admission review.", "document", "V. Registration", "preparation"),
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
const definitions = [...groups.values()].map(rows => {
  const program = rows[0];
  const subjects = program.cscaSubjects?.length ? `-${keyPart(program.cscaSubjects.join("-"))}` : "";
  return { key: `nankai-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}-${keyPart(program.tuitionText)}${subjects}-fall-2026`, rows,
    document: program.degreeLevel === "Undergraduate" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap(definition => definition.rows.map(program => program.slug));
if (definitions.length !== 21 || targets.length !== 339 || new Set(targets).size !== 339) throw new Error("Nankai requirement groups are incomplete.");
const templates = definitions.map(definition => ({ key: definition.key, schoolSlug: "nankai-university", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map(program => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "Program-catalog spelling and multilingual teaching labels are retained for binding; no language requirement is inferred beyond the official guide and catalog."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope Nankai 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
