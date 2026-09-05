import type { DataClass, RequestContext } from "../shared/request-context.ts";

export type PolicyAction =
  | "catalog.read_public"
  | "notice.read_public"
  | "notice.read_review"
  | "notice.prepare"
  | "notice.approve"
  | "notice.publish"
  | "notice.withdraw"
  | "catalog.read_requirements_review"
  | "catalog.prepare_requirements"
  | "catalog.approve_requirements"
  | "catalog.publish_requirements"
  | "catalog.withdraw_requirements"
  | "catalog.read_submission_policy_review"
  | "catalog.prepare_submission_policy"
  | "catalog.approve_submission_policy"
  | "catalog.publish_submission_policy"
  | "catalog.withdraw_submission_policy"
  | "student.read_own"
  | "student.read_application_preflight"
  | "student.preview_application_materials"
  | "student.manage_material_selection"
  | "student.manage_submission_authorization"
  | "student.manage_material_snapshot"
  | "student.manage_private_files"
  | "student.submit_application"
  | "student.write_own"
  | "billing.manage_own"
  | "notification.read_own_scope"
  | "notification.manage_own_scope"
  | "school.read_tenant_projection"
  | "school.manage_tenant_workflow"
  | "school.read_catalog_correction"
  | "school.submit_catalog_correction"
  | "ops.manage_school_invites"
  | "ops.read_application_support"
  | "ops.open_application_support_session"
  | "ops.close_application_support_session"
  | "ops.read_governed_summary"
  | "ops.read_billing_review"
  | "ops.claim_billing_review"
  | "ops.escalate_billing_review"
  | "ops.resolve_billing_review"
  | "ops.read_routing_review"
  | "ops.claim_routing_review"
  | "ops.escalate_routing_review"
  | "ops.close_routing_review"
  | "ops.retry_routing_delivery"
  | "ops.read_data_quality_review"
  | "ops.claim_data_quality_review"
  | "ops.escalate_data_quality_review"
  | "ops.resolve_data_quality_review"
  | "ops.read_catalog_correction"
  | "ops.claim_catalog_correction"
  | "ops.resolve_catalog_correction"
  | "audit.append"
  | "agent.invoke_tool";

export type PolicyResource = {
  type: "catalog" | "notice" | "student" | "billing" | "notification" | "school_application" | "school_tenant" | "school_catalog_correction" | "ops_application_support" | "ops_summary" | "ops_billing_review" | "ops_routing_review" | "ops_data_quality_review" | "audit" | "agent_tool";
  ownerUserId?: string | null;
  tenantSchoolId?: string | null;
  dataClasses?: readonly DataClass[];
};

export type PolicyDecision = {
  id: string;
  allowed: boolean;
  reason: string;
};

export function deny(reason: string): PolicyDecision {
  return {
    id: crypto.randomUUID(),
    allowed: false,
    reason,
  };
}

export function allow(reason: string): PolicyDecision {
  return {
    id: crypto.randomUUID(),
    allowed: true,
    reason,
  };
}

export function evaluatePolicy(context: RequestContext, action: PolicyAction, resource: PolicyResource): PolicyDecision {
  const dataClassDenied = resource.dataClasses?.find((dataClass) => !context.dataClassAllowlist.includes(dataClass));
  if (dataClassDenied) {
    return deny(`Data class is not allowed for this context: ${dataClassDenied}`);
  }

  if (action === "catalog.read_public" && resource.type === "catalog") {
    return allow("Public catalog read is allowed.");
  }

  if (resource.type === "notice" && action === "notice.read_public") {
    return context.purpose === "public_notice_read" ? allow("Public notice projection is allowed.") : deny("Public notice read purpose is required.");
  }

  if (resource.type === "notice" && ["notice.read_review", "notice.prepare", "notice.approve", "notice.publish", "notice.withdraw"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const privileged = ["notice.approve", "notice.publish", "notice.withdraw"].includes(action);
    return context.actorUserId && internal && context.selectedSurface === "ops" && context.purpose === "notice_management"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      && (!privileged || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      ? allow("Explicit notice management context is allowed; live authority must be rechecked.")
      : deny("Notice management authority is required.");
  }

  if (resource.type === "catalog" && ["catalog.read_requirements_review", "catalog.prepare_requirements",
    "catalog.approve_requirements", "catalog.publish_requirements", "catalog.withdraw_requirements"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const privileged = ["catalog.approve_requirements", "catalog.publish_requirements", "catalog.withdraw_requirements"].includes(action);
    return context.actorUserId && internal && (!privileged || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      && context.selectedSurface === "ops" && context.purpose === "catalog_management"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      ? allow("Explicit catalog management context is allowed; live authority must be rechecked.")
      : deny("Catalog management authority is required.");
  }

  if (resource.type === "catalog" && ["catalog.read_submission_policy_review", "catalog.prepare_submission_policy",
    "catalog.approve_submission_policy", "catalog.publish_submission_policy", "catalog.withdraw_submission_policy"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const privileged = ["catalog.approve_submission_policy", "catalog.publish_submission_policy", "catalog.withdraw_submission_policy"].includes(action);
    return context.actorUserId && internal && context.selectedSurface === "ops" && context.purpose === "catalog_management"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      && (!privileged || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      ? allow("Explicit submission-policy management context is allowed; live authority must be rechecked.")
      : deny("Submission-policy management authority is required.");
  }

  if ((action === "student.read_application_preflight" || action === "student.preview_application_materials"
    || action === "student.manage_material_selection" || action === "student.manage_submission_authorization"
    || action === "student.manage_material_snapshot" || action === "student.manage_private_files") && resource.type === "student") {
    return context.actorUserId && context.actorUserId === resource.ownerUserId && context.activeRole === "student"
      && context.selectedSurface === "student" && context.purpose === "student_action" && context.tenantSchoolId === null
      && (context.authStrength === "session" || context.authStrength === "step_up")
      ? allow("Student preparation report is allowed; live ownership must be rechecked.")
      : deny("Student preparation report authority is required.");
  }

  if (action === "student.submit_application" && resource.type === "student") {
    return context.actorUserId && context.actorUserId === resource.ownerUserId && context.activeRole === "student"
      && context.selectedSurface === "student" && context.purpose === "student_action" && context.tenantSchoolId === null
      && context.authStrength === "step_up"
      ? allow("Step-up student submission is allowed; all live evidence must be rechecked atomically.")
      : deny("Step-up student submission authority is required.");
  }

  if ((action === "student.read_own" || action === "student.write_own") && resource.ownerUserId) {
    return context.actorUserId === resource.ownerUserId
      ? allow("Student owns the resource.")
      : deny("Student resource owner mismatch.");
  }

  if (action === "billing.manage_own" && resource.type === "billing" && resource.ownerUserId) {
    return context.activeRole === "student" && context.actorUserId === resource.ownerUserId
      ? allow("Student owns the billing resource.")
      : deny("Billing resource owner mismatch.");
  }

  if (["notification.read_own_scope", "notification.manage_own_scope"].includes(action)
    && resource.type === "notification" && resource.ownerUserId) {
    const authenticated = context.actorUserId === resource.ownerUserId && context.activeRole !== "guest"
      && context.selectedSurface !== "public" && context.purpose === "notification_management"
      && (context.authStrength === "session" || context.authStrength === "step_up");
    const tenantMatches = context.activeRole === "school_staff"
      ? Boolean(context.tenantSchoolId) && context.tenantSchoolId === resource.tenantSchoolId
      : context.tenantSchoolId === null && resource.tenantSchoolId === null;
    return authenticated && tenantMatches
      ? allow("Authenticated actor may access notifications in the current persona scope; live authority is rechecked.")
      : deny("Current notification persona scope is required.");
  }

  if (action === "school.read_tenant_projection" && resource.tenantSchoolId) {
    return context.activeRole === "school_staff" && context.tenantSchoolId === resource.tenantSchoolId
      ? allow("School staff tenant matches resource tenant.")
      : deny("School tenant mismatch.");
  }

  if (action === "school.manage_tenant_workflow" && resource.type === "school_application" && resource.tenantSchoolId) {
    return context.actorUserId && context.activeRole === "school_staff"
      && context.tenantSchoolId === resource.tenantSchoolId && context.selectedSurface === "school"
      && context.purpose === "school_review" && (context.authStrength === "session" || context.authStrength === "step_up")
      ? allow("School staff may manage a received application in the verified tenant; live membership must be rechecked.")
      : deny("Verified school workflow authority is required.");
  }

  if (resource.type === "school_catalog_correction" && resource.tenantSchoolId
    && ["school.read_catalog_correction", "school.submit_catalog_correction"].includes(action)) {
    return context.actorUserId && context.activeRole === "school_staff" && context.selectedSurface === "school"
      && context.tenantSchoolId === resource.tenantSchoolId && context.purpose === "school_catalog_correction"
      && (context.authStrength === "session" || context.authStrength === "step_up")
      ? allow("School staff may use the correction workflow for the verified tenant; live membership and catalog generation must be rechecked.")
      : deny("Verified school catalog correction authority is required.");
  }

  if (resource.type === "school_catalog_correction" && !resource.tenantSchoolId
    && ["ops.read_catalog_correction", "ops.claim_catalog_correction", "ops.resolve_catalog_correction"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const resolving = action === "ops.resolve_catalog_correction";
    return context.actorUserId && internal && context.selectedSurface === "ops"
      && context.purpose === "catalog_correction_review" && context.tenantSchoolId === null
      && (context.authStrength === "session" || context.authStrength === "step_up")
      && (!resolving || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      ? allow("CUAC staff may review catalog corrections; resolution requires step-up administrator authority and live grant revalidation.")
      : deny("Catalog correction review authority is required.");
  }

  if (action === "ops.read_governed_summary" && resource.type === "ops_summary") {
    return context.actorUserId && (context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin")
      && context.selectedSurface === "ops" && context.purpose === "ops_monitoring"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      ? allow("CUAC internal staff may read the fixed operations summary; live grant must be rechecked.")
      : deny("Verified CUAC operations monitoring authority is required.");
  }

  if (resource.type === "ops_billing_review" && ["ops.read_billing_review", "ops.claim_billing_review",
    "ops.escalate_billing_review", "ops.resolve_billing_review"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const resolving = action === "ops.resolve_billing_review";
    return context.actorUserId && internal && context.selectedSurface === "ops" && context.purpose === "billing_review"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      && (!resolving || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      ? allow("Explicit billing review authority is allowed; live grant and workflow state must be rechecked.")
      : deny("Billing review authority is required.");
  }

  if (resource.type === "ops_routing_review" && ["ops.read_routing_review", "ops.claim_routing_review",
    "ops.escalate_routing_review", "ops.close_routing_review", "ops.retry_routing_delivery"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const resolving = action === "ops.close_routing_review" || action === "ops.retry_routing_delivery";
    return context.actorUserId && internal && context.selectedSurface === "ops" && context.purpose === "routing_review"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      && (!resolving || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      ? allow("Explicit routing review authority is allowed; live grant and delivery state must be rechecked.")
      : deny("Routing review authority is required.");
  }

  if (resource.type === "ops_data_quality_review" && ["ops.read_data_quality_review", "ops.claim_data_quality_review",
    "ops.escalate_data_quality_review", "ops.resolve_data_quality_review"].includes(action)) {
    const internal = context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin";
    const resolving = action === "ops.resolve_data_quality_review";
    return context.actorUserId && internal && context.selectedSurface === "ops" && context.purpose === "data_quality_review"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      && (!resolving || (context.activeRole === "cuac_admin" && context.authStrength === "step_up"))
      ? allow("Explicit catalog data-quality review authority is allowed; live grant and source generation must be rechecked.")
      : deny("Catalog data-quality review authority is required.");
  }

  if (["ops.read_application_support", "ops.open_application_support_session", "ops.close_application_support_session"].includes(action)
    && resource.type === "ops_application_support") {
    return context.actorUserId && (context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin")
      && context.selectedSurface === "ops" && context.purpose === "ops_support"
      && context.tenantSchoolId === null && (context.authStrength === "session" || context.authStrength === "step_up")
      ? allow("CUAC internal support may read the minimal application support projection; live grant must be rechecked.")
      : deny("Verified CUAC application support authority is required.");
  }

  if (action === "ops.manage_school_invites" && resource.type === "school_tenant") {
    return context.activeRole === "cuac_ops" || context.activeRole === "cuac_admin"
      ? allow("CUAC internal role can manage school invites.")
      : deny("CUAC internal role required.");
  }

  if (action === "audit.append") {
    return context.authStrength === "guest" ? deny("Authenticated context required for audit append.") : allow("Audit append is allowed.");
  }

  if (action === "agent.invoke_tool") {
    return context.purpose === "agent_tool" ? allow("Agent tool invocation reached policy layer.") : deny("Agent tool purpose required.");
  }

  return deny("No explicit allow rule matched.");
}
