(function localizeAbout() {
  "use strict";
  const i18n = window.CUACI18n;
  if (!i18n) return;
  const messages = {
  "vi": {
    "About UCAC and Holalobe": "Về UCAC và Holalobe",
    "One product, one clear purpose": "Một sản phẩm, một mục tiêu rõ ràng",
    "Holalobe is the parent brand behind UCAC. UCAC helps international students explore published study routes in China, compare practical options, and understand the next application step.": "Holalobe là thương hiệu mẹ của UCAC. UCAC giúp sinh viên quốc tế tìm hiểu lộ trình du học Trung Quốc đã công bố, so sánh lựa chọn thực tế và hiểu bước nộp hồ sơ tiếp theo.",
    "Explore study options": "Khám phá lựa chọn học tập",
    "Read application guides": "Đọc hướng dẫn nộp hồ sơ",
    "Read admissions insights": "Đọc phân tích tuyển sinh",
    "What UCAC provides": "UCAC cung cấp gì",
    "Published program, university, scholarship, city, and guide records with visible source and verification context where available.": "Thông tin chương trình, trường, học bổng, thành phố và hướng dẫn đã công bố, kèm nguồn và trạng thái xác minh khi có.",
    "What remains official": "Thẩm quyền quyết định chính thức",
    "Universities and responsible authorities make admissions and funding decisions. Their current notices remain the final source for requirements and deadlines.": "Trường đại học và cơ quan có thẩm quyền quyết định tuyển sinh và tài trợ. Thông báo hiện hành của họ là nguồn cuối cùng về yêu cầu và thời hạn.",
    "How Holalobe relates": "Mối liên hệ với Holalobe",
    "Holalobe provides the parent brand. UCAC keeps its own product identity, website, student journey, catalog, and application-planning boundaries.": "Holalobe cung cấp thương hiệu mẹ. UCAC có nhận diện sản phẩm, trang web, trải nghiệm sinh viên, danh mục và phạm vi lập kế hoạch hồ sơ riêng.",
    "SERVICE AND TRUST": "DỊCH VỤ VÀ NIỀM TIN",
    "Use UCAC as a planning layer": "Dùng UCAC để lập kế hoạch",
    "Check the official source before acting on a deadline or requirement.": "Kiểm tra nguồn chính thức trước khi hành động theo thời hạn hoặc yêu cầu.",
    "Treat scholarship availability and admission as separate decisions.": "Phân biệt quyết định cấp học bổng và quyết định nhận học.",
    "Use account, saved-item, and application tools only for the purpose described on each page.": "Chỉ dùng công cụ tài khoản, mục đã lưu và hồ sơ cho mục đích mô tả trên từng trang.",
    "Do not interpret catalog matching as an admission guarantee.": "Kết quả phù hợp trong danh mục không phải bảo đảm trúng tuyển.",
    "NEXT STEP": "BƯỚC TIẾP THEO",
    "Continue with the route you need": "Tiếp tục với lộ trình bạn cần",
    "Choose a public study route, review application guidance, or sign in to manage saved choices and application planning.": "Chọn lộ trình đã công bố, xem hướng dẫn hoặc đăng nhập để quản lý lựa chọn đã lưu và kế hoạch hồ sơ.",
    "Compare universities": "So sánh trường đại học",
    "Open your account": "Mở tài khoản của bạn",
    "UCAC service boundaries": "Phạm vi dịch vụ UCAC"
  },
  "th": {
    "About UCAC and Holalobe": "เกี่ยวกับ UCAC และ Holalobe",
    "One product, one clear purpose": "หนึ่งผลิตภัณฑ์ หนึ่งจุดประสงค์ที่ชัดเจน",
    "Holalobe is the parent brand behind UCAC. UCAC helps international students explore published study routes in China, compare practical options, and understand the next application step.": "Holalobe เป็นแบรนด์แม่ของ UCAC ซึ่งช่วยนักศึกษาต่างชาติสำรวจเส้นทางเรียนต่อจีนที่เผยแพร่ เปรียบเทียบตัวเลือกที่ใช้ได้จริง และเข้าใจขั้นตอนสมัครถัดไป",
    "Explore study options": "สำรวจตัวเลือกการศึกษา",
    "Read application guides": "อ่านคู่มือสมัคร",
    "Read admissions insights": "อ่านบทวิเคราะห์การรับเข้า",
    "What UCAC provides": "สิ่งที่ UCAC ให้บริการ",
    "Published program, university, scholarship, city, and guide records with visible source and verification context where available.": "ข้อมูลหลักสูตร มหาวิทยาลัย ทุน เมือง และคู่มือที่เผยแพร่ พร้อมแหล่งข้อมูลและสถานะการตรวจสอบเมื่อมี",
    "What remains official": "สิ่งที่ยังเป็นอำนาจของหน่วยงานทางการ",
    "Universities and responsible authorities make admissions and funding decisions. Their current notices remain the final source for requirements and deadlines.": "มหาวิทยาลัยและหน่วยงานที่รับผิดชอบเป็นผู้ตัดสินการรับเข้าและเงินทุน ประกาศล่าสุดของหน่วยงานเหล่านี้เป็นแหล่งอ้างอิงสุดท้ายเรื่องข้อกำหนดและกำหนดเวลา",
    "How Holalobe relates": "ความสัมพันธ์กับ Holalobe",
    "Holalobe provides the parent brand. UCAC keeps its own product identity, website, student journey, catalog, and application-planning boundaries.": "Holalobe เป็นแบรนด์แม่ ส่วน UCAC มีอัตลักษณ์ เว็บไซต์ เส้นทางนักศึกษา แค็ตตาล็อก และขอบเขตการวางแผนสมัครของตนเอง",
    "SERVICE AND TRUST": "บริการและความไว้วางใจ",
    "Use UCAC as a planning layer": "ใช้ UCAC เป็นเครื่องมือวางแผน",
    "Check the official source before acting on a deadline or requirement.": "ตรวจสอบแหล่งข้อมูลทางการก่อนดำเนินการตามกำหนดเวลาหรือข้อกำหนด",
    "Treat scholarship availability and admission as separate decisions.": "พิจารณาทุนและการรับเข้าเป็นการตัดสินใจแยกกัน",
    "Use account, saved-item, and application tools only for the purpose described on each page.": "ใช้เครื่องมือบัญชี รายการบันทึก และการสมัครตามวัตถุประสงค์ที่ระบุในแต่ละหน้าเท่านั้น",
    "Do not interpret catalog matching as an admission guarantee.": "อย่าตีความผลการจับคู่แค็ตตาล็อกว่าเป็นการรับประกันการรับเข้า",
    "NEXT STEP": "ขั้นตอนถัดไป",
    "Continue with the route you need": "ดำเนินต่อในเส้นทางที่คุณต้องการ",
    "Choose a public study route, review application guidance, or sign in to manage saved choices and application planning.": "เลือกเส้นทางการศึกษาที่เผยแพร่ อ่านคำแนะนำสมัคร หรือเข้าสู่ระบบเพื่อจัดการรายการบันทึกและแผนสมัคร",
    "Compare universities": "เปรียบเทียบมหาวิทยาลัย",
    "Open your account": "เปิดบัญชีของคุณ",
    "UCAC service boundaries": "ขอบเขตบริการ UCAC"
  },
  "id": {
    "About UCAC and Holalobe": "Tentang UCAC dan Holalobe",
    "One product, one clear purpose": "Satu produk, satu tujuan yang jelas",
    "Holalobe is the parent brand behind UCAC. UCAC helps international students explore published study routes in China, compare practical options, and understand the next application step.": "Holalobe adalah merek induk UCAC. UCAC membantu pelajar internasional menjelajahi jalur studi Tiongkok yang diterbitkan, membandingkan pilihan praktis, dan memahami langkah pendaftaran berikutnya.",
    "Explore study options": "Jelajahi pilihan studi",
    "Read application guides": "Baca panduan pendaftaran",
    "Read admissions insights": "Baca wawasan penerimaan",
    "What UCAC provides": "Layanan yang disediakan UCAC",
    "Published program, university, scholarship, city, and guide records with visible source and verification context where available.": "Informasi program, universitas, beasiswa, kota, dan panduan yang diterbitkan, beserta sumber dan konteks verifikasi jika tersedia.",
    "What remains official": "Kewenangan yang tetap resmi",
    "Universities and responsible authorities make admissions and funding decisions. Their current notices remain the final source for requirements and deadlines.": "Universitas dan otoritas terkait membuat keputusan penerimaan dan pendanaan. Pengumuman terbaru mereka tetap menjadi sumber akhir untuk persyaratan dan tenggat.",
    "How Holalobe relates": "Hubungan dengan Holalobe",
    "Holalobe provides the parent brand. UCAC keeps its own product identity, website, student journey, catalog, and application-planning boundaries.": "Holalobe menyediakan merek induk. UCAC memiliki identitas produk, situs, perjalanan pelajar, katalog, dan batas perencanaan pendaftarannya sendiri.",
    "SERVICE AND TRUST": "LAYANAN DAN KEPERCAYAAN",
    "Use UCAC as a planning layer": "Gunakan UCAC sebagai alat perencanaan",
    "Check the official source before acting on a deadline or requirement.": "Periksa sumber resmi sebelum bertindak berdasarkan tenggat atau persyaratan.",
    "Treat scholarship availability and admission as separate decisions.": "Perlakukan ketersediaan beasiswa dan penerimaan sebagai keputusan terpisah.",
    "Use account, saved-item, and application tools only for the purpose described on each page.": "Gunakan alat akun, daftar tersimpan, dan pendaftaran hanya untuk tujuan yang dijelaskan pada setiap halaman.",
    "Do not interpret catalog matching as an admission guarantee.": "Jangan menganggap kecocokan katalog sebagai jaminan penerimaan.",
    "NEXT STEP": "LANGKAH BERIKUTNYA",
    "Continue with the route you need": "Lanjutkan dengan jalur yang Anda perlukan",
    "Choose a public study route, review application guidance, or sign in to manage saved choices and application planning.": "Pilih jalur studi publik, tinjau panduan pendaftaran, atau masuk untuk mengelola pilihan tersimpan dan rencana pendaftaran.",
    "Compare universities": "Bandingkan universitas",
    "Open your account": "Buka akun Anda",
    "UCAC service boundaries": "Batas layanan UCAC"
  },
  "ms": {
    "About UCAC and Holalobe": "Tentang UCAC dan Holalobe",
    "One product, one clear purpose": "Satu produk, satu tujuan yang jelas",
    "Holalobe is the parent brand behind UCAC. UCAC helps international students explore published study routes in China, compare practical options, and understand the next application step.": "Holalobe ialah jenama induk UCAC. UCAC membantu pelajar antarabangsa meneroka laluan pengajian China yang diterbitkan, membandingkan pilihan praktikal dan memahami langkah permohonan seterusnya.",
    "Explore study options": "Teroka pilihan pengajian",
    "Read application guides": "Baca panduan permohonan",
    "Read admissions insights": "Baca wawasan kemasukan",
    "What UCAC provides": "Perkhidmatan yang disediakan UCAC",
    "Published program, university, scholarship, city, and guide records with visible source and verification context where available.": "Rekod program, universiti, biasiswa, bandar dan panduan yang diterbitkan, berserta sumber dan konteks pengesahan jika tersedia.",
    "What remains official": "Kuasa yang kekal rasmi",
    "Universities and responsible authorities make admissions and funding decisions. Their current notices remain the final source for requirements and deadlines.": "Universiti dan pihak berkuasa berkaitan membuat keputusan kemasukan dan pembiayaan. Notis terkini mereka kekal sebagai sumber akhir bagi syarat dan tarikh akhir.",
    "How Holalobe relates": "Hubungan dengan Holalobe",
    "Holalobe provides the parent brand. UCAC keeps its own product identity, website, student journey, catalog, and application-planning boundaries.": "Holalobe menyediakan jenama induk. UCAC mempunyai identiti produk, laman web, perjalanan pelajar, katalog dan skop perancangan permohonannya sendiri.",
    "SERVICE AND TRUST": "PERKHIDMATAN DAN KEPERCAYAAN",
    "Use UCAC as a planning layer": "Gunakan UCAC sebagai alat perancangan",
    "Check the official source before acting on a deadline or requirement.": "Semak sumber rasmi sebelum bertindak berdasarkan tarikh akhir atau syarat.",
    "Treat scholarship availability and admission as separate decisions.": "Anggap ketersediaan biasiswa dan kemasukan sebagai keputusan berasingan.",
    "Use account, saved-item, and application tools only for the purpose described on each page.": "Gunakan alat akaun, item tersimpan dan permohonan hanya untuk tujuan yang diterangkan pada setiap halaman.",
    "Do not interpret catalog matching as an admission guarantee.": "Jangan anggap padanan katalog sebagai jaminan kemasukan.",
    "NEXT STEP": "LANGKAH SETERUSNYA",
    "Continue with the route you need": "Teruskan dengan laluan yang anda perlukan",
    "Choose a public study route, review application guidance, or sign in to manage saved choices and application planning.": "Pilih laluan pengajian awam, baca panduan permohonan atau log masuk untuk mengurus pilihan tersimpan dan rancangan permohonan.",
    "Compare universities": "Bandingkan universiti",
    "Open your account": "Buka akaun anda",
    "UCAC service boundaries": "Skop perkhidmatan UCAC"
  },
  "ar": {
    "About UCAC and Holalobe": "عن UCAC وHolalobe",
    "One product, one clear purpose": "منتج واحد، هدف واضح",
    "Holalobe is the parent brand behind UCAC. UCAC helps international students explore published study routes in China, compare practical options, and understand the next application step.": "Holalobe هي العلامة الأم لـ UCAC. يساعد UCAC الطلاب الدوليين على استكشاف مسارات الدراسة المنشورة في الصين ومقارنة الخيارات العملية وفهم خطوة التقديم التالية.",
    "Explore study options": "استكشف خيارات الدراسة",
    "Read application guides": "اقرأ أدلة التقديم",
    "Read admissions insights": "اقرأ رؤى القبول",
    "What UCAC provides": "ما يقدمه UCAC",
    "Published program, university, scholarship, city, and guide records with visible source and verification context where available.": "سجلات منشورة للبرامج والجامعات والمنح والمدن والأدلة، مع توضيح المصادر وسياق التحقق عند توفرهما.",
    "What remains official": "ما يبقى من اختصاص الجهات الرسمية",
    "Universities and responsible authorities make admissions and funding decisions. Their current notices remain the final source for requirements and deadlines.": "تتخذ الجامعات والجهات المختصة قرارات القبول والتمويل. وتظل إعلاناتها الحالية المصدر النهائي للمتطلبات والمواعيد النهائية.",
    "How Holalobe relates": "العلاقة مع Holalobe",
    "Holalobe provides the parent brand. UCAC keeps its own product identity, website, student journey, catalog, and application-planning boundaries.": "توفر Holalobe العلامة الأم. ويحتفظ UCAC بهوية منتجه وموقعه ورحلة الطالب ودليله وحدود خدمة تخطيط التقديم الخاصة به.",
    "SERVICE AND TRUST": "الخدمة والثقة",
    "Use UCAC as a planning layer": "استخدم UCAC أداةً للتخطيط",
    "Check the official source before acting on a deadline or requirement.": "تحقق من المصدر الرسمي قبل اتخاذ إجراء بناءً على موعد نهائي أو متطلب.",
    "Treat scholarship availability and admission as separate decisions.": "تعامل مع توفر المنحة والقبول بوصفهما قرارين منفصلين.",
    "Use account, saved-item, and application tools only for the purpose described on each page.": "استخدم أدوات الحساب والعناصر المحفوظة والتقديم للأغراض الموضحة في كل صفحة فقط.",
    "Do not interpret catalog matching as an admission guarantee.": "لا تعتبر مطابقة الدليل ضمانًا للقبول.",
    "NEXT STEP": "الخطوة التالية",
    "Continue with the route you need": "تابع المسار الذي تحتاجه",
    "Choose a public study route, review application guidance, or sign in to manage saved choices and application planning.": "اختر مسار دراسة منشورًا، أو راجع إرشادات التقديم، أو سجّل الدخول لإدارة الخيارات المحفوظة وخطة التقديم.",
    "Compare universities": "قارن الجامعات",
    "Open your account": "افتح حسابك",
    "UCAC service boundaries": "حدود خدمة UCAC"
  }
};
  const copy = messages[i18n.locale] || {};
  document.title = copy[document.title] || document.title;
  const main = document.querySelector(".about-main");
  if (!main) return;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const english = node.nodeValue.trim();
    if (copy[english]) node.nodeValue = node.nodeValue.replace(english, copy[english]);
  }
  main.querySelectorAll("[aria-label]").forEach(element => {
    const label = element.getAttribute("aria-label");
    if (copy[label]) element.setAttribute("aria-label", copy[label]);
  });
  main.querySelectorAll("a[href]").forEach(anchor => {
    const url = new URL(anchor.getAttribute("href"), location.href);
    if (url.origin !== location.origin) return;
    url.searchParams.set("lang", i18n.locale);
    anchor.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  });
}());
