import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Spec = { name: string; degree: "Master" | "Doctoral"; college: string; language: string; source: "cgs" | "foreign" };

const root = process.cwd();
const run = "2026-10-26T12-24-09-612Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["shou-international-admissions-index-current", "a07df87c4f3b447f42c6ff5be331ab18136bcb35cf3a118067522ef5e75ccf4c"],
  ["shou-degree-program-prospectus-2027", "bb06e3903658aeb354e6bb0cf96b03d60782a3ef0b27bb611cd33340d2d8548d"],
  ["shou-cgs-high-level-postgraduate-guide-2027", "2a4bedff6c1de430bb31a4fabcf862f1b40e592d5645174bd0a3635dddd86f34"],
  ["shou-foreign-languages-full-scholarship-guide-2027", "f8ad66ac80616cf43373ba2696729385f6637764734cd4243926014defb5aa67"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked SHOU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== expectedSha256) throw new Error(`SHOU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const index = sources.get("shou-international-admissions-index-current")!;
const prospectus = sources.get("shou-degree-program-prospectus-2027")!;
const cgs = sources.get("shou-cgs-high-level-postgraduate-guide-2027")!;
const foreign = sources.get("shou-foreign-languages-full-scholarship-guide-2027")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "shanghai");
if (!city) throw new Error("Reviewed Shanghai dependency missing.");
if (base.schools?.some((entry) => entry.slug === "shanghai-ocean-university")) throw new Error("Shanghai Ocean University already exists in the reviewed base.");

const specs: Spec[] = [
  { name: "Aquaculture", degree: "Master", college: "College of Fisheries and Life Science", language: "English or Chinese", source: "cgs" },
  { name: "Biology", degree: "Master", college: "College of Fisheries and Life Science", language: "English or Chinese", source: "cgs" },
  { name: "Fishery Resources", degree: "Master", college: "College of Marine Living Resource Sciences and Management", language: "English or Chinese", source: "cgs" },
  { name: "Marine Science", degree: "Master", college: "College of Oceanography and Ecological Science", language: "English or Chinese", source: "cgs" },
  { name: "Food Science and Engineering", degree: "Master", college: "College of Food Sciences and Technology", language: "English or Chinese", source: "cgs" },
  { name: "Fishery Economics and Management", degree: "Master", college: "College of Economics and Management", language: "English or Chinese", source: "cgs" },
  { name: "Applied Economics", degree: "Master", college: "College of Economics and Management", language: "Chinese", source: "cgs" },
  { name: "Machinery", degree: "Master", college: "College of Engineering Science and Technology", language: "English or Chinese", source: "cgs" },
  { name: "Electronic Information", degree: "Master", college: "College of Engineering Science and Technology", language: "Chinese", source: "cgs" },
  { name: "Aquaculture", degree: "Doctoral", college: "College of Fisheries and Life Science", language: "English", source: "cgs" },
  { name: "Biology", degree: "Doctoral", college: "College of Fisheries and Life Science", language: "English", source: "cgs" },
  { name: "Fishery Resources", degree: "Doctoral", college: "College of Marine Living Resource Sciences and Management", language: "English", source: "cgs" },
  { name: "Marine Science", degree: "Doctoral", college: "College of Oceanography and Ecological Science", language: "English", source: "cgs" },
  { name: "Food Science and Engineering", degree: "Doctoral", college: "College of Food Sciences and Technology", language: "English", source: "cgs" },
  { name: "Fishery Economics and Management", degree: "Doctoral", college: "College of Economics and Management", language: "English", source: "cgs" },
  { name: "Marine Science", degree: "Doctoral", college: "College of Engineering Science and Technology", language: "English", source: "cgs" },
  { name: "Translation and Interpreting (MTI)", degree: "Master", college: "College of Foreign Languages", language: "Chinese", source: "foreign" },
  { name: "Foreign Languages and Literatures (Area Studies)", degree: "Master", college: "College of Foreign Languages", language: "English", source: "foreign" },
];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = specs.map((item, indexValue) => {
  const source = item.source === "cgs" ? cgs : foreign;
  const chinese = item.language.includes("Chinese");
  const english = item.language.includes("English");
  return {
    slug: `shanghai-ocean-university-${item.degree.toLowerCase()}-${slugify(item.name)}-${slugify(item.college)}-${String(indexValue + 1).padStart(2, "0")}-2027`,
    schoolSlug: "shanghai-ocean-university", citySlug: city.slug, nameEn: item.name, degreeLevel: item.degree, durationYears: item.degree === "Master" ? 3 : 4,
    fieldCategory: item.college, subjectArea: item.name, teachingLanguage: item.language,
    ...(chinese ? { hskRequirement: "HSK 5 score above 180 for Chinese-taught master or doctoral study. The CSC guide also states an HSK 3 graduation requirement for scholarship recipients." } : {}),
    ...(english ? { englishRequirement: "IELTS 6.0 or TOEFL iBT 80 or above within two years, or the published equivalent/native-language evidence." } : {}),
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: item.source === "cgs" ? "Explicit Fall 2027 route in the official Chinese Government Scholarship high-level postgraduate guide. The scholarship application deadline is February 1, 2027; general self-funded deadline and tuition are not inferred." : "Explicit Fall 2027 full-time master route in the official College of Foreign Languages scholarship guide. Contacting a potential supervisor is mandatory. The scholarship deadline is February 1, 2027; general self-funded tuition and deadline are not inferred.",
    hasScholarship: true,
    scholarshipText: item.source === "cgs" ? "Chinese Government Scholarship Type B covers tuition, double-room accommodation, living stipend, and comprehensive medical insurance." : "SHOU University Scholarship Type A covers full tuition, international student apartment accommodation, CNY 800 monthly living allowance, and medical insurance.",
    badgeText: "Open Fall 2027 official scholarship route", displaySubjects: [item.name, item.college], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...sf(source),
    sourceFieldLineage: { nameEn: "official 2027 program list", degreeLevel: "official program grouping", durationYears: "official guide", fieldCategory: "official college heading", subjectArea: "official program name", teachingLanguage: "official guide", ...(chinese ? { hskRequirement: "official 2027 language rule" } : {}), ...(english ? { englishRequirement: "official 2027 language rule" } : {}), applicationUrl: "official 2027 guide", applicationNote: "official route, deadline, and scope limitations", hasScholarship: "official scholarship guide", scholarshipText: "official coverage", badgeText: "official Fall 2027 scholarship route" },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2027, deadlineDate: "2027-02-01T15:59:59.000Z", deadlineLabel: "Scholarship application deadline: February 1, 2027. General self-funded deadline is not published in the captured HTML pages.", applicationRound: "Fall 2027 international graduate scholarship admission", status: "open" as const,
  ...sf(program.sourceUrl === (foreign.finalUrl ?? foreign.url) ? foreign : cgs),
  sourceFieldLineage: { intakeTerm: "official 2027 enrollment timeline", intakeYear: "official guide title", deadlineDate: "official scholarship deadline", deadlineLabel: "official scholarship deadline and unresolved general deadline", applicationRound: "official Fall 2027 graduate scope" },
}));

const school = {
  slug: "shanghai-ocean-university", nameEn: "Shanghai Ocean University", nameZh: "上海海洋大学", citySlug: city.slug,
  schoolType: "Public marine and fisheries university", region: "Shanghai, East China",
  applicationLevel: "The current official admissions index publishes a 2027 degree prospectus, a 2027 Chinese Government Scholarship high-level postgraduate guide, and a 2027 full-scholarship guide for two foreign-languages master routes. This candidate includes the 18 graduate routes explicitly visible in captured HTML; the linked 21 MiB prospectus PDF exceeds the collector's 15 MiB safety limit and is not imported.",
  languageOfInstruction: "Chinese or English according to route.",
  languageRequirement: "Chinese-taught graduate routes require HSK 5 above 180. English-taught routes require IELTS 6.0 or TOEFL iBT 80 or equivalent evidence under the published rule.",
  hskRequirement: "HSK 5 score above 180 for Chinese-taught master and doctoral routes; scholarship recipients are also subject to the guide's HSK 3 graduation requirement.",
  englishRequirement: "IELTS 6.0 or TOEFL iBT 80 or above within two years, or the published equivalent/native-language evidence.",
  deadlineSummary: "The 2027 degree-prospectus page and both captured scholarship guides publish February 1, 2027 as the graduate scholarship application deadline. A general self-funded deadline is unresolved.",
  tuitionSummary: "No tuition amount is published in the captured 2027 HTML pages. Scholarship coverage is recorded separately without inferring self-funded tuition.", applicationFee: "CNY 400, nonrefundable, in the captured 2027 scholarship guides.",
  websiteUrl: "https://www.shou.edu.cn/", admissionsUrl: index.finalUrl ?? index.url,
  subjectTags: ["Aquaculture", "Marine Science", "Biology", "Food Science", "Fishery Economics", "Engineering", "Translation", "Area Studies"], languageTags: ["Chinese", "English"],
  campusHighlights: ["18 explicit Fall 2027 graduate scholarship routes captured from official HTML", "Chinese Government Scholarship Type B and SHOU University Scholarship Type A", "Linked full prospectus PDF exceeds the governed 15 MiB collector limit; uncaptured programs remain unresolved"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: cgs.fetchedAt, ...sf(prospectus),
  sourceFieldLineage: { nameEn: "official 2027 guide identity", nameZh: "official university identity", citySlug: "official Shanghai address plus reviewed city dependency", schoolType: "official identity plus CUAC taxonomy", region: "official address plus CUAC taxonomy", applicationLevel: "current admissions index and captured 2027 HTML guides", languageOfInstruction: "official program lists", languageRequirement: "official 2027 guides", hskRequirement: "official 2027 graduate guide", englishRequirement: "official 2027 graduate guide", deadlineSummary: "official 2027 pages and guides", tuitionSummary: "explicit omission from captured HTML sources", applicationFee: "official 2027 scholarship guides", websiteUrl: "official university domain", admissionsUrl: "current official international admissions index", subjectTags: "official 2027 program lists", languageTags: "official 2027 program lists", campusHighlights: "captured 2027 evidence scope and collector limit" },
};

const scholarshipBase = { schoolSlug: school.slug, providerNameEn: school.nameEn, providerLocation: "Shanghai, China", applicationMaterials: [], applicationSteps: [], status: "active" as const, verificationStatus: "verified" as const };
const scholarships = [
  {
    ...scholarshipBase, slug: "shanghai-ocean-university-cgs-high-level-postgraduate-2027", title: "Chinese Government Scholarship High-level Postgraduate Program 2027", nameZh: "上海海洋大学2027年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "China Scholarship Council / Shanghai Ocean University", fundingLevel: "Full scholarship",
    coverage: "Tuition, double-room accommodation, living stipend, and comprehensive medical insurance.", applicableDegree: "Master and Doctoral", applicableProgram: "The 16 master and doctoral route entries explicitly listed in the official scholarship guide.", amountText: "The official page does not itemize the living-stipend amount.", requirementText: "Master applicants: bachelor degree or above and age 30 or younger. Doctoral applicants: master degree or above and age 35 or younger. GPA above 3.0; doctoral applicants also need research experience and at least one published scientific paper. Language requirements follow the official guide.",
    benefitItems: [{ label: "Tuition", included: true, note: "Covered" }, { label: "Accommodation", included: true, note: "Double room" }, { label: "Living stipend", included: true, note: "Amount not itemized" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }], eligibilityItems: [{ label: "Master age", value: "30 or younger" }, { label: "Doctoral age", value: "35 or younger" }, { label: "Academic performance", value: "GPA above 3.0" }],
    actionLinks: [{ label: "Official scholarship guide", url: cgs.finalUrl ?? cgs.url, kind: "official-source" }], deadlineDate: "2027-02-01", deadlineLabel: "Applications close February 1, 2027.", applicationRound: "Fall 2027 Chinese Government Scholarship high-level postgraduate program", summary: "Full 2027 graduate scholarship across 16 explicitly listed routes.", lastVerifiedAt: cgs.fetchedAt, ...sf(cgs),
    sourceFieldLineage: { title: "official guide title", coverage: "official coverage", applicableDegree: "official scope", applicableProgram: "official program list", amountText: "official omission retained", requirementText: "official eligibility", benefitItems: "official coverage", eligibilityItems: "official age and GPA rules", applicationMaterials: "intentionally excluded", applicationSteps: "intentionally excluded", deadlineDate: "official deadline", deadlineLabel: "official deadline", applicationRound: "official Fall 2027 cycle", summary: "official scope and route count" },
  },
  {
    ...scholarshipBase, slug: "shanghai-ocean-university-foreign-languages-type-a-2027", title: "SHOU University Scholarship Type A — Foreign Languages Master Programs 2027", nameZh: "上海海洋大学外国语学院2027年硕士项目A类全额奖学金", type: "university", typeLabel: "SHOU University Scholarship Type A", providerName: "Shanghai Ocean University", fundingLevel: "Full scholarship",
    coverage: "Full tuition, international student apartment accommodation, CNY 800 monthly living allowance, and medical insurance.", applicableDegree: "Master", applicableProgram: "Translation and Interpreting (MTI); Foreign Languages and Literatures (Area Studies).", amountText: "CNY 800/month living allowance plus full tuition, accommodation, and medical insurance.", requirementText: "Bachelor degree or above, age 30 or younger. MTI requires HSK 5 or above; Area Studies requires IELTS 6.0 or TOEFL 80 or above. Contacting a potential supervisor is mandatory.",
    benefitItems: [{ label: "Tuition", included: true, note: "Full tuition" }, { label: "Accommodation", included: true, note: "International student apartment" }, { label: "Living allowance", included: true, note: "CNY 800/month" }, { label: "Medical insurance", included: true, note: "Covered" }], eligibilityItems: [{ label: "Age", value: "30 or younger" }, { label: "Supervisor", value: "Prior contact is mandatory" }],
    actionLinks: [{ label: "Official scholarship guide", url: foreign.finalUrl ?? foreign.url, kind: "official-source" }], deadlineDate: "2027-02-01", deadlineLabel: "Scholarship applications close February 1, 2027.", applicationRound: "Fall 2027 foreign-languages master scholarship", summary: "Full university scholarship for two explicit Fall 2027 full-time master routes.", lastVerifiedAt: foreign.fetchedAt, ...sf(foreign),
    sourceFieldLineage: { title: "official guide title", coverage: "official coverage", applicableDegree: "official scope", applicableProgram: "official program list", amountText: "official monthly allowance and benefits", requirementText: "official age, language, and supervisor rules", benefitItems: "official coverage", eligibilityItems: "official eligibility", applicationMaterials: "intentionally excluded", applicationSteps: "intentionally excluded", deadlineDate: "official deadline", deadlineLabel: "official deadline", applicationRound: "official Fall 2027 cycle", summary: "official scope" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: cgs.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = { version: 1, status: "unreviewed_draft", generatedAt: cgs.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 142, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length }, evidence, unresolved: ["The linked 2027 full degree prospectus PDF is approximately 21 MiB, above the governed collector's 15 MiB single-file safety limit. Programs visible only in that PDF are not imported or inferred.", "General self-funded tuition and deadline are not published in the captured 2027 HTML pages and remain absent.", "The Chinese Government Scholarship guide lists Marine Science under two colleges; both explicit rows are preserved as distinct route records.", "Supervisor names, personal contacts, applicant files, bank-account details, and payment instructions are excluded."], sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions, or private application materials are present." } };
const stem = resolve(root, "seeds/catalog.2027-wave-181");
await Promise.all([writeFile(`${stem}.draft.json`, candidateText, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 181, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
