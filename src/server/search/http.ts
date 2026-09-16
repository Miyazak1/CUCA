import { createHash } from "node:crypto";
import { toErrorEnvelope } from "../shared/errors.ts";
import { createRequestContext } from "../shared/request-context.ts";
import { type SiteSearchService, type SiteSearchType } from "./service.ts";

export function createSiteSearchHttpHandler(service: SiteSearchService) {
  return async function search(request: Request): Promise<Response> {
    const context = createRequestContext({ requestId: request.headers.get("x-request-id") ?? undefined });
    const startedAt = performance.now();
    try {
      const url = new URL(request.url);
      const result = await service.search(context, {
        query: url.searchParams.get("q") ?? "",
        types: parseTypes(url.searchParams.get("types") ?? url.searchParams.get("type")),
        limit: parseLimit(url.searchParams.get("limit")),
        cursor: url.searchParams.get("cursor") ?? undefined,
        locale: url.searchParams.get("locale") ?? preferredLocale(request.headers.get("accept-language")),
      });
      const body = {
        data: result,
        meta: { requestId: context.requestId, tookMs: Math.max(0, Math.round(performance.now() - startedAt)) },
      };
      const etag = `W/"${createHash("sha256").update(JSON.stringify(result)).digest("base64url").slice(0, 24)}"`;
      if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: successHeaders(etag, result.locale, result.catalogRevision) });
      return jsonResponse(body, 200, successHeaders(etag, result.locale, result.catalogRevision));
    } catch (error) {
      return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
    }
  };
}

function preferredLocale(acceptLanguage: string | null): string {
  return acceptLanguage?.trim().toLocaleLowerCase().startsWith("zh") ? "zh" : "en";
}

function parseTypes(value: string | null): SiteSearchType[] | undefined {
  if (value == null || value.trim() === "") return undefined;
  return value.split(",").map(item => item.trim()).filter(Boolean) as SiteSearchType[];
}

function parseLimit(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

function successHeaders(etag: string, locale: "en" | "zh", catalogRevision: string): Record<string, string> {
  return {
    "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
    "content-language": locale === "zh" ? "zh-CN" : "en",
    "etag": etag,
    "surrogate-key": `cuac-public-catalog catalog-revision-${catalogRevision}`,
    "vary": "accept-language",
    "x-cuac-catalog-revision": catalogRevision,
  };
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status >= 400 ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
      ...extraHeaders,
    },
  });
}
