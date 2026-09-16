import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedHash = required("review-hash"), reviewReference = required("review"), approvedAt = required("approved-at");
if (!/^[a-f0-9]{64}$/.test(approvedHash) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid approval parameters.");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const prefix = "catalog.ahu-program-encoding-cleanup";
const review = JSON.parse(await readFile(`seeds/${prefix}.review.json`, "utf8"));
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const { reviewHash, requiredApproval, ...reviewBase } = review;
if (reviewHash !== approvedHash || sha(JSON.stringify(reviewBase)) !== approvedHash || requiredApproval !== reviewReference || review.status !== "requires_explicit_approval" || review.scope.programOverwriteCount !== 5 || review.scope.archiveCount !== 0 || review.scope.deleteCount !== 0 || review.reconciliation.destructiveDeletion !== false) throw new Error("Approved AHU correction review does not match the stored operation.");

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ahu-program-encoding-cleanup-publish" });
let result: any;
try {
  const client = createTransactionalSqlClient(pool);
  result = await client.transaction(async (tx) => {
    const baseline = review.reconciliation.baseline;
    const school = await tx.query<any>("select id,status from schools where slug='anhui-university'", []);
    if (school.length !== 1 || school[0].id !== baseline.school.id || school[0].status !== "active") throw new Error("AHU school baseline changed.");
    const expectedIds = new Map(baseline.programs.map((row: any) => [row.slug, row.id]));
    for (const correction of review.reconciliation.corrections) {
      const id = expectedIds.get(correction.oldSlug);
      if (!id) throw new Error(`Missing reviewed program ID: ${correction.oldSlug}`);
      const current = await tx.query<any>("select id,slug,status,verification_status from programs where id=$1", [id]);
      if (current.length !== 1 || current[0].status !== "active" || current[0].verification_status !== "verified" || ![correction.oldSlug, correction.newSlug].includes(current[0].slug)) throw new Error(`AHU program baseline changed: ${correction.oldSlug}`);
      const conflict = await tx.query<any>("select id from programs where slug=$1 and id<>$2", [correction.newSlug, id]);
      if (conflict.length) throw new Error(`AHU target slug conflict: ${correction.newSlug}`);
      await tx.query("update programs set slug=$2,name_en=$3,name_zh=$4,field_category=$5,subject_area=$6,updated_at=now() where id=$1", [id, correction.newSlug, correction.nameEn, correction.nameZh, correction.fieldCategory, correction.subjectArea]);
    }
    const ids = [...expectedIds.values()];
    const corrected = await tx.query<any>("select id,slug,name_en,name_zh,field_category,subject_area,status,verification_status from programs where id=any($1::uuid[]) order by slug", [ids]);
    const cidCount = await tx.query<any>("select count(*)::text count from programs where school_id=$1 and status='active' and (slug like '%cid-%' or coalesce(name_en,'') like '%(cid:%' or coalesce(name_zh,'') like '%(cid:%' or coalesce(field_category,'') like '%(cid:%' or coalesce(subject_area,'') like '%(cid:%')", [school[0].id]);
    if (corrected.length !== 5 || corrected.some((row: any) => row.status !== "active" || row.verification_status !== "verified" || row.field_category !== "Artificial Intelligence") || cidCount[0]?.count !== "0") throw new Error(`AHU correction post-check failed: ${JSON.stringify({ corrected, cidCount: cidCount[0] })}`);
    return { correctedProgramCount: corrected.length, remainingCidArtifacts: cidCount[0].count, programSlugs: corrected.map((row: any) => row.slug) };
  });
} finally { await pool.end(); }
const approval = { version: 1, approvedAt, reviewReference, approvedReviewSha256: approvedHash, operation: "ahu-program-encoding-cleanup", physicalDeletion: false, result, prohibitedDataConfirmedExcluded: true };
await writeFile(`seeds/${prefix}.approval.json`, `${JSON.stringify(approval, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, ...result }, null, 2));
