import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-36.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/sysu-complete-batch-01/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionText: string; cscaSubjects?: string[]; hskRequirement?: string; englishRequirement?: string; applicationNote?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const expected = {
  "sysu-undergraduate-guide-2026": "e34c17821f3c6c4d19668199e0b3081b7f68cb836c6792a0bb234147f1c3b1a9",
  "sysu-undergraduate-programs-2026": "c718b84680d1874a98b724efde7b1af6c9a7c0fedee3b581147b026817b9e86b",
  "sysu-master-guide-2026": "efe8a16236004a325fcaba8a1b9cb636ab5ee2c95483fe97b190459078cb2c3f",
  "sysu-master-programs-2026": "57f43ce983f2fea0bc710448d37e07d10f5a5e7eee574f128736560a94cb2100",
  "sysu-doctoral-guide-2026": "b6e5e8747cc11212b768a1925f1cc5ff89e015f6f3d024e2b2f878e316378c66",
  "sysu-doctoral-programs-2026": "d65dc404518a0f0b6480260738506c0f7f2e8b5fadd6a61f1d92fa7d4e703033",
  "sysu-cambodia-aerospace-scholarship-2026": "24e3b38a0c4e467f99e8169424b4568e975a57e167e24d8184d99766dc24fa4b",
} as const;
const evidence = new Map<string, Source>();
for (const row of manifest.sources as Source[]) if (row.id in expected && row.status === 200
  && row.sha256 === expected[row.id as keyof typeof expected]) evidence.set(row.id, row);
if (evidence.size !== Object.keys(expected).length) throw new Error("SYSU requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.sysu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 729 || seed.programIntakes.length !== 729) throw new Error("Unexpected SYSU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some(intake => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate)) throw new Error(`Missing exact SYSU Fall 2026 intake: ${program.slug}`);

type SourceKey = "guide" | "catalog" | "special";
function sourceRecord(key: SourceKey, id: keyof typeof expected) {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const mtcsol = (program: Program) => program.degreeLevel === "Master" && program.nameEn === "International Chinese Language Education";
const cambodia = (program: Program) => program.slug === "sun-yat-sen-university-master-cambodia-aerospace-information-engineering";
function languageRule(program: Program) {
  if (mtcsol(program)) return "Submit HSK Level 5 with at least 210 and HSKK Intermediate with at least 60.";
  if (program.teachingLanguage === "Chinese") {
    if (program.degreeLevel === "Undergraduate" && program.hskRequirement?.includes("Level 4")) return "Submit HSK Level 4 with at least 180; the published Chinese-medium education exemption may apply after SYSU verification.";
    return "Submit HSK Level 5 with at least 180; the published Chinese-medium education exemption may apply after SYSU verification.";
  }
  return program.englishRequirement?.includes("Cambodia")
    ? "Demonstrate English sufficient for study and daily communication through native-speaker status, IELTS 5.5 or above, a SYSU-accepted equivalent, or proof of prior Chinese- or English-medium instruction."
    : "Submit TOEFL iBT 79 with at least 15 in each section, IELTS Academic 6.5 with at least 5.5 in each component, or a verified English-medium instruction certificate under the published exemption; route-specific English rules still apply.";
}

function undergraduateDocument(program: Program): RequirementDocument {
  const subjects = (program.cscaSubjects ?? []).join(", ");
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "sysu-undergraduate-guide-2026"), sourceRecord("catalog", "sysu-undergraduate-programs-2026"),
  ], requirements: [
    item("guide", "citizenship", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen holding a valid foreign passport and meet Ministry of Education Notice Jiao Wai Han [2020] No. 12.", "school_review", "I. Eligibility item 1"),
    item("guide", "health", "identity", "required", "International undergraduate applicants", "Be in good physical and mental health and meet the physical-examination requirements for a Chinese student visa or residence permit.", "document", "I. Eligibility item 2"),
    item("guide", "education", "education", "required", "International undergraduate applicants", "Have completed senior high school or higher education, or an equivalent level of education.", "document", "I. Eligibility item 3"),
    item("guide", "conduct", "identity", "required", "International undergraduate applicants", "Have excellent academic performance and good moral character, comply with laws and regulations, and have no school disciplinary, security-penalty or criminal record.", "school_review", "I. Eligibility item 4"),
    item("guide", "minor_guardian", "documents", "conditional", "Applicants under age 18 before September 1, 2026", "Submit a Guardian Commitment Letter and notarized documents for an adult guardian residing in Guangdong Province.", "document", "I. Eligibility item 5 and V. Materials item 10"),
    item("guide", "application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Apply in round one from January 1-February 28, 2026 or round two from March 1-April 30, 2026.", "document", "II. Application Time"),
    item("catalog", "csca", "academic_results", "required", "Applicants to the exact programs bound to this template", `Take CSCA and submit the score report for the program-row subjects: ${subjects}. Scores from sessions held on or before March 1 are accepted for round one, and on or before May 1 for round two.`, "official_result", "Program row CSCA columns and guide IV. Step 1"),
    item("guide", "online_application", "application_policy", "required", "Undergraduate applicants", "Complete the SYSU online application, upload the required records, download and hand-sign the generated application, commitment and financial-support forms, then upload the signed copies.", "school_review", "IV. Steps 2-3"),
    item("guide", "application_fee_review", "application_policy", "required", "Undergraduate applicants", "Pay the non-refundable RMB 400 application fee. Qualified applicants undergo SYSU document review and interview; unpaid applications are invalid.", "school_review", "IV. Steps 4-5 and VI.1"),
    item("guide", "passport", "documents", "required", "Undergraduate applicants", "Submit an ordinary passport valid through at least December 1, 2026 and a profile photo; mainland-China residents also submit the current visa/residence-permit page and entry stamp.", "document", "V. Materials item 1"),
    item("guide", "graduation", "documents", "required", "Undergraduate applicants", "Submit proof of senior-high-school graduation or equivalent. Current-year graduates may submit pre-graduation proof but must provide the final record before enrollment.", "document", "V. Materials item 2"),
    item("guide", "transcripts", "documents", "required", "Undergraduate applicants", "Submit complete academic transcripts for senior high school or the equivalent education.", "document", "V. Materials item 3"),
    item("guide", "csca_report", "documents", "required", "Undergraduate applicants", "Submit the official CSCA score report.", "official_result", "V. Materials item 4"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "V. Materials item 5"),
    item("guide", "physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Form plus the original chest X-ray, ECG and specified laboratory reports, hospital-stamped and issued within six months; qualifying mainland-China residence documents may substitute as published.", "document", "V. Materials item 6"),
    item("guide", "birth_certificate", "documents", "required", "Undergraduate applicants", "Submit a birth certificate.", "document", "V. Materials item 7"),
    item("guide", "parent_nationality", "documents", "conditional", "Applicants with former Chinese-area status or Chinese-citizen parentage", "Submit the applicable nationality, household-registration, foreign permanent-residence and entry/exit records specified by SYSU for nationality review.", "school_review", "V. Materials item 8"),
    item("guide", "criminal_record", "documents", "required", "Undergraduate applicants", "Submit a certificate of no criminal record issued within six months before application.", "document", "V. Materials item 9"),
    item("guide", "supplementary", "documents", "recommended", "Undergraduate applicants", "Optionally submit awards or evidence of relevant experience.", "document", "V. Materials item 11"),
    item("guide", "translations", "documents", "required", "Undergraduate applicants", "Submit originals in Chinese or English; records in other languages require notarized Chinese or English translations.", "document", "V. Materials note"),
    item("guide", "tuition", "application_policy", "required", "Enrolled undergraduate students", `Pay the official annual tuition for this route: ${program.tuitionText}.`, "document", "VI.2 tuition table", "enrollment"),
    item("guide", "accommodation_insurance", "other", "required", "Enrolled undergraduate students", "Self-funded students arrange housing because dormitory places are limited. Purchase the required comprehensive medical insurance at RMB 800 per academic year.", "document", "IX. Accommodation and Insurance", "enrollment"),
    item("guide", "visa_registration", "documents", "required", "Admitted undergraduate students", "Use the admission records to obtain an X1 visa, register in person at the stated time and convert the X1 visa to a student residence permit within 30 days of entry.", "document", "VIII. Enrollment and Registration", "preparation"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  const guideId = master ? "sysu-master-guide-2026" : "sysu-doctoral-guide-2026";
  const catalogId = master ? "sysu-master-programs-2026" : "sysu-doctoral-programs-2026";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("guide", guideId), sourceRecord("catalog", catalogId)], requirements: [
    item("guide", "citizenship", "identity", "required", `${program.degreeLevel} applicants`, "Be a non-Chinese citizen holding a valid foreign passport.", "document", "I. Eligibility item 1"),
    item("guide", "health", "identity", "required", `${program.degreeLevel} applicants`, "Be in good physical and mental health and meet the physical-examination requirements for a Chinese student visa or residence permit.", "document", "I. Eligibility item 2"),
    item("guide", "education", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree or equivalent." : "Hold a master's degree or equivalent.", "document", "I. Eligibility item 3"),
    item("guide", "conduct", "identity", "required", `${program.degreeLevel} applicants`, "Have excellent academic performance and good moral character, comply with laws and regulations, and have no school disciplinary, security-penalty or criminal record.", "school_review", "I. Eligibility item 4"),
    item("guide", "application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Apply in round one from January 1-February 15, 2026 or round two from February 16-April 30, 2026.", "document", "II. Application Time"),
    item("guide", "online_application", "application_policy", "required", `${program.degreeLevel} applicants`, "Complete the SYSU online application, upload the required records, download and hand-sign the generated application, commitment and financial-support forms, then upload the signed copies.", "school_review", "IV. Steps 1-2"),
    item("guide", "application_fee_review", "application_policy", "required", `${program.degreeLevel} applicants`, "Pay the non-refundable RMB 400 application fee. Qualified applicants undergo SYSU document review and interview; unpaid applications are invalid.", "school_review", "IV. Steps 3-4 and VI.1"),
    item("guide", "passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit an ordinary passport valid through at least December 1, 2026 and a profile photo; mainland-China residents also submit the current visa/residence-permit page and entry stamp. Former Chinese-area citizens also submit the published nationality-renunciation records.", "document", "V. Materials item 1"),
    item("guide", "degree_verification", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit the bachelor's degree certificate, diploma and the applicable CHSI or CSCSE verification report; current-year applicants may use pre-graduation proof but must provide the final degree before enrollment." : "Submit bachelor's and master's degree certificates, diplomas and the applicable CHSI or CSCSE verification reports; current-year applicants may use pre-graduation proof but must provide the final master's degree before enrollment.", "document", "V. Materials item 2"),
    item("guide", "transcripts", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit complete, institution-stamped bachelor's transcripts." : "Submit complete, institution-stamped bachelor's and master's transcripts.", "document", "V. Materials item 3"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "V. Materials item 4"),
    item("guide", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two academic recommendation letters from professors, associate professors or equivalent experts in the applicant's field.", "document", "V. Materials item 5"),
    item("guide", "study_plan", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit a study and research plan of more than 3,000 words covering academic/professional background, research achievements, master's research plan and career plans." : "Submit a study and research plan of approximately 6,000 words covering academic/professional background, research achievements, doctoral research plan and career plans.", "document", "V. Materials item 6"),
    item("guide", "physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Foreigner Physical Examination Form plus the original chest X-ray, ECG and specified laboratory reports, hospital-stamped and issued within six months; qualifying mainland-China residence documents may substitute as published.", "document", "V. Materials item 7"),
    item("guide", "criminal_record", "documents", "required", `${program.degreeLevel} applicants`, "Submit a certificate of no criminal record issued within six months before application.", "document", "V. Materials item 8"),
    item("guide", "supplementary", "documents", "recommended", `${program.degreeLevel} applicants`, "Optionally submit awards or evidence of relevant experience.", "document", "V. Materials item 9"),
    item("guide", "translations", "documents", "required", `${program.degreeLevel} applicants`, "Submit originals in Chinese or English; records in other languages require notarized Chinese or English translations.", "document", "V. Materials note"),
    item("guide", "tuition", "application_policy", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, `Pay the official annual tuition for this route: ${program.tuitionText}.`, "document", "VI.2 tuition table", "enrollment"),
    item("guide", "accommodation_insurance", "other", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, "Self-funded students arrange housing because dormitory places are limited. Purchase the required comprehensive medical insurance at RMB 800 per academic year.", "document", "IX. Accommodation and Insurance", "enrollment"),
    item("guide", "visa_registration", "documents", "required", `Admitted ${program.degreeLevel.toLowerCase()} students`, "Use the admission records to obtain an X1 visa, register in person at the stated time and convert the X1 visa to a student residence permit within 30 days of entry.", "document", "VIII. Enrollment and Registration", "preparation"),
  ] });
}

function cambodiaDocument(program: Program): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("special", "sysu-cambodia-aerospace-scholarship-2026")], requirements: [
    item("special", "nationality", "identity", "required", "Cambodia Aerospace Information Engineering applicants", "Hold nationality of the Kingdom of Cambodia.", "document", "III. Eligibility item 1"),
    item("special", "education", "education", "required", "Targeted-program applicants", "Hold a bachelor's degree in a relevant discipline.", "document", "III. Eligibility item 2"),
    item("special", "academic_background", "education", "required", "Targeted-program applicants", "Have a foundation in electronic information, computer science, communication engineering, aerospace engineering or a related STEM field.", "school_review", "III. Eligibility item 3"),
    item("special", "language", "language", "required", "Targeted-program applicants", languageRule(program), "official_result", "III. Eligibility item 4"),
    item("special", "health_conduct", "identity", "required", "Targeted-program applicants", "Be physically and mentally healthy, law-abiding and friendly toward China, with no criminal or prior-school disciplinary record and no condition barring entry or long-term residence in China.", "school_review", "III. Eligibility items 5-6"),
    item("special", "cadt_nomination", "application_policy", "required", "Targeted-program applicants", "Obtain nomination from the Cambodian Academy of Digital Technology; SYSU conducts document review and interview assessment independently.", "school_review", "III. Eligibility item 7"),
    item("special", "application_window", "application_policy", "required", "Fall 2026 targeted-program applicants", "Submit to CADT by August 10, 2026 and complete the matching SYSU online application and document submission by August 11, 2026.", "document", "IV. Application Procedure phases I-II"),
    item("special", "application_form", "documents", "required", "Targeted-program applicants", "Submit the SYSU International Student Application Form generated by the system.", "document", "VI. Materials item 1"),
    item("special", "degree_transcripts", "documents", "required", "Targeted-program applicants", "Submit the bachelor's degree and graduation certificates, or expected-graduation proof for final-year students, plus complete official undergraduate transcripts.", "document", "VI. Materials items 2-3"),
    item("special", "recommendation", "documents", "required", "Targeted-program applicants", "Submit the official CADT recommendation letter stating the reasons for recommendation and ranking.", "document", "VI. Materials item 4"),
    item("special", "cv", "documents", "required", "Targeted-program applicants", "Submit a curriculum vitae in English.", "document", "VI. Materials item 5"),
    item("special", "study_plan", "documents", "required", "Targeted-program applicants", "Submit an approximately 1,500-word Chinese or English study plan focused on aerospace information engineering.", "document", "VI. Materials item 6"),
    item("special", "language_evidence", "documents", "required", "Targeted-program applicants", "Submit IELTS or an equivalent English result, or proof of English-medium instruction under the published alternatives.", "official_result", "VI. Materials item 7"),
    item("special", "passport", "documents", "required", "Targeted-program applicants", "Submit a copy of a valid ordinary passport.", "document", "VI. Materials item 8"),
    item("special", "physical_examination", "documents", "required", "Targeted-program applicants", "Submit the Foreigner Physical Examination Form issued within six months, with photograph and hospital seal.", "document", "VI. Materials item 9"),
    item("special", "criminal_record", "documents", "required", "Targeted-program applicants", "Submit a certificate of no criminal record.", "document", "VI. Materials item 10"),
    item("special", "supporting_records", "documents", "recommended", "Targeted-program applicants", "Optionally submit research achievements, awards or other supporting materials.", "document", "VI. Materials item 11"),
    item("special", "translations", "documents", "required", "Targeted-program applicants", "Submit materials in Chinese or English; other-language records require certified translations.", "document", "VI. Materials introduction"),
    item("special", "tuition", "application_policy", "required", "Enrolled targeted-program students", "Pay RMB 80,000 per academic year, calculated over two years; other travel and living costs follow the program agreement, and the route is ineligible for SYSU's international scholarship scheme.", "document", "V. Fees and Funding", "enrollment"),
  ] });
}

const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText,
    csca: program.cscaSubjects ?? [], hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "",
    mtcsol: mtcsol(program), cambodia: cambodia(program) });
  const rows = groups.get(identity) ?? [];
  rows.push(program);
  groups.set(identity, rows);
}
const definitions = [...groups.values()].map((rows, index) => {
  const program = rows[0];
  const special = cambodia(program) ? "-cambodia-targeted" : mtcsol(program) ? "-mtcsol" : "";
  return { key: `sysu-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}${special}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows,
    document: cambodia(program) ? cambodiaDocument(program) : program.degreeLevel === "Undergraduate" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap(definition => definition.rows.map(program => program.slug));
if (definitions.length !== 16 || targets.length !== 729 || new Set(targets).size !== 729) throw new Error("SYSU requirement groups are incomplete.");
const templates = definitions.map(definition => ({ key: definition.key, schoolSlug: "sun-yat-sen-university", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map(program => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "Program labels and stable slugs remain tied to the locked official catalog; separate reviewed text-correction artifacts do not change requirement bindings.", "The MTCSOL and Cambodia-targeted routes are separated from otherwise similar program groups to preserve their special language and application rules."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope SYSU 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
