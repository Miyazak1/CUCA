CREATE TABLE "school_logo_versions" (
	"school_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"bytes" "bytea",
	"sha256" text,
	"width" integer,
	"height" integer,
	"source_url" text,
	"source_note" text DEFAULT '' NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_logo_versions_school_id_version_pk" PRIMARY KEY("school_id","version"),
	CONSTRAINT "school_logo_version_check" CHECK ("school_logo_versions"."version" between 1 and 2147483647),
	CONSTRAINT "school_logo_payload_check" CHECK (("school_logo_versions"."bytes" is null and "school_logo_versions"."sha256" is null and "school_logo_versions"."width" is null and "school_logo_versions"."height" is null and "school_logo_versions"."source_url" is null) or
    ("school_logo_versions"."bytes" is not null and "school_logo_versions"."sha256" is not null and "school_logo_versions"."width" is not null and "school_logo_versions"."height" is not null and "school_logo_versions"."source_url" is not null and octet_length("school_logo_versions"."bytes") between 57 and 1048576 and "school_logo_versions"."sha256" ~ '^[a-f0-9]{64}$'
     and "school_logo_versions"."width" between 16 and 2048 and "school_logo_versions"."height" between 16 and 2048 and "school_logo_versions"."source_url" like 'https://%')),
	CONSTRAINT "school_logo_note_check" CHECK (length("school_logo_versions"."source_note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "school_logo_versions" ADD CONSTRAINT "school_logo_versions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_logo_versions" ADD CONSTRAINT "school_logo_versions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;