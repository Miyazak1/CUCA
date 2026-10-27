import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id:string; label:string; url:string; finalUrl?:string; fetchedAt:string; status:number; contentType:string; sha256:string; artifactPath:string };
const root = process.cwd();
const run = "2026-10-26T08-54-11-287Z";
const dir = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(dir, "manifest.json"), "utf8")) as { sources: Source[] };
const locks = new Map([
  ["sxu-university-home-current", "b8e165105782830270e595c26bf4d8ae892707976e0ae640d16fa0a178afacaf"],
  ["sxu-international-education-home-current", "15927609a1b7d5e5832676048876e9938c89de359bc55d200d36198c788624fa"],
  ["sxu-international-one-plus-four-program-2026-2031", "0afb4a1aa68905b9e55195b5cf714d2f29d32f27a441a9c88f8f864f519e9882"],
]);
const sources = new Map(manifest.sources.map((source) => [source.id, source]));
for (const [id, sha] of locks) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== sha) throw new Error(`Missing locked Shanxi University source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(dir, source.artifactPath))).digest("hex");
  if (actual !== sha) throw new Error(`Shanxi University evidence hash mismatch: ${id}`);
}
const source = sources.get("sxu-international-one-plus-four-program-2026-2031")!;
const sf = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const wave150 = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-150.draft.json"), "utf8")) as CatalogSeedBundle;
const city = wave150.cities?.find((item) => item.slug === "taiyuan");
if (!city) throw new Error("Wave 150 Taiyuan dependency missing");

const schoolSlug = "shanxi-university";
const degreePaths = ["International Economics and Trade", "Business Administration", "Tourism Management", "Chinese Language and Literature", "International Politics", "Computer Science and Technology"];
const school = {
  slug: schoolSlug,
  nameEn: "Shanxi University",
  nameZh: "山西大学",
  citySlug: "taiyuan",
  schoolType: "Provincial comprehensive university",
  region: "Taiyuan, Shanxi, North China",
  applicationLevel: "Documented 1+4 preparatory-to-bachelor pathway; broader current international admissions remain unresolved",
  languageOfInstruction: "Chinese for the documented pathway",
  deadlineSummary: "The documented pathway accepted applications March 1-June 30, 2026, began preparation September 1, 2026 and starts its bachelor phase September 1, 2027.",
  tuitionSummary: "Preparatory tuition CNY 5,000/year; bachelor tuition CNY 20,000/year; application CNY 500; insurance CNY 800/year; accommodation CNY 300/month for a triple room.",
  applicationFee: "CNY 500, non-refundable",
  websiteUrl: "https://www.sxu.edu.cn/",
  admissionsUrl: source.finalUrl ?? source.url,
  subjectTags: degreePaths,
  languageTags: ["Chinese"],
  campusHighlights: ["One preparatory year followed by a four-year bachelor phase", "Bachelor study period September 1, 2027-July 15, 2031", "Six published progression majors"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sf,
  sourceFieldLineage: {
    nameEn: "official university and international-school pages",
    nameZh: "official Chinese guide title",
    citySlug: "official address plus reviewed Taiyuan dependency",
    schoolType: "official university identity plus CUAC classification",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official 1+4 guide scope with broader-cycle limitation",
    languageOfInstruction: "official preparatory curriculum and HSK progression requirements",
    deadlineSummary: "official application and study periods",
    tuitionSummary: "official expenses table",
    applicationFee: "official expenses table",
    websiteUrl: "official university home",
    admissionsUrl: "official 1+4 guide",
    subjectTags: "official program-available list, with Chinese text resolving the missing English separator",
    languageTags: "official curriculum and scholarship progression rules",
    campusHighlights: "official study-period and program sections",
  },
};

const program = {
  slug: "shanxi-university-one-plus-four-preparatory-bachelor-pathway-2026-2031",
  schoolSlug,
  citySlug: "taiyuan",
  nameEn: "1+4 Preparatory-to-Bachelor Pathway",
  nameZh: "1+4本科项目",
  degreeLevel: "Foundation / Bachelor pathway",
  durationYears: 5,
  fieldCategory: "Language and Foundation",
  subjectArea: "Preparatory study with progression to one of six bachelor majors",
  teachingLanguage: "Chinese",
  hskRequirement: "No entry HSK threshold is printed. Progression scholarship thresholds require HSK 4 with at least 220 for Tier A or 200 for Tier B.",
  cscaRequirement: "Passing the Ministry of Education CSCA is required for the published undergraduate scholarship progression tiers.",
  tuitionAmount: 5000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "preparatory year",
  tuitionText: "CNY 5,000 for the preparatory year and CNY 20,000/year for the bachelor phase; separate CNY 500 application fee, CNY 800/year insurance, CNY 300/month triple-room accommodation and other published charges.",
  scholarshipText: "Tier A or Tier B undergraduate scholarship may apply after the preparatory year when the published CSCA, entrance-exam, HSK, attendance and final-exam thresholds are met.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Applicants must be non-Chinese citizens under age 25, hold a high-school certificate and have an average transcript score of at least 75. The 2026 application window is closed; this record does not imply direct Fall 2027 admission.",
  hasScholarship: true,
  badgeText: "Bachelor phase begins 2027",
  displayTuition: "CNY 5,000 prep year + CNY 20,000/year bachelor",
  displaySubjects: degreePaths,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sf,
  sourceFieldLineage: {
    nameEn: "official English guide title and 1+4 structure",
    nameZh: "official Chinese guide title",
    degreeLevel: "official preparatory category and bachelor study phase",
    durationYears: "official September 2026-July 2031 study periods normalized to five academic years",
    fieldCategory: "CUAC taxonomy",
    subjectArea: "official program-available list",
    teachingLanguage: "official preparatory curriculum and HSK progression rules",
    hskRequirement: "official scholarship standards; explicitly not an entry threshold",
    cscaRequirement: "official scholarship standards",
    tuitionAmount: "official expenses table",
    tuitionText: "official expenses table",
    scholarshipText: "official undergraduate scholarship table",
    applicationUrl: "official 1+4 guide",
    applicationNote: "official eligibility and application-period sections",
    badgeText: "official bachelor study period",
  },
};

const intake = {
  programSlug: program.slug,
  intakeTerm: "Fall 2026 pathway entry / Fall 2027 bachelor phase",
  intakeYear: 2026,
  openDate: "2026-03-01T00:00:00.000Z",
  deadlineDate: "2026-06-30T15:59:59.000Z",
  deadlineLabel: "Applications closed June 30, 2026. Preparatory study runs September 1, 2026-July 15, 2027; the bachelor phase runs September 1, 2027-July 15, 2031.",
  applicationRound: "Shanxi University 1+4 Program 2026-2031",
  status: "closed" as const,
  ...sf,
  sourceFieldLineage: {
    intakeTerm: "official preparatory and bachelor study periods",
    intakeYear: "official preparatory start date; not represented as a direct 2027 intake",
    openDate: "official application period",
    deadlineDate: "official deadline converted from Beijing end-of-day",
    deadlineLabel: "official application and study periods",
    applicationRound: "official guide title",
  },
};

const scholarship = {
  slug: "shanxi-university-one-plus-four-undergraduate-scholarship-2027",
  schoolSlug,
  title: "Shanxi University Undergraduate Scholarship for 1+4 Program Progression",
  nameZh: "山西大学1+4本科项目本科奖学金",
  type: "university",
  typeLabel: "University undergraduate scholarship",
  providerName: "山西大学",
  providerNameEn: "Shanxi University",
  providerLocation: "Taiyuan, Shanxi, China",
  fundingLevel: "Tier A full tuition, accommodation and living allowance; Tier B tuition and accommodation",
  coverage: "Tier A waives tuition and accommodation and provides CNY 7,500/year living allowance. Tier B waives tuition and accommodation.",
  applicableDegree: "Bachelor phase of the documented 1+4 pathway",
  applicableProgram: degreePaths.join(", "),
  requirementText: "Both tiers require passing CSCA, preparatory attendance of at least 85% and published Shanxi University entrance-exam, HSK 4 and final-exam thresholds.",
  benefitItems: [
    { label: "Tier A tuition", included: true, note: "Waived" },
    { label: "Tier A accommodation", included: true, note: "Waived" },
    { label: "Tier A living allowance", included: true, note: "CNY 7,500/year, paid monthly" },
    { label: "Tier B tuition", included: true, note: "Waived" },
    { label: "Tier B accommodation", included: true, note: "Waived" },
  ],
  eligibilityItems: [
    { label: "Tier A", value: "Pass CSCA; Shanxi University entrance exam at least 85; HSK 4 at least 220; preparatory attendance at least 85%; final-exam average at least 80" },
    { label: "Tier B", value: "Pass CSCA; Shanxi University entrance exam at least 75; HSK 4 at least 200; preparatory attendance at least 85%; final-exam average at least 70" },
  ],
  actionLinks: [{ label: "Official 1+4 program and scholarship guide", url: source.finalUrl ?? source.url, kind: "official-source" }],
  applicationRound: "Progression from the 2026-2027 preparatory year to the bachelor phase beginning September 2027",
  summary: "Performance-based university scholarship for students progressing from the published preparatory year into the bachelor phase.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sf,
  sourceFieldLineage: {
    title: "official undergraduate scholarship heading and pathway context",
    typeLabel: "official university scholarship table",
    coverage: "official Tier A and Tier B benefit standards",
    applicableDegree: "official 1+4 study periods",
    applicableProgram: "official program-available list",
    requirementText: "official scholarship conditions",
    benefitItems: "official scholarship standards",
    eligibilityItems: "official scholarship standards",
    actionLinks: "official captured guide",
    applicationRound: "official preparatory and bachelor study periods",
    summary: "official scholarship scope",
  },
};

const candidate: CatalogSeedBundle = { version:1, generatedAt:source.fetchedAt, cities:[city], schools:[school], programs:[program], programIntakes:[intake], scholarships:[scholarship] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const item = sources.get(id)!; return { id:item.id, label:item.label, url:item.finalUrl ?? item.url, contentType:item.contentType, fetchedAt:item.fetchedAt, sha256:item.sha256 }; });
const review = {
  version:1,
  status:"unreviewed_draft",
  generatedAt:source.fetchedAt,
  candidateSha256,
  publicationAuthorized:false,
  databaseWriteAuthorized:false,
  scope:{ target:"2026 ShanghaiRanking BCUR top 150", targetPosition:102, schoolSlugs:[schoolSlug], newSchools:1, programs:1, programIntakes:1, scholarships:1 },
  evidence,
  unresolved:[
    "The documented application window closed June 30, 2026. The source proves a September 2027 bachelor phase but does not advertise direct Fall 2027 entry, so the intake remains a closed 2026 pathway entry.",
    "Current standalone 2027 bachelor, master, doctoral, language and scholarship application guides remain unresolved.",
    "The source does not publish an entry HSK threshold or per-major CSCA subjects; scholarship progression thresholds are retained separately and are not presented as entry requirements.",
  ],
  sensitiveDataCheck:{ result:"pass", note:"Named staff contacts, phone/WeChat details, address details and applicant personal-document contents are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-153");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized:false, databaseWriteAuthorized:false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok:true, wave:153, candidateSha256, counts:validation.summary, publicationAuthorized:false, databaseWriteAuthorized:false }, null, 2));
