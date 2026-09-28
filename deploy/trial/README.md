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

## Stop and update

```bash
docker compose down
git pull --ff-only
docker compose up -d --build
```

`docker compose down` preserves the PostgreSQL and Caddy volumes. `docker compose down -v` permanently deletes trial data and must only be used intentionally.
