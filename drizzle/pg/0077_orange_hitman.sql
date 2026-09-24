CREATE TABLE "catalog_release_manifest_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifest_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_version" integer NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"readiness_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_release_manifest_items_position_unique" UNIQUE("manifest_id","position"),
	CONSTRAINT "catalog_release_manifest_items_entity_unique" UNIQUE("manifest_id","entity_type","entity_id"),
	CONSTRAINT "catalog_release_manifest_items_snapshot_check" CHECK (
      "catalog_release_manifest_items"."position" >= 0 and "catalog_release_manifest_items"."entity_version" > 0
      and "catalog_release_manifest_items"."entity_type" in ('city','school','program','scholarship')
      and char_length(btrim("catalog_release_manifest_items"."slug")) between 1 and 200
      and char_length(btrim("catalog_release_manifest_items"."label")) between 1 and 500
      and jsonb_typeof("catalog_release_manifest_items"."readiness_snapshot_json") = 'object'
      and "catalog_release_manifest_items"."readiness_snapshot_json"->>'ready' = 'true'
      and jsonb_typeof("catalog_release_manifest_items"."readiness_snapshot_json"->'blockingReasons') = 'array'
      and jsonb_array_length("catalog_release_manifest_items"."readiness_snapshot_json"->'blockingReasons') = 0
      and jsonb_typeof("catalog_release_manifest_items"."readiness_snapshot_json"->'warningReasons') = 'array'
      and octet_length(convert_to("catalog_release_manifest_items"."readiness_snapshot_json"::text, 'UTF8')) <= 16384)
);
--> statement-breakpoint
CREATE TABLE "catalog_release_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'frozen' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"selection_sha256" text NOT NULL,
	"created_by_user_id" uuid,
	"superseded_by_user_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_release_manifests_lifecycle_check" CHECK (
      char_length(btrim("catalog_release_manifests"."title")) between 1 and 200
      and "catalog_release_manifests"."status" in ('frozen','superseded')
      and "catalog_release_manifests"."version" > 0
      and "catalog_release_manifests"."selection_sha256" ~ '^[a-f0-9]{64}$'
      and (("catalog_release_manifests"."status" = 'frozen' and "catalog_release_manifests"."superseded_at" is null and "catalog_release_manifests"."superseded_by_user_id" is null)
        or ("catalog_release_manifests"."status" = 'superseded' and "catalog_release_manifests"."superseded_at" is not null and "catalog_release_manifests"."superseded_by_user_id" is not null)))
);
--> statement-breakpoint
ALTER TABLE "catalog_release_manifest_items" ADD CONSTRAINT "catalog_release_manifest_items_manifest_id_catalog_release_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."catalog_release_manifests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_release_manifests" ADD CONSTRAINT "catalog_release_manifests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_release_manifests" ADD CONSTRAINT "catalog_release_manifests_superseded_by_user_id_users_id_fk" FOREIGN KEY ("superseded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_release_manifest_items_entity_idx" ON "catalog_release_manifest_items" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "catalog_release_manifests_created_idx" ON "catalog_release_manifests" USING btree ("status","created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_catalog_release_manifest_item_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'catalog release manifest items are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER catalog_release_manifest_items_immutable
BEFORE UPDATE OR DELETE ON catalog_release_manifest_items
FOR EACH ROW EXECUTE FUNCTION prevent_catalog_release_manifest_item_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_catalog_release_manifest_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'catalog release manifests cannot be deleted';
  END IF;
  IF NOT (
    OLD.status = 'frozen' AND NEW.status = 'superseded'
    AND NEW.version = OLD.version + 1
    AND NEW.id = OLD.id AND NEW.title = OLD.title
    AND NEW.selection_sha256 = OLD.selection_sha256
    AND NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
    AND NEW.created_at = OLD.created_at
    AND NEW.superseded_by_user_id IS NOT NULL AND NEW.superseded_at IS NOT NULL
    AND NEW.updated_at >= OLD.updated_at
  ) THEN
    RAISE EXCEPTION 'catalog release manifest is immutable except for frozen to superseded transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER catalog_release_manifests_guard
BEFORE UPDATE OR DELETE ON catalog_release_manifests
FOR EACH ROW EXECUTE FUNCTION guard_catalog_release_manifest_mutation();
