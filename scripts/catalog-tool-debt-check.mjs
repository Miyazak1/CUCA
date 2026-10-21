import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(await readFile(resolve(projectDir, "config/catalog-tool-debt-baseline.json"), "utf8"));

function runNode(relativeExecutable, args) {
  const result = spawnSync(process.execPath, [resolve(projectDir, relativeExecutable), ...args], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function increment(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function assertAtOrBelowBaseline(label, actual, expected) {
  const failures = [];
  for (const [key, count] of Object.entries(actual)) {
    const limit = expected[key] ?? 0;
    if (count > limit) failures.push(`${key}: ${count} (baseline ${limit})`);
  }
  if (failures.length) {
    throw new Error(`${label} increased:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  }
}

const lintOutput = runNode("node_modules/eslint/bin/eslint.js", ["scripts/catalog-*.ts", "--format", "json"]);
const lintStart = lintOutput.indexOf("[");
const lintEnd = lintOutput.lastIndexOf("]");
if (lintStart < 0 || lintEnd < lintStart) throw new Error("Catalog lint output was not valid JSON.");
const lintResults = JSON.parse(lintOutput.slice(lintStart, lintEnd + 1));
const lintErrorsByRule = {};
for (const result of lintResults) {
  for (const message of result.messages) {
    if (message.severity === 2) increment(lintErrorsByRule, message.ruleId ?? "<parser>");
  }
}

const typeOutput = runNode("node_modules/typescript/bin/tsc", ["--noEmit", "--pretty", "false"]);
const typeErrorsByCode = {};
for (const line of typeOutput.split(/\r?\n/)) {
  if (!/^scripts[\\/]catalog-/.test(line)) continue;
  const match = line.match(/error TS(\d+):/);
  if (match) increment(typeErrorsByCode, match[1]);
}

assertAtOrBelowBaseline("Catalog lint debt", lintErrorsByRule, baseline.lintErrorsByRule);
assertAtOrBelowBaseline("Catalog type debt", typeErrorsByCode, baseline.typeErrorsByCode);

const lintTotal = Object.values(lintErrorsByRule).reduce((sum, count) => sum + count, 0);
const typeTotal = Object.values(typeErrorsByCode).reduce((sum, count) => sum + count, 0);
console.log(JSON.stringify({ ok: true, lintErrors: lintTotal, typeErrors: typeTotal }, null, 2));
