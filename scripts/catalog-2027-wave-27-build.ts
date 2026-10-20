import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const id = "ccnu-international-chinese-language-teachers-scholarship-spring-2027";
const expectedSha256 = "81c1936c1ca89e2f7b531a6a86e99f4cd8e2654b02ed3aa494fb75c9915ef4c4";
let item: ManifestSource | undefined;
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("CCNU evidence hash mismatch.");
    item = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!item) throw new Error("Missing locked CCNU Spring 2027 evidence.");
const fields = { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
const verified = { status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: item.fetchedAt, ...fields };
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "wuhan") ?? baseline.cities?.find((row) => row.slug === "wuhan");
const baselineSchool = baseline.schools?.find((row) => row.slug === "central-china-normal-university");
if (!city || !baselineSchool) throw new Error("Missing CCNU dependency rows.");
const school = {
  ...baselineSchool,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  languageOfInstruction: "Chinese and English; Spring 2027 scholarship route is Chinese language study",
  languageRequirement: "Spring 2027 one-semester International Chinese Language Teachers Scholarship requires HSK Level 3 score 180 and an HSKK result.",
  hskRequirement: "HSK Level 3 score 180 plus HSKK for the Spring 2027 one-semester scholarship route.",
  deadlineSummary: "Spring 2027 International Chinese Language Teachers Scholarship applications ran September 17 to October 31, 2026. Other 2027 degree rounds remain unresolved.",
  admissionsUrl: item.url,
  languageTags: [...(baselineSchool.languageTags ?? []), "Chinese language study"],
  campusHighlights: [...(baselineSchool.campusHighlights ?? []), "Spring 2027 International Chinese Language Teachers Scholarship host"],
  ...verified,
  sourceFieldLineage: { ...(baselineSchool.sourceFieldLineage ?? {}), applicationLevel: "official scholarship category", languageOfInstruction: "official scholarship route", languageRequirement: "official HSK and HSKK eligibility", hskRequirement: "official HSK and HSKK eligibility", deadlineSummary: "official Spring 2027 application period", admissionsUrl: "registered official guide URL", languageTags: "official route subject", campusHighlights: "official scholarship-host status" },
};
const programSlug = "central-china-normal-university-international-chinese-language-teachers-scholarship-one-semester-spring-2027";
const program = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study (Spring 2027)",
  nameZh: "华中师范大学2027年春季国际中文教师奖学金一学期研修生",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language",
  subjectArea: "Chinese language education",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 and an HSKK result.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full scholarship covering tuition, accommodation, living allowance and comprehensive medical insurance; the page does not publish monetary allowance amounts.",
  applicationUrl: item.url,
  applicationNote: "Applicants must be non-Chinese citizens, normally aged 16-35 as of September 1, 2026, healthy, academically sound and committed to Chinese-language education. In-service teachers may be up to 45. The route normally excludes applicants with X1/X2 visas and applicants who received the same scholarship type within the prior three years.",
  hasScholarship: true,
  badgeText: "March 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "International Chinese Language Teachers Scholarship",
  ...verified,
  sourceFieldLineage: { nameEn: "official scholarship category and intake", nameZh: "official guide title and category", durationMonths: "official five-month funding term", subjectArea: "official scholarship purpose", teachingLanguage: "official HSK/HSKK route requirements", hskRequirement: "official HSK/HSKK threshold", tuitionText: "official full-scholarship tuition coverage", scholarshipText: "official coverage section", applicationNote: "official eligibility and other-conditions sections" },
};
const intake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-09-16T16:00:00Z",
  deadlineDate: "2026-10-31T15:59:59Z",
  deadlineLabel: "Applications ran September 17 to October 31, 2026 for March 2027 entry.",
  applicationRound: "March 2027 one-semester scholarship entry",
  status: "open" as const,
  ...fields,
  sourceFieldLineage: { intakeTerm: "official March 2027 entry", intakeYear: "official March 2027 entry", openDate: "official application period", deadlineDate: "official application period", deadlineLabel: "official application period", status: "deadline compared with capturedAt" },
};
const scholarship = {
  slug: "ccnu-international-chinese-language-teachers-scholarship-spring-2027",
  title: "CCNU International Chinese Language Teachers Scholarship - Spring 2027",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "Center for Language Education and Cooperation / Central China Normal University",
  schoolSlug: school.slug,
  programSlug,
  fundingLevel: "Full",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.",
  applicableDegree: "One-semester non-degree study",
  deadlineDate: "2026-10-31",
  deadlineLabel: "October 31, 2026 for March 2027 entry.",
  requirementText: "HSK Level 3 score 180 plus HSKK; applicants normally aged 16-35, with in-service Chinese teachers eligible up to age 45.",
  actionLinks: [{ label: "Official CCNU Spring 2027 scholarship guide", url: item.url, kind: "official-source" }],
  ...verified,
  sourceFieldLineage: { title: "official guide title and category", fundingLevel: "official coverage list", coverage: "official coverage list", applicableDegree: "official one-semester category", deadlineDate: "official application period", deadlineLabel: "official application period", requirementText: "official eligibility and HSK/HSKK threshold" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: item.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 27 validation failed:\n${validation.errors.join("\n")}`);
const review = { version: 1, status: "unreviewed_draft", generatedAt: item.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: 1, sourceSnapshots: 1 }, evidence: [{ id: item.id, label: item.label, url: item.url, fetchedAt: item.fetchedAt, sha256: item.sha256 }], unresolved: ["The guide lists living allowance coverage but no monetary amount; amountText remains absent.", "The route is a Spring 2027 non-degree scholarship and does not establish general 2027 degree admission dates."], notes: ["No applicant, account, passport, payment or other personal data is included."] };
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-27.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-27.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-27.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 1, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
