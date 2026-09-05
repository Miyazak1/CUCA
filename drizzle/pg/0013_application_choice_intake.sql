DROP INDEX "application_choices_active_set_program_unique";--> statement-breakpoint
ALTER TABLE "application_choices" ADD COLUMN "program_intake_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "program_intakes_id_program_unique" ON "program_intakes" USING btree ("id","program_id");--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_intake_program_fk" FOREIGN KEY ("program_intake_id","program_id") REFERENCES "public"."program_intakes"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_choices_active_set_program_intake_unique" ON "application_choices" USING btree ("application_set_id","program_id","program_intake_id") WHERE "application_choices"."removed_at" is null and "application_choices"."program_intake_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "application_choices_active_set_program_unique" ON "application_choices" USING btree ("application_set_id","program_id") WHERE "application_choices"."removed_at" is null and "application_choices"."program_id" is not null and "application_choices"."program_intake_id" is null;--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_intake_program_check" CHECK ("application_choices"."program_intake_id" is null or "application_choices"."program_id" is not null);
