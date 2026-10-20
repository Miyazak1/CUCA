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

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-09.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-09.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-09.review.json");
const expected: Record<string, string> = {
  "bnu-undergraduate-credit-program-english-spring-2027": "e6d8a298a2e955e87a8f7c945dcbd3cc48f3a8a3b010722addadd7943472d64e",
  "bnu-scientific-research-program-spring-2027": "423a07f2a1bba309e5ca776c34591616773eb5690c814d5f52b1ea58408845ff",
  "bit-pre-university-language-programs-page-2027": "fb3bd526c59934e5b06ee424869aecb4162da741ed2e0d9ab4c16b1d899a8e31",
  "bit-pre-university-language-programs-pdf-2027": "97583de1b362847414396bac6ec8e45b507b822688bbabe1009228b8eb3f200e",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 09 evidence: ${missing.join(", ")}`);
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const school = (slug: string) => (base.schools ?? []).find((row) => row.slug === slug)!;
const city = (slug: string) => (base.cities ?? []).find((row) => row.slug === slug)!;
if (!school("beijing-normal-university") || !school("beijing-institute-of-technology") || !city("beijing") || !city("zhuhai")) throw new Error("Wave 09 dependencies are missing from the reviewed 100-school release.");
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });

const bnuCredit = evidence.get("bnu-undergraduate-credit-program-english-spring-2027")!;
const bnuResearch = evidence.get("bnu-scientific-research-program-spring-2027")!;
const bnuRouteSpecs = [
  {
    slug: "beijing-normal-university-english-taught-undergraduate-credit-program-spring-2027",
    nameEn: "English-taught Undergraduate Credit Program",
    fieldCategory: "Undergraduate credit study",
    subjectArea: "Education, Economics, Environmental Science, Philosophy, Law and other English-taught fields",
    teachingLanguage: "English",
    englishRequirement: "Applicants must meet the English requirement of each selected course; the public guide does not publish one universal standardized-test score.",
    tuitionText: "CNY 1,800 per credit; application fee CNY 450.",
    applicationNote: "Applicants must be non-Chinese citizens aged 18-45 and be enrolled in the second year of college or above.",
    source: bnuCredit,
  },
  {
    slug: "beijing-normal-university-scientific-research-general-advanced-studies-spring-2027",
    nameEn: "Scientific Research Program - General Advanced Studies Student",
    fieldCategory: "Supervised research",
    subjectArea: "Pre-agreed research under a BNU supervisor; no coursework",
    teachingLanguage: "No fixed course language; this is supervised research with no coursework.",
    englishRequirement: "No fixed standardized language-test score is published; applicants must first agree a supervisor and research direction.",
    tuitionText: "Humanities and Social Sciences: CNY 11,600/semester or 22,400/year. Science, Engineering, Arts and Physical Education: CNY 13,050/semester or 25,300/year.",
    applicationNote: "Applicants must be non-Chinese citizens currently enrolled in an undergraduate or master's program and require an intended BNU supervisor and research direction.",
    source: bnuResearch,
  },
  {
    slug: "beijing-normal-university-scientific-research-senior-advanced-studies-spring-2027",
    nameEn: "Scientific Research Program - Senior Advanced Studies Student",
    fieldCategory: "Supervised research",
    subjectArea: "Pre-agreed research under a BNU supervisor; no coursework",
    teachingLanguage: "No fixed course language; this is supervised research with no coursework.",
    englishRequirement: "No fixed standardized language-test score is published; applicants must first agree a supervisor and research direction.",
    tuitionText: "Humanities and Social Sciences: CNY 14,900/semester or 29,000/year. Science, Engineering, Arts and Physical Education: CNY 19,000/semester or 37,200/year.",
    applicationNote: "Applicants must be non-Chinese citizens currently enrolled in a doctoral program and require an intended BNU supervisor and research direction.",
    source: bnuResearch,
  },
] as const;
const bnuPrograms: CatalogSeedProgram[] = bnuRouteSpecs.flatMap((route) => ([
  { slug: `${route.slug}-one-semester`, label: "One Semester" },
  { slug: `${route.slug}-one-academic-year`, label: "One Academic Year", durationYears: 1 },
].map((duration) => ({
  slug: duration.slug,
  schoolSlug: "beijing-normal-university",
  citySlug: "beijing",
  nameEn: `${route.nameEn} (${duration.label})`,
  degreeLevel: "Non-degree",
  ...(duration.durationYears ? { durationYears: duration.durationYears } : {}),
  fieldCategory: route.fieldCategory,
  subjectArea: route.subjectArea,
  teachingLanguage: route.teachingLanguage,
  englishRequirement: route.englishRequirement,
  tuitionText: route.tuitionText,
  applicationUrl: "https://international.bnu.edu.cn/",
  applicationNote: `${route.applicationNote} The selected study duration is ${duration.label.toLowerCase()}.`,
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: route.source.fetchedAt,
  ...sourceFields(route.source),
  sourceFieldLineage: {
    nameEn: "page heading and General Introduction",
    ...(duration.durationYears ? { durationYears: "General Introduction, one-academic-year option" } : {}),
    fieldCategory: "General Introduction",
    subjectArea: "General Introduction",
    teachingLanguage: route.source === bnuCredit ? "page heading" : "General Introduction, supervised research without coursework",
    englishRequirement: "Application Requirements and published absence of a universal score threshold",
    tuitionText: "Tuition Fees",
    applicationUrl: route.source === bnuCredit ? "Application Procedures" : "Application Process",
    applicationNote: "Application Requirements and General Introduction",
  },
}))));
const bnuIntakes: CatalogSeedProgramIntake[] = bnuPrograms.map((program) => ({ programSlug: program.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineLabel: "Application October 10-December 15, 2026; supplementary-material deadline December 20; study starts March 2027. The official page publishes dates without times.", applicationRound: "BNU Spring 2027 non-degree admission", status: "open", ...sourceFields(program.slug.includes("credit-program") ? bnuCredit : bnuResearch), sourceFieldLineage: { intakeTerm: "Application Period", intakeYear: "Application Period", deadlineLabel: "Application Period", applicationRound: "official 2027 brochure title", status: "application period compared with capturedAt" } }));

const bitSource = evidence.get("bit-pre-university-language-programs-pdf-2027")!;
type BitRoute = { kind: "Pre-University" | "Chinese Language"; duration: "One Semester" | "One Academic Year"; language: "Chinese" | "English"; field: string; tuition: number; requirement?: string };
const bitRoutes: BitRoute[] = [];
for (const duration of ["One Semester", "One Academic Year"] as const) {
  for (const language of ["Chinese", "English"] as const) {
    for (const field of ["Science and Engineering", "Liberal Arts and Business"] as const) {
      bitRoutes.push({ kind: "Pre-University", duration, language, field, tuition: duration === "One Semester" ? 15000 : 30000, requirement: language === "Chinese" ? (duration === "One Semester" ? "HSK 4" : "HSK 3") : "IELTS 6.0, TOEFL 85, Duolingo 110, or other recognized equivalent" });
    }
  }
  bitRoutes.push({ kind: "Chinese Language", duration, language: "Chinese", field: "Chinese language and culture", tuition: duration === "One Semester" ? 10000 : 20000 });
}
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const bitPrograms: CatalogSeedProgram[] = bitRoutes.map((route) => ({
  slug: `beijing-institute-of-technology-zhuhai-2027-${slugify(route.kind)}-${slugify(route.duration)}-${slugify(route.language)}-${slugify(route.field)}`,
  schoolSlug: "beijing-institute-of-technology", citySlug: "zhuhai", nameEn: `BIT Zhuhai ${route.kind} - ${route.duration}${route.kind === "Pre-University" ? ` (${route.field}, ${route.language}-taught)` : ""}`, degreeLevel: "Non-degree",
  ...(route.duration === "One Academic Year" ? { durationYears: 1 } : {}),
  fieldCategory: route.kind === "Pre-University" ? "Foundation and university preparation" : "Chinese language", subjectArea: route.field, teachingLanguage: route.language, ...(route.language === "Chinese" && route.requirement ? { hskRequirement: route.requirement } : route.kind === "Chinese Language" ? { hskRequirement: "No fixed HSK entry threshold is published; students are assigned to classes by their Chinese level on arrival." } : {}), ...(route.language === "English" && route.requirement ? { englishRequirement: route.requirement } : {}), tuitionAmount: route.tuition, tuitionCurrency: "CNY", tuitionPeriod: route.duration === "One Semester" ? "semester" : "academic year", tuitionText: `CNY ${route.tuition.toLocaleString("en-US")}/${route.duration === "One Semester" ? "semester" : "academic year"}; application fee CNY 500, insurance CNY 400-900/semester or 800-1,800/year, and published accommodation charges are separate.`, applicationNote: route.kind === "Pre-University" ? "Applicants must be non-Chinese citizens aged 18-24, have completed senior high school or above, and meet the applicable language requirement. The program includes CSCA guidance but does not guarantee later undergraduate admission." : "Applicants must be non-Chinese citizens aged 18-35 and have completed senior high school or above. Classes are assigned by language level on arrival.", status: "active", verificationStatus: "verified", lastVerifiedAt: bitSource.fetchedAt, ...sourceFields(bitSource), sourceFieldLineage: { nameEn: "pages 4-5 program headings and flexible-duration description",
    ...(route.duration === "One Academic Year" ? { durationYears: "pages 4-6 one-academic-year route" } : {}),
    fieldCategory: "program introduction", subjectArea: "page 4-5 curriculum tables", teachingLanguage: "page 4 program choice and language requirements", ...(route.language === "Chinese" && route.requirement ? { hskRequirement: "page 4 required application documents" } : route.kind === "Chinese Language" ? { hskRequirement: "page 5 Chinese-language program placement-by-level policy; no fixed HSK threshold is published" } : {}), ...(route.language === "English" && route.requirement ? { englishRequirement: "page 4 required application documents" } : {}), tuitionAmount: "page 6 Fees table", tuitionCurrency: "page 6 Fees table", tuitionPeriod: "pages 5-6 duration and Fees table", tuitionText: "page 6 Fees table", applicationNote: "pages 4-5 program introduction and Eligibility" },
}));
const bitIntakes: CatalogSeedProgramIntake[] = bitPrograms.flatMap((program) => ([
  { programSlug: program.slug, intakeTerm: "Spring" as const, intakeYear: 2027, deadlineLabel: "Application October 1, 2026-January 9, 2027. The official brochure publishes dates without times.", applicationRound: "BIT Zhuhai Spring 2027 non-degree admission", status: "open" as const, ...sourceFields(bitSource), sourceFieldLineage: { intakeTerm: "page 5 Application Period", intakeYear: "page 5 Application Period", deadlineLabel: "page 5 Application Period", applicationRound: "official brochure title", status: "application period compared with capturedAt" } },
  { programSlug: program.slug, intakeTerm: "Fall" as const, intakeYear: 2027, deadlineLabel: "Application October 1, 2026-June 30, 2027. The official brochure publishes dates without times.", applicationRound: "BIT Zhuhai Fall 2027 non-degree admission", status: "open" as const, ...sourceFields(bitSource), sourceFieldLineage: { intakeTerm: "page 5 Application Period", intakeYear: "page 5 Application Period", deadlineLabel: "page 5 Application Period", applicationRound: "official brochure title", status: "application period compared with capturedAt" } },
]));
const bitScholarship: CatalogSeedScholarship = {
  slug: "official-2027-bit-zhuhai-international-student-scholarship-new-students", title: "BIT Zhuhai International Student Scholarship (New Students)", schoolSlug: "beijing-institute-of-technology", providerName: "Beijing Institute of Technology, Zhuhai", applicableDegree: "Non-degree pre-university", applicableProgram: "BIT Zhuhai 2027 Pre-University Program", fundingLevel: "Partial", coverage: "50% of pre-university tuition fees", deadlineDate: "2027-05-15", deadlineLabel: "January 1, 2027 for March 2027 enrollment; May 15, 2027 for September 2027 enrollment.", requirementText: "Applicants must be eligible to apply for the pre-university scholarship and submit the published scholarship application form through the application system. Awards are allocated proportionally and remain subject to university scholarship review.", applicationRound: "BIT Zhuhai 2027 new international students", status: "active", verificationStatus: "verified", lastVerifiedAt: bitSource.fetchedAt, ...sourceFields(bitSource), sourceFieldLineage: { title: "page 4 scholarship box", schoolSlug: "official BIT Zhuhai brochure", providerName: "page 4 scholarship box", applicableDegree: "page 4 scholarship box", applicableProgram: "page 4 scholarship box", fundingLevel: "page 4 scholarship box", coverage: "page 4 scholarship box", deadlineDate: "page 4 Application Deadline", deadlineLabel: "page 4 Application Deadline", requirementText: "page 4 scholarship box", applicationRound: "official brochure title", status: "application period compared with capturedAt" },
};

const programs = [...bnuPrograms, ...bitPrograms];
const programIntakes = [...bnuIntakes, ...bitIntakes];
const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city("beijing"), city("zhuhai")], schools: [school("beijing-institute-of-technology"), school("beijing-normal-university")], programs, programIntakes, scholarships: [bitScholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 09 validation failed:\n${validation.errors.join("\n")}`);
const review = { version: 1, status: "unreviewed_draft", generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { schoolSlugs: ["beijing-institute-of-technology", "beijing-normal-university"], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 1, sourceSnapshots: evidence.size }, evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)), notes: ["This wave covers only explicitly published 2027 non-degree routes; neither school's 2026 degree catalog is relabeled.", "BIT pre-university rows separate two durations, two teaching languages and two curriculum fields; Chinese-language rows separate the two published durations. One academic year is represented as one year in the structured field; one-semester rows remain without a numeric duration because the brochure gives no exact month or week count.", "BIT application dates are shared across the published non-degree routes; both Spring and Fall 2027 intakes are retained without invented times.", "BNU Fall 2026 dates visible on the same pages are excluded because this wave covers the Spring 2027 intake.", "BNU routes allow either one semester or one academic year within the same published route, so no single structured duration is asserted for those rows.", "No applicant, account, passport, payment, or other personal data is included."] };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 2, programs: programs.length, programIntakes: programIntakes.length, scholarships: 1, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
