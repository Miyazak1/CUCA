const favIcons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20Z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>',
  program: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
  university: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V9l7-4 7 4v12"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>',
  scholarship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.6c0 5.7-8.5 10.4-8.5 10.4S3.5 14.3 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>',
};

const dataClient = window.CuacDataClient;
const savedSummary = dataClient?.getSavedItemsSummary?.() || {};
const savedItems = (savedSummary.items || []).map((item) => ({ ...item }));
const collections = (savedSummary.collections || []).map((collection) => ({ ...collection }));
const routeGroups = (savedSummary.routeGroups || []).map((group) => ({ ...group, points: [...(group.points || [])] }));
const applicationState = dataClient?.readApplicationDemoState?.() || {};
const applicationRoutes = Array.isArray(applicationState.routes) ? applicationState.routes : [];
const maxApplicationChoices = 6;

let activeFilter = "all";
const savedState = new Map(savedItems.map((item) => [item.id, true]));
const compared = new Set();
const addedChoices = new Set([
  ...(savedSummary.addedChoiceIds || []),
  ...savedItems
    .filter((item) => applicationRoutes.some((route) => routeMatchesSavedItem(route, item)))
    .map((item) => item.id),
]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function renderIcons() {
  document.querySelectorAll("[data-fav-icon]").forEach((target) => {
    target.innerHTML = favIcons[target.dataset.favIcon] || "";
  });
}

function statusClass(status) {
  if (status === "risk") return "risk";
  if (status === "warning") return "warning";
  if (status === "good") return "info";
  return "";
}

function statusText(item) {
  if (item.status === "ready") return "Ready";
  if (item.status === "risk") return "Check";
  if (item.status === "warning") return "Review";
  return "Context";
}

function itemActionLabel(item) {
  if (item.type === "program") return "Open program";
  return item.primaryAction || "Open";
}

function itemActionHref(item) {
  if (item.type === "program") return item.href;
  return item.primaryHref || item.href;
}

function itemAccent(item) {
  if (item.status === "ready") return "mint";
  if (item.status === "risk") return "rose";
  if (item.status === "warning") return "amber";
  if (item.type === "university") return "sky";
  if (item.type === "scholarship") return "gold";
  if (item.type === "city") return "jade";
  if (item.type === "guide") return "paper";
  return "mint";
}

function shortMeta(item) {
  return item.meta.split("·").slice(0, 2).join("·").trim();
}

function routeMatchesSavedItem(route = {}, item = {}) {
  if (item.programId && route.programId && String(item.programId) === String(route.programId)) return true;
  if (item.applicationChoice?.programId && route.programId && String(item.applicationChoice.programId) === String(route.programId)) return true;
  return route.university === item.applicationChoice?.university && route.program === (item.applicationChoice?.program || item.title);
}

function choiceRouteFromSavedItem(item = {}) {
  const choice = item.applicationChoice || {};
  const metaParts = String(item.meta || "").split("·").map((part) => part.trim());
  return {
    schoolId: item.schoolId || choice.schoolId || "",
    programId: item.programId || choice.programId || item.entityId || "",
    university: choice.university || metaParts[0] || "School to confirm",
    program: choice.program || item.title || "Selected program",
    programName: choice.programName || item.title || "Selected program",
    degree: choice.degree || item.degreeLevel || "Route",
    city: choice.city || metaParts[1] || "",
    intake: choice.intake || "Fall 2026",
    language: choice.language || item.teachingLanguage || "Teaching language pending",
    tuition: choice.tuition || item.tuitionText || "Tuition pending",
    deadline: choice.deadline || item.deadlineLabel || item.facts?.[0] || "Deadline pending",
    signal: choice.signal || item.routeRole || "Saved route",
    choiceNote: choice.choiceNote || "Added from Favourites.",
  };
}

function persistApplicationChoice(item) {
  const state = dataClient?.readApplicationDemoState?.() || {};
  if (state.submittedToSchools) return { ok: false, reason: "already-sent" };
  const routes = Array.isArray(state.routes) ? [...state.routes] : [];
  const route = choiceRouteFromSavedItem(item);
  const exists = routes.some((entry) => routeMatchesSavedItem(entry, item));
  const nextState = {
    ...state,
    routes: exists ? routes : [...routes, route],
    submittedToSchools: false,
    submittedRecords: [],
  };
  if (dataClient?.writeApplicationDemoState) dataClient.writeApplicationDemoState(nextState);
  else {
    try {
      localStorage.setItem("cuacApplicationDemoState", JSON.stringify(nextState));
    } catch {
      // Demo storage can be unavailable in restricted preview contexts.
    }
  }
  return { ok: true, exists, route };
}

function savedItemDataAttributes(item) {
  const entityType = item.entityType || (item.type === "program" ? "Program" : item.type);
  const entityId = item.entityId || item.programId || item.schoolId || item.id;
  const sourceModel = item.sourceModel || item.sourceFieldLineage?.sourceModel || "";
  return [
    `data-saved-item="${escapeHtml(item.id)}"`,
    `data-entity-type="${escapeHtml(entityType)}"`,
    `data-entity-id="${escapeHtml(entityId)}"`,
    `data-source-model="${escapeHtml(sourceModel)}"`,
    `data-school-id="${escapeHtml(item.schoolId || "")}"`,
    `data-program-id="${escapeHtml(item.programId || "")}"`,
  ].join(" ");
}

function getActiveItems() {
  return savedItems.filter((item) => savedState.get(item.id));
}

function updateSummary() {
  const active = getActiveItems();
  const programs = active.filter((item) => item.type === "program");
  const ready = programs.filter((item) => item.status === "ready").length;
  const contextCount = active.filter((item) => item.type !== "program").length;
  const deadlines = active.filter((item) => item.facts.some((fact) => /Sep|Oct/.test(fact))).length;
  const setText = (key, value) => {
    const node = document.querySelector(`[data-summary="${key}"]`);
    if (node) node.textContent = value;
  };
  setText("routes", programs.length);
  setText("ready", ready);
  setText("context", contextCount);
  setText("deadlines", deadlines);
  setText("shortlist", addedChoices.size);
  setText("all", active.length);
  const programCount = document.querySelector("[data-program-count]");
  if (programCount) programCount.textContent = `${programs.length} saved ${programs.length === 1 ? "program" : "programs"}`;
  const applicationCount = document.querySelector("[data-application-count]");
  if (applicationCount) applicationCount.textContent = `${addedChoices.size} ${addedChoices.size === 1 ? "choice" : "choices"} added`;
  const health = programs.length ? Math.round((ready / programs.length) * 100) : 0;
  const healthLabel = document.querySelector(".health-meter strong");
  const healthBar = document.querySelector("[data-health-bar]");
  if (healthLabel) healthLabel.textContent = `${ready}/${programs.length}`;
  if (healthBar) healthBar.style.width = `${health}%`;
}

function renderShortlist() {
  const programs = getActiveItems().filter((item) => item.type === "program");
  const selectedPrograms = programs.filter((item) => addedChoices.has(item.id));
  const candidatePrograms = programs.filter((item) => !addedChoices.has(item.id));
  const featuredTarget = document.querySelector("[data-featured-route]");
  const setShell = document.querySelector("[data-application-set]");
  const setTarget = document.querySelector("[data-application-set-list]");
  const listTarget = document.querySelector("[data-shortlist-list]");
  if (!listTarget) return;
  if (featuredTarget) featuredTarget.innerHTML = "";
  if (setShell) setShell.classList.toggle("has-choices", selectedPrograms.length > 0);
  if (setTarget) {
    setTarget.innerHTML = selectedPrograms.length
      ? selectedPrograms
      .map((item, index) => `
        <article class="application-choice type-${escapeHtml(item.type)} tone-${itemAccent(item)}" ${savedItemDataAttributes(item)}>
          <span class="choice-number">${index + 1}</span>
          <div>
            <h5>${escapeHtml(item.title)}</h5>
            <p>${escapeHtml(shortMeta(item))}</p>
          </div>
          <a href="application.html">Review</a>
        </article>
      `)
      .join("")
      : '<div class="application-empty-note">No application choices yet.</div>';
  }
  listTarget.innerHTML = candidatePrograms.length
    ? candidatePrograms
    .map((item) => `
      <article class="shortlist-row type-${escapeHtml(item.type)} tone-${itemAccent(item)}" ${savedItemDataAttributes(item)}>
        <div class="choice-index">
          <span>${escapeHtml(item.routeRole || "Saved")}</span>
        </div>
        <div class="choice-main">
          <div class="choice-title-line">
            <h3>${escapeHtml(item.title)}</h3>
          </div>
          <p>${escapeHtml(item.meta)}</p>
          <div class="route-facts">${item.facts.slice(0, 4).map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
        </div>
        <div class="choice-status">
          <span class="status-pill ${statusClass(item.status)}">${statusText(item)}</span>
        </div>
        <div class="row-actions">
          <button class="primary-route-action" type="button" data-add-choice="${escapeHtml(item.id)}">Add choice</button>
          <a href="${escapeHtml(item.href)}">Open program</a>
        </div>
      </article>
    `)
    .join("")
    : '<div class="shortlist-empty-note">All saved programs are in your application set.</div>';
  renderIcons();
}

function renderCollections() {
  const target = document.querySelector("[data-collection-grid]");
  if (!target) return;
  const active = getActiveItems();
  target.innerHTML = collections
    .filter((collection) => collection.type !== "program")
    .map((collection) => {
      const count = active.filter((item) => item.type === collection.type).length;
      const href = "#saved-items";
      const action = `View ${collection.title.toLowerCase()}`;
      return `
        <article class="collection-tile collection-${escapeHtml(collection.type)}" data-collection-card="${escapeHtml(collection.type)}">
          <div class="collection-top">
            <span data-fav-icon="${collection.type}"></span>
            <strong>${count}</strong>
          </div>
          <div>
            <h3>${escapeHtml(collection.title)}</h3>
            <p>${escapeHtml(collection.purpose)}</p>
          </div>
          <a href="${escapeHtml(href)}" data-collection-filter="${escapeHtml(collection.type)}">${escapeHtml(action)}</a>
        </article>
      `;
    })
    .join("");
  renderIcons();
}

function renderSavedGrid() {
  const grid = document.querySelector("[data-saved-grid]");
  const context = document.querySelector("[data-saved-context]");
  const empty = document.querySelector("[data-empty-state]");
  if (!grid || !empty) return;
  const active = getActiveItems();
  const referenceItems = active.filter((item) => item.type !== "program");
  const items = referenceItems.filter((item) => activeFilter === "all" || item.type === activeFilter);
  const programItems = items.filter((item) => item.type === "program");
  const contextItems = items.filter((item) => item.type !== "program");
  const cardItems = [];
  const rowItems = activeFilter === "program" ? [] : contextItems;
  grid.classList.toggle("compact-grid", activeFilter !== "all");
  grid.innerHTML = cardItems
    .map((item) => {
      const canApply = item.type === "program";
      return `
        <article class="saved-item fav-program-card type-${escapeHtml(item.type)} tone-${itemAccent(item)}" ${savedItemDataAttributes(item)}>
          <div class="saved-visual">
            <span class="saved-type">${escapeHtml(item.routeRole || item.type)}</span>
            <button class="save-toggle" type="button" data-save-toggle="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.title)} from favourites">${favIcons.heart}</button>
            <div class="visual-main">
              <span class="status-pill ${statusClass(item.status)}">${statusText(item)}</span>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
          </div>
          <div class="saved-card-body">
            <p>${escapeHtml(shortMeta(item))}</p>
            <div class="saved-facts">${item.facts.slice(0, 3).map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
          </div>
          <div class="saved-actions">
              ${canApply ? `<button type="button" data-add-choice="${escapeHtml(item.id)}">${addedChoices.has(item.id) ? "In application set" : "Add choice"}</button>` : ""}
              ${canApply && addedChoices.has(item.id) ? '<a href="application.html">Open application</a>' : ""}
              <button type="button" data-compare="${escapeHtml(item.id)}" class="${compared.has(item.id) ? "selected" : ""}">${compared.has(item.id) ? "Compared" : "Compare"}</button>
              <a href="${escapeHtml(itemActionHref(item))}">${escapeHtml(itemActionLabel(item))}</a>
          </div>
        </article>
      `;
    })
    .join("");
  if (context) {
    context.hidden = !rowItems.length;
    context.innerHTML = rowItems.length
      ? `
        <div class="context-head">
          <div>
            <span class="module-kicker">References</span>
            <h3>Schools, funding, cities, guides</h3>
          </div>
          <a href="programs.html">Find programs</a>
        </div>
        <div class="context-list">
          ${rowItems.map((item) => `
            <article class="context-row context-card type-${escapeHtml(item.type)} tone-${itemAccent(item)}" ${savedItemDataAttributes(item)}>
              <div class="context-card-top">
                <span class="context-icon" data-fav-icon="${escapeHtml(item.type)}"></span>
                <button class="save-toggle" type="button" data-save-toggle="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.title)} from favourites">${favIcons.heart}</button>
              </div>
              <div class="context-copy">
                <span class="saved-type">${escapeHtml(item.type)}</span>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(shortMeta(item))}</p>
                <div class="saved-facts">${item.facts.slice(0, 2).map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
              </div>
              <div class="context-actions">
                <span class="status-pill ${statusClass(item.status)}">${statusText(item)}</span>
                <a href="${escapeHtml(itemActionHref(item))}">${escapeHtml(itemActionLabel(item))}</a>
              </div>
            </article>
          `).join("")}
        </div>
      `
      : "";
    renderIcons();
  }
  empty.classList.toggle("visible", items.length === 0);
}

function renderCompareTray() {
  const target = document.querySelector("[data-compare-tray]");
  if (!target) return;
  const selected = Array.from(compared)
    .map((id) => savedItems.find((item) => item.id === id && savedState.get(id)))
    .filter(Boolean);
  if (!selected.length) {
    target.innerHTML = "";
    target.classList.remove("visible");
    return;
  }
  const programCount = selected.filter((item) => item.type === "program").length;
  const warningCount = selected.filter((item) => item.status === "warning" || item.status === "risk").length;
  target.classList.add("visible");
  target.innerHTML = `
    <div class="compare-copy">
      <span class="module-kicker">Comparing ${selected.length} saved ${selected.length === 1 ? "item" : "items"}</span>
      <strong>${programCount || "No"} ${programCount === 1 ? "route" : "routes"} selected</strong>
      <p>${warningCount ? `${warningCount} need checks.` : "Looks low-risk."}</p>
    </div>
    <div class="compare-items">
      ${selected.map((item) => `<a href="${escapeHtml(itemActionHref(item))}"><span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong></a>`).join("")}
    </div>
    <div class="compare-actions">
      <a href="application.html">Open application</a>
      <button type="button" data-clear-compare>Clear</button>
    </div>
  `;
}

function renderRouteGroups() {
  const target = document.querySelector("[data-route-groups]");
  if (!target) return;
  target.innerHTML = routeGroups
    .map((group) => `
      <article class="route-group">
        <span class="tag">${escapeHtml(group.role)}</span>
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.points?.[0] || group.body.split(".")[0])}</p>
        </div>
        <div class="route-actions">
          <a href="${escapeHtml(group.href)}">${escapeHtml(group.action)}</a>
        </div>
      </article>
    `)
    .join("");
}

function setActiveFilter(nextFilter, focus = false) {
  activeFilter = nextFilter || "all";
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const active = button.dataset.filter === activeFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    if (active && focus) button.focus();
  });
  renderSavedGrid();
}

function renderAll() {
  updateSummary();
  renderShortlist();
  renderCollections();
  renderCompareTray();
  renderSavedGrid();
  renderRouteGroups();
  window.CUAC?.reveal?.();
}

function showNote(message) {
  const note = document.querySelector("[data-agent-page-note]");
  if (!note) return;
  note.textContent = message;
  note.classList.add("visible");
}

function showUndoSave(item) {
  const note = document.querySelector("[data-agent-page-note]");
  if (!note) return;
  note.innerHTML = `
    <span>${escapeHtml(item.title)} removed from Favourites.</span>
    <button type="button" data-undo-save="${escapeHtml(item.id)}">Undo</button>
  `;
  note.classList.add("visible");
}

function toggleCompare(id) {
  if (compared.has(id)) {
    compared.delete(id);
  } else {
    if (compared.size >= 3) {
    showNote("Compare up to 3 items.");
      return;
    }
    compared.add(id);
  }
  renderAll();
}

function addChoice(id) {
  const item = savedItems.find((entry) => entry.id === id);
  if (!item || item.type !== "program") {
    showNote("Choose a program first.");
    return;
  }
  if (addedChoices.has(id)) {
    showNote("Already in your application set.");
    return;
  }
  if (addedChoices.size >= maxApplicationChoices) {
    showNote(`You can add up to ${maxApplicationChoices} programs.`);
    return;
  }
  const result = persistApplicationChoice(item);
  if (!result.ok && result.reason === "already-sent") {
    showNote("Already sent. Open Application to review.");
    return;
  }
  addedChoices.add(id);
  showNote(`${item.title} added.`);
  renderAll();
}

document.addEventListener("click", (event) => {
  const addFavouriteToggle = event.target.closest("[data-add-favourite-toggle]");
  if (addFavouriteToggle) {
    const options = document.querySelector("[data-add-favourite-options]");
    const expanded = addFavouriteToggle.getAttribute("aria-expanded") === "true";
    addFavouriteToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    if (options) options.hidden = expanded;
    event.preventDefault();
    return;
  }

  if (!event.target.closest("[data-add-favourite-options], [data-add-favourite-toggle]")) {
    const trigger = document.querySelector("[data-add-favourite-toggle]");
    const options = document.querySelector("[data-add-favourite-options]");
    if (trigger && options && !options.hidden) {
      trigger.setAttribute("aria-expanded", "false");
      options.hidden = true;
    }
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    setActiveFilter(filter.dataset.filter || "all");
  }

  const save = event.target.closest("[data-save-toggle]");
  if (save) {
    const item = savedItems.find((entry) => entry.id === save.dataset.saveToggle);
    if (!item) return;
    savedState.set(item.id, false);
    renderAll();
    showUndoSave(item);
  }

  const undoSave = event.target.closest("[data-undo-save]");
  if (undoSave) {
    const item = savedItems.find((entry) => entry.id === undoSave.dataset.undoSave);
    if (!item) return;
    savedState.set(item.id, true);
    renderAll();
    showNote(`${item.title} restored.`);
  }

  const compare = event.target.closest("[data-compare]");
  if (compare) toggleCompare(compare.dataset.compare);

  const clearCompare = event.target.closest("[data-clear-compare]");
  if (clearCompare) {
    compared.clear();
    showNote("Comparison cleared.");
    renderAll();
  }

  const collectionFilter = event.target.closest("[data-collection-filter], [data-collection-card]");
  if (collectionFilter) {
    const type = collectionFilter.dataset.collectionFilter || collectionFilter.dataset.collectionCard || "all";
    event.preventDefault();
    if (type === "program") {
      document.querySelector("#shortlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setActiveFilter(type);
      document.querySelector("#saved-items")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const choice = event.target.closest("[data-add-choice]");
  if (choice) addChoice(choice.dataset.addChoice);
});

document.addEventListener("keydown", (event) => {
  const current = event.target.closest("[data-filter]");
  if (!current || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(document.querySelectorAll("[data-filter]"));
  const index = tabs.indexOf(current);
  if (index < 0) return;
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
  setActiveFilter(tabs[nextIndex].dataset.filter || "all", true);
});

document.addEventListener("cuac:agent-action", (event) => {
  const action = event.detail?.action || "";
  if (action === "compare-routes") {
    compared.clear();
    ["zju-cs", "nju-se", "uibe-trade"].forEach((id) => compared.add(id));
    showNote("Three routes selected.");
    event.preventDefault();
    renderAll();
  }
  if (action === "save-checklist") {
    showNote("Checklist saved.");
    event.preventDefault();
  }
});

renderIcons();
renderAll();
