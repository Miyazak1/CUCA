import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { preflightFixture } from "./application-preflight-fixture.mjs";
import { approvePolicy, officialSubmissionPolicyFixture, policyPublishInput } from "./official-submission-policy-fixture.mjs";
import {
  PostgresApplicationFeeEntitlementService,
  PostgresBillingRepository,
  createRequestContext,
  createTransactionalSqlClient,
} from "../../../src/server/index.ts";

export async function runApplicationPreflightHttpRehearsal(t, pool, { send, browser, register }) {
  await t.test("network preflight returns one project report with private headers and no raw applicant data or writes", async () => {
    const student = browser(), account = await register(student), f = await preflightFixture(pool, account.userId);
    await f.populate(); await f.publish(); const before = await snapshotAuditedBusinessTables(pool);
    const response = await student.send(f.path); assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok(response.headers.get("x-request-id")); assert.equal(response.headers.get("set-cookie"), null);
    const result = (await response.json()).data;
    assert.equal(result.choiceId, f.choice.id); assert.equal(result.target.programIntakeId, f.catalog.intakeId); assert.equal(result.canSubmit, false);
    assert.deepEqual(result.preparation.education, { revision: 1, recordCount: 1 });
    assert.equal(result.requirements.items[0].result, "unassessed"); assert.equal(result.platformBlockers.length, 5);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private-applicant|Private language exam|7\.50|ruleText|reviewReference|sourceChecks|schoolVisibleProfile|studentNotes/);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("network preflight uses only the persisted per-project route and an exact reviewed policy", async () => {
    const student = browser(), account = await register(student);
    const policy = await officialSubmissionPolicyFixture(pool), target = policy.targets[0];
    const created = await student.send("/api/v1/student/application-sets", { method: "POST", body: { name: "HTTP route set" } });
    assert.equal(created.status, 200, await created.clone().text());
    const set = (await created.json()).data;
    const choicesPath = `/api/v1/student/application-sets/${set.id}/choices`;
    const added = await student.send(choicesPath, { method: "POST", body: {
      schoolId: policy.schoolId, programId: target.programId, programIntakeId: target.programIntakeId,
    } });
    assert.equal(added.status, 200, await added.clone().text());
    const choice = (await added.json()).data;
    const choicePath = `${choicesPath}/${choice.id}`;
    const preflightPath = `${choicePath}/preflight?locale=en`;

    const initialResponse = await student.send(preflightPath, { headers: { "x-admission-route-key": policy.admissionRouteKey } });
    assert.equal(initialResponse.status, 200, await initialResponse.clone().text());
    const initial = (await initialResponse.json()).data;
    assert.equal(initial.target.admissionRouteKey, null);
    assert.equal(initial.officialSubmissionPolicy, null);
    assert.ok(initial.issues.includes("ADMISSION_ROUTE_REQUIRED"));
    assert.ok(initial.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
    assert.equal((await student.send(`${choicePath}/preflight?locale=en&admissionRouteKey=${policy.admissionRouteKey}`)).status, 400);

    const before = await snapshotAuditedBusinessTables(pool);
    const unavailable = await student.send(choicePath, { method: "PATCH", body: {
      expectedRevision: 2, admissionRouteKey: policy.admissionRouteKey,
    } });
    assert.equal(unavailable.status, 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);

    const approved = await approvePolicy(policy, randomUUID());
    await policy.service.publish(policy.reviewer, policy.schoolId, policy.policyKey,
      policy.admissionRouteKey, policyPublishInput(approved));
    const selectedResponse = await student.send(choicePath, { method: "PATCH", body: {
      expectedRevision: 2, admissionRouteKey: policy.admissionRouteKey,
    } });
    assert.equal(selectedResponse.status, 200, await selectedResponse.clone().text());
    const selected = (await selectedResponse.json()).data;
    assert.equal(selected.revision, 3);
    assert.equal(selected.choices.find(item => item.id === choice.id).admissionRouteKey, policy.admissionRouteKey);

    const reportResponse = await student.send(preflightPath);
    assert.equal(reportResponse.status, 200, await reportResponse.clone().text());
    const report = (await reportResponse.json()).data;
    assert.equal(report.target.admissionRouteKey, policy.admissionRouteKey);
    assert.equal(report.officialSubmissionPolicy.versionId, approved.versionId);
    assert.ok(!report.issues.includes("ADMISSION_ROUTE_REQUIRED"));
    assert.ok(!report.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
    assert.ok(report.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
    assert.ok(report.platformBlockers.includes("SUBMISSION_UNAVAILABLE"));
    assert.equal(report.canSubmit, false);
    assert.doesNotMatch(JSON.stringify(report), /preparedByUserId|approvedByUserId|reviewEvidence|sourceChecks|targetSetSha256|approvalSha256/);

    await grantApplicationFeeEntitlement(pool, account.userId, set.id, choice.id);
    const entitledResponse = await student.send(preflightPath);
    assert.equal(entitledResponse.status, 200, await entitledResponse.clone().text());
    const entitled = (await entitledResponse.json()).data;
    assert.equal(entitled.billingEntitlement.current, true);
    assert.deepEqual(Object.keys(entitled.billingEntitlement).sort(),
      ["current", "expiresAt", "grantedAt", "id", "status"]);
    assert.ok(!entitled.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
    assert.ok(entitled.platformBlockers.includes("SUBMISSION_UNAVAILABLE"));
    assert.equal(entitled.canSubmit, false);
    assert.doesNotMatch(JSON.stringify(entitled.billingEntitlement),
      /provider|invoice|payment|amount|currency|pricing|event/i);

    const clearedResponse = await student.send(choicePath, { method: "PATCH", body: {
      expectedRevision: selected.revision, admissionRouteKey: null,
    } });
    assert.equal(clearedResponse.status, 200, await clearedResponse.clone().text());
    const cleared = (await clearedResponse.json()).data;
    assert.equal(cleared.choices.find(item => item.id === choice.id).admissionRouteKey, null);
    const blocked = (await (await student.send(preflightPath)).json()).data;
    assert.ok(blocked.issues.includes("ADMISSION_ROUTE_REQUIRED"));
    assert.ok(blocked.platformBlockers.includes("OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE"));
    assert.equal(blocked.billingEntitlement.current, false);
    assert.ok(blocked.platformBlockers.includes("BILLING_ENTITLEMENT_UNAVAILABLE"));
  });

  await t.test("network preflight blocks guests other students forged authority malformed queries and write methods", async () => {
    const student = browser(), other = browser(), account = await register(student); await register(other);
    const f = await preflightFixture(pool, account.userId), before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await send(f.path, { headers: { "x-user-id": f.userId, "x-role": "student" } })).status, 403);
    assert.equal((await other.send(f.path, { headers: { "x-user-id": f.userId, "x-role": "student" } })).status, 403);
    const base = f.path.split("?")[0];
    for (const query of ["", "?locale=en&locale=en", "?locale=EN", "?locale=en&paid=true", "?locale=en&canSubmit=true", "?locale=en&checkedAt=2099"]) {
      assert.equal((await student.send(base + query)).status, 400);
    }
    assert.equal((await student.send(f.path.replace(f.set.id, randomUUID()))).status, 403);
    assert.equal((await student.send(f.path.replace(f.choice.id, "invalid"))).status, 400);
    assert.equal((await student.send(f.path, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
    for (const method of ["POST", "PATCH", "DELETE"]) assert.ok([404, 405].includes((await student.send(base, { method, body: { consent: true, paid: true } })).status));
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("network preflight observes new profile draft and intake state only on fresh reads and retains locale boundaries", async () => {
    const student = browser(), account = await register(student), f = await preflightFixture(pool, account.userId); await f.publish();
    const first = (await (await student.send(f.path)).json()).data;
    assert.equal(first.revision, 2); assert.equal(first.preparation.applicant.revision, 0);
    const patch = await student.send("/api/v1/student/applicant-profile", { method: "PATCH", body: { expectedRevision: 0, fullName: "PRIVATE_CHANGED_NAME" } });
    assert.equal(patch.status, 200);
    const choicePath = `/api/v1/student/application-sets/${f.set.id}/choices/${f.choice.id}`;
    assert.equal((await student.send(choicePath, { method: "PATCH", body: { expectedRevision: 2, studentNotes: "PRIVATE_NEW_NOTE" } })).status, 200);
    const current = (await (await student.send(f.path)).json()).data;
    assert.equal(current.revision, 3); assert.equal(current.preparation.applicant.revision, 1); assert.equal(current.canSubmit, false);
    assert.deepEqual(current.preparation.applicant.missingFields, ["contactEmail", "citizenshipCountry"]);
    assert.equal((await (await student.send(f.path.replace("locale=en", "locale=zh-CN"))).json()).data.notice, null);
    await pool.query("update program_intakes set status = 'closed' where id = $1", [f.catalog.intakeId]);
    const closed = (await (await student.send(f.path)).json()).data; assert.ok(closed.issues.includes("INTAKE_UNAVAILABLE")); assert.equal(closed.requirements, null);
    await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
    assert.equal((await student.send(f.path)).status, 403);
  });

  await t.test("network preflight fails closed on corrupted publication evidence instead of returning an empty successful report", async () => {
    const student = browser(), account = await register(student), f = await preflightFixture(pool, account.userId), published = await f.publish();
    await pool.query("update privacy_notice_versions set review_evidence_json = jsonb_set(review_evidence_json, '{reviewReference}', '\"PRIVATE_CORRUPTION_REFERENCE\"') where id = $1", [published.notice.versionId]);
    const before = await snapshotAuditedBusinessTables(pool), response = await student.send(f.path);
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /PRIVATE_|select |privacy_notice|review_evidence|postgres/i);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });
}

async function grantApplicationFeeEntitlement(pool, userId, applicationSetId, applicationChoiceId) {
  const client = createTransactionalSqlClient(pool), providerSessionId = `http-${randomUUID()}`;
  const billing = new PostgresBillingRepository(client,
    { currency: "CNY", applicationFeeMinor: 80000, serviceFeeMinor: 0 }, {
      provider: "rehearsal_hosted",
      async createCheckoutSession() {
        return { providerCheckoutSessionId: providerSessionId,
          checkoutUrl: `https://payments.example.invalid/checkout/${providerSessionId}` };
      },
    });
  const checkout = await billing.createCheckoutIntent(userId, { applicationSetId,
    applicationChoiceIds: [applicationChoiceId], successReturnPath: "/success", cancelReturnPath: "/cancel" });
  await pool.query("update invoices set status = 'paid', finalized_at = now() where id = $1", [checkout.invoiceId]);
  await pool.query("update payments set status = 'succeeded', paid_at = now() where id = $1", [checkout.checkoutSessionId]);
  const event = (await pool.query(`insert into payment_status_events
    (payment_id,from_status,to_status,provider_event_id,metadata_json)
    values ($1,'requires_payment','succeeded',$2,'{}'::jsonb) returning id`,
  [checkout.checkoutSessionId, `http-event-${randomUUID()}`])).rows[0];
  const admin = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id",
    [`http-billing-${randomUUID()}@example.invalid`])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_admin')", [admin.id]);
  const context = createRequestContext({ requestId: `http-grant-${randomUUID()}`, actorUserId: admin.id,
    activeRole: "cuac_admin", selectedSurface: "ops", purpose: "billing", authStrength: "step_up" });
  await new PostgresApplicationFeeEntitlementService(client).grantFromSettledPayment(context,
    { paymentId: checkout.checkoutSessionId, paymentStatusEventId: event.id });
}
