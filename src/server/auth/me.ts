import type { RequestContext } from "../shared/request-context.ts";
import { normalizeUiLocale, type PublicUiLocale, type SupportedUiLocale } from "../i18n/locales.ts";

export type CurrentActorDto = {
  requestId: string;
  actorUserId: string | null;
  guestSessionId: string | null;
  selectedSurface: string;
  activeRole: string;
  tenantSchoolId: string | null;
  authStrength: string;
  dataClassAllowlist: readonly string[];
  accountEmail: string | null;
  accountEmailVerified: boolean | null;
  accountLocale: SupportedUiLocale | null;
};

export type CurrentAccountRecord = {
  email: string;
  emailVerified: boolean;
  locale?: string;
};

export type CurrentAccountRepository = {
  findCurrentAccountByUserId(userId: string): Promise<CurrentAccountRecord | null>;
  updateCurrentAccountLocale?(input: {
    userId: string; locale: PublicUiLocale; requestId: string; now: Date;
  }): Promise<{ locale: PublicUiLocale; changed: boolean } | null>;
};

export function toCurrentActorDto(context: RequestContext, account: CurrentAccountRecord | null = null): CurrentActorDto {
  return {
    requestId: context.requestId,
    actorUserId: context.actorUserId,
    guestSessionId: context.guestSessionId,
    selectedSurface: context.selectedSurface,
    activeRole: context.activeRole,
    tenantSchoolId: context.tenantSchoolId,
    authStrength: context.authStrength,
    dataClassAllowlist: context.dataClassAllowlist,
    accountEmail: context.actorUserId ? account?.email ?? null : null,
    accountEmailVerified: context.actorUserId ? account?.emailVerified ?? null : null,
    accountLocale: context.actorUserId ? normalizeUiLocale(account?.locale) : null,
  };
}
