ALTER TABLE "school_catalog_correction_requests" DROP CONSTRAINT "school_catalog_correction_requests_request_check";--> statement-breakpoint
ALTER TABLE "school_catalog_correction_requests" ADD CONSTRAINT "school_catalog_correction_requests_request_check" CHECK (
      "school_catalog_correction_requests"."requested_membership_role" in ('admissions','counselor','school_admin')
      and "school_catalog_correction_requests"."reason_code" in ('official_website_changed','admissions_route_changed','fee_information_changed',
        'language_information_changed','outdated_public_information')
      and jsonb_typeof("school_catalog_correction_requests"."change_set_json") = 'object'
      and octet_length(convert_to("school_catalog_correction_requests"."change_set_json"::text, 'UTF8')) between 2 and 8192
      and "school_catalog_correction_requests"."evidence_url" ~ '^https://[^[:space:]]+$'
      and char_length("school_catalog_correction_requests"."evidence_url") between 9 and 2048
      and isfinite("school_catalog_correction_requests"."source_school_updated_at"));