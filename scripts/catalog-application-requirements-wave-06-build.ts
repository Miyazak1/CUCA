import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-06.draft.json");
const programSlug = "liaoning-university-of-traditional-chinese-medicine-non-degree-chinese-language-self-funded-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/lnutcm-chinese-language-images-batch-01/manifest.json"), "utf8"));
const sources = new Map<string, Source>((manifest.sources as Source[]).map((row) => [row.id, row]));
const expected = {
  "lnutcm-chinese-language-guide-image-5-2026-2027": "0b81eb5160f3066f6dcf833eb4d649801cf58c7cea0bf33cfeb507536d245a0c",
  "lnutcm-chinese-language-guide-image-6-2026-2027": "ba5d1a094d82c000968b26f2b093f3b45ac73be780cb711addb8c27753a3f2df",
} as const;
for (const [id, sha256] of Object.entries(expected)) {
  const row = sources.get(id);
  if (!row || row.status !== 200 || row.contentType !== "image/png" || row.sha256 !== sha256) throw new Error(`LNUTCM requirement evidence mismatch: ${id}`);
}
const eligibility = sources.get("lnutcm-chinese-language-guide-image-5-2026-2027")!;
const application = sources.get("lnutcm-chinese-language-guide-image-6-2026-2027")!;
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.lnutcm-language-spring-2027.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("LNUTCM Spring 2027 self-funded program-intake binding is missing or not open.");
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] };
}
const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [
    { key: "lnutcm_eligibility", url: eligibility.url, title: eligibility.label, capturedAt: eligibility.fetchedAt, contentSha256: eligibility.sha256 },
    { key: "lnutcm_application", url: application.url, title: application.label, capturedAt: application.fetchedAt, contentSha256: application.sha256 },
  ],
  requirements: [
    item("citizenship_health", "identity", "required", "Applicants", "Be a non-Chinese citizen in good health.", "self_report", "lnutcm_eligibility", "Image 5, Application Conditions"),
    item("minimum_age", "identity", "required", "Applicants", "Be at least 18 years old.", "document", "lnutcm_eligibility", "Image 5, Application Conditions"),
    item("minimum_education", "education", "required", "Applicants", "Hold a high-school diploma or higher qualification.", "document", "lnutcm_eligibility", "Image 5, Application Conditions"),
    item("data_import_template", "documents", "required", "Applicants", "Complete the self-funded-student information import template available from the university download area.", "document", "lnutcm_application", "Image 6, Application Materials item 1"),
    item("application_form", "documents", "required", "Applicants", "Complete the Liaoning University of Traditional Chinese Medicine international-student admission application form.", "document", "lnutcm_application", "Image 6, Application Materials item 2"),
    item("passport_pages", "identity", "required", "Applicants", "Submit the passport photo page and inner pages. Applicants with prior China travel must also provide relevant visa pages; applicants currently in China must additionally provide the current visa and entry-stamp page.", "document", "lnutcm_application", "Image 6, Application Materials item 3"),
    item("highest_diploma", "education", "required", "Applicants", "Submit the highest academic diploma or graduation certificate.", "document", "lnutcm_application", "Image 6, Application Materials item 4"),
    item("academic_transcript", "academic_results", "required", "Applicants", "Submit the transcript for the highest completed academic qualification.", "document", "lnutcm_application", "Image 6, Application Materials item 5"),
    item("non_criminal_record", "documents", "required", "Applicants", "Submit a no-criminal-record certificate or sign the university's no-criminal-record undertaking.", "document", "lnutcm_application", "Image 6, Application Materials item 6"),
    item("integrity_undertaking", "documents", "required", "Applicants", "Sign the applicant integrity undertaking provided by the university.", "document", "lnutcm_application", "Image 6, Application Materials item 7"),
    item("physical_examination", "documents", "conditional", "Applicants studying for more than half a year", "Submit the Foreigner Physical Examination Form covering every listed item. The form must include the examining physician's signature, hospital stamp, and a stamped applicant photograph; results are valid for six months.", "document", "lnutcm_application", "Image 6, Application Materials item 8"),
    item("financial_certificate", "documents", "conditional", "Applicants studying for more than half a year", "Submit proof of funds covering at least one year of tuition and living expenses.", "document", "lnutcm_application", "Image 6, Application Materials item 9"),
    item("identification_photo", "documents", "required", "Applicants", "Submit a 3.5 cm by 4.9 cm identification photograph; the electronic file must be 100-500 KB.", "document", "lnutcm_application", "Image 6, Application Materials item 10"),
    item("electronic_submission", "application_policy", "required", "Applicants", "Submit the electronic application-material package to the university's official International Education College admissions office for filing and review.", "school_review", "lnutcm_application", "Image 6, Application Process"),
    item("deadline", "application_policy", "required", "Spring 2027 applicants", "Submit the application by December 25, 2026.", "document", "lnutcm_eligibility", "Image 5, Application Period, Spring 2027 intake"),
    item("fees_at_enrollment", "application_policy", "required", "Admitted self-funded students", "Pay the required tuition and accommodation charges at enrollment according to the admission notice. Registration, insurance and other applicable charges are separate.", "school_review", "lnutcm_application", "Image 6, Fees and payment timing", "enrollment"),
  ],
});

const template = {
  key: "lnutcm-chinese-language-self-funded-spring-2027",
  schoolSlug: "liaoning-university-of-traditional-chinese-medicine",
  cycle: "spring-2027",
  targetProgramSlugs: [programSlug],
  targetIntake: { term: "Spring", year: 2027 },
  targetBindingStatus: "ready",
  reviewStatus: "unreviewed",
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit_from_visually_reviewed_images" },
  unresolvedNotes: ["The English requirement wording is an editorial translation of the official Chinese brochure and requires review before publication."],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete source-located Spring 2027 self-funded Chinese-language application requirements with an exact open intake binding.",
  },
  summary: {
    templateCount: 1,
    readyTemplateCount: 1,
    blockedTemplateCount: 0,
    targetedProgramCount: 1,
    targetedIntakeCount: 1,
    requirementItemCount: document.requirements.length,
  },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
