CREATE TABLE "guide_publications" (
	"guide_id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"content_sha256" text NOT NULL,
	"approval_sha256" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_publication_digest_check" CHECK ("guide_publications"."content_sha256" ~ '^[a-f0-9]{64}$' and "guide_publications"."approval_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "guide_publication_revision_check" CHECK ("guide_publications"."revision" > 0),
	CONSTRAINT "guide_publication_status_check" CHECK ("guide_publications"."status" in ('active','withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "guide_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_json" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"prepared_by_user_id" uuid NOT NULL,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"approved_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"effective_from" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"review_evidence_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_version_number_check" CHECK ("guide_versions"."version" > 0),
	CONSTRAINT "guide_version_digest_check" CHECK ("guide_versions"."content_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "guide_version_content_check" CHECK (jsonb_typeof("guide_versions"."content_json") = 'object' and octet_length("guide_versions"."content_json"::text) <= 131072),
	CONSTRAINT "guide_version_review_check" CHECK (("guide_versions"."review_status" = 'draft' and "guide_versions"."approved_by_user_id" is null and "guide_versions"."reviewed_at" is null and "guide_versions"."effective_from" is null and "guide_versions"."review_due_at" is null and "guide_versions"."review_evidence_json" is null)
    or ("guide_versions"."review_status" = 'approved' and "guide_versions"."approved_by_user_id" is not null and "guide_versions"."approved_by_user_id" <> "guide_versions"."prepared_by_user_id"
      and "guide_versions"."reviewed_at" is not null and "guide_versions"."effective_from" is not null and "guide_versions"."review_due_at" is not null
      and "guide_versions"."created_at" <= "guide_versions"."reviewed_at" and "guide_versions"."reviewed_at" <= "guide_versions"."effective_from" and "guide_versions"."effective_from" < "guide_versions"."review_due_at"
      and "guide_versions"."review_evidence_json" is not null and jsonb_typeof("guide_versions"."review_evidence_json") = 'object' and octet_length("guide_versions"."review_evidence_json"::text) <= 16384))
);
--> statement-breakpoint
ALTER TABLE "public_guides" ADD COLUMN "content_json" jsonb DEFAULT '{"sections":[]}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "guide_version_unique" ON "guide_versions" USING btree ("guide_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "guide_version_id_guide_unique" ON "guide_versions" USING btree ("id","guide_id");--> statement-breakpoint
CREATE INDEX "guide_version_review_idx" ON "guide_versions" USING btree ("review_status","created_at");--> statement-breakpoint
ALTER TABLE "guide_publications" ADD CONSTRAINT "guide_publication_version_fk" FOREIGN KEY ("version_id","guide_id") REFERENCES "public"."guide_versions"("id","guide_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_version_guide_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."public_guides"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_version_preparer_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_version_reviewer_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
