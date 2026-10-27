import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type ProgramSpec = { name: string; degree: "Bachelor" | "Master" | "Doctoral"; faculty: string; language?: "Chinese" | "English" };

const root = process.cwd();
const run = "2026-10-26T11-34-01-757Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["tiangong-international-notifications-current", "ca5ff72a78b979a1b15471fbd0499d0a2de5fc640aa29670f92e480515d09b05"],
  ["tiangong-international-projects-current", "56ed45e0687081dfa41cb4e9be109deb1ee71ea4b7d57f4305cdee447932bd8d"],
  ["tiangong-international-scholarships-current", "2b30cf36b150952ffd33d75f275e857afb5fe1da33f32c0839d5d2e55414aeb5"],
  ["tiangong-majors-list-current", "dd5abe0f4f65806b4ce3c4f9983e1b750a53cc1783a4c1d10a7983814c165641"],
  ["tiangong-majors-list-pdf-current", "ceb265ec2e8fa864ec82a7c5a74d9cb35ccdb5a7af28c87ef7df7493977e7182"],
  ["tiangong-cost-of-study-current", "b5251ffbc3ca4c0c06ad1ca9c927451cec9a62a3a0049c836f4796c698031aac"],
  ["tiangong-chinese-language-guide-2026", "ec7dd051b5f25ee2460a1873c3e5f8bb9dc941d056c6c97ef0bb2b741d243aa5"],
  ["tiangong-chinese-language-guide-pdf-2026", "b615500210705ced346ffe8ee3d3ab661e257ccf518f95b7ff64caf8557e0a8d"],
  ["tiangong-scholarship-guide-2026", "45f5432773cd2464124c6bd5d15bd8ec29709b74688136aa9fbc122ae4236760"],
  ["tiangong-scholarship-guide-pdf-2026", "6f9f53dda8f297b0b096e8743076a50b5fd7fc76e06e2376d302003e8d144b46"],
  ["tiangong-csca-notice-current", "6ec4f0c6b4650e71b1c5a40a34517dd405789a280c34dcb5ffdff6f1d3169225"],
  ["tiangong-bachelor-admission-current", "e82bfa6d5f13c76e8a4d8b3b481c348556cb224289ea2111909c8893a21422a0"],
  ["tiangong-graduate-admission-current", "f7944ec6c487f44e84f6ca0aea4fbe7ae4e76faf516dd4174c057f84e007a756"],
  ["tiangong-short-term-admission-current", "93aae90506cf1c297d854f8e4bc50dec67964c9a006f09bb56eb34542773bc05"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked Tiangong source: ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`Tiangong evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const notifications = sources.get("tiangong-international-notifications-current")!;
const majors = sources.get("tiangong-majors-list-pdf-current")!;
const languageGuide = sources.get("tiangong-chinese-language-guide-pdf-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "tianjin");
if (!city) throw new Error("Reviewed Tianjin dependency missing");

const school = {
  slug: "tiangong-university",
  nameEn: "Tiangong University",
  nameZh: "天津工业大学",
  citySlug: "tianjin",
  schoolType: "Public multidisciplinary university",
  region: "Tianjin, North China",
  applicationLevel: "The current official catalog lists bachelor, master and doctoral majors. A separate 2026 guide publishes one-semester and one-academic-year Chinese Language General Scholar study.",
  languageOfInstruction: "Chinese and English according to the current official majors table; only explicitly marked English-taught bachelor routes are labeled English in this candidate.",
  languageRequirement: "Current bachelor rules require HSK 3 or one of the published equivalents for Chinese-taught non-Chinese-language study. English-taught study accepts native English, IELTS 5.5, TOEFL computer-test performance of at least 60%, related proof or a passed interview. Chinese Language first-year study has no HSK threshold.",
  hskRequirement: "HSK 3 or a published equivalent for Chinese-taught non-Chinese-language bachelor study; Chinese Language first-year study is exempt.",
  englishRequirement: "Native English, IELTS 5.5, TOEFL computer-test performance of at least 60%, related proof or a passed interview for English-taught bachelor study.",
  deadlineSummary: "The current official notification index does not publish a complete applicant-facing 2027 degree deadline. No deadline is inferred.",
  tuitionSummary: "Current annual tuition: bachelor CNY 25,000; master CNY 30,000 for normal fields or CNY 34,000 for art and software engineering; doctoral CNY 38,000. The 2026 Chinese-language guide publishes CNY 16,000 per academic year.",
  applicationFee: "CNY 500, nonrefundable",
  websiteUrl: "https://en.tiangong.edu.cn/",
  admissionsUrl: notifications.finalUrl ?? notifications.url,
  cscaRequired: true,
  cscaRequirement: "The current official admissions index publishes a China Scholastic Competency Assessment notice and attachment. Exact route-level subjects are not inferred in this wave.",
  subjectTags: ["Textile Engineering", "Materials Science", "Chemical Engineering", "Mechanical Engineering", "Computer Science", "Artificial Intelligence", "Economics", "Art and Design"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Current: CNY 16,000-38,000/year by study type and degree level",
  campusHighlights: ["Current official catalog spans bachelor, master and doctoral study", "Official fee schedule covers tuition, registration, insurance and accommodation", "Current notification index still lacks a complete general 2027 degree guide"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: notifications.fetchedAt,
  ...sf(notifications),
  sourceFieldLineage: {
    nameEn: "official English admissions site",
    nameZh: "official Chinese international-education site",
    citySlug: "official address plus reviewed Tianjin dependency",
    applicationLevel: "current official majors table and 2026 language guide",
    languageOfInstruction: "current official majors table",
    languageRequirement: "current official bachelor admission rules",
    hskRequirement: "current official bachelor admission rules",
    englishRequirement: "current official bachelor admission rules",
    deadlineSummary: "current official notification index with explicit unresolved 2027 cycle",
    tuitionSummary: "current official cost page and 2026 language guide",
    applicationFee: "current official cost page and 2026 language guide",
    cscaRequired: "current official CSCA notice title",
    cscaRequirement: "current official CSCA notice with attachment details intentionally unresolved",
    subjectTags: "current official majors table",
    languageTags: "current official majors table",
    tuitionBandLabel: "current official cost page and 2026 language guide",
    campusHighlights: "current official catalog, fee page and notification index",
  },
};

const specs: ProgramSpec[] = [];
const add = (degree: ProgramSpec["degree"], faculty: string, names: string[], language?: ProgramSpec["language"]) => names.forEach((name) => specs.push({ name, degree, faculty, language }));
add("Bachelor", "School of International Education", ["Chinese Language", "Performance (Model)"], "English");
add("Bachelor", "School of Textile Science and Engineering", ["Textile Engineering", "Clothing Design and Engineering"], "English");
add("Bachelor", "School of Materials Science and Engineering", ["Materials Science and Engineering", "Composite Materials and Engineering", "Polymer Materials and Engineering"], "English");
add("Bachelor", "School of Chemical Engineering and Technology", ["Chemical Engineering and Technology"], "English");
add("Bachelor", "School of Mechanical Engineering", ["Mechanical Engineering"], "Chinese");
add("Bachelor", "School of Electronic and Information Engineering", ["Electronic Information Engineering"], "English");
add("Bachelor", "School of Control Science and Engineering", ["Automation"], "English");
add("Bachelor", "School of Computer Science and Technology", ["Computer Science and Technology"], "English");
add("Bachelor", "School of Artificial Intelligence", ["Artificial Intelligence"], "English");
add("Bachelor", "School of Humanities", ["Radio and Television Directing", "Network and New Media"], "Chinese");
add("Bachelor", "School of Economics and Management", ["Finance", "Accounting", "Information Management and Information System", "Industrial Engineering", "Public Management"], "Chinese");
add("Bachelor", "School of Economics and Management", ["International Economics and Trade", "Business Administration"], "English");
add("Bachelor", "School of Law", ["Law"], "Chinese");
add("Bachelor", "School of Arts", ["Clothing and Fashion Design", "Visual Communication Design"], "Chinese");

add("Master", "School of Textile Science and Engineering", ["Textile Science and Engineering"]);
add("Master", "School of Materials Science and Engineering", ["Materials Science and Engineering", "Materials and Chemical Engineering"]);
add("Master", "School of Chemical Engineering and Technology", ["Chemical Engineering and Technology", "Materials and Chemical Engineering"]);
add("Master", "School of Environmental Science and Engineering", ["Environmental Science and Engineering", "Land Resource Management"]);
add("Master", "School of Mechanical Engineering", ["Mechanical Engineering"]);
add("Master", "School of Electronic and Information Engineering", ["New Generation Electronic Information Technology"]);
add("Master", "School of Control Science and Engineering", ["Control Science and Engineering"]);
add("Master", "School of Computer Science and Technology", ["Computer Science and Technology"]);
add("Master", "School of Artificial Intelligence", ["Artificial Intelligence"]);
add("Master", "School of Life Sciences", ["Biomedical Engineering", "Electronic Information"]);
add("Master", "School of Humanities", ["Foreign Language and Literature", "MFA (Radio and Television)", "Drama, Film and Television"]);
add("Master", "School of Economics and Management", ["Applied Economics", "Business Administration"]);
add("Master", "School of Law", ["Science of Law", "Juris Master"]);
add("Master", "School of Art", ["Art and Design"]);

add("Doctoral", "Tiangong University", ["Textile Science and Engineering", "Materials Science and Engineering", "Mechanical Engineering", "Control Science and Engineering", "Electronic Information", "Mathematics"]);

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const tuitionFor = (item: ProgramSpec) => item.degree === "Bachelor"
  ? "Current bachelor tuition: CNY 25,000/year; registration fee CNY 500."
  : item.degree === "Master"
    ? "Current master tuition: CNY 30,000/year for normal fields or CNY 34,000/year for art and software engineering; registration fee CNY 500. No route-specific fee is inferred where the catalog does not map the field to a fee category."
    : "Current doctoral tuition: CNY 38,000/year; registration fee CNY 500.";
const programs: CatalogSeedProgram[] = specs.map((item, index) => ({
  slug: `tiangong-university-${slugify(item.name)}-${item.degree.toLowerCase()}-${String(index + 1).padStart(3, "0")}-current`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: item.name,
  degreeLevel: item.degree,
  ...(item.degree === "Master" ? { durationYears: 3 } : item.degree === "Doctoral" ? { durationYears: 4 } : {}),
  fieldCategory: item.faculty,
  subjectArea: item.name,
  ...(item.language ? { teachingLanguage: item.language } : {}),
  ...(item.degree === "Bachelor" && item.language === "Chinese" && item.name !== "Chinese Language" ? { hskRequirement: "HSK 3 or one of the current official equivalents." } : {}),
  ...(item.degree === "Bachelor" && item.language === "English" ? { englishRequirement: "Native English, IELTS 5.5, TOEFL computer-test performance of at least 60%, related proof or a passed interview." } : {}),
  ...(item.degree === "Bachelor" ? { cscaRequirement: "A current official CSCA notice is published, but exact route-level subjects are not inferred without the attached detail table." } : {}),
  tuitionText: tuitionFor(item),
  applicationUrl: majors.finalUrl ?? majors.url,
  applicationNote: "Listed in the current official international majors catalog. The catalog is not labeled as a complete 2027 admission cycle, so no intake year or deadline is inferred.",
  hasScholarship: true,
  scholarshipText: "The official site publishes 2026 scholarship information; current route-level eligibility is not inferred.",
  badgeText: "Current official catalog; 2027 cycle unresolved",
  displaySubjects: [item.name, item.faculty],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: majors.fetchedAt,
  ...sf(majors),
  sourceFieldLineage: {
    nameEn: "current official majors table",
    degreeLevel: "official catalog section",
    ...(item.degree === "Master" ? { durationYears: "current official graduate rules" } : item.degree === "Doctoral" ? { durationYears: "current official graduate rules" } : {}),
    fieldCategory: "current official school column",
    subjectArea: "current official major column",
    ...(item.language ? { teachingLanguage: "current official English-teaching marker; unmarked bachelor rows are Chinese" } : {}),
    tuitionText: "current official degree-level fee schedule without unsupported route-to-band inference",
    applicationUrl: "current official majors PDF",
    applicationNote: "current official catalog plus unresolved 2027 cycle",
    hasScholarship: "official 2026 scholarship publication",
    scholarshipText: "official scholarship existence with route-level scope limitation",
    badgeText: "official cycle limitation",
  },
}));

for (const months of [6, 12]) {
  programs.push({
    slug: `tiangong-university-chinese-language-general-scholar-${months === 6 ? "one-semester" : "one-academic-year"}-2026`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: `Chinese Language General Scholar — ${months === 6 ? "One Semester" : "One Academic Year"}`,
    degreeLevel: "Non-degree",
    durationMonths: months,
    fieldCategory: "Chinese Language",
    subjectArea: "Chinese Language",
    teachingLanguage: "Chinese",
    tuitionText: months === 12 ? "2026 tuition: CNY 16,000 per academic year; registration fee CNY 500." : "The 2026 guide publishes CNY 16,000 per academic year and permits one-semester study, but it does not state a one-semester amount; registration fee CNY 500.",
    applicationUrl: languageGuide.finalUrl ?? languageGuide.url,
    applicationNote: "The official 2026 guide permits one-semester or one-academic-year study for applicants aged 18-30 with high-school education or above. It publishes no application deadline, and the route is not relabeled as 2027.",
    hasScholarship: true,
    scholarshipText: "The guide prints a CNY 8,000/year scholarship tuition standard, but does not state a separate award amount, deadline or complete eligibility terms; no scholarship record is inferred.",
    badgeText: "Official 2026 language route; deadline not published",
    displaySubjects: ["Chinese Language"],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: languageGuide.fetchedAt,
    ...sf(languageGuide),
    sourceFieldLineage: {
      nameEn: "official 2026 language guide",
      degreeLevel: "official non-degree statement",
      durationMonths: "official one-semester or one-academic-year duration",
      fieldCategory: "official major",
      subjectArea: "official major",
      teachingLanguage: "official Chinese-language program",
      tuitionText: "official 2026 fee table with unresolved semester amount",
      applicationUrl: "official 2026 guide PDF",
      applicationNote: "official eligibility and duration without an inferred deadline",
      hasScholarship: "official scholarship tuition line",
      scholarshipText: "official ambiguous scholarship tuition wording preserved without an award record",
      badgeText: "official closed-cycle limitation",
    },
  });
}

const candidate: CatalogSeedBundle = { version: 1, generatedAt: notifications.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: notifications.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 133, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The current official notification index publishes 2026 materials and no complete applicant-facing general 2027 degree guide, route table, deadline or intake. No current route is relabeled as 2027.",
    "The majors catalog is current but not cycle-labeled. Its bachelor English-teaching markers are retained; graduate research directions and English markers are not expanded into separate programs where the degree-level mapping is ambiguous.",
    "The current CSCA notice confirms an official assessment attachment, but the attachment was not registered and hash-locked in this wave. Exact route-level subjects remain blank.",
    "The 2026 scholarship PDF is captured and hash-locked but is image-heavy. Award rows are not generated until its tables receive deterministic review; the language guide's CNY 8,000/year scholarship tuition wording is not misrepresented as an award amount.",
    "Application documents, personal contacts, HTTP-only application links and payment instructions are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions or private application materials are present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-174");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 174, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
