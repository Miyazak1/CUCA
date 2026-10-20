import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
type GraduateRow = [college: string, nameZh: string, nameEn: string, durationYears: number, language: "Chinese" | "English", tuition: number, campus: string, cgsEligible: boolean, sgsEligible: boolean, ictEligible?: boolean];

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-20.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-20.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-20.review.json");
const expected: Record<string, string> = {
  "dhu-international-chinese-language-teachers-scholarship-spring-2027": "d78d6ab6e42b41ec86d9fe145049548ac76b64053e6d8bbefd4fd1ad913c5b41",
  "shisu-chinese-government-scholarship-type-b-2027": "02c6920ec8e4a40f7c5f02b9b1a1e27daf83799b07761d7d6c3956f37235a45c",
  "shisu-china-link-scholarship-2026-2027": "c7cdce22f14c6e5b170007c860279af133b786635aa81dfb1dae3476628cc66c",
  "uibe-international-chinese-language-teachers-scholarship-spring-2027": "a8428bf0c0ef3f0ed055fc79c7647ef5266b0961eadad2c22e07ac67c9c47225",
  "shisu-graduate-program-catalog-xls-2027": "9f84db28221cd47ead6d6c275af9f30ee505443ce38eae9d7e43b3b7e3b388c0",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 20 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const schoolSlugs = ["donghua-university", "shanghai-international-studies-university", "university-of-international-business-and-economics"];
const baseSchools = new Map((base.schools ?? []).filter((row) => schoolSlugs.includes(row.slug)).map((row) => [row.slug, row]));
const cityMap = new Map((base.cities ?? []).filter((row) => ["shanghai", "beijing"].includes(row.slug)).map((row) => [row.slug, row]));
if (baseSchools.size !== 3 || cityMap.size !== 2) throw new Error("Wave 20 school or city dependencies are missing from the reviewed 100-school release.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;

const dhuSchool = {
  ...baseSchools.get("donghua-university")!,
  deadlineSummary: "The official scholarship page publishes an October 31, 2026 application deadline for the March 2027 one-semester Chinese-language route. It does not establish general Fall 2027 degree deadlines.",
  verificationStatus: "verified" as const,
  lastVerifiedAt: verifiedAt,
  ...fields("dhu-international-chinese-language-teachers-scholarship-spring-2027"),
  sourceFieldLineage: { ...(baseSchools.get("donghua-university")!.sourceFieldLineage ?? {}), deadlineSummary: "official March 2027 scholarship deadline" },
};
const shisuSchool = {
  ...baseSchools.get("shanghai-international-studies-university")!,
  applicationLevel: "Master; Doctoral; Non-degree research exchange",
  languageOfInstruction: "Chinese or English, depending on program",
  languageRequirement: "Chinese-taught graduate programs require HSK Level 5 with at least 180. English-taught graduate programs require IELTS 6.0 or TOEFL iBT 80 or above.",
  deadlineSummary: "2027 graduate self-funded applications close April 30, 2027. The Chinese Government Scholarship Type B deadline is November 22, 2026; Shanghai Government Scholarship applications close March 31, 2027. China Link applicants should contact SISU at least three months before their proposed start, which must be no later than August 31, 2027.",
  tuitionSummary: "2027 graduate tuition ranges from CNY 23,000 to CNY 104,000 per academic year for master's programs and is CNY 28,000 per academic year for doctoral programs.",
  verificationStatus: "verified" as const,
  lastVerifiedAt: verifiedAt,
  ...fields("shisu-chinese-government-scholarship-type-b-2027"),
  sourceFieldLineage: { ...(baseSchools.get("shanghai-international-studies-university")!.sourceFieldLineage ?? {}), applicationLevel: "official 2027 graduate catalog and China Link page", languageOfInstruction: "official 2027 graduate catalog", languageRequirement: "official 2027 graduate catalog and Type B guide", deadlineSummary: "official 2027 graduate catalog, Type B guide and China Link page", tuitionSummary: "official 2027 graduate catalog" },
};
const uibeSchool = {
  ...baseSchools.get("university-of-international-business-and-economics")!,
  deadlineSummary: "The official scholarship page publishes an October 31, 2026 student deadline and November 10 host-institution review deadline for the March 2027 one-semester route. The category paragraph contains a conflicting March 2026 reference, retained as a review note rather than silently corrected.",
  verificationStatus: "verified" as const,
  lastVerifiedAt: verifiedAt,
  ...fields("uibe-international-chinese-language-teachers-scholarship-spring-2027"),
  sourceFieldLineage: { ...(baseSchools.get("university-of-international-business-and-economics")!.sourceFieldLineage ?? {}), deadlineSummary: "official deadline section and documented internal year conflict" },
};

const masters: GraduateRow[] = [
  ["Shanghai Academy of Global Governance and Area Studies", "区域国别学", "Area Studies", 3, "Chinese", 23000, "Songjiang", true, true],
  ["Institute of Linguistic Studies", "语言政策与语言教育", "Language Policy and Language Education", 3, "Chinese", 23000, "Songjiang", true, true],
  ["Institute of Linguistic Studies", "语言数据科学与应用", "Language Data Science and Applications", 3, "Chinese", 23000, "Songjiang", true, true],
  ["Institute of Linguistic Studies", "英语笔译", "English Translation", 3, "Chinese", 30000, "Songjiang", true, false],
  ["Institute of Linguistic Studies", "神经与临床语言学", "Neurolinguistics and Clinical Linguistics", 3, "Chinese", 23000, "Songjiang", true, true],
  ["Institute of Linguistic Studies", "外国语言学及应用语言学", "Foreign Linguistics and Applied Linguistics", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Economics and Finance", "金融学", "Finance", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Economics and Finance", "国际贸易学", "International Trade", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Economics and Finance", "统计学", "Statistics", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Economics and Finance", "涉外经济法学", "Foreign-Related Economic Law", 3, "Chinese", 23000, "Songjiang", false, true],
  ["School of Economics and Finance", "金融学", "Finance", 2, "English", 26000, "Songjiang", true, true],
  ["School of Economics and Finance", "金融", "Finance (Professional Degree)", 2, "Chinese", 94000, "Songjiang", true, false],
  ["School of Economics and Finance", "国际商务", "International Business", 2, "Chinese", 89500, "Songjiang", true, false],
  ["School of Economics and Finance", "数字经济", "Digital Economy", 2, "Chinese", 104000, "Songjiang", false, false],
  ["School of International Relations and Public Affairs", "政治学理论", "Political Theory", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "国际政治", "International Politics", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "国际关系", "International Relations", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "国际关系", "International Relations", 2, "English", 26000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "外交学", "Diplomacy", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "国际组织与涉外法制", "International Organizations and Foreign-Related Legal Systems", 3, "Chinese", 23000, "Songjiang", false, true],
  ["School of International Relations and Public Affairs", "中国学", "China Studies", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "中国学", "China Studies", 2, "English", 26000, "Hongkou", true, true],
  ["School of International Relations and Public Affairs", "比较政治与区域国别", "Comparative Politics and Area Studies", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Marxism", "马克思主义理论", "Marxist Theory", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Chinese Studies and Exchange", "语言学及应用语言学", "Linguistics and Applied Linguistics", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Chinese Studies and Exchange", "汉语言文字学", "Chinese Linguistics and Philology", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Chinese Studies and Exchange", "中国现当代文学", "Modern and Contemporary Chinese Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Chinese Studies and Exchange", "国际中文教育", "International Chinese Language Education", 3, "Chinese", 26000, "Hongkou", true, false, true],
  ["School of Chinese Studies and Exchange", "中国古代文学", "Classical Chinese Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["Institute of Literary Studies", "比较文学与世界文学", "Comparative Literature and World Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of English Studies", "英语语言文学", "English Language and Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of English Studies", "英语笔译", "English Translation", 3, "Chinese", 30000, "Songjiang", true, false],
  ["School of English Studies", "跨文化交际", "Cross-Cultural Studies", 2, "English", 26000, "Songjiang", true, true],
  ["School of Russian and Eurasian Studies", "俄语语言文学", "Russian Language and Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Japanese Studies", "日语语言文学", "Japanese Language and Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of European and Latin American Studies", "法语语言文学", "French Language and Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of European and Latin American Studies", "西班牙语语言文学", "Spanish Language and Literature", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of European and Latin American Studies", "西班牙语笔译", "Spanish Translation", 3, "Chinese", 31000, "Songjiang", true, false],
  ["School of European and Latin American Studies", "德语笔译", "German Translation", 3, "Chinese", 31000, "Songjiang", true, false],
  ["School of European and Latin American Studies", "欧洲语言文学", "European Languages and Literatures", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Asian and African Studies", "亚非语言文学(泰国语言文化、希伯来文化)", "Asian and African Languages and Literatures (Thai and Hebrew Studies)", 3, "Chinese", 23000, "Songjiang", false, true],
  ["Graduate Institute of Interpretation and Translation", "翻译学", "Translation Studies", 3, "Chinese", 23000, "Songjiang", true, true],
  ["Graduate Institute of Interpretation and Translation", "英语笔译", "English Translation", 2, "Chinese", 37500, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "英语口译", "English Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "俄语口译", "Russian Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "日语口译", "Japanese Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "法语口译", "French Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "德语口译", "German Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "朝鲜语口译", "Korean Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "西班牙语口译", "Spanish Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["Graduate Institute of Interpretation and Translation", "阿拉伯语口译", "Arabic Interpreting", 2, "Chinese", 50000, "Songjiang", true, false],
  ["School of Journalism and Communication", "新闻学", "Journalism", 2, "English", 26000, "Songjiang", true, true],
  ["School of Journalism and Communication", "传播学", "Communication", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Journalism and Communication", "广告学", "Advertising", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Journalism and Communication", "新闻与传播", "Journalism and Communication", 2, "Chinese", 60000, "Songjiang", true, false],
  ["School of Journalism and Communication", "全球传播", "Global Communication", 2, "English", 26000, "Songjiang", true, true],
  ["School of Education", "课程与教学论", "Curriculum and Instruction", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Education", "比较教育学", "Comparative Education", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Education", "比较教育学", "Studies of Comparative Education", 2, "English", 26000, "Songjiang", true, true],
  ["School of Education", "外语教育学", "Foreign Language Education", 3, "Chinese", 23000, "Songjiang", false, true],
  ["School of Education", "教育技术学", "Educational Technology", 3, "Chinese", 23000, "Songjiang", true, true],
  ["School of Law", "法律（法学）", "Juris Master (Law)", 2, "Chinese", 40000, "Songjiang", true, false],
  ["School of Law", "法律（非法学）", "Juris Master (Non-Law)", 3, "Chinese", 35000, "Songjiang", true, false],
  ["Department of Physical Education", "体育教育学", "Physical Education", 3, "Chinese", 23000, "Songjiang", true, true],
];

const doctorates: GraduateRow[] = [
  ["Shanghai Academy of Global Governance and Area Studies", "区域国别学", "Area Studies", 4, "Chinese", 28000, "Songjiang", true, true],
  ["Institute of Corpus Studies", "语言数据科学与应用", "Language Data Science and Applications", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of English Studies", "英语语言文学", "English Language and Literature", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Russian and Eurasian Studies", "俄语语言文学", "Russian Language and Literature", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Japanese Studies", "日语语言文学", "Japanese Language and Literature", 4, "Chinese", 28000, "Songjiang", true, true],
  ["Department of French", "法语语言文学", "French Language and Literature", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Asian and African Studies", "阿拉伯语语言文学", "Arabic Language and Literature", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Asian and African Studies", "亚非语言文学（朝鲜语除外）", "Asian and African Languages and Literatures (excluding Korean)", 4, "Chinese", 28000, "Songjiang", false, true],
  ["Institute of Linguistic Studies", "外国语言学及应用语言学", "Foreign Linguistics and Applied Linguistics", 4, "Chinese", 28000, "Songjiang", true, true],
  ["Institute of Linguistic Studies", "语言政策与语言教育", "Language Policy and Language Education", 4, "Chinese", 28000, "Songjiang", true, true],
  ["Institute of Linguistic Studies", "神经与临床语言学", "Neurolinguistics and Clinical Linguistics", 4, "Chinese", 28000, "Songjiang", true, true],
  ["Graduate Institute of Interpretation and Translation", "翻译学", "Translation Studies", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Chinese Studies and Exchange", "汉语国际教育", "Teaching Chinese to Speakers of Other Languages", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Chinese Studies and Exchange", "国际中文教育", "International Chinese Language Education", 4, "Chinese", 28000, "Songjiang", true, false, true],
  ["Institute of Literary Studies", "比较文学与跨文化研究", "Comparative Literature and Cross-Cultural Studies", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Journalism and Communication", "全球传播", "Global Communication", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of Journalism and Communication", "全球传播", "Global Communication", 4, "English", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "国际关系", "International Relations", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "政治学理论", "Political Theory", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "国际政治", "International Politics", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "外交学", "Diplomacy", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "中东研究", "Middle East Studies", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "中国学", "China Studies", 4, "Chinese", 28000, "Songjiang", true, true],
  ["School of International Relations and Public Affairs", "中国学", "China Studies", 4, "English", 28000, "Hongkou", true, true],
  ["School of International Relations and Public Affairs", "比较政治与区域国别", "Comparative Politics and Area Studies", 4, "Chinese", 28000, "Songjiang", true, true],
];
if (masters.length !== 64 || doctorates.length !== 25) throw new Error(`Expected 64 master's and 25 doctoral rows from the locked XLS, found ${masters.length} and ${doctorates.length}.`);

const catalogFields = fields("shisu-graduate-program-catalog-xls-2027");
const graduatePrograms = [...masters.map((row, index) => ({ row, level: "Master", index: index + 1 })), ...doctorates.map((row, index) => ({ row, level: "Doctoral", index: index + 1 }))].map(({ row, level, index }): CatalogSeedProgram => {
  const [college, nameZh, nameEn, durationYears, teachingLanguage, tuitionAmount, campus, cgsEligible, sgsEligible, ictEligible] = row;
  const sequence = String(index).padStart(3, "0");
  const slug = `shanghai-international-studies-university-${level.toLowerCase()}-${sequence}-${teachingLanguage.toLowerCase()}-2027`;
  const scholarshipLabels = [cgsEligible ? "Chinese Government Scholarship" : "", sgsEligible ? "Shanghai Government Scholarship" : "", ictEligible ? "International Chinese Language Teachers Scholarship" : ""].filter(Boolean);
  return {
    slug,
    schoolSlug: shisuSchool.slug,
    citySlug: "shanghai",
    nameEn,
    nameZh,
    degreeLevel: level,
    durationYears,
    fieldCategory: "Graduate studies",
    subjectArea: `${college}; ${campus} Campus`,
    teachingLanguage,
    ...(teachingLanguage === "Chinese" ? { hskRequirement: "HSK Level 5 with at least 180." } : { englishRequirement: "IELTS 6.0 or TOEFL iBT 80 or above." }),
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")} per academic year`,
    scholarshipText: scholarshipLabels.length ? `The official 2027 catalog marks this program as eligible to apply for: ${scholarshipLabels.join(", ")}. Eligibility does not guarantee an award.` : "The official 2027 catalog does not mark this program as eligible for the listed government scholarship columns.",
    applicationUrl: "https://apply.shisu.edu.cn/",
    applicationNote: `Self-funded application deadline: April 30, 2027. ${cgsEligible ? "Chinese Government Scholarship Type B deadline: November 22, 2026. " : "This program is not marked eligible for Chinese Government Scholarship in the official table. "}${sgsEligible ? "Shanghai Government Scholarship deadline: March 31, 2027." : "This program is not marked eligible for Shanghai Government Scholarship in the official table."}`,
    hasScholarship: scholarshipLabels.length > 0,
    badgeText: "2027 graduate catalog",
    displayGroup: level,
    displayGroupLabel: `${level} programs`,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source("shisu-graduate-program-catalog-xls-2027").fetchedAt,
    ...catalogFields,
    sourceFieldLineage: { nameEn: "normalized English rendering of the official Chinese program name; official English names retained where published", nameZh: "official 2027 graduate catalog", degreeLevel: "official worksheet grouping", durationYears: "official 2027 graduate catalog", subjectArea: "official school and campus columns", teachingLanguage: "official 2027 graduate catalog", tuitionAmount: "official 2027 graduate catalog", scholarshipText: "official scholarship-eligibility columns", applicationNote: "official catalog deadlines" },
  };
});

const dhuProgram: CatalogSeedProgram = {
  slug: "donghua-university-chinese-language-one-semester-spring-2027",
  schoolSlug: dhuSchool.slug,
  citySlug: "shanghai",
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study (Spring 2027)",
  nameZh: "东华大学国际中文教师奖学金一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: "Chinese Language and Literature",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 with at least 180 and an HSKK score are required.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Applicants holding an X1 or X2 visa are not eligible. Apply through the International Chinese Language Teachers Scholarship system and provide the additional documents required by Donghua University.",
  hasScholarship: true,
  badgeText: "March 2027 scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("dhu-international-chinese-language-teachers-scholarship-spring-2027").fetchedAt,
  ...fields("dhu-international-chinese-language-teachers-scholarship-spring-2027"),
  sourceFieldLineage: { nameEn: "official route category and March 2027 commencement", durationMonths: "official maximum duration", hskRequirement: "official route qualifications", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official coverage section", applicationNote: "official eligibility and procedure" },
};
const uibeProgram: CatalogSeedProgram = {
  slug: "university-of-international-business-and-economics-chinese-study-one-semester-spring-2027",
  schoolSlug: uibeSchool.slug,
  citySlug: "beijing",
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Chinese Study (Spring 2027)",
  nameZh: "对外经济贸易大学国际中文教师奖学金一学期汉语研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: "Basic Chinese or Business Chinese",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 with at least 180 and an HSKK score are required.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance; approved off-campus recipients receive CNY 700/month accommodation allowance.",
  applicationUrl: "https://isa.uibe.edu.cn/en/student/register",
  applicationNote: "Apply through both the International Chinese Language Teachers Scholarship system and the UIBE application system. The category paragraph contains a March 2026 year reference that conflicts with the explicit March 2027 deadline section; this route follows the explicit March 2027 deadline branch and retains the conflict for review.",
  hasScholarship: true,
  badgeText: "March 2027 scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("uibe-international-chinese-language-teachers-scholarship-spring-2027").fetchedAt,
  ...fields("uibe-international-chinese-language-teachers-scholarship-spring-2027"),
  sourceFieldLineage: { nameEn: "official one-semester category and explicit March 2027 deadline section", durationMonths: "official category duration", subjectArea: "official route directions", hskRequirement: "official category qualifications", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official coverage section", applicationNote: "official application process and internal year conflict" },
};
const chinaLinkProgram: CatalogSeedProgram = {
  slug: "shanghai-international-studies-university-china-link-research-exchange-2027",
  schoolSlug: shisuSchool.slug,
  citySlug: "shanghai",
  nameEn: "Chinese Government Scholarship China Link Research and Exchange Program (2027)",
  nameZh: "上海外国语大学中国政府奖学金“高校短期科研交流项目”（2027年入境）",
  degreeLevel: "Non-degree",
  durationMonths: 12,
  fieldCategory: "Research exchange",
  subjectArea: "All academic majors except Chinese Language",
  teachingLanguage: "Chinese or English",
  hskRequirement: "No fixed HSK score is published for this China Link route; applicants must be able to work in the selected Chinese- or English-medium setting.",
  englishRequirement: "No fixed English-test score is published for this China Link route; applicants must be able to work in the selected Chinese- or English-medium setting.",
  tuitionText: "Tuition is fully covered by the China Link scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full scholarship with CNY 3,000/month for general scholars or CNY 3,500/month for senior scholars.",
  applicationUrl: "https://apply.shisu.edu.cn/c.asp?action=student_sign",
  applicationNote: "Applicants must be full-time students or faculty at a CSC overseas partner university, obtain SISU departmental approval and admission eligibility, and contact SISU at least three months before the proposed start date.",
  hasScholarship: true,
  badgeText: "Entry through August 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Research exchange",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("shisu-china-link-scholarship-2026-2027").fetchedAt,
  ...fields("shisu-china-link-scholarship-2026-2027"),
  sourceFieldLineage: { nameEn: "official program title and entry window", durationMonths: "official maximum duration", subjectArea: "official field restriction", teachingLanguage: "official language section", hskRequirement: "official guide publishes working languages but no fixed HSK threshold", englishRequirement: "official guide publishes working languages but no fixed English-test threshold", tuitionText: "official full-scholarship coverage", scholarshipText: "official coverage section", applicationNote: "official eligibility and process" },
};

const programs = [...graduatePrograms, dhuProgram, uibeProgram, chinaLinkProgram];
const graduateIntakes: CatalogSeedProgramIntake[] = graduatePrograms.map((program, index) => {
  const row = index < masters.length ? masters[index] : doctorates[index - masters.length];
  const cgsEligible = row[7];
  return {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineDate: "2027-04-30T00:00:00Z",
    deadlineLabel: `Self-funded application deadline: April 30, 2027.${cgsEligible ? " Chinese Government Scholarship Type B applications close November 22, 2026." : ""}`,
    applicationRound: cgsEligible ? "2027 self-funded and Chinese Government Scholarship Type B routes" : "2027 self-funded route",
    status: "open",
    ...catalogFields,
    sourceFieldLineage: { intakeTerm: "official September 2027 entry and worksheet title", intakeYear: "official 2027 worksheet title", deadlineDate: "official self-funded deadline column", deadlineLabel: "official catalog deadlines", applicationRound: "official scholarship eligibility column", status: "deadline compared with capturedAt" },
  };
});
const programIntakes: CatalogSeedProgramIntake[] = [
  ...graduateIntakes,
  { programSlug: dhuProgram.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-10-31T00:00:00Z", deadlineLabel: "Student application deadline: October 31, 2026 for March 2027 commencement. The page does not state a deadline time.", applicationRound: "March 2027 one-semester scholarship route", status: "open", ...fields("dhu-international-chinese-language-teachers-scholarship-spring-2027"), sourceFieldLineage: { intakeTerm: "official March 2027 commencement", intakeYear: "official March 2027 commencement", deadlineDate: "official deadline section", status: "deadline compared with capturedAt" } },
  { programSlug: uibeProgram.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-10-31T00:00:00Z", deadlineLabel: "Student application deadline: October 31, 2026; host-institution review deadline: November 10, 2026. The page does not state deadline times.", applicationRound: "March 2027 one-semester scholarship route", status: "open", ...fields("uibe-international-chinese-language-teachers-scholarship-spring-2027"), sourceFieldLineage: { intakeTerm: "explicit March 2027 deadline section", intakeYear: "explicit March 2027 deadline section", deadlineDate: "official deadline section", deadlineLabel: "official deadline section", status: "deadline compared with capturedAt" } },
  { programSlug: chinaLinkProgram.slug, intakeTerm: "Rolling", intakeYear: 2027, deadlineLabel: "The proposed start must be no later than August 31, 2027, and applicants must contact SISU at least three months before the proposed start. The university does not publish one fixed calendar deadline.", applicationRound: "Rolling 2026-2027 China Link route", status: "open", ...fields("shisu-china-link-scholarship-2026-2027"), sourceFieldLineage: { intakeTerm: "rolling 1-12 month route", intakeYear: "latest official entry date", deadlineLabel: "official entry limit and relative lead time", status: "relative deadline remains actionable at capturedAt" } },
];

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "donghua-university-international-chinese-language-teachers-scholarship-spring-2027",
    title: "Donghua University International Chinese Language Teachers Scholarship - Spring 2027",
    nameZh: "东华大学国际中文教师奖学金（2027年春季）",
    type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心 / 东华大学", providerNameEn: "Center for Language Education and Cooperation / Donghua University", schoolSlug: dhuSchool.slug, programSlug: dhuProgram.slug,
    fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Non-degree", applicableProgram: "March 2027 one-semester Chinese Language and Literature route", amountText: "CNY 2,500/month living allowance; four-week students are excluded from this allowance.", deadlineDate: "2026-10-31", deadlineLabel: "October 31, 2026 for March 2027 commencement", applicationRound: "March 2027", requirementText: "HSK Level 3 with at least 180 and an HSKK score; X1/X2 visa holders are ineligible.",
    benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true }, { label: "Living allowance", included: true, note: "CNY 2,500/month" }, { label: "Comprehensive medical insurance", included: true }],
    applicationMaterials: [{ label: "Passport photo page" }, { label: "Valid HSK and HSKK score reports" }, { label: "Reference letter from the recommending institution" }, { label: "Additional documents required by Donghua University" }],
    actionLinks: [{ label: "Official Donghua source", url: source("dhu-international-chinese-language-teachers-scholarship-spring-2027").url, kind: "official-source" }, { label: "Scholarship application system", url: "https://www.chinese.cn/", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("dhu-international-chinese-language-teachers-scholarship-spring-2027"),
    sourceFieldLineage: { title: "official scholarship page and commencement", fundingLevel: "official coverage section", coverage: "official coverage section", deadlineDate: "official deadline section", requirementText: "official route qualifications", applicationMaterials: "official application documents section" },
  },
  {
    slug: "university-of-international-business-and-economics-international-chinese-language-teachers-scholarship-spring-2027",
    title: "UIBE International Chinese Language Teachers Scholarship - Spring 2027",
    nameZh: "对外经济贸易大学国际中文教师奖学金（2027年春季）",
    type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心 / 对外经济贸易大学", providerNameEn: "Center for Language Education and Cooperation / University of International Business and Economics", schoolSlug: uibeSchool.slug, programSlug: uibeProgram.slug,
    fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Non-degree", applicableProgram: "March 2027 one-semester Basic Chinese or Business Chinese route", amountText: "CNY 2,500/month living allowance; approved off-campus accommodation allowance CNY 700/month; semester medical-insurance standard CNY 400/person.", deadlineDate: "2026-10-31", deadlineLabel: "Student deadline October 31, 2026; host-institution review deadline November 10, 2026", applicationRound: "March 2027", requirementText: "HSK Level 3 with at least 180 and an HSKK score. The official page contains a category-year conflict documented in the review artifact.",
    benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true, note: "On campus or CNY 700/month with approval to live off campus" }, { label: "Living allowance", included: true, note: "CNY 2,500/month" }, { label: "Comprehensive medical insurance", included: true, note: "Semester standard CNY 400/person" }],
    applicationSteps: [{ label: "Step 1", body: "Apply through the International Chinese Language Teachers Scholarship system." }, { label: "Step 2", body: "Register in the UIBE application system and submit the required documents under the self-funded project selection specified by the university." }, { label: "Step 3", body: "Track the review and scholarship result, then register according to the admission notice." }],
    actionLinks: [{ label: "Official UIBE source", url: source("uibe-international-chinese-language-teachers-scholarship-spring-2027").url, kind: "official-source" }, { label: "UIBE application system", url: "https://isa.uibe.edu.cn/en/student/register", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("uibe-international-chinese-language-teachers-scholarship-spring-2027"),
    sourceFieldLineage: { title: "official scholarship page and explicit March 2027 deadline section", fundingLevel: "official coverage section", coverage: "official coverage section", amountText: "official coverage standards", deadlineDate: "official deadline section", requirementText: "official category qualifications and internal conflict" },
  },
  {
    slug: "shanghai-international-studies-university-chinese-government-scholarship-type-b-2027",
    title: "SISU Chinese Government Scholarship Type B - 2027",
    nameZh: "上海外国语大学中国政府奖学金（B类）项目（2027年）",
    type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "国家留学基金管理委员会 / 上海外国语大学", providerNameEn: "China Scholarship Council / Shanghai International Studies University", schoolSlug: shisuSchool.slug,
    fundingLevel: "Full", coverage: "Full tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend.", applicableDegree: "Master; Doctoral", applicableProgram: "Programs marked eligible for Chinese Government Scholarship in the official 2027 graduate program catalog", amountText: "Master's students: CNY 3,000/month. Doctoral students: CNY 3,500/month. Medical insurance: CNY 800/year.", deadlineDate: "2026-11-22", deadlineLabel: "November 22, 2026 at 24:00 Beijing time", applicationRound: "September 2027 entry", requirementText: "Master's applicants must be no older than 35; doctoral applicants no older than 40. Chinese-taught programs require HSK 5 with at least 180; English-taught programs require IELTS 6.0 or above. Applicants must also meet the program-specific 2027 admission requirements.",
    benefitItems: [{ label: "Tuition", included: true }, { label: "On-campus accommodation", included: true }, { label: "Living allowance", included: true, note: "CNY 3,000/month for master's students; CNY 3,500/month for doctoral students" }, { label: "Comprehensive medical insurance", included: true, note: "CNY 800/year" }],
    applicationSteps: [{ label: "Step 1", body: "Apply in the CSC system using program category Type B and SISU agency number 10271." }, { label: "Step 2", body: "Complete the SISU online application and submit the required materials before the deadline." }, { label: "Step 3", body: "Participate in the university graduate entrance assessment and scholarship review if shortlisted." }],
    actionLinks: [{ label: "Official SISU scholarship guide", url: source("shisu-chinese-government-scholarship-type-b-2027").url, kind: "official-source" }, { label: "SISU application system", url: "https://apply.shisu.edu.cn/", kind: "official-application" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("shisu-chinese-government-scholarship-type-b-2027"),
    sourceFieldLineage: { title: "official Type B guide", fundingLevel: "official funding standard", coverage: "official funding standard", applicableProgram: "official guide and linked 2027 graduate catalog", amountText: "official funding standard", deadlineDate: "official deadline", requirementText: "official eligibility and language requirements", applicationSteps: "official application procedure" },
  },
  {
    slug: "shanghai-international-studies-university-china-link-scholarship-2027",
    title: "SISU Chinese Government Scholarship China Link Program - 2027 Entry",
    nameZh: "上海外国语大学中国政府奖学金“高校短期科研交流项目”（2027年入境）",
    type: "government", typeLabel: "China Link Program", providerName: "国家留学基金管理委员会 / 上海外国语大学", providerNameEn: "China Scholarship Council / Shanghai International Studies University", schoolSlug: shisuSchool.slug, programSlug: chinaLinkProgram.slug,
    fundingLevel: "Full", coverage: "Full scholarship during the 1-12 month research or exchange stay, including a monthly stipend.", applicableDegree: "General Scholar; Senior Scholar", applicableProgram: "All academic majors except Chinese Language", amountText: "General scholars: CNY 3,000/month. Senior scholars: CNY 3,500/month.", deadlineLabel: "No fixed deadline is published. Contact SISU at least three months before the proposed start, which must be no later than August 31, 2027.", applicationRound: "Rolling entry through August 31, 2027", requirementText: "Applicants must be non-Chinese citizens, under 45 for general scholar or under 50 for senior scholar, remain full-time students or faculty at a CSC partner university, and obtain SISU admission eligibility.",
    benefitItems: [{ label: "Full scholarship", included: true }, { label: "Living allowance", included: true, note: "CNY 3,000/month for general scholars; CNY 3,500/month for senior scholars" }],
    applicationSteps: [{ label: "Step 1", body: "Contact the relevant SISU school or department and obtain departmental approval at least three months before the proposed start." }, { label: "Step 2", body: "Apply in the SISU online system and obtain an admission notice or invitation letter." }, { label: "Step 3", body: "Complete the CSC online application and follow the official nomination process." }],
    actionLinks: [{ label: "Official SISU China Link source", url: source("shisu-china-link-scholarship-2026-2027").url, kind: "official-source" }, { label: "SISU application system", url: "https://apply.shisu.edu.cn/c.asp?action=student_sign", kind: "official-application" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/login", kind: "official-application" }],
    status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields("shisu-china-link-scholarship-2026-2027"),
    sourceFieldLineage: { title: "official China Link page and entry window", fundingLevel: "official coverage section", coverage: "official coverage section", applicableProgram: "official field restriction", amountText: "official stipend standard", deadlineLabel: "official relative application lead time", requirementText: "official eligibility", applicationSteps: "official application process" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [...cityMap.values()], schools: [dhuSchool, shisuSchool, uibeSchool], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 20 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs, refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size, shisuGraduateRows: graduatePrograms.length },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "Donghua and UIBE sources establish only the March 2027 one-semester scholarship route; general Fall 2027 degree admissions are not inferred.",
    "The UIBE category paragraph says March 2026 while the explicit deadline section says March 2027. The candidate follows the explicit March 2027 deadline branch and preserves this conflict for human review.",
    "SISU English program names not separately printed in the Chinese worksheets are normalized translations for display; the official Chinese program names remain preserved verbatim.",
    "The SISU catalog marks scholarship application eligibility, not award certainty. Programs marked ineligible for a scholarship column remain valid self-funded 2027 programs.",
    "The SISU China Link page publishes a relative three-month lead time rather than one calendar deadline, so deadlineDate remains absent.",
  ],
  notes: ["Supervisor names and email addresses printed in the doctoral worksheet are deliberately excluded. No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 3, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size, shisuGraduateRows: graduatePrograms.length }, publicationAuthorized: false }, null, 2));
