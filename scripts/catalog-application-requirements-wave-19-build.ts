import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-19.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T07-50-25-401Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const source = (manifest.sources as Source[]).find((row) => row.id === "pkuhsc-international-undergraduate-admissions-zh-2026");
if (!source || source.status !== 200 || source.contentType !== "text/html"
  || source.sha256 !== "13450df25f70871a250857002b68b56079ab87f087cdfbb857dd00e7f97e75dd") {
  throw new Error("Peking University Health Science Center requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.pkuhsc-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
const targetProgramSlugs = [
  "peking-university-health-science-center-clinical-medicine",
  "peking-university-health-science-center-oral-medicine",
];
for (const slug of targetProgramSlugs) {
  if (!seed.programs.some((program) => program.slug === slug)) throw new Error(`Missing PKUHSC program: ${slug}`);
  if (!seed.programIntakes.some((intake) => intake.programSlug === slug && intake.intakeTerm === "Fall"
    && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed PKUHSC Fall 2026 intake: ${slug}`);
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "pkuhsc_undergraduate", locator }] };
}

const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [{ key: "pkuhsc_undergraduate", url: source.url, title: source.label,
    capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship", "identity", "required", "International undergraduate applicants", "Hold a valid foreign passport and be a non-Chinese citizen.", "document", "Section II, eligibility item 1"),
    item("foreign_residence_history", "identity", "conditional", "Applicants born abroad to one or two Chinese-citizen parents settled abroad", "Have held a valid foreign passport or nationality certificate since before April 30, 2022 and have actually resided abroad for at least two years between April 30, 2022 and April 30, 2026; nine months abroad in a year counts as one year.", "document", "Section II, eligibility item 1(1)"),
    item("former_chinese_resident_history", "identity", "conditional", "Former residents of mainland China, Hong Kong, Macao or Taiwan who later acquired foreign nationality", "Have held a valid foreign passport or nationality certificate since before April 30, 2022, provide proof that Chinese nationality was cancelled, and have actually resided abroad for at least two years between April 30, 2022 and April 30, 2026; nine months abroad in a year counts as one year.", "document", "Section II, eligibility item 1(2)"),
    item("age_and_education", "education", "required", "International undergraduate applicants", "Be 17 to 30 years old and hold at least a high-school graduation qualification.", "document", "Section II, eligibility item 2"),
    item("health", "other", "required", "International undergraduate applicants", "Be in good health and meet the admission conditions for the chosen medical program.", "school_review", "Section II, eligibility item 3"),
    item("application_window", "application_policy", "required", "Self-funded Fall 2026 applicants", "Apply online in either the first batch from December 12, 2025 through February 28, 2026 or the second batch from March 30 through April 30, 2026.", "document", "Section III.2(1), online application periods"),
    item("csca_accepted_sessions", "academic_results", "required", "Self-funded Fall 2026 applicants", "First-batch applicants must submit a CSCA result from December 2025 or January 2026; second-batch applicants must submit a result from March or April 2026.", "official_result", "Section III.2(1), accepted CSCA sessions"),
    item("csca_subjects", "academic_results", "required", "Self-funded Fall 2026 applicants", "Submit CSCA results for STEM Chinese, Mathematics in Chinese, Physics in Chinese and Chemistry in Chinese.", "official_result", "Section III.2(1), CSCA subject list"),
    item("profile_photo", "documents", "required", "Self-funded applicants", "Upload a recent standard identification photograph as the system profile image.", "document", "Section III.2(1), material item 1"),
    item("passport_and_visa", "documents", "required", "Self-funded applicants", "Upload the passport photo page and, when applicable, the current Chinese visa page.", "document", "Section III.2(1), material item 2"),
    item("prior_diploma", "documents", "required", "Self-funded applicants", "Upload a notarized diploma for the preceding stage of education.", "document", "Section III.2(1), material item 3"),
    item("transcripts_and_csca", "documents", "required", "Self-funded applicants", "Upload notarized transcripts for the preceding stage of education together with the CSCA score report.", "official_result", "Section III.2(1), material item 4"),
    item("physical_examination", "documents", "required", "Self-funded applicants", "Upload physical-examination results covering the basic examination items and a liver-function laboratory test.", "document", "Section III.2(1), material item 5"),
    item("clinical_medicine_hsk", "language", "conditional", "Clinical Medicine applicants", "Upload an HSK Level 5 certificate.", "official_result", "Section III.2(1), material item 6"),
    item("oral_medicine_hsk", "language", "conditional", "Oral Medicine applicants", "Upload an HSK Level 6 certificate.", "official_result", "Section III.2(1), material item 6"),
    item("financial_capacity", "documents", "required", "Self-funded applicants", "Provide a bank balance certificate showing more than CNY 400,000; other forms of financial evidence are not accepted.", "document", "Section III.2(1), material item 7"),
    item("guardian_identity", "documents", "conditional", "Applicants under 18", "Provide the guardian's identity document.", "document", "Section III.2(1), material item 8"),
    item("supporting_evidence", "documents", "recommended", "Self-funded applicants", "Applicants may provide other documents demonstrating learning ability or overall qualifications.", "document", "Section III.2(1), material item 8"),
    item("pdf_upload_format", "application_policy", "required", "Self-funded applicants", "Prepare each of materials 3 through 8 as a separate, clear and readable PDF before upload.", "school_review", "Section III.2(1), online-submission note 1"),
    item("graduating_applicants", "education", "conditional", "Applicants who have not yet completed the preceding qualification", "Upload official expected-graduation evidence and, if admitted, present the original graduation certificate at registration.", "document", "Section III.2(1), online-submission note 2", "enrollment"),
    item("material_completion_deadline", "application_policy", "conditional", "Applicants notified that materials are incomplete", "Complete missing materials by March 5, 2026 for the first batch or May 11, 2026 for the second batch; late supplements are not accepted.", "school_review", "Section III.2(1), online-submission note 3"),
    item("application_fee", "application_policy", "required", "Applicants selected for interview", "Pay the non-refundable CNY 800 application fee before the interview; applicants who do not pay on time cannot take the examination.", "document", "Section III.2(2), application fee"),
    item("interview_selection", "application_policy", "required", "Self-funded applicants", "Undergo the university's screening of prior academic results and CSCA results to determine whether the applicant advances to interview.", "school_review", "Section III.2(3), interview selection"),
    item("online_interview", "application_policy", "required", "Applicants selected for interview", "Attend an online interview conducted in Chinese; the interview assesses language expression, logical thinking, practical ability, communication, psychological quality and professional interest.", "school_review", "Section III.2(3), interview format and content"),
    item("admission_assessment", "academic_results", "required", "Interviewed applicants", "Admission is determined through a comprehensive review of prior-stage grades, CSCA results and interview performance.", "school_review", "Section III.2(4), admission"),
    item("registration", "application_policy", "required", "Admitted applicants", "Obtain the required visa or residence permission and register in late August or early September 2026 on the date stated in the admission notice.", "document", "Section III.2(5), enrollment and registration", "enrollment"),
    item("tuition", "application_policy", "required", "Self-funded undergraduates", "Pay tuition of CNY 45,000 per academic year.", "document", "Section IV, fee item 1", "enrollment"),
    item("off_campus_accommodation", "other", "required", "Self-funded undergraduates", "Arrange off-campus accommodation because university dormitory accommodation is not provided to self-funded undergraduates; the university states that it will provide appropriate assistance.", "self_report", "Section IV, fee and notice item 2", "preparation"),
    item("medical_insurance", "documents", "required", "All international students", "Pay CNY 800 per year for comprehensive international-student insurance; insurance is required before student-status registration.", "document", "Section IV, fee item 3", "enrollment"),
    item("other_costs", "application_policy", "required", "Self-funded undergraduates", "Pay textbook, medical, transportation and meal expenses separately.", "self_report", "Section IV, fee item 4", "enrollment"),
  ],
});

const template = {
  key: "pkuhsc-undergraduate-fall-2026",
  schoolSlug: "peking-university-health-science-center",
  cycle: "fall-2026",
  targetProgramSlugs,
  targetIntake: { term: "Fall", year: 2026 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [
    "This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window.",
    "The guide refers Chinese Government Scholarship applicants to Chinese embassies or consulates but does not publish a university-managed scholarship application route in this source.",
    "The source publishes HSK levels but does not state a minimum numeric HSK score.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located PKUHSC Fall 2026 medical undergraduate requirements bound only to exact existing program-intake records." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0,
    targetedProgramCount: targetProgramSlugs.length, targetedIntakeCount: targetProgramSlugs.length,
    requirementItemCount: document.requirements.length },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
