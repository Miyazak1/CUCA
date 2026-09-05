CREATE TABLE "student_application_command_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "operation" text NOT NULL,
  "key_hash" text NOT NULL,
  "request_hash" text NOT NULL,
  "resource_id" uuid,
  "original_request_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "student_application_commands_operation_check" CHECK ("operation" IN ('application_set.create', 'application_choice.add')),
  CONSTRAINT "student_application_commands_hash_check" CHECK ("key_hash" ~ '^[a-f0-9]{64}$' AND "request_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "student_application_commands_completion_check" CHECK (("resource_id" IS NULL) = ("completed_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "student_application_commands_scope_unique" ON "student_application_command_receipts" ("user_id", "operation", "key_hash");
