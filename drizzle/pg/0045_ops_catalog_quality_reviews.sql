CREATE TABLE "ops_catalog_quality_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_entity_updated_at" timestamp with time zone NOT NULL,
	"source_evidence_id" uuid,
	"source_evidence_captured_at" timestamp with time zone,
	"source_issue_code" text NOT NULL,
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
	"review_due_at" timestamp with time zone,
	"result_entity_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_catalog_quality_reviews_generation_unique" UNIQUE NULLS NOT DISTINCT("entity_type","entity_id","source_entity_updated_at","source_evidence_id"),
	CONSTRAINT "ops_catalog_quality_reviews_source_check" CHECK (
      "ops_catalog_quality_reviews"."entity_type" in ('city','school','program','scholarship')
      and "ops_catalog_quality_reviews"."source_issue_code" in ('missing_source_evidence','invalid_source_url','unverified','stale','disputed','verification_metadata_missing')
      and isfinite("ops_catalog_quality_reviews"."source_entity_updated_at")
      and (("ops_catalog_quality_reviews"."source_issue_code" = 'missing_source_evidence'
          and "ops_catalog_quality_reviews"."source_evidence_id" is null and "ops_catalog_quality_reviews"."source_evidence_captured_at" is null)
        or ("ops_catalog_quality_reviews"."source_issue_code" <> 'missing_source_evidence'
          and "ops_catalog_quality_reviews"."source_evidence_id" is not null and "ops_catalog_quality_reviews"."source_evidence_captured_at" is not null
          and isfinite("ops_catalog_quality_reviews"."source_evidence_captured_at")))),
	CONSTRAINT "ops_catalog_quality_reviews_role_check" CHECK (
      "ops_catalog_quality_reviews"."assigned_role" in ('cuac_ops','cuac_admin')
      and ("ops_catalog_quality_reviews"."resolved_by_role" is null or "ops_catalog_quality_reviews"."resolved_by_role" = 'cuac_admin')),
	CONSTRAINT "ops_catalog_quality_reviews_reference_check" CHECK (
      ("ops_catalog_quality_reviews"."escalation_reference" is null or "ops_catalog_quality_reviews"."escalation_reference" ~ '^[A-Za-z0-9._:-]{1,128}$')
      and ("ops_catalog_quality_reviews"."resolution_reference" is null or "ops_catalog_quality_reviews"."resolution_reference" ~ '^[A-Za-z0-9._:-]{1,128}$')),
	CONSTRAINT "ops_catalog_quality_reviews_lifecycle_check" CHECK (
      "ops_catalog_quality_reviews"."revision" between 1 and 2147483647
      and isfinite("ops_catalog_quality_reviews"."created_at") and isfinite("ops_catalog_quality_reviews"."updated_at")
      and "ops_catalog_quality_reviews"."created_at" >= "ops_catalog_quality_reviews"."source_entity_updated_at" and "ops_catalog_quality_reviews"."updated_at" >= "ops_catalog_quality_reviews"."created_at"
      and ("ops_catalog_quality_reviews"."resolved_by_user_id" is null or "ops_catalog_quality_reviews"."resolved_by_user_id" <> "ops_catalog_quality_reviews"."assigned_user_id")
      and (
        ("ops_catalog_quality_reviews"."status" = 'investigating' and "ops_catalog_quality_reviews"."revision" = 1
          and "ops_catalog_quality_reviews"."escalation_code" is null and "ops_catalog_quality_reviews"."escalation_reference" is null and "ops_catalog_quality_reviews"."escalated_at" is null
          and "ops_catalog_quality_reviews"."resolved_by_user_id" is null and "ops_catalog_quality_reviews"."resolved_by_grant_id" is null and "ops_catalog_quality_reviews"."resolved_by_role" is null
          and "ops_catalog_quality_reviews"."resolution_code" is null and "ops_catalog_quality_reviews"."resolution_reference" is null and "ops_catalog_quality_reviews"."resolved_at" is null
          and "ops_catalog_quality_reviews"."review_due_at" is null and "ops_catalog_quality_reviews"."result_entity_updated_at" is null)
        or ("ops_catalog_quality_reviews"."status" = 'escalated' and "ops_catalog_quality_reviews"."revision" = 2
          and "ops_catalog_quality_reviews"."escalation_code" in ('source_owner_confirmation_required','conflicting_official_sources',
            'legal_or_policy_review_required','suspected_source_tampering')
          and "ops_catalog_quality_reviews"."escalation_reference" is not null and "ops_catalog_quality_reviews"."escalated_at" is not null and isfinite("ops_catalog_quality_reviews"."escalated_at")
          and "ops_catalog_quality_reviews"."resolved_by_user_id" is null and "ops_catalog_quality_reviews"."resolved_by_grant_id" is null and "ops_catalog_quality_reviews"."resolved_by_role" is null
          and "ops_catalog_quality_reviews"."resolution_code" is null and "ops_catalog_quality_reviews"."resolution_reference" is null and "ops_catalog_quality_reviews"."resolved_at" is null
          and "ops_catalog_quality_reviews"."review_due_at" is null and "ops_catalog_quality_reviews"."result_entity_updated_at" is null)
        or ("ops_catalog_quality_reviews"."status" in ('verified','disputed','closed_no_change') and (
            ("ops_catalog_quality_reviews"."revision" = 2 and "ops_catalog_quality_reviews"."escalation_code" is null
              and "ops_catalog_quality_reviews"."escalation_reference" is null and "ops_catalog_quality_reviews"."escalated_at" is null)
            or ("ops_catalog_quality_reviews"."revision" = 3
              and "ops_catalog_quality_reviews"."escalation_code" in ('source_owner_confirmation_required','conflicting_official_sources',
                'legal_or_policy_review_required','suspected_source_tampering')
              and "ops_catalog_quality_reviews"."escalation_reference" is not null and "ops_catalog_quality_reviews"."escalated_at" is not null
              and isfinite("ops_catalog_quality_reviews"."escalated_at")))
          and "ops_catalog_quality_reviews"."resolved_by_user_id" is not null and "ops_catalog_quality_reviews"."resolved_by_grant_id" is not null
          and "ops_catalog_quality_reviews"."resolved_by_role" = 'cuac_admin' and "ops_catalog_quality_reviews"."resolution_reference" is not null
          and "ops_catalog_quality_reviews"."resolved_at" is not null and isfinite("ops_catalog_quality_reviews"."resolved_at")
          and "ops_catalog_quality_reviews"."result_entity_updated_at" is not null and isfinite("ops_catalog_quality_reviews"."result_entity_updated_at")
          and "ops_catalog_quality_reviews"."resolved_at" >= "ops_catalog_quality_reviews"."created_at" and "ops_catalog_quality_reviews"."result_entity_updated_at" >= "ops_catalog_quality_reviews"."source_entity_updated_at"
          and (("ops_catalog_quality_reviews"."status" = 'verified' and "ops_catalog_quality_reviews"."resolution_code" = 'source_confirmed'
              and "ops_catalog_quality_reviews"."source_evidence_id" is not null and "ops_catalog_quality_reviews"."review_due_at" is not null
              and isfinite("ops_catalog_quality_reviews"."review_due_at") and "ops_catalog_quality_reviews"."review_due_at" >= "ops_catalog_quality_reviews"."resolved_at" + interval '30 days'
              and "ops_catalog_quality_reviews"."review_due_at" <= "ops_catalog_quality_reviews"."resolved_at" + interval '366 days'
              and "ops_catalog_quality_reviews"."result_entity_updated_at" = "ops_catalog_quality_reviews"."resolved_at")
            or ("ops_catalog_quality_reviews"."status" = 'disputed' and "ops_catalog_quality_reviews"."resolution_code" in ('source_conflict_confirmed','source_invalid')
              and "ops_catalog_quality_reviews"."source_evidence_id" is not null and "ops_catalog_quality_reviews"."review_due_at" is null
              and "ops_catalog_quality_reviews"."result_entity_updated_at" = "ops_catalog_quality_reviews"."resolved_at")
            or ("ops_catalog_quality_reviews"."status" = 'closed_no_change' and "ops_catalog_quality_reviews"."resolution_code" = 'source_evidence_required_no_change'
              and "ops_catalog_quality_reviews"."source_evidence_id" is null and "ops_catalog_quality_reviews"."review_due_at" is null
              and "ops_catalog_quality_reviews"."result_entity_updated_at" = "ops_catalog_quality_reviews"."source_entity_updated_at")))
      ))
);
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "next_review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "next_review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "next_review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "next_review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalog_source_evidence" ADD CONSTRAINT "catalog_source_evidence_identity_unique" UNIQUE("id","entity_type","entity_id","captured_at");--> statement-breakpoint
ALTER TABLE "ops_catalog_quality_reviews" ADD CONSTRAINT "ops_catalog_quality_reviews_assigned_grant_scope_fk" FOREIGN KEY ("assigned_grant_id","assigned_user_id","assigned_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_catalog_quality_reviews" ADD CONSTRAINT "ops_catalog_quality_reviews_resolved_grant_scope_fk" FOREIGN KEY ("resolved_by_grant_id","resolved_by_user_id","resolved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_catalog_quality_reviews" ADD CONSTRAINT "ops_catalog_quality_reviews_source_evidence_fk" FOREIGN KEY ("source_evidence_id","entity_type","entity_id","source_evidence_captured_at") REFERENCES "public"."catalog_source_evidence"("id","entity_type","entity_id","captured_at") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_catalog_quality_reviews_status_updated_idx" ON "ops_catalog_quality_reviews" USING btree ("status","updated_at","id");--> statement-breakpoint
CREATE INDEX "ops_catalog_quality_reviews_entity_status_idx" ON "ops_catalog_quality_reviews" USING btree ("entity_type","entity_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
