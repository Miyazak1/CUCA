import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import type { AuthSessionRepository } from "../../auth/session.ts";
import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import type { AuditSink } from "../../audit/audit.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../../db/postgres-client.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { PostgresBillingRepository, type BillingFeeSchedule, type HostedCheckoutProvider } from "../postgres-repository.ts";
import { BillingFacadeService, type BillingRepository } from "../facade.ts";
import { createBillingHttpHandlers } from "../http.ts";
import { createPaymentProviderFromEnv } from "./payment.ts";

const unavailableBillingRepository: BillingRepository = {
  async getApplicationSetOwner() {
    throw serviceUnavailable("Billing repository is not configured.");
  },
  async previewFees() {
    throw serviceUnavailable("Billing repository is not configured.");
  },
  async createCheckoutIntent() {
    throw serviceUnavailable("Billing repository is not configured.");
  },
  async getCheckoutStatus() {
    throw serviceUnavailable("Billing repository is not configured.");
  },
};

const guestOnlyAuthRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

export function createBillingRouteHandlers(
  repository: BillingRepository = unavailableBillingRepository,
  authRepository: AuthSessionRepository = guestOnlyAuthRepository,
  auditSink: AuditSink | null = null,
) {
  return createBillingHttpHandlers(new BillingFacadeService(repository, auditSink), authRepository);
}

export function getBillingRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    const authRepository = new PostgresAuthSessionRepository(client);

    try {
      const feeSchedule = resolveBillingFeeSchedule();
      const provider = createPaymentProviderFromEnv();
      return createBillingHttpHandlers(createPostgresBillingService(client, feeSchedule, provider), authRepository);
    } catch {
      return createBillingRouteHandlers(unavailableBillingRepository, authRepository, new PostgresAuditWriter(client));
    }
  } catch {
    return createBillingRouteHandlers();
  }
}

export function createPostgresBillingService(client: TransactionalSqlClient, feeSchedule: BillingFeeSchedule,
  provider: HostedCheckoutProvider | null) {
  return new BillingFacadeService(
    new PostgresBillingRepository(client, feeSchedule, provider),
    new PostgresAuditWriter(client),
  );
}

export function resolveBillingFeeSchedule(env: Record<string, string | undefined> = process.env): BillingFeeSchedule {
  const applicationFeeMinor = parseRequiredMinorUnit(env.CUAC_APPLICATION_FEE_MINOR, "CUAC_APPLICATION_FEE_MINOR");
  const serviceFeeMinor = parseOptionalMinorUnit(env.CUAC_SERVICE_FEE_MINOR, "CUAC_SERVICE_FEE_MINOR");

  return {
    currency: normalizeCurrency(env.CUAC_BILLING_CURRENCY),
    applicationFeeMinor,
    serviceFeeMinor,
  };
}

function parseRequiredMinorUnit(value: string | undefined, name: string): number {
  if (value === undefined) {
    throw serviceUnavailable(`${name} is not configured.`);
  }

  return parseMinorUnit(value, name);
}

function parseOptionalMinorUnit(value: string | undefined, name: string): number {
  return value === undefined ? 0 : parseMinorUnit(value, name);
}

function parseMinorUnit(value: string, name: string): number {
  const amount = Number(value);

  if (!Number.isInteger(amount) || amount < 0) {
    throw serviceUnavailable(`${name} must be a non-negative integer minor-unit amount.`);
  }

  return amount;
}

function normalizeCurrency(value: string | undefined): string {
  const currency = (value ?? "CNY").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw serviceUnavailable("CUAC_BILLING_CURRENCY must be a three-letter ISO currency code.");
  }

  return currency;
}
