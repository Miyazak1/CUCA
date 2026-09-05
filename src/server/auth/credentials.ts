import { randomBytes, randomUUID, createHash } from "node:crypto";
import { badRequest, forbidden } from "../shared/errors.ts";
import { inputEnum, inputUuid } from "../shared/input.ts";
import { authDisplayName, authEmail, authInput, authOptionalText, authPassword, authToken } from "./input.ts";
import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { createRequestContext } from "../shared/request-context.ts";
import { passwordHasher, type PasswordHasher } from "./password-hasher.ts";
export { hashPassword, verifyPassword, verifyPasswordForLogin } from "./password-hasher.ts";

export type PasswordIdentityRecord = {
  userId: string;
  emailNormalized: string;
  passwordHash: string | null;
  accountStatus: string;
};

export type CreateStudentAccountInput = {
  email: string;
  emailNormalized: string;
  displayName: string | null;
  passwordHash: string;
  now: Date;
};

export type CreateAuthSessionInput = {
  userId: string;
  expectedPasswordHash: string;
  upgradedPasswordHash?: string;
  sessionTokenHash: string;
  requestedSurface: AuthSignInSurface;
  requestedSchoolId: string | null;
  authStrength: "session";
  expiresAt: Date;
  ipHash: string | null;
  userAgentHash: string | null;
  now: Date;
};

export type AuthSignInSurface = "student" | "school_staff" | "cuac_internal";
export type AuthSessionSurface = "student" | "school" | "ops";
export type AuthSessionRole = "student" | "school_staff" | "cuac_ops" | "cuac_admin";

export type CreatedAuthSession = {
  sessionId: string;
  selectedSurface: AuthSessionSurface;
  activeRole: AuthSessionRole;
  tenantSchoolId: string | null;
};

export type RevokeAuthSessionInput = {
  sessionTokenHash: string;
  now: Date;
};

export type RevokedAuthSessionResult = { revoked: false } | {
  revoked: true;
  sessionId: string;
  userId: string;
  activeRole: string;
  tenantSchoolId: string | null;
};

export type SessionReauthenticationTarget = {
  sessionId: string;
  userId: string;
  passwordHash: string;
  expiresAt: Date;
  selectedSurface: AuthSessionSurface;
  activeRole: AuthSessionRole;
  tenantSchoolId: string | null;
};

export type ActivateSessionStepUpInput = SessionReauthenticationTarget & {
  sessionTokenHash: string;
  stepUpTtlMs: number;
};

export type AuthCredentialsRepository = {
  findPasswordIdentityByEmailNormalized(emailNormalized: string): Promise<PasswordIdentityRecord | null>;
  createStudentAccount(input: CreateStudentAccountInput): Promise<{ userId: string }>;
  createSession(input: CreateAuthSessionInput): Promise<CreatedAuthSession>;
  revokeSessionByTokenHash(input: RevokeAuthSessionInput): Promise<RevokedAuthSessionResult>;
  findSessionReauthenticationTarget(sessionTokenHash: string): Promise<SessionReauthenticationTarget | null>;
  activateSessionStepUp(input: ActivateSessionStepUpInput): Promise<{ sessionId: string; stepUpExpiresAt: Date }>;
};

export type AuthCredentialsResult = {
  userId: string;
  sessionId: string;
  sessionToken: string;
  expiresAt: Date;
  selectedSurface: AuthSessionSurface;
  activeRole: AuthSessionRole;
  tenantSchoolId: string | null;
};

export type AuthCredentialsServiceOptions = {
  now?: Date;
  sessionTtlMs?: number;
  auditSink?: AuditSink | null;
  passwordHasher?: PasswordHasher;
};

const defaultSessionTtlMs = 1000 * 60 * 60 * 24 * 30;
export const AUTH_STEP_UP_TTL_MS = 1000 * 60 * 10;

export class AuthCredentialsService {
  private readonly repository: AuthCredentialsRepository;
  private readonly now: () => Date;
  private readonly sessionTtlMs: number;
  private readonly auditSink: AuditSink | null;
  private readonly passwordHasher: PasswordHasher;

  constructor(repository: AuthCredentialsRepository, options: AuthCredentialsServiceOptions = {}) {
    this.repository = repository;
    this.now = () => options.now ?? new Date();
    this.sessionTtlMs = options.sessionTtlMs ?? defaultSessionTtlMs;
    this.auditSink = options.auditSink ?? null;
    this.passwordHasher = options.passwordHasher ?? passwordHasher;
  }

  async registerStudent(input: { email: unknown; password: unknown; displayName?: unknown; userAgent?: string | null; ip?: string | null }, requestId: string = randomUUID()): Promise<AuthCredentialsResult> {
    const value = authInput(input, ["email", "password", "displayName", "userAgent", "ip"]);
    const email = authEmail(value.email);
    const password = authPassword(value.password, true);
    const displayName = authDisplayName(value.displayName);
    const metadata = sessionMetadata(value);
    const existing = await this.repository.findPasswordIdentityByEmailNormalized(email.normalized);

    if (existing) {
      throw forbidden("An account already exists for this email.");
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const now = this.now();
    const account = await this.repository.createStudentAccount({
      email: email.original,
      emailNormalized: email.normalized,
      displayName,
      passwordHash,
      now,
    });

    const result = await this.issueSession(account.userId, metadata, now, passwordHash);
    await this.recordAudit(requestId, "auth.register", { userId: result.userId, activeRole: "student", tenantSchoolId: null }, "user", result.userId, { sessionId: result.sessionId });
    return result;
  }

  async createStudentSession(input: { email: unknown; password: unknown; selectedSurface?: unknown; schoolId?: unknown; userAgent?: string | null; ip?: string | null }, requestId: string = randomUUID()): Promise<AuthCredentialsResult> {
    const value = authInput(input, ["email", "password", "selectedSurface", "schoolId", "userAgent", "ip"]);
    const email = authEmail(value.email);
    const password = authPassword(value.password, false);
    const requestedSurface = authSignInSurface(value.selectedSurface);
    const requestedSchoolId = authSignInSchoolId(value.schoolId, requestedSurface);
    const metadata = sessionMetadata(value);
    const identity = await this.repository.findPasswordIdentityByEmailNormalized(email.normalized);

    const verification = await this.passwordHasher.verifyForLogin(password, identity?.passwordHash ?? null);
    if (!identity || identity.accountStatus !== "active" || !identity.passwordHash || !verification.valid) {
      throw forbidden("Invalid email or password.");
    }

    const result = await this.issueSession(identity.userId, metadata, this.now(), identity.passwordHash, {
      requestedSurface, requestedSchoolId,
    }, verification.upgradedHash);
    await this.recordAudit(requestId, "auth.login", {
      userId: result.userId, activeRole: result.activeRole, tenantSchoolId: result.tenantSchoolId,
    }, "auth_session", result.sessionId, {
      selectedSurface: result.selectedSurface,
      ...(verification.upgradedHash ? { credentialUpgrade: "scrypt_v2" } : {}),
    });
    return result;
  }

  async revokeSession(sessionToken: string | null | undefined, requestId: string = randomUUID()): Promise<{ revoked: boolean }> {
    if (!sessionToken) {
      return { revoked: false };
    }

    const result = await this.repository.revokeSessionByTokenHash({
      sessionTokenHash: sha256(sessionToken),
      now: this.now(),
    });
    if (result.revoked) await this.recordAudit(requestId, "auth.logout", result, "auth_session", result.sessionId);
    return { revoked: result.revoked };
  }

  async stepUpSession(input: { sessionToken: unknown; password: unknown }, requestId: string = randomUUID()) {
    const value = authInput(input, ["sessionToken", "password"]);
    const sessionToken = authToken(value.sessionToken);
    const password = authPassword(value.password, false);
    const sessionTokenHash = sha256(sessionToken);
    const target = await this.repository.findSessionReauthenticationTarget(sessionTokenHash);
    const verification = await this.passwordHasher.verifyForLogin(password, target?.passwordHash ?? null);
    if (!target || !verification.valid) {
      throw forbidden("Session or password is invalid.");
    }
    const activated = await this.repository.activateSessionStepUp({
      ...target,
      sessionTokenHash,
      stepUpTtlMs: AUTH_STEP_UP_TTL_MS,
    });
    await this.recordAudit(requestId, "auth.step_up", {
      userId: target.userId, activeRole: target.activeRole, tenantSchoolId: target.tenantSchoolId,
    }, "auth_session", activated.sessionId, { stepUpExpiresAt: activated.stepUpExpiresAt.toISOString() });
    return { userId: target.userId, selectedSurface: target.selectedSurface, activeRole: target.activeRole,
      tenantSchoolId: target.tenantSchoolId, ...activated };
  }

  private async recordAudit(
    requestId: string,
    action: string,
    actor: { userId: string; activeRole: string; tenantSchoolId: string | null },
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown> = {},
  ) {
    if (!this.auditSink) return;
    const event = buildAuditEvent(createRequestContext({ requestId }), {
      action, resourceType, resourceId, allowed: true, policyDecisionId: null,
      dataClasses: ["secret"], metadata,
    });
    await this.auditSink.record({ ...event, actorUserId: actor.userId, activeRole: actor.activeRole, tenantSchoolId: actor.tenantSchoolId });
  }

  private async issueSession(
    userId: string,
    input: { userAgent?: string | null; ip?: string | null },
    now: Date,
    expectedPasswordHash: string,
    authority: { requestedSurface: AuthSignInSurface; requestedSchoolId: string | null } = {
      requestedSurface: "student", requestedSchoolId: null,
    },
    upgradedPasswordHash?: string | null,
  ): Promise<AuthCredentialsResult> {
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);
    const session = await this.repository.createSession({
      userId,
      expectedPasswordHash,
      sessionTokenHash: sha256(sessionToken),
      requestedSurface: authority.requestedSurface,
      requestedSchoolId: authority.requestedSchoolId,
      authStrength: "session",
      expiresAt,
      ipHash: input.ip ? sha256(input.ip) : null,
      userAgentHash: input.userAgent ? sha256(input.userAgent) : null,
      now,
      ...(upgradedPasswordHash ? { upgradedPasswordHash } : {}),
    });

    return {
      userId,
      ...session,
      sessionToken,
      expiresAt,
    };
  }
}

function authSignInSurface(value: unknown): AuthSignInSurface {
  if (value === undefined || value === null || value === "") return "student";
  return inputEnum(value, "Selected surface", ["student", "school_staff", "cuac_internal"] as const);
}

function authSignInSchoolId(value: unknown, surface: AuthSignInSurface): string | null {
  if (surface === "school_staff") {
    if (value === undefined || value === null || value === "") throw badRequest("School ID is required for school staff sign-in.");
    return inputUuid(value, "School ID");
  }
  if (value !== undefined && value !== null && value !== "") throw badRequest("School ID is only supported for school staff sign-in.");
  return null;
}

function sessionMetadata(value: Record<string, unknown>) {
  return {
    userAgent: authOptionalText(value.userAgent, "User agent", 2048),
    ip: authOptionalText(value.ip, "IP address", 128),
  };
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
