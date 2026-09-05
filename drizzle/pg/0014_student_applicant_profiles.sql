CREATE TABLE "student_applicant_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"full_name" text,
	"contact_email" text,
	"citizenship_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_applicant_profiles_revision_check" CHECK ("student_applicant_profiles"."revision" > 0),
	CONSTRAINT "student_applicant_profiles_full_name_check" CHECK ("student_applicant_profiles"."full_name" is null or char_length(btrim("student_applicant_profiles"."full_name")) between 1 and 200),
	CONSTRAINT "student_applicant_profiles_email_check" CHECK ("student_applicant_profiles"."contact_email" is null or char_length(btrim("student_applicant_profiles"."contact_email")) between 1 and 254),
	CONSTRAINT "student_applicant_profiles_country_check" CHECK ("student_applicant_profiles"."citizenship_country" is null or "student_applicant_profiles"."citizenship_country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "student_applicant_profiles" ADD CONSTRAINT "student_applicant_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_applicant_profiles_user_unique" ON "student_applicant_profiles" USING btree ("user_id");