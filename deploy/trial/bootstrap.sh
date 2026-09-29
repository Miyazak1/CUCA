#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: ./bootstrap.sh <public-ipv4>" >&2
  exit 1
fi

public_ip="$1"
case "$public_ip" in
  *[!0-9.]*|.*|*..*|*.) echo "A plain public IPv4 address is required." >&2; exit 1 ;;
esac

old_ifs="$IFS"
IFS=.
set -- $public_ip
IFS="$old_ifs"
if [ "$#" -ne 4 ]; then
  echo "A plain public IPv4 address is required." >&2
  exit 1
fi
for octet in "$@"; do
  if [ "$octet" -gt 255 ] 2>/dev/null; then
    echo "A valid public IPv4 address is required." >&2
    exit 1
  fi
done

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env_file="$script_dir/.env"
if [ -e "$env_file" ]; then
  echo "$env_file already exists; refusing to replace trial secrets." >&2
  exit 1
fi

random_secret() {
  openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'
}

new_uuid() {
  cat /proc/sys/kernel/random/uuid
}

trial_host=$(printf '%s' "$public_ip" | tr '.' '-').sslip.io
installation_id=$(new_uuid)
short_id=$(printf '%s' "$installation_id" | cut -c1-8)
database_password=$(random_secret)
session_secret=$(random_secret)
material_key=$(random_secret)
auth_email_key=$(random_secret)
shared_password=$(random_secret)
application_set_id=$(new_uuid)
choice_1=$(new_uuid)
choice_2=$(new_uuid)
choice_3=$(new_uuid)

umask 077
cat >"$env_file" <<EOF
CUAC_TRIAL_HOST=$trial_host
CUAC_DB_PASSWORD=$database_password
NODE_ENV=production
CUAC_ENV=development
DEPLOY_ENV=development
CUAC_RELEASE_SCOPE=school-handoff-v1
CUAC_START_MODE=development
CUAC_LOCAL_RUNTIME=1
CUAC_LOCAL_INSTALLATION_ID=$installation_id
CUAC_MIGRATION_TARGET_ENV=development
DATABASE_URL=postgresql://cuac_local:$database_password@127.0.0.1:55432/cuac_local
PGSSLMODE=disable
PORT=3000
CUAC_HTTP_HOST=127.0.0.1
CUAC_PUBLIC_APP_URL=https://$trial_host
CUAC_REQUIRE_PRODUCTION_READY=false
CUAC_SESSION_SECRET=$session_secret
CUAC_AUTH_RATE_LIMIT_ENFORCED=true
CUAC_AUTH_RATE_LIMIT_BACKEND=postgres
CUAC_AUTH_MFA_ACTIVE_KEY_ID=local-v1
CUAC_AUTH_MFA_KEYS_JSON={"local-v1":"$session_secret"}
CUAC_AUTH_EMAIL_DELIVERY_PROVIDER=disabled
CUAC_AUTH_EMAIL_FROM=no-reply@$trial_host
CUAC_AUTH_EMAIL_VERIFICATION_PATH=/auth/verify-email
CUAC_AUTH_PASSWORD_RESET_PATH=/auth/reset-password
CUAC_AUTH_SCHOOL_INVITE_PATH=/auth/school-invite
CUAC_AUTH_GUARDIAN_CONSENT_PATH=/auth-guardian-consent.html
CUAC_AUTH_EMAIL_SMTP_REGION=ap-southeast-1
CUAC_AUTH_EMAIL_SMTP_USERNAME=
CUAC_AUTH_EMAIL_SMTP_PASSWORD=
CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID=trial-auth-v1
CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON={"trial-auth-v1":"$auth_email_key"}
CUAC_AUTH_EMAIL_WORKER_POLL_MS=1000
CUAC_AUTH_EMAIL_WORKER_RECOVERY_MS=60000
CUAC_AUTH_EMAIL_WORKER_SUPERVISED=false
CUAC_AUTH_EMAIL_STAGING_ACCEPTED=false
CUAC_NOTIFICATION_EMAIL_PROVIDER=disabled
CUAC_AGENT_ENABLED=false
CUAC_AGENT_TOOL_GATEWAY_MODE=disabled
CUAC_AGENT_SANDBOX_MODE=disabled
CUAC_AGENT_DIRECT_DB_ACCESS=false
CUAC_PAYMENT_MODE=disabled
CUAC_FILE_UPLOAD_ENABLED=false
CUAC_SUBMISSION_DELIVERY_PROVIDER=disabled
CUAC_APPLICATION_FEE_MINOR=80000
CUAC_SERVICE_FEE_MINOR=0
CUAC_BILLING_CURRENCY=CNY
CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID=local-v1
CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON={"local-v1":"$material_key"}
CUAC_LOCAL_STUDENT_EMAIL=student+$short_id@local.cuac.invalid
CUAC_LOCAL_STUDENT_PASSWORD=$shared_password
CUAC_LOCAL_SCHOOL_EMAIL=school+$short_id@local.cuac.invalid
CUAC_LOCAL_SCHOOL_PASSWORD=$shared_password
CUAC_LOCAL_OPS_EMAIL=ops+$short_id@local.cuac.invalid
CUAC_LOCAL_OPS_PASSWORD=$shared_password
CUAC_LOCAL_ADMIN_EMAIL=admin+$short_id@local.cuac.invalid
CUAC_LOCAL_ADMIN_PASSWORD=$shared_password
CUAC_LOCAL_APPLICATION_SET_ID=$application_set_id
CUAC_LOCAL_CHOICE_IDS_JSON=["$choice_1","$choice_2","$choice_3"]
EOF
chmod 600 "$env_file"

echo "Trial configuration created."
echo "URL: https://$trial_host"
echo "Run: docker compose up -d --build"
