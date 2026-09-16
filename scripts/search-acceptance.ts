import { readFile } from "node:fs/promises";

type AcceptanceCase = { query: string; type: string; locale: "en" | "zh"; interpretedQuery?: string };
type SearchPayload = {
  data?: { query?: string; locale?: string; interpretedQuery?: string | null; groups?: Array<{
    type?: string; total?: number; nextCursor?: string | null; items?: Array<{ id?: string; displayTitle?: string }>;
  }> };
  meta?: { tookMs?: number };
};

const baseUrl = new URL(process.env.CUAC_SEARCH_ACCEPTANCE_URL ?? await localAcceptanceUrl());
const thresholdMs = positiveInteger(process.env.CUAC_SEARCH_ACCEPTANCE_P95_MS, 500);
const iterations = positiveInteger(process.env.CUAC_SEARCH_ACCEPTANCE_ITERATIONS, 3);
const concurrency = positiveInteger(process.env.CUAC_SEARCH_ACCEPTANCE_CONCURRENCY, 4);
const fixture = JSON.parse(await readFile(new URL("../tests/fixtures/site-search-acceptance.json", import.meta.url), "utf8")) as {
  version: number; cases: AcceptanceCase[];
};
if (fixture.version !== 1 || !Array.isArray(fixture.cases) || fixture.cases.length < 4) fail("Search acceptance fixture is invalid.");

await request(fixture.cases[0], 2); // Warm the runtime and PostgreSQL pool; excluded from measurements.
const durations: number[] = [];
let firstEtag: string | null = null;
const jobs = Array.from({ length: iterations }, (_, iteration) => fixture.cases.map((item, caseIndex) => ({ item, iteration, caseIndex }))).flat();
await runConcurrent(jobs, concurrency, async ({ item, iteration, caseIndex }) => {
    const result = await request(item, 2);
    durations.push(result.durationMs);
    if (iteration === 0 && caseIndex === 0) firstEtag = result.response.headers.get("etag");
});

if (!firstEtag) fail("Search response did not provide an ETag.");
const conditional = await request(fixture.cases[0], 2, { "if-none-match": firstEtag }, 304);
if (conditional.response.status !== 304) fail("Search conditional request did not return 304.");

const firstPage = await request(fixture.cases[0], 2);
const firstGroup = firstPage.payload.data?.groups?.[0];
if (firstGroup?.nextCursor) {
  const secondPage = await request(fixture.cases[0], 2, {}, 200, firstGroup.nextCursor);
  const firstIds = new Set((firstGroup.items ?? []).map(item => item.id));
  const overlap = (secondPage.payload.data?.groups?.[0]?.items ?? []).filter(item => firstIds.has(item.id)).length;
  if (overlap > 0) fail("Search cursor returned duplicate records across adjacent pages.");
}

const sorted = [...durations].sort((a, b) => a - b);
const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
const report = { baseUrl: baseUrl.origin, cases: fixture.cases.length, requests: durations.length, concurrency, p95Ms: p95, thresholdMs,
  minMs: sorted[0] ?? 0, maxMs: sorted.at(-1) ?? 0, conditionalStatus: conditional.response.status };
console.log(JSON.stringify(report, null, 2));
if (p95 > thresholdMs) fail(`Search acceptance P95 ${p95} ms exceeds ${thresholdMs} ms.`);

async function request(item: AcceptanceCase, limit: number, headers: Record<string, string> = {}, expectedStatus = 200, cursor?: string) {
  const url = new URL("api/v1/search", baseUrl);
  url.searchParams.set("q", item.query);
  url.searchParams.set("type", item.type);
  url.searchParams.set("locale", item.locale);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  const startedAt = performance.now();
  const response = await fetch(url, { headers: { accept: "application/json", ...headers } });
  const durationMs = Math.round(performance.now() - startedAt);
  if (response.status !== expectedStatus) fail(`Search acceptance received HTTP ${response.status}; expected ${expectedStatus}.`);
  const payload = response.status === 304 ? {} as SearchPayload : await response.json() as SearchPayload;
  if (expectedStatus === 200) {
    const group = payload.data?.groups?.[0];
    if (payload.data?.locale !== item.locale || group?.type !== item.type || !group.total || !group.items?.length) {
      fail(`Search acceptance returned no usable ${item.type} results.`);
    }
    if (item.interpretedQuery && payload.data?.interpretedQuery !== item.interpretedQuery) fail("Search alias interpretation regressed.");
    if (!group.items.every(result => typeof result.displayTitle === "string" && result.displayTitle.length > 0)) {
      fail("Search locale projection is missing display titles.");
    }
    if (!/^\d+$/.test(response.headers.get("x-cuac-catalog-revision") ?? "")
      || !response.headers.get("surrogate-key")?.includes("cuac-public-catalog")) {
      fail("Search catalog revision cache headers are missing.");
    }
  }
  return { response, payload, durationMs };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) fail("Search acceptance numeric configuration is invalid.");
  return parsed;
}

async function localAcceptanceUrl(): Promise<string> {
  try {
    const state = JSON.parse(await readFile(new URL("../.cuac-local/runtime.json", import.meta.url), "utf8")) as { applicationPort?: unknown };
    if (Number.isSafeInteger(state.applicationPort) && Number(state.applicationPort) >= 1024 && Number(state.applicationPort) <= 65535) {
      return `http://127.0.0.1:${state.applicationPort}/`;
    }
  } catch {
    // The explicit environment override remains the production/staging acceptance path.
  }
  return "http://127.0.0.1:52118/";
}

async function runConcurrent<T>(items: T[], workerCount: number, worker: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }));
}

function fail(message: string): never {
  throw new Error(message);
}
