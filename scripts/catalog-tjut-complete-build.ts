import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/tjut-complete-20261016/manifest.json");
const cityPath = resolve(root, "seeds/catalog.tianjin-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.tjut-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tjut-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const cityBundle = JSON.parse(cityText) as CatalogSeedBundle;
const source = manifest.sources.find((row) => row.id === "tjut-international-student-admission-brochure-2026-2027");
const expectedSha256 = "5f1c66cdd222755a3243519ee8c777a8329213131cf4a2ddde3f9ce80b84f894";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error("TJUT official evidence mismatch.");
const schoolSlug = "tianjin-university-of-technology", citySlug = "tianjin";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Spec = readonly [degree: "Undergraduate" | "Master" | "Doctoral", school: string, name: string, duration: number, category: string, csca?: readonly string[]];
const specs: Spec[] = [
  ["Doctoral", "School of Materials Science and Engineering", "Materials Science and Engineering", 4, "Materials Science"],
  ["Master", "School of Management", "Business Administration", 3, "Business"],
  ["Master", "School of Computer Science and Engineering", "Electronic Information (Computer Technology)", 3, "Information Technology"],
  ["Master", "School of Mechanical Engineering", "Mechanical Engineering", 3, "Engineering"],
  ["Master", "School of Environmental Science and Engineering", "Environmental Engineering", 3, "Environmental Science"],
  ["Master", "School of Languages and Culture", "Teaching Chinese to Speakers of Other Languages", 3, "Education"],
  ["Master", "School of Languages and Culture", "English Language and Literature", 3, "Languages"],
  ["Master", "School of Languages and Culture", "Japanese Language and Literature", 3, "Languages"],
  ["Master", "School of Languages and Culture", "English Translation", 3, "Languages"],
  ["Master", "College of Science", "Applied Mathematics", 3, "Mathematics"],
  ["Master", "College of Science", "Applied Physics", 3, "Physics"],
  ["Master", "School of Materials Science and Engineering", "Materials Science and Engineering", 3, "Materials Science"],
  ["Master", "Maritime College", "Electronic Information (Engineering)", 3, "Information Technology"],
  ["Master", "School of Chemistry and Chemical Engineering", "Chemical Engineering", 3, "Chemical Engineering"],
  ["Master", "School of Chemistry and Chemical Engineering", "Chemical Engineering and Process Technology", 3, "Chemical Engineering"],
  ["Master", "School of Chemistry and Chemical Engineering", "Pharmaceutical Engineering and Technology", 3, "Pharmaceutical Science"],
  ["Master", "School of Chemistry and Chemical Engineering", "Chemistry", 3, "Chemistry"],
  ["Undergraduate", "School of Management", "Business Administration", 4, "Business", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Management", "Industrial Engineering", 4, "Engineering", ["Chinese for STEM", "Mathematics", "Physics"]],
  ["Undergraduate", "School of Management", "Accounting", 4, "Business", ["Chinese for Humanities", "Mathematics"]],
  ["Undergraduate", "School of Computer Science and Engineering", "Computer Science and Technology", 4, "Computer Science", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Computer Science and Engineering", "Information Security", 4, "Computer Science", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Computer Science and Engineering", "Internet of Things Engineering", 4, "Computer Science", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Computer Science and Engineering", "Data Science and Big Data Technology", 4, "Data Science", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Mechanical Engineering", "Mechanical Engineering", 4, "Engineering", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Environmental Science and Engineering", "Environmental Science", 4, "Environmental Science", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Languages and Cultures", "Chinese Language and Literature", 4, "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Undergraduate", "School of Languages and Cultures", "English", 4, "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Undergraduate", "School of Languages and Cultures", "Japanese", 4, "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Undergraduate", "College of Science", "Applied Mathematics", 4, "Mathematics", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "College of Science", "Applied Physics", 4, "Physics", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "TUT Maritime College", "Navigation Technology", 4, "Maritime", ["Chinese for STEM", "Mathematics", "Physics", "Chemistry"]],
  ["Undergraduate", "TUT Maritime College", "Marine Engineering", 4, "Maritime", ["Chinese for STEM", "Mathematics", "Physics", "Chemistry"]],
  ["Undergraduate", "TUT Maritime College", "Marine Electrical and Electronic Engineering", 4, "Maritime", ["Chinese for STEM", "Mathematics", "Physics", "Chemistry"]],
  ["Undergraduate", "School of Chemistry and Chemical Engineering", "Chemical Engineering and Process Technology", 4, "Chemical Engineering", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Chemistry and Chemical Engineering", "Pharmaceutical Engineering", 4, "Pharmaceutical Science", ["Chinese for STEM", "Mathematics"]],
  ["Undergraduate", "School of Fine Arts", "Visual Communication Design", 4, "Arts", ["Chinese for Humanities", "Mathematics"]],
  ["Undergraduate", "School of Fine Arts", "Environmental Design", 4, "Arts", ["Chinese for Humanities", "Mathematics"]],
];
const tuition = { Undergraduate: 16400, Master: 20500, Doctoral: 32000 } as const;
const programs: CatalogSeedProgram[] = specs.map(([degreeLevel, school, nameEn, durationYears, fieldCategory, cscaSubjects]) => ({
  slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slugify(school)}-${slugify(nameEn)}`,
  schoolSlug, citySlug, nameEn, degreeLevel, durationYears, fieldCategory, subjectArea: nameEn,
  teachingLanguage: "Chinese", hskRequirement: "HSK Level 4 score 180 or above.",
  ...(cscaSubjects ? { cscaSubjects: [...cscaSubjects], cscaRequirement: `Required CSCA subjects: ${cscaSubjects.join(", ")}.` } : {}),
  tuitionAmount: tuition[degreeLevel], tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${tuition[degreeLevel].toLocaleString("en-US")}/year`,
  scholarshipText: "Chinese Government Scholarship, Tianjin Government Scholarship and university partial scholarship routes are published.",
  applicationUrl: "https://tjut.at0086.cn/StuApplication/Login.aspx", applicationNote: "Official 2026-2027 Chinese-taught route; application period November 20, 2025 to May 31, 2026.",
  hasScholarship: true, displayGroup: `${degreeLevel.toLowerCase()}-${slugify(school)}`, displayGroupLabel: school, status: "draft", ...evidence,
  sourceFieldLineage: { nameEn: "Majors and Program Duration table", degreeLevel: "Majors and Program Duration table", durationYears: "Majors and Program Duration table", teachingLanguage: "Medium of Instruction column", ...(cscaSubjects ? { cscaSubjects: "Required Subjects of CSCA column", cscaRequirement: "Required Subjects of CSCA column" } : {}), hskRequirement: "Application Eligibility item 3", tuitionAmount: "Fees table", applicationUrl: "How to Apply section" },
}));
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2025-11-20T00:00:00.000Z", deadlineDate: "2026-05-31T15:59:59.000Z", deadlineLabel: "May 31, 2026", applicationRound: "2026-2027 international admission", status: "closed" as const, ...evidence, sourceFieldLineage: { openDate: "How to Apply item 3", deadlineDate: "How to Apply item 3" } }));
const scholarship = (slug: string, title: string, nameZh: string, fundingLevel: string, coverage: string): CatalogSeedScholarship => ({ slug, title, nameZh, schoolSlug, type: slug.includes("government") ? "government" : "university", typeLabel: title.replace(/^TJUT 2026 /, ""), providerName: "天津理工大学", providerNameEn: "Tianjin University of Technology", providerLocation: "Tianjin, China", fundingLevel, coverage, applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Published TJUT international degree programs", amountText: "Exact amount not stated in the reviewed brochure", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026 general admission deadline; confirm any scholarship-specific deadline", applicationRound: "2026-2027 international admission", targetCountries: [], targetRegions: [], eligibilityItems: [{ label: "Selection", value: "Student application and university review under the annual quota and overall-quality ranking." }], applicationSteps: [{ label: "Step 1", value: "Submit the scholarship request with the university application." }, { label: "Step 2", value: "The university reviews and ranks eligible applicants." }], actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" }], summary: coverage, status: "draft", ...evidence, sourceFieldLineage: { title: "Scholarships table", fundingLevel: "Scholarships table", coverage: "Scholarships table", applicableDegree: "Scholarships table", deadlineDate: "general application period; scholarship-specific deadline not stated" } });
const scholarships = [
  scholarship("official-2026-tjut-chinese-government-scholarship", "TJUT 2026 Chinese Government Scholarship", "天津理工大学2026年中国政府奖学金", "Full", "Tuition, insurance, accommodation and living expenses."),
  scholarship("official-2026-tjut-tianjin-government-scholarship", "TJUT 2026 Tianjin Government Scholarship", "天津理工大学2026年天津市政府奖学金", "Full or partial", "Tuition coverage; exact full or partial amount is not stated."),
  scholarship("official-2026-tjut-university-scholarship", "TJUT 2026 University Scholarship", "天津理工大学2026年校级奖学金", "Partial", "Partial scholarship; exact benefit is not stated."),
];
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: cityBundle.cities?.slice(0, 1), schools: [{ slug: schoolSlug, nameEn: "Tianjin University of Technology", nameZh: "天津理工大学", citySlug, schoolType: "Public", region: "Tianjin, North China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese for all reviewed 2026-2027 routes", languageRequirement: "HSK Level 4 score 180 or above for Chinese-taught programs.", hskRequirement: "HSK Level 4 score 180 or above.", deadlineSummary: "Applications ran from November 20, 2025 to May 31, 2026; no later cycle is inferred.", tuitionSummary: "Undergraduate CNY 16,400/year; master CNY 20,500/year; doctoral CNY 32,000/year.", applicationFee: "CNY 400 after admission for non-scholarship recipients", websiteUrl: "https://www.tjut.edu.cn/", admissionsUrl: source.finalUrl, cscaRequired: true, cscaRequirement: "Undergraduate applicants must take the exact CSCA subjects published for the selected program; graduate rows state none.", cscaSubjects: ["Chinese for STEM", "Chinese for Humanities", "Mathematics", "Physics", "Chemistry"], subjectTags: ["Engineering", "Computer Science", "Materials", "Maritime", "Business", "Languages", "Science", "Arts"], languageTags: ["Chinese"], campusHighlights: ["Tianjin location", "Engineering and technology focus", "38 reviewed international degree routes"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "brochure heading", nameZh: "official university identity", citySlug: "official address", applicationLevel: "program tables", languageRequirement: "Application Eligibility item 3", deadlineSummary: "How to Apply item 3", tuitionSummary: "Fees table", applicationFee: "How to Apply item 4", cscaRequirement: "program tables and How to Apply item 2" } }], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["All 38 program rows, teaching language, duration, tuition and undergraduate CSCA subjects come from the acquired official brochure.", "No program or scholarship amount beyond the brochure is inferred.", "Personal contact and payment details are excluded."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
