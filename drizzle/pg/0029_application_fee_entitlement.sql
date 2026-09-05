CREATE TABLE "application_fee_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_set_id" uuid NOT NULL,
	"application_choice_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"target_key" text GENERATED ALWAYS AS ("program_id"::text || '/' || "program_intake_id"::text) STORED NOT NULL,
	"admission_route_key" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"invoice_line_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"payment_status_event_id" uuid NOT NULL,
	"source_payment_status" text DEFAULT 'succeeded' NOT NULL,
	"line_format" text DEFAULT 'cuac.invoice-line.v2' NOT NULL,
	"line_type" text DEFAULT 'application_fee' NOT NULL,
	"fee_code" text DEFAULT 'application_submission' NOT NULL,
	"pricing_basis_sha256" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"grant_key_sha256" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_fee_entitlements_format_check" CHECK ("application_fee_entitlements"."source_payment_status" = 'succeeded'
    and "application_fee_entitlements"."line_format" = 'cuac.invoice-line.v2' and "application_fee_entitlements"."line_type" = 'application_fee'
    and "application_fee_entitlements"."fee_code" = 'application_submission' and "application_fee_entitlements"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
    and "application_fee_entitlements"."pricing_basis_sha256" ~ '^[a-f0-9]{64}$' and "application_fee_entitlements"."grant_key_sha256" ~ '^[a-f0-9]{64}$'
    and "application_fee_entitlements"."amount_minor" >= 0 and "application_fee_entitlements"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "application_fee_entitlements_lifecycle_check" CHECK ((
      "application_fee_entitlements"."status" = 'active' and "application_fee_entitlements"."revoked_at" is null and "application_fee_entitlements"."revocation_reason" is null
      and ("application_fee_entitlements"."expires_at" is null or "application_fee_entitlements"."granted_at" < "application_fee_entitlements"."expires_at")
    ) or (
      "application_fee_entitlements"."status" = 'revoked' and "application_fee_entitlements"."revoked_at" is not null
      and "application_fee_entitlements"."granted_at" <= "application_fee_entitlements"."revoked_at" and char_length("application_fee_entitlements"."revocation_reason") between 1 and 128
      and ("application_fee_entitlements"."expires_at" is null or "application_fee_entitlements"."granted_at" < "application_fee_entitlements"."expires_at")
    ))
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "line_format" text DEFAULT 'cuac.invoice-line.v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "application_set_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "program_intake_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "admission_route_key" text;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "target_key" text GENERATED ALWAYS AS (case when "program_id" is not null and "program_intake_id" is not null then "program_id"::text || '/' || "program_intake_id"::text end) STORED;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "fee_code" text;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "pricing_basis_sha256" text;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_id_user_set_unique" ON "invoices" USING btree ("id","user_id","application_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_status_events_id_payment_status_unique" ON "payment_status_events" USING btree ("id","payment_id","to_status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_id_invoice_user_unique" ON "payments" USING btree ("id","invoice_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_checkout_unique" ON "payments" USING btree ("provider","provider_checkout_session_id") WHERE "payments"."provider_checkout_session_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_entitlement_evidence_unique" ON "invoice_lines" USING btree ("id","invoice_id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key","line_format","line_type","fee_code","amount_minor","currency","pricing_basis_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_v2_application_fee_unique" ON "invoice_lines" USING btree ("invoice_id","application_choice_id","fee_code") WHERE "invoice_lines"."line_format" = 'cuac.invoice-line.v2' and "invoice_lines"."line_type" = 'application_fee';--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_v2_set_fee_unique" ON "invoice_lines" USING btree ("invoice_id","fee_code") WHERE "invoice_lines"."line_format" = 'cuac.invoice-line.v2' and "invoice_lines"."application_choice_id" is null;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_program_intake_id_program_intakes_id_fk" FOREIGN KEY ("program_intake_id") REFERENCES "public"."program_intakes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_scope_fk" FOREIGN KEY ("invoice_id","user_id","application_set_id") REFERENCES "public"."invoices"("id","user_id","application_set_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_choice_scope_fk" FOREIGN KEY ("application_choice_id","application_set_id","user_id","school_id") REFERENCES "public"."application_choices"("id","application_set_id","user_id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_choice_target_fk" FOREIGN KEY ("application_choice_id","target_key") REFERENCES "public"."application_choices"("id","target_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_program_school_fk" FOREIGN KEY ("program_id","school_id") REFERENCES "public"."programs"("id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_format_check" CHECK ((
        "invoice_lines"."line_format" = 'cuac.invoice-line.v1'
        and "invoice_lines"."user_id" is null and "invoice_lines"."application_set_id" is null and "invoice_lines"."school_id" is null
        and "invoice_lines"."program_id" is null and "invoice_lines"."program_intake_id" is null and "invoice_lines"."admission_route_key" is null
        and "invoice_lines"."fee_code" is null and "invoice_lines"."pricing_basis_sha256" is null
      ) or (
        "invoice_lines"."line_format" = 'cuac.invoice-line.v2' and "invoice_lines"."user_id" is not null
        and "invoice_lines"."application_set_id" is not null and "invoice_lines"."fee_code" is not null
        and "invoice_lines"."pricing_basis_sha256" is not null and "invoice_lines"."pricing_basis_sha256" ~ '^[a-f0-9]{64}$'
        and "invoice_lines"."amount_minor" >= 0 and "invoice_lines"."currency" ~ '^[A-Z]{3}$'
        and char_length("invoice_lines"."description") between 1 and 256
        and ((
          "invoice_lines"."line_type" = 'application_fee' and "invoice_lines"."fee_code" = 'application_submission'
          and "invoice_lines"."application_choice_id" is not null and "invoice_lines"."school_id" is not null
          and "invoice_lines"."program_id" is not null and "invoice_lines"."program_intake_id" is not null
          and "invoice_lines"."admission_route_key" is not null and "invoice_lines"."admission_route_key" ~ '^[a-z][a-z0-9_-]{0,63}$'
        ) or (
          "invoice_lines"."line_type" = 'service_fee' and "invoice_lines"."fee_code" = 'cuac_service'
          and "invoice_lines"."application_choice_id" is null and "invoice_lines"."school_id" is null
          and "invoice_lines"."program_id" is null and "invoice_lines"."program_intake_id" is null
          and "invoice_lines"."admission_route_key" is null
        ))
      ));--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "line_format" SET DEFAULT 'cuac.invoice-line.v2';--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_application_set_id_application_sets_id_fk" FOREIGN KEY ("application_set_id") REFERENCES "public"."application_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_application_choice_id_application_choices_id_fk" FOREIGN KEY ("application_choice_id") REFERENCES "public"."application_choices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_program_intake_id_program_intakes_id_fk" FOREIGN KEY ("program_intake_id") REFERENCES "public"."program_intakes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_payment_status_event_id_payment_status_events_id_fk" FOREIGN KEY ("payment_status_event_id") REFERENCES "public"."payment_status_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_choice_scope_fk" FOREIGN KEY ("application_choice_id","application_set_id","user_id","school_id") REFERENCES "public"."application_choices"("id","application_set_id","user_id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_choice_target_fk" FOREIGN KEY ("application_choice_id","target_key") REFERENCES "public"."application_choices"("id","target_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_program_school_fk" FOREIGN KEY ("program_id","school_id") REFERENCES "public"."programs"("id","school_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_invoice_scope_fk" FOREIGN KEY ("invoice_id","user_id","application_set_id") REFERENCES "public"."invoices"("id","user_id","application_set_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_line_evidence_fk" FOREIGN KEY ("invoice_line_id","invoice_id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key","line_format","line_type","fee_code","amount_minor","currency","pricing_basis_sha256") REFERENCES "public"."invoice_lines"("id","invoice_id","user_id","application_set_id","application_choice_id","school_id","program_id","program_intake_id","admission_route_key","line_format","line_type","fee_code","amount_minor","currency","pricing_basis_sha256") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_payment_scope_fk" FOREIGN KEY ("payment_id","invoice_id","user_id") REFERENCES "public"."payments"("id","invoice_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fee_entitlements" ADD CONSTRAINT "application_fee_entitlements_payment_event_fk" FOREIGN KEY ("payment_status_event_id","payment_id","source_payment_status") REFERENCES "public"."payment_status_events"("id","payment_id","to_status") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_fee_entitlements_active_choice_route_unique" ON "application_fee_entitlements" USING btree ("application_choice_id","admission_route_key") WHERE "application_fee_entitlements"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "application_fee_entitlements_invoice_line_unique" ON "application_fee_entitlements" USING btree ("invoice_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_fee_entitlements_grant_key_unique" ON "application_fee_entitlements" USING btree ("grant_key_sha256");--> statement-breakpoint
CREATE INDEX "application_fee_entitlements_user_choice_idx" ON "application_fee_entitlements" USING btree ("user_id","application_choice_id","granted_at");
