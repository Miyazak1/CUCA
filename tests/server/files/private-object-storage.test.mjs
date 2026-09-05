import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { createPrivateOssStorageFromEnv, parsePrivateOssConfiguration } from "../../../src/server/index.ts";

const fileId = "aa111111-1111-4111-8111-111111111111";
const objectKey = `private/student-files/aa/${fileId}`;
const host = "cuac-private.oss-cn-hangzhou.aliyuncs.com";
const env = {
  ALIYUN_OSS_REGION: "oss-cn-hangzhou",
  ALIYUN_OSS_PRIVATE_BUCKET: "cuac-private",
  ALIBABA_CLOUD_ACCESS_KEY_ID: "access-key-id",
  ALIBABA_CLOUD_ACCESS_KEY_SECRET: "access-key-secret",
  ALIYUN_OSS_KMS_KEY_ID: "kms-key-1",
};

test("private OSS configuration rejects arbitrary endpoints and invalid limits without echoing secrets", () => {
  assert.equal(parsePrivateOssConfiguration(env).maximumBytes, 25 * 1024 * 1024);
  for (const candidate of [
    { ...env, ALIYUN_OSS_REGION: "https://attacker.test" },
    { ...env, ALIYUN_OSS_PRIVATE_BUCKET: "Bad_Bucket" },
    { ...env, ALIBABA_CLOUD_ACCESS_KEY_SECRET: "short" },
    { ...env, CUAC_FILE_MAX_BYTES: String(100 * 1024 * 1024 + 1) },
  ]) assert.throws(() => parsePrivateOssConfiguration(candidate), error => {
    assert.equal(error?.code, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(error.message, /access-key-secret|attacker/);
    return true;
  });
});

test("private OSS adapter fixes client posture, signed upload headers and exact version operations", async () => {
  const calls = [];
  const stream = Readable.from([Buffer.from("document")]);
  const client = {
    async signatureUrlV4(method, expires, options, key, signedHeaders) {
      calls.push({ method, expires, options, key, signedHeaders });
      const queries = new URLSearchParams(options.queries ?? { signature: "1" });
      if (!queries.size) queries.set("signature", "1");
      return `https://${host}/${key}?${queries}`;
    },
    async head(key) {
      calls.push({ method: "HEAD", key });
      return { status: 200, meta: { "cuac-file-id": fileId, "cuac-sha256": "a".repeat(64) }, res: { headers: {
        "x-oss-version-id": "version-1", etag: '"etag-1"', "content-length": "8", "content-type": "application/pdf",
        "x-oss-server-side-encryption": "KMS", "x-oss-server-side-encryption-key-id": "kms-key-1",
      } } };
    },
    async getStream(key, options) { calls.push({ method: "STREAM", key, options }); return { stream, res: { status: 200 } }; },
    async delete(key, options) { calls.push({ method: "DELETE", key, options }); return {}; },
  };
  let clientOptions;
  const now = new Date("2026-09-01T00:00:00.000Z");
  const { storage } = createPrivateOssStorageFromEnv(env, {
    now: () => now,
    createClient(options) { clientOptions = options; return client; },
  });
  assert.deepEqual({ secure: clientOptions.secure, internal: clientOptions.internal, authorizationV4: clientOptions.authorizationV4 },
    { secure: true, internal: false, authorizationV4: true });
  assert.equal("endpoint" in clientOptions, false);

  const upload = await storage.createUploadAuthorization({
    objectKey, fileId, contentType: "application/pdf", expectedSha256: "a".repeat(64),
    expiresAt: new Date(now.getTime() + 60_000),
  });
  assert.equal(upload.method, "PUT");
  assert.equal(upload.headers["x-oss-object-acl"], "private");
  assert.equal(upload.headers["x-oss-server-side-encryption"], "KMS");
  assert.equal(upload.headers["x-oss-meta-cuac-file-id"], fileId);
  assert.deepEqual(calls[0].signedHeaders, Object.keys(upload.headers).sort());

  const metadata = await storage.headCurrent(objectKey);
  assert.deepEqual(metadata, {
    versionId: "version-1", etag: "etag-1", sizeBytes: 8, contentType: "application/pdf", fileId,
    expectedSha256: "a".repeat(64), encryption: "KMS", kmsKeyId: "kms-key-1",
  });
  assert.equal(await storage.openVersion(objectKey, "version-1"), stream);
  const download = await storage.createDownloadUrl({
    objectKey, versionId: "version-1", filename: "private transcript.pdf", expiresAt: new Date(now.getTime() + 30_000),
  });
  assert.equal(new URL(download).searchParams.get("versionId"), "version-1");
  assert.match(new URL(download).searchParams.get("response-content-disposition"), /^attachment; filename="cuac-document\.pdf"$/);
  await storage.deleteVersion(objectKey, "version-1");
  assert.deepEqual(calls.at(-2).options, { versionId: "version-1" });
  assert.equal(calls.at(-1).options, undefined);
});

test("private OSS adapter rejects a signed URL on any other host", async () => {
  const { storage } = createPrivateOssStorageFromEnv(env, {
    now: () => new Date("2026-09-01T00:00:00.000Z"),
    createClient: () => ({
      async signatureUrlV4() { return `https://attacker.test/${objectKey}?signature=1`; },
      async head() { throw new Error(); }, async getStream() { throw new Error(); }, async delete() {},
    }),
  });
  await assert.rejects(storage.createUploadAuthorization({
    objectKey, fileId, contentType: "application/pdf", expectedSha256: "a".repeat(64),
    expiresAt: new Date("2026-09-01T00:01:00.000Z"),
  }), error => error?.code === "SERVICE_UNAVAILABLE");
});
