import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-03.draft.json");
type ManifestSource = { id: string; label: string; url: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string };
type Intake = { programSlug: string; intakeTerm: string; intakeYear: number };
type Template = {
  key: string; schoolSlug: string; cycle: string; targetProgramSlugs: string[];
  targetIntake?: { term: "Fall"; year: 2026 };
  targetBindingStatus: "ready" | "blocked_missing_intake"; reviewStatus: "unreviewed";
  fieldAssessment: Record<string, "explicit" | "derived" | "unresolved">;
  unresolvedNotes: string[]; document: RequirementDocument;
};

async function json(path: string) { return JSON.parse(await readFile(resolve(root, path), "utf8")); }
const undergraduateManifest = await json("work/catalog-official/2026-10-15T07-36-24-897Z/manifest.json");
const masterManifest = await json("work/catalog-official/2026-10-15T07-43-44-631Z/manifest.json");
const doctoralManifest = await json("work/catalog-official/2026-10-15T07-43-46-681Z/manifest.json");
const source = (sourceManifest: { sources: ManifestSource[] }, id: string, digest: string): ManifestSource => {
  const row = sourceManifest.sources.find((item) => item.id === id);
  if (!row || row.status !== 200 || row.sha256 !== digest) throw new Error(`Evidence mismatch for ${id}.`);
  return row;
};
const undergraduateSource = source(undergraduateManifest, "scut-undergraduate-programs-2026", "1fb35db69bbaf7aabc8eab632c93ad58d4973fcac706bcf0288a8f2a7297c76c");
const masterSource = source(masterManifest, "scut-master-programs-2026", "9b1b436aa09b999144bb3e681930686ebf763aad01a983bd9dbf3aa5dc43a134");
const doctoralSource = source(doctoralManifest, "scut-doctoral-programs-2026", "4372600dad572786a2d55042fcd00c0a27c093ec6d41cd2ed6ceab9b6e498e04");
const undergraduateSeed = await json("seeds/catalog.scut-undergraduate-batch-01.approved.local.json") as { programs: Program[]; programIntakes: Intake[] };

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
function document(sourceKey: string, row: ManifestSource, requirements: RequirementItem[]): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "partial",
    sources: [{ key: sourceKey, url: row.url, title: row.label, capturedAt: row.fetchedAt, contentSha256: row.sha256 }], requirements });
}

const undergraduateSlugs = undergraduateSeed.programs.map((row) => row.slug).sort();
const fall2026 = new Set(undergraduateSeed.programIntakes.filter((row) => row.intakeTerm === "Fall" && row.intakeYear === 2026).map((row) => row.programSlug));
for (const slug of undergraduateSlugs) if (!fall2026.has(slug)) throw new Error(`Missing SCUT Fall 2026 intake: ${slug}`);

const undergraduateLanguageRules: RequirementItem[] = [
  item("language_chinese_science", "language", "conditional", "Chinese-medium Science and Engineering applicants", "Provide HSK Level 4 with at least 180 and the HSK Speaking Test at Intermediate Level.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 5(1), Science and Engineering bullet"),
  item("language_chinese_humanities", "language", "conditional", "Chinese-medium Liberal Arts, Economics and Management, Foreign Languages, Arts, Design, Architecture, or Sport Training applicants", "Provide HSK Level 5 with at least 180 and the HSK Speaking Test at Intermediate Level.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 5(1), humanities and related fields bullet"),
  item("language_chinese_tcsol", "language", "conditional", "Chinese-medium Teaching Chinese to Speakers of Other Languages applicants", "Provide HSK Level 4 with at least 180 and the HSK Speaking Test at Intermediate Level.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 5(1), TCSOL bullet"),
  item("language_english", "language", "conditional", "English-medium applicants from non-English-speaking countries", "Provide TOEFL iBT 68, IELTS 5.5, Duolingo English Test 100, or another equivalent English qualification accepted by SCUT.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 5(2)"),
  item("language_bilingual", "language", "conditional", "Bilingual-program applicants", "Meet the applicable Chinese-medium HSK and speaking-test threshold and provide TOEFL iBT 68, IELTS 5.5, Duolingo English Test 100, or another accepted equivalent English qualification.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 5(3)"),
  item("english_exemption", "language", "conditional", "Applicants seeking an English-certificate exemption", "Be a citizen of an English-speaking country and have obtained the highest qualification from an English-medium institution, with official proof from that institution.", "document", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 5(4)"),
];

const templates: Template[] = [
  {
    key: "scut-undergraduate-2026", schoolSlug: "south-china-university-of-technology", cycle: "2026",
    targetProgramSlugs: undergraduateSlugs, targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit" },
    unresolvedNotes: ["Program-specific teaching medium and professional-school deadline exceptions must still be checked before publication.", "This historical Fall 2026 binding is not eligible for a current-cycle application workflow."],
    document: document("scut_undergraduate", undergraduateSource, [
      item("citizenship_age", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen under 25 years old.", "document", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 1"),
      item("passport", "identity", "required", "International undergraduate applicants", "Submit the information page of a valid ordinary passport. Applicants currently in China must also submit the visa or residence-permit page.", "document", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 2"),
      item("csca", "academic_results", "required", "International undergraduate applicants", "Submit a China Scholastic Competency Assessment certificate. The page does not identify program-specific CSCA subjects.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 3"),
      item("high_school_records", "education", "required", "International undergraduate applicants", "Submit a high-school graduation certificate or equivalent and transcripts showing a good record. Applicants awaiting graduation may submit official pre-graduation or expected-graduation evidence.", "document", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 4"),
      item("final_high_school_records", "education", "conditional", "Applicants who applied before completing high school", "Provide the official graduation certificate and final transcripts before enrollment.", "document", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', item 4", "enrollment"),
      item("language_certificate_validity", "language", "required", "Applicants submitting a language-proficiency certificate", "Ensure the language-proficiency certificate is no more than two years old and remains valid at enrollment.", "official_result", "scut_undergraduate", "Heading 'ADMISSION REQUIREMENTS', language-proficiency introduction", "enrollment"),
      ...undergraduateLanguageRules,
      item("deadline", "application_policy", "required", "International undergraduate applicants", "The general deadline is June 30 each year; individual professional schools may use a different deadline.", "document", "scut_undergraduate", "Heading 'APPLICATION DEADLINE'"),
      item("application_portal", "application_policy", "required", "International undergraduate applicants", "Create an account in SCUT's application system, complete personal information, upload supporting documents and pay the application fee online.", "school_review", "scut_undergraduate", "Heading 'APPLICATION PROCEDURE'"),
      item("application_fee", "application_policy", "required", "International undergraduate applicants", "Pay the RMB 450 application fee online. Payment account details are intentionally excluded from this dataset.", "document", "scut_undergraduate", "Heading 'APPLICATION PROCEDURE', application-fee line"),
    ]),
  },
  {
    key: "scut-master-current", schoolSlug: "south-china-university-of-technology", cycle: "recurring-current-page",
    targetProgramSlugs: [], targetBindingStatus: "blocked_missing_intake", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "unresolved", requirements: "explicit" },
    unresolvedNotes: ["No SCUT master's program and intake bundle is available for exact binding; the rules remain a source-located template only."],
    document: document("scut_master", masterSource, [
      item("citizenship_age", "identity", "required", "International master's applicants", "Be a non-Chinese citizen under 35 years old.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 1"),
      item("passport", "identity", "required", "International master's applicants", "Submit the valid ordinary-passport information page and, if currently in China, the visa or residence-permit page.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 2"),
      item("bachelor_records", "education", "required", "International master's applicants", "Submit a bachelor's diploma and transcripts with a good record. Applicants awaiting graduation may submit official pre-graduation or expected-graduation evidence.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 3"),
      item("final_bachelor_records", "education", "conditional", "Applicants who applied before completing the bachelor's degree", "Provide the official bachelor's degree certificate and final transcripts before enrollment.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 3", "enrollment"),
      item("language_result", "language", "required", "Applicants according to the program's teaching medium and discipline", "Meet SCUT's published Chinese-, English-, or bilingual-medium threshold. Chinese thresholds range from HSK 4 score 180 to HSK 5 score 210 with HSKK; English thresholds include TOEFL iBT 80, IELTS 6.0, Duolingo 112, or accepted equivalents.", "official_result", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 4(1)-(3)"),
      item("language_certificate_validity", "language", "required", "Applicants submitting a language-proficiency certificate", "Ensure the language-proficiency certificate is no more than two years old and remains valid at enrollment.", "official_result", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 4 introduction", "enrollment"),
      item("english_exemption", "language", "conditional", "Applicants seeking an English-certificate exemption", "Be a citizen of an English-speaking country and hold the highest qualification from an English-medium institution, with official proof.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 4(4)"),
      item("physical_exam", "documents", "required", "International master's applicants", "Submit the original Foreigner Physical Examination Form in Chinese or English; the result is valid for one year.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 5"),
      item("recommendations", "documents", "required", "International master's applicants", "Submit two recommendation letters from professors or associate professors.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 6"),
      item("pre_acceptance", "documents", "conditional", "International master's applicants except MBA applicants", "Submit a pre-acceptance letter signed by an SCUT professor or associate professor.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 7"),
      item("study_plan", "documents", "required", "International master's applicants", "Submit a study or research plan in Chinese or English of at least 1,000 words.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 8"),
      item("portfolio", "documents", "conditional", "Music, architecture, or design applicants", "Submit the performance recording or portfolio specified by SCUT for the relevant discipline.", "document", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 9"),
      item("mba_experience", "education", "conditional", "MBA applicants", "Have at least three years of work experience after an undergraduate degree or at least two years after a postgraduate degree, and pass the MBA center evaluation.", "school_review", "scut_master", "Heading 'APPLICATION REQUIREMENTS', item 10"),
      item("deadline", "application_policy", "required", "International master's applicants", "The general application deadline is June 15 each year.", "document", "scut_master", "Heading 'APPLICATION DEADLINE'"),
      item("application_portal", "application_policy", "required", "International master's applicants", "Create an account in SCUT's application system, complete personal information and upload scanned supporting documents.", "school_review", "scut_master", "Heading 'APPLICATION PROCEDURE'"),
      item("application_fee", "application_policy", "required", "International master's applicants", "Pay the application fee online. The captured page does not publish the amount.", "school_review", "scut_master", "Heading 'APPLICATION PROCEDURE'"),
      item("electronic_admission_letter", "documents", "conditional", "Accepted applicants", "Receive an electronic Admission Letter from SCUT after acceptance.", "official_result", "scut_master", "Heading 'APPLICATION PROCEDURE'", "preparation"),
      item("translations", "documents", "conditional", "Documents not issued in Chinese or English", "Provide translations before submission.", "document", "scut_master", "Heading 'NOTES'"),
    ]),
  },
  {
    key: "scut-doctoral-current", schoolSlug: "south-china-university-of-technology", cycle: "recurring-current-page",
    targetProgramSlugs: [], targetBindingStatus: "blocked_missing_intake", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "unresolved", requirements: "explicit" },
    unresolvedNotes: ["No SCUT doctoral program and intake bundle is available for exact binding; the rules remain a source-located template only."],
    document: document("scut_doctoral", doctoralSource, [
      item("citizenship_age", "identity", "required", "International doctoral applicants", "Be a non-Chinese citizen under 40 years old.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 1"),
      item("passport", "identity", "required", "International doctoral applicants", "Submit the valid ordinary-passport information page and, if currently in China, the visa or residence-permit page.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 2"),
      item("master_records", "education", "required", "International doctoral applicants", "Submit a master's diploma and transcripts with a good record. Applicants awaiting graduation may submit official pre-graduation or expected-graduation evidence.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 3"),
      item("final_master_records", "education", "conditional", "Applicants who applied before completing the master's degree", "Provide the official master's degree certificate and final transcripts before enrollment.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 3", "enrollment"),
      item("language_result", "language", "required", "Applicants according to the program's teaching medium and discipline", "Meet SCUT's published Chinese-, English-, or bilingual-medium threshold. Chinese thresholds include HSK 4 or HSK 5 score 180 with HSKK depending on discipline; English thresholds include TOEFL iBT 80, IELTS 6.0, Duolingo 112, or accepted equivalents.", "official_result", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 4(1)-(3)"),
      item("language_certificate_validity", "language", "required", "Applicants submitting a language-proficiency certificate", "Ensure the language-proficiency certificate is no more than two years old and remains valid at enrollment.", "official_result", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 4 introduction", "enrollment"),
      item("english_exemption", "language", "conditional", "Applicants seeking an English-certificate exemption", "Be a citizen of an English-speaking country and hold the highest qualification from an English-medium institution, with official proof.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 4(4)"),
      item("physical_exam", "documents", "required", "International doctoral applicants", "Submit the original Foreigner Physical Examination Form in Chinese or English; the result is valid for one year.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 5"),
      item("recommendations", "documents", "required", "International doctoral applicants", "Submit two recommendation letters from professors or associate professors.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 6"),
      item("pre_acceptance", "documents", "required", "International doctoral applicants", "Submit a pre-acceptance letter signed by an SCUT professor or associate professor.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 7"),
      item("study_plan", "documents", "required", "International doctoral applicants", "Submit a study or research plan in Chinese or English of at least 1,000 words.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 8"),
      item("portfolio", "documents", "conditional", "Music, architecture, or design applicants", "Submit the performance recording or portfolio specified by SCUT for the relevant discipline.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 9"),
      item("research_abstracts", "documents", "required", "International doctoral applicants", "Submit abstracts of graduation theses or published papers.", "document", "scut_doctoral", "Heading 'APPLICATION REQUIREMENTS', item 10"),
      item("deadline", "application_policy", "required", "International doctoral applicants", "The general application deadline is June 15 each year.", "document", "scut_doctoral", "Heading 'APPLICATION DEADLINE'"),
      item("application_portal", "application_policy", "required", "International doctoral applicants", "Create an account in SCUT's application system, complete personal information and upload scanned supporting documents.", "school_review", "scut_doctoral", "Heading 'APPLICATION PROCEDURE'"),
      item("application_fee", "application_policy", "required", "International doctoral applicants", "Pay the application fee online. The captured page does not publish the amount.", "school_review", "scut_doctoral", "Heading 'APPLICATION PROCEDURE'"),
      item("electronic_admission_letter", "documents", "conditional", "Accepted applicants", "Receive an electronic Admission Letter from SCUT after acceptance.", "official_result", "scut_doctoral", "Heading 'APPLICATION PROCEDURE'", "preparation"),
      item("translations", "documents", "conditional", "Documents not issued in Chinese or English", "Provide translations before submission.", "document", "scut_doctoral", "Heading 'NOTES'"),
    ]),
  },
];

for (const template of templates) parseRequirementDocument(template.document);
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located SCUT degree application requirements with only exact existing intake bindings marked ready." },
  summary: { templateCount: templates.length, readyTemplateCount: 1, blockedTemplateCount: 2,
    targetedProgramCount: undergraduateSlugs.length, targetedIntakeCount: undergraduateSlugs.length,
    requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
