"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import styles from "./auth-action.module.css";

type ActionKind = "verify" | "reset";
type ActionState = "loading" | "ready" | "invalid" | "submitting" | "success" | "error";
type AuthLocale = "en" | "vi" | "th" | "id" | "ms" | "ar";

const localeMeta: Record<AuthLocale, { dir: "ltr" | "rtl" }> = {
  en: { dir: "ltr" }, vi: { dir: "ltr" }, th: { dir: "ltr" }, id: { dir: "ltr" }, ms: { dir: "ltr" }, ar: { dir: "rtl" },
};

const copyRows: Array<[string, string, string, string, string, string]> = [
  ["CUAC home", "Trang chủ CUAC", "หน้าหลัก CUAC", "Beranda CUAC", "Utama CUAC", "الرئيسية في CUAC"],
  ["Sign in", "Đăng nhập", "เข้าสู่ระบบ", "Masuk", "Log masuk", "تسجيل الدخول"],
  ["Account verification", "Xác minh tài khoản", "ยืนยันบัญชี", "Verifikasi akun", "Pengesahan akaun", "التحقق من الحساب"],
  ["Account recovery", "Khôi phục tài khoản", "กู้คืนบัญชี", "Pemulihan akun", "Pemulihan akaun", "استعادة الحساب"],
  ["Verify your email", "Xác minh email", "ยืนยันอีเมล", "Verifikasi email", "Sahkan e-mel", "تحقق من بريدك الإلكتروني"],
  ["Set a new password", "Đặt mật khẩu mới", "ตั้งรหัสผ่านใหม่", "Atur kata sandi baru", "Tetapkan kata laluan baharu", "تعيين كلمة مرور جديدة"],
  ["This action changes only your CUAC account credentials. It does not grant school or internal roles.", "Thao tác này chỉ thay đổi thông tin đăng nhập CUAC và không cấp quyền trường hoặc nội bộ.", "การดำเนินการนี้เปลี่ยนเฉพาะข้อมูลเข้าสู่ระบบ CUAC และไม่ให้สิทธิ์มหาวิทยาลัยหรือเจ้าหน้าที่", "Tindakan ini hanya mengubah kredensial akun CUAC dan tidak memberikan peran universitas atau internal.", "Tindakan ini hanya mengubah kelayakan akaun CUAC dan tidak memberikan peranan universiti atau dalaman.", "يغيّر هذا الإجراء بيانات اعتماد حساب CUAC فقط ولا يمنح أدوار الجامعة أو الأدوار الداخلية."],
  ["Checking this secure link...", "Đang kiểm tra liên kết bảo mật...", "กำลังตรวจสอบลิงก์ที่ปลอดภัย...", "Memeriksa tautan aman...", "Menyemak pautan selamat...", "جارٍ التحقق من الرابط الآمن..."],
  ["This link is incomplete or invalid. Request a new link from the CUAC sign-in page.", "Liên kết không đầy đủ hoặc không hợp lệ. Hãy yêu cầu liên kết mới từ trang đăng nhập CUAC.", "ลิงก์ไม่สมบูรณ์หรือไม่ถูกต้อง โปรดขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ CUAC", "Tautan tidak lengkap atau tidak valid. Minta tautan baru dari halaman masuk CUAC.", "Pautan tidak lengkap atau tidak sah. Minta pautan baharu dari halaman log masuk CUAC.", "الرابط غير مكتمل أو غير صالح. اطلب رابطًا جديدًا من صفحة تسجيل الدخول إلى CUAC."],
  ["Confirm below to verify the email address linked to this CUAC account.", "Xác nhận bên dưới để xác minh email liên kết với tài khoản CUAC này.", "ยืนยันด้านล่างเพื่อยืนยันอีเมลที่เชื่อมกับบัญชี CUAC นี้", "Konfirmasi di bawah untuk memverifikasi email yang terhubung ke akun CUAC ini.", "Sahkan di bawah untuk mengesahkan e-mel yang dipautkan kepada akaun CUAC ini.", "أكد أدناه للتحقق من البريد الإلكتروني المرتبط بحساب CUAC هذا."],
  ["Choose a new password with at least 15 characters.", "Chọn mật khẩu mới có ít nhất 15 ký tự.", "เลือกรหัสผ่านใหม่อย่างน้อย 15 ตัวอักษร", "Pilih kata sandi baru minimal 15 karakter.", "Pilih kata laluan baharu sekurang-kurangnya 15 aksara.", "اختر كلمة مرور جديدة من 15 حرفًا على الأقل."],
  ["Verifying your email...", "Đang xác minh email...", "กำลังยืนยันอีเมล...", "Memverifikasi email...", "Mengesahkan e-mel...", "جارٍ التحقق من البريد الإلكتروني..."],
  ["Your email address is verified. You can continue to CUAC.", "Email đã được xác minh. Bạn có thể tiếp tục vào CUAC.", "ยืนยันอีเมลแล้ว คุณสามารถดำเนินการต่อไปยัง CUAC", "Alamat email terverifikasi. Anda dapat melanjutkan ke CUAC.", "Alamat e-mel disahkan. Anda boleh meneruskan ke CUAC.", "تم التحقق من بريدك الإلكتروني. يمكنك المتابعة إلى CUAC."],
  ["Email verification could not be completed.", "Không thể hoàn tất xác minh email.", "ไม่สามารถยืนยันอีเมลให้เสร็จสิ้นได้", "Verifikasi email tidak dapat diselesaikan.", "Pengesahan e-mel tidak dapat diselesaikan.", "تعذر إكمال التحقق من البريد الإلكتروني."],
  ["Use at least 15 characters for the new password.", "Mật khẩu mới phải có ít nhất 15 ký tự.", "ใช้รหัสผ่านใหม่อย่างน้อย 15 ตัวอักษร", "Gunakan minimal 15 karakter untuk kata sandi baru.", "Gunakan sekurang-kurangnya 15 aksara untuk kata laluan baharu.", "استخدم 15 حرفًا على الأقل لكلمة المرور الجديدة."],
  ["The two password entries do not match.", "Hai mật khẩu không khớp.", "รหัสผ่านทั้งสองรายการไม่ตรงกัน", "Kedua kata sandi tidak cocok.", "Kedua-dua kata laluan tidak sepadan.", "إدخالا كلمة المرور غير متطابقين."],
  ["Updating your password and revoking existing sessions...", "Đang cập nhật mật khẩu và thu hồi các phiên hiện có...", "กำลังอัปเดตรหัสผ่านและเพิกถอนเซสชันเดิม...", "Memperbarui kata sandi dan mencabut sesi yang ada...", "Mengemas kini kata laluan dan membatalkan sesi sedia ada...", "جارٍ تحديث كلمة المرور وإلغاء الجلسات الحالية..."],
  ["Your password has been updated. Sign in again with the new password.", "Mật khẩu đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu mới.", "อัปเดตรหัสผ่านแล้ว โปรดเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่", "Kata sandi telah diperbarui. Masuk kembali dengan kata sandi baru.", "Kata laluan telah dikemas kini. Log masuk semula dengan kata laluan baharu.", "تم تحديث كلمة المرور. سجّل الدخول مجددًا بكلمة المرور الجديدة."],
  ["The password could not be updated.", "Không thể cập nhật mật khẩu.", "ไม่สามารถอัปเดตรหัสผ่านได้", "Kata sandi tidak dapat diperbarui.", "Kata laluan tidak dapat dikemas kini.", "تعذر تحديث كلمة المرور."],
  ["Verify email", "Xác minh email", "ยืนยันอีเมล", "Verifikasi email", "Sahkan e-mel", "التحقق من البريد"],
  ["Verifying...", "Đang xác minh...", "กำลังยืนยัน...", "Memverifikasi...", "Mengesahkan...", "جارٍ التحقق..."],
  ["New password", "Mật khẩu mới", "รหัสผ่านใหม่", "Kata sandi baru", "Kata laluan baharu", "كلمة المرور الجديدة"],
  ["Confirm new password", "Xác nhận mật khẩu mới", "ยืนยันรหัสผ่านใหม่", "Konfirmasi kata sandi baru", "Sahkan kata laluan baharu", "تأكيد كلمة المرور الجديدة"],
  ["Updating password...", "Đang cập nhật mật khẩu...", "กำลังอัปเดตรหัสผ่าน...", "Memperbarui kata sandi...", "Mengemas kini kata laluan...", "جارٍ تحديث كلمة المرور..."],
  ["Update password", "Cập nhật mật khẩu", "อัปเดตรหัสผ่าน", "Perbarui kata sandi", "Kemas kini kata laluan", "تحديث كلمة المرور"],
  ["Return to sign in", "Quay lại đăng nhập", "กลับไปเข้าสู่ระบบ", "Kembali masuk", "Kembali ke log masuk", "العودة إلى تسجيل الدخول"],
  ["For your security, the link credentials were removed from the address bar and are not stored in this browser.", "Để bảo mật, thông tin xác thực trong liên kết đã được xóa khỏi thanh địa chỉ và không được lưu trong trình duyệt.", "เพื่อความปลอดภัย ข้อมูลรับรองในลิงก์ถูกลบออกจากแถบที่อยู่และไม่ได้เก็บในเบราว์เซอร์", "Demi keamanan, kredensial tautan telah dihapus dari bilah alamat dan tidak disimpan di browser.", "Demi keselamatan, kelayakan pautan telah dialih keluar dari bar alamat dan tidak disimpan dalam pelayar.", "لأمانك، أُزيلت بيانات اعتماد الرابط من شريط العنوان ولم تُحفظ في هذا المتصفح."],
  ["This secure link could not be used.", "Không thể sử dụng liên kết bảo mật này.", "ไม่สามารถใช้ลิงก์ที่ปลอดภัยนี้ได้", "Tautan aman ini tidak dapat digunakan.", "Pautan selamat ini tidak dapat digunakan.", "تعذر استخدام هذا الرابط الآمن."],
  ["Email verification challenge is not available.", "Yêu cầu xác minh email không còn khả dụng.", "คำขอยืนยันอีเมลไม่พร้อมใช้งาน", "Tantangan verifikasi email tidak tersedia.", "Cabaran pengesahan e-mel tidak tersedia.", "طلب التحقق من البريد غير متاح."],
  ["Email verification challenge has already been consumed.", "Liên kết xác minh email đã được sử dụng.", "ลิงก์ยืนยันอีเมลถูกใช้แล้ว", "Tautan verifikasi email telah digunakan.", "Pautan pengesahan e-mel telah digunakan.", "تم استخدام رابط التحقق من البريد مسبقًا."],
  ["Password reset challenge is not available.", "Yêu cầu đặt lại mật khẩu không còn khả dụng.", "คำขอรีเซ็ตรหัสผ่านไม่พร้อมใช้งาน", "Tantangan reset kata sandi tidak tersedia.", "Cabaran tetapan semula kata laluan tidak tersedia.", "طلب إعادة تعيين كلمة المرور غير متاح."],
  ["Password reset challenge has already been consumed.", "Liên kết đặt lại mật khẩu đã được sử dụng.", "ลิงก์รีเซ็ตรหัสผ่านถูกใช้แล้ว", "Tautan reset kata sandi telah digunakan.", "Pautan tetapan semula kata laluan telah digunakan.", "تم استخدام رابط إعادة تعيين كلمة المرور مسبقًا."],
];

const localeIndex: Record<AuthLocale, number> = { en: 0, vi: 1, th: 2, id: 3, ms: 4, ar: 5 };
const aliases: Record<string, AuthLocale> = { en: "en", vi: "vi", th: "th", id: "id", ms: "ms", ar: "ar" };

function resolveLocale(): AuthLocale {
  const requested = new URLSearchParams(window.location.search).get("lang")?.toLowerCase().split("-")[0] || "";
  if (aliases[requested]) return aliases[requested];
  for (const language of navigator.languages || [navigator.language]) {
    const normalized = language.toLowerCase().split("-")[0];
    if (aliases[normalized]) return aliases[normalized];
  }
  return "en";
}

function translate(locale: AuthLocale, value: string): string {
  const row = copyRows.find(candidate => candidate[0] === value);
  return row?.[localeIndex[locale]] || value;
}

function localeHref(locale: AuthLocale, path: string): string {
  if (locale === "en") return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function AuthActionClient({ kind }: { kind: ActionKind }) {
  const credentialRef = useRef<{ challenge: string; token: string } | null>(null);
  const initializedRef = useRef(false);
  const [locale, setLocale] = useState<AuthLocale>("en");
  const [state, setState] = useState<ActionState>("loading");
  const [message, setMessage] = useState("Checking this secure link...");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const resolvedLocale = resolveLocale();
    setLocale(resolvedLocale);
    document.documentElement.lang = resolvedLocale;
    document.documentElement.dir = localeMeta[resolvedLocale].dir;
    document.title = `${translate(resolvedLocale, kind === "verify" ? "Verify your email" : "Set a new password")} | CUAC`;
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const challenge = parameters.get("challenge") || "";
    const token = parameters.get("token") || "";
    parameters.delete("challenge");
    parameters.delete("token");

    if (!isValidChallenge(challenge) || !isValidToken(token)) {
      queueMicrotask(() => {
        setState("invalid");
        setMessage("This link is incomplete or invalid. Request a new link from the CUAC sign-in page.");
      });
      return;
    }

    credentialRef.current = { challenge, token };
    queueMicrotask(() => {
      setState("ready");
      setMessage(kind === "verify"
        ? "Confirm below to verify the email address linked to this CUAC account."
        : "Choose a new password with at least 15 characters.");
    });
  }, [kind]);

  async function submitVerification() {
    const credential = credentialRef.current;
    if (!credential || state === "submitting") return;
    setState("submitting");
    setMessage("Verifying your email...");
    try {
      await postAuthAction(`/api/v1/auth/email-verification/${encodeURIComponent(credential.challenge)}/verify`, {
        verificationToken: credential.token,
      });
      credentialRef.current = null;
      setState("success");
      setMessage("Your email address is verified. You can continue to CUAC.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Email verification could not be completed.");
    }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credential = credentialRef.current;
    if (!credential || state === "submitting") return;
    if (newPassword.length < 15) {
      setState("error");
      setMessage("Use at least 15 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setState("error");
      setMessage("The two password entries do not match.");
      return;
    }

    setState("submitting");
    setMessage("Updating your password and revoking existing sessions...");
    try {
      await postAuthAction(`/api/v1/auth/password-reset/${encodeURIComponent(credential.challenge)}/reset`, {
        resetToken: credential.token,
        newPassword,
      });
      credentialRef.current = null;
      setNewPassword("");
      setConfirmPassword("");
      setState("success");
      setMessage("Your password has been updated. Sign in again with the new password.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The password could not be updated.");
    }
  }

  const disabled = state === "loading" || state === "invalid" || state === "submitting" || state === "success";

  return (
    <div className={styles.shell} dir={localeMeta[locale].dir} lang={locale}>
      <header className={styles.header}>
        <a className={styles.brand} href={localeHref(locale, "/home-v3.html")} aria-label={translate(locale, "CUAC home")}>
          <span className={styles.mark}>CU</span>
          <span>CUAC</span>
        </a>
        <a className={styles.signInLink} href={localeHref(locale, "/auth.html")}>{translate(locale, "Sign in")}</a>
      </header>

      <main className={styles.main}>
        <section className={styles.actionPanel} aria-labelledby="auth-action-title">
          <p className={styles.eyebrow}>{translate(locale, kind === "verify" ? "Account verification" : "Account recovery")}</p>
          <h1 id="auth-action-title">{translate(locale, kind === "verify" ? "Verify your email" : "Set a new password")}</h1>
          <p className={styles.lead}>{translate(locale, "This action changes only your CUAC account credentials. It does not grant school or internal roles.")}</p>

          <div className={styles.status} data-state={state} role="status" aria-live="polite">
            <span className={styles.statusMark} aria-hidden="true" />
            <p>{translate(locale, message)}</p>
          </div>

          {kind === "verify" ? (
            <button className={styles.primary} type="button" disabled={disabled} onClick={() => void submitVerification()}>
              {translate(locale, state === "submitting" ? "Verifying..." : "Verify email")}
            </button>
          ) : (
            <form className={styles.form} onSubmit={(event) => void submitPasswordReset(event)}>
              <label>
                <span>{translate(locale, "New password")}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={15}
                  required
                  disabled={disabled}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                <span>{translate(locale, "Confirm new password")}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={15}
                  required
                  disabled={disabled}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className={styles.primary} type="submit" disabled={disabled}>
                {translate(locale, state === "submitting" ? "Updating password..." : "Update password")}
              </button>
            </form>
          )}

          {(state === "success" || state === "invalid") && (
            <a className={styles.secondary} href={localeHref(locale, "/auth.html")}>{translate(locale, "Return to sign in")}</a>
          )}

          <p className={styles.securityNote}>{translate(locale, "For your security, the link credentials were removed from the address bar and are not stored in this browser.")}</p>
        </section>
      </main>
    </div>
  );
}

async function postAuthAction(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "This secure link could not be used.");
  return payload?.data;
}

function isValidChallenge(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
