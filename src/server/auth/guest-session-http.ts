import { badRequest } from "../shared/errors.ts";
import { isDeployedEnvironment, type RuntimeEnv } from "../shared/http-config.ts";
import { parseCookieHeader } from "./session.ts";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookie, issueGuestSession, verifyGuestSession } from "./guest-session.ts";
import { readAuthBody } from "./input.ts";

export async function initializeGuestSession(request: Request, env: RuntimeEnv = process.env): Promise<Response> {
  const body = await readAuthBody(request, ["rotate"]);
  if (body.rotate !== undefined && typeof body.rotate !== "boolean") throw badRequest("rotate must be a boolean.");
  const prior = parseCookieHeader(request.headers.get("cookie"))[GUEST_SESSION_COOKIE_NAME];
  if (!body.rotate && verifyGuestSession(prior, new Date(), env)) return Response.json({ data: { status: "ready" } });
  const { token } = issueGuestSession(new Date(), env);
  return Response.json({ data: { status: "ready" } }, { headers: {
    "set-cookie": guestSessionCookie(token, isDeployedEnvironment(env) || new URL(request.url).protocol === "https:"),
  } });
}
