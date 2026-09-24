const opsQueueLabels = {
  auth_email_delivery: "账户邮件投递",
  notification_delivery: "通知投递",
  student_file_processing: "学生文件处理",
  official_submission_delivery: "正式申请投递",
  payment_reconciliation: "支付对账",
};

const opsQueueAvailability = {
  auth_email_delivery: { label: "运行中", tone: "active", copy: "账户邮件后台队列。" },
  notification_delivery: { label: "运行中", tone: "active", copy: "站内通知后台队列。" },
  student_file_processing: { label: "当前版本未启用", tone: "inactive", copy: "学生暂不在 CUAC 提交申请材料。" },
  official_submission_delivery: { label: "受控运行", tone: "controlled", copy: "仅对已隔离的学校投递记录开放人工复核。" },
  payment_reconciliation: { label: "接口保留", tone: "inactive", copy: "付款接口已保留，当前版本暂不启用。" },
};

const opsQualityEndpoint = "/api/v1/ops/data-quality/catalog?limit=50";
const opsReadinessEndpoint = "/api/v1/ops/catalog/readiness";
const opsReleaseManifestEndpoint = "/api/v1/ops/catalog/release-manifests";

const opsIssueLabels = {
  missing_source_evidence: "缺少来源证据",
  invalid_source_url: "来源链接无效",
  unverified: "尚未验证",
  stale: "验证已过期",
  disputed: "来源有争议",
  verification_metadata_missing: "验证元数据不完整",
};

const opsReviewLabels = {
  investigating: "调查中",
  escalated: "已升级",
  closed_no_retry: "已关闭，不重试",
  retry_approved: "已批准重试",
  resolved_no_change: "已复核，不改业务状态",
  verified: "来源已确认",
  disputed: "已标记争议",
  closed_no_change: "已关闭，不改目录记录",
  submitted: "等待认领",
  claimed: "等待独立复核",
  applied: "已发布，等待重新核验",
  rejected: "未采纳",
  draft: "草稿",
  approved: "已批准",
  active: "已发布",
  withdrawn: "已撤回",
  legacy_published: "迁移前公开版本",
};

const readinessReasonLabels = {
  archived: "记录已归档", invalid_source_url: "官方来源地址无效", missing_source_label: "缺少来源名称",
  missing_source_evidence: "缺少与当前来源匹配的证据", missing_school_type: "缺少学校类型",
  invalid_website_url: "学校官网地址无效", invalid_admissions_url: "招生官网地址无效", inactive_city: "关联城市未发布",
  missing_teaching_language: "缺少授课语言", invalid_application_url: "项目申请地址无效", inactive_school: "关联学校未发布",
  missing_coverage: "缺少资助范围", missing_applicable_degree: "缺少适用学历", deadline_unavailable: "没有可用申请截止信息",
  inactive_program: "关联项目未发布或归属不一致", draft_record: "当前仍是草稿", verification_not_current: "当前版本尚未验证",
  review_due: "来源复核已到期", deadline_expiring_30d: "奖学金将在 30 天内截止", rolling_deadline_only: "仅提供滚动截止说明",
};

const releaseDriftLabels = { entity_missing: "目录记录已不存在", version_changed: "记录版本已变化",
  readiness_blocked: "当前已不满足发布门禁", warnings_changed: "预检提醒发生变化" };

const correctionFieldLabels = {
  websiteUrl: "学校网站",
  admissionsUrl: "招生网站",
  applicationLevel: "申请层级",
  languageOfInstruction: "授课语言",
  deadlineSummary: "截止日期摘要",
  tuitionSummary: "学费摘要",
  applicationFee: "申请费",
};

const correctionReasonLabels = {
  official_website_changed: "官网信息已更新",
  admissions_route_changed: "招生入口已更新",
  fee_information_changed: "费用信息已更新",
  language_information_changed: "授课语言信息已更新",
  outdated_public_information: "公开信息已经过时",
};

const opsActionCodes = {
  routingEscalate: [
    ["provider_receipt_investigation", "核查提供方回执"],
    ["payload_integrity_investigation", "核查载荷完整性"],
    ["delivery_attempts_exhausted", "投递尝试已耗尽"],
    ["security_investigation_required", "需要安全调查"],
  ],
  routingClose: [
    ["provider_acceptance_uncertain_no_retry", "提供方接收不确定，关闭且不重试"],
    ["payload_rebuild_required_no_retry", "需要重建载荷，关闭且不重试"],
    ["policy_evidence_invalid_no_retry", "政策证据无效，关闭且不重试"],
    ["duplicate_risk_unresolved_no_retry", "重复风险未消除，关闭且不重试"],
  ],
  billingEscalate: [
    ["provider_investigation_required", "需要提供方调查"],
    ["finance_approval_required", "需要财务审批"],
    ["security_investigation_required", "需要安全调查"],
    ["internal_data_repair_required", "需要内部数据修复"],
  ],
  billingResolve: [
    ["provider_confirmed_no_change", "提供方确认，不改业务状态"],
    ["duplicate_event_no_change", "重复事件，不改业务状态"],
    ["invalid_event_no_change", "无效事件，不改业务状态"],
    ["superseded_by_provider_case", "由提供方案件接管"],
  ],
  qualityEscalate: [
    ["source_owner_confirmation_required", "需要来源所有方确认"],
    ["conflicting_official_sources", "官方来源相互冲突"],
    ["legal_or_policy_review_required", "需要法律或政策复核"],
    ["suspected_source_tampering", "疑似来源篡改"],
  ],
  qualityResolve: [
    ["source_confirmed", "确认当前来源"],
    ["source_conflict_confirmed", "确认来源冲突"],
    ["source_invalid", "确认来源无效"],
    ["source_evidence_required_no_change", "缺少证据，关闭且不改记录"],
  ],
  correctionResolve: [
    ["applied_unverified", "发布更正并标记为未验证"],
    ["rejected_duplicate", "拒绝：重复提交"],
    ["rejected_unverifiable", "拒绝：证据无法核验"],
    ["rejected_out_of_scope", "拒绝：超出可更正范围"],
  ],
};

const opsState = {
  role: null,
  authStrength: "session",
  view: "overview",
  busy: false,
  supportSession: null,
  supportProjection: null,
  qualityCursors: [null],
  qualityPageIndex: 0,
  qualityNextCursor: null,
  catalogEntity: "city",
  selectedCityId: null,
  selectedSchoolId: null,
  selectedProgramId: null,
  selectedScholarshipId: null,
  catalogQuery: "",
  catalogStatus: "",
  readinessEntityType: "",
  readinessStatus: "",
  readinessState: "",
  readinessReason: "",
  readinessQuery: "",
  releaseSelection: new Map(),
  selectedReleaseManifestId: null,
  releaseManifestStatus: "",
  selectedGuideId: null,
};

const opsApplicationSetLabels = {
  draft: "准备中",
  submitted: "已发送学校基础信息",
  locked: "已锁定",
};

const opsSchoolProgressLabels = {
  new: "学校已收到基础信息",
  needs_review: "学校审核中",
  contact_queued: "学校准备联系学生",
  contacted: "学校已联系学生",
  waiting_for_documents: "等待学生向学校直交材料",
  documents_received_by_school: "学校已收到直交材料",
  not_a_fit: "学校标记为不适合",
  converted_to_official_application: "已转学校正式申请",
  archived: "学校已关闭记录",
};

const opsSubmissionLabels = {
  accepted: "正式提交已接受",
  processing: "正式投递处理中",
  completed: "正式投递已完成",
  failed: "正式投递失败",
};

class OpsRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "OpsRequestError";
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatDateTime(value, fallback = "时间未提供") {
  if (value === null || value === undefined || value === "") return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function formatMoney(amountMinor, currency) {
  if (!Number.isSafeInteger(amountMinor) || !/^[A-Z]{3}$/.test(currency || "")) return "金额不可用";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency", currency, currencyDisplay: "code",
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function shortId(value) {
  const text = cleanText(value);
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || "未提供";
}

function statusBadge(status, danger = false) {
  const label = opsReviewLabels[status] || cleanText(status).replaceAll("_", " ") || "未认领";
  const className = danger ? " is-danger" : ["escalated", "disputed"].includes(status) ? " is-warning" : "";
  return `<span class="ops-badge${className}">${escapeHtml(label)}</span>`;
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new OpsRequestError(
      payload?.error?.message || "运营请求未完成。",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
    );
  }
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new OpsRequestError("运营响应缺少数据封装。", response.status, "INVALID_RESPONSE");
  }
  return payload.data;
}

let opsToastTimer;
function showOpsToast(message) {
  const root = document.querySelector("[data-ops-toast]");
  if (!root) return;
  root.textContent = message;
  root.hidden = false;
  clearTimeout(opsToastTimer);
  opsToastTimer = setTimeout(() => { root.hidden = true; }, 4200);
}

function showOpsError(error) {
  const root = document.querySelector("[data-ops-view]");
  if (!root) return;
  const message = error?.status === 403
    ? "当前员工授权、角色或二次验证不满足这项操作。"
    : cleanText(error?.message) || "当前模块暂时不可用。";
  root.innerHTML = `<div class="ops-error"><span class="ops-kicker">读取失败</span><h2>无法打开当前运营模块</h2><p>${escapeHtml(message)}</p></div>`;
}

function sectionHeading(title, copy, generatedAt = null) {
  return `<header class="ops-section-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div>${generatedAt
    ? `<time datetime="${escapeHtml(generatedAt)}">生成于 ${escapeHtml(formatDateTime(generatedAt))}</time>` : ""}</header>`;
}

function renderLoading() {
  const root = document.querySelector("[data-ops-view]");
  if (root) root.innerHTML = '<p class="ops-state" aria-busy="true">正在读取当前模块。</p>';
}

function hasStepUpAdminAuthority() {
  return opsState.role === "cuac_admin" && opsState.authStrength === "step_up";
}

function renderAuthCapability() {
  const root = document.querySelector("[data-ops-capability]");
  if (!root) return;
  if (hasStepUpAdminAuthority()) {
    root.innerHTML = '<span class="ops-capability-badge is-ready">已完成二次验证</span><small>可在满足双人复核条件时提交最终结论。</small>';
    return;
  }
  if (opsState.role !== "cuac_admin") {
    root.innerHTML = '<span class="ops-capability-badge">运营复核权限</span><small>可以读取、认领和升级；最终结论需由完成二次验证的管理员提交。</small>';
    return;
  }
  root.innerHTML = `<span class="ops-capability-badge is-warning">最终操作已锁定</span>
    <small>读取、认领和升级可继续；提交最终结论前需要验证管理员密码和身份验证器。</small>
    <form class="ops-step-up-form" data-ops-step-up>
      <label><span>管理员密码</span><input name="password" type="password" autocomplete="current-password" required /></label>
      <label><span>6 位动态验证码</span><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label>
      <button class="ops-button" type="submit">完成二次验证</button>
    </form>`;
}

function validatePagedQueue(data, key) {
  if (!isRecord(data) || !Array.isArray(data.items)
    || !(data.nextCursor === null || typeof data.nextCursor === "string" || isRecord(data.nextCursor))) {
    throw new OpsRequestError(`${key}队列不符合前端数据契约。`, 503, "INVALID_RESPONSE");
  }
  return data;
}

function renderOverview(summary) {
  const root = document.querySelector("[data-ops-view]");
  const expectedKeys = Object.keys(opsQueueLabels);
  if (!root || !isRecord(summary) || summary.schemaVersion !== 1 || !isRecord(summary.totals)
    || !Array.isArray(summary.queues) || summary.queues.length !== expectedKeys.length
    || summary.queues.some((row, index) => !isRecord(row) || row.queueKey !== expectedKeys[index])) {
    throw new OpsRequestError("运营摘要不符合固定注册表契约。", 503, "INVALID_RESPONSE");
  }
  const totals = summary.totals;
  const pressure = [...summary.queues].sort((a, b) => (
    (Number(b.exceptionsLast24Hours) * 10 + Number(b.expiredLeaseCount) * 5 + Number(b.dueCount))
    - (Number(a.exceptionsLast24Hours) * 10 + Number(a.expiredLeaseCount) * 5 + Number(a.dueCount))
  ));
  const actionView = queueKey => queueKey === "official_submission_delivery" ? "routing"
    : queueKey === "payment_reconciliation" ? "billing" : "";
  root.innerHTML = `
    ${sectionHeading("今日运营压力", "先处理影响学生申请和学校可见性的异常；技术管道明细保留在下方。", summary.generatedAt)}
    <div class="ops-metrics" aria-label="运营队列合计">
      <div class="ops-metric"><span>需要处理</span><strong>${escapeHtml(totals.dueCount)}</strong><small>当前已到期任务</small></div>
      <div class="ops-metric"><span>正在处理</span><strong>${escapeHtml(totals.inFlightCount)}</strong><small>已被工作人员或任务认领</small></div>
      <div class="ops-metric ${Number(totals.exceptionsLast24Hours) ? "is-danger" : ""}"><span>24 小时异常</span><strong>${escapeHtml(totals.exceptionsLast24Hours)}</strong><small>优先核对业务影响</small></div>
      <div class="ops-metric ${Number(totals.expiredLeaseCount) ? "is-warning" : ""}"><span>处理超时</span><strong>${escapeHtml(totals.expiredLeaseCount)}</strong><small>后台任务未按时完成</small></div>
    </div>
    <section class="ops-priority-section" aria-labelledby="ops-priority-title">
      <div class="ops-priority-heading"><div><span class="ops-kicker">优先队列</span><h3 id="ops-priority-title">按业务风险排序</h3></div><p>异常、处理超时和到期任务会排在前面。</p></div>
      <div class="ops-priority-grid">${pressure.map(row => {
        const view = actionView(row.queueKey);
        const availability = opsQueueAvailability[row.queueKey];
        const risk = Number(row.exceptionsLast24Hours) ? "异常需要核查"
          : Number(row.expiredLeaseCount) ? "存在处理超时"
            : Number(row.dueCount) ? "有到期任务" : "当前稳定";
        return `<article class="ops-priority-card ${Number(row.exceptionsLast24Hours) ? "is-danger" : Number(row.expiredLeaseCount) ? "is-warning" : ""}">
          <div><span class="ops-record-id">${escapeHtml(row.queueKey)}</span><h4>${escapeHtml(opsQueueLabels[row.queueKey])}</h4>
          <span class="ops-availability is-${escapeHtml(availability.tone)}">${escapeHtml(availability.label)}</span>
          <p>${escapeHtml(risk)} · ${escapeHtml(availability.copy)}</p></div>
          <dl><div><dt>到期</dt><dd>${escapeHtml(row.dueCount)}</dd></div><div><dt>异常</dt><dd>${escapeHtml(row.exceptionsLast24Hours)}</dd></div></dl>
          ${view ? `<button class="ops-button primary" type="button" data-ops-open-view="${view}">进入复核</button>` : '<button class="ops-button" type="button" data-ops-refresh>刷新状态</button>'}
        </article>`;
      }).join("")}</div>
    </section>
    <details class="ops-technical-summary">
      <summary>查看技术管道明细</summary>
      <div class="ops-table-wrap">
        <table class="ops-table">
          <thead><tr><th>管道</th><th>到期</th><th>处理中</th><th>处理超时</th><th>24 小时异常</th><th>最早到期</th></tr></thead>
          <tbody>${summary.queues.map(row => `<tr>
            <td><strong>${escapeHtml(opsQueueLabels[row.queueKey])}</strong><span>${escapeHtml(row.queueKey)} · ${escapeHtml(opsQueueAvailability[row.queueKey].label)}</span></td>
            <td>${escapeHtml(row.dueCount)}</td><td>${escapeHtml(row.inFlightCount)}</td>
            <td>${escapeHtml(row.expiredLeaseCount)}</td><td>${escapeHtml(row.exceptionsLast24Hours)}</td>
            <td>${escapeHtml(row.oldestDueAt ? formatDateTime(row.oldestDueAt) : "无到期任务")}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    </details>`;
}

function codeOptions(items) {
  return items.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function referenceField() {
  return '<label><span>证据引用</span><input name="reference" maxlength="128" pattern="[A-Za-z0-9._:-]{1,128}" autocomplete="off" required /></label>';
}

function actionForm({ kind, target, action, revision, label, codes, danger = false, dueDate = false, privileged = false }) {
  const locked = privileged && !hasStepUpAdminAuthority();
  return `<form class="ops-action-form" data-ops-action-form data-kind="${escapeHtml(kind)}" data-target="${escapeHtml(target)}"
      data-action="${escapeHtml(action)}" data-revision="${escapeHtml(revision)}">
    <label><span>处理结论</span><select name="code" required>${codeOptions(codes)}</select></label>
    ${referenceField()}
    ${dueDate ? '<label data-review-due><span>下次复核时间</span><input name="reviewDueAt" type="datetime-local" /></label>' : ""}
    <button class="ops-button ${danger ? "danger" : ""}" type="submit"${locked ? ' disabled title="需要完成管理员二次验证"' : ""}>${escapeHtml(locked ? `${label}（需二次验证）` : label)}</button>
  </form>`;
}

function claimButton(kind, target, revision = 0) {
  return `<form data-ops-action-form data-kind="${escapeHtml(kind)}" data-target="${escapeHtml(target)}" data-action="claim" data-revision="${escapeHtml(revision)}">
    <button class="ops-button primary" type="submit">认领复核</button>
  </form>`;
}

function renderReviewControls(kind, target, review, options = {}) {
  if (!review) return `<div class="ops-record-actions">${claimButton(kind, target)}</div>`;
  const open = ["investigating", "escalated"].includes(review.status);
  const forms = [];
  if (review.status === "investigating" && options.escalate) {
    forms.push(actionForm({ kind, target, action: "escalate", revision: review.revision,
      label: "升级复核", codes: options.escalate }));
  }
  if (open && options.resolve) {
    forms.push(actionForm({ kind, target, action: "resolve", revision: review.revision,
      label: options.resolveLabel || "提交复核结论", codes: options.resolve, danger: true, dueDate: options.dueDate, privileged: true }));
  }
  if (open && options.retry) {
    forms.push(actionForm({ kind, target, action: "retry", revision: review.revision,
      label: "批准单次重试", codes: [["provider_not_accepted_retry_approved", "确认提供方未接收，批准单次重试"]], danger: true, privileged: true }));
  }
  return `<div class="ops-record-actions">
    <div class="ops-review-state">${statusBadge(review.status)}<span>修订 ${escapeHtml(review.revision)}</span><span>认领角色 ${escapeHtml(review.assignedRole)}</span></div>
    ${forms.length ? `<div class="ops-action-grid">${forms.join("")}</div>` : '<p class="ops-state">这条复核已结束。</p>'}
  </div>`;
}

function renderRouting(data) {
  const root = document.querySelector("[data-ops-view]");
  const queue = validatePagedQueue(data, "投递复核");
  if (!root || queue.items.some(item => !isRecord(item) || typeof item.outboxId !== "string"
    || typeof item.schoolNameEn !== "string" || typeof item.errorCode !== "string")) {
    throw new OpsRequestError("投递复核队列不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  root.innerHTML = `${sectionHeading("正式申请投递复核", "仅处理后端已隔离的投递记录；未知回执和无效载荷不能在此重建或改道。")}
    <div class="ops-record-list">${queue.items.length ? queue.items.map(item => `
      <article class="ops-record">
        <div class="ops-record-summary">
          <div><span class="ops-record-id">${escapeHtml(item.outboxId)}</span><h3>${escapeHtml(item.schoolNameEn)}</h3>
          <p>${escapeHtml(item.errorCode)} · ${escapeHtml(item.outcome)}</p></div>
          ${statusBadge(item.review?.status || "unclaimed", true)}
        </div>
        <div class="ops-record-meta">
          <div><span>投递通道</span><strong>${escapeHtml(item.externalChannelType)}</strong></div>
          <div><span>路由键</span><strong>${escapeHtml(item.admissionRouteKey)}</strong></div>
          <div><span>尝试 / 成员</span><strong>${escapeHtml(item.attemptCount)} / ${escapeHtml(item.memberCount)}</strong></div>
          <div><span>隔离时间</span><strong>${escapeHtml(formatDateTime(item.quarantinedAt))}</strong></div>
        </div>
        ${renderReviewControls("routing", item.outboxId, item.review, {
          escalate: opsActionCodes.routingEscalate,
          resolve: opsActionCodes.routingClose,
          resolveLabel: "关闭且不重试",
          retry: item.retryEligible,
        })}
      </article>`).join("") : '<p class="ops-state">当前没有隔离的正式申请投递。</p>'}</div>`;
}

function renderBilling(data) {
  const root = document.querySelector("[data-ops-view]");
  const queue = validatePagedQueue(data, "支付复核");
  if (!root || queue.items.some(item => !isRecord(item) || typeof item.eventId !== "string"
    || typeof item.providerEventId !== "string" || typeof item.quarantineReason !== "string")) {
    throw new OpsRequestError("支付复核队列不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  root.innerHTML = `${sectionHeading("支付事件复核（接口保留）", "当前版本暂不启用付款；这里保留隔离事件复核能力，不提供退款、改价或直接修改支付状态。")}
    <div class="ops-record-list">${queue.items.length ? queue.items.map(item => `
      <article class="ops-record">
        <div class="ops-record-summary">
          <div><span class="ops-record-id">${escapeHtml(item.eventId)}</span><h3>${escapeHtml(item.eventType)}</h3>
          <p>${escapeHtml(item.quarantineReason)}</p></div>
          ${statusBadge(item.review?.status || "unclaimed", true)}
        </div>
        <div class="ops-record-meta">
          <div><span>金额</span><strong>${escapeHtml(formatMoney(item.amountMinor, item.currency))}</strong></div>
          <div><span>提供方事件</span><strong>${escapeHtml(shortId(item.providerEventId))}</strong></div>
          <div><span>账单</span><strong>${escapeHtml(shortId(item.invoiceId))}</strong></div>
          <div><span>隔离时间</span><strong>${escapeHtml(formatDateTime(item.quarantinedAt))}</strong></div>
        </div>
        ${renderReviewControls("billing", item.eventId, item.review, {
          escalate: opsActionCodes.billingEscalate,
          resolve: opsActionCodes.billingResolve,
        })}
      </article>`).join("") : '<p class="ops-state">当前没有隔离的支付事件。</p>'}</div>`;
}

function safeSourceLink(evidence) {
  if (!isRecord(evidence) || !cleanText(evidence.sourceUrl)) return "未提供来源链接";
  try {
    const url = new URL(evidence.sourceUrl);
    if (url.protocol !== "https:") return "来源链接不可用";
    const thirdParty = /(^|\.)cscapilot\.com$/i.test(url.hostname);
    return `<a class="ops-source-link" href="${escapeHtml(url.href)}" target="_blank" rel="noreferrer">查看来源证据</a>${thirdParty
      ? '<span class="ops-source-warning">第三方来源，不能作为官方确认依据</span>' : ""}`;
  } catch {
    return "来源链接不可用";
  }
}

function renderQualityPagination(queue) {
  opsState.qualityNextCursor = queue.nextCursor;
  const page = opsState.qualityPageIndex + 1;
  return `<nav class="ops-pagination" aria-label="数据质量分页">
    <span>第 ${escapeHtml(page)} 页 · 本页 ${escapeHtml(queue.items.length)} 条</span>
    <div>
      <button class="ops-button" type="button" data-quality-page="previous"${page === 1 ? " disabled" : ""}>上一页</button>
      <button class="ops-button" type="button" data-quality-page="next"${queue.nextCursor ? "" : " disabled"}>下一页</button>
    </div>
  </nav>`;
}

function renderQuality(data) {
  const root = document.querySelector("[data-ops-view]");
  const queue = validatePagedQueue(data, "数据质量");
  if (!root || queue.items.some(item => !isRecord(item) || typeof item.entityId !== "string"
    || !["city", "school", "program", "scholarship"].includes(item.entityType)
    || typeof item.label !== "string" || typeof item.issueCode !== "string")) {
    throw new OpsRequestError("数据质量队列不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  root.innerHTML = `${sectionHeading("目录数据质量", "复核城市、学校、项目和奖学金的来源证据；这里不能编辑公开目录字段。")}
    <div class="ops-record-list">${queue.items.length ? queue.items.map(item => `
      <article class="ops-record">
        <div class="ops-record-summary">
          <div><span class="ops-record-id">${escapeHtml(item.entityType)} · ${escapeHtml(item.entityId)}</span>
          <h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(opsIssueLabels[item.issueCode] || item.issueCode)}</p></div>
          ${statusBadge(item.review?.status || item.verificationStatus, item.verificationStatus === "invalid")}
        </div>
        <div class="ops-record-meta">
          <div><span>验证状态</span><strong>${escapeHtml(item.verificationStatus)}</strong></div>
          <div><span>上次验证</span><strong>${escapeHtml(formatDateTime(item.lastVerifiedAt, "尚未验证"))}</strong></div>
          <div><span>下次复核</span><strong>${escapeHtml(formatDateTime(item.nextReviewDueAt, "未安排"))}</strong></div>
          <div><span>来源证据</span><strong>${safeSourceLink(item.evidence)}</strong></div>
        </div>
        ${renderReviewControls("quality", `${item.entityType}:${item.entityId}`, item.review, {
          escalate: opsActionCodes.qualityEscalate,
          resolve: opsActionCodes.qualityResolve,
          dueDate: true,
        })}
      </article>`).join("") : '<p class="ops-state">当前没有待复核的目录来源记录。</p>'}</div>
    ${renderQualityPagination(queue)}`;
}

function readinessRequestPath() {
  const params = new URLSearchParams({ limit: "100" });
  if (opsState.readinessEntityType) params.set("entityType", opsState.readinessEntityType);
  if (opsState.readinessStatus) params.set("status", opsState.readinessStatus);
  if (opsState.readinessState) params.set("readiness", opsState.readinessState);
  if (opsState.readinessReason) params.set("reason", opsState.readinessReason);
  if (opsState.readinessQuery) params.set("query", opsState.readinessQuery);
  return `${opsReadinessEndpoint}?${params}`;
}

function releaseSelectionPanel() {
  const items = [...opsState.releaseSelection.values()];
  return `<section class="ops-priority-section" data-release-selection-panel>
    <div class="ops-priority-heading"><div><span class="ops-kicker">发布清单</span><h3>已选择 ${escapeHtml(items.length)} 条预检通过记录</h3></div>
      <p>清单只冻结版本和预检结果，不会发布或修改目录。</p></div>
    ${items.length ? `<div class="ops-chip-row">${items.map(item => `<span class="ops-badge">${escapeHtml(item.label)} · v${escapeHtml(item.expectedVersion)}</span>`).join("")}</div>
      <form class="ops-action-form" data-release-manifest-create><label><span>清单名称</span><input name="title" maxlength="200" required placeholder="例如：2027 秋季第一批"></label>
        <button class="ops-button primary" type="submit">冻结为发布计划</button></form>`
      : '<p class="ops-state compact">在下方勾选通过预检的记录后，可以创建不可变发布计划。</p>'}
  </section>`;
}

function refreshReleaseSelectionPanel() {
  const panel = document.querySelector("[data-release-selection-panel]");
  if (panel) panel.outerHTML = releaseSelectionPanel();
}

function renderReadiness(data) {
  const root = document.querySelector("[data-ops-view]");
  if (!root || !isRecord(data) || !Array.isArray(data.items) || !isRecord(data.summary)
    || !isRecord(data.summary.byEntityType) || !isRecord(data.summary.issueCounts)
    || data.items.some(item => !isRecord(item) || !["city","school","program","scholarship"].includes(item.entityType)
      || typeof item.entityId !== "string" || typeof item.label !== "string" || typeof item.ready !== "boolean"
      || !Array.isArray(item.blockingReasons) || !Array.isArray(item.warningReasons))) {
    throw new OpsRequestError("目录发布预检响应不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  const summary = data.summary;
  const entityLabels = { city: "城市", school: "学校", program: "项目", scholarship: "奖学金" };
  const issueOptions = Object.keys(summary.issueCounts).sort((a,b) => Number(summary.issueCounts[b])-Number(summary.issueCounts[a]));
  root.innerHTML = `${sectionHeading("目录发布预检", "只读检查城市、学校、项目和奖学金的正式发布门禁；这里不会自动发布或修改任何数据。", summary.generatedAt)}
    <div class="ops-metrics" aria-label="目录发布准备度合计">
      <div class="ops-metric"><span>全部记录</span><strong>${escapeHtml(summary.total)}</strong><small>四类目录主数据</small></div>
      <div class="ops-metric"><span>通过发布门禁</span><strong>${escapeHtml(summary.ready)}</strong><small>可进入管理员发布操作</small></div>
      <div class="ops-metric ${Number(summary.blocked) ? "is-danger" : ""}"><span>存在阻塞</span><strong>${escapeHtml(summary.blocked)}</strong><small>需先补字段、证据或关联</small></div>
    </div>
    <div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>目录类型</th><th>总数</th><th>通过</th><th>阻塞</th></tr></thead><tbody>
      ${Object.entries(entityLabels).map(([type,label]) => { const item=summary.byEntityType[type] || { total:0,ready:0,blocked:0 }; return `<tr>
        <td><strong>${escapeHtml(label)}</strong><span>${escapeHtml(type)}</span></td><td>${escapeHtml(item.total)}</td><td>${escapeHtml(item.ready)}</td><td>${escapeHtml(item.blocked)}</td></tr>`; }).join("")}
    </tbody></table></div>${releaseSelectionPanel()}
    <div class="ops-catalog-toolbar"><form data-readiness-filter><label>查找记录<input name="query" value="${escapeHtml(opsState.readinessQuery)}" placeholder="名称或 slug"></label>
      <label>类型<select name="entityType"><option value="">全部</option>${Object.entries(entityLabels).map(([value,label]) => `<option value="${value}"${opsState.readinessEntityType===value?" selected":""}>${label}</option>`).join("")}</select></label>
      <label>目录状态<select name="status"><option value="">全部</option>${[["active","已发布"],["draft","草稿"],["archived","已归档"]].map(([value,label]) => `<option value="${value}"${opsState.readinessStatus===value?" selected":""}>${label}</option>`).join("")}</select></label>
      <label>预检结果<select name="readiness"><option value="">全部</option><option value="ready"${opsState.readinessState==="ready"?" selected":""}>通过</option><option value="blocked"${opsState.readinessState==="blocked"?" selected":""}>阻塞</option></select></label>
      <label>问题<select name="reason"><option value="">全部</option>${issueOptions.map(code => `<option value="${escapeHtml(code)}"${opsState.readinessReason===code?" selected":""}>${escapeHtml(readinessReasonLabels[code]||code)}（${escapeHtml(summary.issueCounts[code])}）</option>`).join("")}</select></label>
      <button class="ops-button" type="submit">筛选</button></form></div>
    <p class="ops-state compact">筛选结果 ${escapeHtml(data.total)} 条。本页最多展示 100 条；正式发布仍需进入目录记录并由完成二次验证的管理员执行。</p>
    <div class="ops-record-list">${data.items.length ? data.items.map(item => `<article class="ops-record">
      <div class="ops-record-summary"><div><span class="ops-record-id">${escapeHtml(entityLabels[item.entityType])} · ${escapeHtml(item.slug)} · v${escapeHtml(item.version)}</span>
        <h3>${escapeHtml(item.label)}</h3><p>${item.ready ? "已通过当前发布门禁" : `存在 ${escapeHtml(item.blockingReasons.length)} 项发布阻塞`}</p></div>
        <div>${item.ready ? `<label class="ops-badge"><input type="checkbox" data-release-select="${escapeHtml(item.entityType)}:${escapeHtml(item.entityId)}"
          data-entity-type="${escapeHtml(item.entityType)}" data-entity-id="${escapeHtml(item.entityId)}" data-version="${escapeHtml(item.version)}"
          data-label="${escapeHtml(item.label)}"${opsState.releaseSelection.has(`${item.entityType}:${item.entityId}`) ? " checked" : ""}> 加入计划</label>` : ""}
          <span class="ops-badge${item.ready ? "" : " is-danger"}">${item.ready ? "预检通过" : "发布阻塞"}</span></div></div>
      <div class="ops-chip-row">${item.blockingReasons.map(code => `<span class="ops-badge is-danger">${escapeHtml(readinessReasonLabels[code]||code)}</span>`).join("")}
        ${item.warningReasons.map(code => `<span class="ops-badge is-warning">${escapeHtml(readinessReasonLabels[code]||code)}</span>`).join("")}</div>
      <div class="ops-record-meta"><div><span>目录状态</span><strong>${escapeHtml(cityStatusLabel(item.status))}</strong></div>
        <div><span>验证状态</span><strong>${escapeHtml(cityVerificationLabel(item.verificationStatus))}</strong></div>
        <div><span>下次复核</span><strong>${escapeHtml(formatDateTime(item.nextReviewDueAt,"未安排"))}</strong></div>
        <div><span>最近更新</span><strong>${escapeHtml(formatDateTime(item.updatedAt))}</strong></div></div>
      <button class="ops-button" type="button" data-readiness-open="${escapeHtml(item.entityType)}" data-readiness-id="${escapeHtml(item.entityId)}">进入目录记录</button>
    </article>`).join("") : '<p class="ops-state">没有符合当前筛选条件的目录记录。</p>'}</div>`;
}

function renderReleasePlans(data, detail) {
  const root = document.querySelector("[data-ops-view]");
  if (!root || !isRecord(data) || !Array.isArray(data.items)
    || data.items.some(item => !isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string"
      || !["frozen","superseded"].includes(item.status) || typeof item.itemCount !== "number")) {
    throw new OpsRequestError("发布计划响应不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  const selected = opsState.selectedReleaseManifestId;
  const statusLabel = value => value === "frozen" ? "已冻结" : "已作废";
  let detailHtml = '<section class="ops-city-editor"><p class="ops-state">选择一份发布计划查看冻结版本和当前漂移情况。</p></section>';
  if (detail) {
    if (!isRecord(detail.manifest) || !Array.isArray(detail.items)) throw new OpsRequestError("发布计划详情响应无效。",503,"INVALID_RESPONSE");
    const manifest = detail.manifest;
    detailHtml = `<section class="ops-city-editor"><div class="ops-city-editor-heading"><div><span class="ops-record-id">版本 ${escapeHtml(manifest.version)} · ${escapeHtml(shortId(manifest.id))}</span>
      <h3>${escapeHtml(manifest.title)}</h3><p>选择摘要：${escapeHtml(manifest.selectionSha256)}</p></div>
      <div class="ops-chip-row"><span class="ops-badge">${escapeHtml(statusLabel(manifest.status))}</span>
        <span class="ops-badge${manifest.driftedItemCount ? " is-warning" : ""}">${escapeHtml(manifest.driftedItemCount)} 条发生漂移</span></div></div>
      <p class="ops-state compact">创建于 ${escapeHtml(formatDateTime(manifest.createdAt))}。该清单不可编辑、不可删除，也不会自动发布任何记录。</p>
      <div class="ops-record-list">${detail.items.map(item => `<article class="ops-record"><div class="ops-record-summary"><div>
        <span class="ops-record-id">${escapeHtml(item.entityType)} · ${escapeHtml(item.slug)} · 冻结 v${escapeHtml(item.entityVersion)}</span><h3>${escapeHtml(item.label)}</h3>
        <p>冻结时间 ${escapeHtml(formatDateTime(item.readinessSnapshot.capturedAt))}</p></div>
        <span class="ops-badge${item.driftReasons.length ? " is-warning" : ""}">${item.driftReasons.length ? "状态已漂移" : "与冻结状态一致"}</span></div>
        <div class="ops-chip-row">${item.driftReasons.map(code => `<span class="ops-badge is-warning">${escapeHtml(releaseDriftLabels[code]||code)}</span>`).join("")}
          ${(item.readinessSnapshot.warningReasons||[]).map(code => `<span class="ops-badge">冻结提醒：${escapeHtml(readinessReasonLabels[code]||code)}</span>`).join("")}</div>
        <button class="ops-button" type="button" data-readiness-open="${escapeHtml(item.entityType)}" data-readiness-id="${escapeHtml(item.entityId)}">打开当前目录记录</button>
      </article>`).join("")}</div>
      ${manifest.status === "frozen" ? `<form data-release-manifest-supersede data-manifest-id="${escapeHtml(manifest.id)}" data-version="${escapeHtml(manifest.version)}">
        <button class="ops-button danger" type="submit">作废这份计划</button><small>作废只关闭计划，不会归档或修改目录记录。</small></form>` : ""}
    </section>`;
  }
  root.innerHTML = `${sectionHeading("发布计划", "冻结一组已通过预检的目录版本，跟踪后续漂移；正式发布仍需逐条完成管理员操作。")}
    <div class="ops-catalog-toolbar"><form data-release-manifest-filter><label>状态<select name="status"><option value="">全部</option>
      <option value="frozen"${opsState.releaseManifestStatus==="frozen"?" selected":""}>已冻结</option>
      <option value="superseded"${opsState.releaseManifestStatus==="superseded"?" selected":""}>已作废</option></select></label>
      <button class="ops-button" type="submit">筛选</button></form><button class="ops-button" type="button" data-ops-open-view="readiness">去发布预检选择记录</button></div>
    <div class="ops-catalog-layout"><aside class="ops-city-list" aria-label="发布计划"><p><strong>${escapeHtml(data.total)}</strong> 份计划</p>
      ${data.items.length ? data.items.map(item => `<button type="button" data-release-manifest-select="${escapeHtml(item.id)}" class="${selected===item.id?"active":""}">
        <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.itemCount)} 条记录 · ${escapeHtml(item.driftedItemCount)} 条漂移</small></span>
        <span>${escapeHtml(statusLabel(item.status))}<small>v${escapeHtml(item.version)}</small></span></button>`).join("") : '<p class="ops-state compact">还没有发布计划。</p>'}
    </aside>${detailHtml}</div>`;
}

async function loadReleasePlans() {
  const params = new URLSearchParams({ limit: "100" });
  if (opsState.releaseManifestStatus) params.set("status",opsState.releaseManifestStatus);
  const data = await requestJson(`${opsReleaseManifestEndpoint}?${params}`);
  if (!opsState.selectedReleaseManifestId && data.items?.length) opsState.selectedReleaseManifestId = data.items[0].id;
  const detail = opsState.selectedReleaseManifestId
    ? await requestJson(`${opsReleaseManifestEndpoint}/${encodeURIComponent(opsState.selectedReleaseManifestId)}`) : null;
  renderReleasePlans(data,detail);
}

async function submitReleaseManifest(form) {
  if (opsState.busy || !opsState.releaseSelection.size) return;
  opsState.busy = true;
  try {
    const title = cleanText(new FormData(form).get("title"));
    const detail = await requestJson(opsReleaseManifestEndpoint,{ method:"POST",body:JSON.stringify({ title,
      selections:[...opsState.releaseSelection.values()].map(item => ({ entityType:item.entityType,
        entityId:item.entityId,expectedVersion:item.expectedVersion })) }) });
    opsState.releaseSelection.clear();
    opsState.selectedReleaseManifestId = detail.manifest.id;
    showOpsToast("发布计划已冻结；目录数据没有被发布或修改。");
    await selectOpsView("release-plans");
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    showOpsToast(error?.status===409 ? "所选记录已变化或不再通过预检，请重新选择。" : error.message||"发布计划创建失败。");
  } finally { opsState.busy=false; }
}

async function supersedeReleaseManifest(form) {
  if (opsState.busy) return;
  opsState.busy=true;
  try {
    await requestJson(`${opsReleaseManifestEndpoint}/${encodeURIComponent(form.dataset.manifestId)}/supersede`,{
      method:"POST",body:JSON.stringify({ expectedVersion:Number(form.dataset.version) }) });
    showOpsToast("发布计划已作废；目录记录未发生变化。");
    await loadCurrentView();
  } catch(error) {
    if(error?.status===409) await loadCurrentView();
    showOpsToast(error.message||"发布计划作废失败。");
  } finally { opsState.busy=false; }
}

function correctionEvidenceLink(value) {
  const link = cleanText(value);
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return `<a class="ops-source-link" href="${escapeHtml(url.href)}" target="_blank" rel="noreferrer">查看官方证据</a>`;
  } catch {
    return "证据链接不可用";
  }
}

function renderCorrectionChanges(changes) {
  if (!isRecord(changes)) return "";
  return Object.entries(changes).map(([field, value]) => {
    const label = correctionFieldLabels[field];
    if (!label || !(value === null || typeof value === "string")) return "";
    return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === null ? "清除此字段" : value)}</strong></div>`;
  }).join("");
}

function renderCorrectionControls(item) {
  if (item.status === "submitted" && item.revision === 1) {
    return `<div class="ops-record-actions">${claimButton("correction", item.id, item.revision)}</div>`;
  }
  if (item.status === "claimed" && item.revision === 2) {
    return `<div class="ops-record-actions">
      <div class="ops-review-state">${statusBadge(item.status)}<span>修订 ${escapeHtml(item.revision)}</span><span>需不同 CUAC 管理员二次验证</span></div>
      ${actionForm({ kind: "correction", target: item.id, action: "resolve", revision: item.revision,
        label: "记录复核结论", codes: opsActionCodes.correctionResolve, danger: true, privileged: true })}
    </div>`;
  }
  return `<div class="ops-record-actions"><div class="ops-review-state">${statusBadge(item.status)}<span>修订 ${escapeHtml(item.revision)}</span>${item.resolutionReference
    ? `<span>处理引用 ${escapeHtml(item.resolutionReference)}</span>` : ""}</div></div>`;
}

function renderCorrections(data) {
  const root = document.querySelector("[data-ops-view]");
  if (!root || !isRecord(data) || !Array.isArray(data.items)
    || data.items.some(item => !isRecord(item) || typeof item.id !== "string"
      || typeof item.schoolId !== "string" || typeof item.schoolNameEn !== "string"
      || !isRecord(item.changes) || typeof item.evidenceUrl !== "string"
      || !["submitted", "claimed", "applied", "rejected"].includes(item.status))) {
    throw new OpsRequestError("学校更正队列不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  root.innerHTML = `${sectionHeading("学校目录更正", "核对学校提交的固定字段与官方证据。认领人与最终发布人必须不同，发布后记录会回到未验证状态。")}
    <div class="ops-record-list">${data.items.length ? data.items.map(item => `
      <article class="ops-record">
        <div class="ops-record-summary">
          <div><span class="ops-record-id">${escapeHtml(item.id)}</span><h3>${escapeHtml(item.schoolNameZh || item.schoolNameEn)}</h3>
          <p>${escapeHtml(item.schoolNameEn)} · ${escapeHtml(correctionReasonLabels[item.reasonCode] || item.reasonCode)}</p></div>
          ${statusBadge(item.status, item.status === "rejected")}
        </div>
        <div class="ops-correction-changes" aria-label="建议字段值">${renderCorrectionChanges(item.changes)}</div>
        <div class="ops-record-meta">
          <div><span>学校记录版本</span><strong>${escapeHtml(formatDateTime(item.sourceSchoolUpdatedAt))}</strong></div>
          <div><span>提交时间</span><strong>${escapeHtml(formatDateTime(item.createdAt))}</strong></div>
          <div><span>提交角色</span><strong>${escapeHtml(item.requestedMembershipRole)}</strong></div>
          <div><span>官方证据</span><strong>${correctionEvidenceLink(item.evidenceUrl)}</strong></div>
        </div>
        ${renderCorrectionControls(item)}
      </article>`).join("") : '<p class="ops-state">当前没有学校提交的目录更正。</p>'}</div>`;
}

function supportReasonOptions() {
  return [
    ["student_inquiry", "学生咨询"],
    ["school_inquiry", "学校咨询"],
    ["payment_inquiry", "支付咨询"],
    ["delivery_investigation", "投递调查"],
    ["incident_response", "事件响应"],
  ].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

function renderSupportProjection() {
  const projection = opsState.supportProjection;
  const session = opsState.supportSession;
  if (!session || !projection) {
    return '<div class="ops-support-result"><h3>未打开支持会话</h3><p class="ops-state">输入完整 CUAC ID 和固定原因后，系统会创建最长 15 分钟的审计会话。</p></div>';
  }
  const set = projection.applicationSet || {};
  const submission = projection.submission;
  const programApplications = Array.isArray(projection.programApplications) ? projection.programApplications : [];
  const schoolHandoff = programApplications.length
    ? `${programApplications.length} 个项目已确认发送`
    : "尚未发送学校基础信息";
  const rows = [
    ["Application Set 状态", opsApplicationSetLabels[set.status] || cleanText(set.status) || "状态未知"],
    ["目标入学季", set.targetIntake || "未设置"],
    ["当前修订", set.revision],
    ["当前志愿数", set.activeChoiceCount],
    ["学校基础信息交接", schoolHandoff],
    ["正式材料投递", submission
      ? opsSubmissionLabels[submission.status] || cleanText(submission.status) || "状态未知"
      : "未创建（当前版本不在 CUAC 提交材料）"],
    ["正式投递：待处理 / 已投递 / 已隔离", submission
      ? `${submission.pendingGroupCount} / ${submission.dispatchedGroupCount} / ${submission.quarantinedGroupCount}` : "不适用"],
  ];
  return `<div class="ops-support-result">
    <div class="ops-support-session"><div><h3>${escapeHtml(projection.cuacId)}</h3>
      <span>会话到期：${escapeHtml(formatDateTime(session.expiresAt))}</span></div>
      <button class="ops-button danger" type="button" data-close-support>结束支持会话</button>
    </div>
    <dl class="ops-definition-list">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
    <div class="ops-programs"><h4>项目申请</h4>
      ${programApplications.length
        ? `<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>学校 / 项目</th><th>入学季</th><th>学校流程状态</th><th>学校确认接收</th></tr></thead><tbody>
          ${programApplications.map(item => `<tr><td><strong>${escapeHtml(item.schoolName)}</strong><span>${escapeHtml(item.programName || "项目未绑定")}</span></td>
          <td>${escapeHtml(item.intakeTerm && item.intakeYear ? `${item.intakeTerm} ${item.intakeYear}` : "未绑定")}</td>
          <td>${escapeHtml(opsSchoolProgressLabels[item.status] || "学校状态未知")}</td><td>${escapeHtml(formatDateTime(item.submittedAt, "尚未确认"))}</td></tr>`).join("")}
        </tbody></table></div>`
        : `<p class="ops-state">当前有 ${escapeHtml(set.activeChoiceCount || 0)} 个志愿；尚未找到已发送给学校的项目记录。</p>`}
    </div>
  </div>`;
}

function qualityRequestPath() {
  const cursor = opsState.qualityCursors[opsState.qualityPageIndex];
  if (!cursor) return opsQualityEndpoint;
  return `${opsQualityEndpoint}&cursorType=${encodeURIComponent(cursor.entityType)}&cursor=${encodeURIComponent(cursor.entityId)}`;
}

async function changeQualityPage(direction) {
  if (opsState.busy || opsState.view !== "quality") return;
  if (direction === "next") {
    if (!isRecord(opsState.qualityNextCursor)) return;
    opsState.qualityCursors = opsState.qualityCursors.slice(0, opsState.qualityPageIndex + 1);
    opsState.qualityCursors.push(opsState.qualityNextCursor);
    opsState.qualityPageIndex += 1;
  } else if (direction === "previous" && opsState.qualityPageIndex > 0) {
    opsState.qualityPageIndex -= 1;
  } else {
    return;
  }
  await loadCurrentView();
}

function renderSupport() {
  const root = document.querySelector("[data-ops-view]");
  if (!root) return;
  root.innerHTML = `${sectionHeading("申请支持", "支持人员必须先创建绑定单一申请的限时审计会话；这里不显示学生资料、文件或支付明细。")}
    <div class="ops-support">
      <form class="ops-support-form" data-open-support>
        <h3>打开支持会话</h3>
        <p>使用完整 CUAC 编号和固定业务原因。新的查询会先结束当前会话。</p>
        <label><span>CUAC 编号</span><input name="cuacId" placeholder="CUAC-2026-000001" pattern="CUAC-[0-9]{4}-[0-9]{6}" required /></label>
        <label><span>支持原因</span><select name="reasonCode" required>${supportReasonOptions()}</select></label>
        <button class="ops-button primary" type="submit">打开并读取申请</button>
      </form>
      ${renderSupportProjection()}
    </div>`;
}

function renderGuideVersionActions(guide, versions) {
  const publication = versions.publication;
  return versions.items.map(item => {
    const locked = !hasStepUpAdminAuthority();
    if (item.status === "draft") return `<form class="ops-guide-command" data-guide-command="approve" data-guide-id="${escapeHtml(guide.id)}"
      data-version-id="${escapeHtml(item.versionId)}" data-content-sha="${escapeHtml(item.contentSha256)}">
      <label><span>复核引用</span><input name="reviewReference" required maxlength="200" pattern="[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}" /></label>
      <label><span>下次复核日期</span><input name="reviewDueAt" type="date" required /></label>
      <button class="ops-button primary" type="submit"${locked ? ' disabled title="需要管理员二次验证"' : ""}>独立审核并批准${locked ? "（需二次验证）" : ""}</button>
    </form>`;
    if (item.status === "approved" && item.approvalSha256 && publication?.versionId !== item.versionId) return `<form class="ops-guide-command"
      data-guide-command="publish" data-guide-id="${escapeHtml(guide.id)}" data-version-id="${escapeHtml(item.versionId)}"
      data-content-sha="${escapeHtml(item.contentSha256)}" data-approval-sha="${escapeHtml(item.approvalSha256)}"
      data-revision="${escapeHtml(publication?.revision ?? 0)}"><button class="ops-button primary" type="submit"${locked ? ' disabled title="需要管理员二次验证"' : ""}>发布版本 ${escapeHtml(item.version)}${locked ? "（需二次验证）" : ""}</button></form>`;
    return "";
  }).join("");
}

function renderGuides(guides, versions) {
  const root = document.querySelector("[data-ops-view]");
  if (!root || !Array.isArray(guides) || !isRecord(versions) || !Array.isArray(versions.items)) {
    throw new OpsRequestError("指南管理响应不符合前端数据契约。", 503, "INVALID_RESPONSE");
  }
  const guide = guides.find(item => item.id === opsState.selectedGuideId) || guides[0];
  if (!guide) {
    root.innerHTML = `${sectionHeading("指南管理", "目前没有可管理的指南范围。")}<p class="ops-state">没有已注册指南。</p>`;
    return;
  }
  opsState.selectedGuideId = guide.id;
  const section = Array.isArray(guide.content?.sections) ? guide.content.sections[0] : null;
  const publication = versions.publication, locked = !hasStepUpAdminAuthority();
  root.innerHTML = `${sectionHeading("指南管理", "创建人与审核人必须不同；批准、发布和撤回都需要管理员二次验证。")}
    <div class="ops-guide-layout">
      <aside class="ops-guide-list" aria-label="指南列表">${guides.map(item => `<button type="button" data-guide-select="${escapeHtml(item.id)}" class="${item.id === guide.id ? "active" : ""}">
        <strong>${escapeHtml(item.titleZh || item.titleEn)}</strong><span>${escapeHtml(item.slug)}</span></button>`).join("")}</aside>
      <div class="ops-guide-editor">
        <div class="ops-guide-publication"><div><span class="ops-record-id">${escapeHtml(guide.slug)}</span><h3>${escapeHtml(guide.titleEn)}</h3><p>${escapeHtml(guide.summaryZh || guide.summaryEn || "暂无摘要")}</p></div>
          ${statusBadge(publication?.status || "legacy_published")}<span>发布修订 ${escapeHtml(publication?.revision ?? 0)}</span></div>
        <form class="ops-guide-draft" data-guide-draft data-guide-id="${escapeHtml(guide.id)}" data-guide-slug="${escapeHtml(guide.slug)}">
          <h3>基于当前公开内容创建草稿</h3><div class="ops-guide-fields">
            <label><span>英文标题</span><input name="titleEn" maxlength="200" value="${escapeHtml(guide.titleEn)}" required /></label>
            <label><span>中文标题</span><input name="titleZh" maxlength="200" value="${escapeHtml(guide.titleZh || "")}" /></label>
            <label><span>英文副标题</span><input name="subtitleEn" maxlength="240" value="${escapeHtml(guide.subtitleEn || "")}" /></label>
            <label><span>中文副标题</span><input name="subtitleZh" maxlength="240" value="${escapeHtml(guide.subtitleZh || "")}" /></label>
            <label class="wide"><span>英文摘要</span><textarea name="summaryEn" maxlength="1200">${escapeHtml(guide.summaryEn || "")}</textarea></label>
            <label class="wide"><span>中文摘要</span><textarea name="summaryZh" maxlength="1200">${escapeHtml(guide.summaryZh || "")}</textarea></label>
            <label><span>站内链接</span><input name="href" maxlength="240" value="${escapeHtml(guide.href)}" required /></label>
            <label><span>搜索词（逗号分隔）</span><input name="searchTerms" maxlength="1200" /></label>
            <label class="wide"><span>英文正文</span><textarea name="bodyEn" maxlength="6000" required>${escapeHtml(section?.bodyEn || guide.summaryEn || "Add reviewed guide content.")}</textarea></label>
            <label class="wide"><span>中文正文</span><textarea name="bodyZh" maxlength="6000">${escapeHtml(section?.bodyZh || guide.summaryZh || "")}</textarea></label>
            <label><span>官方来源 URL</span><input name="sourceUrl" type="url" maxlength="2048" required /></label>
            <label><span>来源名称</span><input name="sourceLabel" maxlength="160" required /></label>
          </div><button class="ops-button primary" type="submit">保存不可变草稿版本</button>
        </form>
        <section class="ops-guide-versions"><h3>版本记录</h3>${versions.items.length ? versions.items.map(item => `<article><div><strong>版本 ${escapeHtml(item.version)}</strong>
          ${statusBadge(item.status)}<span>${escapeHtml(formatDateTime(item.createdAt))}</span><small>内容摘要 ${escapeHtml(shortId(item.contentSha256))}</small></div></article>`).join("") : '<p class="ops-state">尚无受治理版本；当前公开内容属于迁移前基线。</p>'}
          ${renderGuideVersionActions(guide, versions)}
          ${publication?.status === "active" ? `<form class="ops-guide-command" data-guide-command="withdraw" data-guide-id="${escapeHtml(guide.id)}" data-version-id="${escapeHtml(publication.versionId)}" data-revision="${escapeHtml(publication.revision)}">
            <label><span>撤回原因</span><select name="reason"><option value="content_correction">内容需要更正</option><option value="source_expired">来源已过期</option><option value="policy_change">政策变化</option><option value="guide_superseded">指南已被替代</option></select></label>
            <button class="ops-button danger" type="submit"${locked ? ' disabled title="需要管理员二次验证"' : ""}>撤回公开指南${locked ? "（需二次验证）" : ""}</button></form>` : ""}
        </section>
      </div>
    </div>`;
}

async function loadGuideManagement() {
  const guides = await requestJson("/api/v1/ops/catalog/guides");
  if (!Array.isArray(guides)) throw new OpsRequestError("公开指南列表无效。", 503, "INVALID_RESPONSE");
  if (!opsState.selectedGuideId) opsState.selectedGuideId = guides[0]?.id || null;
  const selected = guides.find(item => item.id === opsState.selectedGuideId) || guides[0];
  const versions = selected ? await requestJson(`/api/v1/ops/catalog/guides/${encodeURIComponent(selected.id)}/versions?limit=20`) : { items: [], publication: null };
  renderGuides(guides, versions);
}

async function submitGuideDraft(form) {
  if (opsState.busy) return;
  const values = new FormData(form), guideId = form.dataset.guideId;
  const value = name => cleanText(values.get(name));
  const titleEn = value("titleEn"), titleZh = value("titleZh"), bodyEn = value("bodyEn"), bodyZh = value("bodyZh");
  const document = { schemaVersion: 1, slug: form.dataset.guideSlug, titleEn, titleZh: titleZh || null,
    subtitleEn: value("subtitleEn") || null, subtitleZh: value("subtitleZh") || null, summaryEn: value("summaryEn") || null,
    summaryZh: value("summaryZh") || null, href: value("href"), searchTerms: value("searchTerms").split(",").map(item => item.trim()).filter(Boolean),
    sections: [{ key: "main", headingEn: titleEn, headingZh: titleZh || null, bodyEn, bodyZh: bodyZh || null }],
    sources: [{ url: value("sourceUrl"), label: value("sourceLabel"), capturedAt: new Date(Date.now() - 1000).toISOString() }] };
  opsState.busy = true;
  try {
    await requestJson(`/api/v1/ops/catalog/guides/${encodeURIComponent(guideId)}/versions`, { method: "POST",
      body: JSON.stringify({ versionId: crypto.randomUUID(), document }) });
    showOpsToast("指南草稿已保存，需由另一位管理员独立审核。"); await loadCurrentView();
  } catch (error) { showOpsToast(error.message || "指南草稿保存失败。"); }
  finally { opsState.busy = false; }
}

async function submitGuideCommand(form) {
  if (opsState.busy) return;
  const action = form.dataset.guideCommand, guideId = form.dataset.guideId, versionId = form.dataset.versionId;
  let body;
  if (action === "approve") {
    const values = new FormData(form), due = cleanText(values.get("reviewDueAt"));
    body = { expectedContentSha256: form.dataset.contentSha, effectiveFrom: null, reviewDueAt: `${due}T23:59:59.000Z`,
      reviewReference: cleanText(values.get("reviewReference")), contentReviewed: true, sourcesVerified: true, publicContentConfirmed: true };
  } else if (action === "publish") body = { expectedContentSha256: form.dataset.contentSha, expectedApprovalSha256: form.dataset.approvalSha,
    expectedPublicationRevision: Number(form.dataset.revision) };
  else body = { expectedPublicationRevision: Number(form.dataset.revision), reason: cleanText(new FormData(form).get("reason")) };
  const suffix = { approve: "approval", publish: "publication", withdraw: "withdrawal" }[action];
  opsState.busy = true;
  try {
    await requestJson(`/api/v1/ops/catalog/guides/${encodeURIComponent(guideId)}/versions/${encodeURIComponent(versionId)}/${suffix}`,
      { method: "POST", body: JSON.stringify(body) });
    showOpsToast(action === "approve" ? "指南版本已批准。" : action === "publish" ? "指南版本已发布。" : "公开指南已撤回。");
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    showOpsToast(error?.status === 403 ? "需要独立管理员身份和有效二次验证。" : error.message || "指南操作失败。");
  } finally { opsState.busy = false; }
}

function renderDataRights(items) {
  const root=document.querySelector("[data-ops-view]");
  if(!Array.isArray(items)) throw new OpsRequestError("隐私请求队列响应无效。",503,"INVALID_RESPONSE");
  const labels={access:"数据访问",correction:"数据更正",portable_export:"数据导出",account_deletion:"账号删除"};
  const outcomeLabels={access_ready:"访问材料已准备",correction_ready:"更正方案已确认",portable_export_ready:"导出方案已确认",
    account_deletion_ready:"删除方案已确认",request_denied:"请求不予处理",retention_exception:"适用数据保留例外"};
  const approvalLabels={single_operator:"经授权人员单人确认",single_admin:"二次验证管理员确认",dual_control:"独立管理员双人复核"};
  const codes=[["identity_verification_required","需要身份核验"],["legal_review_required","需要法务复核"],
    ["security_review_required","需要安全复核"],["retention_exception_review","需要保留例外复核"]];
  const outcomeOptions={access:[["access_ready","访问材料已准备"]],correction:[["correction_ready","更正方案已确认"]],
    portable_export:[["portable_export_ready","导出方案已确认"]],account_deletion:[["account_deletion_ready","删除方案已确认"]]};
  const outcomeForm=item=>`<form data-ops-action-form data-kind="privacy" data-target="${escapeHtml(item.requestId)}" data-action="outcome"
      data-revision="${item.revision}" data-review-revision="${item.review.revision}">
      <label><span>处理方案</span><select name="outcomeCode" required>
        ${(outcomeOptions[item.requestType]||[]).concat([["request_denied","请求不予处理"],["retention_exception","适用数据保留例外"]])
          .map(([value,label])=>`<option value="${value}">${label}</option>`).join("")}</select></label>
      <label><span>固定原因（仅拒绝或保留例外）</span><select name="reasonCode">
        <option value="">不适用</option><option value="identity_not_proven">身份无法核验</option>
        <option value="request_out_of_scope">请求超出适用范围</option><option value="legal_restriction">法律限制</option>
        <option value="legal_hold">诉讼或调查保留</option><option value="fraud_or_security">反欺诈或安全保留</option>
        <option value="financial_record">财务记录保留</option></select></label>
      <label><span>内部工单引用</span><input name="caseReference" maxlength="128" pattern="[A-Za-z0-9._:-]+" required /></label>
      <button class="ops-button" type="submit">提交处理方案</button>
      <p class="ops-state">访问和普通更正可由认领人确认；导出需管理员二次验证；删除、拒绝及保留例外需另一位管理员批准。</p></form>`;
  const outcomeState=item=>{const outcome=item.outcome;if(!outcome)return outcomeForm(item);
    if(outcome.status==="proposed")return`<div class="ops-state"><strong>${escapeHtml(outcomeLabels[outcome.outcomeCode]||outcome.outcomeCode)}</strong>
      · 等待独立管理员批准 · ${escapeHtml(outcome.caseReference)}<br />摘要：${escapeHtml(outcome.proposalSha256)}</div>
      <form data-ops-action-form data-kind="privacy" data-target="${escapeHtml(item.requestId)}" data-action="outcome-approval"
        data-revision="${item.revision}" data-outcome-revision="${outcome.revision}" data-proposal-sha="${escapeHtml(outcome.proposalSha256)}">
        <button class="ops-button" type="submit" ${opsState.role==="cuac_admin"&&opsState.authStrength==="step_up"?"":"disabled"}>独立批准方案</button>
        ${opsState.role==="cuac_admin"&&opsState.authStrength==="step_up"?"":"<p class=\"ops-state\">需要另一位管理员完成二次验证后批准。</p>"}</form>`;
    return`<p class="ops-state"><strong>${escapeHtml(outcomeLabels[outcome.outcomeCode]||outcome.outcomeCode)}</strong>
      · ${escapeHtml(approvalLabels[outcome.approvalMode]||outcome.approvalMode)} · 已批准，等待执行能力上线。当前不会导出、删除、拒绝或关闭请求。</p>`;};
  const deadlineLabels={on_track:"正常",internal_due_soon:"内部目标临近",internal_target_missed:"内部目标未达成",
    response_due_soon:"最迟答复临近",overdue:"已逾期"};
  const deadlineClass=state=>state==="overdue"?" is-danger":state==="on_track"?"":" is-warning";
  const extensionLabels={request_complexity:"请求较为复杂",exceptional_volume:"请求数量异常",legal_retention_review:"依法保留事项复核",
    third_party_dependency:"等待必要的第三方确认",service_disruption_recovery:"服务中断恢复"};
  const extensionState=item=>item.extension?`<p class="ops-state"><strong>延期已批准</strong> · ${escapeHtml(extensionLabels[item.extension.reasonCode]||item.extension.reasonCode)}
      · 新期限 ${escapeHtml(new Date(item.extension.extendedDueAt).toLocaleDateString())} · ${escapeHtml(item.extension.caseReference)}</p>`:
    item.review&&!item.outcome&&new Date(item.responseDueAt).getTime()>Date.now()&&["in_progress","escalated"].includes(item.status)?`<form data-ops-action-form data-kind="privacy" data-target="${escapeHtml(item.requestId)}" data-action="deadline-extension"
      data-revision="${item.revision}" data-review-revision="${item.review.revision}" data-response-due="${escapeHtml(item.responseDueAt)}">
      <label><span>延期原因</span><select name="reasonCode" required>${Object.entries(extensionLabels).map(([value,label])=>`<option value="${value}">${label}</option>`).join("")}</select></label>
      <label><span>新的最迟答复时间</span><input name="extendedDueAt" type="datetime-local" required /></label>
      <label><span>内部工单引用</span><input name="caseReference" maxlength="128" pattern="[A-Za-z0-9._:-]+" required /></label>
      <button class="ops-button" type="submit" ${opsState.role==="cuac_admin"&&opsState.authStrength==="step_up"?"":"disabled"}>批准延期</button>
      ${opsState.role==="cuac_admin"&&opsState.authStrength==="step_up"?"":"<p class=\"ops-state\">延期需要管理员完成二次验证后批准，且必须在原期限前操作。</p>"}</form>`:
    item.outcome?"<p class=\"ops-state\">已有处理方案，不能再变更答复期限。</p>":
    item.review?"<p class=\"ops-state\">原答复期限已到或请求状态不允许延期。</p>":"";
  root.innerHTML=`${sectionHeading("隐私请求处理","这里记录处理方案及必要审批；当前版本不会实际导出、删除、拒绝或关闭请求。")}
    <div class="ops-review-list">${items.length?items.map(item=>`<article class="ops-review-card">
      <header><div><strong>${escapeHtml(labels[item.requestType]||item.requestType)}</strong>
      <span>${escapeHtml(item.preferredLocale)} · ${escapeHtml(item.status)} · ${escapeHtml(new Date(item.receivedAt).toLocaleString())}</span></div></header>
      <p>请求编号：${escapeHtml(item.requestId)}${item.correctionScope?` · 更正范围：${escapeHtml(item.correctionScope)}`:""}</p>
      <p><span class="ops-badge${deadlineClass(item.deadlineState)}">${escapeHtml(deadlineLabels[item.deadlineState]||item.deadlineState)}</span>
        内部目标：${escapeHtml(new Date(item.internalTargetAt).toLocaleDateString())} · 当前最迟答复：${escapeHtml(new Date(item.effectiveDueAt).toLocaleDateString())}</p>
      ${!item.review?(item.identityConfirmedAt?`<form data-ops-action-form data-kind="privacy" data-target="${escapeHtml(item.requestId)}" data-action="claim" data-revision="${item.revision}">
        <button class="ops-button" type="submit">认领分流</button></form>`:`<p class="ops-state">等待学生完成身份确认；当前不可认领或制定处理方案。</p>`):
        item.review.status==="investigating"?`<form data-ops-action-form data-kind="privacy" data-target="${escapeHtml(item.requestId)}" data-action="escalate"
          data-revision="${item.revision}" data-review-revision="${item.review.revision}"><label><span>升级原因</span><select name="code" required>
          ${codes.map(([value,label])=>`<option value="${value}">${label}</option>`).join("")}</select></label>
          <label><span>内部工单引用</span><input name="reference" maxlength="128" pattern="[A-Za-z0-9._:-]+" required /></label>
          <button class="ops-button" type="submit">升级处理</button></form>`:
        `<p class="ops-state">已升级：${escapeHtml(item.review.escalationCode||"")} · ${escapeHtml(item.review.escalationReference||"")}</p>`}
      ${item.review?outcomeState(item):""}
      ${extensionState(item)}
    </article>`).join(""):"<p class=\"ops-state\">当前没有待处理隐私请求。</p>"}</div>`;
}

function renderAccountDeletions(items) {
  const root = document.querySelector("[data-ops-view]");
  if (!Array.isArray(items)) throw new OpsRequestError("账号删除执行队列响应无效。", 503, "INVALID_RESPONSE");
  const blockerLabels = { legal_hold_review_required: "法律保留复核待完成",
    backup_tombstone_required: "备份删除墓碑尚未就绪", private_object_cleanup_required: "私密对象待清理",
    financial_record_review_required: "财务记录待复核", application_evidence_review_required: "申请证据待复核",
    school_handoff_review_required: "学校交接待复核", privileged_role_review_required: "账号角色待复核",
    minor_evidence_review_required: "未成年人同意证据待复核" };
  const statusLabels = { review_required: "等待复核", blocked: "法律保留阻塞", quarantined: "已隔离",
    purge_ready: "等待最终清除", completed: "已完成" };
  const latestReview = item => item.latestLegalHoldReview ? `<p class="ops-state"><strong>最新法律复核：</strong>
    ${item.latestLegalHoldReview.result === "blocked" ? "阻塞" : "未发现保留事项（候选结论）"}
    · ${escapeHtml(item.latestLegalHoldReview.reasonCode)} · ${escapeHtml(item.latestLegalHoldReview.caseReference)}
    · ${escapeHtml(new Date(item.latestLegalHoldReview.reviewedAt).toLocaleString())}</p>` :
    `<p class="ops-state">尚未记录法律保留复核。</p>`;
  root.innerHTML = `${sectionHeading("账号删除执行队列",
    "仅复核已完成双人审批的执行单。刷新不会删除数据；法律复核也不会自动清除备份墓碑门禁。")}
    <div class="ops-review-list">${items.length ? items.map(item => `<article class="ops-review-card">
      <header><div><strong>${escapeHtml(statusLabels[item.status] || item.status)}</strong>
      <span>版本 ${item.revision} · ${escapeHtml(new Date(item.preparedAt).toLocaleString())}</span></div></header>
      <p>执行编号：${escapeHtml(item.executionId)}<br />隐私请求编号：${escapeHtml(item.dataRightsRequestId)}</p>
      ${item.quarantinedAt && item.purgeAfter ? `<p class="ops-state"><strong>隔离等待期：</strong>
        ${escapeHtml(new Date(item.quarantinedAt).toLocaleString())} 至 ${escapeHtml(new Date(item.purgeAfter).toLocaleString())}。
        当前账号已停用且会话已撤销；等待期内不会自动清除数据。</p>` : ""}
      <div class="ops-chip-row">${item.blockerCodes.map(code => `<span class="ops-badge${code === "backup_tombstone_required" ? " is-warning" : ""}">${escapeHtml(blockerLabels[code] || code)}</span>`).join("")}</div>
      ${latestReview(item)}
      ${["review_required", "blocked"].includes(item.status) ? `<form class="ops-action-form" data-ops-action-form data-kind="deletion" data-target="${escapeHtml(item.executionId)}"
        data-action="refresh" data-revision="${item.revision}"><button class="ops-button" type="submit">重新扫描实际阻塞项</button></form>
      <form class="ops-action-form" data-ops-action-form data-kind="deletion" data-target="${escapeHtml(item.executionId)}"
        data-action="legal-hold-review" data-revision="${item.revision}">
        <label><span>法律保留结论</span><select name="result" required><option value="clear_candidate">未发现保留事项（候选结论）</option>
          <option value="blocked">存在保留事项，阻塞执行</option></select></label>
        <label><span>固定原因</span><select name="reasonCode" required><option value="no_hold_found">未发现保留事项</option>
          <option value="legal_hold">诉讼或调查保留</option><option value="fraud_or_security">反欺诈或安全保留</option>
          <option value="financial_record">财务记录保留</option></select></label>
        <label><span>内部案件引用</span><input name="caseReference" maxlength="128" pattern="[A-Za-z0-9._:-]+" required /></label>
        <button class="ops-button" type="submit" ${opsState.role === "cuac_admin" && opsState.authStrength === "step_up" ? "" : "disabled"}>记录法律保留复核</button>
        ${opsState.role === "cuac_admin" && opsState.authStrength === "step_up" ? "" : `<p class="ops-state">需要管理员先完成二次验证。</p>`}
      </form>` : `<p class="ops-state">当前状态不接受阻塞刷新或新的法律复核。</p>`}
    </article>`).join("") : `<p class="ops-state">当前没有账号删除执行单。</p>`}</div>`;
}

function cityStatusLabel(status) {
  return { active: "已发布", draft: "草稿", archived: "已归档" }[status] || status;
}

function cityVerificationLabel(status) {
  return { verified: "已验证", unverified: "待验证", stale: "需复核", disputed: "有争议", invalid: "无效" }[status] || status;
}

function splitCityList(value) {
  return String(value || "").split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
}

function renderCityEditor(detail) {
  const record = detail?.city || null;
  const city = record || { slug: "", nameZh: "", nameEn: "", region: "", province: "", monthlyCost: "",
    monthlyCostRmb: null, costLevel: "", density: "", tags: [], content: {}, nearby: [], sortOrder: 0,
    sourceUrl: "", sourceLabel: "", sourceNote: "", status: "draft", verificationStatus: "unverified", version: 0 };
  const lifecycleLocked = !hasStepUpAdminAuthority();
  const actions = record ? `<div class="ops-catalog-lifecycle">
    ${record.status !== "archived" ? `<form data-city-lifecycle="publish" data-city-id="${escapeHtml(record.id)}" data-version="${record.version}">
      <button class="ops-button primary" type="submit"${lifecycleLocked ? ' disabled title="需要管理员二次验证"' : ""}>发布并确认来源</button>
    </form><form data-city-lifecycle="archive" data-city-id="${escapeHtml(record.id)}" data-version="${record.version}">
      <button class="ops-button danger" type="submit"${lifecycleLocked ? ' disabled title="需要管理员二次验证"' : ""}>归档</button>
    </form>` : `<form data-city-lifecycle="restore" data-city-id="${escapeHtml(record.id)}" data-version="${record.version}">
      <button class="ops-button primary" type="submit"${lifecycleLocked ? ' disabled title="需要管理员二次验证"' : ""}>恢复为草稿</button>
    </form>`}
    ${lifecycleLocked ? '<small>发布、归档和恢复需要 CUAC 管理员完成二次验证；不要求另一位管理员审批。</small>' : ""}
  </div>` : "";
  const revisions = detail?.revisions || [];
  return `<section class="ops-city-editor">
    <div class="ops-city-editor-heading"><div><span class="ops-record-id">${record ? `版本 ${record.version}` : "新建记录"}</span>
      <h3>${escapeHtml(record ? city.nameZh || city.nameEn : "新建城市")}</h3></div>
      ${record ? `<div class="ops-chip-row">${statusBadge(city.status)}<span class="ops-badge">${escapeHtml(cityVerificationLabel(city.verificationStatus))}</span></div>` : ""}
    </div>
    <form class="ops-city-form" data-city-editor data-city-id="${escapeHtml(record?.id || "")}" data-version="${city.version}">
      <fieldset${record?.status === "archived" ? " disabled" : ""}><legend>城市身份与展示</legend><div class="ops-city-fields">
        <label>英文名称<input name="nameEn" required maxlength="160" value="${escapeHtml(city.nameEn)}"></label>
        <label>中文名称<input name="nameZh" maxlength="160" value="${escapeHtml(city.nameZh || "")}"></label>
        <label>Slug<input name="slug" required maxlength="100" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(city.slug)}"></label>
        <label>省 / 直辖市<input name="province" maxlength="160" value="${escapeHtml(city.province || "")}"></label>
        <label>区域<input name="region" maxlength="120" value="${escapeHtml(city.region || "")}"></label>
        <label>排序<input name="sortOrder" type="number" min="-100000" max="100000" value="${escapeHtml(city.sortOrder)}"></label>
      </div></fieldset>
      <fieldset${record?.status === "archived" ? " disabled" : ""}><legend>生活成本与检索标签</legend><div class="ops-city-fields">
        <label>月生活费数值（RMB）<input name="monthlyCostRmb" type="number" min="0" max="1000000" value="${escapeHtml(city.monthlyCostRmb ?? "")}"></label>
        <label>月生活费说明<input name="monthlyCost" maxlength="160" value="${escapeHtml(city.monthlyCost || "")}"></label>
        <label>成本等级<input name="costLevel" maxlength="80" value="${escapeHtml(city.costLevel || "")}"></label>
        <label>高校密度<input name="density" maxlength="80" value="${escapeHtml(city.density || "")}"></label>
        <label class="wide">标签（逗号分隔）<input name="tags" value="${escapeHtml((city.tags || []).join(", "))}"></label>
        <label class="wide">邻近城市（逗号分隔）<input name="nearby" value="${escapeHtml((city.nearby || []).join(", "))}"></label>
      </div></fieldset>
      <fieldset${record?.status === "archived" ? " disabled" : ""}><legend>城市内容</legend>
        <label>结构化内容 JSON<textarea name="content" rows="12" spellcheck="false">${escapeHtml(JSON.stringify(city.content || {}, null, 2))}</textarea></label>
      </fieldset>
      <fieldset${record?.status === "archived" ? " disabled" : ""}><legend>官方来源证据</legend><div class="ops-city-fields">
        <label class="wide">官方来源 HTTPS 地址<input name="sourceUrl" required type="url" maxlength="2048" value="${escapeHtml(city.sourceUrl || "")}"></label>
        <label>来源名称<input name="sourceLabel" required maxlength="200" value="${escapeHtml(city.sourceLabel || "")}"></label>
        <label>来源备注<input name="sourceNote" maxlength="1000" value="${escapeHtml(city.sourceNote || "")}"></label>
      </div></fieldset>
      ${record?.status === "archived" ? '<p class="ops-state compact">已归档记录不可编辑；先恢复为草稿。</p>' : '<button class="ops-button primary" type="submit">保存城市记录</button>'}
    </form>${actions}
    ${record ? `<details class="ops-city-revisions"><summary>修订记录（${revisions.length}）</summary>
      ${revisions.length ? `<ol>${revisions.map(item => `<li><strong>版本 ${escapeHtml(item.entityVersion)}</strong> · ${escapeHtml({ created: "创建", updated: "编辑", published: "发布", archived: "归档", restored: "恢复" }[item.action] || item.action)}
        <span>${escapeHtml(formatDateTime(item.createdAt))}</span><small>${escapeHtml((item.changedFields || []).join("、") || "状态变更")}</small></li>`).join("")}</ol>` : '<p class="ops-state compact">当前还没有修订快照。</p>'}
    </details>` : ""}
  </section>`;
}

function renderCatalogManagement(data, detail) {
  const root = document.querySelector("[data-ops-view]");
  if (!root) return;
  const selected = opsState.selectedCityId;
  root.innerHTML = `${sectionHeading("目录管理", "城市和学校主数据共用版本、来源证据、修订历史与审计框架。")}
    ${renderCatalogScope("city")}
    <div class="ops-catalog-toolbar"><form data-city-filter><label>查找城市<input name="query" value="${escapeHtml(opsState.catalogQuery)}" placeholder="名称、slug 或省份"></label>
      <label>状态<select name="status"><option value="">全部</option>${[["active","已发布"],["draft","草稿"],["archived","已归档"]].map(([value,label]) => `<option value="${value}"${opsState.catalogStatus === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      <button class="ops-button" type="submit">筛选</button></form><button class="ops-button primary" type="button" data-city-new>新建城市</button></div>
    <div class="ops-catalog-layout"><aside class="ops-city-list" aria-label="城市记录">
      <p><strong>${escapeHtml(data.total)}</strong> 条记录</p>${data.items.length ? data.items.map(city => `<button type="button" data-city-select="${escapeHtml(city.id)}" class="${selected === city.id ? "active" : ""}">
        <span><strong>${escapeHtml(city.nameZh || city.nameEn)}</strong><small>${escapeHtml(city.nameEn)} · ${escapeHtml(city.province || "地区未填写")}</small></span>
        <span>${escapeHtml(cityStatusLabel(city.status))}<small>v${escapeHtml(city.version)}</small></span></button>`).join("") : '<p class="ops-state compact">没有符合条件的城市。</p>'}
    </aside>${renderCityEditor(detail)}</div>`;
}

function renderCatalogScope(active) {
  return `<div class="ops-catalog-scope" aria-label="目录类型">
    <button type="button" data-catalog-entity="city" class="${active === "city" ? "active" : ""}">城市</button>
    <button type="button" data-catalog-entity="school" class="${active === "school" ? "active" : ""}">学校</button>
    <button type="button" data-catalog-entity="program" class="${active === "program" ? "active" : ""}">项目</button>
    <button type="button" data-catalog-entity="scholarship" class="${active === "scholarship" ? "active" : ""}">奖学金</button></div>`;
}

function schoolList(value) {
  return String(value || "").split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
}

function renderSchoolEditor(detail, cities) {
  const record = detail?.school || null;
  const school = record || { slug: "", nameZh: "", nameEn: "", schoolType: "", region: "", cityId: "", city: "",
    cityZh: "", citySlug: "", province: "", regionLabel: "", ranking: "", cscaRequired: false,
    cscaRequirement: "", cscaSubjects: [], applicationLevel: "", languageOfInstruction: "", languageRequirement: "",
    hskRequirement: "", englishRequirement: "", deadlineSummary: "", tuitionSummary: "", applicationFee: "",
    websiteUrl: "", admissionsUrl: "", subjectTags: [], fitNotes: "", languageTags: [], tuitionBandLabel: "",
    campusHighlights: [], contactNotes: "", qualityScore: null, missingFields: [], completenessLabel: "",
    sourceUrl: "", sourceLabel: "", sourceNote: "", status: "draft", verificationStatus: "unverified", version: 0 };
  const lifecycleLocked = !hasStepUpAdminAuthority();
  const disabled = record?.status === "archived" ? " disabled" : "";
  const actions = record ? `<div class="ops-catalog-lifecycle">
    ${record.status !== "archived" ? `<form data-school-lifecycle="publish" data-school-id="${escapeHtml(record.id)}" data-version="${record.version}">
      <button class="ops-button primary" type="submit"${lifecycleLocked ? ' disabled title="需要管理员二次验证"' : ""}>发布并确认来源</button></form>
      <form data-school-lifecycle="archive" data-school-id="${escapeHtml(record.id)}" data-version="${record.version}">
      <button class="ops-button danger" type="submit"${lifecycleLocked ? ' disabled title="需要管理员二次验证"' : ""}>归档</button></form>`
      : `<form data-school-lifecycle="restore" data-school-id="${escapeHtml(record.id)}" data-version="${record.version}">
      <button class="ops-button primary" type="submit"${lifecycleLocked ? ' disabled title="需要管理员二次验证"' : ""}>恢复为草稿</button></form>`}
    ${lifecycleLocked ? '<small>发布、归档和恢复需要 CUAC 管理员完成二次验证；学校存在活动项目、奖学金、员工或申请时不能归档。</small>' : ""}</div>` : "";
  const revisions = detail?.revisions || [];
  const cityOptions = (cities || []).filter(city => city.status !== "archived").map(city => `<option value="${escapeHtml(city.id)}"${school.cityId === city.id ? " selected" : ""}>
    ${escapeHtml(city.nameZh || city.nameEn)} · ${escapeHtml(city.status === "active" ? "已发布" : "草稿")}</option>`).join("");
  const input = (name, label, max = 1000, wide = false) => `<label class="${wide ? "wide" : ""}">${label}<input name="${name}" maxlength="${max}" value="${escapeHtml(school[name] || "")}"></label>`;
  return `<section class="ops-city-editor"><div class="ops-city-editor-heading"><div><span class="ops-record-id">${record ? `版本 ${record.version}` : "新建记录"}</span>
    <h3>${escapeHtml(record ? school.nameZh || school.nameEn : "新建学校")}</h3></div>
    ${record ? `<div class="ops-chip-row">${statusBadge(school.status)}<span class="ops-badge">${escapeHtml(cityVerificationLabel(school.verificationStatus))}</span></div>` : ""}</div>
    <form class="ops-city-form" data-school-editor data-school-id="${escapeHtml(record?.id || "")}" data-version="${school.version}">
      <fieldset${disabled}><legend>学校身份与城市关系</legend><div class="ops-city-fields">
        <label>英文名称<input name="nameEn" required maxlength="240" value="${escapeHtml(school.nameEn)}"></label>
        <label>中文名称<input name="nameZh" maxlength="240" value="${escapeHtml(school.nameZh || "")}"></label>
        <label>Slug<input name="slug" required maxlength="160" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(school.slug)}"></label>
        <label>学校类型<input name="schoolType" required maxlength="120" value="${escapeHtml(school.schoolType || "")}"></label>
        <label class="wide">关联城市<select name="cityId" required><option value="">选择城市</option>${cityOptions}</select><small>英文城市、中文城市、城市 Slug 和省份由所选城市自动写入，不能单独修改。</small></label>
        ${input("region", "区域", 120)}${input("regionLabel", "区域展示名", 160)}${input("ranking", "排名说明", 160)}
      </div></fieldset>
      <fieldset${disabled}><legend>申请与语言</legend><div class="ops-city-fields">
        ${input("applicationLevel", "申请层级", 240)}${input("languageOfInstruction", "授课语言", 240)}
        ${input("languageRequirement", "语言要求", 2000, true)}${input("hskRequirement", "HSK 要求", 1000)}${input("englishRequirement", "英语要求", 1000)}
        ${input("deadlineSummary", "截止日期摘要", 1000)}${input("tuitionSummary", "学费摘要", 1000)}${input("applicationFee", "申请费", 240)}
        <label>是否要求 CSCA<select name="cscaRequired"><option value="false"${school.cscaRequired ? "" : " selected"}>否</option><option value="true"${school.cscaRequired ? " selected" : ""}>是</option></select></label>
        ${input("cscaRequirement", "CSCA 要求", 1000)}
        <label class="wide">CSCA 科目（逗号分隔）<input name="cscaSubjects" value="${escapeHtml((school.cscaSubjects || []).join(", "))}"></label>
      </div></fieldset>
      <fieldset${disabled}><legend>公开展示与质量</legend><div class="ops-city-fields">
        <label class="wide">学校官网 HTTPS 地址<input name="websiteUrl" required type="url" maxlength="2048" value="${escapeHtml(school.websiteUrl || "")}"></label>
        <label class="wide">招生官网 HTTPS 地址<input name="admissionsUrl" type="url" maxlength="2048" value="${escapeHtml(school.admissionsUrl || "")}"></label>
        <label class="wide">学科标签（逗号分隔）<input name="subjectTags" value="${escapeHtml((school.subjectTags || []).join(", "))}"></label>
        <label class="wide">语言标签（逗号分隔）<input name="languageTags" value="${escapeHtml((school.languageTags || []).join(", "))}"></label>
        <label class="wide">校园亮点（每行或逗号分隔）<textarea name="campusHighlights" rows="4">${escapeHtml((school.campusHighlights || []).join("\n"))}</textarea></label>
        ${input("tuitionBandLabel", "学费区间标签", 240)}${input("completenessLabel", "完整度标签", 240)}
        <label>质量分（0–100）<input name="qualityScore" type="number" min="0" max="100" value="${escapeHtml(school.qualityScore ?? "")}"></label>
        <label class="wide">缺失字段（逗号分隔）<input name="missingFields" value="${escapeHtml((school.missingFields || []).join(", "))}"></label>
        <label class="wide">适配说明<textarea name="fitNotes" rows="4" maxlength="3000">${escapeHtml(school.fitNotes || "")}</textarea></label>
        <label class="wide">联系备注<textarea name="contactNotes" rows="4" maxlength="2000">${escapeHtml(school.contactNotes || "")}</textarea></label>
      </div></fieldset>
      <fieldset${disabled}><legend>官方来源证据</legend><div class="ops-city-fields">
        <label class="wide">官方来源 HTTPS 地址<input name="sourceUrl" required type="url" maxlength="2048" value="${escapeHtml(school.sourceUrl || "")}"></label>
        <label>来源名称<input name="sourceLabel" required maxlength="200" value="${escapeHtml(school.sourceLabel || "")}"></label>${input("sourceNote", "来源备注", 1000)}
      </div></fieldset>
      ${record?.status === "archived" ? '<p class="ops-state compact">已归档记录不可编辑；先恢复为草稿。</p>' : '<button class="ops-button primary" type="submit">保存学校记录</button>'}
    </form>${actions}
    ${record ? `<details class="ops-city-revisions"><summary>修订记录（${revisions.length}）</summary>${revisions.length ? `<ol>${revisions.map(item => `<li><strong>版本 ${escapeHtml(item.entityVersion)}</strong> · ${escapeHtml({ created: "创建", updated: "编辑", published: "发布", archived: "归档", restored: "恢复" }[item.action] || item.action)}<span>${escapeHtml(formatDateTime(item.createdAt))}</span><small>${escapeHtml((item.changedFields || []).join("、") || "状态变更")}</small></li>`).join("")}</ol>` : '<p class="ops-state compact">当前还没有修订快照。</p>'}</details>` : ""}</section>`;
}

function renderSchoolCatalogManagement(data, detail, cities) {
  const root = document.querySelector("[data-ops-view]");
  if (!root) return;
  const selected = opsState.selectedSchoolId;
  root.innerHTML = `${sectionHeading("目录管理", "学校身份、招生摘要与官方来源已接入版本化管理；学校自助纠错仍走独立复核流程。")}
    ${renderCatalogScope("school")}
    <div class="ops-catalog-toolbar"><form data-school-filter><label>查找学校<input name="query" value="${escapeHtml(opsState.catalogQuery)}" placeholder="名称、slug、城市或省份"></label>
      <label>状态<select name="status"><option value="">全部</option>${[["active","已发布"],["draft","草稿"],["archived","已归档"]].map(([value,label]) => `<option value="${value}"${opsState.catalogStatus === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      <button class="ops-button" type="submit">筛选</button></form><button class="ops-button primary" type="button" data-school-new>新建学校</button></div>
    <div class="ops-catalog-layout"><aside class="ops-city-list" aria-label="学校记录"><p><strong>${escapeHtml(data.total)}</strong> 条记录</p>
      ${data.items.length ? data.items.map(school => `<button type="button" data-school-select="${escapeHtml(school.id)}" class="${selected === school.id ? "active" : ""}">
        <span><strong>${escapeHtml(school.nameZh || school.nameEn)}</strong><small>${escapeHtml(school.nameEn)} · ${escapeHtml(school.city || school.province || "城市未关联")}</small></span>
        <span>${escapeHtml(cityStatusLabel(school.status))}<small>v${escapeHtml(school.version)}</small></span></button>`).join("") : '<p class="ops-state compact">没有符合条件的学校。</p>'}
    </aside>${renderSchoolEditor(detail, cities)}</div>`;
}

function renderProgramEditor(detail, schools, cities) {
  const record = detail?.program || null;
  const program = record || { schoolId: "", cityId: "", slug: "", nameZh: "", nameEn: "", degreeLevel: "",
    durationYears: null, durationMonths: null, fieldCategory: "", subjectArea: "", teachingLanguage: "",
    cscaSubjects: [], cscaRequirement: "", hskRequirement: "", englishRequirement: "", tuitionAmount: null,
    tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "", scholarshipText: "", applicationUrl: "",
    applicationNote: "", hasScholarship: false, badgeText: "", displayTuition: "", displaySubjects: [],
    displayGroup: "", displayGroupLabel: "", sortOrder: 0, sourceUrl: "", sourceLabel: "", sourceNote: "",
    status: "draft", verificationStatus: "unverified", version: 0 };
  const disabled = record?.status === "archived" ? " disabled" : "", lifecycleLocked = !hasStepUpAdminAuthority();
  const options = (items, selected, label) => items.filter(item => item.status !== "archived").map(item =>
    `<option value="${escapeHtml(item.id)}"${selected === item.id ? " selected" : ""}>${escapeHtml(label(item))} · ${item.status === "active" ? "已发布" : "草稿"}</option>`).join("");
  const input = (name, label, max = 1000, wide = false, type = "text") => `<label class="${wide ? "wide" : ""}">${label}<input name="${name}" type="${type}" maxlength="${max}" value="${escapeHtml(program[name] ?? "")}"></label>`;
  const dependencies = detail?.dependencies || {};
  const actions = record ? `<div class="ops-catalog-lifecycle">
    ${record.status !== "archived" ? `<form data-program-lifecycle="publish" data-program-id="${escapeHtml(record.id)}" data-version="${record.version}"><button class="ops-button primary" type="submit"${lifecycleLocked ? " disabled" : ""}>发布并确认来源</button></form>
      <form data-program-lifecycle="archive" data-program-id="${escapeHtml(record.id)}" data-version="${record.version}"><button class="ops-button danger" type="submit"${lifecycleLocked ? " disabled" : ""}>归档</button></form>`
      : `<form data-program-lifecycle="restore" data-program-id="${escapeHtml(record.id)}" data-version="${record.version}"><button class="ops-button primary" type="submit"${lifecycleLocked ? " disabled" : ""}>恢复为草稿</button></form>`}
    <small>招生批次与申请要求在独立治理流程维护。开放批次、已发布要求、有效奖学金或当前申请选择存在时不能归档。</small></div>` : "";
  return `<section class="ops-city-editor"><div class="ops-city-editor-heading"><div><span class="ops-record-id">${record ? `版本 ${record.version}` : "新建记录"}</span><h3>${escapeHtml(record ? program.nameZh || program.nameEn : "新建项目")}</h3></div>
    ${record ? `<div class="ops-chip-row">${statusBadge(program.status)}<span class="ops-badge">${escapeHtml(cityVerificationLabel(program.verificationStatus))}</span></div>` : ""}</div>
    ${record ? `<div class="ops-chip-row"><span class="ops-badge">招生批次 ${dependencies.intakeCount || 0}</span><span class="ops-badge">开放 ${dependencies.openIntakeCount || 0}</span><span class="ops-badge">有效奖学金 ${dependencies.activeScholarshipCount || 0}</span><span class="ops-badge">当前申请选择 ${dependencies.activeApplicationChoiceCount || 0}</span></div>` : ""}
    <form class="ops-city-form" data-program-editor data-program-id="${escapeHtml(record?.id || "")}" data-version="${program.version}">
      <fieldset${disabled}><legend>项目身份与关系</legend><div class="ops-city-fields">
        <label class="wide">所属学校<select name="schoolId" required><option value="">选择学校</option>${options(schools, program.schoolId, item => item.nameZh || item.nameEn)}</select></label>
        <label class="wide">授课城市<select name="cityId" required><option value="">选择城市</option>${options(cities, program.cityId, item => item.nameZh || item.nameEn)}</select><small>支持跨校区项目；学校和城市都必须发布后项目才能发布。</small></label>
        <label>英文名称<input name="nameEn" required maxlength="300" value="${escapeHtml(program.nameEn)}"></label>
        ${input("nameZh", "中文名称", 300)}<label>Slug<input name="slug" required maxlength="180" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(program.slug)}"></label>
        <label>学位层级<input name="degreeLevel" required maxlength="120" value="${escapeHtml(program.degreeLevel)}"></label>
        ${input("fieldCategory", "学科门类", 200)}${input("subjectArea", "专业方向", 200)}
        <label>授课语言<input name="teachingLanguage" required maxlength="200" value="${escapeHtml(program.teachingLanguage || "")}"></label>
        ${input("durationYears", "学制（年）", 2, false, "number")}${input("durationMonths", "学制（月）", 3, false, "number")}
      </div></fieldset>
      <fieldset${disabled}><legend>费用、申请与要求</legend><div class="ops-city-fields">
        ${input("tuitionAmount", "学费数值", 9, false, "number")}${input("tuitionCurrency", "币种", 3)}${input("tuitionPeriod", "计费周期", 120)}
        ${input("tuitionText", "学费说明", 1000, true)}${input("displayTuition", "前台学费展示", 300)}
        <label>有奖学金<select name="hasScholarship"><option value="false"${program.hasScholarship ? "" : " selected"}>否</option><option value="true"${program.hasScholarship ? " selected" : ""}>是</option></select></label>
        ${input("scholarshipText", "奖学金说明", 2000, true)}
        <label class="wide">申请 HTTPS 地址<input name="applicationUrl" required type="url" maxlength="2048" value="${escapeHtml(program.applicationUrl || "")}"></label>
        <label class="wide">申请说明<textarea name="applicationNote" rows="3" maxlength="3000">${escapeHtml(program.applicationNote || "")}</textarea></label>
        <label class="wide">CSCA 科目（逗号分隔）<input name="cscaSubjects" value="${escapeHtml((program.cscaSubjects || []).join(", "))}"></label>
        ${input("cscaRequirement", "CSCA 要求", 2000, true)}${input("hskRequirement", "HSK 要求", 2000, true)}${input("englishRequirement", "英语要求", 2000, true)}
      </div></fieldset>
      <fieldset${disabled}><legend>前台展示</legend><div class="ops-city-fields">
        ${input("badgeText", "徽标文字", 200)}${input("displayGroup", "展示分组", 120)}${input("displayGroupLabel", "展示分组名称", 200)}${input("sortOrder", "排序", 7, false, "number")}
        <label class="wide">展示科目（逗号分隔）<input name="displaySubjects" value="${escapeHtml((program.displaySubjects || []).join(", "))}"></label>
      </div></fieldset>
      <fieldset${disabled}><legend>官方来源证据</legend><div class="ops-city-fields">
        <label class="wide">官方来源 HTTPS 地址<input name="sourceUrl" required type="url" maxlength="2048" value="${escapeHtml(program.sourceUrl || "")}"></label>
        ${input("sourceLabel", "来源名称", 200)}${input("sourceNote", "来源备注", 1000, true)}
      </div></fieldset>
      ${record?.status === "archived" ? '<p class="ops-state compact">已归档记录不可编辑；先恢复为草稿。</p>' : '<button class="ops-button primary" type="submit">保存项目记录</button>'}
    </form>${actions}
    ${record ? `<details class="ops-city-revisions"><summary>修订记录（${(detail.revisions || []).length}）</summary><ol>${(detail.revisions || []).map(item => `<li><strong>版本 ${escapeHtml(item.entityVersion)}</strong> · ${escapeHtml(item.action)}<span>${escapeHtml(formatDateTime(item.createdAt))}</span><small>${escapeHtml((item.changedFields || []).join("、") || "状态变更")}</small></li>`).join("")}</ol></details>` : ""}</section>`;
}

function renderProgramCatalogManagement(data, detail, schools, cities) {
  const root = document.querySelector("[data-ops-view]"); if (!root) return;
  root.innerHTML = `${sectionHeading("目录管理", "项目身份、费用和来源证据在此治理；招生批次与申请要求保持独立版本边界。")}${renderCatalogScope("program")}
    <div class="ops-catalog-toolbar"><form data-program-filter><label>查找项目<input name="query" value="${escapeHtml(opsState.catalogQuery)}" placeholder="名称、slug、学位或专业方向"></label>
    <label>状态<select name="status"><option value="">全部</option>${[["active","已发布"],["draft","草稿"],["archived","已归档"]].map(([value,label]) => `<option value="${value}"${opsState.catalogStatus === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
    <button class="ops-button" type="submit">筛选</button></form><button class="ops-button primary" type="button" data-program-new>新建项目</button></div>
    <div class="ops-catalog-layout"><aside class="ops-city-list" aria-label="项目记录"><p><strong>${escapeHtml(data.total)}</strong> 条记录</p>${data.items.length ? data.items.map(program => `<button type="button" data-program-select="${escapeHtml(program.id)}" class="${opsState.selectedProgramId === program.id ? "active" : ""}"><span><strong>${escapeHtml(program.nameZh || program.nameEn)}</strong><small>${escapeHtml(program.nameEn)} · ${escapeHtml(program.degreeLevel)}</small></span><span>${escapeHtml(cityStatusLabel(program.status))}<small>v${escapeHtml(program.version)}</small></span></button>`).join("") : '<p class="ops-state compact">没有符合条件的项目。</p>'}</aside>${renderProgramEditor(detail, schools, cities)}</div>`;
}

function renderScholarshipEditor(detail, schools, linkedProgram) {
  const record = detail?.scholarship || null;
  const scholarship = record || { slug: "", title: "", nameZh: "", type: "", typeLabel: "", fundingLevel: "",
    providerName: "", providerNameEn: "", providerLocation: "", schoolId: "", programId: "", coverage: "",
    applicableDegree: "", applicableProgram: "", amountText: "", requirementText: "", bodySections: [],
    benefitItems: [], eligibilityItems: [], applicationMaterials: [], applicationSteps: [], contactInfo: {},
    actionLinks: [], deadlineDate: null, deadlineLabel: "", applicationRound: "", targetCountries: [],
    targetRegions: [], benefits: [], tags: [], summary: "", sortOrder: 0, sourceUrl: "", sourceLabel: "",
    sourceNote: "", status: "draft", verificationStatus: "unverified", version: 0 };
  const disabled = record?.status === "archived" ? " disabled" : "", lifecycleLocked = !hasStepUpAdminAuthority();
  const input = (name, label, max = 1000, wide = false, type = "text") => `<label class="${wide ? "wide" : ""}">${label}<input name="${name}" type="${type}" maxlength="${max}" value="${escapeHtml(scholarship[name] ?? "")}"></label>`;
  const json = (name, label, rows = 4) => `<label class="wide">${label}（JSON）<textarea name="${name}" rows="${rows}">${escapeHtml(JSON.stringify(scholarship[name] ?? (name === "contactInfo" ? {} : []), null, 2))}</textarea></label>`;
  const schoolOptions = schools.filter(item => item.status !== "archived").map(item => `<option value="${escapeHtml(item.id)}"${scholarship.schoolId === item.id ? " selected" : ""}>${escapeHtml(item.nameZh || item.nameEn)} · ${item.status === "active" ? "已发布" : "草稿"}</option>`).join("");
  const linkedProgramText = linkedProgram ? `${linkedProgram.nameZh || linkedProgram.nameEn} — ${linkedProgram.id}` : "";
  const dependencies = detail?.dependencies || {};
  const actions = record ? `<div class="ops-catalog-lifecycle">
    ${record.status !== "archived" ? `<form data-scholarship-lifecycle="publish" data-scholarship-id="${escapeHtml(record.id)}" data-version="${record.version}"><button class="ops-button primary" type="submit"${lifecycleLocked ? " disabled" : ""}>发布并确认来源</button></form>
      <form data-scholarship-lifecycle="archive" data-scholarship-id="${escapeHtml(record.id)}" data-version="${record.version}"><button class="ops-button danger" type="submit"${lifecycleLocked ? " disabled" : ""}>归档</button></form>`
      : `<form data-scholarship-lifecycle="restore" data-scholarship-id="${escapeHtml(record.id)}" data-version="${record.version}"><button class="ops-button primary" type="submit"${lifecycleLocked ? " disabled" : ""}>恢复为草稿</button></form>`}
    <small>发布、归档和恢复需要管理员二次验证；仍被当前申请选择使用的奖学金不能归档。</small></div>` : "";
  return `<section class="ops-city-editor"><div class="ops-city-editor-heading"><div><span class="ops-record-id">${record ? `版本 ${record.version}` : "新建记录"}</span><h3>${escapeHtml(record ? scholarship.nameZh || scholarship.title : "新建奖学金")}</h3></div>
    ${record ? `<div class="ops-chip-row">${statusBadge(scholarship.status)}<span class="ops-badge">${escapeHtml(cityVerificationLabel(scholarship.verificationStatus))}</span></div>` : ""}</div>
    ${record ? `<div class="ops-chip-row"><span class="ops-badge">关联项目 ${dependencies.linkedProgramCount || 0}</span><span class="ops-badge">当前申请选择 ${dependencies.activeApplicationChoiceCount || 0}</span></div>` : ""}
    <form class="ops-city-form" data-scholarship-editor data-scholarship-id="${escapeHtml(record?.id || "")}" data-version="${scholarship.version}">
      <fieldset${disabled}><legend>奖学金身份与关系</legend><div class="ops-city-fields">
        <label class="wide">英文标题<input name="title" required maxlength="400" value="${escapeHtml(scholarship.title)}"></label>
        ${input("nameZh", "中文名称", 400, true)}<label>Slug<input name="slug" required maxlength="180" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(scholarship.slug)}"></label>
        ${input("type", "类型代码", 120)}${input("typeLabel", "类型名称", 200)}${input("fundingLevel", "资助层级", 160)}
        ${input("providerName", "资助方", 300)}${input("providerNameEn", "资助方英文名", 300)}${input("providerLocation", "资助方所在地", 240)}
        <label class="wide">关联学校（可选）<select name="schoolId"><option value="">全国/机构级，不绑定学校</option>${schoolOptions}</select></label>
        <label class="wide">关联项目（可选）<input name="programLink" data-scholarship-program-search list="scholarship-program-options" autocomplete="off" value="${escapeHtml(linkedProgramText)}" placeholder="输入项目名称搜索后选择"><datalist id="scholarship-program-options">${linkedProgram ? `<option value="${escapeHtml(linkedProgramText)}"></option>` : ""}</datalist><small data-scholarship-program-help>项目级奖学金会从项目派生学校；输入至少两个字符搜索。</small></label>
      </div></fieldset>
      <fieldset${disabled}><legend>资助范围与申请</legend><div class="ops-city-fields">
        <label class="wide">覆盖范围<textarea name="coverage" required rows="3" maxlength="3000">${escapeHtml(scholarship.coverage || "")}</textarea></label>
        ${input("applicableDegree", "适用学历", 1000, true)}${input("applicableProgram", "适用项目", 1000, true)}
        ${input("amountText", "金额说明", 1000, true)}
        <label class="wide">申请要求<textarea name="requirementText" rows="4" maxlength="5000">${escapeHtml(scholarship.requirementText || "")}</textarea></label>
        <label>截止日期<input name="deadlineDate" type="date" value="${escapeHtml(scholarship.deadlineDate ? new Date(scholarship.deadlineDate).toISOString().slice(0,10) : "")}"></label>
        ${input("deadlineLabel", "截止日期说明/滚动申请", 300)}${input("applicationRound", "申请轮次", 300)}
        <label class="wide">目标国家（逗号分隔）<input name="targetCountries" value="${escapeHtml((scholarship.targetCountries || []).join(", "))}"></label>
        <label class="wide">目标地区（逗号分隔）<input name="targetRegions" value="${escapeHtml((scholarship.targetRegions || []).join(", "))}"></label>
        <label class="wide">权益摘要（每行或逗号分隔）<textarea name="benefits" rows="3">${escapeHtml((scholarship.benefits || []).join("\n"))}</textarea></label>
        <label class="wide">标签（逗号分隔）<input name="tags" value="${escapeHtml((scholarship.tags || []).join(", "))}"></label>
        <label class="wide">摘要<textarea name="summary" rows="4" maxlength="5000">${escapeHtml(scholarship.summary || "")}</textarea></label>
        ${input("sortOrder", "排序", 7, false, "number")}
      </div></fieldset>
      <fieldset${disabled}><legend>结构化详情</legend><div class="ops-city-fields">${json("bodySections","正文段落",5)}${json("benefitItems","权益条目")}${json("eligibilityItems","资格条目")}${json("applicationMaterials","申请材料")}${json("applicationSteps","申请步骤")}${json("actionLinks","操作链接")}${json("contactInfo","联系信息")}</div></fieldset>
      <fieldset${disabled}><legend>官方来源证据</legend><div class="ops-city-fields">
        <label class="wide">官方来源 HTTPS 地址<input name="sourceUrl" required type="url" maxlength="2048" value="${escapeHtml(scholarship.sourceUrl || "")}"></label>
        ${input("sourceLabel", "来源名称", 200)}${input("sourceNote", "来源备注", 1000, true)}
      </div></fieldset>
      ${record?.status === "archived" ? '<p class="ops-state compact">已归档记录不可编辑；先恢复为草稿。</p>' : '<button class="ops-button primary" type="submit">保存奖学金记录</button>'}
    </form>${actions}
    ${record ? `<details class="ops-city-revisions"><summary>修订记录（${(detail.revisions || []).length}）</summary><ol>${(detail.revisions || []).map(item => `<li><strong>版本 ${escapeHtml(item.entityVersion)}</strong> · ${escapeHtml(item.action)}<span>${escapeHtml(formatDateTime(item.createdAt))}</span><small>${escapeHtml((item.changedFields || []).join("、") || "状态变更")}</small></li>`).join("")}</ol></details>` : ""}</section>`;
}

function renderScholarshipCatalogManagement(data, detail, schools, linkedProgram) {
  const root = document.querySelector("[data-ops-view]"); if (!root) return;
  root.innerHTML = `${sectionHeading("目录管理", "奖学金资助范围、关系、截止时间和官方证据已接入版本化治理。")}${renderCatalogScope("scholarship")}
    <div class="ops-catalog-toolbar"><form data-scholarship-filter><label>查找奖学金<input name="query" value="${escapeHtml(opsState.catalogQuery)}" placeholder="名称、slug、资助方或资助层级"></label>
    <label>状态<select name="status"><option value="">全部</option>${[["active","已发布"],["draft","草稿"],["archived","已归档"]].map(([value,label]) => `<option value="${value}"${opsState.catalogStatus === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
    <button class="ops-button" type="submit">筛选</button></form><button class="ops-button primary" type="button" data-scholarship-new>新建奖学金</button></div>
    <div class="ops-catalog-layout"><aside class="ops-city-list" aria-label="奖学金记录"><p><strong>${escapeHtml(data.total)}</strong> 条记录</p>${data.items.length ? data.items.map(item => `<button type="button" data-scholarship-select="${escapeHtml(item.id)}" class="${opsState.selectedScholarshipId === item.id ? "active" : ""}"><span><strong>${escapeHtml(item.nameZh || item.title)}</strong><small>${escapeHtml(item.providerName || item.providerNameEn || "资助方未填写")} · ${escapeHtml(item.fundingLevel || "层级未填写")}</small></span><span>${escapeHtml(cityStatusLabel(item.status))}<small>v${escapeHtml(item.version)}</small></span></button>`).join("") : '<p class="ops-state compact">没有符合条件的奖学金。</p>'}</aside>${renderScholarshipEditor(detail, schools, linkedProgram)}</div>`;
}

async function loadCatalogManagement() {
  const params = new URLSearchParams({ limit: "100" });
  if (opsState.catalogQuery) params.set("query", opsState.catalogQuery);
  if (opsState.catalogStatus) params.set("status", opsState.catalogStatus);
  if (opsState.catalogEntity === "scholarship") {
    const [data, schoolData] = await Promise.all([
      requestJson(`/api/v1/ops/catalog/scholarships?${params}`), requestJson("/api/v1/ops/catalog/schools?limit=100"),
    ]);
    if (opsState.selectedScholarshipId !== "__new__" && !data.items.some(item => item.id === opsState.selectedScholarshipId)) {
      opsState.selectedScholarshipId = data.items[0]?.id || "__new__";
    }
    const detail = opsState.selectedScholarshipId && opsState.selectedScholarshipId !== "__new__"
      ? await requestJson(`/api/v1/ops/catalog/scholarships/${encodeURIComponent(opsState.selectedScholarshipId)}`) : null;
    const linkedProgramDetail = detail?.scholarship?.programId
      ? await requestJson(`/api/v1/ops/catalog/programs/${encodeURIComponent(detail.scholarship.programId)}`) : null;
    renderScholarshipCatalogManagement(data, detail, schoolData.items, linkedProgramDetail?.program || null);
    return;
  }
  if (opsState.catalogEntity === "program") {
    const [data, schoolData, cityData] = await Promise.all([
      requestJson(`/api/v1/ops/catalog/programs?${params}`), requestJson("/api/v1/ops/catalog/schools?limit=100"),
      requestJson("/api/v1/ops/catalog/cities?limit=100"),
    ]);
    if (opsState.selectedProgramId !== "__new__" && !data.items.some(item => item.id === opsState.selectedProgramId)) {
      opsState.selectedProgramId = data.items[0]?.id || "__new__";
    }
    const detail = opsState.selectedProgramId && opsState.selectedProgramId !== "__new__"
      ? await requestJson(`/api/v1/ops/catalog/programs/${encodeURIComponent(opsState.selectedProgramId)}`) : null;
    renderProgramCatalogManagement(data, detail, schoolData.items, cityData.items);
    return;
  }
  if (opsState.catalogEntity === "school") {
    const [data, cityData] = await Promise.all([
      requestJson(`/api/v1/ops/catalog/schools?${params}`), requestJson("/api/v1/ops/catalog/cities?limit=100"),
    ]);
    if (opsState.selectedSchoolId !== "__new__" && !data.items.some(item => item.id === opsState.selectedSchoolId)) {
      opsState.selectedSchoolId = data.items[0]?.id || "__new__";
    }
    const detail = opsState.selectedSchoolId && opsState.selectedSchoolId !== "__new__"
      ? await requestJson(`/api/v1/ops/catalog/schools/${encodeURIComponent(opsState.selectedSchoolId)}`) : null;
    renderSchoolCatalogManagement(data, detail, cityData.items);
    return;
  }
  const data = await requestJson(`/api/v1/ops/catalog/cities?${params}`);
  if (opsState.selectedCityId !== "__new__" && !data.items.some(item => item.id === opsState.selectedCityId)) {
    opsState.selectedCityId = data.items[0]?.id || "__new__";
  }
  const detail = opsState.selectedCityId && opsState.selectedCityId !== "__new__"
    ? await requestJson(`/api/v1/ops/catalog/cities/${encodeURIComponent(opsState.selectedCityId)}`) : null;
  renderCatalogManagement(data, detail);
}

function schoolDocumentFromForm(form) {
  const values = new FormData(form), nullable = name => cleanText(values.get(name)) || null;
  const numberOrNull = value => cleanText(value) === "" ? null : Number(value);
  return {
    slug: cleanText(values.get("slug")).toLowerCase(), nameZh: nullable("nameZh"), nameEn: cleanText(values.get("nameEn")),
    schoolType: nullable("schoolType"), region: nullable("region"), cityId: cleanText(values.get("cityId")),
    city: nullable("city"), cityZh: nullable("cityZh"), citySlug: nullable("citySlug"), province: nullable("province"),
    regionLabel: nullable("regionLabel"), ranking: nullable("ranking"), cscaRequired: values.get("cscaRequired") === "true",
    cscaRequirement: nullable("cscaRequirement"), cscaSubjects: schoolList(values.get("cscaSubjects")),
    applicationLevel: nullable("applicationLevel"), languageOfInstruction: nullable("languageOfInstruction"),
    languageRequirement: nullable("languageRequirement"), hskRequirement: nullable("hskRequirement"),
    englishRequirement: nullable("englishRequirement"), deadlineSummary: nullable("deadlineSummary"),
    tuitionSummary: nullable("tuitionSummary"), applicationFee: nullable("applicationFee"),
    websiteUrl: cleanText(values.get("websiteUrl")), admissionsUrl: nullable("admissionsUrl"),
    subjectTags: schoolList(values.get("subjectTags")), fitNotes: nullable("fitNotes"),
    languageTags: schoolList(values.get("languageTags")), tuitionBandLabel: nullable("tuitionBandLabel"),
    campusHighlights: schoolList(values.get("campusHighlights")), contactNotes: nullable("contactNotes"),
    qualityScore: numberOrNull(values.get("qualityScore")), missingFields: schoolList(values.get("missingFields")),
    completenessLabel: nullable("completenessLabel"), sourceUrl: cleanText(values.get("sourceUrl")),
    sourceLabel: cleanText(values.get("sourceLabel")), sourceNote: nullable("sourceNote"),
  };
}

async function submitSchoolEditor(form) {
  if (opsState.busy) return;
  const schoolId = cleanText(form.dataset.schoolId), expectedVersion = Number(form.dataset.version);
  const button = form.querySelector('button[type="submit"]'); opsState.busy = true; if (button) button.disabled = true;
  try {
    const schoolDocument = schoolDocumentFromForm(form);
    const school = await requestJson(schoolId ? `/api/v1/ops/catalog/schools/${encodeURIComponent(schoolId)}` : "/api/v1/ops/catalog/schools", {
      method: schoolId ? "PATCH" : "POST", body: JSON.stringify(schoolId ? { expectedVersion, document: schoolDocument } : schoolDocument),
    });
    opsState.selectedSchoolId = school.id;
    showOpsToast(schoolId ? "学校记录已保存，并生成新的修订版本。" : "学校草稿已创建。");
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    showOpsToast(error?.status === 409 ? "记录或城市关系已变化，请基于最新版本继续编辑。" : error.message || "学校记录保存失败。");
  } finally { opsState.busy = false; if (button && document.contains(button)) button.disabled = false; }
}

async function submitSchoolLifecycle(form) {
  if (opsState.busy) return;
  const action = form.dataset.schoolLifecycle, schoolId = form.dataset.schoolId, expectedVersion = Number(form.dataset.version);
  if (!hasStepUpAdminAuthority() || !["publish", "archive", "restore"].includes(action)) return;
  const endpoint = action === "publish" ? "publication" : action, body = { expectedVersion };
  if (action === "publish") body.reviewDueAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
  opsState.busy = true;
  try {
    await requestJson(`/api/v1/ops/catalog/schools/${encodeURIComponent(schoolId)}/${endpoint}`,
      { method: "POST", body: JSON.stringify(body) });
    showOpsToast({ publish: "学校已发布并登记下次复核时间。", archive: "学校已归档。", restore: "学校已恢复为草稿。" }[action]);
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    if (error?.status === 403) { opsState.authStrength = "session"; renderAuthCapability(); }
    showOpsToast(error?.status === 409 ? "学校状态已变化或仍有活动依赖，请检查后重试。" : error.message || "学校状态操作失败。");
  } finally { opsState.busy = false; }
}

function programDocumentFromForm(form) {
  const values = new FormData(form), nullable = name => cleanText(values.get(name)) || null;
  const numberOrNull = name => cleanText(values.get(name)) === "" ? null : Number(values.get(name));
  return { schoolId: cleanText(values.get("schoolId")), cityId: cleanText(values.get("cityId")),
    slug: cleanText(values.get("slug")).toLowerCase(), nameZh: nullable("nameZh"), nameEn: cleanText(values.get("nameEn")),
    degreeLevel: cleanText(values.get("degreeLevel")), durationYears: numberOrNull("durationYears"),
    durationMonths: numberOrNull("durationMonths"), fieldCategory: nullable("fieldCategory"), subjectArea: nullable("subjectArea"),
    teachingLanguage: nullable("teachingLanguage"), cscaSubjects: schoolList(values.get("cscaSubjects")),
    cscaRequirement: nullable("cscaRequirement"), hskRequirement: nullable("hskRequirement"),
    englishRequirement: nullable("englishRequirement"), tuitionAmount: numberOrNull("tuitionAmount"),
    tuitionCurrency: nullable("tuitionCurrency"), tuitionPeriod: nullable("tuitionPeriod"), tuitionText: nullable("tuitionText"),
    scholarshipText: nullable("scholarshipText"), applicationUrl: nullable("applicationUrl"),
    applicationNote: nullable("applicationNote"), hasScholarship: values.get("hasScholarship") === "true",
    badgeText: nullable("badgeText"), displayTuition: nullable("displayTuition"),
    displaySubjects: schoolList(values.get("displaySubjects")), displayGroup: nullable("displayGroup"),
    displayGroupLabel: nullable("displayGroupLabel"), sortOrder: Number(values.get("sortOrder") || 0),
    sourceUrl: cleanText(values.get("sourceUrl")), sourceLabel: cleanText(values.get("sourceLabel")),
    sourceNote: nullable("sourceNote") };
}

async function submitProgramEditor(form) {
  if (opsState.busy) return;
  const programId = cleanText(form.dataset.programId), expectedVersion = Number(form.dataset.version);
  const button = form.querySelector('button[type="submit"]'); opsState.busy = true; if (button) button.disabled = true;
  try {
    const programDocument = programDocumentFromForm(form);
    const program = await requestJson(programId ? `/api/v1/ops/catalog/programs/${encodeURIComponent(programId)}` : "/api/v1/ops/catalog/programs", {
      method: programId ? "PATCH" : "POST", body: JSON.stringify(programId ? { expectedVersion, document: programDocument } : programDocument),
    });
    opsState.selectedProgramId = program.id;
    showOpsToast(programId ? "项目记录已保存，并生成新的修订版本。" : "项目草稿已创建。");
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    showOpsToast(error?.status === 409 ? "记录或学校、城市关系已变化，请基于最新版本继续编辑。" : error.message || "项目记录保存失败。");
  } finally { opsState.busy = false; if (button && document.contains(button)) button.disabled = false; }
}

async function submitProgramLifecycle(form) {
  if (opsState.busy) return;
  const action = form.dataset.programLifecycle, programId = form.dataset.programId, expectedVersion = Number(form.dataset.version);
  if (!hasStepUpAdminAuthority() || !["publish","archive","restore"].includes(action)) return;
  const endpoint = action === "publish" ? "publication" : action, body = { expectedVersion };
  if (action === "publish") body.reviewDueAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
  opsState.busy = true;
  try {
    await requestJson(`/api/v1/ops/catalog/programs/${encodeURIComponent(programId)}/${endpoint}`,
      { method: "POST", body: JSON.stringify(body) });
    showOpsToast({ publish: "项目已发布并登记下次复核时间。", archive: "项目已归档。", restore: "项目已恢复为草稿。" }[action]);
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    if (error?.status === 403) { opsState.authStrength = "session"; renderAuthCapability(); }
    showOpsToast(error?.status === 409 ? "项目状态已变化或仍有活动依赖，请检查后重试。" : error.message || "项目状态操作失败。");
  } finally { opsState.busy = false; }
}

function scholarshipDocumentFromForm(form) {
  const values = new FormData(form), nullable = name => cleanText(values.get(name)) || null;
  const parseJson = (name, fallback) => {
    try { const value = JSON.parse(String(values.get(name) || JSON.stringify(fallback))); if (Array.isArray(fallback) !== Array.isArray(value)) throw new Error(); return value; }
    catch { throw new OpsRequestError(`${name} 必须是有效的${Array.isArray(fallback) ? "JSON 数组" : "JSON 对象"}。`, 400, "INVALID_INPUT"); }
  };
  const programLink = cleanText(values.get("programLink"));
  const match = programLink.match(/([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i);
  if (programLink && !match) throw new OpsRequestError("请从项目搜索建议中选择一个完整项目。", 400, "INVALID_INPUT");
  const deadline = cleanText(values.get("deadlineDate"));
  return { slug: cleanText(values.get("slug")).toLowerCase(), title: cleanText(values.get("title")), nameZh: nullable("nameZh"),
    type: nullable("type"), typeLabel: nullable("typeLabel"), fundingLevel: nullable("fundingLevel"),
    providerName: nullable("providerName"), providerNameEn: nullable("providerNameEn"), providerLocation: nullable("providerLocation"),
    schoolId: nullable("schoolId"), programId: match?.[1] || null, coverage: nullable("coverage"),
    applicableDegree: nullable("applicableDegree"), applicableProgram: nullable("applicableProgram"),
    amountText: nullable("amountText"), requirementText: nullable("requirementText"), bodySections: parseJson("bodySections", []),
    benefitItems: parseJson("benefitItems", []), eligibilityItems: parseJson("eligibilityItems", []),
    applicationMaterials: parseJson("applicationMaterials", []), applicationSteps: parseJson("applicationSteps", []),
    contactInfo: parseJson("contactInfo", {}), actionLinks: parseJson("actionLinks", []),
    deadlineDate: deadline ? `${deadline}T23:59:59.000Z` : null, deadlineLabel: nullable("deadlineLabel"),
    applicationRound: nullable("applicationRound"), targetCountries: schoolList(values.get("targetCountries")),
    targetRegions: schoolList(values.get("targetRegions")), benefits: schoolList(values.get("benefits")),
    tags: schoolList(values.get("tags")), summary: nullable("summary"), sortOrder: Number(values.get("sortOrder") || 0),
    sourceUrl: cleanText(values.get("sourceUrl")), sourceLabel: cleanText(values.get("sourceLabel")), sourceNote: nullable("sourceNote") };
}

async function submitScholarshipEditor(form) {
  if (opsState.busy) return;
  const scholarshipId = cleanText(form.dataset.scholarshipId), expectedVersion = Number(form.dataset.version);
  const button = form.querySelector('button[type="submit"]'); opsState.busy = true; if (button) button.disabled = true;
  try {
    const scholarshipDocument = scholarshipDocumentFromForm(form);
    const scholarship = await requestJson(scholarshipId ? `/api/v1/ops/catalog/scholarships/${encodeURIComponent(scholarshipId)}` : "/api/v1/ops/catalog/scholarships", {
      method: scholarshipId ? "PATCH" : "POST", body: JSON.stringify(scholarshipId ? { expectedVersion, document: scholarshipDocument } : scholarshipDocument),
    });
    opsState.selectedScholarshipId = scholarship.id;
    showOpsToast(scholarshipId ? "奖学金记录已保存，并生成新的修订版本。" : "奖学金草稿已创建。");
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    showOpsToast(error?.status === 409 ? "记录或学校、项目关系已变化，请基于最新版本继续编辑。" : error.message || "奖学金记录保存失败。");
  } finally { opsState.busy = false; if (button && document.contains(button)) button.disabled = false; }
}

async function submitScholarshipLifecycle(form) {
  if (opsState.busy) return;
  const action = form.dataset.scholarshipLifecycle, scholarshipId = form.dataset.scholarshipId, expectedVersion = Number(form.dataset.version);
  if (!hasStepUpAdminAuthority() || !["publish","archive","restore"].includes(action)) return;
  const endpoint = action === "publish" ? "publication" : action, body = { expectedVersion };
  if (action === "publish") body.reviewDueAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
  opsState.busy = true;
  try {
    await requestJson(`/api/v1/ops/catalog/scholarships/${encodeURIComponent(scholarshipId)}/${endpoint}`,
      { method: "POST", body: JSON.stringify(body) });
    showOpsToast({ publish: "奖学金已发布并登记下次复核时间。", archive: "奖学金已归档。", restore: "奖学金已恢复为草稿。" }[action]);
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    if (error?.status === 403) { opsState.authStrength = "session"; renderAuthCapability(); }
    showOpsToast(error?.status === 409 ? "奖学金状态已变化或仍有当前申请依赖，请检查后重试。" : error.message || "奖学金状态操作失败。");
  } finally { opsState.busy = false; }
}

let scholarshipProgramSearchTimer = null;
function scheduleScholarshipProgramSearch(input) {
  clearTimeout(scholarshipProgramSearchTimer);
  const query = cleanText(input.value).replace(/\s+—\s+[a-f0-9-]{36}$/i, "");
  if (query.length < 2) return;
  scholarshipProgramSearchTimer = setTimeout(async () => {
    try {
      const data = await requestJson(`/api/v1/ops/catalog/programs?limit=20&status=active&query=${encodeURIComponent(query)}`);
      const list = input.closest("form")?.querySelector("#scholarship-program-options");
      if (list) list.innerHTML = data.items.map(item => `<option value="${escapeHtml(`${item.nameZh || item.nameEn} — ${item.id}`)}">${escapeHtml(`${item.nameEn} · ${item.degreeLevel}`)}</option>`).join("");
      const help = input.closest("label")?.querySelector("[data-scholarship-program-help]");
      if (help) help.textContent = data.items.length ? `找到 ${data.items.length} 个已发布项目，请选择完整项目。` : "没有找到匹配的已发布项目。";
    } catch { /* keep the form usable; submit remains fail-closed */ }
  }, 250);
}

function cityDocumentFromForm(form) {
  const values = new FormData(form);
  let content;
  try { content = JSON.parse(String(values.get("content") || "{}")); }
  catch { throw new OpsRequestError("城市内容 JSON 格式不正确。", 400, "INVALID_INPUT"); }
  if (!isRecord(content)) throw new OpsRequestError("城市内容必须是 JSON 对象。", 400, "INVALID_INPUT");
  const numberOrNull = value => cleanText(value) === "" ? null : Number(value);
  return {
    slug: cleanText(values.get("slug")).toLowerCase(), nameZh: cleanText(values.get("nameZh")) || null,
    nameEn: cleanText(values.get("nameEn")), region: cleanText(values.get("region")) || null,
    province: cleanText(values.get("province")) || null, monthlyCost: cleanText(values.get("monthlyCost")) || null,
    monthlyCostRmb: numberOrNull(values.get("monthlyCostRmb")), costLevel: cleanText(values.get("costLevel")) || null,
    density: cleanText(values.get("density")) || null, tags: splitCityList(values.get("tags")), content,
    nearby: splitCityList(values.get("nearby")), sortOrder: Number(values.get("sortOrder") || 0),
    sourceUrl: cleanText(values.get("sourceUrl")), sourceLabel: cleanText(values.get("sourceLabel")),
    sourceNote: cleanText(values.get("sourceNote")) || null,
  };
}

async function submitCityEditor(form) {
  if (opsState.busy) return;
  const cityId = cleanText(form.dataset.cityId), expectedVersion = Number(form.dataset.version), button = form.querySelector('button[type="submit"]');
  opsState.busy = true; if (button) button.disabled = true;
  try {
    const cityDocument = cityDocumentFromForm(form);
    const city = await requestJson(cityId ? `/api/v1/ops/catalog/cities/${encodeURIComponent(cityId)}` : "/api/v1/ops/catalog/cities", {
      method: cityId ? "PATCH" : "POST", body: JSON.stringify(cityId ? { expectedVersion, document: cityDocument } : cityDocument),
    });
    opsState.selectedCityId = city.id;
    showOpsToast(cityId ? "城市记录已保存，并生成新的修订版本。" : "城市草稿已创建。");
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    showOpsToast(error?.status === 409 ? "记录已被其他管理员更新，请基于最新版本继续编辑。" : error.message || "城市记录保存失败。");
  } finally { opsState.busy = false; if (button && document.contains(button)) button.disabled = false; }
}

async function submitCityLifecycle(form) {
  if (opsState.busy) return;
  const action = form.dataset.cityLifecycle, cityId = form.dataset.cityId, expectedVersion = Number(form.dataset.version);
  if (!hasStepUpAdminAuthority() || !["publish", "archive", "restore"].includes(action)) return;
  const endpoint = action === "publish" ? "publication" : action;
  const body = { expectedVersion };
  if (action === "publish") body.reviewDueAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
  opsState.busy = true;
  try {
    await requestJson(`/api/v1/ops/catalog/cities/${encodeURIComponent(cityId)}/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
    showOpsToast({ publish: "城市已发布并登记下次复核时间。", archive: "城市已归档。", restore: "城市已恢复为草稿。" }[action]);
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    if (error?.status === 403) { opsState.authStrength = "session"; renderAuthCapability(); }
    showOpsToast(error?.status === 409 ? "城市状态已变化，请基于最新版本重试。" : error.message || "城市状态操作失败。");
  } finally { opsState.busy = false; }
}

async function loadCurrentView() {
  renderLoading();
  try {
    if (opsState.view === "overview") renderOverview(await requestJson("/api/v1/ops/operations/summary"));
    else if (opsState.view === "routing") renderRouting(await requestJson("/api/v1/ops/routing/submissions?limit=50"));
    else if (opsState.view === "billing") renderBilling(await requestJson("/api/v1/ops/billing/provider-events?limit=50"));
    else if (opsState.view === "quality") renderQuality(await requestJson(qualityRequestPath()));
    else if (opsState.view === "readiness") renderReadiness(await requestJson(readinessRequestPath()));
    else if (opsState.view === "release-plans") await loadReleasePlans();
    else if (opsState.view === "catalog") await loadCatalogManagement();
    else if (opsState.view === "corrections") renderCorrections(await requestJson("/api/v1/ops/catalog-corrections?limit=50"));
    else if (opsState.view === "guides") await loadGuideManagement();
    else if (opsState.view === "privacy") renderDataRights(await requestJson("/api/v1/ops/data-rights/requests?limit=100"));
    else if (opsState.view === "deletions") renderAccountDeletions(await requestJson("/api/v1/ops/account-deletions?limit=100"));
    else renderSupport();
  } catch (error) {
    if (error?.status === 401) {
      window.CUAC?.requireSignedIn?.("打开运营控制台", {
        requiredRole: "cuac_ops",
        resumeAction: { type: "navigate", href: "ops-admin-api.html" },
      });
      return;
    }
    showOpsError(error);
  }
}

async function closeSupportSession({ quiet = false, keepalive = false } = {}) {
  const sessionId = opsState.supportSession?.supportSessionId;
  if (!sessionId) return;
  opsState.supportSession = null;
  opsState.supportProjection = null;
  try {
    await requestJson(`/api/v1/ops/support-sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      keepalive,
    });
    if (!quiet) showOpsToast("支持会话已结束。");
  } catch (error) {
    if (!quiet) showOpsToast(error.message || "支持会话关闭请求未完成。");
  }
}

async function openSupportSession(form) {
  if (opsState.busy) return;
  const values = new FormData(form);
  const cuacId = cleanText(values.get("cuacId")).toUpperCase();
  const reasonCode = cleanText(values.get("reasonCode"));
  opsState.busy = true;
  form.querySelector("button[type=submit]")?.setAttribute("disabled", "");
  try {
    await closeSupportSession({ quiet: true });
    const session = await requestJson("/api/v1/ops/support-sessions", {
      method: "POST",
      body: JSON.stringify({ cuacId, reasonCode }),
    });
    if (session === null) {
      showOpsToast("没有找到这个 CUAC 编号对应的 Application Set。");
      renderSupport();
      return;
    }
    if (!isRecord(session) || typeof session.supportSessionId !== "string" || session.cuacId !== cuacId) {
      throw new OpsRequestError("支持会话响应不符合前端数据契约。", 503, "INVALID_RESPONSE");
    }
    opsState.supportSession = session;
    const projection = await requestJson("/api/v1/ops/application-lookups", {
      method: "POST",
      body: JSON.stringify({ supportSessionId: session.supportSessionId }),
    });
    if (!isRecord(projection) || projection.cuacId !== cuacId || !Array.isArray(projection.programApplications)) {
      throw new OpsRequestError("申请支持投影不符合前端数据契约。", 503, "INVALID_RESPONSE");
    }
    opsState.supportProjection = projection;
    renderSupport();
    showOpsToast("限时支持会话已打开。");
  } catch (error) {
    await closeSupportSession({ quiet: true });
    showOpsToast(error?.status === 403 ? "当前授权不允许打开这项支持查询。" : error.message || "申请支持查询失败。");
    renderSupport();
  } finally {
    opsState.busy = false;
    form.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

function actionRequest(form) {
  const kind = form.dataset.kind;
  const target = form.dataset.target;
  const action = form.dataset.action;
  const revision = Number(form.dataset.revision);
  const values = new FormData(form);
  const body = { expectedRevision: revision };
  if (["escalate", "resolve", "retry"].includes(action)) {
    body.code = cleanText(values.get("code"));
    body.reference = cleanText(values.get("reference"));
  }
  let path;
  if (kind === "routing") {
    const suffix = { claim: "review-claim", escalate: "review-escalation", resolve: "review-close", retry: "review-retry" }[action];
    path = `/api/v1/ops/routing/submissions/${encodeURIComponent(target)}/${suffix}`;
  } else if (kind === "billing") {
    const suffix = { claim: "review-claim", escalate: "review-escalation", resolve: "review-resolution" }[action];
    path = `/api/v1/ops/billing/provider-events/${encodeURIComponent(target)}/${suffix}`;
  } else if (kind === "quality") {
    const [entityType, entityId] = target.split(":");
    const suffix = { claim: "review-claim", escalate: "review-escalation", resolve: "review-resolution" }[action];
    path = `/api/v1/ops/data-quality/catalog/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/${suffix}`;
    if (action === "resolve" && body.code === "source_confirmed") {
      const due = cleanText(values.get("reviewDueAt"));
      if (!due || !Number.isFinite(new Date(due).getTime())) throw new OpsRequestError("确认来源时必须填写有效的下次复核时间。", 400, "INVALID_INPUT");
      body.reviewDueAt = new Date(due).toISOString();
    }
  } else if (kind === "correction") {
    const suffix = action === "claim" ? "claim" : action === "resolve" ? "resolution" : null;
    if (suffix) path = `/api/v1/ops/catalog-corrections/${encodeURIComponent(target)}/${suffix}`;
  } else if (kind === "privacy") {
    path = `/api/v1/ops/data-rights/requests/${encodeURIComponent(target)}/${action}`;
    if (action === "escalate") body.expectedReviewRevision = Number(form.dataset.reviewRevision);
    else if (action === "deadline-extension") {
      body.extensionId = crypto.randomUUID();
      body.expectedReviewRevision = Number(form.dataset.reviewRevision);
      body.reasonCode = cleanText(values.get("reasonCode"));
      body.caseReference = cleanText(values.get("caseReference"));
      const due = cleanText(values.get("extendedDueAt"));
      if (!due || !Number.isFinite(new Date(due).getTime())) throw new OpsRequestError("必须填写有效的新答复时间。", 400, "INVALID_INPUT");
      const originalDue = new Date(form.dataset.responseDue).getTime(), nextDue = new Date(due).getTime();
      if (!Number.isFinite(originalDue) || originalDue <= Date.now() || nextDue <= originalDue || nextDue > originalDue + 60 * 86400000) {
        throw new OpsRequestError("新期限必须晚于原期限、不得超过原期限 60 天，且批准必须发生在原期限前。", 400, "INVALID_INPUT");
      }
      body.extendedDueAt = new Date(due).toISOString();
    }
    else if (action === "outcome") {
      body.proposalId = crypto.randomUUID();
      body.expectedReviewRevision = Number(form.dataset.reviewRevision);
      body.outcomeCode = cleanText(values.get("outcomeCode"));
      body.reasonCode = cleanText(values.get("reasonCode")) || null;
      body.caseReference = cleanText(values.get("caseReference"));
      const denialReasons = ["identity_not_proven", "request_out_of_scope", "legal_restriction"];
      const retentionReasons = ["legal_hold", "fraud_or_security", "financial_record"];
      if (body.outcomeCode === "request_denied" && !denialReasons.includes(body.reasonCode)) {
        throw new OpsRequestError("请求不予处理时必须选择对应的固定原因。", 400, "INVALID_INPUT");
      }
      if (body.outcomeCode === "retention_exception" && !retentionReasons.includes(body.reasonCode)) {
        throw new OpsRequestError("适用保留例外时必须选择对应的固定原因。", 400, "INVALID_INPUT");
      }
      if (!['request_denied', 'retention_exception'].includes(body.outcomeCode)) body.reasonCode = null;
    } else if (action === "outcome-approval") {
      delete body.expectedRevision;
      body.expectedOutcomeRevision = Number(form.dataset.outcomeRevision);
      body.expectedProposalSha256 = cleanText(form.dataset.proposalSha);
    }
  } else if (kind === "deletion") {
    path = `/api/v1/ops/account-deletions/${encodeURIComponent(target)}/${action}`;
    if (action === "legal-hold-review") {
      body.reviewId = crypto.randomUUID();
      body.result = cleanText(values.get("result"));
      body.reasonCode = cleanText(values.get("reasonCode"));
      body.caseReference = cleanText(values.get("caseReference"));
      if ((body.result === "clear_candidate") !== (body.reasonCode === "no_hold_found")) {
        throw new OpsRequestError("未发现保留事项只能选择对应原因；阻塞结论必须选择具体保留原因。", 400, "INVALID_INPUT");
      }
    }
  }
  if (!path || (action !== "outcome-approval" && (!Number.isSafeInteger(revision) || revision < 0))) {
    throw new OpsRequestError("运营操作参数无效。", 400, "INVALID_INPUT");
  }
  return { path, body };
}

async function submitOpsAction(form) {
  if (opsState.busy) return;
  opsState.busy = true;
  form.querySelector("button[type=submit]")?.setAttribute("disabled", "");
  try {
    const { path, body } = actionRequest(form);
    await requestJson(path, { method: "POST", body: JSON.stringify(body) });
    showOpsToast("复核状态已由服务器确认。");
    await loadCurrentView();
  } catch (error) {
    if (error?.status === 409) await loadCurrentView();
    if (error?.status === 403 && opsState.role === "cuac_admin") {
      opsState.authStrength = "session";
      renderAuthCapability();
    }
    showOpsToast(error?.status === 403
      ? "当前授权、认领关系或二次验证不允许这项操作。"
      : error.message || "复核操作失败。");
  } finally {
    opsState.busy = false;
    form.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

async function stepUpAdminSession(form) {
  if (opsState.busy || opsState.role !== "cuac_admin") return;
  const password = String(new FormData(form).get("password") || "");
  const code = String(new FormData(form).get("code") || "");
  const button = form.querySelector("button[type=submit]");
  opsState.busy = true;
  if (button) button.disabled = true;
  try {
    const result = await requestJson("/api/v1/auth/step-up", {
      method: "POST",
      body: JSON.stringify({ password, code }),
    });
    form.reset();
    if (!isRecord(result) || result.authStrength !== "step_up") {
      throw new OpsRequestError("二次验证响应不符合前端数据契约。", 503, "INVALID_RESPONSE");
    }
    opsState.authStrength = "step_up";
    renderAuthCapability();
    showOpsToast("二次验证已完成，最终操作会继续受双人复核规则约束。");
    await loadCurrentView();
  } catch (error) {
    form.reset();
    showOpsToast(error?.status === 401 || error?.status === 403 ? "密码或动态验证码验证失败，最终操作仍保持锁定。" : error.message || "二次验证未完成。");
  } finally {
    opsState.busy = false;
    if (button && document.contains(button)) button.disabled = false;
  }
}

async function selectOpsView(view) {
  if (!["overview", "routing", "billing", "quality", "readiness", "release-plans", "catalog", "corrections", "guides", "support", "privacy", "deletions"].includes(view) || view === opsState.view) return;
  if (opsState.view === "support") await closeSupportSession({ quiet: true });
  opsState.view = view;
  document.querySelectorAll("[data-ops-tab]").forEach(button => {
    button.setAttribute("aria-selected", String(button.dataset.opsTab === view));
  });
  await loadCurrentView();
}

function bindOpsEvents() {
  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-ops-tab]");
    if (tab) void selectOpsView(tab.dataset.opsTab);
    const priorityView = event.target.closest("[data-ops-open-view]");
    if (priorityView) void selectOpsView(priorityView.dataset.opsOpenView);
    if (event.target.closest("[data-ops-refresh]")) void loadCurrentView();
    if (event.target.closest("[data-close-support]")) void closeSupportSession().then(renderSupport);
    const qualityPage = event.target.closest("[data-quality-page]");
    if (qualityPage) void changeQualityPage(qualityPage.dataset.qualityPage);
    const readinessRecord = event.target.closest("[data-readiness-open]");
    if (readinessRecord) {
      const type = readinessRecord.dataset.readinessOpen, id = readinessRecord.dataset.readinessId;
      opsState.catalogEntity = type;
      if (type === "city") opsState.selectedCityId = id;
      else if (type === "school") opsState.selectedSchoolId = id;
      else if (type === "program") opsState.selectedProgramId = id;
      else if (type === "scholarship") opsState.selectedScholarshipId = id;
      void selectOpsView("catalog");
    }
    const manifest = event.target.closest("[data-release-manifest-select]");
    if (manifest) { opsState.selectedReleaseManifestId=manifest.dataset.releaseManifestSelect; void loadCurrentView(); }
    const guide = event.target.closest("[data-guide-select]");
    if (guide) { opsState.selectedGuideId = guide.dataset.guideSelect; void loadCurrentView(); }
    const city = event.target.closest("[data-city-select]");
    if (city) { opsState.selectedCityId = city.dataset.citySelect; void loadCurrentView(); }
    if (event.target.closest("[data-city-new]")) { opsState.selectedCityId = "__new__"; void loadCurrentView(); }
    const school = event.target.closest("[data-school-select]");
    if (school) { opsState.selectedSchoolId = school.dataset.schoolSelect; void loadCurrentView(); }
    if (event.target.closest("[data-school-new]")) { opsState.selectedSchoolId = "__new__"; void loadCurrentView(); }
    const program = event.target.closest("[data-program-select]");
    if (program) { opsState.selectedProgramId = program.dataset.programSelect; void loadCurrentView(); }
    if (event.target.closest("[data-program-new]")) { opsState.selectedProgramId = "__new__"; void loadCurrentView(); }
    const scholarship = event.target.closest("[data-scholarship-select]");
    if (scholarship) { opsState.selectedScholarshipId = scholarship.dataset.scholarshipSelect; void loadCurrentView(); }
    if (event.target.closest("[data-scholarship-new]")) { opsState.selectedScholarshipId = "__new__"; void loadCurrentView(); }
    const catalogEntity = event.target.closest("[data-catalog-entity]");
    if (catalogEntity && catalogEntity.dataset.catalogEntity !== opsState.catalogEntity) {
      opsState.catalogEntity = catalogEntity.dataset.catalogEntity;
      opsState.catalogQuery = ""; opsState.catalogStatus = "";
      void loadCurrentView();
    }
  });
  document.addEventListener("submit", event => {
    if (event.target.matches("[data-open-support]")) {
      event.preventDefault();
      void openSupportSession(event.target);
    }
    if (event.target.matches("[data-ops-action-form]")) {
      event.preventDefault();
      void submitOpsAction(event.target);
    }
    if (event.target.matches("[data-ops-step-up]")) {
      event.preventDefault();
      void stepUpAdminSession(event.target);
    }
    if (event.target.matches("[data-guide-draft]")) {
      event.preventDefault();
      void submitGuideDraft(event.target);
    }
    if (event.target.matches("[data-guide-command]")) {
      event.preventDefault();
      void submitGuideCommand(event.target);
    }
    if (event.target.matches("[data-city-editor]")) {
      event.preventDefault();
      void submitCityEditor(event.target);
    }
    if (event.target.matches("[data-city-lifecycle]")) {
      event.preventDefault();
      void submitCityLifecycle(event.target);
    }
    if (event.target.matches("[data-school-editor]")) {
      event.preventDefault();
      void submitSchoolEditor(event.target);
    }
    if (event.target.matches("[data-school-lifecycle]")) {
      event.preventDefault();
      void submitSchoolLifecycle(event.target);
    }
    if (event.target.matches("[data-program-editor]")) {
      event.preventDefault();
      void submitProgramEditor(event.target);
    }
    if (event.target.matches("[data-program-lifecycle]")) {
      event.preventDefault();
      void submitProgramLifecycle(event.target);
    }
    if (event.target.matches("[data-scholarship-editor]")) {
      event.preventDefault();
      void submitScholarshipEditor(event.target);
    }
    if (event.target.matches("[data-scholarship-lifecycle]")) {
      event.preventDefault();
      void submitScholarshipLifecycle(event.target);
    }
    if (event.target.matches("[data-readiness-filter]")) {
      event.preventDefault();
      const values = new FormData(event.target);
      opsState.readinessQuery = cleanText(values.get("query"));
      opsState.readinessEntityType = cleanText(values.get("entityType"));
      opsState.readinessStatus = cleanText(values.get("status"));
      opsState.readinessState = cleanText(values.get("readiness"));
      opsState.readinessReason = cleanText(values.get("reason"));
      void loadCurrentView();
    }
    if (event.target.matches("[data-release-manifest-create]")) {
      event.preventDefault(); void submitReleaseManifest(event.target);
    }
    if (event.target.matches("[data-release-manifest-supersede]")) {
      event.preventDefault(); void supersedeReleaseManifest(event.target);
    }
    if (event.target.matches("[data-release-manifest-filter]")) {
      event.preventDefault(); opsState.releaseManifestStatus=cleanText(new FormData(event.target).get("status"));
      opsState.selectedReleaseManifestId=null; void loadCurrentView();
    }
    if (event.target.matches("[data-city-filter]")) {
      event.preventDefault();
      const values = new FormData(event.target);
      opsState.catalogQuery = cleanText(values.get("query"));
      opsState.catalogStatus = cleanText(values.get("status"));
      opsState.selectedCityId = null;
      void loadCurrentView();
    }
    if (event.target.matches("[data-school-filter]")) {
      event.preventDefault();
      const values = new FormData(event.target);
      opsState.catalogQuery = cleanText(values.get("query"));
      opsState.catalogStatus = cleanText(values.get("status"));
      opsState.selectedSchoolId = null;
      void loadCurrentView();
    }
    if (event.target.matches("[data-program-filter]")) {
      event.preventDefault();
      const values = new FormData(event.target);
      opsState.catalogQuery = cleanText(values.get("query"));
      opsState.catalogStatus = cleanText(values.get("status"));
      opsState.selectedProgramId = null;
      void loadCurrentView();
    }
    if (event.target.matches("[data-scholarship-filter]")) {
      event.preventDefault();
      const values = new FormData(event.target);
      opsState.catalogQuery = cleanText(values.get("query"));
      opsState.catalogStatus = cleanText(values.get("status"));
      opsState.selectedScholarshipId = null;
      void loadCurrentView();
    }
  });
  document.addEventListener("input", event => {
    if (event.target.matches("[data-scholarship-program-search]")) scheduleScholarshipProgramSearch(event.target);
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-release-select]")) {
      const key=event.target.dataset.releaseSelect;
      if(event.target.checked) opsState.releaseSelection.set(key,{ entityType:event.target.dataset.entityType,
        entityId:event.target.dataset.entityId,expectedVersion:Number(event.target.dataset.version),label:event.target.dataset.label });
      else opsState.releaseSelection.delete(key);
      refreshReleaseSelectionPanel();
      return;
    }
    const form = event.target.closest('[data-ops-action-form][data-kind="quality"][data-action="resolve"]');
    if (!form || event.target.name !== "code") return;
    const due = form.querySelector("[data-review-due]");
    if (due) due.hidden = event.target.value !== "source_confirmed";
  });
  window.addEventListener("pagehide", () => {
    if (!opsState.supportSession?.supportSessionId) return;
    void closeSupportSession({ quiet: true, keepalive: true });
  });
}

async function startOpsWorkspace() {
  bindOpsEvents();
  const auth = await window.CUAC?.authReady?.();
  if (!auth || auth.authState !== "signed-in" || !["cuac_ops", "cuac_admin"].includes(auth.role)) {
    if (!auth || auth.authState !== "signed-out") return;
    window.CUAC?.requireSignedIn?.("打开运营控制台", {
      requiredRole: "cuac_ops",
      resumeAction: { type: "navigate", href: "ops-admin-api.html" },
    });
    return;
  }
  opsState.role = auth.role;
  opsState.authStrength = auth.authStrength === "step_up" ? "step_up" : "session";
  const role = document.querySelector("[data-ops-role]");
  if (role) role.textContent = auth.role === "cuac_admin" ? "CUAC 管理员" : "CUAC 运营";
  renderAuthCapability();
  await loadCurrentView();
}

void startOpsWorkspace();
