import { randomUUID } from "node:crypto";
import { CuacError, toErrorEnvelope } from "../shared/errors.ts";
import { AuthCredentialsService } from "./credentials.ts";
import { hashAuthRateLimitSubjectValue, type AuthRateLimiter } from "./rate-limit.ts";
import { parseCookieHeader, SESSION_COOKIE_NAME } from "./session.ts";
import { clearGuestSessionCookie } from "./guest-session.ts";
import { authRateLimitEmail, readAuthBody } from "./input.ts";

export type AuthCredentialsHttpOptions = {
  secureCookies?: boolean;
  rateLimiter?: AuthRateLimiter;
};

export function createAuthCredentialsHttpHandlers(service: Pick<AuthCredentialsService, keyof AuthCredentialsService>, options: AuthCredentialsHttpOptions = {}) {
  return {
    async registerStudent(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();

      try {
        const body = await readAuthBody(request, ["email", "password", "displayName"]);
        await options.rateLimiter?.assertAllowed({
          action: "auth.register",
          subject: {
            email: authRateLimitEmail(body.email),
            ipHash: hashRequestIp(request),
            route: "/api/v1/auth/register",
          },
        });
        const result = await service.registerStudent({
          email: body.email,
          password: body.password,
          displayName: body.displayName,
          userAgent: request.headers.get("user-agent"),
          ip: resolveRequestIp(request),
        }, requestId);

        return authResponse(result, requestId, 201, options);
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof CuacError ? error.status : 500 });
      }
    },

    async createSession(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();

      try {
        const body = await readAuthBody(request, ["email", "password", "selectedSurface", "schoolId"]);
        await options.rateLimiter?.assertAllowed({
          action: "auth.login",
          subject: {
            email: authRateLimitEmail(body.email),
            ipHash: hashRequestIp(request),
            route: "/api/v1/auth/sessions",
          },
        });
        const result = await service.createStudentSession({
          email: body.email,
          password: body.password,
          selectedSurface: body.selectedSurface,
          schoolId: body.schoolId,
          userAgent: request.headers.get("user-agent"),
          ip: resolveRequestIp(request),
        }, requestId);

        return authResponse(result, requestId, 200, options);
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof CuacError ? error.status : 500 });
      }
    },

    async logout(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();

      try {
        await readAuthBody(request, []);
        const cookies = parseCookieHeader(request.headers.get("cookie"));
        await options.rateLimiter?.assertAllowed({
          action: "auth.logout",
          subject: {
            ipHash: hashRequestIp(request) ?? (cookies[SESSION_COOKIE_NAME] ? hashAuthRateLimitSubjectValue(cookies[SESSION_COOKIE_NAME]) : null),
            route: "/api/v1/auth/logout",
          },
        });
        const result = await service.revokeSession(cookies[SESSION_COOKIE_NAME], requestId);

        const response = Response.json(
          { data: { revoked: result.revoked } },
          {
            status: 200,
            headers: {
              "set-cookie": clearSessionCookie(options),
              "x-request-id": requestId,
            },
          },
        );
        response.headers.append("set-cookie", clearGuestSessionCookie(options.secureCookies ?? false));
        return response;
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof CuacError ? error.status : 500 });
      }
    },

    async stepUpSession(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();
      try {
        const body = await readAuthBody(request, ["password"]);
        const cookies = parseCookieHeader(request.headers.get("cookie"));
        const sessionToken = cookies[SESSION_COOKIE_NAME];
        await options.rateLimiter?.assertAllowed({
          action: "auth.step_up",
          subject: {
            sessionTokenHash: sessionToken ? hashAuthRateLimitSubjectValue(sessionToken) : null,
            ipHash: hashRequestIp(request),
            route: "/api/v1/auth/step-up",
          },
        });
        const result = await service.stepUpSession({ sessionToken, password: body.password }, requestId);
        return Response.json({ data: {
          userId: result.userId,
          sessionId: result.sessionId,
          authStrength: "step_up",
          stepUpExpiresAt: result.stepUpExpiresAt.toISOString(),
        } }, { status: 200, headers: { "x-request-id": requestId } });
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), { status: error instanceof CuacError ? error.status : 500 });
      }
    },
  };
}

function authResponse(
  result: { userId: string; sessionId: string; sessionToken: string; expiresAt: Date;
    selectedSurface: string; activeRole: string; tenantSchoolId: string | null },
  requestId: string,
  status: number,
  options: AuthCredentialsHttpOptions,
) {
  return Response.json(
    {
      data: {
        userId: result.userId,
        sessionId: result.sessionId,
        activeRole: result.activeRole,
        selectedSurface: result.selectedSurface,
        tenantSchoolId: result.tenantSchoolId,
        expiresAt: result.expiresAt.toISOString(),
      },
    },
    {
      status,
      headers: {
        "set-cookie": serializeSessionCookie(result.sessionToken, result.expiresAt, options),
        "x-request-id": requestId,
      },
    },
  );
}

function serializeSessionCookie(sessionToken: string, expiresAt: Date, options: AuthCredentialsHttpOptions): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${maxAge}`,
  ];

  if (options.secureCookies) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearSessionCookie(options: AuthCredentialsHttpOptions): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];

  if (options.secureCookies) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function resolveRequestIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
}

function hashRequestIp(request: Request): string | null {
  const ip = resolveRequestIp(request);
  return ip ? hashAuthRateLimitSubjectValue(ip) : null;
}
