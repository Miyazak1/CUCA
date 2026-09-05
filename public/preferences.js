const prefIcons = {
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.08H3a2 2 0 1 1 0-4h.09A1.8 1.8 0 0 0 4.74 8.8a1.8 1.8 0 0 0-.36-1.98l-.06-.06A2 2 0 1 1 7.15 3.9l.06.06a1.8 1.8 0 0 0 1.98.36h.01A1.8 1.8 0 0 0 10.28 2.7V2a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 1.98v.01a1.8 1.8 0 0 0 1.65 1.08H22a2 2 0 1 1 0 4h-.09A1.8 1.8 0 0 0 19.4 15Z"/></svg>',
  key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7.5" cy="14.5" r="4.5"/><path d="m11 11 9-9"/><path d="m16 6 2 2"/><path d="m14 8 2 2"/></svg>',
  language: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/></svg>',
  guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 14 8l5 2-5 2-2 5-2-5-5-2 5-2Z"/><path d="M19 15v4"/><path d="M21 17h-4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>',
};

const dataClient = window.CuacDataClient;
const preferenceSummary = dataClient?.getPreferenceCenterSummary?.() || {};
const preferenceStorageKey = preferenceSummary.storageKeys?.preferences || "cuacPreferencesDemoState";
const agentMemoryStorageKey = preferenceSummary.storageKeys?.agentMemory || "cuacStudentAgentMemory";
const defaultNotificationPreferences = preferenceSummary.defaultNotificationPreferences || {
  categories: { deadline: true, document: true, funding: true, agent: true, update: false },
  timing: "balanced",
};
const defaultAgentMemoryState = preferenceSummary.defaultAgentMemoryState || {
  status: "active",
  clearCount: 0,
  storageKey: agentMemoryStorageKey,
};
const sectionCopy = {
  preferences: ["Preferences", "Keep account settings separate from application details."],
  hub: ["Hub personalisation", "Tune the Hub without editing school-facing data."],
  support: ["Study support", "Choose how CUAC nudges and explains next steps."],
  language: ["Language and region", "Format explanations, dates, cost, and Agent tone."],
  notifications: ["Notifications", "Decide what deserves attention."],
  security: ["Password and security", "Protect sign-in, recovery, and sensitive actions."],
  agent: ["Agent memory", "Control what Agent can use and when it must ask."],
  privacy: ["Privacy", "Keep personalisation scoped and reversible."],
};

let dirty = false;
let defaultWorkspacePreferences = {};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readPreferencesState() {
  try {
    return JSON.parse(localStorage.getItem(preferenceStorageKey) || "{}");
  } catch {
    return {};
  }
}

function writePreferencesState(state) {
  try {
    localStorage.setItem(preferenceStorageKey, JSON.stringify(state));
  } catch {
    // Demo storage can be unavailable in restricted preview contexts.
  }
}

function namedPreferenceControls() {
  return Array.from(document.querySelectorAll("[data-pref-control][name]"));
}

function currentWorkspacePreferences() {
  return namedPreferenceControls().reduce((result, control) => {
    if (control.type === "password") return result;
    result[control.name] = control.type === "checkbox" ? control.checked : control.value;
    return result;
  }, {});
}

function applyWorkspacePreferences(workspace = {}) {
  namedPreferenceControls().forEach((control) => {
    if (!(control.name in workspace) || control.type === "password") return;
    if (control.type === "checkbox") {
      control.checked = Boolean(workspace[control.name]);
      return;
    }
    control.value = workspace[control.name];
  });
}

function currentNotificationPreferences() {
  const categories = clone(defaultNotificationPreferences.categories);
  document.querySelectorAll("[data-notification-pref]").forEach((input) => {
    categories[input.dataset.notificationPref] = input.checked;
  });
  const timing = document.querySelector("[data-notification-timing] .selected")?.dataset.notificationTimingValue || defaultNotificationPreferences.timing;
  return { categories, timing };
}

function applyNotificationPreferences(preferences = defaultNotificationPreferences) {
  const next = {
    categories: { ...defaultNotificationPreferences.categories, ...(preferences.categories || {}) },
    timing: preferences.timing || defaultNotificationPreferences.timing,
  };
  document.querySelectorAll("[data-notification-pref]").forEach((input) => {
    input.checked = Boolean(next.categories[input.dataset.notificationPref]);
  });
  document.querySelectorAll("[data-notification-timing] button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.notificationTimingValue === next.timing);
  });
}

function currentAgentMemoryState() {
  const state = readPreferencesState();
  return {
    ...defaultAgentMemoryState,
    ...(state.agentMemory || {}),
  };
}

function renderAgentMemoryState() {
  const memory = currentAgentMemoryState();
  const panel = document.querySelector("[data-agent-memory-panel]");
  const title = document.querySelector("[data-agent-memory-title]");
  const copy = document.querySelector("[data-agent-memory-copy]");
  const longMemory = document.querySelector("[data-agent-long-memory]");
  if (!panel || !title || !copy) return;

  const cleared = memory.status === "cleared-preview";
  const disabled = memory.status === "disabled-preview";
  panel.dataset.agentMemoryStatus = memory.status;
  title.textContent = cleared ? "Student memory cleared" : disabled ? "Long-term memory paused" : "Student memory active";
  copy.textContent = cleared
    ? "Long-term Agent memory was cleared. New signed-in actions can build fresh context."
    : disabled
      ? "Agent can answer from the current page, but long-term memory is paused."
      : "Signed-in Agent context can use saved routes and preferences until manual clear.";
  if (longMemory) longMemory.checked = !cleared && !disabled;
}

function persistAgentMemoryCleared() {
  const state = readPreferencesState();
  const clearedAt = new Date().toISOString();
  writePreferencesState({
    ...state,
    agentMemory: {
      status: "cleared-preview",
      clearedAt,
      clearCount: (currentAgentMemoryState().clearCount || 0) + 1,
      clearTrigger: "manual-confirmation",
      storageKey: agentMemoryStorageKey,
    },
    savedAt: clearedAt,
  });
  try {
    localStorage.removeItem(agentMemoryStorageKey);
  } catch {
    // Demo storage can be unavailable in restricted preview contexts.
  }
  document.querySelector("[data-agent-memory-confirm]")?.setAttribute("hidden", "");
  renderAgentMemoryState();
  setDirty(false);
}

function renderIcons() {
  document.querySelectorAll("[data-pref-icon]").forEach((target) => {
    target.innerHTML = prefIcons[target.dataset.prefIcon] || "";
  });
}

function setDirty(nextDirty) {
  dirty = nextDirty;
  const saveBar = document.querySelector("[data-preferences-savebar]");
  const saveState = document.querySelector("[data-save-state]");
  if (!saveBar || !saveState) return;
  saveBar.hidden = !dirty;
  saveState.classList.toggle("unsaved", dirty);
  saveState.classList.toggle("saved", !dirty);
  saveState.querySelector("p").innerHTML = dirty
    ? "<strong>Unsaved changes.</strong> Save to apply these preferences across CUAC."
    : "<strong>Preferences saved.</strong> These settings shape CUAC experience, not the school-facing application record.";
}

function setActiveSection(section) {
  const nextSection = sectionCopy[section] ? section : "preferences";
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === nextSection);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === nextSection);
  });
  const [kicker, title] = sectionCopy[nextSection];
  const kickerTarget = document.querySelector("[data-active-kicker]");
  const titleTarget = document.querySelector("[data-active-title]");
  if (kickerTarget) kickerTarget.textContent = kicker;
  if (titleTarget) titleTarget.textContent = title;
  if (window.location.hash.slice(1) !== nextSection) {
    window.history.replaceState(null, "", `#${nextSection}`);
  }
}

function bindSectionNavigation() {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => setActiveSection(button.dataset.section || "preferences"));
  });
}

function applyHashSection() {
  const hashSection = window.location.hash.replace("#", "");
  if (hashSection === "profile" || hashSection === "goal" || hashSection === "budget" || hashSection === "readiness") {
    window.location.href = "application.html#info";
    return true;
  }
  if (hashSection && sectionCopy[hashSection]) {
    setActiveSection(hashSection);
    return true;
  }
  setActiveSection("preferences");
  return false;
}

function savePreferences(agentStatus) {
  const currentState = readPreferencesState();
  const longMemory = document.querySelector("[data-agent-long-memory]");
  const nextAgentStatus = agentStatus || (longMemory?.checked === false ? "disabled-preview" : "active");
  writePreferencesState({
    ...currentState,
    workspace: currentWorkspacePreferences(),
    notifications: currentNotificationPreferences(),
    agentMemory: {
      ...currentAgentMemoryState(),
      status: nextAgentStatus,
      storageKey: agentMemoryStorageKey,
    },
    savedAt: new Date().toISOString(),
  });
  renderAgentMemoryState();
  setDirty(false);
}

function resetPreferences() {
  applyWorkspacePreferences(defaultWorkspacePreferences);
  applyNotificationPreferences(defaultNotificationPreferences);
  writePreferencesState({
    ...readPreferencesState(),
    workspace: defaultWorkspacePreferences,
    notifications: clone(defaultNotificationPreferences),
    agentMemory: {
      status: "active",
      clearCount: currentAgentMemoryState().clearCount || 0,
      storageKey: agentMemoryStorageKey,
      resetAt: new Date().toISOString(),
    },
    savedAt: new Date().toISOString(),
  });
  renderAgentMemoryState();
  setDirty(false);
}

function bindPreferenceControls() {
  document.addEventListener("change", (event) => {
    if (event.target.closest("[data-pref-control]")) setDirty(true);
  });

  document.addEventListener("click", (event) => {
    const choice = event.target.closest(".choice-stack button");
    if (choice) {
      choice.parentElement.querySelectorAll("button").forEach((button) => button.classList.remove("selected"));
      choice.classList.add("selected");
      setDirty(true);
      return;
    }

    if (event.target.closest("[data-save-preferences]")) {
      savePreferences();
      return;
    }

    if (event.target.closest("[data-reset-preferences]")) {
      resetPreferences();
      return;
    }

    if (event.target.closest("[data-clear-agent-memory]")) {
      const confirm = document.querySelector("[data-agent-memory-confirm]");
      if (confirm) confirm.hidden = false;
      return;
    }

    if (event.target.closest("[data-cancel-clear-agent-memory]")) {
      const confirm = document.querySelector("[data-agent-memory-confirm]");
      if (confirm) confirm.hidden = true;
      return;
    }

    if (event.target.closest("[data-confirm-clear-agent-memory]")) {
      persistAgentMemoryCleared();
    }
  });
}

function init() {
  renderIcons();
  defaultWorkspacePreferences = currentWorkspacePreferences();
  const savedState = readPreferencesState();
  applyWorkspacePreferences(savedState.workspace || {});
  applyNotificationPreferences(savedState.notifications || defaultNotificationPreferences);
  renderAgentMemoryState();
  bindSectionNavigation();
  bindPreferenceControls();
  applyHashSection();
  window.addEventListener("hashchange", applyHashSection);
  setDirty(false);
}

init();
