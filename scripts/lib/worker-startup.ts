import { authorizeStagingCandidateStart, assertSafeApplicationProcessEnvironment } from "../../src/server/infra/startup-policy.ts";
import { loadReleaseGateReport } from "./release-gate.ts";

type ReleaseGateLoader = typeof loadReleaseGateReport;

export type WorkerStartupAuthorization = {
  mode: "development" | "staging_candidate" | "reviewed";
};

export async function authorizeWorkerStartup(
  args: readonly string[],
  env: Record<string, string | undefined> = process.env,
  loadGate: ReleaseGateLoader = loadReleaseGateReport,
): Promise<WorkerStartupAuthorization> {
  assertSafeApplicationProcessEnvironment(env);
  const environment = (env.CUAC_ENV ?? env.DEPLOY_ENV ?? "").trim().toLowerCase();

  if (["development", "dev", "test"].includes(environment)) {
    if (args.length !== 0) throw new Error("Development worker startup does not accept a release manifest.");
    return { mode: "development" };
  }

  if (environment === "staging" || environment === "stage") {
    if (args.length !== 0) throw new Error("Staging candidate worker startup does not accept a completed manifest.");
    authorizeStagingCandidateStart({ ...env, CUAC_ENV: "staging" });
    return { mode: "staging_candidate" };
  }

  if (environment === "production" || environment === "prod") {
    if (args.length !== 1 || !args[0]) throw new Error("Production worker startup requires one protected staging evidence manifest.");
    const report = await loadGate(args[0], { ...env, CUAC_ENV: "production" });
    if (!report.readyForHumanReview) throw new Error("Production worker release gate has blockers.");
    return { mode: "reviewed" };
  }

  throw new Error("Worker startup requires an explicit development, staging, or production environment.");
}
