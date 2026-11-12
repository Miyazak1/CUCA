(function initCuacI18n() {
  "use strict";

  const metadata = {
    en: { name: "English", dir: "ltr" },
    vi: { name: "Tiếng Việt", dir: "ltr" },
    th: { name: "ไทย", dir: "ltr" },
    id: { name: "Bahasa Indonesia", dir: "ltr" },
    ms: { name: "Bahasa Melayu", dir: "ltr" },
    ar: { name: "العربية", dir: "rtl" },
    "zh-CN": { name: "简体中文", dir: "ltr" },
  };
  const aliases = { en: "en", vi: "vi", th: "th", id: "id", in: "id", ms: "ms", ar: "ar", zh: "zh-CN", "zh-cn": "zh-CN", "zh-hans": "zh-CN" };
  const copy = {
    en: {
      "shell.nav.home": "Home", "shell.nav.programs": "Programs", "shell.nav.universities": "Universities",
      "shell.nav.scholarships": "Scholarships", "shell.nav.cities": "Cities", "shell.nav.guides": "Guides", "shell.nav.insights": "Insights", "shell.nav.explore": "Explore", "shell.nav.apply": "Apply to China", "shell.nav.hub": "Hub",
      "shell.search": "Search UCAC", "shell.signIn": "Sign in", "shell.language": "Language",
      "shell.note": "China admissions:", "shell.noteDetail": "compare current published routes",
      "shell.tagline": "China admissions search for international students applying to Chinese universities.",
      "shell.contact": "Contact us", "shell.help": "Need help?", "shell.cookies": "Cookie notice",
      "shell.dataPolicy": "Data and source policy", "shell.clarity": "Admissions clarity policy", "shell.englishOnly": "English version",
      "shell.accountChecking": "Checking account status", "shell.studentAccount": "Student account", "shell.emailUnavailable": "Account email unavailable", "shell.openAccountMenu": "Open account menu", "shell.registeredEmail": "Registered account email", "shell.signOut": "Sign out", "shell.savedList": "Saved list", "shell.primaryNav": "Primary navigation", "shell.accountActions": "Account actions", "shell.openMenu": "Open navigation", "shell.closeMenu": "Close navigation", "shell.studentWorkspace": "Student workspace", "shell.studentWorkspaceTagline": "Your China application workspace", "shell.privacyData": "Privacy and data use", "shell.getSupport": "Get support",
      "shell.workspace.hub": "Hub", "shell.workspace.overview": "Overview", "shell.workspace.application": "Applications", "shell.workspace.studentInfo": "Student info", "shell.workspace.notifications": "Notifications", "shell.workspace.favourites": "Favourites", "shell.workspace.saved": "Saved", "shell.workspace.billing": "Billing", "shell.workspace.preferences": "Preferences",
      "home.kicker": "Study in China, clearly planned", "home.title": "Find your route to a Chinese university",
      "home.sub": "Search published programs, universities, scholarships, cities, and guides from one place.",
      "home.placeholder": "Search programs, universities, scholarships, or cities", "home.search": "Search",
      "home.chip.undergraduate": "Undergraduate", "home.chip.master": "Master", "home.chip.english": "English-taught",
      "home.chip.scholarship": "Scholarship", "home.chip.fall": "Current intakes",
      "home.catalogTitle": "Start with what you need", "home.cat.programs": "Programs", "home.cat.programsBody": "Compare degree, language, tuition, and intake.",
      "home.cat.universities": "Universities", "home.cat.universitiesBody": "Review location, routes, and official sources.",
      "home.cat.scholarships": "Scholarships", "home.cat.scholarshipsBody": "Explore funding without assuming an award.",
      "home.cat.cities": "Cities and cost", "home.cat.citiesBody": "Compare living cost and study environment.",
      "home.planTitle": "A clear application route has four parts", "home.planBody": "Use UCAC to narrow the catalog, then confirm every deadline and requirement with the university.",
      "home.step.1": "Discover", "home.step.1Body": "Choose a subject, city, or university.", "home.step.2": "Compare", "home.step.2Body": "Check tuition, language, and intake dates.",
      "home.step.3": "Prepare", "home.step.3Body": "Understand requirements and document work.", "home.step.4": "Decide", "home.step.4Body": "Build a shortlist worth applying to.",
      "home.boundaryTitle": "Important application boundary", "home.boundaryBody": "UCAC helps you discover and organize choices. Students submit application materials through each university's official channel in this release.",
      "home.accountTitle": "Keep your China options together", "home.accountBody": "Save programs, compare routes, and track intake dates in one student workspace.", "home.create": "Create list",
      "home.destinationNotice": "Catalog controls, city pages, guides, and insights are available in the selected language. Official names and source admissions content retain their published language.",
      "home.feedback.search": "Press Enter or Search to view matching published catalog results.", "home.feedback.empty": "Enter a program, university, scholarship, or city.",
    },
    vi: {
      "shell.nav.home": "Trang chủ", "shell.nav.programs": "Chương trình", "shell.nav.universities": "Trường đại học", "shell.nav.scholarships": "Học bổng", "shell.nav.cities": "Thành phố", "shell.nav.guides": "Hướng dẫn", "shell.nav.insights": "Phân tích", "shell.nav.explore": "Khám phá", "shell.nav.apply": "Đăng ký học tại Trung Quốc", "shell.nav.hub": "Hồ sơ", "shell.openMenu": "Mở điều hướng", "shell.closeMenu": "Đóng điều hướng",
      "shell.search": "Tìm kiếm trên UCAC", "shell.signIn": "Đăng nhập", "shell.language": "Ngôn ngữ", "shell.note": "Tuyển sinh Trung Quốc:", "shell.noteDetail": "so sánh các lộ trình hiện đang công bố",
      "shell.tagline": "Nền tảng tìm kiếm tuyển sinh dành cho sinh viên quốc tế muốn học tại các trường đại học Trung Quốc.", "shell.contact": "Liên hệ", "shell.help": "Cần hỗ trợ?", "shell.cookies": "Thông báo cookie", "shell.dataPolicy": "Chính sách dữ liệu và nguồn", "shell.clarity": "Chính sách minh bạch tuyển sinh", "shell.englishOnly": "Bản tiếng Anh",
      "shell.accountChecking": "Đang kiểm tra tài khoản", "shell.studentAccount": "Tài khoản sinh viên", "shell.emailUnavailable": "Không có email tài khoản", "shell.openAccountMenu": "Mở menu tài khoản", "shell.registeredEmail": "Email tài khoản đã đăng ký", "shell.signOut": "Đăng xuất", "shell.savedList": "Danh sách đã lưu", "shell.primaryNav": "Điều hướng chính", "shell.accountActions": "Thao tác tài khoản", "shell.studentWorkspace": "Không gian sinh viên", "shell.studentWorkspaceTagline": "Không gian hồ sơ du học Trung Quốc của bạn", "shell.privacyData": "Quyền riêng tư và sử dụng dữ liệu", "shell.getSupport": "Nhận hỗ trợ",
      "shell.workspace.hub": "Hồ sơ", "shell.workspace.overview": "Tổng quan", "shell.workspace.application": "Hồ sơ đăng ký", "shell.workspace.studentInfo": "Thông tin sinh viên", "shell.workspace.notifications": "Thông báo", "shell.workspace.favourites": "Mục yêu thích", "shell.workspace.saved": "Đã lưu", "shell.workspace.billing": "Thanh toán", "shell.workspace.preferences": "Tùy chọn",
      "home.kicker": "Lập kế hoạch du học Trung Quốc rõ ràng", "home.title": "Tìm lộ trình vào đại học Trung Quốc", "home.sub": "Tìm chương trình, trường đại học, học bổng, thành phố và hướng dẫn đã công bố tại một nơi.",
      "home.placeholder": "Tìm chương trình, trường đại học, học bổng hoặc thành phố", "home.search": "Tìm kiếm", "home.chip.undergraduate": "Đại học", "home.chip.master": "Thạc sĩ", "home.chip.english": "Dạy bằng tiếng Anh", "home.chip.scholarship": "Học bổng", "home.chip.fall": "Kỳ nhập học hiện tại",
      "home.catalogTitle": "Bắt đầu từ nhu cầu của bạn", "home.cat.programs": "Chương trình", "home.cat.programsBody": "So sánh bậc học, ngôn ngữ, học phí và kỳ nhập học.", "home.cat.universities": "Trường đại học", "home.cat.universitiesBody": "Xem địa điểm, lộ trình và nguồn chính thức.", "home.cat.scholarships": "Học bổng", "home.cat.scholarshipsBody": "Tìm cơ hội tài trợ mà không coi đó là bảo đảm.", "home.cat.cities": "Thành phố và chi phí", "home.cat.citiesBody": "So sánh sinh hoạt phí và môi trường học tập.",
      "home.planTitle": "Một lộ trình rõ ràng gồm bốn bước", "home.planBody": "Dùng UCAC để thu hẹp lựa chọn, sau đó xác nhận hạn và yêu cầu với trường.", "home.step.1": "Khám phá", "home.step.1Body": "Chọn ngành, thành phố hoặc trường.", "home.step.2": "So sánh", "home.step.2Body": "Kiểm tra học phí, ngôn ngữ và kỳ nhập học.", "home.step.3": "Chuẩn bị", "home.step.3Body": "Hiểu yêu cầu và hồ sơ cần chuẩn bị.", "home.step.4": "Quyết định", "home.step.4Body": "Lập danh sách phù hợp để nộp.",
      "home.boundaryTitle": "Phạm vi hỗ trợ quan trọng", "home.boundaryBody": "UCAC hỗ trợ tìm kiếm và sắp xếp lựa chọn. Trong phiên bản này, sinh viên nộp hồ sơ qua kênh chính thức của từng trường.", "home.accountTitle": "Quản lý các lựa chọn du học Trung Quốc", "home.accountBody": "Lưu chương trình, so sánh lộ trình và theo dõi kỳ nhập học trong một không gian sinh viên.", "home.create": "Tạo danh sách", "home.destinationNotice": "Điều khiển danh mục, trang thành phố, hướng dẫn và phân tích có bằng ngôn ngữ đã chọn. Tên chính thức và nội dung tuyển sinh từ nguồn giữ ngôn ngữ gốc.", "home.feedback.search": "Nhấn Enter hoặc Tìm kiếm để xem kết quả đã công bố.", "home.feedback.empty": "Nhập chương trình, trường đại học, học bổng hoặc thành phố.",
    },
    th: {
      "shell.nav.home": "หน้าหลัก", "shell.nav.programs": "หลักสูตร", "shell.nav.universities": "มหาวิทยาลัย", "shell.nav.scholarships": "ทุนการศึกษา", "shell.nav.cities": "เมือง", "shell.nav.guides": "คู่มือ", "shell.nav.insights": "บทวิเคราะห์", "shell.nav.explore": "สำรวจ", "shell.nav.apply": "สมัครเรียนในจีน", "shell.nav.hub": "พื้นที่ของฉัน", "shell.openMenu": "เปิดเมนูนำทาง", "shell.closeMenu": "ปิดเมนูนำทาง",
      "shell.search": "ค้นหาใน UCAC", "shell.signIn": "เข้าสู่ระบบ", "shell.language": "ภาษา", "shell.note": "การรับสมัครเรียนในจีน:", "shell.noteDetail": "เปรียบเทียบเส้นทางที่เผยแพร่ในปัจจุบัน", "shell.tagline": "แพลตฟอร์มค้นหาการรับสมัครสำหรับนักศึกษาต่างชาติที่สมัครมหาวิทยาลัยในจีน", "shell.contact": "ติดต่อเรา", "shell.help": "ต้องการความช่วยเหลือ?", "shell.cookies": "ประกาศคุกกี้", "shell.dataPolicy": "นโยบายข้อมูลและแหล่งที่มา", "shell.clarity": "นโยบายความชัดเจนด้านการรับสมัคร", "shell.englishOnly": "ฉบับภาษาอังกฤษ",
      "shell.accountChecking": "กำลังตรวจสอบบัญชี", "shell.studentAccount": "บัญชีนักศึกษา", "shell.emailUnavailable": "ไม่มีอีเมลบัญชี", "shell.openAccountMenu": "เปิดเมนูบัญชี", "shell.registeredEmail": "อีเมลบัญชีที่ลงทะเบียน", "shell.signOut": "ออกจากระบบ", "shell.savedList": "รายการที่บันทึก", "shell.primaryNav": "การนำทางหลัก", "shell.accountActions": "การดำเนินการบัญชี", "shell.studentWorkspace": "พื้นที่นักศึกษา", "shell.studentWorkspaceTagline": "พื้นที่การสมัครเรียนต่อจีนของคุณ", "shell.privacyData": "ความเป็นส่วนตัวและการใช้ข้อมูล", "shell.getSupport": "รับความช่วยเหลือ",
      "shell.workspace.hub": "พื้นที่ของฉัน", "shell.workspace.overview": "ภาพรวม", "shell.workspace.application": "ใบสมัคร", "shell.workspace.studentInfo": "ข้อมูลนักศึกษา", "shell.workspace.notifications": "การแจ้งเตือน", "shell.workspace.favourites": "รายการโปรด", "shell.workspace.saved": "บันทึกแล้ว", "shell.workspace.billing": "การชำระเงิน", "shell.workspace.preferences": "การตั้งค่า",
      "home.kicker": "วางแผนเรียนต่อจีนอย่างชัดเจน", "home.title": "ค้นหาเส้นทางสู่มหาวิทยาลัยจีน", "home.sub": "ค้นหาหลักสูตร มหาวิทยาลัย ทุน เมือง และคู่มือที่เผยแพร่แล้วในที่เดียว", "home.placeholder": "ค้นหาหลักสูตร มหาวิทยาลัย ทุนการศึกษา หรือเมือง", "home.search": "ค้นหา", "home.chip.undergraduate": "ปริญญาตรี", "home.chip.master": "ปริญญาโท", "home.chip.english": "สอนเป็นภาษาอังกฤษ", "home.chip.scholarship": "ทุนการศึกษา", "home.chip.fall": "รอบเข้าเรียนปัจจุบัน",
      "home.catalogTitle": "เริ่มจากสิ่งที่คุณต้องการ", "home.cat.programs": "หลักสูตร", "home.cat.programsBody": "เปรียบเทียบระดับ ภาษา ค่าเล่าเรียน และรอบเข้าเรียน", "home.cat.universities": "มหาวิทยาลัย", "home.cat.universitiesBody": "ดูสถานที่ เส้นทาง และแหล่งข้อมูลทางการ", "home.cat.scholarships": "ทุนการศึกษา", "home.cat.scholarshipsBody": "สำรวจแหล่งทุนโดยไม่ถือว่าได้รับการรับรอง", "home.cat.cities": "เมืองและค่าใช้จ่าย", "home.cat.citiesBody": "เปรียบเทียบค่าครองชีพและสภาพแวดล้อมการเรียน",
      "home.planTitle": "เส้นทางสมัครที่ชัดเจนมีสี่ขั้น", "home.planBody": "ใช้ UCAC เพื่อคัดตัวเลือก แล้วตรวจสอบกำหนดเวลาและข้อกำหนดกับมหาวิทยาลัย", "home.step.1": "ค้นหา", "home.step.1Body": "เลือกสาขา เมือง หรือมหาวิทยาลัย", "home.step.2": "เปรียบเทียบ", "home.step.2Body": "ตรวจค่าเล่าเรียน ภาษา และรอบเข้าเรียน", "home.step.3": "เตรียมตัว", "home.step.3Body": "ทำความเข้าใจข้อกำหนดและเอกสาร", "home.step.4": "ตัดสินใจ", "home.step.4Body": "สร้างรายชื่อที่เหมาะแก่การสมัคร",
      "home.boundaryTitle": "ขอบเขตการสมัครที่สำคัญ", "home.boundaryBody": "UCAC ช่วยค้นหาและจัดตัวเลือก ในรุ่นนี้นักศึกษาส่งเอกสารผ่านช่องทางทางการของแต่ละมหาวิทยาลัย", "home.accountTitle": "รวมตัวเลือกเรียนต่อจีนไว้ด้วยกัน", "home.accountBody": "บันทึกหลักสูตร เปรียบเทียบเส้นทาง และติดตามรอบเข้าเรียนในพื้นที่นักศึกษาเดียว", "home.create": "สร้างรายการ", "home.destinationNotice": "ส่วนควบคุมแค็ตตาล็อก หน้าเมือง คู่มือ และบทวิเคราะห์มีในภาษาที่เลือก ชื่อทางการและเนื้อหาการรับสมัครจากแหล่งข้อมูลคงภาษาที่เผยแพร่เดิม", "home.feedback.search": "กด Enter หรือค้นหาเพื่อดูผลลัพธ์ที่เผยแพร่แล้ว", "home.feedback.empty": "กรอกหลักสูตร มหาวิทยาลัย ทุน หรือเมือง",
    },
    id: {
      "shell.nav.home": "Beranda", "shell.nav.programs": "Program", "shell.nav.universities": "Universitas", "shell.nav.scholarships": "Beasiswa", "shell.nav.cities": "Kota", "shell.nav.guides": "Panduan", "shell.nav.insights": "Wawasan", "shell.nav.explore": "Jelajahi", "shell.nav.apply": "Daftar ke Tiongkok", "shell.nav.hub": "Ruang saya", "shell.openMenu": "Buka navigasi", "shell.closeMenu": "Tutup navigasi",
      "shell.search": "Cari di UCAC", "shell.signIn": "Masuk", "shell.language": "Bahasa", "shell.note": "Penerimaan studi di Tiongkok:", "shell.noteDetail": "bandingkan jalur yang sedang dipublikasikan", "shell.tagline": "Pencarian penerimaan bagi pelajar internasional yang mendaftar ke universitas di Tiongkok.", "shell.contact": "Hubungi kami", "shell.help": "Perlu bantuan?", "shell.cookies": "Pemberitahuan cookie", "shell.dataPolicy": "Kebijakan data dan sumber", "shell.clarity": "Kebijakan kejelasan penerimaan", "shell.englishOnly": "Versi bahasa Inggris",
      "shell.accountChecking": "Memeriksa status akun", "shell.studentAccount": "Akun pelajar", "shell.emailUnavailable": "Email akun tidak tersedia", "shell.openAccountMenu": "Buka menu akun", "shell.registeredEmail": "Email akun terdaftar", "shell.signOut": "Keluar", "shell.savedList": "Daftar tersimpan", "shell.primaryNav": "Navigasi utama", "shell.accountActions": "Tindakan akun", "shell.studentWorkspace": "Ruang pelajar", "shell.studentWorkspaceTagline": "Ruang pendaftaran studi Tiongkok Anda", "shell.privacyData": "Privasi dan penggunaan data", "shell.getSupport": "Dapatkan bantuan",
      "shell.workspace.hub": "Ruang saya", "shell.workspace.overview": "Ringkasan", "shell.workspace.application": "Pendaftaran", "shell.workspace.studentInfo": "Informasi pelajar", "shell.workspace.notifications": "Notifikasi", "shell.workspace.favourites": "Favorit", "shell.workspace.saved": "Tersimpan", "shell.workspace.billing": "Pembayaran", "shell.workspace.preferences": "Preferensi",
      "home.kicker": "Rencanakan studi di Tiongkok dengan jelas", "home.title": "Temukan jalur ke universitas di Tiongkok", "home.sub": "Cari program, universitas, beasiswa, kota, dan panduan yang telah dipublikasikan dalam satu tempat.", "home.placeholder": "Cari program, universitas, beasiswa, atau kota", "home.search": "Cari", "home.chip.undergraduate": "Sarjana", "home.chip.master": "Magister", "home.chip.english": "Berbahasa Inggris", "home.chip.scholarship": "Beasiswa", "home.chip.fall": "Penerimaan saat ini",
      "home.catalogTitle": "Mulai dari kebutuhan Anda", "home.cat.programs": "Program", "home.cat.programsBody": "Bandingkan jenjang, bahasa, biaya kuliah, dan penerimaan.", "home.cat.universities": "Universitas", "home.cat.universitiesBody": "Tinjau lokasi, jalur, dan sumber resmi.", "home.cat.scholarships": "Beasiswa", "home.cat.scholarshipsBody": "Jelajahi pendanaan tanpa menganggapnya pasti.", "home.cat.cities": "Kota dan biaya", "home.cat.citiesBody": "Bandingkan biaya hidup dan lingkungan belajar.",
      "home.planTitle": "Jalur pendaftaran yang jelas memiliki empat tahap", "home.planBody": "Gunakan UCAC untuk mempersempit katalog, lalu konfirmasikan tenggat dan persyaratan kepada universitas.", "home.step.1": "Temukan", "home.step.1Body": "Pilih bidang, kota, atau universitas.", "home.step.2": "Bandingkan", "home.step.2Body": "Periksa biaya, bahasa, dan jadwal masuk.", "home.step.3": "Siapkan", "home.step.3Body": "Pahami persyaratan dan dokumen.", "home.step.4": "Putuskan", "home.step.4Body": "Susun daftar yang layak didaftarkan.",
      "home.boundaryTitle": "Batas penting layanan pendaftaran", "home.boundaryBody": "UCAC membantu menemukan dan mengatur pilihan. Pada rilis ini, pelajar mengirim dokumen melalui kanal resmi setiap universitas.", "home.accountTitle": "Satukan pilihan studi di Tiongkok", "home.accountBody": "Simpan program, bandingkan jalur, dan pantau jadwal masuk dalam satu ruang pelajar.", "home.create": "Buat daftar", "home.destinationNotice": "Kontrol katalog, halaman kota, panduan, dan analisis tersedia dalam bahasa pilihan. Nama resmi dan konten penerimaan dari sumber tetap dalam bahasa publikasinya.", "home.feedback.search": "Tekan Enter atau Cari untuk melihat hasil katalog yang dipublikasikan.", "home.feedback.empty": "Masukkan program, universitas, beasiswa, atau kota.",
    },
    ms: {
      "shell.nav.home": "Utama", "shell.nav.programs": "Program", "shell.nav.universities": "Universiti", "shell.nav.scholarships": "Biasiswa", "shell.nav.cities": "Bandar", "shell.nav.guides": "Panduan", "shell.nav.insights": "Wawasan", "shell.nav.explore": "Teroka", "shell.nav.apply": "Mohon ke China", "shell.nav.hub": "Ruang saya", "shell.openMenu": "Buka navigasi", "shell.closeMenu": "Tutup navigasi",
      "shell.search": "Cari di UCAC", "shell.signIn": "Log masuk", "shell.language": "Bahasa", "shell.note": "Kemasukan pengajian di China:", "shell.noteDetail": "bandingkan laluan yang sedang diterbitkan", "shell.tagline": "Carian kemasukan untuk pelajar antarabangsa yang memohon ke universiti di China.", "shell.contact": "Hubungi kami", "shell.help": "Perlukan bantuan?", "shell.cookies": "Notis kuki", "shell.dataPolicy": "Dasar data dan sumber", "shell.clarity": "Dasar kejelasan kemasukan", "shell.englishOnly": "Versi bahasa Inggeris",
      "shell.accountChecking": "Menyemak status akaun", "shell.studentAccount": "Akaun pelajar", "shell.emailUnavailable": "E-mel akaun tidak tersedia", "shell.openAccountMenu": "Buka menu akaun", "shell.registeredEmail": "E-mel akaun berdaftar", "shell.signOut": "Log keluar", "shell.savedList": "Senarai disimpan", "shell.primaryNav": "Navigasi utama", "shell.accountActions": "Tindakan akaun", "shell.studentWorkspace": "Ruang pelajar", "shell.studentWorkspaceTagline": "Ruang permohonan pengajian China anda", "shell.privacyData": "Privasi dan penggunaan data", "shell.getSupport": "Dapatkan sokongan",
      "shell.workspace.hub": "Ruang saya", "shell.workspace.overview": "Gambaran keseluruhan", "shell.workspace.application": "Permohonan", "shell.workspace.studentInfo": "Maklumat pelajar", "shell.workspace.notifications": "Pemberitahuan", "shell.workspace.favourites": "Kegemaran", "shell.workspace.saved": "Disimpan", "shell.workspace.billing": "Pembayaran", "shell.workspace.preferences": "Pilihan",
      "home.kicker": "Rancang pengajian di China dengan jelas", "home.title": "Cari laluan ke universiti di China", "home.sub": "Cari program, universiti, biasiswa, bandar dan panduan yang diterbitkan dalam satu tempat.", "home.placeholder": "Cari program, universiti, biasiswa atau bandar", "home.search": "Cari", "home.chip.undergraduate": "Sarjana muda", "home.chip.master": "Sarjana", "home.chip.english": "Diajarkan dalam bahasa Inggeris", "home.chip.scholarship": "Biasiswa", "home.chip.fall": "Pengambilan semasa",
      "home.catalogTitle": "Mulakan dengan keperluan anda", "home.cat.programs": "Program", "home.cat.programsBody": "Bandingkan tahap, bahasa, yuran dan pengambilan.", "home.cat.universities": "Universiti", "home.cat.universitiesBody": "Semak lokasi, laluan dan sumber rasmi.", "home.cat.scholarships": "Biasiswa", "home.cat.scholarshipsBody": "Teroka pembiayaan tanpa menganggapnya terjamin.", "home.cat.cities": "Bandar dan kos", "home.cat.citiesBody": "Bandingkan kos sara hidup dan persekitaran belajar.",
      "home.planTitle": "Laluan permohonan yang jelas mempunyai empat langkah", "home.planBody": "Gunakan UCAC untuk mengecilkan pilihan, kemudian sahkan tarikh akhir dan syarat dengan universiti.", "home.step.1": "Teroka", "home.step.1Body": "Pilih bidang, bandar atau universiti.", "home.step.2": "Bandingkan", "home.step.2Body": "Semak yuran, bahasa dan tarikh pengambilan.", "home.step.3": "Sediakan", "home.step.3Body": "Fahami syarat dan dokumen.", "home.step.4": "Putuskan", "home.step.4Body": "Bina senarai yang sesuai untuk dipohon.",
      "home.boundaryTitle": "Batas penting permohonan", "home.boundaryBody": "UCAC membantu mencari dan menyusun pilihan. Dalam keluaran ini, pelajar menghantar dokumen melalui saluran rasmi setiap universiti.", "home.accountTitle": "Satukan pilihan pengajian di China", "home.accountBody": "Simpan program, bandingkan laluan dan jejak pengambilan dalam satu ruang pelajar.", "home.create": "Cipta senarai", "home.destinationNotice": "Kawalan katalog, halaman bandar, panduan dan analisis tersedia dalam bahasa pilihan. Nama rasmi dan kandungan kemasukan daripada sumber mengekalkan bahasa asal penerbitan.", "home.feedback.search": "Tekan Enter atau Cari untuk melihat hasil katalog yang diterbitkan.", "home.feedback.empty": "Masukkan program, universiti, biasiswa atau bandar.",
    },
    ar: {
      "shell.nav.home": "الرئيسية", "shell.nav.programs": "البرامج", "shell.nav.universities": "الجامعات", "shell.nav.scholarships": "المنح", "shell.nav.cities": "المدن", "shell.nav.guides": "الأدلة", "shell.nav.insights": "الرؤى", "shell.nav.explore": "استكشف", "shell.nav.apply": "التقديم إلى الصين", "shell.nav.hub": "مساحتي", "shell.openMenu": "فتح التنقل", "shell.closeMenu": "إغلاق التنقل",
      "shell.search": "البحث في UCAC", "shell.signIn": "تسجيل الدخول", "shell.language": "اللغة", "shell.note": "القبول للدراسة في الصين:", "shell.noteDetail": "قارن المسارات المنشورة حاليًا", "shell.tagline": "منصة بحث للطلاب الدوليين المتقدمين إلى الجامعات الصينية.", "shell.contact": "اتصل بنا", "shell.help": "هل تحتاج إلى مساعدة؟", "shell.cookies": "إشعار ملفات الارتباط", "shell.dataPolicy": "سياسة البيانات والمصادر", "shell.clarity": "سياسة وضوح القبول", "shell.englishOnly": "النسخة الإنجليزية",
      "shell.accountChecking": "جارٍ التحقق من حالة الحساب", "shell.studentAccount": "حساب الطالب", "shell.emailUnavailable": "بريد الحساب غير متاح", "shell.openAccountMenu": "فتح قائمة الحساب", "shell.registeredEmail": "بريد الحساب المسجل", "shell.signOut": "تسجيل الخروج", "shell.savedList": "القائمة المحفوظة", "shell.primaryNav": "التنقل الرئيسي", "shell.accountActions": "إجراءات الحساب", "shell.studentWorkspace": "مساحة الطالب", "shell.studentWorkspaceTagline": "مساحة تقديمك للدراسة في الصين", "shell.privacyData": "الخصوصية واستخدام البيانات", "shell.getSupport": "الحصول على الدعم",
      "shell.workspace.hub": "مساحتي", "shell.workspace.overview": "نظرة عامة", "shell.workspace.application": "طلبات التقديم", "shell.workspace.studentInfo": "معلومات الطالب", "shell.workspace.notifications": "الإشعارات", "shell.workspace.favourites": "المفضلة", "shell.workspace.saved": "المحفوظات", "shell.workspace.billing": "الفوترة", "shell.workspace.preferences": "التفضيلات",
      "home.kicker": "خطط للدراسة في الصين بوضوح", "home.title": "اعثر على مسارك إلى جامعة صينية", "home.sub": "ابحث عن البرامج والجامعات والمنح والمدن والأدلة المنشورة في مكان واحد.", "home.placeholder": "ابحث عن البرامج أو الجامعات أو المنح أو المدن", "home.search": "بحث", "home.chip.undergraduate": "بكالوريوس", "home.chip.master": "ماجستير", "home.chip.english": "باللغة الإنجليزية", "home.chip.scholarship": "منحة", "home.chip.fall": "مواعيد الالتحاق الحالية",
      "home.catalogTitle": "ابدأ بما تحتاج إليه", "home.cat.programs": "البرامج", "home.cat.programsBody": "قارن الدرجة واللغة والرسوم وموعد الالتحاق.", "home.cat.universities": "الجامعات", "home.cat.universitiesBody": "راجع الموقع والمسارات والمصادر الرسمية.", "home.cat.scholarships": "المنح", "home.cat.scholarshipsBody": "استكشف التمويل من دون اعتباره مضمونًا.", "home.cat.cities": "المدن والتكلفة", "home.cat.citiesBody": "قارن تكلفة المعيشة وبيئة الدراسة.",
      "home.planTitle": "يتكوّن مسار التقديم الواضح من أربع خطوات", "home.planBody": "استخدم UCAC لتضييق الخيارات، ثم أكد كل موعد ومتطلب مع الجامعة.", "home.step.1": "اكتشف", "home.step.1Body": "اختر تخصصًا أو مدينة أو جامعة.", "home.step.2": "قارن", "home.step.2Body": "تحقق من الرسوم واللغة ومواعيد الالتحاق.", "home.step.3": "استعد", "home.step.3Body": "افهم المتطلبات والعمل المطلوب للوثائق.", "home.step.4": "قرر", "home.step.4Body": "أنشئ قائمة مناسبة للتقديم.",
      "home.boundaryTitle": "حدود مهمة لخدمة التقديم", "home.boundaryBody": "يساعدك UCAC على اكتشاف الخيارات وتنظيمها. في هذا الإصدار يرسل الطلاب مستندات التقديم عبر القناة الرسمية لكل جامعة.", "home.accountTitle": "اجمع خيارات الدراسة في الصين", "home.accountBody": "احفظ البرامج وقارن المسارات وتابع مواعيد الالتحاق في مساحة طالب واحدة.", "home.create": "إنشاء قائمة", "home.destinationNotice": "تتوفر عناصر الدليل وصفحات المدن والأدلة والتحليلات باللغة المختارة. وتحتفظ الأسماء الرسمية ومحتويات مصادر القبول بلغة نشرها الأصلية.", "home.feedback.search": "اضغط Enter أو بحث لعرض نتائج الكتالوج المنشورة.", "home.feedback.empty": "أدخل برنامجًا أو جامعة أو منحة أو مدينة.",
    },
  };

  Object.assign(copy.en, {
    "shell.homeLabel": "UCAC home", "shell.logoAlt": "UCAC — Study in China — University & College Application Center",
    "shell.rights": "All rights reserved.", "shell.backToTop": "Back to top",
    "shell.nav.documents": "Documents", "shell.nav.language": "Language requirements", "shell.nav.visa": "Visa and JW form", "shell.nav.timeline": "Intake calendar",
  });
  Object.assign(copy.vi, {
    "shell.homeLabel": "Trang chủ UCAC", "shell.logoAlt": "UCAC — Du học Trung Quốc — Trung tâm đăng ký đại học và cao đẳng",
    "shell.rights": "Bảo lưu mọi quyền.", "shell.backToTop": "Về đầu trang",
    "shell.nav.documents": "Hồ sơ", "shell.nav.language": "Yêu cầu ngôn ngữ", "shell.nav.visa": "Thị thực và mẫu JW", "shell.nav.timeline": "Lịch tuyển sinh",
  });
  Object.assign(copy.th, { "shell.homeLabel": "หน้าแรก UCAC", "shell.logoAlt": "UCAC — เรียนต่อจีน — ศูนย์สมัครมหาวิทยาลัยและวิทยาลัย", "shell.rights": "สงวนลิขสิทธิ์", "shell.backToTop": "กลับด้านบน", "shell.nav.documents": "เอกสาร", "shell.nav.language": "ข้อกำหนดภาษา", "shell.nav.visa": "วีซ่าและแบบฟอร์ม JW", "shell.nav.timeline": "ปฏิทินรับสมัคร" });
  Object.assign(copy.id, { "shell.homeLabel": "Beranda UCAC", "shell.logoAlt": "UCAC — Studi di Tiongkok — Pusat Pendaftaran Universitas dan Perguruan Tinggi", "shell.rights": "Hak cipta dilindungi.", "shell.backToTop": "Kembali ke atas", "shell.nav.documents": "Dokumen", "shell.nav.language": "Persyaratan bahasa", "shell.nav.visa": "Visa dan formulir JW", "shell.nav.timeline": "Kalender penerimaan" });
  Object.assign(copy.ms, { "shell.homeLabel": "Laman utama UCAC", "shell.logoAlt": "UCAC — Pengajian di China — Pusat Permohonan Universiti dan Kolej", "shell.rights": "Hak cipta terpelihara.", "shell.backToTop": "Kembali ke atas", "shell.nav.documents": "Dokumen", "shell.nav.language": "Syarat bahasa", "shell.nav.visa": "Visa dan borang JW", "shell.nav.timeline": "Kalendar pengambilan" });
  Object.assign(copy.ar, { "shell.homeLabel": "الصفحة الرئيسية لـ UCAC", "shell.logoAlt": "UCAC — الدراسة في الصين — مركز التقديم للجامعات والكليات", "shell.rights": "جميع الحقوق محفوظة.", "shell.backToTop": "العودة إلى الأعلى", "shell.nav.documents": "الوثائق", "shell.nav.language": "متطلبات اللغة", "shell.nav.visa": "التأشيرة ونموذج JW", "shell.nav.timeline": "تقويم القبول" });

  function normalize(value) {
    if (typeof value !== "string") return null;
    const tag = value.trim().replaceAll("_", "-").toLowerCase();
    return aliases[tag] || aliases[tag.split("-")[0]] || null;
  }
  const ready = (document.body.dataset.i18nLocales || document.querySelector("[data-i18n-locales]")?.dataset.i18nLocales || "en").split(",").map(normalize).filter((item, index, all) => item && all.indexOf(item) === index);
  if (!ready.includes("en")) ready.unshift("en");
  const requested = normalize(new URLSearchParams(location.search).get("lang"));
  const browser = (navigator.languages || [navigator.language]).map(normalize).find(item => ready.includes(item));
  const locale = ready.includes(requested) ? requested : browser || "en";
  document.documentElement.lang = locale;
  document.documentElement.dir = metadata[locale].dir;
  document.body.dataset.cuacLocale = locale;

  const footerCopy = [
  [
    "footer.students",
    "Students",
    "Sinh viên",
    "นักศึกษา",
    "Pelajar",
    "Pelajar",
    "الطلاب"
  ],
  [
    "footer.ucac",
    "UCAC",
    "UCAC",
    "UCAC",
    "UCAC",
    "UCAC",
    "UCAC"
  ],
  [
    "footer.programs",
    "Search programs",
    "Tìm chương trình",
    "ค้นหาหลักสูตร",
    "Cari program",
    "Cari program",
    "البحث عن البرامج"
  ],
  [
    "footer.cities",
    "City guides",
    "Hướng dẫn thành phố",
    "คู่มือเมือง",
    "Panduan kota",
    "Panduan bandar",
    "أدلة المدن"
  ],
  [
    "footer.language",
    "HSK / IELTS",
    "HSK / IELTS",
    "HSK / IELTS",
    "HSK / IELTS",
    "HSK / IELTS",
    "HSK / IELTS"
  ],
  [
    "footer.about",
    "About UCAC and Holalobe",
    "Về UCAC và Holalobe",
    "เกี่ยวกับ UCAC และ Holalobe",
    "Tentang UCAC dan Holalobe",
    "Tentang UCAC dan Holalobe",
    "عن UCAC وHolalobe"
  ],
  [
    "footer.privacy",
    "Privacy",
    "Quyền riêng tư",
    "ความเป็นส่วนตัว",
    "Privasi",
    "Privasi",
    "الخصوصية"
  ],
  [
    "footer.children",
    "Children's privacy",
    "Quyền riêng tư của trẻ em",
    "ความเป็นส่วนตัวของเด็ก",
    "Privasi anak",
    "Privasi kanak-kanak",
    "خصوصية الأطفال"
  ],
  [
    "footer.terms",
    "Terms",
    "Điều khoản",
    "ข้อกำหนด",
    "Ketentuan",
    "Terma",
    "الشروط"
  ]
];
  ["en", "vi", "th", "id", "ms", "ar"].forEach((language, index) => {
    footerCopy.forEach(([key, ...values]) => { copy[language][`shell.${key}`] = values[index]; });
  });

  const commonCopy = [
    ["catalog.noun.records", "records", "mục", "รายการ", "data", "rekod", "السجلات"],
    ["catalog.noun.catalog", "catalog", "danh mục", "แค็ตตาล็อก", "katalog", "katalog", "الدليل"],
    ["catalog.noun.programs", "programs", "chương trình", "หลักสูตร", "program", "program", "البرامج"],
    ["catalog.noun.schools", "universities", "trường đại học", "มหาวิทยาลัย", "universitas", "universiti", "الجامعات"],
    ["catalog.noun.universities", "universities", "trường đại học", "มหาวิทยาลัย", "universitas", "universiti", "الجامعات"],
    ["catalog.noun.scholarships", "scholarships", "học bổng", "ทุนการศึกษา", "beasiswa", "biasiswa", "المنح"],
    ["catalog.noun.cities", "cities", "thành phố", "เมือง", "kota", "bandar", "المدن"],
    ["a11y.programCard", "View {name} program route", "Xem lộ trình chương trình {name}", "ดูเส้นทางหลักสูตร {name}", "Lihat jalur program {name}", "Lihat laluan program {name}", "عرض مسار برنامج {name}"],
    ["a11y.universityCard", "View {name} university guide", "Xem hướng dẫn trường {name}", "ดูคู่มือมหาวิทยาลัย {name}", "Lihat panduan universitas {name}", "Lihat panduan universiti {name}", "عرض دليل جامعة {name}"],
    ["a11y.scholarshipCard", "View {name} funding details", "Xem chi tiết tài trợ {name}", "ดูรายละเอียดทุน {name}", "Lihat detail pendanaan {name}", "Lihat butiran pembiayaan {name}", "عرض تفاصيل تمويل {name}"],
    ["a11y.cityCard", "View {name} city guide", "Xem hướng dẫn thành phố {name}", "ดูคู่มือเมือง {name}", "Lihat panduan kota {name}", "Lihat panduan bandar {name}", "عرض دليل مدينة {name}"],
    ["a11y.cover", "{name} cover", "Ảnh bìa {name}", "ภาพปก {name}", "Sampul {name}", "Kulit {name}", "صورة غلاف {name}"],
  ];
  ["en", "vi", "th", "id", "ms", "ar"].forEach((language, index) => {
    commonCopy.forEach(([key, ...values]) => { copy[language][key] = values[index]; });
  });

  function t(key, fallback = key) { return copy[locale]?.[key] ?? copy.en[key] ?? fallback; }
  function format(key, values = {}, fallback = key) {
    return t(key, fallback).replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token));
  }
  function href(rawHref) {
    if (!rawHref || rawHref.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(rawHref)) return rawHref;
    const url = new URL(rawHref, location.href);
    if (url.origin !== location.origin || !(url.pathname === "/" || /\.html$/i.test(url.pathname) || /^\/(?:guides|insights)(?:\/|$)/.test(url.pathname))) return rawHref;
    // English is an explicit selection too; never re-infer it from browser preferences.
    url.searchParams.set("lang", locale);
    return url.pathname + url.search + url.hash;
  }
  function register(messages) {
    if (!messages || typeof messages !== "object") return;
    Object.entries(messages).forEach(([messageLocale, entries]) => {
      if (!metadata[messageLocale] || !entries || typeof entries !== "object" || Array.isArray(entries)) return;
      copy[messageLocale] = { ...(copy[messageLocale] || {}), ...entries };
    });
  }
  function changeLocale(nextLocale) {
    if (!ready.includes(nextLocale)) return;
    const url = new URL(location.href);
    url.searchParams.set("lang", nextLocale);
    location.assign(url);
  }
  window.CUACI18n = { locale, direction: metadata[locale].dir, readyLocales: Object.freeze([...ready]), metadata, normalize, register, t, format, href, changeLocale };
}());
