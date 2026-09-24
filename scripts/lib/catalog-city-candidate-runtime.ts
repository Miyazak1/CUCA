import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
type SqlClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Row[]; rowCount?: number | null }> };

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
export const cityCandidateSha256 = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

export function validateCityReleaseCandidate(candidate: Row) {
  const errors: string[] = [];
  const auth = candidate.authorization as Row;
  if (candidate.version !== 1 || candidate.status !== "owner_default_accepted_non_public_city_candidate") errors.push("invalid candidate identity");
  if (auth?.candidatePreparationAuthorized !== true || auth?.executionAuthorized !== false || auth?.persistentDatabaseWriteAuthorized !== false || auth?.publicationAuthorized !== false) errors.push("candidate over-authorizes execution or publication");
  const decision = candidate.decision as Row;
  const hashes = candidate.hashes as Row;
  const operations = candidate.operations as Row[];
  const summary = candidate.summary as Row;
  if (decision?.humanReviewCompleted !== false) errors.push("candidate must not claim human review");
  if (hashes?.operationsSha256 !== cityCandidateSha256(operations)) errors.push("operations hash mismatch");
  if (hashes?.preimageSha256 !== cityCandidateSha256(candidate.preimage)) errors.push("preimage hash mismatch");
  if (hashes?.rehearsalFixturesSha256 !== cityCandidateSha256(candidate.rehearsalFixtures)) errors.push("fixture hash mismatch");
  if (operations?.length !== summary?.candidateCities) errors.push("candidate summary mismatch");
  for (const operation of operations ?? []) {
    const city = operation.city as Row;
    const evidence = operation.evidence as Row;
    if (city?.slug !== operation.slug || city?.status !== "draft" || city?.verificationStatus !== "unverified") errors.push(`unsafe lifecycle for ${operation.slug}`);
    if (!String(city?.sourceUrl ?? "").startsWith("https://") || !/^[a-f0-9]{64}$/i.test(String(evidence?.primarySnapshotSha256 ?? ""))) errors.push(`unsafe evidence for ${operation.slug}`);
  }
  return { ok: errors.length === 0, errors };
}

export async function applyCityReleaseCandidateForDisposableRehearsal(client: SqlClient, candidate: Row) {
  const validation = validateCityReleaseCandidate(candidate);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  let changed = 0;
  for (const operation of candidate.operations as Row[]) {
    const city = operation.city as Row;
    const result = await client.query(`update cities set
      name_zh=$2, name_en=$3, region=$4, province=$5, monthly_cost=$6, monthly_cost_rmb=$7,
      cost_level=$8, density=$9, tags=$10::jsonb, content_json=$11::jsonb, nearby=$12::jsonb,
      sort_order=$13, version=$14, status='draft', verification_status='unverified', source_url=$15,
      source_label=$16, source_note=$17, source_field_lineage_json=$18::jsonb, verified_by_user_id=null,
      last_verified_at=null, next_review_due_at=null, updated_at=now()
      where slug=$1 and status in ('active','draft') and verification_status='unverified' and (
        name_zh is distinct from $2 or name_en is distinct from $3 or region is distinct from $4 or province is distinct from $5
        or monthly_cost is distinct from $6 or monthly_cost_rmb is distinct from $7 or cost_level is distinct from $8 or density is distinct from $9
        or tags is distinct from $10::jsonb or content_json is distinct from $11::jsonb or nearby is distinct from $12::jsonb
        or sort_order is distinct from $13 or version is distinct from $14 or source_url is distinct from $15 or source_label is distinct from $16
        or source_note is distinct from $17 or source_field_lineage_json is distinct from $18::jsonb)`, [
      city.slug, city.nameZh, city.nameEn, city.region, city.province, city.monthlyCost, city.monthlyCostRmb,
      city.costLevel, city.density, JSON.stringify(city.tags), JSON.stringify(city.content), JSON.stringify(city.nearby),
      city.sortOrder, city.version, city.sourceUrl, city.sourceLabel, city.sourceNote, JSON.stringify(city.sourceFieldLineage),
    ]);
    changed += result.rowCount ?? 0;
  }
  return { citiesChanged: changed };
}
