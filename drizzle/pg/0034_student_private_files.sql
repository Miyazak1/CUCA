CREATE TABLE "student_file_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"expected_bytes" integer NOT NULL,
	"expected_sha256" text NOT NULL,
	"object_key" text NOT NULL,
	"object_version_id" text,
	"object_etag" text,
	"observed_bytes" integer,
	"actual_sha256" text,
	"status" text DEFAULT 'pending_upload' NOT NULL,
	"scan_outcome" text,
	"scan_provider" text,
	"scan_attempt_count" integer DEFAULT 0 NOT NULL,
	"delete_attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_kind" text,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"idempotency_key_hash" text NOT NULL,
	"request_sha256" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"upload_expires_at" timestamp with time zone NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	"uploaded_at" timestamp with time zone,
	"scan_completed_at" timestamp with time zone,
	"delete_requested_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_file_assets_input_check" CHECK ("student_file_assets"."category" in ('identity_document','transcript','test_score','recommendation','supporting_document')
    and octet_length("student_file_assets"."original_filename") between 1 and 255 and "student_file_assets"."original_filename" !~ '[[:cntrl:]]'
    and "student_file_assets"."original_filename" = btrim("student_file_assets"."original_filename") and "student_file_assets"."original_filename" not in ('.','..')
    and strpos("student_file_assets"."original_filename", '/') = 0 and strpos("student_file_assets"."original_filename", chr(92)) = 0
    and "student_file_assets"."content_type" in ('application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    and "student_file_assets"."expected_bytes" between 1 and 104857600 and "student_file_assets"."expected_sha256" ~ '^[a-f0-9]{64}$'
    and "student_file_assets"."object_key" ~ '^private/student-files/[a-f0-9]{2}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    and substring("student_file_assets"."object_key" from 23 for 2) = substring("student_file_assets"."id"::text from 1 for 2)
    and right("student_file_assets"."object_key", 36) = "student_file_assets"."id"::text),
	CONSTRAINT "student_file_assets_digest_check" CHECK ("student_file_assets"."idempotency_key_hash" ~ '^[a-f0-9]{64}$' and "student_file_assets"."request_sha256" ~ '^[a-f0-9]{64}$'
    and ("student_file_assets"."actual_sha256" is null or "student_file_assets"."actual_sha256" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "student_file_assets_metadata_check" CHECK (("student_file_assets"."object_version_id" is null or (octet_length("student_file_assets"."object_version_id") between 1 and 1024 and "student_file_assets"."object_version_id" !~ '[[:cntrl:]]'))
    and ("student_file_assets"."object_etag" is null or (octet_length("student_file_assets"."object_etag") between 1 and 256 and "student_file_assets"."object_etag" !~ '[[:cntrl:]]'))
    and ("student_file_assets"."observed_bytes" is null or "student_file_assets"."observed_bytes" between 1 and 104857600)
    and ("student_file_assets"."scan_provider" is null or "student_file_assets"."scan_provider" ~ '^[a-z][a-z0-9_-]{0,63}$')
    and "student_file_assets"."scan_attempt_count" between 0 and 5 and "student_file_assets"."delete_attempt_count" between 0 and 2147483647
    and "student_file_assets"."revision" between 1 and 2147483647 and isfinite("student_file_assets"."upload_expires_at") and isfinite("student_file_assets"."retention_until")
    and isfinite("student_file_assets"."available_at") and ("student_file_assets"."lease_expires_at" is null or isfinite("student_file_assets"."lease_expires_at"))
    and ("student_file_assets"."uploaded_at" is null or isfinite("student_file_assets"."uploaded_at"))
    and ("student_file_assets"."scan_completed_at" is null or isfinite("student_file_assets"."scan_completed_at"))
    and ("student_file_assets"."delete_requested_at" is null or isfinite("student_file_assets"."delete_requested_at"))
    and ("student_file_assets"."deleted_at" is null or isfinite("student_file_assets"."deleted_at"))
    and "student_file_assets"."upload_expires_at" > "student_file_assets"."created_at" and "student_file_assets"."retention_until" > "student_file_assets"."created_at"
    and ("student_file_assets"."uploaded_at" is null or "student_file_assets"."uploaded_at" >= "student_file_assets"."created_at")
    and ("student_file_assets"."scan_completed_at" is null or "student_file_assets"."scan_completed_at" >= "student_file_assets"."created_at")
    and ("student_file_assets"."delete_requested_at" is null or "student_file_assets"."delete_requested_at" >= "student_file_assets"."created_at")
    and ("student_file_assets"."deleted_at" is null or "student_file_assets"."deleted_at" >= "student_file_assets"."delete_requested_at")),
	CONSTRAINT "student_file_assets_state_check" CHECK ((
      "student_file_assets"."status" = 'pending_upload' and "student_file_assets"."object_version_id" is null and "student_file_assets"."object_etag" is null and "student_file_assets"."observed_bytes" is null
      and "student_file_assets"."actual_sha256" is null and "student_file_assets"."scan_outcome" is null and "student_file_assets"."scan_provider" is null and "student_file_assets"."uploaded_at" is null
      and "student_file_assets"."scan_completed_at" is null and "student_file_assets"."delete_requested_at" is null and "student_file_assets"."deleted_at" is null
      and "student_file_assets"."lease_kind" is null and "student_file_assets"."lease_token" is null and "student_file_assets"."lease_expires_at" is null
    ) or (
      "student_file_assets"."status" = 'pending_scan' and "student_file_assets"."object_version_id" is not null and "student_file_assets"."object_etag" is not null and "student_file_assets"."observed_bytes" is not null
      and "student_file_assets"."actual_sha256" is null and "student_file_assets"."scan_outcome" is null and "student_file_assets"."scan_provider" is null and "student_file_assets"."uploaded_at" is not null
      and "student_file_assets"."scan_completed_at" is null and "student_file_assets"."delete_requested_at" is null and "student_file_assets"."deleted_at" is null
      and "student_file_assets"."lease_kind" is null and "student_file_assets"."lease_token" is null and "student_file_assets"."lease_expires_at" is null
    ) or (
      "student_file_assets"."status" = 'scanning' and "student_file_assets"."object_version_id" is not null and "student_file_assets"."object_etag" is not null and "student_file_assets"."observed_bytes" is not null
      and "student_file_assets"."actual_sha256" is null and "student_file_assets"."scan_outcome" is null and "student_file_assets"."scan_provider" is null and "student_file_assets"."uploaded_at" is not null
      and "student_file_assets"."scan_completed_at" is null and "student_file_assets"."delete_requested_at" is null and "student_file_assets"."deleted_at" is null
      and "student_file_assets"."lease_kind" = 'scan' and "student_file_assets"."lease_token" is not null and "student_file_assets"."lease_expires_at" is not null
    ) or (
      "student_file_assets"."status" = 'clean' and "student_file_assets"."object_version_id" is not null and "student_file_assets"."object_etag" is not null and "student_file_assets"."observed_bytes" = "student_file_assets"."expected_bytes"
      and "student_file_assets"."actual_sha256" = "student_file_assets"."expected_sha256" and "student_file_assets"."scan_outcome" = 'clean' and "student_file_assets"."scan_provider" is not null
      and "student_file_assets"."uploaded_at" is not null and "student_file_assets"."scan_completed_at" is not null and "student_file_assets"."delete_requested_at" is null and "student_file_assets"."deleted_at" is null
      and "student_file_assets"."lease_kind" is null and "student_file_assets"."lease_token" is null and "student_file_assets"."lease_expires_at" is null
    ) or (
      "student_file_assets"."status" = 'delete_pending' and "student_file_assets"."delete_requested_at" is not null and "student_file_assets"."deleted_at" is null
      and "student_file_assets"."lease_kind" is null and "student_file_assets"."lease_token" is null and "student_file_assets"."lease_expires_at" is null
    ) or (
      "student_file_assets"."status" = 'deleting' and "student_file_assets"."delete_requested_at" is not null and "student_file_assets"."deleted_at" is null
      and "student_file_assets"."lease_kind" = 'delete' and "student_file_assets"."lease_token" is not null and "student_file_assets"."lease_expires_at" is not null
    ) or (
      "student_file_assets"."status" = 'deleted' and "student_file_assets"."delete_requested_at" is not null and "student_file_assets"."deleted_at" is not null
      and "student_file_assets"."lease_kind" is null and "student_file_assets"."lease_token" is null and "student_file_assets"."lease_expires_at" is null
    )),
	CONSTRAINT "student_file_assets_scan_outcome_check" CHECK ("student_file_assets"."scan_outcome" is null or "student_file_assets"."scan_outcome" in ('clean','malware','integrity_mismatch','scan_error'))
);
--> statement-breakpoint
ALTER TABLE "student_file_assets" ADD CONSTRAINT "student_file_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_file_assets_object_key_unique" ON "student_file_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "student_file_assets_owner_command_unique" ON "student_file_assets" USING btree ("user_id","idempotency_key_hash");--> statement-breakpoint
CREATE INDEX "student_file_assets_owner_status_idx" ON "student_file_assets" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "student_file_assets_worker_status_idx" ON "student_file_assets" USING btree ("status","available_at","id");--> statement-breakpoint
CREATE INDEX "student_file_assets_retention_idx" ON "student_file_assets" USING btree ("status","retention_until");