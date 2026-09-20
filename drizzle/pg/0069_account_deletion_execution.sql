CREATE UNIQUE INDEX "ops_data_rights_outcomes_id_request_unique" ON "ops_data_rights_outcomes" USING btree ("id","data_rights_request_id");--> statement-breakpoint
CREATE TABLE "account_deletion_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_rights_request_id" uuid NOT NULL,
	"outcome_id" uuid NOT NULL,
	"user_id" uuid,
	"subject_reference_hash" text NOT NULL,
	"source_request_revision" integer NOT NULL,
	"source_outcome_revision" integer NOT NULL,
	"source_proposal_sha256" text NOT NULL,
	"status" text DEFAULT 'review_required' NOT NULL,
	"blocker_codes_json" jsonb DEFAULT '["legal_hold_review_required","backup_tombstone_required"]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"prepared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quarantined_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_deletion_executions_digest_check" CHECK (
    "account_deletion_executions"."subject_reference_hash" ~ '^sha256:[a-f0-9]{64}$'
    and "account_deletion_executions"."source_proposal_sha256" ~ '^sha256:[a-f0-9]{64}$'),
	CONSTRAINT "account_deletion_executions_source_check" CHECK (
    "account_deletion_executions"."source_request_revision" > 0 and "account_deletion_executions"."source_outcome_revision" = 2
    and "account_deletion_executions"."revision" between 1 and 2147483647),
	CONSTRAINT "account_deletion_executions_blocker_check" CHECK (
    jsonb_typeof("account_deletion_executions"."blocker_codes_json") = 'array'
    and jsonb_array_length("account_deletion_executions"."blocker_codes_json") between 0 and 8
    and "account_deletion_executions"."blocker_codes_json" <@ '["legal_hold_review_required","backup_tombstone_required",
      "private_object_cleanup_required","financial_record_review_required","application_evidence_review_required",
      "school_handoff_review_required","privileged_role_review_required","minor_evidence_review_required"]'::jsonb),
	CONSTRAINT "account_deletion_executions_lifecycle_check" CHECK (
    isfinite("account_deletion_executions"."prepared_at") and isfinite("account_deletion_executions"."created_at") and isfinite("account_deletion_executions"."updated_at")
    and "account_deletion_executions"."updated_at" >= "account_deletion_executions"."created_at"
    and (("account_deletion_executions"."status" in ('review_required','blocked')
      and jsonb_array_length("account_deletion_executions"."blocker_codes_json") > 0
      and "account_deletion_executions"."user_id" is not null and "account_deletion_executions"."quarantined_at" is null
      and "account_deletion_executions"."purge_after" is null and "account_deletion_executions"."completed_at" is null)
    or ("account_deletion_executions"."status" = 'quarantined'
      and jsonb_array_length("account_deletion_executions"."blocker_codes_json") = 0
      and "account_deletion_executions"."user_id" is not null and "account_deletion_executions"."quarantined_at" is not null
      and isfinite("account_deletion_executions"."quarantined_at") and "account_deletion_executions"."purge_after" is not null
      and isfinite("account_deletion_executions"."purge_after") and "account_deletion_executions"."purge_after" > "account_deletion_executions"."quarantined_at"
      and "account_deletion_executions"."completed_at" is null)
    or ("account_deletion_executions"."status" = 'purge_ready'
      and jsonb_array_length("account_deletion_executions"."blocker_codes_json") = 0
      and "account_deletion_executions"."quarantined_at" is not null and isfinite("account_deletion_executions"."quarantined_at")
      and "account_deletion_executions"."purge_after" is not null and isfinite("account_deletion_executions"."purge_after")
      and "account_deletion_executions"."purge_after" > "account_deletion_executions"."quarantined_at" and "account_deletion_executions"."completed_at" is null)
    or ("account_deletion_executions"."status" = 'completed' and jsonb_array_length("account_deletion_executions"."blocker_codes_json") = 0
      and "account_deletion_executions"."user_id" is null and "account_deletion_executions"."quarantined_at" is not null
      and "account_deletion_executions"."purge_after" is not null and "account_deletion_executions"."completed_at" is not null
      and isfinite("account_deletion_executions"."completed_at") and "account_deletion_executions"."completed_at" >= "account_deletion_executions"."purge_after")))
);
--> statement-breakpoint
ALTER TABLE "account_deletion_executions" ADD CONSTRAINT "account_deletion_executions_data_rights_request_id_data_rights_requests_id_fk" FOREIGN KEY ("data_rights_request_id") REFERENCES "public"."data_rights_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_executions" ADD CONSTRAINT "account_deletion_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_executions" ADD CONSTRAINT "account_deletion_executions_outcome_request_fk" FOREIGN KEY ("outcome_id","data_rights_request_id") REFERENCES "public"."ops_data_rights_outcomes"("id","data_rights_request_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_executions_request_unique" ON "account_deletion_executions" USING btree ("data_rights_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_executions_outcome_unique" ON "account_deletion_executions" USING btree ("outcome_id");--> statement-breakpoint
CREATE INDEX "account_deletion_executions_status_prepared_idx" ON "account_deletion_executions" USING btree ("status","prepared_at","id");
