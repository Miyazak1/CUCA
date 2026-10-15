import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-55.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText?: string; cscaRequirement?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };

const expected = new Map([
  ["beihang-undergraduate-admissions-2026", "e10c61e03f764a1f19215cc2803473f863e379ae31d6f0afed0b281959d81b56"],
  ["beihang-undergraduate-csca-requirements-2026", "b308f3a2575b97e166fed5851f62443ea95bf3edd93cd448cf474d5d997cd72b"],
  ["beihang-master-program-catalog-2026", "d81ff6c6f37f59c3f3e91cf17188199e45c2be04a6b5ae17b63064a2c31accc1"],
  ["beihang-doctoral-program-catalog-2026", "141ea785d77bbd1bc0b47bf1ff1866756bc4652f3623b1ecc21c215c77a9c3b8"],
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
if (evidence.size !== expected.size) throw new Error(`Missing locked Beihang evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);

const sourceRecord = (key: string, id: string) => {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};
const item = (sourceKey: string, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem =>
  ({ key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] });

const undergraduateSeed = JSON.parse(await readFile(resolve(root, "seeds/catalog.beihang-school-program-batch-01.approved.local.json"), "utf8")) as Seed;
const graduateSeed = JSON.parse(await readFile(resolve(root, "seeds/catalog.beihang-graduate-batch-01.approved.local.json"), "utf8")) as Seed;
function assertIntakes(seed: Seed, programs: Program[]) {
  for (const program of programs) {
    const intake = seed.programIntakes.find((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2026);
    if (!intake || intake.status !== "closed") throw new Error(`Missing closed Beihang Fall 2026 intake: ${program.slug}`);
  }
}

const undergraduateExact = undergraduateSeed.programs.filter((program) =>
  program.teachingLanguage !== "French"
  && !program.cscaRequirement?.includes("conflict on this English-taught route"),
);
const undergraduateExcluded = undergraduateSeed.programs.filter((program) => !undergraduateExact.includes(program));
if (undergraduateExact.length !== 67 || undergraduateExcluded.length !== 9) throw new Error("Unexpected Beihang undergraduate evidence split.");
assertIntakes(undergraduateSeed, undergraduateExact);

type UndergraduateGroup = { key: string; language: "Chinese" | "English"; tuition: string; csca: string; programs: Program[] };
const undergraduateGroupSpecs: Omit<UndergraduateGroup, "programs">[] = [
  { key: "chinese-stem-math-chemistry-25000", language: "Chinese", tuition: "RMB 25,000/year", csca: "CSCA in Chinese: Chinese (for Science Disciplines), Mathematics, Chemistry" },
  { key: "chinese-stem-math-physics-25000", language: "Chinese", tuition: "RMB 25,000/year", csca: "CSCA in Chinese: Chinese (for Science Disciplines), Mathematics, Physics" },
  { key: "chinese-stem-math-physics-chemistry-30000", language: "Chinese", tuition: "RMB 30,000/year", csca: "CSCA in Chinese: Chinese (for Science Disciplines), Mathematics, Physics, Chemistry" },
  { key: "chinese-humanities-math-25000", language: "Chinese", tuition: "RMB 25,000/year", csca: "CSCA in Chinese: Chinese (for Humanities Disciplines), Mathematics" },
  { key: "chinese-humanities-math-30000", language: "Chinese", tuition: "RMB 30,000/year", csca: "CSCA in Chinese: Chinese (for Humanities Disciplines), Mathematics" },
  { key: "english-math-physics-30000", language: "English", tuition: "RMB 30,000/year", csca: "CSCA in English: Mathematics, Physics" },
  { key: "english-math-physics-chemistry-30000", language: "English", tuition: "RMB 30,000/year", csca: "CSCA in English: Mathematics, Physics, Chemistry" },
  { key: "english-math-30000", language: "English", tuition: "RMB 30,000/year", csca: "CSCA in English: Mathematics" },
];
const undergraduateGroups: UndergraduateGroup[] = undergraduateGroupSpecs.map((spec) => ({
  ...spec,
  programs: undergraduateExact.filter((program) => program.teachingLanguage === spec.language
    && program.tuitionText === spec.tuition && program.cscaRequirement === spec.csca),
}));
const expectedUndergraduateCounts = [3, 40, 1, 11, 2, 8, 1, 1];
undergraduateGroups.forEach((group, index) => {
  if (group.programs.length !== expectedUndergraduateCounts[index]) throw new Error(`Unexpected Beihang undergraduate group: ${group.key}`);
});

const undergraduateCommon = (sourceKey: string): RequirementItem[] => [
  item(sourceKey, "citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a valid foreign passport and meet the applicable Chinese nationality-law and Ministry of Education Document No. 12 (2020) rules.", "document", "Section I, item 1"),
  item(sourceKey, "education_age_health", "education", "required", "International undergraduate applicants", "Have at least a high-school education, be physically and mentally healthy, demonstrate good conduct and goodwill toward China, and normally be 18 to 22 years old.", "school_review", "Section I, item 2"),
  item(sourceKey, "application_window", "application_policy", "required", "Fall 2026 applicants", "Complete the online application and all material corrections between November 1, 2025 and June 30, 2026.", "school_review", "Section II, application schedule"),
  item(sourceKey, "csca_deadline", "academic_results", "required", "Fall 2026 applicants", "Take the CSCA and upload the result to the Beihang application system no later than May 30, 2026.", "official_result", "Section III, step 1"),
  item(sourceKey, "online_application", "application_policy", "required", "Fall 2026 applicants", "Register with a personal email address in the Beihang international-student online application system and complete the online form.", "school_review", "Section III, step 2"),
  item(sourceKey, "passport", "identity", "required", "Fall 2026 applicants", "Upload the ordinary-passport information page; the passport must remain valid beyond March 1, 2027. Applicants in mainland China must also provide their current visa or residence-permit page.", "document", "Section III, step 3, item 1"),
  item(sourceKey, "diploma", "documents", "required", "Fall 2026 applicants", "Upload the high-school diploma; current students may submit an expected-graduation certificate but must provide the formal diploma before final admission and present the original at registration.", "document", "Section III, step 3, item 2"),
  item(sourceKey, "transcripts", "documents", "required", "Fall 2026 applicants", "Upload transcripts for all high-school courses.", "document", "Section III, step 3, item 3"),
  item(sourceKey, "physical_examination", "documents", "required", "Fall 2026 applicants", "Upload a Foreigner Physical Examination Form and blood-test report completed within six months, in Chinese or English, signed by a physician and stamped by the examining institution.", "document", "Section III, step 3, item 6"),
  item(sourceKey, "financial_guarantor", "documents", "required", "Fall 2026 applicants", "Upload the financial guarantor letter and evidence of the guarantor's financial capacity, showing either a bank deposit of at least four years' tuition or annual income of at least CNY 30,000.", "document", "Section III, step 3, items 7-8"),
  item(sourceKey, "birth_and_parent_nationality", "identity", "required", "Fall 2026 applicants", "Upload the applicant's birth certificate and documents proving both parents' nationality status when the applicant was born, including relevant passports, identity cards or permanent-residence records.", "document", "Section III, step 3, items 9-10"),
  item(sourceKey, "criminal_record", "documents", "required", "Fall 2026 applicants", "Upload a no-criminal-record certificate issued within six months; applicants currently in China must use a certificate from the local entry-exit authority.", "document", "Section III, step 3, item 11"),
  item(sourceKey, "integrity_commitment", "documents", "required", "Fall 2026 applicants", "Upload the integrity commitment letter; authenticity problems result in immediate cancellation of application eligibility.", "document", "Section III, step 3, item 12"),
  item(sourceKey, "guardian", "documents", "conditional", "Applicants under 18 on September 1, 2026", "Submit a notarized Guardian Guarantee whose guardian is normally an income-earning adult residing in the relevant campus city, Beijing or Hangzhou.", "document", "Section III, step 3, item 13"),
  item(sourceKey, "other_materials", "documents", "recommended", "Applicants with additional supporting evidence", "Upload relevant supplementary records such as award certificates, a résumé or a portfolio.", "document", "Section III, step 3, item 14"),
  item(sourceKey, "translations", "documents", "required", "Applicants with records not originally in Chinese or English", "Provide notarized translations for every original document not written in Chinese or English.", "document", "Section III, step 3, document note"),
  item(sourceKey, "art_portfolio", "documents", "conditional", "Applicants to art majors", "Provide the required painting portfolio.", "document", "Section III, step 3, art-major note"),
  item(sourceKey, "application_fee", "application_policy", "required", "Fall 2026 applicants", "Pay the non-refundable CNY 400 online application fee and upload the payment receipt before formally submitting the application.", "document", "Section III, step 4 and Section IV"),
  item(sourceKey, "insurance", "other", "required", "Enrolled undergraduates", "Purchase four academic years of comprehensive medical insurance at registration for a total published fee of CNY 3,200.", "document", "Section IV, insurance", "enrollment"),
  item(sourceKey, "accommodation", "other", "conditional", "Students seeking university accommodation", "Reserve accommodation in advance. Published double-room rates are CNY 30 per bed per day in Beijing and CNY 2,000 to 2,500 per academic year at the Hangzhou International Campus, excluding utilities and subject to actual assignment.", "document", "Section IV, accommodation", "preparation"),
  item(sourceKey, "scholarships", "application_policy", "recommended", "Applicants seeking scholarship support", "Review the published Chinese Government, Beihang and Beijing scholarship routes. Except for the Chinese Government Scholarship, submit the applicable scholarship materials together with the admission application by the published May 30, 2026 scholarship deadline.", "document", "Section V, scholarships"),
];

function undergraduateDocument(group: UndergraduateGroup) {
  const sourceKey = "undergraduate_guide";
  const languageRule = group.language === "Chinese"
    ? "Submit an HSK Level 5 result of at least 180 issued within two years."
    : "Submit IELTS 6.0 or above, TOEFL 90 or above, or official proof that all high-school courses were taught in English, issued within the published two-year window where applicable.";
  return parseRequirementDocument({
    schemaVersion: 1,
    language: "en",
    coverage: "complete",
    sources: [
      sourceRecord(sourceKey, "beihang-undergraduate-admissions-2026"),
      sourceRecord("csca_table", "beihang-undergraduate-csca-requirements-2026"),
    ],
    requirements: [
      ...undergraduateCommon(sourceKey),
      item(sourceKey, "language", "language", "required", `${group.language}-taught undergraduate applicants`, languageRule, "official_result", "Section I, item 3"),
      item("csca_table", "csca_subjects", "academic_results", "required", `${group.language}-taught applicants in this program group`, `Submit results for ${group.csca.replace(/^CSCA in (?:Chinese|English): /, "")}; take the subjects in ${group.language}.`, "official_result", "Official 2026 CSCA subject table, matching program rows"),
      item(sourceKey, "tuition", "application_policy", "required", "Enrolled applicants in this program group", `Pay annual tuition of ${group.tuition.replace("RMB ", "RMB ").replace("/year", " per year")}.`, "document", "Section IV, tuition table", "enrollment"),
    ],
  });
}

const graduateExact = graduateSeed.programs.filter((program) => program.teachingLanguage === "Chinese" || program.teachingLanguage === "English");
const graduateExcluded = graduateSeed.programs.filter((program) => !graduateExact.includes(program));
if (graduateExact.length !== 181 || graduateExcluded.length !== 7) throw new Error("Unexpected Beihang graduate evidence split.");
assertIntakes(graduateSeed, graduateExact);

type GraduateGroup = { key: string; degree: "Master" | "Doctoral"; language: "Chinese" | "English"; programs: Program[] };
const graduateGroups: GraduateGroup[] = [
  { key: "master-chinese", degree: "Master", language: "Chinese", programs: graduateExact.filter((p) => p.degreeLevel === "Master" && p.teachingLanguage === "Chinese") },
  { key: "master-english", degree: "Master", language: "English", programs: graduateExact.filter((p) => p.degreeLevel === "Master" && p.teachingLanguage === "English") },
  { key: "doctoral-chinese", degree: "Doctoral", language: "Chinese", programs: graduateExact.filter((p) => p.degreeLevel === "Doctoral" && p.teachingLanguage === "Chinese") },
  { key: "doctoral-english", degree: "Doctoral", language: "English", programs: graduateExact.filter((p) => p.degreeLevel === "Doctoral" && p.teachingLanguage === "English") },
];
const expectedGraduateCounts = [49, 46, 43, 43];
graduateGroups.forEach((group, index) => {
  if (group.programs.length !== expectedGraduateCounts[index]) throw new Error(`Unexpected Beihang graduate group: ${group.key}`);
});

function graduateDocument(group: GraduateGroup) {
  const sourceId = group.degree === "Master" ? "beihang-master-program-catalog-2026" : "beihang-doctoral-program-catalog-2026";
  const sourceKey = group.degree === "Master" ? "master_guide" : "doctoral_guide";
  const degreeRule = group.degree === "Master"
    ? "Hold a bachelor's degree and be under 35 years old."
    : "Hold a master's degree and be under 40 years old.";
  const languageRule = group.language === "Chinese"
    ? "Submit an HSK Level 5 score of at least 180 issued within two years; applicants whose previous education at a Chinese university was taught in Chinese may use the published exemption."
    : "Submit IELTS Academic 6.0, TOEFL 90 or Duolingo 105 issued within two years; a GRE score is recommended when available.";
  const tuition = group.degree === "Master" ? "CNY 35,000" : "CNY 42,000";
  return parseRequirementDocument({
    schemaVersion: 1,
    language: "en",
    coverage: "complete",
    sources: [sourceRecord(sourceKey, sourceId)],
    requirements: [
      item(sourceKey, "citizenship_health", "identity", "required", `${group.degree} applicants`, "Be a citizen of a country other than the People's Republic of China and be in good mental and physical health.", "document", "Eligibility section"),
      item(sourceKey, "degree_age", "education", "required", `${group.degree} applicants`, degreeRule, "document", "Eligibility section"),
      item(sourceKey, "language", "language", "required", `${group.language}-taught ${group.degree.toLowerCase()} applicants`, languageRule, "official_result", "Required Documents, item 5"),
      item(sourceKey, "application_window", "application_policy", "required", `Fall 2026 ${group.degree.toLowerCase()} applicants`, "Apply online from November 1, 2025 through June 30, 2026; scholarship routes may use separate deadlines.", "school_review", "Schedule section"),
      item(sourceKey, "registration", "application_policy", "required", "Admitted applicants", "Register in September 2026 on the specific date published in the admission notice.", "document", "Schedule section", "enrollment"),
      item(sourceKey, "online_application", "application_policy", "required", `${group.degree} applicants`, "Apply through the Beihang international-student online application system and upload every required document.", "school_review", "Application Procedures, step 1"),
      item(sourceKey, "application_form", "documents", "required", `${group.degree} applicants`, `Upload the ${group.degree} Program application form generated by the online system.`, "document", "Required Documents, item 1"),
      item(sourceKey, "passport", "identity", "required", `${group.degree} applicants`, "Upload the ordinary-passport information page; the passport must remain valid beyond September 2026.", "document", "Required Documents, item 2"),
      item(sourceKey, "diploma", "documents", "required", `${group.degree} applicants`, "Upload a notarized highest diploma; expected graduates may submit official student-status evidence showing the expected graduation date.", "document", "Required Documents, item 3"),
      item(sourceKey, "transcripts", "documents", "required", `${group.degree} applicants`, "Upload sealed academic transcripts covering study from the undergraduate stage onward.", "document", "Required Documents, item 4"),
      item(sourceKey, "supervisor_acceptance", "documents", "required", `${group.degree} applicants`, `Submit the Beihang supervisor acceptance letter${group.degree === "Master" ? "; the guide states that all master's applicants should provide it in principle" : ""}.`, "school_review", "Required Documents, item 6"),
      item(sourceKey, "study_plan", "documents", "required", `${group.degree} applicants`, "Submit a study plan written in Chinese or English containing more than 1,000 characters or words using the published form.", "document", "Required Documents, item 7"),
      item(sourceKey, "recommendations", "documents", "required", `${group.degree} applicants`, "Submit two Chinese- or English-language recommendation letters from professors or associate professors, including a comprehensive evaluation.", "document", "Required Documents, item 8"),
      item(sourceKey, "physical_examination", "documents", "required", `${group.degree} applicants`, "Submit a complete Foreigner Physical Examination Form valid for six months with the required final opinion, physician signature, hospital stamp and sealed photograph.", "document", "Required Documents, item 9"),
      item(sourceKey, "criminal_record", "documents", "required", `${group.degree} applicants`, "Submit a valid no-criminal-record certificate issued by the local public-security authority, normally within six months before application.", "document", "Required Documents, item 10"),
      item(sourceKey, "financial_guarantee", "documents", "conditional", "Self-supported applicants", "Submit the applicant's financial-guarantor certificate and bank statement using the published template.", "document", "Required Documents, item 11"),
      item(sourceKey, "resume", "documents", "required", `${group.degree} applicants`, "Submit a résumé giving a chronological account of academic or professional experience from senior high school to the present.", "document", "Required Documents, item 12"),
      item(sourceKey, "integrity_commitment", "documents", "required", `${group.degree} applicants`, "Submit the integrity commitment letter using the published template.", "document", "Required Documents, item 13"),
      item(sourceKey, "fee_receipt", "documents", "required", `${group.degree} applicants`, "Upload proof of application-fee payment showing the applicant's name and passport information.", "document", "Required Documents, item 14"),
      item(sourceKey, "document_list", "documents", "required", `${group.degree} applicants`, "Submit the published list-of-application-documents template and any other document Beihang requires.", "document", "Required Documents, items 15-16"),
      item(sourceKey, "translation_authenticity", "documents", "required", `${group.degree} applicants`, "Use Chinese or English documents or attach notarized Chinese or English translations, and ensure every uploaded record is clear, authentic and valid. Hard copies are not required for application.", "document", "Required Documents, notices"),
      item(sourceKey, "application_fee", "application_policy", "required", `${group.degree} applicants`, "Pay the non-refundable CNY 400 application fee; document review begins only after the payment receipt is submitted.", "document", "Required Documents notice and Fees section"),
      item(sourceKey, "tuition", "application_policy", "required", `Enrolled ${group.degree.toLowerCase()} students`, `Pay annual tuition of ${tuition}.`, "document", "Fees section", "enrollment"),
      item(sourceKey, "insurance", "other", "required", "Enrolled students", "Pay CNY 800 per year for comprehensive medical and accident insurance and purchase it at registration.", "document", "Fees section", "enrollment"),
      item(sourceKey, "accommodation", "other", "conditional", "Students seeking university accommodation", "Apply for a double-room bed in advance. Published rates are CNY 30 per day per bed at Beijing campuses and CNY 2,000 per year per bed at the Hangzhou International Campus, excluding utilities and subject to actual assignment.", "document", "Accommodation section", "preparation"),
      item(sourceKey, "scholarships", "application_policy", "recommended", "Applicants seeking scholarship support", "Review the separately published Chinese Government, Beijing Government and Beihang foreign-student scholarship routes and their own deadlines.", "document", "Scholarships section"),
    ],
  });
}

const undergraduateTemplates = undergraduateGroups.map((group) => ({
  key: `beihang-undergraduate-${group.key}-fall-2026`,
  schoolSlug: "beihang-university",
  cycle: "fall-2026",
  targetProgramSlugs: group.programs.map((program) => program.slug),
  targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window."],
  document: undergraduateDocument(group),
}));
const graduateTemplates = graduateGroups.map((group) => ({
  key: `beihang-${group.key}-fall-2026`,
  schoolSlug: "beihang-university",
  cycle: "fall-2026",
  targetProgramSlugs: group.programs.map((program) => program.slug),
  targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window."],
  document: graduateDocument(group),
}));
const templates = [...undergraduateTemplates, ...graduateTemplates];
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete official-source Beihang Fall 2026 requirements for exact undergraduate and Chinese/English graduate routes.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.length,
    blockedTemplateCount: 0,
    targetedProgramCount: undergraduateExact.length + graduateExact.length,
    targetedIntakeCount: undergraduateExact.length + graduateExact.length,
    excludedProgramCount: undergraduateExcluded.length + graduateExcluded.length,
    requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0),
  },
  exclusions: {
    undergraduate: undergraduateExcluded.map((program) => ({ programSlug: program.slug, reason: program.teachingLanguage === "French"
      ? "The official 2026 CSCA table does not publish a subject combination or separate tuition for this French-taught route."
      : "The official undergraduate catalog and linked CSCA table conflict on this English-taught route." })),
    graduate: graduateExcluded.map((program) => ({ programSlug: program.slug,
      reason: "The reviewed graduate guide does not publish a language-evidence rule for this French-, German- or Russian-taught route." })),
  },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
