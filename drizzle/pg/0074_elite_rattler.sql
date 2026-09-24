ALTER TABLE "schools" ADD CONSTRAINT "schools_lifecycle_check" CHECK (
      "schools"."status" in ('active','draft','archived')
      and "schools"."verification_status" in ('unverified','verified','stale','disputed','invalid')
      and "schools"."version" > 0
      and ("schools"."quality_score" is null or "schools"."quality_score" between 0 and 100));--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_collection_shape_check" CHECK (
      jsonb_typeof("schools"."csca_subjects") = 'array'
      and jsonb_typeof("schools"."subject_tags") = 'array'
      and jsonb_typeof("schools"."language_tags") = 'array'
      and jsonb_typeof("schools"."campus_highlights") = 'array'
      and jsonb_typeof("schools"."missing_fields") = 'array'
      and jsonb_typeof("schools"."source_field_lineage_json") = 'object');