LOCK TABLE "application_choices", "school_applications" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "school_applications" sa
    JOIN "application_choices" c ON c.id = sa.application_choice_id
    WHERE sa.program_id IS DISTINCT FROM c.program_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'School application targets require reviewed reconciliation.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "school_applications" DROP CONSTRAINT "school_applications_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "application_choices" ADD COLUMN "target_key" text GENERATED ALWAYS AS (coalesce("program_id"::text, '') || '/' || coalesce("program_intake_id"::text, '')) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "program_intake_id" uuid;--> statement-breakpoint
UPDATE "school_applications" sa SET "program_intake_id" = c.program_intake_id
FROM "application_choices" c WHERE c.id = sa.application_choice_id AND c.program_intake_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "target_key" text GENERATED ALWAYS AS (coalesce("program_id"::text, '') || '/' || coalesce("program_intake_id"::text, '')) STORED NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "application_choices_target_unique" ON "application_choices" USING btree ("id","target_key");
--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_choice_target_fk" FOREIGN KEY ("application_choice_id","target_key") REFERENCES "public"."application_choices"("id","target_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;
