import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const releasePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-04.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-04.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-04.review.json");
const expected: Record<string, string> = {
  "fudan-management-international-masters-2027": "3849133acc04eaa54dbfd8121ab6f104137a38e9fb0d021b759c351080891baf",
  "fudan-management-international-masters-procedure-image-2027": "99b6782182eb4cc6e7e600580f42004ddca357bf1f9b6ea76e21da599f285c19",
  "fudan-mif-program-and-international-admissions-2027": "fcb0da68ed18382d9153a1bdcc82e85a152a0e265f21d540ca04d03c3d4f15dd",
  "fudan-aib-program-overview-2027": "0abff3d3e1edb7c14bfebdbb0c080e656636fc16c939c1b24e14e10653026284",
  "fudan-management-program-fees-2027": "9b51e050d46783229b62fa9f20a88971192f2fef829e9f87e7aec6f9d422b580",
  "pku-phbs-master-economics-2027": "074091bb412ed14a914ddabe32bdeb58d37914801c89418de3cd9460679fc8a4",
  "westlake-international-phd-admissions-2027": "1cccab714ece0ede7ca225c44e43fd2d6a9054b00fc73824194cfd4247b7f2ab",
  "westlake-engineering-doctoral-duration-2027": "d2c659bb3e05a49bb80b82c370ebec9f0822e4244f421ca939cbe8b452e83678",
  "westlake-general-doctoral-admissions-2027": "0b275c67f94d1aeba190b700a7f8bd74536a4fc2e23df70932cd0a12ce9b4361",
  "westlake-physics-doctoral-duration-2027": "2d13a4244ed514bf6e2791c89a891fadc36be5fbf347e2e45607d4cb7c273022",
  "westlake-biology-doctoral-duration-policy": "c5941ece4b00cb9a72bef72575e60d2907a2354c23a5488db7f8ca9735b4ee1a",
};

const evidence = new Map<string, ManifestSource & { runRoot: string; body: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, { ...source, runRoot, body: bytes.toString("utf8") });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 04 evidence: ${missing.join(", ")}`);

const fudanSource = evidence.get("fudan-management-international-masters-2027")!;
const fudanAdmissionsSource = evidence.get("fudan-mif-program-and-international-admissions-2027")!;
const fudanAibSource = evidence.get("fudan-aib-program-overview-2027")!;
const fudanFeesSource = evidence.get("fudan-management-program-fees-2027")!;
const pkuSource = evidence.get("pku-phbs-master-economics-2027")!;
const westlakeSource = evidence.get("westlake-international-phd-admissions-2027")!;
const westlakeEngineeringDurationSource = evidence.get("westlake-engineering-doctoral-duration-2027")!;
const westlakeGeneralDurationSource = evidence.get("westlake-general-doctoral-admissions-2027")!;
const westlakePhysicsDurationSource = evidence.get("westlake-physics-doctoral-duration-2027")!;
const westlakeBiologyDurationSource = evidence.get("westlake-biology-doctoral-duration-policy")!;
for (const required of ["Master of Finance - lnternational Finance", "Master of AI for Business"]) {
  if (!fudanSource.body.includes(required)) throw new Error(`Fudan source no longer contains ${required}.`);
}
for (const required of ["The length of study is two years", "2026/11/28 23:59", "TOEFL iBT", "RMB 800"]) {
  if (!fudanAdmissionsSource.body.includes(required)) throw new Error(`Fudan international admissions source no longer contains ${required}.`);
}
for (const required of ["学习年限", "2年", "2027级"]) {
  if (!fudanAibSource.body.includes(required)) throw new Error(`Fudan AIB source no longer contains ${required}.`);
}
for (const required of ["23.8万RMB/两年", "28.8万RMB/两年", "最高覆盖全额学费"]) {
  if (!fudanFeesSource.body.includes(required)) throw new Error(`Fudan fee source no longer contains ${required}.`);
}
for (const required of ["Application for 2027 intake", "March 31, 2027", "64,000 RMB per year", "TOEFL (90 and above)"]) {
  if (!pkuSource.body.includes(required)) throw new Error(`PKU PHBS source no longer contains ${required}.`);
}
for (const required of ["Fall 2027 intake", "There are currently eleven Ph.D. programs", "Biomedical Sciences", "40,000 CNY/year"]) {
  if (!westlakeSource.body.includes(required)) throw new Error(`Westlake source no longer contains ${required}.`);
}
for (const required of ["2027", "学制4年", "学制5年"]) {
  if (!westlakeEngineeringDurationSource.body.includes(required)) throw new Error(`Westlake engineering duration source no longer contains ${required}.`);
}
for (const required of ["西湖大学2027年博士研究生招生简章", "非中国国籍将进入国际生申请通道", "学制4年", "学制5年", "多尺度天体物理", "生物医学"]) {
  if (!westlakeGeneralDurationSource.body.includes(required)) throw new Error(`Westlake general duration source no longer contains ${required}.`);
}
for (const required of ["西湖大学2027年物理学学科博士研究生招生简章", "学制4年", "学制5年"]) {
  if (!westlakePhysicsDurationSource.body.includes(required)) throw new Error(`Westlake physics duration source no longer contains ${required}.`);
}
for (const required of ["生物学", "硕士起点的学生学制为4年", "本科起点的学生学制为5年"]) {
  if (!westlakeBiologyDurationSource.body.includes(required)) throw new Error(`Westlake biology duration source no longer contains ${required}.`);
}

const release = JSON.parse(await readFile(releasePath, "utf8")) as CatalogSeedBundle;
const allPrograms = release.programs ?? [];
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const fudanProgramRows = [
  {
    slug: "fudan-university-master-finance-international-finance",
    nameEn: "Master of Finance - International Finance (MIF)",
    teachingLanguage: "English",
    subjectArea: "International Finance",
  },
  {
    slug: "fudan-university-master-ai-for-business",
    nameEn: "Master of AI for Business (AIB)",
    teachingLanguage: "Chinese",
    subjectArea: "Artificial Intelligence for Business",
  },
] as const;
const fudanPrograms: CatalogSeedProgram[] = fudanProgramRows.map((row) => ({
  slug: row.slug,
  schoolSlug: "fudan-university",
  citySlug: "shanghai",
  nameEn: row.nameEn,
  degreeLevel: "Master",
  durationYears: 2,
  fieldCategory: "Management",
  subjectArea: row.subjectArea,
  teachingLanguage: row.teachingLanguage,
  englishRequirement: "Unless exempt because the applicant is from an English-speaking country or completed a bachelor's degree there, submit at least one of: TOEFL iBT 90, IELTS 6.5, GMAT 650, or GRE 315.",
  tuitionAmount: row.slug.includes("finance-international-finance") ? 238000 : 288000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "program",
  tuitionText: row.slug.includes("finance-international-finance") ? "RMB 238,000 for the two-year MIF program." : "RMB 288,000 for the two-year AIB program.",
  scholarshipText: "Outstanding applicants may receive scholarships up to full tuition. First-year awards are assessed from background and interview performance; second-year awards consider first-year results and service.",
  applicationUrl: "https://app.fdsm.fudan.edu.cn/admission/application/upec/int",
  applicationNote: row.slug.includes("ai-for-business")
    ? "Applications receive rolling monthly background review from October through March/April. AIB applicants take an online exam followed by an online interview after passing the exam. Results are sent by email within one week; qualified applicants then complete Fudan University's international-student application and pay the RMB 800 registration fee."
    : "Applications receive rolling monthly background review from October through March/April. MIF applicants complete a rolling monthly online interview. Results are sent by email within one week; qualified applicants then complete Fudan University's international-student application and pay the RMB 800 registration fee.",
  status: "active",
  ...sourceFields(fudanSource),
  sourceFieldLineage: {
    nameEn: "official 2027 notice, numbered program list",
    degreeLevel: "official notice title: Master Program",
    durationYears: row.slug.includes("finance-international-finance") ? "current official MIF program page" : "official 2027 AIB program overview",
    teachingLanguage: "official 2027 notice, numbered program list",
    englishRequirement: "current official MIF program page, 2027 international applicant criteria",
    tuitionAmount: "official 2027 School of Management program-fee notice",
    tuitionCurrency: "official 2027 School of Management program-fee notice",
    tuitionPeriod: "official 2027 School of Management program-fee notice",
    tuitionText: "official 2027 School of Management program-fee notice",
    scholarshipText: "official 2027 School of Management scholarship notice",
    applicationUrl: "official 2027 detailed admission procedure image",
    applicationNote: "official 2027 detailed admission procedure image",
  },
  verificationStatus: "verified",
  lastVerifiedAt: fudanAdmissionsSource.fetchedAt,
}));
const fudanIntakes: CatalogSeedProgramIntake[] = fudanPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "Fudan SoM rounds close at 23:59 Beijing time on November 28, 2026; January 23, 2027; March 2, 2027; and a pending fourth round on April 3, 2027. The university-level application follows after interview qualification.",
  applicationRound: "Fudan School of Management 2027 international master's intake",
  status: "open",
  ...sourceFields(fudanAdmissionsSource),
  sourceFieldLineage: {
    intakeYear: "current official MIF program page, 2027 international admissions section",
    deadlineLabel: "current official MIF program page, 2027 review-round table",
    status: "current official MIF program page states the 2027 international intake is open",
  },
}));

const pkuSlug = "peking-university-graduate-en-master-graduate-school-of-shenzhen-020104";
const pkuExisting = allPrograms.find((program) => program.slug === pkuSlug);
if (!pkuExisting) throw new Error(`Missing existing PKU PHBS Economics program: ${pkuSlug}`);
const pkuProgram: CatalogSeedProgram = {
  ...pkuExisting,
  citySlug: "shenzhen",
  nameEn: "Master's in Economics",
  englishRequirement: "TOEFL 90 or above, IELTS 6.5 or above, or native English speaker exemption.",
  tuitionAmount: 64000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 64,000 per year for the 2027 intake",
  applicationNote: "The curriculum is quantitatively focused; the official program page recommends prior Economics and Mathematics coursework.",
  ...sourceFields(pkuSource),
  sourceFieldLineage: {
    nameEn: "official PHBS program page title",
    citySlug: "official PHBS contact address, Shenzhen",
    teachingLanguage: "English-language program page and English proficiency requirement",
    englishRequirement: "Admissions section",
    tuitionAmount: "Fee & Finances section, 2027 intake",
    applicationNote: "Program Curriculum section",
  },
  verificationStatus: "verified",
  lastVerifiedAt: pkuSource.fetchedAt,
};
const pkuIntake: CatalogSeedProgramIntake = {
  programSlug: pkuProgram.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-03-31T15:59:59.000Z",
  deadlineLabel: "Opens mid-October 2026; application deadline March 31, 2027",
  applicationRound: "Peking University HSBC Business School 2027 Master's in Economics",
  status: "open",
  ...sourceFields(pkuSource),
  sourceFieldLineage: {
    intakeYear: "Admissions section",
    deadlineDate: "Admissions section; end-of-day Beijing time normalized to UTC",
    status: "officially published 2027 application route",
  },
};

const westlakeRows = [
  { slug: "westlake-university-doctorate-mathematics", nameEn: "Mathematics", category: "Science", deadline: undefined, joint: true },
  { slug: "westlake-university-doctorate-physics", nameEn: "Physics", category: "Science", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-chemistry", nameEn: "Chemistry", category: "Science", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-quantitative-biology-and-complex-systems", nameEn: "Quantitative Biology and Complex Systems", category: "Science", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-multiscale-astrophysics", nameEn: "Multiscale Astrophysics", category: "Science", deadline: undefined },
  { slug: "westlake-university-doctorate-electronic-and-information-engineering", nameEn: "Electronic Science and Technology", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-materials-science-and-engineering", nameEn: "Materials Science and Engineering", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-information-technology-in-artificial-intelligence", nameEn: "Information Technology in Artificial Intelligence", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-sustainability-science-and-technology", nameEn: "Sustainability Science and Technology", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-biology", nameEn: "Biology", category: "Life Sciences", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-biomedical-sciences", nameEn: "Biomedical Sciences", category: "Medicine", deadline: "2026-10-31T02:00:00.000Z" },
] as const;
const westlakePrograms: CatalogSeedProgram[] = westlakeRows.map((row) => {
  const existing = allPrograms.find((program) => program.slug === row.slug);
  const durationSource = westlakeGeneralDurationSource;
  return {
    ...(existing ?? {}),
    slug: row.slug,
    schoolSlug: "westlake-university",
    citySlug: "hangzhou",
    nameEn: row.nameEn,
    degreeLevel: "Doctorate",
    ...(durationSource ? { durationYears: 5 } : {}),
    fieldCategory: row.category,
    subjectArea: row.nameEn,
    teachingLanguage: "English",
    englishRequirement: "Evidence of English proficiency through English as a first language, official TOEFL/IELTS scores, or an English-medium prior-degree letter.",
    tuitionAmount: row.joint ? 37000 : 40000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: row.joint ? "CNY 37,000/year for the joint university program" : "CNY 40,000/year for Westlake University programs",
    scholarshipText: "The official page states full or partial tuition waivers and fellowships/scholarships exceeding RMB 85,000 per year before tax.",
    hasScholarship: true,
    applicationNote: "Fall 2027 international PhD route. The university-level 2027 doctoral guide explicitly routes non-Chinese nationals into the international application channel and publishes a four-year duration for master's-degree entrants and a five-year duration for bachelor's-degree entrants; durationYears stores the upper published bound. Application requirements include a personal statement of more than 1,500 words and the listed academic documents.",
    status: "active",
    ...sourceFields(westlakeSource),
    sourceFieldLineage: {
      nameEn: "current international-applicant overview and Fall 2027 application table",
      degreeLevel: "current international-applicant overview",
      ...(durationSource ? { durationYears: `${durationSource.id}; upper bound of the published four/five-year conditional duration` } : {}),
      teachingLanguage: "application documents require an English personal statement and English proficiency evidence",
      englishRequirement: "Application Documents section",
      tuitionAmount: "Tuition & Financial Aid table",
      scholarshipText: "Tuition & Financial Aid table",
      applicationNote: durationSource ? `Application Timeline and Application Documents sections; ${durationSource.id}, doctoral duration policy` : "Application Timeline and Application Documents sections",
    },
    verificationStatus: "verified",
    lastVerifiedAt: westlakeSource.fetchedAt,
  };
});
if (westlakePrograms.length !== 11 || new Set(westlakePrograms.map((program) => program.slug)).size !== 11) {
  throw new Error(`Expected 11 unique Westlake Fall 2027 doctoral routes, found ${westlakePrograms.length}.`);
}
const westlakeIntakes: CatalogSeedProgramIntake[] = westlakeRows.map((row) => ({
  programSlug: row.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: row.deadline ? "2026-10-10T02:00:00.000Z" : undefined,
  deadlineDate: row.deadline,
  deadlineLabel: row.deadline
    ? `First-round application closes ${row.deadline.includes("10-31") ? "October 31" : "November 9"}, 2026 at 10:00 Beijing time; second round to be announced.`
    : "Not open in the first round; second-round dates to be announced.",
  applicationRound: "Westlake University Fall 2027 international PhD admission",
  status: row.deadline ? "open" : "closed",
  ...sourceFields(westlakeSource),
  sourceFieldLineage: {
    intakeYear: "Application Timeline heading",
    ...(row.deadline ? { openDate: "Fall 2027 first-round application table; Beijing time normalized to UTC" } : {}),
    ...(row.deadline ? { deadlineDate: "Fall 2027 first-round application table; Beijing time normalized to UTC" } : {}),
    status: row.deadline ? "first round is published and open" : "first round not open; second round to be announced",
  },
}));

const programs = [...fudanPrograms, pkuProgram, ...westlakePrograms].sort((left, right) => left.slug.localeCompare(right.slug));
const programIntakes = [...fudanIntakes, pkuIntake, ...westlakeIntakes].sort((left, right) => left.programSlug.localeCompare(right.programSlug));
const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const schoolSlugs = new Set(programs.map((program) => program.schoolSlug));
const selectedSchools = (release.schools ?? []).filter((row) => schoolSlugs.has(row.slug));
const citySlugs = new Set([
  ...programs.map((program) => program.citySlug).filter((slug): slug is string => Boolean(slug)),
  ...selectedSchools.map((school) => school.citySlug),
]);
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (release.cities ?? []).filter((row) => citySlugs.has(row.slug)),
  schools: selectedSchools,
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 04 validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: { schools: 10, completedThroughWave: 10 },
  scope: {
    schoolSlugs: [...schoolSlugs].sort(),
    refreshedPrograms: programs.length,
    new2027Intakes: programIntakes.length,
    fudanManagementPrograms: fudanPrograms.length,
    pkuPhbsPrograms: 1,
    westlakeDoctoralPrograms: westlakePrograms.length,
  },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "Fudan is limited to the two management master's routes explicitly named for international applicants. Current official program and 2027 admissions pages supply two-year durations, MIF/AIB program tuition, the common international-applicant English-test policy, exact review rounds, the application portal, route-specific assessment steps and the RMB 800 university application fee. The 2027 fee notice is used only for program-level fees and scholarship terms, not its Hong Kong/Macau/Taiwan eligibility rules.",
    "PKU is limited to the PHBS Master's in Economics page; no other PKU route is rolled forward from the 2026 catalog.",
    "Westlake includes the eleven doctoral routes in the current Fall 2027 international applicant table. Mathematics and Multiscale Astrophysics remain draft because their second-round dates are still to be announced.",
    "No applicant or account data is present.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  schools: [...schoolSlugs].sort(),
  refreshedPrograms: programs.length,
  new2027Intakes: programIntakes.length,
  candidatePath,
  validationPath,
  reviewPath,
  candidateSha256,
}, null, 2));
