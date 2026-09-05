import assert from "node:assert/strict";
import test from "node:test";
import { BillingFacadeService, CuacError, createRequestContext, rejectSensitivePaymentPayload } from "../../../src/server/index.ts";
import "./application-fee-entitlement.test.mjs";

const applicationSetId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const choiceOneId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2";
const choiceTwoId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee3";
const invoiceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee4";

function createRepository(overrides = {}) {
  const calls = [];
  return {
    calls,
    repository: {
      async getApplicationSetOwner(applicationSetId) {
        calls.push({ method: "getApplicationSetOwner", applicationSetId });
        return { id: applicationSetId, userId: "student-1", status: "draft" };
      },
      async previewFees(userId, input) {
        calls.push({ method: "previewFees", userId, input });
        return {
          applicationSetId: input.applicationSetId,
          currency: "CNY",
          subtotalMinor: 120000,
          discountMinor: 0,
          totalMinor: 120000,
          lines: [
            { lineType: "application_fee", feeCode: "application_submission", description: "Application fee", amountMinor: 80000, currency: "CNY" },
            { lineType: "service_fee", feeCode: "cuac_service", description: "CUAC service fee", amountMinor: 40000, currency: "CNY" },
          ],
        };
      },
      async createCheckoutIntent(userId, input) {
        calls.push({ method: "createCheckoutIntent", userId, input });
        return {
          invoiceId: "invoice-1",
          checkoutSessionId: "checkout-1",
          provider: "hosted_provider",
          providerCheckoutSessionId: "provider-session-1",
          checkoutUrl: "https://pay.example.test/checkout/provider-session-1",
          amount: { amountMinor: 120000, currency: "CNY" },
          status: "requires_payment",
        };
      },
      async getCheckoutStatus(userId, requestedInvoiceId) {
        calls.push({ method: "getCheckoutStatus", userId, invoiceId: requestedInvoiceId });
        return {
          invoiceId: requestedInvoiceId,
          applicationSetId,
          invoiceStatus: "paid",
          checkoutSessionId: "checkout-1",
          status: "succeeded",
          amount: { amountMinor: 120000, currency: "CNY" },
          paidAt: "2026-09-02T01:00:00.000Z",
          canceledAt: null,
          refundedAt: null,
        };
      },
      ...overrides,
    },
  };
}

test("billing facade previews fees only for the student who owns the application set", async () => {
  const { repository, calls } = createRepository();
  const service = new BillingFacadeService(repository);
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1", purpose: "billing" });

  const preview = await service.previewStudentFees(context, {
    applicationSetId,
    applicationChoiceIds: [choiceTwoId, choiceOneId],
  });

  assert.equal(preview.totalMinor, 120000);
  assert.deepEqual(calls, [
    { method: "getApplicationSetOwner", applicationSetId },
    {
      method: "previewFees",
      userId: "student-1",
      input: { applicationSetId, applicationChoiceIds: [choiceOneId, choiceTwoId] },
    },
  ]);
});

test("billing facade rejects duplicate choices and unimplemented pricing inputs", async () => {
  for (const input of [
    { applicationSetId, applicationChoiceIds: [choiceOneId, choiceOneId] },
    { applicationSetId, applicationChoiceIds: [choiceOneId], couponCode: "EARLY" },
  ]) {
    const { repository, calls } = createRepository();
    const service = new BillingFacadeService(repository);
    await assert.rejects(() => service.previewStudentFees(
      createRequestContext({ activeRole: "student", actorUserId: "student-1", purpose: "billing" }), input,
    ), error => error instanceof CuacError && error.code === "BAD_REQUEST");
    assert.equal(calls.length, 0);
  }
});

test("billing facade denies cross-student and guest access before fee calculation", async () => {
  for (const context of [
    createRequestContext(),
    createRequestContext({ activeRole: "student", actorUserId: "student-2", purpose: "billing" }),
  ]) {
    const { repository, calls } = createRepository();
    const service = new BillingFacadeService(repository);

    await assert.rejects(
      () => service.previewStudentFees(context, { applicationSetId, applicationChoiceIds: [choiceOneId] }),
      CuacError,
    );
    assert.equal(calls.some((call) => call.method === "previewFees"), false);
  }
});

test("billing facade rejects raw payment credential fields at any payload depth", () => {
  [
    { cardNumber: "4111111111111111" },
    { payment: { cvv: "123" } },
    { providerMetadata: { bankAccount: "private-bank" } },
    { nested: [{ payment_token: "tok_private" }] },
  ].forEach((payload) => {
    assert.throws(() => rejectSensitivePaymentPayload(payload), CuacError);
  });
});

test("billing facade creates checkout intent without accepting or auditing payment credentials", async () => {
  const { repository } = createRepository();
  const auditEvents = [];
  const service = new BillingFacadeService(repository, {
    async record(event) {
      auditEvents.push(event);
    },
  });
  const context = createRequestContext({
    requestId: "req-billing-1",
    activeRole: "student",
    actorUserId: "student-1",
    purpose: "billing",
    policyDecisionId: "policy-billing-1",
  });

  const intent = await service.createStudentCheckoutIntent(context, {
    applicationSetId,
    applicationChoiceIds: [choiceOneId],
    successReturnPath: "/application.html#send",
    cancelReturnPath: "/application.html#fee",
  });

  assert.equal(intent.status, "requires_payment");
  assert.equal(intent.amount.amountMinor, 120000);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "billing.checkout_intent.create");
  assert.equal(auditEvents[0].resourceType, "invoice");
  assert.equal(auditEvents[0].resourceId, "invoice-1");
  assert.deepEqual(auditEvents[0].dataClasses, ["payment_business"]);
  assert.deepEqual(auditEvents[0].metadata, {
    applicationSetId,
    choiceCount: 1,
    provider: "hosted_provider",
    checkoutSessionId: "checkout-1",
    amountMinor: 120000,
    currency: "CNY",
  });

  const serializedEvent = JSON.stringify(auditEvents[0]);
  assert.equal(serializedEvent.includes("provider-session-1"), false);
  assert.equal(serializedEvent.includes("pay.example.test"), false);
});

test("billing facade rejects external return paths and client provider metadata", async () => {
  for (const extra of [
    { cancelReturnPath: "https://evil.example.test/cancel" },
    { providerMetadata: { safeReference: "not-client-authority" } },
  ]) {
    const { repository, calls } = createRepository();
    const service = new BillingFacadeService(repository);
    await assert.rejects(() => service.createStudentCheckoutIntent(
      createRequestContext({ activeRole: "student", actorUserId: "student-1", purpose: "billing" }),
      { applicationSetId, applicationChoiceIds: [choiceOneId], successReturnPath: "/application.html#send",
        cancelReturnPath: "/application.html#fee", ...extra },
    ), error => error instanceof CuacError && error.code === "BAD_REQUEST");
    assert.equal(calls.length, 0);
  }
});

test("billing facade reads an owner-scoped checkout status without auditing provider evidence", async () => {
  const { repository, calls } = createRepository();
  const auditEvents = [];
  const service = new BillingFacadeService(repository, { async record(event) { auditEvents.push(event); } });
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1", purpose: "billing" });

  const status = await service.getStudentCheckoutStatus(context, invoiceId);

  assert.equal(status.status, "succeeded");
  assert.deepEqual(calls, [{ method: "getCheckoutStatus", userId: "student-1", invoiceId }]);
  assert.equal(auditEvents[0].action, "billing.checkout_status.read");
  assert.deepEqual(auditEvents[0].metadata, {
    applicationSetId,
    invoiceStatus: "paid",
    checkoutStatus: "succeeded",
    amountMinor: 120000,
    currency: "CNY",
  });
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), /provider|pay\.example|provider-session/i);
});

test("billing facade gives guests and cross-student invoice reads the same closed response", async () => {
  for (const context of [createRequestContext(),
    createRequestContext({ activeRole: "student", actorUserId: "student-2", purpose: "billing" })]) {
    const { repository, calls } = createRepository({
      async getCheckoutStatus(userId, requestedInvoiceId) {
        calls.push({ method: "getCheckoutStatus", userId, invoiceId: requestedInvoiceId });
        return null;
      },
    });
    const service = new BillingFacadeService(repository);
    await assert.rejects(() => service.getStudentCheckoutStatus(context, invoiceId),
      error => error instanceof CuacError && error.code === "FORBIDDEN");
    if (context.activeRole === "student") assert.deepEqual(calls,
      [{ method: "getCheckoutStatus", userId: "student-2", invoiceId }]);
    else assert.deepEqual(calls, []);
  }
});
