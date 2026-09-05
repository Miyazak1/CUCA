const schoolStatusLabels = {
  new: "新记录",
  needs_review: "需要审核",
  contact_queued: "待联系",
  contacted: "已联系",
  waiting_for_documents: "等待材料",
  documents_received_by_school: "学校已收材料",
  not_a_fit: "不适合",
  converted_to_official_application: "已转正式申请",
  archived: "已归档",
};

const schoolStatusTransitions = {
  new: ["needs_review", "contact_queued", "contacted", "not_a_fit", "converted_to_official_application", "archived"],
  needs_review: ["contact_queued", "not_a_fit", "converted_to_official_application", "archived"],
  contact_queued: ["contacted", "not_a_fit", "converted_to_official_application", "archived"],
  contacted: ["waiting_for_documents", "not_a_fit", "converted_to_official_application", "archived"],
  waiting_for_documents: ["documents_received_by_school", "not_a_fit", "converted_to_official_application", "archived"],
  documents_received_by_school: ["not_a_fit", "converted_to_official_application", "archived"],
  not_a_fit: [],
  converted_to_official_application: [],
  archived: [],
};

const schoolFinalStatuses = new Set(["not_a_fit", "converted_to_official_application", "archived"]);
const schoolContactableStatuses = new Set([
  "new", "needs_review", "contact_queued", "contacted", "waiting_for_documents", "documents_received_by_school",
]);

const schoolState = {
  tenantSchoolId: null,
  schoolName: "当前学校租户",
  queue: [],
  programs: new Map(),
  intakes: new Map(),
  selectedId: null,
  detail: null,
  search: "",
  status: "all",
  busy: false,
};

class SchoolRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "SchoolRequestError";
    this.status = status;
    this.code = code;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value, fallback = "时间未提供") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function statusLabel(status) {
  return schoolStatusLabels[status] || cleanText(status) || "状态未知";
}

function statusClass(status) {
  if (schoolFinalStatuses.has(status)) return "is-final";
  if (["needs_review", "contact_queued", "waiting_for_documents"].includes(status)) return "is-warning";
  return "";
}

function applicantLabel(item) {
  const profile = item && typeof item.schoolVisibleProfile === "object" && item.schoolVisibleProfile
    ? item.schoolVisibleProfile : {};
  const applicant = profile.format === "cuac.school-visible-projection.v1"
    && profile.applicant && typeof profile.applicant === "object" ? profile.applicant : {};
  return cleanText(applicant.fullName) || cleanText(profile.displayName) || "申请人资料未提供";
}

function programLabel(programId) {
  if (!programId) return "项目未提供";
  return schoolState.programs.get(programId)?.nameEn || "项目记录";
}

function intakeLabel(intakeId) {
  if (!intakeId) return "入学季未提供";
  const intake = schoolState.intakes.get(intakeId);
  if (!intake) return "入学季记录";
  const term = cleanText(intake.intakeTerm).replace(/_/g, " ");
  return `${term ? term[0].toUpperCase() + term.slice(1) : "Intake"} ${intake.intakeYear}`;
}

function isQueueItem(value) {
  return value && typeof value === "object" && typeof value.id === "string"
    && typeof value.applicationRecordFormat === "string" && typeof value.schoolId === "string"
    && typeof value.status === "string" && Number.isSafeInteger(value.schoolRevision)
    && value.schoolRevision >= 1;
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SchoolRequestError(
      payload?.error?.message || "学校工作台请求未完成。",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new SchoolRequestError("学校工作台响应缺少数据封装。", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

function handleAuthError(error) {
  if (![401, 403].includes(error?.status)) return false;
  window.CUAC?.requireSignedIn?.("打开学校工作台", {
    requiredRole: "school_staff",
    resumeAction: { type: "navigate", href: "school-portal.html" },
  });
  return true;
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("[data-school-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

function visibleQueue() {
  const query = schoolState.search.toLocaleLowerCase("zh-CN");
  return schoolState.queue.filter(item => {
    if (schoolState.status !== "all" && item.status !== schoolState.status) return false;
    if (!query) return true;
    const searchable = [item.cuacId, applicantLabel(item), programLabel(item.programId)].join(" ").toLocaleLowerCase("zh-CN");
    return searchable.includes(query);
  });
}

function renderSummary() {
  const queue = schoolState.queue;
  const counts = {
    all: queue.length,
    action: queue.filter(item => ["new", "needs_review", "contact_queued"].includes(item.status)).length,
    documents: queue.filter(item => item.status === "waiting_for_documents").length,
    contacted: queue.filter(item => ["contacted", "waiting_for_documents", "documents_received_by_school"].includes(item.status)).length,
  };
  for (const [key, value] of Object.entries(counts)) {
    const target = document.querySelector(`[data-summary="${key}"]`);
    if (target) target.textContent = String(value);
  }
}

function renderQueue() {
  const root = document.querySelector("[data-school-queue]");
  const title = document.querySelector("[data-queue-title]");
  if (!root || !title) return;
  const items = visibleQueue();
  title.textContent = `${items.length} 条记录`;
  if (!items.length) {
    root.innerHTML = `<p class="school-state">${schoolState.queue.length ? "没有符合当前筛选条件的记录。" : "当前学校尚无已确认接收的申请。"}</p>`;
    return;
  }
  root.innerHTML = items.map(item => `
    <button class="school-queue-row ${item.id === schoolState.selectedId ? "active" : ""}" type="button" data-school-record="${escapeHtml(item.id)}" aria-pressed="${item.id === schoolState.selectedId ? "true" : "false"}">
      <span>
        <strong>${escapeHtml(programLabel(item.programId))}</strong>
        <span class="school-record-id">${escapeHtml(item.cuacId || "CUAC 编号未提供")}</span>
        <small>${escapeHtml(applicantLabel(item))} · ${escapeHtml(formatDateTime(item.submittedAt))}</small>
      </span>
      <span class="school-status ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
    </button>`).join("");
}

function detailDefinitionRows(detail) {
  const profile = detail && typeof detail.schoolVisibleProfile === "object" && detail.schoolVisibleProfile
    ? detail.schoolVisibleProfile : {};
  const rows = [];
  if (profile.format === "cuac.school-visible-projection.v1" && profile.applicant
    && typeof profile.applicant === "object" && !Array.isArray(profile.applicant)) {
    const values = [
      ["申请人", profile.applicant.fullName],
      ["联系邮箱", profile.applicant.contactEmail],
      ["国籍国家/地区", profile.applicant.citizenshipCountry],
    ];
    rows.push(...values.filter(([, value]) => cleanText(value)));
  } else if (cleanText(profile.displayName)) rows.push(["申请人", profile.displayName]);
  return rows;
}

function renderDefinitions(rows) {
  if (!rows.length) return '<p class="school-projection-note">当前记录未包含已定义的学校可见学生资料字段。</p>';
  return `<dl class="school-definition-list">${rows.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function renderStatusForm(detail) {
  const targets = schoolStatusTransitions[detail.status] || [];
  if (detail.applicationRecordFormat !== "cuac.program-application.v2") {
    return '<p class="school-projection-note">这是一条历史格式记录，仅可查看，不能进入当前状态流程。</p>';
  }
  if (!targets.length) return '<p class="school-projection-note">当前状态已经结束，没有可用的后续流转。</p>';
  return `<form class="school-inline-form" data-school-status-form>
    <label class="school-form-field"><span>更新状态</span><select name="status" required>
      ${targets.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</option>`).join("")}
    </select></label>
    <label class="school-form-field"><span>原因（关闭或归档时必填）</span><input name="reason" maxlength="500" autocomplete="off" /></label>
    <div class="school-form-actions"><button class="school-button primary" type="submit">保存状态</button></div>
  </form>`;
}

function renderContactForm(detail) {
  if (detail.applicationRecordFormat !== "cuac.program-application.v2" || !schoolContactableStatuses.has(detail.status)) {
    return '<p class="school-projection-note">当前记录不可新增联系日志。</p>';
  }
  return `<form class="school-contact-form" data-school-contact-form>
    <label class="school-form-field"><span>渠道</span><select name="channel" required>
      <option value="email">电子邮件</option><option value="phone">电话</option><option value="whatsapp">WhatsApp</option><option value="in_person">当面</option><option value="other">其他</option>
    </select></label>
    <label class="school-form-field"><span>方向</span><select name="direction" required>
      <option value="outbound">学校发起</option><option value="inbound">学生发起</option>
    </select></label>
    <label class="school-form-field"><span>结果</span><select name="outcome" required>
      <option value="attempted">已尝试</option><option value="reached">已联系到</option><option value="replied">已回复</option><option value="follow_up_required">需要跟进</option>
    </select></label>
    <label class="school-form-field school-note-field"><span>内部记录</span><textarea name="note" maxlength="2000" required></textarea></label>
    <div class="school-form-actions"><button class="school-button primary" type="submit">记录联系</button></div>
  </form>`;
}

function activityItems(detail) {
  const statusItems = Array.isArray(detail.statusEvents) ? detail.statusEvents.map(event => ({
    at: event.createdAt,
    title: `状态更新为${statusLabel(event.toStatus)}`,
    detail: cleanText(event.reason),
  })) : [];
  const contactItems = Array.isArray(detail.contactLogs) ? detail.contactLogs.map(log => ({
    at: log.createdAt,
    title: `联系记录 · ${cleanText(log.channel) || "渠道未知"} · ${cleanText(log.outcome) || "结果未知"}`,
    detail: cleanText(log.note),
  })) : [];
  return [...statusItems, ...contactItems]
    .filter(item => Number.isFinite(new Date(item.at).getTime()))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

function renderActivity(detail) {
  const items = activityItems(detail);
  if (!items.length) return '<p class="school-projection-note">尚无状态或联系活动。</p>';
  return `<ol class="school-activity-list">${items.map(item => `<li>
    <time datetime="${escapeHtml(item.at)}">${escapeHtml(formatDateTime(item.at))}</time>
    <div><strong>${escapeHtml(item.title)}</strong>${item.detail ? `<span>${escapeHtml(item.detail)}</span>` : ""}</div>
  </li>`).join("")}</ol>`;
}

function renderDetail() {
  const root = document.querySelector("[data-school-detail]");
  const detail = schoolState.detail;
  if (!root || !detail) return;
  root.innerHTML = `
    <header class="school-detail-header">
      <div><span class="school-kicker">申请详情</span><h2>${escapeHtml(programLabel(detail.programId))}</h2><p>${escapeHtml(detail.cuacId || "CUAC 编号未提供")}</p></div>
      <span class="school-status ${statusClass(detail.status)}">${escapeHtml(statusLabel(detail.status))}</span>
    </header>
    <div class="school-detail-grid">
      <div><span>入学季</span><strong>${escapeHtml(intakeLabel(detail.programIntakeId))}</strong></div>
      <div><span>确认接收</span><strong>${escapeHtml(formatDateTime(detail.submittedAt))}</strong></div>
      <div><span>流程版本</span><strong>${escapeHtml(String(detail.schoolRevision))}</strong></div>
    </div>
    <section class="school-detail-section"><header><h3>学校可见资料</h3><p>仅显示当前 API 明确定义并返回的字段。</p></header>${renderDefinitions(detailDefinitionRows(detail))}</section>
    <section class="school-detail-section"><header><h3>状态流转</h3><p>更新使用当前记录版本，冲突时会重新读取。</p></header>${renderStatusForm(detail)}</section>
    <section class="school-detail-section"><header><h3>联系日志</h3><p>日志仅属于当前学校租户。</p></header>${renderContactForm(detail)}</section>
    <section class="school-detail-section"><header><h3>活动记录</h3><p>状态和联系活动按时间排序。</p></header>${renderActivity(detail)}</section>`;
}

async function loadIntakes(programId) {
  if (!programId || [...schoolState.intakes.values()].some(intake => intake.programId === programId)) return;
  try {
    const data = await requestJson(`/api/v1/catalog/programs/${encodeURIComponent(programId)}/intakes?limit=20`);
    if (Array.isArray(data)) data.forEach(intake => {
      if (intake && typeof intake.id === "string") schoolState.intakes.set(intake.id, intake);
    });
  } catch {
    // Intake labels are supplementary; the tenant application remains usable by its stable IDs.
  }
}

async function loadDetail(id) {
  if (!id || schoolState.busy) return;
  schoolState.selectedId = id;
  renderQueue();
  const root = document.querySelector("[data-school-detail]");
  if (root) root.innerHTML = '<p class="school-state" aria-busy="true">正在读取申请详情。</p>';
  try {
    const detail = await requestJson(`/api/v1/school/applications/${encodeURIComponent(id)}`);
    if (!isQueueItem(detail) || detail.id !== id || !Array.isArray(detail.statusEvents) || !Array.isArray(detail.contactLogs)) {
      throw new SchoolRequestError("申请详情不符合学校工作台数据契约。", 503, "INVALID_RESPONSE");
    }
    await loadIntakes(detail.programId);
    schoolState.detail = detail;
    renderDetail();
  } catch (error) {
    if (handleAuthError(error)) return;
    if (root) root.innerHTML = `<div class="school-empty-detail"><span class="school-kicker">读取失败</span><h2>无法打开这条申请</h2><p>${escapeHtml(error.message || "请刷新后重试。")}</p></div>`;
  }
}

async function loadCatalogContext() {
  const jobs = [requestJson("/api/v1/catalog/programs?limit=100")];
  if (schoolState.tenantSchoolId) jobs.push(requestJson(`/api/v1/catalog/schools/${encodeURIComponent(schoolState.tenantSchoolId)}`));
  const [programs, school] = await Promise.allSettled(jobs);
  if (programs.status === "fulfilled" && Array.isArray(programs.value)) {
    programs.value.forEach(program => {
      if (program && typeof program.id === "string") schoolState.programs.set(program.id, program);
    });
  }
  if (school?.status === "fulfilled" && school.value && typeof school.value === "object") {
    schoolState.schoolName = cleanText(school.value.nameZh) || cleanText(school.value.nameEn) || schoolState.schoolName;
  }
  const schoolName = document.querySelector("[data-school-name]");
  if (schoolName) schoolName.textContent = schoolState.schoolName;
  renderQueue();
  if (schoolState.detail) renderDetail();
}

async function loadQueue({ preserveSelection = false } = {}) {
  const refresh = document.querySelector("[data-refresh-school]");
  refresh?.setAttribute("disabled", "");
  try {
    const data = await requestJson("/api/v1/school/applications");
    if (!Array.isArray(data) || data.some(item => !isQueueItem(item))) {
      throw new SchoolRequestError("申请队列不符合学校工作台数据契约。", 503, "INVALID_RESPONSE");
    }
    if (data.some(item => item.schoolId !== schoolState.tenantSchoolId)) {
      throw new SchoolRequestError("申请队列包含当前租户范围之外的记录。", 503, "TENANT_MISMATCH");
    }
    schoolState.queue = data;
    renderSummary();
    renderQueue();
    const selectedStillExists = preserveSelection && data.some(item => item.id === schoolState.selectedId);
    const nextId = selectedStillExists ? schoolState.selectedId : data[0]?.id;
    if (nextId) await loadDetail(nextId);
    else {
      schoolState.selectedId = null;
      schoolState.detail = null;
    }
  } catch (error) {
    if (handleAuthError(error)) return;
    const root = document.querySelector("[data-school-queue]");
    if (root) root.innerHTML = `<p class="school-state">${escapeHtml(error.message || "学校申请队列暂时不可用。")}</p>`;
    const title = document.querySelector("[data-queue-title]");
    if (title) title.textContent = "队列不可用";
  } finally {
    refresh?.removeAttribute("disabled");
  }
}

async function refreshAfterMutation(message) {
  await loadQueue({ preserveSelection: true });
  showToast(message);
}

async function submitStatus(form) {
  const detail = schoolState.detail;
  if (!detail || schoolState.busy) return;
  const data = new FormData(form);
  const status = cleanText(data.get("status"));
  const reason = cleanText(data.get("reason"));
  if (["not_a_fit", "archived"].includes(status) && !reason) {
    showToast("关闭或归档申请时必须填写原因。");
    form.elements.reason?.focus();
    return;
  }
  schoolState.busy = true;
  form.querySelector("button[type=submit]")?.setAttribute("disabled", "");
  try {
    await requestJson(`/api/v1/school/applications/${encodeURIComponent(detail.id)}/status`, {
      method: "PATCH",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedRevision: detail.schoolRevision, status, reason: reason || null }),
    });
    await refreshAfterMutation("申请状态已更新。");
  } catch (error) {
    if (error.status === 409) await loadQueue({ preserveSelection: true });
    if (!handleAuthError(error)) showToast(error.message || "状态更新失败。");
  } finally {
    schoolState.busy = false;
    form.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

async function submitContact(form) {
  const detail = schoolState.detail;
  if (!detail || schoolState.busy) return;
  const data = new FormData(form);
  const input = Object.fromEntries(["channel", "direction", "outcome", "note"].map(key => [key, cleanText(data.get(key))]));
  if (!input.note) {
    showToast("请填写联系记录。");
    form.elements.note?.focus();
    return;
  }
  schoolState.busy = true;
  form.querySelector("button[type=submit]")?.setAttribute("disabled", "");
  try {
    await requestJson(`/api/v1/school/applications/${encodeURIComponent(detail.id)}/contact-logs`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    });
    form.reset();
    await refreshAfterMutation("联系日志已记录。");
  } catch (error) {
    if (!handleAuthError(error)) showToast(error.message || "联系日志保存失败。");
  } finally {
    schoolState.busy = false;
    form.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

function bindSchoolEvents() {
  document.addEventListener("click", event => {
    const record = event.target.closest("[data-school-record]");
    if (record) void loadDetail(record.dataset.schoolRecord);
    if (event.target.closest("[data-refresh-school]")) void loadQueue({ preserveSelection: true });
  });
  document.addEventListener("input", event => {
    if (!event.target.matches("[data-school-search]")) return;
    schoolState.search = event.target.value.trim();
    renderQueue();
  });
  document.addEventListener("change", event => {
    if (!event.target.matches("[data-school-status-filter]")) return;
    schoolState.status = event.target.value;
    renderQueue();
  });
  document.addEventListener("submit", event => {
    if (event.target.matches("[data-school-status-form]")) {
      event.preventDefault();
      void submitStatus(event.target);
    }
    if (event.target.matches("[data-school-contact-form]")) {
      event.preventDefault();
      void submitContact(event.target);
    }
  });
}

async function startSchoolWorkspace() {
  bindSchoolEvents();
  const auth = await window.CUAC?.authReady?.();
  if (!auth || auth.authState !== "signed-in" || auth.role !== "school_staff" || !auth.tenantSchoolId) {
    if (!auth || auth.authState !== "signed-out") return;
    handleAuthError(new SchoolRequestError("学校账号登录后才能打开工作台。", 401, "AUTH_REQUIRED"));
    return;
  }
  schoolState.tenantSchoolId = auth.tenantSchoolId;
  await Promise.all([loadCatalogContext(), loadQueue()]);
}

void startSchoolWorkspace();
