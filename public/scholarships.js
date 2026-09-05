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
  arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
};

document.querySelectorAll("[data-icon]").forEach((target) => {
  target.innerHTML = scholarshipIcons[target.dataset.icon] || "";
});

const scholarships = [];

const scholarshipImages = {
  government: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80",
  university: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80",
  province: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
  partner: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
};
const escapeCatalogHtml = window.CuacCatalogList.escapeHtml;

const filters = {
  keyword: "",
  funding: "all",
  type: "all",
  degree: "all",
  country: "all",
  deadline: "all",
  coverage: false,
};
let sort = "relevance";
let page = 1;
const pageSize = 8;
const saved = new Set();
let focusedScholarshipId = null;
let routeCityFocus = "";

const filterConfig = [
  ["Funding level", [["funding", "Funding", [["all", "Any funding"], ["full", "Full funding"], ["partial", "Partial funding"]]]]],
  ["Route type", [["type", "Type", [["all", "Any route"], ["government", "CSC / government"], ["university", "University award"], ["province", "Province / city"], ["partner", "Partner or subject"]]]]],
  ["Country scope", [["country", "Country / region", scholarshipCountryOptions]]],
  ["Application timing", [["deadline", "Deadline", [["all", "Any status"], ["soon", "Deadline soon"], ["open", "Open or later"], ["rolling", "Rolling"]]]]],
];

function scholarshipKey(item = {}) {
  return String(item.slug || item.id || slugifyRouteParam(item.title || "scholarship"));
}

function scholarshipDetailKey(item = {}) {
  return String(item.id || scholarshipKey(item));
}

function scholarshipTitle(item = {}) {
  return item.title || item.name || "Scholarship route";
}

function scholarshipType(item = {}) {
  return normalizeScholarshipTypeParam(item.type || "other");
}

function scholarshipTypeLabel(item = {}) {
  return item.typeLabel || scholarshipType(item).replace(/^\w/, (char) => char.toUpperCase());
}

function scholarshipFundingLevel(item = {}) {
  return item.fundingLevel || item.funding || "unknown";
}

function scholarshipFundingLabel(item = {}) {
  const level = scholarshipFundingLevel(item);
  if (level === "full") return "Full";
  if (level === "partial") return "Partial";
  return "Check";
}

function scholarshipProvider(item = {}) {
  return item.providerNameEn || item.providerName || item.schoolName || item.school || "Provider not published";
}

function scholarshipSummary(item = {}) {
  return item.summary || item.bodySections?.[0]?.body || "No summary published.";
}

function scholarshipDegree(item = {}) {
  return item.applicableDegree || item.degree || "Not published";
}

function scholarshipDeadlineValue(item = {}) {
  return item.deadlineDate || item.deadline || item.deadlineLabel || "";
}

function scholarshipDeadlineLabel(item = {}) {
  return item.deadlineLabel || item.deadline || item.applicationRound || "Deadline pending";
}

function scholarshipSearchTags(item = {}) {
  return [
    ...(item.tags || []),
    ...(item.targetCountries || []),
    ...(item.targetRegions || []),
    ...(item.benefitItems || []).map((benefit) => benefit.label || benefit),
    ...(item.eligibilityItems || []).map((entry) => entry.label || entry),
  ].filter(Boolean);
}

function scholarshipValueList(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[\n,;、]+/);
  return items
    .map((item) => (typeof item === "string" ? item : item?.label || item?.title || item?.name || item?.body || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function scholarshipCountryScope(item = {}) {
  return [...scholarshipValueList(item.targetCountries), ...scholarshipValueList(item.targetRegions)];
}

function scholarshipCountryOptions() {
  const counts = new Map();
  scholarships.forEach((item) => {
    scholarshipCountryScope(item).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });
  const options = Array.from(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([value, count]) => [value, `${value} (${count})`]);
  return [["all", "Any country / region"], ...options];
}

function scholarshipLinkedCount(item = {}, key, fallbackKey) {
  const direct = Number(item[key]);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const fallback = item[fallbackKey];
  if (Array.isArray(fallback)) return fallback.length;
  return 0;
}

function scholarshipScopeItems(item = {}, priorityValue = "") {
  const countries = scholarshipCountryScope(item);
  const priority = String(priorityValue || "").toLowerCase();
  const priorityCountry = priority && priority !== "all"
    ? countries.find((value) => value.toLowerCase() === priority || value.toLowerCase().includes(priority) || priority.includes(value.toLowerCase()))
    : "";
  const visibleCountries = priorityCountry
    ? [priorityCountry, ...countries.filter((value) => value !== priorityCountry).slice(0, 1)]
    : countries.slice(0, 2);
  const hiddenCountries = countries.length - visibleCountries.length;
  const schoolCount = scholarshipLinkedCount(item, "schoolCount", "schools");
  const programCount = scholarshipLinkedCount(item, "programCount", "programs");
  const items = [...visibleCountries];
  if (hiddenCountries > 0) items.push(`+${hiddenCountries} more`);
  if (schoolCount > 0) items.push(`${schoolCount} ${schoolCount === 1 ? "school" : "schools"}`);
  if (programCount > 0) items.push(`${programCount} ${programCount === 1 ? "program route" : "program routes"}`);
  return items.length ? items : ["Scope not published"];
}

function scholarshipScopeSummary(item = {}) {
  return scholarshipScopeItems(item).join(" · ");
}

function normalizeScholarshipSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/csc/g, "chinese government scholarship csc")
    .replace(/government[\s-]*scholarship/g, "government scholarship")
    .replace(/full[\s-]*funding/g, "full")
    .replace(/partial[\s-]*funding/g, "partial")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scholarshipMatchesKeyword(item = {}) {
  const tokens = normalizeScholarshipSearchText(filters.keyword).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeScholarshipSearchText([
    scholarshipTitle(item),
    scholarshipType(item),
    scholarshipTypeLabel(item),
    scholarshipFundingLevel(item),
    scholarshipFundingLabel(item),
    scholarshipProvider(item),
    scholarshipSummary(item),
    scholarshipDegree(item),
    scholarshipDeadlineLabel(item),
    scholarshipScopeSummary(item),
    scholarshipCountryScope(item),
    coverageValues(item),
    scholarshipSearchTags(item),
    scholarshipEligibilitySummary(item),
    scholarshipMaterialsSummary(item),
    scholarshipNextStepSummary(item),
  ].flat().join(" "));
  return tokens.every((token) => haystack.includes(token));
}

function matches(item) {
  if (!scholarshipMatchesKeyword(item)) return false;
  if (routeCityFocus) {
    const aliases = cityScholarshipAliases(routeCityFocus);
    const haystack = [scholarshipTitle(item), scholarshipProvider(item), item.providerLocation, scholarshipSummary(item), ...scholarshipSearchTags(item)].join(" ").toLowerCase();
    if (!aliases.some((alias) => haystack.includes(alias))) return false;
  }
  if (filters.funding !== "all" && scholarshipFundingLevel(item) !== filters.funding) return false;
  if (filters.type !== "all" && scholarshipType(item) !== filters.type) return false;
  if (filters.degree !== "all" && !scholarshipDegree(item).includes(filters.degree)) return false;
  if (filters.country !== "all") {
    const selected = String(filters.country || "").toLowerCase();
    const countries = scholarshipCountryScope(item).map((value) => value.toLowerCase());
    if (!countries.some((value) => value === selected || value.includes(selected) || selected.includes(value))) return false;
  }
  if (filters.coverage && !coverageValues(item).includes("Stipend")) return false;
  const deadline = new Date(scholarshipDeadlineValue(item));
  const hasDate = !Number.isNaN(deadline.getTime());
  const days = hasDate ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null;
  if (filters.deadline === "soon" && !(days != null && days >= 0 && days <= 60)) return false;
  if (filters.deadline === "open" && !(days != null && days >= 0)) return false;
  if (filters.deadline === "rolling" && hasDate) return false;
  return true;
}

function sorted(items) {
  const next = [...items];
  if (sort === "deadline") next.sort((a, b) => {
    const left = new Date(scholarshipDeadlineValue(a)).getTime();
    const right = new Date(scholarshipDeadlineValue(b)).getTime();
    return (Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER) - (Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER);
  });
  if (sort === "full") next.sort((a, b) => Number(scholarshipFundingLevel(b) === "full") - Number(scholarshipFundingLevel(a) === "full"));
  return next;
}

function coverageValues(item) {
  if (Array.isArray(item.benefitItems) && item.benefitItems.length) return item.benefitItems.map((benefit) => benefit.label || benefit);
  if (Array.isArray(item.benefits) && item.benefits.length) return item.benefits;
  if (Array.isArray(item.coverage)) return item.coverage;
  return String(item.coverage || "")
    .split(/,\s*/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function scholarshipListText(value, fallback = "Check details") {
  const items = Array.isArray(value) ? value : String(value || "").split(/[\n;]+/);
  const first = items
    .map((item) => (typeof item === "string" ? item : item?.label || item?.title || item?.body || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean)[0];
  return first || fallback;
}

function scholarshipEligibilitySummary(item = {}) {
  return scholarshipListText(item.eligibilityItems, item.requirementText || "Not published");
}

function scholarshipMaterialsSummary(item = {}) {
  return scholarshipListText(item.applicationMaterials, "Not published");
}

function scholarshipNextStepSummary(item = {}) {
  return scholarshipListText(item.applicationSteps, "Not published");
}

function renderScholarshipReadiness(item = {}) {
  const rows = [
    ["Eligibility", scholarshipEligibilitySummary(item)],
    ["Materials", scholarshipMaterialsSummary(item)],
    ["Next step", scholarshipNextStepSummary(item)],
  ];
  return `
    <div class="scholarship-readiness" aria-label="Scholarship readiness summary">
      ${rows.map(([label, value]) => `
        <span>
          <b>${label}</b>
          <em>${escapeCatalogHtml(value)}</em>
        </span>
      `).join("")}
    </div>
  `;
}

function slugifyRouteParam(value) {
  return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeScholarshipTypeParam(value) {
  const slug = slugifyRouteParam(value);
  return {
    csc: "government",
    government: "government",
    "government-scholarship": "government",
    university: "university",
    "university-award": "university",
    province: "province",
    provincial: "province",
    city: "province",
    partner: "partner",
    subject: "partner",
    language: "partner",
  }[slug] || value || "other";
}

function normalizeScholarshipFundingParam(value) {
  const slug = slugifyRouteParam(value);
  return {
    full: "full",
    "full-funding": "full",
    partial: "partial",
    "partial-funding": "partial",
    unknown: "all",
  }[slug] || value || "all";
}

function normalizeScholarshipDegreeParam(value) {
  const slug = slugifyRouteParam(value);
  return {
    undergraduate: "Undergraduate",
    bachelor: "Undergraduate",
    bachelors: "Undergraduate",
    master: "Master",
    masters: "Master",
    phd: "PhD",
    doctoral: "PhD",
    doctor: "PhD",
  }[slug] || value || "all";
}

function normalizeCityParam(value) {
  if (!value) return "";
  const cityNames = {
    hangzhou: "Hangzhou",
    shanghai: "Shanghai",
    beijing: "Beijing",
    shenzhen: "Shenzhen",
    nanjing: "Nanjing",
    chengdu: "Chengdu",
    wuhan: "Wuhan",
    "xi-an": "Xi'an",
    xian: "Xi'an",
    guangzhou: "Guangzhou",
  };
  const routeSlug = slugifyRouteParam(value);
  return cityNames[routeSlug] || value;
}

function cityScholarshipAliases(value) {
  const aliases = {
    hangzhou: ["hangzhou", "zhejiang"],
    shanghai: ["shanghai"],
    beijing: ["beijing"],
    shenzhen: ["shenzhen", "guangdong"],
    nanjing: ["nanjing", "jiangsu"],
    chengdu: ["chengdu", "sichuan"],
    wuhan: ["wuhan", "hubei"],
    "xi-an": ["xi'an", "xian", "shaanxi"],
    guangzhou: ["guangzhou", "guangdong"],
  };
  const routeSlug = slugifyRouteParam(value);
  return aliases[routeSlug] || [String(value).toLowerCase()];
}

function scholarshipImage() {
  return "file.svg";
}

function matchingProgramsHref(item = {}) {
  const params = new URLSearchParams({ scholarship: "true" });
  const type = scholarshipType(item);
  const funding = scholarshipFundingLevel(item);
  const degree = scholarshipDegree(item);
  if (type) params.set("route", type);
  if (funding && funding !== "unknown") params.set("funding", funding);
  if (degree && degree !== "All levels") params.set("degree", degree.includes("Master") ? "master" : degree.includes("Undergraduate") ? "undergraduate" : "");
  if (!params.get("degree")) params.delete("degree");
  return `programs.html?${params.toString()}`;
}

function renderCards() {
  const filtered = sorted(scholarships.filter(matches));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, totalPages);
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);
  document.querySelector("#resultCount").textContent = filtered.length;
  document.querySelector("#resultContext").textContent = filtered.length === scholarships.length
    ? "Funding routes with type, country scope, coverage, deadline, and student fit."
    : "Filtered by your scholarship route preferences.";
  const grid = document.querySelector("#scholarshipGrid");
  grid.innerHTML = items.map((item) => {
    const key = scholarshipKey(item);
    const title = scholarshipTitle(item);
    const type = scholarshipType(item);
    const coverageItems = coverageValues(item);
    const shownCoverage = coverageItems.slice(0, 3);
    const hiddenCoverage = coverageItems.length - shownCoverage.length;
    const detailHref = `scholarship-detail.html?scholarship=${encodeURIComponent(scholarshipDetailKey(item))}`;
    return `
      <article class="scholarship-card" role="link" tabindex="0" data-scholarship-card data-detail-href="${detailHref}" aria-label="View ${escapeCatalogHtml(title)} funding details">
        <div class="scholarship-media">
          <img alt="Scholarship catalog marker" src="${scholarshipImage(item)}" loading="lazy" />
          <span class="badge type-badge ${type}">${escapeCatalogHtml(scholarshipTypeLabel(item))}</span>
          <button class="save-button ${saved.has(key) ? "saved" : ""}" type="button" data-save="${escapeCatalogHtml(key)}" aria-label="Save ${escapeCatalogHtml(title)}">${scholarshipIcons.heart}</button>
          <span class="scholarship-card-open" aria-hidden="true">${scholarshipIcons.arrowRight}</span>
        </div>
        <h3>${escapeCatalogHtml(title)}</h3>
        <p class="school-line">${escapeCatalogHtml(scholarshipProvider(item))}</p>
        <p class="summary">${escapeCatalogHtml(scholarshipSummary(item))}</p>
        <div class="coverage-chips">${shownCoverage.map((value) => `<span>${escapeCatalogHtml(value)}</span>`).join("")}${hiddenCoverage ? `<span>+${hiddenCoverage}</span>` : ""}</div>
        <div class="facts"><span><b>${escapeCatalogHtml(scholarshipFundingLabel(item))}</b>funding</span><span><b>${escapeCatalogHtml(scholarshipDegree(item))}</b>degree fit</span><span><b>${escapeCatalogHtml(scholarshipDeadlineLabel(item))}</b>deadline</span></div>
        <div class="scope-row" aria-label="Scholarship scope">${scholarshipScopeItems(item, filters.country).map((value) => `<span>${escapeCatalogHtml(value)}</span>`).join("")}</div>
        ${renderScholarshipReadiness(item)}
      </article>
    `;
  }).join("");
  if (!items.length) {
    grid.innerHTML = '<div class="catalog-list-state"><strong>No scholarships match</strong><span>Remove a filter or search for another published route.</span></div>';
  }
  document.querySelector("#pagination").innerHTML = Array.from({ length: totalPages }, (_, index) => `
    <button class="${index + 1 === page ? "active" : ""}" type="button" data-page="${index + 1}">${index + 1}</button>
  `).join("");
  renderActiveChips();
  renderFocus();
}

function renderFocus() {
  const panel = document.querySelector("#scholarshipFocus");
  const item = scholarships.find((entry) => scholarshipKey(entry) === focusedScholarshipId);
  if (!item) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  document.querySelector("#focusType").textContent = scholarshipTypeLabel(item);
  document.querySelector("#focusType").className = `badge type-badge ${scholarshipType(item)}`;
  document.querySelector("#focusTitle").textContent = scholarshipTitle(item);
  document.querySelector("#focusSummary").textContent = scholarshipSummary(item);
  document.querySelector("#focusPrograms").href = matchingProgramsHref(item);
  const detailLink = document.querySelector("[data-scholarship-detail-link]");
  if (detailLink) detailLink.href = `scholarship-detail.html?scholarship=${encodeURIComponent(scholarshipDetailKey(item))}`;
  document.querySelector("#focusFacts").innerHTML = [
    ["Coverage", coverageValues(item).join(", ")],
    ["Degree fit", scholarshipDegree(item)],
    ["Country scope", scholarshipCountryScope(item).slice(0, 3).join(", ") || "Check notice"],
    ["Linked routes", scholarshipScopeSummary(item)],
    ["Deadline", scholarshipDeadlineLabel(item)],
  ].map(([label, value]) => `<span><b>${label}</b>${escapeCatalogHtml(value)}</span>`).join("");
}

function renderActiveChips() {
  const chips = [];
  if (filters.keyword) chips.push(["keyword", `Search: ${filters.keyword}`]);
  if (routeCityFocus) chips.push(["city", `${routeCityFocus} related`]);
  if (filters.funding !== "all") chips.push(["funding", filters.funding === "full" ? "Full funding" : "Partial funding"]);
  if (filters.type !== "all") chips.push(["type", `${filters.type} route`]);
  if (filters.degree !== "all") chips.push(["degree", filters.degree]);
  if (filters.country !== "all") chips.push(["country", filters.country]);
  if (filters.deadline !== "all") chips.push(["deadline", filters.deadline === "soon" ? "Deadline soon" : filters.deadline]);
  if (filters.coverage) chips.push(["coverage", "Includes stipend"]);
  document.querySelector("#activeChips").innerHTML = chips.length
    ? chips.map(([key, label]) => `<button class="filter-chip active" type="button" data-clear="${key}">${escapeCatalogHtml(label)} x</button>`).join("")
    : '<span class="filter-chip">No filters applied</span>';
}

function renderFilters() {
  document.querySelector("#filterGroups").innerHTML = `
    ${filterConfig.map(([group, controls]) => `
      <div class="filter-group"><span>${group}</span>${controls.map(([key, label, options]) => {
        const resolvedOptions = typeof options === "function" ? options() : options;
        return `
        <label><span>${label}</span><select class="filter-select" data-filter-key="${key}">${resolvedOptions.map(([value, text]) => `<option value="${escapeCatalogHtml(value)}">${escapeCatalogHtml(text)}</option>`).join("")}</select></label>
      `;
      }).join("")}</div>
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
  Object.assign(filters, { keyword: "", funding: "all", type: "all", degree: "all", country: "all", deadline: "all", coverage: false });
  if (value === "all") {
    focusedScholarshipId = null;
  } else if (value === "full") filters.funding = "full";
  else if (value === "deadline") filters.deadline = "soon";
  else filters.type = value;
  page = 1;
  syncFilters();
  renderCards();
}

function findScholarshipFromHash(value = window.location.hash) {
  const hash = slugifyRouteParam(String(value || "").replace(/^#/, ""));
  if (!hash) return null;
  const aliases = {
    csc: ["csc", "government"],
    zju: ["zju", "zhejiang"],
    zhejiang: ["zju", "zhejiang"],
    shanghai: ["shanghai"],
    jiangsu: ["jiangsu", "jasmine", "nanjing"],
  }[hash] || [hash];
  return scholarships.find((item) => {
    const haystack = slugifyRouteParam([scholarshipTitle(item), scholarshipProvider(item), scholarshipTypeLabel(item), scholarshipSummary(item), ...scholarshipSearchTags(item)].join(" "));
    return aliases.some((alias) => haystack.includes(slugifyRouteParam(alias)));
  }) || null;
}

function applyHashFocus() {
  const item = findScholarshipFromHash();
  if (!item) return;
  focusedScholarshipId = scholarshipKey(item);
  filters.type = scholarshipType(item) || filters.type;
  if (scholarshipFundingLevel(item) !== "unknown") filters.funding = scholarshipFundingLevel(item);
  page = 1;
}

function showScholarshipAgentNotice(message, options = {}) {
  let notice = document.querySelector("[data-scholarship-agent-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "scholarship-agent-notice";
    notice.dataset.scholarshipAgentNotice = "";
    document.querySelector("#scholarship-browser .section-head")?.appendChild(notice);
  }
  if (options.html) notice.innerHTML = message;
  else notice.textContent = message;
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
    Object.assign(filters, { funding: "full", type: "all", degree: "Master", country: "all", deadline: "all", coverage: true });
    sort = "full";
    page = 1;
    syncFilters();
    renderCards();
    showScholarshipAgentNotice("Agent filtered for full funding, Master fit, and stipend coverage.");
    document.querySelector("#scholarship-browser")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-program-shortlist") {
    ["csc", "zhejiang-university-international-student-scholarship", "jiangsu-jasmine-scholarship"].forEach((key) => {
      const item = scholarships.find((entry) => scholarshipKey(entry) === key || scholarshipTitle(entry).toLowerCase().includes(key.split("-")[0]));
      saved.add(item ? scholarshipKey(item) : key);
    });
    renderCards();
    showScholarshipAgentNotice("Agent saved CSC, ZJU, and Jiangsu scholarship routes.");
    detail.setUndo?.(before);
    return true;
  }
  if (action === "open-choice-modal") {
    window.location.href = matchingProgramsHref({ type: filters.type === "all" ? "" : filters.type, funding: filters.funding === "all" ? "" : filters.funding, degree: filters.degree });
    return true;
  }
  if (action === "save-checklist") {
    focusedScholarshipId = scholarshipKey(scholarships[0] || {});
    renderFocus();
    showScholarshipAgentNotice("Agent opened the CSC route because its funding checklist is the most complete path.");
    document.querySelector("#scholarshipFocus")?.scrollIntoView({ behavior: "smooth", block: "center" });
    detail.setUndo?.(before);
    return true;
  }
  return false;
}

document.addEventListener("click", (event) => {
  const save = event.target.closest("[data-save]");
  if (save) {
    const resumeSelector = window.CUAC?.dataAttributeSelector?.("data-save", save.dataset.save) || "[data-save]";
    if (window.CUAC?.requireStudentSignedIn && !window.CUAC.requireStudentSignedIn("Save this scholarship", { resumeAction: { type: "click-selector", selector: resumeSelector } })) return;
    const key = save.dataset.save;
    const item = scholarships.find((entry) => scholarshipKey(entry) === key);
    const savedNow = !saved.has(key);
    if (savedNow) saved.add(key);
    else saved.delete(key);
    renderCards();
    showScholarshipAgentNotice(
      savedNow
        ? `Saved ${item ? scholarshipTitle(item) : "scholarship"} to Favourites. <a href="favourites.html">Review funding context</a>`
        : `Removed ${item ? scholarshipTitle(item) : "scholarship"} from Favourites.`,
      { html: savedNow },
    );
    return;
  }
  const scholarshipCard = event.target.closest("[data-scholarship-card]");
  if (scholarshipCard && !event.target.closest("button, a, [data-save]")) {
    window.location.href = scholarshipCard.dataset.detailHref;
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
    if (key === "city") routeCityFocus = "";
    else filters[key] = key === "coverage" ? false : key === "keyword" ? "" : "all";
    page = 1;
    syncFilters();
    renderCards();
    return;
  }
  const detail = event.target.closest("[data-detail]");
  if (detail) {
    focusedScholarshipId = detail.dataset.detail;
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

document.addEventListener("keydown", (event) => {
  const scholarshipCard = event.target.closest("[data-scholarship-card]");
  if (!scholarshipCard) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  window.location.href = scholarshipCard.dataset.detailHref;
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
  Object.assign(filters, { keyword: "", funding: "all", type: "all", degree: "all", country: "all", deadline: "all", coverage: false });
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

const routeParams = new URLSearchParams(window.location.search);
filters.keyword = routeParams.get("keyword") || routeParams.get("q") || "";
routeCityFocus = normalizeCityParam(routeParams.get("city"));
if (routeParams.get("fundingLevel") || routeParams.get("funding")) filters.funding = normalizeScholarshipFundingParam(routeParams.get("fundingLevel") || routeParams.get("funding"));
if (routeParams.get("route") || routeParams.get("type")) filters.type = normalizeScholarshipTypeParam(routeParams.get("route") || routeParams.get("type"));
if (routeParams.get("applicableDegree") || routeParams.get("degree")) filters.degree = normalizeScholarshipDegreeParam(routeParams.get("applicableDegree") || routeParams.get("degree"));
if (routeParams.get("country") || routeParams.get("targetCountry")) filters.country = routeParams.get("country") || routeParams.get("targetCountry");
if (routeParams.get("region") || routeParams.get("targetRegion")) filters.country = routeParams.get("region") || routeParams.get("targetRegion");
applyHashFocus();

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
window.CuacCatalogList.listState(document.querySelector("#scholarshipGrid"), "loading", { noun: "scholarships" });

async function loadScholarships() {
  const grid = document.querySelector("#scholarshipGrid");
  window.CuacCatalogList.listState(grid, "loading", { noun: "scholarships" });
  document.querySelector("#resultCount").textContent = "-";
  document.querySelector("#resultContext").textContent = "Reading the current published catalog.";
  try {
    const records = await window.CuacCatalogList.load("scholarships", { limit: 100 });
    scholarships.splice(0, scholarships.length, ...records);
    const futureDeadlines = scholarships
      .map((item) => new Date(item.deadlineDate))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= Date.now())
      .sort((a, b) => a.getTime() - b.getTime());
    document.querySelector("#summaryFundingRoutes").textContent = scholarships.length;
    document.querySelector("#summaryFullFunding").textContent = scholarships.filter((item) => scholarshipFundingLevel(item) === "full").length;
    document.querySelector("#summaryDeadlineWindow").textContent = futureDeadlines.length
      ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(futureDeadlines[0])
      : "Not published";
    applyHashFocus();
    renderFilters();
    renderCards();
  } catch (error) {
    document.querySelector("#resultContext").textContent = "The published catalog could not be loaded.";
    window.CuacCatalogList.listState(grid, "error", { noun: "scholarships", message: error.message });
  }
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-catalog-retry]")) loadScholarships();
});

loadScholarships();

window.addEventListener("hashchange", () => {
  applyHashFocus();
  syncFilters();
  renderCards();
  document.querySelector("#scholarshipFocus")?.scrollIntoView({ behavior: "smooth", block: "center" });
});
