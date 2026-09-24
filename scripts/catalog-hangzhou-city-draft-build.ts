import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const acquisitionRoot = resolve(process.cwd(), "work/catalog-official");
const prefix = resolve(process.cwd(), "seeds/catalog.hangzhou-city-rich-batch-01");
const requiredSourceIds = ["hangzhou-statistical-communique-index", "hangzhou-international-living-portal", "hangzhou-economic-update-h1-2025", "hangzhou-zju-accommodation-current"] as const;
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
const primary = source("hangzhou-economic-update-h1-2025");
const generatedAt = new Date().toISOString();
const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Hangzhou is Zhejiang's capital and a major digital-economy and higher-education centre. The acquired 2025 first-half official update reports GDP of CNY 1.1303 trillion, up 5.5% year on year.", budget: "Current official cost evidence is limited to Zhejiang University accommodation. For selected Zijingang room types, a per-student equivalent derived from whole-room annual prices is about CNY 1,000–2,500 per month.", arrival: "Use Hangzhou's official international living portal for current municipal services and confirm campus registration steps with the university." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Hàng Châu là thủ phủ Chiết Giang và là trung tâm kinh tế số, giáo dục đại học lớn. Bản cập nhật chính thức nửa đầu năm 2025 ghi nhận GDP 1,1303 nghìn tỷ CNY, tăng 5,5% so với cùng kỳ.", budget: "Dữ liệu chi phí chính thức hiện chỉ gồm chỗ ở Đại học Chiết Giang. Với một số loại phòng tại Zijingang, mức quy đổi mỗi sinh viên từ giá cả phòng theo năm khoảng 1.000–2.500 CNY/tháng.", arrival: "Hãy dùng cổng dịch vụ quốc tế chính thức của Hàng Châu và xác nhận thủ tục nhập học với trường." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "หางโจวเป็นเมืองเอกของเจ้อเจียงและศูนย์กลางเศรษฐกิจดิจิทัลและอุดมศึกษา ข้อมูลทางการครึ่งแรกปี 2025 ระบุ GDP 1.1303 ล้านล้านหยวน เพิ่มขึ้น 5.5% จากปีก่อน", budget: "หลักฐานค่าใช้จ่ายทางการปัจจุบันจำกัดเฉพาะที่พักมหาวิทยาลัยเจ้อเจียง อัตราต่อคนที่คำนวณจากราคาห้องทั้งห้องรายปีสำหรับบางประเภทที่จื่อจินกั่งอยู่ที่ประมาณ 1,000–2,500 หยวนต่อเดือน", arrival: "ใช้พอร์ทัลบริการนานาชาติทางการของหางโจวและยืนยันขั้นตอนลงทะเบียนกับมหาวิทยาลัย" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Hangzhou adalah ibu kota Zhejiang dan pusat ekonomi digital serta pendidikan tinggi. Pembaruan resmi semester pertama 2025 mencatat PDB CNY 1,1303 triliun, naik 5,5% tahunan.", budget: "Bukti biaya resmi saat ini hanya mencakup akomodasi Zhejiang University. Untuk jenis kamar Zijingang tertentu, ekuivalen per mahasiswa dari harga kamar tahunan sekitar CNY 1.000–2.500 per bulan.", arrival: "Gunakan portal layanan internasional resmi Hangzhou dan konfirmasikan langkah registrasi kampus kepada universitas." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Hangzhou ialah ibu negeri Zhejiang dan pusat ekonomi digital serta pengajian tinggi. Kemas kini rasmi separuh pertama 2025 melaporkan KDNK CNY 1.1303 trilion, meningkat 5.5% tahun ke tahun.", budget: "Bukti kos rasmi semasa hanya meliputi penginapan Universiti Zhejiang. Bagi jenis bilik Zijingang terpilih, nilai setara setiap pelajar daripada harga tahunan seluruh bilik ialah kira-kira CNY 1,000–2,500 sebulan.", arrival: "Gunakan portal kehidupan antarabangsa rasmi Hangzhou dan sahkan langkah pendaftaran kampus dengan universiti." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "هانغتشو عاصمة تشجيانغ ومركز رئيسي للاقتصاد الرقمي والتعليم العالي. ويفيد التحديث الرسمي للنصف الأول من 2025 بأن الناتج المحلي بلغ 1.1303 تريليون يوان، بزيادة 5.5% سنويًا.", budget: "تقتصر أدلة التكلفة الرسمية الحالية على سكن جامعة تشجيانغ. ويبلغ المعادل لكل طالب، المشتق من أسعار الغرفة الكاملة السنوية لأنواع مختارة في حرم تسيجينغانغ، نحو 1,000–2,500 يوان شهريًا.", arrival: "استخدم بوابة هانغتشو الرسمية للخدمات الدولية وأكد إجراءات التسجيل مع الجامعة." },
].map(row => ({ locale: row.locale, direction: row.direction, translationState: row.translationState, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));
const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "hangzhou", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  acquisitionExceptions: [{ sourceId: "hangzhou-zju-freshmen-guide-2024", state: "not_acquired", reason: "Official PDF returned HTTP 403; no access-control bypass was attempted." }],
  facts: [
    { factType: "gross_domestic_product_h1", value: 11303, unit: "CNY 100 million", observedAt: "2025-06-30", derivation: "explicit", evidenceId: "hangzhou-economic-update-h1-2025", sourcePath: "First-half headline indicators", reviewState: "pending" },
    { factType: "gross_domestic_product_growth_h1", value: 5.5, unit: "percent year-on-year", observedAt: "2025-06-30", derivation: "explicit", evidenceId: "hangzhou-economic-update-h1-2025", sourcePath: "First-half headline indicators", reviewState: "pending" },
    { factType: "zju_zijingang_twin_room", value: 36000, unit: "CNY/academic-year/room", observedAt: "2023-01-01", derivation: "explicit", evidenceId: "hangzhou-zju-accommodation-current", sourcePath: "Zijingang long-term room table", reviewState: "pending" },
    { factType: "zju_zijingang_four_person_room", value: 48000, unit: "CNY/academic-year/room", observedAt: "2023-01-01", derivation: "explicit", evidenceId: "hangzhou-zju-accommodation-current", sourcePath: "Zijingang long-term room table", reviewState: "pending" },
    { factType: "zju_zijingang_twin_suite", value: 60000, unit: "CNY/academic-year/suite", observedAt: "2023-01-01", derivation: "explicit", evidenceId: "hangzhou-zju-accommodation-current", sourcePath: "Zijingang long-term room table", reviewState: "pending" },
    { factType: "zju_zijingang_four_person_suite", value: 66000, unit: "CNY/academic-year/suite", observedAt: "2023-01-01", derivation: "explicit", evidenceId: "hangzhou-zju-accommodation-current", sourcePath: "Zijingang long-term room table", reviewState: "pending" },
  ],
  costSnapshots: [{ persona: "zju_zijingang_on_campus_accommodation_only", monthlyMinimum: 1000, monthlyComfortable: 2500, currency: "CNY", observedFrom: "2023-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 4, methodologyVersion: "hangzhou-accommodation-v1", method: "Whole-room annual rates divided by stated occupancy, then by 12 months: four-person room CNY 48,000/4/12 through twin suite CNY 60,000/2/12.", evidenceIds: ["hangzhou-zju-accommodation-current"], exclusions: ["water", "electricity", "bedding", "food", "transport", "personal expenses", "tuition"], reviewState: "pending" }],
  contentDrafts: translations,
  unresolved: ["Acquire a current exact annual Hangzhou statistical communique; the current index is dynamic and the draft uses a 2025 half-year update.", "No population or higher-education-scale fact is included until a primary official page is acquired.", "The ZJU accommodation profile is campus- and room-scoped, not a city-wide budget.", "The registered 2024 freshmen guide returned HTTP 403."],
};
const city = {
  slug: "hangzhou", nameEn: "Hangzhou", nameZh: "杭州", province: "Zhejiang", region: "East China",
  monthlyCost: "CUAC draft ZJU Zijingang accommodation-only equivalent: CNY 1,000-2,500/month per student; utilities and all other costs excluded",
  tags: ["provincial-capital", "digital-economy-centre", "higher-education-centre", "metro-city"], nearby: ["shanghai", "ningbo", "shaoxing"], sortOrder: 4,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Hangzhou is Zhejiang's capital and a digital-economy and higher-education centre. The draft is intentionally incomplete and pending review.",
    overview: "The acquired 2025 first-half official update reports GDP of CNY 1.1303 trillion, up 5.5% year on year.",
    bestFor: ["Zhejiang University routes", "Digital-economy setting", "Yangtze River Delta access"],
    quickFacts: [{ label: "2025 first-half GDP", value: "CNY 1.1303 trillion", note: "Official half-year update" }, { label: "Growth", value: "5.5% year on year", note: "Official half-year update" }],
    budgetSummary: { monthly: "Accommodation-only equivalent: CNY 1,000-2,500", yearly: null, note: "Selected ZJU Zijingang shared room types; not a complete budget." },
    costProfiles: [{ label: "ZJU Zijingang accommodation", value: "CNY 1,000-2,500/month per-student equivalent", note: "Derived from whole-room annual rates and stated occupancy." }],
    why: [{ title: "University and innovation setting", body: "Hangzhou combines Zhejiang University routes with a large digital-economy ecosystem." }],
    costBreakdown: [{ label: "Selected Zijingang rooms", value: "CNY 36,000-66,000/academic year per room or suite", note: "Occupancy and room type vary; utilities excluded." }],
    lifeSections: [{ title: "International services", body: "The official Hangzhou international living portal is retained as the municipal service entry point." }],
    transportNotes: [], applicationTips: ["Confirm exact campus, room type, occupancy and current rate before budgeting."], applicationAdvice: [], relatedProgramKeywords: ["engineering", "computer science", "business", "medicine", "Chinese language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Hangzhou programs and confirm the exact campus and intake." }],
    faqs: [{ question: "Is this a complete Hangzhou student budget?", answer: "No. Current cost evidence covers selected Zhejiang University accommodation only." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "Hangzhou official statistical and international portals", nameZh: "Hangzhou official statistical portal", province: "official municipal scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "hangzhou-zju-accommodation-current; derived in evidence costSnapshots", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.hangzhou-city-rich-batch-01.evidence.json" },
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
