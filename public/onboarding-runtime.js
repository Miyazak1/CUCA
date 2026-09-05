const onboardingOptions = {
  degreeLevels: ["associate", "bachelor", "master", "doctoral", "diploma", "certificate", "foundation", "language", "non_degree"],
  subjectAreas: ["computer_science", "engineering", "business", "economics", "medicine", "health_sciences", "natural_sciences", "social_sciences", "humanities", "law", "arts", "education", "agriculture", "architecture", "mathematics", "interdisciplinary"],
  teachingLanguages: ["english", "chinese", "bilingual"],
  fundingIntents: ["scholarship_required", "scholarship_possible", "self_funded", "undecided"],
  intakeTerms: ["spring", "summer", "fall", "winter"],
};

let onboardingProfile = null;

class OnboardingRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "OnboardingRequestError";
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
  if (!response.ok) throw new OnboardingRequestError(payload?.error?.message || "Account setup could not be completed.", response.status, payload?.error?.code || "REQUEST_FAILED");
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) throw new OnboardingRequestError("The profile response is missing its data envelope.", response.status, "INVALID_RESPONSE");
  return payload.data;
}

function preservedPreferences(value) {
  const input = isRecord(value) ? value : {};
  const output = {};
  if (onboardingOptions.degreeLevels.includes(input.degreeLevel)) output.degreeLevel = input.degreeLevel;
  if (Array.isArray(input.subjectAreas)) output.subjectAreas = [...new Set(input.subjectAreas.filter(item => onboardingOptions.subjectAreas.includes(item)))].slice(0, 8);
  if (onboardingOptions.teachingLanguages.includes(input.teachingLanguage)) output.teachingLanguage = input.teachingLanguage;
  if (Array.isArray(input.preferredCityIds) && input.preferredCityIds.every(item => typeof item === "string")) output.preferredCityIds = [...new Set(input.preferredCityIds)].slice(0, 10);
  if (onboardingOptions.fundingIntents.includes(input.fundingIntent)) output.fundingIntent = input.fundingIntent;
  if (Number.isInteger(input.intakeYear) && input.intakeYear >= 2000 && input.intakeYear <= 2100) output.intakeYear = input.intakeYear;
  if (onboardingOptions.intakeTerms.includes(input.intakeTerm)) output.intakeTerm = input.intakeTerm;
  return output;
}

function options(values, selected) {
  return `<option value="">Not set</option>${values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(humanize(value))}</option>`).join("")}`;
}

function renderOnboarding() {
  const root = document.querySelector("[data-onboarding-view]");
  if (!root) return;
  const profile = onboardingProfile || {};
  const preferences = preservedPreferences(profile.preferences);
  const subjects = new Set(preferences.subjectAreas || []);
  root.innerHTML = `<form class="onboarding-form" data-onboarding-form>
    <div class="onboarding-fields">
      <label class="onboarding-field"><span>Display name</span><input name="displayName" maxlength="120" autocomplete="name" value="${escapeHtml(profile.displayName || "")}" /></label>
      <label class="onboarding-field"><span>Target degree</span><select name="targetDegreeLevel">${options(onboardingOptions.degreeLevels, profile.targetDegreeLevel)}</select></label>
      <label class="onboarding-field"><span>Teaching language</span><select name="teachingLanguage">${options(onboardingOptions.teachingLanguages, preferences.teachingLanguage)}</select></label>
      <label class="onboarding-field"><span>Funding intent</span><select name="fundingIntent">${options(onboardingOptions.fundingIntents, preferences.fundingIntent)}</select></label>
      <label class="onboarding-field"><span>Intake year</span><input name="intakeYear" type="number" min="2000" max="2100" step="1" value="${escapeHtml(preferences.intakeYear || "")}" /></label>
      <label class="onboarding-field"><span>Intake term</span><select name="intakeTerm">${options(onboardingOptions.intakeTerms, preferences.intakeTerm)}</select></label>
    </div>
    <fieldset class="onboarding-subjects">
      <legend>Subject areas</legend>
      <div class="onboarding-subject-grid">${onboardingOptions.subjectAreas.map(value => `<label class="onboarding-check"><input type="checkbox" name="subjectAreas" value="${escapeHtml(value)}" ${subjects.has(value) ? "checked" : ""} /><span>${escapeHtml(humanize(value))}</span></label>`).join("")}</div>
    </fieldset>
    <div class="onboarding-form-footer">
      <a class="onboarding-secondary" href="hub-api.html">Skip for now</a>
      <button class="onboarding-primary" type="submit">Save and open Hub</button>
    </div>
  </form>`;
}

function renderError(error) {
  const root = document.querySelector("[data-onboarding-view]");
  if (!root) return;
  root.innerHTML = `<div class="onboarding-error"><h3>Account setup could not be loaded</h3><p>${escapeHtml(error?.message || "The student profile service is unavailable.")}</p><button class="onboarding-secondary" type="button" data-retry-onboarding>Retry</button></div>`;
}

let onboardingToastTimer;
function showOnboardingToast(message) {
  const toast = document.querySelector("[data-onboarding-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(onboardingToastTimer);
  onboardingToastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

async function requireStudent(error) {
  if (![401, 403].includes(error?.status)) return false;
  const auth = await window.CUAC?.authReady?.();
  if (auth?.authState !== "signed-out") return false;
  window.CUAC?.requireSignedIn?.("set up your student account", {
    requiredRole: "student",
    resumeAction: { type: "navigate", href: "onboarding-api.html" },
  });
  return true;
}

async function loadOnboarding() {
  try {
    const profile = await requestJson("/api/v1/student/profile");
    onboardingProfile = isRecord(profile) ? profile : null;
    renderOnboarding();
  } catch (error) {
    if (!(await requireStudent(error))) renderError(error);
  }
}

async function saveOnboarding(form) {
  const values = new FormData(form);
  const subjectAreas = values.getAll("subjectAreas").filter(value => onboardingOptions.subjectAreas.includes(value));
  if (subjectAreas.length > 8) {
    showOnboardingToast("Select no more than eight subject areas.");
    return;
  }
  const preferences = preservedPreferences(onboardingProfile?.preferences);
  preferences.subjectAreas = subjectAreas;
  for (const key of ["teachingLanguage", "fundingIntent", "intakeTerm"]) {
    const value = values.get(key);
    if (value) preferences[key] = value;
    else delete preferences[key];
  }
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
    if (!isRecord(profile)) throw new OnboardingRequestError("The saved profile response was incomplete.", 200, "INVALID_RESPONSE");
    window.location.assign("hub-api.html");
  } catch (error) {
    if (!(await requireStudent(error))) renderError(error);
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

document.addEventListener("submit", event => {
  if (!event.target.matches("[data-onboarding-form]")) return;
  event.preventDefault();
  void saveOnboarding(event.target);
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-retry-onboarding]")) void loadOnboarding();
});

void loadOnboarding();
