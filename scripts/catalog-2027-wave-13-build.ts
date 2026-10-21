import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const dependencyPath = resolve(root, "seeds/catalog.2027-wave-05.draft.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-13.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-13.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-13.review.json");
const expected: Record<string, string> = {
  "nankai-undergraduate-admissions-2027": "c17496625090e718894a29288c6a7b3881d6a881d151d43bc621ff92d78fe9ff",
  "nankai-undergraduate-program-catalog-xlsx-2027": "e93012559e47f168f5df9fbbe57269cf58521b25f3bf532f5814dbda82b710c2",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 13 evidence: ${missing.join(", ")}`);

const dependencies = JSON.parse(await readFile(dependencyPath, "utf8")) as CatalogSeedBundle;
const school = (dependencies.schools ?? []).find((row) => row.slug === "nankai-university");
const city = (dependencies.cities ?? []).find((row) => row.slug === "tianjin");
if (!school || !city) throw new Error("Wave 13 Nankai dependencies are missing from Wave 05.");
const admissionsSource = evidence.get("nankai-undergraduate-admissions-2027")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

const program: CatalogSeedProgram = {
  slug: "nankai-university-2027-chinese-taught-undergraduate-programs",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "2027 Chinese-taught Undergraduate Programs (46-program group)",
  nameZh: "2027年中文授课本科项目（46个专业组）",
  degreeLevel: "Bachelor",
  durationYears: 4,
  fieldCategory: "Chinese-taught undergraduate programs",
  subjectArea: "46 published undergraduate programs; exact major catalog remains behind the university attachment CAPTCHA",
  teachingLanguage: "Chinese",
  cscaRequirement: "All applicants must take the China Scholastic Competency Assessment (CSCA) and submit the score report. Test subjects correspond to the intended major; exact mappings remain in the CAPTCHA-protected official catalog and are not inferred.",
  hskRequirement: "HSK 4 with a score of 180 or above for admission. Students in Chinese-taught programs must obtain HSK 6 with a score of 180 or above before graduation.",
  tuitionText: "CNY 20,000-35,000/year; exact tuition depends on the program catalog. Medical programs last five years; other programs last four years. Application fee CNY 400 is paid at admission, while Chinese Government Scholarship recipients are exempt. Accommodation CNY 23-60/person/day and medical insurance CNY 800/year are separate.",
  applicationUrl: "https://nankai.at0086.cn/StuApplication/Login.aspx",
  applicationNote: "Nankai uses a 1+3 pathway: one foundation academic year followed by three years of major study. Applicants must be non-Chinese citizens in good physical and mental health, normally aged 18-25, hold a senior high-school diploma with strong academic performance, submit the published academic, passport, CSCA, HSK, personal-statement, recommendation, medical, financial and criminal-record documents, and complete document review and interview. Business Economics and Business Administration accept first-choice applications only.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: admissionsSource.fetchedAt,
  ...sourceFields(admissionsSource),
  sourceFieldLineage: {
    nameEn: "2027 guide title and Programs section", nameZh: "2027 guide title and Programs section", degreeLevel: "guide title", durationYears: "Programs section", fieldCategory: "Programs section", subjectArea: "Programs section and protected attachment state", teachingLanguage: "Programs section", cscaRequirement: "Application Procedure and Required Documents", hskRequirement: "Eligibility Requirements and program introduction", tuitionText: "Fees section", applicationUrl: "Application Procedure", applicationNote: "program introduction, eligibility, required documents and review procedure",
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-10-20T00:00:00.000Z",
  deadlineLabel: "Application period: October 20, 2026-June 4, 2027. The official guide does not publish a deadline time.",
  applicationRound: "Nankai Fall 2027 international undergraduate admission",
  status: "open",
  ...sourceFields(admissionsSource),
  sourceFieldLineage: { intakeTerm: "September enrollment and July admission-document issue", intakeYear: "2027 guide title", openDate: "Application Period", deadlineLabel: "Application Period", applicationRound: "guide title", status: "application period compared with capturedAt" },
};

const scholarshipBase = {
  schoolSlug: school.slug,
  applicableDegree: "Bachelor",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: admissionsSource.fetchedAt,
  ...sourceFields(admissionsSource),
};
const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "nankai-2027-chinese-government-scholarship-type-a-undergraduate",
    title: "Nankai 2027 Chinese Government Scholarship Type A - Undergraduate",
    type: "Government",
    providerName: "China Scholarship Council / Chinese embassy or consulate",
    applicableProgram: "Eligible Nankai undergraduate programs",
    deadlineLabel: "Applications generally run from November 2026 to early February 2027; the exact deadline follows the responsible Chinese embassy or consulate.",
    requirementText: "Apply through the responsible Chinese embassy or consulate and concurrently complete Nankai University's international-student application. Applicants are advised to confirm pre-admission status with Nankai before applying through the diplomatic mission.",
    applicationRound: "Nankai 2027 Chinese Government Scholarship Type A",
    ...scholarshipBase,
    sourceFieldLineage: { title: "Scholarship Programs section", type: "Scholarship Programs section", providerName: "Scholarship Programs section", applicableDegree: "undergraduate guide context", applicableProgram: "Scholarship Programs section", deadlineLabel: "Scholarship Programs section", requirementText: "Scholarship Programs section", applicationRound: "Scholarship Programs section", status: "published 2027 application route" },
  },
  {
    slug: "nankai-2027-international-chinese-language-teachers-scholarship-undergraduate",
    title: "Nankai 2027 International Chinese Language Teachers Scholarship - Undergraduate",
    type: "Language education",
    providerName: "Center for Language Education and Cooperation",
    applicableProgram: "International Chinese Language Education major only",
    requirementText: "Applicants must complete both the Nankai application and the scholarship application at cis.chinese.cn, obtain Nankai pre-admission, and may receive a university recommendation letter based on the official review.",
    applicationRound: "Nankai 2027 International Chinese Language Teachers Scholarship",
    ...scholarshipBase,
    sourceFieldLineage: { title: "Scholarship Programs section", type: "Scholarship Programs section", providerName: "scholarship application portal and program name", applicableDegree: "undergraduate guide context", applicableProgram: "Scholarship Programs section", requirementText: "Scholarship Programs section", applicationRound: "Scholarship Programs section", status: "published 2027 application route" },
  },
  {
    slug: "nankai-2027-tianjin-government-scholarship-undergraduate",
    title: "Nankai 2027 Tianjin Government Scholarship - Undergraduate",
    type: "Government",
    providerName: "Tianjin Municipal Government / Nankai University",
    applicableProgram: "Eligible Nankai undergraduate programs",
    coverage: "The 2027 guide states tuition, living expenses, insurance subsidies and other relevant expenses; the final scholarship level is determined by interview performance and overall application quality.",
    deadlineDate: "2027-05-30",
    deadlineLabel: "Application deadline: May 30, 2027. The official guide does not publish a deadline time.",
    requirementText: "Select Scholarship Application in the Nankai application. Only applicants who receive pre-admission through Nankai's international-student review are eligible for nomination.",
    applicationRound: "Nankai 2027 Tianjin Government Scholarship",
    ...scholarshipBase,
    sourceFieldLineage: { title: "Scholarship Programs section", type: "Scholarship Programs section", providerName: "Scholarship Programs section", applicableDegree: "undergraduate guide context", applicableProgram: "Scholarship Programs section", coverage: "Funding Coverage", deadlineDate: "Application Deadline", deadlineLabel: "Application Deadline", requirementText: "Scholarship Programs section", applicationRound: "Scholarship Programs section", status: "published 2027 deadline" },
  },
  {
    slug: "nankai-2027-study-at-nku-scholarship-undergraduate",
    title: "Nankai 2027 Study-at-NKU Scholarship - Undergraduate",
    type: "University",
    providerName: "Nankai University",
    applicableProgram: "Eligible Nankai undergraduate programs",
    coverage: "The 2027 guide states tuition, living expenses, insurance subsidies and other relevant expenses; the final scholarship level is determined by interview performance and overall application quality.",
    deadlineDate: "2027-05-30",
    deadlineLabel: "Application deadline: May 30, 2027. The official guide does not publish a deadline time.",
    requirementText: "Select Scholarship Application in the Nankai application. Scholarship assessment follows interview performance and overall application quality.",
    applicationRound: "Nankai 2027 Study-at-NKU Scholarship",
    ...scholarshipBase,
    sourceFieldLineage: { title: "Scholarship Programs section", type: "Scholarship Programs section", providerName: "Scholarship Programs section", applicableDegree: "undergraduate guide context", applicableProgram: "Scholarship Programs section", coverage: "Funding Coverage", deadlineDate: "Application Deadline", deadlineLabel: "Application Deadline", requirementText: "Scholarship Programs section", applicationRound: "Scholarship Programs section", status: "published 2027 deadline" },
  },
];

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 13 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The official guide says Nankai offers 46 Chinese-taught undergraduate programs, but the attached 2027 XLSX catalog is protected by a university CAPTCHA. This workflow does not bypass it, so exact major rows, tuition by major and CSCA subject mappings remain unresolved.",
    "The Chinese Government Scholarship Type B Silk Road details will be published by Nankai in April 2027 and are therefore not represented as an active scholarship record in this wave.",
    "The Type A and language-teacher scholarship routes do not publish exact 2027 coverage or deadlines on this source; those fields remain absent.",
  ],
  notes: [
    "The group route stores only facts explicitly published on the 2027 admissions page and does not relabel the university's 2026 major catalog.",
    "The official attachment endpoint was registered and fetched, but returned the university CAPTCHA page rather than workbook bytes; its hash is retained as evidence of the unresolved dependency.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: 1, programIntakes: 1, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
