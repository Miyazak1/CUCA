CREATE TABLE "data_rights_reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"data_rights_request_id" uuid NOT NULL,
	"review_id" uuid,
	"reminder_code" text NOT NULL,
	"target_at" timestamp with time zone NOT NULL,
	"deadline_basis_at" timestamp with time zone,
	"source_request_revision" integer NOT NULL,
	"recipient_user_id" uuid,
	"recipient_role" text NOT NULL,
	"locale" text NOT NULL,
	"event_key_sha256" text NOT NULL,
	"emitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_rights_reminders_shape_check" CHECK (
    "data_rights_reminders"."reminder_code" in ('identity_24h','identity_day5','internal_day12','response_due_soon','response_due_today')
    and "data_rights_reminders"."source_request_revision" > 0 and "data_rights_reminders"."locale" in ('en','zh-CN')
    and "data_rights_reminders"."event_key_sha256" ~ '^[a-f0-9]{64}$'
    and isfinite("data_rights_reminders"."target_at") and isfinite("data_rights_reminders"."emitted_at") and isfinite("data_rights_reminders"."created_at")
    and "data_rights_reminders"."emitted_at" >= "data_rights_reminders"."target_at"
    and (("data_rights_reminders"."reminder_code" in ('identity_24h','identity_day5') and "data_rights_reminders"."recipient_role" = 'student'
      and "data_rights_reminders"."review_id" is null and "data_rights_reminders"."deadline_basis_at" is null)
    or ("data_rights_reminders"."reminder_code" = 'internal_day12' and "data_rights_reminders"."recipient_role" in ('cuac_ops','cuac_admin')
      and "data_rights_reminders"."review_id" is not null and "data_rights_reminders"."deadline_basis_at" is not null
      and isfinite("data_rights_reminders"."deadline_basis_at") and "data_rights_reminders"."target_at" = "data_rights_reminders"."deadline_basis_at" - interval '3 days')
    or ("data_rights_reminders"."reminder_code" in ('response_due_soon','response_due_today')
      and "data_rights_reminders"."recipient_role" in ('cuac_ops','cuac_admin') and "data_rights_reminders"."review_id" is not null
      and "data_rights_reminders"."deadline_basis_at" is not null and isfinite("data_rights_reminders"."deadline_basis_at")
      and (("data_rights_reminders"."reminder_code" = 'response_due_soon' and "data_rights_reminders"."target_at" = "data_rights_reminders"."deadline_basis_at" - interval '6 days')
        or ("data_rights_reminders"."reminder_code" = 'response_due_today' and "data_rights_reminders"."target_at" = "data_rights_reminders"."deadline_basis_at")))))
);
--> statement-breakpoint
ALTER TABLE "data_rights_reminders" ADD CONSTRAINT "data_rights_reminders_data_rights_request_id_data_rights_requests_id_fk" FOREIGN KEY ("data_rights_request_id") REFERENCES "public"."data_rights_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_rights_reminders" ADD CONSTRAINT "data_rights_reminders_review_id_ops_data_rights_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."ops_data_rights_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_rights_reminders" ADD CONSTRAINT "data_rights_reminders_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_reminders_milestone_unique" ON "data_rights_reminders" USING btree ("data_rights_request_id","reminder_code","target_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_rights_reminders_event_key_unique" ON "data_rights_reminders" USING btree ("event_key_sha256");--> statement-breakpoint
CREATE INDEX "data_rights_reminders_due_idx" ON "data_rights_reminders" USING btree ("target_at","id");
