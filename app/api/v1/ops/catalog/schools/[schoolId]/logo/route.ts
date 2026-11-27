import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { manageSchoolLogo } from "@/src/server/catalog/school-logo-http.ts";
type Context = { params: Promise<{ schoolId: string }> };
const handle = async (request: Request, context: Context) =>
  manageSchoolLogo(request, requireRouteUuid((await context.params).schoolId));
export const GET = secureApiRoute("GET", handle);
export const PUT = secureApiRoute("PUT", handle, { body: "raw" });
export const DELETE = secureApiRoute("DELETE", handle, { body: "empty" });
