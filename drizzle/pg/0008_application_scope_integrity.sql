-- Fail on historical ownership/routing mismatches; never rewrite student or tenant IDs.
CREATE UNIQUE INDEX "application_sets_id_user_unique" ON "application_sets" ("id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "programs_id_school_unique" ON "programs" ("id", "school_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "application_choices_scope_unique"
ON "application_choices" ("id", "application_set_id", "user_id", "school_id");
--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_set_owner_fk"
FOREIGN KEY ("application_set_id", "user_id") REFERENCES "application_sets" ("id", "user_id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "application_choices" ADD CONSTRAINT "application_choices_program_school_fk"
FOREIGN KEY ("program_id", "school_id") REFERENCES "programs" ("id", "school_id");
--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_choice_scope_fk"
FOREIGN KEY ("application_choice_id", "application_set_id", "student_user_id", "school_id")
REFERENCES "application_choices" ("id", "application_set_id", "user_id", "school_id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_program_school_fk"
FOREIGN KEY ("program_id", "school_id") REFERENCES "programs" ("id", "school_id");
