import { createHash } from "node:crypto";
import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type {
  ApplicationFeeEntitlementEvidence,
  GrantApplicationFeeEntitlementsInput,
} from "./application-fee-entitlement.ts";

type SettledPaymentRow = {
  paymentId: string;
  paymentStatus: string;
  paidAt: Date | null;
  paymentAmountMinor: number;
  paymentCurrency: string;
  userId: string;
  invoiceId: string;
  applicationSetId: string | null;
  invoiceStatus: string;
  invoiceSubtotalMinor: number;
  invoiceDiscountMinor: number;
  invoiceTotalMinor: number;
  invoiceCurrency: string;
  invoiceFinalizedAt: Date | null;
  eventId: string;
  eventStatus: string;
  providerEventId: string | null;
};

type ApplicationFeeLineRow = {
  id: string;
  lineFormat: string;
  userId: string | null;
  applicationSetId: string | null;
  applicationChoiceId: string | null;
  schoolId: string | null;
  programId: string | null;
  programIntakeId: string | null;
  admissionRouteKey: string | null;
  lineType: string;
  feeCode: string | null;
  amountMinor: number;
  currency: string;
  pricingBasisSha256: string | null;
  choiceAdmissionRouteKey: string | null;
  choiceRemovedAt: Date | null;
};

type LockedChoiceRow = {
  id: string;
  choiceAdmissionRouteKey: string | null;
  choiceRemovedAt: Date | null;
};

type StoredEntitlementRow = {
  id: string;
  userId: string;
  applicationSetId: string;
  applicationChoiceId: string;
  schoolId: string;
  programId: string;
  programIntakeId: string;
  admissionRouteKey: string;
  status: string;
  grantedAt: Date;
  expiresAt: Date | null;
  grantKeySha256: string;
};

type CurrentEntitlementRow = StoredEntitlementRow & {
  currentAdmissionRouteKey: string | null;
  choiceRemovedAt: Date | null;
  invoiceStatus: string;
  invoiceFinalizedAt: Date | null;
  paymentStatus: string;
  paidAt: Date | null;
  eventStatus: string;
  lineFormat: string;
  lineType: string;
  feeCode: string;
  pricingBasisSha256: string;
  amountMinor: number;
  currency: string;
  lineUserId: string | null;
  lineApplicationSetId: string | null;
  lineApplicationChoiceId: string | null;
  lineSchoolId: string | null;
  lineProgramId: string | null;
  lineProgramIntakeId: string | null;
  lineAdmissionRouteKey: string | null;
};

export class PostgresApplicationFeeEntitlementService {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async grantFromSettledPayment(context: RequestContext,
    input: GrantApplicationFeeEntitlementsInput): Promise<ApplicationFeeEntitlementEvidence[]> {
    requireInternalGrantAuthority(context);
    return this.client.transaction(tx => grantApplicationFeeEntitlementsFromSettledPayment(tx, context, input));
  }
}

// Provider event processing calls this inside the same transaction that settles the payment.
// Human-initiated grants must continue to use PostgresApplicationFeeEntitlementService above.
export async function grantApplicationFeeEntitlementsFromSettledPayment(
  tx: TransactionalSqlClient,
  context: RequestContext,
  input: GrantApplicationFeeEntitlementsInput,
  options: { actorType?: "service" | "system" } = {},
): Promise<ApplicationFeeEntitlementEvidence[]> {
    const paymentId = inputUuid(input.paymentId, "Payment id");
    const eventId = inputUuid(input.paymentStatusEventId, "Payment status event id");
    const expiresAt = normalizeExpiry(input.expiresAt);

    const now = await databaseNow(tx);
    if (expiresAt && expiresAt <= now) throw serviceUnavailable("Application fee entitlement expiry must be in the future.");
    const payment = await lockSettledPayment(tx, paymentId, eventId);
    const lines = await lockInvoiceLines(tx, payment);
    const audit = new PostgresAuditWriter(tx);
    const entitlements: ApplicationFeeEntitlementEvidence[] = [];
    for (const line of lines.filter(value => value.lineType === "application_fee")) {
      const grantKeySha256 = entitlementGrantKey(payment.eventId, line.id);
      const stored = await insertOrReadEntitlement(tx, payment, line, grantKeySha256, expiresAt, now);
      if (stored.inserted) {
        await audit.record(buildAuditEvent(context, {
          actorType: options.actorType,
          action: "billing.application_fee_entitlement.grant",
          resourceType: "application_fee_entitlement",
          resourceId: stored.row.id,
          allowed: true,
          policyDecisionId: context.policyDecisionId,
          dataClasses: ["payment_business"],
          metadata: {
            paymentId: payment.paymentId,
            invoiceId: payment.invoiceId,
            applicationSetId: stored.row.applicationSetId,
            applicationChoiceId: stored.row.applicationChoiceId,
            amountMinor: line.amountMinor,
            currency: line.currency,
          },
        }));
      }
      entitlements.push(toEvidence(stored.row, true));
    }
    if (!entitlements.length) throw serviceUnavailable("Settled invoice has no exact v2 application fee lines.");
    return entitlements;
}

export async function readCurrentApplicationFeeEntitlement(tx: TransactionalSqlClient, userId: string,
  applicationSetId: string, applicationChoiceId: string): Promise<ApplicationFeeEntitlementEvidence | null> {
  return readApplicationFeeEntitlement(tx, userId, applicationSetId, applicationChoiceId, false);
}

export async function readLockedCurrentApplicationFeeEntitlement(tx: TransactionalSqlClient, userId: string,
  applicationSetId: string, applicationChoiceId: string): Promise<ApplicationFeeEntitlementEvidence | null> {
  return readApplicationFeeEntitlement(tx, userId, applicationSetId, applicationChoiceId, true);
}

async function readApplicationFeeEntitlement(tx: TransactionalSqlClient, userId: string,
  applicationSetId: string, applicationChoiceId: string,
  lockRows: boolean): Promise<ApplicationFeeEntitlementEvidence | null> {
  const rows = await tx.query<CurrentEntitlementRow>(
    `select e.id, e.user_id as "userId", e.application_set_id as "applicationSetId",
       e.application_choice_id as "applicationChoiceId", e.school_id as "schoolId",
       e.program_id as "programId", e.program_intake_id as "programIntakeId",
       e.admission_route_key as "admissionRouteKey", e.status, e.granted_at as "grantedAt",
       e.expires_at as "expiresAt", e.grant_key_sha256 as "grantKeySha256",
       ac.admission_route_key as "currentAdmissionRouteKey", ac.removed_at as "choiceRemovedAt",
       i.status as "invoiceStatus", i.finalized_at as "invoiceFinalizedAt",
       p.status as "paymentStatus", p.paid_at as "paidAt", pse.to_status as "eventStatus",
       il.line_format as "lineFormat", il.line_type as "lineType", il.fee_code as "feeCode",
       il.pricing_basis_sha256 as "pricingBasisSha256", il.amount_minor as "amountMinor",
       il.currency, il.user_id as "lineUserId", il.application_set_id as "lineApplicationSetId",
       il.application_choice_id as "lineApplicationChoiceId", il.school_id as "lineSchoolId",
       il.program_id as "lineProgramId", il.program_intake_id as "lineProgramIntakeId",
       il.admission_route_key as "lineAdmissionRouteKey"
     from application_fee_entitlements e
     join application_choices ac on ac.id = e.application_choice_id
     join invoices i on i.id = e.invoice_id
     join invoice_lines il on il.id = e.invoice_line_id
     join payments p on p.id = e.payment_id
     join payment_status_events pse on pse.id = e.payment_status_event_id
     where e.user_id = $1 and e.application_set_id = $2 and e.application_choice_id = $3
     order by (e.admission_route_key = ac.admission_route_key) desc, e.granted_at desc, e.id desc
     limit 1
     ${lockRows ? "for share of e, ac, i, il, p, pse" : ""}`,
    [userId, applicationSetId, applicationChoiceId],
  );
  const row = rows[0];
  if (!row) return null;
  const now = await databaseNow(tx);
  const current = row.status === "active" && row.choiceRemovedAt === null
    && row.admissionRouteKey === row.currentAdmissionRouteKey
    && (row.expiresAt === null || row.expiresAt > now)
    && row.invoiceStatus === "paid" && row.invoiceFinalizedAt instanceof Date
    && row.paymentStatus === "succeeded" && row.paidAt instanceof Date
    && row.eventStatus === "succeeded" && row.lineFormat === "cuac.invoice-line.v2"
    && row.lineType === "application_fee" && row.feeCode === "application_submission"
    && /^[a-f0-9]{64}$/.test(row.pricingBasisSha256) && row.amountMinor >= 0
    && /^[A-Z]{3}$/.test(row.currency) && row.lineUserId === row.userId
    && row.lineApplicationSetId === row.applicationSetId
    && row.lineApplicationChoiceId === row.applicationChoiceId && row.lineSchoolId === row.schoolId
    && row.lineProgramId === row.programId && row.lineProgramIntakeId === row.programIntakeId
    && row.lineAdmissionRouteKey === row.admissionRouteKey;
  return toEvidence(row, current);
}

async function lockSettledPayment(tx: TransactionalSqlClient, paymentId: string,
  eventId: string): Promise<SettledPaymentRow> {
  const rows = await tx.query<SettledPaymentRow>(
    `select p.id as "paymentId", p.status as "paymentStatus", p.paid_at as "paidAt",
       p.amount_minor as "paymentAmountMinor", p.currency as "paymentCurrency", p.user_id as "userId",
       i.id as "invoiceId", i.application_set_id as "applicationSetId", i.status as "invoiceStatus",
       i.subtotal_minor as "invoiceSubtotalMinor", i.discount_minor as "invoiceDiscountMinor",
       i.total_minor as "invoiceTotalMinor", i.currency as "invoiceCurrency",
       i.finalized_at as "invoiceFinalizedAt", pse.id as "eventId", pse.to_status as "eventStatus",
       pse.provider_event_id as "providerEventId"
     from payments p
     join invoices i on i.id = p.invoice_id and i.user_id = p.user_id
     join payment_status_events pse on pse.payment_id = p.id
     where p.id = $1 and pse.id = $2
     for update of p, i, pse`,
    [paymentId, eventId],
  );
  const row = rows[0];
  if (!row || row.applicationSetId === null || row.paymentStatus !== "succeeded" || !(row.paidAt instanceof Date)
    || row.invoiceStatus !== "paid" || !(row.invoiceFinalizedAt instanceof Date)
    || row.eventStatus !== "succeeded" || !row.providerEventId
    || row.paymentCurrency !== row.invoiceCurrency || row.paymentAmountMinor !== row.invoiceTotalMinor
    || row.invoiceDiscountMinor !== 0 || row.invoiceSubtotalMinor !== row.invoiceTotalMinor) {
    throw serviceUnavailable("Payment evidence is not an exact settled application invoice.");
  }
  return row;
}

async function lockInvoiceLines(tx: TransactionalSqlClient,
  payment: SettledPaymentRow): Promise<ApplicationFeeLineRow[]> {
  const storedLines = await tx.query<Omit<ApplicationFeeLineRow, "choiceAdmissionRouteKey" | "choiceRemovedAt">>(
    `select il.id, il.line_format as "lineFormat", il.user_id as "userId",
       il.application_set_id as "applicationSetId", il.application_choice_id as "applicationChoiceId",
       il.school_id as "schoolId", il.program_id as "programId", il.program_intake_id as "programIntakeId",
       il.admission_route_key as "admissionRouteKey", il.line_type as "lineType", il.fee_code as "feeCode",
       il.amount_minor as "amountMinor", il.currency, il.pricing_basis_sha256 as "pricingBasisSha256"
     from invoice_lines il
     where il.invoice_id = $1
     order by il.id
     for update of il`,
    [payment.invoiceId],
  );
  const choiceIds = [...new Set(storedLines.flatMap(line => line.applicationChoiceId ? [line.applicationChoiceId] : []))].sort();
  const choices = choiceIds.length ? await tx.query<LockedChoiceRow>(
    `select id, admission_route_key as "choiceAdmissionRouteKey", removed_at as "choiceRemovedAt"
     from application_choices
     where id = any($1::uuid[])
     order by id
     for update`,
    [choiceIds],
  ) : [];
  const choicesById = new Map(choices.map(choice => [choice.id, choice]));
  const rows = storedLines.map<ApplicationFeeLineRow>(line => {
    const choice = line.applicationChoiceId ? choicesById.get(line.applicationChoiceId) : null;
    return { ...line, choiceAdmissionRouteKey: choice?.choiceAdmissionRouteKey ?? null,
      choiceRemovedAt: choice?.choiceRemovedAt ?? null };
  });
  const lineTotal = rows.reduce((sum, line) => sum + line.amountMinor, 0);
  if (!rows.length || lineTotal !== payment.invoiceSubtotalMinor || rows.some(line =>
    line.lineFormat !== "cuac.invoice-line.v2" || line.userId !== payment.userId
      || line.applicationSetId !== payment.applicationSetId || line.currency !== payment.invoiceCurrency
      || !line.pricingBasisSha256 || !/^[a-f0-9]{64}$/.test(line.pricingBasisSha256)
      || (line.lineType === "application_fee"
        ? line.feeCode !== "application_submission" || !line.applicationChoiceId || !line.schoolId
          || !line.programId || !line.programIntakeId || !line.admissionRouteKey
          || !choicesById.has(line.applicationChoiceId) || line.choiceRemovedAt !== null
          || line.choiceAdmissionRouteKey !== line.admissionRouteKey
        : line.lineType !== "service_fee" || line.feeCode !== "cuac_service"
          || [line.applicationChoiceId, line.schoolId, line.programId, line.programIntakeId,
            line.admissionRouteKey].some(value => value !== null)))) {
    throw serviceUnavailable("Settled invoice lines do not form an exact v2 application fee snapshot.");
  }
  return rows;
}

async function insertOrReadEntitlement(tx: TransactionalSqlClient, payment: SettledPaymentRow,
  line: ApplicationFeeLineRow, grantKeySha256: string, expiresAt: Date | null, now: Date) {
  if (!payment.applicationSetId || !line.applicationChoiceId || !line.schoolId || !line.programId
    || !line.programIntakeId || !line.admissionRouteKey || !line.feeCode || !line.pricingBasisSha256) {
    throw serviceUnavailable("Application fee line identity is incomplete.");
  }
  const params = [payment.userId, payment.applicationSetId, line.applicationChoiceId, line.schoolId,
    line.programId, line.programIntakeId, line.admissionRouteKey, payment.invoiceId, line.id,
    payment.paymentId, payment.eventId, line.pricingBasisSha256, line.amountMinor, line.currency,
    grantKeySha256, now, expiresAt];
  const inserted = await tx.query<StoredEntitlementRow>(
    `insert into application_fee_entitlements (
       user_id, application_set_id, application_choice_id, school_id, program_id, program_intake_id,
       admission_route_key, invoice_id, invoice_line_id, payment_id, payment_status_event_id,
       pricing_basis_sha256, amount_minor, currency, grant_key_sha256, granted_at, expires_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     on conflict (grant_key_sha256) do nothing
     returning id, user_id as "userId", application_set_id as "applicationSetId",
       application_choice_id as "applicationChoiceId", school_id as "schoolId", program_id as "programId",
       program_intake_id as "programIntakeId", admission_route_key as "admissionRouteKey", status,
       granted_at as "grantedAt", expires_at as "expiresAt", grant_key_sha256 as "grantKeySha256"`,
    params,
  );
  if (inserted[0]) return { row: inserted[0], inserted: true };
  const existing = await tx.query<StoredEntitlementRow>(
    `select id, user_id as "userId", application_set_id as "applicationSetId",
       application_choice_id as "applicationChoiceId", school_id as "schoolId", program_id as "programId",
       program_intake_id as "programIntakeId", admission_route_key as "admissionRouteKey", status,
       granted_at as "grantedAt", expires_at as "expiresAt", grant_key_sha256 as "grantKeySha256"
     from application_fee_entitlements where grant_key_sha256 = $1 for update`,
    [grantKeySha256],
  );
  const row = existing[0];
  if (!row || row.userId !== payment.userId || row.applicationSetId !== payment.applicationSetId
    || row.applicationChoiceId !== line.applicationChoiceId || row.schoolId !== line.schoolId
    || row.programId !== line.programId || row.programIntakeId !== line.programIntakeId
    || row.admissionRouteKey !== line.admissionRouteKey || row.status !== "active"
    || row.expiresAt?.getTime() !== expiresAt?.getTime()) {
    throw serviceUnavailable("Stored application fee entitlement does not match the settled payment evidence.");
  }
  return { row, inserted: false };
}

function toEvidence(row: StoredEntitlementRow, current: boolean): ApplicationFeeEntitlementEvidence {
  return {
    id: row.id,
    userId: row.userId,
    applicationSetId: row.applicationSetId,
    applicationChoiceId: row.applicationChoiceId,
    schoolId: row.schoolId,
    programId: row.programId,
    programIntakeId: row.programIntakeId,
    admissionRouteKey: row.admissionRouteKey,
    status: row.status === "active" ? "active" : "revoked",
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
    evidenceCurrent: current,
  };
}

function requireInternalGrantAuthority(context: RequestContext) {
  if (context.purpose !== "billing" || context.activeRole !== "cuac_admin"
    || context.authStrength !== "step_up" || !context.actorUserId) {
    throw forbidden("Internal step-up billing authority is required to grant application fee entitlements.");
  }
}

function normalizeExpiry(value: Date | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw serviceUnavailable("Application fee entitlement expiry is invalid.");
  }
  return value;
}

function entitlementGrantKey(paymentStatusEventId: string, invoiceLineId: string): string {
  return createHash("sha256").update(JSON.stringify({ schemaVersion: 1, paymentStatusEventId, invoiceLineId })).digest("hex");
}

async function databaseNow(tx: TransactionalSqlClient): Promise<Date> {
  const rows = await tx.query<{ now: Date }>("select transaction_timestamp() as now", []);
  const now = rows[0]?.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw serviceUnavailable("Database time is unavailable.");
  return now;
}
