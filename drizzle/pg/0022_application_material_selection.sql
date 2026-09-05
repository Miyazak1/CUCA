CREATE TABLE "application_material_selections" (
	"choice_id" uuid PRIMARY KEY NOT NULL,
	"application_set_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"program_intake_id" uuid NOT NULL,
	"target_key" text GENERATED ALWAYS AS (coalesce("program_id"::text, '') || '/' || coalesce("program_intake_id"::text, '')) STORED NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"source_set_revision" integer NOT NULL,
	"source_applicant_revision" integer NOT NULL,
	"source_education_revision" integer NOT NULL,
	"source_assessment_revision" integer NOT NULL,
	"selection_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_material_selection_revision_check" CHECK ("application_material_selections"."revision" > 0 and "application_material_selections"."source_set_revision" > 0 and "application_material_selections"."source_applicant_revision" >= 0 and "application_material_selections"."source_education_revision" >= 0 and "application_material_selections"."source_assessment_revision" >= 0),
	CONSTRAINT "application_material_selection_content_check" CHECK (jsonb_typeof("application_material_selections"."selection_json") = 'object' and octet_length("application_material_selections"."selection_json"::text) <= 8192
    and "application_material_selections"."selection_json" ?& array['applicantFields','educationRecordIds','assessmentRecordIds']
    and "application_material_selections"."selection_json" - array['applicantFields','educationRecordIds','assessmentRecordIds'] = '{}'::jsonb
    and case when jsonb_typeof("application_material_selections"."selection_json"->'applicantFields') = 'array' and jsonb_typeof("application_material_selections"."selection_json"->'educationRecordIds') = 'array' and jsonb_typeof("application_material_selections"."selection_json"->'assessmentRecordIds') = 'array'
      then jsonb_array_length("application_material_selections"."selection_json"->'applicantFields') <= 3 and ("application_material_selections"."selection_json"->'applicantFields') <@ '["fullName","contactEmail","citizenshipCountry"]'::jsonb
        and jsonb_array_length("application_material_selections"."selection_json"->'educationRecordIds') <= 20 and jsonb_array_length("application_material_selections"."selection_json"->'assessmentRecordIds') <= 40 else false end)
);
--> statement-breakpoint
ALTER TABLE "application_material_selections" ADD CONSTRAINT "application_material_selection_scope_fk" FOREIGN KEY ("choice_id","application_set_id","user_id","school_id") REFERENCES "public"."application_choices"("id","application_set_id","user_id","school_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_material_selections" ADD CONSTRAINT "application_material_selection_target_fk" FOREIGN KEY ("choice_id","target_key") REFERENCES "public"."application_choices"("id","target_key") ON DELETE no action ON UPDATE no action;