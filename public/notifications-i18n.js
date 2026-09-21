(function initNotificationsI18n() {
  "use strict";

  const rows = [
    ["CUAC | Notifications", "CUAC | Thông báo", "CUAC | การแจ้งเตือน", "CUAC | Notifikasi", "CUAC | Pemberitahuan", "CUAC | الإشعارات"],
    ["CUAC Notifications:", "Thông báo CUAC:", "การแจ้งเตือน CUAC:", "Notifikasi CUAC:", "Pemberitahuan CUAC:", "إشعارات CUAC:"],
    ["act before deadlines become pressure", "xử lý trước khi hạn chót gây áp lực", "ดำเนินการก่อนกำหนดเวลาจะกดดัน", "bertindak sebelum tenggat menjadi tekanan", "bertindak sebelum tarikh akhir menjadi tekanan", "تصرّف قبل أن تتحول المواعيد إلى ضغط"],
    ["Notifications breadcrumb", "Điều hướng thông báo", "เส้นทางการแจ้งเตือน", "Navigasi notifikasi", "Navigasi pemberitahuan", "مسار الإشعارات"],
    ["Hub", "Hồ sơ", "พื้นที่ของฉัน", "Ruang saya", "Ruang saya", "مساحتي"],
    ["Notifications", "Thông báo", "การแจ้งเตือน", "Notifikasi", "Pemberitahuan", "الإشعارات"],
    ["Student account", "Tài khoản sinh viên", "บัญชีนักศึกษา", "Akun pelajar", "Akaun pelajar", "حساب الطالب"],
    ["Review application, billing, document, funding, and account events recorded for this account.", "Xem các sự kiện về hồ sơ, thanh toán, tài liệu, hỗ trợ tài chính và tài khoản.", "ตรวจสอบเหตุการณ์ด้านการสมัคร การชำระเงิน เอกสาร ทุน และบัญชี", "Tinjau aktivitas pendaftaran, pembayaran, dokumen, pendanaan, dan akun.", "Semak peristiwa permohonan, pembayaran, dokumen, pembiayaan dan akaun.", "راجع أحداث التقديم والفوترة والمستندات والتمويل والحساب."],
    ["Open application", "Mở hồ sơ đăng ký", "เปิดใบสมัคร", "Buka pendaftaran", "Buka permohonan", "فتح طلب التقديم"],
    ["Notification summary", "Tóm tắt thông báo", "สรุปการแจ้งเตือน", "Ringkasan notifikasi", "Ringkasan pemberitahuan", "ملخص الإشعارات"],
    ["Current status", "Trạng thái hiện tại", "สถานะปัจจุบัน", "Status saat ini", "Status semasa", "الحالة الحالية"],
    ["Loading your account notifications.", "Đang tải thông báo tài khoản.", "กำลังโหลดการแจ้งเตือนบัญชี", "Memuat notifikasi akun Anda.", "Memuatkan pemberitahuan akaun anda.", "جارٍ تحميل إشعارات حسابك."],
    ["Unread", "Chưa đọc", "ยังไม่ได้อ่าน", "Belum dibaca", "Belum dibaca", "غير مقروء"],
    ["Read", "Đã đọc", "อ่านแล้ว", "Dibaca", "Dibaca", "مقروء"],
    ["Deadlines", "Hạn chót", "กำหนดเวลา", "Tenggat", "Tarikh akhir", "المواعيد النهائية"],
    ["Documents", "Tài liệu", "เอกสาร", "Dokumen", "Dokumen", "المستندات"],
    ["Billing", "Thanh toán", "การชำระเงิน", "Pembayaran", "Pembayaran", "الفوترة"],
    ["Priority notification", "Thông báo ưu tiên", "การแจ้งเตือนสำคัญ", "Notifikasi prioritas", "Pemberitahuan keutamaan", "إشعار ذو أولوية"],
    ["Notification list", "Danh sách thông báo", "รายการการแจ้งเตือน", "Daftar notifikasi", "Senarai pemberitahuan", "قائمة الإشعارات"],
    ["Inbox", "Hộp thư", "กล่องข้อความ", "Kotak masuk", "Peti masuk", "صندوق الوارد"],
    ["Account events", "Sự kiện tài khoản", "กิจกรรมบัญชี", "Aktivitas akun", "Peristiwa akaun", "أحداث الحساب"],
    ["Mark all read", "Đánh dấu tất cả đã đọc", "ทำเครื่องหมายว่าอ่านทั้งหมด", "Tandai semua dibaca", "Tandakan semua dibaca", "تحديد الكل كمقروء"],
    ["Notification filters", "Bộ lọc thông báo", "ตัวกรองการแจ้งเตือน", "Filter notifikasi", "Penapis pemberitahuan", "مرشحات الإشعارات"],
    ["All", "Tất cả", "ทั้งหมด", "Semua", "Semua", "الكل"],
    ["Action needed", "Cần xử lý", "ต้องดำเนินการ", "Perlu tindakan", "Perlu tindakan", "يلزم اتخاذ إجراء"],
    ["Funding", "Hỗ trợ tài chính", "ทุน", "Pendanaan", "Pembiayaan", "التمويل"],
    ["Security", "Bảo mật", "ความปลอดภัย", "Keamanan", "Keselamatan", "الأمان"],
    ["Updates", "Cập nhật", "อัปเดต", "Pembaruan", "Kemas kini", "التحديثات"],
    ["No notifications in this view.", "Không có thông báo trong chế độ xem này.", "ไม่มีการแจ้งเตือนในมุมมองนี้", "Tidak ada notifikasi dalam tampilan ini.", "Tiada pemberitahuan dalam paparan ini.", "لا توجد إشعارات في هذا العرض."],
    ["New server-recorded account events will appear here.", "Các sự kiện tài khoản mới do máy chủ ghi nhận sẽ xuất hiện tại đây.", "เหตุการณ์บัญชีใหม่ที่เซิร์ฟเวอร์บันทึกจะแสดงที่นี่", "Aktivitas akun baru yang dicatat server akan muncul di sini.", "Peristiwa akaun baharu yang direkodkan pelayan akan dipaparkan di sini.", "ستظهر هنا أحداث الحساب الجديدة التي يسجلها الخادم."],
    ["Notification preferences", "Tùy chọn thông báo", "การตั้งค่าการแจ้งเตือน", "Preferensi notifikasi", "Pilihan pemberitahuan", "تفضيلات الإشعارات"],
    ["Delivery settings", "Cài đặt gửi", "การตั้งค่าการส่ง", "Pengaturan pengiriman", "Tetapan penghantaran", "إعدادات التسليم"],
    ["In-app topics", "Chủ đề trong ứng dụng", "หัวข้อในแอป", "Topik dalam aplikasi", "Topik dalam aplikasi", "الموضوعات داخل التطبيق"],
    ["Application updates", "Cập nhật hồ sơ", "อัปเดตการสมัคร", "Pembaruan pendaftaran", "Kemas kini permohonan", "تحديثات التقديم"],
    ["Billing updates", "Cập nhật thanh toán", "อัปเดตการชำระเงิน", "Pembaruan pembayaran", "Kemas kini pembayaran", "تحديثات الفوترة"],
    ["Document reminders", "Nhắc nhở tài liệu", "การแจ้งเตือนเอกสาร", "Pengingat dokumen", "Peringatan dokumen", "تذكيرات المستندات"],
    ["Funding updates", "Cập nhật hỗ trợ tài chính", "อัปเดตทุน", "Pembaruan pendanaan", "Kemas kini pembiayaan", "تحديثات التمويل"],
    ["Privacy requests", "Yêu cầu quyền riêng tư", "คำขอความเป็นส่วนตัว", "Permintaan privasi", "Permintaan privasi", "طلبات الخصوصية"],
    ["Account security", "Bảo mật tài khoản", "ความปลอดภัยของบัญชี", "Keamanan akun", "Keselamatan akaun", "أمان الحساب"],
    ["Loading account-level delivery preferences.", "Đang tải tùy chọn gửi của tài khoản.", "กำลังโหลดการตั้งค่าการส่งของบัญชี", "Memuat preferensi pengiriman akun.", "Memuatkan pilihan penghantaran akaun.", "جارٍ تحميل تفضيلات تسليم الحساب."],
    ["Open notification preferences", "Mở tùy chọn thông báo", "เปิดการตั้งค่าการแจ้งเตือน", "Buka preferensi notifikasi", "Buka pilihan pemberitahuan", "فتح تفضيلات الإشعارات"],
    ["Application", "Hồ sơ", "การสมัคร", "Pendaftaran", "Permohonan", "التقديم"],
    ["Deadline", "Hạn chót", "กำหนดเวลา", "Tenggat", "Tarikh akhir", "موعد نهائي"],
    ["Privacy", "Quyền riêng tư", "ความเป็นส่วนตัว", "Privasi", "Privasi", "الخصوصية"],
    ["School workflow", "Quy trình nhà trường", "ขั้นตอนของมหาวิทยาลัย", "Alur universitas", "Aliran kerja universiti", "سير عمل الجامعة"],
    ["Operations", "Vận hành", "การดำเนินงาน", "Operasional", "Operasi", "العمليات"],
    ["Update", "Cập nhật", "อัปเดต", "Pembaruan", "Kemas kini", "تحديث"],
    ["Time unavailable", "Không có thời gian", "ไม่มีข้อมูลเวลา", "Waktu tidak tersedia", "Masa tidak tersedia", "الوقت غير متاح"],
    ["Today", "Hôm nay", "วันนี้", "Hari ini", "Hari ini", "اليوم"],
    ["This week", "Tuần này", "สัปดาห์นี้", "Minggu ini", "Minggu ini", "هذا الأسبوع"],
    ["Earlier", "Trước đó", "ก่อนหน้านี้", "Sebelumnya", "Terdahulu", "سابقًا"],
    ["Notifications are temporarily unavailable.", "Thông báo tạm thời không khả dụng.", "การแจ้งเตือนไม่พร้อมใช้งานชั่วคราว", "Notifikasi sementara tidak tersedia.", "Pemberitahuan tidak tersedia buat sementara.", "الإشعارات غير متاحة مؤقتًا."],
    ["You are caught up.", "Bạn đã xem hết thông báo.", "คุณดูครบแล้ว", "Anda sudah melihat semuanya.", "Anda sudah melihat semuanya.", "أنت مطّلع على كل جديد."],
    ["{count} unread item needs your attention.", "{count} mục chưa đọc cần bạn chú ý.", "มี {count} รายการที่ยังไม่ได้อ่านและต้องตรวจสอบ", "{count} item belum dibaca perlu perhatian Anda.", "{count} item belum dibaca memerlukan perhatian anda.", "هناك عنصر واحد غير مقروء يحتاج إلى انتباهك."],
    ["{count} unread items need your attention.", "{count} mục chưa đọc cần bạn chú ý.", "มี {count} รายการที่ยังไม่ได้อ่านและต้องตรวจสอบ", "{count} item belum dibaca perlu perhatian Anda.", "{count} item belum dibaca memerlukan perhatian anda.", "هناك {count} عناصر غير مقروءة تحتاج إلى انتباهك."],
    ["Current", "Hiện tại", "ปัจจุบัน", "Saat ini", "Semasa", "الحالي"],
    ["Notifications could not be loaded.", "Không thể tải thông báo.", "ไม่สามารถโหลดการแจ้งเตือนได้", "Notifikasi tidak dapat dimuat.", "Pemberitahuan tidak dapat dimuatkan.", "تعذر تحميل الإشعارات."],
    ["No unread notification needs action.", "Không có thông báo chưa đọc cần xử lý.", "ไม่มีการแจ้งเตือนที่ยังไม่ได้อ่านและต้องดำเนินการ", "Tidak ada notifikasi belum dibaca yang perlu ditindaklanjuti.", "Tiada pemberitahuan belum dibaca yang memerlukan tindakan.", "لا يوجد إشعار غير مقروء يحتاج إلى إجراء."],
    ["Retry the account notification service before relying on this inbox.", "Hãy thử lại dịch vụ thông báo trước khi sử dụng hộp thư này.", "ลองใช้บริการแจ้งเตือนอีกครั้งก่อนอ้างอิงกล่องข้อความนี้", "Coba lagi layanan notifikasi sebelum mengandalkan kotak masuk ini.", "Cuba semula perkhidmatan pemberitahuan sebelum bergantung pada peti masuk ini.", "أعد محاولة خدمة الإشعارات قبل الاعتماد على صندوق الوارد."],
    ["New account events will appear here after the server records them.", "Sự kiện tài khoản mới sẽ xuất hiện sau khi máy chủ ghi nhận.", "เหตุการณ์บัญชีใหม่จะแสดงหลังจากเซิร์ฟเวอร์บันทึก", "Aktivitas akun baru akan muncul setelah dicatat server.", "Peristiwa akaun baharu akan dipaparkan selepas direkodkan pelayan.", "ستظهر أحداث الحساب الجديدة هنا بعد تسجيلها."],
    ["Retry", "Thử lại", "ลองอีกครั้ง", "Coba lagi", "Cuba lagi", "إعادة المحاولة"],
    ["Open", "Mở", "เปิด", "Buka", "Buka", "فتح"],
    ["Original notification content", "Nội dung thông báo gốc", "เนื้อหาการแจ้งเตือนต้นฉบับ", "Konten notifikasi asli", "Kandungan pemberitahuan asal", "محتوى الإشعار الأصلي"],
    ["Loading account notifications...", "Đang tải thông báo tài khoản...", "กำลังโหลดการแจ้งเตือนบัญชี...", "Memuat notifikasi akun...", "Memuatkan pemberitahuan akaun...", "جارٍ تحميل إشعارات الحساب..."],
    ["Load older notifications", "Tải thông báo cũ hơn", "โหลดการแจ้งเตือนเก่ากว่า", "Muat notifikasi lama", "Muatkan pemberitahuan terdahulu", "تحميل إشعارات أقدم"],
    ["{group} notifications", "Thông báo {group}", "การแจ้งเตือน{group}", "Notifikasi {group}", "Pemberitahuan {group}", "إشعارات {group}"],
    ["Mark read", "Đánh dấu đã đọc", "ทำเครื่องหมายว่าอ่านแล้ว", "Tandai dibaca", "Tandakan dibaca", "تحديد كمقروء"],
    ["Account delivery preferences are unavailable.", "Tùy chọn gửi của tài khoản không khả dụng.", "การตั้งค่าการส่งของบัญชีไม่พร้อมใช้งาน", "Preferensi pengiriman akun tidak tersedia.", "Pilihan penghantaran akaun tidak tersedia.", "تفضيلات تسليم الحساب غير متاحة."],
    ["{enabled} of {total} in-app topics are enabled. Email and SMS rules remain account-level preferences.", "Đã bật {enabled}/{total} chủ đề trong ứng dụng. Quy tắc email và SMS vẫn thuộc tùy chọn tài khoản.", "เปิดหัวข้อในแอป {enabled} จาก {total} หัวข้อ กฎอีเมลและ SMS ยังคงอยู่ในการตั้งค่าบัญชี", "{enabled} dari {total} topik dalam aplikasi aktif. Aturan email dan SMS tetap menjadi preferensi akun.", "{enabled} daripada {total} topik dalam aplikasi diaktifkan. Peraturan e-mel dan SMS kekal sebagai pilihan akaun.", "تم تفعيل {enabled} من أصل {total} موضوعات داخل التطبيق. تبقى قواعد البريد والرسائل ضمن تفضيلات الحساب."],
    ["view account notifications", "xem thông báo tài khoản", "ดูการแจ้งเตือนบัญชี", "melihat notifikasi akun", "melihat pemberitahuan akaun", "عرض إشعارات الحساب"],
    ["The notification service returned an invalid response.", "Dịch vụ thông báo trả về phản hồi không hợp lệ.", "บริการแจ้งเตือนส่งการตอบกลับที่ไม่ถูกต้อง", "Layanan notifikasi memberikan respons tidak valid.", "Perkhidmatan pemberitahuan memberikan respons tidak sah.", "أعادت خدمة الإشعارات استجابة غير صالحة."],
    ["The notification request could not be completed.", "Không thể hoàn tất yêu cầu thông báo.", "ไม่สามารถดำเนินการคำขอแจ้งเตือนได้", "Permintaan notifikasi tidak dapat diselesaikan.", "Permintaan pemberitahuan tidak dapat diselesaikan.", "تعذر إكمال طلب الإشعار."],
  ];

  const i18n = window.CUACI18n;
  const localeIndex = { vi: 1, th: 2, id: 3, ms: 4, ar: 5 }[i18n?.locale] || 0;
  const dictionary = new Map(rows.map((row) => [row[0], row[localeIndex] || row[0]]));
  const ui = (english) => dictionary.get(String(english)) || String(english);
  const format = (template, values = {}) => Object.entries(values).reduce((value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)), ui(template));

  function href(rawHref) {
    if (!rawHref || rawHref.startsWith("#") || !i18n || i18n.locale === "en") return rawHref;
    const url = new URL(rawHref, location.href);
    if (url.origin !== location.origin || !url.pathname.toLowerCase().endsWith(".html")) return rawHref;
    url.searchParams.set("lang", i18n.locale);
    return `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
  }

  function apply(root = document) {
    if (root === document) document.title = ui(document.title);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName) || node.parentElement?.closest?.(".language-selector")) return;
      const trimmed = node.nodeValue.trim();
      if (trimmed && dictionary.has(trimmed)) node.nodeValue = node.nodeValue.replace(trimmed, ui(trimmed));
    });
    (root.querySelectorAll?.("a[href]") || []).forEach((anchor) => {
      const localized = href(anchor.getAttribute("href"));
      if (localized) anchor.setAttribute("href", localized);
    });
    (root.querySelectorAll?.("[aria-label], [title], [data-note], [data-note-detail]") || []).forEach((element) => {
      ["aria-label", "title", "data-note", "data-note-detail"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value && dictionary.has(value)) element.setAttribute(attribute, ui(value));
      });
    });
  }

  window.CUACNotificationsI18n = Object.freeze({ locale: i18n?.locale || "en", ui, format, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }))).observe(document.body, { childList: true, subtree: true });
}());
