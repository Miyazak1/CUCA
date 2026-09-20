CREATE TABLE "account_deletion_quarantine_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_id" uuid NOT NULL,
	"source_execution_revision" integer NOT NULL,
	"legal_hold_review_id" uuid NOT NULL,
	"backup_tombstone_receipt_sha256" text NOT NULL,
	"backup_tombstone_recorded_at" timestamp with time zone NOT NULL,
	"policy_version" text DEFAULT 'account_deletion_quarantine_v1' NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"approved_by_grant_id" uuid NOT NULL,
	"approved_by_role" text NOT NULL,
	"quarantined_at" timestamp with time zone NOT NULL,
	"purge_after" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_deletion_quarantine_receipts_receipt_check" CHECK (
    "account_deletion_quarantine_receipts"."backup_tombstone_receipt_sha256" ~ '^sha256:[a-f0-9]{64}$'
    and "account_deletion_quarantine_receipts"."policy_version" = 'account_deletion_quarantine_v1'
    and "account_deletion_quarantine_receipts"."source_execution_revision" > 0 and "account_deletion_quarantine_receipts"."approved_by_role" = 'cuac_admin'),
	CONSTRAINT "account_deletion_quarantine_receipts_time_check" CHECK (
    isfinite("account_deletion_quarantine_receipts"."backup_tombstone_recorded_at") and isfinite("account_deletion_quarantine_receipts"."quarantined_at")
    and isfinite("account_deletion_quarantine_receipts"."purge_after") and isfinite("account_deletion_quarantine_receipts"."created_at")
    and "account_deletion_quarantine_receipts"."backup_tombstone_recorded_at" <= "account_deletion_quarantine_receipts"."quarantined_at"
    and "account_deletion_quarantine_receipts"."purge_after" = "account_deletion_quarantine_receipts"."quarantined_at" + interval '30 days'
    and "account_deletion_quarantine_receipts"."created_at" >= "account_deletion_quarantine_receipts"."quarantined_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_legal_hold_reviews_id_execution_unique" ON "account_deletion_legal_hold_reviews" USING btree ("id","execution_id");--> statement-breakpoint
ALTER TABLE "account_deletion_quarantine_receipts" ADD CONSTRAINT "account_deletion_quarantine_receipts_execution_id_account_deletion_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."account_deletion_executions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_quarantine_receipts" ADD CONSTRAINT "account_deletion_quarantine_receipts_legal_review_execution_fk" FOREIGN KEY ("legal_hold_review_id","execution_id") REFERENCES "public"."account_deletion_legal_hold_reviews"("id","execution_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_quarantine_receipts" ADD CONSTRAINT "account_deletion_quarantine_receipts_approver_grant_scope_fk" FOREIGN KEY ("approved_by_grant_id","approved_by_user_id","approved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_quarantine_receipts_execution_unique" ON "account_deletion_quarantine_receipts" USING btree ("execution_id");
