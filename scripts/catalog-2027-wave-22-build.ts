import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedProgramIntake, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const expected: Record<string, string> = {
  "tjnu-international-chinese-language-teachers-scholarship-page-2026-2027": "22b739cb550941c3d63dad1bb3131e07c249467889a1dd408ba64cdcafdc8386",
  "tjnu-international-chinese-language-teachers-scholarship-pdf-2026-2027": "0fb4b65601e2854ea28accc52756490fa886759b7fe9f0e6cfd42ebe0bfac679",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 22 evidence: ${missing.join(", ")}`);
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === "tianjin-normal-university");
const city = (base.cities ?? []).find((row) => row.slug === "tianjin");
if (!baseSchool || !city) throw new Error("Wave 22 Tianjin Normal University dependencies are missing.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => { const item = source(id); return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt }; };
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const pdfId = "tjnu-international-chinese-language-teachers-scholarship-pdf-2026-2027";
const pageId = "tjnu-international-chinese-language-teachers-scholarship-page-2026-2027";
const school = {
  ...baseSchool,
  deadlineSummary: "The 2026 International Chinese Language Teachers Scholarship guide publishes an October 31, 2026 deadline for its March 2027 one-semester International Chinese Language Education or Chinese Language and Literature route. It does not establish general Fall 2027 degree deadlines.",
  verificationStatus: "verified" as const,
  lastVerifiedAt: verifiedAt,
  ...fields(pdfId),
  sourceFieldLineage: { ...(baseSchool.sourceFieldLineage ?? {}), deadlineSummary: "official scholarship deadline table and route qualifications" },
};
const program: CatalogSeedProgram = {
  slug: "tianjin-normal-university-international-chinese-language-education-one-semester-spring-2027",
  schoolSlug: school.slug, citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study (Spring 2027)",
  nameZh: "天津师范大学国际中文教师奖学金一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree", durationMonths: 5, fieldCategory: "Chinese language",
  subjectArea: "International Chinese Language Education or Chinese Language and Literature", teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 with at least 180 and an HSKK score are required.",
  scholarshipText: "The official TJNU guide confirms scholarship eligibility for this route but does not restate the monetary coverage package; no amount is inferred.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Applicants must satisfy the common scholarship eligibility rules. In principle, applicants who received a similar one-semester or one-year scholarship within the previous three years are ineligible. Submit the published identity, language, recommendation, police-clearance and physical-examination materials.",
  hasScholarship: true, badgeText: "March 2027 scholarship route", displayGroup: "Non-degree", displayGroupLabel: "Chinese language programs",
  status: "active", verificationStatus: "verified", lastVerifiedAt: source(pdfId).fetchedAt, ...fields(pdfId),
  sourceFieldLineage: { nameEn: "official route category and March 2027 commencement", durationMonths: "official maximum duration", subjectArea: "official route qualifications", hskRequirement: "official route qualifications", scholarshipText: "guide confirms scholarship category but does not restate coverage", applicationNote: "official eligibility, miscellaneous and materials sections" },
};
const programIntake: CatalogSeedProgramIntake = {
  programSlug: program.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-10-31T00:00:00Z",
  deadlineLabel: "Application deadline: October 31, 2026 for March 2027 commencement. The page does not state a deadline time.",
  applicationRound: "March 2027 one-semester scholarship route", status: "open", ...fields(pdfId),
  sourceFieldLineage: { intakeTerm: "official March 2027 commencement", intakeYear: "official March 2027 commencement", deadlineDate: "official deadline table", deadlineLabel: "official deadline table", status: "deadline compared with capturedAt" },
};
const scholarship: CatalogSeedScholarship = {
  slug: "tianjin-normal-university-international-chinese-language-teachers-scholarship-spring-2027",
  title: "Tianjin Normal University International Chinese Language Teachers Scholarship - Spring 2027",
  nameZh: "天津师范大学国际中文教师奖学金（2027年春季）", type: "government", typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心 / 天津师范大学", providerNameEn: "Center for Language Education and Cooperation / Tianjin Normal University",
  schoolSlug: school.slug, programSlug: program.slug, applicableDegree: "Non-degree",
  applicableProgram: "March 2027 one-semester International Chinese Language Education or Chinese Language and Literature route",
  deadlineDate: "2026-10-31", deadlineLabel: "October 31, 2026 for March 2027 commencement", applicationRound: "March 2027",
  requirementText: "HSK Level 3 with at least 180 and an HSKK score. Applicants must also meet the common scholarship eligibility and three-year prior-award rule published by TJNU.",
  applicationMaterials: [{ label: "Passport photo page" }, { label: "Valid HSK and HSKK score reports" }, { label: "Reference letter from the head of the recommending institution" }, { label: "Police-clearance certificate" }, { label: "Foreigner Physical Examination Form" }, { label: "Guardian documents for applicants under 18" }],
  applicationSteps: [{ label: "Step 1", body: "Apply through the scholarship system and select Tianjin Normal University." }, { label: "Step 2", body: "Upload the required materials and track the university and expert-panel review." }, { label: "Step 3", body: "If selected, confirm with TJNU and register according to the admission letter." }],
  actionLinks: [{ label: "Official TJNU source page", url: source(pageId).url, kind: "official-source" }, { label: "Official TJNU guide PDF", url: source(pdfId).url, kind: "official-source" }, { label: "Scholarship application system", url: "https://www.chinese.cn/", kind: "official-application" }],
  status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt, ...fields(pdfId),
  sourceFieldLineage: { title: "official scholarship guide and March 2027 route", applicableDegree: "official one-semester category", applicableProgram: "official route qualifications", deadlineDate: "official deadline table", requirementText: "official eligibility and category qualifications", applicationMaterials: "official materials appendix", applicationSteps: "official application procedure" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs: [program], programIntakes: [programIntake], scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 22 validation failed:\n${validation.errors.join("\n")}`);
const review = { version: 1, status: "unreviewed_draft", generatedAt: verifiedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: 1, sourceSnapshots: evidence.size }, evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)), unresolved: ["The source establishes only the March 2027 one-semester scholarship route; general Fall 2027 degree admissions are not inferred.", "The official TJNU guide does not restate the scholarship's monetary coverage package, so fundingLevel, coverage, amountText and benefitItems remain absent."], notes: ["No applicant, account, passport, payment or other personal data is included."] };
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-22.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-22.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-22.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { schools: 1, programs: 1, programIntakes: 1, scholarships: 1, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
