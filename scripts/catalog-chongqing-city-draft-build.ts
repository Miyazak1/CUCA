import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const sourceId = "chongqing-statistical-communique-2025";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
let source: SourceRow | undefined;
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official", entry.name, "manifest.json"), "utf8"));
    for (const row of manifest.sources || []) if (row.id === sourceId && (!source || Date.parse(row.fetchedAt) > Date.parse(source.fetchedAt))) source = row;
  } catch { /* Ignore incomplete runs. */ }
}
if (!source) throw new Error(`Missing acquired source ${sourceId}.`);
const generatedAt = new Date().toISOString();
const translations = [
  { locale: "en", direction: "ltr", translationState: "source_draft", overview: "Chongqing is a municipality in southwest China. Its official 2025 communique reports 31.8726 million permanent residents, 73.02% urbanization and 75 regular higher-education institutions.", budget: "No student-specific city budget is asserted. The official communique reports average urban resident consumption, which is contextual and must not be presented as a student budget.", arrival: "Confirm the exact university campus, intake and arrival instructions before travel." },
  { locale: "vi", direction: "ltr", translationState: "draft", overview: "Trùng Khánh là thành phố trực thuộc trung ương ở tây nam Trung Quốc. Công báo chính thức năm 2025 ghi nhận 31,8726 triệu dân thường trú, tỷ lệ đô thị hóa 73,02% và 75 cơ sở giáo dục đại học chính quy.", budget: "Không khẳng định ngân sách riêng cho sinh viên. Mức chi tiêu bình quân của cư dân đô thị trong công báo chỉ dùng làm bối cảnh, không phải ngân sách sinh viên.", arrival: "Xác nhận cơ sở, kỳ nhập học và hướng dẫn đến trường trước khi đi." },
  { locale: "th", direction: "ltr", translationState: "draft", overview: "ฉงชิ่งเป็นนครขึ้นตรงต่อส่วนกลางในภาคตะวันตกเฉียงใต้ของจีน แถลงสถิติทางการปี 2025 ระบุประชากรถาวร 31.8726 ล้านคน อัตราความเป็นเมือง 73.02% และสถาบันอุดมศึกษาปกติ 75 แห่ง", budget: "ยังไม่มีการระบุงบประมาณสำหรับนักศึกษา ค่าใช้จ่ายเฉลี่ยของชาวเมืองในแถลงสถิติใช้เป็นเพียงบริบท ไม่ใช่งบประมาณนักศึกษา", arrival: "ยืนยันวิทยาเขต รอบรับสมัคร และคำแนะนำการเดินทางจากมหาวิทยาลัยก่อนออกเดินทาง" },
  { locale: "id", direction: "ltr", translationState: "draft", overview: "Chongqing adalah munisipalitas di Tiongkok barat daya. Komunike resmi 2025 mencatat 31,8726 juta penduduk tetap, urbanisasi 73,02%, dan 75 institusi pendidikan tinggi reguler.", budget: "Belum ada anggaran khusus mahasiswa. Pengeluaran rata-rata penduduk perkotaan dalam komunike hanya konteks dan bukan anggaran mahasiswa.", arrival: "Konfirmasikan kampus, periode penerimaan, dan petunjuk kedatangan universitas sebelum berangkat." },
  { locale: "ms", direction: "ltr", translationState: "draft", overview: "Chongqing ialah perbandaran di barat daya China. Komunike rasmi 2025 melaporkan 31.8726 juta penduduk tetap, kadar perbandaran 73.02% dan 75 institusi pengajian tinggi biasa.", budget: "Tiada bajet khusus pelajar dinyatakan. Perbelanjaan purata penduduk bandar dalam komunike hanyalah konteks dan bukan bajet pelajar.", arrival: "Sahkan kampus, pengambilan dan arahan ketibaan universiti sebelum perjalanan." },
  { locale: "ar", direction: "rtl", translationState: "draft", overview: "تشونغتشينغ بلدية في جنوب غرب الصين. ويذكر البيان الرسمي لعام 2025 أن عدد السكان الدائمين 31.8726 مليونًا، ونسبة التحضر 73.02%، وعدد مؤسسات التعليم العالي النظامية 75.", budget: "لا تتضمن المسودة ميزانية خاصة بالطلاب. ومتوسط إنفاق سكان الحضر الوارد في البيان سياق عام وليس ميزانية طالب.", arrival: "أكد الحرم وموعد القبول وتعليمات الوصول الصادرة عن الجامعة قبل السفر." },
].map(row => ({ ...row, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));
const evidence = {
  version: 1, status: "unreviewed_draft", generatedAt, citySlug: "chongqing", publicationAuthorized: false,
  sources: [{ id: sourceId, url: source.url, finalUrl: source.finalUrl, title: source.label, capturedAt: source.fetchedAt, snapshotSha256: source.sha256, contentType: source.contentType, reviewState: "pending" }],
  facts: [
    { factType: "gross_domestic_product", value: 33757.93, unit: "CNY 100 million", observedAt: "2025-12-31", derivation: "explicit", evidenceId: sourceId, sourcePath: "Section 1 Comprehensive", reviewState: "pending" },
    { factType: "permanent_population", value: 3187.26, unit: "10,000 people", observedAt: "2025-12-31", derivation: "explicit", evidenceId: sourceId, sourcePath: "Section 1 Comprehensive", reviewState: "pending" },
    { factType: "urbanization_rate", value: 73.02, unit: "percent", observedAt: "2025-12-31", derivation: "explicit", evidenceId: sourceId, sourcePath: "Section 1 Comprehensive", reviewState: "pending" },
    { factType: "regular_higher_education_institutions", value: 75, unit: "institutions", observedAt: "2025-12-31", derivation: "explicit", evidenceId: sourceId, sourcePath: "Section 10 Science, technology and education", reviewState: "pending" },
    { factType: "urban_resident_consumption_per_capita", value: 32764, unit: "CNY/person/year", observedAt: "2025-12-31", derivation: "explicit_context_only", evidenceId: sourceId, sourcePath: "Section 9 Income, consumption and social security", reviewState: "pending" },
  ],
  costSnapshots: [], contentDrafts: translations,
  unresolved: ["Acquire student-specific official accommodation and living-cost evidence before setting a budget.", "Acquire official international-arrival and transport guidance.", "The municipality-wide figures are not equivalent to the urban core or to a student's campus environment."],
};
const city = {
  slug: "chongqing", nameEn: "Chongqing", nameZh: "重庆", province: "Chongqing", region: "Southwest China",
  tags: ["municipality", "western-china-centre", "higher-education-centre"], nearby: ["chengdu", "guiyang"], sortOrder: 18, version: 2, status: "draft", verificationStatus: "unverified",
  content: {
    summary: "Chongqing is a southwest-China municipality with a large higher-education system. This official-statistics draft remains incomplete and unreviewed.",
    overview: "The 2025 official communique reports 31.8726 million permanent residents, 73.02% urbanization and 75 regular higher-education institutions.",
    bestFor: ["Southwest China access", "Large municipal higher-education system"],
    quickFacts: [{ label: "Permanent population", value: "31.8726 million", note: "2025 official communique" }, { label: "Urbanization", value: "73.02%", note: "2025 official communique" }, { label: "Regular HE institutions", value: "75", note: "2025 official communique" }],
    budgetSummary: { monthly: null, yearly: null, note: "No student-specific official budget acquired." }, costProfiles: [],
    why: [{ title: "Large education market", body: "The official communique reports 75 regular higher-education institutions across the municipality." }], costBreakdown: [], lifeSections: [], transportNotes: [],
    applicationTips: ["Confirm the exact campus; Chongqing municipality covers a very large geographic area."], applicationAdvice: [], relatedProgramKeywords: [],
    nextSteps: [{ title: "Compare live routes", body: "Open current Chongqing programs and verify the school, campus and intake." }],
    faqs: [{ question: "Is the resident consumption figure a student budget?", answer: "No. It is retained only as municipal context and is not used as a student-cost estimate." }], cityFaqs: [],
  },
  sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { nameEn: "official municipal scope", nameZh: "official municipal scope", province: "municipality status", region: "CUAC geographic taxonomy; pending review", tags: "CUAC editorial classification; pending review", nearby: "CUAC geographic relation; pending review", content: "field-level evidence is recorded in catalog.chongqing-city-rich-batch-01.evidence.json" },
};
const bundle = { version: 1, generatedAt, cities: [city] };
const bundleText = JSON.stringify(bundle, null, 2) + "\n";
const evidenceText = JSON.stringify(evidence, null, 2) + "\n";
const validation = createCatalogMigrationValidationReport(bundle);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const prefix = resolve(root, "seeds/catalog.chongqing-city-rich-batch-01");
await mkdir(dirname(prefix), { recursive: true });
await Promise.all([
  writeFile(prefix + ".draft.json", bundleText, "utf8"),
  writeFile(prefix + ".evidence.json", evidenceText, "utf8"),
  writeFile(prefix + ".validation.json", JSON.stringify({ ...validation, candidateSha256: sha256(bundleText), evidenceSha256: sha256(evidenceText), publicationAuthorized: false }, null, 2) + "\n", "utf8"),
]);
console.log(JSON.stringify({ ok: true, prefix, factCount: evidence.facts.length, localeCount: translations.length, publicationAuthorized: false }, null, 2));
