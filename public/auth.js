const authIcons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a6 6 0 0 0 6-6V8"/></svg>',
};

const authParams = new URLSearchParams(window.location.search);
const authI18n = window.CUACAuthI18n;
const authUi = value => authI18n?.ui(value) || value;
const runtimeStatus = document.querySelector("[data-auth-runtime-status]");
const workspacePicker = document.querySelector("[data-workspace-picker]");
const workspaceOptions = document.querySelector("[data-workspace-options]");
let pendingContinuation = readContinuationCapability();
let availableWorkspaces = [];
let pendingMfa = null;
let completedMfaSession = null;

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
    nextHref: "hub-api.html",
    nextLabel: "Open Hub",
    registerHref: "onboarding-api.html",
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
    nextHref: "ops-admin-api.html",
    nextLabel: "Open staff tools",
    emailPlaceholder: "name@cuac.com",
  },
};

let currentRole = "student";
let currentMode = "signin";

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
  if (target) target.textContent = authUi(value);
}

function setStatus(message = "", state = "") {
  if (!runtimeStatus) return;
  runtimeStatus.textContent = authUi(message);
  if (state) runtimeStatus.dataset.state = state;
  else delete runtimeStatus.dataset.state;
}

function setMode(requestedMode) {
  currentMode = ["signin", "register", "reset", "mfa"].includes(requestedMode) ? requestedMode : "signin";
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
  const destination = registering ? roleProfiles.student.registerHref : roleProfiles[role].nextHref;
  return authI18n?.href(destination) || destination;
}

function setRole(role) {
  currentRole = normalizeAuthRole(role);
  const profile = roleProfiles[currentRole];
  const hasContinuation = Boolean(pendingContinuation);
  setText("[data-next-title]", hasContinuation ? "Continue after sign in" : profile.nextTitle);
  setText("[data-next-copy]", hasContinuation ? "CUAC will consume the server-verified saved navigation after this account and role are authorized." : profile.nextCopy);

  const nextLink = document.querySelector("[data-next-link]");
  if (nextLink) {
    nextLink.href = destinationFor(currentRole);
    nextLink.textContent = authUi(hasContinuation ? "Continue task" : profile.nextLabel);
    nextLink.href = authI18n?.href(nextLink.getAttribute("href")) || nextLink.href;
  }

  const continuationStrip = document.querySelector("[data-auth-continuation-strip]");
  continuationStrip?.classList.toggle("hidden", !hasContinuation);
  if (hasContinuation) {
    setText("[data-auth-continuation-title]", "Navigation secured for after sign in");
    setText("[data-auth-continuation-copy]", "The one-time continuation is bound to this browser session and will be rechecked by the server before redirecting.");
  }

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
    const error = new Error(payload?.error?.message || authUi("The request could not be completed."));
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
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    || (actionKey === "catalog.save_program" && targetRoute === "/programs.html" && uuidPattern.test(value?.payloadPreview?.programId || ""))
    || (actionKey === "catalog.save_school" && targetRoute === "/universities.html" && uuidPattern.test(value?.payloadPreview?.schoolId || ""))
    || (actionKey === "catalog.save_scholarship" && targetRoute === "/scholarships.html" && uuidPattern.test(value?.payloadPreview?.scholarshipId || ""))
    || (actionKey === "navigation.open_student_workspace" && ["/onboarding-api.html", "/hub-api.html", "/favourites-api.html", "/application.html", "/billing-api.html", "/notifications.html", "/preferences-api.html"].includes(targetRoute))
    || (actionKey === "navigation.open_school_workspace" && ["/school-portal.html", "/school-settings-api.html"].includes(targetRoute))
    || (actionKey === "navigation.open_ops_workspace" && targetRoute === "/ops-admin-api.html")
  );
  return roleAllowed && routeAllowed ? { targetRoute, actionKey, payloadPreview: value.payloadPreview || {} } : null;
}

async function consumePendingContinuation(role) {
  if (!pendingContinuation) return null;
  const capability = pendingContinuation;
  const consumed = await requestJson(`/api/v1/auth/sign-in-continuations/${encodeURIComponent(capability.continuationId)}/consume`, {
    method: "POST",
    body: { continuationToken: capability.continuationToken },
  });
  const validated = validateConsumedContinuation(consumed, role);
  if (!validated) throw new Error("The server returned an unregistered continuation destination.");
  pendingContinuation = null;
  return validated;
}

async function completeConsumedContinuation(continuation) {
  const saveActions = {
    "catalog.save_program": ["program", "programId"],
    "catalog.save_school": ["school", "schoolId"],
    "catalog.save_scholarship": ["scholarship", "scholarshipId"],
  };
  const saveAction = saveActions[continuation.actionKey];
  if (!saveAction) return continuation.targetRoute;
  const [entityType, referenceKey] = saveAction;
  const entityId = continuation.payloadPreview[referenceKey];
  const existing = await requestJson("/api/v1/student/saved-items");
  if (!Array.isArray(existing)) throw new Error("The saved-item response was invalid.");
  if (!existing.some((item) => item?.entityType === entityType && item.entityId === entityId)) {
    await requestJson("/api/v1/student/saved-items", {
      method: "POST",
      body: { entityType, entityId, notes: null },
    });
  }
  return continuation.targetRoute;
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return () => {};
  const originalLabel = button.textContent;
  button.disabled = busy;
  if (busy && busyLabel) button.textContent = authUi(busyLabel);
  return () => {
    button.disabled = false;
    button.textContent = originalLabel;
  };
}

function isWorkspace(value) {
  if (!value || typeof value !== "object" || typeof value.label !== "string" || value.label.length > 200) return false;
  if (value.selectedSurface === "student") {
    return value.activeRole === "student" && value.tenantSchoolId === null;
  }
  if (value.selectedSurface === "school") {
    return value.activeRole === "school_staff"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.tenantSchoolId || "");
  }
  return value.selectedSurface === "ops"
    && ["cuac_ops", "cuac_admin"].includes(value.activeRole)
    && value.tenantSchoolId === null;
}

function clearWorkspaceChoices() {
  availableWorkspaces = [];
  workspaceOptions?.replaceChildren();
  if (workspacePicker) workspacePicker.hidden = true;
}

function renderWorkspaceChoices(workspaces) {
  const source = Array.isArray(workspaces) ? workspaces : [];
  const verified = source.filter(isWorkspace);
  if (!workspacePicker || !workspaceOptions || verified.length < 2 || verified.length !== source.length) {
    throw new Error("The server returned an invalid workspace selection.");
  }
  availableWorkspaces = verified;
  workspaceOptions.replaceChildren(...verified.map((workspace, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-option";
    button.dataset.workspaceIndex = String(index);
    const title = document.createElement("strong");
    title.textContent = workspace.label;
    const detail = document.createElement("span");
    detail.textContent = authUi(workspace.selectedSurface === "student"
      ? "Student"
      : workspace.selectedSurface === "school" ? "School staff" : "CUAC staff");
    button.append(title, detail);
    return button;
  }));
  workspacePicker.hidden = false;
}

async function finishSignIn(session) {
  const serverRole = normalizeAuthRole(session?.activeRole);
  const continuation = await consumePendingContinuation(session?.activeRole);
  const destination = continuation ? await completeConsumedContinuation(continuation) : destinationFor(serverRole);
  document.querySelector("[data-auth-password]").value = "";
  clearWorkspaceChoices();
  setStatus("Signed in. Opening the authorized workspace...", "success");
  window.setTimeout(() => window.location.assign(destination), 350);
}

async function beginMfaVerification(challenge) {
  if (!challenge?.mfaRequired || !/^[A-Za-z0-9_-]{43}$/.test(challenge.challengeToken || "")) {
    throw new Error("The server returned an invalid MFA challenge.");
  }
  pendingMfa = challenge;
  completedMfaSession = null;
  const setup = document.querySelector("[data-mfa-setup]");
  const recoveryPanel = document.querySelector("[data-mfa-recovery-codes]");
  if (setup) setup.hidden = true;
  if (recoveryPanel) recoveryPanel.hidden = true;
  setMode("mfa");
  setStatus(challenge.enrollmentRequired
    ? "Set up an authenticator before this staff session can be created."
    : "Enter the current code from your authenticator app.");
  if (!challenge.enrollmentRequired) return;
  const enrollment = await requestJson("/api/v1/auth/mfa/enrollment", {
    method: "POST",
    body: { challengeToken: challenge.challengeToken },
  });
  if (!/^[A-Z2-7]{32}$/.test(enrollment?.secret || "") || !String(enrollment?.otpauthUri || "").startsWith("otpauth://totp/")) {
    throw new Error("MFA enrollment details are invalid.");
  }
  document.querySelector("[data-mfa-secret]").textContent = enrollment.secret;
  const uri = document.querySelector("[data-mfa-uri]");
  if (uri) uri.href = enrollment.otpauthUri;
  if (setup) setup.hidden = false;
}

async function handleMfaSubmit(form) {
  if (!pendingMfa || !form.reportValidity()) return;
  const method = form.querySelector("[data-mfa-method]")?.value;
  const body = method === "recovery"
    ? { challengeToken: pendingMfa.challengeToken, recoveryCode: form.querySelector("[data-mfa-recovery]")?.value.trim() }
    : { challengeToken: pendingMfa.challengeToken, code: form.querySelector("[data-mfa-code]")?.value.trim() };
  const button = form.querySelector("[data-mfa-submit]");
  const restore = setButtonBusy(button, true, "Verifying...");
  try {
    const session = await requestJson("/api/v1/auth/mfa/complete", { method: "POST", body });
    if (Array.isArray(session?.recoveryCodes) && session.recoveryCodes.length > 0) {
      completedMfaSession = session;
      document.querySelector("[data-mfa-recovery-list]").textContent = session.recoveryCodes.join("\n");
      document.querySelector("[data-mfa-recovery-codes]").hidden = false;
      button.hidden = true;
      setStatus("MFA is active. Save the recovery codes before continuing.", "success");
      return;
    }
    pendingMfa = null;
    await finishSignIn(session);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    restore();
  }
}

async function signInToWorkspace(form, workspace, button) {
  const email = form.querySelector("[data-auth-email]")?.value.trim();
  const password = form.querySelector("[data-auth-password]")?.value;
  const restore = setButtonBusy(button, true, "Opening...");
  setStatus("Rechecking this workspace and creating your session...");
  try {
    const session = await requestJson("/api/v1/auth/sessions", {
      method: "POST",
      body: {
        email,
        password,
        selectedSurface: workspace.selectedSurface === "school"
          ? "school_staff" : workspace.selectedSurface === "ops" ? "cuac_internal" : "student",
        ...(workspace.tenantSchoolId ? { schoolId: workspace.tenantSchoolId } : {}),
      },
    });
    if (session?.workspaceSelectionRequired) throw new Error("The selected workspace could not be confirmed.");
    if (session?.mfaRequired) {
      await beginMfaVerification(session);
      return;
    }
    await finishSignIn(session);
  } catch (error) {
    setStatus(error.message, "error");
    restore();
  }
}

async function handleSignIn(form) {
  if (!form.reportValidity()) return;
  const email = form.querySelector("[data-auth-email]")?.value.trim();
  const password = form.querySelector("[data-auth-password]")?.value;

  const button = form.querySelector("[data-auth-submit]");
  const restore = setButtonBusy(button, true, "Signing in...");
  setStatus("Checking your account and workspace permission...");
  try {
    const session = await requestJson("/api/v1/auth/sessions", {
      method: "POST",
      body: { email, password },
    });
    if (session?.workspaceSelectionRequired) {
      renderWorkspaceChoices(session.workspaces);
      setStatus("Account verified. Choose the workspace you want to open.", "success");
      restore();
      return;
    }
    if (session?.mfaRequired) {
      await beginMfaVerification(session);
      restore();
      return;
    }
    await finishSignIn(session);
  } catch (error) {
    setStatus(error.message, "error");
    restore();
  }
}

async function handleRegister(form) {
  if (!form.reportValidity()) return;

  const firstName = form.querySelector("[data-register-first-name]")?.value.trim() || "";
  const lastName = form.querySelector("[data-register-last-name]")?.value.trim() || "";
  const email = form.querySelector("[data-register-email]")?.value.trim();
  const password = form.querySelector("[data-register-password]")?.value;
  const ageBand = form.querySelector("[data-register-age-band]")?.value;
  const guardianEmail = form.querySelector("[data-guardian-email]")?.value.trim();
  const guardianRelationship = form.querySelector("[data-guardian-relationship]")?.value;
  const button = form.querySelector("[data-auth-register-submit]");
  const restore = setButtonBusy(button, true, "Creating account...");
  setStatus(ageBand === "under_14" ? "Sending a secure approval request to your guardian..." : "Creating your student account securely...");

  try {
    const registration = await requestJson("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, displayName: `${firstName} ${lastName}`.trim(), ageBand,
        ...(ageBand === "under_14" ? { guardianEmail, guardianRelationship, locale: document.documentElement.lang === "zh-CN" ? "zh-CN" : "en" } : {}) },
    });

    if (registration?.guardianConsentRequired) {
      form.reset();
      syncGuardianFields();
      setStatus("Approval request sent. Your account stays locked until your parent or legal guardian approves it within 72 hours.", "success");
      restore();
      return;
    }

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
    setStatus(`${authUi(verificationMessage)} ${authUi("Opening the authorized next step...")}`, "success");
    window.setTimeout(() => window.location.assign(destination), 700);
  } catch (error) {
    setStatus(error.message, "error");
    restore();
  }
}

function syncGuardianFields() {
  const ageBand = document.querySelector("[data-register-age-band]")?.value;
  const panel = document.querySelector("[data-guardian-fields]");
  const email = document.querySelector("[data-guardian-email]");
  const relationship = document.querySelector("[data-guardian-relationship]");
  const required = ageBand === "under_14";
  if (panel) panel.hidden = !required;
  if (email) email.required = required;
  if (relationship) relationship.required = required;
}

document.querySelector("[data-register-age-band]")?.addEventListener("change", syncGuardianFields);
syncGuardianFields();

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
  const workspaceButton = event.target.closest("[data-workspace-index]");
  if (workspaceButton) {
    const workspace = availableWorkspaces[Number(workspaceButton.dataset.workspaceIndex)];
    const form = document.querySelector('[data-auth-panel="signin"]');
    if (workspace && form) void signInToWorkspace(form, workspace, workspaceButton);
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
    return;
  }

  if (event.target.closest("[data-mfa-cancel]")) {
    pendingMfa = null;
    completedMfaSession = null;
    setMode("signin");
    setStatus("Staff sign-in was cancelled.");
    return;
  }

  if (event.target.closest("[data-mfa-continue]") && completedMfaSession) {
    const session = completedMfaSession;
    completedMfaSession = null;
    pendingMfa = null;
    void finishSignIn(session);
  }
});

document.querySelector("[data-mfa-method]")?.addEventListener("change", (event) => {
  const recovery = event.target.value === "recovery";
  document.querySelector("[data-mfa-code-field]").hidden = recovery;
  document.querySelector("[data-mfa-recovery-field]").hidden = !recovery;
  document.querySelector("[data-mfa-code]").required = !recovery;
  document.querySelector("[data-mfa-recovery]").required = recovery;
});
document.querySelector("[data-mfa-code]").required = true;

document.querySelectorAll("[data-auth-email], [data-auth-password]").forEach((input) => {
  input.addEventListener("input", clearWorkspaceChoices);
});

document.querySelectorAll(".auth-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.dataset.authPanel === "signin") void handleSignIn(form);
    else if (form.dataset.authPanel === "register") void handleRegister(form);
    else if (form.dataset.authPanel === "reset") void handleResetRequest(form);
    else if (form.dataset.authPanel === "mfa") void handleMfaSubmit(form);
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

setRole("student");
if (window.location.hash === "#reset") setMode("reset");
else if (authParams.get("mode") === "register") setMode("register");
if (authParams.get("continue") === "1" && !pendingContinuation) {
  setStatus("This continuation link is missing or invalid. Sign in to open your normal workspace.", "error");
}
void loadCurrentActor();

window.addEventListener("hashchange", () => {
  setMode(window.location.hash === "#reset" ? "reset" : "signin");
});
