(function initHubI18n() {
  "use strict";

  const rows = [
    ["CUAC | Student Hub", "CUAC | Trung tâm sinh viên", "CUAC | ศูนย์นักศึกษา", "CUAC | Ruang pelajar", "CUAC | Ruang pelajar", "CUAC | مساحة الطالب"],
    ["CUAC Student Hub:", "Trung tâm sinh viên CUAC:", "ศูนย์นักศึกษา CUAC:", "Ruang pelajar CUAC:", "Ruang pelajar CUAC:", "مساحة الطالب في CUAC:"],
    ["your current application records", "hồ sơ đăng ký hiện tại", "ข้อมูลการสมัครปัจจุบัน", "data pendaftaran Anda saat ini", "rekod permohonan semasa anda", "سجلات تقديمك الحالية"],
    ["Student workspace", "Không gian sinh viên", "พื้นที่นักศึกษา", "Ruang pelajar", "Ruang pelajar", "مساحة الطالب"],
    ["Your application hub", "Trung tâm hồ sơ của bạn", "ศูนย์การสมัครของคุณ", "Pusat pendaftaran Anda", "Pusat permohonan anda", "مركز طلباتك"],
    ["Review the records CUAC currently holds for this student account.", "Xem các hồ sơ CUAC hiện lưu cho tài khoản sinh viên này.", "ตรวจสอบข้อมูลที่ CUAC เก็บไว้สำหรับบัญชีนักศึกษานี้", "Tinjau data yang saat ini disimpan CUAC untuk akun pelajar ini.", "Semak rekod yang disimpan CUAC untuk akaun pelajar ini.", "راجع السجلات التي يحتفظ بها CUAC حاليًا لهذا الحساب."],
    ["Saved items", "Mục đã lưu", "รายการที่บันทึก", "Item tersimpan", "Item disimpan", "العناصر المحفوظة"],
    ["Open application", "Mở hồ sơ đăng ký", "เปิดใบสมัคร", "Buka pendaftaran", "Buka permohonan", "فتح طلب التقديم"],
    ["Next step", "Bước tiếp theo", "ขั้นตอนถัดไป", "Langkah berikutnya", "Langkah seterusnya", "الخطوة التالية"],
    ["Continue your application plan", "Tiếp tục kế hoạch nộp hồ sơ", "ดำเนินแผนการสมัครต่อ", "Lanjutkan rencana pendaftaran", "Teruskan rancangan permohonan", "تابع خطة التقديم"],
    ["Review your active choices, deadlines, and missing information before you submit.", "Xem lựa chọn đang hoạt động, hạn và thông tin còn thiếu trước khi nộp.", "ตรวจสอบตัวเลือก กำหนดเวลา และข้อมูลที่ขาดก่อนส่ง", "Tinjau pilihan aktif, tenggat, dan informasi yang kurang sebelum mengirim.", "Semak pilihan aktif, tarikh akhir dan maklumat yang belum lengkap sebelum menghantar.", "راجع خياراتك النشطة والمواعيد والمعلومات الناقصة قبل التقديم."],
    ["Application signals", "Tín hiệu hồ sơ", "สัญญาณการสมัคร", "Sinyal pendaftaran", "Petunjuk permohonan", "مؤشرات التقديم"],
    ["Application stage", "Giai đoạn hồ sơ", "ขั้นตอนการสมัคร", "Tahap pendaftaran", "Peringkat permohonan", "مرحلة التقديم"],
    ["Loading", "Đang tải", "กำลังโหลด", "Memuat", "Memuatkan", "جارٍ التحميل"],
    ["What needs attention", "Nội dung cần chú ý", "สิ่งที่ต้องดำเนินการ", "Yang perlu diperhatikan", "Perkara yang perlu diberi perhatian", "ما يحتاج إلى اهتمام"],
    ["Checking your records", "Đang kiểm tra hồ sơ", "กำลังตรวจสอบข้อมูล", "Memeriksa data Anda", "Menyemak rekod anda", "جارٍ التحقق من سجلاتك"],
    ["Account summary", "Tóm tắt tài khoản", "สรุปบัญชี", "Ringkasan akun", "Ringkasan akaun", "ملخص الحساب"],
    ["Application sets", "Bộ hồ sơ", "ชุดใบสมัคร", "Set pendaftaran", "Set permohonan", "مجموعات التقديم"],
    ["Active choices", "Lựa chọn đang hoạt động", "ตัวเลือกที่ใช้งานอยู่", "Pilihan aktif", "Pilihan aktif", "الخيارات النشطة"],
    ["Unread notices", "Thông báo chưa đọc", "ประกาศที่ยังไม่ได้อ่าน", "Pemberitahuan belum dibaca", "Notis belum dibaca", "الإشعارات غير المقروءة"],
    ["Applications", "Hồ sơ đăng ký", "ใบสมัคร", "Pendaftaran", "Permohonan", "طلبات التقديم"],
    ["Current application sets", "Các bộ hồ sơ hiện tại", "ชุดใบสมัครปัจจุบัน", "Set pendaftaran saat ini", "Set permohonan semasa", "مجموعات التقديم الحالية"],
    ["Manage", "Quản lý", "จัดการ", "Kelola", "Urus", "إدارة"],
    ["Loading application sets.", "Đang tải các bộ hồ sơ.", "กำลังโหลดชุดใบสมัคร", "Memuat set pendaftaran.", "Memuatkan set permohonan.", "جارٍ تحميل مجموعات التقديم."],
    ["Notifications", "Thông báo", "การแจ้งเตือน", "Notifikasi", "Pemberitahuan", "الإشعارات"],
    ["Latest account events", "Sự kiện tài khoản mới nhất", "เหตุการณ์บัญชีล่าสุด", "Aktivitas akun terbaru", "Peristiwa akaun terkini", "أحدث أحداث الحساب"],
    ["Open inbox", "Mở hộp thư", "เปิดกล่องข้อความ", "Buka kotak masuk", "Buka peti masuk", "فتح صندوق الوارد"],
    ["Loading notifications.", "Đang tải thông báo.", "กำลังโหลดการแจ้งเตือน", "Memuat notifikasi.", "Memuatkan pemberitahuan.", "جارٍ تحميل الإشعارات."],
    ["Account", "Tài khoản", "บัญชี", "Akun", "Akaun", "الحساب"],
    ["Profile snapshot", "Tóm tắt hồ sơ", "ภาพรวมโปรไฟล์", "Ringkasan profil", "Ringkasan profil", "ملخص الملف"],
    ["Review", "Xem lại", "ตรวจสอบ", "Tinjau", "Semak", "مراجعة"],
    ["Loading profile.", "Đang tải hồ sơ.", "กำลังโหลดโปรไฟล์", "Memuat profil.", "Memuatkan profil.", "جارٍ تحميل الملف."],
    ["Not recorded", "Chưa ghi nhận", "ยังไม่มีข้อมูล", "Belum tercatat", "Belum direkodkan", "غير مسجل"],
    ["Your application records are temporarily unavailable", "Hồ sơ đăng ký tạm thời không khả dụng", "ข้อมูลการสมัครไม่พร้อมใช้งานชั่วคราว", "Data pendaftaran sementara tidak tersedia", "Rekod permohonan tidak tersedia buat sementara", "سجلات التقديم غير متاحة مؤقتًا"],
    ["Your saved work has not been changed. Try the application workspace again in a moment.", "Dữ liệu đã lưu không bị thay đổi. Hãy thử lại khu vực hồ sơ sau ít phút.", "งานที่บันทึกไว้ไม่เปลี่ยนแปลง โปรดลองพื้นที่สมัครอีกครั้งในอีกสักครู่", "Pekerjaan tersimpan tidak berubah. Coba ruang pendaftaran lagi sebentar lagi.", "Kerja yang disimpan tidak berubah. Cuba ruang permohonan sebentar lagi.", "لم يتغير عملك المحفوظ. أعد محاولة مساحة التقديم بعد قليل."],
    ["Try application workspace", "Thử lại khu vực hồ sơ", "ลองพื้นที่สมัครอีกครั้ง", "Coba ruang pendaftaran", "Cuba ruang permohonan", "أعد محاولة مساحة التقديم"],
    ["Unavailable", "Không khả dụng", "ไม่พร้อมใช้งาน", "Tidak tersedia", "Tidak tersedia", "غير متاح"],
    ["Reconnect to application records", "Kết nối lại hồ sơ đăng ký", "เชื่อมต่อข้อมูลการสมัครอีกครั้ง", "Hubungkan kembali data pendaftaran", "Sambung semula rekod permohonan", "أعد الاتصال بسجلات التقديم"],
    ["Choose your first school and program", "Chọn trường và chương trình đầu tiên", "เลือกมหาวิทยาลัยและหลักสูตรแรก", "Pilih universitas dan program pertama", "Pilih universiti dan program pertama", "اختر جامعتك وبرنامجك الأول"],
    ["Add one exact program to start the application. You can review requirements before anything is sent.", "Thêm một chương trình cụ thể để bắt đầu. Bạn có thể xem yêu cầu trước khi gửi bất kỳ nội dung nào.", "เพิ่มหลักสูตรที่แน่นอนหนึ่งรายการเพื่อเริ่มสมัคร คุณตรวจสอบข้อกำหนดได้ก่อนส่งข้อมูล", "Tambahkan satu program tertentu untuk memulai. Anda dapat meninjau persyaratan sebelum mengirim apa pun.", "Tambah satu program khusus untuk bermula. Anda boleh menyemak syarat sebelum menghantar apa-apa.", "أضف برنامجًا محددًا للبدء. يمكنك مراجعة المتطلبات قبل إرسال أي شيء."],
    ["Browse and add a program", "Tìm và thêm chương trình", "ค้นหาและเพิ่มหลักสูตร", "Cari dan tambahkan program", "Cari dan tambah program", "تصفح وأضف برنامجًا"],
    ["Not started", "Chưa bắt đầu", "ยังไม่เริ่ม", "Belum dimulai", "Belum bermula", "لم يبدأ"],
    ["Select a program", "Chọn chương trình", "เลือกหลักสูตร", "Pilih program", "Pilih program", "اختر برنامجًا"],
    ["Continue your current application", "Tiếp tục hồ sơ hiện tại", "ดำเนินการสมัครปัจจุบันต่อ", "Lanjutkan pendaftaran saat ini", "Teruskan permohonan semasa", "تابع طلبك الحالي"],
    ["Continue application", "Tiếp tục hồ sơ", "ดำเนินการสมัครต่อ", "Lanjutkan pendaftaran", "Teruskan permohonan", "متابعة التقديم"],
    ["Review the next required section before payment or submission.", "Xem phần bắt buộc tiếp theo trước khi thanh toán hoặc nộp.", "ตรวจสอบส่วนที่จำเป็นถัดไปก่อนชำระเงินหรือส่ง", "Tinjau bagian wajib berikutnya sebelum pembayaran atau pengajuan.", "Semak bahagian wajib seterusnya sebelum pembayaran atau penghantaran.", "راجع القسم المطلوب التالي قبل الدفع أو التقديم."],
    ["In progress", "Đang thực hiện", "กำลังดำเนินการ", "Sedang berlangsung", "Sedang berjalan", "قيد التنفيذ"],
    ["Review required information", "Xem lại thông tin bắt buộc", "ตรวจสอบข้อมูลที่จำเป็น", "Tinjau informasi wajib", "Semak maklumat wajib", "راجع المعلومات المطلوبة"],
    ["Complete setup for a CUAC reference", "Hoàn tất thiết lập để nhận mã CUAC", "ตั้งค่าให้เสร็จเพื่อรับรหัส CUAC", "Selesaikan penyiapan untuk referensi CUAC", "Lengkapkan penyediaan untuk rujukan CUAC", "أكمل الإعداد للحصول على مرجع CUAC"],
    ["No application set yet", "Chưa có bộ hồ sơ", "ยังไม่มีชุดใบสมัคร", "Belum ada set pendaftaran", "Belum ada set permohonan", "لا توجد مجموعة تقديم بعد"],
    ["Open the application workspace to create a named set and add exact program choices.", "Mở khu vực hồ sơ để tạo một bộ có tên và thêm chương trình cụ thể.", "เปิดพื้นที่สมัครเพื่อสร้างชุดที่มีชื่อและเพิ่มหลักสูตรที่แน่นอน", "Buka ruang pendaftaran untuk membuat set bernama dan menambahkan pilihan program tertentu.", "Buka ruang permohonan untuk mencipta set bernama dan menambah pilihan program khusus.", "افتح مساحة التقديم لإنشاء مجموعة مسماة وإضافة برامج محددة."],
    ["Unnamed application set", "Bộ hồ sơ chưa đặt tên", "ชุดใบสมัครไม่มีชื่อ", "Set pendaftaran tanpa nama", "Set permohonan tanpa nama", "مجموعة تقديم بلا اسم"],
    ["unnamed application", "hồ sơ chưa đặt tên", "ใบสมัครไม่มีชื่อ", "pendaftaran tanpa nama", "permohonan tanpa nama", "طلب بلا اسم"],
    ["CUAC reference not issued", "Chưa cấp mã CUAC", "ยังไม่ได้ออกรหัส CUAC", "Referensi CUAC belum diterbitkan", "Rujukan CUAC belum dikeluarkan", "لم يصدر مرجع CUAC"],
    ["No target intake", "Chưa có kỳ nhập học mục tiêu", "ยังไม่มีรอบเข้าเรียนเป้าหมาย", "Belum ada target penerimaan", "Tiada pengambilan sasaran", "لا يوجد موعد التحاق مستهدف"],
    ["No account events", "Không có sự kiện tài khoản", "ไม่มีกิจกรรมบัญชี", "Tidak ada aktivitas akun", "Tiada peristiwa akaun", "لا توجد أحداث للحساب"],
    ["Server-created application, billing, document, and security notices will appear here.", "Thông báo do máy chủ tạo về hồ sơ, thanh toán, tài liệu và bảo mật sẽ xuất hiện tại đây.", "การแจ้งเตือนจากเซิร์ฟเวอร์เรื่องการสมัคร การชำระเงิน เอกสาร และความปลอดภัยจะแสดงที่นี่", "Notifikasi server tentang pendaftaran, pembayaran, dokumen, dan keamanan akan muncul di sini.", "Notis pelayan tentang permohonan, pembayaran, dokumen dan keselamatan akan dipaparkan di sini.", "ستظهر هنا إشعارات الخادم المتعلقة بالتقديم والفوترة والمستندات والأمان."],
    ["Unread", "Chưa đọc", "ยังไม่ได้อ่าน", "Belum dibaca", "Belum dibaca", "غير مقروء"],
    ["Account event", "Sự kiện tài khoản", "กิจกรรมบัญชี", "Aktivitas akun", "Peristiwa akaun", "حدث حساب"],
    ["No event detail was provided.", "Không có chi tiết sự kiện.", "ไม่มีรายละเอียดกิจกรรม", "Tidak ada rincian aktivitas.", "Tiada butiran peristiwa.", "لم تُقدَّم تفاصيل للحدث."],
    ["Open", "Mở", "เปิด", "Buka", "Buka", "فتح"],
    ["Original notification content", "Nội dung thông báo gốc", "เนื้อหาการแจ้งเตือนต้นฉบับ", "Konten notifikasi asli", "Kandungan pemberitahuan asal", "محتوى الإشعار الأصلي"],
    ["No profile record yet", "Chưa có hồ sơ cá nhân", "ยังไม่มีข้อมูลโปรไฟล์", "Belum ada data profil", "Belum ada rekod profil", "لا يوجد سجل ملف بعد"],
    ["Open the applicant profile to add the information used by your application.", "Mở hồ sơ người nộp để thêm thông tin dùng cho hồ sơ đăng ký.", "เปิดโปรไฟล์ผู้สมัครเพื่อเพิ่มข้อมูลที่ใช้ในการสมัคร", "Buka profil pelamar untuk menambahkan informasi yang digunakan dalam pendaftaran.", "Buka profil pemohon untuk menambah maklumat yang digunakan dalam permohonan.", "افتح ملف المتقدم لإضافة المعلومات المستخدمة في طلبك."],
    ["Display name", "Tên hiển thị", "ชื่อที่แสดง", "Nama tampilan", "Nama paparan", "اسم العرض"],
    ["Citizenship", "Quốc tịch", "สัญชาติ", "Kewarganegaraan", "Kewarganegaraan", "الجنسية"],
    ["Target degree", "Bậc học mục tiêu", "ระดับเป้าหมาย", "Jenjang tujuan", "Tahap sasaran", "الدرجة المستهدفة"],
    ["Target intake", "Kỳ nhập học mục tiêu", "รอบเข้าเรียนเป้าหมาย", "Target penerimaan", "Pengambilan sasaran", "موعد الالتحاق المستهدف"],
    ["Associate", "Cao đẳng", "อนุปริญญา", "Diploma madya", "Diploma", "درجة الزمالة"],
    ["Bachelor", "Cử nhân", "ปริญญาตรี", "Sarjana", "Sarjana muda", "بكالوريوس"],
    ["Master", "Thạc sĩ", "ปริญญาโท", "Magister", "Sarjana", "ماجستير"],
    ["Doctoral", "Tiến sĩ", "ปริญญาเอก", "Doktor", "Kedoktoran", "دكتوراه"],
    ["Diploma", "Văn bằng", "ประกาศนียบัตร", "Diploma", "Diploma", "دبلوم"],
    ["Certificate", "Chứng chỉ", "ประกาศนียบัตร", "Sertifikat", "Sijil", "شهادة"],
    ["Foundation", "Dự bị đại học", "หลักสูตรเตรียมเข้ามหาวิทยาลัย", "Program persiapan", "Program asas", "برنامج تأسيسي"],
    ["Language", "Ngôn ngữ", "ภาษา", "Bahasa", "Bahasa", "لغة"],
    ["Non degree", "Không cấp bằng", "ไม่รับปริญญา", "Non-gelar", "Tanpa ijazah", "غير مؤهل لدرجة"],
    ["Spring", "Mùa xuân", "ฤดูใบไม้ผลิ", "Musim semi", "Musim bunga", "الربيع"],
    ["Summer", "Mùa hè", "ฤดูร้อน", "Musim panas", "Musim panas", "الصيف"],
    ["Fall", "Mùa thu", "ฤดูใบไม้ร่วง", "Musim gugur", "Musim luruh", "الخريف"],
    ["Winter", "Mùa đông", "ฤดูหนาว", "Musim dingin", "Musim sejuk", "الشتاء"],
    ["{name}'s application hub", "Trung tâm hồ sơ của {name}", "ศูนย์การสมัครของ {name}", "Pusat pendaftaran {name}", "Pusat permohonan {name}", "مركز طلبات {name}"],
    ["{count} active choice", "{count} lựa chọn đang hoạt động", "ตัวเลือกที่ใช้งานอยู่ {count} รายการ", "{count} pilihan aktif", "{count} pilihan aktif", "{count} خيار نشط"],
    ["{count} active choices", "{count} lựa chọn đang hoạt động", "ตัวเลือกที่ใช้งานอยู่ {count} รายการ", "{count} pilihan aktif", "{count} pilihan aktif", "{count} خيارات نشطة"],
    ["{count} choice", "{count} lựa chọn", "{count} ตัวเลือก", "{count} pilihan", "{count} pilihan", "{count} خيار"],
    ["{count} choices", "{count} lựa chọn", "{count} ตัวเลือก", "{count} pilihan", "{count} pilihan", "{count} خيارات"],
    ["Revision {revision}", "Bản sửa đổi {revision}", "ฉบับแก้ไข {revision}", "Revisi {revision}", "Semakan {revision}", "المراجعة {revision}"],
    ["Draft", "Bản nháp", "ฉบับร่าง", "Draf", "Draf", "مسودة"],
    ["Submitted", "Đã nộp", "ส่งแล้ว", "Dikirim", "Dihantar", "تم التقديم"],
    ["Archived", "Đã lưu trữ", "เก็บถาวร", "Diarsipkan", "Diarkibkan", "مؤرشف"],
    ["Read", "Đã đọc", "อ่านแล้ว", "Dibaca", "Dibaca", "مقروء"],
    ["Actioned", "Đã xử lý", "ดำเนินการแล้ว", "Ditindaklanjuti", "Telah diambil tindakan", "تم اتخاذ إجراء"],
    ["Unknown", "Không rõ", "ไม่ทราบ", "Tidak diketahui", "Tidak diketahui", "غير معروف"],
    ["The account request could not be completed.", "Không thể hoàn tất yêu cầu tài khoản.", "ไม่สามารถดำเนินการคำขอบัญชีได้", "Permintaan akun tidak dapat diselesaikan.", "Permintaan akaun tidak dapat diselesaikan.", "تعذر إكمال طلب الحساب."],
    ["The account response is missing its data envelope.", "Phản hồi tài khoản thiếu dữ liệu cần thiết.", "การตอบกลับของบัญชีไม่มีข้อมูลที่จำเป็น", "Respons akun tidak memiliki data yang diperlukan.", "Respons akaun tidak mempunyai data yang diperlukan.", "استجابة الحساب لا تتضمن البيانات المطلوبة."],
    ["This account service is unavailable.", "Dịch vụ tài khoản này không khả dụng.", "บริการบัญชีนี้ไม่พร้อมใช้งาน", "Layanan akun ini tidak tersedia.", "Perkhidmatan akaun ini tidak tersedia.", "خدمة الحساب هذه غير متاحة."],
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
      if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) return;
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

  window.CUACHubI18n = Object.freeze({ locale: i18n?.locale || "en", ui, format, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }))).observe(document.body, { childList: true, subtree: true });
}());
