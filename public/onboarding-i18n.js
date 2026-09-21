(function initOnboardingI18n() {
  "use strict";

  const rows = [
    ["CUAC | Set up your account", "CUAC | Thiết lập tài khoản", "CUAC | ตั้งค่าบัญชี", "CUAC | Siapkan akun", "CUAC | Sediakan akaun", "CUAC | إعداد حسابك"],
    ["CUAC Account setup:", "Thiết lập tài khoản CUAC:", "การตั้งค่าบัญชี CUAC:", "Penyiapan akun CUAC:", "Penyediaan akaun CUAC:", "إعداد حساب CUAC:"],
    ["student research preferences", "tùy chọn tìm hiểu của sinh viên", "ความต้องการค้นหาของนักศึกษา", "preferensi pencarian pelajar", "pilihan carian pelajar", "تفضيلات بحث الطالب"],
    ["Account setup scope", "Phạm vi thiết lập tài khoản", "ขอบเขตการตั้งค่าบัญชี", "Cakupan penyiapan akun", "Skop penyediaan akaun", "نطاق إعداد الحساب"],
    ["Student account", "Tài khoản sinh viên", "บัญชีนักศึกษา", "Akun pelajar", "Akaun pelajar", "حساب الطالب"],
    ["Set your study direction.", "Xác định định hướng học tập.", "กำหนดทิศทางการเรียนของคุณ", "Tentukan arah studi Anda.", "Tetapkan hala tuju pengajian anda.", "حدد اتجاه دراستك."],
    ["These answers become account-level research preferences. Applicant records and files are completed later in the application workspace.", "Các câu trả lời này trở thành tùy chọn tìm hiểu ở cấp tài khoản. Hồ sơ người nộp và tệp được hoàn thiện sau trong khu vực hồ sơ.", "คำตอบเหล่านี้จะเป็นค่าการค้นหาระดับบัญชี ส่วนข้อมูลผู้สมัครและไฟล์จะกรอกภายหลังในพื้นที่สมัคร", "Jawaban ini menjadi preferensi pencarian tingkat akun. Data dan berkas pelamar dilengkapi nanti di ruang pendaftaran.", "Jawapan ini menjadi pilihan carian peringkat akaun. Rekod dan fail pemohon dilengkapkan kemudian dalam ruang permohonan.", "تصبح هذه الإجابات تفضيلات بحث على مستوى الحساب. تُستكمل سجلات المتقدم وملفاته لاحقًا في مساحة التقديم."],
    ["Stored here", "Lưu tại đây", "จัดเก็บที่นี่", "Disimpan di sini", "Disimpan di sini", "يُحفظ هنا"],
    ["Study discovery preferences", "Tùy chọn tìm chương trình", "ความต้องการค้นหาการเรียน", "Preferensi pencarian studi", "Pilihan carian pengajian", "تفضيلات اكتشاف الدراسة"],
    ["Completed later", "Hoàn thiện sau", "กรอกภายหลัง", "Dilengkapi nanti", "Dilengkapkan kemudian", "يُستكمل لاحقًا"],
    ["Applicant identity and education", "Danh tính và học vấn người nộp", "ตัวตนและการศึกษาของผู้สมัคร", "Identitas dan pendidikan pelamar", "Identiti dan pendidikan pemohon", "هوية المتقدم وتعليمه"],
    ["Verified later", "Xác minh sau", "ตรวจสอบภายหลัง", "Diverifikasi nanti", "Disahkan kemudian", "يُتحقق منه لاحقًا"],
    ["Files and submission requirements", "Tệp và yêu cầu nộp hồ sơ", "ไฟล์และข้อกำหนดการส่ง", "Berkas dan persyaratan pengajuan", "Fail dan syarat penghantaran", "الملفات ومتطلبات التقديم"],
    ["Skip for now", "Bỏ qua lúc này", "ข้ามไปก่อน", "Lewati untuk sekarang", "Langkau buat masa ini", "تخطَّ الآن"],
    ["Account setup", "Thiết lập tài khoản", "ตั้งค่าบัญชี", "Penyiapan akun", "Penyediaan akaun", "إعداد الحساب"],
    ["Your current goal", "Mục tiêu hiện tại", "เป้าหมายปัจจุบันของคุณ", "Tujuan Anda saat ini", "Matlamat semasa anda", "هدفك الحالي"],
    ["You can change these fields later in Preferences.", "Bạn có thể thay đổi các mục này sau trong phần Tùy chọn.", "คุณเปลี่ยนข้อมูลเหล่านี้ภายหลังได้ในการตั้งค่า", "Anda dapat mengubah bidang ini nanti di Preferensi.", "Anda boleh mengubah medan ini kemudian dalam Pilihan.", "يمكنك تغيير هذه الحقول لاحقًا في التفضيلات."],
    ["Loading your student profile.", "Đang tải hồ sơ sinh viên.", "กำลังโหลดโปรไฟล์นักศึกษา", "Memuat profil pelajar Anda.", "Memuatkan profil pelajar anda.", "جارٍ تحميل ملف الطالب."],
    ["Not set", "Chưa đặt", "ยังไม่ได้ตั้งค่า", "Belum diatur", "Belum ditetapkan", "غير محدد"],
    ["Display name", "Tên hiển thị", "ชื่อที่แสดง", "Nama tampilan", "Nama paparan", "اسم العرض"],
    ["Target degree", "Bậc học mục tiêu", "ระดับการศึกษาที่ต้องการ", "Jenjang tujuan", "Tahap sasaran", "الدرجة المستهدفة"],
    ["Teaching language", "Ngôn ngữ giảng dạy", "ภาษาที่ใช้สอน", "Bahasa pengantar", "Bahasa pengantar", "لغة التدريس"],
    ["Funding intent", "Dự định tài chính", "แผนด้านทุน", "Rencana pendanaan", "Rancangan pembiayaan", "خطة التمويل"],
    ["Intake year", "Năm nhập học", "ปีเข้าเรียน", "Tahun penerimaan", "Tahun pengambilan", "سنة الالتحاق"],
    ["Intake term", "Kỳ nhập học", "ภาคเข้าเรียน", "Periode penerimaan", "Penggal pengambilan", "فصل الالتحاق"],
    ["Subject areas", "Lĩnh vực học tập", "สาขาวิชา", "Bidang studi", "Bidang pengajian", "مجالات الدراسة"],
    ["Save and open Hub", "Lưu và mở Hồ sơ", "บันทึกและเปิดพื้นที่ของฉัน", "Simpan dan buka Ruang saya", "Simpan dan buka Ruang saya", "احفظ وافتح مساحتي"],
    ["Account setup could not be loaded", "Không thể tải thiết lập tài khoản", "ไม่สามารถโหลดการตั้งค่าบัญชีได้", "Penyiapan akun tidak dapat dimuat", "Penyediaan akaun tidak dapat dimuatkan", "تعذر تحميل إعداد الحساب"],
    ["The student profile service is unavailable.", "Dịch vụ hồ sơ sinh viên hiện không khả dụng.", "บริการโปรไฟล์นักศึกษาไม่พร้อมใช้งาน", "Layanan profil pelajar tidak tersedia.", "Perkhidmatan profil pelajar tidak tersedia.", "خدمة ملف الطالب غير متاحة."],
    ["Retry", "Thử lại", "ลองอีกครั้ง", "Coba lagi", "Cuba lagi", "إعادة المحاولة"],
    ["Select no more than eight subject areas.", "Chọn không quá tám lĩnh vực học tập.", "เลือกสาขาวิชาได้ไม่เกินแปดสาขา", "Pilih tidak lebih dari delapan bidang studi.", "Pilih tidak lebih daripada lapan bidang pengajian.", "اختر ثمانية مجالات دراسية كحد أقصى."],
    ["Account setup could not be completed.", "Không thể hoàn tất thiết lập tài khoản.", "ไม่สามารถตั้งค่าบัญชีให้เสร็จได้", "Penyiapan akun tidak dapat diselesaikan.", "Penyediaan akaun tidak dapat diselesaikan.", "تعذر إكمال إعداد الحساب."],
    ["The profile response is missing its data envelope.", "Phản hồi hồ sơ thiếu dữ liệu cần thiết.", "การตอบกลับของโปรไฟล์ไม่มีข้อมูลที่จำเป็น", "Respons profil tidak memiliki data yang diperlukan.", "Respons profil tidak mempunyai data yang diperlukan.", "استجابة الملف لا تتضمن البيانات المطلوبة."],
    ["The saved profile response was incomplete.", "Phản hồi hồ sơ đã lưu chưa đầy đủ.", "การตอบกลับของโปรไฟล์ที่บันทึกไม่สมบูรณ์", "Respons profil tersimpan tidak lengkap.", "Respons profil yang disimpan tidak lengkap.", "استجابة الملف المحفوظ غير مكتملة."],
    ["Associate", "Cao đẳng", "อนุปริญญา", "Diploma dua tahun", "Diploma bersekutu", "درجة الزمالة"],
    ["Bachelor", "Cử nhân", "ปริญญาตรี", "Sarjana", "Sarjana muda", "بكالوريوس"],
    ["Master", "Thạc sĩ", "ปริญญาโท", "Magister", "Sarjana", "ماجستير"],
    ["Doctoral", "Tiến sĩ", "ปริญญาเอก", "Doktor", "Kedoktoran", "دكتوراه"],
    ["Diploma", "Văn bằng", "ประกาศนียบัตร", "Diploma", "Diploma", "دبلوم"],
    ["Certificate", "Chứng chỉ", "ประกาศนียบัตรวิชาชีพ", "Sertifikat", "Sijil", "شهادة"],
    ["Foundation", "Dự bị", "หลักสูตรเตรียมพื้นฐาน", "Persiapan", "Asasi", "تأسيسي"],
    ["Language", "Ngôn ngữ", "ภาษา", "Bahasa", "Bahasa", "لغة"],
    ["Non degree", "Không cấp bằng", "ไม่รับปริญญา", "Non-gelar", "Bukan ijazah", "دون درجة"],
    ["Computer science", "Khoa học máy tính", "วิทยาการคอมพิวเตอร์", "Ilmu komputer", "Sains komputer", "علوم الحاسوب"],
    ["Engineering", "Kỹ thuật", "วิศวกรรมศาสตร์", "Teknik", "Kejuruteraan", "الهندسة"],
    ["Business", "Kinh doanh", "ธุรกิจ", "Bisnis", "Perniagaan", "إدارة الأعمال"],
    ["Economics", "Kinh tế", "เศรษฐศาสตร์", "Ekonomi", "Ekonomi", "الاقتصاد"],
    ["Medicine", "Y khoa", "แพทยศาสตร์", "Kedokteran", "Perubatan", "الطب"],
    ["Health sciences", "Khoa học sức khỏe", "วิทยาศาสตร์สุขภาพ", "Ilmu kesehatan", "Sains kesihatan", "العلوم الصحية"],
    ["Natural sciences", "Khoa học tự nhiên", "วิทยาศาสตร์ธรรมชาติ", "Ilmu alam", "Sains semula jadi", "العلوم الطبيعية"],
    ["Social sciences", "Khoa học xã hội", "สังคมศาสตร์", "Ilmu sosial", "Sains sosial", "العلوم الاجتماعية"],
    ["Humanities", "Nhân văn", "มนุษยศาสตร์", "Humaniora", "Kemanusiaan", "العلوم الإنسانية"],
    ["Law", "Luật", "นิติศาสตร์", "Hukum", "Undang-undang", "القانون"],
    ["Arts", "Nghệ thuật", "ศิลปะ", "Seni", "Seni", "الفنون"],
    ["Education", "Giáo dục", "ศึกษาศาสตร์", "Pendidikan", "Pendidikan", "التربية"],
    ["Agriculture", "Nông nghiệp", "เกษตรศาสตร์", "Pertanian", "Pertanian", "الزراعة"],
    ["Architecture", "Kiến trúc", "สถาปัตยกรรม", "Arsitektur", "Seni bina", "العمارة"],
    ["Mathematics", "Toán học", "คณิตศาสตร์", "Matematika", "Matematik", "الرياضيات"],
    ["Interdisciplinary", "Liên ngành", "สหวิทยาการ", "Interdisipliner", "Antara disiplin", "متعدد التخصصات"],
    ["English", "Tiếng Anh", "ภาษาอังกฤษ", "Bahasa Inggris", "Bahasa Inggeris", "الإنجليزية"],
    ["Chinese", "Tiếng Trung", "ภาษาจีน", "Bahasa Mandarin", "Bahasa Cina", "الصينية"],
    ["Bilingual", "Song ngữ", "สองภาษา", "Dwibahasa", "Dwibahasa", "ثنائية اللغة"],
    ["Scholarship required", "Cần học bổng", "จำเป็นต้องมีทุน", "Beasiswa diperlukan", "Biasiswa diperlukan", "المنحة مطلوبة"],
    ["Scholarship possible", "Có thể dùng học bổng", "พิจารณาทุน", "Beasiswa memungkinkan", "Biasiswa dipertimbangkan", "المنحة ممكنة"],
    ["Self funded", "Tự túc", "ทุนส่วนตัว", "Biaya mandiri", "Biaya sendiri", "تمويل ذاتي"],
    ["Undecided", "Chưa quyết định", "ยังไม่ตัดสินใจ", "Belum memutuskan", "Belum diputuskan", "لم أقرر بعد"],
    ["Spring", "Mùa xuân", "ฤดูใบไม้ผลิ", "Musim semi", "Musim bunga", "الربيع"],
    ["Summer", "Mùa hè", "ฤดูร้อน", "Musim panas", "Musim panas", "الصيف"],
    ["Fall", "Mùa thu", "ฤดูใบไม้ร่วง", "Musim gugur", "Musim luruh", "الخريف"],
    ["Winter", "Mùa đông", "ฤดูหนาว", "Musim dingin", "Musim sejuk", "الشتاء"],
  ];

  const i18n = window.CUACI18n;
  const localeIndex = { vi: 1, th: 2, id: 3, ms: 4, ar: 5 }[i18n?.locale] || 0;
  const dictionary = new Map(rows.map((row) => [row[0], row[localeIndex] || row[0]]));
  const ui = (english) => dictionary.get(String(english)) || String(english);

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
    (root.querySelectorAll?.("[aria-label], [title], [placeholder], [data-note], [data-note-detail]") || []).forEach((element) => {
      ["aria-label", "title", "placeholder", "data-note", "data-note-detail"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value && dictionary.has(value)) element.setAttribute(attribute, ui(value));
      });
    });
  }

  window.CUACOnboardingI18n = Object.freeze({ locale: i18n?.locale || "en", ui, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }))).observe(document.body, { childList: true, subtree: true });
}());
