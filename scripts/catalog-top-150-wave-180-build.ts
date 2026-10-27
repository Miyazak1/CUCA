import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral";

const root = process.cwd();
const run = "2026-10-26T12-24-09-612Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["sdust-international-home-current", "056fdb85f2e63e2f54862de24e78411a0f1b9e2c98795d59110f502311742070"],
  ["sdust-international-admissions-faq-current", "b927b902d37a4517611188ab100fdf06671c1045831dcb3360dc40b604fb2d85"],
  ["sdust-international-undergraduate-catalog-2021", "2956f109cb5bcd1f5ff40ddca828ddb6b6b3ddd2fb0c0ffd0d77be122c67f955"],
  ["sdust-international-master-catalog-2021", "65b2d491e37422a0c0d618d056928c46f34b3155c45e0c03f128adc2540240f8"],
  ["sdust-international-doctoral-catalog-2021", "b9723444b7acc6eadf482fbcd24840d35f508965951cf04d88cf939a5f5cc175"],
  ["sdust-chinese-language-program-current", "581f37ddba7fb74fe2e611a168f47204b49a6891adbc4e85884b6847c0a35458"],
  ["sdust-english-preparatory-program-current", "1366bd93072a53da0d7a2325dda3250285274aca3cca44d90f2a225d179e851d"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked SDUST source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== expectedSha256) throw new Error(`SDUST evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const home = sources.get("sdust-international-home-current")!;
const faq = sources.get("sdust-international-admissions-faq-current")!;
const undergraduate = sources.get("sdust-international-undergraduate-catalog-2021")!;
const master = sources.get("sdust-international-master-catalog-2021")!;
const doctoral = sources.get("sdust-international-doctoral-catalog-2021")!;
const language = sources.get("sdust-chinese-language-program-current")!;
const preparatory = sources.get("sdust-english-preparatory-program-current")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "qingdao");
if (!city) throw new Error("Reviewed Qingdao dependency missing.");
if (base.schools?.some((entry) => entry.slug === "shandong-university-of-science-and-technology")) throw new Error("SDUST already exists in the reviewed base.");

const decode = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
const rows = async (source: Source) => {
  const html = await readFile(resolve(directory, source.artifactPath), "utf8");
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decode(cell[1]))).filter((cells) => cells.length > 0);
};
const englishName = (value: string) => value.replace(/[\u3400-\u9fff★☆▲、，：（）]/g, " ").replace(/\s+/g, " ").trim();
const degreeSpecs = async (source: Source, degree: Degree, expected: number) => {
  const parsed = (await rows(source)).slice(1).flatMap((cells) => {
    const numbered = cells.findIndex((cell) => /^\d+$/.test(cell));
    if (numbered < 0) return [];
    const degreeCell = degree === "Master" ? cells.findIndex((cell) => cell === "硕士") : degree === "Doctoral" ? cells.findIndex((cell) => cell === "博士") : -1;
    const marker = degree === "Bachelor" ? cells.at(-1)! : degreeCell > 0 ? cells[degreeCell - 1] : "";
    const name = englishName(marker);
    return /[A-Za-z]/.test(name) ? [{ name, degree, source }] : [];
  });
  if (parsed.length !== expected) throw new Error(`Expected ${expected} ${degree} SDUST rows; found ${parsed.length}.`);
  return parsed;
};
const specs = [
  ...(await degreeSpecs(undergraduate, "Bachelor", 73)),
  ...(await degreeSpecs(master, "Master", 110)),
  ...(await degreeSpecs(doctoral, "Doctoral", 34)),
];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = specs.map((item, index) => ({
  slug: `shandong-university-of-science-and-technology-${item.degree.toLowerCase()}-${slugify(item.name)}-${String(index + 1).padStart(3, "0")}-2021`,
  schoolSlug: "shandong-university-of-science-and-technology",
  citySlug: city.slug,
  nameEn: item.name,
  degreeLevel: item.degree,
  fieldCategory: `${item.degree} programs`,
  subjectArea: item.name,
  applicationUrl: faq.finalUrl ?? faq.url,
  applicationNote: "Published in the official 2021 international program catalog. No current 2027 international intake, deadline, tuition, or route availability is inferred.",
  badgeText: "Historical 2021 official catalog; 2027 status unresolved",
  displaySubjects: [item.name],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: item.source.fetchedAt,
  ...sf(item.source),
  sourceFieldLineage: { nameEn: "official bilingual 2021 catalog row", degreeLevel: "official catalog grouping", fieldCategory: "official degree grouping", subjectArea: "official catalog row", applicationUrl: "current official admissions FAQ", applicationNote: "source year and absence of a newer public international guide", badgeText: "source year and unresolved current status" },
}));

programs.push({
  slug: "shandong-university-of-science-and-technology-chinese-language-study-current",
  schoolSlug: "shandong-university-of-science-and-technology", citySlug: city.slug, nameEn: "Chinese Language Study", degreeLevel: "Non-degree", durationYears: 1,
  fieldCategory: "Chinese Language", subjectArea: "Elementary, intermediate, or advanced Chinese language study", teachingLanguage: "Chinese",
  applicationUrl: language.finalUrl ?? language.url, applicationNote: "The current official page describes one academic year split across spring and autumn semesters and permits study for at least one semester; no application deadline or current tuition is published.",
  badgeText: "Current official program; intake dates unresolved", displaySubjects: ["Chinese Language", "HSK Preparation"], status: "active", verificationStatus: "verified", lastVerifiedAt: language.fetchedAt, ...sf(language),
  sourceFieldLineage: { nameEn: "official program title translated to English", degreeLevel: "official non-degree study scope", durationYears: "official one-year structure", fieldCategory: "official program scope", subjectArea: "official course levels", teachingLanguage: "official Chinese-language curriculum", applicationUrl: "current official program page", applicationNote: "official duration and omitted deadline/tuition", badgeText: "current page without a dated intake" },
});
programs.push({
  slug: "shandong-university-of-science-and-technology-english-taught-stem-preparatory-current",
  schoolSlug: "shandong-university-of-science-and-technology", citySlug: city.slug, nameEn: "English-taught STEM Preparatory Program", degreeLevel: "Non-degree", durationMonths: 4,
  fieldCategory: "Preparatory", subjectArea: "Mathematics, Physics, and Chemistry", teachingLanguage: "English", tuitionText: "CNY 9,000 for the 16-week program.",
  applicationUrl: preparatory.finalUrl ?? preparatory.url, applicationNote: "The current official page publishes eligibility, a 16-week curriculum, and tuition, but no intake year or application deadline.",
  badgeText: "Current official program; intake dates unresolved", displaySubjects: ["Mathematics", "Physics", "Chemistry"], status: "active", verificationStatus: "verified", lastVerifiedAt: preparatory.fetchedAt, ...sf(preparatory),
  sourceFieldLineage: { nameEn: "official program title translated to English", degreeLevel: "official preparatory scope", durationMonths: "official 16-week duration normalized to four months", fieldCategory: "official program type", subjectArea: "official curriculum", teachingLanguage: "official English-taught description", tuitionText: "official published fee", applicationUrl: "current official program page", applicationNote: "official current page with missing cycle/deadline", badgeText: "current page without a dated intake" },
});

const historical = programs.slice(0, specs.length);
const programIntakes = historical.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2021, deadlineLabel: "Historical 2021 catalog entry; no deadline is published and no 2027 availability is inferred.", applicationRound: "Historical 2021 international program catalog", status: "closed" as const,
  ...sf(program.degreeLevel === "Bachelor" ? undergraduate : program.degreeLevel === "Master" ? master : doctoral),
  sourceFieldLineage: { intakeTerm: "catalog year context", intakeYear: "official page label", deadlineLabel: "explicit unresolved deadline and current status", applicationRound: "official catalog year" },
}));

const school = {
  slug: "shandong-university-of-science-and-technology", nameEn: "Shandong University of Science and Technology", nameZh: "山东科技大学", citySlug: city.slug,
  schoolType: "Public science and engineering university", region: "Qingdao, Shandong, East China",
  applicationLevel: "The current international college site publishes application requirements for bachelor, graduate, and Chinese-language applicants. Its degree catalogs remain labeled 2021; no 2027 international degree guide is publicly available in the captured official sources.",
  languageRequirement: "The current FAQ states HSK 4 for Chinese-taught science, engineering, economics, law, management and education bachelor study; HSK 5 for Chinese and philosophy bachelor study; and HSK 6 for Chinese-taught graduate study. English-taught routes require IELTS 6.0 or TOEFL 80 for bachelor study, and IELTS 6.5 or TOEFL 90 for graduate study.",
  hskRequirement: "Current FAQ: HSK 4 or HSK 5 by Chinese-taught bachelor field; HSK 6 for Chinese-taught graduate study.",
  englishRequirement: "Current FAQ: IELTS 6.0 or TOEFL 80 for English-taught bachelor study; IELTS 6.5 or TOEFL 90 for English-taught graduate study.",
  deadlineSummary: "No current international admission deadline is published in the captured official sources.", tuitionSummary: "Only the current 16-week English-taught preparatory program publishes tuition: CNY 9,000. Degree-program tuition is unresolved.", applicationFee: "CNY 600 or USD 95, nonrefundable, according to the current official FAQ.",
  websiteUrl: "https://www.sdust.edu.cn/", admissionsUrl: home.finalUrl ?? home.url,
  subjectTags: ["Engineering", "Mining", "Geoscience", "Computer Science", "Business", "Chinese Language", "Preparatory"], languageTags: ["Chinese", "English"],
  campusHighlights: ["73 bachelor, 110 master, and 35 doctoral entries retained from the official 2021 international catalogs", "Current Chinese-language and 16-week STEM preparatory pages remain public", "No 2027 international degree guide found; current availability left unresolved"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: home.fetchedAt, ...sf(faq),
  sourceFieldLineage: { nameEn: "official international college identity", nameZh: "official Chinese international college site", citySlug: "official Qingdao address plus reviewed city dependency", schoolType: "official university identity plus CUAC taxonomy", region: "official address plus CUAC taxonomy", applicationLevel: "current FAQ and labeled 2021 catalogs", languageRequirement: "current official FAQ", hskRequirement: "current official FAQ", englishRequirement: "current official FAQ", deadlineSummary: "absence in captured current pages", tuitionSummary: "current preparatory page and unresolved degree fees", applicationFee: "current official FAQ", websiteUrl: "official university domain", admissionsUrl: "current official international college home", subjectTags: "official catalogs and current program pages", languageTags: "current official FAQ and program pages", campusHighlights: "captured official evidence inventory" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: home.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = { version: 1, status: "unreviewed_draft", generatedAt: home.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 140, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 }, evidence, unresolved: ["No current 2027 international degree admission guide was found. The 2021 degree catalogs are retained as historical closed records and are not relabeled as 2027.", "Current degree tuition, deadlines, route availability, CSCA rules, and scholarship details are not published in the captured sources and remain absent.", "The current Chinese-language and preparatory pages publish no intake year or deadline, so no program intake record is inferred.", "Personal contacts, bank-account details, applicant files, and payment instructions are excluded."], sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions, or private application materials are present." } };
const stem = resolve(root, "seeds/catalog.2027-wave-180");
await Promise.all([writeFile(`${stem}.draft.json`, candidateText, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 180, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
