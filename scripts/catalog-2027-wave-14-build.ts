import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
  type CatalogSeedSchool,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-14.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-14.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-14.review.json");
const expected: Record<string, string> = {
  "tongji-application-information-updates-spring-2027": "1485df8e80508b0c786e2543fcea409c61dc67732692a8df1fcd36570018adbf",
  "tongji-current-international-student-fees": "97023b6ede7f4e09881cc6f6ba2ecdbbdf5ca0f00de77c860a85a5b0a855159c",
  "tongji-international-chinese-language-teachers-scholarship-spring-2027": "0407dfa41e812ae1ca69a0ab13f7b0bf54bfdd405eed9af7a25dec7d7bdaaeb4",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 14 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === "tongji-university");
const city = (base.cities ?? []).find((row) => row.slug === "shanghai");
if (!baseSchool || !city) throw new Error("Wave 14 Tongji dependencies are missing from the reviewed 100-school release.");
const source = evidence.get("tongji-application-information-updates-spring-2027")!;
const feeSource = evidence.get("tongji-current-international-student-fees")!;
const languageScholarshipSource = evidence.get("tongji-international-chinese-language-teachers-scholarship-spring-2027")!;
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const languageScholarshipFields = {
  sourceUrl: languageScholarshipSource.finalUrl ?? languageScholarshipSource.url,
  sourceLabel: languageScholarshipSource.label,
  sourceSha256: languageScholarshipSource.sha256,
  capturedAt: languageScholarshipSource.fetchedAt,
};
const school: CatalogSeedSchool = {
  ...baseSchool,
  deadlineSummary: "Spring 2027 non-degree and exchange program applications are due by December 30, 2026. The CSC ChinaLink application deadline on the CSC website is November 20, 2026 for officially nominated exchange students from partner institutions. Fall 2027 degree timelines are not yet published on this source.",
  applicationFee: "CNY 600. The current official international-student fee table lists the application fee separately from tuition and insurance.",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    deadlineSummary: "Spring 2027 application timelines",
    applicationFee: `registered official fee table ${feeSource.id}: Application Fee — 600 RMB`,
  },
};
const program: CatalogSeedProgram = {
  slug: "tongji-university-spring-2027-nondegree-and-exchange-programs",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Spring 2027 Non-degree and Exchange Programs",
  nameZh: "2027年春季非学历及校际交流项目",
  degreeLevel: "Non-degree",
  fieldCategory: "Non-degree and exchange programs",
  subjectArea: "Program-specific; the timeline page does not publish a Spring 2027 course catalog",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Tongji's official application information page states that Spring 2027 non-degree and exchange applications are due by December 30, 2026. Program names, tuition, teaching language, opening date and route-specific requirements are not published on this source and are not inferred from older guides.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "Spring 2027 application-timeline category", nameZh: "Spring 2027 application-timeline category (translated label)", degreeLevel: "Non-Degree Programs and Exchange Programs categories", fieldCategory: "application-timeline category", subjectArea: "absence of a linked Spring 2027 course catalog", applicationUrl: "official timeline page", applicationNote: "Spring 2027 application timeline",
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineLabel: "Application deadline: December 30, 2026. The official timeline does not publish a deadline time.",
  applicationRound: "Tongji Spring 2027 non-degree and exchange admission",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: { intakeTerm: "Spring 2027 (February/March) admission heading", intakeYear: "Spring 2027 heading", deadlineLabel: "Non-Degree Programs and Exchange Programs timeline", applicationRound: "Spring 2027 timeline", status: "deadline compared with capturedAt" },
};
const scholarship: CatalogSeedScholarship = {
  slug: "tongji-spring-2027-csc-chinalink-exchange-scholarship",
  title: "Tongji Spring 2027 CSC ChinaLink Scholarship - Exchange Students",
  type: "Government",
  providerName: "China Scholarship Council",
  schoolSlug: school.slug,
  applicableDegree: "Non-degree / Exchange",
  applicableProgram: "Officially nominated exchange students from Tongji partner institutions",
  deadlineDate: "2026-11-20",
  deadlineLabel: "CSC website application deadline: November 20, 2026. The official Tongji timeline does not publish a deadline time.",
  requirementText: "Only officially nominated exchange students from Tongji partner institutions are eligible according to the Spring 2027 timeline. Coverage and other eligibility details are not stated on this source and remain absent.",
  applicationRound: "Tongji Spring 2027 CSC ChinaLink Scholarship",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { title: "Spring 2027 CSC-ChinaLink timeline", type: "scholarship title", providerName: "CSC-ChinaLink title", schoolSlug: "official Tongji domain", applicableDegree: "exchange-student restriction", applicableProgram: "official nomination restriction", deadlineDate: "CSC website deadline", deadlineLabel: "CSC website deadline", requirementText: "partner-institution nomination restriction", applicationRound: "Spring 2027 timeline", status: "deadline compared with capturedAt" },
};

const languageScholarshipProgram: CatalogSeedProgram = {
  slug: "tongji-university-international-chinese-language-teachers-one-semester-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Chinese Language and Literature - Spring 2027",
  nameZh: "国际中文教师奖学金一学期汉语言文学项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language and literature",
  subjectArea: "One-semester Chinese language and literature study",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 or above and an HSKK score are required.",
  tuitionText: "Tuition is covered by the scholarship. The award also supports accommodation, a CNY 2,500 monthly living allowance and comprehensive medical insurance reimbursement.",
  displayTuition: "Scholarship-covered tuition",
  applicationUrl: languageScholarshipSource.finalUrl ?? languageScholarshipSource.url,
  applicationNote: "Entry is in March 2027 and scholarship support is for up to five months. Applicants must be non-Chinese citizens, generally aged 18-35, interested in Chinese-language education, physically and mentally healthy, and recommended by an eligible institution. Applicants holding an X1 or X2 visa are not eligible.",
  hasScholarship: true,
  scholarshipText: "Tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance are supported under the 2026 International Chinese Language Teachers Scholarship guide.",
  badgeText: "Spring 2027 scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language scholarship programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: languageScholarshipSource.fetchedAt,
  ...languageScholarshipFields,
  sourceFieldLineage: {
    nameEn: "official scholarship category and March 2027 entry",
    nameZh: "official scholarship category translated label",
    degreeLevel: "official one-semester study category",
    durationMonths: "official maximum five-month scholarship period",
    fieldCategory: "official Chinese Language and Literature category",
    subjectArea: "official scholarship category",
    teachingLanguage: "Chinese-language study category",
    hskRequirement: "official one-semester eligibility criteria",
    tuitionText: "official scholarship coverage and standard",
    applicationNote: "official eligibility and category restrictions",
    scholarshipText: "official scholarship coverage and standard",
  },
};

const languageScholarshipIntake: CatalogSeedProgramIntake = {
  programSlug: languageScholarshipProgram.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-25T00:00:00Z",
  deadlineLabel: "Application period: September 25-October 25, 2026 for March 2027 entry. The guide does not publish a deadline time.",
  applicationRound: "Tongji March 2027 International Chinese Language Teachers Scholarship",
  status: "open",
  ...languageScholarshipFields,
  sourceFieldLineage: {
    intakeTerm: "official March 2027 entry",
    intakeYear: "official March 2027 entry",
    deadlineDate: "official September 25-October 25, 2026 application period",
    deadlineLabel: "official program schedule",
    applicationRound: "official scholarship title and entry date",
    status: "deadline compared with capturedAt",
  },
};

const languageScholarship: CatalogSeedScholarship = {
  slug: "tongji-international-chinese-language-teachers-one-semester-scholarship-spring-2027",
  title: "Tongji International Chinese Language Teachers Scholarship - One-Semester Program - Spring 2027",
  nameZh: "同济大学国际中文教师奖学金一学期项目（2027年春季）",
  type: "Government",
  providerName: "Center for Language Education and Cooperation",
  schoolSlug: school.slug,
  programSlug: languageScholarshipProgram.slug,
  fundingLevel: "Full scholarship",
  coverage: "Tuition, accommodation, monthly living allowance and comprehensive medical insurance",
  applicableDegree: "Non-degree / One-semester study",
  applicableProgram: "Chinese Language and Literature",
  amountText: "CNY 2,500 monthly living allowance; accommodation is provided or an approved off-campus allowance of CNY 700/month applies; one-semester medical insurance premium of CNY 400 is reimbursed.",
  requirementText: "Applicants need HSK Level 3 score 180 or above, an HSKK score, an eligible recommending institution, and must not hold an X1 or X2 visa. General eligibility includes non-Chinese citizenship, good physical and mental health, good academic and behavioral standing, interest in Chinese-language education, and normally age 18-35.",
  deadlineDate: "2026-10-25",
  deadlineLabel: "Application period: September 25-October 25, 2026 for March 2027 entry.",
  applicationRound: "March 2027 one-semester scholarship entry",
  benefits: ["Tuition support", "Accommodation support", "CNY 2,500 monthly living allowance", "Comprehensive medical insurance reimbursement"],
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: languageScholarshipSource.fetchedAt,
  ...languageScholarshipFields,
  sourceFieldLineage: {
    title: "official scholarship title and one-semester category",
    nameZh: "official scholarship title translated label",
    type: "official CLEC scholarship guide",
    providerName: "official scholarship introduction",
    schoolSlug: "official Tongji domain",
    programSlug: "official one-semester category",
    fundingLevel: "official scholarship coverage",
    coverage: "official scholarship coverage and standard",
    applicableDegree: "official one-semester category",
    applicableProgram: "official Chinese Language and Literature category",
    amountText: "official allowance and insurance amounts",
    requirementText: "official eligibility and category qualifications",
    deadlineDate: "official program schedule",
    deadlineLabel: "official program schedule",
    applicationRound: "official March 2027 entry",
    benefits: "official scholarship coverage and standard",
  },
};

const generatedAt = [source.fetchedAt, feeSource.fetchedAt, languageScholarshipSource.fetchedAt].sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs: [program, languageScholarshipProgram], programIntakes: [intake, languageScholarshipIntake], scholarships: [scholarship, languageScholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 14 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 2, new2027Intakes: 2, refreshedScholarships: 2, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
  unresolved: [
    "The official timeline does not publish the Spring 2027 non-degree or exchange course list, route-specific tuition, teaching language, opening date or route-specific application requirements.",
    "Fall 2027 undergraduate, master and doctoral application rounds are not published on this source and existing 2026 degree routes are not relabeled.",
    "The Spring 2027 ChinaLink timeline states the deadline and nomination restriction but not coverage or the full scholarship requirements; the separate International Chinese Language Teachers Scholarship coverage is not applied to ChinaLink.",
  ],
  notes: [
    "The program row is intentionally a published application-category group rather than an invented list of individual courses.",
    "The current official international-student fee table independently confirms a CNY 600 school-level application fee; its generic tuition rows are not assigned to the grouped Spring 2027 program placeholder.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: 2, programIntakes: 2, scholarships: 2, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
