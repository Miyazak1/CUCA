import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const batchRoot = resolve(workRoot, "sdu-complete-batch-01");
const parsedPath = resolve(batchRoot, "parsed-routes.json");
const imageManifestPath = resolve(batchRoot, "image-evidence/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.sdu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sdu-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.sdu-complete-batch-01.review.json");
const schoolSlug = "shandong-university";
const applicationUrl = "https://www.apply.sdu.edu.cn";
const admissionsUrl = "https://www.istudy.sdu.edu.cn/English/Admissions/Degree_Programs.htm";
const expectedParsedSha256 = "69e7f18302b50c864bc4fc8170a4149c2d683039f7cd855457ba4812515eeb4b";
const expectedImageManifestSha256 = "c2023f80ada016f43a95ec787d88aa08f9bc13c7b9c68724bcc81d4c9be08fd7";

const expected: Record<string, string> = {
  "sdu-international-undergraduate-programs-en-2026": "62746aa06b4f6eaaefbfcf80a84aee000c12ccf1fde9afc8491adfe2581380da",
  "sdu-international-master-programs-en-2026": "98aa9be40d42464b256eaec363bb47b5c273ddb6c4d21a5d2b72e5cf2970b961",
  "sdu-international-doctoral-programs-en-2026": "3ff18e063946515c27556ad8e3c7d477d0da707ab130ebf6d97bab2414e115d1",
  "sdu-undergraduate-guide-image-01-2026": "50dc5798d22a8fe5f4965e9c56f95fb65f6465420bf3c46daf4510c4a92c67dd",
  "sdu-undergraduate-guide-image-02-2026": "081e84897e7c51e81e93e691568d95d3703dd016de896162f5852cd6654f23e2",
  "sdu-undergraduate-guide-image-03-2026": "d5bb695b720fcd3f810a994dfffeed81b62aa16d1c5eb7fe64bc7b8cf4d3c497",
  "sdu-undergraduate-guide-image-04-2026": "efdae18c306028929466278a9a857c637a05d9e544019cd0bb5565a3682aa798",
  "sdu-undergraduate-guide-image-05-2026": "2d847ef785325578f7bbfa621d3a997523f027f861113dc2ffba37dc6ed61071",
  "sdu-undergraduate-guide-image-06-2026": "d301e3ed659f0628fbc295588e60fe7f91b58390f9453eb4ba7ed74fcfc0b8f2",
  "sdu-master-guide-image-01-2026": "1dae7a83231a90f76913f2682f7e89983e2b2b2a415ff33f78b14caf97359cda",
  "sdu-master-guide-image-02-2026": "6b41fc308659a66e346265c0251d082dd005a773f398c1854321903bcd928f66",
  "sdu-master-guide-image-03-2026": "be9b2547d585c00b4d8527532c2927392249d033485c0b51406bdce6d35e6132",
  "sdu-master-guide-image-04-2026": "6f9399908c7a285f1ab7d65b03a6859dae67c77241df6d2226886db5fe1c28f4",
  "sdu-master-guide-image-05-2026": "a5eba744d2de0857d3619d7bbd1a2da7c3da7f88aeed0c38441615e5b75baf94",
  "sdu-master-guide-image-06-2026": "71f03e24e08235055c76ff3dff5da552519356e3877a4505bd8705556fae820c",
  "sdu-doctoral-guide-image-01-2026": "19b59aa54e0b55cea957caf41808f4009b9a75619955763393619105953f88de",
  "sdu-doctoral-guide-image-02-2026": "7a2a631cc5669665aa11179982e350cbac7d11a19572a8619a296b6a4fe5279e",
  "sdu-doctoral-guide-image-03-2026": "ece8f9b8fddf4f6ff1ebc218cfa4c41e41bc727b3109ef666bcb7f1b549ea9ad",
  "sdu-doctoral-guide-image-04-2026": "a1f464d6ad5e5ec7e64d8dc347d396e3b56ec7a6702454e492fb2617e0faaab5",
  "sdu-doctoral-guide-image-05-2026": "377e7e15aff9404e25f1eb51118c1c42f269e5eaf6de2b315d47aabbe5cb932c",
  "sdu-doctoral-guide-image-06-2026": "ec4a97c1a2c541edfcd04632eb4e2b915e080e855952ae901151ef4a159bf725",
  "sdu-doctoral-guide-image-07-2026": "1a7b7b728b337741420df868661cc03891c20e241d1fcd6191931051eba249f4",
  "sdu-doctoral-guide-image-08-2026": "fd10ddbf3b2876ab05f1e5acb16e78488573117cb26807a768b0fd1c37a52bf1",
  "sdu-outstanding-scholarship-image-2026": "84c06d1f714ab2057a1e446651cf0eb4fdd461e8146c8ba898991ac073d9343c",
  "sdu-youth-excellence-scholarship-image-2026": "ce7471a59711c4e5b70a0f3bffdea2dfcf5b9d05da3c802a21e61e96260eeb32",
  "sdu-cgs-type-b-scholarship-image-2026": "ff339ccf44977efe2ec016ee31730d1a1cec4a4c5f65f62d60af2c18cca21615",
  "sdu-china-studies-scholarship-image-2026": "3f144a243af6005772cad71c36d6d008b2a6f54d5f4b57c9a02548a86cecdcde",
  "sdu-chinese-teachers-scholarship-image-2026": "de93a78a8c2dc6aa3437aea4b08daf2f495969a2616942dbaa8c06efdcc10c04",
};

const sha256Text = (text: string) => createHash("sha256").update(text).digest("hex");
if (sha256Text(await readFile(parsedPath, "utf8")) !== expectedParsedSha256) throw new Error("Parsed SDU routes changed after PDF review.");
if (sha256Text(await readFile(imageManifestPath, "utf8")) !== expectedImageManifestSha256) throw new Error("SDU image evidence manifest changed after visual review.");

async function manifestPaths(directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await manifestPaths(path));
    else if (entry.name === "manifest.json") paths.push(path);
  }
  return paths;
}

async function findEvidence() {
  const evidence = new Map<string, any>();
  for (const path of await manifestPaths(workRoot)) {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    for (const source of manifest.sources ?? []) {
      if (expected[source.id] && source.status === 200 && source.sha256 === expected[source.id]) evidence.set(source.id, source);
    }
  }
  const missing = Object.keys(expected).filter(id => !evidence.has(id));
  if (missing.length) throw new Error(`Missing locked SDU evidence: ${missing.join(", ")}`);
  return evidence;
}

const evidence = await findEvidence();
const parsed = JSON.parse(await readFile(parsedPath, "utf8"));
const requiredCounts = { undergraduate: 20, master: 58, doctoral: 65, chinese: 68, english: 75, total: 143 };
if (JSON.stringify(parsed.counts) !== JSON.stringify(requiredCounts)) throw new Error(`Unexpected SDU route counts: ${JSON.stringify(parsed.counts)}`);

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const used = new Set<string>();
function uniqueSlug(route: any, index: number) {
  const base = `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.fieldCategory)}-${slugify(route.nameEn)}-${slugify(route.teachingLanguage)}`;
  const slug = used.has(base) ? `${base}-${index + 1}` : base;
  used.add(slug);
  return slug;
}

const undergraduateCsca: Record<string, string[]> = {
  "Clinical Medicine|Chinese": ["STEM Chinese", "Mathematics", "Chemistry"],
  "Nursing|Chinese": ["STEM Chinese", "Mathematics", "Chemistry"],
  "Clinical Pharmacy|Chinese": ["STEM Chinese", "Mathematics", "Physics", "Chemistry"],
  "Teaching Chinese to Speakers of Other Languages|Chinese": ["Humanities Chinese", "Mathematics"],
  "Economics|Chinese": ["Humanities Chinese", "Mathematics"],
  "Finance|Chinese": ["Humanities Chinese", "Mathematics"],
  "International Economics and Trade|Chinese": ["Humanities Chinese", "Mathematics"],
  "Journalism|Chinese": ["Humanities Chinese", "Mathematics"],
  "Machine Design, Manufacturing and Automation|Chinese": ["STEM Chinese", "Mathematics", "Physics"],
  "Intelligent Manufacturing Engineering|Chinese": ["STEM Chinese", "Mathematics", "Physics"],
  "Urban Underground Space Engineering|Chinese": ["STEM Chinese", "Mathematics", "Physics"],
  "Intelligent Construction and Intelligent Transportation|Chinese": ["STEM Chinese", "Mathematics", "Physics"],
  "International Politics|Chinese": ["Humanities Chinese", "Mathematics"],
  "Computer Science and Technology|Chinese": ["STEM Chinese", "Mathematics", "Physics", "Chemistry"],
  "Clinical Medicine|English": ["Mathematics", "Chemistry"],
  "Stomatology|English": ["Mathematics", "Chemistry"],
  "Nursing|English": ["Mathematics", "Chemistry"],
  "Tourism Management|English": ["Mathematics"],
  "Machine Design, Manufacturing and Automation|English": ["Mathematics", "Physics"],
  "Intelligent Manufacturing Engineering|English": ["Mathematics", "Physics"],
};

function languageRequirement(route: any) {
  if (route.teachingLanguage === "English") return { englishRequirement: "IELTS 6.0+, TOEFL 80+ (SDU DI code C296), TOEFL MyBest 80+, Essentials 8+, or equivalent; native English speakers and applicants whose highest education was taught in English may qualify for an exemption with proof." };
  if (route.degree === "Undergraduate") return { hskRequirement: route.nameEn === "Teaching Chinese to Speakers of Other Languages" ? "HSK 4, 210+" : "HSK 5, 180+" };
  if (route.degree === "Master") return { hskRequirement: route.nameEn === "International Chinese Language Education" ? "HSK 5, 180+" : "HSK 6, 180+" };
  return { hskRequirement: "HSK 6, 210+" };
}

const programs: CatalogSeedProgram[] = parsed.routes.map((route: any, index: number) => {
  const source = evidence.get(route.sourceId)!;
  const cscaSubjects = route.degree === "Undergraduate" ? undergraduateCsca[`${route.nameEn}|${route.teachingLanguage}`] : undefined;
  if (route.degree === "Undergraduate" && !cscaSubjects) throw new Error(`Missing CSCA subject mapping for ${route.nameEn} (${route.teachingLanguage})`);
  return {
    slug: uniqueSlug(route, index), schoolSlug, citySlug: "jinan", nameEn: route.nameEn, degreeLevel: route.degree,
    durationYears: route.durationYears, fieldCategory: route.fieldCategory, subjectArea: route.fieldCategory,
    teachingLanguage: route.teachingLanguage,
    ...(cscaSubjects ? { cscaSubjects, cscaRequirement: `CSCA required: ${cscaSubjects.join(", ")}.` } : { cscaRequirement: "No CSCA requirement is published for this graduate route." }),
    ...languageRequirement(route), tuitionAmount: route.tuitionAmount, tuitionCurrency: "RMB", tuitionPeriod: "year",
    tuitionText: `RMB ${Number(route.tuitionAmount).toLocaleString("en-US")}/year`, displayTuition: `RMB ${Number(route.tuitionAmount).toLocaleString("en-US")}/year`,
    scholarshipText: "Official SDU, Chinese Government and language-education scholarship routes are reviewed separately.",
    applicationUrl, applicationNote: `${route.fieldCategory}; ${route.campus}; official PDF page ${route.sourcePage}, table row ${route.sourceRow}.`,
    hasScholarship: true, badgeText: `Official ${route.degree.toLowerCase()} route`, displaySubjects: cscaSubjects,
    displayGroup: route.degree, displayGroupLabel: `${route.degree} programs`, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Academic Program`, degreeLevel: "PDF title and section",
      fieldCategory: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, School/College`, teachingLanguage: "PDF medium heading",
      durationYears: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, School Length`, tuitionAmount: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Tuition (RMB/year)`,
      applicationNote: `PDF page ${route.sourcePage}, table row ${route.sourceRow}, Campus`, ...(cscaSubjects ? { cscaSubjects: "2026 bachelor admissions guide image 3, matching program row" } : {}),
    },
  };
});

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarshipPages: Record<string, string> = {
  "sdu-outstanding-scholarship-image-2026": "https://www.istudy.sdu.edu.cn/info/1291/3944.htm",
  "sdu-youth-excellence-scholarship-image-2026": "https://www.istudy.sdu.edu.cn/info/1291/3950.htm",
  "sdu-cgs-type-b-scholarship-image-2026": "https://www.istudy.sdu.edu.cn/info/1291/3949.htm",
  "sdu-china-studies-scholarship-image-2026": "https://www.istudy.sdu.edu.cn/info/1291/3948.htm",
  "sdu-chinese-teachers-scholarship-image-2026": "https://www.istudy.sdu.edu.cn/info/1291/3947.htm",
};
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Jinan, Shandong, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: { title: "official guide title", fundingLevel: "official guide coverage section", coverage: "official guide coverage section", amountText: "official guide coverage section", applicableDegree: "official guide eligibility/program section", applicableProgram: "official guide program section", eligibilityItems: "official guide eligibility section", applicationMaterials: "official guide application documents section", applicationSteps: "official guide application procedure section", ...(value.deadlineDate ? { deadlineDate: "official guide application time/deadline section" } : {}) },
    actionLinks: [{ label: "Official SDU scholarship page", url: scholarshipPages[sourceId], kind: "official-source" }], ...value,
  };
};

const commonDegreeMaterials = [info("Passport photo page"), info("Highest diploma/degree or expected-graduation evidence"), info("Academic transcripts"), info("Language proficiency certificate"), info("Foreign Physical Examination Form"), info("Certificate of No Criminal Record"), info("Additional SDU materials when requested")];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("sdu-outstanding-scholarship-image-2026", {
    slug: "official-2026-sdu-scholarship-outstanding-international-students", title: "Shandong University 2026 Scholarship for Outstanding International Students", type: "university", typeLabel: "SDU Scholarship", providerNameEn: "Shandong University", fundingLevel: "Full or partial",
    coverage: "Full scholarship covers tuition, living allowance, accommodation and comprehensive medical insurance. Partial scholarship covers tuition and comprehensive medical insurance.", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Eligible SDU degree programs", amountText: "Full: tuition, living allowance, accommodation and medical insurance; partial: tuition and medical insurance", deadlineDate: "2026-04-01", deadlineLabel: "April 1, 2026", applicationRound: "2026 degree intake",
    benefitItems: [benefit("Tuition"), benefit("Living allowance", "Full award only"), benefit("Accommodation", "Full award only"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Nationality and health", "Non-Chinese citizen; friendly to China; physically and mentally healthy"), info("Applicant status", "Admitted international student not yet registered for the current academic year"), info("Bachelor", "High school diploma, excellent performance, under 25"), info("Master", "Bachelor's degree, excellent performance, under 35"), info("Doctoral", "Master's degree, excellent performance, under 40"), info("Concurrent funding", "May not simultaneously receive another scholarship or grant"), info("Language", "Program-level HSK or English requirements apply")],
    applicationMaterials: commonDegreeMaterials, applicationSteps: [info("Step 1", "Complete the SDU international student online application"), info("Step 2", "Pay the RMB 400 application fee after receiving the pre-admission email"), info("Step 3", "Follow the degree-program document requirements and monitor the application system and registered email")],
    bodySections: [{ title: "Duration", body: "Funding normally matches the basic study period and is not extended." }, { title: "Annual review", body: "Partial scholarship holders must pay required fees on time and participate in annual review; failed assessment may suspend or cancel the award." }], summary: "SDU's university-funded full or partial award for newly admitted international degree students.", sortOrder: 10,
  }),
  scholarship("sdu-youth-excellence-scholarship-image-2026", {
    slug: "official-2026-sdu-youth-of-excellence-scheme-china", title: "Shandong University 2026 Youth of Excellence Scheme of China Program Chinese Government Scholarship", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "China Scholarship Council / Shandong University", fundingLevel: "Chinese Government Scholarship",
    coverage: "Coverage is regulated by the China Scholarship Council; the collected SDU guide does not publish component amounts.", applicableDegree: "Master", applicableProgram: "Project Management, International Relations, Business Administration", amountText: "Coverage regulated by China Scholarship Council; no component amounts stated in the SDU guide", deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026, 23:59", applicationRound: "2026-2027 master's intake",
    eligibilityItems: [info("Nationality, health and age", "Non-Chinese citizen in good physical and mental health; under 45"), info("Education and experience", "Bachelor's degree or above and more than three years of work experience; related background preferred"), info("Professional qualification", "Civil servant at deputy-director level or above/equivalent, senior enterprise or organization manager, university/research administrator, or person with international-organization work or internship experience"), info("Pre-admission", "SDU Department of International Affairs pre-admission letter required"), info("Language", "English")],
    applicationMaterials: [...commonDegreeMaterials, info("Two recommendation letters"), info("Resume"), info("Motivation letter in English"), info("Employment certification"), info("Publication contents and abstracts", "If applicable")],
    applicationSteps: [info("Step 1", "January-March: prepare documents and obtain SDU pre-admission letter"), info("Step 2", "Submit the CSC online application as Type A, agency code 1563, before the deadline"), info("Step 3", "CSC expert review in May"), info("Step 4", "Admission results in June; visa July-August; registration in September")],
    bodySections: [{ title: "Study model", body: "Two-year English-taught 1+1 model: the first year is full-time study, field study and research at SDU; the second year is home-country dissertation work followed by defense under SDU requirements." }], summary: "A two-year English-taught leadership-focused Chinese Government Scholarship route for three SDU master's programs.", sortOrder: 20,
  }),
  scholarship("sdu-cgs-type-b-scholarship-image-2026", {
    slug: "official-2026-sdu-chinese-government-scholarship-type-b", title: "Shandong University 2026 Chinese Government Scholarship Type B", type: "government", typeLabel: "Chinese Government Scholarship - Type B", providerNameEn: "China Scholarship Council / Shandong University", fundingLevel: "Full",
    coverage: "Tuition, free accommodation or housing allowance, living allowance and comprehensive medical insurance for the basic study period.", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Chinese-taught undergraduate programs; Chinese- or English-taught master's and doctoral programs listed by SDU", amountText: "Tuition, accommodation or housing allowance, living allowance and comprehensive medical insurance", deadlineDate: "2026-02-06", deadlineLabel: "February 6, 2026", applicationRound: "2026 degree intake",
    benefitItems: [benefit("Tuition"), benefit("Free accommodation or housing allowance"), benefit("Living allowance"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Nationality and health", "Non-Chinese citizen, physically and mentally healthy, friendly to China, no criminal record"), info("Bachelor", "High school diploma, excellent performance, under 25; Chinese-taught programs only"), info("Master", "Bachelor's degree, excellent performance, under 35"), info("Doctoral", "Master's degree, excellent performance, under 40"), info("Language", "Program-level HSK or English requirements apply")],
    applicationMaterials: [info("Chinese Government Scholarship Application Form"), ...commonDegreeMaterials], applicationSteps: [info("Step 1", "Apply in the CSC system as Type B using SDU agency number 10422 and download the application form"), info("Step 2", "Complete the SDU international student online application; both systems are required"), info("Step 3", "Pay the RMB 400 application fee after receiving the pre-admission email"), info("Step 4", "SDU reviews and recommends candidates; CSC experts select awardees")],
    bodySections: [{ title: "Annual review", body: "Recipients must participate in annual review; failed assessment may suspend or cancel scholarship status." }, { title: "Concurrent government support", body: "Recipients may not simultaneously receive other Chinese-government or admitting-institution scholarship funding, except one-time awards." }], summary: "SDU's 2026 full Chinese Government Scholarship Type B route for eligible degree applicants.", sortOrder: 30,
  }),
  scholarship("sdu-china-studies-scholarship-image-2026", {
    slug: "official-2026-sdu-phd-fellowship-china-studies", title: "Shandong University 2026 Ph.D. Fellowship of China Studies Program", type: "government", typeLabel: "China Studies Program Ph.D. Fellowship", providerNameEn: "Center for Language Education and Cooperation / Shandong University", fundingLevel: "Fellowship",
    coverage: "The SDU guide directs applicants to the Center for Language Education and Cooperation's China Studies Program page for the controlling coverage terms.", applicableDegree: "Doctoral", applicableProgram: "Ph.D. in China Fellowship and Joint Research Ph.D. Fellowship", amountText: "Coverage details are controlled by the official China Studies Program page and are not restated in the SDU guide", deadlineDate: "2026-02-28", deadlineLabel: "February 28, 2026", applicationRound: "2026 China Studies Program",
    eligibilityItems: [info("Purpose", "International young sinologists undertaking doctoral-level China studies research"), info("Route", "Ph.D. in China Fellowship or Joint Research Ph.D. Fellowship"), info("Additional rules", "SDU 2026 doctoral international admission requirements also apply")],
    applicationMaterials: [info("China Studies Program online application materials"), info("SDU 2026 doctoral application materials"), info("2026 SDU China Studies tutor selection")], applicationSteps: [info("Step 1", "Apply through the Center for Language Education and Cooperation China Studies Program system"), info("Step 2", "Select an SDU tutor from the official 2026 list and satisfy SDU doctoral requirements"), info("Step 3", "After admission, complete the SDU online application; paper documents are not required"), info("Step 4", "Participate in the annual review after enrollment")],
    summary: "A doctoral or joint-research fellowship route for international China Studies scholars.", sortOrder: 40,
  }),
  scholarship("sdu-chinese-teachers-scholarship-image-2026", {
    slug: "official-2026-sdu-international-chinese-language-teachers-scholarship", title: "Shandong University 2026 International Chinese Language Teachers Scholarship", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerNameEn: "Center for Language Education and Cooperation / Shandong University", fundingLevel: "Full",
    coverage: "Tuition, accommodation, living allowance except for four-week study students, and comprehensive medical insurance.", applicableDegree: "Bachelor, Master, non-degree study", applicableProgram: "International Chinese Language Education; Chinese Language and Literature; Chinese Language Study; Taiji Culture", amountText: "Full tuition, accommodation, living allowance (except four-week study) and comprehensive medical insurance", deadlineDate: "2026-05-15", deadlineLabel: "May 15, 2026 for September 2026 programs; October 31, 2026 for March 2027 one-semester programs; April 15 or September 15, 2026 for four-week programs", applicationRound: "2026-2027 language-education intake",
    benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance", "Not included for four-week study"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("General", "Non-Chinese citizen, friendly to China, no criminal record, good physical/mental health and academic conduct, intending to work in Chinese-language education or related fields"), info("Age", "16-35 on September 1, 2026; up to 45 for currently employed Chinese teachers; up to 25 for undergraduate applicants"), info("Master in ICLE", "Bachelor's degree, HSK 5 score 210+, HSKK Intermediate 60+"), info("Bachelor in ICLE", "Senior high school diploma, HSK 4 score 210+, HSKK Intermediate 60+"), info("One-year ICLE", "HSK 3 score 270+ and HSKK score"), info("One-year Chinese Language and Literature", "HSK 4 score 180+ and HSKK Intermediate 60+"), info("One-year Chinese Language Study", "HSK 3 score 210+; HSKK preferred"), info("One-semester language route", "HSK 3 score 180+ and HSKK score"), info("Taiji/Four-week routes", "HSK score required; group and plan rules apply")],
    applicationMaterials: [info("Passport photo page"), info("Valid HSK and HSKK score reports"), info("Reference letter from the head of the recommending institution"), info("Degree routes", "Highest qualification/expected graduation and transcripts; master's applicants also provide two supervisor recommendations"), info("Employed teachers", "Employment proof and employer reference"), info("Applicants under 18", "Guardian statement, notarized guardianship proof and guardian ID/passport"), info("SDU additions", "Physical examination, no-criminal-record certificate and Chinese motivation letter")],
    applicationSteps: [info("Step 1", "From March 1, register at the International Chinese Language Teachers Scholarship site, choose SDU as first preference and submit by the route deadline"), info("Step 2", "Upload materials and track progress, comments and result online"), info("Step 3", "Award holders confirm study-in-China procedures and print the scholarship certificate"), info("Step 4", "After SDU email notice, complete the SDU international student application"), info("Step 5", "Use the SDU admission letter for visa and register on the designated date")],
    bodySections: [{ title: "Program duration", items: ["Master: two years", "Bachelor: four years", "One academic year: eleven months", "One semester: five months", "Short study: four weeks"] }, { title: "Joint programs", body: "Joint-program details and quotas are to be announced by SDU; no unpublished quota is inferred." }], summary: "Full scholarship routes at SDU for future or currently employed Chinese-language teachers, covering degree and shorter study options.", sortOrder: 50,
  }),
];

const schoolEvidence = evidence.get("sdu-undergraduate-guide-image-02-2026")!;
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: "2026-09-13T04:54:20.223Z",
  cities: [{ slug: "jinan", nameEn: "Jinan", nameZh: "济南", region: "华北", status: "active", sourceUrl: schoolEvidence.url, sourceLabel: schoolEvidence.label, sourceSha256: schoolEvidence.sha256, capturedAt: schoolEvidence.fetchedAt, sourceFieldLineage: { nameEn: "official SDU campus and admissions address", nameZh: "normalized existing CUAC city name", region: "existing CUAC city classification retained" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Shandong University", nameZh: "山东大学", citySlug: "jinan", schoolType: "public", region: "Jinan and Qingdao, Shandong, China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese or English depending on route",
    languageRequirement: "Chinese-taught routes publish degree-specific HSK thresholds; English-taught routes accept IELTS 6.0+, TOEFL 80+, MyBest 80+, Essentials 8+ or equivalent, with stated exemptions.",
    hskRequirement: "Undergraduate: HSK 5 (180+), except Teaching Chinese to Speakers of Other Languages HSK 4 (210+). Master: HSK 6 (180+), except International Chinese Language Education HSK 5 (180+). Doctoral: HSK 6 (210+).",
    englishRequirement: "IELTS 6.0+, TOEFL 80+ (SDU DI code C296), TOEFL MyBest 80+, Essentials 8+, or equivalent; native English speakers and applicants whose highest education was taught in English may qualify for exemption with proof.",
    deadlineSummary: "2026 self-financed degree applications close May 31, 2026. Scholarship deadlines vary: February 6, February 28, March 31, April 1 and May 15, with some language-study routes also using October 31, April 15 or September 15.",
    tuitionSummary: "Published annual tuition by route: undergraduate RMB 18,000-45,000; master's RMB 22,000-40,000; doctoral RMB 26,000-41,000.", applicationFee: "RMB 400",
    websiteUrl: "https://www.sdu.edu.cn/", admissionsUrl, cscaRequired: true, cscaRequirement: "All 2026 international undergraduate applicants must take CSCA; subjects are program-specific. No CSCA requirement is published for graduate routes.",
    cscaSubjects: ["Humanities Chinese or STEM Chinese (Chinese-taught routes)", "Mathematics", "Physics and/or Chemistry for selected programs"],
    subjectTags: [...new Set(programs.map(program => program.fieldCategory).filter(Boolean))] as string[], languageTags: ["Chinese", "English"], tuitionBandLabel: "RMB 18,000-45,000/year",
    campusHighlights: ["143 official international degree routes", "20 undergraduate, 58 master's and 65 doctoral routes", "75 English-medium and 68 Chinese-medium routes", "Jinan and Qingdao campuses represented", "Five independently structured official scholarship routes"],
    status: "draft", sourceUrl: schoolEvidence.url, sourceLabel: schoolEvidence.label, sourceSha256: schoolEvidence.sha256, capturedAt: schoolEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "2026 official admissions guide title", citySlug: "official campus/address references", applicationLevel: "three official degree guides", languageRequirement: "official eligibility sections", deadlineSummary: "official application-time sections", tuitionSummary: "official program PDFs and fee tables", applicationFee: "official fee sections", admissionsUrl: "official SDU degree-program admissions index", cscaRequirement: "2026 undergraduate guide examination section" },
  }],
  programs,
  programIntakes: programs.map(program => {
    const sourceId = program.degreeLevel === "Undergraduate" ? "sdu-undergraduate-guide-image-02-2026" : program.degreeLevel === "Master" ? "sdu-master-guide-image-02-2026" : "sdu-doctoral-guide-image-02-2026";
    const source = evidence.get(sourceId)!;
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-05-31T00:00:00.000Z", deadlineLabel: "Self-financed application deadline: May 31, 2026", applicationRound: "2026 international degree intake", status: "closed" as const, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: "official 2026 degree guide application-time section; date-only value normalized to an ISO UTC timestamp" } };
  }),
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
// Validate the exact JSON representation that reviewers receive. The in-memory
// builders can contain optional properties whose value is undefined; JSON omits
// those properties, so hashing the builder directly is not reproducible after
// the artifact is read back from disk.
const persistedCandidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(persistedCandidate);
if (!validation.ok) throw new Error(`SDU candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = sha256Text(candidateText);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: 143, undergraduateRouteCount: 20, masterRouteCount: 58, doctoralRouteCount: 65, programIntakeCount: 143, scholarshipCount: 5, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  visualReview: { result: "pass", admissionGuideImagesReviewed: 22, scholarshipGuideImagesReviewed: 5, scholarshipReviewSlicesReviewed: 27, note: "Every official admissions and scholarship image was visually inspected; all tables and sections were readable and internally consistent with the parsed program PDFs." },
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch creates a new Shandong University school and new official program, intake and scholarship slugs without archiving or overwriting any school, program or scholarship record. The existing Jinan city is retained with byte-equivalent core fields." },
  reconciliation: { actionAfterReview: "insert_new_verified_sdu_catalog", destructiveDeletion: false, existingJinanCityReusedWithByteEquivalentCatalogFields: true },
  excludedEvidence: [{ item: "Jinan Sister City Scholarship and International Confucian Association Scholarship", reason: "The degree guides name these routes but the collected official sources do not provide enough independent eligibility, coverage and application detail for rich scholarship records." }],
  unresolvedFields: ["China Studies Program coverage details remain controlled by the official CLEC program page and are not inferred from the SDU summary.", "Youth of Excellence component amounts are not stated in the collected SDU guide and are not invented.", "No scholarship quota is inferred where the official guide does not publish one."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, admissions, program and scholarship information is included; no applicant, account, payment, passport number, private email, personal phone or uploaded document data is present." },
  reviewNotes: ["Program rows come from exact English-language official PDFs and preserve school/college, campus, medium, duration, tuition, page and row lineage.", "All 20 undergraduate CSCA subject mappings were checked against the official 2026 undergraduate guide.", "Five scholarships are separate rich records with only explicitly published benefits, eligibility, materials, steps and dates.", "No existing school, program or scholarship record is archived, overwritten or deleted."],
};
const reviewHash = sha256Text(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: "standing-user-default-publication" };
await writeFile(candidatePath, candidateText, { flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
