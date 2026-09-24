import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const acquisitionRoot = resolve(root, "work/catalog-official");
const prefix = resolve(root, "seeds/catalog.tianjin-city-rich-batch-01");
const requiredSourceIds = ["tianjin-statistical-communique-2025", "tianjin-foreign-service-entry-exit", "tianjin-private-affairs-residence-guide", "tianjin-nankai-undergraduate-cost-2026", "tianjin-university-accommodation-2026"] as const;
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
const primary = source("tianjin-statistical-communique-2025");
const generatedAt = new Date().toISOString();

const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Tianjin is a municipality and major higher-education centre in North China. Its 2025 statistical communique reports 13.63 million residents, 56 regular higher-education institutions and more than 716,000 higher-education and graduate students.", budget: "Current official cost evidence covers on-campus accommodation only. Nankai publishes CNY 1,000–3,000 per month; Tianjin University publishes CNY 15–60 per resident per day. Food, local transport, personal costs and tuition are excluded.", transport: "The 2025 communique reports that the operating rail-transit network exceeded 400 km.", arrival: "Foreign nationals staying outside hotels should register with the local public-security department within 24 hours of check-in." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Thiên Tân là thành phố trực thuộc trung ương và trung tâm giáo dục đại học lớn ở miền Bắc Trung Quốc. Thông cáo năm 2025 ghi nhận 13,63 triệu dân, 56 cơ sở giáo dục đại học chính quy và hơn 716.000 sinh viên đại học cùng học viên sau đại học.", budget: "Dữ liệu chi phí chính thức hiện chỉ bao gồm chỗ ở trong trường. Nam Khai công bố 1.000–3.000 CNY/tháng; Đại học Thiên Tân công bố 15–60 CNY/người/ngày. Chưa gồm ăn uống, đi lại, chi phí cá nhân và học phí.", transport: "Thông cáo năm 2025 cho biết mạng lưới đường sắt đô thị đang vận hành đã vượt 400 km.", arrival: "Người nước ngoài không ở khách sạn nên đăng ký với cơ quan công an địa phương trong vòng 24 giờ sau khi nhận chỗ ở." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "เทียนจินเป็นนครระดับมณฑลและศูนย์กลางอุดมศึกษาที่สำคัญในจีนตอนเหนือ แถลงการณ์ปี 2025 ระบุว่ามีประชากร 13.63 ล้านคน สถาบันอุดมศึกษาปกติ 56 แห่ง และนักศึกษาระดับอุดมศึกษาและบัณฑิตศึกษามากกว่า 716,000 คน", budget: "หลักฐานค่าใช้จ่ายทางการปัจจุบันครอบคลุมเฉพาะที่พักในมหาวิทยาลัย มหาวิทยาลัยหนานไคเผยแพร่ 1,000–3,000 หยวนต่อเดือน และมหาวิทยาลัยเทียนจิน 15–60 หยวนต่อคนต่อวัน ไม่รวมอาหาร การเดินทาง ค่าใช้จ่ายส่วนตัว และค่าเล่าเรียน", transport: "แถลงการณ์ปี 2025 ระบุว่าโครงข่ายรถไฟในเมืองที่เปิดใช้งานมีระยะทางมากกว่า 400 กิโลเมตร", arrival: "ชาวต่างชาติที่ไม่ได้พักในโรงแรมควรลงทะเบียนกับหน่วยงานความมั่นคงสาธารณะในท้องถิ่นภายใน 24 ชั่วโมงหลังเข้าพัก" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Tianjin adalah kotamadya dan pusat pendidikan tinggi utama di Tiongkok Utara. Komunike 2025 mencatat 13,63 juta penduduk, 56 perguruan tinggi reguler, dan lebih dari 716.000 mahasiswa pendidikan tinggi serta pascasarjana.", budget: "Bukti biaya resmi saat ini hanya mencakup akomodasi kampus. Nankai mempublikasikan CNY 1.000–3.000 per bulan; Tianjin University CNY 15–60 per orang per hari. Makanan, transportasi lokal, biaya pribadi, dan uang kuliah tidak termasuk.", transport: "Komunike 2025 melaporkan jaringan kereta perkotaan yang beroperasi telah melampaui 400 km.", arrival: "Warga negara asing yang tidak menginap di hotel harus mendaftar pada departemen keamanan publik setempat dalam 24 jam setelah check-in." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Tianjin ialah perbandaran dan pusat pendidikan tinggi utama di China Utara. Komunike 2025 melaporkan 13.63 juta penduduk, 56 institusi pengajian tinggi biasa dan lebih 716,000 pelajar pengajian tinggi serta siswazah.", budget: "Bukti kos rasmi semasa hanya meliputi penginapan kampus. Nankai menerbitkan CNY 1,000–3,000 sebulan; Universiti Tianjin CNY 15–60 seorang sehari. Makanan, pengangkutan tempatan, perbelanjaan peribadi dan yuran pengajian tidak termasuk.", transport: "Komunike 2025 melaporkan rangkaian rel bandar yang beroperasi melebihi 400 km.", arrival: "Warga asing yang tidak menginap di hotel hendaklah mendaftar dengan jabatan keselamatan awam tempatan dalam tempoh 24 jam selepas daftar masuk." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "تيانجين بلدية ومركز رئيسي للتعليم العالي في شمال الصين. ويفيد البيان الإحصائي لعام 2025 بأن عدد السكان بلغ 13.63 مليون نسمة، مع 56 مؤسسة تعليم عالٍ نظامية وأكثر من 716 ألف طالب في التعليم العالي والدراسات العليا.", budget: "تغطي أدلة التكلفة الرسمية الحالية السكن الجامعي فقط. تنشر جامعة نانكاي نطاقًا قدره 1,000–3,000 يوان شهريًا، وتنشر جامعة تيانجين 15–60 يوانًا للفرد يوميًا. ولا تشمل الطعام أو النقل المحلي أو المصروفات الشخصية أو الرسوم الدراسية.", transport: "يفيد بيان 2025 بأن شبكة السكك الحضرية العاملة تجاوزت 400 كيلومتر.", arrival: "على الأجانب الذين لا يقيمون في الفنادق التسجيل لدى إدارة الأمن العام المحلية خلال 24 ساعة من تسجيل الوصول." },
].map(row => ({ locale: row.locale, direction: row.direction, translationState: row.translationState, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, transport: row.transport, arrival: row.arrival } }));

const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "tianjin", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  facts: [
    { factType: "resident_population", value: 13.63, unit: "million people", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Section 13, population", reviewState: "pending" },
    { factType: "resident_urbanization_rate", value: 86.21, unit: "percent", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Section 13, population", reviewState: "pending" },
    { factType: "rail_transit_operating_mileage", value: 400, unit: "km, exceeded", observedAt: "2025-12-31", derivation: "explicit_lower_bound", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Section 10, city construction and public utilities", reviewState: "pending" },
    { factType: "regular_higher_education_institutions", value: 56, unit: "institutions", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Education section", reviewState: "pending" },
    { factType: "graduate_training_institutions", value: 25, unit: "institutions", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Education section", reviewState: "pending" },
    { factType: "regular_higher_education_students", value: 608300, unit: "students", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Education section", reviewState: "pending" },
    { factType: "graduate_students", value: 107700, unit: "students", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "tianjin-statistical-communique-2025", sourcePath: "Education section", reviewState: "pending" },
    { factType: "temporary_residence_registration", value: 24, unit: "hours after check-in", observedAt: source("tianjin-private-affairs-residence-guide").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "tianjin-private-affairs-residence-guide", sourcePath: "Friendly Reminders, item 2", reviewState: "pending" },
    { factType: "nankai_undergraduate_accommodation", value: { minimum: 1000, maximum: 3000 }, unit: "CNY/month", observedAt: "2026", derivation: "explicit", evidenceId: "tianjin-nankai-undergraduate-cost-2026", sourcePath: "Section VIII Fees, Accommodation", reviewState: "pending" },
    { factType: "tianjin_university_accommodation", value: { minimum: 15, maximum: 60 }, unit: "CNY/resident/day", observedAt: "2026", derivation: "explicit", evidenceId: "tianjin-university-accommodation-2026", sourcePath: "Accommodation fees table", reviewState: "pending" },
  ],
  costSnapshots: [
    { persona: "nankai_on_campus_accommodation_only", monthlyMinimum: 1000, monthlyComfortable: 3000, currency: "CNY", observedFrom: "2026-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "tianjin-accommodation-v1", method: "Nankai's published monthly accommodation range; not a complete student budget.", evidenceIds: ["tianjin-nankai-undergraduate-cost-2026"], reviewState: "pending" },
    { persona: "tju_on_campus_accommodation_only", monthlyMinimum: 450, monthlyComfortable: 1800, currency: "CNY", observedFrom: "2026-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "tianjin-accommodation-v1", method: "Tianjin University's CNY 15–60 daily rate multiplied by 30 days; electricity and internet are self-funded.", evidenceIds: ["tianjin-university-accommodation-2026"], reviewState: "pending" },
  ],
  contentDrafts: translations,
  unresolved: ["No defensible official city-wide or off-campus rent range has been acquired.", "No complete food, utilities, local transport and personal-expense profile has been acquired.", "A current exact metro fare schedule and official climate observations remain absent.", "Both accommodation profiles are school-scoped and must not be presented as city-wide market quotes."],
};

const city = {
  slug: "tianjin", nameEn: "Tianjin", nameZh: "天津", province: "Tianjin", region: "North China",
  monthlyCost: "CUAC draft accommodation-only references: CNY 450-3,000/month across selected university room types; other living costs and tuition excluded",
  tags: ["municipality", "higher-education-centre", "coastal-city", "metro-network"], nearby: ["beijing", "langfang", "tangshan"], sortOrder: 4,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Tianjin is a North China municipality and higher-education centre. All facts and translations remain pending editorial review.",
    overview: "The 2025 municipal communique reports 13.63 million residents, 56 regular higher-education institutions, 608,300 regular higher-education students and 107,700 graduate students.",
    bestFor: ["University choice", "North China access", "Coastal-city setting"],
    quickFacts: [{ label: "Resident population", value: "13.63 million at 2025 year end", note: "Official communique; review pending" }, { label: "Higher education", value: "56 regular institutions", note: "Official communique; review pending" }, { label: "Rail transit", value: "More than 400 km", note: "Official communique; review pending" }],
    budgetSummary: { monthly: "Accommodation-only references: CNY 450-3,000", yearly: null, note: "Selected Nankai and Tianjin University room types; not a full city budget." },
    costProfiles: [{ label: "Nankai accommodation", value: "CNY 1,000-3,000/month", note: "Campus and room dependent." }, { label: "Tianjin University accommodation", value: "CNY 15-60/day", note: "Electricity and internet self-funded." }],
    why: [{ title: "Student scale", body: "The official communique reports more than 716,000 regular higher-education and graduate students combined." }],
    costBreakdown: [{ label: "Nankai dormitory", value: "CNY 1,000-3,000/month", note: "2026 undergraduate reference." }, { label: "Tianjin University dormitory", value: "CNY 15-60/day", note: "2026 room schedule." }],
    lifeSections: [{ title: "Temporary residence registration", body: "Foreign nationals staying outside hotels should register with the local public-security department within 24 hours of check-in." }],
    transportNotes: [{ title: "Rail network", body: "The official 2025 communique reports that operating rail-transit mileage exceeded 400 km." }],
    applicationTips: ["Confirm the exact school, campus, room type and intake before using any cost figure."], applicationAdvice: [], relatedProgramKeywords: ["engineering", "science", "medicine", "business", "language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Tianjin schools and programs, then confirm the exact intake and official application channel." }],
    faqs: [{ question: "Is this a complete monthly student budget?", answer: "No. Current cost evidence covers selected on-campus accommodation only." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "tianjin-statistical-communique-2025: municipal scope", nameZh: "tianjin-statistical-communique-2025: page title", province: "municipality classification", region: "CUAC geographic taxonomy; pending review", monthlyCost: "Nankai and Tianjin University accommodation sources; derived in evidence costSnapshots", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.tianjin-city-rich-batch-01.evidence.json" },
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
