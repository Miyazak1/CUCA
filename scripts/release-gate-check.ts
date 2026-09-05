import { loadReleaseGateReport } from "./lib/release-gate.ts";

async function main() {
  if (process.argv.length !== 3) throw new Error("One staging evidence manifest path is required.");
  const report = await loadReleaseGateReport(process.argv[2]!);

  console.log(JSON.stringify(report, null, 2));
  if (!report.readyForHumanReview) process.exitCode = 1;
}

main().catch(() => {
  console.error("Release gate rejected the configuration or evidence. Inspect the protected release record.");
  process.exitCode = 1;
});
