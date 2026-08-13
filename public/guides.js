const guideIcons = {
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 15h3"/><path d="M14 15h2"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
  language: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>',
  award: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M5 6H3a4 4 0 0 0 4 4"/><path d="M19 6h2a4 4 0 0 1-4 4"/></svg>',
  passport: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/><path d="M9 19h4"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h5A4.5 4.5 0 0 1 19 8.5v2A4.5 4.5 0 0 1 14.5 15H11l-4 4v-4.5A4.5 4.5 0 0 1 5 10.5Z"/><path d="m17 3 .7 1.5L19 5l-1.3.5L17 7l-.7-1.5L15 5l1.3-.5Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a6 6 0 0 0 6-6V8"/></svg>',
};

document.querySelectorAll("[data-guide-icon]").forEach((target) => {
  target.innerHTML = guideIcons[target.dataset.guideIcon] || "";
});

function runGuidePrompt(value) {
  const input = document.querySelector("[data-cuac-agent-input]");
  const form = document.querySelector("[data-cuac-agent-form]");
  if (!input || !form) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.requestSubmit();
}

function showGuideAgentNotice(message, anchor = "#documents") {
  let notice = document.querySelector("[data-guide-agent-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "guide-agent-notice";
    notice.dataset.guideAgentNotice = "";
    document.querySelector(anchor)?.prepend(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function captureGuideState() {
  const rows = Array.from(document.querySelectorAll(".document-row:not(.header)"));
  return {
    reviewedRows: rows.map((row, index) => row.classList.contains("agent-reviewed") ? index : -1).filter((index) => index >= 0),
    activeTimeline: Array.from(document.querySelectorAll(".timeline-step")).findIndex((step) => step.classList.contains("active")),
    notice: document.querySelector("[data-guide-agent-notice]")?.textContent || "",
  };
}

function restoreGuideState(snapshot) {
  if (!snapshot) return;
  const rows = Array.from(document.querySelectorAll(".document-row:not(.header)"));
  rows.forEach((row, index) => row.classList.toggle("agent-reviewed", (snapshot.reviewedRows || []).includes(index)));
  const steps = Array.from(document.querySelectorAll(".timeline-step"));
  steps.forEach((step, index) => step.classList.toggle("active", index === snapshot.activeTimeline));
  const notice = document.querySelector("[data-guide-agent-notice]");
  if (notice) {
    notice.textContent = snapshot.notice;
    notice.classList.toggle("visible", Boolean(snapshot.notice));
  }
}

function applyGuideAgentAction(action, detail = {}) {
  const before = captureGuideState();
  if (action === "save-checklist") {
    document.querySelectorAll(".document-row:not(.header)").forEach((row, index) => {
      if (index < 5) row.classList.add("agent-reviewed");
    });
    showGuideAgentNotice("Agent highlighted the reusable document packet for a Fall 2026 application.");
    document.querySelector("#documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "apply-smart-filters") {
    const step = document.querySelector(".timeline-step:nth-child(3)");
    document.querySelectorAll(".timeline-step").forEach((item) => item.classList.remove("active"));
    step?.classList.add("active");
    showGuideAgentNotice("Agent selected the document-preparation stage as the next guide step.", "#timeline");
    document.querySelector("#timeline")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "compare-funding") {
    document.querySelector("#scholarships")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  if (action === "save-program-shortlist") {
    window.location.href = "programs.html";
    return true;
  }
  return false;
}

document.addEventListener("click", (event) => {
  const prompt = event.target.closest("[data-guide-prompt]");
  if (prompt) {
    event.preventDefault();
    runGuidePrompt(prompt.dataset.guidePrompt);
  }

  const timelineStep = event.target.closest(".timeline-step");
  if (timelineStep) {
    document.querySelectorAll(".timeline-step").forEach((step) => step.classList.remove("active"));
    timelineStep.classList.add("active");
  }
});

document.addEventListener("focusin", (event) => {
  const timelineStep = event.target.closest(".timeline-step");
  if (!timelineStep) return;
  document.querySelectorAll(".timeline-step").forEach((step) => step.classList.remove("active"));
  timelineStep.classList.add("active");
});

document.addEventListener("cuac:agent-action", (event) => {
  if (applyGuideAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
});

document.addEventListener("cuac:agent-undo", (event) => {
  if (!event.detail?.undo) return;
  restoreGuideState(event.detail.undo);
  event.preventDefault();
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
  );
  document.querySelectorAll(".reveal").forEach((target) => revealObserver.observe(target));
} else {
  document.querySelectorAll(".reveal").forEach((target) => target.classList.add("visible"));
}
