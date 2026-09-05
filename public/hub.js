const hubIcons = {
  scholarship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z"/></svg>',
  city: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 9.8 8.2 5 10.4l4.8 2.2L12 18l2.2-5.4 4.8-2.2-4.8-2.2L12 3Z"/><path d="M19 15v4"/><path d="M21 17h-4"/></svg>',
};

const dataClient = window.CuacDataClient;
const hubSummary = dataClient?.getStudentHubSummary?.() || {};
const routes = (hubSummary.routes || []).map((route) => ({ ...route }));
const documents = (hubSummary.documents || []).map((doc) => ({ ...doc }));

const APPLICATION_DEMO_STATE_KEY = "cuacApplicationDemoState";
const SCHOOL_PORTAL_DEMO_STATE_KEY = "cuacSchoolPortalDemoState";
const ONBOARDING_PREVIEW_KEY = "cuacOnboardingPreview";
const PREFERENCES_DEMO_STATE_KEY = "cuacPreferencesDemoState";

function readApplicationDemoState() {
  try {
    return JSON.parse(localStorage.getItem(APPLICATION_DEMO_STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function readSchoolPortalDemoState() {
  try {
    return JSON.parse(localStorage.getItem(SCHOOL_PORTAL_DEMO_STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function readOnboardingPreview() {
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_PREVIEW_KEY) || "null");
  } catch {
    return null;
  }
}

function readPreferencesState() {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_DEMO_STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function compactSubject(subject = "Computer Science") {
  if (/computer science/i.test(subject)) return "CS";
  if (/chinese language/i.test(subject)) return "Chinese language";
  return subject;
}

function compactApplicationMeta(entry = {}) {
  const text = entry.subtitle || "";
  if (/school/i.test(text)) {
    const parts = text.split("·").map((part) => part.trim()).filter(Boolean);
    return parts.filter((part) => !/^USD\b/i.test(part)).slice(0, 2).join(" · ");
  }
  return "3 schools · Oct 15";
}

function countMeta(countKey, value, suffix) {
  return (node) => {
    const count = document.createElement("b");
    count.dataset.count = countKey;
    count.textContent = value;
    node.replaceChildren(count, document.createTextNode(` ${suffix}`));
  };
}

function savedRouteMeta() {
  return (node) => {
    const saved = document.createElement("b");
    const days = document.createElement("b");
    saved.dataset.count = "saved";
    days.dataset.daysToCheck = "";
    saved.textContent = hubSummary.snapshot?.savedPrograms || 4;
    days.textContent = hubSummary.snapshot?.daysToCheck || 18;
    node.replaceChildren(saved, document.createTextNode(" saved routes · "), days, document.createTextNode(" days"));
  };
}

function setHubCard(cardName, { title, meta, href } = {}) {
  const card = document.querySelector(`[data-hub-card="${cardName}"]`);
  if (!card) return;
  if (href) card.setAttribute("href", href);
  const titleNode = card.querySelector("[data-hub-card-title]");
  const metaNode = card.querySelector("[data-hub-card-meta]");
  if (titleNode && title) titleNode.textContent = title;
  if (metaNode && typeof meta === "function") meta(metaNode);
  else if (metaNode && meta) metaNode.textContent = meta;
}

function updateHubActionCards(state) {
  const missing = document.querySelector('[data-count="documents"]')?.textContent?.trim() || "3";
  if (!state) {
    setHubCard("documents", { title: "Prepare documents", meta: countMeta("documents", missing, "items to check"), href: "guides.html#documents" });
    setHubCard("saved", { title: "Saved routes", meta: savedRouteMeta(), href: "favourites.html" });
    setHubCard("goal", { title: "Study goal", meta: "Intake · city · funding", href: "preferences.html" });
    return;
  }
  if (state.submittedToSchools) {
    setHubCard("documents", { title: "School requests", meta: countMeta("documents", missing, "to follow"), href: "application.html#send" });
    setHubCard("saved", { title: "Backup routes", meta: savedRouteMeta(), href: "favourites.html" });
    setHubCard("goal", { title: "Preferences", meta: "Alerts · language · budget", href: "preferences.html" });
    return;
  }
  setHubCard("documents", { title: "Check blockers", meta: countMeta("documents", missing, "documents left"), href: "guides.html#documents" });
  setHubCard("saved", { title: "Review routes", meta: savedRouteMeta(), href: "favourites.html" });
  setHubCard("goal", { title: "Update plan", meta: "Budget · city · language", href: "preferences.html" });
}

function setApplicationFlow(items) {
  document.querySelectorAll(".application-flow span").forEach((node, index) => {
    const item = items[index];
    if (!item) return;
    node.classList.toggle("done", Boolean(item.done));
    node.classList.toggle("active", Boolean(item.active));
    const label = node.querySelector("b");
    const status = node.querySelector("em");
    if (label) label.textContent = item.label;
    if (status) status.textContent = item.status;
  });
}

function setApplicationCta(label, href) {
  const action = document.querySelector(".application-top-action");
  if (!action) return;
  action.textContent = label;
  action.setAttribute("href", href);
}

function setRouteChecks(items = []) {
  const checks = document.querySelector(".route-checks");
  if (!checks) return;
  checks.replaceChildren(...items.filter(Boolean).map((item) => {
    const tag = document.createElement("span");
    tag.textContent = item;
    return tag;
  }));
}

function applyHubSummary() {
  const profile = document.querySelector("[data-profile-summary]");
  const title = document.querySelector("[data-route-title]");
  const copy = document.querySelector("[data-route-copy]");
  const checks = document.querySelector(".route-checks");
  const appTitle = document.querySelector("[data-application-title]");
  const appSubtitle = document.querySelector("[data-application-subtitle]");
  const appReadiness = document.querySelector("[data-application-readiness]");
  const appNext = document.querySelector("[data-application-next]");
  if (profile && hubSummary.profileLine) profile.textContent = hubSummary.profileLine;
  if (title && hubSummary.currentRoute?.title) title.textContent = hubSummary.currentRoute.title;
  if (copy && hubSummary.currentRoute?.copy) copy.textContent = hubSummary.currentRoute.copy;
  if (checks && Array.isArray(hubSummary.currentRoute?.checks)) setRouteChecks(hubSummary.currentRoute.checks);
  if (appTitle && hubSummary.applicationEntry?.title) appTitle.textContent = "Continue your application";
  if (appSubtitle && hubSummary.applicationEntry) appSubtitle.textContent = compactApplicationMeta(hubSummary.applicationEntry);
  if (appReadiness && hubSummary.applicationEntry?.readiness) appReadiness.textContent = hubSummary.applicationEntry.readiness;
  if (appNext && hubSummary.applicationEntry?.next) appNext.textContent = "Next: review choices";
  if (hubSummary.snapshot) {
    const saved = document.querySelector('[data-count="saved"]');
    if (saved && hubSummary.snapshot.savedPrograms != null) saved.textContent = hubSummary.snapshot.savedPrograms;
    const days = document.querySelector("[data-days-to-check]");
    if (days && hubSummary.snapshot.daysToCheck != null) days.textContent = hubSummary.snapshot.daysToCheck;
  }
  if (hubSummary.currentRoute?.readiness) {
    document.querySelectorAll("[data-readiness-label]").forEach((item) => {
      item.textContent = `${hubSummary.currentRoute.readiness}%`;
    });
    document.querySelectorAll("[data-readiness-bar]").forEach((item) => {
      item.style.width = `${hubSummary.currentRoute.readiness}%`;
    });
  }
}

function routeFromOnboarding(preview) {
  const level = preview?.level || "Master";
  const subject = preview?.subject || "Computer Science";
  const city = preview?.cities?.[0] || "Hangzhou";
  const isUndergraduate = /undergraduate/i.test(level);
  if (/business/i.test(subject)) {
    return {
      university: "UIBE",
      program: isUndergraduate ? "International Business BA" : "International Trade MSc",
      city: city === "Hangzhou" ? "Beijing" : city,
    };
  }
  if (/engineering/i.test(subject)) {
    return {
      university: city === "Shanghai" ? "Tongji University" : "Nanjing University",
      program: isUndergraduate ? "Civil Engineering BEng" : "Software Engineering MSc",
      city,
    };
  }
  if (/medicine/i.test(subject)) {
    return {
      university: "Sichuan University",
      program: isUndergraduate ? "Clinical Medicine MBBS" : "Biomedical Engineering MSc",
      city: city === "Hangzhou" ? "Chengdu" : city,
    };
  }
  if (/chinese language/i.test(subject)) {
    return {
      university: "Beijing Language and Culture University",
      program: "Chinese Language Non-degree",
      city: city === "Hangzhou" ? "Beijing" : city,
    };
  }
  return {
    university: "Zhejiang University",
    program: isUndergraduate ? "Computer Science BSc" : "Computer Science MSc",
    city,
  };
}

function routeFromPreferences(workspace = {}) {
  const goal = workspace.goal || {};
  return routeFromOnboarding({
    level: goal.degreeLevel || "Master",
    subject: goal.subjectFocus || "Computer Science",
    cities: goal.preferredCities || ["Hangzhou"],
  });
}

function applyOnboardingPreview() {
  const preview = readOnboardingPreview();
  if (!preview) return;
  const route = routeFromOnboarding(preview);
  const level = preview.level || "Master";
  const subject = preview.subject || "Computer Science";
  const intake = preview.intake || "Fall 2026";
  const language = preview.language || "English-taught";
  const funding = preview.funding || "Prefer partial scholarship";
  const focus = preview.focus || "Program shortlist";
  const nationality = preview.nationality || preview.currentCountry || "";
  const stage = preview.stage || "";
  const readiness = preview.readiness || {};
  const profile = document.querySelector("[data-profile-summary]");
  const title = document.querySelector("[data-route-title]");
  const copy = document.querySelector("[data-route-copy]");
  const applicationNext = document.querySelector("[data-application-next]");

  if (profile) profile.textContent = `${level} · ${compactSubject(subject)} · ${intake} · ${language}`;
  if (title) title.textContent = `${route.university} · ${route.program}`;
  if (copy) {
    const context = [nationality ? `from ${nationality}` : "", stage].filter(Boolean).join(" · ");
    copy.textContent = `Based on your goal: ${level} ${subject} in ${route.city}${context ? ` · ${context}` : ""}.`;
  }
  if (applicationNext) {
    applicationNext.textContent = "Next: add choices";
  }
  setRouteChecks([intake, route.city, language, funding]);
  routes[0] = {
    ...routes[0],
    program: route.program,
    university: route.university,
    city: route.city,
    signal: language,
    action: focus === "Documents" ? "Build checklist" : "Review route",
  };
  applyOnboardingReadiness(readiness);
}

function applyOnboardingReadiness(readiness = {}) {
  const hasReadiness = Object.keys(readiness || {}).length > 0;
  if (!hasReadiness) return;
  const mapping = [
    { key: "passport", pattern: /passport/i, ready: "Ready from onboarding", missing: "Add passport details" },
    { key: "transcript", pattern: /transcript|grades/i, ready: "Ready from onboarding", missing: "Upload or request transcript" },
    { key: "graduation", pattern: /graduation|certificate/i, ready: "Ready from onboarding", missing: "Graduation proof later" },
    { key: "language", pattern: /ielts|toefl|hsk|language/i, ready: "Ready from onboarding", missing: "Language proof needed" },
    { key: "translation", pattern: /translation|notarization/i, ready: "Ready from onboarding", missing: "Translate before school follow-up" },
  ];
  documents.forEach((doc) => {
    const match = mapping.find((item) => item.pattern.test(`${doc.label} ${doc.detail}`));
    if (!match || readiness[match.key] == null) return;
    doc.checked = Boolean(readiness[match.key]);
    doc.status = doc.checked ? match.ready : match.missing;
  });
}

function applyPreferenceReadiness(readiness = {}) {
  if (!Object.keys(readiness || {}).length) return;
  applyOnboardingReadiness({
    passport: readiness.passportScan,
    transcript: readiness.transcriptTranslation,
    language: readiness.languageEvidence,
    translation: readiness.transcriptTranslation,
  });
}

function readinessStats(readiness = {}) {
  const values = Object.values(readiness).filter((value) => typeof value === "boolean");
  if (!values.length) return null;
  const missing = values.filter((value) => !value).length;
  return { missing, total: values.length };
}

function getReadinessContext(defaultMissing, defaultTotal) {
  const preferenceReadiness = readPreferencesState()?.workspace?.readiness;
  const preferenceStats = readinessStats(preferenceReadiness);
  if (preferenceStats) return preferenceStats;

  const preview = readOnboardingPreview();
  if (Number.isFinite(preview?.readinessReadyCount) && Number.isFinite(preview?.readinessTotal)) {
    return {
      missing: Math.max(0, preview.readinessTotal - preview.readinessReadyCount),
      total: Math.max(1, preview.readinessTotal),
    };
  }

  const onboardingStats = readinessStats(preview?.readiness);
  return onboardingStats || { missing: defaultMissing, total: defaultTotal };
}

function applyPreferencesState() {
  const workspace = readPreferencesState()?.workspace;
  if (!workspace) return;
  const goal = workspace.goal || {};
  const budget = workspace.budget || {};
  const route = routeFromPreferences(workspace);
  const level = goal.degreeLevel || "Master";
  const subject = goal.subjectFocus || "Computer Science";
  const intake = goal.intake || "Fall 2026";
  const language = goal.teachingLanguage || "English-taught";
  const funding = budget.scholarshipPriority || "Prefer partial scholarship";
  const profile = document.querySelector("[data-profile-summary]");
  const title = document.querySelector("[data-route-title]");
  const copy = document.querySelector("[data-route-copy]");
  const applicationNext = document.querySelector("[data-application-next]");

  if (profile) profile.textContent = `${level} · ${compactSubject(subject)} · ${intake} · ${language}`;
  if (title) title.textContent = `${route.university} · ${route.program}`;
  if (copy) {
    copy.textContent = `Based on your plan: ${level} ${subject} in ${route.city}.`;
  }
  if (applicationNext) applicationNext.textContent = "Next: review choices";
  setRouteChecks([intake, route.city, language, funding]);
  routes[0] = {
    ...routes[0],
    program: route.program,
    university: route.university,
    city: route.city,
    signal: language,
    action: "Review route",
  };
  applyPreferenceReadiness(workspace.readiness || {});
}

document.querySelectorAll("[data-hub-icon]").forEach((target) => {
  target.innerHTML = hubIcons[target.dataset.hubIcon] || "";
});

function renderRoutes() {
  const list = document.querySelector("[data-route-list]");
  if (!list) return;
  list.innerHTML = routes
    .map(
      (route, index) => `
        <article class="route-card ${index === 0 ? "primary" : ""}">
          <span class="route-index">${index + 1}</span>
          <div class="route-main">
            <span class="route-badge">${route.kind}</span>
            <h3>${route.program}</h3>
            <p>${route.university} · ${route.city}</p>
            <div class="route-meta">
              <span>${route.deadline}</span>
              <span>${route.tuition}</span>
              <span>${route.status}</span>
              <span>${route.signal}</span>
            </div>
          </div>
          <div class="route-actions">
            <button type="button" class="${route.compared ? "active" : ""}" data-compare="${index}">${route.compared ? "Compared" : "Compare"}</button>
            <a class="${route.href === "application.html" ? "primary-route-action" : ""}" href="${route.href}">${route.action}</a>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderDocuments() {
  const list = document.querySelector("[data-document-list]");
  if (!list) return;
  list.innerHTML = documents
    .map(
      (doc, index) => `
        <label class="document-item">
          <input type="checkbox" ${doc.checked ? "checked" : ""} data-document="${index}" />
          <span><strong>${doc.label}</strong><span>${doc.detail}</span></span>
          <em class="status ${doc.checked ? "ready" : ""}">${doc.status}</em>
        </label>
      `,
    )
    .join("");
}

function updateSnapshot() {
  const readinessContext = getReadinessContext(documents.filter((doc) => !doc.checked).length, documents.length);
  const missing = readinessContext.missing;
  const readiness = Math.round(((readinessContext.total - missing) / readinessContext.total) * 54 + 28);
  const applicationState = readApplicationDemoState();
  const documentCount = document.querySelector('[data-count="documents"]');
  const choiceCount = document.querySelector('[data-count="choices"]');
  if (documentCount) documentCount.textContent = missing;
  if (applicationState?.choiceCount) {
    if (choiceCount) choiceCount.textContent = applicationState.submittedToSchools ? applicationState.schoolCount : applicationState.choiceCount;
  }
  document.querySelectorAll("[data-readiness-label]").forEach((item) => {
    item.textContent = `${readiness}%`;
  });
  document.querySelectorAll("[data-readiness-bar]").forEach((item) => {
    item.style.width = `${readiness}%`;
  });
}

function updateApplicationEntry() {
  const state = readApplicationDemoState();
  const portalState = readSchoolPortalDemoState();
  const contactedSchools = portalState?.contactedSchools || [];
  const schoolFollowups = Object.values(portalState?.schoolFollowups || {}).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const latestFollowup = schoolFollowups[0];
  const grid = document.querySelector(".application-entry-grid");
  const title = document.querySelector("[data-application-title]");
  const subtitle = document.querySelector("[data-application-subtitle]");
  const readiness = document.querySelector("[data-application-readiness]");
  const next = document.querySelector("[data-application-next]");
  const ring = document.querySelector(".application-ring");
  const card = document.querySelector(".application-current-card");
  const applicationLabel = document.querySelector(".application-entry-topline span");
  const routeLabel = document.querySelector("[data-route-label]");
  const readinessCaption = document.querySelector("[data-readiness-caption]");

  if (!state) {
    grid?.classList.add("no-current-application");
    ring?.classList.remove("word-value");
    if (applicationLabel) applicationLabel.textContent = "Application setup";
    if (routeLabel) routeLabel.textContent = "Suggested first choice";
    if (readinessCaption) readinessCaption.textContent = "route fit";
    title.textContent = "Start your application";
    subtitle.textContent = "Choose one school and program to begin.";
    readiness.textContent = "0%";
    next.textContent = "Start here";
    setApplicationCta("Start", "application.html");
    setApplicationFlow([
      { label: "Choices", status: "start here", active: true },
      { label: "Info", status: "later" },
      { label: "Fee", status: "later" },
      { label: "Send", status: "locked" },
    ]);
    ring?.setAttribute("aria-label", "Application not started");
    card?.classList.remove("submitted");
    updateHubActionCards(state);
    return;
  }

  grid?.classList.remove("no-current-application");
  ring?.classList.remove("word-value");
  if (applicationLabel) applicationLabel.textContent = "Fall 2026 application";
  if (routeLabel) routeLabel.textContent = "Route";
  if (readinessCaption) readinessCaption.textContent = "ready";
  setApplicationCta("Open", "application.html");

  if (state.submittedToSchools) {
    setApplicationFlow([
      { label: "Choices", status: "done", done: true },
      { label: "Info", status: "done", done: true },
      { label: "Fee", status: "done", done: true },
      { label: "Send", status: "sent", done: true },
    ]);
    if (latestFollowup?.statusKey === "waiting-documents") {
      title.textContent = "Documents needed";
      subtitle.textContent = `${latestFollowup.school} · ${latestFollowup.programName}`;
      readiness.textContent = "Docs";
      ring?.classList.add("word-value");
      next.textContent = "Next: upload by school request";
      ring?.setAttribute("aria-label", "School waiting for student documents");
    } else if (latestFollowup?.statusKey === "contacted" || contactedSchools.length) {
      const school = latestFollowup?.school || contactedSchools[0];
      title.textContent = "School contacted you";
      subtitle.textContent = `${school} · check email`;
      readiness.textContent = "Contact";
      ring?.classList.add("word-value");
      next.textContent = "Next: reply to school";
      ring?.setAttribute("aria-label", "School contacted student");
    } else if (latestFollowup?.statusKey === "viewed") {
      title.textContent = "School viewed your record";
      subtitle.textContent = `${latestFollowup.school} · ${latestFollowup.programName}`;
      readiness.textContent = "Viewed";
      ring?.classList.add("word-value");
      next.textContent = "Next: wait for contact";
      ring?.setAttribute("aria-label", "School viewed application record");
    } else {
      title.textContent = "Application sent";
      subtitle.textContent = `${state.schoolCount} school${state.schoolCount === 1 ? "" : "s"} · track status`;
      readiness.textContent = "Sent";
      ring?.classList.add("word-value");
      next.textContent = "Next: track status";
      ring?.setAttribute("aria-label", "Application sent to schools");
    }
    card?.classList.add("submitted");
    updateHubActionCards(state);
    return;
  }

  if (state.choiceCount) {
    title.textContent = "Ready to review";
    subtitle.textContent = `${state.schoolCount} school${state.schoolCount === 1 ? "" : "s"} · fee review next`;
    readiness.textContent = "Review";
    ring?.classList.add("word-value");
    next.textContent = "Next: review fee";
    setApplicationFlow([
      { label: "Choices", status: "done", done: true },
      { label: "Info", status: "next", active: true },
      { label: "Fee", status: "later" },
      { label: "Send", status: "locked" },
    ]);
    ring?.setAttribute("aria-label", "Application ready to review");
  }
  updateHubActionCards(state);
}

function showHubAgentNotice(message) {
  let notice = document.querySelector("[data-hub-agent-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "hub-agent-notice";
    notice.dataset.hubAgentNotice = "";
    document.querySelector(".hub-overview")?.prepend(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function captureHubState() {
  return {
    routes: routes.map((route) => ({ ...route })),
    documents: documents.map((doc) => ({ ...doc })),
    notice: document.querySelector("[data-hub-agent-notice]")?.textContent || "",
  };
}

function restoreHubState(snapshot) {
  if (!snapshot) return;
  routes.splice(0, routes.length, ...(snapshot.routes || []).map((route) => ({ ...route })));
  documents.splice(0, documents.length, ...(snapshot.documents || []).map((doc) => ({ ...doc })));
  renderRoutes();
  renderDocuments();
  updateSnapshot();
  const notice = document.querySelector("[data-hub-agent-notice]");
  if (notice) {
    notice.textContent = snapshot.notice;
    notice.classList.toggle("visible", Boolean(snapshot.notice));
  }
}

function applyHubAgentAction(action, detail = {}) {
  const before = captureHubState();
  if (action === "compare-routes") {
    routes.forEach((route) => {
      route.compared = true;
    });
    renderRoutes();
    updateSnapshot();
    showHubAgentNotice("Agent compared all saved routes and updated your snapshot.");
    document.querySelector("#shortlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "save-checklist") {
    documents.forEach((doc) => {
      doc.checked = doc.label === "Passport" || doc.label === "Transcript";
      doc.status = doc.checked ? "Ready" : doc.status;
    });
    renderDocuments();
    updateSnapshot();
    showHubAgentNotice("Agent prepared a document checklist and marked the shared items first.");
    document.querySelector("#documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
    detail.setUndo?.(before);
    return true;
  }
  if (action === "open-choice-modal") {
    window.location.href = "application.html#add-choice";
    return true;
  }
  if (action === "confirm-choice-order") {
    window.location.href = "application.html";
    return true;
  }
  if (action === "save-program-shortlist" || action === "apply-smart-filters") {
    showHubAgentNotice("Agent refreshed your saved-route workspace from current CUAC data.");
    routes[0].compared = true;
    routes[2].compared = true;
    renderRoutes();
    updateSnapshot();
    detail.setUndo?.(before);
    return true;
  }
  return false;
}

document.addEventListener("click", (event) => {
  const compare = event.target.closest("[data-compare]");
  if (compare) {
    const index = Number(compare.dataset.compare);
    routes[index].compared = !routes[index].compared;
    renderRoutes();
    updateSnapshot();
  }

  const scroll = event.target.closest("[data-scroll-feed]");
  if (scroll) {
    const row = document.querySelector("[data-feed-row]");
    row?.scrollBy({ left: Number(scroll.dataset.scrollFeed) * 340, behavior: "smooth" });
  }
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-document]");
  if (!checkbox) return;
  const index = Number(checkbox.dataset.document);
  documents[index].checked = checkbox.checked;
  documents[index].status = checkbox.checked ? "Ready" : documents[index].status === "Ready" ? "Needs review" : documents[index].status;
  renderDocuments();
  updateSnapshot();
});

document.addEventListener("cuac:agent-action", (event) => {
  if (applyHubAgentAction(event.detail?.action || "", event.detail || {})) event.preventDefault();
});

document.addEventListener("cuac:agent-undo", (event) => {
  if (!event.detail?.undo) return;
  restoreHubState(event.detail.undo);
  event.preventDefault();
});

applyHubSummary();
applyOnboardingPreview();
applyPreferencesState();
renderRoutes();
renderDocuments();
updateSnapshot();
updateApplicationEntry();
