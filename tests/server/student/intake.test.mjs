import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { parseApplicationChoice, parseApplicationChoiceUpdate } from "../../../src/server/student/input.ts";
import { applicationCommandDigests } from "../../../src/server/student/application-commands.ts";
import { PostgresStudentCoreRepository } from "../../../src/server/student/postgres-repository.ts";

const base = { applicationSetId: randomUUID(), schoolId: randomUUID(), programId: randomUUID() };
const key = randomUUID(), intake = randomUUID();
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("choice intake input requires a concrete program and a canonical UUID", () => {
  const parsed = parseApplicationChoice({ ...base, programIntakeId: intake.toUpperCase() });
  assert.equal(parsed.programIntakeId, intake);
  for (const value of ["", "not-uuid", {}, 1, `${intake} `]) {
    assert.throws(() => parseApplicationChoice({ ...base, programIntakeId: value }), e => e.status === 400);
  }
  for (const programId of [null, undefined]) {
    assert.throws(() => parseApplicationChoice({ ...base, programId, programIntakeId: intake }), e => e.status === 400);
  }
  assert.throws(() => parseApplicationChoiceUpdate({ expectedRevision: 1, programIntakeId: intake }), e => e.status === 400);
});

test("legacy and explicit-null intake requests retain exact historical v1 receipt bytes", () => {
  const legacy = { ...base, scholarshipId: null, rankOrder: 0, studentNotes: null };
  for (const input of [base, { ...base, programIntakeId: null }, { ...base, programIntakeId: undefined }]) {
    const parsed = parseApplicationChoice(input);
    assert.deepEqual(parsed, legacy);
    assert.equal(applicationCommandDigests("application_choice.add", parsed, key).requestHash,
      hash({ version: 1, operation: "application_choice.add", input: legacy }));
  }
});

test("intake-bound v2 digests distinguish targets without changing the original receipt key scope", () => {
  const input = parseApplicationChoice({ ...base, programIntakeId: intake });
  const digest = applicationCommandDigests("application_choice.add", input, key);
  assert.equal(digest.requestHash, hash({ version: 2, operation: "application_choice.add", input }));
  for (const variant of [base, { ...base, programIntakeId: randomUUID() }]) {
    const other = applicationCommandDigests("application_choice.add", parseApplicationChoice(variant), key);
    assert.equal(other.keyHash, digest.keyHash);
    assert.notEqual(other.requestHash, digest.requestHash);
  }
});

test("admission route is explicit route-bound v3 input and never changes legacy hashes", () => {
  const input = parseApplicationChoice({ ...base, programIntakeId: intake, admissionRouteKey: "direct_university" });
  assert.equal(input.admissionRouteKey, "direct_university");
  assert.equal(applicationCommandDigests("application_choice.add", input, key).requestHash,
    hash({ version: 3, operation: "application_choice.add", input }));
  assert.deepEqual(parseApplicationChoice({ ...base, programIntakeId: intake, admissionRouteKey: null }),
    parseApplicationChoice({ ...base, programIntakeId: intake }));
  for (const admissionRouteKey of ["", "Direct", "direct university", "x".repeat(65), {}, 1]) {
    assert.throws(() => parseApplicationChoice({ ...base, programIntakeId: intake, admissionRouteKey }), e => e.status === 400);
  }
  for (const target of [{ ...base, admissionRouteKey: "direct_university" },
    { ...base, programId: null, programIntakeId: intake, admissionRouteKey: "direct_university" }]) {
    assert.throws(() => parseApplicationChoice(target), e => e.status === 400);
  }
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 4, admissionRouteKey: null }),
    { expectedRevision: 4, admissionRouteKey: null });
  assert.deepEqual(parseApplicationChoiceUpdate({ expectedRevision: 4, admissionRouteKey: "csc" }),
    { expectedRevision: 4, admissionRouteKey: "csc" });
});

test("intake writes bind the exact program, check database deadlines and protect the row during creation", async () => {
  const calls = [];
  const choice = { id: randomUUID(), ...base, programIntakeId: intake };
  const repo = new PostgresStudentCoreRepository({ async query(sql, params) { calls.push({ sql, params }); return [{ setEditable: true, choice }]; } });
  assert.equal((await repo.addApplicationChoice("owner", { ...base, programIntakeId: intake })).programIntakeId, intake);
  assert.equal(calls[0].params[7], intake);
  for (const re of [/pi.id = \$8 and pi.program_id = \$4/, /pi.status = 'open'/, /deadline_date > clock_timestamp\(\)/,
    /pi.open_date < pi.deadline_date/, /for share/, /revision = revision \+ 1/, /program_intake_id as "programIntakeId"/]) assert.match(calls[0].sql, re);
  assert.doesNotMatch(calls[0].sql, /select \*|payments|agent_/i);
});

test("non-null route writes require one current reviewed exact-target publication", async () => {
  const calls = [], choice = { id: randomUUID(), ...base, programIntakeId: intake, admissionRouteKey: "direct_university" };
  const repo = new PostgresStudentCoreRepository({ async query(sql, params) { calls.push({ sql, params }); return [{ setEditable: true, choice }]; } });
  const created = await repo.addApplicationChoice("owner", { ...base, programIntakeId: intake, admissionRouteKey: "direct_university" });
  assert.equal(created.admissionRouteKey, "direct_university"); assert.equal(calls[0].params[8], "direct_university");
  for (const re of [/official_submission_policy_publications/, /target\.program_intake_id = pub\.program_intake_id/,
    /pub\.program_intake_id = \$8/, /pub\.program_id = \$4/, /pub\.school_id = \$3/,
    /pub\.admission_route_key = \$9/, /pub\.status = 'active'/, /v\.review_status = 'approved'/, /for share of pub/]) {
    assert.match(calls[0].sql, re);
  }
});

test("only known legacy and intake uniqueness errors become draft conflicts", async () => {
  for (const constraint of ["application_choices_active_set_program_unique", "application_choices_active_set_program_intake_unique", "unrelated"]) {
    const failure = { code: "23505", constraint };
    const repo = new PostgresStudentCoreRepository({ async query() { throw failure; } });
    await assert.rejects(repo.addApplicationChoice("owner", base), e => constraint === "unrelated" ? e === failure : e.status === 409);
  }
});
