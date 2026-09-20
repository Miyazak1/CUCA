CREATE TABLE "data_rights_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"subject_reference_hash" text NOT NULL,
	"request_type" text NOT NULL,
	"correction_scope" text,
	"preferred_locale" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"identity_confirmed_at" timestamp with time zone,
	"assigned_user_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_rights_requests_subject_hash_check" CHECK ("data_rights_requests"."subject_reference_hash" ~ '^sha256:[a-f0-9]{64}$'),
	CONSTRAINT "data_rights_requests_type_check" CHECK ("data_rights_requests"."request_type" in ('access', 'correction', 'portable_export', 'account_deletion')),
	CONSTRAINT "data_rights_requests_correction_check" CHECK (("data_rights_requests"."request_type" = 'correction' and "data_rights_requests"."correction_scope" in ('account', 'applicant_profile', 'education', 'assessment', 'application', 'other')) or ("data_rights_requests"."request_type" <> 'correction' and "data_rights_requests"."correction_scope" is null)),
	CONSTRAINT "data_rights_requests_locale_check" CHECK ("data_rights_requests"."preferred_locale" in ('en', 'zh-CN')),
	CONSTRAINT "data_rights_requests_status_check" CHECK ("data_rights_requests"."status" in ('received', 'identity_confirmed', 'in_progress', 'fulfilled', 'denied', 'cancelled')),
	CONSTRAINT "data_rights_requests_revision_check" CHECK ("data_rights_requests"."revision" > 0),
	CONSTRAINT "data_rights_requests_lifecycle_check" CHECK (("data_rights_requests"."status" in ('fulfilled', 'denied', 'cancelled')) = ("data_rights_requests"."closed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_rights_requests_owner_status_idx" ON "data_rights_requests" USING btree ("user_id","status","received_at");--> statement-breakpoint
CREATE INDEX "data_rights_requests_queue_idx" ON "data_rights_requests" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_requests_active_type_unique" ON "data_rights_requests" USING btree ("user_id","request_type") WHERE "data_rights_requests"."user_id" is not null and "data_rights_requests"."status" in ('received', 'identity_confirmed', 'in_progress');