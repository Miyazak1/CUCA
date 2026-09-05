import { loadReleaseGateReport } from "./lib/release-gate.ts";
import { assertSafeApplicationProcessEnvironment } from "../src/server/infra/startup-policy.ts";

Object.assign(process.env, { NODE_ENV: "production" });

try {
  if (process.argv.length !== 3) throw new Error("One protected staging evidence manifest path is required.");
  assertSafeApplicationProcessEnvironment(process.env);
  const report = await loadReleaseGateReport(process.argv[2]!);
  console.log(JSON.stringify(report));
  if (!report.readyForHumanReview) throw new Error("Release gate has blockers.");

  const { applicationServerOptions, startApplicationServer } = await import("./lib/app-server.ts");
  const { port } = await startApplicationServer({
    ...applicationServerOptions(),
    onEvent: event => console.log(JSON.stringify(event)),
  });
  console.log(JSON.stringify({ event: "application.started", port, releaseGate: "reviewed" }));
} catch {
  console.error("Reviewed application startup failed. Inspect the protected release and runtime records.");
  process.exitCode = 1;
}

export {};
