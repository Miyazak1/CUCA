import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCatalogReleaseCandidate, validateCatalogTargetBinding } from "./lib/catalog-data-candidate-runtime.ts";

type Row = Record<string, unknown>;
const root = process.cwd();
const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8")) as Row;
const [candidate, rehearsal] = await Promise.all([
  readJson("work/catalog-quality/catalog-data-release-candidate.json"),
  readJson("work/catalog-quality/catalog-data-release-candidate-rehearsal.json"),
]);
const candidateReport = validateCatalogReleaseCandidate(candidate);
if (!candidateReport.ok) throw new Error(`Release candidate is invalid: ${candidateReport.errors.join("; ")}`);
const rehearsalResult = rehearsal.result as Row;
const candidateHashes = candidate.hashes as Row;
const rehearsalHashes = rehearsal.hashes as Row;
if (rehearsal.status !== "passed_non_authorizing_actual_schema_rehearsal"
  || rehearsal.readinessPlanSha256 !== candidate.readinessPlanSha256
  || rehearsalHashes.operationsSha256 !== candidateHashes.operationsSha256
  || rehearsalHashes.preimageSha256 !== candidateHashes.preimageSha256
  || rehearsalResult.actualCatalogSchema !== true || rehearsalResult.secondPassChanges !== 0
  || rehearsalResult.publicEligibleProhibitedSources !== 0 || rehearsalResult.rollbackRestoredOriginalHash !== true
  || rehearsalResult.ownedContainerRemoved !== true) throw new Error("Actual-schema rehearsal evidence is missing or stale.");

const targetPath = process.env.CUAC_CATALOG_TARGET_CONFIG;
if (!targetPath) {
  console.log(JSON.stringify({
    ok: true,
    status: "awaiting_real_staging_target_configuration",
    candidateValid: true,
    actualSchemaRehearsalPassed: true,
    executionAuthorized: false,
    publicationAuthorized: false,
    requiredConfiguration: resolve(root, "config/catalog-data-target.example.json"),
  }, null, 2));
} else {
  const binding = await readJson(targetPath);
  const bindingReport = validateCatalogTargetBinding(candidate, binding);
  if (!bindingReport.ok) throw new Error(`Target binding rejected: ${bindingReport.errors.join("; ")}`);
  console.log(JSON.stringify({
    ok: true,
    status: "target_binding_valid_non_executing_preflight",
    target: { environment: binding.environment, databaseName: binding.databaseName, databaseUser: binding.databaseUser, databaseHost: binding.databaseHost },
    executionAuthorized: false,
    publicationAuthorized: false,
  }, null, 2));
}
