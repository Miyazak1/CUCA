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
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-19.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-19.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-19.review.json");
const expected: Record<string, string> = {
  "bfsu-international-chinese-language-teachers-scholarship-2026-2027": "076811329c4922ed1d1177452da5deff36c6d52dca39f2e2b3b54f56cb1ebc8c",
  "bfsu-international-chinese-language-teachers-scholarship-coverage-2026": "90b9e757e4324c1decc6af0b5dfd8218c62647db4e3493de81aabb91b1acbf15",
  "bfsu-international-chinese-language-teachers-scholarship-materials-2026": "ee70277c3e52064ac7feaa7736320774ad4aec9a2c83e9ea0b1f57338bbaf322",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 19 evidence: ${missing.join(", ")}`);
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === "beijing-foreign-studies-university");
const city = (base.cities ?? []).find((row) => row.slug === "beijing");
if (!baseSchool || !city) throw new Error("Wave 19 BFSU dependencies are missing from the reviewed 100-school release.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const school = {
  ...baseSchool,
  languageOfInstruction: "Chinese for the published January and March 2027 scholarship routes.",
  languageRequirement: "Route-specific HSK/HSKK rules apply: the one-semester route requires HSK 3 score 180 plus HSKK; the four-week route requires an HSK score but publishes no minimum.",
  hskRequirement: "One-semester: HSK Level 3 score 180 plus HSKK. Four-week: an HSK score is required, with no published minimum.",
  deadlineSummary: "The 2026 International Chinese Language Teachers Scholarship page publishes a September 15, 2026 deadline for a January 2027 four-week route and a December 30, 2026 deadline for a March 2027 one-semester route. It does not establish general Fall 2027 degree deadlines.",
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields("bfsu-international-chinese-language-teachers-scholarship-2026-2027"),
  sourceFieldLineage: { ...(baseSchool.sourceFieldLineage ?? {}), languageOfInstruction: "published scholarship-program identities", languageRequirement: "official category qualifications", hskRequirement: "official category qualifications", deadlineSummary: "official scholarship deadline and commencement table" },
};

const semester: CatalogSeedProgram = {
  slug: "beijing-foreign-studies-university-chinese-study-one-semester-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study (Spring 2027)",
  nameZh: "北京外国语大学国际中文教师奖学金一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: "International Chinese language education; Chinese language and literature",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 with at least 180 and an HSKK score are required.",
  scholarshipText: "Tuition, on-campus accommodation, comprehensive medical insurance and CNY 2,500/month living allowance; approved off-campus recipients receive CNY 700/month accommodation allowance.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  applicationUrl: "https://study.bfsu.edu.cn/",
  applicationNote: "Maximum scholarship duration is five months. X1/X2 visa holders are not eligible. Submit both the scholarship application and BFSU online application with the official required materials.",
  hasScholarship: true,
  badgeText: "March 2027 scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("bfsu-international-chinese-language-teachers-scholarship-2026-2027").fetchedAt,
  ...fields("bfsu-international-chinese-language-teachers-scholarship-2026-2027"),
  sourceFieldLineage: { nameEn: "official category and commencement table", degreeLevel: "one-semester study category", durationMonths: "official maximum scholarship duration of five months", subjectArea: "official category qualifications", teachingLanguage: "program identity", hskRequirement: "official category qualifications", tuitionText: "official coverage appendix", scholarshipText: "official coverage appendix", applicationNote: "official category, procedure and materials appendix" },
};
const fourWeek: CatalogSeedProgram = {
  slug: "beijing-foreign-studies-university-chinese-study-four-week-winter-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship - Four-Week Study (Winter 2027)",
  nameZh: "北京外国语大学国际中文教师奖学金四周研修项目（2027年冬季）",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: "Group-based Chinese language study",
  teachingLanguage: "Chinese",
  hskRequirement: "An HSK score is required; the official page does not state a minimum level or score for this route.",
  scholarshipText: "Tuition, on-campus accommodation and comprehensive medical insurance; the coverage appendix expressly excludes four-week students from the living allowance.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  applicationUrl: "https://study.bfsu.edu.cn/",
  applicationNote: "Maximum scholarship duration is four weeks. X1/X2 visa holders are not eligible. A recommending institution organizes a group of 10-15 participants and agrees a detailed study plan with BFSU before CLEC review.",
  hasScholarship: true,
  badgeText: "January 2027 scholarship route",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source("bfsu-international-chinese-language-teachers-scholarship-2026-2027").fetchedAt,
  ...fields("bfsu-international-chinese-language-teachers-scholarship-2026-2027"),
  sourceFieldLineage: { nameEn: "official category and commencement table", degreeLevel: "four-week study category", subjectArea: "official group-application description", teachingLanguage: "program identity", hskRequirement: "official category qualifications", tuitionText: "official coverage appendix", scholarshipText: "official coverage appendix", applicationNote: "official category and application procedure" },
};
const programs = [semester, fourWeek];
const programIntakes: CatalogSeedProgramIntake[] = [
  { programSlug: semester.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-12-30T00:00:00Z", deadlineLabel: "Application deadline: December 30, 2026 for March 2027 commencement. The page does not state a deadline time.", applicationRound: "March 2027 one-semester scholarship route", status: "open", ...fields("bfsu-international-chinese-language-teachers-scholarship-2026-2027"), sourceFieldLineage: { intakeTerm: "March 2027 commencement", intakeYear: "March 2027 commencement", deadlineDate: "official deadline table", deadlineLabel: "official deadline table", applicationRound: "official category and deadline table", status: "deadline compared with capturedAt" } },
  { programSlug: fourWeek.slug, intakeTerm: "Winter", intakeYear: 2027, deadlineDate: "2026-09-15T00:00:00Z", deadlineLabel: "Application deadline: September 15, 2026 for January 2027 commencement. The page does not state a deadline time.", applicationRound: "January 2027 four-week scholarship route", status: "closed", ...fields("bfsu-international-chinese-language-teachers-scholarship-2026-2027"), sourceFieldLineage: { intakeTerm: "January 2027 commencement", intakeYear: "January 2027 commencement", deadlineDate: "official deadline table", deadlineLabel: "official deadline table", applicationRound: "official category and deadline table", status: "deadline compared with capturedAt" } },
];
const scholarship: CatalogSeedScholarship = {
  slug: "beijing-foreign-studies-university-international-chinese-language-teachers-scholarship-spring-2027",
  title: "BFSU International Chinese Language Teachers Scholarship - 2027 Routes",
  nameZh: "北京外国语大学国际中文教师奖学金（2027年入学批次）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心 / 北京外国语大学",
  providerNameEn: "Center for Language Education and Cooperation / Beijing Foreign Studies University",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition, accommodation and comprehensive medical insurance; the one-semester route also includes a living allowance, while the four-week route does not.",
  applicableDegree: "Non-degree",
  applicableProgram: "March 2027 one-semester study and January 2027 four-week study routes",
  amountText: "One-semester route: CNY 2,500/month living allowance; approved off-campus accommodation allowance CNY 700/month. Four-week route: no living allowance; medical-insurance premium standard CNY 160/person.",
  deadlineDate: "2026-12-30",
  deadlineLabel: "December 30, 2026 for the March 2027 one-semester route; the January 2027 four-week route closed September 15, 2026",
  applicationRound: "January and March 2027",
  requirementText: "Applicants must meet the common scholarship eligibility rules and the route-specific HSK/HSKK, visa and group-application requirements published by BFSU.",
  benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true, note: "Free on campus or CNY 700/month with approval to live off campus" }, { label: "Comprehensive medical insurance", included: true }, { label: "Living allowance", included: true, note: "CNY 2,500/month for one-semester students; excluded for four-week students" }],
  applicationMaterials: [{ label: "Passport photo page" }, { label: "Valid HSK/HSKK score reports" }, { label: "Reference letter from the recommending institution" }, { label: "BFSU scholarship application form" }, { label: "Signed letter of commitment" }, { label: "Signed custody release form" }, { label: "Foreigner Physical Examination Form" }],
  applicationSteps: [{ label: "Step 1", body: "Apply through the International Chinese Language Teachers Scholarship system and select the recommending and host institutions." }, { label: "Step 2", body: "Complete the separate BFSU International Student Service System application." }, { label: "Step 3", body: "Track the review and, if selected, confirm with BFSU and register according to the admission letter." }],
  actionLinks: [{ label: "Official BFSU source", url: source("bfsu-international-chinese-language-teachers-scholarship-2026-2027").url, kind: "official-source" }, { label: "BFSU application system", url: "https://study.bfsu.edu.cn/", kind: "official-application" }],
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields("bfsu-international-chinese-language-teachers-scholarship-2026-2027"),
  sourceFieldLineage: { title: "official scholarship page and 2027 commencement table", fundingLevel: "official coverage appendix", coverage: "official coverage appendix", applicableDegree: "official route categories", applicableProgram: "official deadline and commencement table", amountText: "official coverage appendix", deadlineDate: "official deadline table", requirementText: "official eligibility and category rules", applicationMaterials: "official materials appendix", applicationSteps: "official application procedure" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 19 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 2, new2027Intakes: 2, refreshedScholarships: 1, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: ["The source establishes only the January and March 2027 scholarship routes; no general Fall 2027 degree guide is inferred.", "The four-week route requires an HSK score but publishes no minimum level or score.", "Exact course placement and admission dates remain subject to the admission letter."],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: 2, programIntakes: 2, scholarships: 1, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
