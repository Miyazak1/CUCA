CREATE TABLE "agent_tool_rate_limit_buckets" (
	"tool_key" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agent_tool_rate_limit_buckets_tool_key_check" CHECK ("agent_tool_rate_limit_buckets"."tool_key" ~ '^[a-z][a-z0-9_.]{2,95}$'),
	CONSTRAINT "agent_tool_rate_limit_buckets_key_hash_check" CHECK ("agent_tool_rate_limit_buckets"."key_hash" ~ '^sha256:[a-f0-9]{64}$'),
	CONSTRAINT "agent_tool_rate_limit_buckets_window_check" CHECK ("agent_tool_rate_limit_buckets"."window_seconds" between 1 and 86400 and "agent_tool_rate_limit_buckets"."attempt_count" between 1 and 2147483647
        and isfinite("agent_tool_rate_limit_buckets"."window_start") and isfinite("agent_tool_rate_limit_buckets"."expires_at") and isfinite("agent_tool_rate_limit_buckets"."last_attempt_at")
        and "agent_tool_rate_limit_buckets"."expires_at" = "agent_tool_rate_limit_buckets"."window_start" + ("agent_tool_rate_limit_buckets"."window_seconds" * interval '1 second')
        and "agent_tool_rate_limit_buckets"."last_attempt_at" >= "agent_tool_rate_limit_buckets"."window_start" and "agent_tool_rate_limit_buckets"."last_attempt_at" < "agent_tool_rate_limit_buckets"."expires_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tool_rate_limit_buckets_tool_key_hash_window_unique" ON "agent_tool_rate_limit_buckets" USING btree ("tool_key","key_hash","window_start");--> statement-breakpoint
CREATE INDEX "agent_tool_rate_limit_buckets_key_expires_idx" ON "agent_tool_rate_limit_buckets" USING btree ("key_hash","expires_at");--> statement-breakpoint
CREATE INDEX "agent_tool_rate_limit_buckets_tool_expires_idx" ON "agent_tool_rate_limit_buckets" USING btree ("tool_key","expires_at");