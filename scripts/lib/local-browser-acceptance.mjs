import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function localAcceptanceBrowser() {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.CUAC_PLAYWRIGHT_MODULE || resolve(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
  const configured = process.env.CUAC_CHROMIUM_EXECUTABLE;
  if (configured) {
    if (!existsSync(configured)) throw new Error("CUAC_CHROMIUM_EXECUTABLE does not exist.");
    return { chromium, executablePath: configured };
  }
  if (existsSync(chromium.executablePath())) return { chromium, executablePath: chromium.executablePath() };
  const cache = process.platform === "win32"
    ? resolve(process.env.LOCALAPPDATA || resolve(homedir(), "AppData/Local"), "ms-playwright")
    : process.platform === "darwin" ? resolve(homedir(), "Library/Caches/ms-playwright") : resolve(homedir(), ".cache/ms-playwright");
  if (existsSync(cache)) {
    const installations = readdirSync(cache).filter(name => /^chromium_headless_shell-\d+$/.test(name)).sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()));
    for (const installation of installations) {
      const binary = process.platform === "win32" ? "chrome-headless-shell-win64/chrome-headless-shell.exe" : process.platform === "darwin" ? "chrome-headless-shell-mac-arm64/chrome-headless-shell" : "chrome-headless-shell-linux64/chrome-headless-shell";
      const executablePath = resolve(cache, installation, binary);
      if (existsSync(executablePath)) return { chromium, executablePath };
    }
  }
  throw new Error("An installed Chromium is required. Set CUAC_CHROMIUM_EXECUTABLE; this check does not download browsers.");
}
