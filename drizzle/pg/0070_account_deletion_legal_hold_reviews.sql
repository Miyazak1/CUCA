CREATE TABLE "account_deletion_legal_hold_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"source_execution_revision" integer NOT NULL,
	"result" text NOT NULL,
	"reason_code" text NOT NULL,
	"case_reference" text NOT NULL,
	"reviewed_by_user_id" uuid NOT NULL,
	"reviewed_by_grant_id" uuid NOT NULL,
	"reviewed_by_role" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_deletion_legal_hold_reviews_decision_check" CHECK (
    ("account_deletion_legal_hold_reviews"."result" = 'clear_candidate' and "account_deletion_legal_hold_reviews"."reason_code" = 'no_hold_found')
    or ("account_deletion_legal_hold_reviews"."result" = 'blocked' and "account_deletion_legal_hold_reviews"."reason_code" in
      ('legal_hold','fraud_or_security','financial_record'))),
	CONSTRAINT "account_deletion_legal_hold_reviews_reference_check" CHECK (
    "account_deletion_legal_hold_reviews"."case_reference" ~ '^[A-Za-z0-9._:-]{1,128}$'),
	CONSTRAINT "account_deletion_legal_hold_reviews_authority_check" CHECK (
    "account_deletion_legal_hold_reviews"."reviewed_by_role" = 'cuac_admin' and "account_deletion_legal_hold_reviews"."version" > 0
    and "account_deletion_legal_hold_reviews"."source_execution_revision" > 0
    and isfinite("account_deletion_legal_hold_reviews"."reviewed_at") and isfinite("account_deletion_legal_hold_reviews"."created_at")
    and "account_deletion_legal_hold_reviews"."created_at" >= "account_deletion_legal_hold_reviews"."reviewed_at")
);
--> statement-breakpoint
ALTER TABLE "account_deletion_legal_hold_reviews" ADD CONSTRAINT "account_deletion_legal_hold_reviews_execution_id_account_deletion_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."account_deletion_executions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_legal_hold_reviews" ADD CONSTRAINT "account_deletion_legal_hold_reviews_reviewer_grant_scope_fk" FOREIGN KEY ("reviewed_by_grant_id","reviewed_by_user_id","reviewed_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_legal_hold_reviews_execution_version_unique" ON "account_deletion_legal_hold_reviews" USING btree ("execution_id","version");--> statement-breakpoint
CREATE INDEX "account_deletion_legal_hold_reviews_execution_reviewed_idx" ON "account_deletion_legal_hold_reviews" USING btree ("execution_id","reviewed_at","id");