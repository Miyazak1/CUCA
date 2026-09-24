ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_catalog_lifecycle_check" CHECK ("scholarships"."version" > 0
      and "scholarships"."status" in ('draft','active','archived')
      and "scholarships"."verification_status" in ('unverified','verified','stale','disputed','invalid')
      and jsonb_typeof("scholarships"."body_sections") = 'array'
      and jsonb_typeof("scholarships"."benefit_items") = 'array'
      and jsonb_typeof("scholarships"."eligibility_items") = 'array'
      and jsonb_typeof("scholarships"."application_materials") = 'array'
      and jsonb_typeof("scholarships"."application_steps") = 'array'
      and jsonb_typeof("scholarships"."contact_info") = 'object'
      and jsonb_typeof("scholarships"."action_links") = 'array'
      and jsonb_typeof("scholarships"."target_countries") = 'array'
      and jsonb_typeof("scholarships"."target_regions") = 'array'
      and jsonb_typeof("scholarships"."benefits") = 'array'
      and jsonb_typeof("scholarships"."tags") = 'array'
      and jsonb_typeof("scholarships"."source_field_lineage_json") = 'object');