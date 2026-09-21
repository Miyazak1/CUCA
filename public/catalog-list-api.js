(function installCatalogListApi(global) {
  "use strict";

  const resources = new Set(["programs", "schools", "scholarships", "cities"]);
  const completedRequests = new Map();
  const pendingRequests = new Map();
  const completedPages = new Map();
  const pendingPages = new Map();

  function messageFromPayload(payload, fallback) {
    return payload?.error?.message || payload?.message || fallback;
  }

  async function load(resource, options = {}) {
    if (!resources.has(resource)) throw new Error("Unsupported catalog resource.");

    const params = new URLSearchParams();
    params.set("limit", String(options.limit || 100));
    if (options.offset) params.set("offset", String(options.offset));
    if (options.query) params.set("query", String(options.query));

    const requestUrl = `/api/v1/catalog/${resource}?${params.toString()}`;
    if (completedRequests.has(requestUrl)) return completedRequests.get(requestUrl);
    if (pendingRequests.has(requestUrl)) return pendingRequests.get(requestUrl);

    const request = (async () => {
      const response = await fetch(requestUrl, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(messageFromPayload(payload, `Could not load ${resource}.`));
      }
      if (!Array.isArray(payload?.data)) {
        throw new Error(`The ${resource} response was not a list.`);
      }
      completedRequests.set(requestUrl, payload.data);
      return payload.data;
    })();
    pendingRequests.set(requestUrl, request);
    try {
      return await request;
    } finally {
      pendingRequests.delete(requestUrl);
    }
  }

  async function loadPage(resource, options = {}) {
    if (!resources.has(resource)) throw new Error("Unsupported catalog resource.");
    const params = new URLSearchParams();
    const optionNames = ["limit", "offset", "query", "degree", "subject", "language", "city", "school", "intake", "deadline", "tuition", "languageRequirement", "sort"];
    optionNames.forEach((name) => {
      if (options[name] != null && options[name] !== "") params.set(name, String(options[name]));
    });
    ["scholarship", "upcomingDeadline"].forEach((name) => {
      if (options[name]) params.set(name, "true");
    });
    const requestUrl = `/api/v1/catalog/${resource}?${params.toString()}`;
    if (completedPages.has(requestUrl)) return completedPages.get(requestUrl);
    if (pendingPages.has(requestUrl)) return pendingPages.get(requestUrl);
    const request = (async () => {
      const response = await fetch(requestUrl, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFromPayload(payload, `Could not load ${resource}.`));
      if (!Array.isArray(payload?.data)) throw new Error(`The ${resource} response was not a list.`);
      const result = {
        records: payload.data,
        total: Math.max(Number(payload?.pagination?.total) || 0, 0),
        limit: Math.max(Number(payload?.pagination?.limit) || Number(options.limit) || payload.data.length, 1),
        offset: Math.max(Number(payload?.pagination?.offset) || 0, 0),
      };
      completedPages.set(requestUrl, result);
      return result;
    })();
    pendingPages.set(requestUrl, request);
    try {
      return await request;
    } finally {
      pendingPages.delete(requestUrl);
    }
  }

  async function loadAll(resource, options = {}) {
    const pageSize = Math.min(Math.max(Number(options.limit) || 100, 1), 100);
    const concurrency = Math.min(Math.max(Number(options.concurrency) || 1, 1), 6);
    const records = [];
    let offset = Math.max(Number(options.offset) || 0, 0);
    for (let page = 0; page < 100; page += concurrency) {
      const pageCount = Math.min(concurrency, 100 - page);
      const batches = await Promise.all(Array.from({ length: pageCount }, (_, index) => (
        load(resource, { ...options, limit: pageSize, offset: offset + (index * pageSize) })
      )));
      for (const batch of batches) {
        records.push(...batch);
        if (batch.length < pageSize) return records;
      }
      offset += pageSize * pageCount;
    }
    throw new Error(`The ${resource} catalog exceeded the safe pagination limit.`);
  }

  function coverHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "CUAC")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function coverInitials(value) {
    const words = String(value || "CUAC").trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!words.length) return "CU";
    if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
    return words.slice(0, 3).map((word) => Array.from(word)[0]).join("").toUpperCase();
  }

  function cover(kind, item = {}) {
    const palettes = [
      ["#083D3B", "#12A594", "#C7F0E9"], ["#143C6B", "#3C78B5", "#D9E9F7"],
      ["#51314D", "#A8577E", "#F5DCE8"], ["#5C3B16", "#D18B34", "#F6E4C6"],
      ["#253F2F", "#6C9B72", "#E0EBDD"], ["#3F315A", "#7762A7", "#E8E0F4"],
      ["#183F50", "#3994A8", "#D7EFF2"], ["#57322D", "#B76252", "#F4DDD7"],
    ];
    const title = item.nameEn || item.nameZh || item.title || "CUAC";
    const seed = [kind, item.id, item.slug, title, item.citySlug, item.fieldCategory].filter(Boolean).join("|");
    const hash = coverHash(seed);
    const scholarshipPalettes = {
      government: ["#15365F", "#2F70B7", "#DCEBFA"],
      university: ["#07514D", "#10A394", "#D1F0EA"],
      province: ["#70400F", "#D58B2D", "#F8E7C8"],
      partner: ["#58314F", "#A95882", "#F4DCE9"],
      other: ["#34464B", "#738C91", "#E2EAEB"],
    };
    const scholarshipType = String(item.type || "other").trim().toLowerCase();
    const [dark, accent, light] = kind === "scholarship"
      ? scholarshipPalettes[scholarshipType] || scholarshipPalettes.other
      : palettes[hash % palettes.length];
    const initials = coverInitials(title);
    const label = kind === "program"
      ? item.fieldCategory || item.subjectArea || item.degreeLevel || "Study program"
      : kind === "scholarship"
        ? item.providerNameEn || item.providerName || item.schoolName || item.typeLabel || "Funding route"
        : item.city || item.cityZh || item.region || item.province || "China university";
    const safeInitials = escapeHtml(initials);
    const safeLabel = escapeHtml(String(label).slice(0, 38));
    const motif = kind === "program"
      ? `<circle cx="760" cy="118" r="170" fill="none" stroke="${light}" stroke-width="34" opacity=".26"/><circle cx="760" cy="118" r="92" fill="none" stroke="white" stroke-width="3" opacity=".34"/><path d="M560 510 790 280 970 460" fill="none" stroke="white" stroke-width="16" opacity=".18"/>`
      : kind === "scholarship"
        ? `<circle cx="735" cy="302" r="122" fill="white" opacity=".1"/><circle cx="735" cy="302" r="82" fill="none" stroke="${light}" stroke-width="12" opacity=".55"/><path d="m692 374-24 106 67-37 67 37-24-106" fill="${light}" opacity=".28"/><path d="m735 242 18 37 41 6-30 29 7 41-36-19-36 19 7-41-30-29 41-6Z" fill="white" opacity=".48"/>`
        : `<path d="M500 470V280l150-82 150 82v190M540 470V315h220v155M390 470V350h110M800 470V350h110" fill="none" stroke="white" stroke-width="18" opacity=".22"/><path d="M355 486h590" stroke="white" stroke-width="10" opacity=".3"/>`;
    const kindLabel = kind === "program" ? "PROGRAM" : kind === "scholarship" ? "SCHOLARSHIP" : "UNIVERSITY";
    const identity = kind === "scholarship"
      ? `<circle cx="150" cy="304" r="82" fill="white" opacity=".14"/><circle cx="150" cy="304" r="66" fill="none" stroke="white" stroke-width="2" opacity=".6"/><text x="150" y="324" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="48" font-weight="700">${safeInitials}</text><text x="270" y="300" fill="white" font-family="Arial,sans-serif" font-size="31" font-weight="700">${kindLabel}</text><text x="270" y="342" fill="${light}" font-family="Arial,sans-serif" font-size="22">${safeLabel}</text>`
      : `<circle cx="148" cy="156" r="76" fill="white" opacity=".14"/><circle cx="148" cy="156" r="62" fill="none" stroke="white" stroke-width="2" opacity=".6"/><text x="148" y="176" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="50" font-weight="700">${safeInitials}</text><text x="80" y="500" fill="white" font-family="Arial,sans-serif" font-size="31" font-weight="700">${kindLabel}</text><text x="80" y="544" fill="${light}" font-family="Arial,sans-serif" font-size="22">${safeLabel}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${accent}"/></linearGradient><pattern id="p" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M0 46 46 0M-12 12 12-12M34 58 58 34" stroke="${light}" stroke-width="2" opacity=".09"/></pattern></defs><rect width="960" height="600" rx="24" fill="url(#g)"/><rect width="960" height="600" rx="24" fill="url(#p)"/>${motif}${identity}</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  async function requestSavedItems(path = "/api/v1/student/saved-items", options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("accept", "application/json");
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(messageFromPayload(payload, "Could not update saved items."));
      error.status = response.status;
      throw error;
    }
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
      throw new Error("The saved-item response is missing its data envelope.");
    }
    return payload.data;
  }

  async function loadSavedEntityIds(entityType) {
    const auth = global.CUAC;
    if (typeof auth?.authReady !== "function" || typeof auth?.isStudentSignedIn !== "function") return new Set();
    try {
      await auth.authReady();
    } catch {
      return new Set();
    }
    if (!auth.isStudentSignedIn()) return new Set();
    try {
      const items = await requestSavedItems();
      return new Set(items
        .filter((item) => item?.entityType === entityType && typeof item.entityId === "string")
        .map((item) => item.entityId));
    } catch (error) {
      if (error.status === 401 || error.status === 403) return new Set();
      throw error;
    }
  }

  async function setSaved(entityType, entityId, shouldSave) {
    if (shouldSave) {
      return requestSavedItems("/api/v1/student/saved-items", {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, notes: null }),
      });
    }
    const items = await requestSavedItems();
    const savedItem = items.find((item) => item?.entityType === entityType && item.entityId === entityId);
    if (!savedItem) return null;
    return requestSavedItems(`/api/v1/student/saved-items/${encodeURIComponent(savedItem.id)}`, { method: "DELETE" });
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

  function saveHeartIcon() {
    return `<svg class="catalog-save-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg>`;
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

  global.CuacCatalogList = Object.freeze({ load, loadPage, loadAll, cover, loadSavedEntityIds, setSaved, saveHeartIcon, escapeHtml, listState });
})(window);
