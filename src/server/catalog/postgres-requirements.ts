import type { SqlCatalogClient } from "./postgres-repository.ts";
import { parseRequirementDocument, requirementDigest, type PublicProgramRequirementsDto } from "./requirements.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import { approvedRequirementReview } from "./requirement-review.ts";

type RequirementRow = {
  programId: string; programIntakeId: string; publicationRevision: number;
  versionId: string; version: number; contentSha256: string; content: unknown;
  reviewedAt: Date; effectiveFrom: Date; reviewDueAt: Date;
  preparedByUserId: string; approvedByUserId: string; reviewEvidence: unknown;
};

export async function getPublishedProgramRequirements(client: SqlCatalogClient, programId: string, intakeId: string, snapshotTime?: Date): Promise<PublicProgramRequirementsDto | null> {
  return readPublishedProgramRequirements(client, programId, intakeId, snapshotTime, false);
}

export async function getLockedPublishedProgramRequirements(client: SqlCatalogClient, programId: string,
  intakeId: string, snapshotTime: Date): Promise<PublicProgramRequirementsDto | null> {
  return readPublishedProgramRequirements(client, programId, intakeId, snapshotTime, true);
}

async function readPublishedProgramRequirements(client: SqlCatalogClient, programId: string, intakeId: string,
  snapshotTime: Date | undefined, lockRows: boolean): Promise<PublicProgramRequirementsDto | null> {
  // Only internal snapshot readers supply this database clock; public transports never accept it.
  if (snapshotTime !== undefined && (!(snapshotTime instanceof Date) || !Number.isFinite(snapshotTime.getTime()))) throw serviceUnavailable("Invalid requirements snapshot clock.");
  const at = snapshotTime === undefined ? "statement_timestamp()" : "$3::timestamptz";
  // Follow the explicit publication pointer; never fall back to an older or merely higher version.
  const rows = await client.query<RequirementRow>(`select p.id as "programId", pi.id as "programIntakeId",
    pub.revision as "publicationRevision", v.id as "versionId", v.version, v.content_sha256 as "contentSha256",
    v.content_json as content, v.reviewed_at as "reviewedAt", v.effective_from as "effectiveFrom", v.review_due_at as "reviewDueAt",
    v.prepared_by_user_id as "preparedByUserId", v.approved_by_user_id as "approvedByUserId", v.review_evidence_json as "reviewEvidence"
    from programs p join schools s on s.id = p.school_id join program_intakes pi on pi.program_id = p.id
    join program_requirement_publications pub on pub.program_intake_id = pi.id
    join program_requirement_versions v on v.id = pub.version_id and v.program_intake_id = pi.id
    where p.id = $1 and pi.id = $2 and p.status = 'active' and s.status = 'active' and pi.status = 'open'
      and (pi.deadline_date is null or pi.deadline_date > ${at})
      and (pi.open_date is null or pi.deadline_date is null or pi.open_date < pi.deadline_date)
      and pub.status = 'active' and v.review_status = 'approved' and v.approved_by_user_id is not null
      and v.prepared_by_user_id is not null and v.review_evidence_json is not null
      and v.reviewed_at <= ${at} and v.effective_from <= ${at}
      and v.review_due_at > ${at}
      ${lockRows ? "for share of pub, v" : ""}`,
  snapshotTime === undefined ? [programId, intakeId] : [programId, intakeId, snapshotTime]);
  if (!rows[0]) return null;
  try {
    const row = rows[0], document = parseRequirementDocument(row.content);
    if (requirementDigest(document) !== row.contentSha256 || document.sources.some(source => new Date(source.capturedAt) > row.reviewedAt)) {
      throw new Error("Requirement evidence differs from its review.");
    }
    approvedRequirementReview(row, document);
    return { programId: row.programId, programIntakeId: row.programIntakeId, publicationRevision: row.publicationRevision,
      versionId: row.versionId, version: row.version, contentSha256: row.contentSha256,
      reviewedAt: row.reviewedAt.toISOString(), effectiveFrom: row.effectiveFrom.toISOString(), reviewDueAt: row.reviewDueAt.toISOString(),
      assessmentMode: "information_only", document };
  } catch { throw serviceUnavailable("Published requirements require reconciliation."); }
}
