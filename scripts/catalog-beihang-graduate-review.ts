import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const parsedPath = resolve(root, "work/catalog-official/beihang-graduate-batch-01/parsed-graduate-routes.json");
const htmlManifestPath = resolve(root, "work/catalog-official/beihang-graduate-batch-01/manifest.json");
const pdfManifestPath = resolve(root, "work/catalog-official/beihang-graduate-batch-01-pdf/manifest.json");
const priorBundlePath = resolve(root, "seeds/catalog.beihang-school-program-batch-01.approved.local.json");
const candidatePath = resolve(root, "seeds/catalog.beihang-graduate-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.beihang-graduate-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.beihang-graduate-batch-01.review.json");

const parsed = JSON.parse(await readFile(parsedPath, "utf8"));
const htmlManifest = JSON.parse(await readFile(htmlManifestPath, "utf8"));
const pdfManifest = JSON.parse(await readFile(pdfManifestPath, "utf8"));
const prior = JSON.parse(await readFile(priorBundlePath, "utf8"));
if (parsed.summary.totalRoutes !== 188 || parsed.summary.byDegree.Master !== 100 || parsed.summary.byDegree.Doctoral !== 88 || parsed.summary.suspiciousRows !== 0) {
  throw new Error(`Unexpected Beihang parsed route summary: ${JSON.stringify(parsed.summary)}`);
}
if (prior.schools?.length !== 1 || prior.schools[0].slug !== "beihang-university") throw new Error("Reviewed Beihang dependency bundle is unavailable.");

const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const languageRequirement = (language: string) => language === "Chinese"
  ? { hskRequirement: "HSK Level 5 or above with a minimum score of 180 within two years; prior Chinese-medium study at a Chinese university may qualify for the published exemption." }
  : language === "English"
    ? { englishRequirement: "IELTS 6.0 Academic, TOEFL 90 or Duolingo 105 within two years; GRE is recommended where available." }
    : {};
const fieldCategory = (school: string) => /Economics and Management/i.test(school) ? "Economics and Management"
  : /Humanities|Foreign Languages|Law/i.test(school) ? "Humanities, Literature and Law"
    : /New Media Art/i.test(school) ? "Art"
      : /Hangzhou|Regional Centre/i.test(school) ? "Hangzhou International Campus"
        : "Natural Science and Engineering";

const programs = parsed.routes.map((route: any) => {
  const slug = slugify(["beihang-university", route.degreeLevel, route.schoolEn, route.nameEn, route.teachingLanguage].join(" "));
  const citySlug = /Hangzhou|Regional Centre/i.test(route.schoolEn) ? "hangzhou" : "beijing";
  const sourceLocator = `${route.locator}; language marker mapped using the official page legend`;
  return {
    slug, schoolSlug: "beihang-university", citySlug, nameEn: route.nameEn, nameZh: route.nameZh,
    degreeLevel: route.degreeLevel, ...(route.durationYears ? { durationYears: route.durationYears } : {}),
    fieldCategory: fieldCategory(route.schoolEn), subjectArea: route.schoolEn, teachingLanguage: route.teachingLanguage,
    ...languageRequirement(route.teachingLanguage), tuitionAmount: route.tuitionAmount, tuitionCurrency: route.tuitionCurrency,
    tuitionPeriod: route.tuitionPeriod, tuitionText: `CNY ${route.tuitionAmount.toLocaleString("en-US")} per year`,
    scholarshipText: "The 2026 Chinese Government Scholarship High-level Postgraduate Program is available to eligible master's and doctoral applicants; funding is competitive and not guaranteed.",
    applicationUrl: route.applicationUrl,
    applicationNote: `${route.schoolEn}. ${route.applicationNote}.${["French", "German", "Russian"].includes(route.teachingLanguage) ? " The reviewed guide identifies this teaching language but does not publish a separate score threshold." : ""}`,
    hasScholarship: true, displayGroup: route.degreeLevel.toLowerCase(), displayGroupLabel: route.degreeLevel,
    status: "draft" as const, sourceUrl: route.sourceUrl, sourceLabel: route.sourceLabel, sourceSha256: route.sourceSha256,
    capturedAt: route.capturedAt,
    sourceFieldLineage: { nameEn: sourceLocator, nameZh: sourceLocator, subjectArea: sourceLocator, teachingLanguage: sourceLocator,
      tuitionAmount: `${route.degreeLevel} official page tuition section`, applicationUrl: `${route.degreeLevel} official page application procedure`,
      applicationNote: `${route.degreeLevel} official page study-duration section` },
  };
});
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Beihang graduate program slugs are not unique.");

const programIntakes = programs.map(program => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
  deadlineDate: "2026-06-30T00:00:00.000Z", deadlineLabel: "Application deadline: June 30, 2026",
  applicationRound: "2026 international graduate intake", status: "closed" as const,
  sourceUrl: program.sourceUrl, sourceLabel: program.sourceLabel, sourceSha256: program.sourceSha256, capturedAt: program.capturedAt,
  sourceFieldLineage: { deadlineDate: `${program.degreeLevel} official page schedule; date-only value normalized to ISO UTC` },
}));

const generatedAt = new Date().toISOString();
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: prior.cities.map((city: any) => ({ ...city })),
  schools: prior.schools.map((school: any) => ({ ...school })),
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const persistedCandidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(persistedCandidate);
if (!validation.ok) throw new Error(`Beihang graduate candidate validation failed:\n${validation.errors.join("\n")}`);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateSha256 = sha256(candidateText);
const evidence = [...htmlManifest.sources, ...pdfManifest.sources].map((source: any) => ({
  sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt,
})).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt,
  scope: { schoolSlug: "beihang-university", dependencyCityReplayCount: 2, dependencySchoolReplayCount: 1,
    newProgramRouteCount: 188, masterRouteCount: 100, doctoralRouteCount: 88, newProgramIntakeCount: 188,
    archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0, scholarshipMutationCount: 0 },
  candidateSha256,
  evidence,
  visualReview: { result: "pass", masterPdfPagesReviewed: 10, doctoralPdfPagesReviewed: 9,
    note: "All 19 pages were rendered and visually inspected. Major rows, bilingual labels, research-field columns and the five-symbol teaching-language legend are readable. Research directions are not misrepresented as separate programs." },
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许",
    appliesBecause: "The batch adds 188 new non-conflicting graduate routes and intakes. It archives or deletes nothing. Existing Beijing, Hangzhou and Beihang dependency rows are replayed byte-equivalently from their approved publication bundle without changing published catalog fields or verification timestamps." },
  reconciliation: { actionAfterReview: "insert_new_verified_beihang_graduate_routes", destructiveDeletion: false,
    existingDependencyRowsReplayedByteEquivalently: true, newSlugConflicts: 0, existingGraduateSemanticConflicts: 0 },
  unresolvedFields: ["The public master guide states a 2-3 year range, so no single durationYears value is invented for master routes; the exact range is retained in applicationNote.",
    "The reviewed guide identifies French-, German- and Russian-taught routes but publishes no separate score threshold; those thresholds remain unpublished.",
    "Research directions remain evidence detail under their parent major and are not split into application routes."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only",
    note: "Only public institutional, program, tuition, language and admissions information is included. No applicant, account, payment instruction, passport number, personal email, personal phone or uploaded document data is present." },
  reviewNotes: ["Each route identity is degree + school/centre + major + teaching language.",
    "Program names and language symbols come from the registered official HTML tables; the official 19-page PDF pair was retained and visually reviewed as corroborating major/research-field evidence.",
    "Master tuition is CNY 35,000/year; doctoral tuition is CNY 42,000/year; both application deadlines are June 30, 2026.",
    "The existing verified Beihang scholarship record is not changed."],
};
const reviewHash = sha256(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: "standing-user-default-publication" };
await writeFile(candidatePath, candidateText, { flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, bundleSha256: validation.bundleSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
