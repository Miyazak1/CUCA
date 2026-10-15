import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-01.draft.json");

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  fetchedAt: string;
  status: number;
  sha256: string;
};
type Program = { slug: string; degreeLevel: string };
type DraftTemplate = {
  key: string;
  schoolSlug: string;
  cycle: string;
  targetProgramSlugs: string[];
  targetIntake?: { term: "Fall"; year: 2026 };
  targetBindingStatus: "ready" | "blocked_missing_intake";
  reviewStatus: "unreviewed";
  fieldAssessment: Record<string, "explicit" | "derived" | "unresolved">;
  unresolvedNotes: string[];
  document: RequirementDocument;
};

async function json(path: string) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

async function sourceFromManifest(path: string, id: string, expectedSha256: string): Promise<ManifestSource> {
  const manifest = await json(path);
  const source = (manifest.sources as ManifestSource[]).find((row) => row.id === id);
  if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error(`Evidence mismatch for ${id}.`);
  return source;
}

const [ahuSource, ahuCgsSource, uibeJointSource, uibeIndexSource, shuplSource, ahuSeed, uibeSeed, shuplSeed] = await Promise.all([
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-ahu-international-admissions-fees-and-application-current/manifest.json",
    "ahu-international-admissions-fees-and-application-current",
    "77e5a55b153c3764e84aebcae215c7ee13879479705c26181f76b82574cd8139",
  ),
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-ahu-cgs-university-program-brochure-2026-2027/manifest.json",
    "ahu-cgs-university-program-brochure-2026-2027",
    "e117a177d6140cee5df5e24dd21ee511cff583758ff67ea83affc76362724269",
  ),
  sourceFromManifest(
    "work/catalog-official/2026-10-15T06-03-38-163Z/manifest.json",
    "uibe-undergraduate-2026",
    "ba5b9827a856ad10df967b121ed510af186d7460d9b56291f84b0e27aa9aba06",
  ),
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-uibe-undergraduate-english-index/manifest.json",
    "uibe-undergraduate-english-index",
    "b77856a6ce97b5493fba22f07a8faa2248cfb843ff2d01ad9081ee716eaee2f2",
  ),
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-shupl-international-admissions-2026/manifest.json",
    "shupl-international-admissions-2026",
    "c369cca864ccdda2b6d061ff6af5aaee360496aecf54bc9bf69604bd4d14eb0c",
  ),
  json("seeds/catalog.ahu-programs-safe-new-batch-01.approved.local.json"),
  json("seeds/catalog.uibe-school-program-batch-01.approved.local.json"),
  json("seeds/catalog.shupl-complete-batch-01.draft.json"),
]);

function requirement(
  key: string,
  category: RequirementItem["category"],
  level: RequirementItem["level"],
  appliesTo: string,
  ruleText: string,
  evidenceType: RequirementItem["evidenceType"],
  sourceKey: string,
  locator: string,
): RequirementItem {
  return { key, category, stage: "submission", level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}

function source(sourceKey: string, row: ManifestSource) {
  return { key: sourceKey, url: row.url, title: row.label, capturedAt: row.fetchedAt, contentSha256: row.sha256 };
}

function document(sourceKey: string, row: ManifestSource, requirements: RequirementItem[], coverage: "partial" | "complete" = "partial"): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage, sources: [source(sourceKey, row)], requirements });
}

const ahuPrograms = ahuSeed.programs as Program[];
const uibePrograms = uibeSeed.programs as Program[];
const shuplPrograms = shuplSeed.programs as Program[];
const ahuTargets = (level: string) => ahuPrograms.filter((row) => row.degreeLevel.toLowerCase() === level.toLowerCase()).map((row) => row.slug).sort();
const uibeJointSlug = "uibe-international-economic-development-cooperation-polymer-materials-bachelor";
const uibeCommonSlugs = uibePrograms.map((row) => row.slug).filter((slug) => slug !== uibeJointSlug).sort();

const ahuCommon = (sourceKey: string, appliesTo: string): RequirementItem[] => [
  requirement("passport", "identity", "required", appliesTo, "Submit a copy of a valid passport.", "document", sourceKey, "Page 3-4, application-materials table, passport row"),
  requirement("physical_exam", "documents", "required", appliesTo, "Submit the Foreigner Physical Examination Form.", "document", sourceKey, "Page 3-4, application-materials table, physical-examination row"),
  requirement("non_criminal_record", "documents", "required", appliesTo, "Submit a certificate of no criminal record.", "document", sourceKey, "Page 3-4, application-materials table, non-criminal-record row"),
  requirement("financial_proof", "documents", "required", appliesTo, "Submit proof of sufficient financial support.", "document", sourceKey, "Page 3-4, application-materials table, financial-proof row"),
  requirement("photo", "documents", "required", appliesTo, "Submit a recent two-inch electronic identification photo.", "document", sourceKey, "Page 3-4, application-materials table, photo row"),
  requirement("guardian_under_18", "documents", "conditional", "Applicants under 18", "Submit notarized guardianship documentation and the China-based guardian's identification.", "document", sourceKey, "Page 4, notes below application-materials tables, under-18 rule"),
  requirement("application_fee", "application_policy", "required", appliesTo, "Pay the non-refundable RMB 400 application fee and retain the requested payment proof. Bank-account details are intentionally excluded from this dataset.", "document", sourceKey, "Page 3, fee table and payment note"),
];

const templates: DraftTemplate[] = [
  {
    key: "ahu-undergraduate-current",
    schoolSlug: "anhui-university",
    cycle: "current-cycle-unresolved",
    targetProgramSlugs: ahuTargets("Undergraduate"),
    targetBindingStatus: "blocked_missing_intake",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "unresolved", targetPrograms: "derived", requirements: "explicit" },
    unresolvedNotes: ["The brochure has a November 2025 last-modified date but does not state an admission year.", "The existing AHU seed has no program-intake rows, so these requirements cannot yet be published through the intake-scoped requirements model."],
    document: document("ahu_general", ahuSource, [
      requirement("application_form", "documents", "required", "International undergraduate applicants", "Submit the Anhui University international student application form.", "document", "ahu_general", "Page 3, undergraduate application-materials table, item 1"),
      requirement("high_school_records", "education", "required", "International undergraduate applicants", "Submit a notarized high-school diploma and academic transcript. Applicants who have not yet graduated may submit official expected-graduation proof.", "document", "ahu_general", "Page 3, undergraduate application-materials table, diploma and transcript row"),
      requirement("csca_score", "academic_results", "required", "International undergraduate applicants", "Submit a CSCA score report.", "official_result", "ahu_general", "Page 3, undergraduate application-materials table, CSCA row"),
      requirement("hsk4", "language", "conditional", "Applicants to Chinese-taught undergraduate programs", "Provide HSK Level 4 with a score of at least 200. The brochure states that Malaysian Chinese independent high-school UEC holders may be exempt.", "official_result", "ahu_general", "Page 3, undergraduate application-materials table, Chinese-language row"),
      ...ahuCommon("ahu_general", "International undergraduate applicants"),
    ]),
  },
  {
    key: "ahu-master-current",
    schoolSlug: "anhui-university",
    cycle: "current-cycle-unresolved",
    targetProgramSlugs: ahuTargets("Master"),
    targetBindingStatus: "blocked_missing_intake",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "unresolved", targetPrograms: "derived", requirements: "explicit" },
    unresolvedNotes: ["The brochure does not state an admission year.", "The existing AHU seed has no program-intake rows."],
    document: document("ahu_general", ahuSource, [
      requirement("application_form", "documents", "required", "International master's applicants", "Submit the Anhui University international student application form.", "document", "ahu_general", "Page 3, master's application-materials table, item 1"),
      requirement("bachelor_records", "education", "required", "International master's applicants", "Submit a notarized bachelor's degree certificate and transcript. Expected graduates may submit official expected-graduation proof.", "document", "ahu_general", "Page 3, master's application-materials table, diploma and transcript row"),
      requirement("study_plan", "documents", "required", "International master's applicants", "Submit a study plan of at least 500 words in Chinese or English.", "document", "ahu_general", "Page 3, master's application-materials table, study-plan row"),
      requirement("recommendations", "documents", "required", "International master's applicants", "Submit two recommendation letters from professors or associate professors.", "document", "ahu_general", "Page 3, master's application-materials table, recommendation row"),
      requirement("language_result", "language", "conditional", "International master's applicants according to teaching language", "For Chinese-taught study, provide HSK Level 5 with at least 180. For English-taught study, non-native English speakers must provide TOEFL 75, IELTS 6.0, or the stated equivalent route.", "official_result", "ahu_general", "Page 3, master's application-materials table, language row"),
      requirement("supervisor_acceptance", "documents", "required", "International master's applicants", "Submit the Anhui University international student supervisor acceptance letter.", "document", "ahu_general", "Page 3, master's application-materials table, supervisor-acceptance row"),
      ...ahuCommon("ahu_general", "International master's applicants"),
    ]),
  },
  {
    key: "ahu-doctoral-current",
    schoolSlug: "anhui-university",
    cycle: "current-cycle-unresolved",
    targetProgramSlugs: [],
    targetBindingStatus: "blocked_missing_intake",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "unresolved", targetPrograms: "unresolved", requirements: "explicit" },
    unresolvedNotes: ["The brochure does not state an admission year.", "No doctoral AHU program records exist in the current seed bundle."],
    document: document("ahu_general", ahuSource, [
      requirement("application_form", "documents", "required", "International doctoral applicants", "Submit the Anhui University international student application form.", "document", "ahu_general", "Page 4, doctoral application-materials table, item 1"),
      requirement("master_records", "education", "required", "International doctoral applicants", "Submit a notarized master's degree certificate and transcript. Expected graduates may submit official expected-graduation proof.", "document", "ahu_general", "Page 4, doctoral application-materials table, diploma and transcript row"),
      requirement("study_plan", "documents", "required", "International doctoral applicants", "Submit a study plan of at least 800 words in Chinese or English.", "document", "ahu_general", "Page 4, doctoral application-materials table, study-plan row"),
      requirement("recommendations", "documents", "required", "International doctoral applicants", "Submit two recommendation letters from professors or associate professors.", "document", "ahu_general", "Page 4, doctoral application-materials table, recommendation row"),
      requirement("language_result", "language", "conditional", "International doctoral applicants according to teaching language", "For Chinese-taught study, provide HSK Level 5 with at least 210. For English-taught study, provide TOEFL 75, IELTS 6.0, or the stated equivalent route.", "official_result", "ahu_general", "Page 4, doctoral application-materials table, language row"),
      requirement("supervisor_acceptance", "documents", "required", "International doctoral applicants", "Submit the Anhui University international student supervisor acceptance letter.", "document", "ahu_general", "Page 4, doctoral application-materials table, supervisor-acceptance row"),
      ...ahuCommon("ahu_general", "International doctoral applicants"),
    ]),
  },
  {
    key: "ahu-cgs-graduate-2026-2027",
    schoolSlug: "anhui-university",
    cycle: "2026-2027",
    targetProgramSlugs: ahuTargets("Master"),
    targetBindingStatus: "blocked_missing_intake",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "derived", requirements: "explicit" },
    unresolvedNotes: ["This template applies only to the Chinese Government Scholarship University Program, not to every self-funded graduate route.", "The existing AHU seed has no 2026-2027 intake rows to bind."],
    document: document("ahu_cgs", ahuCgsSource, [
      requirement("citizenship_health", "identity", "required", "2026-2027 AHU Chinese Government Scholarship applicants", "Be a non-Chinese citizen in good physical and mental health.", "self_report", "ahu_cgs", "Page 7, Eligibility"),
      requirement("age_degree_master", "education", "conditional", "Master's scholarship applicants", "Hold a bachelor's degree and be under 35 years old.", "document", "ahu_cgs", "Page 7, Eligibility, master's rule"),
      requirement("age_degree_doctoral", "education", "conditional", "Doctoral scholarship applicants", "Hold a master's degree and be under 40 years old.", "document", "ahu_cgs", "Page 7, Eligibility, doctoral rule"),
      requirement("language_result", "language", "conditional", "Applicants according to teaching language", "For Chinese-taught study, provide HSK Level 5 with at least 210. For English-taught study, provide TOEFL 75 or IELTS 6.0.", "official_result", "ahu_cgs", "Page 7, Eligibility, language rule"),
      requirement("passport", "identity", "required", "Scholarship applicants", "Submit a passport whose validity extends beyond September 2026.", "document", "ahu_cgs", "Page 8, Application Documents, passport row"),
      requirement("highest_degree_records", "education", "required", "Scholarship applicants", "Submit the notarized highest diploma and academic transcripts; expected graduates may submit official expected-graduation proof.", "document", "ahu_cgs", "Page 8, Application Documents, diploma and transcript rows"),
      requirement("supervisor_and_preadmission", "documents", "required", "Scholarship applicants", "Submit both an Anhui University supervisor acceptance letter and the university pre-admission notice required by the brochure.", "document", "ahu_cgs", "Page 8, Application Documents, acceptance and pre-admission rows"),
      requirement("study_plan", "documents", "required", "Scholarship applicants", "Submit a study or research plan longer than 1,000 words; doctoral plans must be signed by the intended supervisor.", "document", "ahu_cgs", "Page 8, Application Documents, study-plan row"),
      requirement("recommendations", "documents", "required", "Scholarship applicants", "Submit two recommendation letters from professors or associate professors.", "document", "ahu_cgs", "Page 8, Application Documents, recommendation row"),
      requirement("physical_exam", "documents", "required", "Scholarship applicants", "Submit a Foreigner Physical Examination Form valid within six months.", "document", "ahu_cgs", "Page 8, Application Documents, physical-examination row"),
      requirement("non_criminal_record", "documents", "required", "Scholarship applicants", "Submit a certificate of no criminal record issued within six months.", "document", "ahu_cgs", "Page 8, Application Documents, non-criminal-record row"),
      requirement("application_window", "application_policy", "required", "2026-2027 scholarship applicants", "Submit between January 15, 2026 at 08:00 and March 15, 2026 at 17:00, as stated in the brochure.", "document", "ahu_cgs", "Page 7, Application Window"),
    ]),
  },
  {
    key: "uibe-english-undergraduate-current",
    schoolSlug: "university-of-international-business-and-economics",
    cycle: "recurring-current-page",
    targetProgramSlugs: uibeCommonSlugs,
    targetBindingStatus: "blocked_missing_intake",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "derived", requirements: "explicit" },
    unresolvedNotes: ["The page states recurring annual application periods rather than a single intake year.", "Only the joint 2+2 program currently has an intake row in the seed bundle."],
    document: document("uibe_index", uibeIndexSource, [
      requirement("high_school_health", "education", "required", "Applicants to UIBE English-taught undergraduate programs", "Hold a high-school diploma and be in good health.", "document", "uibe_index", "Heading 'Application Requirements', item 1"),
      requirement("guardian_under_18", "documents", "conditional", "Applicants under 18", "Submit the notarized guardianship certificate required by UIBE.", "document", "uibe_index", "Heading 'Application Requirements', item 2"),
      requirement("application_form", "documents", "required", "Applicants", "Complete the UIBE online application form.", "document", "uibe_index", "Heading 'Application Materials', item 1"),
      requirement("school_records", "education", "required", "Applicants", "Submit a copy of the high-school graduation certificate and transcripts.", "document", "uibe_index", "Heading 'Application Materials', item 2"),
      requirement("guarantor_id", "identity", "required", "Applicants", "Submit a copy of the guarantor's passport or identity document.", "document", "uibe_index", "Heading 'Application Materials', item 3"),
      requirement("csca_math", "academic_results", "required", "Applicants", "Submit the CSCA certificate for Mathematics.", "official_result", "uibe_index", "Heading 'Application Materials', item 4"),
      requirement("passport", "identity", "required", "Applicants", "Submit a copy of the passport or other accepted identification.", "document", "uibe_index", "Heading 'Application Materials', item 5"),
      requirement("photos", "documents", "required", "Applicants", "Submit two recent passport photographs with white background, frontal view and no hat.", "document", "uibe_index", "Heading 'Application Materials', item 6"),
      requirement("english_result", "language", "required", "Applicants", "Submit TOEFL 86, IELTS 6.0, A Level BBC or above, an accepted equivalent result, or official proof that high-school instruction was fully in English.", "official_result", "uibe_index", "Heading 'Application Materials', item 7"),
      requirement("asset_certificate", "documents", "conditional", "Applicants when requested", "Submit an asset certificate showing funds sufficient to cover tuition.", "document", "uibe_index", "Heading 'Application Materials', item 8"),
      requirement("non_criminal_record", "documents", "required", "Applicants", "Submit a certificate of no criminal conviction.", "document", "uibe_index", "Heading 'Application Materials', item 9"),
      requirement("application_period", "application_policy", "required", "Applicants", "Use the recurring application periods stated by UIBE: October 20 to December 31 for spring entry, and March 20 to June 30 for fall entry.", "document", "uibe_index", "Heading 'Application Period'"),
      requirement("application_fee", "application_policy", "required", "Applicants", "Pay the non-refundable RMB 660 application fee.", "document", "uibe_index", "Fee section, application-fee row"),
    ]),
  },
  {
    key: "uibe-buct-joint-undergraduate-2026",
    schoolSlug: "university-of-international-business-and-economics",
    cycle: "2026",
    targetProgramSlugs: [uibeJointSlug],
    targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit" },
    unresolvedNotes: ["Publication still requires the repository's requirement-review workflow; this draft does not authorize a database write."],
    document: document("uibe_joint", uibeJointSource, [
      requirement("high_school", "education", "required", "Joint-program applicants", "Be a high-school graduate or above and meet university admission qualifications.", "document", "uibe_joint", "Heading 'Eligibility Requirements', paragraph 1"),
      requirement("citizenship_health", "identity", "required", "Joint-program applicants", "Be a non-Chinese citizen in good physical and mental health, hold a valid private passport, and agree to follow Chinese law and university regulations.", "document", "uibe_joint", "Heading 'Eligibility Requirements', paragraph 2"),
      requirement("age_guardian", "identity", "conditional", "Joint-program applicants", "Applicants must be age 18-25; applicants under 18 must provide guardian documents for Beijing.", "document", "uibe_joint", "Heading 'Eligibility Requirements', paragraph 3"),
      requirement("chinese_origin_policy", "application_policy", "conditional", "Applicants of Chinese origin", "Meet the Ministry of Education requirements referenced as Document No. 12 (2020).", "school_review", "uibe_joint", "Heading 'Eligibility Requirements', paragraph 4"),
      requirement("application_form", "documents", "required", "Joint-program applicants", "Submit either the UIBE or BUCT application form through the relevant official application portal.", "document", "uibe_joint", "Heading 'Application Documents', item 1"),
      requirement("materials_language", "documents", "required", "Joint-program applicants", "Submit all application materials in Chinese or English.", "document", "uibe_joint", "Heading 'Application Documents', introductory sentence"),
      requirement("cv_statement", "documents", "required", "Joint-program applicants", "Submit a curriculum vitae and personal statement.", "document", "uibe_joint", "Heading 'Application Documents', item 2"),
      requirement("passport_visas", "identity", "required", "Joint-program applicants", "Submit the passport photo page and Chinese visa pages when applicable.", "document", "uibe_joint", "Heading 'Application Documents', item 3"),
      requirement("school_records", "education", "required", "Joint-program applicants", "Submit a notarized high-school diploma and transcripts.", "document", "uibe_joint", "Heading 'Application Documents', item 4"),
      requirement("english_result", "language", "required", "Joint-program applicants", "Submit IELTS 6.0, TOEFL 85, or an accepted equivalent result.", "official_result", "uibe_joint", "Heading 'Application Documents', item 5"),
      requirement("csca_math_chemistry", "academic_results", "required", "Joint-program applicants", "Submit CSCA results for Mathematics and Chemistry.", "official_result", "uibe_joint", "Heading 'Application Documents', item 6"),
      requirement("physical_exam", "documents", "required", "Joint-program applicants", "Submit the Foreigner Physical Examination Form.", "document", "uibe_joint", "Heading 'Application Documents', item 7"),
      requirement("non_criminal_record", "documents", "required", "Joint-program applicants", "Submit a certificate of no criminal record.", "document", "uibe_joint", "Heading 'Application Documents', item 8"),
      requirement("deadline", "application_policy", "required", "2026 joint-program applicants", "Submit by June 30, 2026.", "document", "uibe_joint", "Heading 'Application & Admission Process', application-deadline line"),
      requirement("application_fee", "application_policy", "required", "Joint-program applicants", "Pay the RMB 660 application fee. Payment account details are intentionally excluded from this dataset.", "document", "uibe_joint", "Heading 'Fees', application-fee row"),
      requirement("comprehensive_interview", "application_policy", "required", "Joint-program applicants", "Complete the comprehensive interview after online application, fee payment and the CSCA test.", "school_review", "uibe_joint", "Heading 'Application & Admission Process', steps 1-6"),
      requirement("admission_documents", "application_policy", "required", "Applicants who pass the selection process", "Receive the pre-admission notice followed by the official admission letter and JW201 or JW202 visa form.", "school_review", "uibe_joint", "Heading 'Application & Admission Process', steps 7-8"),
      requirement("status_monitoring", "application_policy", "required", "Joint-program applicants", "Regularly check the registered email address and application portal for updates.", "school_review", "uibe_joint", "Heading 'Application & Admission Process', note after the application deadline"),
    ], "complete"),
  },
  {
    key: "shupl-international-2026",
    schoolSlug: "shanghai-university-of-political-science-and-law",
    cycle: "2026",
    targetProgramSlugs: shuplPrograms.map((row) => row.slug).sort(),
    targetBindingStatus: "blocked_missing_intake",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit" },
    unresolvedNotes: ["The official guide does not publish an exact general application deadline.", "The SHUPL seed has no program-intake rows, so the requirements cannot yet be published through the intake-scoped model."],
    document: document("shupl_2026", shuplSource, [
      requirement("age_education", "education", "required", "General international applicants", "Be age 18-30 and have at least a high-school-level education. Scholarship routes may impose separate conditions.", "document", "shupl_2026", "Heading '三、申请资格'"),
      requirement("csca_undergraduate", "academic_results", "conditional", "International undergraduate applicants", "Submit a valid CSCA score report. The linked subject attachment must be checked for program-specific subjects.", "official_result", "shupl_2026", "Heading '四、申请材料', CSCA row; heading '七、报名流程', step 1"),
      requirement("highest_degree", "education", "required", "Applicants", "Submit the highest diploma; documents not in Chinese or English must be translated and notarized.", "document", "shupl_2026", "Heading '四、申请材料', highest-diploma row"),
      requirement("transcript", "academic_results", "required", "Applicants", "Submit the transcript for the highest completed education; documents not in Chinese or English must be translated and notarized.", "document", "shupl_2026", "Heading '四、申请材料', transcript row"),
      requirement("financial_proof", "documents", "required", "Applicants", "Submit a financial guarantee letter or personal bank-deposit certificate. If using a guarantor, include the guarantor's signature and passport identity page.", "document", "shupl_2026", "Heading '四、申请材料', financial-guarantee row"),
      requirement("physical_exam", "documents", "required", "Applicants", "Submit a Foreigner Physical Examination Form issued within six months.", "document", "shupl_2026", "Heading '四、申请材料', physical-examination row"),
      requirement("passport_photo", "identity", "required", "Applicants", "Submit a passport copy and passport-style photograph.", "document", "shupl_2026", "Heading '四、申请材料', passport rows"),
      requirement("non_criminal_record", "documents", "required", "Applicants", "Submit a certificate of no criminal record issued within six months.", "document", "shupl_2026", "Heading '四、申请材料', non-criminal-record row"),
      requirement("hsk_certificate", "language", "conditional", "Applicants to Chinese-taught degree programs", "Submit the applicable HSK certificate. The general guide does not state a universal minimum score.", "official_result", "shupl_2026", "Heading '四、申请材料', Chinese-language certificate row"),
      requirement("study_plan", "documents", "conditional", "Undergraduate applicants when available and graduate applicants as required by route", "Submit a study or research plan; the guide marks it optional for undergraduate applicants.", "document", "shupl_2026", "Heading '四、申请材料', study-plan row"),
      requirement("recommendations", "documents", "conditional", "Master's applicants", "Submit two recommendation letters in Chinese or English from professors or associate professors. Undergraduate applicants may provide them when available.", "document", "shupl_2026", "Heading '四、申请材料', recommendation row"),
      requirement("china_status_documents", "documents", "conditional", "Applicants currently working or studying in China", "Submit current-study or departure proof and a copy of the temporary residence permit as applicable.", "document", "shupl_2026", "Heading '四、申请材料', China-status rows"),
      requirement("portrait_and_video", "documents", "required", "Applicants", "Submit the specified electronic identification photograph and a one-minute self-introduction video in Chinese for Chinese-taught programs or English for English-taught programs.", "document", "shupl_2026", "Heading '四、申请材料', photo and video rows"),
      requirement("application_fee", "application_policy", "required", "Applicants", "Pay the RMB 400 application fee. Payment account details are intentionally excluded from this dataset.", "document", "shupl_2026", "Heading '五、费用介绍', application-fee row"),
    ]),
  },
];

for (const template of templates) parseRequirementDocument(template.document);

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Source-located application-requirement extraction for later intake binding, review and publication.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.filter((row) => row.targetBindingStatus === "ready").length,
    blockedTemplateCount: templates.filter((row) => row.targetBindingStatus !== "ready").length,
    targetedProgramCount: new Set(templates.flatMap((row) => row.targetProgramSlugs)).size,
    requirementItemCount: templates.reduce((sum, row) => sum + row.document.requirements.length, 0),
  },
  templates,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
