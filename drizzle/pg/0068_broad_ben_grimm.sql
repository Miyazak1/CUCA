ALTER TABLE "guardian_consent_requests" DROP CONSTRAINT "guardian_consent_requests_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "student_age_assurances" DROP CONSTRAINT "student_age_assurances_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "guardian_consent_requests" ADD CONSTRAINT "guardian_consent_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_age_assurances" ADD CONSTRAINT "student_age_assurances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;