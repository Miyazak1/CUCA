import { randomUUID } from "node:crypto";
import { serviceUnavailable, toErrorEnvelope } from "../../shared/errors.ts";

export function isAgentRuntimeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.CUAC_AGENT_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "" || value === "false" || value === "disabled") return false;
  if (value === "true" || value === "enabled") return true;
  throw serviceUnavailable("Agent runtime configuration is invalid.");
}

export function agentRuntimeUnavailableResponse(request: Request): Response {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  return Response.json(toErrorEnvelope(serviceUnavailable("Agent runtime is disabled."), requestId), { status: 503 });
}
