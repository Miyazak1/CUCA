CREATE TABLE "email_verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_normalized" text NOT NULL,
	"verification_token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_verification_challenges" ADD CONSTRAINT "email_verification_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_challenges_token_hash_unique" ON "email_verification_challenges" USING btree ("verification_token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_challenges_user_status_idx" ON "email_verification_challenges" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "email_verification_challenges_email_status_idx" ON "email_verification_challenges" USING btree ("email_normalized","status");--> statement-breakpoint
CREATE INDEX "email_verification_challenges_expires_idx" ON "email_verification_challenges" USING btree ("expires_at");
