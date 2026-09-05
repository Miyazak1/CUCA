import type { TransactionalSqlClient } from "./postgres-client.ts";

type AsyncMethodKey<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => Promise<unknown> ? K : never;
}[keyof T];

// Construct repositories and audit writers from the same scoped client per call.
// Use only for database work, never a handler that catches errors into Responses.
export function transactionalMethod<T, K extends AsyncMethodKey<T>>(
  client: TransactionalSqlClient,
  createService: (transaction: TransactionalSqlClient) => T,
  key: K,
): T[K] {
  return ((...args: unknown[]) => client.transaction(async (transaction) => {
    const service = createService(transaction);
    const method = service[key] as (...values: unknown[]) => Promise<unknown>;
    return method.apply(service, args);
  })) as T[K];
}
