const hubIcons = {
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  scholarship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z"/></svg>',
  city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h5A4.5 4.5 0 0 1 19 8.5v2A4.5 4.5 0 0 1 14.5 15H11l-4 4v-4.5A4.5 4.5 0 0 1 5 10.5Z"/><path d="m17 3 .7 1.5L19 5l-1.3.5L17 7l-.7-1.5L15 5l1.3-.5Z"/></svg>',
};

const routes = [
  {
    program: "Computer Science MSc",
    university: "Zhejiang University",
    city: "Hangzhou",
    deadline: "Oct 15",
    tuition: "RMB 42k",
    status: "Review",
    signal: "Scholarship",
    compared: true,
  },
  {
    program: "International Trade MSc",
    university: "UIBE",
    city: "Beijing",
    deadline: "Nov 10",
    tuition: "RMB 36k",
    status: "Strong",
    signal: "5 docs",
    compared: false,
  },
  {
    program: "Software Engineering MSc",
    university: "Nanjing University",
    city: "Nanjing",
    deadline: "Dec 20",
    tuition: "RMB 39k",
    status: "Ready",
    signal: "English",
    compared: false,
  },
];

const documents = [
  { label: "Passport", detail: "Ready for profile", status: "Ready", checked: true },
  { label: "Transcript", detail: "Needs translation", status: "Translate", checked: false },
  { label: "IELTS / waiver", detail: "English route", status: "Review", checked: false },
  { label: "Study plan", detail: "Scholarship route", status: "Missing", checked: false },
];

document.querySelectorAll("[data-hub-icon]").forEach((target) => {
  target.innerHTML = hubIcons[target.dataset.hubIcon] || "";
});

function renderRoutes() {
  const list = document.querySelector("[data-route-list]");
  if (!list) return;
  list.innerHTML = routes
    .map(
      (route, index) => `
        <article class="route-card">
          <span class="route-badge">${route.city.slice(0, 2).toUpperCase()}</span>
          <div>
            <h3>${route.program}</h3>
            <p>${route.university} · ${route.city}</p>
            <div class="route-meta">
              <span>${route.deadline}</span>
              <span>${route.tuition}</span>
              <span>${route.status}</span>
              <span>${route.signal}</span>
            </div>
          </div>
          <div class="route-actions">
            <button type="button" class="${route.compared ? "active" : ""}" data-compare="${index}">${route.compared ? "Compared" : "Compare"}</button>
            <a href="programs.html">Open details</a>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderDocuments() {
  const list = document.querySelector("[data-document-list]");
  if (!list) return;
  list.innerHTML = documents
    .map(
      (doc, index) => `
        <label class="document-item">
          <input type="checkbox" ${doc.checked ? "checked" : ""} data-document="${index}" />
          <span><strong>${doc.label}</strong><span>${doc.detail}</span></span>
          <em class="status ${doc.checked ? "ready" : ""}">${doc.status}</em>
        </label>
      `,
    )
    .join("");
}

function updateSnapshot() {
  const compared = routes.filter((route) => route.compared).length;
  const missing = documents.filter((doc) => !doc.checked).length;
  const readiness = Math.round(((documents.length - missing) / documents.length) * 54 + 28);
  document.querySelector('[data-count="compared"]').textContent = compared;
  document.querySelector('[data-count="documents"]').textContent = missing;
  document.querySelectorAll("[data-readiness-label]").forEach((item) => {
    item.textContent = `${readiness}%`;
  });
  document.querySelectorAll("[data-readiness-bar]").forEach((item) => {
    item.style.width = `${readiness}%`;
  });
}

function showHubAgentNotice(message) {
  let notice = document.querySelector("[data-hub-agent-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "hub-agent-notice";
    notice.dataset.hubAgentNotice = "";
    document.querySelector(".hub-overview")?.prepend(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function openAgentWithPrompt(prompt) {
  const input = document.querySelector("[data-cuac-agent-input]");
  const form = document.querySelector("[data-cuac-agent-form]");
  if (!input || !form) return;
  input.value = prompt;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.requestSubmit();
}

function captureHubState() {
  return {
    routes: routes.map((route) => ({ ...route })),
    documents: documents.map((doc) => ({ ...doc })),
    notice: document.querySelector("[data-hub-agent-notice]")?.textContent || "",
  };
}

function restoreHubState(snapshot) {
  if (!snapshot) return;
  routes.splice(0, routes.length, ...(snapshot.routes || []).map((route) => ({ ...route })));
  documents.splice(0, documents.length, ...(snapshot.documents || []).map((doc) => ({ ...doc })));
  renderRoutes();
  renderDocuments();
  updateSnapshot();
  const notice = document.querySelector("[data-hub-agent-notice]");
  if (notice) {
    notice.textContent = snapshot.notice;
    notice.classList.toggle("visible", Boolean(snapshot.notice));
  }
}

function applyHubAgentAction(action, detail = {}) {
  const before = captureHubState();
  if (action === "compare-routes") {
    routes.forEach((route) => {
      route.compared = true;
    });
    renderRoutes();
    updateSnapshot();
    showHubAgentNotice("Agent compared all saved routes and updated your snapshot.");
    document.querySelector("#shortlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-checklist") {
    documents.forEach((doc) => {
      doc.checked = doc.label === "Passport" || doc.label === "Transcript";
      doc.status = doc.checked ? "Ready" : doc.status;
    });
    renderDocuments();
    updateSnapshot();
    showHubAgentNotice("Agent prepared a document checklist and marked the shared items first.");
    document.querySelector("#documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "confirm-choice-order" || action === "open-choice-modal") {
    window.location.href = "application.html";
    return true;
  }
  if (action === "save-program-shortlist" || action === "apply-smart-filters") {
    showHubAgentNotice("Agent refreshed your saved-route workspace from current CUAC demo data.");
    routes[0].compared = true;
    routes[2].compared = true;
    renderRoutes();
    updateSnapshot();
    detail.setUndo?.(before);
    return true;
  }
  return false;
}

document.addEventListener("click", (event) => {
  const compare = event.target.closest("[data-compare]");
  if (compare) {
    const index = Number(compare.dataset.compare);
    routes[index].compared = !routes[index].compared;
    renderRoutes();
    updateSnapshot();
  }

  const agent = event.target.closest("[data-agent-prompt]");
  if (agent) openAgentWithPrompt(agent.dataset.agentPrompt);

  const dismiss = event.target.closest("[data-dismiss-alert]");
  if (dismiss) dismiss.closest(".cycle-alert").hidden = true;

  const scroll = event.target.closest("[data-scroll-feed]");
  if (scroll) {
    const row = document.querySelector("[data-feed-row]");
    row?.scrollBy({ left: Number(scroll.dataset.scrollFeed) * 340, behavior: "smooth" });
  }
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-document]");
  if (!checkbox) return;
  const index = Number(checkbox.dataset.document);
  documents[index].checked = checkbox.checked;
  documents[index].status = checkbox.checked ? "Ready" : documents[index].status === "Ready" ? "Needs review" : documents[index].status;
  renderDocuments();
  updateSnapshot();
});

document.addEventListener("cuac:agent-action", (event) => {
  if (applyHubAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
});

document.addEventListener("cuac:agent-undo", (event) => {
  if (!event.detail?.undo) return;
  restoreHubState(event.detail.undo);
  event.preventDefault();
});

document.querySelectorAll(".hub-tabs a").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".hub-tabs a").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
  });
});

renderRoutes();
renderDocuments();
updateSnapshot();
