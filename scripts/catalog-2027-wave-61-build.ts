import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "heu-international-chinese-language-teachers-scholarship-spring-2027";
const expectedSha256 = "53bfdf4537dda5280e14c1a8543923670cac4b6549fe355b6bd2ef12ad51dc17";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("HEU scholarship evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}

if (!source) throw new Error("Missing locked HEU Spring 2027 scholarship evidence.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const verified = { status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...fields };
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "harbin") ?? baseline.cities?.find((row) => row.slug === "harbin");
const priorSchool = prior.schools?.find((row) => row.slug === "harbin-engineering-university") ?? baseline.schools?.find((row) => row.slug === "harbin-engineering-university");
if (!city || !priorSchool) throw new Error("Missing HEU dependency rows.");

const school = {
  ...priorSchool,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  languageOfInstruction: "Chinese and English; the Spring 2027 scholarship routes are Chinese-taught",
  languageRequirement: "Spring 2027 one-semester scholarship routes require HSK evidence; International Chinese Language Education and Chinese Language and Literature require HSK Level 3 score 180 plus HSKK, while Taiji Culture requires an HSK result.",
  deadlineSummary: "Spring 2027 International Chinese Language Teachers Scholarship applications close October 31, 2026. Other published 2027 routes retain their route-specific deadlines.",
  ...verified,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official scholarship category",
    languageOfInstruction: "official route requirements",
    languageRequirement: "official scholarship category table",
    deadlineSummary: "official March 2027 application deadline",
  },
};

const routeDefinitions = [
  {
    suffix: "international-chinese-language-education",
    nameEn: "International Chinese Language Education - One-Semester Scholarship (Spring 2027)",
    nameZh: "国际中文教育一学期奖学金（2027年春季）",
    subjectArea: "International Chinese language education",
    hskRequirement: "HSK Level 3 score 180 and an HSKK result.",
  },
  {
    suffix: "chinese-language-and-literature",
    nameEn: "Chinese Language and Literature - One-Semester Scholarship (Spring 2027)",
    nameZh: "汉语言文学一学期奖学金（2027年春季）",
    subjectArea: "Chinese language and literature",
    hskRequirement: "HSK Level 3 score 180 and an HSKK result.",
  },
  {
    suffix: "taiji-culture",
    nameEn: "Taiji Culture - One-Semester Scholarship (Spring 2027)",
    nameZh: "太极文化一学期奖学金（2027年春季）",
    subjectArea: "Taiji culture",
    hskRequirement: "An HSK test result is required; the official guide does not publish a minimum level or score.",
  },
] as const;

const programs = routeDefinitions.map((route) => ({
  slug: `harbin-engineering-university-${route.suffix}-one-semester-scholarship-spring-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: route.subjectArea,
  teachingLanguage: "Chinese",
  hskRequirement: route.hskRequirement,
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full scholarship covering tuition, on-campus accommodation, a CNY 2,500 monthly living allowance and comprehensive medical insurance.",
  applicationUrl: source!.finalUrl ?? source!.url,
  applicationNote: "Applicants must be non-Chinese citizens, normally aged 16-35 as of September 1, 2026, healthy, academically and behaviorally sound, and interested in Chinese-language education or related work. In-service Chinese teachers may be up to 45. Applicants must apply in both the HEU international-student platform and the International Chinese Language Teachers Scholarship system and participate in an online interview.",
  hasScholarship: true,
  badgeText: "March 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "International Chinese Language Teachers Scholarship",
  ...verified,
  sourceFieldLineage: {
    nameEn: "official scholarship category table and March 2027 entry",
    nameZh: "official scholarship category table and March 2027 entry",
    durationMonths: "official five-month funding period",
    subjectArea: "official scholarship category",
    teachingLanguage: "official HSK/HSKK requirements",
    hskRequirement: "official scholarship category table",
    tuitionText: "official scholarship coverage",
    scholarshipText: "official scholarship coverage and allowance amount",
    applicationNote: "official eligibility and application-process sections",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 for March 2027 entry.",
  applicationRound: "March 2027 one-semester scholarship entry",
  status: "open" as const,
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official March 2027 entry",
    intakeYear: "official March 2027 entry",
    deadlineDate: "official application deadline normalized to end of day in Beijing",
    deadlineLabel: "official application deadline",
    status: "deadline compared with capturedAt",
  },
}));

const scholarship = {
  slug: "heu-international-chinese-language-teachers-scholarship-spring-2027",
  title: "HEU International Chinese Language Teachers Scholarship - Spring 2027",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "Center for Language Education and Cooperation / Harbin Engineering University",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition, on-campus accommodation, CNY 2,500 monthly living allowance and comprehensive medical insurance.",
  amountText: "CNY 2,500 per month living allowance for one-semester non-degree scholarship students.",
  applicableDegree: "Five-month one-semester non-degree study in International Chinese Language Education, Chinese Language and Literature, or Taiji Culture.",
  deadlineDate: "2026-10-31",
  deadlineLabel: "October 31, 2026 for March 2027 entry.",
  requirementText: "Applicants must satisfy the route-specific HSK/HSKK rules and the scholarship's general eligibility rules. Applicants who received the same scholarship category within the prior three years are normally ineligible for the one-semester route.",
  actionLinks: [{ label: "Official HEU Spring 2027 scholarship guide", url: source.finalUrl ?? source.url, kind: "official-source" }],
  ...verified,
  sourceFieldLineage: {
    title: "official guide title and March 2027 category",
    fundingLevel: "official coverage section",
    coverage: "official coverage section",
    amountText: "official monthly allowance amount",
    applicableDegree: "official category table",
    deadlineDate: "official application deadline",
    deadlineLabel: "official application deadline",
    requirementText: "official eligibility, category and remark sections",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 61 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The guide publishes no self-funded tuition amount for the three Spring 2027 scholarship routes.",
    "The guide does not publish a numeric HSK threshold for Taiji Culture.",
    "The guide does not establish HEU's general Fall 2027 degree-admission cycle.",
  ],
  notes: ["Only the three one-semester categories explicitly eligible for March 2027 are represented; 2026-only categories are excluded.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-61.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-61.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-61.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 61, candidateSha256, counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
