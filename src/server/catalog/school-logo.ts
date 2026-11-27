import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { badRequest, conflict } from "../shared/errors.ts";
import type { SqlCatalogClient } from "./postgres-repository.ts";

export const SCHOOL_LOGO_MAX_BYTES = 1024 * 1024;
export type SchoolLogoInput = { bytes: Buffer; sourceUrl: string; sourceNote: string; sha256: string; width: number; height: number };
export type SchoolLogoDto = { url: string; sha256: string; sourceUrl: string; version: number; updatedAt: string; width: number; height: number };

export function logoSourceUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw badRequest("A logo source HTTPS URL is required.");
  try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password && url.hostname) return url.href; } catch { /* Invalid URL. */ }
  throw badRequest("A logo source HTTPS URL without credentials is required.");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

// Decode bounded PNG data and discard metadata, trailing payloads and animation chunks.
// Keeping one raster format avoids serving user-supplied SVG/script content.
export function prepareSchoolLogo(bytes: Buffer, sourceUrl: unknown, sourceNote = ""): SchoolLogoInput {
  if (!Buffer.isBuffer(bytes) || bytes.length > SCHOOL_LOGO_MAX_BYTES || bytes.length < 57
    || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw badRequest("Use a PNG image no larger than 1 MiB.");
  if (typeof sourceNote !== "string" || sourceNote.length > 1000) throw badRequest("Logo source note is too long.");
  const chunks: Buffer[] = [bytes.subarray(0, 8)], data: Buffer[] = [];
  let offset = 8, width = 0, height = 0, color = 0, ended = false, palette = false, dataEnded = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
    if (end > bytes.length) throw badRequest("Truncated PNG image.");
    const type = bytes.toString("ascii", offset + 4, offset + 8), body = bytes.subarray(offset + 8, end - 4);
    if (bytes.readUInt32BE(end - 4) !== crc32(bytes.subarray(offset + 4, end - 4))) throw badRequest("PNG checksum failed.");
    if (!width && type !== "IHDR") throw badRequest("PNG header is missing.");
    if (type === "IHDR") {
      if (width || size !== 13) throw badRequest("Invalid PNG header.");
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); color = body[9];
      if (width < 16 || height < 16 || width > 2048 || height > 2048 || body[8] !== 8
        || ![0, 2, 3, 4, 6].includes(color) || body[10] || body[11] || body[12]) throw badRequest("Use a non-interlaced 8-bit PNG, 16–2048 pixels per side.");
    } else if (type === "PLTE") {
      if (palette || data.length || !size || size > 768 || size % 3) throw badRequest("Invalid PNG palette.");
      palette = true;
    } else if (type === "IDAT") {
      if (dataEnded) throw badRequest("PNG data chunks must be consecutive.");
      data.push(body);
    } else if (type === "IEND") {
      if (size || !data.length || (color === 3 && !palette)) throw badRequest("Invalid PNG end.");
      ended = true;
    } else {
      if (data.length) dataEnded = true;
      if (!["tRNS"].includes(type) && (bytes[offset + 4] & 32) === 0) throw badRequest("Unsupported PNG image chunk.");
      if (["acTL", "fcTL", "fdAT"].includes(type)) throw badRequest("Animated logos are not supported.");
    }
    if (["IHDR", "PLTE", "IDAT", "IEND", "tRNS"].includes(type)) chunks.push(bytes.subarray(offset, end));
    offset = end;
    if (ended) break;
  }
  if (!ended || offset !== bytes.length) throw badRequest("PNG contains trailing or incomplete data.");
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color], stride = width * channels + 1;
  let pixels: Buffer;
  try { pixels = inflateSync(Buffer.concat(data), { maxOutputLength: stride * height }); } catch { throw badRequest("PNG image data is invalid."); }
  if (pixels.length !== stride * height) throw badRequest("PNG dimensions do not match image data.");
  for (let row = 0; row < height; row++) if (pixels[row * stride] > 4) throw badRequest("Invalid PNG scanline filter.");
  const clean = Buffer.concat(chunks);
  return { bytes: clean, sourceUrl: logoSourceUrl(sourceUrl), sourceNote: sourceNote.trim(),
    sha256: createHash("sha256").update(clean).digest("hex"), width, height };
}

export function publicSchoolLogoSql(alias = "s") {
  if (alias !== "s") throw new Error("Unsupported school SQL alias.");
  return `(select case when l.bytes is null then null else jsonb_build_object(
    'url','/api/v1/catalog/schools/' || s.id::text || '/logo?v=' || l.version,
    'sha256',l.sha256,'sourceUrl',l.source_url,'version',l.version,
    'updatedAt',l.created_at,'width',l.width,'height',l.height) end
    from school_logo_versions l where l.school_id=s.id and s.status='active'
      and s.verification_status in ('verified','stale') order by l.version desc limit 1)`;
}

// Caller owns the transaction. Locking the school serializes logo revisions and imports.
export async function writeSchoolLogo(client: SqlCatalogClient, schoolId: string, expectedVersion: number,
  logo: SchoolLogoInput | null, actorUserId: string | null, importOnly = false) {
  const school = await client.query<{ id: string; status: string }>("select id,status from schools where id=$1 for update", [schoolId]);
  if (!school[0] || school[0].status === "archived") throw conflict("School is missing or archived.");
  const current = await client.query<{ version: number; sha256: string | null }>(
    "select version,sha256 from school_logo_versions where school_id=$1 order by version desc limit 1", [schoolId]);
  if (importOnly && current[0]) return { version: current[0].version, skipped: true };
  if ((current[0]?.version ?? 0) !== expectedVersion) throw conflict("Logo changed; reload before replacing it.");
  if (!logo && !current[0]?.sha256) throw conflict("There is no current logo to remove.");
  const version = expectedVersion + 1;
  await client.query(`insert into school_logo_versions(school_id,version,bytes,sha256,width,height,source_url,source_note,actor_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [schoolId,version,logo?.bytes ?? null,logo?.sha256 ?? null,
    logo?.width ?? null,logo?.height ?? null,logo?.sourceUrl ?? null,logo?.sourceNote ?? "",actorUserId]);
  return { version, skipped: false };
}
