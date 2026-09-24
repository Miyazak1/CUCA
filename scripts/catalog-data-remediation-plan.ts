import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Row = Record<string, unknown>;
const root = process.cwd();
const reconciliation = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-data-reconciliation-candidates.draft.json"), "utf8"));
const audit = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-data-integrity-audit.json"), "utf8"));
const gaps = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-data-gap-queue.draft.json"), "utf8"));
const prohibitedSources = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-prohibited-source-remediation.draft.json"), "utf8"));
const coverage = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-official-draft-coverage.json"), "utf8"));

const replayReady: Row[] = [];
const reviewDeferred: Row[] = [];
for (const entity of ["schools", "programs", "scholarships"] as const) {
  for (const row of reconciliation.reconciliation[entity] as Row[]) {
    for (const [field, evidence] of Object.entries(row.fields as Row)) {
      const item = evidence as Row;
      const operation = {
        entityType: entity.slice(0, -1),
        entitySlug: row.slug,
        operation: "set_if_null",
        field,
        value: item.value,
        sourceUrl: item.sourceUrl,
        sourceSha256: item.sourceSha256,
        capturedAt: item.capturedAt,
        sourceFieldLineage: item.lineage || "Exact field value from the named local evidence bundle.",
        seedFile: item.file,
        evidenceState: item.state,
      };
      if (item.state === "approved_local") replayReady.push(operation);
      else reviewDeferred.push(operation);
    }
  }
}

const intakeReplayReady: Row[] = [];
const intakeReviewDeferred: Row[] = [];
for (const row of reconciliation.intakeCandidates as Row[]) {
  for (const intake of row.intakes as Row[]) {
    const operation = { entityType: "program_intake", programSlug: row.programSlug, operation: "insert_if_absent_by_program_term_year", ...intake };
    if (intake.seedState === "approved_local") intakeReplayReady.push(operation);
    else intakeReviewDeferred.push(operation);
  }
}

const generatedAt = new Date().toISOString();
const plan = {
  version: 2,
  generatedAt,
  status: "unreviewed_draft",
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  preconditions: [
    "Each set_if_null operation must still observe a null or blank target field.",
    "Each intake insert must still be absent for the exact program, term and year.",
    "Source URL and SHA-256 must still match the evidence manifest.",
    "No operation may change status, verification status, review timestamps or publication authority.",
  ],
  summary: {
    replayReadyFieldOperations: replayReady.length,
    deferredFieldOperations: reviewDeferred.length,
    replayReadyIntakeOperations: intakeReplayReady.length,
    deferredIntakeOperations: intakeReviewDeferred.length,
    structuralBlockers: audit.summary.blockingIssueCount,
    publicEligibleProhibitedSourceBlockers: audit.summary.publicExposureBlockingIssueCount,
    officialDraftBlockingCoreRecords: coverage.summary.blockingCoreRecords,
    officialDraftDeferredExternalBlockerRecords: coverage.summary.deferredExternalBlockerRecords,
    prohibitedSourceOfficialReplacementDrafts: prohibitedSources.summary.officialReplacementDraft,
    prohibitedSourceQuarantineRequired: prohibitedSources.summary.quarantineRequired,
    scholarshipRenewalQueue: audit.issues.activeScholarshipsWithPastDeadline.length,
    schoolsNeedingNewSourceRegistration: gaps.summary.schoolsNeedingSourceRegistration,
    providerLevelScholarshipGaps: gaps.summary.providerLevelScholarshipGaps,
    dataCompletionGatePassed: gaps.summary.completionGatePassed,
    unclassifiedProductionSchools: gaps.summary.unclassifiedProductionSchools,
  },
  replayReady: { fieldOperations: replayReady, intakeOperations: intakeReplayReady },
  reviewDeferred: { fieldOperations: reviewDeferred, intakeOperations: intakeReviewDeferred },
  renewalQueues: {
    scholarshipsPastDeadline: audit.issues.activeScholarshipsWithPastDeadline,
    programsWithoutEvidenceBackedIntake: audit.issues.activeProgramsWithoutIntake.filter((row: Row) => !new Set((reconciliation.intakeCandidates as Row[]).map((item: Row) => item.programSlug)).has(row.slug)),
  },
  prohibitedSourceRemediation: prohibitedSources.classifications,
  officialDraftCompleteness: {
    actionableMissingRecords: coverage.actionableMissingRecords,
    deferredExternalBlockers: coverage.deferredRecords,
    exemptionConfig: coverage.exemptionConfig,
  },
};
const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-data-remediation-plan.draft.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: plan.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
