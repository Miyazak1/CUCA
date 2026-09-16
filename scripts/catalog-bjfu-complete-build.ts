import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = {
  admissionManifest: resolve(root, "work/catalog-official/bjfu-complete-batch-01/manifest.json"),
  programManifest: resolve(root, "work/catalog-official/bjfu-program-pages-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/bjfu-program-pages-01/parsed-programs.json"),
  base: resolve(root, "seeds/catalog.cau-complete-batch-01.approved.local.json"),
  draft: resolve(root, "seeds/catalog.bjfu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.bjfu-complete-batch-01.validation.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [admissionManifestText, programManifestText, parsedText, baseText] = await Promise.all([
  readFile(paths.admissionManifest, "utf8"), readFile(paths.programManifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.base, "utf8"),
]);
const admissionManifest = JSON.parse(admissionManifestText), programManifest = JSON.parse(programManifestText), parsed = JSON.parse(parsedText), base = JSON.parse(baseText) as CatalogSeedBundle;
const expected: Record<string, string> = {
  "bjfu-undergraduate-prospectus-2026": "0f65891ffda216b74665fa004b6ac2a245ad26b7bdee0228200fcb72601408c7",
  "bjfu-degree-program-index-current": "fda31b4fe514af09c9178c77bc7a0eb28e63fc11cabbceb8428421dc181d1fe3",
  "bjfu-scholarship-index-current": "68263940c23e2fca652ef601d05064db2878e220d35ed063bb20c8e13ea0443a",
  "bjfu-undergraduate-program-index-current": "3ee906dba2bf5d8115d7d40181620b01d30bf608fb050e6df093eb406d3f1889",
  "bjfu-master-program-index-current": "f0bb98cde1c83669b14a8a90416de22cbe3a9ac0a297918b8249ab8c8aa2f165",
  "bjfu-doctoral-program-index-current": "75375048219c838a0c34c303b0bf834e2c19ea81a96a5d968254352d65b322b8",
  "bjfu-application-procedure-current": "e95bca92bceb7a985e92a7e65235cae20681fadd711c259178c7192fbf3be43c",
};
const evidence = new Map<string, any>();
for (const manifest of [admissionManifest, programManifest]) for (const row of manifest.sources ?? []) if (row.status === 200 && expected[row.id] === row.sha256) evidence.set(row.id, row);
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length || parsed.programCount !== 149 || parsed.duplicateIdentities.length) throw new Error(`BJFU evidence/parser mismatch: ${missing.join(",")}`);
const expectedCounts = { "Undergraduate-Chinese": 37, "Master-English": 9, "Master-Chinese": 62, "Doctoral-English": 10, "Doctoral-Chinese": 31 };
if (JSON.stringify(parsed.counts) !== JSON.stringify(expectedCounts)) throw new Error(`BJFU parsed counts changed: ${JSON.stringify(parsed.counts)}`);
const city = base.cities?.find((row) => row.slug === "beijing");
if (!city) throw new Error("Current Beijing city dependency missing.");

const schoolSlug = "beijing-forestry-university";
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const used = new Set<string>();
const programs: CatalogSeedProgram[] = parsed.programs.map((row: any, index: number) => {
  const source = evidence.get(row.sourceId), undergraduate = row.degreeLevel === "Undergraduate";
  let slug = `${schoolSlug}-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-${slugify(row.school)}-${row.teachingLanguage.toLowerCase()}`;
  if (used.has(slug)) slug = `${slug}-${index + 1}`;
  used.add(slug);
  const years = /^\d$/.test(row.durationText) ? Number(row.durationText) : undefined;
  return {
    slug, schoolSlug, citySlug: "beijing", nameEn: row.nameEn, degreeLevel: row.degreeLevel,
    ...(years ? { durationYears: years } : {}), fieldCategory: row.school, subjectArea: row.school,
    teachingLanguage: row.teachingLanguage,
    ...(undergraduate ? { cscaSubjects: ["Chinese", "Mathematics"], cscaRequirement: "CSCA is mandatory for all applicants; the exact Chinese track and optional Physics or Chemistry subject depend on the school/program." } : { cscaRequirement: "No CSCA requirement is published for this postgraduate route." }),
    ...(undergraduate ? { hskRequirement: "HSK Level 4 or above" } : {}),
    ...(undergraduate ? { tuitionAmount: 24800, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "CNY 24,800/year" } : {}),
    scholarshipText: undergraduate ? "Three official 2026 scholarship routes are listed for undergraduate applicants; award decisions and annual renewal are not guaranteed." : "No current scholarship entitlement is inferred from the program catalog.",
    applicationUrl: "https://bjfu.at0086.cn/student",
    applicationNote: `Official ${row.degreeLevel.toLowerCase()} route in ${row.teachingLanguage}; ${row.school}; published award: ${row.degreeAward}; published duration: ${row.durationText} year(s).`,
    hasScholarship: undergraduate, status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: { nameEn: `program table ${row.sourceTable}, row ${row.sourceRow}`, degreeLevel: "official page degree heading", durationYears: `program table ${row.sourceTable}, row ${row.sourceRow}`, fieldCategory: `program table ${row.sourceTable}, row ${row.sourceRow}`, teachingLanguage: "official page language section", ...(undergraduate ? { hskRequirement: "2026 undergraduate prospectus eligibility", tuitionAmount: "2026 undergraduate prospectus fees" } : {}), applicationUrl: "official application procedure" },
  };
});
if (programs.length !== 149 || used.size !== 149) throw new Error("BJFU program build mismatch.");

const ugSource = evidence.get("bjfu-undergraduate-prospectus-2026");
const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const materials = [info("Passport information page"), info("Notarized high-school diploma"), info("High-school transcript"), info("HSK certificate"), info("CSCA transcript"), info("Study plan"), info("No-criminal-record certificate"), info("Two recommendation letters"), info("Physical examination form")];
function scholarship(value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship {
  return { schoolSlug, status: "draft", sourceUrl: ugSource.url, sourceLabel: ugSource.label, sourceSha256: ugSource.sha256, capturedAt: ugSource.fetchedAt, providerLocation: "China", targetCountries: [], targetRegions: [], actionLinks: [{ label: "BFU 2026 undergraduate prospectus", url: ugSource.url, kind: "official-source" }, { label: "BFU international application system", url: "https://bjfu.at0086.cn/student", kind: "official-application" }], sourceFieldLineage: { title: "2026 prospectus scholarship section", fundingLevel: "2026 prospectus coverage wording", coverage: "2026 prospectus scholarship section", amountText: "2026 prospectus coverage wording; no exact cash amount published", applicableDegree: "2026 prospectus scholarship eligibility", eligibilityItems: "2026 prospectus eligibility and annual review note", applicationMaterials: "2026 prospectus required materials", applicationSteps: "2026 prospectus application procedure", ...(value.deadlineDate ? { deadlineDate: "2026 prospectus scholarship deadline" } : { deadlineLabel: "2026 prospectus scholarship deadline policy" }) }, ...value };
}
const scholarships: CatalogSeedScholarship[] = [
  scholarship({ slug: "official-2026-bjfu-cgs-type-a-undergraduate", title: "Beijing Forestry University 2026 Chinese Government Scholarship Type A", nameZh: "北京林业大学2026年中国政府奖学金A类本科项目", type: "government", typeLabel: "Chinese Government Scholarship Type A", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, accommodation, insurance and living allowance", applicableDegree: "Undergraduate", applicableProgram: "Eligible 2026 Beijing Forestry University undergraduate programs", amountText: "Full tuition, accommodation and insurance plus a living allowance; exact allowance amount is not stated in the prospectus.", deadlineLabel: "Set by the Chinese embassy or consulate in the applicant's home country", applicationRound: "2026 CSC Type A", benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Insurance"), benefit("Living allowance")], eligibilityItems: [info("Route", "Apply through the Chinese embassy or consulate and select Type A"), info("Institution preference", "List Beijing Forestry University as the first-priority institution"), info("Annual review", "Continued funding depends on the published annual review")], applicationMaterials: materials, applicationSteps: [info("Step 1", "Confirm the deadline with the Chinese embassy or consulate"), info("Step 2", "Submit the CSC Type A application and list BFU first"), info("Step 3", "Complete BFU undergraduate admission and CSCA requirements")], summary: "Full 2026 CSC Type A undergraduate route published by BFU.", sortOrder: 10 }),
  scholarship({ slug: "official-2026-bjfu-beijing-government-undergraduate", title: "Beijing Forestry University 2026 Beijing Government Scholarship", nameZh: "北京林业大学2026年北京市政府奖学金", type: "government", typeLabel: "Beijing Government Scholarship", providerName: "北京市人民政府 / 北京林业大学", providerNameEn: "Beijing Municipal Government / Beijing Forestry University", fundingLevel: "Partial", coverage: "Full or partial tuition support", applicableDegree: "Undergraduate", applicableProgram: "Eligible 2026 Beijing Forestry University undergraduate programs", amountText: "Full or partial tuition coverage; the prospectus does not publish a fixed cash amount.", deadlineDate: "2026-06-08", deadlineLabel: "June 8, 2026", applicationRound: "2026 undergraduate admissions", benefitItems: [benefit("Tuition support", "Full or partial, subject to award decision")], eligibilityItems: [info("Selection", "Awarded by BFU under Beijing municipal authorization"), info("Annual review", "Academic performance, learning attitude, attendance, conduct and awards are reviewed annually")], applicationMaterials: materials, applicationSteps: [info("Step 1", "Submit the BFU undergraduate application"), info("Step 2", "Indicate scholarship intent in the application system"), info("Step 3", "Complete school review and await the award decision")], summary: "2026 Beijing municipal tuition scholarship for BFU undergraduate applicants.", sortOrder: 20 }),
  scholarship({ slug: "official-2026-bjfu-experience-beilin-scholarship", title: "Beijing Forestry University 2026 Experience Beilin Scholarship", nameZh: "北京林业大学2026年感知北林奖学金", type: "university", typeLabel: "Experience Beilin Scholarship", providerName: "北京林业大学", providerNameEn: "Beijing Forestry University", fundingLevel: "Partial", coverage: "Full or partial tuition and accommodation support", applicableDegree: "Undergraduate", applicableProgram: "Eligible 2026 Beijing Forestry University undergraduate programs", amountText: "Full or partial tuition and accommodation coverage; no fixed cash amount is published.", deadlineDate: "2026-06-08", deadlineLabel: "June 8, 2026", applicationRound: "2026 undergraduate admissions", benefitItems: [benefit("Tuition support", "Full or partial"), benefit("Accommodation support", "Full or partial")], eligibilityItems: [info("Merit", "Recognizes outstanding academic excellence in specific fields"), info("Annual review", "Continued funding depends on academic performance, attitude, attendance, conduct and awards")], applicationMaterials: materials, applicationSteps: [info("Step 1", "Submit the BFU undergraduate application"), info("Step 2", "Indicate scholarship intent in the application system"), info("Step 3", "Complete school review and await the award decision")], summary: "BFU's 2026 merit scholarship with full or partial tuition and accommodation support.", sortOrder: 30 }),
];

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: admissionManifest.generatedAt, cities: [city],
  schools: [{ slug: schoolSlug, nameEn: "Beijing Forestry University", nameZh: "北京林业大学", citySlug: "beijing", schoolType: "Public", region: "Beijing, North China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese undergraduate; Chinese and English postgraduate", hskRequirement: "HSK Level 4 or above for 2026 undergraduate admission.", deadlineSummary: "Undergraduate application deadline: June 15, 2026. Graduate deadline is not published in the captured compliant sources.", tuitionSummary: "Undergraduate tuition: CNY 24,800/year. Current graduate tuition is not published in the captured compliant sources.", applicationFee: "CNY 800, non-refundable", websiteUrl: "https://www.bjfu.edu.cn/", admissionsUrl: "https://ic.bjfu.edu.cn/", cscaRequired: true, cscaRequirement: "All 2026 undergraduate applicants must take CSCA; required/optional subjects vary by school.", cscaSubjects: ["Chinese", "Mathematics", "Physics", "Chemistry"], subjectTags: ["Forestry", "Landscape Architecture", "Ecology", "Environmental Science", "Biological Science", "Economics and Management"], languageTags: ["Chinese", "English"], campusHighlights: ["National key university", "Forestry and landscape architecture", "International students from about 70 countries"], status: "draft", sourceUrl: ugSource.url, sourceLabel: ugSource.label, sourceSha256: ugSource.sha256, capturedAt: ugSource.fetchedAt, sourceFieldLineage: { nameEn: "2026 undergraduate prospectus cover and profile", nameZh: "2026 undergraduate prospectus", citySlug: "official contact address", applicationLevel: "current official degree program pages", languageOfInstruction: "current official degree program pages", hskRequirement: "2026 undergraduate prospectus eligibility", deadlineSummary: "2026 undergraduate prospectus deadline; graduate gap explicitly retained", tuitionSummary: "2026 undergraduate prospectus fees; graduate gap explicitly retained", applicationFee: "2026 undergraduate prospectus fees", cscaSubjects: "2026 undergraduate prospectus CSCA table" } }],
  programs,
  programIntakes: programs.map((program) => { const source = evidence.get(parsed.programs.find((row: any) => row.nameEn === program.nameEn && row.degreeLevel === program.degreeLevel && row.school === program.fieldCategory && row.teachingLanguage === program.teachingLanguage)?.sourceId); const undergraduate = program.degreeLevel === "Undergraduate"; return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, ...(undergraduate ? { deadlineDate: "2026-06-15T00:00:00.000Z", deadlineLabel: "June 15, 2026", status: "closed" as const } : { deadlineLabel: "Not published in the captured compliant source" }), applicationRound: "2026 international degree catalog", sourceUrl: undergraduate ? ugSource.url : source.url, sourceLabel: undergraduate ? ugSource.label : source.label, sourceSha256: undergraduate ? ugSource.sha256 : source.sha256, capturedAt: undergraduate ? ugSource.fetchedAt : source.fetchedAt, sourceFieldLineage: undergraduate ? { deadlineDate: "2026 undergraduate prospectus application deadline" } : { deadlineLabel: "explicit source gap; no date inferred" } }; }),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`, validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`BJFU candidate invalid:\n${validation.errors.join("\n")}`);
await Promise.all([writeFile(paths.draft, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify({ ...validation, admissionManifestSha256: sha(admissionManifestText), programManifestSha256: sha(programManifestText), parsedArtifactSha256: sha(parsedText), extractionCounts: parsed.counts, sourceLimitNote: "The separate graduate prospectus exceeded the skill's 15 MiB per-file limit and was not captured or used; graduate fee/deadline fields remain explicitly unpublished." }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, summary: validation.summary, counts: parsed.counts, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, paths }, null, 2));
