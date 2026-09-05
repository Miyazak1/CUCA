import { resolveRequestContextFromRequest, type AuthSessionRepository, type SchoolTenantMembershipRepository } from "../auth/session.ts";
import { badRequest, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import type { NotificationService } from "./service.ts";
import { requireNotificationPersona } from "./service.ts";

export type NotificationHttpService = Pick<NotificationService,
  "list" | "markRead" | "markAllRead" | "getPreferences" | "updatePreferences">;
type Command = "list" | "markRead" | "markAllRead" | "getPreferences" | "updatePreferences";

const guestOnlyAuth: AuthSessionRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createNotificationHttpHandler(
  service?: NotificationHttpService,
  auth: AuthSessionRepository = guestOnlyAuth,
  schoolMemberships?: SchoolTenantMembershipRepository,
) {
  return async (request: Request, command: Command, notificationId?: string): Promise<Response> => {
    let requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const context = await resolveRequestContextFromRequest(request, auth, {
        purpose: "notification_management",
        schoolTenantMembershipRepository: schoolMemberships,
      });
      requestId = context.requestId;
      requireNotificationPersona(context, command === "list" || command === "getPreferences"
        ? "notification.read_own_scope" : "notification.manage_own_scope");
      if (!service) throw serviceUnavailable("Notification service is not configured.");
      let data: unknown;
      switch (command) {
        case "list": data = await service.list(context, requireListQuery(request.url)); break;
        case "markRead": data = await service.markRead(context, requireId(notificationId), await readJson(request)); break;
        case "markAllRead": requireNoQuery(request.url); data = await service.markAllRead(context); break;
        case "getPreferences": requireNoQuery(request.url); data = await service.getPreferences(context); break;
        case "updatePreferences": requireNoQuery(request.url); data = await service.updatePreferences(context, await readJson(request)); break;
      }
      return Response.json({ data });
    } catch (error) {
      return Response.json(toErrorEnvelope(error, requestId), {
        status: error instanceof Error && "status" in error ? Number(error.status) : 500,
      });
    }
  };
}

function requireListQuery(url: string) {
  const query = new URL(url).searchParams;
  for (const key of query.keys()) {
    if (!["limit", "cursor"].includes(key) || query.getAll(key).length !== 1) throw badRequest("Unsupported notification query.");
  }
  const limit = query.get("limit");
  if (limit !== null && !/^[1-9][0-9]{0,2}$/.test(limit)) throw badRequest("Invalid notification page size.");
  return { ...(limit !== null ? { limit: Number(limit) } : {}), ...(query.has("cursor") ? { cursor: query.get("cursor") } : {}) };
}

function requireNoQuery(url: string) {
  if (new URL(url).searchParams.size > 0) throw badRequest("This notification endpoint does not accept query parameters.");
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw badRequest("Request body must be valid JSON."); }
}

function requireId(id?: string): string {
  if (!id) throw badRequest("notificationId is required.");
  return id;
}

export function unconfiguredNotificationHttpHandler() {
  return createNotificationHttpHandler(undefined, guestOnlyAuth);
}
