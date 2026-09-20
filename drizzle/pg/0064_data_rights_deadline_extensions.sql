CREATE TABLE "data_rights_deadline_extensions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data_rights_request_id" uuid NOT NULL,
	"original_response_due_at" timestamp with time zone NOT NULL,
	"review_id" uuid NOT NULL,
	"source_request_revision" integer NOT NULL,
	"source_review_revision" integer NOT NULL,
	"reason_code" text NOT NULL,
	"case_reference" text NOT NULL,
	"extended_due_at" timestamp with time zone NOT NULL,
	"approved_by_user_id" uuid NOT NULL,
	"approved_by_grant_id" uuid NOT NULL,
	"approved_by_role" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_rights_deadline_extensions_reason_check" CHECK ("data_rights_deadline_extensions"."reason_code" in
    ('request_complexity','exceptional_volume','legal_retention_review','third_party_dependency','service_disruption_recovery')),
	CONSTRAINT "data_rights_deadline_extensions_reference_check" CHECK ("data_rights_deadline_extensions"."case_reference" ~ '^[A-Za-z0-9._:-]{1,128}$'),
	CONSTRAINT "data_rights_deadline_extensions_approval_check" CHECK (
    "data_rights_deadline_extensions"."source_request_revision" > 0 and "data_rights_deadline_extensions"."source_review_revision" in (1,2)
    and "data_rights_deadline_extensions"."approved_by_role" = 'cuac_admin'
    and isfinite("data_rights_deadline_extensions"."original_response_due_at") and isfinite("data_rights_deadline_extensions"."extended_due_at") and isfinite("data_rights_deadline_extensions"."approved_at")
    and "data_rights_deadline_extensions"."approved_at" < "data_rights_deadline_extensions"."original_response_due_at"
    and "data_rights_deadline_extensions"."extended_due_at" > "data_rights_deadline_extensions"."original_response_due_at"
    and "data_rights_deadline_extensions"."extended_due_at" <= "data_rights_deadline_extensions"."original_response_due_at" + interval '60 days'
    and isfinite("data_rights_deadline_extensions"."created_at") and isfinite("data_rights_deadline_extensions"."updated_at") and "data_rights_deadline_extensions"."updated_at" >= "data_rights_deadline_extensions"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_requests_id_response_due_unique" ON "data_rights_requests" USING btree ("id","response_due_at");--> statement-breakpoint
ALTER TABLE "data_rights_deadline_extensions" ADD CONSTRAINT "data_rights_deadline_extensions_review_id_ops_data_rights_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."ops_data_rights_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_rights_deadline_extensions" ADD CONSTRAINT "data_rights_deadline_extensions_request_deadline_fk" FOREIGN KEY ("data_rights_request_id","original_response_due_at") REFERENCES "public"."data_rights_requests"("id","response_due_at") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_rights_deadline_extensions" ADD CONSTRAINT "data_rights_deadline_extensions_approved_grant_scope_fk" FOREIGN KEY ("approved_by_grant_id","approved_by_user_id","approved_by_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_deadline_extensions_request_unique" ON "data_rights_deadline_extensions" USING btree ("data_rights_request_id");--> statement-breakpoint
CREATE INDEX "data_rights_deadline_extensions_approved_at_idx" ON "data_rights_deadline_extensions" USING btree ("approved_at","id");
