CREATE TABLE "agent_context_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anonymous_session_hash" text,
	"user_id" uuid,
	"continuation_id" uuid,
	"candidate_type" text NOT NULL,
	"context_scope" text NOT NULL,
	"active_role" text NOT NULL,
	"tenant_school_id" uuid,
	"memory_namespace" text,
	"data_class" text NOT NULL,
	"confidence" text NOT NULL,
	"summary" text NOT NULL,
	"structured_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_entity_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_memory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"memory_type" text NOT NULL,
	"context_scope" text NOT NULL,
	"active_role" text NOT NULL,
	"tenant_school_id" uuid,
	"memory_namespace" text NOT NULL,
	"data_class" text NOT NULL,
	"confidence" text NOT NULL,
	"summary" text NOT NULL,
	"structured_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"source_candidate_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_persona_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anonymous_session_hash" text,
	"selected_surface" text NOT NULL,
	"active_role" text NOT NULL,
	"context_scope" text NOT NULL,
	"tenant_school_id" uuid,
	"memory_namespace" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_context_candidates" ADD CONSTRAINT "agent_context_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_context_candidates" ADD CONSTRAINT "agent_context_candidates_continuation_id_sign_in_continuations_id_fk" FOREIGN KEY ("continuation_id") REFERENCES "public"."sign_in_continuations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_context_candidates" ADD CONSTRAINT "agent_context_candidates_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_source_candidate_id_agent_context_candidates_id_fk" FOREIGN KEY ("source_candidate_id") REFERENCES "public"."agent_context_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_persona_sessions" ADD CONSTRAINT "agent_persona_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_persona_sessions" ADD CONSTRAINT "agent_persona_sessions_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_context_candidates_user_status_idx" ON "agent_context_candidates" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "agent_context_candidates_anonymous_status_idx" ON "agent_context_candidates" USING btree ("anonymous_session_hash","status");--> statement-breakpoint
CREATE INDEX "agent_context_candidates_continuation_status_idx" ON "agent_context_candidates" USING btree ("continuation_id","status");--> statement-breakpoint
CREATE INDEX "agent_context_candidates_tenant_status_idx" ON "agent_context_candidates" USING btree ("tenant_school_id","status");--> statement-breakpoint
CREATE INDEX "agent_memory_entries_namespace_active_idx" ON "agent_memory_entries" USING btree ("memory_namespace","cleared_at");--> statement-breakpoint
CREATE INDEX "agent_memory_entries_user_scope_idx" ON "agent_memory_entries" USING btree ("user_id","context_scope");--> statement-breakpoint
CREATE INDEX "agent_memory_entries_tenant_scope_idx" ON "agent_memory_entries" USING btree ("tenant_school_id","context_scope");--> statement-breakpoint
CREATE INDEX "agent_persona_sessions_user_scope_status_idx" ON "agent_persona_sessions" USING btree ("user_id","context_scope","status");--> statement-breakpoint
CREATE INDEX "agent_persona_sessions_anonymous_status_idx" ON "agent_persona_sessions" USING btree ("anonymous_session_hash","status");--> statement-breakpoint
CREATE INDEX "agent_persona_sessions_tenant_status_idx" ON "agent_persona_sessions" USING btree ("tenant_school_id","status");
