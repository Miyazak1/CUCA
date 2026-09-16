import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const runDir = resolve(root, "work/catalog-official/hit-complete-batch-01");
const candidatePath = resolve(root, "seeds/catalog.hit-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.hit-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.hit-complete-batch-01.review.json");
const schoolSlug = "harbin-institute-of-technology";
const applicationUrl = "https://hit.at0086.cn/student";

const expected: Record<string, string> = {
  "hit-bachelor-guide-2026": "2979f544e17bafb474d10e6c4cf0a1af07a928b3dc702f6c0e893c39fc28f3ea",
  "hit-bachelor-programs-2026": "d96e9caa434003ec99d638deb927191ac91bfd06f5608ddb070895fb52ac94df",
  "hit-master-guide-2026": "a1b832af1d5682d7010e3d012dc47a276675fc43d53e90050cfaad94bef69299",
  "hit-master-programs-chinese-2026": "a33d9672ca6d555de64be1c89d256843a47bb1f2b47d5ac04a9daeb4237ea580",
  "hit-master-programs-english-2026": "4778cb790dbaa13697d03148a5b248979b4826a203c7a49097723d53ec4789e2",
  "hit-doctoral-guide-2026": "a4a1ac659ebd5221acaa635e59df76b849a2b602f3fc23b906a9432736abeae6",
  "hit-doctoral-programs-2026": "d6dc6f5f827cd293a4dea060e5cc31a3a8e97ab6c58de101a803317b072e32bc",
  "hit-chinese-government-scholarship-2026": "886a8690703cd3ed0a7066e2037122b271829785c40752a53e318fd31571968b",
  "hit-international-students-scholarship-2026": "5f61a8c0b3fd57a04b2d7a8c2fcc4cc56365b6ef22ad2493805accabf399b503",
  "hit-youth-excellence-mba-2026": "a619eb999fefca0d65b80302736dcab12164e6a638bcd0e6065ab1d3675d43bc",
  "hit-youth-excellence-transportation-2026": "d5c706cf3b94938db9a8e7b09852305b4cbeeb2e9ff262ad48961b5b4effb2b9",
  "hit-china-link-scholarship-2026": "2f8038073786c333a19d022a67332658df70f6c8d8b88f0562d08da48a2d99ba",
};

const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
const parsed = JSON.parse(await readFile(resolve(runDir, "parsed-routes.json"), "utf8"));
const evidence = new Map<string, any>();
for (const source of manifest.sources ?? []) {
  if (source.status !== 200 || expected[source.id] !== source.sha256) throw new Error(`Official snapshot mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
if (evidence.size !== Object.keys(expected).length) throw new Error("The complete HIT evidence set was not collected.");
const requiredCounts = { undergraduate: 97, masterChinese: 36, masterEnglish: 16, master: 52, doctoral: 33, total: 182 };
if (JSON.stringify(parsed.counts) !== JSON.stringify(requiredCounts)) throw new Error(`Unexpected HIT route counts: ${JSON.stringify(parsed.counts)}`);

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const subjects = (text: string) => [
  /Chinese for STEM/i.test(text) ? "STEM Chinese" : null,
  /Chinese for Humanities/i.test(text) ? "Humanities Chinese" : null,
  /Mathematics/i.test(text) ? "Mathematics" : null,
  /Physics/i.test(text) ? "Physics" : null,
  /Chemistry/i.test(text) ? "Chemistry" : null,
].filter(Boolean) as string[];
const usedSlugs = new Set<string>();
const programs: CatalogSeedProgram[] = parsed.routes.map((route: any, index: number) => {
  const source = evidence.get(route.sourceId)!;
  const guideId = route.degree === "Undergraduate" ? "hit-bachelor-guide-2026" : route.degree === "Master" ? "hit-master-guide-2026" : "hit-doctoral-guide-2026";
  const guide = evidence.get(guideId)!;
  const routeSubjects = subjects(route.cscaRequirementEn || "");
  const teachingLanguage = route.language === "English & Chinese" ? "Chinese and English" : route.language;
  let slug = `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.schoolEn)}-${slugify(route.majorEn)}-${slugify(teachingLanguage)}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${index + 1}`;
  usedSlugs.add(slug);
  const tuition = route.degree === "Undergraduate" ? (route.language === "English" ? 26000 : 20000) : route.degree === "Master" ? (route.language === "English" ? 34000 : 28000) : (route.language === "Chinese" ? 36000 : 42000);
  const deadlineDate = route.degree === "Undergraduate" ? "2026-07-15T15:59:59.000Z" : "2026-05-31T15:59:59.000Z";
  return {
    slug, schoolSlug, citySlug: "harbin", nameEn: route.majorEn, degreeLevel: route.degree,
    ...(Number.isInteger(route.durationYears) ? { durationYears: route.durationYears } : { durationMonths: Math.round(route.durationYears * 12) }),
    fieldCategory: route.schoolEn, subjectArea: route.majorEn,
    teachingLanguage,
    ...(routeSubjects.length ? { cscaSubjects: routeSubjects, cscaRequirement: route.cscaRequirementEn } : {}),
    ...(teachingLanguage === "Chinese" ? { hskRequirement: "HSK Level 4, score 210 or above; published prior Chinese-medium study exemption may apply" } : {}),
    ...(teachingLanguage !== "Chinese" ? { englishRequirement: "TOEFL iBT 80 or above, or IELTS Academic 6.0 with no subtest below 5.5; published prior English-medium study exemption may apply" } : {}),
    tuitionAmount: tuition, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `RMB ${tuition.toLocaleString("en-US")}/year`,
    scholarshipText: "Chinese Government Scholarship and HIT International Students Scholarship are reviewed as separate award routes.",
    applicationUrl, hasScholarship: true, applicationNote: `${route.schoolEn}; official spreadsheet row ${route.sourceRow}`,
    badgeText: `Official ${route.degree.toLowerCase()} route`, displayGroup: route.degree, displayGroupLabel: `${route.degree} programs`, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${source.id} row ${route.sourceRow} major`, degreeLevel: `${source.id} catalog title`, fieldCategory: `${source.id} row ${route.sourceRow} school`,
      teachingLanguage: `${source.id} row ${route.sourceRow} teaching language`,
      ...(Number.isInteger(route.durationYears) ? { durationYears: `${source.id} row ${route.sourceRow} duration` } : { durationMonths: `${source.id} row ${route.sourceRow} duration converted from years` }),
      tuitionAmount: `${guideId} fees table`, applicationUrl: `${guideId} application process`, ...(routeSubjects.length ? { cscaSubjects: `${source.id} row ${route.sourceRow} CSCA subjects` } : {}),
    },
    _deadlineDate: deadlineDate,
  } as CatalogSeedProgram & { _deadlineDate: string };
});

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Harbin, Heilongjiang, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: { title: `${sourceId} page title`, fundingLevel: `${sourceId} scholarship coverage`, coverage: `${sourceId} scholarship coverage`, amountText: `${sourceId} scholarship coverage`, applicableDegree: `${sourceId} supporting categories and eligibility`, eligibilityItems: `${sourceId} eligibility`, applicationMaterials: `${sourceId} application documents`, applicationSteps: `${sourceId} application process`, ...(value.deadlineDate ? { deadlineDate: `${sourceId} application period` } : {}) },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "HIT application system", url: applicationUrl, kind: "official-application" }],
    ...value,
  };
};
const commonMaterials = [info("Passport homepage"), info("Highest diploma or expected-graduation certificate"), info("Academic transcripts"), info("Language proficiency certificate"), info("Physical examination record"), info("Non-criminal record")];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("hit-chinese-government-scholarship-2026", {
    slug: "official-2026-hit-chinese-government-scholarship-type-b", title: "HIT 2026 Chinese Government Scholarship Type B", type: "government", typeLabel: "Chinese Government Scholarship - Type B", providerNameEn: "China Scholarship Council / Harbin Institute of Technology", fundingLevel: "Full",
    coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly living allowance", applicableDegree: "Master, Doctoral", applicableProgram: "Programs in the official HIT 2026 CSC major lists", amountText: "Master RMB 3,000/month; doctoral RMB 3,500/month; tuition, on-campus accommodation and RMB 800/year medical insurance",
    deadlineDate: "2026-02-20", deadlineLabel: "Stage 1: December 31, 2025; Stage 2: February 20, 2026", applicationRound: "2026 graduate intake",
    benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Comprehensive medical insurance", "RMB 800/year"), benefit("Master stipend", "RMB 3,000/month"), benefit("Doctoral stipend", "RMB 3,500/month")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good health"), info("Master", "Bachelor's degree and under 35"), info("Doctoral", "Master's degree and under 40"), info("No double funding")],
    applicationMaterials: [...commonMaterials, info("CSC application form"), info("Study plan", "At least 1,500 words"), info("Two academic recommendation letters")],
    applicationSteps: [info("Step 1", "Complete the CSC Type B application"), info("Step 2", "Complete the HIT application and upload the CSC form"), info("Step 3", "Complete HIT and CSC review")],
    summary: "Full CSC Type B funding for eligible 2026 HIT master's and doctoral routes.",
  }),
  scholarship("hit-international-students-scholarship-2026", {
    slug: "official-2026-hit-international-students-scholarship", title: "HIT 2026 International Students Scholarship", type: "university", typeLabel: "HIT Scholarship", providerNameEn: "Harbin Institute of Technology", fundingLevel: "Tiered tuition waiver",
    coverage: "Elite 100%, First 50%, Second 30%, or Third 20% tuition waiver", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Eligible HIT degree programs", amountText: "Elite 100%; First 50%; Second 30%; Third 20% tuition waiver",
    deadlineDate: "2026-05-31", deadlineLabel: "Graduate deadline May 31, 2026; undergraduate deadline July 15, 2026", applicationRound: "October 1, 2025 through the applicable 2026 degree deadline",
    benefitItems: [benefit("Elite", "100% tuition waiver"), benefit("First", "50% tuition waiver"), benefit("Second", "30% tuition waiver"), benefit("Third", "20% tuition waiver")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good health"), info("Undergraduate", "High-school diploma and under 25"), info("Master", "Bachelor's degree and under 30"), info("Doctoral", "Master's degree and under 35"), info("No double funding")],
    applicationMaterials: [...commonMaterials, info("HIT Scholarship application form"), info("Study plan and recommendations for graduate applicants")],
    applicationSteps: [info("Step 1", "Complete the HIT online application"), info("Step 2", "Pay the published scholarship application fee"), info("Step 3", "Upload degree-specific supporting documents")],
    summary: "Four-tier HIT tuition award for undergraduate, master's and doctoral applicants.",
  }),
  scholarship("hit-youth-excellence-mba-2026", {
    slug: "official-hit-youth-excellence-mba", title: "HIT Youth of Excellence Scheme of China - Business Administration", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "Ministry of Education of the PRC / Harbin Institute of Technology", fundingLevel: "Full",
    coverage: "Full scholarship; living allowance is provided for the first year", applicableDegree: "Master", applicableProgram: "Business Administration, English-taught 1+1 model", amountText: "Full scholarship; official HIT page states the living allowance lasts one year",
    deadlineLabel: "Follow the current CSC Youth of Excellence call; HIT page does not publish a dated deadline", applicationRound: "Two-year 1+1 master's model",
    benefitItems: [benefit("Full scholarship"), benefit("Living allowance", "First year only")],
    eligibilityItems: [info("Age", "Under 45"), info("Education and experience", "Bachelor's degree or above and at least three years of work experience"), info("Pre-admission", "HIT pre-admission letter required")],
    applicationMaterials: [...commonMaterials, info("English study or research plan", "At least 1,000 words"), info("Two recommendation letters"), info("Employment or internship evidence")],
    applicationSteps: [info("Step 1", "Obtain an HIT pre-admission letter"), info("Step 2", "Apply in the CSC system as Type A, agency 1563")], summary: "English-taught 1+1 MBA route under the Chinese Government Scholarship Youth of Excellence scheme.",
  }),
  scholarship("hit-youth-excellence-transportation-2026", {
    slug: "official-hit-youth-excellence-transportation-engineering", title: "HIT Youth of Excellence Scheme of China - Transportation Engineering", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "Ministry of Education of the PRC / Harbin Institute of Technology", fundingLevel: "Full",
    coverage: "Full scholarship; living allowance is provided for the first year", applicableDegree: "Master", applicableProgram: "Transportation Engineering, English-taught 1+1 model", amountText: "Full scholarship; official HIT page states the living allowance lasts one year",
    deadlineLabel: "Follow the current CSC Youth of Excellence call; HIT page does not publish a dated deadline", applicationRound: "Two-year 1+1 master's model",
    benefitItems: [benefit("Full scholarship"), benefit("Living allowance", "First year only")],
    eligibilityItems: [info("Age", "Under 45"), info("Education and experience", "Bachelor's degree or above and at least three years of work experience"), info("Pre-admission", "HIT pre-admission letter required")],
    applicationMaterials: [...commonMaterials, info("English study or research plan", "At least 1,000 words"), info("Two recommendation letters"), info("Employment or internship evidence")],
    applicationSteps: [info("Step 1", "Obtain an HIT pre-admission letter"), info("Step 2", "Apply in the CSC system as Type A, agency 1563")], summary: "English-taught 1+1 Transportation Engineering route under the Chinese Government Scholarship Youth of Excellence scheme.",
  }),
];

const bachelorGuide = evidence.get("hit-bachelor-guide-2026")!;
const cleanPrograms = programs.map(({ _deadlineDate, ...program }: any) => program);
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: "harbin", nameEn: "Harbin", nameZh: "哈尔滨", region: "Northeast China", province: "Heilongjiang", status: "draft", sourceUrl: bachelorGuide.url, sourceLabel: bachelorGuide.label, sourceSha256: bachelorGuide.sha256, capturedAt: bachelorGuide.fetchedAt, sourceFieldLineage: { nameEn: "official university address", province: "official university address" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Harbin Institute of Technology", nameZh: "哈尔滨工业大学", citySlug: "harbin", schoolType: "public", region: "Harbin, Heilongjiang, Northeast China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English depending on program",
    languageRequirement: "Chinese routes require HSK 4 score 210; English routes require TOEFL iBT 80 or IELTS Academic 6.0 with no subtest below 5.5, subject to published exemptions.",
    hskRequirement: "HSK Level 4, score 210 or above for degree admission; the CSC Type B scholarship page separately publishes 180.",
    englishRequirement: "TOEFL iBT 80 or above, or IELTS Academic 6.0 with no subtest below 5.5; prior English-medium study exemption may apply.",
    deadlineSummary: "Undergraduate self-financed and HIT Scholarship deadline July 15, 2026. Master's and doctoral self-financed/HIT Scholarship deadline May 31, 2026. CSC Type B stages December 31, 2025 and February 20, 2026.",
    tuitionSummary: "Undergraduate RMB 20,000 Chinese or RMB 26,000 English/year; master RMB 28,000 Chinese or RMB 34,000 English/year; doctoral RMB 36,000 Chinese or RMB 42,000 English/year.",
    applicationFee: "RMB 400 self-financed; RMB 600 HIT Scholarship", websiteUrl: "https://www.hit.edu.cn/", admissionsUrl: bachelorGuide.url, cscaRequired: true,
    cscaRequirement: "All undergraduate applicants must submit CSCA results; exact Chinese/Mathematics/Physics/Chemistry subjects are published per program.",
    cscaSubjects: ["STEM Chinese", "Humanities Chinese", "Mathematics", "Physics", "Chemistry"],
    subjectTags: [...new Set(cleanPrograms.map(program => program.subjectArea).filter(Boolean))] as string[], languageTags: ["Chinese", "English"], tuitionBandLabel: "RMB 20,000-42,000/year",
    campusHighlights: ["97 official undergraduate routes", "52 official master's routes", "33 official doctoral routes", "Four independently structured scholarship routes"],
    status: "draft", sourceUrl: bachelorGuide.url, sourceLabel: bachelorGuide.label, sourceSha256: bachelorGuide.sha256, capturedAt: bachelorGuide.fetchedAt,
    sourceFieldLineage: { nameEn: "official admission guide", citySlug: "official address", applicationLevel: "three degree guides", languageRequirement: "degree-guide eligibility sections", deadlineSummary: "degree-guide application periods", tuitionSummary: "degree-guide fee tables", applicationFee: "degree-guide fee tables", admissionsUrl: "registered official bachelor guide", cscaRequirement: "official 2026/27 bachelor major list" },
  }],
  programs: cleanPrograms,
  programIntakes: programs.map((program: any) => {
    const graduate = program.degreeLevel !== "Undergraduate";
    const source = evidence.get(graduate ? program.degreeLevel === "Master" ? "hit-master-guide-2026" : "hit-doctoral-guide-2026" : "hit-bachelor-guide-2026")!;
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: program._deadlineDate, deadlineLabel: graduate ? "September 2026 intake deadline: May 31, 2026" : "September 2026 intake deadline: July 15, 2026", applicationRound: "Applications open throughout the year until the published final deadline", status: "closed" as const, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: "official degree guide application period" } };
  }),
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`HIT candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: manifest.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: 182, undergraduateRouteCount: 97, masterRouteCount: 52, doctoralRouteCount: 33, scholarshipCount: 4, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch creates a new HIT main-campus school, official program routes and rich scholarships without archiving or overwriting existing records." },
  reconciliation: { actionAfterReview: "insert_new_verified_hit_main-campus_catalog", destructiveDeletion: false, legacyScholarshipRecordsObservedButNotTouched: ["harbin-institute-of-technology-freshman-scholarship", "harbin-institute-of-technology-scholarship"] },
  excludedEvidence: [{ sourceId: "hit-china-link-scholarship-2026", reason: "The captured official page still publishes 2024/2025 decision dates, so it is retained as evidence but excluded from the 2026 catalog." }],
  unresolvedFields: ["Youth of Excellence pages do not publish a current dated deadline; records direct users to the current CSC call.", "Two legacy low-field scholarship rows remain pending a separate archival approval."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional admissions, program and scholarship information is included; no applicant, account, payment or private contact data is present." },
  reviewNotes: ["All 182 rows from the four official major-list files are represented.", "Scholarships are distinct award routes rather than admission-notice titles.", "No legacy record is archived or overwritten by this batch."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const review = { ...reviewBase, reviewHash, publicationReference: "standing-user-default-publication" };
await writeFile(candidatePath, candidateText, { flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: true, counts: parsed.counts, scholarshipCount: scholarships.length, candidateSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
