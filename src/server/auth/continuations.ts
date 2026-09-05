import { createHash, randomBytes } from "node:crypto";
import { buildAuditEvent, type AuditEvent } from "../audit/audit.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { inputRecord, inputText, inputUuid } from "../shared/input.ts";
import { authInput, authOptionalText, authToken } from "./input.ts";

export type SignInContinuationRole = "student" | "school_staff" | "cuac_ops" | "cuac_admin";

export type CreateSignInContinuationInput = {
  targetRoute: unknown;
  actionKey: unknown;
  requiredRole?: unknown;
  payloadPreview?: unknown;
  deviceFingerprint?: string | null;
};

export type CreateSignInContinuationRepositoryInput = {
  continuationTokenHash: string;
  guestSessionId: string;
  targetRoute: string;
  actionKey: string;
  requiredRole: SignInContinuationRole | null;
  tenantSchoolId: string | null;
  payloadPreview: Record<string, unknown>;
  deviceFingerprintHash: string | null;
  expiresAt: Date;
  now: Date;
};

export type SignInContinuationRecord = {
  id: string;
  guestSessionId: string | null;
  targetRoute: string;
  actionKey: string;
  requiredRole: SignInContinuationRole | null;
  tenantSchoolId: string | null;
  payloadPreview: Record<string, unknown>;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type SignInContinuationRepository = {
  createContinuation(input: CreateSignInContinuationRepositoryInput): Promise<{ continuationId: string }>;
  findActiveContinuation(input: { continuationId: string; continuationTokenHash: string; now: Date }): Promise<SignInContinuationRecord | null>;
  markContinuationConsumed(input: { continuationId: string; continuationTokenHash: string; consumedByUserId: string; guestSessionId: string; requiredRole: SignInContinuationRole; activeRole: SignInContinuationRole; now: Date }): Promise<{ consumed: boolean }>;
};

export type SignInContinuationAuditSink = {
  record(event: AuditEvent): Promise<void>;
};

export type CreatedSignInContinuation = {
  continuationId: string;
  continuationToken: string;
  targetRoute: string;
  actionKey: string;
  requiredRole: SignInContinuationRole | null;
  expiresAt: Date;
};

export type ConsumedSignInContinuation = {
  continuationId: string;
  targetRoute: string;
  actionKey: string;
  requiredRole: SignInContinuationRole | null;
  payloadPreview: Record<string, unknown>;
};

const defaultContinuationTtlMs = 15 * 60 * 1000;
const validRoles = new Set<SignInContinuationRole>(["student", "school_staff", "cuac_ops", "cuac_admin"]);
const previewReferenceKeys = new Set(["schoolId", "programId", "scholarshipId", "cityId"]);
const registeredNavigations = new Map<string, { requiredRole: SignInContinuationRole; routes: ReadonlySet<string> }>([
  ["application.add_choice", {
    requiredRole: "student",
    routes: new Set(["/application.html", "/application.html#add-choice"]),
  }],
  ["navigation.open_student_workspace", {
    requiredRole: "student",
    routes: new Set(["/onboarding.html", "/hub.html", "/favourites.html", "/application.html", "/billing.html", "/notifications.html", "/preferences.html"]),
  }],
  ["navigation.open_school_workspace", {
    requiredRole: "school_staff",
    routes: new Set(["/school-portal.html", "/school-settings.html"]),
  }],
  ["navigation.open_ops_workspace", {
    requiredRole: "cuac_ops",
    routes: new Set(["/ops-admin.html"]),
  }],
]);
const sensitivePreviewKeys = new Set([
  "password",
  "passwordHash",
  "sessionToken",
  "token",
  "accessToken",
  "refreshToken",
  "cardNumber",
  "cvv",
  "cvc",
  "paymentToken",
  "bankAccount",
  "routingNumber",
  "passportNumber",
  "idNumber",
].map(normalizePreviewKey));

export class SignInContinuationService {
  private readonly repository: SignInContinuationRepository;
  private readonly auditSink: SignInContinuationAuditSink | null;
  private readonly now: () => Date;
  private readonly continuationTtlMs: number;

  constructor(
    repository: SignInContinuationRepository,
    options: { auditSink?: SignInContinuationAuditSink | null; now?: Date; continuationTtlMs?: number } = {},
  ) {
    this.repository = repository;
    this.auditSink = options.auditSink ?? null;
    this.now = () => options.now ?? new Date();
    this.continuationTtlMs = options.continuationTtlMs ?? defaultContinuationTtlMs;
  }

  async createGuestContinuation(
    context: RequestContext,
    input: CreateSignInContinuationInput,
  ): Promise<CreatedSignInContinuation> {
    if (context.activeRole !== "guest") {
      throw forbidden("Sign-in continuation creation is only available before login.");
    }
    if (!context.guestSessionId) {
      throw badRequest("Sign-in continuation requires a guest browser session.");
    }

    const normalized = normalizeCreateInput(input);
    const now = this.now();
    const continuationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.continuationTtlMs);
    const created = await this.repository.createContinuation({
      continuationTokenHash: sha256(continuationToken),
      guestSessionId: context.guestSessionId,
      targetRoute: normalized.targetRoute,
      actionKey: normalized.actionKey,
      requiredRole: normalized.requiredRole,
      tenantSchoolId: null,
      payloadPreview: normalized.payloadPreview,
      deviceFingerprintHash: normalized.deviceFingerprint ? sha256(normalized.deviceFingerprint) : null,
      expiresAt,
      now,
    });

    await this.recordAudit(context, {
      action: "auth.sign_in_continuation.create",
      resourceType: "sign_in_continuation",
      resourceId: created.continuationId,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["low_sensitive_preference"],
      metadata: toContinuationAuditMetadata({
        targetRoute: normalized.targetRoute,
        actionKey: normalized.actionKey,
        requiredRole: normalized.requiredRole,
        payloadPreview: normalized.payloadPreview,
        expiresAt,
      }),
    });

    return {
      continuationId: created.continuationId,
      continuationToken,
      targetRoute: normalized.targetRoute,
      actionKey: normalized.actionKey,
      requiredRole: normalized.requiredRole,
      expiresAt,
    };
  }

  async consumeContinuation(
    context: RequestContext,
    continuationId: unknown,
    continuationToken: unknown,
  ): Promise<ConsumedSignInContinuation> {
    if (!context.actorUserId || context.activeRole === "guest") {
      throw forbidden("Sign-in continuation consume requires an authenticated session.");
    }

    const id = inputUuid(continuationId, "Sign-in continuation id");
    const token = authToken(continuationToken);
    const now = this.now();
    const continuation = await this.repository.findActiveContinuation({
      continuationId: id,
      continuationTokenHash: sha256(token),
      now,
    });

    if (!continuation) {
      throw badRequest("Sign-in continuation is not available.");
    }

    if (!context.guestSessionId || !continuation.guestSessionId || continuation.guestSessionId !== context.guestSessionId) {
      throw forbidden("Sign-in continuation does not belong to the current browser session.");
    }

    if (!continuation.requiredRole || !roleSatisfiesRequiredRole(context.activeRole, continuation.requiredRole)) {
      throw forbidden("Sign-in continuation role does not match the authenticated session.");
    }
    if (continuation.tenantSchoolId !== null) {
      throw forbidden("Guest continuations cannot carry school tenant authority.");
    }
    const targetRoute = normalizeTargetRoute(continuation.targetRoute);
    const actionKey = normalizeActionKey(continuation.actionKey);
    requireRegisteredNavigation(targetRoute, actionKey, continuation.requiredRole);
    const payloadPreview = normalizePayloadPreview(continuation.payloadPreview);

    const consumed = await this.repository.markContinuationConsumed({
      continuationId: continuation.id,
      continuationTokenHash: sha256(token),
      consumedByUserId: context.actorUserId,
      guestSessionId: context.guestSessionId,
      requiredRole: continuation.requiredRole,
      activeRole: context.activeRole,
      now,
    });

    if (!consumed.consumed) {
      throw badRequest("Sign-in continuation has already been consumed.");
    }

    await this.recordAudit(context, {
      action: "auth.sign_in_continuation.consume",
      resourceType: "sign_in_continuation",
      resourceId: continuation.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["low_sensitive_preference"],
      metadata: toContinuationAuditMetadata({ ...continuation, targetRoute, actionKey, payloadPreview }),
    });

    return {
      continuationId: continuation.id,
      targetRoute,
      actionKey,
      requiredRole: continuation.requiredRole,
      payloadPreview,
    };
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

function normalizeCreateInput(input: CreateSignInContinuationInput) {
  const value = authInput(input, ["targetRoute", "actionKey", "requiredRole", "payloadPreview", "deviceFingerprint"]);
  const targetRoute = normalizeTargetRoute(value.targetRoute);
  const actionKey = normalizeActionKey(value.actionKey);
  const requiredRole = normalizeRole(value.requiredRole);
  requireRegisteredNavigation(targetRoute, actionKey, requiredRole);
  const payloadPreview = normalizePayloadPreview(value.payloadPreview);
  const deviceFingerprint = authOptionalText(value.deviceFingerprint, "Device fingerprint", 256);

  return { targetRoute, actionKey, requiredRole, payloadPreview, deviceFingerprint };
}

function requireRegisteredNavigation(route: string, action: string, role: SignInContinuationRole | null) {
  // This is a navigation contract, not a permission grant or an application write.
  const registration = registeredNavigations.get(action);
  if (!registration || role !== registration.requiredRole || !registration.routes.has(route)) {
    throw badRequest("Sign-in continuation navigation is not registered.");
  }
}

function roleSatisfiesRequiredRole(activeRole: SignInContinuationRole, requiredRole: SignInContinuationRole): boolean {
  return activeRole === requiredRole || (requiredRole === "cuac_ops" && activeRole === "cuac_admin");
}

function normalizeTargetRoute(value: unknown): string {
  const route = inputText(value, "Sign-in continuation target route", 240);

  // Reject encoded separators and controls before URL parsing can normalize them away.
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("://") || route.length > 240
    || route.includes("\\") || /\p{Cc}|%(?:2f|5c|25|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(route)) {
    throw badRequest("Sign-in continuation target route must be an internal path.");
  }
  const base = "https://continuation.invalid";
  const parsed = new URL(route, base);
  if (parsed.origin !== base || parsed.pathname.startsWith("//")) {
    throw badRequest("Sign-in continuation target route must be an internal path.");
  }
  if (parsed.search || (parsed.hash && !/^#[a-z][a-z0-9_-]{0,79}$/i.test(parsed.hash))) {
    throw badRequest("Sign-in continuation route cannot carry query data or an arbitrary fragment.");
  }
  return parsed.pathname + parsed.search + parsed.hash;
}

function normalizeActionKey(value: unknown): string {
  const actionKey = inputText(value, "Sign-in continuation action key", 80);

  if (!/^[a-z][a-z0-9_.:-]{1,79}$/.test(actionKey)) {
    throw badRequest("Sign-in continuation action key is invalid.");
  }

  return actionKey;
}

function normalizeRole(value: unknown): SignInContinuationRole | null {
  if (value === undefined || value === null || value === "") {
    return "student";
  }

  if (typeof value !== "string" || !validRoles.has(value as SignInContinuationRole)) {
    throw badRequest("Sign-in continuation required role is invalid.");
  }

  return value as SignInContinuationRole;
}

function normalizePayloadPreview(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }

  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); } catch { /* Cyclic/non-JSON input is rejected below. */ }
  if (!isRecord(value) || !serialized || serialized.length > 2000) {
    throw badRequest("Sign-in continuation payload preview must be a small object.");
  }

  if (containsSensitiveKey(value)) {
    throw forbidden("Sign-in continuation payload preview cannot contain sensitive fields.");
  }
  try {
    const record = inputRecord(value, [...previewReferenceKeys]);
    return Object.fromEntries(Object.entries(record).map(([key, reference]) => [key, inputUuid(reference)]));
  } catch {
    throw badRequest("Sign-in continuation payload preview only accepts catalog object references.");
  }
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSensitiveKey);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, child]) => sensitivePreviewKeys.has(normalizePreviewKey(key)) || containsSensitiveKey(child));
}

function normalizePreviewKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function toContinuationAuditMetadata(input: {
  targetRoute: string;
  actionKey: string;
  requiredRole: SignInContinuationRole | null;
  payloadPreview: Record<string, unknown>;
  expiresAt: Date;
}) {
  return {
    targetRoute: input.targetRoute,
    actionKey: input.actionKey,
    requiredRole: input.requiredRole,
    payloadPreviewKeys: Object.keys(input.payloadPreview),
    expiresAt: input.expiresAt.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
