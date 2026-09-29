#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./grant-cuac-admin.sh <verified-account-email>" >&2
  exit 1
fi

admin_email=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
[[ "$admin_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
  echo "A complete account email address is required." >&2
  exit 1
}

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"
env_file="$script_dir/.env"
[[ -f "$env_file" ]] || { echo "$env_file does not exist; run bootstrap.sh first." >&2; exit 1; }

bootstrap_approver_email=$(sed -n 's/^CUAC_LOCAL_ADMIN_EMAIL=//p' "$env_file" | head -n 1 | tr '[:upper:]' '[:lower:]')
[[ "$bootstrap_approver_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
  echo "The protected bootstrap approver is not configured." >&2
  exit 1
}
[[ "$admin_email" != "$bootstrap_approver_email" ]] || {
  echo "Use a verified non-fixture account for the real administrator." >&2
  exit 1
}

printf 'Type %s to confirm this one-year CUAC administrator grant: ' "$admin_email"
IFS= read -r confirmation
[[ "$confirmation" == "$admin_email" ]] || { echo "Confirmation did not match; no changes were made." >&2; exit 1; }

docker compose exec -T database psql -X -v ON_ERROR_STOP=1 \
  -U cuac_local -d cuac_local \
  -v admin_email="$admin_email" \
  -v approver_email="$bootstrap_approver_email" <<'SQL'
begin;

create temp table bootstrap_admin_target on commit drop as
select id, email, email_normalized
from users
where email_normalized = lower(trim(:'admin_email'))
  and account_status = 'active'
  and email_verified_at is not null;

create temp table bootstrap_admin_approver on commit drop as
select distinct u.id
from users u
join user_roles r on r.user_id = u.id
  and r.role = 'cuac_admin'
  and r.revoked_at is null
join cuac_staff_access_grants g on g.user_id = u.id
  and g.requested_role = 'cuac_admin'
  and g.status = 'approved'
  and g.revoked_at is null
  and g.expires_at > clock_timestamp()
where u.email_normalized = lower(trim(:'approver_email'))
  and u.account_status = 'active';

do $$
begin
  if (select count(*) from bootstrap_admin_target) <> 1 then
    raise exception 'The target account is missing, disabled, duplicated, or its email is not verified.';
  end if;
  if (select count(*) from bootstrap_admin_approver) <> 1 then
    raise exception 'The protected bootstrap approver is unavailable or its grant has expired.';
  end if;
  if (select id from bootstrap_admin_target) = (select id from bootstrap_admin_approver) then
    raise exception 'An administrator cannot approve their own access grant.';
  end if;
end $$;

insert into user_roles (user_id, role, granted_by_user_id, grant_source)
select target.id, 'cuac_admin', approver.id, 'admin_assignment'
from bootstrap_admin_target target
cross join bootstrap_admin_approver approver
on conflict (user_id, role) where revoked_at is null do nothing;

insert into cuac_staff_access_grants
  (user_id, email, email_normalized, requested_surface, requested_role, status,
   requested_by_user_id, approved_by_user_id, reason, approved_at, expires_at)
select target.id, target.email, target.email_normalized, 'cuac_internal', 'cuac_admin', 'approved',
  approver.id, approver.id, 'Owner-controlled initial administrator bootstrap',
  clock_timestamp(), clock_timestamp() + interval '1 year'
from bootstrap_admin_target target
cross join bootstrap_admin_approver approver
on conflict (user_id, requested_role) where status = 'approved' and revoked_at is null
do update set
  email = excluded.email,
  email_normalized = excluded.email_normalized,
  requested_surface = excluded.requested_surface,
  approved_by_user_id = excluded.approved_by_user_id,
  requested_by_user_id = excluded.requested_by_user_id,
  reason = excluded.reason,
  approved_at = excluded.approved_at,
  expires_at = excluded.expires_at,
  updated_at = clock_timestamp();

update auth_sessions
set revoked_at = clock_timestamp()
where user_id = (select id from bootstrap_admin_target)
  and revoked_at is null;

commit;

select u.email, r.role, g.status, g.expires_at
from users u
join user_roles r on r.user_id = u.id and r.role = 'cuac_admin' and r.revoked_at is null
join cuac_staff_access_grants g on g.user_id = u.id and g.requested_role = r.role
  and g.status = 'approved' and g.revoked_at is null
where u.email_normalized = lower(trim(:'admin_email'));
SQL

echo "CUAC administrator access granted. Existing sessions were revoked."
echo "Sign in again and choose the CUAC staff workspace; first access requires MFA enrollment."
