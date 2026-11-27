import { resolveRequestContextFromRequest } from "../auth/session.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../db/postgres-client.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { buildAuditEvent } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, forbidden, CuacError } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { prepareSchoolLogo, SCHOOL_LOGO_MAX_BYTES, writeSchoolLogo } from "./school-logo.ts";

type StoredLogo = { version: number; bytes: Buffer | null; sha256: string | null; width: number | null; height: number | null;
  sourceUrl: string | null; sourceNote: string; createdAt: Date };
const fields = `l.version,l.bytes,l.sha256,l.width,l.height,l.source_url as "sourceUrl",l.source_note as "sourceNote",l.created_at as "createdAt"`;
const notFound = () => new CuacError("NOT_FOUND", "School logo is not available.", 404);
function metadata(row: StoredLogo | undefined, id: string, privateView = false) {
  return { version: row?.version ?? 0, logo: row?.bytes ? {
    url: `/api/v1/${privateView ? "ops/catalog" : "catalog"}/schools/${id}/logo?${privateView ? "image=1&" : ""}v=${row.version}`,
    sha256: row.sha256, sourceUrl: row.sourceUrl, sourceNote: row.sourceNote,
    version: row.version, width: row.width, height: row.height, updatedAt: row.createdAt.toISOString(),
  } : null };
}
function imageResponse(row: StoredLogo | undefined, request: Request) {
  if (!row?.bytes) throw notFound();
  const headers = { "content-type": "image/png", "x-content-type-options": "nosniff", etag: `"${row.sha256}"`, "cache-control": "no-store" };
  return new Response(request.headers.get("if-none-match") === headers.etag ? null : new Uint8Array(row.bytes),
    { status: request.headers.get("if-none-match") === headers.etag ? 304 : 200, headers });
}
export function expectedLogoVersion(request: Request) {
  const value = request.headers.get("if-match") || "";
  if (!/^(0|[1-9]\d*)$/.test(value) || Number(value) >= 2147483647) throw badRequest("A current integer logo version is required in If-Match.");
  return Number(value);
}
async function boundedPng(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "image/png") throw badRequest("Upload a PNG image.");
  const reader = request.body?.getReader();
  if (!reader) throw badRequest("Logo image is missing.");
  const chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const value = await reader.read(); if (value.done) break; length += value.value.length;
    if (length > SCHOOL_LOGO_MAX_BYTES) { await reader.cancel(); throw new CuacError("PAYLOAD_TOO_LARGE", "Logo exceeds 1 MiB.", 413); }
    chunks.push(value.value);
  } } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
function decodedHeader(request: Request, name: string) {
  try { return decodeURIComponent(request.headers.get(name) || ""); } catch { throw badRequest("Invalid logo metadata header."); }
}
export function authorizeSchoolLogo(context: RequestContext, write: boolean) {
  if (!context.actorUserId || !["cuac_ops", "cuac_admin"].includes(context.activeRole) || context.selectedSurface !== "ops"
    || context.tenantSchoolId !== null || context.purpose !== "catalog_management") throw forbidden();
  const decision = evaluatePolicy(context, write ? "catalog.publish_master_data" : "catalog.read_master_data",
    { type: "catalog", dataClasses: ["public_catalog", "internal_catalog_metadata", "audit_security"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { actorUserId: context.actorUserId, activeRole: context.activeRole as "cuac_ops" | "cuac_admin", decisionId: decision.id };
}

export async function publicSchoolLogo(request: Request, schoolId: string, client = createTransactionalSqlClient(getSharedPostgresPool())) {
  const rows = await client.query<StoredLogo>(`select ${fields} from school_logo_versions l join schools s on s.id=l.school_id
    where s.id=$1 and s.status='active' and s.verification_status in ('verified','stale') order by l.version desc limit 1`, [schoolId]);
  return imageResponse(rows[0], request);
}

export async function manageSchoolLogo(request: Request, schoolId: string) {
  const client = createTransactionalSqlClient(getSharedPostgresPool());
  const context = await resolveRequestContextFromRequest(request, new PostgresAuthSessionRepository(client), { purpose: "catalog_management" });
  return manageSchoolLogoWithContext(request, schoolId, context, client);
}
export async function manageSchoolLogoWithContext(request: Request, schoolId: string, context: RequestContext, client: TransactionalSqlClient) {
  const write = request.method !== "GET", actor = authorizeSchoolLogo(context, write);
  const expectedVersion = write ? expectedLogoVersion(request) : 0;
  const logo = request.method === "PUT" ? prepareSchoolLogo(await boundedPng(request),
    decodedHeader(request, "x-logo-source-url"), decodedHeader(request, "x-logo-source-note")) : null;
  return client.transaction(async tx => {
    if (!await lockLiveCuacStaffAuthority(tx, actor)) throw forbidden("Active UCAC staff access grant is required.");
    if (write) {
      await writeSchoolLogo(tx, schoolId, expectedVersion, logo, actor.actorUserId);
      await new PostgresAuditWriter(tx).record(buildAuditEvent(context, { action: logo ? "ops.catalog.school.logo.replace" : "ops.catalog.school.logo.remove",
        resourceType: "school_logo", resourceId: schoolId, allowed: true, policyDecisionId: actor.decisionId,
        dataClasses: ["public_catalog", "audit_security"], metadata: { version: expectedVersion + 1, sha256: logo?.sha256 ?? null } }));
    }
    const school = await tx.query<{ id: string }>("select id from schools where id=$1", [schoolId]);
    if (!school[0]) throw notFound();
    const rows = await tx.query<StoredLogo>(`select ${fields} from school_logo_versions l where l.school_id=$1 order by l.version desc limit 1`, [schoolId]);
    if (!write && new URL(request.url).searchParams.get("image") === "1") return imageResponse(rows[0], request);
    return Response.json({ data: metadata(rows[0],schoolId,true) });
  });
}
