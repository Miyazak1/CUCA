CREATE TABLE "scholarship_cycle_lineage" (
	"scholarship_id" uuid PRIMARY KEY NOT NULL,
	"series_key" text NOT NULL,
	"cycle_key" text NOT NULL,
	"intake_year" integer NOT NULL,
	"intake_label" text NOT NULL,
	"supersedes_scholarship_id" uuid,
	"official_source_url" text NOT NULL,
	"official_source_sha256" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"registered_by_user_id" uuid,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scholarship_cycle_lineage_series_cycle_unique" UNIQUE("series_key","cycle_key"),
	CONSTRAINT "scholarship_cycle_lineage_check" CHECK (
      "scholarship_cycle_lineage"."series_key" ~ '^[a-z][a-z0-9-]{2,127}$'
      and "scholarship_cycle_lineage"."cycle_key" ~ '^[a-z0-9][a-z0-9-]{2,127}$'
      and "scholarship_cycle_lineage"."intake_year" between 2000 and 2100
      and char_length(btrim("scholarship_cycle_lineage"."intake_label")) between 1 and 200
      and "scholarship_cycle_lineage"."official_source_url" ~ '^https://'
      and "scholarship_cycle_lineage"."official_source_sha256" ~ '^[a-f0-9]{64}$'
      and "scholarship_cycle_lineage"."supersedes_scholarship_id" is distinct from "scholarship_cycle_lineage"."scholarship_id")
);
--> statement-breakpoint
ALTER TABLE "scholarship_cycle_lineage" ADD CONSTRAINT "scholarship_cycle_lineage_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_cycle_lineage" ADD CONSTRAINT "scholarship_cycle_lineage_supersedes_scholarship_id_scholarships_id_fk" FOREIGN KEY ("supersedes_scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_cycle_lineage" ADD CONSTRAINT "scholarship_cycle_lineage_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scholarship_cycle_lineage_intake_year_idx" ON "scholarship_cycle_lineage" USING btree ("intake_year","series_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_scholarship_cycle_lineage_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'scholarship cycle lineage is immutable; register a new cycle instead';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER scholarship_cycle_lineage_immutable
BEFORE UPDATE OR DELETE ON scholarship_cycle_lineage
FOR EACH ROW EXECUTE FUNCTION prevent_scholarship_cycle_lineage_mutation();
