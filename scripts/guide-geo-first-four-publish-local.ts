import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseGuideDocument, guideDigest, type GuideDocument } from "../src/server/catalog/guide-document.ts";
import { PostgresGuideGovernance } from "../src/server/catalog/postgres-guide-governance.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";
import { assertLocalDevelopmentState, localDatabaseUrl, localSyntheticAccounts,
  LOCAL_STATE_RELATIVE_PATH } from "./lib/local-development.ts";

const CONFIRMATION = "publish-approved-geo-guides-to-cuac-local";
const options = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  if (!argument.startsWith("--") || separator < 0) throw new Error(`Option requires a value: ${argument}`);
  return [argument.slice(2, separator), argument.slice(separator + 1)];
}));
if ([...options.keys()].some((key) => key !== "confirm")) throw new Error("Only --confirm is supported.");
if (options.get("confirm") !== CONFIRMATION) throw new Error(`Use --confirm=${CONFIRMATION}.`);

const root = process.cwd();
const candidatePath = resolve(root, "seeds/guides.geo-first-four.draft.json");
const approvalPath = resolve(root, "seeds/guides.geo-first-four.approval.json");
const statePath = resolve(root, LOCAL_STATE_RELATIVE_PATH);
const candidateBytes = await readFile(candidatePath);
const candidate = JSON.parse(candidateBytes.toString("utf8"));
const approval = JSON.parse(await readFile(approvalPath, "utf8"));
const state = JSON.parse(await readFile(statePath, "utf8"));
assertLocalDevelopmentState(state);

const candidateSha256 = createHash("sha256").update(candidateBytes).digest("hex");
if (approval.candidatePath !== "seeds/guides.geo-first-four.draft.json" || approval.candidateSha256 !== candidateSha256) {
  throw new Error("The product-owner approval does not match the exact guide candidate.");
}
if (approval.reviewReference !== "product-owner-chat-approval-2026-10-09"
  || approval.contentReviewed !== true || approval.sourcesVerified !== true || approval.publicContentConfirmed !== true
  || approval.publicationAuthorized !== true || approval.databaseWriteAuthorized !== true) {
  throw new Error("The guide approval is incomplete or outside the approved review reference.");
}
if (approval.scope?.productionDeploymentAuthorized !== false) throw new Error("Local rehearsal cannot consume a production deployment approval.");
if (candidate.status !== "unreviewed_draft" || candidate.publicationAuthorized !== false || candidate.databaseWriteAuthorized !== false) {
  throw new Error("The immutable guide candidate must remain an unprivileged draft.");
}
const evidencePath = resolve(root, candidate.evidenceManifest?.path || "");
const evidenceBytes = await readFile(evidencePath);
const evidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
const evidence = JSON.parse(evidenceBytes.toString("utf8"));
if (evidenceSha256 !== candidate.evidenceManifest.sha256 || evidence.sources?.length !== candidate.evidenceManifest.sourceCount) {
  throw new Error("The official-source evidence manifest does not match the approved candidate.");
}

const documents = candidate.documents.map(parseGuideDocument) as GuideDocument[];
if (documents.length !== 4 || new Set(documents.map((document) => document.slug)).size !== 4
  || JSON.stringify(documents.map((document) => document.slug)) !== JSON.stringify(approval.scope.documentSlugs)) {
  throw new Error("The approved four-guide scope changed.");
}
const evidenceUrls = new Set(evidence.sources.map((source: { url: string }) => source.url));
if (documents.some((document) => document.sources.some((source) => !evidenceUrls.has(source.url)))) {
  throw new Error("A guide cites a source outside the approved official evidence manifest.");
}

const identities = [
  { guideId: "51000000-0000-4000-8000-000000000001", versionId: "52000000-0000-4000-8000-000000000001", sortOrder: 60 },
  { guideId: "51000000-0000-4000-8000-000000000002", versionId: "52000000-0000-4000-8000-000000000002", sortOrder: 70 },
  { guideId: "51000000-0000-4000-8000-000000000003", versionId: "52000000-0000-4000-8000-000000000003", sortOrder: 80 },
  { guideId: "51000000-0000-4000-8000-000000000004", versionId: "52000000-0000-4000-8000-000000000004", sortOrder: 90 },
] as const;
const reviewDueAt = "2027-10-09T07:21:52.210Z";
const databaseUrl = localDatabaseUrl(state);
const pool = createPostgresPool({ databaseUrl, ssl: false, max: 1, applicationName: "cuac:geo-guides-local-publish" });

try {
  const client = createTransactionalSqlClient(pool);
  const report = await client.transaction(async (tx) => {
    const databaseIdentity = (await tx.query<{ databaseName: string; databaseUser: string }>(
      "select current_database() as \"databaseName\", current_user as \"databaseUser\"", []))[0];
    if (databaseIdentity?.databaseName !== state.databaseName || databaseIdentity.databaseUser !== state.databaseUser) {
      throw new Error("Connected PostgreSQL identity is not the generated CUAC local database.");
    }

    const accounts = localSyntheticAccounts(state);
    const actors = await tx.query<{ id: string; email: string }>(
      `select id::text as id, email_normalized as email from users
       where email_normalized = any($1::text[]) and account_status = 'active'`,
      [[accounts.ops.email, accounts.admin.email]],
    );
    const preparerId = actors.find((actor) => actor.email === accounts.ops.email)?.id;
    const reviewerId = actors.find((actor) => actor.email === accounts.admin.email)?.id;
    if (!preparerId || !reviewerId || preparerId === reviewerId) throw new Error("Independent local Ops and admin actors are required.");
    const preparer = createRequestContext({ actorUserId: preparerId, activeRole: "cuac_ops", selectedSurface: "ops",
      purpose: "catalog_management", authStrength: "session" });
    const reviewer = createRequestContext({ actorUserId: reviewerId, activeRole: "cuac_admin", selectedSurface: "ops",
      purpose: "catalog_management", authStrength: "step_up" });
    const governance = new PostgresGuideGovernance(tx);
    const published = [];

    for (const [index, document] of documents.entries()) {
      const identity = identities[index];
      const existing = await tx.query<{ id: string; slug: string }>(
        "select id::text as id, slug from public_guides where id = $1 or slug = $2 for no key update",
        [identity.guideId, document.slug],
      );
      if (!existing.length) {
        await tx.query(`insert into public_guides
          (id, slug, title_en, title_zh, subtitle_en, subtitle_zh, summary_en, summary_zh, content_json, href,
           search_terms, status, verification_status, sort_order, version)
          values ($1, $2, $3, $4, $5, $6, $7, $8, '{"sections":[],"sources":[]}'::jsonb, $9,
            $10::jsonb, 'draft', 'unverified', $11, 1)`,
        [identity.guideId, document.slug, document.titleEn, document.titleZh, document.subtitleEn, document.subtitleZh,
          document.summaryEn, document.summaryZh, document.href, JSON.stringify(document.searchTerms), identity.sortOrder]);
      } else if (existing.length !== 1 || existing[0].id !== identity.guideId || existing[0].slug !== document.slug) {
        throw new Error(`Guide identity collision for ${document.slug}.`);
      }

      const draft = await governance.createDraft(preparer, identity.guideId, { versionId: identity.versionId, document });
      let approved = draft;
      if (draft.status === "draft") {
        approved = await governance.approve(reviewer, identity.guideId, {
          versionId: identity.versionId,
          expectedContentSha256: draft.contentSha256,
          effectiveFrom: null,
          reviewDueAt,
          reviewReference: approval.reviewReference,
          contentReviewed: true,
          sourcesVerified: true,
          publicContentConfirmed: true,
        });
      }
      if (approved.status !== "approved" || approved.contentSha256 !== guideDigest(document)
        || approved.review?.reviewReference !== approval.reviewReference || !approved.approvalSha256) {
        throw new Error(`Approved guide version does not match ${document.slug}.`);
      }
      const versions = await governance.listVersions(reviewer, identity.guideId, { limit: 1 });
      const publication = await governance.publish(reviewer, identity.guideId, {
        versionId: identity.versionId,
        expectedContentSha256: approved.contentSha256,
        expectedApprovalSha256: approved.approvalSha256,
        expectedPublicationRevision: versions.publication?.revision ?? 0,
      });
      published.push({ slug: document.slug, guideId: identity.guideId, versionId: identity.versionId,
        contentSha256: approved.contentSha256, approvalSha256: approved.approvalSha256, publicationRevision: publication.revision });
    }

    const projected = await tx.query<{ slug: string; status: string; verificationStatus: string; sectionCount: string; sourceCount: string }>(
      `select slug, status, verification_status as "verificationStatus",
        jsonb_array_length(content_json->'sections')::text as "sectionCount",
        jsonb_array_length(content_json->'sources')::text as "sourceCount"
       from public_guides where id = any($1::uuid[]) order by sort_order`,
      [identities.map((identity) => identity.guideId)],
    );
    if (projected.length !== 4 || projected.some((row) => row.status !== "published" || row.verificationStatus !== "verified"
      || Number(row.sectionCount) < 5 || Number(row.sourceCount) < 2)) {
      throw new Error("Published guide projection verification failed.");
    }
    return { database: databaseIdentity, approvalReference: approval.reviewReference, candidateSha256,
      evidenceSha256, published, projected };
  });
  console.log(JSON.stringify({ ok: true, localOnly: true, idempotent: true, ...report }, null, 2));
} finally {
  await pool.end();
}
