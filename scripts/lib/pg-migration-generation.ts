import { execFile } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import { readMigrationArtifactState, validateMigrationArtifactState, type MigrationArtifactState } from "./pg-schema-snapshot.ts";

type Journal = MigrationArtifactState["journal"];

export function finalizeGeneratedJournal(previous: Journal, generated: Journal): Journal {
  if (generated.entries.length < previous.entries.length || generated.entries.length > previous.entries.length + 1
    || !isDeepStrictEqual({ ...generated, entries: generated.entries.slice(0, previous.entries.length) }, previous)) {
    throw new Error("Generator changed existing journal history or created an unexpected migration sequence.");
  }
  const result = structuredClone(generated);
  if (result.entries.length === previous.entries.length) return result;
  const latest = result.entries.at(-1)!;
  const preceding = previous.entries.at(-1)!;
  if (latest.idx !== preceding.idx + 1 || !Number.isSafeInteger(latest.when) || latest.when <= 0) throw new Error("Generator produced invalid migration ordering metadata.");
  // Drizzle uses this field as a migration cursor, not merely a creation-time label.
  latest.when = Math.max(latest.when, preceding.when + 1);
  if (!Number.isSafeInteger(latest.when)) throw new Error("Migration cursor exceeds the supported range.");
  return result;
}

export async function generatePgMigrationArtifacts(project: string, config: string, folder: string, name?: string) {
  const root = await realpath(project), out = await realpath(folder), configPath = await realpath(config);
  if (!out.startsWith(root + sep) || !configPath.startsWith(root + sep)) throw new Error("Migration generation must stay inside this project.");
  if (name !== undefined && !/^[a-z0-9_]{1,64}$/.test(name)) throw new Error("Migration name must use 1 to 64 lowercase letters, digits or underscores.");
  const previous = await readMigrationArtifactState(out);
  validateMigrationArtifactState(previous);
  const journalPath = join(out, "meta/_journal.json");
  const originalJournal = await readFile(journalPath);
  const result = await promisify(execFile)(process.execPath, [
    join(root, "node_modules/drizzle-kit/bin.cjs"), "generate", `--config=./${relative(root, configPath).replaceAll("\\", "/")}`,
    ...(name ? [`--name=${name}`] : []),
  ], { cwd: root, windowsHide: true, timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
    env: { NODE_ENV: "development", CI: "true", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP } });
  const generated = await readMigrationArtifactState(out);
  const finalized = finalizeGeneratedJournal(previous.journal, generated.journal);
  for (const [file, hash] of Object.entries(previous.sql)) if (generated.sql[file] !== hash) throw new Error(`Generator modified historical SQL: ${file}`);
  for (const file of previous.snapshots) {
    if (generated.snapshots.find(item => item.file === file.file)?.sha256 !== file.sha256) throw new Error(`Generator modified an existing snapshot: ${file.file}`);
  }
  if (!isDeepStrictEqual(generated.manifest, previous.manifest)) throw new Error("Generator changed the reconciliation manifest.");
  const created = finalized.entries.length > previous.journal.entries.length;
  const cursorAdvanced = !isDeepStrictEqual(finalized, generated.journal);
  if (cursorAdvanced) await writeFile(journalPath, JSON.stringify(finalized, null, 2) + "\n");
  validateMigrationArtifactState({ ...generated, journal: finalized });
  if (!created && (!/No schema changes/i.test(result.stdout) || !originalJournal.equals(await readFile(journalPath)))) throw new Error("Generator did not confirm a clean no-op.");
  return { created, cursorAdvanced, stdout: result.stdout, stderr: result.stderr };
}
