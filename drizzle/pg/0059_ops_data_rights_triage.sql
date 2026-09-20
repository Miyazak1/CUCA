CREATE TABLE "ops_data_rights_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_rights_request_id" uuid NOT NULL,
	"source_request_revision" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'investigating' NOT NULL,
	"assigned_user_id" uuid NOT NULL,
	"assigned_grant_id" uuid NOT NULL,
	"assigned_role" text NOT NULL,
	"escalation_code" text,
	"escalation_reference" text,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_data_rights_reviews_role_check" CHECK ("ops_data_rights_reviews"."assigned_role" in ('cuac_ops','cuac_admin')),
	CONSTRAINT "ops_data_rights_reviews_reference_check" CHECK ("ops_data_rights_reviews"."escalation_reference" is null
    or "ops_data_rights_reviews"."escalation_reference" ~ '^[A-Za-z0-9._:-]{1,128}$'),
	CONSTRAINT "ops_data_rights_reviews_lifecycle_check" CHECK (
    "ops_data_rights_reviews"."source_request_revision" > 0 and "ops_data_rights_reviews"."revision" in (1,2)
    and isfinite("ops_data_rights_reviews"."created_at") and isfinite("ops_data_rights_reviews"."updated_at") and "ops_data_rights_reviews"."updated_at" >= "ops_data_rights_reviews"."created_at"
    and (("ops_data_rights_reviews"."status" = 'investigating' and "ops_data_rights_reviews"."revision" = 1
      and "ops_data_rights_reviews"."escalation_code" is null and "ops_data_rights_reviews"."escalation_reference" is null and "ops_data_rights_reviews"."escalated_at" is null)
      or ("ops_data_rights_reviews"."status" = 'escalated' and "ops_data_rights_reviews"."revision" = 2
        and "ops_data_rights_reviews"."escalation_code" in ('identity_verification_required','legal_review_required','security_review_required','retention_exception_review')
        and "ops_data_rights_reviews"."escalation_reference" is not null and "ops_data_rights_reviews"."escalated_at" is not null and isfinite("ops_data_rights_reviews"."escalated_at"))))
);
--> statement-breakpoint
ALTER TABLE "data_rights_requests" DROP CONSTRAINT "data_rights_requests_status_check";--> statement-breakpoint
DROP INDEX "data_rights_requests_active_type_unique";--> statement-breakpoint
ALTER TABLE "ops_data_rights_reviews" ADD CONSTRAINT "ops_data_rights_reviews_data_rights_request_id_data_rights_requests_id_fk" FOREIGN KEY ("data_rights_request_id") REFERENCES "public"."data_rights_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_data_rights_reviews" ADD CONSTRAINT "ops_data_rights_reviews_assigned_grant_scope_fk" FOREIGN KEY ("assigned_grant_id","assigned_user_id","assigned_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ops_data_rights_reviews_request_unique" ON "ops_data_rights_reviews" USING btree ("data_rights_request_id");--> statement-breakpoint
CREATE INDEX "ops_data_rights_reviews_status_updated_idx" ON "ops_data_rights_reviews" USING btree ("status","updated_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_requests_active_type_unique" ON "data_rights_requests" USING btree ("user_id","request_type") WHERE "data_rights_requests"."user_id" is not null and "data_rights_requests"."status" in ('received', 'identity_confirmed', 'in_progress', 'escalated');--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_status_check" CHECK ("data_rights_requests"."status" in ('received', 'identity_confirmed', 'in_progress', 'escalated', 'fulfilled', 'denied', 'cancelled'));
