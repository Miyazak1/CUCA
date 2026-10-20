import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "work/catalog-official/2026-10-20-xtu-silk-road-pdf-2026-2027";
const sourceId = "xtu-cgs-silk-road-scholarship-pdf-2026-2027";
const expectedSha256 = "5fee8082d3182c193a434f4182b672b2b945333a2d5a5cd92ca9d90dc5e74cc0";
const manifest = JSON.parse(await readFile(resolve(root, run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Xiangtan University 2026/2027 Silk Road scholarship evidence.");
const artifact = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error("XTU Silk Road scholarship artifact hash mismatch.");
if (!artifact.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("XTU Silk Road scholarship evidence is not a PDF.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "xiangtan-university");
const city = dependency.cities?.find((row) => row.slug === "xiangtan");
if (!school || !city) throw new Error("Xiangtan University dependency rows are missing.");
const sourceUrl = source.finalUrl ?? source.url;
const scholarship: CatalogSeedScholarship = {
  slug: "xtu-cgs-silk-road-scholarship-2026-2027",
  schoolSlug: school.slug,
  title: "Xiangtan University 2026/2027 Chinese Government Scholarship - Silk Road Program",
  nameZh: "湘潭大学2026/2027学年中国政府奖学金丝绸之路项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship - Silk Road Program",
  providerNameEn: "China Scholarship Council / Xiangtan University",
  providerLocation: "Xiangtan, Hunan, China",
  fundingLevel: "Full",
  coverage: "Tuition, on-campus accommodation, medical insurance and monthly stipend.",
  applicableDegree: "Master, Doctoral",
  applicableProgram: "Law; Intellectual Property Law; Theoretical Economics; Public Management; Marxist Theory",
  amountText: "Master CNY 3,000/month; Doctoral CNY 3,500/month, plus tuition, on-campus accommodation and medical insurance.",
  requirementText: "Applicants must be nationals of one of the ten published African countries, satisfy the degree and age limits, meet the route language threshold and any additional program-specific requirements.",
  deadlineDate: "2026-05-20",
  deadlineLabel: "May 20, 2026 (closed)",
  applicationRound: "2026/2027 academic-year Silk Road Program",
  targetCountries: ["Uganda", "Kenya", "Tanzania", "Nigeria", "South Africa", "Zimbabwe", "Zambia", "Morocco", "Ethiopia", "Egypt"],
  benefitItems: [
    { label: "Tuition", included: true },
    { label: "On-campus accommodation", included: true },
    { label: "Medical insurance", included: true },
    { label: "Master stipend", included: true, note: "CNY 3,000/month" },
    { label: "Doctoral stipend", included: true, note: "CNY 3,500/month" },
  ],
  eligibilityItems: [
    { label: "Nationality", value: "Uganda, Kenya, Tanzania, Nigeria, South Africa, Zimbabwe, Zambia, Morocco, Ethiopia or Egypt" },
    { label: "Master", value: "Bachelor's degree and below age 35" },
    { label: "Doctoral", value: "Master's degree and below age 40" },
    { label: "Chinese-taught route", value: "HSK Level 4 or above; published exemptions may apply" },
    { label: "English-taught route", value: "IELTS 6.0 or TOEFL 80 or above; published exemptions may apply" },
  ],
  applicationMaterials: [
    { label: "Passport information page" },
    { label: "Highest diploma and complete academic transcripts", value: "Notarized Chinese or English translations are required when applicable" },
    { label: "Language qualification certificate" },
    { label: "Study plan", value: "More than 1,000 Chinese characters or English words; doctoral plan signed by the intended XTU supervisor" },
    { label: "Two professor or associate-professor recommendations" },
    { label: "Foreigner Physical Examination Form and blood-test report" },
    { label: "Non-criminal record" },
    { label: "Self-introduction video", value: "Under 50 MB" },
    { label: "XTU supervisor recommendation form", value: "If available" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Apply in the XTU International Students Service Platform and select the Silk Road Program" },
    { label: "Step 2", value: "Apply in the CSC system as Type B using Xiangtan University agency number 10530" },
  ],
  actionLinks: [
    { label: "Official scholarship brochure", url: sourceUrl, kind: "official-source" },
    { label: "XTU application system", url: "https://xtu.at0086.cn/StuApplication/Login.aspx", kind: "official-application" },
    { label: "CSC application system", url: "https://studyinchina.csc.edu.cn/#/register", kind: "official-application" },
  ],
  summary: "Full 2026/2027 academic-year Silk Road scholarship for specified XTU master's and doctoral routes; the published application deadline has closed.",
  sortOrder: 20,
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    title: "PDF title, page 1",
    fundingLevel: "Scholarship Coverage, page 2",
    coverage: "Scholarship Coverage, page 2",
    applicableDegree: "Supporting Categories table, page 1",
    applicableProgram: "Supporting Categories table, page 1",
    amountText: "Scholarship Coverage, page 2",
    requirementText: "Eligibility, page 2",
    deadlineDate: "Application time, page 1",
    targetCountries: "published country list, page 2",
    eligibilityItems: "Eligibility, pages 2-3",
    applicationMaterials: "Application Documents, pages 3-4",
    applicationSteps: "Application Procedure, pages 2-3",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 83 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug: school.slug, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The brochure is for the 2026/2027 academic-year scholarship and does not establish a Fall 2027 intake.",
    "No additional monetary benefits beyond the published stipends and full coverage categories are inferred.",
  ],
  notes: [
    "The May 20, 2026 application deadline is explicitly retained as closed; the scholarship is not relabeled as a new 2027 application round.",
    "No applicant or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-83");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 83, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: 1, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
