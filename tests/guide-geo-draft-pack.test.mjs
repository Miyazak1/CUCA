import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseGuideDocument } from "../src/server/catalog/guide-document.ts";

const packPath = new URL("../seeds/guides.geo-first-four.draft.json", import.meta.url);
const approvalPath = new URL("../seeds/guides.geo-first-four.approval.json", import.meta.url);

test("first GEO guide candidate remains immutable and schema-valid", async () => {
  const pack = JSON.parse(await readFile(packPath, "utf8"));
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.status, "unreviewed_draft");
  assert.equal(pack.publicationAuthorized, false);
  assert.equal(pack.databaseWriteAuthorized, false);
  assert.match(pack.evidenceManifest.path, /^work\/catalog-official\//);
  assert.match(pack.evidenceManifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(pack.evidenceManifest.sourceCount, 7);
  assert.equal(pack.documents.length, 4);

  const documents = pack.documents.map(parseGuideDocument);
  assert.equal(new Set(documents.map((document) => document.slug)).size, documents.length);
  for (const document of documents) {
    assert.ok(document.sections.length >= 5);
    assert.ok(document.sources.length >= 2);
    assert.equal(document.href, `guide-detail.html?guide=${document.slug}`);
  }
});
test("product-owner approval is bound to the exact four-guide candidate", async () => {
  const candidateBytes = await readFile(packPath);
  const pack = JSON.parse(candidateBytes.toString("utf8"));
  const approval = JSON.parse(await readFile(approvalPath, "utf8"));
  const digest = createHash("sha256").update(candidateBytes).digest("hex");

  assert.equal(approval.schemaVersion, 1);
  assert.equal(approval.candidatePath, "seeds/guides.geo-first-four.draft.json");
  assert.equal(approval.candidateSha256, digest);
  assert.equal(approval.reviewReference, "product-owner-chat-approval-2026-10-09");
  assert.equal(approval.contentReviewed, true);
  assert.equal(approval.sourcesVerified, true);
  assert.equal(approval.publicContentConfirmed, true);
  assert.equal(approval.publicationAuthorized, true);
  assert.equal(approval.databaseWriteAuthorized, true);
  assert.equal(approval.scope.productionDeploymentAuthorized, false);
  assert.deepEqual(approval.scope.documentSlugs, pack.documents.map((document) => document.slug));
});

test("local GEO guide publisher is approval-bound, atomic and loopback-only", async () => {
  const [source, dockerfile] = await Promise.all([
    readFile(new URL("../scripts/guide-geo-first-four-publish-local.ts", import.meta.url), "utf8"),
    readFile(new URL("../deploy/trial/Dockerfile", import.meta.url), "utf8"),
  ]);
  assert.match(source, /publish-approved-geo-guides-to-cuac-local/);
  assert.match(source, /approval\.candidateSha256 !== candidateSha256/);
  assert.match(source, /localDatabaseUrl\(state\)/);
  assert.match(source, /client\.transaction\(async \(tx\)/);
  assert.match(source, /new PostgresGuideGovernance\(tx\)/);
  assert.match(source, /governance\.createDraft/);
  assert.match(source, /governance\.approve/);
  assert.match(source, /governance\.publish/);
  assert.doesNotMatch(source, /DATABASE_URL|POSTGRES_URL|PG_DATABASE_URL/);
  assert.match(dockerfile, /seeds\/guides\.geo-first-four\.draft\.json/);
  assert.match(dockerfile, /seeds\/guides\.geo-first-four\.approval\.json/);
});
