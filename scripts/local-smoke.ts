import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_STATE_RELATIVE_PATH, assertLocalDevelopmentState, localSyntheticAccounts } from "./lib/local-development.ts";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const state = JSON.parse(await readFile(resolve(projectDir, LOCAL_STATE_RELATIVE_PATH), "utf8")) as unknown;
assertLocalDevelopmentState(state);
const accounts = localSyntheticAccounts(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;

type ApiBody = {
  status?: string;
  database?: { reachable?: boolean };
  data?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function json(path: string, init?: RequestInit) {
  const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });
  const body = await response.json() as ApiBody;
  return { response, body };
}

const health = await json("/api/v1/health");
if (!health.response.ok || health.body.status !== "ok" || health.body.database?.reachable !== true) throw new Error("Local health check failed.");

const programs = await json("/api/v1/catalog/programs?limit=100");
if (!programs.response.ok || !Array.isArray(programs.body.data) || programs.body.data.length < 3) throw new Error("Synthetic catalog API check failed.");

const schools = await json("/api/v1/catalog/schools?limit=10");
const localSchool = Array.isArray(schools.body.data)
  ? schools.body.data.map(record).find(school => school.slug === "local-north-university")
  : undefined;
if (!schools.response.ok || typeof localSchool?.id !== "string") throw new Error("Synthetic school catalog API check failed.");

const login = await json("/api/v1/auth/sessions", {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email: state.studentEmail, password: state.studentPassword }),
});
const cookie = login.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!login.response.ok || record(login.body.data).activeRole !== "student" || !cookie) throw new Error("Synthetic student login check failed.");

const applicantProfile = await json("/api/v1/student/applicant-profile", { headers: { cookie } });
const applicantProfileData = applicantProfile.body.data === null ? null : record(applicantProfile.body.data);
if (!applicantProfile.response.ok || (applicantProfileData !== null
  && (!Number.isSafeInteger(applicantProfileData.revision) || Number(applicantProfileData.revision) < 1
    || !["id", "userId", "revision", "fullName", "contactEmail", "citizenshipCountry"]
      .every(key => Object.hasOwn(applicantProfileData, key))))) {
  throw new Error("Synthetic applicant profile API check failed.");
}
const educationHistory = await json("/api/v1/student/education-records", { headers: { cookie } });
const educationHistoryData = record(educationHistory.body.data);
if (!educationHistory.response.ok || !Number.isSafeInteger(educationHistoryData.revision)
  || !Array.isArray(educationHistoryData.records)) {
  throw new Error("Synthetic education history API check failed.");
}
const assessmentHistory = await json("/api/v1/student/assessment-records", { headers: { cookie } });
const assessmentHistoryData = record(assessmentHistory.body.data);
if (!assessmentHistory.response.ok || !Number.isSafeInteger(assessmentHistoryData.revision)
  || !Array.isArray(assessmentHistoryData.records)) {
  throw new Error("Synthetic assessment history API check failed.");
}

const applications = await json("/api/v1/student/application-sets", { headers: { cookie } });
const fixtureSet = Array.isArray(applications.body.data)
  ? applications.body.data.map(record).find(set => set.id === state.applicationSetId)
  : undefined;
const choices = Array.isArray(fixtureSet?.choices) ? fixtureSet.choices.map(record) : [];
const schoolCounts = new Map<string, number>();
for (const choice of choices) {
  if (typeof choice.schoolId === "string") schoolCounts.set(choice.schoolId, (schoolCounts.get(choice.schoolId) ?? 0) + 1);
}
if (!applications.response.ok || !fixtureSet || choices.length !== 3
  || !state.choiceIds.every(id => choices.some(choice => choice.id === id))
  || new Set(choices.map(choice => choice.programId)).size !== 3
  || ![...schoolCounts.values()].includes(2)) {
  throw new Error("Synthetic per-program application API check failed.");
}

const preparationChoice = choices.find(choice => typeof choice.id === "string");
if (!preparationChoice) throw new Error("Synthetic application preparation target check failed.");
const preparationBase = `/api/v1/student/application-sets/${fixtureSet.id}/choices/${preparationChoice.id}`;
const materialSelection = await json(`${preparationBase}/material-selection`, { headers: { cookie } });
const materialSelectionData = record(materialSelection.body.data);
const materialVersions = record(materialSelectionData.currentVersions);
if (!materialSelection.response.ok || materialSelectionData.mode !== "selection_draft"
  || !Number.isSafeInteger(materialSelectionData.revision)
  || !["applicationSet", "applicant", "education", "assessments"].every(key => Number.isSafeInteger(materialVersions[key]))) {
  throw new Error("Synthetic material selection API check failed.");
}
const applicationPreflight = await json(`${preparationBase}/preflight?locale=en`, { headers: { cookie } });
const applicationPreflightData = record(applicationPreflight.body.data);
if (!applicationPreflight.response.ok || applicationPreflightData.applicationSetId !== fixtureSet.id
  || applicationPreflightData.choiceId !== preparationChoice.id
  || !Array.isArray(applicationPreflightData.issues)
  || !Array.isArray(applicationPreflightData.platformBlockers)) {
  throw new Error("Synthetic application preflight API check failed.");
}
const materialAuthorization = await json(`${preparationBase}/submission-authorization`, { headers: { cookie } });
if (!materialAuthorization.response.ok || !("data" in materialAuthorization.body)) {
  throw new Error("Synthetic material authorization API check failed.");
}
const materialSnapshot = await json(`${preparationBase}/material-snapshot`, { headers: { cookie } });
if (!materialSnapshot.response.ok || !("data" in materialSnapshot.body)) {
  throw new Error("Synthetic material snapshot API check failed.");
}
const feePreview = await json("/api/v1/billing/fee-preview", {
  method: "POST",
  headers: { cookie, origin, "content-type": "application/json" },
  body: JSON.stringify({ applicationSetId: fixtureSet.id, applicationChoiceIds: state.choiceIds.toSorted() }),
});
const feePreviewData = record(feePreview.body.data);
if (!feePreview.response.ok || feePreviewData.applicationSetId !== fixtureSet.id
  || feePreviewData.currency !== "CNY" || !Number.isSafeInteger(feePreviewData.totalMinor)
  || Number(feePreviewData.totalMinor) <= 0 || !Array.isArray(feePreviewData.lines)
  || feePreviewData.lines.length !== choices.length) {
  throw new Error(`Synthetic application fee preview check failed: ${feePreview.response.status} ${JSON.stringify(feePreview.body)}`);
}

const notifications = await json("/api/v1/notifications?limit=10", { headers: { cookie } });
const notificationData = record(notifications.body.data);
const notificationItems = Array.isArray(notificationData.items) ? notificationData.items.map(record) : null;
if (!notifications.response.ok || notificationItems === null
  || (notificationData.nextCursor !== null && typeof notificationData.nextCursor !== "string")) {
  throw new Error("Synthetic notification list check failed.");
}
const preferences = await json("/api/v1/notifications/preferences", { headers: { cookie } });
const preferenceItems = Array.isArray(record(preferences.body.data).preferences)
  ? (record(preferences.body.data).preferences as unknown[]).map(record)
  : [];
const securityPreference = preferenceItems.find(item => item.topic === "account_security");
if (!preferences.response.ok || preferenceItems.length !== 6
  || securityPreference?.inAppEnabled !== true || securityPreference?.emailEnabled !== true) {
  throw new Error("Synthetic notification preference check failed.");
}

const savedBefore = await json("/api/v1/student/saved-items", { headers: { cookie } });
const savedBeforeItems = Array.isArray(savedBefore.body.data) ? savedBefore.body.data.map(record) : null;
if (!savedBefore.response.ok || savedBeforeItems === null) throw new Error("Synthetic saved-item list check failed.");
const savedProgramIds = new Set(savedBeforeItems.filter(item => item.entityType === "program").map(item => item.entityId));
const smokeProgram = (programs.body.data as unknown[]).map(record)
  .find(program => typeof program.id === "string" && !savedProgramIds.has(program.id));
if (!smokeProgram || typeof smokeProgram.id !== "string") throw new Error("Synthetic saved-item target check failed.");

let smokeSavedItemId = "";
let savedItemLifecycle = "not-run";
try {
  const createdSavedItem = await json("/api/v1/student/saved-items", {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify({ entityType: "program", entityId: smokeProgram.id, notes: "local smoke create" }),
  });
  const createdSavedItemData = record(createdSavedItem.body.data);
  smokeSavedItemId = typeof createdSavedItemData.id === "string" ? createdSavedItemData.id : "";
  if (!createdSavedItem.response.ok || !smokeSavedItemId || createdSavedItemData.entityId !== smokeProgram.id) {
    throw new Error("Synthetic saved-item create check failed.");
  }

  const savedAfterCreate = await json("/api/v1/student/saved-items", { headers: { cookie } });
  const savedAfterCreateItems = Array.isArray(savedAfterCreate.body.data) ? savedAfterCreate.body.data.map(record) : [];
  const projectedSavedItem = savedAfterCreateItems.find(item => item.id === smokeSavedItemId);
  const projectedCatalogItem = record(projectedSavedItem?.catalogItem);
  if (!savedAfterCreate.response.ok || projectedSavedItem?.notes !== "local smoke create"
    || projectedSavedItem?.entityType !== "program" || projectedSavedItem?.entityId !== smokeProgram.id
    || projectedCatalogItem.id !== smokeProgram.id || projectedCatalogItem.nameEn !== smokeProgram.nameEn
    || typeof projectedCatalogItem.slug !== "string" || typeof projectedCatalogItem.status !== "string"
    || typeof projectedCatalogItem.sourceStatus !== "string") {
    throw new Error("Synthetic saved-item catalog projection check failed.");
  }

  const updatedSavedItem = await json("/api/v1/student/saved-items", {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify({ entityType: "program", entityId: smokeProgram.id, notes: "local smoke update" }),
  });
  const updatedSavedItemData = record(updatedSavedItem.body.data);
  if (!updatedSavedItem.response.ok || updatedSavedItemData.id !== smokeSavedItemId
    || updatedSavedItemData.notes !== "local smoke update") {
    throw new Error("Synthetic saved-item note update check failed.");
  }

  const removedSavedItem = await json(`/api/v1/student/saved-items/${smokeSavedItemId}`, {
    method: "DELETE",
    headers: { cookie, origin },
  });
  const removedSavedItemData = record(removedSavedItem.body.data);
  if (!removedSavedItem.response.ok || removedSavedItemData.id !== smokeSavedItemId
    || removedSavedItemData.entityType !== "program" || removedSavedItemData.entityId !== smokeProgram.id
    || typeof removedSavedItemData.removedAt !== "string") {
    throw new Error("Synthetic saved-item soft-delete check failed.");
  }
  smokeSavedItemId = "";

  const savedAfterRemove = await json("/api/v1/student/saved-items", { headers: { cookie } });
  if (!savedAfterRemove.response.ok || !Array.isArray(savedAfterRemove.body.data)
    || savedAfterRemove.body.data.map(record).some(item => item.id === removedSavedItemData.id)) {
    throw new Error("Synthetic saved-item removal visibility check failed.");
  }
  savedItemLifecycle = "created_projected_updated_removed";
} finally {
  if (smokeSavedItemId) {
    await json(`/api/v1/student/saved-items/${smokeSavedItemId}`, {
      method: "DELETE",
      headers: { cookie, origin },
    }).catch(() => null);
  }
}

const logout = await json("/api/v1/auth/logout", {
  method: "POST",
  headers: { cookie, origin, "content-type": "application/json" },
  body: "{}",
});
if (!logout.response.ok) throw new Error("Synthetic student logout check failed.");

const schoolLogin = await json("/api/v1/auth/sessions", {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email: accounts.school.email, password: accounts.school.password,
    selectedSurface: "school_staff", schoolId: localSchool.id }),
});
const schoolCookie = schoolLogin.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!schoolLogin.response.ok || record(schoolLogin.body.data).activeRole !== "school_staff"
  || record(schoolLogin.body.data).tenantSchoolId !== localSchool.id || !schoolCookie) {
  throw new Error("Synthetic school staff login check failed.");
}
const schoolQueue = await json("/api/v1/school/applications", { headers: { cookie: schoolCookie } });
const queueItems = Array.isArray(schoolQueue.body.data) ? schoolQueue.body.data.map(record) : [];
const firstDraftChoice = choices.find(choice => choice.id === state.choiceIds[0]);
const fixtureApplication = queueItems.find(application => application.schoolId === localSchool.id
  && application.programId === firstDraftChoice?.programId && application.cuacId !== fixtureSet.cuacId);
if (!schoolQueue.response.ok || !fixtureApplication || fixtureApplication.status !== "new"
  || typeof fixtureApplication.id !== "string" || fixtureApplication.schoolRevision !== 1) {
  throw new Error("Synthetic school application queue check failed.");
}
const schoolApplicationDetail = await json(`/api/v1/school/applications/${fixtureApplication.id}`, {
  headers: { cookie: schoolCookie },
});
const schoolApplicationDetailData = record(schoolApplicationDetail.body.data);
if (!schoolApplicationDetail.response.ok || schoolApplicationDetailData.id !== fixtureApplication.id
  || schoolApplicationDetailData.status !== "new"
  || !Array.isArray(schoolApplicationDetailData.statusEvents)
  || !Array.isArray(schoolApplicationDetailData.contactLogs)) {
  throw new Error("Synthetic school application detail check failed.");
}
const correctionEvidenceUrl = `https://local.cuac.invalid/acceptance/catalog-correction-${state.installationId}`;
const correctionCandidateFee = `CNY 999 / local smoke ${state.installationId.slice(0, 8)}`;
const schoolCorrections = await json("/api/v1/school/catalog-corrections", { headers: { cookie: schoolCookie } });
const schoolCorrectionsData = record(schoolCorrections.body.data);
const correctionSchool = record(schoolCorrectionsData.school);
const existingCorrections = Array.isArray(schoolCorrectionsData.items)
  ? schoolCorrectionsData.items.map(record)
  : [];
let catalogCorrection = existingCorrections.find(item => item.evidenceUrl === correctionEvidenceUrl);
if (!schoolCorrections.response.ok || correctionSchool.id !== localSchool.id
  || typeof correctionSchool.updatedAt !== "string" || !Array.isArray(schoolCorrectionsData.items)) {
  throw new Error("Synthetic school catalog correction list check failed.");
}
let catalogCorrectionLifecycle = "verified_existing_rejection";
if (!catalogCorrection) {
  const submittedCorrection = await json("/api/v1/school/catalog-corrections", {
    method: "POST",
    headers: { cookie: schoolCookie, origin, "content-type": "application/json" },
    body: JSON.stringify({
      sourceSchoolUpdatedAt: correctionSchool.updatedAt,
      changes: { applicationFee: correctionCandidateFee },
      evidenceUrl: correctionEvidenceUrl,
      reasonCode: "fee_information_changed",
    }),
  });
  catalogCorrection = record(submittedCorrection.body.data);
  if (!submittedCorrection.response.ok || catalogCorrection.status !== "submitted"
    || catalogCorrection.revision !== 1 || typeof catalogCorrection.id !== "string") {
    throw new Error("Synthetic school catalog correction submission check failed.");
  }
  catalogCorrectionLifecycle = "submitted";
}
if (catalogCorrection.status === "applied") throw new Error("Synthetic catalog correction unexpectedly changed the public school record.");
const opsLogin = await json("/api/v1/auth/sessions", {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email: accounts.ops.email, password: accounts.ops.password,
    selectedSurface: "cuac_internal" }),
});
const opsCookie = opsLogin.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!opsLogin.response.ok || record(opsLogin.body.data).activeRole !== "cuac_ops" || !opsCookie
  || typeof fixtureSet.cuacId !== "string") throw new Error("Synthetic CUAC Ops login check failed.");
if (catalogCorrection.status === "submitted") {
  const claimedCorrection = await json(`/api/v1/ops/catalog-corrections/${catalogCorrection.id}/claim`, {
    method: "POST",
    headers: { cookie: opsCookie, origin, "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 1 }),
  });
  catalogCorrection = record(claimedCorrection.body.data);
  if (!claimedCorrection.response.ok || catalogCorrection.status !== "claimed"
    || catalogCorrection.revision !== 2) throw new Error("Synthetic catalog correction claim check failed.");
  catalogCorrectionLifecycle = "submitted_claimed";
}

const adminLogin = await json("/api/v1/auth/sessions", {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email: accounts.admin.email, password: accounts.admin.password,
    selectedSurface: "cuac_internal" }),
});
const adminCookie = adminLogin.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!adminLogin.response.ok || record(adminLogin.body.data).activeRole !== "cuac_admin" || !adminCookie) {
  throw new Error("Synthetic CUAC Admin login check failed.");
}
const adminStepUp = await json("/api/v1/auth/step-up", {
  method: "POST",
  headers: { cookie: adminCookie, origin, "content-type": "application/json" },
  body: JSON.stringify({ password: accounts.admin.password }),
});
if (!adminStepUp.response.ok || record(adminStepUp.body.data).authStrength !== "step_up"
  || typeof record(adminStepUp.body.data).stepUpExpiresAt !== "string") {
  throw new Error("Synthetic CUAC Admin step-up check failed.");
}
if (catalogCorrection.status === "claimed") {
  const resolvedCorrection = await json(`/api/v1/ops/catalog-corrections/${catalogCorrection.id}/resolution`, {
    method: "POST",
    headers: { cookie: adminCookie, origin, "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 2, code: "rejected_unverifiable",
      reference: `LOCAL:${state.installationId.slice(0, 8)}:CATALOG` }),
  });
  catalogCorrection = record(resolvedCorrection.body.data);
  if (!resolvedCorrection.response.ok || catalogCorrection.status !== "rejected"
    || catalogCorrection.revision !== 3 || catalogCorrection.resolutionCode !== "rejected_unverifiable") {
    throw new Error("Synthetic catalog correction independent resolution check failed.");
  }
  catalogCorrectionLifecycle = "submitted_claimed_admin_rejected";
}
if (catalogCorrection.status !== "rejected" || catalogCorrection.resolutionCode !== "rejected_unverifiable") {
  throw new Error("Synthetic catalog correction final state check failed.");
}
const schoolAfterCorrection = await json(`/api/v1/catalog/schools/${localSchool.id}`);
if (!schoolAfterCorrection.response.ok
  || record(schoolAfterCorrection.body.data).applicationFee === correctionCandidateFee) {
  throw new Error("Rejected synthetic catalog correction changed the public school record.");
}
const operations = await json("/api/v1/ops/operations/summary", { headers: { cookie: opsCookie } });
const operationsData = record(operations.body.data);
const operationsQueues = Array.isArray(operationsData.queues) ? operationsData.queues.map(record) : [];
const expectedQueueKeys = [
  "auth_email_delivery",
  "notification_delivery",
  "student_file_processing",
  "official_submission_delivery",
  "payment_reconciliation",
];
const operationsJson = JSON.stringify(operations.body);
if (!operations.response.ok || operationsData.schemaVersion !== 1
  || operationsData.registryVersion !== "cuac.ops-operations-registry.v1"
  || operationsQueues.length !== expectedQueueKeys.length
  || operationsQueues.some((queue, index) => queue.queueKey !== expectedQueueKeys[index]
    || !["dueCount", "inFlightCount", "expiredLeaseCount", "exceptionsLast24Hours"]
      .every(key => Number.isSafeInteger(queue[key]) && Number(queue[key]) >= 0))
  || /"(?:userId|email|filename|objectKey|paymentId|invoiceId|applicationId|cuacId)"\s*:/.test(operationsJson)
  || operationsJson.includes(fixtureSet.cuacId)
  || Object.values(accounts).some(account => operationsJson.includes(account.email))) {
  throw new Error("Synthetic Ops operations monitoring check failed.");
}
const catalogChoice = choices.find(choice => typeof choice.programId === "string" && typeof choice.programIntakeId === "string");
if (!catalogChoice) throw new Error("Synthetic catalog governance target check failed.");
const requirementVersions = await json(
  `/api/v1/ops/catalog/programs/${catalogChoice.programId}/intakes/${catalogChoice.programIntakeId}/requirements?limit=5`,
  { headers: { cookie: opsCookie } },
);
const requirementVersionsData = record(requirementVersions.body.data);
const requirementVersionItems = Array.isArray(requirementVersionsData.items)
  ? requirementVersionsData.items.map(record)
  : null;
if (!requirementVersions.response.ok || requirementVersionItems === null
  || (requirementVersionsData.nextBeforeVersion !== null && typeof requirementVersionsData.nextBeforeVersion !== "number")
  || !("publication" in requirementVersionsData)) {
  throw new Error("Synthetic Ops catalog requirements governance check failed.");
}
const billingReviews = await json("/api/v1/ops/billing/provider-events?limit=10", {
  headers: { cookie: opsCookie },
});
const billingReviewData = record(billingReviews.body.data);
const billingReviewItems = Array.isArray(billingReviewData.items) ? billingReviewData.items.map(record) : null;
const billingReviewJson = JSON.stringify(billingReviews.body);
if (!billingReviews.response.ok || billingReviewItems === null
  || (billingReviewData.nextCursor !== null && typeof billingReviewData.nextCursor !== "string")
  || /"(?:payloadSha256|providerPaymentId|providerCheckoutSessionId|assignedGrantId|resolvedByGrantId)"\s*:/.test(billingReviewJson)) {
  throw new Error("Synthetic Ops billing review queue check failed.");
}
const routingReviews = await json("/api/v1/ops/routing/submissions?limit=10", {
  headers: { cookie: opsCookie },
});
const routingReviewData = record(routingReviews.body.data);
const routingReviewItems = Array.isArray(routingReviewData.items) ? routingReviewData.items.map(record) : null;
const routingReviewJson = JSON.stringify(routingReviews.body);
if (!routingReviews.response.ok || routingReviewItems === null
  || (routingReviewData.nextCursor !== null && typeof routingReviewData.nextCursor !== "string")
  || /"(?:payloadSha256|providerName|providerReceiptId|studentUserId|cuacId|assignedGrantId|resolvedByGrantId)"\s*:/.test(routingReviewJson)) {
  throw new Error("Synthetic Ops routing review queue check failed.");
}
const dataQualityReviews = await json("/api/v1/ops/data-quality/catalog?limit=50", {
  headers: { cookie: opsCookie },
});
const dataQualityReviewData = record(dataQualityReviews.body.data);
const dataQualityReviewItems = Array.isArray(dataQualityReviewData.items)
  ? dataQualityReviewData.items.map(record) : null;
const dataQualityReviewJson = JSON.stringify(dataQualityReviews.body);
const nextDataQualityCursor = dataQualityReviewData.nextCursor;
if (!dataQualityReviews.response.ok || dataQualityReviewItems === null || dataQualityReviewItems.length < 1
  || (nextDataQualityCursor !== null && (typeof nextDataQualityCursor !== "object"
    || typeof record(nextDataQualityCursor).entityType !== "string"
    || typeof record(nextDataQualityCursor).entityId !== "string"))
  || dataQualityReviewItems.some(item => !["city", "school", "program", "scholarship"].includes(String(item.entityType))
    || typeof item.entityId !== "string" || typeof item.issueCode !== "string")
  || /"(?:evidenceNote|metadataJson|sourceFieldLineageJson|qualityScore|missingFields|assignedGrantId|resolvedByGrantId)"\s*:/.test(dataQualityReviewJson)) {
  throw new Error("Synthetic Ops data-quality review queue check failed.");
}
const opened = await json("/api/v1/ops/support-sessions", {
  method: "POST", headers: { cookie: opsCookie, origin, "content-type": "application/json" },
  body: JSON.stringify({ cuacId: fixtureSet.cuacId, reasonCode: "student_inquiry" }),
});
const supportSessionId = record(opened.body.data).supportSessionId;
if (!opened.response.ok || typeof supportSessionId !== "string") throw new Error("Synthetic Ops support session open check failed.");
const lookup = await json("/api/v1/ops/application-lookups", {
  method: "POST", headers: { cookie: opsCookie, origin, "content-type": "application/json" },
  body: JSON.stringify({ supportSessionId }),
});
if (!lookup.response.ok || record(lookup.body.data).cuacId !== fixtureSet.cuacId) {
  throw new Error("Synthetic Ops application lookup check failed.");
}
const closed = await json(`/api/v1/ops/support-sessions/${supportSessionId}`, {
  method: "DELETE", headers: { cookie: opsCookie, origin },
});
if (!closed.response.ok || record(closed.body.data).closed !== true) throw new Error("Synthetic Ops support session close check failed.");

console.log(JSON.stringify({
  status: "passed",
  origin,
  database: "reachable",
  publicPrograms: programs.body.data.length,
  authenticatedRole: "student",
  applicantProfile: applicantProfileData === null ? "not-created" : `revision-${applicantProfileData.revision}`,
  educationRecords: educationHistoryData.records.length,
  assessmentRecords: assessmentHistoryData.records.length,
  schoolRole: "school_staff",
  schoolQueueApplications: queueItems.length,
  schoolQueueFixtureStatus: fixtureApplication.status,
  opsRole: "cuac_ops",
  adminRole: "cuac_admin",
  adminStepUp: "active",
  catalogCorrectionLifecycle,
  opsOperationsQueues: operationsQueues.length,
  opsOperationsSummary: "read",
  opsRequirementVersions: requirementVersionItems.length,
  opsCatalogGovernance: "read",
  opsBillingReviewEvents: billingReviewItems.length,
  opsBillingReviewQueue: "read",
  opsRoutingReviewDeliveries: routingReviewItems.length,
  opsRoutingReviewQueue: "read",
  opsDataQualityItems: dataQualityReviewItems.length,
  opsDataQualityQueue: "read",
  opsSupportSession: "opened_lookup_closed",
  applicationSetId: state.applicationSetId,
  applicationChoices: choices.length,
  sameSchoolIndependentPrograms: 2,
  materialSelection: `revision-${materialSelectionData.revision}`,
  applicationPreflight: "read",
  materialAuthorization: materialAuthorization.body.data === null ? "not-created" : "read",
  materialSnapshot: materialSnapshot.body.data === null ? "not-created" : "read",
  applicationFeePreview: `${feePreviewData.currency}-${feePreviewData.totalMinor}`,
  notificationItems: notificationItems.length,
  notificationPreferences: preferenceItems.length,
  savedItemLifecycle,
  fixture: "synthetic-local-only",
}, null, 2));
