import { randomUUID } from "node:crypto";
import {
  APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
  APPLICATION_MATERIAL_SNAPSHOT_SCHEME,
  createApplicationMaterialSnapshotPayload,
} from "../../../src/server/student/application-material-snapshot.ts";
import { materialSnapshotCipher } from "./application-material-snapshot-fixture.mjs";

export async function insertHistoricalApplicationMaterialSnapshot(pool, fixture, authorization) {
  const snapshotId = randomUUID();
  const capturedAt = (await pool.query("select date_trunc('milliseconds', clock_timestamp()) as value")).rows[0].value;
  const payload = createApplicationMaterialSnapshotPayload(fixture.userId,
    { id: authorization.id, scopeSha256: authorization.confirmation.scopeSha256 }, fixture.preview);
  const binding = {
    snapshotId,
    userId: fixture.userId,
    ...authorization.target,
    authorizationId: authorization.id,
    authorizationScopeSha256: authorization.confirmation.scopeSha256,
    materialContentSha256: authorization.material.contentSha256,
    payloadSha256: payload.payloadSha256,
    payloadFormat: APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
    capturedAt,
  };
  const envelope = materialSnapshotCipher().seal(binding, payload.serialized);
  await pool.query(`insert into application_material_snapshots
    (id,user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,authorization_id,
     authorization_scope_sha256,material_selection_revision,source_set_revision,source_applicant_revision,
     source_education_revision,source_assessment_revision,selection_sha256,material_content_sha256,payload_sha256,
     payload_bytes,payload_format,encryption_scheme,encryption_key_id,envelope_json,captured_request_id,captured_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24)`,
  [snapshotId, fixture.userId, fixture.set.id, fixture.choice.id, fixture.catalog.schoolId,
    fixture.catalog.programId, fixture.catalog.intakeId, authorization.id, authorization.confirmation.scopeSha256,
    authorization.material.selectionRevision, authorization.material.sourceVersions.applicationSet,
    authorization.material.sourceVersions.applicant, authorization.material.sourceVersions.education,
    authorization.material.sourceVersions.assessments, authorization.material.selectionSha256,
    authorization.material.contentSha256, payload.payloadSha256, payload.payloadBytes,
    APPLICATION_MATERIAL_SNAPSHOT_FORMAT, APPLICATION_MATERIAL_SNAPSHOT_SCHEME, envelope.keyId,
    JSON.stringify(envelope), randomUUID(), capturedAt]);
  return { id: snapshotId, capturedAt };
}
