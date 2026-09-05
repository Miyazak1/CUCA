import { initializeGuestSession } from "@/src/server/auth/guest-session-http.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const POST = secureApiRoute("POST", async (request: Request) => initializeGuestSession(request));
