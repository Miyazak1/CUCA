const BILLING_LOCATOR_KEY = "cuacPendingApplicationInvoice";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const billingStatusPresentation = {
  requires_payment: {
    label: "Payment required",
    className: "is-warning",
    title: "Hosted checkout is not complete",
    copy: "Return to the application to open the secure provider checkout or refresh after payment.",
  },
  succeeded: {
    label: "Payment confirmed",
    className: "",
    title: "The payment service confirmed this invoice",
    copy: "Return to the application to complete the final review and submission steps.",
  },
  canceled: {
    label: "Checkout canceled",
    className: "is-danger",
    title: "This checkout did not complete",
    copy: "Nothing was submitted. Return to the application to request a current quote and checkout session.",
  },
  refunded: {
    label: "Payment refunded",
    className: "is-danger",
    title: "The payment service recorded a refund",
    copy: "Billing entitlement is no longer current. Review the application before taking another payment action.",
  },
};

class BillingRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "BillingRequestError";
    this.status = status;
    this.code = code;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readInvoiceId() {
  const queryInvoiceId = new URLSearchParams(location.search).get("invoice")?.trim() || "";
  if (UUID_PATTERN.test(queryInvoiceId)) return queryInvoiceId;
  try {
    const locator = JSON.parse(sessionStorage.getItem(BILLING_LOCATOR_KEY) || "null");
    return isRecord(locator) && UUID_PATTERN.test(locator.invoiceId || "") ? locator.invoiceId : "";
  } catch {
    return "";
  }
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new BillingRequestError(
      payload?.error?.message || "The billing request could not be completed.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new BillingRequestError("The billing response is missing its data envelope.", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

function formatMoney(money) {
  if (!isRecord(money) || !Number.isSafeInteger(money.amountMinor) || money.amountMinor < 0 || !/^[A-Z]{3}$/.test(money.currency || "")) {
    return "Amount unavailable";
  }
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: money.currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(money.amountMinor / (10 ** digits));
  } catch {
    return `${money.currency} ${money.amountMinor}`;
  }
}

function formatDateTime(value) {
  if (typeof value !== "string" || !value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function invoiceStatusLabel(value) {
  return ({ draft: "Draft", paid: "Paid", void: "Void" })[value] || "Unknown";
}

function validateInvoice(value, requestedInvoiceId) {
  if (!isRecord(value)
    || value.invoiceId !== requestedInvoiceId
    || !UUID_PATTERN.test(value.applicationSetId || "")
    || !/^CUAC-[0-9]{4}-[0-9]{6}$/.test(value.cuacId || "")
    || typeof value.checkoutSessionId !== "string"
    || !value.checkoutSessionId.trim()
    || value.checkoutSessionId.length > 255
    || !["draft", "paid", "void"].includes(value.invoiceStatus)
    || !Object.prototype.hasOwnProperty.call(billingStatusPresentation, value.status)
    || !isRecord(value.amount)
    || !Number.isSafeInteger(value.amount.amountMinor)
    || value.amount.amountMinor < 0
    || !/^[A-Z]{3}$/.test(value.amount.currency || "")) {
    throw new BillingRequestError("The billing service returned an incomplete invoice record.", 200, "INVALID_RESPONSE");
  }
  return value;
}

function timelineItems(invoice) {
  const items = [{ title: "Invoice issued", detail: `Invoice status: ${invoiceStatusLabel(invoice.invoiceStatus)}` }];
  if (invoice.status === "requires_payment") {
    items.push({ title: "Hosted payment required", detail: "The server is waiting for a signed provider result.", current: true });
  }
  if (invoice.paidAt) {
    items.push({ title: "Payment confirmed", detail: formatDateTime(invoice.paidAt), current: invoice.status === "succeeded" });
  }
  if (invoice.canceledAt) {
    items.push({ title: "Checkout canceled", detail: formatDateTime(invoice.canceledAt), current: invoice.status === "canceled" });
  }
  if (invoice.refundedAt) {
    items.push({ title: "Payment refunded", detail: formatDateTime(invoice.refundedAt), current: invoice.status === "refunded" });
  }
  return items;
}

function renderInvoice(invoice) {
  const root = document.querySelector("[data-billing-view]");
  if (!root) return;
  const presentation = billingStatusPresentation[invoice.status];
  const events = timelineItems(invoice);
  root.innerHTML = `
    <section class="billing-state" aria-label="Current billing status">
      <div class="billing-state-copy">
        <span class="billing-status ${presentation.className}">${escapeHtml(presentation.label)}</span>
        <h2>${escapeHtml(presentation.title)}</h2>
        <p>${escapeHtml(presentation.copy)}</p>
      </div>
      <div class="billing-amount">
        <span>Invoice amount</span>
        <strong>${escapeHtml(formatMoney(invoice.amount))}</strong>
      </div>
    </section>

    <div class="billing-grid">
      <div>
        <section class="billing-section" aria-labelledby="billing-record-heading">
          <h2 id="billing-record-heading">Invoice record</h2>
          <dl class="billing-facts">
            <div class="billing-fact"><dt>Invoice ID</dt><dd class="is-id">${escapeHtml(invoice.invoiceId)}</dd></div>
            <div class="billing-fact"><dt>Application set</dt><dd class="is-id">${escapeHtml(invoice.applicationSetId)}</dd></div>
            <div class="billing-fact"><dt>CUAC ID</dt><dd class="is-id">${escapeHtml(invoice.cuacId)}</dd></div>
            <div class="billing-fact"><dt>Checkout session</dt><dd class="is-id">${escapeHtml(invoice.checkoutSessionId)}</dd></div>
            <div class="billing-fact"><dt>Invoice status</dt><dd>${escapeHtml(invoiceStatusLabel(invoice.invoiceStatus))}</dd></div>
            <div class="billing-fact"><dt>Payment status</dt><dd>${escapeHtml(presentation.label)}</dd></div>
            <div class="billing-fact"><dt>Paid at</dt><dd>${escapeHtml(formatDateTime(invoice.paidAt))}</dd></div>
            <div class="billing-fact"><dt>Canceled at</dt><dd>${escapeHtml(formatDateTime(invoice.canceledAt))}</dd></div>
            <div class="billing-fact"><dt>Refunded at</dt><dd>${escapeHtml(formatDateTime(invoice.refundedAt))}</dd></div>
          </dl>
        </section>
      </div>

      <aside>
        <section class="billing-section" aria-labelledby="billing-timeline-heading">
          <h2 id="billing-timeline-heading">Recorded events</h2>
          <ol class="billing-timeline">
            ${events.map(item => `<li class="${item.current ? "is-current" : ""}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></li>`).join("")}
          </ol>
        </section>
        <section class="billing-section billing-note" aria-label="Payment security note">
          <strong>Hosted payment only</strong>
          <span>CUAC does not display or store card numbers, bank details, or provider credentials on this page.</span>
        </section>
      </aside>
    </div>`;
}

function renderEmpty(title, copy, { retry = false } = {}) {
  const root = document.querySelector("[data-billing-view]");
  if (!root) return;
  root.innerHTML = `<section class="billing-empty">
    <p class="billing-kicker">Billing record</p>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(copy)}</p>
    <div class="billing-empty-actions">
      <a class="billing-primary-action" href="application.html#payment">Open application</a>
      ${retry ? '<button class="billing-secondary-action" type="button" data-retry-billing>Retry</button>' : ""}
    </div>
  </section>`;
}

function setRefreshBusy(busy) {
  const button = document.querySelector("[data-refresh-billing]");
  if (button) button.disabled = busy;
}

async function loadBilling() {
  const invoiceId = readInvoiceId();
  if (!invoiceId) {
    renderEmpty("No current invoice was found", "Open the payment step in your application to request a server quote and hosted checkout session.");
    return;
  }
  setRefreshBusy(true);
  try {
    const invoice = validateInvoice(await requestJson(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`), invoiceId);
    renderInvoice(invoice);
  } catch (error) {
    if ([401, 403].includes(error?.status)) {
      const auth = await window.CUAC?.authReady?.();
      if (auth?.authState === "signed-out") {
        window.CUAC?.requireSignedIn?.("view your billing record", {
          requiredRole: "student",
          resumeAction: { type: "navigate", href: `billing-api.html?invoice=${encodeURIComponent(invoiceId)}` },
        });
        return;
      }
    }
    renderEmpty("Billing status could not be confirmed", error?.message || "The billing service is unavailable. No payment status has been assumed.", { retry: true });
  } finally {
    setRefreshBusy(false);
  }
}

document.addEventListener("click", event => {
  if (!event.target.closest("[data-refresh-billing], [data-retry-billing]")) return;
  void loadBilling();
});

void loadBilling();
