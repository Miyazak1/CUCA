#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/5] Building the reviewed school-only application image..."
docker compose build app

echo "[2/5] Running the read-only top-150 school-directory preflight..."
docker compose run --rm --no-deps \
  --entrypoint node \
  -e CUAC_ENV=development \
  -e CUAC_LOCAL_RUNTIME=1 \
  app scripts/catalog-top-150-school-directory-single-host-preflight.ts

echo "[3/5] Publishing only the reviewed top-150 school directory..."
docker compose run --rm --no-deps \
  --entrypoint node \
  -e CUAC_ENV=development \
  -e CUAC_LOCAL_RUNTIME=1 \
  -e CUAC_TOP150_SCHOOL_DIRECTORY_PUBLISH_CONFIRMATION=publish-reviewed-top-150-school-directory-to-cuac-single-host \
  app scripts/catalog-top-150-school-directory-single-host-publish.ts

echo "[4/5] Restarting the application and proxy..."
docker compose up -d --no-deps app proxy

echo "[5/5] Verifying the public schools catalog..."
docker compose exec -T app node --input-type=module - <<'NODE'
const baseUrl = `http://127.0.0.1:${process.env.PORT || "3000"}`;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let lastError;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/catalog/schools?page=1&pageSize=1`);
    if (!response.ok) throw new Error(`schools returned HTTP ${response.status}`);
    const body = await response.json();
    const total = Number(body?.pagination?.total);
    if (!Number.isSafeInteger(total) || total < 150) throw new Error(`schools total ${String(body?.pagination?.total)} is below 150`);
    console.log(JSON.stringify({ ok: true, publicSchoolTotal: total }, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 30) await delay(2_000);
  }
}
throw lastError;
NODE

docker compose ps
