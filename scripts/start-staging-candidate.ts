import { authorizeStagingCandidateStart } from "../src/server/infra/startup-policy.ts";

Object.assign(process.env, { NODE_ENV: "production" });

try {
  if (process.argv.length !== 2) throw new Error("Staging candidate startup does not accept command arguments.");
  const release = authorizeStagingCandidateStart(process.env);
  const { applicationServerOptions, startApplicationServer } = await import("./lib/app-server.ts");
  const { port } = await startApplicationServer({
    ...applicationServerOptions(),
    onEvent: event => console.log(JSON.stringify(event)),
  });
  console.log(JSON.stringify({ event: "application.started", port, releaseGate: "staging_candidate", release }));
} catch {
  console.error("Staging candidate startup failed. Inspect protected candidate identity and runtime configuration.");
  process.exitCode = 1;
}

export {};
