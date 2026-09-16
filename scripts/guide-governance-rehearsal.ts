import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgresGuideGovernance } from "../src/server/catalog/postgres-guide-governance.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";
import { LOCAL_STATE_RELATIVE_PATH, assertLocalDevelopmentState, localDatabaseUrl, localSyntheticAccounts } from "./lib/local-development.ts";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const state = JSON.parse(await readFile(resolve(projectDir, LOCAL_STATE_RELATIVE_PATH), "utf8")) as unknown;
assertLocalDevelopmentState(state);
const accounts = localSyntheticAccounts(state);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), ssl: false, applicationName: "cuac:guide-governance-rehearsal" });
const client = createTransactionalSqlClient(pool);
const rollback = Symbol("guide rehearsal rollback");
let report: Record<string, unknown> = {};

try {
  await client.transaction(async tx => {
    const guide = (await tx.query<{ id: string; version: number }>("select id, version from public_guides where slug = 'visa-arrival' and status = 'published'", []))[0];
    const actors = await tx.query<{ id: string; emailNormalized: string }>("select id, email_normalized as \"emailNormalized\" from users where email_normalized = any($1::text[])", [[accounts.ops.email, accounts.admin.email]]);
    const opsId = actors.find(actor => actor.emailNormalized === accounts.ops.email)?.id;
    const adminId = actors.find(actor => actor.emailNormalized === accounts.admin.email)?.id;
    if (!guide || !opsId || !adminId) throw new Error("Local guide or independent staff actors are missing.");
    const service = new PostgresGuideGovernance(tx), versionId = randomUUID();
    const ops = createRequestContext({ actorUserId: opsId, activeRole: "cuac_ops", selectedSurface: "ops", purpose: "catalog_management", authStrength: "session" });
    const admin = createRequestContext({ actorUserId: adminId, activeRole: "cuac_admin", selectedSurface: "ops", purpose: "catalog_management", authStrength: "step_up" });
    const document = {
      schemaVersion: 1, slug: "visa-arrival", titleEn: "Visa and Arrival Steps", titleZh: "签证与抵达步骤",
      subtitleEn: "Admission notice, JW form, X visa, and registration", subtitleZh: "录取通知、JW 表、X 签证与报到",
      summaryEn: "Review the typical post-offer sequence and confirm current embassy, university, health-check, and residence-permit requirements.",
      summaryZh: "查看录取后的典型流程，并确认当前使领馆、学校、体检和居留许可要求。", href: "guides.html#visa",
      searchTerms: ["JW201", "JW202", "X1", "X2", "residence permit", "签证", "入境", "居留许可"],
      sections: [{ key: "visa", headingEn: "Confirm the current visa route", headingZh: "确认当前签证路径",
        bodyEn: "Use the current embassy and university notices before acting.", bodyZh: "办理前请核对当前使领馆与学校通知。" }],
      sources: [{ url: "https://en.nia.gov.cn/n147418/n147463/index.html", label: "National Immigration Administration",
        capturedAt: "2026-09-01T00:00:00.000Z" }],
    };
    const draft = await service.createDraft(ops, guide.id, { versionId, document });
    const reviewDueAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const approved = await service.approve(admin, guide.id, { versionId, expectedContentSha256: draft.contentSha256, effectiveFrom: null,
      reviewDueAt, reviewReference: "LOCAL-GUIDE-REHEARSAL", contentReviewed: true, sourcesVerified: true, publicContentConfirmed: true });
    const before = await service.listVersions(admin, guide.id, { limit: 5 });
    const published = await service.publish(admin, guide.id, { versionId, expectedContentSha256: draft.contentSha256,
      expectedApprovalSha256: approved.approvalSha256, expectedPublicationRevision: before.publication?.revision ?? 0 });
    const projection = (await tx.query<{ version: number; status: string }>("select version, status from public_guides where id = $1", [guide.id]))[0];
    report = { guideId: guide.id, draftVersion: draft.version, draftStatus: draft.status, approvedStatus: approved.status,
      independentActors: draft.preparedByUserId !== approved.review?.reviewedByUserId, publicationRevision: published.revision,
      projectedVersion: projection.version, projectedStatus: projection.status, rolledBack: true };
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await pool.end();
}

console.log(JSON.stringify(report, null, 2));
