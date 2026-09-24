import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";

type SourceRow = { id: string; label: string; url: string; finalUrl: string; fetchedAt: string; sha256: string; contentType: string };
type RegistryRow = { id: string; sourceRole: string; schoolSlug?: string };
type InventoryRow = { slug: string; nameEn: string; nameZh: string; schoolCount: number; programCount: number; englishProgramCount: number; scholarshipCount: number };

const root = process.cwd();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const configs = [
  { slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", province: "Shanghai", region: "East China", school: "Shanghai public universities", schoolSlugs: ["donghua-university", "east-china-normal-university", "east-china-university-of-political-science-and-law", "fudan-university", "shanghai-international-studies-university", "shanghai-jiao-tong-university", "shanghai-jiao-tong-university-school-of-medicine", "shanghai-university", "shanghai-university-of-political-science-and-law", "tongji-university"] },
  { slug: "guiyang", nameEn: "Guiyang", nameZh: "贵阳", province: "Guizhou", region: "Southwest China", school: "Guizhou Medical University", schoolSlugs: ["guizhou-medical-university"] },
  { slug: "changsha", nameEn: "Changsha", nameZh: "长沙", province: "Hunan", region: "Central China", school: "Central South University", schoolSlugs: ["central-south-university"] },
  { slug: "xian", nameEn: "Xi'an", nameZh: "西安", province: "Shaanxi", region: "Northwest China", school: "Xi'an Jiaotong University", schoolSlugs: ["xi-an-jiaotong-university", "northwestern-polytechnical-university", "chang-an-university"] },
  { slug: "harbin", nameEn: "Harbin", nameZh: "哈尔滨", province: "Heilongjiang", region: "Northeast China", school: "Harbin Institute of Technology", schoolSlugs: ["harbin-institute-of-technology", "harbin-engineering-university", "harbin-university-of-science-and-technology"] },
  { slug: "changchun", nameEn: "Changchun", nameZh: "长春", province: "Jilin", region: "Northeast China", school: "Jilin University", schoolSlugs: ["jilin-university"] },
  { slug: "jinan", nameEn: "Jinan", nameZh: "济南", province: "Shandong", region: "East China", school: "Shandong University", schoolSlugs: ["shandong-university", "shandong-normal-university"] },
  { slug: "xiangtan", nameEn: "Xiangtan", nameZh: "湘潭", province: "Hunan", region: "Central China", school: "Xiangtan University", schoolSlugs: ["xiangtan-university"] },
  { slug: "shenzhen", nameEn: "Shenzhen", nameZh: "深圳", province: "Guangdong", region: "South China", school: "Southern University of Science and Technology", schoolSlugs: ["southern-university-of-science-and-technology", "harbin-institute-of-technology-shenzhen"] },
  { slug: "qingdao", nameEn: "Qingdao", nameZh: "青岛", province: "Shandong", region: "East China", school: "Ocean University of China", schoolSlugs: ["ocean-university-of-china", "qingdao-university"] },
  { slug: "kunming", nameEn: "Kunming", nameZh: "昆明", province: "Yunnan", region: "Southwest China", school: "Yunnan University of Finance and Economics", schoolSlugs: ["yunnan-university-of-finance-and-economics", "yunnan-minzu-university"], accommodationMinimum: 4800, accommodationMaximum: 6000, accommodationUnit: "CNY/person/year", accommodationSourceId: "kunming-ynufe-study-guide-current" },
  { slug: "qinhuangdao", nameEn: "Qinhuangdao", nameZh: "秦皇岛", province: "Hebei", region: "North China", school: "Yanshan University", schoolSlugs: ["yanshan-university"] },
  { slug: "nanning", nameEn: "Nanning", nameZh: "南宁", province: "Guangxi", region: "South China", school: "Guangxi Medical University", schoolSlugs: ["guangxi-medical-university"], accommodationMinimum: 6000, accommodationMaximum: 6000, accommodationUnit: "CNY/person/year", accommodationSourceId: "nanning-gxmu-undergraduate-admission-2026" },
] as const;

const inventory = JSON.parse(await readFile(resolve(root, "work/city-data/city-inventory.json"), "utf8"));
const inventoryBySlug = new Map<string, InventoryRow>(inventory.cities.map((row: InventoryRow) => [row.slug, row]));
const registry = JSON.parse(await readFile(resolve(root, "catalog-sources/official-sources.json"), "utf8"));
const registryById = new Map<string, RegistryRow>(registry.sources.map((row: RegistryRow) => [row.id, row]));
const latest = new Map<string, SourceRow>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official", entry.name, "manifest.json"), "utf8"));
    for (const row of manifest.sources || []) {
      const previous = latest.get(row.id);
      if (!previous || Date.parse(row.fetchedAt) > Date.parse(previous.fetchedAt)) latest.set(row.id, row);
    }
  } catch { /* Ignore incomplete runs. */ }
}

const generatedAt = new Date().toISOString();
const results = [];
for (const [index, config] of configs.entries()) {
  const catalog = inventoryBySlug.get(config.slug);
  if (!catalog) throw new Error(`Missing inventory row for ${config.slug}.`);
  const schoolSlugs = new Set<string>(config.schoolSlugs);
  const sources = [...latest.values()].filter(row => {
    const registered = registryById.get(row.id);
    return registered?.schoolSlug && schoolSlugs.has(registered.schoolSlug);
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (!sources.length) throw new Error(`No acquired official school evidence for ${config.slug}.`);
  const primary = sources.find(row => registryById.get(row.id)?.sourceRole === "school-admissions") || sources[0];
  const localeRows = [
    { locale: "en", direction: "ltr", translationState: "source_draft", overview: `${config.nameEn} currently has ${catalog.schoolCount} linked school record(s) and ${catalog.programCount} linked program record(s) in the CUAC catalog. This draft organizes acquired official material led by ${config.school}.`, budget: "No city-wide student budget is asserted. Cost data remains empty until an exact, current official source is acquired and normalized.", arrival: "Confirm the exact campus, intake and university instructions before travel." },
    { locale: "vi", direction: "ltr", translationState: "draft", overview: `${config.nameEn} hiện có ${catalog.schoolCount} hồ sơ trường và ${catalog.programCount} hồ sơ chương trình được liên kết trong danh mục CUAC. Bản nháp này sắp xếp tài liệu chính thức đã thu thập, chủ yếu từ ${config.school}.`, budget: "Chưa công bố ngân sách sinh viên cấp thành phố. Dữ liệu chi phí để trống cho đến khi có nguồn chính thức, hiện hành và chính xác.", arrival: "Xác nhận cơ sở, kỳ nhập học và hướng dẫn của trường trước khi đi." },
    { locale: "th", direction: "ltr", translationState: "draft", overview: `${config.nameEn} มีข้อมูลสถาบัน ${catalog.schoolCount} แห่งและหลักสูตร ${catalog.programCount} รายการที่เชื่อมโยงในแค็ตตาล็อก CUAC ร่างนี้จัดระเบียบหลักฐานทางการที่เก็บมา โดยมี ${config.school} เป็นแหล่งหลัก`, budget: "ยังไม่มีการระบุงบประมาณนักศึกษาระดับเมือง ข้อมูลค่าใช้จ่ายจะเว้นไว้จนกว่าจะได้แหล่งทางการที่เป็นปัจจุบันและตรงประเด็น", arrival: "ยืนยันวิทยาเขต รอบรับสมัคร และคำแนะนำของมหาวิทยาลัยก่อนเดินทาง" },
    { locale: "id", direction: "ltr", translationState: "draft", overview: `${config.nameEn} saat ini memiliki ${catalog.schoolCount} catatan sekolah dan ${catalog.programCount} catatan program tertaut dalam katalog CUAC. Draf ini menata materi resmi yang telah diperoleh, terutama dari ${config.school}.`, budget: "Belum ada anggaran mahasiswa tingkat kota yang dinyatakan. Data biaya tetap kosong sampai sumber resmi yang tepat dan terkini diperoleh.", arrival: "Konfirmasikan kampus, periode penerimaan, dan petunjuk universitas sebelum berangkat." },
    { locale: "ms", direction: "ltr", translationState: "draft", overview: `${config.nameEn} kini mempunyai ${catalog.schoolCount} rekod institusi dan ${catalog.programCount} rekod program yang dipautkan dalam katalog CUAC. Draf ini menyusun bahan rasmi yang diperoleh, diterajui oleh ${config.school}.`, budget: "Tiada bajet pelajar seluruh bandar dinyatakan. Data kos dikosongkan sehingga sumber rasmi yang tepat dan semasa diperoleh.", arrival: "Sahkan kampus, pengambilan dan arahan universiti sebelum perjalanan." },
    { locale: "ar", direction: "rtl", translationState: "draft", overview: `تضم ${config.nameEn} حاليًا ${catalog.schoolCount} من سجلات المؤسسات و${catalog.programCount} من سجلات البرامج المرتبطة في فهرس CUAC. تنظّم هذه المسودة المواد الرسمية التي جُمعت، وفي مقدمتها مواد ${config.school}.`, budget: "لا تتضمن المسودة تقديرًا لميزانية الطالب على مستوى المدينة. وتبقى بيانات التكلفة فارغة حتى الحصول على مصدر رسمي حديث ودقيق.", arrival: "أكد الحرم وموعد القبول وتعليمات الجامعة قبل السفر." },
  ].map(row => ({ ...row, reviewState: "pending", sections: { overview: row.overview, budget: row.budget, arrival: row.arrival } }));
  const facts: Record<string, unknown>[] = [];
  const costSnapshots: Record<string, unknown>[] = [];
  if ("accommodationSourceId" in config) {
    facts.push({ factType: "university_accommodation_rate", valueMinimum: config.accommodationMinimum, valueMaximum: config.accommodationMaximum, unit: config.accommodationUnit, derivation: "explicit", evidenceId: config.accommodationSourceId, sourcePath: "Official university accommodation or fee table", reviewState: "pending" });
    costSnapshots.push({ persona: `${config.school} on-campus accommodation only`, monthlyMinimum: config.accommodationMinimum / 12, monthlyComfortable: config.accommodationMaximum / 12, currency: "CNY", observedFrom: null, observedTo: generatedAt.slice(0, 10), sampleSize: config.accommodationMinimum === config.accommodationMaximum ? 1 : 2, methodologyVersion: "school-accommodation-annual-v1", method: "Published per-person annual accommodation fee divided by 12 months.", evidenceIds: [config.accommodationSourceId], exclusions: ["utilities unless explicitly included", "deposit", "food", "transport", "personal expenses", "tuition"], reviewState: "pending" });
  }
  const evidence = {
    version: 1, status: "unreviewed_draft", generatedAt, citySlug: config.slug, publicationAuthorized: false,
    evidenceScope: "school_official_materials_only",
    sources: sources.map(row => ({ id: row.id, url: row.url, finalUrl: row.finalUrl, title: row.label, capturedAt: row.fetchedAt, snapshotSha256: row.sha256, contentType: row.contentType, sourceRole: registryById.get(row.id)?.sourceRole, reviewState: "pending" })),
    catalogRelationSnapshot: { capturedAt: inventory.generatedAt, schoolCount: catalog.schoolCount, programCount: catalog.programCount, englishProgramCount: catalog.englishProgramCount, verifiedScholarshipCount: catalog.scholarshipCount, note: "Planning counts from local catalog relations; not official municipal facts." },
    facts, costSnapshots, contentDrafts: localeRows,
    unresolved: ["Acquire a current exact municipal statistical source.", "Acquire official city international-arrival and public-transport guidance where available.", "Acquire current official student cost evidence before setting any city-wide budget.", "All school materials and translations remain pending review."],
  };
  const city = {
    slug: config.slug, nameEn: config.nameEn, nameZh: config.nameZh, province: config.province, region: config.region,
    tags: ["school-evidence-draft"], nearby: [], sortOrder: 20 + index, version: 2, status: "draft", verificationStatus: "unverified",
    content: {
      summary: `${config.nameEn} has an official-school-evidence draft. Municipal statistics and a complete student budget remain intentionally absent.`,
      overview: `The CUAC planning catalog links ${catalog.schoolCount} school record(s), ${catalog.programCount} program record(s), ${catalog.englishProgramCount} English-program record(s) and ${catalog.scholarshipCount} verified scholarship record(s) to ${config.nameEn}. These are internal relation counts, not municipal statistics.`,
      bestFor: [`Current ${config.school} routes`], quickFacts: [{ label: "Official evidence scope", value: `${sources.length} acquired school source(s)`, note: "No city-wide facts inferred" }],
      budgetSummary: { monthly: null, yearly: null, note: "No defensible city-wide student budget acquired." }, costProfiles: [],
      why: [{ title: "Catalog relevance", body: `${config.nameEn} is retained because it has active school and program relationships in the CUAC catalog.` }], costBreakdown: [], lifeSections: [], transportNotes: [],
      applicationTips: ["Confirm the exact school campus, intake and current official instructions."], applicationAdvice: [], relatedProgramKeywords: [],
      nextSteps: [{ title: "Compare live routes", body: `Open current ${config.nameEn} programs and confirm the school and campus.` }],
      faqs: [{ question: `Does CUAC have a complete ${config.nameEn} living-cost estimate?`, answer: "No. The current draft organizes school evidence only and leaves unsupported city fields empty." }], cityFaqs: [],
    },
    sourceUrl: primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt,
    sourceFieldLineage: { nameEn: "CUAC identity normalization draft", nameZh: "CUAC identity normalization draft", province: "CUAC identity normalization draft; pending review", region: "CUAC geographic taxonomy; pending review", tags: "CUAC evidence-stage classification", nearby: "not populated", content: `field-level evidence is recorded in catalog.${config.slug}-city-rich-batch-01.evidence.json` },
  };
  const bundle = { version: 1, generatedAt, cities: [city] };
  const bundleText = JSON.stringify(bundle, null, 2) + "\n";
  const evidenceText = JSON.stringify(evidence, null, 2) + "\n";
  const validation = createCatalogMigrationValidationReport(bundle);
  if (!validation.ok) throw new Error(`${config.slug}: ${validation.errors.join("\n")}`);
  const prefix = resolve(root, `seeds/catalog.${config.slug}-city-rich-batch-01`);
  await mkdir(resolve(root, "seeds"), { recursive: true });
  await Promise.all([
    writeFile(prefix + ".draft.json", bundleText, "utf8"),
    writeFile(prefix + ".evidence.json", evidenceText, "utf8"),
    writeFile(prefix + ".validation.json", JSON.stringify({ ...validation, candidateSha256: sha256(bundleText), evidenceSha256: sha256(evidenceText), publicationAuthorized: false }, null, 2) + "\n", "utf8"),
  ]);
  results.push({ slug: config.slug, acquiredSchoolSources: sources.length, localeCount: localeRows.length, publicationAuthorized: false });
}
console.log(JSON.stringify({ ok: true, generatedAt, results }, null, 2));
