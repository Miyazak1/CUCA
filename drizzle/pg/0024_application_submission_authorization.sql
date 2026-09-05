CREATE TABLE "application_submission_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_set_id" uuid NOT NULL,
	"application_choice_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"target_key" text GENERATED ALWAYS AS ("program_id"::text || '/' || "program_intake_id"::text) STORED NOT NULL,
	"purpose" text DEFAULT 'application_submission' NOT NULL,
	"material_selection_revision" integer NOT NULL,
	"source_set_revision" integer NOT NULL,
	"source_applicant_revision" integer NOT NULL,
	"source_education_revision" integer NOT NULL,
	"source_assessment_revision" integer NOT NULL,
	"selection_json" jsonb NOT NULL,
	"selection_sha256" text NOT NULL,
	"material_content_sha256" text NOT NULL,
	"notice_scope_key" text NOT NULL,
	"notice_locale" text NOT NULL,
	"notice_version_id" uuid NOT NULL,
	"notice_publication_revision" integer NOT NULL,
	"notice_content_sha256" text NOT NULL,
	"confirmation_method" text DEFAULT 'authenticated_explicit_action' NOT NULL,
	"scope_sha256" text NOT NULL,
	"confirmed_request_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_submission_authorization_version_check" CHECK ("application_submission_authorizations"."material_selection_revision" > 0 and "application_submission_authorizations"."source_set_revision" > 0
    and "application_submission_authorizations"."source_applicant_revision" >= 0 and "application_submission_authorizations"."source_education_revision" >= 0 and "application_submission_authorizations"."source_assessment_revision" >= 0
    and "application_submission_authorizations"."notice_publication_revision" > 0),
	CONSTRAINT "application_submission_authorization_selection_check" CHECK (jsonb_typeof("application_submission_authorizations"."selection_json") = 'object'
    and octet_length("application_submission_authorizations"."selection_json"::text) <= 8192 and "application_submission_authorizations"."selection_json" ?& array['applicantFields','educationRecordIds','assessmentRecordIds']
    and "application_submission_authorizations"."selection_json" - array['applicantFields','educationRecordIds','assessmentRecordIds'] = '{}'::jsonb
    and case when jsonb_typeof("application_submission_authorizations"."selection_json"->'applicantFields') = 'array'
      and jsonb_typeof("application_submission_authorizations"."selection_json"->'educationRecordIds') = 'array'
      and jsonb_typeof("application_submission_authorizations"."selection_json"->'assessmentRecordIds') = 'array'
      then jsonb_array_length("application_submission_authorizations"."selection_json"->'applicantFields') <= 3
        and ("application_submission_authorizations"."selection_json"->'applicantFields') <@ '["fullName","contactEmail","citizenshipCountry"]'::jsonb
        and jsonb_array_length("application_submission_authorizations"."selection_json"->'educationRecordIds') <= 20
        and jsonb_array_length("application_submission_authorizations"."selection_json"->'assessmentRecordIds') <= 40 else false end),
	CONSTRAINT "application_submission_authorization_digest_check" CHECK ("application_submission_authorizations"."selection_sha256" ~ '^[a-f0-9]{64}$'
    and "application_submission_authorizations"."material_content_sha256" ~ '^[a-f0-9]{64}$' and "application_submission_authorizations"."notice_content_sha256" ~ '^[a-f0-9]{64}$'
    and "application_submission_authorizations"."scope_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "application_submission_authorization_notice_check" CHECK ("application_submission_authorizations"."notice_locale" in ('en','zh-CN')
    and "application_submission_authorizations"."notice_scope_key" = 'application_disclosure:' || "application_submission_authorizations"."notice_locale"),
	CONSTRAINT "application_submission_authorization_confirmation_check" CHECK ("application_submission_authorizations"."purpose" = 'application_submission'
    and "application_submission_authorizations"."confirmation_method" = 'authenticated_explicit_action' and char_length("application_submission_authorizations"."confirmed_request_id") between 1 and 128),
	CONSTRAINT "application_submission_authorization_lifecycle_check" CHECK (("application_submission_authorizations"."status" = 'active' and "application_submission_authorizations"."ended_at" is null and "application_submission_authorizations"."end_reason" is null)
    or ("application_submission_authorizations"."status" = 'withdrawn' and "application_submission_authorizations"."ended_at" is not null and "application_submission_authorizations"."confirmed_at" <= "application_submission_authorizations"."ended_at"
      and "application_submission_authorizations"."end_reason" in ('student_withdrawal','choice_removed'))
    or ("application_submission_authorizations"."status" = 'superseded' and "application_submission_authorizations"."ended_at" is not null and "application_submission_authorizations"."confirmed_at" <= "application_submission_authorizations"."ended_at"
      and "application_submission_authorizations"."end_reason" = 'reauthorized'))
);
--> statement-breakpoint
ALTER TABLE "student_application_command_receipts" DROP CONSTRAINT "student_application_commands_operation_check";--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorizations_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorizations_application_choice_id_application_choices_id_fk" FOREIGN KEY ("application_choice_id") REFERENCES "public"."application_choices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorizations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorizations_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorizations_program_intake_id_program_intakes_id_fk" FOREIGN KEY ("program_intake_id") REFERENCES "public"."program_intakes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_choice_scope_fk" FOREIGN KEY ("application_choice_id","application_set_id","user_id","school_id") REFERENCES "public"."application_choices"("id","application_set_id","user_id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_choice_target_fk" FOREIGN KEY ("application_choice_id","target_key") REFERENCES "public"."application_choices"("id","target_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_program_school_fk" FOREIGN KEY ("program_id","school_id") REFERENCES "public"."programs"("id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_notice_version_fk" FOREIGN KEY ("notice_version_id","notice_scope_key") REFERENCES "public"."privacy_notice_versions"("id","scope_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_submission_authorization_active_choice_unique" ON "application_submission_authorizations" USING btree ("application_choice_id") WHERE "application_submission_authorizations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "application_submission_authorization_user_choice_idx" ON "application_submission_authorizations" USING btree ("user_id","application_choice_id","confirmed_at");--> statement-breakpoint
ALTER TABLE "student_application_command_receipts" ADD CONSTRAINT "student_application_commands_operation_check" CHECK ("student_application_command_receipts"."operation" in ('application_set.create', 'application_choice.add', 'application_authorization.record'));