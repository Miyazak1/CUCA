ALTER TABLE "application_submission_authorizations" ADD COLUMN "authorization_format" text DEFAULT 'cuac.application-submission-authorization.v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD COLUMN "admission_route_key" text;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD COLUMN "policy_version_id" uuid;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD COLUMN "policy_publication_revision" integer;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD COLUMN "policy_document_sha256" text;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD COLUMN "policy_target_set_sha256" text;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD COLUMN "policy_approval_sha256" text;--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_policy_target_fk" FOREIGN KEY ("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") REFERENCES "public"."official_submission_policy_version_targets"("policy_version_id","program_intake_id","program_id","school_id","admission_route_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_submission_authorization_policy_idx" ON "application_submission_authorizations" USING btree ("policy_version_id","program_intake_id","admission_route_key");--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ADD CONSTRAINT "application_submission_authorization_policy_binding_check" CHECK ((
      "application_submission_authorizations"."authorization_format" = 'cuac.application-submission-authorization.v1'
      and "application_submission_authorizations"."admission_route_key" is null and "application_submission_authorizations"."policy_version_id" is null
      and "application_submission_authorizations"."policy_publication_revision" is null and "application_submission_authorizations"."policy_document_sha256" is null
      and "application_submission_authorizations"."policy_target_set_sha256" is null and "application_submission_authorizations"."policy_approval_sha256" is null
    ) or (
      "application_submission_authorizations"."authorization_format" = 'cuac.application-submission-authorization.v2'
      and "application_submission_authorizations"."admission_route_key" is not null and "application_submission_authorizations"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
      and "application_submission_authorizations"."policy_version_id" is not null and "application_submission_authorizations"."policy_publication_revision" is not null
      and "application_submission_authorizations"."policy_publication_revision" > 0 and "application_submission_authorizations"."policy_document_sha256" is not null
      and "application_submission_authorizations"."policy_document_sha256" ~ '^[a-f0-9]{64}$' and "application_submission_authorizations"."policy_target_set_sha256" is not null
      and "application_submission_authorizations"."policy_target_set_sha256" ~ '^[a-f0-9]{64}$' and "application_submission_authorizations"."policy_approval_sha256" is not null
      and "application_submission_authorizations"."policy_approval_sha256" ~ '^[a-f0-9]{64}$'
    ));--> statement-breakpoint
ALTER TABLE "application_submission_authorizations" ALTER COLUMN "authorization_format" SET DEFAULT 'cuac.application-submission-authorization.v2';
