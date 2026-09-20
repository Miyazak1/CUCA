CREATE TABLE "school_program_intake_publications" (
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"intake_term" text NOT NULL,
	"intake_year" integer NOT NULL,
	"version_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"published_by_user_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_by_user_id" uuid,
	"withdrawn_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_program_intake_publications_pk" PRIMARY KEY("program_id","intake_term","intake_year"),
	CONSTRAINT "school_program_intake_publications_state_check" CHECK ("school_program_intake_publications"."status" in ('active','withdrawn')
      and "school_program_intake_publications"."revision" > 0
      and (("school_program_intake_publications"."status" = 'active' and "school_program_intake_publications"."withdrawn_by_user_id" is null and "school_program_intake_publications"."withdrawn_at" is null)
        or ("school_program_intake_publications"."status" = 'withdrawn' and "school_program_intake_publications"."withdrawn_by_user_id" is not null and "school_program_intake_publications"."withdrawn_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "school_program_intake_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"intake_term" text NOT NULL,
	"intake_year" integer NOT NULL,
	"version" integer NOT NULL,
	"open_date" timestamp with time zone,
	"deadline_date" timestamp with time zone,
	"deadline_label" text,
	"application_round" text,
	"source_url" text NOT NULL,
	"source_label" text,
	"change_note" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_program_intake_versions_state_check" CHECK ("school_program_intake_versions"."status" in ('draft','published','superseded','withdrawn')
      and "school_program_intake_versions"."intake_term" in ('spring','summer','fall','winter')
      and "school_program_intake_versions"."intake_year" between 2000 and 2200 and "school_program_intake_versions"."version" > 0
      and ("school_program_intake_versions"."open_date" is null or "school_program_intake_versions"."deadline_date" is null or "school_program_intake_versions"."open_date" < "school_program_intake_versions"."deadline_date")
      and "school_program_intake_versions"."source_url" ~ '^https://[^[:space:]]+$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "school_program_intake_versions_id_scope_unique" ON "school_program_intake_versions" USING btree ("id","school_id","program_id","intake_term","intake_year");--> statement-breakpoint
ALTER TABLE "school_program_intake_publications" ADD CONSTRAINT "school_program_intake_publications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_publications" ADD CONSTRAINT "school_program_intake_publications_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_publications" ADD CONSTRAINT "school_program_intake_publications_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_publications" ADD CONSTRAINT "school_program_intake_publications_withdrawn_by_user_id_users_id_fk" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_publications" ADD CONSTRAINT "school_program_intake_publications_version_scope_fk" FOREIGN KEY ("version_id","school_id","program_id","intake_term","intake_year") REFERENCES "public"."school_program_intake_versions"("id","school_id","program_id","intake_term","intake_year") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_versions" ADD CONSTRAINT "school_program_intake_versions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_versions" ADD CONSTRAINT "school_program_intake_versions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_program_intake_versions" ADD CONSTRAINT "school_program_intake_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "school_program_intake_publications_school_status_idx" ON "school_program_intake_publications" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "school_program_intake_versions_scope_version_unique" ON "school_program_intake_versions" USING btree ("program_id","intake_term","intake_year","version");--> statement-breakpoint
CREATE UNIQUE INDEX "school_program_intake_versions_one_draft_unique" ON "school_program_intake_versions" USING btree ("program_id","intake_term","intake_year") WHERE "school_program_intake_versions"."status" = 'draft';--> statement-breakpoint
CREATE INDEX "school_program_intake_versions_school_updated_idx" ON "school_program_intake_versions" USING btree ("school_id","updated_at");
