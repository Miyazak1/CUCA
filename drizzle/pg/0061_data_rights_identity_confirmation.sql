CREATE TABLE "data_rights_identity_confirmations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data_rights_request_id" uuid NOT NULL,
	"source_request_revision" integer NOT NULL,
	"method" text NOT NULL,
	"subject_reference_hash" text NOT NULL,
	"confirmation_reference_sha256" text NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_rights_identity_confirmations_evidence_check" CHECK (
    "data_rights_identity_confirmations"."source_request_revision" = 1 and "data_rights_identity_confirmations"."method" = 'password_step_up'
    and "data_rights_identity_confirmations"."subject_reference_hash" ~ '^sha256:[a-f0-9]{64}$'
    and "data_rights_identity_confirmations"."confirmation_reference_sha256" ~ '^sha256:[a-f0-9]{64}$'
    and isfinite("data_rights_identity_confirmations"."confirmed_at") and isfinite("data_rights_identity_confirmations"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "data_rights_identity_confirmations" ADD CONSTRAINT "data_rights_identity_confirmations_data_rights_request_id_data_rights_requests_id_fk" FOREIGN KEY ("data_rights_request_id") REFERENCES "public"."data_rights_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_identity_confirmations_request_unique" ON "data_rights_identity_confirmations" USING btree ("data_rights_request_id");--> statement-breakpoint
CREATE INDEX "data_rights_identity_confirmations_confirmed_idx" ON "data_rights_identity_confirmations" USING btree ("confirmed_at","id");
