ALTER TABLE "school_program_intake_versions" DROP CONSTRAINT "school_program_intake_versions_state_check";--> statement-breakpoint
ALTER TABLE "school_program_intake_versions" ALTER COLUMN "source_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "school_program_intake_versions" ADD COLUMN "evidence_type" text DEFAULT 'official_url' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_program_intake_versions" ADD CONSTRAINT "school_program_intake_versions_state_check" CHECK ("school_program_intake_versions"."status" in ('draft','published','superseded','withdrawn')
      and "school_program_intake_versions"."intake_term" in ('spring','summer','fall','winter')
      and "school_program_intake_versions"."intake_year" between 2000 and 2200 and "school_program_intake_versions"."version" > 0
      and ("school_program_intake_versions"."open_date" is null or "school_program_intake_versions"."deadline_date" is null or "school_program_intake_versions"."open_date" < "school_program_intake_versions"."deadline_date")
      and (("school_program_intake_versions"."evidence_type" = 'official_url' and "school_program_intake_versions"."source_url" ~ '^https://[^[:space:]]+$')
        or ("school_program_intake_versions"."evidence_type" = 'school_attestation' and "school_program_intake_versions"."source_url" is null
          and nullif(btrim("school_program_intake_versions"."source_label"), '') is not null and nullif(btrim("school_program_intake_versions"."change_note"), '') is not null)));