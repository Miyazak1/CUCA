(function initCitiesI18n() {
  "use strict";

  const rows = [
    ["CUAC | Cities", "CUAC | Thành phố", "CUAC | เมือง", "CUAC | Kota", "CUAC | Bandar", "CUAC | المدن"],
    ["Cities", "Thành phố", "เมือง", "Kota", "Bandar", "المدن"],
    ["Find a China city that fits your study plan", "Tìm thành phố Trung Quốc phù hợp với kế hoạch học tập", "ค้นหาเมืองจีนที่เหมาะกับแผนการเรียน", "Temukan kota di Tiongkok yang sesuai dengan rencana studi", "Cari bandar di China yang sesuai dengan rancangan pengajian", "اعثر على مدينة صينية تناسب خطتك الدراسية"],
    ["Compare published living costs and catalog reference counts before choosing where to apply.", "So sánh chi phí sinh hoạt và số liệu danh mục đã công bố trước khi chọn nơi nộp hồ sơ.", "เปรียบเทียบค่าครองชีพและจำนวนข้อมูลอ้างอิงที่เผยแพร่ก่อนเลือกสมัคร", "Bandingkan biaya hidup dan jumlah referensi katalog yang diterbitkan sebelum memilih tempat mendaftar.", "Bandingkan kos sara hidup dan bilangan rujukan katalog sebelum memilih tempat memohon.", "قارن تكاليف المعيشة المنشورة وأعداد السجلات قبل اختيار مكان التقديم."],
    ["published city guides", "hướng dẫn thành phố đã công bố", "คู่มือเมืองที่เผยแพร่", "panduan kota diterbitkan", "panduan bandar diterbitkan", "أدلة مدن منشورة"],
    ["published monthly range", "khoảng chi phí tháng đã công bố", "ช่วงค่าใช้จ่ายรายเดือน", "rentang bulanan diterbitkan", "julat bulanan diterbitkan", "النطاق الشهري المنشور"],
    ["referenced programs", "chương trình được tham chiếu", "หลักสูตรอ้างอิง", "program referensi", "program dirujuk", "البرامج المشار إليها"],
    ["Compare city fit in one scan", "So sánh độ phù hợp của thành phố trong một lần xem", "เปรียบเทียบความเหมาะสมของเมืองได้ในครั้งเดียว", "Bandingkan kecocokan kota dalam sekali lihat", "Bandingkan kesesuaian bandar sepintas lalu", "قارن ملاءمة المدن بنظرة واحدة"],
    ["Compare only source-backed cost and catalog reference fields.", "Chỉ so sánh chi phí và dữ liệu danh mục có nguồn.", "เปรียบเทียบเฉพาะค่าใช้จ่ายและข้อมูลที่มีแหล่งอ้างอิง", "Bandingkan hanya biaya dan data katalog yang didukung sumber.", "Bandingkan hanya kos dan data katalog yang disokong sumber.", "قارن فقط حقول التكلفة والدليل المدعومة بالمصادر."],
    ["Browse all cities", "Xem tất cả thành phố", "ดูเมืองทั้งหมด", "Jelajahi semua kota", "Lihat semua bandar", "تصفح جميع المدن"],
    ["Browse published city tags", "Duyệt nhãn thành phố đã công bố", "ดูแท็กเมืองที่เผยแพร่", "Jelajahi tag kota yang diterbitkan", "Lihat tag bandar diterbitkan", "تصفح وسوم المدن المنشورة"],
    ["Tags appear only when they are present in the city record.", "Nhãn chỉ hiển thị khi có trong hồ sơ thành phố.", "แท็กจะแสดงเมื่อมีอยู่ในระเบียนเมืองเท่านั้น", "Tag hanya muncul jika ada dalam catatan kota.", "Tag hanya dipaparkan jika terdapat dalam rekod bandar.", "تظهر الوسوم فقط عندما تكون موجودة في سجل المدينة."],
    ["cities", "thành phố", "เมือง", "kota", "bandar", "مدن"],
    ["Reading the current published catalog.", "Đang đọc danh mục đã công bố.", "กำลังอ่านแค็ตตาล็อกที่เผยแพร่", "Membaca katalog yang diterbitkan.", "Membaca katalog yang diterbitkan.", "جارٍ قراءة الدليل المنشور."],
    ["All cities", "Tất cả thành phố", "ทุกเมือง", "Semua kota", "Semua bandar", "جميع المدن"],
    ["Sort: Fit", "Sắp xếp: Phù hợp", "เรียง: ความเหมาะสม", "Urutkan: Kecocokan", "Isih: Kesesuaian", "الترتيب: الملاءمة"],
    ["Lowest cost first", "Chi phí thấp nhất trước", "ค่าใช้จ่ายต่ำสุดก่อน", "Biaya terendah dahulu", "Kos terendah dahulu", "الأقل تكلفة أولاً"],
    ["English routes first", "Lộ trình tiếng Anh trước", "เส้นทางภาษาอังกฤษก่อน", "Jalur bahasa Inggris dahulu", "Laluan bahasa Inggeris dahulu", "المسارات الإنجليزية أولاً"],
    ["Scholarships first", "Học bổng trước", "ทุนการศึกษาก่อน", "Beasiswa dahulu", "Biasiswa dahulu", "المنح أولاً"],
    ["Budget check", "Kiểm tra ngân sách", "ตรวจงบประมาณ", "Periksa anggaran", "Semak bajet", "فحص الميزانية"],
    ["Estimate a monthly student budget", "Ước tính ngân sách sinh viên hàng tháng", "ประมาณงบรายเดือนของนักศึกษา", "Perkirakan anggaran bulanan mahasiswa", "Anggarkan bajet bulanan pelajar", "قدّر ميزانية الطالب الشهرية"],
    ["Published cost details will appear when available.", "Chi phí đã công bố sẽ hiển thị khi có.", "รายละเอียดค่าใช้จ่ายจะแสดงเมื่อมีข้อมูล", "Rincian biaya terbit akan muncul jika tersedia.", "Butiran kos diterbitkan akan muncul apabila tersedia.", "ستظهر تفاصيل التكلفة المنشورة عند توفرها."],
    ["Lean", "Tiết kiệm", "ประหยัด", "Hemat", "Jimat", "اقتصادي"],
    ["Balanced", "Cân bằng", "สมดุล", "Seimbang", "Seimbang", "متوازن"],
    ["Comfortable", "Thoải mái", "สะดวกสบาย", "Nyaman", "Selesa", "مريح"],
    ["City", "Thành phố", "เมือง", "Kota", "Bandar", "المدينة"],
    ["Not published", "Chưa công bố", "ยังไม่เผยแพร่", "Belum diterbitkan", "Belum diterbitkan", "غير منشور"],
    ["monthly estimate", "ước tính hàng tháng", "ประมาณการรายเดือน", "perkiraan bulanan", "anggaran bulanan", "تقدير شهري"],
    ["Turn city fit into an application route", "Biến lựa chọn thành phố thành lộ trình nộp hồ sơ", "เปลี่ยนความเหมาะสมของเมืองเป็นเส้นทางสมัคร", "Ubah kecocokan kota menjadi jalur pendaftaran", "Tukar kesesuaian bandar kepada laluan permohonan", "حوّل ملاءمة المدينة إلى مسار تقديم"],
    ["City questions students ask early", "Câu hỏi về thành phố sinh viên thường hỏi sớm", "คำถามเรื่องเมืองที่นักศึกษามักถาม", "Pertanyaan kota yang sering ditanyakan sejak awal", "Soalan bandar yang sering ditanya awal", "أسئلة المدن التي يطرحها الطلاب مبكرًا"],
    ["Keep city decisions practical and connected to applications.", "Giữ quyết định về thành phố thực tế và gắn với hồ sơ.", "ตัดสินใจเรื่องเมืองอย่างเป็นจริงและเชื่อมกับการสมัคร", "Pastikan keputusan kota praktis dan terhubung dengan pendaftaran.", "Pastikan keputusan bandar praktikal dan berkaitan dengan permohonan.", "اجعل قرار المدينة عمليًا ومرتبطًا بالتقديم."],
    ["City", "Thành phố", "เมือง", "Kota", "Bandar", "المدينة"],
    ["Monthly cost", "Chi phí tháng", "ค่าใช้จ่ายรายเดือน", "Biaya bulanan", "Kos bulanan", "التكلفة الشهرية"],
    ["Schools", "Trường", "มหาวิทยาลัย", "Universitas", "Universiti", "الجامعات"],
    ["English routes", "Lộ trình tiếng Anh", "เส้นทางภาษาอังกฤษ", "Jalur bahasa Inggris", "Laluan bahasa Inggeris", "المسارات الإنجليزية"],
    ["Scholarships", "Học bổng", "ทุนการศึกษา", "Beasiswa", "Biasiswa", "المنح"],
    ["Programs", "Chương trình", "หลักสูตร", "Program", "Program", "البرامج"],
    ["Next", "Tiếp theo", "ถัดไป", "Berikutnya", "Seterusnya", "التالي"],
    ["Programs", "Chương trình", "หลักสูตร", "Program", "Program", "البرامج"],
    ["Published city tag", "Nhãn thành phố đã công bố", "แท็กเมืองที่เผยแพร่", "Tag kota diterbitkan", "Tag bandar diterbitkan", "وسم مدينة منشور"],
    ["No city filters selected", "Chưa chọn bộ lọc thành phố", "ยังไม่ได้เลือกตัวกรองเมือง", "Tidak ada filter kota", "Tiada penapis bandar", "لم يتم تحديد مرشحات للمدينة"],
    ["monthly living estimate", "ước tính sinh hoạt hàng tháng", "ประมาณค่าครองชีพรายเดือน", "perkiraan biaya hidup bulanan", "anggaran kos sara hidup bulanan", "تقدير المعيشة الشهري"],
    ["English-taught routes", "lộ trình dạy bằng tiếng Anh", "เส้นทางที่สอนเป็นภาษาอังกฤษ", "jalur berbahasa Inggris", "laluan bahasa Inggeris", "مسارات باللغة الإنجليزية"],
    ["scholarship routes", "lộ trình học bổng", "เส้นทางทุน", "jalur beasiswa", "laluan biasiswa", "مسارات المنح"],
    ["referenced schools", "trường được tham chiếu", "มหาวิทยาลัยอ้างอิง", "universitas referensi", "universiti dirujuk", "الجامعات المشار إليها"],
    ["View city", "Xem thành phố", "ดูเมือง", "Lihat kota", "Lihat bandar", "عرض المدينة"],
    ["Universities", "Trường đại học", "มหาวิทยาลัย", "Universitas", "Universiti", "الجامعات"],
    ["No published city guides are available.", "Chưa có hướng dẫn thành phố nào được công bố.", "ยังไม่มีคู่มือเมืองที่เผยแพร่", "Belum ada panduan kota yang diterbitkan.", "Belum ada panduan bandar diterbitkan.", "لا تتوفر أدلة مدن منشورة."],
    ["Published city guides with source-backed costs and catalog reference snapshots.", "Hướng dẫn thành phố với chi phí có nguồn và ảnh chụp danh mục đã công bố.", "คู่มือเมืองพร้อมค่าใช้จ่ายที่มีแหล่งอ้างอิงและภาพรวมแค็ตตาล็อก", "Panduan kota dengan biaya bersumber dan ringkasan katalog.", "Panduan bandar dengan kos bersumber dan ringkasan katalog.", "أدلة مدن بتكاليف موثقة ولقطات من الدليل."],
    ["Filtered by", "Đã lọc theo", "กรองตาม", "Difilter berdasarkan", "Ditapis mengikut", "تمت التصفية حسب"],
    ["No city summary published.", "Chưa công bố tóm tắt thành phố.", "ยังไม่เผยแพร่สรุปเมือง", "Ringkasan kota belum diterbitkan.", "Ringkasan bandar belum diterbitkan.", "لم يُنشر ملخص للمدينة."],
    ["A good city choice should immediately connect to programs, universities, scholarships, and arrival planning.", "Một lựa chọn thành phố tốt phải kết nối ngay với chương trình, trường, học bổng và kế hoạch đến nơi.", "การเลือกเมืองที่ดีควรเชื่อมต่อกับหลักสูตร มหาวิทยาลัย ทุน และแผนการเดินทางทันที", "Pilihan kota yang baik harus langsung terhubung ke program, universitas, beasiswa, dan rencana kedatangan.", "Pilihan bandar yang baik harus terus dihubungkan dengan program, universiti, biasiswa dan rancangan ketibaan.", "ينبغي أن يرتبط اختيار المدينة مباشرة بالبرامج والجامعات والمنح وخطة الوصول."],
    ["Programs by city", "Chương trình theo thành phố", "หลักสูตรตามเมือง", "Program menurut kota", "Program mengikut bandar", "البرامج حسب المدينة"],
    ["Universities by city", "Trường theo thành phố", "มหาวิทยาลัยตามเมือง", "Universitas menurut kota", "Universiti mengikut bandar", "الجامعات حسب المدينة"],
    ["Scholarships by city", "Học bổng theo thành phố", "ทุนตามเมือง", "Beasiswa menurut kota", "Biasiswa mengikut bandar", "المنح حسب المدينة"],
    ["Review cost, routes, and arrival context.", "Xem chi phí, lộ trình và thông tin đến nơi.", "ตรวจค่าใช้จ่าย เส้นทาง และข้อมูลการเดินทาง", "Tinjau biaya, jalur, dan konteks kedatangan.", "Semak kos, laluan dan konteks ketibaan.", "راجع التكلفة والمسارات وسياق الوصول."],
    ["Compare real degree routes.", "So sánh các lộ trình bằng cấp thực tế.", "เปรียบเทียบเส้นทางปริญญาจริง", "Bandingkan jalur gelar yang nyata.", "Bandingkan laluan ijazah sebenar.", "قارن مسارات الدرجات الفعلية."],
    ["Start from admissions routes that are clear enough to compare.", "Bắt đầu từ lộ trình tuyển sinh đủ rõ để so sánh.", "เริ่มจากเส้นทางรับสมัครที่ชัดเจนพอจะเปรียบเทียบ", "Mulai dari jalur penerimaan yang cukup jelas untuk dibandingkan.", "Mulakan dengan laluan kemasukan yang cukup jelas untuk dibandingkan.", "ابدأ بمسارات قبول واضحة بما يكفي للمقارنة."],
    ["Check funding and living cost together.", "Kiểm tra tài trợ cùng chi phí sinh hoạt.", "ตรวจทุนและค่าครองชีพร่วมกัน", "Periksa pendanaan dan biaya hidup bersama.", "Semak pembiayaan dan kos sara hidup bersama.", "تحقق من التمويل وتكلفة المعيشة معًا."],
    ["Should I choose the city before the university?", "Tôi có nên chọn thành phố trước trường không?", "ควรเลือกเมืองก่อนมหาวิทยาลัยหรือไม่?", "Haruskah saya memilih kota sebelum universitas?", "Perlukah saya memilih bandar sebelum universiti?", "هل أختار المدينة قبل الجامعة؟"],
    ["Use the city to narrow cost, lifestyle, and opportunity fit, then confirm the actual program and university requirements.", "Dùng thành phố để thu hẹp chi phí, lối sống và cơ hội, sau đó xác nhận yêu cầu thực tế của chương trình và trường.", "ใช้เมืองเพื่อจำกัดตัวเลือกด้านค่าใช้จ่าย ไลฟ์สไตล์ และโอกาส แล้วตรวจข้อกำหนดจริงของหลักสูตรและมหาวิทยาลัย", "Gunakan kota untuk menyaring biaya, gaya hidup, dan peluang, lalu konfirmasikan persyaratan program dan universitas.", "Gunakan bandar untuk menapis kos, gaya hidup dan peluang, kemudian sahkan syarat program dan universiti.", "استخدم المدينة لتضييق خيارات التكلفة ونمط الحياة والفرص، ثم أكد متطلبات البرنامج والجامعة."],
    ["Is Shanghai too expensive?", "Thượng Hải có quá đắt không?", "เซี่ยงไฮ้แพงเกินไปหรือไม่?", "Apakah Shanghai terlalu mahal?", "Adakah Shanghai terlalu mahal?", "هل شنغهاي باهظة جدًا؟"],
    ["It can be worth it for internships and international life, but students should compare living cost and scholarship coverage first.", "Thành phố có thể đáng chọn vì thực tập và môi trường quốc tế, nhưng hãy so sánh chi phí sinh hoạt và mức học bổng trước.", "อาจคุ้มค่าสำหรับการฝึกงานและชีวิตนานาชาติ แต่ควรเปรียบเทียบค่าครองชีพและความครอบคลุมของทุนก่อน", "Kota ini dapat sepadan untuk magang dan kehidupan internasional, tetapi bandingkan biaya hidup dan cakupan beasiswa dahulu.", "Bandar ini mungkin berbaloi untuk latihan industri dan kehidupan antarabangsa, tetapi bandingkan kos sara hidup dan liputan biasiswa dahulu.", "قد تكون مناسبة للتدريب والحياة الدولية، لكن قارن تكلفة المعيشة وتغطية المنح أولاً."],
    ["Can I study in a smaller city without Chinese?", "Tôi có thể học ở thành phố nhỏ mà không biết tiếng Trung không?", "เรียนในเมืองเล็กโดยไม่รู้ภาษาจีนได้หรือไม่?", "Bisakah saya belajar di kota kecil tanpa bahasa Mandarin?", "Bolehkah saya belajar di bandar kecil tanpa bahasa Cina?", "هل يمكنني الدراسة في مدينة أصغر دون الصينية؟"],
    ["Some cities have English-taught routes, but daily life and support vary. Check university services and language requirements before applying.", "Một số thành phố có lộ trình tiếng Anh, nhưng đời sống và hỗ trợ khác nhau. Hãy kiểm tra dịch vụ trường và yêu cầu ngôn ngữ trước khi nộp.", "บางเมืองมีหลักสูตรภาษาอังกฤษ แต่ชีวิตประจำวันและการสนับสนุนต่างกัน ควรตรวจบริการมหาวิทยาลัยและข้อกำหนดภาษาก่อนสมัคร", "Beberapa kota memiliki jalur berbahasa Inggris, tetapi kehidupan sehari-hari dan dukungan berbeda. Periksa layanan universitas dan persyaratan bahasa sebelum mendaftar.", "Sesetengah bandar mempunyai laluan bahasa Inggeris, tetapi kehidupan harian dan sokongan berbeza. Semak perkhidmatan universiti dan syarat bahasa sebelum memohon.", "توجد مسارات إنجليزية في بعض المدن، لكن الحياة اليومية والدعم يختلفان. تحقق من خدمات الجامعة ومتطلبات اللغة قبل التقديم."],
    ["Pending", "Đang chờ", "รอดำเนินการ", "Tertunda", "Belum selesai", "قيد الانتظار"],
    ["Region not published", "Chưa công bố khu vực", "ยังไม่เผยแพร่ภูมิภาค", "Wilayah belum diterbitkan", "Wilayah belum diterbitkan", "المنطقة غير منشورة"],
    ["Cost not published", "Chưa công bố chi phí", "ยังไม่เผยแพร่ค่าใช้จ่าย", "Biaya belum diterbitkan", "Kos belum diterbitkan", "التكلفة غير منشورة"],
    ["Published guide", "Hướng dẫn đã công bố", "คู่มือที่เผยแพร่", "Panduan diterbitkan", "Panduan diterbitkan", "دليل منشور"],
    ["catalog snapshot", "ảnh chụp danh mục", "ภาพรวมแค็ตตาล็อก", "ringkasan katalog", "ringkasan katalog", "لقطة من الدليل"],
    ["program routes", "lộ trình chương trình", "เส้นทางหลักสูตร", "jalur program", "laluan program", "مسارات البرامج"],
    ["funding routes", "lộ trình tài trợ", "เส้นทางทุน", "jalur pendanaan", "laluan pembiayaan", "مسارات التمويل"],
    ["programs", "chương trình", "หลักสูตร", "program", "program", "برامج"],
    ["monthly", "hàng tháng", "รายเดือน", "bulanan", "bulanan", "شهريًا"],
    ["English", "Tiếng Anh", "ภาษาอังกฤษ", "Bahasa Inggris", "Bahasa Inggeris", "الإنجليزية"],
  ];

  const i18n = window.CUACI18n;
  const localeIndex = { vi: 1, th: 2, id: 3, ms: 4, ar: 5 }[i18n?.locale] || 0;
  const dictionary = new Map(rows.map((row) => [row[0], row[localeIndex] || row[0]]));
  const ui = (english) => dictionary.get(String(english)) || String(english);
  const format = (template, values = {}) => Object.entries(values).reduce((value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)), String(template));

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
      if (!trimmed || !dictionary.has(trimmed)) return;
      node.nodeValue = node.nodeValue.replace(trimmed, ui(trimmed));
    });
    const anchors = root.querySelectorAll?.("a[href]") || [];
    anchors.forEach((anchor) => {
      const localized = href(anchor.getAttribute("href"));
      if (localized) anchor.setAttribute("href", localized);
    });
    const labelled = root.querySelectorAll?.("[aria-label], [title], [placeholder]") || [];
    labelled.forEach((element) => ["aria-label", "title", "placeholder"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value && dictionary.has(value)) element.setAttribute(attribute, ui(value));
    }));
  }

  window.CUACCitiesI18n = Object.freeze({ locale: i18n?.locale || "en", ui, format, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }))).observe(document.body, { childList: true, subtree: true });
}());
