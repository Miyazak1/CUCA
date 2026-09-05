import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { handlePaymentWebhookRoute } from "@/src/server/billing/runtime/payment.ts";

export const POST = secureApiRoute("POST", handlePaymentWebhookRoute, {
  body: "raw",
  origin: "signed-external",
});
