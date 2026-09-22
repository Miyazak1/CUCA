import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("Hong Kong production template is immutable, least-privileged and excludes deferred workers", async () => {
  const [compose, productionEnv, readme] = await Promise.all([
    source("deploy/hong-kong/compose.yaml"), source("config/production.env.example"), source("deploy/hong-kong/README.md"),
  ]);
  assert.match(productionEnv, /^ALIBABA_CLOUD_REGION=cn-hongkong$/m);
  assert.match(productionEnv, /^ALIYUN_OSS_REGION=oss-cn-hongkong$/m);
  assert.match(productionEnv, /^CUAC_RELEASE_SCOPE=school-handoff-v1$/m);
  assert.match(compose, /image: \$\{CUAC_IMAGE:\?Set CUAC_IMAGE to the immutable registry digest\}/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /user: "1000:1000"/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /"127\.0\.0\.1:3000:3000"/);
  for (const worker of ["auth-email-worker", "notification-worker", "data-rights-reminder-worker", "retention-worker"]) {
    assert.match(compose, new RegExp(`^  ${worker}:`, "m"));
  }
  for (const deferredWorker of ["student-file-worker", "official-submission-worker", "payment-reconciliation-worker"]) {
    assert.doesNotMatch(compose, new RegExp(`^  ${deferredWorker}:`, "m"));
  }
  assert.match(readme, /never auto-migrates/);
  assert.match(readme, /domain and DNS\/TLS control/);
});
