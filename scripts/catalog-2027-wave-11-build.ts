import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-11.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-11.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-11.review.json");
const expected: Record<string, string> = {
  "gdufs-degree-admissions-spring-2027": "3123905025858d4e291e4912ad37237630ebe9ecaa14bd6001ba31f93ceee568",
  "gdufs-chinese-language-undergraduate-programs-current": "5c1560c7f0d5a485e8ea150d944dcb81113c7770a5cd9118cff53fcddf68788d",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 11 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const school = (base.schools ?? []).find((row) => row.slug === "guangdong-university-of-foreign-studies");
const city = (base.cities ?? []).find((row) => row.slug === "guangzhou");
if (!school || !city) throw new Error("Wave 11 GDUFS dependencies are missing from the reviewed 100-school release.");
const admissionsSource = evidence.get("gdufs-degree-admissions-spring-2027")!;
const programSource = evidence.get("gdufs-chinese-language-undergraduate-programs-current")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

const routeDefinitions = [
  {
    slug: "guangdong-university-of-foreign-studies-chinese-language-business-chinese-spring-2027",
    nameEn: "Chinese Language (Business Chinese)",
    fieldCategory: "Chinese language and international business",
    subjectArea: "Chinese language, international trade, business communication and translation",
    note: "The four-year program trains international-trade professionals through Chinese-language foundations, international-trade theory, business communication and translation. Applicants need a high-school certificate. Beginners enter year one, HSK 4 holders may enter year two, and HSK 5 holders may enter year three, subject to admission review.",
  },
  {
    slug: "guangdong-university-of-foreign-studies-chinese-language-culture-communication-spring-2027",
    nameEn: "Chinese Language (Culture and Communication)",
    fieldCategory: "Chinese language, culture and communication",
    subjectArea: "Chinese language, Chinese culture, journalism and cultural communication",
    note: "The four-year program prepares students for media, cultural communication, journalism and other Chinese-language professions. Applicants need a high-school certificate. HSK 4 holders may enter year two and HSK 5 holders may enter year three, subject to admission review.",
  },
] as const;
const programs: CatalogSeedProgram[] = routeDefinitions.map((route) => ({
  slug: route.slug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  degreeLevel: "Undergraduate",
  fieldCategory: route.fieldCategory,
  subjectArea: route.subjectArea,
  teachingLanguage: "Chinese",
  hskRequirement: "For Spring 2027 first-year entry, no HSK certificate is required but applicants must have Chinese proficiency equivalent to HSK 3. Year-two entry requires HSK 4 (180+); year-three Business Chinese entry requires HSK 5 (180+).",
  tuitionAmount: 20000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 20,000/year; application fee CNY 500.",
  applicationNote: `${route.note} Spring 2027 applicants must also satisfy the university's nationality, health, conduct, age, academic, CSCA and document requirements; undergraduate applicants are normally under age 30.`,
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: admissionsSource.fetchedAt,
  ...sourceFields(programSource),
  sourceFieldLineage: {
    nameEn: "program headings",
    degreeLevel: "program page and Spring 2027 degree admission notice",
    fieldCategory: "program description",
    subjectArea: "program description",
    teachingLanguage: "Spring 2027 Chinese-program requirements",
    hskRequirement: "Spring 2027 admission notice and program page",
    tuitionAmount: "program page",
    tuitionCurrency: "program page",
    tuitionPeriod: "program page",
    tuitionText: "program page",
    applicationNote: "program description and Spring 2027 eligibility",
  },
}));
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-09-30T00:00:00.000Z",
  deadlineLabel: "Application period: September 30-December 10, 2026. The official notice publishes dates without a deadline time.",
  applicationRound: "GDUFS Spring 2027 degree admission",
  status: "open",
  ...sourceFields(admissionsSource),
  sourceFieldLineage: { intakeTerm: "Spring 2027 notice heading", intakeYear: "Spring 2027 notice heading", openDate: "Application Period", deadlineLabel: "Application Period", applicationRound: "official notice heading", status: "application period compared with capturedAt" },
}));

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 11 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "The Spring 2027 notice explicitly names the Chinese B.A. and Chinese (Business Chinese) routes; the linked current program page supplies their descriptions and fees.",
    "The current program page also lists a Chinese-Thai Translation route, but the Spring 2027 notice does not name it, so this wave does not create a 2027 intake for that route.",
    "No unlisted Spring 2027 degree program, scholarship, or requirement is inferred.",
    "No applicant, account, passport, payment, or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
