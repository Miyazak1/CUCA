import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { serviceUnavailable, toErrorEnvelope } from "../../shared/errors.ts";
import { createHostedPaymentGateway, hostedPaymentGatewayConfigFromEnv } from "../hosted-gateway.ts";
import { PostgresPaymentProviderEvents } from "../postgres-payment-events.ts";
import type { HostedCheckoutProvider } from "../postgres-repository.ts";
import { CUAC_HOSTED_PAYMENT_PROVIDER } from "../provider-contract.ts";
import { createPaymentWebhookHandler, paymentWebhookConfigFromEnv } from "../webhook-http.ts";

export type PaymentReconciliationWorkerConfig = { pollIntervalMs: number };

export function createPaymentProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): HostedCheckoutProvider | null {
  const mode = (env.CUAC_PAYMENT_MODE ?? "disabled").trim().toLowerCase();
  if (mode === "disabled") return null;
  if (!["test", "live"].includes(mode) || (env.CUAC_PAYMENT_PROVIDER ?? "").trim().toLowerCase() !== CUAC_HOSTED_PAYMENT_PROVIDER) {
    throw unsupported();
  }
  const gateway = hostedPaymentGatewayConfigFromEnv(env);
  const webhook = paymentWebhookConfigFromEnv(env);
  requireSeparatedSecrets(gateway.hmacSecret, webhook.hmacSecret);
  return createHostedPaymentGateway(gateway);
}

export function createPaymentWebhookRouteHandler(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = (env.CUAC_PAYMENT_MODE ?? "disabled").trim().toLowerCase();
  if (!["test", "live"].includes(mode) || (env.CUAC_PAYMENT_PROVIDER ?? "").trim().toLowerCase() !== CUAC_HOSTED_PAYMENT_PROVIDER) {
    throw unsupported();
  }
  const gateway = hostedPaymentGatewayConfigFromEnv(env);
  const webhook = paymentWebhookConfigFromEnv(env);
  requireSeparatedSecrets(gateway.hmacSecret, webhook.hmacSecret);
  const client = createTransactionalSqlClient(getSharedPostgresPool());
  return createPaymentWebhookHandler(new PostgresPaymentProviderEvents(client), webhook);
}

export async function handlePaymentWebhookRoute(request: Request): Promise<Response> {
  try { return await createPaymentWebhookRouteHandler()(request); }
  catch (error) {
    const requestId = crypto.randomUUID();
    const response = Response.json(toErrorEnvelope(error instanceof Error ? unsupported() : error, requestId), { status: 503 });
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.set("pragma", "no-cache");
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-request-id", requestId);
    return new Response(response.body, { status: response.status, headers });
  }
}

export function paymentReconciliationWorkerConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): PaymentReconciliationWorkerConfig {
  createPaymentProviderFromEnv(env);
  return { pollIntervalMs: boundedInteger(env.CUAC_PAYMENT_RECONCILIATION_POLL_MS, 250, 60_000, 1_000) };
}

export async function runPaymentReconciliationWorker(input: {
  events: PostgresPaymentProviderEvents;
  config: PaymentReconciliationWorkerConfig;
  signal: AbortSignal;
}, dependencies: {
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  onBatch?: (processed: number) => void;
} = {}) {
  const wait = dependencies.wait ?? waitForSignal;
  let processed = 0;
  while (!input.signal.aborted) {
    let batch = 0;
    while (!input.signal.aborted && batch < 100) {
      const result = await input.events.processNext();
      if (!result) break;
      batch += 1;
      processed += 1;
    }
    dependencies.onBatch?.(batch);
    if (!input.signal.aborted) await wait(input.config.pollIntervalMs, input.signal);
  }
  return { processed };
}

function waitForSignal(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>(resolve => {
    const timeout = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
    function done() { clearTimeout(timeout); signal.removeEventListener("abort", done); resolve(); }
  });
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number, fallback: number) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw unsupported();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw unsupported();
  return parsed;
}

function requireSeparatedSecrets(gateway: Uint8Array, webhook: Uint8Array) {
  if (Buffer.from(gateway).equals(Buffer.from(webhook))) throw unsupported();
}

function unsupported() {
  return serviceUnavailable("Payment runtime requires the reviewed hosted gateway provider.");
}
