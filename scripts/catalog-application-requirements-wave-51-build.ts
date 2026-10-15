import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRequirementDocument, type RequirementDocument, type RequirementItem } from "../src/server/catalog/requirements.ts";

const root = process.cwd(), workRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, "seeds/application-requirements-wave-51.draft.json");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type Program = { slug: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; teachingLanguage: string; tuitionText: string; cscaRequirement?: string; hskRequirement?: string; englishRequirement?: string; applicationNote?: string };
type Seed = { programs: Program[]; programIntakes: { programSlug: string; intakeTerm: string; intakeYear: number; status: string; deadlineDate?: string }[]; scholarships: unknown[] };
const expected = new Map([
  ["dhu-undergraduate-application-guide-2026", "08a3e81d7decbd4420d60b39f49b6785cbad8e066821ddfcd93d93aa4b5fcf61"],
  ["dhu-undergraduate-programs-pdf-2026", "30dc5b485fe599666bec6a476aa5ebbd1411365f8f28b44beec032958feff01b"],
  ["dhu-master-application-guide-2026", "633f38ddb37a4956d3e9a52c406d8030c35f54ffd84748b7c23cd2eb03ece1e5"],
  ["dhu-master-programs-pdf-2026", "eff0fdc9d5bd9ad7f5f1e18ce3b7c13c8f62aaa80910b665b99be71eb1c693b6"],
  ["dhu-doctoral-application-guide-2026", "07ce403793bf19d1f4fac3c5832642675d4e23b6b9d2b45eecaffd3d2d196bd9"],
  ["dhu-doctoral-programs-pdf-2026", "5a845326245165295bf2f34db9c4e969bda48f2d3ffddeac8aa882570f84a024"],
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
if (evidence.size !== expected.size) throw new Error(`Missing locked DHU evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
const record = (key: string, id: string) => { const value = evidence.get(id)!; return { key, url: value.finalUrl ?? value.url, title: value.label, capturedAt: value.fetchedAt, contentSha256: value.sha256 }; };
const sourceIds = {
  Undergraduate: ["dhu-undergraduate-application-guide-2026", "dhu-undergraduate-programs-pdf-2026"],
  Master: ["dhu-master-application-guide-2026", "dhu-master-programs-pdf-2026"],
  Doctoral: ["dhu-doctoral-application-guide-2026", "dhu-doctoral-programs-pdf-2026"],
} as const;
const seed = JSON.parse(await readFile(resolve(root, "seeds/catalog.dhu-complete-batch-01.draft.json"), "utf8")) as Seed;
const programs = seed.programs;
if (programs.length !== 131 || programs.filter((program) => program.degreeLevel === "Undergraduate").length !== 56 || programs.filter((program) => program.degreeLevel === "Master").length !== 48 || programs.filter((program) => program.degreeLevel === "Doctoral").length !== 27 || seed.scholarships.length !== 4) throw new Error("Unexpected DHU catalog scope.");
for (const program of programs) {
  if (!/^CNY [\d,]+(?: \/ CNY [\d,]+)? per academic year$/.test(program.tuitionText) || !program.hskRequirement && !program.englishRequirement) throw new Error(`DHU route is missing exact tuition or language: ${program.slug}`);
  if (program.degreeLevel === "Undergraduate" && !program.cscaRequirement) throw new Error(`DHU undergraduate route is missing exact CSCA subjects: ${program.slug}`);
  if (!seed.programIntakes.some((intake) => intake.programSlug === program.slug && intake.intakeTerm === "Fall" && intake.intakeYear === 2026 && intake.status === "closed" && intake.deadlineDate === "2026-05-31T00:00:00.000Z")) throw new Error(`Missing exact DHU intake: ${program.slug}`);
}
function item(key: string, category: RequirementItem["category"], level: RequirementItem["level"], appliesTo: string, ruleText: string, evidenceType: RequirementItem["evidenceType"], sourceKey: string, locator: string, stage: RequirementItem["stage"] = "submission"): RequirementItem { return { key, category, stage, level, appliesTo, ruleText, evidenceType, references: [{ sourceKey, locator }] }; }
function languageRule(program: Program): string {
  if (program.teachingLanguage === "Chinese") return program.hskRequirement!;
  if (program.teachingLanguage === "English") return program.englishRequirement!;
  return `For the Chinese-taught route: ${program.hskRequirement}. For the English-taught route: ${program.englishRequirement}.`;
}
function common(program: Program): RequirementItem[] {
  const level = program.degreeLevel;
  const age = level === "Undergraduate" ? "Be at least 16 and under 25 for an entrance scholarship, or at least 16 and under 35 for self-funded study." : level === "Master" ? "Be under 35 for an entrance scholarship or under 40 for self-funded study." : "Be under 40 for an entrance scholarship or under 45 for self-funded study.";
  const education = level === "Undergraduate" ? "Hold a higher-secondary graduation certificate or international equivalent that qualifies the applicant for university entrance." : level === "Master" ? "Hold a bachelor's degree or equivalent qualification." : "Hold a master's degree or equivalent qualification.";
  const deadline = level === "Undergraduate" ? "Submit scholarship applications by April 15, 2026 and self-funded applications by May 31, 2026." : "Submit scholarship applications by January 31 or April 15, 2026 according to scholarship route, and self-funded applications by May 31, 2026.";
  return [
    item("citizenship_and_health", "identity", "required", `${level} applicants`, "Be a non-Chinese citizen with a valid ordinary foreign passport and be in good physical and mental health.", "document", "guide", "Application Eligibility"),
    item("finance_and_conduct", "documents", "required", `${level} applicants`, "Have sufficient financial resources and no criminal record.", "document", "guide", "Application Eligibility"),
    item("age", "identity", "required", `${level} applicants`, age, "document", "guide", "Application Eligibility, age requirements"),
    item("education", "education", "required", `${level} applicants`, education, "document", "guide", "Application Eligibility, educational background"),
    item("language", "language", "required", `${program.teachingLanguage}-taught ${level.toLowerCase()} route applicants`, languageRule(program), "official_result", "guide", "Application Eligibility and Language Proficiency Certificates"),
    item("online_application_and_fee", "application_policy", "required", "All applicants", "Register in the DHU online application system, complete the form, upload all required materials, pay the non-refundable CNY 800 application fee and ensure the status is Submitted before the deadline. Only one major may be selected.", "school_review", "guide", "Application Steps, step 1"),
    item("passport", "identity", "required", "All applicants", "Upload the passport information page from an ordinary passport valid after February 1, 2027, plus applicable China visa and entry-stamp pages.", "document", "guide", "Application Materials, Passport and Visa Pages"),
    item("criminal_record", "documents", "required", "All applicants", "Submit a certificate of no criminal conviction issued by the competent authority on or after November 1, 2025.", "document", "guide", "Application Materials, Certificate of No Criminal Conviction"),
    item("financial_support", "documents", "required", "All applicants", "Submit the DHU Statement of Financial Support signed by the applicant and financial guarantor on or after November 1, 2025; scholarship applicants must also document coverage beyond the scholarship scope.", "document", "guide", "Application Materials, Statement of Financial Support"),
    item("scholarship_documents", "documents", "conditional", "Entrance-scholarship applicants", "Submit the scholarship-route documents specified by the guide, including the signed CSC form when applicable and the Foreigner Physical Examination Form with required reports; follow the DHU funding-source selection instructions.", "document", "guide", "Additional or Mandatory Documents for Scholarship Applications"),
    item("deadline", "application_policy", "required", "Fall 2026 applicants", deadline, "school_review", "guide", "Application Deadline"),
    item("assessment", "application_policy", "conditional", "Applicants invited by DHU", "Participate in any language test, examination or interview arranged by DHU; the result forms part of the admission decision.", "school_review", "guide", "Language Proficiency Certificates and program-specific assessment notes"),
    item("document_verification", "documents", "required", "Admitted students", "Present original academic and language documents for verification at registration and enrollment and satisfy any conditional-offer deadline.", "school_review", "guide", "Application Materials verification notes", "enrollment"),
    item("tuition", "application_policy", "required", "Enrolled students", `Pay the published tuition for this route: ${program.tuitionText}.`, "document", "catalog", `2026 ${level.toLowerCase()} program row, tuition column`, "enrollment"),
  ];
}
function undergraduate(program: Program): RequirementItem[] {
  const art = program.applicationNote?.includes("Additional published requirement") ?? false;
  return [
    ...common(program),
    item("nationality_history", "identity", "conditional", "Applicants with specified Chinese nationality, parentage or secondary-education history", "Provide the foreign-passport, nationality, naturalization, Chinese-citizenship cancellation, parental-nationality and entry/exit evidence applicable to the circumstances described in the guide; the specified applicants must also satisfy the four-year nationality and two-year overseas-residence rules.", "document", "guide", "Application Eligibility item 3 and Requirements for the following cases"),
    item("secondary_documents", "documents", "required", "Undergraduate applicants", "Upload the higher-secondary diploma or school-leaving certificate and complete transcripts with official stamps or signatures, grading-system explanation, and required translations and notarization. Pending graduates submit official pending proof and current transcripts, followed by final documents by the end of August 2026.", "document", "guide", "Application Materials item 2"),
    item("csca", "academic_results", "required", "Undergraduate applicants", `Submit the CSCA score report for the selected route. Required subjects: ${program.cscaRequirement}.`, "official_result", "guide", "Application Materials item 4 and official 2026 program table"),
    item("personal_statement", "documents", "required", "Undergraduate applicants", "Submit an approximately 1,000-word personal statement in the route's teaching language covering the guide's required background, motivation, experience and study or career planning details.", "document", "guide", "Application Materials item 5"),
    item("resume", "documents", "required", "Undergraduate applicants", "Submit a personal resume in the route's teaching language with personal, education, activity, competition, internship, practical-experience, honor, award and competency details as applicable.", "document", "guide", "Application Materials item 6"),
    item("art_portfolio", "documents", art ? "required" : "conditional", art ? "Applicants to this art or design route" : "Applicants to art or design routes only", art ? (program.teachingLanguage === "English" ? "Submit a roughly three-minute video portfolio in English explaining design concepts, professional understanding, skills and creativity." : "Submit recent original artwork including at least two hand-drawn pencil sketches, two hand-drawn color paintings and three design renderings related to the applied program.") : "No portfolio is published for this route; the art-portfolio rule applies only to the art and design routes named in the guide and program table.", "document", "guide", "Mandatory for application of art design related programs"),
    item("minor_guardian", "documents", "conditional", "Applicants under age 18", "Submit the DHU Guarantee Statement completed and signed by a legal adult guardian living in mainland China.", "document", "guide", "Requirements for the following cases, item 1"),
  ];
}
function graduate(program: Program): RequirementItem[] {
  const doctoral = program.degreeLevel === "Doctoral";
  const supervision = doctoral || (program.applicationNote?.includes("Supervision Intention Letter required") ?? false);
  const design = program.applicationNote?.toLowerCase().includes("art") ?? false;
  return [
    ...common(program),
    item("degree_documents", "documents", "required", `${program.degreeLevel} applicants`, `Upload the ${doctoral ? "master's and bachelor's" : "bachelor's"} degree, graduation and complete transcript documents with official stamps or signatures, grading-system explanation, and required translations and notarization. Pending graduates submit official pending proof and current transcripts, followed by final documents by the end of August 2026.`, "document", "guide", "Application Materials item 2"),
    item("cv", "documents", "required", `${program.degreeLevel} applicants`, "Submit a curriculum vitae in the teaching language with complete education and work or internship history, no unexplained timeline gaps, and supporting certificates for listed employment or internships.", "document", "guide", "Application Materials, Curriculum Vitae"),
    item("research_proposal", "documents", "required", `${program.degreeLevel} applicants`, `Submit a research proposal in the teaching language containing both a research plan and a study plan for the ${program.degreeLevel.toLowerCase()} program.`, "document", "guide", "Application Materials, Research Proposal"),
    item("recommendations", "documents", "required", `${program.degreeLevel} applicants`, "Submit two recommendation letters in Chinese or English from eligible referees, with the required identity, position, handwritten signature, contact details and signing date on or after September 1, 2024.", "document", "guide", "Application Materials, Two Recommendation Letters"),
    item("supervision_intention", "documents", supervision ? "required" : "conditional", supervision ? "Applicants to this route" : "Applicants to routes marked in the official program table", supervision ? "Submit the DHU Supervision Intention Letter; doctoral applicants must also satisfy the research-proposal cover requirements." : "A Supervision Intention Letter is not marked mandatory for this route in the official program table.", "document", "guide", "Application Materials, Supervision Intention Letter and official program-table checkmark column"),
    item("academic_supporting_materials", "documents", "conditional", "Applicants with research or professional achievements", "Upload applicable papers, abstracts, qualifications, certificates, awards, honors and other materials supporting the CV.", "document", "guide", "Application Materials, Other Supplementary Documents"),
    item("design_portfolio", "documents", design ? "required" : "conditional", design ? "Applicants to this Design Studies route" : "Chinese-taught Design applicants only", design ? `Submit the recent original art portfolio published for this route.${doctoral ? " It must include a design portfolio related to the applied direction." : " It must include at least two hand-drawn pencil sketches, two hand-drawn color paintings and a design portfolio related to the applied direction."}` : "No design portfolio is published for this route; the portfolio rule applies only to the Chinese-taught Design route identified by the guide and program table.", "document", "guide", "Mandatory for Design Major Applications and official program-table Other Requirements column"),
  ];
}
function document(program: Program): RequirementDocument {
  const ids = sourceIds[program.degreeLevel];
  return parseRequirementDocument({ schemaVersion: 1, language: "en", coverage: "complete", sources: [record("guide", ids[0]), record("catalog", ids[1])], requirements: program.degreeLevel === "Undergraduate" ? undergraduate(program) : graduate(program) });
}
const groups = new Map<string, Program[]>();
for (const program of programs) {
  const identity = JSON.stringify({ degree: program.degreeLevel, language: program.teachingLanguage, tuition: program.tuitionText, csca: program.cscaRequirement ?? "", hsk: program.hskRequirement ?? "", english: program.englishRequirement ?? "", supervision: program.applicationNote?.includes("Supervision Intention Letter required") ?? false, art: program.applicationNote?.toLowerCase().includes("art") || program.applicationNote?.includes("Portfolio") || false });
  groups.set(identity, [...(groups.get(identity) ?? []), program]);
}
const counters = new Map<string, number>();
const definitions = [...groups.values()].map((rows) => { const degree = rows[0].degreeLevel.toLowerCase(); const index = (counters.get(degree) ?? 0) + 1; counters.set(degree, index); return { key: `dhu-${degree}-group-${String(index).padStart(2, "0")}-fall-2026`, rows, document: document(rows[0]) }; });
if (definitions.flatMap((group) => group.rows).length !== 131) throw new Error("DHU requirements grouping changed.");
const templates = definitions.map((definition) => ({ key: definition.key, schoolSlug: "donghua-university", cycle: "fall-2026", targetProgramSlugs: definition.rows.map((program) => program.slug), targetIntake: { term: "Fall", year: 2026 }, targetBindingStatus: "ready" as const, reviewStatus: "unreviewed" as const, fieldAssessment: { cycle: "explicit", targetPrograms: "explicit", requirements: "complete" }, unresolvedNotes: ["Scope covers official Fall 2026 routes with exact tuition, language thresholds and route-specific CSCA, supervision-intention or portfolio requirements where applicable.", "This historical Fall 2026 cycle is closed and must not be shown as current.", "The four scholarship records remain independent; no route-level entitlement is inferred."], document: definition.document }));
const output = { version: 1, generatedAt: new Date().toISOString(), handoff: { status: "unreviewed_draft", databaseWriteAuthorized: false, publicationAuthorized: false, purpose: "Complete official-source requirements for all 131 DHU Fall 2026 undergraduate, master's and doctoral routes." }, summary: { templateCount: templates.length, readyTemplateCount: templates.length, blockedTemplateCount: 0, targetedProgramCount: programs.length, targetedIntakeCount: programs.length, excludedProgramCount: 0, scholarshipCount: seed.scholarships.length, requirementItemCount: templates.reduce((sum, template) => sum + template.document.requirements.length, 0) }, templates };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: output.summary }, null, 2));
