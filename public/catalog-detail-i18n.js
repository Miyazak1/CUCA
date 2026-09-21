(function initCatalogDetailI18n() {
  "use strict";

  const rows = [
    ["Back to programs", "Quay lại chương trình", "กลับไปยังหลักสูตร", "Kembali ke program", "Kembali ke program", "العودة إلى البرامج"],
    ["Back to universities", "Quay lại trường đại học", "กลับไปยังมหาวิทยาลัย", "Kembali ke universitas", "Kembali ke universiti", "العودة إلى الجامعات"],
    ["Back to scholarships", "Quay lại học bổng", "กลับไปยังทุน", "Kembali ke beasiswa", "Kembali ke biasiswa", "العودة إلى المنح"],
    ["Program record", "Hồ sơ chương trình", "ระเบียนหลักสูตร", "Catatan program", "Rekod program", "سجل البرنامج"],
    ["University record", "Hồ sơ trường đại học", "ระเบียนมหาวิทยาลัย", "Catatan universitas", "Rekod universiti", "سجل الجامعة"],
    ["Scholarship record", "Hồ sơ học bổng", "ระเบียนทุน", "Catatan beasiswa", "Rekod biasiswa", "سجل المنحة"],
    ["Not provided", "Chưa cung cấp", "ไม่ได้ระบุ", "Belum tersedia", "Tidak diberikan", "غير متوفر"],
    ["Yes", "Có", "ใช่", "Ya", "Ya", "نعم"], ["No", "Không", "ไม่", "Tidak", "Tidak", "لا"],
    ["Verified source", "Nguồn đã xác minh", "แหล่งข้อมูลที่ตรวจสอบแล้ว", "Sumber terverifikasi", "Sumber disahkan", "مصدر موثّق"],
    ["Not yet verified", "Chưa xác minh", "ยังไม่ตรวจสอบ", "Belum terverifikasi", "Belum disahkan", "لم يُوثّق بعد"],
    ["Verification is stale", "Xác minh đã cũ", "การตรวจสอบล้าสมัย", "Verifikasi sudah lama", "Pengesahan sudah lama", "التحقق قديم"],
    ["Source is disputed", "Nguồn đang tranh chấp", "แหล่งข้อมูลมีข้อโต้แย้ง", "Sumber diperselisihkan", "Sumber dipertikaikan", "المصدر محل نزاع"],
    ["Source is invalid", "Nguồn không hợp lệ", "แหล่งข้อมูลไม่ถูกต้อง", "Sumber tidak valid", "Sumber tidak sah", "المصدر غير صالح"],
    ["Draft source record", "Bản ghi nguồn nháp", "ระเบียนแหล่งข้อมูลฉบับร่าง", "Catatan sumber draf", "Rekod sumber draf", "سجل مصدر مسودة"],
    ["Verification unknown", "Chưa rõ trạng thái xác minh", "ไม่ทราบสถานะการตรวจสอบ", "Status verifikasi tidak diketahui", "Status pengesahan tidak diketahui", "حالة التحقق غير معروفة"],
    ["Source status", "Trạng thái nguồn", "สถานะแหล่งข้อมูล", "Status sumber", "Status sumber", "حالة المصدر"],
    ["Last verified", "Xác minh lần cuối", "ตรวจสอบล่าสุด", "Terakhir diverifikasi", "Kali terakhir disahkan", "آخر تحقق"],
    ["Open source", "Mở nguồn", "เปิดแหล่งข้อมูล", "Buka sumber", "Buka sumber", "فتح المصدر"],
    ["No public source link provided", "Không có liên kết nguồn công khai", "ไม่มีลิงก์แหล่งข้อมูลสาธารณะ", "Tautan sumber publik tidak tersedia", "Pautan sumber awam tidak diberikan", "لا يوجد رابط مصدر عام"],
    ["Published catalog record", "Bản ghi danh mục đã công bố", "ระเบียนแค็ตตาล็อกที่เผยแพร่", "Catatan katalog terbit", "Rekod katalog diterbitkan", "سجل دليل منشور"],
    ["Record summary", "Tóm tắt hồ sơ", "สรุประเบียน", "Ringkasan catatan", "Ringkasan rekod", "ملخص السجل"],
    ["Before you decide", "Trước khi quyết định", "ก่อนตัดสินใจ", "Sebelum Anda memutuskan", "Sebelum anda membuat keputusan", "قبل أن تقرر"],
    ["Record update", "Cập nhật hồ sơ", "การอัปเดตระเบียน", "Pembaruan catatan", "Kemas kini rekod", "تحديث السجل"],
    ["Version", "Phiên bản", "เวอร์ชัน", "Versi", "Versi", "الإصدار"],
    ["Loading published record", "Đang tải hồ sơ đã công bố", "กำลังโหลดระเบียนที่เผยแพร่", "Memuat catatan terbit", "Memuatkan rekod diterbitkan", "جارٍ تحميل السجل المنشور"],
    ["Reading the current public catalog and source status.", "Đang đọc danh mục công khai và trạng thái nguồn hiện tại.", "กำลังอ่านแค็ตตาล็อกสาธารณะและสถานะแหล่งข้อมูล", "Membaca katalog publik dan status sumber saat ini.", "Membaca katalog awam dan status sumber semasa.", "جارٍ قراءة الدليل العام وحالة المصدر الحالية."],
    ["Record unavailable", "Hồ sơ không khả dụng", "ระเบียนไม่พร้อมใช้งาน", "Catatan tidak tersedia", "Rekod tidak tersedia", "السجل غير متاح"],
    ["The published catalog record could not be loaded.", "Không thể tải hồ sơ danh mục đã công bố.", "ไม่สามารถโหลดระเบียนแค็ตตาล็อกที่เผยแพร่ได้", "Catatan katalog terbit tidak dapat dimuat.", "Rekod katalog diterbitkan tidak dapat dimuatkan.", "تعذر تحميل سجل الدليل المنشور."],
    ["Try again", "Thử lại", "ลองอีกครั้ง", "Coba lagi", "Cuba lagi", "إعادة المحاولة"],
    ["Program profile", "Hồ sơ chương trình", "ข้อมูลหลักสูตร", "Profil program", "Profil program", "ملف البرنامج"],
    ["Study route and cost", "Lộ trình học và chi phí", "เส้นทางการเรียนและค่าใช้จ่าย", "Jalur studi dan biaya", "Laluan pengajian dan kos", "مسار الدراسة والتكلفة"],
    ["Degree", "Bậc học", "ระดับปริญญา", "Jenjang", "Tahap", "الدرجة"],
    ["Subject area", "Lĩnh vực", "สาขาวิชา", "Bidang studi", "Bidang pengajian", "مجال الدراسة"],
    ["Teaching language", "Ngôn ngữ giảng dạy", "ภาษาการสอน", "Bahasa pengantar", "Bahasa pengantar", "لغة التدريس"],
    ["Duration", "Thời lượng", "ระยะเวลา", "Durasi", "Tempoh", "المدة"],
    ["Tuition", "Học phí", "ค่าเล่าเรียน", "Biaya kuliah", "Yuran pengajian", "الرسوم الدراسية"],
    ["Scholarship note", "Ghi chú học bổng", "หมายเหตุทุน", "Catatan beasiswa", "Nota biasiswa", "ملاحظة المنحة"],
    ["Catalog group", "Nhóm danh mục", "กลุ่มแค็ตตาล็อก", "Grup katalog", "Kumpulan katalog", "مجموعة الدليل"],
    ["Intakes", "Kỳ tuyển sinh", "รอบรับสมัคร", "Jadwal penerimaan", "Pengambilan", "مواعيد القبول"],
    ["Open application windows", "Đợt nộp hồ sơ đang mở", "ช่วงสมัครที่เปิด", "Periode pendaftaran terbuka", "Tempoh permohonan terbuka", "فترات التقديم المفتوحة"],
    ["Requirements", "Yêu cầu", "ข้อกำหนด", "Persyaratan", "Syarat", "المتطلبات"],
    ["Admission route", "Lộ trình tuyển sinh", "เส้นทางการรับสมัคร", "Jalur penerimaan", "Laluan kemasukan", "مسار القبول"],
    ["Language and assessment conditions", "Điều kiện ngôn ngữ và đánh giá", "เงื่อนไขภาษาและการประเมิน", "Ketentuan bahasa dan penilaian", "Syarat bahasa dan penilaian", "شروط اللغة والتقييم"],
    ["Next intake", "Kỳ tiếp theo", "รอบถัดไป", "Penerimaan berikutnya", "Pengambilan seterusnya", "موعد القبول التالي"],
    ["None published", "Chưa công bố", "ยังไม่เผยแพร่", "Belum diterbitkan", "Belum diterbitkan", "لم يُنشر بعد"],
    ["Deadline", "Hạn nộp", "กำหนดเวลา", "Tenggat", "Tarikh akhir", "الموعد النهائي"],
    ["Language", "Ngôn ngữ", "ภาษา", "Bahasa", "Bahasa", "اللغة"],
    ["Continue with this program", "Tiếp tục với chương trình này", "ดำเนินการกับหลักสูตรนี้", "Lanjutkan dengan program ini", "Teruskan dengan program ini", "المتابعة مع هذا البرنامج"],
    ["Add to application", "Thêm vào hồ sơ", "เพิ่มในใบสมัคร", "Tambahkan ke pendaftaran", "Tambah pada permohonan", "إضافة إلى الطلب"],
    ["Official application", "Trang nộp hồ sơ chính thức", "การสมัครอย่างเป็นทางการ", "Pendaftaran resmi", "Permohonan rasmi", "التقديم الرسمي"],
    ["View university", "Xem trường đại học", "ดูมหาวิทยาลัย", "Lihat universitas", "Lihat universiti", "عرض الجامعة"],
    ["University profile", "Hồ sơ trường đại học", "ข้อมูลมหาวิทยาลัย", "Profil universitas", "Profil universiti", "ملف الجامعة"],
    ["Institution and study context", "Thông tin trường và học tập", "บริบทสถาบันและการเรียน", "Konteks institusi dan studi", "Konteks institusi dan pengajian", "سياق المؤسسة والدراسة"],
    ["School type", "Loại trường", "ประเภทสถาบัน", "Jenis institusi", "Jenis institusi", "نوع المؤسسة"],
    ["Application level", "Bậc tuyển sinh", "ระดับการสมัคร", "Jenjang pendaftaran", "Tahap permohonan", "مستوى التقديم"],
    ["Location", "Địa điểm", "สถานที่", "Lokasi", "Lokasi", "الموقع"],
    ["Ranking", "Xếp hạng", "อันดับ", "Peringkat", "Kedudukan", "التصنيف"],
    ["Application fee", "Phí đăng ký", "ค่าธรรมเนียมสมัคร", "Biaya pendaftaran", "Yuran permohonan", "رسوم التقديم"],
    ["Admissions", "Tuyển sinh", "การรับสมัคร", "Penerimaan", "Kemasukan", "القبول"],
    ["Catalog coverage", "Phạm vi danh mục", "ความครอบคลุมของแค็ตตาล็อก", "Cakupan katalog", "Liputan katalog", "تغطية الدليل"],
    ["Programs", "Chương trình", "หลักสูตร", "Program", "Program", "البرامج"],
    ["English-taught programs", "Chương trình dạy bằng tiếng Anh", "หลักสูตรภาษาอังกฤษ", "Program berbahasa Inggris", "Program bahasa Inggeris", "برامج باللغة الإنجليزية"],
    ["Scholarships", "Học bổng", "ทุนการศึกษา", "Beasiswa", "Biasiswa", "المنح"],
    ["Next deadline", "Hạn tiếp theo", "กำหนดถัดไป", "Tenggat berikutnya", "Tarikh akhir seterusnya", "الموعد التالي"],
    ["Explore this university", "Khám phá trường này", "สำรวจมหาวิทยาลัยนี้", "Jelajahi universitas ini", "Teroka universiti ini", "استكشف هذه الجامعة"],
    ["Browse matching programs", "Xem chương trình phù hợp", "ดูหลักสูตรที่ตรงกัน", "Lihat program yang cocok", "Lihat program yang sepadan", "تصفح البرامج المطابقة"],
    ["Admissions website", "Trang tuyển sinh", "เว็บไซต์รับสมัคร", "Situs penerimaan", "Laman kemasukan", "موقع القبول"],
    ["University website", "Trang trường", "เว็บไซต์มหาวิทยาลัย", "Situs universitas", "Laman universiti", "موقع الجامعة"],
    ["Award profile", "Hồ sơ học bổng", "ข้อมูลทุน", "Profil beasiswa", "Profil biasiswa", "ملف المنحة"],
    ["Funding and coverage", "Tài trợ và quyền lợi", "เงินทุนและความคุ้มครอง", "Pendanaan dan cakupan", "Pembiayaan dan liputan", "التمويل والتغطية"],
    ["Funding level", "Mức tài trợ", "ระดับทุน", "Tingkat pendanaan", "Tahap pembiayaan", "مستوى التمويل"],
    ["Type", "Loại", "ประเภท", "Jenis", "Jenis", "النوع"], ["Amount", "Số tiền", "จำนวน", "Jumlah", "Jumlah", "المبلغ"],
    ["Coverage", "Quyền lợi", "ความคุ้มครอง", "Cakupan", "Liputan", "التغطية"], ["Provider", "Đơn vị cấp", "ผู้ให้ทุน", "Penyedia", "Penyedia", "الجهة المانحة"],
    ["Eligibility", "Điều kiện", "คุณสมบัติ", "Kelayakan", "Kelayakan", "الأهلية"],
    ["Benefits", "Quyền lợi", "สิทธิประโยชน์", "Manfaat", "Faedah", "المزايا"], ["Materials", "Hồ sơ", "เอกสาร", "Dokumen", "Dokumen", "المستندات"],
    ["Process", "Quy trình", "ขั้นตอน", "Proses", "Proses", "العملية"], ["Details", "Chi tiết", "รายละเอียด", "Rincian", "Butiran", "التفاصيل"],
    ["Relations", "Liên kết", "รายการที่เชื่อมโยง", "Relasi", "Hubungan", "السجلات المرتبطة"],
    ["University", "Trường đại học", "มหาวิทยาลัย", "Universitas", "Universiti", "الجامعة"], ["Program", "Chương trình", "หลักสูตร", "Program", "Program", "البرنامج"],
    ["Application round", "Đợt nộp hồ sơ", "รอบสมัคร", "Putaran pendaftaran", "Pusingan permohonan", "جولة التقديم"],
    ["Funding", "Tài trợ", "ทุน", "Pendanaan", "Pembiayaan", "التمويل"],
    ["Use this funding route", "Sử dụng lộ trình tài trợ này", "ใช้เส้นทางทุนนี้", "Gunakan jalur pendanaan ini", "Gunakan laluan pembiayaan ini", "استخدم مسار التمويل هذا"],
    ["Find matching programs", "Tìm chương trình phù hợp", "ค้นหาหลักสูตรที่ตรงกัน", "Temukan program yang cocok", "Cari program yang sepadan", "ابحث عن برامج مطابقة"],
    ["View related university", "Xem trường liên quan", "ดูมหาวิทยาลัยที่เกี่ยวข้อง", "Lihat universitas terkait", "Lihat universiti berkaitan", "عرض الجامعة المرتبطة"],
    ["Included", "Bao gồm", "รวม", "Termasuk", "Termasuk", "مشمول"], ["Not included", "Không bao gồm", "ไม่รวม", "Tidak termasuk", "Tidak termasuk", "غير مشمول"],
    ["This published record has not yet completed source verification.", "Hồ sơ đã công bố này chưa hoàn tất xác minh nguồn.", "ระเบียนที่เผยแพร่นี้ยังตรวจสอบแหล่งข้อมูลไม่เสร็จ", "Catatan terbit ini belum selesai diverifikasi sumbernya.", "Rekod diterbitkan ini belum selesai melalui pengesahan sumber.", "لم يكتمل التحقق من مصدر هذا السجل المنشور بعد."],
    ["Open program record", "Mở hồ sơ chương trình", "เปิดระเบียนหลักสูตร", "Buka catatan program", "Buka rekod program", "فتح سجل البرنامج"],
    ["Language and assessment context", "Bối cảnh ngôn ngữ và đánh giá", "บริบทภาษาและการประเมิน", "Konteks bahasa dan penilaian", "Konteks bahasa dan penilaian", "سياق اللغة والتقييم"],
    ["Published routes in CUAC", "Lộ trình đã công bố trên CUAC", "เส้นทางที่เผยแพร่ใน CUAC", "Jalur yang diterbitkan di CUAC", "Laluan diterbitkan dalam CUAC", "المسارات المنشورة في CUAC"],
    ["Upcoming", "Sắp tới", "เร็ว ๆ นี้", "Akan datang", "Akan datang", "قريبًا"],
    ["Published intake deadlines", "Hạn kỳ tuyển sinh đã công bố", "กำหนดรับสมัครที่เผยแพร่", "Tenggat penerimaan terbit", "Tarikh akhir pengambilan diterbitkan", "مواعيد القبول المنشورة"],
    ["Campus context", "Thông tin khuôn viên", "บริบทวิทยาเขต", "Konteks kampus", "Konteks kampus", "سياق الحرم الجامعي"],
    ["Source-backed tags and highlights", "Nhãn và điểm nổi bật có nguồn", "ป้ายและจุดเด่นที่มีแหล่งอ้างอิง", "Tag dan sorotan bersumber", "Tag dan sorotan bersumber", "وسوم ونقاط بارزة مدعومة بالمصدر"],
    ["Who the award applies to", "Đối tượng áp dụng", "ผู้มีสิทธิ์รับทุน", "Penerima yang memenuhi cakupan", "Siapa yang layak", "من تشملهم المنحة"],
    ["What the award includes", "Quyền lợi học bổng", "สิ่งที่ทุนครอบคลุม", "Cakupan beasiswa", "Apa yang termasuk", "ما تشمله المنحة"],
    ["Application materials", "Hồ sơ đăng ký", "เอกสารสมัคร", "Dokumen pendaftaran", "Dokumen permohonan", "مستندات التقديم"],
    ["Published application steps", "Các bước đăng ký đã công bố", "ขั้นตอนสมัครที่เผยแพร่", "Tahap pendaftaran terbit", "Langkah permohonan diterbitkan", "خطوات التقديم المنشورة"],
    ["Additional published information", "Thông tin công bố bổ sung", "ข้อมูลเผยแพร่เพิ่มเติม", "Informasi terbit tambahan", "Maklumat diterbitkan tambahan", "معلومات منشورة إضافية"],
    ["Linked catalog records", "Hồ sơ danh mục liên kết", "ระเบียนแค็ตตาล็อกที่เชื่อมโยง", "Catatan katalog terkait", "Rekod katalog berkaitan", "سجلات الدليل المرتبطة"],
    ["Tuition summary", "Tóm tắt học phí", "สรุปค่าเล่าเรียน", "Ringkasan biaya kuliah", "Ringkasan yuran", "ملخص الرسوم"],
    ["Tuition band", "Khoảng học phí", "ช่วงค่าเล่าเรียน", "Rentang biaya kuliah", "Julat yuran", "نطاق الرسوم"],
    ["Provider location", "Địa điểm đơn vị cấp", "ที่ตั้งผู้ให้ทุน", "Lokasi penyedia", "Lokasi penyedia", "موقع الجهة المانحة"],
    ["Applicable degree", "Bậc học áp dụng", "ระดับที่ใช้ได้", "Jenjang yang berlaku", "Tahap yang berkenaan", "الدرجة المشمولة"],
    ["Applicable program", "Chương trình áp dụng", "หลักสูตรที่ใช้ได้", "Program yang berlaku", "Program yang berkenaan", "البرنامج المشمول"],
    ["Requirement summary", "Tóm tắt yêu cầu", "สรุปข้อกำหนด", "Ringkasan persyaratan", "Ringkasan syarat", "ملخص المتطلبات"],
    ["English routes", "Lộ trình tiếng Anh", "เส้นทางภาษาอังกฤษ", "Jalur bahasa Inggris", "Laluan bahasa Inggeris", "مسارات باللغة الإنجليزية"],
    ["Application note", "Ghi chú hồ sơ", "หมายเหตุการสมัคร", "Catatan pendaftaran", "Nota permohonan", "ملاحظة التقديم"],
    ["Instruction language", "Ngôn ngữ giảng dạy", "ภาษาการสอน", "Bahasa pengantar", "Bahasa pengantar", "لغة التدريس"],
    ["Language requirement", "Yêu cầu ngôn ngữ", "ข้อกำหนดภาษา", "Persyaratan bahasa", "Syarat bahasa", "متطلبات اللغة"],
    ["English requirement", "Yêu cầu tiếng Anh", "ข้อกำหนดภาษาอังกฤษ", "Persyaratan bahasa Inggris", "Syarat bahasa Inggeris", "متطلبات الإنجليزية"],
    ["HSK requirement", "Yêu cầu HSK", "ข้อกำหนด HSK", "Persyaratan HSK", "Syarat HSK", "متطلبات HSK"],
    ["CSCA required", "Yêu cầu CSCA", "ต้องใช้ CSCA", "Wajib CSCA", "CSCA diperlukan", "مطلوب CSCA"],
    ["CSCA detail", "Chi tiết CSCA", "รายละเอียด CSCA", "Rincian CSCA", "Butiran CSCA", "تفاصيل CSCA"],
    ["Deadline summary", "Tóm tắt thời hạn", "สรุปกำหนดเวลา", "Ringkasan tenggat", "Ringkasan tarikh akhir", "ملخص المواعيد"],
    ["Undergraduate", "Đại học", "ปริญญาตรี", "Sarjana", "Sarjana muda", "بكالوريوس"],
    ["Master", "Thạc sĩ", "ปริญญาโท", "Magister", "Sarjana", "ماجستير"],
    ["Doctoral", "Tiến sĩ", "ปริญญาเอก", "Doktor", "Kedoktoran", "دكتوراه"],
    ["Public", "Công lập", "รัฐ", "Negeri", "Awam", "حكومية"],
    ["Private", "Tư thục", "เอกชน", "Swasta", "Swasta", "خاصة"],
    ["Chinese", "Tiếng Trung", "ภาษาจีน", "Bahasa Mandarin", "Bahasa Cina", "الصينية"],
    ["English", "Tiếng Anh", "ภาษาอังกฤษ", "Bahasa Inggris", "Bahasa Inggeris", "الإنجليزية"],
    ["Bilingual", "Song ngữ", "สองภาษา", "Dwibahasa", "Dwibahasa", "ثنائي اللغة"],
    ["Full", "Toàn phần", "เต็มจำนวน", "Penuh", "Penuh", "كامل"],
    ["Partial", "Một phần", "บางส่วน", "Sebagian", "Separa", "جزئي"],
  ];

  const i18n = window.CUACI18n;
  const localeIndex = { vi: 1, th: 2, id: 3, ms: 4, ar: 5 }[i18n?.locale] || 0;
  const dictionary = new Map(rows.map((row) => [row[0], row[localeIndex] || row[0]]));
  const ui = (english) => dictionary.get(String(english)) || String(english);
  function href(rawHref) {
    if (!rawHref || !i18n || i18n.locale === "en") return rawHref;
    const url = new URL(rawHref, location.href);
    if (url.origin !== location.origin || !url.pathname.toLowerCase().endsWith(".html")) return rawHref;
    url.searchParams.set("lang", i18n.locale);
    return `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
  }
  function applyLinks(root = document) {
    const anchors = root.matches?.("a[href]") ? [root] : [...(root.querySelectorAll?.("a[href]") || [])];
    anchors.forEach((anchor) => {
      const localized = href(anchor.getAttribute("href"));
      if (localized && localized !== anchor.getAttribute("href")) anchor.setAttribute("href", localized);
    });
  }
  applyLinks();
  new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) applyLinks(node);
  }))).observe(document.body, { childList: true, subtree: true });
  window.CUACCatalogDetailI18n = Object.freeze({ locale: i18n?.locale || "en", ui, href, applyLinks });
}());
