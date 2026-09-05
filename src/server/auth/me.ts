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
};

export function toCurrentActorDto(context: RequestContext): CurrentActorDto {
  return {
    requestId: context.requestId,
    actorUserId: context.actorUserId,
    guestSessionId: context.guestSessionId,
    selectedSurface: context.selectedSurface,
    activeRole: context.activeRole,
    tenantSchoolId: context.tenantSchoolId,
    authStrength: context.authStrength,
    dataClassAllowlist: context.dataClassAllowlist,
  };
}
