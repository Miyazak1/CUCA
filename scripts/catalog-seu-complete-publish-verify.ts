import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.seu-complete-batch-02.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.seu-complete-batch-02.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.seu-complete-batch-02.publication-verification.json");

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

const schoolResponse = await fetch(`${baseUrl}/api/v1/catalog/schools?limit=100&query=Southeast%20University`);
assert.equal(schoolResponse.status, 200);
const schools = (await schoolResponse.json() as { data: any[] }).data.filter(row => row.slug === "southeast-university");
assert.equal(schools.length, 1);
const school = schools[0];
assert.equal(school.programCount, 232);
assert.equal(school.scholarshipCount, 3);
assert.equal(school.sourceStatus, "verified");
assert.equal(school.lastVerifiedAt, approval.approvedAt);

const programs = (await all("/api/v1/catalog/programs")).filter(row => row.schoolId === school.id);
assert.equal(programs.length, 232);
assert.deepEqual(new Set(programs.map(row => row.slug)), new Set(bundle.programs.map((row: any) => row.slug)));
const samples = [
  programs.find(row => row.degreeLevel === "Undergraduate" && row.teachingLanguage === "Chinese"),
  programs.find(row => row.degreeLevel === "Undergraduate" && row.teachingLanguage === "English"),
  programs.find(row => row.degreeLevel === "Master" && row.teachingLanguage === "Chinese"),
  programs.find(row => row.degreeLevel === "Master" && row.teachingLanguage === "English"),
  programs.find(row => row.degreeLevel === "Doctoral"),
  programs.find(row => row.slug.includes("digital-and-intelligent-management")),
  programs.find(row => row.slug.includes("sustainable-infrastructure")),
].filter(Boolean);
for (const row of samples) {
  const response = await fetch(`${baseUrl}/api/v1/catalog/programs/${row.id}`);
  assert.equal(response.status, 200, `Program detail failed: ${row.slug}`);
  const detail = (await response.json() as { data: any }).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
}

const scholarships = (await all("/api/v1/catalog/scholarships")).filter(row => row.schoolId === school.id);
assert.equal(scholarships.length, 3);
assert.deepEqual(new Set(scholarships.map(row => row.slug)), new Set(bundle.scholarships.map((row: any) => row.slug)));
for (const row of scholarships) {
  for (const field of ["eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) assert.ok(row[field].length > 0, `${row.slug}.${field} must be rich`);
  const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${row.id}`);
  assert.equal(response.status, 200, `Scholarship detail failed: ${row.slug}`);
  const detail = (await response.json() as { data: any }).data;
  assert.equal(detail.slug, row.slug);
  assert.equal(detail.verificationStatus, "verified");
}

const result = { version: 1, verifiedAt: new Date().toISOString(), baseUrl, publicationBundleSha256: approval.publicationBundleSha256, schoolId: school.id, publicProgramCount: programs.length, publicScholarshipCount: scholarships.length, programDetailApiSampleCount: samples.length, scholarshipDetailApiCount: scholarships.length, archivedProgramAliases: 0, archivedScholarshipAliases: 0, listApiChecks: "pass", detailApiChecks: "pass" };
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
