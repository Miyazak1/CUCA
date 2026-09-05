import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  PostgresApplicationFeeEntitlementService,
  PostgresBillingRepository,
  createRequestContext,
  createTransactionalSqlClient,
  readCurrentApplicationFeeEntitlement,
} from "../../../src/server/index.ts";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { preflightFixture } from "./application-preflight-fixture.mjs";

const feeSchedule = { currency: "CNY", applicationFeeMinor: 80000, serviceFeeMinor: 40000 };

export async function runApplicationFeeEntitlementRehearsal(t, pool) {
  await t.test("same-school programs keep independent invoice lines entitlements and preflight state", async () => {
    const f = await settledBillingFixture(pool);
    const repository = new PostgresBillingRepository(f.client, feeSchedule);
    await assert.rejects(repository.previewFees(f.userId, {
      applicationSetId: f.set.id,
      applicationChoiceIds: [f.choice.id, randomUUID()],
    }), error => error.status === 400);

    const lines = (await pool.query(`select line_format, line_type, fee_code, application_choice_id,
      school_id, program_id, program_intake_id, admission_route_key, user_id, application_set_id
      from invoice_lines where invoice_id = $1 order by line_type, application_choice_id nulls last`,
    [f.invoiceId])).rows;
    const applicationLines = lines.filter(line => line.line_type === "application_fee");
    assert.equal(applicationLines.length, 2);
    assert.equal(lines.filter(line => line.line_type === "service_fee").length, 1);
    assert.deepEqual(new Set(applicationLines.map(line => line.school_id)), new Set([f.catalog.schoolId]));
    assert.deepEqual(new Set(applicationLines.map(line => line.program_id)),
      new Set([f.catalog.programId, f.second.programId]));
    assert.deepEqual(new Set(applicationLines.map(line => line.program_intake_id)),
      new Set([f.catalog.intakeId, f.second.intakeId]));
    assert.deepEqual(new Set(applicationLines.map(line => line.application_choice_id)),
      new Set([f.choice.id, f.second.choiceId]));
    assert.ok(applicationLines.every(line => line.line_format === "cuac.invoice-line.v2"
      && line.fee_code === "application_submission" && line.user_id === f.userId
      && line.application_set_id === f.set.id));

    const service = new PostgresApplicationFeeEntitlementService(f.client);
    const grants = await Promise.all([
      service.grantFromSettledPayment(f.adminContext, f.grantInput),
      service.grantFromSettledPayment(f.adminContext, f.grantInput),
    ]);
    assert.ok(grants.every(result => result.length === 2));
    const stored = (await pool.query(`select application_choice_id, school_id, program_id,
      program_intake_id, admission_route_key, status from application_fee_entitlements
      where payment_id = $1 order by application_choice_id`, [f.paymentId])).rows;
    assert.equal(stored.length, 2);
    assert.deepEqual(new Set(stored.map(row => row.application_choice_id)),
      new Set([f.choice.id, f.second.choiceId]));
    assert.deepEqual(new Set(stored.map(row => row.program_id)),
      new Set([f.catalog.programId, f.second.programId]));
    assert.ok(stored.every(row => row.school_id === f.catalog.schoolId && row.status === "active"));
    assert.equal((await pool.query(`select count(*)::int as total from audit_logs
      where action = 'billing.application_fee_entitlement.grant' and metadata_json->>'paymentId' = $1`,
    [f.paymentId])).rows[0].total, 2);

    const first = await readCurrentApplicationFeeEntitlement(f.client, f.userId, f.set.id, f.choice.id);
    const second = await readCurrentApplicationFeeEntitlement(f.client, f.userId, f.set.id, f.second.choiceId);
    assert.equal(first.evidenceCurrent, true);
    assert.equal(second.evidenceCurrent, true);

    const preflight = await f.reader.get(f.context, f.set.id, f.choice.id, "en");
    assert.equal(preflight.billingEntitlement.current, true);
    assert.deepEqual(Object.keys(preflight.billingEntitlement).sort(),
      ["current", "expiresAt", "grantedAt", "id", "status"]);
    assert.equal(preflight.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"), false);
    assert.equal(preflight.platformBlockers.includes("SUBMISSION_UNAVAILABLE"), true);
    assert.equal(preflight.canSubmit, false);
    assert.doesNotMatch(JSON.stringify(preflight.billingEntitlement),
      /provider|invoice|payment|amount|currency|pricing|event/i);

    await pool.query("update application_choices set admission_route_key = 'csc' where id = $1", [f.choice.id]);
    assert.equal((await readCurrentApplicationFeeEntitlement(f.client, f.userId, f.set.id, f.choice.id)).evidenceCurrent, false);
    assert.equal((await readCurrentApplicationFeeEntitlement(f.client, f.userId, f.set.id, f.second.choiceId)).evidenceCurrent, true);
    await pool.query("update payments set status = 'refunded', refunded_at = now() where id = $1", [f.paymentId]);
    assert.equal((await readCurrentApplicationFeeEntitlement(f.client, f.userId, f.set.id, f.second.choiceId)).evidenceCurrent, false);

    const audit = (await pool.query(`select metadata_json from audit_logs
      where action = 'billing.application_fee_entitlement.grant' and metadata_json->>'paymentId' = $1`,
    [f.paymentId])).rows;
    assert.doesNotMatch(JSON.stringify(audit), /provider|checkout|card|cvv|bank|token/i);
  });

  await t.test("entitlement and audit commit atomically and a failed audit leaves no grant", async () => {
    const f = await settledBillingFixture(pool, { choiceCount: 1, serviceFeeMinor: 0 });
    const service = new PostgresApplicationFeeEntitlementService(f.client);
    const fault = await createAuditFailureFixture(pool);
    try {
      await assert.rejects(fault.during("billing.application_fee_entitlement.grant",
        () => service.grantFromSettledPayment(f.adminContext, f.grantInput)), error => error.code === "P0001");
      assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements where payment_id = $1",
        [f.paymentId])).rows[0].total, 0);
    } finally {
      await fault.close();
    }
    assert.equal((await service.grantFromSettledPayment(f.adminContext, f.grantInput)).length, 1);
  });

  await t.test("database rejects implicit v2 and cross-project billing evidence", async () => {
    const f = await settledBillingFixture(pool, { choiceCount: 1, serviceFeeMinor: 0 });
    const invoice = (await pool.query(`insert into invoices
      (user_id, application_set_id, status, currency, subtotal_minor, discount_minor, total_minor, idempotency_key)
      values ($1,$2,'draft','CNY',80000,0,80000,$3) returning id`,
    [f.userId, f.set.id, `negative-${randomUUID()}`])).rows[0];
    await assert.rejects(pool.query(`insert into invoice_lines
      (invoice_id, application_choice_id, line_type, description, amount_minor, currency)
      values ($1,$2,'application_fee','Old writer',80000,'CNY')`, [invoice.id, f.choice.id]),
    error => error.code === "23514" && error.constraint === "invoice_lines_format_check");

    const otherProgram = (await pool.query(`insert into programs
      (school_id, slug, name_en, degree_level, status) values ($1,$2,'Wrong target','master','active') returning id`,
    [f.catalog.schoolId, randomUUID()])).rows[0];
    const otherIntake = (await pool.query(`insert into program_intakes
      (program_id, intake_term, intake_year, status) values ($1,'spring',2099,'open') returning id`,
    [otherProgram.id])).rows[0];
    await assert.rejects(pool.query(`insert into invoice_lines
      (invoice_id, application_choice_id, line_format, user_id, application_set_id, school_id,
       program_id, program_intake_id, admission_route_key, line_type, fee_code, description,
       amount_minor, currency, pricing_basis_sha256)
      values ($1,$2,'cuac.invoice-line.v2',$3,$4,$5,$6,$7,'direct_university',
       'application_fee','application_submission','Wrong project evidence',80000,'CNY',$8)`,
    [invoice.id, f.choice.id, f.userId, f.set.id, f.catalog.schoolId, otherProgram.id, otherIntake.id,
      "a".repeat(64)]), error => error.code === "23503"
        && ["invoice_lines_choice_target_fk", "invoice_lines_choice_scope_fk"].includes(error.constraint));
    assert.equal((await pool.query("select count(*)::int as total from application_fee_entitlements where invoice_id = $1",
      [invoice.id])).rows[0].total, 0);
  });
}

async function settledBillingFixture(pool, options = {}) {
  const f = await preflightFixture(pool);
  await pool.query("update application_choices set admission_route_key = 'direct_university' where id = $1", [f.choice.id]);
  const choiceCount = options.choiceCount ?? 2;
  let second = null;
  if (choiceCount === 2) {
    const program = (await pool.query(`insert into programs
      (school_id, slug, name_en, degree_level, status) values ($1,$2,'Second same-school program','master','active') returning id`,
    [f.catalog.schoolId, randomUUID()])).rows[0];
    const intake = (await pool.query(`insert into program_intakes
      (program_id, intake_term, intake_year, status) values ($1,'fall',2098,'open') returning id`, [program.id])).rows[0];
    const choice = await f.student.addOwnApplicationChoice(f.context, {
      applicationSetId: f.set.id,
      schoolId: f.catalog.schoolId,
      programId: program.id,
      programIntakeId: intake.id,
    }, { idempotencyKey: randomUUID() });
    await pool.query("update application_choices set admission_route_key = 'direct_university' where id = $1", [choice.id]);
    second = { programId: program.id, intakeId: intake.id, choiceId: choice.id };
  }

  const client = createTransactionalSqlClient(pool);
  const providerSessionId = `rehearsal-${randomUUID()}`;
  const provider = {
    provider: "rehearsal_hosted",
    async createCheckoutSession() {
      return { providerCheckoutSessionId: providerSessionId,
        checkoutUrl: `https://payments.example.invalid/checkout/${providerSessionId}` };
    },
  };
  const repository = new PostgresBillingRepository(client, {
    ...feeSchedule,
    serviceFeeMinor: options.serviceFeeMinor ?? feeSchedule.serviceFeeMinor,
  }, provider);
  const choiceIds = second ? [f.choice.id, second.choiceId] : [f.choice.id];
  const checkout = await repository.createCheckoutIntent(f.userId, {
    applicationSetId: f.set.id,
    applicationChoiceIds: choiceIds,
    successReturnPath: "/application/fee/success",
    cancelReturnPath: "/application/fee/cancel",
  });
  const payment = (await pool.query("select id from payments where id = $1", [checkout.checkoutSessionId])).rows[0];
  await pool.query("update invoices set status = 'paid', finalized_at = now() where id = $1", [checkout.invoiceId]);
  await pool.query("update payments set status = 'succeeded', paid_at = now() where id = $1", [payment.id]);
  const event = (await pool.query(`insert into payment_status_events
    (payment_id, from_status, to_status, provider_event_id, metadata_json)
    values ($1,'requires_payment','succeeded',$2,'{}'::jsonb) returning id`,
  [payment.id, `event-${randomUUID()}`])).rows[0];
  const admin = (await pool.query("insert into users (email, email_normalized) values ($1,$1) returning id",
    [`billing-admin-${randomUUID()}@example.invalid`])).rows[0];
  await pool.query("insert into user_roles (user_id, role) values ($1,'cuac_admin')", [admin.id]);
  const adminContext = createRequestContext({ requestId: `grant-${randomUUID()}`, actorUserId: admin.id,
    activeRole: "cuac_admin", selectedSurface: "ops", purpose: "billing", authStrength: "step_up" });
  return { ...f, client, second, invoiceId: checkout.invoiceId, paymentId: payment.id,
    grantInput: { paymentId: payment.id, paymentStatusEventId: event.id }, adminContext };
}
