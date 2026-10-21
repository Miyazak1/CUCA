import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-58.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; cscaRequirement?: string; tuitionText?: string; applicationNote?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status?: string; deadlineDate?: string }[] };

const expected = new Map<string, string>([
  ["bfsu-international-undergraduate-admissions-en-2026", "2077792799a8271076340e715dc50be8835cb60a0b03e714492aa25733ad0329"],
  ["bfsu-international-graduate-admissions-pdf-zh-2026", "2045bbd4480e1a2cf5bb3ad72bca573acbee4d52cf0b9bb65ed2003629f2ca89"],
  ["bfsu-international-undergraduate-program-catalog-en-2026", "8468397309cbc8615abde48cfd4dde37949be55bf46d3bac48c5452fa533861b"],
  ["bfsu-international-master-program-catalog-en-2026", "2615a263880c8dccf89522a8fea6401a52cbe02e5df4abbdec5fca78ff62591e"],
  ["bfsu-international-doctoral-program-catalog-en-2026", "e2ee28d2840d89b1ce2d670f9228b2ee7ec203532acd590d8f4e10d426e1aa44"],
  ["ecust-international-undergraduate-admissions-en-2026", "3257d2cc6575acfa62ef1c7d5839e32c715ab345376c07a7af84b15dde61bf87"],
  ["ecust-international-graduate-admissions-en-2026", "9cba7dc3947a9fdad21895a307e2977c9125ab343106a5bafaba60e6fe63180d"],
  ["ecust-international-undergraduate-program-catalog-2026", "bad3b7d0b2778675a4f326338ba67ded3defaa97fdaf29b6e28453ea853588e8"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const row of manifest.sources ?? []) if (row.status === 200 && expected.get(row.id) === row.sha256) evidence.set(row.id, row);
  } catch (error: unknown) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
}
const missing = [...expected.keys()].filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked requirement evidence: ${missing.join(", ")}`);
const [bfsu, ecust] = await Promise.all([
  readFile(resolve(root, "seeds/catalog.bfsu-complete-batch-01.draft.json"), "utf8").then((text) => JSON.parse(text) as Seed),
  readFile(resolve(root, "seeds/catalog.ecust-complete-batch-01.draft.json"), "utf8").then((text) => JSON.parse(text) as Seed),
]);
if (bfsu.programs.length !== 151 || ecust.programs.length !== 137) throw new Error("Unexpected BFSU or ECUST seed size.");

const record = (key: string, id: string) => { const source = evidence.get(id)!; return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }; };
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] }; }
const grouped = <T>(rows: T[], key: (row: T) => string) => { const map = new Map<string, T[]>(); for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]); return map; };
const intakeCheck = (seed: Seed, programs: Program[]) => { for (const program of programs) if (!seed.programIntakes.some((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2026 && row.status === "closed")) throw new Error(`Missing closed Fall 2026 intake: ${program.slug}`); };

function bfsuDocument(degree: string): RequirementDocument {
  const undergraduate = degree === "Undergraduate", doctoral = degree === "Doctoral";
  const guide = undergraduate ? "bfsu_ug" : "bfsu_grad";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    record(guide, undergraduate ? "bfsu-international-undergraduate-admissions-en-2026" : "bfsu-international-graduate-admissions-pdf-zh-2026"),
    record("programs", undergraduate ? "bfsu-international-undergraduate-program-catalog-en-2026" : doctoral ? "bfsu-international-doctoral-program-catalog-en-2026" : "bfsu-international-master-program-catalog-en-2026"),
  ], requirements: [
    item("citizenship", "identity", "required", "All applicants", "Hold a valid ordinary foreign passport and qualify as a non-Chinese citizen under the published nationality rules.", "document", guide, undergraduate ? "Eligibility item 1" : "Prospectus pages 1-2, application condition 1"),
    item("health_and_conduct", "other", "required", "All applicants", "Meet the published physical and mental health standard, have no criminal record or public-security penalty, comply with Chinese law and university rules, and be able to complete on-campus study.", "school_review", guide, undergraduate ? "Eligibility items 2-3" : "Prospectus page 2, application conditions 2-3"),
    item("prior_education", "education", "required", `${degree} applicants`, undergraduate ? "Complete senior high school education; applicants under 18 must also satisfy the published guardian-document rules." : doctoral ? "Hold a master's degree or higher recognized by the Chinese Ministry of Education." : "Hold a bachelor's degree or higher recognized by the Chinese Ministry of Education.", "document", guide, undergraduate ? "Eligibility item 4" : "Prospectus page 2, application condition 4"),
    item("online_application", "application_policy", "required", "All applicants", "Complete the BFSU online application with truthful, accurate, complete and valid information.", "school_review", guide, undergraduate ? "Application Procedures" : "Prospectus pages 2-3, application method"),
    item("degree_certificate", "documents", "required", "All applicants", undergraduate ? "Submit the senior high-school graduation certificate; current students may use an enrollment certificate and must provide the original diploma before registration." : "Submit the degree certificate in Chinese or English; if the application language differs, add a notarized Chinese or English translation.", "document", guide, undergraduate ? "Required documents item 1" : "Prospectus page 3, materials item 1"),
    item("transcripts", "documents", "required", "All applicants", "Submit official academic transcripts in Chinese or English, adding a notarized Chinese or English translation when required.", "document", guide, undergraduate ? "Required documents item 2" : "Prospectus page 3, materials item 2"),
    ...(undergraduate ? [item("csca", "academic_results", "required", "Undergraduate applicants", "Submit the official CSCA result with the exact subjects published for the selected program.", "official_result", "programs", "CSCA Test Subjects column")] : []),
    item("language", "language", "required", "All applicants", "Submit a valid Chinese or English language certificate that meets the selected school's and program's published requirement; the captured sources do not publish one universal score threshold.", "official_result", guide, undergraduate ? "Required documents item 4" : "Prospectus page 3, materials item 5"),
    ...(undergraduate ? [item("personal_statement", "documents", "required", "Undergraduate applicants", "Submit a personal statement of at least 500 words in the selected program's teaching language.", "document", guide, "Required documents item 5")] : [
      item("cv_and_research_plan", "documents", "required", `${degree} applicants`, doctoral ? "Submit a CV and a research plan of at least 3,000 Chinese characters in the program's teaching language, and obtain confirmation from a prospective supervisor before submission." : "Submit a CV and a research plan of at least 1,500 Chinese characters in the program's teaching language.", "document", guide, "Prospectus page 3, materials item 3"),
      item("recommendations", "documents", "required", `${degree} applicants`, "Submit two signed recommendation letters in Chinese or English from professors, associate professors or experts with equivalent professional titles in the relevant field.", "document", guide, "Prospectus page 3, materials item 4"),
    ]),
    item("passport", "identity", "required", "All applicants", "Submit a clear scan of the ordinary passport biographical page and the additional residence/entry or nationality records required by the applicant's circumstances.", "document", guide, undergraduate ? "Required documents item 6" : "Prospectus page 4, materials item 6"),
    item("declarations", "documents", "required", "All applicants", "Submit the applicant-signed admission commitment and the sponsor-signed guarantee using the official templates.", "document", guide, undergraduate ? "Required documents item 7" : "Prospectus page 4, materials item 7"),
    item("employment_letter", "documents", "conditional", "Applicants who are employed", "Submit the employer's consent-to-study letter or proof that the employment relationship has ended.", "document", guide, undergraduate ? "Required documents item 8" : "Prospectus page 4, materials item 8"),
    item("additional_materials", "documents", "conditional", "Applicants whose school, scholarship or academic background requires them", "Submit the additional school or scholarship documents and any published academic output requested by BFSU.", "document", guide, undergraduate ? "Required documents item 9" : "Prospectus page 4, materials items 9-10"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable CNY 800 online application fee in RMB.", "document", guide, undergraduate ? "Application Fee" : "Prospectus page 4, application fee"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", undergraduate ? "Submit the autumn application by June 15, 2026." : "Submit the graduate application by May 31, 2026.", "school_review", guide, undergraduate ? "Application Opening Periods" : "Prospectus page 3, system opening period"),
  ] });
}

function ecustDocument(degree: string, language: string): RequirementDocument {
  const undergraduate = degree === "Undergraduate";
  const guide = undergraduate ? "ecust_ug" : "ecust_grad";
  const languageRule = language === "Chinese"
    ? (undergraduate ? "Submit HSK 4 with at least 190 for science/engineering or 210 for humanities/business, including at least 60 in writing, unless the published prior Chinese-medium-degree exemption applies." : "Submit HSK 5 with 210 or HSK 6 with 180, unless the published prior Chinese-medium-degree exemption applies.")
    : language === "English"
      ? "Submit TOEFL 80, IELTS 6.0 or Duolingo 105, unless a published native-English or prior English-medium-degree exemption applies."
      : "For a bilingual route, satisfy the language requirement corresponding to the actual teaching language: the published Chinese threshold and/or TOEFL 80, IELTS 6.0 or Duolingo 105. Confirm the route language with ECUST before applying.";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [
    record(guide, undergraduate ? "ecust-international-undergraduate-admissions-en-2026" : "ecust-international-graduate-admissions-en-2026"),
    ...(undergraduate ? [record("programs", "ecust-international-undergraduate-program-catalog-2026")] : []),
  ], requirements: [
    item("citizenship_health", "other", "required", "All applicants", "Hold a valid foreign passport, be in good health and comply with the published nationality rules.", "document", guide, "Qualifications"),
    item("prior_education", "education", "required", `${degree} applicants`, undergraduate ? "Hold a high-school diploma or higher and be over age 16; applicants under 18 before August 31 must submit the official guarantee statement." : degree === "Doctoral" ? "Hold a master's degree or higher." : "Hold a bachelor's degree or higher.", "document", guide, "Qualifications"),
    item("language", "language", "required", `${language}-taught route applicants`, languageRule, "official_result", guide, "Qualifications, language requirements"),
    item("online_application", "application_policy", "required", "All applicants", "Register once in the ECUST online application system and submit the required documents according to the system prompts.", "school_review", guide, "Application Procedures"),
    item("passport", "identity", "required", "All applicants", undergraduate ? "Submit the passport photo page, valid through September 1, 2027 or later." : "Submit the passport photo page, valid through September 1, 2027 or later.", "document", guide, "Application Checklist item 1"),
    item("degree_certificate", "documents", "required", "All applicants", undergraduate ? "Submit the high-school diploma or equivalent; prospective graduates submit current study status and expected graduation date, then the diploma before registration." : "Submit the highest graduation and degree certificates; prospective graduates submit current status and expected graduation date, then the certificates before registration.", "document", guide, "Application Checklist item 2"),
    item("transcripts", "documents", "required", "All applicants", undergraduate ? "Submit all high-school transcripts or published international standardized-test results." : "Submit transcripts of all undergraduate courses.", "document", guide, "Application Checklist item 3"),
    ...(undergraduate ? [item("csca", "academic_results", "required", "Undergraduate applicants", "Submit CSCA results for the exact subjects listed for the selected program.", "official_result", "programs", "CSCA subject-requirement column")] : [
      item("acceptance_letter", "documents", "conditional", "Graduate applicants", "Upload an acceptance letter when the selected school/program table marks it as required.", "document", guide, "Application Checklist item 5 and program table"),
      item("recommendations", "documents", "required", "Graduate applicants", "Submit two recommendation letters in Chinese or English from a professor or associate professor, issued after September 1, 2025 and containing the referee's required professional details and signature.", "document", guide, "Application Checklist item 6"),
    ]),
    item("study_plan", "documents", "required", "All applicants", undergraduate ? "Submit a study plan of at least 800 words covering the applicant, family, reasons for choosing ECUST and the major." : "Submit a study plan of at least 800 words and a detailed research proposal if prepared.", "document", guide, undergraduate ? "Application Checklist item 7" : "Application Checklist item 7"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a non-criminal-record certificate or the published alternative applicable to the applicant's situation.", "document", guide, undergraduate ? "Application Checklist item 8" : "Application Checklist item 9"),
    item("financial_support", "documents", "required", "All applicants", "Submit the Statement of Financial Support.", "document", guide, undergraduate ? "Application Checklist item 9" : "Application Checklist item 10"),
    item("physical_examination", "documents", "required", "All applicants", "Submit the Foreigner Physical Examination Form or the published in-China residence-document substitute; the examination result is valid for six months.", "document", guide, undergraduate ? "Application Checklist item 10" : "Application Checklist item 11"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable CNY 600 application fee.", "document", guide, "Application Procedures and Study Term and Fees"),
    item("deadline", "application_policy", "required", "Fall 2026 self-sponsored applicants", undergraduate ? "Submit by July 10, 2026; the scholarship-program deadline is April 30, 2026." : "Submit by June 15, 2026; Chinese Government Scholarship and Shanghai Government Scholarship deadlines were February 15 and April 15, 2026 respectively.", "school_review", guide, "Application Deadline"),
  ] });
}

const templates: Array<{ document: RequirementDocument } & Record<string, unknown>> = [];
for (const [degree, programs] of grouped(bfsu.programs, (row) => row.degreeLevel)) {
  intakeCheck(bfsu, programs);
  templates.push({ key: `bfsu-${degree.toLowerCase()}-fall-2026`, schoolSlug: "beijing-foreign-studies-university", cycle: "fall-2026", targetProgramSlugs: programs.map((row) => row.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Fall 2026 is closed and must not be displayed as a current intake.", "Program-specific language scores are not stated in the captured BFSU catalogs and remain unfilled.", "Personal supervisor contact details are intentionally excluded."], document: bfsuDocument(degree) });
}
for (const [identity, programs] of grouped(ecust.programs, (row) => `${row.degreeLevel}|${row.teachingLanguage}`)) {
  intakeCheck(ecust, programs);
  const [degree, language] = identity.split("|");
  templates.push({ key: `ecust-${degree.toLowerCase()}-${language.toLowerCase().replace(/[^a-z]+/g, "-")}-fall-2026`, schoolSlug: "east-china-university-of-science-and-technology", cycle: "fall-2026", targetProgramSlugs: programs.map((row) => row.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Fall 2026 is closed and must not be displayed as a current intake.", "Where ECUST publishes bilingual teaching or different tuition by teaching language, no unconfirmed language selection is inferred.", "Bank account, remittance, personal-contact and passport-reminder details are intentionally excluded."], document: ecustDocument(degree, language) });
}
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete official-source application requirements for the captured closed Fall 2026 BFSU and ECUST degree routes." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: bfsu.programs.length + ecust.programs.length, targetedIntakeCount: bfsu.programIntakes.length + ecust.programIntakes.length, requirementItemCount: templates.reduce((sum, template) => sum + (template as { document: RequirementDocument }).document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
