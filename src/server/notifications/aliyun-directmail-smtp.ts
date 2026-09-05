import { createHash } from "node:crypto";
import { createTransport } from "nodemailer";
import {
  ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS,
  type AliyunDirectMailRegion,
  type AliyunDirectMailSmtpOptions,
} from "../auth/aliyun-directmail-smtp.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import type { PreparedNotificationDelivery } from "./delivery-queue.ts";
import type { NotificationProviderFacade } from "./worker.ts";

export type NotificationAliyunDirectMailConfig = {
  from: string;
  publicAppUrl: string;
  region: AliyunDirectMailRegion;
  username: string;
  password: string;
};

export type NotificationAliyunDirectMailMessage = {
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

type SendResult = { accepted?: unknown; rejected?: unknown; messageId?: unknown };

export type NotificationAliyunDirectMailTransport = {
  sendMail(message: NotificationAliyunDirectMailMessage): Promise<SendResult>;
};

export type NotificationAliyunDirectMailDependencies = {
  createTransport(options: AliyunDirectMailSmtpOptions): NotificationAliyunDirectMailTransport;
};

type ValidatedConfig = NotificationAliyunDirectMailConfig & { host: string };

const defaultDependencies: NotificationAliyunDirectMailDependencies = {
  createTransport(options) {
    const transport = createTransport(options);
    return { sendMail: message => transport.sendMail(message) };
  },
};

export function createNotificationAliyunDirectMailProvider(
  input: NotificationAliyunDirectMailConfig,
  dependencies: NotificationAliyunDirectMailDependencies = defaultDependencies,
): NotificationProviderFacade {
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
        if (containsRecipient(result.accepted, outgoing.to)) {
          return { status: "accepted", providerMessageId: normalizeProviderMessageId(result.messageId) };
        }
        if (containsRecipient(result.rejected, outgoing.to)) return { status: "not_accepted" };
        return { status: "unknown" };
      } catch (error) {
        if (containsRecipient(readRejectedRecipients(error), outgoing.to)) return { status: "not_accepted" };
        return { status: "unknown" };
      }
    },
  };
}

function validateConfig(input: NotificationAliyunDirectMailConfig): ValidatedConfig {
  const from = normalizeAddress(input?.from);
  const username = normalizeAddress(input?.username);
  if (!from || !username || username !== from) {
    throw serviceUnavailable("Notification email requires the verified sender as its SMTP username.");
  }
  const publicAppUrl = normalizeHttpsOrigin(input.publicAppUrl);
  if (!publicAppUrl) throw serviceUnavailable("Notification email public application origin is not configured correctly.");
  const region = input.region;
  if (typeof region !== "string" || !Object.hasOwn(ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS, region)) {
    throw serviceUnavailable("Notification email requires a supported Aliyun Direct Mail SMTP region.");
  }
  if (typeof input.password !== "string" || input.password.length < 1 || input.password.length > 512
    || hasControlCharacter(input.password)) {
    throw serviceUnavailable("Notification email SMTP credentials are not configured correctly.");
  }
  return { from, username, publicAppUrl, region, password: input.password, host: ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS[region] };
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

function buildMessage(config: ValidatedConfig, message: PreparedNotificationDelivery,
  idempotencyKey: string): NotificationAliyunDirectMailMessage | undefined {
  const recipient = normalizeAddress(message?.to);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const title = validTitle(message?.title);
  const body = validBody(message?.body);
  const actionUrl = resolveActionUrl(config.publicAppUrl, message?.actionPath);
  if (message?.channel !== "email" || !recipient || !key || !title || !body || actionUrl === undefined) return undefined;

  const actionText = actionUrl ? `\n\nOpen in CUAC:\n${actionUrl}` : "";
  const actionHtml = actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">Open in CUAC</a></p>` : "";
  return {
    from: config.from,
    to: recipient,
    subject: title,
    text: `${title}\n\n${body}${actionText}`,
    html: `<!doctype html><html><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>${actionHtml}</body></html>`,
    messageId: deterministicMessageId(key, config.from),
    disableFileAccess: true,
    disableUrlAccess: true,
    attachDataUrls: false,
    xMailer: false,
  };
}

function normalizeHttpsOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2_048 || hasControlCharacter(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function resolveActionUrl(origin: string, actionPath: unknown): string | null | undefined {
  if (actionPath === null) return null;
  if (typeof actionPath !== "string" || actionPath.length < 1 || actionPath.length > 512
    || !actionPath.startsWith("/") || actionPath.startsWith("//") || hasControlCharacter(actionPath)) return undefined;
  try {
    const url = new URL(actionPath, origin);
    if (url.origin !== origin || url.username || url.password || url.hash) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function validTitle(value: unknown): string | undefined {
  return typeof value === "string" && value.length >= 1 && value.length <= 160 && !hasControlCharacter(value) ? value : undefined;
}

function validBody(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 1 || value.length > 2_000) return undefined;
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return (code < 32 && character !== "\n" && character !== "\t") || code === 127;
  }) ? undefined : value;
}

function normalizeAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || hasControlCharacter(normalized) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) return undefined;
  return normalized;
}

function normalizeIdempotencyKey(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(value) ? value : undefined;
}

function deterministicMessageId(idempotencyKey: string, sender: string): string {
  const digest = createHash("sha256").update(idempotencyKey, "utf8").digest("hex");
  return `<cuac-notification-${digest}@${sender.slice(sender.lastIndexOf("@") + 1)}>`;
}

function normalizeProviderMessageId(value: unknown): string | undefined {
  return typeof value === "string" && value.length >= 1 && value.length <= 512 && !hasControlCharacter(value) ? value : undefined;
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
  return error && typeof error === "object" && "rejected" in error ? error.rejected : undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
