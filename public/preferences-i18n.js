(function initPreferencesI18n() {
  "use strict";
  const rows = [
    ["CUAC | Preferences", "CUAC | Tùy chọn", "CUAC | การตั้งค่า", "CUAC | Preferensi", "CUAC | Pilihan", "CUAC | التفضيلات"],
    ["CUAC Preferences:", "Tùy chọn CUAC:", "การตั้งค่า CUAC:", "Preferensi CUAC:", "Pilihan CUAC:", "تفضيلات CUAC:"],
    ["student research and notification settings", "cài đặt tìm hiểu và thông báo", "การตั้งค่าการค้นหาและการแจ้งเตือน", "pengaturan riset dan notifikasi pelajar", "tetapan kajian dan pemberitahuan pelajar", "إعدادات البحث والإشعارات للطالب"],
    ["Preferences breadcrumb", "Điều hướng tùy chọn", "เส้นทางการตั้งค่า", "Navigasi preferensi", "Navigasi pilihan", "مسار التفضيلات"],
    ["Preferences", "Tùy chọn", "การตั้งค่า", "Preferensi", "Pilihan", "التفضيلات"],
    ["Manage the study filters and notification channels stored for this account.", "Quản lý bộ lọc học tập và kênh thông báo của tài khoản.", "จัดการตัวกรองการเรียนและช่องทางแจ้งเตือนของบัญชี", "Kelola filter studi dan kanal notifikasi akun.", "Urus penapis pengajian dan saluran pemberitahuan akaun.", "أدر مرشحات الدراسة وقنوات الإشعار المحفوظة لهذا الحساب."],
    ["Applicant information", "Thông tin người nộp", "ข้อมูลผู้สมัคร", "Informasi pelamar", "Maklumat pemohon", "معلومات المتقدم"],
    ["Preference sections", "Các phần tùy chọn", "ส่วนการตั้งค่า", "Bagian preferensi", "Bahagian pilihan", "أقسام التفضيلات"],
    ["Account", "Tài khoản", "บัญชี", "Akun", "Akaun", "الحساب"],
    ["Study preferences", "Tùy chọn học tập", "ความต้องการด้านการเรียน", "Preferensi studi", "Pilihan pengajian", "تفضيلات الدراسة"],
    ["Sign-in identity", "Danh tính đăng nhập", "ข้อมูลประจำตัวสำหรับเข้าสู่ระบบ", "Identitas masuk", "Identiti log masuk", "هوية تسجيل الدخول"],
    ["Registration identity is managed separately from application contact details.", "Danh tính đăng ký được quản lý riêng với thông tin liên hệ hồ sơ.", "ข้อมูลลงทะเบียนจัดการแยกจากข้อมูลติดต่อในใบสมัคร", "Identitas pendaftaran dikelola terpisah dari kontak pendaftaran.", "Identiti pendaftaran diurus berasingan daripada maklumat hubungan permohonan.", "تُدار هوية التسجيل بشكل منفصل عن بيانات اتصال الطلب."],
    ["Loading account identity.", "Đang tải danh tính tài khoản.", "กำลังโหลดข้อมูลบัญชี", "Memuat identitas akun.", "Memuatkan identiti akaun.", "جارٍ تحميل هوية الحساب."],
    ["Research defaults", "Mặc định tìm hiểu", "ค่าเริ่มต้นการค้นหา", "Default riset", "Lalai kajian", "إعدادات البحث الافتراضية"],
    ["Used only as account-level discovery context.", "Chỉ dùng làm ngữ cảnh tìm kiếm ở cấp tài khoản.", "ใช้เป็นบริบทการค้นหาระดับบัญชีเท่านั้น", "Hanya digunakan sebagai konteks pencarian akun.", "Digunakan hanya sebagai konteks carian akaun.", "تُستخدم فقط كسياق اكتشاف على مستوى الحساب."],
    ["Loading study preferences.", "Đang tải tùy chọn học tập.", "กำลังโหลดการตั้งค่าการเรียน", "Memuat preferensi studi.", "Memuatkan pilihan pengajian.", "جارٍ تحميل تفضيلات الدراسة."],
    ["Delivery channels", "Kênh nhận", "ช่องทางการรับ", "Kanal pengiriman", "Saluran penghantaran", "قنوات التسليم"],
    ["Open inbox", "Mở hộp thư", "เปิดกล่องข้อความ", "Buka kotak masuk", "Buka peti masuk", "فتح صندوق الوارد"],
    ["Loading notification preferences.", "Đang tải tùy chọn thông báo.", "กำลังโหลดการตั้งค่าการแจ้งเตือน", "Memuat preferensi notifikasi.", "Memuatkan pilihan pemberitahuan.", "جارٍ تحميل تفضيلات الإشعارات."],
    ["Privacy controls", "Kiểm soát quyền riêng tư", "การควบคุมความเป็นส่วนตัว", "Kontrol privasi", "Kawalan privasi", "ضوابط الخصوصية"],
    ["Your data rights", "Quyền dữ liệu của bạn", "สิทธิในข้อมูลของคุณ", "Hak data Anda", "Hak data anda", "حقوق بياناتك"],
    ["Privacy notice", "Thông báo quyền riêng tư", "ประกาศความเป็นส่วนตัว", "Pemberitahuan privasi", "Notis privasi", "إشعار الخصوصية"],
    ["Request access, correction, a portable export, or account deletion. Export and deletion require fresh password verification and are reviewed before any data operation occurs.", "Yêu cầu truy cập, chỉnh sửa, xuất dữ liệu hoặc xóa tài khoản. Xuất và xóa cần xác minh mật khẩu mới và được xem xét trước khi xử lý.", "ขอเข้าถึง แก้ไข ส่งออก หรือลบบัญชี การส่งออกและลบต้องยืนยันรหัสผ่านใหม่และผ่านการตรวจสอบ", "Minta akses, koreksi, ekspor, atau penghapusan akun. Ekspor dan penghapusan memerlukan verifikasi kata sandi baru dan peninjauan.", "Minta akses, pembetulan, eksport atau pemadaman akaun. Eksport dan pemadaman memerlukan pengesahan kata laluan baharu dan semakan.", "اطلب الوصول أو التصحيح أو التصدير أو حذف الحساب. يتطلب التصدير والحذف تحققًا حديثًا من كلمة المرور ومراجعة مسبقة."],
    ["Loading privacy requests.", "Đang tải yêu cầu quyền riêng tư.", "กำลังโหลดคำขอความเป็นส่วนตัว", "Memuat permintaan privasi.", "Memuatkan permintaan privasi.", "جارٍ تحميل طلبات الخصوصية."],
    ["Registered email", "Email đã đăng ký", "อีเมลที่ลงทะเบียน", "Email terdaftar", "E-mel berdaftar", "البريد المسجل"],
    ["Verified", "Đã xác minh", "ยืนยันแล้ว", "Terverifikasi", "Disahkan", "تم التحقق"],
    ["Verification pending", "Chờ xác minh", "รอการยืนยัน", "Menunggu verifikasi", "Menunggu pengesahan", "التحقق قيد الانتظار"],
    ["Save study preferences", "Lưu tùy chọn học tập", "บันทึกการตั้งค่าการเรียน", "Simpan preferensi studi", "Simpan pilihan pengajian", "حفظ تفضيلات الدراسة"],
    ["Topic", "Chủ đề", "หัวข้อ", "Topik", "Topik", "الموضوع"],
    ["In app", "Trong ứng dụng", "ในแอป", "Dalam aplikasi", "Dalam aplikasi", "داخل التطبيق"],
    ["Email", "Email", "อีเมล", "Email", "E-mel", "البريد الإلكتروني"],
    ["SMS", "SMS", "SMS", "SMS", "SMS", "رسائل SMS"],
    ["Save notification preferences", "Lưu tùy chọn thông báo", "บันทึกการตั้งค่าการแจ้งเตือน", "Simpan preferensi notifikasi", "Simpan pilihan pemberitahuan", "حفظ تفضيلات الإشعارات"],
    ["Deadline reminders", "Nhắc hạn chót", "การแจ้งเตือนกำหนดเวลา", "Pengingat tenggat", "Peringatan tarikh akhir", "تذكيرات المواعيد النهائية"],
    ["{title} in-app notifications", "Thông báo trong ứng dụng: {title}", "การแจ้งเตือนในแอป: {title}", "Notifikasi dalam aplikasi: {title}", "Pemberitahuan dalam aplikasi: {title}", "إشعارات داخل التطبيق: {title}"],
    ["{title} email notifications", "Thông báo email: {title}", "การแจ้งเตือนทางอีเมล: {title}", "Notifikasi email: {title}", "Pemberitahuan e-mel: {title}", "إشعارات البريد الإلكتروني: {title}"],
    ["{title} SMS notifications", "Thông báo SMS: {title}", "การแจ้งเตือน SMS: {title}", "Notifikasi SMS: {title}", "Pemberitahuan SMS: {title}", "إشعارات SMS: {title}"],
    ["Request type", "Loại yêu cầu", "ประเภทคำขอ", "Jenis permintaan", "Jenis permintaan", "نوع الطلب"],
    ["Access my data", "Truy cập dữ liệu", "เข้าถึงข้อมูลของฉัน", "Akses data saya", "Akses data saya", "الوصول إلى بياناتي"],
    ["Correct my data", "Sửa dữ liệu", "แก้ไขข้อมูลของฉัน", "Koreksi data saya", "Betulkan data saya", "تصحيح بياناتي"],
    ["Export my data", "Xuất dữ liệu", "ส่งออกข้อมูลของฉัน", "Ekspor data saya", "Eksport data saya", "تصدير بياناتي"],
    ["Delete my account", "Xóa tài khoản", "ลบบัญชีของฉัน", "Hapus akun saya", "Padam akaun saya", "حذف حسابي"],
    ["Reply language", "Ngôn ngữ phản hồi", "ภาษาตอบกลับ", "Bahasa balasan", "Bahasa balasan", "لغة الرد"],
    ["Confirm current password", "Xác nhận mật khẩu hiện tại", "ยืนยันรหัสผ่านปัจจุบัน", "Konfirmasi kata sandi saat ini", "Sahkan kata laluan semasa", "تأكيد كلمة المرور الحالية"],
    ["Submit privacy request", "Gửi yêu cầu quyền riêng tư", "ส่งคำขอความเป็นส่วนตัว", "Kirim permintaan privasi", "Hantar permintaan privasi", "إرسال طلب الخصوصية"],
    ["No privacy requests have been submitted.", "Chưa gửi yêu cầu quyền riêng tư.", "ยังไม่มีคำขอความเป็นส่วนตัว", "Belum ada permintaan privasi.", "Tiada permintaan privasi dihantar.", "لم تُرسل طلبات خصوصية."],
    ["Account email unavailable", "Không có email tài khoản", "ไม่มีอีเมลบัญชี", "Email akun tidak tersedia", "E-mel akaun tidak tersedia", "بريد الحساب غير متاح"],
    ["The current session did not return an account identity. Sign in again or refresh this page.", "Phiên hiện tại không trả về danh tính tài khoản. Hãy đăng nhập lại hoặc tải lại trang.", "เซสชันปัจจุบันไม่มีข้อมูลบัญชี โปรดเข้าสู่ระบบใหม่หรือรีเฟรช", "Sesi saat ini tidak mengembalikan identitas akun. Masuk lagi atau muat ulang.", "Sesi semasa tidak mengembalikan identiti akaun. Log masuk semula atau muat semula.", "لم تُرجع الجلسة الحالية هوية الحساب. سجّل الدخول مجددًا أو حدّث الصفحة."],
    ["This email is used to sign in and recover account access. It does not automatically replace your application contact email.", "Email này dùng để đăng nhập và khôi phục tài khoản; không tự động thay thế email liên hệ hồ sơ.", "อีเมลนี้ใช้เข้าสู่ระบบและกู้คืนบัญชี ไม่แทนอีเมลติดต่อในใบสมัครโดยอัตโนมัติ", "Email ini digunakan untuk masuk dan pemulihan akun; tidak otomatis mengganti email kontak pendaftaran.", "E-mel ini digunakan untuk log masuk dan pemulihan akaun; ia tidak menggantikan e-mel hubungan permohonan secara automatik.", "يُستخدم هذا البريد لتسجيل الدخول واستعادة الحساب، ولا يستبدل تلقائيًا بريد اتصال الطلب."],
    ["Target degree level", "Bậc học mục tiêu", "ระดับการศึกษาที่ต้องการ", "Jenjang tujuan", "Tahap sasaran", "الدرجة المستهدفة"],
    ["Account display only. Legal applicant details stay in Applicant information.", "Chỉ dùng để hiển thị tài khoản. Thông tin pháp lý vẫn nằm trong Thông tin người nộp.", "ใช้แสดงในบัญชีเท่านั้น ข้อมูลทางกฎหมายอยู่ในข้อมูลผู้สมัคร", "Hanya untuk tampilan akun. Data resmi tetap di Informasi pelamar.", "Untuk paparan akaun sahaja. Butiran rasmi kekal dalam Maklumat pemohon.", "للعرض في الحساب فقط. تبقى البيانات القانونية ضمن معلومات المتقدم."],
    ["Select up to eight subject areas.", "Chọn tối đa tám lĩnh vực.", "เลือกได้สูงสุดแปดสาขา", "Pilih hingga delapan bidang.", "Pilih sehingga lapan bidang.", "اختر حتى ثمانية مجالات."],
    ["No notification topics are available", "Không có chủ đề thông báo", "ไม่มีหัวข้อการแจ้งเตือน", "Tidak ada topik notifikasi", "Tiada topik pemberitahuan", "لا توجد موضوعات إشعار"],
    ["The server did not return a notification preference contract for this account.", "Máy chủ không trả về cấu hình thông báo cho tài khoản này.", "เซิร์ฟเวอร์ไม่ส่งการตั้งค่าการแจ้งเตือนสำหรับบัญชีนี้", "Server tidak mengembalikan konfigurasi notifikasi akun ini.", "Pelayan tidak mengembalikan konfigurasi pemberitahuan akaun ini.", "لم يُرجع الخادم إعدادات إشعار لهذا الحساب."],
    ["Changes to your application records", "Thay đổi trong hồ sơ đăng ký", "การเปลี่ยนแปลงข้อมูลการสมัคร", "Perubahan data pendaftaran", "Perubahan rekod permohonan", "تغييرات سجلات التقديم"],
    ["Payment and refund events", "Sự kiện thanh toán và hoàn tiền", "เหตุการณ์ชำระเงินและคืนเงิน", "Aktivitas pembayaran dan pengembalian", "Peristiwa pembayaran dan bayaran balik", "أحداث الدفع والاسترداد"],
    ["Published application timing reminders", "Nhắc lịch hồ sơ đã công bố", "การเตือนกำหนดเวลาที่เผยแพร่", "Pengingat jadwal pendaftaran", "Peringatan masa permohonan", "تذكيرات مواعيد التقديم المنشورة"],
    ["File and material preparation events", "Sự kiện chuẩn bị tệp và tài liệu", "เหตุการณ์เตรียมไฟล์และเอกสาร", "Aktivitas persiapan berkas", "Peristiwa penyediaan fail", "أحداث تجهيز الملفات والمواد"],
    ["Scholarship-related account events", "Sự kiện tài khoản về học bổng", "เหตุการณ์บัญชีเกี่ยวกับทุน", "Aktivitas akun terkait beasiswa", "Peristiwa akaun berkaitan biasiswa", "أحداث الحساب المتعلقة بالمنح"],
    ["Required updates about your privacy and data-rights requests", "Cập nhật bắt buộc về yêu cầu quyền riêng tư và dữ liệu", "อัปเดตที่จำเป็นเกี่ยวกับคำขอสิทธิข้อมูล", "Pembaruan wajib terkait permintaan privasi dan hak data", "Kemas kini wajib tentang permintaan privasi dan hak data", "تحديثات مطلوبة بشأن طلبات الخصوصية وحقوق البيانات"],
    ["Required sign-in and account protection events", "Sự kiện bắt buộc về đăng nhập và bảo vệ tài khoản", "เหตุการณ์ที่จำเป็นด้านการเข้าสู่ระบบและการปกป้องบัญชี", "Aktivitas wajib untuk masuk dan perlindungan akun", "Peristiwa wajib untuk log masuk dan perlindungan akaun", "أحداث مطلوبة لتسجيل الدخول وحماية الحساب"],
    ["Information to correct", "Thông tin cần sửa", "ข้อมูลที่ต้องแก้ไข", "Informasi yang diperbaiki", "Maklumat untuk dibetulkan", "المعلومات المطلوب تصحيحها"],
    ["Account identity", "Danh tính tài khoản", "ข้อมูลประจำตัวบัญชี", "Identitas akun", "Identiti akaun", "هوية الحساب"],
    ["Applicant profile", "Hồ sơ người nộp", "โปรไฟล์ผู้สมัคร", "Profil pelamar", "Profil pemohon", "ملف المتقدم"],
    ["Education", "Học vấn", "การศึกษา", "Pendidikan", "Pendidikan", "التعليم"],
    ["Exams and tests", "Kỳ thi và bài kiểm tra", "การสอบและแบบทดสอบ", "Ujian dan tes", "Peperiksaan dan ujian", "الاختبارات والامتحانات"],
    ["Application records", "Hồ sơ đăng ký", "บันทึกการสมัคร", "Data pendaftaran", "Rekod permohonan", "سجلات التقديم"],
    ["Other structured account data", "Dữ liệu tài khoản có cấu trúc khác", "ข้อมูลบัญชีแบบมีโครงสร้างอื่น", "Data akun terstruktur lainnya", "Data akaun berstruktur lain", "بيانات حساب منظمة أخرى"],
    ["Required only for export and deletion.", "Chỉ bắt buộc khi xuất hoặc xóa.", "จำเป็นเฉพาะการส่งออกและลบ", "Hanya wajib untuk ekspor dan penghapusan.", "Wajib hanya untuk eksport dan pemadaman.", "مطلوبة فقط للتصدير والحذف."],
    ["Do not enter identity documents or sensitive details here. CUAC will provide the next verification step after receipt.", "Không nhập giấy tờ tùy thân hoặc dữ liệu nhạy cảm tại đây. CUAC sẽ cung cấp bước xác minh tiếp theo.", "อย่ากรอกเอกสารประจำตัวหรือข้อมูลอ่อนไหว CUAC จะแจ้งขั้นตอนยืนยันถัดไป", "Jangan masukkan dokumen identitas atau data sensitif. CUAC akan memberikan langkah verifikasi berikutnya.", "Jangan masukkan dokumen identiti atau butiran sensitif. CUAC akan memberikan langkah pengesahan seterusnya.", "لا تُدخل وثائق هوية أو تفاصيل حساسة هنا. ستوفر CUAC خطوة التحقق التالية."],
    ["Received {date} · {status}", "Đã nhận {date} · {status}", "ได้รับ {date} · {status}", "Diterima {date} · {status}", "Diterima {date} · {status}", "تم الاستلام {date} · {status}"],
    ["Received", "Đã nhận", "ได้รับแล้ว", "Diterima", "Diterima", "تم الاستلام"],
    ["Identity confirmed", "Đã xác nhận danh tính", "ยืนยันตัวตนแล้ว", "Identitas dikonfirmasi", "Identiti disahkan", "تم تأكيد الهوية"],
    ["Confirm identity to start review", "Xác nhận danh tính để bắt đầu xem xét", "ยืนยันตัวตนเพื่อเริ่มตรวจสอบ", "Konfirmasi identitas untuk memulai tinjauan", "Sahkan identiti untuk memulakan semakan", "أكد الهوية لبدء المراجعة"],
    ["Confirm identity", "Xác nhận danh tính", "ยืนยันตัวตน", "Konfirmasi identitas", "Sahkan identiti", "تأكيد الهوية"],
    ["Identity confirmed · waiting for review", "Đã xác nhận danh tính · chờ xem xét", "ยืนยันตัวตนแล้ว · รอตรวจสอบ", "Identitas dikonfirmasi · menunggu tinjauan", "Identiti disahkan · menunggu semakan", "تم تأكيد الهوية · بانتظار المراجعة"],
    ["Cancel", "Hủy", "ยกเลิก", "Batal", "Batal", "إلغاء"],
    ["The preference request could not be completed.", "Không thể hoàn tất yêu cầu tùy chọn.", "ไม่สามารถดำเนินการคำขอการตั้งค่าได้", "Permintaan preferensi tidak dapat diselesaikan.", "Permintaan pilihan tidak dapat diselesaikan.", "تعذر إكمال طلب التفضيلات."],
    ["The preference response is invalid.", "Phản hồi tùy chọn không hợp lệ.", "การตอบกลับการตั้งค่าไม่ถูกต้อง", "Respons preferensi tidak valid.", "Respons pilihan tidak sah.", "استجابة التفضيلات غير صالحة."],
    ["manage your preferences", "quản lý tùy chọn", "จัดการการตั้งค่า", "mengelola preferensi", "mengurus pilihan", "إدارة تفضيلاتك"],
    ["Study preferences saved.", "Đã lưu tùy chọn học tập.", "บันทึกการตั้งค่าการเรียนแล้ว", "Preferensi studi disimpan.", "Pilihan pengajian disimpan.", "تم حفظ تفضيلات الدراسة."],
    ["Notification preferences saved.", "Đã lưu tùy chọn thông báo.", "บันทึกการตั้งค่าการแจ้งเตือนแล้ว", "Preferensi notifikasi disimpan.", "Pilihan pemberitahuan disimpan.", "تم حفظ تفضيلات الإشعارات."],
    ["Privacy request received.", "Đã nhận yêu cầu quyền riêng tư.", "ได้รับคำขอความเป็นส่วนตัวแล้ว", "Permintaan privasi diterima.", "Permintaan privasi diterima.", "تم استلام طلب الخصوصية."],
    ["Privacy request cancelled.", "Đã hủy yêu cầu quyền riêng tư.", "ยกเลิกคำขอความเป็นส่วนตัวแล้ว", "Permintaan privasi dibatalkan.", "Permintaan privasi dibatalkan.", "تم إلغاء طلب الخصوصية."],
    ["Identity confirmed. Your request is ready for review.", "Đã xác nhận danh tính. Yêu cầu sẵn sàng xem xét.", "ยืนยันตัวตนแล้ว คำขอพร้อมตรวจสอบ", "Identitas dikonfirmasi. Permintaan siap ditinjau.", "Identiti disahkan. Permintaan sedia disemak.", "تم تأكيد الهوية. طلبك جاهز للمراجعة."],
    ["Retry", "Thử lại", "ลองอีกครั้ง", "Coba lagi", "Cuba lagi", "إعادة المحاولة"],
  ];
  const i18n = window.CUACI18n;
  const localeIndex = { vi: 1, th: 2, id: 3, ms: 4, ar: 5 }[i18n?.locale] || 0;
  const dictionary = new Map(rows.map(row => [row[0], row[localeIndex] || row[0]]));
  const inherited = [window.CUACOnboardingI18n, window.CUACNotificationsI18n];
  const ui = english => dictionary.get(String(english)) || inherited.map(source => source?.ui(english)).find(value => value && value !== english) || String(english);
  const format = (template, values = {}) => Object.entries(values).reduce((value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)), ui(template));
  const href = rawHref => window.CUACOnboardingI18n?.href(rawHref) || rawHref;
  function apply(root = document) {
    if (root === document) document.title = ui(document.title);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { if (!["SCRIPT", "STYLE"].includes(node.parentElement?.tagName) && !node.parentElement?.closest?.(".language-selector")) { const value = node.nodeValue.trim(); if (value && ui(value) !== value) node.nodeValue = node.nodeValue.replace(value, ui(value)); } });
    (root.querySelectorAll?.("a[href]") || []).forEach(anchor => { const value = href(anchor.getAttribute("href")); if (value) anchor.setAttribute("href", value); });
    (root.querySelectorAll?.("[aria-label], [data-note], [data-note-detail]") || []).forEach(element => ["aria-label", "data-note", "data-note-detail"].forEach(attribute => { const value = element.getAttribute(attribute); if (value && ui(value) !== value) element.setAttribute(attribute, ui(value)); }));
  }
  window.CUACPreferencesI18n = Object.freeze({ locale: i18n?.locale || "en", ui, format, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE) apply(node); }))).observe(document.body, { childList: true, subtree: true });
}());
