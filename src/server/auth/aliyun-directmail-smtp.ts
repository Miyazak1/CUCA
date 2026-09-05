import { createHash } from "node:crypto";
import { createTransport } from "nodemailer";
import { validateAuthEmailDeliveryConfig, type AuthEmailDeliveryConfig, type AuthEmailMessage } from "./email-delivery.ts";
import type { AuthEmailProvider } from "./email-outbox-worker.ts";
import { serviceUnavailable } from "../shared/errors.ts";

export const ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS = Object.freeze({
  "cn-hangzhou": "smtpdm.aliyun.com",
  "ap-southeast-1": "smtpdm-ap-southeast-1.aliyuncs.com",
  "us-east-1": "smtpdm-us-east-1.aliyuncs.com",
  "eu-central-1": "smtpdm-eu-central-1.aliyuncs.com",
} as const);

export type AliyunDirectMailRegion = keyof typeof ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS;

export type AliyunDirectMailSmtpConfig = AuthEmailDeliveryConfig & {
  region: AliyunDirectMailRegion;
  username: string;
  password: string;
};

export type AliyunDirectMailSmtpOptions = {
  host: string;
  port: 465;
  secure: true;
  auth: { user: string; pass: string };
  connectionTimeout: 8_000;
  greetingTimeout: 8_000;
  socketTimeout: 8_000;
  dnsTimeout: 5_000;
  tls: { minVersion: "TLSv1.2"; rejectUnauthorized: true; servername: string };
  logger: false;
  debug: false;
  transactionLog: false;
  disableFileAccess: true;
  disableUrlAccess: true;
};

export type AliyunDirectMailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
  disableFileAccess: true;
  disableUrlAccess: true;
  attachDataUrls: false;
  xMailer: false;
};

type SendResult = {
  accepted?: unknown;
  rejected?: unknown;
};

export type AliyunDirectMailTransport = {
  sendMail(message: AliyunDirectMailMessage): Promise<SendResult>;
};

export type AliyunDirectMailDependencies = {
  createTransport(options: AliyunDirectMailSmtpOptions): AliyunDirectMailTransport;
};

type ValidatedConfig = AuthEmailDeliveryConfig & {
  region: AliyunDirectMailRegion;
  username: string;
  password: string;
  host: string;
};

const defaultDependencies: AliyunDirectMailDependencies = {
  createTransport(options) {
    const transport = createTransport(options);
    return { sendMail: message => transport.sendMail(message) };
  },
};

export function createAliyunDirectMailSmtpProvider(
  input: AliyunDirectMailSmtpConfig,
  dependencies: AliyunDirectMailDependencies = defaultDependencies,
): AuthEmailProvider {
  const config = validateConfig(input);
  const transport = dependencies.createTransport(buildTransportOptions(config));

  return {
    async deliver(message, options) {
      if (options.signal.aborted) return { status: "unknown" };

      const outgoing = buildMessage(config, message, options.idempotencyKey);
      if (!outgoing) return { status: "unknown" };

      try {
        const result = await transport.sendMail(outgoing);
        if (options.signal.aborted) return { status: "unknown" };
        if (containsRecipient(result.accepted, outgoing.to)) return { status: "accepted" };
        if (containsRecipient(result.rejected, outgoing.to)) return { status: "not_accepted" };
        return { status: "unknown" };
      } catch (error) {
        if (containsRecipient(readRejectedRecipients(error), outgoing.to)) return { status: "not_accepted" };
        return { status: "unknown" };
      }
    },
  };
}

function validateConfig(input: AliyunDirectMailSmtpConfig): ValidatedConfig {
  const delivery = validateAuthEmailDeliveryConfig(input);
  const region = input?.region;
  if (typeof region !== "string" || !Object.hasOwn(ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS, region)) {
    throw serviceUnavailable("Aliyun Direct Mail requires a supported SMTP region.");
  }

  const username = normalizeAddress(input.username);
  if (!username || username !== delivery.from) {
    throw serviceUnavailable("Aliyun Direct Mail requires the verified sender as its SMTP username.");
  }

  const password = input.password;
  if (typeof password !== "string" || password.length < 1 || password.length > 512 || hasControlCharacter(password)) {
    throw serviceUnavailable("Aliyun Direct Mail SMTP credentials are not configured correctly.");
  }

  return { ...delivery, region, username, password, host: ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS[region] };
}

function buildTransportOptions(config: ValidatedConfig): AliyunDirectMailSmtpOptions {
  return {
    host: config.host,
    port: 465,
    secure: true,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 8_000,
    dnsTimeout: 5_000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: config.host },
    logger: false,
    debug: false,
    transactionLog: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

function buildMessage(config: ValidatedConfig, message: AuthEmailMessage, idempotencyKey: string): AliyunDirectMailMessage | undefined {
  const expected = message.messageType === "auth.email_verification"
    ? { subject: "Verify your CUAC email", path: config.verificationPath, action: "Verify email" }
    : message.messageType === "auth.password_reset"
      ? { subject: "Reset your CUAC password", path: config.passwordResetPath, action: "Reset password" }
      : undefined;
  if (!expected || message.subject !== expected.subject || normalizeAddress(message.from) !== config.from) return undefined;

  const recipient = normalizeAddress(message.to);
  const actionUrl = validateActionUrl(message, config.publicAppUrl, expected.path);
  const expiresAt = validateExpiry(message.templateData?.expiresAt);
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!recipient || !actionUrl || !expiresAt || !key) return undefined;

  const text = `${expected.subject}\n\n${expected.action}:\n${actionUrl}\n\nThis secure link expires at ${expiresAt}. If you did not request this, you can ignore this email.`;
  const html = [
    "<!doctype html><html><body>",
    `<h1>${escapeHtml(expected.subject)}</h1>`,
    `<p><a href="${escapeHtml(actionUrl)}">${escapeHtml(expected.action)}</a></p>`,
    `<p>This secure link expires at ${escapeHtml(expiresAt)}.</p>`,
    "<p>If you did not request this, you can ignore this email.</p>",
    "</body></html>",
  ].join("");

  return {
    from: config.from,
    to: recipient,
    subject: expected.subject,
    text,
    html,
    messageId: deterministicMessageId(key, config.from),
    disableFileAccess: true,
    disableUrlAccess: true,
    attachDataUrls: false,
    xMailer: false,
  };
}

function validateActionUrl(message: AuthEmailMessage, publicAppUrl: string, expectedPath: string): string | undefined {
  const raw = message.templateData?.actionUrl;
  if (typeof raw !== "string" || raw.length > 2_048 || hasControlCharacter(raw)) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.origin !== publicAppUrl || url.pathname !== expectedPath || url.search || url.username || url.password) return undefined;
    const parameters = new URLSearchParams(url.hash.slice(1));
    const names = Array.from(parameters.keys());
    const challenge = parameters.get("challenge");
    const token = parameters.get("token");
    if (names.length !== 2 || names[0] !== "challenge" || names[1] !== "token" || !challenge || challenge !== message.templateData.challengeId
      || !token || token.length > 512 || hasControlCharacter(token)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function validateExpiry(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 64 || hasControlCharacter(value)) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) return undefined;
  return value;
}

function normalizeIdempotencyKey(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(value)) return undefined;
  return value;
}

function deterministicMessageId(idempotencyKey: string, sender: string): string {
  const digest = createHash("sha256").update(idempotencyKey, "utf8").digest("hex");
  return `<cuac-auth-${digest}@${sender.slice(sender.lastIndexOf("@") + 1)}>`;
}

function normalizeAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || hasControlCharacter(normalized) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) return undefined;
  return normalized;
}

function containsRecipient(value: unknown, recipient: string): boolean {
  if (!Array.isArray(value)) return false;
  return value.some(item => {
    if (typeof item === "string") return normalizeAddress(item) === recipient;
    if (!item || typeof item !== "object" || !("address" in item)) return false;
    return normalizeAddress(item.address) === recipient;
  });
}

function readRejectedRecipients(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("rejected" in error)) return undefined;
  return error.rejected;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
