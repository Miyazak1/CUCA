import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import {
  diffOfficialCatalogManifests,
  fetchOfficialCatalogSource,
  hashOfficialCatalogRegistry,
  validateOfficialCatalogSourceRegistry,
  type OfficialCatalogAcquisitionManifest,
  type OfficialCatalogSourceRegistry,
} from "../src/server/catalog/official-source.ts";

const args = process.argv.slice(2);
const allowedPrefixes = ["--registry=", "--output=", "--source=", "--baseline=", "--max-bytes="];
const allowedFlags = new Set(["--validate-only"]);
const unknown = args.filter((arg) => !allowedFlags.has(arg) && !allowedPrefixes.some((prefix) => arg.startsWith(prefix)));
if (unknown.length) throw new Error(`Unknown options: ${unknown.join(", ")}`);

const option = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const registryPath = resolve(process.cwd(), option("--registry=") || "catalog-sources/official-sources.json");
const registry = JSON.parse(await readFile(registryPath, "utf8")) as OfficialCatalogSourceRegistry;
const validationErrors = validateOfficialCatalogSourceRegistry(registry);
if (validationErrors.length) throw new Error(`Official source registry is invalid:\n${validationErrors.join("\n")}`);

const selectedIds = new Set(args.filter((arg) => arg.startsWith("--source=")).map((arg) => arg.slice("--source=".length)));
const maxBytesOption = option("--max-bytes=");
const maxBytes = maxBytesOption === undefined ? undefined : Number(maxBytesOption);
if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 50 * 1024 * 1024)) {
  throw new Error("--max-bytes must be a positive integer no greater than 52428800.");
}
const sources = selectedIds.size ? registry.sources.filter((source) => selectedIds.has(source.id)) : registry.sources;
const missingIds = [...selectedIds].filter((id) => !registry.sources.some((source) => source.id === id));
if (missingIds.length) throw new Error(`Unknown source ids: ${missingIds.join(", ")}`);

if (args.includes("--validate-only")) {
  console.log(JSON.stringify({ ok: true, registryPath, sourceCount: sources.length, sourceIds: sources.map((source) => source.id) }, null, 2));
  process.exit(0);
}

const generatedAt = new Date().toISOString();
const defaultRunName = generatedAt.replace(/[:.]/g, "-");
const outputPath = resolve(process.cwd(), option("--output=") || `work/catalog-official/${defaultRunName}`);
const snapshots = [];
for (const [index, source] of sources.entries()) {
  if (index > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  snapshots.push(await fetchOfficialCatalogSource(source, { maxBytes }));
}

await mkdir(resolve(outputPath, "raw"), { recursive: true });
for (const snapshot of snapshots) {
  const extension = extensionFor(snapshot.metadata.contentType, snapshot.metadata.finalUrl);
  const artifactName = `${snapshot.metadata.id}.${snapshot.metadata.sha256}.${extension}`;
  const artifactPath = resolve(outputPath, "raw", artifactName);
  await writeFile(artifactPath, snapshot.content, { flag: "wx" });
  snapshot.metadata.artifactPath = relative(outputPath, artifactPath).replaceAll("\\", "/");
}

const manifest: OfficialCatalogAcquisitionManifest = {
  version: 1,
  generatedAt,
  registrySha256: hashOfficialCatalogRegistry({ ...registry, sources }),
  sources: snapshots.map((snapshot) => snapshot.metadata),
};
const manifestPath = resolve(outputPath, "manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });

let diff = null;
const baselineOption = option("--baseline=");
if (baselineOption) {
  const baselinePath = resolve(process.cwd(), baselineOption);
  const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as OfficialCatalogAcquisitionManifest;
  diff = diffOfficialCatalogManifests(baseline, manifest);
  await writeFile(resolve(outputPath, "diff.json"), `${JSON.stringify(diff, null, 2)}\n`, { flag: "wx" });
}

console.log(JSON.stringify({ ok: true, registryPath, outputPath, manifestPath, sourceCount: sources.length, diff }, null, 2));

function extensionFor(contentType: string, finalUrl: string): string {
  if (contentType === "text/html") return "html";
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (contentType === "application/vnd.ms-excel") return "xls";
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (contentType === "application/msword") return "doc";
  return extname(basename(new URL(finalUrl).pathname)).replace(/^\./, "") || "bin";
}
