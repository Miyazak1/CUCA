import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applicationAtomicSubmissionFixture } from "./application-atomic-submission-fixture.mjs";

const password = "Synthetic-network-password-826";

export async function runApplicationSubmissionHttpRehearsal(t, pool, { send, browser, register }) {
  await t.test("network password step-up authorizes one exact atomic application-set submission", async () => {
    const api = browser();
    const account = await register(api);
    const fixture = await applicationAtomicSubmissionFixture(pool, { userId: account.userId });
    const path = `/api/v1/student/application-sets/${fixture.set.id}/submit`;
    const key = randomUUID();
    const submit = (client = api, body = fixture.input, idempotencyKey = key) => client.send(path, {
      method: "POST",
      body,
      headers: { "idempotency-key": idempotencyKey },
    });

    const ordinary = await submit();
    assert.equal(ordinary.status, 403, await ordinary.clone().text());
    assert.equal((await pool.query("select count(*)::int as n from application_submissions where application_set_id = $1",
      [fixture.set.id])).rows[0].n, 0);

    const forged = await send(path, { method: "POST", body: fixture.input,
      headers: { "idempotency-key": key, "x-user-id": account.userId, "x-auth-strength": "step_up" } });
    assert.equal(forged.status, 403, await forged.clone().text());
    assert.equal((await api.send("/api/v1/auth/step-up", { method: "POST",
      body: { password: "wrong-network-password" } })).status, 403);
    const before = (await pool.query("select step_up_expires_at from auth_sessions where user_id = $1 and revoked_at is null",
      [account.userId])).rows;
    assert.ok(before.every(row => row.step_up_expires_at === null));

    const elevated = await api.send("/api/v1/auth/step-up", { method: "POST", body: { password } });
    assert.equal(elevated.status, 200, await elevated.clone().text());
    assert.equal(elevated.headers.get("set-cookie"), null);
    const elevation = (await elevated.json()).data;
    assert.equal(elevation.userId, account.userId);
    assert.equal(elevation.authStrength, "step_up");
    assert.ok(new Date(elevation.stepUpExpiresAt) > new Date());
    assert.doesNotMatch(JSON.stringify(elevation), /password|sessionToken|scrypt/i);
    assert.equal((await (await api.send("/api/v1/me")).json()).data.authStrength, "step_up");

    const firstResponse = await submit();
    assert.equal(firstResponse.status, 201, await firstResponse.clone().text());
    assert.equal(firstResponse.headers.get("cache-control"), "no-store");
    const first = (await firstResponse.json()).data;
    assert.equal(first.applicationSetId, fixture.set.id);
    assert.equal(first.status, "accepted");
    assert.equal(first.acceptanceScope, "cuac_internal");
    assert.equal(first.programApplications.length, 2);
    assert.equal(first.officialSubmissionGroups.length, 2);
    assert.doesNotMatch(JSON.stringify(first), /authorization|snapshot|entitlement|invoice|payment|provider/i);

    const replayResponse = await submit();
    assert.equal(replayResponse.status, 201, await replayResponse.clone().text());
    assert.deepEqual((await replayResponse.json()).data, first);
    assert.equal((await submit(api, fixture.input, randomUUID())).status, 409);
    assert.equal((await api.send(`${path}?confirm=true`, { method: "POST", body: fixture.input,
      headers: { "idempotency-key": randomUUID() } })).status, 400);
    const notificationResponse = await api.send("/api/v1/notifications?limit=10");
    assert.equal(notificationResponse.status, 200, await notificationResponse.clone().text());
    const notificationItems = (await notificationResponse.json()).data.items;
    const submissionNotifications = notificationItems.filter(item => item.eventType === "application_submission_accepted");
    assert.equal(submissionNotifications.length, 1);
    assert.equal(submissionNotifications[0].topic, "application_updates");
    assert.match(submissionNotifications[0].title, /CUAC accepted/i);
    assert.match(submissionNotifications[0].body, /does not mean each school has received/i);
    assert.doesNotMatch(JSON.stringify(submissionNotifications), /authorization|snapshot|entitlement|invoice|payment|provider/i);

    const counts = (await pool.query(`select
      (select count(*)::int from application_submissions where application_set_id = $1) as submissions,
      (select count(*)::int from school_applications where application_set_id = $1
        and application_record_format = 'cuac.program-application.v2') as applications,
      (select count(*)::int from official_submission_groups where application_set_id = $1) as groups,
      (select count(*)::int from official_submission_outbox o join official_submission_groups g on g.id = o.group_id
        where g.application_set_id = $1) as outbox`, [fixture.set.id])).rows[0];
    assert.deepEqual(counts, { submissions: 1, applications: 2, groups: 2, outbox: 2 });
  });
}
