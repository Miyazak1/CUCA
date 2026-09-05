import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateDrizzleJson, generateMigration, type DrizzleSnapshotJSON } from "drizzle-kit/api";
import * as schema from "../../src/server/db/schema.ts";

export type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };
export type SnapshotFile = { file: string; snapshot: DrizzleSnapshotJSON; sha256: string };
export type BaselineManifest = {
  version: 1;
  throughIndex: number;
  journalEntries: JournalEntry[];
  sql: Record<string, string>;
  snapshots: Record<string, string>;
  toolVersions: { drizzleKit: string; drizzleOrm: string };
};
export type MigrationArtifactState = {
  journal: { version: string; dialect: string; entries: JournalEntry[] };
  sql: Record<string, string>;
  snapshots: SnapshotFile[];
  manifest: BaselineManifest;
  toolVersions: BaselineManifest["toolVersions"];
};

export const artifactHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function readToolVersions(): Promise<BaselineManifest["toolVersions"]> {
  const kit = JSON.parse(await readFile(new URL("../../node_modules/drizzle-kit/package.json", import.meta.url), "utf8"));
  const orm = JSON.parse(await readFile(new URL("../../node_modules/drizzle-orm/package.json", import.meta.url), "utf8"));
  return { drizzleKit: kit.version, drizzleOrm: orm.version };
}

export async function readMigrationArtifactState(folder: string): Promise<MigrationArtifactState> {
  const journal = JSON.parse(await readFile(join(folder, "meta/_journal.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(folder, "_schema-baseline.json"), "utf8"));
  const sql: Record<string, string> = {};
  for (const file of (await readdir(folder)).filter(file => file.endsWith(".sql")).sort()) {
    sql[file] = artifactHash(await readFile(join(folder, file)));
  }
  const snapshots: SnapshotFile[] = [];
  for (const file of (await readdir(join(folder, "meta"))).filter(file => !file.startsWith("_")).sort()) {
    if (!/^\d{4}_snapshot\.json$/.test(file)) throw new Error(`Unexpected Drizzle metadata file: ${file}`);
    const bytes = await readFile(join(folder, "meta", file));
    snapshots.push({ file, snapshot: JSON.parse(bytes.toString("utf8")), sha256: artifactHash(bytes) });
  }
  return { journal, manifest, sql, snapshots, toolVersions: await readToolVersions() };
}

export function validateMigrationArtifactState(state: MigrationArtifactState): SnapshotFile {
  const { journal, manifest, sql, snapshots, toolVersions } = state;
  if (journal.version !== "7" || journal.dialect !== "postgresql" || !Array.isArray(journal.entries) || !journal.entries.length) throw new Error("Invalid PostgreSQL migration journal.");
  if (manifest.version !== 1 || !Number.isSafeInteger(manifest.throughIndex) || manifest.throughIndex < 0
    || manifest.journalEntries.length !== manifest.throughIndex + 1) throw new Error("Invalid migration reconciliation manifest.");
  if (!isDeepStrictEqual(toolVersions, manifest.toolVersions)) throw new Error("Drizzle tool versions changed; review and revalidate the baseline before upgrading.");
  if (!isDeepStrictEqual(journal.entries.slice(0, manifest.throughIndex + 1), manifest.journalEntries)) throw new Error("Reconciled journal history changed.");
  for (const [index, entry] of journal.entries.entries()) {
    if (entry.idx !== index || entry.version !== "7" || typeof entry.breakpoints !== "boolean"
      || !Number.isSafeInteger(entry.when) || entry.when <= (journal.entries[index - 1]?.when ?? 0)
      || typeof entry.tag !== "string" || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag) || !entry.tag.startsWith(`${String(index).padStart(4, "0")}_`)) throw new Error("Migration indices, names or timestamps are invalid.");
  }
  const expectedSql = journal.entries.map(entry => `${entry.tag}.sql`).sort();
  if (!isDeepStrictEqual(Object.keys(sql).sort(), expectedSql)) throw new Error("Migration SQL files and journal entries disagree.");
  if (!isDeepStrictEqual(Object.keys(manifest.sql).sort(), manifest.journalEntries.map(entry => `${entry.tag}.sql`).sort())) throw new Error("Baseline SQL coverage is incomplete.");
  for (const [file, hash] of Object.entries(manifest.sql)) if (sql[file] !== hash) throw new Error(`Historical migration bytes changed: ${file}`);
  if (!snapshots.length) throw new Error("Missing Drizzle snapshots.");
  const ids = new Set<string>();
  for (const [index, item] of snapshots.entries()) {
    const position = Number(item.file.slice(0, 4));
    const previous = snapshots[index - 1];
    if (position > journal.entries.at(-1)!.idx || (previous && position <= Number(previous.file.slice(0, 4)))) throw new Error("Snapshot order does not match the journal.");
    if (item.snapshot.version !== "7" || item.snapshot.dialect !== "postgresql" || !item.snapshot.id || ids.has(item.snapshot.id)
      || item.snapshot.prevId !== (previous?.snapshot.id ?? "00000000-0000-0000-0000-000000000000")) throw new Error("Snapshot lineage is broken or duplicated.");
    ids.add(item.snapshot.id);
  }
  const historicalSnapshots = snapshots.filter(item => Number(item.file.slice(0, 4)) <= manifest.throughIndex);
  if (!isDeepStrictEqual(historicalSnapshots.map(item => item.file).sort(), Object.keys(manifest.snapshots).sort())) throw new Error("Baseline snapshot coverage changed.");
  for (const item of historicalSnapshots) if (manifest.snapshots[item.file] !== item.sha256) throw new Error(`Historical snapshot bytes changed: ${item.file}`);
  const latest = snapshots.at(-1)!;
  if (Number(latest.file.slice(0, 4)) !== journal.entries.at(-1)!.idx) throw new Error("Latest migration has no matching snapshot.");
  for (let index = manifest.throughIndex + 1; index < journal.entries.length; index++) {
    if (!snapshots.some(item => item.file === `${String(index).padStart(4, "0")}_snapshot.json`)) throw new Error("New migration is missing its snapshot.");
  }
  return latest;
}

export async function checkMigrationSnapshots(folder: string) {
  const state = await readMigrationArtifactState(folder);
  const latest = validateMigrationArtifactState(state);
  const current = await assertCurrentSchemaSnapshot(latest.snapshot);
  return { migrations: state.journal.entries.length, snapshots: state.snapshots.length, tables: Object.keys(current.tables).length, latest: latest.file };
}

export async function assertCurrentSchemaSnapshot(snapshot: DrizzleSnapshotJSON) {
  const current = generateDrizzleJson(schema, snapshot.prevId);
  const semantic = (snapshot: DrizzleSnapshotJSON) => {
    // Native snapshots are JSON; undefined serializer fields have no stored representation.
    const value = JSON.parse(JSON.stringify(snapshot)) as Partial<DrizzleSnapshotJSON>;
    delete value.id;
    delete value.prevId;
    delete value._meta;
    return value;
  };
  if (!isDeepStrictEqual(semantic(snapshot), semantic(current))) throw new Error("Declared schema differs from the latest snapshot; generate and review a migration.");
  const changes = await generateMigration(snapshot, current);
  if (changes.length) throw new Error("Drizzle still proposes changes after snapshot comparison.");
  return current;
}
