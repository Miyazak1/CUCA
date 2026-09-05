import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { toErrorEnvelope } from "../shared/errors.ts";
import type { BillingFacadeService, CheckoutIntentInput, FeePreviewInput } from "./facade.ts";

type BillingRouteName = "previewFees" | "createCheckoutIntent" | "getCheckoutStatus";
type BillingService = Pick<BillingFacadeService,
  "previewStudentFees" | "createStudentCheckoutIntent" | "getStudentCheckoutStatus">;

export function createBillingHttpHandlers(service: BillingService, authRepository: AuthSessionRepository) {
  return {
    previewFees: (request: Request) => handleBillingRoute(request, service, authRepository, "previewFees"),
    createCheckoutIntent: (request: Request) => handleBillingRoute(request, service, authRepository, "createCheckoutIntent"),
    getCheckoutStatus: (request: Request, invoiceId: string) => handleBillingRoute(
      request, service, authRepository, "getCheckoutStatus", invoiceId),
  };
}

async function handleBillingRoute(
  request: Request,
  service: BillingService,
  authRepository: AuthSessionRepository,
  routeName: BillingRouteName,
  invoiceId?: string,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "billing" });

  try {
    const data = await callBillingRoute(request, service, context, routeName, invoiceId);
    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function callBillingRoute(
  request: Request,
  service: BillingService,
  context: Parameters<BillingService["previewStudentFees"]>[0],
  routeName: BillingRouteName,
  invoiceId?: string,
) {
  switch (routeName) {
    case "previewFees":
      return service.previewStudentFees(context, (await readJsonBody(request)) as FeePreviewInput);
    case "createCheckoutIntent":
      return service.createStudentCheckoutIntent(context, (await readJsonBody(request)) as CheckoutIntentInput);
    case "getCheckoutStatus":
      return service.getStudentCheckoutStatus(context, invoiceId ?? "");
    default:
      throw new Error("Unsupported billing route.");
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) {
    return {};
  }

  return request.json();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
