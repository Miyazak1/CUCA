import assert from "node:assert/strict";
import test from "node:test";
import { PostgresStudentCoreRepository } from "../../../src/server/index.ts";

test("Postgres choice creation translates only the known program uniqueness constraint", async () => {
  const duplicate = { code: "23505", constraint: "application_choices_active_set_program_unique" };
  const { client } = createClient(() => { throw duplicate; });
  await assert.rejects(new PostgresStudentCoreRepository(client).addApplicationChoice("owner", { applicationSetId: "set", schoolId: "school" }), (e) => e.code === "CONFLICT" && e.status === 409);
  const other = { code: "23505", constraint: "unrelated_constraint" };
  const otherClient = createClient(() => { throw other; }).client;
  await assert.rejects(new PostgresStudentCoreRepository(otherClient).addApplicationChoice("owner", { applicationSetId: "set", schoolId: "school" }), (e) => e === other);
});

function createClient(responder) {
  const calls = [];
  return {
    calls,
    client: {
      async query(statement, params) {
        calls.push({ statement, params });
        return responder(statement, params, calls.length);
      },
    },
  };
}

test("Postgres draft edit binds owner, revision, nullable values and field presence without dynamic updates", async () => {
  const { client, calls } = createClient(() => [{ editable: true, revision: 2, selectionValid: true, routeValid: true, changed: true }]);
  const repo = new PostgresStudentCoreRepository(client);
  assert.deepEqual(await repo.updateApplicationChoice("owner", "set", "choice", { expectedRevision: 2, studentNotes: null }), { changed: true });
  assert.deepEqual(calls[0].params, ["set", "owner", "choice", 2, null, null, false, true, null, false]);
  for (const pattern of [/where id = \$1 and user_id = \$2 for update/, /c.id = \$3 and c.user_id = \$2 for update of c/,
    /o.revision = \$4/, /c.removed_at is null/, /school_applications/, /s.program_id = c.program_id/,
    /revision = revision \+ 1/, /is distinct from/, /case when \$8/]) assert.match(calls[0].statement, pattern);
  assert.doesNotMatch(calls[0].statement, /select \*|delete from|payments|agent_/i);
});

test("Postgres route edit requires a current exact policy and invalidates revision-bound preparation", async () => {
  const { client, calls } = createClient(() => [{ editable: true, revision: 5, selectionValid: true, routeValid: true, changed: true }]);
  const repo = new PostgresStudentCoreRepository(client);
  assert.deepEqual(await repo.updateApplicationChoice("owner", "set", "choice",
    { expectedRevision: 5, admissionRouteKey: "direct_university" }), { changed: true });
  assert.deepEqual(calls[0].params, ["set", "owner", "choice", 5, null, null, false, false, "direct_university", true]);
  for (const pattern of [/admission_route_key = case when \$10/, /official_submission_policy_publications/,
    /pub\.program_intake_id = c\.program_intake_id/, /pub\.admission_route_key = \$9/,
    /pub\.status = 'active'/, /v\.review_status = 'approved'/, /for share of pub/,
    /c\.admission_route_key is distinct from \$9::text/, /requirement_snapshot_json = case when/]) {
    assert.match(calls[0].statement, pattern);
  }
});

test("Postgres order checks full unique membership, editable choices and expected parent revision", async () => {
  const { client, calls } = createClient(() => [{ editable: true, revision: 2, selectionMatches: true, changed: false }]);
  assert.deepEqual(await new PostgresStudentCoreRepository(client).reorderApplicationChoices("owner", "set", { expectedRevision: 2, choiceIds: ["choice"] }), { changed: false });
  assert.deepEqual(calls[0].params, ["set", "owner", ["choice"], 2]);
  for (const pattern of [/where id = \$1 and user_id = \$2 for update/, /order by c.id for update of c/, /count\(distinct id\)/,
    /cardinality\(\$3::uuid\[\]\)/, /c.application_set_id = a.id and c.user_id = \$2/, /a.revision = \$4/,
    /rank_order is distinct from/, /revision = revision \+ 1/]) assert.match(calls[0].statement, pattern);
});

test("Postgres draft mutation errors do not disclose another owner or accept stale versions", async () => {
  for (const operation of ["edit", "order"]) {
    const good = { editable: true, revision: 2, selectionValid: true, routeValid: true, selectionMatches: true, changed: false };
    for (const [rows, status] of [[[], 403], [[{ ...good, editable: false }], 409], [[{ ...good, revision: 3 }], 409],
      [[{ ...good, selectionValid: false, selectionMatches: false }], operation === "edit" ? 403 : 409]]) {
      const repo = new PostgresStudentCoreRepository(createClient(() => rows).client);
      const promise = operation === "edit" ? repo.updateApplicationChoice("owner", "set", "choice", { expectedRevision: 2, studentNotes: null })
        : repo.reorderApplicationChoices("owner", "set", { expectedRevision: 2, choiceIds: [] });
      await assert.rejects(promise, e => e.status === status);
    }
    if (operation === "edit") {
      const repo = new PostgresStudentCoreRepository(createClient(() => [{ ...good, routeValid: false }]).client);
      await assert.rejects(repo.updateApplicationChoice("owner", "set", "choice",
        { expectedRevision: 2, admissionRouteKey: "direct_university" }), e => e.status === 409);
    }
  }
});

test("Postgres choice removal locks owner and parent, ends authorization, scrubs private draft fields and records a transition", async () => {
  const { client, calls } = createClient(() => [{ id: "choice", applicationSetId: "set", changed: true,
    alreadyRemoved: false, authorizationWithdrawn: true }]);
  assert.deepEqual(await new PostgresStudentCoreRepository(client).removeApplicationChoice("owner", "set", "choice"),
    { id: "choice", applicationSetId: "set", status: "removed", changed: true, authorizationWithdrawn: true });
  assert.deepEqual(calls[0].params, ["set", "owner", "choice"]);
  const sql = calls[0].statement;
  assert.match(sql, /where id = \$1 and user_id = \$2 for update/);
  assert.match(sql, /a.id = c.application_set_id and a.user_id = c.user_id/);
  assert.match(sql, /where c.id = \$3 and c.user_id = \$2 for update of c/);
  assert.match(sql, /status = 'draft' and locked_at is null and submitted_at is null/);
  assert.match(sql, /c.status = 'draft' and not exists/);
  assert.match(sql, /school_applications sa where sa.application_choice_id = c.id/);
  assert.match(sql, /o.editable and o.removed_at is null/);
  assert.match(sql, /student_notes = null, requirement_snapshot_json = '\{\}'::jsonb, metadata_json = '\{\}'::jsonb/);
  assert.match(sql, /insert into application_choice_status_events/);
  assert.match(sql, /update application_submission_authorizations auth set status = 'withdrawn'/);
  assert.match(sql, /end_reason = 'choice_removed'/);
  assert.deepEqual([...sql.matchAll(/delete from\s+([a-z_]+)/gi)].map(match => match[1]), ["application_material_selections"]);
  assert.match(sql, /delete from application_material_selections m using removed_choice r/);
  assert.match(sql, /m.choice_id = r.id and m.user_id = \$2 and m.application_set_id = \$1/);
  assert.doesNotMatch(sql, /select \*|payments|agent_/i);
});

test("Postgres removal differentiates ownership denial, frozen conflict and idempotent tombstone", async () => {
  for (const [rows, status] of [[[], 403], [[{ alreadyRemoved: false, changed: false }], 409]]) {
    const repo = new PostgresStudentCoreRepository(createClient(() => rows).client);
    await assert.rejects(repo.removeApplicationChoice("owner", "set", "choice"), e => e.status === status);
  }
  const repo = new PostgresStudentCoreRepository(createClient(() => [{ id: "choice", applicationSetId: "set", alreadyRemoved: true,
    changed: false, authorizationWithdrawn: false }]).client);
  assert.deepEqual(await repo.removeApplicationChoice("owner", "set", "choice"), { id: "choice", applicationSetId: "set",
    status: "removed", changed: false, authorizationWithdrawn: false });
});

test("Postgres student repository reads profile with fixed owner SQL", async () => {
  const { client, calls } = createClient(() => [
    {
      id: "profile-1",
      userId: "student-1",
      displayName: "Ada",
      citizenshipCountry: null,
      targetDegreeLevel: "bachelor",
      targetIntake: null,
      preferencesJson: { city: "Beijing" },
      profileCompletionJson: { done: false },
    },
  ]);
  const repository = new PostgresStudentCoreRepository(client);

  const profile = await repository.getProfileByUserId("student-1");

  assert.equal(profile.userId, "student-1");
  assert.deepEqual(profile.preferences, { city: "Beijing" });
  assert.match(calls[0].statement, /from student_profiles/);
  assert.match(calls[0].statement, /where user_id = \$1/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.deepEqual(calls[0].params, ["student-1"]);
});

test("Postgres student repository upserts profile with parameterized JSON preferences", async () => {
  const { client, calls } = createClient(() => [
    {
      id: "profile-1",
      userId: "student-1",
      displayName: "Ada",
      citizenshipCountry: "CN",
      targetDegreeLevel: "master",
      targetIntake: "2027-fall",
      preferencesJson: { fields: ["CS"] },
      profileCompletionJson: {},
    },
  ]);
  const repository = new PostgresStudentCoreRepository(client);

  await repository.upsertProfile("student-1", {
    displayName: "Ada",
    citizenshipCountry: "CN",
    targetDegreeLevel: "master",
    targetIntake: "2027-fall",
    preferences: { fields: ["CS"] },
  });

  assert.match(calls[0].statement, /insert into student_profiles/);
  assert.match(calls[0].statement, /on conflict \(user_id\) do update/);
  assert.equal(calls[0].params[0], "student-1");
  assert.equal(calls[0].params[5], JSON.stringify({ fields: ["CS"] }));
  assert.deepEqual(calls[0].params.slice(6), [true, true, true, true, true]);
});

test("Postgres profile updates carry presence flags instead of treating omitted fields as clearing", async () => {
  const { client, calls } = createClient(() => [{ id: "profile-1", userId: "student-1", preferencesJson: {}, profileCompletionJson: {} }]);
  const repository = new PostgresStudentCoreRepository(client);
  await repository.upsertProfile("student-1", { displayName: null });
  assert.deepEqual(calls[0].params.slice(6), [true, false, false, false, false]);
  assert.match(calls[0].statement, /case when \$11::boolean then excluded.preferences_json else student_profiles.preferences_json end/);
});

test("Postgres student repository lists application sets with choices without exposing other tables", async () => {
  const { client, calls } = createClient((statement) => {
    if (/from application_sets/.test(statement)) {
      return [{ id: "set-1", cuacId: "CUAC-2026-004218", userId: "student-1", name: "Main", status: "draft", revision: 1, targetIntake: null }];
    }

    if (/from application_choices/.test(statement)) {
      return [
        {
          id: "choice-1",
          applicationSetId: "set-1",
          userId: "student-1",
          schoolId: "school-1",
          programId: "program-1",
          scholarshipId: null,
          rankOrder: 1,
          status: "draft",
          studentNotes: null,
        },
      ];
    }

    return [];
  });
  const repository = new PostgresStudentCoreRepository(client);

  const sets = await repository.listApplicationSetsByUserId("student-1");

  assert.equal(sets[0].choices[0].id, "choice-1");
  assert.equal(sets[0].cuacId, "CUAC-2026-004218");
  assert.deepEqual(calls.map((call) => call.params), [["student-1"], [["set-1"], "student-1"]]);
  calls.forEach((call) => {
    assert.doesNotMatch(call.statement, /select \*/i);
    assert.doesNotMatch(call.statement, /payments|agent_|school_staff_memberships/i);
  });
});

test("Postgres student repository atomically allocates a non-primary-key CUAC application reference", async () => {
  const { client, calls } = createClient((statement) => /to_regclass/.test(statement) ? [{ supported: true }] : [{
    id: "9ca26928-2954-43e7-bd13-cd378be25a02",
    cuacId: "CUAC-2026-004219",
    userId: "student-1",
    name: "2026 applications",
    status: "draft",
    revision: 1,
    targetIntake: "2027-fall",
  }]);
  const applicationSet = await new PostgresStudentCoreRepository(client).createApplicationSet("student-1", {
    name: "2026 applications",
    targetIntake: "2027-fall",
  });

  assert.equal(applicationSet.cuacId, "CUAC-2026-004219");
  assert.notEqual(applicationSet.cuacId.includes(applicationSet.id), true);
  assert.deepEqual(calls[1].params, ["student-1", "2026 applications", "2027-fall"]);
  assert.match(calls[1].statement, /insert into application_reference_counters/);
  assert.match(calls[1].statement, /on conflict \(reference_year\) do update/);
  assert.match(calls[1].statement, /clock_timestamp\(\) at time zone 'UTC'/);
  assert.match(calls[1].statement, /last_issued_sequence < 999999/);
  assert.match(calls[1].statement, /cuac_id as "cuacId"/);
  assert.doesNotMatch(calls[1].statement, /id::text|replace\(id|substring\(id/i);
});

test("Postgres student repository creates application choice with server-provided user id", async () => {
  const { client, calls } = createClient(() => [
    { setEditable: true, choice: {
      id: "choice-1",
      applicationSetId: "set-1",
      userId: "student-1",
      schoolId: "school-1",
      programId: "program-1",
      scholarshipId: null,
      rankOrder: 2,
      status: "draft",
      studentNotes: "High fit",
    } },
  ]);
  const repository = new PostgresStudentCoreRepository(client);

  const choice = await repository.addApplicationChoice("student-1", {
    applicationSetId: "set-1",
    schoolId: "school-1",
    programId: "program-1",
    rankOrder: 2,
    studentNotes: "High fit",
  });

  assert.equal(choice.userId, "student-1");
  assert.match(calls[0].statement, /insert into application_choices/);
  assert.match(calls[0].statement, /where id = \$1 and user_id = \$2\s+for update/);
  assert.match(calls[0].statement, /status = 'draft' and locked_at is null and submitted_at is null/);
  assert.match(calls[0].statement, /from owned_application_set a\s+where a.editable/);
  assert.deepEqual(calls[0].params, ["set-1", "student-1", "school-1", "program-1", null, 2, "High fit", null, null]);
});

test("Postgres choice writes distinguish frozen owned sets from unavailable owner or catalog", async () => {
  for (const [rows, status] of [[[{ setEditable: false, choice: null }], 409], [[{ setEditable: true, choice: null }], 403], [[], 403]]) {
    const repository = new PostgresStudentCoreRepository(createClient(() => rows).client);
    await assert.rejects(repository.addApplicationChoice("owner", { applicationSetId: "set", schoolId: "school" }), e => e.status === status);
  }
});

test("Postgres student repository save item uses active unique conflict target", async () => {
  const { client, calls } = createClient(() => [
    {
      id: "saved-1",
      userId: "student-1",
      entityType: "program",
      entityId: "program-1",
      notes: null,
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
    },
  ]);
  const repository = new PostgresStudentCoreRepository(client);

  await repository.saveItem("student-1", { entityType: "program", entityId: "program-1" });

  assert.match(calls[0].statement, /on conflict \(user_id, entity_type, entity_id\) where removed_at is null do update/);
  assert.deepEqual(calls[0].params, ["student-1", "program", "program-1", null]);
});

test("Postgres saved-item listing projects only a minimal typed catalog summary", async () => {
  const lastVerifiedAt = new Date("2026-09-01T00:00:00.000Z");
  const { client, calls } = createClient(() => [{
    id: "saved-1",
    userId: "student-1",
    entityType: "city",
    entityId: "city-1",
    notes: null,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    entitySlug: "hangzhou",
    entityNameEn: "Hangzhou",
    entityNameZh: "Hangzhou zh",
    entityStatus: "active",
    entitySourceStatus: "verified",
    entityLastVerifiedAt: lastVerifiedAt,
  }]);
  const repository = new PostgresStudentCoreRepository(client);

  const [saved] = await repository.listSavedItemsByUserId("student-1");

  assert.deepEqual(saved.catalogItem, {
    id: "city-1",
    slug: "hangzhou",
    nameEn: "Hangzhou",
    nameZh: "Hangzhou zh",
    status: "active",
    sourceStatus: "verified",
    lastVerifiedAt,
  });
  assert.deepEqual(calls[0].params, ["student-1"]);
  for (const pattern of [
    /left join schools school/,
    /left join programs program/,
    /left join scholarships scholarship/,
    /left join cities city/,
    /where si\.user_id = \$1 and si\.removed_at is null/,
  ]) assert.match(calls[0].statement, pattern);
  assert.match(calls[0].statement, /school\.verification_status/);
  assert.match(calls[0].statement, /when coalesce\([^\n]+status[^\n]+\) = 'draft' then 'draft'/);
  assert.doesNotMatch(calls[0].statement, /\.source_status/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
});

test("Postgres saved-item removal is an owner-scoped soft delete", async () => {
  const removedAt = new Date("2026-09-04T00:00:00.000Z");
  const { client, calls } = createClient(() => [{
    id: "saved-1",
    entityType: "program",
    entityId: "program-1",
    removedAt,
  }]);
  const repository = new PostgresStudentCoreRepository(client);

  const result = await repository.removeSavedItem("student-1", "saved-1");

  assert.deepEqual(result, { id: "saved-1", entityType: "program", entityId: "program-1", removedAt });
  assert.deepEqual(calls[0].params, ["saved-1", "student-1"]);
  assert.match(calls[0].statement, /update saved_items/);
  assert.match(calls[0].statement, /where id = \$1::uuid/);
  assert.match(calls[0].statement, /and user_id = \$2::uuid/);
  assert.match(calls[0].statement, /and removed_at is null/);
  assert.match(calls[0].statement, /set removed_at = now\(\)/);
  assert.doesNotMatch(calls[0].statement, /delete from|select \*/i);
});

test("Postgres saved-item removal returns null for unavailable ownership", async () => {
  const repository = new PostgresStudentCoreRepository(createClient(() => []).client);
  assert.equal(await repository.removeSavedItem("student-1", "saved-1"), null);
});
