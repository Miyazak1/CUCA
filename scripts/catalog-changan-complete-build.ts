import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/changan-complete-batch-01/manifest.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);
const sources = new Map(manifest.sources.map((row: any) => [row.id, row]));
const requiredSourceIds = [
  "changan-admissions-brochure-page-2026", "changan-bachelor-guide-2026", "changan-bachelor-programs-chinese-2026",
  "changan-bachelor-programs-english-2026", "changan-csca-chinese-pdf-2026", "changan-csca-english-pdf-2026",
  "changan-master-guide-2026", "changan-master-programs-chinese-pdf-2026", "changan-master-programs-english-pdf-2026",
  "changan-phd-guide-2026", "changan-phd-programs-chinese-pdf-2026", "changan-phd-programs-english-pdf-2026",
  "changan-cgs-type-b-2026-2027", "changan-cgs-type-a-2026-2027", "changan-presidential-scholarship-current",
  "changan-belt-road-scholarship-current", "changan-five-central-asian-scholarship-current",
  "changan-international-chinese-language-teachers-scholarship-2026",
];
for (const id of requiredSourceIds) {
  const source: any = sources.get(id);
  if (!source || source.status !== 200 || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Missing valid source: ${id}`);
}
const meta = (id: string) => {
  const source: any = sources.get(id);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const schoolSlug = "chang-an-university";
const applicationUrl = "https://is.chd.edu.cn/";
type Major = [school: string, name: string];
const rows = (school: string, names: string[]): Major[] => names.map((name) => [school, name]);

const bachelorChinese: Major[] = [
  ...rows("School of Highway", ["Road, Bridge and River-crossing Engineering", "City Underground Space Engineering"]),
  ...rows("School of Automobile", ["Intelligent Vehicle Engineering", "Vehicle Engineering", "Logistics Engineering", "Automobile Service Engineering"]),
  ...rows("School of Construction Machinery", ["Intelligent Manufacturing Engineering", "Mechanical Design Manufacture and Automation", "Mechatronic Engineering"]),
  ...rows("School of Economics and Management", ["Logistics Management", "Business Administration", "Accounting", "Engineering Management", "Economic Statistics", "International Economics and Trade"]),
  ...rows("School of Electronics and Control Engineering", ["Automation", "Robotics Engineering", "Traffic Equipment and Control Engineering"]),
  ...rows("Information Engineering School", ["Electronic Information Engineering", "Communication Engineering", "Artificial Intelligence", "Computer Science and Technology"]),
  ...rows("School of Geological Engineering and Geomatics", ["Geomatics Engineering", "Remote Sensing Science and Technology", "Geospatial Information Engineering", "Geology Engineering", "Investigation Technology and Engineering", "Geophysics", "Security Engineering"]),
  ...rows("School of Earth Science and Resources", ["Geology", "Resource Exploration Engineering", "Mineral Process Engineering", "Carbon Storage Science and Engineering"]),
  ...rows("School of Civil Engineering", ["Civil Engineering", "Building Environment and Energy Application Engineering", "Water Supply and Drainage Science and Engineering"]),
  ...rows("School of Water and Environment", ["Chemical Engineering and Technics", "Environmental Engineering", "Hydraulic and Hydro-Power Engineering", "Hydrology and Water Resources Engineering", "Groundwater Science and Engineering"]),
  ...rows("School of Architecture", ["Architecture", "Urban-Rural Planning", "Landscape Architecture"]),
  ...rows("School of Materials Science and Engineering", ["Material Science and Engineering", "Polymer Materials and Engineering", "Materials Shaping and Control Engineering", "New Energy Materials and Devices"]),
  ...rows("College of Transportation Engineering", ["Transportation Engineering", "Communications and Transportation", "Big Data Management and Application"]),
  ...rows("School of Land Engineering", ["Geographic Information Science", "Land Consolidation Engineering", "Land Resource Management"]),
  ...rows("School of Marxism", ["Ideological and Political Education"]),
  ...rows("School of Humanities", ["Law", "Radio and Television Directing", "Public Administration", "Journalism", "Chinese Language and Literature"]),
  ...rows("School of Sciences", ["Engineering Mechanics", "Mathematics and Applied Mathematics", "Information and Computing Science", "Applied Physics"]),
  ...rows("School of Foreign Studies", ["English", "Japanese"]),
  ...rows("Department of Physical Education", ["Social Sports Instruction and Administration"]),
  ...rows("School of Energy and Electrical Engineering", ["New Energy Science and Engineering", "Energy and Power Engineering", "Electrical Engineering and Automation"]),
];
const bachelorEnglish: Major[] = [
  ["School of Construction Machinery", "Mechatronic Engineering"], ["School of Economics and Management", "International Economy and Trade"],
  ["Information Engineering School", "Computer Science and Technology"], ["Information Engineering School", "Electronic and Information Engineering"],
  ["School of Earth Science and Resources", "Geology"], ["School of Civil Engineering", "Civil Engineering"],
  ["School of Materials Science and Engineering", "Materials Science and Engineering"], ["School of Highway", "Road, Bridge and River-crossing Engineering"],
  ["School of Architecture", "Architecture"], ["School of Automobile", "Vehicle Engineering"], ["School of Automobile", "Logistics Engineering"],
  ["School of Automobile", "Automobile Service Engineering"], ["School of Automobile", "Intelligent Vehicle Engineering"],
  ["School of Land Engineering", "Land Resource Management"],
];
const masterChinese: Major[] = [
  ...rows("Highway School", ["Civil Engineering", "Transportation Engineering", "Transportation and Energy Integration Engineering"]),
  ...rows("School of Automobile", ["Vehicle Engineering", "Intelligent Vehicle Engineering", "Transportation Engineering", "Low-Altitude Technology and Engineering"]),
  ...rows("School of Construction Machinery", ["Mechanical Engineering"]),
  ...rows("School of Electronics and Control Engineering", ["Control Science and Engineering", "Transportation Engineering"]),
  ...rows("Information Engineering School", ["Information and Communication Engineering", "Computer Science and Technology", "Transportation Engineering"]),
  ...rows("School of Geological Engineering and Geomatics", ["Geophysics", "Surveying and Mapping", "Geological Resources and Geological Engineering", "Ecological Geology and Restoration", "Safety Science and Engineering", "Remote Sensing Science and Technology"]),
  ...rows("School of Earth Science and Resources", ["Geology", "Geological Resources and Geological Engineering"]),
  ...rows("School of Civil Engineering", ["Civil Engineering"]),
  ...rows("School of Water and Environment", ["Hydraulic Engineering", "Chemical Engineering and Technology", "Environmental Science and Engineering"]),
  ...rows("School of Architecture", ["Urban and Rural Planning", "Architecture"]),
  ...rows("School of Materials Science and Engineering", ["Materials Science and Engineering", "Intelligent Design and Manufacturing of Materials"]),
  ...rows("College of Transportation Engineering", ["Transportation Engineering", "Statistics"]),
  ...rows("School of Land Engineering", ["Land Engineering", "Land Resource Management", "Geography"]),
  ...rows("School of Humanities", ["Aesthetics", "Public Management", "International Chinese Language Education"]),
  ...rows("School of Sciences", ["Mathematics", "Mechanics"]),
  ...rows("School of Foreign Studies", ["Foreign Language Literature"]),
  ...rows("School of Energy and Electrical Engineering", ["Power Engineering and Engineering Thermophysics", "Electrical Engineering"]),
  ...rows("School of Marxism", ["Philosophy", "Marxist Theory"]),
  ...rows("Institute of Data Science and Artificial Intelligence", ["Computer Science and Technology", "Cyberspace Security"]),
];
const masterEnglish: Major[] = [
  ...rows("Highway School", ["Communication and Transportation Engineering", "Civil Engineering"]),
  ...rows("School of Construction Machinery", ["Mechanical Engineering"]),
  ...rows("School of Economics and Management", ["Business Administration", "Management Science and Engineering"]),
  ...rows("School of Electronics and Control Engineering", ["Communication and Transportation Engineering", "Control Science and Engineering"]),
  ...rows("Information Engineering School", ["Information and Communication Engineering", "Computer Science and Technology", "Communication and Transportation Engineering"]),
  ...rows("School of Geological Engineering and Geomatics", ["Geophysics", "Surveying and Mapping", "Safety Science and Engineering", "Geological Resources and Geological Engineering"]),
  ...rows("School of Earth Science and Resources", ["Geology", "Geological Resources and Geological Engineering"]),
  ...rows("School of Civil Engineering", ["Civil Engineering"]),
  ...rows("School of Architecture", ["Architecture", "Urban and Rural Planning"]),
  ...rows("School of Water and Environment", ["Chemical Engineering and Technology", "Environmental Science and Engineering", "Hydraulic Engineering"]),
  ...rows("School of Automobile", ["Vehicle Engineering", "Communication and Transportation Engineering", "Intelligent Vehicle Engineering"]),
  ...rows("School of Materials Science and Engineering", ["Materials Science and Engineering"]),
  ...rows("School of Land Engineering", ["Land Resource Management", "Geography", "Land Engineering"]),
  ...rows("College of Transportation Engineering", ["Communication and Transportation Engineering"]),
  ...rows("School of Marxism", ["Marxist Theory"]),
  ...rows("School of Energy and Electrical Engineering", ["Electrical Engineering", "Power Engineering and Engineering Thermophysics"]),
  ...rows("School of Foreign Studies", ["Foreign Language and Literature"]),
];
const doctoralChinese: Major[] = [
  ...rows("Highway School", ["Geotechnical Engineering", "Bridge and Tunnel Engineering", "Road and Railway Engineering"]),
  ...rows("School of Automobile", ["Vehicle Engineering", "Vehicle Operation Engineering", "Intelligent Vehicle Engineering"]),
  ...rows("School of Construction Machinery", ["Mechanical Engineering"]), ...rows("School of Economics and Management", ["Management Science and Engineering"]),
  ...rows("School of Electronics and Control Engineering", ["Traffic Information Engineering and Control", "Intelligent Control Theory and Project"]),
  ...rows("School of Information Engineering", ["Computer Science and Technology", "Traffic Information Engineering and Control"]),
  ...rows("School of Geological Engineering and Geomatics", ["Geophysics", "Surveying and Mapping", "Geological Resources and Geological Engineering"]),
  ...rows("School of Earth Science and Resources", ["Geology", "Geological Resources and Geological Engineering"]),
  ...rows("School of Civil Engineering", ["Civil Engineering"]), ...rows("School of Architecture", ["Urban and Rural Planning"]),
  ...rows("School of Materials Science and Engineering", ["Materials Science and Engineering"]), ...rows("School of Sciences", ["Computational Structural Mechanics"]),
  ...rows("School of Marxism", ["Environment and Social Development"]),
  ...rows("School of Water and Environment", ["Hydraulic Engineering", "Environmental Science and Engineering"]),
  ...rows("School of Land Engineering", ["Land Engineering"]), ...rows("College of Transportation Engineering", ["Transportation Planning and Management"]),
  ...rows("School of Energy and Electrical Engineering", ["New Energy and Power Engineering"]),
  ...rows("School of Data Science and Artificial Intelligence", ["Traffic Information Engineering and Control"]),
];
const doctoralEnglish: Major[] = [
  ...rows("Highway School", ["Road and Railway Engineering", "Bridge and Tunnel Engineering", "Geotechnical Engineering"]),
  ...rows("School of Construction Machinery", ["Mechanical Engineering"]), ...rows("School of Economics and Management", ["Management Science and Engineering"]),
  ...rows("School of Electronics and Control Engineering", ["Traffic Information Engineering and Control"]),
  ...rows("School of Information Engineering", ["Computer Science and Technology"]),
  ...rows("School of Geological Engineering and Geomatics", ["Geophysics", "Geological Resources and Geological Engineering", "Surveying and Mapping"]),
  ...rows("School of Earth Science and Resources", ["Geology", "Geological Resources and Geological Engineering"]),
  ...rows("School of Civil Engineering", ["Civil Engineering"]),
  ...rows("School of Water and Environment", ["Environmental Science and Engineering", "Hydraulic Engineering"]),
  ...rows("School of Automobile", ["Vehicle Engineering", "Vehicle Operation Engineering"]),
  ...rows("School of Materials Science and Engineering", ["Materials Science and Engineering"]), ...rows("School of Land Engineering", ["Land Engineering"]),
  ...rows("College of Transportation Engineering", ["Transportation Planning and Management"]), ...rows("School of Architecture", ["Urban and Rural Planning"]),
  ...rows("School of Marxism", ["Environment and Social Development"]), ...rows("School of Energy and Electrical Engineering", ["New Energy and Power Engineering"]),
];

type Degree = "Bachelor" | "Master" | "Doctoral";
type Language = "Chinese" | "English";
const programSets: Array<[Major[], Degree, Language, string]> = [
  [bachelorChinese, "Bachelor", "Chinese", "changan-bachelor-programs-chinese-2026"], [bachelorEnglish, "Bachelor", "English", "changan-bachelor-programs-english-2026"],
  [masterChinese, "Master", "Chinese", "changan-master-programs-chinese-pdf-2026"], [masterEnglish, "Master", "English", "changan-master-programs-english-pdf-2026"],
  [doctoralChinese, "Doctoral", "Chinese", "changan-phd-programs-chinese-pdf-2026"], [doctoralEnglish, "Doctoral", "English", "changan-phd-programs-english-pdf-2026"],
];
const seenSlugs = new Set<string>();
const programs: any[] = [];
for (const [majors, degreeLevel, teachingLanguage, sourceId] of programSets) for (const [school, rawName] of majors) {
  const suffix = `${degreeLevel === "Bachelor" ? "" : `${degreeLevel.toLowerCase()}-`}${slugify(rawName)}${teachingLanguage === "English" ? "-english" : ""}`;
  let slug = `${schoolSlug}-${suffix}`;
  if (seenSlugs.has(slug)) slug = `${slug}-${slugify(school)}`;
  if (seenSlugs.has(slug)) throw new Error(`Duplicate route slug: ${slug}`);
  seenSlugs.add(slug);
  const tuitionAmount = degreeLevel === "Bachelor" ? 16000 : degreeLevel === "Master" ? 21000 : 30000;
  programs.push({
    slug, schoolSlug, citySlug: "xian", nameEn: teachingLanguage === "English" ? `${rawName} (English)` : rawName, nameZh: rawName,
    degreeLevel, durationYears: degreeLevel === "Bachelor" ? 4 : degreeLevel === "Master" ? 3 : 4, fieldCategory: school, subjectArea: rawName, teachingLanguage,
    hskRequirement: teachingLanguage === "Chinese" ? (degreeLevel === "Bachelor" ? "HSK 4 score 180; School of Humanities majors require HSK 5 score 180." : "HSK 5 score 180; School of Humanities majors require HSK 5 score 210.") : "Not required for the published English-taught route.",
    englishRequirement: teachingLanguage === "English" ? "TOEFL iBT 80, IELTS 6.0, or Duolingo 100; published exemptions apply for qualifying prior English-medium education or English-speaking applicants." : "Not applicable to the published Chinese-taught route.",
    cscaRequirement: degreeLevel === "Bachelor" ? "CSCA subjects follow the official 2026 major-by-major matrix; Mathematics is required for all published routes, with Chinese, Physics and/or Chemistry as marked for the route." : "No CSCA requirement is published for this graduate route.",
    tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`, displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
    scholarshipText: "Eligible applicants may apply for Chang'an University's published government, municipal, university or language-teacher scholarship routes, subject to each award's rules.",
    applicationUrl, applicationNote: `Official 2026 ${teachingLanguage.toLowerCase()}-taught ${degreeLevel.toLowerCase()} route.`, hasScholarship: true,
    badgeText: "Official 2026 route", displayGroup: degreeLevel, displayGroupLabel: `${teachingLanguage}-taught ${degreeLevel.toLowerCase()} programs`, status: "draft" as const,
    ...meta(sourceId), sourceFieldLineage: { nameEn: "official 2026 catalog major column", nameZh: "official catalog publishes an English major title; retained without an invented translation", fieldCategory: "official school column", degreeLevel: "official catalog heading", teachingLanguage: "official catalog heading", durationYears: "official 2026 admission guide", tuitionText: "official 2026 fee table", hskRequirement: "official 2026 language table", englishRequirement: "official 2026 language table", cscaRequirement: degreeLevel === "Bachelor" ? "official 2026 CSCA subject matrix" : "official graduate guide" },
  });
}
const programIntakes = programs.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-15T00:00:00Z", deadlineLabel: "Self-funded degree application deadline: June 15, 2026; scholarship deadlines differ by award.", applicationRound: "2026 international degree admission", status: "closed" as const,
  ...meta(program.degreeLevel === "Bachelor" ? "changan-bachelor-guide-2026" : program.degreeLevel === "Master" ? "changan-master-guide-2026" : "changan-phd-guide-2026"), sourceFieldLineage: { deadlineDate: "official 2026 guide; normalized to ISO UTC", deadlineLabel: "official 2026 guide" },
}));

const scholarship = (sourceId: string, value: Omit<CatalogSeedScholarship, "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt" | "schoolSlug" | "status">): CatalogSeedScholarship => ({
  schoolSlug, status: "draft", providerLocation: "Xi'an, Shaanxi, China", targetCountries: [], targetRegions: [], ...meta(sourceId),
  actionLinks: [{ label: "Official scholarship notice", url: meta(sourceId).sourceUrl, kind: "official-source" }, { label: "Chang'an University application portal", url: applicationUrl, kind: "official-application" }],
  sourceFieldLineage: { title: "official notice title", fundingLevel: "published coverage", coverage: "published coverage", applicableDegree: "published degree scope", applicableProgram: "published program scope", eligibilityItems: "eligibility section", applicationMaterials: "application-materials section", applicationSteps: "application process section", deadlineLabel: "published deadline" }, ...value,
});
const commonMaterials = [{ label: "Passport" }, { label: "Highest degree certificate and transcripts" }, { label: "Language certificate" }, { label: "Physical examination" }, { label: "No-criminal-record certificate" }];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("changan-cgs-type-a-2026-2027", { slug: "official-2026-2027-changan-cgs-type-a", title: "Chang'an University 2026–2027 Chinese Government Scholarship — Type A Bilateral Program", nameZh: "长安大学2026—2027学年中国政府奖学金国别双边项目（Type A）", type: "government", typeLabel: "Chinese Government Scholarship Type A", providerName: "Ministry of Education of the PRC / China Scholarship Council", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full", coverage: "Registration, tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend.", applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "Chang'an University degree programs accepted through the applicant's dispatching authority", amountText: "Monthly stipend: CNY 2,500 bachelor; CNY 3,000 master; CNY 3,500 doctoral", deadlineDate: "2026-05-31", deadlineLabel: "Chang'an University guide lists May 31, 2026; the dispatching authority may set an earlier deadline", applicationRound: "2026–2027 Type A bilateral route", benefitItems: [{label:"Registration and tuition",included:true},{label:"On-campus accommodation",included:true},{label:"Medical insurance",included:true},{label:"Monthly stipend",included:true,note:"CNY 2,500 bachelor; 3,000 master; 3,500 doctoral"}], eligibilityItems: [{label:"Citizenship",value:"Non-Chinese citizen in good health"},{label:"Application channel",value:"Apply through the home-country dispatching authority or Chinese embassy/consulate"}], applicationMaterials: commonMaterials, applicationSteps: [{label:"Step 1",value:"Contact the dispatching authority"},{label:"Step 2",value:"Submit the CSC Type A application"},{label:"Step 3",value:"Complete Chang'an University registration after nomination"}], summary: "Full bilateral Chinese Government Scholarship route published by Chang'an University.", sortOrder: 10 }),
  scholarship("changan-cgs-type-b-2026-2027", { slug: "official-2026-2027-changan-cgs-type-b", title: "Chang'an University 2026–2027 Chinese Government Scholarship — Type B University Program", nameZh: "长安大学2026—2027学年中国政府奖学金高校自主招生项目（Type B）", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "Ministry of Education of the PRC / China Scholarship Council", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full", coverage: "Registration, tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend.", applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "First batch: all majors and nationalities; second batch: the five majors and ten nationalities published in the official notice", amountText: "Monthly stipend: CNY 2,500 bachelor; CNY 3,000 master; CNY 3,500 doctoral", deadlineDate: "2026-03-31", deadlineLabel: "First batch: February 28, 2026; second batch: March 31, 2026", applicationRound: "2026–2027 Type B university route", benefitItems: [{label:"Registration and tuition",included:true},{label:"On-campus accommodation",included:true},{label:"Medical insurance",included:true},{label:"Monthly stipend",included:true,note:"CNY 2,500 bachelor; 3,000 master; 3,500 doctoral"}], eligibilityItems: [{label:"Citizenship",value:"Non-Chinese citizen in good health"},{label:"Degree and age",value:"Bachelor under 25; master under 35; doctoral under 40"},{label:"No concurrent Chinese award",value:"Cannot hold another Chinese-government or Chinese-university scholarship"}], applicationMaterials: commonMaterials, applicationSteps: [{label:"Step 1",value:"Apply in CSC Type B using Chang'an University agency code 10710"},{label:"Step 2",value:"Apply in the university portal and pay the published fee"},{label:"Step 3",value:"Monitor the registered email for review results"}], summary: "Full current Type B route with two published application batches.", sortOrder: 20 }),
  scholarship("changan-presidential-scholarship-current", { slug: "official-2026-changan-presidential-scholarship", title: "Chang'an University Presidential Scholarship 2026", nameZh: "长安大学2026年校长奖学金", type: "university", typeLabel: "Presidential Scholarship", providerName: "Chang'an University", providerNameEn: "Chang'an University", fundingLevel: "Partial", coverage: "Weishui-campus accommodation fee throughout the normal study period plus a first-year living stipend.", applicableDegree: "Bachelor, Master, Doctoral, Non-degree", applicableProgram: "Published Chang'an University international programs", amountText: "First-year stipend: CNY 1,500/month bachelor; 2,000/month master; 2,500/month doctoral, for 10 months", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 Presidential Scholarship", benefitItems: [{label:"Weishui-campus accommodation",included:true,note:"Other campuses or off-campus housing are self-funded"},{label:"First-year stipend",included:true,note:"CNY 1,500/2,000/2,500 by degree for 10 months"}], eligibilityItems: [{label:"Citizenship",value:"Non-Chinese citizen in good health"},{label:"Degree and age",value:"Bachelor under 25; master under 35; doctoral under 40; non-degree under 45"},{label:"No other scholarship",value:"Applicant must not hold another scholarship"}], applicationMaterials: commonMaterials, applicationSteps: [{label:"Step 1",value:"Select Presidential Scholarship in the university portal"},{label:"Step 2",value:"Upload the published materials and pay the application fee"},{label:"Step 3",value:"Await university review by email"}], summary: "University-funded accommodation and first-year stipend route.", sortOrder: 30 }),
  scholarship("changan-belt-road-scholarship-current", { slug: "official-2026-changan-xian-belt-road-scholarship", title: "Chang'an University Xi'an Municipal Belt and Road Scholarship 2026", nameZh: "长安大学2026年西安市“一带一路”外国留学生奖学金", type: "government", typeLabel: "Xi'an Municipal Belt and Road Scholarship", providerName: "Xi'an Municipal Government / Chang'an University", providerNameEn: "Xi'an Municipal Government / Chang'an University", fundingLevel: "Partial or Full Tuition", coverage: "Bachelor: 50% tuition; master and doctoral: full tuition; first-year monthly stipend by degree.", applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "Published Chang'an University degree programs", amountText: "Bachelor 50% tuition; master/doctoral full tuition; first-year stipend CNY 1,500/2,000/2,500 per month for 10 months", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 Belt and Road Scholarship", benefitItems: [{label:"Tuition",included:true,note:"50% bachelor; full master and doctoral"},{label:"First-year stipend",included:true,note:"CNY 1,500/2,000/2,500 by degree for 10 months"}], eligibilityItems: [{label:"Citizenship",value:"Non-Chinese citizen in good health"},{label:"Degree and age",value:"Published limits differ by degree"}], applicationMaterials: commonMaterials, applicationSteps: [{label:"Step 1",value:"Select the Belt and Road Scholarship in the university portal"},{label:"Step 2",value:"Upload materials and pay the application fee"},{label:"Step 3",value:"Await comprehensive review"}], summary: "Current Xi'an municipal tuition and first-year stipend route administered by Chang'an University.", sortOrder: 40 }),
  scholarship("changan-five-central-asian-scholarship-current", { slug: "official-2026-changan-five-central-asian-countries-scholarship", title: "Chang'an University Xi'an Municipal Five Central Asian Countries Scholarship 2026", nameZh: "长安大学2026年西安市五个中亚国家留学生奖学金", type: "government", typeLabel: "Five Central Asian Countries Scholarship", providerName: "Xi'an Municipal Government / Chang'an University", providerNameEn: "Xi'an Municipal Government / Chang'an University", fundingLevel: "Full", coverage: "Tuition, hostel, insurance, residence permit, physical examination, textbooks, international travel support and annual living stipend; one foundation year plus four undergraduate years.", applicableDegree: "Foundation plus Bachelor", applicableProgram: "Eligible Chang'an University Chinese-taught undergraduate majors", amountText: "CNY 18,000/year living stipend plus published fee waivers and travel support", deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026", applicationRound: "2026 Five Central Asian Countries Scholarship", targetCountries: ["Kazakhstan","Kyrgyzstan","Tajikistan","Turkmenistan","Uzbekistan"], benefitItems: [{label:"Tuition and hostel",included:true},{label:"Insurance, residence permit, medical exam and textbooks",included:true},{label:"International travel support",included:true},{label:"Living stipend",included:true,note:"CNY 18,000/year"}], eligibilityItems: [{label:"Nationality",value:"Citizen of Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan or Uzbekistan"},{label:"Education and age",value:"High-school diploma; under age 25"},{label:"Academic average",value:"At least 70% of the full mark"},{label:"Language after foundation",value:"HSK 5 score 180 for Humanities; HSK 4 score 180 for other schools"}], applicationMaterials: commonMaterials, applicationSteps: [{label:"Step 1",value:"Select the Five Central Asian Countries Scholarship in the university portal"},{label:"Step 2",value:"Upload materials and pay CNY 400 after preliminary review"},{label:"Step 3",value:"Await document and interview review"}], summary: "Full 1+4 municipal route for applicants from five Central Asian countries.", sortOrder: 50 }),
  scholarship("changan-international-chinese-language-teachers-scholarship-2026", { slug: "official-2026-changan-international-chinese-language-teachers-scholarship", title: "Chang'an University 2026 International Chinese Language Teachers Scholarship", nameZh: "长安大学2026年国际中文教师奖学金", type: "foundation", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "Center for Language Education and Cooperation / Chang'an University", providerNameEn: "Center for Language Education and Cooperation / Chang'an University", fundingLevel: "Full", coverage: "Tuition, accommodation, comprehensive medical insurance and monthly living allowance.", applicableDegree: "Master and Non-degree Chinese-language study", applicableProgram: "International Chinese Language Education master's and published one-year/one-semester Chinese study routes", amountText: "CNY 3,000/month master; CNY 2,500/month non-degree", deadlineDate: "2026-10-31", deadlineLabel: "May 15, 2026 for September intake; September 15 for December intake; October 31 for March 2027 intake", applicationRound: "2026–2027 language-teacher scholarship", benefitItems: [{label:"Tuition",included:true},{label:"Accommodation",included:true},{label:"Medical insurance",included:true},{label:"Monthly allowance",included:true,note:"CNY 3,000 master; 2,500 non-degree"}], eligibilityItems: [{label:"Citizenship",value:"Non-Chinese citizen"},{label:"Chinese-language commitment",value:"Interested in Chinese-language education or related work"},{label:"Language and age",value:"Meet the HSK/HSKK and age rules for the selected category"}], applicationMaterials: [{label:"Passport"},{label:"HSK/HSKK score report"},{label:"Recommending-institution certificate"},{label:"Degree or enrollment proof, where applicable"}], applicationSteps: [{label:"Step 1",value:"Apply through the official scholarship system"},{label:"Step 2",value:"Choose Chang'an University and the relevant category"},{label:"Step 3",value:"Track review and admission status online"}], summary: "Current fully funded international Chinese-language-teacher training route.", sortOrder: 60 }),
];

const schoolSource = meta("changan-admissions-brochure-page-2026");
const bundle: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: "xian", nameEn: "Xi'an", nameZh: "西安", region: "Northwest China", province: "Shaanxi", status: "active", ...schoolSource, sourceFieldLineage: { nameEn: "official address", nameZh: "official address", region: "CUAC normalized geographic region", province: "official address" } }],
  schools: [{ slug: schoolSlug, nameEn: "Chang'an University", nameZh: "长安大学", citySlug: "xian", schoolType: "Public", region: "Xi'an, Shaanxi, Northwest China", applicationLevel: "Bachelor, Master, Doctoral", languageOfInstruction: "Chinese and English", languageRequirement: "Chinese routes require HSK 4 for bachelor or HSK 5 for graduate study, with higher Humanities thresholds; English routes require TOEFL iBT 80, IELTS 6.0 or Duolingo 100, subject to published exemptions.", hskRequirement: "Bachelor: HSK 4 score 180, Humanities HSK 5 score 180; graduate: HSK 5 score 180, Humanities HSK 5 score 210.", englishRequirement: "TOEFL iBT 80, IELTS 6.0 or Duolingo 100; published English-medium/English-speaking exemptions apply.", deadlineSummary: "Self-funded 2026 degree applications closed June 15, 2026; scholarship deadlines vary by award and round.", tuitionSummary: "Bachelor CNY 16,000/year; master CNY 21,000/year; doctoral CNY 30,000/year; double-room accommodation CNY 7,200/year.", websiteUrl: "https://www.chd.edu.cn/", admissionsUrl: applicationUrl, cscaRequirement: "2026 bachelor applicants follow the official major-by-major CSCA matrix for Mathematics, Chinese, Physics and Chemistry.", subjectTags: ["Transportation Engineering","Civil Engineering","Geological Engineering","Automotive Engineering","Materials Science","Computer Science","Architecture","Land Engineering"], languageTags: ["Chinese-taught","English-taught"], tuitionBandLabel: "CNY 16,000–30,000/year", campusHighlights: ["Double First-Class university","Transportation engineering","Highway and bridge engineering","Geology and geomatics","Xi'an location"], status: "draft", ...schoolSource, sourceFieldLineage: { nameEn: "official university identity", nameZh: "official university identity", citySlug: "official address", schoolType: "official institutional profile", applicationLevel: "official 2026 program catalogs", languageOfInstruction: "official 2026 Chinese/English catalogs", deadlineSummary: "official 2026 guides", tuitionSummary: "official 2026 fee tables", cscaRequirement: "official 2026 CSCA PDFs" } }],
  programs, programIntakes, scholarships,
};
const report = createCatalogMigrationValidationReport(bundle);
const degreeCounts = Object.fromEntries(["Bachelor","Master","Doctoral"].map((degree) => [degree, programs.filter((row) => row.degreeLevel === degree).length]));
const languageCounts = Object.fromEntries(["Chinese","English"].map((language) => [language, programs.filter((row) => row.teachingLanguage === language).length]));
const lockedCounts = { bachelorChinese: bachelorChinese.length, bachelorEnglish: bachelorEnglish.length, masterChinese: masterChinese.length, masterEnglish: masterEnglish.length, doctoralChinese: doctoralChinese.length, doctoralEnglish: doctoralEnglish.length, degreeCounts, languageCounts, totalPrograms: programs.length, intakes: programIntakes.length, scholarships: scholarships.length };
if (!report.ok || programs.length !== 215 || programIntakes.length !== 215 || scholarships.length !== 6 || seenSlugs.size !== programs.length) throw new Error(`Invalid Chang'an candidate: ${JSON.stringify({ errors: report.errors, lockedCounts })}`);
const candidatePath = resolve(root, "seeds/catalog.changan-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.changan-complete-batch-01.validation.json");
const body = `${JSON.stringify(bundle, null, 2)}\n`;
await writeFile(candidatePath, body);
await writeFile(validationPath, `${JSON.stringify({ ...report, candidateSha256: createHash("sha256").update(body).digest("hex"), manifestSha256: createHash("sha256").update(manifestText).digest("hex"), lockedCounts }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, counts: report.summary, lockedCounts, bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
