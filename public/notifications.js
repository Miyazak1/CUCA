const noticeIcons = {
  deadline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M12 14v3"/><path d="M12 20h.01"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5"/><path d="M9 14h6"/><path d="M9 17h4"/></svg>',
  funding: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 14 8l5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="M19 15v4"/><path d="M21 17h-4"/></svg>',
  update: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
  city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
};

const dataClient = window.CuacDataClient;
const notificationEventsStorageKey = dataClient?.storageKeys?.notificationEvents || "cuacNotificationEventsDemoState";
const notificationCenterStorageKey = dataClient?.storageKeys?.notificationCenterState || "cuacNotificationCenterDemoState";
const notificationSummary = dataClient?.getNotificationCenterSummary?.() || {};

const baseNotificationItems = (notificationSummary.baseItems || []).map((item) => ({ ...item }));
const notificationGroups = notificationSummary.groups || ["Today", "This week", "Earlier"];
const preferenceStorageKey = "cuacPreferencesDemoState";
const defaultNotificationPreferences = notificationSummary.defaultPreferences || {
  categories: { deadline: true, document: true, funding: true, agent: true, update: false },
  timing: "balanced",
};

let activeFilter = "all";
let notificationItems = hydrateNotificationItems();
const notificationCenterState = readNotificationCenterState();
const readState = new Map(notificationItems.map((item) => [item.id, notificationCenterState.readIds.includes(item.id)]));
const dismissedState = new Map(notificationItems.map((item) => [item.id, notificationCenterState.dismissedIds.includes(item.id)]));
let notificationPreferences = readNotificationPreferences();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function readNotificationEvents() {
  if (dataClient?.readNotificationEvents) return dataClient.readNotificationEvents();
  try {
    const state = JSON.parse(localStorage.getItem(notificationEventsStorageKey) || "{}");
    return Array.isArray(state.events) ? state.events : [];
  } catch {
    return [];
  }
}

function preferredInterfaceLanguage() {
  const state = readPreferenceState();
  return String(state.workspace?.language?.interfaceLanguage || "").trim();
}

function shouldUseChineseNotificationCopy() {
  return /^(chinese|zh|中文)$/i.test(preferredInterfaceLanguage());
}

function localizedNotificationFields(event = {}) {
  if (!shouldUseChineseNotificationCopy()) return {};
  const zh = event.localized?.zh || event.zh || {};
  return {
    title: zh.title || event.titleZh,
    body: zh.body || event.bodyZh,
    action: zh.action || event.actionZh,
    prompt: zh.prompt || event.promptZh,
  };
}

function normalizeNotificationEvent(event) {
  const localized = localizedNotificationFields(event);
  return {
    ...event,
    id: event.id || `event-${Date.now()}`,
    type: event.type || "update",
    severity: event.severity || "action",
    group: event.group || "Today",
    title: localized.title || event.title || "CUAC update",
    body: localized.body || event.body || "A CUAC application event needs your attention.",
    entity: event.entity || "CUAC",
    time: event.time || "Just now",
    action: localized.action || event.action || "Open",
    href: event.href || "hub.html",
    prompt: localized.prompt || event.prompt || "Summarize this CUAC notification and suggest my next action",
  };
}

function hydrateNotificationItems() {
  const dynamicEvents = readNotificationEvents().map(normalizeNotificationEvent);
  const dynamicIds = new Set(dynamicEvents.map((item) => item.id));
  return [...dynamicEvents, ...baseNotificationItems.filter((item) => !dynamicIds.has(item.id))];
}

function readNotificationCenterState() {
  if (dataClient?.readNotificationCenterState) return dataClient.readNotificationCenterState();
  try {
    const state = JSON.parse(localStorage.getItem(notificationCenterStorageKey) || "{}");
    return {
      readIds: Array.isArray(state.readIds) ? state.readIds : [],
      dismissedIds: Array.isArray(state.dismissedIds) ? state.dismissedIds : [],
      updatedAt: state.updatedAt || "",
    };
  } catch {
    return { readIds: [], dismissedIds: [], updatedAt: "" };
  }
}

function persistNotificationCenterState() {
  const state = {
    readIds: notificationItems.filter((item) => readState.get(item.id)).map((item) => item.id),
    dismissedIds: notificationItems.filter((item) => dismissedState.get(item.id)).map((item) => item.id),
  };
  if (dataClient?.writeNotificationCenterState) {
    dataClient.writeNotificationCenterState(state);
    return;
  }
  try {
    localStorage.setItem(notificationCenterStorageKey, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch {
    // Demo storage can be unavailable in restricted preview contexts.
  }
}

function statusText(item) {
  if (item.severity === "urgent") return "Urgent";
  if (item.severity === "action") return "Action needed";
  if (item.severity === "agent") return "Agent result";
  if (item.severity === "done") return "Saved";
  return "Update";
}

function readPreferenceState() {
  try {
    return JSON.parse(localStorage.getItem(preferenceStorageKey) || "{}");
  } catch {
    return {};
  }
}

function writePreferenceState(state) {
  try {
    localStorage.setItem(preferenceStorageKey, JSON.stringify(state));
  } catch {
    // Demo storage can be unavailable in restricted preview contexts.
  }
}

function readNotificationPreferences() {
  const stored = readPreferenceState().notifications || {};
  return {
    categories: { ...defaultNotificationPreferences.categories, ...(stored.categories || {}) },
    timing: stored.timing || defaultNotificationPreferences.timing,
  };
}

function persistNotificationPreferences() {
  const state = readPreferenceState();
  writePreferenceState({
    ...state,
    notifications: notificationPreferences,
    savedAt: new Date().toISOString(),
  });
}

function notificationCategory(item) {
  if (item.type === "city") return "update";
  return item.type;
}

function isEnabledByPreferences(item) {
  return Boolean(notificationPreferences.categories[notificationCategory(item)]);
}

function syncQuietSettings() {
  document.querySelectorAll("[data-quiet-pref]").forEach((input) => {
    input.checked = Boolean(notificationPreferences.categories[input.dataset.quietPref]);
  });
  const activeCategories = Object.entries(notificationPreferences.categories)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.replace("-", " "));
  const summary = document.querySelector("[data-quiet-summary]");
  if (summary) {
    summary.textContent = `${activeCategories.length} reminder categories on · timing: ${notificationPreferences.timing}. Preferences are synced with your account settings.`;
  }
}

function visibleItems() {
  return notificationItems.filter((item) => {
    if (!isEnabledByPreferences(item)) return false;
    if (dismissedState.get(item.id)) return false;
    if (activeFilter === "all") return true;
    if (activeFilter === "action") return ["urgent", "action"].includes(item.severity);
    if (activeFilter === "update") return ["update", "done"].includes(item.severity);
    return item.type === activeFilter;
  });
}

function renderIcon(type) {
  return `<span class="notice-icon">${noticeIcons[type] || noticeIcons.update}</span>`;
}

function renderSummary() {
  const active = notificationItems.filter((item) => isEnabledByPreferences(item) && !dismissedState.get(item.id));
  const summary = {
    action: active.filter((item) => ["urgent", "action"].includes(item.severity)).length,
    deadlines: active.filter((item) => item.type === "deadline").length,
    documents: active.filter((item) => item.type === "document").length,
    agent: active.filter((item) => item.type === "agent").length,
  };
  Object.entries(summary).forEach(([key, value]) => {
    const target = document.querySelector(`[data-summary="${key}"]`);
    if (target) target.textContent = value;
  });
}

function renderPriority() {
  const target = document.querySelector("[data-priority-card]");
  if (!target) return;
  const item = notificationItems.find((entry) => isEnabledByPreferences(entry) && !dismissedState.get(entry.id) && entry.severity === "urgent") || visibleItems()[0];
  if (!item) {
    target.innerHTML = `
      ${renderIcon("done")}
      <div class="priority-copy">
        <span class="status-pill done">Clean</span>
        <h2>No urgent action right now.</h2>
        <p>Keep browsing programs, scholarships, and city guides. CUAC will surface blockers here.</p>
      </div>
      <div class="priority-actions"><a href="programs.html">Browse programs</a></div>
    `;
    return;
  }

  target.innerHTML = `
    ${renderIcon(item.type)}
    <div class="priority-copy">
      <span class="status-pill ${escapeHtml(item.severity)}">${escapeHtml(statusText(item))}</span>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.body)}</p>
    </div>
    <div class="priority-actions">
      <a href="${escapeHtml(item.href)}">${escapeHtml(item.action)}</a>
    </div>
  `;
}

function renderNotifications() {
  const list = document.querySelector("[data-notification-list]");
  const empty = document.querySelector("[data-empty-state]");
  if (!list || !empty) return;

  const items = visibleItems();
  empty.hidden = items.length > 0;

  const groups = notificationGroups
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length);

  list.innerHTML = groups.map(({ group, items: groupItems }) => `
    <section class="notice-group" aria-label="${escapeHtml(group)} notifications">
      <h3>${escapeHtml(group)}</h3>
      <div class="notice-stack">
        ${groupItems.map((item) => {
          const isRead = readState.get(item.id);
          return `
            <article class="notice-row ${isRead ? "is-read" : ""}" data-notice-id="${escapeHtml(item.id)}" data-entity-type="${escapeHtml(item.entityType || item.type)}" data-entity-id="${escapeHtml(item.entityId || item.entity)}" data-source-model="${escapeHtml(item.sourceFieldLineage?.sourceModel || item.sourceFieldLineage?.fromProgramRecord?.sourceModel || "")}">
              ${renderIcon(item.type)}
              <div class="notice-copy">
                <div class="notice-topline">
                  <span class="status-pill ${escapeHtml(item.severity)}">${escapeHtml(statusText(item))}</span>
                  <span class="notice-meta">${escapeHtml(item.time)}</span>
                </div>
                <h2 class="notice-title">${escapeHtml(item.title)}</h2>
                <p class="notice-body">${escapeHtml(item.body)}</p>
                <div class="notice-meta">
                  <span>${escapeHtml(item.entity)}</span>
                  <span>${escapeHtml(item.type)}</span>
                </div>
              </div>
              <div class="notice-actions">
                <a href="${escapeHtml(item.href)}">${escapeHtml(item.action)}</a>
                <button class="notice-read" type="button" data-mark-read="${escapeHtml(item.id)}">${isRead ? "Unread" : "Read"}</button>
                <button class="notice-dismiss" type="button" data-dismiss="${escapeHtml(item.id)}">Dismiss</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
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
    if (filter) {
      setActiveFilter(filter.dataset.filter || "all");
      return;
    }

    const readButton = event.target.closest("[data-mark-read]");
    if (readButton) {
      const id = readButton.dataset.markRead;
      readState.set(id, !readState.get(id));
      persistNotificationCenterState();
      renderNotifications();
      return;
    }

    const dismissButton = event.target.closest("[data-dismiss]");
    if (dismissButton) {
      dismissedState.set(dismissButton.dataset.dismiss, true);
      persistNotificationCenterState();
      renderSummary();
      renderPriority();
      renderNotifications();
      return;
    }

    if (event.target.closest("[data-mark-all-read]")) {
      notificationItems.forEach((item) => readState.set(item.id, true));
      persistNotificationCenterState();
      renderNotifications();
    }
  });

  document.addEventListener("change", (event) => {
    const quiet = event.target.closest("[data-quiet-pref]");
    if (!quiet) return;
    notificationPreferences = {
      ...notificationPreferences,
      categories: {
        ...notificationPreferences.categories,
        [quiet.dataset.quietPref]: quiet.checked,
      },
    };
    persistNotificationPreferences();
    syncQuietSettings();
    renderSummary();
    renderPriority();
    renderNotifications();
  });

  document.addEventListener("keydown", (event) => {
    const tabs = Array.from(document.querySelectorAll("[data-filter]"));
    const current = document.activeElement;
    const currentIndex = tabs.indexOf(current);
    if (currentIndex === -1 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    setActiveFilter(tabs[nextIndex].dataset.filter || "all", true);
  });
}

function init() {
  document.querySelectorAll("[data-notice-icon]").forEach((target) => {
    target.innerHTML = noticeIcons[target.dataset.noticeIcon] || noticeIcons.done;
  });
  syncQuietSettings();
  renderSummary();
  renderPriority();
  renderNotifications();
  bindEvents();
}

init();
