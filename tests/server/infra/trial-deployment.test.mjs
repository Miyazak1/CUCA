import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("single-host trial stays synthetic, loopback-bound and HTTPS-fronted", async () => {
  const [compose, bootstrap, caddy, dockerfile, readme, dockerignore] = await Promise.all([
    readFile(new URL("deploy/trial/compose.yaml", root), "utf8"),
    readFile(new URL("deploy/trial/bootstrap.sh", root), "utf8"),
    readFile(new URL("deploy/trial/Caddyfile", root), "utf8"),
    readFile(new URL("deploy/trial/Dockerfile", root), "utf8"),
    readFile(new URL("deploy/trial/README.md", root), "utf8"),
    readFile(new URL(".dockerignore", root), "utf8"),
  ]);

  assert.match(compose, /127\.0\.0\.1:55432:5432/);
  assert.doesNotMatch(compose, /(?:^|\s)["']?5432:5432/);
  assert.match(compose, /network_mode: host/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /service_completed_successfully/);
  assert.match(compose, /caddy:2-alpine/);
  assert.match(caddy, /reverse_proxy 127\.0\.0\.1:3000/);

  assert.match(bootstrap, /CUAC_PUBLIC_APP_URL=https:\/\//);
  assert.match(bootstrap, /\.sslip\.io/);
  for (const gate of [
    "CUAC_AUTH_EMAIL_DELIVERY_PROVIDER=disabled",
    "CUAC_NOTIFICATION_EMAIL_PROVIDER=disabled",
    "CUAC_AGENT_ENABLED=false",
    "CUAC_PAYMENT_MODE=disabled",
    "CUAC_FILE_UPLOAD_ENABLED=false",
    "CUAC_SUBMISSION_DELIVERY_PROVIDER=disabled",
  ]) assert.match(bootstrap, new RegExp(gate));
  assert.match(bootstrap, /chmod 600/);

  assert.match(dockerfile, /USER 1000:1000/);
  assert.match(dockerfile, /catalog\.local\.synthetic\.json/);
  assert.doesNotMatch(dockerfile, /npm prune --omit=dev/, "trial migration image must retain drizzle-kit");
  assert.match(dockerignore, /!seeds\/catalog\.local\.synthetic\.json/);
  assert.match(readme, /must not hold real personal data/i);
});
