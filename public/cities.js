const cityIcons = {
  cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H15a3.5 3.5 0 0 1 0 7H6"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
};

const cities = [];

let activeCity = "hangzhou";
const escapeCatalogHtml = window.CuacCatalogList.escapeHtml;
let activeNeed = "all";
let budgetMode = "lean";
let sortMode = "fit";
let routeQuery = "";
let routeRegion = "";
let routeCostLevel = "";
let routeDensity = "";

function cityFromHash(value = window.location.hash) {
  const hash = String(value || "").replace(/^#/, "").trim().toLowerCase();
  if (!hash) return null;
  return cities.find((city) => citySlug(city) === hash || String(city.id || "") === hash || cityName(city).toLowerCase() === hash) || null;
}

function applyHashCity(value = window.location.hash) {
  const city = cityFromHash(value);
  if (!city) return false;
  activeCity = citySlug(city);
  return true;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value || "");
}

function normalizeLevel(value) {
  const slug = normalizeSearchText(value).replace(/\s+/g, "-");
  return {
    low: "low",
    "低": "low",
    lower: "low",
    medium: "medium",
    mid: "medium",
    "中": "medium",
    balanced: "medium",
    high: "high",
    "高": "high",
    dense: "high",
    calm: "low",
    relaxed: "low",
    fast: "high",
  }[slug] || slug;
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `RMB ${amount.toLocaleString("en-US")}` : "Not published";
}

function currentCity() {
  return cities.find((city) => citySlug(city) === activeCity || city.id === activeCity) || cities[0];
}

function citySlug(city = {}) {
  return city.slug || city.id || String(city.nameEn || city.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function cityName(city = {}) {
  return city.nameEn || city.name || "City to confirm";
}

function citySearchText(city = {}) {
  return flattenText([
    city.nameEn,
    city.nameZh,
    city.name,
    city.slug,
    city.region,
    city.province,
    city.tags,
    city.bestFor,
    city.contentJson,
    city.content,
    city.summary,
    city.density,
  ]);
}

function cityProvince(city = {}) {
  return city.province || city.region || "China";
}

function cityMonthlyCost(city = {}) {
  const amount = Number(city.monthlyCostRmb ?? city.monthlyCost);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function citySchoolCount(city = {}) {
  return city.referenceSchoolCount ?? city.universities ?? city.references?.schoolCount ?? 0;
}

function cityProgramCount(city = {}) {
  return city.referenceProgramCount ?? city.programs ?? city.references?.programCount ?? 0;
}

function cityEnglishRouteCount(city = {}) {
  return city.referenceEnglishProgramCount ?? city.englishRoutes ?? city.references?.englishProgramCount ?? 0;
}

function cityScholarshipCount(city = {}) {
  return city.referenceScholarshipCount ?? city.scholarships ?? city.references?.scholarshipCount ?? 0;
}

function cityDensityLevel(city = {}) {
  return normalizeLevel(city.density || "");
}

function cityBestFor(city = {}) {
  return city.bestFor || city.contentJson?.bestFor || city.content?.bestFor || [];
}

function citySummary(city = {}) {
  return city.summary || city.contentJson?.summary || city.content?.summary || "No city summary published.";
}

function cityCostBreakdown(city = {}) {
  if (city.costBreakdown && !Array.isArray(city.costBreakdown)) return city.costBreakdown;
  const rows = city.contentJson?.costBreakdown || city.content?.costBreakdown || [];
  return Object.fromEntries(rows.map((row) => [
    String(row.label || "cost").toLowerCase(),
    Number(String(row.value || "").replace(/[^0-9]/g, "")) || 0,
  ]));
}

function filteredCities() {
  let list = [...cities];
  if (routeQuery) {
    const tokens = normalizeSearchText(routeQuery).split(/\s+/).filter(Boolean);
    list = list.filter((city) => {
      const haystack = normalizeSearchText(citySearchText(city));
      return tokens.every((token) => haystack.includes(token));
    });
  }
  if (routeRegion) {
    const region = normalizeSearchText(routeRegion);
    list = list.filter((city) => normalizeSearchText([cityProvince(city), city.region, city.province].join(" ")).includes(region));
  }
  if (routeCostLevel) list = list.filter((city) => normalizeLevel(city.costLevel) === routeCostLevel);
  if (routeDensity) list = list.filter((city) => cityDensityLevel(city) === routeDensity);
  if (activeNeed !== "all") {
    list = list.filter((city) => cityBestFor(city).some((tag) => tag.includes(activeNeed)) || (city.tags || []).some((tag) => tag.toLowerCase().includes(activeNeed)));
  }
  if (sortMode === "costLow") list.sort((a, b) => (cityMonthlyCost(a) ?? Number.MAX_SAFE_INTEGER) - (cityMonthlyCost(b) ?? Number.MAX_SAFE_INTEGER));
  if (sortMode === "english") list.sort((a, b) => cityEnglishRouteCount(b) - cityEnglishRouteCount(a));
  if (sortMode === "scholarship") list.sort((a, b) => cityScholarshipCount(b) - cityScholarshipCount(a));
  return list;
}

function renderRail() {
  document.querySelector("#cityRail").innerHTML = cities.map((city) => `
    <button class="rail-city ${citySlug(city) === activeCity ? "active" : ""}" type="button" data-city="${escapeCatalogHtml(citySlug(city))}">
      <strong>${escapeCatalogHtml(cityName(city))}</strong>
      <span>${escapeCatalogHtml(cityProvince(city))}${city.density ? ` · ${escapeCatalogHtml(city.density)}` : ""}</span>
      <b>${escapeCatalogHtml(money(cityMonthlyCost(city)))}</b>
      <span>${escapeCatalogHtml((city.tags || [])[0] || city.costLevel || "Published guide")}</span>
    </button>
  `).join("");
}

function renderFeature() {
  const city = currentCity();
  document.querySelector("#featureStory").innerHTML = `
    <div class="story-image">
      <img alt="City catalog marker" src="globe.svg" />
      <div class="story-label">${(city.tags || []).map((tag) => `<span>${escapeCatalogHtml(tag)}</span>`).join("")}</div>
    </div>
    <article class="story-copy">
      <div>
        <span class="badge">${escapeCatalogHtml(city.region || city.province || "Region not published")}</span>
        <h2>${escapeCatalogHtml(cityName(city))}</h2>
        <p>${escapeCatalogHtml(citySummary(city))}</p>
      </div>
      <div class="story-facts">
        <div><strong>${money(cityMonthlyCost(city))}</strong><span>monthly living estimate</span></div>
        <div><strong>${cityEnglishRouteCount(city)}</strong><span>English-taught routes</span></div>
        <div><strong>${cityScholarshipCount(city)}</strong><span>scholarship routes</span></div>
        <div><strong>${citySchoolCount(city)}</strong><span>referenced schools</span></div>
      </div>
      <div class="story-actions">
        <a class="city-story-action city-story-main" href="city-detail.html?city=${encodeURIComponent(citySlug(city))}">View city</a>
        <a class="city-story-action" href="programs.html?city=${encodeURIComponent(citySlug(city))}">Programs</a>
        <a class="city-story-action" href="universities.html?city=${encodeURIComponent(citySlug(city))}">Universities</a>
        <a class="city-story-action" href="scholarships.html?city=${encodeURIComponent(citySlug(city))}">Scholarships</a>
      </div>
    </article>
  `;
}

function costClass(city) {
  if (city.costLevel === "low") return "low";
  if (city.costLevel === "high") return "high";
  return "";
}

function renderMatrix() {
  document.querySelector("#fitMatrix").innerHTML = `
    <table class="matrix-table">
      <thead>
        <tr>
          <th>City</th>
          <th>Monthly cost</th>
          <th>Schools</th>
          <th>English routes</th>
          <th>Scholarships</th>
          <th>Programs</th>
          <th>Next</th>
        </tr>
      </thead>
      <tbody>
        ${cities.map((city) => `
          <tr data-city-row="${citySlug(city)}">
            <td><div class="matrix-city"><strong>${escapeCatalogHtml(cityName(city))}</strong><span>${escapeCatalogHtml(cityProvince(city))}</span></div></td>
            <td><span class="cost ${costClass(city)}">${money(cityMonthlyCost(city))}</span></td>
            <td>${citySchoolCount(city)}<div class="signal">catalog snapshot</div></td>
            <td>${cityEnglishRouteCount(city)}<div class="signal">program routes</div></td>
            <td>${cityScholarshipCount(city)}<div class="signal">funding routes</div></td>
            <td>${cityProgramCount(city)}<div class="signal">catalog snapshot</div></td>
            <td><a class="matrix-action" href="programs.html?city=${encodeURIComponent(citySlug(city))}">Programs</a></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderNeeds() {
  const tags = [...new Set(cities.flatMap((city) => Array.isArray(city.tags) ? city.tags : []).filter(Boolean))];
  const section = document.querySelector("#cityTagSection");
  section.hidden = tags.length === 0;
  document.querySelector("#needGrid").innerHTML = tags.map((tag) => `
    <button class="need-card ${activeNeed === String(tag).toLowerCase() ? "active" : ""}" type="button" data-need="${String(tag).toLowerCase()}">
      <span class="need-icon">${cityIcons.cost}</span>
      <strong>${escapeCatalogHtml(tag)}</strong>
      <span>Published city tag</span>
    </button>
  `).join("");
}

function renderActiveChips() {
  const chips = [];
  if (routeQuery) chips.push(["query", `Search: ${routeQuery}`]);
  if (routeRegion) chips.push(["region", `Region: ${routeRegion}`]);
  if (routeCostLevel) chips.push(["cost", `${routeCostLevel} cost`]);
  if (routeDensity) chips.push(["density", `${routeDensity} density`]);
  if (activeNeed !== "all") chips.push(["need", activeNeed]);
  document.querySelector("#activeChips").innerHTML = chips.length
    ? chips.map(([key, label]) => `<button class="filter-chip active" type="button" data-clear-city-filter="${key}">${escapeCatalogHtml(label)} x</button>`).join("")
    : '<span class="filter-chip">No city filters selected</span>';
}

function syncCityControls() {
  const sortSelect = document.querySelector("#sortSelect");
  if (sortSelect) sortSelect.value = sortMode;
}

function renderCityCards() {
  const list = filteredCities();
  document.querySelector("#cityCount").textContent = list.length;
  document.querySelector("#cityContext").textContent = activeNeed === "all"
    ? "Published city guides with source-backed costs and catalog reference snapshots."
    : `Filtered by ${activeNeed}.`;
  document.querySelector("#cityGrid").innerHTML = list.map((city) => {
    const detailHref = `city-detail.html?city=${encodeURIComponent(citySlug(city))}`;
    return `
    <article class="city-card" role="link" tabindex="0" data-city-card data-detail-href="${detailHref}" aria-label="View ${escapeCatalogHtml(cityName(city))} city guide">
      <div class="city-media">
        <img alt="City catalog marker" src="globe.svg" loading="lazy" />
        <span class="badge">${escapeCatalogHtml(city.costLevel ? `${city.costLevel} cost` : "Cost not published")}</span>
        <span class="city-card-open" aria-hidden="true">${cityIcons.arrowRight}</span>
      </div>
      <h3>${escapeCatalogHtml(cityName(city))}</h3>
      <p class="province">${escapeCatalogHtml([cityProvince(city), city.region].filter(Boolean).join(" · "))}</p>
      <p class="summary">${escapeCatalogHtml(citySummary(city))}</p>
      <div class="city-tags">${(city.tags || []).slice(0, 3).map((tag) => `<span>${escapeCatalogHtml(tag)}</span>`).join("")}</div>
      <div class="city-stats">
        <span><b>${money(cityMonthlyCost(city))}</b>monthly</span>
        <span><b>${cityProgramCount(city)}</b>programs</span>
        <span><b>${cityEnglishRouteCount(city)}</b>English</span>
      </div>
    </article>
  `;
  }).join("");
  syncCityControls();
  renderActiveChips();
}

function budgetMultiplier() {
  if (budgetMode === "balanced") return 1.12;
  if (budgetMode === "comfortable") return 1.28;
  return 1;
}

function renderBudget() {
  const city = currentCity();
  const lab = document.querySelector(".cost-lab");
  if (!city) {
    if (lab) lab.hidden = true;
    return;
  }
  const multiplier = budgetMultiplier();
  const entries = Object.entries(cityCostBreakdown(city)).map(([label, value]) => [label, Math.round(value * multiplier)]);
  if (lab) lab.hidden = entries.length === 0;
  if (!entries.length) return;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  document.querySelector("#budgetCity").textContent = cityName(city);
  document.querySelector("#budgetTotal").textContent = total ? money(total) : "Pending";
  document.querySelector("#budgetIntro").textContent = `Start with ${cityName(city)}, then switch lifestyle level to see how accommodation, food, transport, and personal spending change.`;
  document.querySelector("#budgetBars").innerHTML = entries.map(([label, value]) => `
    <div class="budget-row">
      <span>${label[0].toUpperCase()}${label.slice(1)}</span>
      <span class="bar-track"><span class="bar-fill" style="width: ${total ? Math.max(10, (value / total) * 100) : 0}%"></span></span>
      <strong>${money(value)}</strong>
    </div>
  `).join("");
  document.querySelectorAll("[data-budget-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.budgetMode === budgetMode);
  });
}

function renderAll() {
  if (!cities.length) {
    document.querySelector("#cityCount").textContent = "0";
    document.querySelector("#cityContext").textContent = "No published city guides are available.";
    window.CuacCatalogList.listState(document.querySelector("#cityGrid"), "error", { noun: "cities", message: "No published city guides are available." });
    document.querySelector("#cityRail").innerHTML = "";
    document.querySelector("#featureStory").innerHTML = "";
    document.querySelector("#fitMatrix").innerHTML = "";
    document.querySelector("#cityTagSection").hidden = true;
    return;
  }
  renderRail();
  renderFeature();
  renderMatrix();
  renderNeeds();
  renderCityCards();
  renderBudget();
}

function showCityAgentNotice(message) {
  let notice = document.querySelector("[data-city-agent-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "city-agent-notice";
    notice.dataset.cityAgentNotice = "";
    const anchor = document.querySelector("#cityList .browser-tools") || document.querySelector("#cityList") || document.querySelector(".cost-lab");
    anchor?.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function captureCityState() {
  return {
    activeCity,
    activeNeed,
    sortMode,
    budgetMode,
    notice: document.querySelector("[data-city-agent-notice]")?.textContent || "",
  };
}

function restoreCityState(snapshot) {
  if (!snapshot) return;
  activeCity = snapshot.activeCity || "hangzhou";
  activeNeed = snapshot.activeNeed || "all";
  sortMode = snapshot.sortMode || "recommended";
  budgetMode = snapshot.budgetMode || "lean";
  renderAll();
  const notice = document.querySelector("[data-city-agent-notice]");
  if (notice) {
    notice.textContent = snapshot.notice;
    notice.classList.toggle("visible", Boolean(snapshot.notice));
  }
}

function applyCityAgentAction(action, detail = {}) {
  const before = captureCityState();
  if (action === "apply-smart-filters" || action === "compare-routes") {
    activeNeed = "lower cost";
    sortMode = "costLow";
    activeCity = "nanjing";
    budgetMode = "lean";
    renderAll();
    showCityAgentNotice("Agent prioritized lower-cost cities and selected Nanjing as a backup route.");
    document.querySelector("#cityList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-cost-estimate") {
    activeCity = activeCity || "hangzhou";
    budgetMode = "balanced";
    renderRail();
    renderFeature();
    renderBudget();
    showCityAgentNotice("Agent saved a balanced monthly budget estimate for the current city.");
    document.querySelector(".cost-lab")?.scrollIntoView({ behavior: "smooth", block: "center" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-program-shortlist") {
    window.location.href = `programs.html?city=${encodeURIComponent(activeCity || "hangzhou")}`;
    return true;
  }
  return false;
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-catalog-retry]")) {
    loadCities();
    return;
  }
  const cityCard = event.target.closest("[data-city-card]");
  if (cityCard && !event.target.closest("a, button, input, select, textarea")) {
    window.location.href = cityCard.dataset.detailHref;
    return;
  }
  const cityButton = event.target.closest("[data-city]");
  if (cityButton) {
    activeCity = cityButton.dataset.city;
    if (window.location.hash !== `#${activeCity}`) history.replaceState(null, "", `#${activeCity}`);
    renderRail();
    renderFeature();
    renderBudget();
    document.querySelector("#featureStory").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const needButton = event.target.closest("[data-need]");
  if (needButton) {
    activeNeed = activeNeed === needButton.dataset.need ? "all" : needButton.dataset.need;
    renderNeeds();
    renderCityCards();
    document.querySelector("#cityList").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (event.target.closest("[data-clear-need]")) {
    activeNeed = "all";
    renderNeeds();
    renderCityCards();
    return;
  }
  const clearCityFilter = event.target.closest("[data-clear-city-filter]");
  if (clearCityFilter) {
    const key = clearCityFilter.dataset.clearCityFilter;
    if (key === "query") routeQuery = "";
    if (key === "region") routeRegion = "";
    if (key === "cost") routeCostLevel = "";
    if (key === "density") routeDensity = "";
    if (key === "need") activeNeed = "all";
    renderNeeds();
    renderCityCards();
    return;
  }
  const filterButton = event.target.closest("[data-city-filter]");
  if (filterButton) {
    if (filterButton.dataset.cityFilter === "all") {
      activeNeed = "all";
      routeQuery = "";
      routeRegion = "";
      routeCostLevel = "";
      routeDensity = "";
    } else {
      activeNeed = filterButton.dataset.cityFilter;
    }
    renderNeeds();
    renderCityCards();
    return;
  }
  const budgetButton = event.target.closest("[data-budget-mode]");
  if (budgetButton) {
    budgetMode = budgetButton.dataset.budgetMode;
    renderBudget();
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
  const cityCard = event.target.closest("[data-city-card]");
  if (!cityCard || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  window.location.href = cityCard.dataset.detailHref;
});

document.querySelector("#sortSelect").addEventListener("change", (event) => {
  sortMode = event.target.value;
  renderCityCards();
});

document.addEventListener("cuac:agent-action", (event) => {
  if (applyCityAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
});

document.addEventListener("cuac:agent-undo", (event) => {
  if (!event.detail?.undo) return;
  restoreCityState(event.detail.undo);
  event.preventDefault();
});

const revealItems = Array.from(document.querySelectorAll(".reveal"));
const routeParams = new URLSearchParams(window.location.search);
function applyRouteCityParams(params = routeParams) {
  routeQuery = params.get("keyword") || params.get("q") || "";
  routeRegion = params.get("region") || params.get("province") || "";
  routeCostLevel = normalizeLevel(params.get("costLevel") || params.get("cost") || "");
  routeDensity = normalizeLevel(params.get("density") || params.get("universityDensity") || "");
  const need = normalizeSearchText(params.get("need") || params.get("fit") || "").replace(/\s+/g, " ");
  if (cities.some((item) => (item.tags || []).some((tag) => String(tag).toLowerCase() === need))) activeNeed = need;
  const sort = params.get("sort");
  if (["fit", "costLow", "english", "scholarship"].includes(sort)) sortMode = sort;
  if (sort === "cost") sortMode = "costLow";
  const cityParam = params.get("city") || params.get("slug") || "";
  const city = cityParam ? cities.find((item) => citySlug(item) === normalizeSearchText(cityParam).replace(/\s+/g, "-") || normalizeSearchText(cityName(item)) === normalizeSearchText(cityParam) || normalizeSearchText(item.nameZh) === normalizeSearchText(cityParam)) : null;
  if (city) activeCity = citySlug(city);
}
if (routeParams.get("motion") === "off") document.body.classList.add("motion-off");
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

window.CuacCatalogList.listState(document.querySelector("#cityGrid"), "loading", { noun: "cities" });

async function loadCities() {
  const grid = document.querySelector("#cityGrid");
  window.CuacCatalogList.listState(grid, "loading", { noun: "cities" });
  document.querySelector("#cityCount").textContent = "-";
  document.querySelector("#cityContext").textContent = "Reading the current published catalog.";
  try {
    const records = await window.CuacCatalogList.load("cities", { limit: 100 });
    cities.splice(0, cities.length, ...records);
    activeCity = cities[0] ? citySlug(cities[0]) : "";
    applyRouteCityParams();
    if (!routeParams.get("city") && !routeParams.get("slug")) applyHashCity();

    const costs = cities.map(cityMonthlyCost).filter((value) => value != null).sort((a, b) => a - b);
    document.querySelector("#cityGuideTotal").textContent = cities.length;
    document.querySelector("#cityCostRange").textContent = costs.length
      ? `${money(costs[0])}${costs.length > 1 ? ` - ${money(costs[costs.length - 1])}` : ""}`
      : "Not published";
    document.querySelector("#cityProgramTotal").textContent = cities.reduce((total, city) => total + cityProgramCount(city), 0);
    renderAll();
  } catch (error) {
    document.querySelector("#cityContext").textContent = "The published catalog could not be loaded.";
    window.CuacCatalogList.listState(grid, "error", { noun: "cities", message: error.message });
  }
}

loadCities();

window.addEventListener("hashchange", () => {
  if (!applyHashCity()) return;
  renderRail();
  renderFeature();
  renderBudget();
  document.querySelector("#featureStory")?.scrollIntoView({ behavior: "smooth", block: "center" });
});
