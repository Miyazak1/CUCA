import { inspectProductionReadiness } from "../src/server/infra/production-readiness.ts";

const report = inspectProductionReadiness();

console.log(JSON.stringify(report, null, 2));

if (report.gateMode === "invalid" || (report.gateMode === "required" && !report.ready)) {
  process.exitCode = 1;
}
