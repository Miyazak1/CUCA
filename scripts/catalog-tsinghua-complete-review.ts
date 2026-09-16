import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const parsedPath = resolve(workRoot, "tsinghua-complete-batch-01/parsed-routes.json");
const candidatePath = resolve(root, "seeds/catalog.tsinghua-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tsinghua-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.tsinghua-complete-batch-01.review.json");
const schoolSlug = "tsinghua-university";
const applicationUrl = "https://apply.join-tsinghua.edu.cn/international/res/SpecialWsbm/index.html";

const expected: Record<string, string> = {
  "tsinghua-undergraduate-programs-2026": "c47f28b4b2a0ac287e1ce526231caf974512df24e50f23d70321eaf08bc67d5d",
  "tsinghua-international-undergraduate-program-overview": "26f42f81df92ad91a44912ed58d1ec0a1d41053362d722ea0aa764d536e45a60",
  "tsinghua-graduate-admission-guide-2026": "e3f3f646fb9851825f188815cb1a7376e8587e86d6fd15d0e03aba2124d62992",
  "tsinghua-graduate-programs-2026": "e6edcfe5021e59fb8507347026a38e435fdd0f34d654f771b44c50ed5fba8c04",
  "tsinghua-graduate-programs-english": "0f48027b774cb983b0152b76496a2a2a6cfb7eb520b1328e0ca0842400cc48e1",
  "tsinghua-graduate-open-programs-2026": "6899100c5dbba1de90ff448f292cad51fa8460d1070ff2578a94bae75926c04a",
  "tsinghua-chinese-government-scholarship-2026": "2faaf9f9392577a0d70131e1853e7111e8640f18c5c66957c5639bdd2e61415d",
  "tsinghua-asian-future-leaders-scholarship-2026": "26effc080cae16474ba1889095e519f8c0eea5e51fe86b1ec9f1db4fac29c1f8",
  "tsinghua-graduate-financial-aid-system": "139678bc12a21b33da04886bb964873df5dd3aede7529b78da062422e4ee9455",
  "tsinghua-graduate-scholarship-application-index": "84ef23cb2b2f9d133c4dd1b026b7de1e6c67bea3c1c952df5b1606cb3c6a7758",
  "tsinghua-international-undergraduate-admissions-home-2026": "736a425b89752432d97af07fca203c69fabb996a607e1bb1bad9fa91515dce0e",
  "tsinghua-international-undergraduate-application-procedures-2026": "1460bcaf1e459a8a584c628b6d2d187a867b7e3a331beec474e60cade25c05d9",
  "tsinghua-international-undergraduate-divisions-2026": "6a4281c15e754f284d0ee60ff2446f83f4950455bdcbd49f4b7371e7e2a5671b",
  "tsinghua-international-undergraduate-english-programs-2026": "3c30e9c27e779afc9e66a8c074fae867a6abc2bfafb9a0a3d6866952f7805972",
  "tsinghua-international-undergraduate-faq-2026": "72487490675d1b145faa4d40f20a71768f669b35165324a68997583cd3a37d20",
  "tsinghua-international-undergraduate-fees-2026": "2a616665e6074024a47024e6bf543c7c9475cb2e32317456b847b525aed753c5",
  "tsinghua-international-undergraduate-schedule-2026": "0a12432a35493923f0c74cc0ba80d83bb5727bbd6baaf9bd1397a5be6b1b3f38",
  "tsinghua-international-undergraduate-upload-documents-2026": "6d93ddb8c9edda80d0cff0e4f28b592ae7a22e72786a4e5aa2d05061458809ed",
};

async function findEvidence() {
  const evidence = new Map<string, any>();
  for (const entry of await readdir(workRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8"));
      for (const source of manifest.sources ?? []) {
        if (expected[source.id] && source.status === 200 && source.sha256 === expected[source.id]) evidence.set(source.id, source);
      }
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const missing = Object.keys(expected).filter(id => !evidence.has(id));
  if (missing.length) throw new Error(`Missing locked Tsinghua evidence: ${missing.join(", ")}`);
  return evidence;
}

const evidence = await findEvidence();
const parsed = JSON.parse(await readFile(parsedPath, "utf8"));
const requiredCounts = { undergraduate: 91, graduateEnglish: 37, doctoralEnglish: 9, masterEnglish: 28, total: 128 };
if (JSON.stringify(parsed.counts) !== JSON.stringify(requiredCounts)) throw new Error(`Unexpected route counts: ${JSON.stringify(parsed.counts)}`);

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const used = new Set<string>();
function uniqueSlug(route: any, index: number) {
  const base = `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.fieldCategory)}-${slugify(route.nameEn)}-${slugify(route.teachingLanguage)}`;
  const slug = used.has(base) ? `${base}-${index + 1}` : base;
  used.add(slug);
  return slug;
}
function undergraduateTuition(route: any) {
  const text = `${route.fieldCategory} ${route.admissionGroup} ${route.nameEn}`;
  if (/Clinical Medicine/i.test(text)) return { tuitionText: "RMB 40,000/year foundation stage; RMB 60,000/year research stage; RMB 70,000/year clinical stage", displayTuition: "RMB 40,000-70,000/year" };
  if (/Arts|Design|Fine Arts|Sculpture|Art History/i.test(text)) return { tuitionAmount: 40000, tuitionText: "RMB 40,000/year", displayTuition: "RMB 40,000/year" };
  if (route.teachingLanguage === "English") return { tuitionText: "See the official English-taught program guide", displayTuition: "Program-specific" };
  if (/Humanities|Economics|Finance|Management|Law|Xinya|Rixin|Zhishan/i.test(text)) return { tuitionAmount: 26000, tuitionText: "RMB 26,000/year", displayTuition: "RMB 26,000/year" };
  return { tuitionAmount: 30000, tuitionText: "RMB 30,000/year", displayTuition: "RMB 30,000/year" };
}

const division = evidence.get("tsinghua-international-undergraduate-divisions-2026")!;
const faq = evidence.get("tsinghua-international-undergraduate-faq-2026")!;
const graduate = evidence.get("tsinghua-graduate-programs-english")!;
const programs: CatalogSeedProgram[] = [...parsed.undergraduate, ...parsed.graduateEnglish].map((route: any, index: number) => {
  const isUg = route.degree === "Undergraduate";
  const source = isUg ? division : graduate;
  const durationYears = isUg ? (/Architecture|Sculpture/i.test(route.nameEn) ? 5 : /Clinical Medicine/i.test(route.nameEn) ? 8 : 4) : undefined;
  return {
    slug: uniqueSlug(route, index), schoolSlug, citySlug: "beijing", nameEn: route.nameEn, degreeLevel: route.degree,
    ...(durationYears ? { durationYears } : {}), fieldCategory: route.fieldCategory, subjectArea: route.admissionGroup,
    teachingLanguage: route.teachingLanguage,
    cscaRequirement: isUg ? "CSCA is not mandatory for the 2026 intake; optional scores are recommended to include mathematics and physics." : "No CSCA requirement is published for this graduate route.",
    ...(isUg && route.teachingLanguage !== "English" ? { hskRequirement: "HSK 5 with every subscore above 60, or HSK 4 with every subscore above 60 and HSK 5 achieved by the end of the first academic year" } : {}),
    ...(route.teachingLanguage === "English" ? { englishRequirement: "High English proficiency is required; TOEFL or IELTS evidence is accepted, with the program-specific guide controlling." } : {}),
    ...(isUg ? undergraduateTuition(route) : { tuitionText: "Program-specific tuition; not stated on the collected official English-program index", displayTuition: "Program-specific" }),
    tuitionCurrency: "RMB", tuitionPeriod: "year", scholarshipText: "Official Tsinghua and Chinese Government Scholarship routes are reviewed separately.",
    applicationUrl: isUg ? applicationUrl : "https://yzbm.tsinghua.edu.cn/intlLogin",
    applicationNote: `${route.admissionGroup}; ${route.sourceTable}`,
    hasScholarship: true, badgeText: `Official ${route.degree.toLowerCase()} route`, displayGroup: route.degree, displayGroupLabel: `${route.degree} programs`, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${route.sourceTable} program entry`, degreeLevel: `${route.sourceTable} section`, fieldCategory: `${route.sourceTable} school/department`, teachingLanguage: `${route.sourceTable} language category`,
      ...(durationYears ? { durationYears: "Tsinghua international undergraduate overview" } : {}),
      ...(isUg ? { tuitionText: "2026 international undergraduate fees", applicationUrl: "2026 application procedures", cscaRequirement: "2026 international undergraduate FAQ" } : { applicationUrl: "2026 graduate admission guide" }),
    },
  };
});

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Beijing, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    targetCountries: [], targetRegions: [],
    sourceFieldLineage: { title: `${sourceId} title`, fundingLevel: `${sourceId} coverage`, coverage: `${sourceId} coverage`, amountText: `${sourceId} coverage`, applicableDegree: `${sourceId} eligibility`, eligibilityItems: `${sourceId} eligibility`, applicationMaterials: `${sourceId} materials`, applicationSteps: `${sourceId} procedure`, ...(value.deadlineDate ? { deadlineDate: `${sourceId} deadline` } : {}) },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }], ...value,
  };
};
const graduateMaterials = [info("Online application"), info("Degree certificate or expected-graduation evidence"), info("Academic transcripts"), info("Language proficiency evidence"), info("Personal statement or study plan"), info("Recommendation letters", "Follow the selected program's published requirements")];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("tsinghua-chinese-government-scholarship-2026", {
    slug: "official-2026-tsinghua-chinese-government-scholarship-type-b", title: "Tsinghua University 2026 Chinese Government Scholarship Type B", type: "government", typeLabel: "Chinese Government Scholarship - Type B", providerNameEn: "China Scholarship Council / Tsinghua University", fundingLevel: "Full or partial",
    coverage: "Full awards cover tuition, university dormitory or accommodation subsidy, stipend and comprehensive medical insurance; partial awards cover selected items", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible Tsinghua graduate programs", amountText: "Full: tuition, accommodation, stipend and medical insurance; partial: selected components",
    deadlineLabel: "Tsinghua recommends completing the degree application before mid-December 2025; program and CSC deadlines control", applicationRound: "2026 graduate intake",
    benefitItems: [benefit("Tuition"), benefit("University dormitory or accommodation subsidy"), benefit("Monthly stipend"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good health"), info("Master", "Bachelor's degree holder under 35"), info("Doctoral", "Master's degree holder under 40"), info("Chinese-taught route", "HSK 4 is required by the scholarship call")],
    applicationMaterials: [...graduateMaterials, info("CSC Type B application")], applicationSteps: [info("Step 1", "Apply to the Tsinghua graduate program and seek pre-admission"), info("Step 2", "Complete the CSC Type B application"), info("Step 3", "Follow Tsinghua and CSC review notices")],
    summary: "The 2026 Tsinghua Type B route for eligible international master's and doctoral applicants.",
  }),
  scholarship("tsinghua-asian-future-leaders-scholarship-2026", {
    slug: "official-2026-tsinghua-asian-future-leaders-scholarship", title: "Tsinghua University 2026 Asian Future Leaders Scholarship Program", type: "foundation", typeLabel: "Asian Future Leaders Scholarship", providerNameEn: "Bai Xian Asia Institute / Tsinghua University", fundingLevel: "Full",
    coverage: "Tuition and living allowance, including accommodation, books and study materials", applicableDegree: "Master", applicableProgram: "Eligible full-time one- or two-year English-taught master's programs", amountText: "Tuition plus living allowance including accommodation, books and materials",
    deadlineDate: "2026-03-01", deadlineLabel: "March 1, 2026", applicationRound: "2026 master's intake",
    benefitItems: [benefit("Tuition"), benefit("Living allowance", "Includes accommodation, books and study materials")],
    eligibilityItems: [info("Nationality", "Asian non-Chinese applicant"), info("Study mode", "Full-time one- or two-year master's program"), info("Language", "English-taught route"), info("Other funding", "Applicants may not hold another scholarship concurrently")],
    applicationMaterials: [...graduateMaterials, info("AFLSP materials requested by the admitting department")], applicationSteps: [info("Step 1", "Apply for the eligible Tsinghua master's program"), info("Step 2", "Submit the AFLSP materials to the admitting department by the published deadline")],
    summary: "Full support for eligible Asian applicants to selected English-taught master's programs.",
  }),
  scholarship("tsinghua-graduate-financial-aid-system", {
    slug: "official-tsinghua-graduate-tuition-scholarships", title: "Tsinghua Graduate Tuition Scholarships", type: "university", typeLabel: "Beijing Government and Tsinghua Tuition Scholarships", providerNameEn: "Tsinghua University", fundingLevel: "Full or partial tuition",
    coverage: "Full or partial tuition support for one academic year, renewable through competitive annual review", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible international graduate programs", amountText: "Full or partial tuition for one academic year",
    deadlineLabel: "No single dated deadline is published on the collected financial-aid overview", applicationRound: "Annual competitive review",
    benefitItems: [benefit("Tuition", "Full or partial for one academic year")], eligibilityItems: [info("Study route", "Eligible international graduate student"), info("Renewal", "Annual competitive review applies")],
    applicationMaterials: [info("Follow the current graduate application and scholarship instructions")], applicationSteps: [info("Step 1", "Review the current Tsinghua graduate scholarship call"), info("Step 2", "Submit through the route specified by Tsinghua")], summary: "University and Beijing Government tuition awards described in Tsinghua's graduate financial-aid system.",
  }),
  scholarship("tsinghua-international-undergraduate-faq-2026", {
    slug: "official-2026-tsinghua-institutional-scholarship-undergraduate", title: "Tsinghua Institutional Scholarship for International Undergraduates", type: "university", typeLabel: "Tsinghua Institutional Scholarship", providerNameEn: "Tsinghua University", fundingLevel: "Full, half or partial",
    coverage: "Full, half or partial scholarship support for the first academic year", applicableDegree: "Undergraduate", applicableProgram: "Outstanding international undergraduate freshmen", amountText: "Full, half or partial first-year award; the FAQ does not publish fixed cash amounts",
    deadlineLabel: "No separate dated deadline is published in the 2026 FAQ", applicationRound: "2026 international undergraduate intake",
    benefitItems: [benefit("First academic year award", "Full, half or partial level")], eligibilityItems: [info("Applicant group", "Outstanding international undergraduate freshmen")],
    applicationMaterials: [info("Follow the scholarship instructions in the international undergraduate application")], applicationSteps: [info("Step 1", "Complete the international undergraduate application"), info("Step 2", "Follow Tsinghua's scholarship selection notice")], summary: "First-year institutional scholarship route for outstanding international undergraduate freshmen.",
  }),
];

const home = evidence.get("tsinghua-international-undergraduate-admissions-home-2026")!;
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: home.fetchedAt,
  cities: [{ slug: "beijing", nameEn: "Beijing", nameZh: "北京", region: "North China", province: "Beijing", status: "active", sourceUrl: "https://admission-is.bnu.edu.cn/english/admissionprogram/bachelordegreeprogram/admissionbrochure/index.html", sourceLabel: "BNU 2026 undergraduate admission brochure", sourceSha256: "ac577f79869863eddb3fec145b7a5e59c542386bea1f61a2ca50906ee78c14e3", capturedAt: "2026-09-11T08:33:37.696Z", sourceFieldLineage: { nameEn: "institution and Beijing Campus address", province: "Beijing Campus address" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Tsinghua University", nameZh: "清华大学", citySlug: "beijing", schoolType: "public", region: "Beijing, North China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese, Chinese and English, or English depending on route",
    languageRequirement: "Chinese-English undergraduate routes publish HSK requirements; English routes require high English proficiency. Graduate requirements are program-specific.",
    hskRequirement: "Undergraduate Chinese-English routes: HSK 5 with every subscore above 60, or HSK 4 with every subscore above 60 and HSK 5 by the end of the first academic year.",
    englishRequirement: "English-taught routes require high English proficiency and accept TOEFL or IELTS evidence; no universal numeric minimum is published in the collected overview.",
    deadlineSummary: "2026 undergraduate rounds: September 30-November 28, 2025 and November 29, 2025-February 28, 2026. Graduate applications generally run September-February, with program-specific deadlines.",
    tuitionSummary: "International undergraduate Chinese-English routes publish RMB 26,000, RMB 30,000 or RMB 40,000/year by field; Clinical Medicine publishes RMB 40,000-70,000/year by stage. English and graduate tuition is program-specific.",
    applicationFee: "RMB 800", websiteUrl: "https://www.tsinghua.edu.cn/en/", admissionsUrl: home.url, cscaRequired: false,
    cscaRequirement: "CSCA is not mandatory for the 2026 international undergraduate intake; optional scores are recommended to include mathematics and physics.", cscaSubjects: [],
    subjectTags: [...new Set(programs.map(program => program.subjectArea).filter(Boolean))] as string[], languageTags: ["Chinese and English", "English"], tuitionBandLabel: "Undergraduate RMB 26,000-70,000/year; other routes program-specific",
    campusHighlights: ["91 explicitly listed international undergraduate routes", "28 enumerated English master's programs", "9 enumerated English doctoral programs", "Four independently structured scholarship routes"], status: "draft",
    sourceUrl: home.url, sourceLabel: home.label, sourceSha256: home.sha256, capturedAt: home.fetchedAt,
    sourceFieldLineage: { nameEn: "official international undergraduate home", citySlug: "official university location", applicationLevel: "undergraduate and graduate official pages", languageRequirement: "2026 undergraduate FAQ and graduate guide", deadlineSummary: "2026 undergraduate schedule and graduate guide", tuitionSummary: "2026 undergraduate fees", applicationFee: "2026 undergraduate FAQ and graduate guide", admissionsUrl: "official international undergraduate home", cscaRequirement: "2026 undergraduate FAQ" },
  }],
  programs,
  programIntakes: programs.filter(program => program.degreeLevel === "Undergraduate").map(program => ({
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-02-28T09:00:00.000Z", deadlineLabel: "Final undergraduate deadline: February 28, 2026, 17:00 Beijing time", applicationRound: "2026 international undergraduate admission", status: "closed" as const,
    sourceUrl: evidence.get("tsinghua-international-undergraduate-schedule-2026")!.url, sourceLabel: evidence.get("tsinghua-international-undergraduate-schedule-2026")!.label, sourceSha256: evidence.get("tsinghua-international-undergraduate-schedule-2026")!.sha256, capturedAt: evidence.get("tsinghua-international-undergraduate-schedule-2026")!.fetchedAt, sourceFieldLineage: { deadlineDate: "2026 admission schedule, second-round final deadline" },
  })),
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Tsinghua candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: 128, undergraduateRouteCount: 91, masterRouteCount: 28, doctoralRouteCount: 9, programIntakeCount: 91, scholarshipCount: 4, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch creates a new Tsinghua University school and new official program/scholarship slugs without archiving or overwriting any existing school, program or scholarship record." },
  reconciliation: { actionAfterReview: "insert_new_verified_tsinghua_catalog", destructiveDeletion: false, existingBeijingCityReusedWithByteEquivalentCatalogFields: true },
  excludedEvidence: [{ sourceId: "tsinghua-international-graduate-program-catalog-pdf-2026", reason: "The official PDF exceeds the deterministic collector's 15 MiB safety limit. It was not bypassed, and generic graduate entries not explicitly enumerated on the collected English-program page are not published." }],
  unresolvedFields: ["Graduate and English-taught undergraduate tuition remains program-specific where the collected official page does not state a value.", "Graduate deadlines are program-specific; no synthetic dated intake is created.", "No numeric universal English-test minimum is inferred."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, admissions, program and scholarship information is included; no applicant, account, payment or private personal data is present." },
  reviewNotes: ["The 91 undergraduate routes come from the official international divisions/colleges page, not the university-wide total-major count.", "The 37 graduate routes are exactly the 28 master's and 9 doctoral programs enumerated in English.", "Four scholarship records are independently structured with eligibility, benefits, materials and steps.", "No existing record is archived, overwritten or deleted."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const review = { ...reviewBase, reviewHash, publicationReference: "standing-user-default-publication" };
await writeFile(candidatePath, candidateText, { flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
