import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-53.draft.json");

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText: string; sourceSha256?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[] };

const expected = new Map([
  ["tsinghua-zijing-global-talents-engineering-2027", "8fa2cbe5148d5f22bb2824a088ee26312409cea1ef7c8bca6407a70f53036473"],
  ["tsinghua-international-undergraduate-upload-documents-2027", "eea757838c711069c937b720331fa102eb947c6f57329110901c0a8a2aeb22b5"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const source of manifest.sources ?? []) {
      if (source.status === 200 && expected.get(source.id) === source.sha256) evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) {
  throw new Error(`Missing locked Tsinghua 2027 evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
}

const sourceRecord = (key: string, id: string) => {
  const source = evidence.get(id)!;
  return { key, url: source.finalUrl ?? source.url, title: source.label, capturedAt: source.fetchedAt, contentSha256: source.sha256 };
};
const item = (
  key: string,
  category: RequirementItem["category"],
  level: RequirementItem["level"],
  appliesTo: string,
  ruleText: string,
  evidenceType: RequirementItem["evidenceType"],
  sourceKey: string,
  locator: string,
  stage: RequirementItem["stage"] = "submission",
): RequirementItem => ({ key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] });

const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.tsinghua-complete-batch-01.draft.json"), "utf8")) as Seed;
const guideSha256 = expected.get("tsinghua-zijing-global-talents-engineering-2027")!;
const programs = seed.programs.filter((program) => program.sourceSha256 === guideSha256);
if (programs.length !== 8) throw new Error(`Expected eight current Zijing routes, found ${programs.length}.`);
for (const program of programs) {
  if (program.degreeLevel !== "Undergraduate" || program.teachingLanguage !== "English" || program.tuitionText !== "RMB 100,000/year") {
    throw new Error(`Unexpected Zijing route fields: ${program.slug}`);
  }
  const intake = seed.programIntakes.find((row) => row.programSlug === program.slug && row.intakeTerm === "Fall" && row.intakeYear === 2027);
  if (!intake || intake.status !== "open" || intake.deadlineDate !== "2027-02-28T09:00:00.000Z") throw new Error(`Missing current Zijing intake: ${program.slug}`);
}

const document = parseRequirementDocument({
  schemaVersion: 1,
  language: "en",
  coverage: "complete",
  sources: [
    sourceRecord("guide", "tsinghua-zijing-global-talents-engineering-2027"),
    sourceRecord("documents", "tsinghua-international-undergraduate-upload-documents-2027"),
  ],
  requirements: [
    item("nationality", "identity", "required", "All applicants", "Be a foreign national who does not hold Chinese nationality and hold a valid foreign passport or other valid proof of foreign nationality under the published nationality rules.", "document", "guide", "Eligibility section 2.1"),
    item("health_and_conduct", "application_policy", "required", "All applicants", "Be in good physical and mental health and demonstrate goodwill toward China.", "school_review", "guide", "Eligibility section 2.2"),
    item("high_school_education", "education", "required", "All applicants", "Hold or be completing a high-school graduation certificate obtained through full-time, in-person education.", "document", "guide", "Eligibility section 2.2"),
    item("academic_performance", "academic_results", "required", "All applicants", "Provide evidence of outstanding academic performance through transcripts and the applicable graduation, matriculation or international standardized-test results and supporting materials.", "official_result", "guide", "Academic performance section 2.3"),
    item("online_application", "application_policy", "required", "All applicants", "Create an account in the online application system, complete the form, upload the required documents, pay the application fee and submit during the application period.", "school_review", "guide", "Online Application section 3.1"),
    item("nationality_documents", "identity", "required", "All applicants", "Upload every nationality-status document required by Tsinghua's 2027 nationality documentation rules.", "document", "documents", "Document list item 1"),
    item("graduation_certificate", "documents", "required", "All applicants", "Upload the applicable original high-school diploma, pre-graduation certificate stating the expected graduation time, or university enrollment certificate.", "document", "documents", "Document list item 2"),
    item("cv_and_transcripts", "documents", "required", "All applicants", "Upload a Chinese- or English-language CV and the applicable original high-school and university transcripts.", "document", "documents", "Document list items 3-4"),
    item("english_language", "language", "required", "Applicants whose native language is not English", "Provide a valid English-language test report such as TOEFL or IELTS. The guide publishes no universal numeric minimum.", "official_result", "guide", "Language proficiency section 2.3"),
    item("standardized_tests", "academic_results", "required", "All applicants", "Upload the applicable national or regional graduation or matriculation examination certificate and/or available international standardized-test results such as CSCA, SAT, ACT, A-Level, AP or IB.", "official_result", "documents", "Document list item 6"),
    item("recommendations", "documents", "required", "All applicants", "Arrange two recommendation letters through the online system; its template is sent directly to each recommender's email address.", "document", "documents", "Document list item 8"),
    item("personal_statement", "documents", "required", "All applicants", "Upload a personal statement in Chinese or English.", "document", "documents", "Document list item 9"),
    item("financial_sponsor", "documents", "required", "All applicants", "Upload the Financial Sponsor form and the sponsor's employment or income certificate.", "document", "documents", "Document list item 10"),
    item("self_introduction_video", "documents", "required", "All applicants", "Upload a Chinese-and-English self-introduction video no longer than three minutes and smaller than 20 MB in an accepted file format.", "document", "documents", "Document list item 12"),
    item("other_supporting_materials", "documents", "recommended", "Applicants with awards or other supporting evidence", "Upload relevant supporting materials such as awards or admission letters from other universities when available.", "document", "documents", "Document list item 14"),
    item("translation_and_originals", "documents", "required", "All applicants", "Submit original Chinese- or English-language materials; for originals in another language, also submit a notarized Chinese or English translation.", "document", "documents", "Document list note 1"),
    item("guardian", "identity", "conditional", "Applicants under 18 on September 1, 2027", "Provide a certificate identifying a legal guardian in China who currently lives in Beijing and has a source of income.", "document", "documents", "Document list note 4"),
    item("deadline", "application_policy", "required", "Fall 2027 applicants", "Submit by the applicable round deadline: November 20, 2026 at 17:00 Beijing time for round one, or February 28, 2027 at 17:00 Beijing time for round two.", "school_review", "guide", "Schedule sections 4.1-4.2"),
    item("application_fee", "application_policy", "required", "All applicants", "Pay the non-refundable RMB 800 online application fee.", "document", "guide", "Online Application section 3.1.4 and Fees section 5.1"),
    item("assessment", "application_policy", "conditional", "Applicants who pass document screening", "Participate in Tsinghua's comprehensive assessment when invited; its method and schedule will be communicated separately.", "school_review", "guide", "Comprehensive Evaluation section 3.2"),
    item("hardcopy_verification", "documents", "conditional", "Applicants who pass the comprehensive assessment", "Provide the specified hard-copy nationality documents, signed application form, transcripts and other required materials for verification.", "document", "documents", "Document list note 3"),
    item("tuition_and_insurance", "application_policy", "required", "Enrolled students", "Pay RMB 100,000 tuition per year and RMB 800 medical insurance per year.", "document", "guide", "Fees section 5.1", "enrollment"),
    item("accommodation", "application_policy", "conditional", "Students seeking on-campus housing", "Reserve a designated Zijing College room online within the announced period; room availability and accommodation charges are controlled by the booking system and International Student and Scholar Center.", "document", "guide", "Accommodation section 5.2", "enrollment"),
  ],
});

const template = {
  key: "tsinghua-zijing-global-talents-engineering-fall-2027",
  schoolSlug: "tsinghua-university",
  cycle: "fall-2027",
  targetProgramSlugs: programs.map((program) => program.slug),
  targetIntake: { term: "Fall", year: 2027 },
  targetBindingStatus: "ready" as const,
  reviewStatus: "unreviewed" as const,
  fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" },
  unresolvedNotes: [
    "The guide names these eight engineering directions and gives a single program-level fee and requirements set; it does not publish route-specific CSCA subject combinations or score thresholds.",
    "The current Fall 2027 candidate remains unreviewed and non-public.",
    "Scholarship support is described at program level but remains outside this route-requirement binding.",
  ],
  document,
};
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  handoff: {
    status: "unreviewed_draft",
    databaseWriteAuthorized: false,
    publicationAuthorized: false,
    purpose: "Complete current official-source requirements for eight Tsinghua Zijing College Fall 2027 engineering routes.",
  },
  summary: {
    templateCount: 1,
    readyTemplateCount: 1,
    blockedTemplateCount: 0,
    targetedProgramCount: programs.length,
    targetedIntakeCount: programs.length,
    excludedProgramCount: 0,
    requirementItemCount: document.requirements.length,
  },
  templates: [template],
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
