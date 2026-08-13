const scholarshipIcons = {
  money: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H15a3.5 3.5 0 0 1 0 7H6"/></svg>',
  award: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M5 6H3a4 4 0 0 0 4 4"/><path d="M19 6h2a4 4 0 0 1-4 4"/></svg>',
  landmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V9"/><path d="M19 21V9"/><path d="M3 9h18"/><path d="M12 3 3 9h18Z"/><path d="M9 21v-7h6v7"/></svg>',
  school: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M12 14v4l3 2"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3l9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-6h6v6"/></svg>',
  stipend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11 3 15l6 6 4-4"/><path d="M17 13l4-4-6-6-4 4"/><path d="m8 16 8-8"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 8.6c0 5.7-8.5 10.4-8.5 10.4S3.5 14.3 3.5 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>',
};

document.querySelectorAll("[data-icon]").forEach((target) => {
  target.innerHTML = scholarshipIcons[target.dataset.icon] || "";
});

const scholarships = [
  { id: 1, title: "Chinese Government Scholarship / CSC", type: "government", typeLabel: "CSC", funding: "full", school: "Multiple universities", summary: "Full-funding route for strong applicants through CSC or university channels.", coverage: ["Tuition", "Stipend", "Accommodation", "Insurance"], degree: "Master / PhD", deadline: "Mar 31", source: "verified", verified: "Jul 14", tags: ["Full funding", "CSC", "Verified source"] },
  { id: 2, title: "Zhejiang University International Student Scholarship", type: "university", typeLabel: "University", funding: "partial", school: "Zhejiang University", summary: "School-level award for selected international degree applicants in Hangzhou.", coverage: ["Tuition waiver", "Merit review"], degree: "Bachelor / Master", deadline: "Oct 15", source: "verified", verified: "Jul 14", tags: ["University award", "Hangzhou", "Verified source"] },
  { id: 3, title: "Shanghai Government Scholarship", type: "province", typeLabel: "City", funding: "full", school: "Shanghai universities", summary: "Municipal scholarship route with university-specific application rules.", coverage: ["Tuition", "Stipend", "Insurance"], degree: "Bachelor / Master", deadline: "Sep 12", source: "pending", verified: "Needs date check", tags: ["Full funding", "Shanghai", "Deadline soon"] },
  { id: 4, title: "Beijing Government Scholarship", type: "province", typeLabel: "City", funding: "partial", school: "Beijing universities", summary: "Local government award that may reduce tuition for international students.", coverage: ["Tuition waiver"], degree: "All levels", deadline: "May 30", source: "verified", verified: "Jul 10", tags: ["City award", "Beijing", "Partial"] },
  { id: 5, title: "Jiangsu Jasmine Scholarship", type: "province", typeLabel: "Province", funding: "full", school: "Jiangsu universities", summary: "Province-level route for students considering Nanjing, Suzhou, and nearby cities.", coverage: ["Tuition", "Stipend", "Insurance"], degree: "Bachelor / Master", deadline: "Apr 20", source: "verified", verified: "Jul 14", tags: ["Full funding", "Province", "Affordable city"] },
  { id: 6, title: "Tianjin Government Scholarship", type: "province", typeLabel: "City", funding: "full", school: "Tianjin universities", summary: "Local funding route with different coverage by university and degree level.", coverage: ["Tuition", "Accommodation"], degree: "Master / PhD", deadline: "Jun 15", source: "pending", verified: "Needs source check", tags: ["City award", "Full funding"] },
  { id: 7, title: "International Chinese Language Teachers Scholarship", type: "partner", typeLabel: "Language", funding: "full", school: "Language partner universities", summary: "Best for students pursuing Chinese language or teaching-related routes.", coverage: ["Tuition", "Stipend", "Accommodation", "Insurance"], degree: "Non-degree / BA / MA", deadline: "May 10", source: "verified", verified: "Jul 14", tags: ["Language route", "Full funding"] },
  { id: 8, title: "ASEAN-China Young Leaders Scholarship", type: "partner", typeLabel: "Partner", funding: "full", school: "Multiple universities", summary: "Partner route for eligible ASEAN-region applicants and leadership programs.", coverage: ["Tuition", "Stipend", "Travel", "Insurance"], degree: "Master / PhD", deadline: "Mar 20", source: "check", verified: "Confirm notice", tags: ["ASEAN", "Partner route"] },
  { id: 9, title: "Fudan University Freshman Scholarship", type: "university", typeLabel: "University", funding: "partial", school: "Fudan University", summary: "Merit award for new international undergraduate applicants in Shanghai.", coverage: ["Tuition waiver"], degree: "Undergraduate", deadline: "Sep 12", source: "verified", verified: "Jul 14", tags: ["Undergraduate", "Shanghai", "Deadline soon"] },
  { id: 10, title: "Engineering Excellence Scholarship", type: "university", typeLabel: "Subject", funding: "partial", school: "Harbin Institute of Technology", summary: "Subject-focused route for engineering applicants with strong transcripts.", coverage: ["Tuition waiver", "Merit review"], degree: "Master", deadline: "Nov 20", source: "verified", verified: "Jul 12", tags: ["Engineering", "University award"] },
  { id: 11, title: "Coastal Sustainability Scholarship", type: "partner", typeLabel: "Subject", funding: "full", school: "Xiamen University", summary: "Subject route for sustainability or coastal research applicants.", coverage: ["Tuition", "Stipend", "Insurance"], degree: "Master / PhD", deadline: "Dec 10", source: "pending", verified: "Deadline pending", tags: ["Subject route", "Full funding"] },
  { id: 12, title: "Provincial International Student Tuition Award", type: "province", typeLabel: "Province", funding: "partial", school: "Multiple provincial universities", summary: "Partial tuition support that can pair with lower living-cost cities.", coverage: ["Tuition waiver"], degree: "All levels", deadline: "Rolling", source: "check", verified: "Confirm locally", tags: ["Partial", "Lower cost"] },
];

const scholarshipImages = {
  government: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80",
  university: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80",
  province: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
  partner: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
};

const filters = {
  funding: "all",
  type: "all",
  degree: "all",
  deadline: "all",
  source: "all",
  coverage: false,
};
let sort = "relevance";
let page = 1;
const pageSize = 8;
const saved = new Set();
let focusedScholarshipId = null;

const filterConfig = [
  ["Funding level", [["funding", "Funding", [["all", "Any funding"], ["full", "Full funding"], ["partial", "Partial funding"]]]]],
  ["Route type", [["type", "Type", [["all", "Any route"], ["government", "CSC / government"], ["university", "University award"], ["province", "Province / city"], ["partner", "Partner or subject"]]]]],
  ["Student fit", [["degree", "Degree", [["all", "Any degree"], ["Undergraduate", "Undergraduate"], ["Master", "Master"], ["PhD", "PhD"]]]]],
  ["Application timing", [["deadline", "Deadline", [["all", "Any status"], ["soon", "Deadline soon"], ["open", "Open or later"], ["rolling", "Rolling"]]]]],
  ["Source confidence", [["source", "Source", [["all", "Any source"], ["verified", "Verified"], ["pending", "Needs date check"], ["check", "Needs source check"]]]]],
];

function matches(item) {
  if (filters.funding !== "all" && item.funding !== filters.funding) return false;
  if (filters.type !== "all" && item.type !== filters.type) return false;
  if (filters.degree !== "all" && !item.degree.includes(filters.degree)) return false;
  if (filters.source !== "all" && item.source !== filters.source) return false;
  if (filters.coverage && !item.coverage.includes("Stipend")) return false;
  if (filters.deadline === "soon" && !["Mar 20", "Mar 31", "Sep 12"].includes(item.deadline)) return false;
  if (filters.deadline === "open" && item.deadline === "Rolling") return false;
  if (filters.deadline === "rolling" && item.deadline !== "Rolling") return false;
  return true;
}

function sorted(items) {
  const next = [...items];
  if (sort === "deadline") next.sort((a, b) => a.deadline.localeCompare(b.deadline));
  if (sort === "full") next.sort((a, b) => Number(b.funding === "full") - Number(a.funding === "full"));
  if (sort === "verified") next.sort((a, b) => Number(b.source === "verified") - Number(a.source === "verified"));
  return next;
}

function statusLabel(item) {
  if (item.source === "verified") return ["verified", "Verified source"];
  if (item.source === "pending") return ["pending", "Needs date check"];
  return ["check", "Needs source check"];
}

function scholarshipImage(item) {
  if (item.school.includes("Zhejiang")) return "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg";
  if (item.school.includes("Shanghai") || item.school.includes("Fudan")) return "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80";
  if (item.school.includes("Beijing")) return "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80";
  if (item.school.includes("Harbin")) return "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80";
  if (item.school.includes("Xiamen")) return "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";
  return scholarshipImages[item.type] || scholarshipImages.university;
}

function renderCards() {
  const filtered = sorted(scholarships.filter(matches));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, totalPages);
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);
  document.querySelector("#resultCount").textContent = filtered.length;
  document.querySelector("#resultContext").textContent = filtered.length === scholarships.length
    ? "Funding routes with type, coverage, deadline, and source status."
    : "Filtered by your scholarship route preferences.";
  document.querySelector("#scholarshipGrid").innerHTML = items.map((item) => {
    const [statusClass, statusText] = statusLabel(item);
    const shownCoverage = item.coverage.slice(0, 3);
    const hiddenCoverage = item.coverage.length - shownCoverage.length;
    return `
      <article class="scholarship-card">
        <div class="scholarship-media">
          <img alt="${item.title} route context" src="${scholarshipImage(item)}" loading="lazy" />
          <span class="badge type-badge ${item.type}">${item.typeLabel}</span>
          <button class="save-button ${saved.has(item.id) ? "saved" : ""}" type="button" data-save="${item.id}" aria-label="Save ${item.title}">${scholarshipIcons.heart}</button>
        </div>
        <h3>${item.title}</h3>
        <p class="school-line">${item.school}</p>
        <p class="summary">${item.summary}</p>
        <div class="coverage-chips">${shownCoverage.map((value) => `<span>${value}</span>`).join("")}${hiddenCoverage ? `<span>+${hiddenCoverage}</span>` : ""}</div>
        <div class="facts"><span><b>${item.funding === "full" ? "Full" : "Partial"}</b>funding</span><span><b>${item.degree}</b>degree fit</span><span><b>${item.deadline}</b>deadline</span></div>
        <div class="card-meta"><span class="status ${statusClass}">${statusText}</span><span class="status">${item.verified}</span></div>
        <div class="card-actions"><a class="primary" href="programs.html?scholarship=true">Matching programs</a><button class="ghost" type="button" data-detail="${item.id}">Details</button></div>
      </article>
    `;
  }).join("");
  document.querySelector("#pagination").innerHTML = Array.from({ length: totalPages }, (_, index) => `
    <button class="${index + 1 === page ? "active" : ""}" type="button" data-page="${index + 1}">${index + 1}</button>
  `).join("");
  renderActiveChips();
  renderFocus();
}

function renderFocus() {
  const panel = document.querySelector("#scholarshipFocus");
  const item = scholarships.find((entry) => entry.id === focusedScholarshipId);
  if (!item) {
    panel.hidden = true;
    return;
  }
  const [statusClass, statusText] = statusLabel(item);
  panel.hidden = false;
  document.querySelector("#focusType").textContent = item.typeLabel;
  document.querySelector("#focusType").className = `badge type-badge ${item.type}`;
  document.querySelector("#focusTitle").textContent = item.title;
  document.querySelector("#focusSummary").textContent = item.summary;
  document.querySelector("#focusPrograms").href = `programs.html?scholarship=true&route=${encodeURIComponent(item.type)}&funding=${encodeURIComponent(item.funding)}`;
  document.querySelector("#focusFacts").innerHTML = [
    ["Coverage", item.coverage.join(", ")],
    ["Degree fit", item.degree],
    ["Deadline", item.deadline],
    ["Source", `${statusText} · ${item.verified}`],
  ].map(([label, value]) => `<span><b>${label}</b>${value}</span>`).join("");
  panel.dataset.status = statusClass;
}

function renderActiveChips() {
  const chips = [];
  if (filters.funding !== "all") chips.push(["funding", filters.funding === "full" ? "Full funding" : "Partial funding"]);
  if (filters.type !== "all") chips.push(["type", `${filters.type} route`]);
  if (filters.degree !== "all") chips.push(["degree", filters.degree]);
  if (filters.deadline !== "all") chips.push(["deadline", filters.deadline === "soon" ? "Deadline soon" : filters.deadline]);
  if (filters.source !== "all") chips.push(["source", filters.source === "verified" ? "Verified source" : "Needs check"]);
  if (filters.coverage) chips.push(["coverage", "Includes stipend"]);
  document.querySelector("#activeChips").innerHTML = chips.length
    ? chips.map(([key, label]) => `<button class="filter-chip active" type="button" data-clear="${key}">${label} x</button>`).join("")
    : '<span class="filter-chip">No filters applied</span>';
}

function renderFilters() {
  document.querySelector("#filterGroups").innerHTML = `
    ${filterConfig.map(([group, controls]) => `
      <div class="filter-group"><span>${group}</span>${controls.map(([key, label, options]) => `
        <label><span>${label}</span><select class="filter-select" data-filter-key="${key}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>
      `).join("")}</div>
    `).join("")}
    <div class="filter-group"><span>Coverage</span><div class="check-list"><label><input type="checkbox" data-filter-key="coverage" /> Includes living stipend</label></div></div>
  `;
  syncFilters();
}

function syncFilters() {
  document.querySelectorAll("[data-filter-key]").forEach((control) => {
    const key = control.dataset.filterKey;
    if (control.type === "checkbox") control.checked = Boolean(filters[key]);
    else control.value = filters[key];
  });
}

function openDrawer(open) {
  const drawer = document.querySelector("#filterDrawer");
  const backdrop = document.querySelector("#drawerBackdrop");
  drawer.classList.toggle("open", open);
  backdrop.classList.toggle("open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) drawer.removeAttribute("inert");
  else drawer.setAttribute("inert", "");
}

function applyRouteFilter(value) {
  Object.assign(filters, { funding: "all", type: "all", degree: "all", deadline: "all", source: "all", coverage: false });
  if (value === "all") {
    focusedScholarshipId = null;
  } else if (value === "full") filters.funding = "full";
  else if (value === "deadline") filters.deadline = "soon";
  else filters.type = value;
  page = 1;
  syncFilters();
  renderCards();
}

function showScholarshipAgentNotice(message) {
  let notice = document.querySelector("[data-scholarship-agent-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "scholarship-agent-notice";
    notice.dataset.scholarshipAgentNotice = "";
    document.querySelector("#scholarship-browser .section-head")?.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function captureScholarshipState() {
  return {
    filters: { ...filters },
    saved: Array.from(saved),
    sort,
    page,
    focusedScholarshipId,
    notice: document.querySelector("[data-scholarship-agent-notice]")?.textContent || "",
  };
}

function restoreScholarshipState(snapshot) {
  if (!snapshot) return;
  Object.assign(filters, snapshot.filters || {});
  saved.clear();
  (snapshot.saved || []).forEach((id) => saved.add(id));
  sort = snapshot.sort || "relevance";
  page = snapshot.page || 1;
  focusedScholarshipId = snapshot.focusedScholarshipId;
  syncFilters();
  renderCards();
  renderFocus();
  const notice = document.querySelector("[data-scholarship-agent-notice]");
  if (notice) {
    notice.textContent = snapshot.notice;
    notice.classList.toggle("visible", Boolean(snapshot.notice));
  }
}

function applyScholarshipAgentAction(action, detail = {}) {
  const before = captureScholarshipState();
  if (action === "apply-smart-filters" || action === "compare-funding") {
    Object.assign(filters, { funding: "full", type: "all", degree: "Master", deadline: "all", source: "verified", coverage: true });
    sort = "full";
    page = 1;
    syncFilters();
    renderCards();
    showScholarshipAgentNotice("Agent filtered for full funding, Master fit, stipend coverage, and verified sources.");
    document.querySelector("#scholarship-browser")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-program-shortlist") {
    [1, 2, 5].forEach((id) => saved.add(id));
    renderCards();
    showScholarshipAgentNotice("Agent saved CSC, ZJU, and Jiangsu scholarship routes.");
    detail.setUndo?.(before);
    return true;
  }
  if (action === "open-choice-modal") {
    window.location.href = "programs.html?scholarship=true";
    return true;
  }
  if (action === "save-checklist") {
    focusedScholarshipId = 1;
    renderFocus();
    showScholarshipAgentNotice("Agent opened the CSC route because its funding checklist is the most complete demo path.");
    document.querySelector("#scholarshipFocus")?.scrollIntoView({ behavior: "smooth", block: "center" });
    detail.setUndo?.(before);
    return true;
  }
  return false;
}

document.addEventListener("click", (event) => {
  const save = event.target.closest("[data-save]");
  if (save) {
    const id = Number(save.dataset.save);
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    renderCards();
    return;
  }
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    page = Number(pageButton.dataset.page);
    renderCards();
    document.querySelector("#scholarship-browser").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const clear = event.target.closest("[data-clear]");
  if (clear) {
    const key = clear.dataset.clear;
    filters[key] = key === "coverage" ? false : "all";
    page = 1;
    syncFilters();
    renderCards();
    return;
  }
  const detail = event.target.closest("[data-detail]");
  if (detail) {
    focusedScholarshipId = Number(detail.dataset.detail);
    renderFocus();
    document.querySelector("#scholarshipFocus").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const route = event.target.closest("[data-route-filter]");
  if (route) {
    applyRouteFilter(route.dataset.routeFilter);
    return;
  }
  const prompt = event.target.closest("[data-prompt-chip]");
  if (prompt) {
    const input = document.querySelector("[data-planner-input]");
    input.value = prompt.dataset.promptChip;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
});

document.querySelector("#focusClose").addEventListener("click", () => {
  focusedScholarshipId = null;
  renderFocus();
});

document.querySelector("#openFilters").addEventListener("click", () => openDrawer(true));
document.querySelector("#closeFilters").addEventListener("click", () => openDrawer(false));
document.querySelector("#drawerBackdrop").addEventListener("click", () => openDrawer(false));
document.querySelector("#applyFilters").addEventListener("click", () => openDrawer(false));
document.querySelector("#resetFilters").addEventListener("click", () => {
  Object.assign(filters, { funding: "all", type: "all", degree: "all", deadline: "all", source: "all", coverage: false });
  page = 1;
  syncFilters();
  renderCards();
});
document.querySelector("#sortSelect").addEventListener("change", (event) => {
  sort = event.target.value;
  page = 1;
  renderCards();
});
document.addEventListener("change", (event) => {
  const control = event.target.closest("[data-filter-key]");
  if (!control) return;
  const key = control.dataset.filterKey;
  filters[key] = control.type === "checkbox" ? control.checked : control.value;
  page = 1;
  renderCards();
});

document.addEventListener("cuac:agent-action", (event) => {
  if (applyScholarshipAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
});

document.addEventListener("cuac:agent-undo", (event) => {
  if (!event.detail?.undo) return;
  restoreScholarshipState(event.detail.undo);
  event.preventDefault();
});

const revealItems = Array.from(document.querySelectorAll(".reveal"));
if (new URLSearchParams(window.location.search).get("motion") === "off") document.body.classList.add("motion-off");
if ("IntersectionObserver" in window && !document.body.classList.contains("motion-off")) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

renderFilters();
renderCards();
