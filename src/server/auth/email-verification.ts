import { createHash, randomBytes } from "node:crypto";
import { inputUuid } from "../shared/input.ts";
import { authToken } from "./input.ts";
import { buildAuditEvent, type AuditEvent } from "../audit/audit.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";

export type EmailVerificationTarget = {
  userId: string;
  emailNormalized: string;
  emailVerifiedAt: Date | null;
  accountStatus: string;
};

export type CreateEmailVerificationChallengeInput = {
  userId: string;
  emailNormalized: string;
  verificationTokenHash: string;
  expiresAt: Date;
  now: Date;
};

export type EmailVerificationChallengeRecord = {
  id: string;
  userId: string;
  emailNormalized: string;
  status: "pending" | "verified" | "expired" | "revoked";
  expiresAt: Date;
  verifiedAt: Date | null;
};

export type EmailVerificationRepository = {
  findVerificationTargetByUserId(userId: string): Promise<EmailVerificationTarget | null>;
  createEmailVerificationChallenge(input: CreateEmailVerificationChallengeInput): Promise<{ challengeId: string } | null>;
  findActiveEmailVerificationChallenge(input: { challengeId: string; verificationTokenHash: string; now: Date }): Promise<EmailVerificationChallengeRecord | null>;
  markEmailVerified(input: { challengeId: string; userId: string; verificationTokenHash: string; now: Date }): Promise<{ verified: boolean }>;
};

export type EmailVerificationDeliverySink = {
  // Database enqueue only, on the same transaction as the challenge and audit.
  enqueue(input: { challengeId: string; userId: string; emailNormalized: string; verificationToken: string; expiresAt: Date }): Promise<void>;
};

export type EmailVerificationAuditSink = {
  record(event: AuditEvent): Promise<void>;
};

export class EmailVerificationService {
  private readonly repository: EmailVerificationRepository;
  private readonly deliverySink: EmailVerificationDeliverySink | null;
  private readonly auditSink: EmailVerificationAuditSink | null;
  private readonly now: () => Date;
  private readonly challengeTtlMs: number;

  constructor(
    repository: EmailVerificationRepository,
    options: {
      deliverySink?: EmailVerificationDeliverySink | null;
      auditSink?: EmailVerificationAuditSink | null;
      now?: Date;
      challengeTtlMs?: number;
    } = {},
  ) {
    this.repository = repository;
    this.deliverySink = options.deliverySink ?? null;
    this.auditSink = options.auditSink ?? null;
    this.now = () => options.now ?? new Date();
    this.challengeTtlMs = options.challengeTtlMs ?? 24 * 60 * 60 * 1000;
  }

  async requestVerification(context: RequestContext): Promise<{ status: "already_verified" | "pending"; challengeId: string | null; expiresAt: Date | null; deliveryStatus: "deferred" | "queued" | "not_required" }> {
    if (!context.actorUserId || context.activeRole === "guest") {
      throw forbidden("Email verification request requires an authenticated session.");
    }

    const target = await this.repository.findVerificationTargetByUserId(context.actorUserId);

    if (!target || target.accountStatus !== "active") {
      throw forbidden("Email verification request requires an active account.");
    }

    if (target.emailVerifiedAt) {
      return { status: "already_verified", challengeId: null, expiresAt: null, deliveryStatus: "not_required" };
    }

    const now = this.now();
    const verificationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.challengeTtlMs);
    const challenge = await this.repository.createEmailVerificationChallenge({
      userId: target.userId,
      emailNormalized: target.emailNormalized,
      verificationTokenHash: sha256(verificationToken),
      expiresAt,
      now,
    });

    if (!challenge) throw forbidden("Email verification request is no longer available.");

    if (this.deliverySink) {
      await this.deliverySink.enqueue({
        challengeId: challenge.challengeId,
        userId: target.userId,
        emailNormalized: target.emailNormalized,
        verificationToken,
        expiresAt,
      });
    }

    await this.recordAudit(context, {
      action: "auth.email_verification.request",
      resourceType: "email_verification_challenge",
      resourceId: challenge.challengeId,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["student_pii"],
      metadata: {
        emailDomain: target.emailNormalized.split("@")[1] ?? null,
        deliveryStatus: this.deliverySink ? "queued" : "deferred",
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      status: "pending",
      challengeId: challenge.challengeId,
      expiresAt,
      deliveryStatus: this.deliverySink ? "queued" : "deferred",
    };
  }

  async verifyEmail(
    context: RequestContext,
    challengeId: unknown,
    verificationToken: unknown,
  ): Promise<{ status: "verified"; challengeId: string }> {
    const id = inputUuid(challengeId, "Email verification challenge id");
    const token = authToken(verificationToken);
    const now = this.now();
    const challenge = await this.repository.findActiveEmailVerificationChallenge({
      challengeId: id,
      verificationTokenHash: sha256(token),
      now,
    });

    if (!challenge) {
      throw badRequest("Email verification challenge is not available.");
    }

    const result = await this.repository.markEmailVerified({
      challengeId: challenge.id,
      userId: challenge.userId,
      verificationTokenHash: sha256(token),
      now,
    });

    if (!result.verified) {
      throw badRequest("Email verification challenge has already been consumed.");
    }

    await this.recordAudit(context, {
      action: "auth.email_verification.verify",
      resourceType: "email_verification_challenge",
      resourceId: challenge.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["student_pii"],
      metadata: {
        emailDomain: challenge.emailNormalized.split("@")[1] ?? null,
      },
    });

    return { status: "verified", challengeId: challenge.id };
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
