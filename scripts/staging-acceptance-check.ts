import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectStagingAcceptance } from "../src/server/infra/staging-acceptance.ts";

async function main() {
  if (process.argv.length !== 3) throw new Error("One staging evidence manifest path is required.");
  const path = resolve(process.argv[2]!);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 128 * 1024) {
    throw new Error("Staging evidence manifest must be a bounded regular file.");
  }
  const manifest = JSON.parse(await readFile(path, "utf8"));
  const report = inspectStagingAcceptance(manifest);
  console.log(JSON.stringify(report, null, 2));
  if (!report.readyForReview) process.exitCode = 1;
}

main().catch(() => {
  console.error("Staging evidence preflight rejected the manifest. Inspect the protected release record.");
  process.exitCode = 1;
});
