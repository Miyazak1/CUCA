import assert from "node:assert/strict";
import test from "node:test";

import {
  composeEmailVerificationMessage,
  composePasswordResetMessage,
  composeSchoolStaffInviteMessage,
  composeGuardianConsentMessage,
  validateAuthEmailDeliveryConfig,
} from "../../../src/server/index.ts";

const config = {
  from: " No-Reply@Example.COM ",
  publicAppUrl: "https://cuac.example.com/",
  verificationPath: "/auth/verify-email",
  passwordResetPath: "/auth/reset-password",
  schoolInvitePath: "/auth/school-invite",
  guardianConsentPath: "/auth-guardian-consent.html",
};

test("Auth email composer builds verification messages without provider coupling", () => {
  const message = composeEmailVerificationMessage(config, {
    challengeId: "email-challenge-1",
    userId: "student-1",
    emailNormalized: " Student@Example.COM ",
    verificationToken: "raw-email-token",
    expiresAt: new Date("2026-08-28T00:15:00.000Z"),
  });

  assert.equal(message.messageType, "auth.email_verification");
  assert.equal(message.to, "student@example.com");
  assert.equal(message.from, "no-reply@example.com");
  assert.equal(message.templateData.expiresAt, "2026-08-28T00:15:00.000Z");
  assert.match(message.templateData.actionUrl, /^https:\/\/cuac\.example\.com\/auth\/verify-email#challenge=email-challenge-1&token=/);
  assert.match(message.templateData.actionUrl, /raw-email-token/);
  assert.doesNotMatch(JSON.stringify(message), /password|card|cvv|session_token/i);
});

test("Auth email composer builds password reset messages with HTTPS action URL", () => {
  const message = composePasswordResetMessage(config, {
    challengeId: "reset-challenge-1",
    userId: "student-1",
    emailNormalized: "student@example.com",
    resetToken: "raw-reset-token",
    expiresAt: new Date("2026-08-28T00:30:00.000Z"),
  });

  assert.equal(message.messageType, "auth.password_reset");
  assert.equal(message.subject, "Reset your CUAC password");
  assert.match(message.templateData.actionUrl, /^https:\/\/cuac\.example\.com\/auth\/reset-password#challenge=reset-challenge-1&token=/);
  assert.match(message.templateData.actionUrl, /raw-reset-token/);
});

test("Auth email composer builds school staff invite messages with an invite-bound fragment", () => {
  const message = composeSchoolStaffInviteMessage(config, {
    inviteId: "invite-1",
    invitedByUserId: "ops-1",
    emailNormalized: "teacher@example.edu",
    inviteToken: "raw-invite-token",
    expiresAt: new Date("2026-08-28T00:45:00.000Z"),
  });

  assert.equal(message.messageType, "auth.school_staff_invite");
  assert.equal(message.subject, "Activate your CUAC school account");
  assert.equal(message.templateData.userId, "ops-1");
  assert.match(message.templateData.actionUrl, /^https:\/\/cuac\.example\.com\/auth\/school-invite#invite=invite-1&token=/);
});

test("Auth email composer builds guardian consent with a request-bound fragment", () => {
  const message = composeGuardianConsentMessage(config, {
    requestId: "request-1", userId: "pending-user-1", emailNormalized: "guardian@example.com",
    consentToken: "raw-guardian-token", expiresAt: new Date("2026-08-31T00:00:00.000Z"),
  });
  assert.equal(message.messageType, "auth.guardian_consent");
  assert.equal(message.subject, "Review a CUAC child account request");
  assert.match(message.templateData.actionUrl, /^https:\/\/cuac\.example\.com\/auth-guardian-consent\.html#request=request-1&token=/);
});

test("Auth email delivery config rejects non-HTTPS public URLs and invalid senders", () => {
  assert.throws(
    () => validateAuthEmailDeliveryConfig({ from: "no-reply@example.com", publicAppUrl: "http://cuac.example.com" }),
    /HTTPS public app URL/,
  );
  assert.throws(
    () => validateAuthEmailDeliveryConfig({ from: "not-an-email", publicAppUrl: "https://cuac.example.com" }),
    /valid email address/,
  );
});
