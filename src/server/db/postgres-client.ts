import pg from "pg";
import { serviceUnavailable } from "../shared/errors.ts";
import { getApplicationLifecycle } from "../shared/application-lifecycle.ts";
import type { SqlCatalogClient } from "../catalog/postgres-repository.ts";

const { Pool } = pg;

export type PostgresRuntimeConfig = {
  databaseUrl?: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  max?: number;
  connectionTimeoutMillis?: number;
  queryTimeoutMillis?: number;
  statementTimeoutMillis?: number;
  applicationName?: string;
};

let sharedPool: pg.Pool | null = null;
let sharedPoolKey: string | null = null;
let sharedPoolClosing: Promise<void> | null = null;
let unregisterPool: (() => void) | undefined;
const idleConnectionErrors = new WeakMap<pg.Pool, number>();

function poolOptions(config: PostgresRuntimeConfig, databaseUrl: string): pg.PoolConfig {
  const limits = {
    max: config.max ?? 8,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
    query_timeout: config.queryTimeoutMillis ?? 15_000,
    statement_timeout: config.statementTimeoutMillis ?? 10_000,
  };
  if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value <= 0)) {
    throw serviceUnavailable("PostgreSQL pool limits must be positive integers.");
  }
  return {
    connectionString: databaseUrl, ssl: config.ssl, ...limits,
    idleTimeoutMillis: 30_000, maxLifetimeSeconds: 300,
    idle_in_transaction_session_timeout: 15_000,
    application_name: config.applicationName ?? "cuac:api",
  };
}

export function getDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || env.PG_DATABASE_URL;
}

export function assertSafePostgresConnectionString(databaseUrl: string): void {
  let parsed: URL;
  try { parsed = new URL(databaseUrl); }
  catch { throw serviceUnavailable("PostgreSQL DATABASE_URL is invalid."); }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw serviceUnavailable("PostgreSQL DATABASE_URL must use the PostgreSQL protocol.");
  }
  if (parsed.search || parsed.hash) {
    throw serviceUnavailable("PostgreSQL DATABASE_URL must not contain query parameters or fragments; configure connection security separately.");
  }
}

export function createPostgresPool(config: PostgresRuntimeConfig = {}): pg.Pool {
  const databaseUrl = config.databaseUrl ?? getDatabaseUrl();

  if (!databaseUrl) {
    throw serviceUnavailable("PostgreSQL DATABASE_URL is not configured.");
  }
  assertSafePostgresConnectionString(databaseUrl);

  const pool = new Pool(poolOptions(config, databaseUrl));
  idleConnectionErrors.set(pool, 0);
  // pg removes a broken idle client itself, but still emits an otherwise fatal error event.
  pool.on("error", () => {
    idleConnectionErrors.set(pool, (idleConnectionErrors.get(pool) ?? 0) + 1);
  });
  return pool;
}

export function getSharedPostgresPool(config: PostgresRuntimeConfig = {}): pg.Pool {
  const lifecycle = getApplicationLifecycle();
  lifecycle.assertResourcesOpen();
  const databaseUrl = config.databaseUrl ?? getDatabaseUrl();

  if (!databaseUrl) {
    throw serviceUnavailable("PostgreSQL DATABASE_URL is not configured.");
  }

  const key = JSON.stringify(poolOptions(config, databaseUrl));
  if (sharedPoolClosing || sharedPool?.ending) {
    throw serviceUnavailable("PostgreSQL pool is shutting down.");
  }
  if (sharedPool && sharedPoolKey !== key) {
    throw serviceUnavailable("Close the PostgreSQL pool before changing its configuration.");
  }
  if (!sharedPool) {
    unregisterPool = lifecycle.registerResource("postgres", closeSharedPostgresPool);
    try { sharedPool = createPostgresPool({ ...config, databaseUrl }); }
    catch (error) { unregisterPool(); unregisterPool = undefined; throw error; }
    sharedPoolKey = key;
  }

  return sharedPool;
}

// Internal metrics only; never include connection strings, SQL, or driver error messages.
export function getPostgresPoolDiagnostics(pool: pg.Pool) {
  return {
    total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount,
    ending: pool.ending, ended: pool.ended,
    idleConnectionErrors: idleConnectionErrors.get(pool) ?? 0,
  };
}

export async function probePostgresPool(pool: pg.Pool): Promise<boolean> {
  if (pool.ending || pool.ended) return false;
  try {
    const query = { text: "select 1 as ok", query_timeout: 2000 };
    const result = await pool.query(query);
    return result.rows[0]?.ok === 1 && !pool.ending;
  } catch {
    return false;
  }
}

function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? error.code : undefined;
  return typeof code === "string" && (/^08/.test(code) || ["57P01", "57P02", "57P03", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"].includes(code))
    || /Connection terminated|Client has encountered a connection error|Query read timeout/i.test(error.message);
}

export function createSqlCatalogClient(pool: Pick<pg.Pool, "query">): SqlCatalogClient {
  return {
    async query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]> {
      const result = await pool.query(statement, [...params]);
      return result.rows as T[];
    },
  };
}

export type TransactionalSqlClient = SqlCatalogClient & {
  transaction<T>(work: (client: TransactionalSqlClient) => Promise<T>): Promise<T>;
};

export function createTransactionalSqlClient(pool: Pick<pg.Pool, "query" | "connect">): TransactionalSqlClient {
  return {
    ...createSqlCatalogClient(pool),
    async transaction<T>(work: (client: TransactionalSqlClient) => Promise<T>): Promise<T> {
      const connection = await pool.connect();
      let discard = false;
      let active = true;
      let pending = 0;
      let rollbackOnly = false;
      let failure: unknown;
      const onConnectionError = (error: Error) => {
        if (!rollbackOnly) failure = error;
        rollbackOnly = true;
        discard = true;
        active = false;
      };
      connection.on?.("error", onConnectionError);
      function ensureActive() {
        if (!active) throw new Error("Transaction scope is closed.");
      }
      async function execute<R>(operation: () => Promise<R>): Promise<R> {
        ensureActive();
        pending += 1;
        try {
          return await operation();
        } catch (error) {
          if (isConnectionFailure(error)) { discard = true; active = false; }
          if (!rollbackOnly) failure = error;
          rollbackOnly = true;
          throw error;
        } finally {
          pending -= 1;
        }
      }
      const scoped: TransactionalSqlClient = {
        query: <R extends Record<string, unknown>>(statement: string, params: readonly unknown[]) =>
          execute(async () => (await connection.query(statement, [...params])).rows as R[]),
        // Nested repository work joins this transaction; it never commits independently.
        transaction: (nested) => execute(() => nested(scoped)),
      };
      try {
        await connection.query("begin isolation level read committed");
        const result = await work(scoped);
        if (rollbackOnly) throw failure;
        if (pending !== 0) throw new Error("Transaction has unfinished operations.");
        active = false;
        try {
          await connection.query("commit");
          if (rollbackOnly) throw failure;
        } catch (error) {
          discard = true;
          throw error;
        }
        return result;
      } catch (error) {
        active = false;
        if (isConnectionFailure(error)) discard = true;
        // Destroying an uncertain transport ends the backend transaction without queuing more SQL.
        if (!discard) {
          try {
            await connection.query("rollback");
          } catch {
            discard = true;
          }
        }
        throw error;
      } finally {
        active = false;
        connection.release(discard);
        connection.removeListener?.("error", onConnectionError);
      }
    },
  };
}

export async function closeSharedPostgresPool(): Promise<void> {
  if (sharedPoolClosing) return sharedPoolClosing;
  if (!sharedPool) return;
  const pool = sharedPool;
  sharedPoolClosing = pool.end().finally(() => {
    unregisterPool?.();
    unregisterPool = undefined;
    sharedPool = null;
    sharedPoolKey = null;
    sharedPoolClosing = null;
  });
  return sharedPoolClosing;
}
