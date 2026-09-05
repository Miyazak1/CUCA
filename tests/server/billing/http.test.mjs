import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BillingFacadeService,
  createBillingHttpHandlers,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../src/server/index.ts";

const activeStudentSession = {
  userId: "student-1",
  selectedSurface: "student",
  activeRole: "student",
  tenantSchoolId: null,
  authStrength: "session",
  expiresAt: new Date("2026-09-29T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
};
const applicationSetId = "00000000-0000-4000-8000-000000000011";
const applicationChoiceId = "00000000-0000-4000-8000-000000000012";
const invoiceId = "00000000-0000-4000-8000-000000000013";

function createHandlers(repositoryOverrides = {}, authSession = activeStudentSession) {
  const calls = [];
  const repository = {
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
        lines: [],
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
    ...repositoryOverrides,
  };
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      return authSession;
    },
  };

  return {
    calls,
    handlers: createBillingHttpHandlers(new BillingFacadeService(repository), authRepository),
  };
}

test("billing HTTP preview resolves actor from session cookie and ignores body userId authority", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.previewFees(
    new Request("https://cuac.test/api/v1/billing/fee-preview", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
      body: JSON.stringify({
        userId: "attacker",
        applicationSetId,
        applicationChoiceIds: [applicationChoiceId],
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.totalMinor, 120000);
  assert.match(calls[0].sessionTokenHash, /^sha256:/);
  assert.equal(calls[0].sessionTokenHash, hashSessionToken("student-token"));
  assert.equal(calls[2].method, "previewFees");
  assert.equal(calls[2].userId, "student-1");
});

test("billing HTTP checkout rejects raw payment fields before repository checkout creation", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.createCheckoutIntent(
    new Request("https://cuac.test/api/v1/billing/checkout-intents", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
      body: JSON.stringify({
        applicationSetId,
        applicationChoiceIds: [applicationChoiceId],
        providerMetadata: { cardNumber: "4111111111111111" },
        successReturnPath: "/application.html#send",
        cancelReturnPath: "/application.html#fee",
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(calls.some((call) => call.method === "createCheckoutIntent"), false);
});

test("billing HTTP routes reject guests before repository access", async () => {
  const { handlers, calls } = createHandlers({}, null);
  const response = await handlers.previewFees(
    new Request("https://cuac.test/api/v1/billing/fee-preview", {
      method: "POST",
      body: JSON.stringify({ applicationSetId, applicationChoiceIds: [applicationChoiceId] }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("billing HTTP checkout status is session-owned and omits provider references", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.getCheckoutStatus(
    new Request(`https://cuac.test/api/v1/billing/invoices/${invoiceId}`, {
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
    }),
    invoiceId,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.status, "succeeded");
  assert.deepEqual(calls.at(-1), { method: "getCheckoutStatus", userId: "student-1", invoiceId });
  assert.doesNotMatch(JSON.stringify(body), /provider|checkoutUrl|provider-session/i);
});

test("billing app route files stay thin and do not read demo data directly", async () => {
  const routePaths = [
    "../../../app/api/v1/billing/fee-preview/route.ts",
    "../../../app/api/v1/billing/checkout-intents/route.ts",
    "../../../app/api/v1/billing/invoices/[invoiceId]/route.ts",
  ];

  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getBillingRouteHandlers/);
    assert.doesNotMatch(source, /cuac-data|public\/|design-lab|db\/schema|select\s+\*/i);
  });
  const webhookRoute = await readFile(new URL(
    "../../../app/api/v1/billing/provider-events/route.ts", import.meta.url), "utf8");
  assert.match(webhookRoute, /handlePaymentWebhookRoute/);
  assert.doesNotMatch(webhookRoute, /cuac-data|public\/|design-lab|db\/schema|select\s+\*|webhook_secret/i);
});
