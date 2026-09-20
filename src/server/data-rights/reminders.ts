import { randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../notifications/postgres-repository.ts";
import { materializeDataRightsReminder, type DataRightsReminderCode } from "../notifications/templates.ts";
import { serviceUnavailable } from "../shared/errors.ts";

type ReminderRole = "student" | "cuac_ops" | "cuac_admin";
type ReminderCandidate = {
  requestId:string;
  sourceRequestRevision:number;
  reviewId:string|null;
  reminderCode:DataRightsReminderCode;
  targetAt:Date;
  deadlineBasisAt:Date|null;
  recipientUserId:string;
  recipientRole:ReminderRole;
  locale:"en"|"zh-CN";
  observedAt:Date;
};

export type DataRightsReminderResult = { status:"idle" } | {
  status:"materialized";
  reminderCode:DataRightsReminderCode;
  notificationCreated:boolean;
};

export class PostgresDataRightsReminderScheduler {
  private readonly client:TransactionalSqlClient;
  constructor(client:TransactionalSqlClient){this.client=client;}

  async processOne():Promise<DataRightsReminderResult>{
    return this.client.transaction(async tx=>{
      const rows=await tx.query<ReminderCandidate>(`with candidates as (
        select q.id as "requestId",q.revision as "sourceRequestRevision",null::uuid as "reviewId",
          'identity_24h'::text as "reminderCode",date_trunc('milliseconds',q.received_at+interval '24 hours') as "targetAt",
          null::timestamptz as "deadlineBasisAt",q.user_id as "recipientUserId",'student'::text as "recipientRole",
          case when q.preferred_locale='zh-CN' then 'zh-CN' else 'en' end as locale
        from data_rights_requests q join users u on u.id=q.user_id and u.account_status='active'
        where q.status='received' and q.identity_confirmed_at is null
          and exists (select 1 from user_roles ur where ur.user_id=q.user_id and ur.role='student' and ur.revoked_at is null)
        union all
        select q.id,q.revision,null::uuid,'identity_day5',date_trunc('milliseconds',q.received_at+interval '5 days'),null::timestamptz,
          q.user_id,'student',case when q.preferred_locale='zh-CN' then 'zh-CN' else 'en' end
        from data_rights_requests q join users u on u.id=q.user_id and u.account_status='active'
        where q.status='received' and q.identity_confirmed_at is null
          and exists (select 1 from user_roles ur where ur.user_id=q.user_id and ur.role='student' and ur.revoked_at is null)
        union all
        select q.id,q.revision,r.id,'internal_day12',date_trunc('milliseconds',q.internal_target_at-interval '3 days'),
          date_trunc('milliseconds',q.internal_target_at),
          r.assigned_user_id,r.assigned_role,case when u.locale='zh-CN' then 'zh-CN' else 'en' end
        from data_rights_requests q join ops_data_rights_reviews r on r.data_rights_request_id=q.id
          join users u on u.id=r.assigned_user_id and u.account_status='active'
        where q.status in ('in_progress','escalated') and r.status in ('investigating','escalated')
          and exists (select 1 from user_roles ur where ur.user_id=r.assigned_user_id and ur.role=r.assigned_role and ur.revoked_at is null)
          and exists (select 1 from cuac_staff_access_grants g where g.user_id=r.assigned_user_id and g.requested_role=r.assigned_role
            and g.status='approved' and g.approved_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp())
        union all
        select q.id,q.revision,r.id,'response_due_soon',date_trunc('milliseconds',coalesce(q.extended_due_at,q.response_due_at)-interval '6 days'),
          date_trunc('milliseconds',coalesce(q.extended_due_at,q.response_due_at)),r.assigned_user_id,r.assigned_role,
          case when u.locale='zh-CN' then 'zh-CN' else 'en' end
        from data_rights_requests q join ops_data_rights_reviews r on r.data_rights_request_id=q.id
          join users u on u.id=r.assigned_user_id and u.account_status='active'
        where q.status in ('in_progress','escalated') and r.status in ('investigating','escalated')
          and exists (select 1 from user_roles ur where ur.user_id=r.assigned_user_id and ur.role=r.assigned_role and ur.revoked_at is null)
          and exists (select 1 from cuac_staff_access_grants g where g.user_id=r.assigned_user_id and g.requested_role=r.assigned_role
            and g.status='approved' and g.approved_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp())
        union all
        select q.id,q.revision,r.id,'response_due_today',date_trunc('milliseconds',coalesce(q.extended_due_at,q.response_due_at)),
          date_trunc('milliseconds',coalesce(q.extended_due_at,q.response_due_at)),r.assigned_user_id,r.assigned_role,
          case when u.locale='zh-CN' then 'zh-CN' else 'en' end
        from data_rights_requests q join ops_data_rights_reviews r on r.data_rights_request_id=q.id
          join users u on u.id=r.assigned_user_id and u.account_status='active'
        where q.status in ('in_progress','escalated') and r.status in ('investigating','escalated')
          and exists (select 1 from user_roles ur where ur.user_id=r.assigned_user_id and ur.role=r.assigned_role and ur.revoked_at is null)
          and exists (select 1 from cuac_staff_access_grants g where g.user_id=r.assigned_user_id and g.requested_role=r.assigned_role
            and g.status='approved' and g.approved_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp())
      ), picked as (
        select c.* from candidates c where c."targetAt"<=clock_timestamp()
          and not exists (select 1 from data_rights_reminders m where m.data_rights_request_id=c."requestId"
            and m.reminder_code=c."reminderCode" and m.target_at=c."targetAt")
        order by c."targetAt",c."requestId",c."reminderCode" limit 1
      )
      select p.*,date_trunc('milliseconds',clock_timestamp()) as "observedAt" from picked p
        join data_rights_requests q on q.id=p."requestId" and q.revision=p."sourceRequestRevision"
      for update of q skip locked`,[]);
      const candidate=rows[0];
      if(!candidate)return{status:"idle"};
      if(!candidate.recipientUserId||!["student","cuac_ops","cuac_admin"].includes(candidate.recipientRole)
        ||!(candidate.targetAt instanceof Date)||!(candidate.observedAt instanceof Date))
        throw serviceUnavailable("Stored data-rights reminder candidate is invalid.");
      const event=materializeDataRightsReminder({recipientUserId:candidate.recipientUserId,requestId:candidate.requestId,
        reminderCode:candidate.reminderCode,audienceRole:candidate.recipientRole,locale:candidate.locale,
        targetAt:candidate.targetAt,deadlineAt:candidate.deadlineBasisAt,occurredAt:candidate.observedAt});
      const published=await new PostgresNotificationPublisher(tx).publish(event);
      const inserted=await tx.query<{id:string}>(`insert into data_rights_reminders
        (id,data_rights_request_id,review_id,reminder_code,target_at,deadline_basis_at,source_request_revision,
         recipient_user_id,recipient_role,locale,event_key_sha256,emitted_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict do nothing returning id`,
      [randomUUID(),candidate.requestId,candidate.reviewId,candidate.reminderCode,candidate.targetAt,candidate.deadlineBasisAt,
        candidate.sourceRequestRevision,candidate.recipientUserId,candidate.recipientRole,candidate.locale,event.eventKeySha256,
        candidate.observedAt]);
      if(!inserted[0])throw serviceUnavailable("Data-rights reminder ledger changed during materialization.");
      return{status:"materialized",reminderCode:candidate.reminderCode,notificationCreated:published.created};
    });
  }

  async processBatch(limit:number):Promise<{processed:number;created:number}>{
    if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw serviceUnavailable("Data-rights reminder batch limit is invalid.");
    let processed=0,created=0;
    while(processed<limit){
      const result=await this.processOne();
      if(result.status==="idle")break;
      processed+=1;if(result.notificationCreated)created+=1;
    }
    return{processed,created};
  }
}
