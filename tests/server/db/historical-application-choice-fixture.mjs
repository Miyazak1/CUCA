import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applicationCommandDigests } from "../../../src/server/student/application-commands.ts";
import { parseApplicationChoice } from "../../../src/server/student/input.ts";

// Historical migration fixtures cannot use the current repository before its columns exist.
export async function insertHistoricalApplicationChoice(pool, context, value, idempotencyKey = randomUUID()) {
  const input = parseApplicationChoice(value);
  assert.equal(input.admissionRouteKey, undefined, "Historical choices cannot predate the route column with a selected route.");
  assert.ok(context.actorUserId);
  const digest = applicationCommandDigests("application_choice.add", input, idempotencyKey);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const applicationSet = (await client.query(`select id, revision from application_sets
      where id = $1 and user_id = $2 and status = 'draft' and locked_at is null and submitted_at is null
      for update`, [input.applicationSetId, context.actorUserId])).rows[0];
    assert.ok(applicationSet, "Historical application set must remain an editable owner-scoped draft.");
    const choice = (await client.query(`insert into application_choices (
        application_set_id,user_id,school_id,program_id,scholarship_id,rank_order,student_notes,program_intake_id
      ) values ($1,$2,$3,$4,$5,$6,$7,$8)
      returning id,application_set_id as "applicationSetId",user_id as "userId",school_id as "schoolId",
        program_id as "programId",program_intake_id as "programIntakeId",scholarship_id as "scholarshipId",
        rank_order as "rankOrder",status,student_notes as "studentNotes"`, [
      input.applicationSetId, context.actorUserId, input.schoolId, input.programId ?? null,
      input.scholarshipId ?? null, input.rankOrder ?? 0, input.studentNotes ?? null, input.programIntakeId ?? null,
    ])).rows[0];
    await client.query("update application_sets set revision = revision + 1, updated_at = clock_timestamp() where id = $1", [input.applicationSetId]);
    await client.query(`insert into student_application_command_receipts
      (user_id,operation,key_hash,request_hash,resource_id,original_request_id,completed_at)
      values ($1,'application_choice.add',$2,$3,$4,$5,clock_timestamp())`, [
      context.actorUserId, digest.keyHash, digest.requestHash, choice.id, context.requestId,
    ]);
    await client.query(`insert into audit_logs (
        request_id,actor_user_id,actor_type,active_role,tenant_school_id,action,resource_type,resource_id,
        allowed,policy_decision_id,data_classes,redaction_applied,metadata_json,ip_hash,user_agent_hash
      ) values ($1,$2,'user',$3,null,'student.application_choice.add','application_choice',$4,
        true,$5,'["education_record"]'::jsonb,true,$6::jsonb,null,null)`, [
      context.requestId, context.actorUserId, context.activeRole, choice.id, context.policyDecisionId,
      JSON.stringify({
        applicationSetId: choice.applicationSetId,
        schoolId: choice.schoolId,
        programId: choice.programId,
        programIntakeId: choice.programIntakeId,
        scholarshipId: choice.scholarshipId,
        hasStudentNotes: Boolean(choice.studentNotes),
      }),
    ]);
    await client.query("commit");
    return { ...choice, admissionRouteKey: null };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
