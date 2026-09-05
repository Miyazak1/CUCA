CREATE TABLE "student_education_histories" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_education_histories_revision_check" CHECK ("student_education_histories"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "student_education_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"institution_name" text,
	"institution_country" text,
	"education_level" text,
	"qualification_name" text,
	"field_of_study" text,
	"attendance_status" text,
	"start_year" integer,
	"end_year" integer,
	"expected_completion_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "student_education_records_active_check" CHECK ("student_education_records"."removed_at" is not null or ("student_education_records"."institution_name" is not null and "student_education_records"."education_level" is not null and "student_education_records"."attendance_status" is not null)),
	CONSTRAINT "student_education_records_erased_check" CHECK ("student_education_records"."removed_at" is null or ("student_education_records"."institution_name" is null and "student_education_records"."institution_country" is null and "student_education_records"."education_level" is null and "student_education_records"."qualification_name" is null and "student_education_records"."field_of_study" is null and "student_education_records"."attendance_status" is null and "student_education_records"."start_year" is null and "student_education_records"."end_year" is null and "student_education_records"."expected_completion_year" is null)),
	CONSTRAINT "student_education_records_text_check" CHECK (("student_education_records"."institution_name" is null or char_length(btrim("student_education_records"."institution_name")) between 1 and 200) and ("student_education_records"."qualification_name" is null or char_length(btrim("student_education_records"."qualification_name")) between 1 and 200) and ("student_education_records"."field_of_study" is null or char_length(btrim("student_education_records"."field_of_study")) between 1 and 200)),
	CONSTRAINT "student_education_records_country_check" CHECK ("student_education_records"."institution_country" is null or "student_education_records"."institution_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "student_education_records_level_check" CHECK ("student_education_records"."education_level" is null or "student_education_records"."education_level" in ('secondary', 'vocational', 'associate', 'bachelor', 'master', 'doctorate', 'other')),
	CONSTRAINT "student_education_records_status_check" CHECK ("student_education_records"."attendance_status" is null or "student_education_records"."attendance_status" in ('unknown', 'in_progress', 'completed', 'discontinued')),
	CONSTRAINT "student_education_records_years_check" CHECK (("student_education_records"."start_year" is null or "student_education_records"."start_year" between 1900 and 2199) and ("student_education_records"."end_year" is null or "student_education_records"."end_year" between 1900 and 2199) and ("student_education_records"."expected_completion_year" is null or "student_education_records"."expected_completion_year" between 1900 and 2199) and ("student_education_records"."start_year" is null or "student_education_records"."end_year" is null or "student_education_records"."start_year" <= "student_education_records"."end_year") and ("student_education_records"."start_year" is null or "student_education_records"."expected_completion_year" is null or "student_education_records"."start_year" <= "student_education_records"."expected_completion_year")),
	CONSTRAINT "student_education_records_attendance_check" CHECK (("student_education_records"."attendance_status" is distinct from 'in_progress' or "student_education_records"."end_year" is null) and ("student_education_records"."expected_completion_year" is null or "student_education_records"."attendance_status" = 'in_progress'))
);
--> statement-breakpoint
ALTER TABLE "student_education_histories" ADD CONSTRAINT "student_education_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_education_records" ADD CONSTRAINT "student_education_records_history_fk" FOREIGN KEY ("user_id") REFERENCES "public"."student_education_histories"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_education_records_active_user_idx" ON "student_education_records" USING btree ("user_id","created_at","id") WHERE "student_education_records"."removed_at" is null;
