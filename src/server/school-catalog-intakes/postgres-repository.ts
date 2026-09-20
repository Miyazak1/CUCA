import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type {
  SaveSchoolIntakeDraft,
  SchoolCatalogIntakeRepository,
  SchoolProgramIntakeVersion,
} from "./service.ts";

type IntakeRow = SchoolProgramIntakeVersion;

const intakeSelect = `select v.id, v.school_id as "schoolId", v.program_id as "programId",
  p.name_en as "programNameEn", p.name_zh as "programNameZh", v.intake_term as "intakeTerm",
  v.intake_year as "intakeYear", v.version, v.open_date as "openDate", v.deadline_date as "deadlineDate",
  v.deadline_label as "deadlineLabel", v.application_round as "applicationRound", v.evidence_type as "evidenceType", v.source_url as "sourceUrl",
  v.source_label as "sourceLabel", v.change_note as "changeNote", v.status,
  pub.revision as "publicationRevision", pub.status as "publicationStatus",
  v.created_by_user_id as "createdByUserId", v.created_at as "createdAt", v.updated_at as "updatedAt"
from school_program_intake_versions v
join programs p on p.id = v.program_id and p.school_id = v.school_id
left join school_program_intake_publications pub on pub.school_id = v.school_id and pub.program_id = v.program_id
  and pub.intake_term = v.intake_term and pub.intake_year = v.intake_year and pub.version_id = v.id`;

export class PostgresSchoolCatalogIntakeRepository implements SchoolCatalogIntakeRepository {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  async list(input: { actorUserId: string; schoolId: string }) {
    const programs = await this.client.query<{ id: string; nameEn: string; nameZh: string | null; degreeLevel: string }>(`select
      p.id,p.name_en as "nameEn",p.name_zh as "nameZh",p.degree_level as "degreeLevel" from programs p
      where p.school_id=$1 and p.status='active' and exists (
        select 1 from school_staff_memberships m join users u on u.id=m.user_id and u.account_status='active'
        join user_roles r on r.user_id=u.id and r.role='school_staff' and r.revoked_at is null
        where m.user_id=$2 and m.school_id=$1 and m.status='active'
          and m.role in ('admissions','counselor','viewer','school_admin'))
      order by p.name_en,p.id`, [input.schoolId, input.actorUserId]);
    const items = await this.client.query<IntakeRow>(`${intakeSelect}
      where v.school_id = $1 and exists (
        select 1 from school_staff_memberships m join users u on u.id = m.user_id and u.account_status = 'active'
        join user_roles r on r.user_id = u.id and r.role = 'school_staff' and r.revoked_at is null
        where m.user_id = $2 and m.school_id = $1 and m.status = 'active'
          and m.role in ('admissions','counselor','viewer','school_admin')
      ) order by v.intake_year desc, v.intake_term, p.name_en, v.version desc`, [input.schoolId, input.actorUserId]);
    return { programs, items };
  }

  async saveDraft(input: { actorUserId: string; schoolId: string } & SaveSchoolIntakeDraft) {
    const scope = await this.client.query<{ id: string }>(`select p.id from programs p
      join school_staff_memberships m on m.school_id = p.school_id and m.user_id = $3 and m.status = 'active'
        and m.role in ('admissions','school_admin')
      join users u on u.id = m.user_id and u.account_status = 'active'
      join user_roles r on r.user_id = u.id and r.role = 'school_staff' and r.revoked_at is null
      where p.id = $1 and p.school_id = $2 and p.status = 'active'
        and $4::int >= extract(year from clock_timestamp() at time zone 'UTC')::int
      for update of p`, [input.programId, input.schoolId, input.actorUserId, input.intakeYear]);
    if (!scope.length) return null;
    const existing = await this.client.query<{ id: string }>(`select id from school_program_intake_versions
      where program_id = $1 and intake_term = $2 and intake_year = $3 and status = 'draft' for update`,
    [input.programId, input.intakeTerm, input.intakeYear]);
    let id: string | undefined = existing[0]?.id;
    if (id) {
      const rows = await this.client.query<{ id: string }>(`update school_program_intake_versions set
        open_date=$2, deadline_date=$3, deadline_label=$4, application_round=$5, evidence_type=$6, source_url=$7,
        source_label=$8, change_note=$9, updated_at=clock_timestamp()
        where id=$1 and school_id=$10 and program_id=$11 and status='draft' returning id`,
      [id, input.openDate, input.deadlineDate, input.deadlineLabel, input.applicationRound, input.evidenceType,
        input.sourceUrl, input.sourceLabel, input.changeNote, input.schoolId, input.programId]);
      id = rows[0]?.id;
    } else {
      const rows = await this.client.query<{ id: string }>(`insert into school_program_intake_versions
        (school_id,program_id,intake_term,intake_year,version,open_date,deadline_date,deadline_label,
          application_round,evidence_type,source_url,source_label,change_note,status,created_by_user_id)
        select $1,$2,$3,$4,coalesce(max(version),0)+1,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13
        from school_program_intake_versions where program_id=$2 and intake_term=$3 and intake_year=$4
        returning id`, [input.schoolId, input.programId, input.intakeTerm, input.intakeYear, input.openDate,
        input.deadlineDate, input.deadlineLabel, input.applicationRound, input.evidenceType, input.sourceUrl, input.sourceLabel,
        input.changeNote, input.actorUserId]);
      id = rows[0]?.id;
    }
    return id ? this.get(input.schoolId, id) : null;
  }

  async publish(input: { actorUserId: string; schoolId: string; versionId: string }) {
    const rows = await this.client.query<{
      id: string; programId: string; intakeTerm: string; intakeYear: number;
      openDate: Date | null; deadlineDate: Date; deadlineLabel: string | null; applicationRound: string | null;
    }>(`select v.id, v.program_id as "programId", v.intake_term as "intakeTerm", v.intake_year as "intakeYear",
        v.open_date as "openDate", v.deadline_date as "deadlineDate", v.deadline_label as "deadlineLabel",
        v.application_round as "applicationRound"
      from school_program_intake_versions v join programs p on p.id=v.program_id and p.school_id=v.school_id and p.status='active'
      join school_staff_memberships m on m.school_id=v.school_id and m.user_id=$3 and m.status='active'
        and m.role in ('admissions','school_admin')
      join users u on u.id=m.user_id and u.account_status='active'
      join user_roles r on r.user_id=u.id and r.role='school_staff' and r.revoked_at is null
      where v.id=$1 and v.school_id=$2 and v.status='draft' and v.deadline_date > clock_timestamp()
        and v.intake_year >= extract(year from clock_timestamp() at time zone 'UTC')::int
      for update of v,p`, [input.versionId, input.schoolId, input.actorUserId]);
    const version = rows[0];
    if (!version) return null;
    await this.client.query(`insert into program_intakes
      (program_id,intake_term,intake_year,open_date,deadline_date,deadline_label,application_round,status)
      values ($1,$2,$3,$4,$5,$6,$7,'open')
      on conflict (program_id,intake_term,intake_year) do update set open_date=excluded.open_date,
        deadline_date=excluded.deadline_date,deadline_label=excluded.deadline_label,
        application_round=excluded.application_round,status='open',updated_at=clock_timestamp()`,
    [version.programId, version.intakeTerm, version.intakeYear, version.openDate, version.deadlineDate,
      version.deadlineLabel, version.applicationRound]);
    await this.client.query(`update school_program_intake_versions v set status='superseded',updated_at=clock_timestamp()
      from school_program_intake_publications pub where pub.program_id=v.program_id and pub.intake_term=v.intake_term
        and pub.intake_year=v.intake_year and pub.version_id=v.id and pub.status='active' and v.id<>$1`, [version.id]);
    await this.client.query(`update school_program_intake_versions set status='published',updated_at=clock_timestamp()
      where id=$1 and school_id=$2 and status='draft'`, [version.id, input.schoolId]);
    await this.client.query(`insert into school_program_intake_publications
      (school_id,program_id,intake_term,intake_year,version_id,revision,status,published_by_user_id,published_at)
      values ($1,$2,$3,$4,$5,1,'active',$6,clock_timestamp())
      on conflict (program_id,intake_term,intake_year) do update set school_id=excluded.school_id,
        version_id=excluded.version_id,revision=school_program_intake_publications.revision+1,status='active',
        published_by_user_id=excluded.published_by_user_id,published_at=clock_timestamp(),
        withdrawn_by_user_id=null,withdrawn_at=null,updated_at=clock_timestamp()`,
    [input.schoolId, version.programId, version.intakeTerm, version.intakeYear, version.id, input.actorUserId]);
    return this.get(input.schoolId, version.id);
  }

  async withdraw(input: { actorUserId: string; schoolId: string; versionId: string }) {
    const rows = await this.client.query<{ programId: string; intakeTerm: string; intakeYear: number }>(`select
        pub.program_id as "programId",pub.intake_term as "intakeTerm",pub.intake_year as "intakeYear"
      from school_program_intake_publications pub
      join school_staff_memberships m on m.school_id=pub.school_id and m.user_id=$3 and m.status='active'
        and m.role in ('admissions','school_admin')
      join users u on u.id=m.user_id and u.account_status='active'
      join user_roles r on r.user_id=u.id and r.role='school_staff' and r.revoked_at is null
      where pub.version_id=$1 and pub.school_id=$2 and pub.status='active' for update of pub`,
    [input.versionId, input.schoolId, input.actorUserId]);
    const scope = rows[0];
    if (!scope) return null;
    await this.client.query(`update program_intakes set status='closed',updated_at=clock_timestamp()
      where program_id=$1 and intake_term=$2 and intake_year=$3`, [scope.programId, scope.intakeTerm, scope.intakeYear]);
    await this.client.query(`update school_program_intake_publications set status='withdrawn',revision=revision+1,
      withdrawn_by_user_id=$2,withdrawn_at=clock_timestamp(),updated_at=clock_timestamp()
      where version_id=$1 and school_id=$3 and status='active'`, [input.versionId, input.actorUserId, input.schoolId]);
    await this.client.query(`update school_program_intake_versions set status='withdrawn',updated_at=clock_timestamp()
      where id=$1 and school_id=$2 and status='published'`, [input.versionId, input.schoolId]);
    return this.get(input.schoolId, input.versionId);
  }

  private async get(schoolId: string, id: string) {
    const rows = await this.client.query<IntakeRow>(`${intakeSelect} where v.school_id=$1 and v.id=$2 limit 1`, [schoolId, id]);
    return rows[0] ?? null;
  }
}
