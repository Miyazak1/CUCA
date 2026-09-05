import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../notifications/postgres-repository.ts";
import { materializePaymentStatusNotification, type NotificationEventMaterialization } from "../notifications/templates.ts";
import { CuacError, serviceUnavailable } from "../shared/errors.ts";
import { createRequestContext } from "../shared/request-context.ts";
import { grantApplicationFeeEntitlementsFromSettledPayment } from "./postgres-application-fee-entitlement.ts";
import {
  CUAC_HOSTED_PAYMENT_PROVIDER,
  type PaymentProviderEvent,
  type PaymentProviderEventType,
} from "./provider-contract.ts";

export type PaymentProviderEventState = "pending" | "processed" | "quarantined";
export type PaymentProviderEventOutcome =
  | "applied_succeeded"
  | "applied_canceled"
  | "applied_refunded"
  | "already_applied";

export type PaymentProviderEventResult = {
  id: string;
  providerEventId: string;
  state: PaymentProviderEventState;
  outcome: PaymentProviderEventOutcome | null;
};

type ProviderEventRow = PaymentProviderEventResult & {
  provider: string;
  eventType: PaymentProviderEventType;
  payloadSha256: string;
  invoiceId: string;
  paymentId: string | null;
  providerCheckoutSessionId: string;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  attemptCount: number;
  receivedAt: Date;
};

type PaymentRow = {
  id: string;
  invoiceId: string;
  userId: string;
  provider: string;
  providerPaymentId: string | null;
  providerCheckoutSessionId: string;
  paymentStatus: string;
  amountMinor: number;
  currency: string;
  paidAt: Date | null;
  canceledAt: Date | null;
  refundedAt: Date | null;
  invoiceStatus: string;
  invoiceTotalMinor: number;
  invoiceCurrency: string;
  invoiceFinalizedAt: Date | null;
  invoiceVoidedAt: Date | null;
};

const MAX_RECONCILIATION_ATTEMPTS = 20;
const MAX_RECONCILIATION_AGE_MS = 24 * 60 * 60 * 1000;

export class PostgresPaymentProviderEvents {
  private readonly client: TransactionalSqlClient;
  private readonly notificationPublisherFactory: (client: TransactionalSqlClient) => NotificationPublisher;

  constructor(client: TransactionalSqlClient,
    notificationPublisherFactory: (client: TransactionalSqlClient) => NotificationPublisher =
      transaction => new PostgresNotificationPublisher(transaction)) {
    this.client = client;
    this.notificationPublisherFactory = notificationPublisherFactory;
  }

  async ingest(event: PaymentProviderEvent, payloadSha256: string): Promise<PaymentProviderEventResult> {
    return this.client.transaction(async tx => {
      const inserted = await tx.query<ProviderEventRow>(
        `insert into payment_provider_events (
           provider, provider_event_id, event_type, payload_sha256, invoice_id,
           provider_checkout_session_id, provider_payment_id, amount_minor, currency, occurred_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (provider, provider_event_id) do nothing
         returning id, provider, provider_event_id as "providerEventId", event_type as "eventType",
           payload_sha256 as "payloadSha256", invoice_id as "invoiceId", payment_id as "paymentId",
           provider_checkout_session_id as "providerCheckoutSessionId",
           provider_payment_id as "providerPaymentId", amount_minor as "amountMinor", currency,
           occurred_at as "occurredAt", state, outcome, attempt_count as "attemptCount",
           received_at as "receivedAt"`,
        [CUAC_HOSTED_PAYMENT_PROVIDER, event.eventId, event.eventType, payloadSha256, event.invoiceId,
          event.providerCheckoutSessionId, event.providerPaymentId, event.amountMinor, event.currency, event.occurredAt],
      );
      const rows = inserted.length ? inserted : await tx.query<ProviderEventRow>(
        `${selectProviderEventSql()} where provider = $1 and provider_event_id = $2 for update`,
        [CUAC_HOSTED_PAYMENT_PROVIDER, event.eventId],
      );
      const row = requireRow(rows, "payment provider event ingest");
      if (!sameEvent(row, event, payloadSha256)) {
        throw new CuacError("CONFLICT", "Payment provider event id was replayed with different content.", 409);
      }
      return toResult(row);
    });
  }

  async process(providerEventId: string): Promise<PaymentProviderEventResult> {
    return this.client.transaction(async tx => {
      const rows = await tx.query<ProviderEventRow>(
        `${selectProviderEventSql()} where provider = $1 and provider_event_id = $2 for update`,
        [CUAC_HOSTED_PAYMENT_PROVIDER, providerEventId],
      );
      const row = requireRow(rows, "payment provider event process");
      return processLockedEvent(tx, row, this.notificationPublisherFactory(tx));
    });
  }

  async processNext(): Promise<PaymentProviderEventResult | null> {
    return this.client.transaction(async tx => {
      const rows = await tx.query<ProviderEventRow>(
        `${selectProviderEventSql()}
         where provider = $1 and state = 'pending' and next_attempt_at <= transaction_timestamp()
         order by next_attempt_at, received_at, id
         limit 1 for update skip locked`,
        [CUAC_HOSTED_PAYMENT_PROVIDER],
      );
      return rows[0] ? processLockedEvent(tx, rows[0], this.notificationPublisherFactory(tx)) : null;
    });
  }
}

type NotificationPublisher = {
  publish(input: NotificationEventMaterialization): Promise<{ eventId: string; created: boolean }>;
};

async function processLockedEvent(tx: TransactionalSqlClient, event: ProviderEventRow,
  notifications: NotificationPublisher): Promise<PaymentProviderEventResult> {
  if (event.state !== "pending") return toResult(event);
  const paymentRows = await tx.query<PaymentRow>(
    `select p.id, p.invoice_id as "invoiceId", p.user_id as "userId", p.provider,
       p.provider_payment_id as "providerPaymentId",
       p.provider_checkout_session_id as "providerCheckoutSessionId", p.status as "paymentStatus",
       p.amount_minor as "amountMinor", p.currency, p.paid_at as "paidAt",
       p.canceled_at as "canceledAt", p.refunded_at as "refundedAt",
       i.status as "invoiceStatus", i.total_minor as "invoiceTotalMinor", i.currency as "invoiceCurrency",
       i.finalized_at as "invoiceFinalizedAt", i.voided_at as "invoiceVoidedAt"
     from payments p join invoices i on i.id = p.invoice_id and i.user_id = p.user_id
     where p.provider = $1 and p.provider_checkout_session_id = $2
     limit 1 for update of p, i`,
    [event.provider, event.providerCheckoutSessionId],
  );
  const payment = paymentRows[0];
  if (!payment) return deferOrQuarantine(tx, event, "payment_not_visible");
  if (payment.invoiceId !== event.invoiceId || payment.provider !== event.provider
    || payment.amountMinor !== event.amountMinor || payment.currency !== event.currency
    || payment.invoiceTotalMinor !== event.amountMinor || payment.invoiceCurrency !== event.currency) {
    return quarantine(tx, event, "payment_scope_mismatch");
  }
  if (event.providerPaymentId) {
    const reused = await tx.query<{ id: string }>(
      `select id from payments where provider = $1 and provider_payment_id = $2 and id <> $3 limit 1 for share`,
      [event.provider, event.providerPaymentId, payment.id],
    );
    if (reused.length) return quarantine(tx, event, "provider_payment_reused");
  }
  if (payment.providerPaymentId && payment.providerPaymentId !== event.providerPaymentId) {
    return quarantine(tx, event, "provider_payment_mismatch");
  }
  if (event.eventType === "payment.succeeded") return applySucceeded(tx, event, payment, notifications);
  if (event.eventType === "payment.canceled") return applyCanceled(tx, event, payment, notifications);
  return applyRefunded(tx, event, payment, notifications);
}

async function applySucceeded(tx: TransactionalSqlClient, event: ProviderEventRow, payment: PaymentRow,
  notifications: NotificationPublisher) {
  if (payment.paymentStatus === "succeeded" && payment.invoiceStatus === "paid"
    && payment.providerPaymentId === event.providerPaymentId && payment.paidAt && payment.invoiceFinalizedAt) {
    return processed(tx, event, payment.id, "already_applied");
  }
  if (payment.paymentStatus !== "requires_payment" || payment.invoiceStatus !== "draft"
    || payment.paidAt || payment.canceledAt || payment.refundedAt || payment.invoiceFinalizedAt || payment.invoiceVoidedAt
    || !event.providerPaymentId) return quarantine(tx, event, "invalid_success_transition");
  const now = await databaseNow(tx);
  await tx.query(
    `update payments set status = 'succeeded', provider_payment_id = $2, paid_at = $3, updated_at = $3
     where id = $1`, [payment.id, event.providerPaymentId, now]);
  await tx.query(
    `update invoices set status = 'paid', finalized_at = $2, updated_at = $2 where id = $1`,
    [payment.invoiceId, now]);
  const statusEvent = requireRow(await tx.query<{ id: string }>(
    `insert into payment_status_events (
       payment_id, from_status, to_status, provider_event_id, reason_public, metadata_json, created_at
     ) values ($1,'requires_payment','succeeded',$2,'Payment confirmed by hosted provider','{}'::jsonb,$3)
     returning id`, [payment.id, event.providerEventId, now]), "payment success event");
  const context = providerContext(event);
  await grantApplicationFeeEntitlementsFromSettledPayment(tx, context, {
    paymentId: payment.id, paymentStatusEventId: statusEvent.id,
  }, { actorType: "service" });
  await auditPaymentEvent(tx, context, event, payment.id, "succeeded", 0);
  await publishPaymentNotification(notifications, payment, statusEvent.id, "succeeded", now);
  return processed(tx, event, payment.id, "applied_succeeded", now);
}

async function applyCanceled(tx: TransactionalSqlClient, event: ProviderEventRow, payment: PaymentRow,
  notifications: NotificationPublisher) {
  if (payment.paymentStatus === "canceled" && payment.invoiceStatus === "void" && payment.canceledAt
    && payment.invoiceVoidedAt && payment.providerPaymentId === event.providerPaymentId) {
    return processed(tx, event, payment.id, "already_applied");
  }
  if (payment.paymentStatus !== "requires_payment" || payment.invoiceStatus !== "draft"
    || payment.paidAt || payment.canceledAt || payment.refundedAt || payment.invoiceFinalizedAt || payment.invoiceVoidedAt) {
    return quarantine(tx, event, "invalid_cancel_transition");
  }
  const now = await databaseNow(tx);
  await tx.query(
    `update payments set status = 'canceled', provider_payment_id = $2, canceled_at = $3, updated_at = $3
     where id = $1`, [payment.id, event.providerPaymentId, now]);
  await tx.query(`update invoices set status = 'void', voided_at = $2, updated_at = $2 where id = $1`,
    [payment.invoiceId, now]);
  const statusEvent = requireRow(await tx.query<{ id: string }>(
    `insert into payment_status_events (
       payment_id, from_status, to_status, provider_event_id, reason_public, metadata_json, created_at
     ) values ($1,'requires_payment','canceled',$2,'Payment canceled by hosted provider','{}'::jsonb,$3)
     returning id`,
    [payment.id, event.providerEventId, now]), "payment cancellation event");
  const context = providerContext(event);
  await auditPaymentEvent(tx, context, event, payment.id, "canceled", 0);
  await publishPaymentNotification(notifications, payment, statusEvent.id, "canceled", now);
  return processed(tx, event, payment.id, "applied_canceled", now);
}

async function applyRefunded(tx: TransactionalSqlClient, event: ProviderEventRow, payment: PaymentRow,
  notifications: NotificationPublisher) {
  if (payment.paymentStatus === "requires_payment") return deferOrQuarantine(tx, event, "waiting_for_success");
  if (payment.paymentStatus === "refunded" && payment.invoiceStatus === "paid" && payment.paidAt
    && payment.refundedAt && payment.providerPaymentId === event.providerPaymentId) {
    return processed(tx, event, payment.id, "already_applied");
  }
  if (payment.paymentStatus !== "succeeded" || payment.invoiceStatus !== "paid" || !payment.paidAt
    || !payment.invoiceFinalizedAt || payment.canceledAt || payment.refundedAt || payment.invoiceVoidedAt
    || !event.providerPaymentId) return quarantine(tx, event, "invalid_refund_transition");
  const now = await databaseNow(tx);
  await tx.query(`update payments set status = 'refunded', refunded_at = $2, updated_at = $2 where id = $1`,
    [payment.id, now]);
  const statusEvent = requireRow(await tx.query<{ id: string }>(
    `insert into payment_status_events (
       payment_id, from_status, to_status, provider_event_id, reason_public, metadata_json, created_at
     ) values ($1,'succeeded','refunded',$2,'Payment refunded by hosted provider','{}'::jsonb,$3)
     returning id`,
    [payment.id, event.providerEventId, now]), "payment refund event");
  const revoked = await tx.query<{ id: string }>(
    `update application_fee_entitlements set status = 'revoked', revoked_at = $2,
       revocation_reason = 'provider_refund', updated_at = $2
     where payment_id = $1 and status = 'active' returning id`,
    [payment.id, now]);
  const context = providerContext(event);
  await auditPaymentEvent(tx, context, event, payment.id, "refunded", revoked.length);
  await publishPaymentNotification(notifications, payment, statusEvent.id, "refunded", now);
  return processed(tx, event, payment.id, "applied_refunded", now);
}

async function publishPaymentNotification(notifications: NotificationPublisher, payment: PaymentRow,
  paymentStatusEventId: string, status: "succeeded" | "canceled" | "refunded", occurredAt: Date) {
  await notifications.publish(materializePaymentStatusNotification({
    recipientUserId: payment.userId,
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    paymentStatusEventId,
    status,
    occurredAt,
  }));
}

async function processed(tx: TransactionalSqlClient, event: ProviderEventRow, paymentId: string,
  outcome: PaymentProviderEventOutcome, now?: Date): Promise<PaymentProviderEventResult> {
  const at = now ?? await databaseNow(tx);
  const row = requireRow(await tx.query<ProviderEventRow>(
    `update payment_provider_events set state = 'processed', outcome = $2, payment_id = $3,
       processed_at = $4, updated_at = $4 where id = $1 and state = 'pending'
     returning id, provider_event_id as "providerEventId", state, outcome`,
    [event.id, outcome, paymentId, at]), "payment provider event completion");
  return toResult(row);
}

async function deferOrQuarantine(tx: TransactionalSqlClient, event: ProviderEventRow, reason: string) {
  const now = await databaseNow(tx);
  const attempts = event.attemptCount + 1;
  if (attempts >= MAX_RECONCILIATION_ATTEMPTS || now.getTime() - event.receivedAt.getTime() >= MAX_RECONCILIATION_AGE_MS) {
    return quarantine(tx, event, `${reason}_expired`, now);
  }
  const delaySeconds = Math.min(300, 2 ** Math.min(attempts, 8));
  const row = requireRow(await tx.query<ProviderEventRow>(
    `update payment_provider_events set attempt_count = $2,
       next_attempt_at = $3::timestamptz + ($4::text || ' seconds')::interval,
       updated_at = $3::timestamptz
     where id = $1 and state = 'pending'
     returning id, provider_event_id as "providerEventId", state, outcome`,
    [event.id, attempts, now, delaySeconds]), "payment provider event deferral");
  return toResult(row);
}

async function quarantine(tx: TransactionalSqlClient, event: ProviderEventRow, reason: string, now?: Date) {
  const at = now ?? await databaseNow(tx);
  const row = requireRow(await tx.query<ProviderEventRow>(
    `update payment_provider_events set state = 'quarantined', quarantine_reason = $2,
       quarantined_at = $3, updated_at = $3, attempt_count = least(attempt_count + 1, 100)
     where id = $1 and state = 'pending'
     returning id, provider_event_id as "providerEventId", state, outcome`,
    [event.id, reason, at]), "payment provider event quarantine");
  const context = providerContext(event);
  await new PostgresAuditWriter(tx).record(buildAuditEvent(context, {
    actorType: "service",
    action: "billing.provider_event.quarantine",
    resourceType: "payment_provider_event",
    resourceId: event.id,
    allowed: false,
    policyDecisionId: null,
    dataClasses: ["payment_business", "audit_security"],
    metadata: { provider: event.provider, providerEventId: event.providerEventId, eventType: event.eventType, reason },
  }));
  return toResult(row);
}

async function auditPaymentEvent(tx: TransactionalSqlClient, context: ReturnType<typeof providerContext>,
  event: ProviderEventRow, paymentId: string, status: string, revokedEntitlementCount: number) {
  await new PostgresAuditWriter(tx).record(buildAuditEvent(context, {
    actorType: "service",
    action: `billing.payment.${status}`,
    resourceType: "payment",
    resourceId: paymentId,
    allowed: true,
    policyDecisionId: null,
    dataClasses: ["payment_business"],
    metadata: {
      provider: event.provider,
      providerEventId: event.providerEventId,
      invoiceId: event.invoiceId,
      amountMinor: event.amountMinor,
      currency: event.currency,
      revokedEntitlementCount,
    },
  }));
}

function providerContext(event: ProviderEventRow) {
  return createRequestContext({
    requestId: `payment-provider:${event.id}`,
    activeRole: "cuac_admin",
    selectedSurface: "ops",
    purpose: "billing",
    authStrength: "step_up",
    dataClassAllowlist: ["payment_business", "audit_security"],
  });
}

function selectProviderEventSql() {
  return `select id, provider, provider_event_id as "providerEventId", event_type as "eventType",
    payload_sha256 as "payloadSha256", invoice_id as "invoiceId", payment_id as "paymentId",
    provider_checkout_session_id as "providerCheckoutSessionId", provider_payment_id as "providerPaymentId",
    amount_minor as "amountMinor", currency, occurred_at as "occurredAt", state, outcome,
    attempt_count as "attemptCount", received_at as "receivedAt" from payment_provider_events`;
}

function sameEvent(row: ProviderEventRow, event: PaymentProviderEvent, payloadSha256: string) {
  return row.provider === CUAC_HOSTED_PAYMENT_PROVIDER && row.providerEventId === event.eventId
    && row.eventType === event.eventType && row.payloadSha256 === payloadSha256 && row.invoiceId === event.invoiceId
    && row.providerCheckoutSessionId === event.providerCheckoutSessionId
    && row.providerPaymentId === event.providerPaymentId && row.amountMinor === event.amountMinor
    && row.currency === event.currency && row.occurredAt.getTime() === event.occurredAt.getTime();
}

function toResult(row: Pick<ProviderEventRow, "id" | "providerEventId" | "state" | "outcome">): PaymentProviderEventResult {
  return { id: row.id, providerEventId: row.providerEventId, state: row.state, outcome: row.outcome };
}

async function databaseNow(tx: TransactionalSqlClient): Promise<Date> {
  const now = (await tx.query<{ now: Date }>("select transaction_timestamp() as now", []))[0]?.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw serviceUnavailable("Database time is unavailable.");
  return now;
}

function requireRow<T>(rows: readonly T[], action: string): T {
  const value = rows[0];
  if (!value) throw serviceUnavailable(`PostgreSQL did not return a row for ${action}.`);
  return value;
}
