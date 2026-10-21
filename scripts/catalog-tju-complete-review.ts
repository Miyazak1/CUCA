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
const schoolSlug = "tianjin-university";
type SourceRow = { id: string; url: string; label: string; sha256: string; fetchedAt: string; status: number; contentType: string };
type ParsedProgram = { catalogId: string; name: string; school: string; degreeLevel: "Undergraduate" | "Master" | "Doctoral"; durationYears: number; teachingLanguage: "Chinese" | "English"; tuitionCnyPerYear: number; tuitionSourceText: string; sourceId: string; sourceLocator: string };
const paths = {
  parsed: resolve(root, "work/catalog-official/2026-10-15T08-56-20-492Z/parsed-programs.json"),
  manifest: resolve(root, process.env.CUAC_TJU_MANIFEST ?? "work/catalog-official/2026-10-15T08-56-20-492Z/manifest.json"),
  scholarshipManifest: resolve(root, "work/catalog-official/tju-complete-batch-01/manifest.json"),
  draft: resolve(root, "seeds/catalog.tju-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.tju-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.tju-complete-batch-01.review.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const expectedParsedSha256 = "f3ebcac4f96e0850e450d23941af9300637a79e5915731f75ede295fc8da8d14";
const parsedText = await readFile(paths.parsed, "utf8");
if (sha(parsedText) !== expectedParsedSha256) throw new Error("Parsed TJU catalog changed after structural review.");
const parsed = JSON.parse(parsedText) as { programCount: number; counts: Record<string, number>; programs: ParsedProgram[] };
if (parsed.programCount !== 324 || JSON.stringify(parsed.counts) !== JSON.stringify({ Undergraduate: 80, Master: 119, Doctoral: 125 })) throw new Error("TJU parsed counts mismatch.");

const expected: Record<string, string> = {
  "tju-silk-road-scholarship-2026": "a2f7f4a8761d60858f5e5cc40637236e2517411634721ce38e3530e761feb5d4",
  "tju-undergraduate-admissions-2027": "1e55d46672aa6efc0957cd9f37c590bfef5234c070d77e192e2b89566455ece8",
  "tju-undergraduate-program-catalog-2027": "b39a8f16ea41b70d77566735caec737410391f45b4ebe8c6c37fea1c9bead684",
  "tju-undergraduate-csca-subjects-2027": "3cb0ab9ccff78ab2a9f6bc4b9eda9f32322d4b6b07a1be6a59512d0e561a28b2",
  "tju-master-admissions-2027": "902b7df52f9e034bf3a5f47bef8d3d10145ee6202abf982faf0cb3c9aa291557",
  "tju-master-program-catalog-2027": "abac819bc46e9388cd61def72ab4d6715322ac6383b6f89879688c525381958e",
  "tju-doctoral-admissions-2027": "d7681ada3a16460072fce6c51b55439da5602848dd7b0395cc6878bc5324622b",
  "tju-doctoral-program-catalog-2027": "38494b6a56f62af2f5ad32db182cf35fc92277aca977003759ced51fd631d3cc",
  "tju-cgs-high-level-postgraduate-2026": "5dacae8edc6d9133f8e6f9aa71da25eec57ff6c09a261ab96298cbf3e83774f3",
  "tju-youth-of-excellence-2026": "887b1cadac2d1238e6898ce15fa242309df776c6e541dc8990bea222c4156201",
  "tju-peiyang-future-scholar-2026": "4ea4bceb26ec244d88324f384be64442aa33fea8ff1941250ce072759d51af89",
  "tju-international-chinese-language-teachers-2026": "7b93f2d6dbd621f020a71bc865399ad453ec71cced9daabf1c15557b18aecd66",
  "tju-growth-steel-indonesia-2026": "320cabaab1b3b20eaf65a0aed518eac455d106fdaa993252c2f34f1e5862524c",
};
const manifests = [JSON.parse(await readFile(paths.manifest, "utf8")), JSON.parse(await readFile(paths.scholarshipManifest, "utf8"))];
const evidence = new Map<string, SourceRow>();
for (const manifest of manifests) for (const row of manifest.sources ?? []) if (expected[row.id] === row.sha256 && row.status === 200) evidence.set(row.id, row);
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked TJU evidence: ${missing.join(", ")}`);
const requiredEvidence = (id: string): SourceRow => {
  const source = evidence.get(id);
  if (!source) throw new Error(`TJU evidence is missing after validation: ${id}`);
  return source;
};

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cscaBySchool: Record<string, string[]> = {
  "School of Mechanical Engineering": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Microelectronics": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Architecture": ["Chinese for Arts or Science", "Mathematics"],
  "School of Chemical Engineering and Technology": ["Chinese for Science", "Mathematics", "Chemistry"],
  "School of Materials Science and Engineering": ["Chinese for Science", "Mathematics", "Physics"],
  "College of Management and Economics": ["Chinese for Arts", "Mathematics"],
  "School of Mathematics": ["Chinese for Science", "Mathematics"],
  "School of Education": ["Chinese for Arts", "Mathematics"],
  "School of Life Sciences": ["Chinese for Science", "Mathematics", "Chemistry"],
  "School of Marine Science and Technology": ["Chinese for Science", "Mathematics", "Physics or Chemistry"],
  "School of International Education": ["Chinese for Arts", "Mathematics"],
  "Law School": ["Chinese for Arts", "Mathematics"],
  "School of Precision Instrument and Opto-electronics Engineering": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Electrical and Information Engineering": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Pharmaceutical Science and Technology": ["Mathematics", "Chemistry"],
  "School of Civil Engineering": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Earth System Science": ["Chinese for Science", "Mathematics", "Physics", "Chemistry"],
  "School of Computer Science and Technology": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Artificial Intelligence": ["Chinese for Science", "Mathematics", "Physics"],
  "School of Computer Software": ["Chinese for Science", "Mathematics", "Physics"],
  "Medical School": ["Chinese for Science", "Mathematics", "Physics", "Chemistry"],
  "School of Humanities and Arts": ["Chinese for Arts", "Mathematics"],
  "School of Foreign Languages": ["Chinese for Arts", "Mathematics"],
  "The International Joint Institute of Tianjin University, Fuzhou": ["Chinese for Science", "Mathematics", "Physics", "Chemistry"],
  "Shenzhen International Institute of Tianjin University": ["Chinese for Science", "Mathematics", "Physics"],
  "Hainan International Institute": ["Mathematics"],
};
function cscaSubjects(row: ParsedProgram): string[] | undefined {
  if (row.degreeLevel !== "Undergraduate") return undefined;
  let values = row.school === "School of Science"
    ? ["Chinese for Science", "Mathematics", row.name === "Applied Physics" ? "Physics" : "Chemistry"]
    : row.school === "School of Environmental Science and Engineering"
      ? ["Chinese for Science", "Mathematics", row.name === "Building Environment & Energy Application Engineering" ? "Physics" : "Chemistry"]
      : row.school === "School of Synthetic Biology and Biomanufacturing"
        ? ["Chinese for Science", "Mathematics", row.name === "Food Science and Engineering" ? "Physics or Chemistry" : "Chemistry"]
        : [...(cscaBySchool[row.school] ?? [])];
  if (!values.length) throw new Error(`Missing CSCA mapping for ${row.school}`);
  if (row.teachingLanguage === "English") values = values.filter((value) => !value.startsWith("Chinese for "));
  return values;
}
const admissionsByDegree: Record<string, SourceRow> = {
  Undergraduate: evidence.get("tju-undergraduate-admissions-2027")!,
  Master: evidence.get("tju-master-admissions-2027")!,
  Doctoral: evidence.get("tju-doctoral-admissions-2027")!,
};
function tuitionLabel(row: ParsedProgram): string {
  if (row.tuitionSourceText === "276000RMB/3 year") return "RMB 276,000 total for 3 years (RMB 92,000/year equivalent)";
  if (String(row.tuitionSourceText).startsWith("150000 RMB/year for Year 1")) return "RMB 150,000 in Year 1; RMB 30,000/year in Years 2-3";
  return `RMB ${Number(row.tuitionCnyPerYear).toLocaleString("en-US")}/year`;
}
const programs: CatalogSeedProgram[] = parsed.programs.map((row) => {
  const source = evidence.get(row.sourceId)!;
  const subjects = cscaSubjects(row);
  const languageRequirement = row.teachingLanguage === "English"
    ? { englishRequirement: `${row.degreeLevel === "Master" ? "IELTS 6.0, TOEFL 80 or Duolingo 110" : "IELTS 6.0 or TOEFL 80"}; native English speakers and applicants whose preceding degree was taught in English may use the stated exemption. English-taught MBA requires IELTS 6.5 or TOEFL 85, GPA above 3.2/4.0 and at least one year of relevant work experience.` }
    : { hskRequirement: row.degreeLevel === "Undergraduate" ? "HSK Level 5 score 180; School of International Education undergraduate routes accept HSK Level 4 score 180." : "HSK Level 5 score 180, with stated exemptions for prior Chinese-medium study or native Chinese speakers." };
  return {
    slug: `${schoolSlug}-${row.degreeLevel.toLowerCase()}-${slugify(row.name)}-${slugify(row.teachingLanguage)}-${slugify(String(row.catalogId))}`,
    schoolSlug,
    citySlug: "tianjin",
    nameEn: row.name,
    degreeLevel: row.degreeLevel,
    durationYears: row.durationYears,
    fieldCategory: row.school,
    subjectArea: row.school,
    teachingLanguage: row.teachingLanguage,
    ...languageRequirement,
    ...(subjects ? { cscaSubjects: subjects, displaySubjects: subjects, cscaRequirement: `Required 2027 CSCA subjects: ${subjects.join(", ")}. Test-paper language must match the program teaching language; the official exemption notes remain applicable.` } : { cscaRequirement: "No CSCA requirement is published for this graduate route." }),
    tuitionAmount: row.tuitionCnyPerYear,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: tuitionLabel(row),
    displayTuition: tuitionLabel(row),
    scholarshipText: "Tianjin University's current 2027 admissions pages and separately verified scholarship notices are reviewed together; route-specific scholarship dates remain authoritative.",
    applicationUrl: "https://tju.at0086.cn/student",
    applicationNote: `${row.school}; official catalog ID ${row.catalogId}; ${row.sourceLocator}. The official workbook's Chinese-text cells are corrupt, so this record uses the parallel English columns without inferred Chinese names.`,
    hasScholarship: true,
    badgeText: `Official ${row.degreeLevel.toLowerCase()} route`,
    displayGroup: row.degreeLevel,
    displayGroupLabel: `${row.degreeLevel} programs`,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${row.sourceLocator}, English major column`,
      degreeLevel: `${row.sourceLocator}, English degree-level column`,
      fieldCategory: `${row.sourceLocator}, English school column`,
      teachingLanguage: `${row.sourceLocator}, English taught-language column`,
      durationYears: `${row.sourceLocator}, duration column`,
      tuitionAmount: `${row.sourceLocator}, tuition column`,
      applicationNote: `${row.sourceLocator}, catalog ID and school columns`,
      ...(subjects ? { cscaSubjects: "official 2027 CSCA PDF, school/program-level subject table and exemption notes" } : {}),
    },
  };
});
if (programs.length !== 324 || new Set(programs.map((row) => row.slug)).size !== 324) throw new Error("TJU program routes/slugs mismatch.");

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string) => ({ label, included: true });
const commonMaterials = [info("Passport information page"), info("Highest diploma or expected-graduation proof"), info("Academic transcripts"), info("Language qualification certificate"), info("Study or research plan"), info("Foreigner Physical Examination Form"), info("Non-criminal record certificate")];
function scholarship(sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship {
  const source = requiredEvidence(sourceId);
  return {
    schoolSlug,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    providerLocation: "China",
    targetCountries: [],
    targetRegions: [],
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "TJU international student application system", url: "https://tju.at0086.cn/student", kind: "official-application" }],
    sourceFieldLineage: { title: "official notice title", fundingLevel: "official coverage/standard section", coverage: "official coverage/standard section", amountText: "official coverage/standard section", applicableDegree: "official supporting categories section", applicableProgram: "official program section", eligibilityItems: "official eligibility section", applicationMaterials: "official application-materials section", applicationSteps: "official application procedure section", deadlineDate: "official deadline section" },
    ...value,
  };
}
const scholarships: CatalogSeedScholarship[] = [
  scholarship("tju-cgs-high-level-postgraduate-2026", { slug: "official-2026-tju-cgs-high-level-postgraduate", title: "Tianjin University 2026 Chinese Government Scholarship - High Level Postgraduate Program", nameZh: "天津大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full", coverage: "Tuition waiver, on-campus accommodation, monthly stipend and comprehensive medical insurance", applicableDegree: "Master, Doctoral", applicableProgram: "All eligible Tianjin University master's and doctoral programs", amountText: "CNY 3,000/month for master's students and CNY 3,500/month for doctoral students, plus tuition waiver, on-campus accommodation and medical insurance.", deadlineDate: "2026-02-18", deadlineLabel: "February 18, 2026", applicationRound: "2026 CGS High Level Postgraduate Program", benefitItems: [benefit("Tuition waiver"), benefit("On-campus accommodation"), benefit("CNY 3,000/month master's stipend"), benefit("CNY 3,500/month doctoral stipend"), benefit("Comprehensive medical insurance")], eligibilityItems: [info("Nationality", "Non-Chinese citizen with a valid passport"), info("Master", "Bachelor's diploma and under 35"), info("Doctoral", "Master's diploma and under 40"), info("Language", "Chinese route HSK 5/180; English route IELTS 6.0 or TOEFL 80, subject to stated exemptions"), info("Concurrent funding", "May not receive another Chinese-government or host-university scholarship")], applicationMaterials: [...commonMaterials, info("CSC application form"), info("Two academic recommendation letters"), info("Published paper or formal acceptance notification for doctoral applicants")], applicationSteps: [info("Step 1", "Apply in CSC as Type B using TJU agency number 10056"), info("Step 2", "Apply in the TJU system and upload the signed scholarship form"), info("Step 3", "Complete TJU review and interview"), info("Step 4", "Await CSC final review and official result")], summary: "TJU's 2026 full Chinese Government Scholarship Type B route for eligible master's and doctoral applicants.", sortOrder: 10 }),
  scholarship("tju-youth-of-excellence-2026", { slug: "official-2026-tju-youth-of-excellence", title: "Tianjin University 2026 Youth of Excellence Scheme of China Program", nameZh: "天津大学2026年中国政府奖学金青年精英项目", type: "government", typeLabel: "Youth of Excellence Scheme of China Program", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Full Chinese Government Scholarship; the TJU notice does not restate fixed benefit amounts", applicableDegree: "Master", applicableProgram: "Civil Engineering, Chemical Engineering and Business Administration; English-taught 1+1 model", amountText: "Full scholarship; fixed tuition, stipend, accommodation and insurance amounts are not restated on the reviewed TJU notice.", deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026 at 23:59 Beijing time", applicationRound: "2026 Youth of Excellence Scheme", benefitItems: [benefit("Full Chinese Government Scholarship")], eligibilityItems: [info("Age and nationality", "Non-Chinese citizen under 45 and in good health"), info("Education and experience", "Bachelor's degree or above and at least three years of work experience"), info("Professional category", "Eligible government official, senior manager, university/research administrator, or applicant with international-organization experience"), info("Pre-admission", "Must meet TJU master's admission requirements and obtain a TJU pre-admission letter")], applicationMaterials: commonMaterials, applicationSteps: [info("Step 1", "Obtain TJU pre-admission through the TJU system"), info("Step 2", "Apply in the CSC system as Type A, agency code 1563"), info("Step 3", "Await CSC preliminary and expert review")], summary: "A full 2026 English-taught master's scholarship using a 1+1 study/work-country model across three named TJU programs.", sortOrder: 20 }),
  scholarship("tju-peiyang-future-scholar-2026", { slug: "official-2026-tju-peiyang-future-scholar", title: "Tianjin University 2026 Peiyang Future Scholar Scholarship", nameZh: "天津大学2026年北洋未来学者奖学金", type: "university", typeLabel: "Peiyang Future Scholar Scholarship", providerName: "天津大学", providerNameEn: "Tianjin University", fundingLevel: "Full", coverage: "CNY 38,000 annual tuition subsidy, CNY 3,500 monthly living allowance and free on-campus accommodation", applicableDegree: "Doctoral", applicableProgram: "All Tianjin University doctoral programs", amountText: "Tuition subsidy CNY 38,000 per academic year; living allowance CNY 3,500/month; free on-campus accommodation.", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 Peiyang Future Scholar", benefitItems: [benefit("CNY 38,000/year tuition subsidy"), benefit("CNY 3,500/month living allowance"), benefit("Free on-campus accommodation")], eligibilityItems: [info("Nationality", "Non-Chinese citizen with a valid passport"), info("Degree and age", "Master's diploma and under 40"), info("Language", "Chinese route HSK 5/180; English route IELTS 6.0 or TOEFL 80, subject to stated exemptions"), info("Annual review", "Renewal is subject to annual review")], applicationMaterials: [...commonMaterials, info("TJU supervisor acceptance letter where obtained"), info("Two recommendation letters")], applicationSteps: [info("Step 1", "Apply through the TJU online system"), info("Step 2", "Upload the required admission and scholarship documents"), info("Step 3", "Complete review and annual renewal assessment after award")], summary: "TJU's 2026 full doctoral scholarship with a published tuition subsidy, stipend and accommodation package.", sortOrder: 30 }),
  scholarship("tju-silk-road-scholarship-2026", { slug: "official-2026-tju-silk-road-scholarship", title: "Tianjin University 2026 Chinese Government Scholarship - Silk Road Program", nameZh: "天津大学2026年中国政府奖学金丝绸之路项目", type: "government", typeLabel: "Chinese Government Scholarship - Silk Road Program", providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full", coverage: "Tuition waiver, on-campus accommodation, monthly stipend and comprehensive medical insurance", applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "Programs listed or finally confirmed by Tianjin University for the 2026 Silk Road intake", amountText: "CNY 2,500/month bachelor's stipend, CNY 3,000/month master's stipend and CNY 3,500/month doctoral stipend, plus tuition, on-campus accommodation and medical insurance.", deadlineDate: "2026-05-18", deadlineLabel: "May 18, 2026", applicationRound: "2026 Silk Road Program", targetCountries: ["Malaysia", "Indonesia", "Thailand", "Cambodia", "Pakistan", "Nepal", "Bangladesh", "Russia", "Nigeria", "Morocco"], benefitItems: [benefit("Tuition waiver"), benefit("On-campus accommodation"), benefit("CNY 2,500/month bachelor's stipend"), benefit("CNY 3,000/month master's stipend"), benefit("CNY 3,500/month doctoral stipend"), benefit("Comprehensive medical insurance")], eligibilityItems: [info("Countries", "Malaysia, Indonesia, Thailand, Cambodia, Pakistan, Nepal, Bangladesh, Russia, Nigeria or Morocco"), info("Age", "Under 25 for bachelor, under 35 for master, under 40 for doctoral"), info("Language", "Chinese route HSK 5/180; English route IELTS 6.0 or TOEFL 80, subject to stated exemptions"), info("CSCA", "Required for undergraduate applicants")], applicationMaterials: [...commonMaterials, info("CSCA transcript for undergraduate applicants"), info("CSC scholarship form"), info("Recommendation letters for graduate applicants")], applicationSteps: [info("Step 1", "Apply in the TJU system"), info("Step 2", "TJU reviews and nominates candidates"), info("Step 3", "Nominees apply in CSC as Type B using TJU agency number 10056")], summary: "TJU's 2026 full Silk Road scholarship for published countries and eligible bachelor, master and doctoral routes.", sortOrder: 40 }),
  scholarship("tju-international-chinese-language-teachers-2026", { slug: "official-2026-tju-international-chinese-language-teachers", title: "Tianjin University 2026 International Chinese Language Teachers Scholarship", nameZh: "天津大学2026年国际中文教师奖学金", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", fundingLevel: "Full", coverage: "On-campus routes cover tuition, accommodation, living allowance except the four-week route, and comprehensive medical insurance; online routes cover tuition only", applicableDegree: "Bachelor, Master, Non-degree", applicableProgram: "International Chinese language education, Chinese language and literature, Chinese language study, Taiji culture, four-week group study, joint and online programs", amountText: "CNY 3,000/month for International Chinese Language Education master's students and CNY 2,500/month for undergraduates, one-year and one-semester students; online programs support tuition only.", deadlineDate: "2026-05-15", deadlineLabel: "Degree and main autumn routes: May 15, 2026; other semester and short-term deadlines vary through October 31, 2026", applicationRound: "2026 International Chinese Language Teachers Scholarship", benefitItems: [benefit("Tuition"), benefit("Accommodation for eligible on-campus routes"), benefit("CNY 3,000/month master's living allowance"), benefit("CNY 2,500/month eligible undergraduate/non-degree living allowance"), benefit("Comprehensive medical insurance for eligible on-campus routes")], eligibilityItems: [info("Nationality and age", "Non-Chinese citizen, normally age 18-35; in-service teachers may be up to 45 and bachelor's applicants normally under 25"), info("Purpose", "Interested in Chinese language education and related work"), info("Language", "Route-specific HSK and HSKK thresholds apply")], applicationMaterials: [info("Passport photo page"), info("Valid HSK/HSKK score reports"), info("Recommendation from the recommending institution"), info("Highest diploma or expected-graduation proof and transcript"), info("Non-criminal record"), info("Physical examination for study longer than one year")], applicationSteps: [info("Step 1", "Apply through the official scholarship system and TJU system"), info("Step 2", "Submit route-specific documents before the applicable deadline"), info("Step 3", "Await CLEC expert review and TJU admission confirmation")], summary: "TJU's 2026 route-specific Chinese-language-teacher scholarship covering degree, non-degree, joint and online study options.", sortOrder: 50 }),
  scholarship("tju-growth-steel-indonesia-2026", { slug: "official-2026-tju-growth-steel-indonesia", title: "Tianjin University 2026 Growth Steel Group Indonesia Scholarship", nameZh: "天津大学2026年 Growth Steel Group 印尼奖学金", type: "other", typeLabel: "Growth Steel Group Indonesia Scholarship", providerName: "Growth Steel Group / 天津大学", providerNameEn: "Growth Steel Group / Tianjin University", fundingLevel: "Partial", coverage: "One-year tiered tuition subsidies; top undergraduate and master's tiers also include published living allowances, and the master's first prize includes medical insurance", applicableDegree: "Bachelor, Master", applicableProgram: "Eligible Tianjin University bachelor's and master's programs for Indonesian citizens", amountText: "Bachelor tiers: CNY 20,000 tuition plus CNY 1,400/month for 10 months, or tuition subsidies of CNY 20,000/10,000/6,000. Master's first prize: CNY 30,000 tuition, CNY 1,700/month for 10 months and CNY 800 insurance; second prize: CNY 30,000 tuition.", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 Growth Steel Group Indonesia Scholarship", targetCountries: ["Indonesia"], benefitItems: [benefit("Tiered tuition subsidy"), benefit("Living allowance for top published tiers"), benefit("CNY 800 medical insurance for master's first prize")], eligibilityItems: [info("Nationality", "Citizen of Indonesia with a valid passport"), info("Bachelor", "High-school diploma and under 25"), info("Master", "Bachelor's diploma and under 35"), info("Language", "Chinese route HSK 5/180, with HSK 4/180 for School of International Education undergraduate routes; English route IELTS 6.0 or TOEFL 80, subject to stated exemptions"), info("CSCA", "Required for undergraduate applicants")], applicationMaterials: [...commonMaterials, info("CSCA transcript for undergraduate applicants"), info("Financial evidence and route-specific attachments")], applicationSteps: [info("Step 1", "Apply through the TJU system"), info("Step 2", "Upload all admission and scholarship materials"), info("Step 3", "Await the tier and award stated in the admission notice")], summary: "A one-year tiered 2026 scholarship for eligible Indonesian bachelor and master applicants at TJU.", sortOrder: 60 }),
];

const schoolSource = requiredEvidence("tju-undergraduate-admissions-2027");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifests[0].generatedAt,
  cities: [{ slug: "tianjin", nameEn: "Tianjin", nameZh: "天津", region: "North China", status: "draft", sourceUrl: schoolSource.url, sourceLabel: schoolSource.label, sourceSha256: schoolSource.sha256, capturedAt: schoolSource.fetchedAt, sourceFieldLineage: { nameEn: "official TJU admissions contact address", nameZh: "normalized Chinese city name", region: "normalized geographic region from official Tianjin address" } }],
  schools: [{ slug: schoolSlug, nameEn: "Tianjin University", nameZh: "天津大学", citySlug: "tianjin", schoolType: "public", region: "Tianjin, North China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English depending on route", languageRequirement: "Chinese-taught routes require HSK; English-taught routes require IELTS, TOEFL or a stated exemption. Route-specific standards apply.", hskRequirement: "Undergraduate: HSK Level 5 score 180, or HSK Level 4 score 180 for School of International Education. Graduate: HSK Level 5 score 180, subject to stated exemptions.", englishRequirement: "IELTS 6.0 or TOEFL 80; 2027 master's routes also accept Duolingo 110. English MBA requires IELTS 6.5 or TOEFL 85, GPA above 3.2/4.0 and one year of relevant experience.", deadlineSummary: "2027 undergraduate, master's and doctoral applications close May 31, 2027; undergraduate scholarship applicants are requested to apply by April 1, 2027.", tuitionSummary: "Official 2027 tuition varies by route: undergraduate RMB 20,000-130,000/year; master's general and architecture routes RMB 30,000-39,000/year, with separately published Fuzhou, Hainan and Shenzhen schedules up to RMB 150,000/year; doctoral RMB 38,000 generally and RMB 39,000 for architecture.", applicationFee: "RMB 500", websiteUrl: "https://www.tju.edu.cn/english/index.htm", admissionsUrl: "https://sie.tju.edu.cn/en/", cscaRequired: true, cscaRequirement: "All 2027 international undergraduate applicants must submit CSCA results in school- or program-specific subjects. Test-paper language must match the teaching language; English-taught routes do not take Professional Chinese and the published HSK exemption remains applicable.", cscaSubjects: ["Chinese for Arts or Science where applicable", "Mathematics", "Physics and/or Chemistry by school/program"], subjectTags: [...new Set(programs.map((row) => row.fieldCategory).filter(Boolean))] as string[], languageTags: ["Chinese", "English"], tuitionBandLabel: "RMB 20,000-150,000/year, with route-specific multi-year schedules", campusHighlights: ["324 official 2027 international degree routes", "80 undergraduate, 119 master's and 125 doctoral routes", "105 English-taught routes", "School- and program-specific CSCA mapping", "Current admissions plus independently verified scholarship records"], status: "draft", sourceUrl: schoolSource.url, sourceLabel: schoolSource.label, sourceSha256: schoolSource.sha256, capturedAt: schoolSource.fetchedAt, sourceFieldLineage: { nameEn: "official 2027 admissions pages", citySlug: "official contact address", applicationLevel: "three official 2027 degree guides", languageRequirement: "official qualification sections", deadlineSummary: "official 2027 application schedules", tuitionSummary: "official 2027 program catalogs and fee sections", applicationFee: "official 2027 fee sections", cscaRequirement: "official 2027 undergraduate guide and CSCA PDF" } }],
  programs,
  programIntakes: programs.map((program) => {
    const source = admissionsByDegree[program.degreeLevel!];
    const deadline = "2027-05-31T00:00:00.000Z";
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2027, deadlineDate: deadline, deadlineLabel: "Application deadline: May 31, 2027", applicationRound: "2027 international degree intake", status: "open" as const, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: "official 2027 degree guide application schedule; date-only value normalized to ISO UTC" } };
  }),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`TJU candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = sha(candidateText);
const legacyProgramSlugs = ["tianjin-university-biological-engineering", "tianjin-university-biomedical-engineering", "tianjin-university-chemical-engineering-and-technology", "tianjin-university-chemical-engineering-and-technology-english", "tianjin-university-chinese-language-and-literature", "tianjin-university-environmental-engineering-english", "tianjin-university-fine-chemical-engineering", "tianjin-university-food-science-and-engineering", "tianjin-university-intelligent-medical-engineering", "tianjin-university-pharmaceutical-engineering", "tianjin-university-pharmaceutical-science-english", "tianjin-university-process-equipment-and-control-engineering", "tianjin-university-synthetic-biology"];
const legacyScholarshipSlugs = ["tianjin-university", "tianjin-university-54", "tianjin-university-55", "tianjin-university-56"];
const reviewBase = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug, cityOverwriteCount: 1, schoolOverwriteCount: 1, programRouteCount: 324, undergraduateRouteCount: 80, masterRouteCount: 119, doctoralRouteCount: 125, programIntakeCount: 324, scholarshipCount: 6, newScholarshipCount: 5, stableScholarshipUpdateCount: 1, archiveProgramAliasCount: 13, archiveScholarshipAliasCount: 4 },
  candidateSha256,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map((row) => ({ sourceId: row.id, sourceUrl: row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", workbookRowsReviewed: 324, workbookStructure: "pass", cscaPdfPagesReviewed: 3, note: "All three official 2027 workbooks were read without modification; sheet dimensions, required columns, every row and published counts were checked. All three 2027 CSCA PDF pages were rendered and visually reviewed." },
  reconciliation: { destructiveDeletion: false, cityOverwrite: { slug: "tianjin", previousSource: "unverified third-party source", replacementSource: "verified TJU official source" }, schoolOverwrite: { slug: schoolSlug, previousSource: "unverified third-party source", replacementSource: "verified TJU official source" }, stableScholarshipUpdateSlugs: ["official-2026-tju-silk-road-scholarship"], legacyProgramAliasesToArchive: legacyProgramSlugs, legacyScholarshipAliasesToArchive: legacyScholarshipSlugs },
  sourceQualityNotes: [{ field: "Chinese labels in official XLS workbooks", finding: "The source workbooks contain corrupt Chinese-text cells while the parallel English columns are intact.", decision: "Use only the official English columns and official IDs; do not infer Chinese program names." }, { field: "Multi-year tuition cells", finding: "Two Fuzhou master's routes publish RMB 150,000 for Year 1 and RMB 30,000 for Years 2-3; one Hainan route publishes RMB 276,000 for three years.", decision: "Preserve the full official schedule in tuitionText; use RMB 150,000 as the first-year amount and RMB 92,000 as the stated three-year total's annual equivalent for filtering." }, { field: "Silk Road eligible majors", finding: "The official 2026 notice presents the program catalogue as an image and says final majors remain subject to confirmation.", decision: "Retain the scholarship's degree/category scope without inventing a definitive major list." }],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, admissions and scholarship information is included. Applicant records, private files, personal contact details, account data and payment data are absent." },
  reviewNotes: ["The official site replaced the withdrawn 2026 degree pages with current 2027 admissions and program catalogs; the draft therefore keeps 2026 scholarship notices but upgrades all degree routes and intakes to 2027.", "The 13 legacy programs and four third-party scholarship aliases are proposed for archival, not deletion.", "The existing verified Silk Road slug is updated in place from the reviewed 2026 English official notice.", "The batch replaces the unverified third-party Tianjin city and Tianjin University source metadata.", "Standing default publication does not cover these reconciliations; exact approval is required."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `product-owner-approved-tju-complete-batch-01-${reviewHash}` };
await Promise.all([
  writeFile(paths.draft, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, candidateBundleSha256: validation.bundleSha256, reviewHash, publicationReference: review.publicationReference, paths }, null, 2));
