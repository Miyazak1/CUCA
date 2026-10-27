import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };
type ExtractedRoute = { number: number; page: number; nameEn: string; teachingLanguage: "Chinese" | "English"; degreeLevel: "Master" | "Doctoral"; durationYears: number; schoolOrFaculty: string; degreeType: string; tuitionAmount: number; campus: string; scholarshipEligibility: Record<string, boolean> };
type ExtractedCatalog = { source: { sha256: string }; counts: { total: number; master: number; doctoral: number; chinese: number; english: number }; routes: ExtractedRoute[] };

const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-55-00-205Z", id: "nenu-international-master-guide-2026-2027", sha256: "65ba50c857212395613a4c188017dde4b066a8050a37c013a79d97005b571c5f" },
  { run: "2026-10-26T05-55-05-622Z", id: "nenu-international-doctoral-guide-2026-2027", sha256: "fcb9a0da0bb47edd88e9e23d2a92e164ca7d5afd56283f5e197113bc8418fb66" },
  { run: "2026-10-26T05-55-09-322Z", id: "nenu-international-graduate-program-catalog-pdf-2026", sha256: "36c4f9325b1d5f16581b26ad750935fe125aa59b0e5686483bc296bffa5f1ce1" },
  { run: "2026-10-26T05-55-13-709Z", id: "nenu-cgs-high-level-graduate-guide-2026-2027", sha256: "cc5f790f813d8583eb7957d7df982d1b8b6d96385e60f9e186b640a738b38e9d" },
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

const masterSource = sources.get("nenu-international-master-guide-2026-2027")!;
const doctoralSource = sources.get("nenu-international-doctoral-guide-2026-2027")!;
const catalogSource = sources.get("nenu-international-graduate-program-catalog-pdf-2026")!;
const scholarshipSource = sources.get("nenu-cgs-high-level-graduate-guide-2026-2027")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const extracted = JSON.parse(await readFile(resolve(root, "catalog-sources/nenu-2026-graduate-programs.extracted.json"), "utf8")) as ExtractedCatalog;
if (extracted.source.sha256 !== catalogSource.sha256 || extracted.counts.total !== 151 || extracted.routes.length !== 151) throw new Error("NENU extraction is stale or incomplete.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "northeast-normal-university";
const citySlug = "changchun";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Northeast Normal University already exists in the reviewed base.");
const city = dependency.cities?.find((row) => row.slug === citySlug);
if (!city) throw new Error("Changchun city dependency is missing.");

const school = {
  slug: schoolSlug,
  nameEn: "Northeast Normal University",
  nameZh: "东北师范大学",
  citySlug,
  schoolType: "National key normal university",
  region: "Changchun, Jilin, Northeast China",
  applicationLevel: "Master and Doctoral",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "Chinese-taught applicants require HSK Level 5 with at least 180. English-taught applicants require TOEFL 80 or IELTS 6.0.",
  hskRequirement: "HSK Level 5 score 180 or above for Chinese-taught study.",
  englishRequirement: "TOEFL 80 or IELTS 6.0 for English-taught study.",
  deadlineSummary: "The captured 2026-2027 master's and doctoral guides closed June 22, 2026. No 2027 application deadline is asserted.",
  tuitionSummary: "The 2026 international graduate catalog publishes annual tuition of CNY 18,600-26,000 for master's routes and CNY 22,000-29,000 for doctoral routes.",
  applicationFee: "CNY 800 for the captured 2026 cycle.",
  websiteUrl: "https://www.nenu.edu.cn/",
  admissionsUrl: masterSource.finalUrl ?? masterSource.url,
  subjectTags: [...new Set(extracted.routes.map((row) => row.schoolOrFaculty))],
  languageTags: ["Chinese", "English", "HSK 5", "TOEFL 80", "IELTS 6.0"],
  campusHighlights: ["151 official 2026 international graduate routes", "Renmin Street and Jingyue Street campuses", "Master's and doctoral scholarship eligibility printed by route"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: catalogSource.fetchedAt,
  ...sourceFields(catalogSource),
  sourceFieldLineage: {
    nameEn: "official program catalog and admission guides", nameZh: "official university identity", citySlug: "official guide identity plus reviewed Changchun dependency", schoolType: "official institution identity plus CUAC classification", region: "official location plus CUAC taxonomy", applicationLevel: "official master's and doctoral guides", languageOfInstruction: "official program catalog", languageRequirement: "official master's and doctoral guides", hskRequirement: "official master's and doctoral guides", englishRequirement: "official master's and doctoral guides", deadlineSummary: "official 2026 application deadline with explicit no-2027 limitation", tuitionSummary: "official program catalog", applicationFee: "official master's and doctoral guides", admissionsUrl: "official master's guide", subjectTags: "official School/Faculty column", campusHighlights: "official catalog route and campus columns",
  },
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const category = (faculty: string) => /Education|Psychology|Physical Education/.test(faculty) ? "Education and Psychology" : /Mathematics|Chemistry|Life Sciences|Environment|Geographical/.test(faculty) ? "Natural Sciences" : /Information/.test(faculty) ? "Computer Science and IT" : /Music|Fine Arts|Media/.test(faculty) ? "Arts and Media" : "Humanities and Social Sciences";
const programs = extracted.routes.map((route) => {
  const guide = route.degreeLevel === "Master" ? masterSource : doctoralSource;
  const eligibleScholarships = Object.entries(route.scholarshipEligibility).filter(([, eligible]) => eligible).map(([name]) => name);
  return {
    slug: `${schoolSlug}-${String(route.number).padStart(3, "0")}-${slugify(route.nameEn)}-${route.degreeLevel.toLowerCase()}-${route.teachingLanguage.toLowerCase()}`,
    schoolSlug, citySlug, nameEn: route.nameEn, degreeLevel: route.degreeLevel, durationYears: route.durationYears,
    fieldCategory: category(route.schoolOrFaculty), subjectArea: route.nameEn, teachingLanguage: route.teachingLanguage,
    ...(route.teachingLanguage === "Chinese" ? { hskRequirement: "HSK Level 5 score 180 or above." } : { englishRequirement: "TOEFL 80 or IELTS 6.0." }),
    tuitionAmount: route.tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${route.tuitionAmount.toLocaleString("en-US")} per year for the official 2026 catalog.`,
    scholarshipText: eligibleScholarships.length ? `The catalog marks this route eligible for: ${eligibleScholarships.join(", ")}. Award decisions and current-cycle availability require separate confirmation.` : "No scholarship eligibility mark is asserted for this route.",
    applicationUrl: guide.finalUrl ?? guide.url,
    applicationNote: `${route.degreeType.replace(/\s+/g, " ")} at ${route.schoolOrFaculty}${route.campus ? `, ${route.campus}` : ""}. The captured 2026 application cycle is closed; no 2027 intake is inferred.`,
    hasScholarship: eligibleScholarships.length > 0, badgeText: "2026 official graduate route", displayTuition: `CNY ${route.tuitionAmount.toLocaleString("en-US")}/year`, displaySubjects: [route.nameEn],
    status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: catalogSource.fetchedAt,
    ...sourceFields(catalogSource),
    sourceFieldLineage: { nameEn: `official PDF page ${route.page}, row ${route.number}`, degreeLevel: `official PDF page ${route.page}, Category column`, durationYears: `official PDF page ${route.page}, Study Period column`, fieldCategory: `CUAC grouping of official School/Faculty value ${route.schoolOrFaculty}`, subjectArea: `official PDF page ${route.page}, Major column`, teachingLanguage: `official PDF page ${route.page}, Instruction Language column`, ...(route.teachingLanguage === "Chinese" ? { hskRequirement: "official current master's/doctoral guide" } : { englishRequirement: "official current master's/doctoral guide" }), tuitionAmount: `official PDF page ${route.page}, Tuition Fee column`, scholarshipText: `official PDF page ${route.page}, scholarship eligibility columns`, applicationUrl: "official degree-specific admission guide", applicationNote: `official PDF page ${route.page}, degree type, faculty and campus columns plus cycle limitation` },
  };
});

const programIntakes = programs.map((program) => {
  const guide = program.degreeLevel === "Master" ? masterSource : doctoralSource;
  return {
    programSlug: program.slug, intakeTerm: "2026 Entry", intakeYear: 2026, deadlineDate: "2026-06-22T15:59:59.000Z", deadlineLabel: "The captured 2026-2027 guide closed June 22, 2026.", applicationRound: "2026 international graduate admission", status: "closed" as const,
    ...sourceFields(guide),
    sourceFieldLineage: { intakeTerm: "source-bounded cycle label; semester not inferred", intakeYear: "official catalog and guide publication cycle", deadlineDate: "official guide deadline converted from Beijing end-of-day", deadlineLabel: "official guide deadline", applicationRound: "official guide scope" },
  };
});

const scholarship = {
  slug: `${schoolSlug}-csc-high-level-graduate-2026`, schoolSlug,
  title: "Northeast Normal University Chinese Government Scholarship High-level Graduate Program 2026", nameZh: "东北师范大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "中国国家留学基金管理委员会 / 东北师范大学", providerNameEn: "China Scholarship Council / Northeast Normal University", providerLocation: "Changchun, Jilin, China", fundingLevel: "Full scholarship",
  coverage: "Tuition waiver, on-campus accommodation, comprehensive medical insurance, and a monthly stipend of CNY 3,000 for master's students or CNY 3,500 for doctoral students.", applicableDegree: "Master and Doctoral", applicableProgram: "Eligible routes in the official NENU international graduate catalog.", amountText: "CNY 3,000/month for master's students or CNY 3,500/month for doctoral students, plus tuition, accommodation and medical insurance.", requirementText: "Non-Chinese citizens in good health; master's applicants under 35 with a bachelor's degree, doctoral applicants under 40 with a master's degree; applicants must meet the applicable Chinese or English language requirement.",
  benefitItems: [{ label: "Tuition", included: true, note: "Waived" }, { label: "Accommodation", included: true, note: "On-campus accommodation" }, { label: "Master's stipend", included: true, note: "CNY 3,000 per month" }, { label: "Doctoral stipend", included: true, note: "CNY 3,500 per month" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
  applicationSteps: [{ label: "Step 1", value: "Apply through the CSC system as a Type B applicant using NENU agency number 10200" }, { label: "Step 2", value: "Complete the NENU international-student application according to the official guide" }],
  actionLinks: [{ label: "Official scholarship guide", url: scholarshipSource.finalUrl ?? scholarshipSource.url, kind: "official-source" }],
  deadlineDate: "2026-02-22", deadlineLabel: "The captured scholarship application deadline was February 22, 2026.", applicationRound: "2026 Chinese Government Scholarship High-level Graduate Program", tags: ["full scholarship", "master", "doctoral", "2026", "closed"], summary: "Closed 2026 full CSC postgraduate scholarship route at Northeast Normal University.", sortOrder: 1, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: scholarshipSource.fetchedAt,
  ...sourceFields(scholarshipSource),
  sourceFieldLineage: { title: "official scholarship guide", coverage: "official scholarship coverage section", applicableDegree: "official eligibility section", applicableProgram: "official program catalog eligibility columns", amountText: "official scholarship coverage section", requirementText: "official eligibility and admission-guide language sections", benefitItems: "official scholarship coverage section", applicationSteps: "official application procedure", deadlineDate: "official guide deadline", applicationRound: "official guide title", summary: "official guide scope with closed-cycle label" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: scholarshipSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 119 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => { const source = sources.get(locked.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: scholarshipSource.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 48, schoolSlugs: [schoolSlug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1 }, evidence,
  extraction: { file: "catalog-sources/nenu-2026-graduate-programs.extracted.json", ...extracted.counts, visualReview: "All 11 rendered PDF pages inspected; route numbers are continuous 1-151." },
  unresolved: [
    "The newest captured major catalog and admission guides are the 2026 cycle. Every intake is marked closed and no field is relabeled as 2027.",
    "The official PDF text layer contains corrupted Chinese glyph encoding. English official major names are retained; Chinese major names are left absent instead of guessed.",
    "The scholarship guide is the closed 2026 high-level graduate route. No current 2027 scholarship deadline or benefit schedule is inferred.",
    "The general guides publish application-material requirements, but this wave limits route-level records to program, language, duration, tuition, campus, scholarship eligibility and the shared deadline.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Personal staff contacts printed on the official pages were excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-119");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 119, candidateSha256, counts: validation.summary, extraction: extracted.counts, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
