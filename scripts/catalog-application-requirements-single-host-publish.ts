import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PostgresRequirementGovernance } from "../src/server/catalog/postgres-requirement-governance.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";
import { validateRequirementReleaseCandidate } from "./lib/catalog-requirement-candidate-runtime.ts";
import { assertSingleHostRequirementPublishTarget, validateRequirementReviewRecord } from "./lib/catalog-requirement-single-host-publish.ts";

const root = process.cwd();
const candidatePath = resolve(root, process.argv[2] || "seeds/application-requirements-release-candidate.unreviewed.json");
const reviewPath = resolve(root, process.argv[3] || "seeds/application-requirements-release-candidate.review.json");

type ResolvedOperation = {
  operationKey: string;
  programId: string;
  intakeId: string;
  versionIdentity: string;
  templateKey: string;
  contentSha256: string;
};

try {
  const target = assertSingleHostRequirementPublishTarget(process.env);
  const [candidateBytes, reviewBytes] = await Promise.all([readFile(candidatePath), readFile(reviewPath)]);
  const candidate = validateRequirementReleaseCandidate(JSON.parse(candidateBytes.toString("utf8")));
  const review = validateRequirementReviewRecord(JSON.parse(reviewBytes.toString("utf8")), candidate, candidateBytes);
  if (review.reviewReference !== target.reviewReference) throw new Error("The command review reference does not match the reviewed candidate.");

  const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 6, applicationName: "cuac:reviewed-requirement-publish", statementTimeoutMillis: 120_000 });
  try {
    const accounts = await pool.query(`select u.id,u.email_normalized,
        bool_or(ur.role='cuac_ops' and ur.revoked_at is null) has_ops,
        bool_or(ur.role='cuac_admin' and ur.revoked_at is null) has_admin
      from users u join user_roles ur on ur.user_id=u.id
      where u.account_status='active' and u.email_normalized=any($1::text[])
      group by u.id,u.email_normalized`, [[target.preparerEmail, target.reviewerEmail]]);
    const preparer = accounts.rows.find(row => row.email_normalized === target.preparerEmail);
    const reviewer = accounts.rows.find(row => row.email_normalized === target.reviewerEmail);
    if (!preparer || (!preparer.has_ops && !preparer.has_admin)) throw new Error("The preparer account lacks an active CUAC Ops/Admin role.");
    if (!reviewer?.has_admin) throw new Error("The reviewer account lacks an active CUAC Admin role.");
    if (preparer.id === reviewer.id) throw new Error("The reviewer must be different from the preparer.");

    const operationPayload = candidate.operations.map(operation => ({
      operation_key: operation.operationKey, school_slug: operation.schoolSlug, program_slug: operation.programSlug,
      intake_term: operation.intakeTerm, intake_year: operation.intakeYear, version_identity: operation.versionIdentity,
      template_key: operation.templateKey, content_sha256: operation.documentSha256,
    }));
    const resolved = await pool.query<ResolvedOperation>(`select x.operation_key as "operationKey",p.id as "programId",i.id as "intakeId",
        x.version_identity as "versionIdentity",x.template_key as "templateKey",x.content_sha256 as "contentSha256"
      from jsonb_to_recordset($1::jsonb) x(operation_key text,school_slug text,program_slug text,intake_term text,intake_year integer,
        version_identity uuid,template_key text,content_sha256 text)
      join schools s on s.slug=x.school_slug and s.status='active'
      join programs p on p.slug=x.program_slug and p.school_id=s.id and p.status='active'
      join program_intakes i on i.program_id=p.id and i.intake_term=x.intake_term and i.intake_year=x.intake_year
      where i.status='open' and (i.deadline_date is null or i.deadline_date>clock_timestamp())
        and (i.open_date is null or i.deadline_date is null or i.open_date<i.deadline_date)
      order by x.operation_key`, [JSON.stringify(operationPayload)]);
    const templates = new Map(candidate.templates.map(template => [template.templateKey, template.document]));
    const preparerContext = createRequestContext({ actorUserId: preparer.id, activeRole: preparer.has_ops ? "cuac_ops" : "cuac_admin",
      selectedSurface: "ops", purpose: "catalog_management", authStrength: preparer.has_ops ? "session" : "step_up" });
    const reviewerContext = createRequestContext({ actorUserId: reviewer.id, activeRole: "cuac_admin", selectedSurface: "ops",
      purpose: "catalog_management", authStrength: "step_up" });
    const service = new PostgresRequirementGovernance(createTransactionalSqlClient(pool));
    const counts = { requested: candidate.operations.length, resolvableAndOpen: resolved.rows.length,
      leftEmpty: candidate.operations.length - resolved.rows.length, prepared: 0, approved: 0, published: 0, alreadyPublished: 0 };

    for (let index = 0; index < resolved.rows.length; index += 1) {
      const operation = resolved.rows[index];
      const document = templates.get(operation.templateKey);
      if (!document) throw new Error(`Missing reviewed template: ${operation.templateKey}`);
      let version = await service.createDraft(preparerContext, operation.programId, operation.intakeId,
        { versionId: operation.versionIdentity, document });
      if (version.governanceStatus === "draft") counts.prepared += 1;
      if (version.governanceStatus === "draft") {
        version = await service.approve(reviewerContext, operation.programId, operation.intakeId, {
          versionId: version.versionId, expectedContentSha256: operation.contentSha256, effectiveFrom: null,
          reviewDueAt: review.reviewDueAt, scopeConfirmed: true, publicContentConfirmed: true,
          sourceChecks: version.document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256, officialSourceConfirmed: true })),
        });
        counts.approved += 1;
      }
      const state = await service.listVersions(reviewerContext, operation.programId, operation.intakeId, { limit: 1 });
      if (state.publication?.status === "active" && state.publication.versionId === version.versionId) {
        counts.alreadyPublished += 1;
      } else {
        await service.publish(reviewerContext, operation.programId, operation.intakeId, {
          versionId: version.versionId, expectedContentSha256: version.contentSha256,
          expectedApprovalSha256: version.approvalSha256, expectedPublicationRevision: state.publication?.revision ?? 0,
        });
        counts.published += 1;
      }
      if ((index + 1) % 250 === 0) console.error(`Published ${index + 1}/${resolved.rows.length} reviewed requirement bindings.`);
    }

    console.log(JSON.stringify({ ok: true, target: { kind: "single_host_loopback", databaseName: "cuac_local" },
      reviewReference: review.reviewReference, candidate: candidate.hashes, counts }, null, 2));
  } finally {
    await pool.end();
  }
} catch (error) {
  const message = error instanceof Error && !/postgres|database|connect|socket|password|host/i.test(error.message)
    ? error.message
    : "Reviewed requirement publication failed; inspect protected container logs and database health.";
  console.error(message);
  process.exitCode = 1;
}
