export type ErrorCode =
  | "BAD_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "REQUEST_TIMEOUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class CuacError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "CuacError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function forbidden(message = "The current actor is not allowed to perform this action."): CuacError {
  return new CuacError("FORBIDDEN", message, 403);
}

export function badRequest(message: string, details?: unknown): CuacError {
  return new CuacError("BAD_REQUEST", message, 400, details);
}

export function serviceUnavailable(message: string, details?: unknown): CuacError {
  return new CuacError("SERVICE_UNAVAILABLE", message, 503, details);
}

export function tooManyRequests(message: string, details?: unknown): CuacError {
  return new CuacError("TOO_MANY_REQUESTS", message, 429, details);
}

export function toErrorEnvelope(error: unknown, requestId: string) {
  if (error instanceof CuacError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        details: error.details,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR" as const,
      message: "An unexpected error occurred.",
      requestId,
    },
  };
}
