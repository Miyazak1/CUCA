ALTER TABLE "data_rights_requests" ADD COLUMN "deadline_policy_version" text DEFAULT 'data_rights_response_v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD COLUMN "internal_target_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD COLUMN "response_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD COLUMN "extended_due_at" timestamp with time zone;--> statement-breakpoint
UPDATE "data_rights_requests" SET "internal_target_at" = "received_at" + interval '15 days',
  "response_due_at" = "received_at" + interval '30 days';--> statement-breakpoint
ALTER TABLE "data_rights_requests" ALTER COLUMN "internal_target_at" SET DEFAULT now() + interval '15 days';--> statement-breakpoint
ALTER TABLE "data_rights_requests" ALTER COLUMN "internal_target_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "data_rights_requests" ALTER COLUMN "response_due_at" SET DEFAULT now() + interval '30 days';--> statement-breakpoint
ALTER TABLE "data_rights_requests" ALTER COLUMN "response_due_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "data_rights_requests_deadline_idx" ON "data_rights_requests" USING btree ("status","response_due_at","received_at");--> statement-breakpoint
ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_deadline_check" CHECK (
    "data_rights_requests"."deadline_policy_version" = 'data_rights_response_v1'
    and isfinite("data_rights_requests"."internal_target_at") and isfinite("data_rights_requests"."response_due_at")
    and "data_rights_requests"."internal_target_at" > "data_rights_requests"."received_at" and "data_rights_requests"."response_due_at" > "data_rights_requests"."internal_target_at"
    and ("data_rights_requests"."extended_due_at" is null or (isfinite("data_rights_requests"."extended_due_at")
      and "data_rights_requests"."extended_due_at" > "data_rights_requests"."response_due_at"
      and "data_rights_requests"."extended_due_at" <= "data_rights_requests"."response_due_at" + interval '60 days')));
