import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { validateRequirementReleaseCandidate } from "./lib/catalog-requirement-candidate-runtime.ts";
import {
  assertSingleHostRequirementPreflightTarget,
  preflightSingleHostRequirementCandidate,
} from "./lib/catalog-requirement-single-host-preflight.ts";

const candidatePath = resolve(process.cwd(), process.argv[2] || "seeds/application-requirements-release-candidate.unreviewed.json");

try {
  const target = assertSingleHostRequirementPreflightTarget(process.env);
  const candidate = validateRequirementReleaseCandidate(JSON.parse(await readFile(candidatePath, "utf8")));
  const pool = createPostgresPool({ max: 1, applicationName: "cuac:requirement-single-host-preflight", statementTimeoutMillis: 120_000 });
  const connection = await pool.connect();
  try {
    await connection.query("begin isolation level repeatable read read only");
    const result = await preflightSingleHostRequirementCandidate(connection, candidate);
    await connection.query("rollback");
    console.log(JSON.stringify({ ok: true, target: { kind: "single_host_loopback", databaseName: target.databaseName }, ...result }, null, 2));
  } catch (error) {
    try { await connection.query("rollback"); } catch { /* Read-only cleanup only. */ }
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
} catch (error) {
  const message = error instanceof Error && !/postgres|database|connect|socket|password|host/i.test(error.message)
    ? error.message
    : "Single-host requirement preflight failed; inspect protected container logs and database health.";
  console.error(message);
  process.exitCode = 1;
}
