import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

type LockedSource = {
  run: string;
  id: string;
  sha256: string;
};

const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-07-19-677Z", id: "tongji-undergraduate-chinese-admissions-page-2027", sha256: "36dfaf7fd7ed20cd1dacaaab18ec4df8d1bb65c79cb54055c47a464ef4ae7cc2" },
  { run: "2026-10-26T05-07-18-419Z", id: "tongji-undergraduate-chinese-admissions-image-2027", sha256: "a4f9a81c7bf97f3b53509d3f4d65bea2769a288425baac47d773bea3c1f6acf9" },
  { run: "2026-10-26T05-07-19-730Z", id: "tongji-undergraduate-english-admissions-page-2027", sha256: "9e2bc12cc5527d1bff0afb1feef149d4402ac110b288fa5b09182c878cbeb373" },
  { run: "2026-10-26T05-07-20-072Z", id: "tongji-undergraduate-english-admissions-image-2027", sha256: "8c99cfa214d91c4f5f8ba9e3d7203e60da03bb7189d94f1126b00f0951781d51" },
];

const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id} at ${locked.sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}

const chinesePage = sources.get("tongji-undergraduate-chinese-admissions-page-2027")!;
const chineseImage = sources.get("tongji-undergraduate-chinese-admissions-image-2027")!;
const englishPage = sources.get("tongji-undergraduate-english-admissions-page-2027")!;
const englishImage = sources.get("tongji-undergraduate-english-admissions-image-2027")!;
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "tongji-university";
const baseSchool = dependency.schools?.find((row) => row.slug === schoolSlug);
const city = dependency.cities?.find((row) => row.slug === "shanghai");
if (!baseSchool || !city) throw new Error("Tongji University or Shanghai dependency is missing.");

const baseChinesePrograms = dependency.programs?.filter((row) => row.schoolSlug === schoolSlug && row.degreeLevel === "Undergraduate" && row.teachingLanguage === "Chinese") ?? [];
if (baseChinesePrograms.length !== 68) throw new Error(`Expected 68 existing Tongji Chinese-taught undergraduate programs, found ${baseChinesePrograms.length}.`);

const sanitizeBase = (base: CatalogSeedProgram) => {
  const safe = { ...base };
  delete safe.hskRequirement;
  delete safe.englishRequirement;
  delete safe.scholarshipText;
  delete safe.applicationUrl;
  delete safe.applicationNote;
  delete safe.hasScholarship;
  delete safe.badgeText;
  delete safe.displayTuition;
  delete safe.displaySubjects;
  return safe;
};

const chineseOverrides: Record<string, Partial<CatalogSeedProgram>> = {
  "tongji-university-biological-information": { cscaSubjects: ["Chinese (STEM)", "Mathematics", "Chemistry"] },
  "tongji-university-biotechnology": { cscaSubjects: ["Chinese (STEM)", "Mathematics", "Chemistry"] },
  "tongji-university-radio-and-television-editing-and-directing": { tuitionAmount: 20000 },
  "tongji-university-science-of-animated-cartoon": { tuitionAmount: 20000 },
};

const chinesePrograms = baseChinesePrograms.map((base) => {
  const override = chineseOverrides[base.slug] ?? {};
  const cscaSubjects = override.cscaSubjects ?? base.cscaSubjects ?? [];
  const tuitionAmount = override.tuitionAmount ?? base.tuitionAmount;
  if (!tuitionAmount || cscaSubjects.length === 0) throw new Error(`Incomplete 2027 Tongji Chinese program normalization: ${base.slug}.`);
  return {
    ...sanitizeBase(base),
    ...override,
    cscaSubjects,
    cscaRequirement: `2027 CSCA subjects: ${cscaSubjects.join(", ")}.`,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year.`,
    applicationNote: "The official 2027 Chinese-taught undergraduate directory confirms Fall 2027 entry. Application dates and language thresholds are not stated in this directory and are not inferred.",
    badgeText: "2027 Undergraduate",
    displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
    displaySubjects: cscaSubjects,
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: chineseImage.fetchedAt,
    ...sourceFields(chineseImage),
    sourceFieldLineage: {
      nameEn: "official 2027 Chinese-taught undergraduate program directory",
      nameZh: "official 2027 Chinese-taught undergraduate program directory",
      degreeLevel: "official 2027 directory title",
      durationYears: "official 2027 college and program cards",
      fieldCategory: "existing CUAC catalog taxonomy retained for the same official major",
      subjectArea: "existing reviewed college grouping retained for the same official major",
      teachingLanguage: "official 2027 Chinese-taught directory title",
      cscaSubjects: "official 2027 college card or program-specific override",
      cscaRequirement: "official 2027 college card or program-specific override",
      tuitionAmount: "official 2027 college card or program-specific fee label",
      tuitionText: "official 2027 college card or program-specific fee label",
      applicationNote: "official 2027 directory scope and absence of application-date details",
      badgeText: "official 2027 directory title",
      displayTuition: "official 2027 tuition amount",
      displaySubjects: "official 2027 CSCA subject combination",
    },
  };
});

const futureRoboticsSlug = `${schoolSlug}-future-robotics`;
if (dependency.programs?.some((row) => row.slug === futureRoboticsSlug)) throw new Error(`Expected new Tongji program already exists: ${futureRoboticsSlug}.`);
chinesePrograms.push({
  slug: futureRoboticsSlug,
  schoolSlug,
  citySlug: "shanghai",
  nameEn: "Future Robotics",
  nameZh: "未来机器人",
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: "Engineering and Technology",
  subjectArea: "School of Mechanical Engineering and Robotics",
  teachingLanguage: "Chinese",
  cscaSubjects: ["Chinese (STEM)", "Mathematics", "Physics", "Chemistry"],
  cscaRequirement: "2027 CSCA subjects: Chinese (STEM), Mathematics, Physics, Chemistry.",
  tuitionAmount: 24600,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 24,600/year.",
  applicationNote: "The official 2027 Chinese-taught undergraduate directory confirms Fall 2027 entry. Application dates and language thresholds are not stated in this directory and are not inferred.",
  badgeText: "2027 Undergraduate",
  displayTuition: "CNY 24,600/year",
  displaySubjects: ["Chinese (STEM)", "Mathematics", "Physics", "Chemistry"],
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: chineseImage.fetchedAt,
  ...sourceFields(chineseImage),
  sourceFieldLineage: {
    nameEn: "official 2027 School of Mechanical Engineering and Robotics card",
    nameZh: "official 2027 School of Mechanical Engineering and Robotics card",
    degreeLevel: "official 2027 directory title",
    durationYears: "official 2027 college card",
    fieldCategory: "official college identity plus CUAC catalog taxonomy",
    subjectArea: "official 2027 college card",
    teachingLanguage: "official 2027 Chinese-taught directory title",
    cscaSubjects: "official 2027 college card",
    cscaRequirement: "official 2027 college card",
    tuitionAmount: "official 2027 college card",
    tuitionText: "official 2027 college card",
    applicationNote: "official 2027 directory scope and absence of application-date details",
    badgeText: "official 2027 directory title",
    displayTuition: "official 2027 college card",
    displaySubjects: "official 2027 college card",
  },
});

type EnglishSpec = {
  slug: string;
  baseSlug?: string;
  nameEn: string;
  nameZh: string;
  durationYears: number;
  tuitionAmount: number;
  cscaSubjects: string[];
  fieldCategory: string;
  subjectArea: string;
};

const englishSpecs: EnglishSpec[] = [
  { slug: `${schoolSlug}-architecture-international-class`, baseSlug: `${schoolSlug}-architecture-international-class`, nameEn: "Architecture (International Class)", nameZh: "建筑学（国际班）", durationYears: 4, tuitionAmount: 38000, cscaSubjects: ["Mathematics", "Physics"], fieldCategory: "Architecture and Design", subjectArea: "College of Architecture and Urban Planning" },
  { slug: `${schoolSlug}-urban-and-rural-planning-international-class`, nameEn: "Urban and Rural Planning (International Class)", nameZh: "城乡规划（国际班）", durationYears: 4, tuitionAmount: 38000, cscaSubjects: ["Mathematics", "Physics"], fieldCategory: "Architecture and Design", subjectArea: "College of Architecture and Urban Planning" },
  { slug: `${schoolSlug}-landscape-architecture-international-class`, nameEn: "Landscape Architecture (International Class)", nameZh: "风景园林（国际班）", durationYears: 4, tuitionAmount: 38000, cscaSubjects: ["Mathematics", "Physics"], fieldCategory: "Architecture and Design", subjectArea: "College of Architecture and Urban Planning" },
  { slug: `${schoolSlug}-traffic-engineering-international-class`, nameEn: "Traffic Engineering (International Class)", nameZh: "交通工程（国际班）", durationYears: 4, tuitionAmount: 33000, cscaSubjects: ["Mathematics", "Physics"], fieldCategory: "Engineering and Technology", subjectArea: "College of Transportation Engineering" },
  { slug: `${schoolSlug}-project-management-international-class`, nameEn: "Project Management (International Class)", nameZh: "工程管理（国际班）", durationYears: 4, tuitionAmount: 40000, cscaSubjects: ["Mathematics"], fieldCategory: "Economics and Management", subjectArea: "School of Economics and Management" },
  { slug: `${schoolSlug}-civil-engineering-international-class`, baseSlug: `${schoolSlug}-civil-engineering-international-class`, nameEn: "Civil Engineering (International Class)", nameZh: "土木工程（国际班）", durationYears: 4, tuitionAmount: 35000, cscaSubjects: ["Mathematics", "Physics"], fieldCategory: "Engineering and Technology", subjectArea: "College of Civil Engineering" },
  { slug: `${schoolSlug}-clinical-medicine-mbbs`, baseSlug: `${schoolSlug}-clinical-medicine-mbbs`, nameEn: "Clinical Medicine (MBBS)", nameZh: "临床医学（MBBS）", durationYears: 6, tuitionAmount: 45000, cscaSubjects: ["Mathematics", "Chemistry"], fieldCategory: "Medicine and Health Sciences", subjectArea: "School of Medicine" },
];

for (const spec of englishSpecs.filter((row) => !row.baseSlug)) {
  if (dependency.programs?.some((row) => row.slug === spec.slug)) throw new Error(`Expected new Tongji English program already exists: ${spec.slug}.`);
}

const englishPrograms = englishSpecs.map((spec) => {
  const base = spec.baseSlug ? dependency.programs?.find((row) => row.slug === spec.baseSlug) : undefined;
  if (spec.baseSlug && !base) throw new Error(`Required Tongji base program is missing: ${spec.baseSlug}.`);
  return {
    ...(base ? sanitizeBase(base) : {}),
    slug: spec.slug,
    schoolSlug,
    citySlug: "shanghai",
    nameEn: spec.nameEn,
    nameZh: spec.nameZh,
    degreeLevel: "Undergraduate",
    durationYears: spec.durationYears,
    fieldCategory: spec.fieldCategory,
    subjectArea: spec.subjectArea,
    teachingLanguage: "English",
    cscaSubjects: spec.cscaSubjects,
    cscaRequirement: `2027 CSCA subjects: ${spec.cscaSubjects.join(", ")}. No Chinese-language CSCA subject is required for this English-taught route.`,
    tuitionAmount: spec.tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${spec.tuitionAmount.toLocaleString("en-US")}/year.`,
    applicationNote: "The official 2027 English-taught undergraduate directory confirms Fall 2027 entry and states that no Chinese proficiency is required. Application dates and English-language thresholds are not stated in this directory and are not inferred.",
    badgeText: "2027 English-taught",
    displayTuition: `CNY ${spec.tuitionAmount.toLocaleString("en-US")}/year`,
    displaySubjects: spec.cscaSubjects,
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: englishImage.fetchedAt,
    ...sourceFields(englishImage),
    sourceFieldLineage: {
      nameEn: "official 2027 English-taught undergraduate program card",
      nameZh: "official 2027 English-taught undergraduate program card",
      degreeLevel: "official 2027 directory title",
      durationYears: "official 2027 program card",
      fieldCategory: "official college identity plus CUAC catalog taxonomy",
      subjectArea: "official 2027 program card",
      teachingLanguage: "official 2027 English-taught directory title",
      cscaSubjects: "official 2027 program card",
      cscaRequirement: "official 2027 program card and directory note",
      tuitionAmount: "official 2027 program card",
      tuitionText: "official 2027 program card",
      applicationNote: "official 2027 directory scope and no-Chinese-proficiency note",
      badgeText: "official 2027 directory title",
      displayTuition: "official 2027 program card",
      displaySubjects: "official 2027 program card",
    },
  };
});

const programs = [...chinesePrograms, ...englishPrograms];
if (programs.length !== 76) throw new Error(`Expected 76 Tongji 2027 undergraduate programs, found ${programs.length}.`);

const school = {
  ...baseSchool,
  applicationLevel: "Undergraduate",
  languageOfInstruction: "Chinese and English",
  languageRequirement: "The 2027 program directories identify 69 Chinese-taught and 7 English-taught undergraduate routes. The directory pages do not state application-language thresholds, so 2026 thresholds are not carried forward.",
  hskRequirement: undefined,
  englishRequirement: undefined,
  deadlineSummary: "Official Fall 2027 undergraduate program directories are published, but these directory pages do not state application opening or deadline dates.",
  tuitionSummary: "2027 Chinese-taught undergraduate tuition is CNY 20,000-28,700/year; English-taught undergraduate tuition is CNY 33,000-45,000/year by route.",
  admissionsUrl: chinesePage.finalUrl ?? chinesePage.url,
  cscaRequired: true,
  cscaRequirement: "All 76 published Fall 2027 undergraduate routes require CSCA. The exact subject combination is recorded per program; English-taught routes do not require a Chinese-language CSCA subject.",
  campusHighlights: ["76 official Fall 2027 undergraduate routes", "69 Chinese-taught and 7 English-taught routes", "27 colleges and schools represented", "Program-specific CSCA subject combinations"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: englishPage.fetchedAt,
  ...sourceFields(chinesePage),
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2027 undergraduate directory titles",
    languageOfInstruction: "official 2027 Chinese-taught and English-taught directories",
    languageRequirement: "official 2027 directory counts and absence of threshold details",
    deadlineSummary: "official 2027 directory scope; no dates printed",
    tuitionSummary: "official 2027 directory tuition summary and program cards",
    admissionsUrl: "official 2027 Chinese-taught directory page",
    cscaRequirement: "official 2027 directory subject-combination summaries and program cards",
    campusHighlights: "official 2027 directory counts",
  },
};

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "The official program directory confirms Fall 2027 entry but does not state application opening or deadline dates.",
  applicationRound: "Tongji University Fall 2027 International Undergraduate Entry",
  ...(program.teachingLanguage === "English" ? sourceFields(englishImage) : sourceFields(chineseImage)),
  sourceFieldLineage: {
    intakeTerm: "official 2027 directory Fall Intake label",
    intakeYear: "official 2027 directory title",
    deadlineLabel: "official directory scope and absence of application dates",
    applicationRound: "official 2027 international undergraduate directory context",
  },
}));

const generatedAt = englishPage.fetchedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 110 validation failed:\n${validation.errors.join("\n")}`);

const evidence = lockedSources.map((locked) => {
  const source = sources.get(locked.id)!;
  return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedSchools: 1, refreshedPrograms: 71, newPrograms: 5, programs: 76, programIntakes: 76, scholarships: 0 },
  evidence,
  unresolved: [
    "The official 2027 program-directory pages do not state application opening dates or deadlines, so no openDate or deadlineDate is normalized.",
    "The official 2027 program-directory pages do not state HSK or English-language thresholds, so the 2026 thresholds are not carried forward.",
    "The directory footer says the final admission brochure controls. The candidate records the published program, fee, duration and CSCA facts but does not infer broader admission requirements.",
    "No scholarship terms are published by these directory pages, so no scholarship entity or scholarship claim is added.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Program-card coordinator names, personal-looking email addresses and phone numbers were deliberately excluded. Only institutional catalog facts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-110");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 110, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
