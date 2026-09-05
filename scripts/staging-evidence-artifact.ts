import { resolve } from "node:path";
import { createEvidenceArtifactReference } from "./lib/evidence-artifact.ts";

async function main() {
  if (process.argv.length !== 3) throw new Error("One evidence artifact path is required.");
  const result = await createEvidenceArtifactReference(resolve(process.argv[2]!));
  console.log(JSON.stringify(result, null, 2));
}

main().catch(() => {
  console.error("Evidence artifact hashing failed. Verify the protected, redacted regular file.");
  process.exitCode = 1;
});
