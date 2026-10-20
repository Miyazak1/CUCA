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
const run = "work/catalog-official/2026-10-20T10-57-01-620Z";
const sourceId = "xjtu-other-scholarships-current";
const expectedSha256 = "a692280eed760c752c74bc11cd12a563fea99d010f126032b6de39bde7e843ef";
const manifest = JSON.parse(await readFile(resolve(root, run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked XJTU current other-scholarships evidence.");
const artifact = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error("XJTU other-scholarships artifact hash mismatch.");
const visibleText = artifact.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [/five Central Asian countries/, /25000RMB for doctor student/, /XJTU Excellent Student Scholarship/]) {
  if (!pattern.test(visibleText)) throw new Error(`Expected XJTU scholarship evidence missing: ${pattern}`);
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-08.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "xi-an-jiaotong-university");
const city = dependency.cities?.find((row) => row.slug === "xian");
if (!school || !city) throw new Error("XJTU dependency rows are missing.");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const common = {
  schoolSlug: school.slug,
  actionLinks: [{ label: "Official XJTU scholarship page", url: source.finalUrl ?? source.url, kind: "official-source" as const }],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
};

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "xjtu-five-central-asian-countries-scholarship-current",
    title: "Xi'an Municipal Government Scholarship for International Students from Five Central Asian Countries",
    nameZh: "西安市政府中亚五国国际学生奖学金",
    type: "Government",
    typeLabel: "Municipal government scholarship",
    providerName: "Xi'an Municipal People's Government",
    fundingLevel: "Full published coverage categories; monetary amounts not stated",
    coverage: "Tuition, accommodation, living allowance, insurance and international travel expenses.",
    applicableDegree: "Undergraduate 1+4 foundation-to-degree route",
    applicableProgram: "XJTU 1+4 undergraduate route for students from Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan and Uzbekistan",
    requirementText: "Applicants must be from one of the five named Central Asian countries and independently satisfy XJTU admission eligibility for the linked 1+4 route.",
    benefitItems: [
      { label: "Tuition", included: true },
      { label: "Accommodation", included: true },
      { label: "Living allowance", included: true },
      { label: "Insurance", included: true },
      { label: "International travel", included: true },
    ],
    eligibilityItems: [
      { label: "Nationality", body: "Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan or Uzbekistan" },
      { label: "Route", body: "XJTU 1+4 undergraduate foundation-to-degree program" },
      { label: "Admission", body: "Must meet XJTU admission eligibility" },
    ],
    applicationRound: "Current maintained policy; use the linked foundation-program notice for the applicable cycle",
    targetRegions: ["Kazakhstan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Uzbekistan"],
    summary: "A municipal scholarship supporting the named five Central Asian countries on XJTU's 1+4 undergraduate pathway.",
    ...common,
    sourceFieldLineage: { title: "current official page item 1", providerName: "item 1 provider statement", coverage: "item 1 coverage sentence", applicableDegree: "item 1 route statement", applicableProgram: "item 1 route and country statement", requirementText: "item 1 eligibility sentence", benefitItems: "item 1 coverage sentence", eligibilityItems: "item 1 country, route and eligibility statements", applicationRound: "current page linked-program instruction", targetRegions: "item 1 named-country list" },
  },
  {
    slug: "xjtu-shaanxi-sanqin-international-student-scholarship-current",
    title: "Shaanxi Sanqin International Student Scholarship",
    nameZh: "陕西省三秦外国留学生奖学金",
    type: "Government",
    typeLabel: "Provincial merit scholarship",
    providerName: "Shaanxi Provincial Government",
    fundingLevel: "One-off degree-level award",
    coverage: "Doctoral RMB 25,000; Master RMB 20,000; Bachelor RMB 13,000 as one-off awards.",
    applicableDegree: "Bachelor; Master; Doctorate",
    applicableProgram: "On-campus self-funded full-time degree study at XJTU",
    amountText: "Doctoral RMB 25,000; Master RMB 20,000; Bachelor RMB 13,000 (one-off)",
    requirementText: "For on-campus self-funded full-time degree students; applicants follow the International Students Affairs Office notice after enrollment.",
    benefitItems: [
      { label: "Bachelor award", included: true, note: "RMB 13,000 one-off" },
      { label: "Master award", included: true, note: "RMB 20,000 one-off" },
      { label: "Doctoral award", included: true, note: "RMB 25,000 one-off" },
    ],
    eligibilityItems: [{ label: "Student status", body: "On-campus, self-funded, full-time XJTU degree student" }],
    applicationRound: "Apply after enrollment under the current International Students Affairs Office notice",
    summary: "A one-off provincial merit award for self-funded full-time XJTU degree students.",
    ...common,
    sourceFieldLineage: { title: "current official page item 2", providerName: "item 2 provider statement", fundingLevel: "item 2 one-off classification", coverage: "item 2 degree-level amounts", applicableDegree: "item 2 degree-level amounts", applicableProgram: "item 2 student-status wording", amountText: "item 2 degree-level amounts", requirementText: "item 2 student-status and application wording", benefitItems: "item 2 degree-level amounts", eligibilityItems: "item 2 student-status wording", applicationRound: "item 2 post-enrollment notice instruction" },
  },
  {
    slug: "xjtu-excellent-student-scholarship-current",
    title: "XJTU Excellent Student Scholarship",
    nameZh: "西安交通大学优秀留学生奖学金",
    type: "University",
    typeLabel: "University merit scholarship",
    providerName: "Xi'an Jiaotong University",
    fundingLevel: "One-off award; amount not published on the current page",
    coverage: "One-off scholarship; the current official page does not publish a monetary amount.",
    applicableDegree: "Full-time degree study",
    applicableProgram: "On-campus self-funded full-time degree study at XJTU",
    requirementText: "For on-campus self-funded full-time degree students; applicants follow the International Students Affairs Office notice after enrollment.",
    benefitItems: [{ label: "One-off merit award", included: true, note: "Amount is not published on the current page" }],
    eligibilityItems: [{ label: "Student status", body: "On-campus, self-funded, full-time XJTU degree student" }],
    applicationRound: "Apply after enrollment under the current International Students Affairs Office notice",
    summary: "XJTU's current one-off merit scholarship for self-funded full-time degree students.",
    ...common,
    sourceFieldLineage: { title: "current official page item 3", providerName: "item 3 provider statement", fundingLevel: "item 3 one-off classification", coverage: "item 3 scholarship wording; amount absent", applicableDegree: "item 3 degree-student wording", applicableProgram: "item 3 student-status wording", requirementText: "item 3 student-status and application wording", benefitItems: "item 3 one-off classification", eligibilityItems: "item 3 student-status wording", applicationRound: "item 3 post-enrollment notice instruction" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 82 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug: school.slug, refreshedScholarships: scholarships.length, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The current page publishes no application calendar; no deadlineDate or year-specific deadline is inferred.",
    "The XJTU Excellent Student Scholarship page publishes no monetary amount.",
  ],
  notes: ["The three maintained policies are not relabeled as 2027-cycle awards; they are represented as current post-enrollment or linked-route policies.", "No applicant or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-82");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 82, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
