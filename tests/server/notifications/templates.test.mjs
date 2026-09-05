import assert from "node:assert/strict";
import test from "node:test";
import { defaultNotificationPreference, materializeApplicationSubmittedNotification, materializePaymentStatusNotification,
  materializeSchoolApplicationStatusNotification, renderNotificationTemplate } from "../../../src/server/notifications/templates.ts";

const ids = { user: "11111111-1111-4111-8111-111111111111", application: "22222222-2222-4222-8222-222222222222", event: "33333333-3333-4333-8333-333333333333" };

test("school workflow notifications use reviewed fixed copy and stable event identity", () => {
  const input = { recipientUserId: ids.user, schoolApplicationId: ids.event, applicationSetId: ids.application, statusEventId: ids.event,
    status: "waiting_for_documents", occurredAt: new Date("2026-09-02T00:00:00.000Z") };
  const first = materializeSchoolApplicationStatusNotification(input);
  const second = materializeSchoolApplicationStatusNotification(input);
  assert.equal(first.eventType, "school_waiting_documents");
  assert.equal(first.topic, "application_updates");
  assert.equal(first.eventKeySha256, second.eventKeySha256);
  assert.equal(first.templates.length, 3);
  for (const template of first.templates) {
    const rendered = renderNotificationTemplate(template, first.variables);
    assert.equal(rendered.actionPath, `/application.html?applicationSet=${ids.application}`);
    assert.match(rendered.body, /not.*official|directly from the school/i);
    assert.doesNotMatch(JSON.stringify(rendered), /closure reason|contact note|passport|payment card/i);
  }
});

test("template rendering rejects extra, missing, control-character and oversized variables", () => {
  const event = materializeSchoolApplicationStatusNotification({ recipientUserId: ids.user,
    schoolApplicationId: ids.event, applicationSetId: ids.application, statusEventId: ids.event, status: "contacted", occurredAt: new Date() });
  const template = event.templates[0];
  for (const variables of [{}, { ...event.variables, reason: "private" }, { applicationSetId: "bad\nvalue" }, { applicationSetId: "x".repeat(129) }]) {
    assert.throws(() => renderNotificationTemplate(template, variables), /template variable/i);
  }
});

test("submission notification states CUAC acceptance without claiming school receipt", () => {
  const event = materializeApplicationSubmittedNotification({
    recipientUserId: ids.user,
    applicationSubmissionId: ids.event,
    applicationSetId: ids.application,
    occurredAt: new Date("2026-09-02T00:00:00.000Z"),
  });
  assert.equal(event.topic, "application_updates");
  assert.equal(event.eventType, "application_submission_accepted");
  const rendered = renderNotificationTemplate(event.templates[0], event.variables);
  assert.match(rendered.title, /CUAC accepted/i);
  assert.match(rendered.body, /does not mean each school has received/i);
  assert.equal(rendered.actionPath, `/application.html?applicationSet=${ids.application}`);
  assert.doesNotMatch(JSON.stringify(rendered), /sent to selected schools|school received/i);
});

test("payment notifications expose only reviewed status copy and invoice navigation", () => {
  for (const status of ["succeeded", "canceled", "refunded"]) {
    const event = materializePaymentStatusNotification({
      recipientUserId: ids.user, paymentId: ids.application, invoiceId: ids.event,
      paymentStatusEventId: `44444444-4444-4444-8444-44444444444${status === "succeeded" ? "4" : status === "canceled" ? "5" : "6"}`,
      status, occurredAt: new Date("2026-09-02T00:00:00.000Z"),
    });
    const rendered = renderNotificationTemplate(event.templates[0], event.variables);
    assert.equal(event.topic, "billing_updates");
    assert.equal(rendered.actionPath, `/application.html?invoiceId=${ids.event}#payment`);
    assert.doesNotMatch(JSON.stringify(rendered), /amount|currency|provider|card|bank|checkout/i);
  }
});

test("notification defaults keep account security mandatory and SMS disabled", () => {
  assert.deepEqual(defaultNotificationPreference("student", "account_security"), { inAppEnabled: true, emailEnabled: true, smsEnabled: false });
  assert.deepEqual(defaultNotificationPreference("cuac_ops", "platform_operations"), { inAppEnabled: true, emailEnabled: false, smsEnabled: false });
  assert.throws(() => defaultNotificationPreference("student", "platform_operations"), /not allowed/);
});
