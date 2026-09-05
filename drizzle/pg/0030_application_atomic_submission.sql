CREATE TABLE "application_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_set_id" uuid NOT NULL,
	"submission_format" text DEFAULT 'cuac.application-submission.v1' NOT NULL,
	"source_set_revision" integer NOT NULL,
	"choice_count" integer NOT NULL,
	"group_count" integer NOT NULL,
	"manifest_sha256" text NOT NULL,
	"confirmation_method" text DEFAULT 'authenticated_explicit_action' NOT NULL,
	"confirmed_request_id" text NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_submissions_format_check" CHECK ("application_submissions"."submission_format" = 'cuac.application-submission.v1'
    and "application_submissions"."confirmation_method" = 'authenticated_explicit_action'
    and char_length("application_submissions"."confirmed_request_id") between 1 and 128),
	CONSTRAINT "application_submissions_count_check" CHECK ("application_submissions"."source_set_revision" > 0
    and "application_submissions"."choice_count" between 1 and 20 and "application_submissions"."group_count" between 1 and "application_submissions"."choice_count"),
	CONSTRAINT "application_submissions_manifest_check" CHECK ("application_submissions"."manifest_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "application_submissions_lifecycle_check" CHECK ("application_submissions"."status" = 'accepted'
    and "application_submissions"."created_at" <= "application_submissions"."submitted_at")
);
--> statement-breakpoint
CREATE TABLE "official_submission_group_members" (
	"group_id" uuid NOT NULL,
	"application_submission_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"application_set_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"admission_route_key" text NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"school_application_id" uuid NOT NULL,
	"application_choice_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"authorization_id" uuid NOT NULL,
	"material_snapshot_id" uuid NOT NULL,
	"fee_entitlement_id" uuid NOT NULL,
	"member_position" integer NOT NULL,
	"member_manifest_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_submission_group_members_pk" PRIMARY KEY("group_id","member_position"),
	CONSTRAINT "official_submission_group_members_position_check" CHECK ("official_submission_group_members"."member_position" > 0
    and "official_submission_group_members"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
    and "official_submission_group_members"."member_manifest_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "official_submission_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_submission_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"application_set_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"group_format" text DEFAULT 'cuac.official-submission-group.v1' NOT NULL,
	"admission_route_key" text NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"policy_document_sha256" text NOT NULL,
	"policy_target_set_sha256" text NOT NULL,
	"policy_approval_sha256" text NOT NULL,
	"form_mode" text NOT NULL,
	"max_program_choices" integer NOT NULL,
	"ordering_mode" text NOT NULL,
	"external_channel_type" text NOT NULL,
	"group_sequence" integer NOT NULL,
	"member_count" integer NOT NULL,
	"member_manifest_sha256" text NOT NULL,
	"transport_status" text DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_submission_groups_format_check" CHECK ("official_submission_groups"."group_format" = 'cuac.official-submission-group.v1'
    and "official_submission_groups"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
    and "official_submission_groups"."policy_document_sha256" ~ '^[a-f0-9]{64}$'
    and "official_submission_groups"."policy_target_set_sha256" ~ '^[a-f0-9]{64}$'
    and "official_submission_groups"."policy_approval_sha256" ~ '^[a-f0-9]{64}$'
    and "official_submission_groups"."member_manifest_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "official_submission_groups_rule_check" CHECK ("official_submission_groups"."form_mode" in ('one_program_per_form','multi_program_form')
    and "official_submission_groups"."max_program_choices" between 1 and 20 and "official_submission_groups"."ordering_mode" in ('none','ranked')
    and "official_submission_groups"."external_channel_type" in ('university_portal','approved_manual_handoff')
    and "official_submission_groups"."group_sequence" > 0 and "official_submission_groups"."member_count" between 1 and "official_submission_groups"."max_program_choices"
    and ("official_submission_groups"."form_mode" = 'multi_program_form' or "official_submission_groups"."member_count" = 1)),
	CONSTRAINT "official_submission_groups_state_check" CHECK ("official_submission_groups"."transport_status" in ('pending','leased','dispatched','quarantined')
    and "official_submission_groups"."created_at" <= "official_submission_groups"."accepted_at")
);
--> statement-breakpoint
CREATE TABLE "official_submission_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"application_submission_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"event_type" text DEFAULT 'official_submission.dispatch_requested' NOT NULL,
	"payload_format" text DEFAULT 'cuac.official-submission-dispatch.v1' NOT NULL,
	"manifest_sha256" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"lease_token" uuid,
	"leased_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" text,
	"dispatched_at" timestamp with time zone,
	"quarantined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_submission_outbox_format_check" CHECK ("official_submission_outbox"."event_type" = 'official_submission.dispatch_requested'
    and "official_submission_outbox"."payload_format" = 'cuac.official-submission-dispatch.v1'
    and "official_submission_outbox"."manifest_sha256" ~ '^[a-f0-9]{64}$' and "official_submission_outbox"."attempt_count" between 0 and 100
    and ("official_submission_outbox"."last_error_code" is null or "official_submission_outbox"."last_error_code" ~ '^[A-Z0-9_]{1,64}$')),
	CONSTRAINT "official_submission_outbox_lifecycle_check" CHECK ((
      "official_submission_outbox"."status" = 'pending' and "official_submission_outbox"."lease_token" is null and "official_submission_outbox"."leased_at" is null
      and "official_submission_outbox"."lease_expires_at" is null and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is null
    ) or (
      "official_submission_outbox"."status" = 'leased' and "official_submission_outbox"."lease_token" is not null and "official_submission_outbox"."leased_at" is not null
      and "official_submission_outbox"."lease_expires_at" is not null and "official_submission_outbox"."leased_at" < "official_submission_outbox"."lease_expires_at"
      and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is null
    ) or (
      "official_submission_outbox"."status" = 'dispatched' and "official_submission_outbox"."lease_token" is null and "official_submission_outbox"."leased_at" is null
      and "official_submission_outbox"."lease_expires_at" is null and "official_submission_outbox"."dispatched_at" is not null and "official_submission_outbox"."quarantined_at" is null
    ) or (
      "official_submission_outbox"."status" = 'quarantined' and "official_submission_outbox"."lease_token" is null and "official_submission_outbox"."leased_at" is null
      and "official_submission_outbox"."lease_expires_at" is null and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is not null
    ))
);
--> statement-breakpoint
ALTER TABLE "student_application_command_receipts" DROP CONSTRAINT "student_application_commands_operation_check";--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "application_record_format" text DEFAULT 'cuac.program-application.v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "application_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "admission_route_key" text;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "authorization_id" uuid;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "material_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "fee_entitlement_id" uuid;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "requirement_version_id" uuid;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "requirement_publication_revision" integer;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "requirement_content_sha256" text;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "policy_version_id" uuid;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "policy_publication_revision" integer;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "policy_document_sha256" text;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "policy_target_set_sha256" text;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "policy_approval_sha256" text;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "application_submissions_set_unique" ON "application_submissions" USING btree ("application_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_submissions_scope_unique" ON "application_submissions" USING btree ("id","user_id","application_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_fee_entitlements_submission_scope_unique" ON "application_fee_entitlements" USING btree ("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key");--> statement-breakpoint
CREATE UNIQUE INDEX "application_material_snapshot_submission_scope_unique" ON "application_material_snapshots" USING btree ("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","authorization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_applications_submission_evidence_unique" ON "school_applications" USING btree ("id","application_submission_id","student_user_id","application_set_id","school_id","program_id","program_intake_id","admission_route_key","policy_version_id","application_choice_id","authorization_id","material_snapshot_id","fee_entitlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_groups_sequence_unique" ON "official_submission_groups" USING btree ("application_submission_id","group_sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_groups_scope_unique" ON "official_submission_groups" USING btree ("id","application_submission_id","user_id","application_set_id","school_id","admission_route_key","policy_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_groups_dispatch_scope_unique" ON "official_submission_groups" USING btree ("id","application_submission_id","school_id");--> statement-breakpoint
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_set_owner_fk" FOREIGN KEY ("application_set_id","user_id") REFERENCES "public"."application_sets"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_group_members" ADD CONSTRAINT "official_submission_group_members_group_scope_fk" FOREIGN KEY ("group_id","application_submission_id","user_id","application_set_id","school_id","admission_route_key","policy_version_id") REFERENCES "public"."official_submission_groups"("id","application_submission_id","user_id","application_set_id","school_id","admission_route_key","policy_version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_group_members" ADD CONSTRAINT "official_submission_group_members_application_evidence_fk" FOREIGN KEY ("school_application_id","application_submission_id","user_id","application_set_id","school_id","program_id","program_intake_id","admission_route_key","policy_version_id","application_choice_id","authorization_id","material_snapshot_id","fee_entitlement_id") REFERENCES "public"."school_applications"("id","application_submission_id","student_user_id","application_set_id","school_id","program_id","program_intake_id","admission_route_key","policy_version_id","application_choice_id","authorization_id","material_snapshot_id","fee_entitlement_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_group_members" ADD CONSTRAINT "official_submission_group_members_policy_target_fk" FOREIGN KEY ("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") REFERENCES "public"."official_submission_policy_version_targets"("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_groups" ADD CONSTRAINT "official_submission_groups_submission_scope_fk" FOREIGN KEY ("application_submission_id","user_id","application_set_id") REFERENCES "public"."application_submissions"("id","user_id","application_set_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_groups" ADD CONSTRAINT "official_submission_groups_school_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_groups" ADD CONSTRAINT "official_submission_groups_policy_scope_fk" FOREIGN KEY ("policy_version_id","school_id","admission_route_key") REFERENCES "public"."official_submission_policy_versions"("id","school_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD CONSTRAINT "official_submission_outbox_group_fk" FOREIGN KEY ("group_id","application_submission_id","school_id") REFERENCES "public"."official_submission_groups"("id","application_submission_id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_group_members_application_unique" ON "official_submission_group_members" USING btree ("school_application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_outbox_group_unique" ON "official_submission_outbox" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "official_submission_outbox_pending_idx" ON "official_submission_outbox" USING btree ("status","available_at","id");--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_submission_scope_fk" FOREIGN KEY ("application_submission_id","student_user_id","application_set_id") REFERENCES "public"."application_submissions"("id","user_id","application_set_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_authorization_scope_fk" FOREIGN KEY ("authorization_id","student_user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id") REFERENCES "public"."application_submission_authorizations"("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_snapshot_scope_fk" FOREIGN KEY ("material_snapshot_id","student_user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","authorization_id") REFERENCES "public"."application_material_snapshots"("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","authorization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_entitlement_scope_fk" FOREIGN KEY ("fee_entitlement_id","student_user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key") REFERENCES "public"."application_fee_entitlements"("id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_requirement_scope_fk" FOREIGN KEY ("requirement_version_id","program_intake_id") REFERENCES "public"."program_requirement_versions"("id","program_intake_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_policy_target_fk" FOREIGN KEY ("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") REFERENCES "public"."official_submission_policy_version_targets"("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_format_check" CHECK ((
        "school_applications"."application_record_format" = 'cuac.program-application.v1'
        and "school_applications"."application_submission_id" is null and "school_applications"."admission_route_key" is null
        and "school_applications"."authorization_id" is null and "school_applications"."material_snapshot_id" is null
        and "school_applications"."fee_entitlement_id" is null and "school_applications"."requirement_version_id" is null
        and "school_applications"."requirement_publication_revision" is null and "school_applications"."requirement_content_sha256" is null
        and "school_applications"."policy_version_id" is null and "school_applications"."policy_publication_revision" is null
        and "school_applications"."policy_document_sha256" is null and "school_applications"."policy_target_set_sha256" is null
        and "school_applications"."policy_approval_sha256" is null and "school_applications"."accepted_at" is null
      ) or (
        "school_applications"."application_record_format" = 'cuac.program-application.v2'
        and "school_applications"."application_submission_id" is not null and "school_applications"."program_id" is not null
        and "school_applications"."program_intake_id" is not null and "school_applications"."admission_route_key" is not null
        and "school_applications"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
        and "school_applications"."authorization_id" is not null and "school_applications"."material_snapshot_id" is not null
        and "school_applications"."fee_entitlement_id" is not null and "school_applications"."requirement_version_id" is not null
        and "school_applications"."requirement_publication_revision" > 0
        and "school_applications"."requirement_content_sha256" ~ '^[a-f0-9]{64}$'
        and "school_applications"."policy_version_id" is not null and "school_applications"."policy_publication_revision" > 0
        and "school_applications"."policy_document_sha256" ~ '^[a-f0-9]{64}$'
        and "school_applications"."policy_target_set_sha256" ~ '^[a-f0-9]{64}$'
        and "school_applications"."policy_approval_sha256" ~ '^[a-f0-9]{64}$'
        and "school_applications"."accepted_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "school_applications" ALTER COLUMN "application_record_format" SET DEFAULT 'cuac.program-application.v2';--> statement-breakpoint
ALTER TABLE "student_application_command_receipts" ADD CONSTRAINT "student_application_commands_operation_check" CHECK ("student_application_command_receipts"."operation" in ('application_set.create', 'application_choice.add', 'application_authorization.record', 'application_material_snapshot.create', 'application.submit'));
