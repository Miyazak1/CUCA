const opsQueueLabels = {
  auth_email_delivery: "账户邮件投递",
  notification_delivery: "通知投递",
  student_file_processing: "学生文件处理",
  official_submission_delivery: "正式申请投递",
  payment_reconciliation: "支付对账",
};

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
};

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
  view: "overview",
  busy: false,
  supportSession: null,
  supportProjection: null,
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
  root.innerHTML = `
    ${sectionHeading("运行概览", "五条固定异步管道的当前健康摘要，不包含业务记录或用户信息。", summary.generatedAt)}
    <div class="ops-metrics" aria-label="运营队列合计">
      <div class="ops-metric"><span>当前到期</span><strong>${escapeHtml(totals.dueCount)}</strong></div>
      <div class="ops-metric"><span>处理中</span><strong>${escapeHtml(totals.inFlightCount)}</strong></div>
      <div class="ops-metric"><span>租约已过期</span><strong>${escapeHtml(totals.expiredLeaseCount)}</strong></div>
      <div class="ops-metric"><span>近 24 小时异常</span><strong>${escapeHtml(totals.exceptionsLast24Hours)}</strong></div>
    </div>
    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead><tr><th>管道</th><th>到期</th><th>处理中</th><th>过期租约</th><th>24 小时异常</th><th>最早到期</th></tr></thead>
        <tbody>${summary.queues.map(row => `<tr>
          <td><strong>${escapeHtml(opsQueueLabels[row.queueKey])}</strong><span>${escapeHtml(row.queueKey)}</span></td>
          <td>${escapeHtml(row.dueCount)}</td><td>${escapeHtml(row.inFlightCount)}</td>
          <td>${escapeHtml(row.expiredLeaseCount)}</td><td>${escapeHtml(row.exceptionsLast24Hours)}</td>
          <td>${escapeHtml(row.oldestDueAt ? formatDateTime(row.oldestDueAt) : "无到期任务")}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function codeOptions(items) {
  return items.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function referenceField() {
  return '<label><span>证据引用</span><input name="reference" maxlength="128" pattern="[A-Za-z0-9._:-]{1,128}" autocomplete="off" required /></label>';
}

function actionForm({ kind, target, action, revision, label, codes, danger = false, dueDate = false }) {
  return `<form class="ops-action-form" data-ops-action-form data-kind="${escapeHtml(kind)}" data-target="${escapeHtml(target)}"
      data-action="${escapeHtml(action)}" data-revision="${escapeHtml(revision)}">
    <label><span>处理结论</span><select name="code" required>${codeOptions(codes)}</select></label>
    ${referenceField()}
    ${dueDate ? '<label data-review-due><span>下次复核时间</span><input name="reviewDueAt" type="datetime-local" /></label>' : ""}
    <button class="ops-button ${danger ? "danger" : ""}" type="submit">${escapeHtml(label)}</button>
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
      label: options.resolveLabel || "提交复核结论", codes: options.resolve, danger: true, dueDate: options.dueDate }));
  }
  if (open && options.retry) {
    forms.push(actionForm({ kind, target, action: "retry", revision: review.revision,
      label: "批准单次重试", codes: [["provider_not_accepted_retry_approved", "确认提供方未接收，批准单次重试"]], danger: true }));
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
  root.innerHTML = `${sectionHeading("支付事件复核", "这里只复核隔离的提供方事件，不提供退款、改价或直接修改支付状态。")}
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
    return `<a class="ops-source-link" href="${escapeHtml(url.href)}" target="_blank" rel="noreferrer">查看来源证据</a>`;
  } catch {
    return "来源链接不可用";
  }
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
      </article>`).join("") : '<p class="ops-state">当前没有待复核的目录来源记录。</p>'}</div>`;
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
        label: "记录复核结论", codes: opsActionCodes.correctionResolve, danger: true })}
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
  const rows = [
    ["Application Set 状态", set.status],
    ["目标入学季", set.targetIntake || "未设置"],
    ["当前修订", set.revision],
    ["有效项目数", set.activeChoiceCount],
    ["提交状态", submission?.status || "尚未提交"],
    ["待投递 / 已投递 / 已隔离", submission
      ? `${submission.pendingGroupCount} / ${submission.dispatchedGroupCount} / ${submission.quarantinedGroupCount}` : "无提交批次"],
  ];
  return `<div class="ops-support-result">
    <div class="ops-support-session"><div><h3>${escapeHtml(projection.cuacId)}</h3>
      <span>会话到期：${escapeHtml(formatDateTime(session.expiresAt))}</span></div>
      <button class="ops-button danger" type="button" data-close-support>结束支持会话</button>
    </div>
    <dl class="ops-definition-list">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
    <div class="ops-programs"><h4>项目申请</h4>
      ${Array.isArray(projection.programApplications) && projection.programApplications.length
        ? `<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>学校 / 项目</th><th>入学季</th><th>状态</th><th>确认提交</th></tr></thead><tbody>
          ${projection.programApplications.map(item => `<tr><td><strong>${escapeHtml(item.schoolName)}</strong><span>${escapeHtml(item.programName || "项目未绑定")}</span></td>
          <td>${escapeHtml(item.intakeTerm && item.intakeYear ? `${item.intakeTerm} ${item.intakeYear}` : "未绑定")}</td>
          <td>${escapeHtml(item.status)}</td><td>${escapeHtml(formatDateTime(item.submittedAt, "尚未确认"))}</td></tr>`).join("")}
        </tbody></table></div>`
        : '<p class="ops-state">当前 Application Set 没有项目申请记录。</p>'}
    </div>
  </div>`;
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

async function loadCurrentView() {
  renderLoading();
  try {
    if (opsState.view === "overview") renderOverview(await requestJson("/api/v1/ops/operations/summary"));
    else if (opsState.view === "routing") renderRouting(await requestJson("/api/v1/ops/routing/submissions?limit=50"));
    else if (opsState.view === "billing") renderBilling(await requestJson("/api/v1/ops/billing/provider-events?limit=50"));
    else if (opsState.view === "quality") renderQuality(await requestJson("/api/v1/ops/data-quality/catalog?limit=50"));
    else if (opsState.view === "corrections") renderCorrections(await requestJson("/api/v1/ops/catalog-corrections?limit=50"));
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
  if (action !== "claim") {
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
  }
  if (!path || !Number.isSafeInteger(revision) || revision < 0) {
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
    showOpsToast(error?.status === 403
      ? "当前授权、认领关系或二次验证不允许这项操作。"
      : error.message || "复核操作失败。");
  } finally {
    opsState.busy = false;
    form.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

async function selectOpsView(view) {
  if (!["overview", "routing", "billing", "quality", "corrections", "support"].includes(view) || view === opsState.view) return;
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
    if (event.target.closest("[data-ops-refresh]")) void loadCurrentView();
    if (event.target.closest("[data-close-support]")) void closeSupportSession().then(renderSupport);
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
  });
  document.addEventListener("change", event => {
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
  const role = document.querySelector("[data-ops-role]");
  if (role) role.textContent = auth.role === "cuac_admin" ? "CUAC 管理员" : "CUAC 运营";
  await loadCurrentView();
}

void startOpsWorkspace();
