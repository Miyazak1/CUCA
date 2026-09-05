import { fileURLToPath } from "node:url";
import { isIP } from "node:net";
import { startProdServer } from "../../node_modules/vinext/dist/server/prod-server.js";
import { installHttpLifecycle } from "../../src/server/infra/http-lifecycle.ts";

export function applicationServerOptions(env: Record<string, string | undefined> = process.env) {
  const port = env.PORT ?? "3000", host = env.CUAC_HTTP_HOST ?? "127.0.0.1";
  const deadline = env.CUAC_HTTP_SHUTDOWN_TIMEOUT_MS ?? "30000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !isIP(host)) throw new Error("Invalid application bind configuration.");
  if (!/^\d+$/.test(deadline) || Number(deadline) < 1000 || Number(deadline) > 120_000) throw new Error("Invalid application shutdown deadline.");
  return { port: Number(port), host, timeoutMs: Number(deadline) };
}

export async function startApplicationServer(options: { port: number; host: string } & Parameters<typeof installHttpLifecycle>[1]) {
  const { server, port } = await startProdServer({ port: options.port, host: options.host,
    outDir: fileURLToPath(new URL("../../dist", import.meta.url)), silent: true });
  try {
    return { server, port, ...installHttpLifecycle(server, options) };
  } catch (error) {
    server.close(); server.closeAllConnections();
    throw error;
  }
}
