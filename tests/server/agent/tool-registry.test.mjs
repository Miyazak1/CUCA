import assert from "node:assert/strict";
import test from "node:test";
import { CuacError, PUBLIC_AGENT_TOOL_DEFINITIONS, createRequestContext, validateAgentToolInvocation } from "../../../src/server/index.ts";

const catalogSearchTool = {
  toolKey: "catalog.search_programs",
  ownerService: "catalog",
  allowedRoles: ["guest", "student"],
  allowedSurfaces: ["public", "student"],
  requiredDataClasses: ["public_catalog"],
  projectionType: "public_catalog",
  tenantRequired: false,
  memoryWriteAllowed: false,
  vectorIndexAllowed: true,
  auditLevel: "metadata",
};

test("Agent tool registry accepts registered role-safe catalog tool", () => {
  const context = createRequestContext({ purpose: "agent_tool" });

  assert.doesNotThrow(() =>
    validateAgentToolInvocation(context, catalogSearchTool, {
      toolKey: "catalog.search_programs",
      args: { query: "computer science" },
    }),
  );
});

test("Agent tool registry rejects prohibited tools", () => {
  const context = createRequestContext({ activeRole: "cuac_admin", purpose: "agent_tool" });

  assert.throws(
    () =>
      validateAgentToolInvocation(context, undefined, {
        toolKey: "database.run_sql",
        args: { query: "select * from users" },
      }),
    (error) => error instanceof CuacError && error.status === 403,
  );
});

test("Agent tool registry rejects model-supplied authority arguments", () => {
  const context = createRequestContext({ purpose: "agent_tool" });

  assert.throws(
    () =>
      validateAgentToolInvocation(context, catalogSearchTool, {
        toolKey: "catalog.search_programs",
        args: { query: "engineering", userId: "student_2" },
      }),
    (error) => error instanceof CuacError && error.status === 400,
  );
});

test("Agent tool registry rejects school tenant tools without resolved tenant", () => {
  const schoolTool = {
    toolKey: "school.queue_summary",
    ownerService: "school-portal",
    allowedRoles: ["school_staff"],
    allowedSurfaces: ["school"],
    requiredDataClasses: ["tenant_confidential"],
    projectionType: "school_queue_summary",
    tenantRequired: true,
    memoryWriteAllowed: false,
    vectorIndexAllowed: false,
    auditLevel: "metadata",
  };
  const context = createRequestContext({
    activeRole: "school_staff",
    selectedSurface: "school",
    purpose: "agent_tool",
  });

  assert.throws(
    () =>
      validateAgentToolInvocation(context, schoolTool, {
        toolKey: "school.queue_summary",
        args: {},
      }),
    (error) => error instanceof CuacError && error.status === 403,
  );
});

test("public Agent registry is complete, read-only and contains no payment or database tool", () => {
  assert.deepEqual(PUBLIC_AGENT_TOOL_DEFINITIONS.map(definition => definition.toolKey), [
    "catalog.search_programs", "catalog.get_program_detail", "catalog.search_schools",
    "catalog.search_scholarships", "catalog.search_cities", "navigation.open_route",
  ]);
  for (const definition of PUBLIC_AGENT_TOOL_DEFINITIONS) {
    assert.equal(definition.riskLevel, "low");
    assert.equal(definition.mutatesState, false);
    assert.equal(definition.memoryWriteAllowed, false);
    assert.equal(definition.confirmationRequired, false);
    assert.deepEqual(definition.dataClassesReturned, ["public_catalog"]);
    assert.ok(definition.inputSchemaId && definition.outputSchemaId && definition.description);
    assert.ok(definition.rateLimit.maxCalls > 0 && definition.rateLimit.windowSeconds > 0);
    assert.doesNotMatch(definition.toolKey, /payment|database|submit|update|delete|export/);
  }
});

test("Agent registry requires explicit Agent purpose and blocks URL-like authority arguments", () => {
  const definition = PUBLIC_AGENT_TOOL_DEFINITIONS.at(-1);
  assert.throws(() => validateAgentToolInvocation(createRequestContext(), definition, {
    toolKey: "navigation.open_route", args: { routeId: "catalog.programs" },
  }), error => error.status === 403);
  for (const key of ["url", "href", "path", "databaseUrl", "columns", "where"]) {
    assert.throws(() => validateAgentToolInvocation(createRequestContext({ purpose: "agent_tool" }), definition, {
      toolKey: "navigation.open_route", args: { [key]: "attacker" },
    }), error => error.status === 400);
  }
});
