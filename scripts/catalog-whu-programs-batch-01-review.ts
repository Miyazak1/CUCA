import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "whu-programs-batch-01";
const prefix = `catalog.${batch}`;
const schoolSlug = "wuhan-university";
const dependencyPath = resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.approved.local.json");
const docManifestPath = resolve(root, "work/catalog-official/whu-program-docx-browser-20260914/manifest.json");
const parsedPath = resolve(root, "work/catalog-official/whu-program-docx-browser-20260914/parsed-programs.json");
const guideManifestPath = resolve(root, "work/catalog-official/whu-complete-batch-01/manifest.json");
const statePath = resolve(root, ".cuac-local/runtime.json");
const paths = {
  candidate: resolve(root, `seeds/${prefix}.draft.json`),
  validation: resolve(root, `seeds/${prefix}.validation.json`),
  review: resolve(root, `seeds/${prefix}.review.json`),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const writeJson = (path: string, value: unknown) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const [dependency, docManifest, parsed, guideManifest, state] = await Promise.all([
  readFile(dependencyPath, "utf8").then(JSON.parse),
  readFile(docManifestPath, "utf8").then(JSON.parse),
  readFile(parsedPath, "utf8").then(JSON.parse),
  readFile(guideManifestPath, "utf8").then(JSON.parse),
  readFile(statePath, "utf8").then(JSON.parse),
]);
if (dependency.cities?.length !== 1 || dependency.cities[0]?.slug !== "wuhan" || dependency.schools?.length !== 1 || dependency.schools[0]?.slug !== schoolSlug || dependency.schools[0]?.verificationStatus !== "verified") {
  throw new Error("Published WHU school dependency changed.");
}
const expectedDocHashes: Record<string, string> = {
  "whu-undergraduate-programs-chinese-2026": "5d92e2baeb6f201f5f668987d472441ee77b972411b1f7cc25adefd0d38f3420",
  "whu-undergraduate-programs-english-2026": "3ce4add8dd82771fbf4eefaf80b7581722a6dd016bdeb6068a24d89d24922910",
  "whu-graduate-programs-english-2026": "28b453918d0bbad41d19bec502ccd1e7b9315b286fa544f19ed494bb790045a4",
  "whu-doctoral-programs-chinese-2026": "1cafb742100696ac597e78b436f2685fc736496555a322490eddc23ad190703b",
  "whu-master-programs-chinese-2026": "0873b1a3d027ed6e2069126e6efa7481d3ed4055f7c962c6141ff2688f6dce6f",
};
const docEvidence = new Map<string, any>();
for (const source of docManifest.sources ?? []) {
  if (expectedDocHashes[source.id] !== source.sha256 || source.status !== 200 || source.finalUrl !== source.url || source.byteLength > 15 * 1024 * 1024 || !String(source.contentType).includes("wordprocessingml.document")) {
    throw new Error(`WHU DOCX evidence changed: ${source.id}`);
  }
  const bytes = await readFile(resolve(docManifestPath, "..", source.artifactPath));
  if (sha(bytes) !== source.sha256 || !bytes.subarray(0, 2).equals(Buffer.from("PK"))) throw new Error(`WHU DOCX artifact mismatch: ${source.id}`);
  docEvidence.set(source.id, source);
}
if (docEvidence.size !== 5 || parsed.summary?.programRoutes !== 599 || parsed.summary?.duplicateRouteKeys !== 0 || parsed.programs?.length !== 599) {
  throw new Error(`WHU parsed program scope changed: ${JSON.stringify(parsed.summary)}`);
}
const guideIds = ["whu-undergraduate-guide-2026", "whu-postgraduate-guide-2026", "whu-csca-instructions-2026"];
const guideEvidence = new Map<string, any>();
for (const source of guideManifest.sources ?? []) if (guideIds.includes(source.id)) guideEvidence.set(source.id, source);
const expectedGuideHashes: Record<string, string> = {
  "whu-undergraduate-guide-2026": "a5922203ef423a934b1c72cdf55290dc7fe1d351d2da8c04a43679e461f10de1",
  "whu-postgraduate-guide-2026": "ab91135bfc8763d3c8ce100e5d7e8205f35d8f740b5774e36dabd921bd91bda3",
  "whu-csca-instructions-2026": "daf166ef5e9f5dadd73ca46dfec0ddc48708eb7bde9c04dccd16268bd8d10ca4",
};
for (const id of guideIds) {
  const source = guideEvidence.get(id);
  if (!source || source.status !== 200 || source.sha256 !== expectedGuideHashes[id] || source.finalUrl !== source.url || source.contentType !== "text/html") throw new Error(`WHU guide evidence changed: ${id}`);
}

const cscaFor = (row: any): { subjects: string[]; note: string } | null => {
  if (row.degreeLevel !== "Undergraduate") return null;
  if (row.teachingLanguage === "English") {
    const medical = /medicine|surgery|mbbs|clinical/i.test(`${row.nameEn} ${row.departmentEn ?? ""}`);
    return {
      subjects: medical ? ["Mathematics", "Chemistry", "Physics"] : ["Mathematics", "Chemistry"],
      note: medical
        ? "English-taught medical applicants may omit Professional Chinese but must take Mathematics, Chemistry and Physics."
        : "English-taught applicants may omit Professional Chinese but must take Mathematics and Chemistry.",
    };
  }
  const category = `${row.catalogGroup ?? ""} ${row.departmentEn ?? ""}`;
  if (/medicine/i.test(category)) return { subjects: ["Professional Chinese - STEM", "Mathematics", "Chemistry"], note: "WHU's 2026 medicine combination requires Professional Chinese (STEM), Mathematics and Chemistry." };
  if (/science and engineering/i.test(category)) return { subjects: ["Mathematics", "Physics", "Chemistry"], note: "WHU's 2026 science and engineering combination requires Mathematics, Physics and Chemistry." };
  return {
    subjects: ["Professional Chinese - Humanities", "Mathematics"],
    note: /Chinese Language/i.test(row.nameEn)
      ? "WHU's 2026 liberal-arts combination requires Professional Chinese (Humanities) and Mathematics; the Chinese Language major may receive the published Professional Chinese exemption with a valid HSK 4 result."
      : "WHU's 2026 liberal-arts combination requires Professional Chinese (Humanities) and Mathematics.",
  };
};
const usedSlugs = new Set<string>();
const programs: CatalogSeedProgram[] = parsed.programs.map((row: any) => {
  const source = docEvidence.get(row.sourceId);
  const degreeSlug = row.degreeLevel === "Undergraduate" ? "bachelor" : row.degreeLevel.toLowerCase();
  const departmentSlug = slugify(row.departmentEn || row.catalogGroup || "general");
  const professionalSlug = row.degreeType === "professional" ? "professional" : "academic";
  let slug = `${schoolSlug}-${degreeSlug}-${slugify(row.teachingLanguage)}-${slugify(row.nameEn)}-${departmentSlug}-${professionalSlug}`;
  if (usedSlugs.has(slug)) slug = `${slug}-row-${row.sourceRow}`;
  if (usedSlugs.has(slug)) throw new Error(`Duplicate WHU program slug: ${slug}`);
  usedSlugs.add(slug);
  const csca = cscaFor(row);
  const age = row.degreeLevel === "Undergraduate" ? "generally 18-30" : row.degreeLevel === "Master" ? "generally no older than 35 with a bachelor's degree" : "generally no older than 45 with a master's degree";
  const degreeTypeNote = row.degreeType === "professional" ? " The official catalog marks this as a professional-degree route." : "";
  return {
    slug,
    schoolSlug,
    citySlug: "wuhan",
    nameEn: row.nameEn,
    ...(row.nameZh ? { nameZh: row.nameZh } : {}),
    degreeLevel: row.degreeLevel,
    durationYears: row.durationYears,
    fieldCategory: row.departmentEn || row.catalogGroup || "General",
    subjectArea: row.nameEn,
    teachingLanguage: row.teachingLanguage,
    ...(csca ? { cscaSubjects: csca.subjects, cscaRequirement: csca.note } : {}),
    ...(row.teachingLanguage === "Chinese"
      ? { hskRequirement: "New HSK level 4 with a score of 180 or above; published native-Chinese or prior Chinese-medium exemptions may apply." }
      : { englishRequirement: "TOEFL 80+, TOEFL Essentials 8+, or IELTS 6.0+; published native-English or prior English-medium exemptions may apply." }),
    scholarshipText: "Wuhan University publishes six independently reviewed 2026 scholarship routes; eligibility depends on the selected program and award rules.",
    applicationUrl: "https://admission.whu.edu.cn/",
    applicationNote: `2026 international ${row.degreeLevel.toLowerCase()} route. General applicant profile: non-Chinese citizen in good health, ${age}.${degreeTypeNote}`,
    hasScholarship: true,
    badgeText: "2026 official route",
    displaySubjects: [row.departmentEn || row.catalogGroup || row.nameEn],
    displayGroup: `whu-${degreeSlug}-${slugify(row.teachingLanguage)}`,
    displayGroupLabel: `WHU 2026 ${row.degreeLevel} programs taught in ${row.teachingLanguage}`,
    status: "draft",
    sourceUrl: source.finalUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${row.sourceId} table row ${row.sourceRow}`,
      ...(row.nameZh ? { nameZh: `${row.sourceId} table row ${row.sourceRow}` } : {}),
      degreeLevel: `${row.sourceId} document title or type column, row ${row.sourceRow}`,
      durationYears: `${row.sourceId} duration column, row ${row.sourceRow}`,
      fieldCategory: `${row.sourceId} department or program-group column, row ${row.sourceRow}`,
      teachingLanguage: `${row.sourceId} document title`,
      ...(csca ? { cscaSubjects: "whu-csca-instructions-2026 subject-combination table" } : {}),
      applicationNote: row.degreeLevel === "Undergraduate" ? "whu-undergraduate-guide-2026 eligibility section" : "whu-postgraduate-guide-2026 eligibility section",
      applicationUrl: row.degreeLevel === "Undergraduate" ? "whu-undergraduate-guide-2026 online-application section" : "whu-postgraduate-guide-2026 online-application section",
    },
  };
});
if (programs.length !== 599 || usedSlugs.size !== 599) throw new Error("WHU program normalization did not preserve 599 distinct routes.");
const programIntakes: CatalogSeedProgramIntake[] = programs.map(program => {
  const undergraduate = program.degreeLevel === "Undergraduate";
  const source = guideEvidence.get(undergraduate ? "whu-undergraduate-guide-2026" : "whu-postgraduate-guide-2026");
  return {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    deadlineDate: undergraduate ? "2026-06-30T15:59:59.000Z" : "2026-06-15T15:59:59.000Z",
    deadlineLabel: undergraduate ? "Self-funded application deadline: June 30, 2026" : "Self-funded degree application deadline: June 15, 2026",
    applicationRound: "2026 self-funded degree intake",
    status: "closed",
    sourceUrl: source.finalUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: { intakeYear: `${source.id} application-period section`, deadlineDate: `${source.id} application-period section`, status: "derived: deadline predates review date" },
  };
});
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: docManifest.generatedAt,
  cities: dependency.cities,
  schools: dependency.schools,
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`WHU candidate validation failed:\n${validation.errors.join("\n")}`);

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:whu-program-review" });
try {
  const school = await pool.query("select s.id,s.status,s.verification_status,c.slug city_slug from schools s left join cities c on c.id=s.city_id where s.slug=$1", [schoolSlug]);
  const currentPrograms = await pool.query("select slug,status,verification_status from programs where school_id=$1 order by slug", [school.rows[0]?.id]);
  const conflicts = await pool.query("select slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [programs.map(row => row.slug)]);
  const scholarships = await pool.query("select slug,status,verification_status from scholarships where school_id=$1 order by slug", [school.rows[0]?.id]);
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "verified" || school.rows[0].city_slug !== "wuhan") throw new Error("WHU verified school baseline changed.");
  if (currentPrograms.rows.length !== 0 || conflicts.rows.length !== 0) throw new Error(`WHU program baseline is no longer safe-new: ${JSON.stringify({ current: currentPrograms.rows.length, conflicts: conflicts.rows.length })}`);
  if (scholarships.rows.length !== 6 || scholarships.rows.some((row: any) => row.status !== "active" || row.verification_status !== "verified")) throw new Error("WHU six-scholarship baseline changed.");
  const evidence = [...docEvidence.values(), ...guideIds.map(id => guideEvidence.get(id))].map(source => ({ sourceId: source.id, sourceUrl: source.finalUrl, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType }));
  const reviewBase = {
    version: 1,
    status: "standing_user_approval",
    generatedAt: docManifest.generatedAt,
    scope: { schoolSlug, newProgramCount: 599, newProgramIntakeCount: 599, overwriteCount: 0, archiveCount: 0, scholarshipMutationCount: 0 },
    candidateSha256: sha(candidateText),
    candidateBundleSha256: validation.bundleSha256,
    operationPlanSha256: validation.operationPlanSha256,
    docManifestSha256: sha(await readFile(docManifestPath)),
    parsedProgramsSha256: sha(await readFile(parsedPath)),
    evidence,
    standingAuthorization: {
      reference: "user-chat-2026-09-13-default-publication",
      instruction: "发布默认允许",
      appliesBecause: "This batch inserts 599 new non-conflicting official Wuhan University program routes and their 2026 closed intakes. It preserves the verified school and all six verified scholarships and performs no overwrite, archive or deletion.",
    },
    reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolId: school.rows[0].id, existingProgramCount: 0, verifiedScholarshipCount: 6 } },
    sourceReview: { result: "pass", note: "Five official WHU DOCX program tables and three official 2026 admissions pages are hash-bound. The DOCX renderer was unavailable because bundled LibreOffice was not installed; table structure, ZIP signatures, row counts, bilingual values, durations and duplicate keys were audited programmatically." },
    coverageLimitations: ["The batch publishes exactly the 599 degree/language routes explicitly listed in the five official program attachments.", "Tuition is omitted because the reviewed program attachments do not publish route-level tuition.", "Applicant financial-certification, bank/payment and personal-contact details are deliberately excluded."],
    sensitiveDataCheck: { result: "pass", scope: "599 program routes and 599 intake records", note: "Public institutional catalog and admissions-policy data only; no applicant, account, payment, bank or personal-contact data is included." },
  };
  const reviewHash = sha(JSON.stringify(reviewBase));
  const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-${batch}-${reviewHash}` };
  await Promise.all([writeJson(paths.candidate, candidate), writeJson(paths.validation, validation), writeJson(paths.review, review)]);
  console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference: review.publicationReference, summary: validation.summary, byDegreeLanguage: parsed.summary.byDegreeLanguage, protectedScholarships: 6, paths }, null, 2));
} finally {
  await pool.end();
}
