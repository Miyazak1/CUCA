import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = {
  id: string;
  label: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  sha256: string;
  contentType: string;
};

const root = process.cwd();
const acquisitionRoot = resolve(root, "work/catalog-official");
const draftPath = resolve(root, "seeds/catalog.beijing-city-rich-batch-01.draft.json");
const evidencePath = resolve(root, "seeds/catalog.beijing-city-rich-batch-01.evidence.json");
const validationPath = resolve(root, "seeds/catalog.beijing-city-rich-batch-01.validation.json");
const requiredSourceIds = [
  "beijing-statistical-communique-2025",
  "beijing-international-study-portal",
  "beijing-international-living-portal",
  "beijing-foreign-student-arrival-guide",
  "beijing-medical-guide-for-foreigners",
  "beijing-public-transport-prices",
  "beijing-higher-education-accommodation-price-standard",
  "beijing-pku-student-cost-reference",
  "beijing-bnu-student-cost-reference",
  "beijing-bit-student-cost-2026",
] as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function latestSnapshots(): Promise<Map<string, SourceRow>> {
  const latest = new Map<string, SourceRow>();
  for (const entry of await readdir(acquisitionRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(resolve(acquisitionRoot, entry.name, "manifest.json"), "utf8"));
      for (const source of manifest.sources || []) {
        const existing = latest.get(source.id);
        if (!existing || Date.parse(source.fetchedAt) > Date.parse(existing.fetchedAt)) latest.set(source.id, source);
      }
    } catch {
      // Ignore unrelated or incomplete acquisition work directories.
    }
  }
  return latest;
}

const snapshots = await latestSnapshots();
for (const id of requiredSourceIds) if (!snapshots.has(id)) throw new Error(`Missing acquired source ${id}.`);
const source = (id: typeof requiredSourceIds[number]) => snapshots.get(id)!;
const primary = source("beijing-statistical-communique-2025");
const generatedAt = new Date().toISOString();

const evidence = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  citySlug: "beijing",
  publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({
    id,
    url: source(id).url,
    finalUrl: source(id).finalUrl,
    title: source(id).label,
    capturedAt: source(id).fetchedAt,
    snapshotSha256: source(id).sha256,
    contentType: source(id).contentType,
    reviewState: "pending",
  })),
  facts: [
    { factType: "resident_population", value: 21.8, unit: "million people", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "beijing-statistical-communique-2025", sourcePath: "Section 1, year-end resident population", reviewState: "pending" },
    { factType: "rail_transit_lines", value: 30, unit: "lines", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "beijing-statistical-communique-2025", sourcePath: "Section 9, urban construction", reviewState: "pending" },
    { factType: "rail_transit_length", value: 909, unit: "km", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "beijing-statistical-communique-2025", sourcePath: "Section 9, urban construction", reviewState: "pending" },
    { factType: "public_bus_routes", value: 1252, unit: "routes", observedAt: "2025-12-31", derivation: "explicit", evidenceId: "beijing-statistical-communique-2025", sourcePath: "Section 9, urban construction", reviewState: "pending" },
    { factType: "emergency_medical_number", value: "120", scope: "Chinese mainland and Beijing", derivation: "explicit", evidenceId: "beijing-medical-guide-for-foreigners", sourcePath: "Clear Consultation Process > Emergency Call", reviewState: "pending" },
    { factType: "subway_fare", value: [{ maximumKm: 6, cny: 3 }, { maximumKm: 12, cny: 4 }, { maximumKm: 22, cny: 5 }, { maximumKm: 32, cny: 6 }, { overKmIncrement: 20, cnyIncrement: 1 }], observedAt: source("beijing-public-transport-prices").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "beijing-public-transport-prices", sourcePath: "Public transport prices > Rail transit", reviewState: "pending" },
    { factType: "pku_reference_accommodation", value: 35000, unit: "CNY/academic year", observedAt: source("beijing-pku-student-cost-reference").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "beijing-pku-student-cost-reference", sourcePath: "Reference Costs of Living and Accommodation in Beijing", reviewState: "pending" },
    { factType: "pku_reference_food", value: 15000, unit: "CNY/academic year", observedAt: source("beijing-pku-student-cost-reference").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "beijing-pku-student-cost-reference", sourcePath: "Reference Costs of Living and Accommodation in Beijing", reviewState: "pending" },
    { factType: "pku_reference_transport_misc", value: 5000, unit: "CNY/academic year", observedAt: source("beijing-pku-student-cost-reference").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "beijing-pku-student-cost-reference", sourcePath: "Reference Costs of Living and Accommodation in Beijing", reviewState: "pending" },
    { factType: "bnu_living_cost", value: { minimum: 1500, maximum: 3000 }, unit: "CNY/month", observedAt: source("beijing-bnu-student-cost-reference").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "beijing-bnu-student-cost-reference", sourcePath: "Fees > Living expenses", reviewState: "pending" },
    { factType: "bnu_long_term_dorm", value: { minimum: 40, maximum: 95 }, unit: "CNY/bed/day", observedAt: source("beijing-bnu-student-cost-reference").fetchedAt.slice(0, 10), derivation: "explicit", evidenceId: "beijing-bnu-student-cost-reference", sourcePath: "Fees > Accommodation > long-term student rates", reviewState: "pending" },
    { factType: "bit_beijing_dorm", value: { minimum: 500, maximum: 1350 }, unit: "CNY/month", observedAt: "2026", derivation: "explicit", evidenceId: "beijing-bit-student-cost-2026", sourcePath: "2026 undergraduate FAQ > study period and costs > Beijing campuses", reviewState: "pending" },
  ],
  costSnapshots: [
    {
      persona: "general_student_reference",
      monthlyTypical: 5917,
      currency: "CNY",
      observedFrom: source("beijing-pku-student-cost-reference").fetchedAt.slice(0, 10),
      observedTo: source("beijing-pku-student-cost-reference").fetchedAt.slice(0, 10),
      sampleSize: 1,
      methodologyVersion: "beijing-cost-v1",
      method: "PKU annual accommodation, food and transport/miscellaneous references divided by 12 and summed; rounded display value is CNY 6,000/month.",
      evidenceIds: ["beijing-pku-student-cost-reference"],
      reviewState: "pending",
    },
    {
      persona: "on_campus_student",
      monthlyMinimum: 2000,
      monthlyComfortable: 5850,
      currency: "CNY",
      observedFrom: "2026-01-01",
      observedTo: generatedAt.slice(0, 10),
      sampleSize: 2,
      methodologyVersion: "beijing-cost-v1",
      method: "Lower bound combines BIT's lowest Beijing dorm rate with BNU's lower living-cost reference; upper bound combines 30 days of BNU's highest long-term dorm rate with BNU's upper living-cost reference.",
      evidenceIds: ["beijing-bnu-student-cost-reference", "beijing-bit-student-cost-2026"],
      reviewState: "pending",
    },
  ],
  contentDrafts: [
    {
      locale: "en",
      direction: "ltr",
      translationState: "source_draft",
      reviewState: "pending",
      sections: {
        overview: "Beijing is a large higher-education centre with extensive public transport. The 2025 municipal statistical communique reports 21.8 million residents, 30 rail lines and 909 km of operating rail network at year end.",
        budget: "Selected official university references support draft student profiles of about CNY 2,000–6,000 per month, excluding tuition and a verified off-campus rent range.",
        transport: "The official subway fare begins at CNY 3 for trips within 6 km and rises by distance. Airport express services use separate fares.",
        health: "For a medical emergency, call 120. Recheck foreign-language provider availability before relying on a listed hospital.",
      },
    },
    {
      locale: "vi",
      direction: "ltr",
      translationState: "draft",
      reviewState: "pending",
      sections: {
        overview: "Bắc Kinh là một trung tâm giáo dục đại học lớn với mạng lưới giao thông công cộng rộng. Thông cáo thống kê thành phố năm 2025 ghi nhận 21,8 triệu dân, 30 tuyến đường sắt đô thị và 909 km mạng lưới đang khai thác vào cuối năm.",
        budget: "Các nguồn chính thức được chọn từ trường đại học hỗ trợ mức dự toán sơ bộ khoảng 2.000–6.000 CNY mỗi tháng, chưa gồm học phí và tiền thuê nhà ngoài trường chưa được xác minh.",
        transport: "Giá vé tàu điện ngầm chính thức bắt đầu từ 3 CNY cho quãng đường trong 6 km và tăng theo khoảng cách. Tuyến tốc hành sân bay có mức giá riêng.",
        health: "Trong trường hợp cấp cứu y tế, hãy gọi 120. Cần kiểm tra lại khả năng cung cấp dịch vụ ngoại ngữ trước khi dựa vào danh sách bệnh viện.",
      },
    },
    {
      locale: "th",
      direction: "ltr",
      translationState: "draft",
      reviewState: "pending",
      sections: {
        overview: "ปักกิ่งเป็นศูนย์กลางการศึกษาระดับอุดมศึกษาขนาดใหญ่และมีเครือข่ายขนส่งสาธารณะครอบคลุม แถลงการณ์สถิติของเทศบาลปี 2025 ระบุว่าปลายปีมีประชากร 21.8 ล้านคน รถไฟในเมือง 30 สาย และระยะทางให้บริการ 909 กิโลเมตร",
        budget: "ข้อมูลทางการที่คัดเลือกจากมหาวิทยาลัยรองรับงบประมาณนักศึกษาแบบร่างประมาณ 2,000–6,000 หยวนต่อเดือน โดยไม่รวมค่าเล่าเรียนและค่าเช่านอกมหาวิทยาลัยที่ยังไม่ได้ยืนยัน",
        transport: "ค่าโดยสารรถไฟใต้ดินอย่างเป็นทางการเริ่มที่ 3 หยวนสำหรับระยะทางไม่เกิน 6 กิโลเมตรและเพิ่มตามระยะทาง ส่วนรถไฟด่วนสนามบินใช้ราคาแยกต่างหาก",
        health: "หากมีเหตุฉุกเฉินทางการแพทย์ให้โทร 120 และควรตรวจสอบบริการภาษาต่างประเทศของโรงพยาบาลอีกครั้งก่อนใช้งาน",
      },
    },
    {
      locale: "id",
      direction: "ltr",
      translationState: "draft",
      reviewState: "pending",
      sections: {
        overview: "Beijing adalah pusat pendidikan tinggi besar dengan jaringan transportasi umum yang luas. Komunike statistik kota 2025 mencatat 21,8 juta penduduk, 30 jalur kereta perkotaan, dan 909 km jaringan yang beroperasi pada akhir tahun.",
        budget: "Referensi resmi terpilih dari universitas mendukung rancangan profil biaya mahasiswa sekitar CNY 2.000–6.000 per bulan, belum termasuk uang kuliah dan sewa di luar kampus yang terverifikasi.",
        transport: "Tarif resmi kereta bawah tanah mulai dari CNY 3 untuk perjalanan hingga 6 km dan naik sesuai jarak. Kereta ekspres bandara memiliki tarif terpisah.",
        health: "Untuk keadaan darurat medis, hubungi 120. Periksa kembali ketersediaan layanan bahasa asing sebelum mengandalkan rumah sakit yang tercantum.",
      },
    },
    {
      locale: "ms",
      direction: "ltr",
      translationState: "draft",
      reviewState: "pending",
      sections: {
        overview: "Beijing ialah pusat pendidikan tinggi yang besar dengan rangkaian pengangkutan awam yang luas. Komunike statistik perbandaran 2025 melaporkan 21.8 juta penduduk, 30 laluan rel bandar dan 909 km rangkaian beroperasi pada akhir tahun.",
        budget: "Rujukan rasmi terpilih daripada universiti menyokong draf profil belanja pelajar sekitar CNY 2,000–6,000 sebulan, tidak termasuk yuran pengajian dan sewa luar kampus yang disahkan.",
        transport: "Tambang rasmi kereta api bawah tanah bermula pada CNY 3 untuk perjalanan sehingga 6 km dan meningkat mengikut jarak. Perkhidmatan ekspres lapangan terbang menggunakan tambang berasingan.",
        health: "Untuk kecemasan perubatan, hubungi 120. Semak semula ketersediaan perkhidmatan bahasa asing sebelum bergantung pada hospital yang disenaraikan.",
      },
    },
    {
      locale: "ar",
      direction: "rtl",
      translationState: "draft",
      reviewState: "pending",
      sections: {
        overview: "تُعد بكين مركزًا كبيرًا للتعليم العالي وتتمتع بشبكة واسعة للنقل العام. ووفقًا للبيان الإحصائي البلدي لعام 2025، بلغ عدد السكان 21.8 مليون نسمة، وضمّت شبكة السكك الحضرية 30 خطًا بطول تشغيلي قدره 909 كيلومترات في نهاية العام.",
        budget: "تدعم مراجع رسمية مختارة من الجامعات تقديرًا أوليًا لميزانية الطالب بنحو 2,000–6,000 يوان صيني شهريًا، من دون الرسوم الدراسية أو إيجار السكن خارج الحرم الذي لم يتم التحقق منه.",
        transport: "تبدأ تعرفة المترو الرسمية من 3 يوانات للرحلات حتى 6 كيلومترات وتزداد بحسب المسافة. وتطبق خدمات قطارات المطار السريعة تعرفة منفصلة.",
        health: "في حالات الطوارئ الطبية اتصل بالرقم 120. ويجب إعادة التحقق من توافر الخدمات باللغات الأجنبية قبل الاعتماد على أي مستشفى مدرج.",
      },
    },
  ],
  unresolved: [
    "No defensible official off-campus shared/private rent range has been acquired.",
    "The municipal higher-education accommodation price table may not apply uniformly to international-student housing.",
    "Climate facts remain absent until an exact no-login official Beijing dataset is registered.",
  ],
};

const city = {
  slug: "beijing",
  nameEn: "Beijing",
  nameZh: "北京",
  province: "Beijing Municipality",
  region: "North China",
  monthlyCost: "CUAC draft reference: about CNY 2,000-6,000/month for selected student profiles; tuition excluded",
  tags: ["municipality", "large-city", "extensive-public-transport"],
  nearby: ["tianjin"],
  sortOrder: 1,
  version: 2,
  status: "draft",
  verificationStatus: "unverified",
  content: {
    summary: "Beijing is a municipality with a large higher-education catalog and an extensive public-transport network. All figures in this draft remain pending editorial review.",
    overview: "The 2025 municipal statistical communique reports 21.8 million residents, 30 rail-transit lines and 909 km of operating rail network at year end. CUAC school, program, intake and scholarship counts are computed live rather than copied into this profile.",
    bestFor: ["Broad university choice", "Research-intensive study", "Large-city transport access"],
    quickFacts: [
      { label: "Resident population", value: "21.8 million at 2025 year end", note: "Beijing 2025 statistical communique; review pending" },
      { label: "Rail network", value: "30 lines / 909 km at 2025 year end", note: "Beijing 2025 statistical communique; review pending" },
      { label: "Emergency medical call", value: "120", note: "Beijing medical guide for foreigners; review pending" },
    ],
    budgetSummary: { monthly: "Draft range: CNY 2,000-6,000", yearly: null, note: "Derived from selected official university references; excludes tuition and off-campus private rent." },
    costProfiles: [
      { label: "On-campus student", value: "CNY 2,000-5,850/month", note: "Draft cross-school range using BNU living/dorm references and BIT 2026 Beijing dorm rates." },
      { label: "PKU general reference", value: "About CNY 6,000/month", note: "CNY 35,000 accommodation + 15,000 food + 5,000 transport/misc per academic year, divided by 12." },
    ],
    why: [{ title: "Catalog coverage", body: "Use the live school and program links on this page; published counts are computed from current CUAC records." }],
    costBreakdown: [
      { label: "PKU accommodation reference", value: "CNY 35,000/academic year", note: "School-published reference, not a city-wide rent quote." },
      { label: "PKU food reference", value: "CNY 15,000/academic year", note: "School-published reference." },
      { label: "Subway", value: "From CNY 3 within 6 km", note: "Distance-based official fare table." },
    ],
    lifeSections: [
      { title: "Health and emergency", body: "For a medical emergency, the Beijing guide directs users to call 120. It also lists institutions offering foreign-language medical services; provider availability must be rechecked before publication." },
      { title: "Accommodation", body: "University housing supply and prices differ by institution, campus and room type. Confirm the exact school notice before paying or planning arrival." },
    ],
    transportNotes: [
      { title: "Subway fares", body: "The official table starts at CNY 3 for trips within 6 km and increases by distance. Airport express services use separate pricing." },
      { title: "Arrival", body: "Use the university's current arrival instructions for airport or station transfers and registration timing." },
    ],
    applicationTips: ["Choose a specific school and program before relying on any fee or accommodation figure."],
    applicationAdvice: [],
    relatedProgramKeywords: ["engineering", "business", "language", "medicine", "science"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Beijing schools and programs, then confirm the exact intake and official application channel." }],
    faqs: [
      { question: "Is the monthly budget a guaranteed cost?", answer: "No. It is an unreviewed CUAC draft derived from selected official university references and does not include tuition or a verified off-campus rent range." },
      { question: "Are the school and program counts manually maintained?", answer: "No. CUAC computes them from currently publishable catalog relations." },
    ],
    cityFaqs: [],
  },
  sourceUrl: primary.url,
  sourceLabel: primary.label,
  sourceSha256: primary.sha256,
  capturedAt: primary.fetchedAt,
  sourceFieldLineage: {
    nameEn: "beijing-statistical-communique-2025: page title and municipal scope",
    nameZh: "beijing-statistical-communique-2025: page title",
    province: "beijing-statistical-communique-2025: municipal scope",
    region: "CUAC geographic taxonomy; pending editorial review",
    monthlyCost: "beijing-pku-student-cost-reference + beijing-bnu-student-cost-reference + beijing-bit-student-cost-2026; derived in evidence costSnapshots",
    tags: "CUAC editorial classification; pending review",
    nearby: "CUAC geographic relation; pending review",
    content: "field-level evidence is recorded in catalog.beijing-city-rich-batch-01.evidence.json",
  },
};

const bundle = { version: 1, generatedAt, cities: [city] };
const bundleText = `${JSON.stringify(bundle, null, 2)}\n`;
const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(bundle);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await mkdir(dirname(draftPath), { recursive: true });
await Promise.all([
  writeFile(draftPath, bundleText, "utf8"),
  writeFile(evidencePath, evidenceText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256: sha256(bundleText), evidenceSha256: sha256(evidenceText), publicationAuthorized: false }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, draftPath, evidencePath, validationPath, summary: validation.summary, publicationAuthorized: false }, null, 2));
