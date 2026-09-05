import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getStudentRouteHandlers().getAssessmentHistory(request);
});
export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getStudentRouteHandlers().addAssessmentRecord(request);
});
