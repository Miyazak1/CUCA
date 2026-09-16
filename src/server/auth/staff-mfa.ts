import { createHash, randomBytes, randomUUID } from "node:crypto";
import { badRequest, forbidden } from "../shared/errors.ts";
import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { createRequestContext } from "../shared/request-context.ts";
import type {
  AuthCredentialsRepository,
  AuthCredentialsResult,
  AuthSessionRole,
  AuthSessionSurface,
} from "./credentials.ts";
import {
  buildTotpUri,
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  recoveryCodeHash,
  verifyTotpCode,
  type MfaEncryptedSecret,
  type MfaKeyring,
} from "./mfa-crypto.ts";
import { authToken } from "./input.ts";

export const STAFF_MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const STAFF_MFA_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type StaffMfaAuthority = {
  selectedSurface: Exclude<AuthSessionSurface, "student">;
  activeRole: Exclude<AuthSessionRole, "student">;
  tenantSchoolId: string | null;
};

export type StaffMfaFactorRecord = MfaEncryptedSecret & {
  factorId: string;
  userId: string;
  status: "pending" | "active" | "disabled";
  lastUsedCounter: number | null;
};

export type StaffMfaChallengeRecord = StaffMfaAuthority & {
  challengeId: string;
  userId: string;
  email: string;
  passwordHash: string;
  ipHash: string | null;
  userAgentHash: string | null;
  expiresAt: Date;
  failedAttempts: number;
};

export type StaffMfaRepository = {
  findMfaFactor(userId: string): Promise<StaffMfaFactorRecord | null>;
  createMfaLoginChallenge(input: StaffMfaAuthority & {
    userId: string;
    challengeTokenHash: string;
    passwordHashFingerprint: string;
    ipHash: string | null;
    userAgentHash: string | null;
    now: Date;
    expiresAt: Date;
  }): Promise<{ challengeId: string }>;
  findUsableMfaChallengeForUpdate(challengeTokenHash: string, now: Date): Promise<StaffMfaChallengeRecord | null>;
  upsertPendingMfaFactor(input: MfaEncryptedSecret & { userId: string; now: Date }): Promise<StaffMfaFactorRecord>;
  activatePendingMfaFactor(input: {
    factorId: string;
    userId: string;
    counter: number;
    recoveryCodeHashes: string[];
    now: Date;
  }): Promise<boolean>;
  consumeActiveMfaTotp(input: {
    factorId: string;
    userId: string;
    expectedLastUsedCounter: number | null;
    counter: number;
    now: Date;
  }): Promise<boolean>;
  consumeMfaRecoveryCode(input: { factorId: string; codeHashes: string[]; now: Date }): Promise<boolean>;
  consumeMfaChallenge(challengeId: string, now: Date): Promise<boolean>;
  recordMfaChallengeFailure(challengeId: string): Promise<void>;
};

export type StaffMfaChallengeResult = StaffMfaAuthority & {
  mfaRequired: true;
  enrollmentRequired: boolean;
  challengeToken: string;
  expiresAt: Date;
};

export type StaffMfaVerificationFailure = { mfaVerificationFailed: true };

export class StaffMfaService {
  private readonly repository: StaffMfaRepository & AuthCredentialsRepository;
  private readonly keyring: MfaKeyring;
  private readonly options: { now?: Date; auditSink?: AuditSink | null };

  constructor(
    repository: StaffMfaRepository & AuthCredentialsRepository,
    keyring: MfaKeyring,
    options: { now?: Date; auditSink?: AuditSink | null } = {},
  ) {
    this.repository = repository;
    this.keyring = keyring;
    this.options = options;
  }

  async beginLogin(input: StaffMfaAuthority & {
    userId: string;
    passwordHash: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<StaffMfaChallengeResult> {
    const now = this.now();
    const challengeToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + STAFF_MFA_CHALLENGE_TTL_MS);
    const factor = await this.repository.findMfaFactor(input.userId);
    await this.repository.createMfaLoginChallenge({
      userId: input.userId,
      selectedSurface: input.selectedSurface,
      activeRole: input.activeRole,
      tenantSchoolId: input.tenantSchoolId,
      challengeTokenHash: sha256(challengeToken),
      passwordHashFingerprint: sha256(input.passwordHash),
      ipHash: input.ip ? sha256(input.ip) : null,
      userAgentHash: input.userAgent ? sha256(input.userAgent) : null,
      now,
      expiresAt,
    });
    return {
      mfaRequired: true,
      enrollmentRequired: factor?.status !== "active",
      challengeToken,
      expiresAt,
      selectedSurface: input.selectedSurface,
      activeRole: input.activeRole,
      tenantSchoolId: input.tenantSchoolId,
    };
  }

  async startEnrollment(input: { challengeToken: unknown }) {
    const challenge = await this.challenge(input.challengeToken);
    const existing = await this.repository.findMfaFactor(challenge.userId);
    if (existing?.status === "active") throw forbidden("MFA is already enrolled for this account.");
    const secret = generateTotpSecret();
    const factor = await this.repository.upsertPendingMfaFactor({
      userId: challenge.userId,
      ...encryptMfaSecret(secret, this.keyring),
      now: this.now(),
    });
    return {
      enrollmentRequired: true as const,
      factorId: factor.factorId,
      secret,
      otpauthUri: buildTotpUri({ secret, email: challenge.email }),
      expiresAt: challenge.expiresAt,
    };
  }

  async completeLogin(
    input: { challengeToken: unknown; code?: unknown; recoveryCode?: unknown },
    requestId: string = randomUUID(),
  ): Promise<(AuthCredentialsResult & { recoveryCodes?: string[] }) | StaffMfaVerificationFailure> {
    const challenge = await this.challenge(input.challengeToken);
    const factor = await this.repository.findMfaFactor(challenge.userId);
    if (!factor || factor.status === "disabled") throw forbidden("MFA enrollment is required.");
    const now = this.now();
    let recoveryCodes: string[] | undefined;
    let verified = false;

    if (input.recoveryCode !== undefined) {
      if (factor.status !== "active" || input.code !== undefined) throw badRequest("Provide exactly one MFA verification method.");
      const code = recoveryCode(input.recoveryCode);
      verified = await this.repository.consumeMfaRecoveryCode({
        factorId: factor.factorId,
        codeHashes: [...this.keyring.keys.keys()].map(keyId => recoveryCodeHashForKey(code, this.keyring, keyId)),
        now,
      });
    } else {
      const check = verifyTotpCode(decryptMfaSecret(factor, this.keyring), input.code, now, factor.lastUsedCounter);
      if (check.valid && check.counter !== null) {
        if (factor.status === "pending") {
          recoveryCodes = createRecoveryCodes();
          verified = await this.repository.activatePendingMfaFactor({
            factorId: factor.factorId,
            userId: challenge.userId,
            counter: check.counter,
            recoveryCodeHashes: recoveryCodes.map(code => recoveryCodeHash(code, this.keyring)),
            now,
          });
        } else {
          verified = await this.repository.consumeActiveMfaTotp({
            factorId: factor.factorId,
            userId: challenge.userId,
            expectedLastUsedCounter: factor.lastUsedCounter,
            counter: check.counter,
            now,
          });
        }
      }
    }

    if (!verified) {
      await this.repository.recordMfaChallengeFailure(challenge.challengeId);
      return { mfaVerificationFailed: true };
    }
    if (!await this.repository.consumeMfaChallenge(challenge.challengeId, now)) {
      throw forbidden("MFA challenge is no longer valid.");
    }
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + STAFF_MFA_SESSION_TTL_MS);
    const session = await this.repository.createSession({
      userId: challenge.userId,
      expectedPasswordHash: challenge.passwordHash,
      sessionTokenHash: sha256(sessionToken),
      requestedSurface: challenge.selectedSurface === "school" ? "school_staff" : "cuac_internal",
      requestedSchoolId: challenge.tenantSchoolId,
      authStrength: "session",
      expiresAt,
      ipHash: challenge.ipHash,
      userAgentHash: challenge.userAgentHash,
      now,
    });
    await this.recordAudit(requestId, "auth.mfa_login", challenge, "auth_session", session.sessionId, {
      factorType: "totp",
      recoveryCodeUsed: input.recoveryCode !== undefined,
      enrollmentCompleted: Boolean(recoveryCodes),
    });
    return { userId: challenge.userId, ...session, sessionToken, expiresAt, ...(recoveryCodes ? { recoveryCodes } : {}) };
  }

  async verifyStepUp(input: { userId: string; code?: unknown; recoveryCode?: unknown }): Promise<void> {
    const factor = await this.repository.findMfaFactor(input.userId);
    if (!factor || factor.status !== "active") throw forbidden("Active MFA enrollment is required.");
    const now = this.now();
    let verified = false;
    if (input.recoveryCode !== undefined) {
      if (input.code !== undefined) throw badRequest("Provide exactly one MFA verification method.");
      const code = recoveryCode(input.recoveryCode);
      verified = await this.repository.consumeMfaRecoveryCode({
        factorId: factor.factorId,
        codeHashes: [...this.keyring.keys.keys()].map(keyId => recoveryCodeHashForKey(code, this.keyring, keyId)),
        now,
      });
    } else {
      const check = verifyTotpCode(decryptMfaSecret(factor, this.keyring), input.code, now, factor.lastUsedCounter);
      if (check.valid && check.counter !== null) verified = await this.repository.consumeActiveMfaTotp({
        factorId: factor.factorId,
        userId: input.userId,
        expectedLastUsedCounter: factor.lastUsedCounter,
        counter: check.counter,
        now,
      });
    }
    if (!verified) throw forbidden("MFA verification failed.");
  }

  private async challenge(value: unknown): Promise<StaffMfaChallengeRecord> {
    const token = authToken(value);
    const challenge = await this.repository.findUsableMfaChallengeForUpdate(sha256(token), this.now());
    if (!challenge) throw forbidden("MFA challenge is invalid or expired.");
    return challenge;
  }

  private now(): Date {
    return this.options.now ?? new Date();
  }

  private async recordAudit(
    requestId: string,
    action: string,
    actor: StaffMfaChallengeRecord,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    if (!this.options.auditSink) return;
    const event = buildAuditEvent(createRequestContext({ requestId }), {
      action, resourceType, resourceId, allowed: true, policyDecisionId: null,
      dataClasses: ["secret"], metadata,
    });
    await this.options.auditSink.record({ ...event, actorUserId: actor.userId,
      activeRole: actor.activeRole, tenantSchoolId: actor.tenantSchoolId });
  }
}

function recoveryCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){3}$/i.test(value)) {
    throw badRequest("Recovery code format is invalid.");
  }
  return value.toUpperCase();
}

function recoveryCodeHashForKey(code: string, keyring: MfaKeyring, keyId: string): string {
  return recoveryCodeHash(code, { activeKeyId: keyId, keys: keyring.keys });
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
