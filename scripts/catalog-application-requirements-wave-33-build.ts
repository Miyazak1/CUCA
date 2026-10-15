import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-33.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/hit-complete-batch-01/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: string; tuitionText: string; cscaSubjects?: string[]; hskRequirement?: string; englishRequirement?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const expected = {
  "hit-bachelor-guide-2026": "2979f544e17bafb474d10e6c4cf0a1af07a928b3dc702f6c0e893c39fc28f3ea",
  "hit-bachelor-programs-2026": "d96e9caa434003ec99d638deb927191ac91bfd06f5608ddb070895fb52ac94df",
  "hit-master-guide-2026": "a1b832af1d5682d7010e3d012dc47a276675fc43d53e90050cfaad94bef69299",
  "hit-master-programs-chinese-2026": "a33d9672ca6d555de64be1c89d256843a47bb1f2b47d5ac04a9daeb4237ea580",
  "hit-master-programs-english-2026": "4778cb790dbaa13697d03148a5b248979b4826a203c7a49097723d53ec4789e2",
  "hit-doctoral-guide-2026": "a4a1ac659ebd5221acaa635e59df76b849a2b602f3fc23b906a9432736abeae6",
  "hit-doctoral-programs-2026": "d6dc6f5f827cd293a4dea060e5cc31a3a8e97ab6c58de101a803317b072e32bc",
} as const;
const evidence = new Map<string, Source>();
for (const row of manifest.sources as Source[]) if (row.id in expected && row.status === 200
  && row.sha256 === expected[row.id as keyof typeof expected]) evidence.set(row.id, row);
if (evidence.size !== Object.keys(expected).length) throw new Error("HIT requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.hit-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 182 || seed.programIntakes.length !== 182) throw new Error("Unexpected HIT complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some(intake => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing HIT Fall 2026 intake: ${program.slug}`);

type SourceKey = "guide" | "catalog";
function sourceRecord(key: SourceKey, id: keyof typeof expected) {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const languageRule = (program: Program) => program.teachingLanguage === "Chinese"
  ? "Submit HSK Level 4 with at least 210, valid for two years. A certificate proving that the prior qualifying degree was taught in Chinese may be used under the published exemption."
  : "Submit TOEFL iBT 80 or above, or Academic IELTS 6.0 with no subtest below 5.5, or another authorized equivalent. A certificate proving that the prior qualifying degree's compulsory courses were taught in English may be used under the published exemption.";

function undergraduateDocument(program: Program): RequirementDocument {
  const subjects = (program.cscaSubjects ?? []).join(", ");
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "hit-bachelor-guide-2026"), sourceRecord("catalog", "hit-bachelor-programs-2026"),
  ], requirements: [
    item("guide", "citizenship_health", "identity", "required", "International undergraduate applicants", "Be a citizen of a country other than China, be in good mental and physical health, and meet Ministry of Education Document No. 12 (2020).", "document", "I. Eligibility items 1-2"),
    item("guide", "education", "education", "required", "International undergraduate applicants", "Hold a high-school diploma or above; expected-graduation evidence is accepted at application but the original diploma is required at registration.", "document", "I. Eligibility item 3 and II. Documents item 2"),
    item("guide", "age", "identity", "required", "International undergraduate applicants", "Be under age 30; applicants for the HIT Scholarship must be under age 25.", "document", "I. Eligibility item 4"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "II. Documents item 5"),
    item("catalog", "csca", "academic_results", "required", "Applicants to the exact programs bound to this template", `Take the CSCA and submit scores for the official major-list subjects: ${subjects}.`, "official_result", "2026 Bachelor's Major List - CSCA subjects columns"),
    item("guide", "application_window", "application_policy", "required", "Self-financed and HIT Scholarship Fall 2026 undergraduate applicants", "Submit the September 2026 application no later than July 15, 2026. Self-financed applications are otherwise accepted throughout the year.", "document", "III. Application Period and Fees"),
    item("guide", "online_application", "application_policy", "required", "Undergraduate applicants", "Complete the HIT online application form and upload all required records; paper submissions are not accepted.", "school_review", "II. Application Process and Documents steps 2 and 4; Notes"),
    item("guide", "passport", "documents", "required", "Undergraduate applicants", "Submit a copy of the passport information page.", "document", "II. Documents item 1"),
    item("guide", "diploma_transcripts", "documents", "required", "Undergraduate applicants", "Submit the high-school diploma or expected-graduation certificate and high-school transcripts. Records outside Chinese or English require notarized translations.", "document", "II. Documents items 2-3 and Notes"),
    item("guide", "csca_report", "documents", "required", "Undergraduate applicants", "Upload the CSCA score report.", "official_result", "II. Documents item 4"),
    item("guide", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "II. Documents item 5"),
    item("guide", "physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Record, valid within six months.", "document", "II. Documents item 6"),
    item("guide", "criminal_record", "documents", "required", "Undergraduate applicants", "Submit a no-criminal-record report valid within six months.", "document", "II. Documents item 7"),
    item("guide", "minor_guardian", "documents", "conditional", "Applicants who will be under age 18 on September 1, 2026", "Submit a notarized guardianship certificate for minors.", "document", "II. Documents item 8"),
    item("guide", "curriculum_vitae", "documents", "required", "Undergraduate applicants", "Submit a curriculum vitae.", "document", "II. Documents item 9"),
    item("guide", "financial_deposit", "documents", "required", "Undergraduate applicants", "Submit a bank deposit certificate showing at least CNY 20,000 or equivalent foreign currency.", "document", "II. Documents item 11"),
    item("guide", "achievements", "documents", "recommended", "Undergraduate applicants", "Optionally submit evidence of outstanding academic, sports, arts, cultural-exchange or public-welfare achievements.", "document", "II. Documents item 12"),
    item("guide", "application_fee", "application_policy", "required", "Undergraduate applicants", "Pay the non-refundable application fee and upload the remittance voucher: CNY 400 for self-financed applicants or CNY 600 for HIT Scholarship applicants.", "document", "II. Process step 3 and item 10; III. Fees"),
    item("guide", "tuition", "application_policy", "required", `Enrolled ${program.teachingLanguage}-taught undergraduate students`, `Pay annual tuition of ${program.tuitionText.replace("/year", "")}.`, "document", "III. Standard Fees", "enrollment"),
    item("guide", "insurance_accommodation", "other", "required", "Enrolled undergraduate students", "Pay CNY 800 per year for insurance and CNY 800-1,000 per month per bed for accommodation, excluding utilities and internet.", "document", "III. Standard Fees", "enrollment"),
    item("guide", "english_class_minimum", "application_policy", "conditional", "Students admitted to English-taught undergraduate programs", "English-taught classes require at least 20 students and may be cancelled when enrollment is below that threshold.", "school_review", "V. Teaching Language", "enrollment"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  const guideId = master ? "hit-master-guide-2026" : "hit-doctoral-guide-2026";
  const catalogId = master
    ? program.teachingLanguage === "Chinese" ? "hit-master-programs-chinese-2026" : "hit-master-programs-english-2026"
    : "hit-doctoral-programs-2026";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [sourceRecord("guide", guideId), sourceRecord("catalog", catalogId)], requirements: [
    item("guide", "citizenship_health", "identity", "required", `${program.degreeLevel} applicants`, "Be a citizen of a country other than China and be in good mental and physical health.", "document", "I. Eligibility items 1-2"),
    item("guide", "education", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's diploma; expected-graduation evidence is accepted at application but the original diploma is required at registration." : "Hold a master's diploma; expected-graduation evidence is accepted at application but the original diploma is required at registration.", "document", "I. Eligibility item 3 and II. Documents item 3"),
    item("guide", "age", "identity", "required", `${program.degreeLevel} applicants`, master ? "Be under age 35; HIT Scholarship applicants must be under age 30." : "Be under age 40; HIT Scholarship applicants must be under age 35.", "document", "I. Eligibility item 4"),
    item("guide", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "I. Eligibility item 5"),
    item("guide", "application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Applications are accepted throughout the year; the deadline for the September 2026 intake is May 31, 2026.", "document", "IV. Application Period"),
    item("guide", "online_application", "application_policy", "required", `${program.degreeLevel} applicants`, "Complete the HIT online application and upload every required record through the system; records submitted outside the system are not accepted.", "school_review", "II. Application Documents and IX. Application Process"),
    item("guide", "passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit the passport information page.", "document", "II. Application Documents item 2"),
    item("guide", "degree_transcripts", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit the bachelor's diploma or expected-graduation certificate and undergraduate transcripts." : "Submit the master's diploma or expected-graduation certificate and academic transcripts from the undergraduate stage as specified by the guide.", "document", "II. Application Documents items 3-4"),
    item("guide", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "II. Application Documents item 5"),
    item("guide", "study_plan", "documents", "required", `${program.degreeLevel} applicants`, "Submit a study plan of at least 1,500 words using the HIT requirements/template.", "document", "II. Application Documents item 6"),
    item("guide", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two recommendation letters from professors or associate professors.", "document", "II. Application Documents item 7"),
    item("guide", "physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit a complete Foreigner Physical Examination Record valid within six months, including physician signature, hospital stamp and sealed photograph.", "document", "II. Application Documents item 8"),
    item("guide", "criminal_record", "documents", "required", `${program.degreeLevel} applicants`, "Submit a no-criminal-record report normally issued within six months before submission.", "document", "II. Application Documents item 9"),
    item("guide", "financial_deposit", "documents", "required", `${program.degreeLevel} applicants`, "Submit a bank deposit certificate showing at least CNY 30,000 or equivalent foreign currency.", "document", "II. Application Documents item 11"),
    item("guide", "acceptance_letter", "documents", "recommended", `${program.degreeLevel} applicants`, "A supervisor acceptance letter is not mandatory, but applicants are encouraged to contact HIT professors before submission.", "document", "II. Application Documents item 12"),
    item("guide", "achievements", "documents", "recommended", `${program.degreeLevel} applicants`, "Optionally submit evidence of outstanding academic, sports, arts, cultural-exchange or public-welfare achievements.", "document", "II. Application Documents item 13"),
    item("guide", "translation_authenticity", "documents", "required", `${program.degreeLevel} applicants`, "Provide notarized Chinese or English translations for records in other languages and ensure every submitted record is authentic and valid.", "document", "II. Application Documents opening and Important Note"),
    item("guide", "application_fee", "application_policy", "required", `${program.degreeLevel} applicants`, "Pay the non-refundable CNY 400 application fee; HIT Scholarship applicants pay CNY 600, and self-financed applicants upload the remittance voucher.", "document", "II. Application Documents item 10; V. Fees"),
    item("guide", "tuition", "application_policy", "required", `Enrolled ${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} students`, `Pay annual tuition of ${program.tuitionText.replace("/year", "")}.`, "document", "V. Fees", "enrollment"),
    item("guide", "insurance_accommodation", "other", "required", `Enrolled ${program.degreeLevel.toLowerCase()} students`, "Pay CNY 800 per year for insurance and CNY 800-1,000 per month per bed for accommodation, excluding utilities and internet.", "document", "V. Fees", "enrollment"),
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
  return { key: `hit-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}-${keyPart(program.tuitionText)}${subjects}-fall-2026`, rows,
    document: program.degreeLevel === "Undergraduate" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap(definition => definition.rows.map(program => program.slug));
if (definitions.length !== 10 || targets.length !== 182 || new Set(targets).size !== 182) throw new Error("HIT requirement groups are incomplete.");
const templates = definitions.map(definition => ({ key: definition.key, schoolSlug: "harbin-institute-of-technology", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map(program => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "The application-fee rule preserves the official distinction between self-financed and HIT Scholarship applicants."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope HIT 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
