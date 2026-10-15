import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-50.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: string; teachingLanguage: string; tuitionText: string; hskRequirement?: string; englishRequirement?: string; cscaRequirement: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const expected = new Map([
  ["ecnu-undergraduate-admissions-2026", "19d1e0a1a5e3e324f27885618bb066598151e9dacdcc3dc5610d2061407cfbad"],
  ["ecnu-undergraduate-program-catalog-2026", "1a0d2d41e59af7c1beda274925e38f7a89d5473ed0edb36ea1de5393e4b57b4e"],
  ["ecnu-graduate-admissions-2026", "7fac7049327e74c1c8efeb574f3ffec577393da78f2ab77f91358e8503ce0318"],
  ["ecnu-master-program-catalog-2026", "40c72470e02252d73b896a01b885af51170f526ad10d7192699f895f6213c0ec"],
  ["ecnu-doctoral-program-catalog-2026", "d42e66e55b8e302abd6433461845c6e63c9b206f21e0353431c639136ca1c693"],
]);
const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const row of manifest.sources ?? []) if (row.status === 200 && expected.get(row.id) === row.sha256) evidence.set(row.id, row);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked ECNU evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const record = (key: string, id: string) => { const value = evidence.get(id)!; return { key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 }; };
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.draft.json"), "utf8")) as Seed;
const programs = seed.programs.filter((program) => program.teachingLanguage === "English" || /^HSK \d/.test(program.hskRequirement ?? ""));
const excluded = seed.programs.filter((program) => !programs.includes(program));
if (seed.programs.length !== 280 || programs.length !== 280 || excluded.length !== 0 || seed.scholarships.length !== 8) throw new Error("Unexpected ECNU catalog scope.");
for (const program of programs) {
  if (!/^\d+ RMB\/year$/.test(program.tuitionText)) throw new Error(`ECNU route is missing exact tuition: ${program.slug}`);
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-06-01T00:00:00Z")) throw new Error(`Missing exact ECNU intake: ${program.slug}`);
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] }; }
function languageRule(program: Program): string {
  if (program.teachingLanguage === "Chinese") return program.hskRequirement!;
  return program.degreeLevel === "Bachelor"
    ? "Provide a valid IELTS score of at least 6.0, TOEFL score of at least 85, or Cambridge English B2 certificate. Published native/official English and ECNU-approved equivalent-certificate exemptions may apply."
    : "Provide a valid IELTS score of at least 6.0, TOEFL score of at least 80, or Cambridge C1 Advanced score of at least 169. Published native-English and approved English-medium-degree exemptions may apply.";
}
function sources() { return [record("undergraduate_guide", "ecnu-undergraduate-admissions-2026"), record("undergraduate_catalog", "ecnu-undergraduate-program-catalog-2026"), record("graduate_guide", "ecnu-graduate-admissions-2026"), record("master_catalog", "ecnu-master-program-catalog-2026"), record("doctoral_catalog", "ecnu-doctoral-program-catalog-2026")]; }
function undergraduateDocument(program: Program): RequirementDocument {
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: sources(), requirements: [
    item("eligibility", "education", "required", "Undergraduate applicants", "Hold a high-school qualification or above and a valid foreign passport.", "document", "undergraduate_guide", "Eligibility item 1"),
    item("nationality_rule", "identity", "conditional", "Applicants covered by Ministry of Education Document No. 12 (2020)", "Meet the published nationality and residence conditions for former residents/citizens of Mainland China, Hong Kong, Macao or Taiwan and applicants born abroad to Chinese-national parents.", "school_review", "undergraduate_guide", "Eligibility item 2"),
    item("online_application_and_fee", "application_policy", "required", "All applicants", "Complete the ECNU online application, upload every required document and pay the non-refundable RMB 800 fee. Each application permits one program choice.", "school_review", "undergraduate_guide", "Application Documents item 1 and Application Procedure"),
    item("graduation_certificate", "documents", "required", "All applicants", "Submit the high-school graduation certificate; graduating students submit impending-graduation proof and must obtain the certificate before August 31, 2026.", "document", "undergraduate_guide", "Application Documents item 2"),
    item("transcripts", "documents", "required", "All applicants", "Submit a complete high-school transcript.", "document", "undergraduate_guide", "Application Documents item 3"),
    item("language", "language", "required", `${program.teachingLanguage}-taught route applicants`, languageRule(program), "official_result", "undergraduate_guide", "Eligibility item 3 and Application Documents item 4"),
    item("csca", "academic_results", "required", "Undergraduate applicants", program.cscaRequirement, "official_result", "undergraduate_catalog", "Route row CSCA subject columns"),
    item("self_recommendation", "documents", "required", "All applicants", "Submit a 500-800 word self-recommendation in the teaching language covering self-introduction, application motivation and study plan.", "document", "undergraduate_guide", "Application Documents item 6"),
    item("passport", "identity", "required", "All applicants", "Submit passport personal-information and applicable Chinese visa pages.", "document", "undergraduate_guide", "Application Documents item 7"),
    item("guardian", "identity", "conditional", "Applicants under age 18", "Submit the Guardian's Letter of Guarantee and satisfy the published in-China guardian requirement when the applicant's parents are outside China.", "document", "undergraduate_guide", "Eligibility item 5 and Application Documents item 8"),
    item("nationality_documents", "identity", "conditional", "Applicants covered by the published nationality-history rules", "Submit the applicable four-year passport entry/exit stamp pages, Entry and Exit Information Form, Letter of Commitment and related nationality evidence.", "document", "undergraduate_guide", "Additional nationality documents after item 8"),
    item("scholarship_health", "documents", "conditional", "Scholarship applicants", "Submit a valid health certificate issued within six months with the required blood-test details, photograph, hospital stamp and physician signature.", "document", "undergraduate_guide", "Supplementary Documentation for Scholarship application item 1"),
    item("scholarship_criminal_record", "documents", "conditional", "Scholarship applicants", "Submit a non-criminal-record or police-clearance certificate issued within six months.", "document", "undergraduate_guide", "Supplementary Documentation for Scholarship application item 2"),
    item("portfolio", "documents", "conditional", "Fine Art or Music applicants", "Fine Art applicants submit recent original artwork; Music applicants submit a recent instrumental or vocal performance video.", "document", "undergraduate_guide", "Documents required by school or institute"),
    item("document_integrity", "documents", "required", "All applicants", "Upload scanned originals and attach notarized Chinese or English translations to documents in other languages; incomplete off-system applications are not processed.", "school_review", "undergraduate_guide", "Application Documents note"),
    item("deadline", "application_policy", "required", "Fall 2026 self-financed applicants", "Submit the self-financed application by June 1, 2026. Scholarship routes use their separately published deadlines.", "school_review", "undergraduate_guide", "Application Deadline table"),
    item("review", "application_policy", "conditional", "Applicants who pass preliminary review", "Complete the school or department evaluation and any interview arranged by ECNU; final admission follows comprehensive evaluation.", "school_review", "undergraduate_guide", "Application Procedure item 2"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}. Self-funded students must pay tuition before July 31.`, "document", "undergraduate_catalog", "Route row tuition column", "enrollment"),
  ] });
}
function graduateDocument(program: Program): RequirementDocument {
  const doctoral = program.degreeLevel === "Doctoral";
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: sources(), requirements: [
    item("citizenship_and_conduct", "identity", "required", "All applicants", "Be a non-Chinese citizen with a valid passport, demonstrate good conduct, have no criminal record and comply with Chinese laws and ECNU rules.", "school_review", "graduate_guide", "Eligibility items 1-2"),
    item("degree", "education", "required", `${program.degreeLevel} applicants`, doctoral ? "Hold a master's degree or equivalent or higher recognized in China." : "Hold a bachelor's degree or equivalent or higher recognized in China.", "document", "graduate_guide", "Eligibility item 3"),
    item("online_application_and_fee", "application_policy", "required", "All applicants", "Complete the ECNU online application, upload every required document and pay the non-refundable RMB 800 fee. Each application permits one program choice.", "school_review", "graduate_guide", "Application Procedure"),
    item("passport_and_visa", "identity", "required", "All applicants", "Submit a passport information page valid for at least six months after enrollment and attach Chinese visa pages when applicable.", "document", "graduate_guide", "Application Documents item 1"),
    item("degree_certificates_and_transcripts", "documents", "required", "All applicants", doctoral ? "Submit bachelor's and master's degree certificates and complete transcripts; pending graduates submit current transcripts and expected-graduation proof and must obtain final certificates by September 1, 2026." : "Submit the bachelor's degree certificate and complete undergraduate transcript; pending graduates submit current transcripts and expected-graduation proof and must obtain final certificates by September 1, 2026.", "document", "graduate_guide", "Application Documents item 2"),
    item("language", "language", "required", `${program.teachingLanguage}-taught route applicants`, languageRule(program), "official_result", "graduate_guide", "Eligibility item 4 and Application Documents item 3"),
    item("recommendations", "documents", "required", "Graduate applicants", "Provide two Chinese- or English-language recommendations from associate professors, professors or related senior professionals, issued after September 1, 2025 with complete recommender identity and contact details.", "document", "graduate_guide", "Application Documents item 4"),
    item("personal_statement", "documents", "required", "Graduate applicants", doctoral ? "Submit an English or Chinese personal statement in the route language of at least 1,500 words covering academic background, research experience, interests and goals." : "Submit an English or Chinese personal statement in the route language of at least 1,000 words covering academic background, research experience, interests and goals.", "document", "graduate_guide", "Application Documents item 5"),
    item("research_achievements", "documents", "conditional", "Applicants with research outputs", doctoral ? "Submit a publication catalogue and abstracts or other original research achievements when applicable, plus the master's thesis abstract." : "Submit a publication catalogue and abstracts or other original research achievements when applicable.", "document", "graduate_guide", "Application Documents item 6"),
    ...(doctoral ? [item("research_proposal", "documents", "required", "Doctoral applicants", "Submit a research proposal.", "document", "graduate_guide", "Application Documents item 7")] : []),
    item("photo", "identity", "required", "All applicants", "Upload a recent color ID photograph with a plain background and full-face uncovered head.", "document", "graduate_guide", "Application Documents item 8"),
    item("awards", "documents", "conditional", "Applicants with awards", "Submit applicable award certificates.", "document", "graduate_guide", "Application Documents item 9"),
    item("program_supplements", "documents", "conditional", "Applicants to specified programs", "Submit the published program-specific supplement: an arts portfolio or music video, the International Chinese Language Education master's essay, or the doctoral work-experience proof, as applicable.", "document", "graduate_guide", "Supplemental Documents for Specific Programs"),
    item("scholarship_health", "documents", "conditional", "Scholarship applicants", "Submit a valid health certificate issued within six months with the required examination and blood-test details.", "document", "graduate_guide", "Supplemental Documents for Scholarship Applicants item 1"),
    item("scholarship_criminal_record", "documents", "conditional", "Scholarship applicants", "Submit a non-criminal-record or police-clearance certificate issued within six months.", "document", "graduate_guide", "Supplemental Documents for Scholarship Applicants item 2"),
    item("document_integrity", "documents", "required", "All applicants", "Upload scanned originals with notarized Chinese or English translations where required; ensure every submission is authentic, accurate and complete.", "school_review", "graduate_guide", "Application Documents note and Notes"),
    item("deadline", "application_policy", "required", "Fall 2026 self-financed applicants", "Submit the self-financed application by June 1, 2026. Scholarship routes use their separately published deadlines.", "school_review", "graduate_guide", "Application Deadline table"),
    item("review", "application_policy", "conditional", "Applicants who pass preliminary review", "Complete the school or department evaluation and any interview arranged by ECNU; final admission follows comprehensive evaluation.", "school_review", "graduate_guide", "Application Procedure"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", program.degreeLevel === "Master" ? "master_catalog" : "doctoral_catalog", "Route row tuition column", "enrollment"),
  ] });
}
const groups = new Map<string, Program[]>();
for (const program of programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText, requirement: languageRule(program), csca: program.degreeLevel === "Bachelor" ? program.cscaRequirement : "" });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const definitions = [...groups.values()].map((rows, index) => ({ key: `ecnu-explicit-route-group-${String(index + 1).padStart(2, "0")}-fall-2026`, rows, document: rows[0].degreeLevel === "Bachelor" ? undergraduateDocument(rows[0]) : graduateDocument(rows[0]) }));
if (definitions.length !== 40 || definitions.flatMap((group) => group.rows).length !== 280) throw new Error(`ECNU grouping changed: groups=${definitions.length}, routes=${definitions.flatMap((group) => group.rows).length}.`);
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "east-china-normal-university", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Scope contains all 280 official routes with explicit route-level language thresholds, tuition and CSCA subjects where applicable.", "The two English-medium routes identified by the official name markers are normalized as English rather than assigned an HSK requirement.", "This historical Fall 2026 cycle is closed and must not be shown as current.", "The eight scholarship records remain independent; no route-level entitlement is inferred."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete official-source requirements for all 280 ECNU Fall 2026 routes with explicit language, tuition and applicable CSCA facts." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: programs.length, targetedIntakeCount: programs.length, excludedProgramCount: excluded.length, scholarshipCount: seed.scholarships.length, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
