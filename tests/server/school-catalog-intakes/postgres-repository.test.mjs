import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PostgresSchoolCatalogIntakeRepository } from "../../../src/server/school-catalog-intakes/postgres-repository.ts";

const actorUserId = randomUUID(), schoolId = randomUUID(), programId = randomUUID(), versionId = randomUUID();
const row = status => ({ id: versionId, schoolId, programId, programNameEn: "Accounting", programNameZh: null,
  intakeTerm: "fall", intakeYear: 2027, version: 1, openDate: null, deadlineDate: new Date("2027-06-01T00:00:00Z"),
  deadlineLabel: null, applicationRound: "Fall 2027", evidenceType: "official_url", sourceUrl: "https://example.edu/2027", sourceLabel: null,
  changeNote: null, status, publicationRevision: status === "draft" ? null : 1,
  publicationStatus: status === "withdrawn" ? "withdrawn" : status === "draft" ? null : "active",
  createdByUserId: actorUserId, createdAt: new Date(), updatedAt: new Date() });

test("draft save is tenant and role scoped and creates a new annual version without touching program_intakes", async () => {
  const calls = [];
  const repo = new PostgresSchoolCatalogIntakeRepository({ async query(sql, params) {
    calls.push({ sql, params });
    if (calls.length === 1) return [{ id: programId }];
    if (calls.length === 2) return [];
    if (calls.length === 3) return [{ id: versionId }];
    return [row("draft")];
  } });
  const result = await repo.saveDraft({ actorUserId, schoolId, programId, intakeTerm: "fall", intakeYear: 2027,
    openDate: null, deadlineDate: new Date("2027-06-01T00:00:00Z"), deadlineLabel: null,
    applicationRound: "Fall 2027", evidenceType: "official_url", sourceUrl: "https://example.edu/2027", sourceLabel: null, changeNote: null });
  assert.equal(result.status, "draft");
  assert.match(calls[0].sql, /p\.school_id = \$2/);
  assert.match(calls[0].sql, /m\.role in \('admissions','school_admin'\)/);
  assert.match(calls[0].sql, /extract\(year from clock_timestamp\(\)/);
  assert.match(calls[2].sql, /insert into school_program_intake_versions/);
  assert.equal(calls.some(call => /insert into program_intakes/.test(call.sql)), false);
});

test("publishing atomically updates the public projection and versioned publication pointer", async () => {
  const calls = [];
  const repo = new PostgresSchoolCatalogIntakeRepository({ async query(sql, params) {
    calls.push({ sql, params });
    if (calls.length === 1) return [{ id: versionId, programId, intakeTerm: "fall", intakeYear: 2027,
      openDate: null, deadlineDate: new Date("2027-06-01T00:00:00Z"), deadlineLabel: null, applicationRound: "Fall 2027" }];
    if (calls.length === 6) return [row("published")];
    return [];
  } });
  assert.equal((await repo.publish({ actorUserId, schoolId, versionId })).status, "published");
  assert.match(calls[0].sql, /v\.school_id=\$2.*v\.status='draft'.*deadline_date > clock_timestamp\(\)/s);
  assert.match(calls[1].sql, /insert into program_intakes.*on conflict \(program_id,intake_term,intake_year\)/s);
  assert.match(calls[4].sql, /insert into school_program_intake_publications.*revision=school_program_intake_publications\.revision\+1/s);
});

test("withdrawal closes only the exact published annual intake", async () => {
  const calls = [];
  const repo = new PostgresSchoolCatalogIntakeRepository({ async query(sql, params) {
    calls.push({ sql, params });
    if (calls.length === 1) return [{ programId, intakeTerm: "fall", intakeYear: 2027 }];
    if (calls.length === 5) return [row("withdrawn")];
    return [];
  } });
  assert.equal((await repo.withdraw({ actorUserId, schoolId, versionId })).status, "withdrawn");
  assert.match(calls[1].sql, /update program_intakes set status='closed'.*program_id=\$1 and intake_term=\$2 and intake_year=\$3/s);
  assert.match(calls[2].sql, /status='withdrawn'.*revision=revision\+1/s);
});
