import { createSqlCatalogClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { createRequestContext } from "../shared/request-context.ts";
import { noticeScope } from "./document.ts";
import { PostgresNoticeReader } from "./public-reader.ts";

type NoticeReader = Pick<PostgresNoticeReader, "getPublished">;
const unavailableReader: NoticeReader = { async getPublished() { throw serviceUnavailable("PostgreSQL notice repository is not configured."); } };

export function createNoticeHttpHandler(reader: NoticeReader = unavailableReader) {
  return async (request: Request, noticeKey: unknown, locale: unknown): Promise<Response> => {
    const context = createRequestContext({ requestId: request.headers.get("x-request-id") ?? undefined, purpose: "public_notice_read" });
    try {
      const scope = noticeScope(noticeKey, locale);
      return Response.json({ data: await reader.getPublished(context, scope.noticeKey, scope.locale) });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, context.requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 });
    }
  };
}

export function getNoticeRouteHandler() {
  try { return createNoticeHttpHandler(new PostgresNoticeReader(createSqlCatalogClient(getSharedPostgresPool()))); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "SERVICE_UNAVAILABLE") return createNoticeHttpHandler();
    throw error;
  }
}
