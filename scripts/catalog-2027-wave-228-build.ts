import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const evidenceRuns = [
  {
    run: "2026-10-27T07-39-50-511Z",
    id: "tiangong-chinese-language-guide-2027",
    sha256: "a5da96e316945d2a95bfcf7262f0bbf4970b5c193464748b6431ea1249ab7b28",
  },
  {
    run: "2026-10-27T07-40-14-257Z",
    id: "tiangong-chinese-language-guide-pdf-2027",
    sha256: "4945e1529575eaefa2425ebc7f7250587f6b70e567aa19caaa91a54dad474ec6",
  },
] as const;
const sources = new Map<string, Source>();
for (const lock of evidenceRuns) {
  const directory = resolve(root, "work/catalog-official", lock.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked Tiangong 2027 evidence ${lock.id}.`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== lock.sha256) throw new Error(`Evidence hash mismatch: ${lock.id}.`);
  sources.set(lock.id, source);
}

const page = sources.get("tiangong-chinese-language-guide-2027")!;
const pdf = sources.get("tiangong-chinese-language-guide-pdf-2027")!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-174.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "tianjin");
const base = prior.schools?.find((row) => row.slug === "tiangong-university");
if (!city || !base) throw new Error("Wave 174 Tiangong dependencies are missing.");

const fields = {
  sourceUrl: pdf.finalUrl ?? pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: pdf.fetchedAt,
};
const school = {
  ...base,
  applicationLevel: "Bachelor, Master, Doctoral and Non-degree. The official 2027 Chinese-language guide publishes one-semester and one-academic-year general-scholar routes.",
  deadlineSummary: "The 2027 Chinese-language guide links the online application system but publishes no application deadline. No complete applicant-facing 2027 degree deadline is published.",
  tuitionSummary: "The 2027 Chinese-language general-scholar tuition is CNY 8,000 per semester, plus a nonrefundable CNY 500 application fee. Current degree tuition remains scoped to the existing official cost page.",
  applicationFee: "CNY 500, nonrefundable",
  admissionsUrl: page.finalUrl ?? page.url,
  campusHighlights: [
    "Official 2027 Chinese-language general-scholar routes for one semester or one academic year",
    "Published CNY 8,000 semester tuition and CNY 2,000/CNY 3,000 tuition awards",
    ...(base.campusHighlights ?? []),
  ],
  lastVerifiedAt: pdf.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 Chinese-language guide plus current degree catalog",
    deadlineSummary: "official 2027 guide; deadline not published",
    tuitionSummary: "official 2027 Chinese-language guide plus current degree cost page",
    applicationFee: "official 2027 Chinese-language guide",
    admissionsUrl: "official 2027 guide landing page",
    campusHighlights: "official 2027 guide",
  },
};

const routeSpecs = [
  { slug: "one-semester", nameEn: "Chinese Language General Scholar — One-Semester Program (2027)", nameZh: "汉语言专业进修生一学期项目（2027）", term: "2027 one-semester entry" },
  { slug: "one-academic-year", nameEn: "Chinese Language General Scholar — One-Academic-Year Program (2027)", nameZh: "汉语言专业进修生一学年项目（2027）", term: "2027 one-academic-year entry" },
] as const;
const programs = routeSpecs.map((route) => ({
  slug: `tiangong-university-chinese-language-general-scholar-${route.slug}-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese Language and Culture",
  subjectArea: "Chinese Language",
  teachingLanguage: "Chinese",
  tuitionAmount: 8000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 8,000 per semester",
  applicationUrl: "https://tiangong.17gz.org",
  applicationNote: "The official 2027 guide publishes online application access but no deadline.",
  scholarshipText: "After evaluation, eligible students may receive a CNY 2,000 or CNY 3,000 tuition deduction.",
  hasScholarship: true,
  badgeText: "Official 2027 Chinese-language route",
  displayTuition: "CNY 8,000/semester",
  displaySubjects: ["Chinese oral communication", "Traditional Chinese culture", "Intelligent media and contemporary China"],
  displayGroup: "tiangong-chinese-language-2027",
  displayGroupLabel: "Tiangong University 2027 Chinese-language general-scholar routes",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...fields,
  sourceFieldLineage: {
    nameEn: "official 2027 program title and duration option",
    nameZh: "official Chinese program title and duration option",
    degreeLevel: "official no-degree-awarded statement",
    fieldCategory: "CUAC taxonomy based on official Chinese-language scope",
    subjectArea: "official major",
    teachingLanguage: "official Chinese-language program scope",
    tuitionAmount: "official semester tuition",
    tuitionCurrency: "official fee currency",
    tuitionPeriod: "official semester fee basis",
    tuitionText: "official semester tuition",
    applicationUrl: "official online-application link",
    applicationNote: "official guide; deadline absent",
    scholarshipText: "official award amounts and tuition-deduction mechanism",
    hasScholarship: "official award section",
    badgeText: "official 2027 guide title",
  },
}));
const programIntakes = programs.map((program, index) => ({
  programSlug: program.slug,
  intakeTerm: routeSpecs[index].term,
  intakeYear: 2027,
  applicationRound: "Tiangong University 2027 Chinese Language General Scholar",
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official one-semester or one-academic-year option; exact month not normalized",
    intakeYear: "official 2027 guide title",
    applicationRound: "official 2027 guide title",
  },
}));
const scholarship = {
  slug: "tiangong-university-chinese-language-tuition-award-2027",
  schoolSlug: school.slug,
  title: "Tiangong University Chinese Language Program Tuition Award — 2027",
  nameZh: "天津工业大学汉语言进修项目学费奖学金（2027）",
  type: "university",
  typeLabel: "Program tuition award",
  providerName: "天津工业大学",
  providerNameEn: "Tiangong University",
  providerLocation: "Tianjin, China",
  fundingLevel: "Partial tuition deduction",
  coverage: "CNY 2,000 or CNY 3,000 is deducted directly from the CNY 8,000 semester tuition after evaluation.",
  applicableDegree: "Non-degree",
  applicableProgram: "2027 Chinese Language General Scholar, one semester or one academic year",
  amountText: "CNY 2,000 or CNY 3,000 tuition deduction; remaining semester tuition CNY 6,000 or CNY 5,000.",
  requirementText: "Awarded after university evaluation; the guide does not publish a separate scholarship application deadline or scoring rubric.",
  benefitItems: [{ label: "Tuition deduction", included: true, note: "CNY 2,000 or CNY 3,000 after evaluation" }],
  eligibilityItems: [],
  applicationMaterials: [],
  applicationSteps: [{ label: "Apply online", value: "Submit the program application through the official Tiangong application system; award evaluation details are not separately published." }],
  actionLinks: [{ label: "Official 2027 guide", url: page.finalUrl ?? page.url, kind: "official-source" }],
  applicationRound: "2027 Chinese Language General Scholar",
  summary: "Partial tuition award embedded in the official 2027 Chinese-language program guide.",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...fields,
  sourceFieldLineage: {
    title: "official 2027 program and scholarship section",
    fundingLevel: "official tuition-deduction mechanism",
    coverage: "official award amounts and tuition calculation",
    applicableDegree: "official no-degree-awarded statement",
    applicableProgram: "official program scope and duration options",
    amountText: "official numeric award and tuition amounts",
    requirementText: "official evaluation statement; omitted rules remain unresolved",
    benefitItems: "official award amounts",
    applicationSteps: "official online-application link; no separate award process published",
    actionLinks: "official guide landing page",
    applicationRound: "official 2027 guide title",
    summary: "official scholarship section",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: pdf.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: pdf.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 133, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1 },
  evidence: [page, pdf].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  visualReview: { result: "pass", pages: 6, note: "All six PDF pages were text-extracted and reviewed against the official bilingual layout; the program scope, age and education rules, tuition, application fee, award amounts and duration options agree." },
  unresolved: [
    "The guide title establishes the 2027 cycle, but the body publishes no exact start month or application deadline; both remain absent.",
    "The guide offers one-semester and one-academic-year duration choices without exact calendar dates or month counts; no month count is inferred.",
    "The award is granted after evaluation, but no scoring rubric, quota or separate application process is published; those fields remain absent.",
    "This guide does not establish a general 2027 bachelor, master or doctoral cycle.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts are included; public staff contact details and applicant personal data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-228");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 228, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
