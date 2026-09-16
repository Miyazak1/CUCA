import type { CatalogSeedBundle } from "./seed-contract.ts";
import {
  LOCAL_POSTGRES_CONTAINER,
  LOCAL_POSTGRES_DATABASE,
  LOCAL_POSTGRES_USER,
  LOCAL_POSTGRES_VOLUME,
  assertLocalDevelopmentState,
  localDatabaseUrl,
  type LocalDevelopmentState,
} from "../../../scripts/lib/local-development.ts";

export const LOCAL_CATALOG_PUBLISH_CONFIRMATION = "publish-reviewed-official-catalog-to-cuac-local";

export function assertLocalCatalogPublishTarget(
  stateValue: unknown,
  bundleValue: unknown,
  confirmation: string | undefined,
  reviewReference: string | undefined,
) {
  if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Local catalog publication requires the exact confirmation token.");
  if (!reviewReference?.trim()) throw new Error("Local catalog publication requires a completed review reference.");
  assertLocalDevelopmentState(stateValue);
  const state = stateValue as LocalDevelopmentState;
  const bundle = bundleValue as Partial<CatalogSeedBundle>;
  if (bundle?.version !== 2 || !bundle.handoff) throw new Error("Only a version 2 reviewed catalog bundle may be published locally.");
  if (bundle.handoff.reviewReference !== reviewReference || bundle.handoff.prohibitedDataReviewReference !== reviewReference) {
    throw new Error("The command review reference must match both completed handoff reviews.");
  }
  return {
    databaseUrl: localDatabaseUrl(state),
    publicTarget: {
      hostname: "127.0.0.1" as const,
      port: state.postgresPort,
      databaseName: LOCAL_POSTGRES_DATABASE,
      databaseUser: LOCAL_POSTGRES_USER,
      postgresContainer: LOCAL_POSTGRES_CONTAINER,
      postgresVolume: LOCAL_POSTGRES_VOLUME,
    },
  };
}
