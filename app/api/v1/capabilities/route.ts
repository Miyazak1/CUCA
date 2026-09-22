import { resolveReleaseCapabilities } from "@/src/server/infra/release-capabilities.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET() {
  return Response.json(resolveReleaseCapabilities());
});
