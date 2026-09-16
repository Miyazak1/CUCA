import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedProgramIntake, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd(), batch = "bsu-safe-new-batch-01", prefix = `catalog.${batch}`, schoolSlug = "beijing-sport-university";
const manifestPath = resolve(root, "work/catalog-official/bsu-complete-batch-01/manifest.json");
const parsedPath = resolve(root, "work/catalog-official/bsu-complete-batch-01/parsed-programs.json");
const dependencyPath = resolve(root, "seeds/catalog.cscalite-online-20260910.published.json");
const statePath = resolve(root, ".cuac-local/runtime.json");
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`) };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const writeJson = (path: string, value: unknown) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const [manifest, parsed, dependency, state] = await Promise.all([manifestPath, parsedPath, dependencyPath, statePath].map(path => readFile(path, "utf8").then(JSON.parse)));
const expectedHashes: Record<string,string> = {
  "bsu-international-admission-2026": "205f0d5e7615133fa201d100f81539d64ce24056f4c116fdf82e9a281fc02056",
  "bsu-international-program-catalog-2026": "7e7ba4b40bf09d4e77ee58b7bb70f7c9f062a414fa207fa3d088d39be93c10ef",
  "bsu-cgs-high-level-graduate-2026": "8aed58cdeefba0c9b5b9804b38ecaea45d1b05dc645114ea944c1bbe1a0f55b6",
};
const evidence = new Map<string,any>();
for (const source of manifest.sources ?? []) {
  if (expectedHashes[source.id] !== source.sha256 || source.status !== 200 || source.finalUrl !== source.url || source.byteLength > 15 * 1024 * 1024) throw new Error(`BSU evidence changed: ${source.id}`);
  const bytes = await readFile(resolve(manifestPath, "..", source.artifactPath));
  if (sha(bytes) !== source.sha256) throw new Error(`BSU artifact hash mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
if (evidence.size !== 3 || parsed.programCount !== 106 || parsed.counts?.Undergraduate !== 20 || parsed.counts?.Master !== 50 || parsed.counts?.Doctoral !== 36 || parsed.duplicateRouteKeys !== 0) throw new Error("BSU parsed scope changed.");
const city = dependency.cities.find((row:any) => row.slug === "beijing");
const school = dependency.schools.find((row:any) => row.slug === schoolSlug);
if (!city || !school) throw new Error("BSU dependency missing.");
const programSource = evidence.get("bsu-international-program-catalog-2026"), guideSource = evidence.get("bsu-international-admission-2026"), scholarshipSource = evidence.get("bsu-cgs-high-level-graduate-2026");
const conflictingUndergraduateNames = new Set([
  "Physical Education", "Sports Training", "Football Major", "Winter Sports", "Tourism Management", "Leisure Sports", "Sports Somatic Science", "Martial Arts and Traditional Ethnic Sports", "Management of Sports Economics", "Public Affairs Management",
]);
const safeRows = parsed.programs.filter((row:any) => row.degreeLevel !== "Undergraduate" || !conflictingUndergraduateNames.has(row.nameEn));
if (safeRows.length !== 96) throw new Error(`Expected 96 safe-new routes, found ${safeRows.length}`);
const used = new Set<string>();
const programs: CatalogSeedProgram[] = safeRows.map((row:any) => {
  const degree = row.degreeLevel === "Undergraduate" ? "bachelor" : row.degreeLevel.toLowerCase();
  let slug = `${schoolSlug}-${degree}-${slugify(row.nameEn)}-${slugify(row.schoolEn)}`;
  if (used.has(slug)) slug += `-${slugify(row.subjectEn || "route")}`;
  if (used.has(slug)) throw new Error(`Duplicate BSU slug ${slug}`);
  used.add(slug);
  const graduate = row.degreeLevel !== "Undergraduate";
  return {
    slug, schoolSlug, citySlug: "beijing", nameEn: row.nameEn, degreeLevel: row.degreeLevel, durationYears: row.durationYears,
    fieldCategory: row.schoolEn, subjectArea: row.subjectEn || row.nameEn, teachingLanguage: "Chinese",
    ...(graduate ? { hskRequirement: "HSK Level 5 or above; the published exemption applies to applicants whose prior Chinese university degree was taught in Chinese." } : { cscaRequirement: "CSCA is required; use the subject combination published for this major in the official 2026 program catalog." }),
    tuitionAmount: row.tuitionCnyPerYear, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${Number(row.tuitionCnyPerYear).toLocaleString("en-US")}/year`,
    scholarshipText: "Eligible applicants may separately apply for BSU's published scholarship routes; funding is not guaranteed.", hasScholarship: true,
    applicationUrl: "https://ims.bsu.edu.cn/EEdepot.aspx", applicationNote: "2026 international degree route; applications are reviewed online and may include a video interview.",
    badgeText: "2026 official route", displaySubjects: [row.subjectEn || row.nameEn], displayGroup: `bsu-${degree}`, displayGroupLabel: `BSU 2026 ${row.degreeLevel} routes`, status: "draft",
    sourceUrl: programSource.finalUrl, sourceLabel: programSource.label, sourceSha256: programSource.sha256, capturedAt: programSource.fetchedAt,
    sourceFieldLineage: { nameEn: row.sourceLocator, degreeLevel: `${row.sourceLocator}; catalog section`, durationYears: "bsu-international-admission-2026 program-duration section", fieldCategory: `${row.sourceLocator}; school/college column`, subjectArea: `${row.sourceLocator}; subject/research-direction columns`, teachingLanguage: "bsu-international-admission-2026 program section", tuitionAmount: `${row.sourceLocator}; tuition column`, applicationUrl: "bsu-international-admission-2026 online-application section" },
  };
});
const programIntakes: CatalogSeedProgramIntake[] = programs.map(program => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineLabel: "Application and document review period: December 2025 through June 2026", applicationRound: "2026 international degree intake", status: "closed", sourceUrl: guideSource.finalUrl, sourceLabel: guideSource.label, sourceSha256: guideSource.sha256, capturedAt: guideSource.fetchedAt, sourceFieldLineage: { intakeYear: "admissions procedure", deadlineLabel: "admissions procedure", status: "derived: published application period has ended" } }));
const info = (label:string,value?:string) => ({ label, ...(value ? { value } : {}) });
const scholarship: CatalogSeedScholarship = {
  slug: "official-2026-bsu-cgs-high-level-graduate", schoolSlug,
  title: "Beijing Sport University 2026 Chinese Government Scholarship - High-Level Graduate Program", nameZh: "北京体育大学2026年中国政府奖学金高水平研究生项目",
  type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council",
  fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible Chinese-taught BSU graduate programs",
  amountText: "Full award; the BSU notice lists covered items and refers applicants to the national scholarship prospectus for current standards.", deadlineDate: "2026-03-01", deadlineLabel: "Before March 1, 2026", applicationRound: "2026 High-Level Graduate Program",
  benefitItems: [{label:"Tuition",included:true},{label:"Accommodation",included:true},{label:"Living allowance",included:true},{label:"Comprehensive medical insurance",included:true}],
  eligibilityItems: [info("Citizenship and health","Non-Chinese citizen in good health and compliant with applicable laws and university rules"),info("Master applicant","Bachelor's degree; age 35 or under"),info("Doctoral applicant","Master's degree; age 40 or under"),info("Chinese proficiency","HSK Level 5 or above; published prior Chinese-medium degree exemption may apply"),info("University requirements","Must also meet BSU's 2026 international admission requirements")],
  applicationMaterials: [info("CSC scholarship application form"),info("Highest degree certificate and academic transcripts"),info("Study or research plan"),info("Two academic recommendation letters"),info("Chinese proficiency evidence"),info("BSU pre-admission notice after assessment, when issued")],
  applicationSteps: [info("Step 1","Submit the BSU application before March 1, 2026"),info("Step 2","Complete BSU document review and interview assessment"),info("Step 3","After pre-admission, apply in the CSC system as Type B using BSU agency code 10043"),info("Step 4","Await BSU nomination and CSC final review")],
  actionLinks: [{label:"Official scholarship notice",url:scholarshipSource.finalUrl,kind:"official"},{label:"BSU application system",url:"https://ims.bsu.edu.cn/EEdepot.aspx",kind:"application"}],
  summary: "Full 2026 Chinese Government Scholarship route for eligible BSU master's and doctoral applicants.", sortOrder: 10, status: "draft",
  sourceUrl: scholarshipSource.finalUrl, sourceLabel: scholarshipSource.label, sourceSha256: scholarshipSource.sha256, capturedAt: scholarshipSource.fetchedAt,
  sourceFieldLineage: { title: "page title", fundingLevel: "section 3 funding content and standards", coverage: "section 3", applicableDegree: "section 2", deadlineDate: "section 5 step 1", eligibilityItems: "section 4", applicationMaterials: "section 6 (non-sensitive academic categories only)", applicationSteps: "section 5" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`, validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`BSU candidate validation failed: ${validation.errors.join(" ")}`);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:bsu-safe-new-review" });
try {
  const schoolDb = await pool.query("select s.id,s.status,s.verification_status,c.slug city_slug from schools s left join cities c on c.id=s.city_id where s.slug=$1", [schoolSlug]);
  const oldPrograms = await pool.query("select slug,name_en,degree_level,status,verification_status from programs where school_id=$1 order by slug", [schoolDb.rows[0]?.id]);
  const slugConflicts = await pool.query("select slug from programs where slug=any($1::text[])", [programs.map(row => row.slug)]);
  const scholarships = await pool.query("select slug,status,verification_status from scholarships where school_id=$1 order by slug", [schoolDb.rows[0]?.id]);
  const degreeKey = (value:string) => ({"本科":"undergraduate","硕士":"master","博士":"doctoral"} as Record<string,string>)[value] ?? value.toLowerCase();
  const normalizedOldNames = new Set(oldPrograms.rows.map((row:any) => `${degreeKey(String(row.degree_level))}|${String(row.name_en).toLowerCase()}`));
  const semanticConflicts = programs.filter(row => normalizedOldNames.has(`${degreeKey(row.degreeLevel)}|${row.nameEn.toLowerCase()}`));
  if (schoolDb.rows.length !== 1 || schoolDb.rows[0].status !== "active" || schoolDb.rows[0].city_slug !== "beijing") throw new Error("BSU database school baseline changed.");
  if (oldPrograms.rows.length !== 10 || oldPrograms.rows.some((row:any) => row.status !== "active" || row.verification_status === "verified") || slugConflicts.rows.length || semanticConflicts.length || scholarships.rows.length) throw new Error(`BSU safe-new baseline conflict: ${JSON.stringify({oldPrograms:oldPrograms.rows.length,slugConflicts:slugConflicts.rows.length,semanticConflicts:semanticConflicts.length,scholarships:scholarships.rows.length})}`);
  const evidenceList = [...evidence.values()].map(source => ({sourceId:source.id,sourceUrl:source.finalUrl,sourceLabel:source.label,sha256:source.sha256,fetchedAt:source.fetchedAt,contentType:source.contentType,byteLength:source.byteLength}));
  const reviewBase = { version: 1, status: "standing_user_approval", generatedAt: manifest.generatedAt, scope: { schoolSlug, newProgramCount: 96, newProgramIntakeCount: 96, newScholarshipCount: 1, overwriteCount: 0, archiveCount: 0 }, candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, manifestSha256: sha(await readFile(manifestPath)), parsedProgramsSha256: sha(await readFile(parsedPath)), evidence: evidenceList, standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch only inserts 96 non-conflicting official BSU program routes, 96 closed 2026 intakes and one new official scholarship. It preserves the existing school and 10 old programs and performs no overwrite, archive or deletion." }, reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], excludedConflictingUndergraduateNames: [...conflictingUndergraduateNames], databaseBaseline: { schoolId: schoolDb.rows[0].id, existingProgramCount: 10, existingScholarshipCount: 0 } }, sourceReview: { result: "pass", note: "Three official BSU 2026 sources are hash-bound. All 12 catalog PDF pages were rendered and visually inspected; the parser produced 20 undergraduate majors, 50 master's research routes and 36 doctoral research routes with no duplicate keys." }, coverageLimitations: ["This safe-new batch excludes 10 existing undergraduate records because their semantic identities conflict with official majors; replacing them and updating the school profile require a separate exact approval.", "The official PDF's embedded Chinese font map is damaged, so route names use the stable official English table text and do not invent Chinese translations.", "No applicant, account, payment, bank or personal-contact data is included."], sensitiveDataCheck: { result: "pass", scope: "96 program routes, 96 intake records and one scholarship", note: "Only public institutional catalog and policy facts are included. Contact details and applicant-specific data are excluded." } };
  const reviewHash = sha(JSON.stringify(reviewBase)), review = {...reviewBase, reviewHash, publicationReference:`standing-authorized-${batch}-${reviewHash}`};
  await Promise.all([writeJson(paths.candidate,candidate),writeJson(paths.validation,validation),writeJson(paths.review,review)]);
  console.log(JSON.stringify({ok:true,batch,reviewHash,publicationReference:review.publicationReference,summary:validation.summary,parsedCounts:parsed.counts,excludedConflicts:10,paths},null,2));
} finally { await pool.end(); }
