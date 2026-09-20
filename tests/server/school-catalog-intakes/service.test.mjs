import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { SchoolCatalogIntakeService } from "../../../src/server/school-catalog-intakes/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

const userId = randomUUID(), schoolId = randomUUID(), programId = randomUUID(), versionId = randomUUID();
const context = strength => createRequestContext({ actorUserId: userId, activeRole: "school_staff", selectedSurface: "school",
  tenantSchoolId: schoolId, purpose: "school_catalog_intake", authStrength: strength });
const item = status => ({ id: versionId, schoolId, programId, programNameEn: "Accounting", programNameZh: null,
  intakeTerm: "spring", intakeYear: 2027, version: 1, openDate: new Date("2026-09-01T00:00:00.000Z"),
  deadlineDate: new Date("2027-01-12T00:00:00.000Z"), deadlineLabel: "January 12, 2027",
  applicationRound: "Spring 2027", evidenceType: "official_url", sourceUrl: "https://admission.example.edu/2027", sourceLabel: "Official brochure",
  changeNote: null, status, publicationRevision: status === "draft" ? null : 1,
  publicationStatus: status === "withdrawn" ? "withdrawn" : status === "draft" ? null : "active",
  createdByUserId: userId, createdAt: new Date(), updatedAt: new Date() });

test("school intake drafts accept exact future-cycle evidence and audit the tenant scope", async () => {
  const calls = [], audits = [];
  const service = new SchoolCatalogIntakeService({
    async list() { return []; },
    async saveDraft(input) { calls.push(input); return item("draft"); },
    async publish() { return null; }, async withdraw() { return null; },
  }, { async record(event) { audits.push(event); } });
  const result = await service.saveDraft(context("session"), { programId, intakeTerm: "spring", intakeYear: 2027,
    openDate: "2026-09-01T00:00:00.000Z", deadlineDate: "2027-01-12T00:00:00.000Z",
    deadlineLabel: "January 12, 2027", applicationRound: "Spring 2027", evidenceType: "official_url",
    sourceUrl: "https://admission.example.edu/2027", sourceLabel: "Official brochure" });
  assert.equal(result.id, versionId);
  assert.equal(calls[0].schoolId, schoolId);
  assert.equal(calls[0].openDate.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(audits[0].action, "school.catalog_intake.draft_saved");
  assert.equal(audits[0].tenantSchoolId, schoolId);
});

test("publishing and withdrawing require step-up school authority", async () => {
  let publishes = 0, withdrawals = 0;
  const service = new SchoolCatalogIntakeService({ async list() { return []; }, async saveDraft() { return null; },
    async publish() { publishes++; return item("published"); }, async withdraw() { withdrawals++; return item("withdrawn"); } },
  { async record() {} });
  await assert.rejects(service.publish(context("session"), versionId), error => error.status === 403);
  await assert.rejects(service.withdraw(context("session"), versionId), error => error.status === 403);
  assert.equal((await service.publish(context("step_up"), versionId)).status, "published");
  assert.equal((await service.withdraw(context("step_up"), versionId)).status, "withdrawn");
  assert.equal(publishes, 1); assert.equal(withdrawals, 1);
});

test("school intake drafts reject forged scope, invalid dates and non-official URLs", async () => {
  const service = new SchoolCatalogIntakeService({ async list() { return []; }, async saveDraft() { throw new Error("unreachable"); },
    async publish() { return null; }, async withdraw() { return null; } }, { async record() {} });
  const base = { programId, intakeTerm: "fall", intakeYear: 2027, openDate: "2027-09-01T00:00:00.000Z",
    deadlineDate: "2027-01-01T00:00:00.000Z", evidenceType: "official_url", sourceUrl: "https://example.edu/intake" };
  await assert.rejects(service.saveDraft(context("session"), base), error => error.status === 400);
  await assert.rejects(service.saveDraft(context("session"), { ...base, openDate: null, sourceUrl: "http://example.edu" }), error => error.status === 400);
  await assert.rejects(service.saveDraft(context("session"), { ...base, openDate: null, sourceUrl: "https://example.edu", schoolId }),
    error => error.status === 400);
  const wrongTenant = createRequestContext({ actorUserId: userId, activeRole: "school_staff", selectedSurface: "school",
    purpose: "school_catalog_intake", authStrength: "session" });
  await assert.rejects(service.list(wrongTenant), error => error.status === 403);
});

test("verified schools may use an audited first-party attestation without inventing a public URL", async () => {
  let saved;
  const service = new SchoolCatalogIntakeService({ async list() { return []; }, async saveDraft(input) { saved = input; return item("draft"); },
    async publish() { return null; }, async withdraw() { return null; } }, { async record() {} });
  await service.saveDraft(context("session"), { programId, intakeTerm: "fall", intakeYear: 2027,
    openDate: null, deadlineDate: "2027-06-01T00:00:00.000Z", evidenceType: "school_attestation",
    sourceLabel: "Admissions office confirmation", changeNote: "Confirmed by the authorized school admissions team." });
  assert.equal(saved.sourceUrl, null);
  assert.equal(saved.evidenceType, "school_attestation");
  await assert.rejects(service.saveDraft(context("session"), { programId, intakeTerm: "fall", intakeYear: 2027,
    openDate: null, deadlineDate: "2027-06-01T00:00:00.000Z", evidenceType: "school_attestation",
    sourceLabel: "Admissions office" }), error => error.status === 400);
});
