import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = {
  coreManifest: resolve(root, "work/catalog-official/2026-09-22T10-45-10-433Z/manifest.json"),
  languageManifest: resolve(root, "work/catalog-official/2026-09-22T10-48-46-312Z/manifest.json"),
  candidate: resolve(root, "seeds/catalog.lnutcm-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.lnutcm-complete-batch-01.validation.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [coreText, languageText] = await Promise.all([readFile(paths.coreManifest, "utf8"), readFile(paths.languageManifest, "utf8")]);
const coreManifest = JSON.parse(coreText), languageManifest = JSON.parse(languageText);
const evidence = new Map<string, any>([...(coreManifest.sources || []), ...(languageManifest.sources || [])].map((row: any) => [row.id, row]));
const expected = {
  "lnutcm-undergraduate-admissions-2026": "c21656d991347673388a8b5600feba61e7fec54125a4e775bb423744c2dbc885",
  "lnutcm-master-admissions-2026": "40b168c139b24341f1bbbfd426d68666da68ce12cfdf0670adc3c675548a7b79",
  "lnutcm-master-program-catalog-2026": "34e4fe514272087366813610fb28dd7792a4e9dfc401ac3beeb3690b17938b98",
  "lnutcm-cgs-high-level-graduate-2026": "d6fd46395d2272a6f1b08b789b7b36d7aa3462efce69d7aefaf50b38e31cf74d",
  "lnutcm-international-chinese-language-teachers-scholarship-2026": "302b20fa3f0c2e21b7bd7d64dc10406b564bd12a98e0a35b9adbb66024b728df",
  "lnutcm-chinese-language-program-2026-2027": "b23fae23d63e4c88bb0ef8f1b19fe46aca7b5e7d496b29b905a31481dc646115",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const row = evidence.get(id);
  if (!row || row.status !== 200 || row.sha256 !== digest) throw new Error(`LNUTCM evidence mismatch: ${id}`);
}

const schoolSlug = "liaoning-university-of-traditional-chinese-medicine";
const citySlug = "shenyang";
const undergraduate = evidence.get("lnutcm-undergraduate-admissions-2026");
const masterGuide = evidence.get("lnutcm-master-admissions-2026");
const masterCatalog = evidence.get("lnutcm-master-program-catalog-2026");
const languageScholarship = evidence.get("lnutcm-international-chinese-language-teachers-scholarship-2026");
const languagePage = evidence.get("lnutcm-chinese-language-program-2026-2027");
const cgs = evidence.get("lnutcm-cgs-high-level-graduate-2026");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const academicMasters = [
  ["100501", "Basic Theory of Traditional Chinese Medicine", "中医基础理论"],
  ["100502", "Clinical Foundations of Traditional Chinese Medicine", "中医临床基础"],
  ["100504", "Chinese Medicine Formula Science", "方剂学"],
  ["1005Z1", "Traditional Chinese Medicine Standardization", "中医药标准化学"],
  ["1005Z2", "Traditional Chinese Medicine Artificial Intelligence Science and Technology", "中医人工智能科学与技术"],
  ["100601", "Basic Theory of Integrated Chinese and Western Medicine", "中西医结合基础"],
  ["100506", "Traditional Chinese Medicine Internal Medicine", "中医内科学"],
  ["100507", "Traditional Chinese Medicine Surgery", "中医外科学"],
  ["100508", "Traditional Chinese Medicine Orthopedics and Traumatology", "中医骨伤科学"],
  ["100509", "Traditional Chinese Medicine Gynecology", "中医妇科学"],
  ["100510", "Traditional Chinese Medicine Pediatrics", "中医儿科学"],
  ["100512", "Acupuncture and Tuina", "针灸推拿学"],
  ["100602", "Clinical Integrated Chinese and Western Medicine", "中西医结合临床"],
  ["100701", "Medicinal Chemistry", "药物化学"],
  ["100702", "Pharmaceutics", "药剂学"],
  ["100703", "Pharmacognosy", "生药学"],
  ["100704", "Pharmaceutical Analysis", "药物分析学"],
  ["100706", "Pharmacology", "药理学"],
  ["100800", "Chinese Materia Medica", "中药学"],
  ["1005Z3", "Traditional Chinese Medicine Rehabilitation", "中医康复学"],
  ["100503", "History and Literature of Chinese Medicine", "中医医史文献"],
  ["030505", "Ideological and Political Education", "思想政治教育"],
  ["1006Z1", "Integrated Chinese and Western Medicine Nursing", "中西医结合护理"],
] as const;
const professionalMasters = [
  ["105701", "Professional Master in Traditional Chinese Medicine Internal Medicine", "中医内科学（专业学位）"],
  ["105702", "Professional Master in Traditional Chinese Medicine Surgery", "中医外科学（专业学位）"],
  ["105703", "Professional Master in Traditional Chinese Medicine Orthopedics and Traumatology", "中医骨伤科学（专业学位）"],
  ["105704", "Professional Master in Traditional Chinese Medicine Gynecology", "中医妇科学（专业学位）"],
  ["105705", "Professional Master in Traditional Chinese Medicine Pediatrics", "中医儿科学（专业学位）"],
  ["105706", "Professional Master in Traditional Chinese Medicine Otorhinolaryngology", "中医五官科学（专业学位）"],
  ["105709", "Professional Master in Clinical Integrated Chinese and Western Medicine", "中西医结合临床（专业学位）"],
  ["105900", "Professional Master in Acupuncture", "针灸（专业学位）"],
  ["105500", "Professional Master in Pharmacy", "药学（专业学位）"],
  ["105600", "Professional Master in Chinese Materia Medica", "中药（专业学位）"],
  ["105400", "Professional Master in Nursing", "护理（专业学位）"],
] as const;

function masterProgram([code, nameEn, nameZh]: readonly [string, string, string], degreeType: string): CatalogSeedProgram {
  return {
    slug: `${schoolSlug}-master-${code.toLowerCase()}-${slugify(nameEn)}`,
    schoolSlug, citySlug, nameEn, nameZh, degreeLevel: "Master", durationYears: 3,
    fieldCategory: degreeType, subjectArea: nameEn, teachingLanguage: "Chinese",
    cscaRequirement: "No CSCA requirement is published for this postgraduate route.",
    hskRequirement: "New HSK Level 4 score 180 or above.", tuitionAmount: 28000,
    tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 28,000/year",
    applicationUrl: masterGuide.url,
    applicationNote: "The official 2026 international master's guide requires prior supervisor agreement and direct submission to the university admissions office.",
    hasScholarship: true, scholarshipText: "A separate 2026 Chinese Government Scholarship high-level graduate route is published by LNUTCM.",
    status: "draft", sourceUrl: masterCatalog.url, sourceLabel: masterCatalog.label,
    sourceSha256: masterCatalog.sha256, capturedAt: masterCatalog.fetchedAt,
    sourceFieldLineage: {
      nameEn: `editorial English translation of official program code ${code}; requires review`, nameZh: `PDF program code ${code}`,
      degreeLevel: "2026 master catalog title", durationYears: `international master guide ${masterGuide.sha256}`,
      teachingLanguage: `international master guide Chinese-language threshold ${masterGuide.sha256}`,
      hskRequirement: `international master guide ${masterGuide.sha256}`, tuitionAmount: `international master guide ${masterGuide.sha256}`,
      applicationUrl: `international master guide ${masterGuide.sha256}`,
    },
  };
}

const masterPrograms = [
  ...academicMasters.map(row => masterProgram(row, "Academic Master")),
  ...professionalMasters.map(row => masterProgram(row, "Professional Master")),
];
const tcmUndergraduate: CatalogSeedProgram = {
  slug: `${schoolSlug}-undergraduate-traditional-chinese-medicine`, schoolSlug, citySlug,
  nameEn: "Traditional Chinese Medicine", nameZh: "中医学", degreeLevel: "Undergraduate", durationYears: 5,
  fieldCategory: "Medicine", subjectArea: "Traditional Chinese Medicine", teachingLanguage: "Chinese",
  cscaSubjects: ["Chinese for STEM", "Mathematics"], cscaRequirement: "CSCA Chinese for STEM and Mathematics in Chinese are required.",
  hskRequirement: "New HSK Level 4 score 180 or above.", tuitionAmount: 22000, tuitionCurrency: "CNY", tuitionPeriod: "year",
  tuitionText: "CNY 22,000/year", applicationUrl: undergraduate.url,
  applicationNote: "Official 2026 self-funded international undergraduate route; documents are submitted directly to the university admissions office.",
  hasScholarship: false, status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label,
  sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt,
  sourceFieldLineage: { nameEn: "editorial English translation of official 中医学 route; requires review", nameZh: "section II",
    degreeLevel: "guide title", durationYears: "section II", teachingLanguage: "section III", cscaSubjects: "section III",
    hskRequirement: "section III", tuitionAmount: "section IV", applicationUrl: "registered official guide URL" },
};
const languageProgram: CatalogSeedProgram = {
  slug: `${schoolSlug}-non-degree-chinese-language-one-semester-spring-2027`, schoolSlug, citySlug,
  nameEn: "Chinese Language One-Semester Study Program", nameZh: "汉语言一学期进修项目",
  degreeLevel: "Non-degree", durationMonths: 5, fieldCategory: "Chinese Language", subjectArea: "Chinese Language Study",
  teachingLanguage: "Chinese", hskRequirement: "Track-specific requirement: HSK Level 3 score 180 plus HSKK for language-education and related tracks; an HSK score for TCM and Taiji Culture tracks.",
  applicationUrl: languageScholarship.url,
  applicationNote: "March 2027 admission is explicitly published under the 2026 International Chinese Language Teachers Scholarship. The separate 2026-2027 self-funded guide attachment could not be acquired as a PDF and is not used for fees.",
  hasScholarship: true, scholarshipText: "International Chinese Language Teachers Scholarship: tuition, accommodation, medical insurance and CNY 2,500/month living allowance.",
  status: "draft", sourceUrl: languageScholarship.url, sourceLabel: languageScholarship.label,
  sourceSha256: languageScholarship.sha256, capturedAt: languageScholarship.fetchedAt,
  sourceFieldLineage: { nameEn: "scholarship category heading", nameZh: "editorial translation; requires review", degreeLevel: "one-semester category",
    durationMonths: "up to five months", teachingLanguage: "program category", hskRequirement: "category qualification paragraph",
    applicationUrl: "registered official scholarship guide URL" },
};
const programs = [tcmUndergraduate, ...masterPrograms, languageProgram];

const intake = (program: CatalogSeedProgram, source: any, values: Record<string, unknown>) => ({
  programSlug: program.slug, status: "closed", sourceUrl: source.url, sourceLabel: source.label,
  sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { deadlineDate: "official application period", intakeYear: "official guide cycle" }, ...values,
});
const programIntakes = [
  intake(tcmUndergraduate, undergraduate, { intakeTerm: "Fall", intakeYear: 2026, openDate: "2026-01-01T00:00:00.000Z", deadlineDate: "2026-06-30T00:00:00.000Z", deadlineLabel: "June 30, 2026", applicationRound: "2026 self-funded undergraduate admission" }),
  ...masterPrograms.map(program => intake(program, masterGuide, { intakeTerm: "Fall", intakeYear: 2026, openDate: "2026-01-01T00:00:00.000Z", deadlineDate: "2026-06-30T00:00:00.000Z", deadlineLabel: "June 30, 2026", applicationRound: "2026 self-funded master admission" })),
  intake(languageProgram, languageScholarship, { intakeTerm: "Spring", intakeYear: 2027, openDate: "2026-03-01T00:00:00.000Z", deadlineDate: "2026-10-31T23:59:59.000Z", deadlineLabel: "October 31, 2026 (Beijing Time)", applicationRound: "March 2027 one-semester scholarship admission", status: "open" }),
];

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarshipBase = (source: any) => ({ schoolSlug, status: "draft", sourceUrl: source.url, sourceLabel: source.label,
  sourceSha256: source.sha256, capturedAt: source.fetchedAt, providerLocation: "Shenyang, Liaoning, China", targetCountries: [], targetRegions: [],
  actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }],
  sourceFieldLineage: { title: "official page title", fundingLevel: "official coverage section", coverage: "official coverage section",
    applicableDegree: "official category section", deadlineDate: "official deadline section", eligibilityItems: "official eligibility section",
    applicationMaterials: "official materials section", applicationSteps: "official application procedure" } });
const scholarships: CatalogSeedScholarship[] = [
  { ...scholarshipBase(cgs), slug: "official-2026-lnutcm-cgs-high-level-graduate", title: "LNUTCM 2026 Chinese Government Scholarship - High-Level Graduate Program",
    nameZh: "辽宁中医药大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship",
    providerName: "国家留学基金管理委员会 / 辽宁中医药大学", providerNameEn: "China Scholarship Council / Liaoning University of Traditional Chinese Medicine",
    fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance under CSC rules.",
    applicableDegree: "Master, Doctoral", applicableProgram: "Eligible Chinese-taught LNUTCM graduate programs",
    amountText: "Full scholarship under the published CSC high-level graduate program standard.", deadlineDate: "2026-03-03",
    deadlineLabel: "March 3, 2026", applicationRound: "2026 high-level graduate scholarship",
    benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Citizenship", "Non-Chinese citizen in good physical and mental health"), info("Age", "Master under 35; doctoral under 40"), info("Language", "HSK Level 4 for Chinese-taught programs")],
    applicationMaterials: [info("Passport"), info("Degree certificate and transcript"), info("Study plan"), info("Recommendation letters"), info("Language certificate"), info("Physical examination"), info("No-criminal-record certificate"), info("Supervisor acceptance form")],
    applicationSteps: [info("Step 1", "Submit documents directly to LNUTCM International Education College"), info("Step 2", "Complete the CSC online application"), info("Step 3", "Attend the university interview if shortlisted")],
    summary: "Closed 2026 full Chinese Government Scholarship route for eligible LNUTCM graduate applicants." },
  { ...scholarshipBase(languageScholarship), slug: "official-2027-spring-lnutcm-international-chinese-language-teachers-one-semester",
    title: "LNUTCM International Chinese Language Teachers Scholarship - March 2027 One-Semester Program",
    nameZh: "辽宁中医药大学国际中文教师奖学金2027年3月一学期项目", type: "government", typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "中外语言交流合作中心 / 辽宁中医药大学", providerNameEn: "Center for Language Education and Cooperation / Liaoning University of Traditional Chinese Medicine",
    fundingLevel: "Full", coverage: "Tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance.",
    applicableDegree: "Non-degree", applicableProgram: "One-semester Chinese language and related study tracks commencing March 2027",
    amountText: "CNY 2,500/month living allowance plus tuition, accommodation and comprehensive medical insurance.",
    deadlineDate: "2026-10-31", deadlineLabel: "October 31, 2026 (Beijing Time)", applicationRound: "March 2027 admission",
    benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance", "CNY 2,500/month"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Citizenship", "Non-Chinese citizen"), info("Age", "16-35; in-service Chinese teachers may be up to 45"), info("Language", "Track-specific HSK and HSKK requirements apply"), info("Study history", "Applicants who received a similar scholarship within three years are generally ineligible")],
    applicationMaterials: [info("Passport"), info("Valid HSK/HSKK reports"), info("Recommending-institution reference"), info("LNUTCM application form"), info("Highest diploma and transcript"), info("Physical examination"), info("Commitment letter"), info("No-criminal-record certificate")],
    applicationSteps: [info("Step 1", "Apply through the International Chinese Language Teachers Scholarship system"), info("Step 2", "Select the host institution and submit materials"), info("Step 3", "Track review and final results online")],
    summary: "Current official March 2027 one-semester scholarship route. A source sentence naming another institution is treated as a publication inconsistency and is not reproduced." },
];

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: coreManifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Shenyang", nameZh: "沈阳", province: "Liaoning", region: "Northeast China",
    status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256,
    capturedAt: undergraduate.fetchedAt, sourceFieldLineage: { nameEn: "official school guide address", nameZh: "editorial identity; requires review", province: "official school guide address", region: "CUAC geographic taxonomy; requires review" } }],
  schools: [{ slug: schoolSlug, nameEn: "Liaoning University of Traditional Chinese Medicine", nameZh: "辽宁中医药大学", citySlug,
    schoolType: "Public", region: "Shenyang, Liaoning, Northeast China", applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
    languageOfInstruction: "Chinese", languageRequirement: "Chinese-taught degree routes require the published HSK threshold; scholarship non-degree routes use category-specific HSK/HSKK thresholds.",
    hskRequirement: "New HSK Level 4 score 180 for the reviewed 2026 self-funded undergraduate and master routes.",
    deadlineSummary: "2026 self-funded undergraduate and master applications closed June 30, 2026. The reviewed March 2027 one-semester scholarship route closes October 31, 2026 Beijing Time.",
    tuitionSummary: "2026 self-funded undergraduate CNY 22,000/year; master CNY 28,000/year. The March 2027 scholarship route covers tuition.",
    applicationFee: "CNY 800 for reviewed 2026 self-funded degree routes", websiteUrl: "https://www.lnutcm.edu.cn/", admissionsUrl: undergraduate.url,
    cscaRequired: true, cscaRequirement: "The reviewed 2026 undergraduate TCM route requires CSCA Chinese for STEM and Mathematics in Chinese.",
    cscaSubjects: ["Chinese for STEM", "Mathematics"], subjectTags: ["Traditional Chinese Medicine", "Integrated Medicine", "Pharmacy", "Acupuncture", "Nursing", "Chinese Language"],
    languageTags: ["Chinese"], campusHighlights: ["Main campus in Shenyang with branch campuses in Dalian and Benxi", "Traditional Chinese medicine-focused public university", `${programs.length} evidence-backed draft routes in this batch`],
    status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256,
    capturedAt: undergraduate.fetchedAt, sourceFieldLineage: { nameEn: "official guide identity", nameZh: "official guide title", citySlug: "official guide address",
      applicationLevel: `undergraduate guide plus master guide ${masterGuide.sha256} and scholarship guide ${languageScholarship.sha256}`,
      languageOfInstruction: "reviewed guide requirements", hskRequirement: `undergraduate guide and master guide ${masterGuide.sha256}`,
      deadlineSummary: `degree guides plus scholarship guide ${languageScholarship.sha256}`, tuitionSummary: `undergraduate guide plus master guide ${masterGuide.sha256}`,
      applicationFee: `undergraduate guide plus master guide ${masterGuide.sha256}`, admissionsUrl: "registered official guide URL", cscaRequirement: "undergraduate guide section III" } }],
  programs, programIntakes, scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const validationArtifact = {
  ...validation, candidateSha256: sha(candidateText), manifests: { coreSha256: sha(coreText), languageSha256: sha(languageText) },
  sourceReview: { status: "unreviewed_draft", pdfPagesVisuallyInspected: 9,
    notes: ["All nine pages of the 2026 master catalog were rendered and inspected.", "English master-program names are editorial translations and remain explicitly review-required.", "The official March 2027 scholarship guide contains one institution-name inconsistency in a process sentence; that sentence is excluded.", "The self-funded 2026-2027 Chinese-language PDF attachment returned HTML instead of a PDF and is not used for fees or self-funded intake claims."] },
  publicationAuthorized: false, databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, paths, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
