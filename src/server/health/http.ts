import { createHealthStatus, type HealthStatusOptions } from "./health.ts";

export function createHealthHttpHandlers(options: HealthStatusOptions = {}) {
  return {
    async getHealth() {
      const status = await createHealthStatus(options);

      return Response.json(status, {
        status: status.status === "ok" ? 200 : 503,
      });
    },
  };
}
