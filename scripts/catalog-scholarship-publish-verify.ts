import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { localDatabaseUrl, type LocalDevelopmentState } from "./lib/local-development.ts";
import { createPostgresPool, createSqlCatalogClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length)
  ?? "http://127.0.0.1:52118";
const expectedTotal = Number(process.argv.find(arg => arg.startsWith("--expected-total="))?.slice("--expected-total=".length) ?? "381");
const reportPath = resolve(root, process.argv.find(arg => arg.startsWith("--report="))?.slice("--report=".length)
  ?? "seeds/catalog.scholarships-rich-batch-01.publication-verification.json");
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
if (!Number.isSafeInteger(expectedTotal) || expectedTotal < 20) throw new Error("Expected total must be a positive integer.");

const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const bundle = await readJson("seeds/catalog.scholarships-rich-batch-01.approved-verified.local.json");
const approval = await readJson("seeds/catalog.scholarships-rich-batch-01.approval-verified.json");
const runtime = await readJson(".cuac-local/runtime.json") as LocalDevelopmentState;
const expectedBySlug = new Map(bundle.scholarships.map((record: any) => [record.slug, record]));
assert.equal(expectedBySlug.size, 20);
assert.equal(approval.approvedDraftBundleSha256, "b4a010af88f94136027a56e737dc9a0a823b9e5bd014f42220b6c8d00ab84c59");

const publicItems: any[] = [];
for (let offset = 0; offset < 2000; offset += 100) {
  const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships?limit=100&offset=${offset}`);
  assert.equal(response.status, 200, `Scholarship list failed at offset ${offset}`);
  const page = await response.json() as { data: any[] };
  assert.ok(Array.isArray(page.data));
  publicItems.push(...page.data);
  if (page.data.length < 100) break;
}
assert.equal(publicItems.length, expectedTotal, "Unexpected public scholarship total");
assert.equal(new Set(publicItems.map(record => record.slug)).size, expectedTotal,
  "Scholarship offset pagination returned duplicate or missing slugs");

const removedHistoricalSlugs = [
  "belt-and-road-trade-union-cadres-chinese-language-training-scholarship",
  "three-gorges-university-full-scholarship-for-myanmar-students",
  "asean-china-young-leaders-scholarship",
  "renmin-university-belt-and-road-scholarship",
  "renmin-university-foreign-student-scholarship",
];
const publicBySlug = new Map(publicItems.map(record => [record.slug, record]));
const removedVisibleSlugs = removedHistoricalSlugs.filter(slug => publicBySlug.has(slug));

let explicitDeadlineCount = 0;
for (const [slug, expected] of expectedBySlug) {
  const listItem: any = publicBySlug.get(slug);
  assert.ok(listItem, `Published scholarship missing from list: ${slug}`);
  assert.equal(listItem.title, expected.title);
  assert.equal(listItem.sourceUrl, expected.sourceUrl);
  assert.equal(listItem.sourceLabel, expected.sourceLabel);
  assert.equal(listItem.applicableDegree, expected.applicableDegree);
  assert.equal(listItem.applicableProgram, expected.applicableProgram);
  assert.equal(listItem.sourceStatus, "verified");
  assert.equal(listItem.lastVerifiedAt, approval.approvedAt);
  assert.ok(listItem.summary?.trim());
  assert.ok(listItem.coverage?.trim());
  assert.ok(listItem.requirementText?.trim());
  for (const field of ["benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) {
    assert.equal(listItem[field].length, expected[field].length, `${slug}.${field} count mismatch`);
    assert.ok(listItem[field].length > 0, `${slug}.${field} is empty`);
  }
  if (expected.deadlineDate) {
    explicitDeadlineCount += 1;
    assert.ok(listItem.deadlineDate?.startsWith(expected.deadlineDate), `${slug}.deadlineDate mismatch`);
  }

  const detailResponse = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${listItem.id}`);
  assert.equal(detailResponse.status, 200, `Scholarship detail failed: ${slug}`);
  const detail = (await detailResponse.json() as { data: any }).data;
  assert.equal(detail.slug, slug);
  assert.equal(detail.status, "active");
  assert.equal(detail.verificationStatus, "verified");
  assert.equal(detail.lastVerifiedAt, approval.approvedAt);
  assert.equal(detail.applicableDegree, expected.applicableDegree);
  assert.equal(detail.applicableProgram, expected.applicableProgram);
  assert.equal(detail.bodySections.length, expected.bodySections.length);
  assert.equal(detail.benefits.length, expected.benefits.length);
  assert.equal(detail.tags.length, expected.tags.length);
  assert.ok(detail.school?.id && detail.school?.slug === expected.schoolSlug, `${slug}.school projection mismatch`);
  assert.deepEqual(detail.sourceFieldLineage, expected.sourceFieldLineage);
}
assert.equal(explicitDeadlineCount, 19);

const pool = createPostgresPool({
  databaseUrl: localDatabaseUrl(runtime), max: 1, applicationName: "cuac:scholarship-publication-verify",
});
try {
  const sql = createSqlCatalogClient(pool);
  const slugs = [...expectedBySlug.keys()];
  const removedRows = await sql.query<{ slug: string; status: string }>(
    `select slug, status from scholarships where slug = any($1::text[]) order by slug`,
    [removedHistoricalSlugs],
  );
  assert.equal(removedRows.some(row => row.status === "active"), false,
    `A removed historical scholarship is active: ${removedRows.map(row => `${row.slug}:${row.status}`).join(", ")}`);
  assert.equal(removedVisibleSlugs.length, 0,
    `A removed historical scholarship is visible through the API: ${removedVisibleSlugs.join(", ")}`);
  const rows = await sql.query<{
    slug: string; status: string; verification_status: string; last_verified_at: Date;
    body_count: number; benefit_count: number; eligibility_count: number; material_count: number;
    step_count: number; action_count: number; evidence_count: number;
  }>(
    `select s.slug, s.status, s.verification_status, s.last_verified_at,
       jsonb_array_length(s.body_sections)::int as body_count,
       jsonb_array_length(s.benefit_items)::int as benefit_count,
       jsonb_array_length(s.eligibility_items)::int as eligibility_count,
       jsonb_array_length(s.application_materials)::int as material_count,
       jsonb_array_length(s.application_steps)::int as step_count,
       jsonb_array_length(s.action_links)::int as action_count,
       count(e.id)::int as evidence_count
     from scholarships s
     left join catalog_source_evidence e on e.entity_type = 'scholarship' and e.entity_id = s.id
     where s.slug = any($1::text[])
     group by s.id, s.slug, s.status, s.verification_status, s.last_verified_at,
       s.body_sections, s.benefit_items, s.eligibility_items, s.application_materials, s.application_steps, s.action_links
     order by s.slug`,
    [slugs],
  );
  assert.equal(rows.length, 20);
  for (const row of rows) {
    assert.equal(row.status, "active", `${row.slug} is not active in PostgreSQL`);
    assert.equal(row.verification_status, "verified", `${row.slug} is not verified in PostgreSQL`);
    assert.equal(new Date(row.last_verified_at).toISOString(), approval.approvedAt);
    for (const field of ["body_count", "benefit_count", "eligibility_count", "material_count", "step_count", "action_count"] as const) {
      assert.ok(row[field] > 0, `${row.slug}.${field} is empty in PostgreSQL`);
    }
    assert.equal(row.evidence_count, 1, `${row.slug} must have exactly one deduplicated source-evidence row`);
  }
} finally {
  await pool.end();
}

const result = {
  version: 1,
  verifiedAt: new Date().toISOString(),
  baseUrl,
  approvedDraftBundleSha256: approval.approvedDraftBundleSha256,
  publicationBundleSha256: approval.publicationBundleSha256,
  publicScholarshipTotal: publicItems.length,
  publishedBatchCount: expectedBySlug.size,
  verifiedBatchCount: 20,
  detailApiCount: 20,
  explicitDeadlineCount,
  removedHistoricalRecordsRestored: false,
  postgresRichFieldChecks: "pass",
  listApiChecks: "pass",
  detailApiChecks: "pass",
};
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
