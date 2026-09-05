import { getSchoolCatalogCorrectionRouteHandlers } from "@/src/server/school-catalog-corrections/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getSchoolCatalogCorrectionRouteHandlers().listForSchool(request);
});

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getSchoolCatalogCorrectionRouteHandlers().submit(request);
});
