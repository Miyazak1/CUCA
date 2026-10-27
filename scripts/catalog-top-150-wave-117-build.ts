import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };
const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-48-31-435Z", id: "hzau-international-application-current-2027", sha256: "8e0c7127c26d5fe7d33d5724a64cc3c7a1021a04a18c4e09c02460de84404948" },
  { run: "2026-10-26T05-48-35-513Z", id: "hzau-international-programs-supervisors-current", sha256: "688750a0727dbb667d4789b383b995af0b79ac14b8589a81dcb4ab0dc8b86385" },
  { run: "2026-10-26T05-48-38-442Z", id: "hzau-cgs-high-level-postgraduate-current-2027", sha256: "96dd059dee06b0b182c6edde5be9eed97e2ad8f65e03b34381d0f395a8c52146" },
  { run: "2026-10-26T05-48-41-040Z", id: "hzau-university-scholarship-current-2027", sha256: "660f1627d8d1c929256a1a1fa94cf8686d8eca1c9f2887e385412d6709a99eb9" },
];
const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}
const applicationSource = sources.get("hzau-international-application-current-2027")!;
const programIndexSource = sources.get("hzau-international-programs-supervisors-current")!;
const cscSource = sources.get("hzau-cgs-high-level-postgraduate-current-2027")!;
const universityScholarshipSource = sources.get("hzau-university-scholarship-current-2027")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "huazhong-agricultural-university";
const citySlug = "wuhan";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Huazhong Agricultural University already exists in the reviewed base.");
const city = dependency.cities?.find((row) => row.slug === citySlug);
if (!city) throw new Error("Wuhan city dependency is missing.");

const school = {
  slug: schoolSlug,
  nameEn: "Huazhong Agricultural University",
  nameZh: "华中农业大学",
  citySlug,
  schoolType: "Public agricultural university",
  region: "Wuhan, Hubei, Central China",
  applicationLevel: "Master and Doctoral international applications for the 2027 scholarship cycle",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "Chinese-medium applicants require HSK Level 5 or above. English-medium applicants are encouraged to provide TOEFL, IELTS or another official English test recognized by HZAU; the guide does not publish a numeric English cutoff.",
  hskRequirement: "HSK Level 5 or above for Chinese-medium postgraduate study.",
  englishRequirement: "Recognized TOEFL, IELTS or other official English proficiency evidence is recommended; no numeric cutoff is published.",
  deadlineSummary: "Chinese Government Scholarship and HZAU Scholarship applications run from November 1, 2026 through February 21, 2027.",
  tuitionSummary: "Published annual postgraduate tuition ranges from CNY 22,000 to 28,000 for master's study and CNY 28,000 to 44,000 for doctoral study, depending on subject group and teaching language.",
  websiteUrl: "https://www.hzau.edu.cn/",
  admissionsUrl: applicationSource.finalUrl ?? applicationSource.url,
  subjectTags: ["Crop Science", "Horticulture", "Animal Science", "Veterinary Medicine", "Food Science", "Resources and Environment", "Agricultural Engineering"],
  languageTags: ["Chinese", "English", "HSK 5", "IELTS", "TOEFL"],
  campusHighlights: ["Current 2027 postgraduate scholarship application window", "Official program and supervisor index", "Wuhan campus"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: applicationSource.fetchedAt,
  ...sourceFields(applicationSource),
  sourceFieldLineage: {
    nameEn: "official admissions page identity", nameZh: "official university identity", citySlug: "official university location plus reviewed Wuhan dependency", schoolType: "official institution identity plus CUAC classification", region: "official university location plus CUAC taxonomy", applicationLevel: "official current application eligibility", languageOfInstruction: "official current fee table and language requirements", languageRequirement: "official current language-proficiency section", hskRequirement: "official current language-proficiency section", englishRequirement: "official current language-proficiency section", deadlineSummary: "official current application period", tuitionSummary: "official current expense table", admissionsUrl: "official current application page", subjectTags: "official programs and supervisors index at discipline-family level", campusHighlights: "official current application and program pages",
  },
};

const commonEligibility = [
  { label: "Nationality and health", value: "Non-Chinese citizen in good health" },
  { label: "Master's route", value: "Bachelor's-degree holder under age 35" },
  { label: "Doctoral route", value: "Master's-degree holder under age 40" },
  { label: "Chinese-medium language", value: "HSK Level 5 or above" },
  { label: "English-medium language", value: "TOEFL, IELTS or another official English test recognized by HZAU is recommended; no numeric cutoff is published" },
];
const commonMaterials = [
  { label: "Application", value: "Application form" },
  { label: "Education", value: "Highest diploma/degree certificate or official expected-graduation certificate" },
  { label: "Transcripts", value: "Official academic transcripts" },
  { label: "Recommendations", value: "Two letters from professors or associate professors in related disciplines" },
  { label: "Study plan", value: "Study plan" },
  { label: "Identity", value: "Passport copy" },
  { label: "Health", value: "Foreigner Physical Examination Record" },
  { label: "Conduct", value: "Non-criminal record certificate" },
  { label: "Supervisor", value: "Acceptance Letter from an HZAU professor" },
];

const cscScholarship = {
  slug: `${schoolSlug}-csc-high-level-postgraduate-2027`, schoolSlug,
  title: "Huazhong Agricultural University Chinese Government Scholarship High-level Postgraduate Program 2027",
  nameZh: "华中农业大学2027年中国政府奖学金高水平研究生项目",
  type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "中国国家留学基金管理委员会 / 华中农业大学", providerNameEn: "China Scholarship Council / Huazhong Agricultural University", providerLocation: "Wuhan, Hubei, China", fundingLevel: "Full scholarship",
  coverage: "Tuition waiver, free university accommodation, comprehensive medical insurance, CNY 3,000/month master's stipend or CNY 3,500/month doctoral stipend.",
  applicableDegree: "Master and Doctoral", applicableProgram: "Programs listed in the official HZAU international postgraduate programs and supervisors index.",
  amountText: "CNY 3,000/month master's stipend; CNY 3,500/month doctoral stipend; tuition, accommodation and medical insurance covered.",
  requirementText: "Non-Chinese citizen in good health. Master's applicants need a bachelor's degree and must be under 35; doctoral applicants need a master's degree and must be under 40. Chinese-medium study requires HSK 5 or above.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Waived" }, { label: "Accommodation", included: true, note: "Free university accommodation" }, { label: "Master's stipend", included: true, note: "CNY 3,000 per month" }, { label: "Doctoral stipend", included: true, note: "CNY 3,500 per month" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
  ],
  eligibilityItems: commonEligibility, applicationMaterials: commonMaterials,
  applicationSteps: [
    { label: "Step 1", value: "Apply in the CSC Study in China system using HZAU agency number 10504" },
    { label: "Step 2", value: "Also submit the application in the HZAU online application system" },
    { label: "Step 3", value: "Upload all required documents in Chinese or English, with certified translations where required" },
  ],
  actionLinks: [{ label: "Official current application guide", url: applicationSource.finalUrl ?? applicationSource.url, kind: "official-source" }, { label: "Official scholarship overview", url: cscSource.finalUrl ?? cscSource.url, kind: "official-source" }],
  deadlineDate: "2027-02-21", deadlineLabel: "Applications open November 1, 2026 and close February 21, 2027.", applicationRound: "2027 postgraduate scholarship cycle", tags: ["full scholarship", "master", "doctoral", "2027"], summary: "Full 2027 CSC postgraduate scholarship route at Huazhong Agricultural University.", sortOrder: 1, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: applicationSource.fetchedAt,
  ...sourceFields(applicationSource),
  sourceFieldLineage: { title: "official scholarship overview plus current application dates", coverage: "official current application guide scholarship values", applicableDegree: "official scholarship overview and application eligibility", applicableProgram: "official current programs index", amountText: "official current scholarship values", requirementText: "official current qualification and language sections", benefitItems: "official current scholarship values", eligibilityItems: "official current application qualification", applicationMaterials: "official current required-documents table", applicationSteps: "official current application systems and instructions", deadlineDate: "official current application period", applicationRound: "source-bounded 2027 deadline", summary: "official scholarship overview and current application guide" },
};

const universityScholarship = {
  slug: `${schoolSlug}-university-scholarship-2027`, schoolSlug,
  title: "Huazhong Agricultural University Scholarship 2027", nameZh: "华中农业大学2027年国际学生奖学金", type: "university", typeLabel: "University scholarship", providerName: "华中农业大学", providerNameEn: "Huazhong Agricultural University", providerLocation: "Wuhan, Hubei, China", fundingLevel: "Full or partial scholarship",
  coverage: "The official scholarship page states full and partial tiers. The current application guide lists the full tier as tuition waiver, free university accommodation, comprehensive medical insurance, CNY 2,100/month master's stipend or CNY 2,500/month doctoral stipend; partial-tier coverage is not published.",
  applicableDegree: "Master and Doctoral", applicableProgram: "Programs listed in the official HZAU international postgraduate programs and supervisors index.", amountText: "Full tier: CNY 2,100/month master's stipend or CNY 2,500/month doctoral stipend, plus tuition, accommodation and medical insurance; partial-tier amount not published.", requirementText: "Excellent foreign master's or doctoral applicants meeting the current HZAU postgraduate application qualifications.",
  benefitItems: [
    { label: "Full-tier tuition", included: true, note: "Waived" }, { label: "Full-tier accommodation", included: true, note: "Free university accommodation" }, { label: "Full-tier master's stipend", included: true, note: "CNY 2,100 per month" }, { label: "Full-tier doctoral stipend", included: true, note: "CNY 2,500 per month" }, { label: "Full-tier medical insurance", included: true, note: "Comprehensive medical insurance" }, { label: "Partial tier", note: "Coverage not published on the current official pages" },
  ],
  eligibilityItems: commonEligibility, applicationMaterials: commonMaterials,
  applicationSteps: [{ label: "Step 1", value: "Submit the application in the HZAU online application system" }, { label: "Step 2", value: "Upload all required documents in Chinese or English, with certified translations where required" }],
  actionLinks: [{ label: "Official current application guide", url: applicationSource.finalUrl ?? applicationSource.url, kind: "official-source" }, { label: "Official scholarship overview", url: universityScholarshipSource.finalUrl ?? universityScholarshipSource.url, kind: "official-source" }],
  deadlineDate: "2027-02-21", deadlineLabel: "Applications open November 1, 2026 and close February 21, 2027.", applicationRound: "2027 postgraduate scholarship cycle", tags: ["university scholarship", "full or partial", "master", "doctoral", "2027"], summary: "HZAU's 2027 postgraduate university scholarship with published full-tier benefits and an unspecified partial tier.", sortOrder: 2, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: applicationSource.fetchedAt,
  ...sourceFields(applicationSource),
  sourceFieldLineage: { title: "official university-scholarship overview plus current application dates", coverage: "official scholarship overview and current application guide scholarship values", applicableDegree: "official scholarship overview", applicableProgram: "official current programs index", amountText: "official current scholarship values with explicit partial-tier gap", requirementText: "official scholarship overview and current application qualification", benefitItems: "official current scholarship values", eligibilityItems: "official current application qualification", applicationMaterials: "official current required-documents table", applicationSteps: "official current application system and instructions", deadlineDate: "official current application period", applicationRound: "source-bounded 2027 deadline", summary: "official scholarship overview and current application guide" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: applicationSource.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [cscScholarship, universityScholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 117 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => { const source = sources.get(locked.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: applicationSource.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 45, schoolSlugs: [schoolSlug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 2 },
  evidence,
  unresolved: [
    "The current application page publishes a 2027 application period, eligibility, language requirements, fees and scholarship values, but it does not label individual major pages with a cycle. This wave structures the school and two scholarship routes only; no degree-program record is inferred from college headings.",
    "The official programs and supervisors index links to separate college tables. Complete major-level extraction remains queued for a later registered-source wave so duplicate bilingual majors and Chinese-only asterisk rules can be reviewed consistently.",
    "The HZAU Scholarship page states that full and partial tiers exist, while the current application guide publishes only one benefit schedule. That schedule is labeled as the full tier; partial-tier coverage remains absent.",
    "The current guide does not publish a numeric TOEFL or IELTS cutoff. No threshold is invented.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant records or personal staff contacts are imported. Application material names are institutional requirements only." },
  programIndexSha256: programIndexSource.sha256,
};
const stem = resolve(root, "seeds/catalog.2027-wave-117");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 117, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
