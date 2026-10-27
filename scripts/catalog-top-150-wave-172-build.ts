import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type ProgramSpec = { name: string; degree: "Bachelor" | "Master" | "Doctoral" | "Non-degree"; faculty: string; language: "Chinese" | "English" | "Chinese / English"; years?: number; months?: number; note?: string };

const root = process.cwd();
const evidenceRuns = [
  { run: "2026-10-26T11-02-28-932Z", locks: new Map([
    ["hbu-international-college-home-current", "9d35e611553be629d4e0cb67fd03ce403e8d32d6e2c42d7a7bb426f12ab00653"],
    ["hbu-international-admission-index-current", "e135a4c2dc1fff57e313cf1be63244a1e100234ec52041297362a88bf2030cef"],
    ["hbu-international-admission-guide-page-2026", "e12e28b7e03b566ea67be75f21385550977e5bcb7d2e4d095510fd8bcebf5780"],
  ]) },
  { run: "2026-10-26T11-03-10-176Z", locks: new Map([
    ["hbu-international-admission-guide-pdf-2026", "ccbfcdd458376148d57cd0af902c703d518275e02ee3d06d680eb9a11bae935f"],
  ]) },
];
const sources = new Map<string, Source>();
for (const evidenceRun of evidenceRuns) {
  const directory = resolve(root, "work/catalog-official", evidenceRun.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const [id, expectedSha256] of evidenceRun.locks) {
    const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
    if (!source) throw new Error(`Missing locked HBU source: ${id}`);
    const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
    if (actualSha256 !== expectedSha256) throw new Error(`HBU evidence hash mismatch: ${id}`);
    sources.set(id, source);
  }
}

const home = sources.get("hbu-international-college-home-current")!;
const index = sources.get("hbu-international-admission-index-current")!;
const guide = sources.get("hbu-international-admission-guide-pdf-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const city = {
  slug: "baoding", nameEn: "Baoding", nameZh: "保定", province: "Hebei", region: "North China",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: guide.fetchedAt, ...sf(guide),
  sourceFieldLineage: { nameEn: "official university location", nameZh: "official university location", province: "official university location", region: "CUAC geographic taxonomy" },
};
const school = {
  slug: "hebei-university", nameEn: "Hebei University", nameZh: "河北大学", citySlug: city.slug,
  schoolType: "Public comprehensive university", region: "Baoding, Hebei, North China",
  applicationLevel: "The official closed 2026 international guide publishes short-term Chinese, bachelor, master and doctoral study. The current admission index does not publish a general 2027 international guide.",
  languageOfInstruction: "Chinese for most routes; selected life-science, pharmacy and graduate routes permit Chinese or English, while MBA, Mathematics and Optical Engineering are published as English-taught.",
  languageRequirement: "Closed 2026 degree cycle: Chinese-taught routes require HSK 4 score 180. English-taught routes require native/official English, IELTS 5.5, TOEFL 80 or Duolingo 100. Master and doctoral applicants also complete a faculty interview.",
  hskRequirement: "HSK Level 4 score 180 for closed 2026 Chinese-taught degree routes; some named routes publish higher or route-specific requirements.",
  englishRequirement: "Native/official English, IELTS 5.5, TOEFL 80 or Duolingo 100 for closed 2026 English-taught routes; MBA specifically publishes IELTS 6.0 or TOEFL 85.",
  deadlineSummary: "The closed 2026 application window ran from January 1 through May 31, 2026. No general 2027 international deadline is published on the current index.",
  tuitionSummary: "Closed 2026 annual tuition: liberal-arts bachelor/master/doctoral CNY 16,000/20,000/23,000; science CNY 18,000/23,000/27,000; arts and medicine CNY 16,000/30,000/34,500. Chinese training costs CNY 4,800/month, CNY 10,000/three months or CNY 16,000/year.",
  applicationFee: "CNY 600 for degree applicants; Chinese-language training is exempt from the registration fee.",
  websiteUrl: home.finalUrl ?? home.url, admissionsUrl: index.finalUrl ?? index.url,
  cscaRequired: true, cscaRequirement: "All closed-cycle 2026 international bachelor applicants must submit a valid CSCA score report; the official table publishes route-specific Chinese, Mathematics, Physics or Chemistry subjects.",
  subjectTags: ["Chinese Language", "Economics", "Law", "Life Sciences", "Chemistry", "Medicine", "Engineering", "Humanities"],
  languageTags: ["Chinese", "English"], tuitionBandLabel: "Closed 2026: CNY 16,000-34,500/year by discipline and level",
  campusHighlights: ["Public comprehensive university in Baoding", "Official guide covers short-term Chinese through doctoral study", "Closed 2026 guide publishes route tables, fees, CSCA subjects and four scholarship categories"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: guide.fetchedAt, ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official university and guide identity", nameZh: "official guide title", citySlug: "official university location", schoolType: "official profile plus CUAC taxonomy", region: "official location plus CUAC taxonomy",
    applicationLevel: "official 2026 guide and current admission-index freshness review", languageOfInstruction: "official 2026 program tables", languageRequirement: "official 2026 eligibility and route notes", hskRequirement: "official 2026 eligibility and route notes", englishRequirement: "official 2026 eligibility and MBA note", deadlineSummary: "official 2026 application-period page plus current-index freshness review", tuitionSummary: "official 2026 fee table", applicationFee: "official 2026 fee table", websiteUrl: "official international college home", admissionsUrl: "official current admission index", cscaRequired: "official 2026 bachelor requirements", cscaRequirement: "official 2026 materials and program table", subjectTags: "official program tables", languageTags: "official program tables", tuitionBandLabel: "official fee table", campusHighlights: "official guide and profile",
  },
};

const specs: ProgramSpec[] = [];
const add = (degree: ProgramSpec["degree"], faculty: string, language: ProgramSpec["language"], years: number | undefined, names: string[], note?: string) => names.forEach((name) => specs.push({ name, degree, faculty, language, years, note }));
add("Bachelor", "College of International Exchange and Education", "Chinese", 4, ["International Chinese Language Education"]);
add("Bachelor", "School of Economics", "Chinese", 4, ["Finance", "International Economics and Trade"]);
add("Bachelor", "School of Law", "Chinese", 4, ["Law"], "Law requires HSK 4 score 210 or above.");
add("Bachelor", "College of Arts", "Chinese", 4, ["Calligraphy", "Painting"]);
add("Bachelor", "College of Life Sciences", "Chinese / English", 4, ["Biological Sciences", "Bioinformatics", "Biotechnology"]);
add("Bachelor", "College of Chemistry and Materials Science", "Chinese", 4, ["Chemistry"]);
add("Bachelor", "College of Mathematics and Information Science", "Chinese", 4, ["Mathematics and Applied Mathematics", "Data Science and Big Data Technology"]);
add("Bachelor", "College of Quality and Technical Supervision", "Chinese", 4, ["Measurement and Control Technology and Instruments", "Mechanical Design, Manufacturing and Automation"]);
add("Bachelor", "School of Pharmacy", "Chinese / English", 4, ["Pharmacy"]);
add("Bachelor", "College of Traditional Chinese Medicine", "Chinese", 5, ["Traditional Chinese Medicine"], "The fifth year is an internship in a hospital.");
add("Bachelor", "School of Basic Medicine / School of Clinical Medicine", "Chinese", 6, ["Clinical Medicine"], "Students enter professional study after passing HSK Level 4.");

add("Master", "College of International Exchange and Education", "Chinese", 2, ["International Chinese Language Education"], "Requires HSK 5 and HSKK Intermediate score 60 or above.");
add("Master", "College of Chinese Language and Literature", "Chinese", 3, ["Ancient Chinese Literature"]);
add("Master", "School of Management", "English", 3, ["Business Administration (MBA)"], "Native/official English, IELTS 6.0 or TOEFL 85.");
add("Master", "School of Economics", "Chinese", 3, ["Finance", "International Trade", "International Business"]);
add("Master", "School of Law", "Chinese", 3, ["International Law"], "Requires HSK 5 and a bachelor degree in law.");
add("Master", "College of Philosophy and Sociology", "Chinese", 3, ["Marxist Philosophy", "Chinese Philosophy", "Logic", "Foreign Philosophy", "Ethics", "Aesthetics", "Sociology", "Social Work"], "Route-specific prerequisite shown in the official table; Philosophy routes publish HSK 4 score 210 and the faculty expects strong Chinese and English.");
add("Master", "College of Arts", "Chinese", 3, ["Design"]);
add("Master", "College of History", "Chinese", 3, ["Chinese History"]);
add("Master", "Center for Song History Studies", "Chinese", 3, ["Chinese History"]);
add("Master", "College of Life Sciences", "Chinese / English", 3, ["Zoology", "Microbiology", "Botany", "Biochemistry and Molecular Biology", "Ecology"]);
add("Master", "College of Chemistry and Materials Science", "Chinese", 3, ["Organic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Inorganic Chemistry", "Chemical Engineering and Technology", "Polymer Chemistry and Physics", "Chemical Biology", "Materials and Chemical Engineering", "Biology and Medicine"]);
add("Master", "College of Physics Science and Technology", "Chinese", 3, ["Theoretical Physics", "Plasma Physics", "Condensed Matter Physics", "Optics", "Optical Engineering"]);
add("Master", "College of Mathematics and Information Science", "English", 3, ["Mathematics", "Software Engineering"]);
add("Master", "College of Electronic Information Engineering", "Chinese", 3, ["Electronic Science and Technology", "Information and Communication Engineering", "Control Science and Engineering", "Communication Engineering", "Integrated Circuit Engineering", "Control Engineering"]);
add("Master", "College of Quality and Technical Supervision", "Chinese", 3, ["Instrument Science and Technology"]);
add("Master", "School of Pharmacy", "English", 3, ["Pharmacy"]);

add("Doctoral", "College of Chinese Language and Literature", "Chinese", 4, ["Ancient Chinese Literature"]);
add("Doctoral", "School of Management", "Chinese / English", 4, ["Management Science and Engineering", "Quantitative Economics", "Information Resource Management"]);
add("Doctoral", "School of Economics", "Chinese", 4, ["Applied Economics"]);
add("Doctoral", "School of Education", "Chinese / English", 4, ["Developmental and Educational Psychology", "Education"]);
add("Doctoral", "School of Law", "Chinese", 4, ["Law"]);
add("Doctoral", "College of Philosophy and Sociology", "Chinese", 4, ["Philosophy"], "Requires HSK 5 score 210 or above and a philosophy-related master degree.");
add("Doctoral", "College of History", "Chinese", 4, ["Chinese History"]);
add("Doctoral", "Center for Song History Studies", "Chinese", 4, ["Chinese History"]);
add("Doctoral", "College of Life Sciences", "Chinese / English", 4, ["Biology", "Ecology"]);
add("Doctoral", "College of Chemistry and Materials Science", "Chinese", 4, ["Chemistry"]);
add("Doctoral", "College of Physics Science and Technology", "Chinese", 4, ["Physics"]);
add("Doctoral", "College of Physics Science and Technology", "English", 4, ["Optical Engineering"]);
add("Doctoral", "College of Mathematics and Information Science", "English", 4, ["Mathematics"]);
add("Doctoral", "College of Electronic Information Engineering", "Chinese", 4, ["Medical Electronic Information", "Integrated Circuit Science and Technology"]);
add("Doctoral", "College of Quality and Technical Supervision", "Chinese", 4, ["Instrument Science and Technology"]);
add("Doctoral", "School of Pharmacy", "Chinese / English", 4, ["Medicinal Chemistry and Molecular Diagnosis"]);
add("Doctoral", "School of Clinical Medicine", "Chinese", 4, ["Clinical Medicine"]);
specs.push(
  { name: "Chinese Language Training — One Month", degree: "Non-degree", faculty: "College of International Exchange and Education", language: "Chinese", months: 1 },
  { name: "Chinese Language Training — Three Months", degree: "Non-degree", faculty: "College of International Exchange and Education", language: "Chinese", months: 3 },
);

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const tuitionText = (item: ProgramSpec) => item.degree === "Non-degree"
  ? (item.months === 1 ? "Closed 2026 Chinese training tuition: CNY 4,800 for one month; registration fee exempt." : "Closed 2026 Chinese training tuition: CNY 10,000 for three months; registration fee exempt.")
  : item.degree === "Bachelor" ? "Closed 2026 bachelor tuition: liberal arts CNY 16,000/year; science CNY 18,000/year; arts and medicine CNY 16,000/year; registration fee CNY 600. The source does not label every listed route with a fee category, so no single amount is inferred."
  : item.degree === "Master" ? "Closed 2026 master tuition: liberal arts CNY 20,000/year; science CNY 23,000/year; arts and medicine CNY 30,000/year; registration fee CNY 600. The source does not label every listed route with a fee category, so no single amount is inferred."
  : "Closed 2026 doctoral tuition: liberal arts CNY 23,000/year; science CNY 27,000/year; arts and medicine CNY 34,500/year; registration fee CNY 600. The source does not label every listed route with a fee category, so no single amount is inferred.";
const programs = specs.map((item, i) => ({
  slug: `hebei-university-${slug(item.name)}-${item.degree.toLowerCase()}-${String(i + 1).padStart(3, "0")}-2026`, schoolSlug: school.slug, citySlug: city.slug,
  nameEn: item.name, degreeLevel: item.degree, ...(item.years ? { durationYears: item.years } : { durationMonths: item.months }), fieldCategory: item.faculty, subjectArea: item.name, teachingLanguage: item.language,
  ...(item.language === "Chinese" || item.language === "Chinese / English" ? { hskRequirement: item.note?.includes("HSK") ? item.note : "Closed 2026 Chinese-taught degree routes generally require HSK 4 score 180; see the official route note for any higher threshold." } : {}),
  ...(item.language === "English" || item.language === "Chinese / English" ? { englishRequirement: item.note?.includes("IELTS") ? item.note : "Native/official English, IELTS 5.5, TOEFL 80 or Duolingo 100 for closed 2026 English-taught routes." } : {}),
  ...(item.degree === "Bachelor" ? { cscaRequirement: "A valid CSCA score report is required. Exact tested subjects are published by route in the official 2026 table; this candidate does not infer a subject combination where the table grouping is ambiguous." } : {}),
  tuitionText: tuitionText(item), applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: `Named in the official 2026 international guide.${item.note ? ` ${item.note}` : ""} The January 1-May 31, 2026 application window is closed and the route is not relabeled as 2027.`,
  hasScholarship: true, scholarshipText: "The guide lists Chinese Government, International Chinese Language Teachers, Hebei Provincial Government and Hebei University President scholarship categories; route-level award eligibility is not inferred.", badgeText: "Closed 2026 official route", displaySubjects: [item.name, item.faculty],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: guide.fetchedAt, ...sf(guide),
  sourceFieldLineage: { nameEn: "official program table translated to English", degreeLevel: "official program section", ...(item.years ? { durationYears: "official program table" } : { durationMonths: "official Chinese-training duration" }), fieldCategory: "official college column translated to English", subjectArea: "official program name translated to English", teachingLanguage: "official program table", tuitionText: "official fee table without unsupported route-to-discipline inference", applicationUrl: "official 2026 guide PDF", applicationNote: "official 2026 program table and application period", hasScholarship: "official scholarship section", scholarshipText: "official scholarship categories with scope limitation", badgeText: "official closed-cycle status" },
}));
const intakes = programs.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-05-31T15:59:59.000Z", deadlineLabel: "Applications closed May 31, 2026 at the end of the Beijing calendar day.", applicationRound: "Closed 2026 international admission", status: "closed" as const, ...sf(guide),
  sourceFieldLineage: { intakeTerm: "official 2026 guide and academic-cycle context", intakeYear: "official guide year", deadlineDate: "official May 31 deadline converted to end of Beijing day", deadlineLabel: "official application period and closed status", applicationRound: "official international guide" },
}));
const scholarshipBase = { schoolSlug: school.slug, providerName: "河北大学", providerNameEn: "Hebei University", providerLocation: "Baoding, Hebei, China", applicationMaterials: [], applicationSteps: [], deadlineLabel: "No 2027 scholarship deadline is published in the captured current official sources.", status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: guide.fetchedAt, ...sf(guide) };
const scholarships = [
  { slug: "hebei-university-chinese-government-scholarship-current", title: "Chinese Government Scholarship at Hebei University", nameZh: "中国政府奖学金", type: "government", typeLabel: "Chinese Government Scholarship", fundingLevel: "Scholarship category; current award terms unresolved", coverage: "The 2026 guide confirms eligibility to host Chinese Government Scholarship students but does not reproduce the current award schedule.", applicableDegree: "Bachelor, Master and Doctoral", applicableProgram: "Eligible Hebei University international degree routes; exact current route-level eligibility is not published in the guide.", amountText: "Not published in the captured guide.", requirementText: "Apply through the official CSC system using Hebei University agency number 10075; exact current cycle rules must be verified with the scholarship authority.", benefitItems: [], eligibilityItems: [], actionLinks: [{ label: "Official HBU admission guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }], applicationRound: "Current category; 2027 cycle unresolved", summary: "Officially named scholarship category; no 2027 amount or deadline inferred." },
  { slug: "hebei-university-international-chinese-language-teachers-scholarship-current", title: "International Chinese Language Teachers Scholarship at Hebei University", nameZh: "教育部中外语言交流合作中心国际中文教师奖学金", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", fundingLevel: "Scholarship category; current award terms unresolved", coverage: "The official guide confirms Hebei University's host qualification but does not reproduce the current award schedule.", applicableDegree: "Chinese-language and related study", applicableProgram: "Eligible routes under the scholarship authority's current rules.", amountText: "Not published in the captured guide.", requirementText: "Apply through the official scholarship authority; exact cycle rules and deadlines are not published in the captured guide.", benefitItems: [], eligibilityItems: [], actionLinks: [{ label: "Official HBU admission guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }], applicationRound: "Current category; 2027 cycle unresolved", summary: "Officially named language-teacher scholarship category; no 2027 amount or deadline inferred." },
  { slug: "hebei-university-hebei-provincial-government-scholarship-2026", title: "Hebei Provincial Government Scholarship for International Students — 2026", nameZh: "河北省省属公办高校外国留学生奖学金", type: "government", typeLabel: "Hebei Provincial Government Scholarship", fundingLevel: "Fixed award", coverage: "Award quota and selection are subject to the Hebei education authority's annual allocation.", applicableDegree: "Bachelor, Master and Doctoral", applicableProgram: "Liberal arts, science, arts and medicine degree routes.", amountText: "Bachelor CNY 8,000; master CNY 20,000; doctoral CNY 30,000.", requirementText: "For eligible international students under the annual provincial allocation; the guide does not publish a separate deadline.", benefitItems: [{ label: "Award", included: true, note: "CNY 8,000 bachelor; CNY 20,000 master; CNY 30,000 doctoral" }], eligibilityItems: [], actionLinks: [{ label: "Official HBU admission guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }], applicationRound: "2026 guide; 2027 cycle unresolved", summary: "Published fixed award by degree level in the closed 2026 guide." },
  { slug: "hebei-university-president-scholarship-2026", title: "Hebei University President Scholarship for International Students — 2026", nameZh: "河北大学来华留学生校长奖学金", type: "university", typeLabel: "University President Scholarship", fundingLevel: "Discipline- and level-based award", coverage: "Awarded to eligible self-funded international students after annual review following enrollment.", applicableDegree: "Bachelor, Master and Doctoral", applicableProgram: "Liberal arts, science, arts and medicine degree routes.", amountText: "Liberal arts: CNY 16,000/32,000/38,000; science: CNY 18,000/35,000/42,000; arts and medicine: CNY 16,000/42,000/49,500 for bachelor/master/doctoral respectively.", requirementText: "For enrolled self-funded international students, assessed after enrollment; the guide does not publish a separate pre-admission deadline.", benefitItems: [{ label: "Award", included: true, note: "Amount varies by discipline and degree level as published in the 2026 guide" }], eligibilityItems: [], actionLinks: [{ label: "Official HBU admission guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }], applicationRound: "Post-enrollment annual review; 2027 cycle unresolved", summary: "Published discipline- and degree-based university award in the closed 2026 guide." },
].map((entry) => ({ ...scholarshipBase, ...entry, sourceFieldLineage: { title: "official scholarship section translated to English", coverage: "official scholarship section with explicit limitation", applicableDegree: "official award table", applicableProgram: "official award table", amountText: "official award table or explicitly unresolved", requirementText: "official scholarship narrative", benefitItems: "official award table", eligibilityItems: "intentionally empty where the guide gives no separate list", applicationMaterials: "intentionally excluded", applicationSteps: "intentionally excluded", deadlineLabel: "explicitly unresolved after current-index review", applicationRound: "official guide cycle and review timing", summary: "official scholarship section" } }));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: guide.fetchedAt, cities: [city], schools: [school], programs, programIntakes: intakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: guide.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 130, schoolSlugs: [school.slug], newSchools: 1, newCities: 1, programs: programs.length, programIntakes: intakes.length, scholarships: scholarships.length }, evidence,
  visualReview: { renderedPages: 10, result: "pass", note: "All ten rendered PDF pages were inspected. Program tables span guide pages 4-7; materials, process, dates, fees and scholarships span guide pages 8-15." },
  unresolved: [
    "The current official admission index publishes the complete 2026 guide but no general 2027 international admission guide. Every intake is retained as closed 2026 and no historic field is relabeled as 2027.",
    "The bachelor CSCA table visually groups subject combinations across rows. CSCA is retained at route level, while exact subject arrays are omitted where row-group boundaries could be ambiguous.",
    "The fee table publishes discipline-level bands but does not map every listed program to a fee category. Fee bands are preserved in text and no unsupported route-level numeric amount is selected.",
    "Scholarship categories and the two fixed award schedules are retained. Separate 2027 deadlines and category-specific application rules remain empty because the guide does not publish them.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant files, personal contacts, bank-account/payment instructions and individual data are excluded. Only public institutional facts are retained." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-172");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 172, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
