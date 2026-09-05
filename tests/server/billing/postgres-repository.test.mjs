import assert from "node:assert/strict";
import test from "node:test";
import { PostgresBillingRepository, CuacError } from "../../../src/server/index.ts";

const feeSchedule = {
  currency: "CNY",
  applicationFeeMinor: 80000,
  serviceFeeMinor: 40000,
};

function createClient(responder) {
  const calls = [];
  const client = {
    async query(statement, params) {
      calls.push({ statement, params });
      return responder(statement, params, calls.length);
    },
    async transaction(work) {
      return work(client);
    },
  };
  return {
    calls,
    client,
  };
}

test("Postgres billing repository reads application set ownership with fixed SQL", async () => {
  const { client, calls } = createClient(() => [{ id: "set-1", userId: "student-1", status: "draft" }]);
  const repository = new PostgresBillingRepository(client, feeSchedule);

  const owner = await repository.getApplicationSetOwner("set-1");

  assert.equal(owner.userId, "student-1");
  assert.match(calls[0].statement, /from application_sets/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.deepEqual(calls[0].params, ["set-1"]);
});

test("Postgres billing repository projects an owner-scoped checkout status without provider identifiers", async () => {
  const paidAt = new Date("2026-09-02T01:00:00.000Z");
  const { client, calls } = createClient(() => [{
    invoiceId: "invoice-1",
    applicationSetId: "set-1",
    cuacId: "CUAC-2026-004218",
    invoiceStatus: "paid",
    invoiceAmountMinor: 120000,
    invoiceCurrency: "CNY",
    checkoutSessionId: "payment-1",
    paymentStatus: "succeeded",
    paymentAmountMinor: 120000,
    paymentCurrency: "CNY",
    paidAt,
    canceledAt: null,
    refundedAt: null,
  }]);
  const repository = new PostgresBillingRepository(client, feeSchedule);

  const status = await repository.getCheckoutStatus("student-1", "invoice-1");

  assert.deepEqual(status, {
    invoiceId: "invoice-1",
    applicationSetId: "set-1",
    cuacId: "CUAC-2026-004218",
    invoiceStatus: "paid",
    checkoutSessionId: "payment-1",
    status: "succeeded",
    amount: { amountMinor: 120000, currency: "CNY" },
    paidAt: paidAt.toISOString(),
    canceledAt: null,
    refundedAt: null,
  });
  assert.deepEqual(calls[0].params, ["invoice-1", "student-1"]);
  assert.match(calls[0].statement, /where i\.id = \$1 and i\.user_id = \$2/);
  assert.doesNotMatch(calls[0].statement, /provider_|select \*/i);
});

test("Postgres billing repository previews fees from owned active choices only", async () => {
  const { client, calls } = createClient(statement => statement.startsWith("set transaction") ? [] : [
    {
      id: "choice-1",
      cuacId: "CUAC-2026-004218",
      schoolId: "school-1",
      programId: "program-1",
      programIntakeId: "intake-1",
      admissionRouteKey: "direct_university",
      schoolName: "School One",
      programName: "Computer Science",
    },
    {
      id: "choice-2",
      cuacId: "CUAC-2026-004218",
      schoolId: "school-2",
      programId: "program-2",
      programIntakeId: "intake-2",
      admissionRouteKey: "direct_university",
      schoolName: "School Two",
      programName: "Economics",
    },
  ]);
  const repository = new PostgresBillingRepository(client, feeSchedule);

  const preview = await repository.previewFees("student-1", {
    applicationSetId: "set-1",
    applicationChoiceIds: ["choice-1", "choice-2"],
  });

  assert.equal(preview.currency, "CNY");
  assert.equal(preview.cuacId, "CUAC-2026-004218");
  assert.equal(preview.subtotalMinor, 200000);
  assert.equal(preview.totalMinor, 200000);
  assert.deepEqual(
    preview.lines.map((line) => line.lineType),
    ["application_fee", "application_fee", "service_fee"],
  );
  assert.equal(calls[0].statement, "set transaction isolation level repeatable read, read only");
  assert.match(calls[1].statement, /from application_choices ac/);
  assert.match(calls[1].statement, /join schools s on s\.id = ac\.school_id/);
  assert.match(calls[1].statement, /join programs p on p\.id = ac\.program_id/);
  assert.match(calls[1].statement, /join program_intakes pi/);
  assert.match(calls[1].statement, /ac\.application_set_id = \$1/);
  assert.match(calls[1].statement, /ac\.user_id = \$2/);
  assert.match(calls[1].statement, /ac\.id = any\(\$3::uuid\[\]\)/);
  assert.doesNotMatch(calls[1].statement, /select \*/i);
  assert.doesNotMatch(calls[1].statement, /payments|auth_sessions|school_staff_memberships|agent_/i);
  assert.deepEqual(calls[1].params, ["set-1", "student-1", ["choice-1", "choice-2"]]);
});

test("Postgres billing repository rejects partial choice matches instead of charging a visible subset", async () => {
  const { client, calls } = createClient(statement => statement.startsWith("set transaction") ? [] : [{
    id: "choice-1", schoolId: "school-1", programId: "program-1", programIntakeId: "intake-1",
    admissionRouteKey: "direct_university", schoolName: "School One", programName: "Computer Science",
  }]);
  const repository = new PostgresBillingRepository(client, feeSchedule);
  await assert.rejects(() => repository.previewFees("student-1", {
    applicationSetId: "set-1", applicationChoiceIds: ["choice-1", "choice-2"],
  }), error => error instanceof CuacError && error.code === "BAD_REQUEST");
  assert.equal(calls.some(call => /insert into invoices|insert into payments/.test(call.statement)), false);
});

test("Postgres billing repository fails checkout closed without hosted provider", async () => {
  const { client, calls } = createClient(() => []);
  const repository = new PostgresBillingRepository(client, feeSchedule);

  await assert.rejects(
    () =>
      repository.createCheckoutIntent("student-1", {
        applicationSetId: "set-1",
        applicationChoiceIds: ["choice-1"],
        successReturnPath: "/application.html#send",
        cancelReturnPath: "/application.html#fee",
      }),
    (error) => error instanceof CuacError && error.code === "SERVICE_UNAVAILABLE",
  );
  assert.deepEqual(calls, []);
});

test("Postgres billing repository creates checkout records with fixed SQL and provider references only", async () => {
  const providerCalls = [];
  const provider = {
    provider: "hosted_provider",
    async createCheckoutSession(input) {
      providerCalls.push(input);
      return {
        providerCheckoutSessionId: "provider-session-1",
        checkoutUrl: "https://pay.example.test/checkout/provider-session-1",
      };
    },
  };
  const { client, calls } = createClient((statement, params) => {
    if (/from application_choices ac/.test(statement)) {
      return [
        {
          id: "choice-1",
          cuacId: "CUAC-2026-004218",
          schoolId: "school-1",
          programId: "program-1",
          programIntakeId: "intake-1",
          admissionRouteKey: "direct_university",
          schoolName: "School One",
          programName: "Computer Science",
        },
      ];
    }

    if (/insert into invoices/.test(statement)) {
      return [{ id: "invoice-1", userId: params[0], applicationSetId: params[1], cuacId: params[2], status: "draft",
        currency: params[3], subtotalMinor: params[4], discountMinor: params[5], totalMinor: params[6],
        provider: params[7], idempotencyKey: params[8] }];
    }

    if (/insert into invoice_lines/.test(statement)) {
      return [{ id: `line-${params[10]}` }];
    }

    if (/insert into payments/.test(statement)) {
      return [{ id: "payment-1", invoiceId: params[0], userId: params[1], provider: params[2],
        providerCheckoutSessionId: params[3], status: "requires_payment", amountMinor: params[4], currency: params[5] }];
    }

    if (/select id from invoices/.test(statement)) return [{ id: "invoice-1" }];
    if (/from payments where invoice_id/.test(statement)) return [];

    return [];
  });
  const repository = new PostgresBillingRepository(client, feeSchedule, provider);

  const intent = await repository.createCheckoutIntent("student-1", {
    applicationSetId: "set-1",
    applicationChoiceIds: ["choice-1"],
    successReturnPath: "/application.html#send",
    cancelReturnPath: "/application.html#fee",
  });

  assert.equal(intent.invoiceId, "invoice-1");
  assert.equal(intent.cuacId, "CUAC-2026-004218");
  assert.equal(intent.checkoutSessionId, "payment-1");
  assert.equal(intent.providerCheckoutSessionId, "provider-session-1");
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(providerCalls[0].metadata, {
    invoiceId: "invoice-1",
    applicationSetId: "set-1",
    cuacId: "CUAC-2026-004218",
    choiceCount: 1,
  });
  assert.equal(providerCalls[0].idempotencyKey, "cuac-checkout:invoice-1");

  assert.match(calls[1].statement, /insert into invoices/);
  assert.match(calls[1].statement, /on conflict \(idempotency_key\) do nothing/);
  assert.equal(calls[1].params[0], "student-1");
  assert.match(calls[1].params[8], /^checkout:v2:[a-f0-9]{64}$/);

  assert.match(calls[2].statement, /insert into invoice_lines/);
  assert.equal(calls[2].params[0], "invoice-1");
  assert.deepEqual(calls[2].params.slice(1, 11), ["choice-1", "cuac.invoice-line.v2", "student-1",
    "set-1", "school-1", "program-1", "intake-1", "direct_university", "application_fee", "application_submission"]);

  const paymentInsert = calls.find(call => /insert into payments/.test(call.statement));
  assert.ok(paymentInsert);
  assert.deepEqual(paymentInsert.params, [
    "invoice-1",
    "student-1",
    "hosted_provider",
    "provider-session-1",
    120000,
    "CNY",
  ]);

  calls.forEach((call) => {
    assert.doesNotMatch(call.statement, /select \*/i);
    assert.doesNotMatch(call.statement, /card|cvv|cvc|bank|routing|payment_token|raw_source/i);
  });
});

test("Postgres billing repository rejects a second provider session for an existing invoice", async () => {
  const provider = {
    provider: "hosted_provider",
    async createCheckoutSession() {
      return { providerCheckoutSessionId: "new-provider-session",
        checkoutUrl: "https://pay.example.test/checkout/new-provider-session" };
    },
  };
  const { client, calls } = createClient((statement, params) => {
    if (/from application_choices ac/.test(statement)) return [{
      id: "choice-1", cuacId: "CUAC-2026-004218", schoolId: "school-1", programId: "program-1", programIntakeId: "intake-1",
      admissionRouteKey: "direct_university", schoolName: "School One", programName: "Computer Science",
    }];
    if (/insert into invoices/.test(statement)) return [{ id: "invoice-1", userId: params[0],
      applicationSetId: params[1], cuacId: params[2], status: "draft", currency: params[3], subtotalMinor: params[4],
      discountMinor: params[5], totalMinor: params[6], provider: params[7], idempotencyKey: params[8] }];
    if (/insert into invoice_lines/.test(statement)) return [{ id: `line-${params[10]}` }];
    if (/select id from invoices/.test(statement)) return [{ id: "invoice-1" }];
    if (/from payments where invoice_id/.test(statement)) return [{ id: "payment-1", invoiceId: "invoice-1",
      userId: "student-1", provider: "hosted_provider", providerCheckoutSessionId: "old-provider-session",
      status: "requires_payment", amountMinor: 120000, currency: "CNY" }];
    return [];
  });
  const repository = new PostgresBillingRepository(client, feeSchedule, provider);

  await assert.rejects(() => repository.createCheckoutIntent("student-1", {
    applicationSetId: "set-1", applicationChoiceIds: ["choice-1"],
    successReturnPath: "/application.html#send", cancelReturnPath: "/application.html#fee",
  }), error => error instanceof CuacError && error.code === "SERVICE_UNAVAILABLE");
  assert.equal(calls.some(call => /insert into payments/.test(call.statement)), false);
});
