import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral";
type ProgramSpec = { name: string; degree: Degree; language: "Chinese" | "Chinese/English"; durationYears: number; cscaSubjects?: string[] };

const root = process.cwd();
const run = "2026-10-26T10-01-10-896Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["neau-university-home-current", "f8db0a667f024e2960ce0412e631fd7302d69ad3cc37a9470337336f4307c8f4"],
  ["neau-international-college-home-current", "42c0fd26e26afdbd9bb55a8070cf70c53e6aee0b14c7af96e5606de412ad2e0a"],
  ["neau-international-undergraduate-guide-2026", "fc316a4042ebfb7eea18dc1a09bf1494b42892ed0dcdc46a2f19b9b5139cc2e1"],
  ["neau-international-graduate-guide-pdf-2026", "8d8869634e35e72a8a8168c5dada58cfa2a3fd684377f237b5a155a3acfef89c"],
  ["neau-cgs-high-level-graduate-2026", "ffaa0240a8e42f9849ff6eed6440f23f04c526c974407f74e40e4e58c1532509"],
  ["neau-eurasian-scholarship-2026", "f86352c455e3b3d0775da41335093ed1015676f1ea9c1e4c741fcf706fabee19"],
  ["neau-international-fees-current", "06c552f6aaf347cb89b91a30bff78858dfd7eddc279db3bb74663986deb7d8dc"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked NEAU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`NEAU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const undergraduateGuide = sources.get("neau-international-undergraduate-guide-2026")!;
const graduateGuide = sources.get("neau-cgs-high-level-graduate-2026")!;
const graduatePdf = sources.get("neau-international-graduate-guide-pdf-2026")!;
const eurasian = sources.get("neau-eurasian-scholarship-2026")!;
const fees = sources.get("neau-international-fees-current")!;
const internationalHome = sources.get("neau-international-college-home-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "harbin");
if (!city) throw new Error("Reviewed Harbin dependency missing");

const school = {
  slug: "northeast-agricultural-university",
  nameEn: "Northeast Agricultural University",
  nameZh: "东北农业大学",
  citySlug: "harbin",
  schoolType: "Public agricultural university",
  region: "Harbin, Heilongjiang, Northeast China",
  applicationLevel: "The latest complete international applicant materials located are the closed 2026 undergraduate and graduate cycles. No applicant-facing 2027 international guide, approved route list, tuition schedule or deadline was found on the official international college site.",
  languageOfInstruction: "Chinese for the published 2026 undergraduate and master routes; Chinese or English for five named doctoral routes, with the remaining published doctoral routes taught in Chinese.",
  languageRequirement: "Closed 2026 cycle: HSK 4 for Chinese-taught routes; TOEFL iBT 95 or IELTS 6.5 for English-taught applicants unless English is the applicant's native or common language.",
  englishRequirement: "TOEFL iBT 95 or IELTS 6.5 in the closed 2026 cycle; waived where English is the applicant's native or common language.",
  deadlineSummary: "No 2027 international deadline is published. Closed 2026 undergraduate applications and CSCA results were due May 31, 2026; the 2026 CGS high-level graduate application deadline was March 15, 2026.",
  tuitionSummary: "Current official self-funded annual tuition: bachelor CNY 16,000; master CNY 20,000; doctoral CNY 25,000. The 2026 scholarship routes cover tuition.",
  applicationFee: "CNY 400 after admission in the closed 2026 undergraduate guide",
  websiteUrl: "https://www.neau.edu.cn/",
  admissionsUrl: undergraduateGuide.finalUrl ?? undergraduateGuide.url,
  subjectTags: ["Agriculture", "Animal Science", "Veterinary Medicine", "Food Science", "Water Resources", "Life Sciences"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Current self-funded degree tuition: CNY 16,000-25,000/year",
  campusHighlights: ["National 211 Project and Double First-Class agricultural university", "Official 2026 materials publish bachelor, master and doctoral international routes", "Located in Harbin, Heilongjiang"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: internationalHome.fetchedAt,
  ...sourceFields(undergraduateGuide),
  sourceFieldLineage: {
    nameEn: "official bilingual 2026 undergraduate guide",
    nameZh: "official bilingual 2026 undergraduate guide",
    citySlug: "official address plus reviewed Harbin dependency",
    schoolType: "official institutional profile plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official 2026 applicant materials and current international site freshness check",
    languageOfInstruction: "official 2026 undergraduate and graduate program tables",
    languageRequirement: "official 2026 application requirements",
    englishRequirement: "official 2026 application requirements",
    deadlineSummary: "official closed 2026 undergraduate and scholarship deadlines",
    tuitionSummary: "official current fee table and scholarship coverage",
    applicationFee: "official 2026 undergraduate guide",
    websiteUrl: "official university domain",
    admissionsUrl: "official 2026 undergraduate guide",
    subjectTags: "official named program tables",
    languageTags: "official teaching-language tables",
    tuitionBandLabel: "official current fee table",
    campusHighlights: "official institutional profile and program tables",
  },
};

const bachelorGroups: Array<{ names: string[]; subjects: string[] }> = [
  { names: ["Electrical Engineering and Automation", "Artificial Intelligence", "Computer Science and Technology", "Software Engineering", "Data Science and Big Data Technology", "Internet of Things Engineering", "Agricultural Electrification", "Mechanical Design, Manufacturing and Automation", "Agricultural Mechanization and Automation", "Agricultural Architectural Environment and Energy Engineering", "Industrial Engineering", "Logistics Engineering", "Land Consolidation Engineering", "Agricultural Water Conservancy Engineering", "Hydraulic and Hydro-Power Engineering", "Hydrology and Water Resources Engineering", "Civil Engineering", "Engineering Management"], subjects: ["STEM Chinese", "Mathematics", "Physics"] },
  { names: ["Animal Science", "Pratacultural Science", "Aquaculture", "Veterinary Pharmacy", "Veterinary Medicine", "Agronomy", "Plant Protection", "Seed Science and Engineering", "Smart Agriculture", "Pharmacy Engineering", "Biological Engineering", "Biological Technology", "Biological Science", "Grain Engineering", "Dairy Engineering", "Food Science and Engineering", "Food Quality and Safety", "Food Nutrition and Health"], subjects: ["STEM Chinese", "Mathematics", "Chemistry"] },
  { names: ["New Energy Science and Engineering", "Land Resource Management"], subjects: ["STEM Chinese", "Mathematics"] },
  { names: ["Public Administration", "Human Geography and Urban-Rural Planning", "Teaching Chinese to Speakers of Other Languages", "Business Administration", "Accounting", "Human Resource Management", "Marketing", "Agricultural and Forestry Economics and Management", "Insurance Studies", "Finance", "International Economics and Trade"], subjects: ["Humanities Chinese", "Mathematics"] },
];
const bachelorSpecs: ProgramSpec[] = bachelorGroups.flatMap(({ names, subjects }) => names.map((name) => ({ name, degree: "Bachelor" as const, language: "Chinese" as const, durationYears: name === "Veterinary Medicine" ? 5 : 4, cscaSubjects: subjects })));
const masterNames = ["International Chinese Language Education", "Hydrology and Water Resources", "Agricultural Water-Soil Engineering", "Hydraulic and Hydro-Power Engineering", "Pedology", "Plant Nutrition Science", "Environment Protection and Restoration", "Agroecology and Climate Change", "Resources and Environment Microbiology", "Agricultural Resources and Environment", "Crop Cultivation and Farming System", "Plant Genetics and Breeding", "Crop Science", "Plant Pathology", "Agri-entomology and Pest Control", "Pesticide Science", "Plant Protection", "Vegetable Science", "Ornamental Horticulture", "Animal Genetics, Breeding and Reproduction", "Animal Nutrition and Feed Science", "Animal Production", "Aquatic Animal Protection and Production", "Animal Husbandry", "Grass Science", "Basic Veterinary Medicine", "Preventive Veterinary Medicine", "Clinical Veterinary Medicine", "Veterinary Science", "Mechanical Engineering", "Agricultural Mechanization Engineering", "Agri-biological Environment and Energy Engineering", "Agricultural System and Management Engineering", "Management Science and Engineering", "Industrial Economics", "Agricultural Economics and Management", "Enterprise Management", "Botany", "Microbiology", "Developmental Biology", "Biochemistry and Molecular Biology", "Food Science", "Grain, Oil and Plant Protein Engineering", "Agricultural Product Processing and Preserving Engineering", "Food Fermentation Engineering", "Animal Product Processing Engineering", "Computer Science and Technology", "Agricultural Electrification and Automation", "Educational Economics and Management", "Land Resource Management"];
const bilingualDoctoralNames = ["Animal Husbandry", "Clinical Veterinary Medicine", "Food Science", "Grain, Oil and Plant Protein Engineering", "Horticulture"];
const chineseDoctoralNames = ["Agricultural Water-Soil Engineering", "Hydraulic and Hydro-Power Engineering", "Hydrology and Water Resources", "Agricultural Resources and Environment", "Pedology", "Plant Nutrition Science", "Environment Protection and Restoration", "Agroecology and Climate Change", "Resources and Environment Microbiology", "Crop Cultivation and Farming System", "Plant Genetics and Breeding", "Crop Science", "Animal Genetics, Breeding and Reproduction", "Animal Nutrition and Feed Science", "Aquatic Animal Protection and Production", "Animal Production", "Grass Science", "Basic Veterinary Medicine", "Preventive Veterinary Medicine", "Veterinary Science", "Agricultural Mechanization Engineering", "Agri-biological Environment and Energy Engineering", "Agricultural System and Management Engineering", "Agricultural Economics and Management", "Rural Finance", "Botany", "Microbiology", "Developmental Biology", "Biochemistry and Molecular Biology", "Agricultural Product Processing and Preserving Engineering", "Food Fermentation Engineering", "Animal Product Processing Engineering", "Agricultural Electrification and Automation", "Artificial Intelligence in Agriculture", "Pesticide Science", "Entomology", "Plant Pathology", "Plant Protection"];
const specs: ProgramSpec[] = [
  ...bachelorSpecs,
  ...masterNames.map((name) => ({ name, degree: "Master" as const, language: "Chinese" as const, durationYears: 3 })),
  ...bilingualDoctoralNames.map((name) => ({ name, degree: "Doctoral" as const, language: "Chinese/English" as const, durationYears: 4 })),
  ...chineseDoctoralNames.map((name) => ({ name, degree: "Doctoral" as const, language: "Chinese" as const, durationYears: 4 })),
];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const category = (name: string) => /business|econom|finance|management|insurance|marketing/i.test(name) ? "Business" : /computer|software|data|artificial|internet/i.test(name) ? "Computer Science" : /animal|veterinary|agric|crop|plant|horticulture|grass|aquaculture|food|dairy|grain|seed/i.test(name) ? "Agriculture" : /biology|botany|microbiology|science/i.test(name) ? "Science" : /language|human|public|education/i.test(name) ? "Humanities" : "Engineering";
const programs = specs.map((spec) => {
  const source = spec.degree === "Bachelor" ? undergraduateGuide : graduateGuide;
  const tuition = spec.degree === "Bachelor" ? 16000 : spec.degree === "Master" ? 20000 : 25000;
  return {
    slug: `northeast-agricultural-university-${slugify(spec.name)}-${spec.degree.toLowerCase()}-${spec.language === "Chinese" ? "chinese" : "bilingual"}-2026`,
    schoolSlug: school.slug,
    citySlug: "harbin",
    nameEn: spec.name,
    degreeLevel: spec.degree,
    durationYears: spec.durationYears,
    fieldCategory: category(spec.name),
    subjectArea: spec.name,
    teachingLanguage: spec.language,
    ...(spec.language === "Chinese/English" ? { englishRequirement: "TOEFL iBT 95 or IELTS 6.5; waived where English is the applicant's native or common language in the closed 2026 cycle." } : {}),
    ...(spec.cscaSubjects ? { cscaSubjects: spec.cscaSubjects, cscaRequirement: `Closed 2026 cycle: CSCA subjects were ${spec.cscaSubjects.join(", ")}.` } : {}),
    tuitionAmount: tuition,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `Current official self-funded tuition is CNY ${tuition.toLocaleString("en-US")}/year; the named 2026 scholarship routes cover tuition.`,
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: `Named in official closed 2026 ${spec.degree.toLowerCase()} materials; HSK 4 applied to Chinese-taught routes, while the published English threshold was TOEFL iBT 95 or IELTS 6.5. No 2027 route is inferred.`,
    hasScholarship: spec.degree !== "Bachelor",
    scholarshipText: spec.degree === "Bachelor" ? "No 2027 scholarship window is inferred." : "The 2026 CGS high-level graduate and Eurasian-country scholarship guides cover tuition, on-campus accommodation, medical insurance and a stipend for eligible applicants.",
    badgeText: "Closed 2026 official route",
    displayTuition: `CNY ${tuition.toLocaleString("en-US")}/year (current fee table)`,
    displaySubjects: [spec.name],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "official 2026 program table",
      degreeLevel: "official program category",
      durationYears: "official program-category duration",
      fieldCategory: "CUAC taxonomy of official program name",
      subjectArea: "official program name",
      teachingLanguage: "official teaching-language table",
      ...(spec.language === "Chinese/English" ? { englishRequirement: "official 2026 graduate requirements" } : {}),
      ...(spec.cscaSubjects ? { cscaSubjects: "official 2026 undergraduate CSCA table", cscaRequirement: "official 2026 undergraduate CSCA table" } : {}),
      tuitionAmount: "official current fee table",
      tuitionText: "official current fee table and scholarship coverage",
      applicationUrl: "official 2026 applicant material",
      applicationNote: "official named route and closed-cycle limitation",
      hasScholarship: "official 2026 scholarship guides",
      scholarshipText: "official 2026 scholarship coverage",
      badgeText: "official cycle and closed-state label",
    },
  };
});
const programIntakes = programs.map((program) => {
  const isBachelor = program.degreeLevel === "Bachelor";
  return {
    programSlug: program.slug,
    intakeTerm: "2026 Admission",
    intakeYear: 2026,
    deadlineDate: isBachelor ? "2026-05-31T15:59:59.000Z" : "2026-03-15T15:59:59.000Z",
    deadlineLabel: isBachelor ? "Applications and CSCA results closed May 31, 2026 Beijing time." : "The 2026 CGS high-level graduate scholarship application closed March 15, 2026 Beijing time.",
    applicationRound: isBachelor ? "2026 international undergraduate admission" : "2026 CGS high-level graduate scholarship",
    status: "closed" as const,
    ...sourceFields(isBachelor ? undergraduateGuide : graduateGuide),
    sourceFieldLineage: { intakeTerm: "official guide cycle without inferred semester", intakeYear: "official 2026 guide", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official closed deadline", applicationRound: "official 2026 guide" },
  };
});

const scholarship = (slug: string, title: string, nameZh: string, source: Source, eligible: string, requirement: string) => ({
  slug,
  title,
  nameZh,
  schoolSlug: school.slug,
  type: "government",
  typeLabel: title,
  providerName: "中国政府及黑龙江省人民政府",
  providerNameEn: "Chinese Government and Heilongjiang Provincial Government",
  providerLocation: "Harbin, Heilongjiang, China",
  fundingLevel: "Full scholarship in the closed 2026 cycle",
  coverage: "Tuition waiver, on-campus accommodation, comprehensive medical insurance, and monthly stipend.",
  applicableDegree: eligible,
  amountText: "Master stipend CNY 3,000/month; doctoral stipend CNY 3,500/month. Tuition, on-campus accommodation and medical insurance are covered.",
  requirementText: requirement,
  benefitItems: [{ label: "Tuition", included: true, note: "Tuition waiver" }, { label: "Accommodation", included: true, note: "On-campus accommodation" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }, { label: "Living stipend", included: true, note: "Master CNY 3,000/month; doctoral CNY 3,500/month" }],
  eligibilityItems: [{ label: "Degree level", value: eligible }, { label: "Cycle", value: "Closed 2026 application round" }],
  applicationMaterials: [],
  applicationSteps: [],
  actionLinks: [{ label: "Official 2026 scholarship guide", url: source.finalUrl ?? source.url, kind: "official-source" }],
  applicationRound: "Closed 2026 scholarship application; no 2027 window published",
  summary: `${title} terms published for the closed 2026 cycle; no 2027 application round is inferred.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields(source),
  sourceFieldLineage: { title: "official 2026 scholarship guide", coverage: "official scholarship coverage", applicableDegree: "official applicant category", amountText: "official stipend table", requirementText: "official eligibility rules", benefitItems: "official scholarship coverage", eligibilityItems: "official applicant category and cycle", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", applicationRound: "official closed cycle", summary: "official 2026 guide and explicit no-inference rule" },
});
const scholarships = [
  scholarship("northeast-agricultural-university-cgs-high-level-graduate-2026", "Chinese Government Scholarship High-Level Graduate Program at NEAU", "东北农业大学中国政府奖学金高水平研究生项目", graduateGuide, "Master and Doctoral", "Master applicants must hold a bachelor's degree and be under 35; doctoral applicants must hold a master's degree and be under 40, with strong research ability. The closed 2026 deadline was March 15, 2026."),
  scholarship("northeast-agricultural-university-eurasian-countries-scholarship-2026", "Eurasian Countries Scholarship Program at NEAU", "东北农业大学欧亚国家留学生奖学金项目", eurasian, "Master and Doctoral for eligible nationals of 13 named Eurasian countries", "Applicants must be non-Chinese citizens from one of the 13 countries named in the official guide and meet the published degree, age, health and research requirements. The closed 2026 deadline was March 15, 2026."),
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: internationalHome.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: internationalHome.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 120, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "No applicant-facing 2027 international admission guide, approved program list, tuition schedule or deadline was found on the official international college site. No 2026 field is relabeled as 2027.",
    "All route and intake rows are explicitly tied to closed 2026 official materials. The guides do not state an intake semester, so the intake label is '2026 Admission' rather than an inferred Fall term.",
    "The graduate intake deadline represents the 2026 CGS high-level graduate scholarship route, not a universal self-funded graduate deadline.",
    "Applicant documents, personal contacts, accommodation room-price detail and visa/financial-support materials are excluded from the candidate.",
    `The official standalone graduate PDF is hash-locked as supporting evidence (${graduatePdf.sha256}); structured route names use the official HTML scholarship guide so every extracted row remains directly traceable.`,
    `The current fee table is separately hash-locked (${fees.sha256}); it does not publish a 2027 effective period.`,
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant documents, personal contacts, payment details and financial-support records are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-165");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 165, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
