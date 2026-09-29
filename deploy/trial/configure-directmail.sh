#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: ./configure-directmail.sh <https-origin> <sender-address> <region>" >&2
  echo "Example: ./configure-directmail.sh https://ucac.cn no-reply@notice.ucac.cn ap-southeast-1" >&2
  exit 1
fi

public_origin=$1
sender_address=$2
region=$3
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env_file="$script_dir/.env"

[[ -f "$env_file" ]] || { echo "$env_file does not exist; run bootstrap.sh first." >&2; exit 1; }
[[ "$public_origin" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo "The public origin must be one HTTPS origin without a path." >&2; exit 1; }
[[ "$sender_address" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "A complete sender email address is required." >&2; exit 1; }
case "$region" in
  cn-hangzhou|ap-southeast-1|us-east-1|eu-central-1) ;;
  *) echo "Unsupported DirectMail region." >&2; exit 1 ;;
esac

printf 'SMTP password for %s (input is hidden): ' "$sender_address"
stty -echo
trap 'stty echo' EXIT
IFS= read -r smtp_password
stty echo
trap - EXIT
printf '\n'

[[ -n "$smtp_password" ]] || { echo "SMTP password cannot be empty." >&2; exit 1; }
[[ "$smtp_password" =~ ^[A-Za-z0-9._~!@%+=,:/-]+$ ]] || {
  echo "For safe dotenv storage, use an SMTP password containing letters, numbers, or ._~!@%+=,:/- only." >&2
  exit 1
}

outbox_key=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')
declare -A updates=(
  [CUAC_PUBLIC_APP_URL]="$public_origin"
  [CUAC_AUTH_EMAIL_DELIVERY_PROVIDER]="aliyun-directmail-smtp"
  [CUAC_AUTH_EMAIL_FROM]="$sender_address"
  [CUAC_AUTH_EMAIL_VERIFICATION_PATH]="/auth/verify-email"
  [CUAC_AUTH_PASSWORD_RESET_PATH]="/auth/reset-password"
  [CUAC_AUTH_SCHOOL_INVITE_PATH]="/auth/school-invite"
  [CUAC_AUTH_GUARDIAN_CONSENT_PATH]="/auth-guardian-consent.html"
  [CUAC_AUTH_EMAIL_SMTP_REGION]="$region"
  [CUAC_AUTH_EMAIL_SMTP_USERNAME]="$sender_address"
  [CUAC_AUTH_EMAIL_SMTP_PASSWORD]="$smtp_password"
  [CUAC_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_ID]="trial-auth-v1"
  [CUAC_AUTH_EMAIL_OUTBOX_KEYS_JSON]="{\"trial-auth-v1\":\"$outbox_key\"}"
  [CUAC_AUTH_EMAIL_WORKER_POLL_MS]="1000"
  [CUAC_AUTH_EMAIL_WORKER_RECOVERY_MS]="60000"
  [CUAC_AUTH_EMAIL_WORKER_SUPERVISED]="true"
  [CUAC_AUTH_EMAIL_STAGING_ACCEPTED]="false"
)

tmp_file=$(mktemp "$script_dir/.env.directmail.XXXXXX")
trap 'rm -f "$tmp_file"' EXIT
declare -A seen=()
while IFS= read -r line || [[ -n "$line" ]]; do
  key=${line%%=*}
  if [[ -v "updates[$key]" ]]; then
    printf '%s=%s\n' "$key" "${updates[$key]}" >>"$tmp_file"
    seen[$key]=1
  else
    printf '%s\n' "$line" >>"$tmp_file"
  fi
done <"$env_file"

for key in "${!updates[@]}"; do
  if [[ ! -v "seen[$key]" ]]; then
    printf '%s=%s\n' "$key" "${updates[$key]}" >>"$tmp_file"
  fi
done

chmod 600 "$tmp_file"
mv -f "$tmp_file" "$env_file"
trap - EXIT
unset smtp_password

echo "DirectMail configuration saved to the protected .env file."
echo "The SMTP password was not printed."
echo "Start with: docker compose --profile auth-email up -d --build app auth-email-worker"
