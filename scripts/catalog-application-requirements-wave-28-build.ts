import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-28.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-56-20-492Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; fieldCategory?: string; tuitionText: string; cscaSubjects?: string[] };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "tju-undergraduate-admissions-2027": "1e55d46672aa6efc0957cd9f37c590bfef5234c070d77e192e2b89566455ece8",
  "tju-undergraduate-program-catalog-2027": "b39a8f16ea41b70d77566735caec737410391f45b4ebe8c6c37fea1c9bead684",
  "tju-undergraduate-csca-subjects-2027": "3cb0ab9ccff78ab2a9f6bc4b9eda9f32322d4b6b07a1be6a59512d0e561a28b2",
  "tju-master-admissions-2027": "902b7df52f9e034bf3a5f47bef8d3d10145ee6202abf982faf0cb3c9aa291557",
  "tju-master-program-catalog-2027": "abac819bc46e9388cd61def72ab4d6715322ac6383b6f89879688c525381958e",
  "tju-doctoral-admissions-2027": "d7681ada3a16460072fce6c51b55439da5602848dd7b0395cc6878bc5324622b",
  "tju-doctoral-program-catalog-2027": "38494b6a56f62af2f5ad32db182cf35fc92277aca977003759ced51fd631d3cc",
} as const;
const sources = new Map<string, Source>();
for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.sha256 === expected[row.id as keyof typeof expected]) sources.set(row.id, row);
}
if (sources.size !== 7) throw new Error("TJU 2027 requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.tju-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 324 || seed.programIntakes.length !== 324) throw new Error("Unexpected TJU 2027 complete seed.");
for (const program of seed.programs) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2027 && intake.status === "open")) throw new Error(`Missing open TJU Fall 2027 intake: ${program.slug}`);
}

type SourceKey = "admissions" | "catalog" | "csca";
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const sourceRecord = (key: SourceKey, id: keyof typeof expected) => {
  const source = sources.get(id)!;
  return { key, url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};

const commonIdentity = (degree: Program["degreeLevel"]): RequirementItem[] => [
  item("admissions", "citizenship_passport_health", "identity", "required", `${degree} applicants`, "Be a non-Chinese citizen with a valid ordinary passport, be in good physical and mental health, have good conduct and comply with Chinese laws and Tianjin University rules.", "document", "Qualifications items 1-2"),
  item("admissions", "nationality_history", "identity", "conditional", "Applicants who previously held Chinese citizenship or have a Chinese-citizen parent", "Meet Ministry of Education Document No. 12 (2020) and submit the published naturalization, renunciation and recent entry/exit evidence where applicable.", "document", "Qualifications and passport-document note"),
  item("admissions", "passport", "documents", "required", `${degree} applicants`, "Submit a passport copy whose validity extends beyond September 1, 2027.", "document", "Application Documents"),
  item("admissions", "resume", "documents", "required", `${degree} applicants`, "Submit an uninterrupted study and work experience resume beginning with senior high school and fully disclose prior study in China.", "document", "Application Documents"),
  item("admissions", "physical_examination", "documents", "required", `${degree} applicants`, "Submit the Foreigner Physical Examination Form covering all listed items and completed after September 30, 2026.", "document", "Application Documents"),
  item("admissions", "non_criminal_record", "documents", "required", `${degree} applicants`, "Submit a certificate of non-criminal record valid within six months before the application date; qualifying fresh graduates may submit the published school conduct certificate.", "document", "Application Documents"),
  item("admissions", "current_china_status", "documents", "conditional", "Applicants currently in China", "Submit the current visa and a good-conduct/performance certificate from the present institution; undergraduate applicants studying at a Chinese university must also submit the withdrawal certificate.", "document", "Application Documents"),
  item("admissions", "translation", "documents", "conditional", "Documents not issued in Chinese or English", "Submit the original document together with a notarized Chinese or English translation.", "document", "Application Remarks"),
  item("admissions", "additional_verification", "application_policy", "required", `${degree} applicants`, "Tianjin University may request original or notarized hard copies for further qualification checks; false materials result in disqualification.", "school_review", "Application Remarks"),
  item("admissions", "application_window", "application_policy", "required", `Fall 2027 ${degree.toLowerCase()} applicants`, "Complete the TJU online application by May 31, 2027. Scholarship applicants should follow any earlier route-specific deadline; undergraduate scholarship applicants are requested to apply by April 1, 2027.", "document", "Application Schedule"),
  item("admissions", "application_fee", "application_policy", "required", "Admitted applicants", "Pay the published CNY 500 application fee after admission; Chinese Government Scholarship winners are exempt under the stated rule.", "document", "Costs", "enrollment"),
  item("admissions", "insurance", "documents", "required", "Enrolled students", "Pay CNY 800 per year for accidental-injury and hospitalization insurance.", "document", "Costs", "enrollment"),
  item("admissions", "accommodation", "other", "conditional", "Students using university accommodation", "Budget the published CNY 15-60 per bed per day, depending on campus and room type.", "document", "Costs", "enrollment"),
  item("admissions", "visa_registration", "documents", "required", "Admitted applicants", "Use the ordinary passport, Admission Notice, JW201/JW202 and original physical-examination records to obtain an X1 visa and register on the dates in the Admission Notice.", "document", "Visa Application and Registration", "preparation"),
];

function undergraduateDocument(program: Program) {
  const chinese = program.teachingLanguage === "Chinese";
  const hskRule = program.fieldCategory === "School of International Education"
    ? "Submit HSK Level 4 with a score of at least 180; native Chinese speakers and applicants completing high school in Chinese may use the published exemption. HSK 4/180 also exempts the Professional Chinese CSCA subject for this school."
    : "Submit HSK Level 5 with a score of at least 180; native Chinese speakers and applicants completing high school in Chinese may use the published exemption.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [sourceRecord("admissions", "tju-undergraduate-admissions-2027"), sourceRecord("catalog", "tju-undergraduate-program-catalog-2027"), sourceRecord("csca", "tju-undergraduate-csca-subjects-2027")],
    requirements: [...commonIdentity("Undergraduate"),
      item("admissions", "education_age", "education", "required", "Undergraduate applicants", "Hold a high-school diploma and be younger than 25; submit a pre-graduation certificate if the diploma is not yet available and provide the final original or notarized diploma before registration.", "document", "Qualifications and Application Documents"),
      item("admissions", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, chinese ? hskRule : "Submit IELTS 6.0, TOEFL 80 or qualifying proof of English-medium high-school study; native English speakers may use the published exemption.", "official_result", "Qualifications item 3"),
      item("csca", "csca", "academic_results", "required", "Fall 2027 undergraduate applicants", `Submit CSCA results for ${program.cscaSubjects!.join(", ")}. Use the test-paper language matching the program teaching language; English-taught routes do not take Professional Chinese.`, "official_result", `Official 2027 CSCA table: ${program.fieldCategory}`),
      item("admissions", "diploma_transcript", "documents", "required", "Undergraduate applicants", "Submit the original or notarized high-school diploma or pre-graduation certificate and notarized high-school transcripts or accepted international standardized-test results.", "document", "Application Documents items 1-2"),
      item("admissions", "study_plan", "documents", "required", "Undergraduate applicants", "Submit a study plan of at least 600 words.", "document", "Application Documents item 7"),
      item("admissions", "financial_evidence", "documents", "required", "Undergraduate applicants", "Submit a bank savings certificate or the financial guarantor's income certificate.", "document", "Application Documents item 11"),
      item("admissions", "guardian", "identity", "conditional", "Applicants younger than 18 on September 1, 2027", "Submit the original guardian certificate issued by a Tianjin district notary office; the guardian must be a permanent Tianjin resident.", "document", "Qualifications and Application Documents item 12"),
      item("admissions", "deposit", "application_policy", "required", "Admitted undergraduate applicants", "Pre-pay the CNY 7,000 deposit and CNY 500 application fee by the university's stated deadline; both are non-refundable if the student later declines registration for personal reasons.", "document", "Admission Process Step 3", "enrollment"),
      item("catalog", "tuition", "application_policy", "required", `Students in ${program.nameEn}`, `Pay the official tuition schedule: ${program.tuitionText}.`, "document", `Official undergraduate catalog route ${program.slug}`, "enrollment"),
    ] });
}

function graduateDocument(program: Program) {
  const master = program.degreeLevel === "Master";
  const mba = master && program.teachingLanguage === "English" && /business administration/i.test(program.nameEn);
  const languageRule = program.teachingLanguage === "Chinese"
    ? "Submit HSK Level 5 with a score of at least 180; native Chinese speakers and applicants completing the preceding degree in Chinese may use the published exemption."
    : `${master ? "Submit IELTS 6.0, TOEFL 80 or Duolingo 110" : "Submit IELTS 6.0 or TOEFL 80"}; native English speakers and applicants completing the preceding degree in English may use the published exemption.`;
  const requirements: RequirementItem[] = [...commonIdentity(program.degreeLevel),
    item("admissions", "education_age", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree and be younger than 35." : "Hold a master's degree and be younger than 40.", "document", "Qualifications items 1-2"),
    item("admissions", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule, "official_result", "Qualifications item 3"),
    item("admissions", "degree_transcripts", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit the bachelor's diploma or pre-graduation certificate and notarized academic transcripts; provide final originals before registration." : "Submit bachelor's and master's diplomas or the applicable pre-graduation certificate and notarized transcripts; provide final originals before registration.", "document", "Application Documents items 1-2"),
    item("admissions", "study_research_plan", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit a Chinese- or English-language study or research plan of at least 1,000 words." : "Submit a Chinese- or English-language research proposal of at least 1,000 words bearing a Tianjin University professor's signature.", "document", "Application Documents"),
    item("admissions", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two Chinese- or English-language recommendation letters from professors or associate professors.", "document", "Application Documents"),
    item("admissions", "supervisor_acceptance", "documents", "conditional", `${program.degreeLevel} applicants who obtain a TJU supervisor acceptance letter`, "Upload the Tianjin University supervisor acceptance letter; doctoral research proposals still require the published TJU professor signature.", "document", "Application Documents"),
    item("admissions", "architecture_portfolio", "documents", "conditional", "Applicants to the School of Architecture", "Submit the published electronic works collection and video presentation.", "document", "Application Documents other attachments"),
    item("admissions", "financial_evidence", "documents", "conditional", master ? "Self-sponsored and Tianjin Government Scholarship applicants" : "Self-sponsored and Peiyang Future Scholar Scholarship applicants", "Submit a bank deposit certificate or financial guarantor income certificate.", "document", "Application Documents other attachments"),
    item("catalog", "tuition", "application_policy", "required", `Students in ${program.nameEn}`, `Pay the official tuition schedule: ${program.tuitionText}.`, "document", `Official ${program.degreeLevel.toLowerCase()} catalog route ${program.slug}`, "enrollment"),
  ];
  if (mba) requirements.push(item("admissions", "mba_special", "education", "required", "English-taught MBA applicants", "Obtain a TJU supervisor acceptance letter, provide IELTS 6.5 or TOEFL 85, have GPA above 3.2/4.0 and at least one year of relevant work experience; students graduating in 2027 are not eligible.", "school_review", "Qualifications item 4"));
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [sourceRecord("admissions", master ? "tju-master-admissions-2027" : "tju-doctoral-admissions-2027"),
      sourceRecord("catalog", master ? "tju-master-program-catalog-2027" : "tju-doctoral-program-catalog-2027")], requirements });
}

const signature = (program: Program) => program.degreeLevel === "Undergraduate"
  ? [program.degreeLevel, program.teachingLanguage, program.fieldCategory === "School of International Education" ? "hsk4" : "standard", program.tuitionText, ...(program.cscaSubjects ?? [])].join("|")
  : [program.degreeLevel, program.teachingLanguage, program.tuitionText, /business administration/i.test(program.nameEn) ? "mba" : "standard"].join("|");
const groups = new Map<string, Program[]>();
for (const program of seed.programs) groups.set(signature(program), [...(groups.get(signature(program)) ?? []), program]);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
const templates = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows], index) => ({
  key: `tju-${String(index + 1).padStart(2, "0")}-${slug(key)}-fall-2027`, schoolSlug: "tianjin-university", cycle: "fall-2027",
  targetProgramSlugs: rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2027 },
  targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["Current Fall 2027 application route; publication remains disabled until review.",
    ...(rows[0].tuitionText.includes("Year 1") ? ["Tuition changes after Year 1; preserve the full official schedule."] : []),
    ...(rows[0].tuitionText.includes("total for 3 years") ? ["The official catalog publishes a three-year total; the annual equivalent is only a normalized filter value."] : [])],
  document: rows[0].degreeLevel === "Undergraduate" ? undergraduateDocument(rows[0]) : graduateDocument(rows[0]),
}));
if (templates.flatMap((template) => template.targetProgramSlugs).length !== 324) throw new Error("TJU requirement groups are incomplete.");
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located complete-scope TJU 2027 requirements bound only to exact open program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0,
    targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
