const appIcons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/></svg>',
  choice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>',
  funding: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  review: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  university: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V9l7-4 7 4v12"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h5A4.5 4.5 0 0 1 19 8.5v2A4.5 4.5 0 0 1 14.5 15H11l-4 4v-4.5A4.5 4.5 0 0 1 5 10.5Z"/><path d="m17 3 .7 1.5L19 5l-1.3.5L17 7l-.7-1.5L15 5l1.3-.5Z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  education: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 9-10-5L2 9l10 5 10-5Z"/><path d="M6 11.5V16c2.5 2.2 9.5 2.2 12 0v-4.5"/></svg>',
};

const confirmedText = "Confirmed";
let orderConfirmed = false;
let choiceCount = document.querySelectorAll("[data-choice]").length;

const programCatalog = {
  "Zhejiang University": [
    { program: "Computer Science MSc", city: "Hangzhou", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 42k", deadline: "Oct 15", signal: "CSC possible" },
    { program: "Biomedical Engineering MSc", city: "Hangzhou", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 45k", deadline: "Oct 15", signal: "Lab route" },
  ],
  "Nanjing University": [
    { program: "Software Engineering MSc", city: "Nanjing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 39k", deadline: "Dec 20", signal: "Lower cost" },
    { program: "Data Science MSc", city: "Nanjing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 40k", deadline: "Dec 20", signal: "Tech route" },
  ],
  UIBE: [
    { program: "International Trade MSc", city: "Beijing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 36k", deadline: "Nov 10", signal: "Funding-sensitive" },
    { program: "Finance MSc", city: "Beijing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 38k", deadline: "Nov 10", signal: "Business fit" },
  ],
  "Fudan University": [
    { program: "Data Science MSc", city: "Shanghai", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 52k", deadline: "Sep 12", signal: "Selective" },
    { program: "Economics BA", city: "Shanghai", degree: "Undergraduate", intake: "Fall 2026", language: "Chinese-taught", tuition: "RMB 26k", deadline: "Sep 12", signal: "HSK required" },
  ],
  "Tongji University": [
    { program: "Architecture MSc", city: "Shanghai", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 46k", deadline: "Nov 20", signal: "Portfolio" },
    { program: "Civil Engineering MSc", city: "Shanghai", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 39k", deadline: "Nov 20", signal: "Strong route" },
  ],
};

function renderIcons() {
  document.querySelectorAll("[data-app-icon]").forEach((target) => {
    target.innerHTML = appIcons[target.dataset.appIcon] || "";
  });
}

function updateProgress() {
  const checkedSections = Array.from(document.querySelectorAll(".section-card.done")).length;
  const base = orderConfirmed ? 44 : 28;
  const progress = Math.min(88, base + checkedSections * 6);
  document.querySelector("[data-progress-label]").textContent = `${progress}%`;
  document.querySelector("[data-progress-bar]").style.width = `${progress}%`;
}

function confirmChoice() {
  orderConfirmed = true;
  document.querySelector(".draft-card")?.classList.add("confirmed");
  document.querySelector(".choice-panel")?.classList.add("organized");
  document.querySelector("[data-choice-status]").textContent = "Order confirmed";
  document.querySelector("[data-choice-step]").textContent = confirmedText;
  const step = document.querySelector(".progress-strip article.active");
  step?.classList.add("done");
  step?.classList.remove("active");
  document.querySelector(".progress-strip article:nth-child(3)")?.classList.add("active");
  updateProgress();
}

function showPageAction(message) {
  const panel = document.querySelector(".choice-panel");
  if (!panel) return;
  let notice = panel.querySelector("[data-application-action-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "application-action-notice";
    notice.dataset.applicationActionNotice = "";
    panel.prepend(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function setChoiceModal(open) {
  const modal = document.querySelector("[data-choice-modal]");
  if (!modal) return;
  modal.classList.toggle("open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    modal.removeAttribute("inert");
    modal.querySelector("select, input, button")?.focus();
  } else {
    modal.setAttribute("inert", "");
  }
}

function fillChoice(value) {
  const [university, program] = value.split("|");
  const form = document.querySelector("[data-choice-form]");
  if (!form) return;
  form.elements.university.value = university || "";
  renderProgramOptions(university, program);
  syncProgramFields();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function addChoice(form) {
  const list = document.querySelector("[data-choice-list]");
  const selected = getSelectedProgram();
  if (!list || !selected) return;
  const { university, program, city, intake, language, tuition, deadline, signal } = selected;
  const index = choiceCount++;
  const safeUniversity = escapeHtml(university);
  const safeProgram = escapeHtml(program);
  const safeIntake = escapeHtml(intake);
  const safeLanguage = escapeHtml(language);
  list.insertAdjacentHTML(
    "beforeend",
    `
      <article class="choice-route backup" data-choice="${index}">
        <div class="choice-topline">
          <span class="role-pill">To check</span>
          <button type="button" data-agent-prompt="Check whether ${safeUniversity} ${safeProgram} should be added to my China application set">Check</button>
        </div>
        <div>
          <h3>${safeUniversity}</h3>
          <p>${safeProgram} · ${city} · ${safeIntake} · ${safeLanguage}</p>
        </div>
        <div class="choice-route-meta">
          <span>${deadline}</span>
          <span>${tuition}</span>
          <span>${signal}</span>
          <span>Needs source check</span>
        </div>
      </article>
    `,
  );
  document.querySelector("[data-choice-status]").textContent = `${choiceCount} choices`;
  setChoiceModal(false);
}

function markDocumentPlanSaved() {
  document.querySelectorAll(".document-matrix .matrix-cell").forEach((item) => item.classList.add("agent-reviewed"));
  const documentSection = Array.from(document.querySelectorAll(".section-card")).find((card) => card.textContent.includes("Documents"));
  documentSection?.classList.add("done");
  documentSection?.querySelector("[data-section-action]")?.replaceChildren("Checked");
  const docsStep = document.querySelector(".progress-strip article:nth-child(3)");
  docsStep?.classList.add("active", "done");
  showPageAction("Agent drafted a document plan from shared blockers and program-specific requirements.");
  updateProgress();
}

function captureApplicationState() {
  const form = document.querySelector("[data-choice-form]");
  return {
    orderConfirmed,
    choiceStatus: document.querySelector("[data-choice-status]")?.textContent || "",
    choiceStep: document.querySelector("[data-choice-step]")?.textContent || "",
    modalOpen: document.querySelector("[data-choice-modal]")?.classList.contains("open") || false,
    university: form?.elements.university.value || "",
    program: form?.elements.program.value || "",
    notice: document.querySelector("[data-application-action-notice]")?.textContent || "",
    taskHighlighted: document.querySelector(".task-panel")?.classList.contains("agent-highlight") || false,
    reviewedCells: Array.from(document.querySelectorAll(".document-matrix .matrix-cell.agent-reviewed")).map((cell) => Array.from(document.querySelectorAll(".document-matrix .matrix-cell")).indexOf(cell)),
    doneSections: Array.from(document.querySelectorAll(".section-card.done")).map((card) => Array.from(document.querySelectorAll(".section-card")).indexOf(card)),
  };
}

function restoreApplicationState(snapshot) {
  if (!snapshot) return;
  orderConfirmed = snapshot.orderConfirmed;
  document.querySelector(".draft-card")?.classList.toggle("confirmed", orderConfirmed);
  document.querySelector(".choice-panel")?.classList.toggle("organized", orderConfirmed);
  if (document.querySelector("[data-choice-status]")) document.querySelector("[data-choice-status]").textContent = snapshot.choiceStatus;
  if (document.querySelector("[data-choice-step]")) document.querySelector("[data-choice-step]").textContent = snapshot.choiceStep;
  fillChoice(`${snapshot.university}|${snapshot.program}`);
  setChoiceModal(snapshot.modalOpen);
  const notice = document.querySelector("[data-application-action-notice]");
  if (notice) {
    notice.textContent = snapshot.notice;
    notice.classList.toggle("visible", Boolean(snapshot.notice));
  }
  document.querySelector(".task-panel")?.classList.toggle("agent-highlight", snapshot.taskHighlighted);
  const cells = Array.from(document.querySelectorAll(".document-matrix .matrix-cell"));
  cells.forEach((cell, index) => cell.classList.toggle("agent-reviewed", snapshot.reviewedCells.includes(index)));
  const sections = Array.from(document.querySelectorAll(".section-card"));
  sections.forEach((card, index) => card.classList.toggle("done", snapshot.doneSections.includes(index)));
  updateProgress();
}

function handleAgentAction(action, detail = {}) {
  const before = captureApplicationState();
  if (action === "confirm-choice-order") {
    confirmChoice();
    showPageAction("Agent confirmed the current order: main route, safer backup, funding-sensitive option.");
    detail.setUndo?.(before);
    return true;
  }
  if (action === "open-choice-modal") {
    setChoiceModal(true);
    detail.setUndo?.(before);
    return true;
  }
  if (action === "prefill-choice") {
    fillChoice("Nanjing University|Software Engineering MSc");
    setChoiceModal(true);
    showPageAction("Agent prefilled a lower-cost backup choice for review.");
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-checklist") {
    markDocumentPlanSaved();
    detail.setUndo?.(before);
    return true;
  }
  if (action === "compare-routes" || action === "compare-funding") {
    document.querySelector(".task-panel")?.classList.add("agent-highlight");
    showPageAction("Agent comparison is highlighted in the recommendation panel.");
    detail.setUndo?.(before);
    return true;
  }
  return false;
}

function getSelectedProgram() {
  const form = document.querySelector("[data-choice-form]");
  if (!form) return null;
  const university = form.elements.university.value;
  const program = form.elements.program.value;
  const item = programCatalog[university]?.find((entry) => entry.program === program);
  return item ? { university, ...item } : null;
}

function renderProgramOptions(university, selectedProgram) {
  const programSelect = document.querySelector("[data-program-select]");
  if (!programSelect) return;
  const programs = programCatalog[university] || [];
  programSelect.innerHTML = programs.map((entry) => `<option>${entry.program}</option>`).join("");
  if (selectedProgram && programs.some((entry) => entry.program === selectedProgram)) {
    programSelect.value = selectedProgram;
  }
}

function syncProgramFields() {
  const selected = getSelectedProgram();
  const form = document.querySelector("[data-choice-form]");
  const preview = document.querySelector("[data-program-preview]");
  if (!selected || !form || !preview) return;
  form.elements.intake.value = selected.intake;
  form.elements.language.value = selected.language;
  preview.innerHTML = `
    <strong>${selected.university} · ${selected.program}</strong>
    <p>${selected.degree} route in ${selected.city}. Add this exact program to the application set.</p>
    <div>
      <span>${selected.deadline}</span>
      <span>${selected.tuition}</span>
      <span>${selected.language}</span>
      <span>${selected.signal}</span>
    </div>
  `;
}

function openAgentWithPrompt(prompt) {
  const input = document.querySelector("[data-cuac-agent-input]");
  const form = document.querySelector("[data-cuac-agent-form]");
  if (!input || !form) return;
  input.value = prompt;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.requestSubmit();
}

document.addEventListener("click", (event) => {
  const confirm = event.target.closest("[data-confirm-choice]");
  if (confirm) {
    confirmChoice();
  }

  const openModal = event.target.closest("[data-open-choice-modal]");
  if (openModal) setChoiceModal(true);

  const closeModal = event.target.closest("[data-close-choice-modal]");
  if (closeModal) setChoiceModal(false);

  const fill = event.target.closest("[data-fill-choice]");
  if (fill) fillChoice(fill.dataset.fillChoice);

  const sectionAction = event.target.closest("[data-section-action]");
  if (sectionAction) {
    const card = sectionAction.closest(".section-card");
    card?.classList.toggle("done");
    sectionAction.textContent = card?.classList.contains("done") ? "Checked" : "Start";
    updateProgress();
  }

  const agent = event.target.closest("[data-agent-prompt]");
  if (agent) {
    if (agent.closest("[data-choice-modal]")) setChoiceModal(false);
    openAgentWithPrompt(agent.dataset.agentPrompt);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-choice-form]");
  if (!form) return;
  event.preventDefault();
  addChoice(form);
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-university-select]")) {
    renderProgramOptions(event.target.value);
    syncProgramFields();
  }
  if (event.target.matches("[data-program-select]")) syncProgramFields();
});

document.addEventListener("cuac:agent-action", (event) => {
  if (handleAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
});

document.addEventListener("cuac:agent-undo", (event) => {
  if (!event.detail?.undo) return;
  restoreApplicationState(event.detail.undo);
  event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setChoiceModal(false);
});

renderIcons();
renderProgramOptions(document.querySelector("[data-university-select]")?.value || "Zhejiang University");
syncProgramFields();
updateProgress();
