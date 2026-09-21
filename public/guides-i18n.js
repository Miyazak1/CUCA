(function initGuidesI18n() {
  "use strict";

  const rows = [
    ["CUAC | Application guides", "CUAC | Hướng dẫn nộp hồ sơ", "CUAC | คู่มือการสมัคร", "CUAC | Panduan pendaftaran", "CUAC | Panduan permohonan", "CUAC | أدلة التقديم"],
    ["Application guides", "Hướng dẫn nộp hồ sơ", "คู่มือการสมัคร", "Panduan pendaftaran", "Panduan permohonan", "أدلة التقديم"],
    ["Application guides:", "Hướng dẫn nộp hồ sơ:", "คู่มือการสมัคร:", "Panduan pendaftaran:", "Panduan permohonan:", "أدلة التقديم:"],
    ["reviewed routes and official sources", "lộ trình đã rà soát và nguồn chính thức", "เส้นทางที่ตรวจทานแล้วและแหล่งข้อมูลทางการ", "jalur yang ditinjau dan sumber resmi", "laluan yang disemak dan sumber rasmi", "مسارات مراجعة ومصادر رسمية"],
    ["Application guide introduction", "Giới thiệu hướng dẫn nộp hồ sơ", "บทนำคู่มือการสมัคร", "Pengantar panduan pendaftaran", "Pengenalan panduan permohonan", "مقدمة أدلة التقديم"],
    ["Plan your application with published guidance", "Lập kế hoạch hồ sơ bằng hướng dẫn đã công bố", "วางแผนการสมัครด้วยคำแนะนำที่เผยแพร่แล้ว", "Rencanakan pendaftaran dengan panduan yang diterbitkan", "Rancang permohonan dengan panduan yang diterbitkan", "خطط لتقديمك باستخدام إرشادات منشورة"],
    ["Use reviewed guides to understand documents, language routes, scholarships, visas, and arrival steps. Always confirm changing requirements with the university.", "Dùng hướng dẫn đã rà soát để hiểu về hồ sơ, ngôn ngữ, học bổng, thị thực và các bước nhập cảnh. Luôn xác nhận yêu cầu có thể thay đổi với trường.", "ใช้คู่มือที่ตรวจทานแล้วเพื่อทำความเข้าใจเอกสาร ภาษา ทุน วีซ่า และขั้นตอนการเดินทาง และยืนยันข้อกำหนดที่อาจเปลี่ยนแปลงกับมหาวิทยาลัยเสมอ", "Gunakan panduan yang ditinjau untuk memahami dokumen, jalur bahasa, beasiswa, visa, dan langkah kedatangan. Selalu konfirmasikan persyaratan yang berubah kepada universitas.", "Gunakan panduan yang disemak untuk memahami dokumen, laluan bahasa, biasiswa, visa dan langkah ketibaan. Sentiasa sahkan syarat yang berubah dengan universiti.", "استخدم الأدلة المراجعة لفهم المستندات ومسارات اللغة والمنح والتأشيرات وخطوات الوصول. أكّد دائمًا المتطلبات المتغيرة مع الجامعة."],
    ["Search published guides", "Tìm hướng dẫn đã công bố", "ค้นหาคู่มือที่เผยแพร่", "Cari panduan yang diterbitkan", "Cari panduan yang diterbitkan", "ابحث في الأدلة المنشورة"],
    ["Documents, language, scholarship, visa", "Hồ sơ, ngôn ngữ, học bổng, thị thực", "เอกสาร ภาษา ทุน วีซ่า", "Dokumen, bahasa, beasiswa, visa", "Dokumen, bahasa, biasiswa, visa", "مستندات، لغة، منحة، تأشيرة"],
    ["Search", "Tìm kiếm", "ค้นหา", "Cari", "Cari", "بحث"],
    ["Guide publication policy", "Chính sách xuất bản hướng dẫn", "นโยบายเผยแพร่คู่มือ", "Kebijakan penerbitan panduan", "Dasar penerbitan panduan", "سياسة نشر الأدلة"],
    ["Reviewed before publication", "Được rà soát trước khi công bố", "ตรวจทานก่อนเผยแพร่", "Ditinjau sebelum diterbitkan", "Disemak sebelum diterbitkan", "تُراجع قبل النشر"],
    ["Guide versions, source links, and translations are published together after review.", "Phiên bản hướng dẫn, liên kết nguồn và bản dịch được công bố cùng nhau sau khi rà soát.", "เวอร์ชันคู่มือ ลิงก์แหล่งข้อมูล และคำแปลจะเผยแพร่พร้อมกันหลังการตรวจทาน", "Versi panduan, tautan sumber, dan terjemahan diterbitkan bersama setelah ditinjau.", "Versi panduan, pautan sumber dan terjemahan diterbitkan bersama selepas semakan.", "تُنشر نسخة الدليل وروابط المصادر والترجمات معًا بعد المراجعة."],
    ["Official names and untranslated guide content remain in English.", "Tên chính thức và nội dung hướng dẫn chưa dịch vẫn được giữ bằng tiếng Anh.", "ชื่อทางการและเนื้อหาคู่มือที่ยังไม่แปลจะแสดงเป็นภาษาอังกฤษ", "Nama resmi dan konten panduan yang belum diterjemahkan tetap dalam bahasa Inggris.", "Nama rasmi dan kandungan panduan yang belum diterjemah kekal dalam bahasa Inggeris.", "تبقى الأسماء الرسمية ومحتوى الدليل غير المترجم باللغة الإنجليزية."],
    ["Published application guides", "Hướng dẫn nộp hồ sơ đã công bố", "คู่มือการสมัครที่เผยแพร่", "Panduan pendaftaran yang diterbitkan", "Panduan permohonan yang diterbitkan", "أدلة التقديم المنشورة"],
    ["Published library", "Thư viện đã công bố", "คลังที่เผยแพร่", "Pustaka yang diterbitkan", "Pustaka diterbitkan", "المكتبة المنشورة"],
    ["application guides", "hướng dẫn nộp hồ sơ", "คู่มือการสมัคร", "panduan pendaftaran", "panduan permohonan", "أدلة تقديم"],
    ["Reading the current published guide catalog.", "Đang đọc danh mục hướng dẫn đã công bố.", "กำลังอ่านรายการคู่มือที่เผยแพร่", "Membaca katalog panduan yang diterbitkan.", "Membaca katalog panduan yang diterbitkan.", "جارٍ قراءة دليل الإرشادات المنشور."],
    ["Search the full site", "Tìm kiếm toàn trang", "ค้นหาทั้งเว็บไซต์", "Cari seluruh situs", "Cari seluruh laman", "البحث في الموقع بالكامل"],
    ["Loading published guides", "Đang tải hướng dẫn đã công bố", "กำลังโหลดคู่มือที่เผยแพร่", "Memuat panduan yang diterbitkan", "Memuatkan panduan yang diterbitkan", "جارٍ تحميل الأدلة المنشورة"],
    ["Reading reviewed guide records.", "Đang đọc hồ sơ hướng dẫn đã rà soát.", "กำลังอ่านระเบียนคู่มือที่ตรวจทานแล้ว", "Membaca catatan panduan yang ditinjau.", "Membaca rekod panduan yang disemak.", "جارٍ قراءة سجلات الأدلة المراجعة."],
    ["How to use CUAC guides", "Cách sử dụng hướng dẫn CUAC", "วิธีใช้คู่มือ CUAC", "Cara menggunakan panduan CUAC", "Cara menggunakan panduan CUAC", "كيفية استخدام أدلة CUAC"],
    ["Use guides safely", "Sử dụng hướng dẫn an toàn", "ใช้คู่มืออย่างปลอดภัย", "Gunakan panduan dengan aman", "Gunakan panduan dengan selamat", "استخدم الأدلة بأمان"],
    ["Check the source before you act", "Kiểm tra nguồn trước khi hành động", "ตรวจสอบแหล่งข้อมูลก่อนดำเนินการ", "Periksa sumber sebelum bertindak", "Semak sumber sebelum bertindak", "تحقق من المصدر قبل اتخاذ إجراء"],
    ["CUAC explains the route. The university or responsible authority remains the source for exact requirements and dates.", "CUAC giải thích lộ trình. Trường hoặc cơ quan có thẩm quyền vẫn là nguồn xác nhận yêu cầu và ngày chính xác.", "CUAC อธิบายเส้นทาง แต่มหาวิทยาลัยหรือหน่วยงานที่รับผิดชอบยังคงเป็นแหล่งข้อมูลสำหรับข้อกำหนดและวันที่ที่แน่นอน", "CUAC menjelaskan jalurnya. Universitas atau otoritas terkait tetap menjadi sumber persyaratan dan tanggal yang tepat.", "CUAC menerangkan laluannya. Universiti atau pihak berkuasa berkaitan kekal sebagai sumber syarat dan tarikh tepat.", "يشرح CUAC المسار، وتبقى الجامعة أو الجهة المسؤولة مصدر المتطلبات والمواعيد الدقيقة."],
    ["Confirm deadlines", "Xác nhận hạn nộp", "ยืนยันกำหนดเวลา", "Konfirmasikan tenggat", "Sahkan tarikh akhir", "أكّد المواعيد النهائية"],
    ["Application and scholarship dates can change by school and intake.", "Ngày nộp hồ sơ và học bổng có thể thay đổi theo trường và kỳ nhập học.", "วันสมัครและวันทุนอาจแตกต่างตามมหาวิทยาลัยและรอบเข้าเรียน", "Tanggal pendaftaran dan beasiswa dapat berubah menurut universitas dan penerimaan.", "Tarikh permohonan dan biasiswa boleh berubah mengikut universiti dan pengambilan.", "قد تتغير مواعيد التقديم والمنح حسب الجامعة وموعد الالتحاق."],
    ["Use official sources", "Dùng nguồn chính thức", "ใช้แหล่งข้อมูลทางการ", "Gunakan sumber resmi", "Gunakan sumber rasmi", "استخدم المصادر الرسمية"],
    ["Open the source links on each guide before making a final decision.", "Mở liên kết nguồn trong từng hướng dẫn trước khi đưa ra quyết định cuối cùng.", "เปิดลิงก์แหล่งข้อมูลในแต่ละคู่มือก่อนตัดสินใจขั้นสุดท้าย", "Buka tautan sumber pada setiap panduan sebelum membuat keputusan akhir.", "Buka pautan sumber pada setiap panduan sebelum membuat keputusan akhir.", "افتح روابط المصادر في كل دليل قبل اتخاذ القرار النهائي."],
    ["Submit to the school", "Nộp trực tiếp cho trường", "ส่งให้มหาวิทยาลัย", "Kirim ke universitas", "Hantar kepada universiti", "قدّم إلى الجامعة"],
    ["In this release, students submit application materials through each university's official channel.", "Trong phiên bản này, sinh viên nộp tài liệu qua kênh chính thức của từng trường.", "ในรุ่นนี้ นักศึกษาส่งเอกสารสมัครผ่านช่องทางทางการของแต่ละมหาวิทยาลัย", "Dalam rilis ini, pelajar mengirim materi pendaftaran melalui kanal resmi setiap universitas.", "Dalam keluaran ini, pelajar menghantar bahan permohonan melalui saluran rasmi setiap universiti.", "في هذا الإصدار يرسل الطلاب مواد التقديم عبر القناة الرسمية لكل جامعة."],
    ["Continue planning", "Tiếp tục lập kế hoạch", "วางแผนต่อ", "Lanjutkan perencanaan", "Teruskan perancangan", "تابع التخطيط"],
    ["Connect guidance to a real study route", "Kết nối hướng dẫn với lộ trình học thực tế", "เชื่อมคำแนะนำกับเส้นทางเรียนจริง", "Hubungkan panduan dengan jalur studi nyata", "Hubungkan panduan dengan laluan pengajian sebenar", "اربط الإرشادات بمسار دراسة فعلي"],
    ["Move from general guidance to published programs, universities, and funding routes.", "Chuyển từ hướng dẫn chung sang chương trình, trường và lộ trình tài trợ đã công bố.", "เปลี่ยนจากคำแนะนำทั่วไปไปสู่หลักสูตร มหาวิทยาลัย และเส้นทางทุนที่เผยแพร่", "Lanjutkan dari panduan umum ke program, universitas, dan jalur pendanaan yang diterbitkan.", "Beralih daripada panduan umum kepada program, universiti dan laluan pembiayaan yang diterbitkan.", "انتقل من الإرشاد العام إلى البرامج والجامعات ومسارات التمويل المنشورة."],
    ["Browse programs", "Xem chương trình", "ดูหลักสูตร", "Jelajahi program", "Lihat program", "تصفح البرامج"],
    ["Compare universities", "So sánh trường", "เปรียบเทียบมหาวิทยาลัย", "Bandingkan universitas", "Bandingkan universiti", "قارن الجامعات"],
    ["Explore scholarships", "Khám phá học bổng", "สำรวจทุนการศึกษา", "Jelajahi beasiswa", "Teroka biasiswa", "استكشف المنح"],
    ["Reviewed guide", "Hướng dẫn đã rà soát", "คู่มือที่ตรวจทานแล้ว", "Panduan yang ditinjau", "Panduan yang disemak", "دليل مُراجع"],
    ["Updated {date}", "Cập nhật {date}", "อัปเดต {date}", "Diperbarui {date}", "Dikemas kini {date}", "حُدّث في {date}"],
    ["Date not published", "Chưa công bố ngày", "ยังไม่เผยแพร่วันที่", "Tanggal belum diterbitkan", "Tarikh belum diterbitkan", "التاريخ غير منشور"],
    ["No published summary is available.", "Chưa có tóm tắt đã công bố.", "ยังไม่มีสรุปที่เผยแพร่", "Ringkasan belum diterbitkan.", "Ringkasan belum diterbitkan.", "لا يتوفر ملخص منشور."],
    ["English content shown — reviewed translation not yet published.", "Đang hiển thị tiếng Anh — bản dịch đã rà soát chưa được công bố.", "กำลังแสดงภาษาอังกฤษ — ยังไม่มีคำแปลที่ผ่านการตรวจทาน", "Konten bahasa Inggris ditampilkan — terjemahan yang ditinjau belum diterbitkan.", "Kandungan bahasa Inggeris dipaparkan — terjemahan yang disemak belum diterbitkan.", "يُعرض المحتوى الإنجليزي — لم تُنشر ترجمة مراجعة بعد."],
    ["Open guide", "Mở hướng dẫn", "เปิดคู่มือ", "Buka panduan", "Buka panduan", "افتح الدليل"],
    ["Version {version}", "Phiên bản {version}", "เวอร์ชัน {version}", "Versi {version}", "Versi {version}", "الإصدار {version}"],
    ["Results for “{query}”", "Kết quả cho “{query}”", "ผลลัพธ์สำหรับ “{query}”", "Hasil untuk “{query}”", "Hasil untuk “{query}”", "نتائج «{query}»"],
    ["{count} found", "Tìm thấy {count}", "พบ {count}", "{count} ditemukan", "{count} ditemui", "تم العثور على {count}"],
    ["Clear search", "Xóa tìm kiếm", "ล้างการค้นหา", "Hapus pencarian", "Kosongkan carian", "مسح البحث"],
    ["Showing matching published guide records.", "Đang hiển thị hướng dẫn đã công bố phù hợp.", "กำลังแสดงคู่มือที่เผยแพร่และตรงกัน", "Menampilkan panduan terbit yang cocok.", "Memaparkan panduan diterbitkan yang sepadan.", "تُعرض سجلات الأدلة المنشورة المطابقة."],
    ["Showing the current published guide catalog.", "Đang hiển thị danh mục hướng dẫn đã công bố hiện tại.", "กำลังแสดงรายการคู่มือที่เผยแพร่ในปัจจุบัน", "Menampilkan katalog panduan terbit saat ini.", "Memaparkan katalog panduan diterbitkan semasa.", "يُعرض دليل الإرشادات المنشور الحالي."],
    ["Published guides could not be loaded.", "Không thể tải hướng dẫn đã công bố.", "ไม่สามารถโหลดคู่มือที่เผยแพร่ได้", "Panduan terbit tidak dapat dimuat.", "Panduan diterbitkan tidak dapat dimuatkan.", "تعذر تحميل الأدلة المنشورة."],
    ["Guides are temporarily unavailable", "Hướng dẫn tạm thời không khả dụng", "คู่มือไม่พร้อมใช้งานชั่วคราว", "Panduan sementara tidak tersedia", "Panduan tidak tersedia buat sementara", "الأدلة غير متاحة مؤقتًا"],
    ["Try again. If the problem continues, use site search.", "Hãy thử lại. Nếu vẫn lỗi, dùng tìm kiếm toàn trang.", "ลองอีกครั้ง หากปัญหายังคงอยู่ ให้ใช้การค้นหาทั้งเว็บไซต์", "Coba lagi. Jika masalah berlanjut, gunakan pencarian situs.", "Cuba lagi. Jika masalah berterusan, gunakan carian laman.", "حاول مرة أخرى. إذا استمرت المشكلة فاستخدم بحث الموقع."],
    ["Try again", "Thử lại", "ลองอีกครั้ง", "Coba lagi", "Cuba lagi", "حاول مرة أخرى"],
    ["No matching guides", "Không có hướng dẫn phù hợp", "ไม่พบคู่มือที่ตรงกัน", "Tidak ada panduan yang cocok", "Tiada panduan yang sepadan", "لا توجد أدلة مطابقة"],
    ["Try a broader search or browse the full catalog.", "Thử tìm rộng hơn hoặc xem toàn bộ danh mục.", "ลองค้นหาให้กว้างขึ้นหรือดูรายการทั้งหมด", "Coba pencarian yang lebih luas atau jelajahi seluruh katalog.", "Cuba carian yang lebih luas atau lihat seluruh katalog.", "جرّب بحثًا أوسع أو تصفح الدليل الكامل."],
    ["View all guides", "Xem tất cả hướng dẫn", "ดูคู่มือทั้งหมด", "Lihat semua panduan", "Lihat semua panduan", "عرض جميع الأدلة"],
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
      if (!trimmed || !dictionary.has(trimmed)) return;
      node.nodeValue = node.nodeValue.replace(trimmed, ui(trimmed));
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

  window.CUACGuidesI18n = Object.freeze({ locale: i18n?.locale || "en", ui, format, href, apply });
  apply();
  if (i18n?.locale !== "en") new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
  }))).observe(document.body, { childList: true, subtree: true });
}());
