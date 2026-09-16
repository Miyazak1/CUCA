import { randomUUID } from "node:crypto";
import { CuacError, forbidden, toErrorEnvelope } from "../shared/errors.ts";
import { authResponse, type AuthCredentialsHttpOptions } from "./credentials-http.ts";
import { readAuthBody } from "./input.ts";
import type { StaffMfaService } from "./staff-mfa.ts";
import { hashAuthRateLimitSubjectValue } from "./rate-limit.ts";

export function createStaffMfaHttpHandlers(
  service: Pick<StaffMfaService, "startEnrollment" | "completeLogin">,
  options: AuthCredentialsHttpOptions = {},
) {
  return {
    async startEnrollment(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();
      try {
        const body = await readAuthBody(request, ["challengeToken"]);
        await options.rateLimiter?.assertAllowed({
          action: "auth.mfa_enrollment",
          subject: {
            sessionTokenHash: typeof body.challengeToken === "string" ? hashAuthRateLimitSubjectValue(body.challengeToken) : null,
            route: "/api/v1/auth/mfa/enrollment",
          },
        });
        const result = await service.startEnrollment({ challengeToken: body.challengeToken });
        return Response.json({ data: { ...result, expiresAt: result.expiresAt.toISOString() } }, {
          status: 201,
          headers: { "cache-control": "no-store", "x-request-id": requestId },
        });
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), {
          status: error instanceof CuacError ? error.status : 500,
          headers: { "cache-control": "no-store", "x-request-id": requestId },
        });
      }
    },

    async completeLogin(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();
      try {
        const body = await readAuthBody(request, ["challengeToken", "code", "recoveryCode"]);
        await options.rateLimiter?.assertAllowed({
          action: "auth.mfa_complete",
          subject: {
            sessionTokenHash: typeof body.challengeToken === "string" ? hashAuthRateLimitSubjectValue(body.challengeToken) : null,
            route: "/api/v1/auth/mfa/complete",
          },
        });
        const result = await service.completeLogin(body, requestId);
        if ("mfaVerificationFailed" in result) throw forbidden("MFA verification failed.");
        const response = authResponse(result, requestId, 200, options);
        response.headers.set("cache-control", "no-store");
        if (result.recoveryCodes) {
          const body = await response.json() as { data: Record<string, unknown> };
          body.data.recoveryCodes = result.recoveryCodes;
          return Response.json(body, { status: 200, headers: response.headers });
        }
        return response;
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), {
          status: error instanceof CuacError ? error.status : 500,
          headers: { "cache-control": "no-store", "x-request-id": requestId },
        });
      }
    },
  };
}
