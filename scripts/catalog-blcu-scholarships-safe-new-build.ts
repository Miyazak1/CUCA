import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official/blcu-scholarships-safe-new-batch-02/manifest.json"), "utf8"));
const sourceBundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.cscalite-online-20260910.published.json"), "utf8")) as CatalogSeedBundle;
const outputPath = resolve(root, "seeds/catalog.blcu-scholarships-safe-new-batch-02.draft.json");
const validationPath = resolve(root, "seeds/catalog.blcu-scholarships-safe-new-batch-02.validation.json");
const city = sourceBundle.cities?.find((row) => row.slug === "beijing");
const school = sourceBundle.schools?.find((row) => row.slug === "beijing-language-and-culture-university");
const source = (id: string) => {
  const row = manifest.sources.find((item: any) => item.id === id);
  if (!row || row.contentType !== "text/html" || row.byteLength > 15 * 1024 * 1024) throw new Error(`Missing BLCU source: ${id}`);
  return row;
};
if (!city || !school || manifest.sources.length !== 3) throw new Error("BLCU dependencies or source manifest are incomplete.");

const info = (label: string, value?: string) => value ? { label, value } : { label };
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, data: Omit<CatalogSeedScholarship, "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt" | "sourceFieldLineage">): CatalogSeedScholarship => {
  const evidence = source(sourceId);
  return {
    ...data,
    sourceUrl: evidence.finalUrl,
    sourceLabel: evidence.label,
    sourceSha256: evidence.sha256,
    capturedAt: evidence.fetchedAt,
    sourceFieldLineage: {
      title: "official article title",
      fundingLevel: "article section: scholarship coverage and standards",
      coverage: "article section: scholarship coverage and standards",
      applicableDegree: "article section: funded categories",
      amountText: "article section: scholarship coverage and standards",
      deadlineDate: "article section: application process or application dates",
      eligibilityItems: "article section: eligibility or funded categories",
      applicationMaterials: "article section: application materials; sensitive values and contact/payment details excluded",
      applicationSteps: "article section: application process",
    },
  };
};

const scholarships: CatalogSeedScholarship[] = [
  scholarship("blcu-cgs-high-level-graduate-2026", {
    slug: "official-2026-blcu-cgs-high-level-graduate",
    schoolSlug: school.slug,
    title: "BLCU 2026 Chinese Government Scholarship - High-Level Graduate Program",
    nameZh: "北京语言大学2026年中国政府奖学金“高水平研究生”项目",
    type: "government",
    typeLabel: "Chinese Government Scholarship - High-Level Graduate Program",
    providerName: "国家留学基金管理委员会",
    providerNameEn: "China Scholarship Council",
    providerLocation: "China",
    fundingLevel: "Full",
    coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend.",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "Eligible BLCU master's and doctoral programs",
    amountText: "Master: CNY 3,000/month; Doctoral: CNY 3,500/month, plus tuition, on-campus accommodation and medical insurance.",
    requirementText: "Non-Chinese citizens in good health; master's applicants need a bachelor's degree and must be 35 or under, while doctoral applicants need a master's degree and must be 40 or under; concurrent Chinese Government Scholarships are not permitted.",
    deadlineDate: "2026-03-05",
    deadlineLabel: "17:00 Beijing Time, March 5, 2026",
    applicationRound: "2026 High-Level Graduate Program",
    benefitItems: [benefit("Tuition waiver"), benefit("On-campus accommodation"), benefit("Comprehensive medical insurance"), benefit("Master stipend", "CNY 3,000/month"), benefit("Doctoral stipend", "CNY 3,500/month")],
    eligibilityItems: [info("Citizenship and health", "Non-Chinese citizen in good physical and mental health"), info("Master applicant", "Bachelor's degree or expected bachelor's graduation; age 35 or under"), info("Doctoral applicant", "Master's degree or expected master's graduation; age 40 or under"), info("Concurrent awards", "Must not concurrently hold another Chinese Government Scholarship")],
    applicationMaterials: [info("Chinese Government Scholarship application form"), info("Highest diploma or expected-graduation proof and academic transcripts"), info("Language proficiency evidence for the selected program"), info("Study plan in Chinese or English", "At least 1,000 words; doctoral plan signed by the proposed BLCU supervisor"), info("Two professor or associate-professor recommendation letters"), info("Doctoral supervisor pre-acceptance letter", "Doctoral applicants only"), info("Physical examination and recent non-criminal-record certificate")],
    applicationSteps: [info("Step 1", "Apply in the CSC system as Type B using BLCU agency number 10032"), info("Step 2", "Apply in the BLCU international student system and upload the scholarship form and admission materials"), info("Step 3", "Complete BLCU document review and interview if shortlisted"), info("Step 4", "BLCU nominates candidates; CSC makes the final decision")],
    actionLinks: [{ label: "Official scholarship notice", url: source("blcu-cgs-high-level-graduate-2026").finalUrl, kind: "official" }, { label: "BLCU application system", url: "https://apply.blcu.edu.cn/", kind: "application" }, { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/register", kind: "application" }],
    bodySections: [{ title: "Selection", body: "BLCU reviews complete applications and may interview shortlisted applicants before nominating candidates to CSC for final review." }, { title: "Renewal", body: "Recipients must complete the annual scholarship review and normally may not change the admitted program or funded duration." }],
    tags: ["2026", "Chinese Government Scholarship", "Master", "Doctoral", "BLCU"],
    summary: "Full 2026 CSC Type B scholarship for eligible BLCU master's and doctoral applicants.",
    sortOrder: 10,
    status: "draft",
  }),
  scholarship("blcu-international-chinese-language-teachers-regular-2026", {
    slug: "official-2026-blcu-international-chinese-language-teachers-scholarship",
    schoolSlug: school.slug,
    title: "BLCU 2026 International Chinese Language Teachers Scholarship - Regular Programs",
    nameZh: "北京语言大学2026年国际中文教师奖学金常规项目",
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "教育部中外语言交流合作中心",
    providerNameEn: "Center for Language Education and Cooperation",
    providerLocation: "China",
    fundingLevel: "Full",
    coverage: "Tuition, accommodation, living allowance except for four-week study, and comprehensive medical insurance.",
    applicableDegree: "Bachelor, Master, Doctoral, One-academic-year, One-semester, Four-week",
    applicableProgram: "International Chinese language education and the specific Chinese language, literature, Chinese medicine and Tai Chi routes published for each category.",
    amountText: "Tuition, accommodation, living allowance except for four-week study, and comprehensive medical insurance; allowance amounts are not stated on the BLCU page.",
    requirementText: "Applicants must be non-Chinese citizens in good health, normally age 16-35; in-service Chinese teachers may be up to 45 and bachelor applicants are normally no older than 25. Category-specific HSK and HSKK thresholds apply.",
    deadlineDate: "2026-10-31",
    deadlineLabel: "Apr 15 for Jul 2026; May 15 for Sep 2026; Sep 15 for Dec 2026; Oct 31, 2026 for Mar 2027",
    applicationRound: "2026-2027 International Chinese Language Teachers Scholarship",
    benefitItems: [benefit("Tuition waiver"), benefit("Accommodation"), benefit("Living allowance", "Not provided for the four-week category"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("General profile", "Non-Chinese citizen in good health, committed to Chinese-language education or related work"), info("Age", "Normally 16-35 on September 1, 2026; in-service teachers up to 45; bachelor applicants normally no older than 25"), info("Doctoral", "Relevant master's degree; HSK 6 score 200 and HSKK Advanced 60, or HSK 7"), info("Master", "Bachelor's degree; HSK 5 score 210 and HSKK Intermediate 60"), info("Bachelor", "High-school diploma; HSK 4 score 210 and HSKK Intermediate 60"), info("Shorter study", "Category-specific HSK/HSKK scores apply to one-year, one-semester and four-week routes")],
    applicationMaterials: [info("Highest diploma or expected-graduation proof"), info("HSK and HSKK score reports", "Valid for two years"), info("Recommendation from an eligible recommending institution"), info("Academic transcripts and academic recommendation letters", "Degree applicants as specified by category"), info("Study or research plan", "Required for master's and doctoral applicants"), info("Supervisor acceptance letter", "Doctoral applicants"), info("Employment proof and recommendation", "In-service Chinese teachers, when applicable")],
    applicationSteps: [info("Step 1", "Apply through the official International Chinese Language Teachers Scholarship platform from March 1, 2026"), info("Step 2", "Select BLCU and the eligible study category, and submit the required supporting materials"), info("Step 3", "Track institutional review and scholarship assessment online"), info("Step 4", "If awarded, confirm admission arrangements with BLCU and register by the admission-letter date")],
    actionLinks: [{ label: "Official scholarship notice", url: source("blcu-international-chinese-language-teachers-regular-2026").finalUrl, kind: "official" }, { label: "Official scholarship platform", url: "https://www.chinese.cn/", kind: "application" }],
    bodySections: [{ title: "Published categories", body: "The notice covers doctoral, master's and bachelor's degree study plus one-academic-year, one-semester and four-week study, each with its own duration and language threshold." }, { title: "Award conditions", body: "Degree recipients undergo annual review. Duplicate applications for government-funded scholarships are not permitted, and failure to register or pass the required health review may cancel the award." }],
    tags: ["2026", "2027", "International Chinese Language Teachers Scholarship", "Degree", "Short-term", "BLCU"],
    summary: "BLCU's 2026-2027 regular International Chinese Language Teachers Scholarship routes across degree and short-study categories.",
    sortOrder: 20,
    status: "draft",
  }),
  scholarship("blcu-beijing-government-scholarship-2026-2027", {
    slug: "official-2026-2027-blcu-beijing-government-scholarship",
    schoolSlug: school.slug,
    title: "BLCU Beijing Government Scholarship - 2026 Autumn and 2027 Spring Intakes",
    nameZh: "北京语言大学北京市外国留学生奖学金（2026年秋季与2027年春季）",
    type: "government",
    typeLabel: "Beijing Government Scholarship",
    providerName: "北京市政府 / 北京语言大学",
    providerNameEn: "Beijing Municipal Government / Beijing Language and Culture University",
    providerLocation: "Beijing, China",
    fundingLevel: "Partial",
    coverage: "First-year tuition only; all other expenses are self-funded.",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Eligible BLCU bachelor, master and doctoral programs",
    amountText: "First-year tuition waiver; the page does not publish a cash amount.",
    requirementText: "Non-Chinese applicants in good health and good academic standing; normally under age 30 for bachelor, under 35 for master and under 40 for doctoral study as of September 1, 2026.",
    deadlineDate: "2027-01-12",
    deadlineLabel: "Jul 15, 2026 for Sep 2026 intake; Jan 12, 2027 for Mar 2027 intake",
    applicationRound: "September 2026 and March 2027 intakes",
    benefitItems: [benefit("First-year tuition", "Covered"), { label: "Accommodation", included: false, note: "Self-funded" }, { label: "Living expenses", included: false, note: "Self-funded" }, { label: "Insurance and other costs", included: false, note: "Self-funded" }],
    eligibilityItems: [info("Citizenship and conduct", "Non-Chinese citizen, compliant with Chinese law and BLCU rules"), info("Academic and health", "Good health and strong academic standing"), info("Bachelor age", "Normally under 30 on September 1, 2026"), info("Master age", "Normally under 35 on September 1, 2026"), info("Doctoral age", "Normally under 40 on September 1, 2026")],
    applicationMaterials: [info("Beijing Government Scholarship application form for new students"), info("BLCU admission materials for the selected bachelor, master or doctoral program")],
    applicationSteps: [info("Step 1", "Complete the new-student Beijing Government Scholarship form"), info("Step 2", "Apply in the BLCU international student system and upload the scholarship form with the selected program's admission materials"), info("Step 3", "BLCU's international-student scholarship committee reviews eligible applications"), info("Step 4", "Results are published in August 2026 or February 2027 for the corresponding intake")],
    actionLinks: [{ label: "Official scholarship page", url: source("blcu-beijing-government-scholarship-2026-2027").finalUrl, kind: "official" }, { label: "BLCU application system", url: "https://apply.blcu.edu.cn/", kind: "application" }],
    bodySections: [{ title: "Coverage limitation", body: "The published award covers first-year tuition only. Accommodation, insurance, living costs and all other expenses remain the student's responsibility." }, { title: "Selection", body: "The BLCU international-student scholarship committee evaluates applications; an application does not guarantee an award." }],
    tags: ["2026", "2027", "Beijing Government Scholarship", "Bachelor", "Master", "Doctoral", "BLCU"],
    summary: "First-year tuition scholarship for eligible new BLCU degree students entering in September 2026 or March 2027.",
    sortOrder: 30,
    status: "draft",
  }),
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok || validation.summary.scholarships !== 3) throw new Error(`Invalid BLCU scholarship candidate: ${validation.errors.join(" ")}`);
await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, validationPath, scholarshipCount: scholarships.length, bundleSha256: validation.bundleSha256 }, null, 2));
