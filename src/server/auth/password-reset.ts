import { createHash, randomBytes } from "node:crypto";
import { buildAuditEvent, type AuditEvent } from "../audit/audit.ts";
import { badRequest } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { passwordHasher, type PasswordHasher } from "./password-hasher.ts";
import { authEmail, authInput, authPassword, authToken } from "./input.ts";
import { inputUuid } from "../shared/input.ts";

export type PasswordResetTarget = {
  userId: string;
  emailNormalized: string;
  accountStatus: string;
  hasPasswordIdentity: boolean;
};

export type CreatePasswordResetChallengeInput = {
  userId: string;
  emailNormalized: string;
  resetTokenHash: string;
  expiresAt: Date;
  now: Date;
};

export type PasswordResetChallengeRecord = {
  id: string;
  userId: string;
  emailNormalized: string;
  status: "pending" | "consumed" | "expired" | "revoked";
  expiresAt: Date;
  consumedAt: Date | null;
};

export type PasswordResetRepository = {
  findPasswordResetTargetByEmailNormalized(emailNormalized: string): Promise<PasswordResetTarget | null>;
  createPasswordResetChallenge(input: CreatePasswordResetChallengeInput): Promise<{ challengeId: string } | null>;
  findActivePasswordResetChallenge(input: { challengeId: string; resetTokenHash: string; now: Date }): Promise<PasswordResetChallengeRecord | null>;
  consumePasswordReset(input: { challengeId: string; userId: string; resetTokenHash: string; passwordHash: string; now: Date }): Promise<{ reset: boolean; revokedSessionCount: number }>;
};

export type PasswordResetDeliverySink = {
  // Database enqueue only, on the same transaction as the challenge and audit.
  enqueue(input: { challengeId: string; userId: string; emailNormalized: string; resetToken: string; expiresAt: Date }): Promise<void>;
};

export type PasswordResetAuditSink = {
  record(event: AuditEvent): Promise<void>;
};

export class PasswordResetService {
  private readonly repository: PasswordResetRepository;
  private readonly deliverySink: PasswordResetDeliverySink | null;
  private readonly auditSink: PasswordResetAuditSink | null;
  private readonly now: () => Date;
  private readonly challengeTtlMs: number;
  private readonly passwordHasher: PasswordHasher;

  constructor(
    repository: PasswordResetRepository,
    options: {
      deliverySink?: PasswordResetDeliverySink | null;
      auditSink?: PasswordResetAuditSink | null;
      now?: Date;
      challengeTtlMs?: number;
      passwordHasher?: PasswordHasher;
    } = {},
  ) {
    this.repository = repository;
    this.deliverySink = options.deliverySink ?? null;
    this.auditSink = options.auditSink ?? null;
    this.now = () => options.now ?? new Date();
    this.challengeTtlMs = options.challengeTtlMs ?? 30 * 60 * 1000;
    this.passwordHasher = options.passwordHasher ?? passwordHasher;
  }

  async requestReset(context: RequestContext, input: { email: unknown }): Promise<{ status: "accepted"; deliveryStatus: "deferred" | "queued" | "not_applicable" }> {
    const emailNormalized = authEmail(authInput(input, ["email"]).email).normalized;
    const target = await this.repository.findPasswordResetTargetByEmailNormalized(emailNormalized);

    if (!target || target.accountStatus !== "active" || !target.hasPasswordIdentity) {
      await this.recordRequestAudit(context, emailNormalized, "not_applicable");
      return { status: "accepted", deliveryStatus: "not_applicable" };
    }

    const now = this.now();
    const resetToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.challengeTtlMs);
    const challenge = await this.repository.createPasswordResetChallenge({
      userId: target.userId,
      emailNormalized: target.emailNormalized,
      resetTokenHash: sha256(resetToken),
      expiresAt,
      now,
    });

    if (!challenge) {
      await this.recordRequestAudit(context, emailNormalized, "not_applicable");
      return { status: "accepted", deliveryStatus: "not_applicable" };
    }

    if (this.deliverySink) {
      await this.deliverySink.enqueue({
        challengeId: challenge.challengeId,
        userId: target.userId,
        emailNormalized: target.emailNormalized,
        resetToken,
        expiresAt,
      });
    }

    await this.recordRequestAudit(context, target.emailNormalized, this.deliverySink ? "queued" : "deferred", challenge.challengeId, expiresAt);
    return { status: "accepted", deliveryStatus: this.deliverySink ? "queued" : "deferred" };
  }

  async resetPassword(
    context: RequestContext,
    challengeId: unknown,
    resetToken: unknown,
    newPassword: unknown,
  ): Promise<{ status: "reset"; challengeId: string; revokedSessionCount: number }> {
    const id = inputUuid(challengeId, "Password reset challenge id");
    const token = authToken(resetToken);
    const password = authPassword(newPassword, true);
    const now = this.now();
    const challenge = await this.repository.findActivePasswordResetChallenge({
      challengeId: id,
      resetTokenHash: sha256(token),
      now,
    });

    if (!challenge) {
      throw badRequest("Password reset challenge is not available.");
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const reset = await this.repository.consumePasswordReset({
      challengeId: challenge.id,
      userId: challenge.userId,
      resetTokenHash: sha256(token),
      passwordHash,
      now: this.now(),
    });

    if (!reset.reset) {
      throw badRequest("Password reset challenge has already been consumed.");
    }

    await this.recordAudit(context, {
      action: "auth.password_reset.consume",
      resourceType: "password_reset_challenge",
      resourceId: challenge.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["secret"],
      metadata: {
        emailDomain: challenge.emailNormalized.split("@")[1] ?? null,
        revokedSessionCount: reset.revokedSessionCount,
      },
    });

    return { status: "reset", challengeId: challenge.id, revokedSessionCount: reset.revokedSessionCount };
  }

  private async recordRequestAudit(
    context: RequestContext,
    emailNormalized: string,
    deliveryStatus: "deferred" | "queued" | "not_applicable",
    challengeId: string | null = null,
    expiresAt: Date | null = null,
  ) {
    await this.recordAudit(context, {
      action: "auth.password_reset.request",
      resourceType: "password_reset_challenge",
      resourceId: challengeId,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["secret"],
      metadata: {
        emailDomain: emailNormalized.split("@")[1] ?? null,
        deliveryStatus,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    });
  }

  private async recordAudit(
    context: RequestContext,
    input: Omit<AuditEvent, "requestId" | "actorUserId" | "activeRole" | "tenantSchoolId" | "metadata"> & { metadata?: unknown },
  ) {
    if (!this.auditSink) {
      return;
    }

    await this.auditSink.record(buildAuditEvent(context, input));
  }
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
