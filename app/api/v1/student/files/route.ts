import { getStudentFileRouteHandlers } from "@/src/server/files/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getStudentFileRouteHandlers().list(request);
});

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getStudentFileRouteHandlers().createUploadIntent(request);
});
