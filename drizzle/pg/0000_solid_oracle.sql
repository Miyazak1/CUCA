CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"active_role" text,
	"tenant_school_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"allowed" boolean NOT NULL,
	"policy_decision_id" text,
	"data_classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"redaction_applied" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text,
	"password_hash" text,
	"email_normalized" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"selected_surface" text DEFAULT 'student' NOT NULL,
	"active_role" text DEFAULT 'student' NOT NULL,
	"tenant_school_id" uuid,
	"auth_strength" text DEFAULT 'session' NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "catalog_source_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_url" text,
	"source_label" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_by_user_id" uuid,
	"evidence_note" text,
	"checksum" text,
	"source_field_lineage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_zh" text,
	"name_en" text NOT NULL,
	"region" text,
	"province" text,
	"monthly_cost" text,
	"monthly_cost_rmb" integer,
	"cost_level" text,
	"density" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"nearby" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reference_school_count" integer DEFAULT 0 NOT NULL,
	"reference_program_count" integer DEFAULT 0 NOT NULL,
	"reference_english_program_count" integer DEFAULT 0 NOT NULL,
	"reference_scholarship_count" integer DEFAULT 0 NOT NULL,
	"reference_csca_school_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"source_url" text,
	"source_label" text,
	"source_note" text,
	"source_field_lineage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuac_staff_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"requested_surface" text DEFAULT 'cuac_internal' NOT NULL,
	"requested_role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token_hash" text,
	"requested_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"reason" text,
	"expires_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"intake_term" text NOT NULL,
	"intake_year" integer NOT NULL,
	"open_date" timestamp with time zone,
	"deadline_date" timestamp with time zone,
	"deadline_label" text,
	"application_round" text,
	"status" text DEFAULT 'open' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_scholarships" (
	"program_id" uuid NOT NULL,
	"scholarship_id" uuid NOT NULL,
	"eligibility_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_scholarships_program_id_scholarship_id_pk" PRIMARY KEY("program_id","scholarship_id")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"city_id" uuid,
	"slug" text NOT NULL,
	"name_zh" text,
	"name_en" text NOT NULL,
	"degree_level" text NOT NULL,
	"duration_years" integer,
	"duration_months" integer,
	"field_category" text,
	"subject_area" text,
	"teaching_language" text,
	"csca_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"csca_requirement" text,
	"hsk_requirement" text,
	"english_requirement" text,
	"tuition_amount" integer,
	"tuition_currency" text,
	"tuition_period" text,
	"tuition_text" text,
	"scholarship_text" text,
	"application_url" text,
	"application_note" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"has_scholarship" boolean DEFAULT false NOT NULL,
	"badge_text" text,
	"display_tuition" text,
	"display_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"display_group" text,
	"display_group_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"source_url" text,
	"source_label" text,
	"source_note" text,
	"source_field_lineage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"name_zh" text,
	"type" text,
	"type_label" text,
	"funding_level" text,
	"provider_name" text,
	"provider_name_en" text,
	"provider_location" text,
	"school_id" uuid,
	"program_id" uuid,
	"coverage" text,
	"applicable_degree" text,
	"applicable_program" text,
	"amount_text" text,
	"requirement_text" text,
	"body_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefit_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"eligibility_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"application_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"application_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deadline_date" timestamp with time zone,
	"deadline_label" text,
	"application_round" text,
	"target_countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"source_url" text,
	"source_label" text,
	"source_note" text,
	"source_field_lineage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_staff_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" uuid,
	"accepted_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_staff_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_zh" text,
	"name_en" text NOT NULL,
	"school_type" text,
	"region" text,
	"city_id" uuid,
	"city" text,
	"city_zh" text,
	"city_slug" text,
	"province" text,
	"region_label" text,
	"ranking" text,
	"csca_required" boolean DEFAULT false NOT NULL,
	"csca_requirement" text,
	"csca_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"application_level" text,
	"language_of_instruction" text,
	"language_requirement" text,
	"hsk_requirement" text,
	"english_requirement" text,
	"deadline_summary" text,
	"tuition_summary" text,
	"application_fee" text,
	"website_url" text,
	"admissions_url" text,
	"subject_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fit_notes" text,
	"language_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tuition_band_label" text,
	"campus_highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_notes" text,
	"quality_score" integer,
	"missing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completeness_label" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"source_url" text,
	"source_label" text,
	"source_note" text,
	"source_field_lineage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_in_continuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"continuation_token_hash" text NOT NULL,
	"guest_session_id" text,
	"target_route" text NOT NULL,
	"action_key" text NOT NULL,
	"required_role" text,
	"tenant_school_id" uuid,
	"payload_preview_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"device_fingerprint_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_by_user_id" uuid,
	"grant_source" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" text,
	"account_status" text DEFAULT 'active' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_source_evidence" ADD CONSTRAINT "catalog_source_evidence_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_intakes" ADD CONSTRAINT "program_intakes_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_scholarships" ADD CONSTRAINT "program_scholarships_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_scholarships" ADD CONSTRAINT "program_scholarships_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_staff_invites" ADD CONSTRAINT "school_staff_invites_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_staff_invites" ADD CONSTRAINT "school_staff_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_staff_invites" ADD CONSTRAINT "school_staff_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_staff_memberships" ADD CONSTRAINT "school_staff_memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_staff_memberships" ADD CONSTRAINT "school_staff_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_staff_memberships" ADD CONSTRAINT "school_staff_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_in_continuations" ADD CONSTRAINT "sign_in_continuations_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_in_continuations" ADD CONSTRAINT "sign_in_continuations_consumed_by_user_id_users_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_request_idx" ON "audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs" USING btree ("tenant_school_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_unique" ON "auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "auth_identities_user_provider_idx" ON "auth_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_hash_unique" ON "auth_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_expires_idx" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_tenant_school_idx" ON "auth_sessions" USING btree ("tenant_school_id");--> statement-breakpoint
CREATE INDEX "catalog_source_evidence_entity_idx" ON "catalog_source_evidence" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "catalog_source_evidence_captured_at_idx" ON "catalog_source_evidence" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_unique" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_status_idx" ON "cities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cities_region_idx" ON "cities" USING btree ("region");--> statement-breakpoint
CREATE INDEX "cuac_staff_access_grants_email_status_idx" ON "cuac_staff_access_grants" USING btree ("email_normalized","status");--> statement-breakpoint
CREATE INDEX "cuac_staff_access_grants_user_status_idx" ON "cuac_staff_access_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "program_intakes_program_term_year_unique" ON "program_intakes" USING btree ("program_id","intake_term","intake_year");--> statement-breakpoint
CREATE INDEX "program_intakes_deadline_idx" ON "program_intakes" USING btree ("deadline_date");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_unique" ON "programs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "programs_school_idx" ON "programs" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "programs_city_idx" ON "programs" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "programs_degree_status_idx" ON "programs" USING btree ("degree_level","status");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarships_slug_unique" ON "scholarships" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scholarships_school_idx" ON "scholarships" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "scholarships_program_idx" ON "scholarships" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "scholarships_status_idx" ON "scholarships" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "school_staff_invites_token_hash_unique" ON "school_staff_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "school_staff_invites_school_status_idx" ON "school_staff_invites" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "school_staff_invites_email_status_idx" ON "school_staff_invites" USING btree ("email_normalized","status");--> statement-breakpoint
CREATE UNIQUE INDEX "school_staff_memberships_active_school_user_unique" ON "school_staff_memberships" USING btree ("school_id","user_id") WHERE "school_staff_memberships"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "school_staff_memberships_school_status_idx" ON "school_staff_memberships" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "school_staff_memberships_user_status_idx" ON "school_staff_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_slug_unique" ON "schools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "schools_city_idx" ON "schools" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "schools_status_idx" ON "schools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schools_verification_status_idx" ON "schools" USING btree ("verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_in_continuations_token_hash_unique" ON "sign_in_continuations" USING btree ("continuation_token_hash");--> statement-breakpoint
CREATE INDEX "sign_in_continuations_guest_session_idx" ON "sign_in_continuations" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "sign_in_continuations_expires_idx" ON "sign_in_continuations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_active_user_role_unique" ON "user_roles" USING btree ("user_id","role") WHERE "user_roles"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "user_roles_user_role_idx" ON "user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_unique" ON "users" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");