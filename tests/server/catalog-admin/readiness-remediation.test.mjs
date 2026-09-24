import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = await readFile(new URL("../../../scripts/catalog-readiness-remediation.ts", import.meta.url), "utf8");
const apply = await readFile(new URL("../../../scripts/catalog-readiness-remediation-apply.ts", import.meta.url), "utf8");
const config = JSON.parse(await readFile(new URL("../../../catalog-sources/remediations/catalog-readiness-batch-01.json",
  import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../../../package.json", import.meta.url), "utf8"));

test("catalog readiness remediation inventory is bounded, local-only and non-mutating", () => {
  assert.match(inventory, /restricted to loopback PostgreSQL/);
  assert.match(inventory, /readiness: "blocked"/);
  assert.match(inventory, /limit: 20_000/);
  assert.match(inventory, /No catalog or evidence rows were written/);
  assert.match(inventory, /await connection\.query\("rollback"\)/);
  assert.doesNotMatch(inventory, /update schools|update programs|update scholarships|delete from/i);
});

test("catalog readiness remediation apply requires exact evidence, explicit confirmation and normal lifecycle APIs", () => {
  assert.equal(config.version, 1);
  assert.equal(config.publicationAuthorized, true);
  assert.deepEqual(config.operations.map(operation => operation.slug), ["sichuan-university"]);
  assert.deepEqual(config.operations[0].expectedBlockingReasons, ["missing_school_type"]);
  assert.match(config.operations[0].sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(apply, /--confirm=\$\{confirmation\}/);
  assert.match(apply, /restricted to loopback PostgreSQL/);
  assert.match(apply, /createHash\("sha256"\)/);
  assert.match(apply, /prohibitedDataConfirmedExcluded/);
  assert.match(apply, /service\.updateSchool/);
  assert.match(apply, /service\.publishSchool/);
  assert.match(apply, /new PostgresAuditWriter/);
  assert.match(apply, /verifyAppliedHistory/);
  assert.doesNotMatch(apply, /update\s+schools|insert\s+into\s+catalog_entity_revisions/i);
  assert.equal(packageJson.scripts["catalog:data:readiness-remediation"],
    "node scripts/catalog-readiness-remediation.ts");
  assert.equal(packageJson.scripts["catalog:data:readiness-remediation:apply"],
    "node scripts/catalog-readiness-remediation-apply.ts");
});
