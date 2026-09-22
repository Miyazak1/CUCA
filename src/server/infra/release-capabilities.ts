import { serviceUnavailable } from "../shared/errors.ts";
import {
  RELEASE_SCOPE_FULL_PLATFORM,
  RELEASE_SCOPE_SCHOOL_HANDOFF_V1,
  type ReleaseScope,
} from "./release-scope.ts";

export const RELEASE_CAPABILITIES_VERSION = "cuac.release-capabilities.v1" as const;

export type ReleaseCapability =
  | "publicCatalog"
  | "siteSearch"
  | "studentAccounts"
  | "savedItems"
  | "applicationPlanning"
  | "schoolHandoff"
  | "agent"
  | "payment"
  | "studentFiles"
  | "officialMaterialSubmission";

export type ReleaseCapabilities = {
  version: typeof RELEASE_CAPABILITIES_VERSION;
  releaseScope: ReleaseScope;
  enabled: Readonly<Record<ReleaseCapability, boolean>>;
};

const schoolHandoffCapabilities: ReleaseCapabilities = Object.freeze({
  version: RELEASE_CAPABILITIES_VERSION,
  releaseScope: RELEASE_SCOPE_SCHOOL_HANDOFF_V1,
  enabled: Object.freeze({
    publicCatalog: true,
    siteSearch: true,
    studentAccounts: true,
    savedItems: true,
    applicationPlanning: true,
    schoolHandoff: true,
    agent: false,
    payment: false,
    studentFiles: false,
    officialMaterialSubmission: false,
  }),
});

const fullPlatformCapabilities: ReleaseCapabilities = Object.freeze({
  version: RELEASE_CAPABILITIES_VERSION,
  releaseScope: RELEASE_SCOPE_FULL_PLATFORM,
  enabled: Object.freeze({
    publicCatalog: true,
    siteSearch: true,
    studentAccounts: true,
    savedItems: true,
    applicationPlanning: true,
    schoolHandoff: true,
    agent: true,
    payment: true,
    studentFiles: true,
    officialMaterialSubmission: true,
  }),
});

/**
 * Resolve the release contract without ever enabling deferred capabilities by
 * omission. Local/test processes use the current school-handoff release; a
 * deployed process must state its scope explicitly.
 */
export function resolveReleaseCapabilities(
  env: Record<string, string | undefined> = process.env,
): ReleaseCapabilities {
  const rawScope = env.CUAC_RELEASE_SCOPE?.trim().toLowerCase();
  if (rawScope === RELEASE_SCOPE_SCHOOL_HANDOFF_V1) return schoolHandoffCapabilities;
  if (rawScope === RELEASE_SCOPE_FULL_PLATFORM) return fullPlatformCapabilities;

  const environment = env.CUAC_ENV?.trim().toLowerCase();
  if (!rawScope && (environment === undefined || environment === "development" || environment === "test")) {
    return schoolHandoffCapabilities;
  }

  throw serviceUnavailable("CUAC_RELEASE_SCOPE must name a supported release scope.");
}

export function requireReleaseCapability(
  capability: ReleaseCapability,
  env: Record<string, string | undefined> = process.env,
): ReleaseCapabilities {
  const manifest = resolveReleaseCapabilities(env);
  if (!manifest.enabled[capability]) {
    throw serviceUnavailable(`Capability ${capability} is not available in release scope ${manifest.releaseScope}.`, {
      capability,
      releaseScope: manifest.releaseScope,
    });
  }
  return manifest;
}

