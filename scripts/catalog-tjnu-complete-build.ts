import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-28-30-648Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.tjnu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tjnu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((row) => row.id === "tjnu-international-student-admissions-pdf-2026");
if (!source || source.status !== 200 || source.sha256 !== "a0c6f58087ae5d3c29e0bedfa66344b1d26414ed15b6b37b8d00ef64340c645b") throw new Error("TJNU official evidence mismatch.");

const schoolSlug = "tianjin-normal-university";
const citySlug = "tianjin";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Degree = "Undergraduate" | "Master" | "Doctoral";
type Group = readonly [category: string, names: readonly string[]];
const undergraduateGroups: Group[] = [
  ["Education", ["Pedagogy", "Primary Education", "Preschool Education", "Educational Technology"]],
  ["Psychology", ["Applied Psychology"]],
  ["Languages and Literature", ["English", "Japanese", "Russian", "Korean", "French"]],
  ["Media", ["Journalism", "Advertising", "Broadcasting and Television", "Announcing and Anchoring", "Radio and Television Editing Production"]],
  ["History", ["History", "Cultural Heritage and Museum", "World History"]],
  ["Politics and Public Administration", ["Social Work", "Public Administration", "Politics and Public Administration"]],
  ["Sports", ["Physical Education"]], ["Law", ["Law"]],
  ["Economics", ["Economics", "International Economics and Trade", "Investment"]],
  ["Management", ["Information Management and Information System", "Logistics Management", "Business Administration", "Accounting", "Archival Studies", "Big Data Management and Application"]],
  ["Arts", ["Music Performance", "Dancology", "Literature of Drama and Film", "Performance", "Musicology", "Fine Arts", "Chinese Painting", "Painting", "Fashion Design", "Visual Communication Design", "Environmental Design", "Digital Media Arts", "Performance (Fashion Show and Image Design)"]],
  ["Mathematics", ["Mathematics and Applied Mathematics", "Information and Computational Sciences", "Data Computing and Applications"]],
  ["Physics and Materials", ["Physics", "Applied Physics"]],
  ["Information Technology", ["Communication Engineering", "Electronic Information Science and Technology", "Artificial Intelligence", "Computer Science and Technology", "Internet of Things Engineering", "Data Science and Big Data Technology", "Software Engineering"]],
  ["Chemistry", ["Chemistry", "Chemical Biology"]], ["Life Sciences", ["Biological Sciences", "Biotechnology"]],
  ["Geography", ["Geography Science", "Human Geography and Urban Planning", "Geoinformatics"]],
  ["International Chinese Education", ["Teaching Chinese to Speakers of Other Languages", "Chinese Language and Literature (Economic and Trade)", "International Economics and Trade (Technical Chinese + Digital International Trade)", "Visual Communication and Design (Technical Chinese + Visual Communication Design)"]],
];
const masterGroups: Group[] = [
  ["Education", ["Fundamental Principles of Education", "Curriculum and Pedagogy", "History of Education", "Comparative Education", "Preschool Education", "Elementary Education", "Teacher Pedagogy", "Educational Administration", "Modern Education Technology", "Primary Education", "Educational Technology", "Youth Organizations and Ideological Education"]],
  ["Psychology", ["Fundamental Psychology", "Developmental and Educational Psychology", "Applied Psychology", "Mental Health Education"]],
  ["Languages and Literature", ["Literary Theory", "Chinese Linguistics", "Chinese Classical Philology", "Ancient Chinese Literature", "Modern and Contemporary Chinese Literature", "Comparative Literature and World Literature", "English Translation", "English Interpretation", "Korean Translation", "Korean Interpretation"]],
  ["Media", ["New Media and Digital Communication", "Journalism and Communication", "Art Studies", "Literature of Drama and Film"]],
  ["History", ["Archaeology", "Chinese History", "Museum", "World History"]],
  ["Politics and Public Administration", ["Chinese and Foreign Political Systems", "International Politics", "Political Theory", "National Governance", "International Affairs", "Sociology", "Social Work", "Public Administration Studies"]],
  ["Sports", ["Sports Studies", "Physical Education", "Athletic Training"]],
  ["Law", ["Legal Theory", "Constitution and Administrative Law", "Civil and Commercial Law", "Procedural Law", "Economic Law", "Criminal Law"]],
  ["Economics", ["Theoretical Economics", "Finance"]],
  ["Management", ["Business Management", "Technology Economics and Management", "Library Science", "Information Science", "Archival Studies", "Management Science and Engineering", "Accounting", "Business Administration", "Library and Information Science"]],
  ["Arts", ["Musicology", "Theatre and Film Studies", "Art Studies", "Fine Arts and Calligraphy", "Design Studies"]],
  ["Mathematics", ["History of Scientific Technology", "Mathematics"]],
  ["Physics and Materials", ["Physics", "Astronomy", "Materials Science and Engineering", "Material Engineering"]],
  ["Information Technology", ["Information and Communication Engineering", "Intelligent Science and Technology", "Communication Engineering", "Artificial Intelligence", "Computer Science and Technology", "Big Data Science and Engineering", "Software Engineering"]],
  ["Chemistry", ["Chemistry", "Chemical Engineering"]],
  ["Life Sciences", ["Botany", "Zoology", "Aquatic Biology", "Microbiology", "Genetics", "Cell Biology", "Ecology"]],
  ["Geography", ["Physical Geography", "Human Geography", "Cartography and Geographic Information System", "Environmental Geography"]],
  ["International Chinese Education", ["International Chinese Language Education", "Linguistics and Applied Linguistics"]],
];
const doctoralGroups: Group[] = [
  ["Education", ["Curriculum and Instruction"]],
  ["Psychology", ["Basic Psychology", "Developmental and Educational Psychology", "Applied Psychology", "Student Development and Education"]],
  ["Languages and Literature", ["Chinese Linguistics", "Ancient Chinese Literature", "Modern and Contemporary Chinese Literature", "Comparative Literature and World Literature"]],
  ["Media", ["New Media and Digital Communication"]], ["History", ["Chinese History", "World History"]],
  ["Politics and Public Administration", ["International Politics", "Chinese and Foreign Political Systems", "Government and Public Policy", "Political Theory"]],
  ["Management", ["Information Resources Management"]], ["Chemistry", ["Chemistry"]], ["Life Sciences", ["Biology"]], ["Geography", ["Geography"]],
  ["International Chinese Education", ["International Chinese Language Education"]],
];

const noHskUndergraduate = new Set(["Teaching Chinese to Speakers of Other Languages", "Chinese Language and Literature (Economic and Trade)", "International Economics and Trade (Technical Chinese + Digital International Trade)", "Visual Communication and Design (Technical Chinese + Visual Communication Design)"]);
const makePrograms = (groups: Group[], degreeLevel: Degree): CatalogSeedProgram[] => {
  const seen = new Set<string>();
  return groups.flatMap(([fieldCategory, names]) => names.filter((nameEn) => !seen.has(nameEn) && Boolean(seen.add(nameEn))).map((nameEn) => {
  const art = ["Announcing and Anchoring", "Radio and Television Editing Production", "Literature of Drama and Film", "Music Performance", "Dancology", "Performance", "Musicology", "Fine Arts", "Chinese Painting", "Painting", "Fashion Design", "Visual Communication Design", "Environmental Design", "Digital Media Arts", "Performance (Fashion Show and Image Design)", "Fine Arts and Calligraphy", "Visual Communication and Design (Technical Chinese + Visual Communication Design)"].includes(nameEn);
  const tuitionAmount = degreeLevel === "Undergraduate" ? (art ? 21200 : 17800) : degreeLevel === "Master" ? 24800 : 28800;
  const hskRequirement = degreeLevel === "Undergraduate" ? (noHskUndergraduate.has(nameEn) ? undefined : "HSK Level 4, minimum score 180.") : nameEn === "International Chinese Language Education" && degreeLevel === "Master" ? "HSK Level 4, minimum score 180, for the self-funded Chinese-language master's route." : "HSK Level 5, minimum score 180.";
  return {
    slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slugify(nameEn)}`, schoolSlug, citySlug, nameEn, degreeLevel,
    ...(degreeLevel === "Undergraduate" ? { durationYears: 4 } : {}), fieldCategory, subjectArea: nameEn, teachingLanguage: "Chinese",
    ...(hskRequirement ? { hskRequirement } : {}), tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
    applicationNote: "The 2026 brochure lists this route in its degree-program academic categories. Master's duration is 2-3 years and doctoral duration is 3-6 years; the exact range is retained here rather than converted into a false single duration. The listed application portal is HTTP-only, so applicationUrl remains absent under the HTTPS-only catalog contract.",
    hasScholarship: true, status: "draft", ...evidence,
    sourceFieldLineage: { nameEn: "III. Academic Categories table", degreeLevel: "III. Academic Categories table", teachingLanguage: "degree-program language requirements", ...(hskRequirement ? { hskRequirement: "II.4 Degree Program requirements and notes" } : {}), tuitionText: "II.4 Degree Program expense standard" },
  };
  }));
};
const programs = [...makePrograms(undergraduateGroups, "Undergraduate"), ...makePrograms(masterGroups, "Master"), ...makePrograms(doctoralGroups, "Doctoral")];
const duplicateSlugs = programs.map((row) => row.slug).filter((slug, index, all) => all.indexOf(slug) !== index);
if (duplicateSlugs.length) throw new Error(`Duplicate TJNU program slugs: ${duplicateSlugs.join(", ")}`);

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Tianjin", nameZh: "天津", province: "Tianjin", region: "North China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "I. Introduction", nameZh: "official university identity", province: "I. Introduction", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "Tianjin Normal University", nameZh: "天津师范大学", citySlug, schoolType: "Public", region: "Tianjin, North China", applicationLevel: "Undergraduate, Master, Doctoral, Preparatory, Chinese Language", languageOfInstruction: "Chinese for the degree routes listed in the reviewed brochure", languageRequirement: "Undergraduate: HSK 4 (180), with stated self-funded Chinese-plus exceptions. Master and doctoral: HSK 5 (180), except the stated self-funded Chinese-language master's routes use HSK 4 (180).", hskRequirement: "HSK 4 or HSK 5 with at least 180 points, depending on level and route.", tuitionSummary: "Undergraduate general CNY 17,800/year; undergraduate arts CNY 21,200/year; master's CNY 24,800/year; doctoral CNY 28,800/year.", websiteUrl: "https://gjjl.tjnu.edu.cn/", admissionsUrl: source.finalUrl, subjectTags: [...new Set([...undergraduateGroups, ...masterGroups, ...doctoralGroups].map(([category]) => category))], languageTags: ["Chinese", "HSK 4", "HSK 5"], campusHighlights: ["Tianjin location", "Bachelor's, master's and doctoral routes", "Chinese-language and preparatory study"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "brochure title", nameZh: "official university identity", citySlug: "I. Introduction", schoolType: "official university identity", applicationLevel: "II. Programs", languageRequirement: "II.4 Degree Program requirements and notes", tuitionSummary: "II.4 Degree Program expense standard", websiteUrl: "VIII. Contact Information", admissionsUrl: "registered official PDF" } }],
  programs, programIntakes: [], scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["Degree-program names and level groupings are transcribed from the official 2026 academic-category tables.", "The PDF supplies duration ranges for master's and doctoral study, so no false single duration value is created.", "The brochure contains no degree-program application deadline; no intake deadline is inferred.", "Named scholarship routes have no award table in this brochure and are not converted into detailed scholarship records.", "Personal contact details and applicant documents are excluded."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
