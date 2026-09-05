CREATE TABLE "school_catalog_correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"source_school_updated_at" timestamp with time zone NOT NULL,
	"change_set_json" jsonb NOT NULL,
	"evidence_url" text NOT NULL,
	"reason_code" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_membership_id" uuid NOT NULL,
	"requested_membership_role" text NOT NULL,
	"claimed_by_user_id" uuid,
	"claimed_by_grant_id" uuid,
	"claimed_by_role" text,
	"claimed_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolved_by_grant_id" uuid,
	"resolved_by_role" text,
	"resolution_code" text,
	"resolution_reference" text,
	"resolved_at" timestamp with time zone,
	"result_school_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_catalog_correction_requests_request_check" CHECK (
      "school_catalog_correction_requests"."requested_membership_role" in ('admissions','counselor','school_admin')
      and "school_catalog_correction_requests"."reason_code" in ('official_website_changed','admissions_route_changed','fee_information_changed',
        'language_information_changed','outdated_public_information')
      and jsonb_typeof("school_catalog_correction_requests"."change_set_json") = 'object'
      and octet_length(convert_to("school_catalog_correction_requests"."change_set_json"::text, 'UTF8')) between 2 and 8192
      and "school_catalog_correction_requests"."evidence_url" ~ '^https://[^[:space:]]{1,2039}$'
      and isfinite("school_catalog_correction_requests"."source_school_updated_at")),
	CONSTRAINT "school_catalog_correction_requests_role_check" CHECK (
      ("school_catalog_correction_requests"."claimed_by_role" is null or "school_catalog_correction_requests"."claimed_by_role" in ('cuac_ops','cuac_admin'))
      and ("school_catalog_correction_requests"."resolved_by_role" is null or "school_catalog_correction_requests"."resolved_by_role" = 'cuac_admin')),
	CONSTRAINT "school_catalog_correction_requests_reference_check" CHECK (
      "school_catalog_correction_requests"."resolution_reference" is null or "school_catalog_correction_requests"."resolution_reference" ~ '^[A-Za-z0-9._:-]{1,128}$'),
	CONSTRAINT "school_catalog_correction_requests_lifecycle_check" CHECK (
      "school_catalog_correction_requests"."revision" between 1 and 2147483647
      and isfinite("school_catalog_correction_requests"."created_at") and isfinite("school_catalog_correction_requests"."updated_at")
      and "school_catalog_correction_requests"."created_at" >= "school_catalog_correction_requests"."source_school_updated_at" and "school_catalog_correction_requests"."updated_at" >= "school_catalog_correction_requests"."created_at"
      and ("school_catalog_correction_requests"."resolved_by_user_id" is null or "school_catalog_correction_requests"."resolved_by_user_id" <> "school_catalog_correction_requests"."claimed_by_user_id")
      and (
        ("school_catalog_correction_requests"."status" = 'submitted' and "school_catalog_correction_requests"."revision" = 1
          and "school_catalog_correction_requests"."claimed_by_user_id" is null and "school_catalog_correction_requests"."claimed_by_grant_id" is null
          and "school_catalog_correction_requests"."claimed_by_role" is null and "school_catalog_correction_requests"."claimed_at" is null
          and "school_catalog_correction_requests"."resolved_by_user_id" is null and "school_catalog_correction_requests"."resolved_by_grant_id" is null
          and "school_catalog_correction_requests"."resolved_by_role" is null and "school_catalog_correction_requests"."resolution_code" is null
          and "school_catalog_correction_requests"."resolution_reference" is null and "school_catalog_correction_requests"."resolved_at" is null
          and "school_catalog_correction_requests"."result_school_updated_at" is null)
        or ("school_catalog_correction_requests"."status" = 'claimed' and "school_catalog_correction_requests"."revision" = 2
          and "school_catalog_correction_requests"."claimed_by_user_id" is not null and "school_catalog_correction_requests"."claimed_by_grant_id" is not null
          and "school_catalog_correction_requests"."claimed_by_role" in ('cuac_ops','cuac_admin')
          and "school_catalog_correction_requests"."claimed_at" is not null and isfinite("school_catalog_correction_requests"."claimed_at")
          and "school_catalog_correction_requests"."claimed_at" >= "school_catalog_correction_requests"."created_at"
          and "school_catalog_correction_requests"."resolved_by_user_id" is null and "school_catalog_correction_requests"."resolved_by_grant_id" is null
          and "school_catalog_correction_requests"."resolved_by_role" is null and "school_catalog_correction_requests"."resolution_code" is null
          and "school_catalog_correction_requests"."resolution_reference" is null and "school_catalog_correction_requests"."resolved_at" is null
          and "school_catalog_correction_requests"."result_school_updated_at" is null)
        or ("school_catalog_correction_requests"."status" in ('applied','rejected') and "school_catalog_correction_requests"."revision" = 3
          and "school_catalog_correction_requests"."claimed_by_user_id" is not null and "school_catalog_correction_requests"."claimed_by_grant_id" is not null
          and "school_catalog_correction_requests"."claimed_by_role" in ('cuac_ops','cuac_admin')
          and "school_catalog_correction_requests"."claimed_at" is not null and isfinite("school_catalog_correction_requests"."claimed_at")
          and "school_catalog_correction_requests"."resolved_by_user_id" is not null and "school_catalog_correction_requests"."resolved_by_grant_id" is not null
          and "school_catalog_correction_requests"."resolved_by_role" = 'cuac_admin'
          and "school_catalog_correction_requests"."resolution_reference" is not null and "school_catalog_correction_requests"."resolved_at" is not null
          and isfinite("school_catalog_correction_requests"."resolved_at") and "school_catalog_correction_requests"."resolved_at" >= "school_catalog_correction_requests"."claimed_at"
          and "school_catalog_correction_requests"."result_school_updated_at" is not null and isfinite("school_catalog_correction_requests"."result_school_updated_at")
          and (("school_catalog_correction_requests"."status" = 'applied' and "school_catalog_correction_requests"."resolution_code" = 'applied_unverified'
              and "school_catalog_correction_requests"."result_school_updated_at" = "school_catalog_correction_requests"."resolved_at"
              and "school_catalog_correction_requests"."result_school_updated_at" > "school_catalog_correction_requests"."source_school_updated_at")
            or ("school_catalog_correction_requests"."status" = 'rejected'
              and "school_catalog_correction_requests"."resolution_code" in ('rejected_duplicate','rejected_unverifiable','rejected_out_of_scope')
              and "school_catalog_correction_requests"."result_school_updated_at" = "school_catalog_correction_requests"."source_school_updated_at")))
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "school_staff_memberships_id_user_school_role_unique" ON "school_staff_memberships" USING btree ("id","user_id","school_id","role");--> statement-breakpoint
ALTER TABLE "school_catalog_correction_requests" ADD CONSTRAINT "school_catalog_correction_requests_requester_membership_fk" FOREIGN KEY ("requested_membership_id","requested_by_user_id","school_id","requested_membership_role") REFERENCES "public"."school_staff_memberships"("id","user_id","school_id","role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_catalog_correction_requests" ADD CONSTRAINT "school_catalog_correction_requests_claimed_grant_scope_fk" FOREIGN KEY ("claimed_by_grant_id","claimed_by_user_id","claimed_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_catalog_correction_requests" ADD CONSTRAINT "school_catalog_correction_requests_resolved_grant_scope_fk" FOREIGN KEY ("resolved_by_grant_id","resolved_by_user_id","resolved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "school_catalog_correction_requests_active_generation_unique" ON "school_catalog_correction_requests" USING btree ("school_id","source_school_updated_at") WHERE "school_catalog_correction_requests"."status" in ('submitted','claimed');--> statement-breakpoint
CREATE INDEX "school_catalog_correction_requests_school_created_idx" ON "school_catalog_correction_requests" USING btree ("school_id","created_at","id");--> statement-breakpoint
CREATE INDEX "school_catalog_correction_requests_status_updated_idx" ON "school_catalog_correction_requests" USING btree ("status","updated_at","id");
