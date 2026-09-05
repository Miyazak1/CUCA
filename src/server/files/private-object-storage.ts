import OSS from "ali-oss";
import type { Readable } from "node:stream";
import { serviceUnavailable } from "../shared/errors.ts";
import type { StudentFileContentType } from "./student-file.ts";

export type PrivateObjectUploadAuthorization = {
  method: "PUT";
  url: string;
  headers: Readonly<Record<string, string>>;
  expiresAt: Date;
};

export type PrivateObjectMetadata = {
  versionId: string | null;
  etag: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  fileId: string | null;
  expectedSha256: string | null;
  encryption: string | null;
  kmsKeyId: string | null;
};

export type PrivateObjectStorage = {
  createUploadAuthorization(input: {
    objectKey: string;
    fileId: string;
    contentType: StudentFileContentType;
    expectedSha256: string;
    expiresAt: Date;
  }): Promise<PrivateObjectUploadAuthorization>;
  headCurrent(objectKey: string): Promise<PrivateObjectMetadata>;
  openVersion(objectKey: string, versionId: string): Promise<Readable>;
  createDownloadUrl(input: { objectKey: string; versionId: string; filename: string; expiresAt: Date }): Promise<string>;
  deleteVersion(objectKey: string, versionId: string | null): Promise<void>;
};

export type PrivateOssConfiguration = {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  kmsKeyId: string;
  uploadTtlSeconds: number;
  downloadTtlSeconds: number;
  maximumBytes: number;
};

type OssClient = Pick<OSS, "signatureUrlV4" | "head" | "getStream" | "delete">;
type OssDependencies = { createClient(options: OSS.Options): OssClient; now?: () => Date };

const defaultDependencies: OssDependencies = { createClient: options => new OSS(options) };

export function createPrivateOssStorageFromEnv(
  env: Record<string, string | undefined> = process.env,
  dependencies: OssDependencies = defaultDependencies,
): { storage: PrivateObjectStorage; config: PrivateOssConfiguration } {
  const config = parsePrivateOssConfiguration(env);
  return { storage: new AliyunPrivateObjectStorage(config, dependencies), config };
}

export function parsePrivateOssConfiguration(env: Record<string, string | undefined>): PrivateOssConfiguration {
  const region = required(env.ALIYUN_OSS_REGION, "region");
  const bucket = required(env.ALIYUN_OSS_PRIVATE_BUCKET, "bucket");
  if (!/^oss-(?:cn|ap|us|eu|me)-[a-z0-9-]{2,32}$/.test(region)) throw invalidConfig();
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw invalidConfig();
  return {
    region,
    bucket,
    accessKeyId: secret(env.ALIBABA_CLOUD_ACCESS_KEY_ID ?? env.OSS_ACCESS_KEY_ID),
    accessKeySecret: secret(env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ?? env.OSS_ACCESS_KEY_SECRET),
    kmsKeyId: required(env.ALIYUN_OSS_KMS_KEY_ID, "KMS key"),
    uploadTtlSeconds: integer(env.CUAC_FILE_UPLOAD_TTL_SECONDS, 60, 900, 900),
    downloadTtlSeconds: integer(env.CUAC_FILE_DOWNLOAD_TTL_SECONDS, 30, 300, 60),
    maximumBytes: integer(env.CUAC_FILE_MAX_BYTES, 1, 100 * 1024 * 1024, 25 * 1024 * 1024),
  };
}

export class AliyunPrivateObjectStorage implements PrivateObjectStorage {
  private readonly client: OssClient;
  private readonly config: PrivateOssConfiguration;
  private readonly now: () => Date;

  constructor(config: PrivateOssConfiguration, dependencies: OssDependencies = defaultDependencies) {
    this.config = config;
    this.now = dependencies.now ?? (() => new Date());
    this.client = dependencies.createClient({
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      secure: true,
      internal: false,
      authorizationV4: true,
      timeout: 8_000,
    });
  }

  async createUploadAuthorization(input: {
    objectKey: string;
    fileId: string;
    contentType: StudentFileContentType;
    expectedSha256: string;
    expiresAt: Date;
  }): Promise<PrivateObjectUploadAuthorization> {
    requireObjectKey(input.objectKey, input.fileId);
    const expires = expirySeconds(this.now(), input.expiresAt, this.config.uploadTtlSeconds);
    const headers = {
      "content-type": input.contentType,
      "x-oss-object-acl": "private",
      "x-oss-server-side-encryption": "KMS",
      "x-oss-server-side-encryption-key-id": this.config.kmsKeyId,
      "x-oss-meta-cuac-file-id": input.fileId,
      "x-oss-meta-cuac-sha256": input.expectedSha256,
    } as const;
    const signedHeaders = Object.keys(headers).sort();
    const url = await this.client.signatureUrlV4("PUT", expires, { headers }, input.objectKey, signedHeaders);
    validateSignedUrl(url, this.config, input.objectKey);
    return { method: "PUT", url, headers, expiresAt: input.expiresAt };
  }

  async headCurrent(objectKey: string): Promise<PrivateObjectMetadata> {
    requireObjectKey(objectKey);
    const result = await this.client.head(objectKey, { timeout: 8_000 });
    if (result.status !== 200) throw serviceUnavailable("Private object metadata is unavailable.");
    const headers = lowerCaseRecord(result.res?.headers);
    const meta = lowerCaseRecord(result.meta);
    return {
      versionId: bounded(headers["x-oss-version-id"], 1024),
      etag: bounded(headers.etag?.replace(/^"|"$/g, ""), 256),
      sizeBytes: decimal(headers["content-length"]),
      contentType: bounded(headers["content-type"], 255),
      fileId: bounded(meta["cuac-file-id"] ?? headers["x-oss-meta-cuac-file-id"], 64),
      expectedSha256: bounded(meta["cuac-sha256"] ?? headers["x-oss-meta-cuac-sha256"], 64),
      encryption: bounded(headers["x-oss-server-side-encryption"], 32),
      kmsKeyId: bounded(headers["x-oss-server-side-encryption-key-id"], 256),
    };
  }

  async openVersion(objectKey: string, versionId: string): Promise<Readable> {
    requireObjectKey(objectKey);
    requireVersionId(versionId);
    const result = await this.client.getStream(objectKey, { versionId, timeout: 15_000 } as OSS.GetStreamOptions);
    if (result.res?.status !== 200 || !result.stream || typeof result.stream.pipe !== "function") {
      throw serviceUnavailable("Private object version is unavailable for inspection.");
    }
    return result.stream as Readable;
  }

  async createDownloadUrl(input: { objectKey: string; versionId: string; filename: string; expiresAt: Date }): Promise<string> {
    requireObjectKey(input.objectKey);
    const expires = expirySeconds(this.now(), input.expiresAt, this.config.downloadTtlSeconds);
    const disposition = `attachment; filename="${asciiDownloadName(input.filename)}"`;
    const url = await this.client.signatureUrlV4("GET", expires, { queries: {
      versionId: input.versionId,
      "response-content-disposition": disposition,
      "response-cache-control": "private, no-store",
    } }, input.objectKey);
    validateSignedUrl(url, this.config, input.objectKey);
    const parsed = new URL(url);
    if (parsed.searchParams.get("versionId") !== input.versionId) throw serviceUnavailable("Private object version was not bound to its download URL.");
    return url;
  }

  async deleteVersion(objectKey: string, versionId: string | null): Promise<void> {
    requireObjectKey(objectKey);
    if (versionId !== null) requireVersionId(versionId);
    if (versionId !== null) await deleteObject(this.client, objectKey, { versionId } as OSS.RequestOptions);
    // A versionless delete also hides any upload made by reusing an unexpired PUT URL.
    await deleteObject(this.client, objectKey);
  }
}

function requireVersionId(value: string): void {
  if (value.length < 1 || value.length > 1024 || hasControlCharacter(value)) {
    throw serviceUnavailable("Private object version is invalid.");
  }
}

function validateSignedUrl(value: unknown, config: PrivateOssConfiguration, objectKey: string): asserts value is string {
  if (typeof value !== "string" || value.length > 8_192 || hasControlCharacter(value)) throw serviceUnavailable("Private object authorization could not be generated.");
  try {
    const url = new URL(value);
    const expectedHost = `${config.bucket}.${config.region}.aliyuncs.com`;
    if (url.protocol !== "https:" || url.hostname !== expectedHost || url.username || url.password
      || decodeURIComponent(url.pathname.slice(1)) !== objectKey || !url.search) throw new Error();
  } catch { throw serviceUnavailable("Private object authorization could not be generated."); }
}

function requireObjectKey(value: string, fileId?: string): void {
  const pattern = /^private\/student-files\/([a-f0-9]{2})\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
  const match = pattern.exec(value);
  if (!match || match[1] !== match[2].slice(0, 2) || (fileId !== undefined && match[2] !== fileId)) {
    throw serviceUnavailable("Private object key is invalid.");
  }
}

function lowerCaseRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) =>
    typeof item === "string" || typeof item === "number" ? [[key.toLowerCase(), String(item)]] : []));
}

function bounded(value: string | undefined, maximum: number): string | null {
  if (!value || value.length > maximum || hasControlCharacter(value)) return null;
  return value;
}

function decimal(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= 1 && result <= 100 * 1024 * 1024 ? result : null;
}

function asciiDownloadName(value: string): string {
  const extension = /\.[A-Za-z0-9]{1,10}$/.exec(value)?.[0].toLowerCase() ?? "";
  return `cuac-document${extension}`;
}

function expirySeconds(now: Date, expiresAt: Date, maximum: number): number {
  if (!(now instanceof Date) || !(expiresAt instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isFinite(expiresAt.getTime())) throw invalidConfig();
  const seconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  if (seconds < 1 || seconds > maximum) throw serviceUnavailable("Private object authorization expiry is invalid.");
  return seconds;
}

function required(value: string | undefined, _name: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 256 || hasControlCharacter(normalized)) throw invalidConfig();
  return normalized;
}

function secret(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 512 || hasControlCharacter(value)) throw invalidConfig();
  return value;
}

function integer(value: string | undefined, minimum: number, maximum: number, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw invalidConfig();
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) throw invalidConfig();
  return result;
}

function invalidConfig() {
  return serviceUnavailable("Private OSS configuration is not available.");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  return value.status === 404 || value.statusCode === 404 || value.code === "NoSuchKey" || value.code === "NoSuchVersion";
}

async function deleteObject(client: OssClient, objectKey: string, options?: OSS.RequestOptions): Promise<void> {
  try { await client.delete(objectKey, options); }
  catch (error) {
    if (!isMissingObject(error)) throw serviceUnavailable("Private object version could not be deleted.");
  }
}
