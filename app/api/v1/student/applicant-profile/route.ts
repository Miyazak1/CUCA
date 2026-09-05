import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getStudentRouteHandlers().getApplicantProfile(request);
});

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request) {
  return getStudentRouteHandlers().updateApplicantProfile(request);
});
