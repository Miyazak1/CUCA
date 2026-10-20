import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
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
const runRoot = resolve(root, "work/catalog-official/full-refresh-2026-10-20");
const expectedHashes = new Map([
  ["zjsu-general-scholarship-current", "ebedbf67ec84c06f00c5c6beb2ad0fea15f104ed83d5b393a7db2499bdc322a7"],
  ["zjsu-president-scholarship-current", "93936773285294a33e6e6ff7bd7b3155d1e15832a95dcb079333b01f1ec75a23"],
  ["zjsu-zhejiang-provincial-government-scholarship-current", "1b33721ea88e87148ac3b2aa7ab2c32e991a745f5bf08046038a5a5a6730682f"],
]);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const sources = new Map<string, ManifestSource>();
for (const [id, expectedSha256] of expectedHashes) {
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked ZJGSU scholarship evidence: ${id}.`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`ZJGSU scholarship evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-23.draft.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "zhejiang-gongshang-university";
const school = dependency.schools?.find((row) => row.slug === schoolSlug);
const city = dependency.cities?.find((row) => row.slug === "hangzhou");
if (!school || !city) throw new Error("Wave 79 ZJGSU school or authoritative Hangzhou dependency row is missing.");

const fields = (id: string) => {
  const source = sources.get(id)!;
  return {
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    lastVerifiedAt: source.fetchedAt,
  };
};

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "official-zjsu-general-scholarship",
    schoolSlug,
    title: "Zhejiang Gongshang University General Scholarship for International Students",
    nameZh: "浙江工商大学国际学生奖学金（普通奖学金）",
    type: "university",
    typeLabel: "University scholarship",
    providerName: "浙江工商大学",
    providerNameEn: "Zhejiang Gongshang University",
    providerLocation: "Hangzhou, Zhejiang, China",
    fundingLevel: "Amount not published",
    coverage: "Separate awards for new and current international degree students. The current page directs applicants to the International Education Admissions Office for the award amount.",
    applicableDegree: "Undergraduate, Master, Doctoral",
    applicableProgram: "New or current international degree students at ZJGSU.",
    deadlineLabel: "No fixed application deadline is published; admitted recipients are normally notified in July or August of the current year.",
    benefitItems: [
      { label: "New degree student award", included: true, note: "Amount is not published; contact the International Education Admissions Office" },
      { label: "Current degree student award", included: true, note: "Amount is not published; contact the International Education Admissions Office" },
    ],
    eligibilityItems: [
      { label: "Applicant type", value: "Outstanding new or current international undergraduate, master's or doctoral student" },
      { label: "Current students", value: "No overdue tuition or accommodation fees, attendance at least 80%, passing first-attempt final grades and good overall academic performance" },
      { label: "New students", value: "Good prior academic performance or other outstanding performance, with no negative record" },
    ],
    applicationMaterials: [
      { label: "New students", value: "Admission form, degree and transcript documents, personal statement, language proof, recommendations where applicable, resume, physical examination, passport and other requested materials" },
      { label: "Current students", value: "Application form, personal statement, supporting awards or academic achievements, passport and other requested materials" },
    ],
    applicationSteps: [
      { label: "New students", value: "Complete the major application, then select the ZJGSU General Scholarship in the official system" },
      { label: "Current students", value: "Submit the published materials to the relevant college within its specified time" },
    ],
    actionLinks: [{ label: "Official ZJGSU scholarship page", url: fields("zjsu-general-scholarship-current").sourceUrl, kind: "official-source" }],
    summary: "Current ZJGSU general scholarship route; superseded monetary tiers are intentionally omitted because the refreshed official page no longer publishes them.",
    status: "active",
    verificationStatus: "verified",
    ...fields("zjsu-general-scholarship-current"),
    sourceFieldLineage: {
      title: "official page title",
      coverage: "section III award table",
      applicableDegree: "section II qualified applicants",
      deadlineLabel: "section VI result timing; no application deadline published",
      eligibilityItems: "section IV eligibility",
      applicationMaterials: "section V application procedures",
      applicationSteps: "section V application procedures",
    },
  },
  {
    slug: "official-zjsu-president-scholarship",
    schoolSlug,
    title: "Zhejiang Gongshang University President Scholarship for International Students",
    nameZh: "浙江工商大学校长奖学金",
    type: "university",
    typeLabel: "President scholarship",
    providerName: "浙江工商大学",
    providerNameEn: "Zhejiang Gongshang University",
    providerLocation: "Hangzhou, Zhejiang, China",
    fundingLevel: "Amount not published",
    coverage: "A-level and B-level awards for new international master's and doctoral applicants. The current page directs applicants to the International Education Admissions Office for award amounts.",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "New international master's or doctoral students applying to ZJGSU.",
    deadlineLabel: "No fixed application deadline is published; admitted recipients are normally notified in July or August of the current year.",
    benefitItems: [
      { label: "A-level award", included: true, note: "Amount and components are not published on the current page" },
      { label: "B-level award", included: true, note: "Amount and components are not published on the current page" },
      { label: "Accommodation benchmark", included: false, note: "The page gives CNY 7,800/year as the double-room benchmark but does not state that the award covers it" },
    ],
    eligibilityItems: [
      { label: "Applicant type", value: "New international master's or doctoral applicant" },
      { label: "Academic background", value: "Relevant bachelor's degree for master's applicants or master's degree for doctoral applicants; prior average generally above 80" },
      { label: "Priority", value: "Priority may be given to high-quality students from Belt and Road countries and other published cooperation priorities" },
      { label: "Other funding", value: "Must not receive another scholarship" },
    ],
    applicationMaterials: [{ label: "Published documents", value: "Admission form, degree and transcripts, personal statement, language proof, two recommendations, resume, physical examination, non-criminal record and other requested materials" }],
    applicationSteps: [
      { label: "Step 1", value: "Complete the ZJGSU major application" },
      { label: "Step 2", value: "Select ZJSU President Scholarship in the official system" },
      { label: "Step 3", value: "Recipients undergo annual review from the second academic year" },
    ],
    actionLinks: [{ label: "Official ZJGSU President Scholarship page", url: fields("zjsu-president-scholarship-current").sourceUrl, kind: "official-source" }],
    summary: "Current ZJGSU President Scholarship route for new master's and doctoral applicants; outdated stipend and coverage claims are excluded.",
    status: "active",
    verificationStatus: "verified",
    ...fields("zjsu-president-scholarship-current"),
    sourceFieldLineage: {
      title: "official page title",
      coverage: "section III award table",
      applicableDegree: "section II qualified applicants",
      deadlineLabel: "section VI result timing; no application deadline published",
      eligibilityItems: "section IV eligibility",
      applicationMaterials: "section V application procedures",
      applicationSteps: "sections V and VII",
    },
  },
  {
    slug: "official-zjsu-zhejiang-provincial-government-scholarship",
    schoolSlug,
    title: "Zhejiang Provincial Government Scholarship at Zhejiang Gongshang University",
    nameZh: "浙江省政府奖学金",
    type: "government",
    typeLabel: "Provincial government scholarship",
    providerName: "浙江省人民政府",
    providerNameEn: "Zhejiang Provincial Government",
    providerLocation: "Zhejiang, China",
    fundingLevel: "Amount not published",
    coverage: "Type A for postgraduate students, Type B for undergraduates, Type C for long-term students and a special category for students from Belt and Road countries and friendly provinces or states. Current amounts and quotas require confirmation with the admissions office and annual notice.",
    applicableDegree: "Undergraduate, Master, Doctoral and eligible long-term non-degree study",
    applicableProgram: "New or current eligible international students at ZJGSU under the published category rules.",
    deadlineLabel: "No fixed application deadline is published; admitted recipients are normally notified in July or August of the current year.",
    benefitItems: [
      { label: "Type A", included: true, note: "Postgraduate award; amount not published on the current page" },
      { label: "Type B", included: true, note: "Undergraduate award; amount not published on the current page" },
      { label: "Type C", included: true, note: "Long-term-student award; amount not published on the current page" },
      { label: "Special category", included: true, note: "For eligible Belt and Road and friendly-province/state students; amount not published" },
    ],
    eligibilityItems: [
      { label: "Age and education", value: "Undergraduate applicants: high school certificate and age 30 or below; master's: bachelor's degree and age 35 or below; doctoral: master's degree and age 40 or below" },
      { label: "Language", value: "Provide corresponding Chinese proficiency evidence; the term may be eased for some English-taught programs" },
      { label: "Academic standing", value: "New students need excellent prior performance; current students need outstanding performance and no failed or missed final examination" },
      { label: "Other funding", value: "Must not receive another Chinese government or other scholarship" },
    ],
    applicationMaterials: [{ label: "Published documents", value: "Admission form, highest degree and transcripts, passport, physical examination for new students, and two recommendation letters where required" }],
    applicationSteps: [
      { label: "Step 1", value: "Complete the relevant ZJGSU admission application" },
      { label: "Step 2", value: "Select the applicable Type A, B, C or special provincial scholarship category" },
      { label: "Step 3", value: "Await institutional and provincial review under the applicable annual notice" },
    ],
    actionLinks: [{ label: "Official Zhejiang Provincial Government Scholarship page", url: fields("zjsu-zhejiang-provincial-government-scholarship-current").sourceUrl, kind: "official-source" }],
    summary: "Current provincial scholarship route at ZJGSU; old monetary amounts are omitted because the refreshed page now requires applicants to confirm amounts and annual quotas.",
    status: "active",
    verificationStatus: "verified",
    ...fields("zjsu-zhejiang-provincial-government-scholarship-current"),
    sourceFieldLineage: {
      title: "official page title",
      coverage: "section III award categories and annual-notice caveat",
      applicableDegree: "sections II and III",
      deadlineLabel: "section VI result timing; no application deadline published",
      eligibilityItems: "section IV eligibility",
      applicationMaterials: "section V application procedures",
      applicationSteps: "section V application procedures",
    },
  },
];

const capturedAt = [...sources.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt: capturedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 79 validation failed:\n${validation.errors.join("\n")}`);

const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: capturedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.length },
  evidence,
  unresolved: [
    "The refreshed current pages no longer publish the prior percentage tiers, stipend amounts or provincial monetary standards; those values are excluded rather than carried forward.",
    "No fixed application deadline or cycle-specific 2027 quota is published for these three awards.",
    "The President Scholarship page gives a CNY 7,800/year double-room benchmark but does not say the scholarship pays it; accommodation coverage is not claimed.",
  ],
  notes: [
    "Applicant scope, eligibility, materials, process and result timing were re-confirmed against the October 20 official snapshots.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-79");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 79, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
