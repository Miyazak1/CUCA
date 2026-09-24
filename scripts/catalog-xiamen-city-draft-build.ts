import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const acquisitionRoot = resolve(root, "work/catalog-official");
const prefix = resolve(root, "seeds/catalog.xiamen-city-rich-batch-01");
const requiredSourceIds = ["xiamen-statistical-communique-2023", "xiamen-university-undergraduate-cost-2026"] as const;
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
const primary = source("xiamen-statistical-communique-2023");
const generatedAt = new Date().toISOString();

const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Xiamen is a coastal city in Fujian. Its 2023 statistical communique reports 5.327 million residents, 16 regular higher-education institutions and 226,200 higher-education students including graduate students.", budget: "The current official cost model is scoped to Xiamen University. A Siming-campus student using the published dormitory, food and insurance figures has a derived reference of about CNY 2,117–3,517 per month. Tuition, utilities, transport and personal expenses are excluded.", arrival: "Confirm the campus and accommodation allocation before travel because university beds are limited and prices differ by campus." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Hạ Môn là thành phố ven biển thuộc Phúc Kiến. Thông cáo thống kê năm 2023 ghi nhận 5,327 triệu dân, 16 cơ sở giáo dục đại học chính quy và 226.200 sinh viên đại học, bao gồm học viên sau đại học.", budget: "Mô hình chi phí chính thức hiện chỉ áp dụng cho Đại học Hạ Môn. Với số liệu ký túc xá, ăn uống và bảo hiểm đã công bố, sinh viên tại cơ sở Siming có mức tham khảo suy ra khoảng 2.117–3.517 CNY/tháng. Chưa gồm học phí, điện nước, đi lại và chi tiêu cá nhân.", arrival: "Hãy xác nhận cơ sở học và việc phân bổ chỗ ở trước khi đi vì số giường trong trường có hạn và giá khác nhau theo cơ sở." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "เซี่ยเหมินเป็นเมืองชายฝั่งในมณฑลฝูเจี้ยน แถลงการณ์สถิติปี 2023 ระบุประชากร 5.327 ล้านคน สถาบันอุดมศึกษาปกติ 16 แห่ง และนักศึกษาระดับอุดมศึกษารวมบัณฑิตศึกษา 226,200 คน", budget: "แบบจำลองค่าใช้จ่ายทางการปัจจุบันจำกัดเฉพาะมหาวิทยาลัยเซี่ยเหมิน โดยใช้ค่าหอพัก อาหาร และประกันที่ประกาศไว้ นักศึกษาวิทยาเขตซือหมิงมีค่าอ้างอิงที่คำนวณได้ประมาณ 2,117–3,517 หยวนต่อเดือน ไม่รวมค่าเล่าเรียน ค่าสาธารณูปโภค การเดินทาง และค่าใช้จ่ายส่วนตัว", arrival: "ควรยืนยันวิทยาเขตและการจัดสรรที่พักก่อนเดินทาง เพราะที่พักในมหาวิทยาลัยมีจำนวนจำกัดและราคาแตกต่างกันตามวิทยาเขต" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Xiamen adalah kota pesisir di Fujian. Komunike statistik 2023 mencatat 5,327 juta penduduk, 16 perguruan tinggi reguler, dan 226.200 mahasiswa pendidikan tinggi termasuk pascasarjana.", budget: "Model biaya resmi saat ini hanya untuk Xiamen University. Berdasarkan angka asrama, makanan, dan asuransi yang dipublikasikan, referensi turunan mahasiswa kampus Siming sekitar CNY 2.117–3.517 per bulan. Uang kuliah, utilitas, transportasi, dan biaya pribadi tidak termasuk.", arrival: "Konfirmasikan kampus dan alokasi akomodasi sebelum berangkat karena tempat tidur kampus terbatas dan harga berbeda menurut kampus." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Xiamen ialah bandar pesisir di Fujian. Komunike statistik 2023 melaporkan 5.327 juta penduduk, 16 institusi pengajian tinggi biasa dan 226,200 pelajar pengajian tinggi termasuk siswazah.", budget: "Model kos rasmi semasa hanya untuk Universiti Xiamen. Berdasarkan angka asrama, makanan dan insurans yang diterbitkan, rujukan terbitan bagi pelajar kampus Siming ialah kira-kira CNY 2,117–3,517 sebulan. Yuran pengajian, utiliti, pengangkutan dan belanja peribadi tidak termasuk.", arrival: "Sahkan kampus dan peruntukan penginapan sebelum perjalanan kerana katil kampus terhad dan harga berbeza mengikut kampus." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "شيامن مدينة ساحلية في فوجيان. ويفيد البيان الإحصائي لعام 2023 بأن عدد السكان بلغ 5.327 مليون نسمة، مع 16 مؤسسة تعليم عالٍ نظامية و226,200 طالب في التعليم العالي بمن فيهم طلاب الدراسات العليا.", budget: "يقتصر نموذج التكلفة الرسمي الحالي على جامعة شيامن. وباستخدام أرقام السكن والطعام والتأمين المنشورة، يبلغ المرجع المشتق لطالب حرم سيمينغ نحو 2,117–3,517 يوانًا شهريًا. ولا يشمل الرسوم الدراسية أو المرافق أو النقل أو المصروفات الشخصية.", arrival: "يجب تأكيد الحرم وتخصيص السكن قبل السفر لأن الأسرّة الجامعية محدودة والأسعار تختلف حسب الحرم." },
].map(row => ({ locale: row.locale, direction: row.direction, translationState: row.translationState, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));

const evidence = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  citySlug: "xiamen",
  publicationAuthorized: false,
  sources: requiredSourceIds.map(id => ({ id, url: source(id).url, finalUrl: source(id).finalUrl, title: source(id).label, capturedAt: source(id).fetchedAt, snapshotSha256: source(id).sha256, contentType: source(id).contentType, reviewState: "pending" })),
  acquisitionExceptions: [
    { sourceId: "xiamen-official-city-overview", state: "not_acquired", reason: "Official host returned a TLS certificate for *.chinadaily.com.cn rather than en.fao.xm.gov.cn; strict verification was retained." },
    { sourceId: "xiamen-foreigners-service-guide-index", state: "not_acquired", reason: "Same official-host TLS certificate mismatch; no certificate bypass was used." },
  ],
  facts: [
    { factType: "resident_population", value: 5.327, unit: "million people", observedAt: "2023-12-31", derivation: "explicit", evidenceId: "xiamen-statistical-communique-2023", sourcePath: "Population section", reviewState: "pending" },
    { factType: "resident_urbanization_rate", value: 90.81, unit: "percent", observedAt: "2023-12-31", derivation: "explicit", evidenceId: "xiamen-statistical-communique-2023", sourcePath: "Population section", reviewState: "pending" },
    { factType: "regular_higher_education_institutions", value: 16, unit: "institutions", observedAt: "2023-12-31", derivation: "explicit", evidenceId: "xiamen-statistical-communique-2023", sourcePath: "Education section", reviewState: "pending" },
    { factType: "higher_education_students_including_graduates", value: 226200, unit: "students", observedAt: "2023-12-31", derivation: "explicit", evidenceId: "xiamen-statistical-communique-2023", sourcePath: "Education section", reviewState: "pending" },
    { factType: "xmu_siming_accommodation", value: { minimum: 35, maximum: 65 }, unit: "CNY/person/day", observedAt: "2026", derivation: "explicit", evidenceId: "xiamen-university-undergraduate-cost-2026", sourcePath: "Section VIII.3 accommodation", reviewState: "pending" },
    { factType: "xmu_xiangan_accommodation", value: { minimum: 1600, maximum: 4000 }, unit: "CNY/person/academic-year", observedAt: "2026", derivation: "explicit", evidenceId: "xiamen-university-undergraduate-cost-2026", sourcePath: "Section VIII.3 accommodation", reviewState: "pending" },
    { factType: "xmu_zhangzhou_accommodation", value: { minimum: 1100, maximum: 1200 }, unit: "CNY/person/academic-year", observedAt: "2026", derivation: "explicit", evidenceId: "xiamen-university-undergraduate-cost-2026", sourcePath: "Section VIII.3 accommodation", reviewState: "pending" },
    { factType: "xmu_siming_nearby_off_campus_room", value: 2500, unit: "CNY/room/month, approximate", observedAt: "2026", derivation: "explicit_approximation", evidenceId: "xiamen-university-undergraduate-cost-2026", sourcePath: "Section VIII.3 accommodation", reviewState: "pending" },
    { factType: "xmu_food", value: { minimum: 1000, maximum: 1500 }, unit: "CNY/month", observedAt: "2026", derivation: "explicit", evidenceId: "xiamen-university-undergraduate-cost-2026", sourcePath: "Section VIII.3 food", reviewState: "pending" },
    { factType: "xmu_insurance", value: 800, unit: "CNY/person/year", observedAt: "2026", derivation: "explicit", evidenceId: "xiamen-university-undergraduate-cost-2026", sourcePath: "Section VIII.3 insurance", reviewState: "pending" },
  ],
  costSnapshots: [
    { persona: "xmu_siming_on_campus_student_partial_budget", monthlyMinimum: 2116.67, monthlyComfortable: 3516.67, currency: "CNY", observedFrom: "2026-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "xiamen-xmu-partial-v1", method: "Siming dorm CNY 35–65/day multiplied by 30, plus food CNY 1,000–1,500/month and annual insurance CNY 800 divided by 12.", evidenceIds: ["xiamen-university-undergraduate-cost-2026"], exclusions: ["tuition", "utilities", "local transport", "personal expenses"], reviewState: "pending" },
    { persona: "xmu_siming_off_campus_single_room_partial_budget", monthlyMinimum: 3566.67, monthlyComfortable: 4066.67, currency: "CNY", observedFrom: "2026-01-01", observedTo: generatedAt.slice(0, 10), sampleSize: 1, methodologyVersion: "xiamen-xmu-partial-v1", method: "Approximate CNY 2,500 room rent near Siming, plus food CNY 1,000–1,500/month and annual insurance divided by 12. Assumes one student pays the whole room.", evidenceIds: ["xiamen-university-undergraduate-cost-2026"], exclusions: ["tuition", "utilities", "local transport", "personal expenses"], reviewState: "pending" },
  ],
  contentDrafts: translations,
  unresolved: [
    "The newest acquired city-wide statistical communique is for 2023 and should be upgraded when a newer exact official page is collectable.",
    "The municipal English living-service host currently presents a certificate for a different domain, so arrival and transport guidance was not imported.",
    "The two budget profiles are Xiamen University and Siming-campus scoped; they are not city-wide market estimates.",
    "No defensible official city-wide transport, utilities or personal-expense range has been acquired.",
  ],
};

const city = {
  slug: "xiamen", nameEn: "Xiamen", nameZh: "厦门", province: "Fujian", region: "East China",
  monthlyCost: "CUAC draft Xiamen University Siming partial budget: about CNY 2,117-4,067/month by accommodation mode; tuition and several living categories excluded",
  tags: ["coastal-city", "special-economic-zone", "university-city", "port-city"], nearby: ["quanzhou", "zhangzhou", "fuzhou"], sortOrder: 8,
  version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Xiamen is a coastal Fujian city. All facts, derived budgets and translations remain pending editorial review.",
    overview: "The 2023 official communique reports 5.327 million residents, 16 regular higher-education institutions and 226,200 higher-education students including graduate students.",
    bestFor: ["Coastal-city setting", "Xiamen University routes", "Southeast China access"],
    quickFacts: [{ label: "Resident population", value: "5.327 million at 2023 year end", note: "Official communique; review pending" }, { label: "Higher education", value: "16 regular institutions", note: "2023 official communique" }, { label: "Higher-education students", value: "226,200 including graduates", note: "2023 official communique" }],
    budgetSummary: { monthly: "XMU Siming partial references: about CNY 2,117-4,067", yearly: null, note: "Accommodation mode, food and insurance only; not a complete city budget." },
    costProfiles: [{ label: "Siming campus partial budget", value: "CNY 2,117-3,517/month", note: "Derived from official dorm, food and insurance figures." }, { label: "Near-Siming single-room partial budget", value: "CNY 3,567-4,067/month", note: "Assumes one student pays the approximate room rent." }],
    why: [{ title: "Student scale", body: "The 2023 communique reports 226,200 students in regular higher education including graduate students." }],
    costBreakdown: [{ label: "Siming dormitory", value: "CNY 35-65/person/day", note: "Utilities excluded." }, { label: "Food", value: "CNY 1,000-1,500/month", note: "XMU 2026 reference." }, { label: "Insurance", value: "CNY 800/person/year", note: "XMU 2026 reference." }],
    lifeSections: [{ title: "Accommodation planning", body: "On-campus beds are limited and prices vary across Siming, Xiang'an and Zhangzhou campuses." }],
    transportNotes: [],
    applicationTips: ["Confirm the exact campus, intake and accommodation allocation before relying on a budget."], applicationAdvice: [], relatedProgramKeywords: ["marine science", "economics", "management", "medicine", "Chinese language"],
    nextSteps: [{ title: "Compare live routes", body: "Open current Xiamen programs and confirm the intake and official application channel." }],
    faqs: [{ question: "Is this a city-wide monthly budget?", answer: "No. It is a transparent Xiamen University partial-budget reference and excludes several categories." }], cityFaqs: [],
  },
  sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
  sourceFieldLineage: { nameEn: "xiamen-statistical-communique-2023: municipal scope", nameZh: "xiamen-statistical-communique-2023: page title", province: "official administrative scope", region: "CUAC geographic taxonomy; pending review", monthlyCost: "xiamen-university-undergraduate-cost-2026; derived transparently in evidence costSnapshots", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.xiamen-city-rich-batch-01.evidence.json" },
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
