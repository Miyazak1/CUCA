import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-04.draft.json");
const programSlug = "qingdao-university-non-degree-chinese-language-spring-2027";
type ManifestSource = { id: string; label: string; url: string; fetchedAt: string; status: number; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const json = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const manifest = await json("work/catalog-official/refresh-20261014-qdu-chinese-language-spring-2027/manifest.json");
const source = (manifest.sources as ManifestSource[]).find((row) => row.id === "qdu-chinese-language-guide-pdf-spring-2027");
if (!source || source.status !== 200 || source.sha256 !== "8d1d53c41f45e9e4a56617b95250f6c743714cd118fceb41a1e85b4ecf1b99b1") throw new Error("QDU Spring 2027 evidence mismatch.");
const seed = await json("seeds/catalog.qdu-complete-batch-01.draft.json") as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)
  || !seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === "Spring" && intake.intakeYear === 2027 && intake.status === "open")) {
  throw new Error("QDU Spring 2027 program-intake binding is missing or not open.");
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string): RequirementItem {
  return { key, category, stage: "submission", level, appliesTo, ruleText, evidenceType,
    references: [{ sourceKey: "qdu_spring_2027", locator }] };
}
const document: RequirementDocument = parseRequirementDocument({
  schemaVersion: 1, language: "en", coverage: "partial",
  sources: [{ key: "qdu_spring_2027", url: source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 }],
  requirements: [
    item("citizenship_passport", "identity", "required", "Spring 2027 Chinese Language Program applicants", "Be a non-Chinese citizen holding a valid foreign passport.", "document", "Page 1, 'Entry requirements', first line"),
    item("conduct", "identity", "required", "Applicants", "Have no criminal record and agree to comply with Chinese law, regulations and university discipline.", "self_report", "Page 1, 'Entry requirements', second line"),
    item("health", "identity", "required", "Applicants", "Meet China's health-examination standard for international students.", "document", "Page 1, 'Entry requirements', health line"),
    item("age", "identity", "required", "Applicants", "Be between 18 and 50 years old.", "document", "Page 1, 'Entry requirements', age line"),
    item("application_form", "documents", "required", "Applicants", "Complete the online application form truthfully and choose the program according to the intended study plan.", "self_report", "Pages 1-2, 'Application Materials' item 1 and 'Online application process' step 1"),
    item("financial_guarantee", "documents", "required", "Applicants", "Complete the financial-guarantee information requested in the online form.", "self_report", "Page 1, Chinese 'Application Materials' item 1"),
    item("passport_copy", "identity", "required", "Applicants", "Upload a clear scanned copy of the passport information page.", "document", "Page 1, 'Application Materials' item 2"),
    item("education_records", "education", "required", "Applicants", "Upload current-enrollment evidence or the highest diploma together with the academic transcript.", "document", "Page 1, 'Application Materials' item 3"),
    item("physical_exam", "documents", "required", "Applicants", "Upload physical-examination evidence.", "document", "Page 1, 'Application Materials' item 4"),
    item("non_criminal_record", "documents", "required", "Applicants", "Upload a certificate of no criminal record.", "document", "Page 1, 'Application Materials' item 5"),
    item("application_fee", "application_policy", "required", "Applicants", "Pay the non-refundable RMB 400 application fee after pre-evaluation. Payment instructions are sent through the application system; payment-account details are intentionally excluded from this dataset.", "school_review", "Pages 1-2, 'Application Materials' item 6 and application-process step 2"),
    item("deadline", "application_policy", "required", "Spring 2027 applicants", "Submit the application before December 11, 2026.", "document", "Page 1, 'Application Duration'"),
  ],
});

const template = {
  key: "qdu-chinese-language-spring-2027", schoolSlug: "qingdao-university", cycle: "spring-2027",
  targetProgramSlugs: [programSlug], targetIntake: { term: "Spring", year: 2027 }, targetBindingStatus: "ready",
  reviewStatus: "unreviewed", fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit" },
  unresolvedNotes: ["Publication still requires the repository's requirement-review workflow; this draft does not authorize a database write."], document,
};
const output = { version: 1, generatedAt: new Date().toISOString(),
  handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false,
    purpose: "Source-located current Spring 2027 application requirements with an exact open program-intake binding." },
  summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 1,
    targetedIntakeCount: 1, requirementItemCount: document.requirements.length }, templates: [template] };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
