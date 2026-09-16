CREATE TABLE "catalog_publication_revisions" (
	"scope_key" text PRIMARY KEY DEFAULT 'public_catalog' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_publication_revisions_scope_check" CHECK ("catalog_publication_revisions"."scope_key" = 'public_catalog'),
	CONSTRAINT "catalog_publication_revisions_revision_check" CHECK ("catalog_publication_revisions"."revision" between 1 and 2147483647)
);
--> statement-breakpoint
INSERT INTO "catalog_publication_revisions" ("scope_key", "revision") VALUES ('public_catalog', 1)
ON CONFLICT ("scope_key") DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION "bump_public_catalog_revision"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.catalog_publication_revisions
  SET revision = revision + 1, updated_at = clock_timestamp()
  WHERE scope_key = 'public_catalog';
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "cities_public_catalog_revision_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "cities"
FOR EACH STATEMENT EXECUTE FUNCTION "bump_public_catalog_revision"();
--> statement-breakpoint
CREATE TRIGGER "schools_public_catalog_revision_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "schools"
FOR EACH STATEMENT EXECUTE FUNCTION "bump_public_catalog_revision"();
--> statement-breakpoint
CREATE TRIGGER "programs_public_catalog_revision_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "programs"
FOR EACH STATEMENT EXECUTE FUNCTION "bump_public_catalog_revision"();
--> statement-breakpoint
CREATE TRIGGER "scholarships_public_catalog_revision_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "scholarships"
FOR EACH STATEMENT EXECUTE FUNCTION "bump_public_catalog_revision"();
