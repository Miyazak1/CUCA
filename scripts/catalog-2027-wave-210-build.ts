import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  byteLength: number;
  sha256: string;
  artifactPath: string;
};
type Language = "Chinese" | "English";
type Degree = "Master" | "Doctoral";
type Major = { degree: Degree; department: string; name: string; languages: Language[]; durationYears: number };

const root = process.cwd();
const pageRun = "2026-10-27T03-49-42-045Z";
const pdfRun = "2026-10-27T03-50-21-043Z";
const expected = {
  "seu-cgs-high-level-postgraduate-2027": "9032b0cc5f13c699f637fe6e0e0e8125c9db02b96ee79da9f6a0041ebe8c6cc9",
  "seu-cgs-high-level-postgraduate-guide-pdf-2027": "6726cea650eb00251be55cd9a906b38ee3219785590b198768e128429698894a",
} as const;
const loadSource = async (run: string, id: keyof typeof expected) => {
  const runRoot = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === expected[id]);
  if (!source) throw new Error(`Missing locked Southeast University source: ${id}`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== expected[id]) throw new Error(`Evidence hash mismatch: ${id}`);
  return { source, bytes };
};
const pageEvidence = await loadSource(pageRun, "seu-cgs-high-level-postgraduate-2027");
const pdfEvidence = await loadSource(pdfRun, "seu-cgs-high-level-postgraduate-guide-pdf-2027");
const pdf = pdfEvidence.source;
for (const fragment of [
  "2027中国政府奖学金（高水平研究生项目）招生简章",
  "52dd65bd-d25c-46ef-a77b-5dec2e936b61.pdf",
]) if (!pageEvidence.bytes.toString("utf8").includes(fragment)) throw new Error(`Expected SEU page fragment missing: ${fragment}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanjing");
const baseSchool = prior.schools?.find((row) => row.slug === "southeast-university");
if (!city || !baseSchool) throw new Error("Southeast University release-candidate dependencies are missing.");
const sourceFields = {
  sourceUrl: pdf.finalUrl ?? pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: pdf.fetchedAt,
};
const school = {
  ...baseSchool,
  applicationLevel: "Undergraduate, Master and Doctoral, including 2027 Chinese Government Scholarship postgraduate routes.",
  languageRequirement: "For the 2027 High-Level Postgraduate scholarship, Chinese-taught routes normally require HSK Level 4 score 200 or above; medical, humanities, economics and management majors require HSK Level 5 or above. English-taught routes require TOEFL 80, IELTS 6.0 or Duolingo 100 unless English is a native or official language.",
  deadlineSummary: "2027 undergraduate applications are organized in three batches from November 2026 through June 2027. Postgraduate self-funded applications run from November 2026 through May 2027. The 2027 Chinese Government Scholarship High-Level Postgraduate route runs November 1, 2026 through February 28, 2027.",
  admissionsUrl: pageEvidence.source.finalUrl ?? pageEvidence.source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "133 published 2027 postgraduate scholarship degree-language routes: 25 master's and 108 doctoral"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: pdf.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official PDF title and program tables, pages 3-5",
    languageRequirement: "official PDF application materials, page 6",
    deadlineSummary: "official PDF application period, page 2, combined with existing 2027 degree guides",
    admissionsUrl: "official page embedding the locked PDF",
    campusHighlights: "official PDF program tables, pages 3-5",
  },
};

const C: Language[] = ["Chinese"];
const E: Language[] = ["English"];
const CE: Language[] = ["Chinese", "English"];
const master = (department: string, rows: Array<[string, Language[], number?]>): Major[] => rows.map(([name, languages, durationYears]) => ({ degree: "Master", department, name, languages, durationYears: durationYears ?? 3 }));
const doctoral = (department: string, rows: Array<[string, Language[]]>): Major[] => rows.map(([name, languages]) => ({ degree: "Doctoral", department, name, languages, durationYears: 4 }));
const majors: Major[] = [
  ...master("School of Transportation", [["Transportation Engineering", CE]]),
  ...master("School of Instrument Science & Engineering", [["Electronic & Information Engineering", E], ["Instrumental Science & Technology", C]]),
  ...master("School of Information Science & Engineering", [["Electronic & Information Engineering", E]]),
  ...master("School of Civil Engineering", [["Management Science & Engineering", C], ["Civil Engineering", CE], ["Civil Engineering Construction & Management", C]]),
  ...master("School of Architecture", [["Urban Planning", CE], ["Architecture", CE], ["Landscape Architecture", CE]]),
  ...master("School of Mechanical Engineering", [["Mechanical Engineering", C]]),
  ...master("School of Material Science & Engineering", [["Material Science & Engineering", C]]),
  ...master("School of Biological Science & Medical Engineering", [["Biomedical Engineering", C]]),
  ...master("School of Electronic Science & Engineering", [["Electronic Science & Technology", CE]]),
  ...master("School of Economics & Management", [["Management Science & Engineering", C], ["Engineering Management", E, 2]]),
  ...master("School of Automation", [["Control Science & Engineering", CE]]),
  ...master("School of Computer Science & Engineering", [["Computer Science & Technology", C]]),

  ...doctoral("School of Transportation", [["Transportation Surveying & Information Technology", CE], ["Transportation Engineering", CE], ["Geotechnical Engineering", CE], ["Bridge and Tunnel Engineering", CE]]),
  ...doctoral("School of Humanities", [["Philosophy", C], ["Digital Sociology", C], ["Public Management", C]]),
  ...doctoral("School of Instrument Science & Engineering", [["Instrumental Science & Technology", CE], ["Navigation, Guidance & Control", CE]]),
  ...doctoral("School of Information Science & Engineering", [["Electronic Information", E], ["Information & Communication Engineering", CE]]),
  ...doctoral("School of Public Health", [["Public Management", C], ["Public Health & Preventive Medicine", C]]),
  ...doctoral("School of Chemistry & Chemical Engineering", [["Chemical Engineering & Techniques", CE], ["Chemistry", CE]]),
  ...doctoral("Medical School", [
    ["Clinical Laboratory Diagnostics", C], ["Clinical Medicine", C], ["Internal Medicine", C], ["Surgery", C], ["Obstetrics & Gynecology", C],
    ["Rehabilitation Medicine Physical Therapy", C], ["Imaging & Nuclear Medicine", C], ["Neurology", C], ["Geriatrics", C], ["Otorhinolaryngology", C],
    ["Oncology", C], ["Intensive Medicine", C], ["Anesthesiology", C], ["Basic Medicine", C],
  ]),
  ...doctoral("School of Civil Engineering", [
    ["Mechanics", CE], ["Civil Engineering", CE], ["Civil Engineering Construction & Management", CE], ["Municipal Engineering", CE],
    ["Intelligent Construction & Operation & Maintenance", CE], ["Management Science & Engineering", C], ["Ocean Sciences & Engineering", CE], ["Polar Science & Technology", CE],
  ]),
  ...doctoral("School of Foreign Languages", [["Foreign Language & Literature", C]]),
  ...doctoral("School of Architecture", [["Urban Planning", CE], ["Architecture", CE], ["Landscape Architecture", CE], ["Cultural Relics", C]]),
  ...doctoral("School of Mathematics", [["Mathematics", CE], ["System Science", CE]]),
  ...doctoral("School of Statistics & Data Science", [["Statistics", C]]),
  ...doctoral("School of Mechanical Engineering", [["Mechanical Engineering", CE]]),
  ...doctoral("School of Material Science & Engineering", [["Material Science & Engineering", CE]]),
  ...doctoral("School of Law", [["Law", C]]),
  ...doctoral("School of Physics", [["Physics", C]]),
  ...doctoral("School of Life Science & Technology", [["Biology", CE], ["Biology & Medicine", C]]),
  ...doctoral("School of Biological Science & Medical Engineering", [["Biomedical Engineering", CE]]),
  ...doctoral("School of Electronic Science & Engineering", [["Optical Engineering", CE], ["Electronic Science & Technology", CE]]),
  ...doctoral("School of Electrical Engineering", [["Electrical Engineering", CE]]),
  ...doctoral("School of Economics & Management", [["Business Administration", CE], ["Management Science & Engineering", CE], ["Financial Engineering", CE], ["Applied Economics", CE], ["Digital Economy & Management", CE], ["Finance", CE]]),
  ...doctoral("School of Cyber Science & Engineering", [["Cyberspace Security", C]]),
  ...doctoral("School of Energy & Environment", [["Power Engineering & Engineering Thermophysics", CE], ["Engineering of Heating, Gas, Ventilation & Air-conditioning", CE], ["Environmental Science & Engineering", CE], ["Carbon Neutrality Science & Technology", CE]]),
  ...doctoral("School of Automation", [["Control Science and Engineering", CE]]),
  ...doctoral("School of Computer Science & Engineering", [["Computer Science & Technology", C]]),
  ...doctoral("School of Integrated Circuit", [["Integrated Circuit Science & Engineering", C]]),
];
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const routes = majors.flatMap((major) => major.languages.map((language) => ({ ...major, language })));
const masterRoutes = routes.filter((route) => route.degree === "Master");
const doctoralRoutes = routes.filter((route) => route.degree === "Doctoral");
if (masterRoutes.length !== 25 || doctoralRoutes.length !== 108 || routes.length !== 133) {
  throw new Error(`Unexpected SEU route counts: master=${masterRoutes.length}, doctoral=${doctoralRoutes.length}, total=${routes.length}.`);
}
const advancedHskDepartments = new Set(["Medical School", "School of Humanities", "School of Economics & Management"]);
const programs: CatalogSeedProgram[] = routes.map((route) => {
  const hskRequirement = advancedHskDepartments.has(route.department)
    ? "HSK Level 5 or above for this Chinese-taught medical, humanities, economics, or management route; the source does not publish a score threshold."
    : "HSK Level 4 score 200 or above for Chinese-taught study.";
  return {
    slug: `southeast-university-2027-cgs-${route.degree.toLowerCase()}-${slugify(route.department)}-${slugify(route.name)}-${route.language.toLowerCase()}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: route.name,
    degreeLevel: route.degree,
    durationYears: route.durationYears,
    fieldCategory: route.department,
    subjectArea: route.name,
    teachingLanguage: route.language,
    ...(route.language === "Chinese" ? { hskRequirement } : { englishRequirement: "TOEFL 80, IELTS 6.0 or Duolingo 100 or above; applicants whose native or official language is English are exempt." }),
    scholarshipText: "Full Chinese Government Scholarship covering tuition, accommodation, living stipend and comprehensive medical insurance; international travel is excluded.",
    applicationNote: "Apply in the Southeast University international student system and select the Chinese Government Scholarship Type B route. Shortlisted applicants receive a pre-admission letter for the CSC application using agency number 10286.",
    hasScholarship: true,
    badgeText: "2027 full scholarship route",
    displaySubjects: [route.name],
    displayGroup: route.degree,
    displayGroupLabel: `${route.degree} scholarship programs`,
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: pdf.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      nameEn: "official PDF program table, pages 3-5",
      degreeLevel: "official PDF program heading, pages 3-5",
      durationYears: "official PDF Duration column, pages 3-5",
      fieldCategory: "official PDF School/College/Department column, pages 3-5",
      subjectArea: "official PDF Major column, pages 3-5",
      teachingLanguage: "official PDF major language label, pages 3-5; unlabeled rows are the Chinese route in the bilingual guide",
      ...(route.language === "Chinese" ? { hskRequirement: "official PDF Application Materials item 5, page 6" } : { englishRequirement: "official PDF Application Materials item 6, page 6" }),
      scholarshipText: "official PDF introduction, page 2",
      applicationNote: "official PDF application and admission procedure, pages 7-8",
    },
  };
});
if (new Set(programs.map((program) => program.slug)).size !== 133) throw new Error("SEU 2027 scholarship route slugs are not unique.");
const intakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "Application period: November 1, 2026 to February 28, 2027; no time of day is published.",
  applicationRound: "2027 Chinese Government Scholarship High-Level Postgraduate Program",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official late-August to early-September registration window, page 8",
    intakeYear: "official PDF title and registration section",
    deadlineLabel: "official PDF application period, page 2",
    applicationRound: "official PDF title",
  },
}));

const scholarship: CatalogSeedScholarship = {
  slug: "southeast-university-cgs-high-level-postgraduate-2027",
  title: "Southeast University 2027 Chinese Government Scholarship High-Level Postgraduate Program",
  nameZh: "东南大学2027年中国政府奖学金高水平研究生项目",
  type: "government",
  typeLabel: "Chinese Government Scholarship - High-Level Postgraduate Program Type B",
  providerName: "中国国家留学基金管理委员会 / 东南大学",
  providerNameEn: "China Scholarship Council / Southeast University",
  providerLocation: "Nanjing, Jiangsu, China",
  schoolSlug: school.slug,
  fundingLevel: "Full",
  coverage: "Tuition, accommodation, living stipend and comprehensive medical insurance; international travel costs are excluded.",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "25 master's degree-language routes and 108 doctoral degree-language routes listed on pages 3-5 of the official PDF.",
  requirementText: "Applicants must be non-Chinese citizens. Master's applicants must hold a bachelor's degree and be no older than 35; doctoral applicants must hold a master's degree and be no older than 40. Route-specific Chinese or English language evidence is required.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "Covered" },
    { label: "Living stipend", included: true, note: "Covered; monetary amount not published in this guide" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance covered" },
    { label: "International travel", included: false, note: "Explicitly excluded" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Passport and current visa or residence permit page where applicable" },
    { label: "Academic records", value: "Highest degree certificate and official transcripts" },
    { label: "Language", value: "HSK or TOEFL, IELTS, or Duolingo evidence for the selected route" },
    { label: "Recommendations", value: "Two recommendation letters" },
    { label: "Academic plan", value: "Research proposal of at least 800 words" },
    { label: "Compliance", value: "Recent non-criminal record and physical examination record" },
  ],
  applicationSteps: [
    { label: "Step 1", body: "Apply in the Southeast University international student system and select Chinese Government Scholarship Type B." },
    { label: "Step 2", body: "Complete initial, fee, and academic review stages in the university system." },
    { label: "Step 3", body: "If pre-admitted, upload the pre-admission letter to the CSC system using Southeast University agency number 10286 and program type B." },
  ],
  actionLinks: [
    { label: "Official Southeast University guide page", url: pageEvidence.source.finalUrl ?? pageEvidence.source.url, kind: "official-source" },
    { label: "Official guide PDF", url: pdf.finalUrl ?? pdf.url, kind: "official-source" },
  ],
  deadlineDate: "2027-02-28",
  deadlineLabel: "Application period: November 1, 2026 to February 28, 2027",
  applicationRound: "2027 Chinese Government Scholarship High-Level Postgraduate Program",
  benefits: ["Tuition", "Accommodation", "Living stipend", "Comprehensive medical insurance"],
  tags: ["Chinese Government Scholarship", "Master", "Doctoral", "Type B", "Chinese-taught", "English-taught"],
  summary: "Full 2027 postgraduate scholarship covering 133 explicitly listed Southeast University degree-language routes.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: pdf.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official page and PDF title",
    fundingLevel: "official PDF introduction, page 2",
    coverage: "official PDF introduction, page 2",
    applicableDegree: "official PDF program headings, pages 3-5",
    applicableProgram: "official PDF program tables, pages 3-5",
    requirementText: "official PDF qualification and materials sections, pages 2 and 6",
    benefitItems: "official PDF introduction, page 2",
    applicationMaterials: "official PDF application materials, page 6; personal contact details excluded",
    applicationSteps: "official PDF procedure and admission sections, pages 7-8",
    deadlineDate: "official PDF application period, page 2",
    deadlineLabel: "official PDF application period, page 2",
    applicationRound: "official PDF title",
    summary: "official PDF coverage and program-table route count",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: pdf.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: intakes,
  scholarships: [scholarship],
};
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
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 15, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: intakes.length, scholarships: 1 },
  evidence: [pageEvidence.source, pdf].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, contentType: row.contentType, byteLength: row.byteLength, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  routeReconciliation: { masterProgramRows: 25, doctoralProgramRows: 108, totalProgramLanguageRoutes: 133, matchPolicy: "Scholarship-scoped slugs are distinct from the existing undergraduate and general postgraduate catalog." },
  unresolved: [
    "The official PDF does not publish numeric stipend amounts, so the catalog records coverage without inventing a monthly amount.",
    "The PDF does not publish tuition amounts for self-funded study; the scholarship routes record only the full tuition waiver.",
    "Unlabeled program rows in the bilingual table are treated as Chinese-taught because English and optional routes are explicitly labeled; this mapping remains pending editorial review.",
    "The guide publishes a date-only deadline and no time of day; no deadline time is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published staff contacts, email addresses, telephone numbers, and applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-210");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 210, candidateSha256, counts: validation.summary, routeCounts: { master: masterRoutes.length, doctoral: doctoralRoutes.length, total: routes.length }, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
