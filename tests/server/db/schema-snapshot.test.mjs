import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { artifactHash, assertCurrentSchemaSnapshot, checkMigrationSnapshots, readMigrationArtifactState, validateMigrationArtifactState } from "../../../scripts/lib/pg-schema-snapshot.ts";
import { finalizeGeneratedJournal, generatePgMigrationArtifacts } from "../../../scripts/lib/pg-migration-generation.ts";

const project = fileURLToPath(new URL("../../../", import.meta.url));
const folder = join(project, "drizzle/pg");
const original = await readMigrationArtifactState(folder);
const fixture = () => structuredClone(original);
const nextIndex = original.journal.entries.length;
const nextTag = `${String(nextIndex).padStart(4, "0")}_new`;

test("latest snapshot describes current schema and the reviewed migration history", async () => {
  const checked = await checkMigrationSnapshots(folder);
  assert.equal(checked.migrations, original.journal.entries.length);
  assert.equal(checked.latest, original.snapshots.at(-1).file);
  assert.ok(checked.tables >= 36);
  assert.equal(original.manifest.throughIndex, 47);
  assert.deepEqual(Object.keys(original.manifest.snapshots), ["0000_snapshot.json", "0001_snapshot.json", "0011_snapshot.json", "0012_snapshot.json", "0013_snapshot.json", "0014_snapshot.json", "0015_snapshot.json", "0016_snapshot.json", "0017_snapshot.json", "0018_snapshot.json", "0019_snapshot.json", "0020_snapshot.json", "0021_snapshot.json", "0022_snapshot.json", "0023_snapshot.json", "0024_snapshot.json", "0025_snapshot.json", "0026_snapshot.json", "0027_snapshot.json", "0028_snapshot.json", "0029_snapshot.json", "0030_snapshot.json", "0031_snapshot.json", "0032_snapshot.json", "0033_snapshot.json", "0034_snapshot.json", "0035_snapshot.json", "0036_snapshot.json", "0037_snapshot.json", "0038_snapshot.json", "0039_snapshot.json", "0040_snapshot.json", "0041_snapshot.json", "0042_snapshot.json", "0043_snapshot.json", "0044_snapshot.json", "0045_snapshot.json", "0046_snapshot.json", "0047_snapshot.json"]);
  const attributes = await readFile(join(folder, ".gitattributes"), "utf8");
  assert.match(attributes, /\*\.sql -text/);
  assert.match(attributes, /meta\/\*\.json -text/);
});

test("migration history checks reject edited bytes, missing SQL and unjournaled files", () => {
  const latest = `${original.manifest.journalEntries.at(-1).tag}.sql`;
  const editedLatest = fixture(); editedLatest.sql[latest] = "changed";
  assert.throws(() => validateMigrationArtifactState(editedLatest), /bytes changed/);
  const file = `${original.journal.entries[0].tag}.sql`;
  for (const mutate of [state => { state.sql[file] = "changed"; }, state => { delete state.sql[file]; }, state => { state.sql["9999_unreviewed.sql"] = "unknown"; }]) {
    const state = fixture(); mutate(state);
    assert.throws(() => validateMigrationArtifactState(state), /bytes changed|SQL files/);
  }
  const state = fixture(); delete state.manifest.sql[file];
  assert.throws(() => validateMigrationArtifactState(state), /coverage is incomplete/);
});

test("journal order and baseline history cannot be silently rewritten", () => {
  for (const mutate of [state => { state.journal.entries[0].when++; }, state => { state.journal.entries[1].idx++; }, state => { state.journal.entries[2].tag = "0002_changed"; }]) {
    const state = fixture(); mutate(state);
    assert.throws(() => validateMigrationArtifactState(state), /journal history changed/);
  }
  for (const entry of [
    { idx: nextIndex, version: "7", when: original.journal.entries.at(-1).when, tag: nextTag, breakpoints: true },
    { idx: nextIndex + 1, version: "7", when: original.journal.entries.at(-1).when + 1, tag: nextTag, breakpoints: true },
    { idx: nextIndex, version: "7", when: original.journal.entries.at(-1).when + 1, tag: "../unsafe", breakpoints: true },
  ]) {
    const state = fixture(); state.journal.entries.push(entry);
    assert.throws(() => validateMigrationArtifactState(state), /indices, names or timestamps/);
  }
  const generated = structuredClone(original.journal);
  const last = generated.entries.at(-1);
  generated.entries.push({ idx: last.idx + 1, version: "7", when: last.when - 1000, tag: nextTag, breakpoints: true });
  const finalized = finalizeGeneratedJournal(original.journal, generated);
  assert.equal(finalized.entries.at(-1).when, last.when + 1);
  assert.deepEqual(finalized.entries.slice(0, -1), original.journal.entries);
  assert.equal(generated.entries.at(-1).when, last.when - 1000);
  generated.entries[0].when++;
  assert.throws(() => finalizeGeneratedJournal(original.journal, generated), /existing journal history/);
});

test("snapshot checks reject broken lineage, altered history and untracked new migration gaps", () => {
  for (const mutate of [
    state => { state.snapshots.at(-1).snapshot.prevId = "wrong"; },
    state => { state.snapshots.at(-1).snapshot.id = state.snapshots[0].snapshot.id; },
    state => { state.snapshots[0].sha256 = "changed"; },
    state => { state.snapshots.pop(); },
  ]) {
    const state = fixture(); mutate(state);
    assert.throws(() => validateMigrationArtifactState(state), /lineage|snapshot bytes|coverage|Latest migration has no matching snapshot/);
  }
  const state = fixture();
  state.journal.entries.push({ idx: nextIndex, version: "7", when: state.journal.entries.at(-1).when + 1, tag: nextTag, breakpoints: true });
  state.sql[`${nextTag}.sql`] = artifactHash("-- new");
  assert.throws(() => validateMigrationArtifactState(state), /Latest migration has no matching snapshot/);
});

test("tool upgrades and real schema changes cannot pass as a no-op", async () => {
  const state = fixture(); state.toolVersions.drizzleKit = "999.0.0";
  assert.throws(() => validateMigrationArtifactState(state), /tool versions changed/);
  const bookkeeping = structuredClone(original.snapshots.at(-1).snapshot);
  bookkeeping._meta.tables = { "public.old_name": "public.users" };
  await assertCurrentSchemaSnapshot(bookkeeping);
  for (const mutate of [
    value => { value.tables["public.users"].columns.account_status.default = "'suspended'"; },
    value => { delete value.tables["public.student_application_command_receipts"].checkConstraints.student_application_commands_hash_check; },
    value => { value.tables["public.users"].columns.email.notNull = false; },
  ]) {
    const snapshot = structuredClone(original.snapshots.at(-1).snapshot); mutate(snapshot);
    await assert.rejects(assertCurrentSchemaSnapshot(snapshot), /Declared schema differs/);
  }
});

async function treeHashes(root) {
  const files = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false);
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files[relative(root, path)] = artifactHash(await readFile(path));
    }
  }
  await visit(root);
  return files;
}

test("native no-op, guarded generation and migration preflight preserve history in an isolated copy", { timeout: 45_000 }, async () => {
  const root = await realpath(project), parent = join(root, ".tmp");
  await mkdir(parent, { recursive: true });
  assert.equal(await realpath(parent), parent, "Temporary parent must not redirect outside the project");
  const temp = await mkdtemp(join(parent, "schema-check-"));
  const verifyOwned = async () => {
    const resolved = await realpath(temp);
    assert.equal(dirname(resolved), parent);
    assert.ok(resolved.startsWith(parent + sep + "schema-check-"));
  };
  try {
    await verifyOwned();
    await cp(folder, temp, { recursive: true });
    const before = await treeHashes(temp), sourceBefore = await treeHashes(folder);
    const generate = schemaPath => promisify(execFile)(process.execPath, [
      join(project, "node_modules/drizzle-kit/bin.cjs"), "generate", "--dialect=postgresql",
      `--schema=${schemaPath}`, `--out=./${relative(project, temp).replaceAll("\\", "/")}`,
    ], { cwd: project, windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024,
      env: { CI: "true", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP } });
    const result = await generate("./src/server/db/schema.ts");
    assert.match(result.stdout, /No schema changes/i);
    assert.deepEqual(await treeHashes(temp), before);
    const config = join(temp, "_fixture.config.ts");
    await writeFile(config, `export default ${JSON.stringify({ dialect: "postgresql", schema: "./tests/server/db/fixtures/schema-addition.ts", out: `./${relative(project, temp).replaceAll("\\", "/")}` })};\n`, { flag: "wx" });
    const addition = await generatePgMigrationArtifacts(project, config, temp, "rehearsal_marker");
    assert.equal(addition.created, true);
    const changed = await readMigrationArtifactState(temp);
    const latest = validateMigrationArtifactState(changed);
    assert.equal(changed.journal.entries.length, original.journal.entries.length + 1);
    assert.ok(changed.journal.entries.at(-1).when > original.journal.entries.at(-1).when);
    assert.equal(latest.snapshot.prevId, original.snapshots.at(-1).snapshot.id);
    const sql = await readFile(join(temp, `${changed.journal.entries.at(-1).tag}.sql`), "utf8");
    assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1);
    assert.match(sql, /CREATE TABLE "__cuac_rehearsal_marker"/);
    assert.doesNotMatch(sql, /ALTER TABLE|DROP TABLE|CREATE INDEX|CREATE UNIQUE INDEX/);
    assert.deepEqual(await treeHashes(folder), sourceBefore);
    let connections = 0;
    const trap = createServer(socket => { connections++; socket.destroy(); });
    try {
      await new Promise((resolve, reject) => { trap.once("error", reject); trap.listen(0, "127.0.0.1", resolve); });
      await assert.rejects(promisify(execFile)(process.execPath, [join(project, "scripts/pg-migrate.ts")], {
        cwd: project, windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024,
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
          CUAC_MIGRATION_TARGET_ENV: "development", PG_MIGRATIONS_FOLDER: temp,
          DATABASE_URL: `postgresql://synthetic:synthetic@127.0.0.1:${trap.address().port}/never_connect` },
      }), error => error.code === 1 && /Declared schema differs/.test(error.stderr));
      assert.equal(connections, 0, "Mismatched migration artifacts must fail before connecting to PostgreSQL");
    } finally { await new Promise(resolve => trap.close(resolve)); }
  } finally { await verifyOwned(); await rm(temp, { recursive: true }); }
});
