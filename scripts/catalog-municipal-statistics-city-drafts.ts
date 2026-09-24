import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
const root = process.cwd();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const configs = [
  { slug: "zhengzhou", nameEn: "Zhengzhou", nameZh: "郑州", province: "Henan", region: "Central China", year: 2025, sourceId: "zhengzhou-statistical-communique-2025", gdp: 15244.6, population: 1313.8, urbanization: 81.52, educationLabel: "Current CUAC catalog", educationValue: "1 linked school / 16 linked programs", note: "Municipal higher-education totals still need structured extraction." },
  { slug: "shijiazhuang", nameEn: "Shijiazhuang", nameZh: "石家庄", province: "Hebei", region: "North China", year: 2025, sourceId: "shijiazhuang-statistical-communique-2025", gdp: 8651.7, population: 1124.69, urbanization: 73.57, higherEducationInstitutions: 50, higherEducationStudents: 75.29, educationLabel: "Higher-education institutions", educationValue: "50", note: "Includes 46 regular and 4 adult HE institutions; published student total is 752,900." },
  { slug: "lanzhou", nameEn: "Lanzhou", nameZh: "兰州", province: "Gansu", region: "Northwest China", year: 2024, sourceId: "lanzhou-statistical-communique-2024", gdp: 3742.3, population: 443.65, urbanization: 85.83, educationLabel: "Current CUAC catalog", educationValue: "1 linked school / 10 linked programs", note: "Student-specific cost and municipal higher-education totals still need official evidence." },
] as const;
const latest = new Map<string, SourceRow>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official", entry.name, "manifest.json"), "utf8"));
    for (const row of manifest.sources || []) {
      const previous = latest.get(row.id);
      if (!previous || Date.parse(row.fetchedAt) > Date.parse(previous.fetchedAt)) latest.set(row.id, row);
    }
  } catch { /* Ignore incomplete acquisition directories. */ }
}
const generatedAt = new Date().toISOString();
const results = [];
for (const [index, config] of configs.entries()) {
  const source = latest.get(config.sourceId);
  if (!source) throw new Error(`Missing acquired source ${config.sourceId}.`);
  const translations = [
    { locale: "en", direction: "ltr", translationState: "source_draft", overview: `${config.nameEn}'s official ${config.year} communique reports ${config.population} ten-thousand permanent residents, ${config.urbanization}% urbanization and GDP of CNY ${config.gdp} hundred million.`, budget: "No student-specific official budget is asserted; unsupported cost categories remain empty.", arrival: "Confirm the exact university campus, intake and arrival instructions before travel." },
    { locale: "vi", direction: "ltr", translationState: "draft", overview: `Công báo chính thức năm ${config.year} của ${config.nameEn} ghi nhận ${config.population} vạn dân thường trú, tỷ lệ đô thị hóa ${config.urbanization}% và GDP ${config.gdp} trăm triệu CNY.`, budget: "Chưa công bố ngân sách sinh viên chính thức; các hạng mục chi phí chưa có nguồn được để trống.", arrival: "Xác nhận cơ sở, kỳ nhập học và hướng dẫn đến trường trước khi đi." },
    { locale: "th", direction: "ltr", translationState: "draft", overview: `แถลงสถิติทางการปี ${config.year} ของ ${config.nameEn} ระบุประชากรถาวร ${config.population} หมื่นคน อัตราความเป็นเมือง ${config.urbanization}% และ GDP ${config.gdp} ร้อยล้านหยวน`, budget: "ยังไม่มีงบประมาณนักศึกษาอย่างเป็นทางการ และเว้นข้อมูลค่าใช้จ่ายที่ไม่มีแหล่งอ้างอิงไว้", arrival: "ยืนยันวิทยาเขต รอบรับสมัคร และคำแนะนำการเดินทางก่อนออกเดินทาง" },
    { locale: "id", direction: "ltr", translationState: "draft", overview: `Komunike resmi ${config.year} ${config.nameEn} mencatat ${config.population} sepuluh-ribu penduduk tetap, urbanisasi ${config.urbanization}%, dan PDB CNY ${config.gdp} ratus juta.`, budget: "Belum ada anggaran resmi khusus mahasiswa; kategori biaya tanpa sumber dibiarkan kosong.", arrival: "Konfirmasikan kampus, periode penerimaan, dan petunjuk kedatangan sebelum berangkat." },
    { locale: "ms", direction: "ltr", translationState: "draft", overview: `Komunike rasmi ${config.year} ${config.nameEn} melaporkan ${config.population} puluh ribu penduduk tetap, kadar perbandaran ${config.urbanization}% dan KDNK CNY ${config.gdp} ratus juta.`, budget: "Tiada bajet rasmi khusus pelajar; kategori kos tanpa sumber dikosongkan.", arrival: "Sahkan kampus, pengambilan dan arahan ketibaan sebelum perjalanan." },
    { locale: "ar", direction: "rtl", translationState: "draft", overview: `يفيد البيان الرسمي لعام ${config.year} لمدينة ${config.nameEn} بأن عدد السكان الدائمين ${config.population} بوحدة عشرة آلاف، ونسبة التحضر ${config.urbanization}%، والناتج المحلي ${config.gdp} مئة مليون يوان.`, budget: "لا تتضمن المسودة ميزانية رسمية خاصة بالطلاب، وتبقى فئات التكلفة غير المسندة فارغة.", arrival: "أكد الحرم وموعد القبول وتعليمات الوصول قبل السفر." },
  ].map(row => ({ ...row, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));
  const facts: Record<string, unknown>[] = [
    { factType: "gross_domestic_product", value: config.gdp, unit: "CNY 100 million", observedAt: `${config.year}-12-31`, derivation: "explicit", evidenceId: config.sourceId, sourcePath: "Comprehensive section", reviewState: "pending" },
    { factType: "permanent_population", value: config.population, unit: "10,000 people", observedAt: `${config.year}-12-31`, derivation: "explicit", evidenceId: config.sourceId, sourcePath: "Comprehensive section", reviewState: "pending" },
    { factType: "urbanization_rate", value: config.urbanization, unit: "percent", observedAt: `${config.year}-12-31`, derivation: "explicit", evidenceId: config.sourceId, sourcePath: "Comprehensive section", reviewState: "pending" },
  ];
  if ("higherEducationInstitutions" in config) facts.push({ factType: "higher_education_institutions", value: config.higherEducationInstitutions, unit: "institutions", observedAt: `${config.year}-12-31`, derivation: "explicit", evidenceId: config.sourceId, sourcePath: "Education section", reviewState: "pending" });
  if ("higherEducationStudents" in config) facts.push({ factType: "higher_education_students", value: config.higherEducationStudents, unit: "10,000 students", observedAt: `${config.year}-12-31`, derivation: "explicit", evidenceId: config.sourceId, sourcePath: "Education section", reviewState: "pending" });
  const evidence = { version: 1, status: "unreviewed_draft", generatedAt, citySlug: config.slug, publicationAuthorized: false, sources: [{ id: config.sourceId, url: source.url, finalUrl: source.finalUrl, title: source.label, capturedAt: source.fetchedAt, snapshotSha256: source.sha256, contentType: source.contentType, reviewState: "pending" }], facts, costSnapshots: [], contentDrafts: translations, unresolved: ["Acquire student-specific official cost evidence before setting a budget.", "Acquire official international-arrival and public-transport guidance.", config.note] };
  const city = {
    slug: config.slug, nameEn: config.nameEn, nameZh: config.nameZh, province: config.province, region: config.region,
    tags: ["provincial-capital", "municipal-statistics-draft"], nearby: [], sortOrder: 30 + index, version: 2, status: "draft", verificationStatus: "unverified",
    content: { summary: `${config.nameEn} has a current official-statistics draft; student costs and international-arrival guidance remain incomplete.`, overview: `${config.nameEn}'s official ${config.year} communique reports ${config.population} ten-thousand permanent residents and ${config.urbanization}% urbanization.`, bestFor: ["Current linked CUAC routes"], quickFacts: [{ label: "Permanent population", value: `${config.population} ten-thousand`, note: `${config.year} official communique` }, { label: "Urbanization", value: `${config.urbanization}%`, note: `${config.year} official communique` }, { label: config.educationLabel, value: config.educationValue, note: config.note }], budgetSummary: { monthly: null, yearly: null, note: "No student-specific official budget acquired." }, costProfiles: [], why: [{ title: "Active catalog relationship", body: `${config.nameEn} currently has school and program relationships in CUAC.` }], costBreakdown: [], lifeSections: [], transportNotes: [], applicationTips: ["Confirm the exact university campus and current intake."], applicationAdvice: [], relatedProgramKeywords: [], nextSteps: [{ title: "Compare live routes", body: `Open current ${config.nameEn} programs and verify the school and campus.` }], faqs: [{ question: `Is there a complete ${config.nameEn} student budget?`, answer: "No. Unsupported cost fields remain empty." }], cityFaqs: [] },
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: { nameEn: "official municipal scope", nameZh: "official municipal scope", province: "CUAC identity normalization draft; pending review", region: "CUAC geographic taxonomy; pending review", tags: "CUAC evidence-stage classification", nearby: "not populated", content: `field-level evidence is recorded in catalog.${config.slug}-city-rich-batch-01.evidence.json` },
  };
  const bundle = { version: 1, generatedAt, cities: [city] };
  const bundleText = JSON.stringify(bundle, null, 2) + "\n";
  const evidenceText = JSON.stringify(evidence, null, 2) + "\n";
  const validation = createCatalogMigrationValidationReport(bundle);
  if (!validation.ok) throw new Error(`${config.slug}: ${validation.errors.join("\n")}`);
  const prefix = resolve(root, `seeds/catalog.${config.slug}-city-rich-batch-01`);
  await mkdir(resolve(root, "seeds"), { recursive: true });
  await Promise.all([writeFile(prefix + ".draft.json", bundleText, "utf8"), writeFile(prefix + ".evidence.json", evidenceText, "utf8"), writeFile(prefix + ".validation.json", JSON.stringify({ ...validation, candidateSha256: sha256(bundleText), evidenceSha256: sha256(evidenceText), publicationAuthorized: false }, null, 2) + "\n", "utf8")]);
  results.push({ slug: config.slug, factCount: facts.length, localeCount: translations.length, publicationAuthorized: false });
}
console.log(JSON.stringify({ ok: true, results }, null, 2));
