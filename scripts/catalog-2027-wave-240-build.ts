import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Major = { name: string; award: string; category: string; sourceId: string; english?: boolean };

const root = process.cwd();
const pageRunRoot = resolve(root, "work/catalog-official/2026-10-27T07-15-20-998Z");
const imageRunRoot = resolve(root, "work/catalog-official/dlmu-program-images-2026-10-27-v2");
const basePath = resolve(root, "seeds/catalog.2027-wave-161.draft.json");
const baseText = await readFile(basePath, "utf8");
const base = JSON.parse(baseText) as CatalogSeedBundle;
if (base.schools?.length !== 1 || base.schools[0].slug !== "dalian-maritime-university" || base.scholarships?.length !== 1) throw new Error("Unexpected DMU wave 161 dependency.");

const sourceLocations = new Map<string, { source: Source; runRoot: string }>();
for (const runRoot of [pageRunRoot, imageRunRoot]) {
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const source of manifest.sources) sourceLocations.set(source.id, { source, runRoot });
}
const requiredIds = [
  "dlmu-international-admission-index-current",
  "dlmu-international-master-chinese-current",
  "dlmu-international-master-english-current",
  "dlmu-international-doctoral-chinese-current",
  "dlmu-international-doctoral-english-current",
  ...Array.from({ length: 7 }, (_, index) => `dlmu-international-master-program-table-image-${String(index + 1).padStart(2, "0")}-current`),
  ...Array.from({ length: 5 }, (_, index) => `dlmu-international-doctoral-program-table-image-${String(index + 1).padStart(2, "0")}-current`),
];
for (const id of requiredIds) {
  const located = sourceLocations.get(id);
  if (!located || located.source.status !== 200) throw new Error(`Missing DMU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(located.runRoot, located.source.artifactPath))).digest("hex");
  if (actual !== located.source.sha256) throw new Error(`DMU evidence hash mismatch: ${id}`);
}

const masterMajors: Major[] = [
  { name: "Traffic Information Engineering and Control", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-master-program-table-image-01-current", english: true },
  { name: "Transportation Safety and Environment", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-master-program-table-image-01-current" },
  { name: "History of Science and Technology", award: "Science", category: "Science and Technology Studies", sourceId: "dlmu-international-master-program-table-image-01-current" },
  { name: "Remote Sensing Science and Technology", award: "Engineering", category: "Remote Sensing", sourceId: "dlmu-international-master-program-table-image-01-current" },
  { name: "Marine Engineering", award: "Engineering", category: "Marine Engineering", sourceId: "dlmu-international-master-program-table-image-02-current", english: true },
  { name: "Electrical Engineering", award: "Engineering", category: "Electrical Engineering", sourceId: "dlmu-international-master-program-table-image-02-current", english: true },
  { name: "Control Science and Engineering", award: "Engineering", category: "Control Engineering", sourceId: "dlmu-international-master-program-table-image-02-current", english: true },
  { name: "Information and Communication Engineering", award: "Engineering", category: "Information Engineering", sourceId: "dlmu-international-master-program-table-image-02-current", english: true },
  { name: "Computer Science and Technology", award: "Engineering", category: "Computer Science", sourceId: "dlmu-international-master-program-table-image-02-current", english: true },
  { name: "Materials Science and Engineering", award: "Engineering", category: "Materials Science", sourceId: "dlmu-international-master-program-table-image-02-current" },
  { name: "Civil Engineering", award: "Engineering", category: "Civil Engineering", sourceId: "dlmu-international-master-program-table-image-02-current" },
  { name: "Highway and Railway Engineering", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-master-program-table-image-03-current" },
  { name: "Transportation Planning and Management", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-master-program-table-image-03-current" },
  { name: "Vehicle Operation Engineering", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-master-program-table-image-03-current" },
  { name: "Logistic Engineering and Management", award: "Engineering", category: "Logistics", sourceId: "dlmu-international-master-program-table-image-03-current", english: true },
  { name: "Low-Altitude Technology and Engineering", award: "Engineering", category: "Low-Altitude Technology", sourceId: "dlmu-international-master-program-table-image-03-current" },
  { name: "Applied Economics", award: "Economics", category: "Economics", sourceId: "dlmu-international-master-program-table-image-03-current" },
  { name: "Management Science and Engineering", award: "Engineering", category: "Management Science", sourceId: "dlmu-international-master-program-table-image-03-current" },
  { name: "Business Administration", award: "Management", category: "Business", sourceId: "dlmu-international-master-program-table-image-04-current", english: true },
  { name: "Mechanical Engineering", award: "Engineering", category: "Mechanical Engineering", sourceId: "dlmu-international-master-program-table-image-04-current" },
  { name: "Design and Construction of Naval Architecture and Ocean Structure", award: "Engineering", category: "Naval Architecture", sourceId: "dlmu-international-master-program-table-image-04-current" },
  { name: "Rescue and Salvage Engineering", award: "Engineering", category: "Marine Engineering", sourceId: "dlmu-international-master-program-table-image-04-current" },
  { name: "Marine Power Machinery and Refrigeration Engineering", award: "Engineering", category: "Marine Engineering", sourceId: "dlmu-international-master-program-table-image-04-current" },
  { name: "Biology", award: "Science", category: "Biology", sourceId: "dlmu-international-master-program-table-image-04-current" },
  { name: "Environmental Science and Engineering", award: "Engineering", category: "Environmental Science", sourceId: "dlmu-international-master-program-table-image-04-current", english: true },
  { name: "Artificial Intelligence", award: "Engineering", category: "Artificial Intelligence", sourceId: "dlmu-international-master-program-table-image-04-current", english: true },
  { name: "Intelligence Science and Technology", award: "Engineering", category: "Artificial Intelligence", sourceId: "dlmu-international-master-program-table-image-04-current", english: true },
  { name: "Law", award: "Law", category: "Law", sourceId: "dlmu-international-master-program-table-image-05-current", english: true },
  { name: "English Language and Literature", award: "Literature", category: "Languages", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Russian Language and Literature", award: "Literature", category: "Languages", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Japanese Language and Literature", award: "Literature", category: "Languages", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Foreign Linguistics and Applied Linguistics", award: "Literature", category: "Languages", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Philosophy", award: "Philosophy", category: "Philosophy", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Science of National Security", award: "Law", category: "National Security", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Public Administration", award: "Management", category: "Public Administration", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Theory of Marxism", award: "Law", category: "Marxism", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Mathematics", award: "Science", category: "Mathematics", sourceId: "dlmu-international-master-program-table-image-05-current" },
  { name: "Physics", award: "Science", category: "Physics", sourceId: "dlmu-international-master-program-table-image-05-current" },
];
const doctoralMajors: Major[] = [
  { name: "Traffic Information Engineering and Control", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-doctoral-program-table-image-01-current", english: true },
  { name: "Traffic Safety and Environment", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-doctoral-program-table-image-01-current" },
  { name: "Marine Engineering", award: "Engineering", category: "Marine Engineering", sourceId: "dlmu-international-doctoral-program-table-image-01-current", english: true },
  { name: "Marine Electrical Engineering", award: "Engineering", category: "Electrical Engineering", sourceId: "dlmu-international-doctoral-program-table-image-02-current", english: true },
  { name: "Control Science and Engineering", award: "Engineering", category: "Control Engineering", sourceId: "dlmu-international-doctoral-program-table-image-02-current", english: true },
  { name: "Information and Communication Engineering", award: "Engineering", category: "Information Engineering", sourceId: "dlmu-international-doctoral-program-table-image-02-current", english: true },
  { name: "Computer Science and Technology", award: "Engineering", category: "Computer Science", sourceId: "dlmu-international-doctoral-program-table-image-02-current", english: true },
  { name: "Highway and Railway Engineering", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-doctoral-program-table-image-02-current" },
  { name: "Transportation Planning and Management", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-doctoral-program-table-image-02-current" },
  { name: "Vehicle Operation Engineering", award: "Engineering", category: "Transportation", sourceId: "dlmu-international-doctoral-program-table-image-02-current" },
  { name: "Logistic Engineering and Management", award: "Engineering", category: "Logistics", sourceId: "dlmu-international-doctoral-program-table-image-02-current", english: true },
  { name: "Management Science and Engineering", award: "Management", category: "Management Science", sourceId: "dlmu-international-doctoral-program-table-image-02-current" },
  { name: "Comprehensive Transportation Science and Engineering", award: "Management", category: "Transportation", sourceId: "dlmu-international-doctoral-program-table-image-03-current" },
  { name: "Design and Construction of Naval Architecture and Ocean Structure", award: "Engineering", category: "Naval Architecture", sourceId: "dlmu-international-doctoral-program-table-image-03-current" },
  { name: "Rescue and Salvage Engineering", award: "Engineering", category: "Marine Engineering", sourceId: "dlmu-international-doctoral-program-table-image-03-current" },
  { name: "Environmental Science and Engineering", award: "Engineering", category: "Environmental Science", sourceId: "dlmu-international-doctoral-program-table-image-03-current", english: true },
  { name: "Artificial Intelligence", award: "Engineering", category: "Artificial Intelligence", sourceId: "dlmu-international-doctoral-program-table-image-03-current", english: true },
  { name: "Law", award: "Law", category: "Law", sourceId: "dlmu-international-doctoral-program-table-image-03-current", english: true },
  { name: "Science of National Security", award: "Law", category: "National Security", sourceId: "dlmu-international-doctoral-program-table-image-03-current" },
  { name: "Theory of Marxism", award: "Law", category: "Marxism", sourceId: "dlmu-international-doctoral-program-table-image-03-current" },
];

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const humanitiesAwards = new Set(["Philosophy", "Law", "Literature", "Economics", "Management"]);
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const sourceFor = (id: string) => sourceLocations.get(id)!.source;
const routesFor = (major: Major, level: "Master" | "Doctoral", year: 2026 | 2027) => {
  const languages = major.english ? ["Chinese", "English"] as const : ["Chinese"] as const;
  return languages.map((language) => {
    const source = sourceFor(major.sourceId);
    const humanities = humanitiesAwards.has(major.award);
    const tuitionAmount = level === "Master"
      ? (humanities ? (language === "English" ? 28000 : 24000) : (language === "English" ? 30000 : 26000))
      : (humanities ? (language === "English" ? 36000 : 32000) : (language === "English" ? 38000 : 34000));
    const durationYears = level === "Master" ? (language === "English" ? 2 : 3) : 4;
    const slug = `official-${year}-dlmu-${level.toLowerCase()}-${slugify(major.name)}-${language.toLowerCase()}`;
    return {
      slug,
      schoolSlug: "dalian-maritime-university",
      citySlug: "dalian",
      nameEn: major.name,
      nameZh: major.name,
      degreeLevel: level,
      durationYears,
      fieldCategory: major.category,
      subjectArea: major.name,
      teachingLanguage: language,
      hskRequirement: language === "Chinese" ? "HSK Level 5 or above, or the university-organized Mandarin test described by DMU." : "No HSK threshold is published for this English-taught route.",
      englishRequirement: language === "English" ? (level === "Doctoral" ? "TOEFL 90, IELTS 6.0, an English-medium certificate, or the university English test; applicants from countries where English is an official language are exempt." : "Recognized English proof, an English-medium prior-study certificate, or the university English test; applicants from countries where English is an official language are exempt.") : "Not applicable to the Chinese-taught route.",
      tuitionAmount,
      tuitionCurrency: "CNY",
      tuitionPeriod: "year",
      tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
      displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
      applicationUrl: "https://dlmu.17gz.org",
      applicationNote: year === 2027 ? "Official 2027 master brochure; general degree-program deadline is June 30, 2027. Application fee: CNY 600, non-refundable." : "Official 2026 doctoral brochure retained as a closed historical reference; it is not relabeled as a 2027 route. Application fee: CNY 600, non-refundable.",
      hasScholarship: false,
      badgeText: `Official ${year} ${level.toLowerCase()} route`,
      displayGroup: level,
      displayGroupLabel: `${language}-taught ${level.toLowerCase()} programs`,
      status: "draft" as const,
      verificationStatus: "unverified" as const,
      lastVerifiedAt: source.fetchedAt,
      ...sourceFields(source),
      sourceFieldLineage: {
        nameEn: "official admission-major table image",
        degreeLevel: "official brochure title and admission-major table",
        durationYears: "official admission-major table and language note",
        teachingLanguage: major.english ? "starred-major language note" : "non-starred-major language note",
        tuitionAmount: "official fee table by discipline and teaching language",
        applicationNote: "official application procedure, deadline and fee sections",
        hskRequirement: "official application-materials section",
        englishRequirement: "official application-materials section",
      },
    };
  });
};

const programs = [
  ...masterMajors.flatMap((major) => routesFor(major, "Master", 2027)),
  ...doctoralMajors.flatMap((major) => routesFor(major, "Doctoral", 2026)),
];
if (programs.length !== 80 || new Set(programs.map((program) => program.slug)).size !== programs.length) throw new Error(`Unexpected DMU program count: ${programs.length}`);
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: program.degreeLevel === "Master" ? 2027 : 2026,
  deadlineDate: program.degreeLevel === "Master" ? "2027-06-30T00:00:00Z" : "2026-06-30T00:00:00Z",
  deadlineLabel: program.degreeLevel === "Master" ? "General degree-program deadline: June 30, 2027." : "Closed historical cycle: June 30, 2026.",
  applicationRound: program.degreeLevel === "Master" ? "DMU 2027 international master admissions" : "DMU 2026 international doctoral admissions",
  status: program.degreeLevel === "Master" ? "open" as const : "closed" as const,
  sourceUrl: program.sourceUrl,
  sourceLabel: program.sourceLabel,
  sourceSha256: program.sourceSha256,
  capturedAt: program.capturedAt,
  sourceFieldLineage: { deadlineDate: "brochure cycle plus general June 30 deadline; normalized to ISO UTC", deadlineLabel: "official application-materials notes" },
}));

const latestSource = sourceFor("dlmu-international-master-program-table-image-01-current");
const school = {
  ...base.schools[0],
  applicationLevel: "The official international portal publishes bachelor, master, doctoral and non-degree routes. The current master brochure is explicitly for 2027; the current doctoral brochure remains the closed 2026 edition.",
  languageOfInstruction: "The 2027 master table marks twelve majors as available in both Chinese and English; the remaining listed master majors are Chinese-taught. The 2026 doctoral table marks ten majors as available in English as well as Chinese.",
  deadlineSummary: "The official 2027 master brochure states a general June 30 deadline. The current doctoral brochure remains the closed 2026 cycle and is not represented as 2027.",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: latestSource.fetchedAt,
  ...sourceFields(latestSource),
  sourceFieldLineage: {
    ...(base.schools[0].sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 master brochure and current 2026 doctoral brochure",
    languageOfInstruction: "official admission-major tables and starred-major language notes",
    deadlineSummary: "official application-materials notes and brochure cycle headings",
  },
};
const city = { ...base.cities![0], status: "draft" as const, verificationStatus: "unverified" as const };
const scholarships = base.scholarships!.map((row) => ({ ...row, status: "draft" as const, verificationStatus: "unverified" as const }));
const candidate: CatalogSeedBundle = { version: 1, generatedAt: latestSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = requiredIds.map((id) => { const source = sourceFor(id); return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: latestSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 113, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  dependencies: [{ path: "seeds/catalog.2027-wave-161.draft.json", sha256: createHash("sha256").update(baseText).digest("hex") }],
  freshness: {
    result: "2027_master_brochure_discovered_in_official_page_images",
    note: "The current DMU master pages embed a seven-page official 2027 brochure as images. The current doctoral pages embed a five-page 2026 brochure; doctoral rows remain historical and are not relabeled as 2027.",
  },
  unresolved: [
    "The current official bachelor page was not part of this batch, so no bachelor program inventory is added here.",
    "The current doctoral brochure is still labeled 2026; no 2027 doctoral intake is inferred.",
    "The 2027 Chinese Government Scholarship Type B attachment remains CAPTCHA-protected; coverage, deadline and detailed conditions stay unresolved.",
    "The master admission table visually places Transportation Planning and Management next to Vehicle Operation Engineering; the candidate preserves them as separate majors and flags the table layout for editorial review.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant records, personal documents or private contact details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-240");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 240, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
