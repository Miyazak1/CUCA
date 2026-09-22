import { PUBLIC_UI_LOCALES, normalizeUiLocale, type PublicUiLocale, uiLocaleDirection } from "../i18n/locales.ts";
import type { AuthEmailMessageType } from "./email-delivery.ts";

type StudentEmailType = Exclude<AuthEmailMessageType, "auth.school_staff_invite">;

type SharedCopy = { expires: string; ignore: string };
type PurposeCopy = { subject: string; action: string };

const shared: Record<PublicUiLocale, SharedCopy> = {
  en: { expires: "This secure link expires at", ignore: "If you did not request this, you can ignore this email." },
  vi: { expires: "Liên kết bảo mật này hết hạn lúc", ignore: "Nếu bạn không yêu cầu thao tác này, bạn có thể bỏ qua email này." },
  th: { expires: "ลิงก์ที่ปลอดภัยนี้จะหมดอายุเวลา", ignore: "หากคุณไม่ได้ส่งคำขอนี้ คุณสามารถเพิกเฉยต่ออีเมลฉบับนี้ได้" },
  id: { expires: "Tautan aman ini kedaluwarsa pada", ignore: "Jika Anda tidak meminta ini, Anda dapat mengabaikan email ini." },
  ms: { expires: "Pautan selamat ini tamat tempoh pada", ignore: "Jika anda tidak membuat permintaan ini, anda boleh mengabaikan e-mel ini." },
  ar: { expires: "تنتهي صلاحية هذا الرابط الآمن في", ignore: "إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذه الرسالة." },
};

const purposes: Record<StudentEmailType, Record<PublicUiLocale, PurposeCopy>> = {
  "auth.email_verification": {
    en: { subject: "Verify your CUAC email", action: "Verify email" },
    vi: { subject: "Xác minh email CUAC của bạn", action: "Xác minh email" },
    th: { subject: "ยืนยันอีเมล CUAC ของคุณ", action: "ยืนยันอีเมล" },
    id: { subject: "Verifikasi email CUAC Anda", action: "Verifikasi email" },
    ms: { subject: "Sahkan e-mel CUAC anda", action: "Sahkan e-mel" },
    ar: { subject: "تحقق من بريدك الإلكتروني في CUAC", action: "تحقق من البريد الإلكتروني" },
  },
  "auth.password_reset": {
    en: { subject: "Reset your CUAC password", action: "Reset password" },
    vi: { subject: "Đặt lại mật khẩu CUAC của bạn", action: "Đặt lại mật khẩu" },
    th: { subject: "รีเซ็ตรหัสผ่าน CUAC ของคุณ", action: "รีเซ็ตรหัสผ่าน" },
    id: { subject: "Atur ulang kata sandi CUAC Anda", action: "Atur ulang kata sandi" },
    ms: { subject: "Tetapkan semula kata laluan CUAC anda", action: "Tetapkan semula kata laluan" },
    ar: { subject: "إعادة تعيين كلمة مرور CUAC", action: "إعادة تعيين كلمة المرور" },
  },
  "auth.guardian_consent": {
    en: { subject: "Review a CUAC child account request", action: "Review child account request" },
    vi: { subject: "Xem xét yêu cầu tài khoản trẻ em CUAC", action: "Xem xét yêu cầu tài khoản" },
    th: { subject: "ตรวจสอบคำขอบัญชีเด็ก CUAC", action: "ตรวจสอบคำขอบัญชีเด็ก" },
    id: { subject: "Tinjau permintaan akun anak CUAC", action: "Tinjau permintaan akun anak" },
    ms: { subject: "Semak permintaan akaun kanak-kanak CUAC", action: "Semak permintaan akaun kanak-kanak" },
    ar: { subject: "مراجعة طلب حساب طفل في CUAC", action: "مراجعة طلب حساب الطفل" },
  },
};

export function normalizeAuthEmailLocale(value: unknown): PublicUiLocale {
  const locale = normalizeUiLocale(value);
  return locale && PUBLIC_UI_LOCALES.includes(locale as PublicUiLocale) ? locale as PublicUiLocale : "en";
}

export function authEmailCopy(messageType: AuthEmailMessageType, value: unknown) {
  if (messageType === "auth.school_staff_invite") {
    return { locale: "en" as const, direction: "ltr" as const, subject: "Activate your CUAC school account",
      action: "Activate school account", ...shared.en };
  }
  const locale = normalizeAuthEmailLocale(value);
  return { locale, direction: uiLocaleDirection(locale), ...purposes[messageType][locale], ...shared[locale] };
}
