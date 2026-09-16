# CUAC staff TOTP MFA contract

Status: implemented locally; Alibaba Cloud staging acceptance is still required before release approval.

## Scope

- MFA is mandatory for `school_staff`, `cuac_ops`, and `cuac_admin` sessions.
- Student sessions remain password based for the current release.
- A staff password proof creates only a five-minute MFA challenge. It does not create an Auth session or set a session cookie.
- Administrators must provide both the current password and an MFA proof before a ten-minute step-up window is activated.

## Enrollment and verification

1. A server-owned, currently active school or CUAC workspace is selected.
2. Password verification creates a random, hashed, single-use MFA challenge.
3. A staff member without an active factor receives a locally generated TOTP secret and `otpauth://` enrollment URI.
4. The first valid six-digit code activates the factor and returns ten recovery codes exactly once.
5. A subsequent login accepts either a fresh TOTP code or one unused recovery code.
6. Only successful MFA completion creates the normal HTTP-only session cookie.

The current UI supports the authenticator application's manual-key and `otpauth` import paths. No secret is sent to a QR, analytics, or other third-party service.

## Security properties

- TOTP secrets use 160 random bits and are encrypted with AES-256-GCM before database storage.
- The keyring is external configuration: `CUAC_AUTH_MFA_ACTIVE_KEY_ID` and `CUAC_AUTH_MFA_KEYS_JSON`.
- Recovery codes contain 80 random bits and only keyed HMAC-SHA-256 values are stored.
- Six-digit codes use a 30-second period and a one-step clock window.
- The last accepted counter is updated atomically, preventing reuse of the same TOTP value.
- Recovery code consumption is atomic and one-time.
- Challenges expire after five minutes, are single-use, allow at most eight failed attempts, and are bound to the password version and selected server-owned authority.
- Enrollment and completion responses use `Cache-Control: no-store`; enrollment material and recovery codes are never written to audit logs.
- Auth rate limiting also covers enrollment and completion endpoints.

## Operations

Generate a 32-byte base64url key in the deployment secret manager. The JSON value supports overlapping keys during rotation; new writes use the active key while reads can decrypt older factors. Do not reuse the session, material-snapshot, payment, or email keys in staging or production.

Loss of every authenticator and recovery code is an account-recovery event. The current release deliberately provides no self-service factor reset. A reviewed, dual-control staff recovery workflow must be added before operational recovery is accepted.

## Remaining staging evidence

- distinct school, Ops, and Admin accounts enroll and sign in through the deployed HTTPS origin;
- TOTP replay, expired challenge, wrong workspace, revoked membership/grant, and eight failed attempts are refused;
- one recovery code succeeds once and fails on replay;
- Admin step-up requires password plus MFA and expires after ten minutes;
- key rotation can still decrypt an old factor while new enrollment uses the new key;
- audit and application logs contain no TOTP secret, raw recovery code, password, or challenge token.
