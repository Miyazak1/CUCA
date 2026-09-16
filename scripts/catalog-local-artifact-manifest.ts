import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const seedDirectory = resolve(projectRoot, "seeds");
const outputPath = resolve(projectRoot, "catalog-sources/local-artifact-manifest.json");
const trackedFixtures = new Set([
  "catalog.local.synthetic.json",
  "catalog.sample.json",
]);

const names = (await readdir(seedDirectory))
  .filter((name) => name.startsWith("catalog.") && name.endsWith(".json") && !trackedFixtures.has(name))
  .sort((left, right) => left.localeCompare(right, "en"));

const artifacts = [];
for (const name of names) {
  const bytes = await readFile(resolve(seedDirectory, name));
  artifacts.push({
    path: `seeds/${name}`,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    stage: classify(name),
  });
}

const manifest = {
  schema: "cuac.catalog-local-artifacts.v1",
  purpose: "Local custody manifest for catalog review artifacts excluded from the application source release.",
  artifactCount: artifacts.length,
  totalBytes: artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0),
  artifacts,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: "catalog-sources/local-artifact-manifest.json", artifactCount: manifest.artifactCount, totalBytes: manifest.totalBytes }));

function classify(name: string): string {
  if (name.includes("publication-verification")) return "publication-verification";
  if (name.endsWith(".approved.local.json") || name.endsWith(".approved-verified.local.json")) return "approved-publication";
  if (name.endsWith(".approval.json") || name.endsWith(".approval-verified.json")) return "approval";
  if (name.endsWith(".review.json") || name.endsWith(".safe-review.json")) return "review";
  if (name.endsWith(".validation.json") || name.endsWith(".dry-run.json")) return "validation";
  if (name.endsWith(".draft.json") || name.endsWith(".local-draft.json")) return "draft";
  if (name.endsWith(".published.json")) return "legacy-published-snapshot";
  return "other";
}
