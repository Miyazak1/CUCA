CREATE TABLE "application_reference_counters" (
	"reference_year" integer PRIMARY KEY NOT NULL,
	"last_issued_sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_reference_counters_year_check" CHECK ("application_reference_counters"."reference_year" between 2020 and 9999),
	CONSTRAINT "application_reference_counters_sequence_check" CHECK ("application_reference_counters"."last_issued_sequence" between 1 and 999999)
);
--> statement-breakpoint
ALTER TABLE "application_sets" ADD COLUMN "cuac_reference_year" integer;
--> statement-breakpoint
ALTER TABLE "application_sets" ADD COLUMN "cuac_reference_sequence" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT greatest(2020, extract(year from created_at at time zone 'UTC')::integer) AS reference_year,
        count(*) AS reference_count
      FROM application_sets
      GROUP BY 1
    ) yearly
    WHERE yearly.reference_year > 9999 OR yearly.reference_count > 999999
  ) THEN
    RAISE EXCEPTION 'Existing application sets cannot be represented as CUAC-YYYY-NNNNNN references.';
  END IF;
END $$;
--> statement-breakpoint
WITH ranked AS (
  SELECT id,
    greatest(2020, extract(year from created_at at time zone 'UTC')::integer) AS reference_year,
    row_number() OVER (
      PARTITION BY greatest(2020, extract(year from created_at at time zone 'UTC')::integer)
      ORDER BY created_at, id
    )::integer AS reference_sequence
  FROM application_sets
)
UPDATE application_sets target
SET cuac_reference_year = ranked.reference_year,
  cuac_reference_sequence = ranked.reference_sequence
FROM ranked
WHERE target.id = ranked.id;
--> statement-breakpoint
INSERT INTO application_reference_counters (reference_year, last_issued_sequence)
SELECT cuac_reference_year, max(cuac_reference_sequence)
FROM application_sets
GROUP BY cuac_reference_year;
--> statement-breakpoint
ALTER TABLE "application_sets" ALTER COLUMN "cuac_reference_year" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "application_sets" ALTER COLUMN "cuac_reference_sequence" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "application_sets" ADD COLUMN "cuac_id" text GENERATED ALWAYS AS ('CUAC-' || lpad("cuac_reference_year"::text, 4, '0') || '-' || lpad("cuac_reference_sequence"::text, 6, '0')) STORED NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "cuac_id" text;
--> statement-breakpoint
UPDATE invoices invoice
SET cuac_id = application_set.cuac_id
FROM application_sets application_set
WHERE application_set.id = invoice.application_set_id;
--> statement-breakpoint
ALTER TABLE "school_applications" ADD COLUMN "cuac_id" text;
--> statement-breakpoint
UPDATE school_applications school_application
SET cuac_id = application_set.cuac_id
FROM application_sets application_set
WHERE school_application.application_set_id = application_set.id;
--> statement-breakpoint
CREATE UNIQUE INDEX "application_sets_id_cuac_id_unique" ON "application_sets" USING btree ("id","cuac_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "application_sets_cuac_id_unique" ON "application_sets" USING btree ("cuac_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "application_sets_cuac_allocation_unique" ON "application_sets" USING btree ("cuac_reference_year","cuac_reference_sequence");
--> statement-breakpoint
CREATE INDEX "invoices_cuac_id_idx" ON "invoices" USING btree ("cuac_id");
--> statement-breakpoint
CREATE INDEX "school_applications_school_cuac_id_idx" ON "school_applications" USING btree ("school_id","cuac_id");
--> statement-breakpoint
ALTER TABLE "application_sets" ADD CONSTRAINT "application_sets_cuac_year_check" CHECK ("application_sets"."cuac_reference_year" between 2020 and 9999);
--> statement-breakpoint
ALTER TABLE "application_sets" ADD CONSTRAINT "application_sets_cuac_sequence_check" CHECK ("application_sets"."cuac_reference_sequence" between 1 and 999999);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cuac_id_check" CHECK ("invoices"."cuac_id" is null or "invoices"."cuac_id" ~ '^CUAC-[0-9]{4}-[0-9]{6}$');
--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_cuac_id_check" CHECK ("school_applications"."cuac_id" is null or "school_applications"."cuac_id" ~ '^CUAC-[0-9]{4}-[0-9]{6}$');
--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_v2_cuac_id_required_check" CHECK ("school_applications"."application_record_format" = 'cuac.program-application.v1' or "school_applications"."cuac_id" is not null);
--> statement-breakpoint
ALTER TABLE "school_applications" ADD CONSTRAINT "school_applications_cuac_scope_fk" FOREIGN KEY ("application_set_id","cuac_id") REFERENCES "public"."application_sets"("id","cuac_id") ON DELETE cascade ON UPDATE no action;
