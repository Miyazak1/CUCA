CREATE TABLE "auth_mfa_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_token_hash" text NOT NULL,
	"purpose" text DEFAULT 'login' NOT NULL,
	"selected_surface" text NOT NULL,
	"active_role" text NOT NULL,
	"tenant_school_id" uuid,
	"password_hash_fingerprint" text NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_mfa_challenges_state_check" CHECK ("auth_mfa_challenges"."purpose" = 'login'
      and "auth_mfa_challenges"."failed_attempts" between 0 and 8
      and "auth_mfa_challenges"."expires_at" > "auth_mfa_challenges"."created_at"
      and (("auth_mfa_challenges"."selected_surface" = 'school' and "auth_mfa_challenges"."active_role" = 'school_staff' and "auth_mfa_challenges"."tenant_school_id" is not null)
        or ("auth_mfa_challenges"."selected_surface" = 'ops' and "auth_mfa_challenges"."active_role" in ('cuac_ops', 'cuac_admin') and "auth_mfa_challenges"."tenant_school_id" is null)))
);
--> statement-breakpoint
CREATE TABLE "auth_mfa_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"factor_type" text DEFAULT 'totp' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"secret_iv" text NOT NULL,
	"secret_tag" text NOT NULL,
	"key_id" text NOT NULL,
	"last_used_counter" integer,
	"enrolled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_mfa_factors_state_check" CHECK ("auth_mfa_factors"."factor_type" = 'totp'
      and "auth_mfa_factors"."status" in ('pending', 'active', 'disabled')
      and (("auth_mfa_factors"."status" = 'pending' and "auth_mfa_factors"."enrolled_at" is null and "auth_mfa_factors"."last_used_counter" is null)
        or ("auth_mfa_factors"."status" = 'active' and "auth_mfa_factors"."enrolled_at" is not null)
        or "auth_mfa_factors"."status" = 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "auth_mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factor_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_mfa_challenges" ADD CONSTRAINT "auth_mfa_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfa_challenges" ADD CONSTRAINT "auth_mfa_challenges_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfa_factors" ADD CONSTRAINT "auth_mfa_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfa_recovery_codes" ADD CONSTRAINT "auth_mfa_recovery_codes_factor_id_auth_mfa_factors_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."auth_mfa_factors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_mfa_challenges_token_hash_unique" ON "auth_mfa_challenges" USING btree ("challenge_token_hash");--> statement-breakpoint
CREATE INDEX "auth_mfa_challenges_user_expires_idx" ON "auth_mfa_challenges" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_mfa_factors_user_unique" ON "auth_mfa_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_mfa_factors_status_idx" ON "auth_mfa_factors" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_mfa_recovery_codes_hash_unique" ON "auth_mfa_recovery_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "auth_mfa_recovery_codes_factor_available_idx" ON "auth_mfa_recovery_codes" USING btree ("factor_id","consumed_at");