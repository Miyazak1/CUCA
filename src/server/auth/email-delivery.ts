import { serviceUnavailable } from "../shared/errors.ts";

export type AuthEmailMessageType = "auth.email_verification" | "auth.password_reset";

export type AuthEmailMessage = {
  messageType: AuthEmailMessageType;
  to: string;
  from: string;
  subject: string;
  templateData: {
    challengeId: string;
    userId: string;
    expiresAt: string;
    actionUrl: string;
  };
};

export type AuthEmailDeliveryConfig = {
  from: string;
  publicAppUrl: string;
  verificationPath: string;
  passwordResetPath: string;
};

export function composeEmailVerificationMessage(
  config: AuthEmailDeliveryConfig,
  input: { challengeId: string; userId: string; emailNormalized: string; verificationToken: string; expiresAt: Date },
): AuthEmailMessage {
  return {
    messageType: "auth.email_verification",
    to: normalizeEmail(input.emailNormalized),
    from: normalizeEmail(config.from),
    subject: "Verify your CUAC email",
    templateData: {
      challengeId: input.challengeId,
      userId: input.userId,
      expiresAt: input.expiresAt.toISOString(),
      actionUrl: actionUrl(config.publicAppUrl, config.verificationPath, input.challengeId, input.verificationToken),
    },
  };
}

export function composePasswordResetMessage(
  config: AuthEmailDeliveryConfig,
  input: { challengeId: string; userId: string; emailNormalized: string; resetToken: string; expiresAt: Date },
): AuthEmailMessage {
  return {
    messageType: "auth.password_reset",
    to: normalizeEmail(input.emailNormalized),
    from: normalizeEmail(config.from),
    subject: "Reset your CUAC password",
    templateData: {
      challengeId: input.challengeId,
      userId: input.userId,
      expiresAt: input.expiresAt.toISOString(),
      actionUrl: actionUrl(config.publicAppUrl, config.passwordResetPath, input.challengeId, input.resetToken),
    },
  };
}

export function validateAuthEmailDeliveryConfig(config: Partial<AuthEmailDeliveryConfig>): AuthEmailDeliveryConfig {
  return {
    from: normalizeEmail(config.from),
    publicAppUrl: normalizePublicAppUrl(config.publicAppUrl),
    verificationPath: normalizeActionPath(config.verificationPath),
    passwordResetPath: normalizeActionPath(config.passwordResetPath),
  };
}

function normalizeEmail(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized.length > 254 || hasControlCharacter(normalized) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) {
    throw serviceUnavailable("Auth email delivery requires a valid email address.");
  }

  return normalized;
}

function normalizePublicAppUrl(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  try {
    const url = new URL(normalized);
    if (!/^https:\/\//i.test(normalized) || hasControlCharacter(normalized) || /[\s\\?#@]/.test(normalized) || url.protocol !== "https:"
      || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw serviceUnavailable("Auth email delivery requires an HTTPS public app URL.");
  }
}

function normalizeActionPath(value: string | undefined): string {
  if (typeof value !== "string" || !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value) || value.length > 200 || /^\/api(?:\/|$)/i.test(value)) {
    throw serviceUnavailable("Auth email delivery requires a configured action page path.");
  }
  return value;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function actionUrl(origin: string, path: string, challengeId: string, token: string): string {
  const url = new URL(normalizeActionPath(path), normalizePublicAppUrl(origin));
  url.hash = new URLSearchParams({ challenge: challengeId, token }).toString();
  return url.toString();
}
