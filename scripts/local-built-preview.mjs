import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalDevelopmentState, localRuntimeEnvironment } from "./lib/local-development.ts";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(project);
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
console.log(`Local built preview: http://127.0.0.1:${state.applicationPort}; no deployment or external delivery.`);
const child = spawn(process.execPath, ["scripts/start-app.ts"], {
  cwd: project,
  env: { ...localRuntimeEnvironment(state), PORT: String(state.applicationPort), CUAC_HTTP_HOST: "127.0.0.1" },
  stdio: "inherit",
  windowsHide: true,
});
child.once("error", error => { console.error(error.message); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
