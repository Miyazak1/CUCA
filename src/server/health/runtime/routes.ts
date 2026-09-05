import { createHealthHttpHandlers } from "../http.ts";
import { getSharedPostgresPool, probePostgresPool } from "../../db/postgres-client.ts";

export function getHealthRouteHandlers() {
  return createHealthHttpHandlers({ databaseProbe: () => probePostgresPool(getSharedPostgresPool()) });
}
