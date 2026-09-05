import type { SqlCatalogClient } from "../catalog/postgres-repository.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputUuid } from "../shared/input.ts";
import {
  approvedOfficialSubmissionPolicyReview,
  MAX_OFFICIAL_SUBMISSION_POLICY_VERSION,
  officialSubmissionPolicyApprovalDigest,
  officialSubmissionPolicyDocumentDigest,
  officialSubmissionPolicyKey,
  officialSubmissionPolicySha256,
  officialSubmissionPolicyTargetSetDigest,
  parseOfficialSubmissionPolicyDocument,
  parseOfficialSubmissionPolicyTargets,
  type OfficialSubmissionPolicyApprovalRow,
} from "./official-submission-policy.ts";

type PublishedPolicyRow = OfficialSubmissionPolicyApprovalRow & {
  programId: string;
  programIntakeId: string;
  schoolId: string;
  publicationRevision: number;
  publicationDocumentSha256: string;
  publicationTargetSetSha256: string;
  publicationApprovalSha256: string;
  version: number;
  formMode: string;
  maxProgramChoices: number;
  orderingMode: string;
  externalChannelType: string;
  document: unknown;
  targets: unknown;
};

export type PublishedOfficialSubmissionPolicyDto = {
  schoolId: string;
  programId: string;
  programIntakeId: string;
  admissionRouteKey: string;
  publicationRevision: number;
  versionId: string;
  version: number;
  documentSha256: string;
  targetSetSha256: string;
  reviewedAt: string;
  effectiveFrom: string;
  reviewDueAt: string;
  rule: {
    formMode: "one_program_per_form" | "multi_program_form";
    maxProgramChoices: number;
    orderingMode: "none" | "ranked";
    externalChannelType: "university_portal" | "approved_manual_handoff";
  };
};

export type PublishedOfficialSubmissionPolicyBinding = PublishedOfficialSubmissionPolicyDto & {
  approvalSha256: string;
};

export async function getPublishedOfficialSubmissionPolicy(
  client: SqlCatalogClient,
  programId: string,
  programIntakeId: string,
  admissionRouteKey: string,
  snapshotTime?: Date,
): Promise<PublishedOfficialSubmissionPolicyDto | null> {
  const binding = await readPublishedOfficialSubmissionPolicy(client, programId, programIntakeId,
    admissionRouteKey, snapshotTime, false);
  if (!binding) return null;
  const { approvalSha256: _approvalSha256, ...dto } = binding;
  return dto;
}

export function getLockedPublishedOfficialSubmissionPolicy(
  client: SqlCatalogClient,
  programId: string,
  programIntakeId: string,
  admissionRouteKey: string,
  snapshotTime: Date,
): Promise<PublishedOfficialSubmissionPolicyBinding | null> {
  return readPublishedOfficialSubmissionPolicy(client, programId, programIntakeId,
    admissionRouteKey, snapshotTime, true);
}

export function getPublishedOfficialSubmissionPolicyBinding(
  client: SqlCatalogClient,
  programId: string,
  programIntakeId: string,
  admissionRouteKey: string,
  snapshotTime?: Date,
): Promise<PublishedOfficialSubmissionPolicyBinding | null> {
  return readPublishedOfficialSubmissionPolicy(client, programId, programIntakeId,
    admissionRouteKey, snapshotTime, false);
}

async function readPublishedOfficialSubmissionPolicy(
  client: SqlCatalogClient,
  programId: string,
  programIntakeId: string,
  admissionRouteKey: string,
  snapshotTime: Date | undefined,
  lockRows: boolean,
): Promise<PublishedOfficialSubmissionPolicyBinding | null> {
  if (snapshotTime !== undefined && (!(snapshotTime instanceof Date) || !Number.isFinite(snapshotTime.getTime()))) {
    throw serviceUnavailable("Invalid official submission policy snapshot clock.");
  }
  let route: string;
  try { route = officialSubmissionPolicyKey(admissionRouteKey, "Admission route key"); }
  catch { throw serviceUnavailable("Invalid official submission policy route."); }
  const at = snapshotTime === undefined ? "statement_timestamp()" : "$4::timestamptz";
  const rows = await client.query<PublishedPolicyRow>(`select p.id as "programId", pi.id as "programIntakeId", p.school_id as "schoolId",
    pub.revision as "publicationRevision", pub.document_sha256 as "publicationDocumentSha256",
    pub.target_set_sha256 as "publicationTargetSetSha256", pub.approval_sha256 as "publicationApprovalSha256",
    v.id as "versionId", v.policy_key as "policyKey", v.admission_route_key as "admissionRouteKey",
    v.version, v.form_mode as "formMode", v.max_program_choices as "maxProgramChoices", v.ordering_mode as "orderingMode",
    v.external_channel_type as "externalChannelType", v.document_json as document, v.document_sha256 as "documentSha256",
    v.target_set_sha256 as "targetSetSha256", v.prepared_by_user_id as "preparedByUserId", v.approved_by_user_id as "approvedByUserId",
    v.reviewed_at as "reviewedAt", v.effective_from as "effectiveFrom", v.review_due_at as "reviewDueAt",
    v.review_evidence_json as "reviewEvidence",
    (select jsonb_agg(jsonb_build_object('programId', target.program_id, 'programIntakeId', target.program_intake_id)
      order by target.program_intake_id) from official_submission_policy_version_targets target where target.policy_version_id = v.id) as targets
    from programs p join schools s on s.id = p.school_id join program_intakes pi on pi.program_id = p.id
    join official_submission_policy_publications pub on pub.program_intake_id = pi.id and pub.program_id = p.id
      and pub.school_id = p.school_id and pub.admission_route_key = $3
    join official_submission_policy_version_targets selected_target on selected_target.policy_version_id = pub.version_id
      and selected_target.program_intake_id = pi.id and selected_target.program_id = p.id
      and selected_target.school_id = p.school_id and selected_target.admission_route_key = pub.admission_route_key
    join official_submission_policy_versions v on v.id = selected_target.policy_version_id and v.school_id = p.school_id
      and v.admission_route_key = pub.admission_route_key
    where p.id = $1 and pi.id = $2 and p.status = 'active' and s.status = 'active' and pi.status = 'open'
      and (pi.deadline_date is null or pi.deadline_date > ${at})
      and (pi.open_date is null or pi.deadline_date is null or pi.open_date < pi.deadline_date)
      and pub.status = 'active' and v.review_status = 'approved' and v.approved_by_user_id is not null
      and v.review_evidence_json is not null and v.reviewed_at <= ${at} and v.effective_from <= ${at} and v.review_due_at > ${at}
      ${lockRows ? "for share of pub, v, selected_target" : ""}`,
  snapshotTime === undefined ? [programId, programIntakeId, route] : [programId, programIntakeId, route, snapshotTime]);
  if (!rows[0]) return null;
  try {
    if (rows.length !== 1) throw new Error("Ambiguous official submission policy publication.");
    const row = rows[0], document = parseOfficialSubmissionPolicyDocument(row.document, route);
    inputUuid(row.schoolId, "School id"); inputUuid(row.programId, "Program id"); inputUuid(row.programIntakeId, "Program intake id");
    const publicationRevision = inputInteger(row.publicationRevision, "Publication revision", 1, MAX_OFFICIAL_SUBMISSION_POLICY_VERSION);
    const version = inputInteger(row.version, "Policy version", 1, MAX_OFFICIAL_SUBMISSION_POLICY_VERSION);
    const targets = parseOfficialSubmissionPolicyTargets(row.targets);
    const documentSha256 = officialSubmissionPolicyDocumentDigest(document);
    const targetSetSha256 = officialSubmissionPolicyTargetSetDigest(row.schoolId, route, targets);
    if (documentSha256 !== row.documentSha256 || targetSetSha256 !== row.targetSetSha256
      || row.publicationDocumentSha256 !== row.documentSha256 || row.publicationTargetSetSha256 !== row.targetSetSha256
      || row.formMode !== document.formMode || row.maxProgramChoices !== document.maxProgramChoices
      || row.orderingMode !== document.orderingMode || row.externalChannelType !== document.externalChannelType
      || !targets.some(target => target.programId === row.programId && target.programIntakeId === row.programIntakeId)) {
      throw new Error("Published official submission policy binding differs from its version.");
    }
    const review = approvedOfficialSubmissionPolicyReview(row, document);
    const approvalSha256 = officialSubmissionPolicyApprovalDigest(review);
    if (approvalSha256 !== row.publicationApprovalSha256) throw new Error("Published policy approval digest differs.");
    return {
      schoolId: row.schoolId,
      programId: row.programId,
      programIntakeId: row.programIntakeId,
      admissionRouteKey: route,
      publicationRevision,
      versionId: row.versionId,
      version,
      documentSha256: officialSubmissionPolicySha256(documentSha256),
      targetSetSha256: officialSubmissionPolicySha256(targetSetSha256),
      approvalSha256: officialSubmissionPolicySha256(approvalSha256, "Policy approval digest"),
      reviewedAt: row.reviewedAt!.toISOString(),
      effectiveFrom: row.effectiveFrom!.toISOString(),
      reviewDueAt: row.reviewDueAt!.toISOString(),
      rule: {
        formMode: document.formMode,
        maxProgramChoices: document.maxProgramChoices,
        orderingMode: document.orderingMode,
        externalChannelType: document.externalChannelType,
      },
    };
  } catch { throw serviceUnavailable("Published official submission policy requires reconciliation."); }
}
