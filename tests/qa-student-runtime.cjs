const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const runtimePath = path.join(projectRoot, ".cuac-local", "runtime.json");
if (!fs.existsSync(runtimePath)) throw new Error("Local CUAC runtime is not configured. Run npm run local:up first.");
const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
const origin = `http://127.0.0.1:${runtime.applicationPort}`;
let completedSteps = 0;
let sessionCookie = "";

async function request(route, init = {}) {
  const headers = new Headers(init.headers || {});
  if (sessionCookie) headers.set("cookie", sessionCookie);
  const response = await fetch(`${origin}${route}`, { ...init, headers, signal: AbortSignal.timeout(10_000) });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

async function step(label, fn) {
  process.stdout.write(`- ${label}... `);
  await fn();
  completedSteps += 1;
  process.stdout.write("ok\n");
}

const records = (value) => Array.isArray(value) ? value : [];

async function main() {
  console.log(`CUAC student runtime QA starting at ${origin}.`);

  await step("local server and database are healthy", async () => {
    const { response, body } = await request("/api/v1/health");
    if (!response.ok || body?.status !== "ok" || body?.database?.reachable !== true) throw new Error("Local health check failed.");
  });

  await step("student session authenticates against the real local server", async () => {
    const { response, body } = await request("/api/v1/auth/sessions", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email: runtime.studentEmail, password: runtime.studentPassword }),
    });
    sessionCookie = response.headers.get("set-cookie")?.split(";", 1)[0] || "";
    if (!response.ok || body?.data?.activeRole !== "student" || !sessionCookie) throw new Error("Student login was not accepted.");
  });

  let applicationSets = [];
  await step("student account exposes the configured application set and a completed school handoff", async () => {
    const { response, body } = await request("/api/v1/student/application-sets");
    applicationSets = records(body?.data);
    if (!response.ok || !applicationSets.some((set) => set.id === runtime.applicationSetId)
      || !applicationSets.some((set) => set.status !== "draft")) {
      throw new Error("The student application-set lifecycle fixture is incomplete.");
    }
  });

  await step("every configured choice resolves its exact published program and intake", async () => {
    const configuredSet = applicationSets.find((set) => set.id === runtime.applicationSetId);
    const choices = records(configuredSet?.choices);
    if (choices.length !== runtime.choiceIds.length) throw new Error(`Expected ${runtime.choiceIds.length} configured choices, received ${choices.length}.`);
    for (const choice of choices) {
      const [programResult, intakeResult] = await Promise.all([
        request(`/api/v1/catalog/programs/${encodeURIComponent(choice.programId)}`),
        request(`/api/v1/catalog/programs/${encodeURIComponent(choice.programId)}/intakes?limit=100`),
      ]);
      if (!programResult.response.ok || programResult.body?.data?.id !== choice.programId) throw new Error(`Program ${choice.programId} is not available through its exact detail route.`);
      if (!intakeResult.response.ok || !records(intakeResult.body?.data).some((intake) => intake.id === choice.programIntakeId)) {
        throw new Error(`Intake ${choice.programIntakeId} is not available for program ${choice.programId}.`);
      }
    }
  });

  await step("completed handoff exposes one bounded school progress record per choice", async () => {
    const submitted = applicationSets.find((set) => set.status !== "draft");
    const choices = records(submitted?.choices);
    const { response, body } = await request(`/api/v1/student/application-sets/${encodeURIComponent(submitted.id)}/school-progress`);
    const progress = records(body?.data?.items);
    if (!response.ok || body?.data?.applicationSetId !== submitted.id || progress.length !== choices.length
      || progress.some((item) => !item.applicationChoiceId || !item.schoolId || !item.status
        || Object.hasOwn(item, "schoolVisibleProfile") || Object.hasOwn(item, "contactLogs"))) {
      throw new Error("School progress did not preserve the bounded student projection.");
    }
  });

  await step("served student pages preserve application identity and API-backed routes", async () => {
    const [applicationHtml, applicationJs, hubJs, notificationsHtml] = await Promise.all([
      request("/application.html"),
      request("/application.js?v=20260914-student-flow-fix"),
      request("/hub-runtime.js"),
      request("/notifications.html"),
    ]);
    if (![applicationHtml, applicationJs, hubJs, notificationsHtml].every((result) => result.response.ok)) throw new Error("A student runtime asset could not be served.");
    if (!applicationHtml.body.includes("data-application-set-switcher")
      || !applicationJs.body.includes("ensureProgramDetail(programId)")
      || !applicationJs.body.includes("data-submission-status-link")
      || !hubJs.body.includes("applicationSet=${encodeURIComponent(set.id)}")
      || !notificationsHtml.body.includes("preferences-api.html#notification-preferences")
      || notificationsHtml.body.includes('href="preferences.html#notifications"')) {
      throw new Error("The served student workspace lost an identity-preserving or API-backed route contract.");
    }
  });

  await step("catalog first page responds without waiting for full hydration", async () => {
    const started = Date.now();
    const { response, body } = await request("/api/v1/catalog/programs?limit=100");
    const elapsedMs = Date.now() - started;
    if (!response.ok || records(body?.data).length === 0) throw new Error("The first catalog page did not load.");
    if (elapsedMs > 3_000) throw new Error(`The first catalog page took ${elapsedMs}ms.`);
    const programsJs = await request("/programs.js?v=20260914-server-pagination-2");
    if (!programsJs.response.ok
      || !programsJs.body.includes("offset: (state.page - 1) * state.pageSize")
      || !programsJs.body.includes("limit: state.pageSize")) {
      throw new Error("The served program catalog is not using bounded server-side pagination.");
    }
    process.stdout.write(`(${elapsedMs}ms) `);
  });

  await request("/api/v1/auth/logout", { method: "POST", headers: { "content-type": "application/json", origin }, body: "{}" });
  if (completedSteps === 0) throw new Error("Student runtime QA completed without executing any steps.");
  console.log(`CUAC student runtime QA passed (${completedSteps} steps).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
