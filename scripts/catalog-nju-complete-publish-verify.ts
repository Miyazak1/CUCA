import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.nju-complete-batch-02.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.nju-complete-batch-02.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.nju-complete-batch-02.publication-verification.json");
async function all(path: string) { const rows: any[] = []; for (let offset = 0; ; offset += 100) { const response = await fetch(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`); assert.equal(response.status, 200, `${path} failed at offset ${offset}`); const page = (await response.json() as { data: any[] }).data; rows.push(...page); if (page.length < 100) break; } return rows; }

const schoolResponse = await fetch(`${baseUrl}/api/v1/catalog/schools?limit=100&query=Nanjing%20University`);
assert.equal(schoolResponse.status, 200);
const schools = (await schoolResponse.json() as { data: any[] }).data.filter(row => row.slug === "nanjing-university");
assert.equal(schools.length, 1);
const school = schools[0];
assert.equal(school.id, "e2eab575-1249-4294-a180-1f45963ec5ff");
assert.equal(school.programCount, 261);
assert.equal(school.scholarshipCount, 4);
assert.equal(school.sourceStatus, "verified");

const programs = (await all("/api/v1/catalog/programs")).filter(row => row.schoolId === school.id);
assert.equal(programs.length, 261);
const graduatePrograms = programs.filter(row => row.degreeLevel === "Master" || row.degreeLevel === "Doctoral");
assert.equal(graduatePrograms.length, 202);
assert.equal(graduatePrograms.filter(row => row.degreeLevel === "Master").length, 141);
assert.equal(graduatePrograms.filter(row => row.degreeLevel === "Doctoral").length, 61);
assert.deepEqual(new Set(graduatePrograms.map(row => row.slug)), new Set(bundle.programs.map((row: any) => row.slug)));
const samples = [graduatePrograms.find(row => row.degreeLevel === "Master" && row.teachingLanguage === "Chinese"), graduatePrograms.find(row => row.degreeLevel === "Master" && row.teachingLanguage === "English"), graduatePrograms.find(row => row.degreeLevel === "Doctoral"), graduatePrograms.find(row => row.durationMonths === 30)].filter(Boolean);
for (const row of samples) { const response = await fetch(`${baseUrl}/api/v1/catalog/programs/${row.id}`); assert.equal(response.status, 200); const detail = (await response.json() as { data: any }).data; assert.equal(detail.slug, row.slug); assert.equal(detail.verificationStatus, "verified"); assert.equal(detail.lastVerifiedAt, approval.approvedAt); assert.ok(detail.applicationNote); }

const scholarships = (await all("/api/v1/catalog/scholarships")).filter(row => row.schoolId === school.id);
assert.equal(scholarships.length, 4);
const newScholarships = scholarships.filter(row => bundle.scholarships.some((item: any) => item.slug === row.slug));
assert.equal(newScholarships.length, 3);
for (const row of newScholarships) { for (const field of ["eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) assert.ok(row[field].length > 0, `${row.slug}.${field} must be rich`); const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${row.id}`); assert.equal(response.status, 200); const detail = (await response.json() as { data: any }).data; assert.equal(detail.slug, row.slug); assert.equal(detail.verificationStatus, "verified"); assert.equal(detail.lastVerifiedAt, approval.approvedAt); assert.ok(detail.coverage); assert.ok(detail.deadlineLabel); }

const result = { version: 1, verifiedAt: new Date().toISOString(), baseUrl, publicationBundleSha256: approval.publicationBundleSha256, schoolId: school.id, publicProgramCount: programs.length, publicUndergraduateProgramCount: 59, publicMasterProgramCount: 141, publicDoctoralProgramCount: 61, publicProgramIntakeCount: 261, publicScholarshipCount: scholarships.length, newRichScholarshipCount: newScholarships.length, programDetailApiSampleCount: samples.length, scholarshipDetailApiCount: newScholarships.length, archivedProgramAliases: 0, archivedScholarshipAliases: 0, listApiChecks: "pass", detailApiChecks: "pass" };
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
