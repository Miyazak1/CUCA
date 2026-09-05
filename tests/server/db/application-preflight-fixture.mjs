import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresApplicationPreflight } from "../../../src/server/student/postgres-application-preflight.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { governanceFixture, preparedRequirement, approveInput, publishInput } from "./requirement-governance-fixture.mjs";
import { noticeFixture, approvedNotice, publishNotice } from "./notices-fixture.mjs";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";
import { assessmentInput } from "../student/assessment-fixture.mjs";
import { insertHistoricalApplicationChoice } from "./historical-application-choice-fixture.mjs";

export async function preflightFixture(pool, existingUserId, options = {}) {
  const catalog = await governanceFixture(pool), notices = await noticeFixture(pool);
  const userId = existingUserId ?? (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`preflight-${randomUUID()}@example.invalid`])).rows[0].id;
  if (!existingUserId) await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [userId]);
  const context = createRequestContext({ actorUserId: userId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
  const client = createTransactionalSqlClient(pool), student = createPostgresStudentService(client), reader = new PostgresApplicationPreflight(client);
  await pool.query("update program_intakes set open_date = now() - interval '1 day', deadline_date = now() + interval '1 day', status = 'open' where id = $1", [catalog.intakeId]);
  const set = await student.createOwnApplicationSet(context, { name: "Private preflight set", targetIntake: "IGNORED_LEGACY_LABEL" }, { idempotencyKey: randomUUID() });
  const choiceInput = { applicationSetId: set.id, schoolId: catalog.schoolId,
    programId: catalog.programId, programIntakeId: catalog.intakeId, studentNotes: "PRIVATE_CHOICE_NOTE" };
  const choice = options.legacyChoiceSchema
    ? await insertHistoricalApplicationChoice(pool, context, choiceInput)
    : await student.addOwnApplicationChoice(context, choiceInput, { idempotencyKey: randomUUID() });
  async function publish(document = requirementDocument()) {
    const draft = await preparedRequirement(catalog, randomUUID(), document);
    const requirements = await catalog.service.approve(catalog.reviewer, catalog.programId, catalog.intakeId, approveInput(draft));
    await catalog.service.publish(catalog.reviewer, catalog.programId, catalog.intakeId, publishInput(requirements));
    const notice = await approvedNotice(notices); await publishNotice(notices, notice);
    return { requirements, notice };
  }
  async function populate() {
    await student.updateOwnApplicantProfile(context, { expectedRevision: 0, fullName: "PRIVATE_APPLICANT_NAME", contactEmail: "private-applicant@example.invalid", citizenshipCountry: "CN" });
    await student.addOwnEducationRecord(context, { expectedRevision: 0, institutionName: "PRIVATE_EDUCATION_NAME", educationLevel: "bachelor" });
    await student.addOwnAssessmentRecord(context, assessmentInput());
  }
  return { catalog, notices, userId, context, client, student, reader, set, choice, publish, populate,
    get: (locale = "en", service = reader) => service.get(context, set.id, choice.id, locale),
    path: `/api/v1/student/application-sets/${set.id}/choices/${choice.id}/preflight?locale=en` };
}
