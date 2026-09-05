CREATE TABLE "official_submission_delivery_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"application_submission_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"provider_name" text NOT NULL,
	"provider_receipt_id" text NOT NULL,
	"provider_received_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"payload_sha256" text NOT NULL,
	"manifest_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "official_submission_delivery_receipts_value_check" CHECK ("official_submission_delivery_receipts"."provider_name" ~ '^[a-z][a-z0-9_-]{0,63}$'
    and char_length("official_submission_delivery_receipts"."provider_receipt_id") between 1 and 128
    and "official_submission_delivery_receipts"."provider_receipt_id" ~ '^[A-Za-z0-9._:-]+$'
    and "official_submission_delivery_receipts"."payload_sha256" ~ '^[a-f0-9]{64}$' and "official_submission_delivery_receipts"."manifest_sha256" ~ '^[a-f0-9]{64}$'
    and isfinite("official_submission_delivery_receipts"."provider_received_at") and isfinite("official_submission_delivery_receipts"."confirmed_at")
    and "official_submission_delivery_receipts"."provider_received_at" <= "official_submission_delivery_receipts"."confirmed_at" + interval '5 minutes'
    and "official_submission_delivery_receipts"."created_at" >= "official_submission_delivery_receipts"."confirmed_at")
);
--> statement-breakpoint
ALTER TABLE "official_submission_outbox" DROP CONSTRAINT "official_submission_outbox_format_check";--> statement-breakpoint
ALTER TABLE "official_submission_outbox" DROP CONSTRAINT "official_submission_outbox_lifecycle_check";--> statement-breakpoint
ALTER TABLE "school_application_status_events" DROP CONSTRAINT "school_application_status_events_workflow_check";--> statement-breakpoint
ALTER TABLE "school_applications" DROP CONSTRAINT "school_applications_workflow_check";--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD COLUMN "payload_sha256" text;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD COLUMN "provider_name" text;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD COLUMN "provider_receipt_id" text;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD COLUMN "provider_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_delivery_receipts_outbox_unique" ON "official_submission_delivery_receipts" USING btree ("outbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_delivery_receipts_provider_receipt_unique" ON "official_submission_delivery_receipts" USING btree ("provider_name","provider_receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "official_submission_outbox_delivery_scope_unique" ON "official_submission_outbox" USING btree ("id","group_id","application_submission_id","school_id");--> statement-breakpoint
ALTER TABLE "official_submission_delivery_receipts" ADD CONSTRAINT "official_submission_delivery_receipts_outbox_scope_fk" FOREIGN KEY ("outbox_id","group_id","application_submission_id","school_id") REFERENCES "public"."official_submission_outbox"("id","group_id","application_submission_id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD CONSTRAINT "official_submission_outbox_format_check" CHECK ("official_submission_outbox"."event_type" = 'official_submission.dispatch_requested'
    and "official_submission_outbox"."payload_format" = 'cuac.official-submission-dispatch.v1'
    and "official_submission_outbox"."manifest_sha256" ~ '^[a-f0-9]{64}$' and "official_submission_outbox"."attempt_count" between 0 and 5
    and ("official_submission_outbox"."payload_sha256" is null or "official_submission_outbox"."payload_sha256" ~ '^[a-f0-9]{64}$')
    and ("official_submission_outbox"."provider_name" is null or "official_submission_outbox"."provider_name" ~ '^[a-z][a-z0-9_-]{0,63}$')
    and (("official_submission_outbox"."provider_name" is null and "official_submission_outbox"."payload_sha256" is null)
      or ("official_submission_outbox"."provider_name" is not null and "official_submission_outbox"."payload_sha256" is not null))
    and ("official_submission_outbox"."provider_receipt_id" is null or (char_length("official_submission_outbox"."provider_receipt_id") between 1 and 128
      and "official_submission_outbox"."provider_receipt_id" ~ '^[A-Za-z0-9._:-]+$'))
    and ("official_submission_outbox"."last_error_code" is null or "official_submission_outbox"."last_error_code" ~ '^[A-Z0-9_]{1,64}$')
    and ("official_submission_outbox"."outcome" is null or "official_submission_outbox"."outcome" in ('accepted','not_accepted','unknown','invalid_payload','attempt_limit','lease_expired')));--> statement-breakpoint
ALTER TABLE "official_submission_outbox" ADD CONSTRAINT "official_submission_outbox_lifecycle_check" CHECK ((
      "official_submission_outbox"."status" = 'pending' and "official_submission_outbox"."lease_token" is null and "official_submission_outbox"."leased_at" is null
      and "official_submission_outbox"."lease_expires_at" is null and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is null
      and "official_submission_outbox"."completed_at" is null and "official_submission_outbox"."provider_receipt_id" is null and "official_submission_outbox"."provider_received_at" is null
      and ("official_submission_outbox"."outcome" is null or "official_submission_outbox"."outcome" in ('not_accepted','lease_expired'))
    ) or (
      "official_submission_outbox"."status" = 'leased' and "official_submission_outbox"."lease_token" is not null and "official_submission_outbox"."leased_at" is not null
      and "official_submission_outbox"."lease_expires_at" is not null and "official_submission_outbox"."leased_at" < "official_submission_outbox"."lease_expires_at"
      and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is null and "official_submission_outbox"."completed_at" is null
      and "official_submission_outbox"."provider_receipt_id" is null and "official_submission_outbox"."provider_received_at" is null
    ) or (
      "official_submission_outbox"."status" = 'sending' and "official_submission_outbox"."lease_token" is not null and "official_submission_outbox"."leased_at" is not null
      and "official_submission_outbox"."lease_expires_at" is not null and "official_submission_outbox"."leased_at" < "official_submission_outbox"."lease_expires_at"
      and "official_submission_outbox"."attempt_count" between 1 and 5 and "official_submission_outbox"."provider_name" is not null and "official_submission_outbox"."payload_sha256" is not null
      and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is null and "official_submission_outbox"."completed_at" is null
      and "official_submission_outbox"."provider_receipt_id" is null and "official_submission_outbox"."provider_received_at" is null
    ) or (
      "official_submission_outbox"."status" = 'dispatched' and "official_submission_outbox"."lease_token" is null and "official_submission_outbox"."leased_at" is null
      and "official_submission_outbox"."lease_expires_at" is null and "official_submission_outbox"."dispatched_at" is not null and "official_submission_outbox"."quarantined_at" is null
      and "official_submission_outbox"."completed_at" is not null and "official_submission_outbox"."outcome" = 'accepted' and "official_submission_outbox"."provider_name" is not null
      and "official_submission_outbox"."payload_sha256" is not null and "official_submission_outbox"."provider_receipt_id" is not null
      and "official_submission_outbox"."provider_received_at" is not null and isfinite("official_submission_outbox"."provider_received_at")
    ) or (
      "official_submission_outbox"."status" = 'quarantined' and "official_submission_outbox"."lease_token" is null and "official_submission_outbox"."leased_at" is null
      and "official_submission_outbox"."lease_expires_at" is null and "official_submission_outbox"."dispatched_at" is null and "official_submission_outbox"."quarantined_at" is not null
      and "official_submission_outbox"."completed_at" is not null and "official_submission_outbox"."outcome" in ('unknown','invalid_payload','attempt_limit')
      and "official_submission_outbox"."provider_receipt_id" is null and "official_submission_outbox"."provider_received_at" is null
    ));--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD CONSTRAINT "school_application_status_events_workflow_check" CHECK ((
        "school_application_status_events"."application_revision" is null and "school_application_status_events"."command_key_hash" is null and "school_application_status_events"."request_hash" is null
      ) or (
        "school_application_status_events"."application_revision" = 1 and "school_application_status_events"."actor_user_id" is null
        and "school_application_status_events"."command_key_hash" is null and "school_application_status_events"."request_hash" is null
        and "school_application_status_events"."from_status" = 'pending_submission' and "school_application_status_events"."to_status" = 'new'
        and "school_application_status_events"."reason" is null
      ) or (
        "school_application_status_events"."application_revision" between 2 and 2147483647 and "school_application_status_events"."actor_user_id" is not null
        and "school_application_status_events"."command_key_hash" ~ '^[a-f0-9]{64}$' and "school_application_status_events"."request_hash" ~ '^[a-f0-9]{64}$'
        and "school_application_status_events"."from_status" in ('new','needs_review','contact_queued','contacted','waiting_for_documents',
          'documents_received_by_school')
        and "school_application_status_events"."to_status" in ('needs_review','contact_queued','contacted','waiting_for_documents',
          'documents_received_by_school','not_a_fit','converted_to_official_application','archived')
        and ("school_application_status_events"."reason" is null or (char_length("school_application_status_events"."reason") between 1 and 500))
      ));--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_workflow_check" CHECK ("school_applications"."school_revision" between 1 and 2147483647
      and isfinite("school_applications"."status_changed_at")
      and (
        ("school_applications"."application_record_format" = 'cuac.program-application.v1'
          and "school_applications"."status" in ('pending_submission','submitted','under_review','new','needs_review','contact_queued',
            'contacted','waiting_for_documents','documents_received_by_school','not_a_fit',
            'converted_to_official_application','archived'))
        or ("school_applications"."application_record_format" = 'cuac.program-application.v2'
          and "school_applications"."status" in ('pending_submission','new','needs_review','contact_queued','contacted',
            'waiting_for_documents','documents_received_by_school','not_a_fit',
            'converted_to_official_application','archived')
          and (("school_applications"."status" = 'pending_submission' and "school_applications"."submitted_at" is null)
            or ("school_applications"."status" <> 'pending_submission' and "school_applications"."submitted_at" is not null
              and isfinite("school_applications"."submitted_at"))))
      ));
