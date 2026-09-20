const status = document.querySelector("[data-guardian-status]");
const accept = document.querySelector("[data-guardian-accept]");
const decline = document.querySelector("[data-guardian-decline]");
const params = new URLSearchParams(window.location.hash.slice(1));
const requestId = params.get("request");
const token = params.get("token");
window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

function setStatus(message, kind = "") {
  status.textContent = message;
  status.dataset.state = kind;
}

async function respond(action) {
  if (!requestId || !token) { setStatus("This approval link is missing or invalid.", "error"); return; }
  accept.disabled = true;
  decline.disabled = true;
  setStatus(action === "accept" ? "Activating the child account..." : "Declining the request...");
  try {
    const response = await fetch(`/api/v1/auth/guardian-consent/${action}`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ requestId, token }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || "The request could not be completed.");
    setStatus(action === "accept"
      ? "Approved. The child account is active; the child can now sign in and verify their email."
      : "Declined. The pending password and approval credential have been removed.", "success");
  } catch (error) {
    setStatus(error.message, "error");
    accept.disabled = false;
    decline.disabled = false;
  }
}

accept.addEventListener("click", () => void respond("accept"));
decline.addEventListener("click", () => void respond("decline"));
if (!requestId || !token) { accept.disabled = true; decline.disabled = true; setStatus("This approval link is missing or invalid.", "error"); }
