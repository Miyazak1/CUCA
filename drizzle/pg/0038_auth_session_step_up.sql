ALTER TABLE "auth_sessions" ADD COLUMN "step_up_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "auth_sessions_step_up_expires_idx" ON "auth_sessions" USING btree ("user_id","step_up_expires_at");--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_strength_check" CHECK ("auth_sessions"."auth_strength" = 'session'
      and ("auth_sessions"."step_up_expires_at" is null or ("auth_sessions"."step_up_expires_at" > "auth_sessions"."created_at"
        and "auth_sessions"."step_up_expires_at" <= "auth_sessions"."expires_at")));