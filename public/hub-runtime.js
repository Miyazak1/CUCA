const hubState = {
  profile: null,
  applicationSets: [],
  savedItems: [],
  notifications: [],
  errors: {},
};

class HubRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "HubRequestError";
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

async function requestJson(path) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HubRequestError(
      payload?.error?.message || "The account request could not be completed.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new HubRequestError("The account response is missing its data envelope.", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

function safeActionPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "";
  try {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || url.username || url.password) return "";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

function formatDate(value, fallback = "Not recorded") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function textOrFallback(value, fallback = "Not recorded") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function renderMetrics() {
  const activeChoices = hubState.applicationSets.flatMap(set => Array.isArray(set.choices) ? set.choices : [])
    .filter(choice => choice?.status !== "removed").length;
  const values = {
    sets: hubState.errors.applications ? "-" : hubState.applicationSets.length,
    choices: hubState.errors.applications ? "-" : activeChoices,
    saved: hubState.errors.saved ? "-" : hubState.savedItems.length,
    unread: hubState.errors.notifications ? "-" : hubState.notifications.filter(item => item?.status === "unread").length,
  };
  for (const [key, value] of Object.entries(values)) {
    const target = document.querySelector(`[data-hub-metric="${key}"]`);
    if (target) target.textContent = String(value);
  }
}

function renderApplications() {
  const root = document.querySelector("[data-hub-applications]");
  if (!root) return;
  if (hubState.errors.applications) {
    root.innerHTML = `<p class="hub-api-error">${escapeHtml(hubState.errors.applications)}</p>`;
    return;
  }
  if (!hubState.applicationSets.length) {
    root.innerHTML = '<div class="hub-api-empty"><h3>No application set yet</h3><p>Open the application workspace to create a named set and add exact program choices.</p></div>';
    return;
  }
  root.innerHTML = `<ol class="hub-api-application-list">${hubState.applicationSets.slice(0, 5).map(set => {
    const choices = Array.isArray(set.choices) ? set.choices.filter(choice => choice?.status !== "removed") : [];
    return `<li class="hub-api-application">
      <div>
        <span class="hub-api-status">${escapeHtml(textOrFallback(set.status, "unknown"))}</span>
        <h3>${escapeHtml(textOrFallback(set.name, "Unnamed application set"))}</h3>
        <p>${escapeHtml(set.cuacId || "CUAC reference not issued")}</p>
      </div>
      <div class="hub-api-application-meta">
        <span>${choices.length} ${choices.length === 1 ? "choice" : "choices"}</span>
        <span>${escapeHtml(set.targetIntake || "No target intake")}</span>
        <span>Revision ${escapeHtml(Number.isInteger(set.revision) ? set.revision : "-")}</span>
      </div>
    </li>`;
  }).join("")}</ol>`;
}

function renderNotifications() {
  const root = document.querySelector("[data-hub-notifications]");
  if (!root) return;
  if (hubState.errors.notifications) {
    root.innerHTML = `<p class="hub-api-error">${escapeHtml(hubState.errors.notifications)}</p>`;
    return;
  }
  if (!hubState.notifications.length) {
    root.innerHTML = '<div class="hub-api-empty"><h3>No account events</h3><p>Server-created application, billing, document, and security notices will appear here.</p></div>';
    return;
  }
  root.innerHTML = `<ol class="hub-api-notice-list">${hubState.notifications.slice(0, 4).map(item => {
    const href = safeActionPath(item.actionPath);
    return `<li class="hub-api-notice">
      <div class="hub-api-notice-topline"><span>${escapeHtml(formatDate(item.occurredAt))}</span>${item.status === "unread" ? "<strong>Unread</strong>" : `<span>${escapeHtml(item.status)}</span>`}</div>
      <h3>${escapeHtml(textOrFallback(item.title, "Account event"))}</h3>
      <p>${escapeHtml(textOrFallback(item.body, "No event detail was provided."))}</p>
      ${href ? `<a href="${escapeHtml(href)}">Open</a>` : ""}
    </li>`;
  }).join("")}</ol>`;
}

function renderProfile() {
  const root = document.querySelector("[data-hub-profile]");
  if (!root) return;
  if (hubState.errors.profile) {
    root.innerHTML = `<p class="hub-api-error">${escapeHtml(hubState.errors.profile)}</p>`;
    return;
  }
  const profile = hubState.profile;
  if (!profile) {
    root.innerHTML = '<div class="hub-api-empty"><h3>No profile record yet</h3><p>Open the applicant profile to add the information used by your application.</p></div>';
    return;
  }
  root.innerHTML = `<dl class="hub-api-profile">
    <div><dt>Display name</dt><dd>${escapeHtml(textOrFallback(profile.displayName))}</dd></div>
    <div><dt>Citizenship</dt><dd>${escapeHtml(textOrFallback(profile.citizenshipCountry))}</dd></div>
    <div><dt>Target degree</dt><dd>${escapeHtml(textOrFallback(profile.targetDegreeLevel))}</dd></div>
    <div><dt>Target intake</dt><dd>${escapeHtml(textOrFallback(profile.targetIntake))}</dd></div>
  </dl>`;
  const greeting = document.querySelector("[data-hub-greeting]");
  if (greeting && profile.displayName) greeting.textContent = `${profile.displayName}'s application hub`;
}

function renderHub() {
  renderMetrics();
  renderApplications();
  renderNotifications();
  renderProfile();
}

async function requireStudent(errors) {
  const authError = errors.find(error => [401, 403].includes(error?.status));
  if (!authError) return false;
  const auth = await window.CUAC?.authReady?.();
  if (auth?.authState !== "signed-out") return false;
  window.CUAC?.requireSignedIn?.("open your student hub", {
    requiredRole: "student",
    resumeAction: { type: "navigate", href: "hub-api.html" },
  });
  return true;
}

async function loadHub() {
  const requests = [
    ["profile", "/api/v1/student/profile"],
    ["applications", "/api/v1/student/application-sets"],
    ["saved", "/api/v1/student/saved-items"],
    ["notifications", "/api/v1/notifications?limit=10"],
  ];
  const results = await Promise.allSettled(requests.map(([, path]) => requestJson(path)));
  const errors = results.filter(result => result.status === "rejected").map(result => result.reason);
  if (await requireStudent(errors)) return;
  results.forEach((result, index) => {
    const key = requests[index][0];
    if (result.status === "rejected") {
      hubState.errors[key] = result.reason?.message || "This account service is unavailable.";
      return;
    }
    if (key === "profile") hubState.profile = isRecord(result.value) ? result.value : null;
    if (key === "applications") hubState.applicationSets = Array.isArray(result.value) ? result.value : [];
    if (key === "saved") hubState.savedItems = Array.isArray(result.value) ? result.value : [];
    if (key === "notifications") hubState.notifications = Array.isArray(result.value?.items) ? result.value.items : [];
  });
  renderHub();
}

void loadHub();
