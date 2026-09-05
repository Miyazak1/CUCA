# CUAC Private Student Files Runbook

Status: implementation complete locally; real Alibaba Cloud staging acceptance is required before enablement.

## Security Boundary

- File authority is derived only from an active student session on the student surface with `purpose=student_action` and no school tenant.
- The server generates `private/student-files/{prefix}/{uuid}` keys. Clients cannot choose buckets, endpoints, keys, owners or object versions.
- OSS access uses fixed-region HTTPS V4 signatures. Upload requests bind content type, private ACL, KMS key, file id and expected SHA-256 metadata.
- Completion captures the current OSS version id and validates size, type, metadata and KMS posture. Scanning, download and exact deletion remain bound to that version.
- Files cannot receive download authorization before status `clean`. Malware, integrity mismatch and terminal scan errors enter deletion.
- API and worker audit records exclude filename, object key, object version, digest, URL and provider errors.
- Agent code has no file action and no direct database or OSS credentials.

## API Sequence

1. `POST /api/v1/student/files` with a unique `Idempotency-Key` and `{category,filename,contentType,sizeBytes,sha256}`.
2. Upload with the returned `PUT` URL and every returned signed header.
3. `POST /api/v1/student/files/{fileId}/complete` with `{expectedRevision}`.
4. Wait for the supervised worker to move `pending_scan` to `clean` or deletion.
5. `POST /api/v1/student/files/{fileId}/download` to receive a short exact-version URL.
6. `POST /api/v1/student/files/{fileId}/delete` with `{expectedRevision}` for asynchronous deletion.
7. `GET /api/v1/student/files` returns active owner-scoped records without storage identifiers.

The state machine is `pending_upload -> pending_scan -> scanning -> clean`. Any
owner deletion, malware, digest mismatch, terminal scan failure or retention
expiry moves through `delete_pending -> deleting -> deleted`. Expired scan and
delete leases are recovered with `FOR UPDATE SKIP LOCKED`. Upload intents that
remain incomplete for 24 hours after URL expiry are deleted automatically. A
successful object deletion scrubs the filename, digest, object version and ETag
from the PostgreSQL tombstone.

## Required Cloud Controls

1. Create a dedicated private OSS bucket in the same region as the application.
2. Enable bucket versioning and Block Public Access. Do not grant anonymous read or write.
3. Require server-side KMS encryption and configure the exact `ALIYUN_OSS_KMS_KEY_ID`.
4. Scope API and worker RAM identities to this bucket and the `private/student-files/` prefix. The API identity needs only operations used for PUT signing, HEAD and GET signing; the worker identity needs exact GET and DELETE. Inject separate credentials per process even though both use the same environment variable names.
5. Configure CORS only for the exact `CUAC_PUBLIC_APP_URL` origin, `PUT`, and the signed request headers. Do not allow wildcard origins with credentials.
6. Configure lifecycle cleanup for noncurrent versions, expired delete markers and incomplete multipart uploads. A versionless delete marker is written after exact-version deletion to hide any late reuse of an upload URL.
7. Run `clamd` on a private worker host with current signatures and no public listener. Supervise `npm run start:student-file-worker` separately from the API.
8. Keep secrets in the deployment secret manager. Never commit or print access keys, KMS ids, signed URLs or scanner output.

## Staging Acceptance Evidence

Record timestamps, deployment revision and nonsensitive resource ids for each result:

- Valid PDF/JPEG/PNG/DOCX reaches `clean`; exact-version download succeeds and has a short expiry.
- Wrong size, type, metadata, KMS key and missing version id are rejected and deleted.
- EICAR or the approved harmless scanner fixture reaches `malware` and is not downloadable.
- Content whose bytes do not match the declared SHA-256 reaches `integrity_mismatch`.
- Scanner outage retries five times, then schedules deletion; an expired scan lease is recovered.
- OSS delete failure retries without declaring deletion; an expired delete lease is recovered.
- Delete requested during `pending_upload` waits until the signed URL expires, then removes the current object and captured version when present.
- A reused PUT URL cannot change the exact version downloaded; lifecycle policy removes unreferenced versions.
- Cross-user ids, guest sessions, school roles, Ops roles and Agent contexts cannot list, complete, download or delete a student file.
- PostgreSQL migration 0034 and route rehearsals pass against the staging schema.
- Logs and audit rows contain no filename, key, version, digest, URL, credentials or provider error text.

After evidence review, set `CUAC_FILE_UPLOAD_ENABLED=true` and all five acceptance
flags in the environment template to `true`. `infra:production-check` is still an
offline preflight; deployment approval must cite the staging evidence separately.

## Provider References

- [OSS V4 presigned download](https://www.alibabacloud.com/help/en/oss/developer-reference/download-objects-using-a-presigned-url-generated-with-oss-sdk-for-node-js)
- [Direct upload from clients](https://www.alibabacloud.com/help/en/oss/user-guide/uploading-objects-to-oss-directly-from-clients/)
- [OSS upload methods](https://www.alibabacloud.com/help/en/oss/user-guide/upload-objects-to-oss/)
- [OSS malicious-file checking](https://www.alibabacloud.com/help/en/oss/user-guide/check-for-malicious-files)
