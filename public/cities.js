const cityIcons = {
  cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H15a3.5 3.5 0 0 1 0 7H6"/></svg>',
  tech: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v10H4Z"/><path d="M8 3v4M16 3v4M8 17v4M16 17v4"/><path d="M9 11h6"/></svg>',
  pace: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a8 8 0 1 0 16 0"/><path d="M12 14 17 9"/><path d="M7 4h10"/></svg>',
  scholarship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M5 6H3a4 4 0 0 0 4 4"/><path d="M19 6h2a4 4 0 0 1-4 4"/></svg>',
  language: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>',
  climate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

const cities = [
  {
    id: "hangzhou",
    name: "Hangzhou",
    province: "Zhejiang",
    region: "East China",
    image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
    monthlyCostRmb: 3600,
    costLevel: "medium",
    pace: "balanced",
    climate: "Mild, humid, and green.",
    summary: "A strong tech and university city with calmer daily life than Shanghai.",
    bestFor: ["tech", "calmer pace", "medium cost"],
    tags: ["Tech city", "Medium cost", "Good first city"],
    universities: 12,
    programs: 31,
    englishRoutes: 18,
    scholarships: 9,
    industry: "Tech and digital economy",
    language: "English routes plus useful Chinese exposure",
    arrival: "Easy high-speed rail links with Shanghai.",
    representative: ["Zhejiang University", "China Academy of Art"],
    costBreakdown: { accommodation: 1500, food: 1050, transport: 220, personal: 830 },
  },
  {
    id: "shanghai",
    name: "Shanghai",
    province: "Shanghai",
    region: "East China",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 5200,
    costLevel: "high",
    pace: "fast",
    climate: "Humid summers and cool winters.",
    summary: "International, fast moving, and rich in internships, but budget pressure is higher.",
    bestFor: ["international", "internships", "business"],
    tags: ["International", "High cost", "Internships"],
    universities: 18,
    programs: 42,
    englishRoutes: 26,
    scholarships: 12,
    industry: "Finance, business, design, tech",
    language: "Easier English daily life than smaller cities",
    arrival: "Most international arrival options.",
    representative: ["Fudan University", "Tongji University"],
    costBreakdown: { accommodation: 2450, food: 1350, transport: 320, personal: 1080 },
  },
  {
    id: "beijing",
    name: "Beijing",
    province: "Beijing",
    region: "North China",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 4800,
    costLevel: "high",
    pace: "fast",
    climate: "Cold winters, dry springs, warm summers.",
    summary: "Academic, cultural, and policy-centered with many top universities.",
    bestFor: ["research", "culture", "language"],
    tags: ["Academic", "Culture", "High cost"],
    universities: 22,
    programs: 39,
    englishRoutes: 20,
    scholarships: 14,
    industry: "Research, policy, technology",
    language: "Strong Mandarin environment",
    arrival: "Major arrival hub with broad transport links.",
    representative: ["Tsinghua University", "Beijing Language and Culture University"],
    costBreakdown: { accommodation: 2200, food: 1280, transport: 300, personal: 1020 },
  },
  {
    id: "shenzhen",
    name: "Shenzhen",
    province: "Guangdong",
    region: "South China",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 4600,
    costLevel: "high",
    pace: "fast",
    climate: "Warm and subtropical.",
    summary: "Young, startup-heavy, and technology-focused with a warmer daily rhythm.",
    bestFor: ["tech", "internships", "warm climate"],
    tags: ["Startups", "Warm climate", "High cost"],
    universities: 8,
    programs: 19,
    englishRoutes: 11,
    scholarships: 5,
    industry: "Hardware, AI, startups",
    language: "International pockets but Chinese useful",
    arrival: "Good links through Shenzhen and Hong Kong.",
    representative: ["Harbin Institute of Technology Shenzhen", "Shenzhen University"],
    costBreakdown: { accommodation: 2150, food: 1220, transport: 260, personal: 970 },
  },
  {
    id: "nanjing",
    name: "Nanjing",
    province: "Jiangsu",
    region: "East China",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3400,
    costLevel: "medium",
    pace: "balanced",
    climate: "Hot summers and cool winters.",
    summary: "A university-dense city with lower living pressure than Shanghai.",
    bestFor: ["lower cost", "research", "student city"],
    tags: ["University dense", "Medium cost", "Student city"],
    universities: 16,
    programs: 28,
    englishRoutes: 15,
    scholarships: 10,
    industry: "Research, software, culture",
    language: "Good campus support; Chinese helpful",
    arrival: "Convenient rail links across East China.",
    representative: ["Nanjing University", "Southeast University"],
    costBreakdown: { accommodation: 1400, food: 980, transport: 220, personal: 800 },
  },
  {
    id: "chengdu",
    name: "Chengdu",
    province: "Sichuan",
    region: "Southwest China",
    image: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3200,
    costLevel: "low",
    pace: "calm",
    climate: "Humid and mild with less winter cold.",
    summary: "Lower cost, relaxed daily life, and growing medical and engineering routes.",
    bestFor: ["lower cost", "calmer pace", "medicine"],
    tags: ["Lower cost", "Relaxed", "Southwest"],
    universities: 13,
    programs: 24,
    englishRoutes: 12,
    scholarships: 8,
    industry: "Biomedicine, gaming, manufacturing",
    language: "Chinese daily life matters more",
    arrival: "Major western China hub.",
    representative: ["Sichuan University", "University of Electronic Science and Technology of China"],
    costBreakdown: { accommodation: 1250, food: 930, transport: 200, personal: 820 },
  },
  {
    id: "wuhan",
    name: "Wuhan",
    province: "Hubei",
    region: "Central China",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3300,
    costLevel: "low",
    pace: "balanced",
    climate: "Hot summers and cool winters.",
    summary: "Large student population, strong engineering and medicine routes, and lower cost.",
    bestFor: ["lower cost", "engineering", "student city"],
    tags: ["Student city", "Lower cost", "Engineering"],
    universities: 18,
    programs: 27,
    englishRoutes: 13,
    scholarships: 9,
    industry: "Optics, engineering, health science",
    language: "Campus support important",
    arrival: "Central China transport hub.",
    representative: ["Wuhan University", "Huazhong University of Science and Technology"],
    costBreakdown: { accommodation: 1320, food: 960, transport: 210, personal: 810 },
  },
  {
    id: "xian",
    name: "Xi'an",
    province: "Shaanxi",
    region: "Northwest China",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3100,
    costLevel: "low",
    pace: "calm",
    climate: "Dry, cold winters and warm summers.",
    summary: "Historic, affordable, and strong for engineering, language, and culture-oriented students.",
    bestFor: ["lower cost", "culture", "engineering"],
    tags: ["Affordable", "Culture", "Engineering"],
    universities: 14,
    programs: 22,
    englishRoutes: 10,
    scholarships: 7,
    industry: "Aerospace, engineering, culture",
    language: "Good Chinese immersion context",
    arrival: "Good domestic links; fewer direct international routes.",
    representative: ["Xi'an Jiaotong University", "Northwestern Polytechnical University"],
    costBreakdown: { accommodation: 1200, food: 900, transport: 190, personal: 810 },
  },
];

const needs = [
  { id: "lower cost", title: "Lower the monthly cost", icon: "cost", body: "Find cities where rent, food, and daily spending are easier to manage." },
  { id: "tech", title: "Study near tech industry", icon: "tech", body: "Compare cities with stronger computer science, AI, and startup signals." },
  { id: "calmer pace", title: "Avoid a too-fast city", icon: "pace", body: "Start with cities that feel more manageable for a first China experience." },
  { id: "scholarship", title: "Keep funding realistic", icon: "scholarship", body: "Look for city and university routes where scholarships fit real living cost." },
  { id: "language", title: "Build Chinese skills", icon: "language", body: "Choose cities where language immersion and campus support can work together." },
  { id: "warm climate", title: "Prefer a warmer climate", icon: "climate", body: "Reduce climate shock if cold winters are a concern." },
];

let activeCity = "hangzhou";
let activeNeed = "all";
let budgetMode = "lean";
let sortMode = "fit";

function money(value) {
  return `RMB ${value.toLocaleString("en-US")}`;
}

function currentCity() {
  return cities.find((city) => city.id === activeCity) || cities[0];
}

function filteredCities() {
  let list = [...cities];
  if (activeNeed !== "all") {
    list = list.filter((city) => city.bestFor.some((tag) => tag.includes(activeNeed)) || city.tags.some((tag) => tag.toLowerCase().includes(activeNeed)));
  }
  if (sortMode === "costLow") list.sort((a, b) => a.monthlyCostRmb - b.monthlyCostRmb);
  if (sortMode === "english") list.sort((a, b) => b.englishRoutes - a.englishRoutes);
  if (sortMode === "scholarship") list.sort((a, b) => b.scholarships - a.scholarships);
  return list;
}

function renderRail() {
  document.querySelector("#cityRail").innerHTML = cities.map((city) => `
    <button class="rail-city ${city.id === activeCity ? "active" : ""}" type="button" data-city="${city.id}">
      <strong>${city.name}</strong>
      <span>${city.province} · ${city.pace}</span>
      <b>${money(city.monthlyCostRmb)}</b>
      <span>${city.tags[0]}</span>
    </button>
  `).join("");
}

function renderFeature() {
  const city = currentCity();
  document.querySelector("#featureStory").innerHTML = `
    <div class="story-image">
      <img alt="${city.name} city and campus context" src="${city.image}" />
      <div class="story-label">${city.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
    </div>
    <article class="story-copy">
      <div>
        <span class="badge">${city.region}</span>
        <h2>${city.name} is best when ${city.bestFor.slice(0, 2).join(" and ")} matter</h2>
        <p>${city.summary} ${city.arrival}</p>
      </div>
      <div class="story-facts">
        <div><strong>${money(city.monthlyCostRmb)}</strong><span>monthly living estimate</span></div>
        <div><strong>${city.englishRoutes}</strong><span>English-route signals</span></div>
        <div><strong>${city.scholarships}</strong><span>scholarship signals</span></div>
        <div><strong>${city.representative[0]}</strong><span>representative university</span></div>
      </div>
      <div class="story-actions">
        <a class="primary" href="programs.html?city=${city.id}">Programs in ${city.name}</a>
        <a class="ghost" href="universities.html?city=${city.id}">Universities</a>
        <a class="ghost" href="scholarships.html?city=${city.id}">Scholarships</a>
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
          <th>Pace</th>
          <th>English routes</th>
          <th>Scholarships</th>
          <th>Opportunity</th>
          <th>Climate</th>
          <th>Next</th>
        </tr>
      </thead>
      <tbody>
        ${cities.map((city) => `
          <tr data-city-row="${city.id}">
            <td><div class="matrix-city"><strong>${city.name}</strong><span>${city.province}</span></div></td>
            <td><span class="cost ${costClass(city)}">${money(city.monthlyCostRmb)}</span></td>
            <td><span class="pace">${city.pace}</span></td>
            <td>${city.englishRoutes}<div class="signal">program signals</div></td>
            <td>${city.scholarships}<div class="signal">funding signals</div></td>
            <td>${city.industry}</td>
            <td>${city.climate}</td>
            <td><a class="matrix-action" href="programs.html?city=${city.id}">Programs</a></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderNeeds() {
  document.querySelector("#needGrid").innerHTML = needs.map((need) => `
    <button class="need-card ${activeNeed === need.id ? "active" : ""}" type="button" data-need="${need.id}">
      <span class="need-icon">${cityIcons[need.icon]}</span>
      <strong>${need.title}</strong>
      <span>${need.body}</span>
    </button>
  `).join("");
}

function renderActiveChips() {
  document.querySelector("#activeChips").innerHTML = activeNeed === "all"
    ? '<span class="filter-chip">No city need selected</span>'
    : `<button class="filter-chip active" type="button" data-clear-need>${activeNeed} x</button>`;
}

function renderCityCards() {
  const list = filteredCities();
  document.querySelector("#cityCount").textContent = list.length;
  document.querySelector("#cityContext").textContent = activeNeed === "all"
    ? "City guides with cost, university, English-route, scholarship, and student-life signals."
    : `Filtered by ${activeNeed}.`;
  document.querySelector("#cityGrid").innerHTML = list.map((city) => `
    <article class="city-card">
      <div class="city-media">
        <img alt="${city.name} city context" src="${city.image}" loading="lazy" />
        <span class="badge">${city.costLevel} cost</span>
      </div>
      <h3>${city.name}</h3>
      <p class="province">${city.province} · ${city.region}</p>
      <p class="summary">${city.summary}</p>
      <div class="city-tags">${city.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join("")}</div>
      <div class="city-stats">
        <span><b>${money(city.monthlyCostRmb)}</b>monthly</span>
        <span><b>${city.programs}</b>programs</span>
        <span><b>${city.englishRoutes}</b>English</span>
      </div>
      <div class="card-actions">
        <a class="primary" href="programs.html?city=${city.id}">View programs</a>
        <button class="ghost" type="button" data-city="${city.id}">Preview</button>
      </div>
    </article>
  `).join("");
  renderActiveChips();
}

function budgetMultiplier() {
  if (budgetMode === "balanced") return 1.12;
  if (budgetMode === "comfortable") return 1.28;
  return 1;
}

function renderBudget() {
  const city = currentCity();
  const multiplier = budgetMultiplier();
  const entries = Object.entries(city.costBreakdown).map(([label, value]) => [label, Math.round(value * multiplier)]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  document.querySelector("#budgetCity").textContent = city.name;
  document.querySelector("#budgetTotal").textContent = money(total);
  document.querySelector("#budgetIntro").textContent = `Start with ${city.name}, then switch lifestyle level to see how accommodation, food, transport, and personal spending change.`;
  document.querySelector("#budgetBars").innerHTML = entries.map(([label, value]) => `
    <div class="budget-row">
      <span>${label[0].toUpperCase()}${label.slice(1)}</span>
      <span class="bar-track"><span class="bar-fill" style="width: ${Math.max(10, (value / total) * 100)}%"></span></span>
      <strong>${money(value)}</strong>
    </div>
  `).join("");
  document.querySelectorAll("[data-budget-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.budgetMode === budgetMode);
  });
}

function renderAll() {
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
    document.querySelector("#cityList .section-head")?.appendChild(notice);
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
    showCityAgentNotice("Agent prioritized lower-cost cities and selected Nanjing as a demo backup route.");
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
  const cityButton = event.target.closest("[data-city]");
  if (cityButton) {
    activeCity = cityButton.dataset.city;
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
  const filterButton = event.target.closest("[data-city-filter]");
  if (filterButton) {
    activeNeed = filterButton.dataset.cityFilter;
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

renderAll();
