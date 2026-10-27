# CUAC single-host trial

This deployment is only for owner-controlled product evaluation on one ECS host. It uses synthetic accounts and a local PostgreSQL volume. It is not staging or production and must not hold real personal data.

## Requirements

- Ubuntu 24.04 x86_64;
- Docker Engine with the Compose plugin;
- inbound TCP 80 and 443 available;
- outbound DNS and HTTPS available.

The temporary hostname is `<public-ip-with-dashes>.sslip.io`. `sslip.io` resolves the embedded public IP and Caddy obtains a normal HTTPS certificate. Replace it with an owned domain before any real-user release.

## Start

```bash
git clone --branch codex/release-baseline --single-branch https://github.com/Miyazak1/CUCA.git /opt/cuac
cd /opt/cuac/deploy/trial
chmod +x bootstrap.sh
./bootstrap.sh PUBLIC_IPV4
docker compose up -d --build
docker compose ps
```

The first build can take several minutes. Inspect bounded status without printing `.env`:

```bash
docker compose ps
docker compose logs --tail=80 app proxy
curl -fsS "https://${CUAC_TRIAL_HOST}/api/v1/health"
```

Synthetic credentials are stored only in `deploy/trial/.env`. To print the four synthetic email addresses and the shared test password:

```bash
grep -E '^CUAC_LOCAL_(STUDENT|SCHOOL|OPS|ADMIN)_(EMAIL|PASSWORD)=' .env
```

Do not paste that output into issue trackers or chat.

## Grant the first real CUAC administrator

After the target account has verified its email, grant the internal administrator
role from the owner-controlled server. The script uses the protected local admin
fixture only as the recorded bootstrap approver; it never prints that fixture's
password. It validates the target account, records a one-year access grant and
revokes the target's existing sessions so the next sign-in must select and
re-authorize the CUAC staff workspace.

```bash
chmod +x grant-cuac-admin.sh
./grant-cuac-admin.sh person@example.com
```

Type the same target email when prompted. Then sign in again, choose the CUAC
staff workspace and complete mandatory MFA enrollment. Do not grant this role to
a shared mailbox or an account that is not controlled by a named administrator.

## Supervised DirectMail acceptance

The auth-email worker is opt-in and is not started by the default command. After
an Aliyun DirectMail sender domain and trigger sender have both been verified,
configure one exact HTTPS origin, the complete sender address and the matching
DirectMail region. The script reads the SMTP password without displaying it and
stores it only in the protected `.env` file:

```bash
chmod +x configure-directmail.sh
./configure-directmail.sh https://ucac.cn no-reply@notice.ucac.cn ap-southeast-1
docker compose --profile auth-email up -d --build app auth-email-worker
docker compose --profile auth-email ps
docker compose --profile auth-email logs --tail=80 auth-email-worker
```

Do not paste `.env`, the SMTP password, or outbox keys into chat or logs. This
profile is for a supervised owner-controlled delivery test. Keep public signup
closed until verification, reset, expiry, replay and bounce behavior have been
accepted and the deployment has been promoted to the reviewed production stack.

## Stop and update

```bash
docker compose down
git pull --ff-only
docker compose up -d --build
```

`docker compose down` preserves the PostgreSQL and Caddy volumes. `docker compose down -v` permanently deletes trial data and must only be used intentionally.

## Publish the reviewed 100-school official catalog

Rebuild the application image after pulling the release branch, then run the
reviewed catalog publisher separately. Building or restarting the application
does not import the catalog. The publisher is transactional, preserves records
outside the reviewed target set, performs no deletion, and stops unless all 100
target schools and their reviewed official-source records pass the post-write
checks.

The recommended path runs the build, publication, restart and public API checks
as one fail-closed command:

```bash
git pull --ff-only origin codex/release-baseline
bash publish-reviewed-100.sh
```

The equivalent manual commands are:

```bash
docker compose build app
docker compose run --rm --no-deps \
  --entrypoint node \
  -e CUAC_REVIEWED_100_PUBLISH_CONFIRMATION=publish-reviewed-100-official-catalog-to-cuac-single-host \
  app scripts/catalog-reviewed-100-official-release-single-host-publish.ts
docker compose up -d --no-deps app proxy
```

The successful publisher report must contain `target_schools: 100` and
`target_programs: 11441`. It also reports the actual public totals after the
transaction; intake and scholarship totals may be higher when the database
already contains additional valid records. Check the public API after restart:

```bash
curl -fsS 'http://127.0.0.1:3000/api/v1/catalog/schools?page=1&pageSize=1'
curl -fsS 'http://127.0.0.1:3000/api/v1/catalog/programs?page=1&pageSize=1'
```

## Publish the reviewed top-150 school directory only

This release adds missing schools and refreshes only reviewed publication
metadata for target schools already present. It preserves schools outside the
target set and compares row counts plus content hashes for `programs`,
`program_intakes`, and `scholarships` before and after the transaction. Any
change to those protected tables aborts and rolls back the publication.

```bash
git pull --ff-only origin codex/release-baseline
bash publish-reviewed-top-150-schools.sh
```

The script builds the application image, runs a repeatable-read read-only
preflight, publishes with the exact approval token, restarts the application,
and verifies that at least 150 public schools are visible. It does not run the
program, intake, or scholarship release publishers.

## Preflight the official application-requirement candidate

After rebuilding the image, compare the hash-locked 52-school requirement candidate with the persistent single-host catalog before preparing any reviewed import. This command opens a repeatable-read, read-only transaction and never creates a requirement version or publication:

```bash
docker compose run --rm --no-deps \
  -e CUAC_REQUIREMENT_PREFLIGHT_TARGET=single_host_read_only \
  app node scripts/catalog-application-requirements-single-host-preflight.ts
```

Save the JSON result in the protected deployment record. `ready_for_reviewed_import` means every school, program and intake binding exists and no version-one conflict was found; it does not approve or publish the unreviewed candidate. A blocked result includes at most 25 non-sensitive binding examples for reconciliation. Never use `docker compose down -v` to make a preflight pass.

## Publish the reviewed application requirements

After the project owner completes the content/source/prohibited-data review recorded by the hash-bound review artifact, publish only bindings that resolve to an active school, active program and currently open intake. Missing programs, missing intakes and unavailable intakes are intentionally left empty. Use two distinct existing staff accounts: an Ops/Admin preparer and an Admin reviewer.

First publish the exact reviewed 2027 program/intake prerequisites. The bundle preserves all existing school and city rows, performs no deletion and contains only the 346 programs and 347 intake bindings required by the current requirement candidate:

```bash
docker compose run --rm --no-deps \
  --entrypoint node \
  -e CUAC_CURRENT_2027_PUBLISH_CONFIRMATION=publish-reviewed-current-2027-prerequisites-to-cuac-single-host \
  app scripts/catalog-current-2027-prerequisites-single-host-publish.ts
```

Then publish the reviewed application requirements:

```bash
docker compose run --rm --no-deps \
  --entrypoint node \
  -e CUAC_REQUIREMENT_PUBLISH_CONFIRMATION=publish-reviewed-requirements-to-cuac-single-host \
  -e CUAC_REQUIREMENT_PREPARER_EMAIL='YOUR_OPS_EMAIL' \
  -e CUAC_REQUIREMENT_REVIEWER_EMAIL='YOUR_ADMIN_EMAIL' \
  -e CUAC_REQUIREMENT_REVIEW_REFERENCE=project-owner-chat-review-2026-10-16 \
  app scripts/catalog-application-requirements-single-host-publish.ts
```

The command uses the governed prepare/approve/publish service and writes an audit event for each actual state change. It is resumable: already-published exact versions are counted without creating another version. Preserve the final JSON report with the deployment record.
