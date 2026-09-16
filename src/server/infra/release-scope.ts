export const RELEASE_SCOPE_FULL_PLATFORM = "full-platform" as const;
export const RELEASE_SCOPE_SCHOOL_HANDOFF_V1 = "school-handoff-v1" as const;

export type ReleaseScope =
  | typeof RELEASE_SCOPE_FULL_PLATFORM
  | typeof RELEASE_SCOPE_SCHOOL_HANDOFF_V1;

export function resolveReleaseScope(value: string | undefined): ReleaseScope | "unknown" {
  if (value === undefined) return RELEASE_SCOPE_FULL_PLATFORM;
  const normalized = value.trim().toLowerCase();
  if (normalized === RELEASE_SCOPE_FULL_PLATFORM || normalized === RELEASE_SCOPE_SCHOOL_HANDOFF_V1) {
    return normalized;
  }
  return "unknown";
}

export function includesDeferredApplicationCapabilities(scope: ReleaseScope | "unknown"): boolean {
  return scope === RELEASE_SCOPE_FULL_PLATFORM;
}
