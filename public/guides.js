(function initPublishedGuides() {
  "use strict";

  const i18n = window.CUACGuidesI18n;
  const locale = window.CUACI18n?.locale || "en";
  const grid = document.querySelector("[data-guide-grid]");
  const count = document.querySelector("[data-guide-count]");
  const context = document.querySelector("[data-guide-context]");
  const filterSummary = document.querySelector("[data-guide-filter-summary]");
  const searchForm = document.querySelector("[data-guide-search]");
  const searchInput = document.querySelector("#guideSearch");
  const params = new URLSearchParams(location.search);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  }

  function localizedGuide(guide) {
    const translation = locale === "en" ? null : guide.content?.translations?.[locale];
    return {
      title: translation?.title || guide.titleEn,
      subtitle: translation?.subtitle || guide.subtitleEn,
      summary: translation?.summary || guide.summaryEn,
      translated: locale === "en" || Boolean(translation),
    };
  }

  function localizedHref(rawHref) {
    return i18n?.href(rawHref) || rawHref;
  }

  function guideDetailHref(guide) {
    return localizedHref(`guide-detail.html?guide=${encodeURIComponent(guide.slug)}`);
  }

  function formatDate(value) {
    if (!value) return i18n.ui("Date not published");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return i18n.ui("Date not published");
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  function guideCard(guide) {
    const content = localizedGuide(guide);
    const fallback = locale !== "en" && !content.translated;
    return `<article class="published-guide-card" data-guide-slug="${escapeHtml(guide.slug)}">
      <div class="published-guide-meta">
        <span>${escapeHtml(i18n.ui("Reviewed guide"))}</span>
        <small>${escapeHtml(i18n.format("Updated {date}", { date: formatDate(guide.updatedAt || guide.publishedAt) }))}</small>
      </div>
      <h3>${escapeHtml(content.title)}</h3>
      ${content.subtitle ? `<p class="published-guide-subtitle">${escapeHtml(content.subtitle)}</p>` : ""}
      ${content.summary ? `<p>${escapeHtml(content.summary)}</p>` : `<p>${escapeHtml(i18n.ui("No published summary is available."))}</p>`}
      ${fallback ? `<p class="guide-translation-status">${escapeHtml(i18n.ui("English content shown — reviewed translation not yet published."))}</p>` : ""}
      <div class="published-guide-actions">
        <a href="${escapeHtml(guideDetailHref(guide))}">${escapeHtml(i18n.ui("Open guide"))}</a>
        <span>${escapeHtml(i18n.format("Version {version}", { version: guide.version }))}</span>
      </div>
    </article>`;
  }

  function setFilterSummary(query, resultCount) {
    if (!filterSummary) return;
    if (!query) {
      filterSummary.hidden = true;
      filterSummary.textContent = "";
      return;
    }
    filterSummary.hidden = false;
    filterSummary.innerHTML = `<span>${escapeHtml(i18n.format("Results for “{query}”", { query }))}</span><strong>${escapeHtml(i18n.format("{count} found", { count: resultCount }))}</strong><a href="${escapeHtml(localizedHref("guides.html"))}">${escapeHtml(i18n.ui("Clear search"))}</a>`;
  }

  function renderError() {
    count.textContent = "0";
    context.textContent = i18n.ui("Published guides could not be loaded.");
    grid.innerHTML = `<article class="guide-state-card"><strong>${escapeHtml(i18n.ui("Guides are temporarily unavailable"))}</strong><span>${escapeHtml(i18n.ui("Try again. If the problem continues, use site search."))}</span><button type="button" data-guide-retry>${escapeHtml(i18n.ui("Try again"))}</button></article>`;
    grid.setAttribute("aria-busy", "false");
  }

  async function loadGuides() {
    const query = String(params.get("q") || "").trim();
    if (searchInput) searchInput.value = query;
    grid.setAttribute("aria-busy", "true");
    const api = new URL("/api/v1/catalog/guides", location.origin);
    api.searchParams.set("limit", "100");
    if (query) api.searchParams.set("query", query);
    try {
      const response = await fetch(`${api.pathname}${api.search}`, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.data)) throw new Error("guide catalog unavailable");
      count.textContent = String(payload.data.length);
      context.textContent = query
        ? i18n.ui("Showing matching published guide records.")
        : i18n.ui("Showing the current published guide catalog.");
      setFilterSummary(query, payload.data.length);
      grid.innerHTML = payload.data.length
        ? payload.data.map(guideCard).join("")
        : `<article class="guide-state-card"><strong>${escapeHtml(i18n.ui("No matching guides"))}</strong><span>${escapeHtml(i18n.ui("Try a broader search or browse the full catalog."))}</span><a href="${escapeHtml(localizedHref("guides.html"))}">${escapeHtml(i18n.ui("View all guides"))}</a></article>`;
      grid.setAttribute("aria-busy", "false");
    } catch {
      renderError();
    }
  }

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = String(searchInput?.value || "").trim();
    const next = new URL(location.href);
    if (query) next.searchParams.set("q", query); else next.searchParams.delete("q");
    location.assign(`${next.pathname.split("/").pop()}${next.search}${next.hash}`);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-guide-retry]")) loadGuides();
  });

  loadGuides();
}());
