CREATE TABLE "guardian_consent_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"guardian_email" text,
	"guardian_email_sha256" text NOT NULL,
	"guardian_relationship" text NOT NULL,
	"locale" text NOT NULL,
	"notice_scope_key" text NOT NULL,
	"notice_version_id" uuid NOT NULL,
	"notice_content_sha256" text NOT NULL,
	"notice_publication_revision" integer NOT NULL,
	"consent_token_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_consent_requests_relationship_check" CHECK ("guardian_consent_requests"."guardian_relationship" in ('parent','other_legal_guardian')),
	CONSTRAINT "guardian_consent_requests_locale_check" CHECK ("guardian_consent_requests"."locale" in ('en','zh-CN') and "guardian_consent_requests"."notice_scope_key" = 'children_privacy_notice:' || "guardian_consent_requests"."locale"),
	CONSTRAINT "guardian_consent_requests_digest_check" CHECK ("guardian_consent_requests"."guardian_email_sha256" ~ '^[a-f0-9]{64}$' and "guardian_consent_requests"."notice_content_sha256" ~ '^[a-f0-9]{64}$' and "guardian_consent_requests"."notice_publication_revision" > 0),
	CONSTRAINT "guardian_consent_requests_state_check" CHECK (("guardian_consent_requests"."status" = 'pending' and "guardian_consent_requests"."guardian_email" is not null and "guardian_consent_requests"."consent_token_hash" is not null and "guardian_consent_requests"."responded_at" is null) or ("guardian_consent_requests"."status" in ('consented','declined','expired') and "guardian_consent_requests"."guardian_email" is null and "guardian_consent_requests"."consent_token_hash" is null and "guardian_consent_requests"."responded_at" is not null)),
	CONSTRAINT "guardian_consent_requests_time_check" CHECK ("guardian_consent_requests"."requested_at" < "guardian_consent_requests"."expires_at" and "guardian_consent_requests"."expires_at" <= "guardian_consent_requests"."requested_at" + interval '72 hours')
);
--> statement-breakpoint
CREATE TABLE "student_age_assurances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"age_band" text NOT NULL,
	"assurance_method" text NOT NULL,
	"guardian_relationship" text,
	"guardian_email_sha256" text,
	"notice_scope_key" text,
	"notice_version_id" uuid,
	"notice_content_sha256" text,
	"notice_publication_revision" integer,
	"source_registration_id" uuid,
	"assured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_age_assurances_age_check" CHECK ("student_age_assurances"."age_band" in ('14_or_older','under_14')),
	CONSTRAINT "student_age_assurances_evidence_check" CHECK (("student_age_assurances"."age_band" = '14_or_older' and "student_age_assurances"."assurance_method" = 'self_declaration' and "student_age_assurances"."guardian_relationship" is null and "student_age_assurances"."guardian_email_sha256" is null and "student_age_assurances"."notice_scope_key" is null and "student_age_assurances"."notice_version_id" is null and "student_age_assurances"."notice_content_sha256" is null and "student_age_assurances"."notice_publication_revision" is null and "student_age_assurances"."source_registration_id" is null) or ("student_age_assurances"."age_band" = 'under_14' and "student_age_assurances"."assurance_method" = 'guardian_consent' and "student_age_assurances"."guardian_relationship" in ('parent','other_legal_guardian') and "student_age_assurances"."guardian_email_sha256" ~ '^[a-f0-9]{64}$' and "student_age_assurances"."notice_scope_key" in ('children_privacy_notice:en','children_privacy_notice:zh-CN') and "student_age_assurances"."notice_version_id" is not null and "student_age_assurances"."notice_content_sha256" ~ '^[a-f0-9]{64}$' and "student_age_assurances"."notice_publication_revision" > 0 and "student_age_assurances"."source_registration_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "auth_email_outbox" DROP CONSTRAINT "auth_email_outbox_kind_check";--> statement-breakpoint
ALTER TABLE "privacy_notice_scopes" DROP CONSTRAINT "privacy_notice_scope_check";--> statement-breakpoint
ALTER TABLE "auth_email_outbox" ADD COLUMN "guardian_consent_request_id" uuid;--> statement-breakpoint
ALTER TABLE "guardian_consent_requests" ADD CONSTRAINT "guardian_consent_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_consent_requests" ADD CONSTRAINT "guardian_consent_requests_notice_fk" FOREIGN KEY ("notice_version_id","notice_scope_key") REFERENCES "public"."privacy_notice_versions"("id","scope_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_age_assurances" ADD CONSTRAINT "student_age_assurances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_age_assurances" ADD CONSTRAINT "student_age_assurances_source_registration_id_guardian_consent_requests_id_fk" FOREIGN KEY ("source_registration_id") REFERENCES "public"."guardian_consent_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_age_assurances" ADD CONSTRAINT "student_age_assurances_notice_fk" FOREIGN KEY ("notice_version_id","notice_scope_key") REFERENCES "public"."privacy_notice_versions"("id","scope_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_consent_requests_user_unique" ON "guardian_consent_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_consent_requests_token_unique" ON "guardian_consent_requests" USING btree ("consent_token_hash");--> statement-breakpoint
CREATE INDEX "guardian_consent_requests_status_expiry_idx" ON "guardian_consent_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "student_age_assurances_user_unique" ON "student_age_assurances" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_age_assurances_source_unique" ON "student_age_assurances" USING btree ("source_registration_id");--> statement-breakpoint
ALTER TABLE "auth_email_outbox" ADD CONSTRAINT "auth_email_outbox_guardian_consent_request_id_guardian_consent_requests_id_fk" FOREIGN KEY ("guardian_consent_request_id") REFERENCES "public"."guardian_consent_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_email_outbox" ADD CONSTRAINT "auth_email_outbox_kind_check" CHECK (("auth_email_outbox"."message_type" = 'auth.email_verification' and "auth_email_outbox"."verification_challenge_id" is not null and "auth_email_outbox"."reset_challenge_id" is null and "auth_email_outbox"."school_staff_invite_id" is null and "auth_email_outbox"."guardian_consent_request_id" is null) or ("auth_email_outbox"."message_type" = 'auth.password_reset' and "auth_email_outbox"."reset_challenge_id" is not null and "auth_email_outbox"."verification_challenge_id" is null and "auth_email_outbox"."school_staff_invite_id" is null and "auth_email_outbox"."guardian_consent_request_id" is null) or ("auth_email_outbox"."message_type" = 'auth.school_staff_invite' and "auth_email_outbox"."school_staff_invite_id" is not null and "auth_email_outbox"."verification_challenge_id" is null and "auth_email_outbox"."reset_challenge_id" is null and "auth_email_outbox"."guardian_consent_request_id" is null) or ("auth_email_outbox"."message_type" = 'auth.guardian_consent' and "auth_email_outbox"."guardian_consent_request_id" is not null and "auth_email_outbox"."verification_challenge_id" is null and "auth_email_outbox"."reset_challenge_id" is null and "auth_email_outbox"."school_staff_invite_id" is null));--> statement-breakpoint
ALTER TABLE "privacy_notice_scopes" ADD CONSTRAINT "privacy_notice_scope_check" CHECK ("privacy_notice_scopes"."notice_key" in ('application_disclosure', 'privacy_notice', 'terms_of_service', 'cookie_notice', 'admissions_data_policy', 'children_privacy_notice') and "privacy_notice_scopes"."locale" in ('en', 'zh-CN') and "privacy_notice_scopes"."scope_key" = "privacy_notice_scopes"."notice_key" || ':' || "privacy_notice_scopes"."locale");