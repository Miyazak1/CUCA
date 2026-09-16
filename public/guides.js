const guideIcons = {
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 15h3"/><path d="M14 15h2"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
  language: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>',
  award: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M5 6H3a4 4 0 0 0 4 4"/><path d="M19 6h2a4 4 0 0 1-4 4"/></svg>',
  passport: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/><path d="M9 19h4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a6 6 0 0 0 6-6V8"/></svg>',
};

const applicationTimeline = window.CuacDataClient?.getApplicationTimeline?.() || null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function timelineMonthKey(value = "") {
  return String(value || "").trim().slice(0, 3).toLowerCase();
}

function monthCount(windowItem = {}, programs = []) {
  const key = timelineMonthKey(windowItem.month);
  if (!key) return 0;
  return programs.filter((program) => timelineMonthKey(program.month) === key || String(program.deadline || "").toLowerCase().includes(key)).length;
}

function deadlineTone(days) {
  if (typeof days !== "number") return "neutral";
  if (days < 0) return "past";
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "open";
}

function deadlineLabel(days) {
  if (typeof days !== "number") return "Confirm date";
  if (days < 0) return "Needs current check";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function normalizeTimelineResultMode(value = "") {
  return String(value || "").toLowerCase() === "program" ? "program" : "school";
}

function readTimelineRouteState() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    query: params.get("timelineQuery") || params.get("keyword") || params.get("q") || "",
    deadline: params.get("deadline") || params.get("within") || "",
    tag: params.get("tag") || params.get("projectTag") || "",
    mode: normalizeTimelineResultMode(params.get("mode") || params.get("resultMode") || ""),
    month: params.get("month") || "",
  };
}

const timelineFilterState = readTimelineRouteState();

function updateTimelineRouteState() {
  const params = new URLSearchParams(window.location.search || "");
  const write = (key, value) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  write("timelineQuery", timelineFilterState.query);
  write("deadline", timelineFilterState.deadline);
  write("tag", timelineFilterState.tag);
  write("mode", timelineFilterState.mode === "program" ? "program" : "");
  write("month", timelineFilterState.month);
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", next);
}

function timelineSearchText(program = {}) {
  return [
    program.title,
    program.schoolName,
    program.schoolNameEn,
    program.degree,
    program.language,
    program.field,
    program.deadline,
    program.applicationRound,
    Array.isArray(program.tags) ? program.tags.join(" ") : "",
  ].filter(Boolean).join(" ").toLowerCase();
}

function timelineMatchesMonth(program = {}, month = "") {
  const key = timelineMonthKey(month);
  if (!key) return true;
  return timelineMonthKey(program.month) === key || String(program.deadline || "").toLowerCase().includes(key);
}

function timelineProgramMatches(program = {}) {
  const query = String(timelineFilterState.query || "").trim().toLowerCase();
  const deadline = Number(timelineFilterState.deadline || 0);
  const tag = String(timelineFilterState.tag || "").trim().toLowerCase();
  const tags = Array.isArray(program.tags) ? program.tags.map((item) => String(item).toLowerCase()) : [];
  if (!timelineMatchesMonth(program, timelineFilterState.month)) return false;
  if (query && !timelineSearchText(program).includes(query)) return false;
  if (deadline && (typeof program.days !== "number" || program.days < 0 || program.days > deadline)) return false;
  if (tag && !tags.includes(tag)) return false;
  return true;
}

function filteredTimelinePrograms(month = timelineFilterState.month, limit = 0) {
  const programs = applicationTimeline?.programs || [];
  const previousMonth = timelineFilterState.month;
  timelineFilterState.month = month || "";
  const visible = programs.filter(timelineProgramMatches);
  timelineFilterState.month = previousMonth;
  return limit ? visible.slice(0, limit) : visible;
}

function groupTimelineSchools(programs = []) {
  return Array.from(programs.reduce((map, program) => {
    const key = String(program.schoolId || program.schoolNameEn || program.schoolName || "school");
    const group = map.get(key) || {
      key,
      schoolName: program.schoolName || "School",
      schoolNameEn: program.schoolNameEn || "",
      region: program.schoolRegion || "",
      rows: [],
    };
    group.rows.push(program);
    map.set(key, group);
    return map;
  }, new Map()).values()).map((group) => ({
    ...group,
    earliest: [...group.rows].sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))[0],
  }));
}

function timelineFilterChips(programs = []) {
  const chips = [];
  if (timelineFilterState.query) chips.push(["query", `Search: ${timelineFilterState.query}`]);
  if (timelineFilterState.month) chips.push(["month", `Month: ${timelineFilterState.month}`]);
  if (timelineFilterState.deadline) chips.push(["deadline", `Within ${timelineFilterState.deadline} days`]);
  if (timelineFilterState.tag) chips.push(["tag", `Tag: ${timelineFilterState.tag}`]);
  chips.push(["count", `${programs.length} matched programs`]);
  return chips;
}

function timelineHasExplicitFilters() {
  return Boolean(timelineFilterState.query || timelineFilterState.deadline || timelineFilterState.tag || timelineFilterState.mode === "program");
}

function renderTimelineFilterPanel(programs = []) {
  const target = document.querySelector("[data-timeline-filter-panel]");
  if (!target) return;
  const chips = timelineFilterChips(programs);
  target.innerHTML = `
    <div class="timeline-filter-grid">
      <label>
        <span>Search deadlines</span>
        <input data-timeline-search value="${escapeHtml(timelineFilterState.query)}" placeholder="Computer Science, Zhejiang, English" />
      </label>
      <label>
        <span>Deadline</span>
        <select data-timeline-deadline-filter>
          <option value="" ${!timelineFilterState.deadline ? "selected" : ""}>All dates</option>
          <option value="7" ${timelineFilterState.deadline === "7" ? "selected" : ""}>Within 7 days</option>
          <option value="30" ${timelineFilterState.deadline === "30" ? "selected" : ""}>Within 30 days</option>
        </select>
      </label>
      <label>
        <span>Project tag</span>
        <select data-timeline-tag-filter>
          <option value="" ${!timelineFilterState.tag ? "selected" : ""}>All projects</option>
          <option value="english" ${timelineFilterState.tag === "english" ? "selected" : ""}>English-taught</option>
          <option value="csc" ${timelineFilterState.tag === "csc" ? "selected" : ""}>CSC</option>
          <option value="scholarship" ${timelineFilterState.tag === "scholarship" ? "selected" : ""}>Scholarship</option>
        </select>
      </label>
      <div class="timeline-result-mode" role="group" aria-label="Timeline result mode">
        <button class="${timelineFilterState.mode === "school" ? "active" : ""}" data-timeline-result-mode="school" type="button">By school</button>
        <button class="${timelineFilterState.mode === "program" ? "active" : ""}" data-timeline-result-mode="program" type="button">By program</button>
      </div>
    </div>
    <div class="timeline-filter-chips">
      ${chips.map(([key, label]) => key === "count"
        ? `<span class="count">${escapeHtml(label)}</span>`
        : `<button data-timeline-clear-filter="${escapeHtml(key)}" type="button">${escapeHtml(label)}</button>`).join("")}
      <button data-timeline-clear-filter="all" type="button">Clear filters</button>
    </div>
  `;
}

function renderTimelineProgramItem(program = {}) {
  return `
    <a class="timeline-deadline-item ${escapeHtml(deadlineTone(program.days))}" href="program-detail.html?program=${encodeURIComponent(program.key || "")}" data-timeline-program-result>
      <span>${escapeHtml(deadlineLabel(program.days))}</span>
      <strong>${escapeHtml(program.title || "Program deadline")}</strong>
      <em>${escapeHtml([program.schoolNameEn || program.schoolName, program.degree, program.language].filter(Boolean).join(" · "))}</em>
      <small>${escapeHtml([program.deadline || "Confirm deadline", program.applicationRound].filter(Boolean).join(" · "))}</small>
    </a>
  `;
}

function renderTimelineSchoolItem(group = {}) {
  const earliest = group.earliest || {};
  return `
    <article class="timeline-school-item ${escapeHtml(deadlineTone(earliest.days))}" data-timeline-school-result>
      <div>
        <span>${escapeHtml(deadlineLabel(earliest.days))}</span>
        <strong>${escapeHtml(group.schoolNameEn || group.schoolName || "School")}</strong>
        <em>${escapeHtml([group.schoolName, group.region].filter(Boolean).join(" · "))}</em>
      </div>
      <p><b>${escapeHtml(group.rows.length)}</b> program deadlines · earliest ${escapeHtml(earliest.deadline || "Confirm date")}</p>
      <div class="timeline-school-programs">
        ${group.rows.slice(0, 3).map((program) => `<a href="program-detail.html?program=${encodeURIComponent(program.key || "")}">${escapeHtml(program.title || "Program")}</a>`).join("")}
      </div>
    </article>
  `;
}

function renderTimelineDeadlineBoard() {
  const target = document.querySelector("[data-timeline-deadline-board]");
  if (!target || !applicationTimeline) return;
  const programs = filteredTimelinePrograms(timelineFilterState.month);
  const schools = groupTimelineSchools(programs);
  const title = timelineFilterState.month ? `${timelineFilterState.month} application deadlines` : "Nearest program deadlines";
  renderTimelineFilterPanel(programs);
  target.innerHTML = `
    <div class="timeline-deadline-head">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>Built from school-program deadline fields. Filter by keyword, deadline pressure, tag, or result mode.</span>
      </div>
      <a href="programs.html">Browse all programs</a>
    </div>
    <div class="${timelineFilterState.mode === "school" ? "timeline-school-list" : "timeline-deadline-list"}">
      ${timelineFilterState.mode === "school"
        ? schools.map(renderTimelineSchoolItem).join("")
        : programs.slice(0, 12).map(renderTimelineProgramItem).join("")}
      ${programs.length ? "" : `<p class="timeline-empty">No matched program deadlines yet. Clear filters or use the program catalog to confirm exact dates.</p>`}
    </div>
  `;
}

function renderApplicationTimeline() {
  const panel = document.querySelector("[data-application-timeline]");
  const windowList = document.querySelector("[data-application-window-list]");
  const stats = document.querySelector("[data-application-timeline-stats]");
  if (!panel || !windowList || !applicationTimeline?.windows?.length) return;
  const programs = applicationTimeline.programs || [];
  const timelineStats = applicationTimeline.stats || {};
  stats.innerHTML = `
    <span><strong>${escapeHtml(timelineStats.deadlineItemCount ?? programs.length)}</strong><em>program deadlines</em></span>
    <span><strong>${escapeHtml(timelineStats.schoolCount ?? 0)}</strong><em>schools</em></span>
    <span><strong>${escapeHtml(timelineStats.urgent30Count ?? 0)}</strong><em>within 30 days</em></span>
  `;
  windowList.innerHTML = applicationTimeline.windows.map((item, index) => {
    const count = monthCount(item, programs);
    const active = timelineFilterState.month
      ? timelineMonthKey(timelineFilterState.month) === timelineMonthKey(item.month)
      : !timelineHasExplicitFilters() && index === 0;
    return `
      <button class="application-window-card ${active ? "active" : ""}" data-application-window="${escapeHtml(item.month)}" type="button">
        <span>${escapeHtml(item.month)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.applicationWindow)}</p>
        <em>${escapeHtml(item.cscaWindow)}</em>
        <small>${count ? `${count} related deadlines` : "Check by school"}</small>
      </button>
    `;
  }).join("");
  if (!timelineFilterState.month && !timelineHasExplicitFilters()) timelineFilterState.month = applicationTimeline.windows[0]?.month || "";
  updateTimelineRouteState();
  renderTimelineDeadlineBoard();
}

document.querySelectorAll("[data-guide-icon]").forEach((target) => {
  target.innerHTML = guideIcons[target.dataset.guideIcon] || "";
});

async function loadPublishedGuideRoutes() {
  const target = document.querySelector("[data-guide-routes]");
  if (!target) return;
  target.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/api/v1/catalog/guides?limit=20", { headers: { accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.data)) throw new Error("Published guides are unavailable.");
    const icons = { timeline: "calendar", documents: "document", language: "language", "scholarship-planning": "award", "visa-arrival": "passport" };
    target.innerHTML = `${payload.data.map((guide) => `<a class="question-route" href="${escapeHtml(guide.href)}" data-guide-source="${escapeHtml(guide.slug)}">
      <span data-guide-icon="${escapeHtml(icons[guide.slug] || "route")}">${guideIcons[icons[guide.slug]] || guideIcons.route}</span>
      <strong>${escapeHtml(guide.titleEn)}</strong><em>${escapeHtml(guide.subtitleEn || "Published guide")}</em>
    </a>`).join("")}
      <a class="question-route" href="hub.html"><span data-guide-icon="route">${guideIcons.route}</span><strong>What should I do next?</strong><em>Open Hub</em></a>`;
    target.dataset.guideLoadState = "ready";
  } catch {
    target.dataset.guideLoadState = "fallback";
  } finally {
    target.removeAttribute("aria-busy");
  }
}

document.addEventListener("click", (event) => {
  const applicationWindow = event.target.closest("[data-application-window]");
  if (applicationWindow) {
    document.querySelectorAll("[data-application-window]").forEach((item) => item.classList.remove("active"));
    applicationWindow.classList.add("active");
    timelineFilterState.month = applicationWindow.dataset.applicationWindow || "";
    updateTimelineRouteState();
    renderTimelineDeadlineBoard();
    return;
  }

  const resultMode = event.target.closest("[data-timeline-result-mode]");
  if (resultMode) {
    timelineFilterState.mode = normalizeTimelineResultMode(resultMode.dataset.timelineResultMode || "");
    updateTimelineRouteState();
    renderTimelineDeadlineBoard();
    return;
  }

  const clearTimelineFilter = event.target.closest("[data-timeline-clear-filter]");
  if (clearTimelineFilter) {
    const key = clearTimelineFilter.dataset.timelineClearFilter || "";
    if (key === "all") {
      timelineFilterState.query = "";
      timelineFilterState.deadline = "";
      timelineFilterState.tag = "";
      timelineFilterState.month = "";
    } else if (key === "query") timelineFilterState.query = "";
    else if (key === "deadline") timelineFilterState.deadline = "";
    else if (key === "tag") timelineFilterState.tag = "";
    else if (key === "month") timelineFilterState.month = "";
    updateTimelineRouteState();
    renderApplicationTimeline();
    return;
  }

  const timelineStep = event.target.closest(".timeline-step");
  if (timelineStep) {
    document.querySelectorAll(".timeline-step").forEach((step) => step.classList.remove("active"));
    timelineStep.classList.add("active");
  }
});

document.addEventListener("input", (event) => {
  const search = event.target.closest("[data-timeline-search]");
  if (!search) return;
  timelineFilterState.query = search.value || "";
  updateTimelineRouteState();
  renderTimelineDeadlineBoard();
});

document.addEventListener("change", (event) => {
  const deadline = event.target.closest("[data-timeline-deadline-filter]");
  if (deadline) {
    timelineFilterState.deadline = deadline.value || "";
    updateTimelineRouteState();
    renderTimelineDeadlineBoard();
    return;
  }
  const tag = event.target.closest("[data-timeline-tag-filter]");
  if (tag) {
    timelineFilterState.tag = tag.value || "";
    updateTimelineRouteState();
    renderTimelineDeadlineBoard();
  }
});

document.addEventListener("focusin", (event) => {
  const timelineStep = event.target.closest(".timeline-step");
  if (!timelineStep) return;
  document.querySelectorAll(".timeline-step").forEach((step) => step.classList.remove("active"));
  timelineStep.classList.add("active");
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

renderApplicationTimeline();
loadPublishedGuideRoutes();
