import { randomUUID } from "node:crypto";
import { CuacError, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { readAuthBody } from "./input.ts";
import type { GuardianConsentService } from "./guardian-consent.ts";
import { hashAuthRateLimitSubjectValue, type AuthRateLimiter } from "./rate-limit.ts";

const unavailable = {
  async accept(): Promise<never> { throw serviceUnavailable("Guardian consent is not configured."); },
  async decline(): Promise<never> { throw serviceUnavailable("Guardian consent is not configured."); },
};

export function createGuardianConsentHttpHandlers(service: Pick<GuardianConsentService, "accept" | "decline"> = unavailable,
  options: { rateLimiter?: AuthRateLimiter } = {}) {
  async function execute(request: Request, action: "accept" | "decline") {
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
    try {
      const body = await readAuthBody(request, ["requestId", "token"]);
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
      await options.rateLimiter?.assertAllowed({ action: `auth.guardian_consent.${action}`,
        subject: { ipHash: ip ? hashAuthRateLimitSubjectValue(ip) : null, route: `/api/v1/auth/guardian-consent/${action}` } });
      const result = await service[action]({ requestId: body.requestId, token: body.token });
      return Response.json({ data: action === "accept" ? { activated: true, ...result } : result },
        { status: 200, headers: { "x-request-id": requestId } });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof CuacError ? error.status : 500 });
    }
  }
  return {
    accept: (request: Request) => execute(request, "accept"),
    decline: (request: Request) => execute(request, "decline"),
  };
}
