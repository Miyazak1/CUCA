import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const directory = resolve(root, "work/catalog-official/2026-10-26T14-02-19-662Z");
const locks = new Map([
  ["zafu-international-application-index-current", "65cdbde624a0f5d77d7d0117650204ba0506c89c3c40d0bc120b4bf5bfd7d9e3"],
  ["zafu-international-fall-guide-page-2026", "c6c909511ce167f5c3b41246864ce16d443890f450666bde728013fb6c30502a"],
  ["zafu-international-fall-guide-pdf-2026", "18163a468e62e78f3e8506694371304b22b209f099be42028b46ac7b2d42ff62"],
  ["zafu-international-chinese-teachers-scholarship-2026", "cb21e58523d1f6dd4ee012e846f0cb1907f1201ec66a7fba8d6976408bf30a8a"],
  ["zafu-international-spring-language-page-2026", "eeb1b6ee953d303c068f024561da7bb656e53fdd7ebd9c8d0c73d80980a1a440"],
  ["zafu-international-spring-language-pdf-2026", "928ac8c1d7fe4d6a0061b9bfa68391bef292a839264e54ac1e5f2cd42d908d09"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha);
  if (!source) throw new Error(`Missing locked ZAFU source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha) throw new Error(`ZAFU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const refreshedScholarshipDirectory = resolve(root, "work/catalog-official/2026-10-27T03-24-51-109Z");
const refreshedScholarshipManifest = JSON.parse(await readFile(resolve(refreshedScholarshipDirectory, "manifest.json"), "utf8")) as { sources: Source[] };
const refreshedScholarship = refreshedScholarshipManifest.sources.find((entry) => entry.id === "zafu-international-chinese-teachers-scholarship-2026" && entry.status === 200 && entry.sha256 === locks.get("zafu-international-chinese-teachers-scholarship-2026"));
if (!refreshedScholarship) throw new Error("Missing refreshed locked ZAFU scholarship source");
if (createHash("sha256").update(await readFile(resolve(refreshedScholarshipDirectory, refreshedScholarship.artifactPath))).digest("hex") !== refreshedScholarship.sha256) throw new Error("Refreshed ZAFU scholarship evidence hash mismatch");
sources.set(refreshedScholarship.id, refreshedScholarship);
const index = sources.get("zafu-international-application-index-current")!;
const guide = sources.get("zafu-international-fall-guide-page-2026")!;
const scholarshipGuide = sources.get("zafu-international-chinese-teachers-scholarship-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const reviewed = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = reviewed.cities?.find((entry) => entry.slug === "hangzhou");
if (!city) throw new Error("Reviewed Hangzhou dependency missing");

const schoolSlug = "zhejiang-a-f-university";
const school = {
  slug: schoolSlug,
  nameEn: "Zhejiang A&F University",
  nameZh: "浙江农林大学",
  citySlug: city.slug,
  schoolType: "Public agriculture and forestry university",
  region: "Hangzhou, Zhejiang, East China",
  applicationLevel: "The latest complete self-funded guide covers 2026 language and English-taught undergraduate study. A separate International Chinese Language Teachers Scholarship route explicitly includes March 2027 entry.",
  languageOfInstruction: "English for the 14 listed undergraduate majors; Chinese for language study and the scholarship language route.",
  languageRequirement: "The March 2027 one-semester scholarship route requires HSK Level 3 score 180 plus an HSKK result. The 2026 self-funded guide requests language-proficiency evidence but does not publish a numeric undergraduate threshold.",
  hskRequirement: "March 2027 scholarship route: HSK Level 3 score 180 plus HSKK result.",
  deadlineSummary: "March 2027 International Chinese Language Teachers Scholarship deadline: October 31, 2026. The 2026 fall self-funded window closed June 30, 2026.",
  tuitionSummary: "Latest complete self-funded guide: language study CNY 14,000/year; English-taught undergraduate study CNY 20,000/year; graduate study CNY 22,000/year.",
  applicationFee: "CNY 600",
  websiteUrl: "https://www.zafu.edu.cn/",
  admissionsUrl: index.finalUrl ?? index.url,
  subjectTags: ["Agriculture", "Forestry", "Engineering", "Economics", "Computer Science", "Chinese Language"],
  languageTags: ["English", "Chinese"],
  tuitionBandLabel: "Latest 2026 self-funded schedule: CNY 14,000-22,000/year",
  campusHighlights: ["Three-campus university in Zhejiang", "Fourteen English-taught undergraduate majors in the latest complete guide", "Explicit March 2027 scholarship language route"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: index.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official bilingual admission guide", nameZh: "official bilingual admission guide", citySlug: "official Hangzhou address plus reviewed dependency", schoolType: "official institutional description plus CUAC taxonomy", region: "official address plus CUAC taxonomy", applicationLevel: "official 2026 self-funded guide and scholarship guide with March 2027 entry", languageOfInstruction: "official program section", languageRequirement: "official scholarship eligibility and self-funded document list", hskRequirement: "official scholarship eligibility", deadlineSummary: "official self-funded and scholarship dates", tuitionSummary: "official fee section", applicationFee: "official fee sections", websiteUrl: "official university domain", admissionsUrl: "official current index", subjectTags: "official major list plus CUAC taxonomy", languageTags: "official teaching-language statements", tuitionBandLabel: "official latest complete fee schedule", campusHighlights: "official school and admission descriptions",
  },
};

const undergraduateNames = ["International Economics and Trade", "Computer Science and Technology", "Civil Engineering", "Digital Economy", "Mechanical Design, Manufacturing and Automation", "Electronic Information Engineering", "Urban and Rural Planning", "Wood Science and Engineering", "Forestry", "Veterinary Medicine", "Furniture Design and Engineering", "Accounting", "Horticulture", "Tea Science"];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const programBase = { schoolSlug, citySlug: city.slug, status: "active" as const, verificationStatus: "verified" as const };
const undergraduatePrograms: CatalogSeedProgram[] = undergraduateNames.map((name) => ({
  ...programBase,
  slug: `${schoolSlug}-${slugify(name)}-bachelor-fall-2026`,
  nameEn: name,
  degreeLevel: "Bachelor",
  durationMonths: 48,
  fieldCategory: name,
  subjectArea: name,
  teachingLanguage: "English",
  tuitionText: "Latest complete 2026 guide: CNY 20,000/year; application fee CNY 600.",
  applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: "Closed Fall 2026 self-funded route. The application window ended June 30, 2026 and is not relabeled as 2027.",
  hasScholarship: true,
  scholarshipText: "The guide lists Zhejiang Provincial Government Scholarship and university partial awards; no 2027 self-funded award round is inferred.",
  badgeText: "Closed Fall 2026",
  displaySubjects: [name],
  lastVerifiedAt: guide.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: { nameEn: "official undergraduate major list", degreeLevel: "official program section", durationMonths: "official four-year duration", fieldCategory: "official major", subjectArea: "official major", teachingLanguage: "official English-medium statement", tuitionText: "official fee section", applicationUrl: "official guide", applicationNote: "official closed application window", hasScholarship: "official scholarship-type list", scholarshipText: "official award names with unresolved 2027 round", badgeText: "official closed cycle", displaySubjects: "official major" },
}));
const generalLanguage: CatalogSeedProgram = { ...programBase, slug: `${schoolSlug}-chinese-language-fall-2026`, nameEn: "Chinese Language Program", degreeLevel: "Non-degree", durationMonths: 12, fieldCategory: "Chinese Language", subjectArea: "Chinese language study at all levels", teachingLanguage: "Chinese", tuitionText: "Latest complete 2026 guide: CNY 14,000/year; application fee CNY 600.", applicationUrl: guide.finalUrl ?? guide.url, applicationNote: "Closed Fall 2026 self-funded route; no general 2027 intake is inferred.", hasScholarship: true, scholarshipText: "Separate scholarship routes are published; this self-funded record does not infer award eligibility.", badgeText: "Closed Fall 2026", displaySubjects: ["Chinese Language"], lastVerifiedAt: guide.fetchedAt, ...sf(guide), sourceFieldLineage: { nameEn: "official program section", degreeLevel: "official language-program type", durationMonths: "official one-year duration", fieldCategory: "official program type", subjectArea: "official all-level scope", teachingLanguage: "official program identity", tuitionText: "official fee section", applicationUrl: "official guide", applicationNote: "official closed window", hasScholarship: "official scholarship list", scholarshipText: "scope kept separate", badgeText: "official closed cycle", displaySubjects: "official route identity" } };
const scholarshipLanguage: CatalogSeedProgram = { ...programBase, slug: `${schoolSlug}-international-chinese-language-teachers-scholarship-one-semester-spring-2027`, nameEn: "International Chinese Language Teachers Scholarship One-Semester Chinese Language and Literature Program", degreeLevel: "Non-degree", durationMonths: 5, fieldCategory: "Chinese Language", subjectArea: "Chinese Language and Literature", teachingLanguage: "Chinese", hskRequirement: "HSK Level 3 score 180 plus an HSKK result; applicants with X1 or X2 visas are not admitted.", tuitionText: "Scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance; language-student living allowance CNY 2,500/month.", applicationUrl: scholarshipGuide.finalUrl ?? scholarshipGuide.url, applicationNote: "Open March 2027 scholarship intake; application deadline October 31, 2026 (Beijing time).", hasScholarship: true, scholarshipText: "International Chinese Language Teachers Scholarship, including tuition, accommodation, CNY 2,500/month living allowance and insurance.", badgeText: "Spring 2027 open", displaySubjects: ["Chinese Language", "Chinese Literature"], lastVerifiedAt: scholarshipGuide.fetchedAt, ...sf(scholarshipGuide), sourceFieldLineage: { nameEn: "official scholarship table", degreeLevel: "official one-semester study category", durationMonths: "official five-month duration", fieldCategory: "official route type", subjectArea: "official route name", teachingLanguage: "official route identity", hskRequirement: "official eligibility table", tuitionText: "official coverage section", applicationUrl: "official guide", applicationNote: "official March 2027 intake and deadline", hasScholarship: "official scholarship route", scholarshipText: "official coverage section", badgeText: "official future cycle", displaySubjects: "official route identity" } };
const programs = [...undergraduatePrograms, generalLanguage, scholarshipLanguage];
const programIntakes = [
  ...undergraduatePrograms.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-30T15:59:59.000Z", deadlineLabel: "Applications closed June 30, 2026.", applicationRound: "Fall 2026 self-funded admission", status: "closed" as const, ...sf(guide), sourceFieldLineage: { intakeTerm: "official fall guide", intakeYear: "official guide cycle", deadlineDate: "official online application period", deadlineLabel: "official online application period", applicationRound: "official guide title" } })),
  { programSlug: generalLanguage.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-30T15:59:59.000Z", deadlineLabel: "Applications closed June 30, 2026.", applicationRound: "Fall 2026 self-funded admission", status: "closed" as const, ...sf(guide), sourceFieldLineage: { intakeTerm: "official fall guide", intakeYear: "official guide cycle", deadlineDate: "official online application period", deadlineLabel: "official online application period", applicationRound: "official guide title" } },
  { programSlug: scholarshipLanguage.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-10-31T15:59:59.000Z", deadlineLabel: "Applications close October 31, 2026 (Beijing time).", applicationRound: "March 2027 International Chinese Language Teachers Scholarship", status: "open" as const, ...sf(scholarshipGuide), sourceFieldLineage: { intakeTerm: "official March 2027 entry", intakeYear: "official March 2027 entry", deadlineDate: "official deadline", deadlineLabel: "official deadline", applicationRound: "official scholarship guide" } },
];
const scholarship = { slug: `${schoolSlug}-international-chinese-language-teachers-scholarship-2026-2027`, title: "International Chinese Language Teachers Scholarship 2026/2027", nameZh: "浙江农林大学2026年国际中文教师奖学金", schoolSlug, type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "Center for Language Education and Cooperation / Zhejiang A&F University", fundingLevel: "Full scholarship", coverage: "Tuition, accommodation, monthly living allowance, and comprehensive medical insurance.", applicableDegree: "One-semester and one-year non-degree study; cooperative master's study", applicableProgram: "March 2027 entry is explicitly available for the five-month Chinese Language and Literature route; other listed routes enter in September 2026.", amountText: "CNY 2,500/month for language students; CNY 3,000/month for master's students.", requirementText: "March 2027 one-semester route requires HSK Level 3 score 180 and an HSKK result; applicants with X1 or X2 visas are excluded. General age range is 16-35 as of September 1, 2026.", benefitItems: [{ label: "Tuition", included: true, note: "Covered" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "CNY 2,500/month language; CNY 3,000/month master" }, { label: "Medical insurance", included: true, note: "Comprehensive coverage" }], eligibilityItems: [{ label: "March 2027 language threshold", value: "HSK 3 score 180 plus HSKK result" }, { label: "General age", value: "16-35 as of September 1, 2026" }], applicationSteps: [{ label: "Step 1", value: "Apply through the official International Chinese Language Teachers Scholarship system from March 1, 2026." }, { label: "Step 2", value: "After award confirmation, submit the required confirmation information through the university system." }], actionLinks: [{ label: "Official scholarship guide", url: scholarshipGuide.finalUrl ?? scholarshipGuide.url, kind: "official-source" }], deadlineDate: "2026-10-31", deadlineLabel: "March 2027 intake closes October 31, 2026 (Beijing time).", applicationRound: "2026/2027 scholarship cycle", summary: "Full scholarship with an explicitly published March 2027 one-semester Chinese Language and Literature intake.", status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: scholarshipGuide.fetchedAt, ...sf(scholarshipGuide), sourceFieldLineage: { title: "official guide title", coverage: "official coverage section", applicableDegree: "official scholarship table", applicableProgram: "official scholarship table", amountText: "official living-allowance section", requirementText: "official eligibility table", benefitItems: "official coverage section", eligibilityItems: "official eligibility table", applicationSteps: "official high-level application flow without applicant documents", actionLinks: "official guide", deadlineDate: "official March 2027 deadline", deadlineLabel: "official deadline", applicationRound: "official guide cycle", summary: "official scope" } };

const candidate: CatalogSeedBundle = { version: 1, generatedAt: index.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = { version: 1, status: "unreviewed_draft", generatedAt: index.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 150, schoolSlugs: [schoolSlug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1 }, evidence, unresolved: ["No applicant-facing general 2027 self-funded guide, undergraduate catalog, graduate catalog, tuition schedule or deadline is published on the current international application index.", "The latest complete self-funded program and fee fields remain cycle-labeled as 2026 and are not carried forward to 2027.", "The guide links graduate details to a scholarship page rather than a general graduate catalog, so graduate self-funded route names remain absent.", "Applicant documents, personal contacts, payment instructions and bank information are excluded."], sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions or bank information are present." } };
const stem = resolve(root, "seeds/catalog.2027-wave-188");
await Promise.all([writeFile(`${stem}.draft.json`, text, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 188, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
