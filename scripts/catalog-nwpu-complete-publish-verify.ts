import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ApiRow = {
  id: string; slug: string; schoolId: string; programCount: number; scholarshipCount: number;
  sourceStatus: string; lastVerifiedAt: string; tuitionText?: string; applicationUrl?: string;
  verificationStatus: string; benefitItems: string[]; eligibilityItems: string[];
  applicationMaterials: string[]; applicationSteps: string[]; actionLinks: Array<Record<string, unknown>>;
};
type ApiResponse<T> = { data: T };
type Scholarship = NonNullable<CatalogSeedBundle["scholarships"]>[number];
type ExpectedScholarship = Scholarship & Required<Pick<Scholarship, "benefitItems" | "eligibilityItems" | "applicationMaterials" | "applicationSteps" | "actionLinks">>;

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.nwpu-complete-batch-01.approved.local.json"), "utf8")) as CatalogSeedBundle;
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.nwpu-complete-batch-01.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.nwpu-complete-batch-01.publication-verification.json");
const expectedPrograms = new Map((bundle.programs ?? []).map((row) => [row.slug, row]));
const expectedScholarships = new Map((bundle.scholarships ?? []).map((row) => [row.slug, row as ExpectedScholarship]));
assert.equal(expectedPrograms.size, 96);
assert.equal(expectedScholarships.size, 4);

const schoolList = await fetch(`${baseUrl}/api/v1/catalog/schools?limit=100&query=Northwestern%20Polytechnical`);
assert.equal(schoolList.status, 200);
const schools = (await schoolList.json() as ApiResponse<ApiRow[]>).data;
assert.equal(schools.length, 1);
const school = schools[0];
assert.equal(school.slug, "northwestern-polytechnical-university");
assert.equal(school.programCount, 96);
assert.equal(school.scholarshipCount, 4);
assert.equal(school.sourceStatus, "verified");
assert.equal(school.lastVerifiedAt, approval.approvedAt);

async function all(path: string) {
  const rows: ApiRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`);
    assert.equal(response.status, 200, `${path} request failed at offset ${offset}`);
    const page = (await response.json() as ApiResponse<ApiRow[]>).data;
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}
const publicPrograms = (await all("/api/v1/catalog/programs")).filter(row => row.schoolId === school.id);
assert.equal(publicPrograms.length, 96);
assert.deepEqual(new Set(publicPrograms.map(row => row.slug)), new Set(expectedPrograms.keys()));
for (const row of publicPrograms) {
  assert.equal(row.sourceStatus, "verified");
  assert.equal(row.lastVerifiedAt, approval.approvedAt);
  assert.ok(row.tuitionText);
  assert.ok(row.applicationUrl?.startsWith("https://"));
  const detailResponse = await fetch(`${baseUrl}/api/v1/catalog/programs/${row.id}`);
  assert.equal(detailResponse.status, 200, `Program detail failed: ${row.slug}`);
  const detail = (await detailResponse.json() as ApiResponse<ApiRow>).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
}
const publicScholarships = (await all("/api/v1/catalog/scholarships")).filter(row => row.schoolId === school.id);
assert.equal(publicScholarships.length, 4);
assert.deepEqual(new Set(publicScholarships.map(row => row.slug)), new Set(expectedScholarships.keys()));
for (const row of publicScholarships) {
  const expected = expectedScholarships.get(row.slug);
  assert.ok(expected);
  assert.equal(row.sourceStatus, "verified");
  assert.equal(row.lastVerifiedAt, approval.approvedAt);
  for (const field of ["benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"] as const) assert.equal(row[field].length, expected[field].length, `${row.slug}.${field} mismatch`);
  const detailResponse = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${row.id}`);
  assert.equal(detailResponse.status, 200, `Scholarship detail failed: ${row.slug}`);
  const detail = (await detailResponse.json() as ApiResponse<ApiRow>).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
}
const result = { version: 1, verifiedAt: new Date().toISOString(), baseUrl, publicationBundleSha256: approval.publicationBundleSha256, schoolId: school.id, publicProgramCount: publicPrograms.length, programDetailApiCount: publicPrograms.length, publicScholarshipCount: publicScholarships.length, scholarshipDetailApiCount: publicScholarships.length, archivedProgramAliasesVisible: false, archivedScholarshipOverviewVisible: false, listApiChecks: "pass", detailApiChecks: "pass" };
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
