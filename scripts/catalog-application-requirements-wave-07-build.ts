import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-07.draft.json");
const programSlug = "sichuan-international-studies-university-chinese-language-study-2026-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string };
type CatalogSeed = { programs: { slug: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string }[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/2026-10-15T03-28-43-144Z/manifest.json"), "utf8"));
const sources = new Map<string, Source>((manifest.sources as Source[]).map((row) => [row.id, row]));
const source = sources.get("sisu-chinese-language-admissions-2026-2027");
const expectedSha256 = "125e479ea88010d4dae90ecbb6b901725d7723bd0893379304f17d88d173b52c";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("SISU Chinese-language requirement evidence mismatch.");
}
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.sisu-complete-batch-01.draft.json"), "utf8")) as CatalogSeed;
if (!seed.programs.some((program) => program.slug === programSlug)) throw new Error("SISU Chinese-language program binding is missing.");
const targetIntakes = [
  { term: "Spring", year: 2027, deadline: "December 15, 2026", round: "March 2027" },
  { term: "Late Spring", year: 2027, deadline: "March 30, 2027", round: "May 2027" },
] as const;
for (const target of targetIntakes) {
  if (!seed.programIntakes.some((intake) => intake.programSlug === programSlug && intake.intakeTerm === target.term
    && intake.intakeYear === target.year && intake.status === "open")) {
    throw new Error(`SISU ${target.term} ${target.year} program-intake binding is missing or not open.`);
  }
}

function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string,
  ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string,
  stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "sisu_language", locator }] };
}

function documentFor(target: typeof targetIntakes[number]) {
  return parseRequirementDocument({
    schemaVersion: 1,
    language: "en",
    coverage: "complete",
    sources: [{ key: "sisu_language", url: source!.url, title: source!.label, capturedAt: source!.fetchedAt, contentSha256: source!.sha256 }],
    requirements: [
      item("citizenship", "identity", "required", "Applicants", "Be a non-Chinese citizen.", "document", "Section 1, 招生对象"),
      item("health", "identity", "required", "Applicants", "Be in good health.", "self_report", "Section 1, 招生对象"),
      item("no_criminal_record_eligibility", "identity", "required", "Applicants", "Have no criminal record.", "self_report", "Section 1, 招生对象"),
      item("age_range", "identity", "required", "Applicants", "Be between 16 and 60 years old.", "document", "Section 1, 招生对象"),
      item("online_application", "application_policy", "required", "Applicants", "Apply online through the Sichuan International Studies University international-student service platform and submit the required application materials.", "school_review", "Section 4, 申请流程, item 1"),
      item("school_assessment", "application_policy", "required", "Applicants", "Complete the university's application-material review and applicant assessment.", "school_review", "Section 4, 申请流程, item 2"),
      item("passport", "identity", "required", "Applicants", "Submit a scan of the passport information page. The passport must remain valid beyond the expected program completion date.", "document", "Section 6, 申请材料, item 1"),
      item("non_criminal_record_certificate", "documents", "required", "Applicants", "Submit a valid no-criminal-record certificate issued by the competent local public-security authority, normally within six months before the application date. Documents in languages other than Chinese or English require a notarized Chinese or English translation.", "document", "Section 6, 申请材料, item 2"),
      item("physical_examination", "documents", "required", "Applicants", "Submit the Foreigner Physical Examination Form with every required examination item completed. A form is invalid if an item is missing, the applicant photograph is absent or lacks a cross-page stamp, or the physician and hospital signatures or stamps are absent. Examination results are valid for six months.", "document", "Section 6, 申请材料, item 3"),
      item("identification_photo", "documents", "required", "Applicants", "Submit a recent bareheaded identification photograph.", "document", "Section 6, 申请材料, item 4"),
      item("deadline", "application_policy", "required", `${target.round} applicants`, `Submit the application by ${target.deadline}.`, "document", `Section 5, 入学时间及申请截止日期, ${target.round} intake`),
    ],
  });
}

const templates = targetIntakes.map((target) => {
  const document = documentFor(target);
  return {
    key: `sisu-chinese-language-${target.term.toLowerCase().replace(/\s+/g, "-")}-2027`,
    schoolSlug: "sichuan-international-studies-university",
    cycle: "spring-2027",
    targetProgramSlugs: [programSlug],
    targetIntake: { term: target.term, year: target.year },
    targetBindingStatus: "ready",
    reviewStatus: "unreviewed",
    fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "explicit" },
    unresolvedNotes: ["The English requirement wording is an editorial translation of the official Chinese guide and requires review before publication."],
    document,
  };
});
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete source-located SISU Chinese-language application requirements with exact March and May 2027 intake bindings.",
  },
  summary: {
    templateCount: templates.length,
    readyTemplateCount: templates.length,
    blockedTemplateCount: 0,
    targetedProgramCount: 1,
    targetedIntakeCount: templates.length,
    requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0),
  },
  templates,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
