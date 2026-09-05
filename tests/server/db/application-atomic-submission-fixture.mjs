import { randomUUID } from "node:crypto";
import { PostgresApplicationFeeEntitlementService } from "../../../src/server/billing/postgres-application-fee-entitlement.ts";
import { PostgresBillingRepository } from "../../../src/server/billing/postgres-repository.ts";
import { approveInput, preparedRequirement, publishInput } from "./requirement-governance-fixture.mjs";
import { materialSelectionFixture } from "./material-selection-fixture.mjs";
import { PostgresApplicationMaterialPreview } from "../../../src/server/student/postgres-application-material-preview.ts";
import { PostgresMaterialSelection } from "../../../src/server/student/postgres-material-selection.ts";
import { PostgresApplicationSubmissionAuthorization } from "../../../src/server/student/postgres-application-submission-authorization.ts";
import { APPLICATION_AUTHORIZATION_CONFIRMATION } from "../../../src/server/student/application-submission-authorization.ts";
import { PostgresApplicationMaterialSnapshot } from "../../../src/server/student/postgres-application-material-snapshot.ts";
import {
  clearApplicationMaterialSnapshots,
  materialSnapshotCipher,
} from "./application-material-snapshot-fixture.mjs";
import { approvePolicy, officialSubmissionPolicyFixture, policyPublishInput } from "./official-submission-policy-fixture.mjs";
import { policyDocument } from "../submission-policy/fixture.mjs";
import { PostgresApplicationSubmissionService } from "../../../src/server/student/postgres-application-submission.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

const feeSchedule = { currency: "CNY", applicationFeeMinor: 80000, serviceFeeMinor: 40000 };

export async function applicationAtomicSubmissionFixture(pool, options = {}) {
  const f = await materialSelectionFixture(pool, options.userId, true, { readVersionsDirectly: true });
  await f.publish();
  const secondProgram = (await pool.query(`insert into programs
    (school_id,slug,name_en,degree_level,status) values ($1,$2,'Second same-school program','master','active') returning id`,
  [f.catalog.schoolId, randomUUID()])).rows[0];
  const secondIntake = (await pool.query(`insert into program_intakes
    (program_id,intake_term,intake_year,status,open_date,deadline_date)
    values ($1,'fall',2098,'open',clock_timestamp() - interval '1 day',clock_timestamp() + interval '180 days') returning id`,
  [secondProgram.id])).rows[0];
  const secondCatalog = { ...f.catalog, programId: secondProgram.id, intakeId: secondIntake.id };
  const secondRequirementDraft = await preparedRequirement(secondCatalog);
  const secondRequirement = await f.catalog.service.approve(f.catalog.reviewer, secondProgram.id, secondIntake.id,
    approveInput(secondRequirementDraft));
  await f.catalog.service.publish(f.catalog.reviewer, secondProgram.id, secondIntake.id, publishInput(secondRequirement));

  const secondChoice = await f.student.addOwnApplicationChoice(f.context, {
    applicationSetId: f.set.id,
    schoolId: f.catalog.schoolId,
    programId: secondProgram.id,
    programIntakeId: secondIntake.id,
    rankOrder: 1,
  }, { idempotencyKey: randomUUID() });
  const targets = [
    { programId: f.catalog.programId, programIntakeId: f.catalog.intakeId },
    { programId: secondProgram.id, programIntakeId: secondIntake.id },
  ];
  const policyFixture = await officialSubmissionPolicyFixture(pool, { schoolId: f.catalog.schoolId, targets });
  const document = { ...policyDocument(policyFixture.admissionRouteKey),
    formMode: options.formMode ?? "one_program_per_form",
    maxProgramChoices: options.maxProgramChoices ?? 2,
    orderingMode: options.orderingMode ?? "ranked" };
  const approvedPolicy = await approvePolicy(policyFixture, randomUUID(), document, targets);
  await policyFixture.service.publish(policyFixture.reviewer, policyFixture.schoolId, policyFixture.policyKey,
    policyFixture.admissionRouteKey, policyPublishInput(approvedPolicy));
  for (const choice of [f.choice, secondChoice]) {
    const set = await f.student.getOwnApplicationSet(f.context, f.set.id);
    await f.student.updateOwnApplicationChoice(f.context, f.set.id, choice.id,
      { expectedRevision: set.revision, admissionRouteKey: policyFixture.admissionRouteKey });
  }

  const selectionService = new PostgresMaterialSelection(f.client);
  const previewService = new PostgresApplicationMaterialPreview(f.client);
  const authorizationService = new PostgresApplicationSubmissionAuthorization(f.client);
  const cipher = materialSnapshotCipher();
  const snapshotService = new PostgresApplicationMaterialSnapshot(f.client, cipher);
  const notice = await f.notices.get();
  if (!notice) throw new Error("Synthetic application notice was not published.");
  const evidence = [];
  for (const choice of [f.choice, secondChoice]) {
    const materialInput = await f.request();
    const selection = await selectionService.put(f.context, f.set.id, choice.id,
      { expectedRevision: 0, ...materialInput });
    const preview = await previewService.preview(f.context, f.set.id, choice.id, materialInput);
    const target = choice.id === f.choice.id ? targets[0] : targets[1];
    const policy = await policyFixture.getPublished(target);
    if (!policy) throw new Error("Synthetic application policy was not published.");
    const authorization = await authorizationService.record(f.context, f.set.id, choice.id, {
      locale: notice.locale,
      expectedMaterialSelectionRevision: selection.revision,
      expectedVersions: selection.savedVersions,
      expectedNotice: { versionId: notice.versionId, publicationRevision: notice.publicationRevision,
        contentSha256: notice.contentSha256 },
      expectedPolicy: { admissionRouteKey: policy.admissionRouteKey, versionId: policy.versionId,
        publicationRevision: policy.publicationRevision, documentSha256: policy.documentSha256 },
      materialContentSha256: preview.contentSha256,
      confirmation: APPLICATION_AUTHORIZATION_CONFIRMATION,
    }, randomUUID());
    const snapshot = await snapshotService.create(f.context, f.set.id, choice.id, {
      authorizationId: authorization.id,
      expectedAuthorizationScopeSha256: authorization.confirmation.scopeSha256,
      expectedMaterialContentSha256: authorization.material.contentSha256,
    }, randomUUID());
    evidence.push({ choice, selection, preview, policy, authorization, snapshot });
  }

  const providerSessionId = `submission-${randomUUID()}`;
  const billing = new PostgresBillingRepository(f.client, feeSchedule, {
    provider: "rehearsal_hosted",
    async createCheckoutSession() {
      return { providerCheckoutSessionId: providerSessionId,
        checkoutUrl: `https://payments.example.invalid/checkout/${providerSessionId}` };
    },
  });
  const choiceIds = [f.choice.id, secondChoice.id];
  const checkout = await billing.createCheckoutIntent(f.userId, {
    applicationSetId: f.set.id,
    applicationChoiceIds: choiceIds,
    successReturnPath: "/application/fee/success",
    cancelReturnPath: "/application/fee/cancel",
  });
  const payment = (await pool.query("select id from payments where id = $1", [checkout.checkoutSessionId])).rows[0];
  await pool.query("update invoices set status = 'paid', finalized_at = clock_timestamp() where id = $1", [checkout.invoiceId]);
  await pool.query("update payments set status = 'succeeded', paid_at = clock_timestamp() where id = $1", [payment.id]);
  const event = (await pool.query(`insert into payment_status_events
    (payment_id,from_status,to_status,provider_event_id,metadata_json)
    values ($1,'requires_payment','succeeded',$2,'{}'::jsonb) returning id`,
  [payment.id, `submission-event-${randomUUID()}`])).rows[0];
  const admin = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id",
    [`submission-billing-${randomUUID()}@example.invalid`])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,'cuac_admin')", [admin.id]);
  const adminContext = createRequestContext({ actorUserId: admin.id, activeRole: "cuac_admin", selectedSurface: "ops",
    purpose: "billing", authStrength: "step_up" });
  const entitlements = await new PostgresApplicationFeeEntitlementService(f.client)
    .grantFromSettledPayment(adminContext, { paymentId: payment.id, paymentStatusEventId: event.id });
  const currentSet = await f.student.getOwnApplicationSet(f.context, f.set.id);
  const context = { ...f.context, authStrength: "step_up", requestId: `submit-${randomUUID()}` };
  const service = new PostgresApplicationSubmissionService(f.client, cipher);
  const input = { expectedRevision: currentSet.revision, choiceIds, confirmSubmission: true };
  return {
    ...f,
    context,
    service,
    cipher,
    second: { choice: secondChoice, programId: secondProgram.id, intakeId: secondIntake.id },
    choices: [f.choice, secondChoice],
    evidence,
    policyFixture,
    approvedPolicy,
    checkout,
    paymentId: payment.id,
    paymentStatusEventId: event.id,
    entitlements,
    input,
    submit: (value = input, key = randomUUID(), requestContext = context) => service.submit(requestContext,
      f.set.id, value, key),
  };
}

export async function clearApplicationAtomicSubmissions(pool) {
  await pool.query("delete from official_submission_delivery_receipts");
  await pool.query("delete from official_submission_outbox");
  await pool.query("delete from official_submission_group_members");
  await pool.query("delete from official_submission_groups");
  await pool.query("delete from school_applications where application_submission_id is not null");
  await pool.query("delete from student_application_command_receipts where operation = 'application.submit'");
  await pool.query("delete from application_submissions");
  await clearApplicationMaterialSnapshots(pool);
}
