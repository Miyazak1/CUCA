import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const locks = [
  ["2026-10-26T08-45-35-501Z", "cnu-university-home-current", "1680f17437fa76b4862e44f53027d435990232cb5ba525db8b37c760ff9f48ba"],
  ["2026-10-26T08-45-35-501Z", "cnu-international-culture-college-home-current", "58dc9d89a5cf9899be8b61679654a7eb2ffa7d28a351cb040b50de88abb39d1a"],
  ["2026-10-26T08-46-15-427Z", "cnu-international-admissions-program-index-current", "526de17fedfefcb84a101ed9b81cbb89a2c3cb035f2c36920de2c552e60e8775"],
  ["2026-10-26T08-46-15-427Z", "cnu-international-admission-notices-current", "84932bf9c3a72df4ba44679d0a347da45a42617a6c126894204da90a60991ca0"],
  ["2026-10-26T08-46-52-931Z", "cnu-international-spring-prospectus-2027", "f6676f39aa03bf372a013de5b40c484dfe687d5db68386ed827e32174bd67a79"],
  ["2026-10-26T08-46-52-931Z", "cnu-international-chinese-language-teachers-scholarship-spring-2027", "07641aa254ef42c59c154e3004d41d19f6d0dfaaeef40a56ef9a7a89d37fb734"],
] as const;
const sources = new Map<string, Source>();
for (const [run, id, sha] of locks) {
  const dir = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(dir, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha);
  if (!source) throw new Error(`Missing ${id}`);
  if (createHash("sha256").update(await readFile(resolve(dir, source.artifactPath))).digest("hex") !== sha) throw new Error(`Hash mismatch ${id}`);
  sources.set(id, source);
}

const guide = sources.get("cnu-international-spring-prospectus-2027")!;
const scholarshipSource = sources.get("cnu-international-chinese-language-teachers-scholarship-spring-2027")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "beijing");
if (!city) throw new Error("Beijing dependency missing");

const school = {
  slug: "capital-normal-university",
  nameEn: "Capital Normal University",
  nameZh: "首都师范大学",
  citySlug: "beijing",
  schoolType: "Public comprehensive normal university",
  region: "Beijing, North China",
  applicationLevel: "The captured official Spring 2027 prospectus opens two undergraduate Chinese-language routes and one non-degree Chinese-language training route. The current official index also exposes Bachelor, Master, Doctoral, Chinese-language and short-term program sections.",
  languageOfInstruction: "Chinese for the captured Spring 2027 routes.",
  languageRequirement: "Spring 2027: HSK Level 3 score 210 for Chinese Language bachelor; HSK Level 4 score 210 for Teaching Chinese to Speakers of Other Languages bachelor; HSK Level 3 for Chinese-language training. Undergraduate applicants must also take the published CSCA Chinese and Mathematics examinations, with the stated exemption rule for professional Chinese.",
  hskRequirement: "HSK 3 score 210 for Chinese Language bachelor; HSK 4 score 210 for TCSOL bachelor; HSK 3 for Chinese-language training in Spring 2027.",
  deadlineSummary: "Spring 2027 general applications close December 31, 2026. The one-semester International Chinese Language Teachers Scholarship closes October 31, 2026 Beijing time.",
  tuitionSummary: "Spring 2027 tuition per semester: CNY 11,800 for the two undergraduate routes and CNY 9,800 for Chinese-language training. Accommodation is CNY 160/day single, CNY 80/day double or CNY 40/day four-bed room.",
  applicationFee: "CNY 450, non-refundable after payment",
  websiteUrl: "https://www.cnu.edu.cn/",
  admissionsUrl: guide.finalUrl ?? guide.url,
  subjectTags: ["Education", "Chinese Language", "Teaching Chinese to Speakers of Other Languages", "Humanities"],
  languageTags: ["Chinese"],
  tuitionBandLabel: "CNY 9,800-11,800/semester for Spring 2027 routes",
  campusHighlights: ["Teacher education focus", "Official Spring 2027 intake", "Degree and Chinese-language training routes"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sourceFields(guide),
  sourceFieldLineage: {
    nameEn: "official English prospectus",
    nameZh: "official Chinese university and college pages",
    citySlug: "official prospectus location",
    schoolType: "official institutional description plus CUAC taxonomy",
    region: "official location plus CUAC taxonomy",
    applicationLevel: "official current program index and Spring 2027 prospectus",
    languageOfInstruction: "official Spring 2027 program scope",
    languageRequirement: "official Spring 2027 eligibility and CSCA section",
    hskRequirement: "official Spring 2027 eligibility section",
    deadlineSummary: "official Spring 2027 prospectus and scholarship guide",
    tuitionSummary: "official Spring 2027 fee table",
    applicationFee: "official Spring 2027 fee table and payment note",
    websiteUrl: "official university home",
    admissionsUrl: "official Spring 2027 prospectus",
    subjectTags: "official Spring 2027 route names and institutional scope",
    languageTags: "official Spring 2027 route descriptions",
    tuitionBandLabel: "official Spring 2027 fee table",
    campusHighlights: "official institutional profile and Spring 2027 prospectus",
  },
};

const specs = [
  { name: "Chinese Language", degreeLevel: "Bachelor", tuition: 11800, hsk: "HSK Level 3 score 210 or above", note: "Applicants must take the CSCA Liberal Arts Chinese and Chinese-version Mathematics examinations; a valid HSK Level 4 report can exempt the professional-Chinese test." },
  { name: "Teaching Chinese to Speakers of Other Languages", degreeLevel: "Bachelor", tuition: 11800, hsk: "HSK Level 4 score 210 or above", note: "Applicants must take the CSCA Liberal Arts Chinese and Chinese-version Mathematics examinations." },
  { name: "Chinese Language Training", degreeLevel: "Non-degree", tuition: 9800, hsk: "HSK Level 3", note: "Spring 2027 Chinese-language training route." },
] as const;
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = specs.map((spec) => ({
  slug: `capital-normal-university-${slugify(spec.name)}-${spec.degreeLevel === "Bachelor" ? "bachelor" : "non-degree"}-spring-2027`,
  schoolSlug: school.slug,
  citySlug: "beijing",
  nameEn: spec.name,
  degreeLevel: spec.degreeLevel,
  fieldCategory: "Chinese Language and Education",
  subjectArea: spec.name,
  teachingLanguage: "Chinese",
  hskRequirement: spec.hsk,
  tuitionAmount: spec.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/semester; application fee CNY 450.`,
  applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: `${spec.note} Applications close December 31, 2026.`,
  badgeText: "Official Spring 2027 route",
  displayTuition: `CNY ${spec.tuition.toLocaleString("en-US")}/semester`,
  displaySubjects: [spec.name],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sourceFields(guide),
  sourceFieldLineage: {
    nameEn: "official Spring 2027 program list",
    degreeLevel: "official Spring 2027 program category",
    fieldCategory: "official route name normalized to CUAC taxonomy",
    subjectArea: "official route name",
    teachingLanguage: "official Chinese-language route scope",
    hskRequirement: "official Spring 2027 eligibility section",
    tuitionAmount: "official Spring 2027 fee table",
    tuitionText: "official Spring 2027 fee table",
    applicationUrl: "official Spring 2027 prospectus",
    applicationNote: "official Spring 2027 requirements and deadline",
    badgeText: "official cycle label",
  },
}));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring 2027",
  intakeYear: 2027,
  deadlineDate: "2026-12-31T15:59:59.000Z",
  deadlineLabel: "Applications close December 31, 2026.",
  applicationRound: "Spring 2027 international student admission",
  status: "open" as const,
  ...sourceFields(guide),
  sourceFieldLineage: { intakeTerm: "official prospectus title", intakeYear: "official prospectus title", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official deadline", applicationRound: "official prospectus title" },
}));

const scholarships = [{
  slug: "capital-normal-university-international-chinese-language-teachers-spring-2027",
  schoolSlug: school.slug,
  programSlug: programs[2].slug,
  title: "International Chinese Language Teachers Scholarship at Capital Normal University — Spring 2027",
  nameZh: "首都师范大学国际中文教师奖学金（2027年春季一学期研修）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心 / 首都师范大学",
  providerNameEn: "Center for Language Education and Cooperation / Capital Normal University",
  providerLocation: "Beijing, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance for up to five months.",
  applicableDegree: "One-semester non-degree study",
  applicableProgram: "TCSOL, Chinese Language and Literature, or Taiji Culture for March 2027 enrollment.",
  amountText: "Full tuition, accommodation, living allowance and comprehensive medical insurance; the captured guide does not state a numeric allowance amount.",
  requirementText: "Non-Chinese citizens in good health, interested in Chinese-language education or related work, normally age 18-35 as of September 1, 2026 (up to 45 for in-service Chinese teachers). TCSOL and Chinese Language and Literature require HSK Level 3 score 180 plus an HSKK score; Taiji Culture requires an HSK result and gives priority to HSKK holders.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "Covered" },
    { label: "Living allowance", included: true, note: "Covered; amount not stated in the captured guide" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
  ],
  eligibilityItems: [
    { label: "Nationality", value: "Non-Chinese citizen" },
    { label: "Age", value: "18-35 as of September 1, 2026; up to 45 for in-service Chinese teachers" },
    { label: "TCSOL / Chinese Language and Literature", value: "HSK Level 3 score 180 plus an HSKK result" },
    { label: "Taiji Culture", value: "HSK result required; HSKK holders receive priority" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Passport photo page" },
    { label: "Language", value: "Valid HSK and HSKK reports as applicable" },
    { label: "Recommendation", value: "Letter from the head of the recommending institution" },
    { label: "Health", value: "Foreigner Physical Examination Form" },
    { label: "Education", value: "Highest diploma or expected-graduation proof and official transcript" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Apply through the International Chinese Language Teachers Scholarship website and obtain recommendation" },
    { label: "Step 2", value: "Also complete Capital Normal University's international student online application" },
    { label: "Step 3", value: "Submit by October 31, 2026 Beijing time and track review results" },
  ],
  actionLinks: [{ label: "Official Capital Normal University scholarship guide", url: scholarshipSource.finalUrl ?? scholarshipSource.url, kind: "official-source" }],
  deadlineDate: "2026-10-31",
  deadlineLabel: "Applications close October 31, 2026 Beijing time.",
  applicationRound: "March 2027 one-semester study",
  summary: "Up-to-five-month Spring 2027 scholarship route covering tuition, accommodation, living allowance and medical insurance.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipSource.fetchedAt,
  ...sourceFields(scholarshipSource),
  sourceFieldLineage: {
    title: "official guide title",
    coverage: "official scholarship coverage section",
    applicableDegree: "official one-semester route",
    applicableProgram: "official scholarship types table",
    amountText: "official coverage section with numeric amount intentionally left unresolved",
    requirementText: "official eligibility and qualification sections",
    benefitItems: "official scholarship coverage section",
    eligibilityItems: "official eligibility table",
    applicationMaterials: "official application documents section",
    applicationSteps: "official application procedures",
    deadlineDate: "official deadline",
    applicationRound: "official March 2027 enrollment",
    summary: "official duration and coverage",
  },
}];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: guide.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([, id]) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: guide.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 100, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "This wave structures the official Spring 2027 routes only; Fall 2027, graduate and other non-degree cycles remain absent until cycle-specific official evidence is published.",
    "The scholarship guide states that a living allowance is covered but does not publish its numeric amount, so that amount remains blank.",
    "The prospectus does not state the full undergraduate degree duration in the captured page, so durationYears is not inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant data, payment credentials and personal contacts are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-152");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 152, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
