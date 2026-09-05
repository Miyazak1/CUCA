CREATE TABLE "application_material_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_set_id" uuid NOT NULL,
	"application_choice_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"target_key" text GENERATED ALWAYS AS ("program_id"::text || '/' || "program_intake_id"::text) STORED NOT NULL,
	"authorization_id" uuid NOT NULL,
	"authorization_scope_sha256" text NOT NULL,
	"material_selection_revision" integer NOT NULL,
	"source_set_revision" integer NOT NULL,
	"source_applicant_revision" integer NOT NULL,
	"source_education_revision" integer NOT NULL,
	"source_assessment_revision" integer NOT NULL,
	"selection_sha256" text NOT NULL,
	"material_content_sha256" text NOT NULL,
	"payload_sha256" text NOT NULL,
	"payload_bytes" integer NOT NULL,
	"payload_format" text DEFAULT 'cuac.application-material-snapshot.v1' NOT NULL,
	"encryption_scheme" text DEFAULT 'aes-256-gcm-v1' NOT NULL,
	"encryption_key_id" text NOT NULL,
	"envelope_json" jsonb NOT NULL,
	"captured_request_id" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_material_snapshot_version_check" CHECK ("application_material_snapshots"."material_selection_revision" > 0
    and "application_material_snapshots"."source_set_revision" > 0 and "application_material_snapshots"."source_applicant_revision" >= 0
    and "application_material_snapshots"."source_education_revision" >= 0 and "application_material_snapshots"."source_assessment_revision" >= 0),
	CONSTRAINT "application_material_snapshot_digest_check" CHECK ("application_material_snapshots"."authorization_scope_sha256" ~ '^[a-f0-9]{64}$'
    and "application_material_snapshots"."selection_sha256" ~ '^[a-f0-9]{64}$' and "application_material_snapshots"."material_content_sha256" ~ '^[a-f0-9]{64}$'
    and "application_material_snapshots"."payload_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "application_material_snapshot_format_check" CHECK ("application_material_snapshots"."payload_format" = 'cuac.application-material-snapshot.v1'
    and "application_material_snapshots"."encryption_scheme" = 'aes-256-gcm-v1' and "application_material_snapshots"."encryption_key_id" ~ '^[A-Za-z0-9_-]{1,64}$'
    and "application_material_snapshots"."payload_bytes" between 1 and 409600 and char_length("application_material_snapshots"."captured_request_id") between 1 and 128),
	CONSTRAINT "application_material_snapshot_envelope_check" CHECK (jsonb_typeof("application_material_snapshots"."envelope_json") = 'object'
    and "application_material_snapshots"."envelope_json" ?& array['version','keyId','nonce','ciphertext','tag']
    and "application_material_snapshots"."envelope_json" - array['version','keyId','nonce','ciphertext','tag'] = '{}'::jsonb
    and "application_material_snapshots"."envelope_json"->'version' = '1'::jsonb
    and jsonb_typeof("application_material_snapshots"."envelope_json"->'keyId') = 'string' and "application_material_snapshots"."envelope_json"->>'keyId' = "application_material_snapshots"."encryption_key_id"
    and ("application_material_snapshots"."envelope_json"->>'keyId') ~ '^[A-Za-z0-9_-]{1,64}$'
    and jsonb_typeof("application_material_snapshots"."envelope_json"->'nonce') = 'string' and ("application_material_snapshots"."envelope_json"->>'nonce') ~ '^[A-Za-z0-9_-]{16}$'
    and jsonb_typeof("application_material_snapshots"."envelope_json"->'tag') = 'string' and ("application_material_snapshots"."envelope_json"->>'tag') ~ '^[A-Za-z0-9_-]{22}$'
    and jsonb_typeof("application_material_snapshots"."envelope_json"->'ciphertext') = 'string'
    and char_length("application_material_snapshots"."envelope_json"->>'ciphertext') between 2 and 546136
    and ("application_material_snapshots"."envelope_json"->>'ciphertext') ~ '^[A-Za-z0-9_-]+$')
);
--> statement-breakpoint
ALTER TABLE "student_application_command_receipts" DROP CONSTRAINT "student_application_commands_operation_check";--> statement-breakpoint
CREATE UNIQUE INDEX "application_submission_authorization_scope_unique" ON "application_submission_authorizations" USING btree ("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id");--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshots_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshots_application_choice_id_application_choices_id_fk" FOREIGN KEY ("application_choice_id") REFERENCES "public"."application_choices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshots_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshots_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshots_program_intake_id_program_intakes_id_fk" FOREIGN KEY ("program_intake_id") REFERENCES "public"."program_intakes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshot_choice_scope_fk" FOREIGN KEY ("application_choice_id","application_set_id","user_id","school_id") REFERENCES "public"."application_choices"("id","application_set_id","user_id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshot_choice_target_fk" FOREIGN KEY ("application_choice_id","target_key") REFERENCES "public"."application_choices"("id","target_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshot_authorization_scope_fk" FOREIGN KEY ("authorization_id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id") REFERENCES "public"."application_submission_authorizations"("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshot_program_school_fk" FOREIGN KEY ("program_id","school_id") REFERENCES "public"."programs"("id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_snapshots" ADD CONSTRAINT "application_material_snapshot_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_material_snapshot_authorization_unique" ON "application_material_snapshots" USING btree ("authorization_id");--> statement-breakpoint
CREATE INDEX "application_material_snapshot_user_choice_idx" ON "application_material_snapshots" USING btree ("user_id","application_choice_id","captured_at");--> statement-breakpoint
ALTER TABLE "student_application_command_receipts" ADD CONSTRAINT "student_application_commands_operation_check" CHECK ("student_application_command_receipts"."operation" in ('application_set.create', 'application_choice.add', 'application_authorization.record', 'application_material_snapshot.create'));
