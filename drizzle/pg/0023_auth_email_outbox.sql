CREATE TABLE "auth_email_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"message_type" text NOT NULL,
	"verification_challenge_id" uuid,
	"reset_challenge_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"envelope_json" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" uuid,
	"lease_expires_at" timestamp with time zone,
	"outcome" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_email_outbox_kind_check" CHECK (("auth_email_outbox"."message_type" = 'auth.email_verification' and "auth_email_outbox"."verification_challenge_id" is not null and "auth_email_outbox"."reset_challenge_id" is null) or ("auth_email_outbox"."message_type" = 'auth.password_reset' and "auth_email_outbox"."reset_challenge_id" is not null and "auth_email_outbox"."verification_challenge_id" is null)),
	CONSTRAINT "auth_email_outbox_attempt_check" CHECK ("auth_email_outbox"."attempt_count" between 0 and 5),
	CONSTRAINT "auth_email_outbox_state_check" CHECK (("auth_email_outbox"."status" = 'queued' and "auth_email_outbox"."lease_id" is null and "auth_email_outbox"."lease_expires_at" is null) or ("auth_email_outbox"."status" in ('leased', 'sending') and "auth_email_outbox"."lease_id" is not null and "auth_email_outbox"."lease_expires_at" is not null) or ("auth_email_outbox"."status" in ('accepted', 'cancelled', 'failed', 'uncertain') and "auth_email_outbox"."lease_id" is null and "auth_email_outbox"."lease_expires_at" is null)),
	CONSTRAINT "auth_email_outbox_payload_check" CHECK (("auth_email_outbox"."status" in ('queued', 'leased', 'sending') and "auth_email_outbox"."completed_at" is null and "auth_email_outbox"."envelope_json" is not null and jsonb_typeof("auth_email_outbox"."envelope_json") = 'object' and octet_length("auth_email_outbox"."envelope_json"::text) <= 1024) or ("auth_email_outbox"."status" in ('accepted', 'cancelled', 'failed', 'uncertain') and "auth_email_outbox"."completed_at" is not null and "auth_email_outbox"."envelope_json" is null)),
	CONSTRAINT "auth_email_outbox_outcome_check" CHECK ("auth_email_outbox"."outcome" is null or "auth_email_outbox"."outcome" in ('accepted', 'not_accepted', 'unknown', 'expired', 'ineligible', 'invalid_envelope', 'attempt_limit', 'lease_expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_challenge_owner_unique" ON "email_verification_challenges" USING btree ("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_challenge_owner_unique" ON "password_reset_challenges" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "auth_email_outbox" ADD CONSTRAINT "auth_email_outbox_verification_owner_fk" FOREIGN KEY ("verification_challenge_id","user_id") REFERENCES "public"."email_verification_challenges"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_email_outbox" ADD CONSTRAINT "auth_email_outbox_reset_owner_fk" FOREIGN KEY ("reset_challenge_id","user_id") REFERENCES "public"."password_reset_challenges"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_outbox_verification_unique" ON "auth_email_outbox" USING btree ("verification_challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_outbox_reset_unique" ON "auth_email_outbox" USING btree ("reset_challenge_id");--> statement-breakpoint
CREATE INDEX "auth_email_outbox_queue_idx" ON "auth_email_outbox" USING btree ("status","available_at","id");--> statement-breakpoint
CREATE INDEX "auth_email_outbox_expiry_idx" ON "auth_email_outbox" USING btree ("status","expires_at","lease_expires_at");--> statement-breakpoint
