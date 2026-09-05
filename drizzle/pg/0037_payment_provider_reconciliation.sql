CREATE TABLE "payment_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_sha256" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_id" uuid,
	"provider_checkout_session_id" text NOT NULL,
	"provider_payment_id" text,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"outcome" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"quarantined_at" timestamp with time zone,
	"quarantine_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_events_format_check" CHECK ("payment_provider_events"."provider" ~ '^[a-z][a-z0-9_-]{0,63}$'
      and char_length("payment_provider_events"."provider_event_id") between 1 and 128
      and "payment_provider_events"."event_type" in ('payment.succeeded','payment.canceled','payment.refunded')
      and "payment_provider_events"."payload_sha256" ~ '^[a-f0-9]{64}$'
      and char_length("payment_provider_events"."provider_checkout_session_id") between 1 and 256
      and ("payment_provider_events"."provider_payment_id" is null or char_length("payment_provider_events"."provider_payment_id") between 1 and 256)
      and ("payment_provider_events"."event_type" = 'payment.canceled' or "payment_provider_events"."provider_payment_id" is not null)
      and "payment_provider_events"."amount_minor" >= 0 and "payment_provider_events"."currency" ~ '^[A-Z]{3}$'
      and "payment_provider_events"."attempt_count" between 0 and 100 and isfinite("payment_provider_events"."occurred_at")
      and isfinite("payment_provider_events"."next_attempt_at") and isfinite("payment_provider_events"."received_at")),
	CONSTRAINT "payment_provider_events_lifecycle_check" CHECK ((
        "payment_provider_events"."state" = 'pending' and "payment_provider_events"."outcome" is null and "payment_provider_events"."processed_at" is null
        and "payment_provider_events"."quarantined_at" is null and "payment_provider_events"."quarantine_reason" is null
      ) or (
        "payment_provider_events"."state" = 'processed' and "payment_provider_events"."outcome" in (
          'applied_succeeded','applied_canceled','applied_refunded','already_applied'
        ) and "payment_provider_events"."processed_at" is not null and "payment_provider_events"."quarantined_at" is null
        and "payment_provider_events"."quarantine_reason" is null
      ) or (
        "payment_provider_events"."state" = 'quarantined' and "payment_provider_events"."outcome" is null and "payment_provider_events"."processed_at" is null
        and "payment_provider_events"."quarantined_at" is not null and char_length("payment_provider_events"."quarantine_reason") between 1 and 128
      ))
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_provider_event_unique" ON "payment_provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_provider_events_pending_idx" ON "payment_provider_events" USING btree ("state","next_attempt_at","received_at");--> statement-breakpoint
CREATE INDEX "payment_provider_events_invoice_idx" ON "payment_provider_events" USING btree ("invoice_id","received_at");--> statement-breakpoint
CREATE INDEX "payment_provider_events_payment_idx" ON "payment_provider_events" USING btree ("payment_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_invoice_unique" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_unique" ON "payments" USING btree ("provider","provider_payment_id") WHERE "payments"."provider_payment_id" is not null;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lifecycle_check" CHECK ((
        "invoices"."status" = 'draft' and "invoices"."finalized_at" is null and "invoices"."voided_at" is null
      ) or (
        "invoices"."status" = 'paid' and "invoices"."finalized_at" is not null and "invoices"."voided_at" is null
      ) or (
        "invoices"."status" = 'void' and "invoices"."finalized_at" is null and "invoices"."voided_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_check" CHECK ("invoices"."currency" ~ '^[A-Z]{3}$'
      and "invoices"."subtotal_minor" >= 0 and "invoices"."discount_minor" >= 0
      and "invoices"."total_minor" = "invoices"."subtotal_minor" - "invoices"."discount_minor");--> statement-breakpoint
ALTER TABLE "payment_status_events" ADD CONSTRAINT "payment_status_events_status_check" CHECK ("payment_status_events"."to_status" in ('succeeded','canceled','refunded')
      and ("payment_status_events"."from_status" is null or "payment_status_events"."from_status" in ('requires_payment','succeeded','canceled','refunded')));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_lifecycle_check" CHECK ((
        "payments"."status" = 'requires_payment' and "payments"."paid_at" is null
        and "payments"."canceled_at" is null and "payments"."refunded_at" is null
      ) or (
        "payments"."status" = 'succeeded' and "payments"."paid_at" is not null
        and "payments"."canceled_at" is null and "payments"."refunded_at" is null
      ) or (
        "payments"."status" = 'canceled' and "payments"."paid_at" is null
        and "payments"."canceled_at" is not null and "payments"."refunded_at" is null
      ) or (
        "payments"."status" = 'refunded' and "payments"."paid_at" is not null
        and "payments"."canceled_at" is null and "payments"."refunded_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("payments"."amount_minor" >= 0 and "payments"."currency" ~ '^[A-Z]{3}$');