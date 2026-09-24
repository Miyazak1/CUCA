import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const acquisitionRoot = resolve(process.cwd(), "work/catalog-official");
const prefix = resolve(process.cwd(), "seeds/catalog.chengdu-city-rich-batch-01");
const requiredSourceIds = ["chengdu-rail-network-update-2023", "chengdu-scu-student-accommodation"] as const;
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
const primary = source("chengdu-rail-network-update-2023");
const generatedAt = new Date().toISOString();
const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Chengdu is Sichuan's provincial capital and a major higher-education and transport centre in western China. An official 2023 update says the urban rail network exceeded 600 kilometres after Line 19 Phase 2 opened.", budget: "Current official cost evidence covers Sichuan University accommodation only. Published room rates range from CNY 4,500 per person per year to CNY 120 per person per day, depending on campus and room type.", arrival: "Confirm the assigned Sichuan University campus and room type before budgeting; on-campus supply is limited and reservation arrangements vary." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Thành Đô là thủ phủ Tứ Xuyên và là trung tâm lớn về giáo dục đại học và giao thông ở miền tây Trung Quốc. Bản cập nhật chính thức năm 2023 cho biết mạng lưới đường sắt đô thị đã vượt 600 km sau khi Giai đoạn 2 Tuyến 19 khai trương.", budget: "Dữ liệu chi phí chính thức hiện chỉ bao gồm chỗ ở tại Đại học Tứ Xuyên. Giá phòng được công bố từ 4.500 CNY/người/năm đến 120 CNY/người/ngày, tùy cơ sở và loại phòng.", arrival: "Xác nhận cơ sở và loại phòng được Đại học Tứ Xuyên phân trước khi lập ngân sách; chỗ ở trong trường có hạn và cách đặt phòng khác nhau." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "เฉิงตูเป็นเมืองเอกของเสฉวนและศูนย์กลางการศึกษาและคมนาคมสำคัญของจีนตะวันตก ข้อมูลทางการปี 2023 ระบุว่าโครงข่ายรถไฟในเมืองยาวเกิน 600 กิโลเมตรหลังรถไฟสาย 19 ระยะที่ 2 เปิดให้บริการ", budget: "หลักฐานค่าใช้จ่ายทางการปัจจุบันครอบคลุมเฉพาะที่พักมหาวิทยาลัยเสฉวน อัตราที่ประกาศมีตั้งแต่ 4,500 หยวนต่อคนต่อปีถึง 120 หยวนต่อคนต่อวันตามวิทยาเขตและประเภทห้อง", arrival: "ยืนยันวิทยาเขตและประเภทห้องที่ได้รับก่อนจัดงบประมาณ เนื่องจากห้องในมหาวิทยาลัยมีจำกัดและวิธีจองแตกต่างกัน" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Chengdu adalah ibu kota Sichuan dan pusat pendidikan tinggi serta transportasi utama di Tiongkok barat. Pembaruan resmi 2023 menyatakan jaringan rel perkotaan melampaui 600 kilometer setelah Fase 2 Jalur 19 dibuka.", budget: "Bukti biaya resmi saat ini hanya mencakup akomodasi Sichuan University. Tarif yang dipublikasikan berkisar dari CNY 4.500 per orang per tahun hingga CNY 120 per orang per hari, bergantung kampus dan jenis kamar.", arrival: "Konfirmasikan kampus dan jenis kamar yang ditetapkan sebelum menyusun anggaran; kapasitas asrama terbatas dan prosedur reservasi berbeda." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Chengdu ialah ibu negeri Sichuan dan pusat pengajian tinggi serta pengangkutan utama di barat China. Kemas kini rasmi 2023 menyatakan rangkaian rel bandar melebihi 600 kilometer selepas Fasa 2 Laluan 19 dibuka.", budget: "Bukti kos rasmi semasa hanya meliputi penginapan Universiti Sichuan. Kadar diterbitkan antara CNY 4,500 seorang setahun hingga CNY 120 seorang sehari, bergantung pada kampus dan jenis bilik.", arrival: "Sahkan kampus dan jenis bilik yang ditetapkan sebelum membuat bajet; bekalan bilik kampus terhad dan aturan tempahan berbeza." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "تشنغدو عاصمة سيتشوان ومركز رئيسي للتعليم العالي والنقل في غرب الصين. ويذكر تحديث رسمي لعام 2023 أن شبكة السكك الحضرية تجاوزت 600 كيلومتر بعد افتتاح المرحلة الثانية من الخط 19.", budget: "تقتصر أدلة التكلفة الرسمية الحالية على سكن جامعة سيتشوان. وتتراوح الأسعار المنشورة من 4,500 يوان للفرد سنويًا إلى 120 يوانًا للفرد يوميًا بحسب الحرم ونوع الغرفة.", arrival: "أكد الحرم ونوع الغرفة المخصصين قبل إعداد الميزانية؛ فالسكن الجامعي محدود وترتيبات الحجز تختلف." },
].map(row => ({ locale: row.locale, direction: row.direction, translationState: row.translationState, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));
const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "chengdu", publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  acquisitionExceptions: [{ sourceId: "chengdu-statistical-communique-2025", state: "not_acquired", reason: "The exact official page returned HTTP 412 to the deterministic collector; no access-control bypass was attempted." }],
  facts: [
    { factType: "urban_rail_operating_length", value: 600, qualifier: "more_than", unit: "kilometres", observedAt: "2023-11-28", derivation: "explicit", evidenceId: "chengdu-rail-network-update-2023", sourcePath: "Line 19 Phase 2 opening announcement", reviewState: "pending" },
    { factType: "line_19_phase_2_length", value: 43.17, unit: "kilometres", observedAt: "2023-11-28", derivation: "explicit", evidenceId: "chengdu-rail-network-update-2023", sourcePath: "Line 19 Phase 2 opening announcement", reviewState: "pending" },
    { factType: "line_19_max_operating_speed", value: 160, unit: "kilometres/hour", observedAt: "2023-11-28", derivation: "explicit", evidenceId: "chengdu-rail-network-update-2023", sourcePath: "Line 19 Phase 2 opening announcement", reviewState: "pending" },
    { factType: "scu_jiang_an_quad_room", value: 4500, unit: "CNY/person/year", derivation: "explicit", evidenceId: "chengdu-scu-student-accommodation", sourcePath: "Jiang'an Campus accommodation table", reviewState: "pending" },
    { factType: "scu_jiang_an_triple_room", value: 6000, unit: "CNY/person/year", derivation: "explicit", evidenceId: "chengdu-scu-student-accommodation", sourcePath: "Jiang'an Campus accommodation table", reviewState: "pending" },
    { factType: "scu_huaxi_room_rate_range", valueMinimum: 24, valueMaximum: 52, unit: "CNY/person/day", derivation: "explicit", evidenceId: "chengdu-scu-student-accommodation", sourcePath: "Huaxi Campus accommodation table", reviewState: "pending" },
    { factType: "scu_wangjiang_room_rate_range", valueMinimum: 36, valueMaximum: 120, unit: "CNY/person/day", derivation: "explicit", evidenceId: "chengdu-scu-student-accommodation", sourcePath: "Wangjiang Campus accommodation tables", reviewState: "pending" },
  ],
  costSnapshots: [{ persona: "scu_on_campus_accommodation_only", monthlyMinimum: 375, monthlyComfortable: 3600, currency: "CNY", observedFrom: null, observedTo: generatedAt.slice(0, 10), sampleSize: 13, methodologyVersion: "chengdu-accommodation-v1", method: "Lower bound is Jiang'an quadruple-room annual fee CNY 4,500 divided by 12. Upper bound is Wangjiang West Zone single-room rate CNY 120 per day multiplied by 30 days.", evidenceIds: ["chengdu-scu-student-accommodation"], exclusions: ["off-campus rent", "deposit", "utilities beyond stated allowances", "bedding", "food", "transport", "personal expenses", "tuition"], reviewState: "pending" }],
  contentDrafts: translations,
  unresolved: ["Acquire a current primary Chengdu statistical communique before adding population, economic or education-scale facts.", "The registered 2025 statistical communique returned HTTP 412.", "The accommodation profile is Sichuan-University-specific and spans materially different campuses and room types.", "The official accommodation page does not expose a publication or effective date; rates require reconfirmation before publication."],
};
const city = {
  slug: "chengdu", nameEn: "Chengdu", nameZh: "成都", province: "Sichuan", region: "Southwest China",
  monthlyCost: "CUAC draft SCU accommodation-only range: CNY 375-3,600/month equivalent; all other living costs excluded",
  tags: ["provincial-capital", "western-china-centre", "higher-education-centre", "metro-city"], nearby: ["chongqing", "mianyang", "leshan"], sortOrder: 5,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Chengdu is Sichuan's capital and a major western-China education and transport centre. This evidence draft is intentionally incomplete and pending review.",
    overview: "An official November 2023 update says Chengdu's urban rail operating network exceeded 600 kilometres when Line 19 Phase 2 began service.",
    bestFor: ["Sichuan University routes", "Western China access", "Large urban rail network"],
    quickFacts: [{ label: "Urban rail", value: "More than 600 km", note: "Official update dated 28 November 2023" }, { label: "Line 19 Phase 2", value: "43.17 km", note: "Maximum operating speed 160 km/h" }],
    budgetSummary: { monthly: "SCU accommodation-only equivalent: CNY 375-3,600", yearly: null, note: "Wide range across Jiang'an, Huaxi and Wangjiang room types; not a complete student budget." },
    costProfiles: [{ label: "Sichuan University accommodation", value: "CNY 375-3,600/month equivalent", note: "Derived from published annual and daily campus room rates." }],
    why: [{ title: "Western China hub", body: "Chengdu combines a large university catalog with a metro network exceeding 600 kilometres in the acquired official update." }],
    costBreakdown: [{ label: "SCU on-campus rooms", value: "CNY 4,500/person/year to CNY 120/person/day", note: "Campus, room occupancy and included utilities differ." }],
    lifeSections: [{ title: "Accommodation planning", body: "Sichuan University says on-campus availability is limited and students should confirm reservation arrangements for their assigned campus." }],
    transportNotes: ["Line 19 Phase 2 opened on 28 November 2023; the acquired source is not a current whole-network timetable."],
    applicationTips: ["Confirm campus, room type, reservation method and current price directly with the university."], applicationAdvice: [],
    relatedProgramKeywords: ["engineering", "medicine", "business", "computer science", "Chinese language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Chengdu programs and verify the exact campus and intake." }],
    faqs: [{ question: "Is this a complete Chengdu student budget?", answer: "No. Current official cost evidence covers Sichuan University accommodation only." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "registered official Chengdu transport source", nameZh: "registered official Chengdu transport source", province: "official municipal scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "chengdu-scu-student-accommodation; derived in evidence costSnapshots", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.chengdu-city-rich-batch-01.evidence.json" },
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
