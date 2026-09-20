import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { AuthCredentialsService, type AuthCredentialsRepository } from "../credentials.ts";
import { createAuthCredentialsHttpHandlers } from "../credentials-http.ts";
import { PostgresAuthSessionRepository } from "../postgres-repository.ts";
import { createAuthRateLimiterFromEnv } from "./rate-limit.ts";
import type { PasswordHasher } from "../password-hasher.ts";
import { mfaKeyringFromEnv, type MfaKeyring } from "../mfa-crypto.ts";
import { StaffMfaService } from "../staff-mfa.ts";
import { createStaffMfaHttpHandlers } from "../staff-mfa-http.ts";
import { GuardianConsentService } from "../guardian-consent.ts";
import { PostgresGuardianConsentRepository } from "../postgres-guardian-consent.ts";
import { createAuthEmailOutboxCipherFromEnv } from "./email-delivery.ts";
import { createGuardianConsentHttpHandlers } from "../guardian-consent-http.ts";
import type { EmailTokenCipher } from "../email-token-envelope.ts";

const unavailableCredentialsRepository: AuthCredentialsRepository = {
  async findPasswordIdentityByEmailNormalized() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async listAvailableSessionAuthorities() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async createStudentAccount() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async createSession() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async revokeSessionByTokenHash() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async findSessionReauthenticationTarget() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async activateSessionStepUp() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
};

const unavailableStaffMfaService = {
  async startEnrollment(): Promise<never> { throw serviceUnavailable("Staff MFA is not configured."); },
  async completeLogin(): Promise<never> { throw serviceUnavailable("Staff MFA is not configured."); },
};

export function createAuthCredentialsRouteHandlers(
  repository: AuthCredentialsRepository = unavailableCredentialsRepository,
  options: { rateLimiter?: ReturnType<typeof createAuthRateLimiterFromEnv> } = {},
) {
  return createAuthCredentialsHttpHandlers(new AuthCredentialsService(repository), {
    secureCookies: process.env.NODE_ENV === "production",
    rateLimiter: options.rateLimiter,
  });
}

export function createStaffMfaRouteHandlers() {
  return createStaffMfaHttpHandlers(unavailableStaffMfaService, { secureCookies: process.env.NODE_ENV === "production" });
}

export function getAuthCredentialsRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    const cipher = createAuthEmailOutboxCipherFromEnv();
    const guardianConsent = cipher ? createPostgresGuardianConsentService(client, cipher) : undefined;
    return createAuthCredentialsHttpHandlers(createPostgresAuthCredentialsService(client), {
      secureCookies: process.env.NODE_ENV === "production",
      rateLimiter: createAuthRateLimiterFromEnv({ client }),
      guardianConsent,
    });
  } catch {
    return createAuthCredentialsRouteHandlers();
  }
}

export function getGuardianConsentRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const cipher = createAuthEmailOutboxCipherFromEnv();
    if (!cipher) return createGuardianConsentHttpHandlers();
    return createGuardianConsentHttpHandlers(createPostgresGuardianConsentService(client, cipher), {
      rateLimiter: createAuthRateLimiterFromEnv({ client }),
    });
  } catch { return createGuardianConsentHttpHandlers(); }
}

export function getStaffMfaRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createStaffMfaHttpHandlers(createPostgresStaffMfaService(client, mfaKeyringFromEnv()), {
      secureCookies: process.env.NODE_ENV === "production",
      rateLimiter: createAuthRateLimiterFromEnv({ client }),
    });
  } catch {
    return createStaffMfaRouteHandlers();
  }
}

export function createPostgresAuthCredentialsService(client: TransactionalSqlClient, options: { passwordHasher?: PasswordHasher; mfaKeyring?: MfaKeyring } = {}) {
  let keyring = options.mfaKeyring ?? null;
  if (!keyring) {
    try { keyring = mfaKeyringFromEnv(); } catch { keyring = null; }
  }
  const create = (tx: TransactionalSqlClient) => {
    const repository = new PostgresAuthSessionRepository(tx);
    const auditSink = new PostgresAuditWriter(tx);
    return new AuthCredentialsService(repository, {
      auditSink,
      passwordHasher: options.passwordHasher,
      ...(keyring ? { staffMfa: new StaffMfaService(repository, keyring, { auditSink }) } : {}),
    });
  };
  return {
    registerStudent: transactionalMethod(client, create, "registerStudent"),
    createStudentSession: transactionalMethod(client, create, "createStudentSession"),
    stepUpSession: transactionalMethod(client, create, "stepUpSession"),
    revokeSession: transactionalMethod(client, create, "revokeSession"),
  };
}


export function createPostgresStaffMfaService(client: TransactionalSqlClient, keyring: MfaKeyring) {
  const create = (tx: TransactionalSqlClient) => {
    const repository = new PostgresAuthSessionRepository(tx);
    return new StaffMfaService(repository, keyring, { auditSink: new PostgresAuditWriter(tx) });
  };
  return {
    startEnrollment: transactionalMethod(client, create, "startEnrollment"),
    completeLogin: transactionalMethod(client, create, "completeLogin"),
  };
}

export function createPostgresGuardianConsentService(client: TransactionalSqlClient, cipher: EmailTokenCipher) {
  const create = (tx: TransactionalSqlClient) => new GuardianConsentService(new PostgresGuardianConsentRepository(tx, cipher));
  return {
    request: transactionalMethod(client, create, "request"),
    accept: transactionalMethod(client, create, "accept"),
    decline: transactionalMethod(client, create, "decline"),
  };
}
