import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";

export const EVIDENCE_ARTIFACT_MAX_BYTES = 16 * 1024 * 1024;

type ArtifactStat = {
  size: number;
  isFile(): boolean;
  isSymbolicLink(): boolean;
};

type ArtifactIo = {
  lstat(path: string): Promise<ArtifactStat>;
  readFile(path: string): Promise<Uint8Array>;
};

const defaultIo: ArtifactIo = { lstat, readFile };

export async function createEvidenceArtifactReference(path: string, io: ArtifactIo = defaultIo) {
  const stat = await io.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || !Number.isSafeInteger(stat.size)
    || stat.size < 1 || stat.size > EVIDENCE_ARTIFACT_MAX_BYTES) {
    throw new Error("Evidence artifact must be a non-empty bounded regular file.");
  }
  const bytes = await io.readFile(path);
  if (bytes.byteLength !== stat.size) throw new Error("Evidence artifact changed while it was being read.");
  const digest = createHash("sha256").update(bytes).digest("hex");
  return {
    schema: "cuac.evidence-artifact-reference.v1" as const,
    evidenceRef: `artifact:sha256:${digest}` as const,
    bytes: bytes.byteLength,
  };
}
