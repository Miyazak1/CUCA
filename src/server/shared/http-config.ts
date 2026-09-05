import { serviceUnavailable } from "./errors.ts";

export type RuntimeEnv = Record<string, string | undefined>;

export function isDeployedEnvironment(env: RuntimeEnv = process.env): boolean {
  return !["development", "dev", "test"].includes((env.CUAC_ENV ?? env.NODE_ENV ?? "development").toLowerCase());
}

export function publicApiOrigin(env: RuntimeEnv = process.env, requestUrl?: string): string {
  const configured = env.CUAC_PUBLIC_APP_URL;
  try {
    const url = new URL(configured ?? requestUrl ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password
      || (configured && (url.search || url.hash || url.pathname !== "/"))
      || (!configured && (isDeployedEnvironment(env) || !local))
      || (url.protocol !== "https:" && !(url.protocol === "http:" && local && !isDeployedEnvironment(env)))) {
      throw new Error("Invalid public origin.");
    }
    return url.origin;
  } catch {
    throw serviceUnavailable("Configure a valid public application origin before accepting browser writes.");
  }
}
