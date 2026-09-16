import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const parsedPath = resolve(root, "work/catalog-official/zju-complete-batch-01/parsed-graduate-routes.json");
const priorPath = resolve(root, "seeds/catalog.zju-school-program-batch-01.approved.local.json");
const candidatePath = resolve(root, "seeds/catalog.zju-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.zju-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.zju-complete-batch-01.review.json");
const parsedText = await readFile(parsedPath, "utf8");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
if (sha256(parsedText) !== "41674054f4d7fca1ae1d0f19d1f04f14f653fe5e9c8ec2715cc5e3b853c8467e") throw new Error("ZJU parsed graduate routes changed after visual review.");
const parsed = JSON.parse(parsedText);
if (JSON.stringify(parsed.counts) !== JSON.stringify({ total: 588, master: 284, doctoral: 304, chinese: 442, english: 146, specialDeadline: 25 }) || parsed.duplicateIdentities.length || parsed.suspiciousRows.length) throw new Error(`Unexpected ZJU extraction summary: ${JSON.stringify(parsed.counts)}`);
const prior = JSON.parse(await readFile(priorPath, "utf8"));
if (prior.schools?.length !== 1 || prior.schools[0].slug !== "zhejiang-university") throw new Error("Reviewed ZJU dependency bundle is unavailable.");

const manifests = await Promise.all([
  "work/catalog-official/zju-complete-batch-01/manifest.json",
  "work/catalog-official/zju-complete-batch-01-english/manifest.json",
  "work/catalog-official/zju-scholarships-batch-01-extra/manifest.json",
].map(path => readFile(resolve(root, path), "utf8").then(JSON.parse)));
const expected: Record<string, string> = {
  "zju-master-admissions-en-2026": "206cfe853e0b34603f9308b937d7f6df48065b864f6b2139d7385a26d2e4c8cf",
  "zju-doctoral-admissions-2026": "8d55e19959f02ff20e6b5a2c5cfa23f28d429d417b09fc800fad4b13b355dc76",
  "zju-master-chinese-program-catalog-en-pdf-2026": "bdf182401798d0e2c0451d50e0a843bda90f7ef9fc5847fad3657ef485f9a743",
  "zju-master-english-program-catalog-en-pdf-2026": "a2bd7b848913c48d2a74c6250e41be201a9926806940e240bb31fa5a9054f304",
  "zju-doctoral-chinese-program-catalog-pdf-2026": "8157615ec038fb37a75f986faa3bed54cd45d9493eea947f3c02e809fcf0042b",
  "zju-doctoral-english-program-catalog-pdf-2026": "352cb5abbbb194a2d8a34504431f47a57d208a1c3957dd80d449a4d16caccef8",
  "zju-cgs-university-program-scholarship-2026": "e46f805f77efa309994ca3606f9ff3724951d4e023cb3cdca7d2817c59f21495",
  "zju-ism-master-freshman-scholarship-2026": "b091d49f378601ab861059b288bdcec435af138b7673eb040d1a74bb4357ed2e",
};
const evidence = new Map<string, any>();
for (const manifest of manifests) for (const source of manifest.sources ?? []) if (expected[source.id] === source.sha256 && source.status === 200) evidence.set(source.id, source);
const missing = Object.keys(expected).filter(id => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked ZJU evidence: ${missing.join(", ")}`);

const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const routeIdentity = (route: any) => [route.degree, route.teachingLanguage, route.schoolOrDepartment, route.nameEn].join("|");
const programSlug = (route: any) => {
  const verbose = slugify(["zhejiang-university", route.degree, route.schoolOrDepartment, route.nameEn, route.teachingLanguage].join(" "));
  return verbose.length <= 180 ? verbose : `${verbose.slice(0, 163).replace(/-+$/g, "")}-${sha256(routeIdentity(route)).slice(0, 16)}`;
};
const publicNote = (value: string) => value.replace(/https?:\/\/\S+/gi, "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").replace(/\+?86[\d\s-]{7,}/g, "").replace(/\s+/g, " ").trim();
const programs = parsed.routes.map((route: any) => {
  const source = evidence.get(route.sourceId)!;
  const notes = publicNote(route.requirementsAndTips);
  const normalizedDuration = route.durationYears && Number.isInteger(route.durationYears)
    ? { durationYears: route.durationYears }
    : route.durationYears
      ? { durationMonths: Math.round(route.durationYears * 12) }
      : {};
  const durationLineage = "durationYears" in normalizedDuration
    ? { durationYears: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Duration of Studies` }
    : "durationMonths" in normalizedDuration
      ? { durationMonths: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Duration of Studies; half-year value normalized to months` }
      : {};
  return {
    slug: programSlug(route), schoolSlug: "zhejiang-university", citySlug: "hangzhou", nameEn: route.nameEn,
    degreeLevel: route.degree, ...normalizedDuration, fieldCategory: route.schoolOrDepartment,
    subjectArea: route.schoolOrDepartment, teachingLanguage: route.teachingLanguage,
    ...(route.teachingLanguage === "Chinese" ? { hskRequirement: "Program-specific Chinese proficiency requirements apply; consult the official ZJU graduate language requirements and catalog notes." } : { englishRequirement: "Program-specific English proficiency requirements apply; consult the official ZJU graduate language requirements and catalog notes." }),
    cscaRequirement: "No CSCA requirement is published for this graduate route.", ...(route.tuitionAmount ? { tuitionAmount: route.tuitionAmount } : {}),
    tuitionCurrency: "RMB", ...(route.tuitionPeriod ? { tuitionPeriod: route.tuitionPeriod } : {}), tuitionText: route.tuitionText,
    displayTuition: route.tuitionText, scholarshipText: "ZJU graduate scholarships are competitive; route-specific restrictions in the official catalog apply.",
    applicationUrl: "https://intlstudent.zju.edu.cn/", applicationNote: `${route.schoolOrDepartment}. Published duration: ${route.durationText}.${notes ? ` ${notes}` : ""}`,
    hasScholarship: true, displayGroup: route.degree.toLowerCase(), displayGroupLabel: route.degree, status: "draft" as const,
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: { nameEn: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Disciplines/Programs`, degreeLevel: "official PDF title", subjectArea: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Schools/Colleges/Departments`, teachingLanguage: "official PDF title", ...durationLineage, tuitionText: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Tuition`, applicationNote: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Other Requirements and Tips` },
  };
});
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("ZJU program slugs are not unique.");
const programIntakes = programs.map((program, index) => {
  const route = parsed.routes[index];
  return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: `${route.applicationDeadline}T00:00:00.000Z`, deadlineLabel: `Application deadline: ${route.applicationDeadline === "2026-05-31" ? "May 31, 2026" : "February 28, 2026"}`, applicationRound: "2026 international graduate intake", status: "closed" as const, sourceUrl: program.sourceUrl, sourceLabel: program.sourceLabel, sourceSha256: program.sourceSha256, capturedAt: program.capturedAt, sourceFieldLineage: { deadlineDate: `PDF page ${route.sourcePage}, general note or Other Requirements and Tips; date-only value normalized to ISO UTC` } };
});

const item = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, data: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return { schoolSlug: "zhejiang-university", providerLocation: "Zhejiang, China", status: "draft", targetCountries: [], targetRegions: [], sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { title: "official page title", fundingLevel: "scholarship coverage section", coverage: "scholarship coverage section", amountText: "scholarship coverage section", applicableDegree: "eligibility and admissions section", eligibilityItems: "eligibility section and linked admissions guides", applicationMaterials: "application procedure/materials section", applicationSteps: "application procedure and review sections", deadlineDate: "application deadline section" }, actionLinks: [{ label: "Official ZJU scholarship page", url: source.url, kind: "official-source" }], ...data };
};
const scholarships: CatalogSeedScholarship[] = [
  scholarship("zju-cgs-university-program-scholarship-2026", { slug: "official-2026-zju-chinese-government-scholarship-university-program", title: "Zhejiang University 2026 Chinese Government Scholarship - Chinese University Program", type: "government", typeLabel: "CSC Type B", providerNameEn: "China Scholarship Council / Zhejiang University", fundingLevel: "Full", coverage: "Tuition waiver, free on-campus accommodation or accommodation allowance, living stipend under CSC standards, and comprehensive medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible full-time ZJU graduate programs", amountText: "Tuition, accommodation or allowance, living stipend and comprehensive medical insurance", deadlineDate: "2025-12-31", deadlineLabel: "December 31, 2025", applicationRound: "2026 international graduate intake", benefitItems: [benefit("Tuition waiver"), benefit("On-campus accommodation or accommodation allowance"), benefit("Living stipend", "Paid under CSC standards"), benefit("Comprehensive medical insurance")], eligibilityItems: [item("Citizenship", "Non-Chinese citizen meeting ZJU international graduate admissions requirements"), item("Master applicants", "Bachelor's degree holders; normally under 35, subject to the official admissions guide"), item("Doctoral applicants", "Master's degree holders; normally under 40, subject to the official admissions guide"), item("Selection", "Competitive review of research ability, academic performance, language proficiency and interview performance")], applicationMaterials: [item("Chinese Government Scholarship application form"), item("ZJU graduate admission materials"), item("Foreigner Physical Examination Form", "Valid for six months and completed as instructed"), item("No-criminal-record certificate", "Issued by the local public security authority and valid for six months")], applicationSteps: [item("Step 1", "Apply in the CSC system as Type B using Zhejiang University agency number 10335"), item("Step 2", "Apply in the ZJU international student system and upload all required scholarship and admission materials"), item("Step 3", "Pay the RMB 800 ZJU application fee before the deadline"), item("Step 4", "Complete the academic review and video interview if invited; final approval is made by CSC")], bodySections: [{ title: "Award conditions", body: "Recipients may not change the admitted university, program or study duration after arrival. Scholarship management follows Chinese Government Scholarship rules." }], summary: "ZJU's full Chinese Government Scholarship Type B route for eligible full-time international master's and doctoral applicants.", sortOrder: 20 }),
  scholarship("zju-ism-master-freshman-scholarship-2026", { slug: "official-2026-zju-ism-master-freshman-scholarship", title: "Zhejiang University International School of Medicine 2026 Master's Freshman Scholarship", type: "university", typeLabel: "ZJU-ISM Scholarship", providerNameEn: "International School of Medicine, Zhejiang University", fundingLevel: "Type A or Type B", coverage: "Type A provides RMB 20,400 per academic year and may be renewed after annual review. Type B provides first-year on-campus accommodation, RMB 1,500 monthly for 12 months, and first-year comprehensive medical insurance.", applicableDegree: "Master", applicableProgram: "English-taught medical master's programs offered by the International School of Medicine", amountText: "Type A: RMB 20,400/year; Type B: accommodation plus RMB 1,500/month for 12 months and medical insurance", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 English-taught medical master's intake", benefitItems: [benefit("Type A grant", "RMB 20,400 per academic year, subject to annual review"), benefit("Type B accommodation", "Free on-campus accommodation during the first academic year"), benefit("Type B living allowance", "RMB 1,500/month for 12 months in the first academic year"), benefit("Type B medical insurance", "Full coverage in the first academic year")], eligibilityItems: [item("Admissions", "Meet ZJU English-taught master's admission requirements"), item("Program", "Choose School of Medicine and English as the teaching language in the ZJU application system"), item("Concurrent awards", "Type A and Type B cannot be held together; applicants may not receive another scholarship simultaneously")], applicationMaterials: [item("ZJU-ISM Master's Freshman Scholarship application form", "Completed in Chinese or English"), item("ZJU master's admission documents"), item("Foreigner Physical Examination Form", "Valid for six months"), item("No-criminal-record certificate", "Valid for six months")], applicationSteps: [item("Step 1", "Complete the scholarship form and ZJU international student application"), item("Step 2", "Upload the scholarship form and other documents to the ZJU system by May 31, 2026"), item("Step 3", "Send the scholarship form to the official ZJU-ISM admissions mailbox using the prescribed subject format"), item("Step 4", "Complete supplementary review or video interview if requested")], bodySections: [{ title: "Duration and renewal", body: "Type A follows the standard program length and is renewed after annual review. Type B is valid for 12 months in the first academic year." }, { title: "Mutual exclusivity", body: "Type A and Type B cannot be combined; a Type A recipient is not eligible for Type B." }], summary: "Two mutually exclusive ZJU-ISM freshman awards for eligible applicants to English-taught medical master's programs.", sortOrder: 30 }),
];

const generatedAt = new Date().toISOString();
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: prior.cities.map((row: any) => ({ ...row })), schools: prior.schools.map((row: any) => ({ ...row })), programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`ZJU complete candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = sha256(candidateText);
const evidenceRows = [...evidence.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
const reviewBase = { version: 1, status: "standing_user_approval", generatedAt, scope: { schoolSlug: "zhejiang-university", dependencyCityReplayCount: prior.cities.length, dependencySchoolReplayCount: 1, newProgramRouteCount: 588, masterRouteCount: 284, doctoralRouteCount: 304, newProgramIntakeCount: 588, newScholarshipCount: 2, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 }, candidateSha256, evidence: evidenceRows, visualReview: { result: "pass", masterPdfPagesReviewed: 21, doctoralPdfPagesReviewed: 21, note: "All 42 official catalog pages were rendered and visually inspected. Ruled tables, cross-page institution groups, duration, tuition and special deadline notes are readable. Research directions remain part of their parent program." }, standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "The batch adds only new non-conflicting graduate routes, intakes and two distinct scholarship records. It archives and deletes nothing. Existing Hangzhou and ZJU rows are replayed byte-equivalently from the approved bundle." }, reconciliation: { actionAfterReview: "insert_new_verified_zju_graduate_routes_and_two_scholarships", destructiveDeletion: false, existingDependencyRowsReplayedByteEquivalently: true, newProgramSlugConflicts: 0, existingGraduateSemanticConflicts: 0, newScholarshipSlugConflicts: 0 }, deferredConflicts: [{ existingSlug: "zhejiang-university", title: "浙江省政府来华留学生奖学金", reason: "semantic overlap with a richer official 2026 Zhejiang Government Scholarship record; archive/replace requires exact approval" }, { existingSlug: "zhejiang-university-csc-type-a", title: "中国政府奖学金国别双边项目（CSC Type A）", reason: "semantic overlap with a richer official 2026 CSC Type A record; archive/replace requires exact approval" }], unresolvedFields: ["Rows publishing combined academic/professional durations retain the exact duration text when a single numeric duration cannot be represented.", "Program-specific language thresholds remain linked to official ZJU requirements unless explicitly stated in the reviewed catalog.", "Two conflicting legacy scholarship summaries are excluded from this safe publication batch pending reconciliation approval."], sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, tuition, admissions and scholarship data is included. Applicant data is absent. Personal contact strings from program-table notes are removed from public application notes." }, reviewNotes: ["Program identity is degree + teaching language + school/department + discipline/program.", "Master and doctoral catalogs are official 2026 ZJU publications; tuition and special deadlines are preserved per row.", "The existing verified International Chinese Language Teachers Scholarship is untouched."] };
const reviewHash = sha256(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: "standing-user-default-publication" };
await writeFile(candidatePath, candidateText, { flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, bundleSha256: validation.bundleSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
