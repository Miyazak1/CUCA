import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const acquisitionRoot = resolve(root, "work/catalog-official");
const prefix = resolve(root, "seeds/catalog.guangzhou-city-rich-batch-01");
const requiredSourceIds = ["guangzhou-statistical-communique-2025", "guangzhou-overseas-accommodation-registration-portal", "guangzhou-foreign-arrival-accommodation-guide-2025", "guangzhou-sysu-dormitory-fees"] as const;
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function latestSnapshots() {
  const latest = new Map<string, SourceRow>();
  for (const entry of await readdir(acquisitionRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(resolve(acquisitionRoot, entry.name, "manifest.json"), "utf8"));
      for (const row of manifest.sources || []) {
        const old = latest.get(row.id);
        if (!old || Date.parse(row.fetchedAt) > Date.parse(old.fetchedAt)) latest.set(row.id, row);
      }
    } catch { /* Ignore incomplete acquisition directories. */ }
  }
  return latest;
}
const snapshots = await latestSnapshots();
for (const id of requiredSourceIds) if (!snapshots.has(id)) throw new Error(`Missing acquired source ${id}.`);
const source = (id: typeof requiredSourceIds[number]) => snapshots.get(id)!;
const primary = source("guangzhou-statistical-communique-2025");
const generatedAt = new Date().toISOString();

const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Guangzhou is the capital of Guangdong and a major higher-education and transport centre in South China. Its 2025 communique reports 19.101 million residents, 191,200 graduate students and 1.5867 million regular or vocational undergraduate students.", budget: "Current official cost evidence is limited to Sun Yat-sen University dormitories. Guangzhou-campus room types publish CNY 3,000–16,000 per academic year, excluding fixed water and electricity charges.", arrival: "Foreign nationals staying outside hotels should complete accommodation registration at a local police station or foreigners' service station within 24 hours after check-in; Guangzhou Police also publishes a self-service registration entry point." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Quảng Châu là thủ phủ Quảng Đông và là trung tâm giáo dục đại học, giao thông lớn ở miền Nam Trung Quốc. Thông cáo năm 2025 ghi nhận 19,101 triệu dân, 191.200 học viên sau đại học và 1,5867 triệu sinh viên đại học chính quy hoặc nghề.", budget: "Dữ liệu chi phí chính thức hiện chỉ gồm ký túc xá Đại học Trung Sơn. Các loại phòng tại cơ sở Quảng Châu công bố 3.000–16.000 CNY/năm học, chưa gồm định mức điện nước.", arrival: "Người nước ngoài không ở khách sạn cần đăng ký lưu trú tại công an địa phương hoặc điểm dịch vụ người nước ngoài trong vòng 24 giờ sau khi nhận chỗ ở; Công an Quảng Châu cũng công bố cổng tự khai báo." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "กว่างโจวเป็นเมืองเอกของกวางตุ้งและศูนย์กลางอุดมศึกษาและคมนาคมสำคัญในจีนตอนใต้ แถลงการณ์ปี 2025 ระบุประชากร 19.101 ล้านคน นักศึกษาบัณฑิตศึกษา 191,200 คน และนักศึกษาปริญญาตรีปกติหรือสายอาชีพ 1.5867 ล้านคน", budget: "หลักฐานค่าใช้จ่ายทางการในปัจจุบันจำกัดเฉพาะหอพักมหาวิทยาลัยซุนยัตเซ็น ห้องในวิทยาเขตกว่างโจวประกาศ 3,000–16,000 หยวนต่อปีการศึกษา ไม่รวมค่าน้ำและค่าไฟคงที่", arrival: "ชาวต่างชาติที่ไม่ได้พักในโรงแรมควรลงทะเบียนที่พักกับสถานีตำรวจท้องถิ่นหรือจุดบริการชาวต่างชาติภายใน 24 ชั่วโมงหลังเข้าพัก และตำรวจนครกว่างโจวยังมีช่องทางลงทะเบียนด้วยตนเอง" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Guangzhou adalah ibu kota Guangdong serta pusat pendidikan tinggi dan transportasi utama di Tiongkok Selatan. Komunike 2025 mencatat 19,101 juta penduduk, 191.200 mahasiswa pascasarjana, dan 1,5867 juta mahasiswa sarjana reguler atau vokasi.", budget: "Bukti biaya resmi saat ini terbatas pada asrama Sun Yat-sen University. Jenis kamar kampus Guangzhou dipublikasikan sebesar CNY 3.000–16.000 per tahun akademik, belum termasuk biaya tetap air dan listrik.", arrival: "Warga asing yang tidak menginap di hotel harus melakukan registrasi akomodasi di kantor polisi setempat atau pos layanan warga asing dalam 24 jam setelah check-in; Polisi Guangzhou juga menyediakan jalur pendaftaran mandiri." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Guangzhou ialah ibu negeri Guangdong serta pusat pengajian tinggi dan pengangkutan utama di China Selatan. Komunike 2025 melaporkan 19.101 juta penduduk, 191,200 pelajar siswazah dan 1.5867 juta pelajar prasiswazah biasa atau vokasional.", budget: "Bukti kos rasmi semasa terhad kepada asrama Universiti Sun Yat-sen. Jenis bilik kampus Guangzhou menerbitkan CNY 3,000–16,000 setiap tahun akademik, tidak termasuk caj tetap air dan elektrik.", arrival: "Warga asing yang tidak menginap di hotel hendaklah mendaftarkan penginapan di balai polis tempatan atau stesen perkhidmatan warga asing dalam 24 jam selepas daftar masuk; Polis Guangzhou turut menyediakan saluran pendaftaran layan diri." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "غوانغتشو عاصمة غوانغدونغ ومركز رئيسي للتعليم العالي والنقل في جنوب الصين. ويفيد بيان 2025 بأن عدد السكان بلغ 19.101 مليون نسمة، مع 191,200 طالب دراسات عليا و1.5867 مليون طالب جامعي نظامي أو مهني.", budget: "تقتصر أدلة التكلفة الرسمية الحالية على مساكن جامعة صن يات سن. وتتراوح أسعار غرف فروع غوانغتشو المنشورة بين 3,000 و16,000 يوان لكل سنة دراسية، من دون الرسوم الثابتة للمياه والكهرباء.", arrival: "على الأجانب الذين لا يقيمون في الفنادق تسجيل السكن لدى مركز الشرطة المحلي أو محطة خدمات الأجانب خلال 24 ساعة من تسجيل الوصول، كما تنشر شرطة غوانغتشو بوابة للتسجيل الذاتي." },
].map(row => ({ locale: row.locale, direction: row.direction, translationState: row.translationState, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));

const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "guangzhou", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  acquisitionExceptions: [
    { sourceId: "guangzhou-scut-predeparture-cost-guide", state: "not_acquired", reason: "Registered official PDF URL returned HTTP 404 to the deterministic collector." },
    { sourceId: "scut-prospectus-en-pdf-2026", state: "not_acquired_for_city_cost", reason: "The declared official PDF size exceeded the collector's 50 MiB safety ceiling." },
  ],
  facts: [
    { factType: "resident_population", value: 19.101, unit: "million people", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "guangzhou-statistical-communique-2025", sourcePath: "Population section", reviewState: "pending" },
    { factType: "resident_urbanization_rate", value: 87.56, unit: "percent", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "guangzhou-statistical-communique-2025", sourcePath: "Population section", reviewState: "pending" },
    { factType: "graduate_admissions", value: 65100, unit: "students", observedAt: "2025", derivation: "explicit", evidenceId: "guangzhou-statistical-communique-2025", sourcePath: "Education and science section", reviewState: "pending" },
    { factType: "graduate_students", value: 191200, unit: "students", observedAt: "2025", derivation: "explicit", evidenceId: "guangzhou-statistical-communique-2025", sourcePath: "Education and science section", reviewState: "pending" },
    { factType: "regular_and_vocational_undergraduate_students", value: 1586700, unit: "students", observedAt: "2025", derivation: "explicit", evidenceId: "guangzhou-statistical-communique-2025", sourcePath: "Education and science section", reviewState: "pending" },
    { factType: "metro_passenger_trips", value: 3.406, unit: "billion passenger trips/year", observedAt: "2025", derivation: "explicit", evidenceId: "guangzhou-statistical-communique-2025", sourcePath: "Transport section", reviewState: "pending" },
    { factType: "temporary_accommodation_registration", value: 24, unit: "hours after check-in", observedAt: "2025", derivation: "explicit", evidenceId: "guangzhou-foreign-arrival-accommodation-guide-2025", sourcePath: "Warm reminders", reviewState: "pending" },
    { factType: "sysu_guangzhou_dormitory", value: { minimum: 3000, maximum: 16000 }, unit: "CNY/student/academic-year", observedAt: "2022", derivation: "explicit_range_across_room_types", evidenceId: "guangzhou-sysu-dormitory-fees", sourcePath: "Guangzhou South, East and North Campus dormitory table", reviewState: "pending" },
  ],
  costSnapshots: [
    { persona: "sysu_guangzhou_on_campus_accommodation_only", monthlyMinimum: 250, monthlyComfortable: 1333.33, currency: "CNY", observedFrom: "2022-08-18", observedTo: generatedAt.slice(0, 10), sampleSize: 11, methodologyVersion: "guangzhou-accommodation-v1", method: "Published Guangzhou-campus room range CNY 3,000–16,000 per academic year divided by 12 for comparison only.", evidenceIds: ["guangzhou-sysu-dormitory-fees"], exclusions: ["fixed water and electricity", "food", "transport", "personal expenses", "tuition"], reviewState: "pending" },
  ],
  contentDrafts: translations,
  unresolved: ["The SYSU dormitory schedule was published in 2022 and needs a current replacement before publication.", "No defensible complete city-wide student budget has been acquired.", "Accommodation prices vary by campus, building and room occupancy.", "The registered SCUT cost PDF returned 404 and the 2026 prospectus exceeded the acquisition size ceiling."],
};

const city = {
  slug: "guangzhou", nameEn: "Guangzhou", nameZh: "广州", province: "Guangdong", region: "South China",
  monthlyCost: "CUAC draft accommodation-only reference: CNY 250-1,333/month equivalent across selected SYSU Guangzhou room types; other costs and tuition excluded",
  tags: ["provincial-capital", "higher-education-centre", "greater-bay-area", "metro-city"], nearby: ["foshan", "dongguan", "shenzhen"], sortOrder: 9,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Guangzhou is Guangdong's capital and a major South China education and transport centre. All fields remain pending editorial review.",
    overview: "The 2025 official communique reports 19.101 million residents, 191,200 graduate students and 1.5867 million regular or vocational undergraduate students.",
    bestFor: ["University choice", "Greater Bay Area access", "Large metro network"],
    quickFacts: [{ label: "Resident population", value: "19.101 million at 2025 year end", note: "Official communique; review pending" }, { label: "Graduate students", value: "191,200", note: "2025 official communique" }, { label: "Metro trips", value: "3.406 billion in 2025", note: "Official communique" }],
    budgetSummary: { monthly: "Accommodation-only equivalent: CNY 250-1,333", yearly: "CNY 3,000-16,000", note: "Selected SYSU Guangzhou campus room types; older schedule; not a full budget." },
    costProfiles: [{ label: "SYSU Guangzhou accommodation", value: "CNY 3,000-16,000/academic year", note: "Campus/building/occupancy dependent; fixed utilities excluded." }],
    why: [{ title: "Higher-education scale", body: "The official 2025 communique reports more than 1.77 million graduate and regular/vocational undergraduate students combined." }],
    costBreakdown: [{ label: "On-campus dormitory", value: "CNY 3,000-16,000/academic year", note: "SYSU Guangzhou campuses; 2022 schedule." }],
    lifeSections: [{ title: "Accommodation registration", body: "Foreign nationals staying outside hotels should register within 24 hours; Guangzhou Police publishes an online self-service entry point." }],
    transportNotes: [{ title: "Metro use", body: "The 2025 communique reports 3.406 billion metro passenger trips." }],
    applicationTips: ["Confirm the exact campus, room type and current price with the university before budgeting."], applicationAdvice: [], relatedProgramKeywords: ["engineering", "medicine", "business", "science", "Chinese language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Guangzhou programs and confirm the intake and official application channel." }],
    faqs: [{ question: "Is this a complete Guangzhou student budget?", answer: "No. Current official cost evidence covers selected university accommodation only." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "guangzhou-statistical-communique-2025: municipal scope", nameZh: "guangzhou-statistical-communique-2025: page title", province: "official administrative scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "guangzhou-sysu-dormitory-fees; derived transparently in evidence costSnapshots", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.guangzhou-city-rich-batch-01.evidence.json" },
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
console.log(JSON.stringify({ ok: true, prefix, summary: validation.summary, factCount: evidence.facts.length, localeCount: translations.length, publicationAuthorized: false }, null, 2));
