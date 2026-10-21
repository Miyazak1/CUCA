import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/ustb-undergraduate-2027-2026-10-20");
const expected: Record<string, string> = {
  "ustb-undergraduate-programs-2027": "523d70aa2c3a910ccf25d9036b38979af4ca2a2db52b520e420ff0cc5738a9a6",
  "ustb-undergraduate-application-2027": "50cf78c25ac767faefeb8eb2608fca3100062a9b99bd8deb5530c8143a72b5cc",
  "ustb-chinese-ai-joint-program-2027": "5ccb9c51c30a7c0ff376e21abf4e250fc53b3a3fdb8c3ac189b58aa3d3f8d517",
  "ustb-international-economics-1-plus-3-2027": "c25cf11719ff097832faadbe330645de880cdcfb06c15aa2c0b266a60921e53f",
  "ustb-csca-requirements-2027": "329db3a54b56cf97a8fc1c9afe87267971ba8b0c76ea80282fdc9fc91dd92a1b",
  "ustb-undergraduate-brochure-2027": "c2348c20acf11f3f016e02f92631b9d9aed427a0a5eaa7239902bbdc48b09eb5",
};
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = new Map<string, ManifestSource>();
for (const item of manifest.sources ?? []) {
  if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
  const bytes = await readFile(resolve(runRoot, item.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`USTB Wave 42 evidence hash mismatch: ${item.id}`);
  evidence.set(item.id, item);
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked USTB Wave 42 evidence: ${missing.join(", ")}`);

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-21.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "university-of-science-and-technology-beijing");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 42 USTB or Beijing dependency is missing.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const row = source(id);
  return { sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sourceSha256: row.sha256, capturedAt: row.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const slugify = (value: string) => value.toLowerCase().replaceAll("&", " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Major = { name: string; college: string; category: string; stem: boolean; languages?: Array<"Chinese" | "English"> };
const majors: Major[] = [
  { name: "Mining Engineering", college: "School of Resources and Safety Engineering", category: "Engineering", stem: true },
  { name: "Mineral Processing Engineering", college: "School of Resources and Safety Engineering", category: "Engineering", stem: true },
  { name: "Engineering Mechanics", college: "School of Resources and Safety Engineering", category: "Engineering", stem: true },
  { name: "Intelligent Mining Engineering", college: "School of Resources and Safety Engineering", category: "Engineering", stem: true },
  { name: "Intelligent Construction", college: "School of Future Urban Studies", category: "Engineering", stem: true },
  { name: "Civil Engineering", college: "School of Future Urban Studies", category: "Engineering", stem: true },
  { name: "Building Environment and Energy Application Engineering", college: "School of Future Urban Studies", category: "Engineering", stem: true },
  { name: "Metallurgical Engineering", college: "School of Metallurgical and Ecological Engineering", category: "Engineering", stem: true },
  { name: "Energy Storage Science and Engineering", college: "School of Metallurgical and Ecological Engineering", category: "Engineering", stem: true },
  { name: "Materials Science and Engineering", college: "School of Materials Science and Engineering", category: "Engineering", stem: true, languages: ["Chinese", "English"] },
  { name: "Mechanical Engineering", college: "School of Mechanical Engineering", category: "Engineering", stem: true },
  { name: "Robotics Engineering", college: "School of Mechanical Engineering", category: "Engineering", stem: true },
  { name: "Vehicle Engineering", college: "School of Mechanical Engineering", category: "Engineering", stem: true },
  { name: "Logistics Engineering", college: "School of Mechanical Engineering", category: "Engineering", stem: true },
  { name: "Industrial Design", college: "School of Mechanical Engineering", category: "Design and Engineering", stem: true },
  { name: "Visual Communication Design", college: "School of Mechanical Engineering", category: "Design", stem: false },
  { name: "Energy and Power Engineering", college: "School of Energy and Environmental Engineering", category: "Engineering", stem: true },
  { name: "New Energy Science and Engineering", college: "School of Energy and Environmental Engineering", category: "Engineering", stem: true },
  { name: "Environmental Engineering", college: "School of Energy and Environmental Engineering", category: "Engineering", stem: true, languages: ["Chinese", "English"] },
  { name: "Automation", college: "School of Automation and Electrical Engineering", category: "Engineering", stem: true },
  { name: "Measurement and Control Technology and Instruments", college: "School of Automation and Electrical Engineering", category: "Engineering", stem: true },
  { name: "Intelligent Sensing Engineering", college: "School of Automation and Electrical Engineering", category: "Engineering", stem: true },
  { name: "Artificial Intelligence", college: "School of Intelligent Science and Technology", category: "Computer Science", stem: true },
  { name: "Computer Science and Technology", college: "School of Computer and Communication Engineering", category: "Computer Science", stem: true },
  { name: "Information Security", college: "School of Computer and Communication Engineering", category: "Computer Science", stem: true },
  { name: "Internet of Things Engineering", college: "School of Computer and Communication Engineering", category: "Computer Science", stem: true },
  { name: "Communication Engineering", college: "School of Computer and Communication Engineering", category: "Engineering", stem: true },
  { name: "Mathematics and Applied Mathematics", college: "School of Mathematics and Physics", category: "Mathematics", stem: true },
  { name: "Information and Computing Science", college: "School of Mathematics and Physics", category: "Mathematics", stem: true },
  { name: "Applied Physics", college: "School of Mathematics and Physics", category: "Physics", stem: true },
  { name: "Statistics", college: "School of Mathematics and Physics", category: "Mathematics", stem: true },
  { name: "Applied Chemistry", college: "School of Chemical and Biological Engineering", category: "Chemistry", stem: true },
  { name: "Biotechnology", college: "School of Chemical and Biological Engineering", category: "Biological Science", stem: true },
  { name: "International Economics and Trade", college: "School of Economics and Management", category: "Economics", stem: false },
  { name: "Public Administration", college: "School of Humanities and Social Science", category: "Public Administration", stem: false },
  { name: "Social Work", college: "School of Humanities and Social Science", category: "Social Science", stem: false },
  { name: "Law", college: "School of Humanities and Social Science", category: "Law", stem: false },
  { name: "English", college: "School of Foreign Studies", category: "Languages", stem: false },
  { name: "Japanese", college: "School of Foreign Studies", category: "Languages", stem: false },
  { name: "German", college: "School of Foreign Studies", category: "Languages", stem: false },
];

const applicationUrl = "https://onlineapply.ustb.edu.cn/";
const standardProgram = (major: Major, language: "Chinese" | "English"): CatalogSeedProgram => {
  const english = language === "English";
  const cscaSubjects = english
    ? ["Mathematics (English)", "Physics or Chemistry"]
    : major.stem ? ["Science Chinese", "Mathematics (Chinese)", "Physics or Chemistry"] : ["Liberal Arts Chinese", "Mathematics (Chinese)"];
  return {
    slug: `university-of-science-and-technology-beijing-${slugify(major.name)}-${language.toLowerCase()}-undergraduate-2027`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: english ? `${major.name} (English-taught)` : major.name,
    degreeLevel: "Bachelor",
    durationYears: 4,
    fieldCategory: major.category,
    subjectArea: `${major.name}; ${major.college}`,
    teachingLanguage: language,
    cscaSubjects,
    cscaRequirement: english
      ? "Submit CSCA Mathematics in English and either Physics or Chemistry. The 2027 USTB CSCA page does not require Professional Chinese for the two English-taught routes."
      : major.stem
        ? "Submit CSCA Science Chinese, Mathematics in Chinese, and either Physics or Chemistry."
        : "Submit CSCA Liberal Arts Chinese and Mathematics in Chinese.",
    ...(english ? { englishRequirement: "IELTS 5.5, TOEFL 70, or another official English proficiency certificate when English is not the applicant's official language." } : { hskRequirement: "HSK Level 4 or above." }),
    tuitionAmount: 23300,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 23,300 per year; application fee CNY 600; insurance CNY 800/year or CNY 400/semester.",
    scholarshipText: "The 2027 guide lists Chinese Government Scholarship Type A and Type B, the USTB Chancellor Scholarship, and Beijing Government Scholarship; exact eligibility and award terms follow each scholarship notice.",
    applicationUrl,
    applicationNote: "Applicants should generally be age 35 or younger, hold a high-school diploma, meet the foreign-nationality and residence rules, and upload the diploma, transcript, passport, language proof, physical examination, financial guarantee, police-clearance certificate and required CSCA transcript. No paper application is mailed.",
    hasScholarship: true,
    badgeText: "2027 undergraduate admissions",
    displayGroup: "Undergraduate",
    displayGroupLabel: major.college,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: verifiedAt,
    ...fields("ustb-undergraduate-programs-2027"),
    sourceFieldLineage: {
      nameEn: "official 2027 undergraduate program list",
      degreeLevel: "official bachelor application guide",
      durationYears: "official bachelor application guide",
      fieldCategory: "official college and program list",
      subjectArea: "official college and program list",
      teachingLanguage: "official program-list bilingual markers; unmarked routes follow the Chinese-taught application requirements",
      cscaSubjects: "official 2027 CSCA requirements",
      cscaRequirement: "official 2027 CSCA requirements",
      ...(english ? { englishRequirement: "official bachelor application guide" } : { hskRequirement: "official bachelor application guide" }),
      tuitionAmount: "official bachelor fee table",
      applicationNote: "official eligibility and materials sections",
    },
  };
};
const programs: CatalogSeedProgram[] = majors.flatMap((major) => (major.languages ?? ["Chinese"]).map((language) => standardProgram(major, language)));

const jointProgram: CatalogSeedProgram = {
  slug: "university-of-science-and-technology-beijing-chinese-language-artificial-intelligence-joint-training-2027",
  schoolSlug: school.slug, citySlug: city.slug, nameEn: "Chinese Language + Artificial Intelligence Joint Training Program", degreeLevel: "Bachelor", durationYears: 4,
  fieldCategory: "Chinese Language and Artificial Intelligence", subjectArea: "Chinese language and artificial-intelligence foundations at Beijing Language and Culture University, followed by advanced artificial-intelligence study at USTB", teachingLanguage: "Chinese",
  cscaRequirement: "The program page requires the undergraduate academic-proficiency test and links to USTB's 2027 CSCA requirements; it does not publish a route-specific subject exception.",
  hskRequirement: "Submit an HSK score report; the program page does not publish a minimum admission level.",
  tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "USTB: CNY 23,300/year; Beijing Language and Culture University: CNY 25,800/year; application fee CNY 600; insurance CNY 800/year.",
  applicationUrl, applicationNote: "Four-year full-time joint program. Years 1-2 cover Chinese and AI foundations at BLCU; the following two years deepen AI study at USTB. Submit the published degree-application documents, including CSCA evidence.",
  badgeText: "USTB-BLCU joint program", displayGroup: "Undergraduate", displayGroupLabel: "Joint training", status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt,
  ...fields("ustb-chinese-ai-joint-program-2027"),
  sourceFieldLineage: { nameEn: "official page title", degreeLevel: "official bachelor description", durationYears: "official program introduction", subjectArea: "official study-path description", teachingLanguage: "official Chinese-language and HSK context", cscaRequirement: "official application-materials link to 2027 CSCA page", hskRequirement: "official application materials", tuitionText: "official fee table", applicationNote: "official introduction and materials sections" },
};
const onePlusThreeProgram: CatalogSeedProgram = {
  slug: "university-of-science-and-technology-beijing-international-economy-and-trade-1-plus-3-2027",
  schoolSlug: school.slug, citySlug: city.slug, nameEn: "International Economy and Trade (1+3)", degreeLevel: "Bachelor", durationYears: 4,
  fieldCategory: "Economics", subjectArea: "Chinese language and foundation courses in year one, followed by International Economy and Trade professional study in years two through four", teachingLanguage: "Chinese",
  cscaSubjects: ["Liberal Arts Chinese", "Mathematics (Chinese)"], cscaRequirement: "USTB's 2027 CSCA page assigns International Economy and Trade to Liberal Arts Chinese and requires Mathematics for all undergraduate programs.",
  hskRequirement: "Some Chinese proficiency is required, but HSK Level 4 is not mandatory at admission; HSK Level 5 is required by graduation.",
  tuitionAmount: 23300, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 23,300 per year; application fee CNY 600; insurance CNY 800/year or CNY 400/semester.",
  applicationUrl, applicationNote: "Four-year full-time 1+3 route. Applicants should generally be age 35 or younger, hold a high-school diploma and meet the published nationality, health, conduct and academic-proficiency requirements.",
  badgeText: "1+3 pathway", displayGroup: "Undergraduate", displayGroupLabel: "Economics and Management", status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt,
  ...fields("ustb-international-economics-1-plus-3-2027"),
  sourceFieldLineage: { nameEn: "official page title", degreeLevel: "official bachelor description", durationYears: "official program introduction", subjectArea: "official 1+3 study path", teachingLanguage: "official Chinese-language and HSK context", cscaSubjects: "official 2027 CSCA requirements", cscaRequirement: "official 2027 CSCA requirements", hskRequirement: "official program introduction", tuitionAmount: "official fee table", applicationNote: "official eligibility section" },
};
programs.push(jointProgram, onePlusThreeProgram);

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-11-01T00:00:00Z",
  deadlineDate: "2027-06-15T15:59:59.000Z",
  deadlineLabel: "Applications are open November 1, 2026 through June 15, 2027. The exact closing time is not published; the date is normalized to end of day in Beijing.",
  applicationRound: "USTB 2027 undergraduate admissions",
  status: "open",
  ...fields(program === jointProgram ? "ustb-chinese-ai-joint-program-2027" : program === onePlusThreeProgram ? "ustb-international-economics-1-plus-3-2027" : "ustb-undergraduate-application-2027"),
  sourceFieldLineage: { intakeTerm: "official early-September enrollment", intakeYear: "official 2027 page titles and application period", openDate: "official application period", deadlineDate: "official application period; Beijing end-of-day normalization", deadlineLabel: "official application period", status: "deadline compared with capturedAt" },
}));

const scholarship = (row: Omit<CatalogSeedScholarship,
  "schoolSlug" | "applicationRound" | "status" | "verificationStatus" | "lastVerifiedAt" | "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt" | "sourceFieldLineage">): CatalogSeedScholarship => ({
  schoolSlug: school.slug,
  applicationRound: "2027 undergraduate intake",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields("ustb-undergraduate-application-2027"),
  ...row,
  sourceFieldLineage: { title: "official 2027 scholarship section", coverage: "official 2027 scholarship section", deadlineLabel: "official general application period; exact notice controls", requirementText: "official application channel" },
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship({ slug: "university-of-science-and-technology-beijing-chinese-government-scholarship-type-a-undergraduate-2027", title: "USTB Chinese Government Scholarship Type A - 2027 Undergraduate Intake", type: "government", typeLabel: "Chinese Government Scholarship Type A", providerName: "China Scholarship Council / dispatching authority", providerNameEn: "China Scholarship Council / dispatching authority", fundingLevel: "Subject to current scholarship policy", coverage: "Generally tuition, accommodation, living expenses and insurance; the current scholarship policy and dispatching authority decision control.", applicableDegree: "Bachelor", applicableProgram: "Eligible USTB undergraduate programs", deadlineLabel: "Generally November through March; follow the applicant's embassy, consulate or dispatching authority notice.", requirementText: "Apply through the Chinese embassy, consulate or other dispatching authority and select USTB as the first-choice institution." }),
  scholarship({ slug: "university-of-science-and-technology-beijing-chinese-government-scholarship-type-b-undergraduate-2027", title: "USTB Chinese Government Scholarship Type B - 2027 Undergraduate Intake", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "China Scholarship Council / University of Science and Technology Beijing", providerNameEn: "China Scholarship Council / University of Science and Technology Beijing", fundingLevel: "Subject to current scholarship policy", coverage: "Generally tuition, accommodation, living expenses and insurance; the specific USTB scholarship notice controls.", applicableDegree: "Bachelor", applicableProgram: "Eligible USTB undergraduate programs", deadlineLabel: "Generally November through April; follow the specific USTB scholarship notice.", requirementText: "Apply directly to USTB and meet the selected program and scholarship requirements." }),
  scholarship({ slug: "university-of-science-and-technology-beijing-chancellor-scholarship-undergraduate-2027", title: "USTB Chancellor Scholarship - 2027 Undergraduate Intake", type: "university", typeLabel: "USTB Chancellor Scholarship", providerName: "University of Science and Technology Beijing", providerNameEn: "University of Science and Technology Beijing", fundingLevel: "Full or Partial", coverage: "Full awards cover tuition, accommodation, living expenses and insurance; partial awards follow the scholarship decision.", applicableDegree: "Bachelor", applicableProgram: "Eligible USTB undergraduate programs", deadlineDate: "2027-04-30", deadlineLabel: "Generally November 1, 2026 through April 30, 2027; the specific scholarship notice controls.", requirementText: "Apply through the USTB international application system together with the undergraduate application." }),
  scholarship({ slug: "university-of-science-and-technology-beijing-beijing-government-scholarship-undergraduate-2027", title: "Beijing Government Scholarship at USTB - 2027 Undergraduate Intake", type: "government", typeLabel: "Beijing Government Scholarship", providerName: "Beijing Municipal Government / University of Science and Technology Beijing", providerNameEn: "Beijing Municipal Government / University of Science and Technology Beijing", fundingLevel: "Subject to scholarship notice", coverage: "The 2027 application guide identifies the award but does not publish the exact undergraduate package.", applicableDegree: "Bachelor", applicableProgram: "Eligible USTB undergraduate programs", deadlineLabel: "Generally November 1 through May; follow the specific USTB scholarship notice.", requirementText: "Apply directly to the USTB International Student Center under the current scholarship notice." }),
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 42 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The official 2027 undergraduate brochure ends with a stale sentence referring to the 2026 intake. Program names and structured 2027 dates are therefore anchored to the separate 2027 program list and 2027 bachelor application guide, while the brochure is retained only as corroborating evidence.",
    "Only Materials Science and Engineering and Environmental Engineering are explicitly marked as available in both Chinese and English; all other standard routes are emitted only in Chinese.",
    "The Chinese Language + Artificial Intelligence joint-program page requires an HSK score report but does not publish a minimum admission level, so no HSK threshold is inferred.",
    "The general scholarship periods remain deadlineLabel text unless an exact date is published. Award terms remain subject to the specific scholarship notice.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-42");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 42, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
