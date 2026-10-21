import { assertUnreviewedApplicationStartAllowed } from "../src/server/infra/startup-policy.ts";

Object.assign(process.env, { NODE_ENV: "production" });

try {
  if (process.argv.length !== 2) throw new Error("Configure the managed server through its documented environment.");
  assertUnreviewedApplicationStartAllowed(process.env);
  const { applicationServerOptions, startApplicationServer } = await import("./lib/app-server.ts");
  const { port } = await startApplicationServer({ ...applicationServerOptions(),
    onEvent: event => console.log(JSON.stringify(event)),
  });
  console.log(JSON.stringify({ event: "application.started", port }));
} catch (error) {
  if (process.env.CUAC_REHEARSAL_DIAGNOSTICS === "1") console.error(error);
  console.error("Managed application startup failed. Check the protected build and runtime configuration.");
  process.exitCode = 1;
}

export {};
