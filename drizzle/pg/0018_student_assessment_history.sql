CREATE TABLE "student_assessment_histories" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_assessment_histories_revision_check" CHECK ("student_assessment_histories"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "student_assessment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assessment_category" text,
	"assessment_name" text,
	"assessment_variant" text,
	"result_status" text,
	"result_form" text,
	"test_date" date,
	"report_date" date,
	"components_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "student_assessment_records_active_check" CHECK ("student_assessment_records"."removed_at" is not null or ("student_assessment_records"."assessment_category" is not null and "student_assessment_records"."assessment_name" is not null and "student_assessment_records"."result_status" is not null and "student_assessment_records"."result_form" is not null and "student_assessment_records"."components_json" is not null)),
	CONSTRAINT "student_assessment_records_erased_check" CHECK ("student_assessment_records"."removed_at" is null or ("student_assessment_records"."assessment_category" is null and "student_assessment_records"."assessment_name" is null and "student_assessment_records"."assessment_variant" is null and "student_assessment_records"."result_status" is null and "student_assessment_records"."result_form" is null and "student_assessment_records"."test_date" is null and "student_assessment_records"."report_date" is null and "student_assessment_records"."components_json" is null)),
	CONSTRAINT "student_assessment_records_text_check" CHECK (("student_assessment_records"."assessment_name" is null or char_length(btrim("student_assessment_records"."assessment_name")) between 1 and 120) and ("student_assessment_records"."assessment_variant" is null or char_length(btrim("student_assessment_records"."assessment_variant")) between 1 and 160)),
	CONSTRAINT "student_assessment_records_category_check" CHECK ("student_assessment_records"."assessment_category" is null or "student_assessment_records"."assessment_category" in ('language', 'admissions', 'other')),
	CONSTRAINT "student_assessment_records_status_check" CHECK ("student_assessment_records"."result_status" is null or "student_assessment_records"."result_status" in ('planned', 'awaiting_result', 'reported')),
	CONSTRAINT "student_assessment_records_form_check" CHECK ("student_assessment_records"."result_form" is null or "student_assessment_records"."result_form" in ('unspecified', 'single_sitting', 'combined', 'partial_retake')),
	CONSTRAINT "student_assessment_records_dates_check" CHECK (("student_assessment_records"."test_date" is null or "student_assessment_records"."test_date" between '1900-01-01'::date and '2199-12-31'::date) and ("student_assessment_records"."report_date" is null or "student_assessment_records"."report_date" between '1900-01-01'::date and '2199-12-31'::date) and ("student_assessment_records"."test_date" is null or "student_assessment_records"."report_date" is null or "student_assessment_records"."test_date" <= "student_assessment_records"."report_date")),
	CONSTRAINT "student_assessment_records_components_check" CHECK ("student_assessment_records"."components_json" is null or case when jsonb_typeof("student_assessment_records"."components_json") = 'array' then jsonb_array_length("student_assessment_records"."components_json") <= 20 and octet_length("student_assessment_records"."components_json"::text) <= 16384 else false end),
	CONSTRAINT "student_assessment_records_result_check" CHECK ("student_assessment_records"."removed_at" is not null or case when jsonb_typeof("student_assessment_records"."components_json") = 'array' then case when "student_assessment_records"."result_status" = 'reported' then jsonb_array_length("student_assessment_records"."components_json") > 0 else jsonb_array_length("student_assessment_records"."components_json") = 0 and "student_assessment_records"."report_date" is null end else false end)
);
--> statement-breakpoint
ALTER TABLE "student_assessment_histories" ADD CONSTRAINT "student_assessment_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_assessment_records" ADD CONSTRAINT "student_assessment_records_history_fk" FOREIGN KEY ("user_id") REFERENCES "public"."student_assessment_histories"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_assessment_records_active_user_idx" ON "student_assessment_records" USING btree ("user_id","created_at","id") WHERE "student_assessment_records"."removed_at" is null;