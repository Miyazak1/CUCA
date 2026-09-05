// These objects exist only in the validated disposable rehearsal database.
export async function createAuditFailureFixture(pool) {
  await pool.query("create table rehearsal_audit_faults (action text primary key)");
  await pool.query(`create function rehearsal_reject_audit() returns trigger language plpgsql as $$
    begin
      if exists (select 1 from rehearsal_audit_faults where action = new.action) then
        raise exception 'Synthetic audit storage failure' using errcode = 'P0001';
      end if;
      return new;
    end $$`);
  await pool.query("create trigger rehearsal_reject_audit before insert on audit_logs for each row execute function rehearsal_reject_audit()");
  return {
    async during(action, work) {
      await pool.query("insert into rehearsal_audit_faults (action) values ($1)", [action]);
      try { return await work(); }
      finally { await pool.query("delete from rehearsal_audit_faults where action = $1", [action]); }
    },
    async close() {
      await pool.query("drop trigger rehearsal_reject_audit on audit_logs");
      await pool.query("drop function rehearsal_reject_audit()");
      await pool.query("drop table rehearsal_audit_faults");
    },
  };
}

export async function snapshotAuditedBusinessTables(pool) {
  const snapshot = {};
  for (const table of ["users", "auth_identities", "user_roles", "auth_sessions", "student_profiles", "student_applicant_profiles", "student_education_histories", "student_education_records", "student_assessment_histories", "student_assessment_records", "saved_items", "application_sets", "application_choices", "application_material_selections", "application_submission_authorizations", "application_material_snapshots", "application_submissions", "application_choice_status_events", "student_application_command_receipts", "school_applications", "school_application_status_events", "official_submission_groups", "official_submission_group_members", "official_submission_outbox", "invoices", "invoice_lines", "payments", "payment_status_events", "application_fee_entitlements", "email_verification_challenges", "password_reset_challenges", "auth_email_outbox", "notification_preferences", "notification_templates", "notification_events", "notification_deliveries", "school_staff_invites", "school_staff_memberships", "sign_in_continuations", "agent_context_candidates", "agent_memory_entries", "agent_student_memory_settings", "program_requirement_versions", "program_requirement_publications", "privacy_notice_scopes", "privacy_notice_versions", "privacy_notice_publications", "official_submission_policy_versions", "official_submission_policy_version_targets", "official_submission_policy_publications", "audit_logs"]) {
    const key = table === "application_material_selections" ? "choice_id" : table === "program_requirement_publications" ? "program_intake_id"
      : ["privacy_notice_scopes", "privacy_notice_publications"].includes(table) ? "scope_key"
        : table === "official_submission_policy_version_targets" ? "policy_version_id,program_intake_id"
          : table === "official_submission_group_members" ? "group_id,member_position"
          : table === "official_submission_policy_publications" ? "program_intake_id,admission_route_key"
            : ["agent_student_memory_settings", "student_education_histories", "student_assessment_histories"].includes(table) ? "user_id" : "id";
    snapshot[table] = (await pool.query(`select coalesce(jsonb_agg(to_jsonb(t) order by ${key}), '[]'::jsonb) as data from ${table} t`)).rows[0].data;
  }
  return snapshot;
}
