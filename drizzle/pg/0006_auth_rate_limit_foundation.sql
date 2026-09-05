CREATE TABLE "auth_rate_limit_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_rate_limit_buckets_action_key_window_unique" ON "auth_rate_limit_buckets" USING btree ("action","key_hash","window_start");--> statement-breakpoint
CREATE INDEX "auth_rate_limit_buckets_key_expires_idx" ON "auth_rate_limit_buckets" USING btree ("key_hash","expires_at");--> statement-breakpoint
CREATE INDEX "auth_rate_limit_buckets_action_expires_idx" ON "auth_rate_limit_buckets" USING btree ("action","expires_at");
