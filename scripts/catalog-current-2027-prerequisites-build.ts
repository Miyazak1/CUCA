import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type City = NonNullable<CatalogSeedBundle["cities"]>[number];
type School = NonNullable<CatalogSeedBundle["schools"]>[number];
type Program = NonNullable<CatalogSeedBundle["programs"]>[number];
type Intake = NonNullable<CatalogSeedBundle["programIntakes"]>[number];
type RequirementOperation = { operationKey: string; schoolSlug: string; programSlug: string; intakeTerm: string; intakeYear: number };
type SourceBundle = { file: string; bundle: CatalogSeedBundle };

const root = process.cwd();
const reviewedAt = "2026-10-16T02:46:15.987Z";
const reviewReference = "project-owner-chat-review-2026-10-16";
const sourceFiles = [
  "catalog.tju-complete-batch-01.draft.json",
  "catalog.tju-language-spring-2027.draft.json",
  "catalog.tsinghua-complete-batch-01.draft.json",
  "catalog.sisu-complete-batch-01.draft.json",
  "catalog.qdu-complete-batch-01.draft.json",
  "catalog.beihang-language-spring-2027.draft.json",
  "catalog.blcu-language-spring-2027.draft.json",
  "catalog.changan-language-spring-2027.draft.json",
  "catalog.csu-language-spring-2027.draft.json",
  "catalog.hust-language-spring-2027.draft.json",
  "catalog.jilin-language-spring-2027.draft.json",
  "catalog.lnutcm-language-spring-2027.draft.json",
  "catalog.shu-language-spring-2027.draft.json",
  "catalog.zjsu-language-spring-2027.draft.json",
  "catalog.zju-language-spring-2027.draft.json",
  "catalog.zjut-language-spring-2027.draft.json",
];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const requirementCandidate = await read("seeds/application-requirements-release-candidate.unreviewed.json");
const operations = (requirementCandidate.operations as RequirementOperation[]).filter(row => row.intakeYear === 2027);
const sources: SourceBundle[] = await Promise.all(sourceFiles.map(async file => ({ file, bundle: await read(`seeds/${file}`) as CatalogSeedBundle })));
const cities = new Map<string, City>(), schools = new Map<string, School>(), programs = new Map<string, Program>(), intakes = new Map<string, Intake>();

for (const operation of operations) {
  const matches = sources.flatMap(source => {
    const program = source.bundle.programs?.find(row => row.slug === operation.programSlug);
    const intake = source.bundle.programIntakes?.find(row => row.programSlug === operation.programSlug
      && row.intakeTerm === operation.intakeTerm && row.intakeYear === operation.intakeYear);
    return program && intake ? [{ source, program, intake }] : [];
  });
  if (matches.length !== 1) throw new Error(`Expected one exact 2027 catalog source for ${operation.operationKey}; found ${matches.length}.`);
  const { source, program, intake } = matches[0];
  const school = source.bundle.schools?.find(row => row.slug === operation.schoolSlug);
  const city = source.bundle.cities?.find(row => row.slug === school?.citySlug);
  if (!school || !city || program.schoolSlug !== school.slug) throw new Error(`Missing school/city dependency for ${operation.operationKey}.`);
  cities.set(city.slug, { ...city, status: "active", verificationStatus: "verified", lastVerifiedAt: reviewedAt });
  schools.set(school.slug, { ...school, status: "active", verificationStatus: "verified", lastVerifiedAt: reviewedAt });
  programs.set(program.slug, { ...program, status: "active", verificationStatus: "verified", lastVerifiedAt: reviewedAt });
  intakes.set(`${intake.programSlug}:${intake.intakeTerm}:${intake.intakeYear}`, { ...intake, status: "open" });
}

const draft: CatalogSeedBundle = { version: 1, generatedAt: reviewedAt, cities: [...cities.values()], schools: [...schools.values()],
  programs: [...programs.values()], programIntakes: [...intakes.values()], scholarships: [] };
const draftReport = createCatalogMigrationValidationReport(draft);
if (!draftReport.ok || draftReport.summary.programs !== 346 || draftReport.summary.programIntakes !== 347
  || draftReport.summary.schools !== 15) throw new Error(`Invalid 2027 prerequisite draft: ${draftReport.errors.join(" ")}`);
const sourceSchemaSha256 = sha(JSON.stringify({
  cityFields: [...new Set(draft.cities!.flatMap(Object.keys))].sort(),
  schoolFields: [...new Set(draft.schools!.flatMap(Object.keys))].sort(),
  programFields: [...new Set(draft.programs!.flatMap(Object.keys))].sort(),
  intakeFields: [...new Set(draft.programIntakes!.flatMap(Object.keys))].sort(),
}));
const publication: CatalogSeedBundle = { ...draft, version: 2, handoff: {
  sourceSystem: "CUAC reviewed official-source current 2027 catalog prerequisites",
  cleanedExportName: "catalog.current-2027-prerequisites.reviewed.json",
  cleanedExportSha256: draftReport.bundleSha256,
  sourceSchemaSha256,
  reviewReference,
  prohibitedDataReviewReference: reviewReference,
  approvalRecordedAt: reviewedAt,
  sourceReadOnly: true,
  prohibitedDataConfirmedExcluded: true,
} };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 346 || report.summary.programIntakes !== 347
  || report.summary.schools !== 15) throw new Error(`Invalid reviewed 2027 prerequisite publication: ${report.errors.join(" ")}`);
await writeFile(resolve(root, "seeds/catalog.current-2027-prerequisites.reviewed.json"), `${JSON.stringify(publication, null, 2)}\n`);
await writeFile(resolve(root, "seeds/catalog.current-2027-prerequisites.review.json"), `${JSON.stringify({
  version: 1, status: "human_review_completed", reviewReference, reviewedAt,
  publicationBundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256,
  scope: { cities: 11, schools: 15, programs: 346, programIntakes: 347, scholarships: 0 },
  confirmations: { contentReviewed: true, officialSourcesReviewed: true, publicContentConfirmed: true,
    prohibitedDataConfirmedExcluded: true, missingDataMayRemainEmpty: true },
}, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reviewReference, bundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256, summary: report.summary }, null, 2));
