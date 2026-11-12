(function initLocalizedHome() {
  "use strict";
  const i18n = window.CUACI18n;
  if (!i18n) return;
  const locales = ["vi", "th", "id", "ms", "ar"];
  // Translate the shared DOM in place; all languages retain the same page and data.
  const core = {
    "Study in China, clearly planned": "home.kicker",
    "Find your route to a Chinese university": "home.title",
    "Search published programs, universities, scholarships, cities, and guides from one place.": "home.sub",
    "Search programs, universities, scholarships, or cities": "home.placeholder",
    "Search UCAC": "shell.search", "Search": "home.search",
    "Undergraduate": "home.chip.undergraduate", "Master": "home.chip.master",
    "English-taught": "home.chip.english", "Scholarship": "home.chip.scholarship",
    "Current intakes": "home.chip.fall", "Programs": "home.cat.programs",
    "Universities": "home.cat.universities", "Scholarships": "home.cat.scholarships",
    "Discover": "home.step.1", "Compare": "home.step.2", "Prepare": "home.step.3",
    "Decide": "home.step.4", "Build a shortlist worth applying to.": "home.step.4Body",
    "Keep your China options together": "home.accountTitle", "Create list": "home.create",
    "Documents": "shell.nav.documents", "Visa and JW form": "shell.nav.visa",
    "About UCAC and Holalobe": "shell.footer.about",
  };
  // English, Vietnamese, Thai, Indonesian, Malay, Arabic.
  const rows = [
    ["China study planning gateway", "Cổng lập kế hoạch du học Trung Quốc", "ช่องทางวางแผนเรียนต่อจีน", "Portal perencanaan studi Tiongkok", "Gerbang perancangan pengajian China", "بوابة تخطيط الدراسة في الصين"],
    ["Prompt starters", "Gợi ý tìm kiếm", "คำค้นเริ่มต้น", "Saran pencarian", "Cadangan carian", "اقتراحات البحث"],
    ["Browse categories", "Duyệt danh mục", "เรียกดูหมวดหมู่", "Jelajahi kategori", "Layari kategori", "تصفح الفئات"],
    ["China study starting points", "Điểm bắt đầu du học Trung Quốc", "จุดเริ่มต้นเรียนต่อจีน", "Titik awal studi Tiongkok", "Titik permulaan pengajian China", "نقاط بداية الدراسة في الصين"],
    ["Students preparing applications", "Sinh viên chuẩn bị hồ sơ", "นักศึกษากำลังเตรียมใบสมัคร", "Pelajar menyiapkan pendaftaran", "Pelajar menyediakan permohonan", "طلاب يعدّون طلبات التقديم"],
    ["Student planning subjects", "Sinh viên lập kế hoạch chọn ngành", "นักศึกษาวางแผนเลือกสาขา", "Pelajar merencanakan bidang studi", "Pelajar merancang bidang pengajian", "طالب يخطط للتخصصات"],
    ["Hangzhou lake and city", "Hồ và thành phố Hàng Châu", "ทะเลสาบและเมืองหางโจว", "Danau dan kota Hangzhou", "Tasik dan bandar Hangzhou", "بحيرة ومدينة هانغتشو"],
    ["University students", "Sinh viên đại học", "นักศึกษามหาวิทยาลัย", "Mahasiswa", "Pelajar universiti", "طلاب جامعيون"],
    ["Documents and study desk", "Hồ sơ và bàn học", "เอกสารและโต๊ะเรียน", "Dokumen dan meja belajar", "Dokumen dan meja belajar", "وثائق ومكتب دراسة"],
    ["Student routes", "Lộ trình sinh viên", "เส้นทางนักศึกษา", "Jalur pelajar", "Laluan pelajar", "مسارات الطلاب"],
    ["China study confidence", "Tự tin du học Trung Quốc", "ความมั่นใจในการเรียนต่อจีน", "Keyakinan studi Tiongkok", "Keyakinan pengajian China", "الثقة في الدراسة بالصين"],
    ["Student smiling on campus", "Sinh viên mỉm cười trong khuôn viên", "นักศึกษายิ้มในวิทยาเขต", "Pelajar tersenyum di kampus", "Pelajar tersenyum di kampus", "طالب يبتسم في الحرم الجامعي"],
    ["Useful previews", "Thông tin xem trước hữu ích", "ข้อมูลตัวอย่างที่เป็นประโยชน์", "Pratinjau bermanfaat", "Pratonton berguna", "لمحات مفيدة"],
    ["Universities and colleges", "Trường đại học và cao đẳng", "มหาวิทยาลัยและวิทยาลัย", "Universitas dan perguruan tinggi", "Universiti dan kolej", "الجامعات والكليات"],
    ["Students reviewing university options", "Sinh viên xem xét lựa chọn trường", "นักศึกษาทบทวนตัวเลือกมหาวิทยาลัย", "Pelajar meninjau pilihan universitas", "Pelajar menyemak pilihan universiti", "طلاب يراجعون خيارات الجامعات"],
    ["China application guides", "Hướng dẫn nộp hồ sơ du học Trung Quốc", "คู่มือสมัครเรียนจีน", "Panduan pendaftaran studi Tiongkok", "Panduan permohonan pengajian China", "أدلة التقديم للدراسة في الصين"],
    ["Create Hub account", "Tạo tài khoản sinh viên", "สร้างบัญชีนักศึกษา", "Buat akun pelajar", "Cipta akaun pelajar", "إنشاء حساب طالب"],
    ["China application insights", "Phân tích về nộp hồ sơ du học Trung Quốc", "บทวิเคราะห์การสมัครเรียนจีน", "Wawasan pendaftaran studi Tiongkok", "Wawasan permohonan pengajian China", "رؤى التقديم للدراسة في الصين"],
    ["Students outside campus", "Sinh viên ngoài khuôn viên", "นักศึกษานอกวิทยาเขต", "Pelajar di luar kampus", "Pelajar di luar kampus", "طلاب خارج الحرم الجامعي"],
    ["Student budget planning", "Sinh viên lập ngân sách", "นักศึกษาวางแผนงบประมาณ", "Pelajar merencanakan anggaran", "Pelajar merancang bajet", "طالب يخطط للميزانية"],
    ["Students in classroom", "Sinh viên trong lớp học", "นักศึกษาในห้องเรียน", "Pelajar di kelas", "Pelajar di kelas", "طلاب في قاعة الدراسة"],
    ["Application steps", "Các bước nộp hồ sơ", "ขั้นตอนสมัคร", "Langkah pendaftaran", "Langkah permohonan", "خطوات التقديم"],
    ["Admissions clarity", "Thông tin tuyển sinh rõ ràng", "ความชัดเจนในการรับเข้า", "Kejelasan penerimaan", "Kejelasan kemasukan", "وضوح القبول"],
    ["Published routes", "Lộ trình đã công bố", "เส้นทางที่เผยแพร่", "Jalur yang diterbitkan", "Laluan diterbitkan", "المسارات المنشورة"],
    ["Compare city + routes", "So sánh thành phố và lộ trình", "เปรียบเทียบเมืองและเส้นทาง", "Bandingkan kota dan jalur", "Bandingkan bandar dan laluan", "قارن المدن والمسارات"],
    ["Funding routes", "Các hình thức tài trợ", "ช่องทางเงินทุน", "Jalur pendanaan", "Laluan pembiayaan", "مسارات التمويل"],
    ["Intakes", "Kỳ nhập học", "รอบรับเข้า", "Periode penerimaan", "Sesi kemasukan", "دورات القبول"],
    ["Fall + spring", "Thu và xuân", "ฤดูใบไม้ร่วงและฤดูใบไม้ผลิ", "Musim gugur dan semi", "Musim luruh dan bunga", "الخريف والربيع"],
    ["Cities & cost", "Thành phố và chi phí", "เมืองและค่าใช้จ่าย", "Kota dan biaya", "Bandar dan kos", "المدن والتكاليف"],
    ["Budget fit", "Phù hợp ngân sách", "เหมาะกับงบประมาณ", "Sesuai anggaran", "Sesuai bajet", "ما يناسب الميزانية"],
    ["No HSK first", "Không cần HSK ban đầu", "ไม่ต้องมี HSK ในขั้นแรก", "Tanpa HSK di awal", "Tanpa HSK pada awalnya", "دون HSK في البداية"],
    ["Check early", "Kiểm tra sớm", "ตรวจสอบแต่เนิ่นๆ", "Periksa lebih awal", "Semak lebih awal", "تحقق مبكرًا"],
    ["Start with a real destination", "Bắt đầu với mục tiêu cụ thể", "เริ่มจากเป้าหมายที่เป็นรูปธรรม", "Mulai dengan tujuan nyata", "Mulakan dengan destinasi sebenar", "ابدأ بوجهة واقعية"],
    ["Choose by subject, city, budget, language route, scholarship, and intake timing.", "Chọn theo ngành, thành phố, ngân sách, ngôn ngữ, học bổng và kỳ nhập học.", "เลือกตามสาขา เมือง งบประมาณ ภาษา ทุน และช่วงรับเข้า", "Pilih berdasarkan bidang, kota, anggaran, bahasa, beasiswa, dan waktu penerimaan.", "Pilih mengikut bidang, bandar, bajet, bahasa, biasiswa dan masa kemasukan.", "اختر حسب التخصص والمدينة والميزانية واللغة والمنحة وموعد القبول."],
    ["English-taught routes", "Lộ trình học bằng tiếng Anh", "เส้นทางเรียนภาษาอังกฤษ", "Jalur berbahasa Inggris", "Laluan pengajian bahasa Inggeris", "مسارات الدراسة بالإنجليزية"],
    ["Degrees that fit IELTS, TOEFL, or school-English backgrounds.", "Chương trình phù hợp với IELTS, TOEFL hoặc nền tảng học bằng tiếng Anh.", "หลักสูตรที่เหมาะกับ IELTS, TOEFL หรือพื้นฐานการเรียนภาษาอังกฤษ", "Gelar yang sesuai dengan IELTS, TOEFL, atau latar pendidikan berbahasa Inggris.", "Ijazah yang sesuai dengan IELTS, TOEFL atau latar pendidikan bahasa Inggeris.", "درجات تناسب IELTS أو TOEFL أو خلفية الدراسة بالإنجليزية."],
    ["City and cost fit", "Thành phố và chi phí phù hợp", "เมืองและค่าใช้จ่ายที่เหมาะสม", "Kesesuaian kota dan biaya", "Kesesuaian bandar dan kos", "المدينة والتكلفة المناسبتان"],
    ["See how Hangzhou, Beijing, Shanghai, and smaller cities differ.", "Xem sự khác biệt giữa Hàng Châu, Bắc Kinh, Thượng Hải và các thành phố nhỏ hơn.", "ดูความต่างของหางโจว ปักกิ่ง เซี่ยงไฮ้ และเมืองขนาดเล็ก", "Lihat perbedaan Hangzhou, Beijing, Shanghai, dan kota yang lebih kecil.", "Lihat perbezaan Hangzhou, Beijing, Shanghai dan bandar lebih kecil.", "تعرّف على الفروق بين هانغتشو وبكين وشنغهاي والمدن الأصغر."],
    ["University shortlist", "Danh sách trường phù hợp", "รายชื่อมหาวิทยาลัยที่คัดเลือก", "Daftar pilihan universitas", "Senarai pendek universiti", "قائمة الجامعات المختصرة"],
    ["Move from famous names to programs you can realistically apply to.", "Từ tên trường nổi tiếng đến chương trình bạn có khả năng ứng tuyển thực tế.", "เปลี่ยนจากชื่อที่มีชื่อเสียงเป็นหลักสูตรที่คุณสมัครได้จริง", "Beralih dari nama terkenal ke program yang realistis untuk Anda lamar.", "Beralih daripada nama terkenal kepada program yang realistik untuk dimohon.", "انتقل من الأسماء المشهورة إلى برامج يمكنك التقديم إليها واقعيًا."],
    ["Document readiness", "Sẵn sàng hồ sơ", "ความพร้อมของเอกสาร", "Kesiapan dokumen", "Kesediaan dokumen", "جاهزية الوثائق"],
    ["Passport, transcripts, language proof, translations, and deadlines.", "Hộ chiếu, bảng điểm, chứng chỉ ngôn ngữ, bản dịch và hạn nộp.", "หนังสือเดินทาง ใบแสดงผลการเรียน หลักฐานภาษา คำแปล และกำหนดส่ง", "Paspor, transkrip, bukti bahasa, terjemahan, dan tenggat.", "Pasport, transkrip, bukti bahasa, terjemahan dan tarikh akhir.", "جواز السفر وكشوف الدرجات وإثبات اللغة والترجمات والمواعيد النهائية."],
    ["Choose by your biggest question", "Chọn theo câu hỏi quan trọng nhất", "เลือกจากคำถามที่สำคัญที่สุด", "Pilih berdasarkan pertanyaan utama Anda", "Pilih mengikut persoalan utama anda", "اختر وفق سؤالك الأهم"],
    ["Most international students need one clear first answer: which program, which city, which budget, or which documents.", "Phần lớn sinh viên quốc tế cần câu trả lời rõ ràng đầu tiên: ngành nào, thành phố nào, ngân sách bao nhiêu hoặc hồ sơ gì.", "นักศึกษาต่างชาติส่วนใหญ่ต้องการคำตอบแรกที่ชัดเจน: หลักสูตร เมือง งบประมาณ หรือเอกสารใด", "Kebanyakan pelajar internasional memerlukan jawaban awal yang jelas: program, kota, anggaran, atau dokumen apa.", "Kebanyakan pelajar antarabangsa memerlukan jawapan awal yang jelas: program, bandar, bajet atau dokumen apa.", "يحتاج معظم الطلاب الدوليين إلى إجابة أولى واضحة: أي برنامج أو مدينة أو ميزانية أو وثائق؟"],
    ["See all routes", "Xem mọi lộ trình", "ดูทุกเส้นทาง", "Lihat semua jalur", "Lihat semua laluan", "عرض جميع المسارات"],
    ["Make China feel easier to choose.", "Chọn du học Trung Quốc dễ dàng hơn.", "เลือกเรียนต่อจีนให้ง่ายขึ้น", "Memilih studi di Tiongkok jadi lebih mudah.", "Memudahkan pilihan pengajian di China.", "اجعل اختيار الدراسة في الصين أسهل."],
    ["Start from the question that matters most, then narrow down programs and universities.", "Bắt đầu từ điều quan trọng nhất, rồi thu hẹp chương trình và trường phù hợp.", "เริ่มจากคำถามที่สำคัญที่สุด แล้วคัดเลือกหลักสูตรและมหาวิทยาลัย", "Mulai dari pertanyaan terpenting, lalu persempit pilihan program dan universitas.", "Mulakan dengan persoalan terpenting, kemudian kecilkan pilihan program dan universiti.", "ابدأ بالسؤال الأهم ثم ضيّق خيارات البرامج والجامعات."],
    ["Study in English", "Học bằng tiếng Anh", "เรียนเป็นภาษาอังกฤษ", "Belajar dalam bahasa Inggris", "Belajar dalam bahasa Inggeris", "الدراسة بالإنجليزية"],
    ["Programs that do not require HSK first.", "Chương trình không yêu cầu HSK ban đầu.", "หลักสูตรที่ไม่ต้องมี HSK ในขั้นแรก", "Program yang tidak mensyaratkan HSK di awal.", "Program yang tidak memerlukan HSK pada awalnya.", "برامج لا تتطلب HSK في البداية."],
    ["English route", "Lộ trình tiếng Anh", "เส้นทางภาษาอังกฤษ", "Jalur bahasa Inggris", "Laluan bahasa Inggeris", "مسار اللغة الإنجليزية"],
    ["Lower the cost", "Giảm chi phí", "ลดค่าใช้จ่าย", "Kurangi biaya", "Kurangkan kos", "خفض التكاليف"],
    ["Scholarship and affordable-city paths.", "Lộ trình học bổng và thành phố chi phí thấp.", "เส้นทางทุนและเมืองที่ค่าใช้จ่ายเหมาะสม", "Jalur beasiswa dan kota terjangkau.", "Laluan biasiswa dan bandar mampu biaya.", "مسارات المنح والمدن الميسورة التكلفة."],
    ["Budget", "Ngân sách", "งบประมาณ", "Anggaran", "Bajet", "الميزانية"],
    ["Check readiness", "Kiểm tra mức độ sẵn sàng", "ตรวจสอบความพร้อม", "Periksa kesiapan", "Semak kesediaan", "تحقق من الجاهزية"],
    ["Know blockers before you spend weeks applying.", "Biết trở ngại trước khi dành nhiều tuần nộp hồ sơ.", "รู้ข้อจำกัดก่อนใช้เวลาหลายสัปดาห์สมัคร", "Ketahui hambatan sebelum menghabiskan berminggu-minggu untuk mendaftar.", "Kenal pasti halangan sebelum menghabiskan masa berminggu-minggu memohon.", "اعرف العوائق قبل قضاء أسابيع في التقديم."],
    ["Transcript", "Bảng điểm", "ใบแสดงผลการเรียน", "Transkrip", "Transkrip", "كشف الدرجات"],
    ["Catch the intake", "Kịp kỳ nhập học", "ทันรอบรับเข้า", "Ikuti periode penerimaan", "Ikuti sesi kemasukan", "الحق بدورة القبول"],
    ["See which routes still fit the current cycle.", "Xem lộ trình nào còn phù hợp với đợt hiện tại.", "ดูเส้นทางที่ยังเหมาะกับรอบปัจจุบัน", "Lihat jalur yang masih sesuai dengan siklus saat ini.", "Lihat laluan yang masih sesuai dengan kitaran semasa.", "اطلع على المسارات التي ما زالت تناسب الدورة الحالية."],
    ["Full dates", "Ngày tháng đầy đủ", "วันที่ครบถ้วน", "Tanggal lengkap", "Tarikh lengkap", "التواريخ الكاملة"],
    ["From interest to a confident shortlist", "Từ quan tâm đến danh sách lựa chọn tự tin", "จากความสนใจสู่รายชื่อที่เลือกอย่างมั่นใจ", "Dari minat ke daftar pilihan yang meyakinkan", "Daripada minat kepada senarai pendek yang diyakini", "من الاهتمام إلى قائمة مختصرة بثقة"],
    ["A good China application is not just a university name. It needs a program, city, budget, language route, deadline, and document plan that fit together.", "Hồ sơ du học Trung Quốc tốt không chỉ là tên trường. Cần kết hợp chương trình, thành phố, ngân sách, ngôn ngữ, hạn nộp và kế hoạch hồ sơ.", "การสมัครเรียนจีนที่ดีต้องมีมากกว่าชื่อมหาวิทยาลัย ทั้งหลักสูตร เมือง งบประมาณ ภาษา กำหนดส่ง และแผนเอกสารต้องสอดคล้องกัน", "Pendaftaran studi Tiongkok yang baik perlu lebih dari nama universitas: program, kota, anggaran, bahasa, tenggat, dan rencana dokumen harus selaras.", "Permohonan pengajian China yang baik memerlukan lebih daripada nama universiti: program, bandar, bajet, bahasa, tarikh akhir dan rancangan dokumen perlu sepadan.", "يتطلب التقديم الجيد للدراسة في الصين أكثر من اسم جامعة؛ يجب أن تتوافق خيارات البرنامج والمدينة والميزانية واللغة والموعد وخطة الوثائق."],
    ["Explore routes", "Khám phá lộ trình", "สำรวจเส้นทาง", "Jelajahi jalur", "Teroka laluan", "استكشف المسارات"],
    ["Open intakes", "Kỳ nhập học đang mở", "รอบที่เปิดรับ", "Penerimaan terbuka", "Kemasukan dibuka", "دورات القبول المفتوحة"],
    ["View all", "Xem tất cả", "ดูทั้งหมด", "Lihat semua", "Lihat semua", "عرض الكل"],
    ["Current published intakes", "Kỳ nhập học đã công bố hiện tại", "รอบรับเข้าที่เผยแพร่ในปัจจุบัน", "Penerimaan terkini yang diterbitkan", "Kemasukan semasa yang diterbitkan", "دورات القبول المنشورة حاليًا"],
    ["Open the catalog to review the intake year, full deadline, source status, and application route.", "Mở danh mục để xem năm nhập học, hạn nộp đầy đủ, trạng thái nguồn và cách nộp hồ sơ.", "เปิดแค็ตตาล็อกเพื่อดูปีรับเข้า วันสิ้นสุด สถานะแหล่งข้อมูล และช่องทางสมัคร", "Buka katalog untuk melihat tahun penerimaan, tenggat lengkap, status sumber, dan jalur pendaftaran.", "Buka katalog untuk menyemak tahun kemasukan, tarikh akhir lengkap, status sumber dan laluan permohonan.", "افتح الدليل لمراجعة سنة القبول والموعد النهائي الكامل وحالة المصدر ومسار التقديم."],
    ["Verify dates", "Xác nhận ngày tháng", "ตรวจสอบวันที่", "Verifikasi tanggal", "Sahkan tarikh", "تحقق من التواريخ"],
    ["City snapshot", "Tổng quan thành phố", "ภาพรวมเมือง", "Gambaran kota", "Gambaran bandar", "لمحة عن المدن"],
    ["Explore", "Khám phá", "สำรวจ", "Jelajahi", "Teroka", "استكشف"],
    ["Published city guides", "Hướng dẫn thành phố đã công bố", "คู่มือเมืองที่เผยแพร่", "Panduan kota yang diterbitkan", "Panduan bandar diterbitkan", "أدلة المدن المنشورة"],
    ["Open the catalog for source-backed cost and study context.", "Mở danh mục để xem chi phí và bối cảnh học tập có nguồn tham khảo.", "เปิดแค็ตตาล็อกเพื่อดูข้อมูลค่าใช้จ่ายและการศึกษาที่มีแหล่งอ้างอิง", "Buka katalog untuk biaya dan konteks studi yang didukung sumber.", "Buka katalog untuk kos dan konteks pengajian bersumber.", "افتح الدليل للاطلاع على التكاليف وبيئة الدراسة المدعومة بالمصادر."],
    ["China study planning, with a clear product boundary", "Lập kế hoạch du học Trung Quốc với phạm vi hỗ trợ rõ ràng", "วางแผนเรียนต่อจีนด้วยขอบเขตบริการที่ชัดเจน", "Perencanaan studi Tiongkok dengan batas layanan yang jelas", "Perancangan pengajian China dengan skop perkhidmatan yang jelas", "تخطيط الدراسة في الصين ضمن نطاق خدمة واضح"],
    ["UCAC is a Holalobe product for exploring published study routes in China, comparing options, and preparing the next application step. Universities and responsible authorities remain the source for final admissions, scholarship, and submission requirements.", "UCAC là sản phẩm của Holalobe giúp tìm lộ trình du học Trung Quốc đã công bố, so sánh lựa chọn và chuẩn bị bước nộp hồ sơ tiếp theo. Trường đại học và cơ quan có thẩm quyền quyết định yêu cầu cuối cùng về tuyển sinh, học bổng và nộp hồ sơ.", "UCAC เป็นผลิตภัณฑ์ของ Holalobe สำหรับค้นหาเส้นทางเรียนต่อจีนที่เผยแพร่ เปรียบเทียบตัวเลือก และเตรียมขั้นตอนสมัคร มหาวิทยาลัยและหน่วยงานที่รับผิดชอบยังเป็นแหล่งข้อกำหนดสุดท้ายด้านการรับเข้า ทุน และการยื่นสมัคร", "UCAC adalah produk Holalobe untuk menjelajahi jalur studi Tiongkok yang diterbitkan, membandingkan pilihan, dan menyiapkan langkah pendaftaran berikutnya. Universitas dan otoritas terkait tetap menjadi sumber persyaratan akhir penerimaan, beasiswa, dan pengajuan.", "UCAC ialah produk Holalobe untuk meneroka laluan pengajian China yang diterbitkan, membandingkan pilihan dan menyediakan langkah permohonan seterusnya. Universiti dan pihak berkuasa berkaitan kekal sebagai sumber syarat akhir kemasukan, biasiswa dan penyerahan.", "UCAC منتج من Holalobe لاستكشاف مسارات الدراسة المنشورة في الصين ومقارنة الخيارات والاستعداد لخطوة التقديم التالية. تظل الجامعات والجهات المختصة مصدر المتطلبات النهائية للقبول والمنح وتقديم الطلبات."],
    ["Universities & colleges", "Trường đại học và cao đẳng", "มหาวิทยาลัยและวิทยาลัย", "Universitas dan perguruan tinggi", "Universiti dan kolej", "الجامعات والكليات"],
    ["Start here when the university, city, and admissions clarity matter before choosing a program.", "Bắt đầu tại đây nếu cần rõ về trường, thành phố và tuyển sinh trước khi chọn chương trình.", "เริ่มที่นี่หากต้องการความชัดเจนเรื่องมหาวิทยาลัย เมือง และการรับเข้าก่อนเลือกหลักสูตร", "Mulai di sini jika universitas, kota, dan kejelasan penerimaan penting sebelum memilih program.", "Mulakan di sini jika universiti, bandar dan kejelasan kemasukan penting sebelum memilih program.", "ابدأ هنا عندما تهمك الجامعة والمدينة ووضوح القبول قبل اختيار البرنامج."],
    ["Compare universities", "So sánh trường đại học", "เปรียบเทียบมหาวิทยาลัย", "Bandingkan universitas", "Bandingkan universiti", "قارن الجامعات"],
    ["Published university catalog", "Danh mục trường đã công bố", "แค็ตตาล็อกมหาวิทยาลัยที่เผยแพร่", "Katalog universitas yang diterbitkan", "Katalog universiti diterbitkan", "دليل الجامعات المنشور"],
    ["Review current locations, programs, and official source status.", "Xem địa điểm, chương trình và trạng thái nguồn chính thức hiện tại.", "ดูที่ตั้ง หลักสูตร และสถานะแหล่งข้อมูลทางการในปัจจุบัน", "Tinjau lokasi, program, dan status sumber resmi terkini.", "Semak lokasi, program dan status sumber rasmi semasa.", "راجع المواقع والبرامج وحالة المصادر الرسمية الحالية."],
    ["Applying to China", "Nộp hồ sơ du học Trung Quốc", "สมัครเรียนต่อจีน", "Mendaftar studi ke Tiongkok", "Memohon pengajian ke China", "التقديم للدراسة في الصين"],
    ["Short guides for the parts students often misunderstand before applying to Chinese universities.", "Hướng dẫn ngắn về những điều sinh viên thường hiểu sai trước khi nộp vào trường Trung Quốc.", "คู่มือสั้นสำหรับเรื่องที่นักศึกษามักเข้าใจผิดก่อนสมัครมหาวิทยาลัยจีน", "Panduan singkat tentang hal yang sering disalahpahami sebelum mendaftar ke universitas Tiongkok.", "Panduan ringkas tentang perkara yang sering disalah faham sebelum memohon ke universiti China.", "أدلة مختصرة للأمور التي يسيء الطلاب فهمها غالبًا قبل التقديم للجامعات الصينية."],
    ["Open guides", "Mở hướng dẫn", "เปิดคู่มือ", "Buka panduan", "Buka panduan", "افتح الأدلة"],
    ["Read admissions insights", "Đọc phân tích tuyển sinh", "อ่านบทวิเคราะห์การรับเข้า", "Baca wawasan penerimaan", "Baca wawasan kemasukan", "اقرأ رؤى القبول"],
    ["Understand what happens after admission.", "Hiểu các bước sau khi trúng tuyển.", "เข้าใจขั้นตอนหลังได้รับการตอบรับ", "Pahami proses setelah diterima.", "Fahami proses selepas diterima.", "افهم ما يحدث بعد القبول."],
    ["Budget checklist", "Danh sách kiểm tra ngân sách", "รายการตรวจสอบงบประมาณ", "Daftar periksa anggaran", "Senarai semak bajet", "قائمة مراجعة الميزانية"],
    ["Tuition, housing, insurance, and arrival cash.", "Học phí, nhà ở, bảo hiểm và tiền khi mới đến.", "ค่าเล่าเรียน ที่พัก ประกัน และเงินเมื่อเดินทางถึง", "Biaya kuliah, tempat tinggal, asuransi, dan uang saat tiba.", "Yuran pengajian, penginapan, insurans dan wang ketibaan.", "الرسوم الدراسية والسكن والتأمين والنقد عند الوصول."],
    ["Match language proof to program requirements.", "Đối chiếu chứng chỉ ngôn ngữ với yêu cầu chương trình.", "จับคู่หลักฐานภาษากับข้อกำหนดหลักสูตร", "Sesuaikan bukti bahasa dengan persyaratan program.", "Padankan bukti bahasa dengan syarat program.", "طابق إثبات اللغة مع متطلبات البرنامج."],
    ["Save programs, compare cities, track intake dates, and prepare documents in one place.", "Lưu chương trình, so sánh thành phố, theo dõi kỳ nhập học và chuẩn bị hồ sơ tại một nơi.", "บันทึกหลักสูตร เปรียบเทียบเมือง ติดตามรอบรับเข้า และเตรียมเอกสารในที่เดียว", "Simpan program, bandingkan kota, pantau tanggal penerimaan, dan siapkan dokumen di satu tempat.", "Simpan program, bandingkan bandar, jejak tarikh kemasukan dan sediakan dokumen di satu tempat.", "احفظ البرامج وقارن المدن وتابع مواعيد القبول وجهّز الوثائق في مكان واحد."],
    ["Useful China application insights", "Phân tích hữu ích về du học Trung Quốc", "บทวิเคราะห์ที่เป็นประโยชน์ในการสมัครเรียนจีน", "Wawasan bermanfaat tentang pendaftaran studi Tiongkok", "Wawasan berguna tentang permohonan pengajian China", "رؤى مفيدة حول التقديم للدراسة في الصين"],
    ["Practical updates for students choosing programs, cities, scholarships, and arrival plans.", "Thông tin thực tế cho sinh viên chọn chương trình, thành phố, học bổng và kế hoạch đến nơi.", "ข้อมูลเชิงปฏิบัติสำหรับการเลือกหลักสูตร เมือง ทุน และแผนเดินทางถึง", "Informasi praktis untuk memilih program, kota, beasiswa, dan rencana kedatangan.", "Maklumat praktikal untuk memilih program, bandar, biasiswa dan rancangan ketibaan.", "مستجدات عملية للطلاب عند اختيار البرامج والمدن والمنح وخطط الوصول."],
    ["Current intake timing", "Thời gian nhập học hiện tại", "ช่วงเวลารับเข้าปัจจุบัน", "Waktu penerimaan terkini", "Masa kemasukan semasa", "مواعيد القبول الحالية"],
    ["Which published applications need attention first.", "Hồ sơ đã công bố nào cần ưu tiên theo dõi.", "การสมัครที่เผยแพร่ใดควรให้ความสำคัญก่อน", "Pendaftaran terbitan mana yang perlu diperhatikan lebih dahulu.", "Permohonan diterbitkan mana yang perlu diberi perhatian dahulu.", "طلبات التقديم المنشورة التي تحتاج إلى الاهتمام أولًا."],
    ["Living cost by city", "Chi phí sinh hoạt theo thành phố", "ค่าครองชีพตามเมือง", "Biaya hidup menurut kota", "Kos sara hidup mengikut bandar", "تكاليف المعيشة حسب المدينة"],
    ["Compare Hangzhou, Beijing, Shanghai, and lower-cost cities.", "So sánh Hàng Châu, Bắc Kinh, Thượng Hải và các thành phố chi phí thấp hơn.", "เปรียบเทียบหางโจว ปักกิ่ง เซี่ยงไฮ้ และเมืองที่ค่าใช้จ่ายต่ำกว่า", "Bandingkan Hangzhou, Beijing, Shanghai, dan kota berbiaya lebih rendah.", "Bandingkan Hangzhou, Beijing, Shanghai dan bandar berkos lebih rendah.", "قارن هانغتشو وبكين وشنغهاي والمدن الأقل تكلفة."],
    ["English-taught China programs", "Chương trình tiếng Anh tại Trung Quốc", "หลักสูตรภาษาอังกฤษในจีน", "Program berbahasa Inggris di Tiongkok", "Program bahasa Inggeris di China", "برامج الصين باللغة الإنجليزية"],
    ["How to read language requirements before you apply.", "Cách đọc yêu cầu ngôn ngữ trước khi nộp hồ sơ.", "วิธีอ่านข้อกำหนดภาษาก่อนสมัคร", "Cara membaca persyaratan bahasa sebelum mendaftar.", "Cara membaca syarat bahasa sebelum memohon.", "كيفية قراءة متطلبات اللغة قبل التقديم."],
    ["How UCAC helps you move forward", "UCAC giúp bạn tiến bước như thế nào", "UCAC ช่วยคุณก้าวต่ออย่างไร", "Cara UCAC membantu Anda melangkah maju", "Cara UCAC membantu anda maju", "كيف يساعدك UCAC على التقدم"],
    ["A simple student journey from discovery to a cleaner application decision.", "Hành trình đơn giản từ tìm hiểu đến quyết định nộp hồ sơ rõ ràng hơn.", "เส้นทางนักศึกษาที่เรียบง่ายจากการค้นพบสู่การตัดสินใจสมัครที่ชัดเจนขึ้น", "Perjalanan sederhana dari pencarian ke keputusan pendaftaran yang lebih jelas.", "Perjalanan mudah daripada penerokaan kepada keputusan permohonan yang lebih jelas.", "رحلة بسيطة للطالب من الاستكشاف إلى قرار تقديم أوضح."],
    ["Start with subject, city, or university.", "Bắt đầu từ ngành, thành phố hoặc trường đại học.", "เริ่มจากสาขา เมือง หรือมหาวิทยาลัย", "Mulai dari bidang, kota, atau universitas.", "Mulakan dengan bidang, bandar atau universiti.", "ابدأ بالتخصص أو المدينة أو الجامعة."],
    ["Check tuition, living cost, and intake dates.", "Kiểm tra học phí, sinh hoạt phí và ngày nhập học.", "ตรวจสอบค่าเล่าเรียน ค่าครองชีพ และวันรับเข้า", "Periksa biaya kuliah, biaya hidup, dan tanggal penerimaan.", "Semak yuran pengajian, kos sara hidup dan tarikh kemasukan.", "تحقق من الرسوم الدراسية وتكاليف المعيشة ومواعيد القبول."],
    ["Understand language and document requirements.", "Hiểu yêu cầu ngôn ngữ và hồ sơ.", "เข้าใจข้อกำหนดภาษาและเอกสาร", "Pahami persyaratan bahasa dan dokumen.", "Fahami syarat bahasa dan dokumen.", "افهم متطلبات اللغة والوثائق."],
    ["Clear information beats admissions guesswork", "Thông tin rõ ràng thay cho phỏng đoán tuyển sinh", "ข้อมูลชัดเจนดีกว่าการคาดเดาการรับเข้า", "Informasi jelas lebih baik daripada menebak penerimaan", "Maklumat jelas mengatasi tekaan kemasukan", "المعلومات الواضحة أفضل من تخمينات القبول"],
    ["Application-ready routes", "Lộ trình sẵn sàng ứng tuyển", "เส้นทางที่พร้อมสมัคร", "Jalur siap daftar", "Laluan sedia memohon", "مسارات جاهزة للتقديم"],
    ["Separate useful application facts from items to confirm with the university.", "Phân biệt thông tin hồ sơ hữu ích với điều cần xác nhận cùng trường.", "แยกข้อเท็จจริงที่ใช้สมัครออกจากเรื่องที่ต้องยืนยันกับมหาวิทยาลัย", "Pisahkan fakta pendaftaran yang berguna dari hal yang perlu dikonfirmasi ke universitas.", "Bezakan fakta permohonan berguna daripada perkara yang perlu disahkan dengan universiti.", "ميّز حقائق التقديم المفيدة عن الأمور التي تتطلب تأكيدًا من الجامعة."],
    ["Exact dates", "Ngày tháng chính xác", "วันที่แน่นอน", "Tanggal pasti", "Tarikh tepat", "تواريخ دقيقة"],
    ["Different universities and intakes need visible deadline and arrival timing.", "Mỗi trường và kỳ nhập học cần hiển thị rõ hạn nộp và thời gian đến.", "แต่ละมหาวิทยาลัยและรอบรับเข้าต้องแสดงกำหนดส่งและช่วงเดินทางถึงอย่างชัดเจน", "Setiap universitas dan periode memerlukan tenggat serta waktu kedatangan yang jelas.", "Setiap universiti dan sesi memerlukan tarikh akhir serta masa ketibaan yang jelas.", "تحتاج الجامعات ودورات القبول المختلفة إلى مواعيد نهائية وأوقات وصول واضحة."],
    ["Realistic funding", "Tài trợ thực tế", "เงินทุนตามความเป็นจริง", "Pendanaan realistis", "Pembiayaan realistik", "تمويل واقعي"],
    ["Scholarship routes should never feel like guaranteed admission.", "Lộ trình học bổng không đồng nghĩa với đảm bảo trúng tuyển.", "เส้นทางทุนไม่ควรถูกมองว่าเป็นการรับประกันการรับเข้า", "Jalur beasiswa tidak boleh dianggap sebagai jaminan penerimaan.", "Laluan biasiswa tidak boleh dianggap sebagai jaminan kemasukan.", "يجب ألا تُفهم مسارات المنح على أنها ضمان للقبول."],
    ["Adviser review", "Tư vấn đánh giá", "การทบทวนโดยที่ปรึกษา", "Tinjauan penasihat", "Semakan penasihat", "مراجعة المستشار"],
    ["Help students make better choices without promising acceptance.", "Giúp sinh viên chọn tốt hơn mà không hứa hẹn trúng tuyển.", "ช่วยนักศึกษาเลือกได้ดีขึ้นโดยไม่สัญญาว่าจะได้รับการตอบรับ", "Bantu pelajar memilih lebih baik tanpa menjanjikan penerimaan.", "Bantu pelajar membuat pilihan lebih baik tanpa menjanjikan penerimaan.", "مساعدة الطلاب على اتخاذ خيارات أفضل دون الوعد بالقبول."],
    ["{count} programs · {available} currently available", "{count} chương trình · {available} đang nhận hồ sơ", "{count} หลักสูตร · เปิดรับ {available}", "{count} program · {available} tersedia saat ini", "{count} program · {available} tersedia kini", "{count} برنامج · {available} متاح حاليًا"],
    ["{count} published", "{count} đã công bố", "เผยแพร่ {count}", "{count} diterbitkan", "{count} diterbitkan", "{count} منشور"],
    ["{count} funding routes", "{count} hình thức tài trợ", "{count} ช่องทางเงินทุน", "{count} jalur pendanaan", "{count} laluan pembiayaan", "{count} مسار تمويل"],
    ["{count} city guides", "{count} hướng dẫn thành phố", "{count} คู่มือเมือง", "{count} panduan kota", "{count} panduan bandar", "{count} دليل مدينة"],
    ["{count} published programs", "{count} chương trình đã công bố", "{count} หลักสูตรที่เผยแพร่", "{count} program diterbitkan", "{count} program diterbitkan", "{count} برنامج منشور"],
    ["Language filters", "Bộ lọc ngôn ngữ", "ตัวกรองภาษา", "Filter bahasa", "Penapis bahasa", "مرشحات اللغة"],
    ["Application guide", "Hướng dẫn nộp hồ sơ", "คู่มือสมัคร", "Panduan pendaftaran", "Panduan permohonan", "دليل التقديم"],
    ["Date not published", "Chưa công bố ngày", "ยังไม่เผยแพร่วันที่", "Tanggal belum diterbitkan", "Tarikh belum diterbitkan", "لم يُنشر التاريخ"],
    ["Cost not published", "Chưa công bố chi phí", "ยังไม่เผยแพร่ค่าใช้จ่าย", "Biaya belum diterbitkan", "Kos belum diterbitkan", "لم تُنشر التكلفة"],
    ["Published program route", "Lộ trình chương trình đã công bố", "เส้นทางหลักสูตรที่เผยแพร่", "Jalur program yang diterbitkan", "Laluan program diterbitkan", "مسار البرنامج المنشور"],
    ["{name} campus", "Khuôn viên {name}", "วิทยาเขต {name}", "Kampus {name}", "Kampus {name}", "حرم {name}"],
  ];
  const dictionary = new Map(rows.map(([english, ...translations]) => [english, translations]));
  function text(value, variables = {}) {
    const source = String(value ?? "");
    const index = locales.indexOf(i18n.locale);
    const translated = index < 0 ? source : core[source] ? i18n.t(core[source], source) : dictionary.get(source)?.[index] || source;
    return translated.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);
  }
  function href(value) {
    if (i18n.href) return i18n.href(value);
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin || !/\.html$|^\/guides(?:\/|$)|^\/insights(?:\/|$)/.test(url.pathname)) return value;
    url.searchParams.set("lang", i18n.locale);
    return url.pathname + url.search + url.hash;
  }
  function apply(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest("svg, script, style, .footer")) continue;
      const original = node.textContent.trim();
      const translated = text(original);
      if (translated !== original) node.textContent = node.textContent.replace(original, translated);
    }
    root.querySelectorAll("[placeholder], [aria-label], img[alt], a[href]").forEach(node => {
      for (const attribute of ["placeholder", "aria-label", "alt"]) {
        if (node.hasAttribute(attribute)) node.setAttribute(attribute, text(node.getAttribute(attribute)));
      }
      if (node.matches("a[href]")) node.setAttribute("href", href(node.getAttribute("href")));
    });
    const input = root.querySelector("[data-site-search-input]");
    if (input && i18n.locale === "vi" && window.matchMedia("(max-width: 620px)").matches) input.placeholder = "Tìm chương trình";
  }
  window.CUACHomeI18n = { text, href, apply };
  const main = document.querySelector("main");
  if (!main) return;
  if (i18n.locale !== "en") document.title = `UCAC | ${i18n.t("home.title")}`;
  apply(main);
}());
