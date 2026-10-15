import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-54.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-09-22T10-45-10-433Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage?: string; tuitionAmount?: number };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };

function requireSource(id: string, sha256: string): Source {
  const source = (manifest.sources as Source[]).find((row) => row.id === id);
  if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== sha256) {
    throw new Error(`LNUTCM requirement evidence mismatch: ${id}`);
  }
  return source;
}

const undergraduateSource = requireSource(
  "lnutcm-undergraduate-admissions-2026",
  "c21656d991347673388a8b5600feba61e7fec54125a4e775bb423744c2dbc885",
);
const masterSource = requireSource(
  "lnutcm-master-admissions-2026",
  "40b168c139b24341f1bbbfd426d68666da68ce12cfdf0670adc3c675548a7b79",
);
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.lnutcm-complete-batch-01.draft.json"), "utf8")) as Seed;
const undergraduatePrograms = seed.programs.filter((program) => program.degreeLevel === "Undergraduate");
const masterPrograms = seed.programs.filter((program) => program.degreeLevel === "Master");
if (undergraduatePrograms.length !== 1 || masterPrograms.length !== 34) throw new Error("Unexpected LNUTCM degree program set.");
for (const program of [...undergraduatePrograms, ...masterPrograms]) {
  const intake = seed.programIntakes.find((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2026);
  if (!intake || intake.status !== "closed") throw new Error(`Missing closed LNUTCM Fall 2026 intake: ${program.slug}`);
}
if (undergraduatePrograms[0].teachingLanguage !== "Chinese" || undergraduatePrograms[0].tuitionAmount !== 22000
  || masterPrograms.some((program) => program.teachingLanguage !== "Chinese" || program.tuitionAmount !== 28000)) {
  throw new Error("Unexpected LNUTCM language or tuition grouping.");
}

function sourceRecord(key: string, source: Source) {
  return { key, url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
}
function item(sourceKey: string, key: string, category: RequirementItem["category"], level: RequirementItem["level"],
  appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}

const undergraduateDocument = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [sourceRecord("undergraduate_guide", undergraduateSource)],
  requirements: [
    item("undergraduate_guide", "citizenship_health", "identity", "required", "International undergraduate applicants", "Be a non-Chinese citizen in good health.", "document", "Section III, item 1"),
    item("undergraduate_guide", "nationality_background", "identity", "conditional", "Applicants born abroad to one or two Chinese-citizen parents, or former Chinese citizens", "Meet the published four-year foreign-nationality and two-year overseas-residence rules measured through April 30, 2026 and submit the corresponding evidence.", "document", "Section III, nationality-background paragraphs"),
    item("undergraduate_guide", "education", "education", "required", "International undergraduate applicants", "Hold a high-school diploma or a higher qualification.", "document", "Section III, item 2"),
    item("undergraduate_guide", "hsk", "language", "required", "Chinese-taught undergraduate applicants", "Submit a New HSK Level 4 score of at least 180; the score report is valid for two years.", "official_result", "Section III, item 3 and Section IV.2, item 9"),
    item("undergraduate_guide", "csca", "academic_results", "required", "Traditional Chinese Medicine undergraduate applicants", "Submit CSCA Chinese for STEM and Mathematics results taken in Chinese by June 30, 2026.", "official_result", "Section III, item 4 and Section IV.2, item 10"),
    item("undergraduate_guide", "application_window", "application_policy", "required", "Fall 2026 self-funded applicants", "Submit the application from January 1 through June 30, 2026.", "school_review", "Section IV.1"),
    item("undergraduate_guide", "application_forms", "documents", "required", "Fall 2026 self-funded applicants", "Submit the self-funded student information import template and the LNUTCM international-student admission application form.", "document", "Section IV.2, items 1-2"),
    item("undergraduate_guide", "passport", "identity", "required", "Fall 2026 self-funded applicants", "Submit the passport photo page, inner blank page and, when applicable, the Chinese visa page.", "document", "Section IV.2, item 3"),
    item("undergraduate_guide", "in_china_documents", "documents", "conditional", "Applicants already in China", "Also submit the passport visa and entry-stamp pages with continuous status and the Temporary Residence Registration Form for Foreigners.", "document", "Section IV.2, item 3 note"),
    item("undergraduate_guide", "photos", "documents", "required", "Fall 2026 self-funded applicants", "Provide eight 3.5 cm by 4.9 cm ID photographs and an electronic copy between 100 KB and 500 KB.", "document", "Section IV.2, item 4"),
    item("undergraduate_guide", "diploma_transcripts", "documents", "required", "Fall 2026 self-funded applicants", "Submit notarized high-school-or-higher diploma evidence and transcripts with Chinese translations.", "document", "Section IV.2, item 5"),
    item("undergraduate_guide", "criminal_record", "documents", "required", "Fall 2026 self-funded applicants", "Submit a no-criminal-record certificate or the signed no-criminal-record commitment form.", "document", "Section IV.2, item 6"),
    item("undergraduate_guide", "financial_evidence", "documents", "required", "Fall 2026 self-funded applicants", "Submit a deposit certificate covering at least one year of tuition and living expenses.", "document", "Section IV.2, item 7"),
    item("undergraduate_guide", "physical_examination", "documents", "required", "Fall 2026 self-funded applicants", "Submit a complete Foreigner Physical Examination Form whose results are no more than six months old and include the required photograph, seal and physician or hospital signatures.", "document", "Section IV.2, item 8"),
    item("undergraduate_guide", "commitment", "documents", "required", "Fall 2026 self-funded applicants", "Submit the applicant integrity commitment form.", "document", "Section IV.2, item 11"),
    item("undergraduate_guide", "application_delivery", "application_policy", "required", "Fall 2026 self-funded applicants", "Send the electronic application materials to the International Education College admissions email for review.", "school_review", "Section IV.4"),
    item("undergraduate_guide", "registration_fee", "application_policy", "required", "Fall 2026 self-funded applicants", "Pay the CNY 800 registration fee.", "document", "Section IV.3, item 1"),
    item("undergraduate_guide", "tuition", "application_policy", "required", "Enrolled Traditional Chinese Medicine undergraduates", "Pay tuition of CNY 22,000 per academic year.", "document", "Section IV.3, item 2", "enrollment"),
    item("undergraduate_guide", "accommodation", "other", "required", "Students using university accommodation", "Budget CNY 9,600 to 18,000 per academic year depending on room type; the university notes that actual standards may be adjusted.", "document", "Section IV.3, item 3", "preparation"),
    item("undergraduate_guide", "insurance", "other", "required", "Self-funded enrolled students", "Purchase the required insurance at CNY 800 per person per year.", "document", "Section IV.3, item 4", "enrollment"),
  ],
});

const masterDocument = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [sourceRecord("master_guide", masterSource)],
  requirements: [
    item("master_guide", "citizenship_health", "identity", "required", "International master's applicants", "Be a non-Chinese citizen in good health.", "document", "Section III, item 1"),
    item("master_guide", "education", "education", "required", "International master's applicants", "Hold a bachelor's degree or a higher qualification.", "document", "Section III, item 2"),
    item("master_guide", "hsk", "language", "required", "Chinese-taught master's applicants", "Submit a New HSK Level 4 score of at least 180; the score report is valid for two years.", "official_result", "Section III and Section IV.2, item 11"),
    item("master_guide", "application_window", "application_policy", "required", "Fall 2026 self-funded master's applicants", "Submit the application from January 1 through June 30, 2026.", "school_review", "Section IV.1"),
    item("master_guide", "application_forms", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit the self-funded student information import template and the LNUTCM international-student admission application form.", "document", "Section IV.2, items 1-2"),
    item("master_guide", "passport", "identity", "required", "Fall 2026 self-funded master's applicants", "Submit the passport photo page, inner blank page and, when applicable, the Chinese visa page.", "document", "Section IV.2, item 3"),
    item("master_guide", "in_china_documents", "documents", "conditional", "Applicants already in China", "Also submit the passport visa and entry-stamp pages with continuous status and the Temporary Residence Registration Form for Foreigners.", "document", "Section IV.2, item 3 note"),
    item("master_guide", "photos", "documents", "required", "Fall 2026 self-funded master's applicants", "Provide eight 3.5 cm by 4.9 cm ID photographs and an electronic copy between 100 KB and 500 KB.", "document", "Section IV.2, item 4"),
    item("master_guide", "degree_transcripts", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit notarized bachelor's-or-higher degree evidence and complete undergraduate transcripts with Chinese translations; expected graduates may use an official pre-graduation certificate.", "document", "Section IV.2, item 5"),
    item("master_guide", "criminal_record", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit a no-criminal-record certificate or the signed no-criminal-record commitment form.", "document", "Section IV.2, item 6"),
    item("master_guide", "financial_evidence", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit a deposit certificate covering at least one year of tuition and living expenses.", "document", "Section IV.2, item 7"),
    item("master_guide", "study_plan", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit a Chinese- or English-language study and research plan of at least 800 words covering the intended major or research direction.", "document", "Section IV.2, item 8"),
    item("master_guide", "recommendations", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit two Chinese- or English-language recommendation letters from professors or associate professors.", "document", "Section IV.2, item 9"),
    item("master_guide", "physical_examination", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit a complete Foreigner Physical Examination Form whose results are no more than six months old and include the required photograph, seal and physician or hospital signatures.", "document", "Section IV.2, item 10"),
    item("master_guide", "commitment", "documents", "required", "Fall 2026 self-funded master's applicants", "Submit the applicant commitment letter.", "document", "Section IV.2, item 12"),
    item("master_guide", "supervisor_acceptance", "documents", "required", "Fall 2026 self-funded master's applicants", "Contact an LNUTCM master's supervisor, obtain agreement before applying, and submit the hand-signed supervisor acceptance-of-intent form.", "school_review", "Section IV.2, item 13"),
    item("master_guide", "application_delivery", "application_policy", "required", "Fall 2026 self-funded master's applicants", "Send the electronic application materials to the International Education College admissions office for review.", "school_review", "Section IV.5"),
    item("master_guide", "registration_fee", "application_policy", "required", "Fall 2026 self-funded master's applicants", "Pay the CNY 800 registration fee.", "document", "Section IV.4, item 1"),
    item("master_guide", "tuition", "application_policy", "required", "Enrolled master's students", "Pay tuition of CNY 28,000 per academic year.", "document", "Section IV.4, item 2", "enrollment"),
    item("master_guide", "accommodation", "other", "required", "Students using university accommodation", "Budget CNY 9,600 to 18,000 per academic year depending on room type.", "document", "Section IV.4, item 3", "preparation"),
    item("master_guide", "insurance", "other", "required", "Self-funded enrolled students", "Purchase the required insurance at CNY 800 per person per year.", "document", "Section IV.4, item 3", "enrollment"),
  ],
});

const templates = [
  {
    key: "lnutcm-undergraduate-tcm-fall-2026",
    schoolSlug: "liaoning-university-of-traditional-chinese-medicine",
    cycle: "fall-2026",
    targetProgramSlugs: undergraduatePrograms.map((program) => program.slug),
    targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be shown as a current application window."],
    document: undergraduateDocument,
  },
  {
    key: "lnutcm-master-chinese-fall-2026",
    schoolSlug: "liaoning-university-of-traditional-chinese-medicine",
    cycle: "fall-2026",
    targetProgramSlugs: masterPrograms.map((program) => program.slug),
    targetIntake: { term: "Fall", year: 2026 },
    targetBindingStatus: "ready",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be shown as a current application window."],
    document: masterDocument,
  },
];
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete official-source LNUTCM Fall 2026 undergraduate and master's requirements bound to exact catalog routes.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.length,
    blockedTemplateCount: 0,
    targetedProgramCount: undergraduatePrograms.length + masterPrograms.length,
    targetedIntakeCount: undergraduatePrograms.length + masterPrograms.length,
    requirementItemCount: undergraduateDocument.requirements.length + masterDocument.requirements.length,
  },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
