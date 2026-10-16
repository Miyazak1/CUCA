#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/4] Building the reviewed catalog application image..."
docker compose build app

echo "[2/4] Publishing the reviewed 100-school official catalog..."
docker compose run --rm --no-deps \
  --entrypoint node \
  -e CUAC_REVIEWED_100_PUBLISH_CONFIRMATION=publish-reviewed-100-official-catalog-to-cuac-single-host \
  app scripts/catalog-reviewed-100-official-release-single-host-publish.ts

echo "[3/4] Restarting the application and proxy..."
docker compose up -d --no-deps app proxy

echo "[4/4] Verifying the public catalog API..."
docker compose exec -T app node --input-type=module - <<'NODE'
const baseUrl = `http://127.0.0.1:${process.env.PORT || "3000"}`;
const expectedMinimums = {
  schools: 100,
  programs: 11_441,
  scholarships: 325,
  cities: 34,
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let lastError;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    const totals = {};
    for (const [resource, minimum] of Object.entries(expectedMinimums)) {
      const response = await fetch(`${baseUrl}/api/v1/catalog/${resource}?page=1&pageSize=1`);
      if (!response.ok) throw new Error(`${resource} returned HTTP ${response.status}`);
      const body = await response.json();
      const total = Number(body?.pagination?.total);
      if (!Number.isSafeInteger(total) || total < minimum) {
        throw new Error(`${resource} total ${String(body?.pagination?.total)} is below ${minimum}`);
      }
      totals[resource] = total;
    }
    console.log(JSON.stringify({ ok: true, publicCatalogTotals: totals }, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 30) await delay(2_000);
  }
}
throw lastError;
NODE

docker compose ps
