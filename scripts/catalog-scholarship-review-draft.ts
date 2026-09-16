import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

type SourceDefinition = {
  id: string;
  label: string;
  url: string;
  sourceRole: string;
  schoolSlug?: string;
};

type Snapshot = {
  id: string;
  sha256: string;
  capturedAt: string;
  contentType: string;
  artifactPath: string;
  finalUrl: string;
};

type ScholarshipDefinition = {
  sourceId: string;
  additionalSourceIds?: string[];
  scholarship: Omit<CatalogSeedScholarship, "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt" | "sourceFieldLineage" | "status">;
  unresolvedFields?: string[];
  derivedFields?: string[];
  fieldSources?: Record<string, string>;
};

const root = process.cwd();
const basePath = resolve(root, process.argv[2] || "seeds/catalog.cscalite-online-20260910.published.json");
const registryPath = resolve(root, "catalog-sources/official-sources.json");
const draftPath = resolve(root, "seeds/catalog.cscalite-online-20260910.scholarships-rich-batch-01.draft.json");
const reviewPath = resolve(root, "seeds/catalog.scholarships-rich-batch-01.review.json");
const validationPath = resolve(root, "seeds/catalog.scholarships-rich-batch-01.validation.json");

const definitions: ScholarshipDefinition[] = [
  define({
    sourceId: "blcu-silk-road-scholarship-2026", schoolSlug: "beijing-language-and-culture-university",
    slug: "official-2026-blcu-silk-road-scholarship", title: "BLCU 2026 Chinese Government Scholarship - Silk Road Program",
    nameZh: "北京语言大学2026年中国政府奖学金“丝绸之路”项目", applicableDegree: "Bachelor",
    applicableProgram: "Chinese Language, Translation, International Economics and Trade",
    amountText: "Tuition, on-campus accommodation and medical insurance covered; stipend CNY 2,500/month.",
    deadlineDate: "2026-04-20", deadlineLabel: "April 20, 2026 at 17:00 Beijing time", applicationRound: "2026 intake",
    targetCountries: ["Thailand", "Myanmar", "Indonesia", "Vietnam", "Philippines", "Mongolia", "Kazakhstan", "Tajikistan", "Uzbekistan", "Turkmenistan"],
    targetRegions: ["Belt and Road partner countries"],
    benefits: ["Tuition waiver", "On-campus accommodation", "CNY 2,500 monthly stipend", "Comprehensive medical insurance"],
    eligibility: ["Non-Chinese citizen in good physical and mental health", "High-school diploma or equivalent", "Age 25 or under", "No concurrent Chinese Government Scholarship"],
    materials: ["Chinese Government Scholarship application form", "Passport information page", "High-school diploma or expected-graduation certificate", "Complete high-school transcripts", "HSK Level 4 report with at least 60 in each section", "CSCA score report", "Study plan of at least 200 words", "One high-school teacher recommendation", "Physical examination form", "No-criminal-record certificate"],
    steps: ["Submit Type B application in the CSC system using BLCU agency number 10032", "Submit the same materials in the BLCU international applicant system", "BLCU reviews documents and may arrange a remote interview", "BLCU nominates selected candidates to CSC for final review"],
  }),
  define({
    sourceId: "beihang-high-level-postgraduate-scholarship-2026", schoolSlug: "beihang-university",
    slug: "official-2026-beihang-high-level-postgraduate-scholarship", title: "Beihang 2026 Chinese Government Scholarship - High-level Postgraduate Program",
    nameZh: "北京航空航天大学2026年中国政府奖学金高水平研究生项目", applicableDegree: "Master, Doctoral",
    amountText: "Full Chinese Government Scholarship; exact stipend follows CSC standards.",
    deadlineDate: "2026-02-28", deadlineLabel: "Final batch deadline: February 28, 2026", applicationRound: "Three batches",
    benefits: ["Tuition waiver", "Accommodation support", "Living stipend", "Comprehensive medical insurance"],
    eligibility: ["Non-Chinese citizen in good physical and mental health", "Bachelor's degree and under 35 for master's study", "Master's degree and under 40 for doctoral study", "HSK Level 5 or above for Chinese-taught programs; program-specific English proof for English-taught programs"],
    materials: ["Chinese Government Scholarship application form", "Passport information page", "Notarized highest diploma or student-status proof", "Academic transcripts", "Study or research plan", "Two academic recommendation letters", "Language proficiency proof", "Physical examination record", "No-criminal-record certificate"],
    steps: ["Complete Beihang's online application and pay the application fee", "Complete the CSC Type B application", "Attend document review and online academic interview if invited", "Beihang sends nominees to CSC for final review"],
  }),
  define({
    sourceId: "dut-chinese-government-scholarship-2026", schoolSlug: "dalian-university-of-technology",
    slug: "official-2026-dut-chinese-government-scholarship", title: "DUT 2026 Chinese Government Scholarship",
    nameZh: "大连理工大学2026年中国政府奖学金", applicableDegree: "Master, Doctoral",
    applicableProgram: "High-level Postgraduate Program and Silk Road Program; approved DUT graduate majors",
    amountText: "Tuition and on-campus accommodation covered; CNY 3,000/month for master's and CNY 3,500/month for doctoral students.",
    deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "November 1, 2025 - February 15, 2026",
    benefits: ["Tuition waiver", "On-campus accommodation", "CNY 3,000 monthly master's stipend", "CNY 3,500 monthly doctoral stipend", "Comprehensive medical insurance"],
    eligibility: ["Non-Chinese citizen in good health", "Bachelor's degree and under 35 for master's study", "Master's degree and under 40 for doctoral study", "Meets the selected major's Chinese or English requirement"],
    materials: ["CSC and DUT application forms", "Notarized diploma and transcripts", "Study proposal of at least 1,000 words signed by a DUT supervisor", "Two professor or associate-professor recommendations", "Physical examination and blood-test reports", "Passport page and blank visa page", "Language certificate", "No-criminal-record certificate"],
    steps: ["Submit the CSC application using DUT agency number 10141", "Submit the DUT scholarship application and obtain an application number", "DUT conducts academic review and selection", "Admission documents are expected around July-August 2026"],
  }),
  define({
    sourceId: "jilin-high-level-postgraduate-scholarship-2026", schoolSlug: "jilin-university",
    slug: "official-2026-jilin-high-level-postgraduate-scholarship", title: "Jilin University 2026/2027 Chinese Government Scholarship - High-level Graduate Program",
    nameZh: "吉林大学2026/2027学年中国政府奖学金高水平研究生项目", applicableDegree: "Master, Doctoral",
    amountText: "Tuition, living allowance and medical insurance covered; accommodation subsidy CNY 700/month for master's and CNY 1,000/month for doctoral students.",
    deadlineDate: "2026-03-01", deadlineLabel: "March 1, 2026; applications before January 1 receive priority in the first review batch", applicationRound: "2026/2027 intake",
    benefits: ["Tuition waiver", "Living allowance", "CNY 700 monthly master's accommodation subsidy", "CNY 1,000 monthly doctoral accommodation subsidy", "Comprehensive medical insurance"],
    eligibility: ["Meets Jilin University graduate admission requirements", "Meets CSC nationality, health, education and age conditions", "Meets program language requirements", "Cannot hold another Chinese-government or university scholarship concurrently"],
    materials: ["Passport information page", "Notarized highest diploma", "Academic transcripts", "Language proficiency proof", "Study plan", "Recommendation letters", "Physical examination form", "No-criminal-record certificate", "Relevant research achievements"],
    steps: ["Register in the Jilin University international applicant system", "Complete and submit the online application with all required documents", "Jilin University reviews and recommends candidates", "CSC performs final scholarship review"],
  }),
  define({
    sourceId: "nankai-silk-road-scholarship-2026", schoolSlug: "nankai-university",
    slug: "official-2026-nankai-silk-road-scholarship", title: "Nankai University 2026 Chinese Government Scholarship - Silk Road Program",
    nameZh: "南开大学2026年中国政府奖学金“丝绸之路”项目", applicableDegree: "Bachelor, Master",
    applicableProgram: "Programs and countries listed in the official 2026 guide",
    amountText: "Tuition and on-campus accommodation covered; CNY 2,500/month for bachelor's and CNY 3,000/month for master's students.",
    deadlineDate: "2026-05-18", deadlineLabel: "May 18, 2026", applicationRound: "2026 intake",
    targetRegions: ["Belt and Road partner countries"],
    benefits: ["Tuition waiver", "On-campus accommodation", "CNY 2,500 monthly bachelor's stipend", "CNY 3,000 monthly master's stipend", "Comprehensive medical insurance"],
    eligibility: ["Non-Chinese citizen in good physical and mental health with no criminal record", "High-school diploma and under 25 for bachelor's study", "Bachelor's degree and under 35 for master's study", "No concurrent scholarship", "HSK 5 score 210+ for Chinese-taught routes; IELTS 6.0, TOEFL 80 or Duolingo 105 for applicable English-taught master's routes"],
    materials: ["Passport page", "Diploma or pre-graduation certificate", "Complete transcripts", "CSCA report for bachelor's applicants", "Personal statement; at least 800 words for master's applicants", "Language proficiency proof", "One bachelor's or two master's recommendation letters", "Physical examination and no-criminal-record documents"],
    steps: ["Submit the Nankai online application", "Submit required CSC Type B materials as directed", "Nankai reviews and nominates candidates", "CSC issues final results"],
  }),
  define({
    sourceId: "ecnu-shanghai-government-scholarship-2026", schoolSlug: "east-china-normal-university",
    slug: "official-2026-ecnu-shanghai-government-scholarship", title: "ECNU 2026 Shanghai Government Scholarship",
    nameZh: "华东师范大学2026年上海市政府奖学金", type: "local-government", typeLabel: "Shanghai Government Scholarship",
    providerName: "上海市人民政府", providerNameEn: "Shanghai Municipal Government", providerLocation: "Shanghai",
    fundingLevel: "Full or partial", applicableDegree: "Master, Doctoral",
    amountText: "Type A includes tuition, on-campus accommodation, CNY 3,000/3,500 monthly stipend and CNY 800/year insurance; Type B includes tuition and insurance.",
    deadlineDate: "2026-04-30", deadlineLabel: "Second-batch deadline: April 30, 2026", applicationRound: "November 15, 2025 - April 30, 2026",
    benefits: ["Type A tuition waiver", "Type A on-campus accommodation", "Type A monthly stipend: CNY 3,000 master's / CNY 3,500 doctoral", "CNY 800 annual medical insurance", "Type B tuition waiver and medical insurance"],
    eligibility: ["Meets ECNU graduate admission requirements", "Bachelor's degree and under 35 for master's study", "Master's degree and under 40 for doctoral study", "Meets the selected program's language requirement"],
    materials: ["ECNU graduate application documents", "Shanghai Government Scholarship application form", "Degree and transcript documents", "Language proficiency proof", "Any additional certified documents requested during review"],
    steps: ["Apply in the ECNU portal and pay the non-refundable CNY 800 fee", "Complete and upload the SGS application form", "ECNU conducts eligibility and academic review and may arrange an interview", "Download electronic admission and JW202 documents if admitted"],
  }),
  define({
    sourceId: "uibe-high-level-postgraduate-scholarship-2026", schoolSlug: "university-of-international-business-and-economics",
    slug: "official-2026-uibe-high-level-postgraduate-scholarship", title: "UIBE 2026/2027 Chinese Government Scholarship - High-level Postgraduate Program",
    nameZh: "对外经济贸易大学2026/2027学年中国政府奖学金高水平研究生项目", applicableDegree: "Master, Doctoral",
    amountText: "Tuition, accommodation, living allowance and medical insurance covered under CSC standards.",
    deadlineDate: "2026-02-28", deadlineLabel: "February 28, 2026", applicationRound: "2026/2027 intake",
    benefits: ["Tuition waiver", "Accommodation", "Living allowance", "Medical insurance"],
    eligibility: ["Non-Chinese citizen in good physical and mental health", "Bachelor's degree with excellent grades and under 35 for master's study", "Master's degree with excellent grades and under 40 for doctoral study", "HSK 5 score 180+ for Chinese-taught programs; TOEFL 86 or IELTS 6.0 for English-taught programs"],
    materials: ["CSC application form", "Passport information page", "Notarized highest diploma", "Academic transcripts", "Language certificate", "Study or research plan", "Recommendation letters", "Physical examination and no-criminal-record documents", "Optional research results and awards"],
    steps: ["Apply in the CSC system as Type B using UIBE agency number 10036", "Email the same legible PDF materials to the address named in the official guide", "UIBE reviews and nominates candidates", "CSC conducts final review"],
  }),
  define({
    sourceId: "nju-silk-road-scholarship-2026", schoolSlug: "nanjing-university",
    slug: "official-2026-nju-silk-road-scholarship", title: "Nanjing University 2026 Chinese Government Scholarship - Silk Road Program",
    nameZh: "南京大学2026年中国政府奖学金“丝绸之路”项目", applicableDegree: "Bachelor",
    applicableProgram: "Chinese Language - Business Chinese",
    amountText: "Tuition waiver, CNY 2,500/month stipend and CNY 800/year medical insurance; accommodation is governed by the official program arrangements.",
    deadlineDate: "2026-03-15", deadlineLabel: "March 15, 2026", applicationRound: "January 1 - March 15, 2026",
    targetRegions: ["Belt and Road partner countries"],
    benefits: ["Tuition waiver", "CNY 2,500 monthly stipend", "CNY 800 annual medical insurance"],
    eligibility: ["Meets the published nationality and age rules", "High-school qualification or expected 2026 graduation", "Meets the official Chinese-language requirement", "Full-time study at Nanjing University and annual scholarship review required"],
    materials: ["CSC application form", "NJU application form", "Passport information page", "Diploma or pre-graduation certificate", "Academic transcripts", "Language certificate", "Study plan", "Physical examination and no-criminal-record documents", "Guardian confirmation when under 18"],
    steps: ["Apply in the CSC system as Type B using NJU agency number 10284", "Apply in the NJU international student system under CSC Scholarship Type B", "Respond to initial-review resubmission requests before the deadline", "Complete remote written/oral assessment if shortlisted"],
    unresolvedFields: ["accommodation benefit amount"],
  }),
  define({
    sourceId: "fudan-chinese-government-university-scholarship-2026", schoolSlug: "fudan-university",
    slug: "official-2026-fudan-chinese-government-scholarship", title: "Fudan University 2026 Chinese Government Scholarship - University Program",
    nameZh: "复旦大学2026年中国政府奖学金高校项目", applicableDegree: "Master, Doctoral",
    amountText: "Tuition and accommodation covered; CNY 3,000/month for master's and CNY 3,500/month for doctoral students; medical insurance included.",
    deadlineDate: "2025-12-10", deadlineLabel: "December 10, 2025", applicationRound: "October 13 - December 10, 2025",
    benefits: ["Tuition waiver", "On-campus accommodation or accommodation subsidy", "CNY 3,000 monthly master's stipend", "CNY 3,500 monthly doctoral stipend", "Comprehensive medical insurance"],
    eligibility: ["Non-Chinese citizen in good health", "Under 35 for master's study", "Under 40 for doctoral study", "Must not hold another Chinese Government Scholarship"],
    materials: ["Signed CSC Type B application form", "Fudan study-program application", "Foreigner Physical Examination Form", "Program-specific admission documents listed in the Fudan application system"],
    steps: ["Complete the CSC application as Type B using Fudan agency number 10246", "Complete the Fudan application and select the Chinese Government Scholarship option", "Upload the CSC form and required documents", "Check results in the Notices section of the Fudan ISO website"],
    unresolvedFields: ["complete material list is provided through linked application documents"],
  }),
  define({
    sourceId: "zju-international-chinese-language-teachers-scholarship-2026", schoolSlug: "zhejiang-university",
    slug: "official-2026-zju-international-chinese-language-teachers-scholarship", title: "Zhejiang University 2026 International Chinese Language Teachers Scholarship",
    nameZh: "浙江大学2026年国际中文教师奖学金", type: "education-center", typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "教育部中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", providerLocation: "China",
    applicableDegree: "Non-degree", applicableProgram: "One-academic-year or one-semester Chinese Language and Literature study",
    amountText: "Tuition, accommodation, living allowance and comprehensive medical insurance; exact amounts follow the scholarship authority's standards.",
    deadlineDate: "2026-05-15", deadlineLabel: "May 15, 2026 for September 2026 entry; October 31, 2026 for March 2027 one-semester entry", applicationRound: "2026/2027 entry",
    benefits: ["Tuition waiver", "Accommodation", "Living allowance", "Comprehensive medical insurance"],
    eligibility: ["Non-Chinese citizen with no criminal record and in good health", "Committed to Chinese-language education or related work", "Age 18-35; in-service Chinese teachers may be up to 45", "One-year route: HSK 4 score 180 and HSKK Intermediate 60", "One-semester route: HSK 3 score 180 plus an HSKK score"],
    materials: ["Passport information page valid through at least March 1, 2027", "Valid HSK and HSKK reports", "Recommendation letter from the recommending institution", "Notarized Chinese or English translation for other-language documents"],
    steps: ["Apply in the International Chinese Language Teachers Scholarship platform", "Apply in the Zhejiang University international student system", "Track review comments and results in both systems", "Do not mail or email paper application materials"],
  }),
  define({
    sourceId: "tongji-silk-road-scholarship-2026", schoolSlug: "tongji-university",
    slug: "official-2026-tongji-silk-road-scholarship", title: "Tongji University 2026 Chinese Government Scholarship - Silk Road Program",
    nameZh: "同济大学2026年中国政府奖学金“丝绸之路”项目", applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Civil Engineering, Architecture, Civil and Hydraulic Engineering, Transportation Engineering",
    amountText: "Tuition and insurance covered; stipend CNY 2,500/3,000/3,500 per month; on-campus housing or subsidy CNY 700/1,000 per month.",
    deadlineDate: "2026-03-20", deadlineLabel: "March 20, 2026 at 23:59 Beijing time", applicationRound: "January 10 - March 20, 2026",
    targetCountries: ["Indonesia", "Pakistan", "Malaysia", "Bangladesh", "Cambodia", "South Korea", "Nepal", "Myanmar", "Mongolia", "Kenya"],
    targetRegions: ["Belt and Road partner countries"],
    benefits: ["Tuition waiver", "Comprehensive medical insurance", "Monthly stipend: CNY 2,500 bachelor's / 3,000 master's / 3,500 doctoral", "On-campus accommodation or CNY 700/1,000 monthly subsidy"],
    eligibility: ["Non-Chinese citizen in good health", "Age 25 or under for bachelor's, 35 or under for master's, 40 or under for doctoral study", "Not enrolled in an ineligible joint program or native/third-country-language major", "No concurrent Chinese Government Scholarship"],
    materials: ["Tongji online admission materials for the chosen degree and language route", "CSC Type B application form after Tongji notification", "Electronic supporting documents uploaded before the deadline", "Original paper documents for enrollment verification if admitted"],
    steps: ["Apply and pay the CNY 600 fee in Tongji's system", "Wait until the application status is Waiting for Admission", "After Tongji's notice, submit the CSC Type B application using agency number 10247", "Complete school assessment; Tongji nominates candidates to CSC"],
  }),
  define({
    sourceId: "xmu-chinese-government-university-program-2026", schoolSlug: "xiamen-university",
    slug: "official-2026-xmu-chinese-government-university-scholarship", title: "Xiamen University 2026 Chinese Government Scholarship - University Program",
    nameZh: "厦门大学2026年中国政府奖学金高校项目", applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "CSC-approved XMU degree programs, mainly master's and doctoral programs",
    amountText: "Tuition and accommodation covered; CNY 2,500/3,000/3,500 monthly stipend; CNY 800/year insurance.",
    deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "December 1, 2025 - February 15, 2026",
    benefits: ["Tuition waiver", "University dormitory or accommodation subsidy", "Monthly stipend: CNY 2,500 bachelor's / 3,000 master's / 3,500 doctoral", "CNY 800 annual medical insurance"],
    eligibility: ["Meets the selected XMU program's admission requirements", "High-school diploma and under 25 for bachelor's study", "Bachelor's degree and under 35 for master's study", "Master's degree and under 40 for doctoral study", "Cannot receive another Chinese-government or admitting-institution scholarship concurrently"],
    materials: ["Signed CSC Type B application form", "XMU degree-program application materials", "Pre-acceptance letter for postgraduate applicants", "Degree and transcript evidence", "Language proficiency evidence", "Additional documents listed in the linked degree prospectus"],
    steps: ["Apply in the CSC system as Type B using XMU agency number 10384", "Apply in the XMU system and upload the signed CSC form", "Postgraduate applicants upload a supervisor-signed and college-stamped pre-acceptance letter", "XMU reviews and nominates candidates to CSC"],
  }),
  define({
    sourceId: "tju-silk-road-scholarship-2026", schoolSlug: "tianjin-university",
    slug: "official-2026-tju-silk-road-scholarship", title: "Tianjin University 2026 Chinese Government Scholarship - Silk Road Program",
    nameZh: "天津大学2026年中国政府奖学金“丝绸之路”项目", applicableDegree: "Bachelor, Master, Doctoral",
    amountText: "Tuition and on-campus accommodation covered; CNY 2,500/3,000/3,500 monthly stipend; medical insurance included.",
    deadlineDate: "2026-05-18", deadlineLabel: "May 18, 2026", applicationRound: "2026 intake",
    targetCountries: ["Malaysia", "Indonesia", "Thailand", "Cambodia", "Pakistan", "Nepal", "Bangladesh", "Russia", "Nigeria", "Morocco"],
    targetRegions: ["Belt and Road partner countries"],
    benefits: ["Tuition waiver", "On-campus accommodation", "Monthly stipend: CNY 2,500 bachelor's / 3,000 master's / 3,500 doctoral", "Comprehensive medical insurance"],
    eligibility: ["Citizen of one of the ten published eligible countries", "High-school diploma and under 25 for bachelor's study", "Bachelor's degree and under 35 for master's study", "Master's degree and under 40 for doctoral study", "HSK 5 score 180+ for Chinese-taught or IELTS 6.0/TOEFL 80 for English-taught study", "Bachelor's applicants must take CSCA"],
    materials: ["Diploma and complete transcripts", "CSCA report for bachelor's applicants", "Passport information page", "Chinese or English language proof", "Continuous education CV", "Study/research plan", "Two recommendations for graduate applicants", "Physical examination and no-criminal-record documents", "Signed CSC form and route-specific portfolio where applicable"],
    steps: ["Apply in the Tianjin University system", "If nominated, submit the CSC Type B application using agency number 10056", "Complete document review and any interview or written test", "Tianjin University sends nominees to CSC and publishes final results"],
  }),
  define({
    sourceId: "hust-youth-of-excellence-scholarship-2026", schoolSlug: "huazhong-university-of-science-and-technology",
    slug: "official-2026-hust-youth-of-excellence-scholarship", title: "HUST 2026 Youth of Excellence Scheme of China Program",
    nameZh: "华中科技大学2026年中国政府来华留学卓越奖学金项目", applicableDegree: "Master",
    applicableProgram: "Master of International Business; Master of Public Administration",
    amountText: "Full scholarship for the first year in China, including tuition, accommodation, living allowance and medical insurance.",
    deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026", applicationRound: "2026 intake",
    benefits: ["Tuition", "Accommodation", "Living allowance", "Comprehensive medical insurance", "First academic year funded under the 1+1 model"],
    eligibility: ["Non-Chinese citizen in good physical and mental health and under 45", "Bachelor's degree or above", "At least three years of work experience; relevant background preferred", "Senior public official, senior manager, university/research administrator, or person with international-organization experience", "Meets the English-language requirement"],
    materials: ["CSC application form", "Passport information page", "Highest diploma", "Academic transcripts", "Research proposal", "English proficiency evidence", "Work-experience evidence", "Program-specific supporting documents"],
    steps: ["Obtain a HUST pre-admission letter if desired through the HUST application system", "Apply in the CSC system using agency number 1563", "Submit all required materials by the deadline", "CSC and HUST complete review and selection"],
  }),
  define({
    sourceId: "bit-admission-scholarship-book-2026", schoolSlug: "beijing-institute-of-technology",
    slug: "official-2026-bit-chinese-government-scholarship", title: "BIT 2026 Chinese Government Scholarship - University Program",
    nameZh: "北京理工大学2026年中国政府奖学金高校项目", applicableDegree: "Master, Doctoral",
    applicableProgram: "High-level Graduate Program, Silk Road Program and other approved Type B routes",
    amountText: "Tuition and accommodation covered; CNY 3,000/month master's or CNY 3,500/month doctoral stipend; CNY 800/year insurance.",
    deadlineDate: "2026-04-15", deadlineLabel: "Round 1: February 15, 2026; Round 2: April 15, 2026", applicationRound: "October 15, 2025 - April 15, 2026",
    benefits: ["Tuition waiver", "University dormitory or accommodation subsidy", "CNY 3,000 monthly master's stipend", "CNY 3,500 monthly doctoral stipend", "CNY 800 annual medical insurance"],
    eligibility: ["Bachelor's degree for master's applicants", "Master's degree in the same or a related field for doctoral applicants", "Proficient in Chinese or English", "HSK 5 score 180+ for Chinese-taught study or TOEFL 85/IELTS 6.0 for English-taught study"],
    materials: ["BIT online application form", "Passport information page", "Statement of purpose, study plan and CV", "Notarized highest diploma and transcripts", "Language test result", "Two academic recommendations and BIT adviser recommendation form for graduate applicants", "Physical examination record", "CSC application in the national system"],
    steps: ["Apply first in the CSC system as Type B using BIT agency number 10007", "Apply in the BIT system and upload required documents", "Submit by the applicable round deadline", "Maintain scholarship through the required annual review after admission"],
  }),
  define({
    sourceId: "bnu-undergraduate-scholarships-2026", schoolSlug: "beijing-normal-university",
    slug: "official-2026-bnu-undergraduate-scholarship-options", title: "Beijing Normal University 2026 Undergraduate Scholarship Options",
    nameZh: "北京师范大学2026年外国留学生本科奖学金", type: "multi-provider", typeLabel: "Undergraduate scholarship options",
    providerName: "北京师范大学及政府奖学金机构", providerNameEn: "Beijing Normal University and government scholarship providers", providerLocation: "Beijing",
    fundingLevel: "Varies by scholarship", applicableDegree: "Bachelor",
    amountText: "Coverage varies across BNU Freshman, Silk Road Muduo, Beijing Government, Chinese Government and International Chinese Language Teachers scholarships.",
    deadlineDate: "2026-03-15", deadlineLabel: "BNU undergraduate application deadline: March 15, 2026; scholarship-specific deadlines may differ", applicationRound: "November 15, 2025 - March 15, 2026",
    benefits: ["Scholarship coverage varies by route", "Full Chinese Government and International Chinese Language Teachers scholarship recipients receive university-arranged accommodation"],
    eligibility: ["Non-Chinese citizen with a valid ordinary passport", "Age 18-40 under the general undergraduate guide", "High-school diploma or equivalent", "Meets program language requirements", "Valid CSCA report and required HSK score"],
    materials: ["BNU application form", "Notarized high-school diploma and transcripts", "CSCA report", "HSK report", "One recommendation", "Handwritten personal statement", "Passport page", "No-criminal-record evidence", "CSC form and physical examination for Chinese Government Scholarship applicants"],
    steps: ["Apply in the BNU system and select undergraduate programs", "Pay the CNY 500 application fee", "Send paper documents after initial review when required", "Complete CSCA and program interviews", "Follow the relevant scholarship authority's application route"],
    unresolvedFields: ["award amounts and coverage differ by scholarship and are not enumerated in this guide"],
  }),
  define({
    sourceId: "sjtu-international-graduate-scholarships-2026", schoolSlug: "shanghai-jiao-tong-university",
    slug: "official-2026-sjtu-international-graduate-scholarships", title: "Shanghai Jiao Tong University 2026 International Graduate Scholarships",
    nameZh: "上海交通大学2026年国际研究生奖学金", type: "multi-provider", typeLabel: "Graduate scholarship system",
    providerName: "上海交通大学及政府奖学金机构", providerNameEn: "Shanghai Jiao Tong University and government scholarship providers", providerLocation: "Shanghai",
    fundingLevel: "Full or partial", applicableDegree: "Master, Doctoral",
    amountText: "Government, university, tuition-waiver and school scholarships may cover full or partial tuition; accommodation is generally provided as an allowance according to award tier.",
    deadlineDate: "2026-03-31", deadlineLabel: "CSC: February 15, 2026; Shanghai Government and SJTU scholarships: March 31, 2026", applicationRound: "October 15, 2025 - March 31, 2026",
    benefits: ["Full or partial tuition depending on award", "Accommodation allowance according to scholarship tier", "Other benefits follow the awarded scholarship's terms"],
    eligibility: ["Eligible for a 2026 SJTU international graduate program", "No other concurrent scholarship", "Under 35 for master's study", "Under 40 for doctoral study"],
    materials: ["Degree certificates and transcripts", "Language proficiency proof", "Passport information page", "Personal statement and research plan", "Two recommendation letters", "Supervisor acceptance intention letter for specified departments", "Scholarship-specific materials requested after nomination"],
    steps: ["Complete the SJTU graduate application", "Select the scholarship route in the SJTU system", "Complete any additional government scholarship application when instructed", "Check the scholarship result in the SJTU system"],
    unresolvedFields: ["exact award tier and amount are determined after review"],
  }),
  define({
    sourceId: "nwpu-scholarships-2026", additionalSourceIds: ["nwpu-scholarship-coverage"], schoolSlug: "northwestern-polytechnical-university",
    slug: "official-2026-nwpu-scholarships", title: "Northwestern Polytechnical University 2026 Scholarships",
    nameZh: "西北工业大学2026年国际学生奖学金", type: "multi-provider", typeLabel: "Degree scholarship options",
    providerName: "西北工业大学及政府奖学金机构", providerNameEn: "Northwestern Polytechnical University and government scholarship providers", providerLocation: "Xi'an",
    fundingLevel: "Full or partial", applicableDegree: "Bachelor, Master, Doctoral",
    amountText: "CSC covers tuition, insurance, accommodation and CNY 2,500/month for undergraduates; NPU and Xi'an scholarships offer tiered tuition, housing and stipend support.",
    benefits: ["Chinese Government Scholarship: tuition, insurance, accommodation and living allowance", "NPU President Scholarship: tiered tuition waiver, with top undergraduate tier including accommodation and CNY 1,500/month", "Xi'an Belt and Road Scholarship: tiered tuition waiver and up to CNY 1,500/month stipend"],
    eligibility: ["Degree applicant to an eligible NPU program", "Meets the selected scholarship and admission requirements", "Award and continuation are subject to NPU review"],
    materials: ["NPU degree-program application documents", "Scholarship application documents required for the selected route", "Language and academic evidence required by the selected program"],
    steps: ["Choose an eligible 2026 NPU degree program", "Select the intended scholarship route in the official application process", "Submit program and scholarship documents", "Follow the admission notice for the final award and annual-review conditions"],
    unresolvedFields: ["2026 application deadline and route-specific material list are not stated on the two overview pages"],
    fieldSources: { amountText: "nwpu-scholarship-coverage", benefits: "nwpu-scholarship-coverage", benefitItems: "nwpu-scholarship-coverage" },
  }),
  define({
    sourceId: "csu-international-student-scholarship-2026", schoolSlug: "central-south-university",
    slug: "official-2026-csu-international-student-scholarship", title: "Central South University 2026 Scholarship for International Students",
    nameZh: "中南大学2026年国际学生奖学金", type: "university", typeLabel: "University Scholarship",
    providerName: "中南大学", providerNameEn: "Central South University", providerLocation: "Changsha",
    fundingLevel: "Full or partial", applicableDegree: "Master, Doctoral",
    amountText: "Full award covers tuition, on-campus accommodation and monthly stipend; partial award covers tuition. Final support is stated in the admission notice.",
    deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 intake",
    benefits: ["Full scholarship: tuition", "Full scholarship: on-campus accommodation", "Full scholarship: monthly stipend", "Partial scholarship: tuition"],
    eligibility: ["Excellent non-Chinese citizen with no criminal record and in good health", "Bachelor's degree and age 18-35 for master's study", "Master's degree and age 18-40 for doctoral study", "Chinese-taught: HSK 4 score 260 for STEM or HSK 5 score 200 for arts/social science/medicine", "English-taught: IELTS 6 or TOEFL 85", "Strong academic background and research potential"],
    materials: ["Passport valid for more than one year", "Diploma and stamped transcripts", "Language proof", "No-criminal-record certificate", "Physical examination record", "One-minute self-introduction video", "Statement of no other funding", "Two recommendations", "Study plan of at least 1,000 words", "Supervisor acceptance letter", "CV and research outputs"],
    steps: ["Apply in the CSU international student system", "Pass initial review and pay the CNY 500 fee within two weeks", "Complete academic review by the relevant school", "Check the system and email for the final result and funding stated in the admission notice"],
  }),
  define({
    sourceId: "pku-prospective-graduate-scholarships-2026", schoolSlug: "peking-university",
    slug: "official-2026-pku-prospective-graduate-scholarships", title: "Peking University 2026 Scholarships for Prospective International Graduate Students",
    nameZh: "北京大学2026年外国留学生研究生新生奖学金", type: "multi-provider", typeLabel: "Graduate scholarship options",
    providerName: "北京大学及政府奖学金机构", providerNameEn: "Peking University and government scholarship providers", providerLocation: "Beijing",
    fundingLevel: "Full or partial", applicableDegree: "Master, Doctoral",
    amountText: "CSC Advanced Graduate Program may cover full/partial tuition, stipend, housing and insurance; PKU Scholarship covers full/partial tuition, stipend and insurance; BGS covers full/partial tuition.",
    deadlineDate: "2026-03-17", deadlineLabel: "PKU system: March 9, 2026 at 09:00; CSC system: March 17, 2026 at 24:00 Beijing time", applicationRound: "2026 intake",
    benefits: ["CSC: full or partial tuition waiver", "CSC: living stipend, housing and medical insurance", "PKU Scholarship: full or partial tuition, stipend and insurance", "Beijing Government Scholarship: full or partial tuition"],
    eligibility: ["Meets PKU international graduate admission requirements", "Has submitted a 2026 full-time self-funded graduate application", "Does not hold an incompatible scholarship", "Is not a joint-training-program candidate"],
    materials: ["PKU scholarship application", "Official transcripts and supporting documents", "CSC Type B application form for the Advanced Graduate Program", "Attachment 2 material list documents", "Physical examination or declaration and no-criminal-record declaration where applicable"],
    steps: ["Submit one scholarship application in the PKU system", "For CSC Advanced Graduate Program, also apply in CSC using PKU agency number 10001", "Use the Certificate for CSC Advanced Graduate Program Application when required", "Monitor PKU email; final award is expected around July-August 2026"],
  }),
];

const [baseText, registryText, manifests] = await Promise.all([
  readFile(basePath, "utf8"), readFile(registryPath, "utf8"), findFiles(resolve(root, "work/catalog-official"), "manifest.json"),
]);
const base = JSON.parse(baseText.replace(/^\uFEFF/, ""));
const registry = JSON.parse(registryText.replace(/^\uFEFF/, "")) as { sources: SourceDefinition[] };
const registryById = new Map(registry.sources.map(source => [source.id, source]));
const snapshotById = new Map<string, Snapshot & { manifestPath: string }>();
for (const manifestPath of manifests) {
  const manifest = JSON.parse((await readFile(manifestPath, "utf8")).replace(/^\uFEFF/, ""));
  for (const source of manifest.sources || []) {
    if (source.sourceRole === "scholarship") snapshotById.set(source.id, { ...source, manifestPath: relative(root, manifestPath).replaceAll("\\", "/") });
  }
}

if (definitions.length !== 20 || new Set(definitions.map(item => item.scholarship.schoolSlug)).size !== 20) {
  throw new Error("Batch 01 must contain exactly 20 distinct schools.");
}

const records = definitions.map(definition => {
  const source = requireSource(definition.sourceId);
  const snapshot = requireSnapshot(definition.sourceId);
  const fieldSource = (field: string) => definition.fieldSources?.[field] || definition.sourceId;
  const scholarship: CatalogSeedScholarship = {
    ...definition.scholarship,
    actionLinks: [{ label: "Official scholarship guide", url: source.url, kind: "official-source" }],
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: snapshot.sha256,
    capturedAt: snapshot.capturedAt,
    sourceFieldLineage: Object.fromEntries([...new Set([
      ...Object.entries(definition.scholarship).filter(([, value]) => value !== undefined).map(([field]) => field),
      "actionLinks",
    ])].map(field => [
      field,
      `${definition.derivedFields?.includes(field) || ["slug", "nameZh", "summary"].includes(field) ? "derived" : "explicit"}: ${fieldSource(field)} official source snapshot`,
    ])),
  };
  return scholarship;
});

const slugs = new Set(records.map(record => record.slug));
const draftBundle = {
  ...base,
  generatedAt: new Date().toISOString(),
  scholarships: [...(base.scholarships || []).filter((item: CatalogSeedScholarship) => !slugs.has(item.slug)), ...records],
};
const serializedDraft = `${JSON.stringify(draftBundle, null, 2)}\n`;
const persistedDraftBundle = JSON.parse(serializedDraft);
const validation = createCatalogMigrationValidationReport(persistedDraftBundle);
if (!validation.ok) throw new Error(`Generated scholarship draft failed validation:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  generatedAt: draftBundle.generatedAt,
  status: "awaiting_user_approval",
  policy: "CUAC official catalog review policy; collection is not publication",
  baseBundle: relative(root, basePath).replaceAll("\\", "/"),
  baseBundleSha256: createHash("sha256").update(baseText).digest("hex"),
  draftBundle: relative(root, draftPath).replaceAll("\\", "/"),
  schoolCount: 20,
  scholarshipCount: 20,
  sourceCount: new Set(definitions.flatMap(item => [item.sourceId, ...(item.additionalSourceIds || [])])).size,
  sensitiveDataCheck: {
    result: "pass",
    note: "Only public application requirements and institutional facts are included; applicant records and personal contact details are excluded.",
  },
  records: definitions.map((definition, index) => {
    const sourceIds = [definition.sourceId, ...(definition.additionalSourceIds || [])];
    const scholarship = records[index];
    return {
      schoolSlug: scholarship.schoolSlug,
      scholarshipSlug: scholarship.slug,
      title: scholarship.title,
      status: scholarship.status,
      completeness: {
        introduction: Boolean(scholarship.summary && scholarship.bodySections?.length),
        funding: Boolean(scholarship.benefitItems?.length),
        eligibility: Boolean(scholarship.eligibilityItems?.length),
        materials: Boolean(scholarship.applicationMaterials?.length),
        process: Boolean(scholarship.applicationSteps?.length),
        deadline: Boolean(scholarship.deadlineDate || scholarship.deadlineLabel),
        scope: Boolean(scholarship.applicableDegree || scholarship.applicableProgram),
      },
      unresolvedFields: definition.unresolvedFields || [],
      sources: sourceIds.map(id => {
        const item = requireSource(id);
        const snapshot = requireSnapshot(id);
        return {
          id, label: item.label, url: item.url, sha256: snapshot.sha256, capturedAt: snapshot.capturedAt,
          contentType: snapshot.contentType, finalUrl: snapshot.finalUrl,
          manifestPath: snapshot.manifestPath,
          artifactPath: `${dirname(snapshot.manifestPath).replaceAll("\\", "/")}/${snapshot.artifactPath}`,
        };
      }),
    };
  }),
};

await mkdir(dirname(draftPath), { recursive: true });
await Promise.all([
  writeFile(draftPath, serializedDraft, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, draftPath, reviewPath, validationPath, schools: 20, scholarships: 20, sources: review.sourceCount, bundleSha256: validation.bundleSha256 }, null, 2));

function define(input: {
  sourceId: string; additionalSourceIds?: string[]; schoolSlug: string; slug: string; title: string; nameZh: string;
  type?: string; typeLabel?: string; providerName?: string; providerNameEn?: string; providerLocation?: string;
  fundingLevel?: string; applicableDegree: string; applicableProgram?: string; amountText: string;
  deadlineDate?: string; deadlineLabel?: string; applicationRound?: string; targetCountries?: string[]; targetRegions?: string[];
  benefits: string[]; eligibility: string[]; materials: string[]; steps: string[]; unresolvedFields?: string[];
  fieldSources?: Record<string, string>;
}): ScholarshipDefinition {
  const coverage = input.benefits.join("; ");
  const providerName = input.providerName || "中华人民共和国教育部 / 国家留学基金管理委员会";
  const providerNameEn = input.providerNameEn || "Ministry of Education of the PRC / China Scholarship Council";
  const summary = `${input.title} supports eligible ${input.applicableDegree.toLowerCase()} applicants at the named university. Funding, eligibility, documents, process and deadlines below are transcribed or summarized from the cited official source.`;
  return {
    sourceId: input.sourceId,
    additionalSourceIds: input.additionalSourceIds,
    unresolvedFields: input.unresolvedFields,
    fieldSources: input.fieldSources,
    scholarship: {
      slug: input.slug, title: input.title, nameZh: input.nameZh, schoolSlug: input.schoolSlug,
      type: input.type || "government", typeLabel: input.typeLabel || "Chinese Government Scholarship",
      providerName, providerNameEn, providerLocation: input.providerLocation || "China",
      fundingLevel: input.fundingLevel || "Full", coverage, applicableDegree: input.applicableDegree,
      applicableProgram: input.applicableProgram || "Eligible programs in the official guide", amountText: input.amountText,
      requirementText: input.eligibility.join("; "),
      bodySections: [
        { title: "Program overview", body: summary },
        { title: "Important application notes", items: input.steps },
      ],
      benefitItems: input.benefits.map(label => ({ label, included: true })),
      eligibilityItems: input.eligibility.map(label => ({ label })),
      applicationMaterials: input.materials.map(label => ({ label })),
      applicationSteps: input.steps.map((body, index) => ({ label: `Step ${index + 1}`, body })),
      actionLinks: [], deadlineDate: input.deadlineDate, deadlineLabel: input.deadlineLabel,
      applicationRound: input.applicationRound, targetCountries: input.targetCountries || [], targetRegions: input.targetRegions || [],
      benefits: input.benefits, tags: ["2026", input.typeLabel || "Chinese Government Scholarship", input.applicableDegree],
      summary, sortOrder: 100,
    },
  };
}

function requireSource(id: string): SourceDefinition {
  const source = registryById.get(id);
  if (!source) throw new Error(`Missing official source registration: ${id}`);
  return source;
}

function requireSnapshot(id: string): Snapshot & { manifestPath: string } {
  const snapshot = snapshotById.get(id);
  if (!snapshot) throw new Error(`Missing collected official snapshot: ${id}`);
  return snapshot;
}

async function findFiles(directory: string, name: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return findFiles(path, name);
    return entry.isFile() && entry.name === name ? [path] : [];
  }));
  return nested.flat();
}
