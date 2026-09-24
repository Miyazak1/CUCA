import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const acquisitionRoot = resolve(root, "work/catalog-official");
const prefix = resolve(root, "seeds/catalog.nanjing-city-rich-batch-01");
const requiredSourceIds = [
  "nanjing-statistical-communique-2025",
  "nanjing-statistical-communique-docx-2025",
  "nanjing-international-living-portal",
  "nanjing-arrival-checklist",
  "nanjing-public-transport-price-handbook-2026",
  "nuaa-undergraduate-admissions-2026",
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
    } catch { /* Ignore incomplete acquisition directories. */ }
  }
  return latest;
}

const snapshots = await latestSnapshots();
for (const id of requiredSourceIds) if (!snapshots.has(id)) throw new Error(`Missing acquired source ${id}.`);
const source = (id: typeof requiredSourceIds[number]) => snapshots.get(id)!;
const primary = source("nanjing-statistical-communique-docx-2025");
const generatedAt = new Date().toISOString();

const contentDrafts = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Nanjing is a major higher-education centre in Jiangsu. The 2025 municipal communique reports 9.6385 million residents, 54 regular higher-education institutions and 1.0988 million higher-education and graduate students at year end.", budget: "The current official cost evidence covers NUAA on-campus accommodation only: CNY 4,000–14,000 per academic year. Food, local transport, personal costs and tuition are not yet included.", transport: "The city reported 15 completed rail-transit lines and 524.4 km of operating mileage. Metro single fares run from CNY 2 within 4 km to distance-based higher bands.", arrival: "The official arrival checklist says foreigners staying outside a hotel should complete temporary residence registration at the local police station within 24 hours after arrival." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Nam Kinh là một trung tâm giáo dục đại học lớn của tỉnh Giang Tô. Thông cáo thành phố năm 2025 ghi nhận 9,6385 triệu dân, 54 cơ sở giáo dục đại học chính quy và 1,0988 triệu sinh viên đại học cùng học viên sau đại học vào cuối năm.", budget: "Dữ liệu chi phí chính thức hiện chỉ bao gồm chỗ ở trong khuôn viên NUAA: 4.000–14.000 CNY mỗi năm học. Chưa bao gồm ăn uống, đi lại địa phương, chi phí cá nhân và học phí.", transport: "Thành phố báo cáo 15 tuyến đường sắt đô thị đã hoàn thành với 524,4 km vận hành. Vé metro một lượt bắt đầu từ 2 CNY cho quãng đường trong 4 km và tăng theo khoảng cách.", arrival: "Danh sách việc cần làm khi đến thành phố nêu rằng người nước ngoài không ở khách sạn phải đăng ký tạm trú tại đồn công an địa phương trong vòng 24 giờ sau khi đến." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "หนานจิงเป็นศูนย์กลางการศึกษาระดับอุดมศึกษาที่สำคัญของมณฑลเจียงซู แถลงการณ์เทศบาลปี 2025 ระบุว่าปลายปีมีประชากร 9.6385 ล้านคน สถาบันอุดมศึกษาปกติ 54 แห่ง และนักศึกษาระดับอุดมศึกษาและบัณฑิตศึกษารวม 1.0988 ล้านคน", budget: "หลักฐานค่าใช้จ่ายอย่างเป็นทางการในขณะนี้ครอบคลุมเฉพาะที่พักในมหาวิทยาลัย NUAA: 4,000–14,000 หยวนต่อปีการศึกษา ยังไม่รวมอาหาร การเดินทาง ค่าใช้จ่ายส่วนตัว และค่าเล่าเรียน", transport: "เมืองรายงานเส้นทางรถไฟในเมืองที่สร้างเสร็จ 15 สาย ระยะทางเดินรถ 524.4 กิโลเมตร ค่าโดยสารรถไฟใต้ดินเริ่มที่ 2 หยวนภายใน 4 กิโลเมตรและเพิ่มตามระยะทาง", arrival: "รายการตรวจสอบการเดินทางมาถึงอย่างเป็นทางการระบุว่าชาวต่างชาติที่ไม่ได้พักในโรงแรมควรลงทะเบียนที่พักชั่วคราวกับสถานีตำรวจท้องถิ่นภายใน 24 ชั่วโมงหลังเดินทางมาถึง" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Nanjing adalah pusat pendidikan tinggi utama di Jiangsu. Komunike kota 2025 mencatat 9,6385 juta penduduk, 54 perguruan tinggi reguler, dan 1,0988 juta mahasiswa pendidikan tinggi serta pascasarjana pada akhir tahun.", budget: "Bukti biaya resmi saat ini hanya mencakup akomodasi dalam kampus NUAA: CNY 4.000–14.000 per tahun akademik. Makanan, transportasi lokal, biaya pribadi, dan uang kuliah belum termasuk.", transport: "Kota ini melaporkan 15 jalur kereta perkotaan yang telah selesai dengan jarak operasi 524,4 km. Tarif tunggal metro mulai dari CNY 2 untuk perjalanan hingga 4 km dan meningkat sesuai jarak.", arrival: "Daftar kedatangan resmi menyatakan bahwa warga asing yang tidak menginap di hotel harus menyelesaikan pendaftaran tempat tinggal sementara di kantor polisi setempat dalam 24 jam setelah tiba." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Nanjing ialah pusat pendidikan tinggi utama di Jiangsu. Komunike bandar 2025 melaporkan 9.6385 juta penduduk, 54 institusi pengajian tinggi biasa dan 1.0988 juta pelajar pengajian tinggi serta siswazah pada akhir tahun.", budget: "Bukti kos rasmi semasa hanya meliputi penginapan dalam kampus NUAA: CNY 4,000–14,000 bagi setiap tahun akademik. Makanan, pengangkutan tempatan, perbelanjaan peribadi dan yuran pengajian belum termasuk.", transport: "Bandar ini melaporkan 15 laluan rel bandar yang telah siap dengan jarak operasi 524.4 km. Tambang metro sehala bermula pada CNY 2 untuk perjalanan sehingga 4 km dan meningkat mengikut jarak.", arrival: "Senarai semak ketibaan rasmi menyatakan bahawa warga asing yang tidak menginap di hotel hendaklah melengkapkan pendaftaran kediaman sementara di balai polis tempatan dalam tempoh 24 jam selepas ketibaan." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "تُعد نانجينغ مركزًا رئيسيًا للتعليم العالي في جيانغسو. ووفقًا للبيان البلدي لعام 2025، بلغ عدد السكان 9.6385 مليون نسمة، وبلغ عدد مؤسسات التعليم العالي النظامية 54 مؤسسة، وعدد طلاب التعليم العالي والدراسات العليا 1.0988 مليون طالب في نهاية العام.", budget: "تغطي أدلة التكلفة الرسمية الحالية السكن داخل حرم جامعة NUAA فقط، من 4,000 إلى 14,000 يوان صيني لكل سنة دراسية. ولا تشمل الطعام أو النقل المحلي أو المصروفات الشخصية أو الرسوم الدراسية.", transport: "أفادت المدينة باكتمال 15 خطًا للسكك الحضرية بطول تشغيلي قدره 524.4 كيلومترًا. تبدأ تذكرة المترو من يوانين للرحلات حتى 4 كيلومترات وتزداد بحسب المسافة.", arrival: "توضح قائمة الوصول الرسمية أن الأجنبي الذي لا يقيم في فندق عليه إتمام تسجيل الإقامة المؤقتة في مركز الشرطة المحلي خلال 24 ساعة من الوصول." },
].map(draft => ({ ...draft, reviewState: "pending", sections: { overview: draft.overview, budget: draft.budget, transport: draft.transport, arrival: draft.arrival } }));
for (const draft of contentDrafts) { delete (draft as any).overview; delete (draft as any).budget; delete (draft as any).transport; delete (draft as any).arrival; }

const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "nanjing", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  facts: [
    { factType: "resident_population", value: 9.6385, unit: "million people", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 1, year-end resident population", reviewState: "pending" },
    { factType: "rail_transit_lines", value: 15, unit: "lines", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 7, transport; includes two tram lines", reviewState: "pending" },
    { factType: "rail_transit_operating_mileage", value: 524.4, unit: "km", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 7, transport; includes 16.8 km of tram mileage", reviewState: "pending" },
    { factType: "metro_annual_ridership", value: 1.134, unit: "billion passenger trips", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 7, transport", reviewState: "pending" },
    { factType: "regular_higher_education_institutions", value: 54, unit: "institutions", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 10, education; excludes military institutions", reviewState: "pending" },
    { factType: "higher_education_students_excluding_graduates", value: 868700, unit: "students", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 10, education", reviewState: "pending" },
    { factType: "graduate_students", value: 230100, unit: "students", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-statistical-communique-docx-2025", sourcePath: "Section 10, education", reviewState: "pending" },
    { factType: "metro_fare_bands", value: [{ maximumKm: 4, fare: 2 }, { maximumKm: 9, fare: 3 }, { maximumKm: 14, fare: 4 }, { maximumKm: 21, fare: 5 }, { maximumKm: 28, fare: 6 }, { maximumKm: 37, fare: 7 }, { maximumKm: 48, fare: 8 }, { maximumKm: 61, fare: 9 }, { aboveKm: 61, incrementKm: 15, fareIncrement: 1 }], unit: "CNY", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "nanjing-public-transport-price-handbook-2026", sourcePath: "Page 5, metro single-fare table", reviewState: "pending" },
    { factType: "temporary_residence_registration", value: 24, unit: "hours after arrival", observedAt: source("nanjing-arrival-checklist").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "nanjing-arrival-checklist", sourcePath: "Arrival checklist, accommodation section; applies to foreigners staying outside hotels", reviewState: "pending" },
    { factType: "nuaa_undergraduate_dormitory", value: { yearlyMinimum: 4000, yearlyMaximum: 14000, roomTypes: "small or large single/double rooms" }, unit: "CNY/academic year", observedAt: "2026", derivation: "explicit", evidenceId: "nuaa-undergraduate-admissions-2026", sourcePath: "Tuition & Fees, Dormitory", reviewState: "pending" },
  ],
  costSnapshots: [{ persona: "on_campus_accommodation_only", monthlyMinimum: 333.33, monthlyComfortable: 1166.67, currency: "CNY", observedFrom: "2026-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "nanjing-accommodation-v1", method: "NUAA published annual dormitory minimum and maximum divided by 12; this is accommodation only, not a complete student budget.", evidenceIds: ["nuaa-undergraduate-admissions-2026"], reviewState: "pending" }],
  contentDrafts,
  unresolved: ["No defensible official city-wide or off-campus rent range has been acquired.", "No complete food, utilities, local transport and personal-expense profile has been acquired.", "Climate facts remain absent until an exact no-login official dataset is registered.", "The accommodation evidence is NUAA-scoped and must not be presented as a city-wide market quote."],
};

const city = {
  slug: "nanjing", nameEn: "Nanjing", nameZh: "南京", province: "Jiangsu", region: "East China",
  monthlyCost: "CUAC draft accommodation-only reference: CNY 333-1,167/month at NUAA; food, transport, personal costs and tuition excluded",
  tags: ["provincial-capital", "higher-education-centre", "metro-network"], nearby: ["suzhou", "wuxi", "shanghai"], sortOrder: 3,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Nanjing is a major Jiangsu higher-education centre. All facts and translations in this profile remain pending editorial review.",
    overview: "The 2025 municipal communique reports 9.6385 million residents, 54 regular higher-education institutions, 868,700 higher-education students excluding graduate students, and 230,100 graduate students at year end.",
    bestFor: ["Broad university choice", "East China access", "Large higher-education community"],
    quickFacts: [
      { label: "Resident population", value: "9.6385 million at 2025 year end", note: "Nanjing 2025 statistical communique; review pending" },
      { label: "Higher education", value: "54 regular institutions", note: "Military institutions excluded; review pending" },
      { label: "Rail transit", value: "15 lines and 524.4 km", note: "Includes tram lines and mileage; review pending" },
    ],
    budgetSummary: { monthly: "Accommodation-only draft: CNY 333-1,167", yearly: "CNY 4,000-14,000", note: "NUAA dormitory reference only; not a complete city budget." },
    costProfiles: [{ label: "NUAA on-campus accommodation", value: "CNY 4,000-14,000/academic year", note: "Room-dependent official 2026 undergraduate reference." }],
    why: [{ title: "University scale", body: "The municipal communique reports 54 regular higher-education institutions and nearly 1.1 million higher-education and graduate students combined." }],
    costBreakdown: [{ label: "NUAA dormitory", value: "CNY 4,000-14,000/year", note: "Small or large single/double room options." }, { label: "Metro", value: "From CNY 2", note: "Distance-based single fare." }],
    lifeSections: [{ title: "Temporary residence registration", body: "Foreigners staying outside a hotel should follow the official arrival checklist and register at the local police station within 24 hours after arrival." }],
    transportNotes: [{ title: "Metro fares", body: "The official fare is CNY 2 within 4 km, then rises in published distance bands; above 61 km, CNY 1 is added per 15 km." }],
    applicationTips: ["Confirm the exact school, campus, room type and intake before using any cost figure."], applicationAdvice: [],
    relatedProgramKeywords: ["engineering", "science", "medicine", "business", "language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Nanjing schools and programs, then confirm the exact intake and official application channel." }],
    faqs: [{ question: "Is this a complete monthly student budget?", answer: "No. The current cost draft covers one university's on-campus accommodation only." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "nanjing-statistical-communique-2025: municipal scope", nameZh: "nanjing-statistical-communique-2025: page title", province: "official Nanjing portal scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "nuaa-undergraduate-admissions-2026: dormitory fee divided by 12; accommodation only", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.nanjing-city-rich-batch-01.evidence.json" },
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
