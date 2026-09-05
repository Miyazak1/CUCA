import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type {
  SchoolCatalogChangeSet,
  SchoolCatalogCorrection,
  SchoolCatalogCorrectionRepository,
  SchoolCatalogSnapshot,
} from "./service.ts";

type SchoolAuthority = { membershipId: string; membershipRole: "admissions" | "counselor" | "school_admin" };

const correctionSelect = `select
  r.id, r.school_id as "schoolId", s.name_zh as "schoolNameZh", s.name_en as "schoolNameEn",
  r.source_school_updated_at as "sourceSchoolUpdatedAt", r.change_set_json as changes,
  r.evidence_url as "evidenceUrl", r.reason_code as "reasonCode", r.revision, r.status,
  r.requested_membership_role as "requestedMembershipRole",
  r.claimed_by_user_id as "claimedByUserId", r.claimed_by_role as "claimedByRole", r.claimed_at as "claimedAt",
  r.resolved_by_user_id as "resolvedByUserId", r.resolution_code as "resolutionCode",
  r.resolution_reference as "resolutionReference", r.resolved_at as "resolvedAt",
  r.result_school_updated_at as "resultSchoolUpdatedAt", r.created_at as "createdAt", r.updated_at as "updatedAt"
from school_catalog_correction_requests r join schools s on s.id = r.school_id`;

const schoolSelect = `select id, name_zh as "nameZh", name_en as "nameEn",
  to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "updatedAt",
  verification_status as "verificationStatus", website_url as "websiteUrl", admissions_url as "admissionsUrl",
  application_level as "applicationLevel", language_of_instruction as "languageOfInstruction",
  deadline_summary as "deadlineSummary", tuition_summary as "tuitionSummary", application_fee as "applicationFee"
from schools`;

export class PostgresSchoolCatalogCorrectionRepository implements SchoolCatalogCorrectionRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async listForSchool(input: { actorUserId: string; schoolId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockSchoolAuthority(tx, input.actorUserId, input.schoolId)) return { authorized: false } as const;
      const schools = await tx.query<SchoolCatalogSnapshot>(`${schoolSelect} where id = $1 and status = 'active' for share`, [input.schoolId]);
      if (!schools[0]) return { authorized: false } as const;
      const items = await tx.query<SchoolCatalogCorrection>(`${correctionSelect}
        where r.school_id = $1 order by r.created_at desc, r.id desc limit 100`, [input.schoolId]);
      return { authorized: true, value: { school: schools[0], items } } as const;
    });
  }

  async submit(input: Parameters<SchoolCatalogCorrectionRepository["submit"]>[0]) {
    return this.client.transaction(async tx => {
      const authority = await lockSchoolAuthority(tx, input.actorUserId, input.schoolId);
      if (!authority) return { authorized: false } as const;
      const schools = await tx.query<SchoolCatalogSnapshot>(`${schoolSelect}
        where id = $1 and status = 'active' for update`, [input.schoolId]);
      const school = schools[0];
      if (!school || school.updatedAt !== input.sourceSchoolUpdatedAt
        || !hasMaterialChange(school, input.changes)) return { authorized: true, value: null } as const;
      const clock = await tx.query<{ recordedAt: Date }>("select clock_timestamp() as \"recordedAt\"", []);
      const recordedAt = clock[0]?.recordedAt;
      if (!recordedAt || recordedAt < new Date(input.sourceSchoolUpdatedAt)) return { authorized: true, value: null } as const;
      const inserted = await tx.query<{ id: string }>(
        `insert into school_catalog_correction_requests
          (school_id, source_school_updated_at, change_set_json, evidence_url, reason_code,
           requested_by_user_id, requested_membership_id, requested_membership_role, created_at, updated_at)
         select s.id,s.updated_at,$3::jsonb,$4,$5,$6,$7,$8,$9,$9 from schools s
         where s.id = $1 and s.status = 'active'
           and to_char(s.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') = $2
         on conflict (school_id, source_school_updated_at) where status in ('submitted','claimed') do nothing
         returning id`,
        [input.schoolId, input.sourceSchoolUpdatedAt, JSON.stringify(input.changes), input.evidenceUrl,
          input.reasonCode, input.actorUserId, authority.membershipId, authority.membershipRole, recordedAt],
      );
      const correction = inserted[0]
        ? await correctionById(tx, inserted[0].id)
        : null;
      return { authorized: true, value: correction } as const;
    });
  }

  async listForOps(input: Parameters<SchoolCatalogCorrectionRepository["listForOps"]>[0]) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const items = await tx.query<SchoolCatalogCorrection>(`${correctionSelect}
        where ($1::text is null or r.status = $1)
        order by case r.status when 'submitted' then 0 when 'claimed' then 1 else 2 end,
          r.updated_at desc, r.id desc limit $2`, [input.status, input.limit]);
      return { authorized: true, value: items } as const;
    });
  }

  async claim(input: Parameters<SchoolCatalogCorrectionRepository["claim"]>[0]) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const current = await tx.query<{ id: string }>(`${correctionSelect}
        where r.id = $1 and r.status = 'submitted' and r.revision = $2 for update of r`,
      [input.correctionId, input.expectedRevision]);
      if (!current[0]) return { authorized: true, value: null } as const;
      const updated = await tx.query<{ id: string }>(
        `update school_catalog_correction_requests
         set status = 'claimed', revision = 2, claimed_by_user_id = $2, claimed_by_grant_id = $3,
           claimed_by_role = $4, claimed_at = clock_timestamp(), updated_at = clock_timestamp()
         where id = $1 and status = 'submitted' and revision = $5 returning id`,
        [input.correctionId, input.actorUserId, authority.grantId, input.activeRole, input.expectedRevision],
      );
      return { authorized: true, value: updated[0] ? await correctionById(tx, updated[0].id) : null } as const;
    });
  }

  async resolve(input: Parameters<SchoolCatalogCorrectionRepository["resolve"]>[0]) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<SchoolCatalogCorrection>(`${correctionSelect}
        where r.id = $1 and r.status = 'claimed' and r.revision = $2 for update of r, s`,
      [input.correctionId, input.expectedRevision]);
      const current = rows[0];
      if (!current || current.claimedByUserId === input.actorUserId) return { authorized: true, value: null } as const;
      const clock = await tx.query<{ recordedAt: Date }>("select clock_timestamp() as \"recordedAt\"", []);
      const recordedAt = clock[0]?.recordedAt;
      if (!recordedAt || recordedAt <= current.sourceSchoolUpdatedAt) return { authorized: true, value: null } as const;

      let status: "applied" | "rejected" = "rejected";
      let resultSchoolUpdatedAt = current.sourceSchoolUpdatedAt;
      if (input.code === "applied_unverified") {
        const lineage = Object.fromEntries(Object.keys(current.changes)
          .map(field => [field, `school_catalog_correction:${current.id}:unverified`]));
        const changed = await tx.query<{ updatedAt: Date }>(
          `update schools set
             website_url = case when $2::jsonb ? 'websiteUrl' then $2::jsonb ->> 'websiteUrl' else website_url end,
             admissions_url = case when $2::jsonb ? 'admissionsUrl' then $2::jsonb ->> 'admissionsUrl' else admissions_url end,
             application_level = case when $2::jsonb ? 'applicationLevel' then $2::jsonb ->> 'applicationLevel' else application_level end,
             language_of_instruction = case when $2::jsonb ? 'languageOfInstruction' then $2::jsonb ->> 'languageOfInstruction' else language_of_instruction end,
             deadline_summary = case when $2::jsonb ? 'deadlineSummary' then $2::jsonb ->> 'deadlineSummary' else deadline_summary end,
             tuition_summary = case when $2::jsonb ? 'tuitionSummary' then $2::jsonb ->> 'tuitionSummary' else tuition_summary end,
             application_fee = case when $2::jsonb ? 'applicationFee' then $2::jsonb ->> 'applicationFee' else application_fee end,
             source_field_lineage_json = source_field_lineage_json || $3::jsonb,
             verification_status = 'unverified', verified_by_user_id = null,
             last_verified_at = null, next_review_due_at = null, updated_at = $4
           where id = $1 and status = 'active'
             and updated_at = (select source_school_updated_at from school_catalog_correction_requests where id = $5)
           returning updated_at as "updatedAt"`,
          [current.schoolId, JSON.stringify(current.changes), JSON.stringify(lineage), recordedAt, current.id],
        );
        if (!changed[0] || changed[0].updatedAt.getTime() !== recordedAt.getTime()) {
          return { authorized: true, value: null } as const;
        }
        status = "applied";
        resultSchoolUpdatedAt = recordedAt;
      }

      const updated = await tx.query<{ id: string }>(
        `update school_catalog_correction_requests set status = $2, revision = 3,
           resolved_by_user_id = $3, resolved_by_grant_id = $4, resolved_by_role = $5,
           resolution_code = $6, resolution_reference = $7, resolved_at = $8,
           result_school_updated_at = case when $2 = 'applied' then $9
             else source_school_updated_at end, updated_at = $8
         where id = $1 and status = 'claimed' and revision = $10 returning id`,
        [current.id, status, input.actorUserId, authority.grantId, input.activeRole,
          input.code, input.reference, recordedAt, resultSchoolUpdatedAt, input.expectedRevision],
      );
      return { authorized: true, value: updated[0] ? await correctionById(tx, updated[0].id) : null } as const;
    });
  }
}

async function lockSchoolAuthority(client: TransactionalSqlClient, actorUserId: string,
  schoolId: string): Promise<SchoolAuthority | null> {
  const rows = await client.query<SchoolAuthority>(
    `select m.id as "membershipId", m.role as "membershipRole"
     from users u
     join user_roles r on r.user_id = u.id and r.role = 'school_staff' and r.revoked_at is null
     join school_staff_memberships m on m.user_id = u.id and m.school_id = $2
       and m.status = 'active' and m.removed_at is null
     where u.id = $1 and u.account_status = 'active'
       and m.role in ('admissions','counselor','school_admin')
     for share of u, r, m limit 1`, [actorUserId, schoolId],
  );
  return rows[0] ?? null;
}

async function correctionById(client: TransactionalSqlClient, id: string): Promise<SchoolCatalogCorrection | null> {
  const rows = await client.query<SchoolCatalogCorrection>(`${correctionSelect} where r.id = $1`, [id]);
  return rows[0] ?? null;
}

function hasMaterialChange(school: SchoolCatalogSnapshot, changes: SchoolCatalogChangeSet): boolean {
  return Object.entries(changes).some(([field, value]) => school[field as keyof SchoolCatalogChangeSet] !== value);
}
