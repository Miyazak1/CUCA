import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedProgramIntake } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
type Level = "Master" | "Doctoral";
type Language = "Chinese" | "English";
type Spec = { nameEn: string; nameZh: string; degreeLevel: Level; teachingLanguage: Language; durationYears: number; tuitionAmount: number; schoolUnit: string; campus: string };

const root = process.cwd();
const expected: Record<string, string> = {
  "blcu-graduate-program-table-2027": "c0393285aaf0e88fff31e23fb30cc07e2f3bf530452cf918ebe129367ba0fcf5",
  "blcu-graduate-program-table-pdf-2027": "a3386aa89f89045baf81fa20c4b8a855d00537762b5373bec919cf4c3a8a3d73",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`BLCU Wave 49 evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked BLCU Wave 49 evidence: ${missing.join(", ")}`);
const pageSource = evidence.get("blcu-graduate-program-table-2027")!;
const pdfSource = evidence.get("blcu-graduate-program-table-pdf-2027")!;
const fields = { sourceUrl: pdfSource.finalUrl ?? pdfSource.url, sourceLabel: pdfSource.label, sourceSha256: pdfSource.sha256, capturedAt: pdfSource.fetchedAt };

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-12.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "beijing-language-and-culture-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 49 BLCU dependency rows are incomplete.");

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups: Array<[Level, Language, number, number, string, string, string]> = [
  ["Master", "Chinese", 2, 30000, "College of International Chinese Education", "Hainan", "International Chinese Language Education|国际中文教育;English Translation|英语笔译;Japanese Translation|日语笔译;Korean Translation|朝鲜语笔译;Russian Translation|俄语笔译;Arabic Translation|阿拉伯语笔译;Translation Localization|翻译本地化"],
  ["Master", "Chinese", 2, 35000, "College of International Chinese Education", "Hainan or Beijing", "English Interpreting|英语口译;Japanese Interpreting|日语口译;Korean Interpreting|朝鲜语口译;Russian Interpreting|俄语口译;Arabic Interpreting|阿拉伯语口译"],
  ["Master", "Chinese", 3, 30000, "College of International Chinese Education", "Hainan or Beijing", "Linguistics and Applied Linguistics|语言学及应用语言学"],
  ["Master", "Chinese", 3, 30000, "Institute of Sinology and China Studies", "Beijing", "World Sinology and China Studies|世界汉学与中国学"],
  ["Master", "Chinese", 5, 30000, "Institute of Sinology and China Studies", "Beijing", "World Sinology and China Studies - Integrated Master-Doctoral Track|世界汉学与中国学（硕博连读项目）"],
  ["Master", "Chinese", 3, 30000, "School of English Studies and Advanced Translation", "Beijing", "English Language and Literature|英语语言文学;Foreign Linguistics and Applied Linguistics|外国语言学及应用语言学;Translation Studies|翻译学;International Language Services|国际语言服务"],
  ["Master", "Chinese", 3, 30000, "School of Foreign Languages and Cultures", "Beijing", "Russian Language and Literature|俄语语言文学;French Language and Literature|法语语言文学;German Language and Literature|德语语言文学;Japanese Language and Literature|日语语言文学;Spanish Language and Literature|西班牙语语言文学;Arabic Language and Literature|阿拉伯语言文学;European Languages and Literature|欧洲语言文学;Asian and African Languages and Literature|亚非语言文学;Area and Country Studies|区域国别学"],
  ["Master", "Chinese", 3, 30000, "College of Teacher Education", "Beijing", "Principles of Education|教育学原理;Curriculum and Teaching Theory|课程与教学论;Educational Evaluation and Governance|教育评价与治理"],
  ["Master", "Chinese", 3, 30000, "School of Literature", "Beijing", "Theory of Literature and Art|文艺学;Classical Chinese Philology|中国古典文献学;Ancient Chinese Literature|中国古代文学;Modern and Contemporary Chinese Literature|中国现当代文学;Comparative Literature and World Literature|比较文学与世界文学;Philological Linguistics|文献语言学;Chinese History|中国史"],
  ["Master", "Chinese", 3, 30000, "School of International Politics and Communication", "Beijing", "Political Science|政治学"],
  ["Master", "Chinese", 2, 68000, "School of International Politics and Communication", "Beijing", "International Affairs|国际事务"],
  ["Master", "Chinese", 2, 30000, "School of International Politics and Communication", "Beijing", "Journalism and Communication|新闻与传播"],
  ["Master", "Chinese", 3, 30000, "School of Information Science", "Beijing", "Language Intelligence and Technology|语言智能与技术;Computer Science and Technology|计算机科学与技术;Library and Information Studies|图书情报"],
  ["Master", "Chinese", 2, 48000, "Business School", "Beijing", "Digital Economy|数字经济"],
  ["Master", "Chinese", 2, 32000, "Business School", "Beijing", "Accounting|会计"],
  ["Master", "Chinese", 3, 38400, "School of Arts", "Beijing", "Art Studies|艺术学"],
  ["Master", "Chinese", 3, 48000, "School of Arts", "Beijing", "Music|音乐"],
  ["Master", "Chinese", 3, 30000, "School of Psychology and Cognitive Science", "Beijing", "Psychology|心理学;Psycholinguistics|心理语言学"],
  ["Master", "Chinese", 3, 30000, "School of Language Science and Resources", "Beijing", "Language Cognition Science|语言认知科学;Language Policy and Planning|语言政策与语言规划;Language Resources|语言资源学;Language and Brain Science|语言与人脑科学"],
  ["Master", "English", 2, 48000, "Business School", "Beijing", "Finance|金融"],
  ["Master", "English", 2, 49000, "Business School", "Beijing", "International Business|国际商务;Industrial Economics - Industrial Opening and Multinational Enterprises|产业经济学（产业开放与跨国企业）;International Trade|国际贸易学"],
  ["Doctoral", "Chinese", 3, 48000, "College of International Chinese Education", "Beijing", "International Chinese Language Education|国际中文教育"],
  ["Doctoral", "Chinese", 3, 32500, "College of International Chinese Education", "Beijing", "Linguistics and Applied Linguistics|语言学及应用语言学"],
  ["Doctoral", "Chinese", 3, 32500, "Institute of Sinology and China Studies", "Beijing", "World Sinology and China Studies|世界汉学与中国学"],
  ["Doctoral", "Chinese", 3, 32500, "School of English Studies and Advanced Translation", "Beijing", "English Language and Literature|英语语言文学;Foreign Linguistics and Applied Linguistics|外国语言学及应用语言学;Translation Studies|翻译学"],
  ["Doctoral", "Chinese", 3, 32500, "School of Foreign Languages and Cultures", "Beijing", "Area and Country Studies|区域国别学"],
  ["Doctoral", "Chinese", 3, 32500, "School of Literature", "Beijing", "Theory of Literature and Art|文艺学;Chinese Linguistics|汉语言文字学;Ancient Chinese Literature|中国古代文学;Modern and Contemporary Chinese Literature|中国现当代文学;Comparative Literature and World Literature|比较文学与世界文学;Philological Linguistics|文献语言学"],
  ["Doctoral", "Chinese", 3, 32500, "School of Information Science", "Beijing", "Language Intelligence and Technology|语言智能与技术"],
  ["Doctoral", "Chinese", 3, 32500, "School of Arts", "Beijing", "Art Studies|艺术学"],
  ["Doctoral", "Chinese", 3, 32500, "School of Psychology and Cognitive Science", "Beijing", "Psycholinguistics|心理语言学"],
  ["Doctoral", "Chinese", 3, 32500, "School of Language Science and Resources", "Beijing", "Language Cognition Science|语言认知科学;Language and Brain Science|语言与人脑科学;Language Resources|语言资源学"],
];
const specs: Spec[] = groups.flatMap(([degreeLevel, teachingLanguage, durationYears, tuitionAmount, schoolUnit, campus, names]) =>
  names.split(";").map((name) => {
    const [nameEn, nameZh] = name.split("|");
    return { nameEn, nameZh, degreeLevel, teachingLanguage, durationYears, tuitionAmount, schoolUnit, campus };
  }),
);
if (specs.length !== 77) throw new Error(`Expected 77 BLCU graduate routes, found ${specs.length}.`);

const programs: CatalogSeedProgram[] = specs.map((spec) => ({
  slug: `beijing-language-and-culture-university-2027-${spec.degreeLevel.toLowerCase()}-${slugify(spec.nameEn)}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: spec.degreeLevel,
  durationYears: spec.durationYears,
  fieldCategory: spec.schoolUnit,
  subjectArea: spec.schoolUnit,
  teachingLanguage: spec.teachingLanguage,
  tuitionAmount: spec.tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${spec.tuitionAmount.toLocaleString("en-US")}/academic year; ${spec.durationYears} years at the ${spec.campus} campus${spec.campus.includes(" or ") ? " according to the program arrangement" : ""}.`,
  applicationUrl: pageSource.finalUrl ?? pageSource.url,
  applicationNote: "Apply through the BLCU international student application system. Program-specific entry requirements and materials follow the university application guide and application system. The CNY 800 application fee is non-refundable. Exact opening and registration dates follow the admission notice.",
  badgeText: "Fall 2027",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: pdfSource.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    nameEn: "official 2027 graduate program table, translated from the printed Chinese program direction",
    nameZh: "official 2027 graduate program table, printed program direction",
    degreeLevel: "official master or doctoral section heading",
    durationYears: "official duration/training-location column or doctoral section heading",
    fieldCategory: "official school/college column",
    subjectArea: "official school/college column",
    teachingLanguage: "official Chinese-taught or English-taught section heading",
    tuitionAmount: "official tuition/academic-year column",
    tuitionCurrency: "official tuition/academic-year column",
    tuitionPeriod: "official tuition/academic-year column",
    tuitionText: "official duration/training-location and tuition columns",
    applicationUrl: "registered HTTPS official 2027 graduate program notice",
    applicationNote: "official registration-information section",
  },
}));

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-07-31T15:59:59.000Z",
  deadlineLabel: "The official table publishes July 31, 2027 as the Fall application deadline. No time is published; the structured deadline is normalized to end of day in Beijing.",
  applicationRound: "BLCU Fall 2027 International Graduate Programs",
  status: "open",
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official Fall-entry section heading",
    intakeYear: "official 2027 title",
    deadlineDate: "official registration-information section; normalized to end of day in Beijing",
    deadlineLabel: "official registration-information section",
    applicationRound: "official 2027 graduate program title",
    status: "deadline compared with capturedAt",
  },
}));

const generatedAt = [pageSource.fetchedAt, pdfSource.fetchedAt].sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 49 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
  unresolved: [
    "The two-page table does not publish route-specific language-test thresholds or application-material details; these remain absent and are not copied from older cycles.",
    "The table publishes only the July 31, 2027 deadline; no application opening date, exact start date or registration date is inferred.",
    "No route-specific scholarship or accommodation price is published in this table, so those fields remain absent.",
  ],
  notes: [
    "Both pages of the locked PDF were rendered and visually reviewed before transcribing 58 master's and 19 doctoral routes.",
    "Program names, teaching language, duration, campus and annual tuition are transcribed only where printed in the official table.",
    "No applicant, account, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-49");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 49, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
