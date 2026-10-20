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
const sourceId = "csu-international-chinese-language-teachers-scholarship-spring-2027";
const expectedSha256 = "a6d11474e430ac3c73486cd95038a1822df90902dd952a1a2b68239019d1f427";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const match = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!match) continue;
    const bytes = await readFile(resolve(runRoot, match.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== match.sha256) throw new Error("CSU Wave 54 evidence hash mismatch.");
    source = match;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}

if (!source) throw new Error("Missing locked CSU Wave 54 evidence.");

const wave16 = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-16.draft.json"), "utf8")) as CatalogSeedBundle;
const school = wave16.schools?.find((row) => row.slug === "central-south-university");
const city = wave16.cities?.find((row) => row.slug === "changsha");
const priorProgram = wave16.programs?.find((row) => row.slug === "central-south-university-iclts-one-semester-chinese-language-spring-2027");
const priorIntake = wave16.programIntakes?.find((row) => row.programSlug === priorProgram?.slug && row.intakeTerm === "Spring" && row.intakeYear === 2027);
if (!school || !city || !priorProgram || !priorIntake) throw new Error("Wave 54 CSU dependencies are incomplete.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const program: CatalogSeedProgram = {
  ...priorProgram,
  durationMonths: 5,
  hskRequirement: "HSK Level 3 with a minimum score of 180 and an HSKK test score are required.",
  tuitionText: "Tuition is fully covered by the International Chinese Language Teachers Scholarship; the official Spring 2027 guide publishes no self-funded tuition amount for this route.",
  scholarshipText: "Full tuition and on-campus accommodation, CNY 2,500 monthly living allowance, and CNY 400 comprehensive medical insurance for the one-semester study period.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Applicants must be non-Chinese citizens, be in good physical and mental health, be committed to Chinese-language education or related work, and normally be age 16-35 as of September 1, 2026 (up to 45 for in-service Chinese-language teachers). Apply in both the CSU and official scholarship systems and send both application numbers to CSU. The page requires an application fee after preliminary review but does not publish its amount.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official page title and Scholarship Qualifications section",
    nameZh: "retained Chinese rendering of the official English route title",
    degreeLevel: "Scholarship Qualifications: one-semester Chinese Language Study",
    durationMonths: "Scholarship Qualifications: maximum of five months",
    subjectArea: "Scholarship Qualifications: Chinese Language Study",
    teachingLanguage: "Chinese-language program identity and HSK/HSKK conditions",
    hskRequirement: "Scholarship Qualifications",
    tuitionText: "Scholarship Coverage and Criteria; no self-funded amount is stated",
    scholarshipText: "Scholarship Coverage and Criteria",
    applicationUrl: "registered official Spring 2027 guide",
    applicationNote: "Eligibility and Application Procedures sections",
  },
};

const intake: CatalogSeedProgramIntake = {
  ...priorIntake,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "Student applications must be completed before October 31, 2026 (Beijing Time); recommending and host institutions must complete review before November 10, 2026.",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship - one-semester Chinese language study",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "Scholarship Qualifications: commences in March 2027",
    intakeYear: "official Spring 2027 page title and March 2027 commencement",
    deadlineDate: "Application Deadlines; 2026 is derived from the September 24, 2026 publication date and March 2027 cycle",
    deadlineLabel: "Application Deadlines",
    applicationRound: "official page title and Scholarship Qualifications",
    status: "deadline compared with capturedAt",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "central-south-university-international-chinese-language-teachers-scholarship-spring-2027",
  title: "Central South University International Chinese Language Teachers Scholarship - Spring 2027",
  nameZh: "中南大学2027年春季国际中文教师奖学金",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "Center for Language Education and Cooperation / Central South University",
  schoolSlug: school.slug,
  programSlug: program.slug,
  fundingLevel: "Full",
  coverage: "Tuition, on-campus accommodation, living allowance and comprehensive medical insurance.",
  applicableDegree: "One-semester non-degree study",
  applicableProgram: "Chinese Language Study beginning in March 2027",
  amountText: "CNY 2,500/month living allowance and CNY 400 comprehensive medical insurance for the one-semester study period.",
  deadlineDate: "2026-10-31",
  deadlineLabel: "Student applications before October 31, 2026; institutional review before November 10, 2026.",
  applicationRound: "Spring 2027",
  requirementText: "Non-Chinese citizens age 16-35 as of September 1, 2026 (up to 45 for in-service Chinese-language teachers), HSK Level 3 score 180 or above, an HSKK score, and no similar scholarship received within the prior three years.",
  actionLinks: [{ label: "Official CSU Spring 2027 scholarship guide", url: source.finalUrl ?? source.url, kind: "official-source" }],
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official page title",
    fundingLevel: "Scholarship Coverage and Criteria",
    coverage: "Scholarship Coverage and Criteria",
    applicableDegree: "Scholarship Qualifications",
    applicableProgram: "Scholarship Qualifications",
    amountText: "Scholarship Coverage and Criteria",
    deadlineDate: "Application Deadlines; year derived from the publication date and Spring 2027 cycle",
    requirementText: "Eligibility and Scholarship Qualifications",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 54 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, replacement2027Intakes: 1, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The guide requires an application fee after preliminary review but does not publish its amount; no fee amount is asserted.",
    "The October 31 and November 10 deadlines omit a printed year. They are normalized to 2026 from the September 24, 2026 publication date and the explicit March 2027 commencement and remain documented as derived.",
    "This scholarship route does not establish CSU's general Fall 2027 undergraduate, master or doctoral admission cycle.",
  ],
  notes: [
    "Wave 54 replaces the same CSU Spring 2027 program and intake evidence previously carried from the 2026 umbrella guide and adds a separately structured 2027 scholarship record.",
    "No applicant, account, passport, payment, contact-person or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-54");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 54,
  candidateSha256,
  counts: { cities: 1, schools: 1, programs: 1, programIntakes: 1, scholarships: 1, sourceSnapshots: 1 },
  publicationAuthorized: false,
}, null, 2));
