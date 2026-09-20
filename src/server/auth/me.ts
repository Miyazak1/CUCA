import type { RequestContext } from "../shared/request-context.ts";

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
};

export type CurrentAccountRecord = {
  email: string;
  emailVerified: boolean;
};

export type CurrentAccountRepository = {
  findCurrentAccountByUserId(userId: string): Promise<CurrentAccountRecord | null>;
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
  };
}
