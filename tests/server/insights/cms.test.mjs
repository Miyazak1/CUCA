import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parseInsightDocument, insightDigest } from "../../../src/server/insights/insight-document.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { evaluatePolicy } from "../../../src/server/policy/policy.ts";

const document = () => ({
  schemaVersion: 1, slug: "current-admissions-briefing", title: "Current admissions briefing",
  description: "A dated, source-linked briefing for international applicants.", category: "admissions-updates",
  tags: ["2026 intake"], author: "UCAC Editorial", readingMinutes: 5, featured: false,
  sections: [{ id: "overview", heading: "What changed", paragraphs: ["The official notice now includes a current application date."], bullets: ["Recheck before submission"] }],
  sources: [{ url: "https://example.edu/admissions", label: "Official admissions notice", checkedAt: "2026-10-12T00:00:00.000Z" }],
  relatedGuides: [{ href: "/guides/application-documents", label: "Application documents" }],
});

const context = (overrides = {}) => createRequestContext({ actorUserId: randomUUID(), activeRole: "cuac_admin", selectedSurface: "ops",
  purpose: "catalog_management", authStrength: "step_up", ...overrides });

test("Insight documents are bounded, source-linked structured content", () => {
  const parsed = parseInsightDocument(document());
  assert.equal(parsed.slug, "current-admissions-briefing");
  assert.match(insightDigest(parsed), /^[a-f0-9]{64}$/);
  for (const mutate of [
    value => { value.title = "<script>"; }, value => { value.sources = []; }, value => { value.sources[0].url = "http://example.edu"; },
    value => { value.sections[0].id = "Bad id"; }, value => { value.relatedGuides[0].href = "https://other.test"; }, value => { value.extra = true; },
  ]) {
    const candidate = structuredClone(document()); mutate(candidate);
    assert.throws(() => parseInsightDocument(candidate), error => error.status === 400);
  }
});

test("Insight drafting permits Ops staff while publishing and withdrawal require step-up admin", () => {
  const resource = { type: "catalog", dataClasses: ["internal_catalog_metadata"] };
  for (const role of ["guest", "student", "school_staff", "cuac_ops", "cuac_admin"]) {
    const c = context({ activeRole: role });
    for (const action of ["catalog.read_insights_review", "catalog.prepare_insights", "catalog.publish_insights", "catalog.withdraw_insights"]) {
      const expected = role === "cuac_admin" || (role === "cuac_ops" && ["catalog.read_insights_review", "catalog.prepare_insights"].includes(action));
      assert.equal(evaluatePolicy(c, action, resource).allowed, expected, `${role}: ${action}`);
    }
  }
  assert.equal(evaluatePolicy(context({ authStrength: "session" }), "catalog.publish_insights", resource).allowed, false);
  assert.equal(evaluatePolicy(context({ selectedSurface: "student" }), "catalog.prepare_insights", resource).allowed, false);
});
