import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogSeedImportPlan } from "../src/server/catalog/seed-contract.ts";

const seedPath = resolve(process.cwd(), process.argv[2] || "seeds/catalog.sample.json");
const raw = await readFile(seedPath, "utf8");
const bundle = JSON.parse(raw) as unknown;
const result = createCatalogSeedImportPlan(bundle);

console.log(JSON.stringify({ seedPath, ...result }, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
