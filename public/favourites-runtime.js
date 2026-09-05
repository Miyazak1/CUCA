const savedTypeLabels = {
  program: "Program",
  school: "University",
  scholarship: "Scholarship",
  city: "City",
};

const savedState = {
  items: [],
  filter: "all",
  busyIds: new Set(),
};

class SavedRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "SavedRequestError";
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

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SavedRequestError(
      payload?.error?.message || "The saved-item request could not be completed.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new SavedRequestError("The saved-item response is missing its data envelope.", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

function validCatalogItem(value, entityId) {
  return isRecord(value)
    && value.id === entityId
    && typeof value.slug === "string"
    && typeof value.nameEn === "string"
    && typeof value.status === "string"
    && typeof value.sourceStatus === "string";
}

function normalizeSavedItem(value) {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || !Object.prototype.hasOwnProperty.call(savedTypeLabels, value.entityType)
    || typeof value.entityId !== "string"
    || !(value.notes === null || typeof value.notes === "string")
    || typeof value.createdAt !== "string") return null;
  return {
    id: value.id,
    entityType: value.entityType,
    entityId: value.entityId,
    notes: value.notes,
    createdAt: value.createdAt,
    catalogItem: validCatalogItem(value.catalogItem, value.entityId) ? value.catalogItem : null,
  };
}

function detailHref(item) {
  const catalog = item.catalogItem;
  if (!catalog || catalog.status !== "active") return "";
  if (item.entityType === "program") return `program-detail.html?program=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === "school") return `university-detail.html?university=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === "scholarship") return `scholarship-detail.html?scholarship=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === "city") return `city-detail.html?city=${encodeURIComponent(catalog.slug)}`;
  return "";
}

function formatDate(value, fallback = "Not recorded") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function sourceLabel(value) {
  return String(value || "unknown").replaceAll("_", " ");
}

function visibleItems() {
  return savedState.filter === "all" ? savedState.items : savedState.items.filter(item => item.entityType === savedState.filter);
}

function renderSummary() {
  const target = document.querySelector("[data-saved-summary]");
  if (!target) return;
  const visible = visibleItems().length;
  const total = savedState.items.length;
  target.textContent = savedState.filter === "all"
    ? `${total} saved ${total === 1 ? "item" : "items"}`
    : `${visible} of ${total} saved items`;
}

function renderEmpty(title, copy, retry = false) {
  const root = document.querySelector("[data-saved-view]");
  if (!root) return;
  root.innerHTML = `<section class="saved-empty">
    <p class="saved-kicker">Saved research</p>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(copy)}</p>
    <div class="saved-empty-actions">
      <a class="saved-primary-action" href="programs.html">Browse programs</a>
      ${retry ? '<button class="saved-secondary-action" type="button" data-retry-saved>Retry</button>' : ""}
    </div>
  </section>`;
}

function renderItem(item) {
  const catalog = item.catalogItem;
  const href = detailHref(item);
  const busy = savedState.busyIds.has(item.id);
  const title = catalog?.nameEn || "Catalog record unavailable";
  const nameZh = catalog?.nameZh ? `<span lang="zh">${escapeHtml(catalog.nameZh)}</span>` : "";
  const sourceStatus = catalog?.sourceStatus || "unknown";
  const unavailable = !catalog || catalog.status !== "active";
  return `<li class="saved-item" data-saved-id="${escapeHtml(item.id)}">
    <div class="saved-item-main">
      <div class="saved-item-topline">
        <span class="saved-type">${escapeHtml(savedTypeLabels[item.entityType])}</span>
        <span class="saved-source-status ${sourceStatus === "verified" ? "is-verified" : ""}">${escapeHtml(sourceLabel(sourceStatus))}</span>
      </div>
      <h2>${escapeHtml(title)}${nameZh}</h2>
      <p class="saved-item-meta">
        <span>Saved ${escapeHtml(formatDate(item.createdAt))}</span>
        <span>${catalog?.lastVerifiedAt ? `Verified ${escapeHtml(formatDate(catalog.lastVerifiedAt))}` : "Verification date not recorded"}</span>
      </p>
      ${unavailable ? '<p class="saved-unavailable">This saved catalog record is not currently published. Its identifier and your private note remain available.</p>' : ""}
      <div class="saved-item-actions">
        ${href ? `<a class="saved-item-link" href="${escapeHtml(href)}">Open detail</a>` : ""}
        <button class="saved-text-button" type="button" data-remove-saved="${escapeHtml(item.id)}" ${busy ? "disabled" : ""}>Remove</button>
      </div>
    </div>
    <form class="saved-note" data-note-form="${escapeHtml(item.id)}">
      <label for="saved-note-${escapeHtml(item.id)}">Private note</label>
      <textarea id="saved-note-${escapeHtml(item.id)}" name="notes" maxlength="2000" placeholder="Add a decision note">${escapeHtml(item.notes || "")}</textarea>
      <div class="saved-note-footer">
        <span>Only your student account can read this note.</span>
        <button class="saved-secondary-action" type="submit" ${busy ? "disabled" : ""}>Save note</button>
      </div>
    </form>
  </li>`;
}

function renderSavedItems() {
  const root = document.querySelector("[data-saved-view]");
  if (!root) return;
  renderSummary();
  const items = visibleItems();
  if (!items.length) {
    const filtered = savedState.filter !== "all";
    renderEmpty(
      filtered ? `No saved ${savedTypeLabels[savedState.filter].toLowerCase()} items` : "No saved items yet",
      filtered ? "Choose another filter or save a record from its catalog detail page." : "Save a program, university, scholarship, or city from its catalog detail page.",
    );
    return;
  }
  root.innerHTML = `<ol class="saved-list">${items.map(renderItem).join("")}</ol>`;
}

let savedToastTimer;
function showSavedToast(message) {
  const toast = document.querySelector("[data-saved-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(savedToastTimer);
  savedToastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

async function requireStudent(error, resumeHref = "favourites-api.html") {
  if (![401, 403].includes(error?.status)) return false;
  const auth = await window.CUAC?.authReady?.();
  if (auth?.authState !== "signed-out") return false;
  window.CUAC?.requireSignedIn?.("view your saved items", {
    requiredRole: "student",
    resumeAction: { type: "navigate", href: resumeHref },
  });
  return true;
}

async function loadSavedItems() {
  const root = document.querySelector("[data-saved-view]");
  if (root) root.innerHTML = '<p class="saved-loading" aria-busy="true">Loading your saved catalog records.</p>';
  try {
    const data = await requestJson("/api/v1/student/saved-items");
    if (!Array.isArray(data)) throw new SavedRequestError("The saved-item response was not a list.", 200, "INVALID_RESPONSE");
    savedState.items = data.map(normalizeSavedItem).filter(Boolean);
    renderSavedItems();
  } catch (error) {
    if (await requireStudent(error)) return;
    renderEmpty("Saved items could not be loaded", error?.message || "The saved-item service is unavailable.", true);
  }
}

async function saveNote(form) {
  const item = savedState.items.find(entry => entry.id === form.dataset.noteForm);
  if (!item || savedState.busyIds.has(item.id)) return;
  const note = new FormData(form).get("notes");
  const notes = typeof note === "string" && note.trim() ? note.trim() : null;
  savedState.busyIds.add(item.id);
  renderSavedItems();
  try {
    const updated = await requestJson("/api/v1/student/saved-items", {
      method: "POST",
      body: JSON.stringify({ entityType: item.entityType, entityId: item.entityId, notes }),
    });
    if (!isRecord(updated) || updated.id !== item.id || updated.entityId !== item.entityId) {
      throw new SavedRequestError("The saved note response did not match this item.", 200, "INVALID_RESPONSE");
    }
    item.notes = updated.notes;
    showSavedToast("Private note saved.");
  } catch (error) {
    if (!(await requireStudent(error))) showSavedToast(error?.message || "The private note was not saved.");
  } finally {
    savedState.busyIds.delete(item.id);
    renderSavedItems();
  }
}

async function removeSavedItem(savedItemId) {
  const item = savedState.items.find(entry => entry.id === savedItemId);
  if (!item || savedState.busyIds.has(savedItemId)) return;
  savedState.busyIds.add(savedItemId);
  renderSavedItems();
  try {
    const removed = await requestJson(`/api/v1/student/saved-items/${encodeURIComponent(savedItemId)}`, { method: "DELETE" });
    if (!isRecord(removed) || removed.id !== savedItemId || removed.entityId !== item.entityId) {
      throw new SavedRequestError("The removal response did not match this saved item.", 200, "INVALID_RESPONSE");
    }
    savedState.items = savedState.items.filter(entry => entry.id !== savedItemId);
    showSavedToast("Removed from saved items.");
  } catch (error) {
    savedState.busyIds.delete(savedItemId);
    if (!(await requireStudent(error))) showSavedToast(error?.message || "The saved item was not removed.");
  } finally {
    savedState.busyIds.delete(savedItemId);
    renderSavedItems();
  }
}

document.addEventListener("click", event => {
  const filter = event.target.closest("[data-saved-filter]");
  if (filter) {
    savedState.filter = filter.dataset.savedFilter;
    document.querySelectorAll("[data-saved-filter]").forEach(button => {
      const active = button === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderSavedItems();
    return;
  }
  if (event.target.closest("[data-retry-saved]")) {
    void loadSavedItems();
    return;
  }
  const remove = event.target.closest("[data-remove-saved]");
  if (remove) void removeSavedItem(remove.dataset.removeSaved);
});

document.addEventListener("submit", event => {
  if (!event.target.matches("[data-note-form]")) return;
  event.preventDefault();
  void saveNote(event.target);
});

void loadSavedItems();
