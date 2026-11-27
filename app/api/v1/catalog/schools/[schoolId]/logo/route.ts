import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { publicSchoolLogo } from "@/src/server/catalog/school-logo-http.ts";
type Context = { params: Promise<{ schoolId: string }> };
export const GET = secureApiRoute("GET", async (request: Request, context: Context) =>
  publicSchoolLogo(request, requireRouteUuid((await context.params).schoolId)));
