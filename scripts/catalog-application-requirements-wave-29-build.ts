import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-29.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/sdu-complete-batch-01/image-evidence/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionAmount: number; hskRequirement?: string; cscaSubjects?: string[] };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "sdu-undergraduate-guide-image-02-2026": "081e84897e7c51e81e93e691568d95d3703dd016de896162f5852cd6654f23e2",
  "sdu-undergraduate-guide-image-03-2026": "d5bb695b720fcd3f810a994dfffeed81b62aa16d1c5eb7fe64bc7b8cf4d3c497",
  "sdu-undergraduate-guide-image-04-2026": "efdae18c306028929466278a9a857c637a05d9e544019cd0bb5565a3682aa798",
  "sdu-undergraduate-guide-image-05-2026": "2d847ef785325578f7bbfa621d3a997523f027f861113dc2ffba37dc6ed61071",
  "sdu-master-guide-image-02-2026": "6b41fc308659a66e346265c0251d082dd005a773f398c1854321903bcd928f66",
  "sdu-master-guide-image-04-2026": "6f9399908c7a285f1ab7d65b03a6859dae67c77241df6d2226886db5fe1c28f4",
  "sdu-master-guide-image-05-2026": "a5eba744d2de0857d3619d7bbd1a2da7c3da7f88aeed0c38441615e5b75baf94",
  "sdu-doctoral-guide-image-02-2026": "7a2a631cc5669665aa11179982e350cbac7d11a19572a8619a296b6a4fe5279e",
  "sdu-doctoral-guide-image-05-2026": "377e7e15aff9404e25f1eb51118c1c42f269e5eaf6de2b315d47aabbe5cb932c",
  "sdu-doctoral-guide-image-06-2026": "ec4a97c1a2c541edfcd04632eb4e2b915e080e855952ae901151ef4a159bf725",
} as const;
const sources = new Map<string, Source>();
for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.contentType.startsWith("image/")
    && row.sha256 === expected[row.id as keyof typeof expected]) sources.set(row.id, row);
}
if (sources.size !== Object.keys(expected).length) throw new Error("SDU requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.sdu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 143 || seed.programIntakes.length !== 143) throw new Error("Unexpected SDU complete seed.");
for (const program of seed.programs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed SDU Fall 2026 intake: ${program.slug}`);
}

type SourceKey = "eligibility" | "programs" | "documents" | "fees";
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const sourceRecord = (key: SourceKey, id: keyof typeof expected) => {
  const source = sources.get(id)!;
  return { key, url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};
const englishRule = "Provide IELTS 6.0+, TOEFL 80+ (SDU DI code C296), TOEFL MyBest 80+, TOEFL Essentials 8+, or an equivalent English certificate. Native English speakers are exempt; applicants whose highest education was taught in English may submit official proof of the language of instruction.";

function undergraduateDocument(program: Program) {
  const languageRule = program.teachingLanguage === "English" ? englishRule
    : program.hskRequirement === "HSK 4, 210+"
      ? "Pass HSK Level 4 with at least 210 points. This lower threshold applies only to Teaching Chinese to Speakers of Other Languages; proof of Chinese-medium highest education may support the published exemption."
      : "Pass HSK Level 5 with at least 180 points, or submit proof that the highest completed education was taught in Chinese for the published exemption.";
  const csca = program.cscaSubjects?.join(", ");
  if (!csca) throw new Error(`Missing undergraduate CSCA mapping: ${program.slug}`);
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("eligibility", "sdu-undergraduate-guide-image-02-2026"), sourceRecord("programs", "sdu-undergraduate-guide-image-03-2026"),
    sourceRecord("documents", "sdu-undergraduate-guide-image-04-2026"), sourceRecord("fees", "sdu-undergraduate-guide-image-05-2026"),
  ], requirements: [
    item("eligibility", "citizenship_health_conduct", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a valid regular foreign passport, be physically and mentally healthy, be friendly to China, and have no criminal record.", "document", "Eligibility - General Requirements"),
    item("eligibility", "education", "education", "required", "International undergraduate applicants", "Hold a high-school diploma or above; an expected graduate may apply with a school-sealed pre-graduation certificate and must obtain the diploma before registration.", "document", "Eligibility and Application Documents item 2"),
    item("eligibility", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule, "official_result", "Eligibility - Language Proficiency Requirements"),
    item("eligibility", "nationality_rules", "identity", "conditional", "Applicants covered by PRC Ministry of Education Letter No. 12 [2020]", "Meet the nationality and overseas-residence criteria in Ministry of Education Letter No. 12 [2020] and submit the listed renunciation, household-registration, permanent-residence, foreign-nationality, parent-status and entry/exit evidence that applies.", "document", "Eligibility note and Application Documents item 11"),
    item("eligibility", "application_window", "application_policy", "required", "Self-financed Fall 2026 undergraduate applicants", "Complete the application by May 31, 2026; supplementary materials are not accepted after the deadline, and the guide recommends completing the application at least two weeks early.", "document", "Application Time"),
    item("programs", "one_program", "application_policy", "required", "Fall 2026 undergraduate applicants", "Choose only one program; in principle the selected program cannot be changed.", "school_review", "Academic Programs note"),
    item("programs", "csca", "academic_results", "required", `Applicants to ${program.slug}`, `Submit a CSCA Test Score Report covering: ${csca}.`, "official_result", "Matching program row in the Academic Programs and CSCA Test Subjects tables"),
    item("documents", "online_application", "application_policy", "required", "Fall 2026 undergraduate applicants", "Register and complete the online application in the Shandong University Application System for International Students; hard copies are not required.", "school_review", "Application Procedures"),
    item("documents", "passport", "documents", "required", "Fall 2026 undergraduate applicants", "Submit the passport personal-information page from a regular passport valid beyond March 1, 2027.", "document", "Application Documents item 1"),
    item("documents", "diploma_transcript", "documents", "required", "Fall 2026 undergraduate applicants", "Submit the high-school diploma or school-sealed pre-graduation certificate and school-sealed transcripts of all high-school courses.", "document", "Application Documents items 2-3"),
    item("documents", "motivation", "documents", "required", "Fall 2026 undergraduate applicants", `Use SDU's template for the motivation letter and write it in ${program.teachingLanguage === "Chinese" ? "Chinese" : "English"}.`, "document", "Application Documents item 5"),
    item("documents", "language_evidence", "documents", "required", "Fall 2026 undergraduate applicants", "Submit a normally two-year-valid language certificate or, where eligible, a responsible-person-signed and school-sealed letter proving the language of instruction.", "official_result", "Application Documents item 6"),
    item("documents", "physical_examination", "documents", "required", "Fall 2026 undergraduate applicants", "Submit a complete Foreign Physical Examination Form with photo, cross-page seal, physician signature and official hospital stamp; the examination result is valid for six months.", "document", "Application Documents item 7"),
    item("documents", "criminal_record", "documents", "required", "Fall 2026 undergraduate applicants", "Submit a Certificate of No Criminal Record issued by the local public-security management department and valid within six months before application.", "document", "Application Documents item 8"),
    item("documents", "financial_guarantee", "documents", "conditional", "Applicants not exempt under the stated Chinese Government Scholarship condition", "Submit the applicant's or immediate-family guarantor's passport/ID and proof of deposits of at least RMB 50,000 or equivalent foreign currency.", "document", "Application Documents item 9"),
    item("documents", "guardian", "documents", "conditional", "Applicants younger than 18", "Submit the SDU guardian statement, notarized proof that the parents entrusted guardianship, and the adult Shandong-resident guardian's ID or passport.", "document", "Application Documents item 10"),
    item("documents", "document_format", "documents", "required", "Fall 2026 undergraduate applicants", "Upload Chinese or English documents, or originals together with certified Chinese/English translations; use color scans, not phone photos or photocopies, and do not use handwritten documents except the physical-examination form and signatures.", "document", "Application Documents note"),
    item("fees", "assessment", "academic_results", "required", "Applicants after submission", "Complete any document review, interview or other assessment requested by SDU; admission is based on the final evaluation.", "school_review", "Examination and Admission"),
    item("fees", "application_fee", "application_policy", "required", "Applicants receiving a pre-admission email", "Pay the non-refundable RMB 400 application fee after receiving the pre-admission email.", "document", "Fees item 1"),
    item("fees", "tuition", "application_policy", "required", "Enrolled students", `Pay annual tuition of RMB ${program.tuitionAmount.toLocaleString("en-US")}.`, "document", "Fees item 2, matching program category/language row", "enrollment"),
    item("fees", "insurance", "documents", "required", "Enrolled students", "Pay the RMB 800 annual medical-insurance fee; required insurance is necessary to complete registration.", "document", "Fees item 3", "enrollment"),
    item("fees", "accommodation", "other", "conditional", "Students using university accommodation", "Budget the published accommodation range of RMB 23-45 per person per day according to room type.", "document", "Fees item 4", "enrollment"),
    item("fees", "registration_originals", "documents", "required", "Admitted applicants", "Register at the time in the admission letter and present original graduation, language, physical-examination and other required documents; missing originals can disqualify enrollment.", "document", "Registration", "enrollment"),
  ] });
}

function graduateDocument(program: Program) {
  const degree = program.degreeLevel;
  const prefix = degree === "Master" ? "sdu-master" : "sdu-doctoral";
  const languageRule = program.teachingLanguage === "English" ? englishRule
    : degree === "Master" && program.hskRequirement === "HSK 5, 180+"
      ? "Pass HSK Level 5 with at least 180 points for International Chinese Language Education, or submit proof that the highest completed education was taught in Chinese for the published exemption."
      : degree === "Master" ? "Pass HSK Level 6 with at least 180 points, or submit proof that the highest completed education was taught in Chinese for the published exemption."
        : "Pass HSK Level 6 with at least 210 points, or submit proof that the highest completed education was taught in Chinese for the published exemption.";
  const eligibilityId = `${prefix}-guide-image-02-2026` as keyof typeof expected;
  const documentsId = `${prefix}-guide-image-${degree === "Master" ? "04" : "05"}-2026` as keyof typeof expected;
  const feesId = `${prefix}-guide-image-${degree === "Master" ? "05" : "06"}-2026` as keyof typeof expected;
  const qualifyingDegree = degree === "Master" ? "bachelor's" : "master's";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("eligibility", eligibilityId), sourceRecord("documents", documentsId), sourceRecord("fees", feesId),
  ], requirements: [
    item("eligibility", "citizenship_health_conduct", "identity", "required", `${degree} applicants`, "Be a non-Chinese citizen holding a valid regular foreign passport, be physically and mentally healthy, be friendly to China, and have no criminal record.", "document", "Eligibility - General Requirements"),
    item("eligibility", "education", "education", "required", `${degree} applicants`, `Hold a ${qualifyingDegree} degree awarded by an institution accredited by the Chinese Ministry of Education; an expected graduate may use a school-sealed pre-graduation certificate and must obtain the required degree before registration.`, "document", "Eligibility and Application Documents item 2"),
    item("eligibility", "language", "language", "required", `${program.teachingLanguage}-taught ${degree.toLowerCase()} applicants`, languageRule, "official_result", "Eligibility - Language Proficiency Requirements"),
    item("eligibility", "nationality_rules", "identity", "conditional", "Applicants with relevant former Chinese nationality or Chinese-parentage history", "Submit the applicable renunciation, household-registration cancellation, foreign permanent-residence, foreign-nationality-at-birth and Chinese-parent status evidence listed by SDU.", "document", "Eligibility note and Application Documents item 10"),
    item("eligibility", "application_window", "application_policy", "required", `Self-financed Fall 2026 ${degree.toLowerCase()} applicants`, "Complete the application by May 31, 2026; supplementary materials are not accepted after the deadline, and the guide recommends completing the application at least two weeks early.", "document", "Application Time"),
    item("documents", "online_application", "application_policy", "required", `Fall 2026 ${degree.toLowerCase()} applicants`, "Register and complete the online application in the Shandong University Application System for International Students; hard copies are not required.", "school_review", "Application Procedures"),
    item("documents", "passport", "documents", "required", `Fall 2026 ${degree.toLowerCase()} applicants`, "Submit the passport personal-information page from a regular passport valid beyond March 1, 2027.", "document", "Application Documents item 1"),
    item("documents", "degree_transcripts", "documents", "required", `${degree} applicants`, degree === "Master" ? "Submit the undergraduate diploma/degree or pre-graduation certificate and school-sealed transcripts of all undergraduate courses." : "Submit undergraduate and master's diplomas/degrees or the relevant pre-graduation certificate, plus school-sealed transcripts of all undergraduate and master's courses.", "document", "Application Documents items 2-3"),
    item("documents", "recommendations", "documents", "required", `${degree} applicants`, "Submit two program-related recommendation letters from professors, associate professors or experts with equivalent titles; each must include a handwritten signature, position, institution, telephone number and email address.", "document", "Application Documents item 4"),
    item("documents", "motivation", "documents", "required", `${degree} applicants`, `Use SDU's template for the motivation letter and write it in ${program.teachingLanguage === "Chinese" ? "Chinese" : "English"}.`, "document", "Application Documents item 5"),
    item("documents", "language_evidence", "documents", "required", `${degree} applicants`, "Submit a normally two-year-valid language certificate or, where eligible, a responsible-person-signed and school-sealed letter proving the language of instruction.", "official_result", "Application Documents item 6"),
    item("documents", "physical_examination", "documents", "required", `${degree} applicants`, "Submit a complete Foreign Physical Examination Form with photo, cross-page seal, physician signature and official hospital stamp; the result is valid for six months.", "document", "Application Documents item 7"),
    item("documents", "criminal_record", "documents", "required", `${degree} applicants`, "Submit a Certificate of No Criminal Record issued by the local public-security management department and valid within six months before application.", "document", "Application Documents item 8"),
    item("documents", "financial_guarantee", "documents", "conditional", "Applicants not covered by the scholarship exemption stated for this degree guide", "Submit the applicant's or immediate-family guarantor's passport/ID and proof of deposits of at least RMB 50,000 or equivalent foreign currency.", "document", "Application Documents item 9"),
    item("documents", "employment_publications", "documents", "conditional", "Applicants with employment or publications", "Submit proof of employment and the table of contents and abstracts of published academic articles when available.", "document", "Application Documents items 11-12"),
    item("documents", "document_format", "documents", "required", `${degree} applicants`, "Upload Chinese or English documents, or originals with certified Chinese/English translations; use color scans, not phone photos or photocopies, and do not use handwritten documents except the physical-examination form and signatures.", "document", "Application Documents note"),
    item("fees", "assessment", "academic_results", "required", "Applicants after submission", "Complete any document review, interview, written test or other assessment requested by SDU; admission is based on the final evaluation.", "school_review", "Examination and Admission"),
    item("fees", "application_fee", "application_policy", "required", "Applicants receiving a pre-admission email", "Pay the non-refundable RMB 400 application fee after receiving the pre-admission email.", "document", "Fees item 1"),
    item("fees", "tuition", "application_policy", "required", "Enrolled students", `Pay annual tuition of RMB ${program.tuitionAmount.toLocaleString("en-US")}.`, "document", "Fees item 2, matching degree/category/language row", "enrollment"),
    item("fees", "insurance", "documents", "required", "Enrolled students", "Pay the RMB 800 annual medical-insurance fee; required insurance is necessary to complete registration.", "document", "Fees item 3", "enrollment"),
    item("fees", "accommodation", "other", "conditional", "Students using university accommodation", "Budget the published accommodation range of RMB 23-45 per person per day according to room type.", "document", "Fees item 4", "enrollment"),
    item("fees", "registration_originals", "documents", "required", "Admitted applicants", "Register at the time in the admission letter and present original graduation/degree, language, physical-examination and other required documents; missing originals can disqualify enrollment.", "document", "Registration", "enrollment"),
  ] });
}

const signature = (program: Program) => [program.degreeLevel, program.teachingLanguage, program.tuitionAmount,
  program.hskRequirement ?? "none", program.cscaSubjects?.join("+") ?? "none"].join("|");
const grouped = new Map<string, Program[]>();
for (const program of seed.programs) grouped.set(signature(program), [...(grouped.get(signature(program)) ?? []), program]);
const slugPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const templates = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, rows]) => {
  const representative = rows[0];
  return { key: `sdu-${slugPart(groupKey)}-fall-2026`, schoolSlug: "shandong-university", cycle: "fall-2026",
    targetProgramSlugs: rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window."],
    document: representative.degreeLevel === "Undergraduate" ? undergraduateDocument(representative) : graduateDocument(representative) };
});
const targets = templates.flatMap((template) => template.targetProgramSlugs);
if (templates.length !== 27 || targets.length !== 143 || new Set(targets).size !== 143) throw new Error("SDU requirement groups are incomplete.");
const output = { version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located complete-scope SDU 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
