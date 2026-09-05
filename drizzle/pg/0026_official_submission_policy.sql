CREATE TABLE "official_submission_policy_publications" (
	"program_intake_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"admission_route_key" text NOT NULL,
	"version_id" uuid NOT NULL,
	"document_sha256" text NOT NULL,
	"target_set_sha256" text NOT NULL,
	"approval_sha256" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_submission_policy_publications_pk" PRIMARY KEY("program_intake_id","admission_route_key"),
	CONSTRAINT "official_submission_policy_publication_digest_check" CHECK ("official_submission_policy_publications"."document_sha256" ~ '^[a-f0-9]{64}$'
    and "official_submission_policy_publications"."target_set_sha256" ~ '^[a-f0-9]{64}$' and "official_submission_policy_publications"."approval_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "official_submission_policy_publication_state_check" CHECK ("official_submission_policy_publications"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
    and "official_submission_policy_publications"."revision" > 0 and "official_submission_policy_publications"."status" in ('active','withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "official_submission_policy_version_targets" (
	"policy_version_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"admission_route_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_submission_policy_version_targets_pk" PRIMARY KEY("policy_version_id","program_intake_id"),
	CONSTRAINT "official_submission_policy_target_route_check" CHECK ("official_submission_policy_version_targets"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "official_submission_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"policy_key" text NOT NULL,
	"admission_route_key" text NOT NULL,
	"version" integer NOT NULL,
	"form_mode" text NOT NULL,
	"max_program_choices" integer NOT NULL,
	"ordering_mode" text NOT NULL,
	"external_channel_type" text NOT NULL,
	"document_json" jsonb NOT NULL,
	"document_sha256" text NOT NULL,
	"target_set_sha256" text NOT NULL,
	"prepared_by_user_id" uuid NOT NULL,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"approved_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"effective_from" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"review_evidence_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_submission_policy_scope_check" CHECK ("official_submission_policy_versions"."policy_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
    and "official_submission_policy_versions"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$' and "official_submission_policy_versions"."version" > 0),
	CONSTRAINT "official_submission_policy_rule_check" CHECK ("official_submission_policy_versions"."form_mode" in ('one_program_per_form','multi_program_form')
    and "official_submission_policy_versions"."max_program_choices" between 1 and 20 and "official_submission_policy_versions"."ordering_mode" in ('none','ranked')
    and "official_submission_policy_versions"."external_channel_type" in ('university_portal','approved_manual_handoff')),
	CONSTRAINT "official_submission_policy_digest_check" CHECK ("official_submission_policy_versions"."document_sha256" ~ '^[a-f0-9]{64}$'
    and "official_submission_policy_versions"."target_set_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "official_submission_policy_document_check" CHECK (jsonb_typeof("official_submission_policy_versions"."document_json") = 'object'
    and octet_length("official_submission_policy_versions"."document_json"::text) <= 65536
    and "official_submission_policy_versions"."document_json" ?& array['schemaVersion','admissionRouteKey','formMode','maxProgramChoices','orderingMode','externalChannelType','sources']
    and "official_submission_policy_versions"."document_json" - array['schemaVersion','admissionRouteKey','formMode','maxProgramChoices','orderingMode','externalChannelType','sources'] = '{}'::jsonb
    and "official_submission_policy_versions"."document_json"->'schemaVersion' = '1'::jsonb
    and "official_submission_policy_versions"."document_json"->>'admissionRouteKey' = "official_submission_policy_versions"."admission_route_key"
    and "official_submission_policy_versions"."document_json"->>'formMode' = "official_submission_policy_versions"."form_mode"
    and "official_submission_policy_versions"."document_json"->>'maxProgramChoices' = "official_submission_policy_versions"."max_program_choices"::text
    and "official_submission_policy_versions"."document_json"->>'orderingMode' = "official_submission_policy_versions"."ordering_mode"
    and "official_submission_policy_versions"."document_json"->>'externalChannelType' = "official_submission_policy_versions"."external_channel_type"
    and jsonb_typeof("official_submission_policy_versions"."document_json"->'sources') = 'array'
    and jsonb_array_length("official_submission_policy_versions"."document_json"->'sources') between 1 and 12),
	CONSTRAINT "official_submission_policy_review_check" CHECK (("official_submission_policy_versions"."review_status" = 'draft'
      and "official_submission_policy_versions"."approved_by_user_id" is null and "official_submission_policy_versions"."reviewed_at" is null and "official_submission_policy_versions"."effective_from" is null
      and "official_submission_policy_versions"."review_due_at" is null and "official_submission_policy_versions"."review_evidence_json" is null)
    or ("official_submission_policy_versions"."review_status" = 'approved' and "official_submission_policy_versions"."approved_by_user_id" is not null
      and "official_submission_policy_versions"."approved_by_user_id" <> "official_submission_policy_versions"."prepared_by_user_id" and "official_submission_policy_versions"."reviewed_at" is not null
      and "official_submission_policy_versions"."effective_from" is not null and "official_submission_policy_versions"."review_due_at" is not null and "official_submission_policy_versions"."review_evidence_json" is not null
      and "official_submission_policy_versions"."created_at" <= "official_submission_policy_versions"."reviewed_at" and "official_submission_policy_versions"."reviewed_at" <= "official_submission_policy_versions"."effective_from"
      and "official_submission_policy_versions"."effective_from" < "official_submission_policy_versions"."review_due_at" and jsonb_typeof("official_submission_policy_versions"."review_evidence_json") = 'object'
      and octet_length("official_submission_policy_versions"."review_evidence_json"::text) <= 16384))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_policy_id_scope_unique" ON "official_submission_policy_versions" USING btree ("id","school_id","admission_route_key");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_policy_target_publication_unique" ON "official_submission_policy_version_targets" USING btree ("policy_version_id","program_intake_id","program_id","school_id","admission_route_key");--> statement-breakpoint
ALTER TABLE "official_submission_policy_publications" ADD CONSTRAINT "official_submission_policy_publication_target_fk" FOREIGN KEY ("version_id","program_intake_id","program_id","school_id","admission_route_key") REFERENCES "public"."official_submission_policy_version_targets"("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_policy_version_targets" ADD CONSTRAINT "official_submission_policy_target_version_scope_fk" FOREIGN KEY ("policy_version_id","school_id","admission_route_key") REFERENCES "public"."official_submission_policy_versions"("id","school_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_policy_version_targets" ADD CONSTRAINT "official_submission_policy_target_program_school_fk" FOREIGN KEY ("program_id","school_id") REFERENCES "public"."programs"("id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_policy_version_targets" ADD CONSTRAINT "official_submission_policy_target_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_policy_versions" ADD CONSTRAINT "official_submission_policy_version_school_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_policy_versions" ADD CONSTRAINT "official_submission_policy_version_preparer_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_policy_versions" ADD CONSTRAINT "official_submission_policy_version_reviewer_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "official_submission_policy_publication_school_route_status_idx" ON "official_submission_policy_publications" USING btree ("school_id","admission_route_key","status");--> statement-breakpoint
CREATE INDEX "official_submission_policy_target_intake_route_idx" ON "official_submission_policy_version_targets" USING btree ("program_intake_id","admission_route_key");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_policy_scope_version_unique" ON "official_submission_policy_versions" USING btree ("school_id","policy_key","admission_route_key","version");--> statement-breakpoint
