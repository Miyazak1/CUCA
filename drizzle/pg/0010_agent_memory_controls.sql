CREATE TABLE "agent_student_memory_settings" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "reset_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_context_candidates" ADD COLUMN "payload_cleared_at" timestamptz;
--> statement-breakpoint
CREATE INDEX "agent_context_candidates_cleanup_idx" ON "agent_context_candidates" ("status", "expires_at", "id") WHERE "payload_cleared_at" IS NULL;
