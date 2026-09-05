LOCK TABLE "cuac_staff_access_grants" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "cuac_staff_access_grants"
    WHERE "requested_surface" <> 'cuac_internal'
      OR "requested_role" NOT IN ('cuac_ops', 'cuac_admin')
      OR "status" NOT IN ('pending', 'approved', 'revoked', 'expired')
      OR char_length("email_normalized") NOT BETWEEN 3 AND 320
      OR "email_normalized" <> lower(trim("email_normalized"))
      OR ("token_hash" IS NOT NULL AND "token_hash" !~ '^sha256:[a-f0-9]{64}$')
      OR (
        "status" = 'approved' AND (
          "user_id" IS NULL
          OR "approved_by_user_id" IS NULL
          OR "approved_by_user_id" = "user_id"
          OR "approved_at" IS NULL
          OR "approved_at" < "created_at"
          OR "expires_at" IS NULL
          OR "expires_at" <= "approved_at"
          OR "revoked_at" IS NOT NULL
          OR "reason" IS NULL
          OR char_length(trim("reason")) NOT BETWEEN 1 AND 500
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Existing CUAC staff access grants require reviewed lifecycle reconciliation.';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "cuac_staff_access_grants"
    WHERE "status" = 'approved' AND "revoked_at" IS NULL
    GROUP BY "user_id", "requested_role"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Existing CUAC staff access grants contain duplicate active role authority.';
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX "cuac_staff_access_grants_authority_lookup_idx" ON "cuac_staff_access_grants" USING btree ("user_id","requested_role","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cuac_staff_access_grants_active_user_role_unique" ON "cuac_staff_access_grants" USING btree ("user_id","requested_role") WHERE "cuac_staff_access_grants"."status" = 'approved' and "cuac_staff_access_grants"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_surface_check" CHECK ("cuac_staff_access_grants"."requested_surface" = 'cuac_internal');--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_role_check" CHECK ("cuac_staff_access_grants"."requested_role" in ('cuac_ops','cuac_admin'));--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_status_check" CHECK ("cuac_staff_access_grants"."status" in ('pending','approved','revoked','expired'));--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_email_check" CHECK (char_length("cuac_staff_access_grants"."email_normalized") between 3 and 320
      and "cuac_staff_access_grants"."email_normalized" = lower(trim("cuac_staff_access_grants"."email_normalized")));--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_token_hash_check" CHECK ("cuac_staff_access_grants"."token_hash" is null
      or "cuac_staff_access_grants"."token_hash" ~ '^sha256:[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "cuac_staff_access_grants" ADD CONSTRAINT "cuac_staff_access_grants_approved_lifecycle_check" CHECK ("cuac_staff_access_grants"."status" <> 'approved' or (
      "cuac_staff_access_grants"."user_id" is not null and "cuac_staff_access_grants"."approved_by_user_id" is not null
      and "cuac_staff_access_grants"."approved_by_user_id" <> "cuac_staff_access_grants"."user_id"
      and "cuac_staff_access_grants"."approved_at" is not null and "cuac_staff_access_grants"."approved_at" >= "cuac_staff_access_grants"."created_at"
      and "cuac_staff_access_grants"."expires_at" is not null and "cuac_staff_access_grants"."expires_at" > "cuac_staff_access_grants"."approved_at"
      and "cuac_staff_access_grants"."revoked_at" is null and "cuac_staff_access_grants"."reason" is not null
      and char_length(trim("cuac_staff_access_grants"."reason")) between 1 and 500
    ));
