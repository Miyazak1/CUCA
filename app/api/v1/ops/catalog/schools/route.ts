import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getCatalogAdminRouteHandlers().listSchools(request);
});

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getCatalogAdminRouteHandlers().createSchool(request);
});
