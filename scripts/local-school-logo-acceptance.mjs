import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { assertLocalDevelopmentState, localDatabaseUrl, localSyntheticAccounts } from "./lib/local-development.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";
import { manageSchoolLogoWithContext, publicSchoolLogo } from "../src/server/catalog/school-logo-http.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const account = localSyntheticAccounts(state).admin;
assert.match(account.email, /@local\.cuac\.invalid$/);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1 });
const client = createTransactionalSqlClient(pool);
const slug = `local-school-logo-rehearsal-${randomUUID()}`;
const rollback = new Error("ROLLBACK_SYNTHETIC_LOGO_REHEARSAL");
try {
  const user = (await client.query("select id from users where email=$1", [account.email]))[0];
  assert.ok(user, "Managed synthetic administrator is required");
  const context = createRequestContext({ actorUserId: user.id, activeRole: "cuac_admin", selectedSurface: "ops",
    purpose: "catalog_management", authStrength: "step_up", tenantSchoolId: null,
    dataClassAllowlist: ["public_catalog", "internal_catalog_metadata", "audit_security"] });
  const png = await readFile("public/catalog-design-assets/pku.png");
  const migration = await readFile("drizzle/pg/0081_school_logo_initial_assets.sql", "utf8");
  const initial = migration.split("--> statement-breakpoint").find(sql => sql.includes("s.slug = 'peking-university'"));
  assert.ok(initial);
  await assert.rejects(client.transaction(async tx => {
    const school = (await tx.query(`insert into schools(slug,name_en,status,verification_status)
      values($1,'Synthetic logo rehearsal','draft','unverified') returning id`, [slug]))[0];
    const sql = initial.replace("s.slug = 'peking-university'", `s.slug = '${slug}'`);
    await tx.query(sql, []);
    await tx.query(sql, []);
    const count = (await tx.query("select count(*)::int as count from school_logo_versions where school_id=$1", [school.id]))[0].count;
    assert.equal(count, 1, "Initial migration is idempotent on a fresh school");
    const url = `http://127.0.0.1:${state.applicationPort}/api/v1/ops/catalog/schools/${school.id}/logo`;
    await assert.rejects(publicSchoolLogo(new Request(url), school.id, tx), error => error.status === 404);
    const upload = () => new Request(url, { method: "PUT", headers: { "content-type": "image/png", "if-match": "1",
      "x-logo-source-url": encodeURIComponent("https://www.pku.edu.cn/"), "x-logo-source-note": "SYNTHETIC%20REHEARSAL" }, body: png });
    const saved = (await (await manageSchoolLogoWithContext(upload(), school.id, context, tx)).json()).data;
    assert.equal(saved.version, 2);
    const preview = await manageSchoolLogoWithContext(new Request(`${url}?image=1`), school.id, context, tx);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "image/png");
    assert.ok((await preview.arrayBuffer()).byteLength > 0);
    const removed = (await (await manageSchoolLogoWithContext(new Request(url, { method: "DELETE",
      headers: { "if-match": "2" } }), school.id, context, tx)).json()).data;
    assert.equal(removed.version, 3);
    assert.equal(removed.logo, null);
    const history = await tx.query("select version from school_logo_versions where school_id=$1", [school.id]);
    assert.equal(history.length, 3);
    await assert.rejects(manageSchoolLogoWithContext(upload(), school.id, context, tx), error => error.status === 409);
    throw rollback;
  }), error => error === rollback);
  assert.equal((await client.query("select id from schools where slug=$1", [slug])).length, 0);
  console.log(JSON.stringify({ localOnly: true, freshMigration: true, idempotent: true, draftImagePrivate: true,
    upload: true, preview: true, remove: true, staleVersionRejected: true, historyRetained: true, syntheticChangesRolledBack: true }));
} finally { await pool.end(); }
