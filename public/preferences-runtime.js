const preferenceOptions = {
  degreeLevels: ["associate", "bachelor", "master", "doctoral", "diploma", "certificate", "foundation", "language", "non_degree"],
  subjectAreas: ["computer_science", "engineering", "business", "economics", "medicine", "health_sciences", "natural_sciences", "social_sciences", "humanities", "law", "arts", "education", "agriculture", "architecture", "mathematics", "interdisciplinary"],
  teachingLanguages: ["english", "chinese", "bilingual"],
  fundingIntents: ["scholarship_required", "scholarship_possible", "self_funded", "undecided"],
  intakeTerms: ["spring", "summer", "fall", "winter"],
};

const topicLabels = {
  application_updates: ["Application updates", "Changes to your application records"],
  billing_updates: ["Billing updates", "Payment and refund events"],
  deadline_reminders: ["Deadline reminders", "Published application timing reminders"],
  document_reminders: ["Document reminders", "File and material preparation events"],
  funding_updates: ["Funding updates", "Scholarship-related account events"],
  account_security: ["Account security", "Required sign-in and account protection events"],
};

let currentProfile = null;
let currentNotificationPreferences = [];
let currentAccountIdentity = null;
let currentDataRightsRequests = [];

class PreferenceRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "PreferenceRequestError";
    this.status = status;
    this.code = code;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function humanize(value) {
  const text = String(value || "").replaceAll("_", " ");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Not set";
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PreferenceRequestError(
      payload?.error?.message || "The preference request could not be completed.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new PreferenceRequestError("The preference response is missing its data envelope.", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

function validatedPreferences(value) {
  const input = isRecord(value) ? value : {};
  const output = {};
  if (preferenceOptions.degreeLevels.includes(input.degreeLevel)) output.degreeLevel = input.degreeLevel;
  if (Array.isArray(input.subjectAreas)) output.subjectAreas = [...new Set(input.subjectAreas.filter(item => preferenceOptions.subjectAreas.includes(item)))].slice(0, 8);
  if (preferenceOptions.teachingLanguages.includes(input.teachingLanguage)) output.teachingLanguage = input.teachingLanguage;
  if (Array.isArray(input.preferredCityIds) && input.preferredCityIds.every(item => typeof item === "string")) output.preferredCityIds = [...new Set(input.preferredCityIds)].slice(0, 10);
  if (preferenceOptions.fundingIntents.includes(input.fundingIntent)) output.fundingIntent = input.fundingIntent;
  if (Number.isInteger(input.intakeYear) && input.intakeYear >= 2000 && input.intakeYear <= 2100) output.intakeYear = input.intakeYear;
  if (preferenceOptions.intakeTerms.includes(input.intakeTerm)) output.intakeTerm = input.intakeTerm;
  return output;
}

function selectOptions(values, selected, emptyLabel = "Not set") {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${values.map(value => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(humanize(value))}</option>`).join("")}`;
}

function renderAccountIdentity() {
  const root = document.querySelector("[data-account-identity]");
  if (!root) return;
  const email = currentAccountIdentity?.accountEmail;
  if (!email) {
    root.innerHTML = '<div class="preferences-error"><h3>Account email unavailable</h3><p>The current session did not return an account identity. Sign in again or refresh this page.</p></div>';
    return;
  }
  const verified = currentAccountIdentity.accountEmailVerified === true;
  root.innerHTML = `<div class="account-identity-card">
    <div><span>Registered email</span><strong>${escapeHtml(email)}</strong><small>This email is used to sign in and recover account access. It does not automatically replace your application contact email.</small></div>
    <em class="account-verification-status ${verified ? "verified" : "pending"}">${verified ? "Verified" : "Verification pending"}</em>
  </div>`;
}

async function loadAccountIdentity() {
  try {
    const auth = await window.CUAC?.authReady?.();
    currentAccountIdentity = auth?.authState === "signed-in" ? auth : null;
  } catch {
    currentAccountIdentity = null;
  }
  renderAccountIdentity();
}

function renderStudyPreferences() {
  const root = document.querySelector("[data-study-preferences]");
  if (!root) return;
  const profile = currentProfile || {};
  const preferences = validatedPreferences(profile.preferences);
  const selectedSubjects = new Set(preferences.subjectAreas || []);
  root.innerHTML = `<form class="preferences-form" data-study-form>
    <div class="preferences-field-grid">
      <label class="preferences-field"><span>Display name</span><input name="displayName" maxlength="120" value="${escapeHtml(profile.displayName || "")}" autocomplete="name" /><small>Account display only. Legal applicant details stay in Applicant information.</small></label>
      <label class="preferences-field"><span>Target degree level</span><select name="targetDegreeLevel">${selectOptions(preferenceOptions.degreeLevels, profile.targetDegreeLevel)}</select></label>
      <label class="preferences-field"><span>Teaching language</span><select name="teachingLanguage">${selectOptions(preferenceOptions.teachingLanguages, preferences.teachingLanguage)}</select></label>
      <label class="preferences-field"><span>Funding intent</span><select name="fundingIntent">${selectOptions(preferenceOptions.fundingIntents, preferences.fundingIntent)}</select></label>
      <label class="preferences-field"><span>Intake year</span><input name="intakeYear" type="number" min="2000" max="2100" step="1" value="${escapeHtml(preferences.intakeYear || "")}" /></label>
      <label class="preferences-field"><span>Intake term</span><select name="intakeTerm">${selectOptions(preferenceOptions.intakeTerms, preferences.intakeTerm)}</select></label>
    </div>
    <fieldset class="preferences-fieldset">
      <legend>Subject areas</legend>
      <div class="preferences-subjects">${preferenceOptions.subjectAreas.map(value => `<label class="preferences-check"><input type="checkbox" name="subjectAreas" value="${escapeHtml(value)}" ${selectedSubjects.has(value) ? "checked" : ""} /><span>${escapeHtml(humanize(value))}</span></label>`).join("")}</div>
      <small>Select up to eight subject areas.</small>
    </fieldset>
    <div class="preferences-form-footer"><button type="submit">Save study preferences</button></div>
  </form>`;
}

function notificationPreference(value) {
  if (!isRecord(value)
    || typeof value.topic !== "string"
    || !Number.isInteger(value.revision)
    || typeof value.inAppEnabled !== "boolean"
    || typeof value.emailEnabled !== "boolean"
    || typeof value.smsEnabled !== "boolean") return null;
  return {
    topic: value.topic,
    revision: value.revision,
    inAppEnabled: value.inAppEnabled,
    emailEnabled: value.emailEnabled,
    smsEnabled: value.smsEnabled,
  };
}

function renderNotificationPreferences() {
  const root = document.querySelector("[data-notification-preferences]");
  if (!root) return;
  if (!currentNotificationPreferences.length) {
    root.innerHTML = '<div class="preferences-error"><h3>No notification topics are available</h3><p>The server did not return a notification preference contract for this account.</p></div>';
    return;
  }
  root.innerHTML = `<form class="preferences-form" data-notification-form>
    <table class="notification-table">
      <thead><tr><th scope="col">Topic</th><th scope="col">In app</th><th scope="col">Email</th><th scope="col">SMS</th></tr></thead>
      <tbody>${currentNotificationPreferences.map(item => {
        const [title, copy] = topicLabels[item.topic] || [humanize(item.topic), "Account notification topic"];
        const required = item.topic === "account_security";
        return `<tr data-notification-topic="${escapeHtml(item.topic)}">
          <td class="notification-topic"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></td>
          <td><label class="notification-channel"><input type="checkbox" name="inAppEnabled" aria-label="${escapeHtml(title)} in-app notifications" ${item.inAppEnabled ? "checked" : ""} ${required ? "disabled" : ""} /></label></td>
          <td><label class="notification-channel"><input type="checkbox" name="emailEnabled" aria-label="${escapeHtml(title)} email notifications" ${item.emailEnabled ? "checked" : ""} ${required ? "disabled" : ""} /></label></td>
          <td><label class="notification-channel"><input type="checkbox" name="smsEnabled" aria-label="${escapeHtml(title)} SMS notifications" ${item.smsEnabled ? "checked" : ""} /></label></td>
        </tr>`;
      }).join("")}</tbody>
    </table>
    <div class="preferences-form-footer"><button type="submit">Save notification preferences</button></div>
  </form>`;
}

const dataRightsLabels = {
  access: "Access my data", correction: "Correct my data", portable_export: "Export my data", account_deletion: "Delete my account",
};

function renderDataRights() {
  const root = document.querySelector("[data-data-rights]");
  if (!root) return;
  root.innerHTML = `<form class="preferences-form data-rights-form" data-data-rights-form>
    <div class="preferences-field-grid">
      <label class="preferences-field"><span>Request type</span><select name="requestType" required>${Object.entries(dataRightsLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
      <label class="preferences-field" data-correction-scope hidden><span>Information to correct</span><select name="correctionScope"><option value="account">Account identity</option><option value="applicant_profile">Applicant profile</option><option value="education">Education</option><option value="assessment">Exams and tests</option><option value="application">Application records</option><option value="other">Other structured account data</option></select></label>
      <label class="preferences-field"><span>Reply language</span><select name="preferredLocale"><option value="en">English</option><option value="zh-CN">简体中文</option></select></label>
      <label class="preferences-field" data-rights-password hidden><span>Confirm current password</span><input name="password" type="password" autocomplete="current-password" minlength="15" /><small>Required only for export and deletion.</small></label>
    </div>
    <p class="preferences-form-note">Do not enter identity documents or sensitive details here. CUAC will provide the next verification step after receipt.</p>
    <div class="preferences-form-footer"><button type="submit">Submit privacy request</button></div>
  </form>
  <div class="data-rights-list">${currentDataRightsRequests.length ? currentDataRightsRequests.map(item => `<article>
    <div><strong>${escapeHtml(dataRightsLabels[item.requestType] || humanize(item.requestType))}</strong><span>Received ${escapeHtml(new Date(item.receivedAt).toLocaleDateString())} · ${escapeHtml(humanize(item.status))}</span></div>
    ${item.status === "received" ? `<button class="preferences-secondary" type="button" data-cancel-rights="${escapeHtml(item.requestId)}" data-revision="${item.revision}">Cancel</button>` : ""}
  </article>`).join("") : "<p class=\"preferences-loading\">No privacy requests have been submitted.</p>"}</div>`;
  updateDataRightsFields(root.querySelector('[name="requestType"]'));
}

function updateDataRightsFields(select) {
  if (!select) return;
  const form = select.form, correction = select.value === "correction", sensitive = ["portable_export", "account_deletion"].includes(select.value);
  const correctionField = form.querySelector("[data-correction-scope]"), passwordField = form.querySelector("[data-rights-password]");
  correctionField.hidden = !correction;
  correctionField.querySelector("select").disabled = !correction;
  passwordField.hidden = !sensitive;
  passwordField.querySelector("input").disabled = !sensitive;
  passwordField.querySelector("input").required = sensitive;
}

function renderPreferenceError(target, title, error) {
  const root = document.querySelector(target);
  if (!root) return;
  root.innerHTML = `<div class="preferences-error"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(error?.message || "This account service is unavailable.")}</p><button class="preferences-secondary" type="button" data-retry-preferences>Retry</button></div>`;
}

let preferenceToastTimer;
function showPreferenceToast(message) {
  const toast = document.querySelector("[data-preferences-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(preferenceToastTimer);
  preferenceToastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

async function requireStudent(errors) {
  const authError = errors.find(error => [401, 403].includes(error?.status));
  if (!authError) return false;
  const auth = await window.CUAC?.authReady?.();
  if (auth?.authState !== "signed-out") return false;
  window.CUAC?.requireSignedIn?.("manage your preferences", {
    requiredRole: "student",
    resumeAction: { type: "navigate", href: "preferences-api.html" },
  });
  return true;
}

async function loadPreferences() {
  const results = await Promise.allSettled([
    requestJson("/api/v1/student/profile"),
    requestJson("/api/v1/notifications/preferences"),
    requestJson("/api/v1/data-rights/requests"),
  ]);
  const errors = results.filter(result => result.status === "rejected").map(result => result.reason);
  if (await requireStudent(errors)) return;
  if (results[0].status === "fulfilled") {
    currentProfile = isRecord(results[0].value) ? results[0].value : null;
    renderStudyPreferences();
  } else renderPreferenceError("[data-study-preferences]", "Study preferences could not be loaded", results[0].reason);
  if (results[1].status === "fulfilled" && Array.isArray(results[1].value?.preferences)) {
    currentNotificationPreferences = results[1].value.preferences.map(notificationPreference).filter(Boolean);
    renderNotificationPreferences();
  } else renderPreferenceError("[data-notification-preferences]", "Notification preferences could not be loaded", results[1].status === "rejected" ? results[1].reason : null);
  if (results[2].status === "fulfilled" && Array.isArray(results[2].value)) {
    currentDataRightsRequests = results[2].value;
    renderDataRights();
  } else renderPreferenceError("[data-data-rights]", "Privacy requests could not be loaded", results[2].status === "rejected" ? results[2].reason : null);
}

async function submitDataRights(form) {
  const requestType = form.elements.requestType.value;
  const sensitive = ["portable_export", "account_deletion"].includes(requestType);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const auth = await window.CUAC?.authReady?.();
    if (sensitive && auth?.authStrength !== "step_up") {
      await requestJson("/api/v1/auth/step-up", { method: "POST", body: JSON.stringify({ password: form.elements.password.value }) });
    }
    const created = await requestJson("/api/v1/data-rights/requests", { method: "POST", body: JSON.stringify({
      requestId: crypto.randomUUID(), requestType,
      correctionScope: requestType === "correction" ? form.elements.correctionScope.value : null,
      preferredLocale: form.elements.preferredLocale.value,
    }) });
    currentDataRightsRequests = [created, ...currentDataRightsRequests];
    renderDataRights();
    showPreferenceToast("Privacy request received.");
  } catch (error) { showPreferenceToast(error?.message || "Privacy request was not submitted."); }
  finally { if (button?.isConnected) button.disabled = false; }
}

async function cancelDataRights(button) {
  button.disabled = true;
  try {
    const updated = await requestJson(`/api/v1/data-rights/requests/${encodeURIComponent(button.dataset.cancelRights)}/cancel`, {
      method: "POST", body: JSON.stringify({ expectedRevision: Number(button.dataset.revision) }),
    });
    currentDataRightsRequests = currentDataRightsRequests.map(item => item.requestId === updated.requestId ? updated : item);
    renderDataRights(); showPreferenceToast("Privacy request cancelled.");
  } catch (error) { button.disabled = false; showPreferenceToast(error?.message || "Privacy request was not cancelled."); }
}

async function saveStudyPreferences(form) {
  const values = new FormData(form);
  const subjectAreas = values.getAll("subjectAreas").filter(value => preferenceOptions.subjectAreas.includes(value));
  if (subjectAreas.length > 8) {
    showPreferenceToast("Select no more than eight subject areas.");
    return;
  }
  const preferences = validatedPreferences(currentProfile?.preferences);
  for (const key of ["teachingLanguage", "fundingIntent", "intakeTerm"]) {
    const value = values.get(key);
    if (value) preferences[key] = value;
    else delete preferences[key];
  }
  preferences.subjectAreas = subjectAreas;
  const intakeYear = Number(values.get("intakeYear"));
  if (Number.isInteger(intakeYear) && intakeYear >= 2000 && intakeYear <= 2100) preferences.intakeYear = intakeYear;
  else delete preferences.intakeYear;
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const profile = await requestJson("/api/v1/student/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: String(values.get("displayName") || "").trim() || null,
        targetDegreeLevel: values.get("targetDegreeLevel") || null,
        preferences,
      }),
    });
    if (!isRecord(profile)) throw new PreferenceRequestError("The profile response was incomplete.", 200, "INVALID_RESPONSE");
    currentProfile = profile;
    renderStudyPreferences();
    showPreferenceToast("Study preferences saved.");
  } catch (error) {
    if (!(await requireStudent([error]))) showPreferenceToast(error?.message || "Study preferences were not saved.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function saveNotificationPreferences(form) {
  const rows = [...form.querySelectorAll("[data-notification-topic]")];
  const preferences = rows.map(row => {
    const current = currentNotificationPreferences.find(item => item.topic === row.dataset.notificationTopic);
    const required = current?.topic === "account_security";
    return {
      topic: current.topic,
      inAppEnabled: required ? true : row.querySelector('[name="inAppEnabled"]').checked,
      emailEnabled: required ? true : row.querySelector('[name="emailEnabled"]').checked,
      smsEnabled: row.querySelector('[name="smsEnabled"]').checked,
      expectedRevision: current.revision,
    };
  });
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const data = await requestJson("/api/v1/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ preferences }),
    });
    if (!Array.isArray(data?.preferences)) throw new PreferenceRequestError("The notification response was incomplete.", 200, "INVALID_RESPONSE");
    currentNotificationPreferences = data.preferences.map(notificationPreference).filter(Boolean);
    renderNotificationPreferences();
    showPreferenceToast("Notification preferences saved.");
  } catch (error) {
    if (!(await requireStudent([error]))) showPreferenceToast(error?.message || "Notification preferences were not saved.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

document.addEventListener("submit", event => {
  if (event.target.matches("[data-study-form]")) {
    event.preventDefault();
    void saveStudyPreferences(event.target);
  }
  if (event.target.matches("[data-notification-form]")) {
    event.preventDefault();
    void saveNotificationPreferences(event.target);
  }
  if (event.target.matches("[data-data-rights-form]")) { event.preventDefault(); void submitDataRights(event.target); }
});

document.addEventListener("change", event => {
  if (event.target.matches('[data-data-rights-form] [name="requestType"]')) updateDataRightsFields(event.target);
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-retry-preferences]")) void loadPreferences();
  const cancel = event.target.closest("[data-cancel-rights]");
  if (cancel) void cancelDataRights(cancel);
});

void loadAccountIdentity();
void loadPreferences();
