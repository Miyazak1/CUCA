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
