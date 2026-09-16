import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  extracted: resolve(root, "work/catalog-official/scu-complete-batch-01/extracted-programs.json"),
  manifest: resolve(root, "work/catalog-official/scu-complete-batch-01/manifest.json"),
  supplementManifest: resolve(root, "work/catalog-official/scu-complete-batch-01-supplement/manifest.json"),
  candidate: resolve(root, "seeds/catalog.scu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.scu-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.scu-complete-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const manifestText = await readFile(paths.manifest, "utf8");
const supplementManifestText = await readFile(paths.supplementManifest, "utf8");
const extractedText = await readFile(paths.extracted, "utf8");
const manifest = JSON.parse(manifestText);
const supplementManifest = JSON.parse(supplementManifestText);
const extracted = JSON.parse(extractedText);
const evidence = new Map([...manifest.sources, ...supplementManifest.sources].map((source: any) => [source.id, source]));
const requiredSourceIds = [
  "scu-international-admission-guide-2026",
  "scu-undergraduate-program-catalog-2026",
  "scu-master-program-catalog-2026",
  "scu-doctoral-program-catalog-2026",
  "scu-youth-of-excellence-scholarship-2026",
  "scu-chengdu-sister-cities-scholarship-2026",
  "scu-undergraduate-application-requirements-2026",
  "scu-master-application-requirements-2026",
  "scu-doctoral-application-requirements-2026",
  "scu-undergraduate-tuition-2026",
  "scu-master-tuition-2026",
  "scu-doctoral-tuition-2026",
];
for (const id of requiredSourceIds) {
  const source: any = evidence.get(id);
  if (!source || source.status !== 200 || source.contentType !== "text/html" || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Missing valid SCU evidence: ${id}`);
}
const expectedCounts = { programs: 639, bachelor: 84, master: 275, doctoral: 280, english: 59, chinese: 580 };
if (JSON.stringify(extracted.counts) !== JSON.stringify(expectedCounts)) throw new Error(`SCU extracted counts changed: ${JSON.stringify(extracted.counts)}`);
const schoolSlug = "sichuan-university";
const meta = (id: string) => {
  const source: any = evidence.get(id);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54).replace(/-+$/g, "");
const routeHash = (route: any) => sha(JSON.stringify([route.degreeLevel, route.collegeZh, route.collegeEn, route.nameZh, route.nameEn, route.teachingLanguage, route.durationYears])).slice(0, 12);
const degreeKey: Record<string, string> = { Bachelor: "bachelor", Master: "master", Doctoral: "doctoral" };
const tuitionByDegree: Record<string, { text: string; display: string; sourceId: string }> = {
  Bachelor: { text: "Official category schedule: CNY 17,500-45,000/year; the exact amount depends on humanities/economics/management, science/engineering, medicine, stomatology, clinical medicine, arts/sports or archaeology classification.", display: "CNY 17,500-45,000/year", sourceId: "scu-undergraduate-tuition-2026" },
  Master: { text: "Official category schedule: CNY 22,000-50,000/year; the exact amount depends on discipline, including separate MBA and MEM rates.", display: "CNY 22,000-50,000/year", sourceId: "scu-master-tuition-2026" },
  Doctoral: { text: "Official category schedule: CNY 26,000-60,000/year; the exact amount depends on humanities/economics/management, science/engineering, medicine, stomatology, clinical medicine, arts/sports or archaeology classification.", display: "CNY 26,000-60,000/year", sourceId: "scu-doctoral-tuition-2026" },
};
const requirementsByDegree: Record<string, string> = {
  Bachelor: "scu-undergraduate-application-requirements-2026",
  Master: "scu-master-application-requirements-2026",
  Doctoral: "scu-doctoral-application-requirements-2026",
};

const programs: CatalogSeedProgram[] = extracted.programs.map((route: any) => {
  const source = meta(route.sourceId);
  const tuition = tuitionByDegree[route.degreeLevel];
  const language = route.teachingLanguage;
  const isBachelor = route.degreeLevel === "Bachelor";
  return {
    slug: `official-2026-scu-${degreeKey[route.degreeLevel]}-${slugify(route.nameEn) || "route"}-${routeHash(route)}`,
    schoolSlug,
    citySlug: "chengdu",
    nameEn: route.nameEn,
    nameZh: route.nameZh,
    degreeLevel: route.degreeLevel,
    ...(Number.isInteger(route.durationYears) ? { durationYears: route.durationYears } : { durationMonths: Math.round(route.durationYears * 12) }),
    fieldCategory: route.collegeEn,
    subjectArea: route.nameEn,
    teachingLanguage: language,
    ...(isBachelor ? { cscaRequirement: "CSCA is required. Official subjects depend on route category and language: liberal arts Chinese—Chinese Language and Mathematics; liberal arts English—Mathematics; science/engineering Chinese—Chinese Language, Mathematics and Physics; science/engineering English—Mathematics and Physics; medical Chinese—Chinese Language, Mathematics, Physics and Chemistry; medical English—Mathematics, Physics and Chemistry." } : { cscaRequirement: "No CSCA requirement is published by SCU for this graduate route." }),
    ...(language === "Chinese" ? { hskRequirement: isBachelor ? (route.nameEn === "Chinese Language" ? "No HSK certificate is required for the Chinese Language undergraduate program." : "HSK 5 score 180 or above, or an accepted equivalent; prior Chinese-medium education may qualify for the published exemption.") : "Humanities routes: HSK 5 score 180 or above; science, engineering, medicine and agriculture routes: HSK 4 score 180 or above; accepted equivalents and the published prior Chinese-medium education exemption may apply." } : { englishRequirement: "TOEFL 80 or above, IELTS 6.0 or above, or an accepted equivalent; native English speakers and applicants with prior English-medium education may qualify for the published exemption." }),
    tuitionText: tuition.text,
    displayTuition: tuition.display,
    scholarshipText: "Eligible applicants may use applicable SCU and sponsor scholarship routes; the 2026 Youth of Excellence and Chengdu Sister Cities awards are published separately.",
    applicationUrl: "https://scu.17gz.org/member/login.do",
    applicationNote: `${route.collegeEn}; ${route.locator}. The official tuition page publishes category rates rather than a row-level mapping, so this route shows the verified degree-level range without inferring a category.`,
    hasScholarship: true,
    badgeText: "Official 2026 route",
    displayGroup: route.degreeLevel,
    displayGroupLabel: `${route.degreeLevel} programs`,
    status: "draft",
    ...source,
    sourceFieldLineage: {
      nameZh: `${route.locator}, Major (Chinese row)`,
      nameEn: `${route.locator}, Major (English row)`,
      fieldCategory: `${route.locator}, College`,
      teachingLanguage: `${route.locator}, Medium of Instruction`,
      ...(Number.isInteger(route.durationYears) ? { durationYears: `${route.locator}, Education System (year)` } : { durationMonths: `${route.locator}, Education System (year); 2.5 years normalized to 30 months` }),
      cscaRequirement: isBachelor ? "undergraduate application requirements, CSCA certificate section" : "graduate application requirements; no CSCA field published",
      hskRequirement: language === "Chinese" ? `${requirementsByDegree[route.degreeLevel]}, language proficiency requirements` : undefined,
      englishRequirement: language === "English" ? `${requirementsByDegree[route.degreeLevel]}, language proficiency requirements` : undefined,
      tuitionText: `${tuition.sourceId}, category tuition table; degree-level range retained without inferred row mapping`,
    },
  };
});
if (new Set(programs.map(row => row.slug)).size !== programs.length) throw new Error("SCU program slugs are not unique.");

const intakeEvidence = meta("scu-international-admission-guide-2026");
const programIntakes = programs.map(program => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-05-30T00:00:00.000Z",
  deadlineLabel: program.degreeLevel === "Bachelor" ? "January 1-May 30, 2026" : "November 1, 2025-May 30, 2026",
  applicationRound: "2026 SCU international degree intake",
  status: "closed" as const,
  ...intakeEvidence,
  sourceFieldLineage: { deadlineDate: "Part 3, When to Apply; date-only value normalized to ISO UTC", intakeTerm: "2026 fall degree-admission context" },
}));

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, value: Omit<CatalogSeedScholarship, "schoolSlug" | "status" | "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt">): CatalogSeedScholarship => ({
  schoolSlug,
  status: "draft",
  providerLocation: "Chengdu, Sichuan, China",
  targetCountries: [],
  targetRegions: [],
  ...meta(sourceId),
  sourceFieldLineage: { title: "official page title", fundingLevel: "official funding section", coverage: "official funding section", amountText: "official funding section", applicableDegree: "official program profile / target beneficiaries", applicableProgram: "official program introduction / eligible degree section", eligibilityItems: "official eligibility section", applicationMaterials: "official application documents section", applicationSteps: "official application procedures section", deadlineDate: "official application deadline / timeline section" },
  ...value,
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship("scu-youth-of-excellence-scholarship-2026", {
    slug: "official-2026-scu-youth-of-excellence-scheme",
    title: "Sichuan University 2026 Youth of Excellence Scheme of China",
    nameZh: "四川大学2026年中国政府来华留学卓越奖学金",
    type: "government",
    typeLabel: "Youth of Excellence Scheme of China",
    providerNameEn: "China Scholarship Council / Sichuan University",
    fundingLevel: "Full",
    coverage: "Full scholarship. The SCU guide does not break out component amounts.",
    applicableDegree: "Master",
    applicableProgram: "Master of Tourism Management; Master of International Engineering Management (IMEM)",
    amountText: "Full scholarship; component amounts not separately published by SCU",
    deadlineDate: "2026-02-28",
    deadlineLabel: "SCU pre-admission by February 28, 2026; CSC submission by March 31, 2026",
    applicationRound: "2026 Youth of Excellence Scheme",
    benefitItems: [benefit("Full scholarship"), benefit("Two-year 1+1 study structure", "First year at SCU; dissertation work in the home country in year two; defense in China")],
    eligibilityItems: [info("Nationality, health and age", "Non-Chinese citizen in good physical and mental health, age 45 or under"), info("Education and experience", "Bachelor's degree or above and at least three years of work experience"), info("Professional profile", "Senior government official, senior institutional or enterprise manager, higher-education/research administrator, or applicant with international-organization work or internship experience"), info("Pre-admission", "SCU Overseas Students Office pre-admission letter required")],
    applicationMaterials: [info("Passport first page"), info("Bachelor's and later degree certificates and transcripts"), info("Employment/work-experience proof"), info("Two academic or equivalent expert recommendation letters"), info("English research proposal"), info("Academic publication contents and abstracts", "If applicable"), info("Language proficiency evidence"), info("Foreigner Physical Examination Form"), info("No-criminal-record certificate")],
    applicationSteps: [info("Step 1", "Apply in the SCU international system by February 28, 2026 and obtain pre-admission"), info("Step 2", "Apply in the CSC system as Type A, program Youth of Excellence Scheme, by March 31, 2026"), info("Step 3", "CSC conducts preliminary and expert review"), info("Step 4", "Results and admission documents are released in June; enrollment is in September")],
    actionLinks: [{ label: "Official SCU scholarship guide", url: "https://global.scu.edu.cn/oso/article/details/abff4e7a-f26f-4bab-be52-ab50154a9588?lang=en", kind: "official-source" }, { label: "SCU international application system", url: "https://scu.17gz.org/member/login.do", kind: "official-application" }],
    bodySections: [{ title: "Published SCU routes", items: ["Master of Tourism Management", "Master of International Engineering Management (IMEM)"] }, { title: "Study model", body: "The two-year program uses a 1+1 model: full-time study, fieldwork and dissertation preparation at SCU in year one, then part-time dissertation work in the home country and a defense in China under SCU requirements." }],
    summary: "SCU's 2026 full Youth of Excellence award for two English-taught 1+1 master's routes.",
    sortOrder: 10,
  }),
  scholarship("scu-chengdu-sister-cities-scholarship-2026", {
    slug: "official-2026-scu-chengdu-sister-cities-scholarship",
    title: "Sichuan University 2026 Chengdu Sister Cities Scholarship",
    nameZh: "四川大学2026年成都市友好城市奖学金",
    type: "government",
    typeLabel: "Chengdu Sister Cities Scholarship",
    providerNameEn: "Chengdu Municipal Government / Sichuan University",
    fundingLevel: "Partial",
    coverage: "Annual cash award only; it does not waive tuition, accommodation, living expenses or comprehensive medical insurance.",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Eligible 2026 SCU international degree programs",
    amountText: "Bachelor CNY 20,000/year for up to 4 years; Master CNY 25,000/year for up to 3 years; Doctoral CNY 30,000/year for up to 3 years",
    deadlineDate: "2026-05-30",
    deadlineLabel: "May 30, 2026",
    applicationRound: "2026 Chengdu Sister Cities Scholarship",
    targetRegions: ["Chengdu sister cities and friendly cooperation cities"],
    benefitItems: [benefit("Bachelor award", "CNY 20,000/year, maximum four years"), benefit("Master award", "CNY 25,000/year, maximum three years"), benefit("Doctoral award", "CNY 30,000/year, maximum three years")],
    eligibilityItems: [info("City connection", "Applicant was born, lived, studied or worked in, or currently lives, studies or works in a Chengdu sister city or friendly cooperation city"), info("Concurrent awards", "May not receive another scholarship simultaneously"), info("Admission", "Must meet the other SCU admission requirements"), info("Renewal", "Annual review is required for subsequent-year funding")],
    applicationMaterials: [info("SCU degree application materials"), info("Confirmation Letter of Sister City Status", "Issued by the relevant city government authority")],
    applicationSteps: [info("Step 1", "Prepare the degree-program application and official sister-city confirmation letter"), info("Step 2", "Apply through the SCU International Student Online Service System by May 30, 2026"), info("Step 3", "Complete the annual review for any subsequent-year award")],
    actionLinks: [{ label: "Official SCU scholarship page", url: "https://global.scu.edu.cn/oso/article/index/1137?lang=en", kind: "official-source" }, { label: "SCU international application system", url: "https://scu.17gz.org/member/login.do", kind: "official-application" }],
    bodySections: [{ title: "Important fee rule", body: "This scholarship does not waive any fee. Tuition, accommodation, living expenses and comprehensive medical insurance remain payable by the student." }],
    summary: "A 2026 partial municipal award for applicants connected to Chengdu's sister and friendly cooperation cities.",
    sortOrder: 20,
  }),
];

const schoolEvidence = meta("scu-international-admission-guide-2026");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{
    slug: "chengdu",
    nameEn: "Chengdu",
    nameZh: "成都",
    region: "西南",
    status: "active",
    sourceUrl: "https://www.cscapilot.com/zh/study-china/cities/chengdu",
    sourceLabel: "CSCAPilot online city catalog recovery export",
    sourceFieldLineage: { nameEn: "city_guides.nameEn", nameZh: "city_guides.nameZh", region: "city_guides.region" },
  }],
  schools: [{
    slug: schoolSlug,
    nameEn: "Sichuan University",
    nameZh: "四川大学",
    citySlug: "chengdu",
    region: "Chengdu, Sichuan, China",
    applicationLevel: "Bachelor, Master, Doctoral",
    languageOfInstruction: "Chinese or English depending on route",
    languageRequirement: "Chinese routes use published HSK thresholds; English routes accept TOEFL 80+, IELTS 6.0+ or equivalent with stated exemptions.",
    hskRequirement: "Bachelor: HSK 5 score 180+ except Chinese Language, which does not require HSK. Master and Doctoral: humanities HSK 5 score 180+; science, engineering, medicine and agriculture HSK 4 score 180+; published prior Chinese-medium education exemptions may apply.",
    englishRequirement: "TOEFL 80+, IELTS 6.0+ or accepted equivalent; native English speakers and applicants with prior English-medium education may qualify for exemption.",
    deadlineSummary: "2026 degree applications close May 30, 2026. Master and doctoral applications opened November 1, 2025; undergraduate applications opened January 1, 2026.",
    tuitionSummary: "Official annual category schedules: Bachelor CNY 17,500-45,000; Master CNY 22,000-50,000; Doctoral CNY 26,000-60,000.",
    websiteUrl: "https://www.scu.edu.cn/",
    admissionsUrl: "https://global.scu.edu.cn/oso/",
    cscaRequired: true,
    cscaRequirement: "Required for 2026 undergraduate applicants. Subjects vary by liberal arts, science/engineering or medical category and by Chinese/English medium; no graduate CSCA requirement is published.",
    cscaSubjects: ["Chinese Language for Chinese-taught routes", "Mathematics", "Physics for science/engineering and medical routes", "Chemistry for medical routes"],
    subjectTags: [...new Set(programs.map(row => row.fieldCategory).filter(Boolean))] as string[],
    languageTags: ["Chinese", "English"],
    tuitionBandLabel: "CNY 17,500-60,000/year by degree and category",
    campusHighlights: ["639 official 2026 degree routes", "84 bachelor, 275 master's and 280 doctoral routes", "59 English-taught routes", "Wangjiang, Huaxi, Jiang'an and Meishan campuses", "Two independently structured 2026 scholarship routes"],
    status: "draft",
    ...schoolEvidence,
    sourceFieldLineage: { nameEn: "Part 1, About SCU", nameZh: "official institution identity", citySlug: "Part 1 and official address", applicationLevel: "Part 2, Degree Programs", deadlineSummary: "Part 3, When to Apply", languageRequirement: "degree-specific application requirements", tuitionSummary: "three official tuition tables", cscaRequirement: "undergraduate application requirements, CSCA certificate section" },
  }],
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const persisted = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(persisted);
if (!validation.ok || validation.summary.schools !== 1 || validation.summary.programs !== 639 || validation.summary.programIntakes !== 639 || validation.summary.scholarships !== 2) throw new Error(`Invalid SCU candidate: ${validation.errors.join(" ")}`);

const state = JSON.parse(await readFile(paths.state, "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:scu-complete-review" });
let databaseBaseline: any;
try {
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,source_url from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "Sichuan University", "四川大学"]);
  const city = await pool.query("select id,slug,name_en,name_zh,status,verification_status,source_url from cities where slug='chengdu'", []);
  const programConflicts = await pool.query("select slug from programs where slug=any($1::text[])", [programs.map(row => row.slug)]);
  const scholarshipConflicts = await pool.query("select slug from scholarships where slug=any($1::text[])", [scholarships.map(row => row.slug)]);
  databaseBaseline = { school: school.rows, city: city.rows, programConflicts: programConflicts.rows, scholarshipConflicts: scholarshipConflicts.rows };
  if (school.rows.length || programConflicts.rows.length || scholarshipConflicts.rows.length) throw new Error(`SCU standing-authorized insert conflicts: ${JSON.stringify(databaseBaseline)}`);
  if (JSON.stringify(city.rows) !== JSON.stringify([{ id: "eaad5100-cb9e-401c-a9be-936666bd6d1f", slug: "chengdu", name_en: "Chengdu", name_zh: "成都", status: "active", verification_status: "unverified", source_url: "https://www.cscapilot.com/zh/study-china/cities/chengdu" }])) throw new Error(`Chengdu dependency baseline changed: ${JSON.stringify(city.rows)}`);
} finally { await pool.end(); }

const candidateSha256 = sha(candidateText);
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only", reference: "user-chat-top-300-default-publication" },
  scope: { schoolSlug, schoolCount: 1, programRouteCount: 639, bachelorRouteCount: 84, masterRouteCount: 275, doctoralRouteCount: 280, englishRouteCount: 59, programIntakeCount: 639, scholarshipCount: 2, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  extractedSha256: sha(extractedText),
  sourceManifestSha256: sha(manifestText),
  supplementManifestSha256: sha(supplementManifestText),
  evidence: requiredSourceIds.map(id => { const source: any = evidence.get(id); return { sourceId: id, sourceUrl: source.finalUrl, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType }; }),
  sourceReview: { result: "pass", note: "The 2026 admissions guide links the three current bilingual program tables. All 639 route pairs were parsed from the captured HTML with row-level locators; degree requirements, CSCA rules and tuition ranges were cross-checked against six separately captured official pages." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline, existingChengduCityReusedWithoutWrite: true },
  excludedEvidence: [{ sourceId: "scu-chinese-government-scholarship-guide", reason: "The page contains an obsolete passport-validity example referring to March 2023, so it is retained as raw evidence but excluded from the 2026 publication." }],
  coverageLimitations: ["SCU publishes tuition by broad academic category rather than a row-level program mapping. Each route therefore shows the verified degree-level range instead of an inferred exact category price.", "The Youth of Excellence guide states full scholarship but does not itemize component amounts; none are inferred.", "The official program tables list separate same-name clinical routes with different study durations. Those rows remain distinct and are disambiguated by stable evidence-derived slugs."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, admissions and scholarship fields are included. Staff contact details present in page chrome, applicant records, account data, payment data and uploaded documents are excluded." },
  reviewNotes: ["This is a pure insert into an absent school and new slugs; no city, school, program or scholarship is overwritten, archived or deleted.", "The existing Chengdu city row is referenced only by slug and is not included in the candidate bundle.", "The user's standing default-publication authorization supplies the human publication reference for safe new official records."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-scu-complete-batch-01-${reviewHash}` };
await writeFile(paths.candidate, candidateText, { encoding: "utf8", flag: "wx" });
await writeFile(paths.validation, `${JSON.stringify({ ...validation, candidateSha256, sourceManifestSha256: sha(manifestText), supplementManifestSha256: sha(supplementManifestText) }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, counts: reviewBase.scope, candidateSha256, paths }, null, 2));
