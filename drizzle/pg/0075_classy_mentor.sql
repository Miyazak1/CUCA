ALTER TABLE "programs" ADD CONSTRAINT "programs_catalog_lifecycle_check" CHECK ("programs"."version" > 0
      and "programs"."status" in ('draft','active','archived')
      and "programs"."verification_status" in ('unverified','verified','stale','disputed','invalid')
      and ("programs"."duration_years" is null or "programs"."duration_years" between 0 and 20)
      and ("programs"."duration_months" is null or "programs"."duration_months" between 0 and 240)
      and ("programs"."tuition_amount" is null or "programs"."tuition_amount" >= 0)
      and ("programs"."tuition_currency" is null or "programs"."tuition_currency" ~ '^[A-Z]{3}$')
      and jsonb_typeof("programs"."csca_subjects") = 'array'
      and jsonb_typeof("programs"."display_subjects") = 'array'
      and jsonb_typeof("programs"."source_field_lineage_json") = 'object');