const hubState = {
  profile: null,
  applicationSets: [],
  savedItems: [],
  notifications: [],
  errors: {},
};

const hubI18n = window.CUACHubI18n;
const hubLocale = window.CUACI18n?.locale || "en";
const ui = (english) => hubI18n?.ui(english) || english;
const format = (template, values) => hubI18n?.format(template, values) || template;
const localizedHref = (href) => hubI18n?.href(href) || href;

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
      ui("The account request could not be completed."),
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new HubRequestError(ui("The account response is missing its data envelope."), response.status, "INVALID_RESPONSE");
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
  if (!Number.isFinite(date.getTime())) return ui(fallback);
  return new Intl.DateTimeFormat(hubLocale, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function textOrFallback(value, fallback = "Not recorded") {
  return typeof value === "string" && value.trim() ? value.trim() : ui(fallback);
}

function localizedStatus(value, fallback = "In progress") {
  const text = textOrFallback(value, fallback).replaceAll("_", " ");
  return ui(`${text.charAt(0).toUpperCase()}${text.slice(1)}`);
}

function localizedIntake(value, fallback = "No target intake") {
  const text = textOrFallback(value, fallback);
  const match = text.match(/^(Spring|Summer|Fall|Winter)\s+(\d{4})$/i);
  if (!match) return text;
  const term = `${match[1].charAt(0).toUpperCase()}${match[1].slice(1).toLowerCase()}`;
  return `${ui(term)} ${match[2]}`;
}

const applicationSetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function applicationSetHref(set) {
  if (!applicationSetIdPattern.test(set?.id || "")) return localizedHref("application.html");
  const hash = set.status === "draft" ? "#overview" : "#send";
  return localizedHref(`application.html?applicationSet=${encodeURIComponent(set.id)}${hash}`);
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

function renderNextStep() {
  const title = document.querySelector("[data-hub-next-title]");
  const copy = document.querySelector("[data-hub-next-copy]");
  const action = document.querySelector("[data-hub-next-action]");
  const stage = document.querySelector("[data-hub-next-stage]");
  const attention = document.querySelector("[data-hub-next-attention]");
  if (!title || !copy || !action || !stage || !attention) return;

  if (hubState.errors.applications) {
    title.textContent = ui("Your application records are temporarily unavailable");
    copy.textContent = ui("Your saved work has not been changed. Try the application workspace again in a moment.");
    action.textContent = ui("Try application workspace");
    stage.textContent = ui("Unavailable");
    attention.textContent = ui("Reconnect to application records");
    return;
  }

  const activeSets = hubState.applicationSets.filter(set => set?.status !== "archived");
  const activeChoices = activeSets.flatMap(set => Array.isArray(set.choices) ? set.choices : [])
    .filter(choice => choice?.status !== "removed");
  if (!activeSets.length || !activeChoices.length) {
    title.textContent = ui("Choose your first school and program");
    copy.textContent = ui("Add one exact program to start the application. You can review requirements before anything is sent.");
    action.textContent = ui("Browse and add a program");
    action.href = localizedHref("programs.html");
    stage.textContent = ui("Not started");
    attention.textContent = ui("Select a program");
    return;
  }

  const current = activeSets.find(set => set?.status === "draft") || activeSets[0];
  title.textContent = ui("Continue your current application");
  copy.textContent = `${format(activeChoices.length === 1 ? "{count} active choice" : "{count} active choices", { count: activeChoices.length })}. ${ui("Review the next required section before payment or submission.")}`;
  action.textContent = ui("Continue application");
  action.href = applicationSetHref(current);
  stage.textContent = localizedStatus(current.status);
  attention.textContent = current.cuacId ? ui("Review required information") : ui("Complete setup for a CUAC reference");
}

function renderApplications() {
  const root = document.querySelector("[data-hub-applications]");
  if (!root) return;
  if (hubState.errors.applications) {
    root.innerHTML = `<p class="hub-api-error">${escapeHtml(hubState.errors.applications)}</p>`;
    return;
  }
  if (!hubState.applicationSets.length) {
    root.innerHTML = `<div class="hub-api-empty"><h3>${escapeHtml(ui("No application set yet"))}</h3><p>${escapeHtml(ui("Open the application workspace to create a named set and add exact program choices."))}</p></div>`;
    return;
  }
  root.innerHTML = `<ol class="hub-api-application-list">${hubState.applicationSets.slice(0, 5).map(set => {
    const choices = Array.isArray(set.choices) ? set.choices.filter(choice => choice?.status !== "removed") : [];
    return `<li class="hub-api-application"><a class="hub-api-application-link" href="${applicationSetHref(set)}" aria-label="${escapeHtml(`${ui("Open")} ${textOrFallback(set.name, "unnamed application")}`)}">
      <div>
        <span class="hub-api-status">${escapeHtml(localizedStatus(set.status, "Unknown"))}</span>
        <h3>${escapeHtml(textOrFallback(set.name, "Unnamed application set"))}</h3>
        <p>${escapeHtml(set.cuacId || "CUAC reference not issued")}</p>
      </div>
      <div class="hub-api-application-meta">
        <span>${escapeHtml(format(choices.length === 1 ? "{count} choice" : "{count} choices", { count: choices.length }))}</span>
        <span>${escapeHtml(localizedIntake(set.targetIntake))}</span>
        <span>${escapeHtml(format("Revision {revision}", { revision: Number.isInteger(set.revision) ? set.revision : "-" }))}</span>
      </div>
    </a></li>`;
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
    root.innerHTML = `<div class="hub-api-empty"><h3>${escapeHtml(ui("No account events"))}</h3><p>${escapeHtml(ui("Server-created application, billing, document, and security notices will appear here."))}</p></div>`;
    return;
  }
  root.innerHTML = `<ol class="hub-api-notice-list">${hubState.notifications.slice(0, 4).map(item => {
    const href = safeActionPath(item.actionPath);
    return `<li class="hub-api-notice">
      <div class="hub-api-notice-topline"><span>${escapeHtml(formatDate(item.occurredAt))}</span>${item.status === "unread" ? `<strong>${escapeHtml(ui("Unread"))}</strong>` : `<span>${escapeHtml(localizedStatus(item.status, "Unknown"))}</span>`}</div>
      <h3>${escapeHtml(textOrFallback(item.title, "Account event"))}</h3>
      <p>${escapeHtml(textOrFallback(item.body, "No event detail was provided."))}</p>
      ${hubLocale === "en" ? "" : `<span class="hub-api-source-language">${escapeHtml(ui("Original notification content"))}</span>`}
      ${href ? `<a href="${escapeHtml(localizedHref(href))}">${escapeHtml(ui("Open"))}</a>` : ""}
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
    root.innerHTML = `<div class="hub-api-empty"><h3>${escapeHtml(ui("No profile record yet"))}</h3><p>${escapeHtml(ui("Open the applicant profile to add the information used by your application."))}</p></div>`;
    return;
  }
  root.innerHTML = `<dl class="hub-api-profile">
    <div><dt>${escapeHtml(ui("Display name"))}</dt><dd>${escapeHtml(textOrFallback(profile.displayName))}</dd></div>
    <div><dt>${escapeHtml(ui("Citizenship"))}</dt><dd>${escapeHtml(textOrFallback(profile.citizenshipCountry))}</dd></div>
    <div><dt>${escapeHtml(ui("Target degree"))}</dt><dd>${escapeHtml(localizedStatus(profile.targetDegreeLevel, "Not recorded"))}</dd></div>
    <div><dt>${escapeHtml(ui("Target intake"))}</dt><dd>${escapeHtml(localizedIntake(profile.targetIntake, "Not recorded"))}</dd></div>
  </dl>`;
  const greeting = document.querySelector("[data-hub-greeting]");
  if (greeting && profile.displayName) greeting.textContent = format("{name}'s application hub", { name: profile.displayName });
}

function renderHub() {
  renderNextStep();
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
      hubState.errors[key] = result.reason?.message || ui("This account service is unavailable.");
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
