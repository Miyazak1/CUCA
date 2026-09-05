import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresNoticeGovernance } from "../../../src/server/notices/postgres-governance.ts";
import { PostgresNoticeReader } from "../../../src/server/notices/public-reader.ts";
import { noticeDocument } from "../notices/fixture.mjs";

// Only the validated disposable rehearsal invokes this fixture; no production content is seeded.
export async function noticeFixture(pool, reset = true) {
  if (reset) for (const table of ["privacy_notice_publications", "privacy_notice_versions", "privacy_notice_scopes"]) await pool.query(`delete from ${table}`);
  const identities = [];
  for (const role of ["cuac_ops", "cuac_admin", "cuac_admin"]) {
    const id = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`notice-${randomUUID()}@example.invalid`])).rows[0].id;
    await pool.query("insert into user_roles (user_id, role) values ($1, $2)", [id, role]);
    identities.push(createRequestContext({ actorUserId: id, activeRole: role, selectedSurface: "ops", purpose: "notice_management", authStrength: role === "cuac_admin" ? "step_up" : "session" }));
  }
  const client = createTransactionalSqlClient(pool), reader = new PostgresNoticeReader(client);
  const publicContext = createRequestContext({ purpose: "public_notice_read" });
  return { client, service: new PostgresNoticeGovernance(client), reader, publicContext, preparer: identities[0], reviewer: identities[1], otherReviewer: identities[2],
    key: "application_disclosure", locale: "en", scopeKey: "application_disclosure:en", get: (locale = "en") => reader.getPublished(publicContext, "application_disclosure", locale) };
}

export function noticeApproveInput(version, extra = {}) {
  return { versionId: version.versionId, expectedContentSha256: version.contentSha256, effectiveFrom: null,
    reviewDueAt: new Date(Date.now() + 86400000).toISOString(), reviewReference: "synthetic-review/1", scopeConfirmed: true, wordingReviewed: true, publicContentConfirmed: true, ...extra };
}

export function noticePublishInput(version, revision = 0) {
  return { versionId: version.versionId, expectedContentSha256: version.contentSha256, expectedApprovalSha256: version.approvalSha256, expectedPublicationRevision: revision };
}

export async function preparedNotice(f, id = randomUUID(), document = noticeDocument(f.locale), service = f.service, actor = f.preparer) {
  return service.createDraft(actor, f.key, f.locale, { versionId: id, document });
}

export async function approvedNotice(f, extra = {}) {
  const draft = await preparedNotice(f);
  return f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft, extra));
}

export const publishNotice = (f, version, revision = 0, service = f.service) => service.publish(f.reviewer, f.key, f.locale, noticePublishInput(version, revision));
export const withdrawNotice = (f, id, revision, service = f.service) => service.withdraw(f.reviewer, f.key, f.locale, { expectedVersionId: id, expectedPublicationRevision: revision, reason: "review_required" });
