const dataClient = window.CuacDataClient;
const mode = document.body.dataset.completionPage;
const params = new URLSearchParams(location.search);
let currentDetailData = null;
let opsContentCreateGuardToken = 0;
let opsContentTypeGuardToken = 0;

function pickData() {
  if (mode === "program") return dataClient?.getCompletionDetail?.(mode, params.get("program")) || fallbackDetail("program", params.get("program") || "selected-program");
  if (mode === "university") return dataClient?.getCompletionDetail?.(mode, params.get("university")) || fallbackDetail("university", params.get("university") || "selected-university");
  if (mode === "scholarship") return dataClient?.getCompletionDetail?.(mode, params.get("scholarship")) || fallbackDetail("scholarship", params.get("scholarship") || "csc");
  if (mode === "city") return dataClient?.getCompletionDetail?.(mode, params.get("city")) || fallbackDetail("city", params.get("city") || "selected-city");
  if (mode === "guide") return dataClient?.getCompletionDetail?.(mode, params.get("guide")) || fallbackDetail("guide", params.get("guide") || "documents");
  return null;
}

function titleFromSlug(value) {
  return String(value || "selected route")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fallbackDetail(kind, value) {
  const title = titleFromSlug(value);
  const returnPages = {
    program: "programs.html",
    university: "universities.html",
    scholarship: "scholarships.html",
    city: "cities.html",
    guide: "guides.html",
  };
  return {
    title,
    city: kind === "city" ? "China city profile" : "China route",
    image: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80",
    summary: `Selected ${kind} profile from the CUAC catalog. This detail view keeps the route structured while the full catalog record is being prepared.`,
    status: ["Detail ready", "Application review", "Route-ready layout"],
    metrics: [["Open", "status"], ["Program", "route"], ["CUAC", "choice"], ["Next", "review"]],
    facts: [["Profile type", titleFromSlug(kind)], ["Application info", "Review before applying"], ["Student action", "Review before adding"], ["School action", "Follow up directly"], ["Agent support", "Available"], ["Data state", "Catalog snapshot"]],
    routes: [["Back to search", "Return to the relevant CUAC search surface.", returnPages[kind] || "home-v3.html"], ["Open application", "Use this once a concrete program is selected.", "application.html#add-choice"]],
    checklist: ["Review the official application page", "Check deadline and intake", "Review cost and documents", "Save the route before continuing"],
    timeline: ["Open detail", "Review application page", "Connect to a concrete program", "Send school-scoped record after application submit"],
  };
}

const detailReturnPages = {
  program: "programs.html",
  university: "universities.html",
  scholarship: "scholarships.html",
  city: "cities.html",
  guide: "guides.html",
};

function detailBackHref() {
  return detailReturnPages[mode] || "home-v3.html";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderProfileRows(rows = []) {
  return rows.map(([label, value]) => `
    <article class="profile-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
}

function readableCountLabel(count, singular = "check", plural = "checks") {
  const value = Number(count || 0);
  return `${value} ${value === 1 ? singular : plural}`;
}

function renderProfileSection(section = {}, index = 0, openUntil = 3) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const sectionBody = `<div class="profile-row-list">${renderProfileRows(rows)}</div>`;
  if (index === 0) {
    return `
      <section class="profile-section featured">
        <div class="profile-section-head"><div><h3>${escapeHtml(section.title)}</h3>${section.summary ? `<p>${escapeHtml(section.summary)}</p>` : ""}</div><span>${escapeHtml(readableCountLabel(rows.length, "item", "items"))}</span></div>
        ${sectionBody}
      </section>
    `;
  }
  return `
    <details class="profile-section profile-section-disclosure" ${index < openUntil ? "open" : ""}>
      <summary class="profile-section-head">
        <div><h3>${escapeHtml(section.title)}</h3>${section.summary ? `<p>${escapeHtml(section.summary)}</p>` : ""}</div>
        <span>${escapeHtml(readableCountLabel(rows.length, "item", "items"))}</span>
      </summary>
      ${sectionBody}
    </details>
  `;
}

function renderProfileSections(data, id = "", openUntil = 3, options = {}) {
  const sections = Array.isArray(data?.profileSections) ? data.profileSections : [];
  if (!sections.length) return "";
  const totalRows = sections.reduce((total, section) => total + (section.rows || []).length, 0);
  if (options.variant === "reference") {
    const referenceFacts = Array.isArray(options.facts) ? options.facts.filter((fact) => fact?.label && fact?.value).slice(0, 6) : [];
    return `
      <details class="detail-card profile-card university-reference-card" ${id ? `id="${escapeHtml(id)}"` : ""}>
        <summary class="section-head">
          <div><span class="module-kicker">Reference</span><h2>Reference details</h2></div>
        </summary>
        <div class="profile-card-intro">
          <p>CSCAlite fields stay here for verification. Use them when a program, deadline, or fee needs a source check.</p>
          <span>${escapeHtml(readableCountLabel(totalRows, "item", "items"))} · ${escapeHtml(readableCountLabel(sections.length, "section", "sections"))}</span>
        </div>
        ${referenceFacts.length ? `<div class="university-fact-list university-reference-facts">
          ${referenceFacts.map((fact) => `<article><span>${escapeHtml(fact.label)}</span><strong>${escapeHtml(fact.value)}</strong></article>`).join("")}
        </div>` : ""}
        <div class="profile-section-list">
          ${sections.map((section, index) => renderProfileSection(section, index, 0)).join("")}
        </div>
      </details>
    `;
  }
  return `
        <article class="detail-card profile-card" ${id ? `id="${escapeHtml(id)}"` : ""}>
          <div class="section-head"><div><span class="module-kicker">Decision guide</span><h2>${escapeHtml(data.profileTitle || "Information that affects your choice")}</h2></div></div>
          <div class="profile-card-intro">
            <p>Key facts are grouped by eligibility, cost, timing, and next steps so you can scan the record without reading every field at once.</p>
            <span>${escapeHtml(readableCountLabel(totalRows, "item", "items"))} · ${escapeHtml(readableCountLabel(sections.length, "section", "sections"))}</span>
          </div>
          <div class="profile-section-list">
            ${sections.map((section, index) => renderProfileSection(section, index, openUntil)).join("")}
          </div>
        </article>
  `;
}

function renderDecisionPanels(data) {
  const panels = Array.isArray(data?.decisionPanels) ? data.decisionPanels : [];
  if (!panels.length) return "";
  return `
    <section class="decision-panel-grid reveal" aria-label="Decision summary">
      ${panels.map((panel) => `
        <article class="decision-panel">
          <span>${escapeHtml(panel.title)}</span>
          <strong>${escapeHtml(panel.value)}</strong>
          <p>${escapeHtml(panel.body)}</p>
        </article>
      `).join("")}
    </section>
  `;
}

function renderTimelineItems(items = []) {
  return items.map((item) => {
    const text = String(item || "");
    const splitAt = text.indexOf(":");
    const hasPhase = splitAt > 0 && splitAt < 28;
    const phase = hasPhase ? text.slice(0, splitAt) : "";
    const body = hasPhase ? text.slice(splitAt + 1).trim() : text;
    return `<li>${phase ? `<span class="timeline-phase">${escapeHtml(phase)}</span>` : ""}<span class="timeline-copy">${escapeHtml(body)}</span></li>`;
  }).join("");
}

function renderDetailMetrics(data) {
  const metrics = Array.isArray(data?.metrics) ? data.metrics : [];
  const hasDecisionPanels = Array.isArray(data?.decisionPanels) && data.decisionPanels.length;
  if (!metrics.length || hasDecisionPanels) return "";
  return `
    <section class="metric-strip reveal">
      ${metrics.map(([value, label]) => `<article class="metric-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join("")}
    </section>
  `;
}

function renderCityQuickFacts(facts = []) {
  if (!facts.length) return "";
  return `
    <section class="city-quick-facts reveal" aria-label="City quick facts">
      <div class="city-quick-facts-head">
        <span class="module-kicker">City essentials</span>
        <h2>Read the city before comparing routes</h2>
        <p>Use these practical facts to judge daily life and budget. Route counts stay in the comparison summary below.</p>
      </div>
      ${facts.map((fact) => `
        <article>
          <strong>${escapeHtml(fact.value)}</strong>
          <span>${escapeHtml(fact.label)}</span>
          ${fact.note ? `<small>${escapeHtml(fact.note)}</small>` : ""}
        </article>
      `).join("")}
    </section>
  `;
}

function renderCityContentFacts(facts = []) {
  const visible = facts.filter((fact) => fact?.label && fact?.value).slice(0, 4);
  if (!visible.length) return "";
  return `
    <div class="city-content-facts" aria-label="City guide facts">
      ${visible.map((fact) => `
        <article>
          <span>${escapeHtml(fact.label)}</span>
          <strong>${escapeHtml(fact.value)}</strong>
          ${fact.note ? `<small>${escapeHtml(fact.note)}</small>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function cityBudgetDisplayLine(guide = {}) {
  const budget = guide.budget || {};
  return budget.monthly || budget.yearly || guide.monthlyCost || "Pending";
}

function cityTextListItems(value, limit = 4) {
  const items = Array.isArray(value)
    ? value.map((item) => textValue(item)).filter(Boolean)
    : splitOpsTextLines(value);
  return items.slice(0, limit);
}

function renderCityBestForChips(items = []) {
  const visible = cityTextListItems(items, 3);
  if (!visible.length) return "";
  return `
    <div class="city-best-for-strip" aria-label="Best-fit applicants">
      <span>Best for</span>
      ${visible.map((item) => `<strong>${escapeHtml(item)}</strong>`).join("")}
    </div>
  `;
}

function renderCityAggregateCards(cards = []) {
  const visible = cards.filter((card) => card?.label);
  if (!visible.length) return "";
  return `
    <section class="city-aggregate-panel reveal" aria-label="City option summary">
      <div class="city-aggregate-head">
        <div>
          <span class="module-kicker">At a glance</span>
          <h2>Options to compare from this city</h2>
        </div>
        <p>Use these counts as a quick route check, then open the exact schools, programs, and funding options before saving a choice.</p>
      </div>
      <div class="city-aggregate-grid">
        ${visible.slice(0, 5).map((card) => `
          <article>
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(String(card.actual ?? 0))}</strong>
            <p>${escapeHtml(card.note || "matched CUAC records")}</p>
            ${card.href ? `<a href="${escapeHtml(card.href)}">${escapeHtml(card.action || "Open options")}</a>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCityNearbyCards(cards = []) {
  const visible = cards.filter((card) => card?.title);
  if (!visible.length) return "";
  return `
    <div class="city-nearby-strip">
      ${visible.map((card) => `
        <a href="${escapeHtml(card.href || "cities.html")}">
          <span>${escapeHtml(card.title)}</span>
          <p>${escapeHtml(card.body || "Compare as a nearby city option.")}</p>
        </a>
      `).join("")}
    </div>
  `;
}

function renderUniversityQuickFacts(facts = []) {
  const visibleFacts = facts.filter((fact) => fact?.label && fact?.value).slice(0, 6);
  if (!visibleFacts.length) return "";
  return `
    <details class="detail-card university-side-facts">
      <summary class="side-panel-head">
        <div><span class="module-kicker">School facts</span><h2>Reference details</h2></div>
      </summary>
      <div class="university-fact-list">
        ${visibleFacts.map((fact) => `
          <article>
            <span>${escapeHtml(fact.label)}</span>
            <strong>${escapeHtml(fact.value)}</strong>
          </article>
        `).join("")}
      </div>
    </details>
  `;
}

function renderUniversityGlance(facts = [], guide = {}) {
  const primaryLabels = ["Location", "English-taught", "Next deadline", "Tuition", "Programs", "Application levels"];
  const byLabel = new Map();
  [...(facts || []).map(([label, value]) => ({ label, value })), ...(guide.quickFacts || [])].forEach((fact) => {
    if (!fact?.label || !fact?.value || byLabel.has(fact.label)) return;
    byLabel.set(fact.label, fact);
  });
  const visibleFacts = primaryLabels.map((label) => byLabel.get(label)).filter(Boolean).slice(0, 4);
  if (!visibleFacts.length) return "";
  return `
    <section class="university-glance-band reveal" aria-label="University decision snapshot">
      <div class="university-glance-head">
        <div>
          <span class="module-kicker">Decision snapshot</span>
          <h2>School brief</h2>
        </div>
      </div>
      ${visibleFacts.map((fact) => `
        <article>
          <span>${escapeHtml(fact.label)}</span>
          <strong>${escapeHtml(fact.value)}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

function renderUniversityProgramGroups(groups = [], fieldTags = [], hiddenProgramNote = "") {
  const visibleGroups = groups
    .filter((group) => group?.label && group?.count && !/program area to verify/i.test(String(group.label)))
    .slice(0, 3);
  const tags = Array.isArray(fieldTags) ? fieldTags.filter(Boolean).slice(0, 6) : [];
  if (!visibleGroups.length && !tags.length && !hiddenProgramNote) return "";
  const tagSummary = tags.length ? tags.join(" / ") : "";
  return `
    <div class="university-program-overview" aria-label="Program overview">
      ${visibleGroups.map((group) => `
        <article>
          <span>${escapeHtml(group.count)}</span>
          <strong>${escapeHtml(group.label)}</strong>
          ${group.note ? `<small>${escapeHtml(group.note)}</small>` : ""}
        </article>
      `).join("")}
      ${hiddenProgramNote ? `<p>${escapeHtml(hiddenProgramNote)}</p>` : ""}
      ${tagSummary ? `<p class="university-field-tags"><span>Academic focus</span><strong>${escapeHtml(tagSummary)}</strong></p>` : ""}
    </div>
  `;
}

function renderCityGlance(guide = {}) {
  const fields = Array.isArray(guide.fieldSummary) ? guide.fieldSummary.filter((item) => item?.value) : [];
  const resourceFacts = Array.isArray(guide.resourceFacts) && guide.resourceFacts.length ? guide.resourceFacts : (guide.quickFacts || []);
  const fieldValue = (label, fallback = "") => fields.find((field) => field.label === label)?.value || fallback;
  const factValue = (labelOrNote, fallback = "") => resourceFacts.find((fact) => fact.label === labelOrNote || fact.note === labelOrNote)?.value || fallback;
  const bestFor = Array.isArray(guide.bestFor) ? guide.bestFor.find(Boolean) : "";
  const decisionCards = [
    {
      label: "Budget",
      value: guide.budget?.monthly || guide.monthlyCost || fieldValue("Monthly cost", "Pending"),
      body: guide.budget?.note || "Use living cost with tuition and housing availability before choosing.",
    },
    {
      label: "Best fit",
      value: bestFor || "Compare after program fit",
      body: "City fit should support a concrete school, program, language route, and deadline.",
    },
    {
      label: "Schools and programs",
      value: `${factValue("Universities", fieldValue("Region", "School options"))} · ${factValue("Programs", "program routes")}`,
      body: "Use the city as a filter, then compare exact degree routes.",
    },
    {
      label: "CSCA and timing",
      value: factValue("CSCA schools", fieldValue("City pace", "Confirm early")),
      body: "Check whether target schools require CSCA before relying on city preference.",
    },
  ];
  if (!decisionCards.some((card) => card.value || card.body)) return "";
  return `
    <section class="city-glance-band reveal" aria-label="City decision summary">
      <div class="city-glance-head">
        <div class="university-summary-body">
          <span class="module-kicker">Decision snapshot</span>
          <h2>Use the city as a planning filter</h2>
        </div>
        <p>Start with budget and route availability, then compare exact schools, programs, language requirements, and deadlines.</p>
      </div>
      <div class="city-glance-list">
        ${decisionCards.map((card) => `
          <article>
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <p>${escapeHtml(card.body)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCitySectionNav() {
  const sections = [
    ["#city-fit", "Fit"],
    ["#city-why", "Why"],
    ["#city-budget", "Budget"],
    ["#city-schools", "Schools"],
    ["#city-programs", "Programs"],
    ["#city-funding", "Funding"],
    ["#city-life", "Life"],
    ["#city-next", "Next"],
    ["#city-faq", "FAQ"],
  ];
  return renderDetailSectionNav(sections, "City guide sections", "city-section-nav");
}

function renderDetailSectionNav(sections = [], label = "Detail sections", extraClass = "") {
  const visibleSections = sections.filter((item) => Array.isArray(item) && item[0] && item[1]);
  if (!visibleSections.length) return "";
  return `
    <nav class="detail-section-nav ${escapeHtml(extraClass)} reveal" aria-label="${escapeHtml(label)}">
      ${visibleSections.map(([href, itemLabel]) => `<a href="${escapeHtml(href)}">${escapeHtml(itemLabel)}</a>`).join("")}
    </nav>
  `;
}

function normalizeCityTextCard(item, index) {
  if (item && typeof item === "object") {
    return {
      title: item.title || item.label || `City note ${index + 1}`,
      body: item.body || item.note || item.value || "",
    };
  }
  const raw = String(item || "").trim();
  const [title, ...rest] = raw.split(/[:：]/);
  const hasBody = rest.join(":").trim();
  return {
    title: hasBody ? title.trim() : `Point ${index + 1}`,
    body: hasBody || raw,
  };
}

function renderCityTextCards(items = [], className = "city-card-grid") {
  if (!items.length) return "";
  return `
    <div class="${className}">
      ${items.map((item, index) => {
        const card = normalizeCityTextCard(item, index);
        return `
        <article>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(card.title)}</strong>
          <p>${escapeHtml(card.body)}</p>
        </article>
      `;
      }).join("")}
    </div>
  `;
}

function renderCityApplicationChecklist(items = []) {
  const tips = (Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean);
  if (!tips.length) return "";
  return `
    <div class="city-application-checklist" aria-label="City application checklist">
      <div>
        <span class="module-kicker">Application checklist</span>
        <h3>Confirm before shortlisting schools here</h3>
      </div>
      <div class="city-application-tip-list">
        ${tips.slice(0, 5).map((item, index) => `
          <span><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(item)}</span>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCityFaqs(items = []) {
  if (!items.length) return "";
  return `
    <div class="city-faq-list">
      ${items.map((item) => `
        <details>
          <summary>${escapeHtml(item.question || "Student question")}</summary>
          <p>${escapeHtml(item.answer || "Confirm with the school before deciding.")}</p>
        </details>
      `).join("")}
    </div>
  `;
}

function renderCityRoutes(routes = []) {
  if (!routes.length) return "";
  return `
    <div class="city-route-grid">
      ${routes.map((route) => `
        <a href="${escapeHtml(route.href || "cities.html")}">
          <strong>${escapeHtml(route.label || "Open route")}</strong>
          <span>${escapeHtml(route.body || "Continue in CUAC.")}</span>
        </a>
      `).join("")}
    </div>
  `;
}

function renderCityRelatedList(items = [], emptyText = "Open the catalog to compare current CUAC options.") {
  if (!items.length) return `<p class="city-related-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="city-related-list">
      ${items.slice(0, 4).map((item) => `
        <a href="${escapeHtml(item.href || "cities.html")}">
          <strong>${escapeHtml(item.title || "CUAC option")}</strong>
          ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          ${Array.isArray(item.tags) && item.tags.length ? `<small>${item.tags.slice(0, 3).map((tag) => escapeHtml(tag)).join(" · ")}</small>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

function renderCitySchoolCards(items = [], emptyText = "Open Universities filtered by city to find current school options.") {
  if (!items.length) return `<p class="city-related-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="city-school-list">
      ${items.slice(0, 4).map((item) => `
        <a class="city-school-card" href="${escapeHtml(item.href || "universities.html")}">
          <div>
            <strong>${escapeHtml(item.title || "University option")}</strong>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          </div>
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          ${Array.isArray(item.tags) && item.tags.length ? `<small>${item.tags.slice(0, 3).map((tag) => escapeHtml(tag)).join(" · ")}</small>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

function renderCityProgramCards(items = [], emptyText = "Open Programs filtered by city to find exact degree routes.") {
  if (!items.length) return `<p class="city-related-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="city-program-list">
      ${items.slice(0, 4).map((item) => {
        const facts = String(item.body || "").split(" · ").filter(Boolean).slice(0, 3);
        return `
          <article class="city-program-card" data-city-program-row data-degree="${escapeHtml(item.degree || "")}" data-language="${escapeHtml(item.language || "")}" data-funding="${escapeHtml(item.funding || "")}">
            <div>
              <strong>${escapeHtml(item.title || "Program route")}</strong>
              ${item.titleZh ? `<em class="city-program-title-zh">${escapeHtml(item.titleZh)}</em>` : ""}
              ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
            </div>
            ${facts.length ? `<div class="city-program-facts">${facts.map((fact) => `<em>${escapeHtml(fact)}</em>`).join("")}</div>` : ""}
            ${Array.isArray(item.tags) && item.tags.length ? `<small>${item.tags.slice(0, 3).map((tag) => escapeHtml(tag)).join(" · ")}</small>` : ""}
            <a class="secondary-action" href="${escapeHtml(item.href || "programs.html")}">View program</a>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderCityProgramFilters(items = []) {
  const rows = Array.isArray(items) ? items.slice(0, 4) : [];
  if (rows.length < 2) return "";
  const unique = (values) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).slice(0, 10);
  const degrees = unique(rows.map((item) => item.degree));
  const languages = unique(rows.map((item) => item.language));
  const funding = unique(rows.map((item) => item.funding));
  const renderSelect = (key, label, values, allLabel) => `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-city-program-filter="${escapeHtml(key)}">
        <option value="">${escapeHtml(allLabel)}</option>
        ${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
      </select>
    </label>
  `;
  return `
    <div class="city-program-filter-bar" aria-label="Filter city programs">
      <div>
        ${renderSelect("degree", "Degree", degrees, "All degrees")}
        ${renderSelect("language", "Language", languages, "All languages")}
        ${renderSelect("funding", "Funding", funding, "All funding")}
      </div>
      <strong data-city-program-count>${rows.length} shown</strong>
    </div>
    <p class="city-related-empty" data-city-program-empty hidden>No city program matches these filters.</p>
  `;
}

function renderCityProgramKeywords(items = []) {
  const keywords = Array.isArray(items) ? items.filter(Boolean).slice(0, 8) : [];
  if (!keywords.length) return "";
  return `
    <div class="city-program-keywords" aria-label="Recommended program directions">
      <span>Recommended program directions</span>
      <div>${keywords.map((item) => `<a href="programs.html?q=${encodeURIComponent(item)}">${escapeHtml(item)}</a>`).join("")}</div>
    </div>
  `;
}

function renderCityNextSteps(items = []) {
  const steps = Array.isArray(items) ? items.filter((item) => item?.title || item?.body).slice(0, 4) : [];
  if (!steps.length) return "";
  return `
    <article class="detail-card city-next-steps-card">
      <div class="side-panel-head">
        <div><span class="module-kicker">Next steps</span><h2>Before you choose this city</h2></div>
      </div>
      <div class="city-side-next-list">
        ${steps.map((item, index) => `
          <article>
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.title || `Step ${index + 1}`)}</strong>
              <p>${escapeHtml(item.body || "Turn the city preference into a concrete school and program route.")}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

function renderCityScholarshipCards(items = [], emptyText = "Open Scholarships filtered by city to compare funding options.") {
  if (!items.length) return `<p class="city-related-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="city-scholarship-list">
      ${items.slice(0, 4).map((item) => `
        <a class="city-scholarship-card" href="${escapeHtml(item.href || "scholarships.html")}">
          <div>
            <strong>${escapeHtml(item.title || "Funding route")}</strong>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          </div>
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          ${Array.isArray(item.tags) && item.tags.length ? `<small>${item.tags.slice(0, 3).map((tag) => escapeHtml(tag)).join(" · ")}</small>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

function renderFundingCards(items = [], className = "funding-card-grid") {
  if (!items.length) return "";
  return `
    <div class="${className}">
      ${items.map((item) => `
        <article class="${item.state ? "has-funding-state" : ""}">
          <div class="funding-card-head">
            <strong>${escapeHtml(item.title || "Funding item")}</strong>
            ${item.state ? `<span class="funding-benefit-state ${/not included/i.test(item.state) ? "excluded" : "included"}">${escapeHtml(item.state)}</span>` : ""}
          </div>
          <p>${escapeHtml(item.body || "Check the current scholarship notice.")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function scholarshipIconSvg(name = "check") {
  const icons = {
    building: '<path d="M4 20h16"/><path d="M6 20V8l6-4 6 4v12"/><path d="M9 20v-6h6v6"/><path d="M9 10h.01"/><path d="M15 10h.01"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>',
    check: '<path d="m7 12 3.2 3.2L17 8.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/>',
    graduate: '<path d="m22 10-10-5-10 5 10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.14 1.14"/><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.14"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01"/><path d="M18 15h.01"/>',
    route: '<path d="M6 19V5"/><path d="M6 5h9l-1.6 3L15 11H6"/><path d="M18 19v-6"/><path d="M15 16h6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m8.8 12 2.1 2.1 4.5-5"/>',
  };
  return `<span class="scholarship-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${icons[name] || icons.check}</svg></span>`;
}

function scholarshipFactIconName(label = "") {
  const normalized = String(label || "").toLowerCase();
  if (/funding|coverage|tuition|money/.test(normalized)) return "money";
  if (/deadline|date|window|timing/.test(normalized)) return "calendar";
  if (/degree|level/.test(normalized)) return "graduate";
  if (/provider|school|university/.test(normalized)) return "building";
  if (/route|type/.test(normalized)) return "route";
  if (/application|material|document|prepare/.test(normalized)) return "file";
  if (/guarantee|risk|verify|eligibility/.test(normalized)) return "shield";
  if (/country|scope|region/.test(normalized)) return "globe";
  if (/source|link|official/.test(normalized)) return "link";
  return "check";
}

function renderProgramOfficialCards(items = []) {
  const cards = Array.isArray(items) ? items.filter((item) => item?.title || item?.href) : [];
  if (!cards.length) return "";
  return `
    <div class="program-official-list" aria-label="Where to check current program details">
      <span>Where to check current details</span>
      ${cards.slice(0, 3).map((item) => `
        <a href="${escapeHtml(item.href || "programs.html")}">
          <strong>${escapeHtml(item.title || "Official check")}</strong>
          <p>${escapeHtml(item.body || "Review the current university page before adding this route.")}</p>
        </a>
      `).join("")}
    </div>
  `;
}

function renderScholarshipRelatedCards(items = [], emptyText = "Confirm applicable options before relying on this route.", actionLabel = "View") {
  if (!items.length) return `<p class="scholarship-related-empty">${escapeHtml(emptyText)}</p>`;
  return items.slice(0, 6).map((item) => `
    <article class="scholarship-related-card">
      <div>
        <strong>${escapeHtml(item.title || "Applicable option")}</strong>
        <p>${escapeHtml(item.body || emptyText)}</p>
      </div>
      <a class="secondary-action" href="${escapeHtml(item.href || "programs.html")}">${escapeHtml(actionLabel)}</a>
    </article>
  `).join("");
}

function renderScholarshipConnectionGroup(title, items = [], emptyText = "Confirm applicable options before relying on this route.", actionLabel = "View") {
  const count = Array.isArray(items) ? items.length : 0;
  return `
    <section class="scholarship-connection-group">
      <div class="scholarship-connection-label">
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(count ? `${count} linked` : "Check")}</span>
      </div>
      <div class="scholarship-connection-items">
        ${renderScholarshipRelatedCards(items, emptyText, actionLabel)}
      </div>
    </section>
  `;
}

function renderScholarshipInfoRows(items = [], emptyText = "Check the current scholarship notice.") {
  const rows = Array.isArray(items) ? items.filter((item) => item?.title || item?.body) : [];
  if (!rows.length) return `<p class="scholarship-related-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="scholarship-info-rows">
      ${rows.slice(0, 5).map((item) => `
        <article>
          <div>
            <strong>${escapeHtml(item.title || "Check item")}</strong>
            <p>${escapeHtml(item.body || emptyText)}</p>
          </div>
          ${item.state ? `<span class="funding-benefit-state ${/not included/i.test(item.state) ? "excluded" : "included"}">${escapeHtml(item.state)}</span>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderScholarshipDocumentMatrix(materials = [], steps = []) {
  const materialRows = Array.isArray(materials) ? materials.filter((item) => item?.title || item?.body) : [];
  const stepRows = Array.isArray(steps) ? steps.filter((item) => item?.title || item?.body) : [];
  if (!materialRows.length && !stepRows.length) return `<p class="scholarship-related-empty">Confirm documents after the funding route matches a real program.</p>`;
  const rows = (materialRows.length ? materialRows : stepRows).slice(0, 5).map((item, index) => {
    const pairedStep = stepRows[index] || stepRows[0] || {};
    return {
      document: item.title || pairedStep.title || `Item ${index + 1}`,
      why: item.body || "Confirm this only after the route fits a concrete school and program.",
      when: pairedStep.title || "After program match",
    };
  });
  return `
    <div class="scholarship-document-matrix" role="table" aria-label="Scholarship document preparation">
      <div class="scholarship-document-head" role="row">
        <span role="columnheader">Document</span>
        <span role="columnheader">Why it matters</span>
        <span role="columnheader">When</span>
      </div>
      ${rows.map((row) => `
        <article role="row">
          <strong role="cell">${escapeHtml(row.document)}</strong>
          <p role="cell">${escapeHtml(row.why)}</p>
          <span role="cell">${escapeHtml(row.when)}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function renderScholarshipSourceRows(cards = []) {
  const rows = Array.isArray(cards) ? cards.filter((item) => item?.title || item?.body || item?.href) : [];
  if (!rows.length) return "";
  return `
    <div class="scholarship-source-list">
      ${rows.slice(0, 4).map((item) => `
        <article>
          ${scholarshipIconSvg(scholarshipFactIconName(item.title || item.body || "source"))}
          <div>
            <strong>${escapeHtml(item.title || "Official check")}</strong>
            <p>${escapeHtml(item.body || "Use the official source before preparing documents.")}</p>
          </div>
          ${item.href ? `<a class="secondary-action" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">Open</a>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function scholarshipMeaningfulNoticeSections(sections = []) {
  return (Array.isArray(sections) ? sections : []).filter((section) => {
    const title = String(section?.title || "").trim().toLowerCase();
    const paragraphText = (section?.paragraphs || []).join(" ").trim();
    return Boolean(title && title !== "scholarship overview")
      || (section?.items || []).length
      || paragraphText.length > 180;
  });
}

function isRichScholarshipNoticeText(text = "") {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length >= 8 || lines.join(" ").length >= 650;
}

function isScholarshipNoticeHeading(line = "") {
  return /^(第[一二三四五六七八九十]+)\s+/.test(line)
    || /^[一二三四五六七八九十]、/.test(line)
    || /^Part\s+[IVX]+\./i.test(line)
    || /^(?:[1-9]|10)\.\s+(Funding categories|Funding coverage|Application channel|Eligibility|Application process|Application materials|Program universities|Admission and notification|Admission timeline|Changes to)/i.test(line)
    || /^.+[：:]$/.test(line);
}

function stripScholarshipNoticeMarker(line = "") {
  return String(line || "").replace(/^\s*(?:\d+[.、]|[-*•●])\s*/, "").trim();
}

function splitScholarshipOfficialNotice(text = "") {
  if (!isRichScholarshipNoticeText(text)) return [];
  const sections = [];
  let current = { title: "Official notice summary", paragraphs: [], items: [], schools: [] };
  String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    if (isScholarshipNoticeHeading(line)) {
      if (current.title || current.paragraphs.length || current.items.length || current.schools.length) sections.push(current);
      current = { title: line.replace(/[：:]$/, ""), paragraphs: [], items: [], schools: [] };
      return;
    }
    const schoolMatch = line.match(/^\s*(\d+)[.、]\s*(.+?)[｜|](.+)$/);
    if (schoolMatch) {
      current.schools.push({ index: schoolMatch[1], name: schoolMatch[2].trim(), meta: schoolMatch[3].trim() });
      return;
    }
    if (/^\s*(?:\d+[.、]|[-*•●])\s+/.test(line)) {
      const item = stripScholarshipNoticeMarker(line);
      if (item) current.items.push(item);
      return;
    }
    current.paragraphs.push(line);
  });
  if (current.title || current.paragraphs.length || current.items.length || current.schools.length) sections.push(current);
  return sections.filter((section) => section.paragraphs.length || section.items.length || section.schools.length);
}

function renderScholarshipOfficialNotice(sections = []) {
  const visible = Array.isArray(sections) ? sections.filter((section) => section?.paragraphs?.length || section?.items?.length || section?.schools?.length) : [];
  if (!visible.length) return "";
  return `
    <div class="scholarship-official-reader" id="scholarship-notice">
      <div class="scholarship-reference-subhead"><span class="module-kicker">Official notice</span><h3>Original notice, structured</h3></div>
      <div class="scholarship-official-stack">
        ${visible.slice(0, 8).map((section) => `
          <section>
            <h3>${escapeHtml(section.title || "Notice section")}</h3>
            ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
            ${(section.items || []).length ? `<ol>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : ""}
            ${(section.schools || []).length ? `
              <div class="scholarship-official-school-grid">
                ${section.schools.map((school) => `<span><b>${escapeHtml(school.index)}</b><strong>${escapeHtml(school.name)}</strong><em>${escapeHtml(school.meta)}</em></span>`).join("")}
              </div>
            ` : ""}
          </section>
        `).join("")}
      </div>
    </div>
  `;
}

function renderScholarshipNoticeSections(sections = []) {
  const visible = sections.filter((section) => section?.title || section?.paragraphs?.length || section?.items?.length);
  if (!visible.length) return "";
  return `
    <div class="scholarship-notice-stack">
      ${visible.map((section) => `
        <section>
          <h3>${escapeHtml(section.title || "Notice section")}</h3>
          ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          ${(section.items || []).length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        </section>
      `).join("")}
    </div>
  `;
}

function renderScholarshipContactPanel(contactRows = [], actionCards = []) {
  const rows = Array.isArray(contactRows) ? contactRows.filter((row) => row?.label || row?.value) : [];
  const actions = Array.isArray(actionCards) ? actionCards.filter((item) => item?.title || item?.href) : [];
  if (!rows.length && !actions.length) return "";
  return `
    <article class="detail-card scholarship-contact-card">
      <div class="side-panel-head">
        <div><span class="module-kicker">Contact</span><h2>Official contact</h2></div>
      </div>
      ${rows.length ? `
        <div class="scholarship-contact-list">
          ${rows.map((row) => `
            <div>
              <span>${escapeHtml(row.label || "Contact")}</span>
              ${row.href ? `<a href="${escapeHtml(row.href)}">${escapeHtml(row.value || row.href)}</a>` : `<strong>${escapeHtml(row.value || "Confirm")}</strong>`}
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${actions.length ? `
        <div class="scholarship-link-list">
          ${actions.slice(0, 4).map((item) => `
            <a href="${escapeHtml(item.href || "scholarships.html")}">
              <strong>${escapeHtml(item.title || "Open link")}</strong>
              <span>${escapeHtml(item.body || "Related scholarship action")}</span>
            </a>
          `).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderScholarshipApplyPanel(guide = {}) {
  const isUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());
  const primary = guide.primaryAction && isUrl(guide.primaryAction.href) ? guide.primaryAction : null;
  const source = guide.sourceAction && isUrl(guide.sourceAction.href) ? guide.sourceAction : null;
  if (!primary && !source) return "";
  return `
    <article class="detail-card scholarship-apply-panel">
      <div class="side-panel-head">
        <div><span class="module-kicker">Apply</span><h2>Ready to check?</h2></div>
      </div>
      <div class="scholarship-apply-actions">
        ${primary ? `<a class="primary-action" href="${escapeHtml(primary.href)}" target="_blank" rel="noreferrer">${escapeHtml(primary.label || "Open official application")}</a>` : ""}
        ${source ? `<a class="secondary-action" href="${escapeHtml(source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.label || "Open official source")}</a>` : ""}
        <button class="secondary-action" type="button" data-share-scholarship>Copy link</button>
      </div>
    </article>
  `;
}

function scholarshipFieldValue(guide = {}, label = "", fallback = "Check notice") {
  const field = (guide.fieldSummary || []).find((item) => item?.label === label);
  return field?.value || fallback;
}

function renderScholarshipScopeSummary(guide = {}) {
  const rows = [
    { label: "Funding", value: scholarshipFieldValue(guide, "Funding level", "Confirm funding") },
    { label: "Degree", value: scholarshipFieldValue(guide, "Degree fit", "Check degree") },
    { label: "Deadline", value: scholarshipFieldValue(guide, "Deadline", "Pending") },
  ];
  return `
    <section class="scholarship-scope-summary reveal" id="scholarship-scope" aria-label="Scholarship key facts">
      <div class="scholarship-scope-facts">
        ${rows.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></article>`).join("")}
      </div>
    </section>
  `;
}

function renderScholarshipAboutPanel(data = {}, guide = {}) {
  const fundingSection = (Array.isArray(data.profileSections) ? data.profileSections : [])
    .find((section) => /funding route/i.test(String(section?.title || "")));
  const fundingRows = fundingSection?.rows || [];
  const preferredLabels = ["Provider", "Coverage", "Amount", "Applicable degree", "Applicable program"];
  const profileFields = preferredLabels
    .map((label) => [label, fundingRows.find((row) => row?.[0] === label)?.[1]])
    .filter(([, value]) => value);
  const fields = (profileFields.length ? profileFields : [
    ["Provider", scholarshipFieldValue(guide, "Provider", "Check provider")],
    ["Route type", scholarshipFieldValue(guide, "Route type", "Scholarship")],
    ["Scope", scholarshipFieldValue(guide, "Country scope", "Check notice")],
    ["Application rule", "After program match"],
  ]).filter(([, value]) => value);
  return `
    <article class="detail-card funding-section-card scholarship-about-card" id="scholarship-about">
      <div class="section-head">
        <div>
          <span class="module-kicker">Details</span>
          <h2>Scholarship details</h2>
        </div>
      </div>
      <p class="scholarship-about-copy">${escapeHtml(data.summary || "Use this scholarship route together with school and program fit before relying on it.")}</p>
      <div class="scholarship-about-facts">
        ${fields.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
      </div>
    </article>
  `;
}

function renderScholarshipSideFacts(guide = {}) {
  const sideRows = Array.isArray(guide.sidebarCards) ? guide.sidebarCards : [];
  const rows = (sideRows.length
    ? sideRows.map((item) => [item.title, item.body])
    : [
        ["Apply window", scholarshipFieldValue(guide, "Deadline", "Check deadline")],
        ["Scope", scholarshipFieldValue(guide, "Country scope", "Check notice")],
        ["Source", guide.sourceAction?.label || guide.sourceAction?.title || "Official notice"],
      ]).filter(([, value]) => value);
  if (!rows.length) return "";
  return `
    <article class="detail-card scholarship-side-facts">
      <h2>At a glance</h2>
      <dl>
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
    </article>
  `;
}

function renderScholarshipActionPanel(heroAction = {}, checklist = []) {
  const items = Array.isArray(checklist) ? checklist.filter(Boolean).slice(0, 4) : [];
  return `
    <article class="detail-card scholarship-action-card">
      <span class="module-kicker">Next step</span>
      <h2>Use this scholarship with a program</h2>
      <p>Start from real programs, then confirm whether this funding route applies.</p>
      <div class="scholarship-action-buttons">
        <a class="primary-action" href="${escapeHtml(heroAction.href || "programs.html?filter=Scholarship")}">${escapeHtml(heroAction.label || "Find programs")}</a>
        <button class="secondary-action" type="button" data-save-detail>Save to favourites</button>
      </div>
      ${items.length ? `<ol class="scholarship-action-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : ""}
    </article>
  `;
}

function renderUniversityPreviewCards(items = [], emptyText = "Confirm current school information before choosing.", actionLabel = "Open") {
  if (!items.length) return `<p class="university-preview-empty">${escapeHtml(emptyText)}</p>`;
  return items.slice(0, 6).map((item) => `
    <article class="university-preview-card">
      <div>
        <strong>${escapeHtml(item.title || "School option")}</strong>
        <p>${escapeHtml(item.body || emptyText)}</p>
      </div>
      <a class="secondary-action" href="${escapeHtml(item.href || "programs.html")}">${escapeHtml(actionLabel)}</a>
    </article>
  `).join("");
}

function hasUsableDetailValue(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !/^(confirm|pending|deadline pending)\b/i.test(text);
}

function detailDisplayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value || "").trim();
}

function detailBasicDisplayValue(label, value) {
  const text = detailDisplayValue(value);
  if (/^school type$/i.test(label) && /^regular$/i.test(text)) return "Regular university";
  if (/^(teaching|application levels)$/i.test(label)) return text.replace(/,\s*/g, " / ");
  return text;
}

function detailShortRequirementValue(value) {
  return detailDisplayValue(value)
    .replace(/school-approved\s+/i, "")
    .replace(/\s+for English-taught routes\.?/i, "")
    .replace(/program-specific;\s*/i, "")
    .replace(/\.\s*$/, "")
    .trim();
}

function detailProfileValue(data, labels = []) {
  const labelSet = new Set((Array.isArray(labels) ? labels : [labels]).map((label) => String(label || "").toLowerCase()));
  const sections = Array.isArray(data?.profileSections) ? data.profileSections : [];
  for (const section of sections) {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    for (const [label, value] of rows) {
      if (labelSet.has(String(label || "").toLowerCase())) {
        const displayValue = detailDisplayValue(value);
        if (hasUsableDetailValue(displayValue)) return displayValue;
      }
    }
  }
  return "";
}

function renderUniversityBasics(items = []) {
  const seen = new Set();
  const visibleItems = items
    .map((item) => ({ ...item, value: detailBasicDisplayValue(item?.label || "", item?.value) }))
    .filter((item) => {
      const key = String(item?.label || "").toLowerCase();
      if (!key || seen.has(key) || !hasUsableDetailValue(item.value)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
  if (!visibleItems.length) return "";
  return `
    <article class="detail-card university-basics-card university-basics-panel" id="university-basics">
      <div class="section-head university-basics-head">
        <div>
          <span class="module-kicker">Quick facts</span>
          <h2>At a glance</h2>
        </div>
      </div>
      <div class="university-basics-grid" aria-label="School basic information">
        ${visibleItems.map((item) => `
          <article>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

function renderUniversityOverview(data, basics = [], highlights = []) {
  const visibleHighlights = highlights
    .filter((item) => item?.label && item?.title)
    .slice(0, 3);
  return `
    <section class="university-overview-grid" id="university-overview" aria-label="University overview">
      <article class="detail-card university-about-card">
        <div class="section-head university-about-head">
          <div>
            <span class="module-kicker">About</span>
            <h2>${escapeHtml(data.title || "University profile")}</h2>
          </div>
        </div>
        <p>${escapeHtml(data.summary || "Review school fit, program routes, timing, language, and funding before adding a choice.")}</p>
      </article>
      <div class="university-overview-side">
        ${renderUniversityBasics(basics)}
        ${visibleHighlights.length ? `
          <article class="detail-card university-check-preview">
            <div class="section-head university-about-head">
              <div>
                <span class="module-kicker">Application fit</span>
                <h2>What affects the choice</h2>
              </div>
            </div>
            <div class="university-about-highlights" aria-label="Planning highlights">
            ${visibleHighlights.map((item) => `
              <article>
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.title)}</strong>
                ${item.body ? `<small>${escapeHtml(item.body)}</small>` : ""}
              </article>
            `).join("")}
            </div>
          </article>
        ` : ""}
      </div>
    </section>
  `;
}

function hasConcreteUniversityProgramData(item = {}) {
  if (/program area to verify/i.test(String(item.meta || ""))) return false;
  return [item.deadline, item.tuition, item.teaching].some(hasUsableDetailValue);
}

function renderUniversityProgramRows(rows = [], fallbackCards = []) {
  if (!rows.length) return renderUniversityPreviewCards(fallbackCards, "Confirm current programs in the school catalog.", "View program");
  return rows.slice(0, 8).map((item) => {
    const subjects = Array.isArray(item.subjects) ? item.subjects.filter(Boolean) : [];
    const isProgramArea = !hasConcreteUniversityProgramData(item);
    const usable = (value) => {
      const text = String(value || "").trim();
      return Boolean(text) && !/^confirm\b/i.test(text) && !/^pending\b/i.test(text);
    };
    const isUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());
    const sourceLinks = [
      isUrl(item.applicationUrl) ? { label: "Application entry", href: item.applicationUrl } : null,
      isUrl(item.sourceUrl) ? { label: item.sourceLabel && !/source/i.test(item.sourceLabel) ? item.sourceLabel : "Official program notice", href: item.sourceUrl } : null,
    ].filter((link) => link?.href);
    const keyFacts = isProgramArea
      ? []
      : [
          item.deadline ? ["Deadline", item.deadline] : null,
          item.tuition ? ["Tuition", item.tuition] : null,
          item.teaching ? ["Teaching", item.teaching] : null,
        ].filter(Boolean);
    const detailFacts = [
      ["CSCA", item.csca],
      ["Language proof", item.language],
      ["Funding", item.scholarship],
      ["Language requirement", item.languageRequirement || (!isProgramArea ? item.language : "")],
      ["Application note", item.applicationNote || item.note],
    ].filter(([, value]) => hasUsableDetailValue(value));
    return `
    <article class="university-program-row ${isProgramArea ? "is-area" : ""}" data-university-program-row data-degree="${escapeHtml(item.degree || "")}" data-teaching="${escapeHtml(item.teaching || "")}" data-subjects="${escapeHtml(subjects.join("|"))}">
      <div class="university-program-main">
        <strong>${escapeHtml(item.title || "Program route")}</strong>
        ${item.titleZh ? `<em class="university-program-title-zh">${escapeHtml(item.titleZh)}</em>` : ""}
        <span>${escapeHtml(isProgramArea ? "Subject area. Open a route before relying on fee or deadline." : (item.meta || "Program route"))}</span>
        ${subjects.length ? `<div class="university-program-tags">${subjects.slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${keyFacts.length ? `<dl class="university-program-facts">
          ${keyFacts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
        </dl>` : ""}
      </div>
      <div class="university-program-side">
        <div class="university-program-actions">
          <a class="${isProgramArea ? "secondary-action" : "primary-action"}" href="${escapeHtml(item.href || "programs.html")}">${isProgramArea ? "Find route" : "View program"}</a>
        </div>
      </div>
      <details class="university-program-details">
        <summary>${isProgramArea ? "What to confirm" : "Route details"}</summary>
        <div>
          ${detailFacts.length ? detailFacts.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></p>`).join("") : `<p class="university-detail-note">${isProgramArea ? "Open matching programs to confirm degree, intake, fee, language, and application entry." : "Confirm the current requirement on the official program page before applying."}</p>`}
          ${sourceLinks.length ? `<div class="university-program-source-links">${sourceLinks.map((link) => `<a href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div>` : ""}
        </div>
      </details>
    </article>
  `;
  }).join("");
}

function renderUniversityProgramFilters(rows = []) {
  const visibleRows = rows.slice(0, 8);
  if (visibleRows.length < 2) return "";
  if (!visibleRows.some(hasConcreteUniversityProgramData)) return "";
  const unique = (values) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).slice(0, 12);
  const degrees = unique(visibleRows.map((item) => item.degree));
  const teaching = unique(visibleRows.map((item) => item.teaching));
  const subjects = unique(visibleRows.flatMap((item) => Array.isArray(item.subjects) ? item.subjects : []));
  const renderSelect = (key, label, options, allLabel) => `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-university-program-filter="${escapeHtml(key)}">
        <option value="">${escapeHtml(allLabel)}</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
  return `
    <div class="university-program-filter-bar" aria-label="Filter programs at this school">
      <div>
        ${renderSelect("degree", "Degree", degrees, "All degrees")}
        ${renderSelect("teaching", "Teaching", teaching, "All teaching")}
        ${renderSelect("subject", "CSCA subject", subjects, "All subjects")}
      </div>
      <strong data-university-program-count>${visibleRows.length} shown</strong>
    </div>
    <p class="university-program-empty" data-university-program-empty hidden>No program route matches these filters.</p>
  `;
}

function renderUniversityScholarshipRows(rows = [], fallbackCards = []) {
  if (!rows.length) return renderUniversityPreviewCards(fallbackCards, "Confirm current scholarship options with the school.", "View funding");
  return rows.slice(0, 8).map((item) => {
    const facts = [
      ["Coverage", item.coverage || "Confirm coverage"],
      ["Degree", item.degree || "Confirm degree fit"],
      ["Program", item.program || "Confirm program scope"],
    ].filter(([, value]) => hasUsableDetailValue(value));
    const meta = item.meta && !/school funding route/i.test(item.meta) ? item.meta : "";
    return `
    <article class="university-scholarship-row ${facts.length ? "" : "no-facts"}">
      <div>
        <strong>${escapeHtml(item.title || "Scholarship route")}</strong>
        ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
      </div>
      ${facts.length ? `<div class="university-scholarship-facts">
        ${facts.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}
      </div>` : ""}
      <a class="secondary-action" href="${escapeHtml(item.href || "scholarships.html")}">View funding</a>
      <details class="university-scholarship-details">
        <summary>What to confirm</summary>
        <p>${escapeHtml(item.requirement || "Confirm school requirements")}</p>
      </details>
    </article>
  `;
  }).join("");
}

function renderUniversityCscaRuleCards(cards = []) {
  if (!cards.length) return `<p class="university-check-empty">Confirm school-level CSCA and language rules on the selected program route.</p>`;
  return cards.slice(0, 6).map((item) => `
    <article class="university-csca-card tone-${escapeHtml(item.tone || "general")}">
      <div class="university-csca-head">
        <strong>${escapeHtml(item.title || "CSCA check")}</strong>
        <span>${escapeHtml(item.category || "School rule")}</span>
      </div>
      <p>${escapeHtml(item.body || "Confirm the current school rule before applying.")}</p>
      ${item.applicablePrograms?.length ? `<div class="university-csca-tags">${item.applicablePrograms.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${item.languageCondition ? `<small>${escapeHtml(item.languageCondition)}</small>` : ""}
      ${item.importantNote ? `<em>${escapeHtml(item.importantNote)}</em>` : ""}
    </article>
  `).join("");
}

function renderUniversitySchoolChecks(guide = {}) {
  const cscaCards = Array.isArray(guide.cscaRuleCards) ? guide.cscaRuleCards : [];
  const scholarshipRows = Array.isArray(guide.scholarshipRows) ? guide.scholarshipRows : [];
  if (!cscaCards.length && !scholarshipRows.length) return "";
  return `
    <details class="detail-card university-school-checks" id="university-checks">
      <summary class="section-head">
        <div>
          <span class="module-kicker">Check</span>
          <h2>Before you apply</h2>
        </div>
      </summary>
      <div class="university-school-check-grid">
        <section>
          <h3>CSCA</h3>
          <div class="university-csca-grid">${renderUniversityCscaRuleCards(cscaCards)}</div>
        </section>
        <section>
          <h3>Funding</h3>
          <div class="university-funding-check-list">${renderUniversityScholarshipRows(scholarshipRows.slice(0, 4), guide.scholarshipCards || [])}</div>
        </section>
      </div>
    </details>
  `;
}

function renderUniversityApplicationPlanning(guide = {}) {
  const timeline = Array.isArray(guide.applicationTimeline) ? guide.applicationTimeline.filter(Boolean).slice(0, 4) : [];
  const structuredDeadlines = Array.isArray(guide.upcomingDeadlines) ? guide.upcomingDeadlines.filter((row) => row?.deadline || row?.title).slice(0, 3) : [];
  const deadlines = structuredDeadlines.length
    ? structuredDeadlines
    : (guide.programRows || [])
      .filter((row) => row?.deadline && !/^(confirm|pending|deadline pending)$/i.test(String(row.deadline).trim()))
      .slice(0, 3)
      .map((row) => ({
        title: row.title || "Program route",
        meta: [row.degree, row.teaching].filter(Boolean).join(" · ") || row.meta || "Program route",
        deadline: row.deadline,
        status: row.round || "",
      }));
  if (!timeline.length && !deadlines.length) return "";
  const renderTimelineRow = (item) => {
    const [label, ...rest] = String(item || "").split(":");
    const body = rest.join(":").trim();
    return `<li><strong>${escapeHtml(label || "Application step")}</strong>${body ? `<span>${escapeHtml(body)}</span>` : ""}</li>`;
  };
  return `
    <details class="detail-card university-application-plan" id="university-timing">
      <summary class="section-head">
        <div><span class="module-kicker">Timing</span><h2>Deadlines and school steps</h2></div>
      </summary>
      <div class="university-application-plan-grid">
        <section>
          <h3>School application timeline</h3>
          ${timeline.length ? `<ol class="university-application-timeline">${timeline.map(renderTimelineRow).join("")}</ol>` : `<p class="university-program-empty">Check the admissions page for the current school timeline.</p>`}
        </section>
        <section>
          <h3>Closest program deadlines</h3>
          ${deadlines.length ? `<div class="university-deadline-list">${deadlines.map((row) => `
            <article>
              <div>
                <strong>${escapeHtml(row.title || "Program route")}</strong>
                <span>${escapeHtml(row.meta || [row.degree, row.teaching].filter(Boolean).join(" · ") || "Program route")}</span>
              </div>
              <time>${escapeHtml(row.deadline)}</time>
              ${row.status ? `<b>${escapeHtml(row.status)}</b>` : ""}
            </article>
          `).join("")}</div>` : `<p class="university-program-empty">No dated program deadline is listed yet.</p>`}
        </section>
      </div>
    </details>
  `;
}

function renderUniversityOfficialActions(actions = {}) {
  const links = Array.isArray(actions.links) ? actions.links.filter((item) => item?.href || item?.title) : [];
  const fee = actions.applicationFee || "";
  if (!links.length && !fee) return "";
  return `
    <details class="detail-card university-official-card">
      <summary class="side-panel-head">
        <div><span class="module-kicker">Official checks</span><h2>Links and fee</h2></div>
      </summary>
      ${fee ? `<div class="university-official-fee"><span>Application fee</span><strong>${escapeHtml(fee)}</strong></div>` : ""}
      ${links.length ? `
        <div class="program-official-list university-official-list" aria-label="Official university links">
          ${links.slice(0, 3).map((item) => `
            <a href="${escapeHtml(item.href || "universities.html")}" target="_blank" rel="noreferrer">
              <strong>${escapeHtml(item.title || "Official check")}</strong>
              <p>${escapeHtml(item.body || "Confirm this detail on the current school page.")}</p>
            </a>
          `).join("")}
        </div>
      ` : `<p class="university-preview-empty">Confirm official links in the school admissions source before applying.</p>`}
    </details>
  `;
}

function renderUniversityApplicationChecks(guide = {}) {
  const cscaCards = Array.isArray(guide.cscaRuleCards) ? guide.cscaRuleCards : [];
  const scholarshipRows = Array.isArray(guide.scholarshipRows) ? guide.scholarshipRows : [];
  const timeline = Array.isArray(guide.applicationTimeline) ? guide.applicationTimeline.filter(Boolean).slice(0, 4) : [];
  const structuredDeadlines = Array.isArray(guide.upcomingDeadlines) ? guide.upcomingDeadlines.filter((row) => row?.deadline || row?.title).slice(0, 3) : [];
  const deadlines = structuredDeadlines.length
    ? structuredDeadlines
    : (guide.programRows || [])
      .filter((row) => row?.deadline && !/^(confirm|pending|deadline pending)$/i.test(String(row.deadline).trim()))
      .slice(0, 3)
      .map((row) => ({
        title: row.title || "Program route",
        meta: [row.degree, row.teaching].filter(Boolean).join(" · ") || row.meta || "Program route",
        deadline: row.deadline,
        status: row.round || "",
      }));
  const actions = guide.officialActions || {};
  const links = Array.isArray(actions.links) ? actions.links.filter((item) => item?.href || item?.title).slice(0, 3) : [];
  const fee = actions.applicationFee || "";
  const hasChecks = cscaCards.length || scholarshipRows.length || timeline.length || deadlines.length || links.length || fee;
  if (!hasChecks) return "";
  const renderTimelineRow = (item) => {
    const [label, ...rest] = String(item || "").split(":");
    const body = rest.join(":").trim();
    return `<li><strong>${escapeHtml(label || "Step")}</strong>${body ? `<span>${escapeHtml(body)}</span>` : ""}</li>`;
  };
  return `
    <details class="detail-card university-application-checks" id="university-checks">
      <summary class="section-head">
        <div><span class="module-kicker">Check</span><h2>Before you apply</h2></div>
      </summary>
      <div class="university-check-summary-grid">
        <section>
          <h3>CSCA</h3>
          <div class="university-csca-grid">${renderUniversityCscaRuleCards(cscaCards)}</div>
        </section>
        <section>
          <h3>Funding</h3>
          <div class="university-funding-check-list">${renderUniversityScholarshipRows(scholarshipRows.slice(0, 3), guide.scholarshipCards || [])}</div>
        </section>
        <section>
          <h3>Dates</h3>
          ${timeline.length ? `<ol class="university-application-timeline">${timeline.map(renderTimelineRow).join("")}</ol>` : ""}
          ${deadlines.length ? `<div class="university-deadline-list">${deadlines.map((row) => `
            <article>
              <div>
                <strong>${escapeHtml(row.title || "Program route")}</strong>
                <span>${escapeHtml(row.meta || [row.degree, row.teaching].filter(Boolean).join(" · ") || "Program route")}</span>
              </div>
              <time>${escapeHtml(row.deadline)}</time>
            </article>
          `).join("")}</div>` : ""}
        </section>
        <section>
          <h3>Official entry</h3>
          ${fee ? `<div class="university-official-fee"><span>Application fee</span><strong>${escapeHtml(fee)}</strong></div>` : ""}
          ${links.length ? `<div class="program-official-list university-official-list" aria-label="Official university links">
            ${links.map((item) => `
              <a href="${escapeHtml(item.href || "universities.html")}" target="_blank" rel="noreferrer">
                <strong>${escapeHtml(item.title || "Official check")}</strong>
                <p>${escapeHtml(item.body || "Confirm this detail on the current school page.")}</p>
              </a>
            `).join("")}
          </div>` : ""}
        </section>
      </div>
    </details>
  `;
}

function renderSideSnapshot(items = []) {
  const visibleItems = items.filter((item) => item?.label && item?.value);
  if (!visibleItems.length) return "";
  return `
    <div class="side-snapshot" aria-label="Decision summary">
      ${visibleItems.slice(0, 4).map((item) => `
        <article>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function detailFactValue(data, label, fallback = "") {
  return (data?.facts || []).find(([itemLabel]) => itemLabel === label)?.[1] || fallback;
}

function detailHeroAction(data) {
  if (mode === "program") return { label: "Add choice", href: "application.html#add-choice" };
  if (mode === "university") return { label: "Find programs", href: `programs.html?q=${encodeURIComponent(data.title || "")}` };
  if (mode === "scholarship") return { label: "Find programs", href: "programs.html?filter=Scholarship" };
  if (mode === "city") return { label: "Find programs", href: `programs.html?city=${encodeURIComponent(data.title || "")}` };
  if (mode === "guide") return { label: "Open Hub", href: "hub.html" };
  return { label: "Back to catalog", href: detailBackHref() };
}

function renderSnapshot(data) {
  const facts = Array.isArray(data?.facts) ? data.facts : [];
  if (!facts.length || data.hideSnapshot) return "";
  return `
        <article class="detail-card">
          <div class="section-head"><div><span class="module-kicker">${escapeHtml(data.snapshotKicker || "Snapshot")}</span><h2>${escapeHtml(data.snapshotTitle || "What matters before choosing")}</h2></div></div>
          <div class="info-grid">${facts.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div>
        </article>
  `;
}

function requestedCompletionState() {
  const state = params.get("state");
  if (["loading", "empty", "error"].includes(state)) return state;
  if (params.get("loading") === "1") return "loading";
  if (params.get("missing") === "1" || params.get("empty") === "1") return "empty";
  if (params.get("error") === "1") return "error";
  return "ready";
}

function retryDetailHref() {
  const next = new URL(location.href);
  ["state", "loading", "missing", "empty", "error"].forEach((key) => next.searchParams.delete(key));
  return `${location.pathname.split("/").pop()}${next.search}${next.hash}`;
}

function renderCompletionLoading() {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  const label = `${titleFromSlug(mode)} detail`;
  target.innerHTML = `
    <section class="state-panel reveal" data-completion-state="loading" aria-busy="true">
      <div class="state-copy">
        <a class="back-link" href="${detailBackHref()}">Back</a>
        <span class="module-kicker">Loading</span>
        <h1>Loading route detail</h1>
        <p>CUAC is preparing the ${escapeHtml(label)} view with catalog facts, application steps, and next actions.</p>
        <div class="status-row"><span class="status-pill">Catalog facts</span><span class="status-pill warn">Preparing route detail</span><span class="status-pill">Agent ready soon</span></div>
      </div>
      <div class="state-card state-skeleton" aria-hidden="true">
        <span class="skeleton-line wide"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-line short"></span>
        <div class="skeleton-grid">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    </section>
  `;
}

function renderCompletionEmpty() {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  target.innerHTML = `
    <section class="state-panel reveal" data-completion-state="empty">
      <div class="state-copy">
        <a class="back-link" href="${detailBackHref()}">Back</a>
        <span class="module-kicker">No detail found</span>
        <h1>No matching CUAC detail record</h1>
        <p>The catalog route opened correctly, but CUAC could not match the requested ${escapeHtml(titleFromSlug(mode))} record. Return to the catalog and choose from the current data set.</p>
        <div class="state-actions">
          <a class="primary-action" href="${detailBackHref()}">Back to catalog</a>
        </div>
      </div>
      <div class="state-card">
        <span class="module-kicker">Try next</span>
        <ul class="state-list">
          <li>Use a school, program, scholarship, city, or guide link generated by CUAC.</li>
          <li>Keep URL filters normalized when sharing detail links.</li>
          <li>Use the floating Agent input if you want help finding the closest matching route.</li>
        </ul>
      </div>
    </section>
  `;
}

function renderCompletionError() {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  target.innerHTML = `
    <section class="state-panel reveal" data-completion-state="error" role="alert">
      <div class="state-copy">
        <a class="back-link" href="${detailBackHref()}">Back</a>
        <span class="module-kicker">Detail unavailable</span>
        <h1>Could not load this CUAC detail</h1>
        <p>The page shell is available, but the detail data did not finish loading. You can retry, return to the catalog, or ask Agent to find a nearby route.</p>
        <div class="state-actions">
          <a class="primary-action" href="${escapeHtml(retryDetailHref())}">Retry</a>
          <a class="secondary-action" href="${detailBackHref()}">Back to catalog</a>
        </div>
      </div>
      <div class="state-card">
        <span class="module-kicker">Keep going</span>
        <ul class="state-list">
          <li>Do not lose the current route intent.</li>
          <li>Do not show an empty successful detail page for failed data.</li>
          <li>Keep protected actions behind the shared sign-in continuation flow.</li>
        </ul>
      </div>
    </section>
  `;
}

function renderCityDetailPage(data) {
  const target = document.querySelector("[data-detail-root]");
  if (!target || !data) return;
  currentDetailData = data;
  const guide = data.cityGuide || {};
  const heroAction = detailHeroAction(data);
  const checklist = Array.isArray(data.checklist) ? data.checklist : [];
  const status = Array.isArray(data.status) ? data.status : [];
  const resourceFacts = Array.isArray(guide.resourceFacts) && guide.resourceFacts.length ? guide.resourceFacts : (guide.quickFacts || []);
  const resourceFactValue = (label, fallback = "0") => String(resourceFacts.find((fact) => fact?.label === label)?.value || fallback);
  const citySlug = slugify(data.entityId || data.title || guide.chineseName || "");
  const cityParam = encodeURIComponent(citySlug || slugify(data.title || ""));
  target.dataset.detailEntityType = data.entityType || "City";
  target.dataset.detailEntityId = data.entityId || data.title || "";
  target.dataset.detailSourceModel = data.sourceFieldLineage?.sourceModel || "";
  target.dataset.detailSourceFieldCount = String((data.schemaSections || []).reduce((total, section) => total + (section.rows || []).length, 0));
  target.innerHTML = `
    <section class="city-detail-hero reveal">
      <div class="city-hero-copy">
        <a class="back-link" href="${detailBackHref()}">Back to cities</a>
        <span class="module-kicker">City information</span>
        <h1>Study in ${escapeHtml(data.title)}</h1>
        <p>${escapeHtml(data.summary)}</p>
        <div class="status-row">${status.map((item, index) => `<span class="status-pill ${index === 1 ? "warn" : ""}">${escapeHtml(item)}</span>`).join("")}</div>
        <div class="hero-actions">
          <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
          <a class="secondary-action" href="${escapeHtml(detailBackHref())}">All cities</a>
        </div>
      </div>
      <aside class="city-budget-card">
        <span>Monthly living cost reference</span>
        <strong>${escapeHtml(cityBudgetDisplayLine(guide))}</strong>
        <div class="city-budget-badges">
          <em>${escapeHtml(data.status?.[1] || "Cost check")}</em>
          <em>${escapeHtml(data.status?.[2] || "Student route")}</em>
        </div>
        ${renderCityBestForChips(guide.bestFor || [])}
        <p>${escapeHtml(guide.budget?.note || "Living cost depends mainly on housing, campus location, and commute.")}</p>
      </aside>
    </section>

    ${renderCityQuickFacts(guide.quickFacts || [])}
    ${renderCityGlance(guide)}
    ${renderCityAggregateCards(guide.aggregateCards || [])}
    ${renderCitySectionNav()}
    ${renderDecisionPanels(data)}

    <section class="city-detail-layout reveal">
      <div class="city-detail-main">
        <article class="detail-card city-fit-panel" id="city-fit">
          <div>
            <span class="module-kicker">City fit</span>
            <h2>${escapeHtml(data.title)} is a better fit for these applicants</h2>
            <p>${escapeHtml(guide.overview || data.summary)}</p>
          </div>
          <div class="city-fit-list">
            ${cityTextListItems(guide.bestFor || [], 4).map((item, index) => `
              <article><span>${index + 1}</span><p>${escapeHtml(item)}</p></article>
            `).join("")}
          </div>
        </article>

        <article class="detail-card city-why-panel" id="city-why">
          <div class="section-head">
            <div>
              <span class="module-kicker">Why this city works</span>
              <h2>Use these reasons before comparing schools</h2>
            </div>
          </div>
          ${renderCityTextCards(guide.why || [], "city-why-grid")}
        </article>

        <article class="detail-card city-budget-panel" id="city-budget">
          <div class="section-head"><div><span class="module-kicker">Budget</span><h2>Plan living cost before choosing</h2></div></div>
          <div class="city-budget-summary">
            <span><b>${escapeHtml(guide.budget?.monthly || guide.monthlyCost || "Pending")}</b>monthly range</span>
            <span><b>${escapeHtml(guide.budget?.yearly || "Estimate after housing check")}</b>first-year planning</span>
          </div>
          ${renderCityTextCards(guide.costProfiles || [], "city-cost-profiles")}
          <div class="city-cost-list">
            ${(guide.costBreakdown || []).map((item) => `<span><b>${escapeHtml(item.label)}</b>${escapeHtml(item.value)}</span>`).join("")}
          </div>
        </article>

        <article class="detail-card city-related-panel" id="city-schools">
          <div class="section-head">
            <div>
              <span class="module-kicker">City schools</span>
              <h2>Universities students can compare here</h2>
            </div>
          </div>
          <p class="city-section-note">Use the city as a filter, then compare each university by exact program, language route, deadline, and school-side requirements.</p>
          ${renderCitySchoolCards(guide.relatedSchools || [], "Open Universities filtered by city to find current school options.")}
        </article>

        <article class="detail-card city-related-panel" id="city-programs">
          <div class="section-head">
            <div>
              <span class="module-kicker">Related programs</span>
              <h2>Programs students can actually compare</h2>
            </div>
          </div>
          <p class="city-section-note">A city only becomes useful when it leads to concrete school-program choices with tuition, language route, and deadline context.</p>
          ${renderCityProgramKeywords(guide.programKeywords || [])}
          ${renderCityProgramFilters(guide.relatedPrograms || [])}
          ${renderCityProgramCards(guide.relatedPrograms || [], "Open Programs filtered by city to find exact degree routes.")}
        </article>

        <article class="detail-card city-related-panel" id="city-funding">
          <div class="section-head">
            <div>
              <span class="module-kicker">City scholarships</span>
              <h2>Scholarship routes in this city</h2>
            </div>
          </div>
          <p class="city-section-note">Funding should be checked together with the school and program, because eligibility and document requests are not city-level decisions.</p>
          ${renderCityScholarshipCards(guide.relatedScholarships || [], "Open Scholarships filtered by city to compare funding options.")}
        </article>

        <article class="detail-card" id="city-routes">
          <div class="section-head"><div><span class="module-kicker">Schools and routes</span><h2>Turn the city choice into specific programs</h2></div></div>
          ${renderCityRoutes(guide.routes || [])}
        </article>

        <article class="detail-card" id="city-life">
          <div class="section-head"><div><span class="module-kicker">City life and adaptation</span><h2>Check campus life before saving the route</h2></div></div>
          ${renderCityTextCards(guide.lifeSections || [], "city-life-grid")}
          ${(guide.transportNotes || []).length ? `
            <div class="city-transport-panel">
              <span class="module-kicker">Transport and arrival</span>
              ${renderCityTextCards(guide.transportNotes || [], "city-transport-grid")}
            </div>
          ` : ""}
          ${renderCityNearbyCards(guide.nearbyCards || [])}
        </article>

        <article class="detail-card city-next-panel" id="city-next">
          <div class="section-head"><div><span class="module-kicker">Next choices</span><h2>Use the city only after program fit is clear</h2></div></div>
          ${renderCityTextCards(guide.applicationAdvice || [], "city-advice-list")}
          ${renderCityApplicationChecklist(guide.applicationTips || checklist || [])}
        </article>

        <article class="detail-card" id="city-faq">
          <div class="section-head"><div><span class="module-kicker">Common questions</span><h2>Questions students ask before choosing</h2></div></div>
          ${renderCityFaqs(guide.faqs || [])}
        </article>
      </div>

      <aside class="side-stack city-side-stack">
        <article class="detail-card action-panel city-decision-card">
          <div class="side-panel-head">
            <div><span class="module-kicker">${escapeHtml(data.title)} decision summary</span><h2>Use city fit as a tie-breaker</h2></div>
            <span class="side-progress" data-check-progress>1/${escapeHtml(checklist.length || 0)} ready</span>
          </div>
          <div class="side-progress-track" aria-hidden="true"><span data-check-meter></span></div>
          ${renderSideSnapshot([
            { label: "Monthly", value: guide.budget?.monthly || guide.monthlyCost || "Pending" },
            { label: "Available schools", value: resourceFactValue("Universities", data.metrics?.[0]?.[0] || "0") },
            { label: "Program routes", value: resourceFactValue("Programs", data.metrics?.[1]?.[0] || "0") },
            { label: "English routes", value: resourceFactValue("English routes", data.metrics?.[2]?.[0] || "0") },
          ])}
          <div class="city-side-summary">
            <strong>Best use</strong>
            <p>${escapeHtml(guide.budget?.note || "Choose the city after the school, program, language route, and deadline are clear.")}</p>
          </div>
          <div class="city-side-action-grid" aria-label="City decision shortcuts">
            <a class="city-side-action primary" href="universities.html?city=${cityParam}">
              <strong>Filter this city schools</strong>
              <span>${escapeHtml(resourceFactValue("Universities", data.metrics?.[0]?.[0] || "0"))} schools to compare</span>
            </a>
            <a class="city-side-action" href="programs.html?city=${cityParam}">
              <strong>English programs</strong>
              <span>${escapeHtml(resourceFactValue("English routes", data.metrics?.[2]?.[0] || "0"))} routes visible</span>
            </a>
            <a class="city-side-action" href="guides.html#timeline">
              <strong>Application timeline</strong>
              <span>Check deadlines before saving</span>
            </a>
          </div>
          <div class="city-side-tip-list" aria-label="City application tips">
            ${cityTextListItems(guide.applicationTips || checklist || [], 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
          <div class="check-list detail-check-list">${checklist.map((item, index) => `<label><input type="checkbox" ${index < 1 ? "checked" : ""} data-check-item /><span class="check-index">${String(index + 1).padStart(2, "0")}</span><span class="check-copy">${escapeHtml(item)}</span></label>`).join("")}</div>
          <div class="hero-actions side-actions">
            <button class="secondary-action" type="button" data-save-detail>Save to favourites</button>
          </div>
        </article>
        ${renderCityNextSteps(guide.nextSteps || [])}
        <article class="timeline-card flow-card">
          <div class="side-panel-head">
            <div><span class="module-kicker">CUAC handoff</span><h2>What happens next</h2></div>
          </div>
          <ol class="timeline-list">${renderTimelineItems(data.timeline || [])}</ol>
        </article>
      </aside>
    </section>
  `;
  updateChecklistProgress();
}

function renderUniversityDetailPage(data) {
  const target = document.querySelector("[data-detail-root]");
  if (!target || !data) return;
  currentDetailData = data;
  const guide = data.schoolGuide || {};
  const heroAction = detailHeroAction(data);
  const checklist = Array.isArray(data.checklist) ? data.checklist : [];
  const status = Array.isArray(data.status) ? data.status : [];
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const programRows = Array.isArray(guide.programRows) ? guide.programRows : [];
  const hasConcreteProgramRows = programRows.some(hasConcreteUniversityProgramData);
  const location = detailFactValue(data, "Location", data.city || "China");
  const deadline = detailFactValue(data, "Next deadline", "Confirm");
  const tuition = detailFactValue(data, "Tuition", data.metrics?.[3]?.[0] || "Confirm");
  const sideQuickFacts = (guide.quickFacts || []).filter((fact) => !["Location", "Tuition", "Programs", "English-taught"].includes(fact?.label));
  const hasSchoolChecks = Boolean((guide.cscaRuleCards || []).length || (guide.scholarshipRows || []).length);
  const hasApplicationTiming = Boolean((guide.applicationTimeline || []).length || (guide.programRows || []).some((row) => row?.deadline));
  const hasOfficialChecks = Boolean((guide.officialActions?.links || []).length || guide.officialActions?.applicationFee);
  const hasApplicationChecks = hasSchoolChecks || hasApplicationTiming || hasOfficialChecks;
  const officialLinks = Array.isArray(guide.officialActions?.links) ? guide.officialActions.links : [];
  const admissionsAction = officialLinks.find((link) => /admission|apply|application/i.test(`${link.title || ""} ${link.body || ""}`)) || officialLinks[0] || null;
  const programsHref = heroAction.href || `programs.html?q=${encodeURIComponent(data.title || "")}`;
  const cityName = (data.city || location || "").split(",")[0].trim();
  const cityHref = cityName ? `city-detail.html?city=${encodeURIComponent(slugify(cityName))}` : "cities.html";
  const programCountLabel = programRows.length
    ? `${programRows.length} ${hasConcreteProgramRows ? "concrete routes" : "areas to verify"}`
    : "Filter by degree and language";
  const heroTitleClass = (data.title || "").length > 30 ? " title-long" : "";
  const useHeroImage = Boolean(data.image && !/unsplash\.com/i.test(data.image));
  const briefFacts = (() => {
    const labels = ["Location", "English-taught", "Next deadline", "Tuition"];
    const byLabel = new Map();
    [...facts.map(([label, value]) => ({ label, value })), ...(guide.quickFacts || [])].forEach((fact) => {
      if (!fact?.label || !fact?.value || byLabel.has(fact.label)) return;
      byLabel.set(fact.label, fact);
    });
    return labels.map((label) => byLabel.get(label)).filter(Boolean).slice(0, 4);
  })();
  const guideFactValue = (labels, fallback = "") => {
    const labelList = Array.isArray(labels) ? labels : [labels];
    const sources = [...facts.map(([label, value]) => ({ label, value })), ...(guide.quickFacts || [])];
    for (const label of labelList) {
      const match = sources.find((fact) => fact?.label === label);
      const displayValue = detailDisplayValue(match?.value);
      if (hasUsableDetailValue(displayValue)) return displayValue;
    }
    return fallback;
  };
  const schoolBasics = [
    { label: "Chinese name", value: detailProfileValue(data, "Chinese name") },
    { label: "School type", value: detailProfileValue(data, "School type") },
    { label: "Tier", value: detailProfileValue(data, ["Tier", "Rank cue"]) },
    { label: "Application levels", value: guideFactValue("Application levels", detailProfileValue(data, "Application levels")) },
    { label: "Teaching", value: detailProfileValue(data, ["Teaching language", "Language route"]) || guideFactValue("English-taught") },
    { label: "Tuition", value: guideFactValue("Tuition", detailProfileValue(data, "Tuition summary")) },
    { label: "Accommodation", value: guideFactValue("Accommodation", detailProfileValue(data, "Accommodation")) },
    { label: "Scholarship", value: status.find((item) => /scholarship|funding/i.test(String(item || ""))) || detailProfileValue(data, "Scholarship options") },
  ];
  const overviewHighlights = [
    {
      label: "Route status",
      title: hasConcreteProgramRows ? "Program routes available" : "Match a real route first",
      body: hasConcreteProgramRows ? "Use exact program records before adding a choice." : "Current records are subject areas until a matching program is opened.",
    },
    {
      label: "Language",
      title: detailShortRequirementValue(detailProfileValue(data, "English requirement") || detailProfileValue(data, "HSK requirement")) || "Confirm by route",
      body: "Check the exact teaching route.",
    },
    {
      label: "CSCA / funding",
      title: detailProfileValue(data, "CSCA requirement") || "Confirm by program",
      body: status.find((item) => /scholarship|funding/i.test(String(item || ""))) || "Check scholarship route before applying.",
    },
  ];
  const routeActionsHtml = `
    <div class="university-route-actions" aria-label="Route actions">
      <a class="primary-action" href="${escapeHtml(programsHref)}">Find programs</a>
      <a class="secondary-action" href="${escapeHtml(admissionsAction?.href || detailBackHref())}" ${admissionsAction?.href ? "target=\"_blank\" rel=\"noreferrer\"" : ""}>Admissions</a>
      <a class="secondary-action" href="${escapeHtml(cityHref)}">City context</a>
      <button class="secondary-action" type="button" data-save-detail>Save</button>
    </div>
  `;
  target.dataset.detailEntityType = data.entityType || "School";
  target.dataset.detailEntityId = data.entityId || data.schoolId || data.title || "";
  target.dataset.detailSourceModel = data.sourceFieldLineage?.sourceModel || "";
  target.dataset.detailSourceFieldCount = String((data.schemaSections || []).reduce((total, section) => total + (section.rows || []).length, 0));
  target.innerHTML = `
    <section class="university-detail-hero reveal">
      <div class="hero-copy">
        <a class="back-link" href="${detailBackHref()}">Back to universities</a>
        <span class="module-kicker">University information</span>
        <h1 class="${heroTitleClass.trim()}">${escapeHtml(data.title)}</h1>
        <p>${escapeHtml(data.summary)}</p>
        <div class="status-row">${status.map((item, index) => `<span class="status-pill ${index === 1 ? "warn" : ""}">${escapeHtml(item)}</span>`).join("")}</div>
        <div class="hero-actions">
          <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
          <a class="secondary-action" href="${escapeHtml(detailBackHref())}">All universities</a>
        </div>
        ${briefFacts.length ? `
          <div class="university-hero-brief" aria-label="School brief">
            ${briefFacts.map((fact) => `<article><span>${escapeHtml(fact.label)}</span><strong>${escapeHtml(fact.value)}</strong></article>`).join("")}
          </div>
        ` : ""}
      </div>
      <aside class="university-fit-card ${useHeroImage ? "has-image" : "image-missing"}">
        <div class="university-fit-media" aria-hidden="true">
          ${useHeroImage ? `<img src="${escapeHtml(data.image)}" alt="" onerror="this.closest('.university-fit-card')?.classList.add('image-missing'); this.remove();" />` : ""}
        </div>
        <div class="university-fit-body">
          <span class="module-kicker">School fit</span>
          <strong>${escapeHtml(location)}</strong>
          <p>${escapeHtml(status.slice(1, 3).join(" · ") || "Review school fit before choosing a program.")}</p>
          <dl class="university-fit-list">
            <div><dt>Routes</dt><dd>${escapeHtml(programCountLabel)}</dd></div>
            <div><dt>Deadline</dt><dd>${escapeHtml(deadline)}</dd></div>
            <div><dt>Tuition</dt><dd>${escapeHtml(tuition)}</dd></div>
          </dl>
        </div>
      </aside>
    </section>

    ${renderDetailSectionNav([
      ["#university-overview", "Overview"],
      ["#university-programs", "Programs"],
      hasApplicationChecks ? ["#university-checks", "Checks"] : null,
      ["#university-guide", "Reference"],
      ["#university-next", "Next"],
    ], "University detail sections")}

    <section class="content-grid university-detail-layout reveal">
      <div class="main-stack">
        ${renderUniversityOverview(data, schoolBasics, overviewHighlights)}
        <article class="detail-card university-preview-section university-stage-card" id="university-programs">
          <div class="section-head university-program-head"><div><span class="module-kicker">Programs</span><h2>${hasConcreteProgramRows ? "Choose a program" : "Find a route to verify"}</h2><p>${hasConcreteProgramRows ? "Exact routes are the point of action. Use school checks only when they affect the route." : "These are subject areas until you open a matching program route."}</p></div></div>
          ${routeActionsHtml}
          ${renderUniversityProgramGroups(guide.programGroups || [], guide.fieldTags || [], guide.hiddenProgramNote || "")}
          <div class="university-route-block">
            <div class="university-route-block-head">
              <h3>${hasConcreteProgramRows ? "Available routes" : "Areas to verify"}</h3>
              <p>${hasConcreteProgramRows ? "Each row is one candidate program." : "Verify the actual program before using fee, deadline, or entry details."}</p>
            </div>
            ${renderUniversityProgramFilters(programRows)}
            <div class="university-program-list ${hasConcreteProgramRows ? "" : "area-grid"}">
              ${renderUniversityProgramRows(programRows, guide.programCards || [])}
            </div>
          </div>
        </article>
        ${renderUniversityApplicationChecks(guide)}
        ${renderProfileSections(data, "university-guide", 1, { variant: "reference", facts: sideQuickFacts })}
        <article class="detail-card" id="university-next">
          <div class="section-head"><div><span class="module-kicker">Next</span><h2>Move from school fit to application</h2></div></div>
          <div class="route-list">${(data.routes || []).map(([title, body, href]) => `<article class="route-row"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div><a class="secondary-action" href="${escapeHtml(href)}">Open</a></article>`).join("")}</div>
        </article>
      </div>
    </section>
  `;
  updateChecklistProgress();
}

function renderProgramDetailPage(data) {
  const target = document.querySelector("[data-detail-root]");
  if (!target || !data) return;
  currentDetailData = data;
  const guide = data.programGuide || {};
  const heroAction = detailHeroAction(data);
  const checklist = Array.isArray(data.checklist) ? data.checklist : [];
  const status = Array.isArray(data.status) ? data.status : [];
  const universityHref = data.routes?.[0]?.[2] || "universities.html";
  const officialHref = (guide.officialCards || []).find((item) => item?.href)?.href || detailFactValue(data, "Application entry", "");
  const officialActionHref = /^https?:\/\//i.test(String(officialHref || "")) ? officialHref : "programs.html";
  const summaryUniversity = guide.fieldSummary?.find((field) => field.label === "University")?.value || data.schoolNameEn || "Confirm university";
  const summaryTuition = guide.fieldSummary?.find((field) => field.label === "Tuition")?.value || data.metrics?.[1]?.[0] || "Confirm tuition";
  const summaryDeadline = guide.fieldSummary?.find((field) => field.label === "Deadline")?.value || data.metrics?.[3]?.[0] || "Deadline pending";
  const summaryTeaching = guide.fieldSummary?.find((field) => field.label === "Teaching")?.value || "Confirm teaching";
  const summaryDegree = guide.fieldSummary?.find((field) => field.label === "Degree")?.value || "Confirm degree";
  const summarySchoolAlias = guide.schoolChineseName && guide.schoolChineseName !== summaryUniversity ? guide.schoolChineseName : "";
  const summaryProgramAlias = guide.programChineseName && guide.programChineseName !== data.title ? guide.programChineseName : "";
  target.dataset.detailEntityType = data.entityType || "Program";
  target.dataset.detailEntityId = data.entityId || data.programId || data.title || "";
  target.dataset.detailSourceModel = data.sourceFieldLineage?.sourceModel || "";
  target.dataset.detailSourceFieldCount = String((data.schemaSections || []).reduce((total, section) => total + (section.rows || []).length, 0));
  target.innerHTML = `
    <section class="program-detail-hero reveal">
      <div class="hero-copy">
        <a class="back-link" href="${detailBackHref()}">Back to programs</a>
        <span class="module-kicker">Program information</span>
        <h1>${escapeHtml(data.title)}</h1>
        ${summaryProgramAlias ? `<p class="program-name-alias">${escapeHtml(summaryProgramAlias)}</p>` : ""}
        ${guide.routeBadge ? `<span class="program-route-badge">${escapeHtml(guide.routeBadge)}</span>` : ""}
        <p>${escapeHtml(data.summary)}</p>
        <div class="status-row">${status.map((item, index) => `<span class="status-pill ${index === 1 ? "warn" : ""}">${escapeHtml(item)}</span>`).join("")}</div>
        <div class="hero-actions">
          <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
          <a class="secondary-action" href="${escapeHtml(universityHref)}">University profile</a>
        </div>
      </div>
      <aside class="program-summary-card">
        <span>Selected route</span>
        <strong>${escapeHtml(summaryUniversity)}</strong>
        ${summarySchoolAlias ? `<p class="program-school-alias">${escapeHtml(summarySchoolAlias)}</p>` : ""}
        <p>${escapeHtml(data.title)} · ${escapeHtml(summaryDegree)} · ${escapeHtml(summaryTeaching)}</p>
        <div class="program-summary-metrics" aria-label="Program decision summary">
          <div><span>Tuition</span><b>${escapeHtml(summaryTuition)}</b></div>
          <div><span>Deadline</span><b>${escapeHtml(summaryDeadline)}</b></div>
        </div>
      </aside>
    </section>

    <section class="program-glance-band reveal" aria-label="Program at a glance">
      ${(guide.fieldSummary || []).map((field) => `
        <article>
          <span>${escapeHtml(field.label)}</span>
          <strong>${escapeHtml(field.value)}</strong>
        </article>
      `).join("")}
    </section>

    ${renderDetailSectionNav([
      ["#program-basics", "Basics"],
      ["#program-requirements", "Requirements"],
      ["#program-timing", "Timing"],
      ["#program-handoff", "Next"],
    ], "Program detail sections")}

    <section class="content-grid program-detail-layout reveal">
      <div class="main-stack">
        <article class="detail-card program-section-card program-route-overview" id="program-basics">
          <div class="section-head"><div><span class="module-kicker">Course basics</span><h2>Confirm the exact route</h2></div></div>
          ${renderFundingCards(guide.routeCards || [], "program-card-grid")}
          ${renderFundingCards(guide.compareCards || guide.routeSignalCards || [], "program-card-grid compact")}
        </article>
        <article class="detail-card program-section-card program-requirements-card" id="program-requirements">
          <div class="section-head"><div><span class="module-kicker">Admissions requirements</span><h2>Check language and entrance requirements</h2></div></div>
          ${renderFundingCards(guide.requirementCards || [], "program-card-grid")}
        </article>
        <article class="detail-card program-section-card program-timing-card" id="program-timing">
          <div class="section-head"><div><span class="module-kicker">Tuition and timing</span><h2>Plan tuition, intake, and deadline</h2></div></div>
          ${renderFundingCards(guide.timingCards || [], "program-card-grid compact")}
        </article>
        <article class="detail-card program-section-card program-handoff-card" id="program-handoff">
          <div class="section-head"><div><span class="module-kicker">CUAC application handoff</span><h2>What happens after you add it</h2></div></div>
          <div class="program-handoff-grid">
            ${renderFundingCards(guide.readinessCards || [], "program-card-grid compact")}
            ${renderFundingCards(guide.nextCards || [], "program-step-grid")}
          </div>
          ${renderProgramOfficialCards(guide.officialCards || [])}
          <div class="route-list compact">${data.routes.map(([title, body, href]) => `<article class="route-row"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div><a class="secondary-action" href="${escapeHtml(href)}">Open</a></article>`).join("")}</div>
        </article>
      </div>
      <aside class="side-stack">
        <article class="detail-card action-panel program-decision-card">
          <div class="side-panel-head">
            <div><span class="module-kicker">Choice check</span><h2>Before you add this program</h2></div>
            <span class="side-progress" data-check-progress>1/${escapeHtml(checklist.length || 0)} ready</span>
          </div>
          <div class="side-progress-track" aria-hidden="true"><span data-check-meter></span></div>
          ${renderSideSnapshot([
            { label: "University", value: guide.fieldSummary?.find((field) => field.label === "University")?.value || data.schoolNameEn || "Confirm" },
            { label: "Tuition", value: guide.fieldSummary?.find((field) => field.label === "Tuition")?.value || data.metrics?.[1]?.[0] || "Confirm" },
            { label: "Deadline", value: guide.fieldSummary?.find((field) => field.label === "Deadline")?.value || data.metrics?.[3]?.[0] || "Confirm" },
          ])}
          <p class="side-panel-summary">Add choices only after the university, program, intake, language, tuition, and deadline are clear.</p>
          <div class="program-side-action-grid" aria-label="Program decision shortcuts">
            <a class="program-side-action primary" href="${escapeHtml(heroAction.href)}">
              <strong>Add exact choice</strong>
              <span>Use this school and program</span>
            </a>
            <a class="program-side-action" href="${escapeHtml(universityHref)}">
              <strong>University profile</strong>
              <span>${escapeHtml(guide.fieldSummary?.find((field) => field.label === "University")?.value || data.schoolNameEn || "Check school context")}</span>
            </a>
            <a class="program-side-action" href="${escapeHtml(officialActionHref)}">
              <strong>Official program check</strong>
              <span>${escapeHtml(guide.fieldSummary?.find((field) => field.label === "Deadline")?.value || "Confirm current notice")}</span>
            </a>
          </div>
          <div class="check-list detail-check-list">${checklist.map((item, index) => `<label><input type="checkbox" ${index < 1 ? "checked" : ""} data-check-item /><span class="check-index">${String(index + 1).padStart(2, "0")}</span><span class="check-copy">${escapeHtml(item)}</span></label>`).join("")}</div>
          <div class="hero-actions side-actions">
            <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
            <button class="secondary-action" type="button" data-save-detail>Save to favourites</button>
          </div>
        </article>
        <article class="timeline-card flow-card">
          <div class="side-panel-head">
            <div><span class="module-kicker">CUAC handoff</span><h2>What happens next</h2></div>
          </div>
          <ol class="timeline-list">${renderTimelineItems(data.timeline || [])}</ol>
        </article>
      </aside>
    </section>
  `;
  updateChecklistProgress();
}

function renderScholarshipDetailPage(data) {
  const target = document.querySelector("[data-detail-root]");
  if (!target || !data) return;
  currentDetailData = data;
  const guide = data.scholarshipGuide || {};
  const heroAction = detailHeroAction(data);
  const checklist = Array.isArray(data.checklist) ? data.checklist : [];
  const status = Array.isArray(data.status) ? data.status : [];
  target.dataset.detailEntityType = data.entityType || "PublicScholarship";
  target.dataset.detailEntityId = data.entityId || data.title || "";
  target.dataset.detailSourceModel = data.sourceFieldLineage?.sourceModel || "";
  target.dataset.detailSourceFieldCount = String((data.schemaSections || []).reduce((total, section) => total + (section.rows || []).length, 0));
  target.innerHTML = `
    <section class="funding-detail-hero scholarship-article-hero reveal">
      <div class="hero-copy">
        <div class="detail-hero-meta">
          <a class="back-link" href="${detailBackHref()}">Back to scholarships</a>
          <span class="module-kicker">Scholarship information</span>
        </div>
        <h1>${escapeHtml(data.title)}</h1>
        <p>${escapeHtml(data.summary)}</p>
        ${renderScholarshipScopeSummary(guide)}
        <div class="hero-actions">
          <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
          <a class="secondary-action" href="scholarships.html">All scholarships</a>
        </div>
      </div>
    </section>

    <section class="content-grid funding-detail-layout reveal">
      <div class="main-stack">
        ${renderScholarshipAboutPanel(data, guide)}
        <article class="detail-card funding-section-card scholarship-fit-card" id="scholarship-fit">
          <div class="section-head"><div><span class="module-kicker">Fit</span><h2>Money and eligibility</h2></div></div>
          <div class="scholarship-fit-grid">
            <section class="scholarship-fit-lane primary">
              <h3>What may be covered</h3>
              ${renderScholarshipInfoRows(guide.coverageCards || [], "Confirm coverage in the current notice.")}
            </section>
            <section class="scholarship-fit-lane">
              <h3>Who should check this</h3>
              ${renderScholarshipInfoRows(guide.eligibilityCards || [], "Check degree, program, nationality, and current route rules.")}
            </section>
          </div>
        </article>
        <article class="detail-card funding-section-card" id="scholarship-options">
          <div class="section-head"><div><span class="module-kicker">Match</span><h2>Schools and programs</h2></div></div>
          <div class="scholarship-related-grid">
            ${renderScholarshipConnectionGroup("Schools", guide.schoolCards || [], "Confirm which universities accept this funding route.", "View school")}
            ${renderScholarshipConnectionGroup("Programs", guide.programCards || [], "Match the funding route to a concrete program before applying.", "View program")}
          </div>
        </article>
        <article class="detail-card funding-section-card scholarship-document-card" id="scholarship-documents">
          <div class="section-head"><div><span class="module-kicker">Prepare</span><h2>Documents and steps</h2></div></div>
          ${renderScholarshipDocumentMatrix(guide.materialCards || [], guide.stepCards || [])}
        </article>
        <article class="detail-card funding-section-card scholarship-reference-card" id="scholarship-reference">
          <div class="section-head"><div><span class="module-kicker">Source</span><h2>Official checks</h2></div></div>
          ${renderScholarshipSourceRows(guide.officialCards || [])}
          ${renderScholarshipNoticeSections(scholarshipMeaningfulNoticeSections(guide.noticeSections || []))}
          ${renderScholarshipOfficialNotice(guide.officialNoticeSections || [])}
        </article>
        <article class="detail-card" id="scholarship-next">
          <div class="section-head"><div><span class="module-kicker">Next</span><h2>Connect funding to a real choice</h2></div></div>
          <div class="route-list">${data.routes.map(([title, body, href]) => `<article class="route-row"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div><a class="secondary-action" href="${escapeHtml(href)}">Open</a></article>`).join("")}</div>
        </article>
      </div>
      <aside class="side-stack">
        ${renderScholarshipActionPanel(heroAction, checklist)}
        ${renderScholarshipSideFacts(guide)}
        <article class="timeline-card flow-card scholarship-flow-card">
          <div class="side-panel-head">
            <div><span class="module-kicker">Next</span><h2>CUAC handoff</h2></div>
          </div>
          <ol class="timeline-list">${renderTimelineItems(data.timeline || [])}</ol>
        </article>
        ${renderScholarshipContactPanel(guide.contactRows || [], guide.actionCards || [])}
      </aside>
    </section>
  `;
  updateChecklistProgress();
}

function renderCompletionState(state) {
  if (state === "loading") renderCompletionLoading();
  else if (state === "empty") renderCompletionEmpty();
  else if (state === "error") renderCompletionError();
}

function renderDetailPage(data) {
  const target = document.querySelector("[data-detail-root]");
  if (!target || !data) return;
  if (mode === "program" && data.programGuide) {
    renderProgramDetailPage(data);
    return;
  }
  if (mode === "city" && data.cityGuide) {
    renderCityDetailPage(data);
    return;
  }
  if (mode === "scholarship" && data.scholarshipGuide) {
    renderScholarshipDetailPage(data);
    return;
  }
  if (mode === "university" && data.entityType === "School") {
    renderUniversityDetailPage(data);
    return;
  }
  currentDetailData = data;
  const heroAction = detailHeroAction(data);
  target.dataset.detailEntityType = data.entityType || mode || "detail";
  target.dataset.detailEntityId = data.entityId || data.programId || data.schoolId || data.title || "";
  target.dataset.detailSourceModel = data.sourceFieldLineage?.sourceModel || data.sourceFieldLineage?.fromProgramRecord?.sourceModel || "";
  target.dataset.detailSourceFieldCount = String((data.schemaSections || []).reduce((total, section) => total + (section.rows || []).length, 0));
  target.innerHTML = `
    <section class="detail-hero reveal">
      <div class="hero-copy">
        <a class="back-link" href="${detailBackHref()}">Back</a>
        <span class="module-kicker">${escapeHtml(mode)} detail</span>
        <h1>${escapeHtml(data.title)}</h1>
        <p>${escapeHtml(data.summary)}</p>
        <div class="status-row">${data.status.map((item, index) => `<span class="status-pill ${index === 1 ? "warn" : ""}">${escapeHtml(item)}</span>`).join("")}</div>
        <div class="hero-actions">
          <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
        </div>
      </div>
      <aside class="media-card">
        <img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title)} context" />
        <div class="media-body"><strong>${escapeHtml(data.title)}</strong><span>${escapeHtml(data.city)}</span></div>
      </aside>
    </section>
    ${renderDetailMetrics(data)}
    ${renderDecisionPanels(data)}
    <section class="content-grid reveal">
      <div class="main-stack">
        ${renderSnapshot(data)}
        ${renderProfileSections(data)}
        <article class="detail-card">
          <div class="section-head"><div><span class="module-kicker">Routes</span><h2>Connected next steps</h2></div></div>
          <div class="route-list">${data.routes.map(([title, body, href]) => `<article class="route-row"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div><a class="secondary-action" href="${escapeHtml(href)}">Open</a></article>`).join("")}</div>
        </article>
      </div>
      <aside class="side-stack">
        <article class="detail-card action-panel">
          <div class="side-panel-head">
            <div><span class="module-kicker">Next steps</span><h2>Route actions</h2></div>
            <span class="side-progress" data-check-progress>1/${escapeHtml(data.checklist.length || 0)} ready</span>
          </div>
          <div class="side-progress-track" aria-hidden="true"><span data-check-meter></span></div>
          ${renderSideSnapshot((data.metrics || []).slice(0, 3).map(([value, label]) => ({ label, value })))}
          <p class="side-panel-summary">Check the essentials, save the route, then continue from the next useful step.</p>
          <div class="check-list detail-check-list">${data.checklist.map((item, index) => `<label><input type="checkbox" ${index < 1 ? "checked" : ""} data-check-item /><span class="check-index">${String(index + 1).padStart(2, "0")}</span><span class="check-copy">${escapeHtml(item)}</span></label>`).join("")}</div>
          <div class="hero-actions side-actions">
            <a class="primary-action" href="${escapeHtml(heroAction.href)}">${escapeHtml(heroAction.label)}</a>
            <button class="secondary-action" type="button" data-save-detail>Save to favourites</button>
          </div>
        </article>
        <article class="timeline-card flow-card">
          <div class="side-panel-head">
            <div><span class="module-kicker">CUAC handoff</span><h2>What happens next</h2></div>
          </div>
          <ol class="timeline-list">${renderTimelineItems(data.timeline)}</ol>
        </article>
      </aside>
    </section>
  `;
  updateChecklistProgress();
}

function updateChecklistProgress() {
  document.querySelectorAll(".action-panel").forEach((panel) => {
    const checks = Array.from(panel.querySelectorAll("[data-check-item]"));
    const progress = panel.querySelector("[data-check-progress]");
    const meter = panel.querySelector("[data-check-meter]");
    if (!checks.length || !progress) return;
    const complete = checks.filter((check) => check.checked).length;
    const percent = Math.round((complete / checks.length) * 100);
    progress.textContent = `${complete}/${checks.length} ready`;
    progress.dataset.progressState = complete === checks.length ? "complete" : complete > 0 ? "active" : "empty";
    if (meter) {
      meter.style.width = `${percent}%`;
      meter.dataset.progressState = progress.dataset.progressState;
    }
  });
}

function currentDetailHref() {
  return `${location.pathname.split("/").pop()}${location.search || ""}${location.hash || ""}`;
}

function detailTypeForFavourite() {
  if (mode === "program") return "program";
  if (mode === "university") return "university";
  if (mode === "scholarship") return "scholarship";
  if (mode === "city") return "city";
  if (mode === "guide") return "guide";
  return "detail";
}

function buildSavedDetailItem() {
  const target = document.querySelector("[data-detail-root]");
  const data = currentDetailData || {};
  const factValue = (label) => (data.facts || []).find(([key]) => key === label)?.[1] || "";
  const factValueAny = (labels) => labels.map(factValue).find(Boolean) || "";
  const entityType = target?.dataset.detailEntityType || data.entityType || mode || "detail";
  const entityId = target?.dataset.detailEntityId || data.entityId || data.programId || data.schoolId || data.title || "";
  const sourceFieldLineage = data.sourceFieldLineage || null;
  const status = mode === "program" ? "ready" : mode === "scholarship" ? "warning" : "good";
  const tuitionMetric = (data.metrics || []).find(([, label]) => String(label).includes("tuition"))?.[0] || "";
  const teachingMetric = (data.metrics || []).find(([, label]) => String(label).includes("teaching"))?.[0] || "";
  const city = String(data.city || "").split(",")[0].trim();
  const facts = [
    ...(data.metrics || []).slice(0, 2).map(([value, label]) => `${value} ${label}`.trim()),
    ...(data.facts || []).slice(0, 2).map(([label, value]) => `${label}: ${value}`),
  ].filter(Boolean);
  return {
    id: `detail-${mode}-${String(entityId || data.title || "saved").replace(/\s+/g, "-").toLowerCase()}`,
    type: detailTypeForFavourite(),
    entityType,
    entityId,
    sourceModel: sourceFieldLineage?.sourceModel || target?.dataset.detailSourceModel || "",
    schoolId: data.schoolId || "",
    programId: data.programId || "",
    title: data.title || "Saved CUAC detail",
    meta: data.city || `${entityType} detail`,
    body: data.summary || "Saved from a CUAC detail page.",
    facts: facts.length ? facts.slice(0, 4) : ["Saved detail", "Source retained"],
    status,
    routeRole: mode === "program" ? "Saved detail route" : "",
    href: currentDetailHref(),
    primaryAction: "Open detail",
    primaryHref: currentDetailHref(),
    applicationChoice: entityType === "Program"
      ? {
          schoolId: data.schoolId || "",
          programId: data.programId || entityId,
          university: data.schoolNameEn || data.university || factValueAny(["School", "School.nameEn"]) || "School to confirm",
          program: data.title || "Selected program",
          programName: data.fieldCategory || factValueAny(["Subject", "SchoolProgram.fieldCategory"]) || data.title || "Selected program",
          degree: data.degreeLevel || factValueAny(["Degree", "SchoolProgram.degreeLevel"]) || "Route",
          city,
          intake: data.applicationRound || factValueAny(["Intake", "SchoolProgram.applicationRound"]) || "Fall 2026",
          language: data.teachingLanguage || teachingMetric || "Teaching language pending",
          tuition: tuitionMetric || "Tuition pending",
          deadline: data.status?.[1] || "Deadline pending",
          signal: data.status?.[2] || "Saved detail route",
          choiceNote: "Added from saved detail in Favourites.",
        }
      : null,
    sourceFieldLineage,
  };
}

function saveCurrentDetail() {
  const item = buildSavedDetailItem();
  if (dataClient?.addSavedDetailItem) dataClient.addSavedDetailItem(item);
  else {
    try {
      const key = dataClient?.storageKeys?.savedDetailItems || "cuacSavedDetailItemsDemoState";
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const items = Array.isArray(state.items) ? state.items.filter((saved) => saved.id !== item.id) : [];
      localStorage.setItem(key, JSON.stringify({ items: [item, ...items].slice(0, 30), updatedAt: new Date().toISOString() }));
    } catch {
      // Demo storage can be unavailable in restricted preview contexts.
    }
  }
  dataClient?.addNotificationEvent?.({
    id: `saved-detail-${item.id}`,
    type: item.type === "scholarship" ? "funding" : item.type === "city" ? "city" : item.type === "program" ? "deadline" : "update",
    severity: "done",
    group: "Today",
    title: `${item.title} saved to Favourites`,
    body: "CUAC kept the detail link so Agent can reopen the same choice later.",
    entity: item.title,
    entityType: item.entityType,
    entityId: item.entityId,
    sourceFieldLineage: item.sourceFieldLineage,
    time: "Just now",
    action: "Open favourites",
    href: "favourites.html",
    prompt: `Summarize my saved ${item.title} detail and explain the next CUAC action`,
  });
  return item;
}

function copyCurrentScholarshipLink(button) {
  const href = `${location.pathname.split("/").pop() || "scholarship-detail.html"}${location.search || ""}${location.hash || ""}`;
  navigator.clipboard?.writeText(location.href || href).catch(() => {});
  if (button) button.textContent = "Link copied";
  showCompletionToast("Scholarship link copied for later review.");
}

function updateUniversityProgramFilters() {
  const rows = Array.from(document.querySelectorAll("[data-university-program-row]"));
  if (!rows.length) return;
  const filters = {};
  document.querySelectorAll("[data-university-program-filter]").forEach((field) => {
    filters[field.dataset.universityProgramFilter] = String(field.value || "").trim();
  });
  let shown = 0;
  rows.forEach((row) => {
    const subjects = String(row.dataset.subjects || "").split("|").map((item) => item.trim()).filter(Boolean);
    const matchesDegree = !filters.degree || row.dataset.degree === filters.degree;
    const matchesTeaching = !filters.teaching || row.dataset.teaching === filters.teaching;
    const matchesSubject = !filters.subject || subjects.includes(filters.subject);
    const visible = matchesDegree && matchesTeaching && matchesSubject;
    row.hidden = !visible;
    if (visible) shown += 1;
  });
  const count = document.querySelector("[data-university-program-count]");
  const empty = document.querySelector("[data-university-program-empty]");
  if (count) count.textContent = `${shown} shown`;
  if (empty) empty.hidden = shown > 0;
}

function updateCityProgramFilters() {
  const rows = Array.from(document.querySelectorAll("[data-city-program-row]"));
  if (!rows.length) return;
  const filters = {};
  document.querySelectorAll("[data-city-program-filter]").forEach((field) => {
    filters[field.dataset.cityProgramFilter] = String(field.value || "").trim();
  });
  let shown = 0;
  rows.forEach((row) => {
    const matchesDegree = !filters.degree || row.dataset.degree === filters.degree;
    const matchesLanguage = !filters.language || row.dataset.language === filters.language;
    const matchesFunding = !filters.funding || row.dataset.funding === filters.funding;
    const visible = matchesDegree && matchesLanguage && matchesFunding;
    row.hidden = !visible;
    if (visible) shown += 1;
  });
  const count = document.querySelector("[data-city-program-count]");
  const empty = document.querySelector("[data-city-program-empty]");
  if (count) count.textContent = `${shown} shown`;
  if (empty) empty.hidden = shown > 0;
}

function renderBillingPage() {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  const billing = window.CuacDataClient?.getBillingSnapshot?.() || {
    invoiceId: "CUAC-2026-014",
    status: "Paid",
    paidSchools: 2,
    totalLabel: "USD 40",
    extraSchoolFee: 20,
    orderId: 260814,
    orderStatus: "PAID",
    paymentId: 880014,
    paymentProvider: "mock",
    providerTxnId: "mock-cuac-260814",
    paymentProviderStatus: "SUCCEEDED",
    callbackSignaturePayload: "orderId=260814&amountCents=4000&currency=USD",
    lines: [
      { school: "Zhejiang University", programs: "Computer Science MSc", fee: "Included" },
      { school: "Nanjing University", programs: "Software Engineering MSc", fee: "USD 20" },
      { school: "UIBE", programs: "International Trade MSc", fee: "USD 20" },
    ],
  };
  const paymentStatus = billing.paymentStatus || "";
  const lines = Array.isArray(billing.lines) ? billing.lines : [];
  const paidLike = ["paid-demo", "free-submitted"].includes(paymentStatus) || billing.orderStatus === "PAID";
  const failedLike = paymentStatus === "failed-preview" || billing.orderStatus === "FAILED";
  const pendingLike = paymentStatus === "processing-demo" || (!paidLike && !failedLike && billing.orderStatus === "PENDING" && paymentStatus !== "preview");
  const previewLike = !paidLike && !failedLike && !pendingLike;
  const freeLike = paymentStatus === "free-submitted";
  const billingTone = failedLike ? "danger" : previewLike || pendingLike ? "warn" : "paid";
  const pageTitle = failedLike
    ? "Payment issue"
    : pendingLike
      ? "Payment pending"
      : previewLike
        ? "Payment not started"
        : freeLike
          ? "Free submission sent"
          : "Payment receipt";
  const pageCopy = failedLike
    ? "Your choices are saved. Nothing has been sent to schools until payment is resolved."
    : pendingLike
      ? "We are waiting for payment confirmation before sending school records."
      : previewLike
        ? "Review the CUAC sending fee before payment. University application fees are separate."
        : "CUAC has recorded this payment for the selected school-program routes.";
  const issuedLabel = (() => {
    const value = billing.paymentUpdatedAt || billing.submittedAt || "";
    if (!value) return paidLike ? "Recorded" : "Not issued";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  })();
  const schoolCount = lines.length || Number(billing.schoolCount || 0);
  const extraSchools = Number(billing.paidSchools || Math.max(0, schoolCount - 1));
  const extraFee = Number(billing.extraSchoolFee || 20);
  const coverageLabel = `${schoolCount || 0} school${schoolCount === 1 ? "" : "s"} · ${extraSchools} extra`;
  const primaryAction = failedLike || pendingLike || previewLike
    ? `<a class="primary-action" href="application.html#payment">${failedLike ? "Retry payment" : "Continue payment"}</a>`
    : `<button class="primary-action" type="button" data-save-detail>Download receipt</button>`;
  const schoolReceiptAction = paidLike
    ? `<a class="secondary-action" href="school-portal.html">View school receipt</a>`
    : "";
  const referenceRows = [
    ["Invoice", billing.invoiceId || "Pending"],
    ["Order", billing.orderId || "Pending"],
    ["Payment", billing.paymentId || "Pending"],
    ["Provider", billing.paymentProvider || "mock"],
    ["Provider status", billing.paymentProviderStatus || billing.orderStatus || "PENDING"],
    ["Transaction", billing.providerTxnId || "Not created"],
  ];
  target.innerHTML = `
    <section class="billing-page reveal">
      <a class="back-link" href="application.html">Back to application</a>
      <section class="billing-hero ${billingTone}">
        <div class="billing-hero-copy">
          <span class="module-kicker">Billing</span>
          <h1>${escapeHtml(pageTitle)}</h1>
          <p>${escapeHtml(pageCopy)}</p>
          <div class="status-row"><span class="status-pill ${billingTone === "danger" ? "danger" : billingTone === "warn" ? "warn" : ""}">${escapeHtml(billing.status || pageTitle)}</span><span class="status-pill warn">Not university fee</span></div>
        </div>
        <div class="billing-total-card">
          <span>Total due</span>
          <strong>${escapeHtml(billing.totalLabel || "USD 0")}</strong>
          <em>${escapeHtml(coverageLabel)}</em>
        </div>
      </section>

      <section class="billing-facts" aria-label="Billing summary">
        <article><span>Invoice</span><strong>${escapeHtml(billing.invoiceId || "Pending")}</strong></article>
        <article><span>Status</span><strong>${escapeHtml(billing.status || pageTitle)}</strong></article>
        <article><span>Date</span><strong>${escapeHtml(issuedLabel)}</strong></article>
        <article><span>Extra school fee</span><strong>USD ${escapeHtml(extraFee)}</strong></article>
      </section>

      <section class="billing-layout">
        <div class="main-stack">
          <article class="detail-card billing-card">
            <div class="section-head"><div><span class="module-kicker">Fee breakdown</span><h2>Selected schools</h2></div><span class="status-pill">${escapeHtml(String(schoolCount || 0))} schools</span></div>
            <table class="data-table billing-table"><thead><tr><th>School</th><th>Program</th><th>CUAC fee</th></tr></thead><tbody>
              ${lines.map((line) => `<tr><td>${escapeHtml(line.school)}</td><td>${escapeHtml(line.programs)}</td><td>${escapeHtml(line.fee)}</td></tr>`).join("")}
            </tbody></table>
          </article>

          <article class="detail-card billing-card">
            <span class="module-kicker">Covers</span>
            <h2>What CUAC fee covers</h2>
            <div class="billing-coverage-grid">
              <article><strong>Included</strong><span>School-scoped application record sending</span></article>
              <article><strong>Not included</strong><span>University application fee or official document fees</span></article>
              <article><strong>Files</strong><span>Schools request official files directly from the student</span></article>
            </div>
          </article>

          <details class="detail-card billing-reference">
            <summary><span><b>Payment reference</b><em>For support or finance checks</em></span></summary>
            <div class="billing-reference-grid">
              ${referenceRows.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
            </div>
          </details>
        </div>

        <aside class="billing-side">
          <article class="detail-card billing-actions-card">
            <span class="module-kicker">Next</span>
            <h2>${paidLike ? "Receipt ready" : "Payment required"}</h2>
            <p>${paidLike ? "Keep the receipt and continue tracking school responses." : "Return to the payment step before school records can be sent."}</p>
            <div class="billing-actions">${primaryAction}${schoolReceiptAction}<a class="secondary-action" href="application.html">Back to application</a></div>
          </article>
        </aside>
      </section>
    </section>
  `;
}

const defaultSchoolRequestTemplate = "你好 {{student_name}}，\n\n浙江大学已收到你通过 CUAC 提交的 {{program_name}} 意向记录。请直接回复本邮件，并按学校要求提交：成绩单、护照扫描件、语言证明、学习计划，以及项目要求的其他表格。\n\nCUAC 未收取你的申请材料。正式文件请直接按照学校确认的流程提交。";

function readSchoolSettingsState() {
  try {
    return JSON.parse(localStorage.getItem("cuacSchoolSettingsDemoState") || "{}");
  } catch {
    return {};
  }
}

function writeSchoolSettingsState(state) {
  try {
    localStorage.setItem("cuacSchoolSettingsDemoState", JSON.stringify(state));
  } catch {
    // Demo storage can be unavailable in restricted preview contexts.
  }
}

function showCompletionToast(message) {
  const toast = document.querySelector("[data-completion-toast]");
  if (!toast) return;
  toast.hidden = false;
  toast.textContent = message;
  clearTimeout(window.completionToastTimer);
  window.completionToastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

function renderSchoolSettingsPage() {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  const savedSettings = readSchoolSettingsState();
  const templateCopy = savedSettings.template || defaultSchoolRequestTemplate;
  target.innerHTML = `
    <section class="detail-hero reveal">
      <div class="hero-copy">
        <a class="back-link" href="school-portal.html">返回学校工作台</a>
        <span class="module-kicker">学校设置</span>
        <h1>浙江大学租户设置</h1>
        <p>管理本校工作台的老师权限、项目负责人分配、材料请求模板和响应目标。该账号体系与学生账号分开授权。</p>
        <div class="status-row"><span class="status-pill">租户已锁定</span><span class="status-pill">仅学校老师</span><span class="status-pill warn">无跨校数据</span><span class="status-pill" data-school-settings-state>${savedSettings.savedAt ? "本地设置已保存" : "设置就绪"}</span></div>
      </div>
      <aside class="media-card"><img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80" alt="学校设置工作台" /><div class="media-body"><strong>浙江大学招生办</strong><span data-school-settings-summary>3 个有效老师席位 · 租户范围</span></div></aside>
    </section>
    <section class="metric-strip reveal">
      <article class="metric-card"><strong>3</strong><span>有效老师席位</span></article>
      <article class="metric-card"><strong>2h</strong><span>首次联系目标</span></article>
      <article class="metric-card"><strong>4</strong><span>项目负责人规则</span></article>
      <article class="metric-card"><strong>0</strong><span>CUAC 持有文件</span></article>
    </section>
    <section class="content-grid reveal">
      <div class="main-stack">
        <article class="detail-card">
          <div class="section-head"><div><span class="module-kicker">老师</span><h2>学校用户与权限</h2></div><button class="secondary-action" data-school-settings-save type="button">保存老师设置</button></div>
          <div class="settings-table" data-school-staff-settings>
            ${[
              ["国际办公室负责人", "负责人", "可管理设置", "启用"],
              ["浙江大学招生办", "招生老师", "可处理队列并联系学生", "启用"],
              ["计算机科学协调员", "项目负责人", "可审核分配到的项目记录", "启用"],
            ].map(([name, role, scope, status]) => `
              <article class="settings-row">
                <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(scope)}</span></div>
                <select aria-label="${escapeHtml(name)} 的角色"><option selected>${escapeHtml(role)}</option><option>招生老师</option><option>项目负责人</option><option>只读</option></select>
                <span class="status-pill">${escapeHtml(status)}</span>
              </article>
            `).join("")}
          </div>
        </article>
        <article class="detail-card">
          <div class="section-head"><div><span class="module-kicker">负责人分配</span><h2>项目到负责人的规则</h2></div><span class="status-pill warn">仅本租户</span></div>
          <div class="routing-list" data-owner-routing>
            ${[
              ["计算机科学硕士", "计算机科学协调员", "首次联系 + 学术匹配"],
              ["生物医学工程硕士", "学院协调员", "联系前审核实验室匹配"],
              ["国际商务", "招生办公室", "标准招生队列"],
              ["其他浙江大学记录", "国际办公室负责人", "兜底负责人"],
            ].map(([program, owner, rule]) => `
              <article class="routing-row">
                <div><strong>${escapeHtml(program)}</strong><span>${escapeHtml(rule)}</span></div>
                <select aria-label="${escapeHtml(program)} 的负责人"><option selected>${escapeHtml(owner)}</option><option>国际办公室负责人</option><option>浙江大学招生办</option><option>计算机科学协调员</option><option>学院协调员</option></select>
              </article>
            `).join("")}
          </div>
        </article>
        <article class="detail-card">
          <div class="section-head"><div><span class="module-kicker">模板</span><h2>可编辑材料请求文案</h2></div><button class="secondary-action" data-school-template-copy type="button">复制模板</button></div>
          <p>学校直接联系学生。模板应明确由学校索取文件，不暗示 CUAC 已收取材料。</p>
          <textarea class="template-editor" data-school-template rows="8" aria-label="学校材料请求模板">${escapeHtml(templateCopy)}</textarea>
          <div class="template-tools">
            <span>变量：{{student_name}}, {{program_name}}, {{intake}}</span>
            <button class="text-action" data-school-template-reset type="button">重置文案</button>
          </div>
        </article>
      </div>
      <aside class="side-stack">
        <article class="detail-card action-panel">
          <span class="module-kicker">租户规则</span><h2>可见数据</h2>
          <div class="check-list"><label><input checked type="checkbox" /><span>仅浙江大学申请记录</span></label><label><input checked type="checkbox" /><span>不显示学生的其他学校选择</span></label><label><input checked type="checkbox" /><span>导出需要审计</span></label><label><input checked type="checkbox" /><span>不读取学生私有 Agent 记忆</span></label></div>
          <div class="hero-actions"><a class="primary-action" href="school-portal.html">打开申请队列</a><button class="secondary-action" data-school-settings-save type="button">保存设置</button></div>
        </article>
        <article class="detail-card">
          <span class="module-kicker">响应目标</span><h2>老师跟进 SLA</h2>
          <div class="response-grid">
            <article><strong>2h</strong><span>新 CUAC 记录首次查看</span></article>
            <article><strong>24h</strong><span>首次联系学生目标</span></article>
            <article><strong>3d</strong><span>材料提醒节奏</span></article>
          </div>
          <p>这些目标用于后续汇总学校响应表现，同时不暴露学生的其他学校选择。</p>
        </article>
      </aside>
    </section>
  `;
}

function readOpsAdminState() {
  try {
    const parsed = JSON.parse(localStorage.getItem("cuacOpsAdminDemoState") || "{}");
    return mergeOpsRouteState(sanitizeOpsAdminState(parsed));
  } catch {
    return mergeOpsRouteState({});
  }
}

function writeOpsAdminState(state) {
  try {
    const cleanState = sanitizeOpsAdminState(state);
    localStorage.setItem("cuacOpsAdminDemoState", JSON.stringify(cleanState));
    syncOpsHashRoute(cleanState);
  } catch {
    try {
      localStorage.removeItem("cuacOpsAdminDemoState");
      const fallbackState = sanitizeOpsAdminState({ opsSection: "content", contentType: "scholarships" });
      localStorage.setItem("cuacOpsAdminDemoState", JSON.stringify(fallbackState));
      syncOpsHashRoute(fallbackState);
    } catch {
      // Demo storage can be unavailable in restricted preview contexts.
    }
  }
}

function sanitizeOpsContentRecords(value) {
  return toOpsContentList(value).map((item) => ({ ...item }));
}

function sanitizeOpsAdminState(value) {
  if (!isPlainRecord(value)) return {};
  const next = { ...value };
  if (next.opsSection && !["overview", "school", "content", "students", "access", "queue"].includes(String(next.opsSection))) {
    next.opsSection = "overview";
  }
  if (next.studentDetailTab && !["overview", "handoff", "account", "timeline", "edit"].includes(String(next.studentDetailTab))) {
    next.studentDetailTab = "overview";
  }
  if (next.schoolView) next.schoolView = normalizeOpsSchoolView(next.schoolView);
  if (next.accessView) next.accessView = normalizeOpsAccessView(next.accessView);
  if (next.queueView) next.queueView = normalizeOpsQueueView(next.queueView);
  if (next.contentType) next.contentType = normalizeOpsContentType(next.contentType);
  if (next.contentView) next.contentView = normalizeOpsContentView(next.contentView);
  if (Object.prototype.hasOwnProperty.call(next, "publicScholarshipRecords")) {
    next.publicScholarshipRecords = sanitizeOpsContentRecords(next.publicScholarshipRecords);
    if (next.selectedPublicScholarshipId && !next.publicScholarshipRecords.some((item) => String(item.id) === String(next.selectedPublicScholarshipId))) {
      next.selectedPublicScholarshipId = next.publicScholarshipRecords[0]?.id || "";
    }
  }
  if (Object.prototype.hasOwnProperty.call(next, "cityGuideRecords")) {
    next.cityGuideRecords = sanitizeOpsContentRecords(next.cityGuideRecords);
    if (next.selectedCityGuideId && !next.cityGuideRecords.some((item) => String(item.id) === String(next.selectedCityGuideId))) {
      next.selectedCityGuideId = next.cityGuideRecords[0]?.id || "";
    }
  }
  if (Object.prototype.hasOwnProperty.call(next, "timelineWindowRecords")) {
    next.timelineWindowRecords = sanitizeOpsContentRecords(next.timelineWindowRecords);
    if (next.selectedTimelineWindowId && !next.timelineWindowRecords.some((item) => String(item.id) === String(next.selectedTimelineWindowId))) {
      next.selectedTimelineWindowId = next.timelineWindowRecords[0]?.id || "";
    }
  }
  return next;
}

function isPlainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function toRecordArray(value) {
  if (Array.isArray(value)) return value.filter(isPlainRecord);
  if (!isPlainRecord(value)) return [];
  if (Array.isArray(value.items)) return value.items.filter(isPlainRecord);
  if (Array.isArray(value.records)) return value.records.filter(isPlainRecord);
  if (Array.isArray(value.list)) return value.list.filter(isPlainRecord);
  return Object.values(value).filter(isPlainRecord);
}

function toOpsContentList(value) {
  if (Array.isArray(value)) return value.filter(isPlainRecord);
  if (!isPlainRecord(value)) return [];
  if (Array.isArray(value.items)) return value.items.filter(isPlainRecord);
  if (Array.isArray(value.records)) return value.records.filter(isPlainRecord);
  if (Array.isArray(value.list)) return value.list.filter(isPlainRecord);
  return Object.values(value).filter(isPlainRecord);
}

function readOpsDiscoveryRows(methodName) {
  try {
    const rows = dataClient?.[methodName]?.();
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error(`CUAC ops ${methodName} fallback failed`, error);
    return [];
  }
}

function formatOpsSchoolProgramDisplayGroups(value) {
  if (!Array.isArray(value)) return textValue(value);
  return value.map((group) => {
    if (!isPlainRecord(group)) return String(group ?? "");
    const parts = [group.label || group.key || "项目分组", group.total ?? 0, group.visibleCount ?? "", group.hiddenNote || ""];
    while (parts.length > 2 && !String(parts[parts.length - 1] ?? "").trim()) parts.pop();
    return parts.join(" | ");
  }).filter(Boolean).join("\n");
}

function formatOpsSchoolTimeline(value) {
  if (!Array.isArray(value)) return textValue(value);
  return value.map((item) => {
    if (!isPlainRecord(item)) return String(item ?? "");
    return `${item.label || item.key || "申请步骤"}: ${[item.dateLabel, item.statusLabel, item.description].filter(Boolean).join(" · ")}`;
  }).filter(Boolean).join("\n");
}

function formatOpsSchoolUpcomingDeadlines(value) {
  if (!Array.isArray(value)) return textValue(value);
  return value.map((item) => {
    if (!isPlainRecord(item)) return String(item ?? "");
    return [
      item.programId || "",
      item.programName || "",
      item.degreeLevel || "",
      item.teachingLanguage || "",
      item.applicationRound || "",
      item.deadlineDate || "",
      item.deadlineLabel || "",
      item.daysUntilDeadline ?? "",
      item.statusLabel || "",
    ].join(" | ");
  }).filter(Boolean).join("\n");
}

function normalizeOpsSchoolRecord(school, index = 0) {
  const record = isPlainRecord(school) ? school : {};
  const id = record.id || record.sourceId || `school-${index + 1}`;
  const quickFacts = isPlainRecord(record.quickFacts) ? record.quickFacts : {};
  const detailDisplay = isPlainRecord(record.detailDisplay) ? record.detailDisplay : {};
  return {
    ...record,
    id,
    version: record.version || 1,
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
    nameZh: record.nameZh || record.nameEn || "学校草稿",
    nameEn: record.nameEn || "",
    status: record.status || "需审核",
    officialWebsite: record.officialWebsite ?? record.officialWebsiteUrl ?? "",
    applicationSystemUrl: record.applicationSystemUrl ?? record.admissionsWebsiteUrl ?? "",
    deadlineSummary: record.deadlineSummary || [record.round1Deadline, record.round2Deadline].filter(Boolean).join(" / "),
    qualityScore: record.qualityScore ?? record.dataQualityScore ?? 0,
    dataQualityScore: record.dataQualityScore ?? record.qualityScore ?? 0,
    quickFactsLocation: record.quickFactsLocation ?? quickFacts.location ?? "",
    quickFactsRegion: record.quickFactsRegion ?? quickFacts.region ?? record.regionLabel ?? record.region ?? "",
    quickFactsTuition: record.quickFactsTuition ?? quickFacts.tuition ?? record.tuitionBandLabel ?? record.tuitionSummary ?? "",
    quickFactsLivingCost: record.quickFactsLivingCost ?? quickFacts.livingCost ?? detailDisplay.livingCostLabel ?? "",
    quickFactsAccommodation: record.quickFactsAccommodation ?? quickFacts.accommodation ?? "",
    quickFactsProgramCount: record.quickFactsProgramCount ?? quickFacts.programCount ?? record.programCount ?? "",
    quickFactsEnglishProgramCount: record.quickFactsEnglishProgramCount ?? quickFacts.englishProgramCount ?? record.englishProgramCount ?? "",
    detailCity: record.detailCity ?? detailDisplay.city ?? record.cityZh ?? record.city ?? "",
    detailRegionLabel: record.detailRegionLabel ?? detailDisplay.regionLabel ?? record.regionLabel ?? record.region ?? "",
    detailLivingCostLabel: record.detailLivingCostLabel ?? detailDisplay.livingCostLabel ?? quickFacts.livingCost ?? "",
    detailDisplayProgramCount: record.detailDisplayProgramCount ?? detailDisplay.displayProgramCount ?? record.programCount ?? "",
    detailDisplayUndergraduateCount: record.detailDisplayUndergraduateCount ?? detailDisplay.displayUndergraduateCount ?? record.undergraduateProgramCount ?? "",
    detailVisibleProgramCount: record.detailVisibleProgramCount ?? detailDisplay.visibleProgramCount ?? record.programCount ?? "",
    detailHiddenProgramNote: record.detailHiddenProgramNote ?? detailDisplay.hiddenProgramNote ?? "",
    detailDisplaySubjectTags: record.detailDisplaySubjectTags ?? textValue(detailDisplay.displaySubjectTags || record.subjectTags || ""),
    detailProgramFieldTags: record.detailProgramFieldTags ?? textValue(detailDisplay.programFieldTags || record.programFieldTags || ""),
    detailProgramDisplayGroups: record.detailProgramDisplayGroups ?? formatOpsSchoolProgramDisplayGroups(detailDisplay.programDisplayGroups || ""),
    detailApplicationTimeline: record.detailApplicationTimeline ?? formatOpsSchoolTimeline(detailDisplay.applicationTimeline || ""),
    upcomingDeadlinesText: record.upcomingDeadlinesText ?? formatOpsSchoolUpcomingDeadlines(record.upcomingDeadlines || ""),
    programs: toRecordArray(record.programs).map((item) => ({ ...item, schoolId: item.schoolId ?? id })),
    cscaRules: toRecordArray(record.cscaRules).map((item) => ({ ...item, schoolId: item.schoolId ?? id })),
    scholarshipsDetailed: toRecordArray(record.scholarshipsDetailed).map((item) => ({ ...item, schoolId: item.schoolId ?? id })),
  };
}

function defaultOpsSchoolRecords() {
  return [
    {
      id: "zju",
      nameZh: "浙江大学",
      nameEn: "Zhejiang University",
      citySlug: "hangzhou",
      cityZh: "杭州",
      region: "浙江",
      schoolType: "regular",
      guaranteedAdmission: false,
      tierEn: "C9 / Double First-Class",
      logoUrl: "",
      status: "已发布",
      verificationStatus: "已核验",
      rank: 3,
      applicationLevel: "本科、硕士、博士、部分预科路线",
      admissionLevel: "本科、硕士、博士、部分预科路线",
      tuitionSummary: "硕士英文授课项目常见区间 RMB 36k-45k / 年，具体以项目记录为准。",
      tuitionByCategory: "本科：按学院确认；硕士英文授课：RMB 36k-45k / 年；博士：按项目确认。",
      applicationFee: "RMB 800",
      insurance: "以学校当年通知为准",
      accommodationCost: "校内住宿需以国际学院通知为准",
      accommodationType: "校内宿舍 / 校外租房",
      officialWebsite: "https://www.zju.edu.cn",
      applicationSystemUrl: "https://isinfosys.zju.edu.cn",
      hskRequirement: "中文授课一般需要 HSK 5-6；英文授课按项目要求提交英语能力证明。",
      hskNotes: "分授课语言和学院要求确认。",
      hskMinLevel: 5,
      englishRequired: true,
      englishMinIelts: 6,
      englishMinToefl: 80,
      englishRequirementNote: "英文授课通常需要 IELTS / TOEFL 或学校认可证明。",
      cscaRequirement: "部分竞争项目需要关注 CSCA 或学校专项评估要求。",
      cscaRequired: true,
      cscaRequirementNote: "按项目方向确认 CSCA 科目。",
      undergradRequirements: "高中毕业或同等学历，具体以官方招生简章为准。",
      postgradRequirements: "本科或硕士学历背景，需按学院确认专业匹配。",
      preparatoryRequirements: "预科路线以学校当年项目通知为准。",
      languageOfInstruction: "中文授课、英文授课",
      round1Deadline: "Oct 15",
      round2Deadline: "Dec 20",
      round1OpenDate: "Sep 1",
      round1CloseDate: "Oct 15",
      round2OpenDate: "Nov 1",
      round2CloseDate: "Dec 20",
      applicationSteps: "学生先在 CUAC 选择具体学校和项目；支付后学校老师只收到本校记录并联系学生准备材料。",
      scholarships: "校级奖学金、CSC 相关机会需按学校通知确认。",
      englishPrograms: "Computer Science MSc, Biomedical Engineering MSc",
      notablePrograms: "Computer Science, Biomedical Engineering, International Business",
      campusFacilities: "国际学生服务、宿舍、图书馆、实验平台",
      programFields: "Computer Science, Engineering, Business",
      contactTel: "+86 571 8795 1006",
      contactEmail: "iso@zju.edu.cn",
      contactAddress: "Hangzhou, Zhejiang",
      yearEstablished: 1897,
      studentCount: "以学校官方统计为准",
      studentsServed: 1,
      under18GuardianRequired: false,
      under18RequirementNote: "未满 18 岁需按中国学校与监护政策确认。",
      source: "CSCAlite",
      sourceId: "zhejiang-university",
      sourceUrl: "https://www.zju.edu.cn",
      lastVerifiedAt: "2026-08-14",
      dataQualityScore: 94,
      owner: "目录团队",
      next: "审核英文授课硕士截止日期",
      programs: [
        { id: "zju-cs-msc", nameZh: "计算机科学硕士", nameEn: "Computer Science MSc", degreeLevel: "Master", durationYears: "2-3 years", fieldCategory: "Computer Science", teachingLanguage: "English-taught", cscaSubjects: ["数学", "物理"], cscaRequirement: "CSCA：数学 + 物理，按学院确认。", hskRequirement: "英文授课通常不要求 HSK，中文交流能力有帮助。", englishRequirement: "IELTS 6.0 / TOEFL 80 或学校认可证明。", tuitionAmount: "42000", tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 42,000/年", scholarshipText: "CSC possible; school scholarship needs separate check.", openDate: "Sep 1", deadlineDate: "2026-10-15", deadlineLabel: "Oct 15", applicationRound: "Fall 2026", applicationUrl: "https://isinfosys.zju.edu.cn", applicationNote: "学校联系学生后收取材料。", sourceUrl: "https://isinfosys.zju.edu.cn", sourceLabel: "ZJU admissions", lastVerifiedAt: "2026-08-14", sortOrder: 1, version: 1, status: "已发布" },
        { id: "zju-biomed-msc", nameZh: "生物医学工程硕士", nameEn: "Biomedical Engineering MSc", degreeLevel: "Master", durationYears: "2-3 years", fieldCategory: "Engineering", teachingLanguage: "English-taught", cscaSubjects: ["数学", "物理"], cscaRequirement: "CSCA：数学 + 物理，按项目确认。", hskRequirement: "英文授课通常不要求 HSK。", englishRequirement: "IELTS / TOEFL 或学校认可证明。", tuitionAmount: "39000", tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 39,000/年", scholarshipText: "School scholarship possible.", openDate: "Nov 1", deadlineDate: "2026-12-20", deadlineLabel: "Dec 20", applicationRound: "Fall 2026", applicationUrl: "https://isinfosys.zju.edu.cn", applicationNote: "按项目要求确认材料。", sourceUrl: "https://isinfosys.zju.edu.cn", sourceLabel: "ZJU admissions", lastVerifiedAt: "2026-08-14", sortOrder: 2, version: 1, status: "已发布" },
      ],
      cscaRules: [
        { id: "zju-csca", title: "理工科项目学术背景复核", category: "program", scope: "工程与计算机相关项目", cscaSubjects: ["数学", "物理"], applicablePrograms: ["zju-cs-msc", "zju-biomed-msc"], languageCondition: "英文授课项目按英文要求准备；中文授课另看 HSK。", description: "申请人需要准备成绩单、课程背景和语言证明，CUAC 不代收文件。", importantNote: "具体 CSCA 科目以学校当年通知为准。", sourceUrl: "https://isinfosys.zju.edu.cn", sourceLabel: "学校招生页", lastVerifiedAt: "2026-08-14", sortOrder: 1, version: 1, status: "已发布", isVerified: true },
      ],
      scholarshipsDetailed: [
        { id: "zju-scholarship", name: "浙江大学国际学生奖学金", type: "university", coverage: "部分学费减免或生活补助", applicableDegree: "Master / PhD", applicableProgram: "按项目通知确认", amountText: "以当年通知为准", requirementText: "学校联系学生后确认材料和评审要求", sourceUrl: "https://isinfosys.zju.edu.cn", sourceLabel: "学校奖学金通知", lastVerifiedAt: "2026-08-14", sortOrder: 1, version: 1, status: "已发布" },
      ],
    },
    {
      id: "nju",
      nameZh: "南京大学",
      nameEn: "Nanjing University",
      citySlug: "nanjing",
      cityZh: "南京",
      region: "江苏",
      schoolType: "regular",
      guaranteedAdmission: false,
      tierEn: "C9 / Double First-Class",
      logoUrl: "",
      status: "需审核",
      verificationStatus: "待核验",
      rank: 6,
      applicationLevel: "本科、硕士、博士",
      admissionLevel: "本科、硕士、博士",
      tuitionSummary: "英文授课硕士项目常见区间 RMB 35k-42k / 年。",
      tuitionByCategory: "硕士英文授课：RMB 35k-42k / 年。",
      applicationFee: "RMB 600",
      insurance: "以学校通知为准",
      accommodationCost: "以国际学生住宿通知为准",
      accommodationType: "校内宿舍 / 校外租房",
      officialWebsite: "https://www.nju.edu.cn",
      applicationSystemUrl: "https://istudy.nju.edu.cn",
      hskRequirement: "中文授课需按院系要求提交 HSK；英文授课需英语能力证明。",
      hskNotes: "不同院系要求可能不同。",
      hskMinLevel: 5,
      englishRequired: true,
      englishMinIelts: 6,
      englishMinToefl: 80,
      englishRequirementNote: "英文授课项目需确认 IELTS/TOEFL 或豁免规则。",
      cscaRequirement: "项目要求待最新招生简章复核。",
      cscaRequired: true,
      cscaRequirementNote: "等待最新项目要求复核。",
      undergradRequirements: "高中毕业或同等学历。",
      postgradRequirements: "本科或硕士学历，按项目确认。",
      preparatoryRequirements: "预科要求需另行确认。",
      languageOfInstruction: "中文授课、英文授课",
      round1Deadline: "Sep 30",
      round2Deadline: "2026 秋季待复核",
      round1OpenDate: "待复核",
      round1CloseDate: "Sep 30",
      round2OpenDate: "待复核",
      round2CloseDate: "待复核",
      applicationSteps: "确认项目与截止日期后再进入学校官方系统。",
      scholarships: "校级奖学金和 CSC 机会待复核。",
      englishPrograms: "Software Engineering MSc",
      notablePrograms: "Software Engineering, Economics",
      campusFacilities: "国际学生办公室、校园住宿、图书馆",
      programFields: "Software Engineering, Economics",
      contactTel: "",
      contactEmail: "international@nju.edu.cn",
      contactAddress: "Nanjing, Jiangsu",
      yearEstablished: 1902,
      studentCount: "以学校官方统计为准",
      studentsServed: 1,
      under18GuardianRequired: false,
      under18RequirementNote: "未满 18 岁需确认监护要求。",
      source: "CSCAlite",
      sourceId: "nanjing-university",
      sourceUrl: "https://istudy.nju.edu.cn",
      lastVerifiedAt: "2026-07-30",
      dataQualityScore: 82,
      owner: "数据质检",
      next: "确认学费和奖学金文案",
      programs: [
        { id: "nju-se-msc", nameZh: "软件工程硕士", nameEn: "Software Engineering MSc", degreeLevel: "Master", durationYears: "2 years", fieldCategory: "Software Engineering", teachingLanguage: "English-taught", cscaSubjects: ["数学"], cscaRequirement: "项目要求待最新招生简章复核。", hskRequirement: "英文授课通常不要求 HSK。", englishRequirement: "英语能力证明待复核。", tuitionAmount: "39000", tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 39,000/年", scholarshipText: "待复核", openDate: "待复核", deadlineDate: "2026-12-20", deadlineLabel: "Dec 20", applicationRound: "Fall 2026", applicationUrl: "https://istudy.nju.edu.cn", applicationNote: "截止日期和材料清单待复核。", sourceUrl: "https://istudy.nju.edu.cn", sourceLabel: "NJU admissions", lastVerifiedAt: "2026-07-30", sortOrder: 1, version: 1, status: "需审核" },
      ],
      cscaRules: [],
      scholarshipsDetailed: [],
    },
    {
      id: "uibe",
      nameZh: "对外经济贸易大学",
      nameEn: "University of International Business and Economics",
      citySlug: "beijing",
      cityZh: "北京",
      region: "北京",
      schoolType: "regular",
      guaranteedAdmission: false,
      tierEn: "财经类重点院校",
      logoUrl: "",
      status: "就绪",
      verificationStatus: "已核验",
      rank: 28,
      applicationLevel: "本科、硕士、博士、语言路线",
      admissionLevel: "本科、硕士、博士、语言路线",
      tuitionSummary: "商科与国际贸易方向常见区间 RMB 32k-40k / 年。",
      tuitionByCategory: "商科硕士：RMB 32k-40k / 年。",
      applicationFee: "RMB 660",
      insurance: "以学校通知为准",
      accommodationCost: "以学校住宿办公室为准",
      accommodationType: "校内宿舍 / 校外租房",
      officialWebsite: "https://www.uibe.edu.cn",
      applicationSystemUrl: "https://sie.uibe.edu.cn",
      hskRequirement: "中文授课需 HSK；英文授课通常接受 IELTS / TOEFL 或学校认可证明。",
      hskNotes: "商科中文授课项目需确认 HSK 级别。",
      hskMinLevel: 4,
      englishRequired: true,
      englishMinIelts: 6,
      englishMinToefl: 80,
      englishRequirementNote: "英文授课接受学校认可的英语证明。",
      cscaRequirement: "商科方向以学校项目材料清单为准。",
      cscaRequired: false,
      cscaRequirementNote: "商科方向一般以学校项目清单为准。",
      undergradRequirements: "高中毕业或同等学历。",
      postgradRequirements: "本科或同等学历背景。",
      preparatoryRequirements: "语言路线需按国际学院确认。",
      languageOfInstruction: "中文授课、英文授课",
      round1Deadline: "Oct 15",
      round2Deadline: "Nov 10",
      round1OpenDate: "Sep 1",
      round1CloseDate: "Oct 15",
      round2OpenDate: "Oct 20",
      round2CloseDate: "Nov 10",
      applicationSteps: "学生选择具体项目后，学校老师接收本校记录并联系学生。",
      scholarships: "UIBE 国际学生奖学金、北京市相关奖学金需按通知确认。",
      englishPrograms: "International Trade MSc",
      notablePrograms: "International Trade, Business, Finance",
      campusFacilities: "国际学院、商科资源、北京实习机会",
      programFields: "Business, International Trade, Finance",
      contactTel: "",
      contactEmail: "sie@uibe.edu.cn",
      contactAddress: "Beijing",
      yearEstablished: 1951,
      studentCount: "以学校官方统计为准",
      studentsServed: 1,
      under18GuardianRequired: false,
      under18RequirementNote: "未满 18 岁需确认监护要求。",
      source: "CSCAlite",
      sourceId: "university-of-international-business-and-economics",
      sourceUrl: "https://sie.uibe.edu.cn",
      lastVerifiedAt: "2026-08-10",
      dataQualityScore: 91,
      owner: "招生运营",
      next: "映射学校奖学金记录",
      programs: [
        { id: "uibe-it-msc", nameZh: "国际贸易硕士", nameEn: "International Trade MSc", degreeLevel: "Master", durationYears: "2 years", fieldCategory: "Business", teachingLanguage: "English-taught", cscaSubjects: [], cscaRequirement: "商科方向以学校项目材料清单为准。", hskRequirement: "英文授课通常不要求 HSK。", englishRequirement: "IELTS / TOEFL 或学校认可证明。", tuitionAmount: "36000", tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 36,000/年", scholarshipText: "UIBE scholarship possible.", openDate: "Sep 1", deadlineDate: "2026-11-10", deadlineLabel: "Nov 10", applicationRound: "Fall 2026", applicationUrl: "https://sie.uibe.edu.cn", applicationNote: "学校联系学生确认材料。", sourceUrl: "https://sie.uibe.edu.cn", sourceLabel: "UIBE admissions", lastVerifiedAt: "2026-08-10", sortOrder: 1, version: 1, status: "已发布" },
      ],
      cscaRules: [],
      scholarshipsDetailed: [
        { id: "uibe-scholarship", name: "UIBE 国际学生奖学金", type: "university", coverage: "部分学费减免", applicableDegree: "Bachelor / Master", applicableProgram: "商科与国际贸易方向", amountText: "以学校通知为准", requirementText: "按学校联系后的材料清单准备", sourceUrl: "https://sie.uibe.edu.cn", sourceLabel: "UIBE scholarship notice", lastVerifiedAt: "2026-08-10", sortOrder: 1, version: 1, status: "已发布" },
      ],
    },
  ];
}

function readOpsSchoolRecords(state = readOpsAdminState()) {
  const records = Array.isArray(state.schoolRecords) && state.schoolRecords.length ? state.schoolRecords : defaultOpsSchoolRecords();
  return records.map((school, index) => {
    try {
      return normalizeOpsSchoolRecord(school, index);
    } catch {
      return normalizeOpsSchoolRecord({}, index);
    }
  });
}

function textValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (isPlainRecord(item)) return [item.title, item.label, item.note, item.question, item.value, item.answer, item.body, item.name].filter(Boolean).join(" - ");
      return String(item ?? "");
    }).filter(Boolean).join("\n");
  }
  if (isPlainRecord(value)) {
    return Object.entries(value).map(([key, item]) => `${key}: ${isPlainRecord(item) ? Object.values(item).filter(Boolean).join(" - ") : item}`).join("\n");
  }
  return value ?? "";
}

function formatOpsStructuredTriples(value, keys = ["label", "value", "note"]) {
  if (!Array.isArray(value)) return textValue(value);
  return value.map((item) => {
    if (!isPlainRecord(item)) return String(item ?? "");
    return keys.map((key) => item[key]).filter(Boolean).join(" - ");
  }).filter(Boolean).join("\n");
}

function formatOpsCityContentField(key, value) {
  if (key === "quickFacts" || key === "costProfiles") return formatOpsStructuredTriples(value, ["label", "value", "note"]);
  if (key === "budgetSummary" && isPlainRecord(value)) {
    return [
      value.monthly ? `Monthly - ${value.monthly}` : "",
      value.yearly ? `Yearly - ${value.yearly}` : "",
      value.note ? `Note - ${value.note}` : "",
    ].filter(Boolean).join("\n");
  }
  if (key === "costBreakdown") return formatOpsStructuredTriples(value, ["label", "value"]);
  if (key === "faqs" || key === "cityFaqs") return formatOpsStructuredTriples(value, ["question", "answer"]);
  if (["lifeSections", "applicationAdvice", "nextSteps"].includes(key)) return formatOpsStructuredTriples(value, ["title", "body"]);
  return textValue(value);
}

function normalizeOpsMixedIdListValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const text = String(item ?? "").trim();
      if (!text) return "";
      return /^\d+$/.test(text) ? Number(text) : text;
    }).filter((item) => item !== "");
  }
  if (isPlainRecord(value)) return normalizeOpsMixedIdListValue(Object.values(value));
  return parseOpsMixedIdList(value);
}

function normalizeOpsScholarshipRecord(item, index = 0, options = {}) {
  const record = isPlainRecord(item) ? item : {};
  const fallback = options.useFallback === false ? {} : readOpsDiscoveryRows("getDiscoveryScholarships")[index] || {};
  const merged = { ...fallback, ...record };
  return {
    ...merged,
    id: merged.id || `public-scholarship-${index + 1}`,
    slug: merged.slug || `public-scholarship-${index + 1}`,
    title: merged.title || merged.name || "公共奖学金草稿",
    type: merged.type || "university",
    fundingLevel: merged.fundingLevel || merged.funding || "unknown",
    providerName: merged.providerName || merged.school || "待补充",
    providerNameEn: merged.providerNameEn || merged.providerName || "",
    providerLocation: merged.providerLocation || "",
    summary: merged.summary || "",
    coverage: textValue(merged.coverage),
    applicableDegree: merged.applicableDegree || merged.degree || "All levels",
    applicableProgram: merged.applicableProgram || "按奖学金通知确认",
    amountText: merged.amountText || "",
    requirementText: merged.requirementText || "",
    deadlineDate: merged.deadlineDate || merged.deadline || "",
    deadlineLabel: merged.deadlineLabel || merged.deadline || "",
    applicationRound: merged.applicationRound || "",
    targetCountries: textValue(merged.targetCountries),
    targetRegions: textValue(merged.targetRegions),
    schoolIds: normalizeOpsMixedIdListValue(merged.schoolIds),
    programIds: normalizeOpsMixedIdListValue(merged.programIds),
    schools: toRecordArray(merged.schools),
    programs: toRecordArray(merged.programs),
    bodySections: textValue(merged.bodySections),
    benefitItems: textValue(merged.benefitItems || merged.benefits),
    eligibilityItems: textValue(merged.eligibilityItems),
    applicationMaterials: textValue(merged.applicationMaterials),
    applicationSteps: textValue(merged.applicationSteps),
    contactInfo: textValue(merged.contactInfo),
    actionLinks: textValue(merged.actionLinks),
    sourceUrl: merged.sourceUrl || "",
    sourceLabel: merged.sourceLabel || "Scholarship record",
    lastVerifiedAt: merged.lastVerifiedAt || "",
    sortOrder: merged.sortOrder ?? index + 1,
    status: merged.status || "published",
    version: merged.version || 1,
    createdAt: merged.createdAt || "",
    updatedAt: merged.updatedAt || "",
  };
}

function normalizeOpsCityRecord(item, index = 0, options = {}) {
  const record = isPlainRecord(item) ? item : {};
  const fallback = options.useFallback === false ? {} : readOpsDiscoveryRows("getDiscoveryCities")[index] || {};
  const merged = { ...fallback, ...record };
  const content = { ...(merged.content || merged.contentJson || {}), ...(record.content || {}) };
  const references = merged.references || {};
  const aggregate = merged.aggregate || {};
  const cityAggregate = {
    actualSchoolCount: merged.actualSchoolCount ?? aggregate.actualSchoolCount ?? references.schoolCount ?? 0,
    actualProgramCount: merged.actualProgramCount ?? aggregate.actualProgramCount ?? references.programCount ?? 0,
    actualEnglishProgramCount: merged.actualEnglishProgramCount ?? aggregate.actualEnglishProgramCount ?? references.englishProgramCount ?? 0,
    actualScholarshipCount: merged.actualScholarshipCount ?? aggregate.actualScholarshipCount ?? references.scholarshipCount ?? 0,
    actualCscaRequiredSchoolCount: merged.actualCscaRequiredSchoolCount ?? aggregate.actualCscaRequiredSchoolCount ?? references.cscaRequiredSchoolCount ?? 0,
    visibleSchools: toRecordArray(merged.visibleSchools || aggregate.visibleSchools),
    visiblePrograms: toRecordArray(merged.visiblePrograms || aggregate.visiblePrograms),
    visibleScholarships: toRecordArray(merged.visibleScholarships || aggregate.visibleScholarships),
  };
  return {
    ...merged,
    id: merged.id || merged.slug || `city-${index + 1}`,
    slug: merged.slug || merged.id || `city-${index + 1}`,
    nameZh: merged.nameZh || merged.name || merged.nameEn || "城市草稿",
    nameEn: merged.nameEn || merged.name || "",
    region: merged.region || "",
    monthlyCost: merged.monthlyCost || "",
    costLevel: merged.costLevel || "",
    density: merged.density || "",
    tags: textValue(merged.tags),
    summary: content.summary || merged.summary || "",
    overview: content.overview || merged.overview || "",
    contentJsonText: JSON.stringify(content || {}, null, 2),
    bestFor: formatOpsCityContentField("bestFor", content.bestFor || merged.bestFor),
    quickFacts: formatOpsCityContentField("quickFacts", content.quickFacts),
    budgetSummary: formatOpsCityContentField("budgetSummary", content.budgetSummary),
    costProfiles: formatOpsCityContentField("costProfiles", content.costProfiles),
    why: formatOpsCityContentField("why", content.why),
    costBreakdown: formatOpsCityContentField("costBreakdown", content.costBreakdown),
    lifeSections: formatOpsCityContentField("lifeSections", content.lifeSections),
    transportNotes: formatOpsCityContentField("transportNotes", content.transportNotes),
    applicationTips: formatOpsCityContentField("applicationTips", content.applicationTips),
    applicationAdvice: formatOpsCityContentField("applicationAdvice", content.applicationAdvice),
    relatedProgramKeywords: formatOpsCityContentField("relatedProgramKeywords", content.relatedProgramKeywords),
    nextSteps: formatOpsCityContentField("nextSteps", content.nextSteps),
    faqs: formatOpsCityContentField("faqs", content.faqs),
    cityFaqs: formatOpsCityContentField("cityFaqs", content.cityFaqs),
    nearby: textValue(merged.nearby),
    referenceSchoolCount: merged.referenceSchoolCount ?? references.schoolCount ?? aggregate.actualSchoolCount ?? 0,
    referenceProgramCount: merged.referenceProgramCount ?? references.programCount ?? aggregate.actualProgramCount ?? 0,
    referenceEnglishProgramCount: merged.referenceEnglishProgramCount ?? references.englishProgramCount ?? aggregate.actualEnglishProgramCount ?? 0,
    referenceScholarshipCount: merged.referenceScholarshipCount ?? references.scholarshipCount ?? aggregate.actualScholarshipCount ?? 0,
    referenceCscaSchoolCount: merged.referenceCscaSchoolCount ?? references.cscaRequiredSchoolCount ?? aggregate.actualCscaRequiredSchoolCount ?? 0,
    aggregate: cityAggregate,
    actualSchoolCount: cityAggregate.actualSchoolCount,
    actualProgramCount: cityAggregate.actualProgramCount,
    actualEnglishProgramCount: cityAggregate.actualEnglishProgramCount,
    actualScholarshipCount: cityAggregate.actualScholarshipCount,
    actualCscaRequiredSchoolCount: cityAggregate.actualCscaRequiredSchoolCount,
    visibleSchools: cityAggregate.visibleSchools,
    visiblePrograms: cityAggregate.visiblePrograms,
    visibleScholarships: cityAggregate.visibleScholarships,
    status: merged.status || "published",
    sortOrder: merged.sortOrder ?? index + 1,
    version: merged.version || 1,
    createdAt: merged.createdAt || "",
    updatedAt: merged.updatedAt || "",
  };
}

function defaultOpsTimelineRecords() {
  return [
    {
      id: "timeline-sep",
      month: "Sep",
      title: "Application research opens",
      applicationWindow: "Shortlist schools, confirm program language, tuition, and first-round deadlines.",
      cscaWindow: "Check whether target schools require CSCA subjects before committing to a route.",
      status: "published",
      sortOrder: 1,
      version: 1,
      updatedAt: "2026-08-20",
    },
    {
      id: "timeline-oct",
      month: "Oct",
      title: "Main application window",
      applicationWindow: "Add concrete CUAC choices and review school-specific requirements before payment.",
      cscaWindow: "Prepare CSCA Math or subject-route planning if a chosen school requires it.",
      status: "published",
      sortOrder: 2,
      version: 1,
      updatedAt: "2026-08-20",
    },
    {
      id: "timeline-dec",
      month: "Dec",
      title: "Second deadline check",
      applicationWindow: "Review backup schools, late intakes, and school follow-up requests.",
      cscaWindow: "Confirm exam timing and whether CSCA evidence is needed before school contact.",
      status: "draft",
      sortOrder: 3,
      version: 1,
      updatedAt: "2026-08-20",
    },
  ];
}

function normalizeOpsTimelineRecord(item, index = 0, options = {}) {
  const record = isPlainRecord(item) ? item : {};
  const fallback = options.useFallback === false ? {} : defaultOpsTimelineRecords()[index] || {};
  const merged = { ...fallback, ...record };
  return {
    ...merged,
    id: merged.id || `timeline-${index + 1}`,
    month: merged.month || "",
    title: merged.title || "申请时间窗草稿",
    applicationWindow: merged.applicationWindow || "",
    cscaWindow: merged.cscaWindow || "",
    status: merged.status || "draft",
    sortOrder: merged.sortOrder ?? index + 1,
    version: merged.version || 1,
    updatedAt: merged.updatedAt || "",
  };
}

function readOpsScholarshipRecords(state = readOpsAdminState()) {
  const storedRecords = toOpsContentList(state.publicScholarshipRecords);
  const useFallback = !storedRecords.length;
  let records = storedRecords;
  if (!records.length) {
    records = readOpsDiscoveryRows("getDiscoveryScholarships");
  }
  return records.map((item, index) => {
    try {
      return normalizeOpsScholarshipRecord(item, index, { useFallback });
    } catch {
      return normalizeOpsScholarshipRecord({}, index, { useFallback });
    }
  });
}

function createOpsPublicScholarshipDraftRecord(draftId, sortOrder = 1) {
  const now = new Date().toISOString();
  return normalizeOpsScholarshipRecord({
    id: draftId,
    slug: draftId,
    title: "新公共奖学金草稿",
    type: "university",
    fundingLevel: "unknown",
    providerName: "待补充",
    providerNameEn: "",
    providerLocation: "",
    summary: "",
    coverage: "",
    applicableDegree: "All levels",
    applicableProgram: "按奖学金通知确认",
    amountText: "",
    requirementText: "",
    bodySections: "",
    benefits: "",
    benefitItems: "",
    eligibilityItems: "",
    applicationMaterials: "",
    applicationSteps: "",
    contactInfo: "",
    actionLinks: "",
    deadlineDate: "",
    deadlineLabel: "",
    applicationRound: "",
    targetCountries: "",
    targetRegions: "",
    schoolIds: [],
    programIds: [],
    schools: [],
    programs: [],
    sourceUrl: "",
    sourceLabel: "Scholarship record",
    lastVerifiedAt: "",
    sortOrder,
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
  }, sortOrder - 1, { useFallback: false });
}

function createOpsScholarshipImportExample() {
  return JSON.stringify({
    items: [
      {
        slug: "jiangsu-jasmine-import-demo",
        title: "Jiangsu Jasmine Scholarship",
        type: "provincial",
        fundingLevel: "partial",
        providerName: "Jiangsu universities",
        providerLocation: "Jiangsu",
        summary: "Province-level scholarship route for students considering Nanjing, Suzhou, and nearby cities.",
        coverage: "Tuition waiver or partial funding, confirmed by annual notice.",
        applicableDegree: "Bachelor / Master",
        applicableProgram: "Multiple Jiangsu university programs",
        deadlineDate: "2026-05-30",
        deadlineLabel: "May 30",
        targetCountries: ["Malaysia", "Pakistan"],
        targetRegions: ["ASEAN"],
        benefits: ["Tuition support", "School nomination route"],
        schoolIds: ["nju"],
        programIds: [],
        sourceUrl: "https://example.edu/scholarship",
        sourceLabel: "Annual scholarship notice",
        status: "draft",
        sortOrder: 1
      }
    ]
  }, null, 2);
}

function parseOpsScholarshipImportItems(value) {
  const parsed = JSON.parse(String(value || ""));
  const items = Array.isArray(parsed) ? parsed : isPlainRecord(parsed) ? parsed.items : null;
  if (!Array.isArray(items)) throw new Error("导入内容必须是 JSON 数组，或包含 items 数组的对象。");
  const missingTitleIndex = items.findIndex((item) => !isPlainRecord(item) || !String(item.title || "").trim());
  if (missingTitleIndex >= 0) throw new Error(`第 ${missingTitleIndex + 1} 条缺少 title。`);
  return items.filter(isPlainRecord).map((item, index) => normalizeOpsScholarshipRecord({
    ...item,
    id: item.id || item.slug || slugify(item.title || `imported-scholarship-${index + 1}`),
    slug: item.slug || item.id || slugify(item.title || `imported-scholarship-${index + 1}`),
    status: item.status || "draft",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }, index, { useFallback: false }));
}

function readOpsCityRecords(state = readOpsAdminState()) {
  const storedRecords = toOpsContentList(state.cityGuideRecords);
  const useFallback = !storedRecords.length;
  let records = storedRecords;
  if (!records.length) {
    records = readOpsDiscoveryRows("getDiscoveryCities");
  }
  return records.map((item, index) => {
    try {
      return normalizeOpsCityRecord(item, index, { useFallback });
    } catch {
      return normalizeOpsCityRecord({}, index, { useFallback });
    }
  });
}

function readOpsTimelineRecords(state = readOpsAdminState()) {
  const storedRecords = toOpsContentList(state.timelineWindowRecords);
  const useFallback = !storedRecords.length;
  const records = storedRecords.length ? storedRecords : defaultOpsTimelineRecords();
  return records.map((item, index) => {
    try {
      return normalizeOpsTimelineRecord(item, index, { useFallback });
    } catch {
      return normalizeOpsTimelineRecord({}, index, { useFallback });
    }
  });
}

function createOpsTimelineDraftRecord(draftId, sortOrder = 1) {
  return normalizeOpsTimelineRecord({
    id: draftId,
    month: "",
    title: "新申请时间窗草稿",
    applicationWindow: "",
    cscaWindow: "",
    status: "draft",
    sortOrder,
    version: 1,
    updatedAt: new Date().toISOString(),
  }, sortOrder - 1, { useFallback: false });
}

function getOpsSelectedSchool(records, state = readOpsAdminState()) {
  return records.find((item) => item.id === state.selectedSchoolId) || records[0] || null;
}

function activeOpsSchoolTab(state = readOpsAdminState()) {
  return normalizeOpsSchoolTab(state.schoolEditorTab);
}

function normalizeOpsSchoolTab(tab) {
  return opsSchoolEditorTabs.some(([key]) => key === tab) ? tab : "overview";
}

function opsSchoolAuditSnapshot(school = {}) {
  return {
    nameZh: school.nameZh || "",
    status: school.status || "",
    version: school.version || 1,
    updatedAt: school.updatedAt || "",
    programs: toRecordArray(school.programs).length,
    cscaRules: toRecordArray(school.cscaRules).length,
    scholarshipsDetailed: toRecordArray(school.scholarshipsDetailed).length,
  };
}

function readOpsSchoolChangeLogs(state = readOpsAdminState(), schoolId = "") {
  const logsBySchool = isPlainRecord(state.schoolChangeLogs) ? state.schoolChangeLogs : {};
  return toRecordArray(logsBySchool[String(schoolId)]).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function appendOpsSchoolChangeLog(state, schoolId, action, changes = [], before = null, after = null) {
  if (!schoolId) return state;
  const logsBySchool = isPlainRecord(state.schoolChangeLogs) ? { ...state.schoolChangeLogs } : {};
  const previous = toRecordArray(logsBySchool[String(schoolId)]);
  const log = {
    id: Date.now(),
    action,
    actorId: 9001,
    actorEmail: "ops@cuac.demo",
    createdAt: new Date().toISOString(),
    before: before || undefined,
    after: after || undefined,
    changes: toArray(changes).filter(Boolean),
  };
  logsBySchool[String(schoolId)] = [log, ...previous].slice(0, 30);
  return { ...state, schoolChangeLogs: logsBySchool };
}

function renderOpsSchoolChangeLogs(logs = []) {
  if (!logs.length) {
    return `<p class="ops-empty">还没有学校级变更记录。保存学校、归档记录、管理项目、维护 CSCA 规则或学校奖学金后，这里会显示操作人、时间、动作类型和字段变化，方便运营复盘。</p>`;
  }
  return `
    <div class="ops-change-log audit">
      ${logs.map((log) => `
        <article>
          <span>${escapeHtml(log.createdAt || "时间待补充")}</span>
          <strong>${escapeHtml(log.action || "update_school")}</strong>
          <small>${escapeHtml(log.actorEmail || "ops@cuac.demo")}</small>
          <p>${escapeHtml(toArray(log.changes).join("；") || "字段已更新")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function createOpsSchoolImportExample() {
  return JSON.stringify({
    items: [
      {
        source: "CSCAlite",
        sourceId: "zju-admin-import-demo",
        nameZh: "批量导入大学",
        nameEn: "Bulk Import University",
        cityZh: "南京",
        region: "江苏",
        schoolType: "regular",
        status: "draft",
        verificationStatus: "pending",
        cscaRequired: true,
        cscaRequirement: "理工科项目需确认 CSCA 数学或相关科目。",
        languageRequirement: "中文授课项目按学院要求确认 HSK；英文授课项目需提交英语能力证明。",
        contactTel: "+86 25 0000 0000",
        contactEmail: "admissions@bulk.example.edu",
        contactAddress: "南京市国际学生办公室",
        yearEstablished: 1998,
        studentCount: "约 18,000 名学生",
        studentsServed: 0,
        under18GuardianRequired: false,
        under18RequirementNote: "未满 18 岁申请人需按学校当年政策确认监护安排。",
        programs: [
          {
            id: "bulk-import-data-msc",
            nameZh: "数据科学硕士",
            nameEn: "Data Science MSc",
            degreeLevel: "Master",
            teachingLanguage: "English-taught",
            status: "draft",
            sortOrder: 1
          }
        ],
        cscaRules: [],
        scholarshipsDetailed: []
      }
    ]
  }, null, 2);
}

function renderOpsSchoolCreatePanel(opsState = readOpsAdminState()) {
  if (!opsState.schoolCreateOpen) return "";
  return `
    <article class="ops-create-panel" data-ops-school-create-panel>
      <div class="section-head compact">
        <div><span class="module-kicker">新增学校</span><h3>先填写基础识别信息</h3></div>
        <button class="secondary-action micro" data-ops-school-create-cancel type="button">收起</button>
      </div>
      <div class="ops-editor-note">至少需要中文名；创建后继续在右侧补齐申请要求、项目、奖学金和来源信息。</div>
      <div class="ops-form-grid compact">
        <label class="ops-form-field"><span class="ops-field-label"><strong>中文名</strong></span><input data-ops-school-create-field="nameZh" placeholder="例如：复旦大学" required /></label>
        <label class="ops-form-field"><span class="ops-field-label"><strong>英文名</strong></span><input data-ops-school-create-field="nameEn" placeholder="Fudan University" /></label>
        <label class="ops-form-field"><span class="ops-field-label"><strong>城市</strong></span><input data-ops-school-create-field="cityZh" placeholder="上海" /></label>
        <label class="ops-form-field"><span class="ops-field-label"><strong>地区</strong></span><input data-ops-school-create-field="region" placeholder="上海" /></label>
        <label class="ops-form-field"><span class="ops-field-label"><strong>学校类型</strong></span><select data-ops-school-create-field="schoolType"><option value="regular">普通高校</option><option value="partner">合作院校</option></select></label>
      </div>
      <div class="inline-actions">
        <button class="primary-action" data-ops-school-create type="button">创建学校草稿</button>
        <button class="secondary-action" data-ops-school-create-cancel type="button">取消</button>
      </div>
    </article>
  `;
}

function parseOpsSchoolImportItems(value) {
  const parsed = JSON.parse(String(value || ""));
  const items = Array.isArray(parsed) ? parsed : isPlainRecord(parsed) ? parsed.items : null;
  if (!Array.isArray(items)) throw new Error("导入内容必须是 JSON 数组，或包含 items 数组的对象。");
  const missingNameIndex = items.findIndex((item) => !isPlainRecord(item) || !String(item.nameZh || "").trim());
  if (missingNameIndex >= 0) throw new Error(`第 ${missingNameIndex + 1} 条缺少 nameZh。`);
  return items.filter(isPlainRecord).map((item, index) => normalizeOpsSchoolRecord({
    ...item,
    id: item.id || item.sourceId || slugify(item.nameEn || item.nameZh || `imported-school-${index + 1}`),
    source: item.source || "CSCAlite",
    sourceId: item.sourceId || item.id || slugify(item.nameEn || item.nameZh || `imported-school-${index + 1}`),
    status: item.status || "draft",
    verificationStatus: item.verificationStatus || "pending",
    updatedAt: item.updatedAt || new Date().toISOString(),
  }, index));
}

function renderOpsSchoolImportPanel(opsState = readOpsAdminState()) {
  const open = Boolean(opsState.schoolImportOpen);
  if (!open) return "";
  const importText = opsState.schoolImportText || createOpsSchoolImportExample();
  const preview = isPlainRecord(opsState.schoolImportPreview) ? opsState.schoolImportPreview : null;
  return `
    <article class="ops-import-panel ${open ? "open" : ""}">
      <button class="ops-import-toggle" data-ops-school-import-toggle type="button">
        <span><strong>批量 JSON 导入</strong><small>可粘贴旧项目导出的学校数据；支持 { items: [...] }，也兼容数组。</small></span>
        <b>${open ? "收起" : "展开"}</b>
      </button>
      <div class="ops-import-body">
        <label class="ops-form-field wide">
          <span>JSON · { items: [...] }</span>
          <textarea data-ops-school-import-text spellcheck="false">${escapeHtml(importText)}</textarea>
        </label>
        ${preview ? `<p class="${preview.tone === "success" ? "ops-inline-success" : "ops-inline-danger"}">${escapeHtml(preview.message)}</p>` : `<p class="ops-editor-note">每条记录至少需要 nameZh。source + sourceId 相同会更新现有学校，否则新增为草稿。</p>`}
        <div class="inline-actions">
          <button class="secondary-action" data-ops-school-import-example type="button">填入示例</button>
          <button class="secondary-action" data-ops-school-import-preview type="button">预览校验</button>
          <button class="primary-action" data-ops-school-import-apply type="button">导入学校</button>
        </div>
      </div>
    </article>
  `;
}

function opsLifecycleStatusKey(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["published", "已发布", "就绪", "ready"].includes(value)) return "published";
  if (["draft", "需审核", "待审核", "pending", "review"].includes(value)) return "draft";
  if (["archived", "已归档", "archive"].includes(value)) return "archived";
  return value || "draft";
}

function opsLifecycleStatusLabel(status) {
  const key = opsLifecycleStatusKey(status);
  if (key === "published") return "已发布";
  if (key === "draft") return "需审核";
  if (key === "archived") return "已归档";
  return String(status || "需审核");
}

function opsLifecycleStatusMatches(status, filter) {
  if (!filter || filter === "all") return true;
  return opsLifecycleStatusKey(status) === opsLifecycleStatusKey(filter);
}

function opsLifecycleStatusArchived(status) {
  return opsLifecycleStatusKey(status) === "archived";
}

function opsVerificationStatusKey(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["verified", "已核验", "核验通过"].includes(value)) return "verified";
  if (["pending", "待核验", "待复核", "需审核"].includes(value)) return "pending";
  if (["sample", "样本", "demo"].includes(value)) return "sample";
  return value || "pending";
}

function opsVerificationStatusLabel(status) {
  const key = opsVerificationStatusKey(status);
  if (key === "verified") return "已核验";
  if (key === "pending") return "待核验";
  if (key === "sample") return "样本";
  return String(status || "待核验");
}

function opsVerificationStatusVerified(status) {
  return opsVerificationStatusKey(status) === "verified";
}

function schoolStatusTone(status) {
  const key = opsLifecycleStatusKey(status);
  if (key === "draft") return "warn";
  if (key === "archived") return "danger";
  return "";
}

const opsSchoolSelectOptions = {
  schoolType: [
    ["regular", "普通高校"],
    ["partner", "合作院校"],
    ["985", "985 / 双一流（CUAC 标签）"],
    ["211", "211 / 双一流（CUAC 标签）"],
    ["language", "语言类院校（CUAC 标签）"],
    ["medical", "医学类院校（CUAC 标签）"],
  ],
  status: [
    ["published", "已发布"],
    ["draft", "草稿 / 需审核"],
    ["archived", "已归档"],
    ["已发布", "已发布"],
    ["需审核", "需审核"],
    ["就绪", "就绪"],
    ["已归档", "已归档"],
  ],
  verificationStatus: [
    ["verified", "已核验"],
    ["pending", "待核验"],
    ["sample", "样本"],
    ["已核验", "已核验"],
    ["待核验", "待核验"],
    ["样本", "样本"],
  ],
};

const opsSchoolFieldGroups = {
  basic: [
    { label: "中文名 · School.nameZh", key: "nameZh", required: true },
    { label: "英文名 · School.nameEn", key: "nameEn" },
    { label: "城市 · School.cityZh", key: "cityZh" },
    { label: "城市 URL 标识 · School.citySlug", key: "citySlug" },
    { label: "地区 · School.region", key: "region" },
    { label: "学校类型 · School.schoolType", key: "schoolType", control: "select" },
    { label: "发布状态 · School.status", key: "status", control: "select" },
  ],
  admissions: [
    { label: "CSCA 是否需要 · School.cscaRequired", key: "cscaRequired", control: "checkbox" },
    { label: "CSCA 要求 · School.cscaRequirement", key: "cscaRequirement", control: "textarea", wide: true },
    { label: "CSCA 备注 · School.cscaRequirementNote", key: "cscaRequirementNote", control: "textarea", wide: true },
    { label: "语言要求 · AdminSchoolDetail.languageRequirement", key: "languageRequirement", control: "textarea", wide: true },
    { label: "授课语言 · School.languageOfInstruction", key: "languageOfInstruction", control: "textarea", wide: true },
    { label: "英文授课项目 · School.englishPrograms", key: "englishPrograms", control: "textarea", wide: true },
    { label: "项目领域 · School.programFields", key: "programFields", control: "textarea", wide: true },
  ],
  costs: [
    { label: "费用摘要 · School.tuitionSummary", key: "tuitionSummary", control: "textarea", wide: true },
    { label: "申请费 · School.applicationFee", key: "applicationFee" },
    { label: "学校奖学金摘要 · School.scholarships", key: "scholarships", control: "textarea", wide: true },
    { label: "官网 URL · AdminSchoolDetail.officialWebsiteUrl", key: "officialWebsiteUrl", type: "url", wide: true },
    { label: "招生页面 URL · AdminSchoolDetail.admissionsWebsiteUrl", key: "admissionsWebsiteUrl", type: "url", wide: true },
  ],
  contact: [
    { label: "招生电话 · School.contactTel", key: "contactTel" },
    { label: "招生邮箱 · School.contactEmail", key: "contactEmail", type: "email" },
    { label: "联系地址 · School.contactAddress", key: "contactAddress", control: "textarea", wide: true },
    { label: "建校年份 · School.yearEstablished", key: "yearEstablished", type: "number" },
    { label: "学生规模 · School.studentCount", key: "studentCount" },
    { label: "CUAC 服务学生数 · School.studentsServed", key: "studentsServed", type: "number" },
    { label: "未成年监护要求 · School.under18GuardianRequired", key: "under18GuardianRequired", control: "checkbox" },
    { label: "未成年监护备注 · School.under18RequirementNote", key: "under18RequirementNote", control: "textarea", wide: true },
  ],
  source: [
    { label: "来源 · School.source", key: "source" },
    { label: "来源编号 · School.sourceId", key: "sourceId" },
    { label: "来源链接 · School.sourceUrl", key: "sourceUrl", type: "url", wide: true },
    { label: "最近核验 · School.lastVerifiedAt", key: "lastVerifiedAt", type: "date" },
  ],
};

const opsSchoolEditorTabs = [
  ["overview", "概览"],
  ["basic", "基础信息"],
  ["admissions", "申请要求"],
  ["costs", "费用与链接"],
  ["contact", "联系与规模"],
  ["programs", "项目"],
  ["scholarships", "奖学金"],
  ["source", "来源"],
  ["logs", "变更记录"],
];

const opsSubrecordStatusOptions = [
  ["published", "已发布"],
  ["draft", "草稿"],
  ["archived", "已归档"],
  ["已发布", "已发布"],
  ["需审核", "需审核"],
];

const opsSchoolSubrecordFields = {
  rules: [
    { label: "规则标题", key: "title", required: true },
    { label: "规则类型", key: "category", control: "select", options: [["general", "通用"], ["program", "项目"], ["language", "语言"], ["csca", "CSCA"]] },
    { label: "适用范围", key: "scope" },
    { label: "关联项目", key: "programId", type: "number" },
    { label: "CSCA 科目", key: "cscaSubjects", control: "textarea", wide: true },
    { label: "状态", key: "status", control: "select", options: opsSubrecordStatusOptions },
    { label: "排序", key: "sortOrder", type: "number" },
    { label: "版本", key: "version", type: "number" },
    { label: "规则说明", key: "description", control: "textarea", wide: true },
    { label: "语言条件", key: "languageCondition", control: "textarea", wide: true },
    { label: "重要备注", key: "importantNote", control: "textarea", wide: true },
    { label: "来源链接", key: "sourceUrl", type: "url", wide: true },
    { label: "来源标签", key: "sourceLabel" },
    { label: "最近核验", key: "lastVerifiedAt", type: "date" },
  ],
  programs: [
    { label: "项目中文名", key: "nameZh", required: true },
    { label: "项目英文名", key: "nameEn" },
    { label: "学位层级", key: "degreeLevel" },
    { label: "学制", key: "durationYears" },
    { label: "学科方向", key: "fieldCategory" },
    { label: "授课语言", key: "teachingLanguage" },
    { label: "CSCA 科目", key: "cscaSubjects", control: "textarea", wide: true },
    { label: "排序", key: "sortOrder", type: "number" },
    { label: "版本", key: "version", type: "number" },
    { label: "CSCA 要求", key: "cscaRequirement", control: "textarea", wide: true },
    { label: "HSK 要求", key: "hskRequirement", control: "textarea", wide: true },
    { label: "英语要求", key: "englishRequirement", control: "textarea", wide: true },
    { label: "学费金额", key: "tuitionAmount", type: "number" },
    { label: "币种", key: "tuitionCurrency" },
    { label: "计费周期", key: "tuitionPeriod" },
    { label: "状态", key: "status", control: "select", options: opsSubrecordStatusOptions },
    { label: "学费说明", key: "tuitionText", control: "textarea", wide: true },
    { label: "奖学金/备注", key: "scholarshipText", control: "textarea", wide: true },
    { label: "开放日期", key: "openDate", type: "date" },
    { label: "截止日期", key: "deadlineDate", type: "date" },
    { label: "截止标签", key: "deadlineLabel" },
    { label: "申请轮次", key: "applicationRound" },
    { label: "申请入口", key: "applicationUrl", type: "url", wide: true },
    { label: "申请备注", key: "applicationNote", wide: true },
    { label: "来源链接", key: "sourceUrl", type: "url", wide: true },
    { label: "来源标签", key: "sourceLabel" },
    { label: "最近核验", key: "lastVerifiedAt", type: "date" },
  ],
  scholarships: [
    { label: "奖学金名称", key: "name", required: true },
    { label: "类型", key: "type", control: "select", options: [["general", "通用奖学金"], ["government", "政府奖学金"], ["csc", "CSC"], ["university", "校级奖学金"], ["provincial", "省市奖学金"], ["confucius", "孔子学院奖学金"]] },
    { label: "适用学位", key: "applicableDegree" },
    { label: "关联项目", key: "programId", type: "number" },
    { label: "状态", key: "status", control: "select", options: opsSubrecordStatusOptions },
    { label: "排序", key: "sortOrder", type: "number" },
    { label: "版本", key: "version", type: "number" },
    { label: "适用项目", key: "applicableProgram", wide: true },
    { label: "覆盖范围", key: "coverage", control: "textarea", wide: true },
    { label: "金额说明", key: "amountText", control: "textarea", wide: true },
    { label: "申请要求", key: "requirementText", control: "textarea", wide: true },
    { label: "来源链接", key: "sourceUrl", type: "url", wide: true },
    { label: "来源标签", key: "sourceLabel" },
    { label: "最近核验", key: "lastVerifiedAt", type: "date" },
  ],
};

const opsSchoolSubrecordFieldGroups = {
  rules: [
    ["基础信息", ["title", "category", "scope", "programId", "status", "sortOrder", "version"]],
    ["规则内容", ["cscaSubjects", "languageCondition", "description", "importantNote"]],
    ["来源记录", ["sourceUrl", "sourceLabel", "lastVerifiedAt"]],
  ],
  programs: [
    ["基础信息", ["nameZh", "nameEn", "degreeLevel", "durationYears", "fieldCategory", "teachingLanguage", "sortOrder", "version", "status"]],
    ["要求与费用", ["cscaSubjects", "cscaRequirement", "hskRequirement", "englishRequirement", "tuitionAmount", "tuitionCurrency", "tuitionPeriod", "tuitionText"]],
    ["资助备注", ["scholarshipText"]],
    ["申请与来源", ["openDate", "deadlineDate", "deadlineLabel", "applicationRound", "applicationUrl", "applicationNote", "sourceUrl", "sourceLabel", "lastVerifiedAt"]],
  ],
  scholarships: [
    ["基础信息", ["name", "type", "status", "sortOrder", "version"]],
    ["适用范围", ["applicableDegree", "programId", "applicableProgram"]],
    ["资助与要求", ["coverage", "amountText", "requirementText"]],
    ["来源记录", ["sourceUrl", "sourceLabel", "lastVerifiedAt"]],
  ],
};

function opsSchoolFieldValue(field, school = {}) {
  const fallbackByKey = {
    officialWebsiteUrl: school.officialWebsite,
    admissionsWebsiteUrl: school.applicationSystemUrl || school.admissionsWebsiteUrl,
    applicationLevel: school.applicationLevel || school.admissionLevel,
    admissionLevel: school.admissionLevel || school.applicationLevel,
    qualityScore: school.qualityScore ?? school.dataQualityScore,
  };
  return school[field.key] ?? fallbackByKey[field.key] ?? "";
}

function renderOpsFieldLabel(label = "") {
  const [title] = String(label).split(" · ");
  return `<span class="ops-field-label"><strong>${escapeHtml(title || label)}</strong></span>`;
}

function opsFieldSource(label = "") {
  const parts = String(label || "").split(" · ");
  return parts.length > 1 ? parts.slice(1).join(" · ").trim() : "";
}

function opsFieldSourceAttrs(label = "") {
  const source = opsFieldSource(label);
  return source ? ` data-source-field="${escapeHtml(source)}" title="${escapeHtml(source)}"` : "";
}

function renderOpsFieldMap(title, description, fields = [], options = {}) {
  const compact = options.compact ? " compact" : "";
  return `
    <details class="ops-field-map ops-field-map-collapsible${compact}" aria-label="${escapeHtml(title)}">
      <summary><span>${escapeHtml(title)}</span><small>${escapeHtml(description)}</small></summary>
      <div class="ops-field-map-list">
        ${fields.map((field) => `<span data-source-field="${escapeHtml(field)}" title="${escapeHtml(field)}">${escapeHtml(field)}</span>`).join("")}
      </div>
    </details>
  `;
}

function renderSchoolField(field, school) {
  const value = textValue(opsSchoolFieldValue(field, school));
  const classes = ["ops-form-field", field.wide ? "wide" : ""].filter(Boolean).join(" ");
  const label = renderOpsFieldLabel(field.label);
  const sourceAttrs = opsFieldSourceAttrs(field.label);
  if (field.control === "checkbox") {
    const checked = value === true || value === "true" || value === "是" || value === "需要";
    return `<label class="${classes} checkbox-field"${sourceAttrs}>${label}<input data-ops-school-field="${escapeHtml(field.key)}" type="checkbox" ${checked ? "checked" : ""} /></label>`;
  }
  if (field.control === "textarea") {
    return `<label class="${classes}"${sourceAttrs}>${label}<textarea data-ops-school-field="${escapeHtml(field.key)}">${escapeHtml(value)}</textarea></label>`;
  }
  if (field.control === "select") {
    const options = (opsSchoolSelectOptions[field.key] || []).map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === optionValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("");
    return `<label class="${classes}"${sourceAttrs}>${label}<select data-ops-school-field="${escapeHtml(field.key)}">${options}</select></label>`;
  }
  return `<label class="${classes}"${sourceAttrs}>${label}<input data-ops-school-field="${escapeHtml(field.key)}" value="${escapeHtml(value)}" type="${escapeHtml(field.type || "text")}" ${field.step ? `step="${escapeHtml(field.step)}"` : ""} ${field.required ? "required" : ""} ${field.readonly ? "readonly" : ""} /></label>`;
}

function renderSchoolFieldGroup(groupKey, school) {
  return `<div class="ops-form-grid">${(opsSchoolFieldGroups[groupKey] || []).map((field) => renderSchoolField(field, school)).join("")}</div>`;
}

function inlineValue(value, fallback = "待补充") {
  const text = textValue(value);
  if (Array.isArray(value)) return text ? text.replace(/\n/g, " + ") : fallback;
  return text || fallback;
}

function opsPreviewTokens(value, limit = 4) {
  if (Array.isArray(value)) return value.map((item) => textValue(item)).filter(Boolean).slice(0, limit);
  return String(value || "")
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function renderOpsSchoolPublicPreview(school = {}) {
  const programs = toRecordArray(school.programs);
  const scholarships = toRecordArray(school.scholarshipsDetailed);
  const rules = toRecordArray(school.cscaRules);
  const quickRows = [
    ["位置", school.quickFactsLocation || [school.cityZh, school.region].filter(Boolean).join("，")],
    ["学费", school.quickFactsTuition || school.tuitionSummary],
    ["生活费", school.quickFactsLivingCost],
    ["住宿", school.quickFactsAccommodation],
  ].filter(([, value]) => textValue(value));
  const missing = [
    ["英文名", school.nameEn],
    ["城市", school.cityZh || school.detailCity],
    ["申请层级", school.applicationLevel || school.admissionLevel],
    ["语言要求", school.languageRequirement || school.hskRequirement || school.englishRequirementNote],
    ["学费摘要", school.tuitionSummary || school.quickFactsTuition],
    ["招生入口", school.applicationSystemUrl || school.admissionsWebsiteUrl],
    ["来源链接", school.sourceUrl],
    ["最近核验", school.lastVerifiedAt],
  ].filter(([, value]) => !textValue(value)).map(([label]) => label);
  const displayTags = [
    ...opsPreviewTokens(school.detailDisplaySubjectTags || school.subjectTags, 3),
    ...opsPreviewTokens(school.detailProgramFieldTags || school.programFields, 3),
  ].slice(0, 5);
  const firstDeadline = programs.find((item) => item.deadlineLabel || item.deadlineDate) || {};
  const previewHref = `university-detail.html?university=${encodeURIComponent(String(school.id || slugify(school.nameEn || school.nameZh || "")))}`;
  return `
    <section class="ops-school-public-preview" data-ops-school-public-preview aria-label="学校公开页预览">
      <div class="ops-preview-head">
        <div>
          <span class="module-kicker">公开页预览</span>
          <h3>${escapeHtml(school.nameZh || "学校草稿")} ${school.nameEn ? `<small>${escapeHtml(school.nameEn)}</small>` : ""}</h3>
          <p>${escapeHtml(school.decisionSummary || school.applicationPortalNotes || "保存后，这些字段会进入学生端学校详情页和申请选择器。")}</p>
        </div>
        <a class="secondary-action" href="${escapeHtml(previewHref)}">打开公开页</a>
      </div>
      <div class="ops-preview-metrics">
        <article><strong>${escapeHtml(String(school.dataQualityScore || school.qualityScore || 0))}%</strong><span>质量分</span></article>
        <article><strong>${programs.length}</strong><span>项目</span></article>
        <article><strong>${rules.length}</strong><span>CSCA 规则</span></article>
        <article><strong>${scholarships.length}</strong><span>学校奖学金</span></article>
      </div>
      <div class="ops-preview-grid">
        <article>
          <span>学生会先看到</span>
          <strong>${escapeHtml(school.nameEn || school.nameZh || "学校名称待补充")}</strong>
          <p>${escapeHtml([school.cityZh || school.detailCity, school.region || school.detailRegionLabel, school.schoolType].filter(Boolean).join(" · ") || "位置和学校类型待补充")}</p>
        </article>
        <article>
          <span>学生端展示字段</span>
          <div class="ops-preview-chip-row">
            ${quickRows.length ? quickRows.map(([label, value]) => `<b>${escapeHtml(label)}：${escapeHtml(textValue(value))}</b>`).join("") : `<b>快速事实待补充</b>`}
          </div>
        </article>
        <article>
          <span>项目与截止</span>
          <strong>${escapeHtml(firstDeadline.nameEn || firstDeadline.nameZh || "项目截止待补充")}</strong>
          <p>${escapeHtml([firstDeadline.deadlineLabel || firstDeadline.deadlineDate, school.upcomingDeadlinesText ? "已配置近期截止提醒" : ""].filter(Boolean).join(" · ") || "项目分区可补充开放日期、截止日期和截止标签")}</p>
        </article>
        <article>
          <span>待补字段</span>
          <div class="ops-preview-chip-row muted">
            ${(missing.length ? missing : ["基础字段可预览"]).slice(0, 6).map((item) => `<b>${escapeHtml(item)}</b>`).join("")}
          </div>
        </article>
      </div>
      ${displayTags.length ? `<div class="ops-preview-tag-row">${displayTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    </section>
  `;
}

function opsSchoolMissingFields(school = {}) {
  return [
    ["英文名", school.nameEn],
    ["城市", school.cityZh || school.detailCity],
    ["申请层级", school.applicationLevel || school.admissionLevel],
    ["语言要求", school.languageRequirement || school.hskRequirement || school.englishRequirementNote],
    ["学费摘要", school.tuitionSummary || school.quickFactsTuition],
    ["招生入口", school.applicationSystemUrl || school.admissionsWebsiteUrl],
    ["来源链接", school.sourceUrl],
    ["最近核验", school.lastVerifiedAt],
  ].filter(([, value]) => !textValue(value)).map(([label]) => label);
}

function renderOpsSchoolOverviewPanel(school = {}) {
  const programs = toRecordArray(school.programs);
  const scholarships = toRecordArray(school.scholarshipsDetailed);
  const rules = toRecordArray(school.cscaRules);
  const missing = opsSchoolMissingFields(school);
  const quality = Number(school.qualityScore ?? school.dataQualityScore ?? 0);
  const status = opsLifecycleStatusLabel(school.status);
  const nextItems = [
    missing.length ? `补齐 ${missing.slice(0, 3).join("、")}${missing.length > 3 ? " 等字段" : ""}` : "基础字段已可用于学生端展示",
    programs.length ? `复核 ${programs.length} 个项目的截止日期和语言要求` : "先新增至少 1 个可申请项目",
    rules.length ? `确认 ${rules.length} 条 CSCA / 语言规则是否仍有效` : "补充学校级 CSCA 或语言规则",
    scholarships.length ? `确认 ${scholarships.length} 条学校奖学金是否关联公共奖学金库` : "按需添加学校奖学金",
  ];
  return `
    <section class="ops-school-overview-panel" data-ops-school-overview>
      <div class="ops-school-overview-main">
        <article class="ops-school-health-card">
          <span class="module-kicker">数据健康</span>
          <div class="ops-school-health-score"><strong>${escapeHtml(String(quality))}%</strong><span>${escapeHtml(status)}</span></div>
          <p>${escapeHtml(school.next || (missing.length ? "还有关键字段需要补齐后再发布。" : "学校档案可以进入发布前复核。"))}</p>
          <div class="ops-school-health-bars" aria-label="学校数据完整度">
            <span style="--value: ${Math.max(0, Math.min(100, quality))}%"></span>
          </div>
        </article>
        <article class="ops-school-action-card">
          <span class="module-kicker">下一步</span>
          <h3>${missing.length ? "先补齐学生端关键字段" : "进入发布前复核"}</h3>
          <div class="ops-school-next-list">
            ${nextItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </article>
      </div>
      <div class="ops-school-overview-strip">
        <article><span>项目</span><strong>${programs.length}</strong><small>${programs.length ? "可继续维护路线" : "Add choice 不可用"}</small></article>
        <article><span>申请规则</span><strong>${rules.length}</strong><small>${rules.length ? "已有结构化规则" : "需要补充"}</small></article>
        <article><span>奖学金</span><strong>${scholarships.length}</strong><small>${scholarships.length ? "学校级记录" : "可暂不配置"}</small></article>
        <article><span>缺失字段</span><strong>${missing.length}</strong><small>${missing.slice(0, 2).join("、") || "暂无关键缺失"}</small></article>
      </div>
      <details class="ops-school-preview-disclosure">
        <summary><span>学生端影响预览</span><small>只展示会影响公开页和 Add choice 的摘要</small></summary>
        ${renderOpsSchoolPublicPreview(school)}
      </details>
    </section>
  `;
}

function renderOpsSchoolEditorBrief(school = {}, activeTab = "overview") {
  const programs = toRecordArray(school.programs);
  const scholarships = toRecordArray(school.scholarshipsDetailed);
  const rules = toRecordArray(school.cscaRules);
  const missing = opsSchoolMissingFields(school);
  const quality = Number(school.qualityScore ?? school.dataQualityScore ?? 0);
  const tabLabel = opsSchoolEditorTabs.find(([key]) => key === activeTab)?.[1] || "概览";
  const deadline = school.deadlineSummary || programs.find((item) => item.deadlineLabel || item.deadlineDate)?.deadlineLabel || programs.find((item) => item.deadlineDate)?.deadlineDate || "待补充";
  const status = opsLifecycleStatusLabel(school.status);
  const next = missing.length
    ? `优先补齐：${missing.slice(0, 3).join("、")}${missing.length > 3 ? ` 等 ${missing.length} 项` : ""}`
    : programs.length
      ? "可继续复核项目、奖学金和来源记录。"
      : "先新增至少一个可申请项目。";
  return `
    <div class="ops-school-editor-brief" aria-label="当前学校编辑摘要">
      <div class="ops-school-editor-identity">
        <span class="status-pill ${schoolStatusTone(school.status)}">${escapeHtml(status)}</span>
        <strong>${escapeHtml([school.nameEn, school.cityZh || school.detailCity].filter(Boolean).join(" · ") || "英文名和城市待补充")}</strong>
        <small>${escapeHtml(next)}</small>
      </div>
      <div class="ops-school-editor-metrics">
        <span><small>当前分区</small><strong>${escapeHtml(tabLabel)}</strong></span>
        <span><small>质量</small><strong>${escapeHtml(String(quality))}%</strong></span>
        <span><small>项目</small><strong>${programs.length}</strong></span>
        <span><small>规则 / 奖学金</small><strong>${rules.length} / ${scholarships.length}</strong></span>
        <span><small>截止</small><strong>${escapeHtml(deadline)}</strong></span>
      </div>
    </div>
  `;
}

function renderOpsSchoolEditorTaskline(school = {}, activeTab = "overview") {
  const missing = opsSchoolMissingFields(school);
  const programs = toRecordArray(school.programs);
  const rules = toRecordArray(school.cscaRules);
  const scholarships = toRecordArray(school.scholarshipsDetailed);
  const groups = [
    {
      key: "profile",
      tabs: ["overview", "basic", "costs", "contact"],
      label: "基础档案",
      value: missing.length ? `${missing.length} 缺口` : "可发布",
      copy: missing.length ? `优先补 ${missing.slice(0, 2).join("、")}` : "身份、城市、费用和联系字段完整",
    },
    {
      key: "admissions",
      tabs: ["admissions"],
      label: "招生规则",
      value: `${rules.length} 规则`,
      copy: rules.length ? "CSCA / 语言规则已结构化" : "补充 CSCA、语言和申请入口",
    },
    {
      key: "supply",
      tabs: ["programs", "scholarships"],
      label: "项目与奖学金",
      value: `${programs.length}/${scholarships.length}`,
      copy: "项目供给、截止、学费和学校奖学金",
    },
    {
      key: "governance",
      tabs: ["source", "logs"],
      label: "来源与发布",
      value: school.lastVerifiedAt || "待核验",
      copy: "来源链接、字段映射和变更记录",
    },
  ];
  return `
    <div class="ops-school-editor-taskline" aria-label="学校编辑任务分组">
      ${groups.map((group) => `
        <article class="${group.tabs.includes(activeTab) ? "active" : ""}">
          <span>${escapeHtml(group.label)}</span>
          <strong>${escapeHtml(String(group.value))}</strong>
          <small>${escapeHtml(group.copy)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOpsSubrecordField(kind, record, field) {
  const rawValue = record[field.key] ?? "";
  const value = textValue(rawValue);
  const classes = ["ops-form-field", field.wide ? "wide" : ""].filter(Boolean).join(" ");
  const attrs = `data-ops-subrecord-field="${escapeHtml(field.key)}" data-kind="${escapeHtml(kind)}"`;
  const label = renderOpsFieldLabel(field.label);
  const sourceAttrs = opsFieldSourceAttrs(field.label);
  const inputType = field.key === "programId"
    ? "text"
    : field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ? "text"
      : field.type || "text";
  if (field.control === "checkbox") {
    const checked = rawValue === true || rawValue === "true" || rawValue === "是" || rawValue === "已核验";
    return `<label class="${classes} checkbox-field"${sourceAttrs}>${label}<input ${attrs} type="checkbox" ${checked ? "checked" : ""} /></label>`;
  }
  if (field.control === "textarea") {
    return `<label class="${classes}"${sourceAttrs}>${label}<textarea ${attrs}>${escapeHtml(value)}</textarea></label>`;
  }
  if (field.control === "select") {
    const options = (field.options || []).map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === optionValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("");
    return `<label class="${classes}"${sourceAttrs}>${label}<select ${attrs}>${options}</select></label>`;
  }
  return `<label class="${classes}"${sourceAttrs}>${label}<input ${attrs} value="${escapeHtml(value)}" type="${escapeHtml(inputType)}" ${field.required ? "required" : ""} /></label>`;
}

function renderOpsSubrecordGroupedFields(kind, record, fields, groups) {
  if (!groups?.length) return `<div class="ops-form-grid compact">${fields.map((field) => renderOpsSubrecordField(kind, record, field)).join("")}</div>`;
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  return groups.map(([title, keys]) => {
    const groupFields = keys.map((key) => fieldsByKey.get(key)).filter(Boolean);
    return `
      <section class="ops-subrecord-field-group">
        <h3>${escapeHtml(title)}</h3>
        <div class="ops-form-grid compact">${groupFields.map((field) => renderOpsSubrecordField(kind, record, field)).join("")}</div>
      </section>
    `;
  }).join("");
}

function renderOpsSchoolProgramRecordSignals(record = {}) {
  const subjects = splitOpsTextList(record.displaySubjects).join(" / ") || "从 CSCA 科目或项目要求生成";
  const signals = [
    ["学校租户", record.schoolId || "当前学校", "SchoolProgram.schoolId"],
    ["核验状态", record.isVerified ? "已核验" : "随来源记录复核", "SchoolProgram.isVerified"],
    ["奖学金信号", record.hasScholarship ? "有" : "按奖学金文本/关联记录推导", "SchoolProgram.hasScholarship"],
    ["学生端标签", record.badgeText || "从项目截止/资助/语言等信息生成", "SchoolProgram.badgeText"],
    ["学生端学费", record.displayTuition || record.tuitionText || "从 tuitionAmount / tuitionCurrency / tuitionPeriod 生成", "SchoolProgram.displayTuition"],
    ["学生端科目标签", subjects, "SchoolProgram.displaySubjects"],
    ["展示分组", [record.displayGroup, record.displayGroupLabel].filter(Boolean).join(" / ") || "从学科方向生成", "SchoolProgram.displayGroupLabel"],
  ];
  return `
    <section class="ops-subrecord-readonly" data-ops-school-program-readonly>
      <div>
        <strong>只读项目记录字段</strong>
        <span>系统会保留学校归属、核验状态和学生端展示标签；本区只编辑项目的可维护字段。</span>
      </div>
      <div class="ops-readonly-signal-grid">
        ${signals.map(([label, value, field]) => `<article data-source-field="${escapeHtml(field)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`).join("")}
      </div>
    </section>
  `;
}

function renderOpsSchoolCscaRuleRecordSignals(record = {}) {
  const programs = splitOpsTextList(record.applicablePrograms).join(" / ") || "按 programId 或规则范围判断";
  const signals = [
    ["学校租户", record.schoolId || "当前学校", "SchoolCscaRule.schoolId"],
    ["派生适用项目", programs, "SchoolCscaRule.applicablePrograms"],
    ["核验状态", record.isVerified ? "已核验" : "随来源记录复核", "SchoolCscaRule.isVerified"],
  ];
  return `
    <section class="ops-subrecord-readonly" data-ops-school-csca-readonly>
      <div>
        <strong>只读规则字段</strong>
        <span>系统会保留学校归属和适用项目推导；本区只编辑 CSCA 规则的可维护字段。</span>
      </div>
      <div class="ops-readonly-signal-grid">
        ${signals.map(([label, value, field]) => `<article data-source-field="${escapeHtml(field)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`).join("")}
      </div>
    </section>
  `;
}

function renderOpsSchoolScholarshipRecordSignals(record = {}) {
  const signals = [
    ["学校租户", record.schoolId || "当前学校", "SchoolScholarship.schoolId"],
    ["公共奖学金关联", record.scholarshipSlug || "未关联", "SchoolScholarship.scholarshipSlug"],
    ["截止日期", record.deadlineDate || record.deadlineLabel || "从项目/公共奖学金记录推导", "SchoolScholarship.deadlineDate"],
    ["申请轮次", record.applicationRound || "从项目/公共奖学金记录推导", "SchoolScholarship.applicationRound"],
    ["CSC 标记", record.isCsc ? "是" : "否", "SchoolScholarship.isCsc"],
    ["核验状态", record.isVerified ? "已核验" : "随来源记录复核", "SchoolScholarship.isVerified"],
  ];
  return `
    <section class="ops-subrecord-readonly compact-strip" data-ops-school-scholarship-readonly>
      <div>
        <strong>只读记录字段</strong>
        <span>系统会保留学校归属、公共奖学金关联和截止信息；本区只编辑学校奖学金的可维护字段。</span>
      </div>
      <div class="ops-readonly-signal-grid">
        ${signals.map(([label, value, field]) => `<article data-source-field="${escapeHtml(field)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`).join("")}
      </div>
    </section>
  `;
}

function renderOpsSubrecordEditor(kind, record, fields, title, subtitle, groups = null) {
  const openAttr = record.status === "draft" ? " open" : "";
  return `
    <details class="ops-subrecord editable ops-subrecord-${escapeHtml(kind)} ops-subrecord-disclosure" data-ops-subrecord data-kind="${escapeHtml(kind)}" data-record-id="${escapeHtml(record.id)}" data-record-version="${escapeHtml(record.version || 1)}"${openAttr}>
      <summary class="ops-subrecord-head">
        <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
        <span class="status-pill ${schoolStatusTone(record.status)}">${escapeHtml(opsLifecycleStatusLabel(record.status))}</span>
      </summary>
      <div class="ops-subrecord-body">
        <div class="ops-subrecord-actions">
          <button class="secondary-action micro" data-ops-subrecord-save type="button">保存此条</button>
          <button class="secondary-action micro" data-ops-subrecord-archive type="button" ${opsLifecycleStatusArchived(record.status) ? "disabled" : ""}>归档此条</button>
        </div>
        ${kind === "rules" ? renderOpsSchoolCscaRuleRecordSignals(record) : ""}
        ${kind === "programs" ? renderOpsSchoolProgramRecordSignals(record) : ""}
        ${kind === "scholarships" ? renderOpsSchoolScholarshipRecordSignals(record) : ""}
        <div class="ops-subrecord-fields">${renderOpsSubrecordGroupedFields(kind, record, fields, groups)}</div>
      </div>
    </details>
  `;
}

function renderOpsSubrecordEditorSafe(kind, record, fields, title, subtitle, groups = null) {
  try {
    if (!isPlainRecord(record)) throw new Error("Invalid subrecord");
    return renderOpsSubrecordEditor(kind, record, fields, title, subtitle, groups);
  } catch (error) {
    console.error(`CUAC ops ${kind} subrecord render failed`, error);
    return `
      <article class="ops-subrecord editable ops-error-state" data-ops-subrecord data-kind="${escapeHtml(kind)}" data-record-id="">
        <div class="ops-subrecord-head">
          <div><strong>子记录需要修复</strong><span>这条本地预览记录格式异常，已隔离，不影响新增或编辑其他记录。</span></div>
        </div>
      </article>
    `;
  }
}

function renderOpsSchoolRecordSignals(school = {}) {
  const missing = splitOpsTextList(school.missingFields).join(" / ") || "暂无";
  const subjects = splitOpsTextList(school.cscaSubjects).join(" / ") || "由 CSCA 规则或项目记录决定";
  const derived = splitOpsTextList(school.derivedTags).join(" / ") || "按公开页规则生成";
  const signals = [
    ["学校 ID", school.id || "新学校", "AdminSchoolSummary.id"],
    ["版本", school.version || 1, "AdminSchoolSummary.version"],
    ["排名", school.rank || "公开详情字段，由学校档案保留", "School.rank"],
    ["申请层级", school.applicationLevel || school.admissionLevel || "由项目层级汇总", "School.applicationLevel"],
    ["CSCA 科目", subjects, "School.cscaSubjects"],
    ["英语要求", school.englishRequirement || "由语言要求/项目要求汇总", "School.englishRequirement"],
    ["截止摘要", school.deadlineSummary || "由 SchoolProgram.deadlineDate 汇总", "School.deadlineSummary"],
    ["来源标签", school.sourceLabel || "来源详情记录", "School.sourceLabel"],
    ["来源备注", school.sourceNote || "来源详情记录", "School.sourceNote"],
    ["核验状态", school.verificationStatus || "pending", "AdminSchoolSummary.verificationStatus"],
    ["质量分", school.qualityScore ?? school.dataQualityScore ?? "待计算", "School.qualityScore"],
    ["完整度", school.completenessLabel || "由 missingFields 计算", "AdminSchoolSummary.completenessLabel"],
    ["缺失字段", missing, "AdminSchoolSummary.missingFields"],
    ["派生标签", derived, "AdminSchoolDetail.derivedTags"],
    ["创建/更新", [school.createdAt, school.updatedAt].filter(Boolean).join(" / ") || "由记录元数据生成", "School.updatedAt"],
  ];
  return `
    <section class="ops-subrecord-readonly" data-ops-school-record-readonly>
      <div>
        <strong>只读学校记录字段</strong>
        <span>系统会保留记录 ID、版本、质量分和公开页派生信息；本区只编辑学校档案的可维护字段。</span>
      </div>
      <div class="ops-readonly-signal-grid">
        ${signals.map(([label, value, field]) => `<article data-source-field="${escapeHtml(field)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`).join("")}
      </div>
    </section>
  `;
}

function renderOpsSchoolCard(school, selectedSchoolId, students = []) {
  const selected = selectedSchoolId === school.id;
  const missing = opsSchoolMissingFields(school);
  const quality = Number(school.qualityScore ?? school.dataQualityScore ?? 0);
  const programs = toArray(school.programs).length;
  const stats = buildOpsSchoolWorkspaceStats([school], students, school);
  const attention = missing.length
    ? `${missing.slice(0, 2).join("、")}待补${missing.length > 2 ? ` +${missing.length - 2}` : ""}`
    : school.next || "可进入复核";
  return `
    <article class="ops-school-card ops-school-list-row ${selected ? "selected" : ""}">
      <div class="ops-school-card-head">
        <div class="ops-entity-cell">
          <strong>${escapeHtml(school.nameZh)}</strong>
          <span>${escapeHtml(school.nameEn || "英文名待补充")} · ${escapeHtml(school.cityZh || "城市待补充")}</span>
        </div>
        <span class="status-pill ${schoolStatusTone(school.status)}">${escapeHtml(opsLifecycleStatusLabel(school.status))}</span>
      </div>
      <div class="ops-school-row-meta">
        <span><strong>${escapeHtml(String(programs))}</strong> 项目</span>
        <span><strong>${escapeHtml(String(stats.selectedChoices))}</strong> 选择</span>
        <span><strong>${escapeHtml(`${stats.processedChoices}/${stats.sentChoices}`)}</strong> 处理</span>
        <span><strong>${escapeHtml(school.deadlineSummary || "待补充")}</strong> 截止</span>
        <span><strong>${escapeHtml(String(quality))}%</strong> 质量</span>
      </div>
      <div class="ops-school-card-foot">
        <div><span>${escapeHtml(school.owner || "目录团队")}</span><small>${escapeHtml(attention)}</small></div>
        <div class="ops-school-card-actions" aria-label="学校记录操作">
          <button class="secondary-action micro" data-ops-school-edit data-ops-action="edit-school" data-school-id="${escapeHtml(school.id)}" type="button">编辑</button>
          <button class="secondary-action micro" data-ops-school-open-view="preview" data-school-id="${escapeHtml(school.id)}" type="button">预览</button>
          <button class="secondary-action micro" data-ops-school-open-view="model" data-school-id="${escapeHtml(school.id)}" type="button">字段</button>
        </div>
      </div>
    </article>
  `;
}

function renderOpsSchoolViewTabs(activeView, selectedSchool, activeTab, students = []) {
  const viewCopy = {
    catalog: "覆盖、缺口、筛选",
    edit: "档案、规则、项目",
    preview: "学生端可见内容",
    model: "来源、映射、审计",
  };
  return `
    <div class="ops-school-view-shell-head">
      <nav class="ops-school-view-tabs" aria-label="学校数据工作视图">
        ${opsSchoolViews.map(([key, label]) => `<button class="${activeView === key ? "active" : ""}" data-ops-school-view="${escapeHtml(key)}" type="button" aria-selected="${activeView === key ? "true" : "false"}"><span>${escapeHtml(label)}</span><small>${escapeHtml(viewCopy[key] || "")}</small></button>`).join("")}
      </nav>
      ${renderOpsSchoolSelectedTaskStrip(activeView, selectedSchool, activeTab, students)}
    </div>
  `;
}

function renderOpsSchoolSelectedTaskStrip(activeView, selectedSchool, activeTab, students = []) {
  const activeViewLabel = activeView === "edit"
    ? (opsSchoolEditorTabs.find(([key]) => key === activeTab)?.[1] || "概览")
    : (opsSchoolViews.find(([key]) => key === activeView)?.[1] || "目录");
  if (!selectedSchool) {
    return `
      <section class="ops-school-task-strip" data-ops-school-selected-task>
        <div class="ops-school-task-copy">
          <span class="module-kicker">当前任务</span>
          <strong>先选择一所学校</strong>
          <small>${escapeHtml(activeViewLabel)} · 新增或导入后可继续编辑、预览和复核字段。</small>
        </div>
      </section>
    `;
  }
  const missing = opsSchoolMissingFields(selectedSchool);
  const quality = Number(selectedSchool.qualityScore ?? selectedSchool.dataQualityScore ?? 0);
  const programs = toArray(selectedSchool.programs).length;
  const stats = buildOpsSchoolWorkspaceStats([selectedSchool], students, selectedSchool);
  const selectedLabel = [selectedSchool.nameZh, selectedSchool.cityZh || selectedSchool.region].filter(Boolean).join(" · ") || "当前学校";
  const nextAction = missing.length
    ? `先补齐 ${missing.slice(0, 2).join("、")}${missing.length > 2 ? ` 等 ${missing.length} 项` : ""}`
    : selectedSchool.next || "可进入发布前复核";
  return `
    <section class="ops-school-task-strip" data-ops-school-selected-task data-school-id="${escapeHtml(selectedSchool.id)}">
      <div class="ops-school-task-copy">
        <span class="module-kicker">当前学校任务</span>
        <strong>${escapeHtml(selectedLabel)}</strong>
        <small>${escapeHtml(activeViewLabel)} · ${escapeHtml(nextAction)}</small>
      </div>
      <div class="ops-school-task-metrics" aria-label="当前学校数据状态">
        <span><strong>${escapeHtml(String(programs))}</strong> 项目</span>
        <span><strong>${escapeHtml(String(stats.selectedChoices))}</strong> 学生选择</span>
        <span><strong>${escapeHtml(`${stats.processedChoices}/${stats.sentChoices}`)}</strong> 处理 / 发送</span>
        <span><strong>${escapeHtml(String(quality))}%</strong> 质量</span>
        <span><strong>${escapeHtml(String(missing.length))}</strong> 缺字段</span>
      </div>
    </section>
  `;
}

function renderOpsSchoolViewPanel(view, activeView, html) {
  return `<section class="ops-school-view-panel" data-ops-school-view-panel="${escapeHtml(view)}" ${activeView === view ? "" : "hidden"}>${html}</section>`;
}

function opsChoiceMatchesSchool(choice = {}, school = {}) {
  const schoolNames = [school.nameZh, school.nameEn, school.slug, school.id]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const haystack = [choice.school, choice.schoolName, choice.schoolId, choice.university, choice.program]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  return schoolNames.some((name) => haystack.includes(name));
}

function buildOpsSchoolWorkspaceStats(allSchools = [], students = [], selectedSchool = null) {
  const schools = toRecordArray(allSchools);
  const allChoices = toRecordArray(students).flatMap((student) => toRecordArray(student.choices).map((choice) => ({ ...choice, student })));
  const selectedChoices = selectedSchool ? allChoices.filter((entry) => opsChoiceMatchesSchool(entry, selectedSchool)) : allChoices;
  const sentPattern = /已发送|需首次联系|等待学校处理|已接收|学校已联系|已查看|已处理/;
  const processedPattern = /学校已联系|已接收|已处理|已查看/;
  const sentChoices = selectedChoices.filter((entry) => sentPattern.test(`${entry.sent || ""} ${entry.tenantStatus || ""}`));
  const processedChoices = selectedChoices.filter((entry) => processedPattern.test(`${entry.tenantStatus || ""} ${entry.sent || ""}`));
  const selectedStudents = new Set(selectedChoices.map((entry) => entry.student?.id).filter(Boolean));
  const paidSelectedStudents = new Set(selectedChoices.filter((entry) => entry.student?.paymentState === "paid").map((entry) => entry.student?.id).filter(Boolean));
  return {
    schools: schools.length,
    cities: new Set(schools.map((school) => school.cityZh || school.city || school.region).filter(Boolean)).size,
    programs: schools.reduce((sum, school) => sum + toRecordArray(school.programs).length, 0),
    scholarships: schools.reduce((sum, school) => sum + toRecordArray(school.scholarshipsDetailed).length, 0),
    published: schools.filter((school) => opsLifecycleStatusMatches(school.status, "published")).length,
    review: schools.filter((school) => !opsLifecycleStatusArchived(school.status) && !opsLifecycleStatusMatches(school.status, "published")).length,
    missing: schools.filter((school) => opsSchoolMissingFields(school).length).length,
    cscaSchools: schools.filter((school) => school.cscaRequired || toRecordArray(school.cscaRules).length).length,
    averageQuality: schools.length ? Math.round(schools.reduce((sum, school) => sum + Number(school.qualityScore || 0), 0) / schools.length) : 0,
    selectedChoices: selectedChoices.length,
    selectedStudents: selectedStudents.size,
    paidSelectedStudents: paidSelectedStudents.size,
    sentChoices: sentChoices.length,
    processedChoices: processedChoices.length,
  };
}

function renderOpsSchoolWorkspaceCommand(allSchools = [], schoolRows = [], students = [], selectedSchool = null, activeView = "catalog") {
  const stats = buildOpsSchoolWorkspaceStats(allSchools, students, selectedSchool);
  const globalStats = buildOpsSchoolWorkspaceStats(allSchools, students);
  const selectedLabel = selectedSchool
    ? [selectedSchool.nameZh, selectedSchool.cityZh || selectedSchool.region].filter(Boolean).join(" · ")
    : "未选择学校";
  const activeLabel = opsSchoolViews.find(([key]) => key === activeView)?.[1] || "学校目录";
  const scopeCopy = selectedSchool
    ? `${stats.paidSelectedStudents} 名付费学生涉及当前学校`
    : `${globalStats.selectedStudents} 名学生有学校选择`;
  const cards = [
    { label: "学校覆盖", value: stats.schools, copy: `${stats.cities} 个城市 / 地区`, tone: "coverage" },
    { label: "项目供给", value: stats.programs, copy: `${stats.scholarships} 条学校奖学金`, tone: "programs" },
    { label: "数据缺口", value: stats.missing, copy: `${stats.review} 所待审核`, tone: stats.missing ? "warn" : "ok" },
    { label: "申请承接", value: `${stats.processedChoices}/${stats.sentChoices}`, copy: scopeCopy, tone: "applications" },
  ];
  return `
    <section class="ops-school-workspace-command" aria-label="学校数据工作台摘要">
      <div class="ops-school-workspace-copy">
        <span class="module-kicker">学校数据工作台</span>
        <h3>${escapeHtml(activeLabel)} · ${escapeHtml(selectedLabel)}</h3>
        <p>先看学校供给能不能接住学生需求，再处理目录质量、项目规则、公开预览和字段审计。</p>
      </div>
      <div class="ops-school-workspace-metrics">
        ${cards.map((card) => `
          <article class="${escapeHtml(card.tone)}">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(String(card.value))}</strong>
            <small>${escapeHtml(card.copy)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOpsSchoolCatalogInsights(schoolRows = [], allSchools = schoolRows, students = []) {
  const rows = toRecordArray(schoolRows);
  const stats = buildOpsSchoolWorkspaceStats(rows, students);
  const cityCount = new Set(rows.map((school) => school.cityZh || school.city || school.region).filter(Boolean)).size;
  const programCount = rows.reduce((sum, school) => sum + toRecordArray(school.programs).length, 0);
  const scholarshipCount = rows.reduce((sum, school) => sum + toRecordArray(school.scholarshipsDetailed).length, 0);
  const missingFieldSchools = rows.filter((school) => opsSchoolMissingFields(school).length);
  const cscaSchools = rows.filter((school) => school.cscaRequired || toRecordArray(school.cscaRules).length);
  const publishedSchools = rows.filter((school) => opsLifecycleStatusMatches(school.status, "published"));
  const avgQuality = rows.length
    ? Math.round(rows.reduce((sum, school) => sum + Number(school.qualityScore || 0), 0) / rows.length)
    : 0;
  const reviewSchools = rows.filter((school) => !opsLifecycleStatusArchived(school.status) && !opsLifecycleStatusMatches(school.status, "published"));
  const cards = [
    { label: "目录覆盖", value: rows.length, note: `${cityCount} 个城市 / 地区`, tone: "coverage" },
    { label: "项目供给", value: programCount, note: `${scholarshipCount} 条学校奖学金`, tone: "programs" },
    { label: "质量缺口", value: missingFieldSchools.length, note: `${reviewSchools.length} 所待审核`, tone: missingFieldSchools.length ? "warn" : "ok" },
    { label: "申请承接", value: `${stats.processedChoices}/${stats.sentChoices}`, note: `${publishedSchools.length} 所已发布 · ${avgQuality}% 平均质量`, tone: "applications" },
  ];
  return `
    <section class="ops-school-catalog-insights" aria-label="学校目录健康摘要">
      ${cards.map((card) => `
        <article class="${escapeHtml(card.tone)}">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(String(card.value))}</strong>
          <small>${escapeHtml(card.note)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOpsSchoolCatalogPanel(schoolRows, selectedSchoolId, opsState, allSchools = schoolRows, students = []) {
  return `
    ${renderOpsSchoolCatalogInsights(schoolRows, allSchools, students)}
    <section class="ops-school-catalog-command" aria-label="学校数据操作">
      <div class="ops-school-command-copy">
        <span class="module-kicker">目录维护</span>
        <strong>先补齐学校，再维护项目、奖学金和申请要求</strong>
        <small>默认先看目录覆盖和质量缺口；新增或导入只在需要时展开，保存后写入学校变更记录。</small>
      </div>
      <div class="ops-school-command-actions">
        <button class="primary-action micro" data-ops-school-create-toggle type="button">${opsState.schoolCreateOpen ? "收起新增" : "新增学校"}</button>
        <button class="secondary-action micro" data-ops-school-import-toggle type="button">${opsState.schoolImportOpen ? "收起导入" : "导入数据"}</button>
        <button class="secondary-action micro" data-ops-action="review-school-data" type="button">数据队列</button>
      </div>
    </section>
    <div class="ops-school-tools">
      <label><span>搜索学校</span><input data-ops-school-search value="${escapeHtml(opsState.schoolSearch || "")}" placeholder="中文名、英文名、城市" /></label>
      <label><span>状态</span><select data-ops-school-filter><option value="all">全部状态</option><option value="published" ${opsLifecycleStatusMatches(opsState.schoolFilter, "published") ? "selected" : ""}>已发布</option><option value="draft" ${opsLifecycleStatusMatches(opsState.schoolFilter, "draft") ? "selected" : ""}>草稿 / 需审核</option><option value="archived" ${opsLifecycleStatusMatches(opsState.schoolFilter, "archived") ? "selected" : ""}>已归档</option></select></label>
      <button class="secondary-action" data-ops-school-apply-filter type="button">筛选</button>
    </div>
    ${renderOpsSchoolCreatePanel(opsState)}
    ${renderOpsSchoolImportPanel(opsState)}
    <div class="ops-school-catalog-grid">
      <div class="ops-management-table">
        ${schoolRows.map((school) => renderOpsSchoolCard(school, selectedSchoolId, students)).join("") || `<p class="ops-empty">没有匹配的学校。调整筛选条件或新增学校草稿。</p>`}
      </div>
    </div>
  `;
}

function renderOpsSchoolPreviewPanel(school) {
  if (!school) return `<p class="ops-empty">暂无学校可预览。可以先新增学校草稿。</p>`;
  const missing = opsSchoolMissingFields(school);
  const programs = toRecordArray(school.programs);
  const scholarships = toRecordArray(school.scholarshipsDetailed);
  const publicChecks = [
    ["公开身份", school.nameZh && school.nameEn && (school.cityZh || school.region) ? "完整" : "待补", school.nameEn || "英文名待补充"],
    ["招生入口", school.admissionsWebsiteUrl || school.applicationSystemUrl ? "可跳转" : "待补", school.admissionsWebsiteUrl || school.applicationSystemUrl || "缺少公开入口"],
    ["项目路线", programs.length ? `${programs.length} 条` : "待补", programs.map((item) => item.nameZh || item.nameEn).filter(Boolean).slice(0, 2).join("、") || "暂无项目"],
    ["奖学金提示", scholarships.length ? `${scholarships.length} 条` : "可选", scholarships.map((item) => item.name).filter(Boolean).slice(0, 2).join("、") || "暂无学校级奖学金"],
  ];
  return `
    <div class="ops-school-preview-workspace ops-school-preview-grid">
      <div class="ops-school-preview-main">
        ${renderOpsSchoolPublicPreview(school)}
      </div>
      <aside class="ops-school-preview-checks" aria-label="公开字段检查">
        <span class="module-kicker">公开字段检查</span>
        <h3>学生端会看到什么</h3>
        <p>这里只检查会进入学校详情页、申请选择器和 Add choice 的字段，内部来源和审计留在字段页。</p>
        <div class="ops-school-preview-check-list">
          ${publicChecks.map(([label, value, copy]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(copy)}</small></article>`).join("")}
        </div>
        <div class="ops-editor-note ${missing.length ? "warn" : ""}">
          <strong>${missing.length ? `${missing.length} 个字段不会公开完整` : "公开字段已就绪"}</strong>
          <span>${escapeHtml(missing.slice(0, 3).join("、") || "可以继续检查学生端文案和项目排序。")}</span>
        </div>
      </aside>
    </div>
  `;
}

function renderOpsSchoolModelPanel(school) {
  if (!school) return `<p class="ops-empty">暂无学校字段记录。可以先新增学校草稿。</p>`;
  const changeLogs = readOpsSchoolChangeLogs(readOpsAdminState(), school.id);
  const missing = opsSchoolMissingFields(school);
  const quality = Number(school.qualityScore ?? school.dataQualityScore ?? 0);
  const sourceFresh = school.lastVerifiedAt || school.updatedAt || "待核验";
  const fields = ["AdminSchoolSummary.id", "AdminSchoolSummary.version", "School.nameZh", "School.nameEn", "School.cityZh", "School.citySlug", "School.region", "School.rank", "School.schoolType", "School.status", "AdminSchoolSummary.verificationStatus", "School.applicationLevel", "School.cscaRequired", "School.cscaSubjects", "School.cscaRequirement", "School.languageRequirement", "School.englishRequirement", "School.deadlineSummary", "School.tuitionSummary", "School.applicationFee", "AdminSchoolDetail.officialWebsiteUrl", "AdminSchoolDetail.admissionsWebsiteUrl", "School.contactTel", "School.contactEmail", "School.contactAddress", "School.yearEstablished", "School.studentCount", "School.studentsServed", "School.under18GuardianRequired", "School.under18RequirementNote", "School.sourceUrl", "School.sourceLabel", "School.sourceNote", "School.qualityScore", "AdminSchoolSummary.completenessLabel", "AdminSchoolSummary.missingFields", "SchoolProgram.deadlineDate", "SchoolCscaRule.cscaSubjects", "SchoolScholarship.amountText"];
  return `
    <div class="ops-school-model-grid">
      <article class="ops-school-model-card">
        <span class="module-kicker">CSCAlite 对齐</span>
        <h3>学校字段、来源与审计</h3>
        <p>这里集中检查字段覆盖率、来源可信度和变更记录。日常编辑不需要在表单里反复看到这些字段细节。</p>
      </article>
      <section class="ops-school-governance-strip" aria-label="学校数据治理摘要">
        <article><span>字段覆盖</span><strong>${escapeHtml(String(quality))}%</strong><small>${missing.length ? `${missing.length} 个缺口` : "暂无关键缺口"}</small></article>
        <article><span>来源核验</span><strong>${escapeHtml(sourceFresh)}</strong><small>${escapeHtml(school.sourceLabel || "来源待补充")}</small></article>
        <article><span>变更审计</span><strong>${escapeHtml(String(changeLogs.length))}</strong><small>最近学校级操作</small></article>
      </section>
      ${renderOpsSchoolRecordSignals(school)}
      ${renderOpsFieldMap("旧项目字段映射", "按需展开，接口定型和数据迁移时检查", fields)}
      <section class="ops-school-audit-panel">
        <div class="section-head compact"><div><span class="module-kicker">变更审计</span><h3>学校变更记录</h3></div><span class="status-pill">${escapeHtml(String(changeLogs.length))} 条</span></div>
        ${renderOpsSchoolChangeLogs(changeLogs)}
      </section>
    </div>
  `;
}

function renderSchoolEditorPanel(school, tab) {
  if (!school) return "";
  school = normalizeOpsSchoolRecord(school);
  const activeTab = normalizeOpsSchoolTab(tab);
  const programs = toRecordArray(school.programs);
  const rules = toRecordArray(school.cscaRules);
  const scholarships = toRecordArray(school.scholarshipsDetailed);
  const changeLogs = readOpsSchoolChangeLogs(readOpsAdminState(), school.id);
  const countByTab = { programs: programs.length, scholarships: scholarships.length, logs: changeLogs.length };
  const tabButtons = opsSchoolEditorTabs.map(([key, label]) => `<button class="${activeTab === key ? "active" : ""}" data-ops-school-tab="${escapeHtml(key)}" type="button" role="tab" aria-selected="${activeTab === key ? "true" : "false"}">${escapeHtml(label)}${countByTab[key] ? ` <small>${countByTab[key]}</small>` : ""}</button>`).join("");
  const panels = {
    overview: `
      ${renderOpsSchoolOverviewPanel(school)}
    `,
    basic: `
      ${renderSchoolFieldGroup("basic", school)}
    `,
    admissions: `
      ${renderSchoolFieldGroup("admissions", school)}
      <div class="ops-subrecords">
        <div class="section-head compact"><div><span class="module-kicker">CSCA 规则</span><h3>学校级规则</h3></div><button class="secondary-action" data-ops-school-add-rule type="button">新增规则</button></div>
        ${rules.length ? rules.map((rule) => renderOpsSubrecordEditorSafe("rules", rule, opsSchoolSubrecordFields.rules, rule.title || "新规则草稿", `${rule.category || "general"} · ${rule.scope || "全校"} · ${inlineValue(rule.cscaSubjects, "科目待补充")}`)).join("") : `<p class="ops-empty">还没有结构化 CSCA 规则。</p>`}
      </div>
    `,
    costs: `
      ${renderSchoolFieldGroup("costs", school)}
    `,
    contact: `
      ${renderSchoolFieldGroup("contact", school)}
    `,
    programs: `
      <div class="section-head compact"><div><span class="module-kicker">项目记录</span><h3>项目路线</h3></div><button class="secondary-action" data-ops-school-add-program type="button">新增项目</button></div>
      <div class="ops-subrecords">
        ${programs.map((program) => renderOpsSubrecordEditorSafe("programs", program, opsSchoolSubrecordFields.programs, program.nameZh || "新项目草稿", `${program.nameEn || "英文名待补充"} · ${program.degreeLevel || "学位待补充"} · ${program.teachingLanguage || "授课语言待补充"}`, opsSchoolSubrecordFieldGroups.programs)).join("") || `<p class="ops-empty">还没有项目。可以先新增一条项目草稿。</p>`}
      </div>
    `,
    scholarships: `
      <div class="section-head compact">
        <div><span class="module-kicker">学校奖学金记录</span><h3>学校附属奖学金</h3></div>
        <div class="inline-actions">
          <button class="secondary-action" data-ops-open-public-scholarships type="button">打开公共奖学金库</button>
          <button class="secondary-action" data-ops-school-add-scholarship type="button">新增学校奖学金</button>
        </div>
      </div>
      <div class="ops-subrecords">
        ${scholarships.map((item) => renderOpsSubrecordEditorSafe("scholarships", item, opsSchoolSubrecordFields.scholarships, item.name || "奖学金草稿", `${inlineValue(item.type, "general")} · ${inlineValue(item.applicableDegree, "学位待补充")} · ${inlineValue(item.applicableProgram, "项目范围待补充")}`, opsSchoolSubrecordFieldGroups.scholarships)).join("") || `<p class="ops-empty">还没有结构化学校奖学金。</p>`}
      </div>
    `,
    source: `
      ${renderSchoolFieldGroup("source", school)}
      ${renderOpsSchoolRecordSignals(school)}
      <div class="ops-change-log"><article><span>当前草稿</span><strong>字段修改会写入变更审计。</strong></article><article><span>对齐说明</span><strong>学校、项目、奖学金和来源字段按 CSCAlite 结构维护。</strong></article></div>
    `,
    logs: `
      <div class="section-head compact"><div><span class="module-kicker">变更审计</span><h3>学校变更记录</h3></div><span class="status-pill">${escapeHtml(String(changeLogs.length))} 条</span></div>
      ${renderOpsSchoolChangeLogs(changeLogs)}
    `,
  };
  return `
    <article class="ops-record-editor ops-school-editor" data-ops-school-editor data-school-id="${escapeHtml(school.id)}" data-school-version="${escapeHtml(school.version || 1)}">
      <div class="section-head ops-school-editor-head">
        <div><span class="module-kicker">学校编辑器</span><h2>${escapeHtml(school.nameZh || "新学校草稿")}</h2></div>
        <div class="inline-actions"><button class="secondary-action" data-ops-school-archive type="button">归档</button><button class="primary-action" data-ops-school-save type="button">保存修改</button></div>
      </div>
      ${renderOpsSchoolEditorBrief(school, activeTab)}
      ${renderOpsSchoolEditorTaskline(school, activeTab)}
      <div class="ops-editor-alert-stack">
        <div class="ops-editor-note warn" data-ops-school-unsaved-warning hidden>
          <strong>当前学校有未保存改动。</strong>
          <span>保存后会刷新学校目录和变更记录；切换学校或分区前需要确认。</span>
        </div>
        <div class="ops-editor-note danger" data-ops-school-switch-confirm hidden>
          <strong>切换学校前确认</strong>
          <span data-ops-school-switch-copy>当前学校字段已修改，继续会放弃这些本地改动。</span>
          <div class="inline-actions">
            <button class="secondary-action" data-ops-school-discard-switch type="button">放弃改动并继续</button>
            <button class="primary-action" data-ops-school-save type="button">先保存修改</button>
          </div>
        </div>
      </div>
      <nav class="ops-editor-tabs ops-school-editor-tabs" aria-label="学校编辑分区" role="tablist">${tabButtons}</nav>
      <div class="ops-editor-panel">${panels[activeTab] || panels.overview}</div>
    </article>
  `;
}

function parseOpsSubrecordValue(key, value) {
  if (["cscaSubjects", "displaySubjects", "applicablePrograms"].includes(key)) {
    return String(value || "").split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
  }
  if (key === "programId" || key === "schoolId") {
    const text = String(value || "").trim();
    if (!text) return "";
    return /^\d+$/.test(text) ? Number(text) : text;
  }
  if (["sortOrder", "tuitionAmount", "version"].includes(key)) {
    return value === "" ? "" : Number(value);
  }
  return value;
}

function collectOpsSchoolSubrecords(editor) {
  const next = {};
  editor.querySelectorAll("[data-ops-subrecord]").forEach((recordEl) => {
    const { kind, record } = collectOpsSingleSubrecord(recordEl);
    if (!kind || !record) return;
    if (!next[kind]) next[kind] = [];
    next[kind].push(record);
  });
  const result = {};
  if (next.programs) result.programs = next.programs;
  if (next.rules) result.cscaRules = next.rules;
  if (next.scholarships) result.scholarshipsDetailed = next.scholarships;
  return result;
}

function collectOpsSingleSubrecord(recordEl) {
  const kind = recordEl?.dataset.kind;
  const id = recordEl?.dataset.recordId;
  if (!kind || !id) return { kind: "", record: null };
  const record = { id };
  recordEl.querySelectorAll("[data-ops-subrecord-field]").forEach((field) => {
    const key = field.dataset.opsSubrecordField;
    if (!key) return;
    record[key] = parseOpsSubrecordValue(key, field.type === "checkbox" ? field.checked : field.value);
  });
  if (recordEl?.dataset.recordVersion) record.expectedVersion = Number(recordEl.dataset.recordVersion) || 1;
  return { kind, record };
}

function opsSubrecordStorageKey(kind) {
  return { programs: "programs", rules: "cscaRules", scholarships: "scholarshipsDetailed" }[kind] || "";
}

function opsSubrecordActionLabel(kind, action) {
  const noun = { programs: "项目", rules: "CSCA 规则", scholarships: "学校奖学金" }[kind] || "子记录";
  return action === "archive" ? `已归档${noun}` : `已保存${noun}`;
}

function mergeOpsSubrecordArray(existingRecords, editedRecords) {
  const existingById = new Map(toRecordArray(existingRecords).map((item) => [String(item.id), item]));
  return editedRecords.map((item) => ({ ...(existingById.get(String(item.id)) || {}), ...item }));
}

function applyOpsSchoolSubrecords(school, subrecords) {
  const next = {};
  if (subrecords.programs) next.programs = mergeOpsSubrecordArray(school.programs, subrecords.programs);
  if (subrecords.cscaRules) next.cscaRules = mergeOpsSubrecordArray(school.cscaRules, subrecords.cscaRules);
  if (subrecords.scholarshipsDetailed) next.scholarshipsDetailed = mergeOpsSubrecordArray(school.scholarshipsDetailed, subrecords.scholarshipsDetailed);
  return next;
}

function opsSchoolConflictCopy(kind = "school") {
  const noun = { school: "学校", programs: "项目", rules: "CSCA 规则", scholarships: "学校奖学金" }[kind] || "学校记录";
  return `${noun}已被其他管理员更新，请刷新后再继续。`;
}

function assertOpsSchoolExpectedVersion(state, schoolId, expectedVersion) {
  const current = readOpsSchoolRecords(state).find((school) => String(school.id) === String(schoolId));
  if (!current) return null;
  const currentVersion = Number(current.version || 1);
  const expected = Number(expectedVersion || currentVersion);
  if (Number.isFinite(expected) && currentVersion !== expected) {
    const error = new Error(opsSchoolConflictCopy("school"));
    error.code = "VERSION_CONFLICT";
    error.currentVersion = currentVersion;
    throw error;
  }
  return current;
}

function findOpsSchoolSubrecord(state, schoolId, kind, recordId) {
  const school = readOpsSchoolRecords(state).find((item) => String(item.id) === String(schoolId));
  const storageKey = opsSubrecordStorageKey(kind);
  if (!school || !storageKey) return null;
  return toRecordArray(school[storageKey]).find((item) => String(item.id) === String(recordId)) || null;
}

function assertOpsSchoolSubrecordExpectedVersion(state, schoolId, kind, recordId, expectedVersion) {
  const current = findOpsSchoolSubrecord(state, schoolId, kind, recordId);
  if (!current) return null;
  const currentVersion = Number(current.version || 1);
  const expected = Number(expectedVersion || currentVersion);
  if (Number.isFinite(expected) && currentVersion !== expected) {
    const error = new Error(opsSchoolConflictCopy(kind));
    error.code = "VERSION_CONFLICT";
    error.currentVersion = currentVersion;
    throw error;
  }
  return current;
}

function withOpsSchoolSubrecordVersions(state, schoolId, subrecords) {
  const mapRows = (kind, rows = []) => rows.map((record) => {
    const current = assertOpsSchoolSubrecordExpectedVersion(state, schoolId, kind, record.id, record.expectedVersion || record.version || 1);
    const { expectedVersion, ...recordForSave } = record;
    return { ...recordForSave, version: Number(current?.version || expectedVersion || record.version || 1) + 1 };
  });
  return {
    ...(subrecords.programs ? { programs: mapRows("programs", subrecords.programs) } : {}),
    ...(subrecords.cscaRules ? { cscaRules: mapRows("rules", subrecords.cscaRules) } : {}),
    ...(subrecords.scholarshipsDetailed ? { scholarshipsDetailed: mapRows("scholarships", subrecords.scholarshipsDetailed) } : {}),
  };
}

const opsContentTabs = [
  ["cities", "城市指南"],
  ["scholarships", "公共奖学金"],
  ["timeline", "申请时间窗"],
];

function normalizeOpsContentType(type) {
  const value = String(type || "").trim().toLowerCase();
  const aliases = {
    city: "cities",
    cities: "cities",
    cityguide: "cities",
    cityguides: "cities",
    scholarship: "scholarships",
    scholarships: "scholarships",
    publicscholarship: "scholarships",
    publicscholarships: "scholarships",
    adminscholarship: "scholarships",
    timeline: "timeline",
    timelines: "timeline",
    window: "timeline",
    windows: "timeline",
    applicationtimelinewindow: "timeline",
  };
  return aliases[value] || "cities";
}

const opsContentStatusOptions = [
  ["draft", "草稿"],
  ["published", "已发布"],
  ["archived", "已归档"],
];

const opsScholarshipTypeOptions = [
  ["government", "政府奖学金"],
  ["university", "大学奖学金"],
  ["provincial", "省级奖学金"],
  ["confucius", "孔子学院奖学金"],
  ["other", "其他奖学金"],
];

const opsScholarshipFundingOptions = [
  ["unknown", "待确认"],
  ["full", "全额资助"],
  ["partial", "部分资助"],
];

const opsCityFields = [
  { label: "中文名 · CityGuide.nameZh", key: "nameZh", required: true },
  { label: "英文名 · CityGuide.nameEn", key: "nameEn" },
  { label: "URL 标识 · CityGuide.slug", key: "slug" },
  { label: "区域 · CityGuide.region", key: "region" },
  { label: "月成本 · CityGuide.monthlyCost", key: "monthlyCost" },
  { label: "成本层级 · CityGuide.costLevel", key: "costLevel" },
  { label: "城市密度 · CityGuide.density", key: "density" },
  { label: "标签 · CityGuide.tags", key: "tags", control: "textarea", wide: true },
  { label: "附近城市 · CityGuide.nearby", key: "nearby", control: "textarea", wide: true },
  { label: "页面内容结构 · CityGuide.content", key: "contentJsonText", control: "textarea", wide: true, json: true },
  { label: "摘要 · CityGuide.content.summary", key: "summary", control: "textarea", wide: true },
  { label: "概览 · CityGuide.content.overview", key: "overview", control: "textarea", wide: true },
  { label: "适合人群 · CityGuide.content.bestFor", key: "bestFor", control: "textarea", wide: true },
  { label: "快速事实 · CityGuide.content.quickFacts", key: "quickFacts", control: "textarea", wide: true },
  { label: "预算摘要 · CityGuide.content.budgetSummary", key: "budgetSummary", control: "textarea", wide: true },
  { label: "预算画像 · CityGuide.content.costProfiles", key: "costProfiles", control: "textarea", wide: true },
  { label: "选择理由 · CityGuide.content.why", key: "why", control: "textarea", wide: true },
  { label: "成本拆分 · CityGuide.content.costBreakdown", key: "costBreakdown", control: "textarea", wide: true },
  { label: "生活板块 · CityGuide.content.lifeSections", key: "lifeSections", control: "textarea", wide: true },
  { label: "交通说明 · CityGuide.content.transportNotes", key: "transportNotes", control: "textarea", wide: true },
  { label: "申请提示 · CityGuide.content.applicationTips", key: "applicationTips", control: "textarea", wide: true },
  { label: "申请建议 · CityGuide.content.applicationAdvice", key: "applicationAdvice", control: "textarea", wide: true },
  { label: "项目关键词 · CityGuide.content.relatedProgramKeywords", key: "relatedProgramKeywords", control: "textarea", wide: true },
  { label: "下一步 · CityGuide.content.nextSteps", key: "nextSteps", control: "textarea", wide: true },
  { label: "FAQ · CityGuide.content.faqs", key: "faqs", control: "textarea", wide: true },
  { label: "城市 FAQ · CityGuide.content.cityFaqs", key: "cityFaqs", control: "textarea", wide: true },
  { label: "参考学校数 · CityGuide.referenceSchoolCount", key: "referenceSchoolCount", type: "number" },
  { label: "参考项目数 · CityGuide.referenceProgramCount", key: "referenceProgramCount", type: "number" },
  { label: "英文项目数 · CityGuide.referenceEnglishProgramCount", key: "referenceEnglishProgramCount", type: "number" },
  { label: "奖学金数 · CityGuide.referenceScholarshipCount", key: "referenceScholarshipCount", type: "number" },
  { label: "CSCA 学校数 · CityGuide.referenceCscaSchoolCount", key: "referenceCscaSchoolCount", type: "number" },
  { label: "状态 · CityGuide.status", key: "status", control: "select", options: opsContentStatusOptions },
  { label: "排序 · CityGuide.sortOrder", key: "sortOrder", type: "number" },
];

const opsCityFieldGroups = [
  ["基础信息", ["nameZh", "nameEn", "slug", "region", "costLevel", "density", "status", "sortOrder"]],
  ["公开摘要", ["summary", "overview", "bestFor", "why", "tags"]],
  ["预算生活", ["monthlyCost", "quickFacts", "budgetSummary", "costProfiles", "costBreakdown", "lifeSections", "transportNotes", "nearby"]],
  ["申请路线", ["applicationTips", "applicationAdvice", "relatedProgramKeywords", "nextSteps"]],
  ["FAQ", ["faqs", "cityFaqs"]],
  ["资源聚合", ["referenceSchoolCount", "referenceProgramCount", "referenceEnglishProgramCount", "referenceScholarshipCount", "referenceCscaSchoolCount"]],
  ["高级结构", ["contentJsonText"]],
];

const opsScholarshipFields = [
  { label: "标题 · AdminScholarship.title", key: "title", required: true },
  { label: "URL 标识 · AdminScholarship.slug", key: "slug" },
  { label: "类型 · AdminScholarship.type", key: "type", control: "select", options: opsScholarshipTypeOptions },
  { label: "资助级别 · AdminScholarship.fundingLevel", key: "fundingLevel", control: "select", options: opsScholarshipFundingOptions },
  { label: "提供方 · AdminScholarship.providerName", key: "providerName" },
  { label: "英文提供方 · AdminScholarship.providerNameEn", key: "providerNameEn" },
  { label: "提供方地区 · AdminScholarship.providerLocation", key: "providerLocation" },
  { label: "摘要 · AdminScholarship.summary", key: "summary", control: "textarea", wide: true },
  { label: "覆盖范围 · AdminScholarship.coverage", key: "coverage", control: "textarea", wide: true },
  { label: "适用学位 · AdminScholarship.applicableDegree", key: "applicableDegree" },
  { label: "适用项目 · AdminScholarship.applicableProgram", key: "applicableProgram" },
  { label: "金额说明 · AdminScholarship.amountText", key: "amountText", control: "textarea", wide: true },
  { label: "申请要求 · AdminScholarship.requirementText", key: "requirementText", control: "textarea", wide: true },
  { label: "正文板块 · AdminScholarship.bodySections", key: "bodySections", control: "textarea", wide: true },
  { label: "资助内容 · AdminScholarship.benefits", key: "benefits", control: "textarea", wide: true },
  { label: "权益项 · AdminScholarship.benefitItems", key: "benefitItems", control: "textarea", wide: true },
  { label: "资格项 · AdminScholarship.eligibilityItems", key: "eligibilityItems", control: "textarea", wide: true },
  { label: "材料项 · AdminScholarship.applicationMaterials", key: "applicationMaterials", control: "textarea", wide: true },
  { label: "申请步骤 · AdminScholarship.applicationSteps", key: "applicationSteps", control: "textarea", wide: true },
  { label: "联系信息 · AdminScholarship.contactInfo", key: "contactInfo", control: "textarea", wide: true },
  { label: "操作链接 · AdminScholarship.actionLinks", key: "actionLinks", control: "textarea", wide: true },
  { label: "截止日期 · AdminScholarship.deadlineDate", key: "deadlineDate" },
  { label: "截止标签 · AdminScholarship.deadlineLabel", key: "deadlineLabel" },
  { label: "申请轮次 · AdminScholarship.applicationRound", key: "applicationRound" },
  { label: "目标国家 · AdminScholarship.targetCountries", key: "targetCountries", control: "textarea", wide: true },
  { label: "目标地区 · AdminScholarship.targetRegions", key: "targetRegions", control: "textarea", wide: true },
  { label: "关联学校 · AdminScholarship.schoolIds", key: "schoolIds", control: "textarea", wide: true },
  { label: "关联项目 · AdminScholarship.programIds", key: "programIds", control: "textarea", wide: true },
  { label: "来源链接 · AdminScholarship.sourceUrl", key: "sourceUrl", type: "url", wide: true },
  { label: "来源标签 · AdminScholarship.sourceLabel", key: "sourceLabel" },
  { label: "最近核验 · AdminScholarship.lastVerifiedAt", key: "lastVerifiedAt" },
  { label: "排序 · AdminScholarship.sortOrder", key: "sortOrder", type: "number" },
  { label: "状态 · AdminScholarship.status", key: "status", control: "select", options: opsContentStatusOptions },
];

const opsScholarshipFieldGroups = [
  ["基础信息", ["title", "slug", "type", "fundingLevel", "status", "sortOrder", "deadlineDate", "deadlineLabel", "applicationRound"]],
  ["公开摘要", ["summary", "coverage", "amountText", "requirementText"]],
  ["申请材料", ["benefits", "benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps"]],
  ["适用范围", ["applicableDegree", "applicableProgram", "targetCountries", "targetRegions", "schoolIds", "programIds"]],
  ["来源联系", ["sourceUrl", "sourceLabel", "lastVerifiedAt", "contactInfo", "actionLinks", "providerName", "providerNameEn", "providerLocation"]],
  ["高级正文", ["bodySections"]],
];

const opsTimelineFields = [
  { label: "月份 · ApplicationTimelineWindow.month", key: "month", required: true },
  { label: "标题 · ApplicationTimelineWindow.title", key: "title", required: true },
  { label: "申请窗口 · ApplicationTimelineWindow.applicationWindow", key: "applicationWindow", control: "textarea", wide: true },
  { label: "CSCA 窗口 · ApplicationTimelineWindow.cscaWindow", key: "cscaWindow", control: "textarea", wide: true },
  { label: "状态 · ApplicationTimelineWindow.status", key: "status", control: "select", options: opsContentStatusOptions },
  { label: "排序 · ApplicationTimelineWindow.sortOrder", key: "sortOrder", type: "number" },
];

const opsTimelineFieldGroups = [
  ["基础信息", ["month", "title", "status", "sortOrder"]],
  ["窗口内容", ["applicationWindow", "cscaWindow"]],
];

function activeOpsContentType(state = readOpsAdminState()) {
  return normalizeOpsContentType(state.contentType);
}

function activeOpsContentViewForState(state = readOpsAdminState()) {
  return normalizeOpsContentView(state.contentView);
}

function getOpsSelectedContent(records, stateKey, state = readOpsAdminState()) {
  return records.find((item) => String(item.id) === String(state[stateKey])) || records[0] || null;
}

function opsContentStateKey(type) {
  if (type === "scholarships") return "selectedPublicScholarshipId";
  if (type === "timeline") return "selectedTimelineWindowId";
  return "selectedCityGuideId";
}

function opsContentRecordsForType(type, cityRows, scholarshipRows, timelineRows) {
  if (type === "scholarships") return scholarshipRows;
  if (type === "timeline") return timelineRows;
  return cityRows;
}

function opsContentStatusMatches(status, filter = "all") {
  if (filter === "all") return true;
  return String(status || "draft").toLowerCase() === String(filter).toLowerCase();
}

function opsContentSearchText(item, type) {
  if (type === "cities") {
    return [
      item.nameZh,
      item.nameEn,
      item.slug,
      item.region,
      item.summary,
      inlineValue(item.tags),
      inlineValue(item.nearby),
    ].filter(Boolean).join(" ");
  }
  if (type === "timeline") {
    return [
      item.month,
      item.title,
      item.applicationWindow,
      item.cscaWindow,
      item.status,
    ].filter(Boolean).join(" ");
  }
  return [
    item.title,
    item.slug,
    item.type,
    item.fundingLevel,
    item.providerName,
    item.providerNameEn,
    item.providerLocation,
    item.summary,
    item.coverage,
    item.deadlineLabel,
    item.applicationRound,
    inlineValue(item.targetCountries),
    inlineValue(item.targetRegions),
  ].filter(Boolean).join(" ");
}

function filterOpsContentRecords(records, type, state = readOpsAdminState()) {
  const search = String(state.contentSearch || "").trim().toLowerCase();
  const statusFilter = state.contentStatusFilter || "all";
  return records.filter((item) => {
    const matchesStatus = opsContentStatusMatches(item.status, statusFilter);
    const haystack = opsContentSearchText(item, type).toLowerCase();
    return matchesStatus && (!search || haystack.includes(search));
  });
}

function opsContentStatusStats(records) {
  return {
    total: records.length,
    published: records.filter((item) => String(item.status || "").toLowerCase() === "published").length,
    draft: records.filter((item) => String(item.status || "draft").toLowerCase() === "draft").length,
    archived: records.filter((item) => String(item.status || "").toLowerCase() === "archived").length,
  };
}

function opsContentRequiredFields(type) {
  if (type === "scholarships") {
    return [
      ["标题", "title"],
      ["提供方", "providerName"],
      ["资助级别", "fundingLevel"],
      ["摘要", "summary"],
      ["金额/覆盖", (item) => item.amountText || item.coverage || item.benefits],
      ["申请要求", "requirementText"],
      ["截止/轮次", (item) => item.deadlineLabel || item.deadlineDate || item.applicationRound],
      ["适用范围", (item) => splitOpsTextList(item.schoolIds).length || splitOpsTextList(item.programIds).length || item.applicableDegree || item.applicableProgram],
      ["来源", (item) => item.sourceUrl || item.sourceLabel],
    ];
  }
  if (type === "timeline") {
    return [
      ["月份", "month"],
      ["标题", "title"],
      ["申请窗口", "applicationWindow"],
      ["CSCA 窗口", "cscaWindow"],
      ["状态", "status"],
    ];
  }
  return [
    ["中文名", "nameZh"],
    ["英文名", "nameEn"],
    ["URL 标识", "slug"],
    ["区域", "region"],
    ["摘要", (item) => item.summary || item.overview],
    ["预算/成本", (item) => item.monthlyCost || item.budgetSummary || item.quickFacts],
    ["适合人群", "bestFor"],
    ["学校资源", (item) => item.referenceSchoolCount || item.actualSchoolCount || item.aggregate?.actualSchoolCount],
    ["项目资源", (item) => item.referenceProgramCount || item.actualProgramCount || item.aggregate?.actualProgramCount],
  ];
}

function opsContentFieldFilled(item, rule) {
  const value = typeof rule === "function" ? rule(item) : item?.[rule];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return Boolean(textValue(value));
}

function opsContentMissingFields(type, item = {}) {
  return opsContentRequiredFields(type)
    .filter(([, rule]) => !opsContentFieldFilled(item, rule))
    .map(([label]) => label);
}

function opsContentQualityScore(type, item = {}) {
  const fields = opsContentRequiredFields(type);
  if (!fields.length) return 0;
  const filled = fields.filter(([, rule]) => opsContentFieldFilled(item, rule)).length;
  return Math.round((filled / fields.length) * 100);
}

function opsContentRelationCounts(type, item = {}) {
  if (type === "scholarships") {
    const summary = opsScholarshipRelationSummary(item);
    return {
      schools: summary.schoolCount || 0,
      programs: summary.programCount || 0,
      scholarships: 1,
      csca: 0,
    };
  }
  if (type === "timeline") {
    const hasCsca = Boolean(textValue(item.cscaWindow));
    return {
      schools: 0,
      programs: 0,
      scholarships: 0,
      csca: hasCsca ? 1 : 0,
    };
  }
  const aggregate = item.aggregate || {};
  return {
    schools: Number(aggregate.actualSchoolCount ?? item.actualSchoolCount ?? item.referenceSchoolCount ?? 0),
    programs: Number(aggregate.actualProgramCount ?? item.actualProgramCount ?? item.referenceProgramCount ?? 0),
    scholarships: Number(aggregate.actualScholarshipCount ?? item.actualScholarshipCount ?? item.referenceScholarshipCount ?? 0),
    csca: Number(aggregate.actualCscaRequiredSchoolCount ?? item.actualCscaRequiredSchoolCount ?? item.referenceCscaSchoolCount ?? 0),
  };
}

function buildOpsContentWorkspaceStats(type, records = [], selected = null) {
  const rows = toRecordArray(records);
  const statusStats = opsContentStatusStats(rows);
  const missingRows = rows.filter((item) => opsContentMissingFields(type, item).length);
  const publishedReady = rows.filter((item) => {
    const quality = opsContentQualityScore(type, item);
    return String(item.status || "").toLowerCase() === "published" && quality >= 75;
  }).length;
  const qualities = rows.map((item) => opsContentQualityScore(type, item));
  const relationTotals = rows.reduce((sum, item) => {
    const relation = opsContentRelationCounts(type, item);
    return {
      schools: sum.schools + relation.schools,
      programs: sum.programs + relation.programs,
      scholarships: sum.scholarships + relation.scholarships,
      csca: sum.csca + relation.csca,
    };
  }, { schools: 0, programs: 0, scholarships: 0, csca: 0 });
  const selectedMissing = selected ? opsContentMissingFields(type, selected) : [];
  const selectedRelation = selected ? opsContentRelationCounts(type, selected) : { schools: 0, programs: 0, scholarships: 0, csca: 0 };
  return {
    ...statusStats,
    missing: missingRows.length,
    publishedReady,
    averageQuality: qualities.length ? Math.round(qualities.reduce((sum, item) => sum + item, 0) / qualities.length) : 0,
    selectedQuality: selected ? opsContentQualityScore(type, selected) : 0,
    selectedMissing,
    selectedRelation,
    relationTotals,
  };
}

function opsContentCreateLabel(type) {
  if (type === "scholarships") return "公共奖学金";
  if (type === "timeline") return "时间窗";
  return "城市";
}

function opsContentDisplayLabel(type) {
  if (type === "scholarships") return "公共奖学金";
  if (type === "timeline") return "申请时间窗";
  return "城市指南";
}

function opsContentModelName(type) {
  if (type === "scholarships") return "Scholarship";
  if (type === "timeline") return "ApplicationTimelineWindow";
  return "CityGuide";
}

const opsSectionKeys = ["overview", "school", "content", "students", "access", "queue"];
const opsQueueViews = [
  ["work", "待办队列"],
  ["audit", "审计事件"],
  ["support", "支持查询"],
  ["agent", "Agent 运维"],
];
const opsAccessViews = [
  ["accounts", "账号列表"],
  ["invites", "邀请审批"],
  ["agent", "Agent 服务"],
  ["boundary", "权限边界"],
];
const opsSchoolViews = [
  ["catalog", "学校目录"],
  ["edit", "编辑学校"],
  ["preview", "公开预览"],
  ["model", "字段与审计"],
];
const opsContentViews = [
  ["catalog", "目录列表"],
  ["edit", "编辑记录"],
  ["preview", "公开预览"],
  ["model", "字段与审计"],
];

function normalizeOpsStudentDetailTab(tab) {
  return ["overview", "handoff", "account", "timeline", "edit"].includes(String(tab || "")) ? String(tab) : "overview";
}

function normalizeOpsQueueView(view) {
  return opsQueueViews.some(([key]) => key === String(view || "")) ? String(view) : "work";
}

function normalizeOpsAccessView(view) {
  return opsAccessViews.some(([key]) => key === String(view || "")) ? String(view) : "accounts";
}

function normalizeOpsSchoolView(view) {
  return opsSchoolViews.some(([key]) => key === String(view || "")) ? String(view) : "catalog";
}

function normalizeOpsContentView(view) {
  return opsContentViews.some(([key]) => key === String(view || "")) ? String(view) : "catalog";
}

function parseOpsHashRoute(hash = location.hash) {
  if (mode !== "ops") return {};
  const raw = String(hash || "").replace(/^#\/?/, "").trim();
  if (!raw) return {};
  const parts = raw.split(/[/?&=]+/).map((part) => part.trim()).filter(Boolean);
  const sectionAliases = {
    overview: "overview",
    home: "overview",
    dashboard: "overview",
    school: "school",
    schools: "school",
    content: "content",
    contents: "content",
    students: "students",
    student: "students",
    applications: "students",
    access: "access",
    accounts: "access",
    queue: "queue",
    audit: "queue",
  };
  const nextSection = sectionAliases[(parts[0] || "").toLowerCase()];
  if (!nextSection) return {};
  const routeState = { opsSection: nextSection };
  if (nextSection === "school" && parts[1]) {
    if (opsSchoolViews.some(([key]) => key === parts[1])) {
      routeState.schoolView = normalizeOpsSchoolView(parts[1]);
      if (routeState.schoolView === "edit" && parts[2]) routeState.schoolEditorTab = normalizeOpsSchoolTab(parts[2]);
    } else {
      routeState.schoolView = "edit";
      routeState.schoolEditorTab = normalizeOpsSchoolTab(parts[1]);
    }
  }
  if (nextSection === "content" && parts[1]) routeState.contentType = normalizeOpsContentType(parts[1]);
  if (nextSection === "content" && parts[2]) routeState.contentView = normalizeOpsContentView(parts[2]);
  if (nextSection === "students" && parts[1]) routeState.studentDetailTab = normalizeOpsStudentDetailTab(parts[1]);
  if (nextSection === "access" && parts[1]) routeState.accessView = normalizeOpsAccessView(parts[1]);
  if (nextSection === "queue" && parts[1]) routeState.queueView = normalizeOpsQueueView(parts[1]);
  return routeState;
}

function applyOpsHashRouteState(hash = location.hash) {
  if (mode !== "ops") return readOpsAdminState();
  const routeState = parseOpsHashRoute(hash);
  if (!Object.keys(routeState).length) return readOpsAdminState();
  let storedState = {};
  try {
    storedState = sanitizeOpsAdminState(JSON.parse(localStorage.getItem("cuacOpsAdminDemoState") || "{}"));
  } catch {
    storedState = {};
  }
  const nextState = sanitizeOpsAdminState({ ...storedState, ...routeState });
  try {
    localStorage.setItem("cuacOpsAdminDemoState", JSON.stringify(nextState));
  } catch {
    // Demo storage can be unavailable in restricted preview contexts.
  }
  return nextState;
}

function mergeOpsRouteState(state = {}) {
  if (mode !== "ops") return state;
  const routeState = parseOpsHashRoute();
  return Object.keys(routeState).length ? sanitizeOpsAdminState({ ...state, ...routeState }) : state;
}

function buildOpsHashRoute(state = readOpsAdminState()) {
  const section = activeOpsSection(state);
  if (section === "school") {
    const view = normalizeOpsSchoolView(state.schoolView);
    return view === "edit" ? `#school/${view}/${normalizeOpsSchoolTab(state.schoolEditorTab)}` : `#school/${view}`;
  }
  if (section === "content") return `#content/${normalizeOpsContentType(state.contentType)}/${normalizeOpsContentView(state.contentView)}`;
  if (section === "students") return `#students/${normalizeOpsStudentDetailTab(state.studentDetailTab)}`;
  if (section === "access") return `#access/${normalizeOpsAccessView(state.accessView)}`;
  if (section === "queue") return `#queue/${normalizeOpsQueueView(state.queueView)}`;
  return `#${section}`;
}

function syncOpsHashRoute(state = readOpsAdminState()) {
  if (mode !== "ops") return;
  try {
    const nextHash = buildOpsHashRoute(state);
    if (location.hash === nextHash) return;
    history.replaceState(null, "", `${location.href.split("#")[0]}${nextHash}`);
    if (location.hash !== nextHash) location.replace(nextHash);
  } catch (error) {
    console.warn("CUAC ops hash route sync skipped", error);
  }
}

function opsTabPanelAttrs(section, state = readOpsAdminState()) {
  const active = activeOpsSection(state) === section;
  return `class="ops-tab-panel reveal${active ? " active" : ""}" data-ops-section="${escapeHtml(section)}" role="tabpanel"${active ? "" : " hidden"}`;
}

function activeOpsSection(state = readOpsAdminState()) {
  return opsSectionKeys.includes(state.opsSection) ? state.opsSection : "overview";
}

function activeOpsQueueView(state = readOpsAdminState()) {
  return normalizeOpsQueueView(state.queueView);
}

function activeOpsSchoolView(state = readOpsAdminState()) {
  return normalizeOpsSchoolView(state.schoolView);
}

function activeOpsAccessView(state = readOpsAdminState()) {
  return normalizeOpsAccessView(state.accessView);
}

function activeOpsContentView(state = readOpsAdminState()) {
  return normalizeOpsContentView(state.contentView);
}

function renderOpsContentCardSafe(item, type, selectedId, index = 0) {
  try {
    const record = type === "cities"
      ? normalizeOpsCityRecord(item, index, { useFallback: false })
      : type === "timeline"
        ? normalizeOpsTimelineRecord(item, index, { useFallback: false })
        : normalizeOpsScholarshipRecord(item, index, { useFallback: false });
    return renderOpsContentCard(record, type, selectedId);
  } catch {
    return `
      <article class="ops-content-card">
        <div class="ops-content-card-head"><div class="ops-entity-cell"><strong>记录需要修复</strong><span>本地预览状态里有一条${opsContentCreateLabel(type)}记录无法读取</span></div><span class="status-pill danger">需处理</span></div>
        <p class="ops-empty">这条记录已被隔离，不会影响新增或编辑其他内容。</p>
      </article>
    `;
  }
}

function opsScholarshipRelationSummary(item = {}) {
  let schools = toRecordArray(item.schools);
  let programs = toRecordArray(item.programs);
  try {
    if (!schools.length) schools = resolveOpsScholarshipSchools(item.schoolIds);
    if (!programs.length) programs = resolveOpsScholarshipPrograms(item.programIds);
  } catch {
    schools = schools.length ? schools : [];
    programs = programs.length ? programs : [];
  }
  const schoolIds = toArray(item.schoolIds);
  const programIds = toArray(item.programIds);
  const schoolNames = schools.map((school) => school.nameZh || school.nameEn || school.id).filter(Boolean);
  const programNames = programs.map((program) => [program.nameZh || program.nameEn || program.id, program.schoolName].filter(Boolean).join(" · ")).filter(Boolean);
  return {
    schoolCount: schools.length || schoolIds.length,
    programCount: programs.length || programIds.length,
    schoolNames: schoolNames.length ? schoolNames : schoolIds.map(String),
    programNames: programNames.length ? programNames : programIds.map(String),
  };
}

function renderOpsScholarshipRelationSummary(item = {}) {
  const summary = opsScholarshipRelationSummary(item);
  const schoolCopy = summary.schoolNames.slice(0, 2).join(" / ") || "未关联学校";
  const programCopy = summary.programNames.slice(0, 2).join(" / ") || "未关联项目";
  return `
    <div class="ops-relation-summary" data-ops-scholarship-relation-summary>
      <span><strong>${escapeHtml(String(summary.schoolCount || 0))}</strong> 学校：${escapeHtml(schoolCopy)}${summary.schoolNames.length > 2 ? ` +${summary.schoolNames.length - 2}` : ""}</span>
      <span><strong>${escapeHtml(String(summary.programCount || 0))}</strong> 项目：${escapeHtml(programCopy)}${summary.programNames.length > 2 ? ` +${summary.programNames.length - 2}` : ""}</span>
    </div>
  `;
}

function renderOpsContentCard(item, type, selectedId) {
  const title = type === "cities" ? item.nameZh : item.title;
  const displayLabel = opsContentDisplayLabel(type);
  const scholarshipTypeLabel = (opsScholarshipTypeOptions.find(([value]) => value === item.type) || [null, item.type || "奖学金记录"])[1];
  const relationSummary = type === "scholarships" ? opsScholarshipRelationSummary(item) : null;
  const quality = opsContentQualityScore(type, item);
  const missing = opsContentMissingFields(type, item);
  const meta = type === "cities"
    ? `${item.nameEn || "英文名待补充"} · ${item.region || "区域待补充"}`
    : type === "timeline"
      ? `${item.month || "月份待补充"} · ${opsLifecycleStatusLabel(item.status)}`
      : `${item.providerName || "提供方待补充"} · ${item.fundingLevel || "资助级别待补充"}`;
  const statA = type === "cities" ? item.referenceProgramCount : type === "timeline" ? item.month || "待补充" : item.deadlineLabel || item.deadlineDate || "待补充";
  const statB = type === "cities" ? item.referenceScholarshipCount : type === "timeline" ? item.sortOrder : item.applicableDegree || "待补充";
  const statC = type === "cities" ? item.referenceCscaSchoolCount : opsLifecycleStatusLabel(item.status);
  const summary = type === "cities" ? item.summary : type === "timeline" ? item.applicationWindow || item.cscaWindow || "继续补充申请时间窗" : item.summary || "继续补充奖学金说明";
  const metaItems = type === "cities"
    ? [["项目", statA], ["奖学金", statB], ["CSCA", statC], ["质量", `${quality}%`]]
    : type === "timeline"
      ? [["月份", statA], ["排序", statB], ["状态", statC], ["质量", `${quality}%`]]
      : [["截止", statA], ["学位", statB], ["学校", relationSummary?.schoolCount || 0], ["项目", relationSummary?.programCount || 0], ["质量", `${quality}%`]];
  return `
    <article class="ops-content-card ops-content-list-row ${String(selectedId) === String(item.id) ? "selected" : ""}">
      <div class="ops-content-card-head"><div class="ops-entity-cell"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta)}</span></div><span class="status-pill ${schoolStatusTone(item.status)}">${escapeHtml(opsLifecycleStatusLabel(item.status || "published"))}</span></div>
      <div class="ops-content-row-meta">
        ${metaItems.map(([label, value]) => `<span><strong>${escapeHtml(String(value ?? "待补充"))}</strong> ${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="ops-content-card-foot">
        <div><span>${escapeHtml(type === "scholarships" ? scholarshipTypeLabel : displayLabel)}</span><small>${escapeHtml(missing.length ? `待补：${missing.slice(0, 2).join("、")}${missing.length > 2 ? ` +${missing.length - 2}` : ""}` : textValue(summary))}</small></div>
        <div class="ops-content-card-actions" aria-label="内容记录操作">
          <button class="secondary-action micro" data-ops-content-select data-content-type="${escapeHtml(type)}" data-content-id="${escapeHtml(item.id)}" type="button">编辑</button>
          <button class="secondary-action micro" data-ops-content-open-view="preview" data-content-type="${escapeHtml(type)}" data-content-id="${escapeHtml(item.id)}" type="button">预览</button>
          <button class="secondary-action micro" data-ops-content-open-view="model" data-content-type="${escapeHtml(type)}" data-content-id="${escapeHtml(item.id)}" type="button">字段</button>
        </div>
      </div>
    </article>
  `;
}

function renderOpsContentField(field, item) {
  const value = textValue(item[field.key] ?? "");
  const classes = ["ops-form-field", field.wide ? "wide" : ""].filter(Boolean).join(" ");
  const label = renderOpsFieldLabel(field.label);
  const sourceAttrs = opsFieldSourceAttrs(field.label);
  if (field.control === "textarea") {
    return `<label class="${classes}"${sourceAttrs}>${label}<textarea ${field.json ? "class=\"ops-json-editor\"" : ""} data-ops-content-field="${escapeHtml(field.key)}">${escapeHtml(value)}</textarea></label>`;
  }
  if (field.control === "select") {
    const hasCurrent = (field.options || []).some(([optionValue]) => String(optionValue) === String(value));
    const options = [
      ...(hasCurrent || !value ? [] : [[value, `${value}（旧值）`]]),
      ...(field.options || []),
    ].map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("");
    return `<label class="${classes}"${sourceAttrs}>${label}<select data-ops-content-field="${escapeHtml(field.key)}">${options}</select></label>`;
  }
  return `<label class="${classes}"${sourceAttrs}>${label}<input data-ops-content-field="${escapeHtml(field.key)}" value="${escapeHtml(value)}" type="${escapeHtml(field.type || "text")}" ${field.required ? "required" : ""} ${field.readonly ? "readonly" : ""} /></label>`;
}

function renderOpsContentEditorGroups(type, item, fields, groups, options = {}) {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const sections = groups.map(([title, keys], index) => {
    const fields = keys.map((key) => fieldsByKey.get(key)).filter(Boolean);
    return {
      title,
      index,
      html: `
      <section class="ops-content-editor-section" data-ops-content-editor-panel="${escapeHtml(String(index))}" ${index === 0 ? "" : "hidden"}>
        <h3>${escapeHtml(title)}</h3>
        ${options.beforeFields ? options.beforeFields(title, item) : ""}
        <div class="ops-form-grid">${fields.map((field) => renderOpsContentField(field, item)).join("")}</div>
      </section>`,
    };
  });
  (options.extraSections || []).forEach((section) => {
    const index = sections.length;
    sections.push({
      title: section.title,
      index,
      html: `
      <div class="ops-content-editor-relation-panel" data-ops-content-editor-panel="${escapeHtml(String(index))}" hidden>
        ${section.html}
      </div>`,
    });
  });
  return `
    <nav class="ops-editor-tabs ops-content-editor-tabs" aria-label="${escapeHtml(opsContentCreateLabel(type))}编辑分区">
      ${sections.map((section) => `<button class="${section.index === 0 ? "active" : ""}" data-ops-content-editor-tab="${escapeHtml(String(section.index))}" type="button" aria-selected="${section.index === 0 ? "true" : "false"}">${escapeHtml(section.title)}</button>`).join("")}
    </nav>
    <div class="ops-content-editor-panels">
      ${sections.map((section) => section.html).join("")}
    </div>
  `;
}

function renderOpsContentEditorImpactPanel(type, item = {}) {
  const missing = opsContentMissingFields(type, item);
  const quality = opsContentQualityScore(type, item);
  const relation = opsContentRelationCounts(type, item);
  const impact = type === "cities"
    ? [
      ["学生端位置", "城市详情页 / 城市筛选"],
      ["影响资源", `${relation.schools} 所学校 · ${relation.programs} 个项目 · ${relation.scholarships} 条奖学金`],
      ["优先处理", missing.slice(0, 3).join("、") || "检查公开文案和城市排序"],
    ]
    : type === "scholarships"
      ? [
        ["学生端位置", "奖学金列表 / 学校与项目匹配"],
        ["影响资源", `${relation.schools} 所学校 · ${relation.programs} 个项目`],
        ["优先处理", missing.slice(0, 3).join("、") || "检查金额、要求和关联范围"],
      ]
      : [
        ["学生端位置", "申请时间线 / 考试准备提醒"],
        ["影响资源", relation.csca ? "含 CSCA 准备提示" : "CSCA 窗口待补"],
        ["优先处理", missing.slice(0, 3).join("、") || "检查申请窗口和提醒状态"],
      ];
  return `
    <section class="ops-content-edit-impact" aria-label="内容编辑影响摘要">
      <div>
        <span class="module-kicker">编辑判断</span>
        <strong>${escapeHtml(String(quality))}% 公开质量</strong>
        <small>${escapeHtml(missing.length ? `${missing.length} 个字段仍会影响学生端理解` : "关键公开字段已就绪，继续检查表达和排序。")}</small>
      </div>
      <div class="ops-content-impact-grid">
        ${impact.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
      </div>
    </section>
  `;
}

function renderOpsContentEditorTaskline(type, item = {}) {
  const missing = opsContentMissingFields(type, item);
  const relation = opsContentRelationCounts(type, item);
  const baseValue = missing.length ? `${missing.length} 缺口` : "可发布";
  const groups = type === "scholarships"
    ? [
      ["基础信息", baseValue, missing.length ? `补 ${missing.slice(0, 2).join("、")}` : "标题、资助级别和状态完整"],
      ["展示内容", item.summary && (item.amountText || item.coverage) ? "已成形" : "待补文案", "摘要、金额、要求和权益项"],
      ["适用范围", `${relation.schools}/${relation.programs}`, "关联学校 / 关联项目"],
      ["来源与联系", item.sourceUrl || item.sourceLabel ? "有来源" : "待核验", "来源、联系和操作链接"],
    ]
    : type === "timeline"
      ? [
        ["基础信息", baseValue, missing.length ? `补 ${missing.slice(0, 2).join("、")}` : "月份和标题完整"],
        ["申请窗口", item.applicationWindow ? "已填写" : "待补", "学生端申请提醒主文案"],
        ["CSCA 窗口", item.cscaWindow ? "已填写" : "待补", "考试准备和报名提示"],
        ["发布状态", opsLifecycleStatusLabel(item.status || "draft"), "是否进入学生端时间线"],
      ]
      : [
        ["基础信息", baseValue, missing.length ? `补 ${missing.slice(0, 2).join("、")}` : "城市身份完整"],
        ["展示内容", item.summary && item.bestFor ? "已成形" : "待补文案", "摘要、适合人群和生活内容"],
        ["资源聚合", `${relation.schools}/${relation.programs}`, "学校 / 项目资源"],
        ["申请路线", item.applicationTips || item.applicationAdvice ? "有提示" : "待补", "申请建议、FAQ 和下一步"],
      ];
  return `
    <div class="ops-content-editor-taskline" aria-label="${escapeHtml(opsContentDisplayLabel(type))}编辑任务分组">
      ${groups.map(([label, value, copy], index) => `
        <article class="${index === 0 && missing.length ? "active" : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(String(value))}</strong>
          <small>${escapeHtml(copy)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOpsScholarshipEditorGroups(item, extraSections = []) {
  return renderOpsContentEditorGroups("scholarships", item, opsScholarshipFields, opsScholarshipFieldGroups, {
    beforeFields: (title) => title === "基础信息" ? renderOpsContentEditorImpactPanel("scholarships", item) : title === "来源联系" ? renderOpsScholarshipRecordSignals(item) : "",
    extraSections,
  });
}

function renderOpsTimelineEditorGroups(item) {
  return renderOpsContentEditorGroups("timeline", item, opsTimelineFields, opsTimelineFieldGroups, {
    beforeFields: (title) => title === "基础信息" ? renderOpsContentEditorImpactPanel("timeline", item) : title === "窗口内容" ? renderOpsTimelineRecordSignals(item) : "",
  });
}

function renderOpsContentRecordSignals(rows = [], description = "", attr = "") {
  const safeRows = rows.filter(([label]) => label);
  return `
    <section class="ops-subrecord-readonly" ${attr}>
      <div>
        <strong>系统只读信息</strong>
        <span>${escapeHtml(description)}</span>
      </div>
      <div class="ops-readonly-signal-grid">
        ${safeRows.map(([label, value, field]) => `
          <article ${field ? `data-source-field="${escapeHtml(field)}" title="${escapeHtml(field)}"` : ""}>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(textValue(value || "未生成"))}</strong>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function formatOpsTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return textValue(value);
  return date.toISOString().slice(0, 10);
}

function renderOpsCityRecordSignals(item = {}) {
  const aggregate = item.aggregate || {};
  return renderOpsContentRecordSignals([
    ["记录键", item.id || item.slug, "CityGuide.slug"],
    ["版本", item.version || 1, "CityGuide.version"],
    ["更新时间", formatOpsTimestamp(item.updatedAt), "CityGuide.updatedAt"],
    ["真实学校", aggregate.actualSchoolCount ?? item.actualSchoolCount ?? 0, "CityGuideAggregate.actualSchoolCount"],
    ["真实项目", aggregate.actualProgramCount ?? item.actualProgramCount ?? 0, "CityGuideAggregate.actualProgramCount"],
    ["英文项目", aggregate.actualEnglishProgramCount ?? item.actualEnglishProgramCount ?? 0, "CityGuideAggregate.actualEnglishProgramCount"],
  ], "系统会保留城市记录键、版本和聚合统计；本区只编辑城市指南的可维护字段。", "data-ops-city-record-readonly");
}

function renderOpsScholarshipRecordSignals(item = {}) {
  return renderOpsContentRecordSignals([
    ["记录 ID", item.id, "Scholarship.id"],
    ["版本", item.version || 1, "Scholarship.version"],
    ["创建时间", formatOpsTimestamp(item.createdAt), "Scholarship.createdAt"],
    ["更新时间", formatOpsTimestamp(item.updatedAt), "Scholarship.updatedAt"],
    ["关联学校", toRecordArray(item.schools).length || splitOpsTextList(item.schoolIds).length, "ScholarshipSchool"],
    ["关联项目", toRecordArray(item.programs).length || splitOpsTextList(item.programIds).length, "ScholarshipProgram"],
  ], "系统会保留记录 ID、版本和关联统计；本区只编辑公共奖学金的可维护字段。", "data-ops-scholarship-record-readonly");
}

function renderOpsTimelineRecordSignals(item = {}) {
  return renderOpsContentRecordSignals([
    ["记录 ID", item.id, "ApplicationTimelineWindow.id"],
    ["版本", item.version || 1, "ApplicationTimelineWindow.version"],
    ["更新时间", formatOpsTimestamp(item.updatedAt), "ApplicationTimelineWindow.updatedAt"],
  ], "系统会保留记录 ID、版本和更新时间；本区只编辑申请时间窗的可维护字段。", "data-ops-timeline-record-readonly");
}

function opsCityPreviewTokenKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function opsCityPreviewBestForCopy(value) {
  const raw = textValue(value);
  if (!raw) return "";
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  const copy = {
    "tech": "关注计算机、工程或科技产业机会的学生",
    "tech city": "关注科技产业、创新资源和理工科路径的学生",
    "calmer pace": "希望城市节奏更舒缓、初到中国更容易适应的学生",
    "medium cost": "需要控制生活成本，同时保留城市资源的学生",
    "lower cost": "预算更敏感、希望降低生活压力的学生",
    "international": "希望国际化氛围更强、英文资源更多的学生",
    "internships": "重视实习机会、行业连接和就业探索的学生",
    "business": "关注商科、金融、贸易或管理方向的学生",
    "research": "重视科研平台、导师资源和升学衔接的学生",
    "culture": "希望兼顾文化体验和城市生活的学生",
    "language": "准备提升中文能力、需要更多语言环境的学生",
    "warm climate": "偏好气候更温暖、生活适应成本更低的学生",
    "student city": "希望学生氛围更集中、校园资源更好比较的学生",
    "medicine": "关注医学、生命科学或医院资源的学生",
    "engineering": "关注工程、制造或应用技术方向的学生",
  }[opsCityPreviewTokenKey(raw)];
  if (copy) return copy;
  return raw.length > 32 || /[.!?，。；;]/.test(raw)
    ? raw
    : "需要改写成学生能理解的适合人群说明";
}

function opsCityPreviewTagLabel(value) {
  const raw = textValue(value);
  if (!raw) return "";
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  return {
    "east china": "华东地区",
    "north china": "华北地区",
    "south china": "华南地区",
    "west china": "西部地区",
    "central china": "华中地区",
    "northeast china": "东北地区",
    "low": "低成本",
    "medium": "中等成本",
    "high": "高成本",
    "balanced": "节奏适中",
    "fast": "节奏较快",
    "dense": "学校密集",
    "tech": "科技方向",
    "tech city": "科技城市",
    "medium cost": "中等成本",
    "lower cost": "低成本优先",
    "good first city": "适合首次来华",
    "calmer pace": "节奏舒缓",
    "international": "国际化",
    "internships": "实习机会",
    "business": "商科资源",
    "research": "科研资源",
    "culture": "文化体验",
    "language": "语言环境",
    "warm climate": "气候温暖",
    "student city": "学生城市",
    "medicine": "医学方向",
    "engineering": "工程方向",
  }[opsCityPreviewTokenKey(raw)] || raw;
}

function opsScholarshipPreviewLabel(value) {
  const raw = textValue(value);
  if (!raw) return "";
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  return {
    "multiple universities": "多所高校可申请",
    "multiple provincial universities": "多所省内高校可申请",
    "beijing universities": "北京多所高校",
    "jiangsu universities": "江苏多所高校",
    "language partner universities": "语言项目合作高校",
    "confirm by scholarship notice": "以当年奖学金通知为准",
    "full or broad funding route": "覆盖范围较完整，需按官方通知确认",
    "tuition": "学费资助",
    "tuition support": "学费支持",
    "tuition waiver": "学费减免",
    "stipend": "生活补助",
    "accommodation": "住宿支持",
    "insurance": "医疗保险",
    "travel": "旅费支持",
    "merit review": "按成绩和综合条件评审",
    "school nomination route": "学校推荐通道",
    "full funding": "全额资助",
    "partial": "部分资助",
    "csc": "CSC 中国政府奖学金",
    "government": "政府奖学金",
    "university": "校级奖学金",
    "province": "省市奖学金",
    "city": "城市奖学金",
    "municipal": "市级奖学金",
    "partner": "合作方奖学金",
    "subject": "专项奖学金",
    "language": "语言项目奖学金",
    "master / phd": "硕士 / 博士",
    "bachelor / master": "本科 / 硕士",
    "undergraduate": "本科",
    "all levels": "各学历层次",
    "official notice": "官方通知",
    "confirm current round": "确认当年轮次",
    "scholarship record": "奖学金记录",
  }[opsCityPreviewTokenKey(raw)] || raw;
}

function opsScholarshipPreviewBenefits(item = {}) {
  const source = item.benefitItems || item.benefits || item.coverage || item.amountText;
  const values = Array.isArray(source)
    ? source.map((entry) => isPlainRecord(entry) ? entry.label || entry.title || entry.value || entry.note : entry)
    : splitOpsTextList(source);
  return values.map(opsScholarshipPreviewLabel).filter(Boolean).slice(0, 4);
}

function opsScholarshipPreviewSummary(value, fallback = "") {
  const values = Array.isArray(value)
    ? value.map((entry) => isPlainRecord(entry) ? entry.label || entry.title || entry.value || entry.note : entry)
    : splitOpsTextList(value);
  const labels = values.map(opsScholarshipPreviewLabel).filter(Boolean);
  return labels.length ? labels.slice(0, 4).join("、") : fallback;
}

function renderOpsScholarshipPublicPreview(item = {}) {
  const detailHref = `scholarship-detail.html?scholarship=${encodeURIComponent(String(item.slug || item.id || slugify(item.title || "")))}`;
  const benefits = opsScholarshipPreviewBenefits(item);
  const countries = splitOpsTextList(item.targetCountries).map(opsScholarshipPreviewLabel).slice(0, 3);
  const regions = splitOpsTextList(item.targetRegions).map(opsScholarshipPreviewLabel).slice(0, 2);
  const relationSummary = opsScholarshipRelationSummary(item);
  const schoolScope = relationSummary.schoolNames.length
    ? `${relationSummary.schoolNames[0]}${relationSummary.schoolNames.length > 1 ? ` +${relationSummary.schoolNames.length - 1}` : ""}`
    : opsScholarshipPreviewLabel(item.providerName) || "学校范围待补充";
  const programScope = relationSummary.programNames.length
    ? `${relationSummary.programNames[0]}${relationSummary.programNames.length > 1 ? ` +${relationSummary.programNames.length - 1}` : ""}`
    : opsScholarshipPreviewLabel(item.applicableProgram) || "项目范围待补充";
  const fundingLabel = item.fundingLevel === "full" ? "全额资助" : item.fundingLevel === "partial" ? "部分资助" : "资助待确认";
  const scopeTags = [
    opsScholarshipPreviewLabel(item.type || item.typeLabel),
    opsScholarshipPreviewLabel(item.applicableDegree),
    opsScholarshipPreviewLabel(item.applicationRound),
    ...countries,
    ...regions,
  ].filter(Boolean).slice(0, 6);
  const metrics = [
    ["资助级别", fundingLabel],
    ["权益项", benefits.length || splitOpsTextList(item.benefits).length || 0],
    ["学校", relationSummary.schoolCount || item.schoolCount || 0],
    ["项目", relationSummary.programCount || 0],
  ];
  return `
    <section class="ops-content-public-preview ops-scholarship-public-preview ops-content-preview-canvas" data-ops-scholarship-public-preview aria-label="奖学金公开页预览">
      <div class="ops-content-preview-hero">
        <div>
          <span class="module-kicker">学生端预览</span>
          <h3>${escapeHtml(item.title || "公共奖学金草稿")}</h3>
          <p>${escapeHtml(item.summary || "摘要会显示在奖学金列表和详情页，帮助学生先判断是否值得匹配学校和项目。")}</p>
        </div>
        <a class="secondary-action" href="${escapeHtml(detailHref)}">打开公开页</a>
      </div>
      <div class="ops-content-preview-section-grid">
        <article class="ops-content-preview-feature"><span>关联学校</span><strong>${escapeHtml(schoolScope)}</strong><small>学生会据此判断奖学金是否覆盖目标学校。</small></article>
        <article class="ops-content-preview-feature"><span>适用项目</span><strong>${escapeHtml(programScope)}</strong><small>影响 Add choice 和奖学金匹配提示。</small></article>
      </div>
      <div class="ops-content-preview-metric-row">
        ${metrics.map(([label, value]) => `<article><strong>${escapeHtml(String(value ?? 0))}</strong><span>${escapeHtml(label)}</span></article>`).join("")}
      </div>
      ${benefits.length ? `<div class="ops-content-preview-step-list">${benefits.map((item, index) => `<span><b>${index + 1}</b>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      <div class="ops-content-preview-foot-strip">
        <span><strong>截止/轮次</strong>${escapeHtml(item.deadlineLabel || item.deadlineDate || item.applicationRound || "截止待补充")}</span>
        <span><strong>来源</strong>${escapeHtml(opsScholarshipPreviewLabel(item.sourceLabel || item.providerName) || "官方来源待补充")}</span>
      </div>
      ${scopeTags.length ? `<div class="ops-preview-tag-row">${scopeTags.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    </section>
  `;
}

function renderOpsCityAggregatePreview(item = {}) {
  const aggregate = item.aggregate || {};
  const metrics = [
    ["真实学校", aggregate.actualSchoolCount ?? item.actualSchoolCount ?? 0, item.referenceSchoolCount],
    ["真实项目", aggregate.actualProgramCount ?? item.actualProgramCount ?? 0, item.referenceProgramCount],
    ["英文项目", aggregate.actualEnglishProgramCount ?? item.actualEnglishProgramCount ?? 0, item.referenceEnglishProgramCount],
    ["奖学金", aggregate.actualScholarshipCount ?? item.actualScholarshipCount ?? 0, item.referenceScholarshipCount],
    ["CSCA 学校", aggregate.actualCscaRequiredSchoolCount ?? item.actualCscaRequiredSchoolCount ?? 0, item.referenceCscaSchoolCount],
  ];
  const lists = [
    ["可见学校", "CityGuideAggregate.visibleSchools", toRecordArray(item.visibleSchools || aggregate.visibleSchools).map((school) => school.nameZh || school.nameEn || school.name || school.key)],
    ["可见项目", "CityGuideAggregate.visiblePrograms", toRecordArray(item.visiblePrograms || aggregate.visiblePrograms).map((program) => program.title || program.nameZh || program.nameEn || program.key)],
    ["可见奖学金", "CityGuideAggregate.visibleScholarships", toRecordArray(item.visibleScholarships || aggregate.visibleScholarships).map((scholarship) => scholarship.title || scholarship.name || scholarship.key)],
  ];
  return `
    <div class="ops-aggregate-panel">
      <div class="ops-editor-note">真实聚合来自学校、项目和奖学金库；下方参考值只是城市页面可调整的展示提示。</div>
      <div class="ops-aggregate-grid">
        ${metrics.map(([label, actual, reference]) => `
          <article>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(actual ?? 0))}</strong>
            <small>参考 ${escapeHtml(String(reference ?? "未填"))}</small>
          </article>
        `).join("")}
      </div>
      <div class="ops-aggregate-sources">
        ${lists.map(([label, sourceField, values]) => `
          <article data-source-field="${escapeHtml(sourceField)}" title="${escapeHtml(sourceField)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(values.slice(0, 2).join(" / ") || "暂无可见样本")}</strong>
          </article>
        `).join("")}
      </div>
      ${renderOpsFieldMap("聚合字段映射", "按需展开旧项目聚合字段", lists.map(([, sourceField]) => sourceField), { compact: true })}
    </div>
  `;
}

function renderOpsCityPublicPreview(item = {}) {
  const aggregate = item.aggregate || {};
  const cityHref = `city-detail.html?city=${encodeURIComponent(String(item.slug || item.id || slugify(item.nameEn || item.nameZh || "")))}`;
  const budgetLine = cityBudgetDisplayLine({ budget: isPlainRecord(item.budgetSummary) ? item.budgetSummary : null, monthlyCost: item.monthlyCost || item.budgetSummary || "预算待补充" });
  const bestFor = splitOpsTextLines(item.bestFor).map(opsCityPreviewBestForCopy).filter(Boolean).slice(0, 3);
  const firstReason = opsCityPreviewBestForCopy(splitOpsTextLines(item.why)[0]) || item.overview || item.summary || "补充城市概览后，学生端会显示更清晰的城市选择理由。";
  const chips = [
    opsCityPreviewTagLabel(item.region),
    item.costLevel ? opsCityPreviewTagLabel(item.costLevel) : "",
    item.density ? opsCityPreviewTagLabel(item.density) : "",
    ...splitOpsTextList(item.tags).slice(0, 3).map(opsCityPreviewTagLabel),
  ].filter(Boolean).slice(0, 6);
  const metrics = [
    ["学校", aggregate.actualSchoolCount ?? item.actualSchoolCount ?? item.referenceSchoolCount ?? 0],
    ["项目", aggregate.actualProgramCount ?? item.actualProgramCount ?? item.referenceProgramCount ?? 0],
    ["英文项目", aggregate.actualEnglishProgramCount ?? item.actualEnglishProgramCount ?? item.referenceEnglishProgramCount ?? 0],
    ["奖学金", aggregate.actualScholarshipCount ?? item.actualScholarshipCount ?? item.referenceScholarshipCount ?? 0],
  ];
  return `
    <section class="ops-content-public-preview ops-city-public-preview ops-content-preview-canvas" data-ops-city-public-preview aria-label="城市公开页预览">
      <div class="ops-content-preview-hero">
        <div>
          <span class="module-kicker">学生端预览</span>
          <h3>${escapeHtml(item.nameZh || "城市草稿")} ${item.nameEn ? `<small>${escapeHtml(item.nameEn)}</small>` : ""}</h3>
          <p>${escapeHtml(item.summary || "摘要会显示在城市详情页头部，帮助学生先判断城市是否值得继续看。")}</p>
        </div>
        <a class="secondary-action" href="${escapeHtml(cityHref)}">打开公开页</a>
      </div>
      <div class="ops-content-preview-section-grid">
        <article class="ops-content-preview-feature"><span>预算提示</span><strong>${escapeHtml(textValue(budgetLine))}</strong><small>学生会先用它判断城市生活成本。</small></article>
        <article class="ops-content-preview-feature"><span>选择理由</span><strong>${escapeHtml(textValue(firstReason))}</strong><small>帮助学生判断这座城市是否适合自己。</small></article>
      </div>
      ${bestFor.length ? `<div class="ops-content-preview-step-list">${bestFor.map((item, index) => `<span><b>${index + 1}</b>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      <div class="ops-content-preview-metric-row">
        ${metrics.map(([label, value]) => `<article><strong>${escapeHtml(String(value ?? 0))}</strong><span>${escapeHtml(label)}</span></article>`).join("")}
      </div>
      ${chips.length ? `<div class="ops-preview-tag-row">${chips.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    </section>
  `;
}

function renderOpsTimelinePublicPreview(item = {}) {
  const statusLabel = opsLifecycleStatusLabel(item.status || "draft");
  const chips = [item.month, item.status, item.applicationRound].filter(Boolean).slice(0, 4);
  const metrics = [
    ["月份", item.month || "待补充"],
    ["排序", item.sortOrder || 1],
    ["状态", statusLabel],
  ];
  return `
    <section class="ops-content-public-preview ops-timeline-public-preview ops-content-preview-canvas" data-ops-timeline-public-preview aria-label="申请时间窗公开预览">
      <div class="ops-content-preview-hero">
        <div>
          <span class="module-kicker">学生端预览</span>
          <h3>${escapeHtml(item.title || "申请时间窗草稿")}</h3>
          <p>${escapeHtml(item.applicationWindow || "补充后会显示在申请时间轴和提醒视图里，帮助学生判断当前该做什么。")}</p>
        </div>
      </div>
      <div class="ops-content-preview-metric-row compact">
        ${metrics.map(([label, value]) => `<article><strong>${escapeHtml(String(value ?? "待补充"))}</strong><span>${escapeHtml(label)}</span></article>`).join("")}
      </div>
      <div class="ops-content-preview-section-grid">
        <article class="ops-content-preview-feature"><span>申请窗口</span><strong>${escapeHtml(item.applicationWindow || "待补充")}</strong><small>学生端申请时间线的主提醒。</small></article>
        <article class="ops-content-preview-feature"><span>CSCA 窗口</span><strong>${escapeHtml(item.cscaWindow || "待补充")}</strong><small>影响考试准备和报名计划。</small></article>
      </div>
      ${chips.length ? `<div class="ops-preview-tag-row">${chips.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    </section>
  `;
}

function renderOpsCityEditorGroups(item) {
  return renderOpsContentEditorGroups("cities", item, opsCityFields, opsCityFieldGroups, {
    beforeFields: (title) => title === "基础信息"
      ? renderOpsContentEditorImpactPanel("cities", item)
      : title === "资源聚合"
        ? `${renderOpsCityAggregatePreview(item)}${renderOpsCityRecordSignals(item)}`
        : "",
  });
}

function opsContentIdSet(value) {
  return new Set(splitOpsTextList(Array.isArray(value) ? value.join("\n") : value));
}

function renderOpsScholarshipSchoolPicker(item) {
  try {
    const schools = readOpsSchoolRecords(readOpsAdminState()).slice(0, 12);
    const selectedIds = opsContentIdSet(item.schoolIds);
    if (!schools.length) return "";
    return `
      <section class="ops-content-editor-section">
        <div class="ops-relation-head">
          <div>
            <h3>关联学校</h3>
            <p>从学校库勾选适用学校，保存后同步到奖学金关联学校。</p>
          </div>
          <span>已选择 <strong data-ops-scholarship-school-count>${selectedIds.size}</strong> 所学校</span>
        </div>
        <div class="ops-school-checkbox-grid" data-ops-scholarship-school-picker>
          ${schools.map((school) => {
            const id = String(school.id || "");
            const checked = selectedIds.has(id);
            return `
              <label class="${checked ? "selected" : ""}">
                <input type="checkbox" data-ops-scholarship-school-toggle value="${escapeHtml(id)}" ${checked ? "checked" : ""} />
                <span>${escapeHtml(school.nameZh || school.nameEn || id)}</span>
                <small>${escapeHtml([school.nameEn, school.cityZh || school.region].filter(Boolean).join(" · ") || "学校记录")}</small>
              </label>
            `;
          }).join("")}
        </div>
      </section>
    `;
  } catch (error) {
    console.error("CUAC ops scholarship school picker render failed", error);
    return `
      <section class="ops-content-editor-section">
        <h3>关联学校</h3>
        <p class="ops-editor-note">学校库当前有旧格式记录，奖学金草稿仍可继续编辑；保存后再回到学校数据修复关联。</p>
      </section>
    `;
  }
}

function renderOpsScholarshipProgramPicker(item) {
  try {
    const programs = readOpsSchoolRecords(readOpsAdminState()).flatMap((school) => toRecordArray(school.programs).map((program) => ({
      ...program,
      schoolName: school.nameZh || school.nameEn || "学校记录",
      schoolCity: school.cityZh || school.region || "",
    }))).slice(0, 18);
    const selectedIds = opsContentIdSet(item.programIds);
    if (!programs.length) return "";
    return `
      <section class="ops-content-editor-section">
        <div class="ops-relation-head">
          <div>
            <h3>关联项目</h3>
            <p>从项目库勾选适用项目，保存后同步到奖学金关联项目。</p>
          </div>
          <span>已选择 <strong data-ops-scholarship-program-count>${selectedIds.size}</strong> 个项目</span>
        </div>
        <div class="ops-school-checkbox-grid" data-ops-scholarship-program-picker>
          ${programs.map((program) => {
            const id = String(program.id || program.programId || "");
            const checked = selectedIds.has(id);
            return `
              <label class="${checked ? "selected" : ""}">
                <input type="checkbox" data-ops-scholarship-program-toggle value="${escapeHtml(id)}" ${checked ? "checked" : ""} />
                <span>${escapeHtml(program.nameZh || program.nameEn || program.name || id)}</span>
                <small>${escapeHtml([program.schoolName, program.degreeLevel, program.teachingLanguage, program.schoolCity].filter(Boolean).join(" · ") || "项目记录")}</small>
              </label>
            `;
          }).join("")}
        </div>
      </section>
    `;
  } catch (error) {
    console.error("CUAC ops scholarship program picker render failed", error);
    return `
      <section class="ops-content-editor-section">
        <h3>关联项目</h3>
        <p class="ops-editor-note">学校项目库当前有旧格式记录，奖学金草稿仍可继续编辑；保存后再回到学校数据修复项目关联。</p>
      </section>
    `;
  }
}

function renderOpsScholarshipImportPanel(opsState = readOpsAdminState()) {
  const open = Boolean(opsState.scholarshipImportOpen);
  const importText = opsState.scholarshipImportText || createOpsScholarshipImportExample();
  const preview = isPlainRecord(opsState.scholarshipImportPreview) ? opsState.scholarshipImportPreview : null;
  return `
    <article class="ops-import-panel ${open ? "open" : ""}">
      <button class="ops-import-toggle" data-ops-scholarship-import-toggle type="button">
        <span><strong>公共奖学金 JSON 导入</strong><small>可粘贴旧项目导出的奖学金数据；支持 { items: [...] }，也兼容数组。</small></span>
        <b>${open ? "收起" : "展开"}</b>
      </button>
      ${open ? `
        <div class="ops-import-body">
          <label class="ops-form-field wide">
            <span>JSON · { items: [...] }</span>
            <textarea data-ops-scholarship-import-text spellcheck="false">${escapeHtml(importText)}</textarea>
          </label>
          ${preview ? `<p class="${preview.tone === "success" ? "ops-inline-success" : "ops-inline-danger"}">${escapeHtml(preview.message)}</p>` : `<p class="ops-editor-note">每条记录至少需要 title。id / slug 相同会更新现有奖学金，否则新增为草稿。</p>`}
          <div class="inline-actions">
            <button class="secondary-action" data-ops-scholarship-import-example type="button">填入示例</button>
            <button class="secondary-action" data-ops-scholarship-import-preview type="button">预览校验</button>
            <button class="primary-action" data-ops-scholarship-import-apply type="button">导入奖学金</button>
          </div>
        </div>
      ` : ""}
    </article>
  `;
}

function renderOpsContentEditor(item, type, options = {}) {
  if (!item) return `<article class="ops-record-editor ops-content-editor"><p class="ops-empty">暂无内容记录。可以先新增草稿。</p></article>`;
  let safeItem;
  try {
    safeItem = type === "cities"
      ? normalizeOpsCityRecord(item, 0, { useFallback: false })
      : type === "timeline"
        ? normalizeOpsTimelineRecord(item, 0, { useFallback: false })
        : normalizeOpsScholarshipRecord(item, 0, { useFallback: false });
  } catch {
    return `
      <article class="ops-record-editor ops-content-editor ops-error-state" data-ops-content-editor data-content-type="${escapeHtml(type)}" data-content-id="">
        <span class="module-kicker">${escapeHtml(opsContentDisplayLabel(type))}编辑器</span>
        <h2>当前记录需要修复</h2>
        <p>这条本地预览记录不是可编辑的数据结构。可以新增一条草稿继续，不会影响页面其它模块。</p>
      </article>
    `;
  }
  const title = type === "cities" ? safeItem.nameZh : safeItem.title;
  const displayLabel = opsContentDisplayLabel(type);
  const statusLabel = opsLifecycleStatusLabel(safeItem.status || "draft");
  const publicSurface = type === "cities"
    ? "城市详情页"
    : type === "timeline"
      ? "申请时间窗"
      : "奖学金详情页";
  const scopeCopy = type === "cities"
    ? "编辑面向学生的城市生活、费用和学校项目聚合信息。"
    : type === "timeline"
      ? "编辑申请季节、窗口和提醒，不混进学校或奖学金记录。"
      : "编辑公共奖学金内容、适用学校和适用项目关系。";
  const fieldMap = type === "cities"
    ? ["CityGuide.content.quickFacts", "CityGuide.content.transportNotes", "CityGuide.referenceScholarshipCount", "CityGuide.referenceCscaSchoolCount"]
    : type === "timeline"
      ? ["ApplicationTimelineWindow.month", "ApplicationTimelineWindow.applicationWindow", "ApplicationTimelineWindow.cscaWindow", "ApplicationTimelineWindow.status"]
      : ["AdminScholarship.providerName", "AdminScholarship.fundingLevel", "AdminScholarship.schoolIds", "AdminScholarship.programIds"];
  return `
    <article class="ops-record-editor ops-content-editor" data-ops-content-editor data-content-type="${escapeHtml(type)}" data-content-id="${escapeHtml(safeItem.id)}" data-record-version="${escapeHtml(String(safeItem.version || 1))}">
      <div class="section-head ops-content-editor-head">
        <div><span class="module-kicker">${escapeHtml(displayLabel)}编辑器</span><h2>${escapeHtml(title)}</h2></div>
        <div class="inline-actions">
          <button class="secondary-action" data-ops-content-publish type="button">发布</button>
          <button class="secondary-action" data-ops-content-archive type="button">归档</button>
          <button class="primary-action" data-ops-content-save type="button">保存内容</button>
        </div>
      </div>
      <div class="ops-editor-alert-stack">
        <div class="ops-editor-note warn" data-ops-content-unsaved-warning hidden>
          <strong>当前内容有未保存改动。</strong>
          <span>请先保存内容，再发布或归档，避免状态变更覆盖未保存字段。</span>
        </div>
      </div>
      <section class="ops-content-editor-brief" data-ops-content-editor-brief>
        <div>
          <span class="module-kicker">当前编辑范围</span>
          <strong>${escapeHtml(publicSurface)}</strong>
          <small>${escapeHtml(scopeCopy)}</small>
        </div>
        <div class="ops-content-editor-metrics">
          <article><span>内容类型</span><strong>${escapeHtml(displayLabel)}</strong></article>
          <article><span>状态</span><strong>${escapeHtml(statusLabel)}</strong></article>
          <article><span>版本</span><strong>${escapeHtml(String(safeItem.version || 1))}</strong></article>
        </div>
      </section>
      ${renderOpsContentEditorTaskline(type, safeItem)}
      ${type === "scholarships"
        ? renderOpsScholarshipEditorGroups(safeItem, [{
          title: "关联选择",
          html: `${renderOpsScholarshipSchoolPicker(safeItem)}${renderOpsScholarshipProgramPicker(safeItem)}`,
        }])
        : type === "timeline"
          ? renderOpsTimelineEditorGroups(safeItem)
          : renderOpsCityEditorGroups(safeItem)}
      ${options.includeFieldMap === false ? "" : renderOpsFieldMap("内容字段映射", `${displayLabel}与旧项目字段对齐，默认收起`, fieldMap)}
    </article>
  `;
}

function renderOpsContentViewTabs(activeView, activeType, selected) {
  const selectedTitle = selected
    ? activeType === "cities"
      ? selected.nameZh || selected.nameEn || "当前城市"
      : selected.title || "当前记录"
    : "尚未选择记录";
  const viewCopy = {
    catalog: "覆盖、质量、筛选",
    edit: "字段、关系、发布",
    preview: "学生端可见内容",
    model: "来源、映射、审计",
  };
  return `
    <div class="ops-content-view-shell-head">
      <nav class="ops-content-view-tabs" aria-label="内容数据工作视图">
        ${opsContentViews.map(([key, label]) => `<button class="${activeView === key ? "active" : ""}" data-ops-content-view="${escapeHtml(key)}" type="button" aria-selected="${activeView === key ? "true" : "false"}"><span>${escapeHtml(label)}</span><small>${escapeHtml(viewCopy[key] || "")}</small></button>`).join("")}
      </nav>
      <div class="ops-content-selection-strip">
        <span>当前记录</span>
        <strong>${escapeHtml(selectedTitle)}</strong>
      </div>
    </div>
  `;
}

function renderOpsContentViewPanel(view, activeView, html) {
  return `<section class="ops-content-view-panel" data-ops-content-view-panel="${escapeHtml(view)}" ${activeView === view ? "" : "hidden"}>${html}</section>`;
}

function renderOpsContentWorkspaceCommand(activeType, rows = [], selected = null, activeView = "catalog") {
  const stats = buildOpsContentWorkspaceStats(activeType, rows, selected);
  const typeLabel = opsContentDisplayLabel(activeType);
  const activeLabel = opsContentViews.find(([key]) => key === activeView)?.[1] || "目录列表";
  const relationLabel = activeType === "cities"
    ? `${stats.relationTotals.schools} 所学校 / ${stats.relationTotals.programs} 个项目`
    : activeType === "scholarships"
      ? `${stats.relationTotals.schools} 所学校 / ${stats.relationTotals.programs} 个项目`
      : `${stats.relationTotals.csca} 条 CSCA 窗口`;
  const selectedCopy = selected
    ? `${stats.selectedQuality}% 质量 · ${stats.selectedMissing.length ? `${stats.selectedMissing.length} 个缺口` : "公开字段就绪"}`
    : "先选择一条记录继续处理";
  const cards = [
    { label: "内容覆盖", value: stats.total, copy: `${stats.published} 已发布 / ${stats.draft} 草稿`, tone: "coverage" },
    { label: "发布质量", value: `${stats.averageQuality}%`, copy: `${stats.publishedReady} 条发布可用`, tone: stats.averageQuality >= 75 ? "ok" : "warn" },
    { label: "关联完整", value: relationLabel, copy: selectedCopy, tone: "relations" },
    { label: "待补内容", value: stats.missing, copy: `${stats.archived} 条已归档`, tone: stats.missing ? "warn" : "ok" },
  ];
  return `
    <section class="ops-content-workspace-command" aria-label="内容数据工作台摘要">
      <div class="ops-content-workspace-copy">
        <span class="module-kicker">${escapeHtml(typeLabel)}工作台</span>
        <h3>${escapeHtml(activeLabel)} · 学生端内容供给</h3>
        <p>先看内容是否能支持学生选择和申请提醒，再处理公开预览、关联关系、字段来源和发布质量。</p>
      </div>
      <div class="ops-content-workspace-metrics">
        ${cards.map((card) => `
          <article class="${escapeHtml(card.tone)}">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(String(card.value))}</strong>
            <small>${escapeHtml(card.copy)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOpsContentSelectedTaskStrip(activeType, activeView, selected) {
  const activeViewLabel = opsContentViews.find(([key]) => key === activeView)?.[1] || "目录列表";
  if (!selected) {
    return `
      <section class="ops-content-task-strip" data-ops-content-selected-task>
        <div class="ops-content-task-copy">
          <span class="module-kicker">当前任务</span>
          <strong>先选择一条内容记录</strong>
          <small>${escapeHtml(activeViewLabel)} · 新增或导入后可继续编辑、预览和复核字段。</small>
        </div>
      </section>
    `;
  }
  const title = activeType === "cities" ? selected.nameZh || selected.nameEn : selected.title;
  const quality = opsContentQualityScore(activeType, selected);
  const missing = opsContentMissingFields(activeType, selected);
  const relation = opsContentRelationCounts(activeType, selected);
  const status = opsLifecycleStatusLabel(selected.status || "draft");
  const relationValue = activeType === "cities"
    ? `${relation.schools}/${relation.programs}`
    : activeType === "scholarships"
      ? `${relation.schools}/${relation.programs}`
      : relation.csca ? "CSCA" : "待补";
  const relationLabel = activeType === "timeline" ? "窗口" : "关联";
  const nextAction = missing.length
    ? `先补齐 ${missing.slice(0, 2).join("、")}${missing.length > 2 ? ` 等 ${missing.length} 项` : ""}`
    : "可进入公开预览和发布前复核";
  return `
    <section class="ops-content-task-strip" data-ops-content-selected-task data-content-type="${escapeHtml(activeType)}" data-content-id="${escapeHtml(selected.id)}">
      <div class="ops-content-task-copy">
        <span class="module-kicker">当前内容任务</span>
        <strong>${escapeHtml(title || "内容草稿")}</strong>
        <small>${escapeHtml(activeViewLabel)} · ${escapeHtml(nextAction)}</small>
      </div>
      <div class="ops-content-task-metrics" aria-label="当前内容状态">
        <span><strong>${escapeHtml(String(quality))}%</strong> 质量</span>
        <span><strong>${escapeHtml(String(missing.length))}</strong> 缺字段</span>
        <span><strong>${escapeHtml(relationValue)}</strong> ${escapeHtml(relationLabel)}</span>
        <span><strong>${escapeHtml(status)}</strong> 状态</span>
      </div>
    </section>
  `;
}

function renderOpsContentCatalogInsights(activeType, rows = []) {
  const stats = buildOpsContentWorkspaceStats(activeType, rows);
  const cards = activeType === "cities"
    ? [
      { label: "城市覆盖", value: stats.total, note: `${stats.relationTotals.schools} 所学校`, tone: "coverage" },
      { label: "项目资源", value: stats.relationTotals.programs, note: `${stats.relationTotals.scholarships} 条奖学金`, tone: "relations" },
      { label: "CSCA 可见", value: stats.relationTotals.csca, note: "城市页需要提示考试准备", tone: "rules" },
      { label: "质量缺口", value: stats.missing, note: `${stats.averageQuality}% 平均质量`, tone: stats.missing ? "warn" : "ok" },
    ]
    : activeType === "scholarships"
      ? [
        { label: "奖学金库", value: stats.total, note: `${stats.published} 条已发布`, tone: "coverage" },
        { label: "关联学校", value: stats.relationTotals.schools, note: "影响学生匹配范围", tone: "relations" },
        { label: "关联项目", value: stats.relationTotals.programs, note: "影响 Add choice 推荐", tone: "programs" },
        { label: "质量缺口", value: stats.missing, note: `${stats.averageQuality}% 平均质量`, tone: stats.missing ? "warn" : "ok" },
      ]
      : [
        { label: "时间窗", value: stats.total, note: `${stats.published} 条已发布`, tone: "coverage" },
        { label: "CSCA 提醒", value: stats.relationTotals.csca, note: "影响考试准备提示", tone: "rules" },
        { label: "发布质量", value: `${stats.averageQuality}%`, note: `${stats.publishedReady} 条可用`, tone: stats.averageQuality >= 75 ? "ok" : "warn" },
        { label: "待补内容", value: stats.missing, note: "申请窗口不能缺", tone: stats.missing ? "warn" : "ok" },
      ];
  return `
    <section class="ops-content-catalog-insights" aria-label="内容目录健康摘要">
      ${cards.map((card) => `
        <article class="${escapeHtml(card.tone)}">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(String(card.value))}</strong>
          <small>${escapeHtml(card.note)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOpsContentCatalogPanel(activeType, visibleRows, selected, selectedHiddenByFilter, opsState, allRows = visibleRows) {
  return `
    ${renderOpsContentCatalogInsights(activeType, allRows)}
    <section class="ops-content-catalog-command" aria-label="内容数据操作">
      <div class="ops-content-catalog-copy">
        <span class="module-kicker">目录维护</span>
        <strong>先选记录，再编辑、预览或检查映射</strong>
        <p>${activeType === "scholarships" ? "公共奖学金支持导入草稿；城市和时间窗通过结构化表单维护，避免把自由 JSON 暴露给日常运营。" : "新增后自动进入编辑视图，补齐学生端公开内容和可审计字段。"}</p>
      </div>
      <div class="ops-content-catalog-actions">
        <button class="primary-action micro" data-ops-content-create data-content-type="${escapeHtml(activeType)}" type="button">新增${escapeHtml(opsContentCreateLabel(activeType))}</button>
        ${activeType === "scholarships" ? `<button class="secondary-action micro" data-ops-scholarship-import-toggle type="button">${opsState.scholarshipImportOpen ? "收起导入" : "导入草稿"}</button>` : `<button class="secondary-action micro" data-ops-content-view="edit" type="button">编辑当前</button>`}
        <button class="secondary-action micro" data-ops-content-view="preview" type="button">公开预览</button>
        <button class="secondary-action micro" data-ops-content-view="model" type="button">字段与审计</button>
      </div>
    </section>
    <div class="ops-filter-bar" aria-label="内容数据筛选">
      <label><span>搜索内容</span><input data-ops-content-search value="${escapeHtml(opsState.contentSearch || "")}" placeholder="标题、slug、地区、提供方、申请窗口" /></label>
      <label><span>发布状态</span><select data-ops-content-status-filter><option value="all">全部状态</option><option value="published" ${opsState.contentStatusFilter === "published" ? "selected" : ""}>已发布</option><option value="draft" ${opsState.contentStatusFilter === "draft" ? "selected" : ""}>草稿</option><option value="archived" ${opsState.contentStatusFilter === "archived" ? "selected" : ""}>已归档</option></select></label>
      <button class="secondary-action" data-ops-content-apply-filter type="button">筛选内容</button>
    </div>
    ${activeType === "scholarships" ? renderOpsScholarshipImportPanel(opsState) : ""}
    ${selectedHiddenByFilter ? `<p class="ops-inline-success" data-ops-content-filter-selected>当前选中记录已保留在列表顶部，避免被筛选条件隐藏。</p>` : ""}
    <div class="ops-content-catalog-grid">
      <div class="ops-management-table">${visibleRows.map((item, index) => renderOpsContentCardSafe(item, activeType, selected?.id, index)).join("") || `<p class="ops-empty">没有匹配的内容记录。调整筛选条件或新增${opsContentCreateLabel(activeType)}草稿。</p>`}</div>
    </div>
  `;
}

function renderOpsContentPublicChecks(activeType, selected = {}) {
  const missing = opsContentMissingFields(activeType, selected);
  const relation = opsContentRelationCounts(activeType, selected);
  const checks = activeType === "scholarships"
    ? [
      ["公开身份", selected.title && selected.providerName ? "完整" : "待补", opsScholarshipPreviewLabel(selected.providerName) || "提供方待补充"],
      ["资助判断", selected.fundingLevel && (selected.amountText || selected.coverage) ? "可判断" : "待补", opsScholarshipPreviewSummary(selected.amountText || selected.coverage, "金额/覆盖待补充")],
      ["申请条件", selected.requirementText ? "已填写" : "待补", selected.requirementText || "缺少资格和申请要求"],
      ["匹配范围", relation.schools || relation.programs ? `${relation.schools}/${relation.programs}` : "待关联", "学校 / 项目"],
    ]
    : activeType === "timeline"
      ? [
        ["公开身份", selected.month && selected.title ? "完整" : "待补", selected.month || "月份待补充"],
        ["申请提醒", selected.applicationWindow ? "已填写" : "待补", selected.applicationWindow || "缺少申请窗口文案"],
        ["CSCA 提醒", selected.cscaWindow ? "已填写" : "待补", selected.cscaWindow || "缺少考试窗口文案"],
        ["发布状态", opsLifecycleStatusLabel(selected.status || "draft"), "影响学生端时间线"],
      ]
      : [
        ["公开身份", selected.nameZh && selected.nameEn && selected.slug ? "完整" : "待补", selected.nameEn || "英文名待补充"],
        ["城市判断", selected.summary && selected.bestFor ? "可判断" : "待补", selected.summary || "摘要待补充"],
        ["资源聚合", relation.schools || relation.programs ? `${relation.schools}/${relation.programs}` : "待补", "学校 / 项目"],
        ["预算提示", selected.monthlyCost || selected.budgetSummary || selected.quickFacts ? "已填写" : "待补", selected.monthlyCost || "生活成本待补充"],
      ];
  return `
    <aside class="ops-content-preview-checks" aria-label="公开字段检查">
      <span class="module-kicker">公开字段检查</span>
      <h3>学生端会不会看懂</h3>
      <p>这里只检查进入公开页、筛选器、推荐和提醒的字段；来源与映射留在字段页。</p>
      <div class="ops-content-preview-check-list">
        ${checks.map(([label, value, copy]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(copy)}</small></article>`).join("")}
      </div>
      <div class="ops-editor-note ${missing.length ? "warn" : ""}">
        <strong>${missing.length ? `${missing.length} 个字段影响公开质量` : "公开字段已就绪"}</strong>
        <span>${escapeHtml(missing.slice(0, 3).join("、") || "可以继续检查学生端文案和排序。")}</span>
      </div>
    </aside>
  `;
}

function renderOpsContentPreviewPanel(selected, activeType) {
  if (!selected) return `<p class="ops-empty">暂无可预览记录。可以先新增草稿。</p>`;
  const preview = activeType === "cities"
    ? renderOpsCityPublicPreview(selected)
    : activeType === "timeline"
      ? renderOpsTimelinePublicPreview(selected)
      : renderOpsScholarshipPublicPreview(selected);
  return `
    <div class="ops-content-preview-workspace ops-content-preview-grid">
      <div class="ops-content-preview-main">${preview}</div>
      ${renderOpsContentPublicChecks(activeType, selected)}
    </div>
  `;
}

function renderOpsContentModelPanel(selected, activeType, contentFields) {
  const displayLabel = opsContentDisplayLabel(activeType);
  const quality = selected ? opsContentQualityScore(activeType, selected) : 0;
  const missing = selected ? opsContentMissingFields(activeType, selected) : [];
  const relation = selected ? opsContentRelationCounts(activeType, selected) : { schools: 0, programs: 0, scholarships: 0, csca: 0 };
  const sourceFresh = selected?.lastVerifiedAt || selected?.updatedAt || "待核验";
  const relationCopy = activeType === "timeline"
    ? `${relation.csca ? "CSCA 窗口已配置" : "CSCA 窗口待补"}`
    : `${relation.schools} 所学校 / ${relation.programs} 个项目`;
  const editorFields = activeType === "cities"
    ? ["CityGuide.content.quickFacts", "CityGuide.content.transportNotes", "CityGuideAggregate.visibleSchools", "CityGuideAggregate.visiblePrograms", "CityGuideAggregate.visibleScholarships"]
    : activeType === "timeline"
      ? ["ApplicationTimelineWindow.month", "ApplicationTimelineWindow.applicationWindow", "ApplicationTimelineWindow.cscaWindow", "ApplicationTimelineWindow.status"]
      : ["AdminScholarship.providerName", "AdminScholarship.fundingLevel", "AdminScholarship.schoolIds", "AdminScholarship.programIds", "ScholarshipSchool", "ScholarshipProgram"];
  return `
    <div class="ops-content-model-grid">
      <article class="ops-content-model-card">
        <span class="module-kicker">CSCAlite 对齐</span>
        <h3>${escapeHtml(displayLabel)}字段映射</h3>
        <p>这里集中检查字段覆盖、来源可信度、关联完整度和旧项目字段对应关系。日常编辑不需要反复看到这些字段细节。</p>
      </article>
      ${selected ? `
        <section class="ops-content-governance-strip" aria-label="内容数据治理摘要">
          <article><span>字段覆盖</span><strong>${escapeHtml(String(quality))}%</strong><small>${missing.length ? `${missing.length} 个缺口` : "暂无关键缺口"}</small></article>
          <article><span>来源核验</span><strong>${escapeHtml(sourceFresh)}</strong><small>${escapeHtml(selected.sourceLabel || selected.providerName || "来源待补充")}</small></article>
          <article><span>关联完整</span><strong>${escapeHtml(relationCopy)}</strong><small>影响公开页和推荐入口</small></article>
        </section>
      ` : ""}
      ${selected ? renderOpsFieldMap("记录字段映射", "后台字段来源，发布和接口定型时检查", contentFields) : ""}
      ${selected ? renderOpsFieldMap("编辑字段映射", "当前记录在编辑器中的可维护字段", editorFields) : ""}
    </div>
  `;
}

function renderOpsContentPanel(cityRows, scholarshipRows, timelineRows, opsState) {
  try {
    const activeType = activeOpsContentType(opsState);
    const rows = opsContentRecordsForType(activeType, cityRows, scholarshipRows, timelineRows);
    const filteredRows = filterOpsContentRecords(rows, activeType, opsState);
    const selectedKey = opsContentStateKey(activeType);
    const selectedFromRows = getOpsSelectedContent(rows, selectedKey, opsState);
    const selectedHiddenByFilter = Boolean(selectedFromRows && !filteredRows.some((item) => String(item.id) === String(selectedFromRows.id)));
    const visibleRows = selectedHiddenByFilter ? [selectedFromRows, ...filteredRows] : filteredRows;
    const selected = selectedFromRows || getOpsSelectedContent(visibleRows.length ? visibleRows : rows, selectedKey, opsState);
    const tabCounts = { cities: cityRows.length, scholarships: scholarshipRows.length, timeline: timelineRows.length };
    const contentFields = activeType === "cities"
      ? ["CityGuide.slug", "CityGuide.nameZh", "CityGuide.contentJson", "CityGuide.referenceProgramCount", "CityGuide.referenceScholarshipCount"]
      : activeType === "timeline"
        ? ["ApplicationTimelineWindow.month", "ApplicationTimelineWindow.title", "ApplicationTimelineWindow.applicationWindow", "ApplicationTimelineWindow.cscaWindow", "ApplicationTimelineWindow.status"]
        : ["Scholarship.slug", "Scholarship.title", "Scholarship.fundingLevel", "Scholarship.bodySections", "Scholarship.actionLinks"];
    const activeView = activeOpsContentViewForState(opsState);
    return `
      <section ${opsTabPanelAttrs("content", opsState)}>
        <div class="main-stack full">
          <article class="ops-management-surface ops-content-management">
            <div class="section-head"><div><span class="module-kicker">内容目录</span><h2>城市、公共奖学金与申请时间窗管理</h2><p>维护学生端公开内容、筛选入口、申请提醒和 CSCAlite 字段映射。</p></div></div>
            <nav class="ops-editor-tabs" aria-label="内容数据分区">
              ${opsContentTabs.map(([key, label]) => `<button class="${activeType === key ? "active" : ""}" data-ops-content-tab="${escapeHtml(key)}" type="button">${escapeHtml(label)} <small>${tabCounts[key] || 0}</small></button>`).join("")}
            </nav>
            ${renderOpsContentWorkspaceCommand(activeType, rows, selected, activeView)}
            ${renderOpsContentViewTabs(activeView, activeType, selected)}
            ${renderOpsContentSelectedTaskStrip(activeType, activeView, selected)}
            <div class="ops-content-view-stack">
              ${renderOpsContentViewPanel("catalog", activeView, renderOpsContentCatalogPanel(activeType, visibleRows, selected, selectedHiddenByFilter, opsState, rows))}
              ${renderOpsContentViewPanel("edit", activeView, renderOpsContentEditor(selected, activeType, { includeFieldMap: false }))}
              ${renderOpsContentViewPanel("preview", activeView, renderOpsContentPreviewPanel(selected, activeType))}
              ${renderOpsContentViewPanel("model", activeView, renderOpsContentModelPanel(selected, activeType, contentFields))}
            </div>
          </article>
        </div>
      </section>
    `;
  } catch (error) {
    console.error("CUAC ops content panel render failed", error);
    const activeType = activeOpsContentType(opsState);
    return `
      <section ${opsTabPanelAttrs("content", opsState)}>
        <div class="main-stack full">
          <article class="ops-management-surface ops-content-management">
            <div class="section-head"><div><span class="module-kicker">内容目录</span><h2>城市、公共奖学金与申请时间窗管理</h2><p>本地预览状态需要恢复，先新增草稿继续。</p></div></div>
            <nav class="ops-editor-tabs" aria-label="内容数据分区">
              ${opsContentTabs.map(([key, label]) => `<button class="${activeType === key ? "active" : ""}" data-ops-content-tab="${escapeHtml(key)}" type="button">${escapeHtml(label)}</button>`).join("")}
            </nav>
            <article class="ops-error-state" role="alert">
              <strong>内容记录需要恢复</strong>
              <p>本地预览状态里有旧格式内容。可以直接点新增草稿继续，或重置本地预览状态。</p>
            </article>
          </article>
        </div>
      </section>
    `;
  }
}

function defaultOpsStudentRecords() {
  return [
    {
      id: "maya-chen",
      name: "Maya Chen",
      email: "maya@example.com",
      phone: "+60 12 000 0000",
      country: "马来西亚",
      stage: "硕士",
      funding: "奖学金可能",
      language: "IELTS / 可豁免",
      studyLevel: "master",
      teachingLanguagePreference: "english",
      budgetRange: "8000_15000_usd",
      scholarshipNeed: "preferred",
      selfFundingTolerance: "partial_self_funded",
      financialProofStatus: "preparing",
      fundingSource: "family_scholarship",
      lowCostPreference: "preferred",
      hskStatus: "not_applicable",
      hskCurrentLevel: "",
      hskTargetLevel: "",
      cscaStatus: "preparing",
      englishTestStatus: "score_ready",
      otherExamStatus: "not_required_yet",
      interviewReadiness: "preparing",
      profileCompletionStatus: "complete",
      contactInfoStatus: "complete",
      passportStatus: "ready",
      educationHistoryStatus: "complete",
      transcriptStatus: "ready",
      degreeProofStatus: "preparing",
      recommendationStatus: "ready",
      studyPlanStatus: "ready",
      translationNotaryStatus: "preparing",
      documentChecklistCompletion: 82,
      choiceStage: "application_set",
      applicationSubmissionStage: "sent",
      schoolSendStatus: "sent",
      priorityFactors: ["英文授课", "奖学金", "计算机方向", "一线城市机会"],
      status: "已发送给学校",
      payment: "已支付 USD 40",
      paymentState: "paid",
      accountRole: "student",
      accountStatus: "active",
      emailVerified: true,
      accountCreatedAt: "2026-08-10",
      accountUpdatedAt: "2026-08-17 09:20",
      lastLoginAt: "2026-08-17 09:10",
      agentAccessStatus: "免费可用",
      agentMemoryState: "保留至入学",
      agentMemoryUntil: "2027-09",
      accessScope: "学生 Hub、申请中心、Agent 长期上下文",
      priority: "高优先级",
      next: "浙江大学今天需跟进",
      updatedAt: "2026-08-17 09:20",
      schoolsSent: 3,
      consent: "已确认",
      documentPolicy: "CUAC 不收文件",
      choices: [
        { school: "浙江大学", city: "杭州", program: "Computer Science MSc", major: "计算机", scholarship: "校级奖学金", fee: "Included", sent: "已发送", tenantStatus: "需首次联系" },
        { school: "南京大学", city: "南京", program: "Software Engineering MSc", major: "计算机", scholarship: "CSC 可能", fee: "USD 20", sent: "已发送", tenantStatus: "等待学校处理" },
        { school: "对外经济贸易大学", city: "北京", program: "International Trade MSc", major: "商科", scholarship: "待确认", fee: "USD 20", sent: "已发送", tenantStatus: "已接收" },
      ],
      timeline: ["学生完成申请集", "支付成功", "CUAC 已向 3 所学校发送记录"],
    },
    {
      id: "ahmed-khan",
      name: "Ahmed Khan",
      email: "ahmed@example.com",
      phone: "+92 300 000 0000",
      country: "巴基斯坦",
      stage: "本科",
      funding: "自费优先",
      language: "英语授课",
      studyLevel: "bachelor",
      teachingLanguagePreference: "english",
      budgetRange: "3000_8000_usd",
      scholarshipNeed: "optional",
      selfFundingTolerance: "fully_self_funded_ok",
      financialProofStatus: "not_started",
      fundingSource: "family",
      lowCostPreference: "required",
      hskStatus: "not_applicable",
      hskCurrentLevel: "",
      hskTargetLevel: "",
      cscaStatus: "unknown",
      englishTestStatus: "preparing",
      otherExamStatus: "not_required_yet",
      interviewReadiness: "not_started",
      profileCompletionStatus: "incomplete",
      contactInfoStatus: "missing",
      passportStatus: "preparing",
      educationHistoryStatus: "incomplete",
      transcriptStatus: "preparing",
      degreeProofStatus: "not_required_yet",
      recommendationStatus: "not_started",
      studyPlanStatus: "not_started",
      translationNotaryStatus: "unknown",
      documentChecklistCompletion: 36,
      choiceStage: "checklist",
      applicationSubmissionStage: "drafting",
      schoolSendStatus: "not_sent",
      priorityFactors: ["低成本", "英文授课", "录取把握"],
      status: "资料不完整",
      payment: "仅首所学校",
      paymentState: "included",
      accountRole: "student",
      accountStatus: "active",
      emailVerified: false,
      accountCreatedAt: "2026-08-16",
      accountUpdatedAt: "2026-08-16 16:45",
      lastLoginAt: "2026-08-16 16:40",
      agentAccessStatus: "免费可用",
      agentMemoryState: "登录后长期保留",
      agentMemoryUntil: "待入学确认",
      accessScope: "学生 Hub、未完成申请、Agent 继续操作",
      priority: "普通",
      next: "补充电话和教育阶段",
      updatedAt: "2026-08-16 16:45",
      schoolsSent: 0,
      consent: "待确认",
      documentPolicy: "未发送学校",
      choices: [
        { school: "南京大学", city: "南京", program: "Economics BA", major: "经济学", scholarship: "无", fee: "Included", sent: "未发送", tenantStatus: "等待学生信息" },
        { school: "浙江大学", city: "杭州", program: "International Business BA", major: "商科", scholarship: "待确认", fee: "USD 20", sent: "未支付", tenantStatus: "不可见" },
      ],
      timeline: ["学生保存选择", "资料字段缺失", "等待继续申请"],
    },
    {
      id: "ana-souza",
      name: "Ana Souza",
      email: "ana@example.com",
      phone: "+55 11 0000 0000",
      country: "巴西",
      stage: "语言",
      funding: "奖学金敏感",
      language: "中文预科",
      studyLevel: "language",
      teachingLanguagePreference: "chinese",
      budgetRange: "3000_8000_usd",
      scholarshipNeed: "required",
      selfFundingTolerance: "full_scholarship_only",
      financialProofStatus: "ready",
      fundingSource: "scholarship_family",
      lowCostPreference: "required",
      hskStatus: "registered",
      hskCurrentLevel: "HSK 3",
      hskTargetLevel: "HSK 4",
      cscaStatus: "not_applicable",
      englishTestStatus: "not_applicable",
      otherExamStatus: "not_required_yet",
      interviewReadiness: "ready",
      profileCompletionStatus: "complete",
      contactInfoStatus: "complete",
      passportStatus: "ready",
      educationHistoryStatus: "complete",
      transcriptStatus: "ready",
      degreeProofStatus: "ready",
      recommendationStatus: "not_required_yet",
      studyPlanStatus: "ready",
      translationNotaryStatus: "ready",
      documentChecklistCompletion: 91,
      choiceStage: "submitted",
      applicationSubmissionStage: "school_contacted",
      schoolSendStatus: "school_contacted",
      priorityFactors: ["奖学金", "中文提升", "生活成本"],
      status: "学校已联系",
      payment: "已包含",
      paymentState: "paid",
      accountRole: "student",
      accountStatus: "disabled",
      emailVerified: true,
      accountCreatedAt: "2026-08-01",
      accountUpdatedAt: "2026-08-15 11:10",
      lastLoginAt: "2026-08-15 10:58",
      agentAccessStatus: "账号暂停",
      agentMemoryState: "暂停写入",
      agentMemoryUntil: "账号恢复后继续",
      accessScope: "账号停用；学校记录仍保留租户可见",
      priority: "普通",
      next: "汇总联系结果",
      updatedAt: "2026-08-15 11:10",
      schoolsSent: 1,
      consent: "已确认",
      documentPolicy: "学校直接索取文件",
      choices: [
        { school: "北京语言大学", city: "北京", program: "Chinese Language Program", major: "语言", scholarship: "语言项目奖学金", fee: "Included", sent: "已发送", tenantStatus: "学校已联系" },
      ],
      timeline: ["学生提交语言项目", "学校租户已接收", "学校已联系学生"],
    },
  ];
}

function normalizeOpsStudentRecord(student, index = 0) {
  const fallback = defaultOpsStudentRecords()[index] || {};
  const record = isPlainRecord(student) ? student : {};
  return {
    ...fallback,
    ...record,
    id: record.id || fallback.id || `student-${index + 1}`,
    name: record.name || fallback.name || "学生草稿",
    email: record.email || fallback.email || "student@example.com",
    accountRole: record.accountRole || fallback.accountRole || "student",
    accountStatus: record.accountStatus || fallback.accountStatus || "active",
    emailVerified: typeof record.emailVerified === "boolean" ? record.emailVerified : Boolean(fallback.emailVerified),
    accountCreatedAt: record.accountCreatedAt || fallback.accountCreatedAt || "",
    accountUpdatedAt: record.accountUpdatedAt || fallback.accountUpdatedAt || record.updatedAt || fallback.updatedAt || "",
    lastLoginAt: record.lastLoginAt || fallback.lastLoginAt || "",
    agentAccessStatus: record.agentAccessStatus || fallback.agentAccessStatus || (record.accountStatus === "disabled" ? "账号暂停" : "免费可用"),
    agentMemoryState: record.agentMemoryState || fallback.agentMemoryState || "登录后长期保留",
    agentMemoryUntil: record.agentMemoryUntil || fallback.agentMemoryUntil || "待确认",
    accessScope: record.accessScope || fallback.accessScope || "学生 Hub、申请中心、Agent 上下文",
    choices: toRecordArray(record.choices || fallback.choices),
    timeline: toArray(record.timeline || fallback.timeline),
  };
}

function readOpsStudentRecords(state = readOpsAdminState()) {
  const records = Array.isArray(state.studentRecords) && state.studentRecords.length ? state.studentRecords : defaultOpsStudentRecords();
  return records.map((student, index) => normalizeOpsStudentRecord(student, index));
}

function getOpsSelectedStudent(records, state = readOpsAdminState()) {
  return records.find((item) => item.id === state.selectedStudentId) || records[0] || null;
}

function filterOpsStudents(records, state = readOpsAdminState()) {
  const search = String(state.studentSearch || "").trim().toLowerCase();
  const filter = state.studentFilter || "all";
  return records.filter((student) => {
    const matchesFilter = filter === "all" || student.status === filter || student.paymentState === filter || student.accountStatus === filter || student.accountRole === filter || student.choiceStage === filter || student.schoolSendStatus === filter;
    const haystack = [
      student.name,
      student.email,
      student.country,
      student.stage,
      student.status,
      student.accountRole,
      opsStudentRoleLabel(student.accountRole),
      student.accountStatus,
      opsStudentAccountStatusLabel(student.accountStatus),
      student.paymentState,
      opsStudentPaymentStateLabel(student.paymentState),
      opsInsightLabel("choiceStage", student.choiceStage),
      opsInsightLabel("applicationSubmissionStage", student.applicationSubmissionStage),
      opsInsightLabel("schoolSendStatus", student.schoolSendStatus),
      opsInsightLabel("budgetRange", student.budgetRange),
      opsInsightLabel("scholarshipNeed", student.scholarshipNeed),
      opsInsightLabel("financialProofStatus", student.financialProofStatus),
      opsInsightLabel("hskStatus", student.hskStatus),
      opsInsightLabel("cscaStatus", student.cscaStatus),
      opsInsightLabel("englishTestStatus", student.englishTestStatus),
      student.agentMemoryState,
      toArray(student.priorityFactors).join(" "),
      toArray(student.choices).map((choice) => [choice.school, choice.city, choice.program, choice.major, choice.scholarship, choice.sent, choice.tenantStatus].filter(Boolean).join(" ")).join(" "),
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesFilter && (!search || haystack.includes(search));
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createOpsStudentCsv(records = []) {
  const headers = ["学生ID", "姓名", "邮箱", "角色", "账号状态", "邮箱验证", "Agent服务", "Agent记忆", "最后登录", "电话", "国家地区", "申请阶段", "学位层级", "授课偏好", "资金意向", "预算范围", "奖学金需求", "资金证明", "语言状态", "HSK状态", "CSCA状态", "英文考试", "材料完成度", "申请状态", "申请提交阶段", "支付说明", "支付状态", "学校发送状态", "已发送学校", "学校选择", "下一步", "更新时间"];
  const rows = records.map((student) => [
    student.id,
    student.name,
    student.email,
    opsStudentRoleLabel(student.accountRole),
    opsStudentAccountStatusLabel(student.accountStatus),
    student.emailVerified ? "已验证" : "未验证",
    student.agentAccessStatus,
    student.agentMemoryState,
    student.lastLoginAt,
    student.phone,
    student.country,
    student.stage,
    opsInsightLabel("studyLevel", student.studyLevel),
    opsInsightLabel("teachingLanguagePreference", student.teachingLanguagePreference),
    student.funding,
    opsInsightLabel("budgetRange", student.budgetRange),
    opsInsightLabel("scholarshipNeed", student.scholarshipNeed),
    opsInsightLabel("financialProofStatus", student.financialProofStatus),
    student.language,
    opsInsightLabel("hskStatus", student.hskStatus),
    opsInsightLabel("cscaStatus", student.cscaStatus),
    opsInsightLabel("englishTestStatus", student.englishTestStatus),
    student.documentChecklistCompletion === undefined ? "待确认" : `${student.documentChecklistCompletion}%`,
    student.status,
    opsInsightLabel("applicationSubmissionStage", student.applicationSubmissionStage),
    student.payment,
    opsStudentPaymentStateLabel(student.paymentState),
    opsInsightLabel("schoolSendStatus", student.schoolSendStatus),
    student.schoolsSent,
    toArray(student.choices).map((choice) => `${choice.school} / ${choice.program} / ${choice.sent}`).join("; "),
    student.next,
    student.updatedAt,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function renderOpsStudentExportPanel(opsState = readOpsAdminState()) {
  if (!opsState.studentExportCsv) return "";
  return `
    <article class="ops-import-panel open" data-ops-student-export-panel>
      <button class="ops-import-toggle" data-ops-student-export-collapse type="button">
        <span><strong>学生申请 CSV 汇总</strong><small>对齐 CSCAlite 成员 CSV 导出；当前包含 ${escapeHtml(String(opsState.studentExportCount || 0))} 条学生申请记录。</small></span>
        <b>收起</b>
      </button>
      <div class="ops-import-body">
        <label class="ops-form-field wide">
          <span>CSV · 学生申请导出</span>
          <textarea class="ops-json-editor" data-ops-student-export-csv readonly>${escapeHtml(opsState.studentExportCsv)}</textarea>
        </label>
        <div class="inline-actions">
          <button class="secondary-action" data-ops-student-download-csv type="button">下载 CSV</button>
          <button class="secondary-action" data-ops-student-export-collapse type="button">关闭</button>
        </div>
      </div>
    </article>
  `;
}

function studentPaymentTone(state) {
  if (state === "paid") return "";
  if (state === "included") return "warn";
  return "danger";
}

function studentAccountTone(status) {
  if (status === "disabled") return "danger";
  if (status === "pending" || status === "invited") return "warn";
  return "";
}

function opsStudentRoleLabel(role) {
  return {
    student: "学生",
    school_staff: "学校老师",
    cuac_ops: "CUAC 运营",
    cuac_admin: "CUAC 管理员",
  }[role] || role || "未设置";
}

function opsStudentAccountStatusLabel(status) {
  return {
    active: "账号启用",
    disabled: "账号停用",
    pending: "待验证",
    invited: "已邀请",
  }[status] || status || "状态待确认";
}

function opsStudentPaymentStateLabel(state) {
  return {
    paid: "已支付",
    included: "仅首所学校",
    pending: "待支付",
    failed: "支付异常",
    "failed-preview": "支付异常",
    preview: "待确认",
  }[state] || state || "待确认";
}

function opsStudentIsProfileReady(student = {}) {
  return student.profileCompletionStatus === "complete" && Number(student.documentChecklistCompletion || 0) >= 70;
}

function opsStudentIsExamReady(student = {}) {
  const hskReady = ["ready", "score_ready", "not_applicable"].includes(student.hskStatus);
  const cscaReady = ["ready", "score_ready", "not_applicable", "not_required_yet"].includes(student.cscaStatus);
  const englishReady = ["ready", "score_ready", "not_applicable", "not_required_yet"].includes(student.englishTestStatus);
  return hskReady && cscaReady && englishReady;
}

function opsStudentIsFinancialReady(student = {}) {
  return ["ready", "not_required_yet"].includes(student.financialProofStatus);
}

function opsStudentIsSent(student = {}) {
  return ["sent", "school_viewed", "school_contacted"].includes(student.schoolSendStatus);
}

function opsStudentQueueState(student = {}) {
  if (student.accountStatus === "disabled") return { label: "账号暂停", tone: "danger", copy: "先恢复账号或确认学校记录是否继续保留。" };
  if (!opsStudentIsProfileReady(student)) return { label: "需补材料", tone: "danger", copy: student.next || "学生资料或材料完成度不足，暂不适合发送学校。" };
  if (student.paymentState !== "paid") return { label: "待支付确认", tone: student.paymentState === "failed" ? "danger" : "warn", copy: "确认支付后再进入学校可见记录。" };
  if (!opsStudentIsSent(student)) return { label: "可发送学校", tone: "ready", copy: "资料和支付已过门禁，下一步处理学校发送。" };
  if (student.schoolSendStatus === "school_contacted") return { label: "学校已联系", tone: "ok", copy: "进入联系结果汇总和后续跟进。" };
  return { label: "等待学校处理", tone: "warn", copy: "学校记录已可见，关注查看和首次联系。" };
}

function opsStudentGateRows(student = {}) {
  const docPercent = Number(student.documentChecklistCompletion || 0);
  const profileReady = opsStudentIsProfileReady(student);
  const paymentReady = student.paymentState === "paid";
  const sent = opsStudentIsSent(student);
  const contacted = student.schoolSendStatus === "school_contacted" || student.applicationSubmissionStage === "school_contacted";
  return [
    {
      key: "profile",
      label: "资料门禁",
      value: profileReady ? "可用" : "需补",
      tone: profileReady ? "ok" : docPercent < 50 ? "danger" : "warn",
      copy: `${docPercent || 0}% 材料 · ${opsInsightLabel("profileCompletionStatus", student.profileCompletionStatus)}`,
    },
    {
      key: "payment",
      label: "支付门禁",
      value: paymentReady ? "通过" : opsStudentPaymentStateLabel(student.paymentState),
      tone: paymentReady ? "ok" : student.paymentState === "failed" ? "danger" : "warn",
      copy: student.payment || "支付状态待确认",
    },
    {
      key: "send",
      label: "学校发送",
      value: sent ? opsInsightLabel("schoolSendStatus", student.schoolSendStatus) : "未发送",
      tone: sent ? "ok" : paymentReady && profileReady ? "ready" : "warn",
      copy: `${Number(student.schoolsSent || 0)} 所已发送 · ${toArray(student.choices).length} 个选择`,
    },
    {
      key: "school",
      label: "学校处理",
      value: contacted ? "已联系" : sent ? "待学校处理" : "未进入学校",
      tone: contacted ? "ok" : sent ? "warn" : "muted",
      copy: student.next || "等待下一步",
    },
  ];
}

function opsStudentReadinessGroups(student = {}) {
  return [
    {
      title: "学生画像",
      tone: opsStudentIsProfileReady(student) ? "ok" : "warn",
      items: [
        ["国家", student.country],
        ["阶段", student.stage],
        ["学位", opsInsightLabel("studyLevel", student.studyLevel)],
        ["授课", opsInsightLabel("teachingLanguagePreference", student.teachingLanguagePreference)],
      ],
    },
    {
      title: "经济与奖学金",
      tone: opsStudentIsFinancialReady(student) ? "ok" : "warn",
      items: [
        ["预算", opsInsightLabel("budgetRange", student.budgetRange)],
        ["奖学金", opsInsightLabel("scholarshipNeed", student.scholarshipNeed)],
        ["资金证明", opsInsightLabel("financialProofStatus", student.financialProofStatus)],
        ["资金来源", opsInsightLabel("fundingSource", student.fundingSource)],
      ],
    },
    {
      title: "考试准备",
      tone: opsStudentIsExamReady(student) ? "ok" : "warn",
      items: [
        ["HSK", opsInsightLabel("hskStatus", student.hskStatus)],
        ["CSCA", opsInsightLabel("cscaStatus", student.cscaStatus)],
        ["英文考试", opsInsightLabel("englishTestStatus", student.englishTestStatus)],
        ["面试", opsInsightLabel("interviewReadiness", student.interviewReadiness)],
      ],
    },
    {
      title: "材料准备",
      tone: opsStudentIsProfileReady(student) ? "ok" : "danger",
      items: [
        ["护照", opsInsightLabel("passportStatus", student.passportStatus)],
        ["成绩单", opsInsightLabel("transcriptStatus", student.transcriptStatus)],
        ["学习计划", opsInsightLabel("studyPlanStatus", student.studyPlanStatus)],
        ["翻译公证", opsInsightLabel("translationNotaryStatus", student.translationNotaryStatus)],
      ],
    },
  ];
}

function renderOpsStudentGateBoard(student = {}) {
  const gates = opsStudentGateRows(student);
  return `
    <section class="ops-student-gate-board" aria-label="申请门禁判断">
      ${gates.map((gate) => `
        <article class="tone-${escapeHtml(gate.tone)}">
          <span>${escapeHtml(gate.label)}</span>
          <strong>${escapeHtml(gate.value)}</strong>
          <small>${escapeHtml(gate.copy)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOpsStudentReadinessGroups(student = {}) {
  return `
    <section class="ops-student-readiness-grid" aria-label="学生申请准备度">
      ${opsStudentReadinessGroups(student).map((group) => `
        <article class="tone-${escapeHtml(group.tone)}">
          <header>
            <span>${escapeHtml(group.title)}</span>
            <b>${escapeHtml(group.tone === "ok" ? "已就绪" : group.tone === "danger" ? "阻塞" : "需确认")}</b>
          </header>
          <div>
            ${group.items.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "待确认")}</strong></span>`).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOpsStudentAccountControl(student = {}) {
  const accountBlocked = student.accountStatus === "disabled";
  const rows = [
    {
      label: "登录账号",
      value: opsStudentAccountStatusLabel(student.accountStatus),
      tone: accountBlocked ? "danger" : student.emailVerified ? "ok" : "warn",
      copy: student.emailVerified ? "邮箱已验证，可继续学生端操作。" : "邮箱未验证时，申请推进需要额外确认身份。",
    },
    {
      label: "Agent 辅助",
      value: student.agentAccessStatus || "免费可用",
      tone: /暂停|停用/.test(String(student.agentAccessStatus || student.agentMemoryState || "")) ? "danger" : "ok",
      copy: `${student.agentMemoryState || "上下文待确认"} · ${student.agentMemoryUntil || "保留周期待确认"}`,
    },
    {
      label: "申请影响",
      value: accountBlocked ? "需人工确认" : "不阻塞发送",
      tone: accountBlocked ? "warn" : "ok",
      copy: accountBlocked ? "账号暂停不应自动删除学校可见记录，需确认后续联系策略。" : "账号启用时可继续学生端补充资料和申请选择。",
    },
    {
      label: "权限范围",
      value: "最小可用",
      tone: "muted",
      copy: student.accessScope || "学生 Hub、申请中心和必要 Agent 上下文。",
    },
  ];
  return `
    <section class="ops-student-account-control" aria-label="账号与 Agent 申请影响">
      ${rows.map((row) => `
        <article class="tone-${escapeHtml(row.tone)}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
          <small>${escapeHtml(row.copy)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOpsStudentTimelinePanel(student = {}, timeline = []) {
  const events = timeline.length ? timeline : ["暂无进展"];
  const gates = opsStudentGateRows(student);
  const queueState = opsStudentQueueState(student);
  return `
    <div class="section-head compact">
      <div><span class="module-kicker">时间线</span><h3>最近进展与申请影响</h3></div>
      <span class="status-pill">${escapeHtml(student.updatedAt)}</span>
    </div>
    <section class="ops-student-timeline-brief" aria-label="当前申请影响">
      <article><span>当前处理</span><strong>${escapeHtml(queueState.label)}</strong><small>${escapeHtml(queueState.copy)}</small></article>
      <article><span>学校可见边界</span><strong>${escapeHtml(opsInsightLabel("schoolSendStatus", student.schoolSendStatus))}</strong><small>学校只能看到本校可见记录，不显示学生的其他学校选择。</small></article>
      <article><span>下一步</span><strong>${escapeHtml(student.next || "等待运营确认")}</strong><small>结合支付、材料和学校处理状态决定是否重发、联系或等待学生补充。</small></article>
    </section>
    <section class="ops-student-timeline-actors" aria-label="角色影响">
      <article><span>学生端</span><strong>${escapeHtml(opsInsightLabel("applicationSubmissionStage", student.applicationSubmissionStage))}</strong><small>学生继续补充个人资料、考试准备或申请选择；账号暂停时需先恢复访问。</small></article>
      <article><span>学校端</span><strong>${escapeHtml(opsChoiceVisibilityLabel(toArray(student.choices)[0] || {}))}</strong><small>学校只接收已支付且已发送的本校记录；未支付或未发送选择不会进入学校工作台。</small></article>
      <article><span>运营端</span><strong>${escapeHtml(student.status || "待跟进")}</strong><small>按时间线核对支付、发送、学校联系和学生补充动作，避免重复发送或误判已完成。</small></article>
    </section>
    <section class="ops-student-timeline-impact" aria-label="时间线影响摘要">
      ${gates.map((gate) => `<article class="tone-${escapeHtml(gate.tone)}"><span>${escapeHtml(gate.label)}</span><strong>${escapeHtml(gate.value)}</strong><small>${escapeHtml(gate.copy)}</small></article>`).join("")}
    </section>
    <div class="ops-change-log ops-student-event-log">
      ${events.map((item, index) => `<article><span>${escapeHtml(index === 0 ? "最新" : "记录")}</span><strong>${escapeHtml(item)}</strong><small>${escapeHtml(index === 0 ? student.next || "等待下一步" : "保留为运营审计线索")}</small></article>`).join("")}
    </div>
  `;
}

function opsStudentEditBlockers(student = {}) {
  const blockers = [];
  if (!opsStudentIsProfileReady(student)) blockers.push("个人资料与材料完成度");
  if (!opsStudentIsFinancialReady(student)) blockers.push("资金证明");
  if (!["ready", "score_ready", "not_applicable"].includes(student.hskStatus)) blockers.push("HSK 准备");
  if (!["ready", "score_ready", "not_applicable", "not_required_yet"].includes(student.cscaStatus)) blockers.push("CSCA 准备");
  if (student.paymentState !== "paid") blockers.push("支付状态");
  if (!opsStudentIsSent(student)) blockers.push("学校发送状态");
  return blockers;
}

function renderOpsStudentEditImpact(student = {}) {
  const blockers = opsStudentEditBlockers(student);
  const readyCount = opsStudentGateRows(student).filter((gate) => gate.tone === "ok" || gate.tone === "ready").length;
  return `
    <section class="ops-student-edit-impact" aria-label="编辑前申请影响摘要">
      <article>
        <span>编辑优先级</span>
        <strong>${escapeHtml(blockers.length ? `${blockers.length} 个阻塞字段组` : "无主要阻塞")}</strong>
        <small>${escapeHtml(blockers.slice(0, 4).join("、") || "保存前仍需核对申请备注和审计记录。")}</small>
      </article>
      <article>
        <span>门禁通过</span>
        <strong>${escapeHtml(`${readyCount}/4`)}</strong>
        <small>资料、支付、学校发送、学校处理四个节点共同决定申请是否可推进。</small>
      </article>
      <article>
        <span>保存影响</span>
        <strong>写入审计</strong>
        <small>保存后会记录学生申请资料变更，并保留最近运营动作在时间线中。</small>
      </article>
    </section>
  `;
}

function renderOpsStudentCard(student, selectedStudentId) {
  const selected = selectedStudentId === student.id;
  const choiceCount = toArray(student.choices).length;
  const sentCount = Number(student.schoolsSent || 0);
  const pendingCount = Math.max(0, choiceCount - sentCount);
  const queueState = opsStudentQueueState(student);
  const primaryTarget = queueState.label === "需补材料" ? "overview"
    : queueState.label === "待支付确认" ? "handoff"
      : queueState.label === "账号暂停" ? "account"
        : queueState.label === "学校已联系" ? "timeline"
          : "handoff";
  const primaryLabel = queueState.label === "需补材料" ? "看资料"
    : queueState.label === "待支付确认" ? "看支付"
      : queueState.label === "账号暂停" ? "看账号"
        : queueState.label === "学校已联系" ? "汇总结果"
          : "处理交接";
  return `
    <article class="ops-student-card ops-student-list-row ${selected ? "selected" : ""} tone-${escapeHtml(queueState.tone)}">
      <div class="ops-student-card-head">
        <div class="ops-entity-cell">
          <strong>${escapeHtml(student.name)}</strong>
          <span>${escapeHtml(student.country)} · ${escapeHtml(student.stage)} · ${escapeHtml(student.email)}</span>
        </div>
        <span class="status-pill ${student.priority === "高优先级" || queueState.tone === "danger" ? "danger" : queueState.tone === "warn" ? "warn" : ""}">${escapeHtml(queueState.label)}</span>
      </div>
      <div class="ops-student-card-meta">
        <span class="status-pill ${studentAccountTone(student.accountStatus)}">${escapeHtml(opsStudentAccountStatusLabel(student.accountStatus))}</span>
        <span>${escapeHtml(student.emailVerified ? "邮箱已验证" : "邮箱未验证")}</span>
        <span>Agent ${escapeHtml(student.agentAccessStatus || "免费可用")}</span>
      </div>
      <p class="ops-student-card-reason">${escapeHtml(queueState.copy)}</p>
      <div class="ops-student-row-metrics">
        <span><strong>${choiceCount}</strong> 选择</span>
        <span><strong>${escapeHtml(student.payment)}</strong></span>
        <span><strong>${sentCount}</strong> 已发送</span>
        <span><strong>${pendingCount}</strong> 待处理</span>
      </div>
      <div class="ops-student-card-foot">
        <div><span>${escapeHtml(student.status)}</span><small>${escapeHtml(student.next)}</small></div>
        <div class="ops-student-card-actions" aria-label="学生申请视图">
          <button class="primary-action micro" data-ops-student-open-tab="${escapeHtml(primaryTarget)}" data-student-id="${escapeHtml(student.id)}" type="button">${escapeHtml(primaryLabel)}</button>
          <button class="secondary-action micro" data-ops-student-open-tab="handoff" data-student-id="${escapeHtml(student.id)}" type="button">交接</button>
          <button class="secondary-action micro" data-ops-student-open-tab="account" data-student-id="${escapeHtml(student.id)}" type="button">账号</button>
        </div>
      </div>
    </article>
  `;
}

function buildOpsStudentPortfolioStats(students = []) {
  const checklistStages = ["checklist", "application_set", "submitted"];
  const sentStatuses = ["sent", "school_viewed", "school_contacted"];
  const choices = students.flatMap((student) => toArray(student.choices).map((choice) => ({ ...choice, student })));
  const profileReady = students.filter(opsStudentIsProfileReady).length;
  const checklistStudents = students.filter((student) => checklistStages.includes(String(student.choiceStage || ""))).length;
  const paidStudents = students.filter((student) => student.paymentState === "paid").length;
  const sentStudents = students.filter((student) => sentStatuses.includes(String(student.schoolSendStatus || ""))).length;
  const paidAndSentStudents = students.filter((student) => student.paymentState === "paid" && sentStatuses.includes(String(student.schoolSendStatus || ""))).length;
  const schoolProcessedStudents = students.filter((student) => (
    student.schoolSendStatus === "school_contacted"
    || student.applicationSubmissionStage === "school_contacted"
    || toArray(student.choices).some((choice) => /已接收|已查看|学校已联系/.test(`${choice.sent || ""} ${choice.tenantStatus || ""}`))
  )).length;
  const countryRows = opsCountRows(students, (student) => student.country);
  const concernRows = opsCountRows(students, (student) => toArray(student.priorityFactors));
  const budgetRows = opsCountRows(students, (student) => opsInsightLabel("budgetRange", student.budgetRange));
  return {
    total: students.length,
    countryCount: countryRows.length,
    profileReady,
    checklistStudents,
    paidStudents,
    sentStudents,
    paidAndSentStudents,
    schoolProcessedStudents,
    choiceTotal: choices.length,
    countryRows,
    concernRows,
    budgetRows,
    funnelRows: [
      { label: "注册学生", count: students.length },
      { label: "资料完成", count: profileReady },
      { label: "加入 checklist", count: checklistStudents },
      { label: "已支付", count: paidStudents },
      { label: "付费并发送", count: paidAndSentStudents },
      { label: "学校已处理", count: schoolProcessedStudents },
    ],
    choiceRows: [
      { label: "学校选择", count: choices.length },
      { label: "已发送学校", count: choices.filter((choice) => /已发送/.test(String(choice.sent || ""))).length },
      { label: "学校已接收/查看", count: choices.filter((choice) => /已接收|已查看|学校已联系/.test(`${choice.sent || ""} ${choice.tenantStatus || ""}`)).length },
      { label: "未支付不可见", count: choices.filter((choice) => /未支付|不可见/.test(`${choice.sent || ""} ${choice.tenantStatus || ""}`)).length },
    ],
    riskRows: [
      { label: "资料未完整", count: students.filter((student) => !opsStudentIsProfileReady(student)).length },
      { label: "资金证明未就绪", count: students.filter((student) => !opsStudentIsFinancialReady(student)).length },
      { label: "考试准备待推进", count: students.filter((student) => !opsStudentIsExamReady(student)).length },
      { label: "支付未完成", count: students.filter((student) => student.paymentState !== "paid").length },
      { label: "未发送学校", count: students.filter((student) => !opsStudentIsSent(student)).length },
    ],
  };
}

function renderOpsStudentStageFlow(rows = [], total = 0) {
  const safeTotal = Math.max(1, Number(total || 0));
  return `
    <div class="ops-student-stage-flow" aria-label="学生申请阶段流">
      ${rows.map((row, index) => {
        const count = Number(row.count || 0);
        const previous = index > 0 ? Number(rows[index - 1]?.count || 0) : count;
        const conversion = index === 0 ? 100 : Math.round((count / Math.max(1, previous)) * 100);
        const lost = Math.max(0, previous - count);
        const totalRate = Math.round((count / safeTotal) * 100);
        return `
          <article style="--stage:${Math.max(10, totalRate)}%">
            <span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
            <strong>${escapeHtml(row.label)}</strong>
            <b>${escapeHtml(String(count))}</b>
            <small>${escapeHtml(index === 0 ? `${totalRate}% 基准` : `${conversion}% 承接 · 流失 ${lost}`)}</small>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderOpsStudentPortfolioDashboard(allStudents = [], filteredStudents = []) {
  const stats = buildOpsStudentPortfolioStats(allStudents);
  const filterCopy = filteredStudents.length === allStudents.length
    ? "当前展示全部学生申请"
    : `当前筛选出 ${filteredStudents.length} 个学生`;
  return `
    <section class="ops-student-portfolio-dashboard" aria-label="学生申请统计总览">
      <div class="ops-student-portfolio-head">
        <div>
          <span class="module-kicker">学生申请总览</span>
          <h3>注册、准备、发送和学校处理</h3>
          <p>${escapeHtml(filterCopy)}；先用漏斗判断整体卡点，再进入单个学生详情处理。</p>
        </div>
        <span class="status-pill">${escapeHtml(`${stats.countryCount} 个国家/地区`)}</span>
      </div>
      <div class="ops-student-portfolio-metrics">
        <article class="tone-total"><span>注册学生</span><strong>${escapeHtml(String(stats.total))}</strong><small>${escapeHtml(`${stats.countryCount} 个国家/地区`)}</small></article>
        <article class="tone-ready"><span>资料完成</span><strong>${escapeHtml(String(stats.profileReady))}</strong><small>个人资料与材料可用</small></article>
        <article class="tone-list"><span>加入 checklist</span><strong>${escapeHtml(String(stats.checklistStudents))}</strong><small>已保存申请选择</small></article>
        <article class="tone-paid"><span>已支付</span><strong>${escapeHtml(String(stats.paidStudents))}</strong><small>支付门禁通过</small></article>
        <article class="tone-sent"><span>付费并发送</span><strong>${escapeHtml(String(stats.paidAndSentStudents))}</strong><small>${escapeHtml(`${stats.sentStudents} 个学生已进入学校可见`)}</small></article>
        <article class="tone-school"><span>学校已处理</span><strong>${escapeHtml(String(stats.schoolProcessedStudents))}</strong><small>已接收、查看或联系</small></article>
      </div>
      <div class="ops-student-portfolio-charts">
        <section class="ops-chart-panel large">
          <div><h3>申请漏斗</h3><small>注册到学校处理</small></div>
          ${renderOpsStudentStageFlow(stats.funnelRows, stats.total)}
        </section>
        <section class="ops-chart-panel emphasis">
          <div><h3>风险队列</h3><small>会阻塞发送或学校处理</small></div>
          ${renderOpsFunnelChart(stats.riskRows, "学生申请风险队列")}
        </section>
        <section class="ops-chart-panel emphasis">
          <div><h3>学校选择处理</h3><small>学校记录可见状态</small></div>
          ${renderOpsStackedChart(stats.choiceRows, "学校选择处理")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>来源国家</h3><small>注册学生来自哪里</small></div>
          ${renderOpsStackedChart(stats.countryRows, "学生来源国家")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>学生关心什么</h3><small>选择决策因素</small></div>
          ${renderOpsBubbleChart(stats.concernRows, "学生关注点", 5)}
        </section>
        <section class="ops-chart-panel">
          <div><h3>经济情况</h3><small>预算与支付压力</small></div>
          ${renderOpsStackedChart(stats.budgetRows, "学生预算范围")}
        </section>
      </div>
    </section>
  `;
}

function renderOpsStudentCommandCenter(allStudents = [], filteredStudents = [], stats = {}) {
  const incompleteCount = allStudents.filter((student) => student.status === "资料不完整").length;
  const unsentCount = allStudents.reduce((total, student) => {
    const choices = toArray(student.choices).length;
    return total + Math.max(0, choices - Number(student.schoolsSent || 0));
  }, 0);
  return `
    <section class="ops-student-command-center" aria-label="学生申请操作台">
      <div class="ops-student-command-copy">
        <span class="module-kicker">申请运营</span>
        <strong>${escapeHtml(String(stats.followUpCount ?? 0))} 个待跟进学生</strong>
        <small>${incompleteCount} 个资料不完整；${unsentCount} 个学校选择仍未进入学校可见记录。</small>
      </div>
      <div class="ops-student-command-metrics" aria-label="学生申请处理摘要">
        <span><strong>${escapeHtml(String(stats.followUpCount ?? 0))}</strong> 待跟进</span>
        <span><strong>${escapeHtml(String(unsentCount))}</strong> 未进学校</span>
        <span><strong>${escapeHtml(String(filteredStudents.length))}</strong> 当前列表</span>
      </div>
      <div class="ops-student-command-actions">
        <button class="primary-action micro" data-ops-student-quick-filter="资料不完整" type="button">资料不完整</button>
        <button class="secondary-action micro" data-ops-student-quick-filter="paid" type="button">已支付</button>
        <button class="secondary-action micro" data-ops-student-export type="button">导出 CSV</button>
      </div>
    </section>
  `;
}

const opsStudentStatusOptions = [
  ["已发送给学校", "已发送给学校"],
  ["资料不完整", "资料不完整"],
  ["学校已联系", "学校已联系"],
  ["待支付", "待支付"],
];

const opsStudentPaymentOptions = [
  ["paid", "已支付"],
  ["included", "仅首所学校"],
  ["pending", "待支付"],
  ["failed", "支付异常"],
];

const opsStudentAccountStatusOptions = [
  ["active", "账号启用"],
  ["disabled", "账号停用"],
  ["pending", "待验证"],
];

const opsStudentStudyLevelOptions = [
  ["bachelor", "本科"],
  ["master", "硕士"],
  ["phd", "博士"],
  ["language", "语言项目"],
  ["foundation", "预科"],
  ["unknown", "待确认"],
];

const opsStudentTeachingLanguageOptions = [
  ["chinese", "中文授课"],
  ["english", "英文授课"],
  ["both", "中英均可"],
  ["unknown", "待确认"],
];

const opsStudentBudgetRangeOptions = [
  ["<3000_usd", "低于 USD 3,000"],
  ["3000_8000_usd", "USD 3,000-8,000"],
  ["8000_15000_usd", "USD 8,000-15,000"],
  ["15000_plus_usd", "USD 15,000 以上"],
  ["unknown", "待确认"],
];

const opsStudentScholarshipNeedOptions = [
  ["required", "必须奖学金"],
  ["preferred", "偏好奖学金"],
  ["optional", "可有可无"],
  ["not_needed", "不需要"],
  ["unknown", "待确认"],
];

const opsStudentSelfFundingOptions = [
  ["full_scholarship_only", "仅接受全奖"],
  ["partial_self_funded", "可接受部分自费"],
  ["fully_self_funded_ok", "可接受全自费"],
  ["unknown", "待确认"],
];

const opsStudentFinancialProofOptions = [
  ["not_started", "未开始"],
  ["preparing", "准备中"],
  ["ready", "已准备"],
  ["not_required_yet", "暂不需要"],
  ["unknown", "待确认"],
];

const opsStudentFundingSourceOptions = [
  ["family", "家庭资助"],
  ["scholarship", "奖学金"],
  ["family_scholarship", "家庭 + 奖学金"],
  ["scholarship_family", "奖学金 + 家庭"],
  ["government", "政府资助"],
  ["employer", "雇主资助"],
  ["loan", "贷款"],
  ["mixed", "混合资金"],
  ["other", "其他"],
  ["unknown", "待确认"],
];

const opsStudentLowCostOptions = [
  ["required", "必须低成本"],
  ["preferred", "偏好低成本"],
  ["neutral", "无明显偏好"],
  ["unknown", "待确认"],
];

const opsStudentReadinessOptions = [
  ["complete", "已完成"],
  ["ready", "已准备"],
  ["preparing", "准备中"],
  ["incomplete", "不完整"],
  ["missing", "缺失"],
  ["not_started", "未开始"],
  ["not_required_yet", "暂不需要"],
  ["unknown", "待确认"],
];

const opsStudentExamOptions = [
  ["not_started", "未开始"],
  ["preparing", "准备中"],
  ["registered", "已报名"],
  ["tested", "已考试"],
  ["score_ready", "成绩可用"],
  ["ready", "已准备"],
  ["not_required_yet", "暂不需要"],
  ["not_applicable", "不适用"],
  ["unknown", "待确认"],
];

const opsStudentChoiceStageOptions = [
  ["browsing", "浏览中"],
  ["saved", "已收藏"],
  ["checklist", "已加入 checklist"],
  ["application_set", "已形成申请集"],
  ["submitted", "已提交"],
  ["unknown", "待确认"],
];

const opsStudentApplicationStageOptions = [
  ["not_started", "未开始"],
  ["drafting", "填写中"],
  ["submitted", "已提交"],
  ["needs_materials", "需补材料"],
  ["paid", "已支付"],
  ["pending_send", "待发送"],
  ["sent", "已发送"],
  ["send_failed", "发送失败"],
  ["school_contacted", "学校已联系"],
  ["unknown", "待确认"],
];

const opsStudentSendStatusOptions = [
  ["not_sent", "未发送"],
  ["queued", "排队中"],
  ["sent", "已发送"],
  ["retry", "失败待重试"],
  ["school_viewed", "学校已查看"],
  ["school_contacted", "学校已联系"],
  ["unknown", "待确认"],
];

const opsStudentFieldGroups = [
  ["学生资料", [
    { label: "姓名", key: "name" },
    { label: "邮箱", key: "email", type: "email" },
    { label: "电话 / WhatsApp", key: "phone" },
    { label: "国家 / 地区", key: "country" },
    { label: "申请阶段", key: "stage" },
    { label: "学位层级", key: "studyLevel", control: "select", options: opsStudentStudyLevelOptions },
    { label: "授课偏好", key: "teachingLanguagePreference", control: "select", options: opsStudentTeachingLanguageOptions },
    { label: "资金意向", key: "funding" },
    { label: "语言状态", key: "language" },
    { label: "下一步备注", key: "next", wide: true },
  ]],
  ["经济与资助", [
    { label: "预算范围", key: "budgetRange", control: "select", options: opsStudentBudgetRangeOptions },
    { label: "奖学金需求", key: "scholarshipNeed", control: "select", options: opsStudentScholarshipNeedOptions },
    { label: "自费接受度", key: "selfFundingTolerance", control: "select", options: opsStudentSelfFundingOptions },
    { label: "资金证明", key: "financialProofStatus", control: "select", options: opsStudentFinancialProofOptions },
    { label: "资金来源", key: "fundingSource", control: "select", options: opsStudentFundingSourceOptions },
    { label: "低成本偏好", key: "lowCostPreference", control: "select", options: opsStudentLowCostOptions },
  ]],
  ["考试准备", [
    { label: "HSK 状态", key: "hskStatus", control: "select", options: opsStudentExamOptions },
    { label: "当前 HSK", key: "hskCurrentLevel" },
    { label: "目标 HSK", key: "hskTargetLevel" },
    { label: "CSCA 状态", key: "cscaStatus", control: "select", options: opsStudentExamOptions },
    { label: "英文考试", key: "englishTestStatus", control: "select", options: opsStudentExamOptions },
    { label: "其他考试", key: "otherExamStatus", control: "select", options: opsStudentExamOptions },
    { label: "面试准备", key: "interviewReadiness", control: "select", options: opsStudentExamOptions },
  ]],
  ["个人信息与材料", [
    { label: "资料完成度", key: "profileCompletionStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "联系方式", key: "contactInfoStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "护照", key: "passportStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "教育经历", key: "educationHistoryStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "成绩单", key: "transcriptStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "毕业/在读证明", key: "degreeProofStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "推荐信", key: "recommendationStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "学习计划", key: "studyPlanStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "翻译公证", key: "translationNotaryStatus", control: "select", options: opsStudentReadinessOptions },
    { label: "材料完成度 %", key: "documentChecklistCompletion", type: "number" },
  ]],
  ["申请与账号", [
    { label: "申请状态", key: "status", control: "select", options: opsStudentStatusOptions },
    { label: "选择阶段", key: "choiceStage", control: "select", options: opsStudentChoiceStageOptions },
    { label: "提交阶段", key: "applicationSubmissionStage", control: "select", options: opsStudentApplicationStageOptions },
    { label: "学校发送状态", key: "schoolSendStatus", control: "select", options: opsStudentSendStatusOptions },
    { label: "支付状态", key: "paymentState", control: "select", options: opsStudentPaymentOptions },
    { label: "支付说明", key: "payment" },
    { label: "账号状态", key: "accountStatus", control: "select", options: opsStudentAccountStatusOptions },
    { label: "Agent 服务", key: "agentAccessStatus" },
    { label: "Agent 记忆", key: "agentMemoryState" },
    { label: "上下文保留至", key: "agentMemoryUntil" },
  ]],
];

function renderOpsStudentField(student, field) {
  const value = student[field.key] ?? "";
  const classes = ["ops-form-field", field.wide ? "wide" : ""].filter(Boolean).join(" ");
  const attrs = `data-ops-student-field="${escapeHtml(field.key)}"`;
  if (field.control === "select") {
    const options = (field.options || []).map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === optionValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("");
    return `<label class="${classes}"><span>${escapeHtml(field.label)}</span><select ${attrs}>${options}</select></label>`;
  }
  return `<label class="${classes}"><span>${escapeHtml(field.label)}</span><input ${attrs} value="${escapeHtml(value)}" type="${escapeHtml(field.type || "text")}" /></label>`;
}

function renderOpsStudentEditor(student) {
  return `
    ${renderOpsStudentEditImpact(student)}
    <details class="ops-student-editor-panel ops-student-editor-disclosure" data-ops-student-editor>
      <summary class="ops-student-editor-summary">
        <div>
          <h3>学生与申请编辑</h3>
          <p>维护学生资料、申请状态、账号状态和 Agent 上下文，保存后写入运营审计。</p>
        </div>
        <span>CUAC 申请记录</span>
      </summary>
      <div class="ops-student-editor-body">
        ${opsStudentFieldGroups.map(([title, fields]) => `
          <div class="ops-form-group">
            <h3>${escapeHtml(title)}</h3>
            <div class="ops-form-grid compact">${fields.map((field) => renderOpsStudentField(student, field)).join("")}</div>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

const opsStudentDetailTabs = [
  ["overview", "概览"],
  ["handoff", "学校交接"],
  ["account", "账号与 Agent"],
  ["timeline", "时间线"],
  ["edit", "编辑"],
];

function activeOpsStudentDetailTab(state = readOpsAdminState()) {
  return normalizeOpsStudentDetailTab(state.studentDetailTab);
}

function renderOpsStudentDetailPanel(key, activeKey, html) {
  return `<section class="ops-student-detail-panel" data-ops-student-detail-panel="${escapeHtml(key)}" ${key === activeKey ? "" : "hidden"}>${html}</section>`;
}

function opsChoicePaymentLabel(choice = {}, student = {}) {
  const fee = String(choice.fee || "");
  if (/included|已包含|首所/i.test(fee)) return "首所已包含";
  if (student.paymentState === "paid") return "已支付";
  if (student.paymentState === "included") return "仅首所可发送";
  if (student.paymentState === "failed") return "支付异常";
  return "待支付";
}

function opsChoiceVisibilityLabel(choice = {}) {
  const sent = String(choice.sent || "");
  if (/已发送/.test(sent)) return "学校可见";
  if (/未支付|不可见/.test(`${sent} ${choice.tenantStatus || ""}`)) return "支付后可见";
  return "暂不可见";
}

function opsChoiceStepState(choice = {}, student = {}, step = "") {
  const text = `${choice.sent || ""} ${choice.tenantStatus || ""} ${choice.fee || ""}`;
  if (step === "choice") return "done";
  if (step === "payment") {
    if (opsChoicePaymentLabel(choice, student) === "已支付" || /included|已包含|首所/i.test(String(choice.fee || ""))) return "done";
    if (student.paymentState === "failed") return "danger";
    return "warn";
  }
  if (step === "send") {
    if (/已发送/.test(text)) return "done";
    if (/失败|重试/.test(text)) return "danger";
    return "warn";
  }
  if (step === "school") {
    if (/学校已联系|已接收|已查看/.test(text)) return "done";
    if (/已发送/.test(text)) return "warn";
    return "muted";
  }
  return "muted";
}

function renderOpsStudentChoiceFlow(choice = {}, student = {}, index = 0) {
  const steps = [
    ["choice", "已选择", choice.program || "项目待确认"],
    ["payment", "支付", opsChoicePaymentLabel(choice, student)],
    ["send", "发送", choice.sent || "未发送"],
    ["school", "学校处理", opsChoiceVisibilityLabel(choice)],
  ];
  return `
    <article class="ops-student-choice-flow">
      <header>
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div><strong>${escapeHtml(choice.school || "学校待确认")}</strong><small>${escapeHtml([choice.city, choice.scholarship].filter(Boolean).join(" · ") || "匹配信息待确认")}</small></div>
      </header>
      <div class="ops-student-choice-steps">
        ${steps.map(([key, label, value]) => `<span class="tone-${escapeHtml(opsChoiceStepState(choice, student, key))}"><b>${escapeHtml(label)}</b><small>${escapeHtml(value)}</small></span>`).join("")}
      </div>
    </article>
  `;
}

function renderOpsStudentDetail(student) {
  if (!student) return "";
  const accountAction = student.accountStatus === "disabled" ? ["restore-account", "恢复账号"] : ["disable-account", "停用账号"];
  const activeTab = activeOpsStudentDetailTab();
  const choices = toArray(student.choices);
  const timeline = toArray(student.timeline);
  const profileFacts = [
    ["邮箱", student.email],
    ["电话 / WhatsApp", student.phone],
    ["同意状态", student.consent],
    ["文件策略", student.documentPolicy],
  ];
  const accountFacts = [
    ["角色", opsStudentRoleLabel(student.accountRole)],
    ["账号状态", opsStudentAccountStatusLabel(student.accountStatus)],
    ["邮箱", student.emailVerified ? "已验证" : "未验证"],
    ["Agent 服务", student.agentAccessStatus || "免费可用"],
    ["最后登录", student.lastLoginAt],
    ["Agent 记忆", student.agentMemoryState],
  ];
  const choiceCount = choices.length;
  const sentCount = Number(student.schoolsSent || 0);
  const hiddenCount = choices.filter((choice) => /未支付|不可见/.test(`${choice.sent || ""} ${choice.tenantStatus || ""}`)).length;
  const queueState = opsStudentQueueState(student);
  return `
    <article class="ops-student-detail" data-ops-student-detail data-student-id="${escapeHtml(student.id)}">
      <div class="section-head">
        <div>
          <span class="module-kicker">学生申请详情</span>
          <h2>${escapeHtml(student.name)}</h2>
          <p>${escapeHtml(student.country)} · ${escapeHtml(student.stage)} · ${escapeHtml(student.email)}</p>
        </div>
        <div class="ops-student-detail-status">
          <span class="status-pill ${student.priority === "高优先级" ? "danger" : ""}">${escapeHtml(student.priority)}</span>
          <span class="status-pill ${studentPaymentTone(student.paymentState)}">${escapeHtml(student.payment)}</span>
        </div>
      </div>
      <div class="ops-student-action-bar" aria-label="学生申请操作">
        <div class="ops-student-action-summary">
          <span class="module-kicker">当前处理</span>
          <strong>${escapeHtml(queueState.label)}</strong>
          <p>${escapeHtml(queueState.copy)}</p>
        </div>
        <div class="ops-student-action-primary">
          <button class="primary-action" data-ops-student-action="contacted" type="button">标记已联系</button>
        </div>
        <div class="ops-student-action-secondary">
          <button class="secondary-action" data-ops-student-action="resend" type="button">重发通知</button>
          <button class="secondary-action" data-ops-student-action="payment" type="button">查看支付</button>
          <button class="secondary-action" data-ops-student-save type="button">保存资料</button>
        </div>
        <div class="ops-student-action-danger">
          <button class="secondary-action danger" data-ops-student-action="${escapeHtml(accountAction[0])}" type="button">${escapeHtml(accountAction[1])}</button>
          <button class="secondary-action" data-ops-student-action="refresh-agent" type="button">恢复 Agent</button>
        </div>
      </div>
      <div class="ops-student-case-strip" aria-label="申请交接摘要">
        <span><small>学校选择</small><strong>${choiceCount}</strong></span>
        <span><small>已发送学校</small><strong>${sentCount}</strong></span>
        <span><small>暂不可见</small><strong>${hiddenCount}</strong></span>
        <span><small>材料完成</small><strong>${escapeHtml(student.documentChecklistCompletion === undefined ? "待确认" : `${student.documentChecklistCompletion}%`)}</strong></span>
        <span><small>最近更新</small><strong>${escapeHtml(student.updatedAt)}</strong></span>
      </div>
      <nav class="ops-student-detail-tabs" aria-label="学生详情分区" role="tablist">
        ${opsStudentDetailTabs.map(([key, label]) => `<button class="${activeTab === key ? "active" : ""}" data-ops-student-detail-tab="${escapeHtml(key)}" type="button" role="tab" aria-selected="${activeTab === key ? "true" : "false"}">${escapeHtml(label)}</button>`).join("")}
      </nav>
      ${renderOpsStudentDetailPanel("overview", activeTab, `
        <div class="ops-student-alert">
          <span class="status-pill ${studentPaymentTone(student.paymentState)}">${escapeHtml(student.payment)}</span>
          <strong>${escapeHtml(queueState.label)}</strong>
          <p>${escapeHtml(queueState.copy)} 学校只能看到各自学校的记录，不显示学生其他选择。</p>
        </div>
        ${renderOpsStudentGateBoard(student)}
        ${renderOpsStudentReadinessGroups(student)}
        <div class="ops-student-profile-grid compact">
          ${profileFacts.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
        </div>
        <div class="ops-student-timeline-preview">
          <div><span class="module-kicker">最近进展</span><strong>${escapeHtml(timeline[0] || "暂无进展")}</strong></div>
          <button class="secondary-action micro" data-ops-student-detail-tab="timeline" type="button">查看全部</button>
        </div>
      `)}
      ${renderOpsStudentDetailPanel("handoff", activeTab, `
        <div class="section-head compact"><div><span class="module-kicker">学校交接</span><h3>选择、支付与学校可见状态</h3></div><button class="secondary-action" data-ops-student-action="resend" type="button">重发学校通知</button></div>
        <div class="ops-student-handoff-summary">
          <span><strong>${escapeHtml(String(choiceCount))}</strong> 学校选择</span>
          <span><strong>${escapeHtml(String(sentCount))}</strong> 已发送</span>
          <span><strong>${escapeHtml(String(hiddenCount))}</strong> 暂不可见</span>
          <span><strong>${escapeHtml(opsInsightLabel("schoolSendStatus", student.schoolSendStatus))}</strong> 当前发送状态</span>
        </div>
        <div class="ops-student-choice-flow-list" aria-label="学校交接流程">
          ${choices.map((choice, index) => renderOpsStudentChoiceFlow(choice, student, index)).join("")}
        </div>
        <div class="ops-choice-list ops-student-handoff-table" role="table" aria-label="学生学校交接状态">
          <div class="ops-choice-header" role="row"><span>学校</span><span>项目</span><span>费用</span><span>支付</span><span>发送</span><span>学校可见</span></div>
          ${choices.map((choice) => `<article role="row">
            <div><strong>${escapeHtml(choice.school)}</strong><small>${escapeHtml(choice.tenantStatus)}</small></div>
            <span>${escapeHtml(choice.program)}</span>
            <span>${escapeHtml(choice.fee)}</span>
            <span>${escapeHtml(opsChoicePaymentLabel(choice, student))}</span>
            <span>${escapeHtml(choice.sent)}</span>
            <small>${escapeHtml(opsChoiceVisibilityLabel(choice))}</small>
          </article>`).join("")}
        </div>
      `)}
      ${renderOpsStudentDetailPanel("account", activeTab, `
        <div class="ops-student-account-panel">
          <div>
            <span class="module-kicker">账号治理</span>
            <h3>${escapeHtml(student.email)}</h3>
            <p>学生、学校老师、运营账号使用统一登录注册体系；这里仅管理账号状态、角色结果和 Agent 长期上下文。</p>
          </div>
          ${renderOpsStudentAccountControl(student)}
          <div class="ops-account-grid">
            ${accountFacts.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
          </div>
          <div class="ops-account-note">
            <span class="status-pill ${studentAccountTone(student.accountStatus)}">${escapeHtml(opsStudentAccountStatusLabel(student.accountStatus))}</span>
            <p>${escapeHtml(student.accessScope)} · 保留周期：${escapeHtml(student.agentMemoryUntil)}</p>
          </div>
        </div>
      `)}
      ${renderOpsStudentDetailPanel("timeline", activeTab, renderOpsStudentTimelinePanel(student, timeline))}
      ${renderOpsStudentDetailPanel("edit", activeTab, renderOpsStudentEditor(student))}
    </article>
  `;
}

function defaultOpsQueueRecords() {
  return [
    {
      id: "catalog-freshness",
      team: "数据质量",
      task: "复核过期的 2026 秋季截止日期",
      count: "18 条记录",
      action: "catalog-freshness",
      cta: "查看",
      status: "待处理",
      priority: "中",
      owner: "目录团队",
      detail: "需要复核学校截止摘要、项目截止日期和来源链接是否一致。",
      impact: "影响项目页、申请中心选择器和学校交接记录的截止日期可信度。",
      runbook: ["打开学校数据队列", "按旧项目字段映射复核来源", "保存后写入变更记录"],
    },
    {
      id: "retry-routing",
      team: "发送",
      task: "重试学校通知任务",
      count: "2 次失败",
      action: "retry-routing",
      cta: "重试",
      status: "待重试",
      priority: "高",
      owner: "申请运营",
      detail: "支付成功后的学校通知任务需要按幂等键重试，避免重复创建学校可见记录。",
      impact: "影响学校老师是否能在 school-portal 看到已支付申请。",
      runbook: ["核对付款已确认", "检查发送幂等标识", "只重发失败学校通知"],
    },
    {
      id: "reconcile-payment",
      team: "支付",
      task: "对账支付服务商状态差异",
      count: "1 张发票",
      action: "reconcile-payment",
      cta: "查看",
      status: "待财务复核",
      priority: "高",
      owner: "财务运营",
      detail: "一张 CUAC 多校提交费用发票与前端状态不一致，发送学校前必须确认。",
      impact: "支付失败或未确认时不能触发学校发送。",
      runbook: ["打开支付记录", "核对发票编号和回调记录", "确认后恢复发送队列"],
    },
    {
      id: "school-response",
      team: "学校成功",
      task: "跟进不活跃租户队列",
      count: "浙江大学 + 1 个租户",
      action: "school-response",
      cta: "查看",
      status: "跟进中",
      priority: "中",
      owner: "学校成功",
      detail: "学校租户已收到记录，但首次联系学生超过目标时间。",
      impact: "影响学生端 Hub 的后续状态可信度和学校 SLA。",
      runbook: ["查看租户最近登录", "确认是否已联系学生", "必要时发送老师提醒"],
    },
    {
      id: "review-agent-audit",
      team: "Agent 审计",
      task: "复核被拒绝的导出请求",
      count: "4 次拒绝",
      action: "review-agent-audit",
      cta: "查看",
      status: "需审计",
      priority: "高",
      owner: "安全运营",
      detail: "Agent 拒绝了跨租户或超范围导出请求，需要复核是否存在误拒或滥用风险。",
      impact: "影响管理员 Agent 能力开放边界。",
      runbook: ["查看拒绝原因", "确认角色和范围", "必要时更新操作注册表"],
    },
  ];
}

function readOpsQueueRecords(state = readOpsAdminState()) {
  return Array.isArray(state.queueRecords) && state.queueRecords.length ? state.queueRecords : defaultOpsQueueRecords();
}

function getOpsSelectedQueue(records, state = readOpsAdminState()) {
  return records.find((item) => item.id === state.selectedQueueId) || records[0] || null;
}

function queuePriorityTone(priority) {
  if (priority === "高") return "danger";
  if (priority === "中") return "warn";
  return "";
}

function opsQueueImpactDomain(item = {}) {
  const text = [item.team, item.task, item.detail, item.impact].join(" ");
  if (/支付|对账|发票|退款/.test(text)) return { key: "payment", label: "支付阻塞" };
  if (/学校|发送|租户|可见/.test(text)) return { key: "school", label: "学校可见" };
  if (/Agent|策略|拒绝|导出/.test(text)) return { key: "agent", label: "Agent 边界" };
  if (/截止|目录|来源|项目|奖学金/.test(text)) return { key: "catalog", label: "目录质量" };
  return { key: "ops", label: "运营处理" };
}

function opsQueueAgeHours(item = {}) {
  const fixed = {
    "catalog-freshness": 14,
    "retry-routing": 3,
    "reconcile-payment": 5,
    "school-response": 28,
    "review-agent-audit": 2,
  };
  return Number(item.ageHours ?? fixed[item.id] ?? (item.priority === "高" ? 4 : 12));
}

function opsQueueSlaHours(item = {}) {
  if (item.action === "retry-routing" || item.action === "reconcile-payment") return 4;
  if (item.action === "review-agent-audit") return 6;
  if (item.team === "学校成功") return 24;
  return item.priority === "高" ? 8 : 24;
}

function opsQueueSlaState(item = {}) {
  const age = opsQueueAgeHours(item);
  const sla = opsQueueSlaHours(item);
  const remaining = sla - age;
  const tone = remaining < 0 ? "danger" : remaining <= 2 ? "warn" : "ok";
  return {
    age,
    sla,
    remaining,
    tone,
    label: remaining < 0 ? `超时 ${Math.abs(remaining)}h` : remaining <= 2 ? `剩余 ${remaining}h` : `${age}h / ${sla}h`,
  };
}

function opsQueueNextAction(item = {}) {
  return {
    "catalog-freshness": "复核来源并保存变更",
    "retry-routing": "按幂等键重试学校通知",
    "reconcile-payment": "核对发票与回调",
    "school-response": "联系学校老师并记录结果",
    "review-agent-audit": "查看拒绝原因并复核策略",
  }[item.action] || item.cta || "处理";
}

function opsQueueEvidenceRows(item = {}) {
  const impact = opsQueueImpactDomain(item);
  const sla = opsQueueSlaState(item);
  return [
    { label: "影响域", value: impact.label, copy: item.impact },
    { label: "SLA", value: sla.label, copy: `${sla.age}h 已等待 / ${sla.sla}h 目标` },
    { label: "负责人", value: item.owner, copy: item.team },
    { label: "审计证据", value: "操作后留痕", copy: "处理动作会写入后台审计事件" },
  ];
}

function renderOpsQueueCard(item, selectedId) {
  const impact = opsQueueImpactDomain(item);
  const sla = opsQueueSlaState(item);
  return `
    <article class="ops-queue-card ${selectedId === item.id ? "selected" : ""}">
      <button class="ops-queue-card-main" data-ops-queue-select data-queue-id="${escapeHtml(item.id)}" type="button">
        <span>${escapeHtml(item.team)} · ${escapeHtml(impact.label)}</span>
        <strong>${escapeHtml(item.task)}</strong>
        <small>${escapeHtml(item.count)} · ${escapeHtml(item.owner)} · ${escapeHtml(opsQueueNextAction(item))}</small>
      </button>
      <div class="ops-queue-card-actions">
        <span class="status-pill ${queuePriorityTone(item.priority)}">${escapeHtml(item.priority)}</span>
        <span class="status-pill ${escapeHtml(sla.tone)}">${escapeHtml(sla.label)}</span>
        <button class="secondary-action" data-ops-action="${escapeHtml(item.action)}" type="button">${escapeHtml(item.cta)}</button>
      </div>
    </article>
  `;
}

function renderOpsQueueDetail(item) {
  if (!item) return "";
  const sla = opsQueueSlaState(item);
  const evidenceRows = opsQueueEvidenceRows(item);
  const decisionTitle = sla.tone === "danger" ? "已经超过处理目标" : sla.tone === "warn" ? "接近 SLA 截止" : "可按计划处理";
  return `
    <article class="ops-queue-detail" data-ops-queue-detail data-queue-id="${escapeHtml(item.id)}">
      <div class="section-head">
        <div><span class="module-kicker">${escapeHtml(item.team)}</span><h2>${escapeHtml(item.task)}</h2></div>
        <span class="status-pill ${queuePriorityTone(item.priority)}">${escapeHtml(item.status)}</span>
      </div>
      <section class="ops-queue-decision tone-${escapeHtml(sla.tone)}" aria-label="队列处理判断">
        <div>
          <span>处理判断</span>
          <strong>${escapeHtml(decisionTitle)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </div>
        <small>${escapeHtml(opsQueueNextAction(item))}</small>
      </section>
      <div class="ops-queue-detail-grid">
        ${evidenceRows.map((row) => `<article><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong><small>${escapeHtml(row.copy)}</small></article>`).join("")}
      </div>
      <article class="ops-queue-impact-card"><span>业务影响</span><p>${escapeHtml(item.impact)}</p></article>
      <div class="section-head compact"><div><span class="module-kicker">处理手册</span><h3>处理步骤</h3></div><button class="primary-action" data-ops-action="${escapeHtml(item.action)}" type="button">${escapeHtml(item.cta)}</button></div>
      <div class="ops-queue-runbook">
        ${toArray(item.runbook).map((step, index) => `<label><input type="checkbox" /><span>${escapeHtml(`步骤 ${index + 1}`)}</span><strong>${escapeHtml(step)}</strong></label>`).join("")}
      </div>
    </article>
  `;
}

function renderOpsQueueViewTabs(activeView, queueRows = [], auditEvents = [], agentOps = {}) {
  const counts = {
    work: queueRows.length,
    audit: auditEvents.length,
    support: "受控",
    agent: agentOps.rolloutPaused ? "暂停" : `${agentOps.successRate || 0}%`,
  };
  return `
    <nav class="ops-queue-view-tabs" aria-label="队列与审计分区" role="tablist">
      ${opsQueueViews.map(([key, label]) => `<button class="${activeView === key ? "active" : ""}" data-ops-queue-view="${escapeHtml(key)}" type="button" role="tab" aria-selected="${activeView === key ? "true" : "false"}"><span>${escapeHtml(label)}</span><small>${escapeHtml(String(counts[key] ?? ""))}</small></button>`).join("")}
    </nav>
  `;
}

function renderOpsQueueCommandCenter(queueRows = [], auditEvents = [], agentOps = {}, stats = {}) {
  const highCount = queueRows.filter((item) => item.priority === "高").length;
  const retryCount = queueRows.filter((item) => /重试|失败|差异/.test([item.task, item.status, item.detail].join(" "))).length;
  const agentRejectCount = Number(stats.agentRejectCount ?? 0);
  const paymentIssueCount = Number(stats.paymentIssueCount ?? 0);
  return `
    <section class="ops-queue-command-center" aria-label="运营队列操作台">
      <div class="ops-queue-command-copy">
        <span class="module-kicker">队列调度</span>
        <strong>${highCount} 个高优先级队列</strong>
        <small>${retryCount} 个发送或支付状态需复核；${agentRejectCount} 次 Agent 策略拒绝。先处理会影响学校可见性的任务。</small>
      </div>
      <div class="ops-queue-command-metrics" aria-label="运营队列摘要">
        <span><strong>${paymentIssueCount}</strong> 支付问题</span>
        <span><strong>${auditEvents.length}</strong> 审计事件</span>
        <span><strong>${agentOps.rolloutPaused ? "暂停" : `${agentOps.successRate || 0}%`}</strong> Agent 状态</span>
      </div>
      <div class="ops-queue-command-actions">
        <button class="primary-action micro" data-ops-queue-command-view="work" type="button">待办队列</button>
        <button class="secondary-action micro" data-ops-queue-command-view="audit" type="button">审计事件</button>
        <button class="secondary-action micro" data-ops-queue-command-view="support" type="button">支持查询</button>
        <button class="secondary-action micro" data-ops-queue-command-view="agent" type="button">Agent 运维</button>
      </div>
    </section>
  `;
}

function buildOpsQueuePortfolioStats(queueRows = [], auditEvents = [], agentOps = {}) {
  const highRows = queueRows.filter((item) => item.priority === "高");
  const retryRows = queueRows.filter((item) => /重试|失败|差异|对账/.test([item.task, item.status, item.detail].join(" ")));
  const schoolVisibleRows = queueRows.filter((item) => /学校|发送|可见|申请/.test([item.task, item.detail, item.impact].join(" ")));
  const agentRows = queueRows.filter((item) => /Agent|策略|拒绝/.test([item.task, item.detail, item.impact].join(" ")));
  const paymentRows = queueRows.filter((item) => /支付|对账|退款/.test([item.task, item.detail, item.impact].join(" ")));
  const overdueRows = queueRows.filter((item) => opsQueueSlaState(item).tone === "danger");
  const nearSlaRows = queueRows.filter((item) => opsQueueSlaState(item).tone === "warn");
  const assignedRows = queueRows.filter((item) => item.owner);
  const activeRows = queueRows.filter((item) => !/完成|关闭/.test(String(item.status || "")));
  return {
    total: queueRows.length,
    highCount: highRows.length,
    retryCount: retryRows.length,
    schoolVisibleCount: schoolVisibleRows.length,
    agentCount: agentRows.length,
    paymentCount: paymentRows.length,
    overdueCount: overdueRows.length,
    nearSlaCount: nearSlaRows.length,
    auditCount: auditEvents.length,
    agentStatus: agentOps.rolloutPaused ? "暂停" : `${agentOps.successRate || 0}%`,
    priorityRows: opsCountRows(queueRows, (item) => item.priority),
    teamRows: opsCountRows(queueRows, (item) => item.team),
    statusRows: opsCountRows(queueRows, (item) => item.status),
    auditModuleRows: opsCountRows(auditEvents, (event) => opsAuditModuleLabel(event.module)),
    ageRows: [
      { label: "0-4h", count: queueRows.filter((item) => opsQueueAgeHours(item) <= 4).length },
      { label: "4-24h", count: queueRows.filter((item) => opsQueueAgeHours(item) > 4 && opsQueueAgeHours(item) <= 24).length },
      { label: "24h+", count: queueRows.filter((item) => opsQueueAgeHours(item) > 24).length },
    ],
    processRows: [
      { label: "发现", count: queueRows.length },
      { label: "已指派", count: assignedRows.length },
      { label: "处理中", count: activeRows.length },
      { label: "需审计", count: auditEvents.length },
    ],
    impactRows: [
      { label: "影响学校可见", count: schoolVisibleRows.length },
      { label: "支付/对账", count: paymentRows.length },
      { label: "Agent 策略", count: agentRows.length },
      { label: "SLA 风险", count: overdueRows.length + nearSlaRows.length },
    ],
  };
}

function renderOpsQueuePortfolioDashboard(queueRows = [], auditEvents = [], agentOps = {}) {
  const stats = buildOpsQueuePortfolioStats(queueRows, auditEvents, agentOps);
  return `
    <section class="ops-queue-portfolio-dashboard" aria-label="队列与审计统计总览">
      <div class="ops-queue-portfolio-head">
        <div>
          <span class="module-kicker">风险调度总览</span>
          <h3>先处理影响学校可见性的队列</h3>
          <p>把待办、审计、支付和 Agent 策略放在同一层判断，避免只看列表时漏掉跨模块风险。</p>
        </div>
        <span class="status-pill danger">${escapeHtml(`${stats.highCount} 个高优先级`)}</span>
      </div>
      <div class="ops-queue-portfolio-metrics">
        <article class="tone-danger"><span>高优先级</span><strong>${escapeHtml(String(stats.highCount))}</strong><small>需要先处理</small></article>
        <article class="tone-school"><span>学校可见影响</span><strong>${escapeHtml(String(stats.schoolVisibleCount))}</strong><small>发送、租户或申请记录</small></article>
        <article class="tone-payment"><span>支付/对账</span><strong>${escapeHtml(String(stats.paymentCount))}</strong><small>会阻塞发送</small></article>
        <article class="tone-agent"><span>SLA 风险</span><strong>${escapeHtml(String(stats.overdueCount + stats.nearSlaCount))}</strong><small>${escapeHtml(`${stats.overdueCount} 超时 · ${stats.nearSlaCount} 临近`)}</small></article>
      </div>
      <div class="ops-queue-portfolio-charts">
        <section class="ops-chart-panel large">
          <div><h3>处理漏斗</h3><small>发现、指派、处理和审计证据</small></div>
          ${renderOpsFunnelChart(stats.processRows, "队列处理漏斗")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>优先级分布</h3><small>哪些队列先看</small></div>
          ${renderOpsStackedChart(stats.priorityRows, "队列优先级")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>队列老化</h3><small>按等待时间识别 SLA 风险</small></div>
          ${renderOpsStackedChart(stats.ageRows, "队列老化")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>处理状态</h3><small>待处理、复核、重试</small></div>
          ${renderOpsStackedChart(stats.statusRows, "队列处理状态")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>审计模块</h3><small>操作留痕分布</small></div>
          ${renderOpsBubbleChart(stats.auditModuleRows, "审计模块", 5)}
        </section>
        <section class="ops-chart-panel large">
          <div><h3>风险影响域</h3><small>从业务影响而不是任务名判断</small></div>
          ${renderOpsFunnelChart(stats.impactRows, "队列风险影响域")}
        </section>
      </div>
    </section>
  `;
}

function renderOpsQueueRiskPanel(queueRows = [], auditEvents = [], agentOps = {}) {
  const stats = buildOpsQueuePortfolioStats(queueRows, auditEvents, agentOps);
  return `
    <article class="ops-queue-side-panel ops-queue-risk-panel">
      <div class="section-head compact">
        <div><span class="module-kicker">风险观察</span><h3>高风险监控</h3></div>
        <span class="status-pill danger">${escapeHtml(`${stats.highCount} 个高优先级`)}</span>
      </div>
      <div class="ops-risk-grid">
        <article><strong>${escapeHtml(String(stats.retryCount))}</strong><span>发送失败或差异需复核</span></article>
        <article><strong>${escapeHtml(String(stats.paymentCount))}</strong><span>支付状态需对账</span></article>
        <article><strong>${escapeHtml(String(stats.agentCount))}</strong><span>Agent 操作需审计</span></article>
      </div>
    </article>
  `;
}

function renderOpsSupportPanel(opsState = {}) {
  const lookup = opsState.supportLookup || {};
  return `
    <article class="ops-queue-section ops-support-console" data-ops-support-console>
      <div class="section-head">
        <div><span class="module-kicker">支持查询</span><h2>限定范围查询</h2></div>
        <span class="status-pill danger">必须填写原因</span>
      </div>
      <div class="ops-support-guardrail" aria-label="支持查询边界">
        <article><span>查询前</span><strong>确认工单与范围</strong><small>只查处理所需数据</small></article>
        <article><span>查询中</span><strong>屏蔽密码和跨租户私有数据</strong><small>敏感数据需要二次审批</small></article>
        <article><span>查询后</span><strong>自动写入审计</strong><small>保留操作者、原因和时间</small></article>
      </div>
      <div class="support-lookup">
        <label><span>用户或租户</span><input data-ops-support-query value="${escapeHtml(lookup.query || "maya@example.com")}" aria-label="支持查询关键词" /></label>
        <label><span>工单号</span><input data-ops-support-ticket value="${escapeHtml(lookup.ticket || "SUP-2026-0817")}" aria-label="支持查询工单号" /></label>
        <label><span>查询范围</span><select data-ops-support-scope aria-label="支持查询范围"><option value="application_status" ${(lookup.scopeKey || "application_status") === "application_status" ? "selected" : ""}>申请和发送状态</option><option value="payment_status" ${lookup.scopeKey === "payment_status" ? "selected" : ""}>支付和对账状态</option><option value="tenant_access" ${lookup.scopeKey === "tenant_access" ? "selected" : ""}>租户和账号权限</option><option value="agent_context" ${lookup.scopeKey === "agent_context" ? "selected" : ""}>Agent 上下文摘要</option></select></label>
        <label><span>访问原因</span><input data-ops-support-reason value="${escapeHtml(lookup.reason || "检查申请发送状态")}" aria-label="支持访问原因" /></label>
        <button class="primary-action" data-ops-action="support-lookup" type="button">打开审计支持视图</button>
      </div>
      <p class="ops-queue-note">支持访问必须限定用途，并写入审计事件。不得依赖或索取学生密码。</p>
      ${opsState.supportLookup ? `<div class="ops-support-result"><span>最近查询</span><strong>${escapeHtml(lookup.query)} · ${escapeHtml(lookup.ticket || "无工单号")}</strong><p>${escapeHtml(lookup.reason)} · ${escapeHtml(lookup.scope)}</p></div>` : ""}
    </article>
  `;
}

function renderOpsQueueViewPanel(view, activeView, html) {
  return `<div class="ops-queue-view-panel" data-ops-queue-view-panel="${escapeHtml(view)}" ${activeView === view ? "" : "hidden"}>${html}</div>`;
}

function inferOpsAuditModule(label = "") {
  if (/Agent|AI|策略/.test(label)) return "agent";
  if (/支付|对账|payment/i.test(label)) return "payment";
  if (/账号|权限|邀请|授权/.test(label)) return "access";
  if (/学生/.test(label)) return "students";
  if (/学校|项目|目录|CSCA|奖学金|城市|时间窗/.test(label)) return "catalog";
  if (/支持查询|审计支持/.test(label)) return "support";
  if (/发送|重试|队列/.test(label)) return "application";
  return "ops";
}

function inferOpsAuditAction(label = "") {
  if (/导出|CSV/.test(label)) return "export";
  if (/新增|创建|生成.*草稿|邀请草稿/.test(label)) return "create";
  if (/保存|更新|发放|批准|恢复|停用|归档|发布/.test(label)) return "update";
  if (/重试|排队/.test(label)) return "retry";
  if (/支持查询/.test(label)) return "support_lookup";
  if (/复核|查看|打开/.test(label)) return "review";
  return "record";
}

function normalizeOpsAuditEvent(event, index = 0) {
  const item = isPlainRecord(event) ? event : { summary: String(event || "") };
  const summary = item.summary || item.label || item.actionLabel || "审计事件";
  const module = item.module || inferOpsAuditModule(summary);
  const action = item.action || inferOpsAuditAction(summary);
  return {
    id: item.id || `audit-${index + 1}`,
    occurredAt: item.occurredAt || item.createdAt || item.updatedAt || "2026-08-17T10:00:00.000Z",
    actor: item.actor || "CUAC Ops",
    module,
    resourceType: item.resourceType || ({
      agent: "agent_action",
      payment: "payment_event",
      access: "admin_user",
      students: "student_application",
      catalog: "catalog_record",
      support: "support_lookup",
      application: "application_routing",
    }[module] || "ops_event"),
    action,
    summary,
    scope: item.scope || "admin",
    status: item.status || "recorded",
  };
}

function readOpsAuditEvents(state = readOpsAdminState()) {
  const stored = toArray(state.auditEvents).map((item, index) => normalizeOpsAuditEvent(item, index));
  const itemEvents = toArray(state.auditItems).map((summary, index) => normalizeOpsAuditEvent({
    id: `audit-item-${index + 1}`,
    summary,
    occurredAt: state.updatedAt || "2026-08-17T10:00:00.000Z",
  }, stored.length + index));
  const events = [...stored, ...itemEvents];
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.summary}__${event.module}__${event.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function opsAuditModuleLabel(module) {
  return {
    catalog: "目录数据",
    application: "申请发送",
    payment: "支付",
    agent: "Agent",
    access: "账号权限",
    students: "学生申请",
    support: "支持查询",
    ops: "运营",
  }[module] || module || "后台";
}

function opsAuditActionLabel(action) {
  return {
    create: "新增",
    update: "更新",
    review: "查看/复核",
    retry: "重试",
    export: "导出",
    record: "记录",
    support_lookup: "支持查询",
  }[action] || action || "记录";
}

function opsAuditResourceTypeLabel(resourceType) {
  return {
    agent_action: "Agent 操作",
    payment_event: "支付事件",
    admin_user: "账号",
    student_application: "学生申请",
    catalog_record: "目录记录",
    support_lookup: "支持查询",
    application_routing: "申请发送",
    ops_event: "运营事件",
  }[resourceType] || resourceType || "后台记录";
}

function opsAuditStatusLabel(status) {
  return {
    recorded: "已记录",
    blocked: "已拦截",
    allowed: "已允许",
    failed: "失败",
    pending: "待处理",
  }[status] || status || "已记录";
}

function opsAuditSeverity(event = {}) {
  if (event.status === "blocked" || event.module === "agent" || event.action === "export" || event.action === "support_lookup") return "高";
  if (event.module === "payment" || event.module === "access" || event.action === "update") return "中";
  return "低";
}

function opsAuditSeverityTone(severity = "") {
  if (severity === "高") return "danger";
  if (severity === "中") return "warn";
  return "";
}

function getOpsSelectedAuditEvent(events = [], state = readOpsAdminState()) {
  return events.find((event) => String(event.id) === String(state.selectedAuditId || "")) || events[0] || null;
}

function renderOpsAuditEvidence(event = {}) {
  if (!event) return "";
  const severity = opsAuditSeverity(event);
  const rows = [
    ["发生时间", formatOpsTimestamp(event.occurredAt) || "时间待确认"],
    ["操作人", event.actor || "未知"],
    ["模块/动作", `${opsAuditModuleLabel(event.module)} · ${opsAuditActionLabel(event.action)}`],
    ["资源类型", opsAuditResourceTypeLabel(event.resourceType)],
    ["访问范围", event.scope || "admin"],
    ["状态", opsAuditStatusLabel(event.status)],
  ];
  return `
    <aside class="ops-audit-detail" data-ops-audit-detail data-audit-id="${escapeHtml(event.id)}">
      <div class="section-head compact">
        <div><span class="module-kicker">审计详情</span><h3>${escapeHtml(event.summary)}</h3></div>
        <span class="status-pill ${escapeHtml(opsAuditSeverityTone(severity))}">${escapeHtml(`${severity}风险`)}</span>
      </div>
      <div class="ops-audit-evidence-grid">
        ${rows.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
      </div>
      <p class="ops-queue-note">这条记录用于证明后台操作的操作者、范围、动作和结果；导出或支持查询类事件需要保留访问原因。</p>
    </aside>
  `;
}

function filterOpsAuditEvents(events, state = readOpsAdminState()) {
  const search = String(state.auditSearch || "").trim().toLowerCase();
  const moduleFilter = state.auditModuleFilter || "all";
  const actionFilter = state.auditActionFilter || "all";
  return events.filter((event) => {
    const matchesModule = moduleFilter === "all" || event.module === moduleFilter;
    const matchesAction = actionFilter === "all" || event.action === actionFilter;
    const haystack = [
      event.actor,
      event.module,
      opsAuditModuleLabel(event.module),
      event.resourceType,
      opsAuditResourceTypeLabel(event.resourceType),
      event.action,
      opsAuditActionLabel(event.action),
      event.summary,
      event.scope,
      event.status,
      opsAuditStatusLabel(event.status),
    ].join(" ").toLowerCase();
    return matchesModule && matchesAction && (!search || haystack.includes(search));
  });
}

function renderOpsAuditEventsPanel(auditEvents, opsState) {
  const filtered = filterOpsAuditEvents(auditEvents, opsState);
  const selected = getOpsSelectedAuditEvent(filtered, opsState);
  return `
    <article class="ops-queue-section ops-audit-events-panel" data-ops-audit-events-panel>
      <div class="section-head">
        <div><span class="module-kicker">审计事件</span><h2>后台操作留痕</h2></div>
        <div class="inline-actions"><span class="status-pill" data-ops-last-action>${escapeHtml(opsState.lastAction || "本次会话暂无操作")}</span><button class="secondary-action" data-ops-audit-export type="button">导出审计 CSV</button></div>
      </div>
      <div class="ops-filter-bar" aria-label="审计筛选">
        <label><span>搜索</span><input data-ops-audit-search value="${escapeHtml(opsState.auditSearch || "")}" placeholder="模块、资源、动作、摘要" /></label>
        <label><span>模块</span><select data-ops-audit-module-filter><option value="all">全部模块</option><option value="catalog" ${opsState.auditModuleFilter === "catalog" ? "selected" : ""}>目录数据</option><option value="application" ${opsState.auditModuleFilter === "application" ? "selected" : ""}>申请发送</option><option value="payment" ${opsState.auditModuleFilter === "payment" ? "selected" : ""}>支付</option><option value="agent" ${opsState.auditModuleFilter === "agent" ? "selected" : ""}>Agent</option><option value="access" ${opsState.auditModuleFilter === "access" ? "selected" : ""}>账号权限</option><option value="support" ${opsState.auditModuleFilter === "support" ? "selected" : ""}>支持查询</option></select></label>
        <label><span>动作</span><select data-ops-audit-action-filter><option value="all">全部动作</option><option value="create" ${opsState.auditActionFilter === "create" ? "selected" : ""}>新增</option><option value="update" ${opsState.auditActionFilter === "update" ? "selected" : ""}>更新</option><option value="review" ${opsState.auditActionFilter === "review" ? "selected" : ""}>查看/复核</option><option value="retry" ${opsState.auditActionFilter === "retry" ? "selected" : ""}>重试</option><option value="support_lookup" ${opsState.auditActionFilter === "support_lookup" ? "selected" : ""}>支持查询</option><option value="export" ${opsState.auditActionFilter === "export" ? "selected" : ""}>导出</option></select></label>
        <button class="secondary-action" data-ops-audit-apply-filter type="button">筛选审计</button>
      </div>
      <div class="ops-audit-workbench">
        <div class="audit-list structured" data-ops-audit-list>
          ${filtered.map((event) => {
            const severity = opsAuditSeverity(event);
            return `<button class="ops-audit-event-row ${selected?.id === event.id ? "selected" : ""}" data-ops-audit-select data-audit-id="${escapeHtml(event.id)}" data-module="${escapeHtml(event.module)}" data-action="${escapeHtml(event.action)}" type="button"><span>${escapeHtml(formatOpsTimestamp(event.occurredAt) || "时间待确认")}</span><strong>${escapeHtml(event.summary)}</strong><small>${escapeHtml(event.actor)} · ${escapeHtml(opsAuditModuleLabel(event.module))} · ${escapeHtml(opsAuditStatusLabel(event.status))}</small><b class="${escapeHtml(opsAuditSeverityTone(severity))}">${escapeHtml(`${severity}风险`)}</b></button>`;
          }).join("") || `<p class="ops-empty">没有匹配的审计事件。</p>`}
        </div>
        ${renderOpsAuditEvidence(selected)}
      </div>
      ${opsState.auditExportCsv ? `<div class="ops-support-result" data-ops-audit-export-result><span>最近导出</span><strong>${escapeHtml(String(opsState.auditExportCount || 0))} 条审计事件</strong><p>已生成可下载审计 CSV，包含时间、操作人、模块、动作、范围和摘要。</p></div>` : ""}
    </article>
  `;
}

function defaultOpsAccessRecords() {
  return [
    {
      id: "user-maya",
      email: "maya.student@example.com",
      name: "Maya Chen",
      role: "student",
      workspace: "学生申请中心",
      schoolTenant: "",
      grantStatus: "approved-preview",
      status: "active",
      inviteCode: "",
      source: "self_registered",
      agentAccessStatus: "免费可用",
      createdAt: "2026-08-01",
      updatedAt: "2026-08-18",
      lastAction: "学生账号已验证邮箱",
    },
    {
      id: "user-zju-staff",
      email: "iso@zju.edu.cn",
      name: "ZJU International Office",
      role: "school_staff",
      workspace: "浙江大学学校工作台",
      schoolTenant: "Zhejiang University",
      grantStatus: "approved-preview",
      status: "active",
      inviteCode: "ZJU-2026-ISO",
      source: "school_staff_invite",
      agentAccessStatus: "免费可用",
      createdAt: "2026-08-06",
      updatedAt: "2026-08-19",
      lastAction: "学校成员邀请已接受",
    },
    {
      id: "user-nju-pending",
      email: "admission@nju.edu.cn",
      name: "NJU Admissions",
      role: "school_staff",
      workspace: "南京大学学校工作台",
      schoolTenant: "Nanjing University",
      grantStatus: "pending-review",
      status: "active",
      inviteCode: "NJU-2026-INTL",
      source: "school_staff_invite",
      agentAccessStatus: "待授权",
      createdAt: "2026-08-15",
      updatedAt: "2026-08-15",
      lastAction: "等待租户管理员批准",
    },
    {
      id: "user-ops-admin",
      email: "ops@cuac.example",
      name: "CUAC Ops",
      role: "cuac_ops",
      workspace: "运营管理后台",
      schoolTenant: "",
      grantStatus: "approved-preview",
      status: "active",
      inviteCode: "CUAC-OPS-2026",
      source: "admin_assignment",
      agentAccessStatus: "免费可用",
      createdAt: "2026-08-03",
      updatedAt: "2026-08-20",
      lastAction: "内部权限已审计",
    },
  ];
}

function readOpsAccessRecords(state = readOpsAdminState()) {
  const records = Array.isArray(state.accessRecords) && state.accessRecords.length ? state.accessRecords : defaultOpsAccessRecords();
  return records.map((record, index) => {
    const item = isPlainRecord(record) ? record : {};
    return {
      id: item.id || `access-${index + 1}`,
      email: item.email || "",
      name: item.name || item.displayName || "未命名账号",
      role: item.role || "student",
      workspace: item.workspace || "CUAC",
      schoolTenant: item.schoolTenant || "",
      grantStatus: item.grantStatus || "pending-review",
      status: item.status || "active",
      inviteCode: item.inviteCode || "",
      source: item.source || "manual_preview",
      agentAccessStatus: item.agentAccessStatus || (item.grantStatus === "pending-review" ? "待授权" : item.status === "disabled" || item.grantStatus === "revoked" ? "暂停使用" : "免费可用"),
      lastAgentAccessReason: item.lastAgentAccessReason || item.lastAgentGrantReason || "",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      lastAction: item.lastAction || "待处理",
    };
  });
}

function filterOpsAccessRecords(records, state = readOpsAdminState()) {
  const search = String(state.accessSearch || "").trim().toLowerCase();
  const statusFilter = state.accessStatusFilter || "all";
  const roleFilter = state.accessRoleFilter || "all";
  const grantFilter = state.accessGrantFilter || "all";
  return records.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesRole = roleFilter === "all" || item.role === roleFilter;
    const matchesGrant = grantFilter === "all" || item.grantStatus === grantFilter;
    const haystack = [
      item.email,
      item.name,
      item.role,
      item.status,
      item.grantStatus,
      item.agentAccessStatus,
      item.workspace,
      item.schoolTenant,
      item.inviteCode,
      item.source,
      opsAccessSourceLabel(item.source),
      item.lastAction,
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && matchesRole && matchesGrant && (!search || haystack.includes(search));
  });
}

function opsAccessRoleLabel(role) {
  return {
    student: "学生",
    school_staff: "学校老师",
    cuac_ops: "CUAC 运营",
    cuac_admin: "CUAC 管理员",
  }[role] || role || "未知角色";
}

function opsAccessGrantLabel(status) {
  return {
    "approved-preview": "已授权",
    "pending-review": "待审批",
    revoked: "已撤销",
  }[status] || status || "待审批";
}

function opsAccessSourceLabel(source) {
  return {
    self_registered: "自主注册",
    school_staff_invite: "学校邀请",
    admin_assignment: "运营分配",
    manual_preview: "手动预览",
  }[source] || source || "来源待补充";
}

function opsAccessStatusTone(item = {}) {
  if (item.status === "disabled" || item.grantStatus === "revoked") return "danger";
  if (item.grantStatus === "pending-review") return "warn";
  return "";
}

function opsAccessNeedsAgentReview(item = {}) {
  return String(item.agentAccessStatus || "").includes("复核") || String(item.agentAccessStatus || "").includes("暂停") || String(item.agentAccessStatus || "").includes("待");
}

function opsAccessRiskReasons(item = {}) {
  const reasons = [];
  if (item.grantStatus === "pending-review") reasons.push("授权未完成");
  if (item.grantStatus === "revoked") reasons.push("授权已撤销");
  if (item.status === "disabled") reasons.push("账号已停用");
  if (item.role === "school_staff" && !item.schoolTenant) reasons.push("学校租户缺失");
  if (opsAccessNeedsAgentReview(item)) reasons.push("Agent 需复核");
  return reasons;
}

function opsAccessNextStep(item = {}) {
  const isDisabled = item.status === "disabled" || item.grantStatus === "revoked";
  if (isDisabled) return "确认账号归属和最近审计记录后恢复账号，或保持停用。";
  if (item.grantStatus === "pending-review") return "先核对学校租户和邀请来源，再批准进入对应工作台。";
  if (opsAccessNeedsAgentReview(item)) return "复核 Agent 服务状态，补充审计原因后再开放。";
  return "权限链路完整，可作为正常账号样本继续抽查。";
}

function opsAccessPrimaryAction(item = {}) {
  const isDisabled = item.status === "disabled" || item.grantStatus === "revoked";
  if (isDisabled) return { label: "恢复账号", kind: "toggle", tone: "" };
  if (item.grantStatus === "pending-review") return { label: "审批租户", kind: "approve", tone: "" };
  if (opsAccessNeedsAgentReview(item)) return { label: "复核 Agent", kind: "agent", tone: "" };
  return { label: "看权限", kind: "select", tone: "secondary" };
}

function renderOpsAccessPrimaryAction(item = {}) {
  const action = opsAccessPrimaryAction(item);
  if (action.kind === "approve") return `<button class="primary-action" data-ops-access-approve data-access-id="${escapeHtml(item.id)}" type="button">${escapeHtml(action.label)}</button>`;
  if (action.kind === "toggle") return `<button class="primary-action" data-ops-access-toggle data-access-id="${escapeHtml(item.id)}" type="button">${escapeHtml(action.label)}</button>`;
  if (action.kind === "agent") return `<button class="primary-action" data-ops-access-open-grant data-access-id="${escapeHtml(item.id)}" type="button">${escapeHtml(action.label)}</button>`;
  return `<button class="primary-action" data-ops-access-select data-access-id="${escapeHtml(item.id)}" type="button">${escapeHtml(action.label)}</button>`;
}

function renderOpsAccessCard(item, selectedId = "") {
  const isDisabled = item.status === "disabled" || item.grantStatus === "revoked";
  const action = opsAccessPrimaryAction(item);
  const reasons = opsAccessRiskReasons(item);
  const riskCopy = reasons.join(" / ");
  return `
    <article class="ops-access-card ops-access-list-row ${String(selectedId) === String(item.id) ? "selected" : ""}" data-ops-access-card data-access-id="${escapeHtml(item.id)}">
      <div class="ops-access-card-head">
        <div class="ops-entity-cell">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.email)}</span>
        </div>
        <span class="status-pill ${opsAccessStatusTone(item)}">${escapeHtml(opsAccessGrantLabel(item.grantStatus))}</span>
      </div>
      <div class="ops-access-row-meta">
        <span>${escapeHtml(opsAccessRoleLabel(item.role))}</span>
        <span>${escapeHtml(item.schoolTenant ? `${item.schoolTenant} 租户` : "CUAC 租户")}</span>
        <span>${escapeHtml(`Agent ${item.agentAccessStatus || "免费可用"}`)}</span>
        <span>${escapeHtml(item.status === "disabled" ? "账号停用" : "账号启用")}</span>
      </div>
      ${reasons.length ? `<p class="ops-access-risk-note warn">${escapeHtml(riskCopy)} · ${escapeHtml(opsAccessNextStep(item))}</p>` : ""}
      <div class="ops-access-card-foot">
        <div><span>${escapeHtml(item.workspace)}</span><small>${escapeHtml(item.lastAction)} · ${escapeHtml(opsAccessSourceLabel(item.source))}</small></div>
        <div class="ops-access-card-actions" aria-label="账号操作">
          ${renderOpsAccessPrimaryAction(item)}
          ${action.kind !== "select" ? `<button class="secondary-action" data-ops-access-select data-access-id="${escapeHtml(item.id)}" type="button">详情</button>` : ""}
          ${action.kind !== "agent" ? `<button class="secondary-action" data-ops-access-open-grant data-access-id="${escapeHtml(item.id)}" type="button">Agent</button>` : ""}
          <button class="secondary-action ${isDisabled ? "" : "danger"}" data-ops-access-toggle data-access-id="${escapeHtml(item.id)}" type="button">${isDisabled ? "恢复账号" : "停用账号"}</button>
        </div>
      </div>
    </article>
  `;
}

function renderOpsAccessViewTabs(activeView, rows = []) {
  const counts = {
    accounts: rows.length,
    invites: rows.filter((item) => item.grantStatus === "pending-review").length,
    agent: rows.filter((item) => String(item.agentAccessStatus || "").includes("复核") || String(item.agentAccessStatus || "").includes("暂停") || String(item.agentAccessStatus || "").includes("待")).length,
    boundary: 4,
  };
  return `
    <nav class="ops-access-view-tabs" aria-label="账号权限工作区" role="tablist">
      ${opsAccessViews.map(([key, label]) => `<button class="${activeView === key ? "active" : ""}" data-ops-access-view="${escapeHtml(key)}" type="button" role="tab" aria-selected="${activeView === key ? "true" : "false"}"><span>${escapeHtml(label)}</span><small>${escapeHtml(String(counts[key] ?? ""))}</small></button>`).join("")}
    </nav>
  `;
}

function renderOpsAccessViewPanel(view, activeView, html) {
  return `<section class="ops-access-view-panel" data-ops-access-view-panel="${escapeHtml(view)}" ${view === activeView ? "" : "hidden"}>${html}</section>`;
}

function renderOpsAccessCommandCenter(accessRows = [], filteredRows = []) {
  const pendingCount = accessRows.filter((item) => item.grantStatus === "pending-review").length;
  const agentReviewCount = accessRows.filter((item) => opsAccessNeedsAgentReview(item)).length;
  const disabledCount = accessRows.filter((item) => item.status === "disabled" || item.grantStatus === "revoked").length;
  const nextAction = pendingCount ? "先审批租户" : agentReviewCount ? "先复核 Agent" : disabledCount ? "抽查停用账号" : "抽查权限样本";
  return `
    <section class="ops-access-command-center" aria-label="账号权限操作台">
      <div class="ops-access-command-copy">
        <span class="module-kicker">权限处理入口</span>
        <strong>${escapeHtml(nextAction)}</strong>
        <small>账号能否进入工作台，由角色、租户绑定、授权审批、Agent 边界和账号状态共同决定。</small>
      </div>
      <div class="ops-access-command-metrics" aria-label="账号权限摘要">
        <span><strong>${pendingCount}</strong> 待审批</span>
        <span><strong>${agentReviewCount}</strong> Agent 复核</span>
        <span><strong>${filteredRows.length}</strong> 当前记录</span>
      </div>
      <div class="ops-access-command-actions">
        <button class="secondary-action micro" data-ops-access-export type="button">导出 CSV</button>
      </div>
    </section>
  `;
}

function buildOpsAccessPortfolioStats(accessRows = []) {
  const pendingRows = accessRows.filter((item) => item.grantStatus === "pending-review");
  const disabledRows = accessRows.filter((item) => item.status === "disabled" || item.grantStatus === "revoked");
  const agentReviewRows = accessRows.filter((item) => opsAccessNeedsAgentReview(item));
  const schoolStaffRows = accessRows.filter((item) => item.role === "school_staff");
  const invitedRows = accessRows.filter((item) => item.source === "school_staff_invite" || item.inviteCode);
  const tenantBoundRows = accessRows.filter((item) => item.role !== "school_staff" || item.schoolTenant);
  const activeApprovedRows = accessRows.filter((item) => item.status === "active" && item.grantStatus === "approved-preview");
  const readyRows = activeApprovedRows.filter((item) => item.agentAccessStatus === "免费可用");
  const missingTenantRows = accessRows.filter((item) => item.role === "school_staff" && !item.schoolTenant);
  return {
    total: accessRows.length,
    pendingCount: pendingRows.length,
    disabledCount: disabledRows.length,
    agentReviewCount: agentReviewRows.length,
    schoolStaffCount: schoolStaffRows.length,
    readyCount: readyRows.length,
    missingTenantCount: missingTenantRows.length,
    roleRows: opsCountRows(accessRows, (item) => opsAccessRoleLabel(item.role)),
    grantRows: opsCountRows(accessRows, (item) => opsAccessGrantLabel(item.grantStatus)),
    sourceRows: opsCountRows(accessRows, (item) => opsAccessSourceLabel(item.source)),
    tenantRows: opsCountRows(accessRows, (item) => item.schoolTenant || "CUAC"),
    flowRows: [
      { label: "账号记录", count: accessRows.length },
      { label: "邀请/注册", count: invitedRows.length + accessRows.filter((item) => item.source === "self_registered").length },
      { label: "租户已绑定", count: tenantBoundRows.length },
      { label: "已授权", count: accessRows.filter((item) => item.grantStatus === "approved-preview").length },
      { label: "Agent 可用", count: accessRows.filter((item) => item.agentAccessStatus === "免费可用").length },
      { label: "工作台可用", count: activeApprovedRows.length },
    ],
    riskRows: [
      { label: "待审批邀请", count: pendingRows.length, copy: "影响学校工作台可用", action: "审批租户" },
      { label: "Agent 需复核", count: agentReviewRows.length, copy: "影响申请辅助开放", action: "复核 Agent" },
      { label: "停用/撤销", count: disabledRows.length, copy: "影响账号登录", action: "确认恢复或保留" },
      { label: "学校租户缺失", count: missingTenantRows.length, copy: "影响学校数据边界", action: "补齐租户" },
    ],
  };
}

function renderOpsAccessGrantFlow(rows = [], total = 0) {
  const safeTotal = Math.max(1, Number(total || 0));
  return `
    <div class="ops-access-grant-flow" aria-label="账号权限流转">
      ${rows.map((row, index) => {
        const count = Number(row.count || 0);
        const previous = index > 0 ? Number(rows[index - 1]?.count || 0) : count;
        const conversion = index === 0 ? 100 : Math.round((count / Math.max(1, previous)) * 100);
        const totalRate = Math.round((count / safeTotal) * 100);
        const drop = index === 0 ? 0 : Math.max(0, previous - count);
        return `
          <article class="${drop ? "has-drop" : "is-clear"}" style="--stage:${Math.max(12, totalRate)}%">
            <span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
            <strong>${escapeHtml(row.label)}</strong>
            <b>${escapeHtml(String(count))}</b>
            <small>${escapeHtml(index === 0 ? `${totalRate}% 基准` : `${conversion}% 承接`)}</small>
            <em>${escapeHtml(drop ? `卡点 ${drop}` : "无卡点")}</em>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderOpsAccessRiskQueue(rows = []) {
  const activeRows = rows.filter((row) => Number(row.count || 0) > 0);
  return `
    <div class="ops-access-risk-queue" aria-label="账号权限风险队列">
      ${(activeRows.length ? activeRows : [{ label: "暂无阻塞", count: 0, copy: "权限链路当前可用", action: "保持抽查" }]).map((row, index) => `
        <article class="${index === 0 && Number(row.count || 0) > 0 ? "priority" : ""}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(String(row.count || 0))}</strong>
          <small>${escapeHtml(row.copy || "")}</small>
          <b>${escapeHtml(row.action || "处理")}</b>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOpsAccessGrantStatus(rows = [], total = 0) {
  const safeTotal = Math.max(1, Number(total || 0));
  const toneMap = {
    已授权: "ok",
    待审批: "warn",
    已撤销: "danger",
  };
  const ordered = ["已授权", "待审批", "已撤销"].map((label) => rows.find((row) => row.label === label) || { label, count: 0 });
  return `
    <div class="ops-access-status-bars" aria-label="账号授权状态分布">
      ${ordered.map((row) => {
        const count = Number(row.count || 0);
        const percent = Math.round((count / safeTotal) * 100);
        return `
          <article class="tone-${escapeHtml(toneMap[row.label] || "neutral")}">
            <div>
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(String(count))}</strong>
            </div>
            <div class="ops-access-status-track" style="--value:${Math.max(4, percent)}%">
              <b></b>
            </div>
            <small>${escapeHtml(`${percent}% 账号`)}</small>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderOpsAccessPortfolioDashboard(accessRows = [], filteredRows = []) {
  const stats = buildOpsAccessPortfolioStats(accessRows);
  const filterCopy = filteredRows.length === accessRows.length
    ? "当前展示全部账号"
    : `当前筛选出 ${filteredRows.length} 个账号`;
  return `
    <section class="ops-access-portfolio-dashboard" aria-label="账号权限统计总览">
      <div class="ops-access-portfolio-head">
        <div>
          <span class="module-kicker">权限治理总览</span>
          <h3>角色、租户、审批和 Agent 权限</h3>
          <p>${escapeHtml(filterCopy)}；先看是否有待审批、跨租户或 Agent 风险，再进入账号列表处理。</p>
        </div>
        <span class="status-pill ${stats.pendingCount ? "warn" : ""}">${escapeHtml(`${stats.pendingCount} 个待审批`)}</span>
      </div>
      <div class="ops-access-portfolio-metrics">
        <article class="tone-total"><span>工作台可用</span><strong>${escapeHtml(String(stats.readyCount))}</strong><small>已授权且 Agent 可用</small></article>
        <article class="tone-school"><span>租户账号</span><strong>${escapeHtml(String(stats.schoolStaffCount))}</strong><small>${escapeHtml(`${stats.missingTenantCount} 个租户缺失`)}</small></article>
        <article class="tone-warn"><span>待审批</span><strong>${escapeHtml(String(stats.pendingCount))}</strong><small>邀请或授权未完成</small></article>
        <article class="tone-agent"><span>Agent 复核</span><strong>${escapeHtml(String(stats.agentReviewCount))}</strong><small>${escapeHtml(`${stats.disabledCount} 个停用/撤销`)}</small></article>
      </div>
      <div class="ops-access-portfolio-charts">
        <section class="ops-chart-panel large">
          <div><h3>权限流转</h3><small>从账号记录到工作台可用</small></div>
          ${renderOpsAccessGrantFlow(stats.flowRows, stats.total)}
        </section>
        <section class="ops-chart-panel">
          <div><h3>角色结构</h3><small>谁进入哪个工作台</small></div>
          ${renderOpsStackedChart(stats.roleRows, "账号角色结构")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>授权状态</h3><small>审批、撤销、已授权</small></div>
          ${renderOpsAccessGrantStatus(stats.grantRows, stats.total)}
        </section>
        <section class="ops-chart-panel">
          <div><h3>账号来源</h3><small>注册、邀请、运营分配</small></div>
          ${renderOpsFunnelChart(stats.sourceRows, "账号来源")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>租户归属</h3><small>学校账号与 CUAC 内部</small></div>
          ${renderOpsBubbleChart(stats.tenantRows, "账号租户归属", 5)}
        </section>
        <section class="ops-chart-panel emphasis">
          <div><h3>权限风险队列</h3><small>审批和 Agent 边界</small></div>
          ${renderOpsAccessRiskQueue(stats.riskRows)}
        </section>
      </div>
    </section>
  `;
}

function getOpsSelectedAccess(records = [], state = readOpsAdminState()) {
  const selectedId = state.selectedAccessId || state.accessGrantUserId;
  return records.find((item) => String(item.id) === String(selectedId)) || records[0] || null;
}

function opsAccessDetailGateRows(item = {}) {
  const tenantOk = item.role !== "school_staff" || Boolean(item.schoolTenant);
  const grantOk = item.grantStatus === "approved-preview";
  const activeOk = item.status === "active";
  const agentOk = item.agentAccessStatus === "免费可用";
  return [
    { label: "角色", value: opsAccessRoleLabel(item.role), tone: item.role ? "ok" : "warn", copy: item.workspace || "工作台待确认" },
    { label: "租户绑定", value: tenantOk ? item.schoolTenant || "CUAC" : "待绑定", tone: tenantOk ? "ok" : "danger", copy: item.role === "school_staff" ? "学校老师必须绑定学校租户" : "内部或学生账号不需要学校租户" },
    { label: "授权审批", value: opsAccessGrantLabel(item.grantStatus), tone: grantOk ? "ok" : item.grantStatus === "revoked" ? "danger" : "warn", copy: item.inviteCode || "无邀请码" },
    { label: "Agent", value: item.agentAccessStatus || "待确认", tone: agentOk ? "ok" : "warn", copy: item.lastAgentAccessReason || "申请辅助 Agent 免费开放，按账号权限审计" },
    { label: "账号状态", value: activeOk ? "可登录" : "已停用", tone: activeOk ? "ok" : "danger", copy: item.lastAction || "待处理" },
  ];
}

function renderOpsAccessDetail(item = {}) {
  if (!item) return "";
  const isDisabled = item.status === "disabled" || item.grantStatus === "revoked";
  const canApprove = item.grantStatus !== "approved-preview" && !isDisabled;
  const gates = opsAccessDetailGateRows(item);
  const reasons = opsAccessRiskReasons(item);
  const decisionTone = isDisabled ? "danger" : reasons.length ? "warn" : "ok";
  const decisionTitle = isDisabled ? "账号不可进入工作台" : reasons.length ? "需要管理员处理" : "权限链路可用";
  return `
    <article class="ops-access-detail" data-ops-access-detail data-access-id="${escapeHtml(item.id)}">
      <div class="section-head compact">
        <div>
          <span class="module-kicker">账号权限详情</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.email)} · ${escapeHtml(opsAccessRoleLabel(item.role))}</p>
        </div>
        <span class="status-pill ${opsAccessStatusTone(item)}">${escapeHtml(opsAccessGrantLabel(item.grantStatus))}</span>
      </div>
      <section class="ops-access-decision tone-${escapeHtml(decisionTone)}" aria-label="权限判断结果">
        <div>
          <span>权限判断</span>
          <strong>${escapeHtml(decisionTitle)}</strong>
          <p>${escapeHtml(reasons.length ? reasons.join(" / ") : "角色、租户、审批、Agent 和账号状态均未发现阻塞。")}</p>
        </div>
        <small>${escapeHtml(opsAccessNextStep(item))}</small>
      </section>
      <section class="ops-access-detail-gates" aria-label="账号权限判断链">
        ${gates.map((gate) => `<article class="tone-${escapeHtml(gate.tone)}"><span>${escapeHtml(gate.label)}</span><strong>${escapeHtml(gate.value)}</strong><small>${escapeHtml(gate.copy)}</small></article>`).join("")}
      </section>
      <div class="ops-access-detail-summary">
        <article><span>进入工作台</span><strong>${escapeHtml(item.workspace)}</strong><small>${escapeHtml(item.schoolTenant || "CUAC / 学生侧")}</small></article>
        <article><span>来源</span><strong>${escapeHtml(opsAccessSourceLabel(item.source))}</strong><small>${escapeHtml(item.inviteCode || "无邀请码")}</small></article>
        <article><span>最近动作</span><strong>${escapeHtml(item.lastAction || "待处理")}</strong><small>${escapeHtml(item.updatedAt || "更新时间待确认")}</small></article>
      </div>
      <div class="ops-access-detail-actions">
        ${canApprove ? `<button class="primary-action" data-ops-access-approve data-access-id="${escapeHtml(item.id)}" type="button">批准租户访问</button>` : ""}
        <button class="secondary-action" data-ops-access-open-grant data-access-id="${escapeHtml(item.id)}" type="button">复核 Agent</button>
        <button class="secondary-action ${isDisabled ? "" : "danger"}" data-ops-access-toggle data-access-id="${escapeHtml(item.id)}" type="button">${isDisabled ? "恢复账号" : "停用账号"}</button>
      </div>
    </article>
  `;
}

function renderOpsInviteFlow() {
  const rows = [
    ["邀请草稿", "只创建可审计邀请，不直接创建账号"],
    ["对方注册/登录", "被邀请人仍使用统一入口"],
    ["租户绑定", "学校老师必须绑定 schoolTenant"],
    ["管理员审批", "角色和租户通过后才生效"],
    ["工作台可用", "进入学校、学生或运营工作台"],
  ];
  return `
    <section class="ops-access-process-flow" aria-label="邀请审批流程">
      ${rows.map(([title, copy], index) => `<article><span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></article>`).join("")}
    </section>
  `;
}

function renderOpsAgentBoundaryMatrix() {
  const rows = [
    ["可用能力", "申请辅助、资料解释、学校/项目导航", "免费可用账号"],
    ["禁止能力", "跨租户导出、伪造审批、绕过支付或学校边界", "所有账号"],
    ["审计触发", "权限变更、支持查询、跨租户拒绝、Agent 状态变更", "运营与管理员"],
    ["人工复核", "账号暂停、异常请求、学校租户不匹配", "需复核队列"],
  ];
  return `
    <section class="ops-access-agent-boundary" aria-label="Agent 权限边界矩阵">
      ${rows.map(([label, value, scope]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(scope)}</small></article>`).join("")}
    </section>
  `;
}

function renderOpsAccessRoleMatrix() {
  const rows = [
    ["学生", "学生 Hub、申请中心、自己的 Agent 上下文", "不能进入学校工作台"],
    ["学校老师", "本校 schoolTenant、已发送给本校的申请记录", "不能看学生其他选择"],
    ["CUAC 运营", "运营后台、目录、申请、支持查询", "高风险动作写审计"],
    ["CUAC 管理员", "账号权限、审计、策略边界", "不能绕过后端租户校验"],
  ];
  return `
    <section class="ops-access-role-matrix" aria-label="角色权限矩阵">
      ${rows.map(([role, allow, guard]) => `<article><span>${escapeHtml(role)}</span><strong>${escapeHtml(allow)}</strong><small>${escapeHtml(guard)}</small></article>`).join("")}
    </section>
  `;
}

function renderOpsAccessPanel(accessRows, opsState) {
  const filteredRows = filterOpsAccessRecords(accessRows, opsState);
  const grantTarget = accessRows.find((item) => String(item.id) === String(opsState.accessGrantUserId || ""));
  const selectedAccess = getOpsSelectedAccess(filteredRows.length ? filteredRows : accessRows, opsState);
  const selectedAccessId = selectedAccess?.id || "";
  const activeView = activeOpsAccessView(opsState);
  const pendingRows = accessRows.filter((item) => item.grantStatus === "pending-review");
  const agentRows = accessRows.filter((item) => String(item.agentAccessStatus || "").includes("复核") || String(item.agentAccessStatus || "").includes("暂停") || String(item.agentAccessStatus || "").includes("待"));
  return `
    <section ${opsTabPanelAttrs("access", opsState)}>
      <div class="main-stack full">
        <article class="ops-management-surface ops-access-management">
          <div class="section-head">
            <div>
              <span class="module-kicker">账号与权限</span>
              <h2>账号权限管理</h2>
              <p>统一注册登录，按角色、租户授权和审批结果进入学生、学校或运营工作台。</p>
            </div>
          </div>
          ${renderOpsAccessCommandCenter(accessRows, filteredRows)}
          ${renderOpsAccessPortfolioDashboard(accessRows, filteredRows)}
          ${renderOpsAccessViewTabs(activeView, accessRows)}
          <div class="ops-access-view-stack">
            ${renderOpsAccessViewPanel("accounts", activeView, `
              <div class="ops-filter-bar" aria-label="账号权限筛选">
                <label><span>搜索账号</span><input data-ops-access-search value="${escapeHtml(opsState.accessSearch || "")}" placeholder="邮箱、姓名、角色、学校租户或邀请码" /></label>
                <label><span>账号状态</span><select data-ops-access-status-filter><option value="all">全部状态</option><option value="active" ${opsState.accessStatusFilter === "active" ? "selected" : ""}>启用</option><option value="disabled" ${opsState.accessStatusFilter === "disabled" ? "selected" : ""}>停用</option></select></label>
                <label><span>角色</span><select data-ops-access-role-filter><option value="all">全部角色</option><option value="student" ${opsState.accessRoleFilter === "student" ? "selected" : ""}>学生</option><option value="school_staff" ${opsState.accessRoleFilter === "school_staff" ? "selected" : ""}>学校老师</option><option value="cuac_ops" ${opsState.accessRoleFilter === "cuac_ops" ? "selected" : ""}>CUAC 运营</option><option value="cuac_admin" ${opsState.accessRoleFilter === "cuac_admin" ? "selected" : ""}>CUAC 管理员</option></select></label>
                <label><span>授权状态</span><select data-ops-access-grant-filter><option value="all">全部授权</option><option value="approved-preview" ${opsState.accessGrantFilter === "approved-preview" ? "selected" : ""}>已授权</option><option value="pending-review" ${opsState.accessGrantFilter === "pending-review" ? "selected" : ""}>待审批</option><option value="revoked" ${opsState.accessGrantFilter === "revoked" ? "selected" : ""}>已撤销</option></select></label>
                <button class="secondary-action" data-ops-access-apply-filter type="button">筛选账号</button>
              </div>
              <div class="ops-access-workbench">
                <div class="ops-management-table">${filteredRows.map((item) => renderOpsAccessCard(item, selectedAccessId)).join("") || `<p class="ops-empty">没有匹配的账号权限记录。可以调整筛选条件或生成邀请草稿。</p>`}</div>
                ${renderOpsAccessDetail(selectedAccess)}
              </div>
              ${renderOpsFieldMap("账号字段映射", "统一账号、角色、租户成员和邀请来源字段，日常操作可保持收起", ["AdminUser.email", "AdminUser.status", "user_roles.role", "organization_members.role", "organization_members.organizationId", "school_staff_invites.inviteCode", "school_staff_invites.status", "accessGrantStatus"], { compact: true })}
            `)}
            ${renderOpsAccessViewPanel("invites", activeView, `
              <div class="ops-access-panel-brief">
                <div><span class="module-kicker">邀请审批</span><h3>注册入口统一，权限单独审批</h3><p>邀请不直接创建账号；学校老师和内部运营仍然自己注册或登录，审批后才获得工作台访问。</p></div>
                <strong>${pendingRows.length}</strong>
              </div>
              ${renderOpsInviteFlow()}
              <details class="ops-access-action-panel ops-access-disclosure-panel" ${opsState.accessInviteFeedback ? "open" : "open"}>
                <summary class="ops-access-action-summary">
                  <div><h3>新增账号邀请</h3><p>邀请不直接创建账号；被邀请人仍然自己注册或登录，权限按角色与租户审批后生效。</p></div>
                  <span>邀请审批</span>
                </summary>
                <div class="ops-access-action-body">
                  ${opsState.accessInviteFeedback ? `<p class="${opsState.accessInviteFeedbackTone === "danger" ? "ops-inline-danger" : "ops-inline-success"}" data-ops-access-invite-feedback>${escapeHtml(opsState.accessInviteFeedback)}</p>` : ""}
                  <div class="ops-form-grid">
                    <label class="ops-form-field"><span>邮箱</span><input data-ops-access-invite-email value="${escapeHtml(opsState.accessInviteEmail || "new.staff@example.edu")}" /></label>
                    <label class="ops-form-field"><span>学校租户</span><input data-ops-access-invite-school value="${escapeHtml(opsState.accessInviteSchool || "浙江大学")}" /></label>
                    <label class="ops-form-field"><span>邀请码</span><input data-ops-access-invite-code value="${escapeHtml(opsState.accessInviteCode || "SCHOOL-2026-INVITE")}" /></label>
                    <label class="ops-form-field"><span>角色</span><select data-ops-access-invite-role><option value="school_staff" ${(!opsState.accessInviteRole || opsState.accessInviteRole === "school_staff") ? "selected" : ""}>学校老师</option><option value="cuac_ops" ${opsState.accessInviteRole === "cuac_ops" ? "selected" : ""}>CUAC 运营</option><option value="student" ${opsState.accessInviteRole === "student" ? "selected" : ""}>学生</option></select></label>
                  </div>
                  <div class="inline-actions"><button class="primary-action" data-ops-access-create-invite type="button">生成邀请草稿</button></div>
                </div>
              </details>
              <div class="ops-access-workbench">
                <div class="ops-management-table">${pendingRows.map((item) => renderOpsAccessCard(item, selectedAccessId)).join("") || `<p class="ops-empty">当前没有待审批邀请。</p>`}</div>
              </div>
            `)}
            ${renderOpsAccessViewPanel("agent", activeView, `
              <div class="ops-access-panel-brief">
                <div><span class="module-kicker">Agent 服务</span><h3>申请辅助免费开放，按账号权限审计</h3><p>这里管理账号是否能在对应工作台使用 Agent，不发放额度，也不展示题库相关能力。</p></div>
                <strong>${agentRows.length}</strong>
              </div>
              ${renderOpsAgentBoundaryMatrix()}
              ${grantTarget ? `
              <details class="ops-access-action-panel ops-access-disclosure-panel" data-ops-access-grant-panel data-access-id="${escapeHtml(grantTarget.id)}" open>
                <summary class="ops-access-action-summary">
                  <div><h3>Agent 服务权限</h3><p>${escapeHtml(grantTarget.email)} · Agent 申请辅助免费提供；这里只管理账号能否在对应工作台使用 Agent。</p></div>
                  <span>权限策略</span>
                </summary>
                <div class="ops-access-action-body">
                  <div class="ops-form-grid">
                    <label class="ops-form-field"><span>服务状态</span><select data-ops-access-agent-status><option value="免费可用" ${(opsState.accessAgentStatus || grantTarget.agentAccessStatus || "免费可用") === "免费可用" ? "selected" : ""}>免费可用</option><option value="暂停使用" ${(opsState.accessAgentStatus || grantTarget.agentAccessStatus) === "暂停使用" ? "selected" : ""}>暂停使用</option><option value="需复核" ${(opsState.accessAgentStatus || grantTarget.agentAccessStatus) === "需复核" ? "selected" : ""}>需复核</option></select></label>
                    <label class="ops-form-field wide"><span>审计原因</span><input data-ops-access-agent-reason value="${escapeHtml(opsState.accessAgentReason || grantTarget.lastAgentAccessReason || "申请辅助 Agent 免费开放，按账号权限审计")}" /></label>
                  </div>
                  <div class="inline-actions">
                    <button class="primary-action" data-ops-access-grant-submit data-access-id="${escapeHtml(grantTarget.id)}" type="button">保存 Agent 权限</button>
                    <button class="secondary-action" data-ops-access-grant-cancel type="button">取消</button>
                  </div>
                </div>
              </details>` : `<article class="ops-empty">从账号列表选择“Agent 权限”后，在这里编辑服务状态。</article>`}
              <div class="ops-access-workbench">
                <div class="ops-management-table">${(agentRows.length ? agentRows : accessRows).map((item) => renderOpsAccessCard(item, selectedAccessId)).join("")}</div>
              </div>
            `)}
            ${renderOpsAccessViewPanel("boundary", activeView, `
              <details class="ops-access-boundary-panel ops-access-boundary-disclosure" aria-label="权限边界" open>
                <summary class="ops-access-boundary-summary">
                  <div>
                    <span class="module-kicker">权限边界</span>
                    <h2>上线前后端复核清单</h2>
                  </div>
                  <span>4 项校验</span>
                </summary>
                <div class="ops-access-boundary-body">
                  ${renderOpsAccessRoleMatrix()}
                  <div class="ops-access-boundary-list">
                    <label><input checked type="checkbox" /><span>学校老师只能访问自己的 schoolTenant</span></label>
                    <label><input checked type="checkbox" /><span>CUAC Ops/Admin 由批准授权产生，不由注册表单直接产生</span></label>
                    <label><input checked type="checkbox" /><span>受保护动作登录后继续原动作和页面</span></label>
                    <label><input type="checkbox" /><span>真实后端需校验 continuation token、role、surface、tenantSchoolId</span></label>
                  </div>
                  ${renderOpsFieldMap("权限审计字段", "展开查看后端校验字段", ["AdminUser.id", "AdminUser.email", "AdminUser.status", "user_roles.role", "organization_members.organizationId", "school_staff_invites.status", "cuac_staff_access_grants.grant_source"], { compact: true })}
                </div>
              </details>
            `)}
          </div>
        </article>
      </div>
    </section>
  `;
}

function countFromLabel(value, fallback = 0) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function opsSafeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const OPS_INSIGHT_LABELS = {
  studyLevel: Object.fromEntries(opsStudentStudyLevelOptions),
  teachingLanguagePreference: Object.fromEntries(opsStudentTeachingLanguageOptions),
  budgetRange: Object.fromEntries(opsStudentBudgetRangeOptions),
  scholarshipNeed: Object.fromEntries(opsStudentScholarshipNeedOptions),
  selfFundingTolerance: Object.fromEntries(opsStudentSelfFundingOptions),
  financialProofStatus: Object.fromEntries(opsStudentFinancialProofOptions),
  fundingSource: Object.fromEntries(opsStudentFundingSourceOptions),
  lowCostPreference: Object.fromEntries(opsStudentLowCostOptions),
  hskStatus: Object.fromEntries(opsStudentExamOptions),
  cscaStatus: Object.fromEntries(opsStudentExamOptions),
  englishTestStatus: Object.fromEntries(opsStudentExamOptions),
  otherExamStatus: Object.fromEntries(opsStudentExamOptions),
  interviewReadiness: Object.fromEntries(opsStudentExamOptions),
  profileCompletionStatus: Object.fromEntries(opsStudentReadinessOptions),
  contactInfoStatus: Object.fromEntries(opsStudentReadinessOptions),
  passportStatus: Object.fromEntries(opsStudentReadinessOptions),
  educationHistoryStatus: Object.fromEntries(opsStudentReadinessOptions),
  transcriptStatus: Object.fromEntries(opsStudentReadinessOptions),
  degreeProofStatus: Object.fromEntries(opsStudentReadinessOptions),
  recommendationStatus: Object.fromEntries(opsStudentReadinessOptions),
  studyPlanStatus: Object.fromEntries(opsStudentReadinessOptions),
  translationNotaryStatus: Object.fromEntries(opsStudentReadinessOptions),
  choiceStage: Object.fromEntries(opsStudentChoiceStageOptions),
  applicationSubmissionStage: Object.fromEntries(opsStudentApplicationStageOptions),
  schoolSendStatus: Object.fromEntries(opsStudentSendStatusOptions),
};

function opsInsightLabel(type, value, fallback = "待确认") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return OPS_INSIGHT_LABELS[type]?.[raw] || raw || fallback;
}

function opsCountRows(rows = [], getter, fallback = "待确认") {
  const counts = rows.reduce((map, row) => {
    const raw = typeof getter === "function" ? getter(row) : row?.[getter];
    const values = Array.isArray(raw) ? raw : [raw];
    values.forEach((value) => {
      const label = String(value ?? "").trim() || fallback;
      map[label] = (map[label] || 0) + 1;
    });
    return map;
  }, {});
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function opsTopLabel(rows = [], fallback = "待确认") {
  return rows[0]?.label || fallback;
}

function opsRowCount(rows = [], label = "") {
  const target = String(label || "").toLowerCase();
  const row = rows.find((item) => String(item.label || "").toLowerCase().includes(target));
  return Number(row?.count || 0);
}

function opsPercent(value, total) {
  const base = Math.max(1, Number(total || 0));
  return Math.round((Number(value || 0) / base) * 100);
}

function buildOpsCityMismatchRows(demandRows = [], supplyRows = []) {
  const demand = new Map(demandRows.map((item) => [item.label, Number(item.count || 0)]));
  const supply = new Map(supplyRows.map((item) => [item.label, Number(item.count || 0)]));
  return [...new Set([...demand.keys(), ...supply.keys()])]
    .map((label) => {
      const demandCount = demand.get(label) || 0;
      const supplyCount = supply.get(label) || 0;
      return { label, demand: demandCount, supply: supplyCount, gap: demandCount - supplyCount };
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || b.demand - a.demand || a.label.localeCompare(b.label));
}

function buildOpsPairRows(rows = [], leftGetter, rightGetter) {
  const map = new Map();
  rows.forEach((row) => {
    const left = leftGetter(row) || "待确认";
    const right = rightGetter(row) || "待确认";
    const key = `${left}|||${right}`;
    const current = map.get(key) || { source: left, target: right, count: 0 };
    current.count += 1;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
}

function buildOpsReadinessBlockerRows(students = []) {
  const rows = [
    {
      label: "资料未完整",
      count: students.filter((student) => student.profileCompletionStatus !== "complete" || Number(student.documentChecklistCompletion || 0) < 70).length,
    },
    {
      label: "资金证明未就绪",
      count: students.filter((student) => !["ready", "not_required_yet"].includes(student.financialProofStatus)).length,
    },
    {
      label: "HSK 待推进",
      count: students.filter((student) => !["score_ready", "ready", "not_applicable"].includes(student.hskStatus)).length,
    },
    {
      label: "CSCA 待确认",
      count: students.filter((student) => !["score_ready", "ready", "not_applicable", "not_required_yet"].includes(student.cscaStatus)).length,
    },
    {
      label: "支付未完成",
      count: students.filter((student) => student.paymentState !== "paid").length,
    },
    {
      label: "学校未发送",
      count: students.filter((student) => !["sent", "school_viewed", "school_contacted"].includes(student.schoolSendStatus)).length,
    },
  ];
  return rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildOpsApplicationGateRows(students = []) {
  const isSaved = (student) => ["checklist", "application_set", "submitted"].includes(student.choiceStage);
  const isSubmitted = (student) => !["drafting", "not_started", "unknown", ""].includes(String(student.applicationSubmissionStage || ""));
  const isPaid = (student) => student.paymentState === "paid";
  const isSent = (student) => ["sent", "school_viewed", "school_contacted"].includes(student.schoolSendStatus);
  const isContacted = (student) => student.schoolSendStatus === "school_contacted" || student.applicationSubmissionStage === "school_contacted";
  return [
    { label: "已保存选择", count: students.filter(isSaved).length },
    { label: "已提交申请", count: students.filter(isSubmitted).length },
    { label: "已完成支付", count: students.filter(isPaid).length },
    { label: "已发送学校", count: students.filter(isSent).length },
    { label: "学校已联系", count: students.filter(isContacted).length },
  ];
}

function buildOpsApplicationExceptionRows(students = []) {
  const rows = [
    {
      label: "已支付未发送",
      count: students.filter((student) => student.paymentState === "paid" && !["sent", "school_viewed", "school_contacted"].includes(student.schoolSendStatus)).length,
    },
    {
      label: "资料可用未支付",
      count: students.filter((student) => student.profileCompletionStatus === "complete" && student.paymentState !== "paid").length,
    },
    {
      label: "已发送未联系",
      count: students.filter((student) => ["sent", "school_viewed"].includes(student.schoolSendStatus)).length,
    },
    {
      label: "仍在草稿",
      count: students.filter((student) => ["drafting", "not_started"].includes(student.applicationSubmissionStage)).length,
    },
  ];
  return rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildOpsExamMaterialRiskStats(students = []) {
  const readyValues = ["complete", "ready", "score_ready", "not_required_yet", "not_applicable"];
  const examReadyValues = ["ready", "score_ready", "not_required_yet", "not_applicable"];
  const countNotReady = (key, readyList = readyValues) => students.filter((student) => !readyList.includes(String(student?.[key] || ""))).length;
  const countRisk = (label, key, readyList = readyValues) => ({ label, count: countNotReady(key, readyList) });
  const sendRiskRows = [
    countRisk("个人资料", "profileCompletionStatus"),
    countRisk("联系方式", "contactInfoStatus"),
    countRisk("护照", "passportStatus"),
    countRisk("教育经历", "educationHistoryStatus"),
    countRisk("成绩单", "transcriptStatus"),
    countRisk("毕业/在读证明", "degreeProofStatus"),
    countRisk("推荐信", "recommendationStatus"),
    countRisk("学习计划", "studyPlanStatus"),
    countRisk("翻译公证", "translationNotaryStatus"),
    countRisk("资金证明", "financialProofStatus", ["ready", "not_required_yet"]),
  ].filter((row) => row.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const examRiskRows = [
    countRisk("HSK", "hskStatus", examReadyValues),
    countRisk("CSCA", "cscaStatus", examReadyValues),
    countRisk("英文考试", "englishTestStatus", examReadyValues),
    countRisk("其他考试", "otherExamStatus", examReadyValues),
    countRisk("面试准备", "interviewReadiness", examReadyValues),
  ].filter((row) => row.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const sendReadyCount = students.filter((student) => (
    readyValues.includes(String(student.profileCompletionStatus || ""))
    && readyValues.includes(String(student.contactInfoStatus || ""))
    && readyValues.includes(String(student.passportStatus || ""))
    && readyValues.includes(String(student.educationHistoryStatus || ""))
    && readyValues.includes(String(student.transcriptStatus || ""))
    && readyValues.includes(String(student.studyPlanStatus || ""))
    && readyValues.includes(String(student.translationNotaryStatus || ""))
    && ["ready", "not_required_yet"].includes(String(student.financialProofStatus || ""))
  )).length;
  return {
    sendRiskRows,
    examRiskRows,
    sendReadyCount,
    sendRiskTotal: sendRiskRows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    examRiskTotal: examRiskRows.reduce((sum, row) => sum + Number(row.count || 0), 0),
  };
}

function opsReadyCount(rows = [], key) {
  return rows.filter((item) => ["complete", "ready", "score_ready", "not_required_yet", "not_applicable"].includes(String(item?.[key] || ""))).length;
}

function opsNeedsWorkCount(rows = [], key) {
  return rows.filter((item) => ["missing", "incomplete", "not_started", "preparing", "unknown", ""].includes(String(item?.[key] ?? ""))).length;
}

function opsAverageCompletion(rows = [], key) {
  const values = rows.map((item) => Number(item?.[key])).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function buildOpsStudentInsightStats(students = []) {
  const choices = students.flatMap((student) => toArray(student.choices).map((choice) => ({ ...choice, student })));
  const scholarshipCritical = students.filter((student) => ["required", "preferred"].includes(student.scholarshipNeed)).length;
  const financialProofReady = students.filter((student) => ["ready", "not_required_yet"].includes(student.financialProofStatus)).length;
  const sentCount = students.filter((student) => ["sent", "school_viewed", "school_contacted"].includes(student.schoolSendStatus)).length;
  const profileReady = opsReadyCount(students, "profileCompletionStatus");
  const hskNeedsWork = students.filter((student) => !["score_ready", "ready", "not_applicable"].includes(student.hskStatus)).length;
  const cscaNeedsWork = students.filter((student) => !["score_ready", "ready", "not_applicable", "not_required_yet"].includes(student.cscaStatus)).length;
  const examMaterialRiskStats = buildOpsExamMaterialRiskStats(students);
  return {
    total: students.length,
    choiceTotal: choices.length,
    countryRows: opsCountRows(students, (student) => student.country),
    cityRows: opsCountRows(choices, (choice) => choice.city),
    majorRows: opsCountRows(choices, (choice) => choice.major || choice.program),
    schoolRows: opsCountRows(choices, (choice) => choice.school),
    concernRows: opsCountRows(students, (student) => toArray(student.priorityFactors)),
    cityMajorRows: buildOpsPairRows(choices, (choice) => choice.city, (choice) => choice.major || choice.program),
    fundingMatrixRows: buildOpsPairRows(
      students,
      (student) => opsInsightLabel("budgetRange", student.budgetRange),
      (student) => opsInsightLabel("scholarshipNeed", student.scholarshipNeed),
    ),
    scholarshipNeedRows: opsCountRows(students, (student) => opsInsightLabel("scholarshipNeed", student.scholarshipNeed)),
    budgetRows: opsCountRows(students, (student) => opsInsightLabel("budgetRange", student.budgetRange)),
    languageRows: opsCountRows(students, (student) => opsInsightLabel("teachingLanguagePreference", student.teachingLanguagePreference)),
    choiceStageRows: opsCountRows(students, (student) => opsInsightLabel("choiceStage", student.choiceStage)),
    applicationStageRows: opsCountRows(students, (student) => opsInsightLabel("applicationSubmissionStage", student.applicationSubmissionStage)),
    paymentRows: opsCountRows(students, (student) => opsStudentPaymentStateLabel(student.paymentState)),
    sendRows: opsCountRows(students, (student) => opsInsightLabel("schoolSendStatus", student.schoolSendStatus)),
    hskRows: opsCountRows(students, (student) => opsInsightLabel("hskStatus", student.hskStatus)),
    cscaRows: opsCountRows(students, (student) => opsInsightLabel("cscaStatus", student.cscaStatus)),
    materialRows: opsCountRows(students, (student) => opsInsightLabel("profileCompletionStatus", student.profileCompletionStatus)),
    readinessBlockerRows: buildOpsReadinessBlockerRows(students),
    applicationGateRows: buildOpsApplicationGateRows(students),
    applicationExceptionRows: buildOpsApplicationExceptionRows(students),
    examMaterialRiskStats,
    scholarshipCritical,
    financialProofReady,
    profileReady,
    materialAverage: opsAverageCompletion(students, "documentChecklistCompletion"),
    materialNeedsWork: ["passportStatus", "educationHistoryStatus", "transcriptStatus", "studyPlanStatus", "translationNotaryStatus"].reduce((total, key) => total + opsNeedsWorkCount(students, key), 0),
    hskNeedsWork,
    cscaNeedsWork,
    sentCount,
  };
}

function buildOpsSchoolInsightStats(schools = [], students = []) {
  const activeSchools = schools.filter((school) => !opsLifecycleStatusArchived(school.status));
  const programs = activeSchools.flatMap((school) => toArray(school.programs).map((program) => ({ ...program, school })));
  const cityDemandRows = opsCountRows(students.flatMap((student) => toArray(student.choices)), (choice) => choice.city);
  const citySupplyRows = opsCountRows(activeSchools, (school) => school.cityZh || school.city || school.region || "待确认");
  const cityProgramSupplyRows = opsCountRows(programs, (program) => program.school?.cityZh || program.school?.city || program.city || program.school?.region || "待确认");
  const majorDemandRows = opsCountRows(students.flatMap((student) => toArray(student.choices)), (choice) => choice.major || choice.program);
  const majorSupplyRows = opsCountRows(programs, (program) => program.fieldCategory || program.displayGroupLabel || program.degreeLevel || "待确认");
  const englishProgramCount = programs.filter((program) => /english/i.test(String(program.teachingLanguage || program.language || program.languageOfInstruction || ""))).length;
  const cscaProgramCount = programs.filter((program) => toArray(program.cscaSubjects).length || program.cscaRequirement).length;
  const scholarshipProgramCount = programs.filter((program) => program.hasScholarship || program.scholarshipText).length;
  const missingDeadlineCount = programs.filter((program) => !program.deadlineDate && !program.deadlineLabel).length;
  const lowQualitySchools = activeSchools.filter((school) => !opsVerificationStatusVerified(school.verificationStatus) || Number(school.dataQualityScore || 0) < 90).length;
  return {
    schoolTotal: activeSchools.length,
    programTotal: programs.length,
    englishProgramCount,
    cscaProgramCount,
    scholarshipProgramCount,
    cityDemandRows,
    citySupplyRows,
    cityProgramSupplyRows,
    majorDemandRows,
    majorSupplyRows,
    lowQualitySchools,
    missingDeadlineCount,
    cscaRuleGaps: activeSchools.filter((school) => !toArray(school.cscaRules).length && String(school.cscaRequired || school.cscaRequirement || "").trim()).length,
    scholarshipGaps: activeSchools.filter((school) => !toArray(school.scholarshipsDetailed).length && /scholarship|奖学金|csc/i.test(String(school.scholarships || school.scholarshipText || ""))).length,
  };
}

function buildOpsOverviewFoundationStats(schools = [], students = []) {
  const activeSchools = schools.filter((school) => !opsLifecycleStatusArchived(school.status));
  const choices = students.flatMap((student) => toArray(student.choices).map((choice) => ({ ...choice, student })));
  const sentStatuses = ["sent", "school_viewed", "school_contacted"];
  const checklistStages = ["checklist", "application_set", "submitted"];
  const processedPattern = /学校已联系|已接收|已查看|已处理/;
  const sentPattern = /已发送|需首次联系|等待学校处理|已接收|学校已联系|已查看|已处理/;
  const registeredStudents = students.length;
  const profileCompleteStudents = students.filter((student) => student.profileCompletionStatus === "complete").length;
  const checklistStudents = students.filter((student) => checklistStages.includes(String(student.choiceStage || ""))).length;
  const paidStudents = students.filter((student) => student.paymentState === "paid").length;
  const sentStudents = students.filter((student) => sentStatuses.includes(String(student.schoolSendStatus || ""))).length;
  const paidAndSentStudents = students.filter((student) => student.paymentState === "paid" && sentStatuses.includes(String(student.schoolSendStatus || ""))).length;
  const schoolProcessedStudents = students.filter((student) => (
    student.schoolSendStatus === "school_contacted"
    || student.applicationSubmissionStage === "school_contacted"
    || toArray(student.choices).some((choice) => processedPattern.test(String(choice.tenantStatus || "")))
  )).length;
  const sentChoiceRecords = choices.filter((choice) => sentPattern.test(`${choice.sent || ""} ${choice.tenantStatus || ""}`)).length;
  const processedChoiceRecords = choices.filter((choice) => processedPattern.test(String(choice.tenantStatus || ""))).length;
  const schoolPendingRecords = Math.max(0, sentChoiceRecords - processedChoiceRecords);
  const processedChoices = choices.filter((choice) => processedPattern.test(String(choice.tenantStatus || "")));
  return {
    schoolTotal: schools.length,
    registeredStudents,
    countryCount: opsCountRows(students, (student) => student.country).length,
    selectedCityCount: opsCountRows(choices, (choice) => choice.city).length,
    selectedMajorCount: opsCountRows(choices, (choice) => choice.major || choice.program).length,
    activeSchools: activeSchools.length,
    programCount: activeSchools.reduce((total, school) => total + toArray(school.programs).length, 0),
    choiceCount: choices.length,
    profileCompleteStudents,
    checklistStudents,
    paidStudents,
    sentStudents,
    paidAndSentStudents,
    schoolProcessedStudents,
    sentChoiceRecords,
    processedChoiceRecords,
    schoolPendingRecords,
    processedSchoolCount: new Set(processedChoices.map((choice) => choice.school).filter(Boolean)).size,
    countryRows: opsCountRows(students, (student) => student.country),
    cityRows: opsCountRows(choices, (choice) => choice.city),
    majorRows: opsCountRows(choices, (choice) => choice.major || choice.program),
    concernRows: opsCountRows(students, (student) => toArray(student.priorityFactors)),
    budgetRows: opsCountRows(students, (student) => opsInsightLabel("budgetRange", student.budgetRange)),
    scholarshipNeedRows: opsCountRows(students, (student) => opsInsightLabel("scholarshipNeed", student.scholarshipNeed)),
    applicationStageRows: opsCountRows(students, (student) => opsInsightLabel("applicationSubmissionStage", student.applicationSubmissionStage)),
    profileRows: opsCountRows(students, (student) => opsInsightLabel("profileCompletionStatus", student.profileCompletionStatus)),
    paymentRows: opsCountRows(students, (student) => opsStudentPaymentStateLabel(student.paymentState)),
    sendRows: opsCountRows(students, (student) => opsInsightLabel("schoolSendStatus", student.schoolSendStatus)),
    schoolCityRows: opsCountRows(activeSchools, (school) => school.cityZh || school.city || school.region || "待确认"),
    schoolApplicationRows: opsCountRows(choices, (choice) => choice.tenantStatus || choice.sent || "待确认"),
  };
}

function buildOpsOverviewStats(schools, students, queueRows, auditItems, opsState) {
  const activeSchools = schools.filter((school) => !opsLifecycleStatusArchived(school.status));
  const programCount = schools.reduce((total, school) => total + toArray(school.programs).length, 0);
  const scholarshipCount = schools.reduce((total, school) => total + toArray(school.scholarshipsDetailed).length, 0);
  const cscaRuleCount = schools.reduce((total, school) => total + toArray(school.cscaRules).length, 0);
  const paidStudents = students.filter((student) => student.paymentState === "paid").length;
  const sentSchools = students.reduce((total, student) => total + Number(student.schoolsSent || 0), 0);
  const followUpCount = students.filter((student) => student.status !== "学校已联系").length;
  const queueHighCount = queueRows.filter((item) => item.priority === "高" && !["完成", "已处理"].includes(item.status)).length;
  const averageQuality = schools.length
    ? Math.round(schools.reduce((total, school) => total + Number(school.dataQualityScore || 0), 0) / schools.length)
    : 0;
  const sourceReviewCount = schools.filter((school) => !opsVerificationStatusVerified(school.verificationStatus) || Number(school.dataQualityScore || 0) < 90).length;
  const countries = students.reduce((map, student) => {
    const country = student.country || "未标注";
    map[country] = (map[country] || 0) + 1;
    return map;
  }, {});
  const countryRows = Object.entries(countries)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  const retryQueue = queueRows.find((item) => item.id === "retry-routing");
  const paymentQueue = queueRows.find((item) => item.id === "reconcile-payment");
  const auditQueue = queueRows.find((item) => item.id === "review-agent-audit");
  return {
    schoolCount: activeSchools.length,
    programCount,
    scholarshipCount,
    cscaRuleCount,
    studentCount: students.length,
    choiceCount: students.reduce((total, student) => total + toArray(student.choices).length, 0),
    paidStudents,
    sentSchools,
    followUpCount,
    queueCount: queueRows.length,
    queueHighCount,
    auditCount: auditItems.length,
    paymentRate: students.length ? Math.round((paidStudents / students.length) * 100) : 0,
    averageQuality,
    sourceReviewCount,
    countryRows,
    routingRetries: Number(opsState.routingRetries ?? countFromLabel(retryQueue?.count, 2)),
    retryCount: countFromLabel(retryQueue?.count, 0),
    paymentIssueCount: countFromLabel(paymentQueue?.count, 0),
    agentRejectCount: countFromLabel(auditQueue?.count, 0),
  };
}

function renderOpsBars(rows) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  return rows.slice(0, 4).map((row) => {
    const width = Math.max(18, Math.round((row.count / maxCount) * 100));
    return `<span style="--bar: ${width}%"><em>${escapeHtml(row.label)}</em><strong>${row.count}</strong></span>`;
  }).join("");
}

function renderOpsInsightRows(rows = [], limit = 4, emptyText = "待确认") {
  const visible = rows.slice(0, limit);
  if (!visible.length) return `<p class="ops-insight-empty">${escapeHtml(emptyText)}</p>`;
  return `<div class="ops-insight-row-list">${visible.map((row) => `<span><em>${escapeHtml(row.label)}</em><strong>${escapeHtml(String(row.count))}</strong></span>`).join("")}</div>`;
}

function renderOpsInsightMetric(label, value, copy = "") {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong>${copy ? `<small>${escapeHtml(copy)}</small>` : ""}</article>`;
}

const OPS_CHART_COLORS = ["#007d76", "#2a7cb5", "#a76600", "#6f5a9a", "#a33a32", "#5f7f43"];

function renderOpsDonutChart(rows = [], centerValue = "", centerLabel = "") {
  const visible = rows.slice(0, 5).filter((row) => Number(row.count) > 0);
  const total = visible.reduce((sum, row) => sum + Number(row.count || 0), 0) || 1;
  let offset = 0;
  const segments = visible.map((row, index) => {
    const value = Number(row.count || 0);
    const dash = Math.max(0, (value / total) * 226.2);
    const segment = `<circle class="ops-donut-segment" cx="50" cy="50" r="36" pathLength="226.2" style="--dash:${dash.toFixed(2)}; --offset:${(-offset).toFixed(2)}; --color:${OPS_CHART_COLORS[index % OPS_CHART_COLORS.length]}" tabindex="0"><title>${escapeHtml(row.label)} · ${escapeHtml(String(value))}</title></circle>`;
    offset += dash;
    return segment;
  }).join("");
  return `
    <div class="ops-chart-donut" role="img" aria-label="${escapeHtml(centerLabel)} 分布">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ops-donut-track" cx="50" cy="50" r="36"></circle>
        ${segments}
      </svg>
      <div class="ops-donut-center"><strong>${escapeHtml(String(centerValue))}</strong><span>${escapeHtml(centerLabel)}</span></div>
      <div class="ops-chart-legend">
        ${visible.map((row, index) => `<span><i style="--color:${OPS_CHART_COLORS[index % OPS_CHART_COLORS.length]}"></i>${escapeHtml(row.label)} <b>${escapeHtml(String(row.count))}</b></span>`).join("")}
      </div>
    </div>
  `;
}

function renderOpsStackedChart(rows = [], label = "") {
  const visible = rows.slice(0, 5).filter((row) => Number(row.count) > 0);
  const total = visible.reduce((sum, row) => sum + Number(row.count || 0), 0) || 1;
  return `
    <div class="ops-stacked-chart" aria-label="${escapeHtml(label)}">
      <div class="ops-stacked-bar">
        ${visible.map((row, index) => {
          const width = Math.max(8, Math.round((Number(row.count || 0) / total) * 100));
          return `<span style="--w:${width}%; --color:${OPS_CHART_COLORS[index % OPS_CHART_COLORS.length]}" title="${escapeHtml(row.label)} · ${escapeHtml(String(row.count))}"></span>`;
        }).join("")}
      </div>
      <div class="ops-chart-legend compact">
        ${visible.map((row, index) => `<span><i style="--color:${OPS_CHART_COLORS[index % OPS_CHART_COLORS.length]}"></i>${escapeHtml(row.label)} <b>${escapeHtml(String(row.count))}</b></span>`).join("")}
      </div>
    </div>
  `;
}

function renderOpsBubbleChart(rows = [], label = "", limit = 6) {
  const visible = rows.slice(0, limit).filter((row) => Number(row.count) > 0);
  const max = Math.max(1, ...visible.map((row) => Number(row.count || 0)));
  if (!visible.length) return `<p class="ops-insight-empty">待确认</p>`;
  return `
    <div class="ops-bubble-chart" aria-label="${escapeHtml(label)}">
      ${visible.map((row, index) => {
        const size = 46 + Math.round((Number(row.count || 0) / max) * 28);
        return `<span style="--size:${size}px; --color:${OPS_CHART_COLORS[index % OPS_CHART_COLORS.length]}" title="${escapeHtml(row.label)} · ${escapeHtml(String(row.count))}" tabindex="0"><strong>${escapeHtml(String(row.count))}</strong><em>${escapeHtml(row.label)}</em></span>`;
      }).join("")}
    </div>
  `;
}

function renderOpsFunnelChart(rows = [], label = "") {
  const visible = rows.filter((row) => Number(row.count) > 0);
  const max = Math.max(1, ...visible.map((row) => Number(row.count || 0)));
  return `
    <div class="ops-funnel-chart" aria-label="${escapeHtml(label)}">
      ${visible.map((row, index) => {
        const width = Math.max(38, Math.round((Number(row.count || 0) / max) * 100));
        return `<span style="--w:${width}%; --color:${OPS_CHART_COLORS[index % OPS_CHART_COLORS.length]}" title="${escapeHtml(row.label)} · ${escapeHtml(String(row.count))}"><em>${escapeHtml(row.label)}</em><strong>${escapeHtml(String(row.count))}</strong></span>`;
      }).join("")}
    </div>
  `;
}

function renderOpsReadinessMatrix(items = []) {
  return `
    <div class="ops-readiness-matrix" aria-label="准备度矩阵">
      ${items.map((item) => {
        const score = Number(item.score || 0);
        const tone = score >= 75 ? "good" : score >= 45 ? "warn" : "danger";
        return `<article class="${tone}" style="--score:${score}%"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(score))}%</strong><small>${escapeHtml(item.copy || "")}</small></article>`;
      }).join("")}
    </div>
  `;
}

function renderOpsCompareBars(leftRows = [], rightRows = [], labels = ["需求", "供给"]) {
  const rowMap = new Map();
  leftRows.slice(0, 5).forEach((row) => rowMap.set(row.label, { label: row.label, left: row.count, right: 0 }));
  rightRows.slice(0, 5).forEach((row) => {
    const current = rowMap.get(row.label) || { label: row.label, left: 0, right: 0 };
    current.right = row.count;
    rowMap.set(row.label, current);
  });
  const rows = [...rowMap.values()].slice(0, 6);
  const max = Math.max(1, ...rows.flatMap((row) => [Number(row.left || 0), Number(row.right || 0)]));
  return `
    <div class="ops-compare-chart" aria-label="${escapeHtml(labels.join("与"))}">
      ${rows.map((row) => `
        <article>
          <strong>${escapeHtml(row.label)}</strong>
          <div><span style="--w:${Math.max(4, Math.round((Number(row.left || 0) / max) * 100))}%"><em>${escapeHtml(labels[0])}</em><b>${escapeHtml(String(row.left || 0))}</b></span></div>
          <div><span class="supply" style="--w:${Math.max(4, Math.round((Number(row.right || 0) / max) * 100))}%"><em>${escapeHtml(labels[1])}</em><b>${escapeHtml(String(row.right || 0))}</b></span></div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOpsStudentDemandInsights(insights) {
  const topCity = opsTopLabel(insights.cityRows);
  const topMajor = opsTopLabel(insights.majorRows);
  const topConcern = opsTopLabel(insights.concernRows);
  return `
    <article class="ops-insight-card tone-demand">
      <div class="ops-insight-head">
        <div><span class="module-kicker">学生需求</span><h2>学生在选什么</h2></div>
        <strong>${escapeHtml(topCity)} · ${escapeHtml(topMajor)}</strong>
      </div>
      <p>${escapeHtml(`${insights.scholarshipCritical} 个学生明确依赖或偏好奖学金；当前最常出现的关注点是 ${topConcern}。`)}</p>
      <div class="ops-insight-visual-grid demand">
        <section class="ops-chart-panel large">
          <div><h3>奖学金需求结构</h3><small>必须、偏好、可有可无</small></div>
          ${renderOpsDonutChart(insights.scholarshipNeedRows, insights.scholarshipCritical, "奖学金敏感")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>预算范围</h3><small>经济情况汇总</small></div>
          ${renderOpsStackedChart(insights.budgetRows, "预算范围")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>城市热度</h3><small>选择越多气泡越大</small></div>
          ${renderOpsBubbleChart(insights.cityRows, "城市热度")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>专业方向</h3><small>项目选择分布</small></div>
          ${renderOpsFunnelChart(insights.majorRows, "专业方向")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>关注点</h3><small>学生真正关心什么</small></div>
          ${renderOpsBubbleChart(insights.concernRows, "关注点", 5)}
        </section>
      </div>
    </article>
  `;
}

function renderOpsStudentReadinessInsights(insights) {
  const total = Math.max(1, insights.total);
  const readinessItems = [
    { label: "资料", score: Math.round((insights.profileReady / total) * 100), copy: `${insights.profileReady}/${insights.total} 可用` },
    { label: "资金", score: Math.round((insights.financialProofReady / total) * 100), copy: "资金证明" },
    { label: "HSK", score: Math.round(((insights.total - insights.hskNeedsWork) / total) * 100), copy: "语言准备" },
    { label: "CSCA", score: Math.round(((insights.total - insights.cscaNeedsWork) / total) * 100), copy: "考试准备" },
  ];
  return `
    <article class="ops-insight-card tone-readiness">
      <div class="ops-insight-head">
        <div><span class="module-kicker">学生准备</span><h2>学生卡在哪里</h2></div>
        <strong>${escapeHtml(String(insights.materialAverage))}% 材料均值</strong>
      </div>
      <p>${escapeHtml(`${insights.profileReady} 个学生资料基本可用；${insights.hskNeedsWork} 个 HSK 状态待推进，${insights.cscaNeedsWork} 个 CSCA 状态待确认或准备中。`)}</p>
      <div class="ops-insight-visual-grid readiness">
        <section class="ops-chart-panel">
          <div><h3>准备度矩阵</h3><small>资料、资金、考试一眼看</small></div>
          ${renderOpsReadinessMatrix(readinessItems)}
        </section>
        <section class="ops-chart-panel">
          <div><h3>选择到发送漏斗</h3><small>从 checklist 到学校可见</small></div>
          ${renderOpsFunnelChart([...insights.choiceStageRows, ...insights.sendRows], "选择到发送漏斗")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>申请阶段</h3><small>当前处理位置</small></div>
          ${renderOpsStackedChart(insights.applicationStageRows, "申请阶段")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>支付情况</h3><small>发送前门禁</small></div>
          ${renderOpsDonutChart(insights.paymentRows, insights.sentCount, "已发送学生")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>HSK / CSCA</h3><small>考试准备状态</small></div>
          ${renderOpsStackedChart([...insights.hskRows, ...insights.cscaRows], "HSK 与 CSCA 准备")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>资料状态</h3><small>个人资料与材料</small></div>
          ${renderOpsStackedChart(insights.materialRows, "资料状态")}
        </section>
      </div>
    </article>
  `;
}

function renderOpsSchoolOperationsInsights(insights) {
  const demandCity = opsTopLabel(insights.cityDemandRows);
  const supplyCity = opsTopLabel(insights.citySupplyRows);
  const demandMajor = opsTopLabel(insights.majorDemandRows);
  return `
    <article class="ops-insight-card tone-supply">
      <div class="ops-insight-head">
        <div><span class="module-kicker">学校运营</span><h2>供给能不能接住需求</h2></div>
        <strong>${escapeHtml(insights.schoolTotal)} 所 · ${escapeHtml(insights.programTotal)} 项目</strong>
      </div>
      <p>${escapeHtml(`学生热门城市是 ${demandCity}，当前学校供给首位是 ${supplyCity}；热门方向 ${demandMajor} 需要持续核对项目、奖学金和考试规则。`)}</p>
      <div class="ops-insight-visual-grid supply">
        <section class="ops-chart-panel large">
          <div><h3>城市供需对比</h3><small>学生需求 vs 学校供给</small></div>
          ${renderOpsCompareBars(insights.cityDemandRows, insights.citySupplyRows, ["需求", "供给"])}
        </section>
        <section class="ops-chart-panel">
          <div><h3>供给结构</h3><small>英文、CSCA、奖学金</small></div>
          ${renderOpsDonutChart([
            { label: "英文项目", count: insights.englishProgramCount },
            { label: "CSCA 项目", count: insights.cscaProgramCount },
            { label: "奖学金项目", count: insights.scholarshipProgramCount },
          ], insights.programTotal, "项目总量")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>专业需求</h3><small>热门方向</small></div>
          ${renderOpsBubbleChart(insights.majorDemandRows, "专业需求")}
        </section>
        <section class="ops-chart-panel">
          <div><h3>数据缺口</h3><small>目录质量待处理</small></div>
          ${renderOpsFunnelChart([
          { label: "学校来源/质量复核", count: insights.lowQualitySchools },
          { label: "截止时间缺失", count: insights.missingDeadlineCount },
          { label: "CSCA 规则缺口", count: insights.cscaRuleGaps },
          { label: "奖学金规则缺口", count: insights.scholarshipGaps },
        ], "数据缺口")}
        </section>
      </div>
    </article>
  `;
}

function renderOpsOverviewAnalytics(studentInsights, schoolInsights) {
  const total = Math.max(1, studentInsights.total);
  const sampleLabel = `样本 ${studentInsights.total} 学生 · ${studentInsights.choiceTotal} 选择`;
  const readinessItems = [
    { label: "资料", score: Math.round((studentInsights.profileReady / total) * 100), copy: `${studentInsights.profileReady}/${studentInsights.total} 可用` },
    { label: "资金", score: Math.round((studentInsights.financialProofReady / total) * 100), copy: "资金证明" },
    { label: "HSK", score: Math.round(((studentInsights.total - studentInsights.hskNeedsWork) / total) * 100), copy: "语言准备" },
    { label: "CSCA", score: Math.round(((studentInsights.total - studentInsights.cscaNeedsWork) / total) * 100), copy: "考试准备" },
  ];
  const cityMismatchRows = buildOpsCityMismatchRows(schoolInsights.cityDemandRows, schoolInsights.cityProgramSupplyRows);
  const cityMismatchCount = cityMismatchRows.filter((row) => row.gap > 0).length;
  const ruleGapRows = [
    { label: "学校质量复核", count: schoolInsights.lowQualitySchools },
    { label: "截止日期缺失", count: schoolInsights.missingDeadlineCount },
    { label: "CSCA 规则缺口", count: schoolInsights.cscaRuleGaps },
    { label: "奖学金规则缺口", count: schoolInsights.scholarshipGaps },
  ];
  const paidCount = opsRowCount(studentInsights.paymentRows, "已支付");
  const blockedCount = Math.max(0, studentInsights.total - studentInsights.sentCount);
  const insightCards = [
    {
      kicker: "需求判断",
      value: `${opsPercent(studentInsights.scholarshipCritical, studentInsights.total)}%`,
      label: "奖学金敏感",
      body: `${opsTopLabel(studentInsights.cityRows)}、${opsTopLabel(studentInsights.majorRows)} 是当前选择重心，预算与奖学金需要提前进入匹配。`,
      meta: sampleLabel,
      tone: "tone-demand",
    },
    {
      kicker: "准备卡点",
      value: `${studentInsights.materialAverage}%`,
      label: "材料均值",
      body: `${studentInsights.hskNeedsWork + studentInsights.cscaNeedsWork} 个考试状态待推进，${studentInsights.total - studentInsights.financialProofReady} 个资金证明未就绪。`,
      meta: sampleLabel,
      tone: "tone-readiness",
    },
    {
      kicker: "申请门禁",
      value: `${studentInsights.sentCount}/${studentInsights.total}`,
      label: "学生已发送",
      body: `${paidCount} 个已支付，${blockedCount} 个仍卡在选择、材料、支付或学校发送链路。`,
      meta: "按学生链路计数",
      tone: "tone-readiness",
    },
    {
      kicker: "学校匹配",
      value: `${cityMismatchCount}`,
      label: "项目城市缺口",
      body: `${ruleGapRows.reduce((sum, row) => sum + Number(row.count || 0), 0)} 个学校数据/规则缺口会影响推荐可信度。`,
      meta: `${schoolInsights.programTotal} 项目供给口径`,
      tone: "tone-supply",
    },
  ];
  const chartData = {
    funding: {
      scholarshipNeedRows: studentInsights.scholarshipNeedRows,
      budgetRows: studentInsights.budgetRows,
      fundingMatrixRows: studentInsights.fundingMatrixRows,
      scholarshipCritical: studentInsights.scholarshipCritical,
    },
    choice: {
      cityRows: studentInsights.cityRows,
      majorRows: studentInsights.majorRows,
      concernRows: studentInsights.concernRows,
      cityMajorRows: studentInsights.cityMajorRows,
    },
    readiness: {
      readinessItems,
      blockerRows: studentInsights.readinessBlockerRows,
      materialAverage: studentInsights.materialAverage,
    },
    application: {
      choiceStageRows: studentInsights.choiceStageRows,
      sendRows: studentInsights.sendRows,
      paymentRows: studentInsights.paymentRows,
      gateRows: studentInsights.applicationGateRows,
      exceptionRows: studentInsights.applicationExceptionRows,
      sentCount: studentInsights.sentCount,
    },
    exams: {
      hskRows: studentInsights.hskRows,
      cscaRows: studentInsights.cscaRows,
      materialRows: studentInsights.materialRows,
      sendRiskRows: studentInsights.examMaterialRiskStats.sendRiskRows,
      examRiskRows: studentInsights.examMaterialRiskStats.examRiskRows,
      sendReadyCount: studentInsights.examMaterialRiskStats.sendReadyCount,
      sendRiskTotal: studentInsights.examMaterialRiskStats.sendRiskTotal,
      examRiskTotal: studentInsights.examMaterialRiskStats.examRiskTotal,
      hskNeedsWork: studentInsights.hskNeedsWork,
      cscaNeedsWork: studentInsights.cscaNeedsWork,
    },
    supply: {
      cityDemandRows: schoolInsights.cityDemandRows,
      citySupplyRows: schoolInsights.citySupplyRows,
      schoolTotal: schoolInsights.schoolTotal,
      programTotal: schoolInsights.programTotal,
      englishProgramCount: schoolInsights.englishProgramCount,
      cscaProgramCount: schoolInsights.cscaProgramCount,
      scholarshipProgramCount: schoolInsights.scholarshipProgramCount,
      cityProgramSupplyRows: schoolInsights.cityProgramSupplyRows,
      lowQualitySchools: schoolInsights.lowQualitySchools,
      missingDeadlineCount: schoolInsights.missingDeadlineCount,
      cscaRuleGaps: schoolInsights.cscaRuleGaps,
      scholarshipGaps: schoolInsights.scholarshipGaps,
      cityMismatchRows,
      ruleGapRows,
    },
  };
  const studentTiles = [
    ["choice", "选择路径", "城市→专业路径与关注点", opsTopLabel(studentInsights.cityRows), "tone-demand", "span-7"],
    ["funding", "经济与奖学金", "预算 × 奖学金需求矩阵", `${studentInsights.scholarshipCritical} 敏感`, "tone-demand", "span-5"],
    ["readiness", "准备与阻塞", "准备度 + 阻塞原因排行", `${studentInsights.readinessBlockerRows.length} 类阻塞`, "tone-readiness", "span-5"],
    ["application", "申请门禁链路", "保存、提交、支付、发送、联系", `${studentInsights.sentCount} 已发送`, "tone-readiness", "span-7"],
    ["exams", "资料与考试风险", "可发送风险 / 考试准备风险", `${studentInsights.examMaterialRiskStats.sendRiskTotal + studentInsights.examMaterialRiskStats.examRiskTotal} 风险点`, "tone-readiness", "span-12 compact"],
  ];
  const schoolTiles = [
    ["supply", "学校供需与缺口", "学生城市需求 vs 项目城市供给", `${schoolInsights.programTotal} 个项目`, "tone-supply", "span-12 school"],
  ];
  const renderTiles = (tiles) => tiles.map(([id, title, subtitle, badge, tone, size]) => `
    <article class="ops-echart-card ${escapeHtml(tone)} ${escapeHtml(size)}">
      <div class="ops-analytics-tile-head">
        <div><h3>${escapeHtml(title)}</h3><small>${escapeHtml(subtitle)}</small></div>
        <strong>${escapeHtml(badge)}</strong>
      </div>
      <div class="ops-echart-frame" data-ops-echart="${escapeHtml(id)}" role="img" aria-label="${escapeHtml(title)} 图表">
        <p>正在加载 ECharts 图表...</p>
      </div>
    </article>
  `).join("");
  return `
    <section class="ops-overview-section ops-analytics-board">
      <div class="section-head full">
        <div>
          <span class="module-kicker">交叉分析</span>
          <h2>进一步看选择、准备和学校供给之间的关系</h2>
          <p>基础盘回答“有多少、分布在哪”；这里看预算与奖学金、城市与专业、准备度与发送、需求与供给之间的组合关系。</p>
        </div>
      </div>
      <div class="ops-analytics-summary-grid">
        ${insightCards.map((card) => `
          <article class="ops-analytics-brief ${escapeHtml(card.tone)}">
            <span>${escapeHtml(card.kicker)}</span>
            <div><strong>${escapeHtml(card.value)}</strong><em>${escapeHtml(card.label)}</em></div>
            <p>${escapeHtml(card.body)}</p>
            <small>${escapeHtml(card.meta)}</small>
          </article>
        `).join("")}
      </div>
      <div class="ops-analytics-group">
        <div class="ops-analytics-group-head">
          <div><span class="module-kicker">学生交叉分析</span><h3>学生要什么、卡在哪、能否送达学校</h3></div>
          <strong>${escapeHtml(studentInsights.choiceTotal)} 个选择 · ${escapeHtml(studentInsights.total)} 个学生</strong>
        </div>
        <div class="ops-analytics-board-grid">${renderTiles(studentTiles)}</div>
      </div>
      <div class="ops-analytics-group">
        <div class="ops-analytics-group-head">
          <div><span class="module-kicker">学校供给</span><h3>再看学校供给是否接得住学生需求</h3></div>
          <strong>${escapeHtml(String(schoolInsights.programTotal))} 个项目 · ${escapeHtml(String(ruleGapRows.reduce((sum, row) => sum + Number(row.count || 0), 0)))} 个缺口</strong>
        </div>
        <div class="ops-analytics-board-grid">${renderTiles(schoolTiles)}</div>
      </div>
      <script type="application/json" data-ops-chart-data>${opsSafeJson(chartData)}</script>
    </section>
  `;
}

function renderOpsRiskGrid(stats) {
  return `
    <div class="ops-risk-grid">
      <article><strong>${stats.routingRetries}</strong><span>发送重试待确认</span></article>
      <article><strong>${stats.paymentIssueCount}</strong><span>支付状态需对账</span></article>
      <article><strong>${stats.agentRejectCount}</strong><span>Agent 操作被策略拒绝</span></article>
    </div>
  `;
}

function renderOpsOverviewCoreMetrics(stats, accessRows) {
  const coreItems = [
    { label: "注册学生", value: stats.studentCount, copy: `${stats.countryRows.length} 个国家/地区` },
    { label: "学校数据", value: stats.schoolCount, copy: `${stats.programCount} 个项目` },
    { label: "学生选择", value: stats.choiceCount, copy: "学校/项目选择记录" },
    { label: "已支付学生", value: stats.paidStudents, copy: `${stats.paymentRate}% 支付通过` },
  ];
  return `
    <section class="ops-admin-metrics ops-overview-core-metrics reveal" aria-label="平台基础统计">
      ${coreItems.map((item) => `
        <article>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(String(item.value))}</strong>
          <small>${escapeHtml(item.copy)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOpsFoundationBars(title, subtitle, rows = [], limit = 4) {
  return `
    <section>
      <div><h3>${escapeHtml(title)}</h3><small>${escapeHtml(subtitle)}</small></div>
      ${renderOpsBars(rows.slice(0, limit))}
    </section>
  `;
}

function renderOpsOverviewFoundation(stats) {
  const total = Math.max(1, Number(stats.registeredStudents || 0));
  const storyCards = [
    {
      kicker: "学生画像",
      value: `${stats.countryCount} 国家/地区`,
      copy: `注册学生共 ${stats.registeredStudents} 人，来源首位是 ${opsTopLabel(stats.countryRows)}。`,
      tone: "source",
    },
    {
      kicker: "选择热点",
      value: `${opsTopLabel(stats.cityRows)} · ${opsTopLabel(stats.majorRows)}`,
      copy: `${stats.choiceCount} 个选择覆盖 ${stats.selectedCityCount} 个城市、${stats.selectedMajorCount} 个方向。`,
      tone: "choice",
    },
    {
      kicker: "经济约束",
      value: opsTopLabel(stats.scholarshipNeedRows),
      copy: `预算集中在 ${opsTopLabel(stats.budgetRows)}，奖学金和成本偏好需要优先匹配。`,
      tone: "finance",
    },
    {
      kicker: "学校承接",
      value: `${stats.processedChoiceRecords}/${stats.sentChoiceRecords} 记录处理`,
      copy: `${stats.processedSchoolCount} 所学校已有处理，仍有 ${stats.schoolPendingRecords} 条学校记录待推进。`,
      tone: "handoff",
    },
  ];
  const funnelSteps = [
    { label: "注册学生", value: stats.registeredStudents, copy: "进入系统" },
    { label: "资料完成", value: stats.profileCompleteStudents, copy: "可用于申请" },
    { label: "进 checklist", value: stats.checklistStudents, copy: "有明确选择" },
    { label: "已支付", value: stats.paidStudents, copy: "支付通过" },
    { label: "付费并发送", value: stats.paidAndSentStudents, copy: "学校可见" },
    { label: "学校处理", value: stats.schoolProcessedStudents, copy: `${stats.schoolPendingRecords} 条待处理记录` },
  ];
  return `
    <section class="ops-overview-section ops-foundation-board reveal" aria-label="运营基础盘">
      <div class="section-head full">
        <div>
          <span class="module-kicker">数据基础盘</span>
          <h2>先看平台现在有哪些学生、学校和申请</h2>
          <p>把学生来源、选择偏好、经济需求、资料进度和学校承接放在第一页，先建立运营基本盘，再看风险和待办。</p>
        </div>
        <strong class="ops-foundation-count">${escapeHtml(String(stats.countryCount))} 国家/地区 · ${escapeHtml(String(stats.choiceCount))} 个选择</strong>
      </div>
      <div class="ops-foundation-story-grid">
        ${storyCards.map((card) => `
          <article class="tone-${escapeHtml(card.tone)}">
            <span>${escapeHtml(card.kicker)}</span>
            <strong>${escapeHtml(String(card.value))}</strong>
            <small>${escapeHtml(card.copy)}</small>
          </article>
        `).join("")}
      </div>
      <div class="ops-foundation-distribution-grid">
        <article class="span-6">
          <div class="ops-foundation-panel-head">
            <div><span class="module-kicker">学生来源</span><h3>注册学生来自哪里</h3></div>
            <strong>${escapeHtml(String(stats.registeredStudents))} 人 · ${escapeHtml(String(stats.countryCount))} 国家/地区</strong>
          </div>
          <div class="ops-foundation-panel-body two">
            ${renderOpsFoundationBars("国家/地区", "按注册学生计数", stats.countryRows, 5)}
            ${renderOpsFoundationBars("关注点", "学生关心什么", stats.concernRows, 5)}
          </div>
        </article>
        <article class="span-6">
          <div class="ops-foundation-panel-head">
            <div><span class="module-kicker">选择分析</span><h3>学生正在选择什么</h3></div>
            <strong>${escapeHtml(String(stats.choiceCount))} 个选择</strong>
          </div>
          <div class="ops-foundation-panel-body two">
            ${renderOpsFoundationBars("城市选择", `${stats.selectedCityCount} 个城市`, stats.cityRows, 5)}
            ${renderOpsFoundationBars("专业方向", `${stats.selectedMajorCount} 个方向`, stats.majorRows, 5)}
          </div>
        </article>
        <article class="span-6">
          <div class="ops-foundation-panel-head">
            <div><span class="module-kicker">经济与准备</span><h3>学生申请前的关键约束</h3></div>
            <strong>${escapeHtml(String(stats.profileCompleteStudents))}/${escapeHtml(String(stats.registeredStudents))} 资料完成</strong>
          </div>
          <div class="ops-foundation-panel-body two">
            ${renderOpsFoundationBars("预算范围", "经济情况汇总", stats.budgetRows, 4)}
            ${renderOpsFoundationBars("奖学金需求", "资助敏感度", stats.scholarshipNeedRows, 4)}
          </div>
        </article>
        <article class="span-6">
          <div class="ops-foundation-panel-head">
            <div><span class="module-kicker">申请与学校</span><h3>申请走到哪一步、学校处理了多少</h3></div>
            <strong>${escapeHtml(String(stats.processedChoiceRecords))}/${escapeHtml(String(stats.sentChoiceRecords))} 学校记录处理</strong>
          </div>
          <div class="ops-foundation-panel-body two">
            ${renderOpsFoundationBars("申请阶段", "按学生计数", stats.applicationStageRows, 5)}
            ${renderOpsFoundationBars("学校处理状态", `${stats.processedSchoolCount} 所学校已有处理`, stats.schoolApplicationRows, 5)}
          </div>
        </article>
      </div>
      <div class="ops-foundation-flow-head">
        <div><span class="module-kicker">链路速览</span><h3>从注册到学校处理</h3></div>
        <strong>${escapeHtml(String(stats.paidAndSentStudents))} 人付费并发送 · ${escapeHtml(String(stats.schoolProcessedStudents))} 人到学校处理</strong>
      </div>
      <div class="ops-foundation-funnel compact" aria-label="学生申请基础转化链路">
        ${funnelSteps.map((step, index) => {
          const percent = opsPercent(step.value, total);
          const width = Math.max(5, percent);
          return `
            <article style="--step-width:${width}%">
              <div><span>${escapeHtml(String(index + 1))}</span><strong>${escapeHtml(String(step.value))}</strong></div>
              <em>${escapeHtml(step.label)}</em>
              <small>${escapeHtml(step.copy)} · ${escapeHtml(String(percent))}%</small>
              <i aria-hidden="true"></i>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderOpsOverviewPriorityList(stats, accessRows) {
  const pendingAccess = accessRows.filter((item) => item.grantStatus === "pending-review").length;
  const items = [
    {
      label: "支付后发送",
      value: stats.routingRetries,
      copy: "已付款未发送，影响学校可见。",
      section: "queue",
      action: "处理",
      tone: "blocker",
    },
    {
      label: "学生待跟进",
      value: stats.followUpCount,
      copy: "资料、联系或重发通知待推进。",
      section: "students",
      action: "查看",
      tone: "followup",
    },
    {
      label: "学校数据复核",
      value: stats.sourceReviewCount,
      copy: "截止日期、来源或字段映射需确认。",
      section: "school",
      action: "复核",
      tone: "review",
    },
    {
      label: "账号待审批",
      value: pendingAccess,
      copy: "学校老师、运营角色或 Agent 权限待审。",
      section: "access",
      action: "审批",
      tone: "access",
    },
  ];
  return `
    <div class="ops-task-card-grid">
      ${items.map((item) => `
        <article class="ops-task-card tone-${escapeHtml(item.tone)}">
          <div class="ops-task-card-head">
            <strong>${escapeHtml(String(item.value))}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
          <p>${escapeHtml(item.copy)}</p>
          <button class="secondary-action micro" data-ops-tab="${escapeHtml(item.section)}" type="button">${escapeHtml(item.action)}</button>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOpsOverviewHealthGrid(stats, accessRows, agentOps) {
  const pendingAccess = accessRows.filter((item) => item.grantStatus === "pending-review").length;
  const healthRows = [
    ["目录质量", `${stats.averageQuality}%`, `${stats.sourceReviewCount} 所学校需复核`, stats.sourceReviewCount ? "review" : "good"],
    ["支付通过", `${stats.paymentRate}%`, `${stats.paidStudents} 个学生已支付`, stats.paymentRate < 80 ? "warn" : "good"],
    ["租户权限", `${accessRows.length}`, `${pendingAccess} 个账号待审批`, pendingAccess ? "access" : "good"],
    ["Agent 就绪", `${agentOps.readinessScore}`, agentOps.rolloutPaused ? "放量已暂停" : "申请辅助免费开放", agentOps.rolloutPaused ? "danger" : "agent"],
  ];
  return `
    <div class="ops-health-card-grid">
      ${healthRows.map(([label, value, copy, tone]) => `
        <article class="ops-health-card ${escapeHtml(tone)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(copy)}</small></article>
      `).join("")}
    </div>
  `;
}

function renderOpsOverviewModuleCards({ overviewStats, cityRows, publicScholarshipRows, timelineRows, accessRows }) {
  const modules = [
    {
      title: "学校数据",
      meta: `${overviewStats.schoolCount} 所学校 · ${overviewStats.programCount} 个项目`,
      tags: ["学校档案", "项目", "奖学金", "来源"],
      section: "school",
      tone: "school",
    },
    {
      title: "内容数据",
      meta: `${cityRows.length + publicScholarshipRows.length + timelineRows.length} 条内容记录`,
      tags: ["城市", "公共奖学金", "时间窗"],
      section: "content",
      tone: "content",
    },
    {
      title: "学生申请",
      meta: `${overviewStats.studentCount} 人 · ${overviewStats.followUpCount} 待跟进`,
      tags: ["资料", "支付", "发送", "跟进"],
      section: "students",
      tone: "students",
    },
    {
      title: "账号权限",
      meta: `${accessRows.length} 个账号 · ${accessRows.filter((item) => item.grantStatus === "pending-review").length} 待审批`,
      tags: ["角色", "租户", "Agent", "审计"],
      section: "access",
      tone: "access",
    },
    {
      title: "队列与审计",
      meta: `${overviewStats.queueHighCount} 个高优先级 · ${overviewStats.auditCount} 条审计`,
      tags: ["重试", "支持", "拒绝", "导出"],
      section: "queue",
      tone: "queue",
    },
  ];
  return `
    <section class="ops-module-list" aria-label="管理模块">
      <div class="section-head full"><div><span class="module-kicker">管理模块</span><h2>进入具体工作台</h2></div></div>
      ${modules.map((item) => `
        <article class="ops-module-card tone-${escapeHtml(item.tone)}">
          <div>
            <h2>${escapeHtml(item.title)}</h2>
            <strong>${escapeHtml(item.meta)}</strong>
          </div>
          <div class="ops-module-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          <button class="secondary-action micro" data-ops-tab="${escapeHtml(item.section)}" type="button">进入</button>
        </article>
      `).join("")}
    </section>
  `;
}

function readOpsAgentOpsState(state = readOpsAdminState()) {
  const stored = isPlainRecord(state.agentOps) ? state.agentOps : {};
  const rolloutPaused = Boolean(stored.rolloutPaused);
  return {
    provider: stored.provider || "OpenAI-compatible gateway",
    model: stored.model || "gpt-5-mini",
    gatewayHealth: stored.gatewayHealth || "healthy",
    successRate: Number(stored.successRate ?? 97),
    calls: Number(stored.calls ?? 1840),
    totalTokens: Number(stored.totalTokens ?? 1264000),
    estimatedCostUsd: Number(stored.estimatedCostUsd ?? 42),
    averageLatencyMs: Number(stored.averageLatencyMs ?? 860),
    rolloutPercent: rolloutPaused ? 0 : Number(stored.rolloutPercent ?? 35),
    rolloutPaused,
    queuedJobs: Number(stored.queuedJobs ?? 12),
    runningJobs: Number(stored.runningJobs ?? 2),
    failedJobs: Number(stored.failedJobs ?? 3),
    staleJobs: Number(stored.staleJobs ?? 1),
    readinessStatus: stored.readinessStatus || "needs_attention",
    readinessScore: Number(stored.readinessScore ?? 78),
    nextAction: stored.nextAction || "先复核 Agent 拒绝导出和低评分回答，再扩大放量",
    blockers: toArray(stored.blockers).length ? toArray(stored.blockers) : ["跨租户导出拒绝需复核", "学校端批量操作仍需二次确认"],
    lastOperation: stored.lastOperation || "等待刷新",
    updatedAt: stored.updatedAt || "2026-08-20T10:00:00.000Z",
  };
}

function opsAgentGatewayStatusLabel(status) {
  return {
    healthy: "网关正常",
    degraded: "网关降级",
    outage: "网关异常",
    paused: "放量已暂停",
  }[status] || status || "状态待确认";
}

function opsAgentReadinessStatusLabel(status) {
  return {
    ready: "可以扩大使用",
    healthy: "运行稳定",
    needs_attention: "需要复核",
    blocked: "暂缓放量",
    paused: "已暂停",
  }[status] || status || "状态待确认";
}

function opsAgentHealthTone(agentOps = {}) {
  if (agentOps.rolloutPaused || agentOps.gatewayHealth === "outage" || agentOps.failedJobs > 5 || agentOps.staleJobs > 2) return "danger";
  if (agentOps.gatewayHealth === "degraded" || agentOps.readinessStatus === "needs_attention" || agentOps.failedJobs || agentOps.staleJobs) return "warn";
  return "ok";
}

function renderOpsAgentFailureBreakdown(agentOps = {}) {
  const rows = [
    { label: "策略拒绝", count: 4, copy: "跨租户或超范围导出" },
    { label: "生成失败", count: agentOps.failedJobs, copy: "可重试任务" },
    { label: "卡住任务", count: agentOps.staleJobs, copy: "超过运行目标" },
    { label: "队列等待", count: agentOps.queuedJobs, copy: "等待执行" },
  ];
  return `
    <section class="ops-agent-failure-grid" aria-label="Agent 失败原因分布">
      ${rows.map((row) => `<article><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(String(row.count))}</strong><small>${escapeHtml(row.copy)}</small></article>`).join("")}
    </section>
  `;
}

function renderOpsAgentOperationsCard(agentOps, options = {}) {
  const openAttr = options.open ? " open" : "";
  const providerTone = agentOps.rolloutPaused ? "warn" : agentOps.gatewayHealth === "healthy" ? "" : "danger";
  const gatewayLabel = agentOps.rolloutPaused ? "放量已暂停" : opsAgentGatewayStatusLabel(agentOps.gatewayHealth);
  const healthTone = opsAgentHealthTone(agentOps);
  const healthTitle = healthTone === "ok" ? "可以保持当前放量" : healthTone === "warn" ? "先复核失败和策略拒绝" : "建议暂停或限制放量";
  return `
    <details class="ops-queue-side-panel ops-queue-disclosure-panel" data-ops-agent-operations${openAttr}>
      <summary class="ops-queue-disclosure-summary">
        <div><span class="module-kicker">Agent 运维</span><h2>网关与服务配置</h2></div>
        <span class="status-pill ${providerTone}">${escapeHtml(gatewayLabel)}</span>
      </summary>
      <div class="ops-queue-disclosure-body">
        <section class="ops-agent-health-decision tone-${escapeHtml(healthTone)}" aria-label="Agent 放量判断">
          <div>
            <span>放量判断</span>
            <strong>${escapeHtml(healthTitle)}</strong>
            <p>${escapeHtml(agentOps.nextAction)}</p>
          </div>
          <small>${escapeHtml(`${agentOps.successRate}% 成功率 · ${agentOps.averageLatencyMs} ms 平均延迟`)}</small>
        </section>
        <div class="ops-queue-detail-grid">
          <article><span>网关调用</span><strong>${escapeHtml(String(agentOps.calls))}</strong></article>
          <article><span>成功率</span><strong>${escapeHtml(String(agentOps.successRate))}%</strong></article>
          <article><span>服务用量</span><strong>${escapeHtml(String(agentOps.totalTokens))}</strong></article>
          <article><span>成本</span><strong>USD ${escapeHtml(String(agentOps.estimatedCostUsd))}</strong></article>
          <article><span>延迟</span><strong>${escapeHtml(String(agentOps.averageLatencyMs))} ms</strong></article>
          <article><span>使用放量</span><strong data-ops-agent-rollout>${escapeHtml(String(agentOps.rolloutPercent))}%</strong></article>
        </div>
        <div class="ops-agent-readiness-card">
          <span>Agent 申请辅助就绪度</span>
          <p>${escapeHtml(opsAgentReadinessStatusLabel(agentOps.readinessStatus))} · ${escapeHtml(String(agentOps.readinessScore))} 分 · ${escapeHtml(agentOps.nextAction)}</p>
        </div>
        <div class="ops-agent-job-grid">
          <article><strong>${escapeHtml(String(agentOps.queuedJobs))}</strong><span>排队</span></article>
          <article><strong>${escapeHtml(String(agentOps.runningJobs))}</strong><span>运行中</span></article>
          <article><strong>${escapeHtml(String(agentOps.failedJobs))}</strong><span>失败</span></article>
          <article><strong>${escapeHtml(String(agentOps.staleJobs))}</strong><span>卡住</span></article>
        </div>
        ${renderOpsAgentFailureBreakdown(agentOps)}
        ${renderOpsFieldMap("Agent 运维字段", "展开查看网关与申请辅助队列字段", ["CUACAgentGatewaySummary", "CUACAgentGatewayHealth", "CUACAgentProviderConfig", "CUACAgentApplicationQueueHealth", "CUACAgentOperationalReadiness"], { compact: true })}
        <div class="inline-actions">
          <button class="secondary-action" data-ops-agent-ops-action="refresh" type="button">刷新摘要</button>
          <button class="secondary-action" data-ops-agent-ops-action="retry-failed" type="button">重试失败</button>
          <button class="secondary-action" data-ops-queue-command-view="audit" type="button">查看审计</button>
          <button class="secondary-action" data-ops-agent-ops-action="toggle-rollout" type="button">${agentOps.rolloutPaused ? "恢复放量" : "暂停放量"}</button>
        </div>
        <p class="ops-editor-note">最近操作：${escapeHtml(agentOps.lastOperation)} · 服务配置：${escapeHtml(agentOps.model)} · ${escapeHtml(gatewayLabel)}</p>
      </div>
    </details>
  `;
}

function revealOpsRenderedRoot(root = document.querySelector("[data-detail-root]")) {
  if (!root) return;
  window.CUAC?.reveal?.(root);
  const revealNow = () => {
    root.querySelectorAll(".reveal:not(.visible), .result-enter:not(.visible)").forEach((item) => {
      item.classList.add("visible");
      if (item.classList.contains("reveal")) item.dataset.cuacRevealBound = "true";
    });
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(revealNow);
  else revealNow();
}

function renderOpsPage() {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  try {
  const opsState = readOpsAdminState();
  const currentOpsSection = activeOpsSection(opsState);
  target.dataset.opsCurrentSection = currentOpsSection;
  const allSchoolRows = readOpsSchoolRecords(opsState);
  const schoolSearch = String(opsState.schoolSearch || "").trim().toLowerCase();
  const schoolFilter = opsState.schoolFilter || "all";
  const schoolRows = allSchoolRows.filter((school) => {
    const matchesFilter = opsLifecycleStatusMatches(school.status, schoolFilter);
    const haystack = [school.nameZh, school.nameEn, school.cityZh, school.region].filter(Boolean).join(" ").toLowerCase();
    return matchesFilter && (!schoolSearch || haystack.includes(schoolSearch));
  });
  const selectedSchool = getOpsSelectedSchool(schoolRows.length ? schoolRows : allSchoolRows, opsState);
  const selectedSchoolId = selectedSchool?.id || "";
  const schoolEditorTab = activeOpsSchoolTab(opsState);
  const schoolView = activeOpsSchoolView(opsState);
  const cityRows = readOpsCityRecords(opsState);
  const publicScholarshipRows = readOpsScholarshipRecords(opsState);
  const timelineRows = readOpsTimelineRecords(opsState);
  const accessRows = readOpsAccessRecords(opsState);
  const allStudentRows = readOpsStudentRecords(opsState);
  const studentRows = filterOpsStudents(allStudentRows, opsState);
  const selectedStudent = getOpsSelectedStudent(studentRows.length ? studentRows : allStudentRows, opsState);
  const selectedStudentId = selectedStudent?.id || "";
  const auditItems = toArray(opsState.auditItems).length ? toArray(opsState.auditItems) : [
    "已复核 Agent 导出拒绝记录",
    "已准备支付回调重试",
    "已检查浙江大学租户响应情况",
  ];
  const auditEvents = readOpsAuditEvents({ ...opsState, auditItems });
  const queueRows = readOpsQueueRecords(opsState);
  const selectedQueue = getOpsSelectedQueue(queueRows, opsState);
  const selectedQueueId = selectedQueue?.id || "";
  const agentOps = readOpsAgentOpsState(opsState);
  const queueView = activeOpsQueueView(opsState);
  const overviewStats = buildOpsOverviewStats(allSchoolRows, allStudentRows, queueRows, auditItems, opsState);
  const foundationStats = buildOpsOverviewFoundationStats(allSchoolRows, allStudentRows);
  const studentInsights = buildOpsStudentInsightStats(allStudentRows);
  const schoolInsights = buildOpsSchoolInsightStats(allSchoolRows, allStudentRows);
  const opsTabItems = [
    ["overview", "概览", `${overviewStats.auditCount} 审计`],
    ["school", "学校数据", `${overviewStats.schoolCount} 所`],
    ["content", "内容数据", `${cityRows.length + publicScholarshipRows.length + timelineRows.length} 条`],
    ["students", "学生申请", `${overviewStats.followUpCount} 待跟进`],
    ["access", "账号权限", `${accessRows.length} 个`],
    ["queue", "队列与审计", `${overviewStats.queueHighCount} 高优先级`],
  ];
  target.innerHTML = `
    <section class="ops-admin-hero reveal">
      <div class="ops-admin-title">
        <a class="back-link" href="home-v3.html">返回 CUAC</a>
        <span class="module-kicker">内部运营</span>
        <h1>运营管理后台</h1>
        <p>处理申请闭环、目录质量、账号权限和 Agent 审计。高风险动作必须留痕。</p>
        <div class="status-row"><span class="status-pill danger">仅内部使用</span><span class="status-pill">需要审计</span><span class="status-pill warn">跨租户支持受控</span><span class="status-pill" data-ops-state>${opsState.lastAction ? "审计记录已更新" : "运营控制台"}</span></div>
      </div>
      <aside class="ops-admin-readout" aria-label="当前运营重点">
        <span>今日优先</span>
        <strong>${overviewStats.queueHighCount} 个高风险事项</strong>
        <small>发送重试 ${overviewStats.routingRetries} · 学生跟进 ${overviewStats.followUpCount} · 来源复核 ${overviewStats.sourceReviewCount}</small>
      </aside>
    </section>
    ${renderOpsOverviewCoreMetrics(overviewStats, accessRows)}
    <nav class="ops-tab-nav reveal" aria-label="运营工作台分区" role="tablist">
      ${opsTabItems.map(([key, label, meta]) => `<button class="${key === currentOpsSection ? "active" : ""}" data-ops-tab="${escapeHtml(key)}" type="button" role="tab" aria-selected="${key === currentOpsSection ? "true" : "false"}"><span>${escapeHtml(label)}</span><small>${escapeHtml(meta)}</small></button>`).join("")}
    </nav>
    <section ${opsTabPanelAttrs("overview", opsState)}>
      ${renderOpsOverviewFoundation(foundationStats)}
      ${renderOpsOverviewAnalytics(studentInsights, schoolInsights)}
      <section class="ops-overview-dashboard" aria-label="运营概览驾驶舱">
        <article class="ops-overview-priority">
          <div class="section-head full">
            <div><span class="module-kicker">今日处理</span><h2>先处理会阻塞申请闭环的事项</h2></div>
            <span class="status-pill danger">${overviewStats.queueHighCount} 高优先级</span>
          </div>
          ${renderOpsOverviewPriorityList(overviewStats, accessRows)}
        </article>
        <article class="ops-overview-health">
          <div class="section-head full">
            <div><span class="module-kicker">系统健康</span><h2>数据、支付、权限、Agent</h2></div>
            <button class="secondary-action micro" data-ops-action="open-analytics" type="button">刷新</button>
          </div>
          <p class="ops-overview-snapshot" data-ops-overview-summary>${allSchoolRows.length} 所学校 · ${accessRows.length} 个账号权限 · ${overviewStats.studentCount} 个学生申请 · ${overviewStats.routingRetries} 个发送重试。</p>
          ${renderOpsOverviewHealthGrid(overviewStats, accessRows, agentOps)}
        </article>
      </section>
      <div class="ops-overview-grid">
        <section class="ops-overview-section"><span class="module-kicker">管理门禁</span><h2>上线前检查</h2><div class="ops-gate-list"><label><input checked type="checkbox" /><span>租户隔离测试</span></label><label><input checked type="checkbox" /><span>支付幂等检查</span></label><label><input checked type="checkbox" /><span>Agent 操作注册表</span></label><label><input type="checkbox" /><span>退款和跨租户支持需要二次审批</span></label></div></section>
        <section class="ops-overview-section">
          <span class="module-kicker">数据归属</span><h2>对齐 CSCAlite</h2>
          <p>学校、项目、奖学金和 CSCA 规则先按 CSCAlite 字段结构管理；CUAC 额外记录申请交接、支付、租户发送和 Agent 审计。</p>
          <div class="ops-owner-list"><span>项目 ${overviewStats.programCount}</span><span>学校奖学金 ${overviewStats.scholarshipCount}</span><span>城市 ${cityRows.length}</span><span>公共奖学金 ${publicScholarshipRows.length}</span><span>时间窗 ${timelineRows.length}</span><span>账号权限 ${accessRows.length}</span><span>CSCA 规则 ${overviewStats.cscaRuleCount}</span></div>
        </section>
        <section class="ops-overview-section">
          <span class="module-kicker">风险观察</span><h2>高风险监控</h2>
          ${renderOpsRiskGrid(overviewStats)}
        </section>
      </div>
    </section>
    <section ${opsTabPanelAttrs("school", opsState)}>
      <div class="main-stack full">
        <article class="ops-management-surface ops-school-management">
          <div class="section-head"><div><span class="module-kicker">学校目录</span><h2>学校数据管理</h2><p>维护与 CSCAlite 对齐的学校档案、项目、奖学金、申请要求和来源记录。</p></div></div>
          ${renderOpsSchoolWorkspaceCommand(allSchoolRows, schoolRows, allStudentRows, selectedSchool, schoolView)}
          ${renderOpsSchoolViewTabs(schoolView, selectedSchool, schoolEditorTab, allStudentRows)}
          <div class="ops-school-view-stack">
            ${renderOpsSchoolViewPanel("catalog", schoolView, renderOpsSchoolCatalogPanel(schoolRows, selectedSchoolId, opsState, allSchoolRows, allStudentRows))}
            ${renderOpsSchoolViewPanel("edit", schoolView, renderSchoolEditorPanel(selectedSchool, schoolEditorTab))}
            ${renderOpsSchoolViewPanel("preview", schoolView, renderOpsSchoolPreviewPanel(selectedSchool))}
            ${renderOpsSchoolViewPanel("model", schoolView, renderOpsSchoolModelPanel(selectedSchool))}
          </div>
        </article>
      </div>
    </section>
    <section ${opsTabPanelAttrs("students", opsState)}>
      <div class="main-stack full">
        <article class="ops-management-surface ops-student-management">
          <div class="section-head">
            <div>
              <span class="module-kicker">学生与申请</span>
              <h2>学生申请管理</h2>
              <p>按支付、学校发送、账号状态和 Agent 上下文跟进学生申请；学校端只接收本校可见记录。</p>
            </div>
          </div>
          ${renderOpsStudentCommandCenter(allStudentRows, studentRows, overviewStats)}
          ${renderOpsStudentPortfolioDashboard(allStudentRows, studentRows)}
          <div class="ops-filter-bar">
            <label><span>搜索学生</span><input data-ops-student-search value="${escapeHtml(opsState.studentSearch || "")}" placeholder="姓名、国家、城市、学校、专业、预算、奖学金、HSK、CSCA" /></label>
            <label><span>状态</span><select data-ops-student-filter><option value="all">全部状态</option><option value="已发送给学校" ${opsState.studentFilter === "已发送给学校" ? "selected" : ""}>已发送给学校</option><option value="资料不完整" ${opsState.studentFilter === "资料不完整" ? "selected" : ""}>资料不完整</option><option value="学校已联系" ${opsState.studentFilter === "学校已联系" ? "selected" : ""}>学校已联系</option><option value="checklist" ${opsState.studentFilter === "checklist" ? "selected" : ""}>已加入 checklist</option><option value="application_set" ${opsState.studentFilter === "application_set" ? "selected" : ""}>已形成申请集</option><option value="sent" ${opsState.studentFilter === "sent" ? "selected" : ""}>学校已发送</option><option value="paid" ${opsState.studentFilter === "paid" ? "selected" : ""}>已支付</option><option value="active" ${opsState.studentFilter === "active" ? "selected" : ""}>账号启用</option><option value="disabled" ${opsState.studentFilter === "disabled" ? "selected" : ""}>账号停用</option><option value="student" ${opsState.studentFilter === "student" ? "selected" : ""}>学生角色</option></select></label>
            <button class="secondary-action" data-ops-student-apply-filter type="button">筛选</button>
          </div>
          ${renderOpsStudentExportPanel(opsState)}
          <div class="ops-student-workbench">
          <div class="ops-management-table">
            ${studentRows.map((student) => renderOpsStudentCard(student, selectedStudentId)).join("") || `<p class="ops-empty">没有匹配的学生申请记录。</p>`}
          </div>
          ${renderOpsStudentDetail(selectedStudent)}
          </div>
        </article>
      </div>
    </section>
    ${renderOpsContentPanel(cityRows, publicScholarshipRows, timelineRows, opsState)}
    ${renderOpsAccessPanel(accessRows, opsState)}
    <section ${opsTabPanelAttrs("queue", opsState)}>
      <div class="ops-queue-workspace">
        <article class="ops-queue-shell">
          <div class="section-head">
            <div>
              <span class="module-kicker">队列与审计</span>
              <h2>运营控制台</h2>
              <p>处理支付后发送、失败重试、支持查询和 Agent 策略审计；高风险动作必须留下证据。</p>
            </div>
          </div>
          ${renderOpsQueueCommandCenter(queueRows, auditEvents, agentOps, overviewStats)}
          ${renderOpsQueuePortfolioDashboard(queueRows, auditEvents, agentOps)}
          ${renderOpsQueueViewTabs(queueView, queueRows, auditEvents, agentOps)}
          <div class="ops-queue-view-stack">
            ${renderOpsQueueViewPanel("work", queueView, `
              <div class="ops-queue-main">
                <article class="ops-queue-section">
                  <div class="section-head"><div><span class="module-kicker">待办队列</span><h2>运营工作清单</h2></div><span class="status-pill">${queueRows.length} 条</span></div>
                  <div class="ops-queue" data-ops-queue>
                    ${queueRows.map((item) => renderOpsQueueCard(item, selectedQueueId)).join("")}
                  </div>
                </article>
                ${renderOpsQueueDetail(selectedQueue)}
                <div class="ops-queue-ops-row">
                  ${renderOpsQueueRiskPanel(queueRows, auditEvents, agentOps)}
                </div>
              </div>
            `)}
            ${renderOpsQueueViewPanel("audit", queueView, renderOpsAuditEventsPanel(auditEvents, opsState))}
            ${renderOpsQueueViewPanel("support", queueView, renderOpsSupportPanel(opsState))}
            ${renderOpsQueueViewPanel("agent", queueView, renderOpsAgentOperationsCard(agentOps, { open: true }))}
          </div>
        </article>
      </div>
    </section>
  `;
  switchOpsSection(currentOpsSection, { persist: false, scroll: false });
  revealOpsRenderedRoot(target);
  document.dispatchEvent(new CustomEvent("cuac:ops-rendered"));
  } catch (error) {
    target.innerHTML = `
      <section class="ops-error-state" role="alert">
        <span class="module-kicker">运营后台</span>
        <h1>页面模块暂时无法渲染</h1>
        <p>前端预览状态可能来自旧版本。已加入自动迁移和兜底，仍异常时可以重置本地预览状态后继续测试。</p>
        <div class="inline-actions">
          <button class="primary-action" data-ops-recover-scholarship-draft type="button">恢复并新增奖学金草稿</button>
          <button class="secondary-action" data-ops-reset-state type="button">重置本地预览状态</button>
        </div>
      </section>
    `;
    console.error("CUAC ops admin render failed", error);
  }
}

function switchOpsSection(section, options = {}) {
  const { persist = true, scroll = true } = options;
  let nextSection = section || "overview";
  const panels = Array.from(document.querySelectorAll("[data-ops-section]"));
  if (!panels.some((panel) => panel.dataset.opsSection === nextSection)) {
    nextSection = "overview";
  }
  if (persist) {
    const state = readOpsAdminState();
    const nextState = { ...state, opsSection: nextSection };
    writeOpsAdminState(nextState);
    syncOpsHashRoute(nextState);
  }
  document.querySelectorAll("[data-ops-tab]").forEach((tab) => {
    const active = tab.dataset.opsTab === nextSection;
    tab.classList.toggle("active", active);
    if (tab.getAttribute("role") === "tab") {
      tab.setAttribute("aria-selected", active ? "true" : "false");
    }
  });
  panels.forEach((panel) => {
    const active = panel.dataset.opsSection === nextSection;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  const activePanel = panels.find((panel) => panel.dataset.opsSection === nextSection);
  if (activePanel && scroll) activePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.dispatchEvent(new CustomEvent("cuac:ops-section-changed", { detail: { section: nextSection } }));
}

function updateOpsSchoolState(updater) {
  const state = readOpsAdminState();
  const records = readOpsSchoolRecords(state);
  const next = updater({ ...state, schoolRecords: records }) || state;
  writeOpsAdminState(next);
  return next;
}

function recoverOpsSchoolScholarshipDraftState(reason = "已恢复学校奖学金草稿") {
  const state = readOpsAdminState();
  const records = readOpsSchoolRecords(state);
  const selectedSchool = getOpsSelectedSchool(records, state);
  if (!selectedSchool?.id) return "";
  const existingScholarships = toRecordArray(selectedSchool.scholarshipsDetailed);
  const draft = createOpsSchoolScholarshipDraftRecord(existingScholarships.length + 1, selectedSchool.id);
  const schoolRecords = records.map((school) => String(school.id) === String(selectedSchool.id)
    ? { ...school, scholarshipsDetailed: [...toRecordArray(school.scholarshipsDetailed), draft] }
    : school);
  writeOpsAdminState({
    ...state,
    opsSection: "school",
    schoolView: "edit",
    selectedSchoolId: selectedSchool.id,
    schoolEditorTab: "scholarships",
    schoolRecords,
    lastAction: reason,
    auditItems: [reason, ...toArray(state.auditItems)].slice(0, 6),
  });
  return draft.id;
}

function recoverOpsSchoolScholarshipDraftAndRender(reason = "已从学校奖学金空白状态自动恢复草稿") {
  const draftId = recoverOpsSchoolScholarshipDraftState(reason);
  if (!draftId) return false;
  renderOpsPage();
  switchOpsSection("school", { persist: false, scroll: false });
  showCompletionToast("学校奖学金草稿已自动恢复，请继续编辑。");
  return true;
}

function rerenderOpsSchoolSection(message) {
  renderOpsPage();
  switchOpsSection("school");
  if (message) showCompletionToast(message);
  ensureOpsPageNotBlank("学校管理重绘后主区域为空");
}

function refreshOpsSchoolEditorOnly(state, schoolId, tab, message = "") {
  const editor = document.querySelector("[data-ops-school-editor]");
  const panel = document.querySelector('[data-ops-section="school"]');
  if (!editor || !panel) return false;
  try {
    const records = readOpsSchoolRecords(state);
    const selectedSchool = records.find((school) => String(school.id) === String(schoolId)) || getOpsSelectedSchool(records, state);
    if (!selectedSchool) return false;
    editor.outerHTML = renderSchoolEditorPanel(selectedSchool, tab || activeOpsSchoolTab(state));
    switchOpsSection("school", { persist: false, scroll: false });
    if (message) showCompletionToast(message);
    ensureOpsPageNotBlank("学校编辑器局部刷新后主区域为空");
    return true;
  } catch (error) {
    console.error("CUAC ops school editor partial refresh failed", error);
    return false;
  }
}

function ensureOpsSchoolEditorRendered(kind = "", label = "", recordId = "") {
  if (mode !== "ops") return;
  if (activeOpsSection(readOpsAdminState()) !== "school") return;
  const panel = document.querySelector('[data-ops-section="school"]');
  const editor = document.querySelector("[data-ops-school-editor]");
  const kindKey = kind === "scholarship" ? "scholarships" : kind === "program" ? "programs" : kind === "rule" ? "rules" : kind;
  const expectedSubrecords = Array.from(panel?.querySelectorAll(`[data-ops-subrecord][data-kind="${kindKey}"]`) || []);
  const hasEditableSubrecord = !kindKey || expectedSubrecords
    .some((node) => node.querySelector("[data-ops-subrecord-field]"));
  const hasExpectedSubrecord = !kindKey || expectedSubrecords
    .some((node) => (recordId ? String(node.dataset.recordId || "") === String(recordId) : (!label || node.textContent.includes(label))));
  const hasExpectedCopy = !label || Boolean(panel?.textContent?.includes(label));
  const hasActiveEditorTab = !kind || {
    program: "programs",
    rule: "admissions",
    scholarship: "scholarships",
  }[kind] === document.querySelector("[data-ops-school-tab].active")?.dataset.opsSchoolTab;
  const identityRequired = Boolean(label || recordId);
  const visible = Boolean(panel && !panel.hidden && editor
    && activeOpsSchoolView(readOpsAdminState()) === "edit"
    && (hasExpectedSubrecord || (!identityRequired && hasEditableSubrecord))
    && (hasExpectedCopy || hasExpectedSubrecord || (!identityRequired && hasEditableSubrecord))
    && hasActiveEditorTab);
  if (visible) return;
  if (kind === "scholarship" && !hasExpectedSubrecord) {
    recoverOpsSchoolScholarshipDraftAndRender("已从学校奖学金空白状态自动恢复草稿");
    return;
  }
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "school",
    schoolView: "edit",
    schoolEditorTab: kind === "scholarship" ? "scholarships" : activeOpsSchoolTab(state),
    lastAction: "已从学校编辑空白状态自动恢复",
    auditItems: ["已从学校编辑空白状态自动恢复", ...toArray(state.auditItems)].slice(0, 6),
  });
  renderOpsPage();
  switchOpsSection("school", { persist: false, scroll: false });
  showCompletionToast("学校编辑器已自动恢复，请继续编辑新增记录。");
}

function scheduleOpsSchoolEditorIntegrityCheck(kind = "", label = "", recordId = "") {
  if (mode !== "ops") return;
  const verify = () => ensureOpsSchoolEditorRendered(kind, label, recordId);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(verify);
  setTimeout(verify, 80);
  setTimeout(verify, 240);
}

function scheduleOpsSchoolScholarshipClickGuard() {
  if (mode !== "ops") return;
  const verify = () => {
    const state = readOpsAdminState();
  if (activeOpsSection(state) !== "school" || activeOpsSchoolTab(state) !== "scholarships") return;
    if (activeOpsSchoolView(state) !== "edit") return;
    const panel = document.querySelector('[data-ops-section="school"]');
    const editor = document.querySelector("[data-ops-school-editor]");
    const hasEditableScholarship = Array.from(panel?.querySelectorAll('[data-ops-subrecord][data-kind="scholarships"]') || [])
      .some((node) => node.querySelector("[data-ops-subrecord-field]"));
    const hasWork = Boolean(panel && !panel.hidden && editor && hasEditableScholarship && panel.textContent.trim().length > 1000);
    if (!hasWork) {
      recoverOpsSchoolScholarshipDraftAndRender("已从新增学校奖学金空白状态自动恢复草稿");
    }
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(verify);
  setTimeout(verify, 80);
  setTimeout(verify, 240);
}

function assertOpsSchoolSubrecordDraftVisible(kind = "", label = "") {
  if (mode !== "ops") return;
  ensureOpsSchoolEditorRendered(kind, label);
  const panel = document.querySelector('[data-ops-section="school"]');
  const editor = document.querySelector("[data-ops-school-editor]");
  const kindKey = kind === "scholarship" ? "scholarships" : kind === "program" ? "programs" : kind === "rule" ? "rules" : kind;
  const activeTab = document.querySelector("[data-ops-school-tab].active")?.dataset.opsSchoolTab || "";
  const expectedTab = { program: "programs", rule: "admissions", scholarship: "scholarships" }[kind] || activeTab;
  const expectedRecord = Array.from(panel?.querySelectorAll(`[data-ops-subrecord][data-kind="${kindKey}"]`) || [])
    .find((node) => !label || node.textContent.includes(label));
  const hasEditableField = !expectedRecord || Boolean(expectedRecord.querySelector("[data-ops-subrecord-field]"));
  if (panel && !panel.hidden && editor && activeTab === expectedTab && expectedRecord && hasEditableField) return;
  if (kind === "scholarship") {
    recoverOpsSchoolScholarshipDraftState("已从新增学校奖学金空白状态自动恢复草稿");
    rerenderOpsSchoolSection("新增学校奖学金已自动恢复为可编辑草稿。");
    ensureOpsSchoolEditorRendered("scholarship", "新奖学金草稿");
    return;
  }
  ensureOpsPageNotBlank("新增学校子记录后学校编辑器为空");
}

function currentOpsSchoolEditor() {
  return document.querySelector("[data-ops-school-editor]");
}

function setOpsSchoolEditorDirty(dirty = true) {
  const editor = currentOpsSchoolEditor();
  if (!editor) return false;
  editor.dataset.dirty = dirty ? "true" : "false";
  const warning = editor.querySelector("[data-ops-school-unsaved-warning]");
  if (warning) warning.hidden = !dirty;
  if (!dirty) {
    const confirm = editor.querySelector("[data-ops-school-switch-confirm]");
    if (confirm) confirm.hidden = true;
    delete editor.dataset.pendingSchoolId;
    delete editor.dataset.pendingSchoolTab;
    delete editor.dataset.pendingSchoolView;
  }
  return dirty;
}

function opsSchoolEditorIsDirty() {
  return currentOpsSchoolEditor()?.dataset.dirty === "true";
}

function guardOpsSchoolUnsavedSwitch(action = {}) {
  const editor = currentOpsSchoolEditor();
  if (!editor || editor.dataset.dirty !== "true") return false;
  const currentSchoolId = editor.dataset.schoolId || "";
  const nextSchoolId = action.schoolId ? String(action.schoolId) : "";
  const nextTab = action.tab ? normalizeOpsSchoolTab(action.tab) : "";
  const nextView = action.view ? normalizeOpsSchoolView(action.view) : "";
  const activeTab = editor.querySelector("[data-ops-school-tab].active")?.dataset.opsSchoolTab || "";
  if (nextSchoolId && nextSchoolId === currentSchoolId) return false;
  if (nextTab && nextTab === activeTab) return false;
  if (nextSchoolId) editor.dataset.pendingSchoolId = nextSchoolId;
  if (nextTab) editor.dataset.pendingSchoolTab = nextTab;
  if (nextView) editor.dataset.pendingSchoolView = nextView;
  const confirm = editor.querySelector("[data-ops-school-switch-confirm]");
  if (confirm) {
    const copy = confirm.querySelector("[data-ops-school-switch-copy]");
    if (copy) copy.textContent = nextSchoolId
      ? "当前学校字段已修改，切换学校会放弃这些本地改动。"
      : nextView
        ? "当前学校字段已修改，切换视图会放弃这些本地改动。"
      : "当前分区字段已修改，切换编辑分区会放弃这些本地改动。";
    confirm.hidden = false;
    confirm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  showCompletionToast("当前学校有未保存改动，请先保存或确认放弃。");
  return true;
}

function setOpsSchoolView(view) {
  const nextView = normalizeOpsSchoolView(view);
  const state = readOpsAdminState();
  if (activeOpsSchoolView(state) === "edit" && nextView !== "edit" && opsSchoolEditorIsDirty()) {
    setOpsSchoolEditorDirty(true);
    showCompletionToast("当前学校有未保存改动，请先保存或确认放弃。");
    return;
  }
  const nextState = { ...state, opsSection: "school", schoolView: nextView };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  renderOpsPage();
  switchOpsSection("school", { persist: false, scroll: false });
  ensureOpsPageNotBlank("学校数据视图切换后主区域为空");
}

function openOpsSchoolRecordView(schoolId, view = "edit") {
  const nextView = normalizeOpsSchoolView(view);
  const nextSchoolId = String(schoolId || "");
  const state = readOpsAdminState();
  const leavingDirtyEditor = activeOpsSchoolView(state) === "edit" && nextView !== "edit" && opsSchoolEditorIsDirty();
  if (leavingDirtyEditor) {
    guardOpsSchoolUnsavedSwitch({ view: nextView, schoolId: nextSchoolId || state.selectedSchoolId });
    return;
  }
  if (nextSchoolId && nextSchoolId !== String(state.selectedSchoolId || "") && guardOpsSchoolUnsavedSwitch({ schoolId: nextSchoolId })) return;
  const nextState = {
    ...state,
    opsSection: "school",
    schoolView: nextView,
    selectedSchoolId: nextSchoolId || state.selectedSchoolId,
    lastAction: `已打开学校${opsSchoolViews.find(([key]) => key === nextView)?.[1] || "编辑"}视图`,
  };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  renderOpsPage();
  switchOpsSection("school", { persist: false, scroll: false });
  ensureOpsPageNotBlank("学校记录视图打开后主区域为空");
}

function markOpsSchoolEditorDirtyFromEvent(event) {
  const target = event.target;
  if (!target?.closest) return;
  if (!target.closest("[data-ops-school-editor]")) return;
  if (!target.closest("[data-ops-school-field], [data-ops-subrecord-field]")) return;
  setOpsSchoolEditorDirty(true);
}

function currentOpsContentEditor() {
  const activePanel = document.querySelector('[data-ops-section="content"]:not([hidden])');
  const visibleEditor = activePanel?.querySelector('[data-ops-content-view-panel]:not([hidden]) [data-ops-content-editor]');
  if (visibleEditor) return visibleEditor;
  return [...(activePanel?.querySelectorAll("[data-ops-content-editor]") || [])].find((editor) => !editor.closest("[hidden]"))
    || [...document.querySelectorAll("[data-ops-content-editor]")].find((editor) => !editor.closest("[hidden]"))
    || document.querySelector("[data-ops-content-editor]");
}

function setOpsContentEditorDirty(dirty = true, editorOverride = null) {
  const editor = editorOverride || currentOpsContentEditor();
  if (!editor) return false;
  editor.dataset.dirty = dirty ? "true" : "false";
  const warning = editor.querySelector("[data-ops-content-unsaved-warning]");
  if (warning) warning.hidden = !dirty;
  return dirty;
}

function opsContentEditorIsDirty(editorOverride = null) {
  return (editorOverride || currentOpsContentEditor())?.dataset.dirty === "true";
}

function markOpsContentEditorDirtyFromEvent(event) {
  const target = event.target;
  if (!target?.closest) return;
  if (!target.closest("[data-ops-content-editor]")) return;
  if (!target.closest("[data-ops-content-field], [data-ops-scholarship-school-toggle], [data-ops-scholarship-program-toggle]")) return;
  setOpsContentEditorDirty(true, target.closest("[data-ops-content-editor]"));
}

function discardOpsSchoolUnsavedAndContinue() {
  const editor = currentOpsSchoolEditor();
  if (!editor) return;
  const pendingSchoolId = editor.dataset.pendingSchoolId || "";
  const pendingTab = editor.dataset.pendingSchoolTab || "";
  const pendingView = editor.dataset.pendingSchoolView || "";
  setOpsSchoolEditorDirty(false);
  if (pendingView) {
    openOpsSchoolRecordView(pendingSchoolId || editor.dataset.schoolId || "", pendingView);
    return;
  }
  if (pendingSchoolId) {
    selectOpsSchool(pendingSchoolId);
    return;
  }
  if (pendingTab) {
    setOpsSchoolEditorTab(pendingTab);
    return;
  }
  showCompletionToast("已放弃本地未保存改动。");
}

function selectOpsSchool(schoolId) {
  if (guardOpsSchoolUnsavedSwitch({ schoolId })) return;
  const next = updateOpsSchoolState((state) => ({ ...state, schoolView: "edit", selectedSchoolId: schoolId, lastAction: "已打开学校目录编辑器，并保留旧项目字段映射参考" }));
  rerenderOpsSchoolSection(`已打开学校目录编辑器：${readOpsSchoolRecords(next).find((item) => item.id === schoolId)?.nameZh || "学校"}。`);
}

function readOpsSchoolCreateDraftInput() {
  const panel = document.querySelector("[data-ops-school-create-panel]");
  const values = {};
  panel?.querySelectorAll("[data-ops-school-create-field]").forEach((field) => {
    values[field.dataset.opsSchoolCreateField] = field.value;
  });
  return {
    nameZh: String(values.nameZh || "").trim(),
    nameEn: String(values.nameEn || "").trim(),
    cityZh: String(values.cityZh || "").trim(),
    region: String(values.region || "").trim(),
    schoolType: String(values.schoolType || "regular").trim() || "regular",
  };
}

function setOpsSchoolCreateOpen(open) {
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "school",
    schoolView: "catalog",
    schoolCreateOpen: Boolean(open),
    schoolImportOpen: open ? false : state.schoolImportOpen,
    lastAction: open ? "已打开新增学校表单" : "已收起新增学校表单",
  });
  rerenderOpsSchoolSection(open ? "请先填写学校基础信息。" : "");
}

function createOpsSchoolDraft(input = {}) {
  const nameZh = String(input.nameZh || "").trim() || "新学校草稿";
  const nameEn = String(input.nameEn || "").trim();
  const cityZh = String(input.cityZh || "").trim();
  const region = String(input.region || "").trim();
  const schoolType = String(input.schoolType || "regular").trim() || "regular";
  const draftId = `school-${Date.now()}`;
  const now = new Date().toISOString();
  const draft = {
    id: draftId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    nameZh,
    nameEn,
    citySlug: "",
    cityZh,
    region,
    schoolType,
    guaranteedAdmission: false,
    tierEn: "",
    logoUrl: "",
    status: "draft",
    verificationStatus: "待核验",
    rank: "",
    applicationLevel: "",
    admissionLevel: "",
    tuitionSummary: "",
    applicationFee: "",
    insurance: "",
    officialWebsite: "",
    applicationSystemUrl: "",
    hskRequirement: "",
    hskNotes: "",
    hskMinLevel: "",
    hskChineseMinLevel: "",
    hskChineseMinListening: "",
    hskChineseMinReading: "",
    hskChineseMinWriting: "",
    hskChineseConditional: "",
    hskEnglishRequired: false,
    hskkRequired: false,
    hskkChineseMinLevel: "",
    hskkChineseConditional: "",
    englishRequired: false,
    englishMinIelts: "",
    englishMinToefl: "",
    cscaRequirement: "",
    cscaSubjects: "",
    englishRequirement: "",
    deadlineSummary: "",
    cscaRequired: false,
    cscaRequirementNote: "",
    undergradRequirements: "",
    postgradRequirements: "",
    preparatoryRequirements: "",
    languageOfInstruction: "",
    fitNotes: "",
    subjectTags: "",
    languageTags: "",
    tuitionBandLabel: "",
    hasEnglishPrograms: false,
    hasScholarships: false,
    decisionSummary: "",
    programSubjectTags: "",
    programTuitionBandLabel: "",
    programQualityIssues: "",
    requiredSubjectTags: "",
    scholarships: "",
    englishPrograms: "",
    notablePrograms: "",
    campusFacilities: "",
    programFields: "",
    applicationPortalNotes: "",
    campusHighlights: [],
    contactNotes: [],
    contactTel: "",
    contactEmail: "",
    contactAddress: "",
    yearEstablished: "",
    studentCount: "",
    studentsServed: "",
    under18GuardianRequired: false,
    under18RequirementNote: "",
    source: "CSCAlite",
    sourceId: draftId,
    sourceUrl: "",
    sourceLabel: "",
    sourceNote: "",
    lastVerifiedAt: "",
    qualityScore: 0,
    dataQualityScore: 0,
    completenessLabel: "待补充",
    missingFields: [],
    owner: "目录团队",
    next: "补充学校基础字段并保存",
    programs: [],
    cscaRules: [],
    scholarshipsDetailed: [],
    upcomingDeadlines: [],
    quickFacts: {
      location: "",
      region: "",
      tuition: "",
      livingCost: "",
      accommodation: "",
      programCount: 0,
      englishProgramCount: 0,
    },
    detailDisplay: {
      city: "",
      regionLabel: "",
      livingCostLabel: "",
      displayProgramCount: 0,
      displayUndergraduateCount: 0,
      visibleProgramCount: 0,
      hiddenProgramNote: "",
      displaySubjectTags: [],
      programFieldTags: [],
      programDisplayGroups: [],
      applicationTimeline: [],
    },
  };
  updateOpsSchoolState((state) => appendOpsSchoolChangeLog({
    ...state,
    selectedSchoolId: draftId,
    schoolView: "edit",
    schoolEditorTab: "basic",
    schoolSearch: "",
    schoolFilter: "all",
    schoolCreateOpen: false,
    schoolRecords: [draft, ...state.schoolRecords],
    lastAction: "已创建学校草稿",
    auditItems: [`已创建学校草稿：${nameZh}`, ...toArray(state.auditItems)].slice(0, 6),
  }, draftId, "create_school", [`创建学校草稿：${nameZh}`, `学校类型：${schoolType}`], null, opsSchoolAuditSnapshot(draft)));
  rerenderOpsSchoolSection(`已新增学校草稿：${nameZh}。请在右侧继续补全字段。`);
}

function readOpsSchoolImportText() {
  return document.querySelector("[data-ops-school-import-text]")?.value || readOpsAdminState().schoolImportText || createOpsSchoolImportExample();
}

function setOpsSchoolImportOpen(open) {
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "school",
    schoolView: "catalog",
    schoolCreateOpen: open ? false : state.schoolCreateOpen,
    schoolImportOpen: open,
    schoolImportText: readOpsSchoolImportText(),
    schoolImportPreview: null,
  });
  rerenderOpsSchoolSection("");
}

function setOpsSchoolImportExample() {
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "school",
    schoolView: "catalog",
    schoolImportOpen: true,
    schoolImportText: createOpsSchoolImportExample(),
    schoolImportPreview: null,
  });
  rerenderOpsSchoolSection("已填入 CSCAlite 学校导入示例。");
}

function previewOpsSchoolImport() {
  const state = readOpsAdminState();
  const text = readOpsSchoolImportText();
  try {
    const items = parseOpsSchoolImportItems(text);
    writeOpsAdminState({
      ...state,
      opsSection: "school",
      schoolView: "catalog",
      schoolImportOpen: true,
      schoolImportText: text,
      schoolImportPreview: { tone: "success", message: `已识别 ${items.length} 所学校，可以导入。` },
    });
    rerenderOpsSchoolSection("学校 JSON 校验通过。");
  } catch (error) {
    writeOpsAdminState({
      ...state,
      opsSection: "school",
      schoolView: "catalog",
      schoolImportOpen: true,
      schoolImportText: text,
      schoolImportPreview: { tone: "danger", message: error?.message || "JSON 格式暂时无法解析。" },
    });
    rerenderOpsSchoolSection("学校 JSON 校验未通过。");
  }
}

function findOpsSchoolImportIndex(records, item) {
  const source = String(item.source || "");
  const sourceId = String(item.sourceId || "");
  if (source && sourceId) {
    const bySource = records.findIndex((school) => String(school.source || "") === source && String(school.sourceId || "") === sourceId);
    if (bySource >= 0) return bySource;
  }
  const byId = records.findIndex((school) => String(school.id || "") === String(item.id || ""));
  if (byId >= 0) return byId;
  return records.findIndex((school) => String(school.nameZh || "") === String(item.nameZh || ""));
}

function applyOpsSchoolImport() {
  const text = readOpsSchoolImportText();
  const state = readOpsAdminState();
  try {
    const items = parseOpsSchoolImportItems(text);
    let records = readOpsSchoolRecords(state);
    let created = 0;
    let updated = 0;
    let nextState = state;
    const importedIds = [];
    items.forEach((item, index) => {
      const existingIndex = findOpsSchoolImportIndex(records, item);
      const before = existingIndex >= 0 ? records[existingIndex] : null;
      const nextItem = normalizeOpsSchoolRecord({
        ...(before || {}),
        ...item,
        version: Number(before?.version || item.version || 1) + (before ? 1 : 0),
        updatedAt: new Date().toISOString(),
      }, records.length + index);
      importedIds.push(nextItem.id);
      if (existingIndex >= 0) {
        records = records.map((school, schoolIndex) => schoolIndex === existingIndex ? nextItem : school);
        updated += 1;
        nextState = appendOpsSchoolChangeLog(nextState, nextItem.id, "import_school_update", ["批量 JSON 导入更新学校"], opsSchoolAuditSnapshot(before), opsSchoolAuditSnapshot(nextItem));
      } else {
        records = [nextItem, ...records];
        created += 1;
        nextState = appendOpsSchoolChangeLog(nextState, nextItem.id, "import_school_create", ["批量 JSON 导入新增学校"], null, opsSchoolAuditSnapshot(nextItem));
      }
    });
    writeOpsAdminState({
      ...nextState,
      opsSection: "school",
      schoolView: "edit",
      schoolRecords: records,
      selectedSchoolId: importedIds[0] || state.selectedSchoolId,
      schoolEditorTab: "basic",
      schoolImportOpen: false,
      schoolImportText: text,
      schoolImportPreview: { tone: "success", message: `导入完成：新增 ${created}，更新 ${updated}，跳过 0。` },
      lastAction: "已批量导入学校 JSON",
      auditItems: [`已批量导入学校 JSON：新增 ${created}，更新 ${updated}`, ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsSchoolSection(`导入完成：新增 ${created}，更新 ${updated}，跳过 0。`);
  } catch (error) {
    writeOpsAdminState({
      ...state,
      opsSection: "school",
      schoolView: "catalog",
      schoolImportOpen: true,
      schoolImportText: text,
      schoolImportPreview: { tone: "danger", message: error?.message || "导入失败，请确认 JSON 数组格式。" },
    });
    rerenderOpsSchoolSection("导入失败，请先修正 JSON。");
  }
}

function parseOpsSchoolDisplayGroups(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        key: slugify(parts[0] || `group-${index + 1}`),
        label: parts[0],
        total: Number(parts[1]) || 0,
        visibleCount: parts[2] === undefined ? undefined : Number(parts[2]) || 0,
        hiddenNote: parts.slice(3).join(" | "),
      };
    }
    const [label, body] = splitOpsStructuredLine(line);
    return {
      key: slugify(label || `group-${index + 1}`),
      label: label || `项目分组 ${index + 1}`,
      total: Number(body) || 0,
      hiddenNote: body && Number.isNaN(Number(body)) ? body : "",
    };
  });
}

function parseOpsSchoolTimeline(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [label, body] = splitOpsStructuredLine(line);
    return {
      key: slugify(label || `step-${index + 1}`),
      label: label || `申请步骤 ${index + 1}`,
      dateLabel: body || "",
      description: body ? "" : line,
    };
  });
}

function parseOpsSchoolUpcomingDeadlines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length >= 2) {
      const [programId, programName, degreeLevel, teachingLanguage, applicationRound, deadlineDate, deadlineLabel, daysUntilDeadline, statusLabel] = parts;
      return {
        programId,
        programName,
        ...(degreeLevel ? { degreeLevel } : {}),
        ...(teachingLanguage ? { teachingLanguage } : {}),
        ...(applicationRound ? { applicationRound } : {}),
        ...(deadlineDate ? { deadlineDate } : {}),
        ...(deadlineLabel ? { deadlineLabel } : {}),
        ...(daysUntilDeadline ? { daysUntilDeadline: Number(daysUntilDeadline) || 0 } : {}),
        statusLabel: statusLabel || deadlineLabel || deadlineDate || "待确认",
      };
    }
    const [programName, body] = splitOpsStructuredLine(line);
    return {
      programId: slugify(programName || "program"),
      programName: programName || "Program",
      deadlineLabel: body || "",
      statusLabel: body || "待确认",
    };
  });
}

function normalizeOpsSchoolEditorValues(values, existing = {}) {
  const next = { ...values };
  const quickFacts = { ...(isPlainRecord(existing.quickFacts) ? existing.quickFacts : {}) };
  const detailDisplay = { ...(isPlainRecord(existing.detailDisplay) ? existing.detailDisplay : {}) };
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsLocation")) quickFacts.location = next.quickFactsLocation;
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsRegion")) quickFacts.region = next.quickFactsRegion;
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsTuition")) quickFacts.tuition = next.quickFactsTuition;
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsLivingCost")) quickFacts.livingCost = next.quickFactsLivingCost;
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsAccommodation")) quickFacts.accommodation = next.quickFactsAccommodation;
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsProgramCount")) quickFacts.programCount = next.quickFactsProgramCount;
  if (Object.prototype.hasOwnProperty.call(next, "quickFactsEnglishProgramCount")) quickFacts.englishProgramCount = next.quickFactsEnglishProgramCount;
  if (Object.prototype.hasOwnProperty.call(next, "detailCity")) detailDisplay.city = next.detailCity;
  if (Object.prototype.hasOwnProperty.call(next, "detailRegionLabel")) detailDisplay.regionLabel = next.detailRegionLabel;
  if (Object.prototype.hasOwnProperty.call(next, "detailLivingCostLabel")) detailDisplay.livingCostLabel = next.detailLivingCostLabel;
  if (Object.prototype.hasOwnProperty.call(next, "detailDisplayProgramCount")) detailDisplay.displayProgramCount = next.detailDisplayProgramCount;
  if (Object.prototype.hasOwnProperty.call(next, "detailDisplayUndergraduateCount")) detailDisplay.displayUndergraduateCount = next.detailDisplayUndergraduateCount;
  if (Object.prototype.hasOwnProperty.call(next, "detailVisibleProgramCount")) detailDisplay.visibleProgramCount = next.detailVisibleProgramCount;
  if (Object.prototype.hasOwnProperty.call(next, "detailHiddenProgramNote")) detailDisplay.hiddenProgramNote = next.detailHiddenProgramNote;
  if (Object.prototype.hasOwnProperty.call(next, "detailDisplaySubjectTags")) detailDisplay.displaySubjectTags = splitOpsTextList(next.detailDisplaySubjectTags);
  if (Object.prototype.hasOwnProperty.call(next, "detailProgramFieldTags")) detailDisplay.programFieldTags = splitOpsTextList(next.detailProgramFieldTags);
  if (Object.prototype.hasOwnProperty.call(next, "detailProgramDisplayGroups")) detailDisplay.programDisplayGroups = parseOpsSchoolDisplayGroups(next.detailProgramDisplayGroups);
  if (Object.prototype.hasOwnProperty.call(next, "detailApplicationTimeline")) detailDisplay.applicationTimeline = parseOpsSchoolTimeline(next.detailApplicationTimeline);
  if (Object.prototype.hasOwnProperty.call(next, "upcomingDeadlinesText")) next.upcomingDeadlines = parseOpsSchoolUpcomingDeadlines(next.upcomingDeadlinesText);
  ["languageOfInstruction", "scholarships", "programFields", "featuredPrograms", "fitNotes", "subjectTags", "languageTags", "programSubjectTags", "programQualityIssues", "requiredSubjectTags"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = splitOpsTextList(next[key]);
  });
  if (Object.prototype.hasOwnProperty.call(next, "officialWebsiteUrl")) next.officialWebsite = next.officialWebsiteUrl;
  if (Object.prototype.hasOwnProperty.call(next, "admissionsWebsiteUrl")) next.applicationSystemUrl = next.admissionsWebsiteUrl;
  if (Object.prototype.hasOwnProperty.call(next, "campusHighlights")) next.campusHighlights = splitOpsTextList(next.campusHighlights);
  if (Object.prototype.hasOwnProperty.call(next, "contactNotes")) next.contactNotes = splitOpsTextList(next.contactNotes);
  [
    "quickFactsLocation", "quickFactsRegion", "quickFactsTuition", "quickFactsLivingCost", "quickFactsAccommodation",
    "quickFactsProgramCount", "quickFactsEnglishProgramCount", "detailCity", "detailRegionLabel", "detailLivingCostLabel",
    "detailDisplayProgramCount", "detailDisplayUndergraduateCount", "detailVisibleProgramCount", "detailHiddenProgramNote",
    "detailDisplaySubjectTags", "detailProgramFieldTags", "detailProgramDisplayGroups", "detailApplicationTimeline", "upcomingDeadlinesText",
  ].forEach((key) => delete next[key]);
  if (Object.keys(quickFacts).length) next.quickFacts = quickFacts;
  if (Object.keys(detailDisplay).length) next.detailDisplay = detailDisplay;
  return next;
}

function saveOpsSchoolEditor() {
  const editor = document.querySelector("[data-ops-school-editor]");
  const schoolId = editor?.dataset.schoolId;
  if (!schoolId) return;
  const values = {};
  editor.querySelectorAll("[data-ops-school-field]").forEach((field) => {
    const key = field.dataset.opsSchoolField;
    values[key] = field.type === "checkbox" ? field.checked : field.value;
  });
  const subrecords = collectOpsSchoolSubrecords(editor);
  const numberFields = ["hskMinLevel", "hskChineseMinLevel", "hskChineseMinListening", "hskChineseMinReading", "hskChineseMinWriting", "hskkChineseMinLevel", "englishMinIelts", "englishMinToefl", "yearEstablished", "studentsServed", "quickFactsProgramCount", "quickFactsEnglishProgramCount", "detailDisplayProgramCount", "detailDisplayUndergraduateCount", "detailVisibleProgramCount"];
  numberFields.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) values[key] = values[key] === "" ? "" : Number(values[key]);
  });
  const openedVersion = values.version || Number(editor.dataset.schoolVersion || 1);
  try {
    updateOpsSchoolState((state) => {
      const before = state.schoolRecords.find((school) => String(school.id) === String(schoolId));
      const expectedSchool = assertOpsSchoolExpectedVersion(state, schoolId, openedVersion || before?.version || 1);
      const versionedSubrecords = withOpsSchoolSubrecordVersions(state, schoolId, subrecords);
      const nextVersion = Number(expectedSchool?.version || openedVersion || 1) + 1;
      const touchedFields = [...Object.keys(values), ...Object.keys(subrecords)].slice(0, 12);
      const schoolRecords = state.schoolRecords.map((school) => String(school.id) === String(schoolId) ? {
        ...school,
        ...normalizeOpsSchoolEditorValues(values, school),
        ...applyOpsSchoolSubrecords(school, versionedSubrecords),
        version: nextVersion,
        next: "最近一次修改已保存",
        updatedAt: new Date().toISOString(),
      } : school);
      const after = schoolRecords.find((school) => String(school.id) === String(schoolId));
      return appendOpsSchoolChangeLog({
        ...state,
        schoolRecords,
        schoolView: "edit",
        lastAction: "已保存学校字段",
        auditItems: ["已保存学校字段", ...toArray(state.auditItems)].slice(0, 6),
      }, schoolId, "update_school", touchedFields.map((field) => `更新 ${field}`), opsSchoolAuditSnapshot(before), opsSchoolAuditSnapshot(after));
    });
    setOpsSchoolEditorDirty(false);
    rerenderOpsSchoolSection("学校字段已本地保存，并写入变更记录。");
  } catch (error) {
    if (error?.code === "VERSION_CONFLICT") {
      setOpsSchoolEditorDirty(true);
      showCompletionToast(error.message);
      return;
    }
    rerenderOpsSchoolSection(error?.message || "学校字段保存失败，请检查格式。");
  }
}

function archiveOpsSchool() {
  const editor = document.querySelector("[data-ops-school-editor]");
  const schoolId = editor?.dataset.schoolId;
  if (!schoolId) return;
  if (opsSchoolEditorIsDirty()) {
    setOpsSchoolEditorDirty(true);
    showCompletionToast("当前学校有未保存改动，请先保存修改再归档。");
    return;
  }
  const openedVersion = Number(editor.dataset.schoolVersion || 1);
  try {
    updateOpsSchoolState((state) => {
      const before = state.schoolRecords.find((school) => String(school.id) === String(schoolId));
      const expectedSchool = assertOpsSchoolExpectedVersion(state, schoolId, openedVersion || before?.version || 1);
      const nextVersion = Number(expectedSchool?.version || openedVersion || 1) + 1;
      const schoolRecords = state.schoolRecords.map((school) => String(school.id) === String(schoolId) ? { ...school, status: "已归档", version: nextVersion, next: "已归档，公开目录不展示", updatedAt: new Date().toISOString() } : school);
      const after = schoolRecords.find((school) => String(school.id) === String(schoolId));
      return appendOpsSchoolChangeLog({
        ...state,
        schoolRecords,
        schoolView: "edit",
        lastAction: "已归档学校",
        auditItems: ["已归档学校", ...toArray(state.auditItems)].slice(0, 6),
      }, schoolId, "archive_school", ["状态改为 archived"], opsSchoolAuditSnapshot(before), opsSchoolAuditSnapshot(after));
    });
    rerenderOpsSchoolSection("学校已标记为归档。");
  } catch (error) {
    if (error?.code === "VERSION_CONFLICT") {
      showCompletionToast(error.message);
      return;
    }
    rerenderOpsSchoolSection(error?.message || "学校归档失败，请刷新后重试。");
  }
}

function setOpsSchoolEditorTab(tab) {
  const nextTab = normalizeOpsSchoolTab(tab);
  if (guardOpsSchoolUnsavedSwitch({ tab: nextTab })) return;
  const state = updateOpsSchoolState((current) => ({ ...current, schoolView: "edit", schoolEditorTab: nextTab }));
  syncOpsHashRoute(state);
  const records = readOpsSchoolRecords(state);
  const selectedSchool = getOpsSelectedSchool(records, state);
  const editor = document.querySelector("[data-ops-school-editor]");
  if (editor && selectedSchool) {
    try {
      editor.outerHTML = renderSchoolEditorPanel(selectedSchool, nextTab);
    } catch (error) {
      console.error("CUAC ops school editor tab render failed", error);
      rerenderOpsSchoolSection("学校编辑器已自动恢复。");
    }
  } else {
    rerenderOpsSchoolSection("");
  }
}

function createOpsSchoolScholarshipDraftRecord(sortOrder = 1, schoolId = "") {
  return {
    id: `scholarship-${Date.now()}`,
    version: 1,
    schoolId,
    name: "新奖学金草稿",
    type: "university",
    applicableDegree: "",
    programId: "",
    status: "draft",
    sortOrder,
    applicableProgram: "",
    coverage: "",
    amountText: "",
    requirementText: "",
    deadlineDate: "",
    deadlineLabel: "",
    applicationRound: "",
    scholarshipSlug: "",
    sourceUrl: "",
    sourceLabel: "",
    lastVerifiedAt: "",
    isCsc: false,
    isVerified: false,
  };
}

function addOpsSchoolSubrecord(kind) {
  try {
    const schoolId = document.querySelector("[data-ops-school-editor]")?.dataset.schoolId;
    if (!schoolId) return;
    const config = {
      program: {
        tab: "programs",
        message: "已新增项目草稿。",
        apply: (school) => {
          const programs = toRecordArray(school.programs);
          return { ...school, programs: [...programs, { id: `program-${Date.now()}`, version: 1, schoolId: school.id, nameZh: "新项目草稿", nameEn: "", degreeLevel: "Master", durationYears: "", fieldCategory: "", teachingLanguage: "English-taught", cscaSubjects: [], cscaRequirement: "", hskRequirement: "", englishRequirement: "", tuitionAmount: "", tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "", scholarshipText: "", openDate: "", deadlineDate: "", deadlineLabel: "", applicationRound: "", applicationUrl: "", applicationNote: "", isVerified: false, hasScholarship: false, badgeText: "", displayTuition: "", displaySubjects: [], displayGroup: "", displayGroupLabel: "", sourceUrl: "", sourceLabel: "", lastVerifiedAt: "", sortOrder: programs.length + 1, status: "draft" }] };
        },
      },
      rule: {
        tab: "admissions",
        message: "已新增 CSCA 规则草稿。",
        apply: (school) => {
          const rules = toRecordArray(school.cscaRules);
          return { ...school, cscaRules: [...rules, { id: `rule-${Date.now()}`, version: 1, schoolId: school.id, title: "新规则草稿", category: "general", scope: "全校", programId: "", cscaSubjects: [], applicablePrograms: [], languageCondition: "", description: "待补充规则说明", importantNote: "", sourceUrl: "", sourceLabel: "待补充", lastVerifiedAt: "", sortOrder: rules.length + 1, status: "draft", isVerified: false }] };
        },
      },
      scholarship: {
        tab: "scholarships",
        message: "已新增学校奖学金草稿。",
        apply: (school) => {
          const scholarships = toRecordArray(school.scholarshipsDetailed);
          return { ...school, scholarshipsDetailed: [...scholarships, createOpsSchoolScholarshipDraftRecord(scholarships.length + 1, school.id)] };
        },
      },
    }[kind];
    if (!config) return;
    let createdRecordId = "";
    const nextState = updateOpsSchoolState((state) => {
      const records = readOpsSchoolRecords(state);
      const before = records.find((school) => String(school.id) === String(schoolId));
      const schoolRecords = records.map((school) => String(school.id) === String(schoolId) ? config.apply(school) : school);
      const after = schoolRecords.find((school) => String(school.id) === String(schoolId));
      if (kind === "scholarship") createdRecordId = toRecordArray(after?.scholarshipsDetailed).slice(-1)[0]?.id || "";
      return appendOpsSchoolChangeLog({
        ...state,
        selectedSchoolId: schoolId,
        opsSection: "school",
        schoolView: "edit",
        schoolEditorTab: config.tab,
        schoolRecords,
        lastAction: config.message,
        auditItems: [config.message, ...toArray(state.auditItems)].slice(0, 6),
      }, schoolId, `create_${kind}`, [config.message], opsSchoolAuditSnapshot(before), opsSchoolAuditSnapshot(after));
    });
    if (!refreshOpsSchoolEditorOnly(nextState, schoolId, config.tab, config.message)) {
      rerenderOpsSchoolSection(config.message);
    }
    assertOpsSchoolSubrecordDraftVisible(kind, kind === "scholarship" ? "新奖学金草稿" : "");
    scheduleOpsSchoolEditorIntegrityCheck(kind, kind === "scholarship" ? "新奖学金草稿" : "", createdRecordId);
  } catch (error) {
    console.error("CUAC ops school subrecord create failed", error);
    const schoolId = document.querySelector("[data-ops-school-editor]")?.dataset.schoolId || "";
    const state = readOpsAdminState();
    const records = readOpsSchoolRecords(state);
    const schoolRecords = records.map((school) => {
      if (String(school.id) !== String(schoolId)) return school;
      return kind === "scholarship"
        ? { ...school, scholarshipsDetailed: [createOpsSchoolScholarshipDraftRecord(1, school.id)] }
        : school;
    });
    writeOpsAdminState({
      ...state,
      selectedSchoolId: schoolId || state.selectedSchoolId,
      opsSection: "school",
      schoolView: "edit",
      schoolEditorTab: kind === "scholarship" ? "scholarships" : activeOpsSchoolTab(state),
      schoolRecords,
      lastAction: "已恢复学校奖学金草稿",
      auditItems: ["已恢复学校奖学金草稿", ...toArray(state.auditItems)].slice(0, 6),
    });
    const recoveredState = readOpsAdminState();
    if (!refreshOpsSchoolEditorOnly(recoveredState, schoolId || recoveredState.selectedSchoolId, kind === "scholarship" ? "scholarships" : activeOpsSchoolTab(recoveredState), "新增学校奖学金时发现旧预览状态，已隔离并恢复一个可编辑草稿。")) {
      rerenderOpsSchoolSection("新增学校奖学金时发现旧预览状态，已隔离并恢复一个可编辑草稿。");
    }
    ensureOpsSchoolEditorRendered(kind, "新奖学金草稿");
    scheduleOpsSchoolEditorIntegrityCheck(kind, "新奖学金草稿");
  }
}

function handleOpsSubrecordAction(action, trigger) {
  const recordEl = trigger?.closest("[data-ops-subrecord]");
  const editor = trigger?.closest("[data-ops-school-editor]");
  const schoolId = editor?.dataset.schoolId;
  const { kind, record } = collectOpsSingleSubrecord(recordEl);
  const storageKey = opsSubrecordStorageKey(kind);
  if (!schoolId || !storageKey || !record) return;
  if (action === "archive" && opsSchoolEditorIsDirty()) {
    setOpsSchoolEditorDirty(true);
    showCompletionToast("当前子记录有未保存改动，请先保存此条再归档。");
    return;
  }
  const label = opsSubrecordActionLabel(kind, action);
  const state = readOpsAdminState();
  let expectedRecord = null;
  try {
    expectedRecord = assertOpsSchoolSubrecordExpectedVersion(state, schoolId, kind, record.id, record.expectedVersion || record.version || 1);
  } catch (error) {
    if (error?.code === "VERSION_CONFLICT") {
      if (action === "save") setOpsSchoolEditorDirty(true);
      showCompletionToast(error.message);
      return;
    }
    throw error;
  }
  const nextVersion = Number(expectedRecord?.version || record.expectedVersion || record.version || 1) + 1;
  const { expectedVersion, ...recordForSave } = record;
  const nextRecord = {
    ...recordForSave,
    version: nextVersion,
    status: action === "archive" ? "archived" : (record.status || "draft"),
    updatedAt: new Date().toISOString(),
  };
  updateOpsSchoolState((state) => {
    const records = readOpsSchoolRecords(state);
    const before = records.find((school) => String(school.id) === String(schoolId));
    const schoolRecords = records.map((school) => {
      if (String(school.id) !== String(schoolId)) return school;
      const rows = toRecordArray(school[storageKey]);
      const existingById = new Map(rows.map((item) => [String(item.id), item]));
      const nextRows = rows.some((item) => String(item.id) === String(record.id))
        ? rows.map((item) => String(item.id) === String(record.id) ? { ...(existingById.get(String(record.id)) || {}), ...nextRecord } : item)
        : [...rows, nextRecord];
      return { ...school, [storageKey]: nextRows, next: label, updatedAt: new Date().toISOString() };
    });
    const after = schoolRecords.find((school) => String(school.id) === String(schoolId));
    return appendOpsSchoolChangeLog({
      ...state,
      selectedSchoolId: schoolId,
      schoolView: "edit",
      schoolEditorTab: kind === "rules" ? "admissions" : kind,
      schoolRecords,
      lastAction: label,
      auditItems: [label, ...toArray(state.auditItems)].slice(0, 6),
    }, schoolId, `${action}_${kind}`, [label, `${kind} #${record.id}`], opsSchoolAuditSnapshot(before), opsSchoolAuditSnapshot(after));
  });
  setOpsSchoolEditorDirty(false);
  rerenderOpsSchoolSection(`${label}，并写入学校变更记录。`);
}

function applyOpsSchoolFilters() {
  const search = document.querySelector("[data-ops-school-search]")?.value || "";
  const filter = document.querySelector("[data-ops-school-filter]")?.value || "all";
  updateOpsSchoolState((state) => ({ ...state, schoolView: "catalog", schoolSearch: search, schoolFilter: filter }));
  rerenderOpsSchoolSection("学校目录筛选已更新。");
}

function clearOpsContentFilters(state) {
  return {
    ...state,
    contentSearch: "",
    contentStatusFilter: "all",
  };
}

function rerenderOpsContentSection(message) {
  const state = readOpsAdminState();
  if (state.opsSection !== "content") writeOpsAdminState({ ...state, opsSection: "content" });
  renderOpsPage();
  switchOpsSection("content");
  if (message) showCompletionToast(message);
  ensureOpsPageNotBlank("内容管理重绘后主区域为空");
}

function ensureOpsContentEditorRendered(type, draftId, label) {
  if (mode !== "ops") return;
  const currentState = readOpsAdminState();
  if (activeOpsSection(currentState) !== "content" || normalizeOpsContentType(currentState.contentType) !== normalizeOpsContentType(type)) return;
  const requiredFields = {
    cities: ["nameZh", "contentJsonText"],
    scholarships: ["title", "schoolIds"],
    timeline: ["month", "applicationWindow", "cscaWindow"],
  };
  const hasRequiredFields = (editor, contentType) => (requiredFields[contentType] || [])
    .every((key) => Boolean(editor?.querySelector(`[data-ops-content-field="${key}"]`)));
  const root = document.querySelector("[data-detail-root]");
  const editor = [...document.querySelectorAll("[data-ops-content-editor]")].find((node) => node.dataset.contentType === type);
  const panel = editor?.closest('[data-ops-section="content"]');
  const hasDraftCopy = !label || Boolean(root?.textContent?.includes(label));
  if (editor && panel && !panel.hidden) {
    const hasDraftIdentity = hasDraftCopy || String(editor.dataset.contentId || "") === String(draftId || "");
    if (hasDraftIdentity && hasRequiredFields(editor, type)) return;
  }
  const state = readOpsAdminState();
  const fallbackId = draftId || `${type === "cities" ? "city" : type === "timeline" ? "timeline" : "scholarship"}-${Date.now()}`;
  const now = new Date().toISOString();
  if (type === "cities") {
    const draft = normalizeOpsCityRecord({ id: fallbackId, slug: fallbackId, nameZh: "新城市草稿", status: "draft", sortOrder: 1, version: 1, createdAt: now, updatedAt: now }, 0, { useFallback: false });
    writeOpsAdminState({
      ...clearOpsContentFilters(state),
      opsSection: "content",
      contentType: "cities",
      contentView: "edit",
      selectedCityGuideId: fallbackId,
      cityGuideRecords: [draft],
      lastAction: "已自动恢复城市指南草稿",
      auditItems: ["已自动恢复城市指南草稿", ...toArray(state.auditItems)].slice(0, 6),
    });
    renderOpsPage();
    switchOpsSection("content");
    showCompletionToast("新增城市已自动恢复为可编辑草稿。");
    return;
  }
  if (type === "timeline") {
    const draft = createOpsTimelineDraftRecord(fallbackId, 1);
    writeOpsAdminState({
      ...clearOpsContentFilters(state),
      opsSection: "content",
      contentType: "timeline",
      contentView: "edit",
      selectedTimelineWindowId: fallbackId,
      timelineWindowRecords: [draft],
      lastAction: "已自动恢复申请时间窗草稿",
      auditItems: ["已自动恢复申请时间窗草稿", ...toArray(state.auditItems)].slice(0, 6),
    });
    renderOpsPage();
    switchOpsSection("content");
    showCompletionToast("新增时间窗已自动恢复为可编辑草稿。");
    return;
  }
  const existingScholarshipRecords = readOpsScholarshipRecords(state)
    .filter((item) => String(item.id) !== String(fallbackId));
  const draft = createOpsPublicScholarshipDraftRecord(fallbackId, existingScholarshipRecords.length + 1);
  writeOpsAdminState({
    ...clearOpsContentFilters(state),
    opsSection: "content",
    contentType: "scholarships",
    contentView: "edit",
    selectedPublicScholarshipId: fallbackId,
    publicScholarshipRecords: [draft, ...existingScholarshipRecords].map((item, index) => normalizeOpsScholarshipRecord(item, index, { useFallback: false })),
    lastAction: "已自动恢复公共奖学金草稿",
    auditItems: ["已自动恢复公共奖学金草稿", ...toArray(state.auditItems)].slice(0, 6),
  });
  renderOpsPage();
  switchOpsSection("content");
  showCompletionToast("新增奖学金已自动恢复为可编辑草稿。");
}

function forceOpsContentEditorRendered(type, draftId, label) {
  if (mode !== "ops") return;
  const nextType = normalizeOpsContentType(type);
  const state = readOpsAdminState();
  writeOpsAdminState({ ...state, opsSection: "content", contentType: nextType, contentView: "edit" });
  renderOpsPage();
  switchOpsSection("content", { persist: false, scroll: false });
  ensureOpsContentEditorRendered(nextType, draftId, label);
}

function scheduleOpsContentEditorIntegrityCheck(type, draftId, label) {
  if (mode !== "ops") return;
  const verify = () => ensureOpsContentEditorRendered(type, draftId, label);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(verify);
  setTimeout(verify, 80);
  setTimeout(verify, 240);
}

function scheduleOpsContentClickGuard(type, draftId = "") {
  if (mode !== "ops") return;
  const guardToken = ++opsContentCreateGuardToken;
  const contentType = normalizeOpsContentType(type || readOpsAdminState().contentType || "scholarships");
  const labels = {
    cities: "新城市草稿",
    scholarships: "新公共奖学金草稿",
    timeline: "新申请时间窗草稿",
  };
  const requiredFields = {
    cities: ["nameZh", "contentJsonText"],
    scholarships: ["title", "schoolIds"],
    timeline: ["month", "applicationWindow", "cscaWindow"],
  };
  const verify = () => {
    if (guardToken !== opsContentCreateGuardToken) return;
    const state = readOpsAdminState();
    if (activeOpsSection(state) !== "content" || normalizeOpsContentType(state.contentType) !== contentType) return;
    const panel = document.querySelector('[data-ops-section="content"]');
    const editor = document.querySelector(`[data-ops-content-editor][data-content-type="${contentType}"]`);
    const fieldsReady = (requiredFields[contentType] || []).every((key) => Boolean(editor?.querySelector(`[data-ops-content-field="${key}"]`)));
    const labelReady = Boolean(document.body.textContent.includes(labels[contentType]));
    const hasWork = Boolean(panel && !panel.hidden && editor && fieldsReady && labelReady && !document.querySelector(".ops-error-state") && panel.textContent.trim().length > 1000);
    if (!hasWork) forceOpsContentEditorRendered(contentType, draftId, labels[contentType]);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(verify);
  setTimeout(verify, 80);
  setTimeout(verify, 240);
}

function assertOpsContentDraftVisible(type, draftId, label) {
  if (mode !== "ops") return;
  ensureOpsContentEditorRendered(type, draftId, label);
  const panel = document.querySelector('[data-ops-section="content"]');
  const editor = document.querySelector(`[data-ops-content-editor][data-content-type="${type}"]`);
  const hasEditor = Boolean(panel && !panel.hidden && editor && document.querySelector("[data-ops-content-save]"));
  const hasDraftCopy = !label || Boolean(document.body.textContent.includes(label));
  if (hasEditor && hasDraftCopy) return;
  if (type === "scholarships") {
    const recoveredId = recoverOpsPublicScholarshipDraftState("已从新增奖学金空白状态自动恢复草稿");
    rerenderOpsContentSection("新增奖学金已自动恢复为可编辑草稿。");
    ensureOpsContentEditorRendered("scholarships", recoveredId, "新公共奖学金草稿");
    return;
  }
  ensureOpsPageNotBlank(`新增${opsContentCreateLabel(type)}后内容面板为空`);
}

function switchOpsContentType(type) {
  const nextType = normalizeOpsContentType(type);
  opsContentCreateGuardToken += 1;
  const state = readOpsAdminState();
  const nextState = { ...state, opsSection: "content", contentType: nextType, contentView: "catalog" };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  renderOpsPage();
  switchOpsSection("content", { persist: false, scroll: false });
  scheduleOpsContentTypeGuard(nextType);
}

function switchOpsContentView(view) {
  const nextView = normalizeOpsContentView(view);
  const state = readOpsAdminState();
  const nextState = { ...state, opsSection: "content", contentView: nextView };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  renderOpsPage();
  switchOpsSection("content", { persist: false, scroll: false });
  ensureOpsPageNotBlank("内容数据视图切换后主区域为空");
}

function ensureOpsContentTypeRendered(type) {
  if (mode !== "ops") return;
  const nextType = normalizeOpsContentType(type);
  const state = readOpsAdminState();
  if (activeOpsSection(state) !== "content") return;
  const panel = document.querySelector('[data-ops-section="content"]');
  const activeTab = document.querySelector("[data-ops-content-tab].active")?.dataset.opsContentTab || "";
  const createType = document.querySelector("[data-ops-content-create]")?.dataset.contentType || "";
  const hasUsablePanel = Boolean(panel && !panel.hidden
    && activeTab === nextType
    && createType === nextType
    && !document.querySelector(".ops-error-state")
    && panel.textContent.trim().length > 200);
  if (hasUsablePanel) return;
  writeOpsAdminState({ ...state, opsSection: "content", contentType: nextType });
  renderOpsPage();
  switchOpsSection("content", { persist: false, scroll: false });
}

function scheduleOpsContentTypeGuard(type) {
  if (mode !== "ops") return;
  const nextType = normalizeOpsContentType(type);
  const guardToken = ++opsContentTypeGuardToken;
  const verify = () => ensureOpsContentTypeRendered(nextType);
  const guardedVerify = () => {
    if (guardToken !== opsContentTypeGuardToken) return;
    verify();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(guardedVerify);
  setTimeout(guardedVerify, 80);
  setTimeout(guardedVerify, 240);
}

function selectOpsContent(type, id) {
  const nextType = normalizeOpsContentType(type);
  const stateKey = opsContentStateKey(nextType);
  const state = readOpsAdminState();
    writeOpsAdminState({ ...state, opsSection: "content", contentType: nextType, contentView: "edit", [stateKey]: id, lastAction: "已打开内容记录编辑器" });
  rerenderOpsContentSection("已打开内容记录编辑器。");
}

function openOpsContentRecordView(type, id, view = "edit") {
  const nextType = normalizeOpsContentType(type);
  const nextView = normalizeOpsContentView(view);
  const stateKey = opsContentStateKey(nextType);
  const state = readOpsAdminState();
  const nextState = {
    ...state,
    opsSection: "content",
    contentType: nextType,
    contentView: nextView,
    [stateKey]: id,
    lastAction: `已打开${opsContentDisplayLabel(nextType)}${opsContentViews.find(([key]) => key === nextView)?.[1] || "编辑"}视图`,
  };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  renderOpsPage();
  switchOpsSection("content", { persist: false, scroll: false });
  ensureOpsPageNotBlank("内容记录视图打开后主区域为空");
}

function applyOpsContentFilters() {
  const state = readOpsAdminState();
  const search = document.querySelector("[data-ops-content-search]")?.value || "";
  const statusFilter = document.querySelector("[data-ops-content-status-filter]")?.value || "all";
  writeOpsAdminState({
    ...state,
    opsSection: "content",
    contentView: "catalog",
    contentSearch: search,
    contentStatusFilter: statusFilter,
    lastAction: "已筛选内容数据",
    auditItems: [`已筛选内容数据：${[search || "全部内容", statusFilter].join(" / ")}`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsContentSection("内容数据筛选已应用。");
}

function createOpsContentDraft(forcedType = "") {
  let requestedType = "scholarships";
  try {
    opsContentTypeGuardToken += 1;
    const state = readOpsAdminState();
    const type = normalizeOpsContentType(forcedType || state.contentType || "scholarships");
    requestedType = type;
    const draftId = `${type === "cities" ? "city" : type === "timeline" ? "timeline" : "scholarship"}-${Date.now()}`;
    const now = new Date().toISOString();
    if (type === "cities") {
      const records = readOpsCityRecords(state);
      const draft = normalizeOpsCityRecord({
        id: draftId,
        slug: draftId,
        nameZh: "新城市草稿",
        nameEn: "",
        region: "",
        monthlyCost: "",
        status: "draft",
        sortOrder: records.length + 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }, records.length, { useFallback: false });
      writeOpsAdminState({
        ...clearOpsContentFilters(state),
        opsSection: "content",
        contentType: "cities",
        contentView: "edit",
        selectedCityGuideId: draftId,
        cityGuideRecords: [draft, ...records].map((item, index) => normalizeOpsCityRecord(item, index, { useFallback: false })),
        lastAction: "已新增城市指南草稿",
        auditItems: ["已新增城市指南草稿", ...toArray(state.auditItems)].slice(0, 6),
      });
      rerenderOpsContentSection("已新增城市指南草稿。");
      assertOpsContentDraftVisible("cities", draftId, "新城市草稿");
      scheduleOpsContentEditorIntegrityCheck("cities", draftId, "新城市草稿");
      return draftId;
    }
    if (type === "timeline") {
      const records = readOpsTimelineRecords(state);
      const draft = createOpsTimelineDraftRecord(draftId, records.length + 1);
      const cleanRecords = [draft, ...records].map((item, index) => normalizeOpsTimelineRecord(item, index, { useFallback: false }));
      writeOpsAdminState({
        ...clearOpsContentFilters(state),
        opsSection: "content",
        contentType: "timeline",
        contentView: "edit",
        selectedTimelineWindowId: draftId,
        timelineWindowRecords: cleanRecords,
        lastAction: "已新增申请时间窗草稿",
        auditItems: ["已新增申请时间窗草稿", ...toArray(state.auditItems)].slice(0, 6),
      });
      rerenderOpsContentSection("已新增申请时间窗草稿。");
      assertOpsContentDraftVisible("timeline", draftId, "新申请时间窗草稿");
      scheduleOpsContentEditorIntegrityCheck("timeline", draftId, "新申请时间窗草稿");
      return draftId;
    }
    const records = readOpsScholarshipRecords(state);
    const draft = createOpsPublicScholarshipDraftRecord(draftId, records.length + 1);
    const cleanRecords = [draft, ...records].map((item, index) => normalizeOpsScholarshipRecord(item, index, { useFallback: false }));
    writeOpsAdminState({
      ...clearOpsContentFilters(state),
      opsSection: "content",
      contentType: "scholarships",
      contentView: "edit",
      selectedPublicScholarshipId: draftId,
      publicScholarshipRecords: cleanRecords,
      lastAction: "已新增公共奖学金草稿",
      auditItems: ["已新增公共奖学金草稿", ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsContentSection("已新增公共奖学金草稿。");
    assertOpsContentDraftVisible("scholarships", draftId, "新公共奖学金草稿");
    scheduleOpsContentEditorIntegrityCheck("scholarships", draftId, "新公共奖学金草稿");
    return draftId;
  } catch (error) {
    console.error("CUAC ops content draft create failed", error);
    if (requestedType === "cities") {
      const draftId = `city-${Date.now()}`;
      const now = new Date().toISOString();
      const draft = normalizeOpsCityRecord({ id: draftId, slug: draftId, nameZh: "新城市草稿", status: "draft", sortOrder: 1, version: 1, createdAt: now, updatedAt: now }, 0, { useFallback: false });
      const state = readOpsAdminState();
      writeOpsAdminState({
        ...clearOpsContentFilters(state),
        opsSection: "content",
        contentType: "cities",
        contentView: "edit",
        selectedCityGuideId: draftId,
        cityGuideRecords: [draft],
        lastAction: "已恢复城市指南草稿",
        auditItems: ["已恢复城市指南草稿", ...toArray(state.auditItems)].slice(0, 6),
      });
      rerenderOpsContentSection("新增城市时发现旧预览状态，已隔离并恢复一个可编辑草稿。");
      return draftId;
    }
    if (requestedType === "timeline") {
      const draftId = `timeline-${Date.now()}`;
      const draft = createOpsTimelineDraftRecord(draftId, 1);
      const state = readOpsAdminState();
      writeOpsAdminState({
        ...clearOpsContentFilters(state),
        opsSection: "content",
        contentType: "timeline",
        contentView: "edit",
        selectedTimelineWindowId: draftId,
        timelineWindowRecords: [draft],
        lastAction: "已恢复申请时间窗草稿",
        auditItems: ["已恢复申请时间窗草稿", ...toArray(state.auditItems)].slice(0, 6),
      });
      rerenderOpsContentSection("新增时间窗时发现旧预览状态，已隔离并恢复一个可编辑草稿。");
      return draftId;
    }
    const draftId = `scholarship-${Date.now()}`;
    const draft = createOpsPublicScholarshipDraftRecord(draftId, 1);
    const state = readOpsAdminState();
    writeOpsAdminState({
      ...clearOpsContentFilters(state),
      opsSection: "content",
      contentType: "scholarships",
      contentView: "edit",
      selectedPublicScholarshipId: draftId,
      publicScholarshipRecords: [draft],
      lastAction: "已恢复公共奖学金草稿",
      auditItems: ["已恢复公共奖学金草稿", ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsContentSection("新增奖学金时发现旧预览状态，已隔离并恢复一个可编辑草稿。");
    assertOpsContentDraftVisible("scholarships", draftId, "新公共奖学金草稿");
    return draftId;
  }
}

function readOpsScholarshipImportText() {
  return document.querySelector("[data-ops-scholarship-import-text]")?.value || readOpsAdminState().scholarshipImportText || createOpsScholarshipImportExample();
}

function setOpsScholarshipImportOpen(open) {
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "content",
    contentType: "scholarships",
    contentView: "catalog",
    scholarshipImportOpen: open,
    scholarshipImportText: readOpsScholarshipImportText(),
    scholarshipImportPreview: null,
  });
  rerenderOpsContentSection("");
}

function setOpsScholarshipImportExample() {
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "content",
    contentType: "scholarships",
    contentView: "catalog",
    scholarshipImportOpen: true,
    scholarshipImportText: createOpsScholarshipImportExample(),
    scholarshipImportPreview: null,
  });
  rerenderOpsContentSection("已填入 CSCAlite 公共奖学金导入示例。");
}

function previewOpsScholarshipImport() {
  const state = readOpsAdminState();
  const text = readOpsScholarshipImportText();
  try {
    const items = parseOpsScholarshipImportItems(text);
    writeOpsAdminState({
      ...state,
      opsSection: "content",
      contentType: "scholarships",
      contentView: "catalog",
      scholarshipImportOpen: true,
      scholarshipImportText: text,
      scholarshipImportPreview: { tone: "success", message: `已识别 ${items.length} 条公共奖学金，可以导入。` },
    });
    rerenderOpsContentSection("公共奖学金 JSON 校验通过。");
  } catch (error) {
    writeOpsAdminState({
      ...state,
      opsSection: "content",
      contentType: "scholarships",
      contentView: "catalog",
      scholarshipImportOpen: true,
      scholarshipImportText: text,
      scholarshipImportPreview: { tone: "danger", message: error?.message || "JSON 格式暂时无法解析。" },
    });
    rerenderOpsContentSection("公共奖学金 JSON 校验未通过。");
  }
}

function findOpsScholarshipImportIndex(records, item) {
  const byId = records.findIndex((record) => String(record.id || "") === String(item.id || ""));
  if (byId >= 0) return byId;
  const bySlug = records.findIndex((record) => String(record.slug || "") === String(item.slug || ""));
  if (bySlug >= 0) return bySlug;
  return records.findIndex((record) => String(record.title || "") === String(item.title || ""));
}

function applyOpsScholarshipImport() {
  const text = readOpsScholarshipImportText();
  const state = readOpsAdminState();
  try {
    const items = parseOpsScholarshipImportItems(text);
    let records = readOpsScholarshipRecords(state);
    let created = 0;
    let updated = 0;
    const importedIds = [];
    items.forEach((item, index) => {
      const existingIndex = findOpsScholarshipImportIndex(records, item);
      const before = existingIndex >= 0 ? records[existingIndex] : null;
      const nextItem = normalizeOpsScholarshipRecord({
        ...(before || {}),
        ...item,
        version: Number(before?.version || item.version || 1) + (before ? 1 : 0),
        updatedAt: new Date().toISOString(),
        createdAt: before?.createdAt || item.createdAt || new Date().toISOString(),
      }, records.length + index, { useFallback: false });
      importedIds.push(nextItem.id);
      if (existingIndex >= 0) {
        records = records.map((record, recordIndex) => recordIndex === existingIndex ? nextItem : record);
        updated += 1;
      } else {
        records = [nextItem, ...records];
        created += 1;
      }
    });
    writeOpsAdminState({
      ...state,
      opsSection: "content",
      contentType: "scholarships",
      contentView: "catalog",
      publicScholarshipRecords: records,
      selectedPublicScholarshipId: importedIds[0] || state.selectedPublicScholarshipId,
      scholarshipImportOpen: false,
      scholarshipImportText: text,
      scholarshipImportPreview: { tone: "success", message: `导入完成：新增 ${created}，更新 ${updated}，跳过 0。` },
      lastAction: "已批量导入公共奖学金 JSON",
      auditItems: [`已批量导入公共奖学金 JSON：新增 ${created}，更新 ${updated}`, ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsContentSection(`导入完成：新增 ${created}，更新 ${updated}，跳过 0。`);
  } catch (error) {
    writeOpsAdminState({
      ...state,
      opsSection: "content",
      contentType: "scholarships",
      contentView: "catalog",
      scholarshipImportOpen: true,
      scholarshipImportText: text,
      scholarshipImportPreview: { tone: "danger", message: error?.message || "导入失败，请确认 JSON 数组格式。" },
    });
    rerenderOpsContentSection("导入失败，请先修正 JSON。");
  }
}

const opsScholarshipListFields = new Set([
  "bodySections",
  "benefits",
  "benefitItems",
  "eligibilityItems",
  "applicationMaterials",
  "applicationSteps",
  "contactInfo",
  "actionLinks",
  "targetCountries",
  "targetRegions",
  "schoolIds",
  "programIds",
]);

const opsCityContentFields = new Set([
  "summary",
  "overview",
  "bestFor",
  "quickFacts",
  "budgetSummary",
  "costProfiles",
  "why",
  "costBreakdown",
  "lifeSections",
  "transportNotes",
  "applicationTips",
  "applicationAdvice",
  "relatedProgramKeywords",
  "nextSteps",
  "faqs",
  "cityFaqs",
]);

function splitOpsTextList(value) {
  return String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function splitOpsTextLines(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function splitOpsStructuredLine(line) {
  const text = String(line || "").trim();
  const separator = text.match(/\s+-\s+|：|:\s+/);
  if (!separator) return [text, ""];
  const index = separator.index || 0;
  return [text.slice(0, index).trim(), text.slice(index + separator[0].length).trim()];
}

function parseOpsTitleBodyList(lines, titleFallback = "Item") {
  return lines.map((line, index) => {
    const [title, body] = splitOpsStructuredLine(line);
    return body ? { title, body } : { title: `${titleFallback} ${index + 1}`, body: title };
  });
}

function parseOpsCityCostProfiles(lines) {
  return lines.map((line) => {
    const [label, body] = splitOpsStructuredLine(line);
    const [value, note] = splitOpsStructuredLine(body);
    return {
      label: label || "Budget profile",
      value: value || body || label,
      note: note || body || label,
    };
  });
}

function parseOpsCityQuickFacts(lines) {
  return lines.map((line) => {
    const [label, body] = splitOpsStructuredLine(line);
    const [value, note] = splitOpsStructuredLine(body);
    return {
      label: label || "Fact",
      value: value || body || label,
      ...(note ? { note } : {}),
    };
  });
}

function parseOpsCityBudgetSummary(lines) {
  const result = {};
  const notes = [];
  lines.forEach((line) => {
    const [label, body] = splitOpsStructuredLine(line);
    const normalized = label.toLowerCase();
    const value = body || label;
    if (normalized.includes("month") || normalized.includes("月")) result.monthly = value;
    else if (normalized.includes("year") || normalized.includes("年")) result.yearly = value;
    else if (normalized.includes("note") || normalized.includes("说明")) notes.push(value);
    else if (value) notes.push(value);
  });
  return {
    monthly: result.monthly || "",
    yearly: result.yearly || "",
    note: result.note || notes.join("\n") || "",
  };
}

function parseOpsCityContentValue(key, value) {
  if (["summary", "overview"].includes(key)) return value || "";
  const lines = splitOpsTextLines(value);
  if (["bestFor", "why", "transportNotes", "applicationTips", "relatedProgramKeywords"].includes(key)) return lines;
  if (key === "budgetSummary") return parseOpsCityBudgetSummary(lines);
  if (key === "quickFacts") return parseOpsCityQuickFacts(lines);
  if (key === "costProfiles") return parseOpsCityCostProfiles(lines);
  if (["lifeSections", "applicationAdvice", "nextSteps"].includes(key)) return parseOpsTitleBodyList(lines, "Section");
  if (key === "costBreakdown") {
    return lines.map((line) => {
      const [label, body] = splitOpsStructuredLine(line);
      return body ? { label, value: body } : { label: "Cost", value: label };
    });
  }
  if (["faqs", "cityFaqs"].includes(key)) {
    return lines.map((line) => {
      const [question, answer] = splitOpsStructuredLine(line);
      return answer ? { question, answer } : line;
    });
  }
  return lines;
}

function parseOpsScholarshipInfoItems(value) {
  return splitOpsTextList(value).map((line) => {
    const [label, body] = splitOpsStructuredLine(line);
    return body ? { label, body } : { label };
  });
}

function parseOpsScholarshipBenefitItems(value) {
  return splitOpsTextList(value).map((line) => {
    const [label, note] = splitOpsStructuredLine(line);
    return { label, included: true, ...(note ? { note } : {}) };
  });
}

function parseOpsScholarshipActionLinks(value) {
  return splitOpsTextList(value).map((line) => {
    const parts = String(line || "").split(/\s+\|\s+/).map((item) => item.trim()).filter(Boolean);
    const [labelPart, urlPart, kindPart] = parts;
    const [label, urlFromDash] = splitOpsStructuredLine(labelPart || "");
    return {
      label: label || "Link",
      ...(urlPart || urlFromDash ? { url: urlPart || urlFromDash } : {}),
      ...(kindPart ? { kind: kindPart } : {}),
    };
  });
}

function parseOpsScholarshipContactInfo(value) {
  const lines = splitOpsTextList(value);
  const result = {};
  lines.forEach((line) => {
    const [label, body] = splitOpsStructuredLine(line);
    const normalized = label.toLowerCase();
    const nextValue = body || label;
    if (!nextValue) return;
    if (normalized.includes("email") || normalized.includes("邮箱")) result.email = nextValue;
    else if (normalized.includes("phone") || normalized.includes("tel") || normalized.includes("电话")) result.phone = nextValue;
    else if (normalized.includes("web") || normalized.includes("url") || normalized.includes("网站")) result.website = nextValue;
    else if (normalized.includes("address") || normalized.includes("地址")) result.address = nextValue;
    else if (normalized.includes("name") || normalized.includes("联系人")) result.name = nextValue;
    else if (normalized.includes("note") || normalized.includes("备注")) result.note = nextValue;
    else if (!result.label) result.label = nextValue;
    else result.note = [result.note, nextValue].filter(Boolean).join("; ");
  });
  return Object.keys(result).length ? result : undefined;
}

function parseOpsMixedIdList(value) {
  return splitOpsTextList(value).map((item) => {
    const text = String(item ?? "").trim();
    return /^\d+$/.test(text) ? Number(text) : text;
  });
}

function parseOpsScholarshipContentValue(key, value) {
  const lines = splitOpsTextList(value);
  if (["schoolIds", "programIds"].includes(key)) return parseOpsMixedIdList(value);
  if (["targetCountries", "targetRegions", "benefits"].includes(key)) return lines;
  if (key === "bodySections") return parseOpsTitleBodyList(lines, "Section");
  if (key === "benefitItems") return parseOpsScholarshipBenefitItems(value);
  if (["eligibilityItems", "applicationMaterials", "applicationSteps"].includes(key)) return parseOpsScholarshipInfoItems(value);
  if (key === "contactInfo") return parseOpsScholarshipContactInfo(value);
  if (key === "actionLinks") return parseOpsScholarshipActionLinks(value);
  return lines;
}

function resolveOpsScholarshipSchools(schoolIds = []) {
  const selected = new Set(toArray(schoolIds).map((id) => String(id)));
  if (!selected.size) return [];
  return readOpsSchoolRecords()
    .filter((school) => selected.has(String(school.id)))
    .map((school) => ({
      id: school.id,
      nameZh: school.nameZh,
      nameEn: school.nameEn,
      region: school.cityZh || school.region || school.regionLabel || "",
      status: school.status || "draft",
    }));
}

function resolveOpsScholarshipPrograms(programIds = []) {
  const selected = new Set(toArray(programIds).map((id) => String(id)));
  if (!selected.size) return [];
  return readOpsSchoolRecords().flatMap((school) => toRecordArray(school.programs).filter((program) => selected.has(String(program.id))).map((program) => ({
    id: program.id,
    schoolId: school.id,
    schoolName: school.nameZh || school.nameEn || "",
    nameZh: program.nameZh,
    nameEn: program.nameEn,
    degreeLevel: program.degreeLevel,
    teachingLanguage: program.teachingLanguage,
  })));
}

function normalizeOpsContentValues(type, values, existing = {}) {
  if (type === "timeline") {
    return {
      ...values,
      sortOrder: values.sortOrder === "" ? "" : Number(values.sortOrder ?? existing.sortOrder ?? 1),
      version: values.version === "" ? existing.version || 1 : Number(values.version ?? existing.version ?? 1),
      updatedAt: values.updatedAt || existing.updatedAt || "",
    };
  }
  if (type === "scholarships") {
    const next = { ...values };
    opsScholarshipListFields.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = parseOpsScholarshipContentValue(key, next[key]);
    });
    next.benefits = next.benefits?.length ? next.benefits : next.benefitItems?.length ? next.benefitItems.map((item) => item.label).filter(Boolean) : existing.benefits || [];
    if (!next.benefitItems?.length && next.benefits?.length) next.benefitItems = next.benefits.map((label) => ({ label, included: true }));
    if (Object.prototype.hasOwnProperty.call(next, "schoolIds")) next.schools = resolveOpsScholarshipSchools(next.schoolIds);
    if (Object.prototype.hasOwnProperty.call(next, "programIds")) next.programs = resolveOpsScholarshipPrograms(next.programIds);
    return next;
  }
  let contentJson = { ...(existing.contentJson || existing.content || {}) };
  const hasRawContentJson = Object.prototype.hasOwnProperty.call(values, "contentJsonText");
  if (hasRawContentJson) {
    try {
      const parsed = JSON.parse(values.contentJsonText || "{}");
      contentJson = isPlainRecord(parsed) ? parsed : {};
    } catch {
      throw new Error("CityGuide.content JSON 格式不正确。");
    }
  }
  opsCityContentFields.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const rawValue = values[key];
      if (hasRawContentJson && !String(rawValue || "").trim()) return;
      contentJson[key] = parseOpsCityContentValue(key, rawValue);
    }
  });
  const references = {
    ...(existing.references || {}),
    schoolCount: values.referenceSchoolCount === "" ? undefined : values.referenceSchoolCount,
    programCount: values.referenceProgramCount === "" ? undefined : values.referenceProgramCount,
    englishProgramCount: values.referenceEnglishProgramCount === "" ? undefined : values.referenceEnglishProgramCount,
    scholarshipCount: values.referenceScholarshipCount === "" ? undefined : values.referenceScholarshipCount,
    cscaRequiredSchoolCount: values.referenceCscaSchoolCount === "" ? undefined : values.referenceCscaSchoolCount,
  };
  const next = { ...values };
  delete next.contentJsonText;
  if (Object.prototype.hasOwnProperty.call(next, "tags")) next.tags = splitOpsTextList(next.tags);
  if (Object.prototype.hasOwnProperty.call(next, "nearby")) next.nearby = splitOpsTextList(next.nearby);
  return {
    ...next,
    contentJson,
    content: contentJson,
    references,
    aggregate: existing.aggregate,
    actualSchoolCount: existing.actualSchoolCount,
    actualProgramCount: existing.actualProgramCount,
    actualEnglishProgramCount: existing.actualEnglishProgramCount,
    actualScholarshipCount: existing.actualScholarshipCount,
    actualCscaRequiredSchoolCount: existing.actualCscaRequiredSchoolCount,
    visibleSchools: existing.visibleSchools,
    visiblePrograms: existing.visiblePrograms,
    visibleScholarships: existing.visibleScholarships,
  };
}

function opsContentConflictCopy(type) {
  if (type === "cities") return "城市指南已被其他管理员更新，请刷新后再继续。";
  if (type === "timeline") return "申请时间窗已被其他管理员更新，请刷新后再继续。";
  return "奖学金已被其他管理员更新，请刷新后再继续。";
}

function showOpsContentVersionConflict(editor, message) {
  if (editor) {
    editor.dataset.dirty = "true";
    const warning = editor.querySelector("[data-ops-content-unsaved-warning]");
    if (warning) {
      warning.hidden = false;
      warning.removeAttribute("hidden");
    }
  }
  showCompletionToast(message);
}

function opsContentRecordsForStoredType(state, type) {
  if (type === "cities") return readOpsCityRecords(state);
  if (type === "timeline") return readOpsTimelineRecords(state);
  return readOpsScholarshipRecords(state);
}

function findOpsContentRecordById(state, type, id) {
  return opsContentRecordsForStoredType(state, type).find((item) => String(item.id || item.slug || "") === String(id));
}

function assertOpsContentExpectedVersion(state, type, id, expectedVersion) {
  const current = findOpsContentRecordById(state, type, id);
  if (!current) return null;
  const currentVersion = Number(current.version || 1);
  const expected = Number(expectedVersion || currentVersion);
  if (Number.isFinite(expected) && currentVersion !== expected) {
    const error = new Error(opsContentConflictCopy(type));
    error.code = "VERSION_CONFLICT";
    error.currentVersion = currentVersion;
    throw error;
  }
  return current;
}

function saveOpsContentEditor(trigger = null) {
  const editor = trigger?.closest?.("[data-ops-content-editor]") || currentOpsContentEditor();
  const type = editor?.dataset.contentType;
  const id = editor?.dataset.contentId;
  if (!type || !id) return;
  const values = {};
  editor.querySelectorAll("[data-ops-content-field]").forEach((field) => {
    values[field.dataset.opsContentField] = field.value;
  });
  ["monthlyCost", "referenceSchoolCount", "referenceProgramCount", "referenceEnglishProgramCount", "referenceScholarshipCount", "referenceCscaSchoolCount", "sortOrder"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) values[key] = values[key] === "" ? "" : Number(values[key]);
  });
  const state = readOpsAdminState();
  try {
    const expectedVersion = editor.dataset.recordVersion || findOpsContentRecordById(state, type, id)?.version || 1;
    const expectedRecord = assertOpsContentExpectedVersion(state, type, id, expectedVersion);
    const nextVersion = Number(expectedRecord?.version || expectedVersion || 1) + 1;
    if (type === "cities") {
      const records = readOpsCityRecords(state).map((item) => String(item.id) === String(id) ? { ...item, ...normalizeOpsContentValues(type, values, item), version: nextVersion, updatedAt: new Date().toISOString() } : item);
      writeOpsAdminState({ ...state, cityGuideRecords: records, selectedCityGuideId: id, contentType: "cities", contentView: "edit", lastAction: "已保存城市指南字段", auditItems: ["已保存城市指南字段", ...toArray(state.auditItems)].slice(0, 6) });
      rerenderOpsContentSection("城市指南字段已本地保存，并写入内容审计。");
      return;
    }
    if (type === "timeline") {
      const records = readOpsTimelineRecords(state).map((item) => String(item.id) === String(id) ? { ...item, ...normalizeOpsContentValues(type, values, item), version: nextVersion, updatedAt: new Date().toISOString() } : item);
      writeOpsAdminState({ ...state, timelineWindowRecords: records, selectedTimelineWindowId: id, contentType: "timeline", contentView: "edit", lastAction: "已保存申请时间窗字段", auditItems: ["已保存申请时间窗字段", ...toArray(state.auditItems)].slice(0, 6) });
      rerenderOpsContentSection("申请时间窗字段已本地保存，并写入内容审计。");
      return;
    }
    const records = readOpsScholarshipRecords(state).map((item) => String(item.id) === String(id) ? { ...item, ...normalizeOpsContentValues(type, values, item), version: nextVersion, updatedAt: new Date().toISOString() } : item);
    writeOpsAdminState({ ...state, publicScholarshipRecords: records, selectedPublicScholarshipId: id, contentType: "scholarships", contentView: "edit", lastAction: "已保存公共奖学金字段", auditItems: ["已保存公共奖学金字段", ...toArray(state.auditItems)].slice(0, 6) });
    rerenderOpsContentSection("公共奖学金字段已本地保存，并写入内容审计。");
  } catch (error) {
    if (error?.code === "VERSION_CONFLICT") {
      showOpsContentVersionConflict(editor, error.message);
      return;
    }
    rerenderOpsContentSection(error?.message || "内容字段保存失败，请检查格式。");
  }
}

function syncOpsScholarshipSchoolPicker(trigger) {
  const editor = trigger?.closest("[data-ops-content-editor]");
  if (!editor || editor.dataset.contentType !== "scholarships") return;
  const schoolIdsField = editor.querySelector('[data-ops-content-field="schoolIds"]');
  const checked = [...editor.querySelectorAll("[data-ops-scholarship-school-toggle]:checked")].map((field) => field.value).filter(Boolean);
  if (schoolIdsField) schoolIdsField.value = checked.join("\n");
  editor.querySelectorAll("[data-ops-scholarship-school-toggle]").forEach((field) => {
    field.closest("label")?.classList.toggle("selected", field.checked);
  });
  const count = editor.querySelector("[data-ops-scholarship-school-count]");
  if (count) count.textContent = String(checked.length);
  setOpsContentEditorDirty(true);
}

function syncOpsScholarshipProgramPicker(trigger) {
  const editor = trigger?.closest("[data-ops-content-editor]");
  if (!editor || editor.dataset.contentType !== "scholarships") return;
  const programIdsField = editor.querySelector('[data-ops-content-field="programIds"]');
  const checked = [...editor.querySelectorAll("[data-ops-scholarship-program-toggle]:checked")].map((field) => field.value).filter(Boolean);
  if (programIdsField) programIdsField.value = checked.join("\n");
  editor.querySelectorAll("[data-ops-scholarship-program-toggle]").forEach((field) => {
    field.closest("label")?.classList.toggle("selected", field.checked);
  });
  const count = editor.querySelector("[data-ops-scholarship-program-count]");
  if (count) count.textContent = String(checked.length);
  setOpsContentEditorDirty(true);
}

function updateOpsContentStatus(status, trigger = null) {
  const editor = trigger?.closest?.("[data-ops-content-editor]") || currentOpsContentEditor();
  const type = editor?.dataset.contentType;
  const id = editor?.dataset.contentId;
  if (!type || !id) return;
  if (opsContentEditorIsDirty(editor)) {
    setOpsContentEditorDirty(true, editor);
    showCompletionToast("当前内容有未保存改动，请先保存内容再发布或归档。");
    return;
  }
  const state = readOpsAdminState();
  const label = status === "published" ? "发布" : "归档";
  const expectedVersion = editor.dataset.recordVersion || findOpsContentRecordById(state, type, id)?.version || 1;
  let expectedRecord;
  try {
    expectedRecord = assertOpsContentExpectedVersion(state, type, id, expectedVersion);
  } catch (error) {
    if (error?.code === "VERSION_CONFLICT") {
      showOpsContentVersionConflict(editor, error.message);
      return;
    }
    throw error;
  }
  const nextVersion = Number(expectedRecord?.version || expectedVersion || 1) + 1;
  if (type === "cities") {
    const rawRecords = toOpsContentList(state.cityGuideRecords);
    const records = (rawRecords.length ? rawRecords : readOpsCityRecords(state)).map((item) => String(item?.id || item?.slug) === String(id) ? { ...item, status, version: nextVersion, updatedAt: new Date().toISOString() } : item);
    writeOpsAdminState({
      ...state,
      cityGuideRecords: records,
      selectedCityGuideId: id,
      contentType: "cities",
      contentView: "edit",
      lastAction: `已${label}城市指南`,
      auditItems: [`已${label}城市指南`, ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsContentSection(`城市指南已${label}，并写入内容审计。`);
    return;
  }
  if (type === "timeline") {
    const rawRecords = toOpsContentList(state.timelineWindowRecords);
    const records = (rawRecords.length ? rawRecords : readOpsTimelineRecords(state)).map((item) => String(item?.id || "") === String(id) ? { ...item, status, version: nextVersion, updatedAt: new Date().toISOString() } : item);
    writeOpsAdminState({
      ...state,
      timelineWindowRecords: records,
      selectedTimelineWindowId: id,
      contentType: "timeline",
      contentView: "edit",
      lastAction: `已${label}申请时间窗`,
      auditItems: [`已${label}申请时间窗`, ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsContentSection(`申请时间窗已${label}，并写入内容审计。`);
    return;
  }
  const rawRecords = toOpsContentList(state.publicScholarshipRecords);
  const records = (rawRecords.length ? rawRecords : readOpsScholarshipRecords(state)).map((item) => String(item?.id || item?.slug) === String(id) ? { ...item, status, version: nextVersion, updatedAt: new Date().toISOString() } : item);
  writeOpsAdminState({
    ...state,
    publicScholarshipRecords: records,
    selectedPublicScholarshipId: id,
    contentType: "scholarships",
    contentView: "edit",
    lastAction: `已${label}公共奖学金`,
    auditItems: [`已${label}公共奖学金`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsContentSection(`公共奖学金已${label}，并写入内容审计。`);
}

function updateOpsStudentState(updater) {
  const state = readOpsAdminState();
  const records = readOpsStudentRecords(state);
  const next = updater({ ...state, studentRecords: records }) || state;
  writeOpsAdminState(next);
  return next;
}

function rerenderOpsStudentSection(message) {
  renderOpsPage();
  switchOpsSection("students");
  if (message) showCompletionToast(message);
}

function setOpsStudentDetailTab(tab) {
  const nextTab = normalizeOpsStudentDetailTab(tab);
  const state = updateOpsStudentState((current) => ({ ...current, studentDetailTab: nextTab }));
  syncOpsHashRoute(state);
  renderOpsPage();
  switchOpsSection("students", { persist: false, scroll: false });
  const detail = document.querySelector("[data-ops-student-detail]");
  if (detail) detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return state;
}

function selectOpsStudent(studentId) {
  openOpsStudentRecordTab(studentId, "overview");
}

function openOpsStudentRecordTab(studentId, tab = "overview") {
  const nextTab = normalizeOpsStudentDetailTab(tab);
  const next = updateOpsStudentState((state) => ({
    ...state,
    opsSection: "students",
    selectedStudentId: studentId,
    studentDetailTab: nextTab,
    lastAction: `已打开学生申请${opsStudentDetailTabs.find(([key]) => key === nextTab)?.[1] || "详情"}视图`,
  }));
  syncOpsHashRoute(next);
  rerenderOpsStudentSection(`已打开学生申请：${readOpsStudentRecords(next).find((item) => item.id === studentId)?.name || "学生"}。`);
}

function applyOpsStudentFilters() {
  const search = document.querySelector("[data-ops-student-search]")?.value || "";
  const filter = document.querySelector("[data-ops-student-filter]")?.value || "all";
  updateOpsStudentState((state) => ({ ...state, studentSearch: search, studentFilter: filter }));
  rerenderOpsStudentSection("学生申请筛选已更新。");
}

function applyOpsStudentQuickFilter(filter) {
  const nextFilter = filter || "all";
  updateOpsStudentState((state) => ({
    ...state,
    studentSearch: "",
    studentFilter: nextFilter,
    lastAction: `已筛选学生申请：${nextFilter === "all" ? "全部状态" : nextFilter}`,
  }));
  rerenderOpsStudentSection(`已筛选学生申请：${nextFilter === "all" ? "全部状态" : nextFilter}。`);
}

function collectOpsStudentEditorValues() {
  const values = {};
  document.querySelectorAll("[data-ops-student-field]").forEach((field) => {
    const key = field.dataset.opsStudentField;
    if (!key) return;
    values[key] = field.type === "number" ? Number(field.value || 0) : field.value;
  });
  return values;
}

function saveOpsStudentEditor() {
  const studentId = document.querySelector("[data-ops-student-detail]")?.dataset.studentId;
  if (!studentId) return;
  const values = collectOpsStudentEditorValues();
  updateOpsStudentState((state) => ({
    ...state,
    studentRecords: state.studentRecords.map((student) => student.id === studentId ? {
      ...student,
      ...values,
      accountUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      timeline: ["运营已保存学生申请资料", ...toArray(student.timeline)].slice(0, 5),
    } : student),
    selectedStudentId: studentId,
    lastAction: "已保存学生申请资料",
    auditItems: ["已保存学生申请资料", ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsStudentSection("学生申请资料已保存，并写入运营审计。");
}

function exportOpsStudentsCsv() {
  const state = readOpsAdminState();
  const records = filterOpsStudents(readOpsStudentRecords(state), state);
  const csv = createOpsStudentCsv(records);
  writeOpsAdminState({
    ...state,
    studentExportCsv: csv,
    studentExportCount: records.length,
    studentExportGeneratedAt: new Date().toISOString(),
    lastAction: "已生成学生申请 CSV 汇总",
    auditItems: [`已生成学生申请 CSV 汇总：${records.length} 条`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsStudentSection(`已生成学生申请 CSV 汇总：${records.length} 条。`);
}

function collapseOpsStudentExport() {
  const state = readOpsAdminState();
  writeOpsAdminState({ ...state, studentExportCsv: "", studentExportCount: 0 });
  rerenderOpsStudentSection("");
}

function downloadOpsStudentsCsv() {
  const state = readOpsAdminState();
  const csv = state.studentExportCsv || createOpsStudentCsv(filterOpsStudents(readOpsStudentRecords(state), state));
  const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cuac-student-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  recordOpsAudit("学生申请 CSV 已下载", { studentExportCsv: csv, studentExportCount: state.studentExportCount || filterOpsStudents(readOpsStudentRecords(state), state).length });
  rerenderOpsStudentSection("学生申请 CSV 已下载。");
}

function recordOpsAudit(label, extra = {}) {
  const state = readOpsAdminState();
  const auditItems = [label, ...toArray(state.auditItems)].slice(0, 6);
  const next = {
    ...state,
    ...extra,
    lastAction: label,
    auditItems,
    updatedAt: new Date().toISOString(),
  };
  writeOpsAdminState(next);
  return next;
}

function handleOpsStudentAction(action) {
  const studentId = document.querySelector("[data-ops-student-detail]")?.dataset.studentId;
  if (!studentId) return;
  const actionMap = {
    contacted: {
      message: "已标记学生跟进完成",
      update: (student) => ({
        ...student,
        status: "学校已联系",
        next: "等待学校记录后续结果",
        timeline: ["运营已标记学校联系完成", ...toArray(student.timeline)].slice(0, 5),
      }),
    },
    resend: {
      message: "已加入学校通知重发队列",
      update: (student) => ({
        ...student,
        next: "学校通知重发队列处理中",
        timeline: ["运营已请求重发学校通知", ...toArray(student.timeline)].slice(0, 5),
      }),
    },
    payment: {
      message: "已打开支付核对摘要",
      update: (student) => ({
        ...student,
        timeline: ["运营查看支付核对摘要", ...toArray(student.timeline)].slice(0, 5),
      }),
    },
    "disable-account": {
      message: "已停用学生账号",
      update: (student) => ({
        ...student,
        accountStatus: "disabled",
        accountUpdatedAt: new Date().toISOString(),
        accessScope: "账号停用；学校已接收记录不受影响",
        agentAccessStatus: "账号暂停",
        agentMemoryState: "暂停写入",
        next: "账号已停用，等待运营复核",
        timeline: ["运营已停用学生账号", ...toArray(student.timeline)].slice(0, 5),
      }),
    },
    "restore-account": {
      message: "已恢复学生账号",
      update: (student) => ({
        ...student,
        accountStatus: "active",
        accountUpdatedAt: new Date().toISOString(),
        accessScope: "学生 Hub、申请中心、Agent 长期上下文",
        agentAccessStatus: "免费可用",
        agentMemoryState: "登录后长期保留",
        next: "账号已恢复，可继续申请操作",
        timeline: ["运营已恢复学生账号", ...toArray(student.timeline)].slice(0, 5),
      }),
    },
    "refresh-agent": {
      message: "已恢复学生 Agent 服务",
      update: (student) => ({
        ...student,
        agentAccessStatus: "免费可用",
        agentMemoryState: "登录后长期保留",
        accountUpdatedAt: new Date().toISOString(),
        timeline: ["运营已恢复免费 Agent 申请辅助服务", ...toArray(student.timeline)].slice(0, 5),
      }),
    },
  }[action];
  if (!actionMap) return;
  updateOpsStudentState((state) => ({
    ...state,
    studentRecords: state.studentRecords.map((student) => student.id === studentId ? actionMap.update(student) : student),
    lastAction: actionMap.message,
    auditItems: [actionMap.message, ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsStudentSection(`${actionMap.message}。学生申请状态已本地保存。`);
}

function updateOpsQueueState(updater) {
  const state = readOpsAdminState();
  const records = readOpsQueueRecords(state);
  const next = updater({ ...state, queueRecords: records }) || state;
  writeOpsAdminState(next);
  return next;
}

function rerenderOpsQueueSection(message) {
  renderOpsPage();
  switchOpsSection("queue");
  if (message) showCompletionToast(message);
}

function setOpsQueueView(view) {
  const nextView = normalizeOpsQueueView(view);
  const state = readOpsAdminState();
  const nextState = { ...state, opsSection: "queue", queueView: nextView };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  rerenderOpsQueueSection("");
}

function selectOpsQueue(queueId) {
  const next = updateOpsQueueState((state) => ({ ...state, queueView: "work", selectedQueueId: queueId, lastAction: "已打开运营队列详情" }));
  rerenderOpsQueueSection(`已打开队列详情：${readOpsQueueRecords(next).find((item) => item.id === queueId)?.task || "任务"}。`);
}

function selectOpsAuditEvent(auditId) {
  const state = readOpsAdminState();
  writeOpsAdminState({
    ...state,
    opsSection: "queue",
    queueView: "audit",
    selectedAuditId: auditId,
    lastAction: "已查看审计事件详情",
  });
  rerenderOpsQueueSection("已打开审计事件详情。");
}

function handleOpsQueueAction(action) {
  const actionLabels = {
    "catalog-freshness": "已打开目录时效性队列",
    "retry-routing": "已按幂等检查加入发送重试队列",
    "reconcile-payment": "支付差异已发送至财务复核",
    "school-response": "已打开学校响应跟进",
    "review-agent-audit": "已打开 Agent 策略拒绝记录",
  };
  if (!actionLabels[action]) return false;
  const label = actionLabels[action];
  updateOpsQueueState((state) => ({
    ...state,
    queueView: "work",
    selectedQueueId: action,
    queueRecords: state.queueRecords.map((item) => item.action === action ? {
      ...item,
      status: action === "retry-routing" ? "重试已排队" : "处理中",
      count: action === "retry-routing" ? "1 次待确认" : item.count,
    } : item),
    routingRetries: action === "retry-routing" ? Math.max(0, Number(state.routingRetries ?? 2) - 1) : Number(state.routingRetries ?? 2),
    lastAction: label,
    auditItems: [label, ...toArray(state.auditItems)].slice(0, 6),
    updatedAt: new Date().toISOString(),
  }));
  rerenderOpsQueueSection(`${label}。队列状态已本地保存。`);
  return true;
}

function handleOpsSupportLookup() {
  const query = document.querySelector("[data-ops-support-query]")?.value || "";
  const reason = document.querySelector("[data-ops-support-reason]")?.value || "";
  const ticket = document.querySelector("[data-ops-support-ticket]")?.value || "";
  const scopeKey = document.querySelector("[data-ops-support-scope]")?.value || "application_status";
  const scopeLabel = {
    application_status: "申请和发送状态",
    payment_status: "支付和对账状态",
    tenant_access: "租户和账号权限",
    agent_context: "Agent 上下文摘要",
  }[scopeKey] || "限定查询范围";
  const label = "已打开审计支持查询";
  updateOpsQueueState((state) => ({
    ...state,
    queueView: "support",
    supportLookup: {
      query,
      reason,
      ticket,
      scopeKey,
      scope: `${scopeLabel}；不开放密码或跨租户私有数据`,
      checkedAt: new Date().toISOString(),
    },
    lastAction: label,
    auditItems: [`${label}：${query} · ${ticket || "无工单号"} · ${scopeLabel}`, ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsQueueSection("支持查询已打开，并写入审计记录。");
}

function applyOpsAuditFilters() {
  const state = readOpsAdminState();
  const search = document.querySelector("[data-ops-audit-search]")?.value || "";
  const moduleFilter = document.querySelector("[data-ops-audit-module-filter]")?.value || "all";
  const actionFilter = document.querySelector("[data-ops-audit-action-filter]")?.value || "all";
  writeOpsAdminState({
    ...state,
    opsSection: "queue",
    queueView: "audit",
    auditSearch: search,
    auditModuleFilter: moduleFilter,
    auditActionFilter: actionFilter,
    lastAction: "已筛选审计事件",
    auditItems: [`已筛选审计事件：${[search || "全部事件", moduleFilter, actionFilter].join(" / ")}`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsQueueSection("审计事件筛选已应用。");
}

function exportOpsAuditCsv() {
  const state = readOpsAdminState();
  const events = filterOpsAuditEvents(readOpsAuditEvents(state), state);
  const csv = [
    ["occurredAt", "actor", "module", "resourceType", "action", "scope", "status", "summary"],
    ...events.map((event) => [event.occurredAt, event.actor, event.module, event.resourceType, event.action, event.scope, event.status, event.summary]),
  ].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  writeOpsAdminState({
    ...state,
    opsSection: "queue",
    queueView: "audit",
    auditExportCsv: csv,
    auditExportCount: events.length,
    lastAction: "已生成审计事件 CSV",
    auditItems: [`已生成审计事件 CSV：${events.length} 条`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsQueueSection(`已生成审计事件 CSV：${events.length} 条。`);
}

function handleOpsAgentOperationsAction(action) {
  const state = readOpsAdminState();
  const current = readOpsAgentOpsState(state);
  const now = new Date().toISOString();
  let nextAgentOps = { ...current, updatedAt: now };
  let label = "已刷新 Agent 运维摘要";
  if (action === "retry-failed") {
    const retried = Math.min(current.failedJobs, 2);
    nextAgentOps = {
      ...nextAgentOps,
      failedJobs: Math.max(0, current.failedJobs - retried),
      runningJobs: current.runningJobs + retried,
      queuedJobs: Math.max(0, current.queuedJobs - retried),
      readinessScore: Math.min(100, current.readinessScore + retried),
      lastOperation: `已重试 ${retried} 个失败生成任务`,
    };
    label = "已重试 Agent 失败任务";
  } else if (action === "toggle-rollout") {
    const paused = !current.rolloutPaused;
    nextAgentOps = {
      ...nextAgentOps,
      rolloutPaused: paused,
      rolloutPercent: paused ? 0 : 35,
      lastOperation: paused ? "已暂停外部 LLM 放量" : "已恢复外部 LLM 放量",
    };
    label = paused ? "已暂停 Agent 放量" : "已恢复 Agent 放量";
  } else {
    nextAgentOps = {
      ...nextAgentOps,
      calls: current.calls + 24,
      totalTokens: current.totalTokens + 18600,
      estimatedCostUsd: current.estimatedCostUsd + 1,
      successRate: Math.min(99, current.successRate + 1),
      lastOperation: "已刷新网关、服务配置、就绪度和生成队列摘要",
    };
  }
  writeOpsAdminState({
    ...state,
    opsSection: "queue",
    queueView: "agent",
    agentOps: nextAgentOps,
    lastAction: label,
    auditItems: [`${label}：${action}`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsQueueSection(`${label}，并写入运营审计。`);
}

function updateOpsAccessState(updater) {
  const state = readOpsAdminState();
  const records = readOpsAccessRecords(state);
  const next = updater({ ...state, accessRecords: records }) || state;
  writeOpsAdminState(next);
  return next;
}

function setOpsAccessView(view) {
  const state = readOpsAdminState();
  const nextView = normalizeOpsAccessView(view);
  const nextState = { ...state, opsSection: "access", accessView: nextView };
  writeOpsAdminState(nextState);
  syncOpsHashRoute(nextState);
  renderOpsPage();
  switchOpsSection("access", { persist: false, scroll: false });
  ensureOpsPageNotBlank("账号权限视图切换后主区域为空");
}

function rerenderOpsAccessSection(message) {
  renderOpsPage();
  switchOpsSection("access");
  if (message) showCompletionToast(message);
}

function selectOpsAccess(id) {
  updateOpsAccessState((state) => ({
    ...state,
    opsSection: "access",
    accessView: "accounts",
    selectedAccessId: id,
    lastAction: "已打开账号权限详情",
  }));
  rerenderOpsAccessSection("已打开账号权限详情。");
}

function approveOpsAccessGrant(id) {
  updateOpsAccessState((state) => ({
    ...state,
    accessView: "accounts",
    selectedAccessId: id,
    accessRecords: state.accessRecords.map((item) => String(item.id) === String(id) ? {
      ...item,
      grantStatus: "approved-preview",
      status: "active",
      updatedAt: new Date().toISOString(),
      lastAction: "授权已批准并写入审计",
    } : item),
    lastAction: "已批准账号权限",
    auditItems: [`已批准账号权限：${id}`, ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsAccessSection("账号权限已批准，并写入权限审计。");
}

function toggleOpsAccessStatus(id) {
  let nextLabel = "已停用账号";
  updateOpsAccessState((state) => ({
    ...state,
    accessView: "accounts",
    selectedAccessId: id,
    accessRecords: state.accessRecords.map((item) => {
      if (String(item.id) !== String(id)) return item;
      const disabled = item.status === "disabled" || item.grantStatus === "revoked";
      nextLabel = disabled ? "已恢复账号" : "已停用账号";
      return {
        ...item,
        status: disabled ? "active" : "disabled",
        grantStatus: disabled ? "approved-preview" : "revoked",
        updatedAt: new Date().toISOString(),
        lastAction: disabled ? "账号已恢复" : "账号已停用，授权已撤销",
      };
    }),
    lastAction: nextLabel,
    auditItems: [`${nextLabel}：${id}`, ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsAccessSection(`${nextLabel}，并写入权限审计。`);
}

function openOpsAccessGrantPanel(id) {
  const next = updateOpsAccessState((state) => ({
    ...state,
    opsSection: "access",
    accessView: "agent",
    accessGrantUserId: id,
    selectedAccessId: id,
    accessAgentStatus: readOpsAccessRecords(state).find((item) => String(item.id) === String(id))?.agentAccessStatus || "免费可用",
    accessAgentReason: state.accessAgentReason || "申请辅助 Agent 免费开放，按账号权限审计",
    lastAction: "已打开 Agent 服务权限面板",
  }));
  const user = readOpsAccessRecords(next).find((item) => String(item.id) === String(id));
  rerenderOpsAccessSection(`已打开 Agent 服务权限面板：${user?.email || id}。`);
}

function cancelOpsAccessGrantPanel() {
  updateOpsAccessState((state) => ({
    ...state,
    accessView: "accounts",
    accessGrantUserId: "",
    accessAgentStatus: "",
    accessAgentReason: "",
    lastAction: "已取消 Agent 服务权限编辑",
  }));
  rerenderOpsAccessSection("已取消 Agent 服务权限编辑。");
}

function updateOpsAccessAgentService(id) {
  const agentAccessStatus = document.querySelector("[data-ops-access-agent-status]")?.value || "免费可用";
  const reason = document.querySelector("[data-ops-access-agent-reason]")?.value?.trim() || "申请辅助 Agent 免费开放，按账号权限审计";
  updateOpsAccessState((state) => ({
    ...state,
    accessView: "accounts",
    accessRecords: state.accessRecords.map((item) => {
      if (String(item.id) !== String(id)) return item;
      return {
        ...item,
        agentAccessStatus,
        lastAgentAccessReason: reason,
        updatedAt: new Date().toISOString(),
        lastAction: `Agent 服务状态：${agentAccessStatus}`,
      };
    }),
    accessGrantUserId: "",
    selectedAccessId: id,
    accessAgentStatus: "",
    accessAgentReason: "",
    lastAction: "已更新账号 Agent 服务权限",
    auditItems: [`已更新账号 Agent 服务权限：${id} · ${agentAccessStatus} · ${reason}`, ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsAccessSection(`已更新账号 Agent 服务权限：${agentAccessStatus}。Agent 申请辅助免费提供。`);
}

function applyOpsAccessFilter() {
  const state = readOpsAdminState();
  const search = document.querySelector("[data-ops-access-search]")?.value || "";
  const statusFilter = document.querySelector("[data-ops-access-status-filter]")?.value || "all";
  const roleFilter = document.querySelector("[data-ops-access-role-filter]")?.value || "all";
  const grantFilter = document.querySelector("[data-ops-access-grant-filter]")?.value || "all";
  writeOpsAdminState({
    ...state,
    opsSection: "access",
    accessView: "accounts",
    accessSearch: search,
    accessStatusFilter: statusFilter,
    accessRoleFilter: roleFilter,
    accessGrantFilter: grantFilter,
    selectedAccessId: "",
    lastAction: "已筛选账号权限",
    auditItems: [`已筛选账号权限：${[search || "全部账号", statusFilter, roleFilter, grantFilter].join(" / ")}`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsAccessSection("账号权限筛选已应用。");
}

function createOpsAccessInvite() {
  const email = document.querySelector("[data-ops-access-invite-email]")?.value?.trim() || "";
  const schoolTenant = document.querySelector("[data-ops-access-invite-school]")?.value?.trim() || "";
  const inviteCode = document.querySelector("[data-ops-access-invite-code]")?.value?.trim() || "";
  const role = document.querySelector("[data-ops-access-invite-role]")?.value || "school_staff";
  const state = readOpsAdminState();
  const fail = (message) => {
    writeOpsAdminState({
      ...state,
      opsSection: "access",
      accessView: "invites",
      accessInviteEmail: email,
      accessInviteSchool: schoolTenant,
      accessInviteCode: inviteCode,
      accessInviteRole: role,
      accessInviteFeedback: message,
      accessInviteFeedbackTone: "danger",
      lastAction: "账号邀请校验未通过",
      auditItems: [`账号邀请校验未通过：${message}`, ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsAccessSection(message);
  };
  if (!email.includes("@")) {
    fail("请输入有效邮箱后再生成邀请草稿。");
    return;
  }
  if (role === "school_staff" && !schoolTenant) {
    fail("学校老师邀请必须选择学校租户，避免生成跨校权限。");
    return;
  }
  if ((role === "school_staff" || role === "cuac_ops") && !inviteCode) {
    fail(role === "school_staff" ? "学校老师邀请必须填写邀请码，供本人注册或登录后绑定。" : "CUAC 运营邀请必须填写团队邀请码。");
    return;
  }
  const now = new Date().toISOString();
  const id = `invite-${Date.now()}`;
  const nextRecord = {
    id,
    email,
    name: email.split("@")[0],
    role,
    workspace: role === "school_staff" ? `${schoolTenant || "学校"}工作台` : role === "cuac_ops" ? "运营管理后台" : "学生申请中心",
    schoolTenant: role === "school_staff" ? schoolTenant : "",
    grantStatus: "pending-review",
    status: "active",
    inviteCode,
    source: role === "school_staff" ? "school_staff_invite" : "admin_assignment",
    agentAccessStatus: "待授权",
    createdAt: now,
    updatedAt: now,
    lastAction: "邀请草稿已生成，等待本人注册/登录后审批",
  };
  updateOpsAccessState((state) => ({
    ...state,
    accessView: "invites",
    selectedAccessId: nextRecord.id,
    accessRecords: [nextRecord, ...state.accessRecords],
    accessInviteEmail: email,
    accessInviteSchool: schoolTenant,
    accessInviteCode: inviteCode,
    accessInviteRole: role,
    accessInviteFeedback: "邀请草稿已生成。被邀请人仍需自己注册或登录，权限审批后才生效。",
    accessInviteFeedbackTone: "success",
    lastAction: "已生成账号邀请草稿",
    auditItems: [`已生成账号邀请草稿：${email}`, ...toArray(state.auditItems)].slice(0, 6),
  }));
  rerenderOpsAccessSection("邀请草稿已生成。被邀请人仍需自己注册或登录，权限审批后才生效。");
}

function exportOpsAccessAudit() {
  const state = readOpsAdminState();
  const records = filterOpsAccessRecords(readOpsAccessRecords(state), state);
  const csv = [
    ["email", "role", "schoolTenant", "grantStatus", "status", "agentAccessStatus", "inviteCode", "source", "updatedAt"],
    ...records.map((item) => [item.email, item.role, item.schoolTenant, item.grantStatus, item.status, item.agentAccessStatus, item.inviteCode, item.source, item.updatedAt]),
  ].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  writeOpsAdminState({
    ...state,
    accessAuditCsv: csv,
    accessExportCount: records.length,
    lastAction: "已生成账号权限审计 CSV",
    auditItems: [`已生成账号权限审计 CSV：${records.length} 条`, ...toArray(state.auditItems)].slice(0, 6),
  });
  rerenderOpsAccessSection(`已生成账号权限审计 CSV：${records.length} 条。`);
}

function recoverOpsPublicScholarshipDraftState(reason = "已从异常状态恢复公共奖学金草稿") {
  const state = readOpsAdminState();
  const draftId = `scholarship-${Date.now()}`;
  const draft = createOpsPublicScholarshipDraftRecord(draftId, 1);
  let existingRecords = [];
  try {
    existingRecords = readOpsScholarshipRecords(state).filter((item) => String(item.id) !== draftId);
  } catch (error) {
    console.error("CUAC ops scholarship recovery could not read previous records", error);
  }
  writeOpsAdminState({
    ...clearOpsContentFilters(state),
    opsSection: "content",
    contentType: "scholarships",
    selectedPublicScholarshipId: draftId,
    publicScholarshipRecords: [draft, ...existingRecords].map((item, index) => normalizeOpsScholarshipRecord(item, index, { useFallback: false })),
    scholarshipImportOpen: false,
    scholarshipImportPreview: null,
    lastAction: reason,
    auditItems: [reason, ...toArray(state.auditItems)].slice(0, 6),
  });
  return draftId;
}

function recordOpsAction(action) {
  if (handleOpsQueueAction(action)) return;
  if (action === "support-lookup") {
    handleOpsSupportLookup();
    return;
  }
  if (action === "export-audit") {
    exportOpsAuditCsv();
    return;
  }
  const labels = {
    "catalog-freshness": "已打开目录时效性队列",
    "edit-school": "已打开学校目录编辑器，并保留旧项目字段映射参考",
    "review-school-data": "已打开学校数据复核队列",
    "student-summary": "已生成学生申请汇总",
    "export-students": "已准备学生汇总导出",
    "open-analytics": "已刷新运营分析摘要",
    "retry-routing": "已按幂等检查加入发送重试队列",
    "reconcile-payment": "支付差异已发送至财务复核",
    "school-response": "已打开学校响应跟进",
    "review-agent-audit": "已打开 Agent 策略拒绝记录",
    "support-lookup": "已打开审计支持查询",
    "export-audit": "已准备审计导出",
  };
  const state = readOpsAdminState();
  const label = labels[action] || "已处理运营动作";
  const auditItems = [label, ...toArray(state.auditItems)].slice(0, 6);
  const next = {
    ...state,
    lastAction: label,
    auditItems,
    routingRetries: action === "retry-routing" ? Math.max(0, Number(state.routingRetries ?? 2) - 1) : Number(state.routingRetries ?? 2),
    updatedAt: new Date().toISOString(),
  };
  writeOpsAdminState(next);
  document.querySelector("[data-ops-state]") && (document.querySelector("[data-ops-state]").textContent = "审计记录已更新");
  document.querySelector("[data-ops-last-action]") && (document.querySelector("[data-ops-last-action]").textContent = label);
  document.querySelector("[data-ops-routing-count]") && (document.querySelector("[data-ops-routing-count]").textContent = next.routingRetries);
  document.querySelector("[data-ops-audit-count]") && (document.querySelector("[data-ops-audit-count]").textContent = auditItems.length);
  const list = document.querySelector("[data-ops-audit-list]");
  if (list) {
    list.innerHTML = auditItems.map((item) => `<article><span>2026-08-17</span><strong>${escapeHtml(item)}</strong></article>`).join("");
  }
  showCompletionToast(`${label}。内部审计状态已本地保存。`);
}

function renderOpsBlankRecoveryState(context = "") {
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  const state = readOpsAdminState();
  const shouldRecoverSchoolScholarship = activeOpsSection(state) === "school"
    && (activeOpsSchoolTab(state) === "scholarships" || Boolean(document.querySelector("[data-ops-school-editor]")));
  if (shouldRecoverSchoolScholarship && recoverOpsSchoolScholarshipDraftAndRender("已从学校奖学金空白状态自动恢复草稿")) {
    return;
  }
  try {
    recoverOpsPublicScholarshipDraftState("已从空白状态自动恢复公共奖学金草稿");
    renderOpsPage();
    switchOpsSection("content", { persist: false, scroll: false });
    showCompletionToast("页面空白状态已自动恢复，并打开公共奖学金草稿。");
    if (document.querySelector('[data-ops-content-editor][data-content-type="scholarships"]')) return;
  } catch (error) {
    console.error("CUAC ops blank recovery auto draft failed", error);
  }
  target.innerHTML = `
    <section class="ops-error-state" role="alert">
      <span class="module-kicker">运营后台</span>
      <h1>页面已自动恢复</h1>
      <p>刚才的操作没有渲染出有效内容${context ? `（${escapeHtml(context)}）` : ""}。这通常来自旧版本地预览状态或未覆盖的异常入口；可以直接恢复一个公共奖学金草稿继续测试。</p>
      <div class="inline-actions">
        <button class="primary-action" data-ops-recover-scholarship-draft type="button">恢复并新增公共奖学金草稿</button>
        <button class="secondary-action" data-ops-recover-school-scholarship-draft type="button">恢复学校奖学金草稿</button>
        <button class="secondary-action" data-ops-reset-state type="button">重置本地预览状态</button>
      </div>
    </section>
  `;
}

function ensureOpsPageNotBlank(context = "") {
  if (mode !== "ops") return;
  const target = document.querySelector("[data-detail-root]");
  if (!target) return;
  const state = readOpsAdminState();
  const section = activeOpsSection(state);
  const panels = Array.from(target.querySelectorAll("[data-ops-section]"));
  const activePanel = panels.find((panel) => panel.dataset.opsSection === section && !panel.hidden)
    || panels.find((panel) => panel.classList.contains("active") && !panel.hidden);
  const activePanelText = activePanel?.textContent?.trim() || "";
  const hasVisibleOpsWork =
    Boolean(activePanel)
    && activePanelText.length > 80
    && Boolean(activePanel.querySelector(".ops-management-surface, .ops-record-editor, .ops-overview-section, .ops-module-list, .ops-school-workbench, .ops-school-view-stack, .ops-content-workbench, .ops-content-view-stack, .ops-access-workbench, .ops-student-workbench, .ops-queue-workspace, .ops-queue-section, .ops-queue-side-panel, .ops-error-state"));
  const hasRecoveryState = Boolean(target.querySelector(".ops-error-state"));
  if (hasVisibleOpsWork || hasRecoveryState) return;
  if (panels.length) {
    switchOpsSection(section, { persist: false, scroll: false });
    const repairedPanel = panels.find((panel) => panel.dataset.opsSection === section && !panel.hidden);
    const repairedText = repairedPanel?.textContent?.trim() || "";
    if (repairedPanel && repairedText.length > 80) return;
  }
  console.warn("CUAC ops admin blank state recovered", context);
  renderOpsBlankRecoveryState(context);
}

function safelyEnsureOpsPageNotBlank(context = "") {
  if (mode !== "ops") return;
  try {
    ensureOpsPageNotBlank(context);
  } catch (error) {
    console.error("CUAC ops blank-state check failed", error);
    try {
      renderOpsBlankRecoveryState(context || "后台页面恢复检查失败");
    } catch (recoveryError) {
      console.error("CUAC ops blank-state recovery failed", recoveryError);
    }
  }
}

function recoverFromCompletionClickError(error) {
  console.error("CUAC completion click failed", error);
  if (mode !== "ops") {
    showCompletionToast("操作没有完成，请刷新后重试。");
    return;
  }
  const state = readOpsAdminState();
  const nextSection = activeOpsSection(state) || "content";
  if (nextSection === "school" && recoverOpsSchoolScholarshipDraftAndRender("已从学校奖学金点击异常自动恢复草稿")) return;
  writeOpsAdminState({
    ...state,
    opsSection: nextSection,
    contentType: normalizeOpsContentType(state.contentType || "scholarships"),
    contentView: normalizeOpsContentView(state.contentView || "catalog"),
    lastAction: "已从点击异常自动恢复",
    auditItems: ["已从点击异常自动恢复", ...toArray(state.auditItems)].slice(0, 6),
  });
  try {
    renderOpsPage();
    switchOpsSection(nextSection, { persist: false, scroll: false });
    showCompletionToast("操作异常已自动恢复，页面未清空。");
  } catch (renderError) {
    const target = document.querySelector("[data-detail-root]");
    if (target) {
      target.innerHTML = `
        <section class="ops-error-state" role="alert">
          <span class="module-kicker">运营后台</span>
          <h1>页面已进入恢复模式</h1>
          <p>本地预览状态包含旧格式内容。可以恢复一个公共奖学金草稿，或重置本地预览状态后继续。</p>
          <div class="inline-actions">
            <button class="primary-action" data-ops-recover-scholarship-draft type="button">恢复并新增奖学金草稿</button>
            <button class="secondary-action" data-ops-reset-state type="button">重置本地预览状态</button>
          </div>
        </section>
      `;
    }
    console.error("CUAC completion click recovery render failed", renderError);
  }
}

document.addEventListener("click", (event) => {
  try {
  const opsTab = event.target.closest("[data-ops-tab]");
  if (opsTab) {
    switchOpsSection(opsTab.dataset.opsTab || "overview");
    return;
  }

  const schoolEdit = event.target.closest("[data-ops-school-edit]");
  if (schoolEdit) {
    selectOpsSchool(schoolEdit.dataset.schoolId || "");
    return;
  }

  const schoolOpenView = event.target.closest("[data-ops-school-open-view]");
  if (schoolOpenView) {
    openOpsSchoolRecordView(schoolOpenView.dataset.schoolId || "", schoolOpenView.dataset.opsSchoolOpenView || "edit");
    return;
  }

  if (event.target.closest("[data-ops-school-create-toggle]")) {
    setOpsSchoolCreateOpen(!readOpsAdminState().schoolCreateOpen);
    return;
  }

  if (event.target.closest("[data-ops-school-create-cancel]")) {
    setOpsSchoolCreateOpen(false);
    return;
  }

  if (event.target.closest("[data-ops-school-create]")) {
    const values = readOpsSchoolCreateDraftInput();
    if (!values.nameZh) {
      showCompletionToast("请先填写学校中文名。");
      document.querySelector('[data-ops-school-create-field="nameZh"]')?.focus();
      return;
    }
    createOpsSchoolDraft(values);
    return;
  }

  if (event.target.closest("[data-ops-school-save]")) {
    saveOpsSchoolEditor();
    return;
  }

  if (event.target.closest("[data-ops-school-discard-switch]")) {
    discardOpsSchoolUnsavedAndContinue();
    return;
  }

  if (event.target.closest("[data-ops-school-archive]")) {
    archiveOpsSchool();
    return;
  }

  const schoolTab = event.target.closest("[data-ops-school-tab]");
  if (schoolTab) {
    setOpsSchoolEditorTab(schoolTab.dataset.opsSchoolTab || "basic");
    return;
  }

  const schoolViewTab = event.target.closest("[data-ops-school-view]");
  if (schoolViewTab) {
    setOpsSchoolView(schoolViewTab.dataset.opsSchoolView || "catalog");
    return;
  }

  if (event.target.closest("[data-ops-school-add-program]")) {
    addOpsSchoolSubrecord("program");
    return;
  }

  if (event.target.closest("[data-ops-school-add-rule]")) {
    addOpsSchoolSubrecord("rule");
    return;
  }

  if (event.target.closest("[data-ops-school-add-scholarship]")) {
    addOpsSchoolSubrecord("scholarship");
    scheduleOpsSchoolScholarshipClickGuard();
    return;
  }

  if (event.target.closest("[data-ops-open-public-scholarships]")) {
    const state = readOpsAdminState();
    writeOpsAdminState({
      ...state,
      opsSection: "content",
      contentType: "scholarships",
      contentView: "catalog",
      lastAction: "已从学校奖学金打开公共奖学金库",
      auditItems: ["已从学校奖学金打开公共奖学金库", ...toArray(state.auditItems)].slice(0, 6),
    });
    rerenderOpsContentSection("已打开公共奖学金库。");
    return;
  }

  const subrecordSave = event.target.closest("[data-ops-subrecord-save]");
  if (subrecordSave) {
    handleOpsSubrecordAction("save", subrecordSave);
    return;
  }

  const subrecordArchive = event.target.closest("[data-ops-subrecord-archive]");
  if (subrecordArchive) {
    handleOpsSubrecordAction("archive", subrecordArchive);
    return;
  }

  if (event.target.closest("[data-ops-school-apply-filter]")) {
    applyOpsSchoolFilters();
    return;
  }

  const importToggle = event.target.closest("[data-ops-school-import-toggle]");
  if (importToggle) {
    setOpsSchoolImportOpen(!readOpsAdminState().schoolImportOpen);
    return;
  }

  if (event.target.closest("[data-ops-school-import-example]")) {
    setOpsSchoolImportExample();
    return;
  }

  if (event.target.closest("[data-ops-school-import-preview]")) {
    previewOpsSchoolImport();
    return;
  }

  if (event.target.closest("[data-ops-school-import-apply]")) {
    applyOpsSchoolImport();
    return;
  }

  const contentTab = event.target.closest("[data-ops-content-tab]");
  if (contentTab) {
    switchOpsContentType(contentTab.dataset.opsContentTab || "cities");
    return;
  }

  const contentView = event.target.closest("[data-ops-content-view]");
  if (contentView) {
    switchOpsContentView(contentView.dataset.opsContentView || "catalog");
    return;
  }

  const contentEditorTab = event.target.closest("[data-ops-content-editor-tab]");
  if (contentEditorTab) {
    const editor = contentEditorTab.closest("[data-ops-content-editor]");
    const nextPanel = contentEditorTab.dataset.opsContentEditorTab || "0";
    if (!editor) return;
    editor.querySelectorAll("[data-ops-content-editor-tab]").forEach((button) => {
      const active = button === contentEditorTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    editor.querySelectorAll("[data-ops-content-editor-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.opsContentEditorPanel !== nextPanel;
    });
    return;
  }

  const contentSelect = event.target.closest("[data-ops-content-select]");
  if (contentSelect) {
    selectOpsContent(contentSelect.dataset.contentType || "cities", contentSelect.dataset.contentId || "");
    return;
  }

  const contentOpenView = event.target.closest("[data-ops-content-open-view]");
  if (contentOpenView) {
    openOpsContentRecordView(contentOpenView.dataset.contentType || "cities", contentOpenView.dataset.contentId || "", contentOpenView.dataset.opsContentOpenView || "edit");
    return;
  }

  const contentCreate = event.target.closest("[data-ops-content-create]");
  if (contentCreate) {
    const activeContentType = contentCreate.closest("[data-ops-section]")?.querySelector("[data-ops-content-tab].active")?.dataset.opsContentTab;
    const stateContentType = readOpsAdminState().contentType;
    const buttonContentType = contentCreate.dataset.contentType || "";
    const normalizedActiveContentType = activeContentType ? normalizeOpsContentType(activeContentType) : "";
    const normalizedButtonContentType = buttonContentType ? normalizeOpsContentType(buttonContentType) : "";
    const normalizedStateContentType = stateContentType ? normalizeOpsContentType(stateContentType) : "";
    const requestedType = normalizedActiveContentType && normalizedActiveContentType === normalizedStateContentType
      ? normalizedActiveContentType
      : normalizedButtonContentType && normalizedButtonContentType === normalizedStateContentType
        ? normalizedButtonContentType
        : normalizedActiveContentType || normalizedButtonContentType || normalizedStateContentType || "";
    const draftId = createOpsContentDraft(requestedType);
    const draftLabels = { cities: "新城市草稿", scholarships: "新公共奖学金草稿", timeline: "新申请时间窗草稿" };
    ensureOpsContentTypeRendered(requestedType);
    forceOpsContentEditorRendered(normalizeOpsContentType(requestedType), draftId, draftLabels[normalizeOpsContentType(requestedType)]);
    scheduleOpsContentClickGuard(requestedType, draftId);
    return;
  }

  if (event.target.closest("[data-ops-content-apply-filter]")) {
    applyOpsContentFilters();
    return;
  }

  const scholarshipImportToggle = event.target.closest("[data-ops-scholarship-import-toggle]");
  if (scholarshipImportToggle) {
    setOpsScholarshipImportOpen(!readOpsAdminState().scholarshipImportOpen);
    return;
  }

  if (event.target.closest("[data-ops-scholarship-import-example]")) {
    setOpsScholarshipImportExample();
    return;
  }

  if (event.target.closest("[data-ops-scholarship-import-preview]")) {
    previewOpsScholarshipImport();
    return;
  }

  if (event.target.closest("[data-ops-scholarship-import-apply]")) {
    applyOpsScholarshipImport();
    return;
  }

  const scholarshipSchoolToggle = event.target.closest("[data-ops-scholarship-school-toggle]");
  if (scholarshipSchoolToggle) {
    syncOpsScholarshipSchoolPicker(scholarshipSchoolToggle);
    return;
  }

  const scholarshipProgramToggle = event.target.closest("[data-ops-scholarship-program-toggle]");
  if (scholarshipProgramToggle) {
    syncOpsScholarshipProgramPicker(scholarshipProgramToggle);
    return;
  }

  const contentSave = event.target.closest("[data-ops-content-save]");
  if (contentSave) {
    saveOpsContentEditor(contentSave);
    return;
  }

  const contentPublish = event.target.closest("[data-ops-content-publish]");
  if (contentPublish) {
    updateOpsContentStatus("published", contentPublish);
    return;
  }

  const contentArchive = event.target.closest("[data-ops-content-archive]");
  if (contentArchive) {
    updateOpsContentStatus("archived", contentArchive);
    return;
  }

  const studentSelect = event.target.closest("[data-ops-student-select]");
  if (studentSelect) {
    selectOpsStudent(studentSelect.dataset.studentId || "");
    return;
  }

  const studentOpenTab = event.target.closest("[data-ops-student-open-tab]");
  if (studentOpenTab) {
    openOpsStudentRecordTab(studentOpenTab.dataset.studentId || "", studentOpenTab.dataset.opsStudentOpenTab || "overview");
    return;
  }

  const studentDetailTab = event.target.closest("[data-ops-student-detail-tab]");
  if (studentDetailTab) {
    setOpsStudentDetailTab(studentDetailTab.dataset.opsStudentDetailTab || "overview");
    return;
  }

  const studentQuickFilter = event.target.closest("[data-ops-student-quick-filter]");
  if (studentQuickFilter) {
    applyOpsStudentQuickFilter(studentQuickFilter.dataset.opsStudentQuickFilter || "all");
    return;
  }

  if (event.target.closest("[data-ops-student-apply-filter]")) {
    applyOpsStudentFilters();
    return;
  }

  if (event.target.closest("[data-ops-student-export]")) {
    exportOpsStudentsCsv();
    return;
  }

  if (event.target.closest("[data-ops-student-export-collapse]")) {
    collapseOpsStudentExport();
    return;
  }

  if (event.target.closest("[data-ops-student-download-csv]")) {
    downloadOpsStudentsCsv();
    return;
  }

  if (event.target.closest("[data-ops-student-save]")) {
    saveOpsStudentEditor();
    return;
  }

  const studentAction = event.target.closest("[data-ops-student-action]");
  if (studentAction) {
    handleOpsStudentAction(studentAction.dataset.opsStudentAction || "");
    return;
  }

  const accessViewTab = event.target.closest("[data-ops-access-view]");
  if (accessViewTab) {
    setOpsAccessView(accessViewTab.dataset.opsAccessView || "accounts");
    return;
  }

  const accessSelect = event.target.closest("[data-ops-access-select]");
  if (accessSelect) {
    selectOpsAccess(accessSelect.dataset.accessId || "");
    return;
  }

  const accessApprove = event.target.closest("[data-ops-access-approve]");
  if (accessApprove) {
    approveOpsAccessGrant(accessApprove.dataset.accessId || "");
    return;
  }

  const accessToggle = event.target.closest("[data-ops-access-toggle]");
  if (accessToggle) {
    toggleOpsAccessStatus(accessToggle.dataset.accessId || "");
    return;
  }

  const accessOpenGrant = event.target.closest("[data-ops-access-open-grant]");
  if (accessOpenGrant) {
    openOpsAccessGrantPanel(accessOpenGrant.dataset.accessId || "");
    return;
  }

  const accessGrantSubmit = event.target.closest("[data-ops-access-grant-submit]");
  if (accessGrantSubmit) {
    updateOpsAccessAgentService(accessGrantSubmit.dataset.accessId || "");
    return;
  }

  if (event.target.closest("[data-ops-access-grant-cancel]")) {
    cancelOpsAccessGrantPanel();
    return;
  }

      if (event.target.closest("[data-ops-access-apply-filter]")) {
        applyOpsAccessFilter();
        return;
      }

      const queueCommandView = event.target.closest("[data-ops-queue-command-view]");
      if (queueCommandView) {
        setOpsQueueView(queueCommandView.dataset.opsQueueCommandView || "work");
        return;
      }

      const queueViewTab = event.target.closest("[data-ops-queue-view]");
      if (queueViewTab) {
        setOpsQueueView(queueViewTab.dataset.opsQueueView || "work");
    return;
  }

  if (event.target.closest("[data-ops-audit-apply-filter]")) {
    applyOpsAuditFilters();
    return;
  }

  if (event.target.closest("[data-ops-audit-export]")) {
    exportOpsAuditCsv();
    return;
  }

  const auditSelect = event.target.closest("[data-ops-audit-select]");
  if (auditSelect) {
    selectOpsAuditEvent(auditSelect.dataset.auditId || "");
    return;
  }

  const agentOpsAction = event.target.closest("[data-ops-agent-ops-action]");
  if (agentOpsAction) {
    handleOpsAgentOperationsAction(agentOpsAction.dataset.opsAgentOpsAction || "refresh");
    return;
  }

  if (event.target.closest("[data-ops-access-create-invite]")) {
    createOpsAccessInvite();
    return;
  }

  if (event.target.closest("[data-ops-access-export]")) {
    exportOpsAccessAudit();
    return;
  }

  const queueSelect = event.target.closest("[data-ops-queue-select]");
  if (queueSelect) {
    selectOpsQueue(queueSelect.dataset.queueId || "");
    return;
  }

  if (event.target.closest("[data-ops-reset-state]")) {
    writeOpsAdminState({});
    renderOpsPage();
    showCompletionToast("运营后台本地预览状态已重置。");
    return;
  }

  if (event.target.closest("[data-ops-recover-scholarship-draft]")) {
    const draftId = recoverOpsPublicScholarshipDraftState("已从异常状态恢复并新增公共奖学金草稿");
    rerenderOpsContentSection("已恢复并打开公共奖学金草稿。");
    ensureOpsContentEditorRendered("scholarships", draftId, "新公共奖学金草稿");
    return;
  }

  if (event.target.closest("[data-ops-recover-school-scholarship-draft]")) {
    recoverOpsSchoolScholarshipDraftAndRender("已从异常状态恢复并新增学校奖学金草稿");
    return;
  }

  const opsAction = event.target.closest("[data-ops-action]");
  if (opsAction) {
    recordOpsAction(opsAction.dataset.opsAction || "");
    return;
  }

  const settingsSave = event.target.closest("[data-school-settings-save]");
  if (settingsSave) {
    if (window.CUAC?.requireSignedIn && !window.CUAC.requireSignedIn("保存学校租户设置", { resumeAction: { type: "click-selector", selector: "[data-school-settings-save]" } })) return;
    const template = document.querySelector("[data-school-template]")?.value || defaultSchoolRequestTemplate;
    writeSchoolSettingsState({ template, savedAt: new Date().toISOString() });
    const state = document.querySelector("[data-school-settings-state]");
    const summary = document.querySelector("[data-school-settings-summary]");
    if (state) state.textContent = "本地设置已保存";
    if (summary) summary.textContent = "3 个有效老师席位 · 设置已本地保存";
    showCompletionToast("学校设置已本地保存，租户范围仍锁定为浙江大学。");
    return;
  }

  const templateCopy = event.target.closest("[data-school-template-copy]");
  if (templateCopy) {
    const template = document.querySelector("[data-school-template]")?.value || defaultSchoolRequestTemplate;
    navigator.clipboard?.writeText(template).catch(() => {});
    showCompletionToast("材料请求模板已复制。CUAC 未收取文件。");
    return;
  }

  const templateReset = event.target.closest("[data-school-template-reset]");
  if (templateReset) {
    const template = document.querySelector("[data-school-template]");
    if (template) template.value = defaultSchoolRequestTemplate;
    showCompletionToast("模板已重置。学校仍直接向学生索取文件。");
    return;
  }

  const scholarshipShare = event.target.closest("[data-share-scholarship]");
  if (scholarshipShare) {
    copyCurrentScholarshipLink(scholarshipShare);
    return;
  }

  const save = event.target.closest("[data-save-detail]");
  if (!save) return;
  if (window.CUAC?.requireSignedIn && !window.CUAC.requireSignedIn("Save this item", { resumeAction: { type: "click-selector", selector: "[data-save-detail]" } })) return;
  if (!detailModes.includes(mode) || !currentDetailData) {
    showCompletionToast(save.textContent.trim() || "Saved");
    return;
  }
  const saved = saveCurrentDetail();
  showCompletionToast(`${saved.title} saved to Favourites for later review.`);
  } catch (error) {
    recoverFromCompletionClickError(error);
  } finally {
    safelyEnsureOpsPageNotBlank("点击操作后主区域为空");
    if (mode === "ops") {
      setTimeout(() => safelyEnsureOpsPageNotBlank("点击操作延迟重绘后主区域为空"), 80);
      setTimeout(() => safelyEnsureOpsPageNotBlank("点击操作异步状态同步后主区域为空"), 240);
    }
  }
});

document.addEventListener("change", (event) => {
  markOpsSchoolEditorDirtyFromEvent(event);
  markOpsContentEditorDirtyFromEvent(event);
  if (event.target.closest("[data-university-program-filter]")) {
    updateUniversityProgramFilters();
    return;
  }
  if (event.target.closest("[data-city-program-filter]")) {
    updateCityProgramFilters();
    return;
  }
  if (!event.target.closest("[data-check-item]")) return;
  updateChecklistProgress();
});

document.addEventListener("input", (event) => {
  markOpsSchoolEditorDirtyFromEvent(event);
  markOpsContentEditorDirtyFromEvent(event);
});

document.addEventListener("cuac:agent-action", (event) => {
  const action = event.detail?.action || "";
  if (mode === "ops" && action === "ops-review-agent-audit") {
    recordOpsAction("review-agent-audit");
    event.preventDefault();
    return;
  }
  if (mode !== "school-settings") return;
  if (action !== "school-copy-request-template") return;
  showCompletionToast("材料请求模板已复制。CUAC 未收取文件。");
  event.preventDefault();
});

function installOpsRuntimeRecovery() {
  if (mode !== "ops") return;
  const recover = (context) => {
    const target = document.querySelector("[data-detail-root]");
    try {
      safelyEnsureOpsPageNotBlank(context);
      const state = readOpsAdminState();
      const section = activeOpsSection(state);
      const activePanel = target?.querySelector(`[data-ops-section="${section}"]:not([hidden])`);
      const hasActiveWork = Boolean(activePanel && activePanel.textContent.trim().length > 80);
      if (hasActiveWork || target?.querySelector(".ops-error-state")) return;
      renderOpsBlankRecoveryState(context);
    } catch {
      if (target) {
        target.innerHTML = `
          <section class="ops-error-state" role="alert">
            <span class="module-kicker">运营后台</span>
            <h1>页面已进入恢复模式</h1>
            <p>本地预览状态无法渲染。可以直接恢复一个奖学金草稿继续测试，或重置本地预览状态。</p>
            <div class="inline-actions">
              <button class="primary-action" data-ops-recover-scholarship-draft type="button">恢复并新增奖学金草稿</button>
              <button class="secondary-action" data-ops-reset-state type="button">重置本地预览状态</button>
            </div>
          </section>
        `;
      }
    }
  };
  window.addEventListener("error", () => recover("运行时错误"));
  window.addEventListener("unhandledrejection", () => recover("异步操作错误"));
  window.addEventListener("hashchange", () => {
    try {
      const nextState = applyOpsHashRouteState();
      syncOpsHashRoute(nextState);
      renderOpsPage();
      safelyEnsureOpsPageNotBlank("后台页内路由切换后主区域为空");
    } catch (error) {
      recoverFromCompletionClickError(error);
    }
  });
  window.addEventListener("popstate", () => {
    try {
      const nextState = applyOpsHashRouteState();
      syncOpsHashRoute(nextState);
      renderOpsPage();
      safelyEnsureOpsPageNotBlank("后台浏览器历史切换后主区域为空");
    } catch (error) {
      recoverFromCompletionClickError(error);
    }
  });
  requestAnimationFrame(() => safelyEnsureOpsPageNotBlank("首次绘制后主区域为空"));
}

const detailModes = ["program", "university", "scholarship", "city", "guide"];
const completionState = requestedCompletionState();

installOpsRuntimeRecovery();

function bootCompletionPage() {
  try {
    if (detailModes.includes(mode) && completionState !== "ready") renderCompletionState(completionState);
    else if (mode === "billing") renderBillingPage();
    else if (mode === "school-settings") renderSchoolSettingsPage();
    else if (mode === "ops") renderOpsPage();
    else renderDetailPage(pickData());
  } catch (error) {
    if (mode === "ops") {
      console.error("CUAC ops initial render failed", error);
      renderOpsBlankRecoveryState("页面初始化渲染失败");
      return;
    }
    throw error;
  }
}

bootCompletionPage();

safelyEnsureOpsPageNotBlank("页面初始化后主区域为空");
revealOpsRenderedRoot();
