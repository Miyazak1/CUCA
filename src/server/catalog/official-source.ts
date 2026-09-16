import { createHash } from "node:crypto";

export type OfficialCatalogSourceRole = "authority-list" | "school-admissions" | "program-catalog" | "scholarship" | "freshness-index";

export type OfficialCatalogSource = {
  id: string;
  label: string;
  url: string;
  allowedHosts: string[];
  sourceRole: OfficialCatalogSourceRole;
  schoolSlug?: string;
};

export type OfficialCatalogSourceRegistry = {
  version: 1;
  sources: OfficialCatalogSource[];
};

export type OfficialCatalogSnapshotMetadata = {
  id: string;
  label: string;
  sourceRole: OfficialCatalogSourceRole;
  schoolSlug?: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  byteLength: number;
  sha256: string;
  etag?: string;
  lastModified?: string;
  artifactPath?: string;
};

export type OfficialCatalogSnapshot = {
  metadata: OfficialCatalogSnapshotMetadata;
  content: Uint8Array;
};

export type OfficialCatalogAcquisitionManifest = {
  version: 1;
  generatedAt: string;
  registrySha256: string;
  sources: OfficialCatalogSnapshotMetadata[];
};

export type OfficialCatalogManifestDiff = {
  added: string[];
  removed: string[];
  changed: Array<{ id: string; beforeSha256: string; afterSha256: string }>;
  unchanged: string[];
};

export type OfficialSourceFetchOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

const sourceIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sourceRoles = new Set<OfficialCatalogSourceRole>([
  "authority-list",
  "school-admissions",
  "program-catalog",
  "scholarship",
  "freshness-index",
]);
const allowedContentTypes = new Set([
  "text/html",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateOfficialCatalogSourceRegistry(value: unknown): string[] {
  const errors: string[] = [];
  const registry = asRecord(value);
  if (!registry) return ["Official source registry must be an object."];
  for (const key of Object.keys(registry)) {
    if (!new Set(["version", "sources"]).has(key)) errors.push(`registry.${key} is not allowed.`);
  }
  if (registry.version !== 1) errors.push("registry.version must be 1.");
  if (!Array.isArray(registry.sources)) return [...errors, "registry.sources must be an array."];

  const seen = new Set<string>();
  registry.sources.forEach((rawSource, index) => {
    const label = `registry.sources[${index}]`;
    const source = asRecord(rawSource);
    if (!source) {
      errors.push(`${label} must be an object.`);
      return;
    }
    for (const key of Object.keys(source)) {
      if (!new Set(["id", "label", "url", "allowedHosts", "sourceRole", "schoolSlug"]).has(key)) {
        errors.push(`${label}.${key} is not allowed.`);
      }
    }
    requireText(source.id, `${label}.id`, errors);
    requireText(source.label, `${label}.label`, errors);
    if (typeof source.id === "string") {
      if (!sourceIdPattern.test(source.id)) errors.push(`${label}.id must use lowercase kebab-case.`);
      if (seen.has(source.id)) errors.push(`${label}.id duplicates ${source.id}.`);
      seen.add(source.id);
    }
    if (!sourceRoles.has(source.sourceRole as OfficialCatalogSourceRole)) errors.push(`${label}.sourceRole is not supported.`);
    if (source.schoolSlug !== undefined && (typeof source.schoolSlug !== "string" || !sourceIdPattern.test(source.schoolSlug))) {
      errors.push(`${label}.schoolSlug must use lowercase kebab-case.`);
    }
    if (!Array.isArray(source.allowedHosts) || !source.allowedHosts.length) {
      errors.push(`${label}.allowedHosts must contain at least one exact official hostname.`);
      return;
    }
    const hosts = new Set<string>();
    for (const [hostIndex, rawHost] of source.allowedHosts.entries()) {
      const hostLabel = `${label}.allowedHosts[${hostIndex}]`;
      if (typeof rawHost !== "string" || !isPublicExactHostname(rawHost)) {
        errors.push(`${hostLabel} must be an exact public hostname without wildcards.`);
      } else if (hosts.has(rawHost.toLowerCase())) {
        errors.push(`${hostLabel} duplicates ${rawHost}.`);
      } else {
        hosts.add(rawHost.toLowerCase());
      }
    }
    validateRegisteredUrl(source.url, hosts, `${label}.url`, errors);
  });
  return errors;
}

export function hashOfficialCatalogRegistry(registry: OfficialCatalogSourceRegistry): string {
  return sha256(new TextEncoder().encode(canonicalJson(registry)));
}

export async function fetchOfficialCatalogSource(
  source: OfficialCatalogSource,
  options: OfficialSourceFetchOptions = {},
): Promise<OfficialCatalogSnapshot> {
  const registryErrors = validateOfficialCatalogSourceRegistry({ version: 1, sources: [source] });
  if (registryErrors.length) throw new Error(registryErrors.join("\n"));

  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? 15 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxRedirects = options.maxRedirects ?? 4;
  const allowedHosts = new Set(source.allowedHosts.map((host) => host.toLowerCase()));
  let currentUrl = source.url;
  let response: Response | undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      assertAllowedFetchUrl(currentUrl, allowedHosts);
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;q=0.9",
          "user-agent": "CUAC-Official-Catalog-Collector/0.1 (evidence-only; no recursive crawling)",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error(`${source.id} returned a redirect without Location.`);
      if (redirectCount === maxRedirects) throw new Error(`${source.id} exceeded ${maxRedirects} redirects.`);
      currentUrl = new URL(location, currentUrl).toString();
    }
  } finally {
    clearTimeout(timeout);
  }

  if (!response || !response.ok) throw new Error(`${source.id} returned HTTP ${response?.status ?? "unknown"}.`);
  const declaredContentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!allowedContentTypes.has(declaredContentType) && declaredContentType !== "application/octet-stream") {
    throw new Error(`${source.id} returned unsupported content type ${declaredContentType || "unknown"}.`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error(`${source.id} exceeds the ${maxBytes}-byte limit.`);
  const content = new Uint8Array(await response.arrayBuffer());
  if (content.byteLength > maxBytes) throw new Error(`${source.id} exceeds the ${maxBytes}-byte limit.`);
  const contentType = declaredContentType === "application/octet-stream"
    ? inferOctetStreamContentType(content)
    : declaredContentType;
  if (!allowedContentTypes.has(contentType)) {
    throw new Error(`${source.id} returned unsupported content type ${declaredContentType || "unknown"}.`);
  }
  const fetchedAt = (options.now ?? (() => new Date()))().toISOString();

  return {
    metadata: {
      id: source.id,
      label: source.label,
      sourceRole: source.sourceRole,
      schoolSlug: source.schoolSlug,
      url: source.url,
      finalUrl: currentUrl,
      fetchedAt,
      status: response.status,
      contentType,
      byteLength: content.byteLength,
      sha256: sha256(content),
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    },
    content,
  };
}

function hasPdfSignature(content: Uint8Array) {
  return content.byteLength >= 5
    && content[0] === 0x25
    && content[1] === 0x50
    && content[2] === 0x44
    && content[3] === 0x46
    && content[4] === 0x2d;
}

function inferOctetStreamContentType(content: Uint8Array) {
  if (hasPdfSignature(content)) return "application/pdf";
  if (hasJpegSignature(content)) return "image/jpeg";
  if (hasPngSignature(content)) return "image/png";
  if (hasWebpSignature(content)) return "image/webp";
  if (hasZipSignature(content)) {
    const zipText = new TextDecoder("latin1").decode(content);
    if (zipText.includes("word/")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (zipText.includes("xl/")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/octet-stream";
}

function hasJpegSignature(content: Uint8Array) {
  return content.byteLength >= 3
    && content[0] === 0xff
    && content[1] === 0xd8
    && content[2] === 0xff;
}

function hasPngSignature(content: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return content.byteLength >= signature.length
    && signature.every((byte, index) => content[index] === byte);
}

function hasWebpSignature(content: Uint8Array) {
  return content.byteLength >= 12
    && new TextDecoder("ascii").decode(content.slice(0, 4)) === "RIFF"
    && new TextDecoder("ascii").decode(content.slice(8, 12)) === "WEBP";
}

function hasZipSignature(content: Uint8Array) {
  return content.byteLength >= 4
    && content[0] === 0x50
    && content[1] === 0x4b
    && content[2] === 0x03
    && content[3] === 0x04;
}

export function diffOfficialCatalogManifests(
  before: OfficialCatalogAcquisitionManifest,
  after: OfficialCatalogAcquisitionManifest,
): OfficialCatalogManifestDiff {
  const previous = new Map(before.sources.map((source) => [source.id, source]));
  const current = new Map(after.sources.map((source) => [source.id, source]));
  const added = [...current.keys()].filter((id) => !previous.has(id)).sort();
  const removed = [...previous.keys()].filter((id) => !current.has(id)).sort();
  const changed: OfficialCatalogManifestDiff["changed"] = [];
  const unchanged: string[] = [];
  for (const id of [...current.keys()].filter((item) => previous.has(item)).sort()) {
    const beforeSource = previous.get(id)!;
    const afterSource = current.get(id)!;
    if (beforeSource.sha256 === afterSource.sha256) unchanged.push(id);
    else changed.push({ id, beforeSha256: beforeSource.sha256, afterSha256: afterSource.sha256 });
  }
  return { added, removed, changed, unchanged };
}

function validateRegisteredUrl(value: unknown, allowedHosts: Set<string>, label: string, errors: string[]) {
  if (typeof value !== "string") {
    errors.push(`${label} is required.`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
      errors.push(`${label} must be an HTTPS URL without credentials, port or fragment.`);
    }
    if (!allowedHosts.has(url.hostname.toLowerCase())) errors.push(`${label} hostname is not in allowedHosts.`);
  } catch {
    errors.push(`${label} must be a valid URL.`);
  }
}

function assertAllowedFetchUrl(value: string, allowedHosts: Set<string>) {
  const errors: string[] = [];
  validateRegisteredUrl(value, allowedHosts, "fetch URL", errors);
  if (errors.length) throw new Error(errors.join("\n"));
}

function isPublicExactHostname(value: string): boolean {
  const host = value.toLowerCase();
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)
    && host.includes(".")
    && !host.includes("*")
    && !host.endsWith(".invalid")
    && !host.endsWith(".local")
    && host !== "localhost"
    && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function requireText(value: unknown, label: string, errors: string[]) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${label} is required.`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = asRecord(value);
  if (record) return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
