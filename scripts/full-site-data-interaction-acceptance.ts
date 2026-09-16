import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_STATE_RELATIVE_PATH, assertLocalDevelopmentState, localSyntheticAccounts } from "./lib/local-development.ts";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const state = JSON.parse(await readFile(resolve(projectDir, LOCAL_STATE_RELATIVE_PATH), "utf8")) as unknown;
assertLocalDevelopmentState(state);
const accounts = localSyntheticAccounts(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const results: Array<{ area: string; status: "passed"; evidence: string }> = [];

type Json = Record<string, unknown>;
type Session = { cookie: string; role: string };

function record(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function records(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(record) : [];
}

async function request(path: string, init: RequestInit = {}, session?: Session) {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (session) headers.set("cookie", session.cookie);
  const response = await fetch(`${origin}${path}`, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function login(account: { email: string; password: string }, expectedRole: string, schoolId?: string): Promise<Session> {
  const result = await request("/api/v1/auth/sessions", {
    method: "POST", headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: account.email, password: account.password,
      ...(expectedRole === "student" ? {} : { selectedSurface: expectedRole === "school_staff" ? "school_staff" : "cuac_internal" }),
      ...(schoolId ? { schoolId } : {}) }),
  });
  const cookie = result.response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  assert(result.response.ok && record(record(result.body).data).activeRole === expectedRole && cookie, `${expectedRole} login failed.`);
  return { cookie, role: expectedRole };
}

async function expectDenied(path: string, session?: Session) {
  const result = await request(path, {}, session);
  assert([401, 403].includes(result.response.status), `${session?.role ?? "anonymous"} unexpectedly accessed ${path} (${result.response.status}).`);
}

async function checkPublicProjection(listPath: string, detailBase: string, identity: "id" | "slug", label: string) {
  const list = await request(`${listPath}${listPath.includes("?") ? "&" : "?"}limit=5`);
  const items = records(record(list.body).data);
  assert(list.response.ok && items.length > 0, `${label} list returned no usable records.`);
  const key = items[0][identity];
  assert(typeof key === "string" && key.length > 0, `${label} list omitted ${identity}.`);
  const detail = await request(`${detailBase}/${encodeURIComponent(key)}`);
  const item = record(record(detail.body).data);
  assert(detail.response.ok && item[identity] === key, `${label} list/detail identity diverged.`);
  results.push({ area: `public-${label}`, status: "passed", evidence: `${items.length} sampled; ${identity} stable` });
  return items[0];
}

const health = await request("/api/v1/health");
assert(health.response.ok && record(health.body).status === "ok" && record(record(health.body).database).reachable === true,
  "Local application or PostgreSQL is unhealthy.");
results.push({ area: "runtime", status: "passed", evidence: "application and PostgreSQL healthy" });

const surfaces = ["/home-v3.html", "/programs.html", "/universities.html", "/scholarships.html", "/cities.html",
  "/guides.html", "/search.html", "/auth.html", "/hub-api.html", "/application.html", "/school-portal.html", "/ops-admin-api.html"];
const deliveredSurfaces = await Promise.all(surfaces.map(path => request(path)));
assert(deliveredSurfaces.every(result => result.response.ok && typeof result.body === "string" && /<!doctype html>/i.test(result.body)),
  "One or more released site surfaces could not be served as HTML.");
results.push({ area: "surface-delivery", status: "passed", evidence: `${surfaces.length} public and role workspaces served` });

const program = await checkPublicProjection("/api/v1/catalog/programs", "/api/v1/catalog/programs", "id", "programs");
await checkPublicProjection("/api/v1/catalog/schools", "/api/v1/catalog/schools", "id", "schools");
await checkPublicProjection("/api/v1/catalog/scholarships", "/api/v1/catalog/scholarships", "id", "scholarships");
await checkPublicProjection("/api/v1/catalog/cities", "/api/v1/catalog/cities", "slug", "cities");
await checkPublicProjection("/api/v1/catalog/guides", "/api/v1/catalog/guides", "slug", "guides");

const search = await request(`/api/v1/search?q=${encodeURIComponent(String(program.nameEn ?? program.nameZh ?? "engineering"))}&type=program&locale=en&limit=5`);
const searchData = record(record(search.body).data), groups = records(searchData.groups), searchItems = records(groups[0]?.items);
assert(search.response.ok && groups[0]?.type === "program" && searchItems.some(item => item.id === program.id),
  "Search did not project the sampled published program.");
const etag = search.response.headers.get("etag");
assert(etag, "Search response omitted ETag.");
const conditional = await request(`/api/v1/search?q=${encodeURIComponent(String(program.nameEn ?? program.nameZh ?? "engineering"))}&type=program&locale=en&limit=5`,
  { headers: { "if-none-match": etag } });
assert(conditional.response.status === 304, "Search conditional revalidation did not return 304.");
results.push({ area: "search", status: "passed", evidence: "published projection and ETag revalidation agree" });

await Promise.all([
  expectDenied("/api/v1/student/application-sets"),
  expectDenied("/api/v1/school/applications"),
  expectDenied("/api/v1/ops/operations/summary"),
]);
results.push({ area: "anonymous-boundary", status: "passed", evidence: "student, school and Ops data denied" });

const localSchools = await request("/api/v1/catalog/schools?limit=10&query=local%20north");
const localSchool = records(record(localSchools.body).data).find(item => item.slug === "local-north-university");
assert(localSchools.response.ok && typeof localSchool?.id === "string", "Local synthetic school is unavailable for tenant login.");

const student = await login(accounts.student, "student");
const school = await login(accounts.school, "school_staff", String(localSchool.id));
const ops = await login(accounts.ops, "cuac_ops");
const admin = await login(accounts.admin, "cuac_admin");

await Promise.all([
  expectDenied("/api/v1/school/applications", student), expectDenied("/api/v1/ops/operations/summary", student),
  expectDenied("/api/v1/student/application-sets", school), expectDenied("/api/v1/ops/operations/summary", school),
  expectDenied("/api/v1/student/application-sets", ops), expectDenied("/api/v1/school/applications", ops),
]);
results.push({ area: "cross-role-boundary", status: "passed", evidence: "student, school and Ops scopes remain isolated" });

const studentSets = await request("/api/v1/student/application-sets", {}, student);
const sets = records(record(studentSets.body).data), configuredSet = sets.find(item => item.id === state.applicationSetId);
assert(studentSets.response.ok && configuredSet, "Configured student application set is unavailable.");
const choices = records(configuredSet.choices);
assert(choices.length === state.choiceIds.length, "Student application choice count diverged from the local fixture.");
for (const choice of choices) {
  const detail = await request(`/api/v1/catalog/programs/${encodeURIComponent(String(choice.programId))}`);
  assert(detail.response.ok && record(record(detail.body).data).id === choice.programId, "Student choice points to an unavailable public program.");
}
const progress = await request(`/api/v1/student/application-sets/${encodeURIComponent(state.applicationSetId)}/school-progress`, {}, student);
assert(progress.response.ok && records(record(record(progress.body).data).items).length === choices.length,
  "Student school-progress projection does not match application choices.");
results.push({ area: "student-projection", status: "passed", evidence: `${choices.length} choices resolve to catalog and school progress` });

const schoolQueue = await request("/api/v1/school/applications", {}, school);
const schoolItems = records(record(schoolQueue.body).data);
assert(schoolQueue.response.ok && schoolItems.length > 0, "School queue returned no applications.");
const schoolDetail = await request(`/api/v1/school/applications/${encodeURIComponent(String(schoolItems[0].id))}`, {}, school);
assert(schoolDetail.response.ok && record(record(schoolDetail.body).data).id === schoolItems[0].id,
  "School queue/detail identity diverged.");
results.push({ area: "school-projection", status: "passed", evidence: `${schoolItems.length} queue records; detail identity stable` });

const [opsSummary, governedGuides, adminGuides] = await Promise.all([
  request("/api/v1/ops/operations/summary", {}, ops), request("/api/v1/ops/catalog/guides", {}, ops),
  request("/api/v1/ops/catalog/guides", {}, admin),
]);
const opsGuides = records(record(governedGuides.body).data), adminGuideItems = records(record(adminGuides.body).data);
assert(opsSummary.response.ok && governedGuides.response.ok && adminGuides.response.ok
  && opsGuides.length >= 5 && adminGuideItems.length === opsGuides.length, "Ops/Admin governed catalog projections diverged.");
results.push({ area: "internal-projection", status: "passed", evidence: `${opsGuides.length} governed guides visible consistently` });

const malformed = await request("/api/v1/catalog/programs/not-a-uuid");
const invalidSearch = await request("/api/v1/search?q=test&type=private&locale=en");
assert(malformed.response.status === 400 && invalidSearch.response.status === 400,
  "Malformed public identifiers or unsupported search scopes did not fail closed.");
results.push({ area: "error-boundary", status: "passed", evidence: "malformed identity and private search scope rejected" });

console.log(JSON.stringify({ status: "passed", origin, checks: results.length, results }, null, 2));
