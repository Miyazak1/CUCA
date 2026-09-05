class SchoolSettingsRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "SchoolSettingsRequestError";
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

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new SchoolSettingsRequestError(payload?.error?.message || "学校工作区请求未完成。", response.status, payload?.error?.code || "REQUEST_FAILED");
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) throw new SchoolSettingsRequestError("学校工作区响应缺少数据封装。", response.status, "INVALID_RESPONSE");
  return payload.data;
}

const correctionFields = {
  websiteUrl: { label: "学校网站", max: 2048, url: true },
  admissionsUrl: { label: "招生网站", max: 2048, url: true },
  applicationLevel: { label: "申请层级", max: 200 },
  languageOfInstruction: { label: "授课语言", max: 200 },
  deadlineSummary: { label: "截止日期摘要", max: 500 },
  tuitionSummary: { label: "学费摘要", max: 500 },
  applicationFee: { label: "申请费", max: 200 },
};

const correctionReasons = [
  ["official_website_changed", "官网信息已更新"],
  ["admissions_route_changed", "招生入口已更新"],
  ["fee_information_changed", "费用信息已更新"],
  ["language_information_changed", "授课语言信息已更新"],
  ["outdated_public_information", "公开信息已经过时"],
];

const correctionStatusLabels = {
  submitted: "等待 CUAC 认领",
  claimed: "CUAC 复核中",
  applied: "已发布，等待重新核验",
  rejected: "未采纳",
};

const schoolSettingsState = { corrections: null, busy: false };

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function textOrFallback(value, fallback = "未记录") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeHttpsLink(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function renderCorrectionHistory(items) {
  if (!items.length) return '<p class="school-settings-empty">尚未提交目录更正。</p>';
  return `<div class="school-settings-history">${items.map(item => {
    const fields = Object.entries(item.changes || {}).map(([key, value]) => {
      const definition = correctionFields[key];
      if (!definition) return "";
      return `<div><dt>${escapeHtml(definition.label)}</dt><dd>${escapeHtml(value === null ? "清除此字段" : value)}</dd></div>`;
    }).join("");
    return `<article class="school-settings-history-row">
      <header><div><strong>${escapeHtml(correctionStatusLabels[item.status] || item.status)}</strong><span>${escapeHtml(formatDate(item.createdAt))}</span></div>
      <span class="school-settings-badge is-neutral">修订 ${escapeHtml(item.revision)}</span></header>
      <dl>${fields}</dl>
      <p><a class="school-settings-link" href="${escapeHtml(safeHttpsLink(item.evidenceUrl))}" target="_blank" rel="noopener noreferrer">查看提交证据</a>${item.resolutionReference ? ` · 处理引用 ${escapeHtml(item.resolutionReference)}` : ""}</p>
    </article>`;
  }).join("")}</div>`;
}

function renderCorrectionWorkspace(corrections) {
  const fieldOptions = Object.entries(correctionFields)
    .map(([value, definition]) => `<option value="${value}">${escapeHtml(definition.label)}</option>`).join("");
  const reasonOptions = correctionReasons
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
  const firstField = Object.keys(correctionFields)[0];
  return `<section class="school-settings-corrections" aria-labelledby="school-corrections-title">
    <header class="school-settings-section-heading"><div><p class="school-settings-kicker">公开目录治理</p><h2 id="school-corrections-title">提交字段更正</h2></div>
      <p>更正不会直接改动公开目录。CUAC 认领后，须由另一位管理员复核并发布。</p></header>
    <div class="school-settings-correction-layout">
      <form class="school-settings-correction-form" data-school-correction-form>
        <label><span>需要更正的字段</span><select name="field" required>${fieldOptions}</select></label>
        <div class="school-settings-current"><span>当前值</span><output data-current-catalog-value>${escapeHtml(textOrFallback(corrections.school[firstField], "当前为空"))}</output></div>
        <label><span>建议值</span><textarea name="value" maxlength="2048" rows="3" required></textarea></label>
        <label class="school-settings-check"><input type="checkbox" name="clearValue" /><span>建议清除此字段</span></label>
        <label><span>更正原因</span><select name="reasonCode" required>${reasonOptions}</select></label>
        <label><span>官方证据链接</span><input name="evidenceUrl" type="url" maxlength="2048" placeholder="https://" required /></label>
        <button class="school-settings-primary" type="submit">提交更正</button>
        <p class="school-settings-form-note" data-school-correction-note>每次提交一个字段，便于独立核对证据和处理结果。</p>
      </form>
      <section class="school-settings-history-section" aria-labelledby="school-correction-history-title">
        <h3 id="school-correction-history-title">更正记录</h3>
        ${renderCorrectionHistory(corrections.items)}
      </section>
    </div>
  </section>`;
}

function renderSettings(actor, school, corrections) {
  const root = document.querySelector("[data-school-settings-view]");
  if (!root) return;
  const website = safeHttpsLink(school.websiteUrl);
  const admissions = safeHttpsLink(school.admissionsUrl);
  const source = safeHttpsLink(school.sourceUrl);
  const name = textOrFallback(school.nameZh, school.nameEn);
  root.innerHTML = `
    <section class="school-settings-status" aria-label="当前学校租户">
      <div><h2>${escapeHtml(name)}</h2><p>${escapeHtml(school.nameEn)}</p></div>
      <span class="school-settings-badge">${escapeHtml(textOrFallback(school.status, "状态未知"))}</span>
    </section>
    <div class="school-settings-grid">
      <section class="school-settings-section" aria-labelledby="school-access-title">
        <h2 id="school-access-title">会话与租户</h2>
        <dl class="school-settings-facts">
          <div><dt>当前角色</dt><dd>${escapeHtml(actor.activeRole)}</dd></div>
          <div><dt>登录强度</dt><dd>${escapeHtml(actor.authStrength)}</dd></div>
          <div><dt>学校租户 ID</dt><dd class="is-id">${escapeHtml(actor.tenantSchoolId)}</dd></div>
          <div><dt>用户 ID</dt><dd class="is-id">${escapeHtml(actor.actorUserId)}</dd></div>
        </dl>
      </section>
      <section class="school-settings-section" aria-labelledby="school-catalog-title">
        <h2 id="school-catalog-title">公开目录记录</h2>
        <dl class="school-settings-facts">
          <div><dt>学校类型</dt><dd>${escapeHtml(textOrFallback(school.schoolType))}</dd></div>
          <div><dt>地区</dt><dd>${escapeHtml(textOrFallback(school.regionLabel || school.region || school.province))}</dd></div>
          <div><dt>城市</dt><dd>${escapeHtml(textOrFallback(school.cityZh || school.city))}</dd></div>
          <div><dt>来源状态</dt><dd>${escapeHtml(textOrFallback(school.sourceStatus))}</dd></div>
          <div><dt>最近核验</dt><dd>${escapeHtml(formatDate(school.lastVerifiedAt))}</dd></div>
          ${website ? `<div><dt>学校网站</dt><dd><a class="school-settings-link" href="${escapeHtml(website)}" rel="noopener noreferrer">打开</a></dd></div>` : ""}
          ${admissions ? `<div><dt>招生网站</dt><dd><a class="school-settings-link" href="${escapeHtml(admissions)}" rel="noopener noreferrer">打开</a></dd></div>` : ""}
          ${source ? `<div><dt>目录来源</dt><dd><a class="school-settings-link" href="${escapeHtml(source)}" rel="noopener noreferrer">核对来源</a></dd></div>` : ""}
        </dl>
        <p class="school-settings-note"><strong>目录治理边界</strong>名称、学校归属和核验状态不能由学校工作区直接修改。下方更正仅支持当前 API 已定义的七个公开字段。</p>
      </section>
    </div>
    ${renderCorrectionWorkspace(corrections)}`;
}

function renderError(error) {
  const root = document.querySelector("[data-school-settings-view]");
  if (!root) return;
  root.innerHTML = `<section class="school-settings-error"><h2>无法读取学校工作区</h2><p>${escapeHtml(error?.message || "学校工作区服务暂时不可用。")}</p><button class="school-settings-secondary" type="button" data-retry-school-settings>重试</button></section>`;
}

async function requireSchoolAccount() {
  const auth = await window.CUAC?.authReady?.();
  if (auth?.authState === "signed-in" && auth.role === "school_staff" && auth.tenantSchoolId) return auth;
  if (auth?.authState === "signed-out") {
    window.CUAC?.requireSignedIn?.("打开学校工作区信息", {
      requiredRole: "school_staff",
      resumeAction: { type: "navigate", href: "school-settings-api.html" },
    });
  }
  return null;
}

async function loadSchoolSettings() {
  const auth = await requireSchoolAccount();
  if (!auth) return;
  try {
    const [actor, school, corrections] = await Promise.all([
      requestJson("/api/v1/me"),
      requestJson(`/api/v1/catalog/schools/${encodeURIComponent(auth.tenantSchoolId)}`),
      requestJson("/api/v1/school/catalog-corrections"),
    ]);
    if (!isRecord(actor)
      || actor.activeRole !== "school_staff"
      || actor.tenantSchoolId !== auth.tenantSchoolId
      || typeof actor.actorUserId !== "string"
      || !isRecord(school) || school.id !== auth.tenantSchoolId
      || !isRecord(corrections) || !isRecord(corrections.school) || !Array.isArray(corrections.items)
      || corrections.school.id !== auth.tenantSchoolId
      || typeof corrections.school.updatedAt !== "string") {
      throw new SchoolSettingsRequestError("学校工作区响应与当前租户不一致。", 200, "INVALID_RESPONSE");
    }
    schoolSettingsState.corrections = corrections;
    renderSettings(actor, school, corrections);
  } catch (error) {
    renderError(error);
  }
}

function updateCorrectionField(form) {
  const corrections = schoolSettingsState.corrections;
  const field = form.elements.field?.value;
  const definition = correctionFields[field];
  if (!corrections || !definition) return;
  const output = form.querySelector("[data-current-catalog-value]");
  const value = form.elements.value;
  if (output) output.textContent = textOrFallback(corrections.school[field], "当前为空");
  if (value) {
    value.value = "";
    value.maxLength = definition.max;
    value.placeholder = definition.url ? "https://" : "填写与官方证据一致的内容";
  }
  if (form.elements.clearValue && value) {
    form.elements.clearValue.checked = false;
    value.disabled = false;
    value.required = true;
  }
}

async function submitCorrection(form) {
  if (schoolSettingsState.busy || !schoolSettingsState.corrections) return;
  const values = new FormData(form);
  const field = String(values.get("field") || "");
  const definition = correctionFields[field];
  const clearValue = values.get("clearValue") === "on";
  const proposed = String(values.get("value") || "").trim();
  if (!definition || (!clearValue && !proposed)) return;
  schoolSettingsState.busy = true;
  const button = form.querySelector("button[type=submit]");
  const note = form.querySelector("[data-school-correction-note]");
  button?.setAttribute("disabled", "");
  if (note) note.textContent = "正在提交更正。";
  try {
    await requestJson("/api/v1/school/catalog-corrections", {
      method: "POST",
      body: JSON.stringify({
        sourceSchoolUpdatedAt: schoolSettingsState.corrections.school.updatedAt,
        changes: { [field]: clearValue ? null : proposed },
        evidenceUrl: String(values.get("evidenceUrl") || "").trim(),
        reasonCode: String(values.get("reasonCode") || ""),
      }),
    });
    await loadSchoolSettings();
  } catch (error) {
    if (note) note.textContent = error?.status === 409
      ? "目录记录已更新，请刷新后重新核对当前值。"
      : error?.message || "更正提交未完成。";
  } finally {
    schoolSettingsState.busy = false;
    button?.removeAttribute("disabled");
  }
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-retry-school-settings]")) void loadSchoolSettings();
});

document.addEventListener("change", event => {
  const form = event.target.closest("[data-school-correction-form]");
  if (!form) return;
  if (event.target.name === "field") updateCorrectionField(form);
  if (event.target.name === "clearValue") {
    form.elements.value.disabled = event.target.checked;
    form.elements.value.required = !event.target.checked;
  }
});

document.addEventListener("submit", event => {
  if (!event.target.matches("[data-school-correction-form]")) return;
  event.preventDefault();
  void submitCorrection(event.target);
});

void loadSchoolSettings();
