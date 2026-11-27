import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { assertLocalDevelopmentState, localDatabaseUrl, localSyntheticAccounts } from "./lib/local-development.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { prepareSchoolLogo, writeSchoolLogo } from "../src/server/catalog/school-logo.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1 });
const client = createTransactionalSqlClient(pool);
const seed = JSON.parse(await readFile("seeds/school-logos.official-20261121.json", "utf8"));
const review = JSON.parse(await readFile("catalog-sources/school-logo-review.20261121.json", "utf8"));
const migration = await readFile("drizzle/pg/0082_school_logo_official_assets.sql", "utf8");
const official = migration.split("--> statement-breakpoint").find(sql => sql.includes("s.slug='peking-university'"));
const old = JSON.parse(await readFile("seeds/school-logos.initial.json", "utf8")).schools.find(x => x.slug === "peking-university");
const legacy = prepareSchoolLogo(await readFile(old.logo.file), old.logo.sourceUrl, old.logo.sourceNote);
const rollback = new Error("ROLLBACK_OFFICIAL_LOGO_REHEARSAL");
try {
  const actor = (await client.query("select id from users where email=$1", [localSyntheticAccounts(state).admin.email]))[0];
  assert.ok(actor);
  await assert.rejects(client.transaction(async tx => {
    const make = async status => {
      const slug = `local-official-logo-${randomUUID()}`;
      const school = (await tx.query("insert into schools(slug,name_en,status,verification_status) values($1,'Synthetic logo rehearsal',$2,'unverified') returning id", [slug, status || "draft"]))[0];
      return { ...school, sql: official.replace("s.slug='peking-university'", `s.slug='${slug}'`) };
    };
    const current = async s => (await tx.query("select version,sha256 from school_logo_versions where school_id=$1 order by version desc limit 1", [s.id]))[0];
    const fresh = await make();
    await tx.query(fresh.sql, []);
    await tx.query(fresh.sql, []);
    assert.equal((await current(fresh)).version, 1);
    const legacySchool = await make();
    await writeSchoolLogo(tx, legacySchool.id, 0, legacy, null);
    await tx.query(legacySchool.sql, []);
    await tx.query(legacySchool.sql, []);
    assert.equal((await current(legacySchool)).version, 2);
    for (const mode of ["staff", "changed-note", "removed"]) {
      const school = await make();
      await writeSchoolLogo(tx, school.id, 0, mode === "changed-note" ? { ...legacy, sourceNote: "Explicit local customization" } : legacy, mode === "staff" ? actor.id : null);
      if (mode === "removed") await writeSchoolLogo(tx, school.id, 1, null, actor.id);
      const before = await current(school);
      await tx.query(school.sql, []);
      assert.deepEqual(await current(school), before, `${mode} must be preserved`);
    }
    const archived = await make("archived");
    await tx.query(archived.sql, []);
    assert.equal(await current(archived), undefined);
    throw rollback;
  }), error => error === rollback);
  assert.equal((await client.query("select id from schools where slug like 'local-official-logo-%'", [])).length, 0);
  const schools = await client.query(`select s.id,s.slug,l.version,l.sha256,l.source_url
    from schools s left join lateral (select version,sha256,source_url from school_logo_versions where school_id=s.id order by version desc limit 1) l on true
    where s.status='active' and s.verification_status in ('verified','stale') order by s.slug`, []);
  assert.equal(schools.length, 100);
  for (const school of schools) {
    const expected = review.schools.find(x => x.slug === school.slug);
    assert.ok(expected, school.slug);
    assert.equal(school.sha256, expected.evidence.normalizedSha256, school.slug);
    assert.equal(school.source_url, expected.logo.sourceUrl, school.slug);
    const url = `http://127.0.0.1:${state.applicationPort}/api/v1/catalog/schools/${school.id}/logo?v=${school.version}`;
    const response = await fetch(url);
    assert.equal(response.status, 200, school.slug);
    assert.equal(response.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(createHash("sha256").update(bytes).digest("hex"), school.sha256);
    const cached = await fetch(url, { headers: { "if-none-match": response.headers.get("etag") } });
    assert.equal(cached.status, 304);
  }
  console.log(JSON.stringify({ localOnly: true, reviewedAssets: seed.schools.length, databaseCoverage: schools.length,
    imageHttp200AndHash: schools.length, imageConditional304: schools.length,
    migrationScenarios: ["fresh", "repeat", "legacy-upgrade", "staff-preserved", "custom-note-preserved", "tombstone-preserved", "archived-skipped"],
    syntheticChangesRolledBack: true }));
} finally { await pool.end(); }
