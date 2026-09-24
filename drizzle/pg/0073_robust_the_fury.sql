CREATE TABLE "catalog_entity_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_version" integer NOT NULL,
	"action" text NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"changed_fields_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_evidence_id" uuid,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_entity_revisions_entity_version_unique" UNIQUE("entity_type","entity_id","entity_version"),
	CONSTRAINT "catalog_entity_revisions_lifecycle_check" CHECK (
      "catalog_entity_revisions"."entity_type" in ('city','school','program','scholarship')
      and "catalog_entity_revisions"."entity_version" > 0
      and "catalog_entity_revisions"."action" in ('created','updated','published','archived','restored')
      and jsonb_typeof("catalog_entity_revisions"."snapshot_json") = 'object'
      and jsonb_typeof("catalog_entity_revisions"."changed_fields_json") = 'array'
      and octet_length(convert_to("catalog_entity_revisions"."snapshot_json"::text, 'UTF8')) <= 262144)
);
--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_entity_revisions" ADD CONSTRAINT "catalog_entity_revisions_source_evidence_id_catalog_source_evidence_id_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "public"."catalog_source_evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_entity_revisions" ADD CONSTRAINT "catalog_entity_revisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_entity_revisions_entity_created_idx" ON "catalog_entity_revisions" USING btree ("entity_type","entity_id","created_at");