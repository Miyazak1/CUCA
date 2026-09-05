import { randomUUID } from "node:crypto";
import { ApplicationMaterialSnapshotCipher } from "../../../src/server/student/application-material-snapshot-envelope.ts";
import { PostgresApplicationMaterialSnapshot } from "../../../src/server/student/postgres-application-material-snapshot.ts";
import { PostgresApplicationPreflight } from "../../../src/server/student/postgres-application-preflight.ts";
import {
  applicationSubmissionAuthorizationFixture,
  clearApplicationSubmissionAuthorizations,
} from "./application-submission-authorization-fixture.mjs";

export const MATERIAL_SNAPSHOT_TEST_KEY_ID = "synthetic-snapshot-key";
export const MATERIAL_SNAPSHOT_TEST_KEY = Buffer.alloc(32, 83);
export const MATERIAL_SNAPSHOT_TEST_KEYRING_JSON = JSON.stringify({
  [MATERIAL_SNAPSHOT_TEST_KEY_ID]: MATERIAL_SNAPSHOT_TEST_KEY.toString("base64url"),
});

export function materialSnapshotCipher() {
  return new ApplicationMaterialSnapshotCipher({ activeKeyId: MATERIAL_SNAPSHOT_TEST_KEY_ID,
    keys: new Map([[MATERIAL_SNAPSHOT_TEST_KEY_ID, MATERIAL_SNAPSHOT_TEST_KEY]]) });
}

export async function applicationMaterialSnapshotFixture(pool, existingUserId) {
  const f = await applicationSubmissionAuthorizationFixture(pool, existingUserId);
  const authorization = await f.recordAuthorization();
  const cipher = materialSnapshotCipher(), snapshotService = new PostgresApplicationMaterialSnapshot(f.client, cipher);
  const snapshotPreflight = new PostgresApplicationPreflight(f.client, cipher);
  const snapshotInput = { authorizationId: authorization.id,
    expectedAuthorizationScopeSha256: authorization.confirmation.scopeSha256,
    expectedMaterialContentSha256: authorization.material.contentSha256 };
  async function snapshotRequest() {
    const report = await snapshotPreflight.get(f.context, f.set.id, f.choice.id, "en");
    return { expectedVersions: { applicationSet: report.revision, applicant: report.preparation.applicant.revision,
      education: report.preparation.education.revision, assessments: report.preparation.assessments.revision },
    selection: structuredClone(f.input.selection) };
  }
  return { ...f, authorization, cipher, snapshotService, snapshotPreflight, snapshotInput, snapshotRequest,
    snapshotPath: f.authorizationPath.replace("/submission-authorization", "/material-snapshot"),
    createSnapshot: (value = snapshotInput, key = randomUUID(), target = {}) => snapshotService.create(f.context,
      target.applicationSetId ?? f.set.id, target.choiceId ?? f.choice.id, value, key),
    getSnapshot: (target = {}) => snapshotService.get(f.context,
      target.applicationSetId ?? f.set.id, target.choiceId ?? f.choice.id),
    getSnapshotPreflight: (locale = "en") => snapshotPreflight.get(f.context, f.set.id, f.choice.id, locale) };
}

export async function clearApplicationMaterialSnapshots(pool) {
  await pool.query("delete from student_application_command_receipts where operation = 'application_material_snapshot.create'");
  await pool.query("delete from application_material_snapshots");
  await clearApplicationSubmissionAuthorizations(pool);
}
