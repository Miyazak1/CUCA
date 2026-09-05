LOCK TABLE "agent_memory_entries" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "agent_memory_entries"
    WHERE "cleared_at" IS NULL AND "context_scope" = 'student_account' AND "active_role" = 'student'
      AND "tenant_school_id" IS NULL AND "data_class" = 'low_sensitive_preference'
      AND NOT isfinite("created_at")
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Active student Agent memories require reviewed finite creation timestamps.';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "agent_memory_entries"
SET "expires_at" = CASE
  WHEN "expires_at" IS NULL OR NOT isfinite("expires_at") THEN "created_at" + interval '365 days'
  ELSE least("expires_at", "created_at" + interval '365 days')
END
WHERE "cleared_at" IS NULL AND "context_scope" = 'student_account' AND "active_role" = 'student'
  AND "tenant_school_id" IS NULL AND "data_class" = 'low_sensitive_preference';
--> statement-breakpoint
CREATE INDEX "agent_memory_entries_student_expiry_cleanup_idx" ON "agent_memory_entries" USING btree ("expires_at","id") WHERE "agent_memory_entries"."cleared_at" is null
      and "agent_memory_entries"."context_scope" = 'student_account' and "agent_memory_entries"."active_role" = 'student'
      and "agent_memory_entries"."tenant_school_id" is null and "agent_memory_entries"."data_class" = 'low_sensitive_preference';--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_student_retention_check" CHECK (not (
      "agent_memory_entries"."cleared_at" is null and "agent_memory_entries"."context_scope" = 'student_account' and "agent_memory_entries"."active_role" = 'student'
      and "agent_memory_entries"."tenant_school_id" is null and "agent_memory_entries"."data_class" = 'low_sensitive_preference'
    ) or ("agent_memory_entries"."expires_at" is not null and isfinite("agent_memory_entries"."created_at") and isfinite("agent_memory_entries"."expires_at")
      and "agent_memory_entries"."expires_at" <= "agent_memory_entries"."created_at" + interval '365 days'));
