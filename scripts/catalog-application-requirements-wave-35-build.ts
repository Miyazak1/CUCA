import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-35.draft.json");
const manifests = await Promise.all([
  "work/catalog-official/scu-complete-batch-01/manifest.json",
  "work/catalog-official/scu-complete-batch-01-supplement/manifest.json",
].map(path => readFile(resolve(root, path), "utf8").then(JSON.parse)));
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; nameEn: string; degreeLevel: "Bachelor" | "Master" | "Doctoral"; teachingLanguage: "Chinese" | "English"; tuitionText: string; cscaRequirement?: string; hskRequirement?: string; englishRequirement?: string };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };
const expected = {
  "scu-international-admission-guide-2026": "da2aea26e45be3ad842bdd83e5c2630b883e092da86e8bce7b5dd8f537eab1da",
  "scu-undergraduate-program-catalog-2026": "a1d62a71ffe7ba0e8f24f2b1eacd04ab12f73d2f9320981401d6ae5c3c0d18b7",
  "scu-master-program-catalog-2026": "467edb07dab2ea7537e19cedf3aa91e3874500f6f7f443dea421810763692a4e",
  "scu-doctoral-program-catalog-2026": "0b18cbb96b7c5c526b15bec3223867c08a94fd9422324935c399b6fc1df05cc2",
  "scu-undergraduate-application-requirements-2026": "951df119a1f3272c2da325591ea5140dd108cd96298b01035a2cd7483cfd8b51",
  "scu-master-application-requirements-2026": "84bd0567a022a1fe8b316209e0db697030563cf96aa9e8590d03672c60c8610b",
  "scu-doctoral-application-requirements-2026": "fd4c4c0b172d246e366f6846d5ddaded69a4fbfbd381f6266fb64d48b8c3745d",
  "scu-undergraduate-tuition-2026": "98a6f4a87c7b350bc2aa752e5facccfe6b5603d21abb1866c0bc16e327fedb77",
  "scu-master-tuition-2026": "e7648f46ccd1dec8c1b54f3a320fcf366a8f06def38741654e4de7783c0d49e2",
  "scu-doctoral-tuition-2026": "9a43b051323334618e63ff1bb218deff41b11f7f07102bc606328d51e58c1767",
} as const;
const evidence = new Map<string, Source>();
for (const manifest of manifests) for (const row of manifest.sources as Source[]) if (row.id in expected && row.status === 200 && row.contentType === "text/html"
  && row.sha256 === expected[row.id as keyof typeof expected]) evidence.set(row.id, row);
if (evidence.size !== Object.keys(expected).length) throw new Error("SCU requirement evidence mismatch.");
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.scu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 639 || seed.programIntakes.length !== 639) throw new Error("Unexpected SCU complete seed.");
for (const program of seed.programs) if (!seed.programIntakes.some(intake => intake.programSlug === program.slug
  && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate)) throw new Error(`Missing exact SCU Fall 2026 intake: ${program.slug}`);

type SourceKey = "guide" | "requirements" | "catalog" | "tuition";
function sourceRecord(key: SourceKey, id: keyof typeof expected) {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: SourceKey, key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const idsByDegree = {
  Bachelor: { requirements: "scu-undergraduate-application-requirements-2026", catalog: "scu-undergraduate-program-catalog-2026", tuition: "scu-undergraduate-tuition-2026" },
  Master: { requirements: "scu-master-application-requirements-2026", catalog: "scu-master-program-catalog-2026", tuition: "scu-master-tuition-2026" },
  Doctoral: { requirements: "scu-doctoral-application-requirements-2026", catalog: "scu-doctoral-program-catalog-2026", tuition: "scu-doctoral-tuition-2026" },
} as const;
function languageRule(program: Program) {
  if (program.teachingLanguage === "Chinese") return program.hskRequirement === "No HSK certificate is required for the Chinese Language undergraduate program."
    ? "The Chinese Language undergraduate program does not require an HSK certificate."
    : program.hskRequirement ?? "Submit the Chinese-language evidence published for the selected route.";
  return program.englishRequirement ?? "Submit the English-language evidence published for the selected route.";
}
function tuitionRule(program: Program) {
  return `Use the official annual category schedule for this route: ${program.tuitionText} SCU publishes category bands rather than a row-level amount, so the applicable category must be confirmed without inferring a price.`;
}

function undergraduateDocument(program: Program): RequirementDocument {
  const ids = idsByDegree.Bachelor;
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "scu-international-admission-guide-2026"), sourceRecord("requirements", ids.requirements),
    sourceRecord("catalog", ids.catalog), sourceRecord("tuition", ids.tuition),
  ], requirements: [
    item("requirements", "citizenship_health", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen in good physical and mental health and hold a valid foreign passport under the Nationality Law of the PRC.", "document", "Eligibility item 1"),
    item("requirements", "age", "identity", "required", "International undergraduate applicants", "Be at least 18 years old and, in principle, under age 25.", "document", "Eligibility item 1"),
    item("requirements", "nationality_history", "identity", "conditional", "Applicants born abroad to one or two Chinese-citizen parents settled abroad", "Meet Ministry of Education Notice JWH [2020] No. 12 and the published nationality-review conditions.", "school_review", "Eligibility item 2"),
    item("requirements", "education", "education", "required", "International undergraduate applicants", "Hold at least a high-school degree and have good academic records.", "document", "Eligibility item 3"),
    item("requirements", "language", "language", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "Eligibility item 4"),
    item("requirements", "csca", "academic_results", "required", "Applicants to the exact programs bound to this template", "Submit a CSCA report using SCU's published category-and-language matrix: liberal arts Chinese—Chinese Language and Mathematics; liberal arts English—Mathematics; science/engineering Chinese—Chinese Language, Mathematics and Physics; science/engineering English—Mathematics and Physics; medical Chinese—Chinese Language, Mathematics, Physics and Chemistry; medical English—Mathematics, Physics and Chemistry.", "official_result", "Application Documents item 11 and CSCA category matrix"),
    item("guide", "application_window", "application_policy", "required", "Fall 2026 undergraduate applicants", "Submit the online application from January 1 through May 30, 2026.", "document", "Part 3 - When to Apply"),
    item("guide", "online_application", "application_policy", "required", "Undergraduate applicants", "Apply through the SCU Overseas Students Office online system within the published application period; sponsor-funded routes must also follow the sponsor system stated by the official guide.", "school_review", "Part 3 - How to Apply"),
    item("requirements", "passport", "documents", "required", "Undergraduate applicants", "Submit the passport first page, valid for at least six months from application; applicants living in mainland China also submit the valid visa or residence permit.", "document", "Application Documents item 1"),
    item("requirements", "diploma", "documents", "required", "Undergraduate applicants", "Submit the high-school graduation certificate or a school-sealed pre-graduation certificate stating the expected graduation date.", "document", "Application Documents item 2"),
    item("requirements", "china_study_record", "documents", "conditional", "Applicants living in China or with prior study in China", "Submit the previous Chinese school's document describing the applicant's performance at school.", "document", "Application Documents item 3"),
    item("requirements", "transcripts", "documents", "required", "Undergraduate applicants", "Submit school-sealed high-school academic transcripts.", "document", "Application Documents item 4"),
    item("requirements", "personal_statement", "documents", "required", "Undergraduate applicants", "Submit a Chinese or English personal statement covering self-introduction, reasons for applying, understanding of the major and study plan; English-taught applicants must write it in English.", "document", "Application Documents item 5"),
    item("requirements", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught undergraduate applicants`, languageRule(program), "official_result", "Application Documents item 6 and Eligibility item 4"),
    item("requirements", "physical_examination", "documents", "required", "Undergraduate applicants", "Submit the Foreigner Physical Examination Form with results no more than six months old at application.", "document", "Application Documents item 7"),
    item("requirements", "financial_guarantee", "documents", "conditional", "Applicants without a full scholarship", "Submit funding-source or guardian financial-guarantee evidence, such as a family bank deposit certificate and parent/guardian income certificate; SCU recommends at least USD 5,000. Full-scholarship applicants are exempt.", "document", "Application Documents item 8"),
    item("requirements", "criminal_record", "documents", "required", "Undergraduate applicants", "Submit a no-criminal-record certificate issued by the local public-security authority no more than six months before application.", "document", "Application Documents item 9"),
    item("requirements", "achievements", "documents", "recommended", "Undergraduate applicants", "Optionally submit award certificates or other supporting documents.", "document", "Application Documents item 10"),
    item("requirements", "translations_authenticity", "documents", "required", "Undergraduate applicants", "Upload authentic electronic records; documents in other languages require official Chinese or English translations. SCU does not process incomplete applications and may request additional records.", "school_review", "Application Documents - Notes 1-2"),
    item("tuition", "tuition", "application_policy", "required", `Enrolled ${program.teachingLanguage}-taught undergraduate students`, tuitionRule(program), "document", "Official 2026 undergraduate tuition category schedule", "enrollment"),
  ] });
}

function graduateDocument(program: Program): RequirementDocument {
  const master = program.degreeLevel === "Master";
  const ids = idsByDegree[program.degreeLevel];
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    sourceRecord("guide", "scu-international-admission-guide-2026"), sourceRecord("requirements", ids.requirements),
    sourceRecord("catalog", ids.catalog), sourceRecord("tuition", ids.tuition),
  ], requirements: [
    item("requirements", "citizenship_health_age", "identity", "required", `${program.degreeLevel} applicants`, `Be a non-Chinese citizen in good physical and mental health, hold a valid foreign passport, and be age 18-${master ? 40 : 45}.`, "document", "Eligibility item 1"),
    item("requirements", "education", "education", "required", `${program.degreeLevel} applicants`, master ? "Hold a bachelor's degree." : "Hold a master's degree.", "document", "Eligibility item 2"),
    item("requirements", "language", "language", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Eligibility item 3"),
    item("guide", "application_window", "application_policy", "required", `Fall 2026 ${program.degreeLevel.toLowerCase()} applicants`, "Submit the online application from November 1, 2025 through May 30, 2026.", "document", "Part 3 - When to Apply"),
    item("guide", "online_application", "application_policy", "required", `${program.degreeLevel} applicants`, "Apply through the SCU Overseas Students Office online system; sponsor-funded routes must also follow the sponsor system stated by the official guide.", "school_review", "Part 3 - How to Apply"),
    item("requirements", "passport", "documents", "required", `${program.degreeLevel} applicants`, "Submit the passport first page, valid for at least six months from application; applicants living in mainland China also submit the valid visa or residence permit.", "document", "Application Documents item 1"),
    item("requirements", "degree_certificate", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit the bachelor's graduation/degree certificate or university-sealed pre-graduation certificate stating the expected graduation date." : "Submit undergraduate and postgraduate graduation/degree certificates, or a university-sealed pre-graduation certificate stating the expected graduation date.", "document", "Application Documents item 2"),
    item("requirements", "china_study_record", "documents", "conditional", "Applicants living in China or with prior study in China", "Submit the previous Chinese school's document describing the applicant's performance at school.", "document", "Application Documents item 3"),
    item("requirements", "transcripts", "documents", "required", `${program.degreeLevel} applicants`, master ? "Submit university-sealed undergraduate academic transcripts." : "Submit university-sealed undergraduate and postgraduate academic transcripts.", "document", "Application Documents item 4"),
    item("requirements", "recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two recommendation letters from professors, associate professors or equivalent experts in the intended major, including handwritten signature, title, affiliation, phone number and email address.", "document", "Application Documents item 5"),
    item("requirements", "study_plan", "documents", "required", `${program.degreeLevel} applicants`, "Submit a Chinese or English study and research plan covering self-introduction, reasons for applying, understanding of the major and study plan; English-taught applicants must write it in English.", "document", "Application Documents item 6"),
    item("requirements", "academic_papers", "documents", "recommended", `${program.degreeLevel} applicants`, "Optionally submit contents and abstracts of academic papers.", "document", "Application Documents item 7"),
    item("requirements", "language_evidence", "documents", "required", `${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} applicants`, languageRule(program), "official_result", "Application Documents item 8 and Eligibility item 3"),
    item("requirements", "physical_examination", "documents", "required", `${program.degreeLevel} applicants`, "Submit the Foreigner Physical Examination Form with results no more than six months old at application.", "document", "Application Documents item 9"),
    item("requirements", "financial_guarantee", "documents", "conditional", "Applicants without a full scholarship", "Submit funding-source or guardian financial-guarantee evidence, such as a family bank deposit certificate and parent/guardian income certificate; SCU recommends at least USD 5,000. Full-scholarship applicants are exempt.", "document", "Application Documents item 10"),
    item("requirements", "employment", "documents", "conditional", `${program.degreeLevel} applicants with employment`, "Submit a certificate of employment when applicable.", "document", "Application Documents item 11"),
    item("requirements", "criminal_record", "documents", "required", `${program.degreeLevel} applicants`, "Submit a no-criminal-record certificate issued by the local public-security authority no more than six months before application.", "document", "Application Documents item 12"),
    item("requirements", "achievements", "documents", "recommended", `${program.degreeLevel} applicants`, "Optionally submit award certificates or other supporting documents.", "document", "Application Documents item 13"),
    item("requirements", "translations_authenticity", "documents", "required", `${program.degreeLevel} applicants`, "Upload authentic electronic records; documents in other languages require official Chinese or English translations. SCU does not process incomplete applications and may request additional records.", "school_review", "Application Documents - Notes 1-2"),
    item("tuition", "tuition", "application_policy", "required", `Enrolled ${program.teachingLanguage}-taught ${program.degreeLevel.toLowerCase()} students`, tuitionRule(program), "document", `Official 2026 ${program.degreeLevel.toLowerCase()} tuition category schedule`, "enrollment"),
  ] });
}

const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = new Map<string, Program[]>();
for (const program of seed.programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText,
    csca: program.cscaRequirement ?? "", hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "" });
  const rows = groups.get(identity) ?? [];
  rows.push(program);
  groups.set(identity, rows);
}
const definitions = [...groups.values()].map((rows, index) => {
  const program = rows[0];
  return { key: `scu-${keyPart(program.degreeLevel)}-${keyPart(program.teachingLanguage)}-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows,
    document: program.degreeLevel === "Bachelor" ? undergraduateDocument(program) : graduateDocument(program) };
});
const targets = definitions.flatMap(definition => definition.rows.map(program => program.slug));
if (definitions.length !== 7 || targets.length !== 639 || new Set(targets).size !== 639) throw new Error("SCU requirement groups are incomplete.");
const templates = definitions.map(definition => ({ key: definition.key, schoolSlug: "sichuan-university", cycle: "fall-2026",
  targetProgramSlugs: definition.rows.map(program => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current application window.", "SCU publishes tuition by degree and academic category rather than a row-level mapping; the verified official band is preserved without inferring a program price.", "Undergraduate CSCA subjects follow SCU's published category-and-language matrix; no unverified discipline classification is added."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
  purpose: "Source-located complete-scope SCU 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: seed.programs.length,
    targetedIntakeCount: seed.programIntakes.length, requirementItemCount: templates.reduce((total, template) => total + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
