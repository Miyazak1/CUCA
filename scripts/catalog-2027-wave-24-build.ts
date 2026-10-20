import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
type CourseLd = {
  name: string;
  description: string;
  educationalLevel: string;
  timeRequired: string;
  provider?: { department?: { name?: string } };
  coursePrerequisites?: string[];
  offers?: { price?: number; priceCurrency?: string };
  hasCourseInstance?: Array<{ name: string; startDate: string; offers?: { availabilityEnds?: string } }>;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const expected: Record<string, string> = {
  "nuaa-international-program-index-current": "6f0886ab6488903e912ea33a3c897d60892f1e2dd51df381f34119750e54623b",
  "nuaa-international-admissions-current": "ee6d65a76339972f7a6129d1774d9e62f865bc493ecb4210c86dc9f5fec5a5d3",
  "nuaa-scholarships-and-fees-current": "559dfad8bf19949172f654825561ba35d4c0aa671e56bb03e2288231105312a4",
  "nuaa-aeronautical-engineering-bachelor-2027": "d6a4e2bb3a55f4000beaef58b86bda0753a292e4cb70e0a6d2efc16227069340",
  "nuaa-artificial-intelligence-bachelor-2027": "8ab0610019952340648748fdbb9e673dc1bf27346a9239f6d75c2c2470e781d5",
  "nuaa-civil-engineering-bachelor-2027": "f88d954513582988184aa1508ef724c01cad65faf75c3e93c5bc120f9ca8724a",
  "nuaa-electrical-electronics-engineering-bachelor-2027": "26a6ea7319e0bdd141db857ba9ca0fd28f47f5ef62ce616c1501e807cc1a5824",
  "nuaa-international-business-trade-bachelor-2027": "54d0b0b39d8d2eb55c4c89fd2db13d53ea2609d572442b8a0d61da7a1803d5db",
  "nuaa-mechanical-engineering-bachelor-2027": "bc1fa555f9675edb57934233e13f495604929208b0c4f7bf8d3e41c2cfb64d38",
  "nuaa-foundation-program-2027": "37f43d47aed678fe356cf4b615ad2a904f69baf422cd58d8d6e0d784db7fd656",
  "nuaa-chinese-language-program-2027": "e7d78379015ebfa61f4e51addec21425de634b38cbf60fcfbb99462013906ee1",
};

const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, { ...item, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 24 evidence: ${missing.join(", ")}`);
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => { const item = source(id); return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt }; };
const verified = (id: string) => ({ status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source(id).fetchedAt, ...fields(id) });

const readCourse = async (id: string): Promise<CourseLd> => {
  const item = source(id);
  const html = await readFile(resolve(item.runRoot, item.artifactPath), "utf8");
  const marker = '<script type="application/ld+json">';
  const start = html.indexOf(marker);
  const end = html.indexOf("</script>", start + marker.length);
  if (start < 0 || end < 0) throw new Error(`Missing Course JSON-LD: ${id}`);
  const parsed = JSON.parse(html.slice(start + marker.length, end)) as CourseLd & { "@type"?: string };
  if (parsed["@type"] !== "Course" || !parsed.name || !parsed.educationalLevel || !parsed.timeRequired) throw new Error(`Invalid Course JSON-LD: ${id}`);
  if (!parsed.hasCourseInstance?.length || parsed.hasCourseInstance.some((row) => !row.startDate.startsWith("2027-"))) throw new Error(`Unexpected 2027 intake shape: ${id}`);
  return parsed;
};

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = baseline.cities?.find((row) => row.slug === "nanjing");
if (!city) throw new Error("Wave 24 Nanjing dependency is missing.");
const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const school = {
  slug: "nanjing-university-of-aeronautics-and-astronautics",
  nameEn: "Nanjing University of Aeronautics and Astronautics",
  nameZh: "南京航空航天大学",
  citySlug: "nanjing",
  schoolType: "Public",
  region: "Nanjing, Jiangsu, East China",
  applicationLevel: "Undergraduate, Master and Non-degree routes are listed in the current international catalog.",
  languageOfInstruction: "English for the eight Wave 24 routes.",
  englishRequirement: "The current English-taught bachelor's routes publish IELTS 6.0, TOEFL 80 or equivalent, with an English-medium-school exemption. The foundation route requires basic English but no certificate; the Chinese-language route requires no English test.",
  deadlineSummary: "The one-semester foundation closes December 30, 2026 and starts March 9, 2027. Other March routes use their published structured deadlines. September 2027 bachelor's pages visibly say May 30, 2027 while structured data says June 1, 2027; CUAC uses the earlier visible date and records the conflict for review.",
  tuitionSummary: "Six English-taught bachelor's routes: CNY 22,900-23,900/year; one-semester foundation: CNY 8,400; Chinese language: CNY 8,400/semester or CNY 16,800/year.",
  applicationFee: "CNY 400, non-refundable",
  websiteUrl: "https://www.nuaa.edu.cn/",
  admissionsUrl: "https://ciee.nuaa.edu.cn/admissions",
  cscaRequired: true,
  cscaRequirement: "All six bachelor's routes require a CSCA score; the current route pages do not publish an exact subject mapping. The March foundation route does not require a CSCA score at application.",
  subjectTags: ["Aeronautical Engineering", "Artificial Intelligence", "Civil Engineering", "Electrical and Electronics Engineering", "International Business and Trade", "Mechanical Engineering", "Foundation", "Chinese Language"],
  languageTags: ["English", "Chinese language study"],
  campusHighlights: ["Nanjing", "Aeronautics and astronautics", "English-taught engineering and business routes"],
  ...verified("nuaa-international-admissions-current"),
  sourceFieldLineage: { nameEn: "official admissions and program catalog identity", citySlug: "official university identity and Nanjing campus", applicationLevel: "current official program index", languageOfInstruction: "eight official route pages", englishRequirement: "official route prerequisites", deadlineSummary: "route-page structured data and visible September guidance", tuitionSummary: "official route-page offers", applicationFee: "official admissions process", cscaRequirement: "official bachelor and foundation route pages" },
};

const routeSpecs = [
  ["nuaa-aeronautical-engineering-bachelor-2027", "nanjing-university-of-aeronautics-and-astronautics-aeronautical-engineering-bachelor-2027", "航空航天工程学士（英文授课）", "Aerospace Engineering", true],
  ["nuaa-artificial-intelligence-bachelor-2027", "nanjing-university-of-aeronautics-and-astronautics-artificial-intelligence-bachelor-2027", "人工智能学士（英文授课）", "Artificial Intelligence", true],
  ["nuaa-civil-engineering-bachelor-2027", "nanjing-university-of-aeronautics-and-astronautics-civil-engineering-bachelor-2027", "土木工程学士（英文授课）", "Civil Engineering", true],
  ["nuaa-electrical-electronics-engineering-bachelor-2027", "nanjing-university-of-aeronautics-and-astronautics-electrical-electronics-engineering-bachelor-2027", "电气与电子工程学士（英文授课）", "Electrical and Electronics Engineering", true],
  ["nuaa-international-business-trade-bachelor-2027", "nanjing-university-of-aeronautics-and-astronautics-international-business-trade-bachelor-2027", "国际商务与贸易学士（英文授课）", "International Business and Trade", true],
  ["nuaa-mechanical-engineering-bachelor-2027", "nanjing-university-of-aeronautics-and-astronautics-mechanical-engineering-bachelor-2027", "机械工程学士（英文授课）", "Mechanical Engineering", true],
  ["nuaa-foundation-program-2027", "nanjing-university-of-aeronautics-and-astronautics-pre-engineering-pre-business-foundation-2027", "工程与商科预科项目", "Foundation", false],
  ["nuaa-chinese-language-program-2027", "nanjing-university-of-aeronautics-and-astronautics-chinese-language-program-2027", "汉语进修项目", "Chinese language", false],
] as const;

const programs: CatalogSeedProgram[] = [];
const programIntakes: CatalogSeedProgramIntake[] = [];
for (const [id, slug, nameZh, subjectArea, requiresCsca] of routeSpecs) {
  const course = await readCourse(id);
  const durationYears = course.timeRequired.match(/^P(\d+)Y$/)?.[1];
  const durationMonths = course.timeRequired.match(/^P(\d+)M$/)?.[1];
  const isBachelor = course.educationalLevel.toLowerCase().includes("bachelor");
  const noScholarship = id === "nuaa-chinese-language-program-2027";
  const program: CatalogSeedProgram = {
    slug,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: course.name,
    nameZh,
    degreeLevel: isBachelor ? "Bachelor" : "Non-degree",
    ...(durationYears ? { durationYears: Number(durationYears) } : {}),
    ...(durationMonths ? { durationMonths: Number(durationMonths) } : {}),
    fieldCategory: isBachelor ? "Degree program" : subjectArea,
    subjectArea,
    teachingLanguage: id === "nuaa-chinese-language-program-2027" ? "Chinese language study; the page labels program delivery as English" : "English",
    ...(id === "nuaa-chinese-language-program-2027" ? { hskRequirement: "No prior Chinese proficiency or HSK score is required; complete beginners are welcome." } : {}),
    ...(requiresCsca ? { cscaRequirement: "A CSCA score is required. The current route page does not state the exact subject combination; applicants without a result may use the March foundation route." } : {}),
    ...(isBachelor ? { englishRequirement: "IELTS 6.0, TOEFL 80 or equivalent; English-medium school graduates may be exempt." } : id === "nuaa-foundation-program-2027" ? { englishRequirement: "Basic English sufficient to follow classes; a test certificate helps but is not required." } : {}),
    tuitionAmount: course.offers?.price,
    tuitionCurrency: course.offers?.priceCurrency ?? "CNY",
    tuitionPeriod: id === "nuaa-foundation-program-2027" ? "six-month program" : "year",
    tuitionText: `CNY ${Number(course.offers?.price).toLocaleString("en-US")} per ${id === "nuaa-foundation-program-2027" ? "one-semester program; medical insurance is included; one-time application fee USD 65" : "year; application fee CNY 400"}.`,
    scholarshipText: noScholarship ? "The official page states that scholarships are not available for this program." : "The current NUAA page lists the NUAA Freshman Scholarship, Nanjing Government Scholarship and applicable Chinese Government Scholarship routes; awards are competitive and route-dependent.",
    applicationUrl: source(id).url,
    applicationNote: `${(course.coursePrerequisites ?? []).join(" ")} ${isBachelor ? "The March route combines foundation study with a conditional bachelor's offer; direct Year 1 bachelor's entry is the September route." : id === "nuaa-foundation-program-2027" ? "The page publishes one Spring 2027 foundation intake from March 9 to early July, followed by conditional bachelor's progression in September after successful foundation completion and a satisfactory CSCA result." : "The page publishes March and September 2027 intakes."}`,
    hasScholarship: !noScholarship,
    badgeText: id === "nuaa-foundation-program-2027" ? "March 2027" : "March / September 2027",
    displayTuition: `CNY ${Number(course.offers?.price).toLocaleString("en-US")}/${id === "nuaa-foundation-program-2027" ? "six months" : "year"}`,
    displayGroup: isBachelor ? "Undergraduate" : "Non-degree",
    displayGroupLabel: isBachelor ? "English-taught bachelor's programs" : "Foundation and language programs",
    ...verified(id),
    sourceFieldLineage: { nameEn: "Course JSON-LD name", durationYears: durationYears ? "Course JSON-LD timeRequired" : undefined, durationMonths: durationMonths ? "Course JSON-LD timeRequired" : undefined, subjectArea: "official route title and department", teachingLanguage: "official route page", hskRequirement: id === "nuaa-chinese-language-program-2027" ? "official route prerequisites: complete beginners welcome; no HSK required" : undefined, cscaRequirement: requiresCsca ? "official route prerequisites" : undefined, englishRequirement: isBachelor || id === "nuaa-foundation-program-2027" ? "official route prerequisites" : undefined, tuitionAmount: "Course JSON-LD offer", tuitionText: "official route cost section", scholarshipText: "official route FAQ and scholarship page", applicationNote: "Course JSON-LD prerequisites and visible intake guidance" },
  };
  program.sourceFieldLineage = Object.fromEntries(Object.entries(program.sourceFieldLineage ?? {}).filter(([, value]) => value !== undefined));
  programs.push(program);
  for (const instance of course.hasCourseInstance ?? []) {
    const spring = instance.startDate === "2027-03";
    const structuredDeadline = instance.offers?.availabilityEnds;
    const deadlineDate = spring ? structuredDeadline : "2027-05-30T00:00:00Z";
    programIntakes.push({
      programSlug: program.slug,
      intakeTerm: spring ? "Spring" : "Fall",
      intakeYear: 2027,
      ...(deadlineDate ? { deadlineDate } : {}),
      deadlineLabel: spring
        ? "Structured page data gives December 1, 2026 for the March 2027 route."
        : "Visible page guidance says apply by May 30, 2027; Course JSON-LD states June 1, 2027. CUAC records the earlier visible date and preserves the conflict for review.",
      applicationRound: spring && isBachelor ? "March 2027 foundation plus conditional bachelor's progression" : `${spring ? "March" : "September"} 2027 entry`,
      status: "open",
      ...fields(id),
      sourceFieldLineage: { intakeTerm: "Course JSON-LD startDate and visible route heading", intakeYear: "Course JSON-LD startDate", deadlineDate: spring ? "Course JSON-LD availabilityEnds" : "earlier visible deadline selected from a documented source conflict", deadlineLabel: "visible route guidance and Course JSON-LD", status: "deadline compared with capturedAt" },
    });
  }
}

const scholarshipFields = verified("nuaa-scholarships-and-fees-current");
const scholarshipLink = [{ label: "Official NUAA scholarships and fees page", url: source("nuaa-scholarships-and-fees-current").url, kind: "official-source" }];
const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "nuaa-freshman-scholarship-2027",
    title: "NUAA Freshman Scholarship",
    type: "university", typeLabel: "NUAA Freshman Scholarship", providerName: "Nanjing University of Aeronautics and Astronautics", schoolSlug: school.slug,
    fundingLevel: "One-off award", coverage: "One-off CNY 10,000 award.", applicableDegree: "Bachelor, including the Foundation pathway", amountText: "CNY 10,000 one-off award.", deadlineLabel: "Select the scholarship in the admission application; the current page does not publish a separate deadline.", requirementText: "Available to international bachelor's applicants from all countries, including applicants using the Foundation pathway; selection is competitive.", actionLinks: scholarshipLink,
    ...scholarshipFields,
    sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official one-off-award label", coverage: "official coverage", applicableDegree: "official degree-level row", amountText: "official coverage", deadlineLabel: "official selection instruction", requirementText: "official degree level and eligibility" },
  },
  {
    slug: "nuaa-csc-silk-road-scholarship-2027",
    title: "NUAA Silk Road Scholarship (CSC)",
    type: "government", typeLabel: "Chinese Government Scholarship - Silk Road", providerName: "China Scholarship Council / NUAA", schoolSlug: school.slug,
    fundingLevel: "Full", coverage: "Full tuition waiver, free on-campus accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Master; Doctoral", deadlineDate: "2027-04-30", deadlineLabel: "Application deadline: April 30, 2027.", requirementText: "Open to eligible master's and doctoral applicants from Belt and Road countries; award decisions remain competitive.", actionLinks: scholarshipLink,
    ...scholarshipFields,
    sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official full-funding label", coverage: "official coverage list", applicableDegree: "official degree level", deadlineDate: "official deadline", deadlineLabel: "official deadline", requirementText: "official eligibility" },
  },
  {
    slug: "nuaa-nanjing-government-scholarship-2027",
    title: "NUAA Nanjing Government Scholarship",
    type: "government", typeLabel: "Nanjing Government Scholarship", providerName: "Nanjing Municipal Government / NUAA", schoolSlug: school.slug,
    fundingLevel: "One-off award", coverage: "One-off CNY 10,000 award for bachelor's applicants or CNY 20,000 for master's and doctoral applicants.", applicableDegree: "Bachelor; Master; Doctoral", amountText: "Bachelor: CNY 10,000; Master and Doctoral: CNY 20,000.", deadlineLabel: "The current page does not publish a separate deadline.", requirementText: "Available to international applicants from all countries; award decisions remain competitive.", actionLinks: scholarshipLink,
    ...scholarshipFields,
    sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official one-off-award label", coverage: "official coverage", applicableDegree: "official degree-level row", amountText: "official coverage", deadlineLabel: "absence of a separate deadline on the current page", requirementText: "official eligibility" },
  },
  {
    slug: "nuaa-chinese-government-scholarship-current",
    title: "NUAA Chinese Government Scholarship",
    type: "government", typeLabel: "Chinese Government Scholarship", providerName: "China Scholarship Council / NUAA", schoolSlug: school.slug,
    fundingLevel: "Full", coverage: "Full tuition waiver, free on-campus accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Bachelor; Master; Doctoral", deadlineDate: "2027-03-30", deadlineLabel: "Application deadline: March 30, 2027; bachelor's applicants apply only through the Chinese embassy in their home country.", requirementText: "Open to eligible international applicants from all countries. Bachelor's applicants use the embassy route; master's and doctoral applicants follow the applicable CSC route.", actionLinks: scholarshipLink,
    ...scholarshipFields,
    sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official full-coverage list", coverage: "official coverage list", applicableDegree: "official degree-level row", deadlineDate: "official deadline", deadlineLabel: "official deadline and embassy restriction", requirementText: "official eligibility and application-route description" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 24 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The September 2027 route pages visibly state May 30, 2027 while their Course JSON-LD states June 1, 2027. The candidate uses the earlier visible date and preserves the conflict for human review.",
    "The six bachelor's pages require CSCA but do not publish exact subject combinations; cscaSubjects therefore remains absent.",
    "The March bachelor's route is a one-semester foundation pathway with a conditional bachelor's offer, not direct Year 1 entry; applicationRound records that distinction.",
    "The current catalog also lists 25 postgraduate routes. They remain outside this wave until each program page is separately registered and acquired.",
    "Scholarship dates without an explicit year are retained as labels only and are not converted into deadlineDate values.",
  ],
  notes: ["Course names, duration, tuition, prerequisites and intake metadata are parsed from the official page's Course JSON-LD and cross-checked against visible page text.", "No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-24.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-24.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-24.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
