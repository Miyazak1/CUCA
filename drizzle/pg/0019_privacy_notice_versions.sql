CREATE TABLE "privacy_notice_publications" (
	"scope_key" text PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"content_sha256" text NOT NULL,
	"approval_sha256" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_notice_publication_digest_check" CHECK ("privacy_notice_publications"."content_sha256" ~ '^[a-f0-9]{64}$' and "privacy_notice_publications"."approval_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "privacy_notice_publication_revision_check" CHECK ("privacy_notice_publications"."revision" > 0),
	CONSTRAINT "privacy_notice_publication_status_check" CHECK ("privacy_notice_publications"."status" in ('active', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "privacy_notice_scopes" (
	"scope_key" text PRIMARY KEY NOT NULL,
	"notice_key" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_notice_scope_check" CHECK ("privacy_notice_scopes"."notice_key" = 'application_disclosure' and "privacy_notice_scopes"."locale" in ('en', 'zh-CN') and "privacy_notice_scopes"."scope_key" = "privacy_notice_scopes"."notice_key" || ':' || "privacy_notice_scopes"."locale")
);
--> statement-breakpoint
CREATE TABLE "privacy_notice_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_key" text NOT NULL,
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
	CONSTRAINT "privacy_notice_version_check" CHECK ("privacy_notice_versions"."version" > 0),
	CONSTRAINT "privacy_notice_digest_check" CHECK ("privacy_notice_versions"."content_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "privacy_notice_content_check" CHECK (jsonb_typeof("privacy_notice_versions"."content_json") = 'object' and octet_length("privacy_notice_versions"."content_json"::text) <= 98304),
	CONSTRAINT "privacy_notice_review_check" CHECK (("privacy_notice_versions"."review_status" = 'draft' and "privacy_notice_versions"."approved_by_user_id" is null and "privacy_notice_versions"."reviewed_at" is null and "privacy_notice_versions"."effective_from" is null and "privacy_notice_versions"."review_due_at" is null and "privacy_notice_versions"."review_evidence_json" is null) or ("privacy_notice_versions"."review_status" = 'approved' and "privacy_notice_versions"."approved_by_user_id" is not null and "privacy_notice_versions"."approved_by_user_id" <> "privacy_notice_versions"."prepared_by_user_id" and "privacy_notice_versions"."reviewed_at" is not null and "privacy_notice_versions"."effective_from" is not null and "privacy_notice_versions"."review_due_at" is not null and "privacy_notice_versions"."created_at" <= "privacy_notice_versions"."reviewed_at" and "privacy_notice_versions"."reviewed_at" <= "privacy_notice_versions"."effective_from" and "privacy_notice_versions"."effective_from" < "privacy_notice_versions"."review_due_at" and "privacy_notice_versions"."review_evidence_json" is not null and jsonb_typeof("privacy_notice_versions"."review_evidence_json") = 'object' and octet_length("privacy_notice_versions"."review_evidence_json"::text) <= 8192))
);
--> statement-breakpoint
ALTER TABLE "privacy_notice_versions" ADD CONSTRAINT "privacy_notice_version_scope_fk" FOREIGN KEY ("scope_key") REFERENCES "public"."privacy_notice_scopes"("scope_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_notice_versions" ADD CONSTRAINT "privacy_notice_preparer_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_notice_versions" ADD CONSTRAINT "privacy_notice_reviewer_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_notice_scope_unique" ON "privacy_notice_scopes" USING btree ("notice_key","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_notice_version_unique" ON "privacy_notice_versions" USING btree ("scope_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_notice_id_scope_unique" ON "privacy_notice_versions" USING btree ("id","scope_key");--> statement-breakpoint
ALTER TABLE "privacy_notice_publications" ADD CONSTRAINT "privacy_notice_publication_scope_fk" FOREIGN KEY ("version_id","scope_key") REFERENCES "public"."privacy_notice_versions"("id","scope_key") ON DELETE restrict ON UPDATE no action;
