import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  EVIDENCE_ARTIFACT_MAX_BYTES,
  createEvidenceArtifactReference,
} from "../../../scripts/lib/evidence-artifact.ts";

function io(bytes, overrides = {}) {
  return {
    async lstat() {
      return {
        size: bytes.byteLength,
        isFile: () => true,
        isSymbolicLink: () => false,
        ...overrides,
      };
    },
    async readFile() { return bytes; },
  };
}

test("evidence artifact reference binds the exact bounded bytes without exposing content", async () => {
  const bytes = Buffer.from('{"control":"postgres.migration","result":"passed"}\n');
  const result = await createEvidenceArtifactReference("protected-artifact.json", io(bytes));
  const digest = createHash("sha256").update(bytes).digest("hex");

  assert.deepEqual(result, {
    schema: "cuac.evidence-artifact-reference.v1",
    evidenceRef: `artifact:sha256:${digest}`,
    bytes: bytes.byteLength,
  });
  assert.doesNotMatch(JSON.stringify(result), /protected-artifact|postgres\.migration|result/);
});

test("evidence artifact reference rejects empty, oversized, redirected, and changing files", async () => {
  await assert.rejects(createEvidenceArtifactReference("empty", io(Buffer.alloc(0))), /non-empty bounded/);
  await assert.rejects(createEvidenceArtifactReference("large", io(Buffer.alloc(1), { size: EVIDENCE_ARTIFACT_MAX_BYTES + 1 })), /non-empty bounded/);
  await assert.rejects(createEvidenceArtifactReference("directory", io(Buffer.alloc(1), { isFile: () => false })), /regular file/);
  await assert.rejects(createEvidenceArtifactReference("link", io(Buffer.alloc(1), { isSymbolicLink: () => true })), /regular file/);
  await assert.rejects(createEvidenceArtifactReference("changed", io(Buffer.alloc(2), { size: 1 })), /changed while/);
});
