import { createHash } from "node:crypto";
import { GUEST_SESSION_COOKIE_NAME, verifyGuestSession } from "./guest-session.ts";
import {
  createRequestContext,
  type AuthStrength,
  type CuacRole,
  type CuacSurface,
  type RequestContext,
  type RequestPurpose,
} from "../shared/request-context.ts";

export const SESSION_COOKIE_NAME = "cuac_session";
export { GUEST_SESSION_COOKIE_NAME } from "./guest-session.ts";

export type AuthSessionRecord = {
  userId: string;
  selectedSurface: string;
  activeRole: string;
  tenantSchoolId: string | null;
  authStrength: string;
  expiresAt: Date;
  revokedAt: Date | null;
  accountStatus: string;
};

export type AuthSessionRepository = {
  findActiveSessionByTokenHash(sessionTokenHash: string, now: Date): Promise<AuthSessionRecord | null>;
  findActiveCuacStaffAccessGrantByUserAndRole?(userId: string, role: "cuac_ops" | "cuac_admin", now: Date): Promise<CuacStaffAccessGrantRecord | null>;
};

export type CuacStaffAccessGrantRecord = {
  userId: string;
  role: "cuac_ops" | "cuac_admin";
  status: "approved";
  expiresAt: Date;
};

export type SchoolTenantMembershipRecord = {
  userId: string;
  schoolId: string;
  role: string;
  status: string;
};

export type SchoolTenantMembershipRepository = {
  findActiveSchoolMembershipByUserAndSchoolId(userId: string, schoolId: string, now: Date): Promise<SchoolTenantMembershipRecord | null>;
};

export type ResolveRequestContextOptions = {
  purpose?: RequestPurpose;
  now?: Date;
  schoolTenantMembershipRepository?: SchoolTenantMembershipRepository;
};

export async function resolveRequestContextFromRequest(
  request: Request,
  repository: AuthSessionRepository,
  options: ResolveRequestContextOptions = {},
): Promise<RequestContext> {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const guestSessionId = verifyGuestSession(cookies[GUEST_SESSION_COOKIE_NAME], options.now ?? new Date());
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return createRequestContext({
      requestId,
      guestSessionId,
      purpose: options.purpose,
    });
  }

  const session = await repository.findActiveSessionByTokenHash(hashSessionToken(sessionToken), options.now ?? new Date());

  if (!session || !isUsableSession(session, options.now ?? new Date())) {
    return createRequestContext({
      requestId,
      guestSessionId,
      purpose: options.purpose,
    });
  }

  const activeRole = parseRole(session.activeRole);
  if ((activeRole === "cuac_ops" || activeRole === "cuac_admin")
    && !await resolveVerifiedCuacStaffAccess(session.userId, activeRole, repository, options.now ?? new Date())) {
    return createRequestContext({
      requestId,
      guestSessionId,
      purpose: options.purpose,
    });
  }
  const tenantSchoolId = await resolveVerifiedTenantSchoolId(session, activeRole, options);

  return createRequestContext({
    requestId,
    actorUserId: session.userId,
    guestSessionId,
    selectedSurface: parseSurface(session.selectedSurface),
    activeRole,
    tenantSchoolId,
    authStrength: parseAuthStrength(session.authStrength),
    purpose: options.purpose ?? defaultPurposeForRole(activeRole),
  });
}

async function resolveVerifiedCuacStaffAccess(
  userId: string,
  role: "cuac_ops" | "cuac_admin",
  repository: AuthSessionRepository,
  now: Date,
): Promise<boolean> {
  if (!repository.findActiveCuacStaffAccessGrantByUserAndRole) return false;
  const grant = await repository.findActiveCuacStaffAccessGrantByUserAndRole(userId, role, now);
  return grant?.userId === userId && grant.role === role && grant.status === "approved"
    && grant.expiresAt.getTime() > now.getTime();
}

export function hashSessionToken(token: string): string {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  if (cookieHeader.length > 8192) return {};
  const cookies = new Map<string, string>();
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    let name: string | undefined;
    try {
      name = decodeURIComponent(part.slice(0, separator).trim());
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) continue;
      if (seen.has(name)) duplicates.add(name);
      seen.add(name);
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      if (/\p{Cc}/u.test(value)) { duplicates.add(name); continue; }
      cookies.set(name, value);
    } catch {
      // Reject malformed authority values without disrupting unrelated valid cookies.
      if (name) duplicates.add(name);
    }
  }
  for (const name of duplicates) cookies.delete(name);
  return Object.fromEntries(cookies);
}

function isUsableSession(session: AuthSessionRecord, now: Date): boolean {
  return session.accountStatus === "active" && !session.revokedAt && session.expiresAt.getTime() > now.getTime();
}

function parseRole(role: string): CuacRole {
  return ["guest", "student", "school_staff", "cuac_ops", "cuac_admin"].includes(role) ? (role as CuacRole) : "guest";
}

function parseSurface(surface: string): CuacSurface {
  return ["public", "student", "school", "ops"].includes(surface) ? (surface as CuacSurface) : "public";
}

function parseAuthStrength(authStrength: string): AuthStrength {
  return ["guest", "session", "step_up"].includes(authStrength) ? (authStrength as AuthStrength) : "guest";
}

async function resolveVerifiedTenantSchoolId(
  session: AuthSessionRecord,
  activeRole: CuacRole,
  options: ResolveRequestContextOptions,
): Promise<string | null> {
  if (activeRole !== "school_staff") {
    return null;
  }

  if (!session.tenantSchoolId) {
    return null;
  }

  if (!options.schoolTenantMembershipRepository) {
    return null;
  }

  const membership = await options.schoolTenantMembershipRepository.findActiveSchoolMembershipByUserAndSchoolId(
    session.userId,
    session.tenantSchoolId,
    options.now ?? new Date(),
  );

  return membership?.status === "active" && membership.userId === session.userId &&
    membership.schoolId === session.tenantSchoolId &&
    ["admissions", "counselor", "viewer", "school_admin"].includes(membership.role)
    ? membership.schoolId
    : null;
}

function defaultPurposeForRole(role: CuacRole): RequestPurpose {
  switch (role) {
    case "student":
      return "student_action";
    case "school_staff":
      return "school_review";
    case "cuac_ops":
    case "cuac_admin":
      return "ops_support";
    case "guest":
    default:
      return "public_catalog_read";
  }
}
