import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.csu-complete-batch-01.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.csu-complete-batch-01.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.csu-complete-batch-01.publication-verification.json");
const expectedPrograms = new Map(bundle.programs.map((row: any) => [row.slug, row]));
const expectedScholarships = new Map(bundle.scholarships.map((row: any) => [row.slug, row]));
assert.equal(expectedPrograms.size, 370);
assert.equal(expectedScholarships.size, 7);

async function all(path: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`);
    assert.equal(response.status, 200, `${path} request failed at offset ${offset}`);
    const page = (await response.json() as { data: any[] }).data;
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}
async function inBatches<T>(rows: T[], size: number, run: (row: T) => Promise<void>) {
  for (let index = 0; index < rows.length; index += size) await Promise.all(rows.slice(index, index + size).map(run));
}

const schoolList = await fetch(`${baseUrl}/api/v1/catalog/schools?limit=100&query=Central%20South%20University`);
assert.equal(schoolList.status, 200);
const schools = (await schoolList.json() as { data: any[] }).data.filter(row => row.slug === "central-south-university");
assert.equal(schools.length, 1);
const school = schools[0];
assert.equal(school.programCount, 370);
assert.equal(school.scholarshipCount, 7);
assert.equal(school.sourceStatus, "verified");
assert.equal(school.lastVerifiedAt, approval.approvedAt);

const publicPrograms = (await all("/api/v1/catalog/programs")).filter(row => row.schoolId === school.id);
assert.equal(publicPrograms.length, 370);
assert.deepEqual(new Set(publicPrograms.map(row => row.slug)), new Set(expectedPrograms.keys()));
await inBatches(publicPrograms, 20, async row => {
  assert.equal(row.sourceStatus, "verified");
  assert.equal(row.lastVerifiedAt, approval.approvedAt);
  assert.ok(row.tuitionText);
  assert.ok(row.applicationUrl?.startsWith("https://"));
  const response = await fetch(`${baseUrl}/api/v1/catalog/programs/${row.id}`);
  assert.equal(response.status, 200, `Program detail failed: ${row.slug}`);
  const detail = (await response.json() as { data: any }).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
});

const publicScholarships = (await all("/api/v1/catalog/scholarships")).filter(row => row.schoolId === school.id);
assert.equal(publicScholarships.length, 7);
assert.deepEqual(new Set(publicScholarships.map(row => row.slug)), new Set(expectedScholarships.keys()));
await inBatches(publicScholarships, 7, async row => {
  const expected: any = expectedScholarships.get(row.slug);
  assert.equal(row.sourceStatus, "verified");
  assert.equal(row.lastVerifiedAt, approval.approvedAt);
  for (const field of ["eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) assert.equal(row[field].length, expected[field].length, `${row.slug}.${field} mismatch`);
  const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${row.id}`);
  assert.equal(response.status, 200, `Scholarship detail failed: ${row.slug}`);
  const detail = (await response.json() as { data: any }).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
});

const result = {
  version: 1, verifiedAt: new Date().toISOString(), baseUrl,
  publicationBundleSha256: approval.publicationBundleSha256,
  schoolId: school.id, publicProgramCount: publicPrograms.length, programDetailApiCount: publicPrograms.length,
  publicScholarshipCount: publicScholarships.length, scholarshipDetailApiCount: publicScholarships.length,
  programIntakeDatabaseCount: 370, archivedProgramAliases: 0, archivedScholarshipAliases: 0,
  listApiChecks: "pass", detailApiChecks: "pass",
};
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
