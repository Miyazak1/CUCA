import type { MigrationMeta } from "drizzle-orm/migrator";
import type { TransactionalSqlClient } from "./postgres-client.ts";

// Database-scoped, shared by every CUAC release regardless of checkout or host.
export const POSTGRES_MIGRATION_LOCK = [0x43554143, 1] as const;

type LedgerRow = { id: unknown; hash: unknown; created_at: unknown };
type LedgerTable = { oid: number; relkind: string; relrowsecurity: boolean; relforcerowsecurity: boolean };

export type CheckedMigrationResult = { appliedBefore: number; appliedNow: number; appliedTotal: number };

export function assertMigrationPlan(plan: readonly MigrationMeta[]): void {
  if (!Array.isArray(plan) || plan.length === 0 || plan.length > 10_000) throw new Error("Invalid migration plan length.");
  for (const [index, migration] of plan.entries()) {
    if (!migration || !Number.isSafeInteger(migration.folderMillis) || migration.folderMillis <= (plan[index - 1]?.folderMillis ?? 0)
      || typeof migration.hash !== "string" || !/^[a-f0-9]{64}$/.test(migration.hash) || typeof migration.bps !== "boolean"
      || !Array.isArray(migration.sql) || !migration.sql.length || migration.sql.some((statement: unknown) => typeof statement !== "string")
      || !migration.sql.some((statement: unknown) => typeof statement === "string" && statement.trim().length > 0)) throw new Error(`Invalid migration plan entry at position ${index}.`);
  }
}

export function assertMigrationLedgerPrefix(rows: readonly LedgerRow[], plan: readonly MigrationMeta[]): number {
  if (rows.length > plan.length) throw new Error("Migration ledger contains entries absent from this release.");
  let previousId = 0;
  for (const [index, row] of rows.entries()) {
    if (typeof row.id !== "number" || !Number.isSafeInteger(row.id) || row.id <= previousId
      || row.hash !== plan[index].hash || row.created_at !== String(plan[index].folderMillis)) {
      throw new Error(`Migration ledger is not the exact release prefix at position ${index}.`);
    }
    previousId = row.id;
  }
  return rows.length;
}

async function ledgerTable(client: TransactionalSqlClient): Promise<LedgerTable | undefined> {
  const rows = await client.query<LedgerTable>(`select c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'drizzle' and c.relname = '__drizzle_migrations'`, []);
  return rows[0];
}

function assertLedgerTable(table: LedgerTable | undefined, expectedOid?: number): void {
  if (!table || table.relkind !== "r" || table.relrowsecurity || table.relforcerowsecurity
    || (expectedOid !== undefined && table.oid !== expectedOid)) throw new Error("Migration ledger relation changed or has unsupported visibility.");
}

async function ledgerRows(client: TransactionalSqlClient, count: number): Promise<LedgerRow[]> {
  return client.query<LedgerRow>(`select id, hash, created_at::text as created_at
    from "drizzle"."__drizzle_migrations" order by id limit $1`, [count + 1]);
}

export async function runCheckedMigrationPlan(client: TransactionalSqlClient, migrations: readonly MigrationMeta[]): Promise<CheckedMigrationResult> {
  // Validate and execute the same immutable-in-scope bytes; never reload SQL after taking the lock.
  const plan = structuredClone(migrations);
  assertMigrationPlan(plan);
  return client.transaction(async tx => {
    const lock = await tx.query<{ acquired: boolean }>("select pg_catalog.pg_try_advisory_xact_lock($1::integer, $2::integer) as acquired", POSTGRES_MIGRATION_LOCK);
    if (lock[0]?.acquired !== true) throw new Error("Another CUAC migration job holds the database lock. Inspect that job before retrying.");
    await tx.query(`select pg_catalog.set_config('search_path', 'public, pg_temp', true),
      pg_catalog.set_config('statement_timeout', '60000', true), pg_catalog.set_config('lock_timeout', '5000', true),
      pg_catalog.set_config('idle_in_transaction_session_timeout', '60000', true)`, []);

    let table = await ledgerTable(tx);
    let rows: LedgerRow[] = [];
    if (table) {
      assertLedgerTable(table);
      // Also exclude non-cooperating ledger DML while the release prefix is being checked/applied.
      await tx.query('lock table "drizzle"."__drizzle_migrations" in exclusive mode nowait', []);
      assertLedgerTable(await ledgerTable(tx), table.oid);
      rows = await ledgerRows(tx, plan.length);
    }
    const appliedBefore = assertMigrationLedgerPrefix(rows, plan);
    if (appliedBefore === 0) {
      const relations = await tx.query<{ present: boolean }>(`select exists (
        select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      ) as present`, []);
      if (relations[0]?.present !== false) throw new Error("Refusing empty migration history with existing public relations; reviewed recovery is required.");
    }
    if (!table) {
      await tx.query('create schema if not exists "drizzle"', []);
      await tx.query('create table "drizzle"."__drizzle_migrations" (id serial primary key, hash text not null, created_at bigint)', []);
      table = await ledgerTable(tx);
      assertLedgerTable(table);
    }

    for (const migration of plan.slice(appliedBefore)) {
      for (const statement of migration.sql) await tx.query(statement, []);
      await tx.query('insert into "drizzle"."__drizzle_migrations" (hash, created_at) values ($1, $2)', [migration.hash, migration.folderMillis]);
    }
    assertLedgerTable(await ledgerTable(tx), table!.oid);
    const appliedTotal = assertMigrationLedgerPrefix(await ledgerRows(tx, plan.length), plan);
    if (appliedTotal !== plan.length) throw new Error("Migration ledger is incomplete after execution; rolling back.");
    return { appliedBefore, appliedNow: appliedTotal - appliedBefore, appliedTotal };
  });
}
