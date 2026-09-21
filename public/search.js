(function initSiteSearch() {
  "use strict";

  const i18n = window.CUACI18n;
  const t = (key, fallback) => i18n?.t(`search.${key}`, fallback) || fallback;
  const format = (template, values = {}) => Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template,
  );
  const labels = {
    program: t("type.program", "Programs"), school: t("type.school", "Universities"),
    scholarship: t("type.scholarship", "Scholarships"), city: t("type.city", "Cities"), guide: t("type.guide", "Guides"),
  };
  const icons = { program: "PR", school: "UN", scholarship: "SC", city: "CI", guide: "GU" };
  const form = document.querySelector("[data-site-search-form]");
  const input = document.querySelector("[data-site-search-input]");
  const results = document.querySelector("[data-search-results]");
  const status = document.querySelector("[data-search-status]");
  let controller = null;
  let loadedGroups = [];

  function applyStaticCopy() {
    document.title = t("pageTitle", "Search CUAC");
    document.querySelectorAll("[data-search-copy]").forEach(target => {
      target.textContent = t(target.dataset.searchCopy, target.textContent);
    });
    document.querySelectorAll("[data-search-type-label]").forEach(target => {
      const key = target.dataset.searchTypeLabel;
      target.textContent = key === "all" ? t("type.all", "All") : labels[key] || target.textContent;
    });
    input.placeholder = t("placeholder", input.placeholder);
    input.setAttribute("aria-label", t("inputLabel", input.getAttribute("aria-label") || "Search published CUAC catalog"));
    document.querySelector("[data-search-types]")?.setAttribute("aria-label", t("resultTypes", "Search result types"));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function stateFromUrl() {
    const params = new URLSearchParams(location.search);
    const locale = i18n?.locale || "en";
    return { query: (params.get("q") || "").trim(), type: params.get("type") || "", locale };
  }

  function updateUrl(query, type, locale, replace = false) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type) params.set("type", type);
    if (locale !== "en") params.set("lang", locale);
    const url = `search.html${params.size ? `?${params}` : ""}`;
    history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function setActiveLocale(locale) {
    document.documentElement.lang = locale;
  }

  function setActiveType(type) {
    document.querySelectorAll("[data-search-type]").forEach(button => {
      const active = button.dataset.searchType === type;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function setCounts(groups) {
    const counts = Object.fromEntries(groups.map(group => [group.type, group.total]));
    let all = 0;
    Object.keys(labels).forEach(type => {
      const count = counts[type] || 0;
      all += count;
      const target = document.querySelector(`[data-count-for="${type}"]`);
      if (target) target.textContent = String(count);
    });
    const allTarget = document.querySelector('[data-count-for="all"]');
    if (allTarget) allTarget.textContent = String(all);
  }

  function renderCard(item) {
    const verified = item.verificationStatus === "verified";
    return `<a class="search-result-card" href="${escapeHtml(item.href)}">
      <span class="search-result-icon" aria-hidden="true">${icons[item.type] || "CU"}</span>
      <span class="search-result-copy">
        <strong>${escapeHtml(item.displayTitle || item.title)}${item.alternateTitle ? `<span class="title-zh">${escapeHtml(item.alternateTitle)}</span>` : ""}</strong>
        ${item.subtitle ? `<span>${escapeHtml(item.subtitle)}</span>` : ""}
        ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
      </span>
      <span class="search-verified">${escapeHtml(verified ? t("verified", "Verified") : t("sourceListed", "Source listed"))}</span>
    </a>`;
  }

  function renderGroups(groups, selectedType) {
    const visible = groups.filter(group => group.items.length > 0);
    if (!visible.length) {
      results.innerHTML = `<div class="search-empty"><strong>${escapeHtml(t("noResults", "No published results match"))}</strong><p>${escapeHtml(t("noResultsHelp", "Try a shorter subject, university name, city, or funding term."))}</p></div>`;
      return;
    }
    results.innerHTML = `<div class="search-result-groups">${visible.map(group => `
      <section class="search-result-group" aria-labelledby="search-group-${group.type}">
        <div class="search-group-head">
          <h2 id="search-group-${group.type}">${labels[group.type]} <small>(${group.total})</small></h2>
          ${!selectedType && group.total > group.items.length ? `<button type="button" data-view-type="${group.type}">${escapeHtml(t("viewAll", "View all"))}</button>` : ""}
        </div>
        <div class="search-card-list">${group.items.map(renderCard).join("")}</div>
        ${selectedType && group.nextCursor ? `<div class="search-more"><button type="button" data-search-more data-cursor="${escapeHtml(group.nextCursor)}">${escapeHtml(t("loadMore", "Load more"))}</button><span>${escapeHtml(format(t("showing", "Showing {loaded} of {total}"), { loaded: group.items.length, total: group.total }))}</span></div>` : ""}
      </section>`).join("")}</div>`;
  }

  function mergeGroups(current, incoming) {
    return incoming.map(group => {
      const previous = current.find(item => item.type === group.type);
      if (!previous) return group;
      const seen = new Set(previous.items.map(item => `${item.type}:${item.id}`));
      return { ...group, items: [...previous.items, ...group.items.filter(item => !seen.has(`${item.type}:${item.id}`))] };
    });
  }

  async function runSearch(cursor = null) {
    const state = stateFromUrl();
    input.value = state.query;
    setActiveType(state.type);
    setActiveLocale(state.locale);
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    if (!cursor) {
      loadedGroups = [];
      results.innerHTML = `<div class="search-loading" aria-busy="true"><span></span><strong>${escapeHtml(t("loading", "Searching published catalog"))}</strong></div>`;
      status.textContent = state.query
        ? format(t("searchingFor", "Searching for “{query}”…"), { query: state.query })
        : t("browsing", "Browsing current published catalog.");
    } else {
      const moreButton = results.querySelector("[data-search-more]");
      if (moreButton) { moreButton.disabled = true; moreButton.textContent = t("loadingMore", "Loading…"); }
    }
    const params = new URLSearchParams({ q: state.query, limit: state.type ? "20" : "4" });
    if (state.type) params.set("type", state.type);
    params.set("locale", state.locale === "zh-CN" ? "zh" : "en");
    if (cursor) params.set("cursor", cursor);
    try {
      const response = await fetch(`/api/v1/search?${params}`, { headers: { accept: "application/json" }, signal: requestController.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.data?.groups)) throw new Error(payload?.error?.message || t("unavailableMessage", "Search is temporarily unavailable."));
      loadedGroups = cursor ? mergeGroups(loadedGroups, payload.data.groups) : payload.data.groups;
      setCounts(loadedGroups);
      renderGroups(loadedGroups, state.type);
      const total = payload.data.groups.reduce((sum, group) => sum + group.total, 0);
      const loaded = loadedGroups.reduce((sum, group) => sum + group.items.length, 0);
      const resultLabel = format(t(total === 1 ? "resultOne" : "resultMany", total === 1 ? "{total} published result" : "{total} published results"), { total });
      const queryLabel = state.query ? ` ${format(t("forQuery", "for “{query}”"), { query: state.query })}` : "";
      const shownLabel = state.type && loaded < total ? ` · ${format(t("shown", "{loaded} shown"), { loaded })}` : "";
      const interpretation = payload.data.interpretedQuery ? ` · ${format(t("interpreted", "Interpreted as “{query}”"), { query: payload.data.interpretedQuery })}` : "";
      status.textContent = `${resultLabel}${queryLabel}${shownLabel}${interpretation} · ${Number(payload?.meta?.tookMs) || 0} ms`;
    } catch (error) {
      if (error.name === "AbortError") return;
      if (cursor && loadedGroups.length) {
        renderGroups(loadedGroups, state.type);
        status.textContent = `${t("moreFailed", "More results could not be loaded.")} ${error.message}`;
        return;
      }
      results.innerHTML = `<div class="search-error"><strong>${escapeHtml(t("unavailable", "Search unavailable"))}</strong><p>${escapeHtml(error.message)}</p><button type="button" data-search-retry>${escapeHtml(t("retry", "Try again"))}</button></div>`;
      status.textContent = t("latestFailed", "The latest search could not be completed.");
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const state = stateFromUrl();
    updateUrl(input.value.trim(), state.type, state.locale);
    runSearch();
  });

  document.addEventListener("click", event => {
    const typeButton = event.target.closest("[data-search-type], [data-view-type]");
    if (typeButton) {
      const type = typeButton.dataset.searchType ?? typeButton.dataset.viewType ?? "";
      const state = stateFromUrl();
      updateUrl(input.value.trim(), type, state.locale);
      runSearch();
      return;
    }
    const moreButton = event.target.closest("[data-search-more]");
    if (moreButton) {
      runSearch(moreButton.dataset.cursor || null);
      return;
    }
    if (event.target.closest("[data-search-retry]")) runSearch();
  });

  window.addEventListener("popstate", runSearch);
  applyStaticCopy();
  runSearch();
})();
