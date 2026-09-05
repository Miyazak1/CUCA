const authIcons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a6 6 0 0 0 6-6V8"/></svg>',
};

const authParams = new URLSearchParams(window.location.search);
const runtimeStatus = document.querySelector("[data-auth-runtime-status]");
const registerTab = document.querySelector('[data-auth-tab="register"]');
const schoolField = document.querySelector("[data-school-login-field]");
const schoolSelect = document.querySelector("[data-auth-school-id]");
let pendingContinuation = readContinuationCapability();

const roleProfiles = {
  student: {
    requestSurface: "student",
    activeRole: "student",
    eyebrow: "CUAC account · Student workspace",
    title: "Keep every China application step in one place",
    lead: "Use one CUAC account to save programs, manage application records, prepare documents, and track deadlines.",
    signinTitle: "Welcome back",
    signinCopy: "Continue your saved China study shortlist and application work.",
    signinButton: "Sign in to Hub",
    nextTitle: "After sign in",
    nextCopy: "New accounts complete a short setup before entering Hub.",
    nextHref: "hub.html",
    nextLabel: "Open Hub",
    registerHref: "onboarding.html",
    emailPlaceholder: "you@example.com",
  },
  school: {
    requestSurface: "school_staff",
    activeRole: "school_staff",
    eyebrow: "CUAC account · School workspace",
    title: "Review your university's CUAC applicant queue",
    lead: "School access is checked against an active staff membership for the selected university. Staff can only enter their own tenant workspace.",
    signinTitle: "Sign in to the school workspace",
    signinCopy: "Choose your university and sign in with an account that has an active school staff membership.",
    signinButton: "Sign in to school portal",
    nextTitle: "School access boundary",
    nextCopy: "School users see only records projected to their own university tenant.",
    nextHref: "school-portal.html",
    nextLabel: "Open school portal",
    emailPlaceholder: "name@university.edu",
  },
  ops: {
    requestSurface: "cuac_internal",
    activeRole: "cuac_ops",
    eyebrow: "CUAC account · Internal workspace",
    title: "Operate CUAC through governed internal access",
    lead: "Internal roles are assigned by CUAC administrators. Authentication never grants cross-tenant access by itself.",
    signinTitle: "Sign in to CUAC staff tools",
    signinCopy: "Use an account with an active Ops or Admin access grant.",
    signinButton: "Sign in to staff tools",
    nextTitle: "Internal access boundary",
    nextCopy: "Internal actions remain permission checked and auditable.",
    nextHref: "ops-admin.html",
    nextLabel: "Open staff tools",
    emailPlaceholder: "name@cuac.com",
  },
};

let currentRole = "student";
let currentMode = "signin";
let schoolsLoaded = false;

document.querySelectorAll("[data-auth-icon]").forEach((target) => {
  target.innerHTML = authIcons[target.dataset.authIcon] || "";
});

function normalizeAuthRole(role) {
  const value = String(role || "").toLowerCase();
  if (["school", "school_staff", "school-staff", "staff"].includes(value)) return "school";
  if (["ops", "admin", "cuac_ops", "cuac_admin", "cuac-internal", "cuac_internal", "internal"].includes(value)) return "ops";
  return "student";
}

function setText(selector, value) {
  const target = document.querySelector(selector);
  if (target) target.textContent = value;
}

function setStatus(message = "", state = "") {
  if (!runtimeStatus) return;
  runtimeStatus.textContent = message;
  if (state) runtimeStatus.dataset.state = state;
  else delete runtimeStatus.dataset.state;
}

function setMode(requestedMode) {
  const mode = requestedMode === "register" && currentRole !== "student" ? "signin" : requestedMode;
  currentMode = ["signin", "register", "reset"].includes(mode) ? mode : "signin";
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    const active = tab.dataset.authTab === currentMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.authPanel === currentMode);
  });
}

function readContinuationCapability() {
  if (authParams.get("continue") !== "1") return null;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const capability = fragment.get("continuation") || "";
  const match = capability.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return match ? { continuationId: match[1], continuationToken: match[2] } : null;
}

function safeLocalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin || !["http:", "https:"].includes(url.protocol)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function destinationFor(role, registering = false) {
  if (registering) return roleProfiles.student.registerHref;
  return roleProfiles[role].nextHref;
}

function setRole(role) {
  currentRole = normalizeAuthRole(role);
  const profile = roleProfiles[currentRole];
  const hasContinuation = Boolean(pendingContinuation);

  document.querySelectorAll("[data-auth-role]").forEach((button) => {
    const active = button.dataset.authRole === currentRole;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  setText("[data-auth-eyebrow]", profile.eyebrow);
  setText("[data-auth-title]", profile.title);
  setText("[data-auth-lead]", profile.lead);
  setText("[data-signin-title]", profile.signinTitle);
  setText("[data-signin-copy]", profile.signinCopy);
  setText("[data-auth-submit]", profile.signinButton);
  setText("[data-next-title]", hasContinuation ? "Continue after sign in" : profile.nextTitle);
  setText("[data-next-copy]", hasContinuation ? "CUAC will consume the server-verified saved navigation after this account and role are authorized." : profile.nextCopy);

  const nextLink = document.querySelector("[data-next-link]");
  if (nextLink) {
    nextLink.href = destinationFor(currentRole);
    nextLink.textContent = hasContinuation ? "Continue task" : profile.nextLabel;
  }

  document.querySelectorAll('input[type="email"]').forEach((input) => {
    input.placeholder = profile.emailPlaceholder;
  });

  const isStudent = currentRole === "student";
  if (registerTab) {
    registerTab.disabled = !isStudent;
    registerTab.setAttribute("aria-disabled", isStudent ? "false" : "true");
    registerTab.title = isStudent ? "" : "School and CUAC staff roles must be granted by an authorized administrator.";
  }
  if (!isStudent && currentMode === "register") setMode("signin");

  if (schoolField && schoolSelect) {
    schoolField.hidden = currentRole !== "school";
    schoolSelect.required = currentRole === "school";
  }
  if (currentRole === "school") void loadSchools();

  const resetAccountType = document.querySelector("[data-reset-account-type]");
  if (resetAccountType) resetAccountType.value = currentRole;

  const continuationStrip = document.querySelector("[data-auth-continuation-strip]");
  continuationStrip?.classList.toggle("hidden", !hasContinuation);
  if (hasContinuation) {
    setText("[data-auth-continuation-title]", "Navigation secured for after sign in");
    setText("[data-auth-continuation-copy]", "The one-time continuation is bound to this browser session and will be rechecked by the server before redirecting.");
  }

  setStatus(
    isStudent ? "" : "School and CUAC staff accounts use administrator-granted access. Self-registration creates student accounts only.",
  );
}

async function requestJson(path, options = {}) {
  const requestOptions = {
    method: options.method || "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", ...(options.headers || {}) },
  };
  if (Object.prototype.hasOwnProperty.call(options, "body")) {
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, requestOptions);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "The request could not be completed.");
    error.code = payload?.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return payload?.data;
}

function validateConsumedContinuation(value, role) {
  const targetRoute = safeLocalUrl(value?.targetRoute);
  const actionKey = value?.actionKey;
  const requiredRole = value?.requiredRole;
  const normalizedRole = normalizeAuthRole(role);
  const roleAllowed = requiredRole === "student"
    ? normalizedRole === "student"
    : requiredRole === "school_staff"
      ? normalizedRole === "school"
      : requiredRole === "cuac_ops"
        ? normalizedRole === "ops"
        : requiredRole === "cuac_admin"
          ? String(role || "").toLowerCase() === "cuac_admin"
          : false;
  const routeAllowed = (
    (actionKey === "application.add_choice" && ["/application.html", "/application.html#add-choice"].includes(targetRoute))
    || (actionKey === "navigation.open_student_workspace" && ["/onboarding.html", "/hub.html", "/favourites.html", "/application.html", "/billing.html", "/notifications.html", "/preferences.html"].includes(targetRoute))
    || (actionKey === "navigation.open_school_workspace" && ["/school-portal.html", "/school-settings.html"].includes(targetRoute))
    || (actionKey === "navigation.open_ops_workspace" && targetRoute === "/ops-admin.html")
  );
  return roleAllowed && routeAllowed ? targetRoute : null;
}

async function consumePendingContinuation(role) {
  if (!pendingContinuation) return null;
  const capability = pendingContinuation;
  const consumed = await requestJson(`/api/v1/auth/sign-in-continuations/${encodeURIComponent(capability.continuationId)}/consume`, {
    method: "POST",
    body: { continuationToken: capability.continuationToken },
  });
  const targetRoute = validateConsumedContinuation(consumed, role);
  if (!targetRoute) throw new Error("The server returned an unregistered continuation destination.");
  pendingContinuation = null;
  return targetRoute;
}

async function loadSchools() {
  if (schoolsLoaded || !schoolSelect) return;
  schoolSelect.disabled = true;
  schoolSelect.replaceChildren(new Option("Loading published universities...", ""));
  try {
    const schools = await requestJson("/api/v1/catalog/schools?limit=100");
    schoolSelect.replaceChildren(new Option("Choose your university", ""));
    (Array.isArray(schools) ? schools : []).forEach((school) => {
      if (typeof school?.id !== "string" || typeof school?.nameEn !== "string") return;
      const label = school.nameZh ? `${school.nameEn} · ${school.nameZh}` : school.nameEn;
      schoolSelect.append(new Option(label, school.id));
    });
    schoolsLoaded = true;
    if (schoolSelect.options.length === 1) {
      schoolSelect.options[0].textContent = "No published universities are available";
    }
  } catch (error) {
    schoolSelect.replaceChildren(new Option("Universities could not be loaded", ""));
    setStatus(error.message, "error");
  } finally {
    schoolSelect.disabled = false;
  }
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return () => {};
  const originalLabel = button.textContent;
  button.disabled = busy;
  if (busy && busyLabel) button.textContent = busyLabel;
  return () => {
    button.disabled = false;
    button.textContent = originalLabel;
  };
}

async function handleSignIn(form) {
  if (!form.reportValidity()) return;
  const email = form.querySelector("[data-auth-email]")?.value.trim();
  const password = form.querySelector("[data-auth-password]")?.value;
  const schoolId = currentRole === "school" ? schoolSelect?.value : undefined;
  if (currentRole === "school" && !schoolId) {
    schoolSelect?.focus();
    setStatus("Choose the university connected to your staff membership.", "error");
    return;
  }

  const button = form.querySelector("[data-auth-submit]");
  const restore = setButtonBusy(button, true, "Signing in...");
  setStatus("Checking your account and workspace permission...");
  try {
    const session = await requestJson("/api/v1/auth/sessions", {
      method: "POST",
      body: {
        email,
        password,
        selectedSurface: roleProfiles[currentRole].requestSurface,
        ...(schoolId ? { schoolId } : {}),
      },
    });
    const serverRole = normalizeAuthRole(session?.activeRole);
    const destination = await consumePendingContinuation(session?.activeRole) || destinationFor(serverRole);
    setStatus("Signed in. Opening the authorized workspace...", "success");
    window.setTimeout(() => window.location.assign(destination), 350);
  } catch (error) {
    setStatus(error.message, "error");
    restore();
  }
}

async function handleRegister(form) {
  if (currentRole !== "student") {
    setMode("signin");
    setStatus("School and CUAC staff roles must be granted by an authorized administrator.", "error");
    return;
  }
  if (!form.reportValidity()) return;

  const firstName = form.querySelector("[data-register-first-name]")?.value.trim() || "";
  const lastName = form.querySelector("[data-register-last-name]")?.value.trim() || "";
  const email = form.querySelector("[data-register-email]")?.value.trim();
  const password = form.querySelector("[data-register-password]")?.value;
  const button = form.querySelector("[data-auth-register-submit]");
  const restore = setButtonBusy(button, true, "Creating account...");
  setStatus("Creating your student account securely...");

  try {
    await requestJson("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, displayName: `${firstName} ${lastName}`.trim() },
    });

    let verificationMessage = "Account created.";
    try {
      const verification = await requestJson("/api/v1/auth/email-verification", { method: "POST", body: {} });
      verificationMessage = verification?.deliveryStatus === "queued"
        ? "Account created. Check your email for the verification link."
        : "Account created. Email verification is pending delivery configuration.";
    } catch {
      verificationMessage = "Account created. Email verification could not be queued yet; you can request it again after sign in.";
    }

    const destination = await consumePendingContinuation("student") || destinationFor("student", true);
    setStatus(`${verificationMessage} Opening the authorized next step...`, "success");
    window.setTimeout(() => window.location.assign(destination), 700);
  } catch (error) {
    setStatus(error.message, "error");
    restore();
  }
}

async function handleResetRequest(form) {
  if (!form.reportValidity()) return;
  const email = form.querySelector("[data-reset-email]")?.value.trim();
  const button = form.querySelector("[data-auth-reset-submit]");
  const restore = setButtonBusy(button, true, "Sending reset link...");
  setStatus("Requesting a secure password reset...");
  try {
    await requestJson("/api/v1/auth/password-reset", { method: "POST", body: { email } });
    setStatus("If an eligible account exists, a password reset link has been queued.", "success");
    form.reset();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    restore();
  }
}

async function loadCurrentActor() {
  try {
    const actor = await requestJson("/api/v1/me");
    if (!actor?.actorUserId || actor.activeRole === "guest") return;
    const role = normalizeAuthRole(actor.activeRole);
    setRole(role);
    const destination = await consumePendingContinuation(actor.activeRole) || destinationFor(role);
    if (pendingContinuation === null && authParams.get("continue") === "1") {
      window.location.assign(destination);
      return;
    }
    const nextLink = document.querySelector("[data-next-link]");
    if (nextLink) nextLink.href = destination;
    setStatus("You are already signed in with a server-verified session.", "success");
  } catch {
    setStatus("Account status could not be checked. You can still sign in below.");
  }
}

document.addEventListener("click", (event) => {
  const roleButton = event.target.closest("[data-auth-role]");
  if (roleButton) {
    setRole(roleButton.dataset.authRole);
    return;
  }

  const tab = event.target.closest("[data-auth-tab]");
  if (tab && !tab.disabled) {
    setMode(tab.dataset.authTab);
    setStatus("");
    return;
  }

  if (event.target.closest("[data-auth-reset-trigger]")) {
    event.preventDefault();
    setMode("reset");
    history.replaceState(null, "", "#reset");
    setStatus("");
    return;
  }

  if (event.target.closest("[data-auth-back-to-signin]")) {
    setMode("signin");
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    setStatus("");
  }
});

document.querySelectorAll(".auth-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.dataset.authPanel === "signin") void handleSignIn(form);
    else if (form.dataset.authPanel === "register") void handleRegister(form);
    else if (form.dataset.authPanel === "reset") void handleResetRequest(form);
  });
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((target) => revealObserver.observe(target));
} else {
  document.querySelectorAll(".reveal").forEach((target) => target.classList.add("visible"));
}

setRole(normalizeAuthRole(authParams.get("role")));
if (window.location.hash === "#reset") setMode("reset");
else if (authParams.get("mode") === "register") setMode("register");
if (authParams.get("continue") === "1" && !pendingContinuation) {
  setStatus("This continuation link is missing or invalid. Sign in to open your normal workspace.", "error");
}
void loadCurrentActor();

window.addEventListener("hashchange", () => {
  setMode(window.location.hash === "#reset" ? "reset" : "signin");
});
