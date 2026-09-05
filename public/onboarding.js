const icons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a6 6 0 0 0 6-6V8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.9 4.9 2.8 2.8"/><path d="m16.3 16.3 2.8 2.8"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.9 19.1 2.8-2.8"/><path d="m16.3 7.7 2.8-2.8"/></svg>',
};

const titles = [
  "Welcome to CUAC",
  "Location and background",
  "Study goal",
  "Budget and scholarship",
  "Readiness snapshot",
  "Interests and Hub focus",
  "Hub prepared",
];

const state = {
  step: 0,
  nationality: "Thailand",
  currentCountry: "Thailand",
  stage: "High school / Grade 12",
  level: "Undergraduate",
  subject: "Computer Science",
  tuition: "RMB 25k-45k/year",
  funding: "Prefer partial scholarship",
  focus: "Program shortlist",
  cities: ["Hangzhou", "Nanjing"],
  intake: "Fall 2026",
  language: "English-taught",
  readiness: {
    passport: true,
    transcript: true,
    graduation: false,
    language: true,
    translation: false,
  },
};

document.querySelectorAll("[data-icon]").forEach((node) => {
  node.innerHTML = icons[node.dataset.icon] || "";
});

const steps = Array.from(document.querySelectorAll("[data-step]"));
const title = document.querySelector("[data-step-title]");
const count = document.querySelector("[data-step-count]");
const progressLabel = document.querySelector("[data-progress-label]");
const progressBar = document.querySelector("[data-progress-bar]");
const back = document.querySelector("[data-back]");
const next = document.querySelector("[data-next]");
const form = document.querySelector("[data-onboarding-form]");
const summary = document.querySelector("[data-summary]");

function selectedText(selector) {
  return document.querySelector(`${selector} .selected`)?.textContent.trim() || "";
}

function selectedMany(selector) {
  return Array.from(document.querySelectorAll(`${selector} .selected`)).map((node) => node.textContent.trim());
}

function fieldValue(name) {
  return document.querySelector(`[data-field="${name}"]`)?.value || "";
}

function readinessCount() {
  return document.querySelectorAll(".readiness-list input:checked").length;
}

function readinessState() {
  return Array.from(document.querySelectorAll(".readiness-list input[data-check]")).reduce((result, input) => {
    result[input.dataset.check] = input.checked;
    return result;
  }, {});
}

function updateStateFromDom() {
  state.nationality = fieldValue("nationality") || state.nationality;
  state.currentCountry = fieldValue("currentCountry") || state.currentCountry;
  state.stage = fieldValue("stage") || state.stage;
  state.level = selectedText('[data-chip-group="level"]') || state.level;
  state.subject = selectedText('[data-chip-group="subject"]') || state.subject;
  state.tuition = selectedText('[data-chip-group="tuition"]') || state.tuition;
  state.funding = selectedText('[data-chip-group="funding"]') || state.funding;
  state.focus = selectedText('[data-chip-group="focus"]') || state.focus;
  state.cities = selectedMany('[data-multi-group="cities"]');
  state.intake = fieldValue("intake") || state.intake;
  state.language = fieldValue("language") || state.language;
  state.readiness = readinessState();
}

function renderSummary() {
  updateStateFromDom();
  const items = [
    ["Student context", `${state.nationality} · ${state.currentCountry} · ${state.stage}`],
    ["Study route", `${state.level} · ${state.subject} · ${state.language} · ${state.intake}`],
    ["Budget signal", `${state.tuition} · ${state.funding}`],
    ["City shortlist", state.cities.length ? state.cities.join(", ") : "Not sure"],
    ["Readiness", `${readinessCount()} of 5 core items marked ready`],
    ["First Hub focus", state.focus],
  ];
  summary.innerHTML = items.map(([label, value]) => `<article><strong>${label}</strong><span>${value}</span></article>`).join("");
}

function setStep(step) {
  state.step = Math.max(0, Math.min(step, steps.length - 1));
  steps.forEach((panel, index) => panel.classList.toggle("active", index === state.step));
  title.textContent = titles[state.step];
  count.textContent = state.step === steps.length - 1 ? "Ready for Hub" : `Step ${state.step + 1} of ${steps.length - 1}`;
  const percent = Math.round(((state.step + 1) / steps.length) * 100);
  progressLabel.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
  back.disabled = state.step === 0;
  next.textContent = state.step === 0 ? "Let’s go" : state.step === steps.length - 1 ? "Enter Hub" : "Continue";
  if (state.step === steps.length - 1) renderSummary();
}

document.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-chip-group] button");
  if (chip) {
    const group = chip.closest("[data-chip-group]");
    group.querySelectorAll("button").forEach((button) => button.classList.remove("selected"));
    chip.classList.add("selected");
    updateStateFromDom();
  }

  const multi = event.target.closest("[data-multi-group] button");
  if (multi) {
    multi.classList.toggle("selected");
    updateStateFromDom();
  }
});

back.addEventListener("click", () => setStep(state.step - 1));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.step >= steps.length - 1) {
    updateStateFromDom();
    window.localStorage?.setItem("cuacOnboardingPreview", JSON.stringify({
      ...state,
      readinessReadyCount: readinessCount(),
      readinessTotal: document.querySelectorAll(".readiness-list input[data-check]").length,
      savedAt: new Date().toISOString(),
      source: "CUAC onboarding preview",
    }));
    window.location.href = "hub.html";
    return;
  }
  setStep(state.step + 1);
});

setStep(0);
