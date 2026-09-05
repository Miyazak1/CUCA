export const APPLICATION_FEE_ENTITLEMENT_STATUSES = ["active", "revoked"] as const;
export type ApplicationFeeEntitlementStatus = (typeof APPLICATION_FEE_ENTITLEMENT_STATUSES)[number];

export type ApplicationFeeEntitlementEvidence = {
  id: string;
  userId: string;
  applicationSetId: string;
  applicationChoiceId: string;
  schoolId: string;
  programId: string;
  programIntakeId: string;
  admissionRouteKey: string;
  status: ApplicationFeeEntitlementStatus;
  grantedAt: Date;
  expiresAt: Date | null;
  evidenceCurrent: boolean;
};

export type ApplicationFeeEntitlementDto = {
  id: string;
  status: ApplicationFeeEntitlementStatus;
  grantedAt: string;
  expiresAt: string | null;
  current: boolean;
};

export type GrantApplicationFeeEntitlementsInput = {
  paymentId: string;
  paymentStatusEventId: string;
  expiresAt?: Date | null;
};
