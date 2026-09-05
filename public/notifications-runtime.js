const noticeIcons = {
  application: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5"/><path d="m9 15 2 2 4-4"/></svg>',
  billing: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></svg>',
  deadline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M12 14v3"/><path d="M12 20h.01"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5"/><path d="M9 14h6"/><path d="M9 17h4"/></svg>',
  funding: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  security: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>',
  update: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
  done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
};

const topicPresentation = {
  application_updates: { category: "application", label: "Application" },
  billing_updates: { category: "billing", label: "Billing" },
  deadline_reminders: { category: "deadline", label: "Deadline" },
  document_reminders: { category: "document", label: "Documents" },
  funding_updates: { category: "funding", label: "Funding" },
  account_security: { category: "security", label: "Security" },
  school_workflow: { category: "application", label: "School workflow" },
  platform_operations: { category: "update", label: "Operations" },
};

let activeFilter = "all";
let notificationItems = [];
let notificationPreferences = [];
let nextCursor = null;
let runtimeState = "loading";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

class NotificationRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "NotificationRequestError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new NotificationRequestError("The notification service returned an unreadable response.", response.status, "INVALID_RESPONSE");
  }
  if (!response.ok) {
    throw new NotificationRequestError(
      payload?.error?.message || "The notification request could not be completed.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new NotificationRequestError("The notification response is missing its data envelope.", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

function presentationFor(item) {
  return topicPresentation[item.topic] || { category: "update", label: "Update" };
}

function severityFor(item) {
  if (item.status !== "unread") return "done";
  if (item.topic === "account_security") return "urgent";
  if (["deadline_reminders", "document_reminders"].includes(item.topic)) return "action";
  if (["school_waiting_documents", "payment_canceled", "payment_refunded"].includes(item.eventType)) return "action";
  return "update";
}

function safeActionPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || url.username || url.password) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function notificationTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function groupFor(item) {
  const occurred = new Date(item.occurredAt);
  if (!Number.isFinite(occurred.getTime())) return "Earlier";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOccurred = new Date(occurred.getFullYear(), occurred.getMonth(), occurred.getDate()).getTime();
  const dayDifference = Math.floor((startToday - startOccurred) / 86400000);
  if (dayDifference <= 0) return "Today";
  if (dayDifference <= 7) return "This week";
  return "Earlier";
}

function renderIcon(category) {
  return `<span class="notice-icon">${noticeIcons[category] || noticeIcons.update}</span>`;
}

function visibleItems() {
  if (activeFilter === "all") return notificationItems;
  if (activeFilter === "action") return notificationItems.filter((item) => ["urgent", "action"].includes(severityFor(item)));
  if (activeFilter === "update") return notificationItems.filter((item) => ["application", "update"].includes(presentationFor(item).category));
  return notificationItems.filter((item) => presentationFor(item).category === activeFilter);
}

function renderSummary() {
  const unread = notificationItems.filter((item) => item.status === "unread");
  const values = {
    action: unread.length,
    deadlines: notificationItems.filter((item) => item.topic === "deadline_reminders").length,
    documents: notificationItems.filter((item) => item.topic === "document_reminders").length,
    billing: notificationItems.filter((item) => item.topic === "billing_updates").length,
  };
  for (const [key, value] of Object.entries(values)) {
    const target = document.querySelector(`[data-summary="${key}"]`);
    if (target) target.textContent = String(value);
  }
  const copy = document.querySelector("[data-notification-summary-copy]");
  if (!copy) return;
  if (runtimeState === "loading") copy.textContent = "Loading your account notifications.";
  else if (runtimeState === "error") copy.textContent = "Notifications are temporarily unavailable.";
  else if (unread.length === 0) copy.textContent = "You are caught up.";
  else copy.textContent = `${unread.length} unread ${unread.length === 1 ? "item needs" : "items need"} your attention.`;
}

function renderPriority() {
  const target = document.querySelector("[data-priority-card]");
  if (!target) return;
  const item = notificationItems.find((entry) => entry.status === "unread" && ["urgent", "action"].includes(severityFor(entry)))
    || notificationItems.find((entry) => entry.status === "unread") || notificationItems[0];
  if (!item) {
    target.innerHTML = `
      ${renderIcon("done")}
      <div class="priority-copy">
        <span class="status-pill done">Current</span>
        <h2>${runtimeState === "error" ? "Notifications could not be loaded." : "No unread notification needs action."}</h2>
        <p>${runtimeState === "error" ? "Retry the account notification service before relying on this inbox." : "New account events will appear here after the server records them."}</p>
      </div>
      <div class="priority-actions"><button class="text-action" type="button" data-retry-notifications>Retry</button></div>`;
    return;
  }
  const presentation = presentationFor(item);
  const severity = severityFor(item);
  const actionPath = safeActionPath(item.actionPath);
  target.innerHTML = `
    ${renderIcon(presentation.category)}
    <div class="priority-copy">
      <span class="status-pill ${escapeHtml(severity)}">${escapeHtml(item.status === "unread" ? "Unread" : "Read")}</span>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.body)}</p>
    </div>
    ${actionPath ? `<div class="priority-actions"><a href="${escapeHtml(actionPath)}">Open</a></div>` : ""}`;
}

function renderNotifications() {
  const list = document.querySelector("[data-notification-list]");
  const empty = document.querySelector("[data-empty-state]");
  if (!list || !empty) return;
  const items = visibleItems();
  empty.hidden = runtimeState === "loading" || items.length > 0;
  if (runtimeState === "loading") {
    list.innerHTML = '<p class="notice-runtime-message" role="status">Loading account notifications...</p>';
    return;
  }
  if (!items.length) {
    list.innerHTML = nextCursor ? '<div class="notice-load-more"><button class="text-action" type="button" data-load-more>Load older notifications</button></div>' : "";
    return;
  }
  const groups = ["Today", "This week", "Earlier"]
    .map((group) => ({ group, items: items.filter((item) => groupFor(item) === group) }))
    .filter((entry) => entry.items.length > 0);
  list.innerHTML = `${groups.map(({ group, items: groupItems }) => `
    <section class="notice-group" aria-label="${escapeHtml(group)} notifications">
      <h3>${escapeHtml(group)}</h3>
      <div class="notice-stack">
        ${groupItems.map((item) => {
          const presentation = presentationFor(item);
          const severity = severityFor(item);
          const actionPath = safeActionPath(item.actionPath);
          return `<article class="notice-row ${item.status === "unread" ? "" : "is-read"}" data-notice-id="${escapeHtml(item.id)}">
            ${renderIcon(presentation.category)}
            <div class="notice-copy">
              <div class="notice-topline"><span class="status-pill ${escapeHtml(severity)}">${escapeHtml(item.status === "unread" ? "Unread" : "Read")}</span><span class="notice-meta">${escapeHtml(notificationTime(item.occurredAt))}</span></div>
              <h2 class="notice-title">${escapeHtml(item.title)}</h2>
              <p class="notice-body">${escapeHtml(item.body)}</p>
              <div class="notice-meta"><span>${escapeHtml(presentation.label)}</span><span>${escapeHtml(item.eventType)}</span></div>
            </div>
            <div class="notice-actions">
              ${actionPath ? `<a href="${escapeHtml(actionPath)}">Open</a>` : ""}
              ${item.status === "unread" ? `<button class="notice-read" type="button" data-mark-read="${escapeHtml(item.id)}">Mark read</button>` : '<span class="notice-meta">Read</span>'}
            </div>
          </article>`;
        }).join("")}
      </div>
    </section>`).join("")}${nextCursor ? '<div class="notice-load-more"><button class="text-action" type="button" data-load-more>Load older notifications</button></div>' : ""}`;
}

function syncPreferenceControls() {
  const preferenceMap = new Map(notificationPreferences.map((item) => [item.topic, item]));
  document.querySelectorAll("[data-notification-topic]").forEach((input) => {
    const preference = preferenceMap.get(input.dataset.notificationTopic);
    input.checked = preference?.inAppEnabled === true;
    input.disabled = !preference || preference.topic === "account_security";
  });
  const summary = document.querySelector("[data-quiet-summary]");
  if (!summary) return;
  if (!notificationPreferences.length) {
    summary.textContent = runtimeState === "error" ? "Account delivery preferences are unavailable." : "Loading account-level delivery preferences.";
    return;
  }
  const enabledCount = notificationPreferences.filter((item) => item.inAppEnabled).length;
  summary.textContent = `${enabledCount} of ${notificationPreferences.length} in-app topics are enabled. Email and SMS rules remain account-level preferences.`;
}

function renderAll() {
  renderSummary();
  renderPriority();
  renderNotifications();
  syncPreferenceControls();
}

function requireNotificationAccount(error) {
  if (![401, 403].includes(error?.status)) return false;
  window.CUAC?.requireSignedIn?.("view account notifications", { resumeAction: { type: "navigate", href: "notifications.html" } });
  return true;
}

async function loadNotifications({ append = false } = {}) {
  if (!append) {
    runtimeState = "loading";
    nextCursor = null;
    renderAll();
  }
  try {
    const query = new URLSearchParams({ limit: "100" });
    if (append && nextCursor) query.set("cursor", nextCursor);
    const data = await requestJson(`/api/v1/notifications?${query}`);
    if (!data || !Array.isArray(data.items) || (data.nextCursor !== null && typeof data.nextCursor !== "string")) {
      throw new NotificationRequestError("The notification list does not match the expected contract.", 503, "INVALID_RESPONSE");
    }
    const known = new Set(append ? notificationItems.map((item) => item.id) : []);
    const incoming = data.items.filter((item) => item && typeof item.id === "string" && !known.has(item.id));
    notificationItems = append ? [...notificationItems, ...incoming] : incoming;
    nextCursor = data.nextCursor;
    runtimeState = "ready";
  } catch (error) {
    runtimeState = "error";
    requireNotificationAccount(error);
  }
  renderAll();
}

async function loadPreferences() {
  try {
    const data = await requestJson("/api/v1/notifications/preferences");
    if (!data || !Array.isArray(data.preferences)) throw new NotificationRequestError("The notification preferences do not match the expected contract.", 503, "INVALID_RESPONSE");
    notificationPreferences = data.preferences;
  } catch (error) {
    notificationPreferences = [];
    requireNotificationAccount(error);
  }
  syncPreferenceControls();
}

async function markNotificationRead(id, button) {
  const item = notificationItems.find((entry) => entry.id === id);
  if (!item || item.status !== "unread" || !Number.isSafeInteger(item.revision)) return;
  button.disabled = true;
  try {
    const updated = await requestJson(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH", body: JSON.stringify({ expectedRevision: item.revision }),
    });
    if (!updated || updated.id !== id) throw new NotificationRequestError("The read receipt does not match this notification.", 503, "INVALID_RESPONSE");
    notificationItems = notificationItems.map((entry) => entry.id === id ? updated : entry);
    renderAll();
  } catch (error) {
    button.disabled = false;
    if (error?.status === 409) await loadNotifications();
    else {
      runtimeState = "error";
      renderSummary();
    }
  }
}

async function markAllNotificationsRead(button) {
  button.disabled = true;
  try {
    await requestJson("/api/v1/notifications/read-all", { method: "PATCH" });
    await loadNotifications();
  } catch (error) {
    button.disabled = false;
    requireNotificationAccount(error);
  }
}

async function updatePreference(topic, enabled, input) {
  const current = notificationPreferences.find((item) => item.topic === topic);
  if (!current || current.topic === "account_security" || !Number.isSafeInteger(current.revision)) {
    syncPreferenceControls();
    return;
  }
  input.disabled = true;
  try {
    const data = await requestJson("/api/v1/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ preferences: [{
        topic: current.topic,
        inAppEnabled: enabled,
        emailEnabled: current.emailEnabled === true,
        smsEnabled: current.smsEnabled === true,
        expectedRevision: current.revision,
      }] }),
    });
    if (!data || !Array.isArray(data.preferences) || data.preferences.length !== 1 || data.preferences[0].topic !== topic) {
      throw new NotificationRequestError("The preference receipt does not match this topic.", 503, "INVALID_RESPONSE");
    }
    notificationPreferences = notificationPreferences.map((item) => item.topic === topic ? data.preferences[0] : item);
  } catch (error) {
    if (error?.status === 409) await loadPreferences();
    else requireNotificationAccount(error);
  }
  syncPreferenceControls();
}

function setActiveFilter(filter, focus = false) {
  activeFilter = filter;
  const tabs = Array.from(document.querySelectorAll("[data-filter]"));
  tabs.forEach((tab) => {
    const active = tab.dataset.filter === filter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    if (focus && active) tab.focus();
  });
  renderNotifications();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-filter]");
    if (filter) return setActiveFilter(filter.dataset.filter || "all");
    const readButton = event.target.closest("[data-mark-read]");
    if (readButton) return void markNotificationRead(readButton.dataset.markRead, readButton);
    const markAll = event.target.closest("[data-mark-all-read]");
    if (markAll) return void markAllNotificationsRead(markAll);
    if (event.target.closest("[data-load-more]")) return void loadNotifications({ append: true });
    if (event.target.closest("[data-retry-notifications]")) void loadNotifications();
  });
  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-notification-topic]");
    if (input) void updatePreference(input.dataset.notificationTopic, input.checked, input);
  });
  document.addEventListener("keydown", (event) => {
    const tabs = Array.from(document.querySelectorAll("[data-filter]"));
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    setActiveFilter(tabs[nextIndex].dataset.filter || "all", true);
  });
}

function initialize() {
  document.querySelectorAll("[data-notice-icon]").forEach((target) => {
    target.innerHTML = noticeIcons[target.dataset.noticeIcon] || noticeIcons.done;
  });
  bindEvents();
  renderAll();
  void Promise.all([loadNotifications(), loadPreferences()]);
}

initialize();
