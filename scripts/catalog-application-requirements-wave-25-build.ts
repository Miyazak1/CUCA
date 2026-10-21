import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-25.draft.json");
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T08-28-30-939Z/manifest.json"), "utf8"));
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage?: string; cscaSubjects?: string[] };
type CatalogSeed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const source = (manifest.sources as Source[]).find((row) => row.id === "qinhuangdao-ysu-international-admission-guide-pdf-2-2026");
if (!source || source.status !== 200 || source.contentType !== "application/pdf"
  || source.sha256 !== "f6517f43679db0bc12fa6e2a523cd7f978f840578383b2106012f921191c48fe") {
  throw new Error("Yanshan requirement evidence mismatch.");
}
const reviewedSource = source;
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.yanshan-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (seed.programs.length !== 63 || seed.programIntakes.length !== 64) throw new Error("Unexpected Yanshan complete seed.");
for (const program of seed.programs) {
  const expected = program.degreeLevel === "Non-degree" ? ["Spring", "Fall"] : ["Fall"];
  for (const term of expected) {
    if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === term
      && intake.intakeYear === 2026 && intake.status === "closed")) throw new Error(`Missing closed Yanshan intake: ${program.slug}:${term}`);
  }
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "yanshan_guide", locator }] };
}

const onlineSubmission = item("online_submission", "application_policy", "required", "All 2026 applicants",
  "Apply through the Yanshan international admission system and upload high-definition scans of every required document; mobile-phone or camera images and ordinary copies are not accepted.",
  "school_review", "brochure pages 3-6, online-submission note");
const commonIdentity = (degree: string, maximumAge: number, education: string): RequirementItem[] => [
  item("citizenship_health", "identity", "required", `${degree} applicants`, "Be a physically healthy non-Chinese citizen holding a valid foreign passport.", "document", `brochure ${degree} application requirements`),
  item("age", "identity", "required", `${degree} applicants`, `Be at least 18 and no older than ${maximumAge}.`, "document", `brochure ${degree} application requirements`),
  item("nationality_rules", "identity", "required", `${degree} applicants`, "Satisfy the nationality-status rules issued by China's Ministry of Education.", "school_review", `brochure ${degree} application requirements`),
  item("education", "education", "required", `${degree} applicants`, education, "document", `brochure ${degree} application requirements`),
  item("photo", "documents", "required", `${degree} applicants`, "Submit a white-background two-inch ID photo, 30-80 KB, showing the applicant above the shoulders without accessories.", "document", `brochure ${degree} application checklist`),
  item("passport", "documents", "required", `${degree} applicants`, "Submit the passport information page; passport validity must extend to March 1, 2027 or later.", "document", `brochure ${degree} application checklist`),
  item("academic_records", "documents", "required", `${degree} applicants`, "Submit the applicable academic transcripts and student-status certificate or graduation certificate; documents not in Chinese or English require a notarized translation.", "document", `brochure ${degree} application checklist`),
  item("financial_support", "documents", "required", `${degree} applicants`, "Submit a personal bank statement showing financial support above USD 5,000.", "document", `brochure ${degree} application checklist`),
  item("no_criminal_record", "documents", "required", `${degree} applicants`, "Submit a certificate of no criminal record.", "document", `brochure ${degree} application checklist`),
  item("physical_examination", "documents", "required", `${degree} applicants`, "Submit a Foreigner Physical Examination Record valid for six months.", "document", `brochure ${degree} application checklist`),
  onlineSubmission,
];
const languageItems = (degree: string, language: string): RequirementItem[] => {
  const result: RequirementItem[] = [];
  if (language.includes("Chinese")) result.push(item("chinese_requirement", "language", language === "Chinese" ? "required" : "conditional",
    `${degree} applicants selecting Chinese-taught study`, "Submit HSK Level 4.", "official_result", `brochure ${degree} application requirements`));
  if (language.includes("English")) result.push(item("english_requirement", "language", language === "English" ? "required" : "conditional",
    `${degree} applicants selecting English-taught study whose country's official mother tongue is not English`,
    "Submit Academic IELTS 6.0 overall with every band at least 5.5, TOEFL 85 overall with every band at least 20, GRE 300, Duolingo 95, equivalent proof, or evidence that the highest qualification was taught in English.",
    "official_result", `brochure ${degree} application requirements`));
  return result;
};
const costItems = (degree: "Undergraduate" | "Master" | "Doctoral", language: string): RequirementItem[] => {
  const tuition = degree === "Undergraduate" ? "Pay undergraduate tuition of CNY 15,700 per academic year."
    : degree === "Master" && language === "Chinese" ? "Pay master's tuition of CNY 19,800 per academic year."
      : degree === "Master" && language === "English" ? "Pay master's tuition of CNY 24,800 per academic year."
        : degree === "Master" ? "Pay master's tuition of CNY 19,800 per academic year for Chinese-taught study or CNY 24,800 for English-taught study."
          : language === "Chinese" ? "Pay doctoral tuition of CNY 23,100 per academic year."
            : language === "English" ? "Pay doctoral tuition of CNY 28,100 per academic year."
              : "Pay doctoral tuition of CNY 23,100 per academic year for Chinese-taught study or CNY 28,100 for English-taught study.";
  return [
    item("tuition", "application_policy", "required", `${degree} students`, tuition, "document", "brochure page 7 fee table", "enrollment"),
    item("insurance", "documents", "required", `${degree} students`, "Purchase 12-month insurance under the published CNY 1,000 or CNY 1,200 option.", "document", "brochure page 7 fee table", "enrollment"),
    item("accommodation", "other", "conditional", "Students using university accommodation", "Budget CNY 9,600 for a ten-month shared bed, CNY 10,600 per academic year per bed, or CNY 21,200 per year for a single independent room.", "self_report", "brochure page 7 fee table", "preparation"),
  ];
};

function degreeDocument(degree: "Undergraduate" | "Master" | "Doctoral", language: string, csca?: string[]) {
  const maximumAge = degree === "Undergraduate" ? 25 : degree === "Master" ? 35 : 40;
  const education = degree === "Undergraduate" ? "Hold a high-school diploma or equivalent with good academic performance and provide the formal graduation certificate before enrollment."
    : degree === "Master" ? "Hold a bachelor's degree or equivalent with good academic performance and provide the formal graduation certificate before enrollment."
      : "Hold a master's degree or equivalent with good academic performance and provide the formal graduation certificate before enrollment.";
  const page = degree === "Undergraduate" ? 3 : degree === "Master" ? 4 : 5;
  const requirements: RequirementItem[] = [
    ...commonIdentity(degree, maximumAge, education),
    ...languageItems(degree, language),
    item("recommendations", "documents", "required", `${degree} applicants`, degree === "Undergraduate"
      ? "Submit recommendation letters from two course teachers."
      : "Submit recommendation letters from two professors holding at least associate-professor rank.", "document", `brochure page ${page} application checklist`),
    item("registration_fee", "application_policy", "required", `${degree} applicants`, `Pay the CNY ${degree === "Undergraduate" ? "600" : "800"} registration fee.`, "document", `brochure page ${page} application checklist`),
    item("awards_and_publications", "documents", "recommended", `${degree} applicants`, "Optionally submit awards, publications and other evidence of learning ability and comprehensive quality.", "document", `brochure page ${page} application checklist`),
    item("deadline", "application_policy", "required", `Fall 2026 ${degree} applicants`, "Submit the degree-program application by June 15, 2026.", "document", "brochure page 10 deadline table"),
    ...costItems(degree, language),
  ];
  if (degree === "Undergraduate" && csca) requirements.push(
    item("csca", "academic_results", "required", "Undergraduate applicants", `Submit CSCA results before the program deadline for: ${csca.join(", ")}.`, "official_result", "brochure page 3 program and CSCA tables"),
  );
  if (degree !== "Undergraduate") requirements.push(
    item("acceptance_letter", "documents", "required", `${degree} applicants`, `Contact a ${degree.toLowerCase()} supervisor independently and submit the resulting acceptance letter.`, "document", `brochure page ${page} application checklist`),
  );
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "yanshan_guide", url: reviewedSource.url, title: reviewedSource.label, capturedAt: reviewedSource.fetchedAt, contentSha256: reviewedSource.sha256 }], requirements });
}

function languageDocument(term: "Spring" | "Fall") {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete",
    sources: [{ key: "yanshan_guide", url: reviewedSource.url, title: reviewedSource.label, capturedAt: reviewedSource.fetchedAt, contentSha256: reviewedSource.sha256 }],
    requirements: [
      item("citizenship_health", "identity", "required", "Chinese-language applicants", "Be a physically healthy non-Chinese citizen holding a valid foreign passport.", "document", "brochure page 6 requirements"),
      item("age", "identity", "required", "Chinese-language applicants", "Be at least 18 and no older than 45.", "document", "brochure page 6 requirements"),
      item("education", "education", "required", "Chinese-language applicants", "Hold a high-school diploma or equivalent and provide the formal graduation certificate before enrollment.", "document", "brochure page 6 requirements"),
      item("photo", "documents", "required", "Chinese-language applicants", "Submit a white-background two-inch ID photo, 30-80 KB, showing the applicant above the shoulders without accessories.", "document", "brochure page 6 checklist"),
      item("passport", "documents", "required", "Chinese-language applicants", "Submit the passport information page; passport validity must extend to March 1, 2027 or later.", "document", "brochure page 6 checklist"),
      item("academic_records", "documents", "required", "Chinese-language applicants", "Submit highest-stage transcripts and student-status or graduation evidence; documents not in Chinese or English require a notarized translation.", "document", "brochure page 6 checklist"),
      item("financial_support", "documents", "required", "Chinese-language applicants", "Submit a personal bank statement showing financial support above USD 5,000.", "document", "brochure page 6 checklist"),
      item("no_criminal_record", "documents", "required", "Chinese-language applicants", "Submit a certificate of no criminal record.", "document", "brochure page 6 checklist"),
      item("physical_examination", "documents", "required", "Chinese-language applicants", "Submit a Foreigner Physical Examination Record valid for six months.", "document", "brochure page 6 checklist"),
      item("registration_fee", "application_policy", "required", "Chinese-language applicants", "Pay the CNY 400 registration fee.", "document", "brochure page 6 checklist"),
      onlineSubmission,
      item("deadline", "application_policy", "required", `${term} 2026 Chinese-language applicants`, term === "Spring"
        ? "Submit by December 15, 2025, derived from the 2026 guide's Spring Semester December 15 row."
        : "Submit by June 15, 2026.", "document", "brochure page 10 deadline table"),
      item("tuition", "application_policy", "required", "Chinese-language students", "Pay CNY 7,000 per semester or CNY 14,000 per academic year.", "document", "brochure page 7 fee table", "enrollment"),
      item("insurance", "documents", "required", "Chinese-language students", "Purchase six-month insurance under the published CNY 500 or CNY 600 option, or 12-month insurance under the CNY 1,000 or CNY 1,200 option.", "document", "brochure page 7 fee table", "enrollment"),
      item("accommodation", "other", "conditional", "Chinese-language students using university accommodation", "Budget CNY 4,800 per semester per bed, CNY 9,600 for ten months per bed, or CNY 21,200 per year for a single independent room.", "self_report", "brochure page 7 fee table", "preparation"),
    ],
  });
}

const group = (degree: string, language: string, cscaKey?: string) => seed.programs.filter((program) => program.degreeLevel === degree
  && program.teachingLanguage === language && (cscaKey === undefined || (program.cscaSubjects ?? []).join("|") === cscaKey));
const undergraduateGroups = [
  group("Undergraduate", "English", "Mathematics|Physics"),
  group("Undergraduate", "Chinese", "Chinese (Humanities)|Mathematics"),
  group("Undergraduate", "Chinese", "Chinese (Humanities)|Mathematics|Physics"),
  group("Undergraduate", "Chinese", "Chinese (STEM)|Mathematics"),
  group("Undergraduate", "Chinese", "Chinese (STEM)|Mathematics|Physics|Chemistry"),
];
if (undergraduateGroups.reduce((sum, rows) => sum + rows.length, 0) !== 13 || undergraduateGroups.some((rows) => rows.length === 0)) {
  throw new Error("Yanshan undergraduate requirement groups are incomplete.");
}
const templates: Record<string, unknown>[] = [];
for (const [index, rows] of undergraduateGroups.entries()) templates.push({
  key: `yanshan-undergraduate-group-${index + 1}-fall-2026`, schoolSlug: "yanshan-university", cycle: "fall-2026",
  targetProgramSlugs: rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready",
  reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
  document: degreeDocument("Undergraduate", rows[0].teachingLanguage ?? "Chinese", rows[0].cscaSubjects),
});
for (const degree of ["Master", "Doctoral"] as const) for (const language of ["Chinese", "English", "Chinese / English"]) {
  const rows = group(degree, language);
  if (rows.length === 0) throw new Error(`Missing Yanshan ${degree} ${language} group.`);
  templates.push({ key: `yanshan-${degree.toLowerCase()}-${language.toLowerCase().replaceAll(" / ", "-")}-fall-2026`,
    schoolSlug: "yanshan-university", cycle: "fall-2026", targetProgramSlugs: rows.map((program) => program.slug),
    targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
    unresolvedNotes: ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
    document: degreeDocument(degree, language) });
}
const languageSlug = "official-2026-yanshan-chinese-language-and-literature-nondegree";
for (const term of ["Spring", "Fall"] as const) templates.push({
  key: `yanshan-chinese-language-${term.toLowerCase()}-2026`, schoolSlug: "yanshan-university", cycle: `${term.toLowerCase()}-2026`,
  targetProgramSlugs: [languageSlug], targetIntake: { term, year: 2026 }, targetBindingStatus: "ready", reviewStatus: "unreviewed",
  fieldAssessment: { cycle: term === "Spring" ? "derived_from_guide_context" : "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: term === "Spring" ? ["The December 15, 2025 deadline is derived from the 2026 guide's Spring Semester row and requires editorial confirmation before publication."]
    : ["This is a closed historical Fall 2026 route and must not be presented as a current 2027 application window."],
  document: languageDocument(term),
});
const typedTemplates = templates as Array<{ targetProgramSlugs: string[]; document: { requirements: unknown[] } }>;
const output = {
  version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located complete-scope Yanshan 2026 requirements bound only to exact closed program-intake records." },
  summary: { templateCount: typedTemplates.length, readyTemplateCount: typedTemplates.length, blockedTemplateCount: 0,
    targetedProgramCount: seed.programs.length, targetedIntakeCount: seed.programIntakes.length,
    requirementItemCount: typedTemplates.reduce((total, template) => total + template.document.requirements.length, 0) },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
