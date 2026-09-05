import { createHash } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import type {
  BillingRepository,
  CheckoutIntentDto,
  CheckoutIntentInput,
  CheckoutStatusDto,
  FeePreviewDto,
  FeePreviewInput,
  InvoiceLineDto,
} from "./facade.ts";

export type SqlBillingClient = TransactionalSqlClient;

export type BillingFeeSchedule = {
  currency: string;
  applicationFeeMinor: number;
  serviceFeeMinor: number;
};

export type HostedCheckoutProvider = {
  readonly provider: string;
  createCheckoutSession(input: {
    invoiceId: string;
    idempotencyKey: string;
    amountMinor: number;
    currency: string;
    successReturnPath: string;
    cancelReturnPath: string;
    metadata: Record<string, unknown>;
  }): Promise<{
    providerCheckoutSessionId: string;
    checkoutUrl: string;
  }>;
};

type ApplicationSetOwnerRow = { id: string; userId: string; status: string };
type BillableChoiceRow = {
  id: string;
  cuacId: string;
  schoolId: string;
  programId: string;
  programIntakeId: string;
  admissionRouteKey: string;
  schoolName: string;
  programName: string;
};
type InvoiceRow = {
  id: string;
  userId: string;
  applicationSetId: string;
  cuacId: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  provider: string | null;
  idempotencyKey: string;
};
type PaymentRow = {
  id: string;
  invoiceId: string;
  userId: string;
  provider: string;
  providerCheckoutSessionId: string;
  status: string;
  amountMinor: number;
  currency: string;
};
type CheckoutStatusRow = {
  invoiceId: string;
  applicationSetId: string | null;
  cuacId: string | null;
  invoiceStatus: string;
  invoiceAmountMinor: number;
  invoiceCurrency: string;
  checkoutSessionId: string | null;
  paymentStatus: string | null;
  paymentAmountMinor: number | null;
  paymentCurrency: string | null;
  paidAt: Date | string | null;
  canceledAt: Date | string | null;
  refundedAt: Date | string | null;
};
type PersistedInvoiceLine = InvoiceLineDto & {
  lineFormat: "cuac.invoice-line.v2";
  userId: string;
  applicationSetId: string;
  pricingBasisSha256: string;
};
type FeeQuote = { preview: FeePreviewDto; persistedLines: readonly PersistedInvoiceLine[] };

export class PostgresBillingRepository implements BillingRepository {
  private readonly client: TransactionalSqlClient;
  private readonly feeSchedule: BillingFeeSchedule;
  private readonly checkoutProvider: HostedCheckoutProvider | null;

  constructor(client: TransactionalSqlClient, feeSchedule: BillingFeeSchedule, checkoutProvider: HostedCheckoutProvider | null = null) {
    this.client = client;
    this.feeSchedule = feeSchedule;
    this.checkoutProvider = checkoutProvider;
  }

  async getApplicationSetOwner(applicationSetId: string): Promise<ApplicationSetOwnerRow | null> {
    const rows = await this.client.query<ApplicationSetOwnerRow>(
      `select id, user_id as "userId", status
       from application_sets
       where id = $1
       limit 1`,
      [applicationSetId],
    );
    return rows[0] ?? null;
  }

  async getCheckoutStatus(userId: string, invoiceId: string): Promise<CheckoutStatusDto | null> {
    const rows = await this.client.query<CheckoutStatusRow>(
      `select i.id as "invoiceId", i.application_set_id as "applicationSetId", i.cuac_id as "cuacId",
         i.status as "invoiceStatus", i.total_minor as "invoiceAmountMinor",
         i.currency as "invoiceCurrency", p.id as "checkoutSessionId",
         p.status as "paymentStatus", p.amount_minor as "paymentAmountMinor",
         p.currency as "paymentCurrency", p.paid_at as "paidAt",
         p.canceled_at as "canceledAt", p.refunded_at as "refundedAt"
       from invoices i
       left join payments p on p.invoice_id = i.id
       where i.id = $1 and i.user_id = $2
       limit 2`,
      [invoiceId, userId],
    );
    if (rows.length > 1) throw serviceUnavailable("Billing invoice has multiple checkout payments.");
    return rows[0] ? checkoutStatusDto(rows[0]) : null;
  }

  async previewFees(userId: string, input: FeePreviewInput): Promise<FeePreviewDto> {
    return this.client.transaction(async tx => {
      await tx.query("set transaction isolation level repeatable read, read only", []);
      const choices = await listBillableChoices(tx, userId, input, false);
      return buildFeeQuote(userId, input.applicationSetId, choices, this.feeSchedule).preview;
    });
  }

  async createCheckoutIntent(userId: string, input: CheckoutIntentInput): Promise<CheckoutIntentDto> {
    const provider = this.checkoutProvider;
    if (!provider) throw serviceUnavailable("Hosted checkout provider is not configured.");
    validateProviderName(provider.provider);

    const staged = await this.client.transaction(async tx => {
      const choices = await listBillableChoices(tx, userId, input, true);
      const quote = buildFeeQuote(userId, input.applicationSetId, choices, this.feeSchedule);
      const idempotencyKey = buildCheckoutIdempotencyKey(userId, input.applicationSetId,
        input.applicationChoiceIds, quote.persistedLines);
      const invoice = await createOrReadInvoice(tx, userId, quote.preview, provider.provider, idempotencyKey);
      await createOrVerifyInvoiceLines(tx, invoice.id, quote.persistedLines);
      return { invoice, quote, providerIdempotencyKey: `cuac-checkout:${invoice.id}` };
    });

    const providerSession = await provider.createCheckoutSession({
      invoiceId: staged.invoice.id,
      idempotencyKey: staged.providerIdempotencyKey,
      amountMinor: staged.quote.preview.totalMinor,
      currency: staged.quote.preview.currency,
      successReturnPath: input.successReturnPath,
      cancelReturnPath: input.cancelReturnPath,
      metadata: {
        invoiceId: staged.invoice.id,
        applicationSetId: input.applicationSetId,
        cuacId: staged.quote.preview.cuacId,
        choiceCount: input.applicationChoiceIds.length,
      },
    });
    validateProviderSession(providerSession);

    const payment = await this.client.transaction(tx => createOrReadPayment(tx, userId, staged.invoice.id,
      staged.quote.preview, provider.provider, providerSession.providerCheckoutSessionId));
    return {
      invoiceId: staged.invoice.id,
      cuacId: staged.quote.preview.cuacId,
      checkoutSessionId: payment.id,
      provider: provider.provider,
      providerCheckoutSessionId: providerSession.providerCheckoutSessionId,
      checkoutUrl: providerSession.checkoutUrl,
      amount: { amountMinor: staged.quote.preview.totalMinor, currency: staged.quote.preview.currency },
      status: "requires_payment",
    };
  }
}

async function listBillableChoices(tx: TransactionalSqlClient, userId: string, input: FeePreviewInput,
  lock: boolean): Promise<BillableChoiceRow[]> {
  requireRequestedChoiceSet(input.applicationChoiceIds);
  const rows = await tx.query<BillableChoiceRow>(
    `select ac.id, a.cuac_id as "cuacId", ac.school_id as "schoolId", ac.program_id as "programId",
       ac.program_intake_id as "programIntakeId", ac.admission_route_key as "admissionRouteKey",
       s.name_en as "schoolName", p.name_en as "programName"
     from application_choices ac
     join application_sets a on a.id = ac.application_set_id and a.user_id = ac.user_id
     join schools s on s.id = ac.school_id
     join programs p on p.id = ac.program_id and p.school_id = ac.school_id
     join program_intakes pi on pi.id = ac.program_intake_id and pi.program_id = ac.program_id
     where ac.application_set_id = $1 and ac.user_id = $2 and ac.removed_at is null
       and ac.program_id is not null and ac.program_intake_id is not null
       and ac.admission_route_key is not null and ac.id = any($3::uuid[])
     order by ac.rank_order asc, ac.created_at asc
     ${lock ? "for share of ac, a, s, p, pi" : ""}`,
    [input.applicationSetId, userId, input.applicationChoiceIds],
  );
  const actual = rows.map(row => row.id).sort();
  const requested = [...input.applicationChoiceIds].sort();
  if (actual.length !== requested.length || actual.some((id, index) => id !== requested[index])) {
    throw badRequest("Every selected application choice must be owned, active, and bound to a program, intake, and admission route.");
  }
  return rows;
}

function requireRequestedChoiceSet(choiceIds: readonly string[]) {
  if (choiceIds.length < 1 || choiceIds.length > 20 || new Set(choiceIds).size !== choiceIds.length) {
    throw badRequest("Select between 1 and 20 distinct application choices.");
  }
}

function buildFeeQuote(userId: string, applicationSetId: string, choices: readonly BillableChoiceRow[],
  feeSchedule: BillingFeeSchedule): FeeQuote {
  const cuacId = choices[0]?.cuacId;
  if (!cuacId || !/^CUAC-[0-9]{4}-[0-9]{6}$/.test(cuacId)
    || choices.some((choice) => choice.cuacId !== cuacId)) {
    throw serviceUnavailable("Application choices do not have one valid CUAC application reference.");
  }
  const applicationBasis = pricingBasisSha256("application_submission", feeSchedule.applicationFeeMinor, feeSchedule.currency);
  const applicationLines = choices.map<PersistedInvoiceLine>(choice => ({
    lineFormat: "cuac.invoice-line.v2",
    lineType: "application_fee",
    feeCode: "application_submission",
    description: "Application submission fee",
    amountMinor: feeSchedule.applicationFeeMinor,
    currency: feeSchedule.currency,
    userId,
    applicationSetId,
    applicationChoiceId: choice.id,
    schoolId: choice.schoolId,
    programId: choice.programId,
    programIntakeId: choice.programIntakeId,
    admissionRouteKey: choice.admissionRouteKey,
    pricingBasisSha256: applicationBasis,
  }));
  const serviceLines: PersistedInvoiceLine[] = feeSchedule.serviceFeeMinor > 0 ? [{
    lineFormat: "cuac.invoice-line.v2",
    lineType: "service_fee",
    feeCode: "cuac_service",
    description: "CUAC service fee",
    amountMinor: feeSchedule.serviceFeeMinor,
    currency: feeSchedule.currency,
    userId,
    applicationSetId,
    applicationChoiceId: null,
    schoolId: null,
    programId: null,
    programIntakeId: null,
    admissionRouteKey: null,
    pricingBasisSha256: pricingBasisSha256("cuac_service", feeSchedule.serviceFeeMinor, feeSchedule.currency),
  }] : [];
  const persistedLines = [...applicationLines, ...serviceLines];
  const subtotalMinor = persistedLines.reduce((sum, line) => sum + line.amountMinor, 0);
  const lines = persistedLines.map<InvoiceLineDto>(({ lineFormat: _lineFormat, userId: _userId,
    applicationSetId: _applicationSetId, pricingBasisSha256: _pricingBasisSha256, ...line }) => line);
  return {
    persistedLines,
    preview: { applicationSetId, cuacId, currency: feeSchedule.currency, subtotalMinor, discountMinor: 0,
      totalMinor: subtotalMinor, lines },
  };
}

async function createOrReadInvoice(tx: TransactionalSqlClient, userId: string, preview: FeePreviewDto,
  provider: string, idempotencyKey: string): Promise<InvoiceRow> {
  const inserted = await tx.query<InvoiceRow>(
    `insert into invoices (user_id, application_set_id, cuac_id, status, currency, subtotal_minor,
       discount_minor, total_minor, provider, idempotency_key, metadata_json)
     values ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, '{}'::jsonb)
     on conflict (idempotency_key) do nothing
     returning id, user_id as "userId", application_set_id as "applicationSetId", cuac_id as "cuacId", status,
       currency, subtotal_minor as "subtotalMinor", discount_minor as "discountMinor",
       total_minor as "totalMinor", provider, idempotency_key as "idempotencyKey"`,
    [userId, preview.applicationSetId, preview.cuacId, preview.currency, preview.subtotalMinor, preview.discountMinor,
      preview.totalMinor, provider, idempotencyKey],
  );
  const rows = inserted.length ? inserted : await tx.query<InvoiceRow>(
    `select id, user_id as "userId", application_set_id as "applicationSetId", cuac_id as "cuacId", status,
       currency, subtotal_minor as "subtotalMinor", discount_minor as "discountMinor",
       total_minor as "totalMinor", provider, idempotency_key as "idempotencyKey"
     from invoices where idempotency_key = $1 for update`,
    [idempotencyKey],
  );
  const invoice = requireRow(rows, "billing invoice create or replay");
  if (invoice.userId !== userId || invoice.applicationSetId !== preview.applicationSetId || invoice.cuacId !== preview.cuacId
    || invoice.currency !== preview.currency || invoice.subtotalMinor !== preview.subtotalMinor
    || invoice.discountMinor !== preview.discountMinor || invoice.totalMinor !== preview.totalMinor
    || invoice.provider !== provider || invoice.idempotencyKey !== idempotencyKey) {
    throw serviceUnavailable("Stored billing invoice does not match the requested fee snapshot.");
  }
  return invoice;
}

async function createOrVerifyInvoiceLines(tx: TransactionalSqlClient, invoiceId: string,
  lines: readonly PersistedInvoiceLine[]) {
  for (const line of lines) {
    const params = [invoiceId, line.applicationChoiceId ?? null, line.lineFormat, line.userId,
      line.applicationSetId, line.schoolId ?? null, line.programId ?? null, line.programIntakeId ?? null,
      line.admissionRouteKey ?? null, line.lineType, line.feeCode, line.description, line.amountMinor,
      line.currency, line.pricingBasisSha256];
    const inserted = await tx.query<{ id: string }>(
      `insert into invoice_lines (invoice_id, application_choice_id, line_format, user_id,
         application_set_id, school_id, program_id, program_intake_id, admission_route_key,
         line_type, fee_code, description, amount_minor, currency, pricing_basis_sha256, metadata_json)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, '{}'::jsonb)
       on conflict do nothing returning id`,
      params,
    );
    if (inserted.length) continue;
    const existing = await tx.query<{ id: string }>(
      `select id from invoice_lines
       where invoice_id = $1 and application_choice_id is not distinct from $2::uuid
         and line_format = $3 and user_id = $4 and application_set_id = $5
         and school_id is not distinct from $6::uuid and program_id is not distinct from $7::uuid
         and program_intake_id is not distinct from $8::uuid and admission_route_key is not distinct from $9::text
         and line_type = $10 and fee_code = $11 and description = $12
         and amount_minor = $13 and currency = $14 and pricing_basis_sha256 = $15
       for update`,
      params,
    );
    if (existing.length !== 1) throw serviceUnavailable("Stored billing line does not match the requested fee snapshot.");
  }
}

async function createOrReadPayment(tx: TransactionalSqlClient, userId: string, invoiceId: string,
  preview: FeePreviewDto, provider: string, providerCheckoutSessionId: string): Promise<PaymentRow> {
  const lockedInvoice = await tx.query<{ id: string }>(
    `select id from invoices
     where id = $1 and user_id = $2 and provider = $3 and total_minor = $4 and currency = $5
     for update`,
    [invoiceId, userId, provider, preview.totalMinor, preview.currency],
  );
  if (lockedInvoice.length !== 1) throw serviceUnavailable("Billing invoice scope changed before payment creation.");
  const existingForInvoice = await tx.query<PaymentRow>(
    `select id, invoice_id as "invoiceId", user_id as "userId", provider,
       provider_checkout_session_id as "providerCheckoutSessionId", status,
       amount_minor as "amountMinor", currency
     from payments where invoice_id = $1 for update`,
    [invoiceId],
  );
  if (existingForInvoice.length > 1) throw serviceUnavailable("Billing invoice has multiple checkout payments.");
  if (existingForInvoice[0]) return requireMatchingCheckoutPayment(existingForInvoice[0], userId,
    invoiceId, preview, provider, providerCheckoutSessionId);
  const inserted = await tx.query<PaymentRow>(
    `insert into payments (invoice_id, user_id, provider, provider_checkout_session_id,
       status, amount_minor, currency, metadata_json)
     values ($1, $2, $3, $4, 'requires_payment', $5, $6, '{}'::jsonb)
     on conflict (provider, provider_checkout_session_id)
       where provider_checkout_session_id is not null do nothing
     returning id, invoice_id as "invoiceId", user_id as "userId", provider,
       provider_checkout_session_id as "providerCheckoutSessionId", status,
       amount_minor as "amountMinor", currency`,
    [invoiceId, userId, provider, providerCheckoutSessionId, preview.totalMinor, preview.currency],
  );
  const rows = inserted.length ? inserted : await tx.query<PaymentRow>(
    `select id, invoice_id as "invoiceId", user_id as "userId", provider,
       provider_checkout_session_id as "providerCheckoutSessionId", status,
       amount_minor as "amountMinor", currency
     from payments where provider = $1 and provider_checkout_session_id = $2 for update`,
    [provider, providerCheckoutSessionId],
  );
  const payment = requireRow(rows, "billing payment create or replay");
  return requireMatchingCheckoutPayment(payment, userId, invoiceId, preview, provider, providerCheckoutSessionId);
}

function requireMatchingCheckoutPayment(payment: PaymentRow, userId: string, invoiceId: string,
  preview: FeePreviewDto, provider: string, providerCheckoutSessionId: string): PaymentRow {
  if (payment.invoiceId !== invoiceId || payment.userId !== userId || payment.provider !== provider
    || payment.providerCheckoutSessionId !== providerCheckoutSessionId
    || payment.amountMinor !== preview.totalMinor || payment.currency !== preview.currency
    || payment.status !== "requires_payment") {
    throw serviceUnavailable("Stored checkout payment does not match the provider session.");
  }
  return payment;
}

function checkoutStatusDto(row: CheckoutStatusRow): CheckoutStatusDto {
  if (!row.applicationSetId || !row.cuacId || !/^CUAC-[0-9]{4}-[0-9]{6}$/.test(row.cuacId)
    || !["draft", "paid", "void"].includes(row.invoiceStatus)
    || !row.checkoutSessionId || !row.paymentStatus
    || !["requires_payment", "succeeded", "canceled", "refunded"].includes(row.paymentStatus)
    || row.paymentAmountMinor !== row.invoiceAmountMinor || row.paymentCurrency !== row.invoiceCurrency
    || !Number.isInteger(row.invoiceAmountMinor) || row.invoiceAmountMinor < 0 || !/^[A-Z]{3}$/.test(row.invoiceCurrency)) {
    throw serviceUnavailable("Stored billing checkout status is inconsistent.");
  }
  const validPair = (row.invoiceStatus === "draft" && row.paymentStatus === "requires_payment")
    || (row.invoiceStatus === "paid" && ["succeeded", "refunded"].includes(row.paymentStatus))
    || (row.invoiceStatus === "void" && row.paymentStatus === "canceled");
  if (!validPair) throw serviceUnavailable("Stored invoice and payment lifecycles are inconsistent.");
  return {
    invoiceId: row.invoiceId,
    applicationSetId: row.applicationSetId,
    cuacId: row.cuacId,
    invoiceStatus: row.invoiceStatus as CheckoutStatusDto["invoiceStatus"],
    checkoutSessionId: row.checkoutSessionId,
    status: row.paymentStatus as CheckoutStatusDto["status"],
    amount: { amountMinor: row.invoiceAmountMinor, currency: row.invoiceCurrency },
    paidAt: optionalTimestampIso(row.paidAt),
    canceledAt: optionalTimestampIso(row.canceledAt),
    refundedAt: optionalTimestampIso(row.refundedAt),
  };
}

function optionalTimestampIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const timestamp = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw serviceUnavailable("Stored payment timestamp is invalid.");
  return timestamp.toISOString();
}

export function pricingBasisSha256(feeCode: "application_submission" | "cuac_service",
  amountMinor: number, currency: string): string {
  return createHash("sha256").update(JSON.stringify({ schemaVersion: 1, feeCode, amountMinor, currency })).digest("hex");
}

function buildCheckoutIdempotencyKey(userId: string, applicationSetId: string, choiceIds: readonly string[],
  lines: readonly PersistedInvoiceLine[]): string {
  const digest = createHash("sha256").update(JSON.stringify({
    schemaVersion: 2,
    userId,
    applicationSetId,
    choiceIds: [...choiceIds].sort(),
    lines: lines.map(line => ({ choiceId: line.applicationChoiceId ?? null, feeCode: line.feeCode,
      amountMinor: line.amountMinor, currency: line.currency, pricingBasisSha256: line.pricingBasisSha256 })),
  })).digest("hex");
  return `checkout:v2:${digest}`;
}

function validateProviderName(provider: string) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(provider)) throw serviceUnavailable("Hosted checkout provider name is invalid.");
}

function validateProviderSession(session: { providerCheckoutSessionId: string; checkoutUrl: string }) {
  if (typeof session.providerCheckoutSessionId !== "string" || session.providerCheckoutSessionId.length < 1
    || session.providerCheckoutSessionId.length > 256 || /[\u0000-\u001f\u007f]/.test(session.providerCheckoutSessionId)) {
    throw serviceUnavailable("Hosted checkout provider returned an invalid session reference.");
  }
  try {
    const url = new URL(session.checkoutUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe");
  } catch {
    throw serviceUnavailable("Hosted checkout provider returned an invalid checkout URL.");
  }
}

function requireRow<T>(rows: readonly T[], action: string): T {
  const value = rows[0];
  if (!value) throw new Error(`PostgreSQL did not return a row for ${action}.`);
  return value;
}
