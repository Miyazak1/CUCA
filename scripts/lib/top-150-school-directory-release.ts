import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../../src/server/catalog/seed-contract.ts";

export const TOP_150_SCHOOL_DIRECTORY_REVIEW_REFERENCE = "project-owner-chat-approval-2026-10-27-top-150-school-directory";
export const TOP_150_SCHOOL_DIRECTORY_PUBLISH_CONFIRMATION = "publish-reviewed-top-150-school-directory-to-cuac-single-host";
export const TOP_150_SCHOOL_DIRECTORY_APPROVED_CANDIDATE_SHA256 = "df4b9d75bd49832898ddbc51549df436fdc86a71e1524fa27deb253fcad056d6";
export const TOP_150_SCHOOL_DIRECTORY_PUBLICATION_SHA256 = "763b4fb4f9dbee5d5a465b042fe95c270fe4ace00eb10502893f92dc2d2ab343";
export const TOP_150_SCHOOL_DIRECTORY_OPERATION_PLAN_SHA256 = "0bd93544c5bf7497ec5df4c5086eba05476e8cc94151e6e8fa77275c5a2de884";

export const assertTop150SchoolDirectoryTarget = (rawUrl: string) => {
  if (process.env.CUAC_ENV !== "development" || process.env.CUAC_LOCAL_RUNTIME !== "1") {
    throw new Error("Top-150 school-directory access is restricted to the owner-controlled single-host runtime.");
  }
  const target = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.search || target.hash
    || !['127.0.0.1', '[::1]'].includes(target.hostname) || decodeURIComponent(target.username) !== "cuac_local"
    || decodeURIComponent(target.pathname.replace(/^\//, "")) !== "cuac_local") {
    throw new Error("Top-150 school-directory access is restricted to the loopback cuac_local database.");
  }
  return { kind: "single_host_loopback" as const, databaseName: "cuac_local" };
};

export const loadReviewedTop150SchoolDirectory = async () => {
  const bundle = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.reviewed-top-150-school-directory.json"), "utf8")) as CatalogSeedBundle;
  const review = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.reviewed-top-150-school-directory.review.json"), "utf8"));
  const report = createCatalogMigrationValidationReport(bundle);
  const handoff = bundle.handoff;
  if (!report.ok || bundle.version !== 2 || review.status !== "human_review_completed"
    || review.reviewReference !== TOP_150_SCHOOL_DIRECTORY_REVIEW_REFERENCE
    || review.approvedCandidateFileSha256 !== TOP_150_SCHOOL_DIRECTORY_APPROVED_CANDIDATE_SHA256
    || report.bundleSha256 !== TOP_150_SCHOOL_DIRECTORY_PUBLICATION_SHA256
    || report.operationPlanSha256 !== TOP_150_SCHOOL_DIRECTORY_OPERATION_PLAN_SHA256
    || !handoff || handoff.reviewReference !== review.reviewReference || handoff.prohibitedDataReviewReference !== review.reviewReference
    || review.publicationBundleSha256 !== report.bundleSha256 || review.operationPlanSha256 !== report.operationPlanSha256
    || review.confirmations?.projectOwnerApprovedDirectPublication !== true
    || review.confirmations?.officialSourcesReviewed !== true || review.confirmations?.prohibitedDataConfirmedExcluded !== true
    || review.confirmations?.preserveSchoolsOutsideTarget !== true || review.confirmations?.preserveExistingSchoolDetails !== true
    || review.confirmations?.programsMustRemainUnchanged !== true || review.confirmations?.programIntakesMustRemainUnchanged !== true
    || review.confirmations?.scholarshipsMustRemainUnchanged !== true
    || report.summary.cities !== 51 || report.summary.schools !== 150
    || report.summary.programs !== 0 || report.summary.programIntakes !== 0 || report.summary.scholarships !== 0
    || bundle.schools?.some((row) => row.contactNotes)) {
    throw new Error(`Reviewed top-150 school-directory validation failed: ${report.errors.join(" ")}`);
  }
  return { bundle, review, report };
};

export type ProtectedCatalogSnapshot = {
  programs_count: number;
  programs_hash: string;
  intakes_count: number;
  intakes_hash: string;
  scholarships_count: number;
  scholarships_hash: string;
};

export const protectedCatalogSnapshotSql = `select
  (select count(*)::int from programs) programs_count,
  (select md5(coalesce(string_agg((to_jsonb(p)-'created_at'-'updated_at')::text, '' order by p.id), '')) from programs p) programs_hash,
  (select count(*)::int from program_intakes) intakes_count,
  (select md5(coalesce(string_agg((to_jsonb(i)-'created_at'-'updated_at')::text, '' order by i.id), '')) from program_intakes i) intakes_hash,
  (select count(*)::int from scholarships) scholarships_count,
  (select md5(coalesce(string_agg((to_jsonb(s)-'created_at'-'updated_at')::text, '' order by s.id), '')) from scholarships s) scholarships_hash`;
