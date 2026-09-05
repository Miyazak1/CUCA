import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, evaluatePolicy } from "../../../src/server/index.ts";

test("policy allows public catalog reads for guests", () => {
  const context = createRequestContext();
  const decision = evaluatePolicy(context, "catalog.read_public", {
    type: "catalog",
    dataClasses: ["public_catalog"],
  });

  assert.equal(decision.allowed, true);
});

test("policy denies by default when no explicit allow rule matches", () => {
  const context = createRequestContext({ activeRole: "student", actorUserId: "user_1" });
  const decision = evaluatePolicy(context, "ops.read_governed_summary", {
    type: "ops_summary",
    dataClasses: ["ops_confidential"],
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /Data class|CUAC internal role/);
});

test("governed operations summary requires an exact internal monitoring context", () => {
  const allowed = createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops",
    selectedSurface: "ops", purpose: "ops_monitoring", authStrength: "session" });
  const resource = { type: "ops_summary", dataClasses: ["ops_confidential", "audit_security"] };
  assert.equal(evaluatePolicy(allowed, "ops.read_governed_summary", resource).allowed, true);
  for (const context of [
    { ...allowed, actorUserId: null },
    { ...allowed, activeRole: "student", selectedSurface: "student" },
    { ...allowed, purpose: "ops_support" },
    { ...allowed, purpose: "agent_tool" },
    { ...allowed, tenantSchoolId: "school-1" },
    { ...allowed, authStrength: "guest" },
    { ...allowed, dataClassAllowlist: ["ops_confidential"] },
  ]) assert.equal(evaluatePolicy(context, "ops.read_governed_summary", resource).allowed, false);
  assert.equal(evaluatePolicy(allowed, "ops.read_governed_summary", { ...resource, type: "audit" }).allowed, false);
});

test("policy allows students to read only their own resources", () => {
  const context = createRequestContext({ activeRole: "student", actorUserId: "student_1" });

  assert.equal(
    evaluatePolicy(context, "student.read_own", {
      type: "student",
      ownerUserId: "student_1",
      dataClasses: ["education_record"],
    }).allowed,
    true,
  );

  assert.equal(
    evaluatePolicy(context, "student.read_own", {
      type: "student",
      ownerUserId: "student_2",
      dataClasses: ["education_record"],
    }).allowed,
    false,
  );
});

test("policy denies cross-tenant school reads", () => {
  const context = createRequestContext({
    activeRole: "school_staff",
    actorUserId: "staff_1",
    selectedSurface: "school",
    tenantSchoolId: "school_a",
  });

  assert.equal(
    evaluatePolicy(context, "school.read_tenant_projection", {
      type: "school_application",
      tenantSchoolId: "school_a",
      dataClasses: ["tenant_confidential"],
    }).allowed,
    true,
  );

  assert.equal(
    evaluatePolicy(context, "school.read_tenant_projection", {
      type: "school_application",
      tenantSchoolId: "school_b",
      dataClasses: ["tenant_confidential"],
    }).allowed,
    false,
  );
});

test("final application submission requires the owning student in a step-up student context", () => {
  const owner = "student_1";
  const resource = { type: "student", ownerUserId: owner,
    dataClasses: ["student_pii", "education_record", "payment_business", "public_catalog", "public_notice"] };
  const allowed = createRequestContext({ actorUserId: owner, activeRole: "student", selectedSurface: "student",
    purpose: "student_action", authStrength: "step_up" });
  assert.equal(evaluatePolicy(allowed, "student.submit_application", resource).allowed, true);
  for (const context of [
    { ...allowed, authStrength: "session" },
    { ...allowed, actorUserId: "student_2" },
    { ...allowed, activeRole: "cuac_admin", selectedSurface: "ops" },
    { ...allowed, tenantSchoolId: "school_1" },
    { ...allowed, dataClassAllowlist: ["education_record"] },
  ]) assert.equal(evaluatePolicy(context, "student.submit_application", resource).allowed, false);
});

test("policy allows only CUAC internal roles to manage school invites", () => {
  const opsContext = createRequestContext({ activeRole: "cuac_ops", actorUserId: "ops_1", selectedSurface: "ops" });
  const studentContext = createRequestContext({ activeRole: "student", actorUserId: "student_1", selectedSurface: "student" });

  assert.equal(
    evaluatePolicy(opsContext, "ops.manage_school_invites", {
      type: "school_tenant",
      tenantSchoolId: "school_a",
      dataClasses: ["ops_confidential"],
    }).allowed,
    true,
  );

  assert.equal(
    evaluatePolicy(studentContext, "ops.manage_school_invites", {
      type: "school_tenant",
      tenantSchoolId: "school_a",
      dataClasses: ["ops_confidential"],
    }).allowed,
    false,
  );
});

test("application support policy requires an exact internal support context", () => {
  const allowed = createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops",
    selectedSurface: "ops", purpose: "ops_support", authStrength: "session" });
  const resource = { type: "ops_application_support", dataClasses: ["ops_confidential", "public_catalog"] };
  for (const action of ["ops.open_application_support_session", "ops.read_application_support", "ops.close_application_support_session"]) {
    assert.equal(evaluatePolicy(allowed, action, resource).allowed, true);
    for (const context of [
      { ...allowed, actorUserId: null },
      { ...allowed, activeRole: "student", selectedSurface: "student" },
      { ...allowed, purpose: "agent_tool" },
      { ...allowed, tenantSchoolId: "school-1" },
      { ...allowed, authStrength: "guest" },
    ]) assert.equal(evaluatePolicy(context, action, resource).allowed, false);
  }
});

test("routing review policy separates investigation from step-up dual-control resolution", () => {
  const investigator = createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops",
    selectedSurface: "ops", purpose: "routing_review", authStrength: "session" });
  const resolver = createRequestContext({ actorUserId: "admin-1", activeRole: "cuac_admin",
    selectedSurface: "ops", purpose: "routing_review", authStrength: "step_up" });
  const resource = { type: "ops_routing_review", dataClasses: ["ops_confidential", "audit_security"] };
  for (const action of ["ops.read_routing_review", "ops.claim_routing_review", "ops.escalate_routing_review"]) {
    assert.equal(evaluatePolicy(investigator, action, resource).allowed, true);
  }
  for (const action of ["ops.close_routing_review", "ops.retry_routing_delivery"]) {
    assert.equal(evaluatePolicy(investigator, action, resource).allowed, false);
    assert.equal(evaluatePolicy({ ...resolver, authStrength: "session" }, action, resource).allowed, false);
    assert.equal(evaluatePolicy(resolver, action, resource).allowed, true);
  }
  assert.equal(evaluatePolicy({ ...resolver, purpose: "agent_tool" },
    "ops.retry_routing_delivery", resource).allowed, false);
  assert.equal(evaluatePolicy(resolver, "ops.retry_routing_delivery",
    { ...resource, type: "agent_tool" }).allowed, false);
});

test("data-quality policy separates investigation from step-up dual-control resolution", () => {
  const investigator = createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops",
    selectedSurface: "ops", purpose: "data_quality_review", authStrength: "session" });
  const resolver = createRequestContext({ actorUserId: "admin-1", activeRole: "cuac_admin",
    selectedSurface: "ops", purpose: "data_quality_review", authStrength: "step_up" });
  const resource = { type: "ops_data_quality_review",
    dataClasses: ["public_catalog", "internal_catalog_metadata", "ops_confidential", "audit_security"] };
  for (const action of ["ops.read_data_quality_review", "ops.claim_data_quality_review",
    "ops.escalate_data_quality_review"]) {
    assert.equal(evaluatePolicy(investigator, action, resource).allowed, true);
  }
  assert.equal(evaluatePolicy(investigator, "ops.resolve_data_quality_review", resource).allowed, false);
  assert.equal(evaluatePolicy({ ...resolver, authStrength: "session" },
    "ops.resolve_data_quality_review", resource).allowed, false);
  assert.equal(evaluatePolicy(resolver, "ops.resolve_data_quality_review", resource).allowed, true);
  assert.equal(evaluatePolicy({ ...resolver, purpose: "agent_tool" },
    "ops.resolve_data_quality_review", resource).allowed, false);
  assert.equal(evaluatePolicy(resolver, "ops.resolve_data_quality_review",
    { ...resource, type: "agent_tool" }).allowed, false);
});

test("catalog correction policy separates school submission from step-up CUAC resolution", () => {
  const school = createRequestContext({ actorUserId: "staff-1", activeRole: "school_staff",
    selectedSurface: "school", tenantSchoolId: "school-1", purpose: "school_catalog_correction",
    authStrength: "session" });
  const schoolResource = { type: "school_catalog_correction", tenantSchoolId: "school-1",
    dataClasses: ["public_catalog", "tenant_confidential"] };
  assert.equal(evaluatePolicy(school, "school.read_catalog_correction", schoolResource).allowed, true);
  assert.equal(evaluatePolicy(school, "school.submit_catalog_correction", schoolResource).allowed, true);
  assert.equal(evaluatePolicy({ ...school, tenantSchoolId: "school-2" },
    "school.submit_catalog_correction", schoolResource).allowed, false);

  const ops = createRequestContext({ actorUserId: "ops-1", activeRole: "cuac_ops", selectedSurface: "ops",
    purpose: "catalog_correction_review", authStrength: "session" });
  const admin = createRequestContext({ actorUserId: "admin-1", activeRole: "cuac_admin", selectedSurface: "ops",
    purpose: "catalog_correction_review", authStrength: "step_up" });
  const opsResource = { type: "school_catalog_correction",
    dataClasses: ["public_catalog", "internal_catalog_metadata", "ops_confidential", "audit_security"] };
  assert.equal(evaluatePolicy(ops, "ops.read_catalog_correction", opsResource).allowed, true);
  assert.equal(evaluatePolicy(ops, "ops.claim_catalog_correction", opsResource).allowed, true);
  assert.equal(evaluatePolicy(ops, "ops.resolve_catalog_correction", opsResource).allowed, false);
  assert.equal(evaluatePolicy({ ...admin, authStrength: "session" },
    "ops.resolve_catalog_correction", opsResource).allowed, false);
  assert.equal(evaluatePolicy(admin, "ops.resolve_catalog_correction", opsResource).allowed, true);
});
