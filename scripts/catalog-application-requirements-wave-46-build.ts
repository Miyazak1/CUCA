import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-wave-46.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Seed = { programs: { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText?: string }[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/ucas-complete-batch-01/manifest.json"), "utf8")) as { sources: Source[] };
const expected = new Map([
  ["ucas-graduate-admission-2026", "becc112bc169655952fa8a41172e6fdc60162744489a265527a8838521fbb45c"],
  ["ucas-international-major-index-current", "f99b9c7944a3ebb77a7d4a849985e442d86d6f1696907871beb63ad5456b2366"],
]);
const source = (id: string) => {
  const found = manifest.sources.find((row) => row.id === id);
  if (!found || found.status !== 200 || found.sha256 !== expected.get(id)) throw new Error(`UCAS evidence mismatch: ${id}`);
  return found;
};
const guide = source("ucas-graduate-admission-2026"), catalog = source("ucas-international-major-index-current");
const record = (key: string, value: Source) => ({ key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 });
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.ucas-complete-batch-01.draft.json"), "utf8")) as Seed;
if (seed.programs.length !== 174 || seed.programIntakes.length !== 174 || seed.scholarships.length !== 3) throw new Error("Unexpected UCAS candidate scope.");
if (seed.programs.some((program) => program.degreeLevel !== "Master" || program.teachingLanguage !== "English" || program.tuitionText !== "RMB 30,000/year")) throw new Error("UCAS route scope changed.");
for (const program of seed.programs) if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-04-15T00:00:00.000Z")) throw new Error(`Missing UCAS intake: ${program.slug}`);
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem {
  return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey: "guide", locator }] };
}
const document = parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", guide), record("catalog", catalog)], requirements: [
  item("eligibility", "education", "required", "English-instructed master's applicants", "Be a non-Chinese citizen, comply with Chinese laws and UCAS rules, and be of good character and health without a condition that prevents normal study.", "document", "General Conditions (1)-(2)"),
  item("degree", "education", "required", "Master's applicants", "Hold a degree or academic qualification equivalent to a Chinese bachelor's degree; country-specific degree provisions apply where published.", "document", "General Conditions (3) and Attachment 1"),
  item("english", "language", "required", "English-instructed applicants", "Submit a valid IELTS or TOEFL result or other proof of English proficiency; this is not required when English is the applicant's mother tongue. The call does not publish a numeric threshold.", "official_result", "General Conditions (4) and Application Materials: proficiency certificates"),
  item("online_application", "application_policy", "required", "All applicants", "Submit one complete application through the UCAS international online application system within the application period; duplicate accounts or multiple applications are disqualifying.", "school_review", "Online Application"),
  item("passport_and_photo", "identity", "required", "All applicants", "Submit the ordinary-passport information page, with at least one year validity, and a recent two-inch bareheaded photo matching the passport photo.", "document", "Application Materials: passport and photo"),
  item("cv", "documents", "required", "All applicants", "Submit a complete CV covering all education and research experience from university onward; currently employed applicants must attach employment certification.", "document", "Application Materials: complete CV"),
  item("degree_certificate", "documents", "required", "Master's applicants", "Submit the bachelor's degree certificate; an applicant graduating before September 2026 may submit official expected-graduation proof and must provide the final certificate before registration if admitted.", "document", "Application Materials: degree certificates"),
  item("transcript", "documents", "required", "Master's applicants", "Submit the complete original undergraduate transcript; a current student may submit the official transcript to date and must provide the final complete transcript before registration if admitted.", "document", "Application Materials: academic transcripts"),
  item("publications", "documents", "conditional", "Applicants with published academic papers", "Optionally submit the first page and abstract of up to five representative published papers; do not submit unpublished papers.", "document", "Application Materials: published academic papers"),
  item("motivation_letter", "documents", "required", "All applicants", "Submit a motivation letter covering the purpose of studying in China, academic background, reasons for applying, study plan and career goals.", "document", "Application Materials: motivation letter"),
  item("references", "documents", "required", "All applicants", "Submit two reference letters from professors or associate professors who know the applicant's academic background, are not the prospective UCAS supervisor, and use signed and dated institutional letterhead.", "document", "Application Materials: two reference letters"),
  item("supervisor_acceptance", "documents", "conditional", "Applicants who already have supervisor acceptance", "Upload the UCAS Supervisor's Acceptance Form when available; obtaining it before application is encouraged but not mandatory.", "document", "Application Materials: supervisor acceptance form"),
  item("financial_support", "documents", "conditional", "Self-funded or externally funded applicants", "Provide the applicable funding proof. Self-funded applicants submit a sponsor guarantee letter and an original or notarized bank statement.", "document", "Application Materials: financial support"),
  item("application_fee", "application_policy", "required", "Applicants without an eligible fee-waiver scholarship", "Pay the non-refundable RMB 600 application fee and submit its bank receipt. The three named UCAS-administered scholarship categories are exempt under the call.", "document", "Application Materials: bank receipt; Fees (1)"),
  item("deadline", "application_policy", "required", "Fall 2026 degree applicants", "Apply between October 15, 2025 and April 15, 2026; this historical cycle is closed. Scholarship applicants must meet the earlier scholarship-specific deadline.", "school_review", "Application Deadline"),
  item("assessment", "application_policy", "required", "Applicants who pass document review", "Complete the admission examination determined by the selected college or institute, mainly an interview and potentially a written test; final selection is merit-based.", "school_review", "Evaluation and Admission"),
  item("tuition", "application_policy", "required", "Enrolled English-instructed master's students", "Pay RMB 30,000 per year unless an awarded scholarship waives tuition.", "document", "Fees and Scholarships: tuition", "enrollment"),
] });
const template = { key: "ucas-english-master-fall-2026", schoolSlug: "university-of-chinese-academy-of-sciences", cycle: "fall-2026", targetProgramSlugs: seed.programs.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Scope is exactly the 174 English-instructed master's majors exposed by the official international-major index; it does not claim to cover Chinese-instructed or doctoral routes.", "This is a closed historical Fall 2026 cycle and must not be presented as open.", "Scholarship eligibility remains governed by the three independent official award records; no entitlement is inferred."], document };
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete-scope requirements for UCAS's 174 officially indexed English-instructed master's routes." }, summary: { templateCount: 1, readyTemplateCount: 1, blockedTemplateCount: 0, targetedProgramCount: 174, targetedIntakeCount: 174, requirementItemCount: document.requirements.length }, templates: [template] };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
