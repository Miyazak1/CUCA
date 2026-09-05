type Phase = "running" | "draining" | "closing" | "closed";
type Closer = () => Promise<void>;

export function createApplicationLifecycle() {
  let phase: Phase = "running", requests = 0;
  let closing: Promise<void> | undefined;
  const idleWaiters = new Set<() => void>();
  const resources = new Map<string, Closer>();
  return {
    snapshot: () => ({ phase, activeRequests: requests, resources: [...resources.keys()].sort() }),
    enterRequest() {
      if (phase !== "running") return undefined;
      requests++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        requests--;
        if (requests === 0) { for (const resolve of idleWaiters) resolve(); idleWaiters.clear(); }
      };
    },
    beginDrain() { if (phase === "running") phase = "draining"; },
    waitForRequests() {
      return requests === 0 ? Promise.resolve() : new Promise<void>(resolve => idleWaiters.add(resolve));
    },
    assertResourcesOpen() {
      if (phase === "closing" || phase === "closed") throw new Error("Application resources are shutting down.");
    },
    registerResource(name: string, close: Closer) {
      this.assertResourcesOpen();
      if (!/^[a-z][a-z0-9_.-]{0,47}$/.test(name) || resources.has(name)) throw new Error("Application resource registration conflicts.");
      resources.set(name, close);
      return () => { if (resources.get(name) === close) resources.delete(name); };
    },
    closeResources() {
      if (closing) return closing;
      if (phase !== "draining" || requests !== 0) throw new Error("Drain application requests before closing resources.");
      phase = "closing";
      closing = Promise.allSettled([...resources.values()].map(async close => close())).then(results => {
        resources.clear(); phase = "closed";
        if (results.some(result => result.status === "rejected")) throw new Error("Application resource shutdown failed.");
      });
      return closing;
    },
  };
}

export type ApplicationLifecycle = ReturnType<typeof createApplicationLifecycle>;
const key = Symbol.for("cuac.application-lifecycle.v1");

// The launcher and lazy built API chunks must share state, not separate module-local copies.
export function getApplicationLifecycle(): ApplicationLifecycle {
  const host = globalThis as typeof globalThis & { [key: symbol]: ApplicationLifecycle | undefined };
  if (!host[key]) Object.defineProperty(host, key, { value: createApplicationLifecycle() });
  return host[key]!;
}
