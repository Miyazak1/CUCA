-- Existing duplicate pending invites must be reviewed before this migration can succeed.
-- Do not silently revoke or delete invitations while applying a schema migration.
CREATE UNIQUE INDEX "school_staff_invites_pending_school_email_unique"
ON "school_staff_invites" USING btree ("school_id", "email_normalized")
WHERE "status" = 'pending' AND "accepted_at" IS NULL AND "revoked_at" IS NULL;
