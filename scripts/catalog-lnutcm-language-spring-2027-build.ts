import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const pageRun = "work/catalog-official/2026-09-22T10-48-46-312Z";
const imageRun = "work/catalog-official/lnutcm-chinese-language-images-batch-01";
const candidatePath = resolve(root, "seeds/catalog.lnutcm-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.lnutcm-language-spring-2027.validation.json");
const programSlug = "liaoning-university-of-traditional-chinese-medicine-non-degree-chinese-language-self-funded-spring-2027";

type Source = {
  id: string;
  label: string;
  url: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const pageManifest = await json<Manifest>(`${pageRun}/manifest.json`);
const imageManifest = await json<Manifest>(`${imageRun}/manifest.json`);
const dependency = await json<Dependency>("seeds/catalog.lnutcm-complete-batch-01.draft.json");

function source(manifest: Manifest, id: string, sha256: string, contentType: string): Source {
  const row = manifest.sources.find((item) => item.id === id);
  if (!row || row.status !== 200 || row.sha256 !== sha256 || row.contentType !== contentType) {
    throw new Error(`LNUTCM evidence mismatch: ${id}`);
  }
  return row;
}
async function verifyArtifact(run: string, item: Source): Promise<void> {
  const bytes = await readFile(resolve(root, run, item.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`LNUTCM artifact hash mismatch: ${item.id}`);
}

const page = source(pageManifest, "lnutcm-chinese-language-program-2026-2027",
  "b23fae23d63e4c88bb0ef8f1b19fe46aca7b5e7d496b29b905a31481dc646115", "text/html");
const expectedImages = [
  ["lnutcm-chinese-language-guide-image-1-2026-2027", "274161ca59d39d18f1a4c9285e557515adac5cbe55909e9ab87b1139628de44a"],
  ["lnutcm-chinese-language-guide-image-2-2026-2027", "1bf78a9710184461dff0895682d9671e7f27215feb98d087d4cabe674e977da9"],
  ["lnutcm-chinese-language-guide-image-3-2026-2027", "18201b336fa26400fc035ef28f3cbeec0f4f2f9490d947810a5e6a92b2501d07"],
  ["lnutcm-chinese-language-guide-image-4-2026-2027", "3bb35723bc2ff722e76e88fec21b34989d3ee4f88ef0177f9128e0ba87bcc8ab"],
  ["lnutcm-chinese-language-guide-image-5-2026-2027", "0b81eb5160f3066f6dcf833eb4d649801cf58c7cea0bf33cfeb507536d245a0c"],
  ["lnutcm-chinese-language-guide-image-6-2026-2027", "ba5d1a094d82c000968b26f2b093f3b45ac73be780cb711addb8c27753a3f2df"],
] as const;
const images = expectedImages.map(([id, sha256]) => source(imageManifest, id, sha256, "image/png"));
await Promise.all([verifyArtifact(pageRun, page), ...images.map((item) => verifyArtifact(imageRun, item))]);

const city = dependency.cities.find((item) => item.slug === "shenyang");
const schoolBase = dependency.schools.find((item) => item.slug === "liaoning-university-of-traditional-chinese-medicine");
if (!city || !schoolBase) throw new Error("LNUTCM city or school dependency missing.");
const image = (number: number) => images[number - 1];
const imageLineage = (number: number, locator: string) => `${image(number).id} (${image(number).sha256}): ${locator}`;
const school = {
  ...schoolBase,
  deadlineSummary: "The reviewed Spring 2027 self-funded Chinese-language route closes December 25, 2026; the separate one-semester scholarship route closes October 31, 2026 Beijing Time.",
  tuitionSummary: "Spring 2027 self-funded Chinese-language study is CNY 6,500/semester or CNY 12,300/year; registration, accommodation and insurance are separate. Degree-route and scholarship terms differ.",
  applicationFee: "CNY 800 for the reviewed self-funded Chinese-language route and reviewed 2026 self-funded degree routes",
  admissionsUrl: page.url,
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    deadlineSummary: imageLineage(5, "Application Period, Spring 2027 intake"),
    tuitionSummary: imageLineage(6, "Fees"),
    applicationFee: imageLineage(6, "Fees, registration fee"),
    admissionsUrl: `${page.id} (${page.sha256}): official guide page`,
  },
};

const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Chinese Language One-Semester Self-funded Program (Spring 2027)",
  nameZh: "汉语言一学期自费进修项目（2027年春季）",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese Language",
  subjectArea: "Chinese Language Study",
  teachingLanguage: "Chinese",
  tuitionAmount: 6500,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 6,500/semester; CNY 12,300/year; CNY 800 registration fee; accommodation and insurance are separate.",
  applicationUrl: page.url,
  applicationNote: "Submit the electronic application materials to the official International Education College admissions office for filing and review.",
  hasScholarship: false,
  badgeText: "Spring 2027 self-funded route",
  displaySubjects: ["Chinese Language", "Listening", "Speaking", "Reading", "Writing"],
  displayGroup: "lnutcm-non-degree-chinese-language",
  displayGroupLabel: "LNUTCM Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: page.url,
  sourceLabel: page.label,
  sourceSha256: page.sha256,
  capturedAt: page.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${page.id} (${page.sha256}): guide title; ${imageLineage(3, "Long-term Program Introduction")}`,
    nameZh: `${imageLineage(1, "cover title")}; ${imageLineage(5, "Spring 2027 intake")}`,
    degreeLevel: imageLineage(3, "one-semester/one-year non-degree course structure"),
    fieldCategory: imageLineage(1, "Chinese-language study admission brochure title"),
    subjectArea: imageLineage(3, "course arrangement table"),
    teachingLanguage: imageLineage(3, "Chinese-language course arrangement"),
    tuitionAmount: imageLineage(6, "Fees, tuition"),
    applicationUrl: `${page.id} (${page.sha256}): official guide page`,
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-12-25T15:59:59.000Z",
  deadlineLabel: "December 25, 2026",
  applicationRound: "Spring 2027 self-funded Chinese-language intake",
  status: "open",
  sourceUrl: image(5).url,
  sourceLabel: image(5).label,
  sourceSha256: image(5).sha256,
  capturedAt: image(5).fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "Application Period, Spring 2027 intake",
    intakeYear: "Application Period, Spring 2027 intake",
    deadlineDate: "Application Period, Spring 2027 intake",
    status: "derived: deadline is after the 2026-10-14 review date",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: imageManifest.generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid LNUTCM Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    visuallyInspectedImages: 6,
    evidenceModel: "official guide page plus six hash-bound brochure images",
    unresolved: ["The English program title is an editorial translation of the official Chinese brochure and requires review before publication."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
