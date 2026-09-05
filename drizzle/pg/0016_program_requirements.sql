CREATE TABLE "program_requirement_publications" (
	"program_intake_id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'withdrawn' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_requirement_publication_revision_check" CHECK ("program_requirement_publications"."revision" > 0),
	CONSTRAINT "program_requirement_publication_status_check" CHECK ("program_requirement_publications"."status" in ('active', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "program_requirement_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_json" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"approved_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"effective_from" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_requirements_version_check" CHECK ("program_requirement_versions"."version" > 0),
	CONSTRAINT "program_requirements_digest_check" CHECK ("program_requirement_versions"."content_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "program_requirements_content_check" CHECK (jsonb_typeof("program_requirement_versions"."content_json") = 'object' and octet_length("program_requirement_versions"."content_json"::text) <= 131072),
	CONSTRAINT "program_requirements_review_check" CHECK (("program_requirement_versions"."review_status" = 'draft' and "program_requirement_versions"."approved_by_user_id" is null and "program_requirement_versions"."reviewed_at" is null and "program_requirement_versions"."effective_from" is null and "program_requirement_versions"."review_due_at" is null) or ("program_requirement_versions"."review_status" = 'approved' and "program_requirement_versions"."approved_by_user_id" is not null and "program_requirement_versions"."reviewed_at" is not null and "program_requirement_versions"."effective_from" is not null and "program_requirement_versions"."review_due_at" is not null and "program_requirement_versions"."reviewed_at" <= "program_requirement_versions"."effective_from" and "program_requirement_versions"."effective_from" < "program_requirement_versions"."review_due_at"))
);
--> statement-breakpoint
ALTER TABLE "program_requirement_versions" ADD CONSTRAINT "program_requirements_intake_fk" FOREIGN KEY ("program_intake_id") REFERENCES "public"."program_intakes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_requirement_versions" ADD CONSTRAINT "program_requirements_approver_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "program_requirements_intake_version_unique" ON "program_requirement_versions" USING btree ("program_intake_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "program_requirements_id_intake_unique" ON "program_requirement_versions" USING btree ("id","program_intake_id");--> statement-breakpoint
ALTER TABLE "program_requirement_publications" ADD CONSTRAINT "program_requirement_publication_scope_fk" FOREIGN KEY ("version_id","program_intake_id") REFERENCES "public"."program_requirement_versions"("id","program_intake_id") ON DELETE restrict ON UPDATE no action;
