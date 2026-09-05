CREATE TABLE "application_choice_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_choice_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_set_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid,
	"scholarship_id" uuid,
	"rank_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"student_notes" text,
	"requirement_snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_intake" text,
	"submitted_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"saved_from_surface" text DEFAULT 'student' NOT NULL,
	"notes" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "school_application_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_application_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_set_id" uuid NOT NULL,
	"application_choice_id" uuid NOT NULL,
	"student_user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid,
	"status" text DEFAULT 'pending_submission' NOT NULL,
	"school_visible_profile_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"routing_metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"first_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"citizenship_country" text,
	"target_degree_level" text,
	"target_intake" text,
	"preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_completion_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent_summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_choice_status_events" ADD CONSTRAINT "application_choice_status_events_application_choice_id_application_choices_id_fk" FOREIGN KEY ("application_choice_id") REFERENCES "public"."application_choices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_choice_status_events" ADD CONSTRAINT "application_choice_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_sets" ADD CONSTRAINT "application_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD CONSTRAINT "school_application_status_events_school_application_id_school_applications_id_fk" FOREIGN KEY ("school_application_id") REFERENCES "public"."school_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD CONSTRAINT "school_application_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_application_choice_id_application_choices_id_fk" FOREIGN KEY ("application_choice_id") REFERENCES "public"."application_choices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_choice_status_events_choice_created_idx" ON "application_choice_status_events" USING btree ("application_choice_id","created_at");--> statement-breakpoint
CREATE INDEX "application_choices_set_rank_idx" ON "application_choices" USING btree ("application_set_id","rank_order");--> statement-breakpoint
CREATE INDEX "application_choices_user_status_idx" ON "application_choices" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "application_choices_active_set_program_unique" ON "application_choices" USING btree ("application_set_id","program_id") WHERE "application_choices"."removed_at" is null and "application_choices"."program_id" is not null;--> statement-breakpoint
CREATE INDEX "application_sets_user_status_idx" ON "application_sets" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_active_user_entity_unique" ON "saved_items" USING btree ("user_id","entity_type","entity_id") WHERE "saved_items"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "saved_items_user_entity_idx" ON "saved_items" USING btree ("user_id","entity_type");--> statement-breakpoint
CREATE INDEX "school_application_status_events_application_created_idx" ON "school_application_status_events" USING btree ("school_application_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "school_applications_choice_unique" ON "school_applications" USING btree ("application_choice_id");--> statement-breakpoint
CREATE INDEX "school_applications_school_status_idx" ON "school_applications" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "school_applications_student_status_idx" ON "school_applications" USING btree ("student_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_user_unique" ON "student_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_profiles_target_degree_idx" ON "student_profiles" USING btree ("target_degree_level");