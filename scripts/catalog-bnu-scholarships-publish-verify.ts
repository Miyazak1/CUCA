import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.bnu-scholarships-batch-01.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.bnu-scholarships-batch-01.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.bnu-scholarships-batch-01.publication-verification.json");
const expectedBySlug = new Map<string, any>(bundle.scholarships.map((item: any) => [item.slug, item]));
assert.equal(expectedBySlug.size, 6);

const publicItems: any[] = [];
for (let offset = 0; offset < 2000; offset += 100) {
  const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships?limit=100&offset=${offset}`);
  assert.equal(response.status, 200, `Scholarship list failed at offset ${offset}`);
  const page = await response.json() as { data: any[] };
  assert.ok(Array.isArray(page.data));
  publicItems.push(...page.data);
  if (page.data.length < 100) break;
}
assert.equal(new Set(publicItems.map(item => item.slug)).size, publicItems.length, "Pagination returned duplicate scholarship records.");
const publicBySlug = new Map(publicItems.map(item => [item.slug, item]));
assert.equal(publicBySlug.has("official-2026-bnu-undergraduate-scholarship-options"), false, "Archived BNU aggregate is still public.");

for (const [slug, expected] of expectedBySlug) {
  const listItem = publicBySlug.get(slug);
  assert.ok(listItem, `Published BNU scholarship missing from list: ${slug}`);
  assert.equal(listItem.schoolId, "f72de919-b281-4835-b9dd-db93a80c3963");
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
  assert.equal(detail.school?.slug, "beijing-normal-university");
  assert.deepEqual(detail.sourceFieldLineage, expected.sourceFieldLineage);
}

const schoolResponse = await fetch(`${baseUrl}/api/v1/catalog/schools/f72de919-b281-4835-b9dd-db93a80c3963`);
assert.equal(schoolResponse.status, 200, "BNU school detail failed.");
const school = (await schoolResponse.json() as { data: any }).data;
assert.equal(school.slug, "beijing-normal-university");
assert.equal(school.programCount, 33);
assert.equal(school.scholarshipCount, 6);

const result = {
  version: 1,
  verifiedAt: new Date().toISOString(),
  baseUrl,
  publicationBundleSha256: approval.publicationBundleSha256,
  publicScholarshipTotal: publicItems.length,
  verifiedBatchCount: expectedBySlug.size,
  detailApiCount: expectedBySlug.size,
  archivedAggregateVisible: false,
  schoolProgramCount: school.programCount,
  schoolScholarshipCount: school.scholarshipCount,
  listApiChecks: "pass",
  detailApiChecks: "pass",
};
const content = `${JSON.stringify(result, null, 2)}\n`;
try {
  await writeFile(reportPath, content, { encoding: "utf8", flag: "wx" });
} catch (error: any) {
  if (error?.code !== "EEXIST") throw error;
  const existing = JSON.parse(await readFile(reportPath, "utf8"));
  if (existing.publicationBundleSha256 !== result.publicationBundleSha256) throw new Error("Existing verification report belongs to another publication bundle.");
}
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
