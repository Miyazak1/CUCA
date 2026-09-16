import { spawn } from "node:child_process";
import { resolve } from "node:path";

function normalizedProxyEnvironment(source = process.env) {
  const environment = { ...source };
  const proxyNames = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ];

  for (const name of proxyNames) {
    const value = environment[name]?.trim();
    if (!value) continue;

    if (/^[^\s/:]+:\d+$/.test(value)) {
      environment[name] = `http://${value}`;
      console.log(`[build] Normalized ${name} to an absolute proxy URL.`);
      continue;
    }

    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${name} must be an absolute proxy URL such as http://127.0.0.1:7890.`);
    }
    if (!parsed.protocol || !parsed.hostname) {
      throw new Error(`${name} must be an absolute proxy URL such as http://127.0.0.1:7890.`);
    }
  }

  return environment;
}

const vinextCli = resolve(process.cwd(), "node_modules", "vinext", "dist", "cli.js");
const child = spawn(process.execPath, [vinextCli, "build"], {
  cwd: process.cwd(),
  env: normalizedProxyEnvironment(),
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`[build] Unable to launch Vinext: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`[build] Vinext terminated by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
