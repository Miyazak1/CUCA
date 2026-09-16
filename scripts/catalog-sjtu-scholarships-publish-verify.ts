import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.publication-verification.json");
const expectedBySlug = new Map<string, any>(bundle.scholarships.map((item: any) => [item.slug, item]));
assert.equal(expectedBySlug.size, 4);

const listResponse = await fetch(`${baseUrl}/api/v1/catalog/scholarships?limit=100&query=SJTU`);
assert.equal(listResponse.status, 200, "SJTU scholarship list query failed.");
const listPage = await listResponse.json() as { data: any[] };
const publicItems = listPage.data;
assert.equal(publicItems.length, 4, "SJTU scholarship query must return exactly the four approved records.");
const publicBySlug = new Map(publicItems.map(item => [item.slug, item]));
const legacyResponse = await fetch(`${baseUrl}/api/v1/catalog/scholarships/e8d3a5ce-d181-4111-8192-c29960fcb93d`);
assert.equal(legacyResponse.status, 200, "Archived SJTU aggregate lookup failed.");
assert.equal((await legacyResponse.json() as { data: any }).data, null, "Archived SJTU aggregate is still publicly readable.");

for (const [slug, expected] of expectedBySlug) {
  const listItem = publicBySlug.get(slug);
  assert.ok(listItem, `Published SJTU scholarship missing from list: ${slug}`);
  assert.equal(listItem.schoolId, "66f44344-cd62-41f4-98c4-017d5c2e5c46");
  assert.equal(listItem.sourceStatus, "verified");
  assert.equal(listItem.lastVerifiedAt, approval.approvedAt);
  for (const field of ["benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) {
    assert.equal(listItem[field].length, expected[field].length, `${slug}.${field} count mismatch`);
    assert.ok(listItem[field].length > 0, `${slug}.${field} is empty`);
  }
  const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${listItem.id}`);
  assert.equal(response.status, 200, `Scholarship detail failed: ${slug}`);
  const detail = (await response.json() as { data: any }).data;
  assert.equal(detail.slug, slug);
  assert.equal(detail.status, "active");
  assert.equal(detail.verificationStatus, "verified");
  assert.equal(detail.lastVerifiedAt, approval.approvedAt);
  assert.equal(detail.bodySections.length, expected.bodySections.length);
  assert.equal(detail.benefits.length, expected.benefits.length);
  assert.equal(detail.tags.length, expected.tags.length);
  assert.equal(detail.school?.slug, "shanghai-jiao-tong-university");
  assert.deepEqual(detail.sourceFieldLineage, expected.sourceFieldLineage);
}

const schoolResponse = await fetch(`${baseUrl}/api/v1/catalog/schools/66f44344-cd62-41f4-98c4-017d5c2e5c46`);
assert.equal(schoolResponse.status, 200, "SJTU school detail failed.");
const school = (await schoolResponse.json() as { data: any }).data;
assert.equal(school.slug, "shanghai-jiao-tong-university");
assert.equal(school.programCount, 45);
assert.equal(school.scholarshipCount, 4);

const result = {
  version: 1, verifiedAt: new Date().toISOString(), baseUrl,
  publicationBundleSha256: approval.publicationBundleSha256,
  publicSjtuScholarshipCount: publicItems.length, verifiedBatchCount: expectedBySlug.size, detailApiCount: expectedBySlug.size,
  archivedAggregateVisible: false, schoolProgramCount: school.programCount, schoolScholarshipCount: school.scholarshipCount,
  listApiChecks: "pass", detailApiChecks: "pass",
};
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
