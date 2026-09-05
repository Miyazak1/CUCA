import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import type {
  SchoolApplicationContactLogDto,
  SchoolApplicationDetailDto,
  SchoolApplicationQueueItemDto,
  SchoolApplicationStatusEventDto,
  SchoolApplicationStatusMutationDto,
  SchoolPortalRepository,
} from "./service.ts";
import {
  MAX_SCHOOL_APPLICATION_REVISION,
  SCHOOL_APPLICATION_WORKFLOW_STATUSES,
  SCHOOL_CONTACT_CHANNELS,
  SCHOOL_CONTACT_DIRECTIONS,
  SCHOOL_CONTACT_OUTCOMES,
  canTransitionSchoolApplication,
  isContactableSchoolApplicationStatus,
  type SchoolApplicationContactCommand,
  type SchoolApplicationStatusCommand,
} from "./workflow.ts";

export type SqlSchoolPortalClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

type SchoolApplicationQueueRow = {
  id: string;
  applicationRecordFormat: string;
  cuacId: string | null;
  schoolId: string;
  studentUserId: string;
  programId: string | null;
  programIntakeId: string | null;
  status: string;
  schoolRevision: number;
  statusChangedAt: Date;
  submittedAt: Date | null;
  firstViewedAt: Date | null;
  schoolVisibleProfileJson: Record<string, unknown>;
  routingMetadataJson: Record<string, unknown>;
};

type SchoolApplicationStatusEventRow = {
  id: string;
  schoolApplicationId: string;
  actorUserId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  applicationRevision: number | null;
  createdAt: Date;
};

type SchoolApplicationContactLogRow = {
  id: string;
  schoolApplicationId: string;
  actorUserId: string;
  channel: string;
  direction: string;
  outcome: string;
  note: string;
  requestHash?: string;
  createdAt: Date;
};

type LockedSchoolApplicationRow = {
  id: string;
  schoolId: string;
  applicationSetId: string;
  applicationRecordFormat: string;
  status: string;
  schoolRevision: number;
  submittedAt: Date | null;
  studentUserId: string;
};

type StatusReceiptRow = {
  statusEventId: string;
  requestHash: string;
  toStatus: string;
  applicationRevision: number;
  createdAt: Date;
};

const workflowConflict = (message = "School application workflow changed. Reload before updating.") =>
  new CuacError("CONFLICT", message, 409);
const readableApplicationFormats = ["cuac.program-application.v1", "cuac.program-application.v2"];

export class PostgresSchoolPortalRepository implements SchoolPortalRepository {
  private readonly client: SqlSchoolPortalClient;

  constructor(client: SqlSchoolPortalClient) {
    this.client = client;
  }

  async listApplicationQueueBySchoolId(schoolId: string, cuacId?: string): Promise<SchoolApplicationQueueItemDto[]> {
    const rows = await this.client.query<SchoolApplicationQueueRow>(
      `${schoolApplicationProjectionSelectSql}
       where sa.school_id = $1 and sa.status <> 'pending_submission'${cuacId === undefined ? "" : " and sa.cuac_id = $2"}
       order by sa.submitted_at desc nulls last, sa.created_at desc`,
      cuacId === undefined ? [schoolId] : [schoolId, cuacId],
    );

    return rows.map(toQueueItemDto);
  }

  async getApplicationById(applicationId: string, schoolId: string): Promise<SchoolApplicationDetailDto | null> {
    const rows = await this.client.query<SchoolApplicationQueueRow>(
      `${schoolApplicationProjectionSelectSql}
       where sa.id = $1 and sa.school_id = $2 and sa.status <> 'pending_submission'
       limit 1`,
      [applicationId, schoolId],
    );

    if (!rows[0]) {
      return null;
    }

    const events = await this.client.query<SchoolApplicationStatusEventRow>(
      `${schoolApplicationStatusEventSelectSql}
       where school_application_id = $1
         and exists (select 1 from school_applications sa where sa.id = $1 and sa.school_id = $2 and sa.status <> 'pending_submission')
       order by created_at asc, id asc`,
      [applicationId, schoolId],
    );

    const contacts = await this.client.query<SchoolApplicationContactLogRow>(
      `${schoolApplicationContactLogSelectSql}
       where c.school_application_id = $1 and c.school_id = $2
       order by c.created_at asc, c.id asc`,
      [applicationId, schoolId],
    );

    return {
      ...toQueueItemDto(rows[0]),
      statusEvents: events.map(toStatusEventDto),
      contactLogs: contacts.map(toContactLogDto),
    };
  }

  async updateApplicationStatus(input: {
    applicationId: string;
    schoolId: string;
    actorUserId: string;
    command: SchoolApplicationStatusCommand;
    keyHash: string;
    requestHash: string;
  }): Promise<{ result: SchoolApplicationStatusMutationDto; changed: boolean; fromStatus: string;
    recipientStudentUserId: string; recipientApplicationSetId: string }> {
    await assertLiveWriteAuthority(this.client, input.actorUserId, input.schoolId);
    const application = await lockApplication(this.client, input.applicationId, input.schoolId);
    if (!application) throw forbidden("School application is not available in this tenant.");

    const receipts = await this.client.query<StatusReceiptRow>(
      `select id as "statusEventId", request_hash as "requestHash", to_status as "toStatus",
         application_revision as "applicationRevision", created_at as "createdAt"
       from school_application_status_events
       where school_application_id = $1 and actor_user_id = $2 and command_key_hash = $3
       limit 1`,
      [input.applicationId, input.actorUserId, input.keyHash],
    );
    if (receipts[0]) {
      const receipt = receipts[0];
      if (receipt.requestHash !== input.requestHash) {
        throw workflowConflict("Idempotency-Key was already used for another school workflow command.");
      }
      if (!SCHOOL_APPLICATION_WORKFLOW_STATUSES.includes(receipt.toStatus as never)
        || !Number.isSafeInteger(receipt.applicationRevision) || receipt.applicationRevision < 2
        || !validDate(receipt.createdAt)) throw serviceUnavailable("Stored school workflow receipt is invalid.");
      return {
        changed: false,
        fromStatus: receipt.toStatus,
        recipientStudentUserId: application.studentUserId,
        recipientApplicationSetId: application.applicationSetId,
        result: {
          id: input.applicationId,
          schoolId: input.schoolId,
          status: receipt.toStatus as SchoolApplicationStatusMutationDto["status"],
          schoolRevision: receipt.applicationRevision,
          statusChangedAt: receipt.createdAt,
          statusEventId: receipt.statusEventId,
        },
      };
    }

    assertReceivedV2Application(application);
    if (application.schoolRevision !== input.command.expectedRevision) throw workflowConflict();
    if (!canTransitionSchoolApplication(application.status, input.command.status)) {
      throw workflowConflict("The requested school application status transition is not allowed.");
    }
    if (application.schoolRevision === MAX_SCHOOL_APPLICATION_REVISION) {
      throw workflowConflict("School application revision is exhausted.");
    }

    const rows = await this.client.query<{
      id: string;
      schoolId: string;
      status: string;
      schoolRevision: number;
      statusChangedAt: Date;
      statusEventId: string;
    }>(
      `with changed as (
         update school_applications
         set status = $4, school_revision = school_revision + 1,
           status_changed_at = clock_timestamp(), updated_at = clock_timestamp()
         where id = $1 and school_id = $2 and school_revision = $3 and status = $5
         returning id, school_id, status, school_revision, status_changed_at
       ), recorded as (
         insert into school_application_status_events
           (school_application_id, actor_user_id, from_status, to_status, reason, application_revision,
            command_key_hash, request_hash, metadata_json, created_at)
         select id, $6, $5, status, $7, school_revision, $8, $9, '{}'::jsonb, status_changed_at from changed
         returning id
       )
       select changed.id, changed.school_id as "schoolId", changed.status,
         changed.school_revision as "schoolRevision", changed.status_changed_at as "statusChangedAt",
         recorded.id as "statusEventId" from changed cross join recorded`,
      [input.applicationId, input.schoolId, input.command.expectedRevision, input.command.status,
        application.status, input.actorUserId, input.command.reason, input.keyHash, input.requestHash],
    );
    const row = rows[0];
    if (!row || !SCHOOL_APPLICATION_WORKFLOW_STATUSES.includes(row.status as never)
      || !Number.isSafeInteger(row.schoolRevision) || !validDate(row.statusChangedAt)) {
      throw serviceUnavailable("School application status could not be updated.");
    }
    return {
      changed: true,
      fromStatus: application.status,
      recipientStudentUserId: application.studentUserId,
      recipientApplicationSetId: application.applicationSetId,
      result: {
        id: row.id,
        schoolId: row.schoolId,
        status: row.status as SchoolApplicationStatusMutationDto["status"],
        schoolRevision: row.schoolRevision,
        statusChangedAt: row.statusChangedAt,
        statusEventId: row.statusEventId,
      },
    };
  }

  async recordApplicationContact(input: {
    applicationId: string;
    schoolId: string;
    actorUserId: string;
    command: SchoolApplicationContactCommand;
    keyHash: string;
    requestHash: string;
  }): Promise<{ contact: SchoolApplicationContactLogDto; created: boolean }> {
    await assertLiveWriteAuthority(this.client, input.actorUserId, input.schoolId);
    const application = await lockApplication(this.client, input.applicationId, input.schoolId);
    if (!application) throw forbidden("School application is not available in this tenant.");

    const receipts = await this.client.query<SchoolApplicationContactLogRow>(
      `select c.id, c.school_application_id as "schoolApplicationId", c.actor_user_id as "actorUserId",
         c.channel, c.direction, c.outcome, c.note, c.request_hash as "requestHash", c.created_at as "createdAt"
       from school_application_contact_logs c
       where c.school_application_id = $1 and c.actor_user_id = $2 and c.command_key_hash = $3 limit 1`,
      [input.applicationId, input.actorUserId, input.keyHash],
    );
    if (receipts[0]) {
      if (receipts[0].requestHash !== input.requestHash) {
        throw workflowConflict("Idempotency-Key was already used for another school contact command.");
      }
      return { contact: toContactLogDto(receipts[0]), created: false };
    }

    assertReceivedV2Application(application);
    if (!isContactableSchoolApplicationStatus(application.status)) {
      throw workflowConflict("Contact cannot be recorded for a closed school application.");
    }
    const rows = await this.client.query<SchoolApplicationContactLogRow>(
      `insert into school_application_contact_logs
         (school_application_id, school_id, actor_user_id, channel, direction, outcome, note,
          command_key_hash, request_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id, school_application_id as "schoolApplicationId", actor_user_id as "actorUserId",
         channel, direction, outcome, note, created_at as "createdAt"`,
      [input.applicationId, input.schoolId, input.actorUserId, input.command.channel,
        input.command.direction, input.command.outcome, input.command.note, input.keyHash, input.requestHash],
    );
    if (!rows[0]) throw serviceUnavailable("School application contact could not be recorded.");
    return { contact: toContactLogDto(rows[0]), created: true };
  }
}

function toQueueItemDto(row: SchoolApplicationQueueRow): SchoolApplicationQueueItemDto {
  if (!readableApplicationFormats.includes(row.applicationRecordFormat)) {
    throw serviceUnavailable("Stored school application format is invalid.");
  }
  return {
    id: row.id,
    applicationRecordFormat: row.applicationRecordFormat,
    cuacId: row.cuacId,
    schoolId: row.schoolId,
    studentUserId: row.studentUserId,
    programId: row.programId,
    programIntakeId: row.programIntakeId,
    status: row.status,
    schoolRevision: row.schoolRevision,
    statusChangedAt: row.statusChangedAt,
    submittedAt: row.submittedAt,
    firstViewedAt: row.firstViewedAt,
    schoolVisibleProfile: row.schoolVisibleProfileJson,
    routingMetadata: row.routingMetadataJson,
  };
}

function toStatusEventDto(row: SchoolApplicationStatusEventRow): SchoolApplicationStatusEventDto {
  return {
    id: row.id,
    schoolApplicationId: row.schoolApplicationId,
    actorUserId: row.actorUserId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    applicationRevision: row.applicationRevision,
    createdAt: row.createdAt,
  };
}

function toContactLogDto(row: SchoolApplicationContactLogRow): SchoolApplicationContactLogDto {
  if (!SCHOOL_CONTACT_CHANNELS.includes(row.channel as never)
    || !SCHOOL_CONTACT_DIRECTIONS.includes(row.direction as never)
    || !SCHOOL_CONTACT_OUTCOMES.includes(row.outcome as never)
    || typeof row.note !== "string" || row.note.length < 1 || row.note.length > 2000 || !validDate(row.createdAt)) {
    throw serviceUnavailable("Stored school application contact is invalid.");
  }
  return {
    id: row.id,
    schoolApplicationId: row.schoolApplicationId,
    actorUserId: row.actorUserId,
    channel: row.channel as SchoolApplicationContactLogDto["channel"],
    direction: row.direction as SchoolApplicationContactLogDto["direction"],
    outcome: row.outcome as SchoolApplicationContactLogDto["outcome"],
    note: row.note,
    createdAt: row.createdAt,
  };
}

async function assertLiveWriteAuthority(client: SqlSchoolPortalClient, actorUserId: string, schoolId: string) {
  const users = await client.query("select id from users where id = $1 and account_status = 'active' for share", [actorUserId]);
  if (!users.length) throw forbidden("Active school staff account is required.");
  const roles = await client.query("select id from user_roles where user_id = $1 and role = 'school_staff' and revoked_at is null for share", [actorUserId]);
  if (!roles.length) throw forbidden("Active school staff role is required.");
  const schools = await client.query("select id from schools where id = $1 and status = 'active' for share", [schoolId]);
  if (!schools.length) throw forbidden("Active school tenant is required.");
  const memberships = await client.query<{ role: string }>(
    `select role from school_staff_memberships
     where user_id = $1 and school_id = $2 and status = 'active' and removed_at is null
     for share`, [actorUserId, schoolId],
  );
  if (!memberships.length || !["admissions", "counselor", "school_admin"].includes(memberships[0].role)) {
    throw forbidden("School membership does not allow workflow changes.");
  }
}

async function lockApplication(client: SqlSchoolPortalClient, applicationId: string, schoolId: string) {
  const rows = await client.query<LockedSchoolApplicationRow>(
    `select id, school_id as "schoolId", student_user_id as "studentUserId",
       application_set_id as "applicationSetId",
       application_record_format as "applicationRecordFormat", status,
       school_revision as "schoolRevision", submitted_at as "submittedAt"
     from school_applications where id = $1 and school_id = $2 for update`,
    [applicationId, schoolId],
  );
  return rows[0] ?? null;
}

function assertReceivedV2Application(application: LockedSchoolApplicationRow) {
  if (application.applicationRecordFormat !== "cuac.program-application.v2" || !validDate(application.submittedAt)
    || !SCHOOL_APPLICATION_WORKFLOW_STATUSES.includes(application.status as never)) {
    throw workflowConflict("Only a confirmed received Program Application can enter the school workflow.");
  }
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

const schoolApplicationProjectionSelectSql = `
select
  sa.id,
  sa.application_record_format as "applicationRecordFormat",
  sa.cuac_id as "cuacId",
  sa.school_id as "schoolId",
  sa.student_user_id as "studentUserId",
  sa.program_id as "programId",
  sa.program_intake_id as "programIntakeId",
  sa.status,
  sa.school_revision as "schoolRevision",
  sa.status_changed_at as "statusChangedAt",
  sa.submitted_at as "submittedAt",
  sa.first_viewed_at as "firstViewedAt",
  sa.school_visible_profile_json as "schoolVisibleProfileJson",
  sa.routing_metadata_json as "routingMetadataJson"
from school_applications sa`;

const schoolApplicationStatusEventSelectSql = `
select
  id,
  school_application_id as "schoolApplicationId",
  actor_user_id as "actorUserId",
  from_status as "fromStatus",
  to_status as "toStatus",
  reason,
  application_revision as "applicationRevision",
  created_at as "createdAt"
from school_application_status_events`;

const schoolApplicationContactLogSelectSql = `
select
  c.id,
  c.school_application_id as "schoolApplicationId",
  c.actor_user_id as "actorUserId",
  c.channel,
  c.direction,
  c.outcome,
  c.note,
  c.created_at as "createdAt"
from school_application_contact_logs c`;
