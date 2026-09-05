import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createBillingRouteHandlers,
  CuacError,
  SESSION_COOKIE_NAME,
  resolveBillingFeeSchedule,
} from "../../../src/server/index.ts";
import { createPostgresBillingService } from "../../../src/server/billing/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

const applicationSetId = "00000000-0000-4000-8000-000000000021";
const applicationChoiceId = "00000000-0000-4000-8000-000000000022";

test("billing runtime resolves explicit minor-unit fee schedule", () => {
  assert.deepEqual(
    resolveBillingFeeSchedule({
      CUAC_APPLICATION_FEE_MINOR: "80000",
      CUAC_SERVICE_FEE_MINOR: "40000",
      CUAC_BILLING_CURRENCY: "cny",
    }),
    {
      applicationFeeMinor: 80000,
      serviceFeeMinor: 40000,
      currency: "CNY",
    },
  );
});

test("billing runtime fails closed when application fee config is missing or unsafe", () => {
  [
    {},
    { CUAC_APPLICATION_FEE_MINOR: "12.34" },
    { CUAC_APPLICATION_FEE_MINOR: "-1" },
    { CUAC_APPLICATION_FEE_MINOR: "free" },
    { CUAC_APPLICATION_FEE_MINOR: "80000", CUAC_BILLING_CURRENCY: "USDT" },
  ].forEach((env) => {
    assert.throws(
      () => resolveBillingFeeSchedule(env),
      (error) => error instanceof CuacError && error.code === "SERVICE_UNAVAILABLE",
    );
  });
});

test("billing runtime route composition uses PostgreSQL repository and audit writer only", async () => {
  const source = await readFile(new URL("../../../src/server/billing/runtime/routes.ts", import.meta.url), "utf8");

  assert.match(source, /PostgresBillingRepository/);
  assert.match(source, /PostgresAuditWriter/);
  assert.match(source, /resolveBillingFeeSchedule/);
  assert.doesNotMatch(source, /transactionalMethod/);
  assert.doesNotMatch(source, /cuac-data|public\/|design-lab|db\/schema|select\s+\*/i);
  assert.doesNotMatch(source, /cardNumber|card_number|cvv|cvc|bankAccount|paymentToken/i);
});

test("billing runtime keeps read-only fee calculation separate from its audit write", async () => {
  let transactionDepth = 0;
  const calls = [];
  const query = async (statement, params) => {
    calls.push({ statement, params, transactionDepth });
    if (/from application_sets[\s\S]*where id/.test(statement)) return [{ id: applicationSetId, userId: "student-1", status: "draft" }];
    if (/from application_choices ac/.test(statement)) return [{
      id: applicationChoiceId,
      cuacId: "CUAC-2026-004218",
      schoolId: "00000000-0000-4000-8000-000000000023",
      programId: "00000000-0000-4000-8000-000000000024",
      programIntakeId: "00000000-0000-4000-8000-000000000025",
      admissionRouteKey: "direct_university",
      schoolName: "Test University",
      programName: "Test Program",
    }];
    return [];
  };
  const client = {
    query,
    async transaction(work) {
      transactionDepth += 1;
      const scoped = { query, transaction: nested => nested(scoped) };
      try { return await work(scoped); } finally { transactionDepth -= 1; }
    },
  };
  const context = createRequestContext({ actorUserId: "student-1", activeRole: "student", selectedSurface: "student",
    purpose: "billing", authStrength: "session", tenantSchoolId: null });
  const result = await createPostgresBillingService(client, {
    applicationFeeMinor: 80000, serviceFeeMinor: 0, currency: "CNY",
  }, null).previewStudentFees(context, { applicationSetId, applicationChoiceIds: [applicationChoiceId] });

  assert.equal(result.totalMinor, 80000);
  assert.equal(calls.find(call => /^set transaction/.test(call.statement)).transactionDepth, 1);
  assert.equal(calls.find(call => /insert into audit_logs/.test(call.statement)).transactionDepth, 0);
});

test("billing runtime can fail closed after authenticated session resolution", async () => {
  const calls = [];
  const authRepository = {
    async findActiveSessionByTokenHash() {
      calls.push("auth");
      return {
        userId: "student-1",
        selectedSurface: "student",
        activeRole: "student",
        tenantSchoolId: null,
        authStrength: "session",
        expiresAt: new Date("2026-09-29T00:00:00.000Z"),
        revokedAt: null,
        accountStatus: "active",
      };
    },
  };
  const handlers = createBillingRouteHandlers(undefined, authRepository);

  const response = await handlers.previewFees(
    new Request("https://cuac.test/api/v1/billing/fee-preview", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` },
      body: JSON.stringify({ applicationSetId, applicationChoiceIds: [applicationChoiceId] }),
    }),
  );
  const body = await response.json();

  assert.deepEqual(calls, ["auth"]);
  assert.equal(response.status, 503);
  assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
});
