import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(await readFile(resolve(projectDir, "config/dependency-audit-baseline.json"), "utf8"));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run the dependency audit through npm so the active npm CLI is known.");

const result = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], {
  cwd: projectDir,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
if (result.error) throw result.error;

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  const diagnostic = (result.stderr || result.stdout || "No audit output.").trim();
  throw new Error(`Dependency audit did not return JSON: ${diagnostic}`);
}

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const failures = [];
const accepted = [];
for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  const expected = baseline[name];
  if (!expected) {
    failures.push(`${name}: unreviewed ${vulnerability.severity} vulnerability chain`);
    continue;
  }
  if ((severityRank[vulnerability.severity] ?? 99) > (severityRank[expected.severity] ?? -1)) {
    failures.push(`${name}: severity increased from ${expected.severity} to ${vulnerability.severity}`);
  }
  const actualSources = vulnerability.via
    .filter((entry) => entry && typeof entry === "object" && Number.isSafeInteger(entry.source))
    .map((entry) => entry.source);
  const unexpectedSources = actualSources.filter((source) => !expected.advisorySources.includes(source));
  if (unexpectedSources.length) failures.push(`${name}: new advisory source(s) ${unexpectedSources.join(", ")}`);
  accepted.push(name);
}

if (failures.length) throw new Error(`Dependency audit found unreviewed risk:\n${failures.map((item) => `- ${item}`).join("\n")}`);
console.log(JSON.stringify({
  ok: true,
  remainingReviewedVulnerabilityChains: accepted.sort(),
  counts: report.metadata?.vulnerabilities ?? {},
}, null, 2));
