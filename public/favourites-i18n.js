(function initFavouritesI18n() {
  "use strict";

  const rows = [
    ["CUAC | Saved items", "CUAC | Mục đã lưu", "CUAC | รายการที่บันทึก", "CUAC | Item tersimpan", "CUAC | Item disimpan", "CUAC | العناصر المحفوظة"],
    ["CUAC Saved items:", "Mục đã lưu trên CUAC:", "รายการที่บันทึกใน CUAC:", "Item tersimpan CUAC:", "Item disimpan CUAC:", "عناصر CUAC المحفوظة:"],
    ["your current research list", "danh sách tìm hiểu hiện tại", "รายการค้นคว้าปัจจุบันของคุณ", "daftar riset Anda saat ini", "senarai kajian semasa anda", "قائمة بحثك الحالية"],
    ["Saved items breadcrumb", "Điều hướng mục đã lưu", "เส้นทางรายการที่บันทึก", "Navigasi item tersimpan", "Navigasi item disimpan", "مسار العناصر المحفوظة"],
    ["Hub", "Hồ sơ", "พื้นที่ของฉัน", "Ruang saya", "Ruang saya", "مساحتي"],
    ["Saved items", "Mục đã lưu", "รายการที่บันทึก", "Item tersimpan", "Item disimpan", "العناصر المحفوظة"],
    ["Student workspace", "Không gian sinh viên", "พื้นที่นักศึกษา", "Ruang pelajar", "Ruang pelajar", "مساحة الطالب"],
    ["Keep research notes beside the exact catalog records you saved.", "Lưu ghi chú tìm hiểu cùng đúng hồ sơ danh mục bạn đã lưu.", "เก็บบันทึกการค้นคว้าไว้กับระเบียนแค็ตตาล็อกที่คุณบันทึก", "Simpan catatan riset bersama data katalog yang Anda simpan.", "Simpan nota kajian bersama rekod katalog yang anda simpan.", "احتفظ بملاحظات البحث بجانب سجلات الدليل التي حفظتها."],
    ["Browse catalog", "Duyệt danh mục", "เรียกดูแค็ตตาล็อก", "Jelajahi katalog", "Layari katalog", "تصفح الدليل"],
    ["Programs", "Chương trình", "หลักสูตร", "Program", "Program", "البرامج"],
    ["Universities", "Trường đại học", "มหาวิทยาลัย", "Universitas", "Universiti", "الجامعات"],
    ["Scholarships", "Học bổng", "ทุนการศึกษา", "Beasiswa", "Biasiswa", "المنح الدراسية"],
    ["Cities", "Thành phố", "เมือง", "Kota", "Bandar", "المدن"],
    ["Saved item filters", "Bộ lọc mục đã lưu", "ตัวกรองรายการที่บันทึก", "Filter item tersimpan", "Penapis item disimpan", "مرشحات العناصر المحفوظة"],
    ["Filter saved items", "Lọc mục đã lưu", "กรองรายการที่บันทึก", "Filter item tersimpan", "Tapis item disimpan", "تصفية العناصر المحفوظة"],
    ["All", "Tất cả", "ทั้งหมด", "Semua", "Semua", "الكل"],
    ["Loading saved items.", "Đang tải mục đã lưu.", "กำลังโหลดรายการที่บันทึก", "Memuat item tersimpan.", "Memuatkan item disimpan.", "جارٍ تحميل العناصر المحفوظة."],
    ["Loading your saved catalog records.", "Đang tải các hồ sơ danh mục đã lưu.", "กำลังโหลดระเบียนแค็ตตาล็อกที่บันทึก", "Memuat data katalog tersimpan Anda.", "Memuatkan rekod katalog yang disimpan.", "جارٍ تحميل سجلات الدليل المحفوظة."],
    ["Program", "Chương trình", "หลักสูตร", "Program", "Program", "برنامج"],
    ["University", "Trường đại học", "มหาวิทยาลัย", "Universitas", "Universiti", "جامعة"],
    ["Scholarship", "Học bổng", "ทุนการศึกษา", "Beasiswa", "Biasiswa", "منحة دراسية"],
    ["City", "Thành phố", "เมือง", "Kota", "Bandar", "مدينة"],
    ["Verified", "Đã xác minh", "ตรวจสอบแล้ว", "Terverifikasi", "Disahkan", "تم التحقق"],
    ["Unverified", "Chưa xác minh", "ยังไม่ได้ตรวจสอบ", "Belum diverifikasi", "Belum disahkan", "لم يتم التحقق"],
    ["Stale", "Cần xác minh lại", "ต้องตรวจสอบอีกครั้ง", "Perlu diverifikasi ulang", "Perlu disahkan semula", "يحتاج إلى إعادة التحقق"],
    ["Disputed", "Đang có tranh chấp", "มีข้อโต้แย้ง", "Diperdebatkan", "Dipertikaikan", "محل نزاع"],
    ["Invalid", "Không hợp lệ", "ไม่ถูกต้อง", "Tidak valid", "Tidak sah", "غير صالح"],
    ["Pending", "Đang chờ", "รอดำเนินการ", "Menunggu", "Belum selesai", "قيد الانتظار"],
    ["Unknown", "Không rõ", "ไม่ทราบ", "Tidak diketahui", "Tidak diketahui", "غير معروف"],
    ["Not recorded", "Chưa ghi nhận", "ยังไม่มีข้อมูล", "Belum tercatat", "Belum direkodkan", "غير مسجل"],
    ["{count} saved item", "{count} mục đã lưu", "รายการที่บันทึก {count} รายการ", "{count} item tersimpan", "{count} item disimpan", "{count} عنصر محفوظ"],
    ["{count} saved items", "{count} mục đã lưu", "รายการที่บันทึก {count} รายการ", "{count} item tersimpan", "{count} item disimpan", "{count} عناصر محفوظة"],
    ["{visible} of {total} saved items", "{visible} trong {total} mục đã lưu", "{visible} จาก {total} รายการที่บันทึก", "{visible} dari {total} item tersimpan", "{visible} daripada {total} item disimpan", "{visible} من أصل {total} عناصر محفوظة"],
    ["Saved research", "Nội dung đã tìm hiểu", "งานค้นคว้าที่บันทึก", "Riset tersimpan", "Kajian disimpan", "البحث المحفوظ"],
    ["Browse programs", "Duyệt chương trình", "เรียกดูหลักสูตร", "Jelajahi program", "Layari program", "تصفح البرامج"],
    ["Retry", "Thử lại", "ลองอีกครั้ง", "Coba lagi", "Cuba lagi", "إعادة المحاولة"],
    ["No saved items yet", "Chưa có mục nào được lưu", "ยังไม่มีรายการที่บันทึก", "Belum ada item tersimpan", "Belum ada item disimpan", "لا توجد عناصر محفوظة بعد"],
    ["No saved {type}", "Chưa lưu {type}", "ไม่มี{type}ที่บันทึก", "Tidak ada {type} tersimpan", "Tiada {type} disimpan", "لا توجد {type} محفوظة"],
    ["Choose another filter or save a record from its catalog detail page.", "Chọn bộ lọc khác hoặc lưu một hồ sơ từ trang chi tiết danh mục.", "เลือกตัวกรองอื่นหรือบันทึกระเบียนจากหน้ารายละเอียด", "Pilih filter lain atau simpan data dari halaman detail katalog.", "Pilih penapis lain atau simpan rekod daripada halaman butiran katalog.", "اختر مرشحًا آخر أو احفظ سجلًا من صفحة تفاصيله."],
    ["Save a program, university, scholarship, or city from its catalog detail page.", "Lưu chương trình, trường, học bổng hoặc thành phố từ trang chi tiết danh mục.", "บันทึกหลักสูตร มหาวิทยาลัย ทุน หรือเมืองจากหน้ารายละเอียด", "Simpan program, universitas, beasiswa, atau kota dari halaman detail katalog.", "Simpan program, universiti, biasiswa atau bandar daripada halaman butiran katalog.", "احفظ برنامجًا أو جامعة أو منحة أو مدينة من صفحة التفاصيل."],
    ["Catalog record unavailable", "Hồ sơ danh mục không khả dụng", "ระเบียนแค็ตตาล็อกไม่พร้อมใช้งาน", "Data katalog tidak tersedia", "Rekod katalog tidak tersedia", "سجل الدليل غير متاح"],
    ["Saved {date}", "Đã lưu {date}", "บันทึกเมื่อ {date}", "Disimpan {date}", "Disimpan {date}", "حُفظ في {date}"],
    ["Verified {date}", "Xác minh {date}", "ตรวจสอบเมื่อ {date}", "Diverifikasi {date}", "Disahkan {date}", "تم التحقق في {date}"],
    ["Verification date not recorded", "Chưa ghi nhận ngày xác minh", "ยังไม่มีวันที่ตรวจสอบ", "Tanggal verifikasi belum tercatat", "Tarikh pengesahan belum direkodkan", "تاريخ التحقق غير مسجل"],
    ["This saved catalog record is not currently published. Its identifier and your private note remain available.", "Hồ sơ danh mục đã lưu này hiện chưa được công bố. Mã định danh và ghi chú riêng của bạn vẫn được giữ lại.", "ระเบียนที่บันทึกนี้ยังไม่ได้เผยแพร่ รหัสและบันทึกส่วนตัวของคุณยังคงอยู่", "Data katalog tersimpan ini sedang tidak diterbitkan. Identitas dan catatan pribadi Anda tetap tersedia.", "Rekod katalog ini tidak diterbitkan buat masa ini. Pengenal dan nota peribadi anda kekal tersedia.", "سجل الدليل المحفوظ غير منشور حاليًا. يظل معرّفه وملاحظتك الخاصة متاحين."],
    ["Open detail", "Mở chi tiết", "เปิดรายละเอียด", "Buka detail", "Buka butiran", "فتح التفاصيل"],
    ["Remove", "Xóa", "นำออก", "Hapus", "Buang", "إزالة"],
    ["Private note", "Ghi chú riêng", "บันทึกส่วนตัว", "Catatan pribadi", "Nota peribadi", "ملاحظة خاصة"],
    ["Add a decision note", "Thêm ghi chú quyết định", "เพิ่มบันทึกการตัดสินใจ", "Tambahkan catatan keputusan", "Tambah nota keputusan", "أضف ملاحظة قرار"],
    ["Only your student account can read this note.", "Chỉ tài khoản sinh viên của bạn có thể đọc ghi chú này.", "เฉพาะบัญชีนักศึกษาของคุณเท่านั้นที่อ่านบันทึกนี้ได้", "Hanya akun pelajar Anda yang dapat membaca catatan ini.", "Hanya akaun pelajar anda boleh membaca nota ini.", "لا يمكن قراءة هذه الملاحظة إلا من حساب الطالب الخاص بك."],
    ["Save note", "Lưu ghi chú", "บันทึกโน้ต", "Simpan catatan", "Simpan nota", "حفظ الملاحظة"],
    ["Saved items could not be loaded", "Không thể tải mục đã lưu", "ไม่สามารถโหลดรายการที่บันทึกได้", "Item tersimpan tidak dapat dimuat", "Item disimpan tidak dapat dimuatkan", "تعذر تحميل العناصر المحفوظة"],
    ["The saved-item service is unavailable.", "Dịch vụ mục đã lưu không khả dụng.", "บริการรายการที่บันทึกไม่พร้อมใช้งาน", "Layanan item tersimpan tidak tersedia.", "Perkhidmatan item disimpan tidak tersedia.", "خدمة العناصر المحفوظة غير متاحة."],
    ["The saved-item request could not be completed.", "Không thể hoàn tất yêu cầu mục đã lưu.", "ไม่สามารถดำเนินการคำขอรายการที่บันทึกได้", "Permintaan item tersimpan tidak dapat diselesaikan.", "Permintaan item disimpan tidak dapat diselesaikan.", "تعذر إكمال طلب العنصر المحفوظ."],
    ["The saved-item response is invalid.", "Phản hồi mục đã lưu không hợp lệ.", "การตอบกลับรายการที่บันทึกไม่ถูกต้อง", "Respons item tersimpan tidak valid.", "Respons item disimpan tidak sah.", "استجابة العنصر المحفوظ غير صالحة."],
    ["Private note saved.", "Đã lưu ghi chú riêng.", "บันทึกโน้ตส่วนตัวแล้ว", "Catatan pribadi disimpan.", "Nota peribadi disimpan.", "تم حفظ الملاحظة الخاصة."],
    ["The private note was not saved.", "Chưa lưu được ghi chú riêng.", "ไม่ได้บันทึกโน้ตส่วนตัว", "Catatan pribadi tidak disimpan.", "Nota peribadi tidak disimpan.", "لم يتم حفظ الملاحظة الخاصة."],
    ["Removed from saved items.", "Đã xóa khỏi mục đã lưu.", "นำออกจากรายการที่บันทึกแล้ว", "Dihapus dari item tersimpan.", "Dibuang daripada item disimpan.", "تمت الإزالة من العناصر المحفوظة."],
    ["The saved item was not removed.", "Chưa xóa được mục đã lưu.", "ไม่ได้นำรายการที่บันทึกออก", "Item tersimpan tidak dihapus.", "Item disimpan tidak dibuang.", "لم تتم إزالة العنصر المحفوظ."],
    ["view your saved items", "xem các mục đã lưu", "ดูรายการที่บันทึก", "melihat item tersimpan Anda", "melihat item disimpan anda", "عرض عناصرك المحفوظة"],
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
      if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement?.tagName)) return;
      const trimmed = node.nodeValue.trim();
      if (trimmed && dictionary.has(trimmed)) node.nodeValue = node.nodeValue.replace(trimmed, ui(trimmed));
    });
    (root.querySelectorAll?.("a[href]") || []).forEach((anchor) => {
      const localized = href(anchor.getAttribute("href"));
      if (localized) anchor.setAttribute("href", localized);
    });
    (root.querySelectorAll?.("[aria-label], [title], [placeholder], [data-note], [data-note-detail]") || []).forEach((element) => {
      ["aria-label", "title", "placeholder", "data-note", "data-note-detail"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value && dictionary.has(value)) element.setAttribute(attribute, ui(value));
      });
    });
  }

  window.CUACFavouritesI18n = Object.freeze({ locale: i18n?.locale || "en", ui, format, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }))).observe(document.body, { childList: true, subtree: true });
}());
