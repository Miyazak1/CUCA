import type {
  CloseOpsSupportAccessSessionResult,
  OpenOpsSupportAccessSessionResult,
  OpsApplicationSupportProjection,
  OpsApplicationSupportRepository,
  OpsProgramApplicationProjection,
  ResolveOpsSupportAccessSessionResult,
} from "./service.ts";
import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";

export type SqlOpsApplicationSupportClient = TransactionalSqlClient;

type ApplicationSetRow = {
  applicationSetId: string;
  cuacId: string;
  status: string;
  targetIntake: string | null;
  revision: number;
  activeChoiceCount: number;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  submissionStatus: string | null;
  submissionSubmittedAt: Date | null;
  groupCount: number;
  pendingGroupCount: number;
  dispatchedGroupCount: number;
  quarantinedGroupCount: number;
};

type ProgramApplicationRow = OpsProgramApplicationProjection;

type SupportSessionRow = {
  supportSessionId: string;
  applicationSetId: string;
  cuacId: string;
  reasonCode: "student_inquiry" | "school_inquiry" | "payment_inquiry" | "delivery_investigation" | "incident_response";
  createdAt: Date;
  expiresAt: Date;
};

export class PostgresOpsApplicationSupportRepository implements OpsApplicationSupportRepository {
  private readonly client: SqlOpsApplicationSupportClient;

  constructor(client: SqlOpsApplicationSupportClient) {
    this.client = client;
  }

  async openApplicationSupportSession(input: {
    actorUserId: string;
    activeRole: "cuac_ops" | "cuac_admin";
    cuacId: string;
    reasonCode: SupportSessionRow["reasonCode"];
    ttlMs: number;
  }): Promise<OpenOpsSupportAccessSessionResult> {
    return this.client.transaction(async (client) => {
      const authority = await lockLiveCuacStaffAuthority(client, input);
      if (!authority) return { authorized: false };
      const targets = await client.query<{ applicationSetId: string; cuacId: string }>(
        `select id as "applicationSetId", cuac_id as "cuacId"
         from application_sets where cuac_id = $1 for share`,
        [input.cuacId],
      );
      const target = targets[0];
      if (!target) return { authorized: true, targetFound: false };
      const rows = await client.query<SupportSessionRow>(
        `with database_clock as (
           select date_trunc('milliseconds', clock_timestamp()) as recorded_at
         )
         insert into ops_support_access_sessions (
           actor_user_id, staff_access_grant_id, active_role,
           application_set_id, cuac_id, reason_code, expires_at, created_at, updated_at
         )
         select $1, $2, $3, $4, $5, $6,
           least($8::timestamptz, database_clock.recorded_at + ($7 * interval '1 millisecond')),
           database_clock.recorded_at, database_clock.recorded_at
         from database_clock
         where $8::timestamptz > database_clock.recorded_at
         returning id as "supportSessionId", application_set_id as "applicationSetId",
           cuac_id as "cuacId", reason_code as "reasonCode", created_at as "createdAt", expires_at as "expiresAt"`,
        [input.actorUserId, authority.grantId, input.activeRole, target.applicationSetId,
          target.cuacId, input.reasonCode, input.ttlMs, authority.expiresAt],
      );
      if (!rows[0]) return { authorized: false };
      return { authorized: true, targetFound: true, session: rows[0] };
    });
  }

  async resolveApplicationSupportSession(input: {
    actorUserId: string;
    activeRole: "cuac_ops" | "cuac_admin";
    supportSessionId: string;
  }): Promise<ResolveOpsSupportAccessSessionResult> {
    return this.client.transaction(async (client) => {
      const authority = await lockLiveCuacStaffAuthority(client, input);
      if (!authority) return { authorized: false };
      const rows = await client.query<SupportSessionRow>(
        `select ss.id as "supportSessionId", ss.application_set_id as "applicationSetId",
           ss.cuac_id as "cuacId", ss.reason_code as "reasonCode",
           ss.created_at as "createdAt", ss.expires_at as "expiresAt"
         from ops_support_access_sessions ss
         join application_sets a on a.id = ss.application_set_id and a.cuac_id = ss.cuac_id
         where ss.id = $1 and ss.actor_user_id = $2 and ss.active_role = $3
           and ss.staff_access_grant_id = $4 and ss.closed_at is null
           and ss.expires_at > clock_timestamp()
         for share of ss, a
         limit 1`,
        [input.supportSessionId, input.actorUserId, input.activeRole, authority.grantId],
      );
      return { authorized: true, session: rows[0] ?? null };
    });
  }

  async closeApplicationSupportSession(input: {
    actorUserId: string;
    activeRole: "cuac_ops" | "cuac_admin";
    supportSessionId: string;
  }): Promise<CloseOpsSupportAccessSessionResult> {
    return this.client.transaction(async (client) => {
      const authority = await lockLiveCuacStaffAuthority(client, input);
      if (!authority) return { authorized: false };
      const rows = await client.query<{ closedAt: Date }>(
        `update ops_support_access_sessions
         set closed_at = date_trunc('milliseconds', clock_timestamp()),
           updated_at = date_trunc('milliseconds', clock_timestamp())
         where id = $1 and actor_user_id = $2 and active_role = $3
           and staff_access_grant_id = $4 and closed_at is null
         returning closed_at as "closedAt"`,
        [input.supportSessionId, input.actorUserId, input.activeRole, authority.grantId],
      );
      return { authorized: true, closedAt: rows[0]?.closedAt ?? null };
    });
  }

  async findApplicationSupportByCuacId(cuacId: string): Promise<OpsApplicationSupportProjection | null> {
    const rows = await this.client.query<ApplicationSetRow>(
      `select
         a.id as "applicationSetId",
         a.cuac_id as "cuacId",
         a.status,
         a.target_intake as "targetIntake",
         a.revision,
         (select count(*)::integer from application_choices c
           where c.application_set_id = a.id and c.removed_at is null) as "activeChoiceCount",
         a.created_at as "createdAt",
         a.updated_at as "updatedAt",
         a.submitted_at as "submittedAt",
         submission.status as "submissionStatus",
         submission.submitted_at as "submissionSubmittedAt",
         (select count(*)::integer from official_submission_groups g
           where g.application_set_id = a.id) as "groupCount",
         (select count(*)::integer from official_submission_groups g
           where g.application_set_id = a.id and g.transport_status in ('pending','leased')) as "pendingGroupCount",
         (select count(*)::integer from official_submission_groups g
           where g.application_set_id = a.id and g.transport_status = 'dispatched') as "dispatchedGroupCount",
         (select count(*)::integer from official_submission_groups g
           where g.application_set_id = a.id and g.transport_status = 'quarantined') as "quarantinedGroupCount"
       from application_sets a
       left join application_submissions submission on submission.application_set_id = a.id
       where a.cuac_id = $1
       limit 1`,
      [cuacId],
    );
    const row = rows[0];
    if (!row) return null;

    const programApplications = await this.client.query<ProgramApplicationRow>(
      `select
         sa.id as "applicationId",
         sa.school_id as "schoolId",
         s.name_en as "schoolName",
         sa.program_id as "programId",
         p.name_en as "programName",
         sa.program_intake_id as "programIntakeId",
         intake.intake_term as "intakeTerm",
         intake.intake_year as "intakeYear",
         sa.status,
         sa.status_changed_at as "statusChangedAt",
         sa.submitted_at as "submittedAt",
         sa.first_viewed_at as "firstViewedAt"
       from school_applications sa
       join schools s on s.id = sa.school_id
       left join programs p on p.id = sa.program_id
       left join program_intakes intake on intake.id = sa.program_intake_id
       where sa.application_set_id = $1
       order by sa.created_at, sa.id`,
      [row.applicationSetId],
    );

    return {
      cuacId: row.cuacId,
      applicationSet: {
        status: row.status,
        targetIntake: row.targetIntake,
        revision: row.revision,
        activeChoiceCount: row.activeChoiceCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        submittedAt: row.submittedAt,
      },
      submission: row.submissionStatus && row.submissionSubmittedAt ? {
        status: row.submissionStatus,
        submittedAt: row.submissionSubmittedAt,
        groupCount: row.groupCount,
        pendingGroupCount: row.pendingGroupCount,
        dispatchedGroupCount: row.dispatchedGroupCount,
        quarantinedGroupCount: row.quarantinedGroupCount,
      } : null,
      programApplications,
    };
  }
}
