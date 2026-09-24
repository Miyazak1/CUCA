import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const acquisitionRoot = resolve(root, "work/catalog-official");
const prefix = resolve(root, "seeds/catalog.wuhan-city-rich-batch-01");
const requiredSourceIds = [
  "wuhan-statistical-communique-2025",
  "wuhan-international-services-portal",
  "wuhan-foreign-residence-guide",
  "wuhan-metro-fares",
  "hust-undergraduate-guide-2026",
  "hust-graduate-guide-2026",
] as const;

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function latestSnapshots() {
  const latest = new Map<string, SourceRow>();
  for (const entry of await readdir(acquisitionRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(resolve(acquisitionRoot, entry.name, "manifest.json"), "utf8"));
      for (const source of manifest.sources || []) {
        const existing = latest.get(source.id);
        if (!existing || Date.parse(source.fetchedAt) > Date.parse(existing.fetchedAt)) latest.set(source.id, source);
      }
    } catch { /* ignore incomplete acquisition directories */ }
  }
  return latest;
}

const snapshots = await latestSnapshots();
for (const id of requiredSourceIds) if (!snapshots.has(id)) throw new Error(`Missing acquired source ${id}.`);
const source = (id: typeof requiredSourceIds[number]) => snapshots.get(id)!;
const primary = source("wuhan-statistical-communique-2025");
const generatedAt = new Date().toISOString();

const contentDrafts = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Wuhan is a major higher-education centre in Hubei. The 2025 municipal communique reports 13.8619 million residents, 578 km of rail-transit lines and 518 km of metro operating mileage at year end.", budget: "A HUST-based on-campus student draft is CNY 1,900–3,900 per month, combining published accommodation and living-expense ranges. Tuition is excluded.", transport: "The official metro fare begins at CNY 2 within 4 km and increases by distance.", arrival: "Foreign nationals whose visas require a residence permit should apply to the local exit-entry authority within 30 days of arrival." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Vũ Hán là một trung tâm giáo dục đại học lớn của tỉnh Hồ Bắc. Thông cáo thành phố năm 2025 ghi nhận 13,8619 triệu dân, 578 km tuyến đường sắt đô thị và 518 km quãng đường vận hành tàu điện ngầm vào cuối năm.", budget: "Dự toán sơ bộ cho sinh viên ở trong trường dựa trên dữ liệu HUST là 1.900–3.900 CNY mỗi tháng, kết hợp mức phí chỗ ở và sinh hoạt đã công bố. Chưa gồm học phí.", transport: "Giá vé tàu điện ngầm chính thức bắt đầu từ 2 CNY cho quãng đường trong 4 km và tăng theo khoảng cách.", arrival: "Người nước ngoài có thị thực yêu cầu giấy phép cư trú nên nộp hồ sơ tại cơ quan quản lý xuất nhập cảnh địa phương trong vòng 30 ngày sau khi đến." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "อู่ฮั่นเป็นศูนย์กลางการศึกษาระดับอุดมศึกษาที่สำคัญของมณฑลหูเป่ย์ แถลงการณ์เทศบาลปี 2025 ระบุว่าปลายปีมีประชากร 13.8619 ล้านคน แนวเส้นทางรถไฟในเมือง 578 กิโลเมตร และระยะทางเดินรถไฟใต้ดิน 518 กิโลเมตร", budget: "งบประมาณร่างสำหรับนักศึกษาที่พักในมหาวิทยาลัยซึ่งอ้างอิงข้อมูลของ HUST อยู่ที่ 1,900–3,900 หยวนต่อเดือน โดยรวมช่วงค่าที่พักและค่าครองชีพที่ประกาศแล้ว แต่ไม่รวมค่าเล่าเรียน", transport: "ค่าโดยสารรถไฟใต้ดินอย่างเป็นทางการเริ่มที่ 2 หยวนสำหรับระยะทางไม่เกิน 4 กิโลเมตรและเพิ่มตามระยะทาง", arrival: "ชาวต่างชาติที่วีซ่ากำหนดให้ขอใบอนุญาตพำนักควรยื่นคำขอต่อหน่วยงานตรวจคนเข้าเมืองในท้องถิ่นภายใน 30 วันหลังเดินทางมาถึง" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Wuhan adalah pusat pendidikan tinggi utama di Hubei. Komunike kota 2025 mencatat 13,8619 juta penduduk, 578 km jalur kereta perkotaan, dan 518 km jarak operasi metro pada akhir tahun.", budget: "Rancangan anggaran mahasiswa di kampus berbasis data HUST adalah CNY 1.900–3.900 per bulan, yang menggabungkan kisaran biaya akomodasi dan biaya hidup yang dipublikasikan. Uang kuliah tidak termasuk.", transport: "Tarif resmi metro mulai dari CNY 2 untuk perjalanan hingga 4 km dan naik sesuai jarak.", arrival: "Warga negara asing yang visanya mewajibkan izin tinggal harus mengajukannya ke otoritas keluar-masuk setempat dalam 30 hari setelah tiba." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Wuhan ialah pusat pendidikan tinggi utama di Hubei. Komunike bandar 2025 melaporkan 13.8619 juta penduduk, 578 km laluan rel bandar dan 518 km jarak operasi metro pada akhir tahun.", budget: "Draf belanja pelajar di kampus berdasarkan data HUST ialah CNY 1,900–3,900 sebulan, menggabungkan julat penginapan dan perbelanjaan hidup yang diterbitkan. Yuran pengajian tidak termasuk.", transport: "Tambang rasmi metro bermula pada CNY 2 bagi perjalanan sehingga 4 km dan meningkat mengikut jarak.", arrival: "Warga asing yang visanya memerlukan permit kediaman hendaklah memohon kepada pihak berkuasa keluar-masuk tempatan dalam tempoh 30 hari selepas ketibaan." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "تُعد ووهان مركزًا رئيسيًا للتعليم العالي في مقاطعة هوبي. ووفقًا للبيان البلدي لعام 2025، بلغ عدد السكان 13.8619 مليون نسمة، وبلغ طول خطوط السكك الحضرية 578 كيلومترًا ومسافة تشغيل المترو 518 كيلومترًا في نهاية العام.", budget: "يتراوح تقدير ميزانية الطالب المقيم داخل الحرم، استنادًا إلى بيانات HUST، بين 1,900 و3,900 يوان صيني شهريًا، بجمع نطاقي السكن والمعيشة المنشورين. ولا يشمل ذلك الرسوم الدراسية.", transport: "تبدأ تعرفة المترو الرسمية من يوانين للرحلات حتى 4 كيلومترات وتزداد بحسب المسافة.", arrival: "على الأجنبي الذي تتطلب تأشيرته تصريح إقامة أن يتقدم إلى سلطة الدخول والخروج المحلية خلال 30 يومًا من الوصول." },
].map(draft => ({ ...draft, reviewState: "pending", sections: { overview: draft.overview, budget: draft.budget, transport: draft.transport, arrival: draft.arrival } }));
for (const draft of contentDrafts) { delete (draft as any).overview; delete (draft as any).budget; delete (draft as any).transport; delete (draft as any).arrival; }

const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "wuhan", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  facts: [
    { factType: "resident_population", value: 13.8619, unit: "million people", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "wuhan-statistical-communique-2025", sourcePath: "Section 1, year-end resident population", reviewState: "pending" },
    { factType: "rail_transit_line_length", value: 578, unit: "km", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "wuhan-statistical-communique-2025", sourcePath: "Section 8, transport", reviewState: "pending" },
    { factType: "metro_operating_mileage", value: 518, unit: "km", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "wuhan-statistical-communique-2025", sourcePath: "Section 8, transport", reviewState: "pending" },
    { factType: "graduate_students", value: 225300, unit: "students", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "wuhan-statistical-communique-2025", sourcePath: "Section 9, education", reviewState: "pending" },
    { factType: "undergraduate_and_junior_college_students", value: 1218700, unit: "students", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "wuhan-statistical-communique-2025", sourcePath: "Section 9, education", reviewState: "pending" },
    { factType: "metro_fare", value: { within4Km: 2, currency: "CNY", distanceBased: true }, observedAt: source("wuhan-metro-fares").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "wuhan-metro-fares", sourcePath: "Fare standard", reviewState: "pending" },
    { factType: "hust_undergraduate_accommodation", value: { minimum: 700, maximum: 1200 }, unit: "CNY/month", observedAt: "2026", derivation: "explicit", evidenceId: "hust-undergraduate-guide-2026", sourcePath: "Accommodation", reviewState: "pending" },
    { factType: "hust_graduate_accommodation", value: { minimum: 700, maximum: 1400 }, unit: "CNY/month", observedAt: "2026", derivation: "explicit", evidenceId: "hust-graduate-guide-2026", sourcePath: "Accommodation", reviewState: "pending" },
    { factType: "hust_living_expense", value: { minimum: 1200, maximum: 2500 }, unit: "CNY/month", observedAt: "2026", derivation: "explicit", evidenceId: "hust-graduate-guide-2026", sourcePath: "Other expenses for reference", reviewState: "pending" },
  ],
  costSnapshots: [{ persona: "on_campus_student", monthlyMinimum: 1900, monthlyComfortable: 3900, currency: "CNY", observedFrom: "2026-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "wuhan-cost-v1", method: "HUST published dormitory and living-expense ranges summed by lower and upper bounds; tuition excluded.", evidenceIds: ["hust-undergraduate-guide-2026", "hust-graduate-guide-2026"], reviewState: "pending" }],
  contentDrafts,
  unresolved: ["No defensible official city-wide or off-campus rent range has been acquired.", "Climate facts remain absent until an exact no-login official dataset is registered.", "The cost profile is HUST-scoped and must not be presented as a city-wide market quote."],
};

const city = {
  slug: "wuhan", nameEn: "Wuhan", nameZh: "武汉", province: "Hubei", region: "Central China",
  monthlyCost: "CUAC draft HUST-based on-campus profile: CNY 1,900-3,900/month; tuition excluded",
  tags: ["provincial-capital", "large-student-population", "metro-network"], nearby: ["xiangtan", "huangshi"], sortOrder: 2,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Wuhan is a major Hubei higher-education centre. All figures in this profile remain pending editorial review.",
    overview: "The 2025 municipal communique reports 13.8619 million residents, 578 km of rail-transit lines, 518 km of metro operating mileage, 225,300 graduate students and 1,218,700 undergraduate or junior-college students at year end.",
    bestFor: ["Broad university choice", "Central China transport access", "Large student community"],
    quickFacts: [
      { label: "Resident population", value: "13.8619 million at 2025 year end", note: "Wuhan 2025 statistical communique; review pending" },
      { label: "Rail transit", value: "578 km of lines", note: "Wuhan 2025 statistical communique; review pending" },
      { label: "Metro fare", value: "From CNY 2 within 4 km", note: "Wuhan Development and Reform Commission fare notice; review pending" },
    ],
    budgetSummary: { monthly: "Draft range: CNY 1,900-3,900", yearly: null, note: "HUST-based on-campus profile; excludes tuition and off-campus rent." },
    costProfiles: [{ label: "HUST on-campus reference", value: "CNY 1,900-3,900/month", note: "Accommodation plus the published living-expense range." }],
    why: [{ title: "Student scale", body: "The municipal communique reports more than 1.4 million graduate, undergraduate and junior-college students combined." }],
    costBreakdown: [{ label: "HUST accommodation", value: "CNY 700-1,400/month", note: "Room-dependent school reference." }, { label: "HUST living expense", value: "CNY 1,200-2,500/month", note: "School-published reference." }, { label: "Metro", value: "From CNY 2", note: "Distance-based fare." }],
    lifeSections: [{ title: "Residence formalities", body: "Follow the current visa annotation and local exit-entry instructions; applicable foreign nationals should apply for a residence permit within 30 days of arrival." }],
    transportNotes: [{ title: "Metro fares", body: "The official fare starts at CNY 2 within 4 km and increases in distance bands." }],
    applicationTips: ["Confirm the exact school, campus, room type and intake before using any cost figure."], applicationAdvice: [],
    relatedProgramKeywords: ["engineering", "medicine", "science", "business", "language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Wuhan schools and programs, then confirm the exact intake and official application channel." }],
    faqs: [{ question: "Is this a city-wide cost estimate?", answer: "No. The current draft profile is derived from one university's published accommodation and living-expense references." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "wuhan-statistical-communique-2025: municipal scope", nameZh: "wuhan-statistical-communique-2025: page title", province: "wuhan-statistical-communique-2025 and official Wuhan portal scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "HUST 2026 undergraduate and graduate guides; derived in evidence costSnapshots", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.wuhan-city-rich-batch-01.evidence.json" },
};

const bundle = { version: 1, generatedAt, cities: [city] };
const bundleText = `${JSON.stringify(bundle, null, 2)}\n`;
const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(bundle);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await mkdir(dirname(prefix), { recursive: true });
await Promise.all([
  writeFile(`${prefix}.draft.json`, bundleText, "utf8"),
  writeFile(`${prefix}.evidence.json`, evidenceText, "utf8"),
  writeFile(`${prefix}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256: sha256(bundleText), evidenceSha256: sha256(evidenceText), publicationAuthorized: false }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, prefix, summary: validation.summary, factCount: evidence.facts.length, localeCount: contentDrafts.length, publicationAuthorized: false }, null, 2));
