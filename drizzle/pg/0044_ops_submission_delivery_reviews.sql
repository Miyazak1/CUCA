CREATE TABLE "ops_submission_delivery_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"official_submission_outbox_id" uuid NOT NULL,
	"source_outcome" text NOT NULL,
	"source_error_code" text NOT NULL,
	"source_attempt_count" integer NOT NULL,
	"source_quarantined_at" timestamp with time zone NOT NULL,
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
	CONSTRAINT "ops_submission_delivery_reviews_source_check" CHECK (
      "ops_submission_delivery_reviews"."source_attempt_count" between 0 and 5 and isfinite("ops_submission_delivery_reviews"."source_quarantined_at") and (
        ("ops_submission_delivery_reviews"."source_outcome" = 'attempt_limit' and "ops_submission_delivery_reviews"."source_error_code" = 'ATTEMPT_LIMIT'
          and "ops_submission_delivery_reviews"."source_attempt_count" = 5)
        or ("ops_submission_delivery_reviews"."source_outcome" = 'invalid_payload'
          and "ops_submission_delivery_reviews"."source_error_code" in ('INVALID_PAYLOAD','DELIVERY_BINDING_CHANGED'))
        or ("ops_submission_delivery_reviews"."source_outcome" = 'unknown'
          and "ops_submission_delivery_reviews"."source_error_code" in ('PROVIDER_RESULT_UNKNOWN','PROVIDER_RECEIPT_TIME_INVALID','SENDING_LEASE_EXPIRED'))
      )),
	CONSTRAINT "ops_submission_delivery_reviews_role_check" CHECK (
      "ops_submission_delivery_reviews"."assigned_role" in ('cuac_ops','cuac_admin')
      and ("ops_submission_delivery_reviews"."resolved_by_role" is null or "ops_submission_delivery_reviews"."resolved_by_role" = 'cuac_admin')),
	CONSTRAINT "ops_submission_delivery_reviews_reference_check" CHECK (
      ("ops_submission_delivery_reviews"."escalation_reference" is null or "ops_submission_delivery_reviews"."escalation_reference" ~ '^[A-Za-z0-9._:-]{1,128}$')
      and ("ops_submission_delivery_reviews"."resolution_reference" is null or "ops_submission_delivery_reviews"."resolution_reference" ~ '^[A-Za-z0-9._:-]{1,128}$')),
	CONSTRAINT "ops_submission_delivery_reviews_lifecycle_check" CHECK (
      "ops_submission_delivery_reviews"."revision" between 1 and 2147483647
      and isfinite("ops_submission_delivery_reviews"."created_at") and isfinite("ops_submission_delivery_reviews"."updated_at")
      and "ops_submission_delivery_reviews"."created_at" >= "ops_submission_delivery_reviews"."source_quarantined_at" and "ops_submission_delivery_reviews"."updated_at" >= "ops_submission_delivery_reviews"."created_at"
      and ("ops_submission_delivery_reviews"."resolved_by_user_id" is null or "ops_submission_delivery_reviews"."resolved_by_user_id" <> "ops_submission_delivery_reviews"."assigned_user_id")
      and (
        ("ops_submission_delivery_reviews"."status" = 'investigating' and "ops_submission_delivery_reviews"."revision" = 1
          and "ops_submission_delivery_reviews"."escalation_code" is null and "ops_submission_delivery_reviews"."escalation_reference" is null and "ops_submission_delivery_reviews"."escalated_at" is null
          and "ops_submission_delivery_reviews"."resolved_by_user_id" is null and "ops_submission_delivery_reviews"."resolved_by_grant_id" is null and "ops_submission_delivery_reviews"."resolved_by_role" is null
          and "ops_submission_delivery_reviews"."resolution_code" is null and "ops_submission_delivery_reviews"."resolution_reference" is null and "ops_submission_delivery_reviews"."resolved_at" is null)
        or ("ops_submission_delivery_reviews"."status" = 'escalated' and "ops_submission_delivery_reviews"."revision" = 2
          and "ops_submission_delivery_reviews"."escalation_code" in ('provider_receipt_investigation','payload_integrity_investigation',
            'delivery_attempts_exhausted','security_investigation_required')
          and "ops_submission_delivery_reviews"."escalation_reference" is not null and "ops_submission_delivery_reviews"."escalated_at" is not null and isfinite("ops_submission_delivery_reviews"."escalated_at")
          and "ops_submission_delivery_reviews"."resolved_by_user_id" is null and "ops_submission_delivery_reviews"."resolved_by_grant_id" is null and "ops_submission_delivery_reviews"."resolved_by_role" is null
          and "ops_submission_delivery_reviews"."resolution_code" is null and "ops_submission_delivery_reviews"."resolution_reference" is null and "ops_submission_delivery_reviews"."resolved_at" is null)
        or ("ops_submission_delivery_reviews"."status" in ('closed_no_retry','retry_approved') and (
            ("ops_submission_delivery_reviews"."revision" = 2 and "ops_submission_delivery_reviews"."escalation_code" is null
              and "ops_submission_delivery_reviews"."escalation_reference" is null and "ops_submission_delivery_reviews"."escalated_at" is null)
            or ("ops_submission_delivery_reviews"."revision" = 3
              and "ops_submission_delivery_reviews"."escalation_code" in ('provider_receipt_investigation','payload_integrity_investigation',
                'delivery_attempts_exhausted','security_investigation_required')
              and "ops_submission_delivery_reviews"."escalation_reference" is not null and "ops_submission_delivery_reviews"."escalated_at" is not null
              and isfinite("ops_submission_delivery_reviews"."escalated_at")))
          and "ops_submission_delivery_reviews"."resolved_by_user_id" is not null and "ops_submission_delivery_reviews"."resolved_by_grant_id" is not null
          and "ops_submission_delivery_reviews"."resolved_by_role" = 'cuac_admin' and "ops_submission_delivery_reviews"."resolution_reference" is not null
          and "ops_submission_delivery_reviews"."resolved_at" is not null and isfinite("ops_submission_delivery_reviews"."resolved_at")
          and (("ops_submission_delivery_reviews"."status" = 'retry_approved'
              and "ops_submission_delivery_reviews"."resolution_code" = 'provider_not_accepted_retry_approved'
              and "ops_submission_delivery_reviews"."source_outcome" = 'attempt_limit' and "ops_submission_delivery_reviews"."source_error_code" = 'ATTEMPT_LIMIT'
              and "ops_submission_delivery_reviews"."source_attempt_count" = 5)
            or ("ops_submission_delivery_reviews"."status" = 'closed_no_retry' and "ops_submission_delivery_reviews"."resolution_code" in (
              'provider_acceptance_uncertain_no_retry','payload_rebuild_required_no_retry',
              'policy_evidence_invalid_no_retry','duplicate_risk_unresolved_no_retry'))))
      ))
);
--> statement-breakpoint
ALTER TABLE "ops_submission_delivery_reviews" ADD CONSTRAINT "ops_submission_delivery_reviews_official_submission_outbox_id_official_submission_outbox_id_fk" FOREIGN KEY ("official_submission_outbox_id") REFERENCES "public"."official_submission_outbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_submission_delivery_reviews" ADD CONSTRAINT "ops_submission_delivery_reviews_assigned_grant_scope_fk" FOREIGN KEY ("assigned_grant_id","assigned_user_id","assigned_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_submission_delivery_reviews" ADD CONSTRAINT "ops_submission_delivery_reviews_resolved_grant_scope_fk" FOREIGN KEY ("resolved_by_grant_id","resolved_by_user_id","resolved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ops_submission_delivery_reviews_outbox_generation_unique" ON "ops_submission_delivery_reviews" USING btree ("official_submission_outbox_id","source_quarantined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ops_submission_delivery_reviews_retry_approval_unique" ON "ops_submission_delivery_reviews" USING btree ("official_submission_outbox_id") WHERE "ops_submission_delivery_reviews"."status" = 'retry_approved';--> statement-breakpoint
CREATE INDEX "ops_submission_delivery_reviews_status_updated_idx" ON "ops_submission_delivery_reviews" USING btree ("status","updated_at","id");--> statement-breakpoint
CREATE INDEX "ops_submission_delivery_reviews_assignee_status_idx" ON "ops_submission_delivery_reviews" USING btree ("assigned_user_id","status","updated_at");