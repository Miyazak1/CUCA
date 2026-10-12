CREATE TABLE "insight_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"publication_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insight_posts_status_check" CHECK ("insight_posts"."status" in ('draft','published','archived')),
	CONSTRAINT "insight_posts_revision_check" CHECK ("insight_posts"."publication_revision" between 0 and 2147483647),
	CONSTRAINT "insight_posts_slug_check" CHECK ("insight_posts"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "insight_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_json" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"prepared_by_user_id" uuid NOT NULL,
	"published_by_user_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insight_version_number_check" CHECK ("insight_versions"."version" > 0),
	CONSTRAINT "insight_version_digest_check" CHECK ("insight_versions"."content_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "insight_version_content_check" CHECK (jsonb_typeof("insight_versions"."content_json") = 'object' and octet_length("insight_versions"."content_json"::text) <= 262144),
	CONSTRAINT "insight_version_publication_check" CHECK (("insight_versions"."published_by_user_id" is null and "insight_versions"."published_at" is null)
    or ("insight_versions"."published_by_user_id" is not null and "insight_versions"."published_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "insight_versions" ADD CONSTRAINT "insight_version_post_fk" FOREIGN KEY ("post_id") REFERENCES "public"."insight_posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_versions" ADD CONSTRAINT "insight_version_preparer_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_versions" ADD CONSTRAINT "insight_version_publisher_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insight_posts_slug_unique" ON "insight_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "insight_posts_status_updated_idx" ON "insight_posts" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "insight_version_unique" ON "insight_versions" USING btree ("post_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "insight_version_id_post_unique" ON "insight_versions" USING btree ("id","post_id");--> statement-breakpoint
CREATE INDEX "insight_version_published_idx" ON "insight_versions" USING btree ("published_at","created_at");
--> statement-breakpoint
INSERT INTO "insight_posts" ("id", "slug", "status", "publication_revision") VALUES
  ('11f6df0a-4429-4a58-a6c1-b8de3b76e001', '2026-admissions-notices-what-applicants-should-track', 'published', 0),
  ('11f6df0a-4429-4a58-a6c1-b8de3b76e002', '2026-english-taught-program-lists-why-details-matter', 'published', 0),
  ('11f6df0a-4429-4a58-a6c1-b8de3b76e003', '2026-scholarship-announcements-coverage-and-timing', 'published', 0)
ON CONFLICT ("slug") DO NOTHING;
