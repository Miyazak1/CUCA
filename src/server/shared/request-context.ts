export type CuacRole = "guest" | "student" | "school_staff" | "cuac_ops" | "cuac_admin";

export type CuacSurface = "public" | "student" | "school" | "ops";

export type DataClass =
  | "public_catalog"
  | "public_notice"
  | "internal_catalog_metadata"
  | "low_sensitive_preference"
  | "student_pii"
  | "education_record"
  | "payment_business"
  | "payment_sensitive"
  | "tenant_confidential"
  | "ops_confidential"
  | "account_notification"
  | "secret"
  | "audit_security";

export type RequestPurpose =
  | "public_catalog_read"
  | "public_notice_read"
  | "notice_management"
  | "student_action"
  | "school_review"
  | "school_catalog_correction"
  | "ops_support"
  | "ops_monitoring"
  | "billing_review"
  | "routing_review"
  | "data_quality_review"
  | "catalog_correction_review"
  | "catalog_management"
  | "audit"
  | "billing"
  | "notification_management"
  | "agent_tool";

export type AuthStrength = "guest" | "session" | "step_up";

export type RequestContext = {
  requestId: string;
  actorUserId: string | null;
  guestSessionId: string | null;
  selectedSurface: CuacSurface;
  activeRole: CuacRole;
  tenantSchoolId: string | null;
  purpose: RequestPurpose;
  authStrength: AuthStrength;
  policyDecisionId: string | null;
  dataClassAllowlist: readonly DataClass[];
};

export type RequestContextInput = Partial<
  Omit<RequestContext, "requestId" | "dataClassAllowlist">
> & {
  requestId?: string;
  dataClassAllowlist?: readonly DataClass[];
};

export function createRequestContext(input: RequestContextInput = {}): RequestContext {
  const activeRole = input.activeRole ?? "guest";

  return {
    requestId: input.requestId ?? crypto.randomUUID(),
    actorUserId: input.actorUserId ?? null,
    guestSessionId: input.guestSessionId ?? null,
    selectedSurface: input.selectedSurface ?? "public",
    activeRole,
    tenantSchoolId: input.tenantSchoolId ?? null,
    purpose: input.purpose ?? "public_catalog_read",
    authStrength: input.authStrength ?? (activeRole === "guest" ? "guest" : "session"),
    policyDecisionId: input.policyDecisionId ?? null,
    dataClassAllowlist: input.dataClassAllowlist ?? defaultDataClassAllowlist(activeRole),
  };
}

export function defaultDataClassAllowlist(role: CuacRole): readonly DataClass[] {
  switch (role) {
    case "guest":
      return ["public_catalog", "public_notice"];
    case "student":
      return ["public_catalog", "public_notice", "low_sensitive_preference", "student_pii", "education_record", "payment_business", "account_notification"];
    case "school_staff":
      return ["public_catalog", "public_notice", "tenant_confidential", "education_record", "account_notification"];
    case "cuac_ops":
    case "cuac_admin":
      return ["public_catalog", "public_notice", "internal_catalog_metadata", "payment_business", "ops_confidential", "account_notification", "audit_security"];
    default:
      return ["public_catalog"];
  }
}

export function hasDataClass(context: RequestContext, dataClass: DataClass): boolean {
  return context.dataClassAllowlist.includes(dataClass);
}
