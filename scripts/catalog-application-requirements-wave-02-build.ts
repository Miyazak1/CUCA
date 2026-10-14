import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-02.draft.json");

type ManifestSource = { id: string; label: string; url: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; teachingLanguage?: string; cscaSubjects?: string[] };
type Intake = { programSlug: string; intakeTerm: string; intakeYear: number };
type DraftTemplate = {
  key: string;
  schoolSlug: string;
  cycle: string;
  targetProgramSlugs: string[];
  targetIntake: { term: "Fall"; year: 2026 };
  targetBindingStatus: "ready";
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

const [qduSource, qduMbbsSource, sisuSource, tjfsuSource, qduSeed, sisuSeed, tjfsuSeed] = await Promise.all([
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-qdu-international-undergraduate-guide-pdf-2026/manifest.json",
    "qdu-international-undergraduate-guide-pdf-2026",
    "28277e2c56f520c788f90025d18b2dfcf372f889b15c9b4e66910220e221c581",
  ),
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-qdu-mbbs-guide-pdf-2026/manifest.json",
    "qdu-mbbs-guide-pdf-2026",
    "ebee719595a3f12a3ad005592f371434f1dd9bb7b9e3f802b72ea3809b62da6c",
  ),
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-sisu-international-undergraduate-admissions-2026-2027/manifest.json",
    "sisu-international-undergraduate-admissions-2026-2027",
    "ef9fddfe6d355d2c4fc80826aad101006c4b990251ac94826ec8842ba9c827e6",
  ),
  sourceFromManifest(
    "work/catalog-official/refresh-20261014-tjfsu-international-undergraduate-admissions-2026/manifest.json",
    "tjfsu-international-undergraduate-admissions-2026",
    "5897ff767d97fb6df0452ba42c094be43817d0caf739b5ad01dfb1ba50bcb4c5",
  ),
  json("seeds/catalog.qdu-complete-batch-01.draft.json"),
  json("seeds/catalog.sisu-complete-batch-01.draft.json"),
  json("seeds/catalog.tjfsu-complete-batch-01.draft.json"),
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

function document(sourceKey: string, row: ManifestSource, requirements: RequirementItem[]): RequirementDocument {
  return parseRequirementDocument({
    schemaVersion: 1,
    language: "en",
    coverage: "partial",
    sources: [{ key: sourceKey, url: row.url, title: row.label, capturedAt: row.fetchedAt, contentSha256: row.sha256 }],
    requirements,
  });
}

function assertFall2026Coverage(seed: { programIntakes: Intake[] }, slugs: string[], key: string) {
  const intakeSlugs = new Set(seed.programIntakes.filter((row) => row.intakeTerm === "Fall" && row.intakeYear === 2026).map((row) => row.programSlug));
  const missing = slugs.filter((slug) => !intakeSlugs.has(slug));
  if (missing.length) throw new Error(`${key} is missing Fall 2026 intakes: ${missing.join(", ")}`);
}

function qduCommon(sourceKey: string, appliesTo: string): RequirementItem[] {
  return [
    requirement("citizenship_passport", "identity", "required", appliesTo, "Be a non-Chinese citizen with a valid ordinary passport. Applicants with specified Chinese-origin circumstances must provide the additional nationality and travel-history evidence described by the university.", "document", sourceKey, "Page 2, Application Eligibility, item 1"),
    requirement("health_conduct_age", "identity", "required", appliesTo, "Be under age 25, physically and psychologically healthy, have no criminal record, be friendly to China, and comply with Chinese law and university rules.", "self_report", sourceKey, "Page 2, Application Eligibility, item 2"),
    requirement("high_school", "education", "required", appliesTo, "Have graduated from high school.", "document", sourceKey, "Page 3, Application Eligibility, item 3"),
    requirement("application_form", "documents", "required", appliesTo, "Complete the Qingdao University online degree-student application form.", "document", sourceKey, "Page 3, Application Procedure, item 1"),
    requirement("passport_copy", "identity", "required", appliesTo, "Submit the passport information page. The guide requires the passport to remain valid after December 2026.", "document", sourceKey, "Page 3, Application Procedure, item 2"),
    requirement("diploma", "education", "required", appliesTo, "Submit the notarized highest diploma. Prospective graduates may submit official expected-graduation or student-status proof and must provide the diploma after admission.", "document", sourceKey, "Page 3, Application Procedure, item 3"),
    requirement("transcripts", "academic_results", "required", appliesTo, "Submit academic transcripts from high school through the most recent semester, issued and sealed by the responsible school office; notarized translation is required when applicable.", "document", sourceKey, "Page 4, Application Procedure, item 4"),
    requirement("resume_commitment", "documents", "required", appliesTo, "Submit a resume and the university's Commitment of Application.", "document", sourceKey, "Page 4, Application Procedure, item 5"),
    requirement("work_certificate", "documents", "conditional", "Applicants who are employed", "Submit a work certificate.", "document", sourceKey, "Page 4, Application Procedure, item 6"),
    requirement("financial_guarantee", "documents", "required", appliesTo, "Submit the Financial Guarantee Statement and the sponsor's passport identity page or other accepted identity proof.", "document", sourceKey, "Page 4, Application Procedure, item 10"),
    requirement("physical_exam", "documents", "required", appliesTo, "Submit the Foreigner Physical Examination Form completed in English. The result is valid for six months.", "document", sourceKey, "Page 4, Application Procedure, item 11"),
    requirement("non_criminal_record", "documents", "required", appliesTo, "Submit a certificate of no criminal record issued within six months before application submission.", "document", sourceKey, "Pages 4-5, Application Procedure, item 12"),
    requirement("guardian_under_18", "documents", "conditional", "Applicants under 18", "Submit the university's China-based guardian authorization and guarantee documents.", "document", sourceKey, "Page 5, Application Procedure, item 13"),
    requirement("deadline", "application_policy", "required", appliesTo, "Submit before May 31, 2026. Scholarship applicants must also follow the applicable scholarship deadline.", "document", sourceKey, "Page 3, Application time"),
    requirement("application_fee", "application_policy", "required", appliesTo, "Pay the RMB 400 application fee after the university's initial review. Payment-account details are intentionally excluded.", "document", sourceKey, "Page 5, Fees Structure and page 6, Materials Review"),
  ];
}

function sisuCommon(sourceKey: string, appliesTo: string): RequirementItem[] {
  return [
    requirement("citizenship_health", "identity", "required", appliesTo, "Be a non-Chinese citizen in good physical and mental health.", "self_report", sourceKey, "Heading '一、招生对象及申请条件', item 1"),
    requirement("education_age", "education", "required", appliesTo, "Hold a high-school education or above, have strong academic results, and be age 18-45.", "document", sourceKey, "Heading '一、招生对象及申请条件', item 2"),
    requirement("passport", "identity", "required", appliesTo, "Submit the passport information page; the page states validity must extend beyond the expected September 2030 completion date.", "document", sourceKey, "Heading '六、申请材料', item 1"),
    requirement("diploma", "education", "required", appliesTo, "Submit a notarized highest diploma. Current students may submit official expected-graduation or enrollment proof; notarized Chinese or English translations are required for other languages.", "document", sourceKey, "Heading '六、申请材料', item 2"),
    requirement("transcripts", "academic_results", "required", appliesTo, "Submit transcripts from high school through the most recent semester, issued and stamped by the school; notarized translation is required when applicable.", "document", sourceKey, "Heading '六、申请材料', item 3"),
    requirement("hsk", "language", "required", appliesTo, "Submit a valid HSK report meeting the selected Chinese-taught program's level requirement.", "official_result", sourceKey, "Heading '六、申请材料', item 4"),
    requirement("study_plan", "documents", "required", appliesTo, "Submit a Chinese- or English-language study plan of more than 1,000 Chinese characters or words as applicable.", "document", sourceKey, "Heading '六、申请材料', item 6"),
    requirement("recommendation", "documents", "required", appliesTo, "Submit a Chinese- or English-language recommendation letter from the high school, including the recommender's institution, title, position and contact information.", "document", sourceKey, "Heading '六、申请材料', item 7"),
    requirement("guardian_under_18", "documents", "conditional", "Applicants under 18", "Submit legal documents for a China-based guardian.", "document", sourceKey, "Heading '六、申请材料', item 8"),
    requirement("physical_exam", "documents", "required", appliesTo, "Submit a complete Foreigner Physical Examination Form. The result is valid for six months.", "document", sourceKey, "Heading '六、申请材料', item 9"),
    requirement("photo", "documents", "required", appliesTo, "Submit a recent bareheaded identification photograph.", "document", sourceKey, "Heading '六、申请材料', item 10"),
    requirement("non_criminal_record", "documents", "required", appliesTo, "Submit a valid certificate of no criminal record, normally issued within six months before application; notarized translation is required when applicable.", "document", sourceKey, "Heading '六、申请材料', item 11"),
    requirement("deadline", "application_policy", "required", appliesTo, "For self-funded Fall 2026 admission, apply from January 1 through May 31, 2026.", "document", sourceKey, "Heading '五、申请流程', self-funded row in application-time table"),
    requirement("application_fee", "application_policy", "required", appliesTo, "Pay the RMB 800 application fee.", "document", sourceKey, "Heading '三、费用标准', item 2"),
  ];
}

function tjfsuCommon(sourceKey: string, appliesTo: string): RequirementItem[] {
  return [
    requirement("citizenship_age", "identity", "required", appliesTo, "Be a non-Chinese citizen age 18-35 and satisfy the Ministry of Education nationality rules referenced by the university.", "document", sourceKey, "Heading '二、申请资格', item 1"),
    requirement("health_conduct", "identity", "required", appliesTo, "Be of good conduct and physical and mental health, and comply with Chinese law and university rules.", "self_report", sourceKey, "Heading '二、申请资格', item 2"),
    requirement("high_school", "education", "required", appliesTo, "Hold a high-school diploma or equivalent qualification.", "document", sourceKey, "Heading '二、申请资格', item 3"),
    requirement("passport", "identity", "required", appliesTo, "Submit the passport information page with validity after March 31, 2027. Applicants with the specified Chinese-origin circumstances must provide the additional nationality and travel-history evidence listed by the university.", "document", sourceKey, "Heading '六、申请材料', item 1"),
    requirement("diploma", "education", "required", appliesTo, "Submit the high-school diploma. Current graduating students may submit official enrollment proof.", "document", sourceKey, "Heading '六、申请材料', item 2"),
    requirement("transcripts", "academic_results", "required", appliesTo, "Submit complete high-school transcripts.", "document", sourceKey, "Heading '六、申请材料', item 3"),
    requirement("physical_exam", "documents", "required", appliesTo, "Submit a scanned Foreigner Physical Examination Record completed in English. The result is valid for six months.", "document", sourceKey, "Heading '六、申请材料', item 6"),
    requirement("non_criminal_record", "documents", "required", appliesTo, "Submit a certificate of no criminal record issued within six months before the application date.", "document", sourceKey, "Heading '六、申请材料', item 7"),
    requirement("deposit_certificate", "documents", "required", appliesTo, "Submit a bank-issued deposit certificate showing at least RMB 40,000 in the applicant's or financial guarantor's name. No bank-account details are collected in this dataset.", "document", sourceKey, "Heading '六、申请材料', item 8"),
    requirement("guardian_under_18", "documents", "conditional", "Applicants still under 18 on September 1, 2026", "Submit legal documents for a Tianjin-based guardian.", "document", sourceKey, "Heading '六、申请材料', item 9"),
    requirement("translations", "documents", "conditional", "Documents not issued in Chinese or English", "Attach a notarized Chinese or English translation.", "document", sourceKey, "Notes below heading '六、申请材料', item 1"),
    requirement("deadline", "application_policy", "required", appliesTo, "Submit by June 30, 2026.", "document", sourceKey, "Heading '三、申请截止时间'"),
    requirement("application_fee", "application_policy", "required", appliesTo, "Pay the non-refundable RMB 500 application fee after the university's review process reaches the payment step.", "document", sourceKey, "Heading '五、申请方式', steps 2-5; heading '九、费用', item 1 and refund note"),
  ];
}

const qduPrograms = qduSeed.programs as Program[];
const sisuPrograms = sisuSeed.programs as Program[];
const tjfsuPrograms = tjfsuSeed.programs as Program[];
const qduChineseLiterature = ["qingdao-university-chinese-language-and-literature"];
const qduDual = qduPrograms.filter((row) => row.slug.includes("dual-degree")).map((row) => row.slug).sort();
const qduMbbs = ["qingdao-university-mbbs-program-in-english"];
const sisuChineseLiterature = ["sichuan-international-studies-university-chinese-language-and-literature"];
const sisuOther = sisuPrograms.filter((row) => row.slug !== sisuChineseLiterature[0] && row.slug !== "sichuan-international-studies-university-chinese-language-study-2026-2027").map((row) => row.slug).sort();

const tjfsuGroups = new Map<string, string[]>();
for (const program of tjfsuPrograms) {
  const key = `${program.teachingLanguage}|${(program.cscaSubjects ?? []).join("+")}`;
  const group = tjfsuGroups.get(key) ?? [];
  group.push(program.slug);
  tjfsuGroups.set(key, group);
}

const template = (fields: Omit<DraftTemplate, "targetIntake" | "targetBindingStatus" | "reviewStatus" | "fieldAssessment">): DraftTemplate => ({
  ...fields,
  targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit" },
});

const templates: DraftTemplate[] = [
  template({
    key: "qdu-chinese-language-literature-2026",
    schoolSlug: "qingdao-university",
    cycle: "2026",
    targetProgramSlugs: qduChineseLiterature,
    unresolvedNotes: ["Publication still requires the requirement-review workflow; this draft does not authorize a database write."],
    document: document("qdu_undergraduate", qduSource, [
      ...qduCommon("qdu_undergraduate", "2026 Chinese Language and Literature applicants"),
      requirement("hsk_hskk", "language", "required", "Chinese Language and Literature applicants", "Provide HSK Level 4 with at least 210 and HSKK Intermediate with at least 60.", "official_result", "qdu_undergraduate", "Page 1, Chinese Language and Literature program block"),
      requirement("csca_math", "academic_results", "required", "Chinese Language and Literature applicants", "Submit a valid CSCA Mathematics result.", "official_result", "qdu_undergraduate", "Page 1, Chinese Language and Literature program block; page 4, application item 9"),
    ]),
  }),
  template({
    key: "qdu-chinese-dual-degree-2026",
    schoolSlug: "qingdao-university",
    cycle: "2026",
    targetProgramSlugs: qduDual,
    unresolvedNotes: ["Publication still requires the requirement-review workflow; this draft does not authorize a database write."],
    document: document("qdu_undergraduate", qduSource, [
      ...qduCommon("qdu_undergraduate", "2026 Chinese-language dual-degree applicants"),
      requirement("hsk", "language", "required", "Chinese-language dual-degree applicants", "Provide HSK Level 4 with at least 180.", "official_result", "qdu_undergraduate", "Pages 1-2, dual-degree program block"),
      requirement("csca_chinese_math", "academic_results", "required", "Chinese-language dual-degree applicants", "Submit valid CSCA Chinese for Humanities and Mathematics results.", "official_result", "qdu_undergraduate", "Pages 1-2, dual-degree program block; page 4, application item 9"),
    ]),
  }),
  template({
    key: "qdu-mbbs-2026",
    schoolSlug: "qingdao-university",
    cycle: "2026",
    targetProgramSlugs: qduMbbs,
    unresolvedNotes: ["The English guide does not state one universal numeric English-test threshold; school records or a standardized English certificate are accepted according to the published rule."],
    document: document("qdu_mbbs", qduMbbsSource, [
      requirement("citizenship_age", "identity", "required", "2026 MBBS applicants", "Be a non-Chinese citizen age 18 or above with a valid passport. Applicants with specified Chinese-origin circumstances must provide the additional nationality evidence described by the university.", "document", "qdu_mbbs", "Page 1, Application Eligibility, item 1"),
      requirement("health_conduct", "identity", "required", "2026 MBBS applicants", "Be physically and psychologically healthy, have no criminal record, be friendly to China, and comply with Chinese law.", "self_report", "qdu_mbbs", "Page 2, Application Eligibility, item 2"),
      requirement("school_results", "academic_results", "required", "2026 MBBS applicants", "Have graduated from high school and provide official high-school and any higher-education transcripts. The average must exceed 75%, and every subject must exceed 60%.", "document", "qdu_mbbs", "Page 2, Application Eligibility, item 3"),
      requirement("csca_math_chemistry", "academic_results", "required", "2026 MBBS applicants", "Submit valid CSCA Mathematics and Chemistry results.", "official_result", "qdu_mbbs", "Page 2, Application Eligibility, item 3; page 3, Application Procedure, item 5"),
      requirement("english_result", "language", "required", "2026 MBBS applicants", "Applicants from non-English-speaking countries must submit English-learning records or a standardized English-proficiency certificate. Applicants educated fully in English may use the stated exemption but must submit official English-medium evidence.", "official_result", "qdu_mbbs", "Page 2, Application Eligibility, item 4; page 3, Application Procedure, item 6"),
      requirement("application_form", "documents", "required", "2026 MBBS applicants", "Complete the Qingdao University online degree-student application form.", "document", "qdu_mbbs", "Page 2, Application Procedure, item 1"),
      requirement("passport", "identity", "required", "2026 MBBS applicants", "Submit the ordinary-passport information page; the passport must remain valid after March 2027.", "document", "qdu_mbbs", "Page 2, Application Procedure, item 2"),
      requirement("diploma_transcript", "education", "required", "2026 MBBS applicants", "Submit the original or notarized highest qualification and transcript in Chinese or English. Expected 2026 graduates may first submit graduation or attendance proof and must later provide final academic credentials.", "document", "qdu_mbbs", "Page 3, Application Procedure, items 3-4"),
      requirement("financial_guarantee", "documents", "required", "2026 MBBS applicants", "Submit the Financial Guarantee Statement and the sponsor's passport identity page or accepted identity proof.", "document", "qdu_mbbs", "Page 3, Application Procedure, item 7"),
      requirement("physical_exam", "documents", "required", "2026 MBBS applicants", "Submit the Foreigner Physical Examination Form completed in English. The result is valid for six months.", "document", "qdu_mbbs", "Page 3, Application Procedure, item 8"),
      requirement("non_criminal_record", "documents", "required", "2026 MBBS applicants", "Submit a certificate of no criminal record issued within six months before application submission.", "document", "qdu_mbbs", "Page 3, Application Procedure, item 9"),
      requirement("deadline", "application_policy", "required", "2026 MBBS applicants", "Submit before September 4, 2026.", "document", "qdu_mbbs", "Page 2, Application time"),
      requirement("application_fee", "application_policy", "required", "2026 MBBS applicants", "Pay the non-refundable RMB 800 registration fee after initial review. Payment-account details are intentionally excluded.", "document", "qdu_mbbs", "Page 3, Fee structure; page 4, Evaluation Admission"),
    ]),
  }),
  template({
    key: "sisu-chinese-literature-2026",
    schoolSlug: "sichuan-international-studies-university",
    cycle: "2026-2027",
    targetProgramSlugs: sisuChineseLiterature,
    unresolvedNotes: ["The published HSK requirement is program-level and does not state one universal minimum score in this guide."],
    document: document("sisu_undergraduate", sisuSource, [
      ...sisuCommon("sisu_undergraduate", "Fall 2026 Chinese Language and Literature applicants"),
      requirement("csca_or_hsk_waiver", "academic_results", "required", "Chinese Language and Literature applicants", "Submit CSCA Chinese for Humanities and Mathematics results. A valid HSK Level 4 report may waive the CSCA Chinese for Humanities subject, but not Mathematics.", "official_result", "sisu_undergraduate", "Heading '一、招生对象及申请条件', CSCA subject rule; heading '六、申请材料', item 5"),
    ]),
  }),
  template({
    key: "sisu-undergraduate-general-2026",
    schoolSlug: "sichuan-international-studies-university",
    cycle: "2026-2027",
    targetProgramSlugs: sisuOther,
    unresolvedNotes: ["The published HSK requirement is program-level and does not state one universal minimum score in this guide."],
    document: document("sisu_undergraduate", sisuSource, [
      ...sisuCommon("sisu_undergraduate", "Fall 2026 international undergraduate applicants"),
      requirement("csca_chinese_math", "academic_results", "required", "Undergraduate applicants", "Submit valid CSCA Chinese for Humanities and Mathematics results before the application deadline.", "official_result", "sisu_undergraduate", "Heading '一、招生对象及申请条件', CSCA subject rule; heading '六、申请材料', item 5"),
    ]),
  }),
];

const tjfsuSpecs = [
  { key: "tjfsu-chinese-math-2026", group: "Chinese|Mathematics", label: "Chinese-taught Mathematics-only routes", csca: "Submit the CSCA Mathematics result using the Chinese-language test paper.", language: "Provide HSK Level 4 with at least 180, issued within the two-year validity period." },
  { key: "tjfsu-english-math-2026", group: "English|Mathematics", label: "English-taught Mathematics-only routes", csca: "Submit the CSCA Mathematics result using the English-language test paper.", language: "Provide IELTS 6.0, TOEFL 80, or an accepted equivalent English-proficiency certificate." },
  { key: "tjfsu-chinese-humanities-math-2026", group: "Chinese|Chinese for Humanities+Mathematics", label: "Chinese-taught humanities and Mathematics routes", csca: "Submit CSCA Chinese for Humanities and Mathematics results using Chinese-language test papers.", language: "Provide HSK Level 4 with at least 180, issued within the two-year validity period." },
  { key: "tjfsu-chinese-stem-2026", group: "Chinese|Chinese for STEM+Mathematics+Physics", label: "Chinese-taught STEM route", csca: "Submit CSCA Chinese for STEM, Mathematics and Physics results using Chinese-language test papers.", language: "Provide HSK Level 4 with at least 180, issued within the two-year validity period." },
];
for (const spec of tjfsuSpecs) {
  const targetProgramSlugs = (tjfsuGroups.get(spec.group) ?? []).sort();
  if (!targetProgramSlugs.length) throw new Error(`No TJFSU programs found for ${spec.group}.`);
  templates.push(template({
    key: spec.key,
    schoolSlug: "tianjin-foreign-studies-university",
    cycle: "2026",
    targetProgramSlugs,
    unresolvedNotes: ["Publication still requires the requirement-review workflow; this draft does not authorize a database write."],
    document: document("tjfsu_undergraduate", tjfsuSource, [
      ...tjfsuCommon("tjfsu_undergraduate", `Fall 2026 ${spec.label}`),
      requirement("csca_subjects", "academic_results", "required", spec.label, spec.csca, "official_result", "tjfsu_undergraduate", "Heading '四、招生专业及CSCA必考科目', applicable program row and notes"),
      requirement("language_result", "language", "required", spec.label, spec.language, "official_result", "tjfsu_undergraduate", "Heading '六、申请材料', item 5"),
    ]),
  }));
}

assertFall2026Coverage(qduSeed, [...qduChineseLiterature, ...qduDual, ...qduMbbs], "QDU");
assertFall2026Coverage(sisuSeed, [...sisuChineseLiterature, ...sisuOther], "SISU");
assertFall2026Coverage(tjfsuSeed, tjfsuPrograms.map((row) => row.slug), "TJFSU");
for (const row of templates) parseRequirementDocument(row.document);

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Source-located application requirements with verified Fall 2026 program-intake bindings.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.length,
    blockedTemplateCount: 0,
    targetedProgramCount: new Set(templates.flatMap((row) => row.targetProgramSlugs)).size,
    targetedIntakeCount: new Set(templates.flatMap((row) => row.targetProgramSlugs.map((slug) => `${slug}:Fall:2026`))).size,
    requirementItemCount: templates.reduce((sum, row) => sum + row.document.requirements.length, 0),
  },
  templates,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
