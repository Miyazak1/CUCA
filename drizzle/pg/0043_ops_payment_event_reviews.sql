CREATE TABLE "ops_payment_event_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_provider_event_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'investigating' NOT NULL,
	"assigned_user_id" uuid NOT NULL,
	"assigned_grant_id" uuid NOT NULL,
	"assigned_role" text NOT NULL,
	"escalation_code" text,
	"escalation_reference" text,
	"escalated_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolved_by_grant_id" uuid,
	"resolved_by_role" text,
	"resolution_code" text,
	"resolution_reference" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_payment_event_reviews_revision_check" CHECK ("ops_payment_event_reviews"."revision" between 1 and 2147483647),
	CONSTRAINT "ops_payment_event_reviews_role_check" CHECK ("ops_payment_event_reviews"."assigned_role" in ('cuac_ops','cuac_admin')
      and ("ops_payment_event_reviews"."resolved_by_role" is null or "ops_payment_event_reviews"."resolved_by_role" = 'cuac_admin')),
	CONSTRAINT "ops_payment_event_reviews_reference_check" CHECK (("ops_payment_event_reviews"."escalation_reference" is null
        or "ops_payment_event_reviews"."escalation_reference" ~ '^[A-Za-z0-9._:-]{1,128}$')
      and ("ops_payment_event_reviews"."resolution_reference" is null or "ops_payment_event_reviews"."resolution_reference" ~ '^[A-Za-z0-9._:-]{1,128}$')),
	CONSTRAINT "ops_payment_event_reviews_lifecycle_check" CHECK ("ops_payment_event_reviews"."updated_at" >= "ops_payment_event_reviews"."created_at"
      and isfinite("ops_payment_event_reviews"."created_at") and isfinite("ops_payment_event_reviews"."updated_at")
      and ("ops_payment_event_reviews"."resolved_by_user_id" is null or "ops_payment_event_reviews"."resolved_by_user_id" <> "ops_payment_event_reviews"."assigned_user_id")
      and (
        ("ops_payment_event_reviews"."status" = 'investigating' and "ops_payment_event_reviews"."revision" = 1
          and "ops_payment_event_reviews"."escalation_code" is null and "ops_payment_event_reviews"."escalation_reference" is null and "ops_payment_event_reviews"."escalated_at" is null
          and "ops_payment_event_reviews"."resolved_by_user_id" is null and "ops_payment_event_reviews"."resolved_by_grant_id" is null and "ops_payment_event_reviews"."resolved_by_role" is null
          and "ops_payment_event_reviews"."resolution_code" is null and "ops_payment_event_reviews"."resolution_reference" is null and "ops_payment_event_reviews"."resolved_at" is null)
        or ("ops_payment_event_reviews"."status" = 'escalated' and "ops_payment_event_reviews"."revision" = 2
          and "ops_payment_event_reviews"."escalation_code" in ('provider_investigation_required','finance_approval_required','security_investigation_required','internal_data_repair_required')
          and "ops_payment_event_reviews"."escalation_reference" is not null and "ops_payment_event_reviews"."escalated_at" is not null and isfinite("ops_payment_event_reviews"."escalated_at")
          and "ops_payment_event_reviews"."resolved_by_user_id" is null and "ops_payment_event_reviews"."resolved_by_grant_id" is null and "ops_payment_event_reviews"."resolved_by_role" is null
          and "ops_payment_event_reviews"."resolution_code" is null and "ops_payment_event_reviews"."resolution_reference" is null and "ops_payment_event_reviews"."resolved_at" is null)
        or ("ops_payment_event_reviews"."status" = 'resolved_no_change' and "ops_payment_event_reviews"."revision" in (2,3)
          and (("ops_payment_event_reviews"."escalation_code" is null and "ops_payment_event_reviews"."escalation_reference" is null and "ops_payment_event_reviews"."escalated_at" is null)
            or ("ops_payment_event_reviews"."escalation_code" in ('provider_investigation_required','finance_approval_required','security_investigation_required','internal_data_repair_required')
              and "ops_payment_event_reviews"."escalation_reference" is not null and "ops_payment_event_reviews"."escalated_at" is not null and isfinite("ops_payment_event_reviews"."escalated_at")))
          and "ops_payment_event_reviews"."resolved_by_user_id" is not null and "ops_payment_event_reviews"."resolved_by_grant_id" is not null and "ops_payment_event_reviews"."resolved_by_role" = 'cuac_admin'
          and "ops_payment_event_reviews"."resolution_code" in ('provider_confirmed_no_change','duplicate_event_no_change','invalid_event_no_change','superseded_by_provider_case')
          and "ops_payment_event_reviews"."resolution_reference" is not null and "ops_payment_event_reviews"."resolved_at" is not null and isfinite("ops_payment_event_reviews"."resolved_at"))
      ))
);
--> statement-breakpoint
ALTER TABLE "ops_payment_event_reviews" ADD CONSTRAINT "ops_payment_event_reviews_payment_provider_event_id_payment_provider_events_id_fk" FOREIGN KEY ("payment_provider_event_id") REFERENCES "public"."payment_provider_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payment_event_reviews" ADD CONSTRAINT "ops_payment_event_reviews_assigned_grant_scope_fk" FOREIGN KEY ("assigned_grant_id","assigned_user_id","assigned_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payment_event_reviews" ADD CONSTRAINT "ops_payment_event_reviews_resolved_grant_scope_fk" FOREIGN KEY ("resolved_by_grant_id","resolved_by_user_id","resolved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ops_payment_event_reviews_event_unique" ON "ops_payment_event_reviews" USING btree ("payment_provider_event_id");--> statement-breakpoint
CREATE INDEX "ops_payment_event_reviews_status_updated_idx" ON "ops_payment_event_reviews" USING btree ("status","updated_at","id");--> statement-breakpoint
CREATE INDEX "ops_payment_event_reviews_assignee_status_idx" ON "ops_payment_event_reviews" USING btree ("assigned_user_id","status","updated_at");