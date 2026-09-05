(function installCatalogListApi(global) {
  "use strict";

  const resources = new Set(["programs", "schools", "scholarships", "cities"]);

  function messageFromPayload(payload, fallback) {
    return payload?.error?.message || payload?.message || fallback;
  }

  async function load(resource, options = {}) {
    if (!resources.has(resource)) throw new Error("Unsupported catalog resource.");

    const params = new URLSearchParams();
    params.set("limit", String(options.limit || 100));
    if (options.offset) params.set("offset", String(options.offset));
    if (options.query) params.set("query", String(options.query));

    const response = await fetch(`/api/v1/catalog/${resource}?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(messageFromPayload(payload, `Could not load ${resource}.`));
    }
    if (!Array.isArray(payload?.data)) {
      throw new Error(`The ${resource} response was not a list.`);
    }
    return payload.data;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function listState(target, state, options = {}) {
    if (!target) return;
    const noun = options.noun || "records";
    if (state === "loading") {
      target.innerHTML = `<div class="catalog-list-state" role="status"><strong>Loading published ${escapeHtml(noun)}</strong><span>Reading the current catalog.</span></div>`;
      return;
    }
    const detail = options.message || `Published ${noun} could not be loaded.`;
    target.innerHTML = `<div class="catalog-list-state catalog-list-state-error" role="alert"><strong>Catalog unavailable</strong><span>${escapeHtml(detail)}</span><button type="button" data-catalog-retry>Retry</button></div>`;
  }

  global.CuacCatalogList = Object.freeze({ load, escapeHtml, listState });
})(window);
