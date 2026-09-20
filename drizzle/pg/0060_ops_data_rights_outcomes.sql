CREATE TABLE "ops_data_rights_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data_rights_request_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"source_request_revision" integer NOT NULL,
	"source_review_revision" integer NOT NULL,
	"outcome_code" text NOT NULL,
	"reason_code" text,
	"case_reference" text NOT NULL,
	"proposal_sha256" text NOT NULL,
	"approval_mode" text NOT NULL,
	"status" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"proposed_by_user_id" uuid NOT NULL,
	"proposed_by_grant_id" uuid NOT NULL,
	"proposed_by_role" text NOT NULL,
	"approved_by_user_id" uuid,
	"approved_by_grant_id" uuid,
	"approved_by_role" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_data_rights_outcomes_digest_check" CHECK ("ops_data_rights_outcomes"."proposal_sha256" ~ '^sha256:[a-f0-9]{64}$'),
	CONSTRAINT "ops_data_rights_outcomes_reference_check" CHECK ("ops_data_rights_outcomes"."case_reference" ~ '^[A-Za-z0-9._:-]{1,128}$'),
	CONSTRAINT "ops_data_rights_outcomes_outcome_check" CHECK (
    ("ops_data_rights_outcomes"."outcome_code" in ('access_ready','correction_ready','portable_export_ready','account_deletion_ready') and "ops_data_rights_outcomes"."reason_code" is null)
    or ("ops_data_rights_outcomes"."outcome_code" = 'request_denied' and "ops_data_rights_outcomes"."reason_code" in ('identity_not_proven','request_out_of_scope','legal_restriction'))
    or ("ops_data_rights_outcomes"."outcome_code" = 'retention_exception' and "ops_data_rights_outcomes"."reason_code" in ('legal_hold','fraud_or_security','financial_record'))),
	CONSTRAINT "ops_data_rights_outcomes_lifecycle_check" CHECK (
    "ops_data_rights_outcomes"."source_request_revision" > 0 and "ops_data_rights_outcomes"."source_review_revision" in (1,2) and "ops_data_rights_outcomes"."revision" in (1,2)
	and "ops_data_rights_outcomes"."proposed_by_role" in ('cuac_ops','cuac_admin') and ("ops_data_rights_outcomes"."approved_by_role" is null or "ops_data_rights_outcomes"."approved_by_role" in ('cuac_ops','cuac_admin'))
    and isfinite("ops_data_rights_outcomes"."created_at") and isfinite("ops_data_rights_outcomes"."updated_at") and "ops_data_rights_outcomes"."updated_at" >= "ops_data_rights_outcomes"."created_at"
    and (("ops_data_rights_outcomes"."approval_mode" = 'single_operator' and "ops_data_rights_outcomes"."outcome_code" in ('access_ready','correction_ready')
      and "ops_data_rights_outcomes"."status" = 'approved' and "ops_data_rights_outcomes"."revision" = 1 and "ops_data_rights_outcomes"."approved_by_user_id" = "ops_data_rights_outcomes"."proposed_by_user_id"
      and "ops_data_rights_outcomes"."approved_by_grant_id" = "ops_data_rights_outcomes"."proposed_by_grant_id" and "ops_data_rights_outcomes"."approved_by_role" = "ops_data_rights_outcomes"."proposed_by_role"
      and "ops_data_rights_outcomes"."approved_at" is not null and isfinite("ops_data_rights_outcomes"."approved_at"))
    or ("ops_data_rights_outcomes"."approval_mode" = 'single_admin' and "ops_data_rights_outcomes"."outcome_code" = 'portable_export_ready'
      and "ops_data_rights_outcomes"."proposed_by_role" = 'cuac_admin' and "ops_data_rights_outcomes"."status" = 'approved' and "ops_data_rights_outcomes"."revision" = 1
      and "ops_data_rights_outcomes"."approved_by_user_id" = "ops_data_rights_outcomes"."proposed_by_user_id" and "ops_data_rights_outcomes"."approved_by_grant_id" = "ops_data_rights_outcomes"."proposed_by_grant_id"
      and "ops_data_rights_outcomes"."approved_by_role" = 'cuac_admin' and "ops_data_rights_outcomes"."approved_at" is not null and isfinite("ops_data_rights_outcomes"."approved_at"))
    or ("ops_data_rights_outcomes"."approval_mode" = 'dual_control' and "ops_data_rights_outcomes"."outcome_code" in ('account_deletion_ready','request_denied','retention_exception') and (
      ("ops_data_rights_outcomes"."status" = 'proposed' and "ops_data_rights_outcomes"."revision" = 1 and "ops_data_rights_outcomes"."approved_by_user_id" is null
        and "ops_data_rights_outcomes"."approved_by_grant_id" is null and "ops_data_rights_outcomes"."approved_by_role" is null and "ops_data_rights_outcomes"."approved_at" is null)
      or ("ops_data_rights_outcomes"."status" = 'approved' and "ops_data_rights_outcomes"."revision" = 2 and "ops_data_rights_outcomes"."approved_by_user_id" <> "ops_data_rights_outcomes"."proposed_by_user_id"
        and "ops_data_rights_outcomes"."approved_by_grant_id" is not null and "ops_data_rights_outcomes"."approved_by_role" = 'cuac_admin'
        and "ops_data_rights_outcomes"."approved_at" is not null and isfinite("ops_data_rights_outcomes"."approved_at"))))))
);
--> statement-breakpoint
ALTER TABLE "ops_data_rights_outcomes" ADD CONSTRAINT "ops_data_rights_outcomes_data_rights_request_id_data_rights_requests_id_fk" FOREIGN KEY ("data_rights_request_id") REFERENCES "public"."data_rights_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_data_rights_outcomes" ADD CONSTRAINT "ops_data_rights_outcomes_review_id_ops_data_rights_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."ops_data_rights_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_data_rights_outcomes" ADD CONSTRAINT "ops_data_rights_outcomes_proposed_grant_scope_fk" FOREIGN KEY ("proposed_by_grant_id","proposed_by_user_id","proposed_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_data_rights_outcomes" ADD CONSTRAINT "ops_data_rights_outcomes_approved_grant_scope_fk" FOREIGN KEY ("approved_by_grant_id","approved_by_user_id","approved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ops_data_rights_outcomes_request_unique" ON "ops_data_rights_outcomes" USING btree ("data_rights_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ops_data_rights_outcomes_review_unique" ON "ops_data_rights_outcomes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "ops_data_rights_outcomes_status_updated_idx" ON "ops_data_rights_outcomes" USING btree ("status","updated_at","id");
