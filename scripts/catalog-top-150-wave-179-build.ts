import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type CatalogRow = { degree: "Master" | "Doctoral"; faculty: string; code: string; name: string; campus: string; degreeType: string };

const root = process.cwd();
const run = "2026-10-26T12-02-32-422Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["hqu-international-undergraduate-index-current", "eef41b9f260a8132f61153d3268d8a51227a23b63d0504ed76111a2d5784c11b"],
  ["hqu-international-graduate-index-current", "81c7ff18adbc5b090342a5b48e5ad6cb5ad36a4b8c588fcd629ba2f906a55ae9"],
  ["hqu-international-graduate-guide-2027", "928dc8e5e00c45568b8b66a967ce54622e46a8775af0514644a69bd65c1d2142"],
  ["hqu-international-graduate-catalog-2027", "16848a0ea47863845c3ab1bd4a15884436278ed6a681b3342d1fec0e44bd74af"],
  ["hqu-cgs-high-level-graduate-guide-2027", "df324def3e3079fa5481a80586ce4febea807c36dc112a0361c07c0af96dc41b"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked HQU source: ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`HQU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const graduateIndex = sources.get("hqu-international-graduate-index-current")!;
const guide = sources.get("hqu-international-graduate-guide-2027")!;
const catalog = sources.get("hqu-international-graduate-catalog-2027")!;
const scholarshipGuide = sources.get("hqu-cgs-high-level-graduate-guide-2027")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const xiamen = base.cities?.find((entry) => entry.slug === "xiamen");
if (!xiamen) throw new Error("Reviewed Xiamen dependency missing.");
if (base.cities?.some((entry) => entry.slug === "quanzhou")) throw new Error("Quanzhou city already exists in the reviewed base; remove the new city record.");
if (base.schools?.some((entry) => entry.slug === "huaqiao-university")) throw new Error("Huaqiao University already exists in the reviewed base.");

const quanzhou = {
  slug: "quanzhou",
  nameEn: "Quanzhou",
  nameZh: "泉州",
  province: "Fujian",
  region: "East China",
  tags: ["Fujian", "East China", "official-school-evidence"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official graduate guide campus address; standardized English city name",
    nameZh: "official graduate guide campus address",
    province: "official graduate guide campus address",
    region: "CUAC geographic taxonomy derived from the verified Fujian location",
    tags: "CUAC geographic classification and evidence-stage marker",
  },
};

const school = {
  slug: "huaqiao-university",
  nameEn: "Huaqiao University",
  nameZh: "华侨大学",
  citySlug: quanzhou.slug,
  schoolType: "Public comprehensive university",
  region: "Quanzhou and Xiamen, Fujian, East China",
  applicationLevel: "The official 2027 foreign international graduate guide and catalog publish 57 full-time master routes and 17 full-time doctoral routes across the Quanzhou and Xiamen campuses.",
  languageOfInstruction: "Graduate programs are principally taught in Chinese.",
  languageRequirement: "General 2027 graduate admission requires HSK 5 score 180 or above, with published Chinese-medium degree and Malaysian Chinese independent-school alternatives. The separate high-level graduate scholarship requires HSK 4 score 180 or above.",
  hskRequirement: "General admission: HSK 5 score 180 or above. Chinese Government Scholarship high-level graduate project: HSK 4 score 180 or above.",
  deadlineSummary: "General 2027 foreign graduate admission has two batches: October 15-December 6, 2026 and March 1-May 20, 2027. The high-level graduate scholarship second batch closes March 5, 2027.",
  tuitionSummary: "2027 annual tuition: full-time master CNY 19,000; full-time doctoral CNY 25,000. Accommodation is charged separately by room type; no amount is published in the guide.",
  websiteUrl: "https://www.hqu.edu.cn/",
  admissionsUrl: graduateIndex.finalUrl ?? graduateIndex.url,
  subjectTags: ["Humanities", "Economics", "Law", "Chinese Language", "Engineering", "Architecture", "Business", "Arts"],
  languageTags: ["Chinese"],
  tuitionBandLabel: "2027: CNY 19,000/year master; CNY 25,000/year doctoral",
  campusHighlights: ["74 explicit full-time graduate routes for Fall 2027", "Dual-campus study in Quanzhou and Xiamen", "Separate 2027 Chinese Government Scholarship high-level graduate project with 10 recommendation places"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipGuide.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official university and graduate guide identity",
    nameZh: "official guide title",
    citySlug: "official Quanzhou and Xiamen campus addresses; Quanzhou retained as the primary school city",
    schoolType: "official university identity plus CUAC taxonomy",
    region: "official campus addresses plus CUAC taxonomy",
    applicationLevel: "official 2027 foreign graduate guide and full-time catalog",
    languageOfInstruction: "official general language statement",
    languageRequirement: "official general guide and scholarship-specific threshold",
    hskRequirement: "official general guide and scholarship guide",
    deadlineSummary: "official general and scholarship application batches",
    tuitionSummary: "official 2027 tuition table and accommodation wording",
    websiteUrl: "official university domain",
    admissionsUrl: "current official overseas graduate admissions index",
    subjectTags: "official 2027 program catalog",
    languageTags: "official teaching-language statement",
    tuitionBandLabel: "official 2027 tuition table",
    campusHighlights: "official 2027 guide, catalog and scholarship guide",
  },
};

const decodeHtml = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/\s+/g, " ")
  .trim();

const html = await readFile(resolve(directory, catalog.artifactPath), "utf8");
const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
const spans = new Map<number, { value: string; remaining: number }>();
const expanded: string[][] = [];
for (const rowMatch of rows) {
  const values = Array.from({ length: 11 }, () => "");
  for (const [column, span] of [...spans]) {
    values[column] = span.value;
    span.remaining -= 1;
    if (span.remaining === 0) spans.delete(column);
  }
  let column = 0;
  for (const cellMatch of rowMatch[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
    while (column < values.length && values[column]) column += 1;
    const attributes = cellMatch[1];
    const value = decodeHtml(cellMatch[2]);
    const colspan = Number(attributes.match(/colspan=["']?(\d+)/i)?.[1] ?? 1);
    const rowspan = Number(attributes.match(/rowspan=["']?(\d+)/i)?.[1] ?? 1);
    for (let offset = 0; offset < colspan && column + offset < values.length; offset += 1) {
      values[column + offset] = value;
      if (rowspan > 1) spans.set(column + offset, { value, remaining: rowspan - 1 });
    }
    column += colspan;
  }
  expanded.push(values);
}

const catalogRows: CatalogRow[] = expanded.flatMap((cells) => {
  const degree = cells[2] === "Master" ? "Master" : cells[2] === "Ph.D" ? "Doctoral" : null;
  if (!degree || cells[9] !== "全日制" || !/^\d{6}|\d{4}[A-Z]\d$/i.test(cells[5])) return [];
  return [{ degree, faculty: cells[4], code: cells[5], name: cells[7], campus: cells[8], degreeType: cells[10] }];
});
const masters = catalogRows.filter((row) => row.degree === "Master");
const doctorals = catalogRows.filter((row) => row.degree === "Doctoral");
if (masters.length !== 57 || doctorals.length !== 17) throw new Error(`Expected 57 full-time master and 17 full-time doctoral routes; found ${masters.length} and ${doctorals.length}.`);

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = catalogRows.map((row, indexValue) => {
  const city = row.campus.includes("厦门") && !row.campus.startsWith("泉州/") ? xiamen : quanzhou;
  const tuitionAmount = row.degree === "Master" ? 19000 : 25000;
  return {
    slug: `huaqiao-university-${row.code.toLowerCase()}-${slugify(row.name)}-${slugify(row.faculty)}-${String(indexValue + 1).padStart(3, "0")}-2027`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: row.name,
    degreeLevel: row.degree,
    durationYears: row.degree === "Master" ? 3 : 4,
    fieldCategory: row.faculty,
    subjectArea: `${row.name} (${row.code}; ${row.degreeType === "专业学位" ? "professional degree" : "academic degree"})`,
    teachingLanguage: "Chinese",
    hskRequirement: "General 2027 admission requires HSK 5 score 180 or above, subject to the published alternatives and any approved pilot-specific rule.",
    tuitionText: `2027 full-time ${row.degree.toLowerCase()} tuition: CNY ${tuitionAmount.toLocaleString("en-US")}/year. Accommodation is charged separately by room type; the guide publishes no amount.`,
    applicationUrl: guide.finalUrl ?? guide.url,
    applicationNote: `Explicit full-time Fall 2027 route at the ${row.campus} campus/campuses. General applications have two batches and the final published cutoff is May 20, 2027; each applicant may choose only one major.`,
    hasScholarship: true,
    scholarshipText: "The official 2027 guide names multiple scholarship channels. The separate Chinese Government Scholarship high-level graduate project has 10 recommendation places and a March 5, 2027 second-batch cutoff.",
    badgeText: "Open Fall 2027 official full-time route",
    displaySubjects: [row.name, row.faculty, row.degreeType === "专业学位" ? "Professional degree" : "Academic degree", row.campus],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: catalog.fetchedAt,
    ...sf(catalog),
    sourceFieldLineage: {
      nameEn: "official English PROGRAMMES column",
      degreeLevel: "official DEGREE column",
      durationYears: "official 2027 general guide",
      fieldCategory: "official FACULTY column",
      subjectArea: "official program code, name and degree-type columns",
      teachingLanguage: "official principally-Chinese general rule",
      hskRequirement: "official general 2027 language rule",
      tuitionText: "official 2027 tuition table",
      applicationUrl: "official 2027 foreign graduate guide",
      applicationNote: "official campus, full-time category, batches and one-major rule",
      hasScholarship: "official 2027 general and scholarship guides",
      scholarshipText: "official high-level graduate scholarship scope, quota and deadline",
      badgeText: "official explicit 2027 full-time catalog and open final application window",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-05-20T15:59:59.000Z",
  deadlineLabel: "General admission batches: October 15-December 6, 2026 and March 1-May 20, 2027. The final general cutoff is May 20, 2027.",
  applicationRound: "2027 foreign international full-time graduate admission",
  status: "open" as const,
  ...sf(guide),
  sourceFieldLineage: { intakeTerm: "official September/Fall 2027 entry context", intakeYear: "official guide and catalog titles", deadlineDate: "official second-batch final date", deadlineLabel: "official two-batch schedule", applicationRound: "official foreign graduate guide scope" },
}));

const scholarship = {
  schoolSlug: school.slug,
  slug: "huaqiao-university-cgs-high-level-graduate-2027",
  title: "Chinese Government Scholarship High-Level Graduate Program - Huaqiao University 2027",
  nameZh: "华侨大学2027年中国政府奖学金高水平研究生项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship Type B",
  providerName: "China Scholarship Council / Huaqiao University",
  providerNameEn: "Huaqiao University",
  providerLocation: "Quanzhou and Xiamen, Fujian, China",
  fundingLevel: "Scholarship coverage not itemized in the captured university guide",
  coverage: "The official university guide confirms a Chinese Government Scholarship project but does not itemize tuition, accommodation, stipend, insurance or monetary coverage.",
  applicableDegree: "Full-time Master and Doctoral",
  applicableProgram: "Full-time master and doctoral routes in the official 2027 catalog, subject to selection and scholarship eligibility.",
  amountText: "No monetary amount or itemized benefit value is published in the captured university guide.",
  requirementText: "Master applicants must hold a bachelor degree or equivalent and be no older than 35; doctoral applicants must hold a master degree or equivalent and be no older than 40. HSK 4 score 180 or above, with the published Chinese-medium degree exemption.",
  benefitItems: [],
  eligibilityItems: [{ label: "Recommendation quota", value: "10" }, { label: "Master age", value: "35 or younger" }, { label: "Doctoral age", value: "40 or younger" }, { label: "Chinese", value: "HSK 4 score 180 or above, with the published exemption" }],
  applicationMaterials: [],
  applicationSteps: [],
  actionLinks: [{ label: "Official scholarship guide", url: scholarshipGuide.finalUrl ?? scholarshipGuide.url, kind: "official-source" }],
  deadlineDate: "2027-03-05",
  deadlineLabel: "The scholarship-specific second batch closes March 5, 2027; the first batch closed December 6, 2026.",
  applicationRound: "Fall 2027 Chinese Government Scholarship high-level graduate project",
  summary: "Explicit Fall 2027 full-time graduate scholarship project with 10 university recommendation places; the captured guide does not itemize benefit coverage.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipGuide.fetchedAt,
  ...sf(scholarshipGuide),
  sourceFieldLineage: {
    title: "official scholarship guide title",
    coverage: "official guide omission explicitly retained",
    applicableDegree: "official project scope",
    applicableProgram: "official linked 2027 catalog and full-time scope",
    amountText: "official guide omission explicitly retained",
    requirementText: "official degree, age and HSK requirements",
    benefitItems: "empty because the captured guide does not itemize coverage",
    eligibilityItems: "official quota, age and HSK requirements",
    applicationMaterials: "intentionally excluded",
    applicationSteps: "intentionally excluded",
    deadlineDate: "official scholarship-specific second-batch cutoff",
    deadlineLabel: "official first and second application batches",
    applicationRound: "official Fall 2027 project scope",
    summary: "official project scope, quota and source limitation",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: scholarshipGuide.fetchedAt, cities: [xiamen, quanzhou], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: scholarshipGuide.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 139, schoolSlugs: [school.slug], newSchools: 1, newCities: 1, preservedCities: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1 },
  evidence,
  unresolved: [
    "The current undergraduate index still exposes a 2026 guide; no 2027 international undergraduate route is inferred or included in this wave.",
    "The official 2027 catalog also contains 13 non-full-time master rows and one non-full-time doctoral row. They are excluded because the foreign international graduate guide explicitly defines the admission category as full-time study on campus.",
    "The general guide requires HSK 5 score 180, while the scholarship-specific guide requires HSK 4 score 180. The lower threshold is stored only on the scholarship record and does not overwrite route-level general admission requirements.",
    "The scholarship guide confirms the project and selection rules but does not itemize benefit coverage or monetary amounts; those fields remain explicitly unresolved instead of importing generic CSC assumptions.",
    "Published office and overseas-representative contact details are excluded because they are not necessary catalog facts.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal recommendation details, personal contacts, payment instructions or private materials are present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-179");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 179, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
