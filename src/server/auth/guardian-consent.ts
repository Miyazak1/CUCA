import { createHash, randomBytes, randomUUID } from "node:crypto";
import { badRequest, conflict, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputUuid } from "../shared/input.ts";
import { authDisplayName, authEmail, authInput, authPassword, authToken } from "./input.ts";
import { passwordHasher, type PasswordHasher } from "./password-hasher.ts";

export type GuardianRelationship = "parent" | "other_legal_guardian";
export type GuardianConsentLocale = "en" | "zh-CN";

export type PendingGuardianRegistrationInput = {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string | null;
  passwordHash: string;
  guardianEmail: string;
  guardianEmailNormalized: string;
  guardianEmailSha256: string;
  guardianRelationship: GuardianRelationship;
  locale: GuardianConsentLocale;
  consentTokenHash: string;
  consentToken: string;
  requestedAt: Date;
  expiresAt: Date;
  ipHash: string | null;
  userAgentHash: string | null;
};

export type GuardianConsentRepository = {
  findIdentity(emailNormalized: string): Promise<{ userId: string } | null>;
  createPending(input: PendingGuardianRegistrationInput): Promise<{ requestId: string; expiresAt: Date }>;
  accept(input: { requestId: string; tokenHash: string; now: Date }): Promise<{ userId: string; childEmail: string }>;
  decline(input: { requestId: string; tokenHash: string; now: Date }): Promise<{ declined: boolean }>;
};

export class GuardianConsentService {
  private readonly repository: GuardianConsentRepository;
  private readonly options: { now?: Date; passwordHasher?: PasswordHasher; ttlMs?: number };
  constructor(
    repository: GuardianConsentRepository,
    options: { now?: Date; passwordHasher?: PasswordHasher; ttlMs?: number } = {},
  ) { this.repository = repository; this.options = options; }

  async request(input: {
    email: unknown; password: unknown; displayName?: unknown; guardianEmail: unknown;
    guardianRelationship: unknown; locale?: unknown; userAgent?: string | null; ip?: string | null;
  }) {
    const value = authInput(input, ["email", "password", "displayName", "guardianEmail", "guardianRelationship", "locale", "userAgent", "ip"]);
    const child = authEmail(value.email);
    const guardian = authEmail(value.guardianEmail);
    if (child.normalized === guardian.normalized) throw badRequest("Guardian email must be different from the child's email.");
    if (await this.repository.findIdentity(child.normalized)) throw forbidden("An account already exists for this email.");
    const password = authPassword(value.password, true);
    const displayName = authDisplayName(value.displayName);
    const relationship = inputEnum(value.guardianRelationship, "Guardian relationship", ["parent", "other_legal_guardian"] as const);
    const locale = value.locale === undefined ? "en" : inputEnum(value.locale, "Notice locale", ["en", "zh-CN"] as const);
    const consentToken = randomBytes(32).toString("base64url");
    const now = this.options.now ?? new Date();
    const ttlMs = this.options.ttlMs ?? 72 * 60 * 60 * 1000;
    if (ttlMs < 60_000 || ttlMs > 72 * 60 * 60 * 1000) throw serviceUnavailable("Guardian consent expiry is not configured safely.");
    try {
      return await this.repository.createPending({
        id: randomUUID(), email: child.original, emailNormalized: child.normalized, displayName,
        passwordHash: await (this.options.passwordHasher ?? passwordHasher).hash(password),
        guardianEmail: guardian.original, guardianEmailNormalized: guardian.normalized,
        guardianEmailSha256: sha256(guardian.normalized), guardianRelationship: relationship, locale,
        consentToken, consentTokenHash: tokenHash(consentToken), requestedAt: now,
        expiresAt: new Date(now.getTime() + ttlMs), ipHash: optionalMetadataHash(value.ip),
        userAgentHash: optionalMetadataHash(value.userAgent),
      });
    } catch (error) {
      if (isConstraintConflict(error)) throw conflict("A registration already exists for this email.");
      throw error;
    }
  }

  async accept(input: { requestId: unknown; token: unknown }) {
    const requestId = inputUuid(input.requestId);
    const token = authToken(input.token);
    try { return await this.repository.accept({ requestId, tokenHash: tokenHash(token), now: this.options.now ?? new Date() }); }
    catch (error) {
      if (isConstraintConflict(error)) throw conflict("The child account cannot be activated with this email.");
      throw error;
    }
  }

  async decline(input: { requestId: unknown; token: unknown }) {
    const requestId = inputUuid(input.requestId);
    const token = authToken(input.token);
    return this.repository.decline({ requestId, tokenHash: tokenHash(token), now: this.options.now ?? new Date() });
  }
}

export const guardianConsentTokenHash = tokenHash;

function tokenHash(value: string) { return `sha256:${sha256(value)}`; }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function optionalMetadataHash(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? `sha256:${sha256(value.trim())}` : null;
}
function isConstraintConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505");
}
