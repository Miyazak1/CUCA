import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

const args = process.argv.slice(2);
const unknownOptions = args.filter((arg) => arg.startsWith("--") && !arg.startsWith("--report="));
if (unknownOptions.length) throw new Error(`Unknown options: ${unknownOptions.join(", ")}`);
const seedPath = resolve(process.cwd(), args.find((arg) => !arg.startsWith("--")) || "seeds/catalog.sample.json");
const reportOption = args.find((arg) => arg.startsWith("--report="));
const reportPath = reportOption ? resolve(process.cwd(), reportOption.slice("--report=".length)) : null;
const raw = await readFile(seedPath, "utf8");
const bundle = JSON.parse(raw) as unknown;
const result = createCatalogMigrationValidationReport(bundle);
const serialized = `${JSON.stringify(result, null, 2)}\n`;

if (reportPath) await writeFile(reportPath, serialized, { flag: "wx" });
console.log(JSON.stringify({ seedPath, reportPath, ...result }, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
