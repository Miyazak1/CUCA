import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresRequirementGovernance } from "../../../src/server/catalog/postgres-requirement-governance.ts";
import { requirementFixture } from "./requirements-fixture.mjs";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";

export async function governanceFixture(pool) {
  const f = await requirementFixture(pool);
  const other = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`reviewer-${randomUUID()}@example.invalid`])).rows[0];
  for (const [userId, role] of [[f.preparerId, "cuac_ops"], [f.reviewerId, "cuac_admin"], [other.id, "cuac_admin"]]) {
    await pool.query("insert into user_roles (user_id, role) values ($1, $2)", [userId, role]);
  }
  const context = (id, role) => createRequestContext({ actorUserId: id, activeRole: role, selectedSurface: "ops",
    purpose: "catalog_management", authStrength: role === "cuac_admin" ? "step_up" : "session" });
  return { ...f, preparer: context(f.preparerId, "cuac_ops"), reviewer: context(f.reviewerId, "cuac_admin"), otherReviewer: context(other.id, "cuac_admin"),
    service: new PostgresRequirementGovernance(createTransactionalSqlClient(pool)) };
}

export function approveInput(version, extra = {}) {
  return { versionId: version.versionId, expectedContentSha256: version.contentSha256, effectiveFrom: null,
    reviewDueAt: new Date(Date.now() + 86_400_000).toISOString(), scopeConfirmed: true, publicContentConfirmed: true,
    sourceChecks: version.document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256, officialSourceConfirmed: true })), ...extra };
}

export function publishInput(version, revision = 0) {
  return { versionId: version.versionId, expectedContentSha256: version.contentSha256, expectedApprovalSha256: version.approvalSha256, expectedPublicationRevision: revision };
}

export async function preparedRequirement(f, id = randomUUID(), document = requirementDocument(), service = f.service) {
  return service.createDraft(f.preparer, f.programId, f.intakeId, { versionId: id, document });
}

export async function approvedRequirement(f, extra = {}) {
  const draft = await preparedRequirement(f);
  return f.service.approve(f.reviewer, f.programId, f.intakeId, approveInput(draft, extra));
}
