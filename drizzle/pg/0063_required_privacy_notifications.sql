ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_security_check";--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_security_check" CHECK ("notification_preferences"."topic" not in ('account_security','privacy_requests')
    or ("notification_preferences"."in_app_enabled" and "notification_preferences"."email_enabled"));
