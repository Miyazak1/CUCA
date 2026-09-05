CREATE UNIQUE INDEX "cuac_staff_access_grants_id_user_role_unique" ON "cuac_staff_access_grants" USING btree ("id","user_id","requested_role");
--> statement-breakpoint
CREATE TABLE "ops_support_access_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"staff_access_grant_id" uuid NOT NULL,
	"active_role" text NOT NULL,
	"application_set_id" uuid NOT NULL,
	"cuac_id" text NOT NULL,
	"reason_code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_support_access_sessions_role_check" CHECK ("ops_support_access_sessions"."active_role" in ('cuac_ops','cuac_admin')),
	CONSTRAINT "ops_support_access_sessions_cuac_id_check" CHECK ("ops_support_access_sessions"."cuac_id" ~ '^CUAC-[0-9]{4}-[0-9]{6}$'),
	CONSTRAINT "ops_support_access_sessions_reason_check" CHECK ("ops_support_access_sessions"."reason_code" in (
      'student_inquiry','school_inquiry','payment_inquiry','delivery_investigation','incident_response'
    )),
	CONSTRAINT "ops_support_access_sessions_lifecycle_check" CHECK ("ops_support_access_sessions"."expires_at" > "ops_support_access_sessions"."created_at"
      and "ops_support_access_sessions"."expires_at" <= "ops_support_access_sessions"."created_at" + interval '15 minutes'
      and ("ops_support_access_sessions"."closed_at" is null or "ops_support_access_sessions"."closed_at" >= "ops_support_access_sessions"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "ops_support_access_sessions" ADD CONSTRAINT "ops_support_access_sessions_grant_scope_fk" FOREIGN KEY ("staff_access_grant_id","actor_user_id","active_role") REFERENCES "public"."cuac_staff_access_grants"("id","user_id","requested_role") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_support_access_sessions" ADD CONSTRAINT "ops_support_access_sessions_application_scope_fk" FOREIGN KEY ("application_set_id","cuac_id") REFERENCES "public"."application_sets"("id","cuac_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_support_access_sessions_actor_expiry_idx" ON "ops_support_access_sessions" USING btree ("actor_user_id","expires_at","id");--> statement-breakpoint
CREATE INDEX "ops_support_access_sessions_grant_expiry_idx" ON "ops_support_access_sessions" USING btree ("staff_access_grant_id","expires_at");
