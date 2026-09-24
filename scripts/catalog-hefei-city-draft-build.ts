import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const acquisitionRoot = resolve(process.cwd(), "work/catalog-official");
const prefix = resolve(process.cwd(), "seeds/catalog.hefei-city-rich-batch-01");
const requiredSourceIds = ["hefei-hksar-mainland-living-guide-2025", "hefei-ustc-accommodation-registration-2026", "hefei-ustc-nondegree-cost-reference"] as const;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
async function latestSnapshots() {
  const latest = new Map<string, SourceRow>();
  for (const entry of await readdir(acquisitionRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(resolve(acquisitionRoot, entry.name, "manifest.json"), "utf8"));
      for (const row of manifest.sources || []) {
        const previous = latest.get(row.id);
        if (!previous || Date.parse(row.fetchedAt) > Date.parse(previous.fetchedAt)) latest.set(row.id, row);
      }
    } catch { /* Ignore incomplete acquisition directories. */ }
  }
  return latest;
}
const snapshots = await latestSnapshots();
for (const id of requiredSourceIds) if (!snapshots.has(id)) throw new Error("Missing acquired source " + id + ".");
const source = (id: typeof requiredSourceIds[number]) => snapshots.get(id)!;
const primary = source("hefei-hksar-mainland-living-guide-2025");
const generatedAt = new Date().toISOString();

const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Hefei is the capital of Anhui and a major science and higher-education centre. A 2025 Hong Kong SAR Government guide citing Hefei's 2024 official communique reports 10.002 million residents and 86.38% urbanization.", budget: "Current school evidence covers USTC accommodation only: CNY 500–1,000 per month. The source page is maintained online but its programme wording is old, so the amount must be reconfirmed.", arrival: "USTC's 2026 Hefei guide says non-hotel residents must register accommodation with local public security within 24 hours of arrival." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Hợp Phì là thủ phủ An Huy và trung tâm khoa học, giáo dục đại học lớn. Cẩm nang năm 2025 của Chính quyền Hồng Kông dẫn thông cáo chính thức năm 2024, ghi nhận 10,002 triệu dân và đô thị hóa 86,38%.", budget: "Dữ liệu cấp trường hiện chỉ gồm chỗ ở USTC: 500–1.000 CNY/tháng. Nội dung chương trình của nguồn đã cũ nên phải xác nhận lại trước khi công bố.", arrival: "Hướng dẫn USTC năm 2026 yêu cầu người không ở khách sạn đăng ký lưu trú với công an địa phương trong vòng 24 giờ sau khi đến." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "เหอเฝย์เป็นเมืองเอกของอันฮุยและศูนย์กลางวิทยาศาสตร์และอุดมศึกษา คู่มือรัฐบาลฮ่องกงปี 2025 ที่อ้างอิงแถลงการณ์ทางการปี 2024 ระบุประชากร 10.002 ล้านคนและอัตราความเป็นเมือง 86.38%", budget: "ข้อมูลระดับมหาวิทยาลัยในปัจจุบันมีเฉพาะที่พัก USTC ที่ 500–1,000 หยวนต่อเดือน และต้องยืนยันราคาอีกครั้งก่อนเผยแพร่เพราะข้อความโครงการในแหล่งข้อมูลค่อนข้างเก่า", arrival: "คู่มือ USTC ปี 2026 กำหนดให้ผู้ที่ไม่ได้พักในโรงแรมลงทะเบียนที่พักกับตำรวจท้องถิ่นภายใน 24 ชั่วโมงหลังเดินทางถึง" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Hefei adalah ibu kota Anhui dan pusat sains serta pendidikan tinggi. Panduan Pemerintah Hong Kong 2025 yang mengutip komunike resmi 2024 mencatat 10,002 juta penduduk dan urbanisasi 86,38%.", budget: "Data tingkat kampus saat ini hanya mencakup akomodasi USTC: CNY 500–1.000 per bulan. Nominal harus dikonfirmasi ulang karena redaksi program pada sumber sudah lama.", arrival: "Panduan USTC 2026 mewajibkan penghuni di luar hotel mendaftarkan akomodasi kepada keamanan publik setempat dalam 24 jam setelah tiba." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Hefei ialah ibu negeri Anhui serta pusat sains dan pengajian tinggi. Panduan Kerajaan Hong Kong 2025 yang memetik komunike rasmi 2024 melaporkan 10.002 juta penduduk dan pembandaran 86.38%.", budget: "Data peringkat universiti kini hanya meliputi penginapan USTC: CNY 500–1,000 sebulan. Angka perlu disahkan semula kerana teks program sumber itu lama.", arrival: "Panduan USTC 2026 mewajibkan penghuni di luar hotel mendaftarkan penginapan dengan keselamatan awam tempatan dalam 24 jam selepas tiba." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "خفي عاصمة آنهوي ومركز رئيسي للعلوم والتعليم العالي. ويورد دليل حكومة هونغ كونغ لعام 2025، استنادًا إلى البيان الرسمي لعام 2024، عدد سكان يبلغ 10.002 مليون نسمة ونسبة تحضر 86.38%.", budget: "تغطي بيانات الجامعة الحالية سكن جامعة العلوم والتكنولوجيا الصينية فقط بسعر 500–1,000 يوان شهريًا. ويجب إعادة تأكيد المبلغ لأن صياغة البرنامج في المصدر قديمة.", arrival: "يلزم دليل الجامعة لعام 2026 المقيمين خارج الفنادق بتسجيل السكن لدى الأمن العام المحلي خلال 24 ساعة من الوصول." },
].map(row => ({ locale: row.locale, direction: row.direction, translationState: row.translationState, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));

const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "hefei", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  facts: [
    { factType: "resident_population", value: 10.002, unit: "million people", observedAt: "2024-12-31", derivation: "quoted_secondary_official", evidenceId: "hefei-hksar-mainland-living-guide-2025", sourcePath: "Hefei overview; guide cites Hefei 2024 official communique", reviewState: "pending" },
    { factType: "resident_urbanization_rate", value: 86.38, unit: "percent", observedAt: "2024-12-31", derivation: "quoted_secondary_official", evidenceId: "hefei-hksar-mainland-living-guide-2025", sourcePath: "Hefei overview; guide cites Hefei 2024 official communique", reviewState: "pending" },
    { factType: "temporary_accommodation_registration", value: 24, unit: "hours after arrival", observedAt: "2026-09-08", derivation: "explicit", evidenceId: "hefei-ustc-accommodation-registration-2026", sourcePath: "Policy Requirements", reviewState: "pending" },
    { factType: "ustc_on_campus_accommodation", value: { minimum: 500, maximum: 1000 }, unit: "CNY/month", observedAt: null, derivation: "explicit_but_undated", evidenceId: "hefei-ustc-nondegree-cost-reference", sourcePath: "Expenses, accommodation", reviewState: "pending" },
    { factType: "ustc_international_student_insurance", value: 800, unit: "CNY/academic-year", observedAt: null, derivation: "explicit_but_undated", evidenceId: "hefei-ustc-nondegree-cost-reference", sourcePath: "Expenses, insurance", reviewState: "pending" },
  ],
  costSnapshots: [{ persona: "ustc_on_campus_accommodation_only", monthlyMinimum: 500, monthlyComfortable: 1000, currency: "CNY", observedFrom: null, observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "hefei-accommodation-v1", method: "USTC published monthly dormitory range by room type and size; source page is live but programme wording is old.", evidenceIds: ["hefei-ustc-nondegree-cost-reference"], exclusions: ["food", "utilities", "transport", "personal expenses", "tuition", "insurance"], reviewState: "pending" }],
  contentDrafts: translations,
  unresolved: ["Acquire the exact Hefei Statistics Bureau 2024 or 2025 communique before publication.", "The USTC accommodation amount is undated and must be reconfirmed.", "No complete city-wide student budget, public-transport fare or utilities profile has been acquired."],
};

const city = {
  slug: "hefei", nameEn: "Hefei", nameZh: "合肥", province: "Anhui", region: "East China",
  monthlyCost: "CUAC draft USTC accommodation-only reference: CNY 500-1,000/month; source date unconfirmed and all other costs excluded",
  tags: ["provincial-capital", "science-centre", "higher-education-centre", "yangtze-river-delta"], nearby: ["nanjing", "wuhu", "huangshan"], sortOrder: 10,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Hefei is Anhui's capital and a major science and higher-education centre. All fields remain pending review.",
    overview: "A 2025 HKSAR Government guide citing Hefei's 2024 official communique reports 10.002 million residents and 86.38% urbanization.",
    bestFor: ["Science and engineering routes", "USTC applicants", "Yangtze River Delta access"],
    quickFacts: [{ label: "Resident population", value: "10.002 million at 2024 year end", note: "Official secondary source; primary upgrade pending" }, { label: "Urbanization", value: "86.38%", note: "Official secondary source; review pending" }, { label: "Arrival registration", value: "Within 24 hours outside hotels", note: "USTC 2026 guide" }],
    budgetSummary: { monthly: "Accommodation-only reference: CNY 500-1,000", yearly: null, note: "USTC dormitory range; date unconfirmed; not a full budget." },
    costProfiles: [{ label: "USTC accommodation", value: "CNY 500-1,000/month", note: "Room type and size dependent; reconfirm before use." }],
    why: [{ title: "Science-city setting", body: "Hefei is home to the University of Science and Technology of China and major national science facilities." }],
    costBreakdown: [{ label: "On-campus dormitory", value: "CNY 500-1,000/month", note: "USTC undated maintained page." }],
    lifeSections: [{ title: "Accommodation registration", body: "USTC's 2026 guide requires non-hotel residents to register with local public security within 24 hours." }],
    transportNotes: [], applicationTips: ["Reconfirm dormitory availability, room type and current fee directly with USTC."], applicationAdvice: [], relatedProgramKeywords: ["science", "engineering", "physics", "chemistry", "computer science"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Hefei programs and confirm the intake and official application channel." }],
    faqs: [{ question: "Is this a complete Hefei student budget?", answer: "No. Current official cost evidence covers USTC accommodation only." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "hefei-hksar-mainland-living-guide-2025: city scope", nameZh: "guide title and city scope", province: "official guide scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "hefei-ustc-nondegree-cost-reference; accommodation only", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.hefei-city-rich-batch-01.evidence.json" },
};

const bundle = { version: 1, generatedAt, cities: [city] };
const bundleText = JSON.stringify(bundle, null, 2) + "\n";
const evidenceText = JSON.stringify(evidence, null, 2) + "\n";
const validation = createCatalogMigrationValidationReport(bundle);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await mkdir(dirname(prefix), { recursive: true });
await Promise.all([
  writeFile(prefix + ".draft.json", bundleText, "utf8"),
  writeFile(prefix + ".evidence.json", evidenceText, "utf8"),
  writeFile(prefix + ".validation.json", JSON.stringify({ ...validation, candidateSha256: sha256(bundleText), evidenceSha256: sha256(evidenceText), publicationAuthorized: false }, null, 2) + "\n", "utf8"),
]);
console.log(JSON.stringify({ ok: true, prefix, summary: validation.summary, factCount: evidence.facts.length, localeCount: translations.length, publicationAuthorized: false }, null, 2));
