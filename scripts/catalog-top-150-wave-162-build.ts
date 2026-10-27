import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Spec = { group: string; groupLabel: string; code: string; name: string; language: "Chinese" | "Chinese and English" | "Chinese with a selected English-taught direction" };
const root = process.cwd();
const sourceRuns = ["2026-10-26T09-32-30-964Z", "2026-10-26T09-35-11-060Z"];
const locks = new Map([
  ["nefu-international-home-current", "def48ba79fc036a470ee5f37d486405f56d6d61ab4073b900782e967dc91074b"],
  ["nefu-international-bachelor-2026", "5c4af42b50d6a44f47243e004e7fbad9255d4b25eb59b79ed63cffed64f399da"],
  ["nefu-international-master-2027", "6b51e403c44c75935c3cab99eb926e00bcc04408f4e09a0d464d56979a12bf96"],
  ["nefu-international-doctoral-2027", "08bb3e50e50e4cbf7aa02212e25d9e116cc5c36c4abbf07df119268f5075fdc1"],
  ["nefu-chinese-government-scholarship-current", "3f87da4b26568d6e4110dd6848d17db691233c00f48767b4b6d0570618e0b63f"],
  ["nefu-eurasian-scholarship-current", "21c04e779ffbd92f806eb59d51b6e8732ca7f5b37fbcdc81a734e66d5500a3d2"],
]);
const sources = new Map<string, Source>();
for (const run of sourceRuns) {
  const directory = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const source of manifest.sources) {
    const expected = locks.get(source.id);
    if (!expected || source.status !== 200 || source.sha256 !== expected) continue;
    const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
    if (actual !== expected) throw new Error(`NEFU evidence hash mismatch: ${source.id}`);
    sources.set(source.id, source);
  }
}
for (const id of locks.keys()) if (!sources.has(id)) throw new Error(`Missing locked NEFU source: ${id}`);
const master = sources.get("nefu-international-master-2027")!;
const doctoral = sources.get("nefu-international-doctoral-2027")!;
const cgs = sources.get("nefu-chinese-government-scholarship-current")!;
const eurasian = sources.get("nefu-eurasian-scholarship-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "harbin");
if (!city) throw new Error("Reviewed Harbin dependency missing");

const school = {
  slug: "northeast-forestry-university-china",
  nameEn: "Northeast Forestry University",
  nameZh: "东北林业大学",
  citySlug: "harbin",
  schoolType: "Public forestry university with ecology, engineering and natural-resource strengths",
  region: "Harbin, Heilongjiang, Northeast China",
  applicationLevel: "The official international portal publishes bachelor, master, doctoral, Chinese-language, exchange and cultural-study routes. This candidate structures the complete text-listed 2027 master and doctoral discipline tables; the bachelor catalog remains explicitly Fall 2026.",
  languageOfInstruction: "Chinese and selected Chinese/English graduate disciplines. The official 2026 bachelor table is mainly Chinese with International Economics and Trade listed as Chinese/English.",
  languageRequirement: "For 2027 graduate study, Chinese-taught science, engineering, agriculture, medicine, economics, management and art disciplines require HSK Level 4 score 180; literature and law require HSK Level 5 score 180. English-taught routes require IELTS 6.5, TOEFL above 95 or other accepted proof.",
  hskRequirement: "HSK Level 4 score 180 for most Chinese-taught graduate disciplines; HSK Level 5 score 180 for literature and law.",
  englishRequirement: "IELTS 6.5, TOEFL above 95 or other accepted English-proficiency proof for English-taught graduate routes.",
  deadlineSummary: "Applications for the official Fall 2027 master and doctoral routes close June 30, 2027.",
  tuitionSummary: "2027 annual tuition: master CNY 25,000 Chinese-taught or CNY 30,000 English-taught; doctoral CNY 32,000 Chinese-taught or CNY 38,000 English-taught. Accommodation is CNY 500/month twin or CNY 1,000/month single; insurance CNY 800/year.",
  applicationFee: "CNY 400",
  websiteUrl: "https://www.nefu.edu.cn/",
  admissionsUrl: master.finalUrl ?? master.url,
  subjectTags: ["Forestry", "Ecology", "Environmental Science", "Wildlife", "Forestry Engineering", "Agricultural Economics"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 25,000-38,000/year for 2027 graduate study",
  campusHighlights: ["Complete official 2027 master and doctoral discipline tables", "Forestry and ecology strengths", "Chinese- and English-taught graduate options"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: doctoral.fetchedAt,
  ...sourceFields(master),
  sourceFieldLineage: {
    nameEn: "official English international portal",
    nameZh: "official Chinese portal",
    citySlug: "official address plus reviewed Harbin dependency",
    schoolType: "official program profile plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official current program navigation and cycle-labelled bachelor/master/doctoral pages",
    languageOfInstruction: "official 2026 bachelor and 2027 graduate tables",
    languageRequirement: "official 2027 master and doctoral requirements",
    hskRequirement: "official 2027 master and doctoral requirements",
    englishRequirement: "official 2027 master and doctoral requirements",
    deadlineSummary: "official 2027 master and doctoral pages",
    tuitionSummary: "official 2027 graduate fee sections",
    applicationFee: "official 2027 graduate fee sections",
    websiteUrl: "official university domain",
    admissionsUrl: "official 2027 master page",
    subjectTags: "official 2027 discipline tables",
    languageTags: "official 2027 discipline tables",
    tuitionBandLabel: "official 2027 graduate fee sections",
    campusHighlights: "official 2027 graduate pages",
  },
};

const masterSpecs: Spec[] = [
  { group: "forestry", groupLabel: "School of Forestry", code: "083000", name: "Environmental Science and Engineering", language: "Chinese and English" },
  { group: "forestry", groupLabel: "School of Forestry", code: "090700", name: "Forestry", language: "Chinese and English" },
  { group: "landscape", groupLabel: "College of Landscape Architecture", code: "083300", name: "Urban and Rural Planning", language: "Chinese" },
  { group: "landscape", groupLabel: "College of Landscape Architecture", code: "090700", name: "Forestry", language: "Chinese" },
  { group: "landscape", groupLabel: "College of Landscape Architecture", code: "090900", name: "Pratacultural Science", language: "Chinese" },
  { group: "wildlife", groupLabel: "College of Wildlife and Protected Area", code: "090500", name: "Animal Husbandry", language: "Chinese and English" },
  { group: "wildlife", groupLabel: "College of Wildlife and Protected Area", code: "090700", name: "Forestry", language: "Chinese and English" },
  { group: "chemistry", groupLabel: "College of Chemistry, Chemical Engineering and Resource Utilization", code: "070300", name: "Chemistry", language: "Chinese" },
  { group: "economics", groupLabel: "College of Economics and Management", code: "020200", name: "Applied Economics", language: "Chinese and English" },
  { group: "economics", groupLabel: "College of Economics and Management", code: "120200", name: "Business Administration", language: "Chinese" },
  { group: "economics", groupLabel: "College of Economics and Management", code: "120300", name: "Agricultural and Forestry Economics and Management", language: "Chinese" },
  { group: "materials", groupLabel: "College of Material Science and Engineering", code: "080500", name: "Materials Science and Engineering", language: "Chinese" },
  { group: "materials", groupLabel: "College of Material Science and Engineering", code: "082900", name: "Forestry Engineering", language: "Chinese and English" },
  { group: "home-art", groupLabel: "College of Home and Art Design", code: "087200", name: "Design Science", language: "Chinese" },
  { group: "home-art", groupLabel: "College of Home and Art Design", code: "082900", name: "Forestry Engineering", language: "Chinese" },
  { group: "mechanical", groupLabel: "College of Mechanical and Electrical Engineering", code: "080200", name: "Mechanical Engineering", language: "Chinese" },
  { group: "mechanical", groupLabel: "College of Mechanical and Electrical Engineering", code: "082900", name: "Forestry Engineering", language: "Chinese" },
  { group: "civil", groupLabel: "School of Civil Engineering and Transportation", code: "081400", name: "Civil Engineering", language: "Chinese" },
  { group: "civil", groupLabel: "School of Civil Engineering and Transportation", code: "082300", name: "Transportation Engineering", language: "Chinese" },
  { group: "civil", groupLabel: "School of Civil Engineering and Transportation", code: "087100", name: "Management Science and Engineering", language: "Chinese" },
  { group: "humanities", groupLabel: "School of Humanities and Law", code: "030100", name: "Law", language: "Chinese" },
  { group: "foreign-languages", groupLabel: "College of Foreign Languages", code: "050200", name: "Foreign Languages and Literatures", language: "Chinese" },
  { group: "computer", groupLabel: "College of Computer Science and Artificial Intelligence", code: "081200", name: "Computer Science and Technology", language: "Chinese" },
  { group: "marxism", groupLabel: "School of Marxism", code: "030500", name: "Marxist Theory", language: "Chinese" },
  { group: "life-science", groupLabel: "College of Life Science", code: "071000", name: "Biology", language: "Chinese and English" },
  { group: "science", groupLabel: "College of Science", code: "070100", name: "Mathematics", language: "Chinese" },
  { group: "science", groupLabel: "College of Science", code: "080300", name: "Optical Engineering", language: "Chinese" },
  { group: "ecology", groupLabel: "School of Ecology", code: "071300", name: "Ecology", language: "Chinese and English" },
  { group: "control", groupLabel: "College of Control and Information Engineering", code: "081100", name: "Control Science and Engineering", language: "Chinese" },
  { group: "control", groupLabel: "College of Control and Information Engineering", code: "080800", name: "Electrical Engineering", language: "Chinese" },
  { group: "control", groupLabel: "College of Control and Information Engineering", code: "0802J2", name: "Low Altitude Technology and Engineering", language: "Chinese" },
  { group: "food-health", groupLabel: "College of Food and Health", code: "071000", name: "Biology", language: "Chinese" },
  { group: "food-health", groupLabel: "College of Food and Health", code: "097200", name: "Food Science and Engineering", language: "Chinese and English" },
  { group: "food-health", groupLabel: "College of Food and Health", code: "100700", name: "Pharmacy", language: "Chinese" },
];

const doctoralSpecs: Spec[] = [
  { group: "forestry", groupLabel: "School of Forestry", code: "090700", name: "Forestry", language: "Chinese and English" },
  { group: "landscape", groupLabel: "College of Landscape Architecture", code: "090700", name: "Forestry", language: "Chinese" },
  { group: "wildlife", groupLabel: "College of Wildlife and Protected Area", code: "090700", name: "Forestry", language: "Chinese and English" },
  { group: "chemistry", groupLabel: "College of Chemistry, Chemical Engineering and Resource Utilization", code: "070300", name: "Chemistry", language: "Chinese" },
  { group: "economics", groupLabel: "College of Economics and Management", code: "120300", name: "Agricultural and Forestry Economics and Management", language: "Chinese" },
  { group: "materials", groupLabel: "College of Material Science and Engineering", code: "082900", name: "Forestry Engineering", language: "Chinese with a selected English-taught direction" },
  { group: "mechanical", groupLabel: "College of Mechanical and Electrical Engineering", code: "080200", name: "Mechanical Engineering", language: "Chinese" },
  { group: "mechanical", groupLabel: "College of Mechanical and Electrical Engineering", code: "082900", name: "Forestry Engineering", language: "Chinese" },
  { group: "mechanical", groupLabel: "College of Mechanical and Electrical Engineering", code: "0829J2", name: "Low Altitude Technology and Engineering", language: "Chinese" },
  { group: "civil", groupLabel: "School of Civil Engineering and Transportation", code: "082300", name: "Transportation Engineering", language: "Chinese" },
  { group: "computer", groupLabel: "College of Computer Science and Artificial Intelligence", code: "071000", name: "Biology", language: "Chinese" },
  { group: "computer", groupLabel: "College of Computer Science and Artificial Intelligence", code: "082900", name: "Forestry Engineering", language: "Chinese" },
  { group: "computer", groupLabel: "College of Computer Science and Artificial Intelligence", code: "0829J2", name: "Low Altitude Technology and Engineering", language: "Chinese" },
  { group: "marxism", groupLabel: "School of Marxism", code: "030500", name: "Marxist Theory", language: "Chinese" },
  { group: "life-science", groupLabel: "College of Life Science", code: "071000", name: "Biology", language: "Chinese and English" },
  { group: "ecology", groupLabel: "School of Ecology", code: "071300", name: "Ecology", language: "Chinese and English" },
  { group: "control", groupLabel: "College of Control and Information Engineering", code: "080200", name: "Mechanical Engineering", language: "Chinese" },
  { group: "control", groupLabel: "College of Control and Information Engineering", code: "0829J2", name: "Low Altitude Technology and Engineering", language: "Chinese" },
  { group: "food-health", groupLabel: "College of Food and Health", code: "071000", name: "Biology", language: "Chinese" },
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fieldCategory = (name: string) => /Economics|Business|Management/.test(name) ? "Business" : /Law|Languages|Marxist|Design/.test(name) ? "Humanities" : /Biology|Ecology|Forestry|Animal|Food|Pharmacy/.test(name) ? "Life Sciences" : /Chemistry|Mathematics/.test(name) ? "Science" : "Engineering";
const programFor = (spec: Spec, degreeLevel: "Master" | "Doctoral", source: Source) => {
  const supportsEnglish = spec.language !== "Chinese";
  const tuition = degreeLevel === "Master" ? { chinese: 25000, english: 30000 } : { chinese: 32000, english: 38000 };
  return {
    slug: `northeast-forestry-university-${spec.group}-${slug(spec.name)}-${degreeLevel.toLowerCase()}-fall-2027`,
    schoolSlug: school.slug,
    citySlug: "harbin",
    nameEn: spec.name,
    degreeLevel,
    durationYears: degreeLevel === "Master" ? 3 : 4,
    fieldCategory: fieldCategory(spec.name),
    subjectArea: spec.name,
    teachingLanguage: spec.language,
    hskRequirement: "HSK Level 4 score 180 for science, engineering, agriculture, medicine, economics, management and art; HSK Level 5 score 180 for literature and law.",
    englishRequirement: supportsEnglish ? "IELTS 6.5, TOEFL above 95 or other accepted English-proficiency proof for the English-taught option/direction." : undefined,
    tuitionAmount: spec.language === "Chinese" ? tuition.chinese : undefined,
    tuitionCurrency: spec.language === "Chinese" ? "CNY" : undefined,
    tuitionPeriod: spec.language === "Chinese" ? "year" : undefined,
    tuitionText: spec.language === "Chinese" ? `CNY ${tuition.chinese.toLocaleString("en-US")}/year.` : `CNY ${tuition.chinese.toLocaleString("en-US")}/year for Chinese-taught study; CNY ${tuition.english.toLocaleString("en-US")}/year for English-taught study.`,
    scholarshipText: "The current official portal publishes Chinese Government, Eurasian international-student and university scholarship options; award eligibility is separate from program admission.",
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: `Official 2027 discipline code ${spec.code}; ${spec.groupLabel}. Research directions remain on the source page and are not promoted as separate degree programs.`,
    hasScholarship: true,
    badgeText: "Fall 2027 official route",
    displaySubjects: [spec.name],
    displayGroup: spec.group,
    displayGroupLabel: spec.groupLabel,
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "official 2027 discipline table",
      degreeLevel: "official page heading",
      durationYears: "official 2027 note",
      fieldCategory: "CUAC taxonomy derived from official discipline name",
      subjectArea: "official discipline name",
      teachingLanguage: "official 2027 discipline table",
      hskRequirement: "official 2027 language requirements",
      ...(supportsEnglish ? { englishRequirement: "official 2027 language requirements" } : {}),
      tuitionText: "official 2027 fee section",
      ...(spec.language === "Chinese" ? { tuitionAmount: "official Chinese-taught 2027 fee", tuitionCurrency: "official fee currency", tuitionPeriod: "official annual fee period" } : {}),
      scholarshipText: "official current scholarship pages",
      applicationUrl: "official 2027 program page",
      applicationNote: "official discipline code and college",
      hasScholarship: "official current scholarship navigation",
      badgeText: "official cycle",
      displaySubjects: "official discipline name",
      displayGroup: "normalized official college grouping",
      displayGroupLabel: "official college name",
    },
  };
};
const programs = [
  ...masterSpecs.map((spec) => programFor(spec, "Master", master)),
  ...doctoralSpecs.map((spec) => programFor(spec, "Doctoral", doctoral)),
];
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall 2027",
  intakeYear: 2027,
  deadlineDate: "2027-06-30T15:59:59.000Z",
  deadlineLabel: "Applications close June 30, 2027 Beijing time.",
  applicationRound: `2027 international ${program.degreeLevel.toLowerCase()} admission`,
  status: "open" as const,
  sourceUrl: program.sourceUrl,
  sourceLabel: program.sourceLabel,
  sourceSha256: program.sourceSha256,
  capturedAt: program.capturedAt,
  sourceFieldLineage: { intakeTerm: "official September 2027 enrollment note", intakeYear: "official 2027 program page", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official 2027 deadline", applicationRound: "official degree level and cycle" },
}));

const scholarships = [
  {
    slug: "northeast-forestry-university-chinese-government-scholarship-current",
    title: "Chinese Government Scholarship Program at Northeast Forestry University",
    nameZh: "东北林业大学中国政府奖学金",
    schoolSlug: school.slug,
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B",
    providerName: "国家留学基金管理委员会 / 东北林业大学",
    providerNameEn: "China Scholarship Council / Northeast Forestry University",
    providerLocation: "Harbin, Heilongjiang, China",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, on-campus accommodation, application fee, comprehensive medical insurance and monthly living allowance.",
    applicableDegree: "Bachelor, Master and Doctoral",
    amountText: "Medical insurance CNY 800/year; monthly allowance CNY 2,500 bachelor, CNY 3,000 master and CNY 3,500 doctoral.",
    requirementText: "Non-Chinese citizens in good health; under 25/35/40 for bachelor/master/doctoral study. Chinese-taught applicants need HSK Level 4; English-taught bachelor applicants need IELTS 6.0 or TOEFL 90, and graduate applicants IELTS 6.5 or TOEFL 95. Cannot be combined with another scholarship.",
    benefitItems: [
      { label: "Tuition", included: true, note: "Waived" },
      { label: "On-campus accommodation", included: true, note: "Waived" },
      { label: "Application fee", included: true, note: "Waived" },
      { label: "Medical insurance", included: true, note: "CNY 800/year" },
      { label: "Living allowance", included: true, note: "CNY 2,500-3,500/month by degree level" },
    ],
    eligibilityItems: [
      { label: "Age and degree", value: "Under 25 with high-school diploma for bachelor; under 35 with bachelor degree for master; under 40 with master degree for doctoral" },
      { label: "Chinese-taught", value: "HSK Level 4" },
      { label: "English-taught", value: "Bachelor IELTS 6.0/TOEFL 90; graduate IELTS 6.5/TOEFL 95" },
      { label: "Other funding", value: "Cannot be combined with another scholarship" },
    ],
    applicationSteps: [
      { label: "CSC system", value: "Apply as Program Category Type B using NEFU agency code 10225" },
      { label: "NEFU system", value: "Submit a parallel application through the university international-student enrollment system" },
    ],
    actionLinks: [{ label: "Official scholarship page", url: cgs.finalUrl ?? cgs.url, kind: "official-source" }],
    deadlineLabel: "Annual application window: November through March; no cycle-specific 2027 closing date is stated on the captured page.",
    applicationRound: "Current annual Chinese Government Scholarship Type B round",
    benefits: ["Tuition waiver", "On-campus accommodation", "Application-fee waiver", "Medical insurance", "Monthly stipend"],
    tags: ["Chinese Government Scholarship", "Type B", "Full scholarship"],
    summary: "Current full scholarship for bachelor, master and doctoral international study at NEFU.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: cgs.fetchedAt,
    ...sourceFields(cgs),
    sourceFieldLineage: { title: "official scholarship title", coverage: "official coverage section", applicableDegree: "official eligibility and duration table", amountText: "official coverage amounts", requirementText: "official eligibility section", benefitItems: "official coverage section", eligibilityItems: "official eligibility section", applicationSteps: "official application procedure", deadlineLabel: "official recurring application window", applicationRound: "official current program", benefits: "official coverage section", tags: "official scholarship type and coverage", summary: "official current program scope" },
  },
  {
    slug: "northeast-forestry-university-eurasian-international-students-scholarship-current",
    title: "Scholarship Program for International Students from Eurasian Countries at Northeast Forestry University",
    nameZh: "东北林业大学欧亚国家留学生奖学金",
    schoolSlug: school.slug,
    type: "government",
    typeLabel: "Eurasian international students scholarship",
    providerName: "东北林业大学 / 国家留学基金管理委员会",
    providerNameEn: "Northeast Forestry University / China Scholarship Council",
    providerLocation: "Harbin, Heilongjiang, China",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly living allowance.",
    applicableDegree: "Master and Doctoral",
    amountText: "Medical insurance CNY 800/year; monthly allowance CNY 3,000 master and CNY 3,500 doctoral.",
    requirementText: "Applicants must be from one of the named Eurasian countries, under 35 with a bachelor degree for master study or under 40 with a master degree for doctoral study. Chinese-taught routes require HSK Level 4; English-taught routes require IELTS 6.5 or TOEFL 95. The award cannot be combined with another scholarship.",
    targetCountries: ["Russia", "Belarus", "Ukraine", "Georgia", "Armenia", "Moldova", "Azerbaijan", "Mongolia", "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Uzbekistan", "Turkmenistan"],
    targetRegions: ["Eurasia"],
    benefitItems: [
      { label: "Tuition", included: true, note: "Waived" },
      { label: "On-campus accommodation", included: true, note: "Waived" },
      { label: "Medical insurance", included: true, note: "CNY 800/year" },
      { label: "Living allowance", included: true, note: "CNY 3,000/month master; CNY 3,500/month doctoral" },
    ],
    actionLinks: [{ label: "Official scholarship page", url: eurasian.finalUrl ?? eurasian.url, kind: "official-source" }],
    deadlineLabel: "Annual application window: November through February; no cycle-specific 2027 closing date is stated on the captured page.",
    applicationRound: "Current annual Eurasian scholarship round",
    benefits: ["Tuition waiver", "On-campus accommodation", "Medical insurance", "Monthly stipend"],
    tags: ["Eurasia", "Master", "Doctoral", "Full scholarship"],
    summary: "Current full graduate scholarship for applicants from 13 named Eurasian countries.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: eurasian.fetchedAt,
    ...sourceFields(eurasian),
    sourceFieldLineage: { title: "official scholarship title", coverage: "official coverage section", applicableDegree: "official category section", amountText: "official coverage amounts", requirementText: "official eligibility section", targetCountries: "official nationality list", targetRegions: "CUAC grouping derived from official nationality list", benefitItems: "official coverage section", deadlineLabel: "official recurring application window", applicationRound: "official current program", benefits: "official coverage section", tags: "official target and degree scope", summary: "official program scope" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: doctoral.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: doctoral.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 115, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The bachelor page remains explicitly Fall 2026 and is preserved only as school-level context; no bachelor route is relabeled as 2027.",
    "The official graduate tables contain research directions beneath discipline rows. This wave structures the 34 master and 19 doctoral discipline/college combinations and retains research directions on the official source page rather than misrepresenting them as separate degree programs.",
    "Current scholarship pages publish recurring November-March and November-February windows but no cycle-specific 2027 closing date; deadlineDate remains absent.",
    "For Chinese/English disciplines, the official fee is language-dependent; no single numeric tuitionAmount is inferred, and both published bands remain in tuitionText.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant-document contents and personal contacts are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-162");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 162, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
