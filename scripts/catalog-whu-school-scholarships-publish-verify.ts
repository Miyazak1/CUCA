import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.publication-verification.json");
const expected = new Map(bundle.scholarships.map((row: any) => [row.slug, row]));
assert.equal(expected.size, 6);

async function all(path: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${baseUrl}${path}?limit=100&offset=${offset}`);
    assert.equal(response.status, 200, `${path} request failed at offset ${offset}`);
    const page = (await response.json() as { data: any[] }).data;
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}

const schoolResponse = await fetch(`${baseUrl}/api/v1/catalog/schools?limit=100&query=Wuhan%20University`);
assert.equal(schoolResponse.status, 200);
const schools = (await schoolResponse.json() as { data: any[] }).data.filter(row => row.slug === "wuhan-university");
assert.equal(schools.length, 1);
const school = schools[0];
assert.equal(school.programCount, 0);
assert.equal(school.scholarshipCount, 6);
assert.equal(school.sourceStatus, "verified");
assert.equal(school.lastVerifiedAt, approval.approvedAt);

const scholarships = (await all("/api/v1/catalog/scholarships")).filter(row => row.schoolId === school.id);
assert.equal(scholarships.length, 6);
assert.deepEqual(new Set(scholarships.map(row => row.slug)), new Set(expected.keys()));
for (const row of scholarships) {
  const source: any = expected.get(row.slug);
  assert.equal(row.sourceStatus, "verified");
  assert.equal(row.lastVerifiedAt, approval.approvedAt);
  for (const field of ["eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) assert.equal(row[field].length, source[field].length, `${row.slug}.${field} mismatch`);
  const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${row.id}`);
  assert.equal(response.status, 200, `Scholarship detail failed: ${row.slug}`);
  const detail = (await response.json() as { data: any }).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
}

const result = { version: 1, verifiedAt: new Date().toISOString(), baseUrl, publicationBundleSha256: approval.publicationBundleSha256, schoolId: school.id, publicProgramCount: 0, publicScholarshipCount: scholarships.length, scholarshipDetailApiCount: scholarships.length, archivedProgramAliases: 0, archivedScholarshipAliases: 0, listApiChecks: "pass", detailApiChecks: "pass" };
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
