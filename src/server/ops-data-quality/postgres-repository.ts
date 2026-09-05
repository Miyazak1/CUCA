import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import type {
  OpsDataQualityCursor,
  OpsDataQualityEntityType,
  OpsDataQualityEscalationCode,
  OpsDataQualityIssueCode,
  OpsDataQualityQueueRow,
  OpsDataQualityRepository,
  OpsDataQualityResolutionCode,
  OpsDataQualityReview,
  OpsDataQualityRole,
} from "./service.ts";

type Actor = { actorUserId: string; activeRole: OpsDataQualityRole };
type ReviewRow = Omit<OpsDataQualityReview, never>;
type QueueRow = Omit<OpsDataQualityQueueRow, "evidence" | "review"> & {
  evidenceId: string | null; sourceUrl: string | null; sourceLabel: string | null; capturedAt: Date | null;
  reviewId: string | null;
} & Omit<ReviewRow, "reviewId">;

type TableSpec = { table: string; alias: string; label: string };

const reviewColumns = `
  r.id as "reviewId", r.source_entity_updated_at as "sourceEntityUpdatedAt",
  r.source_evidence_id as "sourceEvidenceId", r.source_evidence_captured_at as "sourceEvidenceCapturedAt",
  r.source_issue_code as "sourceIssueCode", r.revision, r.status,
  r.assigned_user_id as "assignedUserId", r.assigned_role as "assignedRole",
  r.escalation_code as "escalationCode", r.escalation_reference as "escalationReference",
  r.escalated_at as "escalatedAt", r.resolved_by_user_id as "resolvedByUserId",
  r.resolution_code as "resolutionCode", r.resolution_reference as "resolutionReference",
  r.resolved_at as "resolvedAt", r.review_due_at as "reviewDueAt",
  r.result_entity_updated_at as "resultEntityUpdatedAt", r.created_at as "createdAt", r.updated_at as "updatedAt"`;

const allCatalogEntitiesCte = `
  with database_clock as (select clock_timestamp() as recorded_at),
  catalog_entities as (
    select 'city'::text as entity_type, id as entity_id, name_en as label, status as catalog_status,
      verification_status, verified_by_user_id, last_verified_at, next_review_due_at, updated_at as entity_updated_at
    from cities
    union all
    select 'school', id, name_en, status, verification_status, verified_by_user_id,
      last_verified_at, next_review_due_at, updated_at from schools
    union all
    select 'program', id, name_en, status, verification_status, verified_by_user_id,
      last_verified_at, next_review_due_at, updated_at from programs
    union all
    select 'scholarship', id, title, status, verification_status, verified_by_user_id,
      last_verified_at, next_review_due_at, updated_at from scholarships
  ),
  candidates as (
    select e.entity_type as "entityType", e.entity_id as "entityId", e.label,
      case when e.verification_status in ('unverified','verified','stale','disputed')
        then e.verification_status else 'invalid' end as "verificationStatus",
      e.last_verified_at as "lastVerifiedAt", e.next_review_due_at as "nextReviewDueAt",
      e.entity_updated_at as "entityUpdatedAt",
      case
        when ev.id is null then 'missing_source_evidence'
        when ev.source_url is null or char_length(ev.source_url) > 2048
          or ev.source_url !~ '^https://[^[:space:]]+$' then 'invalid_source_url'
        when e.verification_status = 'disputed' then 'disputed'
        when e.verification_status = 'stale'
          or (e.verification_status = 'verified' and e.next_review_due_at <= c.recorded_at) then 'stale'
        when e.verification_status = 'verified' and (e.verified_by_user_id is null
          or e.last_verified_at is null or e.next_review_due_at is null) then 'verification_metadata_missing'
        else 'unverified'
      end as "issueCode",
      ev.id as "evidenceId",
      case when ev.source_url ~ '^https://[^[:space:]]+$' and char_length(ev.source_url) <= 2048
        then ev.source_url else null end as "sourceUrl",
      ev.source_label as "sourceLabel", ev.captured_at as "capturedAt"
    from catalog_entities e cross join database_clock c
    left join lateral (
      select id, source_url, source_label, captured_at from catalog_source_evidence
      where entity_type = e.entity_type and entity_id = e.entity_id
      order by captured_at desc, id desc limit 1
    ) ev on true
    where e.catalog_status <> 'archived' and e.verification_status <> 'archived'
      and e.entity_updated_at <= c.recorded_at
      and (ev.id is null or ev.source_url is null or char_length(ev.source_url) > 2048
        or ev.source_url !~ '^https://[^[:space:]]+$' or e.verification_status <> 'verified'
        or e.verified_by_user_id is null or e.last_verified_at is null or e.next_review_due_at is null
        or e.next_review_due_at <= c.recorded_at)
  )`;

export class PostgresOpsDataQualityRepository implements OpsDataQualityRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async listCandidates(input: Actor & { cursor: OpsDataQualityCursor | null; limit: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      if (input.cursor) {
        const cursor = await tx.query<{ found: boolean }>(`${allCatalogEntitiesCte}
          select exists(select 1 from catalog_entities where entity_type = $1 and entity_id = $2
            and catalog_status <> 'archived') as found`, [input.cursor.entityType, input.cursor.entityId]);
        if (!cursor[0]?.found) return { authorized: true, cursorFound: false, rows: [] as OpsDataQualityQueueRow[] } as const;
      }
      const rows = await tx.query<QueueRow>(`${allCatalogEntitiesCte}
        select q.*, ${reviewColumns}
        from candidates q
        left join lateral (
          select * from ops_catalog_quality_reviews candidate_review
          where candidate_review.entity_type = q."entityType" and candidate_review.entity_id = q."entityId"
            and candidate_review.source_evidence_id is not distinct from q."evidenceId"
            and (candidate_review.source_entity_updated_at = q."entityUpdatedAt"
              or candidate_review.result_entity_updated_at = q."entityUpdatedAt")
          order by candidate_review.created_at desc, candidate_review.id desc limit 1
        ) r on true
        where ($1::text is null or (q."entityType",q."entityId") > ($1,$2::uuid))
        order by q."entityType",q."entityId" limit $3`,
      [input.cursor?.entityType ?? null, input.cursor?.entityId ?? null, input.limit]);
      return { authorized: true, cursorFound: true, rows: rows.map(toQueueRow) } as const;
    });
  }

  async claimReview(input: Actor & OpsDataQualityCursor) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`${currentCandidateCte(input.entityType)}
        insert into ops_catalog_quality_reviews (
          entity_type,entity_id,source_entity_updated_at,source_evidence_id,source_evidence_captured_at,
          source_issue_code,assigned_user_id,assigned_grant_id,assigned_role,created_at,updated_at
        ) select entity_type,entity_id,entity_updated_at,evidence_id,evidence_captured_at,issue_code,
          $2,$3,$4,recorded_at,recorded_at from current_candidate
        on conflict on constraint ops_catalog_quality_reviews_generation_unique do nothing
        returning ${returningReviewColumns()}`,
      [input.entityId, input.actorUserId, authority.grantId, input.activeRole]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async escalateReview(input: Actor & OpsDataQualityCursor & { expectedRevision: number;
    code: OpsDataQualityEscalationCode; reference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`${currentCandidateCte(input.entityType)}
        update ops_catalog_quality_reviews r set status = 'escalated', revision = r.revision + 1,
          escalation_code = $6, escalation_reference = $7, escalated_at = clock_timestamp(), updated_at = clock_timestamp()
        from current_candidate q
        where r.entity_type = q.entity_type and r.entity_id = q.entity_id
          and r.source_entity_updated_at = q.entity_updated_at
          and r.source_evidence_id is not distinct from q.evidence_id
          and r.revision = $2 and r.status = 'investigating'
          and r.assigned_user_id = $3 and r.assigned_grant_id = $4 and r.assigned_role = $5
        returning ${returningReviewColumns("r")}`,
      [input.entityId, input.expectedRevision, input.actorUserId, authority.grantId,
        input.activeRole, input.code, input.reference]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async resolveReview(input: Actor & OpsDataQualityCursor & { expectedRevision: number;
    code: OpsDataQualityResolutionCode; reference: string; reviewDueAt: Date | null }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const spec = tableSpec(input.entityType), status = resolutionStatus(input.code);
      const entityUpdate = input.code === "source_evidence_required_no_change" ? "" : `,
        entity_update as (
          update ${spec.table} e set
            verification_status = case when $6 = 'source_confirmed' then 'verified' else 'disputed' end,
            verified_by_user_id = case when $6 = 'source_confirmed' then $3::uuid else null end,
            last_verified_at = case when $6 = 'source_confirmed' then c.recorded_at else null end,
            next_review_due_at = case when $6 = 'source_confirmed' then $8::timestamptz else null end,
            updated_at = c.recorded_at
          from review_target t, database_clock c
          where e.id = t.entity_id and e.updated_at = t.source_entity_updated_at
          returning e.updated_at
        )`;
      const resultExpression = input.code === "source_evidence_required_no_change"
        ? "t.source_entity_updated_at" : "(select updated_at from entity_update)";
      const rows = await tx.query<ReviewRow>(`${currentCandidateCte(input.entityType)},
        review_target as (
          select r.* from ops_catalog_quality_reviews r join current_candidate q
            on r.entity_type = q.entity_type and r.entity_id = q.entity_id
            and r.source_entity_updated_at = q.entity_updated_at
            and r.source_evidence_id is not distinct from q.evidence_id
          where r.revision = $2 and r.status in ('investigating','escalated') and r.assigned_user_id <> $3
            and (($6 = 'source_confirmed' and q.evidence_id is not null and $8::timestamptz is not null
                and $8::timestamptz >= q.recorded_at + interval '30 days'
                and $8::timestamptz <= q.recorded_at + interval '366 days')
              or ($6 in ('source_conflict_confirmed','source_invalid') and q.evidence_id is not null and $8::timestamptz is null)
              or ($6 = 'source_evidence_required_no_change' and q.evidence_id is null
                and q.issue_code = 'missing_source_evidence' and $8::timestamptz is null))
          for update of r
        )${entityUpdate}
        update ops_catalog_quality_reviews r set status = $9, revision = r.revision + 1,
          resolved_by_user_id = $3, resolved_by_grant_id = $4, resolved_by_role = $5,
          resolution_code = $6, resolution_reference = $7, resolved_at = c.recorded_at,
          review_due_at = $8, result_entity_updated_at = ${resultExpression}, updated_at = c.recorded_at
        from review_target t, database_clock c
        where r.id = t.id ${input.code === "source_evidence_required_no_change" ? "" : "and exists (select 1 from entity_update)"}
        returning ${returningReviewColumns("r")}`,
      [input.entityId, input.expectedRevision, input.actorUserId, authority.grantId, input.activeRole,
        input.code, input.reference, input.reviewDueAt, status]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }
}

function currentCandidateCte(entityType: OpsDataQualityEntityType): string {
  const spec = tableSpec(entityType);
  return `with database_clock as (select clock_timestamp() as recorded_at),
    locked_entity as (
      select '${entityType}'::text as entity_type, e.id as entity_id, e.updated_at as entity_updated_at,
        e.status as catalog_status, e.verification_status, e.verified_by_user_id,
        e.last_verified_at, e.next_review_due_at
      from ${spec.table} e where e.id = $1 for update
    ),
    current_candidate as (
      select e.entity_type,e.entity_id,e.entity_updated_at,ev.id as evidence_id,
        ev.captured_at as evidence_captured_at,c.recorded_at,
        case
          when ev.id is null then 'missing_source_evidence'
          when ev.source_url is null or char_length(ev.source_url) > 2048
            or ev.source_url !~ '^https://[^[:space:]]+$' then 'invalid_source_url'
          when e.verification_status = 'disputed' then 'disputed'
          when e.verification_status = 'stale'
            or (e.verification_status = 'verified' and e.next_review_due_at <= c.recorded_at) then 'stale'
          when e.verification_status = 'verified' and (e.verified_by_user_id is null
            or e.last_verified_at is null or e.next_review_due_at is null) then 'verification_metadata_missing'
          else 'unverified'
        end as issue_code
      from locked_entity e cross join database_clock c
      left join lateral (
        select id,source_url,captured_at from catalog_source_evidence
        where entity_type = e.entity_type and entity_id = e.entity_id
        order by captured_at desc,id desc limit 1
      ) ev on true
      where e.catalog_status <> 'archived' and e.verification_status <> 'archived'
        and e.entity_updated_at <= c.recorded_at
        and (ev.id is null or ev.source_url is null or char_length(ev.source_url) > 2048
          or ev.source_url !~ '^https://[^[:space:]]+$' or e.verification_status <> 'verified'
          or e.verified_by_user_id is null or e.last_verified_at is null or e.next_review_due_at is null
          or e.next_review_due_at <= c.recorded_at)
    )`;
}

function tableSpec(entityType: OpsDataQualityEntityType): TableSpec {
  switch (entityType) {
    case "city": return { table: "cities", alias: "c", label: "name_en" };
    case "school": return { table: "schools", alias: "s", label: "name_en" };
    case "program": return { table: "programs", alias: "p", label: "name_en" };
    case "scholarship": return { table: "scholarships", alias: "sch", label: "title" };
  }
}

function resolutionStatus(code: OpsDataQualityResolutionCode): OpsDataQualityReview["status"] {
  if (code === "source_confirmed") return "verified";
  if (code === "source_evidence_required_no_change") return "closed_no_change";
  return "disputed";
}

function returningReviewColumns(alias = "ops_catalog_quality_reviews"): string {
  return `${alias}.id as "reviewId", ${alias}.source_entity_updated_at as "sourceEntityUpdatedAt",
    ${alias}.source_evidence_id as "sourceEvidenceId", ${alias}.source_evidence_captured_at as "sourceEvidenceCapturedAt",
    ${alias}.source_issue_code as "sourceIssueCode", ${alias}.revision, ${alias}.status,
    ${alias}.assigned_user_id as "assignedUserId", ${alias}.assigned_role as "assignedRole",
    ${alias}.escalation_code as "escalationCode", ${alias}.escalation_reference as "escalationReference",
    ${alias}.escalated_at as "escalatedAt", ${alias}.resolved_by_user_id as "resolvedByUserId",
    ${alias}.resolution_code as "resolutionCode", ${alias}.resolution_reference as "resolutionReference",
    ${alias}.resolved_at as "resolvedAt", ${alias}.review_due_at as "reviewDueAt",
    ${alias}.result_entity_updated_at as "resultEntityUpdatedAt", ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"`;
}

function toQueueRow(row: QueueRow): OpsDataQualityQueueRow {
  return {
    entityType: row.entityType, entityId: row.entityId, label: row.label,
    verificationStatus: row.verificationStatus, lastVerifiedAt: row.lastVerifiedAt,
    nextReviewDueAt: row.nextReviewDueAt, entityUpdatedAt: row.entityUpdatedAt, issueCode: row.issueCode,
    evidence: row.evidenceId && row.capturedAt ? { evidenceId: row.evidenceId, sourceUrl: row.sourceUrl,
      sourceLabel: row.sourceLabel, capturedAt: row.capturedAt } : null,
    review: row.reviewId ? toReview(row as ReviewRow) : null,
  };
}

function toReview(row: ReviewRow): OpsDataQualityReview {
  return { ...row };
}

export function dataQualityIssueForTest(input: { verificationStatus: string; verifiedByUserId: string | null;
  lastVerifiedAt: Date | null; nextReviewDueAt: Date | null; entityUpdatedAt: Date; evidence: {
    id: string; sourceUrl: string | null; capturedAt: Date } | null; now: Date }): OpsDataQualityIssueCode | null {
  if (input.entityUpdatedAt > input.now) return null;
  if (!input.evidence) return "missing_source_evidence";
  if (!safeHttpsUrl(input.evidence.sourceUrl)) return "invalid_source_url";
  if (input.verificationStatus === "disputed") return "disputed";
  if (input.verificationStatus === "stale"
    || (input.verificationStatus === "verified" && input.nextReviewDueAt !== null
      && input.nextReviewDueAt <= input.now)) return "stale";
  if (input.verificationStatus === "verified" && (!input.verifiedByUserId
    || !input.lastVerifiedAt || !input.nextReviewDueAt)) return "verification_metadata_missing";
  if (input.verificationStatus === "verified") return null;
  return "unverified";
}

function safeHttpsUrl(value: string | null): boolean {
  if (!value || value.length > 2048 || !value.startsWith("https://") || /\s/.test(value)) return false;
  try { return new URL(value).hostname.length > 0; } catch { return false; }
}

export function dataQualityCorrupt() {
  return serviceUnavailable("Catalog data-quality state requires reconciliation.");
}
