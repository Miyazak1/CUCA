import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequestContext,
  CuacError,
  PostgresApplicationFeeEntitlementService,
  readCurrentApplicationFeeEntitlement,
} from "../../../src/server/index.ts";

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  user: "10000000-0000-4000-8000-000000000002",
  set: "10000000-0000-4000-8000-000000000003",
  choice: "10000000-0000-4000-8000-000000000004",
  school: "10000000-0000-4000-8000-000000000005",
  program: "10000000-0000-4000-8000-000000000006",
  intake: "10000000-0000-4000-8000-000000000007",
  invoice: "10000000-0000-4000-8000-000000000008",
  line: "10000000-0000-4000-8000-000000000009",
  serviceLine: "10000000-0000-4000-8000-00000000000a",
  payment: "10000000-0000-4000-8000-00000000000b",
  event: "10000000-0000-4000-8000-00000000000c",
  entitlement: "10000000-0000-4000-8000-00000000000d",
};
const now = new Date("2026-09-01T04:00:00.000Z");
const pricingDigest = "a".repeat(64);
const grantDigest = "b".repeat(64);
const adminContext = createRequestContext({ requestId: "req-entitlement-1", actorUserId: ids.admin,
  activeRole: "cuac_admin", selectedSurface: "ops", purpose: "billing", authStrength: "step_up" });

function createClient(responder) {
  const calls = [];
  const client = {
    async query(statement, params) {
      calls.push({ statement, params });
      return responder(statement, params, calls.length);
    },
    async transaction(work) { return work(client); },
  };
  return { client, calls };
}

function settledPayment() {
  return {
    paymentId: ids.payment, paymentStatus: "succeeded", paidAt: now,
    paymentAmountMinor: 120000, paymentCurrency: "CNY", userId: ids.user,
    invoiceId: ids.invoice, applicationSetId: ids.set, invoiceStatus: "paid",
    invoiceSubtotalMinor: 120000, invoiceDiscountMinor: 0, invoiceTotalMinor: 120000,
    invoiceCurrency: "CNY", invoiceFinalizedAt: now, eventId: ids.event,
    eventStatus: "succeeded", providerEventId: "provider-event-1",
  };
}

function invoiceLines(route = "direct_university") {
  return [
    { id: ids.line, lineFormat: "cuac.invoice-line.v2", userId: ids.user, applicationSetId: ids.set,
      applicationChoiceId: ids.choice, schoolId: ids.school, programId: ids.program, programIntakeId: ids.intake,
      admissionRouteKey: "direct_university", lineType: "application_fee", feeCode: "application_submission",
      amountMinor: 80000, currency: "CNY", pricingBasisSha256: pricingDigest,
      choiceAdmissionRouteKey: route, choiceRemovedAt: null },
    { id: ids.serviceLine, lineFormat: "cuac.invoice-line.v2", userId: ids.user, applicationSetId: ids.set,
      applicationChoiceId: null, schoolId: null, programId: null, programIntakeId: null,
      admissionRouteKey: null, lineType: "service_fee", feeCode: "cuac_service",
      amountMinor: 40000, currency: "CNY", pricingBasisSha256: pricingDigest,
      choiceAdmissionRouteKey: null, choiceRemovedAt: null },
  ];
}

function storedEntitlement() {
  return { id: ids.entitlement, userId: ids.user, applicationSetId: ids.set, applicationChoiceId: ids.choice,
    schoolId: ids.school, programId: ids.program, programIntakeId: ids.intake,
    admissionRouteKey: "direct_university", status: "active", grantedAt: now,
    expiresAt: null, grantKeySha256: grantDigest };
}

test("entitlement grant requires internal step-up billing authority before storage", async () => {
  for (const context of [createRequestContext(), createRequestContext({ actorUserId: ids.admin,
    activeRole: "cuac_admin", purpose: "billing", authStrength: "session" }),
  createRequestContext({ actorUserId: ids.admin, activeRole: "cuac_ops", purpose: "billing", authStrength: "step_up" })]) {
    const { client, calls } = createClient(() => []);
    await assert.rejects(() => new PostgresApplicationFeeEntitlementService(client).grantFromSettledPayment(context,
      { paymentId: ids.payment, paymentStatusEventId: ids.event }),
    error => error instanceof CuacError && error.code === "FORBIDDEN");
    assert.equal(calls.length, 0);
  }
});

test("entitlement grant locks exact settled evidence and audits only business identifiers", async () => {
  const { client, calls } = createClient(statement => {
    if (/transaction_timestamp/.test(statement)) return [{ now }];
    if (/from payments p/.test(statement)) return [settledPayment()];
    if (/from invoice_lines il/.test(statement)) return invoiceLines();
    if (/from application_choices/.test(statement)) return [{ id: ids.choice,
      choiceAdmissionRouteKey: "direct_university", choiceRemovedAt: null }];
    if (/insert into application_fee_entitlements/.test(statement)) return [storedEntitlement()];
    return [];
  });
  const result = await new PostgresApplicationFeeEntitlementService(client).grantFromSettledPayment(adminContext,
    { paymentId: ids.payment, paymentStatusEventId: ids.event });
  assert.equal(result.length, 1);
  assert.equal(result[0].applicationChoiceId, ids.choice);
  assert.equal(result[0].evidenceCurrent, true);
  assert.ok(calls.some(call => /for update of p, i, pse/.test(call.statement)));
  assert.ok(calls.some(call => /from invoice_lines il[\s\S]*for update of il/.test(call.statement)));
  assert.ok(calls.some(call => /from application_choices[\s\S]*for update/.test(call.statement)));
  const insert = calls.find(call => /insert into application_fee_entitlements/.test(call.statement));
  assert.equal(insert.params[2], ids.choice);
  assert.equal(insert.params[6], "direct_university");
  const audit = calls.find(call => /insert into audit_logs/.test(call.statement));
  assert.ok(audit);
  assert.doesNotMatch(JSON.stringify(audit.params), /provider-event-1|checkout|card|cvv/i);
});

test("entitlement grant rejects stale route and incomplete settlement without writing", async () => {
  for (const responder of [
    statement => /transaction_timestamp/.test(statement) ? [{ now }]
      : /from payments p/.test(statement) ? [{ ...settledPayment(), paymentStatus: "refunded" }] : [],
    statement => /transaction_timestamp/.test(statement) ? [{ now }]
      : /from payments p/.test(statement) ? [settledPayment()]
        : /from invoice_lines il/.test(statement) ? invoiceLines()
          : /from application_choices/.test(statement) ? [{ id: ids.choice,
            choiceAdmissionRouteKey: "csc", choiceRemovedAt: null }] : [],
  ]) {
    const { client, calls } = createClient(responder);
    await assert.rejects(() => new PostgresApplicationFeeEntitlementService(client).grantFromSettledPayment(adminContext,
      { paymentId: ids.payment, paymentStatusEventId: ids.event }),
    error => error instanceof CuacError && error.code === "SERVICE_UNAVAILABLE");
    assert.equal(calls.some(call => /insert into application_fee_entitlements|insert into audit_logs/.test(call.statement)), false);
  }
});

test("entitlement reader returns current only for the exact live payment and route projection", async () => {
  const currentRow = {
    ...storedEntitlement(), currentAdmissionRouteKey: "direct_university", choiceRemovedAt: null,
    invoiceStatus: "paid", invoiceFinalizedAt: now, paymentStatus: "succeeded", paidAt: now,
    eventStatus: "succeeded", lineFormat: "cuac.invoice-line.v2", lineType: "application_fee",
    feeCode: "application_submission", pricingBasisSha256: pricingDigest, amountMinor: 80000, currency: "CNY",
    lineUserId: ids.user, lineApplicationSetId: ids.set, lineApplicationChoiceId: ids.choice,
    lineSchoolId: ids.school, lineProgramId: ids.program, lineProgramIntakeId: ids.intake,
    lineAdmissionRouteKey: "direct_university",
  };
  for (const [row, expected] of [[currentRow, true], [{ ...currentRow, paymentStatus: "refunded" }, false],
    [{ ...currentRow, currentAdmissionRouteKey: "csc" }, false]]) {
    const { client, calls } = createClient(statement => /transaction_timestamp/.test(statement) ? [{ now }] : [row]);
    const result = await readCurrentApplicationFeeEntitlement(client, ids.user, ids.set, ids.choice);
    assert.equal(result.evidenceCurrent, expected);
    assert.doesNotMatch(calls[0].statement, /provider_event_id|provider_payment_id|provider_checkout_session_id|metadata_json/i);
  }
});
