import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const undergraduateManifestPath = resolve(root, "work/catalog-official/sdufe-complete-20261016/manifest.json");
const postgraduateManifestPath = resolve(root, "work/catalog-official/2026-10-16T06-18-37-304Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.sdufe-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sdufe-complete-batch-01.validation.json");
const [undergraduateManifestText, postgraduateManifestText] = await Promise.all([
  readFile(undergraduateManifestPath, "utf8"),
  readFile(postgraduateManifestPath, "utf8"),
]);
type Manifest = { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const undergraduateManifest = JSON.parse(undergraduateManifestText) as Manifest;
const postgraduateManifest = JSON.parse(postgraduateManifestText) as Manifest;
const undergraduateSource = undergraduateManifest.sources.find((row) => row.id === "sdufe-international-undergraduate-admissions-2026");
const postgraduateSource = postgraduateManifest.sources.find((row) => row.id === "sdufe-international-postgraduate-admissions-2026");
if (!undergraduateSource || undergraduateSource.status !== 200 || undergraduateSource.sha256 !== "b2b611a79aed9fb34c05c9eba0a0807e7192165c17b6a96a76e5a72a837edd60") {
  throw new Error("SDUFE undergraduate official evidence mismatch.");
}
if (!postgraduateSource || postgraduateSource.status !== 200 || postgraduateSource.sha256 !== "c683f112acb15072b51a5a080b24fcfa2e970d1e29e6341892eeb3f090ed79a6") {
  throw new Error("SDUFE postgraduate official evidence mismatch.");
}

const schoolSlug = "shandong-university-of-finance-and-economics";
const citySlug = "jinan";
const applicationUrl = "https://istu.sdufe.edu.cn";
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const evidenceFor = (source: Manifest["sources"][number]) => ({ sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

type ProgramSpec = {
  degreeLevel: "Undergraduate" | "Master";
  nameEn: string;
  nameZh?: string;
  fieldCategory: string;
};
const undergraduateSpecs: ProgramSpec[] = [
  { degreeLevel: "Undergraduate", nameEn: "International Economics and Trade", fieldCategory: "Economics" },
  { degreeLevel: "Undergraduate", nameEn: "Cross-border E-commerce", fieldCategory: "Business" },
  { degreeLevel: "Undergraduate", nameEn: "Business Administration", fieldCategory: "Business" },
];
const postgraduateSpecs: ProgramSpec[] = [
  { degreeLevel: "Master", nameEn: "Master of International Business (MIB)", fieldCategory: "Business" },
  { degreeLevel: "Master", nameEn: "Management Science and Engineering", fieldCategory: "Management" },
  { degreeLevel: "Master", nameEn: "Master of Business Administration (MBA)", fieldCategory: "Business" },
  { degreeLevel: "Master", nameEn: "Public Organization and Human Resource Management", fieldCategory: "Management" },
];

const makePrograms = (specs: ProgramSpec[], source: Manifest["sources"][number], tuitionAmount: number, englishRequirement: string): CatalogSeedProgram[] => specs.map((spec) => ({
  slug: `${schoolSlug}-${spec.degreeLevel.toLowerCase()}-${slugify(spec.nameEn)}`,
  schoolSlug,
  citySlug,
  nameEn: spec.nameEn,
  ...(spec.nameZh ? { nameZh: spec.nameZh } : {}),
  degreeLevel: spec.degreeLevel,
  fieldCategory: spec.fieldCategory,
  subjectArea: spec.nameEn,
  teachingLanguage: "English",
  englishRequirement,
  tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
  scholarshipText: "The 2026 guide lists Shandong Provincial Government and SDUFE scholarship routes without publishing program-specific award details.",
  applicationUrl,
  applicationNote: "The official brochure says programs with insufficient enrollment may not open; no unlisted major is inferred.",
  hasScholarship: true,
  status: "draft",
  ...evidenceFor(source),
  sourceFieldLineage: {
    nameEn: "I. Programs Offered / English-Taught Program",
    degreeLevel: "brochure title and I. Programs Offered",
    teachingLanguage: "I. Programs Offered / English-Taught Program",
    englishRequirement: "II. Eligibility / Language Proficiency",
    tuitionText: "V. Fees / Tuition",
    applicationUrl: "III. Application",
  },
}));

const undergraduatePrograms = makePrograms(undergraduateSpecs, undergraduateSource, 21000, "IELTS 5.5 or an equivalent English proficiency certificate; native English speakers are exempt.");
const postgraduatePrograms = makePrograms(postgraduateSpecs, postgraduateSource, 28000, "IELTS 6.0 or an equivalent English proficiency certificate; native English speakers are exempt.");
const programs = [...undergraduatePrograms, ...postgraduatePrograms];
const programIntakes = [
  ...undergraduatePrograms.map((program) => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    deadlineDate: "2026-06-20T15:59:59.000Z",
    deadlineLabel: "June 20, 2026",
    applicationRound: "2026 international undergraduate admissions",
    status: "closed" as const,
    ...evidenceFor(undergraduateSource),
    sourceFieldLineage: { intakeYear: "brochure title", deadlineDate: "III. Application / Deadline" },
  })),
  ...postgraduatePrograms.map((program) => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    deadlineDate: "2026-05-31T15:59:59.000Z",
    deadlineLabel: "May 31, 2026",
    applicationRound: "2026 international postgraduate admissions",
    status: "closed" as const,
    ...evidenceFor(postgraduateSource),
    sourceFieldLineage: { intakeYear: "brochure title", deadlineDate: "III. Application / Deadline" },
  })),
];

const undergraduateEvidence = evidenceFor(undergraduateSource);
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: postgraduateManifest.generatedAt,
  cities: [{
    slug: citySlug,
    nameEn: "Jinan",
    nameZh: "济南",
    province: "Shandong",
    region: "East China",
    status: "draft",
    verificationStatus: "unverified",
    ...undergraduateEvidence,
    sourceFieldLineage: { nameEn: "IX. Contact Information", nameZh: "official Chinese site address", province: "IX. Contact Information", region: "CUAC geographic taxonomy" },
  }],
  schools: [{
    slug: schoolSlug,
    nameEn: "Shandong University of Finance and Economics",
    nameZh: "山东财经大学",
    citySlug,
    schoolType: "Public",
    region: "Jinan, Shandong, East China",
    applicationLevel: "Undergraduate, Master, Doctoral",
    languageOfInstruction: "Chinese and English",
    languageRequirement: "Undergraduate: HSK 4 (180) for Chinese-taught or IELTS 5.5/equivalent for English-taught. Master: HSK 5 (180) or IELTS 6.0/equivalent. Doctoral: HSK 6 (180) or IELTS 6.5/equivalent.",
    hskRequirement: "HSK 4 (180) undergraduate; HSK 5 (180) master; HSK 6 (180) doctoral for Chinese-taught routes.",
    englishRequirement: "IELTS 5.5 undergraduate, 6.0 master, 6.5 doctoral, or equivalent; native English speakers are exempt.",
    deadlineSummary: "Undergraduate: June 20, 2026. Postgraduate: May 31, 2026. Both reviewed cycles are closed; no later deadline is inferred.",
    tuitionSummary: "Chinese-taught undergraduate: CNY 16,000/year; English-taught undergraduate: CNY 21,000/year; applied undergraduate: CNY 44,200/year; Chinese-taught master: CNY 22,000/year; English-taught master: CNY 28,000/year; doctoral: CNY 30,000/year.",
    applicationFee: "CNY 400",
    websiteUrl: "https://www.sdufe.edu.cn/",
    admissionsUrl: undergraduateSource.finalUrl,
    subjectTags: ["Economics", "Business", "Management", "Law"],
    languageTags: ["Chinese", "English", "HSK", "IELTS"],
    campusHighlights: ["Jinan location", "Undergraduate through doctoral international admissions", "Shandong provincial and university scholarship routes"],
    status: "draft",
    ...undergraduateEvidence,
    sourceFieldLineage: { nameEn: "brochure titles", nameZh: "official site identity", citySlug: "IX. Contact Information", schoolType: "official university identity", applicationLevel: "undergraduate and postgraduate brochure titles plus eligibility sections", languageRequirement: "II. Eligibility in both brochures", deadlineSummary: "III. Application in both brochures", tuitionSummary: "V. Fees in both brochures", websiteUrl: "official university domain", admissionsUrl: "registered undergraduate admissions page" },
  }],
  programs,
  programIntakes,
  scholarships: [],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha256(candidateText),
  undergraduateManifestSha256: sha256(undergraduateManifestText),
  postgraduateManifestSha256: sha256(postgraduateManifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Only seven exact English-taught program names explicitly printed in the two 2026 brochures are included.",
      "Chinese-taught disciplines and doctoral routes are described only as broad categories, so no exact program records are invented for them.",
      "Program durations are not stated in the reviewed pages and remain absent.",
      "No 2027 intake, CSCA subject rule, or scholarship amount is inferred.",
      "Personal contact details and applicant documents are excluded.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
