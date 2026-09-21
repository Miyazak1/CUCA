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
      "shell.nav.scholarships": "Scholarships", "shell.nav.cities": "Cities", "shell.nav.guides": "Guides", "shell.nav.hub": "Hub",
      "shell.search": "Search CUAC", "shell.signIn": "Sign in", "shell.language": "Language",
      "shell.note": "China admissions 2026:", "shell.noteDetail": "fall routes still open",
      "shell.tagline": "China admissions search for international students applying to Chinese universities.",
      "shell.contact": "Contact us", "shell.help": "Need help?", "shell.cookies": "Cookie notice",
      "shell.dataPolicy": "Data and source policy", "shell.clarity": "Admissions clarity policy", "shell.englishOnly": "English version",
      "home.kicker": "Study in China, clearly planned", "home.title": "Find your route to a Chinese university",
      "home.sub": "Search published programs, universities, scholarships, cities, and guides from one place.",
      "home.placeholder": "Try English-taught computer science in Hangzhou", "home.search": "Search",
      "home.chip.undergraduate": "Undergraduate", "home.chip.master": "Master", "home.chip.english": "English-taught",
      "home.chip.scholarship": "Scholarship", "home.chip.fall": "Fall 2026",
      "home.catalogTitle": "Start with what you need", "home.cat.programs": "Programs", "home.cat.programsBody": "Compare degree, language, tuition, and intake.",
      "home.cat.universities": "Universities", "home.cat.universitiesBody": "Review location, routes, and official sources.",
      "home.cat.scholarships": "Scholarships", "home.cat.scholarshipsBody": "Explore funding without assuming an award.",
      "home.cat.cities": "Cities and cost", "home.cat.citiesBody": "Compare living cost and study environment.",
      "home.planTitle": "A clear application route has four parts", "home.planBody": "Use CUAC to narrow the catalog, then confirm every deadline and requirement with the university.",
      "home.step.1": "Discover", "home.step.1Body": "Choose a subject, city, or university.", "home.step.2": "Compare", "home.step.2Body": "Check tuition, language, and intake dates.",
      "home.step.3": "Prepare", "home.step.3Body": "Understand requirements and document work.", "home.step.4": "Decide", "home.step.4Body": "Build a shortlist worth applying to.",
      "home.boundaryTitle": "Important application boundary", "home.boundaryBody": "CUAC helps you discover and organize choices. Students submit application materials through each university's official channel in this release.",
      "home.accountTitle": "Keep your China options together", "home.accountBody": "Save programs, compare routes, and track intake dates in one student workspace.", "home.create": "Create list",
      "home.destinationNotice": "Catalog navigation, city pages, and core detail labels are translated. Official names, source content, and guides remain in English while reviewed translations are completed.",
      "home.feedback.search": "Press Enter or Search to view matching published catalog results.", "home.feedback.empty": "Enter a program, university, scholarship, or city.",
    },
    vi: {
      "shell.nav.home": "Trang chủ", "shell.nav.programs": "Chương trình", "shell.nav.universities": "Trường đại học", "shell.nav.scholarships": "Học bổng", "shell.nav.cities": "Thành phố", "shell.nav.guides": "Hướng dẫn", "shell.nav.hub": "Hồ sơ",
      "shell.search": "Tìm kiếm trên CUAC", "shell.signIn": "Đăng nhập", "shell.language": "Ngôn ngữ", "shell.note": "Tuyển sinh Trung Quốc 2026:", "shell.noteDetail": "một số kỳ mùa thu vẫn đang mở",
      "shell.tagline": "Nền tảng tìm kiếm tuyển sinh dành cho sinh viên quốc tế muốn học tại các trường đại học Trung Quốc.", "shell.contact": "Liên hệ", "shell.help": "Cần hỗ trợ?", "shell.cookies": "Thông báo cookie", "shell.dataPolicy": "Chính sách dữ liệu và nguồn", "shell.clarity": "Chính sách minh bạch tuyển sinh", "shell.englishOnly": "Bản tiếng Anh",
      "home.kicker": "Lập kế hoạch du học Trung Quốc rõ ràng", "home.title": "Tìm lộ trình vào đại học Trung Quốc", "home.sub": "Tìm chương trình, trường đại học, học bổng, thành phố và hướng dẫn đã công bố tại một nơi.",
      "home.placeholder": "Ví dụ: thạc sĩ khoa học máy tính bằng tiếng Anh tại Hàng Châu", "home.search": "Tìm kiếm", "home.chip.undergraduate": "Đại học", "home.chip.master": "Thạc sĩ", "home.chip.english": "Dạy bằng tiếng Anh", "home.chip.scholarship": "Học bổng", "home.chip.fall": "Mùa thu 2026",
      "home.catalogTitle": "Bắt đầu từ nhu cầu của bạn", "home.cat.programs": "Chương trình", "home.cat.programsBody": "So sánh bậc học, ngôn ngữ, học phí và kỳ nhập học.", "home.cat.universities": "Trường đại học", "home.cat.universitiesBody": "Xem địa điểm, lộ trình và nguồn chính thức.", "home.cat.scholarships": "Học bổng", "home.cat.scholarshipsBody": "Tìm cơ hội tài trợ mà không coi đó là bảo đảm.", "home.cat.cities": "Thành phố và chi phí", "home.cat.citiesBody": "So sánh sinh hoạt phí và môi trường học tập.",
      "home.planTitle": "Một lộ trình rõ ràng gồm bốn bước", "home.planBody": "Dùng CUAC để thu hẹp lựa chọn, sau đó xác nhận hạn và yêu cầu với trường.", "home.step.1": "Khám phá", "home.step.1Body": "Chọn ngành, thành phố hoặc trường.", "home.step.2": "So sánh", "home.step.2Body": "Kiểm tra học phí, ngôn ngữ và kỳ nhập học.", "home.step.3": "Chuẩn bị", "home.step.3Body": "Hiểu yêu cầu và hồ sơ cần chuẩn bị.", "home.step.4": "Quyết định", "home.step.4Body": "Lập danh sách phù hợp để nộp.",
      "home.boundaryTitle": "Phạm vi hỗ trợ quan trọng", "home.boundaryBody": "CUAC hỗ trợ tìm kiếm và sắp xếp lựa chọn. Trong phiên bản này, sinh viên nộp hồ sơ qua kênh chính thức của từng trường.", "home.accountTitle": "Quản lý các lựa chọn du học Trung Quốc", "home.accountBody": "Lưu chương trình, so sánh lộ trình và theo dõi kỳ nhập học trong một không gian sinh viên.", "home.create": "Tạo danh sách", "home.destinationNotice": "Điều hướng danh mục, trang thành phố và nhãn chi tiết cốt lõi đã được dịch. Tên chính thức, nội dung nguồn và hướng dẫn vẫn bằng tiếng Anh trong khi bản dịch được rà soát.", "home.feedback.search": "Nhấn Enter hoặc Tìm kiếm để xem kết quả đã công bố.", "home.feedback.empty": "Nhập chương trình, trường đại học, học bổng hoặc thành phố.",
    },
    th: {
      "shell.nav.home": "หน้าหลัก", "shell.nav.programs": "หลักสูตร", "shell.nav.universities": "มหาวิทยาลัย", "shell.nav.scholarships": "ทุนการศึกษา", "shell.nav.cities": "เมือง", "shell.nav.guides": "คู่มือ", "shell.nav.hub": "พื้นที่ของฉัน",
      "shell.search": "ค้นหาใน CUAC", "shell.signIn": "เข้าสู่ระบบ", "shell.language": "ภาษา", "shell.note": "การรับสมัครจีน ปี 2026:", "shell.noteDetail": "บางรอบฤดูใบไม้ร่วงยังเปิดอยู่", "shell.tagline": "แพลตฟอร์มค้นหาการรับสมัครสำหรับนักศึกษาต่างชาติที่สมัครมหาวิทยาลัยในจีน", "shell.contact": "ติดต่อเรา", "shell.help": "ต้องการความช่วยเหลือ?", "shell.cookies": "ประกาศคุกกี้", "shell.dataPolicy": "นโยบายข้อมูลและแหล่งที่มา", "shell.clarity": "นโยบายความชัดเจนด้านการรับสมัคร", "shell.englishOnly": "ฉบับภาษาอังกฤษ",
      "home.kicker": "วางแผนเรียนต่อจีนอย่างชัดเจน", "home.title": "ค้นหาเส้นทางสู่มหาวิทยาลัยจีน", "home.sub": "ค้นหาหลักสูตร มหาวิทยาลัย ทุน เมือง และคู่มือที่เผยแพร่แล้วในที่เดียว", "home.placeholder": "เช่น วิทยาการคอมพิวเตอร์ภาษาอังกฤษที่หางโจว", "home.search": "ค้นหา", "home.chip.undergraduate": "ปริญญาตรี", "home.chip.master": "ปริญญาโท", "home.chip.english": "สอนเป็นภาษาอังกฤษ", "home.chip.scholarship": "ทุนการศึกษา", "home.chip.fall": "ฤดูใบไม้ร่วง 2026",
      "home.catalogTitle": "เริ่มจากสิ่งที่คุณต้องการ", "home.cat.programs": "หลักสูตร", "home.cat.programsBody": "เปรียบเทียบระดับ ภาษา ค่าเล่าเรียน และรอบเข้าเรียน", "home.cat.universities": "มหาวิทยาลัย", "home.cat.universitiesBody": "ดูสถานที่ เส้นทาง และแหล่งข้อมูลทางการ", "home.cat.scholarships": "ทุนการศึกษา", "home.cat.scholarshipsBody": "สำรวจแหล่งทุนโดยไม่ถือว่าได้รับการรับรอง", "home.cat.cities": "เมืองและค่าใช้จ่าย", "home.cat.citiesBody": "เปรียบเทียบค่าครองชีพและสภาพแวดล้อมการเรียน",
      "home.planTitle": "เส้นทางสมัครที่ชัดเจนมีสี่ขั้น", "home.planBody": "ใช้ CUAC เพื่อคัดตัวเลือก แล้วตรวจสอบกำหนดเวลาและข้อกำหนดกับมหาวิทยาลัย", "home.step.1": "ค้นหา", "home.step.1Body": "เลือกสาขา เมือง หรือมหาวิทยาลัย", "home.step.2": "เปรียบเทียบ", "home.step.2Body": "ตรวจค่าเล่าเรียน ภาษา และรอบเข้าเรียน", "home.step.3": "เตรียมตัว", "home.step.3Body": "ทำความเข้าใจข้อกำหนดและเอกสาร", "home.step.4": "ตัดสินใจ", "home.step.4Body": "สร้างรายชื่อที่เหมาะแก่การสมัคร",
      "home.boundaryTitle": "ขอบเขตการสมัครที่สำคัญ", "home.boundaryBody": "CUAC ช่วยค้นหาและจัดตัวเลือก ในรุ่นนี้นักศึกษาส่งเอกสารผ่านช่องทางทางการของแต่ละมหาวิทยาลัย", "home.accountTitle": "รวมตัวเลือกเรียนต่อจีนไว้ด้วยกัน", "home.accountBody": "บันทึกหลักสูตร เปรียบเทียบเส้นทาง และติดตามรอบเข้าเรียนในพื้นที่นักศึกษาเดียว", "home.create": "สร้างรายการ", "home.destinationNotice": "การนำทางแค็ตตาล็อก หน้าเมือง และป้ายรายละเอียดหลักได้รับการแปลแล้ว ชื่อทางการ เนื้อหาต้นฉบับ และคู่มือยังเป็นภาษาอังกฤษระหว่างการตรวจทานคำแปล", "home.feedback.search": "กด Enter หรือค้นหาเพื่อดูผลลัพธ์ที่เผยแพร่แล้ว", "home.feedback.empty": "กรอกหลักสูตร มหาวิทยาลัย ทุน หรือเมือง",
    },
    id: {
      "shell.nav.home": "Beranda", "shell.nav.programs": "Program", "shell.nav.universities": "Universitas", "shell.nav.scholarships": "Beasiswa", "shell.nav.cities": "Kota", "shell.nav.guides": "Panduan", "shell.nav.hub": "Ruang saya",
      "shell.search": "Cari di CUAC", "shell.signIn": "Masuk", "shell.language": "Bahasa", "shell.note": "Penerimaan Tiongkok 2026:", "shell.noteDetail": "sejumlah jalur musim gugur masih dibuka", "shell.tagline": "Pencarian penerimaan bagi pelajar internasional yang mendaftar ke universitas di Tiongkok.", "shell.contact": "Hubungi kami", "shell.help": "Perlu bantuan?", "shell.cookies": "Pemberitahuan cookie", "shell.dataPolicy": "Kebijakan data dan sumber", "shell.clarity": "Kebijakan kejelasan penerimaan", "shell.englishOnly": "Versi bahasa Inggris",
      "home.kicker": "Rencanakan studi di Tiongkok dengan jelas", "home.title": "Temukan jalur ke universitas di Tiongkok", "home.sub": "Cari program, universitas, beasiswa, kota, dan panduan yang telah dipublikasikan dalam satu tempat.", "home.placeholder": "Contoh: ilmu komputer berbahasa Inggris di Hangzhou", "home.search": "Cari", "home.chip.undergraduate": "Sarjana", "home.chip.master": "Magister", "home.chip.english": "Berbahasa Inggris", "home.chip.scholarship": "Beasiswa", "home.chip.fall": "Musim gugur 2026",
      "home.catalogTitle": "Mulai dari kebutuhan Anda", "home.cat.programs": "Program", "home.cat.programsBody": "Bandingkan jenjang, bahasa, biaya kuliah, dan penerimaan.", "home.cat.universities": "Universitas", "home.cat.universitiesBody": "Tinjau lokasi, jalur, dan sumber resmi.", "home.cat.scholarships": "Beasiswa", "home.cat.scholarshipsBody": "Jelajahi pendanaan tanpa menganggapnya pasti.", "home.cat.cities": "Kota dan biaya", "home.cat.citiesBody": "Bandingkan biaya hidup dan lingkungan belajar.",
      "home.planTitle": "Jalur pendaftaran yang jelas memiliki empat tahap", "home.planBody": "Gunakan CUAC untuk mempersempit katalog, lalu konfirmasikan tenggat dan persyaratan kepada universitas.", "home.step.1": "Temukan", "home.step.1Body": "Pilih bidang, kota, atau universitas.", "home.step.2": "Bandingkan", "home.step.2Body": "Periksa biaya, bahasa, dan jadwal masuk.", "home.step.3": "Siapkan", "home.step.3Body": "Pahami persyaratan dan dokumen.", "home.step.4": "Putuskan", "home.step.4Body": "Susun daftar yang layak didaftarkan.",
      "home.boundaryTitle": "Batas penting layanan pendaftaran", "home.boundaryBody": "CUAC membantu menemukan dan mengatur pilihan. Pada rilis ini, pelajar mengirim dokumen melalui kanal resmi setiap universitas.", "home.accountTitle": "Satukan pilihan studi di Tiongkok", "home.accountBody": "Simpan program, bandingkan jalur, dan pantau jadwal masuk dalam satu ruang pelajar.", "home.create": "Buat daftar", "home.destinationNotice": "Navigasi katalog, halaman kota, dan label detail inti telah diterjemahkan. Nama resmi, konten sumber, dan panduan tetap berbahasa Inggris selama terjemahan ditinjau.", "home.feedback.search": "Tekan Enter atau Cari untuk melihat hasil katalog yang dipublikasikan.", "home.feedback.empty": "Masukkan program, universitas, beasiswa, atau kota.",
    },
    ms: {
      "shell.nav.home": "Utama", "shell.nav.programs": "Program", "shell.nav.universities": "Universiti", "shell.nav.scholarships": "Biasiswa", "shell.nav.cities": "Bandar", "shell.nav.guides": "Panduan", "shell.nav.hub": "Ruang saya",
      "shell.search": "Cari di CUAC", "shell.signIn": "Log masuk", "shell.language": "Bahasa", "shell.note": "Kemasukan China 2026:", "shell.noteDetail": "sebahagian laluan musim luruh masih dibuka", "shell.tagline": "Carian kemasukan untuk pelajar antarabangsa yang memohon ke universiti di China.", "shell.contact": "Hubungi kami", "shell.help": "Perlukan bantuan?", "shell.cookies": "Notis kuki", "shell.dataPolicy": "Dasar data dan sumber", "shell.clarity": "Dasar kejelasan kemasukan", "shell.englishOnly": "Versi bahasa Inggeris",
      "home.kicker": "Rancang pengajian di China dengan jelas", "home.title": "Cari laluan ke universiti di China", "home.sub": "Cari program, universiti, biasiswa, bandar dan panduan yang diterbitkan dalam satu tempat.", "home.placeholder": "Contoh: sains komputer bahasa Inggeris di Hangzhou", "home.search": "Cari", "home.chip.undergraduate": "Sarjana muda", "home.chip.master": "Sarjana", "home.chip.english": "Diajarkan dalam bahasa Inggeris", "home.chip.scholarship": "Biasiswa", "home.chip.fall": "Musim luruh 2026",
      "home.catalogTitle": "Mulakan dengan keperluan anda", "home.cat.programs": "Program", "home.cat.programsBody": "Bandingkan tahap, bahasa, yuran dan pengambilan.", "home.cat.universities": "Universiti", "home.cat.universitiesBody": "Semak lokasi, laluan dan sumber rasmi.", "home.cat.scholarships": "Biasiswa", "home.cat.scholarshipsBody": "Teroka pembiayaan tanpa menganggapnya terjamin.", "home.cat.cities": "Bandar dan kos", "home.cat.citiesBody": "Bandingkan kos sara hidup dan persekitaran belajar.",
      "home.planTitle": "Laluan permohonan yang jelas mempunyai empat langkah", "home.planBody": "Gunakan CUAC untuk mengecilkan pilihan, kemudian sahkan tarikh akhir dan syarat dengan universiti.", "home.step.1": "Teroka", "home.step.1Body": "Pilih bidang, bandar atau universiti.", "home.step.2": "Bandingkan", "home.step.2Body": "Semak yuran, bahasa dan tarikh pengambilan.", "home.step.3": "Sediakan", "home.step.3Body": "Fahami syarat dan dokumen.", "home.step.4": "Putuskan", "home.step.4Body": "Bina senarai yang sesuai untuk dipohon.",
      "home.boundaryTitle": "Batas penting permohonan", "home.boundaryBody": "CUAC membantu mencari dan menyusun pilihan. Dalam keluaran ini, pelajar menghantar dokumen melalui saluran rasmi setiap universiti.", "home.accountTitle": "Satukan pilihan pengajian di China", "home.accountBody": "Simpan program, bandingkan laluan dan jejak pengambilan dalam satu ruang pelajar.", "home.create": "Cipta senarai", "home.destinationNotice": "Navigasi katalog, halaman bandar dan label butiran teras telah diterjemahkan. Nama rasmi, kandungan sumber dan panduan kekal dalam bahasa Inggeris sementara terjemahan disemak.", "home.feedback.search": "Tekan Enter atau Cari untuk melihat hasil katalog yang diterbitkan.", "home.feedback.empty": "Masukkan program, universiti, biasiswa atau bandar.",
    },
    ar: {
      "shell.nav.home": "الرئيسية", "shell.nav.programs": "البرامج", "shell.nav.universities": "الجامعات", "shell.nav.scholarships": "المنح", "shell.nav.cities": "المدن", "shell.nav.guides": "الأدلة", "shell.nav.hub": "مساحتي",
      "shell.search": "البحث في CUAC", "shell.signIn": "تسجيل الدخول", "shell.language": "اللغة", "shell.note": "القبول في الصين 2026:", "shell.noteDetail": "بعض مسارات الخريف ما زالت مفتوحة", "shell.tagline": "منصة بحث للطلاب الدوليين المتقدمين إلى الجامعات الصينية.", "shell.contact": "اتصل بنا", "shell.help": "هل تحتاج إلى مساعدة؟", "shell.cookies": "إشعار ملفات الارتباط", "shell.dataPolicy": "سياسة البيانات والمصادر", "shell.clarity": "سياسة وضوح القبول", "shell.englishOnly": "النسخة الإنجليزية",
      "home.kicker": "خطط للدراسة في الصين بوضوح", "home.title": "اعثر على مسارك إلى جامعة صينية", "home.sub": "ابحث عن البرامج والجامعات والمنح والمدن والأدلة المنشورة في مكان واحد.", "home.placeholder": "مثال: علوم الحاسوب باللغة الإنجليزية في هانغتشو", "home.search": "بحث", "home.chip.undergraduate": "بكالوريوس", "home.chip.master": "ماجستير", "home.chip.english": "باللغة الإنجليزية", "home.chip.scholarship": "منحة", "home.chip.fall": "خريف 2026",
      "home.catalogTitle": "ابدأ بما تحتاج إليه", "home.cat.programs": "البرامج", "home.cat.programsBody": "قارن الدرجة واللغة والرسوم وموعد الالتحاق.", "home.cat.universities": "الجامعات", "home.cat.universitiesBody": "راجع الموقع والمسارات والمصادر الرسمية.", "home.cat.scholarships": "المنح", "home.cat.scholarshipsBody": "استكشف التمويل من دون اعتباره مضمونًا.", "home.cat.cities": "المدن والتكلفة", "home.cat.citiesBody": "قارن تكلفة المعيشة وبيئة الدراسة.",
      "home.planTitle": "يتكوّن مسار التقديم الواضح من أربع خطوات", "home.planBody": "استخدم CUAC لتضييق الخيارات، ثم أكد كل موعد ومتطلب مع الجامعة.", "home.step.1": "اكتشف", "home.step.1Body": "اختر تخصصًا أو مدينة أو جامعة.", "home.step.2": "قارن", "home.step.2Body": "تحقق من الرسوم واللغة ومواعيد الالتحاق.", "home.step.3": "استعد", "home.step.3Body": "افهم المتطلبات والعمل المطلوب للوثائق.", "home.step.4": "قرر", "home.step.4Body": "أنشئ قائمة مناسبة للتقديم.",
      "home.boundaryTitle": "حدود مهمة لخدمة التقديم", "home.boundaryBody": "يساعدك CUAC على اكتشاف الخيارات وتنظيمها. في هذا الإصدار يرسل الطلاب مستندات التقديم عبر القناة الرسمية لكل جامعة.", "home.accountTitle": "اجمع خيارات الدراسة في الصين", "home.accountBody": "احفظ البرامج وقارن المسارات وتابع مواعيد الالتحاق في مساحة طالب واحدة.", "home.create": "إنشاء قائمة", "home.destinationNotice": "تُرجمت عناصر التنقل في الدليل وصفحات المدن وتسميات التفاصيل الأساسية. تبقى الأسماء الرسمية ومحتوى المصدر والأدلة باللغة الإنجليزية إلى حين مراجعة الترجمات.", "home.feedback.search": "اضغط Enter أو بحث لعرض نتائج الكتالوج المنشورة.", "home.feedback.empty": "أدخل برنامجًا أو جامعة أو منحة أو مدينة.",
    },
  };

  function normalize(value) {
    if (typeof value !== "string") return null;
    const tag = value.trim().replaceAll("_", "-").toLowerCase();
    return aliases[tag] || aliases[tag.split("-")[0]] || null;
  }
  const ready = (document.body.dataset.i18nLocales || "en").split(",").map(normalize).filter((item, index, all) => item && all.indexOf(item) === index);
  if (!ready.includes("en")) ready.unshift("en");
  const requested = normalize(new URLSearchParams(location.search).get("lang"));
  const browser = (navigator.languages || [navigator.language]).map(normalize).find(item => ready.includes(item));
  const locale = ready.includes(requested) ? requested : browser || "en";
  document.documentElement.lang = locale;
  document.documentElement.dir = metadata[locale].dir;
  document.body.dataset.cuacLocale = locale;

  function t(key, fallback = key) { return copy[locale]?.[key] ?? copy.en[key] ?? fallback; }
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
    if (nextLocale === "en") url.searchParams.delete("lang"); else url.searchParams.set("lang", nextLocale);
    location.assign(url);
  }
  window.CUACI18n = { locale, direction: metadata[locale].dir, readyLocales: Object.freeze([...ready]), metadata, normalize, register, t, changeLocale };
}());
