import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-31.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/xmu-complete-batch-01/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionText: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "xmu-undergraduate-admissions-2026": "700a45c5f482eec8f2ebde02a86bd208d709f29e0f97e641fe0e095fbaf9b569",
  "xmu-master-admissions-2026": "751f4548404c9a93f22d3566fd7b2c2e243793cd22240037447459e09c216b6e",
  "xmu-doctoral-admissions-2026": "ff4fb7dd0ac06b0cb0870528f7f65f01482ee642edb5f09e2092c0a9aabf9dcb",
} as const;
const sources = new Map<string, Source>();
for (const row of manifest.sources as Source[]) {
  if (row.id in expected && row.status === 200 && row.contentType === "text/html"
    && row.sha256 === expected[row.id as keyof typeof expected]) sources.set(row.id, row);
}
if (sources.size !== Object.keys(expected).length) throw new Error("XMU requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.xmu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 535 || seed.programIntakes.length !== 535) throw new Error("Unexpected XMU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing XMU Fall 2026 intake: ${program.slug}`);

type SourceId = keyof typeof expected;
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "guide", locator }] };
}
function sourceRecord(id: SourceId) {
  const source = sources.get(id)!;
  return { key: "guide", url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}

function undergraduateDocument(language: "Chinese" | "English", tuition: string, route: "general" | "mbbs" | "arts") {
  const chinese = language === "Chinese";
  const csca = chinese
    ? "Submit CSCA Mathematics and Professional Chinese; the guide exempts the Chinese-language major when HSK 4 or above is supplied. Applicants to science, engineering, agriculture and medicine also submit Physics and/or Chemistry. The test language follows the program medium."
    : route === "mbbs"
      ? "Submit CSCA Mathematics plus Physics and/or Chemistry in English; Professional Chinese is not required for this English-medium route."
      : "Submit CSCA Mathematics in English. Physics and/or Chemistry apply only to science, engineering, agriculture and medicine, so they are not listed as required for these English-medium arts routes.";
  const languageRule = chinese
    ? "For Chinese-medium study, humanities, economics, management, law and arts generally require HSK 5 with 210; science, engineering, medicine and physical education generally require HSK 4 with 210. A qualifying prior Chinese-medium education certificate may replace the HSK evidence under the guide."
    : "Submit TOEFL iBT 80, IELTS Academic 6.0, qualifying prior English-medium study evidence, or another XMU-recognized equivalent; applicants from countries where English is an official language are exempt.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("xmu-undergraduate-admissions-2026")], requirements: [
    item("citizenship_health", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen, physically and mentally healthy, friendly to China, and hold a valid regular foreign passport.", "document", "I. Eligibility - General Requirements"),
    item("education_age", "education", "required", "International undergraduate applicants", "Hold a high-school diploma or above and be 18 to 30 years old by September 1, 2026. Applicants under 18 must provide the required guardian documents.", "document", "I. Eligibility - General Requirements"),
    item("nationality_review", "identity", "conditional", "Applicants formerly holding Chinese nationality or born abroad to Chinese parents", "Meet the guide's nationality-document and overseas-residence rules, including the applicable four-year foreign-passport period and two years of actual overseas residence during the preceding four years.", "school_review", "I. Eligibility - Nationality requirements"),
    item("language", "language", "required", `${language}-medium undergraduate applicants`, languageRule, "official_result", "I. Eligibility - Language proficiency"),
    item("application_window", "application_policy", "required", "Self-funded Fall 2026 undergraduate applicants", "Apply online from December 1, 2025 through May 10, 2026. Scholarship application deadlines are earlier and follow the corresponding scholarship notice.", "document", "II. Application Timeline"),
    item("online_application", "application_policy", "required", "Fall 2026 undergraduate applicants", "Register in the XMU international student application system, complete the application, upload the required records and pay the application fee online.", "school_review", "III. Application Procedures"),
    item("passport_identity", "documents", "required", "Undergraduate applicants", "Submit the passport information page valid through at least October 31, 2026, birth certificate, and identity documents of both parents.", "document", "IV. Application Documents items 1-3"),
    item("diploma_transcript", "documents", "required", "Undergraduate applicants", "Submit the high-school diploma and complete high-school transcripts. Current students may submit expected-graduation proof but must present the final original diploma at registration.", "document", "IV. Application Documents item 4"),
    item("language_evidence", "documents", "required", `${language}-medium undergraduate applicants`, languageRule, "official_result", "IV. Application Documents item 5"),
    item("csca", "academic_results", "required", `${language}-medium undergraduate applicants`, csca, "official_result", "IV. Application Documents item 6 - CSCA"),
    item("recommendation", "documents", "required", "Undergraduate applicants", "Submit one recommendation letter.", "document", "IV. Application Documents item 7"),
    item("personal_statement", "documents", "required", "Undergraduate applicants", "Submit a personal statement of at least 800 words in the language of instruction.", "document", "IV. Application Documents item 8"),
    item("pre_acceptance", "documents", "recommended", "Undergraduate applicants", "A pre-acceptance letter from an XMU academic unit may be submitted when available.", "document", "IV. Application Documents item 9"),
    item("physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Form and its attachments, completed as required and valid for six months.", "document", "IV. Application Documents item 10"),
    item("financial_guarantee", "documents", "required", "Undergraduate applicants, including scholarship applicants", "Submit the financial guarantee statement and supporting financial records. Applying for a scholarship does not waive this document.", "document", "IV. Application Documents item 11"),
    item("criminal_record", "documents", "required", "Undergraduate applicants", "Submit a no-criminal-record certificate issued within six months before application.", "document", "IV. Application Documents item 12"),
    item("portfolio", "documents", "conditional", "Applicants to art-related programs", "Submit the portfolio required by the relevant program; other applicants may submit supporting awards or achievement evidence when available.", "document", "IV. Application Documents item 13"),
    item("translation_originals", "documents", "conditional", "Applicants whose records are not in Chinese or English", "Provide notarized Chinese or English translations. XMU may request original or supplementary records and materials are not returned.", "document", "IV. Application Documents - Notes"),
    item("selection", "academic_results", "required", "Applicants passing document review", "Undergo XMU's comprehensive qualification review and the admitting unit's assessment, which may include a remote interview or written examination.", "school_review", "VI. Admission and Selection"),
    item("application_fee", "application_policy", "required", "Undergraduate applicants", "Pay the non-refundable RMB 400 application fee.", "document", "VIII. Study Costs"),
    item("tuition", "application_policy", "required", `Enrolled ${language}-medium undergraduate students in this route`, `Pay annual tuition of ${tuition}.`, "document", "VIII. Study Costs", "enrollment"),
    item("insurance", "documents", "required", "Enrolled undergraduate students", "Purchase comprehensive medical insurance at RMB 800 per year.", "document", "VIII. Study Costs", "enrollment"),
    item("accommodation_living", "other", "conditional", "Enrolled students", "Budget for campus-dependent accommodation and living costs: published accommodation ranges include RMB 35-65/day at Siming, RMB 1,600-4,000/year at Xiang'an, and RMB 1,100-1,200/year at Zhangzhou; the guide estimates food at RMB 1,000-1,500/month.", "document", "VIII. Study Costs", "enrollment"),
  ] });
}

function graduateDocument(degree: "Master" | "Doctoral", language: "Chinese" | "English", tuition: string) {
  const master = degree === "Master";
  const languageRule = language === "Chinese"
    ? "For Chinese-medium study, humanities, economics, management, law and arts generally require HSK 5 with 210; science, engineering, medicine and physical education generally require HSK 4 with 210. A qualifying prior Chinese-medium education certificate may replace HSK evidence under the guide."
    : "Submit TOEFL iBT 80, IELTS Academic 6.0, qualifying prior English-medium study evidence, or another XMU-recognized equivalent; applicants from countries where English is an official language are exempt.";
  const sourceId: SourceId = master ? "xmu-master-admissions-2026" : "xmu-doctoral-admissions-2026";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord(sourceId)], requirements: [
    item("citizenship_health", "identity", "required", `${degree} applicants`, "Be a non-Chinese citizen, physically and mentally healthy, friendly to China, and hold a valid regular foreign passport.", "document", "I. Eligibility - General Requirements"),
    item("education_age", "education", "required", `${degree} applicants`, master ? "Hold a bachelor's degree or above and generally be under 45 years old by September 1, 2026." : "Hold a master's degree or above and generally be under 50 years old by September 1, 2026.", "document", "I. Eligibility - General Requirements"),
    item("nationality_review", "identity", "conditional", "Applicants formerly holding Chinese nationality or born abroad to Chinese parents", "Meet the guide's nationality-document and overseas-residence rules, including the applicable four-year foreign-passport period and two years of actual overseas residence during the preceding four years.", "school_review", "I. Eligibility - Nationality requirements"),
    item("language", "language", "required", `${language}-medium ${degree.toLowerCase()} applicants`, languageRule, "official_result", "I. Eligibility - Language proficiency"),
    item("application_window", "application_policy", "required", `Self-funded Fall 2026 ${degree.toLowerCase()} applicants`, "Apply online from December 1, 2025 through May 10, 2026. Scholarship application deadlines are earlier and follow the corresponding scholarship notice.", "document", "II. Application Timeline"),
    item("online_application", "application_policy", "required", `Fall 2026 ${degree.toLowerCase()} applicants`, "Register in the XMU international student application system, complete the application, upload the required records and pay the application fee online.", "school_review", "III. Application Procedures"),
    item("passport_identity", "documents", "required", `${degree} applicants`, "Submit the passport information page valid through at least October 31, 2026, birth certificate, and identity documents of both parents.", "document", "IV. Application Documents items 1-3"),
    item("degrees_transcripts", "documents", "required", `${degree} applicants`, master ? "Submit the bachelor's degree certificate and complete undergraduate transcripts; expected graduates may use official expected-graduation proof but must present the final original degree at registration." : "Submit bachelor's and master's degree certificates and complete undergraduate and master's transcripts; expected graduates may use official expected-graduation proof but must present the final original master's degree at registration.", "document", "IV. Application Documents item 4"),
    item("language_evidence", "documents", "required", `${language}-medium ${degree.toLowerCase()} applicants`, languageRule, "official_result", "IV. Application Documents item 5"),
    item("recommendations", "documents", "required", `${degree} applicants`, "Submit two recommendation letters from professors or associate professors.", "document", "IV. Application Documents item 6"),
    item("statement_plan", "documents", "required", `${degree} applicants`, "Submit a personal statement and study/research plan of at least 1,000 words in the program's language of instruction.", "document", "IV. Application Documents item 7"),
    item("curriculum_vitae", "documents", "required", `${degree} applicants`, "Submit a curriculum vitae.", "document", "IV. Application Documents item 8"),
    item("pre_acceptance", "documents", "recommended", `${degree} applicants`, "A pre-acceptance letter from the proposed XMU academic unit or supervisor is recommended and receives priority consideration where the guide states.", "document", "IV. Application Documents item 9"),
    item("physical_examination", "documents", "required", `${degree} applicants`, "Submit the Foreigner Physical Examination Form and attachments, completed as required and valid for six months.", "document", "IV. Application Documents item 10"),
    item("financial_guarantee", "documents", "required", `${degree} applicants, including scholarship applicants`, "Submit the financial guarantee statement and supporting financial records. Applying for a scholarship does not waive this document.", "document", "IV. Application Documents item 11"),
    item("criminal_record", "documents", "required", `${degree} applicants`, "Submit a no-criminal-record certificate issued within six months before application.", "document", "IV. Application Documents item 12"),
    item("portfolio_outputs", "documents", "conditional", "Applicants to art programs or applicants with academic outputs", "Art applicants submit the required portfolio; applicants may also submit publications, awards and other supporting academic evidence.", "document", "IV. Application Documents item 13"),
    item("translation_originals", "documents", "conditional", "Applicants whose records are not in Chinese or English", "Provide notarized Chinese or English translations. XMU may request original or supplementary records and materials are not returned.", "document", "IV. Application Documents - Notes"),
    item("selection", "academic_results", "required", "Applicants passing document review", "Undergo XMU's comprehensive qualification review and the admitting unit's academic assessment, which may include a remote interview or written examination.", "school_review", "VI. Admission and Selection"),
    item("application_fee", "application_policy", "required", `${degree} applicants`, "Pay the non-refundable RMB 400 application fee.", "document", "VIII. Study Costs"),
    item("tuition", "application_policy", "required", `Enrolled ${language}-medium ${degree.toLowerCase()} students in this route`, `Pay annual tuition of ${tuition}.${master ? "" : " The published guide waives tuition for the fourth academic year."}`, "document", "VIII. Study Costs", "enrollment"),
    item("insurance", "documents", "required", `Enrolled ${degree.toLowerCase()} students`, "Purchase comprehensive medical insurance at RMB 800 per year.", "document", "VIII. Study Costs", "enrollment"),
    item("accommodation_living", "other", "conditional", "Enrolled students", "Budget for campus-dependent accommodation and living costs: published accommodation ranges include RMB 35-65/day at Siming, RMB 1,600-4,000/year at Xiang'an, and RMB 1,100-1,200/year at Zhangzhou; the guide estimates food at RMB 1,000-1,500/month.", "document", "VIII. Study Costs", "enrollment"),
  ] });
}

const by = (degreeLevel: Program["degreeLevel"], teachingLanguage: Program["teachingLanguage"], tuitionText: string) =>
  seed.programs.filter((program) => program.degreeLevel === degreeLevel && program.teachingLanguage === teachingLanguage && program.tuitionText === tuitionText);
const definitions = [
  { key: "xmu-undergraduate-chinese-fall-2026", rows: by("Undergraduate", "Chinese", "RMB 24,000 or 26,000/year according to discipline category"), document: undergraduateDocument("Chinese", "RMB 24,000 or 26,000 according to discipline category", "general") },
  { key: "xmu-undergraduate-english-arts-fall-2026", rows: by("Undergraduate", "English", "RMB 90,000/year"), document: undergraduateDocument("English", "RMB 90,000", "arts") },
  { key: "xmu-undergraduate-english-mbbs-fall-2026", rows: by("Undergraduate", "English", "RMB 38,000/year"), document: undergraduateDocument("English", "RMB 38,000", "mbbs") },
  { key: "xmu-master-chinese-general-fall-2026", rows: by("Master", "Chinese", "RMB 26,000 or 30,000/year according to discipline category"), document: graduateDocument("Master", "Chinese", "RMB 26,000 or 30,000 according to discipline category") },
  { key: "xmu-master-chinese-special-fall-2026", rows: by("Master", "Chinese", "RMB 30,000/year"), document: graduateDocument("Master", "Chinese", "RMB 30,000") },
  { key: "xmu-master-english-fall-2026", rows: by("Master", "English", "RMB 39,000 or 45,000/year according to discipline category"), document: graduateDocument("Master", "English", "RMB 39,000 or 45,000 according to discipline category") },
  { key: "xmu-doctoral-chinese-fall-2026", rows: by("Doctoral", "Chinese", "RMB 30,000 or 34,000/year according to discipline category"), document: graduateDocument("Doctoral", "Chinese", "RMB 30,000 or 34,000 according to discipline category") },
  { key: "xmu-doctoral-english-fall-2026", rows: by("Doctoral", "English", "RMB 42,000 or 55,000/year according to discipline category"), document: graduateDocument("Doctoral", "English", "RMB 42,000 or 55,000 according to discipline category") },
];
const targets = definitions.flatMap((definition) => definition.rows.map((program) => program.slug));
if (definitions.some((definition) => definition.rows.length === 0) || targets.length !== 535 || new Set(targets).size !== 535) throw new Error("XMU requirement groups are incomplete.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "xiamen-university", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "Where the official guide publishes a tuition range by discipline rather than a program-level fee, the range is retained and no amount is inferred."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope XMU 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
