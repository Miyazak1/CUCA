import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidatePath = resolve(root, "seeds/catalog.pku-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.pku-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.pku-school-program-batch-01.review.json");
const evidenceSpecs = [
  ["work/catalog-official/2026-09-11T08-20-10-836Z/manifest.json", "pku-undergraduate-entrance-exam-2026", "949f564642f4208ebd59ea3cb708942b15c96a6ecca40496830ccada71ead0f8"],
  ["work/catalog-official/2026-09-11T08-20-11-183Z/manifest.json", "pku-undergraduate-without-written-exam-2026", "0680727f8efc9ac19bdd82ca8c777999d208b63ea20576af980da1b6d42590b4"],
  ["work/catalog-official/2026-09-11T08-20-11-511Z/manifest.json", "pku-undergraduate-admission-catalog-2026", "ba5d3c64b540bf423246b947e644d9aa3269ca32fdfeee34860a53bbb9f6fa60"],
  ["work/catalog-official/2026-09-11T08-21-09-883Z/manifest.json", "pku-undergraduate-admission-catalog-zh-2026", "ad5353802c1a8ee837f3000c10b71f8d17ae86e0a3e81092484cf85998b95720"],
] as const;
const evidence = new Map<string, any>();
for (const [path, id, sha] of evidenceSpecs) {
  const item = JSON.parse(await readFile(resolve(root, path), "utf8")).sources?.[0];
  if (item?.id !== id || item?.sha256 !== sha || item?.status !== 200) throw new Error(`Official evidence mismatch: ${id}`);
  evidence.set(id, item);
}
const EXAM = evidence.get("pku-undergraduate-entrance-exam-2026")!;
const CATALOG = evidence.get("pku-undergraduate-admission-catalog-2026")!;
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Route = { nameEn: string; nameZh: string; faculty: string; science: boolean; streams: string };
const routes: Route[] = [
  { nameEn: "School of Mathematical Sciences", nameZh: "数学科学学院", faculty: "Faculty of Sciences", science: true, streams: "Mathematics; Probability and Statistics; Scientific and Engineering Computing; Informatics; Financial Mathematics; Biostatistics; Data Science and Big Data Technology" },
  { nameEn: "School of Physics", nameZh: "物理学院", faculty: "Faculty of Sciences", science: true, streams: "Physics; Atmospheric Sciences; Nuclear Physics; Astronomy and its sub-directions" },
  { nameEn: "College of Chemistry and Molecular Engineering", nameZh: "化学与分子工程学院", faculty: "Faculty of Sciences", science: true, streams: "Chemistry; Applied Chemistry; Material Chemistry; Chemical Biology" },
  { nameEn: "College of Urban and Environmental Sciences", nameZh: "城市与环境学院", faculty: "Faculty of Sciences", science: true, streams: "Environmental Science; Environmental Health; Ecology; Geography Science; Physical Geography and Natural Resources Environment; Urban Planning and its sub-directions" },
  { nameEn: "School of Earth and Space Sciences", nameZh: "地球与空间科学学院", faculty: "Faculty of Sciences", science: true, streams: "Planet Science; Geology; Geochemistry; Geophysics; Remote Sensing and Geographic Information Systems; Space Science and Technology" },
  { nameEn: "School of Psychological and Cognitive Sciences", nameZh: "心理与认知科学学院", faculty: "Faculty of Sciences", science: true, streams: "Basic Psychology; Applied Psychology" },
  { nameEn: "School of Life Sciences", nameZh: "生命科学学院", faculty: "Faculty of Sciences", science: true, streams: "Biological Science; Biotechnology; Bio-information; Ecology" },
  { nameEn: "School of Electronics Engineering and Computer Science", nameZh: "信息科学技术学院", faculty: "Faculty of Informatics", science: true, streams: "Computer Science and Technology; Intelligence Science and Technology; Software Engineering; Electronic Information Science and Technology; Electronic Information Engineering; Microelectronics Sciences and Engineering; Integrated Circuit Design and Integrated System" },
  { nameEn: "College of Engineering", nameZh: "工学院", faculty: "Faculty of Engineering", science: true, streams: "Theoretical and Applied Mechanics; Environmental Science; Engineering Mechanics; Energy and Resources Engineering; Environmental Engineering; Aerospace Engineering; Biomedical Engineering; Materials Science and Engineering; Robot Engineering" },
  { nameEn: "School of Economics", nameZh: "经济学院", faculty: "Faculty of Economics and Management", science: false, streams: "Economics; International Economics and Trade; Finance; Insurance; Public Finance" },
  { nameEn: "Guanghua School of Management", nameZh: "光华管理学院", faculty: "Faculty of Economics and Management", science: false, streams: "Business Administration; Digital Economy Management; Finance; Accounting; Marketing and Data Science" },
  { nameEn: "Law School", nameZh: "法学院", faculty: "Faculty of Social Sciences", science: false, streams: "Law" },
  { nameEn: "School of Government", nameZh: "政府管理学院", faculty: "Faculty of Social Sciences", science: false, streams: "Political Science and Public Administration; Digital Governance; Administrative Management; Urban Management" },
  { nameEn: "School of Journalism and Communication", nameZh: "新闻与传播学院", faculty: "Faculty of Social Sciences", science: false, streams: "Journalism; Broadcasting and Television Studies; Advertising" },
  { nameEn: "School of International Studies", nameZh: "国际关系学院", faculty: "Faculty of Social Sciences", science: false, streams: "International Politics; Diplomacy; International Politics and Economics; International Organizations and International Public Policy" },
  { nameEn: "Department of Sociology", nameZh: "社会学系", faculty: "Faculty of Social Sciences", science: false, streams: "Sociology; Social Work; Anthropology" },
  { nameEn: "Department of Information Management", nameZh: "信息管理系", faculty: "Faculty of Social Sciences", science: false, streams: "Information Management and Information System; Library Science; Big Data Management and Application" },
  { nameEn: "Department of Chinese Language and Literature", nameZh: "中国语言文学系", faculty: "Faculty of Humanities", science: false, streams: "Chinese Literature; Chinese Language; Chinese Classics and Classical Bibliography; Applied Chinese Linguistics" },
  { nameEn: "Department of History", nameZh: "历史学系", faculty: "Faculty of Humanities", science: false, streams: "Chinese History; World History; Foreign Languages and Foreign History" },
  { nameEn: "School of Archaeology and Museology", nameZh: "考古文博学院", faculty: "Faculty of Humanities", science: false, streams: "Archaeology; Heritage and Museology; Foreign Languages and Foreign History (Archaeology); Heritage Conservation" },
  { nameEn: "Department of Philosophy and Religious Studies", nameZh: "哲学系（宗教学系）", faculty: "Faculty of Humanities", science: false, streams: "Philosophy; Logic and Philosophy of Science and Technology; Religion Studies" },
  { nameEn: "School of Arts", nameZh: "艺术学院", faculty: "Faculty of Humanities", science: false, streams: "Art History; Dramatic, Movie and Television Literature; Cultural Industry Management; Computational Art and Design" },
  { nameEn: "Yuanpei College", nameZh: "元培学院", faculty: "Interdisciplinary", science: false, streams: "Free selection within university teaching resources; Politics, Economics and Philosophy; Data Science and Big Data Technology; Integrated Science; Paleontology; Foreign Languages and Foreign History; General Artificial Intelligence Experimental Class" },
];
const programs: CatalogSeedProgram[] = routes.map((route, index) => {
  const subjects = route.science ? ["Chinese (STEM)", "Mathematics", "Physics or Chemistry"] : ["Chinese (Humanities)", "Mathematics"];
  return {
    slug: `peking-university-${slugify(route.nameEn)}`, schoolSlug: "peking-university", citySlug: "beijing", nameEn: route.nameEn, nameZh: route.nameZh,
    degreeLevel: "Undergraduate", fieldCategory: route.faculty, subjectArea: route.nameEn, teachingLanguage: "Chinese",
    cscaSubjects: subjects, cscaRequirement: `For Chinese Government Scholarship applicants: ${subjects.join(", ")}. CSCA is not stated as a universal requirement for all admission routes.`,
    tuitionText: "Tuition fee to be announced after approval", scholarshipText: "The official 2026 notices list Chinese Government, Beijing Government and Peking University scholarships; coverage and eligibility vary by route.",
    hasScholarship: true, applicationUrl: EXAM.url, applicationNote: `Applicants apply to the department, not directly to a major. Post-enrollment streams include: ${route.streams}. General undergraduate duration is 4-6 years.`, status: "draft",
    sourceUrl: CATALOG.url, sourceLabel: CATALOG.label, sourceSha256: CATALOG.sha256, capturedAt: CATALOG.fetchedAt,
    sourceFieldLineage: { nameEn: `Admission Catalogue department row ${index + 1}`, nameZh: `Chinese Admission Catalogue department row ${index + 1}`, fieldCategory: "Admission Catalogue Faculty column", teachingLanguage: "2026 admission notices Basic Information", cscaSubjects: "2026 admission notices Scholarship CSCA rule", tuitionText: "2026 admission notices Related Fees", scholarshipText: "2026 admission notices Scholarships section", applicationNote: "Admission Catalogue notes 1-2 and Majors/Sub-directions columns" },
  };
});
if (programs.length !== 23 || new Set(programs.map(item => item.slug)).size !== 23) throw new Error("Unexpected PKU route count.");
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: EXAM.fetchedAt,
  cities: [{ slug: "beijing", nameEn: "Beijing", nameZh: "北京", region: "North China", province: "Beijing", status: "draft", sourceUrl: EXAM.url, sourceLabel: EXAM.label, sourceSha256: EXAM.sha256, capturedAt: EXAM.fetchedAt, sourceFieldLineage: { nameEn: "official institution context", province: "official institution context" } }],
  schools: [{
    slug: "peking-university", nameEn: "Peking University", nameZh: "北京大学", citySlug: "beijing", schoolType: "public", region: "North China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese", languageRequirement: "Chinese is the medium of instruction; written-test exemption routes require the applicable published Chinese-proficiency and standardized-test evidence.",
    deadlineSummary: "Entrance-exam route: January 1-February 28, 2026. Written-test exemption: December 19-February 28 or June 12-July 10, 2026.",
    tuitionSummary: "The official 2026 notices state that tuition will be announced after approval.", applicationFee: "RMB 800, non-refundable", websiteUrl: "https://www.pku.edu.cn/", admissionsUrl: EXAM.url,
    cscaRequirement: "CSCA is explicitly required for Chinese Government Scholarship applicants, not stated as universal. Science, informatics and engineering use Chinese (STEM), Mathematics and at least Physics or Chemistry; other departments use Chinese (Humanities) and Mathematics.",
    cscaSubjects: ["Chinese (STEM)", "Chinese (Humanities)", "Mathematics", "Physics", "Chemistry"], subjectTags: [...new Set(routes.map(item => item.faculty))], languageTags: ["Chinese-taught"], tuitionBandLabel: "To be announced",
    campusHighlights: ["23 department-level application routes", "Majors selected after enrollment", "51 undergraduate major categories and 137 majors university-wide", "Health Science Center maintained separately"],
    status: "draft", sourceUrl: EXAM.url, sourceLabel: EXAM.label, sourceSha256: EXAM.sha256, capturedAt: EXAM.fetchedAt,
    sourceFieldLineage: { nameEn: "official notice title and institution context", nameZh: "official Chinese catalogue", languageOfInstruction: "Basic Information", languageRequirement: "two 2026 admission route notices", deadlineSummary: "Application Method sections", tuitionSummary: "Related Fees", applicationFee: "Related Fees", cscaRequirement: "Scholarships CSCA rule", campusHighlights: "Basic Information and Admission Catalogue note 1" },
  }],
  programs,
  programIntakes: programs.map(program => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2025-12-19T04:00:00.000Z", deadlineDate: "2026-07-10T15:59:59.000Z", deadlineLabel: "July 10, 2026 (final written-test exemption round)", applicationRound: "2026 entrance-exam or written-test-exemption admission", status: "closed" as const, sourceUrl: evidence.get("pku-undergraduate-without-written-exam-2026").url, sourceLabel: evidence.get("pku-undergraduate-without-written-exam-2026").label, sourceSha256: evidence.get("pku-undergraduate-without-written-exam-2026").sha256, capturedAt: evidence.get("pku-undergraduate-without-written-exam-2026").fetchedAt, sourceFieldLineage: { openDate: "Application Method round 1", deadlineDate: "Application Method round 2" } })),
  scholarships: [],
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`PKU candidate invalid: ${validation.errors.join(" ")}`);
const canonical = JSON.stringify(candidate);
if ([/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /beneficiaryBank/i, /applicationNumber/i].some(pattern => pattern.test(canonical))) throw new Error("Prohibited-data marker found.");
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: EXAM.fetchedAt,
  scope: { schoolSlug: "peking-university", schoolCount: 1, departmentRouteCount: 23, programCount: 23, intakeCount: 23, teachingLanguage: "Chinese" },
  officialEvidence: Object.fromEntries([...evidence.entries()].map(([id, item]) => [id, { sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType }])),
  reviewItems: [
    { field: "catalog granularity", result: "department_routes", reason: "PKU explicitly admits international undergraduates by department preference; majors and sub-directions are selected after enrollment." },
    { field: "tuition", result: "unresolved_not_inferred", reason: "Both 2026 admission notices state that tuition will be announced after approval, so no numeric tuition is published." },
    { field: "CSCA", result: "conditional", reason: "The official notices require CSCA for Chinese Government Scholarship applicants, not universally for every applicant." },
    { field: "Health Science Center", result: "excluded_separate_entity", reason: "The official notice directs medical applicants to the separately administered Health Science Center." },
    { field: "applicant data", result: "excluded", reason: "No passport, identity, contact, application or document content is imported." },
  ],
  reconciliation: { actionAfterApproval: "upsert_official_2026_department_catalog", legacyAliasesToArchive: [], destructiveDeletion: false, stableMatchingSlugs: [] },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public school, department-route, deadline, conditional CSCA and scholarship metadata is retained." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};
for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, departmentRoutes: routes.length }, null, 2));
