CREATE TABLE "school_application_contact_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_application_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text NOT NULL,
	"command_key_hash" text NOT NULL,
	"request_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "school_application_contact_logs_value_check" CHECK ("school_application_contact_logs"."channel" in ('email','phone','whatsapp','in_person','other')
    and "school_application_contact_logs"."direction" in ('outbound','inbound')
    and "school_application_contact_logs"."outcome" in ('attempted','reached','replied','follow_up_required')
    and char_length("school_application_contact_logs"."note") between 1 and 2000
    and "school_application_contact_logs"."command_key_hash" ~ '^[a-f0-9]{64}$' and "school_application_contact_logs"."request_hash" ~ '^[a-f0-9]{64}$'
    and isfinite("school_application_contact_logs"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD COLUMN "application_revision" integer;--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD COLUMN "command_key_hash" text;--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "school_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "school_applications"
SET "status_changed_at" = coalesce("submitted_at", "accepted_at", "updated_at", "created_at");--> statement-breakpoint
ALTER TABLE "school_applications" ALTER COLUMN "status_changed_at" SET DEFAULT clock_timestamp();--> statement-breakpoint
ALTER TABLE "school_applications" ALTER COLUMN "status_changed_at" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "school_applications_id_school_unique" ON "school_applications" USING btree ("id","school_id");--> statement-breakpoint
ALTER TABLE "school_application_contact_logs" ADD CONSTRAINT "school_application_contact_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_application_contact_logs" ADD CONSTRAINT "school_application_contact_logs_application_scope_fk" FOREIGN KEY ("school_application_id","school_id") REFERENCES "public"."school_applications"("id","school_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_application_contact_logs" ADD CONSTRAINT "school_application_contact_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "school_application_contact_logs_command_unique" ON "school_application_contact_logs" USING btree ("school_application_id","actor_user_id","command_key_hash");--> statement-breakpoint
CREATE INDEX "school_application_contact_logs_application_created_idx" ON "school_application_contact_logs" USING btree ("school_application_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_application_status_events_command_unique" ON "school_application_status_events" USING btree ("school_application_id","actor_user_id","command_key_hash") WHERE "school_application_status_events"."command_key_hash" is not null;--> statement-breakpoint
ALTER TABLE "school_application_status_events" ADD CONSTRAINT "school_application_status_events_workflow_check" CHECK ((
        "school_application_status_events"."application_revision" is null and "school_application_status_events"."command_key_hash" is null and "school_application_status_events"."request_hash" is null
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
            'converted_to_official_application','archived'))
      ));
