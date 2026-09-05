const appIcons = {
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20Z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/></svg>',
  choice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>',
  funding: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  review: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-5"/></svg>',
  university: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V9l7-4 7 4v12"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  education: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 9-10-5L2 9l10 5 10-5Z"/><path d="M6 11.5V16c2.5 2.2 9.5 2.2 12 0v-4.5"/></svg>',
};

const confirmedText = "Confirmed";
const PENDING_INVOICE_SESSION_KEY = "cuacPendingApplicationInvoice";
const APPLICATION_SET_LOCATOR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let orderConfirmed = false;
let choiceCount = document.querySelectorAll("[data-choice]").length;
let nextChoiceId = choiceCount;
let submittedToSchools = false;
let billingPreviewRecord = null;
let billingRuntimeState = "idle";
let billingErrorMessage = "";
let checkoutIntentRecord = null;
let checkoutStatusRecord = null;
let submissionRecord = null;
let applicationRuntimeState = "loading";
let currentApplicationSet = null;
let applicantProfileRecord = null;
let educationHistoryRecord = { revision: 0, records: [] };
let assessmentHistoryRecord = { revision: 0, records: [] };
let studentRecordsRuntimeState = "loading";
let studentFileRecords = [];
let studentFilesRuntimeState = "loading";
const materialChoiceStates = new Map();
let currentMaterialChoiceId = "";
let catalogProgramsById = new Map();
let catalogSchoolsById = new Map();
const catalogIntakesByProgramId = new Map();
const catalogProgramDetailIds = new Set();
let currentApplicationStage = "overview";
const applicationStages = ["overview", "choices", "info", "fee", "payment", "send"];
const profileSections = ["applicant", "education", "assessments", "files", "authorization"];
const profileSectionRouteAliases = {
  account: "applicant",
  personal: "applicant",
  nationality: "applicant",
  contact: "applicant",
  background: "education",
  finance: "assessments",
  funding: "assessments",
  documents: "files",
  consent: "authorization",
  "school-summary": "authorization",
};
const profileRoutePrefix = "#profile/";
const profileSectionLabels = {
  applicant: "Applicant record",
  education: "Education history",
  assessments: "Exams & tests",
  files: "Private files",
  authorization: "Submission sharing",
};
const applicantFieldLabels = {
  fullName: "Full legal name",
  contactEmail: "Contact email",
  citizenshipCountry: "Citizenship country",
};
const studentFileCategoryLabels = {
  identity_document: "Identity document",
  transcript: "Transcript",
  test_score: "Test score",
  recommendation: "Recommendation",
  supporting_document: "Supporting document",
};
const studentFileStatusLabels = {
  pending_upload: "Waiting for upload",
  pending_scan: "Waiting for scan",
  scanning: "Scanning",
  clean: "Clean",
  delete_pending: "Deletion queued",
  deleting: "Deleting",
  deleted: "Deleted",
};
let currentProfileSection = "applicant";
const profileSectionSaveState = Object.fromEntries(profileSections.map((section) => [section, true]));

let programCatalog = {};

function appProgramSchoolName(program = {}) {
  return program.schoolNameEn || program.university || program.school?.nameEn || program.school || "School to confirm";
}

function appProgramSchoolId(program = {}) {
  return program.schoolId || program.school?.id || "";
}

function appProgramId(program = {}) {
  return program.programId || program.id || "";
}

function appProgramName(program = {}) {
  return program.nameEn || program.name || program.program || "Selected program";
}

function appProgramFieldName(program = {}) {
  return program.fieldCategory || splitProgramLevel(appProgramName(program)).name;
}

function appProgramDegree(program = {}) {
  const value = program.degreeLevel || program.degree || splitProgramLevel(appProgramName(program)).level;
  const labels = {
    associate: "Associate",
    bachelor: "Undergraduate",
    master: "Master",
    doctoral: "PhD",
    diploma: "Diploma",
    certificate: "Certificate",
    foundation: "Foundation",
    language: "Language",
    non_degree: "Non-degree",
  };
  return labels[String(value || "").toLowerCase()] || value;
}

function appProgramCity(program = {}) {
  const city = program.city;
  if (city && typeof city === "object") return city.nameZh || city.nameEn || program.school?.cityZh || program.school?.city || "China";
  return program.cityZh || city || program.school?.cityZh || program.school?.city || "China";
}

function appProgramIntake(program = {}) {
  return program.selectedIntake ? intakeDisplayName(program.selectedIntake) : program.applicationRound || program.intake || "Published intake required";
}

function appProgramLanguage(program = {}) {
  const value = program.teachingLanguage || program.language || "";
  const labels = {
    english: "English-taught",
    chinese: "Chinese-taught",
    bilingual: "Bilingual",
  };
  return labels[String(value).toLowerCase()] || value || "Language check";
}

function appProgramTuition(program = {}) {
  return program.tuitionText || program.displayTuition || program.tuition || "Tuition pending";
}

function appProgramDeadline(program = {}) {
  return program.selectedIntake?.deadlineLabel || program.selectedIntake?.deadlineDate || program.deadlineLabel || program.deadlineDate || program.deadline || "Deadline pending";
}

function appProgramSignal(program = {}) {
  return program.scholarshipText || program.signal || program.applicationNote || "Route fit";
}

function appProgramList(value = {}, fallback = "") {
  if (Array.isArray(value)) return value.filter(Boolean).join(" + ") || fallback;
  return value || fallback;
}

function appProgramOptionValue(program = {}) {
  return String(appProgramId(program) || appProgramName(program));
}

function findCatalogProgramBySelection(university, value, degree) {
  const normalizedValue = String(value || "").trim();
  const programs = programCatalog[university] || [];
  return programs.find((entry) => {
    const sameProgram =
      String(appProgramId(entry)) === normalizedValue ||
      appProgramName(entry) === normalizedValue ||
      entry.program === normalizedValue;
    const sameDegree = !degree || appProgramDegree(entry) === degree;
    return sameProgram && sameDegree;
  }) || null;
}

function toChoiceProgram(program = {}, selectedUniversity = appProgramSchoolName(program)) {
  const title = appProgramName(program);
  return {
    ...program,
    schoolId: appProgramSchoolId(program),
    programId: appProgramId(program),
    programIntakeId: program.programIntakeId || program.selectedIntake?.id || "",
    university: selectedUniversity,
    program: title,
    programName: appProgramFieldName(program),
    degree: appProgramDegree(program),
    city: appProgramCity(program),
    intake: appProgramIntake(program),
    language: appProgramLanguage(program),
    tuition: appProgramTuition(program),
    deadline: appProgramDeadline(program),
    signal: appProgramSignal(program),
    durationYears: program.durationYears || "",
    fieldCategory: program.fieldCategory || "",
    cscaSubjects: appProgramList(program.cscaSubjects),
    cscaRequirement: program.cscaRequirement || "",
    hskRequirement: program.hskRequirement || "",
    englishRequirement: program.englishRequirement || "",
    applicationRound: program.applicationRound || appProgramIntake(program),
    applicationUrl: program.applicationUrl || program.sourceUrl || "",
    applicationNote: program.applicationNote || "",
    sourceLabel: program.sourceLabel || "",
  };
}

function renderIcons() {
  document.querySelectorAll("[data-app-icon]").forEach((target) => {
    target.innerHTML = appIcons[target.dataset.appIcon] || "";
  });
}

function getRequiredStepState() {
  const infoReady = isStudentProfileReady();
  const choicesReady = choiceCount > 0 && orderConfirmed;
  const canReviewFee = choiceCount > 0 || submittedToSchools;
  const submitReady = choicesReady && infoReady;
  const paymentComplete = submittedToSchools || isBillingEntitlementReady();
  const feeComplete = paymentComplete || submitReady;
  const sendReady = submittedToSchools || paymentComplete;
  return {
    choices: {
      complete: choicesReady,
      open: true,
      status: choicesReady ? "Done" : choiceCount ? "Confirm" : "Add",
    },
    info: {
      complete: infoReady,
      open: choicesReady || submittedToSchools,
      status: infoReady ? "Ready" : "Missing",
    },
    fee: {
      complete: feeComplete,
      open: canReviewFee,
      status: paymentComplete ? "Done" : feeComplete ? "Ready" : canReviewFee ? "Review" : "Locked",
    },
    payment: {
      complete: paymentComplete,
      open: submitReady || paymentComplete,
      status: paymentComplete ? "Paid" : submitReady ? "Pay" : "Locked",
    },
    send: {
      complete: submittedToSchools,
      open: sendReady,
      status: submittedToSchools ? "Sent" : paymentComplete ? "Ready" : submitReady ? "Pay first" : "Locked",
    },
  };
}

function updateRequiredStepCards() {
  const state = getRequiredStepState();
  document.querySelectorAll("[data-required-step]").forEach((card) => {
    const step = card.dataset.requiredStep;
    const item = state[step];
    if (!item) return;
    const active = step === currentApplicationStage || (step === "fee" && currentApplicationStage === "send" && !submittedToSchools);
    card.classList.toggle("done", item.complete);
    card.classList.toggle("active", active);
    card.classList.toggle("locked", !item.open);
    card.setAttribute("aria-disabled", item.open ? "false" : "true");
    const status = card.querySelector("[data-step-status]");
    if (status) status.textContent = item.status;
  });

  const lockSummary = document.querySelector("[data-lock-summary]");
  if (lockSummary) {
    const blockers = getSubmitBlockers();
    lockSummary.textContent = submittedToSchools
      ? "Submitted"
      : blockers.length
        ? `${blockers.length} left`
        : "Ready";
  }
  updateOverviewStepCards(state);
}

function updateOverviewStepCards(state = getRequiredStepState()) {
  document.querySelectorAll("[data-overview-step]").forEach((card) => {
    const step = card.dataset.overviewStep;
    const item = state[step];
    if (!item) return;
    const isActive = step === currentApplicationStage || (step === "info" && currentApplicationStage === "info");
    card.classList.toggle("ready", item.open && !item.complete && !["fee", "payment", "send"].includes(step));
    card.classList.toggle("done", item.complete);
    card.classList.toggle("active", isActive);
    card.classList.toggle("locked", !item.open);
    card.classList.toggle("warning", item.open && !item.complete && (step === "fee" || step === "payment" || step === "send"));
    card.setAttribute("aria-disabled", item.open ? "false" : "true");
    const status = card.querySelector("[data-overview-step-status]");
    if (status) status.textContent = item.status;
  });
  updateOverviewNextAction(state);
}

function getOverviewNextAction(state = getRequiredStepState()) {
  if (!state.choices.complete) {
    return {
      target: "choices",
      title: "Review choices",
      detail: choiceCount ? "Confirm the school order." : "Add a school-program choice.",
      action: choiceCount ? "Review choices" : "Add choice",
    };
  }
  if (!state.info.complete) {
    return {
      target: "info",
      title: "Confirm student info",
      detail: "Check the details schools will receive.",
      action: "Review student info",
    };
  }
  if (!state.fee.complete) {
    return {
      target: "fee",
      title: "Check fee",
      detail: "Review CUAC sending fee before payment.",
      action: "Fee review",
    };
  }
  if (!state.payment.complete) {
    return {
      target: "payment",
      title: "Pay CUAC fee",
      detail: "Payment unlocks final send.",
      action: "Payment",
    };
  }
  if (!submittedToSchools) {
    return {
      target: "send",
      title: "Ready to submit",
      detail: "Review the exact set before CUAC locks and queues it.",
      action: "Submit review",
    };
  }
  return {
    target: "send",
    title: "Accepted by CUAC",
    detail: "Track official delivery and later school actions separately.",
    action: "View status",
  };
}

function updateOverviewNextAction(state = getRequiredStepState()) {
  const next = getOverviewNextAction(state);
  const title = document.querySelector("[data-overview-next-title]");
  const detail = document.querySelector("[data-overview-next-detail]");
  const action = document.querySelector("[data-overview-next-action]");
  if (title) title.textContent = next.title;
  if (detail) detail.textContent = next.detail;
  if (action) {
    action.textContent = next.action;
    action.dataset.nextApplicationStep = next.target;
  }
}

function updateProgress() {
  const state = getRequiredStepState();
  const progress = submittedToSchools
    ? 100
    : Math.min(
        92,
        18 +
          (choiceCount ? 8 : 0) +
          (state.choices.complete ? 18 : 0) +
          (state.info.complete ? 22 : 0) +
          (state.fee.open ? 8 : 0) +
          (state.payment.complete ? 18 : 0),
      );
  document.querySelector("[data-progress-label]").textContent = `${progress}%`;
  document.querySelector("[data-progress-bar]").style.width = `${progress}%`;
  document.querySelector("[data-progress-bar]")?.closest(".status-ring")?.style.setProperty("--progress", `${progress}%`);
  updateRequiredStepCards();
}

function stageIndex(stage) {
  return Math.max(0, applicationStages.indexOf(stage));
}

function applicationStageHash(stage) {
  if (stage === "overview") return "#overview";
  if (stage === "info") return "#profile";
  return `#${stage}`;
}

function navigateApplicationStage(stage, { scroll = true } = {}) {
  const hash = applicationStageHash(stage);
  if (location.hash !== hash) {
    location.hash = hash;
    return;
  }
  setApplicationStage(stage, { scroll });
}

function canOpenApplicationStage(stage) {
  if (stage === "overview") return true;
  if (stage === "choices") return true;
  if (stage === "info") return true;
  if (stage === "fee") return choiceCount > 0 || submittedToSchools;
  if (stage === "payment") return getSubmitBlockers().length === 0 || submittedToSchools;
  if (stage === "send") return submittedToSchools || getRequiredStepState().payment.complete;
  return false;
}

function updateApplicationStepper() {
  const activeIndex = stageIndex(currentApplicationStage);
  document.querySelectorAll(".application-stepper [data-flow-target], .application-stepper [data-flow-static]").forEach((item) => {
    if (item.dataset.flowStatic) {
      item.classList.add("done");
      item.classList.remove("active", "locked");
      item.setAttribute("aria-disabled", "false");
      return;
    }
    if (!item.dataset.flowTarget) return;
    const target = item.dataset.flowTarget;
    const index = stageIndex(target);
    const isOpen = canOpenApplicationStage(target);
    item.classList.toggle("active", target === currentApplicationStage);
    item.classList.toggle("done", target !== currentApplicationStage && (index < activeIndex || (target === "send" && submittedToSchools)));
    item.classList.toggle("locked", !isOpen);
    item.setAttribute("aria-disabled", isOpen ? "false" : "true");
  });
}

function setApplicationStage(stage, { scroll = false } = {}) {
  if (!applicationStages.includes(stage)) return;
  if (!canOpenApplicationStage(stage)) {
    if (stage === "info") showSubmitBlockers("Review the student information before sending.");
    if (stage === "fee") showSubmitBlockers("Add at least one school choice before reviewing the fee.");
    if (stage === "payment") {
      const blockers = getSubmitBlockers();
      if (blockers.length) {
        showSubmitBlockers("Complete all required sections before payment.");
        stage = blockers[0].target;
      } else {
        stage = currentApplicationStage;
      }
    } else if (stage === "send") {
      if (canOpenApplicationStage("fee")) {
        showPageAction("Complete payment before final send.");
        stage = canOpenApplicationStage("payment") ? "payment" : "fee";
      } else {
        showSubmitBlockers("Complete the required sections before final submit.");
        stage = currentApplicationStage;
      }
    } else {
      stage = currentApplicationStage;
    }
  }
  if (stage !== "info") closeProfileDetailMode();
  currentApplicationStage = stage;
  document.querySelector(".application-page")?.setAttribute("data-application-stage", stage);
  updateApplicationStepper();
  if (stage === "payment") renderPaymentPage();
  if (stage === "send") renderSendPanelState();
  if (scroll) {
    const targetId = stage === "fee" ? "fee" : stage;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function choiceRingValue() {
  return orderConfirmed ? "Done" : String(choiceCount);
}

function updateChoiceLabels() {
  choiceCount = document.querySelectorAll("[data-choice]").length;
  const selectedLabel = `${choiceCount} selected`;
  document.querySelectorAll("[data-choice-total]").forEach((item) => {
    item.textContent = selectedLabel;
  });
  const choiceStatus = document.querySelector("[data-choice-status]");
  if (choiceStatus) choiceStatus.textContent = choiceRingValue();
  updateSubmissionSummary();
  updateProgress();
}

function syncChoiceConfirmationUi() {
  document.querySelector(".draft-card")?.classList.toggle("confirmed", orderConfirmed);
  document.querySelector(".choice-panel")?.classList.toggle("organized", orderConfirmed);
  const choiceStatus = document.querySelector("[data-choice-status]");
  if (choiceStatus) choiceStatus.textContent = choiceRingValue();
  if (orderConfirmed) {
    document.querySelector("[data-choice-step]").textContent = confirmedText;
  }
  document.querySelectorAll("[data-confirm-choice]").forEach((button) => {
    button.textContent = orderConfirmed ? "Choices confirmed" : "Confirm choices";
  });
}

async function confirmChoice({ scrollToFee = false } = {}) {
  if (applicationRuntimeState !== "ready" || !currentApplicationSet?.id || !choiceCount) {
    showPageAction("Add at least one server-backed program and intake before confirming the order.");
    return;
  }
  const button = document.querySelector("[data-confirm-choice]");
  if (button) button.disabled = true;
  try {
    const choiceIds = Array.from(document.querySelectorAll("[data-choice-id]")).map((card) => card.dataset.choiceId).filter(Boolean);
    await applicationApi(`/api/v1/student/application-sets/${encodeURIComponent(currentApplicationSet.id)}/choice-order`, {
      method: "PUT",
      body: { expectedRevision: currentApplicationSet.revision, choiceIds },
    });
    await refreshCurrentApplicationSet();
    orderConfirmed = true;
    syncChoiceConfirmationUi();
    showPageAction("Choice order saved to your application. Next: review the student information schools will receive.");
    updateProgress();
    updateSubmissionSummary();
    setApplicationStage(scrollToFee ? "info" : currentApplicationStage, { scroll: scrollToFee });
  } catch (error) {
    orderConfirmed = false;
    syncChoiceConfirmationUi();
    showPageAction(`Choice order was not saved: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

function resetChoiceConfirmationAfterChange() {
  invalidateBillingState();
  if (!orderConfirmed) return;
  orderConfirmed = false;
  document.querySelector("[data-choice-status]").textContent = choiceRingValue();
  document.querySelector("[data-choice-step]").textContent = "Recheck order";
  syncChoiceConfirmationUi();
  showPageAction("A new program was added. Recheck and confirm the choice order before reviewing the fee.");
  updateProgress();
  setApplicationStage("choices");
}

function showPageAction(message) {
  const panel = document.querySelector(".choice-panel");
  if (!panel) return;
  let notice = panel.querySelector("[data-application-action-notice]");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "application-action-notice";
    notice.dataset.applicationActionNotice = "";
    panel.prepend(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
}

function setChoiceModal(open) {
  const modal = document.querySelector("[data-choice-modal]");
  if (!modal) return;
  if (open && applicationRuntimeState !== "ready") {
    const message = applicationRuntimeState === "auth_required"
      ? "Sign in with a student account before adding an application choice."
      : "Application data must finish loading before a choice can be added.";
    showPageAction(message);
    return;
  }
  modal.classList.toggle("open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    modal.removeAttribute("inert");
    modal.querySelector("select, input, button")?.focus();
  } else {
    modal.setAttribute("inert", "");
  }
}

function setPaymentModal(open) {
  if (open) {
    const blockers = getSubmitBlockers();
    if (blockers.length) {
      showSubmitBlockers("Finish required sections first.");
      navigateApplicationStage(blockers[0].target, { scroll: true });
      return;
    }
    navigateApplicationStage("payment", { scroll: true });
    return;
  }
  document.querySelector("[data-payment-error]")?.setAttribute("hidden", "");
}

function fillChoice(value) {
  const [university, program] = value.split("|");
  const form = document.querySelector("[data-choice-form]");
  if (!form) return;
  const item = findCatalogProgramBySelection(university, program);
  if (item) form.elements.degree.value = appProgramDegree(item);
  renderUniversityOptions(form.elements.degree.value, university);
  renderProgramOptions(form.elements.university.value, item ? appProgramOptionValue(item) : program);
  void syncProgramFields();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

async function applicationApi(path, options = {}) {
  const request = {
    method: options.method || "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", ...(options.headers || {}) },
  };
  if (Object.hasOwn(options, "body")) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, request);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "The application request could not be completed.");
    error.code = payload?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return payload?.data;
}

function applicationIdempotencyKey(command) {
  const random = window.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `${command}_${random}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
}

function intakeDisplayName(intake = {}) {
  const rawTerm = String(intake.intakeTerm || "").trim();
  const term = rawTerm ? `${rawTerm.charAt(0).toUpperCase()}${rawTerm.slice(1).toLowerCase()}` : "";
  const year = Number(intake.intakeYear);
  return [term, Number.isInteger(year) ? year : ""].filter(Boolean).join(" ") || "Published intake";
}

function setApplicationRuntimeMessage(title, detail = "") {
  const list = document.querySelector("[data-choice-list]");
  if (!list) return;
  list.innerHTML = `
    <article class="choice-route backup" data-application-runtime-message>
      <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>
    </article>
  `;
  updateChoiceLabels();
}

async function ensureProgramIntakes(programId) {
  if (!programId) return [];
  if (catalogIntakesByProgramId.has(programId)) return catalogIntakesByProgramId.get(programId);
  const intakes = await applicationApi(`/api/v1/catalog/programs/${encodeURIComponent(programId)}/intakes?limit=20`);
  const safeIntakes = Array.isArray(intakes) ? intakes.filter((intake) => intake?.id && intake?.programId === programId) : [];
  catalogIntakesByProgramId.set(programId, safeIntakes);
  const program = catalogProgramsById.get(programId);
  if (program) program.intakes = safeIntakes;
  return safeIntakes;
}

async function ensureProgramDetail(programId) {
  const summary = catalogProgramsById.get(programId);
  if (!summary) throw new Error("The selected published program is unavailable.");
  if (catalogProgramDetailIds.has(programId)) return summary;
  const detail = await applicationApi(`/api/v1/catalog/programs/${encodeURIComponent(programId)}`);
  if (!detail || detail.id !== programId || detail.schoolId !== summary.schoolId) {
    throw new Error("The published program detail did not match the selected school and program.");
  }
  const school = summary.school;
  Object.assign(summary, detail, {
    university: detail.school?.nameEn || summary.university,
    school: { ...school, ...detail.school },
  });
  catalogProgramDetailIds.add(programId);
  return summary;
}

function rebuildProgramCatalog(programs, schools) {
  catalogProgramDetailIds.clear();
  catalogProgramsById = new Map(programs.filter((program) => program?.id && program?.schoolId).map((program) => [program.id, { ...program }]));
  catalogSchoolsById = new Map(schools.filter((school) => school?.id).map((school) => [school.id, school]));
  const grouped = {};
  catalogProgramsById.forEach((program) => {
    const school = catalogSchoolsById.get(program.schoolId);
    const schoolName = school?.nameEn || program.university || "Published university";
    const enriched = { ...program, university: schoolName, city: school?.cityZh || school?.city || "China", school };
    catalogProgramsById.set(program.id, enriched);
    if (!grouped[schoolName]) grouped[schoolName] = [];
    grouped[schoolName].push(enriched);
  });
  programCatalog = grouped;
  renderDegreeOptions();
  renderChoiceSuggestions();
}

function renderDegreeOptions() {
  const select = document.querySelector("[data-degree-select]");
  if (!select) return;
  const current = select.value;
  const degrees = [...new Set([...catalogProgramsById.values()].map(appProgramDegree).filter(Boolean))];
  select.innerHTML = degrees.length
    ? degrees.map((degree) => `<option value="${escapeHtml(degree)}">${escapeHtml(degree)}</option>`).join("")
    : '<option value="">No published study levels</option>';
  select.disabled = degrees.length === 0;
  if (degrees.includes(current)) select.value = current;
}

function renderChoiceSuggestions() {
  const container = document.querySelector("[data-choice-suggestions]");
  if (!container) return;
  const suggestions = [...catalogProgramsById.values()].slice(0, 3);
  container.innerHTML = suggestions.map((program) => {
    const university = appProgramSchoolName(program);
    const value = `${university}|${appProgramOptionValue(program)}`;
    return `<button type="button" data-fill-choice="${escapeHtml(value)}">${escapeHtml(university)} · ${escapeHtml(appProgramName(program))}</button>`;
  }).join("");
  container.hidden = suggestions.length === 0;
}

function applicationChoiceRoute(choice) {
  const program = choice?.programId ? catalogProgramsById.get(choice.programId) : null;
  const school = catalogSchoolsById.get(choice?.schoolId);
  const intake = (choice?.programId ? catalogIntakesByProgramId.get(choice.programId) : [])
    ?.find((item) => item.id === choice.programIntakeId);
  return {
    ...(program || {}),
    choiceId: choice.id,
    schoolId: choice.schoolId,
    programId: choice.programId || "",
    programIntakeId: choice.programIntakeId || "",
    university: school?.nameEn || program?.university || "Published university",
    program: program?.nameEn || "Published program",
    programName: program?.nameEn || "Published program",
    degree: program ? appProgramDegree(program) : "Degree",
    city: school?.cityZh || school?.city || program?.city || "China",
    intake: intakeDisplayName(intake),
    language: program ? appProgramLanguage(program) : "Language pending",
    tuition: program?.tuitionText || program?.displayTuition || "Tuition pending",
    deadline: intake?.deadlineLabel || intake?.deadlineDate || program?.deadlineLabel || "Deadline pending",
    signal: choice.status || "draft",
    choiceNote: choice.studentNotes || "",
    rankOrder: choice.rankOrder,
  };
}

async function renderServerApplicationSet(applicationSet) {
  currentApplicationSet = applicationSet;
  const choices = Array.isArray(applicationSet?.choices) ? [...applicationSet.choices].sort((a, b) => a.rankOrder - b.rankOrder) : [];
  const programIds = [...new Set(choices.map((choice) => choice.programId).filter(Boolean))];
  await Promise.all(programIds.flatMap((programId) => [ensureProgramDetail(programId), ensureProgramIntakes(programId)]));
  const choiceRoutes = choices.map(applicationChoiceRoute);
  const list = document.querySelector("[data-choice-list]");
  if (!list) return;
  list.innerHTML = "";
  nextChoiceId = 0;
  choiceRoutes.forEach((route) => appendChoiceRoute(route, { hydrating: true }));
  if (!choices.length) setApplicationRuntimeMessage("No application choices yet", "Add a published program and intake to start this application set.");
  const cities = new Set(choiceRoutes.map((route) => route.city).filter((city) => city && city !== "China"));
  const deadlines = choices.map((choice) => (catalogIntakesByProgramId.get(choice.programId) || [])
    .find((intake) => intake.id === choice.programIntakeId)).filter(Boolean)
    .sort((a, b) => new Date(a.deadlineDate || "9999-12-31") - new Date(b.deadlineDate || "9999-12-31"));
  const applicationLabel = document.querySelector("[data-application-label]");
  const applicationScope = document.querySelector("[data-application-scope]");
  const earliestDeadline = document.querySelector("[data-earliest-deadline]");
  if (applicationLabel) applicationLabel.textContent = applicationSet?.targetIntake || applicationSet?.name || "Application draft";
  if (applicationScope) applicationScope.textContent = cities.size ? `${cities.size} ${cities.size === 1 ? "city" : "cities"}` : "server record";
  if (earliestDeadline) earliestDeadline.textContent = deadlines[0]?.deadlineLabel || deadlines[0]?.deadlineDate?.slice(0, 10) || "Not set";
  const cuacId = applicationSet?.cuacId || "Not assigned";
  document.querySelectorAll("[data-cuac-id]").forEach((target) => { target.textContent = cuacId; });
  document.querySelector('[name="cuacId"]')?.setAttribute("value", cuacId);
  submittedToSchools = applicationSet?.status !== "draft";
  orderConfirmed = choices.length > 0 && applicationSet?.status !== "draft";
  applicationRuntimeState = "ready";
  for (const choiceId of [...materialChoiceStates.keys()]) {
    if (!choices.some((choice) => choice.id === choiceId)) materialChoiceStates.delete(choiceId);
  }
  if (!choices.some((choice) => choice.id === currentMaterialChoiceId)) currentMaterialChoiceId = choices[0]?.id || "";
  renderMaterialChoiceTabs();
  updateChoiceLabels();
  syncChoiceConfirmationUi();
  updateSubmissionSummary();
}

async function refreshCurrentApplicationSet() {
  if (!currentApplicationSet?.id) return null;
  const current = await applicationApi(`/api/v1/student/application-sets/${encodeURIComponent(currentApplicationSet.id)}`);
  await renderServerApplicationSet(current);
  return current;
}

async function initializeApplicationRuntime() {
  setApplicationRuntimeMessage("Loading your application set", "Reading the current server-authorized record.");
  try {
    await window.CUAC?.authReady?.();
    if (!window.CUAC?.isStudentSignedIn?.()) {
      applicationRuntimeState = "auth_required";
      setApplicationRuntimeMessage("Sign in to view your applications", "Application sets and choices are private student records.");
      return;
    }
    const [applicationSets, programs, schools, applicantProfile, educationHistory, assessmentHistory] = await Promise.all([
      applicationApi("/api/v1/student/application-sets"),
      applicationApi("/api/v1/catalog/programs?limit=100"),
      applicationApi("/api/v1/catalog/schools?limit=100"),
      applicationApi("/api/v1/student/applicant-profile"),
      applicationApi("/api/v1/student/education-records"),
      applicationApi("/api/v1/student/assessment-records"),
    ]);
    applicantProfileRecord = applicantProfile || null;
    educationHistoryRecord = normalizeHistory(educationHistory);
    assessmentHistoryRecord = normalizeHistory(assessmentHistory);
    studentRecordsRuntimeState = "ready";
    renderApplicantProfile();
    renderEducationHistory();
    renderAssessmentHistory();
    void loadStudentFiles();
    rebuildProgramCatalog(Array.isArray(programs) ? programs : [], Array.isArray(schools) ? schools : []);
    const sets = Array.isArray(applicationSets) ? applicationSets : [];
    const routeParams = new URLSearchParams(location.search);
    const directApplicationSetLocator = routeParams.get("applicationSet")?.trim() || "";
    const invoiceLocator = routeParams.get("invoiceId")?.trim() || "";
    if (directApplicationSetLocator && !APPLICATION_SET_LOCATOR_PATTERN.test(directApplicationSetLocator)) {
      throw new Error("The application set locator is invalid.");
    }
    if (invoiceLocator && !APPLICATION_SET_LOCATOR_PATTERN.test(invoiceLocator)) {
      throw new Error("The invoice locator is invalid.");
    }
    const requestedInvoice = invoiceLocator
      ? await applicationApi(`/api/v1/billing/invoices/${encodeURIComponent(invoiceLocator)}`)
      : null;
    if (requestedInvoice && (requestedInvoice.invoiceId !== invoiceLocator
      || !APPLICATION_SET_LOCATOR_PATTERN.test(requestedInvoice.applicationSetId || ""))) {
      throw new Error("The requested invoice is not a valid student billing record.");
    }
    if (requestedInvoice && directApplicationSetLocator
      && requestedInvoice.applicationSetId !== directApplicationSetLocator) {
      throw new Error("The invoice does not belong to the requested application set.");
    }
    const applicationSetLocator = requestedInvoice?.applicationSetId || directApplicationSetLocator;
    const selected = applicationSetLocator
      ? sets.find((applicationSet) => applicationSet?.id === applicationSetLocator) || null
      : sets.find((applicationSet) => applicationSet?.status === "draft") || sets[0] || null;
    if (applicationSetLocator && !selected) throw new Error("The requested application set is not available to this student account.");
    if (selected?.id) {
      const current = await applicationApi(`/api/v1/student/application-sets/${encodeURIComponent(selected.id)}`);
      await renderServerApplicationSet(current);
      if (requestedInvoice) savePendingInvoiceLocator(requestedInvoice);
      if (current?.status === "draft") {
        await refreshAllChoicePreflights();
        await loadBillingFeePreview();
        const checkoutHint = new URLSearchParams(location.search).get("checkout");
        if (readPendingInvoiceLocator()) await refreshCheckoutStatus({ silent: !requestedInvoice && checkoutHint !== "success" });
        else if (checkoutHint) {
          billingErrorMessage = "The checkout return did not include a matching server invoice locator. Start or refresh checkout from this application set.";
          renderPaymentPage();
        }
        if (checkoutHint) clearCheckoutReturnHint();
      } else if (requestedInvoice) {
        await refreshCheckoutStatus();
      }
    } else {
      currentApplicationSet = null;
      currentMaterialChoiceId = "";
      materialChoiceStates.clear();
      applicationRuntimeState = "ready";
      setApplicationRuntimeMessage("No application set yet", "Choose a published program and intake; CUAC will create the first draft when you add it.");
      renderMaterialChoiceTabs();
    }
    renderUniversityOptions(document.querySelector("[data-degree-select]")?.value || "Master");
    await syncProgramFields();
    openChoiceModalFromHash();
  } catch (error) {
    applicationRuntimeState = "unavailable";
    studentRecordsRuntimeState = "unavailable";
    setProfileOperationStatus("applicant", `Applicant records unavailable: ${error.message}`, "error");
    setApplicationRuntimeMessage("Application data unavailable", error.message);
    showPageAction(`Application data could not be loaded: ${error.message}`);
  }
}

function splitProgramLevel(program) {
  const match = String(program || "").match(/^(.*)\s+(BSc|MSc|BA|BArch)$/);
  return {
    name: match ? match[1] : String(program || "Selected program"),
    level: match ? match[2] : "Route",
  };
}

function getFieldValue(form, name, fallback = "") {
  const value = form?.elements?.[name]?.value?.trim();
  return value || fallback;
}

function normalizeHistory(value) {
  return {
    revision: Number.isInteger(value?.revision) && value.revision >= 0 ? value.revision : 0,
    records: Array.isArray(value?.records) ? value.records : [],
  };
}

function nullableField(form, name) {
  const value = form?.elements?.[name]?.value?.trim();
  return value ? value : null;
}

function nullableYear(form, name) {
  const value = nullableField(form, name);
  return value === null ? null : Number(value);
}

function setProfileOperationStatus(section, message = "", tone = "") {
  const status = document.querySelector(`[data-profile-operation-status="${section}"]`);
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function getStudentProfile() {
  const form = document.querySelector("[data-applicant-profile-form]");
  return {
    fullName: nullableField(form, "fullName"),
    contactEmail: nullableField(form, "contactEmail"),
    citizenshipCountry: nullableField(form, "citizenshipCountry"),
    educationRecords: educationHistoryRecord.records,
    assessmentRecords: assessmentHistoryRecord.records,
  };
}

function renderApplicantProfile() {
  const form = document.querySelector("[data-applicant-profile-form]");
  if (!form) return;
  form.elements.fullName.value = applicantProfileRecord?.fullName || "";
  form.elements.contactEmail.value = applicantProfileRecord?.contactEmail || "";
  form.elements.citizenshipCountry.value = applicantProfileRecord?.citizenshipCountry || "";
  profileSectionSaveState.applicant = true;
  setProfileOperationStatus("applicant", applicantProfileRecord
    ? `Saved revision ${applicantProfileRecord.revision}.`
    : "No applicant record yet. Save these fields to create revision 1.", applicantProfileRecord ? "success" : "neutral");
  renderStudentInfoStatus();
  updateProfileSaveStatus("applicant");
}

async function saveApplicantProfile() {
  const form = document.querySelector("[data-applicant-profile-form]");
  const button = document.querySelector("[data-save-profile-section]");
  if (!form || !form.reportValidity()) return;
  if (button) button.disabled = true;
  setProfileOperationStatus("applicant", "Saving applicant record...", "pending");
  try {
    applicantProfileRecord = await applicationApi("/api/v1/student/applicant-profile", {
      method: "PATCH",
      body: {
        expectedRevision: applicantProfileRecord?.revision || 0,
        fullName: nullableField(form, "fullName"),
        contactEmail: nullableField(form, "contactEmail"),
        citizenshipCountry: nullableField(form, "citizenshipCountry"),
      },
    });
    invalidateMaterialPreparation();
    profileSectionSaveState.applicant = true;
    setProfileOperationStatus("applicant", `Saved revision ${applicantProfileRecord.revision}.`, "success");
    renderStudentInfoStatus();
    updateSubmissionSummary();
    updateProfileSaveStatus("applicant");
  } catch (error) {
    const detail = error.status === 409
      ? "This record changed elsewhere. Your entries are still here; reload before saving again."
      : error.message;
    setProfileOperationStatus("applicant", `Applicant record was not saved: ${detail}`, "error");
    showPageAction(`Applicant record was not saved: ${detail}`);
  } finally {
    if (button) button.disabled = false;
  }
}

function educationPeriod(record) {
  if (record.startYear && record.endYear) return `${record.startYear}-${record.endYear}`;
  if (record.startYear && record.expectedCompletionYear) return `${record.startYear}-expected ${record.expectedCompletionYear}`;
  if (record.startYear) return `From ${record.startYear}`;
  return "Dates not set";
}

function renderEducationHistory() {
  const list = document.querySelector("[data-education-record-list]");
  if (!list) return;
  const records = educationHistoryRecord.records;
  list.innerHTML = records.length ? records.map((record) => `
    <article class="profile-record-item">
      <div><strong>${escapeHtml(record.institutionName)}</strong><span>${escapeHtml(record.qualificationName || record.educationLevel)}${record.fieldOfStudy ? ` · ${escapeHtml(record.fieldOfStudy)}` : ""}</span></div>
      <div class="profile-record-meta"><span>${escapeHtml(record.institutionCountry || "Country not set")}</span><span>${escapeHtml(educationPeriod(record))}</span><span>${escapeHtml(String(record.attendanceStatus || "unknown").replaceAll("_", " "))}</span></div>
      <div class="profile-record-actions">
        <button class="record-edit-button" type="button" data-edit-education-record="${escapeHtml(record.id)}">Edit</button>
        <button class="record-remove-button" type="button" data-remove-education-record="${escapeHtml(record.id)}" aria-label="Remove ${escapeHtml(record.institutionName)}">Remove</button>
      </div>
    </article>
  `).join("") : '<div class="profile-record-empty"><strong>No education records</strong><span>Add the latest or current institution first.</span></div>';
  setProfileOperationStatus("education", `History revision ${educationHistoryRecord.revision}.`, records.length ? "success" : "neutral");
  renderStudentInfoStatus();
}

function resetEducationForm() {
  const form = document.querySelector("[data-education-record-form]");
  if (!form) return;
  form.reset();
  delete form.dataset.educationRecordId;
  const save = form.querySelector("[data-save-education-record]");
  const cancel = form.querySelector("[data-cancel-education-edit]");
  if (save) save.textContent = "Add education record";
  if (cancel) cancel.hidden = true;
}

function startEducationEdit(recordId) {
  const record = educationHistoryRecord.records.find((item) => item.id === recordId);
  const form = document.querySelector("[data-education-record-form]");
  if (!record || !form) return;
  form.dataset.educationRecordId = record.id;
  for (const name of ["institutionName", "institutionCountry", "educationLevel", "qualificationName", "fieldOfStudy", "attendanceStatus", "startYear", "endYear", "expectedCompletionYear"]) {
    if (form.elements?.[name]) form.elements[name].value = record[name] ?? "";
  }
  const save = form.querySelector("[data-save-education-record]");
  const cancel = form.querySelector("[data-cancel-education-edit]");
  if (save) save.textContent = "Save education changes";
  if (cancel) cancel.hidden = false;
  form.elements.institutionName.focus();
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveEducationRecord(form) {
  if (!form?.reportValidity()) return;
  const recordId = form.dataset.educationRecordId || "";
  const button = form.querySelector("[data-save-education-record]");
  if (button) button.disabled = true;
  setProfileOperationStatus("education", recordId ? "Saving education changes..." : "Adding education record...", "pending");
  try {
    const path = recordId
      ? `/api/v1/student/education-records/${encodeURIComponent(recordId)}`
      : "/api/v1/student/education-records";
    educationHistoryRecord = normalizeHistory(await applicationApi(path, {
      method: recordId ? "PATCH" : "POST",
      body: {
        expectedRevision: educationHistoryRecord.revision,
        institutionName: getFieldValue(form, "institutionName"),
        institutionCountry: nullableField(form, "institutionCountry"),
        educationLevel: getFieldValue(form, "educationLevel"),
        qualificationName: nullableField(form, "qualificationName"),
        fieldOfStudy: nullableField(form, "fieldOfStudy"),
        attendanceStatus: getFieldValue(form, "attendanceStatus", "unknown"),
        startYear: nullableYear(form, "startYear"),
        endYear: nullableYear(form, "endYear"),
        expectedCompletionYear: nullableYear(form, "expectedCompletionYear"),
      },
    }));
    invalidateMaterialPreparation();
    resetEducationForm();
    renderEducationHistory();
    updateSubmissionSummary();
  } catch (error) {
    const detail = error.status === 409 ? "The history changed elsewhere. Reload before saving this record." : error.message;
    setProfileOperationStatus("education", `Education record was not saved: ${detail}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function removeEducationRecord(recordId, button) {
  if (!recordId || !educationHistoryRecord.records.some((record) => record.id === recordId)) return;
  if (button) button.disabled = true;
  setProfileOperationStatus("education", "Removing education record...", "pending");
  try {
    educationHistoryRecord = normalizeHistory(await applicationApi(`/api/v1/student/education-records/${encodeURIComponent(recordId)}/remove`, {
      method: "POST",
      body: { expectedRevision: educationHistoryRecord.revision },
    }));
    invalidateMaterialPreparation();
    renderEducationHistory();
    updateSubmissionSummary();
  } catch (error) {
    const detail = error.status === 409 ? "The history changed elsewhere. Reload before removing this record." : error.message;
    setProfileOperationStatus("education", `Education record was not removed: ${detail}`, "error");
    if (button) button.disabled = false;
  }
}

function assessmentResult(record) {
  if (record.resultStatus !== "reported") return String(record.resultStatus || "planned").replaceAll("_", " ");
  return record.components.map((component) => `${component.name}: ${component.value}${component.scale ? ` (${component.scale})` : ""}`).join(" · ");
}

function renderAssessmentHistory() {
  const list = document.querySelector("[data-assessment-record-list]");
  if (!list) return;
  const records = assessmentHistoryRecord.records;
  list.innerHTML = records.length ? records.map((record) => `
    <article class="profile-record-item">
      <div><strong>${escapeHtml(record.assessmentName)}</strong><span>${escapeHtml(record.assessmentVariant || record.assessmentCategory)}</span></div>
      <div class="profile-record-meta"><span>${escapeHtml(assessmentResult(record))}</span><span>${escapeHtml(record.testDate || "Date not set")}</span><span>Self-reported</span></div>
      <div class="profile-record-actions">
        <button class="record-edit-button" type="button" data-edit-assessment-record="${escapeHtml(record.id)}">Edit</button>
        <button class="record-remove-button" type="button" data-remove-assessment-record="${escapeHtml(record.id)}" aria-label="Remove ${escapeHtml(record.assessmentName)}">Remove</button>
      </div>
    </article>
  `).join("") : '<div class="profile-record-empty"><strong>No exams or tests</strong><span>Add a planned test or a self-reported result when relevant.</span></div>';
  setProfileOperationStatus("assessments", `History revision ${assessmentHistoryRecord.revision}.`, records.length ? "success" : "neutral");
  renderStudentInfoStatus();
}

function assessmentComponentMarkup(component = {}) {
  return `
    <div class="assessment-component-row" data-assessment-component>
      <label><span>Component *</span><input data-component-name maxlength="80" required value="${escapeHtml(component.name || "")}" placeholder="Overall" /></label>
      <label><span>Value *</span><input data-component-value maxlength="80" required value="${escapeHtml(component.value || "")}" placeholder="7.5" /></label>
      <label><span>Scale</span><input data-component-scale maxlength="80" value="${escapeHtml(component.scale || "")}" placeholder="0-9" /></label>
      <label><span>Component test date</span><input data-component-test-date type="date" value="${escapeHtml(component.testDate || "")}" /></label>
      <button class="record-remove-button" type="button" data-remove-assessment-component aria-label="Remove score component">Remove</button>
    </div>
  `;
}

function addAssessmentComponent(component = {}) {
  document.querySelector("[data-assessment-component-list]")?.insertAdjacentHTML("beforeend", assessmentComponentMarkup(component));
}

function resetAssessmentForm() {
  const form = document.querySelector("[data-assessment-record-form]");
  if (!form) return;
  form.reset();
  delete form.dataset.assessmentRecordId;
  document.querySelector("[data-assessment-component-list]")?.replaceChildren();
  const save = form.querySelector("[data-save-assessment-record]");
  const cancel = form.querySelector("[data-cancel-assessment-edit]");
  if (save) save.textContent = "Add exam or test";
  if (cancel) cancel.hidden = true;
  syncAssessmentEntryState();
}

function startAssessmentEdit(recordId) {
  const record = assessmentHistoryRecord.records.find((item) => item.id === recordId);
  const form = document.querySelector("[data-assessment-record-form]");
  if (!record || !form) return;
  form.dataset.assessmentRecordId = record.id;
  for (const name of ["assessmentCategory", "assessmentName", "assessmentVariant", "resultStatus", "resultForm", "testDate", "reportDate"]) {
    if (form.elements?.[name]) form.elements[name].value = record[name] ?? "";
  }
  const list = document.querySelector("[data-assessment-component-list]");
  if (list) list.innerHTML = record.components.map(assessmentComponentMarkup).join("");
  const save = form.querySelector("[data-save-assessment-record]");
  const cancel = form.querySelector("[data-cancel-assessment-edit]");
  if (save) save.textContent = "Save exam or test changes";
  if (cancel) cancel.hidden = false;
  syncAssessmentEntryState();
  form.elements.assessmentName.focus();
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function assessmentComponentsFromForm() {
  return Array.from(document.querySelectorAll("[data-assessment-component]")).map((row) => ({
    name: row.querySelector("[data-component-name]")?.value.trim() || "",
    value: row.querySelector("[data-component-value]")?.value.trim() || "",
    scale: row.querySelector("[data-component-scale]")?.value.trim() || null,
    testDate: row.querySelector("[data-component-test-date]")?.value || null,
  }));
}

function syncAssessmentEntryState() {
  const form = document.querySelector("[data-assessment-record-form]");
  const reported = form?.elements?.resultStatus?.value === "reported";
  document.querySelectorAll("[data-reported-result-field]").forEach((field) => field.toggleAttribute("hidden", !reported));
  document.querySelector("[data-assessment-components]")?.toggleAttribute("hidden", !reported);
  if (reported && !document.querySelector("[data-assessment-component]")) addAssessmentComponent();
}

async function saveAssessmentRecord(form) {
  syncAssessmentEntryState();
  if (!form?.reportValidity()) return;
  const reported = getFieldValue(form, "resultStatus") === "reported";
  const recordId = form.dataset.assessmentRecordId || "";
  const button = form.querySelector("[data-save-assessment-record]");
  if (button) button.disabled = true;
  setProfileOperationStatus("assessments", recordId ? "Saving exam or test changes..." : "Adding exam or test...", "pending");
  try {
    const path = recordId
      ? `/api/v1/student/assessment-records/${encodeURIComponent(recordId)}`
      : "/api/v1/student/assessment-records";
    assessmentHistoryRecord = normalizeHistory(await applicationApi(path, {
      method: recordId ? "PATCH" : "POST",
      body: {
        expectedRevision: assessmentHistoryRecord.revision,
        assessmentCategory: getFieldValue(form, "assessmentCategory"),
        assessmentName: getFieldValue(form, "assessmentName"),
        assessmentVariant: nullableField(form, "assessmentVariant"),
        resultStatus: getFieldValue(form, "resultStatus"),
        resultForm: getFieldValue(form, "resultForm", "unspecified"),
        testDate: nullableField(form, "testDate"),
        reportDate: reported ? nullableField(form, "reportDate") : null,
        components: reported ? assessmentComponentsFromForm() : [],
      },
    }));
    invalidateMaterialPreparation();
    resetAssessmentForm();
    renderAssessmentHistory();
  } catch (error) {
    const detail = error.status === 409 ? "The history changed elsewhere. Reload before saving this record." : error.message;
    setProfileOperationStatus("assessments", `Exam or test was not saved: ${detail}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function removeAssessmentRecord(recordId, button) {
  if (!recordId || !assessmentHistoryRecord.records.some((record) => record.id === recordId)) return;
  if (button) button.disabled = true;
  setProfileOperationStatus("assessments", "Removing exam or test...", "pending");
  try {
    assessmentHistoryRecord = normalizeHistory(await applicationApi(`/api/v1/student/assessment-records/${encodeURIComponent(recordId)}/remove`, {
      method: "POST",
      body: { expectedRevision: assessmentHistoryRecord.revision },
    }));
    invalidateMaterialPreparation();
    renderAssessmentHistory();
  } catch (error) {
    const detail = error.status === 409 ? "The history changed elsewhere. Reload before removing this record." : error.message;
    setProfileOperationStatus("assessments", `Exam or test was not removed: ${detail}`, "error");
    if (button) button.disabled = false;
  }
}

function formatFileBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function renderStudentFiles() {
  const list = document.querySelector("[data-private-file-list]");
  const summary = document.querySelector("[data-private-file-summary]");
  if (!list || !summary) return;
  if (studentFilesRuntimeState === "loading") {
    summary.innerHTML = "<strong>Loading private file inventory</strong><span>Reading the owner-scoped file service.</span>";
    list.innerHTML = "";
    return;
  }
  if (studentFilesRuntimeState === "unavailable") {
    summary.innerHTML = "<strong>Private file service unavailable</strong><span>Uploads and downloads stay disabled until private object storage is configured.</span>";
    list.innerHTML = '<div class="profile-record-empty"><strong>No file status was inferred</strong><span>Applicant answers and browser storage are never treated as uploaded evidence.</span></div>';
    return;
  }
  const active = studentFileRecords.filter((file) => file?.status !== "deleted");
  const clean = active.filter((file) => file.status === "clean").length;
  summary.innerHTML = `<strong>${active.length} private ${active.length === 1 ? "file" : "files"}</strong><span>${clean} clean · ${active.length - clean} processing or awaiting action</span>`;
  list.innerHTML = active.length ? active.map((file) => {
    const status = studentFileStatusLabels[file.status] || file.status || "Unknown";
    const category = studentFileCategoryLabels[file.category] || file.category || "Private file";
    const canDownload = file.status === "clean";
    const canDelete = !["delete_pending", "deleting", "deleted"].includes(file.status);
    return `
      <article class="profile-record-item private-file-item" data-private-file-id="${escapeHtml(file.id)}">
        <div><strong>${escapeHtml(file.filename)}</strong><span>${escapeHtml(category)}</span></div>
        <div class="profile-record-meta"><span>${escapeHtml(formatFileBytes(file.sizeBytes))}</span><span>${escapeHtml(file.contentType)}</span><span class="file-scan-status" data-file-status="${escapeHtml(file.status)}">${escapeHtml(status)}</span></div>
        <div class="profile-record-actions">
          ${canDownload ? '<button class="record-edit-button" type="button" data-download-private-file>Download</button>' : ""}
          ${canDelete ? '<button class="record-remove-button" type="button" data-delete-private-file>Delete</button>' : ""}
        </div>
      </article>`;
  }).join("") : '<div class="profile-record-empty"><strong>No private files yet</strong><span>Upload evidence only when you need it. A file is not ready until the server scan marks it clean.</span></div>';
  renderProfileSectionState();
}

async function loadStudentFiles({ force = false } = {}) {
  if (!force && ["ready", "unavailable"].includes(studentFilesRuntimeState)) {
    renderStudentFiles();
    return;
  }
  studentFilesRuntimeState = "loading";
  renderStudentFiles();
  try {
    const files = await applicationApi("/api/v1/student/files");
    studentFileRecords = Array.isArray(files) ? files : [];
    studentFilesRuntimeState = "ready";
    setProfileOperationStatus("files", "Private file inventory loaded.", "success");
  } catch (error) {
    studentFileRecords = [];
    studentFilesRuntimeState = "unavailable";
    setProfileOperationStatus("files", `Private files unavailable: ${error.message}`, "error");
  }
  renderStudentFiles();
}

function studentFileContentType(file) {
  const supported = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (supported.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })[extension] || "";
}

async function studentFileSha256(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadStudentFile(form) {
  const file = form.elements.file?.files?.[0];
  const button = form.querySelector("[data-upload-private-file]");
  if (!file) return;
  const contentType = studentFileContentType(file);
  if (!contentType || file.size < 1 || file.size > 25 * 1024 * 1024) {
    setProfileOperationStatus("files", "Choose a supported PDF, JPG, PNG or DOCX file no larger than 25 MB.", "error");
    return;
  }
  if (button) button.disabled = true;
  setProfileOperationStatus("files", "Checking file integrity and requesting a private upload link...", "pending");
  try {
    const intent = await applicationApi("/api/v1/student/files", {
      method: "POST",
      headers: { "Idempotency-Key": applicationIdempotencyKey("student_file_upload") },
      body: { category: form.elements.category.value, filename: file.name, contentType, sizeBytes: file.size, sha256: await studentFileSha256(file) },
    });
    if (!intent?.file?.id || !intent?.upload?.url) throw new Error("The private upload link is no longer available. Refresh the file inventory before retrying.");
    const uploaded = await fetch(intent.upload.url, { method: intent.upload.method || "PUT", headers: intent.upload.headers || {}, body: file });
    if (!uploaded.ok) throw new Error("The encrypted object upload was not accepted.");
    await applicationApi(`/api/v1/student/files/${encodeURIComponent(intent.file.id)}/complete`, {
      method: "POST",
      body: { expectedRevision: intent.file.revision },
    });
    form.reset();
    studentFilesRuntimeState = "loading";
    await loadStudentFiles({ force: true });
    setProfileOperationStatus("files", "Upload complete. The file remains unavailable until its scan finishes.", "success");
  } catch (error) {
    setProfileOperationStatus("files", `File was not uploaded: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function downloadStudentFile(button) {
  const record = button.closest("[data-private-file-id]");
  if (!record?.dataset.privateFileId) return;
  button.disabled = true;
  try {
    const download = await applicationApi(`/api/v1/student/files/${encodeURIComponent(record.dataset.privateFileId)}/download`, { method: "POST" });
    if (!download?.url) throw new Error("A private download link was not returned.");
    window.open(download.url, "_blank", "noopener,noreferrer");
    setProfileOperationStatus("files", "A short-lived private download link was opened.", "success");
  } catch (error) {
    setProfileOperationStatus("files", `File could not be downloaded: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteStudentFile(button) {
  const record = button.closest("[data-private-file-id]");
  const file = studentFileRecords.find((item) => item.id === record?.dataset.privateFileId);
  if (!file || !window.confirm(`Delete ${file.filename} from your private inventory?`)) return;
  button.disabled = true;
  try {
    await applicationApi(`/api/v1/student/files/${encodeURIComponent(file.id)}/delete`, { method: "POST", body: { expectedRevision: file.revision } });
    studentFilesRuntimeState = "loading";
    await loadStudentFiles({ force: true });
    setProfileOperationStatus("files", "File deletion was queued and will be completed by the private file worker.", "success");
  } catch (error) {
    setProfileOperationStatus("files", `File was not deleted: ${error.message}`, "error");
    button.disabled = false;
  }
}

function applicationChoices() {
  return Array.isArray(currentApplicationSet?.choices) ? [...currentApplicationSet.choices].sort((a, b) => a.rankOrder - b.rankOrder) : [];
}

function materialChoiceState(choiceId) {
  if (!materialChoiceStates.has(choiceId)) materialChoiceStates.set(choiceId, {
    runtime: "idle", selection: null, preview: null, preflight: null, authorization: null, snapshot: null, notice: null, snapshotUnavailable: false, error: "",
  });
  return materialChoiceStates.get(choiceId);
}

function invalidateMaterialPreparation() {
  materialChoiceStates.forEach((state) => {
    state.runtime = "idle";
    state.selection = null;
    state.preview = null;
    state.preflight = null;
    state.authorization = null;
    state.snapshot = null;
    state.notice = null;
    state.error = "";
  });
  renderMaterialChoiceTabs();
  renderProfileSectionState();
}

function materialChoiceLabel(choice) {
  const route = applicationChoiceRoute(choice);
  return { school: route.university, program: route.program, intake: route.intake };
}

function materialChoicePath(choiceId, suffix) {
  return `/api/v1/student/application-sets/${encodeURIComponent(currentApplicationSet.id)}/choices/${encodeURIComponent(choiceId)}/${suffix}`;
}

function materialSelectionFromWorkspace() {
  const workspace = document.querySelector("[data-material-envelope-workspace]");
  return {
    applicantFields: [...workspace.querySelectorAll("[data-material-applicant-field]:checked")].map((input) => input.value),
    educationRecordIds: [...workspace.querySelectorAll("[data-material-education-record]:checked")].map((input) => input.value).sort(),
    assessmentRecordIds: [...workspace.querySelectorAll("[data-material-assessment-record]:checked")].map((input) => input.value).sort(),
  };
}

function materialSelectionsEqual(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

function materialEnvelopeStatus(state) {
  if (state.preflight?.submissionAuthorization?.current && state.preflight?.materialSnapshot?.current) return "Sealed";
  if (state.runtime === "loading") return "Loading";
  if (state.error) return "Check";
  if (state.selection?.revision > 0) return "Draft saved";
  return "Start";
}

function renderMaterialChoiceTabs() {
  const tabs = document.querySelector("[data-material-choice-tabs]");
  if (!tabs) return;
  const choices = applicationChoices();
  if (!choices.some((choice) => choice.id === currentMaterialChoiceId)) currentMaterialChoiceId = choices[0]?.id || "";
  tabs.innerHTML = choices.map((choice) => {
    const label = materialChoiceLabel(choice);
    const active = choice.id === currentMaterialChoiceId;
    return `<button type="button" role="tab" aria-selected="${active}" class="${active ? "active" : ""}" data-material-choice-id="${escapeHtml(choice.id)}"><span>${escapeHtml(label.school)}</span><strong>${escapeHtml(label.program)}</strong><em>${escapeHtml(materialEnvelopeStatus(materialChoiceState(choice.id)))}</em></button>`;
  }).join("");
  if (!choices.length) renderMaterialEnvelopeWorkspace();
}

function preflightIssueLabel(issue) {
  return ({
    APPLICATION_SET_NOT_EDITABLE: "Application set is not editable",
    CHOICE_NOT_EDITABLE: "Choice is not editable",
    SCHOOL_UNAVAILABLE: "School is unavailable",
    PROGRAM_REQUIRED: "Program is required",
    PROGRAM_UNAVAILABLE: "Program is unavailable",
    INTAKE_REQUIRED: "Intake is required",
    INTAKE_UNAVAILABLE: "Intake is unavailable",
    WINDOW_UNCONFIRMED: "Application window is unconfirmed",
    WINDOW_INVALID: "Application window is invalid",
    WINDOW_NOT_OPEN: "Application window is not open",
    WINDOW_CLOSED: "Application window has closed",
    SCHOLARSHIP_UNAVAILABLE: "Scholarship route is unavailable",
    SCHOOL_APPLICATION_EXISTS: "School application already exists",
    EXISTING_APPLICATION_REVIEW_REQUIRED: "An existing application needs review",
    ADMISSION_ROUTE_REQUIRED: "Admission route is missing",
    REQUIREMENTS_UNAVAILABLE: "Published requirements are unavailable",
    REQUIREMENTS_UNASSESSED: "Published requirements are not yet assessed",
    NOTICE_UNAVAILABLE: "Disclosure notice is unavailable",
  })[issue] || String(issue || "Preparation issue").replaceAll("_", " ").toLowerCase();
}

function materialRecordOptions(records, selectedIds, type) {
  if (!records.length) return '<div class="material-empty-row">No saved records available</div>';
  return records.map((record) => {
    const checked = selectedIds.includes(record.id) ? "checked" : "";
    const title = type === "education" ? record.institutionName : `${record.assessmentName}${record.assessmentVariant ? ` · ${record.assessmentVariant}` : ""}`;
    const detail = type === "education"
      ? [record.educationLevel, record.qualificationName, record.attendanceStatus].filter(Boolean).join(" · ")
      : [record.resultStatus, record.testDate, record.components?.length ? `${record.components.length} score component${record.components.length === 1 ? "" : "s"}` : "No reported scores"].filter(Boolean).join(" · ");
    const attribute = type === "education" ? "data-material-education-record" : "data-material-assessment-record";
    return `<label class="material-selection-row"><input type="checkbox" ${attribute} value="${escapeHtml(record.id)}" ${checked}/><span><strong>${escapeHtml(title)}</strong><em>${escapeHtml(detail)}</em></span></label>`;
  }).join("");
}

function renderMaterialPreview(preview) {
  if (!preview?.content?.materials) return '<div class="material-preview-empty">Save a selection, then preview the exact data before authorizing.</div>';
  const materials = preview.content.materials;
  const applicant = Object.entries(materials.applicant || {});
  return `
    <div class="material-preview-grid">
      <section><span>Applicant fields</span><strong>${applicant.length}</strong><p>${escapeHtml(applicant.map(([field]) => applicantFieldLabels[field] || field).join(" · ") || "None selected")}</p></section>
      <section><span>Education records</span><strong>${materials.education?.length || 0}</strong><p>${escapeHtml((materials.education || []).map((record) => record.institutionName).join(" · ") || "None selected")}</p></section>
      <section><span>Exam records</span><strong>${materials.assessments?.length || 0}</strong><p>${escapeHtml((materials.assessments || []).map((record) => record.assessmentName).join(" · ") || "None selected")}</p></section>
    </div>
    <p class="material-digest">Preview fingerprint <code>${escapeHtml(preview.contentSha256)}</code></p>`;
}

function renderMaterialNotice(state) {
  const notice = state.notice;
  if (!notice?.document) return '<div class="material-notice unavailable"><strong>Disclosure notice unavailable</strong><span>Authorization stays disabled until a current published notice can be read.</span></div>';
  const sections = notice.document.sections || [];
  const visible = sections.filter((section) => ["purpose", "data_categories", "recipients", "retention", "rights"].includes(section.key));
  return `<details class="material-notice" open><summary><span>${escapeHtml(notice.document.title)}</span><em>Version ${escapeHtml(notice.version)} · review before authorizing</em></summary><div>${visible.map((section) => `<section><strong>${escapeHtml(section.heading)}</strong><p>${escapeHtml(section.body)}</p></section>`).join("")}</div></details>`;
}

function renderMaterialEnvelopeWorkspace() {
  const workspace = document.querySelector("[data-material-envelope-workspace]");
  if (!workspace) return;
  const choice = applicationChoices().find((item) => item.id === currentMaterialChoiceId);
  if (!choice) {
    workspace.innerHTML = '<div class="profile-record-empty"><strong>No application choice selected</strong><span>Add a published program and intake before preparing materials.</span></div>';
    renderProfileSectionState();
    return;
  }
  const state = materialChoiceState(choice.id);
  const label = materialChoiceLabel(choice);
  if (state.runtime === "loading") {
    workspace.innerHTML = `<div class="material-target-strip"><span>Preparing envelope</span><strong>${escapeHtml(label.school)}</strong><em>${escapeHtml(label.program)} · ${escapeHtml(label.intake)}</em></div><div class="profile-record-empty"><strong>Loading server evidence</strong><span>Reading material versions, preflight, authorization and snapshot state.</span></div>`;
    return;
  }
  if (state.runtime === "error" && !state.selection) {
    workspace.innerHTML = `<div class="material-target-strip"><span>Envelope unavailable</span><strong>${escapeHtml(label.school)}</strong><em>${escapeHtml(label.program)} · ${escapeHtml(label.intake)}</em></div><div class="canonical-boundary-note"><strong>Server evidence could not be loaded</strong><span>${escapeHtml(state.error)}</span><button class="secondary-action" type="button" data-reload-material-choice>Retry</button></div>`;
    return;
  }
  const saved = state.selection?.selection || { applicantFields: [], educationRecordIds: [], assessmentRecordIds: [] };
  const unavailable = state.selection?.unavailable || { educationRecordIds: [], assessmentRecordIds: [] };
  const changedSources = state.selection?.changedSources || [];
  const preflightIssues = state.preflight?.issues || [];
  const currentAuthorization = state.preflight?.submissionAuthorization?.current === true;
  const currentSnapshot = state.preflight?.materialSnapshot?.current === true;
  const sealed = currentAuthorization && currentSnapshot;
  const policy = state.preflight?.officialSubmissionPolicy;
  const selectionCurrent = changedSources.length === 0 && unavailable.educationRecordIds.length === 0 && unavailable.assessmentRecordIds.length === 0;
  const authorizationBlockingIssues = preflightIssues.filter((issue) => ![
    "REQUIREMENTS_UNAVAILABLE", "REQUIREMENTS_UNASSESSED", "SCHOLARSHIP_UNAVAILABLE",
  ].includes(issue));
  const canAuthorize = state.selection?.revision > 0 && state.preview?.contentSha256 && state.preflight?.notice
    && policy && state.notice?.document && selectionCurrent && authorizationBlockingIssues.length === 0
    && !state.snapshotUnavailable && !sealed;
  workspace.innerHTML = `
    <div class="material-target-strip" data-envelope-status="${sealed ? "sealed" : "draft"}">
      <span>${sealed ? "Current sealed envelope" : "Material envelope draft"}</span>
      <strong>${escapeHtml(label.school)}</strong>
      <em>${escapeHtml(label.program)} · ${escapeHtml(label.intake)}</em>
      <b>${sealed ? "Authorized and sealed" : state.selection?.revision > 0 ? `Selection revision ${state.selection.revision}` : "Not saved"}</b>
    </div>
    ${changedSources.length ? `<div class="canonical-boundary-note"><strong>Selected source data changed</strong><span>Review and save this envelope again. Changed versions: ${escapeHtml(changedSources.join(", "))}.</span></div>` : ""}
    <div class="material-selection-layout">
      <section class="material-selection-group">
        <div class="record-entry-head"><strong>Applicant fields</strong><span>Select only what this school needs</span></div>
        ${Object.entries(applicantFieldLabels).map(([field, fieldLabel]) => {
          const value = applicantProfileRecord?.[field];
          return `<label class="material-selection-row"><input type="checkbox" data-material-applicant-field value="${field}" ${saved.applicantFields.includes(field) ? "checked" : ""} ${value ? "" : "disabled"}/><span><strong>${escapeHtml(fieldLabel)}</strong><em>${escapeHtml(value || "Not saved")}</em></span></label>`;
        }).join("")}
      </section>
      <section class="material-selection-group">
        <div class="record-entry-head"><strong>Education history</strong><span>${educationHistoryRecord.records.length} available</span></div>
        ${materialRecordOptions(educationHistoryRecord.records, saved.educationRecordIds, "education")}
      </section>
      <section class="material-selection-group">
        <div class="record-entry-head"><strong>Exams & tests</strong><span>${assessmentHistoryRecord.records.length} available</span></div>
        ${materialRecordOptions(assessmentHistoryRecord.records, saved.assessmentRecordIds, "assessment")}
      </section>
    </div>
    <div class="material-action-bar">
      <button class="primary-action" type="button" data-save-material-selection>Save selection</button>
      <button class="secondary-action" type="button" data-preview-material-selection ${state.selection?.revision > 0 ? "" : "disabled"}>Preview selected data</button>
      <span>Saving or previewing does not authorize disclosure.</span>
    </div>
    <section class="material-preview-panel">
      <div class="record-entry-head"><strong>Exact material preview</strong><span>${state.preview ? "Generated from current server versions" : "Not yet generated"}</span></div>
      ${renderMaterialPreview(state.preview)}
    </section>
    <section class="material-preflight-panel">
      <div class="record-entry-head"><strong>Submission preflight</strong><span>${escapeHtml(state.preflight?.checkedAt ? `Checked ${new Date(state.preflight.checkedAt).toLocaleString()}` : "Not checked")}</span></div>
      <div class="material-evidence-grid">
        <span data-evidence-current="${currentAuthorization}"><b>Authorization</b><em>${currentAuthorization ? "Current" : "Required"}</em></span>
        <span data-evidence-current="${currentSnapshot}"><b>Snapshot</b><em>${currentSnapshot ? "Current" : state.snapshotUnavailable ? "Service unavailable" : "Required"}</em></span>
        <span data-evidence-current="${Boolean(policy)}"><b>Delivery policy</b><em>${policy ? `v${policy.version}` : "Unavailable"}</em></span>
        <span data-evidence-current="${state.preflight?.target?.window?.status === "open"}"><b>Application window</b><em>${escapeHtml(state.preflight?.target?.window?.status || "Unknown")}</em></span>
      </div>
      ${preflightIssues.length ? `<div class="material-issue-list">${preflightIssues.map((issue) => `<span>${escapeHtml(preflightIssueLabel(issue))}</span>`).join("")}</div>` : ""}
    </section>
    ${renderMaterialNotice(state)}
    <div class="material-authorization-actions">
      <button class="primary-action" type="button" data-authorize-material-selection ${canAuthorize ? "" : "disabled"}>Authorize sharing and seal snapshot</button>
      ${state.authorization?.status === "active" ? '<button class="secondary-action danger-action" type="button" data-withdraw-material-authorization>Withdraw authorization</button>' : ""}
      <button class="secondary-action" type="button" data-reload-material-choice>Refresh evidence</button>
      <p>${sealed ? "The immutable snapshot matches the current selection, source versions, notice and policy." : "Authorization is an authenticated explicit action for this recipient only. Change any selected source and the evidence becomes stale."}</p>
    </div>`;
  renderMaterialChoiceTabs();
  renderProfileSectionState();
}

async function loadChoicePreparation(choiceId = currentMaterialChoiceId, { force = false } = {}) {
  if (!choiceId || !currentApplicationSet?.id) {
    renderMaterialEnvelopeWorkspace();
    return;
  }
  const state = materialChoiceState(choiceId);
  if (!force && state.runtime === "ready") {
    renderMaterialEnvelopeWorkspace();
    return;
  }
  state.runtime = "loading";
  state.error = "";
  renderMaterialChoiceTabs();
  renderMaterialEnvelopeWorkspace();
  try {
    const [selection, preflight] = await Promise.all([
      applicationApi(materialChoicePath(choiceId, "material-selection")),
      applicationApi(`${materialChoicePath(choiceId, "preflight")}?locale=en`),
    ]);
    const [authorizationResult, snapshotResult] = await Promise.all([
      applicationApi(materialChoicePath(choiceId, "submission-authorization")).then((data) => ({ data })).catch((error) => ({ error })),
      applicationApi(materialChoicePath(choiceId, "material-snapshot")).then((data) => ({ data })).catch((error) => ({ error })),
    ]);
    state.selection = selection;
    state.preflight = preflight;
    state.authorization = authorizationResult.data || null;
    state.snapshot = snapshotResult.data || null;
    state.snapshotUnavailable = Boolean(snapshotResult.error);
    state.notice = preflight?.notice
      ? await applicationApi(`/api/v1/notices/application_disclosure/${encodeURIComponent(preflight.notice.locale)}`).catch(() => null)
      : null;
    state.runtime = "ready";
    if (state.preview && !materialSelectionsEqual(state.preview.content?.selection, selection?.selection)) state.preview = null;
  } catch (error) {
    state.runtime = "error";
    state.error = error.message;
  }
  renderMaterialChoiceTabs();
  renderMaterialEnvelopeWorkspace();
}

async function saveMaterialSelection(button) {
  const state = materialChoiceState(currentMaterialChoiceId);
  if (!state.selection) return;
  button.disabled = true;
  setProfileOperationStatus("authorization", "Saving this choice-specific material selection...", "pending");
  try {
    state.selection = await applicationApi(materialChoicePath(currentMaterialChoiceId, "material-selection"), {
      method: "PUT",
      body: { expectedRevision: state.selection.revision, expectedVersions: state.selection.currentVersions, selection: materialSelectionFromWorkspace() },
    });
    state.preview = null;
    state.preflight = await applicationApi(`${materialChoicePath(currentMaterialChoiceId, "preflight")}?locale=en`);
    state.notice = state.preflight?.notice
      ? await applicationApi(`/api/v1/notices/application_disclosure/${encodeURIComponent(state.preflight.notice.locale)}`).catch(() => null)
      : null;
    setProfileOperationStatus("authorization", "Material selection saved. No disclosure has been authorized.", "success");
  } catch (error) {
    setProfileOperationStatus("authorization", `Material selection was not saved: ${error.status === 409 ? "Source versions changed. Refresh and review again." : error.message}`, "error");
  }
  renderMaterialEnvelopeWorkspace();
}

async function previewMaterialSelection(button) {
  const state = materialChoiceState(currentMaterialChoiceId);
  const selected = materialSelectionFromWorkspace();
  if (!state.selection?.selection || !materialSelectionsEqual(selected, state.selection.selection)) {
    setProfileOperationStatus("authorization", "Save the current selection before generating its exact preview.", "error");
    return;
  }
  button.disabled = true;
  setProfileOperationStatus("authorization", "Generating a non-persisted preview from current server records...", "pending");
  try {
    state.preview = await applicationApi(materialChoicePath(currentMaterialChoiceId, "material-preview"), {
      method: "POST",
      body: { expectedVersions: state.selection.currentVersions, selection: state.selection.selection },
    });
    setProfileOperationStatus("authorization", "Preview generated. Review the exact fields and disclosure notice before authorizing.", "success");
  } catch (error) {
    state.preview = null;
    setProfileOperationStatus("authorization", `Preview could not be generated: ${error.message}`, "error");
  }
  renderMaterialEnvelopeWorkspace();
}

async function authorizeMaterialSelection(button) {
  const state = materialChoiceState(currentMaterialChoiceId);
  if (!materialSelectionsEqual(materialSelectionFromWorkspace(), state.selection?.selection)) {
    setProfileOperationStatus("authorization", "Save and preview the visible material selection before authorizing it.", "error");
    return;
  }
  button.disabled = true;
  setProfileOperationStatus("authorization", "Rechecking the exact target, versions, notice and delivery policy...", "pending");
  try {
    const selection = await applicationApi(materialChoicePath(currentMaterialChoiceId, "material-selection"));
    if (selection.revision !== state.selection?.revision
      || !materialSelectionsEqual(selection.currentVersions, state.selection?.currentVersions)
      || !materialSelectionsEqual(selection.selection, state.selection?.selection)) {
      state.selection = selection;
      state.preview = null;
      throw new Error("The saved material selection or one of its source versions changed. Refresh and review it again.");
    }
    const preview = await applicationApi(materialChoicePath(currentMaterialChoiceId, "material-preview"), {
      method: "POST",
      body: { expectedVersions: selection.currentVersions, selection: selection.selection },
    });
    if (preview.contentSha256 !== state.preview?.contentSha256) {
      state.preview = preview;
      throw new Error("The exact material preview changed. Review the updated preview before authorizing it.");
    }
    const preflight = await applicationApi(`${materialChoicePath(currentMaterialChoiceId, "preflight")}?locale=en`);
    const notice = preflight?.notice
      ? await applicationApi(`/api/v1/notices/application_disclosure/${encodeURIComponent(preflight.notice.locale)}`)
      : null;
    const policy = preflight?.officialSubmissionPolicy;
    if (!notice || !policy) throw new Error("A current disclosure notice and official submission policy are required.");
    const priorNotice = state.preflight?.notice;
    const priorPolicy = state.preflight?.officialSubmissionPolicy;
    if (!priorNotice || !priorPolicy
      || notice.versionId !== priorNotice.versionId
      || notice.publicationRevision !== priorNotice.publicationRevision
      || notice.contentSha256 !== priorNotice.contentSha256
      || policy.versionId !== priorPolicy.versionId
      || policy.publicationRevision !== priorPolicy.publicationRevision
      || policy.documentSha256 !== priorPolicy.documentSha256
      || policy.admissionRouteKey !== priorPolicy.admissionRouteKey) {
      state.preflight = preflight;
      state.notice = notice;
      throw new Error("The disclosure notice or official delivery policy changed. Review the current evidence before authorizing it.");
    }
    const authorization = await applicationApi(materialChoicePath(currentMaterialChoiceId, "submission-authorization"), {
      method: "POST",
      headers: { "Idempotency-Key": applicationIdempotencyKey("application_authorization") },
      body: {
        locale: notice.locale,
        expectedMaterialSelectionRevision: selection.revision,
        expectedVersions: selection.currentVersions,
        expectedNotice: { versionId: preflight.notice.versionId, publicationRevision: preflight.notice.publicationRevision, contentSha256: preflight.notice.contentSha256 },
        expectedPolicy: { admissionRouteKey: policy.admissionRouteKey, versionId: policy.versionId, publicationRevision: policy.publicationRevision, documentSha256: policy.documentSha256 },
        materialContentSha256: preview.contentSha256,
        confirmation: "share_selected_application_materials_with_target_school",
      },
    });
    const snapshot = await applicationApi(materialChoicePath(currentMaterialChoiceId, "material-snapshot"), {
      method: "POST",
      headers: { "Idempotency-Key": applicationIdempotencyKey("application_material_snapshot") },
      body: {
        authorizationId: authorization.id,
        expectedAuthorizationScopeSha256: authorization.confirmation.scopeSha256,
        expectedMaterialContentSha256: preview.contentSha256,
      },
    });
    state.selection = selection;
    state.preview = preview;
    state.preflight = await applicationApi(`${materialChoicePath(currentMaterialChoiceId, "preflight")}?locale=en`);
    state.notice = notice;
    state.authorization = authorization;
    state.snapshot = snapshot;
    state.snapshotUnavailable = false;
    setProfileOperationStatus("authorization", "Sharing authorized and an immutable material snapshot was sealed for this exact choice.", "success");
  } catch (error) {
    setProfileOperationStatus("authorization", `Authorization was not completed: ${error.status === 409 ? "A bound version changed. Refresh and review again." : error.message}`, "error");
  }
  renderMaterialEnvelopeWorkspace();
  updateProgress();
  renderApplicationGate();
}

async function withdrawMaterialAuthorization(button) {
  const state = materialChoiceState(currentMaterialChoiceId);
  if (!state.authorization?.id || !window.confirm("Withdraw this choice-specific sharing authorization? The sealed evidence will no longer be current.")) return;
  button.disabled = true;
  try {
    state.authorization = await applicationApi(materialChoicePath(currentMaterialChoiceId, "submission-authorization"), {
      method: "DELETE",
      body: { authorizationId: state.authorization.id },
    });
    state.preflight = await applicationApi(`${materialChoicePath(currentMaterialChoiceId, "preflight")}?locale=en`);
    setProfileOperationStatus("authorization", "Authorization withdrawn for this choice.", "success");
  } catch (error) {
    setProfileOperationStatus("authorization", `Authorization was not withdrawn: ${error.message}`, "error");
  }
  renderMaterialEnvelopeWorkspace();
  updateProgress();
}

function isProfileSectionComplete(section) {
  section = normalizeProfileSection(section);
  if (studentRecordsRuntimeState !== "ready") return false;
  if (section === "applicant") return isApplicantRecordReady();
  if (section === "education") return educationHistoryRecord.records.length > 0;
  if (section === "assessments") return true;
  if (section === "files") return studentFilesRuntimeState === "ready";
  if (section === "authorization") return isSubmissionAuthorizationReady();
  return false;
}

function normalizeProfileSection(section = "") {
  return profileSectionRouteAliases[section] || section;
}

function renderProfileSectionState() {
  document.querySelectorAll("[data-profile-section-target]").forEach((item) => {
    const section = normalizeProfileSection(item.dataset.profileSectionTarget);
    const complete = isProfileSectionComplete(section);
    const unsaved = profileSectionSaveState[section] === false;
    item.classList.toggle("active", section === currentProfileSection);
    item.classList.toggle("done", complete);
    item.classList.toggle("missing", !complete);
    item.classList.toggle("unsaved", unsaved);
    item.setAttribute("aria-current", section === currentProfileSection ? "step" : "false");
  });
  document.querySelectorAll("[data-profile-section-status]").forEach((status) => {
    const section = normalizeProfileSection(status.dataset.profileSectionStatus);
    const complete = isProfileSectionComplete(section);
    const unsaved = profileSectionSaveState[section] === false;
    const cleanFiles = studentFileRecords.filter((file) => file.status === "clean").length;
    const totalChoices = applicationChoices().length;
    const sealedChoices = applicationChoices().filter((choice) => {
      const preflight = materialChoiceStates.get(choice.id)?.preflight;
      return preflight?.submissionAuthorization?.current && preflight?.materialSnapshot?.current;
    }).length;
    status.textContent = unsaved
      ? "Unsaved"
      : section === "assessments" && assessmentHistoryRecord.records.length === 0
        ? "Optional"
        : section === "files"
          ? studentFilesRuntimeState === "loading"
            ? "Loading"
            : studentFilesRuntimeState === "unavailable"
              ? "Unavailable"
              : cleanFiles
                ? `${cleanFiles} clean`
                : "No files"
          : section === "authorization"
            ? !totalChoices
              ? "Add choice"
              : sealedChoices === totalChoices
                ? "Ready"
                : `${sealedChoices}/${totalChoices} sealed`
            : complete
              ? "Ready"
              : studentRecordsRuntimeState === "loading"
                ? "Loading"
                : "Missing";
  });
}

function updateProfileSaveStatus(section = currentProfileSection) {
  section = normalizeProfileSection(section);
  const saved = profileSectionSaveState[section] !== false;
  const status = document.querySelector("[data-profile-save-status]");
  const button = document.querySelector("[data-save-profile-section]");
  const saveGroup = document.querySelector(".profile-save-group");
  if (saveGroup) saveGroup.hidden = section !== "applicant" || saved;
  if (status) {
    status.textContent = saved ? "Saved" : "Unsaved changes";
    status.classList.toggle("saved", saved);
    status.classList.toggle("unsaved", !saved);
  }
  if (button) button.textContent = "Save changes";
}

function markProfileSectionDirty(section = currentProfileSection) {
  section = normalizeProfileSection(section);
  if (section !== "applicant") return;
  profileSectionSaveState[section] = false;
  renderProfileSectionState();
  if (section === currentProfileSection) updateProfileSaveStatus(section);
}

async function saveProfileSection(section = currentProfileSection) {
  section = normalizeProfileSection(section);
  if (section === "applicant") await saveApplicantProfile();
}

function setProfileSection(section, { focus = false, openEditor = true } = {}) {
  section = normalizeProfileSection(section);
  if (!profileSections.includes(section)) return;
  currentProfileSection = section;
  const form = document.querySelector("[data-student-info-form]");
  const editor = document.querySelector("[data-profile-editor]");
  form?.classList.toggle("editing", openEditor);
  editor?.toggleAttribute("hidden", !openEditor);
  document.querySelectorAll("[data-profile-section]").forEach((panel) => {
    const active = panel.dataset.profileSection === section;
    panel.classList.toggle("active", active);
    panel.toggleAttribute("hidden", !active);
  });
  renderProfileSectionState();
  updateProfileSaveStatus(section);
  if (section === "files") void loadStudentFiles();
  if (section === "authorization") {
    renderMaterialChoiceTabs();
    void loadChoicePreparation();
  }
  if (focus && openEditor) document.querySelector(`[data-profile-section="${section}"] input, [data-profile-section="${section}"] select, [data-profile-section="${section}"] textarea`)?.focus();
}

function profileSectionFromHash(hash = location.hash) {
  if (!hash.startsWith(profileRoutePrefix)) return "";
  const section = normalizeProfileSection(hash.slice(profileRoutePrefix.length));
  return profileSections.includes(section) ? section : "";
}

function updateProfileDetailHeader(section) {
  const label = profileSectionLabels[section] || "Student info";
  const title = document.querySelector("[data-profile-detail-title]");
  const subtitle = document.querySelector("[data-profile-detail-subtitle]");
  if (title) title.textContent = label;
  if (subtitle) subtitle.textContent = currentApplicationSet?.targetIntake || currentApplicationSet?.name || "Current application";
}

function closeProfileDetailMode() {
  document.querySelector(".application-page")?.classList.remove("profile-detail-mode");
  document.querySelector("[data-profile-detail-hero]")?.setAttribute("hidden", "");
  document.querySelector("[data-student-info-form]")?.classList.remove("editing");
  document.querySelector("[data-profile-editor]")?.setAttribute("hidden", "");
}

function openProfileDetail(section, { focus = false, replace = false, scroll = true } = {}) {
  section = normalizeProfileSection(section);
  if (!profileSections.includes(section)) return;
  if (!canOpenApplicationStage("info")) {
    setApplicationStage("choices", { scroll: true });
    showSubmitBlockers("Review the student information before sending.");
    return;
  }
  setApplicationStage("info");
  updateProfileDetailHeader(section);
  document.querySelector(".application-page")?.classList.add("profile-detail-mode");
  document.querySelector("[data-profile-detail-hero]")?.removeAttribute("hidden");
  setProfileSection(section, { focus, openEditor: true });
  const targetHash = `${profileRoutePrefix}${section}`;
  if (location.hash !== targetHash) {
    history[replace ? "replaceState" : "pushState"](null, "", targetHash);
  }
  if (scroll) document.querySelector("[data-profile-detail-hero]")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showProfileOverview({ updateHash = true, replace = false, scroll = false } = {}) {
  closeProfileDetailMode();
  if (canOpenApplicationStage("info")) setApplicationStage("info");
  renderProfileSectionState();
  if (updateHash && location.hash !== "#info") {
    history[replace ? "replaceState" : "pushState"](null, "", "#info");
  }
  if (scroll) document.getElementById("info")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stepProfileSection(direction = 1) {
  const index = Math.max(0, profileSections.indexOf(currentProfileSection));
  const nextIndex = index + direction;
  if (nextIndex < 0) {
    showProfileOverview({ scroll: true });
    return;
  }
  if (nextIndex >= profileSections.length) {
    showProfileOverview({ updateHash: true, replace: true });
    setApplicationStage("fee", { scroll: true });
    return;
  }
  openProfileDetail(profileSections[nextIndex], { focus: true, replace: true, scroll: false });
}

function isApplicantRecordReady(profile = applicantProfileRecord) {
  return Boolean(profile?.revision > 0 && profile.fullName && profile.contactEmail && profile.citizenshipCountry);
}

function isStudentProfileReady() {
  return studentRecordsRuntimeState === "ready" && isApplicantRecordReady() && educationHistoryRecord.records.length > 0;
}

function isSubmissionAuthorizationReady() {
  const choices = applicationChoices();
  return choices.length > 0 && choices.every((choice) => {
    const preflight = materialChoiceStates.get(choice.id)?.preflight;
    return preflight?.submissionAuthorization?.current === true && preflight?.materialSnapshot?.current === true;
  });
}

function renderStudentInfoStatus() {
  const ready = isStudentProfileReady();
  const status = document.querySelector("[data-info-status]");
  const requiredSections = ["applicant", "education"];
  const readySections = requiredSections.filter((section) => isProfileSectionComplete(section)).length;
  if (status) status.textContent = ready ? "Basic record ready" : `${readySections}/${requiredSections.length} required records ready`;
  renderProfileSectionState();
  return ready;
}

function getSubmitBlockers() {
  const hasChoices = choiceCount > 0;
  return [
    {
      key: "choices",
      target: "choices",
      label: "add at least one university and program choice",
      complete: hasChoices,
    },
    {
      key: "order",
      target: "choices",
      label: "confirm the choice order",
      complete: hasChoices && orderConfirmed,
    },
    {
      key: "student-info",
      target: "info",
      label: "save applicant details and at least one education record",
      complete: isStudentProfileReady(),
    },
    {
      key: "application-preparation",
      target: "info",
      label: "complete server material selection, preflight and per-choice authorization",
      complete: isSubmissionAuthorizationReady(),
    },
  ].filter((item) => !item.complete);
}

function renderApplicationGate(blockers = getSubmitBlockers(), { force = false, message = "Final submit is locked until the required sections are complete." } = {}) {
  const gate = document.querySelector("[data-application-gate]");
  if (!gate) return;
  if (!blockers.length) {
    gate.hidden = true;
    gate.innerHTML = "";
    return;
  }
  if (!force && gate.hidden) return;
  gate.hidden = false;
  gate.innerHTML = `
    <strong>${escapeHtml(message)}</strong>
    <span>Finish: ${blockers.map((item) => escapeHtml(item.label)).join(" · ")}</span>
  `;
}

function showSubmitBlockers(message = "Complete all required sections before final submit.") {
  const blockers = getSubmitBlockers();
  if (!blockers.length) return true;
  renderApplicationGate(blockers, { force: true, message });
  showPageAction(`${message} ${blockers.map((item) => item.label).join(" / ")}.`);
  return false;
}

function canReviewAndSubmit() {
  return getSubmitBlockers().length === 0;
}

async function addChoice(form) {
  const list = document.querySelector("[data-choice-list]");
  const selected = getSelectedProgram();
  if (!list || !selected) return;
  if (applicationRuntimeState !== "ready") {
    showPageAction("Wait for your server-backed application data to finish loading before adding a choice.");
    return;
  }
  if (!selected.schoolId || !selected.programId || !selected.programIntakeId) {
    showPageAction("Choose a published university, program, and intake before adding this choice.");
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (!currentApplicationSet?.id) {
      currentApplicationSet = await applicationApi("/api/v1/student/application-sets", {
        method: "POST",
        headers: { "Idempotency-Key": applicationIdempotencyKey("application_set_create") },
        body: { name: `${selected.intake} application`, targetIntake: selected.intake },
      });
    }
    await applicationApi(`/api/v1/student/application-sets/${encodeURIComponent(currentApplicationSet.id)}/choices`, {
      method: "POST",
      headers: { "Idempotency-Key": applicationIdempotencyKey("application_choice_add") },
      body: {
        schoolId: selected.schoolId,
        programId: selected.programId,
        programIntakeId: selected.programIntakeId,
        rankOrder: choiceCount,
        studentNotes: getFieldValue(form, "choiceNote", "").trim() || null,
      },
    });
    invalidateBillingState();
    await refreshCurrentApplicationSet();
    void loadBillingFeePreview();
    const feeInfo = getFeeInfo();
    showPageAction(`${selected.university} ${selected.program} added. ${feeInfo.schoolCount} school${feeInfo.schoolCount === 1 ? "" : "s"} selected. The server fee quote is refreshing; confirm order before continuing.`);
    form.elements.choiceNote.value = "";
    setChoiceModal(false);
  } catch (error) {
    showPageAction(`Choice was not added: ${error.message}`);
  } finally {
    if (submit) submit.disabled = false;
  }
}

function appendChoiceRoute(route = {}, options = {}) {
  const list = document.querySelector("[data-choice-list]");
  if (!list) return null;
  const selected = {
    choiceId: route.choiceId || "",
    schoolId: route.schoolId || "",
    programId: route.programId || "",
    programIntakeId: route.programIntakeId || "",
    rankOrder: route.rankOrder ?? nextChoiceId,
    university: route.university || route.school || "School to confirm",
    program: route.program || route.title || "Selected program",
    programName: route.programName || splitProgramLevel(route.program || route.title).name,
    degree: route.degree || route.degreeLevel || splitProgramLevel(route.program || route.title).level,
    city: route.city || "",
    intake: route.intake || "Intake pending",
    language: route.language || route.teachingLanguage || "Teaching language pending",
    tuition: route.tuition || route.tuitionText || "Tuition pending",
    deadline: route.deadline || route.deadlineLabel || "Deadline pending",
    signal: route.signal || route.routeRole || "Route fit",
    choiceNote: route.choiceNote || "",
    durationYears: route.durationYears || "",
    fieldCategory: route.fieldCategory || "",
    cscaSubjects: appProgramList(route.cscaSubjects),
    cscaRequirement: route.cscaRequirement || "",
    hskRequirement: route.hskRequirement || "",
    englishRequirement: route.englishRequirement || "",
    applicationRound: route.applicationRound || route.intake || "",
    applicationUrl: route.applicationUrl || route.sourceUrl || "",
    applicationNote: route.applicationNote || "",
    sourceLabel: route.sourceLabel || "",
  };
  const { choiceId, schoolId, programId, programIntakeId, rankOrder, university, program, programName, degree, city, tuition, deadline, signal } = selected;
  const { intake, language, choiceNote, durationYears, fieldCategory, cscaSubjects, cscaRequirement, hskRequirement, englishRequirement, applicationRound, applicationUrl, applicationNote, sourceLabel } = selected;
  const index = nextChoiceId++;
  const safeChoiceId = escapeHtml(choiceId);
  const safeSchoolId = escapeHtml(schoolId);
  const safeProgramId = escapeHtml(programId);
  const safeProgramIntakeId = escapeHtml(programIntakeId);
  const safeRankOrder = escapeHtml(rankOrder);
  const safeUniversity = escapeHtml(university);
  const safeProgram = escapeHtml(program);
  const safeProgramName = escapeHtml(programName);
  const safeDegree = escapeHtml(degree);
  const safeCity = escapeHtml(city);
  const safeIntake = escapeHtml(intake);
  const safeLanguage = escapeHtml(language);
  const safeTuition = escapeHtml(tuition);
  const safeDeadline = escapeHtml(deadline);
  const safeSignal = escapeHtml(signal);
  const safeChoiceNote = escapeHtml(choiceNote);
  const safeDurationYears = escapeHtml(durationYears);
  const safeFieldCategory = escapeHtml(fieldCategory);
  const safeCscaSubjects = escapeHtml(cscaSubjects);
  const safeCscaRequirement = escapeHtml(cscaRequirement);
  const safeHskRequirement = escapeHtml(hskRequirement);
  const safeEnglishRequirement = escapeHtml(englishRequirement);
  const safeApplicationRound = escapeHtml(applicationRound);
  const safeApplicationUrl = escapeHtml(applicationUrl);
  const safeApplicationNote = escapeHtml(applicationNote);
  const safeSourceLabel = escapeHtml(sourceLabel);
  list.insertAdjacentHTML(
    "beforeend",
    `
      <article class="choice-route backup" data-choice="${index}" data-choice-id="${safeChoiceId}" data-school-id="${safeSchoolId}" data-program-id="${safeProgramId}" data-program-intake-id="${safeProgramIntakeId}" data-rank-order="${safeRankOrder}" data-school="${safeUniversity}" data-program="${safeProgram}" data-program-name="${safeProgramName}" data-degree="${safeDegree}" data-city="${safeCity}" data-intake="${safeIntake}" data-language="${safeLanguage}" data-tuition="${safeTuition}" data-deadline="${safeDeadline}" data-signal="${safeSignal}" data-choice-note="${safeChoiceNote}" data-duration-years="${safeDurationYears}" data-field-category="${safeFieldCategory}" data-csca-subjects="${safeCscaSubjects}" data-csca-requirement="${safeCscaRequirement}" data-hsk-requirement="${safeHskRequirement}" data-english-requirement="${safeEnglishRequirement}" data-application-round="${safeApplicationRound}" data-application-url="${safeApplicationUrl}" data-application-note="${safeApplicationNote}" data-source-label="${safeSourceLabel}">
        <div class="choice-topline">
          <span class="role-pill">To check</span>
          <div class="choice-route-actions">
            <button type="button" data-remove-choice aria-label="Remove ${safeUniversity} ${safeProgram}">Remove</button>
          </div>
        </div>
        <div>
          <h3>${safeUniversity}</h3>
          <p>${safeProgram} · ${safeCity} · ${safeIntake} · ${safeLanguage}</p>
        </div>
        <div class="choice-route-meta">
          <span>${safeDeadline}</span>
          <span>${safeTuition}</span>
          <span>${safeSignal}</span>
          <span>Review before send</span>
        </div>
        ${safeChoiceNote ? `<p class="choice-school-note"><strong>School note</strong> ${safeChoiceNote}</p>` : ""}
      </article>
    `,
  );
  if (!options.hydrating) {
    updateChoiceLabels();
    resetChoiceConfirmationAfterChange();
    updateSubmissionSummary();
  }
  return list.querySelector(`[data-choice="${index}"]`);
}

async function removeChoice(button) {
  const card = button.closest("[data-choice]");
  if (!card) return;
  const university = card.dataset.school || card.querySelector("h3")?.textContent.trim() || "Selected school";
  const program = card.dataset.program || "selected program";
  if (submittedToSchools) {
    showPageAction("This application set has already been sent. To remove a school after sending, use a withdrawal or school-contact workflow.");
    return;
  }
  const choiceId = card.dataset.choiceId;
  if (applicationRuntimeState !== "ready" || !currentApplicationSet?.id || !choiceId) {
    showPageAction("This choice is not connected to a current server application record.");
    return;
  }
  button.disabled = true;
  try {
    await applicationApi(`/api/v1/student/application-sets/${encodeURIComponent(currentApplicationSet.id)}/choices/${encodeURIComponent(choiceId)}`, {
      method: "DELETE",
    });
    invalidateBillingState();
    await refreshCurrentApplicationSet();
    resetChoiceConfirmationAfterChange();
    void loadBillingFeePreview();
    const feeInfo = getFeeInfo();
    showPageAction(`${university} ${program} removed. ${feeInfo.schoolCount} school${feeInfo.schoolCount === 1 ? "" : "s"} selected. The server fee quote is refreshing.`);
  } catch (error) {
    button.disabled = false;
    showPageAction(`Choice was not removed: ${error.message}`);
  }
}

function getChoiceRoutes() {
  return Array.from(document.querySelectorAll("[data-choice]")).map((card) => {
    const university = card.dataset.school || card.querySelector("h3")?.textContent.trim() || "Unknown university";
    const parts = (card.querySelector("p")?.textContent || "").split("·").map((part) => part.trim());
    const meta = Array.from(card.querySelectorAll(".choice-route-meta span")).map((item) => item.textContent.trim());
    const program = card.dataset.program || parts[0] || "Selected program";
    const programLevel = splitProgramLevel(program);
    return {
      choiceId: card.dataset.choiceId || "",
      schoolId: card.dataset.schoolId || "",
      programId: card.dataset.programId || "",
      programIntakeId: card.dataset.programIntakeId || "",
      rankOrder: Number(card.dataset.rankOrder || 0),
      university,
      program,
      programName: card.dataset.programName || programLevel.name,
      degree: card.dataset.degree || programLevel.level,
      city: card.dataset.city || parts[1] || "",
      intake: card.dataset.intake || parts[2] || "Intake pending",
      language: card.dataset.language || parts.at(-1) || "",
      tuition: card.dataset.tuition || meta[1] || "",
      deadline: card.dataset.deadline || meta[0] || "",
      signal: card.dataset.signal || meta[3] || meta[2] || "Route fit",
      choiceNote: card.dataset.choiceNote || "",
      durationYears: card.dataset.durationYears || "",
      fieldCategory: card.dataset.fieldCategory || "",
      cscaSubjects: card.dataset.cscaSubjects || "",
      cscaRequirement: card.dataset.cscaRequirement || "",
      hskRequirement: card.dataset.hskRequirement || "",
      englishRequirement: card.dataset.englishRequirement || "",
      applicationRound: card.dataset.applicationRound || "",
      applicationUrl: card.dataset.applicationUrl || "",
      applicationNote: card.dataset.applicationNote || "",
      sourceLabel: card.dataset.sourceLabel || "",
    };
  });
}

function currentApplicationChoiceIds() {
  return applicationChoices().map((choice) => choice.id).filter(Boolean).sort();
}

function clearCheckoutReturnHint() {
  const url = new URL(location.href);
  url.searchParams.delete("checkout");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function billingScopeSignature() {
  return JSON.stringify({ applicationSetId: currentApplicationSet?.id || "", applicationChoiceIds: currentApplicationChoiceIds() });
}

function clearPendingInvoiceLocator() {
  try {
    sessionStorage.removeItem(PENDING_INVOICE_SESSION_KEY);
  } catch {
    // Session storage may be unavailable in private preview contexts.
  }
}

function readPendingInvoiceLocator() {
  try {
    const locator = JSON.parse(sessionStorage.getItem(PENDING_INVOICE_SESSION_KEY) || "null");
    const sameChoices = JSON.stringify(locator?.applicationChoiceIds || []) === JSON.stringify(currentApplicationChoiceIds());
    if (!locator || locator.applicationSetId !== currentApplicationSet?.id || typeof locator.invoiceId !== "string" || !sameChoices) return null;
    return locator;
  } catch {
    return null;
  }
}

function savePendingInvoiceLocator(intent) {
  try {
    sessionStorage.setItem(PENDING_INVOICE_SESSION_KEY, JSON.stringify({
      applicationSetId: currentApplicationSet.id,
      applicationChoiceIds: currentApplicationChoiceIds(),
      invoiceId: intent.invoiceId,
    }));
  } catch {
    // The server invoice remains authoritative even when a browser locator cannot be stored.
  }
}

function invalidateBillingState({ clearInvoice = true } = {}) {
  billingPreviewRecord = null;
  billingRuntimeState = "idle";
  billingErrorMessage = "";
  checkoutIntentRecord = null;
  checkoutStatusRecord = null;
  if (clearInvoice) clearPendingInvoiceLocator();
}

function getFeeInfo() {
  const routes = getChoiceRoutes();
  const schools = [...new Set(routes.map((route) => route.university))];
  return {
    routes,
    schools,
    schoolCount: schools.length,
    choiceCount: routes.length,
    quote: billingPreviewRecord,
  };
}

function formatMoney(amountMinor, currency) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || typeof currency !== "string") return "Not quoted";
  try {
    const formatter = new Intl.NumberFormat("en", { style: "currency", currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(amountMinor / (10 ** digits));
  } catch {
    return `${currency} ${amountMinor}`;
  }
}

function formatFeeQuote(quote = billingPreviewRecord) {
  return quote ? formatMoney(quote.totalMinor, quote.currency) : "Not quoted";
}

function routeForFeeLine(line, routes) {
  return routes.find((route) => route.choiceId === line.applicationChoiceId)
    || routes.find((route) => route.programId === line.programId && route.programIntakeId === line.programIntakeId)
    || null;
}

function renderFeeLines(feeInfo) {
  if (billingRuntimeState === "loading") return '<div class="profile-record-empty"><strong>Calculating current fee</strong><span>CUAC is pricing the exact saved choices.</span></div>';
  if (!feeInfo.quote) return `<div class="profile-record-empty"><strong>Fee quote unavailable</strong><span>${escapeHtml(billingErrorMessage || "Save at least one application choice to request a quote.")}</span></div>`;
  return feeInfo.quote.lines.map((line) => {
    const route = routeForFeeLine(line, feeInfo.routes);
    return `
      <article class="fee-line">
        <div>
          <strong>${escapeHtml(line.description)}</strong>
          <span>${escapeHtml(route ? `${route.university} · ${route.program} · ${route.intake}` : line.feeCode)}</span>
        </div>
        <em>${escapeHtml(formatMoney(Math.abs(line.amountMinor), line.currency))}${line.amountMinor < 0 ? " credit" : ""}</em>
      </article>
    `;
  }).join("");
}

async function loadBillingFeePreview({ force = false } = {}) {
  const choiceIds = currentApplicationChoiceIds();
  if (!currentApplicationSet?.id || !choiceIds.length || submittedToSchools) return null;
  if (!force && billingRuntimeState === "ready" && billingPreviewRecord) return billingPreviewRecord;
  const scope = billingScopeSignature();
  billingRuntimeState = "loading";
  billingErrorMessage = "";
  updateSubmissionSummary();
  try {
    const quote = await applicationApi("/api/v1/billing/fee-preview", {
      method: "POST",
      body: { applicationSetId: currentApplicationSet.id, applicationChoiceIds: choiceIds },
    });
    if (scope !== billingScopeSignature()) return null;
    if (quote?.applicationSetId !== currentApplicationSet.id || !Array.isArray(quote.lines)
      || !Number.isSafeInteger(quote.totalMinor) || quote.totalMinor < 0 || typeof quote.currency !== "string") {
      throw new Error("The server fee quote was incomplete or did not match this application set.");
    }
    billingPreviewRecord = quote;
    billingRuntimeState = "ready";
    return quote;
  } catch (error) {
    if (scope !== billingScopeSignature()) return null;
    billingPreviewRecord = null;
    billingRuntimeState = "unavailable";
    billingErrorMessage = error.message;
    return null;
  } finally {
    if (scope === billingScopeSignature()) updateSubmissionSummary();
  }
}

function updateSubmissionSummary() {
  const feeInfo = getFeeInfo();
  const submitBlockers = getSubmitBlockers();
  const requiredState = getRequiredStepState();
  document.querySelectorAll("[data-school-count]").forEach((target) => {
    target.textContent = feeInfo.schoolCount;
  });
  document.querySelectorAll("[data-choice-count]").forEach((target) => {
    target.textContent = feeInfo.choiceCount;
  });
  document.querySelectorAll("[data-total-fee]").forEach((target) => {
    target.textContent = formatFeeQuote();
  });
  const quoteStatus = document.querySelector("[data-fee-quote-status]");
  if (quoteStatus) quoteStatus.textContent = billingRuntimeState === "loading"
    ? "Calculating"
    : billingPreviewRecord
      ? `${billingPreviewRecord.lines.length} server-priced line${billingPreviewRecord.lines.length === 1 ? "" : "s"}`
      : billingErrorMessage || "Not quoted";
  const feeStep = document.querySelector("[data-fee-step]");
  if (feeStep) feeStep.textContent = formatFeeQuote();
  const breakdown = document.querySelector("[data-fee-breakdown]");
  if (breakdown) breakdown.innerHTML = renderFeeLines(feeInfo);
  document.querySelectorAll("[data-submit-check]").forEach((item) => {
    const key = item.dataset.submitCheck;
    const complete = key === "choices" ? requiredState.choices.complete : key === "info" ? requiredState.info.complete : key === "consent" ? isSubmissionAuthorizationReady() : false;
    item.classList.toggle("done", complete);
    item.classList.toggle("missing", !complete);
    const status = item.querySelector("em");
    if (!status) return;
    status.textContent = complete ? "Done" : key === "choices" ? "Confirm order" : key === "info" ? "Complete info" : "Authorize each choice";
  });
  document.querySelectorAll("[data-submit-action]").forEach((button) => {
    button.textContent = submittedToSchools ? "View submission status" : billingPreviewRecord ? `Review payment (${formatFeeQuote()})` : "Review payment";
    button.disabled = !submittedToSchools && submitBlockers.length > 0;
    button.title = !submittedToSchools && submitBlockers.length ? `Finish before payment: ${submitBlockers.map((item) => item.label).join(", ")}` : "";
    button.setAttribute("aria-label", submittedToSchools ? "View submitted application status" : "Review the server fee before hosted checkout");
  });
  renderApplicationGate(submitBlockers);
  renderPaymentPage();
  renderSendPanelState();
}

function billingStatusCopy() {
  if (billingRuntimeState === "checkout_creating") return ["Creating secure checkout", "CUAC is requesting a hosted payment session."];
  if (billingRuntimeState === "status_loading") return ["Checking provider status", "Final submission stays locked until the server confirms current billing entitlement."];
  if (checkoutStatusRecord?.status === "succeeded" && isBillingEntitlementReady()) return ["Payment confirmed", "The server confirms payment and current entitlement for every exact choice."];
  if (checkoutStatusRecord?.status === "succeeded") return ["Payment settled", "CUAC is still confirming per-choice billing entitlement. Refresh status before submitting."];
  if (checkoutStatusRecord?.status === "canceled") return ["Checkout canceled", "Nothing was submitted. Your application choices remain saved."];
  if (checkoutStatusRecord?.status === "refunded") return ["Payment refunded", "Billing entitlement is no longer valid and submission remains locked."];
  if (checkoutStatusRecord?.status === "requires_payment") return ["Payment pending", "Complete the hosted checkout, then refresh this server status."];
  if (billingRuntimeState === "unavailable") return ["Checkout unavailable", billingErrorMessage || "Hosted checkout is not configured."];
  return ["Hosted payment required", "CUAC never collects card or bank credentials on this page."];
}

function renderPaymentStatus(feeInfo) {
  const status = document.querySelector("[data-payment-status]");
  if (!status) return;
  const [title, detail] = billingStatusCopy();
  const active = ["checkout_creating", "status_loading"].includes(billingRuntimeState);
  const reference = checkoutStatusRecord?.invoiceId || checkoutIntentRecord?.invoiceId || readPendingInvoiceLocator()?.invoiceId || "";
  const statusLabel = checkoutStatusRecord?.status || checkoutIntentRecord?.status || "not started";
  status.innerHTML = `
    <div class="payment-state ${active ? "processing" : ""}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(formatFeeQuote(feeInfo.quote))}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
    <div class="payment-steps" aria-label="Payment and submission sequence">
      <span class="${feeInfo.quote ? "done" : ""}">1. Server quote</span>
      <span class="${active || checkoutStatusRecord?.status === "requires_payment" ? "active" : isBillingEntitlementReady() ? "done" : ""}">2. Hosted payment</span>
      <span class="${submittedToSchools ? "done" : ""}">3. Atomic submit</span>
    </div>
    ${reference ? `<div class="payment-receipt-strip" aria-label="Invoice reference"><span>Invoice</span><strong>${escapeHtml(reference)}</strong><em>${escapeHtml(statusLabel)}</em></div>` : ""}
  `;
}

function renderPaymentPage() {
  const feeInfo = getFeeInfo();
  const summary = document.querySelector("[data-payment-summary]");
  if (!summary) return;
  summary.innerHTML = `
    <div class="payment-summary-card">
      <h3>${feeInfo.choiceCount} exact choice${feeInfo.choiceCount === 1 ? "" : "s"} across ${feeInfo.schoolCount} school${feeInfo.schoolCount === 1 ? "" : "s"}</h3>
      <p>The server quote is bound to this application set and the complete sorted choice list.</p>
    </div>
    <div class="fee-breakdown">${renderFeeLines(feeInfo)}</div>
    <div class="payment-total"><span>Total due</span><strong>${escapeHtml(formatFeeQuote(feeInfo.quote))}</strong></div>
  `;
  renderPaymentStatus(feeInfo);
  const checkoutButton = document.querySelector("[data-start-checkout]");
  if (checkoutButton) checkoutButton.disabled = billingRuntimeState !== "ready" || !billingPreviewRecord || !canReviewAndSubmit() || submittedToSchools;
  const refreshButton = document.querySelector("[data-refresh-payment]");
  if (refreshButton) refreshButton.disabled = billingRuntimeState === "status_loading" || !(checkoutIntentRecord?.invoiceId || readPendingInvoiceLocator()?.invoiceId);
}

function renderSendPanelState() {
  const status = document.querySelector("[data-submission-status]");
  const review = document.querySelector("[data-send-review]");
  const tracker = document.querySelector("[data-sent-tracker]");
  if (!status || !review || !tracker) return;
  status.removeAttribute("hidden");
  review.hidden = submittedToSchools;
  tracker.hidden = !submittedToSchools;
  renderSubmissionChoiceLists();
  renderSubmissionReceipt();
}

function validateSubmissionConsent() {
  const paymentError = document.querySelector("[data-payment-error]");
  if (isSubmissionAuthorizationReady()) {
    if (paymentError) paymentError.hidden = true;
    return true;
  }
  if (paymentError) {
    paymentError.hidden = false;
    paymentError.textContent = "Create a current material snapshot and authorization for every exact application choice before payment or submission.";
  }
  showPageAction("Per-choice submission authorization is still required.");
  return false;
}

async function createHostedCheckout() {
  if (!canReviewAndSubmit()) {
    const paymentError = document.querySelector("[data-payment-error]");
    if (paymentError) {
      paymentError.hidden = false;
      paymentError.textContent = `Finish first: ${getSubmitBlockers().map((item) => item.label).join(", ")}.`;
    }
    showSubmitBlockers("Finish required sections first.");
    return;
  }
  if (!validateSubmissionConsent()) return;
  const paymentError = document.querySelector("[data-payment-error]");
  billingRuntimeState = "checkout_creating";
  billingErrorMessage = "";
  if (paymentError) paymentError.hidden = true;
  renderPaymentPage();
  try {
    const quote = billingPreviewRecord || await loadBillingFeePreview({ force: true });
    if (!quote) throw new Error(billingErrorMessage || "A current server fee quote is required.");
    const intent = await applicationApi("/api/v1/billing/checkout-intents", {
      method: "POST",
      body: {
        applicationSetId: currentApplicationSet.id,
        applicationChoiceIds: currentApplicationChoiceIds(),
        successReturnPath: "/application.html?checkout=success#payment",
        cancelReturnPath: "/application.html?checkout=cancel#payment",
      },
    });
    const checkoutUrl = new URL(intent.checkoutUrl);
    if (checkoutUrl.protocol !== "https:") throw new Error("The hosted checkout URL was not secure.");
    checkoutIntentRecord = intent;
    checkoutStatusRecord = null;
    billingRuntimeState = "ready";
    savePendingInvoiceLocator(intent);
    location.assign(checkoutUrl.href);
  } catch (error) {
    billingRuntimeState = "unavailable";
    billingErrorMessage = error.message;
    if (paymentError) {
      paymentError.hidden = false;
      paymentError.textContent = `${error.message} Your choices remain saved and nothing has been submitted.`;
    }
    renderPaymentPage();
  }
}

async function refreshAllChoicePreflights() {
  for (const choice of applicationChoices()) await loadChoicePreparation(choice.id, { force: true });
}

async function refreshCheckoutStatus({ silent = false } = {}) {
  const invoiceId = checkoutIntentRecord?.invoiceId || readPendingInvoiceLocator()?.invoiceId;
  if (!invoiceId) {
    if (!silent) showPageAction("No pending server invoice was found for this application set.");
    return null;
  }
  const paymentError = document.querySelector("[data-payment-error]");
  billingRuntimeState = "status_loading";
  billingErrorMessage = "";
  renderPaymentPage();
  try {
    const status = await applicationApi(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`);
    if (status.applicationSetId !== currentApplicationSet?.id) throw new Error("The invoice does not belong to the current application set.");
    if (!["requires_payment", "succeeded", "canceled", "refunded"].includes(status.status)) throw new Error("The server returned an unknown payment status.");
    checkoutStatusRecord = status;
    billingRuntimeState = "ready";
    if (status.status === "succeeded") await refreshAllChoicePreflights();
    if (["canceled", "refunded"].includes(status.status)) clearPendingInvoiceLocator();
    if (paymentError) paymentError.hidden = true;
    updateSubmissionSummary();
    updateProgress();
    if (status.status === "succeeded" && isBillingEntitlementReady()) {
      navigateApplicationStage("send", { scroll: !silent });
      if (!silent) showPageAction("Payment and per-choice billing entitlement are confirmed. Review and submit the exact application set.");
    } else if (!silent) {
      showPageAction(status.status === "succeeded" ? "Payment is settled; per-choice entitlement is still being confirmed." : `Hosted payment status: ${status.status}.`);
    }
    return status;
  } catch (error) {
    billingRuntimeState = "unavailable";
    billingErrorMessage = error.message;
    if (paymentError && !silent) {
      paymentError.hidden = false;
      paymentError.textContent = `Payment status could not be confirmed: ${error.message}`;
    }
    renderPaymentPage();
    return null;
  }
}

function isBillingEntitlementReady() {
  const choices = applicationChoices();
  return choices.length > 0 && choices.every((choice) => materialChoiceStates.get(choice.id)?.preflight?.billingEntitlement?.current === true);
}

function getFinalSubmissionBlockers() {
  return [
    ...getSubmitBlockers(),
    { key: "billing", target: "payment", label: "confirm payment and current billing entitlement for every choice", complete: isBillingEntitlementReady() },
  ].filter((item) => !item.complete);
}

async function submitApplicationSet(form) {
  const errorTarget = document.querySelector("[data-submission-error]");
  const button = form.querySelector("[data-submit-application]");
  const blockers = getFinalSubmissionBlockers();
  if (blockers.length) {
    if (errorTarget) {
      errorTarget.hidden = false;
      errorTarget.textContent = `Submission is locked: ${blockers.map((item) => item.label).join(", ")}.`;
    }
    navigateApplicationStage(blockers[0].target, { scroll: true });
    return;
  }
  const password = form.elements.password.value;
  form.elements.password.value = "";
  if (button) {
    button.disabled = true;
    button.textContent = "Authorizing account...";
  }
  if (errorTarget) errorTarget.hidden = true;
  try {
    await applicationApi("/api/v1/auth/step-up", { method: "POST", body: { password } });
    if (button) button.textContent = "Submitting application set...";
    const choiceIds = currentApplicationChoiceIds();
    submissionRecord = await applicationApi(`/api/v1/student/application-sets/${encodeURIComponent(currentApplicationSet.id)}/submit`, {
      method: "POST",
      headers: { "Idempotency-Key": applicationIdempotencyKey("application_submit") },
      body: { expectedRevision: currentApplicationSet.revision, choiceIds, confirmSubmission: true },
    });
    if (submissionRecord?.applicationSetId !== currentApplicationSet.id || submissionRecord?.status !== "accepted"
      || submissionRecord?.acceptanceScope !== "cuac_internal" || !Array.isArray(submissionRecord.programApplications)
      || !Array.isArray(submissionRecord.officialSubmissionGroups) || submissionRecord.programApplications.length !== choiceIds.length) {
      throw new Error("The server submission receipt was incomplete or did not match the exact application set.");
    }
    submittedToSchools = submissionRecord?.status === "accepted";
    clearPendingInvoiceLocator();
    try {
      await refreshCurrentApplicationSet();
    } catch {
      // The accepted server receipt remains sufficient to render this completed command.
    }
    renderSubmissionState({ scroll: true });
    showPageAction("CUAC accepted and locked the application set. Official school delivery now follows the server queue status.");
  } catch (error) {
    if (errorTarget) {
      errorTarget.hidden = false;
      errorTarget.textContent = error.status === 409
        ? "The application changed before submission. Refresh the current choices, authorizations and fee state before trying again."
        : `Application submission was not accepted: ${error.message}`;
    }
  } finally {
    if (button && !submittedToSchools) {
      button.disabled = false;
      button.textContent = "Authorize and submit application set";
    }
  }
}

function renderSubmissionChoiceLists() {
  const routes = getChoiceRoutes();
  const review = document.querySelector("[data-send-school-list]");
  if (review) review.innerHTML = routes.map((route) => `<article><strong>${escapeHtml(route.university)}</strong><span>${escapeHtml(route.program)} · ${escapeHtml(route.intake)}</span></article>`).join("");
  const submitted = document.querySelector("[data-submitted-school-list]");
  if (!submitted) return;
  const applications = Array.isArray(submissionRecord?.programApplications) ? submissionRecord.programApplications : [];
  submitted.innerHTML = routes.map((route) => {
    const application = applications.find((item) => item.applicationChoiceId === route.choiceId);
    return `<article><strong>${escapeHtml(route.university)}</strong><span>${escapeHtml(route.program)} · ${escapeHtml(application?.status || "submitted")}</span></article>`;
  }).join("");
}

function renderSubmissionReceipt() {
  const target = document.querySelector("[data-submission-receipt]");
  if (!target) return;
  if (!submissionRecord) {
    target.innerHTML = submittedToSchools ? `<span>Application set</span><strong>${escapeHtml(currentApplicationSet?.cuacId || "Submitted")}</strong><em>Server status: ${escapeHtml(currentApplicationSet?.status || "submitted")}</em>` : "";
    return;
  }
  target.innerHTML = `
    <span>CUAC internal receipt</span>
    <strong>${escapeHtml(submissionRecord.cuacId)} · ${escapeHtml(submissionRecord.id)}</strong>
    <em>${escapeHtml(new Date(submissionRecord.submittedAt).toLocaleString())} · ${submissionRecord.programApplications.length} program application${submissionRecord.programApplications.length === 1 ? "" : "s"} · ${submissionRecord.officialSubmissionGroups.length} delivery group${submissionRecord.officialSubmissionGroups.length === 1 ? "" : "s"}</em>
  `;
}

function renderSubmissionState({ scroll = false } = {}) {
  document.querySelector("[data-submit-step]").textContent = "Accepted";
  document.querySelector("[data-submission-status]")?.removeAttribute("hidden");
  renderSendPanelState();
  document.querySelector("[data-fee-card]")?.classList.add("submitted");
  document.querySelectorAll("[data-submit-action]").forEach((button) => {
    button.textContent = "View submission status";
    button.removeAttribute("disabled");
    button.setAttribute("aria-label", "View sent application status");
  });
  renderSubmissionChoiceLists();
  renderSubmissionReceipt();
  updateProgress();
  if (scroll || location.hash === "#send") setApplicationStage("send", { scroll });
  if (scroll) document.querySelector("[data-submission-status]")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function viewSentStatus() {
  const status = document.querySelector("[data-submission-status]");
  if (!status) return;
  status.removeAttribute("hidden");
  setApplicationStage("send", { scroll: true });
  status.focus({ preventScroll: true });
  if (location.hash !== "#send") history.replaceState(null, "", "#send");
  showPageAction("This application set has been accepted and locked by CUAC. The status panel separates internal acceptance from external school delivery.");
}

function getSelectedProgram() {
  const form = document.querySelector("[data-choice-form]");
  if (!form) return null;
  const degree = form.elements.degree.value;
  const university = form.elements.university.value;
  const program = form.elements.program.value;
  const item = findCatalogProgramBySelection(university, program, degree);
  if (!item) return null;
  const programId = appProgramId(item);
  const selectedIntake = (catalogIntakesByProgramId.get(programId) || [])
    .find((intake) => intake.id === form.elements.intake?.value) || null;
  return toChoiceProgram({ ...item, selectedIntake, programIntakeId: selectedIntake?.id || "" }, university);
}

function renderUniversityOptions(degree, selectedUniversity) {
  const universitySelect = document.querySelector("[data-university-select]");
  if (!universitySelect) return;
  const universities = Object.entries(programCatalog)
    .filter(([, programs]) => programs.some((entry) => appProgramDegree(entry) === degree))
    .map(([university]) => university);
  universitySelect.innerHTML = universities.length
    ? universities.map((university) => `<option>${escapeHtml(university)}</option>`).join("")
    : '<option value="">No published universities</option>';
  universitySelect.disabled = universities.length === 0;
  if (selectedUniversity && universities.includes(selectedUniversity)) {
    universitySelect.value = selectedUniversity;
  }
  renderProgramOptions(universitySelect.value);
}

function renderProgramOptions(university, selectedProgram) {
  const programSelect = document.querySelector("[data-program-select]");
  if (!programSelect) return;
  const form = document.querySelector("[data-choice-form]");
  const degree = form?.elements.degree.value || "Master";
  const programs = (programCatalog[university] || []).filter((entry) => appProgramDegree(entry) === degree);
  programSelect.innerHTML = programs.length
    ? programs
      .map((entry) => `<option value="${escapeHtml(appProgramOptionValue(entry))}">${escapeHtml(appProgramName(entry))}</option>`)
      .join("")
    : '<option value="">No published programs</option>';
  programSelect.disabled = programs.length === 0;
  const matchedSelection = selectedProgram
    ? programs.find((entry) => appProgramOptionValue(entry) === selectedProgram || appProgramName(entry) === selectedProgram || entry.program === selectedProgram)
    : null;
  if (matchedSelection) {
    programSelect.value = appProgramOptionValue(matchedSelection);
  }
}

function renderIntakeOptions(intakes, selectedIntakeId = "") {
  const select = document.querySelector("[data-intake-select]");
  if (!select) return;
  select.innerHTML = intakes.map((intake) => {
    const label = intakeDisplayName(intake);
    const deadline = intake.deadlineLabel || (intake.deadlineDate ? new Date(intake.deadlineDate).toLocaleDateString() : "");
    return `<option value="${escapeHtml(intake.id)}">${escapeHtml([label, deadline].filter(Boolean).join(" · "))}</option>`;
  }).join("");
  select.disabled = intakes.length === 0;
  select.required = true;
  if (intakes.some((intake) => intake.id === selectedIntakeId)) select.value = selectedIntakeId;
}

function renderLockedChoiceField(select, value, label) {
  if (!select) return;
  const nextValue = value || label || "Confirm";
  select.innerHTML = `<option value="${escapeHtml(nextValue)}">${escapeHtml(nextValue)}</option>`;
  select.value = nextValue;
  select.disabled = true;
  select.setAttribute("aria-readonly", "true");
  select.dataset.catalogLocked = "SchoolProgram";
  select.title = `${label || "This value"} is locked from the selected SchoolProgram record.`;
}

async function syncProgramFields() {
  const form = document.querySelector("[data-choice-form]");
  const preview = document.querySelector("[data-program-preview]");
  const sourceMap = document.querySelector("[data-choice-source-map]");
  if (!form || !preview) return;
  let item = findCatalogProgramBySelection(form.elements.university.value, form.elements.program.value, form.elements.degree.value);
  if (!item) {
    renderIntakeOptions([]);
    if (form.elements.language) {
      form.elements.language.innerHTML = "";
      form.elements.language.disabled = true;
      form.elements.language.removeAttribute("aria-readonly");
      delete form.elements.language.dataset.catalogLocked;
      form.elements.language.removeAttribute("title");
    }
    preview.innerHTML = "<strong>No published program is available for this selection.</strong>";
    if (sourceMap) sourceMap.innerHTML = "";
    return;
  }
  const selectedProgramId = appProgramId(item);
  const previousIntakeId = form.elements.intake?.value || "";
  try {
    const [detail, intakes] = await Promise.all([
      ensureProgramDetail(selectedProgramId),
      ensureProgramIntakes(selectedProgramId),
    ]);
    if (form.elements.program.value !== appProgramOptionValue(item)) return;
    item = detail;
    renderIntakeOptions(intakes, previousIntakeId);
  } catch (error) {
    renderIntakeOptions([]);
    preview.innerHTML = `<strong>Published program details are unavailable.</strong><p>${escapeHtml(error.message)}</p>`;
    if (sourceMap) sourceMap.innerHTML = "";
    return;
  }
  const selected = getSelectedProgram();
  if (!selected?.programIntakeId) {
    preview.innerHTML = "<strong>No published intake is currently available for this program.</strong>";
    if (sourceMap) sourceMap.innerHTML = "";
    return;
  }
  const student = getStudentProfile();
  const choiceNote = getFieldValue(form, "choiceNote", "");
  const cscaSummary = [
    appProgramList(selected.cscaSubjects, ""),
    selected.cscaRequirement,
  ].filter(Boolean).join(" · ") || "CSCA requirement will be confirmed by the school";
  const languageSummary = [
    selected.englishRequirement,
    selected.hskRequirement,
  ].filter(Boolean).join(" · ") || "Language evidence will be confirmed by the school";
  const applicationSummary = [
    selected.applicationRound || selected.intake,
    selected.applicationNote,
    selected.applicationUrl ? "School admissions page linked" : "",
  ].filter(Boolean).join(" · ") || "School contacts the student after receiving the CUAC record";
  renderLockedChoiceField(form.elements.language, selected.language, "Teaching language");
  preview.innerHTML = `
    <strong>${selected.university} · ${selected.program}</strong>
    <p>${selected.degree} route in ${selected.city}. ${selected.durationYears ? `${selected.durationYears} · ` : ""}${selected.fieldCategory || "Program field"}.</p>
    <div>
      <span>${selected.deadline}</span>
      <span>${selected.tuition}</span>
      <span>${selected.language}</span>
      ${selected.durationYears ? `<span>${escapeHtml(selected.durationYears)}</span>` : ""}
      ${selected.fieldCategory ? `<span>${escapeHtml(selected.fieldCategory)}</span>` : ""}
      <span>${selected.signal}</span>
      <span>${escapeHtml(selected.scholarshipText || (selected.hasScholarship ? "Funding information available" : "No funding claim"))}</span>
    </div>
  `;
  if (sourceMap) {
    sourceMap.innerHTML = `
      <div class="choice-source-intro">
        <strong>What this school will receive</strong>
        <p>CUAC sends a small non-document record for this exact program and intake choice. Each school only sees its own school, program, and published intake.</p>
      </div>
      <article>
        <span>Your selected route</span>
        <strong>${escapeHtml(selected.university)} · ${escapeHtml(selected.program)}</strong>
        <em>${escapeHtml(selected.intake)} · ${escapeHtml(selected.language)}${choiceNote ? ` · Note: ${escapeHtml(choiceNote)}` : ""}</em>
      </article>
      <article>
        <span>Academic route</span>
        <strong>${escapeHtml(selected.degree)} · ${escapeHtml(selected.durationYears || "Duration to confirm")} · ${escapeHtml(selected.fieldCategory || selected.programName)}</strong>
        <em>${escapeHtml(selected.language)} · ${escapeHtml(selected.deadline)} · ${escapeHtml(selected.tuition)}</em>
      </article>
      <article>
        <span>Entry requirements</span>
        <strong>${escapeHtml(cscaSummary)}</strong>
        <em>${escapeHtml(languageSummary)}</em>
      </article>
      <article>
        <span>Application route</span>
        <strong>${escapeHtml(applicationSummary)}</strong>
        <em>${escapeHtml(selected.sourceLabel || "CUAC catalog record")} · review exact materials separately before authorization</em>
      </article>
      <article>
        <span>Your contact profile</span>
        <strong>${escapeHtml(student.fullName || "Name not saved")} · ${escapeHtml(student.citizenshipCountry || "Citizenship not saved")}</strong>
        <em>${escapeHtml(student.contactEmail || "Contact email not saved")}</em>
      </article>
      <article class="not-sent">
        <span>Files</span>
        <strong>Controlled by the per-choice material envelope</strong>
        <em>Review and authorize the exact selected files in Submission sharing before payment.</em>
      </article>
    `;
  }
}

document.addEventListener("click", (event) => {
  const confirm = event.target.closest("[data-confirm-choice]");
  if (confirm) {
    void confirmChoice({ scrollToFee: true });
  }

  const openModal = event.target.closest("[data-open-choice-modal]");
  if (openModal) setChoiceModal(true);

  const remove = event.target.closest("[data-remove-choice]");
  if (remove) void removeChoice(remove);

  const closeModal = event.target.closest("[data-close-choice-modal]");
  if (closeModal) setChoiceModal(false);

  const openPayment = event.target.closest("[data-open-payment]");
  if (openPayment) {
    if (submittedToSchools) {
      viewSentStatus();
    } else {
      navigateApplicationStage("payment", { scroll: true });
    }
  }

  const nextStep = event.target.closest("[data-next-application-step]");
  if (nextStep) {
    if (nextStep.dataset.nextApplicationStep === "info") showProfileOverview({ updateHash: true, scroll: true });
    else navigateApplicationStage(nextStep.dataset.nextApplicationStep, { scroll: true });
  }

  const profileTarget = event.target.closest("[data-profile-section-target]");
  if (profileTarget) openProfileDetail(profileTarget.dataset.profileSectionTarget, { focus: true, replace: profileTarget.closest("[data-profile-editor]") });

  const profileOverviewBack = event.target.closest("[data-profile-overview-back]");
  if (profileOverviewBack) {
    event.preventDefault();
    showProfileOverview({ scroll: true });
  }

  const profileNext = event.target.closest("[data-profile-next]");
  if (profileNext) stepProfileSection(1);

  const profilePrev = event.target.closest("[data-profile-prev]");
  if (profilePrev) stepProfileSection(-1);

  const saveSection = event.target.closest("[data-save-profile-section]");
  if (saveSection) void saveProfileSection();

  const removeEducation = event.target.closest("[data-remove-education-record]");
  if (removeEducation) void removeEducationRecord(removeEducation.dataset.removeEducationRecord, removeEducation);

  const editEducation = event.target.closest("[data-edit-education-record]");
  if (editEducation) startEducationEdit(editEducation.dataset.editEducationRecord);

  if (event.target.closest("[data-cancel-education-edit]")) resetEducationForm();

  const removeAssessment = event.target.closest("[data-remove-assessment-record]");
  if (removeAssessment) void removeAssessmentRecord(removeAssessment.dataset.removeAssessmentRecord, removeAssessment);

  const editAssessment = event.target.closest("[data-edit-assessment-record]");
  if (editAssessment) startAssessmentEdit(editAssessment.dataset.editAssessmentRecord);

  if (event.target.closest("[data-cancel-assessment-edit]")) resetAssessmentForm();

  if (event.target.closest("[data-add-assessment-component]")) addAssessmentComponent();

  const removeComponent = event.target.closest("[data-remove-assessment-component]");
  if (removeComponent) {
    removeComponent.closest("[data-assessment-component]")?.remove();
    if (!document.querySelector("[data-assessment-component]")) addAssessmentComponent();
  }

  const materialChoice = event.target.closest("[data-material-choice-id]");
  if (materialChoice) {
    currentMaterialChoiceId = materialChoice.dataset.materialChoiceId;
    renderMaterialChoiceTabs();
    void loadChoicePreparation(currentMaterialChoiceId);
  }

  const reloadMaterial = event.target.closest("[data-reload-material-choice]");
  if (reloadMaterial) void loadChoicePreparation(currentMaterialChoiceId, { force: true });

  const saveMaterial = event.target.closest("[data-save-material-selection]");
  if (saveMaterial) void saveMaterialSelection(saveMaterial);

  const previewMaterial = event.target.closest("[data-preview-material-selection]");
  if (previewMaterial) void previewMaterialSelection(previewMaterial);

  const authorizeMaterial = event.target.closest("[data-authorize-material-selection]");
  if (authorizeMaterial) void authorizeMaterialSelection(authorizeMaterial);

  const withdrawMaterial = event.target.closest("[data-withdraw-material-authorization]");
  if (withdrawMaterial) void withdrawMaterialAuthorization(withdrawMaterial);

  const downloadFile = event.target.closest("[data-download-private-file]");
  if (downloadFile) void downloadStudentFile(downloadFile);

  const deleteFile = event.target.closest("[data-delete-private-file]");
  if (deleteFile) void deleteStudentFile(deleteFile);

  const startCheckout = event.target.closest("[data-start-checkout]");
  if (startCheckout) void createHostedCheckout();

  const refreshPayment = event.target.closest("[data-refresh-payment]");
  if (refreshPayment) void refreshCheckoutStatus();

  const flowTarget = event.target.closest("[data-flow-target]");
  if (flowTarget) {
    if (flowTarget.dataset.flowTarget === "info") showProfileOverview({ updateHash: true, scroll: true });
    else navigateApplicationStage(flowTarget.dataset.flowTarget, { scroll: true });
  }

  const fill = event.target.closest("[data-fill-choice]");
  if (fill) fillChoice(fill.dataset.fillChoice);

  const sectionAction = event.target.closest("[data-section-action]");
  if (sectionAction) {
    const card = sectionAction.closest(".section-card");
    card?.classList.toggle("done");
    sectionAction.textContent = card?.classList.contains("done") ? "Checked" : "Start";
    updateProgress();
  }

});

document.addEventListener("submit", (event) => {
  const choiceForm = event.target.closest("[data-choice-form]");
  if (choiceForm) {
    event.preventDefault();
    void addChoice(choiceForm);
    return;
  }
  const applicantForm = event.target.closest("[data-applicant-profile-form]");
  if (applicantForm) {
    event.preventDefault();
    void saveApplicantProfile();
    return;
  }
  const educationForm = event.target.closest("[data-education-record-form]");
  if (educationForm) {
    event.preventDefault();
    void saveEducationRecord(educationForm);
    return;
  }
  const assessmentForm = event.target.closest("[data-assessment-record-form]");
  if (assessmentForm) {
    event.preventDefault();
    void saveAssessmentRecord(assessmentForm);
    return;
  }
  const fileForm = event.target.closest("[data-private-file-upload-form]");
  if (fileForm) {
    event.preventDefault();
    void uploadStudentFile(fileForm);
    return;
  }
  const submissionForm = event.target.closest("[data-submission-confirmation-form]");
  if (submissionForm) {
    event.preventDefault();
    void submitApplicationSet(submissionForm);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-degree-select]")) {
    renderUniversityOptions(event.target.value);
    void syncProgramFields();
  }
  if (event.target.matches("[data-university-select]")) {
    renderProgramOptions(event.target.value);
    void syncProgramFields();
  }
  if (event.target.matches("[data-program-select], [data-intake-select]")) void syncProgramFields();
  if (event.target.matches("[data-assessment-result-status]")) syncAssessmentEntryState();
  if (event.target.matches("[data-material-applicant-field], [data-material-education-record], [data-material-assessment-record]")) {
    const state = materialChoiceState(currentMaterialChoiceId);
    state.preview = null;
    document.querySelector("[data-preview-material-selection]")?.setAttribute("disabled", "");
    document.querySelector("[data-authorize-material-selection]")?.setAttribute("disabled", "");
    setProfileOperationStatus("authorization", "Material selection changed locally. Save it before previewing or authorizing.", "pending");
  }
  if (event.target.closest("[data-applicant-profile-form]")) {
    markProfileSectionDirty("applicant");
    renderStudentInfoStatus();
    updateSubmissionSummary();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("[data-choice-form]")) {
    void syncProgramFields();
    return;
  }
  if (event.target.closest("[data-applicant-profile-form]")) {
    markProfileSectionDirty("applicant");
    renderStudentInfoStatus();
    updateSubmissionSummary();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setChoiceModal(false);
  if (event.key === "Escape") setPaymentModal(false);
});

document.addEventListener("click", (event) => {
  const profileReturn = event.target.closest("[data-profile-return]");
  if (!profileReturn) return;
  event.preventDefault();
  showProfileOverview({ scroll: true });
});

renderIcons();
renderStudentInfoStatus();
updateProfileSaveStatus();
setProfileSection("applicant", { openEditor: false });
syncAssessmentEntryState();
updateChoiceLabels();
syncChoiceConfirmationUi();
updateProgress();
updateSubmissionSummary();
if (submittedToSchools) renderSubmissionState();
setApplicationStage("overview");
void initializeApplicationRuntime();

function openChoiceModalFromHash() {
  const profileSection = profileSectionFromHash();
  if (profileSection) {
    openProfileDetail(profileSection, { replace: true, scroll: true });
    return;
  }
  if (location.hash === "#info" || location.hash === "#profile") {
    showProfileOverview({ updateHash: false, scroll: true });
    return;
  }
  if (location.hash === "" || location.hash === "#overview") {
    closeProfileDetailMode();
    setApplicationStage("overview", { scroll: location.hash === "#overview" });
    return;
  }
  if (location.hash === "#choices") {
    closeProfileDetailMode();
    setApplicationStage("choices", { scroll: true });
    return;
  }
  if (location.hash === "#add-choice") {
    closeProfileDetailMode();
    setApplicationStage("choices", { scroll: true });
    if (applicationRuntimeState === "ready") {
      history.replaceState(null, "", "#choices");
      setChoiceModal(true);
    } else {
      showPageAction("Loading your application choices before opening the published program selector.");
    }
    return;
  }
  if (location.hash === "#fee") {
    closeProfileDetailMode();
    setApplicationStage("fee", { scroll: true });
    return;
  }
  if (location.hash === "#payment") {
    closeProfileDetailMode();
    setApplicationStage("payment", { scroll: true });
    return;
  }
  if (location.hash === "#send" || location.hash === "#submitted") {
    closeProfileDetailMode();
    setApplicationStage("send", { scroll: true });
  }
}

openChoiceModalFromHash();
window.addEventListener("hashchange", openChoiceModalFromHash);
