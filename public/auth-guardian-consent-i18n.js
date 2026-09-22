(function () {
  const rows = [
    ["Guardian approval · CUAC", "Phê duyệt của người giám hộ · CUAC", "การอนุมัติของผู้ปกครอง · CUAC", "Persetujuan wali · CUAC", "Kelulusan penjaga · CUAC", "موافقة ولي الأمر · CUAC"],
    ["Child account protection", "Bảo vệ tài khoản trẻ em", "การคุ้มครองบัญชีเด็ก", "Perlindungan akun anak", "Perlindungan akaun kanak-kanak", "حماية حساب الطفل"],
    ["Review a child account request", "Xem xét yêu cầu tài khoản trẻ em", "ตรวจสอบคำขอบัญชีเด็ก", "Tinjau permintaan akun anak", "Semak permintaan akaun kanak-kanak", "مراجعة طلب حساب طفل"],
    ["Approve only if you are the child's parent or legal guardian and you have reviewed CUAC's published children's privacy notice.", "Chỉ phê duyệt nếu bạn là cha mẹ hoặc người giám hộ hợp pháp và đã đọc thông báo quyền riêng tư trẻ em do CUAC công bố.", "อนุมัติเฉพาะเมื่อคุณเป็นพ่อแม่หรือผู้ปกครองตามกฎหมายและได้อ่านประกาศความเป็นส่วนตัวสำหรับเด็กของ CUAC", "Setujui hanya jika Anda adalah orang tua atau wali sah anak dan telah membaca pemberitahuan privasi anak CUAC.", "Luluskan hanya jika anda ialah ibu bapa atau penjaga sah kanak-kanak dan telah membaca notis privasi kanak-kanak CUAC.", "وافق فقط إذا كنت والد الطفل أو وصيه القانوني وقد راجعت إشعار خصوصية الأطفال المنشور من CUAC."],
    ["What approval means", "Ý nghĩa của việc phê duyệt", "ความหมายของการอนุมัติ", "Arti persetujuan", "Maksud kelulusan", "ما تعنيه الموافقة"],
    ["CUAC will create a student login for the child using the email they supplied. Application materials are not collected by CUAC in this release.", "CUAC sẽ tạo thông tin đăng nhập sinh viên bằng email trẻ đã cung cấp. CUAC không thu thập tài liệu đăng ký trong phiên bản này.", "CUAC จะสร้างบัญชีนักศึกษาด้วยอีเมลที่เด็กให้ไว้ และไม่เก็บเอกสารสมัครในรุ่นนี้", "CUAC akan membuat login pelajar menggunakan email yang diberikan anak. CUAC tidak mengumpulkan dokumen pendaftaran dalam rilis ini.", "CUAC akan mencipta log masuk pelajar menggunakan e-mel yang diberikan. CUAC tidak mengumpul bahan permohonan dalam keluaran ini.", "سينشئ CUAC تسجيل دخول للطالب باستخدام البريد الذي قدمه الطفل. ولا يجمع CUAC مواد التقديم في هذا الإصدار."],
    ["Open the children's privacy notice", "Mở thông báo quyền riêng tư trẻ em (bản tiếng Anh)", "เปิดประกาศความเป็นส่วนตัวสำหรับเด็ก (ฉบับภาษาอังกฤษ)", "Buka pemberitahuan privasi anak (versi bahasa Inggris)", "Buka notis privasi kanak-kanak (versi bahasa Inggeris)", "فتح إشعار خصوصية الأطفال (النسخة الإنجليزية)"],
    ["Approve child account", "Phê duyệt tài khoản trẻ em", "อนุมัติบัญชีเด็ก", "Setujui akun anak", "Luluskan akaun kanak-kanak", "الموافقة على حساب الطفل"],
    ["Decline", "Từ chối", "ปฏิเสธ", "Tolak", "Tolak", "رفض"],
    ["This one-time link expires after 72 hours. Approval does not sign the child in; the child must sign in and verify their own account email.", "Liên kết dùng một lần hết hạn sau 72 giờ. Việc phê duyệt không đăng nhập cho trẻ; trẻ phải tự đăng nhập và xác minh email tài khoản.", "ลิงก์ใช้ครั้งเดียวหมดอายุใน 72 ชั่วโมง การอนุมัติไม่ได้เข้าสู่ระบบแทนเด็ก เด็กต้องเข้าสู่ระบบและยืนยันอีเมลเอง", "Tautan sekali pakai berakhir setelah 72 jam. Persetujuan tidak memasukkan anak; anak harus masuk dan memverifikasi email sendiri.", "Pautan sekali guna tamat selepas 72 jam. Kelulusan tidak melog masuk kanak-kanak; mereka mesti log masuk dan mengesahkan e-mel sendiri.", "تنتهي صلاحية الرابط لمرة واحدة بعد 72 ساعة. لا تسجل الموافقة دخول الطفل؛ يجب عليه تسجيل الدخول والتحقق من بريده بنفسه."],
    ["This approval link is missing or invalid.", "Liên kết phê duyệt bị thiếu hoặc không hợp lệ.", "ลิงก์อนุมัติหายไปหรือไม่ถูกต้อง", "Tautan persetujuan hilang atau tidak valid.", "Pautan kelulusan tiada atau tidak sah.", "رابط الموافقة مفقود أو غير صالح."],
    ["Activating the child account...", "Đang kích hoạt tài khoản trẻ em...", "กำลังเปิดใช้งานบัญชีเด็ก...", "Mengaktifkan akun anak...", "Mengaktifkan akaun kanak-kanak...", "جارٍ تفعيل حساب الطفل..."],
    ["Declining the request...", "Đang từ chối yêu cầu...", "กำลังปฏิเสธคำขอ...", "Menolak permintaan...", "Menolak permintaan...", "جارٍ رفض الطلب..."],
    ["The request could not be completed.", "Không thể hoàn tất yêu cầu.", "ไม่สามารถดำเนินการตามคำขอได้", "Permintaan tidak dapat diselesaikan.", "Permintaan tidak dapat diselesaikan.", "تعذر إكمال الطلب."],
    ["Approved. The child account is active; the child can now sign in and verify their email.", "Đã phê duyệt. Tài khoản trẻ em đã hoạt động; trẻ có thể đăng nhập và xác minh email.", "อนุมัติแล้ว บัญชีเด็กเปิดใช้งาน เด็กสามารถเข้าสู่ระบบและยืนยันอีเมลได้", "Disetujui. Akun anak aktif; anak dapat masuk dan memverifikasi email.", "Diluluskan. Akaun kanak-kanak aktif; mereka boleh log masuk dan mengesahkan e-mel.", "تمت الموافقة. حساب الطفل نشط ويمكنه الآن تسجيل الدخول والتحقق من بريده."],
    ["Declined. The pending password and approval credential have been removed.", "Đã từ chối. Mật khẩu đang chờ và thông tin phê duyệt đã được xóa.", "ปฏิเสธแล้ว รหัสผ่านที่รอดำเนินการและข้อมูลอนุมัติถูกลบแล้ว", "Ditolak. Kata sandi tertunda dan kredensial persetujuan telah dihapus.", "Ditolak. Kata laluan tertunda dan kelayakan kelulusan telah dialih keluar.", "تم الرفض. أزيلت كلمة المرور المعلقة وبيانات اعتماد الموافقة."],
  ];
  const i18n = window.CUACI18n;
  const localeIndex = { vi: 1, th: 2, id: 3, ms: 4, ar: 5 }[i18n?.locale] || 0;
  const translations = new Map(rows.map(row => [row[0], row[localeIndex] || row[0]]));
  const ui = value => translations.get(String(value || "")) || String(value || "");
  function apply(root = document) {
    if (!localeIndex) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const value = node.nodeValue.trim();
      if (translations.has(value)) node.nodeValue = node.nodeValue.replace(value, ui(value));
    });
    document.title = ui(document.title);
  }
  window.CUACGuardianI18n = Object.freeze({ locale: i18n?.locale || "en", ui, apply });
  apply();
}());
