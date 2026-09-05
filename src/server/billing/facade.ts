import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, forbidden } from "../shared/errors.ts";
import { inputList, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { DataClass, RequestContext } from "../shared/request-context.ts";

const SENSITIVE_PAYMENT_KEYS = new Set([
  "card",
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "expiry",
  "expiration",
  "bankAccount",
  "bank_account",
  "iban",
  "routingNumber",
  "routing_number",
  "accountNumber",
  "account_number",
  "paymentToken",
  "payment_token",
  "source",
]);

export type MoneyDto = {
  amountMinor: number;
  currency: string;
};

export type FeePreviewInput = {
  applicationSetId: string;
  applicationChoiceIds: readonly string[];
};

export type FeePreviewDto = {
  applicationSetId: string;
  cuacId: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  lines: readonly InvoiceLineDto[];
};

export type InvoiceLineDto = {
  lineType: "application_fee" | "service_fee" | "discount";
  feeCode: "application_submission" | "cuac_service";
  description: string;
  amountMinor: number;
  currency: string;
  applicationChoiceId?: string | null;
  schoolId?: string | null;
  programId?: string | null;
  programIntakeId?: string | null;
  admissionRouteKey?: string | null;
};

export type CheckoutIntentInput = FeePreviewInput & {
  successReturnPath: string;
  cancelReturnPath: string;
};

export type CheckoutIntentDto = {
  invoiceId: string;
  cuacId: string;
  checkoutSessionId: string;
  provider: string;
  providerCheckoutSessionId: string;
  checkoutUrl: string;
  amount: MoneyDto;
  status: "requires_payment";
};

export type CheckoutStatusDto = {
  invoiceId: string;
  applicationSetId: string;
  cuacId: string;
  invoiceStatus: "draft" | "paid" | "void";
  checkoutSessionId: string;
  status: "requires_payment" | "succeeded" | "canceled" | "refunded";
  amount: MoneyDto;
  paidAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
};

export type BillingRepository = {
  getApplicationSetOwner(applicationSetId: string): Promise<{ id: string; userId: string; status: string } | null>;
  getCheckoutStatus(userId: string, invoiceId: string): Promise<CheckoutStatusDto | null>;
  previewFees(userId: string, input: FeePreviewInput): Promise<FeePreviewDto>;
  createCheckoutIntent(userId: string, input: CheckoutIntentInput): Promise<CheckoutIntentDto>;
};

export class BillingFacadeService {
  private readonly repository: BillingRepository;
  private readonly auditSink: AuditSink | null;

  constructor(repository: BillingRepository, auditSink: AuditSink | null = null) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async previewStudentFees(context: RequestContext, input: FeePreviewInput): Promise<FeePreviewDto> {
    rejectSensitivePaymentPayload(input);
    requireStudentBillingContext(context);
    const normalized = normalizeFeePreviewInput(input);
    const userId = await this.requireStudentApplicationSetOwner(context, normalized.applicationSetId);
    const preview = await this.repository.previewFees(userId, normalized);
    await this.recordAudit(context, {
      action: "billing.fee_preview.read",
      resourceType: "application_set",
      resourceId: input.applicationSetId,
      dataClasses: ["payment_business"],
      metadata: {
        applicationSetId: normalized.applicationSetId,
        choiceCount: normalized.applicationChoiceIds.length,
        currency: preview.currency,
        totalMinor: preview.totalMinor,
        hasDiscount: preview.discountMinor > 0,
      },
    });
    return preview;
  }

  async createStudentCheckoutIntent(context: RequestContext, input: CheckoutIntentInput): Promise<CheckoutIntentDto> {
    rejectSensitivePaymentPayload(input);
    requireStudentBillingContext(context);
    const normalized = normalizeCheckoutIntentInput(input);
    const userId = await this.requireStudentApplicationSetOwner(context, normalized.applicationSetId);
    const intent = await this.repository.createCheckoutIntent(userId, normalized);
    await this.recordAudit(context, {
      action: "billing.checkout_intent.create",
      resourceType: "invoice",
      resourceId: intent.invoiceId,
      dataClasses: ["payment_business"],
      metadata: {
        applicationSetId: normalized.applicationSetId,
        choiceCount: normalized.applicationChoiceIds.length,
        provider: intent.provider,
        checkoutSessionId: intent.checkoutSessionId,
        amountMinor: intent.amount.amountMinor,
        currency: intent.amount.currency,
      },
    });
    return intent;
  }

  async getStudentCheckoutStatus(context: RequestContext, invoiceId: string): Promise<CheckoutStatusDto> {
    const userId = requireStudentBillingContext(context);
    const normalizedInvoiceId = inputUuid(invoiceId, "Invoice id");
    requireOwnBillingAuthority(context, userId);
    const status = await this.repository.getCheckoutStatus(userId, normalizedInvoiceId);
    if (!status) {
      throw forbidden("Invoice not found or not available to this student.");
    }
    await this.recordAudit(context, {
      action: "billing.checkout_status.read",
      resourceType: "invoice",
      resourceId: normalizedInvoiceId,
      dataClasses: ["payment_business"],
      metadata: {
        applicationSetId: status.applicationSetId,
        invoiceStatus: status.invoiceStatus,
        checkoutStatus: status.status,
        amountMinor: status.amount.amountMinor,
        currency: status.amount.currency,
      },
    });
    return status;
  }

  private async requireStudentApplicationSetOwner(context: RequestContext, applicationSetId: string): Promise<string> {
    if (context.activeRole !== "student" || !context.actorUserId) {
      throw forbidden("Authenticated student billing context is required.");
    }

    const applicationSet = await this.repository.getApplicationSetOwner(applicationSetId);
    if (!applicationSet || applicationSet.userId !== context.actorUserId) {
      throw forbidden("Application set not found or not available to this student.");
    }

    requireOwnBillingAuthority(context, applicationSet.userId);

    return context.actorUserId;
  }

  private async recordAudit(
    context: RequestContext,
    input: {
      action: string;
      resourceType: string;
      resourceId: string | null;
      dataClasses: readonly DataClass[];
      metadata?: unknown;
    },
  ) {
    if (!this.auditSink) {
      return;
    }

    await this.auditSink.record(
      buildAuditEvent(context, {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        allowed: true,
        policyDecisionId: context.policyDecisionId,
        dataClasses: input.dataClasses,
        metadata: input.metadata,
      }),
    );
  }
}

function requireStudentBillingContext(context: RequestContext): string {
  if (context.activeRole !== "student" || !context.actorUserId) {
    throw forbidden("Authenticated student billing context is required.");
  }
  return context.actorUserId;
}

function requireOwnBillingAuthority(context: RequestContext, ownerUserId: string) {
  const decision = evaluatePolicy(context, "billing.manage_own", {
    type: "billing",
    ownerUserId,
    dataClasses: ["payment_business"],
  });
  if (!decision.allowed) throw forbidden(decision.reason);
}

export function rejectSensitivePaymentPayload(value: unknown): void {
  const sensitivePath = findSensitivePaymentPath(value);
  if (sensitivePath) {
    throw forbidden(`Raw payment credential fields are not accepted by CUAC billing: ${sensitivePath}`);
  }
}

function findSensitivePaymentPath(value: unknown, path = "$"): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findSensitivePaymentPath(value[index], `${path}[${index}]`);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_PAYMENT_KEYS.has(key)) {
      return `${path}.${key}`;
    }

    const nested = findSensitivePaymentPath(nestedValue, `${path}.${key}`);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function normalizeFeePreviewInput(input: FeePreviewInput): FeePreviewInput {
  const record = inputRecord(input, ["applicationSetId", "applicationChoiceIds"], true);
  return {
    applicationSetId: inputUuid(record.applicationSetId, "Application set id"),
    applicationChoiceIds: inputList(record.applicationChoiceIds, "Application choice ids", 20,
      value => inputUuid(value, "Application choice id")).sort(),
  };
}

export function normalizeCheckoutIntentInput(input: CheckoutIntentInput): CheckoutIntentInput {
  const record = inputRecord(input, ["applicationSetId", "applicationChoiceIds", "successReturnPath", "cancelReturnPath"], true);
  const preview = normalizeFeePreviewInput({
    applicationSetId: record.applicationSetId as string,
    applicationChoiceIds: record.applicationChoiceIds as readonly string[],
  });
  return {
    ...preview,
    successReturnPath: normalizeReturnPath(record.successReturnPath, "Success return path"),
    cancelReturnPath: normalizeReturnPath(record.cancelReturnPath, "Cancel return path"),
  };
}

function normalizeReturnPath(value: unknown, field: string): string {
  const path = inputText(value, field, 512);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw badRequest(`${field} must be a local application path.`);
  }
  return path;
}
