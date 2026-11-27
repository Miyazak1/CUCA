(function (global) {
  "use strict";
  const locale = global.CUACI18n?.locale || "en";
  const locales = ["en", "vi", "th", "id", "ms", "ar"];
  const index = Math.max(0, locales.indexOf(locale));
  const words = {
    catalog: ["Study options", "Lựa chọn học tập", "ตัวเลือกการศึกษา", "Pilihan studi", "Pilihan pengajian", "خيارات الدراسة"],
    save: ["Save", "Lưu", "บันทึก", "Simpan", "Simpan", "حفظ"],
    saved: ["Saved", "Đã lưu", "บันทึกแล้ว", "Tersimpan", "Disimpan", "محفوظ"],
    compare: ["Compare", "So sánh", "เปรียบเทียบ", "Bandingkan", "Bandingkan", "مقارنة"],
    selected: ["Selected", "Đã chọn", "เลือกแล้ว", "Dipilih", "Dipilih", "محدد"],
    share: ["Share", "Chia sẻ", "แชร์", "Bagikan", "Kongsi", "مشاركة"],
    details: ["View details", "Xem chi tiết", "ดูรายละเอียด", "Lihat detail", "Lihat butiran", "عرض التفاصيل"],
    source: ["Original source", "Nguồn gốc", "แหล่งข้อมูลต้นฉบับ", "Sumber asli", "Sumber asal", "المصدر الأصلي"],
    updated: ["Record updated", "Hồ sơ cập nhật", "ปรับปรุงข้อมูล", "Data diperbarui", "Rekod dikemas kini", "تحديث السجل"],
    reviewed: ["Source reviewed", "Nguồn đã rà soát", "ตรวจสอบแหล่งข้อมูล", "Sumber ditinjau", "Sumber disemak", "مراجعة المصدر"],
    deadline: ["Nearest deadline", "Hạn gần nhất", "กำหนดปิดรับที่ใกล้ที่สุด", "Tenggat terdekat", "Tarikh tutup terdekat", "أقرب موعد نهائي"],
    schoolDeadline: ["Next program deadline", "Hạn chương trình gần nhất", "กำหนดปิดรับหลักสูตรถัดไป", "Tenggat program terdekat", "Tarikh tutup program terdekat", "أقرب موعد للبرامج"],
    beijing: ["Beijing time", "Giờ Bắc Kinh", "เวลาปักกิ่ง", "Waktu Beijing", "Waktu Beijing", "بتوقيت بكين"],
    days: ["{n} days left", "Còn {n} ngày", "เหลือ {n} วัน", "Sisa {n} hari", "Baki {n} hari", "متبقي {n} يومًا"],
    today: ["Closes today", "Hết hạn hôm nay", "ปิดรับวันนี้", "Berakhir hari ini", "Tutup hari ini", "ينتهي اليوم"],
    closed: ["Closed", "Đã đóng", "ปิดแล้ว", "Ditutup", "Ditutup", "مغلق"],
    upcoming: ["Upcoming", "Sắp mở", "เร็ว ๆ นี้", "Akan datang", "Akan datang", "قادم"],
    unpublished: ["Not published", "Chưa công bố", "ยังไม่ประกาศ", "Belum diterbitkan", "Belum diterbitkan", "غير منشور"],
    unconfirmed: ["Availability unconfirmed", "Chưa xác nhận đợt nhận hồ sơ", "ยังไม่ยืนยันการเปิดรับ", "Ketersediaan belum dikonfirmasi", "Status belum disahkan", "حالة التقديم غير مؤكدة"],
    rounds: ["{n} routes", "{n} lộ trình", "{n} ช่องทาง", "{n} jalur", "{n} laluan", "{n} مسارات"],
    schedule: ["View schedule", "Xem lịch", "ดูตาราง", "Lihat jadwal", "Lihat jadual", "عرض المواعيد"],
    programs: ["Programs", "Chương trình", "หลักสูตร", "Program", "Program", "البرامج"],
    english: ["English-taught", "Dạy bằng tiếng Anh", "สอนเป็นภาษาอังกฤษ", "Berbahasa Inggris", "Bahasa Inggeris", "بالإنجليزية"],
    scholarships: ["Scholarships", "Học bổng", "ทุนการศึกษา", "Beasiswa", "Biasiswa", "المنح"],
    tuition: ["Tuition", "Học phí", "ค่าเล่าเรียน", "Biaya kuliah", "Yuran pengajian", "الرسوم الدراسية"],
    language: ["Teaching language", "Ngôn ngữ giảng dạy", "ภาษาที่ใช้สอน", "Bahasa pengantar", "Bahasa pengantar", "لغة التدريس"],
    duration: ["Duration", "Thời gian học", "ระยะเวลา", "Durasi", "Tempoh", "المدة"],
    years: ["{n} years", "{n} năm", "{n} ปี", "{n} tahun", "{n} tahun", "{n} سنوات"],
    months: ["{n} months", "{n} tháng", "{n} เดือน", "{n} bulan", "{n} bulan", "{n} أشهر"],
    funding: ["Funding", "Tài trợ", "เงินทุน", "Pendanaan", "Pembiayaan", "التمويل"],
    degree: ["Study level", "Bậc học", "ระดับการศึกษา", "Jenjang studi", "Tahap pengajian", "المرحلة الدراسية"],
    coverage: ["Coverage", "Phạm vi hỗ trợ", "ความคุ้มครอง", "Cakupan", "Liputan", "التغطية"],
    compareTitle: ["Compare your choices", "So sánh lựa chọn", "เปรียบเทียบตัวเลือก", "Bandingkan pilihan", "Bandingkan pilihan", "قارن خياراتك"],
    compareHelp: ["Select 2–3 choices", "Chọn 2–3 mục", "เลือก 2–3 รายการ", "Pilih 2–3 pilihan", "Pilih 2–3 pilihan", "اختر عنصرين أو ثلاثة"],
    limit: ["Compare up to 3 choices", "So sánh tối đa 3 mục", "เปรียบเทียบได้สูงสุด 3 รายการ", "Bandingkan hingga 3 pilihan", "Bandingkan sehingga 3 pilihan", "قارن حتى ثلاثة خيارات"],
    remove: ["Remove", "Bỏ chọn", "นำออก", "Hapus", "Buang", "إزالة"],
    close: ["Close", "Đóng", "ปิด", "Tutup", "Tutup", "إغلاق"],
    copied: ["Link copied", "Đã sao chép liên kết", "คัดลอกลิงก์แล้ว", "Tautan disalin", "Pautan disalin", "تم نسخ الرابط"],
    copy: ["Copy link", "Sao chép liên kết", "คัดลอกลิงก์", "Salin tautan", "Salin pautan", "نسخ الرابط"],
    manual: ["Select and copy this link", "Chọn và sao chép liên kết", "เลือกและคัดลอกลิงก์นี้", "Pilih dan salin tautan ini", "Pilih dan salin pautan ini", "حدد الرابط وانسخه"],
    logoMissing: ["University logo unavailable", "Chưa có logo trường", "ไม่มีตรามหาวิทยาลัย", "Logo universitas tidak tersedia", "Logo universiti tiada", "شعار الجامعة غير متوفر"],
    public: ["Public", "Công lập", "รัฐ", "Negeri", "Awam", "حكومية"],
    private: ["Private", "Tư thục", "เอกชน", "Swasta", "Swasta", "خاصة"],
    onPage: ["Matching routes on this page", "Lộ trình phù hợp trên trang này", "รายการที่ตรงเงื่อนไขในหน้านี้", "Jalur cocok di halaman ini", "Laluan sepadan pada halaman ini", "المسارات المطابقة في هذه الصفحة"],
    noDates: ["No upcoming dates on this page", "Trang này chưa có hạn sắp tới", "ไม่มีวันปิดรับที่กำลังจะถึงในหน้านี้", "Tidak ada tenggat mendatang di halaman ini", "Tiada tarikh akan datang pada halaman ini", "لا توجد مواعيد قادمة في هذه الصفحة"],
    autumn: ["Autumn", "Mùa thu", "ฤดูใบไม้ร่วง", "Musim gugur", "Musim luruh", "الخريف"],
    spring: ["Spring", "Mùa xuân", "ฤดูใบไม้ผลิ", "Musim semi", "Musim bunga", "الربيع"],
    requirements: ["Requirements", "Yêu cầu", "ข้อกำหนด", "Persyaratan", "Keperluan", "المتطلبات"],
  };
  const t = (key, values = {}) => String(words[key]?.[index] || words[key]?.[0] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
  const escape = value => global.CuacCatalogList.escapeHtml(value);
  const text = value => {
    const source = String(value ?? "");
    // Catalog values describe academic subjects; the UI "Materials" label means application documents.
    if (source === "Materials") return global.CUACCatalogContent?.text(source) || source;
    return global.CUACCatalogI18n?.ui(source) || source;
  };
  const svgPaths = {
    school: "M3 9h18L12 3 3 9ZM5 12v7m5-7v7m4-7v7m5-7v7M3 21h18", book: "M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14",
    calendar: "M7 3v4m10-4v4M3 10h18M5 5h14v16H3V5h2", bookmark: "M6 3h12v18l-6-4-6 4V3Z", compare: "M4 4h6v16H4V4Zm10 0h6v16h-6V4Z",
    share: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 10l6-4M9 14l6 4", arrow: "M4 12h16m-6-6 6 6-6 6", close: "m6 6 12 12M6 18 18 6", award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-4-1-1 8 5-3 5 3-1-8",
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${svgPaths[name] || svgPaths.school}"/></svg>`;
  function safeUrl(value, external = false) {
    if (!value) return "";
    try { const url = new URL(value, location.href); return ["http:", "https:"].includes(url.protocol) && (external || url.origin === location.origin) ? (external ? url.href : global.CUACCatalogI18n.localizeHref(`${url.pathname}${url.search}${url.hash}`)) : ""; } catch { return ""; }
  }
  function dateInfo(value, now = Date.now()) {
    if (!value) return null;
    let instant;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [y, m, d] = String(value).split("-").map(Number);
      const day = new Date(Date.UTC(y, m - 1, d));
      if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return null;
      instant = day.getTime() + 86400000 - 8 * 3600000 - 1;
    } else { instant = Date.parse(value); }
    if (!Number.isFinite(instant)) return null;
    const beijingDay = ms => Math.floor((ms + 8 * 3600000) / 86400000);
    const days = beijingDay(instant) - beijingDay(now);
    const band = instant < now ? "expired" : days === 0 ? "today" : days <= 7 ? "week" : days <= 30 ? "month" : days <= 90 ? "quarter" : "distant";
    return { instant, days, band, iso: new Date(instant).toISOString(), label: new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai" }).format(instant) };
  }
  function deadlines(kind, record, now = Date.now()) {
    const raw = kind === "school" ? record.upcomingDeadlines || [] : Array.isArray(record.availableIntakes) ? record.availableIntakes : [];
    const rows = raw.map(row => ({ ...row, date: dateInfo(row.deadlineDate, now) })).filter(row => row.date).sort((a, b) => a.date.instant - b.date.instant);
    const next = rows.find(row => row.date.instant >= now);
    const date = next?.date || (kind !== "school" ? dateInfo(record.deadlineDate || record.deadline, now) : null);
    const availability = kind === "program" ? (record.intakeAvailability || "unconfirmed") : kind === "scholarship" ? (record.applicationAvailability || "unconfirmed") : next ? "open" : "unconfirmed";
    const closed = ["closed", "expired"].includes(availability) || date?.band === "expired";
    return { rows, date, availability, band: closed ? "expired" : date?.band || "unpublished" };
  }
  function intakeLabel(term, year) {
    const raw = String(term || "");
    const label = /autumn|fall|september/i.test(raw) ? t("autumn") : /spring|march/i.test(raw) ? t("spring") : text(raw);
    return [label, year].filter(Boolean).join(" ");
  }
  function logo(name, kind, asset) {
    const url=String(asset?.url || '');
    if (/^\/api\/v1\/catalog\/schools\/[a-f0-9-]{36}\/logo\?v=\d+$/.test(url)) return '<img class="cd-logo" src="'+escape(url)+'" alt="'+escape(name)+'" width="54" height="54" loading="lazy" decoding="async">';
    return '<span class="cd-logo cd-logo-fallback" role="img" aria-label="'+escape(kind === 'scholarship' ? t('funding') : t('logoMissing'))+'">'+icon(kind === 'scholarship' ? 'award' : 'school')+'</span>';
  }
  const models = new Map();
  const selected = new Map();
  const keyOf = model => `${model.kind}:${model.id}`;
  function render(model) {
    const key = keyOf(model);
    models.set(key, model);
    if (typeof model.compared === "boolean") { if(model.compared) selected.set(key,model); else selected.delete(key); }
    const timing = deadlines(model.kind, model.record);
    const source = safeUrl(model.record.sourceUrl, true);
    const updated = dateInfo(model.record.updatedAt);
    const reviewed = !updated && dateInfo(model.record.lastVerifiedAt);
    const detail = safeUrl(model.href);
    const schedule = safeUrl(detail ? `${detail.split("#")[0]}#admissions-schedule` : "");
    const tags = (model.tags || []).filter(tag => tag?.value).map(tag => `<span class="cd-tag cd-tag-${tag.kind}">${icon(tag.kind === "intake" ? "calendar" : tag.kind === "level" ? "book" : "school")}${escape(text(tag.value))}</span>`).join("");
    const facts = model.facts.map(([label, value]) => `<div><dt>${escape(t(label))}</dt><dd>${escape(value == null || value === "" ? t("unpublished") : text(value))}</dd></div>`).join("");
    const availability = timing.band === "expired" ? t("closed") : timing.availability === "upcoming" ? t("upcoming") : ["not_published", "unconfirmed"].includes(timing.availability) ? t("unconfirmed") : "";
    return `<div class="cd-head">${logo(model.logoName || model.title, model.kind, model.logo)}<div><h2><a href="${escape(detail)}">${escape(text(model.title))}</a></h2><div class="cd-identity">${model.parentHref ? `<a href="${escape(safeUrl(model.parentHref))}">${escape(text(model.parent))}</a>` : model.kind === "school" ? `<span data-catalog-original>${escape(model.parent || "")}</span>` : escape(text(model.parent || ""))}${model.location ? `<span>${escape(text(model.location))}</span>` : ""}</div></div></div>
      <div class="cd-tags">${tags}</div><p class="cd-description">${escape(text(model.description || t("unpublished")))}</p><dl class="cd-facts">${facts}</dl>
      <div class="cd-provenance">${source ? `<a href="${escape(source)}" target="_blank" rel="noopener noreferrer" data-catalog-original>${escape(t("source"))}</a>` : ""}${updated || reviewed ? `<span>${escape(t(updated ? "updated" : "reviewed"))} <time datetime="${(updated || reviewed).iso}">${escape((updated || reviewed).label)}</time></span>` : ""}</div>
      <div class="cd-deadline cd-tone-${timing.band}">${icon("calendar")}<span>${escape(t(model.kind === "school" ? "schoolDeadline" : "deadline"))} ${timing.date ? `<time datetime="${timing.date.iso}">${escape(timing.date.label)}</time>` : escape(t("unpublished"))}</span>${timing.date ? `<small>${escape(t("beijing"))}</small>` : ""}<strong>${escape(availability || (timing.date ? timing.date.days === 0 ? t("today") : t("days", { n: timing.date.days }) : ""))}</strong><a href="${escape(schedule)}">${escape(timing.rows.length > 1 ? t("rounds", { n: timing.rows.length }) : t("schedule"))}${icon("arrow")}</a></div>
      ${model.requirementsHtml || ""}<div class="cd-actions"><div><button class="${model.saveClass} cd-action ${model.saved ? "saved" : ""}" type="button" data-save="${escape(model.id)}" aria-pressed="${Boolean(model.saved)}" aria-label="${escape(model.saveLabel)}">${global.CuacCatalogList.saveHeartIcon()}<span>${escape(t(model.saved ? "saved" : "save"))}</span></button><button class="cd-action" type="button" data-design-compare="${escape(key)}" aria-pressed="${selected.has(key)}">${icon("compare")}<span>${escape(t(selected.has(key) ? "selected" : "compare"))}</span></button><button class="cd-action" type="button" data-design-share="${escape(key)}">${icon("share")}${escape(t("share"))}</button></div><a class="cd-details" href="${escape(detail)}">${escape(t("details"))}${icon("arrow")}</a></div>`;
  }
  let tray, dialog;
  function ensureUi() {
    if (tray) return;
    tray = document.createElement("aside"); tray.className = "cd-compare-tray"; tray.hidden = true; tray.setAttribute("aria-label", t("compareTitle"));
    dialog = document.createElement("dialog"); dialog.className = "cd-dialog"; dialog.setAttribute("aria-labelledby", "cd-dialog-title");
    document.body.append(tray, dialog);
  }
  function drawTray() {
    ensureUi();
    tray.hidden = !selected.size;
    document.body.classList.toggle("cd-has-comparison", selected.size > 0);
    tray.innerHTML = `<span>${escape(t("compareHelp"))}</span><div>${[...selected].map(([key, model]) => `<button type="button" data-design-remove="${escape(key)}">${escape(text(model.title))}${icon("close")}<span class="cd-sr-only">${escape(t("remove"))}</span></button>`).join("")}</div><button type="button" data-design-open-compare ${selected.size < 2 ? "disabled" : ""}>${escape(t("compare"))}</button>`;
  }
  function syncComparison(kind, ids) { for (const [key, model] of models) if (model.kind === kind) { if(ids.has(model.id)) selected.set(key,model); else selected.delete(key); } drawTray(); }
  function showDialog(title, body) {
    ensureUi(); dialog.innerHTML = `<div class="cd-dialog-head"><h2 id="cd-dialog-title">${escape(title)}</h2><button type="button" data-design-close>${escape(t("close"))}</button></div>${body}`; dialog.showModal();
  }
  function remove(key) {
    const model = models.get(key); selected.delete(key); model?.onCompare?.(false); drawTray();
    const button = document.querySelector(`[data-design-compare="${CSS.escape(key)}"]`);
    if (button) { button.setAttribute("aria-pressed", "false"); button.querySelector("span").textContent = t("compare"); }
  }
  document.addEventListener("click", async event => {
    const compare = event.target.closest("[data-design-compare]");
    if (compare) {
      event.preventDefault(); const key = compare.dataset.designCompare; const model = models.get(key); if (!model) return;
      if (selected.has(key)) { remove(key); return; }
      if (selected.size >= 3) { showDialog(t("compareTitle"), `<p>${escape(t("limit"))}</p>`); return; }
      selected.set(key, model); model.onCompare?.(true); drawTray();
      const current = [...document.querySelectorAll("[data-design-compare]")].find(button => button.dataset.designCompare === key);
      if (current) { current.setAttribute("aria-pressed", "true"); current.querySelector("span").textContent = t("selected"); current.focus(); }
    }
    const drop = event.target.closest("[data-design-remove]"); if (drop) { remove(drop.dataset.designRemove); (tray.querySelector("button") || document.querySelector(".cd-action"))?.focus(); }
    if (event.target.closest("[data-design-open-compare]")) {
      const items = [...selected.values()]; if (items.length < 2) return;
      showDialog(t("compareTitle"), `<div class="cd-table-wrap"><table><thead><tr><th>${escape(t("compare"))}</th>${items.map(model => `<th>${escape(text(model.title))}</th>`).join("")}</tr></thead><tbody>${items[0].facts.map(([label], index) => `<tr><th>${escape(t(label))}</th>${items.map(model => `<td>${escape(text(model.facts[index]?.[1] ?? t("unpublished")))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    if (event.target.closest("[data-design-close]")) dialog.close();
    const share = event.target.closest("[data-design-share]");
    if (share) {
      const model = models.get(share.dataset.designShare); if (!model) return;
      const url = new URL(safeUrl(model.href), location.href).href;
      showDialog(t("share"), `<p data-design-copy-status role="status">${escape(t("manual"))}</p><label>${escape(t("share"))}<input class="cd-share-link" readonly value="${escape(url)}"></label><button type="button" data-design-copy>${escape(t("copy"))}</button>`);
      await copyLink();
    }
    if (event.target.closest("[data-design-copy]")) await copyLink();
  });
  async function copyLink() { const input = dialog.querySelector("input"); try { await navigator.clipboard.writeText(input.value); dialog.querySelector("[data-design-copy-status]").textContent = t("copied"); } catch { input.focus(); input.select(); } }
  function refresh() {
    const rail = document.querySelector("[data-design-rail]"); if (!rail) return;
    const visible = [...document.querySelectorAll("[data-design-key]")].map(card => models.get(card.dataset.designKey)).filter(Boolean);
    const dates = visible.map(model => ({ model, timing: deadlines(model.kind, model.record) })).filter(({ timing }) => timing.date && timing.band !== "expired" && timing.availability !== "unconfirmed" && timing.availability !== "not_published").sort((a, b) => a.timing.date.instant - b.timing.date.instant).slice(0, 3);
    rail.innerHTML = `<section class="cd-rail-panel"><h2>${escape(t("deadline"))}</h2><p>${escape(t("onPage"))}</p>${dates.map(({ model, timing }) => `<a class="cd-rail-date cd-tone-${timing.band}" href="${escape(safeUrl(model.href))}"><time datetime="${timing.date.iso}">${escape(timing.date.label)}</time><span>${escape(text(model.title))}</span></a>`).join("") || `<p>${escape(t("noDates"))}</p>`}<p>${escape(t("beijing"))}</p></section>`;
  }
  const tabs = document.querySelector("[data-design-tabs]");
  if (tabs) tabs.setAttribute("aria-label", t("catalog"));
  if (tabs) tabs.innerHTML = [["universities", "school"], ["programs", "book"], ["scholarships", "award"]].map(([page, symbol]) => `<a href="${escape(safeUrl(`${page}.html`))}" ${document.body.dataset.catalogListPage === page ? 'aria-current="page"' : ""}>${icon(symbol)}${escape(global.CUACI18n.t(`shell.nav.${page}`, page))}</a>`).join("");
  const filterPanel = document.querySelector(".cd-left:not(.cd-desktop-filters) details");
  if (filterPanel) {
    const query = matchMedia("(max-width:900px)"); const sync = () => { filterPanel.open = !query.matches; }; sync(); query.addEventListener("change", sync);
  }
  document.addEventListener("error", event => {
    if (!event.target.matches?.("img.cd-logo")) return;
    const replacement = document.createElement("span"); replacement.className = "cd-logo cd-logo-fallback"; replacement.setAttribute("role", "img"); replacement.setAttribute("aria-label", t("logoMissing")); replacement.innerHTML = icon("school"); event.target.replaceWith(replacement);
  }, true);
  function updateDrawer(drawer, open, wasOpen) {
    if (!open && !wasOpen) return;
    // Mobile filters live outside main, the body translator's default root.
    if (open) global.CUACCatalogContent?.apply(drawer);
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", String(open));
    const main = document.querySelector("main");
    if (main) main.inert = open;
    document.querySelector(open ? "#closeFilters" : "#openFilters")?.focus();
  }
  document.addEventListener("keydown", event => {
    const drawer = document.querySelector('#filterDrawer[aria-hidden="false"]');
    if (!drawer) return;
    if (event.key === "Escape") { event.preventDefault(); document.querySelector("#closeFilters").click(); }
    if (event.key !== "Tab") return;
    const controls = [...drawer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(control => control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  global.CUACCatalogDesign = Object.freeze({ t, text, dateInfo, deadlines, intakeLabel, render, refresh, syncComparison, safeUrl, updateDrawer });
})(window);
