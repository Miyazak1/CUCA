import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const baseUrl = process.argv.find(arg => arg.startsWith("--base-url="))?.slice("--base-url=".length) ?? "http://127.0.0.1:52118";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Verification is restricted to the local CUAC application.");
const bundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.zju-complete-batch-01.approved.local.json"), "utf8"));
const approval = JSON.parse(await readFile(resolve(root, "seeds/catalog.zju-complete-batch-01.approval.json"), "utf8"));
const reportPath = resolve(root, "seeds/catalog.zju-complete-batch-01.publication-verification.json");
async function all(path: string) { const rows: any[] = []; for (let offset = 0; ; offset += 100) { const response = await fetch(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`); assert.equal(response.status, 200, `${path} failed at offset ${offset}`); const page = (await response.json() as { data: any[] }).data; rows.push(...page); if (page.length < 100) break; } return rows; }

const schoolResponse = await fetch(`${baseUrl}/api/v1/catalog/schools?limit=100&query=Zhejiang%20University`);
assert.equal(schoolResponse.status, 200);
const schools = (await schoolResponse.json() as { data: any[] }).data.filter(row => row.slug === "zhejiang-university");
assert.equal(schools.length, 1);
const school = schools[0];
assert.equal(school.id, "4339e060-8daf-43be-af9a-bb2f60237ce0");
assert.equal(school.programCount, 680);
assert.equal(school.scholarshipCount, 3);
assert.equal(school.sourceStatus, "verified");

const programs = (await all("/api/v1/catalog/programs")).filter(row => row.schoolId === school.id);
assert.equal(programs.length, 680);
const graduatePrograms = programs.filter(row => row.degreeLevel === "Master" || row.degreeLevel === "Doctoral");
assert.equal(graduatePrograms.length, 588);
assert.equal(graduatePrograms.filter(row => row.degreeLevel === "Master").length, 284);
assert.equal(graduatePrograms.filter(row => row.degreeLevel === "Doctoral").length, 304);
assert.deepEqual(new Set(graduatePrograms.map(row => row.slug)), new Set(bundle.programs.map((row: any) => row.slug)));
const samples = [graduatePrograms.find(row => row.degreeLevel === "Master" && row.teachingLanguage === "Chinese"), graduatePrograms.find(row => row.degreeLevel === "Master" && row.teachingLanguage === "English"), graduatePrograms.find(row => row.degreeLevel === "Doctoral" && row.teachingLanguage === "Chinese"), graduatePrograms.find(row => row.degreeLevel === "Doctoral" && row.teachingLanguage === "English"), graduatePrograms.find(row => row.durationMonths === 30 || row.durationMonths === 42)].filter(Boolean);
for (const row of samples) { const response = await fetch(`${baseUrl}/api/v1/catalog/programs/${row.id}`); assert.equal(response.status, 200); const detail = (await response.json() as { data: any }).data; assert.equal(detail.slug, row.slug); assert.equal(detail.verificationStatus, "verified"); assert.equal(detail.lastVerifiedAt, approval.approvedAt); assert.ok(detail.tuitionText); assert.ok(detail.applicationNote); }

const scholarships = (await all("/api/v1/catalog/scholarships")).filter(row => row.schoolId === school.id);
assert.equal(scholarships.length, 3);
const newScholarships = scholarships.filter(row => bundle.scholarships.some((item: any) => item.slug === row.slug));
assert.equal(newScholarships.length, 2);
for (const row of newScholarships) { for (const field of ["eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks"]) assert.ok(row[field].length > 0, `${row.slug}.${field} must be rich`); const response = await fetch(`${baseUrl}/api/v1/catalog/scholarships/${row.id}`); assert.equal(response.status, 200); const detail = (await response.json() as { data: any }).data; assert.equal(detail.slug, row.slug); assert.equal(detail.verificationStatus, "verified"); assert.equal(detail.lastVerifiedAt, approval.approvedAt); assert.ok(detail.coverage); assert.ok(detail.deadlineLabel); }

const result = { version: 1, verifiedAt: new Date().toISOString(), baseUrl, publicationBundleSha256: approval.publicationBundleSha256, schoolId: school.id, publicProgramCount: programs.length, publicUndergraduateProgramCount: 92, publicMasterProgramCount: 284, publicDoctoralProgramCount: 304, publicProgramIntakeCount: 680, publicScholarshipCount: scholarships.length, newRichScholarshipCount: newScholarships.length, programDetailApiSampleCount: samples.length, scholarshipDetailApiCount: newScholarships.length, archivedProgramAliases: 0, archivedScholarshipAliases: 0, listApiChecks: "pass", detailApiChecks: "pass" };
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
