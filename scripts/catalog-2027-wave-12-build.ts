import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
type DegreeRoute = {
  nameEn: string;
  nameZh: string;
  group: string;
  terms: Array<"Spring" | "Fall">;
  language?: "Chinese" | "English";
  tuition?: number;
  tuitionText?: string;
  note?: string;
  degreeLevel?: "Bachelor" | "Associate";
};
type NonDegreeRoute = {
  nameEn: string;
  nameZh: string;
  term: "Spring" | "Summer" | "Fall";
  start: string;
  end: string;
  deadline: string;
  tuition: number;
  language?: "Chinese" | "English";
  note?: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-12.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-12.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-12.review.json");
const expected: Record<string, string> = {
  "blcu-undergraduate-program-table-2027": "66c51c65fcef81bb20b49130502f3907f9287bd373dc6820bc49c432ac56d28b",
  "blcu-nondegree-program-table-2027": "cf76ebcb92738525afbeabe36c484c3585720c6f2a014e4c554c98349895b7eb",
  "blcu-undergraduate-program-table-pdf-2027": "17c8a4e898f89b233917269b5353b3110d63ebd5e62c568672d8fbc43d864993",
  "blcu-nondegree-program-table-pdf-2027": "834e17703ac7bd423d63afb8166bed08ce821b2e8c91627f39f0f3228f4f4c15",
  "blcu-undergraduate-entry-requirements-current": "11b21f64ff65f086c274da91b010981809b6da92d1a0a91c70fcc05fa4b55a43",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 12 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const school = (base.schools ?? []).find((row) => row.slug === "beijing-language-and-culture-university");
const city = (base.cities ?? []).find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 12 BLCU dependencies are missing from the reviewed 100-school release.");
const degreeSource = evidence.get("blcu-undergraduate-program-table-pdf-2027")!;
const nonDegreeSource = evidence.get("blcu-nondegree-program-table-pdf-2027")!;
const requirementSource = evidence.get("blcu-undergraduate-entry-requirements-current")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const directions = (prefixEn: string, prefixZh: string, group: string, terms: Array<"Spring" | "Fall">, rows: Array<[string, string]>, extra: Partial<DegreeRoute> = {}): DegreeRoute[] =>
  rows.map(([nameEn, nameZh]) => ({ nameEn: `${prefixEn}${nameEn}`, nameZh: `${prefixZh}${nameZh}`, group, terms, ...extra }));

const publishedDegreeDurationYears: Record<string, number> = {
  "International dual degree": 4,
  "Domestic dual degree": 4,
  "Undergraduate pathway": 4,
  "International-student standalone program": 4,
  "Associate program": 2,
};

const publishedEntryRequirements = (route: DegreeRoute): { hskRequirement?: string; englishRequirement?: string; assessment?: string } => {
  if (route.group === "International-student standalone program") {
    return { hskRequirement: "HSK Level 4 with a total score of 180 or above." };
  }
  if (route.nameEn.startsWith("BLCU-University of Science and Technology Beijing Dual Degree")) {
    return { hskRequirement: "HSK Level 4 with a total score of 180 or above and at least 60 in each component." };
  }
  if (["Finance - Digital Finance", "Accounting - Digital Intelligent Accounting", "International Economics and Trade - Digital Business"].includes(route.nameEn)) {
    return { englishRequirement: "IELTS 5.5 overall with at least 5.5 in each component, TOEFL 80, or TOEIC 650.", assessment: "Applicants must also pass the program interview." };
  }
  if (route.nameEn === "Chinese Studies") {
    return { englishRequirement: "IELTS 6.5 or TOEFL 90 or above." };
  }
  if (route.nameEn.endsWith("Hearing and Speech Rehabilitation")) {
    return { englishRequirement: "IELTS 5.5 overall with at least 5.5 in each component, TOEFL 80, or TOEIC 650.", assessment: "Applicants must also pass the program interview." };
  }
  if (["International Politics", "International Affairs and International Relations", "Network and New Media"].includes(route.nameEn)) {
    return { hskRequirement: "HSK Level 5 with a total score of 200 or above and at least 60 in each component.", assessment: "Applicants must pass a professional interview covering comprehensive Chinese and basic subject knowledge." };
  }
  if (["English", "English - English-Spanish Bilingual", "Business English"].includes(route.nameEn)) {
    return { hskRequirement: "HSK Level 5 with a total score of 180 or above.", englishRequirement: "IELTS 6.5 or TOEFL 90 or above." };
  }
  if (route.nameEn === "Psychology") {
    return { hskRequirement: "HSK Level 5 with a total score of 180 or above." };
  }
  if (["Computer Science and Technology", "Digital Media Technology", "Data Science and Big Data Technology", "Artificial Intelligence"].includes(route.nameEn)) {
    return { hskRequirement: "HSK Level 5 with a total score of 180 or above.", assessment: "Applicants must pass a written examination in mathematics and logic and an interview covering mathematics, logic and information-technology ability." };
  }
  if (route.degreeLevel !== "Associate" && route.group !== "Undergraduate pathway") {
    return { hskRequirement: "A valid HSK certificate is listed among the general undergraduate application materials; no route-specific minimum score is published for this 2027 route." };
  }
  return {};
};

const degreeRoutes: DegreeRoute[] = [
  ...directions("BLCU-University of Manchester Dual Degree - ", "北京语言大学-曼彻斯特大学双学位—", "International dual degree", ["Fall"], [
    ["Chinese Language", "汉语言"], ["Translation", "翻译"], ["English Literature", "英语文学"], ["Linguistics", "语言学"], ["Linguistics and Sociology", "语言学与社会学"], ["Art History", "艺术史"], ["Film Studies", "电影研究"], ["English Literature and Film Studies", "英语文学与电影研究"], ["Film Studies and Linguistics", "电影研究与语言学"], ["East Asian Studies", "东亚研究"],
  ], { tuitionText: "Years 1-2 at BLCU Beijing: CNY 25,800/year. Year 3 at the University of Manchester: GBP 25,200; year 4: GBP 31,500. Manchester fees remain subject to its final notice.", note: "Students study years 1-2 at BLCU in Beijing and years 3-4 at the University of Manchester. Students averaging at least 60% in year 3 may receive a 20% scholarship in year 4." }),
  { nameEn: "BLCU-Northeastern Illinois University Dual Degree - Hearing and Speech Rehabilitation", nameZh: "北京语言大学-美国东北伊利诺伊大学双学位—听力与言语康复学", group: "International dual degree", terms: ["Fall"], language: "English", tuition: 82500, tuitionText: "CNY 82,500/year; four years at BLCU Hainan." },
  ...directions("BLCU-University of Science and Technology Beijing Dual Degree - ", "北京语言大学-北京科技大学双学位—", "Domestic dual degree", ["Fall"], [["Chinese Language", "汉语言"], ["Artificial Intelligence", "人工智能"]], { tuitionText: "Years 1-2 at BLCU Beijing: CNY 25,800/year; years 3-4 at University of Science and Technology Beijing: CNY 23,300/year." }),
  ...directions("BLCU-National Academy of Chinese Theatre Arts Dual Degree - ", "北京语言大学-中国戏曲学院双学位—", "Domestic dual degree", ["Fall"], [["Chinese Language", "汉语言"], ["Arts Management", "艺术管理"], ["Cultural Industry Management", "文化产业管理"]], { tuitionText: "Years 1-2 at BLCU Beijing: CNY 25,800/year; years 3-4 at the National Academy of Chinese Theatre Arts: CNY 35,000/year." }),
  ...directions("1+3 Undergraduate Pathway - ", "1+3本科直通车—", "Undergraduate pathway", ["Spring", "Fall"], [
    ["Chinese Language - Language and Culture", "汉语言（语言文化）"], ["Chinese Language - Chinese-English Bilingual", "汉语言（汉英双语）"], ["Chinese Language - Economics and Trade Chinese", "汉语言（经贸汉语）"],
    ["Applied Chinese - Science and Technology Chinese", "应用中文（科技中文）"], ["Applied Chinese - Business Chinese", "应用中文（商务中文）"], ["Applied Chinese - Tourism Chinese", "应用中文（文旅中文）"],
    ["Translation - English-Chinese", "翻译（英汉翻译）"], ["Translation - Korean-Chinese", "翻译（韩汉翻译）"], ["Translation - AI-assisted Translation", "翻译（AI智能翻译）"],
    ["International Chinese Language Education", "汉语国际教育"], ["International Economics and Trade", "国际经济与贸易"],
  ], { tuitionText: "Foundation year: CNY 39,000/year in Beijing or CNY 26,000/year in Hainan. Bachelor years 2-4: CNY 25,800/year in Beijing or CNY 22,000/year in Hainan.", note: "One foundation year followed by three bachelor years in the named route." }),
  { nameEn: "Chinese Language - Chinese-Japanese Bilingual", nameZh: "汉语言（中日复语）", group: "International-student standalone program", terms: ["Spring", "Fall"], language: "Chinese", tuitionText: "Years 1-2 at BLCU Beijing: CNY 25,800/year; years 3-4 in Tokyo: JPY 1,000,000/year." },
  ...directions("", "", "International-student standalone program", ["Spring", "Fall"], [
    ["Applied Chinese - Science and Technology Chinese", "应用中文（科技中文）"], ["Applied Chinese - Business Chinese", "应用中文（商务中文）"], ["Applied Chinese - Tourism Chinese", "应用中文（文旅中文）"],
    ["Translation - English-Chinese", "翻译（英汉翻译）"], ["Translation - Korean-Chinese", "翻译（韩汉翻译）"], ["Translation - AI-assisted Translation", "翻译（AI智能翻译）"],
    ["Chinese Language - Language and Culture", "汉语言（语言文化）"], ["Chinese Language - Chinese-English Bilingual", "汉语言（汉英双语）"], ["Chinese Language - Economics and Trade Chinese", "汉语言（经贸汉语）"],
    ["International Chinese Language Education", "汉语国际教育"], ["International Economics and Trade", "国际经济与贸易"],
  ], { tuitionText: "CNY 25,800/year in Beijing or CNY 22,000/year in Hainan, according to the assigned training plan." }),
  ...directions("", "", "English-taught program", ["Spring", "Fall"], [["Chinese Language and Culture", "中国语言与文化"], ["Chinese Studies", "汉学与中国学"]], { language: "English", tuition: 35000 }),
  ...directions("", "", "English-taught program", ["Fall"], [["Finance - Digital Finance", "金融学（数智金融）"], ["Accounting - Digital Intelligent Accounting", "会计学（数智会计）"], ["International Economics and Trade - Digital Business", "国际经济与贸易（数智商务）"], ["Digital Economy", "数字经济"]], { language: "English", tuition: 39000 }),
  { nameEn: "Hearing and Speech Rehabilitation - Dual Degree", nameZh: "听力与言语康复学（双学位）", group: "English-taught program", terms: ["Fall"], language: "English", tuition: 82500 },
  ...directions("", "", "Joint international and Chinese cohort", ["Fall"], [
    ["International Politics", "国际政治"], ["International Affairs and International Relations", "国际事务与国际关系"], ["Network and New Media", "网络与新媒体"], ["Computer Science and Technology", "计算机科学与技术"], ["Software Engineering - Intelligent Assistant Development", "软件工程（智能辅助开发）"], ["Artificial Intelligence", "人工智能"], ["Data Science and Big Data Technology", "数据科学与大数据技术"], ["Digital Media Technology", "数字媒体技术"], ["Psychology", "心理学"],
  ], { tuition: 25800 }),
  ...directions("", "", "Joint international and Chinese cohort", ["Fall"], [["English", "英语"], ["English - English-Spanish Bilingual", "英语（英西复语）"], ["Business English", "商务英语"]], { tuition: 27600 }),
  ...directions("Associate - ", "专科—", "Associate program", ["Spring", "Fall"], [
    ["Applied Chinese - Science and Technology Chinese", "应用中文（科技中文）"], ["Applied Chinese - Business Chinese", "应用中文（商务中文）"], ["Applied Chinese - Tourism Chinese", "应用中文（文旅中文）"],
    ["Chinese Language - Language and Culture", "汉语言（语言文化）"], ["Chinese Language - Chinese-English Bilingual", "汉语言（汉英双语）"], ["Chinese Language - Economics and Trade Chinese", "汉语言（经贸汉语）"],
  ], { degreeLevel: "Associate", note: "The source image prints tuition figures that require confirmation; tuition is deliberately omitted from the structured candidate." }),
];

const nonDegreeRoutes: NonDegreeRoute[] = [
  { nameEn: "Practical Chinese Intensive - 4 weeks (March)", nameZh: "实用汉语强化—4周（3月）", term: "Spring", start: "2027-03-03", end: "2027-03-26", deadline: "2027-02-01", tuition: 4500 },
  { nameEn: "Practical Chinese Intensive - one semester", nameZh: "实用汉语强化—一学期", term: "Spring", start: "2027-03-03", end: "2027-06-25", deadline: "2027-02-01", tuition: 13600 },
  { nameEn: "Business Chinese - one semester", nameZh: "商务汉语—一学期", term: "Spring", start: "2027-03-03", end: "2027-06-25", deadline: "2027-02-01", tuition: 13600 },
  { nameEn: "Practical Chinese Intensive Enhanced - one semester", nameZh: "实用汉语强化提高—一学期", term: "Spring", start: "2027-03-03", end: "2027-06-25", deadline: "2027-02-01", tuition: 21800 },
  { nameEn: "CSCA Intensive Enhanced - one semester", nameZh: "CSCA强化提高—一学期", term: "Spring", start: "2027-03-03", end: "2027-06-25", deadline: "2027-02-01", tuition: 21800 },
  { nameEn: "Practical Chinese Intensive - one academic year", nameZh: "实用汉语强化—一学年", term: "Spring", start: "2027-03-03", end: "2027-12-31", deadline: "2027-02-01", tuition: 26600 },
  { nameEn: "Practical Chinese Intensive - 12 weeks", nameZh: "实用汉语强化—12周", term: "Spring", start: "2027-04-06", end: "2027-06-25", deadline: "2027-03-15", tuition: 10200, note: "Not open to complete beginners." },
  { nameEn: "Chinese Language Studies - one academic year", nameZh: "中文进修课程—一学年", term: "Spring", start: "2027-03-03", end: "early January 2028", deadline: "2027-02-01", tuition: 26600 },
  { nameEn: "Chinese Language and Culture Advanced Studies - one academic year", nameZh: "中国语言与文化高级进修—一学年", term: "Spring", start: "2027-03-03", end: "early January 2028", deadline: "2027-02-01", tuition: 26600 },
  { nameEn: "Advanced Chinese Translation - one academic year", nameZh: "汉语翻译高级进修—一学年", term: "Spring", start: "2027-03-03", end: "early January 2028", deadline: "2027-02-01", tuition: 26600 },
  { nameEn: "Undergraduate Pathway - one semester", nameZh: "本科预科—一学期", term: "Spring", start: "2027-03-03", end: "early July 2027", deadline: "2027-02-01", tuition: 20000, note: "Arts/science foundation." },
  { nameEn: "Undergraduate Pathway - one academic year", nameZh: "本科预科—一学年", term: "Spring", start: "2027-03-03", end: "early January 2028", deadline: "2027-02-01", tuition: 39000, note: "Arts/science foundation." },
  { nameEn: "Practical Chinese Intensive - 4 weeks (June-July)", nameZh: "实用汉语强化—4周（6-7月）", term: "Summer", start: "2027-06-30", end: "2027-07-27", deadline: "2027-06-11", tuition: 4500 },
  { nameEn: "Practical Chinese Intensive - 8 weeks", nameZh: "实用汉语强化—8周", term: "Summer", start: "2027-06-30", end: "2027-08-24", deadline: "2027-06-11", tuition: 8000 },
  { nameEn: "Practical Chinese Intensive - 6 weeks", nameZh: "实用汉语强化—6周", term: "Summer", start: "2027-07-14", end: "2027-08-24", deadline: "2027-06-25", tuition: 6200, note: "Not open to complete beginners." },
  { nameEn: "Practical Chinese Intensive - 4 weeks (July-August)", nameZh: "实用汉语强化—4周（7-8月）", term: "Summer", start: "2027-07-28", end: "2027-08-24", deadline: "2027-07-12", tuition: 4500 },
  { nameEn: "Practical Chinese Intensive - 4 weeks (August)", nameZh: "实用汉语强化—4周（8月）", term: "Summer", start: "2027-08-02", end: "2027-08-27", deadline: "2027-07-12", tuition: 4500 },
  { nameEn: "Openness and Common Prosperity - New Vision of Chinese Economy (English, 2 weeks)", nameZh: "开放与共同富裕：中国经济新视野（英文，2周）", term: "Summer", start: "2027-06-30", end: "2027-07-13", deadline: "2027-06-11", tuition: 3500, language: "English" },
  { nameEn: "Openness and Common Prosperity - New Vision of Chinese Economy (Chinese, 4 weeks)", nameZh: "开放与共同富裕：中国经济新视野（中文，4周）", term: "Summer", start: "2027-06-30", end: "2027-07-27", deadline: "2027-06-11", tuition: 5000, note: "HSK 3 Chinese level is required." },
  { nameEn: "AI and Smart China - 4 weeks", nameZh: "人工智能与智慧中国—4周", term: "Summer", start: "2027-06-30", end: "2027-07-27", deadline: "2027-06-11", tuition: 5000, note: "HSK 3 Chinese level is required." },
  { nameEn: "Travel Chinese - Windows into History and Culture - 4 weeks", nameZh: "旅游汉语：历史文化之窗—4周", term: "Summer", start: "2027-06-30", end: "2027-07-27", deadline: "2027-06-11", tuition: 5000, note: "HSK 3 Chinese level is required." },
  { nameEn: "Summer Cultural Journey Camp - 2 weeks", nameZh: "暑期文化行旅营—2周", term: "Summer", start: "custom schedule", end: "custom schedule", deadline: "custom deadline", tuition: 7900, note: "The official table says the schedule and application deadline can be customized." },
  { nameEn: "Chinese Culture Experience Camp - 2 weeks", nameZh: "中华文化体验营—2周", term: "Summer", start: "2027-07-14", end: "2027-07-27", deadline: "2027-06-25", tuition: 4150 },
  { nameEn: "Practical Chinese Intensive - 4 weeks (September)", nameZh: "实用汉语强化—4周（9月）", term: "Fall", start: "2027-09-08", end: "2027-09-30", deadline: "2027-07-31", tuition: 4500 },
  { nameEn: "Practical Chinese Intensive - one semester", nameZh: "实用汉语强化—一学期", term: "Fall", start: "2027-09-08", end: "2027-12-31", deadline: "2027-07-31", tuition: 13600 },
  { nameEn: "Business Chinese - one semester", nameZh: "商务汉语—一学期", term: "Fall", start: "2027-09-08", end: "2027-12-31", deadline: "2027-07-31", tuition: 13600 },
  { nameEn: "Practical Chinese Intensive Enhanced - one semester", nameZh: "实用汉语强化提高—一学期", term: "Fall", start: "2027-09-08", end: "2027-12-31", deadline: "2027-07-31", tuition: 21800 },
  { nameEn: "CSCA Intensive Enhanced - one semester", nameZh: "CSCA强化提高—一学期", term: "Fall", start: "2027-09-08", end: "2027-12-31", deadline: "2027-07-31", tuition: 21800 },
  { nameEn: "Practical Chinese Intensive - one academic year", nameZh: "实用汉语强化—一学年", term: "Fall", start: "2027-09-08", end: "late June 2028", deadline: "2027-07-31", tuition: 26600 },
  { nameEn: "Practical Chinese Intensive - 12 weeks", nameZh: "实用汉语强化—12周", term: "Fall", start: "2027-10-11", end: "2027-12-31", deadline: "2027-09-06", tuition: 10200, note: "Not open to complete beginners." },
  { nameEn: "Practical Chinese Intensive - 4 weeks (December-January)", nameZh: "实用汉语强化—4周（12-1月）", term: "Fall", start: "2027-12-27", end: "2028-01-21", deadline: "2027-12-06", tuition: 4500 },
  { nameEn: "Chinese Language Studies - one academic year", nameZh: "中文进修课程—一学年", term: "Fall", start: "2027-09-08", end: "early July 2028", deadline: "2027-07-31", tuition: 26600 },
  { nameEn: "Advanced Chinese Translation - one academic year", nameZh: "汉语翻译高级进修—一学年", term: "Fall", start: "2027-09-08", end: "early July 2028", deadline: "2027-07-31", tuition: 26600 },
  { nameEn: "Chinese Language and Culture Advanced Studies - one academic year", nameZh: "中国语言与文化高级进修—一学年", term: "Fall", start: "2027-09-08", end: "early July 2028", deadline: "2027-07-31", tuition: 26600 },
  { nameEn: "Undergraduate Pathway - one semester", nameZh: "本科预科—一学期", term: "Fall", start: "2027-09-08", end: "early January 2028", deadline: "2027-07-31", tuition: 20000, note: "Arts/science foundation." },
  { nameEn: "Undergraduate Pathway - one academic year", nameZh: "本科预科—一学年", term: "Fall", start: "2027-09-08", end: "early July 2028", deadline: "2027-07-31", tuition: 39000, note: "Arts/science foundation." },
];

const degreePrograms: CatalogSeedProgram[] = degreeRoutes.map((route) => {
  const tuitionText = route.tuitionText ?? (route.tuition ? `CNY ${route.tuition.toLocaleString("en-US")}/year.` : undefined);
  const durationYears = publishedDegreeDurationYears[route.group];
  const entryRequirements = publishedEntryRequirements(route);
  return {
    slug: `beijing-language-and-culture-university-2027-${slugify(route.nameEn)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: route.nameEn,
    nameZh: route.nameZh,
    degreeLevel: route.degreeLevel ?? "Bachelor",
    ...(durationYears ? { durationYears } : {}),
    fieldCategory: route.group,
    subjectArea: route.group,
    teachingLanguage: route.language ?? "Chinese",
    ...(entryRequirements.hskRequirement ? { hskRequirement: entryRequirements.hskRequirement } : {}),
    ...(entryRequirements.englishRequirement ? { englishRequirement: entryRequirements.englishRequirement } : {}),
    ...(route.degreeLevel !== "Associate" ? { cscaRequirement: "A valid CSCA score is required as an essential application material for international bachelor applicants from Fall 2026 onward." } : {}),
    ...(route.tuition ? { tuitionAmount: route.tuition, tuitionCurrency: "CNY", tuitionPeriod: "year" } : {}),
    ...(tuitionText ? { tuitionText } : {}),
    applicationUrl: "https://apply.blcu.edu.cn",
    applicationNote: [route.note, entryRequirements.assessment, "The application fee is CNY 800 and is non-refundable. Exact opening and registration dates follow the admission letter."].filter(Boolean).join(" "),
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: degreeSource.fetchedAt,
    ...sourceFields(degreeSource),
    sourceFieldLineage: {
      nameEn: "2027 undergraduate program table (translated label)", nameZh: "2027 undergraduate program table", degreeLevel: "table section heading",
      ...(durationYears ? { durationYears: route.degreeLevel === "Associate" ? "cultivation-arrangement column explicitly lists year 1 and year 2" : "cultivation-arrangement column explicitly lists years 1-4" } : {}),
      fieldCategory: "table section heading", subjectArea: "table section heading", teachingLanguage: "program name or section heading",
      ...(entryRequirements.hskRequirement ? { hskRequirement: entryRequirements.hskRequirement.includes("no route-specific minimum score") ? "current official general undergraduate application-material list; the 2027 route has no published route-specific threshold" : "current official undergraduate entry-requirement table, exact matching program or program group" } : {}),
      ...(entryRequirements.englishRequirement ? { englishRequirement: "current official undergraduate entry-requirement table, exact matching program or program group" } : {}),
      ...(route.degreeLevel !== "Associate" ? { cscaRequirement: "current official undergraduate entry-requirement page, policy effective from Fall 2026" } : {}),
      ...(route.tuition ? { tuitionAmount: "tuition column", tuitionCurrency: "tuition column", tuitionPeriod: "tuition/year heading" } : {}),
      ...(tuitionText ? { tuitionText: "tuition and training-arrangement columns" } : {}),
      applicationUrl: "registration information", applicationNote: "registration information and notes",
    },
  };
});

const nonDegreePrograms: CatalogSeedProgram[] = nonDegreeRoutes.map((route) => {
  const durationYears = route.nameEn.includes("one academic year") ? 1 : undefined;
  const durationMonths = route.nameEn.includes("one semester") ? 4 : undefined;
  const publishedHskRequirement = route.note?.includes("HSK 3")
    ? "HSK Level 3 Chinese proficiency is required."
    : route.language !== "English"
      ? route.note?.includes("Not open to complete beginners")
        ? "No fixed HSK score is published; the program is not open to complete beginners."
        : "The 2027 program table publishes no fixed HSK score; Chinese-language students are placed according to their current proficiency where placement applies."
      : undefined;
  const publishedEnglishRequirement = route.language === "English"
    ? "The 2027 program table identifies English as the teaching language but publishes no fixed English-test score."
    : undefined;
  return {
  slug: `beijing-language-and-culture-university-2027-${slugify(`${route.term}-${route.nameEn}`)}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  degreeLevel: "Non-degree",
  ...(durationYears ? { durationYears } : {}),
  ...(durationMonths ? { durationMonths } : {}),
  fieldCategory: route.nameEn.includes("Pathway") ? "Undergraduate pathway" : route.nameEn.includes("Camp") ? "Study China camp" : "Chinese language and culture",
  subjectArea: route.nameEn.includes("Pathway") ? "Foundation studies" : "Chinese language and culture",
  teachingLanguage: route.language ?? "Chinese",
  ...(publishedHskRequirement ? { hskRequirement: publishedHskRequirement } : {}),
  ...(publishedEnglishRequirement ? { englishRequirement: publishedEnglishRequirement } : {}),
  tuitionAmount: route.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: "program",
  tuitionText: `CNY ${route.tuition.toLocaleString("en-US")}/program. For programs shorter than one academic year, the official table says textbooks are included; application fee CNY 600 is non-refundable.`,
  applicationUrl: "https://apply.blcu.edu.cn",
  applicationNote: [route.note, `Published teaching period: ${route.start} to ${route.end}. Exact opening and registration dates follow the admission letter.`].filter(Boolean).join(" "),
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: nonDegreeSource.fetchedAt,
  ...sourceFields(nonDegreeSource),
  sourceFieldLineage: {
    nameEn: "2027 non-degree program table (translated label)", nameZh: "2027 non-degree program table", degreeLevel: "non-degree table context",
    ...(durationYears ? { durationYears: "study-duration column explicitly states one academic year" } : {}),
    ...(durationMonths ? { durationMonths: "study-duration column states one semester and the teaching-period dates span approximately four months" } : {}),
    fieldCategory: "program category", subjectArea: "program category", teachingLanguage: "teaching-language column or Chinese program title",
    ...(publishedHskRequirement ? { hskRequirement: route.note?.includes("HSK 3") ? "teaching-language column explicitly states HSK 3" : route.note?.includes("Not open to complete beginners") ? "program label explicitly excludes complete beginners; the table publishes no fixed HSK score" : "2027 table publishes no fixed HSK score; table note describes proficiency-based placement where applicable" } : {}),
    ...(publishedEnglishRequirement ? { englishRequirement: "teaching-language column states English; the 2027 table publishes no fixed English-test score" } : {}),
    tuitionAmount: "tuition column", tuitionCurrency: "tuition column", tuitionPeriod: "program duration and tuition note", tuitionText: "tuition column and table note", applicationUrl: "registration information", applicationNote: "teaching-period column and registration note",
  },
  };
});

const programs = [...degreePrograms, ...nonDegreePrograms];
const degreeIntakes: CatalogSeedProgramIntake[] = degreeRoutes.flatMap((route) => route.terms.map((term) => ({
  programSlug: `beijing-language-and-culture-university-2027-${slugify(route.nameEn)}`,
  intakeTerm: term,
  intakeYear: 2027,
  deadlineLabel: term === "Spring" ? "Spring 2027 application deadline: February 1, 2027; the official table does not publish a deadline time." : "Fall 2027 application deadline: July 31, 2027; the official table does not publish a deadline time.",
  applicationRound: `BLCU ${term} 2027 degree admission`,
  status: "open",
  ...sourceFields(degreeSource),
  sourceFieldLineage: { intakeTerm: "admission-time column", intakeYear: "2027 table title", deadlineLabel: "registration information", applicationRound: "table title and admission-time column", status: "published application round compared with capturedAt" },
})));
const nonDegreeIntakes: CatalogSeedProgramIntake[] = nonDegreeRoutes.map((route) => ({
  programSlug: `beijing-language-and-culture-university-2027-${slugify(`${route.term}-${route.nameEn}`)}`,
  intakeTerm: route.term,
  intakeYear: 2027,
  deadlineLabel: `Application deadline: ${route.deadline}; the official table does not publish a deadline time. Published teaching period: ${route.start} to ${route.end}.`,
  applicationRound: `BLCU ${route.term} 2027 non-degree admission`,
  status: "open",
  ...sourceFields(nonDegreeSource),
  sourceFieldLineage: { intakeTerm: "teaching-period column", intakeYear: "2027 table title", deadlineLabel: "application deadline and teaching-period columns", applicationRound: "table title and teaching period", status: "published application round compared with capturedAt" },
}));
const programIntakes = [...degreeIntakes, ...nonDegreeIntakes];

const duplicateProgramSlugs = programs.map((row) => row.slug).filter((slug, index, all) => all.indexOf(slug) !== index);
if (duplicateProgramSlugs.length) throw new Error(`Duplicate Wave 12 program slugs: ${[...new Set(duplicateProgramSlugs)].join(", ")}`);
const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const refreshedSchool = {
  ...school,
  applicationFee: "CNY 800, paid online and non-refundable.",
  languageRequirement: "Language thresholds are program-specific; current published undergraduate requirements range from HSK 4/180 to HSK 5/200 and from IELTS 5.5 or TOEFL 80 to IELTS 6.5 or TOEFL 90 for named routes.",
  cscaRequired: true,
  cscaRequirement: "All international applicants to bachelor programs must submit a valid CSCA score as an essential application material from Fall 2026 onward.",
  lastVerifiedAt: requirementSource.fetchedAt,
  ...sourceFields(requirementSource),
  sourceFieldLineage: {
    ...(school.sourceFieldLineage ?? {}),
    applicationFee: "current official undergraduate application-material list",
    languageRequirement: "current official undergraduate entry-requirement table",
    cscaRequired: "current official undergraduate entry-requirement page, policy effective from Fall 2026",
    cscaRequirement: "current official undergraduate entry-requirement page, policy effective from Fall 2026",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [refreshedSchool], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 12 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The associate-program tuition image appears to print CNY 258,000 in Beijing and CNY 220,000 in Hainan. Because these values conflict sharply with adjacent bachelor tuition and may be a source-layout error, they are not stored pending confirmation.",
    "The English-taught and joint international/Chinese cohort degree sections do not explicitly print a study duration, so their duration fields remain empty.",
    "Two-, four-, six-, eight- and twelve-week non-degree routes remain without structured duration because the current seed contract only accepts whole months or years; their exact duration remains preserved in the route names and teaching-period notes.",
    "The non-degree table describes some end dates as early/late month. Placeholder dates are used only inside human-readable application notes; no exact end-date field exists in the seed contract and none is asserted.",
    "The 2027 tables do not publish CSCA subject mappings, scholarships or exact application opening times; these fields are not inferred. Language thresholds are added only where the current official entry-requirement table exactly matches the named route or program group; unmatched 2027 routes remain empty.",
  ],
  notes: [
    "The official BLCU pages link two image-only 2027 PDF tables. Both PDF files were hash-locked, rendered and visually reviewed page by page before transcription.",
    "Degree routes preserve each named major or direction, training arrangement, teaching-language category, published tuition and Spring/Fall availability.",
    "Structured durations are recorded only where the 2027 tables explicitly state years 1-4, years 1-2, one semester with a roughly four-month teaching period, or one academic year.",
    "The current official undergraduate entry-requirement page supplies the CNY 800 application fee, the bachelor-level CSCA policy and exact matching route-level HSK/English thresholds and assessments. Its stale 2026 deadline rows are not used.",
    "Non-degree routes preserve published teaching periods, deadlines and tuition; repeated program names are separated by term and duration.",
    "No 2026 date is rolled forward by assumption and no applicant, account, passport, payment or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
