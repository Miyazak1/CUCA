ALTER TABLE "cities" ADD CONSTRAINT "cities_lifecycle_check" CHECK (
      "cities"."status" in ('active','draft','archived')
      and "cities"."verification_status" in ('unverified','verified','stale','disputed','invalid')
      and "cities"."version" > 0
      and ("cities"."monthly_cost_rmb" is null or "cities"."monthly_cost_rmb" >= 0)
      and "cities"."reference_school_count" >= 0
      and "cities"."reference_program_count" >= 0
      and "cities"."reference_english_program_count" >= 0
      and "cities"."reference_scholarship_count" >= 0
      and "cities"."reference_csca_school_count" >= 0);--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_content_shape_check" CHECK (
      jsonb_typeof("cities"."tags") = 'array'
      and jsonb_typeof("cities"."content_json") = 'object'
      and jsonb_typeof("cities"."nearby") = 'array'
      and octet_length(convert_to("cities"."content_json"::text, 'UTF8')) <= 131072);