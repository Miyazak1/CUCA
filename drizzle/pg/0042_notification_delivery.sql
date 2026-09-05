CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"audience_role" text NOT NULL,
	"tenant_school_id" uuid,
	"scope_key" text GENERATED ALWAYS AS ("audience_role" || '/' || coalesce("tenant_school_id"::text, 'global')) STORED NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_path" text,
	"content_sha256" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" uuid,
	"lease_expires_at" timestamp with time zone,
	"outcome" text,
	"provider_message_id_hash" text,
	"delivered_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"actioned_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_scope_check" CHECK ((
      "notification_deliveries"."audience_role" = 'school_staff' and "notification_deliveries"."tenant_school_id" is not null
    ) or (
      "notification_deliveries"."audience_role" in ('student','cuac_ops','cuac_admin') and "notification_deliveries"."tenant_school_id" is null
    )),
	CONSTRAINT "notification_deliveries_content_check" CHECK (char_length("notification_deliveries"."title") between 1 and 160
    and char_length("notification_deliveries"."body") between 1 and 2000
    and ("notification_deliveries"."action_path" is null or (char_length("notification_deliveries"."action_path") between 1 and 512 and "notification_deliveries"."action_path" like '/%'))
    and "notification_deliveries"."content_sha256" ~ '^[a-f0-9]{64}$' and "notification_deliveries"."revision" between 0 and 2147483647
    and "notification_deliveries"."attempt_count" between 0 and 5
    and ("notification_deliveries"."provider_message_id_hash" is null or "notification_deliveries"."provider_message_id_hash" ~ '^[a-f0-9]{64}$')
    and isfinite("notification_deliveries"."available_at")),
	CONSTRAINT "notification_deliveries_lifecycle_check" CHECK ((
      "notification_deliveries"."channel" = 'in_app' and "notification_deliveries"."status" = 'unread' and "notification_deliveries"."delivered_at" is not null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is null and "notification_deliveries"."attempt_count" = 0 and "notification_deliveries"."lease_id" is null
      and "notification_deliveries"."lease_expires_at" is null and "notification_deliveries"."outcome" is null and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" = 'in_app' and "notification_deliveries"."status" = 'read' and "notification_deliveries"."delivered_at" is not null
      and "notification_deliveries"."viewed_at" is not null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is null and "notification_deliveries"."attempt_count" = 0 and "notification_deliveries"."lease_id" is null
      and "notification_deliveries"."lease_expires_at" is null and "notification_deliveries"."outcome" is null and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" = 'in_app' and "notification_deliveries"."status" = 'archived' and "notification_deliveries"."delivered_at" is not null
      and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is not null and "notification_deliveries"."completed_at" is not null
      and "notification_deliveries"."attempt_count" = 0 and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and "notification_deliveries"."outcome" is null and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" = 'in_app' and "notification_deliveries"."status" = 'actioned' and "notification_deliveries"."delivered_at" is not null
      and "notification_deliveries"."actioned_at" is not null and "notification_deliveries"."archived_at" is null and "notification_deliveries"."completed_at" is not null
      and "notification_deliveries"."attempt_count" = 0 and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and "notification_deliveries"."outcome" is null and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" in ('email','sms') and "notification_deliveries"."status" = 'queued' and "notification_deliveries"."delivered_at" is null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is null and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and ("notification_deliveries"."outcome" is null or "notification_deliveries"."outcome" = 'not_accepted') and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" in ('email','sms') and "notification_deliveries"."status" in ('leased','sending') and "notification_deliveries"."delivered_at" is null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is null and "notification_deliveries"."lease_id" is not null and "notification_deliveries"."lease_expires_at" is not null
      and "notification_deliveries"."outcome" is null and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" in ('email','sms') and "notification_deliveries"."status" = 'accepted' and "notification_deliveries"."delivered_at" is not null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is not null and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and "notification_deliveries"."outcome" = 'accepted'
    ) or (
      "notification_deliveries"."channel" in ('email','sms') and "notification_deliveries"."status" = 'suppressed' and "notification_deliveries"."delivered_at" is null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is not null and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and "notification_deliveries"."outcome" in ('preference_disabled','destination_unavailable','ineligible')
      and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" in ('email','sms') and "notification_deliveries"."status" = 'failed' and "notification_deliveries"."delivered_at" is null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is not null and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and "notification_deliveries"."outcome" = 'attempt_limit' and "notification_deliveries"."provider_message_id_hash" is null
    ) or (
      "notification_deliveries"."channel" in ('email','sms') and "notification_deliveries"."status" = 'uncertain' and "notification_deliveries"."delivered_at" is null
      and "notification_deliveries"."viewed_at" is null and "notification_deliveries"."actioned_at" is null and "notification_deliveries"."archived_at" is null
      and "notification_deliveries"."completed_at" is not null and "notification_deliveries"."lease_id" is null and "notification_deliveries"."lease_expires_at" is null
      and "notification_deliveries"."outcome" in ('unknown','lease_expired') and "notification_deliveries"."provider_message_id_hash" is null
    ))
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"audience_role" text NOT NULL,
	"tenant_school_id" uuid,
	"scope_key" text GENERATED ALWAYS AS ("audience_role" || '/' || coalesce("tenant_school_id"::text, 'global')) STORED NOT NULL,
	"topic" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"event_key_sha256" text NOT NULL,
	"variables_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variables_sha256" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_events_id_recipient_scope_unique" UNIQUE("id","recipient_user_id","scope_key"),
	CONSTRAINT "notification_events_scope_check" CHECK ((
      "notification_events"."audience_role" = 'school_staff' and "notification_events"."tenant_school_id" is not null
    ) or (
      "notification_events"."audience_role" in ('student','cuac_ops','cuac_admin') and "notification_events"."tenant_school_id" is null
    )),
	CONSTRAINT "notification_events_format_check" CHECK ("notification_events"."topic" ~ '^[a-z][a-z0-9_]{0,63}$'
    and "notification_events"."event_type" ~ '^[a-z][a-z0-9_.]{0,127}$'
    and "notification_events"."resource_type" ~ '^[a-z][a-z0-9_]{0,63}$' and char_length("notification_events"."resource_id") between 1 and 128
    and "notification_events"."event_key_sha256" ~ '^[a-f0-9]{64}$' and "notification_events"."variables_sha256" ~ '^[a-f0-9]{64}$'
    and jsonb_typeof("notification_events"."variables_json") = 'object' and octet_length("notification_events"."variables_json"::text) <= 8192
    and isfinite("notification_events"."occurred_at"))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"audience_role" text NOT NULL,
	"tenant_school_id" uuid,
	"scope_key" text GENERATED ALWAYS AS ("audience_role" || '/' || coalesce("tenant_school_id"::text, 'global')) STORED NOT NULL,
	"topic" text NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_scope_check" CHECK ((
      "notification_preferences"."audience_role" = 'school_staff' and "notification_preferences"."tenant_school_id" is not null
    ) or (
      "notification_preferences"."audience_role" in ('student','cuac_ops','cuac_admin') and "notification_preferences"."tenant_school_id" is null
    )),
	CONSTRAINT "notification_preferences_topic_check" CHECK ("notification_preferences"."topic" ~ '^[a-z][a-z0-9_]{0,63}$'),
	CONSTRAINT "notification_preferences_revision_check" CHECK ("notification_preferences"."revision" between 0 and 2147483647),
	CONSTRAINT "notification_preferences_security_check" CHECK ("notification_preferences"."topic" <> 'account_security'
    or ("notification_preferences"."in_app_enabled" and "notification_preferences"."email_enabled"))
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"audience_role" text NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer NOT NULL,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"action_path_template" text,
	"variable_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_id_role_channel_unique" UNIQUE("id","audience_role","channel"),
	CONSTRAINT "notification_templates_format_check" CHECK ("notification_templates"."template_key" ~ '^[a-z][a-z0-9_.-]{0,127}$'
    and "notification_templates"."audience_role" in ('student','school_staff','cuac_ops','cuac_admin')
    and "notification_templates"."channel" in ('in_app','email','sms') and "notification_templates"."locale" in ('en','zh-CN')
    and "notification_templates"."version" between 1 and 2147483647 and char_length("notification_templates"."title_template") between 1 and 160
    and char_length("notification_templates"."body_template") between 1 and 2000
    and ("notification_templates"."action_path_template" is null or (char_length("notification_templates"."action_path_template") between 1 and 512
      and "notification_templates"."action_path_template" like '/%'))
    and jsonb_typeof("notification_templates"."variable_keys_json") = 'array' and octet_length("notification_templates"."variable_keys_json"::text) <= 2048
    and "notification_templates"."content_sha256" ~ '^[a-f0-9]{64}$' and "notification_templates"."status" in ('active','retired'))
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_scope_fk" FOREIGN KEY ("event_id","recipient_user_id","scope_key") REFERENCES "public"."notification_events"("id","recipient_user_id","scope_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_scope_fk" FOREIGN KEY ("template_id","audience_role","channel") REFERENCES "public"."notification_templates"("id","audience_role","channel") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_school_id_schools_id_fk" FOREIGN KEY ("tenant_school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_event_channel_unique" ON "notification_deliveries" USING btree ("event_id","channel");--> statement-breakpoint
CREATE INDEX "notification_deliveries_recipient_scope_status_idx" ON "notification_deliveries" USING btree ("recipient_user_id","scope_key","channel","status","created_at","id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_queue_idx" ON "notification_deliveries" USING btree ("channel","status","available_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_event_key_unique" ON "notification_events" USING btree ("event_key_sha256");--> statement-breakpoint
CREATE INDEX "notification_events_recipient_scope_created_idx" ON "notification_events" USING btree ("recipient_user_id","scope_key","created_at","id");--> statement-breakpoint
CREATE INDEX "notification_events_resource_idx" ON "notification_events" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_scope_topic_unique" ON "notification_preferences" USING btree ("user_id","scope_key","topic");--> statement-breakpoint
CREATE INDEX "notification_preferences_user_scope_idx" ON "notification_preferences" USING btree ("user_id","scope_key","topic");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_version_unique" ON "notification_templates" USING btree ("template_key","audience_role","channel","locale","version");--> statement-breakpoint
CREATE INDEX "notification_templates_active_lookup_idx" ON "notification_templates" USING btree ("template_key","audience_role","channel","locale","status");